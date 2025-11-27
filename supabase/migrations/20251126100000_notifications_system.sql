-- ==============================================================================
-- SAGA PLUS - BİLDİRİM VE EKİP YÖNETİMİ DÜZELTME MİGRASYONU
-- Tarih: 25.11.2025
-- Açıklama: Bu dosya team_members tablosunu oluşturur, RLS ayarlarını yapar,
-- otomatik lider atama ve Edge Function bildirim tetikleyicilerini kurar.
-- ==============================================================================

-- 1. GEREKLİ EKLENTİLERİ AKTİF ET
-- Edge Function'a HTTP isteği atmak için pg_net eklentisi şarttır.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ==============================================================================
-- 2. TABLO KURULUMU: team_members
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    team_id bigint NOT NULL, -- Teams tablosu ID'si (bigint)
    user_id uuid NOT NULL,   -- Profiles tablosu ID'si (uuid)
    role text NOT NULL DEFAULT 'member'::text, -- 'leader', 'member', 'admin'
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    
    -- Primary Key
    CONSTRAINT team_members_pkey PRIMARY KEY (id),
    
    -- Foreign Keys (İlişkiler)
    CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) 
        REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- ==============================================================================
-- 3. GÜVENLİK AYARLARI (RLS POLICIES)
-- ==============================================================================

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Eski politikalar varsa temizle (Çakışmayı önlemek için)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.team_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.team_members;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.team_members;

-- Yeni politikaları oluştur
-- 1. Okuma: Herkes görebilir (Geliştirme aşaması için geniş yetki)
CREATE POLICY "Enable read access for all users" ON public.team_members
FOR SELECT USING (true);

-- 2. Ekleme: Sadece giriş yapmış kullanıcılar üye ekleyebilir
CREATE POLICY "Enable insert for authenticated users only" ON public.team_members
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Silme: Sadece giriş yapmış kullanıcılar silebilir
CREATE POLICY "Enable delete for authenticated users" ON public.team_members
FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 4. OTOMATİK LİDER ATAMA SİSTEMİ
-- Senaryo: Yeni bir takım (teams) oluşturulduğunda, o takımı oluşturan 
-- kişi (leader_id) otomatik olarak üyeler tablosuna 'leader' olarak eklenir.
-- ==============================================================================

-- Önce temizlik
DROP TRIGGER IF EXISTS on_team_created_add_leader ON public.teams;
DROP FUNCTION IF EXISTS public.auto_add_leader_to_members();

-- Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION public.auto_add_leader_to_members()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer takım oluşturulurken bir lider seçilmişse
  IF NEW.leader_id IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (NEW.id, NEW.leader_id, 'leader');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Bağlantısı
CREATE TRIGGER on_team_created_add_leader
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_leader_to_members();

-- ==============================================================================
-- 5. BİLDİRİM TETİKLEYİCİSİ (EDGE FUNCTION TRIGGER)
-- Senaryo: team_members tablosuna yeni biri eklendiğinde (INSERT),
-- Supabase Edge Function'a (handle-team-activity) HTTP isteği atılır.
-- ==============================================================================

-- Önce temizlik
DROP TRIGGER IF EXISTS "trigger_team_member_notification" ON "public"."team_members";
DROP FUNCTION IF EXISTS public.notify_edge_function();

-- HTTP İstek Fonksiyonu (Native pg_net kullanımı)
CREATE OR REPLACE FUNCTION public.notify_edge_function()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
  
  -- AYARLAR: Lütfen burayı kendi projenize göre doldurun!
  -- .env dosyanızdaki EXPO_PUBLIC_SUPABASE_URL ve ANON_KEY değerleri
  project_url text := 'https://vvcljrqfnqaxditsryhv.supabase.co'; 
  anon_key text := 'SENIN_ANON_KEY_BURAYA_GELECEK'; 
  
BEGIN
  -- Gönderilecek veriyi hazırla
  payload := jsonb_build_object(
    'type', TG_OP,              -- İşlem Tipi (INSERT)
    'table', TG_TABLE_NAME,     -- Tablo Adı (team_members)
    'record', row_to_json(NEW)  -- Eklenen Kaydın Kendisi
  );

  -- pg_net ile asenkron POST isteği at
  SELECT net.http_post(
    url := project_url || '/functions/v1/handle-team-activity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload
  ) INTO request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Bağlantısı
CREATE TRIGGER "trigger_team_member_notification"
AFTER INSERT ON "public"."team_members"
FOR EACH ROW
EXECUTE FUNCTION public.notify_edge_function();
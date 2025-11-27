-- ==============================================================================
-- SAGA PLUS - HEDEF MODÜLÜ (Monthly Targets)
-- ==============================================================================

-- 1. TABLO OLUŞTURMA
CREATE TABLE IF NOT EXISTS public.monthly_targets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    target_type text NOT NULL CHECK (target_type IN ('user', 'team')), -- Hedef kime?
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,     -- Personel ise
    team_id bigint REFERENCES public.teams(id) ON DELETE CASCADE,      -- Ekip ise
    target_month date NOT NULL DEFAULT CURRENT_DATE,                   -- Hangi ayın hedefi (Ayın 1. günü tutulur)
    target_amount integer NOT NULL DEFAULT 0,                          -- Hedef sayısı
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),

    -- Kısıtlama: Ya user_id dolu olmalı ya da team_id (İkisi aynı anda değil)
    CONSTRAINT check_target_owner CHECK (
        (target_type = 'user' AND user_id IS NOT NULL AND team_id IS NULL) OR
        (target_type = 'team' AND team_id IS NOT NULL AND user_id IS NULL)
    ),

    -- Kısıtlama: Aynı kişi/ekip için aynı ayda sadece bir hedef olabilir
    CONSTRAINT unique_target_per_month_user UNIQUE (user_id, target_month),
    CONSTRAINT unique_target_per_month_team UNIQUE (team_id, target_month),

    CONSTRAINT monthly_targets_pkey PRIMARY KEY (id)
);

-- 2. GÜVENLİK (RLS)
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

-- Okuma: Herkes görebilir (Şeffaflık veya admin kontrolü için)
CREATE POLICY "Enable read access for all users" ON public.monthly_targets
FOR SELECT USING (true);

-- Yönetim: Sadece adminler veya yetkililer ekleyip düzenleyebilir
-- (Basitlik için authenticated users yaptık, admin rolü varsa auth.uid() kontrolü ekleyebilirsin)
CREATE POLICY "Enable all access for authenticated users" ON public.monthly_targets
FOR ALL USING (auth.role() = 'authenticated');

-- 3. BİLDİRİM TETİKLEYİCİSİ (Notification Trigger)
-- Daha önce oluşturduğun 'notify_edge_function' fonksiyonunu tekrar kullanıyoruz.
-- Bu sayede hedef eklendiğinde veya güncellendiğinde Edge Function çalışacak.

DROP TRIGGER IF EXISTS "trigger_target_notification" ON "public"."monthly_targets";

CREATE TRIGGER "trigger_target_notification"
AFTER INSERT OR UPDATE ON "public"."monthly_targets"
FOR EACH ROW
EXECUTE FUNCTION public.notify_edge_function();
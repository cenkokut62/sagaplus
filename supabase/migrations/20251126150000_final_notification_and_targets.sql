-- ==============================================================================
-- SAGA PLUS - KONSOLİDE EDİLMİŞ HEDEF VE BİLDİRİM SİSTEMİ MİGRASYONU
-- Tarih: 26.11.2025
-- İçerik: Hedef Modülü, Debug Loglama, PG_NET Entegrasyonu ve Triggerlar
-- ==============================================================================

-- 1. GEREKLİ EKLENTİLER
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ==============================================================================
-- 2. HEDEF MODÜLÜ (Monthly Targets)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.monthly_targets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    target_type text NOT NULL CHECK (target_type IN ('user', 'team')),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id bigint REFERENCES public.teams(id) ON DELETE CASCADE,
    target_month date NOT NULL DEFAULT CURRENT_DATE,
    target_amount integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT check_target_owner CHECK (
        (target_type = 'user' AND user_id IS NOT NULL AND team_id IS NULL) OR
        (target_type = 'team' AND team_id IS NOT NULL AND user_id IS NULL)
    ),
    -- Aynı ay için mükerrer kayıt engelleme
    CONSTRAINT unique_target_per_month_user UNIQUE (user_id, target_month),
    CONSTRAINT unique_target_per_month_team UNIQUE (team_id, target_month),
    CONSTRAINT monthly_targets_pkey PRIMARY KEY (id)
);

-- RLS Politikaları
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.monthly_targets;
CREATE POLICY "Enable read access for all users" ON public.monthly_targets
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.monthly_targets;
CREATE POLICY "Enable all access for authenticated users" ON public.monthly_targets
FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 3. DEBUG LOG TABLOSU (Sistem İzleme İçin)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.trigger_debug_logs (
    id serial PRIMARY KEY,
    log_time timestamp with time zone DEFAULT now(),
    step text,
    details jsonb
);

-- ==============================================================================
-- 4. BİLDİRİM FONKSİYONU (Edge Function Tetikleyici)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.notify_edge_function()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
  -- URL ve Key: En son çalışan konfigürasyon
  project_url text := 'https://vtcztgyznygdocknobfk.supabase.co'; 
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0Y3p0Z3l6bnlnZG9ja25vYmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2OTUyMDUsImV4cCI6MjA3OTI3MTIwNX0.kF5qsNEgUUNyaWTPGmnU1hiYpvx18_ersUROoKx51rA';
  
  record_data jsonb;
  old_record_data jsonb;
BEGIN
  -- Log: Başlangıç
  INSERT INTO public.trigger_debug_logs (step, details) VALUES ('Trigger Başladı', jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP));

  -- Veri Hazırlığı (DELETE için OLD, diğerleri için NEW)
  IF (TG_OP = 'DELETE') THEN record_data := row_to_json(OLD); ELSE record_data := row_to_json(NEW); END IF;
  IF (TG_OP = 'UPDATE') THEN old_record_data := row_to_json(OLD); ELSE old_record_data := null; END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', record_data,
    'old_record', old_record_data
  );

  -- HTTP İsteği Gönder (Timeout 5sn)
  SELECT net.http_post(
    url := project_url || '/functions/v1/handle-team-activity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload,
    timeout_milliseconds := 5000 
  ) INTO request_id;

  -- Log: Sonuç
  INSERT INTO public.trigger_debug_logs (step, details) 
  VALUES ('İstek İletildi', jsonb_build_object('request_id', request_id));

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;

EXCEPTION WHEN OTHERS THEN
  -- Hata Yakalama
  INSERT INTO public.trigger_debug_logs (step, details) 
  VALUES ('SQL ERROR', jsonb_build_object('msg', SQLERRM));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 5. TRIGGER BAĞLANTILARI
-- ==============================================================================

-- A) Team Members (Ekleme, Silme, Güncelleme)
DROP TRIGGER IF EXISTS "trigger_team_member_notification" ON "public"."team_members";
CREATE TRIGGER "trigger_team_member_notification"
AFTER INSERT OR UPDATE OR DELETE ON "public"."team_members"
FOR EACH ROW
EXECUTE FUNCTION public.notify_edge_function();

-- B) Monthly Targets (Ekleme, Güncelleme)
DROP TRIGGER IF EXISTS "trigger_target_notification" ON "public"."monthly_targets";
CREATE TRIGGER "trigger_target_notification"
AFTER INSERT OR UPDATE ON "public"."monthly_targets"
FOR EACH ROW
EXECUTE FUNCTION public.notify_edge_function();

-- C) Teams (Güncelleme - İsim değişirse)
DROP TRIGGER IF EXISTS "trigger_teams_update_notification" ON "public"."teams";
CREATE TRIGGER "trigger_teams_update_notification"
AFTER UPDATE ON "public"."teams"
FOR EACH ROW
EXECUTE FUNCTION public.notify_edge_function();
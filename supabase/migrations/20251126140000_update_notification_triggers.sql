-- ==============================================================================
-- BİLDİRİM SİSTEMİ GÜNCELLEMESİ (DELETE ve UPDATE Desteği)
-- ==============================================================================

-- 1. Notify Fonksiyonunu Güncelle (DELETE işlemleri için 'OLD' kaydı da gönderilmeli)
CREATE OR REPLACE FUNCTION public.notify_edge_function()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
  project_url text := 'https://vvcljrqfnqaxditsryhv.supabase.co'; 
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0Y3p0Z3l6bnlnZG9ja25vYmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2OTUyMDUsImV4cCI6MjA3OTI3MTIwNX0.kF5qsNEgUUNyaWTPGmnU1hiYpvx18_ersUROoKx51rA'; -- .env'den almayı unutma
  record_data jsonb;
  old_record_data jsonb;
BEGIN
  -- İşlem tipine göre veri belirle
  IF (TG_OP = 'DELETE') THEN
    record_data := row_to_json(OLD);
  ELSE
    record_data := row_to_json(NEW);
  END IF;

  -- Update ise eski veriyi de gönder (Kıyaslama için)
  IF (TG_OP = 'UPDATE') THEN
    old_record_data := row_to_json(OLD);
  ELSE
    old_record_data := null;
  END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', record_data,
    'old_record', old_record_data
  );

  SELECT net.http_post(
    url := project_url || '/functions/v1/handle-team-activity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload
  ) INTO request_id;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGERLARI GÜNCELLE

-- A) Team Members: Ekleme (INSERT), Silme (DELETE), Rol Değişimi (UPDATE)
DROP TRIGGER IF EXISTS "trigger_team_member_notification" ON "public"."team_members";
CREATE TRIGGER "trigger_team_member_notification"
AFTER INSERT OR UPDATE OR DELETE ON "public"."team_members"
FOR EACH ROW
EXECUTE FUNCTION public.notify_edge_function();

-- B) Monthly Targets: Ekleme ve Güncelleme
DROP TRIGGER IF EXISTS "trigger_target_notification" ON "public"."monthly_targets";
CREATE TRIGGER "trigger_target_notification"
AFTER INSERT OR UPDATE ON "public"."monthly_targets"
FOR EACH ROW
EXECUTE FUNCTION public.notify_edge_function();

-- C) Teams: Bilgi Güncelleme (Örn: İsim değişikliği)
DROP TRIGGER IF EXISTS "trigger_teams_update_notification" ON "public"."teams";
CREATE TRIGGER "trigger_teams_update_notification"
AFTER UPDATE ON "public"."teams"
FOR EACH ROW
EXECUTE FUNCTION public.notify_edge_function();
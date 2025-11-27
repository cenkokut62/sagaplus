-- ==============================================================================
-- STORAGE BUCKET: Ziyaret Kartvizitleri
-- ==============================================================================

-- 1. Yeni Bucket Oluştur (visit-cards)
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-cards', 'visit-cards', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Güvenlik Politikaları (RLS)

-- A) Yükleme: Sadece giriş yapmış kullanıcılar resim yükleyebilir
CREATE POLICY "Authenticated users can upload visit cards"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'visit-cards' );

-- B) Okuma: Herkes (veya sadece authenticated) görebilir
CREATE POLICY "Anyone can view visit cards"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'visit-cards' );

-- C) Silme/Güncelleme: Sadece kendi yüklediği dosyayı (Opsiyonel)
CREATE POLICY "Users can update own visit cards"
ON storage.objects FOR UPDATE
TO authenticated
USING ( auth.uid() = owner )
WITH CHECK ( bucket_id = 'visit-cards' );
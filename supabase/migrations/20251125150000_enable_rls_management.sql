/*
  # Yönetim Tabloları İçin RLS Politikaları
  
  1. Helper Function:
     - is_admin(): Mevcut kullanıcının admin olup olmadığını kontrol eder.
  
  2. Güvenlik:
     - cities, titles, teams tabloları için RLS aktif edilir.
     - Okuma (SELECT): Giriş yapmış tüm kullanıcılara açık.
     - Yazma (INSERT, UPDATE, DELETE): Sadece is_admin = true olanlara açık.
*/

-- 1. Admin Kontrol Fonksiyonu (Güvenlik için Security Definer kullanılır)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Cities Tablosu Politikaları
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cities are viewable by everyone" 
ON cities FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Cities are editable by admins only" 
ON cities FOR ALL 
TO authenticated 
USING (is_admin())
WITH CHECK (is_admin());

-- 3. Titles Tablosu Politikaları
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Titles are viewable by everyone" 
ON titles FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Titles are editable by admins only" 
ON titles FOR ALL 
TO authenticated 
USING (is_admin())
WITH CHECK (is_admin());

-- 4. Teams Tablosu Politikaları
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by everyone" 
ON teams FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Teams are editable by admins only" 
ON teams FOR ALL 
TO authenticated 
USING (is_admin())
WITH CHECK (is_admin());

-- NOT: İlk kullanıcınızı admin yapmak için Supabase SQL editöründen şu komutu manuel çalıştırın:
-- UPDATE profiles SET is_admin = true WHERE email = 'sizin_emailiniz@ornek.com';
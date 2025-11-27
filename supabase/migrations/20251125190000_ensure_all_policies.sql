/*
  # TÜM PROFİL VE YÖNETİM POLİTİKALARINI ONARMA
  Bu script, önceki denemelerden kalan hatalı politikaları temizler ve
  sistemin %100 doğru çalışması için gereken kuralları baştan yazar.
*/

-- 1. Profiles Tablosu İçin Temizlik ve Yeniden Kurulum
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile OR Admin can update all" ON profiles;

-- OKUMA: Herkes herkesi görebilmeli (Ekip listelerinde isimlerin görünmesi için şart)
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- GÜNCELLEME: Kişi kendini güncelleyebilir VEYA Yönetici herkesi güncelleyebilir
CREATE POLICY "Profiles editable by owner OR admin" 
ON profiles FOR UPDATE 
TO authenticated 
USING ( auth.uid() = id OR is_admin() )
WITH CHECK ( auth.uid() = id OR is_admin() );

-- EKLEME: Sadece sistem/admin (Zaten Edge Function ile yapılıyor ama açık kalsın)
CREATE POLICY "Profiles insertable by admin trigger" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK ( auth.uid() = id OR is_admin() );

-- 2. Diğer Tabloları Garantiye Alma
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Cities
DROP POLICY IF EXISTS "Cities are viewable by everyone" ON cities;
CREATE POLICY "Cities are viewable by everyone" ON cities FOR SELECT TO authenticated USING (true);

-- Titles
DROP POLICY IF EXISTS "Titles are viewable by everyone" ON titles;
CREATE POLICY "Titles are viewable by everyone" ON titles FOR SELECT TO authenticated USING (true);

-- Teams
DROP POLICY IF EXISTS "Teams are viewable by everyone" ON teams;
CREATE POLICY "Teams are viewable by everyone" ON teams FOR SELECT TO authenticated USING (true);
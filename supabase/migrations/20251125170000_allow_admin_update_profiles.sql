/*
  # Profil Güncelleme Yetkisi (Admin)
  
  Mevcut durumda kullanıcılar sadece kendi profillerini güncelleyebiliyor.
  Yöneticilerin, personelleri ekiplere atayabilmesi veya çıkarabilmesi için
  tüm profiller üzerinde UPDATE yetkisine sahip olması gerekir.
*/

-- Mevcut "Sadece kendini güncelle" politikasını adminleri de kapsayacak şekilde genişletiyoruz
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile OR Admin can update all"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR is_admin()
)
WITH CHECK (
  auth.uid() = id OR is_admin()
);
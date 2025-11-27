/*
  # Takım İlişkileri ve Profil İzinlerini Düzeltme
  
  1. Düzeltme:
     - teams tablosundaki leader_id, auth.users yerine profiles tablosuna bağlanmalı.
     - Bu sayede kod tarafında `leader:profiles(...)` sorgusu çalışır hale gelecek.
  
  2. Güvenlik (RLS):
     - Kullanıcıların, ekip liderlerini ve arkadaşlarını görebilmesi için 
       profiles tablosundaki SELECT politikası "herkese açık" hale getirilmeli.
*/

-- 1. Mevcut kısıtlamayı kaldır ve profiles tablosuna bağla
ALTER TABLE teams 
DROP CONSTRAINT IF EXISTS teams_leader_id_fkey;

ALTER TABLE teams
ADD CONSTRAINT teams_leader_id_fkey 
FOREIGN KEY (leader_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- 2. Profiles tablosu için "Sadece kendini gör" kuralını kaldır, "Herkesi gör" yap
-- (Önceki politikaları temizleyelim ki çakışma olmasın)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- Yeni Okuma Politikası: Giriş yapmış herkes profilleri görebilir (İsim, unvan vb. için şart)
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- Diğer yazma politikaları (Update/Insert) değişmedi, onlar güvende.
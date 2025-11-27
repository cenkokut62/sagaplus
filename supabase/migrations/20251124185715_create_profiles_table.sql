/*
  # Kullanıcı Profilleri ve Avatar Yönetimi

  1. Yeni Tablolar
    - `profiles`
      - `id` (uuid, primary key, auth.users ile ilişkili)
      - `email` (text, kullanıcı e-postası)
      - `full_name` (text, kullanıcının tam adı)
      - `avatar_url` (text, avatar resim URL'si)
      - `theme_preference` (text, tema tercihi: light/dark/system)
      - `created_at` (timestamptz, kayıt tarihi)
      - `updated_at` (timestamptz, güncelleme tarihi)

  2. Güvenlik
    - `profiles` tablosu için RLS etkinleştirildi
    - Kullanıcılar sadece kendi profillerini görüntüleyebilir
    - Kullanıcılar sadece kendi profillerini güncelleyebilir
    - Yeni kullanıcı kaydında otomatik profil oluşturulması için trigger

  3. Storage
    - `avatars` bucket'ı oluşturuldu
    - Kullanıcılar sadece kendi avatar'larını yükleyebilir
    - Avatar'lar herkese açık olarak görüntülenebilir
*/

-- Profiles tablosunu oluştur
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  avatar_url text,
  theme_preference text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS'i etkinleştir
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi profillerini görebilir
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Kullanıcılar sadece kendi profillerini güncelleyebilir
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Kullanıcılar kendi profillerini ekleyebilir
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Updated_at otomatik güncelleme için trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Yeni kullanıcı kaydında otomatik profil oluşturma
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Avatars storage bucket'ını oluştur
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Avatar upload politikası: Kullanıcılar sadece kendi klasörlerine yükleyebilir
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Avatar güncelleme politikası
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Avatar silme politikası
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Avatar görüntüleme politikası: Herkes görebilir (public)
CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

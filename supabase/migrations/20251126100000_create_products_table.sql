-- Ürünler tablosunu oluştur
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  code text not null, -- Ürün Kodu (Örn: KGS1111011)
  name text not null, -- Ürün Adı
  category text not null check (category in ('standard', 'premium')), -- 'standard' (2025), 'premium' (X)
  type text not null default 'peripheral', -- 'package' (Paket), 'peripheral' (Uç Birim)
  
  -- Fiyatlandırma
  sale_price decimal(10,2) default 0, -- Satış Bedeli
  
  -- Standart (2025) Kataloğu için Özel Alanlar
  subscription_price_wired decimal(10,2), -- Kablolu Sistem Abonelik Bedeli
  subscription_price_wireless decimal(10,2), -- Kablosuz Sistem Abonelik Bedeli
  
  -- Premium (X) Kataloğu için Özel Alanlar
  subscription_price decimal(10,2), -- Tekil Abonelik Bedeli (X serisi için)
  is_hub_compatible boolean default true, -- Hub 4G Uyumlu mu?
  is_hub2_compatible boolean default true -- Hub 2 4G Uyumlu mu?
);

-- RLS (Row Level Security) Politikaları
alter table public.products enable row level security;

create policy "Herkes ürünleri görebilir"
  on public.products for select
  using (true);

create policy "Sadece adminler ekleme yapabilir"
  on public.products for insert
  with check (true); -- Geliştirme aşamasında açık, canlıda admin kontrolü eklenmeli

create policy "Sadece adminler düzenleme yapabilir"
  on public.products for update
  using (true);

create policy "Sadece adminler silebilir"
  on public.products for delete
  using (true);

-- PDF'lerden alınan ÖRNEK VERİLER (Seed Data)

-- 1. KALE ALARM 2025 (Standart) Örnekleri
insert into public.products 
(code, name, category, type, sale_price, subscription_price_wired, subscription_price_wireless)
values 
('KGS1111011', 'Kablolu Alarm Paketi 4G GPRSli', 'standard', 'package', 21960, 1440, null),
('KGS1115080', 'Dokunmatik Tuş Takımı', 'standard', 'peripheral', 2304, 96, null),
('KGS1115011', '10 Bölmeli Sistem için Led Tuş Takımı', 'standard', 'peripheral', 2016, 84, null);

-- 2. KALE ALARM X (Premium) Örnekleri
insert into public.products 
(code, name, category, type, sale_price, subscription_price, is_hub_compatible, is_hub2_compatible)
values 
('KGS2112023', 'Kale Alarm X Hub 2 (4G) Kontrol Paneli Beyaz', 'premium', 'package', 19800, 2160, true, true),
('KGS2112026', 'Kale Alarm X Hub 4G Kontrol Paneli Beyaz', 'premium', 'package', 11400, 1680, true, false),
('KGS2112081', 'Kale Alarm X Menzil Arttırıcı Beyaz', 'premium', 'peripheral', 7200, 240, false, true); -- Hub1 uyumsuz örnek
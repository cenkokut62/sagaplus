-- ==============================================================================
-- ZİYARET MODÜLÜ (Visits & Offers)
-- ==============================================================================

-- 1. ZİYARETLER TABLOSU
CREATE TABLE IF NOT EXISTS public.visits (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- İşletme Bilgileri (Google Places'ten gelen)
    place_id text NOT NULL,
    place_name text NOT NULL,
    place_address text,
    place_location jsonb, -- { lat: ..., lng: ... }
    
    -- Ziyaret Durumu
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    ended_at timestamp with time zone,
    duration_seconds integer DEFAULT 0,
    
    -- Ziyaret Sonlandırma Verileri
    contact_name text,
    contact_phone text,
    card_image_url text,
    visit_notes text,
    
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT visits_pkey PRIMARY KEY (id)
);

-- 2. TEKLİFLER TABLOSU (Ziyarete Bağlı)
CREATE TABLE IF NOT EXISTS public.offers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Teklif İçeriği
    products_data jsonb NOT NULL, -- Hesaplanan ürünler ve fiyatlar
    total_price decimal(10,2) NOT NULL,
    is_campaign_applied boolean DEFAULT false, -- Kampanya var mı?
    pdf_url text, -- Oluşturulan PDF'in storage linki
    
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT offers_pkey PRIMARY KEY (id)
);

-- 3. GÜVENLİK (RLS)
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- ZİYARETLER POLİTİKALARI
-- Görme: Kişi kendi ziyaretini görür VEYA Admin ise herkesinkini görür
CREATE POLICY "Visits select policy" ON public.visits
FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid() AND role = 'admin')
);

-- Ekleme: Sadece kendi adına
CREATE POLICY "Visits insert policy" ON public.visits
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Güncelleme: Sadece kendi ziyaretini (bitirmek için)
CREATE POLICY "Visits update policy" ON public.visits
FOR UPDATE USING (auth.uid() = user_id);

-- TEKLİFLER POLİTİKALARI
CREATE POLICY "Offers select policy" ON public.offers
FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Offers insert policy" ON public.offers
FOR INSERT WITH CHECK (auth.uid() = user_id);
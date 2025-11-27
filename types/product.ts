export type ProductCategory = 'standard' | 'premium';
export type ProductType = 'package' | 'peripheral';

export interface Product {
  id: string;
  created_at: string;
  code: string; 
  name: string;
  category: ProductCategory;
  type: ProductType;
  
  // Standart (2025) Alanları
  subscription_price_wired?: number | null;
  subscription_price_wireless?: number | null;
  code_wired?: string | null;
  code_wireless?: string | null;
  
  // Premium (X) Alanları
  subscription_price?: number | null;
  is_hub_compatible?: boolean;
  is_hub2_compatible?: boolean;
}

export interface ProductFormData {
  code: string;
  name: string;
  category: ProductCategory;
  type: ProductType;
  
  // Standart
  subscription_price_wired: string;
  subscription_price_wireless: string;
  code_wired: string;
  code_wireless: string;
  
  // Premium
  subscription_price: string;
  is_hub_compatible: boolean;
  is_hub2_compatible: boolean;
}
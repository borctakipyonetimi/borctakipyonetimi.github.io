/**
 * Google Play Billing Product IDs and Configuration for Bütçem Pro
 * 
 * Bu dosya Google Play Console üzerinden tanımlanan In-App Purchase ve Abonelik
 * ürün kimliklerini merkezi olarak yönetir.
 */

export interface PlayProductConfig {
  id: string;
  type: 'subscription' | 'inapp';
  title: string;
  description: string;
  priceDisplay: string;
  period?: 'monthly' | 'yearly' | 'lifetime';
}

export const PLAY_STORE_PRODUCTS: PlayProductConfig[] = [
  {
    id: 'butcempro_monthly',
    type: 'subscription',
    title: 'Aylık Premium',
    description: 'Her ay otomatik yenilenen tam yetkili premium erişim.',
    priceDisplay: '₺49.99 / ay',
    period: 'monthly'
  },
  {
    id: 'butcempro_yearly',
    type: 'subscription',
    title: 'Yıllık Premium (En Popüler)',
    description: 'Yıllık tasarruflu paket ile tüm özelliklere kesintisiz erişim.',
    priceDisplay: '₺399.99 / yıl',
    period: 'yearly'
  },
  {
    id: 'butcempro_lifetime',
    type: 'inapp',
    title: 'Ömür Boyu Sınırsız Lisans',
    description: 'Tek seferlik ödeme ile ömür boyu tüm pro özellikler sizin olsun.',
    priceDisplay: '₺999.99',
    period: 'lifetime'
  }
];

export const PRODUCT_IDS = {
  MONTHLY: 'butcempro_monthly',
  YEARLY: 'butcempro_yearly',
  LIFETIME: 'butcempro_lifetime'
};

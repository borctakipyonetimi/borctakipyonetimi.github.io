/**
 * Bütçem Pro - Google Play Ödeme Yöntemleri
 */

export interface PaymentMethodOption {
  id: string;
  name: string;
  type: string;
  icon: string;
  details?: string;
  badge?: string;
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "gplay_balance",
    name: "Google Play Bakiyesi",
    type: "Google Play Hesabı",
    icon: "✨",
    badge: "Önerilen"
  },
  {
    id: "credit_card",
    name: "Kredi / Banka Kartı",
    type: "Mastercard •••• 4242 (Google Play)",
    icon: "💳",
    badge: "3D Secure"
  },
  {
    id: "mobil_odeme",
    name: "Mobil Ödeme (Faturaya Yansıt)",
    type: "Turkcell / Vodafone / Türk Telekom (Google Play)",
    icon: "📱",
    badge: "Operatör"
  }
];

export interface ExpensePaymentMethod {
  id: string;
  name: string;
  icon: string;
  badge: string;
}

export const EXPENSE_PAYMENT_METHODS: ExpensePaymentMethod[] = [
  { id: "cash", name: "Nakit", icon: "💵", badge: "Elden / Cüzdan" },
  { id: "credit_card", name: "Kredi Kartı", icon: "💳", badge: "Banka / Kart" }
];

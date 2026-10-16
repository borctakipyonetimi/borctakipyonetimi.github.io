/**
 * Bütçem Pro - Ödeme Yöntemleri & Banka Havalesi / Dijital Cüzdan Bilgileri
 */

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  iban: string;
  branch: string;
  icon: string;
  color: string;
}

export interface DigitalWallet {
  id: string;
  name: string;
  logo: string;
  color: string;
  desc: string;
  badge: string;
  walletNumber: string;
  accountTitle: string;
}

export interface PaymentMethodOption {
  id: string;
  name: string;
  type: string;
  icon: string;
  details?: string;
  badge?: string;
}

export const BANK_ACCOUNTS: BankAccount[] = [
  {
    id: "ziraat",
    bankName: "Ziraat Bankası",
    accountHolder: "Bütçem Pro Finansal Teknolojiler A.Ş.",
    iban: "TR12 0001 0002 0003 0004 0005 06",
    branch: "Merkez Şube (001)",
    icon: "🏛️",
    color: "from-rose-600 to-red-700"
  },
  {
    id: "garanti",
    bankName: "Garanti BBVA",
    accountHolder: "Bütçem Pro Finansal Teknolojiler A.Ş.",
    iban: "TR62 0006 2000 0001 2345 6789 01",
    branch: "Levent Ticari Şubesi",
    icon: "🟢",
    color: "from-emerald-600 to-teal-700"
  },
  {
    id: "isbank",
    bankName: "Türkiye İş Bankası",
    accountHolder: "Bütçem Pro Finansal Teknolojiler A.Ş.",
    iban: "TR44 0006 4000 0012 3456 7890 12",
    branch: "Kuleler Şubesi",
    icon: "🔵",
    color: "from-blue-600 to-indigo-800"
  },
  {
    id: "yapikredi",
    bankName: "Yapı Kredi",
    accountHolder: "Bütçem Pro Finansal Teknolojiler A.Ş.",
    iban: "TR88 0006 7010 0000 0012 3456 78",
    branch: "Maslak Ticari Şube",
    icon: "🔷",
    color: "from-sky-600 to-blue-700"
  },
  {
    id: "akbank",
    bankName: "Akbank",
    accountHolder: "Bütçem Pro Finansal Teknolojiler A.Ş.",
    iban: "TR25 0004 6001 0088 8800 1234 56",
    branch: "Sabancı Center Şubesi",
    icon: "🔴",
    color: "from-red-600 to-rose-700"
  },
  {
    id: "enpara",
    bankName: "Enpara.com (QNB)",
    accountHolder: "Bütçem Pro Finansal Teknolojiler A.Ş.",
    iban: "TR90 0011 1000 0000 0098 7654 32",
    branch: "Dijital Şube (0 Masraf / 7/24 FAST)",
    icon: "🟣",
    color: "from-purple-600 to-fuchsia-700"
  }
];

export const DIGITAL_WALLETS: DigitalWallet[] = [
  {
    id: "papara",
    name: "Papara",
    logo: "👛",
    color: "from-purple-600 to-indigo-600",
    desc: "Papara No veya QR Kod ile anında transfer",
    badge: "0 Komisyon",
    walletNumber: "1029384756",
    accountTitle: "Bütçem Pro Finansal A.Ş."
  },
  {
    id: "paycell",
    name: "Paycell",
    logo: "📱",
    color: "from-blue-600 to-cyan-500",
    desc: "Paycell bakiyesi veya Turkcell faturasına yansıtma",
    badge: "Hızlı Onay",
    walletNumber: "+90 532 100 20 30",
    accountTitle: "Bütçem Pro Paycell Hesabı"
  },
  {
    id: "tosla",
    name: "Tosla",
    logo: "⚡",
    color: "from-pink-500 to-rose-600",
    desc: "Tosla cüzdanınızdan 7/24 masrafsız ödeme",
    badge: "Anında Aktivasyon",
    walletNumber: "2093847511",
    accountTitle: "Bütçem Pro Tosla Cüzdan"
  },
  {
    id: "ininal",
    name: "Ininal Cüzdan",
    logo: "💳",
    color: "from-amber-500 to-orange-600",
    desc: "Ininal barkod veya kart bakiyesi ile ödeme",
    badge: "Kolay Transfer",
    walletNumber: "4098 7654 3210 9876",
    accountTitle: "Bütçem Pro Ininal Hesabı"
  },
  {
    id: "fastpay",
    name: "FastPay / BKM",
    logo: "💠",
    color: "from-emerald-500 to-teal-600",
    desc: "BKM Express ve FastPay hızlı cüzdan",
    badge: "Güvenli SSL",
    walletNumber: "FP-8821-3940",
    accountTitle: "Bütçem Pro FastPay Kurumsal"
  }
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "gplay_balance",
    name: "Google Play Bakiyesi",
    type: "Google Play Hesabı",
    icon: "✨",
    badge: "Hızlı"
  },
  {
    id: "credit_card",
    name: "Kredi / Banka Kartı",
    type: "Mastercard •••• 4242",
    icon: "💳",
    badge: "3D Secure"
  },
  {
    id: "digital_wallet",
    name: "Dijital Cüzdanlar",
    type: "Papara / Paycell / Tosla / Ininal",
    icon: "👛",
    badge: "0 Komisyon"
  },
  {
    id: "bank_transfer",
    name: "Banka Havalesi / FAST",
    type: "Anlaşmalı 6 Banka • 7/24 Anında FAST",
    icon: "🏦",
    badge: "7/24 FAST"
  },
  {
    id: "mobil_odeme",
    name: "Mobil Ödeme",
    type: "Faturaya Yansıt (+90 5xx)",
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
  { id: "credit_card", name: "Kredi Kartı", icon: "💳", badge: "Banka / Taksit" },
  { id: "bank_transfer", name: "Banka Havalesi / FAST", icon: "🏦", badge: "7/24 FAST / EFT" },
  { id: "digital_wallet", name: "Dijital Cüzdan", icon: "👛", badge: "Papara / Paycell" },
];

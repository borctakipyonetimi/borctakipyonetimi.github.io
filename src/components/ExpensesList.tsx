/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  PlusCircle,
  ShoppingCart,
  Folder,
  Edit,
  Trash2,
  Calendar,
  ClipboardList,
  BarChart3,
  Check,
  AlertTriangle,
  Sparkles,
  X,
  Lightbulb,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "motion/react";
import { Expense, ExpenseCategory } from "../types";
import { DoughnutChart, BarChart } from "./BudgetCharts";
import { useCurrency } from "../utils/CurrencyContext";
import ReceiptScanner from "./ReceiptScanner";
import { Camera } from "lucide-react";
import { t } from "../utils/translations";
import { downloadFileWithCustomName } from "../utils/fileDownloadHelper";

interface ExpensesListProps {
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  onSaveExpense: (expense: Partial<Expense>) => void;
  onDeleteExpense: (id: number) => void;
  onSaveCategory: (category: Partial<ExpenseCategory>) => void;
  onDeleteCategory: (id: number) => void;
  onUpdateAllCategories?: (categories: ExpenseCategory[]) => void;
  netBalance?: number;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
  language?: "tr" | "en";
  selectedMonth?: number | null;
  selectedYear?: number | null;
  setSelectedMonth?: (month: number | null) => void;
  setSelectedYear?: (year: number | null) => void;
}

const getSuggestedCategory = (desc: string, expenseCategories: ExpenseCategory[]): ExpenseCategory | null => {
  const d = desc.trim().toLowerCase();
  if (!d) return null;

  const keywordMap: { [key: string]: string[] } = {
    "Kira": ["kira", "ev", "depozito", "apartman", "rent", "konut", "ev kirası", "oda", "hause", "site aidatı", "aidat", "emlak", "site"],
    "Market": ["market", "manav", "kasap", "bakkal", "gıda", "gida", "alışveriş", "alisveris", "deterjan", "şampuan", "getir", "migros", "carrefour", "bim", "şok", "a101", "file", "tekel", "ekmek", "süt", "sut", "peynir", "yoğurt", "yogurt", "sebze", "meyve", "et", "tavuk", "grocery", "gros", "supermarket", "sanal market", "iste gelsin", "istegelsin", "hepsiburada", "trendyol", "pazar", "mutfak"],
    "Ulaşım": ["ulaşım", "ulasim", "otobüs", "otobus", "metro", "marmaray", "akbil", "bilet", "taksi", "uber", "yakıt", "yakit", "benzin", "otogaz", "dizel", "lpg", "shell", "opet", "petrol", "bp", "po", "otoyol", "köprü", "kopru", "hgs", "ogs", "mavi kart", "uçak", "ucak", "tren", "otopark", "car", "travel", "gas", "fuel", "bus", "taxi", "yolculuk", "martı", "scooter", "otoban"],
    "Yeme İçme": ["yemek", "restoran", "lokanta", "cafe", "kafe", "kahve", "starbucks", "burger", "pizza", "kebap", "döner", "doner", "yemeksepeti", "trendyol yemek", "dominos", "tatlı", "tatli", "akşam yemeği", "öğle yemeği", "kahvaltı", "kahvalti", "çay", "cay", "dürüm", "durum", "iskender", "lahmacun", "restaurant", "coffee", "lunch", "dinner", "breakfast", "food", "tatlici", "borek", "pide", "tost", "çorba", "corba", "simit", "köfte", "pideci"],
    "Faturalar": ["fatura", "elektrik", "su", "doğalgaz", "dogalgaz", "gaz", "internet", "telefon", "türk telekom", "turk telekom", "turkcell", "vodafone", "netflix", "spotify", "youtube", "tv", "uydu", "d-smart", "digiturk", "exxen", "blutv", "görüntülü", "fiber", "adsl", "bill", "invoice", "gsm", "wifi", "abonelik", "subscription", "chatai", "chatgpt", "midjourney", "icould", "google drive"],
    "Eğitim": ["okul", "kurs", "kitap", "kırtasiye", "kirtasiye", "eğitim", "egitim", "school", "education", "dergi", "kalem", "defter", "üniversite", "universite", "harç", "harc", "ödev", "odev", "ders", "udemy", "coursera", "sınav"],
    "Sağlık": ["sağlık", "saglik", "hastane", "ilaç", "ilac", "eczane", "doktor", "reçete", "recete", "health", "hospital", "pharmacy", "medicine", "diş", "dis", "tedavi", "klinik", "sağlık ocağı", "saglik ocagi", "muayene", "tahlil", "lens", "gözlük"],
    "Giyim": ["giyim", "elbise", "ayakkabı", "ayakkabi", "pantolon", "tişört", "tisort", "mont", "ceket", "kıyafet", "kiyafet", "h&m", "zara", "lcw", "koton", "mavi", "clothes", "shoes", "wear", "tarz", "defacto", "stradivarius", "pull&bear", "bershka", "trendyol man"],
    "Eğlence": ["sinema", "konser", "tiyatro", "bilet", "eğlence", "eglence", "oyun", "steam", "playstation", "xbox", "pubg", "bira", "alkol", "bar", "pub", "müzik", "muzik", "fun", "game", "movie", "cinema", "etkinlik", "biletix", "passo"],
    "Kişisel Bakım": ["kuaför", "kuafor", "berber", "saç", "sac", "sakal", "bakım", "bakim", "parfüm", "parfum", "makyaj", "kozmetik", "beauty", "hair", "shampoo", "güzellik", "guzellik", "salon", "masaj", "gratis", "watsons", "rossmann", "cilt"],
    "Spor": ["spor", "gym", "fitness", "üyelik", "uyelik", "antrenman", "protein", "nike", "adidas", "puma", "spor salonu", "sport", "macfit", "decathlon", "pasifik"]
  };

  // First check if any keyword directly triggers a category name match from our mappings
  for (const [catName, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(k => d.includes(k))) {
      const matched = expenseCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      if (matched) return matched;
    }
  }

  // Fallback: Check if description contains the name of any active category directly
  for (const cat of expenseCategories) {
    const catNameLower = cat.name.toLowerCase();
    if (catNameLower.length >= 3 && d.includes(catNameLower)) {
      return cat;
    }
  }

  return null;
};

interface ExpenseColorTheme {
  cardBg: string;
  cardBorder: string;
  tagBg: string;
  tagText: string;
  tagBorder: string;
  amountColor: string;
  accentDot: string;
  ambientGlow: string;
}

const EXPENSE_COLOR_PALETTES: ExpenseColorTheme[] = [
  // 0. Emerald / Green (Market, Gıda, Mutfak)
  {
    cardBg: "from-emerald-100/90 via-teal-50/80 to-white/95 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-slate-900",
    cardBorder: "border-emerald-300/90 dark:border-emerald-500/40",
    tagBg: "bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300",
    tagText: "text-emerald-900 dark:text-emerald-300 font-black",
    tagBorder: "border-emerald-300/90 dark:border-emerald-500/40",
    amountColor: "text-emerald-700 dark:text-emerald-400",
    accentDot: "bg-emerald-500",
    ambientGlow: "bg-emerald-500/25 dark:bg-emerald-500/20",
  },
  // 1. Violet / Indigo (Yeme İçme, Restoran, Kafe)
  {
    cardBg: "from-indigo-100/90 via-purple-50/80 to-white/95 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900",
    cardBorder: "border-indigo-300/90 dark:border-indigo-500/40",
    tagBg: "bg-indigo-100/90 text-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-300",
    tagText: "text-indigo-900 dark:text-indigo-300 font-black",
    tagBorder: "border-indigo-300/90 dark:border-indigo-500/40",
    amountColor: "text-indigo-700 dark:text-indigo-400",
    accentDot: "bg-indigo-500",
    ambientGlow: "bg-indigo-500/25 dark:bg-indigo-500/20",
  },
  // 2. Amber / Orange (Araç, Yakıt, Bakım, Sanayi)
  {
    cardBg: "from-amber-100/90 via-orange-50/80 to-white/95 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-slate-900",
    cardBorder: "border-amber-300/90 dark:border-amber-500/40",
    tagBg: "bg-amber-100/90 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300",
    tagText: "text-amber-900 dark:text-amber-300 font-black",
    tagBorder: "border-amber-300/90 dark:border-amber-500/40",
    amountColor: "text-amber-700 dark:text-amber-400",
    accentDot: "bg-amber-500",
    ambientGlow: "bg-amber-500/25 dark:bg-amber-500/20",
  },
  // 3. Sky / Blue (Kira, Konut, Ev, Aidat)
  {
    cardBg: "from-sky-100/90 via-blue-50/80 to-white/95 dark:from-sky-950/40 dark:via-blue-950/20 dark:to-slate-900",
    cardBorder: "border-sky-300/90 dark:border-sky-500/40",
    tagBg: "bg-sky-100/90 text-sky-900 dark:bg-sky-950/70 dark:text-sky-300",
    tagText: "text-sky-900 dark:text-sky-300 font-black",
    tagBorder: "border-sky-300/90 dark:border-sky-500/40",
    amountColor: "text-sky-700 dark:text-sky-400",
    accentDot: "bg-sky-500",
    ambientGlow: "bg-sky-500/25 dark:bg-sky-500/20",
  },
  // 4. Rose / Red (Faturalar, Elektrik, Su, Doğalgaz)
  {
    cardBg: "from-rose-100/90 via-red-50/80 to-white/95 dark:from-rose-950/40 dark:via-red-950/20 dark:to-slate-900",
    cardBorder: "border-rose-300/90 dark:border-rose-500/40",
    tagBg: "bg-rose-100/90 text-rose-900 dark:bg-rose-950/70 dark:text-rose-300",
    tagText: "text-rose-900 dark:text-rose-300 font-black",
    tagBorder: "border-rose-300/90 dark:border-rose-500/40",
    amountColor: "text-rose-700 dark:text-rose-400",
    accentDot: "bg-rose-500",
    ambientGlow: "bg-rose-500/25 dark:bg-rose-500/20",
  },
  // 5. Fuchsia / Pink (Giyim, Moda, Alışveriş)
  {
    cardBg: "from-fuchsia-100/90 via-pink-50/80 to-white/95 dark:from-fuchsia-950/40 dark:via-pink-950/20 dark:to-slate-900",
    cardBorder: "border-fuchsia-300/90 dark:border-fuchsia-500/40",
    tagBg: "bg-fuchsia-100/90 text-fuchsia-900 dark:bg-fuchsia-950/70 dark:text-fuchsia-300",
    tagText: "text-fuchsia-900 dark:text-fuchsia-300 font-black",
    tagBorder: "border-fuchsia-300/90 dark:border-fuchsia-500/40",
    amountColor: "text-fuchsia-700 dark:text-fuchsia-400",
    accentDot: "bg-fuchsia-500",
    ambientGlow: "bg-fuchsia-500/25 dark:bg-fuchsia-500/20",
  },
  // 6. Teal / Cyan (Sağlık, İlaç, Hastane, Eczane)
  {
    cardBg: "from-teal-100/90 via-cyan-50/80 to-white/95 dark:from-teal-950/40 dark:via-cyan-950/20 dark:to-slate-900",
    cardBorder: "border-teal-300/90 dark:border-teal-500/40",
    tagBg: "bg-teal-100/90 text-teal-900 dark:bg-teal-950/70 dark:text-teal-300",
    tagText: "text-teal-900 dark:text-teal-300 font-black",
    tagBorder: "border-teal-300/90 dark:border-teal-500/40",
    amountColor: "text-teal-700 dark:text-teal-400",
    accentDot: "bg-teal-500",
    ambientGlow: "bg-teal-500/25 dark:bg-teal-500/20",
  },
  // 7. Purple / Violet (Eğitim, Kitap, Kurs, Okul)
  {
    cardBg: "from-purple-100/90 via-indigo-50/80 to-white/95 dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-slate-900",
    cardBorder: "border-purple-300/90 dark:border-purple-500/40",
    tagBg: "bg-purple-100/90 text-purple-900 dark:bg-purple-950/70 dark:text-purple-300",
    tagText: "text-purple-900 dark:text-purple-300 font-black",
    tagBorder: "border-purple-300/90 dark:border-purple-500/40",
    amountColor: "text-purple-700 dark:text-purple-400",
    accentDot: "bg-purple-500",
    ambientGlow: "bg-purple-500/25 dark:bg-purple-500/20",
  },
  // 8. Lime / Emerald (Kişisel Bakım, Spor, Fitness)
  {
    cardBg: "from-lime-100/90 via-emerald-50/80 to-white/95 dark:from-lime-950/40 dark:via-emerald-950/20 dark:to-slate-900",
    cardBorder: "border-lime-300/90 dark:border-lime-500/40",
    tagBg: "bg-lime-100/90 text-lime-900 dark:bg-lime-950/70 dark:text-lime-300",
    tagText: "text-lime-900 dark:text-lime-300 font-black",
    tagBorder: "border-lime-300/90 dark:border-lime-500/40",
    amountColor: "text-lime-700 dark:text-lime-400",
    accentDot: "bg-lime-500",
    ambientGlow: "bg-lime-500/25 dark:bg-lime-500/20",
  },
  // 9. Cyan / Blue (Teknoloji, Elektronik, Donanım)
  {
    cardBg: "from-cyan-100/90 via-sky-50/80 to-white/95 dark:from-cyan-950/40 dark:via-sky-950/20 dark:to-slate-900",
    cardBorder: "border-cyan-300/90 dark:border-cyan-500/40",
    tagBg: "bg-cyan-100/90 text-cyan-900 dark:bg-cyan-950/70 dark:text-cyan-300",
    tagText: "text-cyan-900 dark:text-cyan-300 font-black",
    tagBorder: "border-cyan-300/90 dark:border-cyan-500/40",
    amountColor: "text-cyan-700 dark:text-cyan-400",
    accentDot: "bg-cyan-500",
    ambientGlow: "bg-cyan-500/25 dark:bg-cyan-500/20",
  },
  // 10. Orange / Yellow (Borç, Taksit, Kredi, Sigara)
  {
    cardBg: "from-orange-100/90 via-amber-50/80 to-white/95 dark:from-orange-950/40 dark:via-amber-950/20 dark:to-slate-900",
    cardBorder: "border-orange-300/90 dark:border-orange-500/40",
    tagBg: "bg-orange-100/90 text-orange-900 dark:bg-orange-950/70 dark:text-orange-300",
    tagText: "text-orange-900 dark:text-orange-300 font-black",
    tagBorder: "border-orange-300/90 dark:border-orange-500/40",
    amountColor: "text-orange-700 dark:text-orange-400",
    accentDot: "bg-orange-500",
    ambientGlow: "bg-orange-500/25 dark:bg-orange-500/20",
  },
  // 11. Pink / Rose (Hediye, Eğlence, Tatil, Kutlama)
  {
    cardBg: "from-pink-100/90 via-rose-50/80 to-white/95 dark:from-pink-950/40 dark:via-rose-950/20 dark:to-slate-900",
    cardBorder: "border-pink-300/90 dark:border-pink-500/40",
    tagBg: "bg-pink-100/90 text-pink-900 dark:bg-pink-950/70 dark:text-pink-300",
    tagText: "text-pink-900 dark:text-pink-300 font-black",
    tagBorder: "border-pink-300/90 dark:border-pink-500/40",
    amountColor: "text-pink-700 dark:text-pink-400",
    accentDot: "bg-pink-500",
    ambientGlow: "bg-pink-500/25 dark:bg-pink-500/20",
  }
];

const getExpenseColorTheme = (cat?: ExpenseCategory, index: number = 0, expId: string = ""): ExpenseColorTheme => {
  if (cat?.name) {
    let hash = 0;
    for (let i = 0; i < cat.name.length; i++) {
      hash = (hash << 5) - hash + cat.name.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % EXPENSE_COLOR_PALETTES.length;
    return EXPENSE_COLOR_PALETTES[idx];
  }

  if (expId) {
    let hash = 0;
    for (let i = 0; i < expId.length; i++) {
      hash = (hash << 5) - hash + expId.charCodeAt(i);
      hash |= 0;
    }
    return EXPENSE_COLOR_PALETTES[Math.abs(hash) % EXPENSE_COLOR_PALETTES.length];
  }

  return EXPENSE_COLOR_PALETTES[index % EXPENSE_COLOR_PALETTES.length];
};

const getSavingTipForCategory = (name: string, icon: string): string => {
  const norm = name.toLowerCase().trim();

  // Günlük rotasyon: Haftanın gününe (0: Pazar, 1: Pazartesi ... 6: Cumartesi) göre her gün farklı ve taze ipucu
  const dayIndex = new Date().getDay();

  // 1. Sigara & Tütün & Alkol
  if (
    norm.includes("sigara") ||
    norm.includes("tütün") ||
    norm.includes("tutun") ||
    norm.includes("alkol") ||
    norm.includes("puro") ||
    norm.includes("nargile") ||
    icon === "🚬"
  ) {
    const sigaraTips = [
      "📅 Pazar Değerlendirmesi: Sigara tüketiminizi günde sadece 3-4 adet azaltarak başlayın. Ayda yaklaşık 1-2 karton sigara bedeli (₺1.500 - ₺2.500) doğrudan cebinizde kalır.",
      "📅 Pazartesi Motivasyonu: Her sigara almadığınız veya azalttığınız gün için o paket tutarını anında vadeli/altın birikim hesabınıza aktarın; gözünüzün önünde büyüyen parayla motive olun.",
      "📅 Salı Finansal Gerçeği: Sigara harcamanızı yıllık olarak hesaplayın (365 x Paket Fiyatı). Yıllık çıkan ₺30.000 - ₺55.000 arası devasa bütçeyle hayalinizdeki tatili finanse edebileceğinizi unutmayın.",
      "📅 Çarşamba Alışkanlık Dönüşümü: Sigarayı tetikleyen anları değiştirin: Kahve yanında sigara yerine soğuk maden suyu için; stres anlarında 3 dakika derin nefes egzersizi yapın.",
      "📅 Perşembe Takip Disiplini: Mobil sigara bırakma takip uygulaması kullanın. Hem ciğerlerinizin temizlenme oranını hem de saniye saniye cebinizde kalan parayı görerek iradenizi güçlendirin.",
      "📅 Cuma Önlemi: Karton veya toplu paket alımı yapmayın. Evde hazır paket bulundurmak tüketimi hızlandırır; sadece nakit sınırlamasıyla tekli alım kuralı koyun.",
      "📅 Hafta Sonu Hedefi: Sigaraya ayrılan aylık bütçeyi spor salonu üyeliğine veya kaliteli vitamin takviyelerine yönlendirin; hem bedeninize hem cüzdanınıza en karlı yatırımı yapın."
    ];
    return sigaraTips[dayIndex];
  }

  // 2. Araç & Otomobil & Yakıt & Akaryakıt & Benzin & Mazot & Bakım & Sanayi
  if (
    norm.includes("araba") ||
    norm.includes("araç") ||
    norm.includes("arac") ||
    norm.includes("yakıt") ||
    norm.includes("yakit") ||
    norm.includes("akaryakıt") ||
    norm.includes("benzin") ||
    norm.includes("mazot") ||
    norm.includes("lpg") ||
    norm.includes("bakım") ||
    norm.includes("muayene") ||
    norm.includes("sanayi") ||
    norm.includes("kasko") ||
    norm.includes("otopark") ||
    norm.includes("lastik") ||
    icon === "🚗" ||
    icon === "🚘" ||
    icon === "⛽" ||
    icon === "🔧"
  ) {
    const carTips = [
      "📅 Pazar Kontrolü: Lastik hava basınçlarını fabrika değerinde tutmak yakıt tüketimini %3-5 düşürür. Ayda bir kez lastik basınçlarını kontrol edin.",
      "📅 Pazartesi Sürüş Tarzı: Ani hızlanma ve sert frenlerden kaçınarak sabit hız limitlerinde sürün. Sakin sürüş şehir içinde %15'e varan yakıt tasarrufu sağlar.",
      "📅 Salı Bakım Hatırlatması: Motor yağı ve hava filtresi değişimini geciktirmeyin. Tıkalı bir hava filtresi her 100 kilometrede 1 litreye kadar ekstra yakıt harcatır.",
      "📅 Çarşamba Kasko/Sigorta Tasarrufu: Kasko ve Zorunlu Trafik Sigortası yenilemelerinde en az 4 farklı şirketten teklif toplayarak aynı teminatı %30 daha ucuza yaptırın.",
      "📅 Perşembe Bagaj Ağırlığı: Bagajdaki gereksiz yükleri (ağır alet çantası, kutular) boşaltın. Her 50 kg ekstra ağırlık yakıt tüketimini yaklaşık %2 artırır.",
      "📅 Cuma Yakıt Kampanyaları: Akaryakıt alımlarınızı bankaların kredi kartı yakıt kampanyalarıyla eşleştirin. 4 alışverişe verilen puanları sonraki doluma yansıtın.",
      "📅 Hafta Sonu Kısa Mesafe Kuralı: 1-2 km'lik kısa mesafelerde motor ısınana kadar en yüksek yakıt tüketilir. Bu mesafeleri yürüyerek aracınızı yıpranmaktan kurtarın."
    ];
    return carTips[dayIndex];
  }

  // 3. Yeme İçme & Restoran & Dışarıda Yemek & Kafe & Kahve & Fast Food & Paket Servis
  if (
    norm.includes("yemek") ||
    norm.includes("yeme") ||
    norm.includes("içme") ||
    norm.includes("icme") ||
    norm.includes("restoran") ||
    norm.includes("kafe") ||
    norm.includes("kahve") ||
    norm.includes("burger") ||
    norm.includes("kebap") ||
    norm.includes("dışarı") ||
    norm.includes("paket") ||
    norm.includes("sipariş") ||
    norm.includes("tatlı") ||
    icon === "🍔" ||
    icon === "🥩" ||
    icon === "🍕" ||
    icon === "☕" ||
    icon === "🍷"
  ) {
    const foodOutTips = [
      "📅 Pazar Haftalık Menü Planı: Haftalık yemek menünüzü pazar gününden planlayın. İş yerine haftada 3 gün evden yemek ve termosla kahve götürmek ayda ₺3.000-₺5.000 tasarruf sağlar.",
      "📅 Pazartesi İçecek/Tatlı Sınırı: Dışarıda yemek yerken içecek ve tatlı siparişlerini sınırlayın. Restoran hesaplarının yaklaşık %35'i ana yemek dışındaki içeceklerden oluşur.",
      "📅 Salı Uygulama Bariyeri: Paket servis uygulamalarında kayıtlı kredi kartlarınızı kaldırın. Manuel kart girme bariyeri gereksiz sipariş dürtüsünü %60 azaltır.",
      "📅 Çarşamba Sosyal Buluşma: Arkadaş buluşmalarını masraflı restoranlar yerine açık hava parkları veya evde 'herkes bir şey getirsin' konseptli akşamlarla düzenleyin.",
      "📅 Perşembe Günün Menüsü Tercihi: Öğle yemeklerinde restoranların uygun fiyatlı fiks 'Günün Menüsü' alternatiflerini tercih edin; alakarta göre %40 daha avantajlıdır.",
      "📅 Cuma Kahvaltı Stratejisi: Hafta sonu dışarıda serpme kahvaltı yerine evde taze ve zengin bir brunch hazırlayın; fahiş serpme kahvaltı bedellerini birikime aktarın.",
      "📅 Hafta Sonu Pratik Hazırlık: Toplu yemek pişirip porsiyonlayarak dondurucuya atın. Akşam yorgun geldiğinizde hazır sipariş vermek yerine 5 dakikada ısıtıp tüketin."
    ];
    return foodOutTips[dayIndex];
  }

  // 4. Kira & Ev & Konut & Aidat & Apartman & Lojman & Emlak
  if (
    norm.includes("kira") ||
    norm.includes("ev") ||
    norm.includes("konut") ||
    norm.includes("site") ||
    norm.includes("aidat") ||
    norm.includes("apartman") ||
    norm.includes("lojman") ||
    norm.includes("emlak") ||
    icon === "🏠" ||
    icon === "🏢"
  ) {
    const homeTips = [
      "📅 Pazar Enerji Tasarrufu: Evdeki standart ampulleri tasarruflu LED'lerle değiştirin. Bekleme (standby) modundaki cihazları kapatmak faturayı %10-15 azaltır.",
      "📅 Pazartesi Aidat Takibi: Apartman veya site aidat toplantılarına mutlaka katılın. Ortak alan giderleri ve bakım bütçelerini denetleyerek gereksiz artışların önüne geçin.",
      "📅 Salı Kira Diyaloğu: Kira artış dönemlerinde ev sahibiyle yapıcı iletişim kurun. Taşınma, nakliye ve yeni depozito maliyetleri yerine makul oranda uzlaşın.",
      "📅 Çarşamba İzolasyon Hamlesi: Kapı ve pencere kenarlarına yalıtım fitili çekin. Kış aylarında ısı kaybını %20 önleyerek doğalgaz faturanızı ciddi oranda düşürür.",
      "📅 Perşembe Gereksiz Ortak Giderler: Kullanmadığınız ortak alan aboneliklerini ve sabit hatları iptal edin; sadece aktif kullandığınız temel hizmetleri açık tutun.",
      "📅 Cuma Kaçak Kontrolü: Evdeki küçük musluk damlatmaları ve rezervuar kaçaklarını hemen tamir edin. Ayda tonlarca suyun ve gereksiz fatura tutarının akmasını engelleyin.",
      "📅 Hafta Sonu Termostat Dengesi: Oda termostatınızı 1 derece düşürmek yakıt tüketiminde doğrudan %7 tasarruf sağlar. İdeal oda sıcaklığını 21-22 derecede sabitleyin."
    ];
    return homeTips[dayIndex];
  }

  // 5. Ulaşım & Yol & Metro & Dolmuş & Otobüs & Taksi & Akbil & HGS
  if (
    norm.includes("ulaşım") ||
    norm.includes("ulasim") ||
    norm.includes("yol") ||
    norm.includes("otobüs") ||
    norm.includes("otobus") ||
    norm.includes("metro") ||
    norm.includes("metrobüs") ||
    norm.includes("tramvay") ||
    norm.includes("taksi") ||
    norm.includes("dolmuş") ||
    norm.includes("akbil") ||
    norm.includes("kart") ||
    norm.includes("hgs") ||
    norm.includes("ogs") ||
    norm.includes("bilet") ||
    icon === "🚌" ||
    icon === "🚇" ||
    icon === "🚕" ||
    icon === "✈️" ||
    icon === "🚆"
  ) {
    const transportTips = [
      "📅 Pazar Rota Planı: Toplu taşımada tekli binişler yerine mutlaka aylık sınırsız abonman veya indirimli kartları tercih edin; yol harcamanızı %50 hafifletin.",
      "📅 Pazartesi Yürüme Alışkanlığı: 1-2 duraklık kısa mesafelerde taksi veya dolmuş yerine tempolu yürüyün; hem günlük 10 bin adım hedefinize ulaşın hem para biriktirin.",
      "📅 Salı Yol Arkadaşlığı: Aynı yöne giden iş arkadaşlarınızla haftalık dönüşümlü araç paylaşımı (carpooling) yapın; yakıt, otopark ve köprü giderlerini bölüşün.",
      "📅 Çarşamba Taksi Dinamik Fiyat Tuzağı: Taksi çağırma uygulamalarının yoğun saatlerde uyguladığı dinamik fiyatlandırma kat sayılarına dikkat edin; toplu taşımayı değerlendirin.",
      "📅 Perşembe HGS & Gişe Denetimi: HGS ve otopark ekstrelerinizi düzenli kontrol edin; mükerrer çekim veya hatalı gişe okumalarından doğan haksız kesintileri itirazla geri alın.",
      "📅 Cuma Erken Biletleme: Şehirlerarası otobüs veya tren biletlerinizi son güne bırakmayın; 2 hafta önceden alarak erken rezervasyon avantajlarından faydalanın.",
      "📅 Hafta Sonu Trafik Saatleri: Haftalık ulaşım rotanızı harita uygulamalarından analiz edin; trafik yoğunluğu düşük saatlerde yola çıkarak hem zamandan hem yakıttan tasarruf edin."
    ];
    return transportTips[dayIndex];
  }

  // 6. Sağlık & İlaç & Eczane & Doktor & Muayene & Diş & Hastane
  if (
    norm.includes("sağlık") ||
    norm.includes("saglik") ||
    norm.includes("ilaç") ||
    norm.includes("ilac") ||
    norm.includes("hastane") ||
    norm.includes("doktor") ||
    norm.includes("eczane") ||
    norm.includes("diş") ||
    norm.includes("dis") ||
    norm.includes("tedavi") ||
    norm.includes("muayene") ||
    norm.includes("gözlük") ||
    norm.includes("optik") ||
    icon === "💊" ||
    icon === "🩺" ||
    icon === "🏥" ||
    icon === "💉"
  ) {
    const healthTips = [
      "📅 Pazar İlaç Muadili: Reçeteli ilaç alırken eczacınıza aynı etken maddeli devlet onaylı eşdeğer (muadil) ilaç seçeneğini sorun; fahiş fiyat farklarından kaçının.",
      "📅 Pazartesi Sigorta Hakları: Tamamlayıcı sağlık sigortanız varsa poliçenize dahil olan yılda 1 ücretsiz diş temizliği, göz kontrolü ve check-up haklarınızı süresi dolmadan kullanın.",
      "📅 Salı Koruyucu Sağlık: Koruyucu sağlık yatırımlarına ağırlık verin: Günlük yeterli su tüketimi, düzenli uyku ve yürüyüş sizi binlerce liralık tedavi ve ilaç masrafından korur.",
      "📅 Çarşamba Kontrol Süresi: Özel hastane muayenelerinde 10 günlük yasal ücretsiz kontrol süresini kaçırmayın; ek muayene ücreti ödemekten kurtulun.",
      "📅 Perşembe Ecza Dolabı Envanteri: Evdeki ecza dolabını 6 ayda bir kontrol edin; son kullanma tarihi geçmeden mevcut ilaçları listeleyin ve mükerrer ilaç alımını engelleyin.",
      "📅 Cuma Bilinçli Takviye: Vitamin takviyelerini ezbere almak yerine kan tahlili yaptırıp yalnızca hekiminizin önerdiği eksik değerlere odaklanın.",
      "📅 Hafta Sonu Ağız & Diş Bakımı: Rutin diş fırçalama ve diş ipi kullanımı, ileride ortaya çıkabilecek on binlerce liralık kanal tedavisi ve implant masraflarının önüne geçer."
    ];
    return healthTips[dayIndex];
  }

  // 7. Market & Gıda & Mutfak & Pazar & Bakkal & Kasap & Manav
  if (
    norm.includes("market") ||
    norm.includes("mutfak") ||
    norm.includes("gıda") ||
    norm.includes("gida") ||
    norm.includes("bakkal") ||
    norm.includes("manav") ||
    norm.includes("kasap") ||
    norm.includes("şarküteri") ||
    norm.includes("sarkuteri") ||
    norm.includes("pazar") ||
    norm.includes("süpermarket") ||
    norm.includes("erzak") ||
    icon === "🛒" ||
    icon === "🧺" ||
    icon === "🍞" ||
    icon === "🍎"
  ) {
    const marketTips = [
      "📅 Pazar Tok Alışveriş Disiplini: Markete mutlaka tok karnına ve net bir ihtiyaç listesiyle gidin. Aç karnına yapılan plansız alışverişler sepet tutarını %40 gereksiz şişirir.",
      "📅 Pazartesi Birim Fiyat Karşılaştırması: Birim fiyat (Kilo/Litre) karşılaştırması yapın. Göz hizasındaki pahalı markalar yerine alt ve üst raflardaki kaliteli market markalarını inceleyin.",
      "📅 Salı Semt Pazarı Avantajı: Taze meyve ve sebze alışverişinizi semt pazarından yapın; süpermarketlere kıyasla hem daha taze hem yarı fiyatına ürün temin edin.",
      "📅 Çarşamba Sadakat Kampanyaları: Süpermarket sadakat kartlarını ve mobil indirim kuponlarını kullanın; haftalık temel bakliyat ve deterjan alımlarınızı kampanya günlerine denk getirin.",
      "📅 Perşembe Porsiyon & İsraf Önleme: Bozulabilir ürünleri (süt, peynir, yeşillik) tüketebileceğiniz miktarda alın. Satın alınan gıdaların çöpe gitmesini önleyin.",
      "📅 Cuma Toptan Temel Alım: Bakliyat, zeytinyağı, temizlik malzemesi gibi uzun ömürlü temel ihtiyaçları büyük boy ve toptan indirim dönemlerinde alarak birim maliyeti düşürün.",
      "📅 Hafta Sonu Sıfır Atık Mutfak: Haftalık yemek planı yapıp buzdolabındaki kalan malzemeleri değerlendiren yaratıcı tarifler hazırlayın; sıfır atık mutfak disiplini oluşturun."
    ];
    return marketTips[dayIndex];
  }

  // 8. Faturalar & Elektrik & Su & Doğalgaz & İnternet & Telefon & GSM & Abonelik
  if (
    norm.includes("fatura") ||
    norm.includes("elektrik") ||
    norm.includes("su") ||
    norm.includes("doğalgaz") ||
    norm.includes("dogalgaz") ||
    norm.includes("internet") ||
    norm.includes("telefon") ||
    norm.includes("gsm") ||
    norm.includes("tv") ||
    norm.includes("ısınma") ||
    norm.includes("isinma") ||
    norm.includes("abonelik") ||
    icon === "⚡" ||
    icon === "💧" ||
    icon === "🔥" ||
    icon === "📱" ||
    icon === "🌐"
  ) {
    const billsTips = [
      "📅 Pazar Taahhüt Kontrolü: GSM ve ev interneti taahhüt bitiş tarihlerinizi takvime not edin. Taahhüt dolmadan 1 ay önce rakip operatörlerin numara taşıma fırsatlarını inceleyin.",
      "📅 Pazartesi Dijital Abonelik Temizliği: Kullanmadığınız dijital dizi/müzik aboneliklerini (Netflix, Spotify, TV platformları) iptal edin; sadece aktif izlediğiniz 1 platformu açık tutun.",
      "📅 Salı Eko-Mod Kullanımı: Çamaşır ve bulaşık makinelerini tam doldurmadan çalıştırmayın; eko-mod (50°C) programı kullanarak elektrik ve su sarfiyatını %30 azaltın.",
      "📅 Çarşamba Su Perlatörü Tasarrufu: Banyo duş başlıklarına ve lavabo musluklarına hava karışımlı su tasarruf perlatörü takın; su faturasını konfor kaybetmeden %40 düşürün.",
      "📅 Perşembe Radyatör Arkası Yalıtım: Kışın radyatörlerin arkasına ısı yalıtım levhası (alüminyum folyolu strafor) yerleştirin; ısının duvara değil odaya yansımasını sağlayın.",
      "📅 Cuma Üç Zamanlı Tarife: Elektrikte üç zamanlı tarife kullanıyorsanız, yüksek enerji çeken cihazları (ütü, kurutma, bulaşık) saat 22:00'den sonra çalıştırın.",
      "📅 Hafta Sonu Otomatik Ödeme Denetimi: Otomatik ödeme talimatı verdiğiniz faturaların tutarlarını her ay düzenli kontrol edin; kaçak su veya aşım ücreti gibi hataları erkenden yakalayın."
    ];
    return billsTips[dayIndex];
  }

  // 9. Giyim & Alışveriş & Moda & Kıyafet & Ayakkabı & Çanta
  if (
    norm.includes("giyim") ||
    norm.includes("kıyafet") ||
    norm.includes("kiyafet") ||
    norm.includes("elbise") ||
    norm.includes("ayakkabı") ||
    norm.includes("ayakkabi") ||
    norm.includes("çanta") ||
    norm.includes("canta") ||
    norm.includes("moda") ||
    norm.includes("tekstil") ||
    norm.includes("alışveriş") ||
    norm.includes("alisveris") ||
    norm.includes("mont") ||
    icon === "🎒" ||
    icon === "🛍️" ||
    icon === "👗" ||
    icon === "👞" ||
    icon === "👕"
  ) {
    const clothesTips = [
      "📅 Pazar 48 Saat Kuralı: Beğendiğiniz bir giysiyi almadan önce 48 saat bekleme kuralı uygulayın. Sepete ekleyip 2 gün bekleyin; dürtüsel alışverişlerin %70'inden vazgeçeceksiniz.",
      "📅 Pazartesi Sezon Sonu Fırsatları: Sezon sonu tasfiye indirimlerini takip edin: Kışlık kaban ve botları ilkbaharda, yazlık kıyafetleri sonbaharda %60 indirimle alın.",
      "📅 Salı Kapsül Gardırop: Kapsül gardırop mantığını benimseyin: Birbiriyle kolay kombinlenebilen zamansız, kaliteli temel parçalar seçerek her ay kıyafet alma ihtiyacını sıfırlayın.",
      "📅 Çarşamba İkinci El Geliri: Dolabınızda 1 yıldır giymediğiniz kıyafetleri ikinci el platformlarında (Dolap vb.) satarak hem dolabı ferahlatın hem ek bütçe kazanın.",
      "📅 Perşembe Kalite & Dayanıklılık: Çabuk yıpranan ucuz 'hızlı moda' ürünleri yerine kumaş ve dikiş kalitesi yüksek parçalar tercih edin; uzun vadede mükerrer harcamayı önleyin.",
      "📅 Cuma Yıkama Talimatları: Kıyafetlerin yıkama talimatlarına uyun; düşük ısıda yıkayıp ters asarak renk solmasını ve yıpranmasını önleyin, kullanım ömrünü uzatın.",
      "📅 Hafta Sonu Dolap Envanteri: Alışverişe çıkmadan önce dolabınızı gözden geçirin; benzer renk veya modelde zaten sahip olduğunuz parçaları listeleyip mükerrer alımı engelleyin."
    ];
    return clothesTips[dayIndex];
  }

  // 10. Eğlence & Sosyal Aktivite & Kültür & Hobi & Sinema
  if (
    norm.includes("eğlence") ||
    norm.includes("eglence") ||
    norm.includes("sosyal") ||
    norm.includes("hobi") ||
    norm.includes("sinema") ||
    norm.includes("konser") ||
    norm.includes("tiyatro") ||
    norm.includes("aktivite") ||
    norm.includes("oyun") ||
    norm.includes("etkinlik") ||
    icon === "🍿" ||
    icon === "🎸" ||
    icon === "🎮" ||
    icon === "🎟️"
  ) {
    const funTips = [
      "📅 Pazar Ücretsiz Kültür Takvimi: Belediyelerin ve kültür merkezlerinin düzenlediği ücretsiz tiyatro, söyleşi, açık hava sineması ve sergi takvimlerini kültür bültenlerinden takip edin.",
      "📅 Pazartesi Sinema İndirimleri: Sinema ve gösteri biletlerinde operatörlerin '1 bilet alana 1 bedava' veya hafta içi halk günü matine indirimlerini kullanın.",
      "📅 Salı Oyun Kütüphanesi Temizliği: Aktif oynamadığınız oyun platformu (Steam, PS Plus, Game Pass) üyeliklerini askıya alın; kütüphanenizdeki bitirmediğiniz oyunları tamamlayın.",
      "📅 Çarşamba Evde Sosyalleşme: Dışarıda pahalı mekanlar yerine evde masa oyunları veya tematik film geceleriyle sıfır bütçeli keyifli anlar yaratın.",
      "📅 Perşembe Halk Kütüphaneleri: Şehir ve ilçe halk kütüphanelerinden faydalanın; binlerce kitabı, çizgi romanı ve dergiyi tamamen ücretsiz ödünç alın.",
      "📅 Cuma Başlangıç Ekipmanı Testi: Hobi harcamalarınızda pahalı profesyonel setler yerine başlangıç seviyesi ekipmanlarla hevesinizi test edin; atıl masrafları engelleyin.",
      "📅 Hafta Sonu MüzeKart Avantajı: MüzeKart çıkartarak yılda bir kez cüzi bir ücretle Türkiye'deki yüzlerce müzeyi ve tarihi mekanı tamamen bedelsiz gezin."
    ];
    return funTips[dayIndex];
  }

  // 11. Tatil & Seyahat & Otel & Konaklama & Gezi & Tur
  if (
    norm.includes("tatil") ||
    norm.includes("seyahat") ||
    norm.includes("otel") ||
    norm.includes("gezi") ||
    norm.includes("tur") ||
    norm.includes("konaklama") ||
    norm.includes("uçak") ||
    norm.includes("ucak") ||
    icon === "🏖️" ||
    icon === "🌴" ||
    icon === "🗺️" ||
    icon === "🏨"
  ) {
    const travelTips = [
      "📅 Pazar Erken Rezervasyon: Uçak ve otel rezervasyonlarınızı en az 3-4 ay öncesinden planlayın; son dakika fahiş fiyat artışlarından etkilenmeyin.",
      "📅 Pazartesi Sarı Yaz Tercihi: Yüksek sezon (Temmuz-Ağustos) yerine 'Sarı Yaz' (Mayıs veya Eylül-Ekim) aylarında tatil yapın; hem sakinliği yaşayın hem %40 tasarruf edin.",
      "📅 Salı Gizli Sekme Araması: Uçak bileti ararken tarayıcınızın Gizli Sekme modunu kullanın ve çerezleri temizleyin; dinamik fiyat artış tuzaklarına yakalanmayın.",
      "📅 Çarşamba Alternatif Konaklama: Lüks oteller yerine butik pansiyonlar, kiralık daireler veya öğretmen evi / kamu misafirhanelerini araştırın.",
      "📅 Perşembe Kabin Boy Bagaj: Yolculuklarda sadece kabin boy bagajla seyahat edin; ekstra bagaj ücretlerinden ve havalimanında bavul bekleme stresinden kurtulun.",
      "📅 Cuma Esnaf Lokantaları: Gideceğiniz şehrin yerel halkının gittiği esnaf lokantalarını tercih edin; turistik caddelerdeki fahiş restoranlardan uzak durun.",
      "📅 Hafta Sonu Şehir Kartları: Şehir içi ulaşımda turist taksileri yerine günlük/haftalık turist ulaşım kartları satın alarak tüm şehri sınırsız gezin."
    ];
    return travelTips[dayIndex];
  }

  // 12. Eğitim & Kitap & Kurs & Okul & Kırtasiye
  if (
    norm.includes("eğitim") ||
    norm.includes("egitim") ||
    norm.includes("kurs") ||
    norm.includes("kitap") ||
    norm.includes("okul") ||
    norm.includes("kırtasiye") ||
    norm.includes("kirtasiye") ||
    norm.includes("üniversite") ||
    norm.includes("ders") ||
    icon === "🎓" ||
    icon === "📚" ||
    icon === "✏️"
  ) {
    const eduTips = [
      "📅 Pazar Ücretsiz Platformlar: İnternetteki ücretsiz dünya standartlarında eğitim platformlarını (Khan Academy, BTK Akademi, YouTube) değerlendirin.",
      "📅 Pazartesi Öğrenci İndirimleri: Öğrenci e-postanız (@edu.tr) ile Spotify, Notion, GitHub, Adobe ve Microsoft platformlarından %80 indirim veya ücretsiz lisans alın.",
      "📅 Salı İkinci El Ders Kitapları: Okul ve sınav kitaplarında üst dönem öğrencileriyle kitap takası yapın veya temiz ikinci el kaynakları yarı fiyatına temin edin.",
      "📅 Çarşamba Toptan Kırtasiye: Kırtasiye alışverişini okul açılış haftası yerine toptancılardan veya online indirim günlerinde toplu olarak karşılayın.",
      "📅 Perşembe Ücretsiz Dil Kulüpleri: Yabancı dil öğreniminde pahalı kurslar yerine mobil pratik uygulamaları ve ücretsiz yabancı dil konuşma kulüplerini deneyin.",
      "📅 Cuma Ücretsiz Sertifikalar: Mesleki sertifika programlarında İŞKUR, BTK Akademi ve belediye enstitülerinin ücretsiz akredite eğitimlerine başvurun.",
      "📅 Hafta Sonu Kitap Kotası: Her ay net bir kitap bütçesi belirleyin; elinizdeki okunmamış kitapları bitirmeden yeni sipariş vermeyerek raf birikimini önleyin."
    ];
    return eduTips[dayIndex];
  }

  // 13. Kişisel Bakım & Kozmetik & Kuaför & Berber & Güzellik
  if (
    norm.includes("kişisel") ||
    norm.includes("kisisel") ||
    norm.includes("kozmetik") ||
    norm.includes("kuaför") ||
    norm.includes("kuafor") ||
    norm.includes("berber") ||
    norm.includes("güzellik") ||
    norm.includes("guzellik") ||
    norm.includes("parfüm") ||
    norm.includes("parfum") ||
    norm.includes("cilt") ||
    icon === "💇" ||
    icon === "💄" ||
    icon === "🧴" ||
    icon === "✂️"
  ) {
    const groomingTips = [
      "📅 Pazar Temel Rutin: Cilt bakımında onlarca pahalı ürün yerine 3 temel adıma odaklanın: Nazik temizleyici, iyi bir nemlendirici ve güneş kremi.",
      "📅 Pazartesi Evde Bakım: Kuaför/berber randevularınızı düzenli aralıklara oturtun ve fön/manikür gibi basit işlemleri pratik ev bakım cihazlarıyla kendiniz yapın.",
      "📅 Salı Tester Denemesi: Parfüm ve kozmetikte deneme boyunu test etmeden büyük boy almayın; teninize uymayan ürünlerin çöpe gitmesini engelleyin.",
      "📅 Çarşamba Bıçak Kurutma: Tıraş bıçağı ve kişisel bakım başlıklarını kurutarak saklayın; paslanıp körelmesini önleyerek bıçak ömrünü 3 katına çıkarın.",
      "📅 Perşembe Dip Ürün Tasarrufu: Kozmetik tüplerini keserek dipte kalan en az 1-2 haftalık ürünü kullanın; paranızın çöpe gitmesini önleyin.",
      "📅 Cuma Paket Seans Pazarlığı: Güzellik ve kuaför salonlarının dönemsel seans paketlerini nakit pazarlık avantajıyla bağlayarak tekil ücretlerden tasarruf edin.",
      "📅 Hafta Sonu Doğal Maskeler: Doğal saç ve cilt maskelerini (zeytinyağı, kil, maden suyu) evde hazırlayın; pahalı kimyasal serumlara alternatif oluşturun."
    ];
    return groomingTips[dayIndex];
  }

  // 14. Evcil Hayvan & Veteriner & Mama & Kedi & Köpek
  if (
    norm.includes("evcil") ||
    norm.includes("kedi") ||
    norm.includes("köpek") ||
    norm.includes("kopek") ||
    norm.includes("mama") ||
    norm.includes("veteriner") ||
    norm.includes("pet") ||
    norm.includes("kuş") ||
    norm.includes("kus") ||
    icon === "🐾" ||
    icon === "🐱" ||
    icon === "🐶" ||
    icon === "🦜"
  ) {
    const petTips = [
      "📅 Pazar Büyük Boy Mama Çuvalı: Kuru mamaları küçük paketler yerine 10-15 kg'lık büyük boy çuvallarda hava almayan kaplarla alın; birim fiyatı %35 düşürün.",
      "📅 Pazartesi Zamanında Aşı: Veteriner aşı ve parazit takvimini aksatmayın; zamanında yapılan aşılar ileride ağır tedavi faturalarını önler.",
      "📅 Salı Ev Yapımı Oyuncaklar: Pahalı pet oyuncakları yerine karton kutular, ipler ve kumaş parçalarıyla evde yaratıcı zeka oyuncakları tasarlayın.",
      "📅 Çarşamba Kedi Kumu Tasarrufu: Kedi kumunu temizlerken sadece topaklanan kısımları alın ve kumu derin doldurun; kabın dibine yapışmasını önleyin.",
      "📅 Perşembe Evde Pet Bakımı: Evcil hayvanınızın tırnak kesimi, tarama ve kulak temizliği gibi temel bakımlarını evde kendiniz yaparak pet kuaför masraflarını azaltın.",
      "📅 Cuma Online Toptan Alım: Petshoplar yerine veteriner hekim onaylı online distribütör sitelerinden kampanyalı mama ve vitamin siparişi verin.",
      "📅 Hafta Sonu Porsiyon Kontrolü: Evcil hayvanınızın kilosunu kontrol altında tutun; aşırı besleme obeziteye ve kronik eklem/böbrek tedavilerine yol açar."
    ];
    return petTips[dayIndex];
  }

  // 15. Teknoloji & Elektronik & Telefon & Bilgisayar & Donanım
  if (
    norm.includes("teknoloji") ||
    norm.includes("elektronik") ||
    norm.includes("bilgisayar") ||
    norm.includes("cihaz") ||
    norm.includes("yazılım") ||
    norm.includes("yazilim") ||
    norm.includes("donanım") ||
    norm.includes("tablet") ||
    icon === "💻" ||
    icon === "🖥️" ||
    icon === "🎧"
  ) {
    const techTips = [
      "📅 Pazar Batarya Yenileme: Yeni telefon almadan önce mevcut cihazınızı sıfırlayıp bataryasını yenilemeyi deneyin; yüksek cihaz masrafını 2 yıl erteleyin.",
      "📅 Pazartesi Kılıf & Cam Koruması: Cihazlarınızı kaliteli kılıf ve ekran koruyucu camla koruyun; tek bir düşmeyle oluşabilecek ekran değişim masrafını önleyin.",
      "📅 Salı Kablo Ömrünü Uzatma: Kablo ve şarj aletlerini bükmeden düzgün sararak kullanın; orijinal şarj aletlerinin ömrünü uzatarak aksesuar masrafını kesin.",
      "📅 Çarşamba Yenilenmiş Cihazlar: Elektronik alışverişlerinde '12 Ay Garantili Yenilenmiş' cihaz alternatiflerini değerlendirin; sıfır fiyatına göre %30-40 tasarruf edin.",
      "📅 Perşembe Eski Cihaz Takası: Çekmecede bekleyen eski telefon veya tabletleri teknoloji marketlerin takas kampanyalarında nakit indirime çevirin.",
      "📅 Cuma Bulut Alanı Temizliği: Bulut depolama kotalarınızı temizleyin; gereksiz video ve çift fotoğrafları silerek üst ücretli pakete geçmekten kaçının.",
      "📅 Hafta Sonu Açık Kaynak Yazılımlar: Açık kaynak kodlu ve ücretsiz yazılımları (LibreOffice, GIMP vb.) tercih edin; pahalı yazılım lisanslarından tasarruf edin."
    ];
    return techTips[dayIndex];
  }

  // 16. Borç & Kredi & Taksit & Finansman & Faiz
  if (
    norm.includes("borç") ||
    norm.includes("borc") ||
    norm.includes("kredi") ||
    norm.includes("taksit") ||
    norm.includes("faiz") ||
    norm.includes("kart") ||
    icon === "💳" ||
    icon === "🪙"
  ) {
    const debtTips = [
      "📅 Pazar Ekstre Kapatma Disiplini: Kredi kartı ekstrelerinin asgari tutarını değil, her zaman 'Dönem Borcunun Tamamını' ödeyin; bileşik faiz sarmalına yakalanmayın.",
      "📅 Pazartesi Çığ Yöntemi: Borç kapatırken en yüksek faizli borcu önce kapatma (Çığ Yöntemi) uygulayarak bankaya ödeyeceğiniz toplam faizi minimize edin.",
      "📅 Salı Kart Sayısını Sadeleştirme: Kredi kartı sayınızı maksimum 1-2 karta düşürün; çok kart çok harcama dürtüsü ve mükerrer kart aidatı demektir.",
      "📅 Çarşamba Kart Aidatı İadesi: Bankanızın kestiği yıllık Kredi Kartı Aidatına hemen itiraz edin; müşteri hizmetlerini arayarak veya Hakem Heyetiyle iadesini isteyin.",
      "📅 Perşembe Taksit Güvenlik Eşiği: Taksitli harcamalarda aylık taksit toplamınızın aylık net gelirinizin %20'sini aşmamasına özen gösterin.",
      "📅 Cuma KMH / Ek Hesap Kapatma: Günlük yüksek faiz işleten KMH (Esnek Hesap) borçlarını maaş yatar yatmaz ilk sırada sıfırlayın.",
      "📅 Hafta Sonu Borç Birleştirme: Farklı bankalardaki dağınık borçlarınızı tek bir düşük faizli 'Borç Kapatma Kredisi' altında toplayarak faiz yükünü hafifletin."
    ];
    return debtTips[dayIndex];
  }

  // 17. Hediye & Bağış & Özel Gün & Kutlama & Düğün
  if (
    norm.includes("hediye") ||
    norm.includes("bağış") ||
    norm.includes("bagis") ||
    norm.includes("yardım") ||
    norm.includes("yardim") ||
    norm.includes("düğün") ||
    norm.includes("dugun") ||
    norm.includes("kutlama") ||
    icon === "🎁" ||
    icon === "🎉" ||
    icon === "💐"
  ) {
    const giftTips = [
      "📅 Pazar Özel Günler Fonu: Yıl içindeki doğum günleri ve yıldönümleri için kenara her ay cüzi bir fon ayırın; şok bütçe açıklarının önüne geçin.",
      "📅 Pazartesi Anlamlı Deneyimler: Sevdiklerinize pahalı eşyalar yerine el yapımı bir hatıra, dijital albüm veya birlikte vakit geçireceğiniz deneyimler hediye edin.",
      "📅 Salı Ortak Hediye Bölüşümü: Arkadaş grubu hediye alımlarında bütçeyi kişi sayısına bölüşerek tek başınıza yükleneceğiniz finansal baskıyı hafifletin.",
      "📅 Çarşamba Erken Altın/Hediye Alımı: Düğün ve nişan hediyeliklerini piyasa dalgalanmalarını izleyerek sakin dönemlerde önceden hazır edin.",
      "📅 Perşembe Son Dakika Tuzağı: Özel gün hediyelerini son güne bırakmayın; telaşla yapılan alışverişler kıyaslama fırsatı vermez ve %40 pahalıya mal olur.",
      "📅 Cuma Rustik Paketleme: Pahalı ambalajlar yerine kraft kağıtlar ve jüt iplerle evde şık ve samimi rustik paketler hazırlayın.",
      "📅 Hafta Sonu Planlı Sosyal Yardım: Bağış ve sosyal yardımlarınızı düzenli ve bütçenizin belirli bir yüzdesi (%1-3) olarak planlayarak bütçe dengenizi koruyun."
    ];
    return giftTips[dayIndex];
  }

  // 18. Spor & Fitness & Salon & Antrenman & Sağlıklı Yaşam
  if (
    norm.includes("spor") ||
    norm.includes("fitness") ||
    norm.includes("salon") ||
    norm.includes("antrenman") ||
    norm.includes("yüzme") ||
    norm.includes("yuzme") ||
    norm.includes("pilates") ||
    norm.includes("supplement") ||
    icon === "🏋️" ||
    icon === "⚽" ||
    icon === "🏃"
  ) {
    const sportTips = [
      "📅 Pazar Üyelik Devamlılığı: Spor salonuna yazılmadan önce en az 1 ay evde/açık havada düzenli yürüyüş ve egzersiz yaparak devamlılık disiplininizi test edin.",
      "📅 Pazartesi Belediye Tesisleri: Belediyelerin ücretsiz veya cüzi ücretli yüzme havuzları, spor salonları ve açık hava fitness parkurlarını değerlendirin.",
      "📅 Salı Doğal Protein: Pahalı supplement ve tozlar yerine yumurta, lor peyniri ve bakliyat gibi doğal zengin protein kaynaklarını tercih edin.",
      "📅 Çarşamba İkinci El Spor Ekipmanı: Dambıl, mat veya direnç bantlarını sıfır almak yerine ikinci el platformlarından yarı fiyatına temin edin.",
      "📅 Perşembe Yıllık Üyelik Riskini Önleme: Salon üyeliğini peşin 1 yıllık almak yerine aylık/3 aylık paketlerle başlayın; gitmediğiniz ayların parasını yakmayın.",
      "📅 Cuma Ücretsiz Egzersiz Kanalları: Pahalı özel dersler yerine YouTube ve mobil uygulamalardaki profesyonel antrenör programlarını takip edin.",
      "📅 Hafta Sonu Açık Hava Antrenmanı: Hafta sonları kapalı salonlar yerine sahil veya orman parkurlarında tempolu koşu yaparak sıfır masrafla zinde kalın."
    ];
    return sportTips[dayIndex];
  }

  // 19. Tadilat & Tamirat & Dekorasyon & Mobilya & Boya
  if (
    norm.includes("tadilat") ||
    norm.includes("tamirat") ||
    norm.includes("mobilya") ||
    norm.includes("boya") ||
    norm.includes("usta") ||
    norm.includes("hırdavat") ||
    norm.includes("hirdavat") ||
    norm.includes("dekorasyon") ||
    icon === "🔨" ||
    icon === "🛋️" ||
    icon === "🪑"
  ) {
    const repairTips = [
      "📅 Pazar Kendin Yap (DIY): Küçük tamiratlarda (musluk contası, kulp değişimi, priz) YouTube rehber videolarını izleyerek kendiniz yapın; usta masrafından tasarruf edin.",
      "📅 Pazartesi En Az 3 Usta Teklifi: Büyük tadilatlarda mutlaka en az 3 farklı ustadan malzeme dahil ve hariç ayrı ayrı yazılı fiyat teklifi alın.",
      "📅 Salı Mobilya Yenileme: Eski ahşap mobilyaları atmak yerine zımparalayıp akrilik boyayla boyayarak sıfır mobilya masrafının onda birine yenileyin.",
      "📅 Çarşamba Toptan Malzeme Alımı: Boya, fırça ve hırdavat malzemelerini yapı marketler yerine sanayi toptancılarından %30 indirimli temin edin.",
      "📅 Perşembe Sezon Dışı Tadilat: Ev boyama ve tadilat işlerini yaz ayları yerine kış başında yaptırarak usta işçilik maliyetlerinde pazarlık avantajı yakalayın.",
      "📅 Cuma Kaliteli Sarf Malzemesi: Su tesisatı ve elektrik aksamında kaliteli malzeme kullanın; ucuz malzemenin ileride yaratacağı su baskını risklerini önleyin.",
      "📅 Hafta Sonu Parça Parça Yenileme: Tüm evi aynı anda tadilata sokmak yerine öncelikli odadan başlayıp bütçeniz elverdikçe kademeli ilerleyin."
    ];
    return repairTips[dayIndex];
  }

  // 20. Çocuk & Bebek & Bez & Oyuncak & Kreş
  if (
    norm.includes("çocuk") ||
    norm.includes("cocuk") ||
    norm.includes("bebek") ||
    norm.includes("bez") ||
    norm.includes("oyuncak") ||
    norm.includes("kreş") ||
    norm.includes("kres") ||
    icon === "👶" ||
    icon === "🧸"
  ) {
    const babyTips = [
      "📅 Pazar Toptan Bez Kampanyaları: Bebek bezi ve ıslak mendilleri aylık dev paketler halinde online indirim günlerinde toplu sipariş verin.",
      "📅 Pazartesi Hızlı Büyüyen Giysiler: Bebekler çok hızlı büyüdüğü için pahalı marka kıyafetler yerine pamuklu uygun fiyatlı ürünler ve aile içi kıyafet takasını tercih edin.",
      "📅 Salı Oyuncak Rotasyonu: Sürekli yeni oyuncak almak yerine mevcut oyuncakların yarısını saklayıp ayda bir değiştirerek çocuğun ilgisini canlı tutun.",
      "📅 Çarşamba İkinci El Bebek Arabası: Bebek arabası, beşik ve mama sandalyesi gibi kısa süre kullanılan eşyaları temiz ikinci el alarak binlerce lira tasarruf edin.",
      "📅 Perşembe Ev Yapımı Bebek Mamaları: Hazır kavanoz mamalar yerine mevsim sebze ve meyveleriyle evde taze püreler hazırlayın; hem sağlıklı hem çok ekonomiktir.",
      "📅 Cuma Eğitici Kartlar & Kitaplar: Pahalı elektronik oyuncaklar yerine evde hazırlayabileceğiniz duyusal oyunlar ve kütüphaneden ödünç alacağınız masal kitaplarını seçin.",
      "📅 Hafta Sonu İhtiyaç Analizi: Bebeğin sonraki ayki beden ve gereksinimlerini önceden listeleyerek plansız market alışverişlerinin önüne geçin."
    ];
    return babyTips[dayIndex];
  }

  // 21. Temizlik & Hijyen & Deterjan
  if (
    norm.includes("temizlik") ||
    norm.includes("deterjan") ||
    norm.includes("çamaşır") ||
    norm.includes("camasir") ||
    norm.includes("bulaşık") ||
    norm.includes("bulasik") ||
    norm.includes("hijyen") ||
    icon === "🧼" ||
    icon === "🧹"
  ) {
    const cleanTips = [
      "📅 Pazar Konsantre Ürünler: Temizlik deterjanlarında konsantre ve büyük boy ambalajları tercih edin; dozaj kapağı kullanarak fazla ürün kullanımını engelleyin.",
      "📅 Pazartesi Doğal Temizleyiciler: Kireç ve yüzey temizliğinde beyaz sirke ve karbonat gibi doğal çözümleri kullanın; hem cüzdanınızı hem sağlığınızı koruyun.",
      "📅 Salı Mikrofiber Bez Avantajı: Kaliteli mikrofiber bezler sadece suyla bile mükemmel temizlik sağlar; kimyasal sprey harcamalarınızı yarı yarıya azaltır.",
      "📅 Çarşamba Bulaşık Makinesi Doluluğu: Bulaşık makinesini tam doldurmadan çalıştırmayın ve kısa eko programları tercih edin.",
      "📅 Perşembe Toptan Temizlik Alımı: Yıllık deterjan ve tuvalet kağıdı ihtiyacınızı toptan indirim dönemlerinde karşılayarak enflasyondan korunun.",
      "📅 Cuma Dozaj Aşımı Önlemi: Çamaşır deterjanını fazla koymak çamaşırı daha temiz yapmaz, kumaşı yıpratır ve ek durulama suyu harcatır.",
      "📅 Hafta Sonu Düzenli Bakım: Çamaşır ve bulaşık makinelerinin filtrelerini ayda bir temizleyerek cihazın ömrünü uzatın ve arıza masraflarını önleyin."
    ];
    return cleanTips[dayIndex];
  }

  // 22. Gelişmiş 7 Günlük Dinamik Fallback Algoritması (Tüm özel kategoriler için)
  const customCategoryDailyTips = [
    `📅 Pazar Bütçe Değerlendirmesi: "${name}" kategorisinde bu hafta yaptığınız harcamaları gözden geçirin. Önümüzdeki 7 gün için kendinize net bir harcama tavanı belirleyin.`,
    `📅 Pazartesi Nakit Zarf Yöntemi: "${name}" harcamalarında haftalık nakit zarf yöntemi uygulayın. Bu kategori için ayırdığınız bütçeyi haftalık parçalara bölerek takip edin.`,
    `📅 Salı 48 Saat Kuralı: "${name}" için harcama yapmadan önce 'Acil İhtiyaç mı, Anlık İstek mi?' sorusunu sorun. 48 saat erteleme kuralıyla dürtüsel harcamaları önleyin.`,
    `📅 Çarşamba Fiyat Karşılaştırması: "${name}" kaleminde en çok harcadığınız 3 ürünü belirleyin. Alternatif satıcılar, toptan alım veya kampanyalarla birim maliyeti düşürün.`,
    `📅 Perşembe Nakit İade & Fırsatlar: "${name}" ödemelerinde bankaların ve sadakat kartlarının nakit iade (cashback) ve puan kampanyalarını kontrol edin.`,
    `📅 Cuma Gider Eşleme Kuralı: "${name}" kategorisindeki her keyfi harcamanız kadar tutarı anında acil durum veya vadeli birikim fonunuza aktararak birikiminizi katlayın.`,
    `📅 Hafta Sonu 50/30/20 Dengesi: "${name}" harcamalarınızın genel aylık bütçenizdeki payını kontrol edin; esnek harcamaların toplam gelirinizin %30'unu aşmamasına özen gösterin.`
  ];

  return customCategoryDailyTips[dayIndex];
};

export const ExpensesList: React.FC<ExpensesListProps> = ({
  expenses,
  expenseCategories,
  onSaveExpense,
  onDeleteExpense,
  onSaveCategory,
  onDeleteCategory,
  onUpdateAllCategories,
  netBalance,
  isPremium = false,
  onUpgradeClick,
  language = "tr",
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const { format, currencySymbol } = useCurrency();
  
  // Selected Month filter state (defaults to current year & month, e.g. "2026-05")
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(() => {
    if (selectedMonth !== undefined && selectedYear !== undefined && selectedMonth !== null && selectedYear !== null) {
      return `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Sync state if parent props change
  useEffect(() => {
    if (selectedMonth !== undefined && selectedYear !== undefined) {
      if (selectedMonth === null || selectedYear === null) {
        setSelectedMonthStr("all");
      } else {
        setSelectedMonthStr(`${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`);
      }
    }
  }, [selectedMonth, selectedYear]);

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    if (selectedMonthStr === "all") {
      const now = new Date();
      const curVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      setSelectedMonthStr(curVal);
      if (setSelectedMonth && setSelectedYear) {
        setSelectedMonth(now.getMonth());
        setSelectedYear(now.getFullYear());
      }
      return;
    }
    const parts = selectedMonthStr.split("-");
    if (parts.length === 2) {
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      const newVal = `${y}-${String(m).padStart(2, "0")}`;
      setSelectedMonthStr(newVal);
      if (setSelectedMonth && setSelectedYear) {
        setSelectedMonth(m - 1);
        setSelectedYear(y);
      }
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthStr === "all") {
      const now = new Date();
      const curVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      setSelectedMonthStr(curVal);
      if (setSelectedMonth && setSelectedYear) {
        setSelectedMonth(now.getMonth());
        setSelectedYear(now.getFullYear());
      }
      return;
    }
    const parts = selectedMonthStr.split("-");
    if (parts.length === 2) {
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
      const newVal = `${y}-${String(m).padStart(2, "0")}`;
      setSelectedMonthStr(newVal);
      if (setSelectedMonth && setSelectedYear) {
        setSelectedMonth(m - 1);
        setSelectedYear(y);
      }
    }
  };

  const handleGoToCurrentMonth = () => {
    const now = new Date();
    const curVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonthStr(curVal);
    if (setSelectedMonth && setSelectedYear) {
      setSelectedMonth(now.getMonth());
      setSelectedYear(now.getFullYear());
    }
  };

  // Saving Advice / Tip Popover State
  const [showTipCategory, setShowTipCategory] =
    useState<ExpenseCategory | null>(null);

  // Expense Dialog states
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [expModalTitle, setExpModalTitle] = useState("Gider Ekle");

  useEffect(() => {
    if (localStorage.getItem("auto_open_add_expense") === "true") {
      localStorage.removeItem("auto_open_add_expense");
      handleOpenAddExpense();
    }
  }, []);
  const [expenseId, setExpenseId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number>(1);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [expenseAlarm, setExpenseAlarm] = useState(false);
  const [isCategoryManuallySelected, setIsCategoryManuallySelected] = useState(false);

  // Auto-categorization based on description input
  useEffect(() => {
    if (!isCategoryManuallySelected && description.trim()) {
      const suggested = getSuggestedCategory(description, expenseCategories);
      if (suggested) {
        setCategoryId(suggested.id);
      }
    }
  }, [description, isCategoryManuallySelected, expenseCategories]);

  // AI OCR scanner state and callback
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const handleScanCompleted = (result: any) => {
    setAmount(result.amount.toString());
    setDescription(result.title);
    if (result.date) {
      setDate(result.date);
    }
    // Fuzzy match suggested category
    if (result.categorySuggestion) {
      const suggested = result.categorySuggestion.toLowerCase();
      const match = expenseCategories.find(
        (c) =>
          c.name.toLowerCase().includes(suggested) ||
          suggested.includes(c.name.toLowerCase())
      );
      if (match) {
        setCategoryId(match.id);
        setIsCategoryManuallySelected(true);
      }
    }
    setIsScannerOpen(false);
    setIsExpModalOpen(true);
  };

  // Category Dialog states
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catModalTitle, setCatModalTitle] = useState("Kategori Ekle");
  const [expenseCategoryId, setExpenseCategoryId] = useState<
    number | undefined
  >(undefined);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#6366f1");
  const [categoryIcon, setCategoryIcon] = useState("🛒");
  const [isInlineEditingCategory, setIsInlineEditingCategory] = useState(false);
  const [selectedFilterCategoryId, setSelectedFilterCategoryId] = useState<
    number | null
  >(null);

  // Track newly added expense IDs for slide-in and glow animation
  const [prevExpenseIds, setPrevExpenseIds] = useState<number[]>([]);
  const [newlyAddedIds, setNewlyAddedIds] = useState<number[]>([]);

  useEffect(() => {
    const currentIds = expenses.map((e) => e.id);
    if (prevExpenseIds.length > 0) {
      const newIds = currentIds.filter((id) => !prevExpenseIds.includes(id));
      if (newIds.length > 0) {
        setNewlyAddedIds((prev) => [...prev, ...newIds]);
        // Remove from list after 4 seconds to stop the premium glow highlights
        const timer = setTimeout(() => {
          setNewlyAddedIds((prev) => prev.filter((id) => !newIds.includes(id)));
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
    setPrevExpenseIds(currentIds);
  }, [expenses]);

  const handleOpenAddExpense = () => {
    setExpModalTitle("Gider Ekle");
    setExpenseId(undefined);
    if (expenseCategories.length > 0) setCategoryId(expenseCategories[0].id);
    setAmount("");
    setDescription("");
    setIsCatDropdownOpen(false);
    setIsCategoryManuallySelected(false);
    
    // Choose dynamic smart default date for past/future monthly addition support
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    if (selectedMonthStr === "all" || selectedMonthStr === currentMonthKey) {
      setDate(today.toISOString().slice(0, 10));
    } else {
      setDate(`${selectedMonthStr}-01`);
    }
    
    setIsExpModalOpen(true);
  };

  const handleOpenEditExpense = (e: Expense) => {
    setExpModalTitle("Gider Düzenle");
    setExpenseId(e.id);
    setCategoryId(e.categoryId);
    setAmount(e.amount.toString());
    setDescription(e.description);
    setDate(
      e.date ? e.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    );
    setIsCatDropdownOpen(false);
    setIsCategoryManuallySelected(true);
    setIsExpModalOpen(true);
  };

  const handleSaveExpense = () => {
    const parsedAmount = parseFloat(amount);
    if (!categoryId) {
      alert("Lütfen önce bir kategori seçin.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Lütfen sıfırdan büyük geçerli bir harcama tutarı girin.");
      return;
    }

    onSaveExpense({
      id: expenseId,
      categoryId,
      amount: parsedAmount,
      description: description.trim(),
      date: date || new Date().toISOString(),
    });
    setIsExpModalOpen(false);
  };

  const handleOpenAddCategory = () => {
    setCatModalTitle("Fatura/Harcama Kategorisi Ekle");
    setExpenseCategoryId(undefined);
    setCategoryName("");
    setCategoryColor("#6366f1");
    setCategoryIcon("🛒");
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (c: ExpenseCategory) => {
    setCatModalTitle("Kategori Düzenle");
    setExpenseCategoryId(c.id);
    setCategoryName(c.name);
    setCategoryColor(c.color || "#6366f1");
    setCategoryIcon(c.icon || "🛒");
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryName.trim()) {
      alert("Kategori ismi boş bırakılamaz.");
      return;
    }
    onSaveCategory({
      id: expenseCategoryId,
      name: categoryName.trim(),
      color: categoryColor,
      icon: categoryIcon,
    });
    setIsCatModalOpen(false);
  };

  const handleRandomizeColors = () => {
    try {
      if (!onUpdateAllCategories) {
        console.warn(
          "onUpdateAllCategories prop is missing in ExpensesList! Fallback to local array alert.",
        );
        return;
      }
      const palette = [
        "#ef4444",
        "#f97316",
        "#f59e0b",
        "#10b981",
        "#059669",
        "#14b8a6",
        "#06b6d4",
        "#0ea5e9",
        "#3b82f6",
        "#6366f1",
        "#8b5cf6",
        "#a855f7",
        "#d946ef",
        "#ec4899",
        "#f43f5e",
        "#84cc16",
        "#0284c7",
        "#4f46e5",
        "#b91c1c",
        "#0d9488",
      ];
      const sourceCats = expenseCategories || [];
      // Shuffle helper to assign unique colors safely
      const shuffled = [...palette].sort(() => 0.5 - Math.random());
      const randomized = sourceCats.map((c, idx) => ({
        ...c,
        color: shuffled[idx % shuffled.length],
      }));
      onUpdateAllCategories(randomized);
    } catch (err) {
      console.error("Failed to randomize colors:", err);
    }
  };

  // Drag and drop states for category badges
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: any, index: number) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleDragOver = (e: any, index: number) => {
    if (e.preventDefault) {
      e.preventDefault();
    }
    setDragOverIndex(index);
  };

  const handleDrop = (e: any, targetIndex: number) => {
    if (e.preventDefault) {
      e.preventDefault();
    }
    if (
      draggedIndex === null ||
      draggedIndex === targetIndex ||
      !onUpdateAllCategories
    )
      return;

    const reorderedCategories = [...expenseCategories];
    const [removed] = reorderedCategories.splice(draggedIndex, 1);
    reorderedCategories.splice(targetIndex, 0, removed);

    onUpdateAllCategories(reorderedCategories);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Helper to extract YYYY-MM safely from any date string without timezone offsets
  const getExpenseYearMonth = (dateStr: string): string => {
    if (!dateStr) return "";
    if (/^\d{4}-\d{2}/.test(dateStr)) {
      return dateStr.slice(0, 7);
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    } catch {
      return "";
    }
  };

  // Dynamically filter expenses according to the selected month (e.g. YYYY-MM)
  const filteredMonthExpenses = expenses.filter((e) => {
    if (selectedMonthStr === "all") return true;
    if (!e.date) return false;
    return getExpenseYearMonth(e.date) === selectedMonthStr;
  });

  const totalExpenses = filteredMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // Grouping category totals for the visual stats of the selected month
  const categoryTotals: Record<number, number> = {};
  expenseCategories.forEach((cat) => (categoryTotals[cat.id] = 0));
  filteredMonthExpenses.forEach((e) => {
    if (categoryTotals[e.categoryId] !== undefined) {
      categoryTotals[e.categoryId] += e.amount;
    } else {
      categoryTotals[e.categoryId] = e.amount;
    }
  });

  const colors = [
    "#ef4444",
    "#f59e0b",
    "#3b82f6",
    "#10b981",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#6366f1",
  ];
  const doughnutData = expenseCategories
    .map((c, idx) => ({
      label: c.name,
      value: categoryTotals[c.id] || 0,
      color: c.color || colors[idx % colors.length],
    }))
    .filter((item) => item.value > 0);

  // Giderlerin aylara göre nasıl değiştiğini gösteren son 6 aylık çubuk grafik verisi
  const last6MonthsData: { label: string; value: number; color: string }[] = [];
  const currentDate = new Date();
  const monthsList = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - i,
      1,
    );
    const targetYearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthIndex = d.getMonth();

    const monthlySum = expenses
      .filter((e) => getExpenseYearMonth(e.date) === targetYearMonth)
      .reduce((sum, item) => sum + item.amount, 0);

    last6MonthsData.push({
      label: `${monthsList[monthIndex]} ${d.getFullYear()}`,
      value: monthlySum,
      color: "#ec4899", // Pembe/rose renk tonu
    });
  }

  const currentYear = currentDate.getFullYear();
  const currentMonthIndex = currentDate.getMonth();

  const categoryCurrentMonthTotals: Record<number, number> = {};
  expenseCategories.forEach((cat) => {
    categoryCurrentMonthTotals[cat.id] = categoryTotals[cat.id] || 0;
  });

  // Calculate current month's overall expenses total and load budget goal from local storage
  const currentMonthExpensesTotal = filteredMonthExpenses.reduce((sum, item) => sum + item.amount, 0);

  const budgetGoal = (() => {
    const email = localStorage.getItem("currentUser") || "anonymous";
    const saved = localStorage.getItem(`budget_goal_${email}`);
    return saved ? parseFloat(saved) : 10000;
  })();

  const selectedFilterCategory = expenseCategories.find(
    (c) => c.id === selectedFilterCategoryId,
  );
  const selectedCategoryTotal = selectedFilterCategoryId
    ? filteredMonthExpenses
        .filter((e) => e.categoryId === selectedFilterCategoryId)
        .reduce((sum, e) => sum + e.amount, 0)
    : totalExpenses;

  const selectedCategoryCount = selectedFilterCategoryId
    ? filteredMonthExpenses.filter((e) => e.categoryId === selectedFilterCategoryId).length
    : filteredMonthExpenses.length;

  const percentageOfTotal =
    totalExpenses > 0
      ? ((selectedCategoryTotal / totalExpenses) * 100).toFixed(1)
      : "0.0";

  const filteredExpenses = selectedFilterCategoryId
    ? filteredMonthExpenses.filter((e) => e.categoryId === selectedFilterCategoryId)
    : filteredMonthExpenses;

  const suggestedCategory = getSuggestedCategory(description, expenseCategories);

  return (
    <div className="space-y-6">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <ShoppingCart className="w-7 h-7 text-rose-500 animate-pulse" /> HARCAMA GİDERLERİ
        </motion.h2>
        <div className="w-16 h-1 bg-rose-500 rounded-full mt-2 opacity-80" />
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-col gap-3 justify-center sm:flex-row sm:items-center">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAddCategory}
            className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <Folder className="w-4 h-4 text-slate-400" /> Kategori Ekle
          </button>
          <button
            onClick={() => {
              if (!isPremium) {
                onUpgradeClick?.();
              } else {
                setIsScannerOpen(true);
              }
            }}
            className="px-3.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
          >
            <Camera className="w-4 h-4" /> AI ile Fiş Tara {!isPremium && <span className="text-[8px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black">PRO</span>}
          </button>
          <button
            onClick={handleOpenAddExpense}
            className="px-3.5 py-1.5 bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Gider Ekle
          </button>
        </div>
      </div>

      {/* Month Selection Bar with Prev/Next Arrow Buttons (Kompakt ve Şık) */}
      <div className="py-2 px-2.5 sm:py-2.5 sm:px-3.5 bg-gradient-to-r from-rose-100 via-pink-100/90 to-red-100 dark:from-slate-900/95 dark:via-rose-950/40 dark:to-slate-900 rounded-xl border-2 border-rose-400/90 dark:border-rose-700/50 shadow-md shadow-rose-200/50 dark:shadow-black/30 flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2 text-xs transition-all duration-300 relative overflow-hidden backdrop-blur-md mb-3">
        {/* Ambient subtle glow */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-white/25 dark:bg-white/5 rounded-full blur-xl pointer-events-none" />

        {/* Left side: Icon & Title */}
        <div className="flex items-center gap-1.5 sm:gap-2 relative z-10 shrink-0 min-w-0">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-xs shrink-0">
            <Calendar className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div className="min-w-0 shrink-0 flex flex-col justify-center">
            <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase text-rose-800 dark:text-rose-300 block leading-tight tracking-wider whitespace-nowrap">
              FİLTRELENEN DÖNEM
            </span>
            <span className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-[11px] sm:text-[13px] flex items-center gap-1 sm:gap-1.5 whitespace-nowrap leading-tight mt-0.5">
              {selectedMonthStr === "all"
                ? "🔒 TÜM ZAMANLAR"
                : (() => {
                    const [y, m] = selectedMonthStr.split("-");
                    const mIdx = parseInt(m, 10) - 1;
                    return `${monthsList[mIdx] || ""} ${y}`;
                  })()}
              <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            </span>
          </div>
        </div>

        {/* Right side: Controls (Single inline row, never wraps) */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0 relative z-10 justify-end ml-auto">
          {/* Previous Month Arrow */}
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 sm:px-2.5 sm:py-1 border border-rose-300/90 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer text-[10px] font-black transition-all duration-200 shadow-xs flex items-center gap-0.5 shrink-0 hover:bg-rose-200/80 active:scale-95"
            title="Önceki Ay"
          >
            <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">Önceki</span>
          </button>

          {/* Month Selector Dropdown */}
          <select
            value={selectedMonthStr}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedMonthStr(val);
              if (val !== "all" && setSelectedMonth && setSelectedYear) {
                const [y, m] = val.split("-");
                setSelectedMonth(parseInt(m, 10) - 1);
                setSelectedYear(parseInt(y, 10));
              } else if (val === "all" && setSelectedMonth && setSelectedYear) {
                setSelectedMonth(null);
                setSelectedYear(null);
              }
            }}
            className="px-1.5 py-1 bg-white/95 dark:bg-slate-900 border border-rose-300/90 dark:border-slate-700/80 text-[10.5px] text-slate-800 dark:text-white rounded-lg focus:outline-none font-black cursor-pointer transition shrink-0 max-w-[125px] sm:max-w-[155px] truncate shadow-xs"
          >
            <option value="all">📅 Tüm Zamanlar</option>
            {(() => {
              const options: { value: string; label: string }[] = [];
              const now = new Date();
              const startYear = now.getFullYear() - 2;
              const endYear = now.getFullYear() + 1;
              
              for (let y = startYear; y <= endYear; y++) {
                for (let m = 0; m <= 11; m++) {
                  const mStr = String(m + 1).padStart(2, "0");
                  const val = `${y}-${mStr}`;
                  const label = `${monthsList[m]} ${y}`;
                  options.push({ value: val, label });
                }
              }
              
              // Append any extra dates present in actual loaded expenses
              expenses.forEach(e => {
                const ym = getExpenseYearMonth(e.date);
                if (ym && ym.includes("-")) {
                  const [y, m] = ym.split("-");
                  const mIdx = parseInt(m, 10) - 1;
                  if (mIdx >= 0 && mIdx < 12) {
                    const val = `${y}-${m.padStart(2, "0")}`;
                    if (!options.some(opt => opt.value === val)) {
                      options.push({
                        value: val,
                        label: `${monthsList[mIdx]} ${y}`
                      });
                    }
                  }
                }
              });
              
              // Deduplicate and Sort
              const uniqueOptions = options.filter((value, index, self) =>
                index === self.findIndex((t) => t.value === value.value)
              ).sort((a, b) => b.value.localeCompare(a.value));

              return uniqueOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ));
            })()}
          </select>

          {/* Next Month Arrow */}
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 sm:px-2.5 sm:py-1 border border-rose-300/90 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer text-[10px] font-black transition-all duration-200 shadow-xs flex items-center gap-0.5 shrink-0 hover:bg-rose-200/80 active:scale-95"
            title="Sonraki Ay"
          >
            <span className="hidden md:inline">Sonraki</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* Current Month Quick Button */}
          <button
            type="button"
            onClick={handleGoToCurrentMonth}
            className="px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-400/40 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition active:scale-95 cursor-pointer shrink-0 ml-0.5 shadow-xs"
            title="Bu Aya Git"
          >
            BU AY
          </button>
        </div>
      </div>

      {/* Expense Summary Cards matching Dashboard Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 1. TOPLAM GİDER */}
        <motion.div
          whileHover={{ y: -2, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="p-3.5 sm:p-4 bg-gradient-to-br from-rose-500 via-rose-600 to-red-800 dark:from-rose-950 dark:via-rose-900 dark:to-slate-900 border-2 border-rose-400/40 dark:border-rose-500/40 text-white rounded-2xl space-y-1 relative overflow-hidden shadow-lg shadow-rose-500/20 hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px]"
        >
          <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-rose-100 uppercase tracking-wide">
            <ShoppingCart className="w-3 h-3 text-rose-200" />
            <span>TOPLAM GİDER</span>
          </div>
          <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">{format(totalExpenses)}</p>
          <span className="text-[8.5px] font-medium text-rose-100/90 block">
            {selectedMonthStr === "all" ? "Tüm Harcamalar" : "Seçili Dönem Toplamı"}
          </span>
        </motion.div>

        {/* 2. BÜTÇE LİMİTİ VEYA GÜNLÜK ORTALAMA */}
        <motion.div
          whileHover={{ y: -2, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="p-3.5 sm:p-4 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 dark:from-indigo-950 dark:via-indigo-900 dark:to-slate-900 border-2 border-indigo-400/40 dark:border-indigo-500/40 text-white rounded-2xl space-y-1 relative overflow-hidden shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px]"
        >
          <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-wide">
            <BarChart3 className="w-3 h-3 text-indigo-200" />
            <span>{budgetGoal > 0 ? "BÜTÇE HEDEFİ" : "HARCAMA SAYISI"}</span>
          </div>
          <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">
            {budgetGoal > 0 ? format(budgetGoal) : `${filteredExpenses.length} Adet`}
          </p>
          <span className="text-[8.5px] font-medium text-indigo-100/90 block">
            {budgetGoal > 0 ? `Kullanım: %${Math.min(100, Math.round((currentMonthExpensesTotal / budgetGoal) * 100))}` : "Kayıtlı Harcama"}
          </span>
        </motion.div>

        {/* 3. NET BAKİYE / DURUM */}
        <motion.div
          whileHover={{ y: -2, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`p-3.5 sm:p-4 ${
            netBalance !== undefined && netBalance < 0
              ? "bg-gradient-to-br from-red-500 via-red-600 to-rose-800 dark:from-red-950 dark:via-rose-950 dark:to-slate-900 border-2 border-red-400/40 shadow-red-500/20"
              : "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-800 dark:from-blue-950 dark:via-indigo-950 dark:to-slate-900 border-2 border-blue-400/40 shadow-blue-500/20"
          } text-white rounded-2xl space-y-1 relative overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px]`}
        >
          <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-blue-100 uppercase tracking-wide">
            {netBalance !== undefined && netBalance < 0 ? (
              <AlertTriangle className="w-3 h-3 text-white animate-pulse" />
            ) : (
              <TrendingUp className="w-3 h-3 text-blue-200" />
            )}
            <span>NET BAKİYE</span>
          </div>
          <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">
            {netBalance !== undefined ? format(netBalance) : format(0)}
          </p>
          <span className="text-[8.5px] font-medium text-blue-100/90 block">
            {netBalance !== undefined && netBalance < 0 ? "Bütçe Aşımı Riski" : "Gelir - Gider Dengesi"}
          </span>
        </motion.div>

        {/* 4. EN YÜKSEK KATEGORİ VEYA AKTİF KATEGORİ SAYISI */}
        <motion.div
          whileHover={{ y: -2, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="p-3.5 sm:p-4 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 dark:from-amber-950 dark:via-orange-950 dark:to-slate-900 border-2 border-amber-400/40 dark:border-amber-500/40 text-white rounded-2xl space-y-1 relative overflow-hidden shadow-lg shadow-amber-500/20 hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px]"
        >
          <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-amber-100 uppercase tracking-wide">
            <Sparkles className="w-3 h-3 text-amber-200" />
            <span>KATEGORİLER</span>
          </div>
          <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">{expenseCategories.length} Kategori</p>
          <span className="text-[8.5px] font-medium text-amber-100/90 block">
            Kişiselleştirilebilir
          </span>
        </motion.div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Listing */}
        <div className="space-y-4 shadow-sm rounded-2xl lg:col-span-7">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <ClipboardList className="w-4 h-4 text-rose-500" /> HARCAMA
                KAYITLARI
              </h4>
              <select
                value={selectedFilterCategoryId || ""}
                onChange={(e) =>
                  setSelectedFilterCategoryId(
                    e.target.value ? parseInt(e.target.value) : null,
                  )
                }
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1 text-slate-700 dark:text-slate-200 font-semibold outline-none focus:ring-1 focus:ring-rose-500/30 transition-all cursor-pointer max-w-[150px] shadow-sm shrink-0"
              >
                <option value="">Tüm Kategoriler</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon || "🛒"} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Seçili Kategori Toplamı Bilgi Kartı */}
            <motion.div
              layout
              className="p-4 rounded-2xl border transition-all duration-500 overflow-hidden relative shadow-sm"
              style={{
                borderColor: selectedFilterCategory
                  ? `${selectedFilterCategory.color}60`
                  : "rgba(99, 102, 241, 0.45)",
                background: selectedFilterCategory
                  ? `linear-gradient(135deg, ${selectedFilterCategory.color}15, ${selectedFilterCategory.color}25)`
                  : "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(244, 63, 94, 0.12))",
              }}
            >
              {/* Decorative dynamic ambient glow corner */}
              <div
                className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-15 dark:opacity-25 transition-all duration-500 animate-pulse"
                style={{
                  backgroundColor: selectedFilterCategory
                    ? selectedFilterCategory.color
                    : "#6366f1",
                }}
              />

              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="space-y-1">
                  <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase block">
                    SEÇİLİ KATEGORİ TOPLAMI
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedFilterCategory && (
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{
                          backgroundColor: selectedFilterCategory.color,
                        }}
                      />
                    )}
                    <h5 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 transition-all duration-300">
                      {selectedFilterCategory
                        ? `${selectedFilterCategory.icon || "🛒"} ${selectedFilterCategory.name}`
                        : "Tüm Kategoriler"}
                    </h5>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5 pt-0.5">
                    <span>{selectedCategoryCount} işlem kaydı</span>
                    <span>•</span>
                    <span className="font-bold text-rose-500 dark:text-rose-400">
                      Toplamın %{percentageOfTotal}'i
                    </span>
                  </p>
                </div>

                <div className="text-right space-y-0.5 shrink-0">
                  <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 block uppercase">
                    Tutar
                  </span>
                  <motion.div
                    key={selectedCategoryTotal}
                    initial={{ scale: 0.95, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-base sm:text-lg font-black font-mono transition-all duration-300"
                    style={{
                      color: selectedFilterCategory
                        ? selectedFilterCategory.color
                        : "#e11d48",
                    }}
                  >
                    {format(selectedCategoryTotal)}
                  </motion.div>
                </div>
              </div>

              {/* Mini visual indicator bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-700/50 h-1.5 rounded-full mt-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentageOfTotal}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: selectedFilterCategory
                      ? selectedFilterCategory.color
                      : "#e11d48",
                  }}
                />
              </div>
            </motion.div>

            {filteredExpenses.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 font-medium bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl p-4">
                Bu kategoride henüz bir gider harcaması kaydedilmemiş.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {filteredExpenses.map((e, idx) => {
                  const cat = expenseCategories.find(
                    (c) => c.id === e.categoryId,
                  );
                  const theme = getExpenseColorTheme(cat, idx, String(e.id));
                  const isNew = newlyAddedIds.includes(e.id);
                  return (
                    <motion.div
                      key={e.id}
                      layout
                      initial={isNew ? { opacity: 0, y: 30 } : {}}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        isNew
                          ? { duration: 0.5, ease: "easeOut" }
                          : { type: "spring", stiffness: 350, damping: 25 }
                      }
                      whileHover={{ scale: 1.01, y: -2 }}
                      className={`relative overflow-hidden p-4 sm:p-5 bg-gradient-to-br ${theme.cardBg} rounded-3xl border ${theme.cardBorder} shadow-md flex items-center justify-between gap-4 transition-all duration-300 backdrop-blur-md ${
                        isNew
                          ? "ring-2 ring-amber-400 border-amber-300 shadow-[0_0_25px_rgba(244,63,94,0.4)]"
                          : ""
                      }`}
                      style={{
                        borderLeft: cat?.color ? `4px solid ${cat.color}` : undefined,
                      }}
                    >
                      {/* Ambient decoration */}
                      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${theme.ambientGlow} blur-xl pointer-events-none`} />

                      {/* Premium Shimmering Shine Parıltı Effect */}
                      {isNew && (
                        <motion.div
                          initial={{ left: "-100%" }}
                          animate={{ left: "100%" }}
                          transition={{
                            repeat: Infinity,
                            repeatType: "loop",
                            duration: 1.6,
                            ease: "linear",
                          }}
                          className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none transform -skew-x-12"
                        />
                      )}

                      {/* Sub-bar indicator for newly highlighted item */}
                      {isNew && (
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-rose-300 to-amber-400 animate-pulse" />
                      )}

                      <div className="space-y-1.5 relative z-10 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${theme.tagBg} ${theme.tagText} border ${theme.tagBorder} backdrop-blur-xs shrink-0 shadow-xs flex items-center gap-1`}
                            style={cat?.color ? { borderColor: `${cat.color}60` } : undefined}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat?.color || undefined }}
                            />
                            {cat
                              ? `${cat.icon || "🛒"} ${cat.name}`
                              : "Kategorisiz"}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">
                            {e.description || "Harcama açıklaması girmediniz"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1 font-semibold bg-white/70 dark:bg-black/30 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-white/10 w-fit">
                          <Calendar className={`w-3 h-3 ${theme.amountColor}`} />{" "}
                          {new Date(e.date).toLocaleDateString("tr-TR")}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 relative z-10 shrink-0">
                        <span className={`font-black text-base sm:text-lg ${theme.amountColor} font-mono tracking-tight drop-shadow-xs`}>
                          -{format(e.amount)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditExpense(e)}
                            className="p-2 text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/80 dark:text-white/80 dark:hover:text-white dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 rounded-xl transition cursor-pointer backdrop-blur-xs shadow-xs"
                            title="Düzenle"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteExpense(e.id)}
                            className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 dark:text-rose-200 dark:hover:text-white dark:bg-rose-500/20 dark:hover:bg-rose-500/40 dark:border-rose-400/30 rounded-xl transition cursor-pointer backdrop-blur-xs shadow-xs"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Categories Management Panel */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                KATEGORİLERİ DÜZENLE
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRandomizeColors();
                  }}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 text-[10px] font-extrabold rounded-lg border border-rose-200/50 dark:border-rose-900/30 shadow-xs transition-all duration-150 flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                  title="Renk Paletini Rastgele Düzenle"
                >
                  ✨ Renk Paletini Yenile
                </button>
              </div>
            </div>
            <div
              id="expenses-category-list-container"
              className="flex flex-col gap-3 animate-fade-in bg-slate-100/40 dark:bg-slate-900/40 p-3 sm:p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800/60 shadow-inner w-full"
            >
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 select-none">
                <div className="flex items-center gap-3">
                  <span>
                    Tanımlı Kategori Sayısı:{" "}
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                      {expenseCategories.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const config = expenseCategories.map(
                        ({ name, color }) => ({ name, color }),
                      );
                      downloadFileWithCustomName({
                        fileName: "kategori_ayarlari.json",
                        content: JSON.stringify(config, null, 2),
                        mimeType: "application/json"
                      });
                    }}
                    className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all duration-300 flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Kategori konfigürasyonunu (isimler ve renkler) JSON dosyası olarak dışa aktar"
                  >
                    <span>📥 JSON DIŞA AKTAR</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setIsInlineEditingCategory(!isInlineEditingCategory)
                  }
                  className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-medium uppercase transition-all duration-300 flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isInlineEditingCategory
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 animate-pulse"
                      : "bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/25"
                  }`}
                >
                  {isInlineEditingCategory ? (
                    <>
                      <Check className="w-3 h-3" /> Düzenlemeyi Bitir
                    </>
                  ) : (
                    <>
                      <Edit className="w-3 h-3" /> Hızlı Düzenleme Modu
                    </>
                  )}
                </button>
              </div>

              {/* Bütçe Limit Uyarısı (Dikkat Bandı) */}
              {budgetGoal > 0 &&
                currentMonthExpensesTotal >= budgetGoal * 0.9 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-tr from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/25 dark:border-rose-500/15 text-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-xs mb-1 text-left"
                  >
                    <div className="p-2 bg-rose-500/15 rounded-xl text-rose-600 animate-pulse mt-0.5">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-[11px] font-black tracking-wider uppercase font-sans text-rose-700 dark:text-rose-400">
                        🚨 BÜTÇE SINIRI / DİKKAT!
                      </p>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                        Mevcut ayın bütçe hedefinin (
                        <span className="font-mono font-black">
                          {format(budgetGoal)}
                        </span>
                        ){" "}
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                          %90'ını
                        </span>{" "}
                        geçtiniz! Toplam aylık harcama:{" "}
                        <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                          {format(currentMonthExpensesTotal)}
                        </span>{" "}
                        (Hedefe Oranı:{" "}
                        <span className="font-mono font-black">
                          %
                          {(
                            (currentMonthExpensesTotal / budgetGoal) *
                            100
                          ).toFixed(1)}
                        </span>
                        ). Bütçenizi kontrol altında tutmanızı öneririz.
                      </p>
                    </div>
                  </motion.div>
                )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 w-full">
                {expenseCategories.map((c, idx) => {
                  const isDragged = draggedIndex === idx;
                  const isOver = dragOverIndex === idx;
                  const currentMonthTotal = categoryCurrentMonthTotals[c.id] || 0;
                  const isSelected = selectedFilterCategoryId === c.id;

                  const CATEGORY_DAY_THEMES = [
                    {
                      bg: "from-indigo-100/95 via-sky-50/90 to-blue-100/90 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900",
                      border: "border-2 border-indigo-300 dark:border-slate-700/60",
                      glow: "bg-indigo-500/20",
                      badge: "text-indigo-950 bg-white/95 border border-indigo-300 shadow-xs dark:text-indigo-300 dark:bg-slate-900/60 dark:border-white/10"
                    },
                    {
                      bg: "from-emerald-100/95 via-teal-50/90 to-green-100/90 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900",
                      border: "border-2 border-emerald-300 dark:border-slate-700/60",
                      glow: "bg-emerald-500/20",
                      badge: "text-emerald-950 bg-white/95 border border-emerald-300 shadow-xs dark:text-emerald-300 dark:bg-slate-900/60 dark:border-white/10"
                    },
                    {
                      bg: "from-rose-100/95 via-pink-50/90 to-red-100/90 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900",
                      border: "border-2 border-rose-300 dark:border-slate-700/60",
                      glow: "bg-rose-500/20",
                      badge: "text-rose-950 bg-white/95 border border-rose-300 shadow-xs dark:text-rose-300 dark:bg-slate-900/60 dark:border-white/10"
                    },
                    {
                      bg: "from-amber-100/95 via-yellow-50/90 to-orange-100/90 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900",
                      border: "border-2 border-amber-300 dark:border-slate-700/60",
                      glow: "bg-amber-500/20",
                      badge: "text-amber-950 bg-white/95 border border-amber-300 shadow-xs dark:text-amber-300 dark:bg-slate-900/60 dark:border-white/10"
                    },
                    {
                      bg: "from-purple-100/95 via-fuchsia-50/90 to-violet-100/90 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900",
                      border: "border-2 border-purple-300 dark:border-slate-700/60",
                      glow: "bg-purple-500/20",
                      badge: "text-purple-950 bg-white/95 border border-purple-300 shadow-xs dark:text-purple-300 dark:bg-slate-900/60 dark:border-white/10"
                    },
                    {
                      bg: "from-cyan-100/95 via-sky-50/90 to-teal-100/90 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900",
                      border: "border-2 border-cyan-300 dark:border-slate-700/60",
                      glow: "bg-cyan-500/20",
                      badge: "text-cyan-950 bg-white/95 border border-cyan-300 shadow-xs dark:text-cyan-300 dark:bg-slate-900/60 dark:border-white/10"
                    },
                    {
                      bg: "from-teal-100/95 via-emerald-50/90 to-cyan-100/90 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900",
                      border: "border-2 border-teal-300 dark:border-slate-700/60",
                      glow: "bg-teal-500/20",
                      badge: "text-teal-950 bg-white/95 border border-teal-300 shadow-xs dark:text-teal-300 dark:bg-slate-900/60 dark:border-white/10"
                    },
                    {
                      bg: "from-orange-100/95 via-amber-50/90 to-rose-100/90 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900",
                      border: "border-2 border-orange-300 dark:border-slate-700/60",
                      glow: "bg-orange-500/20",
                      badge: "text-orange-950 bg-white/95 border border-orange-300 shadow-xs dark:text-orange-300 dark:bg-slate-900/60 dark:border-white/10"
                    }
                  ];
                  const catTheme = CATEGORY_DAY_THEMES[idx % CATEGORY_DAY_THEMES.length];

                  return (
                    <motion.div
                      key={c.id}
                      layout
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 35,
                      }}
                      draggable={
                        !isInlineEditingCategory && !!onUpdateAllCategories
                      }
                      onDragStart={(e: any) => handleDragStart(e, idx)}
                      onDragOver={(e: any) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e: any) => handleDrop(e, idx)}
                      onDragLeave={() => {
                        if (dragOverIndex === idx) setDragOverIndex(null);
                      }}
                      onClick={() => {
                        if (!isInlineEditingCategory) {
                          setSelectedFilterCategoryId(isSelected ? null : c.id);
                        }
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={isInlineEditingCategory ? {} : { scale: 0.98 }}
                      className={`relative group flex flex-col justify-between gap-2.5 p-3.5 rounded-2xl text-xs font-semibold select-none category-card-animated transition-all duration-300 shadow-md overflow-hidden ${
                        isSelected
                          ? "ring-2 ring-indigo-500 bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl shadow-indigo-500/25"
                          : `bg-gradient-to-br ${catTheme.bg} ${catTheme.border} text-slate-900 dark:text-slate-100 hover:shadow-xl`
                      } ${
                        isInlineEditingCategory
                          ? "ring-2 ring-amber-400/80 inline-editing"
                          : "cursor-pointer"
                      } ${
                        isDragged
                          ? "opacity-30 border-dashed border-indigo-400 bg-indigo-50/10 scale-95"
                          : ""
                      } ${
                        isOver && !isDragged
                          ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-105"
                          : ""
                      }`}
                      style={{
                        borderLeft: `5px solid ${c.color || "#6366f1"}`,
                      }}
                      title={
                        isInlineEditingCategory
                          ? "Kategeri ismini veya rengini doğrudan değiştirin"
                          : "Giderleri filtrelemek için tıklayın | Sürükleyip bırakarak öncelik sırasını değiştirin"
                      }
                    >
                      {/* Animated ambient background decoration in day & dark mode */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/10 pointer-events-none rounded-2xl" />
                      <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${catTheme.glow} blur-xl pointer-events-none animate-pulse`} />

                      {/* Hover Tooltip - Monthly Category Total (only when not inline editing to save space) */}
                      {!isInlineEditingCategory && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-950/95 dark:bg-slate-900/95 text-white text-[10.5px] rounded-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-[100] shadow-2xl border border-indigo-500/15 flex flex-col items-center gap-0.5 animate-fade-in-fast">
                          <span className="text-slate-400 text-[8px] tracking-widest font-black uppercase">
                            Bu Ayın Toplamı
                          </span>
                          <span className="text-emerald-400 font-black text-xs font-mono">
                            {format(currentMonthTotal)}
                          </span>
                          <div className="w-2 h-2 bg-slate-950 dark:bg-slate-900 rotate-45 border-r border-b border-indigo-500/15 -mb-3 mt-1" />
                        </div>
                      )}

                      {isInlineEditingCategory ? (
                        <div
                          className="flex items-center gap-2 w-full relative z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            className="text-sm select-none shrink-0"
                            title="Kategori simgesi"
                          >
                            {c.icon || "🛒"}
                          </span>
                          {/* Premium Custom Inline Color Picker Dot */}
                          <div className="relative w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 overflow-hidden flex items-center justify-center cursor-pointer shadow-sm hover:scale-110 active:scale-95 transition-all">
                            <input
                              type="color"
                              value={c.color || "#6366f1"}
                              onChange={(e) => {
                                onSaveCategory({ ...c, color: e.target.value });
                              }}
                              className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer p-0 m-0 border-0 opacity-100"
                            />
                          </div>
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => {
                              onSaveCategory({ ...c, name: e.target.value });
                            }}
                            className="px-2 py-1 flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                            placeholder="Kategori Adı"
                          />
                          <button
                            onClick={() => onDeleteCategory(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-55 dark:hover:bg-rose-950/20 rounded-lg transition shrink-0"
                            title="Kategoriyi Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Row 1: Left Info & Right Total */}
                          <div className="flex items-center justify-between w-full gap-2 min-w-0 relative z-10">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span
                                className="w-2 h-2 rounded-full inline-block shrink-0 transition-all duration-500 ease-in-out shadow-xs"
                                style={{ backgroundColor: c.color || "#6366f1" }}
                              />
                              <span
                                className="text-sm select-none shrink-0"
                                title={`${c.name} simgesi`}
                              >
                                {c.icon || "🛒"}
                              </span>
                              <span
                                className={`truncate text-xs font-black leading-none ${isSelected ? "text-white" : "text-slate-900 dark:text-slate-100"}`}
                                title={c.name}
                              >
                                {c.name}
                              </span>
                            </div>
                            <span
                              className={`text-[9.5px] px-2 py-0.5 rounded-lg font-mono font-bold transition-all shrink-0 select-none ${
                                isSelected
                                  ? "bg-indigo-600 text-white dark:bg-indigo-500/50"
                                  : catTheme.badge
                              }`}
                              title={`${c.name} bu ayki toplam harcaması`}
                            >
                              {format(currentMonthTotal)}
                            </span>
                          </div>

                          {/* Row 2: Action Toolbar */}
                          <div className="flex items-center justify-end gap-1 w-full border-t border-slate-100/50 dark:border-slate-800/40 pt-1.5 mt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTipCategory(
                                  showTipCategory?.id === c.id ? null : c,
                                );
                              }}
                              className={`px-1.5 py-0.5 rounded-md transition shrink-0 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 ${
                                showTipCategory?.id === c.id
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 scale-105"
                                  : "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              }`}
                              title={`${c.name} için Tasarruf İpucu`}
                            >
                              <Lightbulb className="w-3 h-3 shrink-0" />
                              <span className="text-[8.5px] font-black ml-0.5">İpucu</span>
                            </button>

                            <div className="h-3 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditCategory(c);
                              }}
                              className="px-1.5 py-0.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-md transition shrink-0 flex items-center justify-center gap-0.5"
                              title="Düzenle"
                            >
                              <Edit className="w-3 h-3 shrink-0" />
                              <span className="text-[8.5px] font-bold ml-0.5">Düzenle</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCategory(c.id);
                              }}
                              className="px-1.5 py-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-55 dark:hover:bg-rose-950/20 rounded-md transition shrink-0 flex items-center justify-center gap-0.5"
                              title="Sil"
                            >
                              <Trash2 className="w-3 h-3 shrink-0" />
                              <span className="text-[8.5px] font-bold ml-0.5">Sil</span>
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Selected Category Saving Tip Banner (AI-powered Advice) */}
              {(() => {
                const selectedCat = expenseCategories.find(
                  (c) => c.id === selectedFilterCategoryId,
                );
                if (!selectedCat) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-4 bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/40 dark:border-amber-900/40 rounded-2xl flex items-start gap-3 shadow-xs text-left"
                  >
                    <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400 shrink-0 select-none text-base">
                      💡
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h5 className="text-[11px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                          {selectedCat.icon || "🔑"} {selectedCat.name} Tasarruf
                          İpucu
                        </h5>
                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 text-[8px] font-black tracking-widest rounded-md uppercase">
                          🤖 YAPAY ZEKA TAVSİYESİ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                        {getSavingTipForCategory(
                          selectedCat.name,
                          selectedCat.icon || "🛒",
                        )}
                      </p>
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right Side: Charts */}
        <div className="space-y-6 lg:col-span-5">
          {/* Doughnut Chart */}
          {doughnutData.length > 0 ? (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide text-center">
                Gider Dağılım Grafiği
              </h4>
              <DoughnutChart data={doughnutData} />
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 font-medium bg-slate-50/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              Gider dağılım grafiği için harcama kaydı girilmelidir.
            </div>
          )}

          {/* Monthly Expense Bar Chart */}
          <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-rose-500" /> Aylık Harcama
              Değişim Analizi
            </h4>
            <div className="pt-2">
              <BarChart data={last6MonthsData} />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              * Son 6 aya ait harcamalarınızın aylık toplam değişim trendini
              gösterir.
            </p>
          </div>
        </div>
      </div>

      {/* Expense Add/Edit Modal Dial */}
      {isExpModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99999] overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl my-auto">
            <h4 className="text-base font-bold flex items-center gap-1.5 border-b pb-2 dark:border-slate-700">
              <ShoppingCart className="w-5 h-5 text-rose-500" /> {expModalTitle}
            </h4>

            {/* Quick scanning action */}
            <button
               onClick={() => {
                 if (!isPremium) {
                   onUpgradeClick?.();
                 } else {
                   setIsExpModalOpen(false); // Close to avoid overlay collision
                   setTimeout(() => setIsScannerOpen(true), 150);
                 }
               }}
              className="w-full py-2 sm:py-2.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-dashed border-indigo-500/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse animate-duration-1000" /> Fiş Fotoğrafı ile Otomatik Doldur {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black">PRO</span>}
            </button>

            <div className="space-y-3">
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  KATEGORİ SEÇİN
                </label>
                <button
                  type="button"
                  onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    {(() => {
                      const selectedC = expenseCategories.find(c => c.id === categoryId);
                      return selectedC ? (
                        <>
                          <span className="text-sm">{selectedC.icon || "🛒"}</span>
                          <span>{selectedC.name}</span>
                        </>
                      ) : (
                        "Kategori Seçin"
                      );
                    })()}
                  </span>
                  <span className={`text-[10px] text-slate-400 font-extrabold transition-transform duration-200 ${isCatDropdownOpen ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {isCatDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsCatDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 divide-y divide-slate-100 dark:divide-slate-700/50">
                      {expenseCategories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCategoryId(c.id);
                            setIsCategoryManuallySelected(true);
                            setIsCatDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-705 flex items-center gap-2 transition cursor-pointer ${c.id === categoryId ? "bg-rose-50/40 dark:bg-rose-950/20 font-bold" : ""}`}
                        >
                          <span className="text-sm shrink-0">{c.icon || "🛒"}</span>
                          <span className="flex-1 shrink-0">{c.name}</span>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  HARCAMA TUTARI
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="₺350"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    HARCAMA AÇIKLAMASI
                  </label>
                  <span className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/40">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-500 animate-pulse" />
                    AI Otomatik Kategori Önerisi
                  </span>
                </div>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                  }}
                  placeholder="Örn: Migros market alışverişi, benzin, Starbucks kahve..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition"
                />
                {suggestedCategory ? (
                  <div className="mt-2 p-2.5 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-indigo-50/80 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 rounded-xl flex items-center justify-between gap-2 shadow-xs animate-fade-in">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg text-xs shrink-0 shadow-xs">
                        🤖
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block leading-none">
                          AI Algılanan Kategori:
                        </span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate block mt-0.5">
                          {suggestedCategory.icon || "🛒"} {suggestedCategory.name}
                        </span>
                      </div>
                    </div>
                    {categoryId !== suggestedCategory.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryId(suggestedCategory.id);
                          setIsCategoryManuallySelected(true);
                        }}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-black tracking-wide rounded-lg transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>Kategoriye Uygula</span>
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-1 text-[10px] rounded-lg shrink-0">
                        <Check className="w-3 h-3" /> Seçildi
                      </span>
                    )}
                  </div>
                ) : description.trim().length >= 2 ? (
                  <div className="mt-1.5 text-[9.5px] text-slate-400 dark:text-slate-500 italic flex items-center gap-1 px-1">
                    <Sparkles className="w-2.5 h-2.5 text-slate-400" />
                    <span>AI açıklamanıza uygun en iyi kategoriyi eşleştiriyor...</span>
                  </div>
                ) : null}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  HARCAMA TARİHİ
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>

              <div className="bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 cursor-pointer select-none" 
                  onClick={() => {
                    if (!isPremium) {
                      onUpgradeClick?.();
                    } else {
                      setExpenseAlarm(!expenseAlarm);
                    }
                  }}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${expenseAlarm ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"}`}>
                    {expenseAlarm && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    GİDER HATIRLATMA ALARMI KUR {!isPremium && <span className="text-[8px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black">PRO</span>}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsExpModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs"
              >
                İptal
              </button>
              <button
                onClick={handleSaveExpense}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Category Add/Edit Modal Dial */}
      {isCatModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl border border-slate-200/50 dark:border-slate-800/80 relative my-auto"
          >
            {/* Header info */}
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h4 className="text-sm font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Folder className="w-5 h-5" /> {catModalTitle}
              </h4>
              <button 
                onClick={() => setIsCatModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Card Preview Box */}
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">
                🔴 Canlı Kategori Kart Önizlemesi
              </span>
              <motion.div 
                animate={{ scale: [1, 1.015, 1], boxShadow: [`0 2px 8px ${categoryColor}15`, `0 6px 16px ${categoryColor}25`, `0 2px 8px ${categoryColor}15`] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl flex items-center justify-between select-none"
                style={{ borderLeft: `5px solid ${categoryColor}` }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-xs shrink-0 transition-transform duration-300"
                    style={{ backgroundColor: `${categoryColor}20`, color: categoryColor, textShadow: `0 0 10px ${categoryColor}30` }}
                  >
                    {categoryIcon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {categoryName.trim() || "Kategori Adı Belirtin"}
                    </p>
                    <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">
                      Harcama Grubu Önizleme
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end shrink-0">
                  <span className="text-xs font-black font-mono" style={{ color: categoryColor }}>
                    0,00 ₺
                  </span>
                  <span className="text-[8px] font-mono font-bold text-slate-400">
                    {categoryColor}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Quick Interactive Templates Section */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">
                ⚡ HIZLI VE RENKLİ HAZIR ŞABLONLAR (LİMİTSİZ)
              </span>
              <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-2xl border border-slate-100 dark:border-slate-850 max-h-36 overflow-y-auto pr-1">
                {[
                  { name: "Market", icon: "🛒", color: "#10b981", d: "Gıda" },
                  { name: "Kira", icon: "🏠", color: "#3b82f6", d: "Ev" },
                  { name: "Ulaşım", icon: "🚗", color: "#f59e0b", d: "Yol" },
                  { name: "Yemek", icon: "🍔", color: "#ec4899", d: "Kafe" },
                  { name: "Faturalar", icon: "⚡", color: "#ef4444", d: "Enerji" },
                  { name: "Eğlence", icon: "🍿", color: "#8b5cf6", d: "Sosyal" },
                  { name: "Eğitim", icon: "🎓", color: "#6366f1", d: "Okul" },
                  { name: "Sağlık", icon: "💊", color: "#f43f5e", d: "İlaç" },
                  { name: "Kişisel", icon: "💇", color: "#14b8a6", d: "Bakım" },
                  { name: "Spor", icon: "⚽", color: "#22c55e", d: "Hobi" },
                  { name: "Borçlar", icon: "💰", color: "#eab308", d: "Banka" },
                  { name: "Hediyeler", icon: "🎁", color: "#d946ef", d: "Özel" },
                ].map((item) => {
                  const isMatch = categoryName.toLowerCase() === item.name.toLowerCase();
                  return (
                    <motion.button
                      key={item.name}
                      type="button"
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setCategoryName(item.name);
                        setCategoryColor(item.color);
                        setCategoryIcon(item.icon);
                      }}
                      className="p-1.5 rounded-xl border flex flex-col items-center justify-center text-center gap-1 min-h-[58px] cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isMatch ? `${item.color}15` : "transparent",
                        borderColor: isMatch ? item.color : "transparent"
                      }}
                    >
                      <span className="text-base select-none leading-none">{item.icon}</span>
                      <span className="text-[8px] font-black tracking-wide truncate max-w-full text-slate-700 dark:text-slate-350">{item.name}</span>
                      <span className="text-[7px] text-slate-400 opacity-80 leading-none truncate">{item.d}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input Form fields */}
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">
                  KATEGORİ ADI (MANUEL DEĞİŞTİR)
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Kira, faturalar, eğlence vb."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs dark:text-white outline-none focus:ring-1 focus:ring-indigo-550 focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-450 block mb-1">
                    KATEGORİ RENGİ
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5">
                    <div className="relative w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center cursor-pointer shadow-inner shrink-0 hover:scale-105 active:scale-95 transition-all">
                      <input
                        type="color"
                        value={categoryColor}
                        onChange={(e) => setCategoryColor(e.target.value)}
                        className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer p-0 m-0 border-0 opacity-100"
                      />
                    </div>
                    <input
                      type="text"
                      maxLength={7}
                      value={categoryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith("#") && val.length <= 7) {
                          setCategoryColor(val);
                        } else if (!val.startsWith("#") && val.length <= 6) {
                          setCategoryColor("#" + val);
                        }
                      }}
                      className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none focus:ring-0 p-0 w-full min-w-0"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-450 block mb-1">
                    SEÇİLİ SİMGE
                  </label>
                  <div className="flex items-center justify-center h-10 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-lg font-bold">
                    <motion.span animate={{ scale: [0.9, 1.1, 1] }} key={categoryIcon}>
                      {categoryIcon}
                    </motion.span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">
                  KULLANILABİLİR SİMGELER
                </label>
                <div className="grid grid-cols-6 gap-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 max-h-[105px] overflow-y-auto">
                  {[
                    "🛒", "🏠", "🚗", "🍔", "⚡", "🎒", "💊", "🍿", "✈️", "🎓", "🧸", "💼", 
                    "💰", "🎁", "🐾", "💇", "⚽", "🔧", "❓", "🥩", "🍷", "📱", "💻", "🎸",
                    "🔥", "❤️", "💎", "🩺", "🎭", "📈", "🚌", "☕", "🍕", "🥦", "🛁", "🧴"
                  ].map((emoji) => {
                    const isSelected = categoryIcon === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setCategoryIcon(emoji)}
                        className={`text-base p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center hover:scale-115 ${
                          isSelected
                            ? "bg-indigo-500/20 border border-indigo-500 scale-105"
                            : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 hover:bg-indigo-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Save Actions Buttons */}
            <div className="flex gap-2.5 pt-2 border-t dark:border-slate-800">
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSaveCategory}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 transition active:scale-95 cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* 💡 Yapay Zeka Tasarruf İpucu Popover Kutucuğu */}
      {showTipCategory && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] overflow-y-auto animate-fade-in"
          onClick={() => setShowTipCategory(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border border-amber-200/40 dark:border-amber-900/40 text-left"
          >
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-500 rounded-xl">
                  <span className="text-xl select-none leading-none inline-block">
                    {showTipCategory.icon || "💡"}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    {showTipCategory.name} Tasarruf İpucu
                  </h4>
                  <p className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold tracking-wider uppercase">
                    Yapay Zeka Bütçe Önerisi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTipCategory(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl transition text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-amber-50/55 dark:bg-amber-950/20 border-l-[3px] border-amber-500 rounded-2xl space-y-2">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">
                    Bütçe Asistanı Tavsiyesi
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                  {getSavingTipForCategory(
                    showTipCategory.name,
                    showTipCategory.icon || "🛒",
                  )}
                </p>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold leading-normal italic text-center">
                🤖 Analiz motorumuz bu tavsiyeyi kategori profiline özel
                üretmiştir.
              </p>
            </div>

            <button
              onClick={() => setShowTipCategory(null)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              Anladım, Kapat
            </button>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Harcama / Gider Sayfası Sponsorlu Reklamı */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 p-4 bg-rose-500/5 dark:bg-rose-950/10 border border-rose-500/20 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl text-xl shrink-0">
              💳
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[8px] font-black uppercase tracking-wider rounded-md border border-rose-500/20">
                  Harcama Fırsatı
                </span>
                <span className="text-[9px] text-slate-400 font-bold">
                  • QNB Finansbank CardFinans
                </span>
              </div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                Her Market ve Gıda Alışverişinizde %10 Nakit Para İadesi Kazanın! 🎉
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">
                Giderlerinizi avantaja çevirin. CardFinans ile aylık toplam 750 TL'ye varan nakit para (ParaPuan) hesabınıza anında yatırılsın.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <a
              href="https://www.qnbfinansbank.com"
              target="_blank"
              rel="noreferrer referrer"
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-xl transition shadow-xs cursor-pointer uppercase tracking-wider text-center flex-1 sm:flex-none"
            >
              Kart Başvurusu
            </a>
            <button
              onClick={onUpgradeClick}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-500 text-[10px] font-black rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1 uppercase tracking-tight shrink-0 flex-1 sm:flex-none"
            >
              Reklamsız
            </button>
          </div>
        </motion.div>
      )}

      {isScannerOpen && (
        <ReceiptScanner
          onScanCompleted={handleScanCompleted}
          onClose={() => setIsScannerOpen(false)}
          defaultType="expense"
        />
      )}
    </div>
  );
};

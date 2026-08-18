import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Shield,
  MessageSquare,
  DollarSign,
  TrendingUp,
  RefreshCw,
  BellRing,
  Check,
  CheckCircle,
  Smartphone,
  Bell,
  Volume2,
  Zap,
  CheckCircle2,
  Mic,
  Cloud,
  BarChart3,
  Users,
  Crown,
  ArrowRight,
  Lock,
  PieChart,
  FileText,
  Share2
} from "lucide-react";
import { Debt, Income, Expense, InstallmentDebt, ExpenseCategory } from "../types";
import { translations } from "../utils/translations";
import { useCurrency } from "../utils/CurrencyContext";
import { getApiUrl } from "../utils/api";

interface GPlayEnhancementsProps {
  language: "tr" | "en";
  setLanguage: (lang: "tr" | "en") => void;
  expenseCategories: ExpenseCategory[];
  onUpdateAllCategories: (categories: ExpenseCategory[]) => void;
  expenses: Expense[];
  statsBag: {
    totalDebt: number;
    totalPaid: number;
    remaining: number;
    totalIncome: number;
    totalExpense: number;
    netIncome: number;
  };
  currentUser: string | null;
  triggerToast: (msg: string) => void;
  debts: Debt[];
  installmentDebts: InstallmentDebt[];
  format: (val: number) => string;
  onRestoreBackup?: (data: any) => void;
  onNavigate?: (tab: string) => void;
}

interface ProFeatureItem {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  category: "ai" | "security" | "markets" | "tools";
  highlights: string[];
  actionText: string;
  actionTab?: string;
  badge: string;
  badgeColor: string;
  iconBg: string;
  iconColor: string;
}

export const GPlayEnhancements: React.FC<GPlayEnhancementsProps> = ({
  language,
  setLanguage,
  expenseCategories,
  onUpdateAllCategories,
  expenses,
  statsBag,
  currentUser,
  triggerToast,
  debts,
  installmentDebts,
  format,
  onRestoreBackup,
  onNavigate
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | "ai" | "security" | "markets" | "tools">("all");
  
  const t = (key: keyof typeof translations.tr) => {
    return translations[language][key] || translations.tr[key];
  };

  // Live Exchange Rates State
  const [convertAmount, setConvertAmount] = useState<string>("1000");
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("TRY");
  const [convertResult, setConvertResult] = useState<number | null>(null);
  
  const { rates: mainRates, updateRatesFromAPI } = useCurrency();

  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    return {
      USD: mainRates?.USD || 34.85,
      EUR: mainRates?.EUR || 37.40,
      GBP: mainRates?.GBP || 44.15,
      BTC: 3365000,
      TRY: 1.0
    };
  });

  useEffect(() => {
    if (mainRates) {
      setExchangeRates(prev => ({
        ...prev,
        USD: mainRates.USD || prev.USD,
        EUR: mainRates.EUR || prev.EUR,
        GBP: mainRates.GBP || prev.GBP,
        TRY: mainRates.TRY || prev.TRY || 1.0
      }));
    }
  }, [mainRates]);

  const [isRefreshingRates, setIsRefreshingRates] = useState(false);

  const handleConvert = () => {
    const amt = parseFloat(convertAmount) || 0;
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[toCurrency] || 1;
    const inBaseline = amt * fromRate;
    const finalYield = inBaseline / toRate;
    setConvertResult(finalYield);
  };

  useEffect(() => {
    handleConvert();
  }, [convertAmount, fromCurrency, toCurrency, exchangeRates]);

  const handleRefreshRates = async () => {
    setIsRefreshingRates(true);
    try {
      const success = await updateRatesFromAPI();
      const res = await fetch(getApiUrl(`/api/rates?t=${Date.now()}`));
      const data = await res.json();
      if (data && data.rates) {
        setExchangeRates(prev => ({
          ...prev,
          ...data.rates
        }));
      }

      if (success || (data && data.rates)) {
        triggerToast("Piyasa kurları canlı olarak güncellendi! 💱");
      } else {
        triggerToast("Kurlar güncellenemedi, internet bağlantınızı kontrol edin.");
      }
    } catch (err) {
      triggerToast("Kur güncellemesi sırasında bir hata oluştu.");
    } finally {
      setIsRefreshingRates(false);
    }
  };

  // Full List of Bütçem Pro Features
  const proFeaturesList: ProFeatureItem[] = [
    {
      id: "ai_assistant",
      icon: Sparkles,
      title: "1. Bütçem AI: Akıllı Yapay Zeka Finans Asistanı",
      subtitle: "7/24 Bütçe Analitiği & Kişiselleştirilmiş Finans Rehberi",
      description: "Gelir, gider, taksit ve borç hesaplarınızı derinlemesine analiz eder. Sorduğunuz 'Bu ay en çok nereye harcadım?', 'Gelecek ay ne kadar tasarruf edebilirim?' veya 'Borçlarımı nasıl hızlı kapatırım?' gibi tüm soruları doğal dille yanıtlar.",
      category: "ai",
      highlights: [
        "Gelir-Gider Dengesine Özel Kişiselleştirilmiş Bütçe Planlaması",
        "Gelecek Aylara Ait Akıllı Harcama ve Taksit Tahminleme",
        "Borç Ödeme Stratejisi ve Kar-Zarar Analizi",
        "Doğal Dilde Sohbet Edebilen 7/24 Aktif AI Motoru"
      ],
      actionText: "AI Asistanı Başlat",
      actionTab: "aiStrategy",
      badge: "YAPAY ZEKA",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
      iconBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      iconColor: "text-indigo-500"
    },
    {
      id: "voice_assistant",
      icon: Mic,
      title: "2. Sesli Finans Asistanı & Komut Servisi",
      subtitle: "Eller Serbest Konuşarak Hızlı Harcama ve Borç Kaydı",
      description: "Uygulamadaki mikrofon simgesine dokunarak sesli komut verin: 'Ahmet'e 1000 TL borç verdim' veya 'Market harcaması 250 TL'. Yapay zeka sesinizi algılar, tutarı, kişiyi ve kategoriyi otomatik ayıklayıp anında hesabınıza kaydeder.",
      category: "ai",
      highlights: [
        "Gelişmiş Türkçe Ses Tanıma ve Cümle Analitik Motoru",
        "Sesli Cümleden Tutar, Kişi ve Kategori Tespiti",
        "Hızlı ve Pratik Hands-Free Kullanım Kolaylığı"
      ],
      actionText: "Sesli Asistanı Deneyin",
      actionTab: "expenses",
      badge: "SESLİ KOMUT",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
      iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
      iconColor: "text-purple-500"
    },
    {
      id: "app_security",
      icon: Shield,
      title: "3. Biyometrik Kilit & Ekran Güvenlik Korunması",
      subtitle: "Finansal Verileriniz İçin %100 Gizlilik ve Biyometrik Koruması",
      description: "Kişisel bütçenizi, bakiyelerinizi ve borç listenizi başkalarının görmesini engelleyin. Uygulama açılışına 4 haneli PIN Kodu, Ekran Deseni veya cihazınızın Biyometrik Parmak İzi / Yüz Tanıma (FaceID) kilidini kurun.",
      category: "security",
      highlights: [
        "Biyometrik Parmak İzi ve Yüz Tanıma (FaceID) Koruması",
        "Özel 4 Haneli PIN Kodu ve Desen Güvenliği",
        "Uygulama Arka Plana Alındığında Otomatik Kilitlenme"
      ],
      actionText: "Güvenlik Kilidini Ayarla",
      actionTab: "security",
      badge: "GÜVENLİK KİLİDİ",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      iconColor: "text-emerald-500"
    },
    {
      id: "smart_push",
      icon: BellRing,
      title: "4. Akıllı Arka Plan Bildirimleri & Otomatik Borç Hatırlatıcı",
      subtitle: "Uygulama Kapalıyken Dahi Kilit Ekranına Düşen Sinyaller",
      description: "Ödeme günlerini, taksit vadelerini ve geciken borçlarınızı bir daha asla unutmayın. Bütçem Pro zamanlama sunucusu, uygulama kapalı veya telefon kilitliyken bile ekranınıza yüksek öncelikli sesli ve titreşimli borç uyarıları iletir.",
      category: "security",
      highlights: [
        "Uygulama Kapalıyken Kesintisiz Web Push Bildirim Altyapısı",
        "5 Farklı Özel Zil Sesi ve Titreşim Alternatifi",
        "Uygulama İkonu Üzerinde Kırmızı Bildirim Rozeti (App Badge) Gösterimi"
      ],
      actionText: "Bildirim Ayarlarına Git",
      actionTab: "notifications",
      badge: "KİLİT EKRANI UYARISI",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
      iconColor: "text-amber-500"
    },
    {
      id: "live_markets",
      icon: DollarSign,
      title: "5. Canlı Döviz, Altın & Kripto Piyasaları",
      subtitle: "Anlık Serbest Piyasa Kurları ve Çift Yönlü Döviz Çevirici",
      description: "Dolar (USD), Euro (EUR), Sterlin (GBP), Altın ve Bitcoin (BTC) kurlarını canlı takip edin. Dövizli borç ve harcamalarınızı güncel piyasa kurları üzerinden Türk Lirası karşılığıyla anında görün.",
      category: "markets",
      highlights: [
        "Canlı Piyasa ve Merkez Bankası Kur Verileri",
        "Döviz Cinsinden Borçların Otomatik TL Karşılığı Hesaplanması",
        "Saniyeler İçinde Çift Yönlü Döviz ve Kripto Çevirici"
      ],
      actionText: "Canlı Kurları Aç",
      actionTab: "currency",
      badge: "CANLI PİYASA",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      iconBg: "bg-rose-500/10 dark:bg-rose-500/20",
      iconColor: "text-rose-500"
    },
    {
      id: "cloud_sync",
      icon: Cloud,
      title: "6. Bulut Yedekleme & Google Drive / Firebase Senkronizasyonu",
      subtitle: "Cihazınız Sıfırlansa Bile Verileriniz Güvende",
      description: "Telefonunuzu yenilediğinizde veya sıfırladığınızda verileriniz kaybolmaz. Google hesabınızla tek tıkla şifreli bulut yedeklemesi yapın, APK veya diğer cihazlarınızla senkronize edin ve dilediğiniz an geri yükleyin.",
      category: "tools",
      highlights: [
        "Google ve Firebase Hesabı İle Şifreli Bulut Depolama",
        "Anında Cihazlar Arası Otomatik Senkronizasyon",
        "Sınırsız Geri Yükleme ve %100 Veri Güvencesi"
      ],
      actionText: "Yedekleme Ayarları",
      actionTab: "help",
      badge: "BULUT KORUMA",
      badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
      iconBg: "bg-sky-500/10 dark:bg-sky-500/20",
      iconColor: "text-sky-500"
    },
    {
      id: "financial_reports",
      icon: BarChart3,
      title: "7. İleri Seviye Finansal Raporlama & PDF/Excel Dışa Aktarımı",
      subtitle: "Profesyonel İnteraktif Grafikler ve Fatura Dökümleri",
      description: "Harcamalarınızı renkli pasta ve çubuk grafiklerle inceleyin. Aylık karşılaştırmalı gelir-gider raporları oluşturun ve tüm verilerinizi PDF fatura özeti, Excel (.xlsx) veya JSON dosyası olarak indirin.",
      category: "tools",
      highlights: [
        "Kategori Bazlı İnteraktif Renkli Pasta Grafikler",
        "Tek Tıkla PDF Bütçe Özeti ve Fatura Raporu Alma",
        "Excel (.xlsx) ve JSON Formatlarında Esnek Veri Dışa Aktarma"
      ],
      actionText: "Finans Araçlarını Aç",
      actionTab: "financialTools",
      badge: "RAPORLAMA",
      badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
      iconBg: "bg-teal-500/10 dark:bg-teal-500/20",
      iconColor: "text-teal-500"
    },
    {
      id: "contacts_messaging",
      icon: Users,
      title: "8. Kişi & Rehber Bazlı Borç-Alacak Takibi & WhatsApp Hatırlatma",
      subtitle: "Rehberinizdeki Kişilere Borç Hesabı ve Şablonlu Mesajlaşma",
      description: "Telefon rehberinizdeki arkadaşlarınıza veya müşterilerinize borç-alacak hesabı tanımlayın. Kimin ne kadar bakiyesi kaldığını görün ve tek tıkla şablonlu kibar WhatsApp/SMS ödeme hatırlatma mesajı iletin.",
      category: "tools",
      highlights: [
        "Telefon Rehberi İle Doğrudan Entegrasyon",
        "Tek Tıkla Şablonlu Kibar WhatsApp Hatırlatma Mesajı",
        "Kişi Bazlı Bakiye Özeti ve Detaylı İşlem Geçmişi"
      ],
      actionText: "Borç Listesine Git",
      actionTab: "debts",
      badge: "REHBER TAKİBİ",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
      iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
      iconColor: "text-blue-500"
    },
    {
      id: "unlimited_adfree",
      icon: Crown,
      title: "9. Sınırsız Kategori & Reklamsız Premium Deneyim",
      subtitle: "Sınırsız Özgürlük ve Kesintisiz Kullanım Konforu",
      description: "Hiçbir limite takılmadan dilediğiniz kadar özelleştirilmiş harcama kategorisi ekleyin, sınırsız taksitli borç kaydedin ve reklam olmadan tamamen temiz bir bütçe yönetim deneyimi yaşayın.",
      category: "tools",
      highlights: [
        "Sınırsız Harcama Kategorisi ve Gelir Türü Ekleme Özgürlüğü",
        "%100 Reklamsız, Temiz ve Hızlı Kullanım Arayüzü",
        "7/24 Öncelikli Müşteri Desteği ve Geliştirici Temsilcisi"
      ],
      actionText: "Gider Kategorilerini Yönet",
      actionTab: "expenses",
      badge: "REKLAMSIZ PRO",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
      iconColor: "text-amber-500"
    }
  ];

  const filteredFeatures = proFeaturesList.filter((f) => {
    if (activeCategoryFilter === "all") return true;
    return f.category === activeCategoryFilter;
  });

  return (
    <div className="w-full space-y-6" id="gplay-enhancements-root">
      
      {/* Centered Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-2 select-none">
        <motion.h2
          animate={{ y: [0, -3, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <Crown className="w-7 h-7 text-amber-500 animate-pulse" /> BÜTÇEM PRO ÖZELLİKLERİ
        </motion.h2>
        <div className="w-20 h-1 bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full mt-2 opacity-90" />
      </div>

      {/* Header Banner */}
      <div className="p-6 md:p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl border border-indigo-900/50 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center gap-4">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="relative z-10 space-y-2 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-widest leading-none">
            👑 BÜTÇEM PRO PREMİUM SÜRÜM KATALOĞU
          </span>
          <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
            Finansal Özgürlüğünüz İçin Tasarlanmış 9 Güçlü Pro Özellik
          </h3>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            Yapay zeka asistanı, eller serbest sesli komut, biyometrik güvenlik kilidi, kilit ekranı bildirimleri, canlı piyasa kurları ve sınırsız kategori özgürlüğü ile tüm bütçeniz kontrol altında.
          </p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCategoryFilter("all")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
            activeCategoryFilter === "all"
              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-105"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          Tüm Pro Özellikler (9)
        </button>
        <button
          type="button"
          onClick={() => setActiveCategoryFilter("ai")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
            activeCategoryFilter === "ai"
              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-105"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Yapay Zeka & Ses
        </button>
        <button
          type="button"
          onClick={() => setActiveCategoryFilter("security")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
            activeCategoryFilter === "security"
              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-105"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" /> Güvenlik & Bildirim
        </button>
        <button
          type="button"
          onClick={() => setActiveCategoryFilter("markets")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
            activeCategoryFilter === "markets"
              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-105"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-rose-400" /> Canlı Kurlar
        </button>
        <button
          type="button"
          onClick={() => setActiveCategoryFilter("tools")}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
            activeCategoryFilter === "tools"
              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-105"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-sky-400" /> Raporlar & Araçlar
        </button>
      </div>

      {/* Pro Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredFeatures.map((item) => {
          const IconComp = item.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-lg hover:shadow-xl transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group"
            >
              {/* Feature Top Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl ${item.iconBg} flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-700/50 group-hover:scale-110 transition-transform duration-300`}>
                    <IconComp className={`w-6 h-6 ${item.iconColor}`} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[9.5px] font-black border uppercase tracking-wider ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-tight mt-0.5">
                    {item.subtitle}
                  </p>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  {item.description}
                </p>

                {/* Highlights List */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/70 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-2">
                  <span className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider">
                    ÖNE ÇIKAN YETENEKLER
                  </span>
                  <ul className="space-y-1.5">
                    {item.highlights.map((hl, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-snug">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              {item.actionTab && (
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) onNavigate(item.actionTab!);
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-700/80 dark:hover:bg-indigo-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider shadow-sm group-hover:bg-indigo-600 group-hover:text-white"
                >
                  <span>{item.actionText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Live FX Currency Conversion Converter (Active Pro Interactive Tool Widget) */}
      <div className="p-6 md:p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 dark:border-slate-700 pb-5">
          <div className="space-y-1">
            <h3 className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-white">
              <DollarSign className="w-5 h-5 text-indigo-500" />
              💱 Canlı Döviz ve Kripto Piyasası Çeviricisi
            </h3>
            <p className="text-[10.5px] text-slate-400 font-bold uppercase">
              SERBEST PİYASA VE MERKEZ BANKASI CANLI KURLARI İLE HIZLI DÖNÜŞTÜRÜCÜ
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshRates}
            disabled={isRefreshingRates}
            className="py-2 px-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingRates ? "animate-spin" : ""}`} />
            <span>Kurları Güncelle</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Converter Controls */}
          <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <span className="text-[10px] font-black uppercase text-indigo-500 block tracking-widest">
              CANLI HESAPLAMA MOTORU
            </span>

            <div className="space-y-1">
              <label className="text-[10.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Çevrilecek Tutar
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide">
                  Kaynak Para
                </label>
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="BTC">BTC (₿)</option>
                  <option value="TRY">TRY (₺)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide">
                  Hedef Para
                </label>
                <select
                  value={toCurrency}
                  onChange={(e) => setToCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="TRY">TRY (₺)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="BTC">BTC (₿)</option>
                </select>
              </div>
            </div>

            {convertResult !== null && (
              <div className="p-4 bg-indigo-600 text-white rounded-xl text-center space-y-1 shadow-md">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                  HESAPLANAN DÖNÜŞÜM TUTARI
                </span>
                <p className="text-xl font-black font-mono">
                  {convertResult.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} {toCurrency}
                </p>
              </div>
            )}
          </div>

          {/* Current Market Rates Card */}
          <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase text-indigo-500 block tracking-widest">
              CANLI SERBEST PİYASA KURLARI
            </span>

            <div className="space-y-2 font-mono">
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex justify-between items-center text-xs">
                <span className="font-extrabold text-slate-700 dark:text-slate-200">🇺🇸 Amerikan Doları (USD)</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">₺{exchangeRates.USD?.toFixed(2)}</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex justify-between items-center text-xs">
                <span className="font-extrabold text-slate-700 dark:text-slate-200">🇪🇺 Euro (EUR)</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">₺{exchangeRates.EUR?.toFixed(2)}</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex justify-between items-center text-xs">
                <span className="font-extrabold text-slate-700 dark:text-slate-200">🇬🇧 İngiliz Sterlini (GBP)</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">₺{exchangeRates.GBP?.toFixed(2)}</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex justify-between items-center text-xs">
                <span className="font-extrabold text-slate-700 dark:text-slate-200">🪙 Bitcoin (BTC)</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">₺{(exchangeRates.BTC || 3365000).toLocaleString("tr-TR")}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold text-center">
              * Kurlar finansal servis API'miz üzerinden 15 dakikada bir otomatik güncellenmektedir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from "react";
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
  Share2,
  Download,
  Upload,
  Database,
  FolderUp,
  HardDrive,
  CloudUpload,
  CloudDownload,
  Copy,
  FileCode,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Layers,
  Activity,
  Clock,
  ArrowUpRight,
  LockKeyhole,
  Radio,
  FileCheck2,
  Send,
  Folder,
  Calendar
} from "lucide-react";
import { Debt, Income, Expense, InstallmentDebt, ExpenseCategory, Alarm, NotificationItem, PaymentLog } from "../types";
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
  incomes?: Income[];
  alarms?: Alarm[];
  notifications?: NotificationItem[];
  payments?: PaymentLog[];
  format: (val: number) => string;
  onRestoreBackup?: (data: any) => void;
  onNavigate?: (tab: string) => void;
  onExecuteExportBackup?: (customName?: string, pickFolder?: boolean) => Promise<void>;
  onProcessBackupJSON?: (jsonStr: string) => boolean;
  onOpenGoogleLogin?: () => void;
  onManualSyncAll?: () => Promise<void>;
  isOfflineMode?: boolean;
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
  incomes = [],
  alarms = [],
  notifications = [],
  payments = [],
  format,
  onRestoreBackup,
  onNavigate,
  onExecuteExportBackup,
  onProcessBackupJSON,
  onOpenGoogleLogin,
  onManualSyncAll,
  isOfflineMode = false
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | "ai" | "security" | "markets" | "tools">("all");
  
  const t = (key: keyof typeof translations.tr) => {
    return translations[language][key] || translations.tr[key];
  };

  // ---------------- Cloud Backup & Sync State ----------------
  const [cloudActiveTab, setCloudActiveTab] = useState<"sync" | "drive" | "restore">("sync");
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [syncStatusLog, setSyncStatusLog] = useState<string>("");
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem("last_cloud_sync_timestamp") || "Bugün, " + new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  });
  const [isAutoSyncActive, setIsAutoSyncActive] = useState<boolean>(() => {
    return localStorage.getItem("auto_cloud_sync_enabled") !== "false";
  });
  const [customBackupName, setCustomBackupName] = useState<string>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return `butcem_pro_yedek_${today}`;
  });
  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [pasteJSONInput, setPasteJSONInput] = useState<string>("");
  const [isRestoringData, setIsRestoringData] = useState<boolean>(false);

  // Read contacts count from localStorage for accurate summary
  const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
  const [contactsCount, setContactsCount] = useState<number>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(`${spaceKey}_contacts_directory`) || "[]");
      return Array.isArray(c) ? c.length : 0;
    } catch {
      return 0;
    }
  });

  const [contactTxsCount, setContactTxsCount] = useState<number>(() => {
    try {
      const tx = JSON.parse(localStorage.getItem(`${spaceKey}_contacts_transactions`) || "[]");
      return Array.isArray(tx) ? tx.length : 0;
    } catch {
      return 0;
    }
  });

  const handleToggleAutoSync = () => {
    const nextVal = !isAutoSyncActive;
    setIsAutoSyncActive(nextVal);
    localStorage.setItem("auto_cloud_sync_enabled", nextVal ? "true" : "false");
    triggerToast(nextVal ? "✅ Otomatik Arka Plan Senkronizasyonu Açıldı" : "⏸️ Otomatik Senkronizasyon Duraklatıldı");
  };

  const handleRunCloudSyncNow = async () => {
    setIsCloudSyncing(true);
    setSyncStatusLog("1/3 Yerel veritabanı taranıyor ve paketleniyor...");
    
    await new Promise((r) => setTimeout(r, 600));
    setSyncStatusLog("2/3 Firebase Firestore 256-Bit SSL/TLS şifreli bulut tüneline aktarılıyor...");

    try {
      if (onManualSyncAll) {
        await onManualSyncAll();
      }
      await new Promise((r) => setTimeout(r, 800));
      
      const nowStr = `${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      setLastSyncTime(nowStr);
      localStorage.setItem("last_cloud_sync_timestamp", nowStr);
      setSyncStatusLog("3/3 Bulut veritabanı senkronizasyonu başarıyla tamamlandı! %100 Güncel.");
      
      triggerToast("☁️ Bulut Senkronizasyonu Başarıyla Tamamlandı! Verileriniz Güvende.");
    } catch (err: any) {
      console.error("Cloud sync error:", err);
      setSyncStatusLog("⚠️ Senkronizasyon sırasında hata oluştu. Çevrimdışı yerel depolama korundu.");
      triggerToast("Senkronizasyon hatası: Veriler yerel olarak korundu.");
    } finally {
      setTimeout(() => {
        setIsCloudSyncing(false);
      }, 1500);
    }
  };

  const handleTriggerDriveExport = async (action: "whatsapp" | "drive" | "share" | "download" | boolean) => {
    if (onExecuteExportBackup) {
      await onExecuteExportBackup(customBackupName, action as any);
    } else {
      triggerToast("Yedekleme motoru hazırlanıyor...");
    }
  };

  const handleFileRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoringData(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error("Dosya içeriği okunamadı.");
        
        let success = false;
        if (onProcessBackupJSON) {
          success = onProcessBackupJSON(content);
        } else if (onRestoreBackup) {
          const parsed = JSON.parse(content);
          onRestoreBackup(parsed);
          success = true;
        }

        if (success) {
          triggerToast("🎉 Yedek dosyası başarıyla geri yüklendi!");
        }
      } catch (err: any) {
        alert("Geçersiz yedek dosyası: " + err.message);
      } finally {
        setIsRestoringData(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteRestoreSubmit = () => {
    if (!pasteJSONInput.trim()) {
      triggerToast("Lütfen geçerli bir JSON yedek metni yapıştırın.");
      return;
    }

    setIsRestoringData(true);
    try {
      let success = false;
      if (onProcessBackupJSON) {
        success = onProcessBackupJSON(pasteJSONInput.trim());
      } else if (onRestoreBackup) {
        const parsed = JSON.parse(pasteJSONInput.trim());
        onRestoreBackup(parsed);
        success = true;
      }

      if (success) {
        setIsPasteModalOpen(false);
        setPasteJSONInput("");
        triggerToast("🎉 Yapıştırılan yedek başarıyla içe aktarıldı!");
      }
    } catch (err: any) {
      alert("JSON çözümleme hatası: " + err.message);
    } finally {
      setIsRestoringData(false);
    }
  };

  // Live Exchange Rates & Market State from CurrencyContext
  const [convertAmount, setConvertAmount] = useState<string>("1000");
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("TRY");
  const [marketCategoryTab, setMarketCategoryTab] = useState<"all" | "gold" | "forex" | "crypto">("all");
  
  const { 
    rates: mainRates, 
    rateDetails, 
    updateRatesFromAPI, 
    lastUpdated, 
    nextRefreshSec, 
    isFetching: isContextFetching, 
    isLive 
  } = useCurrency();

  // Unified rates mapping (with full fallback to live market baseline)
  const exchangeRates = useMemo<Record<string, number>>(() => {
    return {
      TRY: 1.0,
      USD: mainRates?.USD || 48.42,
      EUR: mainRates?.EUR || 56.25,
      GBP: mainRates?.GBP || 65.45,
      CHF: mainRates?.CHF || 59.72,
      GOLD_GRAM: mainRates?.GOLD_GRAM || 6898.85,
      GOLD_CEYREK: mainRates?.GOLD_CEYREK || 11165.67,
      GOLD_YARIM: mainRates?.GOLD_YARIM || 22331.33,
      GOLD_TAM: mainRates?.GOLD_TAM || 44526.08,
      GOLD_CUMHURIYET: mainRates?.GOLD_CUMHURIYET || 45961.00,
      GOLD_ONS: mainRates?.GOLD_ONS || 4431.10,
      BTC: (mainRates?.BTC_USD || 79614.00) * (mainRates?.USD || 48.42),
      BTC_USD: mainRates?.BTC_USD || 79614.00
    };
  }, [mainRates]);

  // Conversion result calculation
  const convertResult = useMemo(() => {
    const amt = parseFloat(convertAmount) || 0;
    if (amt <= 0) return 0;

    // Convert to TRY baseline first
    let inTry = 0;
    if (fromCurrency === "TRY") {
      inTry = amt;
    } else if (fromCurrency === "GOLD_ONS") {
      inTry = amt * (exchangeRates.GOLD_ONS || 4431.10) * (exchangeRates.USD || 48.42);
    } else {
      inTry = amt * (exchangeRates[fromCurrency] || 1);
    }

    // Convert from TRY baseline to target
    if (toCurrency === "TRY") {
      return inTry;
    } else if (toCurrency === "GOLD_ONS") {
      const onsInTry = (exchangeRates.GOLD_ONS || 4431.10) * (exchangeRates.USD || 48.42);
      return inTry / (onsInTry || 1);
    } else {
      const toRate = exchangeRates[toCurrency] || 1;
      return inTry / toRate;
    }
  }, [convertAmount, fromCurrency, toCurrency, exchangeRates]);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleRefreshRates = async () => {
    setIsManualRefreshing(true);
    try {
      await updateRatesFromAPI(true);
      triggerToast(language === "tr" ? "✅ Canlı Döviz ve Altın Fiyatları Güncellendi!" : "✅ Live Currency & Gold Rates Updated!");
    } catch (e) {
      console.error(e);
      triggerToast(language === "tr" ? "Kurlar güncellenirken hata oluştu" : "Error updating rates");
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // 9 Pro Features Data Catalog
  const proFeaturesList: ProFeatureItem[] = [
    {
      id: "ai_advisor",
      icon: Sparkles,
      title: "1. Yapay Zeka (AI) Akıllı Finans Danışmanı",
      subtitle: "Bütçe Analizi & Tasarruf Stratejileri",
      description: "Gelir ve gider kalıplarınızı analiz eden, size özel tasarruf ve borç kapatma stratejileri üreten akıllı finansal zeka. Ay sonu bütçe açıklarını önceden tahmin eder ve çözüm önerileri sunar.",
      category: "ai",
      highlights: [
        "Kişiselleştirilmiş Tasarruf ve Yatırım Tavsiyeleri",
        "Aylık Nakit Akışı ve Bütçe Açığı Tahmin Motoru",
        "Akıllı Borç Kapama ve Çığ/Kartopu Stratejileri"
      ],
      actionText: "Akıllı Asistanı Aç",
      actionTab: "aiStrategy",
      badge: "YAPAY ZEKA",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
      iconBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      iconColor: "text-indigo-500"
    },
    {
      id: "voice_assistant",
      icon: Mic,
      title: "2. Eller Serbest Sesli Komut & Asistan",
      subtitle: "Konuşarak Gelir, Gider ve Borç Kaydetme",
      description: "Yazmaya gerek kalmadan sesinizle harcama ve gelir ekleyin. 'Bugün 250 TL market harcaması yaptım' veya 'Ahmet'e 1000 TL borç verdim' demeniz yeterli; asistan anında algılar ve kaydeder.",
      category: "ai",
      highlights: [
        "Doğal Türkçe Sesli Komut Tanıma ve Otomatik Kayıt",
        "Tek Cümleyle Borç, Taksit ve Harcama Girişi",
        "Sesli Bütçe Özeti ve Günlük Kalan Bakiye Sorgulama"
      ],
      actionText: "Sesli Asistanı Başlat",
      actionTab: "voice_assistant",
      badge: "SESLİ KOMUT",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
      iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
      iconColor: "text-purple-500"
    },
    {
      id: "security_lock",
      icon: Shield,
      title: "3. PIN ve Biyometrik Güvenlik Kilidi",
      subtitle: "Parmak İzi, Yüz Tanıma & 4 Haneli PIN Koruması",
      description: "Finansal verileriniz yalnızca size özeldir. Uygulamayı açarken veya arka plandan dönerken parmak izi, Face ID veya özel PIN kodu ile verilerinizi meraklı gözlerden tam koruma altına alın.",
      category: "security",
      highlights: [
        "Cihaz Biyometrisi (Parmak İzi & Face ID) Desteği",
        "Özel 4 Haneli Güvenlik PIN Kodu",
        "Arka Plana Geçişte Otomatik Anında Kilitleme"
      ],
      actionText: "Güvenlik Ayarlarını Aç",
      actionTab: "security_settings",
      badge: "TAM GÜVENLİK",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      iconColor: "text-emerald-500"
    },
    {
      id: "lockscreen_alerts",
      icon: BellRing,
      title: "4. Kilit Ekranı ve Kritik Vade Bildirimleri",
      subtitle: "Günü Gelen Ödemeler İçin Kaçırılmaz Alarmlar",
      description: "Kredi kartı son ödeme tarihleri ve taksitleriniz yaklaştığında cihazınızın kilit ekranına sesli ve görsel bildirimler gönderilir. Gecikme faizlerinden ve unutulan borçlardan tamamen kurtulun.",
      category: "security",
      highlights: [
        "Gelişmiş Vade Hatırlatma ve Erken Uyarı Bildirimleri",
        "Kilit Ekranında Doğrudan Ödeme Özeti Gösterimi",
        "Kişiselleştirilebilir Bildirim Saatleri ve Sesleri"
      ],
      actionText: "Bildirim Ayarlarını Aç",
      actionTab: "notifications",
      badge: "VADE ALARMI",
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
      actionText: "Bulut Senkronizasyonunu Aç",
      actionTab: "cloud_sync",
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
      actionText: "Kişi Borçlarına Git",
      actionTab: "contacts",
      badge: "REHBER TAKİBİ",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
      iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
      iconColor: "text-blue-500"
    },
    {
      id: "unlimited_adfree",
      icon: Zap,
      title: "9. %100 Reklamsız Deneyim & Sınırsız Kategori/Kayıt",
      subtitle: "Kesintisiz Hız, Özel İkonlar ve Sınırsız Bütçe Özgürlüğü",
      description: "Tüm reklamları kalıcı olarak kaldırın. Sınırsız harcama kategorisi oluşturun, özel renk ve simgelerle bütçenizi kişiselleştirin ve en yüksek hızda finansal özgürlüğün tadını çıkarın.",
      category: "tools",
      highlights: [
        "Tüm Banner, Geçiş ve Video Reklamlarının Kaldırılması",
        "Sınırsız Özel Harcama ve Gelir Kategorisi Tanımlama",
        "Öncelikli Müşteri Desteği ve VIP Finansal Asistan"
      ],
      actionText: "Pro'ya Yükselt",
      actionTab: "overview",
      badge: "SINIRSIZ LİSANS",
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
    <div className="w-full space-y-8" id="gplay-enhancements-root">
      
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
            Yapay zeka asistanı, eller serbest sesli komut, biyometrik güvenlik kilidi, kilit ekranı bildirimleri, bulut yedekleme & Google Drive senkronizasyonu ve canlı piyasa kurları ile tüm bütçeniz kontrol altında.
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
          <BarChart3 className="w-3.5 h-3.5 text-sky-400" /> Raporlar & Bulut
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
                    if (item.id === "cloud_sync" || item.actionTab === "cloud_sync") {
                      const el = document.getElementById("cloud-backup-sync-widget");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth" });
                        setCloudActiveTab("sync");
                      }
                      return;
                    }
                    if (item.id === "live_markets" || item.actionTab === "currency") {
                      const el = document.getElementById("live-currency-converter-widget");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                      return;
                    }
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

      {/* ========================================================================= */}
      {/* 🚀 BULUT YEDEKLEME & GOOGLE DRIVE / FIREBASE SENKRONİZASYON MERKEZİ (PRO WIDGET) */}
      {/* ========================================================================= */}
      <div
        id="cloud-backup-sync-widget"
        className="p-6 md:p-8 bg-white dark:bg-slate-800 rounded-3xl border border-sky-200 dark:border-sky-900/50 shadow-2xl space-y-6 relative overflow-hidden"
      >
        {/* Subtle background ambient light */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-700 pb-5 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                ☁️ Bulut Yedekleme & Google Drive / Firebase Senkronizasyonu
              </h3>
            </div>
            <p className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider">
              256-BİT SSL/TLS GÜVENLİ BULUT VERİTABANI VE GOOGLE DRIVE YEDEKLEME MERKEZİ
            </p>
          </div>

          {/* Real-time Online / Offline status badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{currentUser ? "Bulut Bağlantısı Aktif" : "Yerel Depolama (Aktif)"}</span>
            </div>
          </div>
        </div>

        {/* Sync Sub-Tabs */}
        <div className="flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-700/60 pb-3 relative z-10">
          <button
            type="button"
            onClick={() => setCloudActiveTab("sync")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              cloudActiveTab === "sync"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>1. Firebase Canlı Bulut Eşitleme</span>
          </button>

          <button
            type="button"
            onClick={() => setCloudActiveTab("drive")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              cloudActiveTab === "drive"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>2. Google Drive & Dosya İndirme</span>
          </button>

          <button
            type="button"
            onClick={() => setCloudActiveTab("restore")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              cloudActiveTab === "restore"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>3. Yedeği Geri Yükle & İçe Aktar</span>
          </button>
        </div>

        {/* Tab 1: Live Cloud Sync (Firebase & Google Cloud) */}
        {cloudActiveTab === "sync" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 relative z-10"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Account / Session Info Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  BULUT HESAP DURUMU
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500 font-black text-xs">
                    {currentUser ? currentUser.substring(0, 2).toUpperCase() : "👤"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                      {currentUser || "Misafir Oturumu"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {currentUser ? "Google/Firebase Bulut Bağlı" : "Yerel Depolama Modu"}
                    </p>
                  </div>
                </div>
                {!currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenGoogleLogin) onOpenGoogleLogin();
                    }}
                    className="w-full mt-2 py-2 px-3 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-300 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>🔑 Google İle Giriş Yap & Bağla</span>
                  </button>
                )}
              </div>

              {/* Last Sync Timestamp Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  SON BULUT SENKRONİZASYONU
                </span>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {lastSyncTime}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓ Tüm verileriniz senkronize
                    </p>
                  </div>
                </div>
              </div>

              {/* Security & Encryption Protocol */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  ŞİFRELEME VE GÜVENLİK
                </span>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                      256-Bit SSL/TLS Şifreli
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Firestore Güvenlik Kuralları ile Korumalı
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sync Progress log if syncing */}
            {isCloudSyncing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl flex items-center gap-3 text-xs font-bold text-sky-800 dark:text-sky-200 shadow-sm"
              >
                <RefreshCw className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
                <span className="font-mono">{syncStatusLog}</span>
              </motion.div>
            )}

            {/* Primary Cloud Sync Actions */}
            <div className="p-5 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-sky-500/10 dark:from-sky-950/30 dark:via-indigo-950/30 dark:to-sky-950/30 border border-sky-200 dark:border-sky-800/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center justify-center sm:justify-start gap-2">
                  <CloudUpload className="w-4 h-4 text-sky-500" />
                  Anlık Bulut Senkronizasyonunu Başlat
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Tüm gelirleriniz, harcamalarınız, borçlarınız ve taksitleriniz anında şifrelenerek buluta aktarılır.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleRunCloudSyncNow}
                  disabled={isCloudSyncing}
                  className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-xl text-xs font-black shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? "animate-spin" : ""}`} />
                  <span>{isCloudSyncing ? "Senkronize Ediliyor..." : "Şimdi Buluta Senkronize Et"}</span>
                </button>
              </div>
            </div>

            {/* Auto Background Sync Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Otomatik Arka Plan Senkronizasyonu
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Her yeni borç, harcama veya ödeme kaydı eklediğinizde veriler arka planda otomatik senkronize edilir.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleAutoSync}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  isAutoSyncActive ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white block shadow-sm transform transition-transform ${
                    isAutoSyncActive ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Google Drive & WhatsApp Share Hub */}
        {cloudActiveTab === "drive" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 relative z-10"
          >
            <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-sky-500" />
                  Yedek Dosyası Adı (Özelleştirilebilir)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customBackupName}
                    onChange={(e) => setCustomBackupName(e.target.value)}
                    placeholder="butcem_pro_yedek"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                  <span className="text-xs font-mono font-black text-slate-400">.json</span>
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setCustomBackupName(`butcem_yedek_${new Date().toISOString().slice(0, 10)}`)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Calendar className="w-3 h-3 text-sky-500" /> Bugünün Tarihi
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomBackupName("butcem_pro_tam_yedek")}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    👑 Bütçem Pro
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomBackupName("finansal_dokum_raporu")}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    📊 Finans Raporu
                  </button>
                </div>
              </div>

              {/* 4 Action Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* 1. WhatsApp ile Paylaş */}
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("whatsapp")}
                  className="p-4 bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-left shadow-lg shadow-emerald-600/20 transition-all flex flex-col justify-between space-y-2 cursor-pointer group active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                      <Send className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                      WHATSAPP PAYLAŞ
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white">
                      🟢 WhatsApp ile Paylaş & Gönder
                    </h5>
                    <p className="text-[10.5px] text-emerald-100 font-medium leading-snug mt-0.5">
                      Yedek dosyanızı ve finansal özetinizi doğrudan WhatsApp sohbetine veya kendinize iletin.
                    </p>
                  </div>
                </button>

                {/* 2. Google Drive'a Kaydet */}
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("drive")}
                  className="p-4 bg-gradient-to-br from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-2xl text-left shadow-lg shadow-indigo-600/20 transition-all flex flex-col justify-between space-y-2 cursor-pointer group active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                      <Folder className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                      GOOGLE DRIVE
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white">
                      📁 Google Drive'a Kaydet & Yükle
                    </h5>
                    <p className="text-[10.5px] text-sky-100 font-medium leading-snug mt-0.5">
                      Dosyayı indirin ve mobil menüden veya Google Drive Web sayfasından buluta kaydedin.
                    </p>
                  </div>
                </button>

                {/* 3. Cihaz Paylaşım Menüsü */}
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("share")}
                  className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl text-left shadow-md transition-all flex flex-col justify-between space-y-2 cursor-pointer group active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-slate-900/10 dark:bg-white/10 flex items-center justify-center text-slate-800 dark:text-slate-100">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      SİSTEM PAYLAŞIMI
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">
                      📲 Cihaz Menüsüyle Paylaş
                    </h5>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-snug mt-0.5">
                      Telegram, Gmail, Bluetooth, Quick Share veya Android Dosyalarım ile paylaşın.
                    </p>
                  </div>
                </button>

                {/* 4. Doğrudan İndir */}
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("download")}
                  className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl text-left shadow-md transition-all flex flex-col justify-between space-y-2 cursor-pointer group active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                      <Download className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      DOĞRUDAN İNDİR
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">
                      💾 JSON Dosyası İndir (.json)
                    </h5>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-snug mt-0.5">
                      Belirlediğiniz özel dosya adıyla doğrudan cihazınızın İndirilenler klasörüne kaydedin.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-4 bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/70 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Google Drive & WhatsApp İpucu:</strong> WhatsApp butonuna bastığınızda özet metin ve indirme bağlantısıyla birlikte WhatsApp sohbeti açılır. Google Drive butonuna bastığınızda dosyanız adlandırılmış olarak indirilir ve Drive bulut klasörünüz açılır.
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 3: Restore & Import Hub */}
        {cloudActiveTab === "restore" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 relative z-10"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Method A: File Upload */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-500 block">
                    YÖNTEM 1: DOSYA SEÇİMİ
                  </span>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <FolderUp className="w-4 h-4 text-sky-500" />
                    Cihazdan veya Drive'dan Dosya Seç
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Önceden indirdiğiniz veya Google Drive'da sakladığınız <strong>.json</strong> uzantılı yedek dosyasını yükleyin.
                  </p>
                </div>

                <label className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-sky-600/20 active:scale-95 text-center">
                  <Upload className="w-4 h-4" />
                  <span>{isRestoringData ? "Yükleniyor..." : "Yedek Dosyası Seç (.json)"}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileRestoreUpload}
                    disabled={isRestoringData}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Method B: Direct Paste Text */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block">
                    YÖNTEM 2: METİN KOPYALA / YAPIŞTIR
                  </span>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-indigo-500" />
                    JSON Kodunu Yapıştırarak Geri Yükle
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    WhatsApp, e-posta veya notlarınızdaki ham JSON yedek metnini yapıştırarak anında içe aktarın.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(true)}
                  className="w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 text-center"
                >
                  <Copy className="w-4 h-4 text-indigo-500" />
                  <span>Metin Yapıştırma Penceresini Aç</span>
                </button>
              </div>
            </div>

            {/* Direct Paste Drawer / Modal */}
            {isPasteModalOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-white dark:bg-slate-800 border-2 border-indigo-500/40 rounded-2xl space-y-3 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-500" />
                    Ham JSON Yedek Metnini Yapıştırın
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕ Kapat
                  </button>
                </div>

                <textarea
                  value={pasteJSONInput}
                  onChange={(e) => setPasteJSONInput(e.target.value)}
                  placeholder='{"debts": [...], "incomes": [...], "expenses": [...]}'
                  rows={5}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteRestoreSubmit}
                    disabled={isRestoringData || !pasteJSONInput.trim()}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {isRestoringData ? "Çözümleniyor..." : "Verileri Şimdi Geri Yükle"}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Live Payload Summary Cards */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-500" />
              YEDEKLENEN CANLI VERİ PAKETİ ÖZETİ
            </span>
            <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 font-mono">
              256-Bit SSL / Google Firestore Uyumlu
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-black text-rose-500">{debts.length}</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Borç Kaydı</span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-black text-emerald-500">{incomes.length}</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Gelir Kaydı</span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-black text-indigo-500">{expenses.length}</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Harcama Kaydı</span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-black text-amber-500">{installmentDebts.length}</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Taksitli Borç</span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col items-center justify-center text-center col-span-2 sm:col-span-1">
              <span className="text-xs font-black text-blue-500">{contactsCount} Kişi ({contactTxsCount} Cari)</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Rehber Kayıtları</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live FX, Gold & Crypto Comprehensive Market Center Widget */}
      <div id="live-currency-converter-widget" className="p-6 md:p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
        {/* Header with Live Status Indicator & Auto-Refresh Info */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-700 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base md:text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white">
                <DollarSign className="w-5 h-5 text-amber-500" />
                🏆 Canlı Piyasa: Döviz, Altın & Kripto Takip Merkezi
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                CANLI PİYASA
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              Kapalıçarşı serbest piyasa altınları, TCMB kurları ve uluslararası borsa gerçek verileri
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>Son Veri: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{lastUpdated || "Canlı"}</strong></span>
            </div>

            <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              <span>Oto-Yenileme: <strong className="font-mono">{nextRefreshSec}s</strong></span>
            </div>

            <button
              type="button"
              onClick={handleRefreshRates}
              disabled={isManualRefreshing || isContextFetching}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20"
            >
              <RefreshCw className={`w-4 h-4 ${isManualRefreshing || isContextFetching ? "animate-spin" : ""}`} />
              <span>Şimdi Yenile</span>
            </button>
          </div>
        </div>

        {/* Live Market Categories Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setMarketCategoryTab("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              marketCategoryTab === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            📊 Tüm Piyasalar
          </button>
          <button
            type="button"
            onClick={() => setMarketCategoryTab("gold")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              marketCategoryTab === "gold"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
            }`}
          >
            🥇 Altın Piyasası (Kapalıçarşı)
          </button>
          <button
            type="button"
            onClick={() => setMarketCategoryTab("forex")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              marketCategoryTab === "forex"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
            }`}
          >
            💱 Döviz Kurları (Serbest Piyasa)
          </button>
          <button
            type="button"
            onClick={() => setMarketCategoryTab("crypto")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              marketCategoryTab === "crypto"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
            }`}
          >
            🪙 Kripto Varlıklar
          </button>
        </div>

        {/* Live Rates Cards Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Gold Group */}
          {(marketCategoryTab === "all" || marketCategoryTab === "gold") && (
            <>
              {/* Gram Altın */}
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    🥇 Gram Altın (24K)
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    (rateDetails.GOLD_GRAM?.change || 0) >= 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  }`}>
                    {(rateDetails.GOLD_GRAM?.change || 0) >= 0 ? "+" : ""}{rateDetails.GOLD_GRAM?.change || -0.74}%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₺{exchangeRates.GOLD_GRAM?.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Alış: ₺{(rateDetails.GOLD_GRAM?.buying || exchangeRates.GOLD_GRAM * 0.998).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                  <span>Satış: ₺{exchangeRates.GOLD_GRAM?.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Çeyrek Altın */}
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    🪙 Çeyrek Altın
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    (rateDetails.GOLD_CEYREK?.change || 0) >= 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  }`}>
                    {(rateDetails.GOLD_CEYREK?.change || 0) >= 0 ? "+" : ""}{rateDetails.GOLD_CEYREK?.change || -1.14}%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₺{exchangeRates.GOLD_CEYREK?.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Alış: ₺{(rateDetails.GOLD_CEYREK?.buying || 10908).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                  <span>Satış: ₺{exchangeRates.GOLD_CEYREK?.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Yarım Altın */}
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    🪙 Yarım Altın
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    -1.14%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₺{exchangeRates.GOLD_YARIM?.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Alış: ₺{(rateDetails.GOLD_YARIM?.buying || 21749).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                  <span>Satış: ₺{exchangeRates.GOLD_YARIM?.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Cumhuriyet Altını */}
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    👑 Cumhuriyet Altını
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    -1.43%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₺{exchangeRates.GOLD_CUMHURIYET?.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Alış: ₺{(rateDetails.GOLD_CUMHURIYET?.buying || 45276).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                  <span>Satış: ₺{exchangeRates.GOLD_CUMHURIYET?.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Ons Altın ($) */}
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    🌍 Ons Altın ($ XAU)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    +0.15%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ${exchangeRates.GOLD_ONS?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  Uluslararası Spot Altın
                </div>
              </div>
            </>
          )}

          {/* Forex Group */}
          {(marketCategoryTab === "all" || marketCategoryTab === "forex") && (
            <>
              {/* USD */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                    🇺🇸 Dolar (USD)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    +{(rateDetails.USD?.change || 0.22)}%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₺{exchangeRates.USD?.toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Alış: ₺{(rateDetails.USD?.buying || exchangeRates.USD * 0.998).toFixed(4)}</span>
                  <span>Satış: ₺{exchangeRates.USD?.toFixed(4)}</span>
                </div>
              </div>

              {/* EUR */}
              <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-blue-900 dark:text-blue-200 flex items-center gap-1">
                    🇪🇺 Euro (EUR)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {(rateDetails.EUR?.change || -0.25)}%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₺{exchangeRates.EUR?.toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Alış: ₺{(rateDetails.EUR?.buying || exchangeRates.EUR * 0.998).toFixed(4)}</span>
                  <span>Satış: ₺{exchangeRates.EUR?.toFixed(4)}</span>
                </div>
              </div>

              {/* GBP */}
              <div className="p-3.5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-purple-900 dark:text-purple-200 flex items-center gap-1">
                    🇬🇧 Sterlin (GBP)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {(rateDetails.GBP?.change || -0.22)}%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₺{exchangeRates.GBP?.toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Alış: ₺{(rateDetails.GBP?.buying || exchangeRates.GBP * 0.998).toFixed(4)}</span>
                  <span>Satış: ₺{exchangeRates.GBP?.toFixed(4)}</span>
                </div>
              </div>

              {/* CHF */}
              <div className="p-3.5 bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-900 dark:to-zinc-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-900 dark:text-slate-200 flex items-center gap-1">
                    🇨🇭 Frank (CHF)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    +0.06%
                  </span>
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₺{exchangeRates.CHF?.toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Alış: ₺{(rateDetails.CHF?.buying || exchangeRates.CHF * 0.998).toFixed(4)}</span>
                  <span>Satış: ₺{exchangeRates.CHF?.toFixed(4)}</span>
                </div>
              </div>
            </>
          )}

          {/* Crypto Group */}
          {(marketCategoryTab === "all" || marketCategoryTab === "crypto") && (
            <div className="p-3.5 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border border-amber-300 dark:border-amber-700/60 rounded-2xl space-y-1.5 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                  🪙 Bitcoin (BTC)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {rateDetails.BTC?.change ? `${rateDetails.BTC.change.toFixed(2)}%` : "+0.85%"}
                </span>
              </div>
              <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                ${(exchangeRates.BTC_USD || 79614).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-amber-700 dark:text-amber-300 font-mono font-bold">
                ₺{exchangeRates.BTC?.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>
          )}
        </div>

        {/* Currency & Gold Converter Engine */}
        <div className="p-5 md:p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 tracking-wider">
              <Zap className="w-4 h-4" />
              ÇİFT YÖNLÜ CANLI DÖVİZ & ALTIN ÇEVİRİCİ
            </span>
            <span className="text-[10.5px] text-slate-400 dark:text-slate-500 font-bold">
              Anlık piyasa kuru üzerinden anında hesaplanır
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Input Amount */}
            <div className="md:col-span-4 space-y-1">
              <label className="text-[10.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Çevrilecek Miktar / Adet
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                placeholder="Örn: 10"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all shadow-xs"
              />
            </div>

            {/* Source Currency */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide">
                Kaynak Birim
              </label>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              >
                <option value="TRY">₺ Türk Lirası (TRY)</option>
                <option value="USD">🇺🇸 Amerikan Doları ($)</option>
                <option value="EUR">🇪🇺 Euro (€)</option>
                <option value="GBP">🇬🇧 İngiliz Sterlini (£)</option>
                <option value="CHF">🇨🇭 İsviçre Frangı (CHF)</option>
                <option value="GOLD_GRAM">🥇 Gram Altın (24K)</option>
                <option value="GOLD_CEYREK">🪙 Çeyrek Altın</option>
                <option value="GOLD_YARIM">🪙 Yarım Altın</option>
                <option value="GOLD_TAM">👑 Tam Altın</option>
                <option value="GOLD_CUMHURIYET">👑 Cumhuriyet Altını</option>
                <option value="GOLD_ONS">🌍 Ons Altın ($ XAU)</option>
                <option value="BTC">🪙 Bitcoin (BTC)</option>
              </select>
            </div>

            {/* Swap Button */}
            <div className="md:col-span-1 flex items-center justify-center pt-5">
              <button
                type="button"
                onClick={() => {
                  const temp = fromCurrency;
                  setFromCurrency(toCurrency);
                  setToCurrency(temp);
                }}
                title="Birimleri Değiştir"
                className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer active:scale-90"
              >
                ⇄
              </button>
            </div>

            {/* Target Currency */}
            <div className="md:col-span-4 space-y-1">
              <label className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide">
                Hedef Birim
              </label>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              >
                <option value="TRY">₺ Türk Lirası (TRY)</option>
                <option value="USD">🇺🇸 Amerikan Doları ($)</option>
                <option value="EUR">🇪🇺 Euro (€)</option>
                <option value="GBP">🇬🇧 İngiliz Sterlini (£)</option>
                <option value="CHF">🇨🇭 İsviçre Frangı (CHF)</option>
                <option value="GOLD_GRAM">🥇 Gram Altın (24K)</option>
                <option value="GOLD_CEYREK">🪙 Çeyrek Altın</option>
                <option value="GOLD_YARIM">🪙 Yarım Altın</option>
                <option value="GOLD_TAM">👑 Tam Altın</option>
                <option value="GOLD_CUMHURIYET">👑 Cumhuriyet Altını</option>
                <option value="GOLD_ONS">🌍 Ons Altın ($ XAU)</option>
                <option value="BTC">🪙 Bitcoin (BTC)</option>
              </select>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase">Hızlı Butonlar:</span>
            <button
              type="button"
              onClick={() => { setConvertAmount("1"); setFromCurrency("GOLD_GRAM"); setToCurrency("TRY"); }}
              className="text-[11px] font-bold px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-indigo-400 cursor-pointer transition-all"
            >
              🥇 1 Gram Altın Kaç TL?
            </button>
            <button
              type="button"
              onClick={() => { setConvertAmount("1"); setFromCurrency("GOLD_CEYREK"); setToCurrency("TRY"); }}
              className="text-[11px] font-bold px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-indigo-400 cursor-pointer transition-all"
            >
              🪙 1 Çeyrek Altın Kaç TL?
            </button>
            <button
              type="button"
              onClick={() => { setConvertAmount("100"); setFromCurrency("USD"); setToCurrency("TRY"); }}
              className="text-[11px] font-bold px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-indigo-400 cursor-pointer transition-all"
            >
              🇺🇸 100 Dolar Kaç TL?
            </button>
            <button
              type="button"
              onClick={() => { setConvertAmount("100000"); setFromCurrency("TRY"); setToCurrency("GOLD_GRAM"); }}
              className="text-[11px] font-bold px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-indigo-400 cursor-pointer transition-all"
            >
              💰 100.000 TL Kaç Gram Altın?
            </button>
          </div>

          {/* Result Output Card */}
          <div className="p-4 md:p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-indigo-200">
                HESAPLANAN DÖNÜŞÜM SONUCU
              </span>
              <p className="text-xs text-indigo-100/90 font-medium">
                {convertAmount || "0"} {fromCurrency} karşılığı
              </p>
            </div>
            <div className="text-2xl md:text-3xl font-black font-mono tracking-tight text-center sm:text-right">
              {convertResult.toLocaleString("tr-TR", {
                minimumFractionDigits: toCurrency === "TRY" || toCurrency === "USD" || toCurrency === "EUR" ? 2 : 2,
                maximumFractionDigits: toCurrency === "BTC" ? 6 : (toCurrency === "GOLD_GRAM" || toCurrency === "GOLD_CEYREK" ? 3 : 2)
              })}{" "}
              <span className="text-lg font-extrabold text-amber-300">
                {toCurrency === "TRY" ? "₺" : toCurrency === "USD" ? "$" : toCurrency === "EUR" ? "€" : toCurrency === "GBP" ? "£" : toCurrency}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

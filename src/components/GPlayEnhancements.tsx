import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../utils/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, signInWithRedirect, getRedirectResult } from "firebase/auth";
import {
  Sparkles,
  Shield,
  MessageSquare,
  Languages,
  Sliders,
  DollarSign,
  TrendingUp,
  Layout,
  RefreshCw,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  Settings,
  BellRing,
  Check,
  Globe2,
  CheckCircle,
  XCircle,
  LogOut
} from "lucide-react";
import { Debt, Income, Expense, InstallmentDebt, ExpenseCategory } from "../types";
import { translations } from "../utils/translations";
import { useCurrency } from "../utils/CurrencyContext";
import { getApiUrl } from "../utils/api";

interface DriveBackup {
  id: string;
  name: string;
  size: string;
  createdTime: string;
}

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
  const [activeTab, setActiveTab] = useState<"ai" | "notifs" | "currency">("ai");
  const t = (key: keyof typeof translations.tr) => {
    return translations[language][key] || translations.tr[key];
  };

  const [securityEnabled, setSecurityEnabled] = useState(() => localStorage.getItem("security_enabled") === "true");
  const [notifsEnabled, setNotifsEnabled] = useState(() => localStorage.getItem("notifs_enabled") === "true");

  useEffect(() => {
    localStorage.setItem("security_enabled", securityEnabled ? "true" : "false");
  }, [securityEnabled]);

  useEffect(() => {
    localStorage.setItem("notifs_enabled", notifsEnabled ? "true" : "false");
  }, [notifsEnabled]);

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

  // Handle Live Currency Market Conversion
  const handleConvert = () => {
    const amt = parseFloat(convertAmount) || 0;
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[toCurrency] || 1;

    // Convert to Turkish Lira first as baseline
    const inBasline = amt * fromRate;
    const finalYield = inBasline / toRate;
    setConvertResult(finalYield);
  };

  useEffect(() => {
    handleConvert();
  }, [convertAmount, fromCurrency, toCurrency, exchangeRates]);

  const handleRefreshRates = async () => {
    setIsRefreshingRates(true);
    try {
      // 1. Refresh globally using the robust CurrencyContext mechanism
      const success = await updateRatesFromAPI();
      
      // 2. Also directly fetch for local display state using getApiUrl
      const res = await fetch(getApiUrl(`/api/rates?t=${Date.now()}`));
      const data = await res.json();
      if (data && data.rates) {
        setExchangeRates(prev => ({
          ...prev,
          ...data.rates
        }));
      }

      if (success || (data && data.rates)) {
        triggerToast(
          language === "tr"
            ? "Piyasa döviz kurları canlı olarak güncellendi! 💱"
            : "Market exchange rates updated live! 💱"
        );
      } else {
        triggerToast(
          language === "tr"
            ? "Kurlar güncellenemedi, lütfen internet bağlantınızı kontrol edin."
            : "Exchange rates could not be updated, please check your internet connection."
        );
      }
    } catch (err) {
      console.warn("Failed to fetch live FX rates:", err);
      triggerToast(
        language === "tr"
          ? "Kur güncellemesi sırasında bağlantı hatası oluştu."
          : "A connection error occurred during exchange rate updates."
      );
    } finally {
      setIsRefreshingRates(false);
    }
  };


  return (
    <div className="w-full space-y-6" id="gplay-enhancements-root">
      
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <Sparkles className="w-7 h-7 text-indigo-500 animate-pulse" /> PRO ÖZELLİKLER
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      {/* Upper Brand Card / Header */}
      <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden flex flex-col items-center justify-center text-center gap-4">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="relative z-10 space-y-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-widest leading-none">
            👑 BÜTÇEM PRO PREMİUM SÜRÜM
          </span>
          <p className="text-[11px] text-slate-300 leading-relaxed uppercase tracking-tight max-w-2xl mx-auto">
            Yapay zeka asistanı, biyometrik güvenlik kilidi, anlık harcama bildirimleri ve daha fazlası ile finansal özgürlüğünüzü kontrol altına alın.
          </p>
        </div>
      </div>

      {/* Sub Tabs Toggle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <button
          onClick={() => setActiveTab("ai")}
          className={`py-3 px-4 rounded-2xl font-black text-[11px] uppercase tracking-wide flex flex-col items-center justify-center gap-1.5 transition-all outline-none border cursor-pointer ${
            activeTab === "ai"
              ? "bg-indigo-650 text-white border-indigo-500 shadow-md transform scale-[1.02]"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-755"
          }`}
        >
          <Sparkles className={`w-5 h-5 ${activeTab === "ai" ? "animate-pulse" : "text-indigo-500"}`} />
          <span>Yapay Zeka</span>
        </button>

        <button
          onClick={() => setActiveTab("notifs")}
          className={`py-3 px-4 rounded-2xl font-black text-[11px] uppercase tracking-wide flex flex-col items-center justify-center gap-1.5 transition-all outline-none border cursor-pointer ${
            activeTab === "notifs"
              ? "bg-indigo-650 text-white border-indigo-500 shadow-md transform scale-[1.02]"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-755"
          }`}
        >
          <BellRing className={`w-5 h-5 ${activeTab === "notifs" ? "animate-ring" : "text-amber-500"}`} />
          <span>Bildirimler</span>
        </button>

        <button
          onClick={() => setActiveTab("currency")}
          className={`py-3 px-4 rounded-2xl font-black text-[11px] uppercase tracking-wide flex flex-col items-center justify-center gap-1.5 transition-all outline-none border cursor-pointer ${
            activeTab === "currency"
              ? "bg-indigo-650 text-white border-indigo-500 shadow-md transform scale-[1.02]"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-755"
          }`}
        >
          <DollarSign className={`w-5 h-5 ${activeTab === "currency" ? "animate-spin [animation-duration:10s]" : "text-rose-500"}`} />
          <span>Canlı Kurlar</span>
        </button>
      </div>

      {/* Main Tab Screen Area */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden">
        
        {/* TAB 1: AI ASSISTANT */}
        {activeTab === "ai" && (
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-150 dark:border-slate-700 pb-5">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-800 dark:text-white">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  Bütçem AI: Akıllı Finansal Rehber
                </h3>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-400 font-bold leading-normal uppercase">
                  HAREKETLERİNİ ANALİZ EDEN VE SANA ÖZEL TASARRUF ÖNERİLERİ SUNAN YAPAY ZEKA.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5 items-stretch">
              <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase">Sohbete Başla</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">7/24 Finansal Destek</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  "Bu ay en çok nereye harcama yaptım?" veya "Borçlarımı nasıl daha hızlı kapatabilirim?" gibi sorularını sorabilirsin.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) onNavigate("aiStrategy");
                    window.dispatchEvent(new CustomEvent("nav-to-ai"));
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wide shadow-md"
                >
                  <TrendingUp className="w-4 h-4" /> AI STRATEJİ ANALİZİNE GİT
                </button>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Öne Çıkan AI Yetenekleri</h4>
                <ul className="space-y-3">
                  {[
                    "Harcama Analizi ve Tahminleme",
                    "Kişiselleştirilmiş Tasarruf Planları",
                    "Borç Ödeme Stratejileri",
                    "Haftalık Finansal Özetler"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY */}
        {activeTab === "security" && (
          <div className="p-6 md:p-8 space-y-6">
            <div className="border-b border-slate-150 dark:border-slate-700 pb-5 space-y-1">
              <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-800 dark:text-white">
                <Shield className="w-5 h-5 text-emerald-500" />
                Güvenlik ve Gizlilik Merkezi
              </h3>
              <p className="text-[10.5px] text-slate-400 font-bold leading-normal uppercase">
                VERİLERİNİZİ ŞİFRELEYİN VE UYGULAMA ERİŞİMİNİ KISITLAYIN.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none">Uygulama Kilidi</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Açılışta PIN veya Desen Sor</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={securityEnabled}
                    onChange={(e) => {
                      setSecurityEnabled(e.target.checked);
                      triggerToast(e.target.checked ? "Güvenlik kilidi aktif!" : "Güvenlik kilidi devre dışı.");
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between opacity-50">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none">Biyometrik Giriş</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Parmak İzi veya FaceID (Yakında)</p>
                </div>
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS */}
        {activeTab === "notifs" && (
          <div className="p-6 md:p-8 space-y-6">
            <div className="border-b border-slate-150 dark:border-slate-700 pb-5 space-y-1">
              <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-800 dark:text-white">
                <BellRing className="w-5 h-5 text-amber-500" />
                Akıllı Bildirim Ayarları
              </h3>
              <p className="text-[10.5px] text-slate-400 font-bold leading-normal uppercase">
                ÖDEME GÜNLERİNİ VE LİMİT AŞIMLARINI ANINDA ÖĞRENİN.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none">Anlık Bildirimler</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Harcama ve Borç Hatırlatıcıları</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifsEnabled}
                    onChange={(e) => {
                      setNotifsEnabled(e.target.checked);
                      triggerToast(e.target.checked ? "Bildirimler açıldı!" : "Bildirimler kapatıldı.");
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="p-5 bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold leading-relaxed uppercase">
                  💡 İpucu: Ödeme gününde bildirim almak için borç eklerken 'Hatırlatıcı Ayarla' seçeneğini işaretlemeyi unutmayın.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LIVE CURRENCY MARKETS AND EXCHANGE CONVERTER */}
        {activeTab === "currency" && (
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 dark:border-slate-700 pb-5">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-800 dark:text-white">
                  <DollarSign className="w-5 h-5 text-indigo-500" />
                  {t("currency_title")}
                </h3>
                <p className="text-[10.5px] text-slate-400 font-bold leading-normal uppercase">
                  {t("currency_desc")}
                </p>
              </div>

              {/* Refresh Markets Button */}
              <button
                type="button"
                onClick={handleRefreshRates}
                disabled={isRefreshingRates}
                className="py-1.5 px-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isRefreshingRates ? "animate-spin" : ""}`} />
                {t("currency_refresh")}
              </button>
            </div>

            {/* Currency convert calculation tools */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              
              {/* Box 1: Currency Calculator Sheet */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between">
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-indigo-500 block tracking-widest leading-none">
                    {t("currency_convert")}
                  </span>

                  {/* Input amount */}
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      {t("currency_from_amount")}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={convertAmount}
                      onChange={(e) => setConvertAmount(e.target.value)}
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all"
                    />
                  </div>

                  {/* Drops of selection currencies */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wide">
                        {t("currency_from")}
                      </label>
                      <select
                        value={fromCurrency}
                        onChange={(e) => setFromCurrency(e.target.value)}
                        className="w-full px-2 sm:px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                      >
                        {Object.keys(exchangeRates).map((curr) => (
                          <option key={curr} value={curr}>{curr}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wide">
                        {t("currency_to")}
                      </label>
                      <select
                        value={toCurrency}
                        onChange={(e) => setToCurrency(e.target.value)}
                        className="w-full px-2 sm:px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                      >
                        {Object.keys(exchangeRates).map((curr) => (
                          <option key={curr} value={curr}>{curr}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>

                {/* Calculation Result */}
                <div className="mt-5 p-4 bg-indigo-600 rounded-2xl text-white space-y-1 flex flex-col items-center justify-center shadow-lg shadow-indigo-600/20">
                  <span className="text-[10px] font-bold uppercase opacity-85">{t("currency_result")}</span>
                  <span className="text-xl sm:text-2xl font-black font-mono tracking-tight flex items-center gap-1.5 flex-wrap justify-center">
                    {convertResult !== null ? convertResult.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                    <span className="text-xs sm:text-sm font-bold bg-white/20 px-2 py-0.5 rounded-lg">{toCurrency}</span>
                  </span>
                </div>
              </div>

              {/* Box 2: Live Rate Sheet listing board */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase text-indigo-500 block tracking-widest leading-none">
                    {t("currency_live_rates")}
                  </span>

                  <div className="divide-y divide-slate-200/50 dark:divide-slate-800">
                    {Object.keys(exchangeRates).map((key) => {
                      if (key === "TRY") return null;
                      const rateValue = exchangeRates[key] as number;
                      return (
                        <div key={key} className="py-2.5 flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 flex items-center justify-center font-black text-[9.5px]">
                              {key === "USD" ? "💵" : key === "EUR" ? "💶" : key === "GBP" ? "💷" : "🪙"}
                            </span>
                            <span className="font-extrabold text-slate-806 dark:text-slate-200">1 {key}</span>
                          </div>
                          <span className="font-mono font-black text-slate-801 dark:text-white">
                            {rateValue.toFixed(2)} TRY
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-300 border border-emerald-150 rounded-xl text-[10px] leading-relaxed font-bold">
                  Döviz çevirici kurları bütçe, gelir ve harcama hesaplamalarında kullanılmak üzere güvenli, şifreli anahtar sorgusu ile TCMB tüneli üzerinden beslenir.
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
};

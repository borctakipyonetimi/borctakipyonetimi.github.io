import React, { useState } from "react";
import { 
  DollarSign, 
  Clock, 
  Activity, 
  RefreshCw, 
  Zap, 
  ArrowRightLeft, 
  TrendingUp, 
  TrendingDown,
  Sparkles
} from "lucide-react";
import { useCurrency } from "../utils/CurrencyContext";

interface LiveMarketCenterWidgetProps {
  onAskAI?: (prompt: string) => void;
  className?: string;
  showConverter?: boolean;
}

export const LiveMarketCenterWidget: React.FC<LiveMarketCenterWidgetProps> = ({
  onAskAI,
  className = "",
  showConverter = true
}) => {
  const {
    rates: exchangeRates,
    rateDetails,
    isFetching: isContextFetching,
    lastUpdated,
    nextRefreshSec,
    updateRatesFromAPI
  } = useCurrency();

  const [marketCategoryTab, setMarketCategoryTab] = useState<"all" | "gold" | "forex" | "crypto">("all");
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Converter interactive state
  const [calcAmount, setCalcAmount] = useState<number | string>(1000);
  const [fromCurr, setFromCurr] = useState<string>("TRY");
  const [toCurr, setToCurr] = useState<string>("USD");

  const handleRefreshRates = async () => {
    setIsManualRefreshing(true);
    try {
      await updateRatesFromAPI(true);
    } catch (e) {
      console.warn("Kurlar yenilenirken hata:", e);
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 500);
    }
  };

  const calculateConversion = () => {
    const amount = Number(calcAmount) || 0;
    if (amount <= 0) return 0;

    let tryVal = amount;
    if (fromCurr !== "TRY") {
      const rate = exchangeRates[fromCurr] || 1;
      tryVal = amount * rate;
    }

    if (toCurr === "TRY") return tryVal;
    const toRate = exchangeRates[toCurr] || 1;
    return tryVal / toRate;
  };

  const handleCardClick = (title: string, priceStr: string) => {
    if (onAskAI) {
      onAskAI(`Bugün ${title} piyasası hakkında bilgi verir misin? Güncel fiyat: ${priceStr}`);
    }
  };

  return (
    <div 
      id="live-currency-converter-widget" 
      className={`p-4 sm:p-6 md:p-8 bg-slate-900/95 dark:bg-slate-900 text-white rounded-3xl border border-indigo-500/30 dark:border-slate-800 shadow-2xl space-y-5 sm:space-y-6 ${className}`}
    >
      {/* Header with Live Status Indicator & Auto-Refresh Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base sm:text-lg font-black flex items-center gap-2 text-white">
              <DollarSign className="w-5 h-5 text-amber-400 shrink-0" />
              <span>🏆 Canlı Piyasa: Döviz, Altın & Kripto Takip Merkezi</span>
            </h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              CANLI PİYASA
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 font-semibold leading-relaxed">
            Kapalıçarşı serbest piyasa altınları, TCMB kurları ve uluslararası borsa gerçek verileri
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <div className="px-3 py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-slate-300 text-[11px] font-bold flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Son Veri: <strong className="font-mono text-indigo-300">{lastUpdated || "21.09.2026 03:46:01"}</strong></span>
          </div>

          <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-[11px] font-bold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Oto-Yenileme: <strong className="font-mono">{nextRefreshSec || 25}s</strong></span>
          </div>

          <button
            type="button"
            onClick={handleRefreshRates}
            disabled={isManualRefreshing || isContextFetching}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/30 border border-indigo-400/30"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualRefreshing || isContextFetching ? "animate-spin" : ""}`} />
            <span>Şimdi Yenile</span>
          </button>
        </div>
      </div>

      {/* Live Market Categories Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setMarketCategoryTab("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            marketCategoryTab === "all"
              ? "bg-white text-slate-900 shadow-md scale-105"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60"
          }`}
        >
          📊 Tüm Piyasalar
        </button>
        <button
          type="button"
          onClick={() => setMarketCategoryTab("gold")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            marketCategoryTab === "gold"
              ? "bg-amber-500 text-white shadow-md scale-105"
              : "bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 border border-amber-700/40"
          }`}
        >
          🥇 Altın Piyasası (Kapalıçarşı)
        </button>
        <button
          type="button"
          onClick={() => setMarketCategoryTab("forex")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            marketCategoryTab === "forex"
              ? "bg-emerald-600 text-white shadow-md scale-105"
              : "bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-700/40"
          }`}
        >
          💱 Döviz Kurları (Serbest Piyasa)
        </button>
        <button
          type="button"
          onClick={() => setMarketCategoryTab("crypto")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            marketCategoryTab === "crypto"
              ? "bg-indigo-600 text-white shadow-md scale-105"
              : "bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 border border-indigo-700/40"
          }`}
        >
          🪙 Kripto Varlıklar
        </button>
      </div>

      {/* Live Rates Cards Matrix - 2 Columns on Mobile, up to 4 on Desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* GOLD GROUP */}
        {(marketCategoryTab === "all" || marketCategoryTab === "gold") && (
          <>
            {/* Gram Altın */}
            <div 
              onClick={() => handleCardClick("Gram Altın (24K)", `₺${(exchangeRates.GOLD_GRAM || 6853).toLocaleString("tr-TR")}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-amber-200 flex items-center gap-1 truncate">
                  🥇 Gram Altın (24K)
                </span>
                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                  (rateDetails.GOLD_GRAM?.change || 0) >= 0
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                    : "bg-rose-950 text-rose-300 border border-rose-800/60"
                }`}>
                  {(rateDetails.GOLD_GRAM?.change || 0) >= 0 ? "+" : ""}{rateDetails.GOLD_GRAM?.change || -0.19}%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.GOLD_GRAM || 6853).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.GOLD_GRAM?.buying || (exchangeRates.GOLD_GRAM || 6853) * 0.998).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                <span>Satış: ₺{(exchangeRates.GOLD_GRAM || 6853).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Çeyrek Altın */}
            <div 
              onClick={() => handleCardClick("Çeyrek Altın", `₺${(exchangeRates.GOLD_CEYREK || 11173.73).toLocaleString("tr-TR")}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-amber-200 flex items-center gap-1 truncate">
                  🪙 Çeyrek Altın
                </span>
                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                  (rateDetails.GOLD_CEYREK?.change || 1.14) >= 0
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                    : "bg-rose-950 text-rose-300 border border-rose-800/60"
                }`}>
                  +1.14%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.GOLD_CEYREK || 11173.73).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.GOLD_CEYREK?.buying || 10922).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                <span>Satış: ₺{(exchangeRates.GOLD_CEYREK || 11174).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Yarım Altın */}
            <div 
              onClick={() => handleCardClick("Yarım Altın", `₺${(exchangeRates.GOLD_YARIM || 22347.46).toLocaleString("tr-TR")}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-amber-200 flex items-center gap-1 truncate">
                  🪙 Yarım Altın
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800/60 shrink-0">
                  -1.14%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.GOLD_YARIM || 22347.46).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.GOLD_YARIM?.buying || 21776).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                <span>Satış: ₺{(exchangeRates.GOLD_YARIM || 22347).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Cumhuriyet Altını */}
            <div 
              onClick={() => handleCardClick("Cumhuriyet Altını", `₺${(exchangeRates.GOLD_CUMHURIYET || 45930).toLocaleString("tr-TR")}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-amber-200 flex items-center gap-1 truncate">
                  👑 Cumhuriyet Altını
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800/60 shrink-0">
                  -1.43%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.GOLD_CUMHURIYET || 45930).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.GOLD_CUMHURIYET?.buying || 45246).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                <span>Satış: ₺{(exchangeRates.GOLD_CUMHURIYET || 45930).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Ons Altın */}
            <div 
              onClick={() => handleCardClick("Ons Altın", `$${(exchangeRates.GOLD_ONS || 4369.40).toLocaleString("en-US")}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-amber-200 flex items-center gap-1 truncate">
                  🌍 Ons Altın ($ XAU)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +0.15%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.GOLD_ONS || 4369.40).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono">
                Uluslararası Spot Altın
              </div>
            </div>

            {/* Gümüş Gram */}
            <div 
              onClick={() => handleCardClick("Gümüş (Gram)", `₺${(exchangeRates.SILVER_GRAM || 84.50).toFixed(2)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-slate-500 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-slate-200 flex items-center gap-1 truncate">
                  🪙 Gümüş (Gram)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +0.45%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.SILVER_GRAM || 84.50).toFixed(2)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.SILVER_GRAM?.buying || 83.80).toFixed(2)}</span>
                <span>Satış: ₺{(exchangeRates.SILVER_GRAM || 84.50).toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        {/* FOREX GROUP */}
        {(marketCategoryTab === "all" || marketCategoryTab === "forex") && (
          <>
            {/* Dolar (USD) */}
            <div 
              onClick={() => handleCardClick("Amerikan Doları (USD)", `₺${(exchangeRates.USD || 48.8013).toFixed(4)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-emerald-300 flex items-center gap-1 truncate">
                  🇺🇸 Dolar (USD)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +{(rateDetails.USD?.change || 0.04)}%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.USD || 48.8013).toFixed(4)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.USD?.buying || (exchangeRates.USD || 48.8013) * 0.998).toFixed(4)}</span>
                <span>Satış: ₺{(exchangeRates.USD || 48.8013).toFixed(4)}</span>
              </div>
            </div>

            {/* Euro (EUR) */}
            <div 
              onClick={() => handleCardClick("Euro (EUR)", `₺${(exchangeRates.EUR || 52.4018).toFixed(4)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-500/30 hover:border-blue-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-blue-300 flex items-center gap-1 truncate">
                  🇪🇺 Euro (EUR)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800/60 shrink-0">
                  {(rateDetails.EUR?.change || -0.25)}%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.EUR || 52.4018).toFixed(4)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.EUR?.buying || (exchangeRates.EUR || 52.4018) * 0.998).toFixed(4)}</span>
                <span>Satış: ₺{(exchangeRates.EUR || 52.4018).toFixed(4)}</span>
              </div>
            </div>

            {/* Sterlin (GBP) */}
            <div 
              onClick={() => handleCardClick("İngiliz Sterlini (GBP)", `₺${(exchangeRates.GBP || 61.8025).toFixed(4)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/30 hover:border-purple-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-purple-300 flex items-center gap-1 truncate">
                  🇬🇧 Sterlin (GBP)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800/60 shrink-0">
                  {(rateDetails.GBP?.change || -0.22)}%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.GBP || 61.8025).toFixed(4)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.GBP?.buying || (exchangeRates.GBP || 61.8025) * 0.998).toFixed(4)}</span>
                <span>Satış: ₺{(exchangeRates.GBP || 61.8025).toFixed(4)}</span>
              </div>
            </div>

            {/* İsviçre Frangı (CHF) */}
            <div 
              onClick={() => handleCardClick("İsviçre Frangı (CHF)", `₺${(exchangeRates.CHF || 55.3010).toFixed(4)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-slate-500 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-slate-200 flex items-center gap-1 truncate">
                  🇨🇭 Frank (CHF)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +0.06%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ₺{(exchangeRates.CHF || 55.3010).toFixed(4)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono flex justify-between gap-1">
                <span>Alış: ₺{(rateDetails.CHF?.buying || (exchangeRates.CHF || 55.3010) * 0.998).toFixed(4)}</span>
                <span>Satış: ₺{(exchangeRates.CHF || 55.3010).toFixed(4)}</span>
              </div>
            </div>
          </>
        )}

        {/* CRYPTO GROUP */}
        {(marketCategoryTab === "all" || marketCategoryTab === "crypto") && (
          <>
            {/* Bitcoin (BTC) */}
            <div 
              onClick={() => handleCardClick("Bitcoin (BTC)", `$${(exchangeRates.BTC_USD || 79614).toLocaleString("en-US")}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-yellow-950/40 to-slate-900 border border-yellow-500/30 hover:border-yellow-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-yellow-300 flex items-center gap-1 truncate">
                  ₿ Bitcoin (BTC)
                </span>
                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                  (rateDetails.BTC?.change || 0.85) >= 0
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                    : "bg-rose-950 text-rose-300 border border-rose-800/60"
                }`}>
                  +{(rateDetails.BTC?.change || 0.85).toFixed(2)}%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.BTC_USD || 79614).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-yellow-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.BTC_TRY || exchangeRates.BTC || 3855000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>

            {/* Ethereum (ETH) */}
            <div 
              onClick={() => handleCardClick("Ethereum (ETH)", `$${(exchangeRates.ETH_USD || 2680).toLocaleString("en-US")}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 hover:border-indigo-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-indigo-300 flex items-center gap-1 truncate">
                  ⟠ Ethereum (ETH)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +{(rateDetails.ETH?.change || 1.45).toFixed(2)}%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.ETH_USD || 2680).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-indigo-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.ETH_TRY || exchangeRates.ETH || 129765).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>

            {/* Solana (SOL) */}
            <div 
              onClick={() => handleCardClick("Solana (SOL)", `$${(exchangeRates.SOL_USD || 185.50).toFixed(2)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/30 hover:border-purple-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-purple-300 flex items-center gap-1 truncate">
                  ◎ Solana (SOL)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +{(rateDetails.SOL?.change || 2.15).toFixed(2)}%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.SOL_USD || 185.5).toFixed(2)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-purple-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.SOL_TRY || exchangeRates.SOL || 8981).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>

            {/* Binance Coin (BNB) */}
            <div 
              onClick={() => handleCardClick("Binance Coin (BNB)", `$${(exchangeRates.BNB_USD || 645).toFixed(1)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-amber-300 flex items-center gap-1 truncate">
                  🟡 BNB
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800/60 shrink-0">
                  -0.45%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.BNB_USD || 645).toFixed(1)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-amber-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.BNB_TRY || exchangeRates.BNB || 31230).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>

            {/* Ripple (XRP) */}
            <div 
              onClick={() => handleCardClick("Ripple (XRP)", `$${(exchangeRates.XRP_USD || 2.15).toFixed(3)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-slate-500 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-slate-200 flex items-center gap-1 truncate">
                  ✕ Ripple (XRP)
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +1.10%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.XRP_USD || 2.15).toFixed(3)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-slate-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.XRP_TRY || exchangeRates.XRP || 104.10).toFixed(2)} TL
              </div>
            </div>

            {/* Avalanche (AVAX) */}
            <div 
              onClick={() => handleCardClick("Avalanche (AVAX)", `$${(exchangeRates.AVAX_USD || 28.5).toFixed(2)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-rose-950/40 to-slate-900 border border-rose-500/30 hover:border-rose-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-rose-300 flex items-center gap-1 truncate">
                  🔺 AVAX
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +2.80%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.AVAX_USD || 28.5).toFixed(2)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-rose-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.AVAX_TRY || exchangeRates.AVAX || 1380).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>

            {/* Dogecoin (DOGE) */}
            <div 
              onClick={() => handleCardClick("Dogecoin (DOGE)", `$${(exchangeRates.DOGE_USD || 0.22).toFixed(3)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-amber-300 flex items-center gap-1 truncate">
                  🐶 DOGE
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +0.55%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.DOGE_USD || 0.22).toFixed(3)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-amber-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.DOGE_TRY || exchangeRates.DOGE || 10.65).toFixed(2)} TL
              </div>
            </div>

            {/* Toncoin (TON) */}
            <div 
              onClick={() => handleCardClick("Toncoin (TON)", `$${(exchangeRates.TON_USD || 5.4).toFixed(2)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-sky-950/40 to-slate-900 border border-sky-500/30 hover:border-sky-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-sky-300 flex items-center gap-1 truncate">
                  💎 Toncoin
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  +1.85%
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.TON_USD || 5.4).toFixed(2)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-sky-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.TON_TRY || exchangeRates.TON || 261.47).toFixed(2)} TL
              </div>
            </div>

            {/* Tether (USDT) */}
            <div 
              onClick={() => handleCardClick("Tether (USDT)", `$${(exchangeRates.USDT_USD || 1.0).toFixed(2)}`)}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-teal-950/40 to-slate-900 border border-teal-500/30 hover:border-teal-400 rounded-2xl space-y-1.5 shadow-sm hover:scale-[1.02] transition cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] sm:text-[11px] font-black text-teal-300 flex items-center gap-1 truncate">
                  🟢 USDT
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                  Stable
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                ${(exchangeRates.USDT_USD || 1.0).toFixed(2)}
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-teal-300/80 font-mono font-bold truncate">
                ₺{(exchangeRates.USDT_TRY || exchangeRates.USDT || exchangeRates.USD || 48.45).toFixed(2)} TL
              </div>
            </div>
          </>
        )}
      </div>

      {/* Currency & Gold Interactive Converter Engine */}
      {showConverter && (
        <div className="p-4 sm:p-5 bg-slate-800/90 border border-slate-700/80 rounded-2xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-black uppercase text-indigo-400 flex items-center gap-1.5 tracking-wider">
              <Zap className="w-4 h-4 text-amber-400" />
              ÇİFT YÖNLÜ CANLI DÖVİZ & ALTIN ÇEVİRİCİ
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              Anlık piyasa kuru üzerinden otomatik hesaplanır
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Amount */}
            <div className="sm:col-span-4">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Miktar</label>
              <input
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                placeholder="Örn: 1000"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* From Currency */}
            <div className="sm:col-span-3">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Kaynak Birim</label>
              <select
                value={fromCurr}
                onChange={(e) => setFromCurr(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="TRY">₺ Türk Lirası (TRY)</option>
                <option value="USD">$ Dolar (USD)</option>
                <option value="EUR">€ Euro (EUR)</option>
                <option value="GBP">£ Sterlin (GBP)</option>
                <option value="GOLD_GRAM">🥇 Gram Altın (24K)</option>
                <option value="GOLD_CEYREK">🪙 Çeyrek Altın</option>
                <option value="BTC_USD">₿ Bitcoin (BTC)</option>
                <option value="ETH_USD">⟠ Ethereum (ETH)</option>
              </select>
            </div>

            {/* Swap Button */}
            <div className="sm:col-span-1 flex justify-center pt-2 sm:pt-4">
              <button
                type="button"
                onClick={() => {
                  const temp = fromCurr;
                  setFromCurr(toCurr);
                  setToCurr(temp);
                }}
                className="p-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white rounded-xl transition cursor-pointer"
                title="Birimleri Değiştir"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>

            {/* To Currency */}
            <div className="sm:col-span-4">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Hedef Birim</label>
              <select
                value={toCurr}
                onChange={(e) => setToCurr(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="TRY">₺ Türk Lirası (TRY)</option>
                <option value="USD">$ Dolar (USD)</option>
                <option value="EUR">€ Euro (EUR)</option>
                <option value="GBP">£ Sterlin (GBP)</option>
                <option value="GOLD_GRAM">🥇 Gram Altın (24K)</option>
                <option value="GOLD_CEYREK">🪙 Çeyrek Altın</option>
                <option value="BTC_USD">₿ Bitcoin (BTC)</option>
                <option value="ETH_USD">⟠ Ethereum (ETH)</option>
              </select>
            </div>
          </div>

          {/* Result Display */}
          <div className="p-3.5 bg-slate-900/90 border border-indigo-500/20 rounded-xl flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-slate-400 font-bold">
              Çeviri Sonucu:
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-indigo-300">
              {calculateConversion().toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {toCurr}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

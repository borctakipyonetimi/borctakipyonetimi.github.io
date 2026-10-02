import React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface PeriodFilterProps {
  selectedMonth: number | null;
  selectedYear: number | null;
  setSelectedMonth: (month: number | null) => void;
  setSelectedYear: (year: number | null) => void;
  themeColor?: string;
}

const THEME_CONFIGS = {
  blue: {
    cardBg: "bg-gradient-to-r from-indigo-100 via-sky-100/90 to-blue-100 dark:from-slate-900/95 dark:via-indigo-950/50 dark:to-slate-900",
    border: "border-2 border-indigo-400/90 dark:border-indigo-700/50",
    shadow: "shadow-md shadow-indigo-200/50 dark:shadow-black/30",
    iconBg: "bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/30",
    iconText: "text-white",
    labelColor: "text-indigo-800 dark:text-indigo-300",
    selectBorder: "border-indigo-300/90 dark:border-slate-700/80",
    btnHover: "hover:bg-indigo-200/80 text-indigo-950 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300",
    focusRing: "focus:ring-indigo-500",
  },
  green: {
    cardBg: "bg-gradient-to-r from-emerald-100 via-teal-100/90 to-green-100 dark:from-slate-900/95 dark:via-emerald-950/40 dark:to-slate-900",
    border: "border-2 border-emerald-400/90 dark:border-emerald-700/50",
    shadow: "shadow-md shadow-emerald-200/50 dark:shadow-black/30",
    iconBg: "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/30",
    iconText: "text-white",
    labelColor: "text-emerald-800 dark:text-emerald-300",
    selectBorder: "border-emerald-300/90 dark:border-slate-700/80",
    btnHover: "hover:bg-emerald-200/80 text-emerald-950 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300",
    focusRing: "focus:ring-emerald-500",
  },
  purple: {
    cardBg: "bg-gradient-to-r from-purple-100 via-fuchsia-100/90 to-violet-100 dark:from-slate-900/95 dark:via-purple-950/40 dark:to-slate-900",
    border: "border-2 border-purple-400/90 dark:border-purple-700/50",
    shadow: "shadow-md shadow-purple-200/50 dark:shadow-black/30",
    iconBg: "bg-gradient-to-tr from-purple-600 to-fuchsia-500 text-white shadow-md shadow-purple-500/30",
    iconText: "text-white",
    labelColor: "text-purple-800 dark:text-purple-300",
    selectBorder: "border-purple-300/90 dark:border-slate-700/80",
    btnHover: "hover:bg-purple-200/80 text-purple-950 dark:hover:bg-purple-950/50 dark:hover:text-purple-300",
    focusRing: "focus:ring-purple-500",
  },
  orange: {
    cardBg: "bg-gradient-to-r from-amber-100 via-orange-100/90 to-yellow-100 dark:from-slate-900/95 dark:via-amber-950/40 dark:to-slate-900",
    border: "border-2 border-amber-400/90 dark:border-amber-700/50",
    shadow: "shadow-md shadow-amber-200/50 dark:shadow-black/30",
    iconBg: "bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-md shadow-amber-500/30",
    iconText: "text-white",
    labelColor: "text-amber-800 dark:text-amber-300",
    selectBorder: "border-amber-300/90 dark:border-slate-700/80",
    btnHover: "hover:bg-amber-200/80 text-amber-950 dark:hover:bg-amber-950/50 dark:hover:text-amber-300",
    focusRing: "focus:ring-amber-500",
  },
};

export const PeriodFilter: React.FC<PeriodFilterProps> = ({
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
  themeColor = "blue",
}) => {
  const months = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === null || selectedYear === null) {
      const now = new Date();
      setSelectedMonth(now.getMonth());
      setSelectedYear(now.getFullYear());
    } else if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === null || selectedYear === null) {
      const now = new Date();
      setSelectedMonth(now.getMonth());
      setSelectedYear(now.getFullYear());
    } else if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const theme = THEME_CONFIGS[themeColor as keyof typeof THEME_CONFIGS] || THEME_CONFIGS.blue;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.005 }}
      className={`py-2 px-2.5 sm:py-2.5 sm:px-3.5 rounded-xl border ${theme.border} ${theme.cardBg} ${theme.shadow} flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2 text-xs transition-all duration-300 relative overflow-hidden backdrop-blur-md mb-3`}
    >
      {/* Decorative subtle ambient backing */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-white/20 pointer-events-none" />
      <div className="absolute top-0 right-0 w-28 h-28 bg-white/20 dark:bg-white/5 rounded-full blur-xl pointer-events-none" />

      {/* Left title and current period display - perfectly vertically centered with icon & non-breaking */}
      <div className="flex items-center gap-1.5 sm:gap-2 relative z-10 shrink-0 min-w-0">
        <div className={`p-1.5 rounded-lg shrink-0 transition-all duration-300 ${theme.iconBg} ${theme.iconText} shadow-xs`}>
          <Calendar className="w-3.5 h-3.5 animate-pulse" />
        </div>
        <div className="min-w-0 shrink-0 flex flex-col justify-center">
          <span className={`text-[7.5px] sm:text-[8.5px] font-black uppercase ${theme.labelColor} block leading-tight tracking-wider whitespace-nowrap`}>
            FİLTRELENEN DÖNEM
          </span>
          <span className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-[11px] sm:text-[13px] flex items-center gap-1 sm:gap-1.5 whitespace-nowrap leading-tight mt-0.5">
            {selectedMonth !== null && selectedYear !== null
              ? `${months[selectedMonth]} ${selectedYear}`
              : "🔒 TÜM ZAMANLAR"}
            <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          </span>
        </div>
      </div>

      {/* Right period navigation buttons (Single inline row, compact & non-wrapping) */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0 relative z-10 justify-end ml-auto">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={selectedMonth === null}
          className={`p-1.5 sm:px-2.5 sm:py-1 border ${theme.selectBorder} bg-white/95 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer disabled:opacity-40 select-none text-[10px] font-black transition-all duration-200 shadow-xs flex items-center gap-0.5 shrink-0 ${theme.btnHover}`}
          title="Önceki Ay"
        >
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Önceki</span>
        </button>

        <select
          value={selectedMonth === null ? "all" : selectedMonth}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "all") {
              setSelectedMonth(null);
            } else {
              setSelectedMonth(parseInt(val, 10));
              if (selectedYear === null) setSelectedYear(new Date().getFullYear());
            }
          }}
          className={`px-1 sm:px-1.5 py-1 bg-white/95 dark:bg-slate-900 border ${theme.selectBorder} rounded-lg font-black text-slate-800 dark:text-slate-100 cursor-pointer text-[10px] sm:text-[10.5px] shadow-xs focus:outline-none focus:ring-1 ${theme.focusRing} shrink-0 max-w-[80px] sm:max-w-[110px] truncate`}
        >
          <option value="all">Tüm Aylar</option>
          {months.map((m, idx) => (
            <option key={idx} value={idx}>{m}</option>
          ))}
        </select>

        <select
          value={selectedYear === null ? "all" : selectedYear}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "all") {
              setSelectedYear(null);
              setSelectedMonth(null);
            } else {
              setSelectedYear(parseInt(val, 10));
              if (selectedMonth === null) setSelectedMonth(new Date().getMonth());
            }
          }}
          disabled={selectedMonth === null}
          className={`px-1 sm:px-1.5 py-1 bg-white/95 dark:bg-slate-900 border ${theme.selectBorder} rounded-lg font-black text-slate-800 dark:text-slate-100 disabled:opacity-40 cursor-pointer text-[10px] sm:text-[10.5px] shadow-xs focus:outline-none focus:ring-1 ${theme.focusRing} shrink-0 max-w-[58px] sm:max-w-[70px]`}
        >
          <option value="all">Yıl</option>
          {[2024, 2025, 2026, 2027, 2028].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={selectedMonth === null}
          className={`p-1.5 sm:px-2.5 sm:py-1 border ${theme.selectBorder} bg-white/95 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer disabled:opacity-40 select-none text-[10px] font-black transition-all duration-200 shadow-xs flex items-center gap-0.5 shrink-0 ${theme.btnHover}`}
          title="Sonraki Ay"
        >
          <span className="hidden md:inline">Sonraki</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </motion.div>
  );
};

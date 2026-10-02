import React from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface PeriodFilterProps {
  selectedMonth: number | null;
  selectedYear: number | null;
  setSelectedMonth: (month: number | null) => void;
  setSelectedYear: (year: number | null) => void;
  themeColor?: string;
}

export const PeriodFilter: React.FC<PeriodFilterProps> = ({
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
  themeColor = "blue"
}) => {
  const months = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === null || selectedYear === null) return;
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === null || selectedYear === null) return;
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const themeClasses = {
    blue: "text-indigo-900 bg-gradient-to-r from-indigo-100 via-sky-100/90 to-blue-100 border-2 border-indigo-400/90 shadow-md shadow-indigo-200/60 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800",
    green: "text-emerald-900 bg-gradient-to-r from-emerald-100 via-teal-100/90 to-green-100 border-2 border-emerald-400/90 shadow-md shadow-emerald-200/60 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800",
    purple: "text-purple-900 bg-gradient-to-r from-purple-100 via-fuchsia-100/90 to-violet-100 border-2 border-purple-400/90 shadow-md shadow-purple-200/60 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-800",
    orange: "text-amber-950 bg-gradient-to-r from-amber-100 via-orange-100/90 to-yellow-100 border-2 border-amber-400/90 shadow-md shadow-amber-200/60 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
  };

  const activeTheme = themeClasses[themeColor as keyof typeof themeClasses] || themeClasses.blue;

  return (
    <div className={`py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-xl border ${activeTheme} flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-md mb-3 transition-all duration-300 relative overflow-hidden backdrop-blur-md`}>
      {/* Ambient subtle glow */}
      <div className="absolute top-0 right-0 w-28 h-28 bg-white/20 dark:bg-white/5 rounded-full blur-xl pointer-events-none" />

      {/* Left side: Icon, title & selected period display */}
      <div className="flex items-center gap-2 relative z-10 min-w-0 shrink">
        <div className="p-1.5 rounded-lg bg-white/80 dark:bg-white/10 shadow-xs shrink-0">
          <Calendar className="w-3.5 h-3.5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <span className="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider block leading-tight opacity-80">
            FİLTRELENEN DÖNEM
          </span>
          <span className="font-black uppercase tracking-tight text-xs sm:text-[13px] flex items-center gap-1.5 truncate">
            {selectedMonth !== null && selectedYear !== null
              ? `${months[selectedMonth]} ${selectedYear}`
              : "🔒 TÜM ZAMANLAR"}
            <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          </span>
        </div>
      </div>

      {/* Right side: Navigation controls (Single inline row, never wraps) */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0 relative z-10 justify-end ml-auto">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={selectedMonth === null}
          className="p-1.5 sm:px-2.5 sm:py-1 border border-black/10 dark:border-white/15 bg-white/95 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer disabled:opacity-40 select-none text-[10px] font-black transition-all duration-200 shadow-xs flex items-center gap-0.5 shrink-0 hover:bg-black/5 dark:hover:bg-white/10"
          title="Önceki Ay"
        >
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Önceki</span>
        </button>

        <select
          value={selectedMonth ?? ""}
          onChange={(e) => setSelectedMonth(e.target.value === "" ? null : Number(e.target.value))}
          className="px-1.5 py-1 bg-white/95 dark:bg-slate-900 border border-black/10 dark:border-white/15 rounded-lg font-black text-slate-800 dark:text-slate-100 cursor-pointer text-[10.5px] shadow-xs focus:outline-none shrink-0 max-w-[96px] sm:max-w-[115px] truncate"
        >
          <option value="">Tüm Aylar</option>
          {months.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>

        <select
          value={selectedYear ?? ""}
          onChange={(e) => setSelectedYear(e.target.value === "" ? null : Number(e.target.value))}
          disabled={selectedMonth === null}
          className="px-1.5 py-1 bg-white/95 dark:bg-slate-900 border border-black/10 dark:border-white/15 rounded-lg font-black text-slate-800 dark:text-slate-100 disabled:opacity-40 cursor-pointer text-[10.5px] shadow-xs focus:outline-none shrink-0"
        >
          <option value="">Yıl</option>
          {[2024, 2025, 2026, 2027, 2028].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={selectedMonth === null}
          className="p-1.5 sm:px-2.5 sm:py-1 border border-black/10 dark:border-white/15 bg-white/95 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer disabled:opacity-40 select-none text-[10px] font-black transition-all duration-200 shadow-xs flex items-center gap-0.5 shrink-0 hover:bg-black/5 dark:hover:bg-white/10"
          title="Sonraki Ay"
        >
          <span className="hidden md:inline">Sonraki</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedMonth(new Date().getMonth());
            setSelectedYear(new Date().getFullYear());
          }}
          className="px-2 py-1 bg-white/70 hover:bg-white dark:bg-black/30 dark:hover:bg-black/50 text-slate-900 dark:text-white border border-black/10 dark:border-white/20 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition active:scale-95 cursor-pointer shrink-0 ml-0.5 shadow-xs"
          title="Bu Aya Git"
        >
          BU AY
        </button>
      </div>
    </div>
  );
};

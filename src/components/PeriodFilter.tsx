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
    blue: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800",
    green: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800",
    purple: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800",
    orange: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
  };

  const activeTheme = themeClasses[themeColor as keyof typeof themeClasses] || themeClasses.blue;

  return (
    <div className={`p-3 rounded-2xl border ${activeTheme} flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs mb-4`}>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest">DÖNEM FİLTRESİ</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-1 min-w-[140px] justify-center">
          <select
            value={selectedMonth ?? ""}
            onChange={(e) => setSelectedMonth(e.target.value === "" ? null : Number(e.target.value))}
            className="bg-transparent border-none text-sm font-black focus:outline-none cursor-pointer text-center appearance-none px-1"
          >
            <option value="">Tüm Aylar</option>
            {months.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <select
            value={selectedYear ?? ""}
            onChange={(e) => setSelectedYear(e.target.value === "" ? null : Number(e.target.value))}
            className="bg-transparent border-none text-sm font-black focus:outline-none cursor-pointer text-center appearance-none px-1"
          >
            {[2023, 2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={() => {
          setSelectedMonth(new Date().getMonth());
          setSelectedYear(new Date().getFullYear());
        }}
        className="text-[9px] font-black px-2 py-1 bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-black/40 rounded-lg transition uppercase tracking-tighter"
      >
        BU AY
      </button>
    </div>
  );
};

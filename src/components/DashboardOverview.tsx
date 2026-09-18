/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, PlusCircle, ArrowUpRight, TrendingUp, ShieldAlert, Award, HelpingHand, Bell, Coins, Edit, Check, X, Info, Settings, RefreshCw, CalendarDays, ClipboardCheck, Trash2, StickyNote, Calendar, CheckCircle2, Users } from "lucide-react";
import { motion } from "motion/react";
import { FinancialStats, Income, Expense, ExpenseCategory } from "../types";
import { BarChart, DoughnutChart, LineChart } from "./BudgetCharts";
import { useCurrency } from "../utils/CurrencyContext";
import { AdMobBanner } from "./AdMobBanner";
import { t } from "../utils/translations";

interface DashboardOverviewProps {
  stats: FinancialStats;
  onNavigate: (tab: string) => void;
  monthlyPaymentsCount: number;
  monthlyInstallmentsDue: number;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
  incomes?: Income[];
  expenses?: Expense[];
  expenseCategories?: ExpenseCategory[];
  selectedMonth: number | null;
  selectedYear: number | null;
  setSelectedMonth: (m: number | null) => void;
  setSelectedYear: (y: number | null) => void;
  colorTheme?: string;
  language?: "tr" | "en";
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  onNavigate,
  monthlyPaymentsCount,
  monthlyInstallmentsDue,
  isPremium = false,
  onUpgradeClick,
  incomes = [],
  expenses = [],
  expenseCategories = [],
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
  colorTheme = "indigo",
  language = "tr",
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const { format, currencySymbol, rates, setRates, activeCurrency, isFetching, lastUpdated, updateRatesFromAPI, nextRefreshSec, rateDetails } = useCurrency();
  const hasContent = (incomes && incomes.length > 0) || (expenses && expenses.length > 0) || (stats && stats.totalDebt > 0);
  const [budgetGoal, setBudgetGoal] = useState<number>(() => {
    const email = localStorage.getItem("currentUser") || "anonymous";
    const saved = localStorage.getItem(`budget_goal_${email}`);
    return saved ? parseFloat(saved) : 10000;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(budgetGoal.toString());

  // Daily Financial Notes State and Handlers
  interface FinancialNote {
    id: string;
    text: string;
  }
  const [notes, setNotes] = useState<FinancialNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");

  useEffect(() => {
    const email = localStorage.getItem("currentUser") || "anonymous";
    const saved = localStorage.getItem(`financial_notes_${email}`);
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) {
        setNotes([]);
      }
    } else {
      setNotes([
        { id: "1", text: "Gereksiz abonelikleri iptal etmeyi unutma." },
        { id: "2", text: "Taksit tutarlarını her ayın ilk haftası bütçeden ayır." }
      ]);
    }
  }, []);

  const handleAddNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newNoteText.trim();
    if (!trimmed) return;
    const email = localStorage.getItem("currentUser") || "anonymous";
    const updatedNotes = [...notes, { id: Date.now().toString(), text: trimmed }];
    setNotes(updatedNotes);
    localStorage.setItem(`financial_notes_${email}`, JSON.stringify(updatedNotes));
    setNewNoteText("");
  };

  const handleDeleteNote = (id: string) => {
    const email = localStorage.getItem("currentUser") || "anonymous";
    const updatedNotes = notes.filter(n => n.id !== id);
    setNotes(updatedNotes);
    localStorage.setItem(`financial_notes_${email}`, JSON.stringify(updatedNotes));
  };

  // Exchange rate custom manual edit controls
  const [isEditingRates, setIsEditingRates] = useState(false);
  const [usdRateInput, setUsdRateInput] = useState(rates.USD.toString());
  const [eurRateInput, setEurRateInput] = useState(rates.EUR.toString());
  const [gbpRateInput, setGbpRateInput] = useState(rates.GBP.toString());

  // Synchronize manual input states when online exchange rates update successfully in background
  useEffect(() => {
    if (!isEditingRates) {
      setUsdRateInput(rates.USD.toString());
      setEurRateInput(rates.EUR.toString());
      setGbpRateInput(rates.GBP.toString());
    }
  }, [rates, isEditingRates]);

  // Flash element glow and sweep pulse effect on rates key values update
  const [ratesFlash, setRatesFlash] = useState(false);
  const isInitialRatesRef = useRef(true);

  useEffect(() => {
    if (isInitialRatesRef.current) {
      isInitialRatesRef.current = false;
      return;
    }
    setRatesFlash(true);
    const t = setTimeout(() => setRatesFlash(false), 850);
    return () => clearTimeout(t);
  }, [rates.USD, rates.EUR, rates.GBP]);

  useEffect(() => {
    const email = localStorage.getItem("currentUser") || "anonymous";
    const saved = localStorage.getItem(`budget_goal_${email}`);
    const val = saved ? parseFloat(saved) : 10000;
    setBudgetGoal(val);
    
    // Convert to currently active currency for form input
    const curRate = rates[activeCurrency] || 1;
    const localizedVal = val / curRate;
    setGoalInput(Number(localizedVal.toFixed(2)).toString());
  }, [stats.totalExpense, activeCurrency, rates]);

  const handleSaveGoal = () => {
    const parsed = parseFloat(goalInput);
    if (!isNaN(parsed) && parsed >= 0) {
      const email = localStorage.getItem("currentUser") || "anonymous";
      // Convert localized view input back to original Turkish Lira (TRY) storage baseline
      const curRate = rates[activeCurrency] || 1;
      const tryBaseVal = Number((parsed * curRate).toFixed(2));
      setBudgetGoal(tryBaseVal);
      localStorage.setItem(`budget_goal_${email}`, tryBaseVal.toString());
      setIsEditingGoal(false);
    }
  };

  const paymentProgress = stats.totalDebt > 0 ? (stats.totalPaid / stats.totalDebt) * 100 : 0;

  // Formatted data arrays for animated SVG graphs
  const comparativeChartData = [
    { label: "Toplam Borç", value: stats.totalDebt, color: "#1e3a8a" },
    { label: "Kişi Borcu", value: stats.contactPayablesRemaining ?? stats.contactPayablesTotal ?? 0, color: "#8b5cf6" },
    { label: "Gelir", value: stats.totalIncome, color: "#10b981" },
    { label: "Gider", value: stats.totalExpense, color: "#ef4444" },
    { label: "Net Kalan", value: stats.netIncome, color: stats.netIncome >= 0 ? "#f59e0b" : "#ef4444" },
  ];

  const paidRemainingData = [
    { label: selectedMonth !== null ? "Bu Ay Ödenen" : "Ödenen Borç", value: selectedMonth !== null ? (stats.thisMonthPaidBorc ?? 0) : stats.totalPaid, color: "#10b981" },
    { label: selectedMonth !== null ? "Bu Ay Kalan" : "Kalan Borç", value: selectedMonth !== null ? stats.thisMonthKalanBorc : stats.remaining, color: "#ef4444" },
  ];

  const trendLabels = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran"];
  // Mock 6 month trend descending slightly as budget controls improve
  const trendValues = [
    stats.totalDebt * 1.3,
    stats.totalDebt * 1.15,
    stats.totalDebt * 1.1,
    stats.totalDebt * 1.05,
    stats.totalDebt * 1.02,
    stats.totalDebt,
  ].map(v => Math.max(v, 0));

  const incomeColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];
  const incomeDoughnutData = incomes.map((i, idx) => ({
    label: i.name,
    value: i.amount,
    color: incomeColors[idx % incomeColors.length],
  }));

  const categoryTotals = expenses.reduce((acc: { [key: number]: number }, e) => {
    acc[e.categoryId] = (acc[e.categoryId] || 0) + e.amount;
    return acc;
  }, {});

  const expenseColors = [
    "#ef4444",
    "#f59e0b",
    "#3b82f6",
    "#10b981",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#6366f1",
  ];
  const expenseDoughnutData = expenseCategories
    .map((c, idx) => ({
      label: c.name,
      value: categoryTotals[c.id] || 0,
      color: c.color || expenseColors[idx % expenseColors.length],
    }))
    .filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-lg sm:text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2"
        >
          🚀 FİNANSAL GELECEĞİNİZİ ANALİZ EDİN
        </motion.h2>
        <div className="w-12 h-1.5 bg-indigo-500 rounded-full mt-3 opacity-90 shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
      </div>

      {/* Modern Greeting & Operations Banner */}
      <div className="bg-gradient-to-br from-indigo-600/10 via-slate-500/5 to-emerald-500/5 p-6 rounded-[2rem] border border-indigo-500/15 dark:border-indigo-500/10 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center text-center relative z-10"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 px-2.5 bg-indigo-500 text-white text-[9px] font-black rounded-lg shadow-lg shadow-indigo-500/20 uppercase tracking-widest">PRO AKTİF</div>
            <div className="p-1 px-2.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-lg border border-emerald-500/20 uppercase tracking-widest">AI DESTEKLİ</div>
          </div>
          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-extrabold max-w-lg leading-relaxed">
            Bütçem Pro ile finansal özgürlüğünüze giden yolda adım atın. Harcamalarınızı akıllıca takip edin, borçlarınızı planlayın ve geleceğinizi güvenle inşa edin. 👑
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-2 flex items-center gap-1.5 uppercase tracking-tighter">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Tam Kontrol <span className="text-slate-300">|</span> <CheckCircle2 className="w-3 h-3 text-indigo-500" /> Akıllı Analiz <span className="text-slate-300">|</span> <CheckCircle2 className="w-3 h-3 text-amber-500" /> Maksimum Güvenlik
          </p>
        </motion.div>
      </div>


      {/* Relocated Filter Section on overview screen (placed below header banner as requested) */}
      {(() => {
        let themeCardBg = "bg-white dark:bg-slate-800";
        let themeBorder = "border-slate-200/60 dark:border-slate-700/60";
        let themeIconBg = "bg-indigo-50 dark:bg-slate-900";
        let themeIconText = "text-indigo-500";
        let themeFocusRing = "focus:ring-indigo-500";
        let themeBtnHover = "hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400";
        
        if (colorTheme === "green") {
          themeCardBg = "bg-emerald-500/[0.04] dark:bg-emerald-950/10";
          themeBorder = "border-emerald-500/20 dark:border-emerald-800/40";
          themeIconBg = "bg-emerald-500/20 dark:bg-emerald-950/60";
          themeIconText = "text-emerald-600 dark:text-emerald-400";
          themeFocusRing = "focus:ring-emerald-500";
          themeBtnHover = "hover:bg-emerald-500/10 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400";
        } else if (colorTheme === "purple") {
          themeCardBg = "bg-purple-500/[0.04] dark:bg-purple-950/10";
          themeBorder = "border-purple-500/20 dark:border-purple-800/40";
          themeIconBg = "bg-purple-500/20 dark:bg-purple-950/60";
          themeIconText = "text-purple-600 dark:text-purple-400";
          themeFocusRing = "focus:ring-purple-500";
          themeBtnHover = "hover:bg-purple-500/10 dark:hover:bg-purple-950/30 text-purple-600 dark:text-purple-400";
        } else if (colorTheme === "orange") {
          themeCardBg = "bg-amber-500/[0.04] dark:bg-amber-950/10";
          themeBorder = "border-amber-500/20 dark:border-amber-800/40";
          themeIconBg = "bg-amber-500/20 dark:bg-amber-950/60";
          themeIconText = "text-amber-600 dark:text-amber-400";
          themeFocusRing = "focus:ring-amber-500";
          themeBtnHover = "hover:bg-amber-500/10 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400";
        } else {
          themeCardBg = "bg-indigo-500/[0.04] dark:bg-indigo-950/10";
          themeBorder = "border-indigo-500/20 dark:border-indigo-805/40";
          themeIconBg = "bg-indigo-500/20 dark:bg-indigo-950/60";
          themeIconText = "text-indigo-600 dark:text-indigo-400";
        }

        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-3xl border ${themeCardBg} ${themeBorder} shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition-all duration-350 relative overflow-hidden`}
          >
            {/* Decorative dynamic neon fluid bubble backing */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <div className={`p-2.5 rounded-2xl shrink-0 transition-colors duration-300 ${themeIconBg} ${themeIconText}`}>
                <Calendar className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block leading-none tracking-widest mb-1">FİLTRELENEN DÖNEM</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                  {selectedMonth !== null && selectedYear !== null 
                    ? `${["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][selectedMonth]} ${selectedYear}`
                    : "🔒 TÜM ZAMANLAR BİRİKİMLİ"}
                  <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end relative z-10">
              <button
                type="button"
                onClick={() => {
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
                }}
                disabled={selectedMonth === null}
                className={`px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer disabled:opacity-40 select-none text-[10.5px] font-extrabold transition-all duration-300 ${themeBtnHover}`}
              >
                ← Önceki
              </button>

              <select
                value={selectedMonth === null ? "all" : selectedMonth}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "all") {
                    setSelectedMonth(null);
                  } else {
                    setSelectedMonth(parseInt(val));
                    if (selectedYear === null) setSelectedYear(new Date().getFullYear());
                  }
                }}
                className={`px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer text-[10.5px] focus:outline-none focus:ring-1 ${themeFocusRing}`}
              >
                <option value="all">Tüm Dönemler</option>
                {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].map((m, idx) => (
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
                    setSelectedYear(parseInt(val));
                    if (selectedMonth === null) setSelectedMonth(new Date().getMonth());
                  }
                }}
                disabled={selectedMonth === null}
                className={`px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/85 rounded-xl font-extrabold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer text-[10.5px] focus:outline-none focus:ring-1 ${themeFocusRing}`}
              >
                <option value="all">Yıl</option>
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
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
                }}
                disabled={selectedMonth === null}
                className={`px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-655 dark:text-slate-300 rounded-xl cursor-pointer disabled:opacity-40 select-none text-[10.5px] font-extrabold transition-all duration-300 ${themeBtnHover}`}
              >
                Sonraki →
              </button>
            </div>
          </motion.div>
        );
      })()}

      {/* Animated Fast Action Buttons: Borç Ekle, Gelir Ekle, Gider Ekle (Compact 3 side-by-side) */}
      {(() => {
        const getActionStyle = () => {
          if (colorTheme === "green") {
            return {
              debt: "bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-800 dark:from-teal-950 dark:via-emerald-950 dark:to-slate-900 border-2 border-teal-400/50 dark:border-teal-500/40 text-white shadow-lg shadow-teal-500/25 hover:shadow-xl",
              income: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-900 border-2 border-emerald-400/50 dark:border-emerald-500/40 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl",
              expense: "bg-gradient-to-br from-rose-500 via-rose-600 to-red-800 dark:from-rose-950 dark:via-rose-900 dark:to-slate-900 border-2 border-rose-400/50 dark:border-rose-500/40 text-white shadow-lg shadow-rose-500/25 hover:shadow-xl",
              badge: "bg-white/20 text-white border border-white/30"
            };
          } else if (colorTheme === "purple") {
            return {
              debt: "bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-800 dark:from-purple-950 dark:via-indigo-950 dark:to-slate-900 border-2 border-purple-400/50 dark:border-purple-500/40 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl",
              income: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-900 border-2 border-emerald-400/50 dark:border-emerald-500/40 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl",
              expense: "bg-gradient-to-br from-rose-500 via-rose-600 to-red-800 dark:from-rose-950 dark:via-rose-900 dark:to-slate-900 border-2 border-rose-400/50 dark:border-rose-500/40 text-white shadow-lg shadow-rose-500/25 hover:shadow-xl",
              badge: "bg-white/20 text-white border border-white/30"
            };
          } else if (colorTheme === "orange") {
            return {
              debt: "bg-gradient-to-br from-amber-500 via-amber-600 to-orange-800 dark:from-amber-950 dark:via-orange-950 dark:to-slate-900 border-2 border-amber-400/50 dark:border-amber-500/40 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl",
              income: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-900 border-2 border-emerald-400/50 dark:border-emerald-500/40 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl",
              expense: "bg-gradient-to-br from-rose-500 via-rose-600 to-red-800 dark:from-rose-950 dark:via-rose-900 dark:to-slate-900 border-2 border-rose-400/50 dark:border-rose-500/40 text-white shadow-lg shadow-rose-500/25 hover:shadow-xl",
              badge: "bg-white/20 text-white border border-white/30"
            };
          } else { // default indigo
            return {
              debt: "bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-800 dark:from-indigo-950 dark:via-purple-950 dark:to-slate-900 border-2 border-indigo-400/50 dark:border-indigo-500/40 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl",
              income: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-900 border-2 border-emerald-400/50 dark:border-emerald-500/40 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl",
              expense: "bg-gradient-to-br from-rose-500 via-rose-600 to-red-800 dark:from-rose-950 dark:via-rose-900 dark:to-slate-900 border-2 border-rose-400/50 dark:border-rose-500/40 text-white shadow-lg shadow-rose-500/25 hover:shadow-xl",
              badge: "bg-white/20 text-white border border-white/30"
            };
          }
        };

        const customStyle = getActionStyle();

        return (
          <div className="grid grid-cols-3 gap-2 sm:gap-3.5 pt-1">
            {/* 1. Borç Ekle */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.05 }}
              whileHover={{ 
                scale: 1.03, 
                y: -3,
                boxShadow: "0 15px 20px -5px rgba(99, 102, 241, 0.25)",
                transition: { type: "spring", stiffness: 400, damping: 15 }
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                localStorage.setItem("auto_open_add_debt", "true");
                onNavigate("debts");
              }}
              className={`relative overflow-hidden p-2.5 sm:p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 transition-all duration-300 cursor-pointer group ${customStyle.debt}`}
              id="quick-add-debt-btn"
            >
              <motion.div 
                className="absolute inset-0 bg-white/10 rounded-2xl -z-10"
                animate={{
                  scale: [1, 1.06, 1],
                  opacity: [0.2, 0.5, 0.2]
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              <motion.div 
                className={`p-1.5 sm:p-2 rounded-xl shadow-inner flex items-center justify-center shrink-0 transition-all duration-300 ${customStyle.badge}`}
                whileHover={{ 
                  scale: 1.12,
                  boxShadow: "0 0 12px rgba(255, 255, 255, 0.5)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </motion.div>

              <div className="flex flex-col space-y-0.5 z-10 w-full px-1">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-white truncate">
                  {language === "tr" ? "BORÇ EKLE" : "ADD DEBT"}
                </span>
                <span className="text-[8px] sm:text-[9.5px] font-bold text-white/85 leading-none truncate block">
                  {language === "tr" ? "Kredi & Kart" : "Loans & Credit"}
                </span>
              </div>
            </motion.button>

            {/* 2. Gelir Ekle */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              whileHover={{ 
                scale: 1.03, 
                y: -3,
                boxShadow: "0 15px 20px -5px rgba(16, 185, 129, 0.25)",
                transition: { type: "spring", stiffness: 400, damping: 15 }
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                localStorage.setItem("auto_open_add_income", "true");
                onNavigate("income");
              }}
              className={`relative overflow-hidden p-2.5 sm:p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 transition-all duration-300 cursor-pointer group ${customStyle.income}`}
              id="quick-add-income-btn"
            >
              <motion.div 
                className="absolute inset-0 bg-white/10 rounded-2xl -z-10"
                animate={{
                  scale: [1, 1.06, 1],
                  opacity: [0.2, 0.5, 0.2]
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.3
                }}
              />
              
              <motion.div 
                className="p-1.5 sm:p-2 bg-white/20 text-white border border-white/30 rounded-xl shadow-inner flex items-center justify-center shrink-0 transition-all duration-300"
                whileHover={{ 
                  rotate: 180, 
                  scale: 1.12,
                  boxShadow: "0 0 12px rgba(255, 255, 255, 0.5)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </motion.div>
              
              <div className="flex flex-col space-y-0.5 z-10 w-full px-1">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-white truncate">
                  {language === "tr" ? "GELİR EKLE" : "ADD INCOME"}
                </span>
                <span className="text-[8px] sm:text-[9.5px] font-bold text-white/85 leading-none truncate block">
                  {language === "tr" ? "Maaş & Ek Kazanç" : "Salary & Earns"}
                </span>
              </div>
            </motion.button>

            {/* 3. Gider Ekle */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
              whileHover={{ 
                scale: 1.03, 
                y: -3,
                boxShadow: "0 15px 20px -5px rgba(239, 68, 68, 0.25)",
                transition: { type: "spring", stiffness: 400, damping: 15 }
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                localStorage.setItem("auto_open_add_expense", "true");
                onNavigate("expenses");
              }}
              className={`relative overflow-hidden p-2.5 sm:p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 transition-all duration-300 cursor-pointer group ${customStyle.expense}`}
              id="quick-add-expense-btn"
            >
              <motion.div 
                className="absolute inset-0 bg-white/10 rounded-2xl -z-10"
                animate={{
                  scale: [1, 1.06, 1],
                  opacity: [0.2, 0.5, 0.2]
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.6
                }}
              />

              <motion.div 
                className="p-1.5 sm:p-2 bg-white/20 text-white border border-white/30 rounded-xl shadow-inner flex items-center justify-center shrink-0 transition-all duration-300"
                whileHover={{ 
                  y: -2, 
                  x: 2,
                  scale: 1.12,
                  boxShadow: "0 0 12px rgba(255, 255, 255, 0.5)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-90 text-white" />
              </motion.div>

              <div className="flex flex-col space-y-0.5 z-10 w-full px-1">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-white truncate">
                  {language === "tr" ? "GİDER EKLE" : "ADD EXPENSE"}
                </span>
                <span className="text-[8px] sm:text-[9.5px] font-bold text-white/85 leading-none truncate block">
                  {language === "tr" ? "Fatura & Market" : "Bills & Market"}
                </span>
              </div>
            </motion.button>
          </div>
        );
      })()}

      {/* 1. CARİ AY BORÇ DURUMU KARTI (ÖNCELİKLİ & BELİRGİN GÖSTERİM) */}
      <div className="pt-1">
        <motion.div
          whileHover={{ 
            scale: 1.01, 
            y: -2, 
            boxShadow: "0 20px 35px -10px rgba(99, 102, 241, 0.35)",
            borderColor: "rgba(129, 140, 248, 0.7)" 
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative overflow-hidden flex flex-col justify-between p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 dark:from-indigo-950 dark:via-purple-950/80 dark:to-slate-900 border-2 border-indigo-400/40 dark:border-indigo-500/40 text-white shadow-xl shadow-indigo-500/20 transition-all duration-300"
        >
          {/* Ambient luminous glow accents */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-purple-400/15 rounded-full blur-2xl pointer-events-none" />

          {/* Top header row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/20 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-white/20 text-white border border-white/30 shadow-md flex items-center justify-center">
                <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black tracking-tight text-white uppercase">
                    {language === "tr" ? "Cari Ay Borç Durumu" : "Current Month Debt Overview"}
                  </h3>
                  <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 shadow-xs">
                    {selectedMonth !== null && selectedYear !== null
                      ? `${["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][selectedMonth]} ${selectedYear}`
                      : (language === "tr" ? "Cari Ay / Dönem" : "Current Period")}
                  </span>
                </div>
                <p className="text-[10px] text-indigo-100/90 font-medium">
                  {language === "tr"
                    ? "Vadesi gelen borçlar, taksit yükümlülüğü ve tahsilat/ödeme tamamlama oranı"
                    : "Due loans, monthly installment pressure and settlement progress"}
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-indigo-400/30 text-white border border-indigo-300/40">
              {selectedMonth !== null ? (language === "tr" ? "Filtrelenmiş Ay" : "Month Filtered") : (language === "tr" ? "Bu Ayın Özeti" : "Current Month")}
            </span>
          </div>

          {/* 2 Primary Stats Blocks: Bu Ayki Toplam & Bu Ay Kalan */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3.5 relative z-10">
            <div className="p-3.5 sm:p-4 bg-white/15 dark:bg-white/10 backdrop-blur-md rounded-2xl border border-white/25 shadow-inner flex flex-col items-center justify-center text-center">
              <span className="text-[10px] sm:text-[11px] font-black text-indigo-100 uppercase tracking-wide">
                {language === "tr" ? "Bu Ayki Toplam Borç" : "Monthly Total Debt"}
              </span>
              <p className="text-base sm:text-2xl font-black font-mono text-white mt-1 tracking-tight drop-shadow-xs">
                {format(stats.thisMonthTotalBorc)}
              </p>
            </div>

            <div className="p-3.5 sm:p-4 bg-rose-500/30 dark:bg-rose-500/25 backdrop-blur-md rounded-2xl border-2 border-rose-300/50 dark:border-rose-400/40 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-[10px] sm:text-[11px] font-black text-rose-200 uppercase tracking-wide">
                {language === "tr" ? "Bu Ay Kalan Borç" : "Month Remaining"}
              </span>
              <p className="text-base sm:text-2xl font-black font-mono text-rose-100 mt-1 tracking-tight drop-shadow-xs">
                {format(stats.thisMonthKalanBorc)}
              </p>
            </div>
          </div>
          
          {/* Bottom details row */}
          <div className="flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] font-semibold text-indigo-100 mt-3.5 pt-3 border-t border-white/15 gap-2 relative z-10">
            <div className="flex items-center gap-1.5">
              <span>{language === "tr" ? "Bu Ay Kapatılan:" : "Settled this month:"}</span>
              <span className="font-bold font-mono text-emerald-300 bg-emerald-400/20 border border-emerald-300/30 px-2 py-0.5 rounded-full">
                {format(selectedMonth !== null ? (stats.thisMonthPaidBorc ?? 0) : (stats.thisMonthTotalBorc - stats.thisMonthKalanBorc))}
              </span>
            </div>
            <span className="text-[9.5px] sm:text-[10.5px] text-indigo-200/90 font-medium">
              {language === "tr" ? "Cari aya ait vadesi gelen borç ve kapatılan bakiye" : "Current month maturing debt and settled balance"}
            </span>
          </div>
        </motion.div>
      </div>

      {/* 2. GENEL FİNANSAL GÖSTERGELER (Cari Ay Borç Durumu Kartının Doğrudan Altına Taşındı) */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center gap-2 px-1">
          <div className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-sm flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-black tracking-wider text-slate-800 dark:text-slate-100 uppercase">
            {language === "tr" ? "Genel Finansal Göstergeler" : "General Financial Balances"}
          </span>
          <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
        </div>

        {/* 6 Temel Finansal Gösterge Kartı: Gündüz ve Gece Modunda Parlak Renkli Gösterim */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {/* 1. TOPLAM BORÇ */}
          <motion.div 
            whileHover={{ y: -2, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="p-3.5 sm:p-4 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 dark:from-indigo-950 dark:via-indigo-900 dark:to-slate-900 border-2 border-indigo-400/40 dark:border-indigo-500/40 text-white rounded-2xl space-y-1 relative overflow-hidden group shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px]"
          >
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-wide">
              <Coins className="w-3 h-3 text-indigo-200" />
              <span>{language === "tr" ? "TOPLAM BORÇ" : "TOTAL DEBT"}</span>
            </div>
            <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">{format(stats.totalDebt)}</p>
          </motion.div>

          {/* 2. KİŞİ BORÇLARI TOPLAMI */}
          <motion.div 
            whileHover={{ y: -2, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => onNavigate("contacts")}
            className="p-3.5 sm:p-4 bg-gradient-to-br from-purple-500 via-purple-600 to-purple-800 dark:from-purple-950 dark:via-purple-900 dark:to-slate-900 border-2 border-purple-400/40 dark:border-purple-500/40 text-white rounded-2xl space-y-1 relative overflow-hidden group shadow-lg shadow-purple-500/20 hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px] cursor-pointer"
          >
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-purple-100 uppercase tracking-wide">
              <Users className="w-3 h-3 text-purple-200" />
              <span>{language === "tr" ? "KİŞİ BORÇLARI" : "CONTACTS"}</span>
              <ArrowUpRight className="w-2.5 h-2.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">
              {format(stats.contactPayablesRemaining ?? stats.contactPayablesTotal ?? 0)}
            </p>
            {(stats.contactReceivablesRemaining !== undefined && stats.contactReceivablesRemaining > 0) && (
              <span className="text-[8.5px] font-medium text-purple-200 block truncate max-w-full">
                {language === "tr" ? "Alacak: " : "Recv: "}{format(stats.contactReceivablesRemaining)}
              </span>
            )}
          </motion.div>

          {/* 3. AYLIK GELİR */}
          <motion.div 
            whileHover={{ y: -2, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="p-3.5 sm:p-4 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 dark:from-emerald-950 dark:via-emerald-900 dark:to-slate-900 border-2 border-emerald-400/40 dark:border-emerald-500/40 text-white rounded-2xl space-y-1 relative overflow-hidden shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px]"
          >
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-emerald-100 uppercase tracking-wide">
              <PlusCircle className="w-3 h-3 text-emerald-200" />
              <span>{language === "tr" ? "AYLIK GELİR" : "MONTHLY INCOME"}</span>
            </div>
            <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">{format(stats.totalIncome)}</p>
          </motion.div>

          {/* 4. AYLIK GİDER */}
          <motion.div 
            whileHover={{ y: -2, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="p-3.5 sm:p-4 bg-gradient-to-br from-rose-500 via-rose-600 to-red-800 dark:from-rose-950 dark:via-rose-900 dark:to-slate-900 border-2 border-rose-400/40 dark:border-rose-500/40 text-white rounded-2xl space-y-1 relative overflow-hidden shadow-lg shadow-rose-500/20 hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px]"
          >
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-rose-100 uppercase tracking-wide">
              <ArrowUpRight className="w-3 h-3 text-rose-200" />
              <span>{language === "tr" ? "AYLIK GİDER" : "MONTHLY EXPENSE"}</span>
            </div>
            <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">{format(stats.totalExpense)}</p>
          </motion.div>

          {/* 5. BU AY ÖDENEN KISIM */}
          <motion.div 
            whileHover={{ y: -2, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="p-3.5 sm:p-4 bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-800 dark:from-teal-950 dark:via-teal-900 dark:to-slate-900 border-2 border-teal-400/40 dark:border-teal-500/40 text-white rounded-2xl space-y-1 relative overflow-hidden group shadow-lg shadow-teal-500/20 hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px]"
          >
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-teal-100 uppercase tracking-wide">
              <CheckCircle2 className="w-3 h-3 text-teal-200" />
              <span>
                {language === "tr"
                  ? (selectedMonth !== null ? "BU AY ÖDENEN" : "ÖDENEN KISIM")
                  : (selectedMonth !== null ? "REPAID MONTH" : "TOTAL REPAID")}
              </span>
            </div>
            <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">
              {format(selectedMonth !== null ? (stats.thisMonthPaidBorc ?? 0) : stats.totalPaid)}
            </p>
          </motion.div>

          {/* 6. NET KALAN REZERV */}
          <motion.div 
            whileHover={{ y: -2, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`p-3.5 sm:p-4 text-white rounded-2xl space-y-1 relative overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[92px] sm:min-h-[102px] ${
              stats.netIncome >= 0 
                ? "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-800 dark:from-blue-950 dark:via-blue-900 dark:to-slate-900 border-2 border-blue-400/40 shadow-blue-500/20" 
                : "bg-gradient-to-br from-amber-500 via-rose-600 to-red-800 dark:from-rose-950 dark:via-rose-900 dark:to-slate-900 border-2 border-rose-400/40 shadow-rose-500/20"
            }`}
          >
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-blue-100 uppercase tracking-wide">
              <Sparkles className="w-3 h-3 text-amber-200 animate-pulse" />
              <span>{language === "tr" ? "NET KALAN" : "NET SURPLUS"}</span>
            </div>
            <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white">{format(stats.netIncome)}</p>
          </motion.div>
        </div>
      </div>

      {/* 3. CARİ TAKSİT & ÖDEME İLERLEMESİ KARTLARI: GÜNDÜZ VE GECE MODUNDA PARLAK RENKLİ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1 items-stretch">
        {/* Card: Bu Ay Ödenecek Taksit */}
        <motion.div
          whileHover={{ 
            scale: 1.015, 
            y: -2, 
            boxShadow: "0 18px 34px -10px rgba(139, 92, 246, 0.35)",
            borderColor: "rgba(167, 139, 250, 0.7)" 
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative overflow-hidden flex flex-col justify-between p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-900 dark:from-violet-950 dark:via-slate-900 dark:to-purple-950 border-2 border-violet-400/40 dark:border-violet-500/40 text-white shadow-xl shadow-purple-500/20 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-3 bg-white/20 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-inner border border-white/30">
              <CalendarDays className="w-5 h-5 animate-pulse" />
            </div>
            
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-black tracking-wider text-violet-100 uppercase block mb-0.5">
                {translate("Bu Ay Ödenecek Taksit")}
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight leading-none drop-shadow-xs">
                  {format(monthlyInstallmentsDue)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-[10px] font-semibold text-violet-100 relative z-10">
            <span>{translate("Aktif Ödeme Planları")}</span>
            <span className="font-bold text-white bg-white/20 border border-white/30 px-2.5 py-0.5 rounded-full shadow-xs">
              Cari Taksit Yükümlülüğü
            </span>
          </div>
        </motion.div>

        {/* Card: Ödeme İlerlemesi & Bu Ay Yapılan Ödeme Adedi */}
        <motion.div
          whileHover={{ 
            scale: 1.015, 
            y: -2, 
            boxShadow: "0 18px 34px -10px rgba(16, 185, 129, 0.35)",
            borderColor: "rgba(52, 211, 153, 0.7)" 
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative overflow-hidden flex flex-col justify-between p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-900 dark:from-emerald-950 dark:via-slate-900 dark:to-teal-950 border-2 border-emerald-400/40 dark:border-emerald-500/40 text-white shadow-xl shadow-emerald-500/20 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between gap-2 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/20 text-white rounded-2xl flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-black tracking-wider text-emerald-100 uppercase block leading-none">
                  {translate("Ödeme İlerlemesi")}
                </span>
                <span className="text-[9.5px] font-bold text-emerald-200 mt-1 block">
                  {monthlyPaymentsCount} {translate("Adet Ödeme Belgelendi")}
                </span>
              </div>
            </div>
            
            <span className="px-2.5 py-1 bg-white/20 border border-white/30 text-white text-xs font-black rounded-xl font-mono shadow-xs">
              %{paymentProgress.toFixed(1)}
            </span>
          </div>

          <div className="mt-4 space-y-1.5 relative z-10">
            <div className="w-full bg-black/25 dark:bg-slate-900/70 h-3 rounded-full overflow-hidden flex shadow-inner relative border border-white/15">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-200 rounded-full shadow-sm"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(paymentProgress, 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center justify-between text-[9.5px] text-emerald-100 font-medium">
              <span>{format(stats.totalPaid)} {language === "tr" ? "kapatıldı" : "settled"}</span>
              <span className="font-bold text-white drop-shadow-xs">Hedef: {format(stats.totalDebt)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sponsor / Google AdMob Banner section for free tier - Placed above AI & Alarms section (Only show when there is actual content) */}
      {!isPremium && hasContent && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 pt-2.5 pb-1"
        >
          <AdMobBanner unitType="banner" />
          <div className="flex justify-end pr-2">
            <button
              type="button"
              onClick={onUpgradeClick}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-500 hover:text-amber-600 dark:text-amber-400 text-[9px] font-black rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1 uppercase tracking-tight"
            >
              💎 PRO'YA GEÇ
            </button>
          </div>
        </motion.div>
      )}

      {/* Bütçe Hedefi Belirleme ve Kontrol Paneli */}
      {(() => {
        const totalExpense = stats.totalExpense;
        const isOverGoal = totalExpense > budgetGoal;
        const expensePercentage = budgetGoal > 0 ? (totalExpense / budgetGoal) * 100 : 0;
        const isCloseToGoal = !isOverGoal && expensePercentage >= 85;

        return (
          <motion.div
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-3xl border transition-all duration-500 overflow-hidden relative shadow-sm ${
              isOverGoal
                ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 shadow-[0_0_20px_rgba(239,68,68,0.12)]"
                : isCloseToGoal
                ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-400 dark:border-amber-900/60 shadow-[0_0_15px_rgba(245,158,11,0.08)]"
                : "bg-white dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50"
            }`}
          >
            {/* Dynamic danger/warning heartbeat pulse border overlay */}
            {(isOverGoal || isCloseToGoal) && (
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-3xl border-2 z-20"
                animate={{
                  borderColor: isOverGoal
                    ? ["rgba(239,68,68,0.15)", "rgba(239,68,68,0.75)", "rgba(239,68,68,0.15)"]
                    : ["rgba(245,158,11,0.15)", "rgba(245,158,11,0.6)", "rgba(245,158,11,0.15)"],
                  boxShadow: isOverGoal
                    ? [
                        "inset 0 0 8px rgba(239,68,68,0.05)",
                        "inset 0 0 22px rgba(239,68,68,0.22)",
                        "inset 0 0 8px rgba(239,68,68,0.05)"
                      ]
                    : [
                        "inset 0 0 6px rgba(245,158,11,0.02)",
                        "inset 0 0 18px rgba(245,158,11,0.16)",
                        "inset 0 0 6px rgba(245,158,11,0.02)"
                      ]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut"
                }}
              />
            )}

            {/* Ambient dynamic micro-glow */}
            <div
              className="absolute -right-12 -top-12 w-32 h-32 rounded-full blur-3xl opacity-10 dark:opacity-20 transition-all duration-500"
              style={{
                backgroundColor: isOverGoal ? "#ef4444" : isCloseToGoal ? "#f59e0b" : "#10b981",
              }}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/40 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl relative ${
                  isOverGoal
                    ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                    : isCloseToGoal
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                }`}>
                  {/* Expanding echo ripple rings */}
                  {(isOverGoal || isCloseToGoal) && (
                    <motion.span
                      className={`absolute inset-0 rounded-2xl ${
                        isOverGoal ? "bg-rose-400/30" : "bg-amber-400/30"
                      }`}
                      animate={{ scale: [1, 1.4, 1], opacity: [0.65, 0, 0.65] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.8,
                        ease: "easeOut"
                      }}
                    />
                  )}
                  <Coins className="w-5 h-5 relative z-10" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight flex flex-wrap items-center gap-2">
                    Aylık Bütçe Hedefi Planlayıcı
                    {isOverGoal && (
                      <motion.span
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="px-2 py-0.5 text-[9px] font-black tracking-wider bg-rose-600 text-white rounded-full uppercase shadow-[0_0_10px_rgba(239,68,68,0.45)] select-none shrink-0"
                      >
                        LİMİT AŞILDI! 🚨
                      </motion.span>
                    )}
                    {isCloseToGoal && (
                      <motion.span
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="px-2 py-0.5 text-[9px] font-black tracking-wider bg-amber-500 text-slate-950 rounded-full uppercase shadow-[0_0_8px_rgba(245,158,11,0.35)] select-none shrink-0"
                      >
                        YAKLAŞILDI! ⚠️
                      </motion.span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 font-extrabold tracking-wider uppercase pt-0.5">
                    Mali Gider Limit Takip Sistemi
                  </p>
                </div>
              </div>

              {/* Goal Input Controls / Display */}
              <div className="flex items-center gap-2 shrink-0">
                {isEditingGoal ? (
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-inner">
                    <span className="text-xs text-indigo-500 font-bold pl-2">{currencySymbol}</span>
                    <input
                      type="number"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="w-24 bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 font-bold font-mono outline-hidden px-1 py-1"
                      placeholder="Hedef bütçe"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveGoal}
                      className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition active:scale-95 shrink-0 cursor-pointer"
                      title="Kaydet"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingGoal(false);
                        const curRate = rates[activeCurrency] || 1;
                        setGoalInput(Number((budgetGoal / curRate).toFixed(2)).toString());
                      }}
                      className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg transition active:scale-95 shrink-0 cursor-pointer"
                      title="İptal cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                      Belirlenen Hedef: <span className="font-extrabold text-slate-900 dark:text-white font-mono">{format(budgetGoal)}</span>
                    </p>
                    <button
                      onClick={() => {
                        const curRate = rates[activeCurrency] || 1;
                        setGoalInput(Number((budgetGoal / curRate).toFixed(2)).toString());
                        setIsEditingGoal(true);
                      }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer"
                      title="Hedefi Düzenle"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Visual Progress and Numerical Breakdowns */}
            <div className="grid md:grid-cols-12 gap-6 pt-5 relative z-10 font-sans">
              {/* Detailed Numbers */}
              <div className="md:col-span-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                    <span className="text-[9px] font-black tracking-widest text-slate-600 dark:text-slate-300 uppercase block">
                      TOPLAM GİDER
                    </span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono leading-none block mt-1.5">
                      {format(totalExpense)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                    <span className="text-[9px] font-black tracking-widest text-slate-600 dark:text-slate-300 uppercase block">
                      BÜTÇE HEDEFİ
                    </span>
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono leading-none block mt-1.5">
                      {format(budgetGoal)}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-linear-to-r from-slate-50/70 to-slate-100/30 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-100/80 dark:border-slate-800/60">
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 font-extrabold tracking-wider uppercase">
                    HARCAMA / LİMİT DURUMU
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold pt-1.5 leading-relaxed">
                    Toplam bütçenizin <span className="font-extrabold text-indigo-500 dark:text-indigo-400">%{expensePercentage.toFixed(1)}</span> kadarını harcadınız.
                  </p>
                </div>
              </div>

              {/* Progress Slider Bar and Warnings */}
              <div className="md:col-span-7 flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
                    <span>Gider İlerlemesi</span>
                    <span className={isOverGoal ? "text-rose-500 font-black" : isCloseToGoal ? "text-amber-500 font-black" : "text-emerald-500 font-black"}>
                      %{expensePercentage.toFixed(1)}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-700/50 h-3.5 rounded-full overflow-hidden flex shadow-inner">
                    <motion.div
                      layout
                      initial={{ width: 0 }}
                      animate={
                        isOverGoal
                          ? {
                              width: `${Math.min(expensePercentage, 100)}%`,
                              opacity: [0.8, 1, 0.8]
                            }
                          : isCloseToGoal
                          ? {
                              width: `${Math.min(expensePercentage, 100)}%`,
                              opacity: [0.9, 1, 0.9]
                            }
                          : { width: `${Math.min(expensePercentage, 100)}%` }
                      }
                      transition={
                        (isOverGoal || isCloseToGoal)
                          ? {
                              width: { duration: 0.8, ease: "easeOut" },
                              opacity: { repeat: Infinity, duration: 1.6, ease: "easeInOut" }
                            }
                          : { duration: 0.8, ease: "easeOut" }
                      }
                      className={`h-full rounded-full ${
                        isOverGoal
                          ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                          : isCloseToGoal
                          ? "bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                          : "bg-gradient-to-r from-emerald-500 to-teal-400"
                      }`}
                    />
                  </div>
                </div>

                {/* Alarm Status Block */}
                {isOverGoal ? (
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-3.5 bg-rose-500/10 dark:bg-rose-950/30 border border-rose-200/40 dark:border-rose-900/40 rounded-2xl flex items-start gap-3"
                  >
                    <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <p className="text-xs font-black text-rose-700 dark:text-rose-400">
                        Bütçe Aşımı Uyarısı!
                      </p>
                      <p className="text-[10px] text-rose-600/90 dark:text-rose-300 font-medium leading-relaxed pt-0.5">
                        Aylık harcama limitinizi <span className="font-extrabold font-mono text-xs">{format(totalExpense - budgetGoal)}</span> geçtiniz. Tasarruf tedbirleri almanız gerekebilir.
                      </p>
                    </div>
                  </motion.div>
                ) : isCloseToGoal ? (
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-3.5 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-200/40 dark:border-amber-900/40 rounded-2xl flex items-start gap-3"
                  >
                    <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="text-xs font-black text-amber-700 dark:text-amber-400">
                        Kritik Sınıra Yaklaştınız
                      </p>
                      <p className="text-[10px] text-amber-600/90 dark:text-amber-300 font-medium leading-relaxed pt-0.5">
                        Giderlerinizin oranı kritiktir (%{expensePercentage.toFixed(1)}). Hedefinizin aşılmaması için zorunlu olmayan yeni harcamalarınızı erteleyebilirsiniz.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-200/40 dark:border-emerald-900/40 rounded-2xl flex items-start gap-3"
                  >
                    <Award className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        Bütçeniz Dengede
                      </p>
                      <p className="text-[10px] text-emerald-600/90 dark:text-emerald-300 font-medium leading-relaxed pt-0.5">
                        Giderleriniz normal değerlerdedir. Aylık harcamalarınız belirlediğiniz hedef bütçenin güvenli sınırları altında seyrediyor.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Günlük Finansal Notlar Panel */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-700/40">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <StickyNote className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              📝 Günlük Finansal Notlar
            </h4>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 font-extrabold tracking-wider uppercase">
              BÜTÇE HEDEFLERİ VE ÖNEMLİ HATIRLATICILAR KILAVUZU
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={(e) => handleAddNote(e)} className="flex gap-2">
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Kısa bir bütçe notu yazın... (örn: Kira gününü takip et)"
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-all font-semibold"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer shrink-0"
          >
            Not Ekle
          </button>
        </form>

        {/* Notes list */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {notes.length === 0 ? (
            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic text-center py-4 font-bold">
              Henüz bir finansal not eklemediniz. Bütçe kararlarınızı buraya not alabilirsiniz.
            </p>
          ) : (
            notes.map((note) => (
              <motion.div
                layout
                key={note.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between gap-3 p-3 bg-slate-50/55 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="text-sm select-none shrink-0">📌</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed break-all">
                    {note.text}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(note.id)}
                  className="p-1.5 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer shrink-0 animate-fade-in"
                  title="Notu sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Visual Analytics Sections Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Paid vs Remaining doughnut */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide text-center mb-2">Ödenen / Kalan Borç Dağılımı</h4>
          <div className="flex-1 flex items-center justify-center">
            <DoughnutChart data={paidRemainingData} />
          </div>
        </div>

        {/* Line curves chart trend */}
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-4 flex flex-col justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">6 Aylık Tahmini Borç Eğilimi</h4>
          <div className="flex-grow">
            <LineChart labels={trendLabels} values={trendValues} lineColor="#3b82f6" />
          </div>
        </div>
      </div>

      {/* İkinci Sponsor Reklamı - Alt Kısmı İçin Google AdMob Native Card (Only show when there is actual content) */}
      {!isPremium && hasContent && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-2"
        >
          <AdMobBanner unitType="native" />
          <div className="flex justify-end pr-2">
            <button
              onClick={onUpgradeClick}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-500 hover:text-amber-600 dark:text-amber-400 text-[9px] font-black rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1 uppercase tracking-tight"
            >
              Reklamları Kaldır 💎 Bütçem Pro'ya Geç
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

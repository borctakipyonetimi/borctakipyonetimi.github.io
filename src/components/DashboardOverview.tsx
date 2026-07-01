/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, PlusCircle, ArrowUpRight, TrendingUp, ShieldAlert, Award, HelpingHand, Bell, Coins, Edit, Check, X, Info, Settings, RefreshCw, CalendarDays, ClipboardCheck, Trash2, StickyNote, Calendar, CheckCircle2 } from "lucide-react";
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
  const { format, currencySymbol, rates, setRates, activeCurrency, isFetching, lastUpdated, updateRatesFromAPI } = useCurrency();
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
    { label: "Gelir", value: stats.totalIncome, color: "#10b981" },
    { label: "Gider", value: stats.totalExpense, color: "#ef4444" },
    { label: "Net Kalan", value: stats.netIncome, color: stats.netIncome >= 0 ? "#f59e0b" : "#ef4444" },
  ];

  const paidRemainingData = [
    { label: "Ödenen Borç", value: stats.totalPaid, color: "#10b981" },
    { label: "Kalan Borç", value: stats.remaining, color: "#ef4444" },
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

      {/* Animated Fast Action Buttons under the Filter Section with beautiful Theme Integration & Premium Glow Effects */}
      {(() => {
        const getActionStyle = () => {
          if (colorTheme === "green") {
            return {
              income: "bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
              expense: "bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/15 dark:hover:bg-red-500/25 text-red-600 dark:text-red-400 border-red-500/20 dark:border-red-500/30 hover:border-red-500 dark:hover:border-red-400 hover:shadow-lg hover:shadow-red-500/10 dark:hover:shadow-red-500/20",
              debt: "bg-teal-500/10 hover:bg-teal-500/20 dark:bg-teal-500/15 dark:hover:bg-teal-500/25 text-teal-600 dark:text-teal-400 border-teal-500/20 dark:border-teal-500/30 hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/10 dark:hover:shadow-teal-500/20",
              badge: "bg-emerald-500 text-white"
            };
          } else if (colorTheme === "purple") {
            return {
              income: "bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
              expense: "bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/15 dark:hover:bg-red-500/25 text-red-600 dark:text-red-400 border-red-500/20 dark:border-red-500/30 hover:border-red-500 dark:hover:border-red-400 hover:shadow-lg hover:shadow-red-500/10 dark:hover:shadow-red-500/20",
              debt: "bg-purple-500/10 hover:bg-purple-500/20 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 border-purple-500/20 dark:border-purple-500/30 hover:border-purple-500 dark:hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20",
              badge: "bg-purple-500 text-white"
            };
          } else if (colorTheme === "orange") {
            return {
              income: "bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
              expense: "bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/15 dark:hover:bg-red-500/25 text-red-600 dark:text-red-400 border-red-500/20 dark:border-red-500/30 hover:border-red-500 dark:hover:border-red-400 hover:shadow-lg hover:shadow-red-500/10 dark:hover:shadow-red-500/20",
              debt: "bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30 hover:border-amber-500 dark:hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20",
              badge: "bg-amber-500 text-white"
            };
          } else { // default indigo
            return {
              income: "bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
              expense: "bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/15 dark:hover:bg-red-500/25 text-red-605 dark:text-red-400 border-red-500/20 dark:border-red-500/30 hover:border-red-500 dark:hover:border-red-400 hover:shadow-lg hover:shadow-red-500/10 dark:hover:shadow-red-500/20",
              debt: "bg-indigo-500/10 hover:bg-indigo-500/20 dark:bg-indigo-500/15 dark:hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-500/30 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/20",
              badge: "bg-indigo-500 text-white"
            };
          }
        };

        const customStyle = getActionStyle();

        return (
          <div className="grid grid-cols-3 gap-3 pt-1">
            {/* Gelir Ekle */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.05 }}
              whileHover={{ 
                scale: 1.05, 
                y: -5,
                boxShadow: "0 20px 25px -5px rgba(16, 185, 129, 0.15), 0 10px 10px -5px rgba(16, 185, 129, 0.1)",
                transition: { type: "spring", stiffness: 400, damping: 15 }
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                localStorage.setItem("auto_open_add_income", "true");
                onNavigate("income");
              }}
              className={`relative overflow-hidden p-3.5 sm:p-5 rounded-2xl border flex flex-col items-center justify-center text-center gap-2.5 transition-all duration-300 cursor-pointer group ${customStyle.income}`}
              id="quick-add-income-btn"
            >
              {/* Dynamic pulse aura in the background */}
              <motion.div 
                className="absolute inset-0 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl -z-10"
                animate={{
                  scale: [1, 1.06, 1],
                  opacity: [0.4, 0.8, 0.4]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              
              <motion.div 
                className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center shrink-0 transition-all duration-300"
                whileHover={{ 
                  rotate: 180, 
                  scale: 1.15,
                  boxShadow: "0 0 15px rgba(16, 185, 129, 0.6)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </motion.div>
              
              <div className="flex flex-col space-y-0.5 z-10">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider group-hover:text-emerald-500 dark:group-hover:text-emerald-350 transition-colors duration-200">
                  {language === "tr" ? "GELİR EKLE" : "ADD INCOME"}
                </span>
                <span className="text-[9px] font-bold opacity-75 leading-none mt-0.5">
                  {language === "tr" ? "Maaş, Kazanç" : "Salary, Earns"}
                </span>
              </div>
            </motion.button>

            {/* Gider Ekle */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              whileHover={{ 
                scale: 1.05, 
                y: -5,
                boxShadow: "0 20px 25px -5px rgba(239, 68, 68, 0.15), 0 10px 10px -5px rgba(239, 68, 68, 0.1)",
                transition: { type: "spring", stiffness: 400, damping: 15 }
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                localStorage.setItem("auto_open_add_expense", "true");
                onNavigate("expenses");
              }}
              className={`relative overflow-hidden p-3.5 sm:p-5 rounded-2xl border flex flex-col items-center justify-center text-center gap-2.5 transition-all duration-300 cursor-pointer group ${customStyle.expense}`}
              id="quick-add-expense-btn"
            >
              {/* Dynamic pulse aura in the background */}
              <motion.div 
                className="absolute inset-0 bg-red-500/5 dark:bg-red-500/10 rounded-2xl -z-10"
                animate={{
                  scale: [1, 1.06, 1],
                  opacity: [0.4, 0.8, 0.4]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.4
                }}
              />

              <motion.div 
                className="p-2.5 bg-red-500 text-white rounded-xl shadow-md shadow-red-500/20 flex items-center justify-center shrink-0 transition-all duration-300"
                whileHover={{ 
                  y: -4, 
                  x: 4,
                  scale: 1.15,
                  boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6 rotate-90" />
              </motion.div>

              <div className="flex flex-col space-y-0.5 z-10">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider group-hover:text-red-500 dark:group-hover:text-red-350 transition-colors duration-200">
                  {language === "tr" ? "GİDER EKLE" : "ADD EXPENSE"}
                </span>
                <span className="text-[9px] font-bold opacity-75 leading-none mt-0.5">
                  {language === "tr" ? "Market, Fatura" : "Market, Bills"}
                </span>
              </div>
            </motion.button>

            {/* Borç Ekle */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
              whileHover={{ 
                scale: 1.05, 
                y: -5,
                boxShadow: "0 20px 25px -5px rgba(99, 102, 241, 0.15), 0 10px 10px -5px rgba(99, 102, 241, 0.1)",
                transition: { type: "spring", stiffness: 400, damping: 15 }
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                localStorage.setItem("auto_open_add_debt", "true");
                onNavigate("debts");
              }}
              className={`relative overflow-hidden p-3.5 sm:p-5 rounded-2xl border flex flex-col items-center justify-center text-center gap-2.5 transition-all duration-300 cursor-pointer group ${customStyle.debt}`}
              id="quick-add-debt-btn"
            >
              {/* Dynamic pulse aura in the background */}
              <motion.div 
                className="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl -z-10"
                animate={{
                  scale: [1, 1.06, 1],
                  opacity: [0.4, 0.8, 0.4]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.8
                }}
              />

              <motion.div 
                className={`p-2.5 rounded-xl shadow-md flex items-center justify-center shrink-0 transition-all duration-300 ${customStyle.badge}`}
                whileHover={{ 
                  y: -5,
                  scale: 1.15,
                  boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
              </motion.div>

              <div className="flex flex-col space-y-0.5 z-10">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider group-hover:opacity-100 transition-opacity duration-200">
                  {language === "tr" ? "BORÇ EKLE" : "ADD DEBT"}
                </span>
                <span className="text-[9px] font-bold opacity-75 leading-none mt-0.5">
                  {language === "tr" ? "Kredi, Şahıs" : "Loans, Handouts"}
                </span>
              </div>
            </motion.button>
          </div>
        );
      })()}

      {/* 4x Grid Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="p-4 bg-indigo-600 dark:bg-indigo-950/85 text-white rounded-3xl space-y-1.5 relative overflow-hidden group shadow-md hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[100px]">
          <span className="text-[10px] font-bold text-indigo-200 block uppercase tracking-wide">TOPLAM BORÇ</span>
          <p className="text-sm sm:text-lg font-black font-mono">{format(stats.totalDebt)}</p>
        </div>

        <div className="p-4 bg-emerald-600 text-white rounded-3xl space-y-1.5 relative overflow-hidden group shadow-md hover:shadow-lg transition flex flex-col items-center justify-center text-center min-h-[100px]">
          <span className="text-[10px] font-bold text-emerald-100 block uppercase tracking-wide">
            {language === "tr" ? "ÖDENMİŞ KISIM" : "TOTAL REPAID"}
          </span>
          <p className="text-sm sm:text-lg font-black font-mono">{format(stats.totalPaid)}</p>
        </div>

        <div className="flex flex-col gap-3 h-full justify-between">
          <div className="p-3.5 bg-indigo-500/10 dark:bg-indigo-950/40 border border-indigo-500/20 text-indigo-950 dark:text-indigo-200 rounded-3xl space-y-0.5 relative overflow-hidden flex-1 shadow-sm flex flex-col items-center justify-center text-center min-h-[50px]">
            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase tracking-wide">
              {language === "tr" ? "BU AYKİ BORÇ TOPLAMI" : "MONTHLY TOTAL LOANS"}
            </span>
            <p className="text-sm sm:text-base font-extrabold font-mono">{format(stats.thisMonthTotalBorc)}</p>
          </div>

          <div className="p-3.5 bg-rose-600 text-white rounded-3xl space-y-0.5 relative overflow-hidden flex-1 shadow-md hover:shadow-lg transition flex flex-col items-center justify-center text-center min-h-[50px]">
            <span className="text-[9px] font-bold text-rose-100 block uppercase tracking-wide">
              {language === "tr" ? "BU AY KALAN BORÇ" : "MONTH WRAP REMAINING"}
            </span>
            <p className="text-sm sm:text-base font-extrabold font-mono">{format(stats.thisMonthKalanBorc)}</p>
          </div>
        </div>

        <div className="p-4 bg-blue-600 text-white rounded-3xl space-y-1.5 relative overflow-hidden shadow-md transition flex flex-col items-center justify-center text-center min-h-[100px]">
          <span className="text-[10px] font-bold text-blue-105 block uppercase tracking-wide">
            {language === "tr" ? "AYLIK GELİR" : "MONTHLY INCOME"}
          </span>
          <p className="text-sm sm:text-lg font-black font-mono">{format(stats.totalIncome)}</p>
          {stats.carryOverBalance !== undefined && stats.carryOverBalance !== 0 && (
            <span className="text-[9px] text-blue-100 font-extrabold block bg-blue-700/50 px-2 py-0.5 rounded-lg mt-1">
              {translate("Önceki Aydan Devreden")}: {format(stats.carryOverBalance)}
            </span>
          )}
        </div>

        <div className="p-4 bg-amber-600 text-white rounded-3xl space-y-1.5 relative overflow-hidden shadow-md transition flex flex-col items-center justify-center text-center min-h-[100px]">
          <span className="text-[10px] font-bold text-amber-105 block uppercase tracking-wide">
            {language === "tr" ? "AYLIK GİDER" : "MONTHLY OUTFLOW"}
          </span>
          <p className="text-sm sm:text-lg font-black font-mono">{format(stats.totalExpense)}</p>
        </div>

        <div className={`p-4 text-white rounded-3xl space-y-1.5 relative overflow-hidden shadow-md transition flex flex-col items-center justify-center text-center min-h-[100px] ${stats.netIncome >= 0 ? "bg-indigo-600" : "bg-red-700"}`}>
          <span className="text-[10px] font-bold text-indigo-105 block uppercase tracking-wide">
            {language === "tr" ? "NET KALAN REZERV" : "NET SURPLUS VALUE"}
          </span>
          <p className="text-sm sm:text-lg font-black font-mono">{format(stats.netIncome)}</p>
          {stats.carryOverBalance !== undefined && stats.carryOverBalance !== 0 && (
            <span className="text-[9px] text-indigo-100 font-extrabold block bg-white/10 px-2 py-0.5 rounded-lg mt-1">
              {language === "tr" ? `Devreden: +${format(stats.carryOverBalance)}` : `Carried Over: +${format(stats.carryOverBalance)}`}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 pb-1 items-start">
        {/* Card 1: Bu Ay Ödenecek Taksit */}
        <motion.div
          whileHover={{ 
            scale: 1.02, 
            y: -3, 
            boxShadow: "0 15px 30px -10px rgba(139, 92, 246, 0.25)",
            borderColor: "rgba(139, 92, 246, 0.4)" 
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative overflow-hidden flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-violet-500/10 to-indigo-500/5 dark:from-violet-950/20 dark:to-indigo-950/10 border border-violet-500/20 dark:border-violet-500/30 shadow-xs h-full transition-colors duration-300"
        >
          {/* Background Decorative Blur Orb */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="p-3.5 bg-violet-500/15 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <CalendarDays className="w-5.5 h-5.5 animate-pulse" />
          </div>
          
          <div className="flex-1 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-black tracking-widest text-violet-500 dark:text-violet-400 uppercase block mb-1">
              {translate("Bu Ay Ödenecek Taksit")}
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono text-violet-800 dark:text-violet-200 tracking-tight leading-none">
                {format(monthlyInstallmentsDue)}
              </span>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-1">
              {translate("Aktif ödeme planlarındaki cari ay taksit yükümlülüğü")}
            </p>
          </div>
        </motion.div>

        {/* Right Stack: Card 2 & Progress Card */}
        <div className="space-y-4">
          {/* Card 2: Bu Ay Yapılan Ödeme Adedi */}
          <motion.div
            whileHover={{ 
              scale: 1.02, 
              y: -3, 
              boxShadow: "0 15px 30px -10px rgba(245, 158, 11, 0.25)",
              borderColor: "rgba(245, 158, 11, 0.4)" 
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative overflow-hidden flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 dark:from-amber-950/20 dark:to-yellow-950/10 border border-amber-500/20 dark:border-amber-500/30 shadow-xs transition-colors duration-300"
          >
            {/* Background Decorative Blur Orb */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="p-3.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <ClipboardCheck className="w-5.5 h-5.5 animate-bounce duration-[3000ms]" />
            </div>
            
            <div className="flex-1 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-black tracking-widest text-amber-600 dark:text-amber-400 uppercase block mb-1">
                {translate("Bu Ay Yapılan Ödemeler")}
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-800 dark:text-amber-200 tracking-tight leading-none">
                  {monthlyPaymentsCount} <span className="text-xs sm:text-sm font-bold text-amber-600/80">{translate("Adet")}</span>
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-1">
                {translate("Sisteminizde bu ay başarıyla belgelenen ödeme sayısı")}
              </p>
            </div>
          </motion.div>

          {/* Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.01 }}
            className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/65 dark:border-slate-700/60 shadow-sm space-y-4 relative overflow-hidden"
          >
            {/* Background dynamic blur orb */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">{translate("Ödeme İlerlemesi")}</h4>
              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl font-mono">
                %{paymentProgress.toFixed(1)} {translate("Ödendi")}
              </span>
            </div>
            
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-4 rounded-full overflow-hidden flex shadow-inner relative">
              <motion.div
                className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(paymentProgress, 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
            
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {language === "tr"
                ? `Toplam ${format(stats.totalDebt)} borcun ${format(stats.totalPaid)} kadarı ödendi. Sabırla ve planlı ödemelerle borçlarını sıfırlayabilirsin!`
                : `Out of total ${format(stats.totalDebt)} debt, ${format(stats.totalPaid)} has been paid. With structured payments, you can settle your balances fully!`}
            </p>
          </motion.div>
        </div>
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

      {/* Dynamic CTA Encouragement banner - Premium Animated Mesh Banner */}
      <div className="banner-premium-gradient p-6 sm:p-8 rounded-3xl text-white space-y-5 relative overflow-hidden shadow-2xl border border-indigo-500/20 group hover:shadow-indigo-950/20 transition-all duration-500">
        
        {/* Animated Background Floating Bubble Orbs */}
        <div className="absolute top-[-30px] right-[-10px] w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl mix-blend-screen pointer-events-none animate-pulse duration-[6000ms]" />
        <div className="absolute bottom-[-50px] left-[20%] w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl mix-blend-screen pointer-events-none animate-pulse duration-[8000ms]" />
        
        {/* Decorative dynamic diagonal shine beam */}
        <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1500ms] pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5 max-w-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/15 rounded-full text-[10px] font-black tracking-widest text-[#f59e0b] uppercase flex items-center gap-1.5 animate-bounce">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" /> YENİ NESİL AI & CEP UYARILARI
              </span>
              <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[9px] font-black tracking-widest text-emerald-300 uppercase">
                %100 AKTİF VE GÜVENLİ
              </span>
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-white drop-shadow-sm">
              Borçlarından Arın, Bütçeni <span className="bg-gradient-to-r from-teal-300 via-emerald-200 to-indigo-300 bg-clip-text text-transparent">Yapay Zeka</span> ile Yönet!
            </h3>
            
            <p className="text-slate-200/90 text-xs font-semibold leading-relaxed">
              Bütçem Pro akıllı borç kapatma simülasyonu, anlık telefon alarmı hatırlatıcıları ve cana yakın AI finans koçuyla sizi bekliyor.
            </p>
          </div>

          <div className="flex sm:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate("aiStrategy")}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-indigo-950 font-black text-[10px] rounded-2xl shadow-lg flex items-center justify-center gap-2 transition duration-300 transform hover:scale-[1.03] active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span>AI BAŞLAT</span>
            </button>
            <button
              onClick={() => onNavigate("notifications")}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-[10px] rounded-2xl border border-white/15 flex items-center justify-center gap-2 backdrop-blur-xs transition duration-300 transform hover:scale-[1.03] active:scale-95 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-indigo-300" />
              <span>ALARMLAR</span>
            </button>
          </div>
        </div>

        {/* Small Progress Tracker Pill inside the banner */}
        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-[10px] tracking-wide uppercase">Finansal Sağlık Durumu: <span className="text-emerald-300 font-bold">Takip Ediliyor</span></span>
          </div>
          <p className="text-[10px] font-mono font-bold tracking-wider text-indigo-200">
            Toplam Borç Ödeme İlerlemesi: %{paymentProgress.toFixed(1)}
          </p>
        </div>
      </div>

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

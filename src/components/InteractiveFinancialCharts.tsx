/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as d3 from "d3";
import {
  PieChart as LucidePie,
  BarChart3,
  LineChart as LucideLine,
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingBag,
  CreditCard,
  Layers,
  Calendar,
  Filter,
  Sparkles,
  Info,
  Maximize2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2
} from "lucide-react";
import { Debt, Income, Expense, InstallmentDebt, PaymentLog } from "../types";
import { useCurrency } from "../utils/CurrencyContext";
import { parseDateParts } from "../utils/dateUtils";

export type ChartType = "donut" | "bar" | "line";
export type DataCategory = "all" | "expenses" | "incomes" | "debts" | "installments";
export type TimeRange = "current_month" | "last_6_months" | "all_time";

interface InteractiveFinancialChartsProps {
  incomes: Income[];
  expenses: Expense[];
  debts: Debt[];
  installmentDebts?: InstallmentDebt[];
  payments?: PaymentLog[];
  language?: "tr" | "en";
  className?: string;
  defaultChartType?: ChartType;
  defaultCategory?: DataCategory;
}

interface ChartItem {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number;
  percentage?: number;
  color: string;
  secondaryColor?: string;
  category?: string;
  count?: number;
}

// Preset modern color palette adhering to the app's refined identity
const PALETTE = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#0ea5e9", // Sky Blue
  "#f43f5e", // Rose
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#14b8a6", // Teal
  "#ec4899", // Pink
  "#f97316", // Orange
  "#64748b", // Slate
];

export const InteractiveFinancialCharts: React.FC<InteractiveFinancialChartsProps> = ({
  incomes = [],
  expenses = [],
  debts = [],
  installmentDebts = [],
  payments = [],
  language = "tr",
  className = "",
  defaultChartType = "donut",
  defaultCategory = "all",
}) => {
  const { format } = useCurrency();
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [activeCategory, setActiveCategory] = useState<DataCategory>(defaultCategory);
  const [timeRange, setTimeRange] = useState<TimeRange>("current_month");
  const [hoveredItem, setHoveredItem] = useState<ChartItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<ChartItem | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // 1. Filtered data slices based on selected time range
  const { filteredIncomes, filteredExpenses, filteredDebts, filteredInstallments } = useMemo(() => {
    if (timeRange === "all_time") {
      return {
        filteredIncomes: incomes,
        filteredExpenses: expenses,
        filteredDebts: debts,
        filteredInstallments: installmentDebts,
      };
    }

    if (timeRange === "current_month") {
      const selectedTime = currentYear * 12 + currentMonth;
      
      const inc = incomes.filter((i) => {
        const parts = parseDateParts(i.date);
        if (!parts) return true;
        if (i.isRecurring !== false) {
          const incTime = parts.year * 12 + parts.month;
          return selectedTime >= incTime;
        }
        return parts.year === currentYear && parts.month === currentMonth;
      });

      const exp = expenses.filter((e) => {
        const parts = parseDateParts(e.date);
        if (!parts) return false;
        return parts.year === currentYear && parts.month === currentMonth;
      });

      // Active debts with payments or remaining this month
      const dbt = debts.filter((d) => {
        if (!d.dueDate) return true;
        const parts = parseDateParts(d.dueDate);
        if (!parts) return true;
        return parts.year === currentYear && parts.month === currentMonth;
      });

      return {
        filteredIncomes: inc,
        filteredExpenses: exp,
        filteredDebts: dbt.length > 0 ? dbt : debts,
        filteredInstallments: installmentDebts,
      };
    }

    // Last 6 months
    const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1);
    const inc = incomes.filter((i) => {
      const parts = parseDateParts(i.date);
      if (!parts) return true;
      const d = new Date(parts.year, parts.month, parts.day || 1);
      return d >= sixMonthsAgo;
    });

    const exp = expenses.filter((e) => {
      const parts = parseDateParts(e.date);
      if (!parts) return false;
      const d = new Date(parts.year, parts.month, parts.day || 1);
      return d >= sixMonthsAgo;
    });

    return {
      filteredIncomes: inc,
      filteredExpenses: exp,
      filteredDebts: debts,
      filteredInstallments: installmentDebts,
    };
  }, [incomes, expenses, debts, installmentDebts, timeRange, currentYear, currentMonth]);

  // Totals calculations
  const totalIncome = useMemo(
    () => filteredIncomes.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [filteredIncomes]
  );

  const totalExpense = useMemo(
    () => filteredExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [filteredExpenses]
  );

  const totalDebtRemaining = useMemo(() => {
    return filteredDebts.reduce((acc, item) => {
      const paid = Number(item.paid) || 0;
      const total = Number(item.amount) || 0;
      return acc + Math.max(0, total - paid);
    }, 0);
  }, [filteredDebts]);

  const totalInstallmentLoad = useMemo(() => {
    return filteredInstallments.reduce((acc, item) => {
      const paidCount = Number(item.paidInstallmentCount) || 0;
      const totalCount = Number(item.installmentCount) || 1;
      const totalAmt = Number(item.totalAmount) || 0;
      const perMonth = totalCount > 0 ? totalAmt / totalCount : 0;
      const remainingCount = Math.max(0, totalCount - paidCount);
      return acc + remainingCount * perMonth;
    }, 0);
  }, [filteredInstallments]);

  const netCashFlow = totalIncome - totalExpense;

  // 2. Prepare dynamic dataset based on selected category filter
  const chartData: ChartItem[] = useMemo(() => {
    if (activeCategory === "all") {
      // General financial flow overview
      const items: ChartItem[] = [];
      if (totalIncome > 0) {
        items.push({
          id: "income",
          label: language === "tr" ? "Toplam Gelir" : "Total Income",
          value: totalIncome,
          color: "#10b981", // Emerald
          category: "income",
        });
      }
      if (totalExpense > 0) {
        items.push({
          id: "expense",
          label: language === "tr" ? "Toplam Gider" : "Total Expense",
          value: totalExpense,
          color: "#f43f5e", // Rose
          category: "expense",
        });
      }
      if (totalDebtRemaining > 0) {
        items.push({
          id: "debt",
          label: language === "tr" ? "Kalan Borçlar" : "Remaining Debts",
          value: totalDebtRemaining,
          color: "#6366f1", // Indigo
          category: "debt",
        });
      }
      if (totalInstallmentLoad > 0) {
        items.push({
          id: "installment",
          label: language === "tr" ? "Taksit Yükü" : "Installment Load",
          value: totalInstallmentLoad,
          color: "#0ea5e9", // Sky
          category: "installment",
        });
      }

      // If everything is zero, provide empty list
      if (items.length === 0) return [];
      const sum = items.reduce((s, it) => s + it.value, 0);
      return items.map((it) => ({
        ...it,
        percentage: sum > 0 ? (it.value / sum) * 100 : 0,
      }));
    }

    if (activeCategory === "expenses") {
      // Expenses by category
      const catMap = new Map<string, number>();
      filteredExpenses.forEach((exp) => {
        const cat = exp.category || (language === "tr" ? "Diğer" : "Other");
        catMap.set(cat, (catMap.get(cat) || 0) + (Number(exp.amount) || 0));
      });

      const sorted = Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1]);

      const sum = sorted.reduce((s, [, val]) => s + val, 0);
      return sorted.map(([cat, val], idx) => ({
        id: `exp-${idx}`,
        label: cat,
        value: val,
        color: PALETTE[idx % PALETTE.length],
        percentage: sum > 0 ? (val / sum) * 100 : 0,
      }));
    }

    if (activeCategory === "incomes") {
      // Incomes by name/category
      const catMap = new Map<string, number>();
      filteredIncomes.forEach((inc) => {
        const cat = (inc as any).category || inc.name || (language === "tr" ? "Maaş / Düzenli" : "Salary / Regular");
        catMap.set(cat, (catMap.get(cat) || 0) + (Number(inc.amount) || 0));
      });

      const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
      const sum = sorted.reduce((s, [, val]) => s + val, 0);
      return sorted.map(([cat, val], idx) => ({
        id: `inc-${idx}`,
        label: cat,
        value: val,
        color: PALETTE[(idx + 1) % PALETTE.length],
        percentage: sum > 0 ? (val / sum) * 100 : 0,
      }));
    }

    if (activeCategory === "debts") {
      // Debts breakdown (remaining vs paid for each top debt)
      const sortedDebts = [...filteredDebts]
        .map((d) => {
          const total = Number(d.amount) || 0;
          const paid = Number(d.paid) || 0;
          const remaining = Math.max(0, total - paid);
          return {
            id: String(d.id),
            label: d.name || (language === "tr" ? "İsimsiz Borç" : "Unnamed Debt"),
            value: remaining,
            secondaryValue: paid,
          };
        })
        .filter((d) => d.value > 0 || (d.secondaryValue || 0) > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8); // Top 8 debts

      const sum = sortedDebts.reduce((s, it) => s + it.value, 0);
      return sortedDebts.map((d, idx) => ({
        ...d,
        color: PALETTE[(idx + 2) % PALETTE.length],
        percentage: sum > 0 ? (d.value / sum) * 100 : 0,
      }));
    }

    if (activeCategory === "installments") {
      // Installments breakdown
      const sorted = [...filteredInstallments]
        .map((inst) => {
          const paidCount = Number(inst.paidInstallmentCount) || 0;
          const totalCount = Number(inst.installmentCount) || 1;
          const totalAmt = Number(inst.totalAmount) || 0;
          const monthly = totalCount > 0 ? totalAmt / totalCount : 0;
          const remaining = Math.max(0, totalCount - paidCount) * monthly;
          return {
            id: String(inst.id),
            label: inst.name || (language === "tr" ? "İsimsiz Taksit" : "Unnamed Installment"),
            value: remaining,
            count: totalCount - paidCount,
          };
        })
        .filter((i) => i.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      const sum = sorted.reduce((s, it) => s + it.value, 0);
      return sorted.map((it, idx) => ({
        ...it,
        color: PALETTE[(idx + 3) % PALETTE.length],
        percentage: sum > 0 ? (it.value / sum) * 100 : 0,
      }));
    }

    return [];
  }, [
    activeCategory,
    totalIncome,
    totalExpense,
    totalDebtRemaining,
    totalInstallmentLoad,
    filteredExpenses,
    filteredIncomes,
    filteredDebts,
    filteredInstallments,
    language,
  ]);

  const totalChartValue = useMemo(
    () => chartData.reduce((acc, item) => acc + item.value, 0),
    [chartData]
  );

  // Active item for tooltip / central HUD
  const activeHoverItem = hoveredItem || selectedItem || (chartData.length > 0 ? chartData[0] : null);

  // -------------------------------------------------------------
  // D3 CALCULATIONS FOR GRAPHIC MODES
  // -------------------------------------------------------------

  // 1. Donut Pie Arcs
  const pieArcs = useMemo(() => {
    if (chartData.length === 0) return [];
    const pieGen = d3
      .pie<ChartItem>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(0.03);
    return pieGen(chartData);
  }, [chartData]);

  // 2. Bar Chart Scales
  const barChartConfig = useMemo(() => {
    if (chartData.length === 0) return { maxVal: 0, items: [] };
    const maxVal = d3.max(chartData, (d) => d.value) || 1;
    return {
      maxVal,
      items: chartData,
    };
  }, [chartData]);

  // 3. Line / Area Chart Points & Smooth Path
  const lineChartConfig = useMemo(() => {
    if (chartData.length === 0) return { path: "", areaPath: "", points: [] };
    const width = 360;
    const height = 180;
    const paddingX = 35;
    const paddingY = 25;

    const xScale = d3
      .scalePoint<string>()
      .domain(chartData.map((d) => d.label))
      .range([paddingX, width - paddingX]);

    const maxVal = d3.max(chartData, (d) => d.value) || 1;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxVal * 1.15])
      .range([height - paddingY, paddingY]);

    const points = chartData.map((d) => ({
      x: xScale(d.label) || paddingX,
      y: yScale(d.value),
      item: d,
    }));

    // Smooth spline line
    const lineGen = d3
      .line<{ x: number; y: number }>()
      .x((p) => p.x)
      .y((p) => p.y)
      .curve(d3.curveMonotoneX);

    // Area generator for rich gradient fill
    const areaGen = d3
      .area<{ x: number; y: number }>()
      .x((p) => p.x)
      .y0(height - paddingY)
      .y1((p) => p.y)
      .curve(d3.curveMonotoneX);

    const path = lineGen(points) || "";
    const areaPath = areaGen(points) || "";

    return { path, areaPath, points, width, height, paddingY };
  }, [chartData]);

  return (
    <div
      className={`p-5 sm:p-7 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6 ${className}`}
    >
      {/* HEADER SECTION: Title, KPI badges & Filter Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {language === "tr"
                  ? "İnteraktif Finansal Grafik Stüdyosu"
                  : "Interactive Financial Chart Studio"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === "tr"
                  ? "Gelir, gider, borç ve taksit akışınızı dinamik grafik türleriyle derinlemesine analiz edin"
                  : "Analyze your income, expense, debt and installment flows dynamically"}
              </p>
            </div>
          </div>
        </div>

        {/* TIME RANGE SELECTOR */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#1E293B] p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setTimeRange("current_month")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              timeRange === "current_month"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {language === "tr" ? "Bu Ay" : "This Month"}
          </button>
          <button
            onClick={() => setTimeRange("last_6_months")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              timeRange === "last_6_months"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {language === "tr" ? "Son 6 Ay" : "Last 6 Mo"}
          </button>
          <button
            onClick={() => setTimeRange("all_time")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              timeRange === "all_time"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {language === "tr" ? "Tüm Zamanlar" : "All Time"}
          </button>
        </div>
      </div>

      {/* QUICK SUMMARY KPI STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {language === "tr" ? "Toplam Gelir" : "Total Income"}
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block truncate">
            {format(totalIncome)}
          </span>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {language === "tr" ? "Toplam Gider" : "Total Expense"}
          </span>
          <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 block truncate">
            {format(totalExpense)}
          </span>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {language === "tr" ? "Kalan Borç & Taksit" : "Debt & Installment"}
          </span>
          <span className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block truncate">
            {format(totalDebtRemaining + totalInstallmentLoad)}
          </span>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {language === "tr" ? "Net Nakit Dengesi" : "Net Cash Balance"}
          </span>
          <span
            className={`text-sm sm:text-base font-black font-mono mt-0.5 block truncate ${
              netCashFlow >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {format(netCashFlow)}
          </span>
        </div>
      </div>

      {/* FILTER BUTTONS & CHART TYPE TOGGLE BAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
        {/* DATA SCOPE FILTER TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => {
              setActiveCategory("all");
              setSelectedItem(null);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {language === "tr" ? "Genel Akış" : "All Flows"}
          </button>
          <button
            onClick={() => {
              setActiveCategory("expenses");
              setSelectedItem(null);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "expenses"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-rose-500" />
            {language === "tr" ? "Giderler" : "Expenses"}
          </button>
          <button
            onClick={() => {
              setActiveCategory("incomes");
              setSelectedItem(null);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "incomes"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-500" />
            {language === "tr" ? "Gelirler" : "Incomes"}
          </button>
          <button
            onClick={() => {
              setActiveCategory("debts");
              setSelectedItem(null);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "debts"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
            {language === "tr" ? "Borçlar" : "Debts"}
          </button>
          <button
            onClick={() => {
              setActiveCategory("installments");
              setSelectedItem(null);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "installments"
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-sky-500" />
            {language === "tr" ? "Taksitler" : "Installments"}
          </button>
        </div>

        {/* 1. GRAFİK TÜRÜ SEÇİCİ (TOGGLE TABS: DONUT, BAR, LINE) */}
        <div className="flex items-center gap-1 bg-white dark:bg-[#1E293B] p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs shrink-0 self-end md:self-auto">
          <button
            onClick={() => setChartType("donut")}
            aria-label="Pasta Grafik / Donut Chart"
            title={language === "tr" ? "Pasta / Donut Grafiği" : "Donut Chart"}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              chartType === "donut"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <LucidePie className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === "tr" ? "Pasta" : "Donut"}
            </span>
          </button>

          <button
            onClick={() => setChartType("bar")}
            aria-label="Çubuk Grafik / Bar Chart"
            title={language === "tr" ? "Çubuk / Bar Grafiği" : "Bar Chart"}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              chartType === "bar"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === "tr" ? "Çubuk" : "Bar"}
            </span>
          </button>

          <button
            onClick={() => setChartType("line")}
            aria-label="Çizgi Grafik / Line Chart"
            title={language === "tr" ? "Çizgi / Line Grafiği" : "Line Chart"}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              chartType === "line"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <LucideLine className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === "tr" ? "Çizgi" : "Line"}
            </span>
          </button>
        </div>
      </div>

      {/* MAIN CHART CANVAS & DETAILS PANEL */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700/60 shadow-xs relative overflow-hidden">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
              <Info className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {language === "tr" ? "Görüntülenecek Veri Yok" : "No Data Available"}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                {language === "tr"
                  ? "Seçilen filtre ve zaman aralığına ait henüz kayıtlı finansal hareket bulunmuyor."
                  : "No recorded financial transactions found for the selected filter."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* LEFT / CENTER: INTERACTIVE ANIMATED CHART VIEWPORT */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center min-h-[300px] relative">
              <AnimatePresence mode="wait">
                {/* 1. DONUT / PASTA GRAFİĞİ */}
                {chartType === "donut" && (
                  <motion.div
                    key="donut-view"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center select-none"
                  >
                    {/* Ambient Glow */}
                    <div
                      className="absolute inset-4 rounded-full blur-2xl opacity-20 dark:opacity-30 transition-colors duration-500 pointer-events-none"
                      style={{
                        backgroundColor: activeHoverItem ? activeHoverItem.color : "#6366f1",
                      }}
                    />

                    <svg
                      viewBox="0 0 240 240"
                      className="w-full h-full transform -rotate-90 overflow-visible"
                    >
                      <g transform="translate(120, 120)">
                        {pieArcs.map((arc, idx) => {
                          const isHovered = activeHoverItem?.id === arc.data.id;
                          const arcGen = d3
                            .arc<any, any>()
                            .innerRadius(isHovered ? 62 : 68)
                            .outerRadius(isHovered ? 108 : 100)
                            .cornerRadius(5);

                          const pathString = arcGen(arc) || "";

                          return (
                            <path
                              key={arc.data.id || idx}
                              d={pathString}
                              fill={arc.data.color}
                              className="transition-all duration-300 cursor-pointer drop-shadow-sm hover:opacity-100"
                              style={{
                                opacity: activeHoverItem && !isHovered ? 0.6 : 1,
                                filter: isHovered
                                  ? `drop-shadow(0px 0px 8px ${arc.data.color}88)`
                                  : undefined,
                              }}
                              onMouseEnter={() => setHoveredItem(arc.data)}
                              onMouseLeave={() => setHoveredItem(null)}
                              onClick={() =>
                                setSelectedItem(
                                  selectedItem?.id === arc.data.id ? null : arc.data
                                )
                              }
                            />
                          );
                        })}
                      </g>
                    </svg>

                    {/* Central Interactive HUD Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                      {activeHoverItem ? (
                        <motion.div
                          key={activeHoverItem.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-0.5"
                        >
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider line-clamp-1">
                            {activeHoverItem.label}
                          </span>
                          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono block">
                            {format(activeHoverItem.value)}
                          </span>
                          <span
                            className="text-xs font-black px-2 py-0.5 rounded-full inline-block"
                            style={{
                              backgroundColor: `${activeHoverItem.color}20`,
                              color: activeHoverItem.color,
                            }}
                          >
                            %{activeHoverItem.percentage?.toFixed(1) || "0.0"}
                          </span>
                        </motion.div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {language === "tr" ? "Toplam Hacim" : "Total Volume"}
                          </span>
                          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono block">
                            {format(totalChartValue)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 2. BAR / ÇUBUK GRAFİĞİ */}
                {chartType === "bar" && (
                  <motion.div
                    key="bar-view"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="w-full space-y-3 py-2"
                  >
                    {barChartConfig.items.map((item, idx) => {
                      const pctOfMax =
                        barChartConfig.maxVal > 0
                          ? (item.value / barChartConfig.maxVal) * 100
                          : 0;
                      const isHovered = activeHoverItem?.id === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl transition-all cursor-pointer border ${
                            isHovered
                              ? "bg-slate-100 dark:bg-slate-800 border-indigo-400 dark:border-indigo-500 shadow-sm"
                              : "bg-slate-50/70 dark:bg-slate-900/40 border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                          }`}
                          onMouseEnter={() => setHoveredItem(item)}
                          onMouseLeave={() => setHoveredItem(null)}
                          onClick={() =>
                            setSelectedItem(selectedItem?.id === item.id ? null : item)
                          }
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.label}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {format(item.value)}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-12 text-right">
                                %{item.percentage?.toFixed(1) || "0"}
                              </span>
                            </div>
                          </div>

                          {/* Animated Progress Bar */}
                          <div className="w-full h-3 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(4, pctOfMax)}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.05 }}
                              className="h-full rounded-full transition-all"
                              style={{
                                backgroundColor: item.color,
                                boxShadow: isHovered
                                  ? `0 0 10px ${item.color}99`
                                  : undefined,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

                {/* 3. LINE / ÇİZGİ & ALAN GRAFİĞİ */}
                {chartType === "line" && (
                  <motion.div
                    key="line-view"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="w-full flex flex-col items-center justify-center py-2"
                  >
                    <svg
                      viewBox={`0 0 ${lineChartConfig.width} ${lineChartConfig.height}`}
                      className="w-full h-56 overflow-visible select-none"
                    >
                      <defs>
                        <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="90%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {[0.25, 0.5, 0.75, 1.0].map((step, idx) => {
                        const y =
                          lineChartConfig.height -
                          lineChartConfig.paddingY -
                          step * (lineChartConfig.height - lineChartConfig.paddingY * 2);
                        return (
                          <line
                            key={idx}
                            x1={30}
                            x2={lineChartConfig.width - 30}
                            y1={y}
                            y2={y}
                            stroke="currentColor"
                            strokeDasharray="3 4"
                            className="text-slate-200 dark:text-slate-800"
                            strokeWidth="1"
                          />
                        );
                      })}

                      {/* Area Fill */}
                      <path
                        d={lineChartConfig.areaPath}
                        fill="url(#chart-area-grad)"
                      />

                      {/* Main Smooth Spline Curve */}
                      <path
                        d={lineChartConfig.path}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-sm"
                      />

                      {/* Data Point Circles with Hover Effect */}
                      {lineChartConfig.points.map((pt, idx) => {
                        const isHovered = activeHoverItem?.id === pt.item.id;
                        return (
                          <g
                            key={idx}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredItem(pt.item)}
                            onMouseLeave={() => setHoveredItem(null)}
                            onClick={() =>
                              setSelectedItem(
                                selectedItem?.id === pt.item.id ? null : pt.item
                              )
                            }
                          >
                            {/* Hover Halo Ring */}
                            {isHovered && (
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="12"
                                fill={pt.item.color}
                                fillOpacity="0.25"
                                className="animate-pulse"
                              />
                            )}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isHovered ? "6" : "4.5"}
                              fill={pt.item.color}
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="transition-all duration-200"
                            />
                            {/* Bottom Label */}
                            <text
                              x={pt.x}
                              y={lineChartConfig.height - 6}
                              textAnchor="middle"
                              className="text-[9px] font-bold fill-slate-400 dark:fill-slate-500"
                            >
                              {pt.item.label.length > 8
                                ? pt.item.label.slice(0, 7) + ".."
                                : pt.item.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT: INTERACTIVE BREAKDOWN & DETAIL LIST */}
            <div className="lg:col-span-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-slate-800 pt-5 lg:pt-0 lg:pl-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" />
                    {language === "tr" ? "Kategori Dağılımı" : "Category Breakdown"}
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {chartData.length} {language === "tr" ? "Kalem" : "Items"}
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {chartData.map((item) => {
                    const isSelected = selectedItem?.id === item.id;
                    const isHovered = hoveredItem?.id === item.id;

                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={() =>
                          setSelectedItem(selectedItem?.id === item.id ? null : item)
                        }
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isSelected || isHovered
                            ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs"
                            : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span
                            className="w-3 h-3 rounded-md shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {format(item.value)}
                          </span>
                          <span
                            className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${item.color}20`,
                              color: item.color,
                            }}
                          >
                            %{item.percentage?.toFixed(1) || "0"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACTIVE SELECTION DETAIL CARD */}
              {activeHoverItem && (
                <div className="p-3.5 bg-gradient-to-br from-indigo-500/10 via-slate-100 to-indigo-500/5 dark:from-indigo-950/40 dark:via-slate-900 dark:to-indigo-950/20 rounded-2xl border border-indigo-500/20 dark:border-indigo-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                      {activeHoverItem.label}
                    </span>
                    <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-indigo-500 text-white">
                      %{activeHoverItem.percentage?.toFixed(1) || "0.0"} Pay
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-500">
                      {language === "tr" ? "Toplam Tutar:" : "Total Amount:"}
                    </span>
                    <span className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">
                      {format(activeHoverItem.value)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default InteractiveFinancialCharts;

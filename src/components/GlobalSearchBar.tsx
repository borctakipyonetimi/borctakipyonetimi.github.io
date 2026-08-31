/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
  Coins,
  ShoppingCart,
  Wallet,
  Calendar,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Tag,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Filter
} from "lucide-react";
import { Debt, Expense, ExpenseCategory, Income, InstallmentDebt } from "../types";
import { useCurrency } from "../utils/CurrencyContext";

interface GlobalSearchBarProps {
  debts: Debt[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  incomes: Income[];
  installmentDebts: InstallmentDebt[];
  onNavigate: (tab: string) => void;
  setFocusedDebtId?: (id: number | null) => void;
  setFocusedInstallmentId?: (id: number | null) => void;
  language?: "tr" | "en";
  triggerToast?: (msg: string) => void;
}

type SearchCategory = "all" | "debts" | "expenses" | "incomes" | "installments";

interface SearchResultItem {
  id: string | number;
  originalId: number;
  type: "debt" | "expense" | "income" | "installment";
  title: string;
  categoryName: string;
  categoryColor?: string;
  categoryIcon?: string;
  amount: number;
  dateOrDueDate?: string;
  statusBadge?: string;
  statusBadgeColor?: string;
  secondaryInfo?: string;
  tabTarget: string;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  debts,
  expenses,
  expenseCategories,
  incomes,
  installmentDebts,
  onNavigate,
  setFocusedDebtId,
  setFocusedInstallmentId,
  language = "tr",
  triggerToast
}) => {
  const { format } = useCurrency();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>("all");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Category ID to Category Object Map
  const categoryMap = useMemo(() => {
    const map = new Map<number, ExpenseCategory>();
    expenseCategories.forEach((c) => map.set(c.id, c));
    return map;
  }, [expenseCategories]);

  // Global Keyboard shortcut listener (Ctrl+K or ⌘K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        if (window.innerWidth < 768) {
          setIsMobileExpanded(true);
          setTimeout(() => mobileInputRef.current?.focus(), 100);
        } else {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setIsMobileExpanded(false);
        inputRef.current?.blur();
        mobileInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsMobileExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format date helper
  const formatDateStr = (dStr?: string) => {
    if (!dStr) return "";
    try {
      const parts = dStr.split("T")[0].split("-");
      if (parts.length === 3) {
        const d = parts[2];
        const m = parseInt(parts[1], 10);
        const y = parts[0];
        const monthNamesTr = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
        const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const mName = (language === "tr" ? monthNamesTr : monthNamesEn)[m - 1] || parts[1];
        return `${d} ${mName} ${y}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // Compile Unified Search Records
  const allSearchItems = useMemo<SearchResultItem[]>(() => {
    const results: SearchResultItem[] = [];

    // 1. Debts (Borçlar)
    debts.forEach((debt) => {
      const isPaid = (debt.paid || 0) >= debt.amount;
      const remaining = Math.max(0, debt.amount - (debt.paid || 0));
      results.push({
        id: `debt-${debt.id}`,
        originalId: debt.id,
        type: "debt",
        title: debt.name,
        categoryName: debt.category || (language === "tr" ? "Genel Borç" : "General Debt"),
        categoryColor: "#ef4444",
        categoryIcon: "💳",
        amount: debt.amount,
        dateOrDueDate: debt.dueDate,
        statusBadge: isPaid
          ? language === "tr" ? "Ödendi ✅" : "Paid ✅"
          : language === "tr" ? `Kalan: ${format(remaining)}` : `Remaining: ${format(remaining)}`,
        statusBadgeColor: isPaid
          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          : "bg-rose-500/10 text-rose-500 border-rose-500/20",
        secondaryInfo: debt.paid > 0 ? (language === "tr" ? `Ödenen: ${format(debt.paid)}` : `Paid: ${format(debt.paid)}`) : undefined,
        tabTarget: "debts"
      });
    });

    // 2. Expenses (Giderler / Harcamalar)
    expenses.forEach((expense) => {
      const cat = categoryMap.get(expense.categoryId);
      results.push({
        id: `expense-${expense.id}`,
        originalId: expense.id,
        type: "expense",
        title: expense.description || (language === "tr" ? "Harcama" : "Expense"),
        categoryName: cat?.name || (language === "tr" ? "Diğer Gider" : "Other Expense"),
        categoryColor: cat?.color || "#f59e0b",
        categoryIcon: cat?.icon || "🛒",
        amount: expense.amount,
        dateOrDueDate: expense.date,
        statusBadge: language === "tr" ? "Gider Masrafı" : "Expense",
        statusBadgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        tabTarget: "expenses"
      });
    });

    // 3. Incomes (Gelirler)
    incomes.forEach((income) => {
      results.push({
        id: `income-${income.id}`,
        originalId: income.id,
        type: "income",
        title: income.name,
        categoryName: income.isRecurring
          ? (language === "tr" ? "Düzenli / Maaş" : "Recurring Salary")
          : (language === "tr" ? "Ek Gelir / Kazanç" : "Additional Income"),
        categoryColor: "#10b981",
        categoryIcon: "💰",
        amount: income.amount,
        dateOrDueDate: income.date,
        statusBadge: income.isRecurring
          ? (language === "tr" ? "Düzenli Gelir 🔄" : "Recurring 🔄")
          : (language === "tr" ? "Tek Seferlik Gelir" : "One-time Income"),
        statusBadgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        tabTarget: "income"
      });
    });

    // 4. Installment Debts (Taksitli Borçlar)
    installmentDebts.forEach((inst) => {
      const isCompleted = inst.paidInstallmentCount >= inst.installmentCount;
      results.push({
        id: `installment-${inst.id}`,
        originalId: inst.id,
        type: "installment",
        title: inst.name,
        categoryName: language === "tr" ? "Taksitli Borç" : "Installment Debt",
        categoryColor: "#6366f1",
        categoryIcon: "📅",
        amount: inst.totalAmount,
        dateOrDueDate: inst.firstDueDate,
        statusBadge: isCompleted
          ? (language === "tr" ? "Taksit Bitti 🏁" : "Completed 🏁")
          : `${inst.paidInstallmentCount}/${inst.installmentCount} ${language === "tr" ? "Taksit" : "Inst."}`,
        statusBadgeColor: isCompleted
          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        secondaryInfo: `${language === "tr" ? "Aylık" : "Monthly"}: ${format(inst.totalAmount / (inst.installmentCount || 1))}`,
        tabTarget: "installments"
      });
    });

    return results;
  }, [debts, expenses, incomes, installmentDebts, categoryMap, format, language]);

  // Filter items based on query & activeCategory tab
  const filteredResults = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return allSearchItems.filter((item) => {
      // Category filter
      if (activeCategory === "debts" && item.type !== "debt") return false;
      if (activeCategory === "expenses" && item.type !== "expense") return false;
      if (activeCategory === "incomes" && item.type !== "income") return false;
      if (activeCategory === "installments" && item.type !== "installment") return false;

      if (!cleanQuery) return true; // Show recent/popular items if empty

      // Search match in title, category, formatted amount or date
      const matchTitle = item.title.toLowerCase().includes(cleanQuery);
      const matchCategory = item.categoryName.toLowerCase().includes(cleanQuery);
      const matchAmount = item.amount.toString().includes(cleanQuery);
      const matchSecondary = item.secondaryInfo?.toLowerCase().includes(cleanQuery) || false;

      return matchTitle || matchCategory || matchAmount || matchSecondary;
    });
  }, [allSearchItems, query, activeCategory]);

  // Counts by category
  const counts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const matches = (item: SearchResultItem) => {
      if (!cleanQuery) return true;
      return (
        item.title.toLowerCase().includes(cleanQuery) ||
        item.categoryName.toLowerCase().includes(cleanQuery) ||
        item.amount.toString().includes(cleanQuery) ||
        (item.secondaryInfo?.toLowerCase().includes(cleanQuery) || false)
      );
    };

    return {
      all: allSearchItems.filter(matches).length,
      debts: allSearchItems.filter((i) => i.type === "debt" && matches(i)).length,
      expenses: allSearchItems.filter((i) => i.type === "expense" && matches(i)).length,
      incomes: allSearchItems.filter((i) => i.type === "income" && matches(i)).length,
      installments: allSearchItems.filter((i) => i.type === "installment" && matches(i)).length
    };
  }, [allSearchItems, query]);

  // Handle Selection & Navigation
  const handleSelectItem = (item: SearchResultItem) => {
    setIsOpen(false);
    setIsMobileExpanded(false);

    if (item.type === "debt" && setFocusedDebtId) {
      setFocusedDebtId(item.originalId);
    } else if (item.type === "installment" && setFocusedInstallmentId) {
      setFocusedInstallmentId(item.originalId);
    }

    onNavigate(item.tabTarget);

    const typeNames: Record<string, string> = {
      debt: language === "tr" ? "Borç Kaydı" : "Debt Record",
      expense: language === "tr" ? "Harcama / Gider" : "Expense Record",
      income: language === "tr" ? "Gelir Kaydı" : "Income Record",
      installment: language === "tr" ? "Taksit Planı" : "Installment Plan"
    };

    const typeLabel = typeNames[item.type] || "Kayıt";
    triggerToast?.(`🔍 ${typeLabel} Açıldı: ${item.title} (${format(item.amount)})`);
  };

  // Keyboard navigation within the dropdown
  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredResults.length) {
        handleSelectItem(filteredResults[selectedIndex]);
      } else if (filteredResults.length > 0) {
        handleSelectItem(filteredResults[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsMobileExpanded(false);
    }
  };

  // Highlight matching text snippet helper
  const renderHighlighted = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-amber-400/30 text-amber-300 rounded px-0.5 font-bold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-full md:max-w-xs lg:max-w-md xl:max-w-lg z-40">
      {/* Search Input Bar (Desktop / Standard Header) */}
      <div
        className={`relative flex items-center w-full transition-all duration-300 rounded-2xl border ${
          isOpen
            ? "bg-slate-900/95 border-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.25)] ring-2 ring-indigo-500/20"
            : "bg-white/[0.06] hover:bg-white/[0.1] border-white/10 hover:border-white/20 shadow-inner"
        }`}
      >
        <div className="pl-3 sm:pl-3.5 pr-2 py-2 flex items-center pointer-events-none text-indigo-400">
          <Search className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "scale-110 text-indigo-300" : "text-indigo-400/80"}`} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDownInput}
          placeholder={
            language === "tr"
              ? "Borç, harcama veya gelir ara... (İsim veya Kategori)"
              : "Search debts, expenses or income... (Name or Category)"
          }
          className="w-full bg-transparent py-2 sm:py-2.5 pr-8 text-xs sm:text-sm font-medium text-white placeholder-slate-400/80 focus:outline-none"
        />

        {/* Clear Button or Keyboard Shortcut Hint */}
        <div className="pr-2.5 flex items-center gap-1.5 shrink-0">
          {query ? (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="Aramayı Temizle"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-mono text-slate-300">
              <span className="text-[9px]">⌘</span>K
            </div>
          )}
        </div>
      </div>

      {/* Results Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full mt-2 bg-slate-950/95 dark:bg-black/95 backdrop-blur-xl border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden z-50 text-white min-w-[320px] sm:min-w-[420px] max-w-[95vw] sm:max-w-none"
            style={{ maxHeight: "calc(85vh - 80px)" }}
          >
            {/* Header / Category Filter Tabs */}
            <div className="p-3 border-b border-white/10 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1">
                <span className="flex items-center gap-1.5 text-indigo-300 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  {language === "tr" ? "HIZLI KAYIT ARAMA" : "GLOBAL INSTANT SEARCH"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {filteredResults.length} {language === "tr" ? "sonuç" : "results"}
                </span>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    activeCategory === "all"
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                      : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5"
                  }`}
                >
                  <span>{language === "tr" ? "Tümü" : "All"}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[9px] font-mono">{counts.all}</span>
                </button>

                <button
                  onClick={() => setActiveCategory("debts")}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    activeCategory === "debts"
                      ? "bg-rose-600 text-white shadow-sm shadow-rose-500/30"
                      : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5"
                  }`}
                >
                  <Coins className="w-3 h-3 text-rose-400" />
                  <span>{language === "tr" ? "Borçlar" : "Debts"}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[9px] font-mono">{counts.debts}</span>
                </button>

                <button
                  onClick={() => setActiveCategory("expenses")}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    activeCategory === "expenses"
                      ? "bg-amber-600 text-white shadow-sm shadow-amber-500/30"
                      : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5"
                  }`}
                >
                  <ShoppingCart className="w-3 h-3 text-amber-400" />
                  <span>{language === "tr" ? "Giderler" : "Expenses"}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[9px] font-mono">{counts.expenses}</span>
                </button>

                <button
                  onClick={() => setActiveCategory("incomes")}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    activeCategory === "incomes"
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/30"
                      : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5"
                  }`}
                >
                  <Wallet className="w-3 h-3 text-emerald-400" />
                  <span>{language === "tr" ? "Gelirler" : "Incomes"}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[9px] font-mono">{counts.incomes}</span>
                </button>

                <button
                  onClick={() => setActiveCategory("installments")}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    activeCategory === "installments"
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                      : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5"
                  }`}
                >
                  <Calendar className="w-3 h-3 text-indigo-400" />
                  <span>{language === "tr" ? "Taksitler" : "Installments"}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[9px] font-mono">{counts.installments}</span>
                </button>
              </div>
            </div>

            {/* Results List */}
            <div
              ref={resultsContainerRef}
              className="p-2 overflow-y-auto divide-y divide-white/5 space-y-1"
              style={{ maxHeight: "380px" }}
            >
              {filteredResults.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2.5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 border border-white/10">
                    <Search className="w-6 h-6 opacity-60" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">
                    {language === "tr" ? "Eşleşen Kayıt Bulunamadı" : "No matching records found"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    {language === "tr"
                      ? `"${query}" terimine uygun borç, harcama veya gelir bulunamadı. Lütfen kelimeyi kontrol edin.`
                      : `No debt, expense, or income matched "${query}". Please check your search term.`}
                  </p>
                </div>
              ) : (
                filteredResults.slice(0, 40).map((item, idx) => {
                  const isSelected = selectedIndex === idx;

                  // Icon by type
                  const renderIcon = () => {
                    if (item.type === "debt") return <Coins className="w-4 h-4 text-rose-400" />;
                    if (item.type === "expense") return <ShoppingCart className="w-4 h-4 text-amber-400" />;
                    if (item.type === "income") return <Wallet className="w-4 h-4 text-emerald-400" />;
                    return <Calendar className="w-4 h-4 text-indigo-400" />;
                  };

                  const typeLabel = {
                    debt: language === "tr" ? "BORÇ" : "DEBT",
                    expense: language === "tr" ? "GİDER" : "EXPENSE",
                    income: language === "tr" ? "GELİR" : "INCOME",
                    installment: language === "tr" ? "TAKSİT" : "INSTALLMENT"
                  }[item.type];

                  const typeBgColor = {
                    debt: "bg-rose-500/15 text-rose-300 border-rose-500/30",
                    expense: "bg-amber-500/15 text-amber-300 border-amber-500/30",
                    income: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                    installment: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                  }[item.type];

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "bg-indigo-600/30 border border-indigo-500/50 shadow-md translate-x-1"
                          : "hover:bg-white/[0.06] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Icon container */}
                        <div className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0">
                          {renderIcon()}
                        </div>

                        {/* Title, Category & Date */}
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase rounded-md border ${typeBgColor}`}>
                              {typeLabel}
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-[240px]">
                              {renderHighlighted(item.title, query)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1 truncate max-w-[140px]">
                              <span>{item.categoryIcon || "🏷️"}</span>
                              <span>{renderHighlighted(item.categoryName, query)}</span>
                            </span>

                            {item.dateOrDueDate && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-[10.5px] text-slate-400 font-mono">
                                  {formatDateStr(item.dateOrDueDate)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Amount & Status Badge */}
                      <div className="text-right shrink-0 space-y-1">
                        <div className="text-xs sm:text-sm font-black text-white font-mono">
                          {format(item.amount)}
                        </div>

                        {item.statusBadge && (
                          <div className="flex justify-end">
                            <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-lg border inline-block ${item.statusBadgeColor || "bg-white/10 text-slate-300 border-white/10"}`}>
                              {item.statusBadge}
                            </span>
                          </div>
                        )}
                      </div>

                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "text-indigo-300 translate-x-0.5" : "text-slate-600"}`} />
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer Info */}
            <div className="p-2.5 px-4 border-t border-white/10 bg-slate-900/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="font-bold text-indigo-400">Enter</span>
                <span>{language === "tr" ? "ile kayda git" : "to navigate"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-bold text-indigo-400">ESC</span>
                <span>{language === "tr" ? "ile kapat" : "to close"}</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

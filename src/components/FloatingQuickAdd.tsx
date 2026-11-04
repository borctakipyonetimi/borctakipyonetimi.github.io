/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  X, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Calendar, 
  Tag, 
  Wallet, 
  Bell, 
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { Debt, Expense, Income } from "../types";
import { detectProviderFromName } from "../data/providers";

interface FloatingQuickAddProps {
  onSaveIncome?: (income: Partial<Income>) => void;
  onSaveExpense?: (expense: Partial<Expense>) => void;
  onSaveDebt?: (debt: Partial<Debt>, createAlarm?: boolean) => void;
  onNavigateTab?: (tab: string) => void;
  triggerToast?: (msg: string) => void;
}

export const FloatingQuickAdd: React.FC<FloatingQuickAddProps> = ({
  onSaveIncome,
  onSaveExpense,
  onSaveDebt,
  onNavigateTab,
  triggerToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"income" | "expense" | "debt" | null>(null);

  // Income Form State
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incomeRecurring, setIncomeRecurring] = useState(false);

  // Expense Form State
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Market & Mutfak");
  const [expenseMethod, setExpenseMethod] = useState("Kredi Kartı");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Debt Form State
  const [debtName, setDebtName] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtCategory, setDebtCategory] = useState("Kredi Kartı");
  const [debtDueDate, setDebtDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [debtAlarm, setDebtAlarm] = useState(false);

  // Reset form helper
  const resetForms = () => {
    setIncomeName("");
    setIncomeAmount("");
    setIncomeDate(new Date().toISOString().slice(0, 10));
    setIncomeRecurring(false);

    setExpenseDesc("");
    setExpenseAmount("");
    setExpenseCategory("Market & Mutfak");
    setExpenseMethod("Kredi Kartı");
    setExpenseDate(new Date().toISOString().slice(0, 10));

    setDebtName("");
    setDebtAmount("");
    setDebtCategory("Kredi Kartı");
    setDebtDueDate(new Date().toISOString().slice(0, 10));
    setDebtAlarm(false);
  };

  const handleOpenAction = (type: "income" | "expense" | "debt") => {
    resetForms();
    setIsOpen(false);
    setActiveModal(type);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    resetForms();
  };

  // Submit Income
  const handleSubmitIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(incomeAmount.replace(",", "."));
    if (!incomeName.trim()) {
      alert("Lütfen gelir adını giriniz.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Lütfen geçerli bir tutar giriniz.");
      return;
    }

    if (onSaveIncome) {
      onSaveIncome({
        name: incomeName.trim(),
        amount: parsedAmount,
        date: incomeDate || new Date().toISOString().slice(0, 10),
        isRecurring: incomeRecurring,
      });
      triggerToast?.(`💰 "${incomeName.trim()}" geliri başarıyla kaydedildi!`);
    }
    handleCloseModal();
  };

  // Submit Expense
  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(expenseAmount.replace(",", "."));
    if (!expenseDesc.trim()) {
      alert("Lütfen harcama açıklamasını giriniz.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Lütfen geçerli bir tutar giriniz.");
      return;
    }

    if (onSaveExpense) {
      onSaveExpense({
        description: expenseDesc.trim(),
        amount: parsedAmount,
        category: expenseCategory,
        date: expenseDate || new Date().toISOString().slice(0, 10),
        paymentMethod: expenseMethod,
      });
      triggerToast?.(`🛒 "${expenseDesc.trim()}" gideri başarıyla eklendi!`);
    }
    handleCloseModal();
  };

  // Submit Debt
  const handleSubmitDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(debtAmount.replace(",", "."));
    if (!debtName.trim()) {
      alert("Lütfen borç adını giriniz.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Lütfen geçerli bir borç tutarı giriniz.");
      return;
    }

    if (onSaveDebt) {
      const detected = detectProviderFromName(debtName.trim(), debtCategory);
      onSaveDebt(
        {
          name: debtName.trim(),
          amount: parsedAmount,
          paid: 0,
          category: debtCategory,
          dueDate: debtDueDate || new Date().toISOString().slice(0, 10),
          providerId: detected ? detected.id : null,
        },
        debtAlarm
      );
      triggerToast?.(`💳 "${debtName.trim()}" borcu başarıyla eklendi!`);
    }
    handleCloseModal();
  };

  const expenseCategories = [
    "Market & Mutfak",
    "Faturalar",
    "Ulaşım & Yakıt",
    "Kira & Aidat",
    "Eğlence & Sosyal",
    "Sağlık",
    "Eğitim",
    "Giyim",
    "Teknoloji",
    "Diğer",
  ];

  const debtCategories = [
    "Kredi Kartı",
    "Konut",
    "Araç",
    "Sağlık",
    "Eğitim",
    "Diğer",
  ];

  return (
    <>
      {/* Backdrop when FAB menu is opened */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-40 transition-opacity"
          />
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) Container */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end pointer-events-none select-none">
        {/* Child Bubble Options */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
                closed: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
              }}
              className="flex flex-col items-end gap-3 mb-3 pointer-events-auto"
            >
              {/* 1. Gelir Ekle */}
              <motion.div
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 15, scale: 0.8 },
                }}
                className="flex items-center gap-2.5"
              >
                <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs shadow-lg backdrop-blur-md">
                  Gelir Ekle
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenAction("income")}
                  title="Yeni Gelir Ekle"
                  className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-xl shadow-emerald-600/30 flex items-center justify-center transition-all duration-200 active:scale-95 border-2 border-white/30 cursor-pointer"
                >
                  <TrendingUp className="w-5 h-5" />
                </button>
              </motion.div>

              {/* 2. Gider Ekle */}
              <motion.div
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 15, scale: 0.8 },
                }}
                className="flex items-center gap-2.5"
              >
                <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-rose-500/30 text-rose-700 dark:text-rose-400 font-extrabold text-xs shadow-lg backdrop-blur-md">
                  Gider Ekle
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenAction("expense")}
                  title="Yeni Harcama/Gider Ekle"
                  className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white shadow-xl shadow-rose-600/30 flex items-center justify-center transition-all duration-200 active:scale-95 border-2 border-white/30 cursor-pointer"
                >
                  <TrendingDown className="w-5 h-5" />
                </button>
              </motion.div>

              {/* 3. Borç Ekle */}
              <motion.div
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 15, scale: 0.8 },
                }}
                className="flex items-center gap-2.5"
              >
                <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-extrabold text-xs shadow-lg backdrop-blur-md">
                  Borç Ekle
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenAction("debt")}
                  title="Yeni Borç Ekle"
                  className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white shadow-xl shadow-amber-600/30 flex items-center justify-center transition-all duration-200 active:scale-95 border-2 border-white/30 cursor-pointer"
                >
                  <CreditCard className="w-5 h-5" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Round FAB Trigger Button */}
        <motion.button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          title={isOpen ? "Menüyü Kapat" : "Hızlı Ekle (Gelir, Gider, Borç)"}
          className="pointer-events-auto w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-2xl shadow-indigo-600/40 flex items-center justify-center transition-all duration-300 border-2 border-white/30 cursor-pointer group focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
          aria-label="Hızlı Finansal Ekleme Menüsü"
        >
          <motion.div
            animate={{ rotate: isOpen ? 135 : 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
          >
            <Plus className="w-7 h-7" />
          </motion.div>
        </motion.button>
      </div>

      {/* QUICK ADD MODALS */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {activeModal && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto overscroll-contain animate-fade-in">
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 12 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative my-auto"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-2xl text-white shadow-md ${
                        activeModal === "income"
                          ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/30"
                          : activeModal === "expense"
                          ? "bg-gradient-to-tr from-rose-600 to-red-500 shadow-rose-500/30"
                          : "bg-gradient-to-tr from-amber-600 to-orange-500 shadow-amber-500/30"
                      }`}
                    >
                      {activeModal === "income" && <TrendingUp className="w-5 h-5" />}
                      {activeModal === "expense" && <TrendingDown className="w-5 h-5" />}
                      {activeModal === "debt" && <CreditCard className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {activeModal === "income" && "Hızlı Gelir Ekle"}
                        {activeModal === "expense" && "Hızlı Gider Ekle"}
                        {activeModal === "debt" && "Hızlı Borç Ekle"}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {activeModal === "income" && "Maaş, prim veya diğer kazanç kaydı"}
                        {activeModal === "expense" && "Günlük harcama veya fatura ödemesi"}
                        {activeModal === "debt" && "Banka, kredi kartı veya kişi borcu"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 1. GELİR FORMU */}
                {activeModal === "income" && (
                  <form onSubmit={handleSubmitIncome} className="space-y-4 pt-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Gelir Başlığı
                      </label>
                      <input
                        type="text"
                        required
                        value={incomeName}
                        onChange={(e) => setIncomeName(e.target.value)}
                        placeholder="Örn: Aylık Maaş, Ekstra Prim, Kira Geliri"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Tutar (₺)
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          min="0.01"
                          value={incomeAmount}
                          onChange={(e) => setIncomeAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Tarih
                        </label>
                        <input
                          type="date"
                          value={incomeDate}
                          onChange={(e) => setIncomeDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={incomeRecurring}
                        onChange={(e) => setIncomeRecurring(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-emerald-950 dark:text-emerald-300">
                        Düzenli / Tekrarlayan Gelir (Her Ay Yenilenir)
                      </span>
                    </label>

                    <div className="pt-2 flex items-center justify-between">
                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCloseModal();
                            onNavigateTab("income");
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          Gelirler Sayfasına Git →
                        </button>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 hover:opacity-95 transition"
                        >
                          Geliri Kaydet
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* 2. GİDER FORMU */}
                {activeModal === "expense" && (
                  <form onSubmit={handleSubmitExpense} className="space-y-4 pt-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Harcama Açıklaması
                      </label>
                      <input
                        type="text"
                        required
                        value={expenseDesc}
                        onChange={(e) => setExpenseDesc(e.target.value)}
                        placeholder="Örn: Haftalık Market Alışverişi, Benzin"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Tutar (₺)
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          min="0.01"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Kategori
                        </label>
                        <select
                          value={expenseCategory}
                          onChange={(e) => setExpenseCategory(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                        >
                          {expenseCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Ödeme Yöntemi
                        </label>
                        <select
                          value={expenseMethod}
                          onChange={(e) => setExpenseMethod(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                        >
                          <option value="Kredi Kartı">💳 Kredi Kartı</option>
                          <option value="Nakit">💵 Nakit</option>
                          <option value="Banka Kartı">🏦 Banka Kartı / Havale</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Tarih
                        </label>
                        <input
                          type="date"
                          value={expenseDate}
                          onChange={(e) => setExpenseDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCloseModal();
                            onNavigateTab("expenses");
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          Giderler Sayfasına Git →
                        </button>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/30 hover:opacity-95 transition"
                        >
                          Gideri Kaydet
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* 3. BORÇ FORMU */}
                {activeModal === "debt" && (
                  <form onSubmit={handleSubmitDebt} className="space-y-4 pt-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Borç / Kurum Adı
                      </label>
                      <input
                        type="text"
                        required
                        value={debtName}
                        onChange={(e) => setDebtName(e.target.value)}
                        placeholder="Örn: Akbank Kredi Kartı, Ev Kirası, Ahmet Borcu"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Toplam Tutar (₺)
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          min="0.01"
                          value={debtAmount}
                          onChange={(e) => setDebtAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Kategori
                        </label>
                        <select
                          value={debtCategory}
                          onChange={(e) => setDebtCategory(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {debtCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Son Ödeme / Vade Tarihi
                      </label>
                      <input
                        type="date"
                        value={debtDueDate}
                        onChange={(e) => setDebtDueDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={debtAlarm}
                        onChange={(e) => setDebtAlarm(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-300 flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-500" />
                        Son Ödeme Günü İçin Hatırlatıcı / Alarm Kur
                      </span>
                    </label>

                    <div className="pt-2 flex items-center justify-between">
                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCloseModal();
                            onNavigateTab("debts");
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          Borçlar Sayfasına Git →
                        </button>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/30 hover:opacity-95 transition"
                        >
                          Borcu Kaydet
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default FloatingQuickAdd;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Calendar, BarChart3, LineChart as LucideLine, ClipboardList, Wallet, ShoppingBag, Trash2, RotateCcw, CheckCircle2, DollarSign } from "lucide-react";
import { motion } from "motion/react";
import { Debt, Income, Expense, PaymentLog, InstallmentDebt } from "../types";
import { BarChart, LineChart } from "./BudgetCharts";
import { useCurrency } from "../utils/CurrencyContext";
import { t } from "../utils/translations";
import { parseDateParts } from "../utils/dateUtils";

interface FollowUpMonthlyYearlyProps {
  debts: Debt[];
  incomes: Income[];
  expenses: Expense[];
  payments: PaymentLog[];
  installmentDebts?: InstallmentDebt[];
  viewMode: "monthly" | "yearly";
  language?: "tr" | "en";
  onDeletePayment?: (id: number) => void;
  onClearPayments?: (scope: "current_month" | "all") => void;
}

export const FollowUpMonthlyYearly: React.FC<FollowUpMonthlyYearlyProps> = ({
  debts = [],
  incomes = [],
  expenses = [],
  payments = [],
  installmentDebts = [],
  viewMode,
  language = "tr",
  onDeletePayment,
  onClearPayments,
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const { format } = useCurrency();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  const monthsList = language === "tr" ? [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ] : [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (viewMode === "monthly") {
    const selectedTime = selectedYear * 12 + selectedMonth;
    const validDebtIds = new Set(debts.map((d) => d.id));
    const validInstIds = new Set(installmentDebts.map((i) => i.id));

    // 1. Incomes: recurring regular incomes carry forward to all following months
    const monthlyIncome = incomes.filter((i) => {
      const parts = parseDateParts(i.date);
      if (!parts) return true;
      if (i.isRecurring !== false) {
        const incomeTime = parts.year * 12 + parts.month;
        return selectedTime >= incomeTime;
      } else {
        return parts.year === selectedYear && parts.month === selectedMonth;
      }
    }).reduce((sum, item) => sum + item.amount, 0);

    // 2. Expenses scoped strictly to this month
    const monthlyExpense = expenses.filter((e) => {
      const parts = parseDateParts(e.date);
      if (!parts) return false;
      return parts.year === selectedYear && parts.month === selectedMonth;
    }).reduce((sum, item) => sum + item.amount, 0);

    // 3. Filtered active monthly payment records (excluding orphaned ghost logs)
    const monthlyPayments = payments.filter((p) => {
      if (p.debtId && !validDebtIds.has(p.debtId) && !validInstIds.has(p.debtId)) {
        return false;
      }
      const parts = parseDateParts(p.date);
      if (!parts) return false;
      return parts.year === selectedYear && parts.month === selectedMonth;
    });

    const totalPaidThisMonth = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);

    const monthlyCompareData = [
      { label: "Gelir", value: monthlyIncome, color: "#10b981" },
      { label: "Gider", value: monthlyExpense, color: "#ef4444" },
      { label: "Borç Ödemesi", value: totalPaidThisMonth, color: "#6366f1" },
    ];

    // Helper to get debt name for payment item
    const getPaymentTargetName = (p: PaymentLog) => {
      if (p.type === "installment") {
        const inst = installmentDebts.find((i) => i.id === p.debtId);
        return inst ? `${inst.name} (Taksit)` : "Taksitli Borç";
      }
      const debt = debts.find((d) => d.id === p.debtId);
      return debt ? debt.name : "Borç Ödemesi";
    };

    return (
      <div className="space-y-6">
        {/* Centered & Animated Page Title */}
        <div className="flex flex-col items-center justify-center text-center py-4 select-none">
          <motion.h2
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
          >
            <Calendar className="w-7 h-7 text-indigo-500 animate-pulse" /> AYLIK ÖDEME VE BÜTÇE TAKİBİ
          </motion.h2>
          <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white cursor-pointer shadow-sm"
          >
            {monthsList.map((m, idx) => (
              <option key={idx} value={idx}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white cursor-pointer shadow-sm"
          >
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic monthly summaries card */}
        <div className="p-4 bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-3xl grid gap-4 sm:grid-cols-2 font-semibold text-xs shadow-md">
          <div className="space-y-1">
            <span className="text-slate-400 block font-semibold text-[10px] uppercase">GELİR KAPILARI</span>
            <p className="text-sm font-black flex items-center gap-1"><Wallet className="w-4 h-4 text-emerald-400 shrink-0" /> {format(monthlyIncome)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block font-semibold text-[10px] uppercase">TOPLAM MASRAF/GİDER</span>
            <p className="text-sm font-black flex items-center gap-1"><ShoppingBag className="w-4 h-4 text-rose-400 shrink-0" /> {format(monthlyExpense)}</p>
          </div>
        </div>

        {/* Comparison Analytics */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-500" /> BÜTÇE KARŞILAŞTIRMA GRAFİĞİ
            </h4>
            <BarChart data={monthlyCompareData} />
          </div>

          <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-indigo-500" /> AYLIK FINANS DETAY RAPORU
            </h4>
            <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300 font-medium">
              <p>
                📅 Seçilen Dönem: <span className="font-extrabold text-slate-800 dark:text-slate-100">{monthsList[selectedMonth]} {selectedYear}</span>
              </p>
              <div className="border-t dark:border-slate-700 pt-2 space-y-1">
                <p>💸 Bu ay yapılan toplam borç ödemesi: <span className="font-bold text-emerald-500 font-mono">{format(totalPaidThisMonth)}</span></p>
                <p>🛒 Bu ay harcanan gider bütçesi: <span className="font-bold text-rose-400 font-mono">{format(monthlyExpense)}</span></p>
                <p>💰 Bu ay elde edilen toplam gelir: <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{format(monthlyIncome)}</span></p>
                <p>⚖️ Net bakiye dengesi: <span className={`font-bold font-mono ${monthlyIncome - (monthlyExpense + totalPaidThisMonth) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {format(monthlyIncome - (monthlyExpense + totalPaidThisMonth))}
                </span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Bu Ayın Yapılan Ödeme Kayıtları Listesi */}
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {monthsList[selectedMonth]} {selectedYear} ÖDEME KAYITLARI ({monthlyPayments.length} Adet)
            </h4>
            {monthlyPayments.length > 0 && onClearPayments && (
              <button
                onClick={() => onClearPayments("current_month")}
                className="px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition flex items-center gap-1 border border-rose-200 dark:border-rose-900"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Bu Ayın Ödemelerini Sıfırla
              </button>
            )}
          </div>

          {monthlyPayments.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 font-medium bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              Bu ay için henüz kaydedilmiş borç ödemesi bulunmamaktadır.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {monthlyPayments.map((p) => {
                const parts = parseDateParts(p.date);
                const dateLabel = parts ? `${parts.day} ${monthsList[parts.month]} ${parts.year}` : p.date;
                return (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{getPaymentTargetName(p)}</p>
                        <p className="text-[11px] text-slate-400">{dateLabel} {p.type === "installment" ? "• Taksit" : "• Tek Seferlik / Borç"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                        {format(p.amount)}
                      </span>
                      {onDeletePayment && (
                        <button
                          onClick={() => onDeletePayment(p.id)}
                          title="Ödeme Kaydını Sil"
                          className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Yearly follow up view ("yearly")
  const validDebtIds = new Set(debts.map((d) => d.id));
  const validInstIds = new Set(installmentDebts.map((i) => i.id));

  const yearlyPayments = payments.filter((p) => {
    if (p.debtId && !validDebtIds.has(p.debtId) && !validInstIds.has(p.debtId)) {
      return false;
    }
    const parts = parseDateParts(p.date);
    return parts ? parts.year === selectedYear : new Date(p.date).getFullYear() === selectedYear;
  });

  const totalYearlyPaid = yearlyPayments.reduce((sum, p) => sum + p.amount, 0);

  // Group payments by month (0-11)
  const monthlyDataYear = Array(12).fill(0);
  yearlyPayments.forEach((p) => {
    const parts = parseDateParts(p.date);
    const m = parts ? parts.month : new Date(p.date).getMonth();
    if (m >= 0 && m < 12) {
      monthlyDataYear[m] += p.amount;
    }
  });

  return (
    <div className="space-y-6">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <LucideLine className="w-7 h-7 text-indigo-500 animate-pulse" /> YILLIK PAY ANALİZİ VE EĞİLİM GRAFİKLERİ
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      <div className="flex items-center justify-center">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white cursor-pointer shadow-sm"
        >
          {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
            <option key={y} value={y}>
              {y} Yılı
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-300 rounded-2xl flex items-center justify-between font-bold text-xs">
        <span>Yıl Boyunca Yapılmış Toplam Borç Kapatma Miktarı:</span>
        <span className="text-base text-indigo-600 dark:text-indigo-400 font-mono">{format(totalYearlyPaid)}</span>
      </div>

      <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide text-center">{selectedYear} Yıllık Borç Ödeme Trendi</h4>
        <LineChart labels={monthsList} values={monthlyDataYear} lineColor="#4f46e5" />
      </div>
    </div>
  );
};

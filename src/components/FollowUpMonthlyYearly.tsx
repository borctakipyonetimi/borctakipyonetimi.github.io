/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Calendar, BarChart3, LineChart as LucideLine, ClipboardList, Wallet, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { Debt, Income, Expense, PaymentLog } from "../types";
import { BarChart, LineChart } from "./BudgetCharts";
import { useCurrency } from "../utils/CurrencyContext";
import { t } from "../utils/translations";

interface FollowUpMonthlyYearlyProps {
  debts: Debt[];
  incomes: Income[];
  expenses: Expense[];
  payments: PaymentLog[];
  viewMode: "monthly" | "yearly";
  language?: "tr" | "en";
}

export const FollowUpMonthlyYearly: React.FC<FollowUpMonthlyYearlyProps> = ({
  debts,
  incomes,
  expenses,
  payments,
  viewMode,
  language = "tr",
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const { format, currencySymbol } = useCurrency();
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
    // Advanced Monthly calculations
    const monthlyPayments = payments.filter((p) => {
      const pDate = new Date(p.date);
      return pDate.getFullYear() === selectedYear && pDate.getMonth() === selectedMonth;
    });

    const monthlyIncome = incomes.filter((i) => {
      const iDate = new Date(i.date);
      return iDate.getFullYear() === selectedYear && iDate.getMonth() === selectedMonth;
    }).reduce((sum, item) => sum + item.amount, 0);

    const monthlyExpense = expenses.filter((e) => {
      const eDate = new Date(e.date);
      return eDate.getFullYear() === selectedYear && eDate.getMonth() === selectedMonth;
    }).reduce((sum, item) => sum + item.amount, 0);

    const totalPaidThisMonth = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);

    const monthlyCompareData = [
      { label: "Gelir", value: monthlyIncome, color: "#10b981" },
      { label: "Gider", value: monthlyExpense, color: "#ef4444" },
      { label: "Borç Ödemesi", value: totalPaidThisMonth, color: "#6366f1" },
    ];

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
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
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
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
          >
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic monthly summaries card */}
        <div className="p-4 bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-3xl grid gap-4 sm:grid-cols-3 font-semibold text-xs shadow-md">
          <div className="space-y-1">
            <span className="text-slate-400 block font-semibold text-[10px] uppercase">GELİR KAPILARI</span>
            <p className="text-sm font-black flex items-center gap-1"><Wallet className="w-4 h-4 text-emerald-400 shrink-0" /> {format(monthlyIncome)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block font-semibold text-[10px] uppercase">TOPLAM MASRAF/GİDER</span>
            <p className="text-sm font-black flex items-center gap-1"><ShoppingBag className="w-4 h-4 text-rose-400 shrink-0" /> {format(monthlyExpense)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-amber-400 block font-bold text-[10px] uppercase">AKTARILAN ÖDEMELER</span>
            <p className="text-sm font-black flex items-center gap-1 text-sky-400">{format(totalPaidThisMonth)}</p>
          </div>
        </div>

        {/* Comparison Analytics */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-500" /> bütçe Karşılaştırma Grafiği
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
      </div>
    );
  }

  // Yearly follow up view ("yearly")
  const yearlyPayments = payments.filter((p) => new Date(p.date).getFullYear() === selectedYear);
  const totalYearlyPaid = yearlyPayments.reduce((sum, p) => sum + p.amount, 0);

  // Group payments by month (0-11)
  const monthlyDataYear = Array(12).fill(0);
  yearlyPayments.forEach((p) => {
    const month = new Date(p.date).getMonth();
    monthlyDataYear[month] += p.amount;
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
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold dark:text-white"
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Calendar,
  BarChart3,
  LineChart as LucideLine,
  ClipboardList,
  Wallet,
  ShoppingBag,
  Trash2,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  FileText,
  Download,
  Sparkles,
  TrendingUp,
  TrendingDown,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Percent
} from "lucide-react";
import { motion } from "motion/react";
import { Debt, Income, Expense, PaymentLog, InstallmentDebt } from "../types";
import { BarChart, LineChart } from "./BudgetCharts";
import { useCurrency } from "../utils/CurrencyContext";
import { t } from "../utils/translations";
import { parseDateParts } from "../utils/dateUtils";
import { generateAnnualPdfReport, calculateAnnualData } from "../utils/annualPdfReport";

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
        <div className="p-5 sm:p-6 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl grid gap-4 sm:grid-cols-2 font-semibold text-xs shadow-xl border border-indigo-500/30 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
          <div className="space-y-1.5 relative z-10">
            <span className="text-emerald-300 block font-bold text-[10px] uppercase tracking-wider">GELİR KAPILARI</span>
            <p className="text-base sm:text-lg font-black flex items-center gap-2 font-mono"><Wallet className="w-5 h-5 text-emerald-400 shrink-0" /> {format(monthlyIncome)}</p>
          </div>
          <div className="space-y-1.5 relative z-10">
            <span className="text-rose-300 block font-bold text-[10px] uppercase tracking-wider">TOPLAM MASRAF / GİDER</span>
            <p className="text-base sm:text-lg font-black flex items-center gap-2 font-mono"><ShoppingBag className="w-5 h-5 text-rose-400 shrink-0" /> {format(monthlyExpense)}</p>
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  const annualData = calculateAnnualData({
    year: selectedYear,
    incomes,
    expenses,
    payments,
    debts,
    installmentDebts
  });

  const handleDownloadAnnualPdf = () => {
    setIsGeneratingPdf(true);
    try {
      const res = generateAnnualPdfReport({
        year: selectedYear,
        incomes,
        expenses,
        payments,
        debts,
        installmentDebts,
        currencySymbol: "₺",
        language
      });
      if (res.success) {
        setPdfSuccessMessage(`📄 '${res.fileName}' başarıyla oluşturuldu ve indirildi!`);
        setTimeout(() => setPdfSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error("Annual PDF generation error:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const monthlyDataYear = annualData.monthlyBreakdown.map((m) => m.payment);
  const monthlyExpenseYear = annualData.monthlyBreakdown.map((m) => m.expense);
  const monthlyIncomeYear = annualData.monthlyBreakdown.map((m) => m.income);

  return (
    <div className="space-y-6">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <LucideLine className="w-7 h-7 text-indigo-500 animate-pulse" /> YILLIK GELİR, HARCAMA VE BORÇ ANALİZİ
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      {/* Top Controls: Year Selector & One-Click PDF Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Analiz Yılı:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white cursor-pointer shadow-sm focus:ring-2 focus:ring-indigo-500"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
              <option key={y} value={y}>
                {y} Yılı
              </option>
            ))}
          </select>
        </div>

        {/* ONE-CLICK ANNUAL PDF SUMMARY BUTTON */}
        <button
          onClick={handleDownloadAnnualPdf}
          disabled={isGeneratingPdf}
          className="px-4 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isGeneratingPdf ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>PDF Raporu Hazırlanıyor...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-amber-300" />
              <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
              <span>Tek Tuşla {selectedYear} Yıllık PDF Özeti Oluştur</span>
              <Download className="w-4 h-4 text-indigo-100 ml-0.5" />
            </>
          )}
        </button>
      </div>

      {pdfSuccessMessage && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{pdfSuccessMessage}</span>
        </motion.div>
      )}

      {/* 4 Executive Annual KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Annual Income */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="p-4 sm:p-5 bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 dark:from-emerald-950/90 dark:via-teal-950 dark:to-slate-900 border border-emerald-500/40 text-white rounded-3xl shadow-lg shadow-emerald-500/10 space-y-1 relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/10 blur-lg pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-200">Yıllık Toplam Gelir</span>
            <div className="w-7 h-7 rounded-xl bg-white/15 border border-white/20 text-emerald-200 flex items-center justify-center backdrop-blur-xs">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-white font-mono tracking-tight relative z-10 drop-shadow-xs">
            {format(annualData.totalIncome)}
          </p>
          <p className="text-[10.5px] text-emerald-100 font-bold relative z-10">
            Aylık Ort: {format(annualData.avgMonthlyIncome)}
          </p>
        </motion.div>

        {/* Total Annual Expense */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="p-4 sm:p-5 bg-gradient-to-br from-rose-600 via-red-700 to-indigo-950 dark:from-rose-950/90 dark:via-red-950 dark:to-slate-900 border border-rose-500/40 text-white rounded-3xl shadow-lg shadow-rose-500/10 space-y-1 relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/10 blur-lg pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-200">Yıllık Harcama</span>
            <div className="w-7 h-7 rounded-xl bg-white/15 border border-white/20 text-rose-200 flex items-center justify-center backdrop-blur-xs">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-white font-mono tracking-tight relative z-10 drop-shadow-xs">
            {format(annualData.totalExpense)}
          </p>
          <p className="text-[10.5px] text-rose-100 font-bold relative z-10">
            Aylık Ort: {format(annualData.avgMonthlyExpense)}
          </p>
        </motion.div>

        {/* Total Annual Debt Payments */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="p-4 sm:p-5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-950 dark:from-indigo-950/90 dark:via-indigo-900 dark:to-slate-900 border border-indigo-500/40 text-white rounded-3xl shadow-lg shadow-indigo-500/10 space-y-1 relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/10 blur-lg pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-indigo-200">Borç Kapatma</span>
            <div className="w-7 h-7 rounded-xl bg-white/15 border border-white/20 text-indigo-200 flex items-center justify-center backdrop-blur-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-white font-mono tracking-tight relative z-10 drop-shadow-xs">
            {format(annualData.totalPayment)}
          </p>
          <p className="text-[10.5px] text-indigo-100 font-bold relative z-10">
            Aylık Ort: {format(annualData.avgMonthlyPayment)}
          </p>
        </motion.div>

        {/* Net Annual Balance & Savings */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`p-4 sm:p-5 ${
            annualData.netBalance >= 0 
              ? "bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-950 dark:from-teal-950/90 dark:via-teal-900 dark:to-slate-900 border-teal-500/40 shadow-teal-500/10" 
              : "bg-gradient-to-br from-amber-600 via-amber-700 to-orange-950 dark:from-amber-950/90 dark:via-amber-900 dark:to-slate-900 border-amber-500/40 shadow-amber-500/10"
          } border text-white rounded-3xl shadow-lg space-y-1 relative overflow-hidden`}
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/10 blur-lg pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-white">
              Yıllık Net Bakiye
            </span>
            <div className="w-7 h-7 rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center backdrop-blur-xs">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-white font-mono tracking-tight relative z-10 drop-shadow-xs">
            {format(annualData.netBalance)}
          </p>
          <p className="text-[10.5px] font-bold text-white/90 relative z-10">
            Tasarruf Oranı: %{annualData.savingsRate.toFixed(1)}
          </p>
        </motion.div>
      </div>

      {/* 12-Month Table & Comparison View */}
      <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-indigo-500" /> {selectedYear} YILI AYLIK BÜTÇE DÖNGÜSÜ & KARŞILAŞTIRMA
          </h4>
          <span className="text-[11px] text-slate-400 font-medium">12 Aylık Veri Özeti</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 text-[11px] font-bold">
                <th className="pb-2.5 font-bold">Ay</th>
                <th className="pb-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">Gelir</th>
                <th className="pb-2.5 text-right font-bold text-rose-500 dark:text-rose-400">Harcama</th>
                <th className="pb-2.5 text-right font-bold text-indigo-500 dark:text-indigo-400">Borç Ödemesi</th>
                <th className="pb-2.5 text-right font-bold text-slate-700 dark:text-slate-200">Net Bakiye</th>
                <th className="pb-2.5 text-right font-bold">Tasarruf %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {annualData.monthlyBreakdown.map((row) => (
                <tr key={row.monthIndex} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="py-2 font-bold text-slate-800 dark:text-slate-200">{row.monthName}</td>
                  <td className="py-2 text-right font-mono text-emerald-600 dark:text-emerald-400">{format(row.income)}</td>
                  <td className="py-2 text-right font-mono text-rose-500 dark:text-rose-400">{format(row.expense)}</td>
                  <td className="py-2 text-right font-mono text-indigo-500 dark:text-indigo-400">{format(row.payment)}</td>
                  <td className={`py-2 text-right font-bold font-mono ${row.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                    {format(row.net)}
                  </td>
                  <td className="py-2 text-right text-slate-500 dark:text-slate-400">
                    {row.income > 0 ? `%${row.savingsRate.toFixed(1)}` : "-"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-extrabold bg-slate-50/80 dark:bg-slate-900/50">
                <td className="py-2.5 text-slate-900 dark:text-white">YILLIK TOPLAM</td>
                <td className="py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{format(annualData.totalIncome)}</td>
                <td className="py-2.5 text-right font-mono text-rose-500 dark:text-rose-400">{format(annualData.totalExpense)}</td>
                <td className="py-2.5 text-right font-mono text-indigo-500 dark:text-indigo-400">{format(annualData.totalPayment)}</td>
                <td className={`py-2.5 text-right font-mono ${annualData.netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                  {format(annualData.netBalance)}
                </td>
                <td className="py-2.5 text-right text-indigo-600 dark:text-indigo-400">
                  %{annualData.savingsRate.toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Breakdown & Trend Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Category Breakdown */}
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-indigo-500" /> {selectedYear} KATEGORİ BAZLI HARCAMA PAYI
          </h4>
          {annualData.categoryBreakdown.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              Bu yıl için henüz kayıtlı harcama bulunmamaktadır.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {annualData.categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 dark:text-slate-400">{format(cat.amount)}</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] w-12 text-right">
                        %{cat.percentage.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Annual Borç Kapatma Trendi Chart */}
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/40 dark:border-slate-700/50 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <LucideLine className="w-4 h-4 text-indigo-500" /> {selectedYear} AYLIK BORÇ ÖDEME VE KAPATMA TRENDİ
          </h4>
          <LineChart labels={monthsList} values={monthlyDataYear} lineColor="#4f46e5" />
        </div>
      </div>

      {/* Bottom Summary Call-to-Action Bar */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-sm sm:text-base font-extrabold flex items-center justify-center sm:justify-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> {selectedYear} Yıllık Finansal Özet PDF Raporu Hazır
          </h3>
          <p className="text-xs text-slate-300">
            Tüm 12 aylık gelir, gider, borç ödemeleri ve kategori dağılımlarını tek tuşla profesyonel PDF dosyası olarak cihazınıza indirin.
          </p>
        </div>
        <button
          onClick={handleDownloadAnnualPdf}
          disabled={isGeneratingPdf}
          className="w-full sm:w-auto px-5 py-3 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-md shrink-0 active:scale-95 cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>{isGeneratingPdf ? "Oluşturuluyor..." : "PDF Raporunu İndir (Tek Tuş)"}</span>
        </button>
      </div>
    </div>
  );
};

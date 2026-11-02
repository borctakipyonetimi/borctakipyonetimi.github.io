/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from "jspdf";
import { Debt, Income, Expense, PaymentLog, InstallmentDebt } from "../types";
import { parseDateParts } from "./dateUtils";
import { isAndroidAlarmBridgeAvailable, saveAndroidNativeFile } from "./androidAlarmBridge";
import { downloadFileWithCustomName, savePdfDocument } from "./fileDownloadHelper";

export interface AnnualReportOptions {
  year: number;
  incomes: Income[];
  expenses: Expense[];
  payments: PaymentLog[];
  debts?: Debt[];
  installmentDebts?: InstallmentDebt[];
  currencySymbol?: string;
  language?: "tr" | "en";
}

export interface MonthlyBreakdown {
  monthIndex: number;
  monthName: string;
  income: number;
  expense: number;
  payment: number;
  net: number;
  savingsRate: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  monthlyAverage: number;
}

export interface AnnualReportData {
  year: number;
  totalIncome: number;
  totalExpense: number;
  totalPayment: number;
  netBalance: number;
  savingsRate: number;
  monthlyBreakdown: MonthlyBreakdown[];
  categoryBreakdown: CategoryBreakdown[];
  topIncomeMonth: { monthName: string; amount: number };
  topExpenseMonth: { monthName: string; amount: number };
  topSavingsMonth: { monthName: string; amount: number };
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgMonthlyPayment: number;
  avgMonthlyNet: number;
}

/**
 * Normalizes text to ASCII safe characters for jsPDF default Helvetica font
 */
export function safePdfText(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return "";
  const str = String(text);
  const map: { [key: string]: string } = {
    "ç": "c", "Ç": "C",
    "ğ": "g", "Ğ": "G",
    "ı": "i", "İ": "I",
    "ö": "o", "Ö": "O",
    "ş": "s", "Ş": "S",
    "ü": "u", "Ü": "U",
    "₺": "TL"
  };
  return str.replace(/[çÇğĞıİöÖşŞüÜ₺]/g, (match) => map[match] || match);
}

/**
 * Formats currency amount safely for PDF tables
 */
export function formatPdfCurrency(amount: number, symbol: string = "TL"): string {
  const isNeg = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const safeSym = safePdfText(symbol).trim() || "TL";
  return `${isNeg ? "-" : ""}${formatted} ${safeSym}`;
}

/**
 * Calculates all mathematical aggregations for the annual report
 */
export function calculateAnnualData(options: AnnualReportOptions): AnnualReportData {
  const {
    year,
    incomes = [],
    expenses = [],
    payments = [],
    debts = [],
    installmentDebts = []
  } = options;

  const monthsListTr = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  const validDebtIds = new Set(debts.map((d) => d.id));
  const validInstIds = new Set(installmentDebts.map((i) => i.id));

  const monthlyBreakdown: MonthlyBreakdown[] = [];

  for (let m = 0; m < 12; m++) {
    const selectedTime = year * 12 + m;

    // 1. Incomes (recurring vs one-time)
    const monthIncome = incomes
      .filter((i) => {
        const parts = parseDateParts(i.date);
        if (!parts) return true;
        if (i.isRecurring !== false) {
          const incomeTime = parts.year * 12 + parts.month;
          return selectedTime >= incomeTime;
        } else {
          return parts.year === year && parts.month === m;
        }
      })
      .reduce((sum, item) => sum + item.amount, 0);

    // 2. Expenses strictly in this month and year
    const monthExpense = expenses
      .filter((e) => {
        const parts = parseDateParts(e.date);
        if (!parts) return false;
        return parts.year === year && parts.month === m;
      })
      .reduce((sum, item) => sum + item.amount, 0);

    // 3. Debt & installment payments strictly in this month and year
    const monthPayment = payments
      .filter((p) => {
        if (p.debtId && !validDebtIds.has(p.debtId) && !validInstIds.has(p.debtId)) {
          return false;
        }
        const parts = parseDateParts(p.date);
        if (!parts) return false;
        return parts.year === year && parts.month === m;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const net = monthIncome - (monthExpense + monthPayment);
    const savingsRate = monthIncome > 0 ? (net / monthIncome) * 100 : 0;

    monthlyBreakdown.push({
      monthIndex: m,
      monthName: monthsListTr[m],
      income: monthIncome,
      expense: monthExpense,
      payment: monthPayment,
      net,
      savingsRate
    });
  }

  const totalIncome = monthlyBreakdown.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = monthlyBreakdown.reduce((sum, m) => sum + m.expense, 0);
  const totalPayment = monthlyBreakdown.reduce((sum, m) => sum + m.payment, 0);
  const netBalance = totalIncome - (totalExpense + totalPayment);
  const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

  // Category breakdown for expenses in this year
  const catMap = new Map<string, { amount: number; count: number }>();
  expenses.forEach((e) => {
    const parts = parseDateParts(e.date);
    if (parts && parts.year === year) {
      const cat = e.category || "Diğer Harcamalar";
      const existing = catMap.get(cat) || { amount: 0, count: 0 };
      catMap.set(cat, {
        amount: existing.amount + e.amount,
        count: existing.count + 1
      });
    }
  });

  const categoryBreakdown: CategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0,
      count: data.count,
      monthlyAverage: data.amount / 12
    }))
    .sort((a, b) => b.amount - a.amount);

  // Peak metrics
  let topIncomeMonth = { monthName: "-", amount: -1 };
  let topExpenseMonth = { monthName: "-", amount: -1 };
  let topSavingsMonth = { monthName: "-", amount: -Infinity };

  monthlyBreakdown.forEach((m) => {
    if (m.income > topIncomeMonth.amount) {
      topIncomeMonth = { monthName: m.monthName, amount: m.income };
    }
    if (m.expense > topExpenseMonth.amount) {
      topExpenseMonth = { monthName: m.monthName, amount: m.expense };
    }
    if (m.net > topSavingsMonth.amount) {
      topSavingsMonth = { monthName: m.monthName, amount: m.net };
    }
  });

  return {
    year,
    totalIncome,
    totalExpense,
    totalPayment,
    netBalance,
    savingsRate,
    monthlyBreakdown,
    categoryBreakdown,
    topIncomeMonth,
    topExpenseMonth,
    topSavingsMonth,
    avgMonthlyIncome: totalIncome / 12,
    avgMonthlyExpense: totalExpense / 12,
    avgMonthlyPayment: totalPayment / 12,
    avgMonthlyNet: netBalance / 12
  };
}

/**
 * Generates and triggers download of the official Annual Financial Summary PDF Report
 */
export async function generateAnnualPdfReport(options: AnnualReportOptions): Promise<{
  success: boolean;
  fileName: string;
  doc: jsPDF;
}> {
  const data = calculateAnnualData(options);
  const symbol = options.currencySymbol || "TL";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fileName = `ButcemPro_${data.year}_Yillik_Finansal_Rapor.pdf`;

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // ----------------------------------------------------
  // PAGE 1: HEADER & 12-MONTH FINANCIAL STATEMENT TABLE
  // ----------------------------------------------------

  // Header Banner Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 36, "F");

  // Accent line
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 36, pageWidth, 2, "F");

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(15);
  doc.text(safePdfText(`BÜTÇEM PRO - ${data.year} YILLIK FİNANSAL ANALİZ RAPORU`), margin, 15);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(safePdfText("Kapsamli Gelir, Harcama, Borc Kapatma ve Tasarruf Performansi Ozeti"), margin, 22);

  const docSerial = `BP-YIL-${data.year}-${Date.now().toString().slice(-6)}`;
  const dateStr = new Date().toLocaleDateString("tr-TR");
  const timeStr = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(safePdfText(`Belge No: ${docSerial}  |  Olusturuldu: ${dateStr} ${timeStr}  |  Birim: ${symbol}`), margin, 30);

  // SECTION 1: EXECUTIVE KPI SUMMARY WIDGETS
  let y = 44;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(safePdfText(`1. ${data.year} YILI FİNANSAL GENEL GÖSTERGELERİ (YILLIK TOPLAMLAR)`), margin, y);

  y += 4;
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 22;

  // KPI 1: Toplam Gelir
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "S");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(21, 128, 61); // emerald-700
  doc.text(safePdfText("TOPLAM GELİR"), margin + 3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text(formatPdfCurrency(data.totalIncome, symbol), margin + 3, y + 15);

  // KPI 2: Toplam Gider
  const kpi2X = margin + cardWidth + 3;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.roundedRect(kpi2X, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(kpi2X, y, cardWidth, cardHeight, 2, 2, "S");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(190, 18, 60); // rose-700
  doc.text(safePdfText("TOPLAM GİDER"), kpi2X + 3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(225, 29, 72);
  doc.text(formatPdfCurrency(data.totalExpense, symbol), kpi2X + 3, y + 15);

  // KPI 3: Borç Ödemesi
  const kpi3X = kpi2X + cardWidth + 3;
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.roundedRect(kpi3X, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(kpi3X, y, cardWidth, cardHeight, 2, 2, "S");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(safePdfText("BORÇ ÖDEMELERİ"), kpi3X + 3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229);
  doc.text(formatPdfCurrency(data.totalPayment, symbol), kpi3X + 3, y + 15);

  // KPI 4: Net Bakiye & Tasarruf
  const kpi4X = kpi3X + cardWidth + 3;
  const isNetPos = data.netBalance >= 0;
  doc.setFillColor(isNetPos ? 236 : 254, isNetPos ? 253 : 242, isNetPos ? 245 : 242);
  doc.roundedRect(kpi4X, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(isNetPos ? 167 : 254, isNetPos ? 243 : 205, isNetPos ? 208 : 211);
  doc.roundedRect(kpi4X, y, cardWidth, cardHeight, 2, 2, "S");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(isNetPos ? 4 : 190, isNetPos ? 120 : 18, isNetPos ? 87 : 60);
  doc.text(safePdfText(`NET BAKİYE (${data.savingsRate.toFixed(1)}%)`), kpi4X + 3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(isNetPos ? 5 : 225, isNetPos ? 150 : 29, isNetPos ? 105 : 72);
  doc.text(formatPdfCurrency(data.netBalance, symbol), kpi4X + 3, y + 15);

  // SECTION 2: 12-MONTH DETAILED FINANCIAL TABLE
  y += cardHeight + 8;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(safePdfText(`2. ${data.year} YILI AYLIK DETAYLI BÜTÇE VE AKIŞ TABLOSU`), margin, y);

  y += 4;
  // Table Header
  const colWidths = [26, 31, 31, 31, 33, 30]; // sum = 182 = contentWidth
  const headers = ["DÖNEM", "GELİR", "GİDER", "BORÇ ÖDEMESİ", "NET BAKİYE", "TASARRUF %"];

  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  let curX = margin;
  headers.forEach((h, idx) => {
    const alignRight = idx > 0;
    if (alignRight) {
      doc.text(safePdfText(h), curX + colWidths[idx] - 3, y + 4.8, { align: "right" });
    } else {
      doc.text(safePdfText(h), curX + 3, y + 4.8);
    }
    curX += colWidths[idx];
  });

  y += 7;

  // Table Rows (12 Months)
  data.monthlyBreakdown.forEach((row, idx) => {
    const rowHeight = 6.2;
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.rect(margin, y, contentWidth, rowHeight, "F");

    // Row borders
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    let cellX = margin;

    // Month
    doc.setFont("Helvetica", "bold");
    doc.text(safePdfText(row.monthName), cellX + 3, y + 4.4);
    cellX += colWidths[0];

    // Income
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(16, 185, 129);
    doc.text(formatPdfCurrency(row.income, symbol), cellX + colWidths[1] - 3, y + 4.4, { align: "right" });
    cellX += colWidths[1];

    // Expense
    doc.setTextColor(225, 29, 72);
    doc.text(formatPdfCurrency(row.expense, symbol), cellX + colWidths[2] - 3, y + 4.4, { align: "right" });
    cellX += colWidths[2];

    // Payment
    doc.setTextColor(79, 70, 229);
    doc.text(formatPdfCurrency(row.payment, symbol), cellX + colWidths[3] - 3, y + 4.4, { align: "right" });
    cellX += colWidths[3];

    // Net
    const rowNetPos = row.net >= 0;
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(rowNetPos ? 5 : 225, rowNetPos ? 150 : 29, rowNetPos ? 105 : 72);
    doc.text(formatPdfCurrency(row.net, symbol), cellX + colWidths[4] - 3, y + 4.4, { align: "right" });
    cellX += colWidths[4];

    // Savings %
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(rowNetPos ? 4 : 190, rowNetPos ? 120 : 18, rowNetPos ? 87 : 60);
    const rateText = row.income > 0 ? `%${row.savingsRate.toFixed(1)}` : "-";
    doc.text(safePdfText(rateText), cellX + colWidths[5] - 3, y + 4.4, { align: "right" });

    y += rowHeight;
  });

  // Table Totals / Summary Row
  const totalRowHeight = 8;
  doc.setFillColor(224, 231, 255); // indigo-100
  doc.rect(margin, y, contentWidth, totalRowHeight, "F");
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentWidth, totalRowHeight, "S");

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  let totalX = margin;
  doc.text(safePdfText("YILLIK TOPLAM"), totalX + 3, y + 5.3);
  totalX += colWidths[0];

  doc.setTextColor(5, 150, 105);
  doc.text(formatPdfCurrency(data.totalIncome, symbol), totalX + colWidths[1] - 3, y + 5.3, { align: "right" });
  totalX += colWidths[1];

  doc.setTextColor(225, 29, 72);
  doc.text(formatPdfCurrency(data.totalExpense, symbol), totalX + colWidths[2] - 3, y + 5.3, { align: "right" });
  totalX += colWidths[2];

  doc.setTextColor(79, 70, 229);
  doc.text(formatPdfCurrency(data.totalPayment, symbol), totalX + colWidths[3] - 3, y + 5.3, { align: "right" });
  totalX += colWidths[3];

  doc.setTextColor(data.netBalance >= 0 ? 5 : 225, data.netBalance >= 0 ? 150 : 29, data.netBalance >= 0 ? 105 : 72);
  doc.text(formatPdfCurrency(data.netBalance, symbol), totalX + colWidths[4] - 3, y + 5.3, { align: "right" });
  totalX += colWidths[4];

  doc.setTextColor(30, 41, 59);
  doc.text(safePdfText(`%${data.savingsRate.toFixed(1)}`), totalX + colWidths[5] - 3, y + 5.3, { align: "right" });

  // Page 1 Footer
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(safePdfText("Bütçem Pro Finansal Takip Sistemi • Gizli ve Kişiye Özel Finansal Değerlendirme • Sayfa 1 / 2"), margin, pageHeight - 8);

  // ----------------------------------------------------
  // PAGE 2: CATEGORY EXPENSE BREAKDOWN & EXECUTIVE INSIGHTS
  // ----------------------------------------------------
  doc.addPage();

  // Page 2 Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 22, pageWidth, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text(safePdfText(`BÜTÇEM PRO - ${data.year} YILLIK HARCAMA DAĞILIMI VE FİNANSAL DEĞERLENDİRME`), margin, 14);

  y = 30;

  // SECTION 3: CATEGORY EXPENSES BREAKDOWN TABLE
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(safePdfText(`3. ${data.year} YILI KATEGORİ BAZLI HARCAMA DAĞILIMI`), margin, y);

  y += 4;
  const catColWidths = [50, 30, 36, 32, 34]; // sum = 182
  const catHeaders = ["KATEGORİ ADI", "İŞLEM ADEDİ", "TOPLAM TUTAR", "HARCAMA PAYI (%)", "AYLIK ORTALAMA"];

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  let curCatX = margin;
  catHeaders.forEach((h, idx) => {
    const alignRight = idx > 0;
    if (alignRight) {
      doc.text(safePdfText(h), curCatX + catColWidths[idx] - 3, y + 4.8, { align: "right" });
    } else {
      doc.text(safePdfText(h), curCatX + 3, y + 4.8);
    }
    curCatX += catColWidths[idx];
  });

  y += 7;

  if (data.categoryBreakdown.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 10, "F");
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(safePdfText(`${data.year} yilina ait kayitli harcama kategorisi bulunamadi.`), margin + 6, y + 6.5);
    y += 10;
  } else {
    // Show top 12 categories or all
    const displayCats = data.categoryBreakdown.slice(0, 14);
    displayCats.forEach((cat, idx) => {
      const rowHeight = 6.2;
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      doc.rect(margin, y, contentWidth, rowHeight, "F");

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      let cellX = margin;

      // Name
      doc.setFont("Helvetica", "bold");
      doc.text(safePdfText(cat.category), cellX + 3, y + 4.4);
      cellX += catColWidths[0];

      // Count
      doc.setFont("Helvetica", "normal");
      doc.text(safePdfText(`${cat.count} islem`), cellX + catColWidths[1] - 3, y + 4.4, { align: "right" });
      cellX += catColWidths[1];

      // Total
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(225, 29, 72);
      doc.text(formatPdfCurrency(cat.amount, symbol), cellX + catColWidths[2] - 3, y + 4.4, { align: "right" });
      cellX += catColWidths[2];

      // Percentage
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(safePdfText(`%${cat.percentage.toFixed(1)}`), cellX + catColWidths[3] - 3, y + 4.4, { align: "right" });
      cellX += catColWidths[3];

      // Monthly Avg
      doc.setTextColor(100, 116, 139);
      doc.text(formatPdfCurrency(cat.monthlyAverage, symbol), cellX + catColWidths[4] - 3, y + 4.4, { align: "right" });

      y += rowHeight;
    });
  }

  // SECTION 4: ANNUAL FINANCIAL HEALTH & INSIGHTS CARD
  y += 8;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(safePdfText(`4. ${data.year} YILI FİNANSAL DEĞERLENDİRME VE AKILLI ÖZET NOTLARI`), margin, y);

  y += 4;
  const noteBoxHeight = 58;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, y, contentWidth, noteBoxHeight, 3, 3, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, noteBoxHeight, 3, 3, "S");

  let noteY = y + 7;
  doc.setFontSize(8);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(51, 65, 85); // slate-700

  // Point 1: Highest & Lowest Months
  doc.setFont("Helvetica", "bold");
  doc.text(safePdfText("• En Yüksek Gelir Ayı:"), margin + 4, noteY);
  doc.setFont("Helvetica", "normal");
  doc.text(safePdfText(`${data.topIncomeMonth.monthName} (${formatPdfCurrency(data.topIncomeMonth.amount, symbol)})`), margin + 45, noteY);

  doc.setFont("Helvetica", "bold");
  doc.text(safePdfText("• En Yüksek Harcama Ayı:"), margin + 98, noteY);
  doc.setFont("Helvetica", "normal");
  doc.text(safePdfText(`${data.topExpenseMonth.monthName} (${formatPdfCurrency(data.topExpenseMonth.amount, symbol)})`), margin + 144, noteY);

  noteY += 8;
  // Point 2: Monthly Averages
  doc.setFont("Helvetica", "bold");
  doc.text(safePdfText("• Aylık Ortalama Gelir:"), margin + 4, noteY);
  doc.setFont("Helvetica", "normal");
  doc.text(formatPdfCurrency(data.avgMonthlyIncome, symbol), margin + 45, noteY);

  doc.setFont("Helvetica", "bold");
  doc.text(safePdfText("• Aylık Ortalama Gider:"), margin + 98, noteY);
  doc.setFont("Helvetica", "normal");
  doc.text(formatPdfCurrency(data.avgMonthlyExpense, symbol), margin + 144, noteY);

  noteY += 8;
  // Point 3: Debt Payments & Net Monthly Average
  doc.setFont("Helvetica", "bold");
  doc.text(safePdfText("• Aylık Ort. Borç Ödemesi:"), margin + 4, noteY);
  doc.setFont("Helvetica", "normal");
  doc.text(formatPdfCurrency(data.avgMonthlyPayment, symbol), margin + 45, noteY);

  doc.setFont("Helvetica", "bold");
  doc.text(safePdfText("• Aylık Ort. Net Artık:"), margin + 98, noteY);
  doc.setFont("Helvetica", "normal");
  doc.text(formatPdfCurrency(data.avgMonthlyNet, symbol), margin + 144, noteY);

  noteY += 10;
  // Point 4: Smart Narrative Analysis
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 4, noteY - 2, margin + contentWidth - 4, noteY - 2);

  doc.setFont("Helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(safePdfText("Finansal Sağlık Analizi:"), margin + 4, noteY + 3);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  let healthSummary = "";
  if (data.netBalance > 0 && data.savingsRate >= 20) {
    healthSummary = `${data.year} yilinda elde edilen toplam gelirin %${data.savingsRate.toFixed(1)}'i tasarruf edilmistir. Finansal surdurulebilirlik cok yuksek seviyededir.`;
  } else if (data.netBalance > 0) {
    healthSummary = `${data.year} yilinda butce pozitif kapatilmis olup %${data.savingsRate.toFixed(1)} tasarruf saglanmistir. Borc ve gider disiplini basarilidir.`;
  } else {
    healthSummary = `${data.year} yilinda toplam harcama ve borc odemeleri geliri asmis bulunmaktadir. Gelecek yil icin sabit gider optimizasyonu tavsiye edilir.`;
  }

  const splitText = doc.splitTextToSize(safePdfText(healthSummary), contentWidth - 8);
  doc.text(splitText, margin + 4, noteY + 8);

  // Page 2 Footer
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(safePdfText("Bütçem Pro Finansal Takip Sistemi • Gizli ve Kişiye Özel Finansal Değerlendirme • Sayfa 2 / 2"), margin, pageHeight - 8);

  // Universal Robust Save & Download for Web, WebView and Mobile APK
  try {
    await savePdfDocument(doc, fileName);
  } catch (err) {
    console.warn("[annualPdfReport] savePdfDocument error:", err);
  }

  return { success: true, fileName, doc };
}

export interface MonthlyReportOptions {
  month: number; // 0-11
  year: number;
  incomes: Income[];
  expenses: Expense[];
  payments: PaymentLog[];
  debts?: Debt[];
  installmentDebts?: InstallmentDebt[];
  currencySymbol?: string;
  userName?: string;
  language?: "tr" | "en";
}

/**
 * Generates and triggers download of the official Monthly Financial Statement PDF Report
 */
export async function generateMonthlyPdfReport(options: MonthlyReportOptions): Promise<{
  success: boolean;
  fileName: string;
  doc: jsPDF;
}> {
  const {
    month,
    year,
    incomes = [],
    expenses = [],
    payments = [],
    debts = [],
    installmentDebts = [],
    currencySymbol = "TL",
    userName = "Bütçem Pro Kullanıcısı"
  } = options;

  const monthsListTr = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];
  const monthName = monthsListTr[month] || "Ay";
  const periodName = `${monthName} ${year}`;
  const fileName = `ButcemPro_${monthName}_${year}_Finansal_Raporu.pdf`;

  const selectedPeriodMonthIdx = year * 12 + month;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 1. Incomes for this month (with recurring)
  const monthIncomes: Array<{ name: string; amount: number; date: string; isRecurring?: boolean }> = [];
  let totalIncome = 0;
  incomes.forEach((i) => {
    const amt = Number(i.amount) || 0;
    if (amt <= 0) return;
    const parts = parseDateParts(i.date);
    if (!parts) {
      monthIncomes.push({ name: i.name || "Gelir", amount: amt, date: i.date || `${year}-${String(month + 1).padStart(2, "0")}-01` });
      totalIncome += amt;
      return;
    }
    const incMonthIdx = parts.year * 12 + parts.month;
    if (i.isRecurring) {
      if (selectedPeriodMonthIdx >= incMonthIdx) {
        monthIncomes.push({
          name: i.name || "Düzenli Gelir",
          amount: amt,
          date: `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(parts.day, daysInMonth)).padStart(2, "0")}`,
          isRecurring: true
        });
        totalIncome += amt;
      }
    } else if (parts.year === year && parts.month === month) {
      monthIncomes.push({ name: i.name || "Gelir", amount: amt, date: i.date, isRecurring: false });
      totalIncome += amt;
    }
  });

  // 2. Expenses for this month (with recurring)
  const monthExpenses: Array<{ name: string; category: string; amount: number; date: string; isRecurring?: boolean }> = [];
  let totalExpense = 0;
  expenses.forEach((e) => {
    const amt = Number(e.amount) || 0;
    if (amt <= 0) return;
    const parts = parseDateParts(e.date);
    const cat = e.category || "Genel Gider";
    const desc = e.description || "Gider Kaydı";
    if (!parts) {
      monthExpenses.push({ name: desc, category: cat, amount: amt, date: e.date || `${year}-${String(month + 1).padStart(2, "0")}-01` });
      totalExpense += amt;
      return;
    }
    const expMonthIdx = parts.year * 12 + parts.month;
    if (e.isRecurring) {
      if (selectedPeriodMonthIdx >= expMonthIdx) {
        monthExpenses.push({
          name: desc,
          category: cat,
          amount: amt,
          date: `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(parts.day, daysInMonth)).padStart(2, "0")}`,
          isRecurring: true
        });
        totalExpense += amt;
      }
    } else if (parts.year === year && parts.month === month) {
      monthExpenses.push({ name: desc, category: cat, amount: amt, date: e.date, isRecurring: false });
      totalExpense += amt;
    }
  });

  // 3. Debts & Installments paid / due in this month
  const isDateInMonth = (dateStr: string) => {
    const p = parseDateParts(dateStr);
    return p ? (p.year === year && p.month === month) : false;
  };

  let totalPaidDebtsAndInstallments = 0;
  let totalRemainingDebtInMonth = 0;
  const monthDebtsList: Array<{ name: string; type: string; dueDate: string; amount: number; paid: number; remaining: number; status: string }> = [];

  // Debts
  debts.forEach((d) => {
    const amt = Number(d.amount) || 0;
    const parts = parseDateParts(d.dueDate || d.date);
    const isDue = parts ? (parts.year === year && parts.month === month) : false;
    const debtPaymentsInMonth = payments.filter((p) => p.debtId === d.id && p.type !== "installment" && isDateInMonth(p.date));
    const paidInMonthFromLogs = debtPaymentsInMonth.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    if (isDue) {
      let effectivePaid = 0;
      if (debtPaymentsInMonth.length > 0) {
        effectivePaid = Math.min(amt, paidInMonthFromLogs);
      } else if (d.paid !== undefined && d.paid !== null) {
        effectivePaid = Math.min(amt, Number(d.paid) || 0);
      }
      const rem = Math.max(0, amt - effectivePaid);
      totalPaidDebtsAndInstallments += effectivePaid;
      totalRemainingDebtInMonth += rem;
      monthDebtsList.push({
        name: d.name || "Borç",
        type: "Tekil Borç",
        dueDate: d.dueDate || "-",
        amount: amt,
        paid: effectivePaid,
        remaining: rem,
        status: rem <= 0 ? "Ödendi" : "Bekliyor"
      });
    } else if (paidInMonthFromLogs > 0) {
      totalPaidDebtsAndInstallments += paidInMonthFromLogs;
      monthDebtsList.push({
        name: d.name || "Borç",
        type: "Borç Ara Ödeme",
        dueDate: d.dueDate || "-",
        amount: paidInMonthFromLogs,
        paid: paidInMonthFromLogs,
        remaining: 0,
        status: "Ödendi"
      });
    }
  });

  // Installments
  installmentDebts.forEach((inst) => {
    const count = Number(inst.installmentCount) || 1;
    const totalAmt = Number(inst.totalAmount) || 0;
    const monthlyAmt = totalAmt / count;
    const paidCount = Number(inst.paidInstallmentCount) || 0;

    const startParts = parseDateParts(inst.firstDueDate);
    let hasInstInMonth = false;
    let instIdx = -1;
    if (startParts) {
      const diff = selectedPeriodMonthIdx - (startParts.year * 12 + startParts.month);
      if (diff >= 0 && diff < count) {
        hasInstInMonth = true;
        instIdx = diff;
      }
    } else if (isDateInMonth(inst.firstDueDate)) {
      hasInstInMonth = true;
      instIdx = 0;
    }

    const instPaymentsInMonth = payments.filter((p) => p.debtId === inst.id && p.type === "installment" && isDateInMonth(p.date));
    const paidInMonthFromLogs = instPaymentsInMonth.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    if (hasInstInMonth) {
      const isPaid = paidCount > instIdx || paidInMonthFromLogs >= (monthlyAmt - 0.01);
      const paidAmt = isPaid ? monthlyAmt : Math.min(monthlyAmt, paidInMonthFromLogs);
      const remAmt = Math.max(0, monthlyAmt - paidAmt);
      totalPaidDebtsAndInstallments += paidAmt;
      totalRemainingDebtInMonth += remAmt;
      monthDebtsList.push({
        name: inst.name || "Taksitli Borç",
        type: `Taksit (${instIdx + 1}/${count})`,
        dueDate: inst.firstDueDate || "-",
        amount: monthlyAmt,
        paid: paidAmt,
        remaining: remAmt,
        status: remAmt <= 0 ? "Ödendi" : "Bekliyor"
      });
    } else if (paidInMonthFromLogs > 0) {
      totalPaidDebtsAndInstallments += paidInMonthFromLogs;
      monthDebtsList.push({
        name: inst.name || "Taksitli Borç",
        type: "Taksit Ödemesi",
        dueDate: "-",
        amount: paidInMonthFromLogs,
        paid: paidInMonthFromLogs,
        remaining: 0,
        status: "Ödendi"
      });
    }
  });

  const netBalance = totalIncome - totalExpense - totalPaidDebtsAndInstallments;
  const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

  // Build PDF Document
  const symbol = options.currencySymbol || "TL";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 36, pageWidth, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text(safePdfText(`BÜTÇEM PRO - ${periodName.toUpperCase()} AYLIK FİNANSAL RAPORU`), margin, 15);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(safePdfText(`Sayin ${userName} • ${periodName} Gelir, Harcama ve Borc Yonetim Performansi`), margin, 22);

  const docSerial = `BP-AY-${year}-${String(month + 1).padStart(2, "0")}-${Date.now().toString().slice(-5)}`;
  const dateStr = new Date().toLocaleDateString("tr-TR");
  const timeStr = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(safePdfText(`Belge No: ${docSerial} | Tarih: ${dateStr} ${timeStr} | Para Birimi: ${symbol}`), margin, 30);

  // SECTION 1: 4 KPI CARDS
  let y = 44;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(safePdfText(`1. ${periodName.toUpperCase()} DÖNEMİ FİNANSAL GÖSTERGELERİ`), margin, y);

  y += 4;
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 22;

  // KPI 1: Toplam Gelir
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "S");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(21, 128, 61);
  doc.text(safePdfText("TOPLAM GELİR"), margin + 3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text(formatPdfCurrency(totalIncome, symbol), margin + 3, y + 15);

  // KPI 2: Toplam Gider
  const kpi2X = margin + cardWidth + 3;
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(kpi2X, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(kpi2X, y, cardWidth, cardHeight, 2, 2, "S");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(190, 18, 60);
  doc.text(safePdfText("TOPLAM GİDER"), kpi2X + 3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(225, 29, 72);
  doc.text(formatPdfCurrency(totalExpense, symbol), kpi2X + 3, y + 15);

  // KPI 3: Ödenen Borç & Taksitler
  const kpi3X = kpi2X + cardWidth + 3;
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(kpi3X, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(kpi3X, y, cardWidth, cardHeight, 2, 2, "S");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(67, 56, 202);
  doc.text(safePdfText("ÖDENEN BORÇ/TAKSİT"), kpi3X + 3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229);
  doc.text(formatPdfCurrency(totalPaidDebtsAndInstallments, symbol), kpi3X + 3, y + 15);

  // KPI 4: Net Kalan Rezerv
  const kpi4X = kpi3X + cardWidth + 3;
  const isPos = netBalance >= 0;
  doc.setFillColor(isPos ? 236 : 254, isPos ? 253 : 242, isPos ? 245 : 242);
  doc.roundedRect(kpi4X, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(isPos ? 167 : 254, isPos ? 243 : 205, isPos ? 208 : 211);
  doc.roundedRect(kpi4X, y, cardWidth, cardHeight, 2, 2, "S");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(isPos ? 4 : 190, isPos ? 120 : 18, isPos ? 87 : 60);
  doc.text(safePdfText(`NET REZERV (%${savingsRate.toFixed(1)})`), kpi4X + 3, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(isPos ? 5 : 225, isPos ? 150 : 29, isPos ? 105 : 72);
  doc.text(formatPdfCurrency(netBalance, symbol), kpi4X + 3, y + 15);

  // SECTION 2: GELİR VE GİDER HAREKETLERİ TABLOSU
  y += cardHeight + 8;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(safePdfText(`2. GELİR VE GİDER İŞLEMLERİ DETAY TABLOSU`), margin, y);

  y += 4;
  const tableHeaderHeight = 6.5;
  const rowHeight = 6;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, "S");

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(safePdfText("Açıklama"), margin + 3, y + 4.5);
  doc.text(safePdfText("Kategori"), margin + 63, y + 4.5);
  doc.text(safePdfText("Tarih"), margin + 103, y + 4.5);
  doc.text(safePdfText("Tür"), margin + 131, y + 4.5);
  doc.text(safePdfText("Tutar"), margin + contentWidth - 3, y + 4.5, { align: "right" });

  y += tableHeaderHeight;
  const combinedItems = [
    ...monthIncomes.map((i) => ({ desc: i.name, cat: "Gelir", date: i.date, type: "GELİR", amount: i.amount })),
    ...monthExpenses.map((e) => ({ desc: e.name, cat: e.category, date: e.date, type: "GİDER", amount: e.amount }))
  ].slice(0, 14);

  if (combinedItems.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentWidth, rowHeight, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, rowHeight, "S");
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(safePdfText("Bu ay için kayıtlı gelir veya harcama bulunmamaktadır."), margin + 3, y + 4.2);
    y += rowHeight;
  } else {
    combinedItems.forEach((item, idx) => {
      const isInc = item.type === "GELİR";
      doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowHeight, "S");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(safePdfText(item.desc.substring(0, 32)), margin + 3, y + 4.2);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(safePdfText(item.cat.substring(0, 20)), margin + 63, y + 4.2);
      doc.text(safePdfText(item.date), margin + 103, y + 4.2);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(isInc ? 21 : 190, isInc ? 128 : 18, isInc ? 61 : 60);
      doc.text(safePdfText(item.type), margin + 131, y + 4.2);
      doc.text(`${isInc ? "+" : "-"}${formatPdfCurrency(item.amount, symbol)}`, margin + contentWidth - 3, y + 4.2, { align: "right" });

      y += rowHeight;
    });
  }

  // SECTION 3: BORÇ VE TAKSİT TABLOSU
  y += 6;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(safePdfText(`3. BORÇ VE TAKSİT ÖDEMELERİ TABLOSU`), margin, y);

  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, "S");

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(safePdfText("Borç / Taksit Adı"), margin + 3, y + 4.5);
  doc.text(safePdfText("Tür"), margin + 63, y + 4.5);
  doc.text(safePdfText("Vade"), margin + 103, y + 4.5);
  doc.text(safePdfText("Durum"), margin + 131, y + 4.5);
  doc.text(safePdfText("Tutar / Ödenen"), margin + contentWidth - 3, y + 4.5, { align: "right" });

  y += tableHeaderHeight;
  const debtsToRender = monthDebtsList.slice(0, 10);
  if (debtsToRender.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentWidth, rowHeight, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, rowHeight, "S");
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(safePdfText("Bu ay için vadesi gelen veya ödenen borç/taksit bulunmamaktadır."), margin + 3, y + 4.2);
    y += rowHeight;
  } else {
    debtsToRender.forEach((d, idx) => {
      const isPaid = d.remaining <= 0;
      doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowHeight, "S");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(safePdfText(d.name.substring(0, 32)), margin + 3, y + 4.2);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(safePdfText(d.type), margin + 63, y + 4.2);
      doc.text(safePdfText(d.dueDate), margin + 103, y + 4.2);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(isPaid ? 21 : 217, isPaid ? 128 : 119, isPaid ? 61 : 6);
      doc.text(safePdfText(d.status), margin + 131, y + 4.2);
      doc.text(`${formatPdfCurrency(d.amount, symbol)} (Öd: ${formatPdfCurrency(d.paid, symbol)})`, margin + contentWidth - 3, y + 4.2, { align: "right" });

      y += rowHeight;
    });
  }

  // FINANSAL ANALIZ VE AKILLI RAPOR NOTU
  y += 6;
  if (y < 255) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(safePdfText(`Finansal Sağlık & Bütçe Disiplini Notu:`), margin + 4, y + 6);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    let summaryNote = "";
    if (netBalance >= 0) {
      summaryNote = `${periodName} doneminde toplam ${formatPdfCurrency(totalIncome, symbol)} gelire karsilik ${formatPdfCurrency(totalExpense, symbol)} harcama ve ${formatPdfCurrency(totalPaidDebtsAndInstallments, symbol)} borc odemesi gerceklestirilmis olup %${savingsRate.toFixed(1)} net tasarruf saglanmistir. Finansal surdurulebilirlik cok basarilidir.`;
    } else {
      summaryNote = `${periodName} doneminde harcamalar ve borc odemeleri toplam geliri ${formatPdfCurrency(Math.abs(netBalance), symbol)} asmis bulunmaktadir. Gelecek ay icin acil olmayan harcamalarin kisilmasi tavsiye edilir.`;
    }
    const splitNote = doc.splitTextToSize(safePdfText(summaryNote), contentWidth - 8);
    doc.text(splitNote, margin + 4, y + 12);
  }

  // Footer
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(safePdfText("Bütçem Pro • Resmi Onaylı Aylık Finansal Denetim ve Bütçe Raporu"), margin, pageHeight - 8);

  try {
    await savePdfDocument(doc, fileName);
  } catch (err) {
    console.warn("[monthlyPdfReport] savePdfDocument error:", err);
  }

  return { success: true, fileName, doc };
}

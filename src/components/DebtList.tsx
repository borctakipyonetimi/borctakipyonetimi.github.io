/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlusCircle, Printer, FileText, CheckCircle2, Circle, AlertCircle, Edit, Trash2, Calendar, ClipboardList, ArrowUpDown, Sparkles, Camera, X, BellRing } from "lucide-react";
import { Debt, InstallmentDebt, Expense } from "../types";
import { useCurrency } from "../utils/CurrencyContext";
import { DoughnutChart, BarChart } from "./BudgetCharts";
import { AdMobBanner } from "./AdMobBanner";
import ReceiptScanner from "./ReceiptScanner";
import { DebtTimelineChart } from "./DebtTimelineChart";
import { jsPDF } from "jspdf";
import { t } from "../utils/translations";

import { PeriodFilter } from "./PeriodFilter";

interface DebtListProps {
  debts: Debt[];
  expenses?: Expense[];
  totalIncome?: number;
  onSaveDebt: (debt: Partial<Debt>, createAlarm?: boolean) => void;
  onDeleteDebt: (id: number) => void;
  onToggleDebtPaid: (id: number) => void;
  onAddAlarm: (title: string, date: string) => void;
  themeColor: string;
  onSaveInstallment?: (installment: Partial<InstallmentDebt>) => void;
  installmentDebts?: InstallmentDebt[];
  isPremium?: boolean;
  onUpgradeClick?: () => void;

  // Selected period control props
  selectedMonth: number | null;
  selectedYear: number | null;
  setSelectedMonth: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedYear: React.Dispatch<React.SetStateAction<number | null>>;
  stats?: any;
  language?: "tr" | "en";
  focusedDebtId?: number | null;
  setFocusedDebtId?: (id: number | null) => void;
}

export const DebtList: React.FC<DebtListProps> = ({
  debts,
  expenses = [],
  totalIncome = 0,
  onSaveDebt,
  onDeleteDebt,
  onToggleDebtPaid,
  onAddAlarm,
  themeColor,
  onSaveInstallment,
  installmentDebts = [],
  isPremium = false,
  onUpgradeClick,
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
  stats,
  language = "tr",
  focusedDebtId,
  setFocusedDebtId,
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const { format, currencySymbol } = useCurrency();
  const [activeTab, setActiveTab] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [sortBy, setSortBy] = useState<"none" | "amount_desc" | "amount_asc" | "due_date_asc" | "due_date_desc">("none");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortBy]);
  
  // Edit & Add Dialog states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Yeni Borç Ekle");

  useEffect(() => {
    if (localStorage.getItem("auto_open_add_debt") === "true") {
      localStorage.removeItem("auto_open_add_debt");
      handleOpenAdd();
    }
  }, []);
  const [debtId, setDebtId] = useState<number | undefined>(undefined);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [category, setCategory] = useState("Diğer");
  const [dueDate, setDueDate] = useState("");
  const [createAlarm, setCreateAlarm] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("12");
  
  // Print & Report preview modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // AI OCR scanner state and callback
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const handleScanCompleted = (result: any) => {
    setName(result.title);
    setAmount(result.amount.toString());
    setPaid("0");
    if (result.date) {
      setDueDate(result.date);
    }
    // Suggest category
    if (result.categorySuggestion) {
      const suggested = result.categorySuggestion.toLowerCase();
      const match = ["Kredi Kartı", "Konut", "Araç", "Sağlık", "Eğitim", "Diğer"].find(
        (c) =>
          c.toLowerCase().includes(suggested) ||
          suggested.includes(c.toLowerCase())
      );
      if (match) {
        setCategory(match);
      } else {
        setCategory("Diğer");
      }
    }
    setIsScannerOpen(false);
    setIsModalOpen(true);
  };

  const categories = ["Kredi Kartı", "Konut", "Araç", "Sağlık", "Eğitim", "Diğer"];

  // Choose recommended strategy based on financial parameters
  // Combine both simple debts and remaining installments to ensure all outstanding obligations are computed
  const activeUnpaidSingleDebts = debts.filter(d => d.paid < d.amount);
  const activeUnpaidInstallmentDebts = installmentDebts.filter(
    inst => inst.paidInstallmentCount < inst.installmentCount
  );

  const unifiedUnpaidDebts = [
    ...activeUnpaidSingleDebts.map(d => ({
      id: d.id,
      name: d.name,
      type: "direct" as const,
      remaining: d.amount - d.paid,
      total: d.amount,
      paid: d.paid
    })),
    ...activeUnpaidInstallmentDebts.map(inst => {
      const monthly = inst.totalAmount / inst.installmentCount;
      return {
        id: inst.id,
        name: `${inst.name} (Bu Ayki Taksit)`,
        type: "installment" as const,
        remaining: monthly,
        total: monthly,
        paid: 0
      };
    })
  ];

  const totalRemainingDebt = unifiedUnpaidDebts.reduce((sum, ud) => sum + ud.remaining, 0);
  const incomeVal = totalIncome || 0;
  
  const debtToIncomeRatio = incomeVal > 0 ? totalRemainingDebt / incomeVal : 0;
  const hasSmallDebts = unifiedUnpaidDebts.some(ud => ud.remaining < 2000);
  const recommendedStrategy = (debtToIncomeRatio > 3 || !hasSmallDebts) ? "avalanche" : "snowball";

  const [activeStrategyView, setActiveStrategyView] = useState<"snowball" | "avalanche" | null>(null);
  const currentStrategyView = activeStrategyView || recommendedStrategy;

  const smallestDebt = unifiedUnpaidDebts.length > 0 
    ? [...unifiedUnpaidDebts].sort((a,b) => a.remaining - b.remaining)[0] 
    : null;
  const largestDebt = unifiedUnpaidDebts.length > 0
    ? [...unifiedUnpaidDebts].sort((a,b) => b.remaining - a.remaining)[0]
    : null;

  const filteredDebts = [...debts]
    .filter((d) => {
      // 1. Tab filter
      if (activeTab === "unpaid" && d.paid >= d.amount) return false;
      if (activeTab === "paid" && d.paid < d.amount) return false;

      // 2. Period filter
      if (selectedMonth !== null && selectedYear !== null) {
        if (!d.dueDate) return true;
        try {
          const dDate = new Date(d.dueDate);
          const dMonth = dDate.getMonth();
          const dYear = dDate.getFullYear();
          
          if (dMonth === selectedMonth && dYear === selectedYear) {
            return true;
          }
          
          const selectedTime = selectedYear * 12 + selectedMonth;
          const dueTime = dYear * 12 + dMonth;
          const isUnpaid = d.paid < d.amount;
          return selectedTime > dueTime && isUnpaid;
        } catch {
          return true;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "amount_desc") {
        return b.amount - a.amount;
      }
      if (sortBy === "amount_asc") {
        return a.amount - b.amount;
      }
      if (sortBy === "due_date_asc") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "due_date_desc") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      }
      return 0;
    });

  // Helpers for formatting numbers with dots (e.g., 100.000.000)
  const formatNumberWithDots = (val: string): string => {
    // Strip everything except digits
    const cleaned = val.replace(/\D/g, "");
    if (!cleaned) return "";
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumberFromDots = (val: string): number => {
    const cleaned = val.replace(/\./g, "");
    return parseFloat(cleaned) || 0;
  };

  // Selected period calculations
  const selectedYearVal = selectedYear !== null ? selectedYear : new Date().getFullYear();
  const selectedMonthVal = selectedMonth !== null ? selectedMonth : new Date().getMonth();

  const debtsInPeriod = debts.filter((d) => {
    if (selectedMonth === null || selectedYear === null) return true;
    if (!d.dueDate) return true;
    try {
      const dDate = new Date(d.dueDate);
      return dDate.getMonth() === selectedMonth && dDate.getFullYear() === selectedYear;
    } catch { return true; }
  });

  const installmentsInPeriod = installmentDebts.map((inst) => {
    const perMonth = inst.totalAmount / (inst.installmentCount || 1);
    if (selectedMonth === null || selectedYear === null) {
      return {
        due: inst.totalAmount,
        paid: inst.paidInstallmentCount * perMonth,
      };
    }
    const startDate = new Date(inst.firstDueDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const monthDiffCalc = (selectedYear - startYear) * 12 + (selectedMonth - startMonth);
    const isCurrentlyActive = monthDiffCalc >= 0 && monthDiffCalc < inst.installmentCount;
    const isCurrentlyPaid = inst.paidInstallmentCount > monthDiffCalc;
    return {
      due: isCurrentlyActive ? perMonth : 0,
      paid: (isCurrentlyActive && isCurrentlyPaid) ? perMonth : 0,
    };
  });

  // Monthly filtered stats (used as fallback or extra if needed)
  const totalAmount = debtsInPeriod.reduce((sum, d) => sum + d.amount, 0) + 
    installmentsInPeriod.reduce((sum, item) => sum + item.due, 0);

  const totalPaid = debtsInPeriod.reduce((sum, d) => sum + d.paid, 0) + 
    installmentsInPeriod.reduce((sum, item) => sum + item.paid, 0);

  const totalRemaining = totalAmount - totalPaid;

  // True lifetime overall aggregates (un-filtered by period, representing actual total debt burden including contact-based payables)
  const currentUserLocal = localStorage.getItem("currentUser") || "anonymous";
  const spaceKeyLocal = currentUserLocal !== "anonymous" ? `user_${currentUserLocal}` : "user_anonymous";
  const savedContactTxsStrLocal = localStorage.getItem(`${spaceKeyLocal}_contacts_transactions`);
  let contactPayablesTotalLocal = 0;
  let contactPayablesPaidLocal = 0;
  if (savedContactTxsStrLocal) {
    try {
      const txs = JSON.parse(savedContactTxsStrLocal);
      if (Array.isArray(txs)) {
        txs.forEach((t: any) => {
          if (t.type === "payable") {
            const amt = Number(t.amount) || 0;
            contactPayablesTotalLocal += amt;
            if (t.isPaid) {
              contactPayablesPaidLocal += amt;
            }
          }
        });
      }
    } catch (e) {
      console.error("Error loading contact transactions in DebtList:", e);
    }
  }

  const allTimeTotalAmount = debts.reduce((sum, d) => sum + d.amount, 0) + 
    installmentDebts.reduce((sum, inst) => sum + inst.totalAmount, 0) +
    contactPayablesTotalLocal;

  const allTimeTotalPaid = debts.reduce((sum, d) => sum + d.paid, 0) + 
    installmentDebts.reduce((sum, inst) => sum + (inst.paidInstallmentCount * (inst.totalAmount / (inst.installmentCount || 1))), 0) +
    contactPayablesPaidLocal;

  const allTimeRemaining = allTimeTotalAmount - allTimeTotalPaid;

  const simpleDebtsDueThisMonth = debts.filter(d => {
    if (!d.dueDate) return d.paid < d.amount;
    try {
      const dDate = new Date(d.dueDate);
      const dMonth = dDate.getMonth();
      const dYear = dDate.getFullYear();
      
      const isUnpaid = d.paid < d.amount;
      const isDueThisMonth = dYear === selectedYearVal && dMonth === selectedMonthVal;
      
      const selectedTime = selectedYearVal * 12 + selectedMonthVal;
      const dueTime = dYear * 12 + dMonth;
      const isOverdue = selectedTime > dueTime && isUnpaid;
      
      return isDueThisMonth || isOverdue;
    } catch { return d.paid < d.amount; }
  });
  const simpleDueThisMonthAmount = simpleDebtsDueThisMonth.reduce((sum, d) => sum + (d.amount - d.paid), 0);

  const installmentsDueThisMonthAmount = installmentDebts.reduce((sum, inst) => {
    const startDate = new Date(inst.firstDueDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const monthDiff = (selectedYearVal - startYear) * 12 + (selectedMonthVal - startMonth);
    const isActiveThisMonth = monthDiff >= 0 && monthDiff < inst.installmentCount;
    const isPaidThisMonth = inst.paidInstallmentCount > monthDiff;
    if (isActiveThisMonth && !isPaidThisMonth) {
      return sum + (inst.totalAmount / inst.installmentCount);
    }
    return sum;
  }, 0);

  let periodContactPayablesRemainingLocal = 0;
  if (savedContactTxsStrLocal) {
    try {
      const txs = JSON.parse(savedContactTxsStrLocal);
      if (Array.isArray(txs)) {
        txs.forEach((t: any) => {
          if (t.type === "payable" && !t.isPaid) {
            const amt = Number(t.amount) || 0;
            if (selectedMonthVal === null || selectedYearVal === null) {
              periodContactPayablesRemainingLocal += amt;
            } else {
              if (t.dueDate) {
                try {
                  const dDate = new Date(t.dueDate);
                  const dMonth = dDate.getMonth();
                  const dYear = dDate.getFullYear();
                  if (dYear === selectedYearVal && dMonth === selectedMonthVal) {
                    periodContactPayablesRemainingLocal += amt;
                  } else {
                    const selectedTime = selectedYearVal * 12 + selectedMonthVal;
                    const dueTime = dYear * 12 + dMonth;
                    if (selectedTime > dueTime) {
                      periodContactPayablesRemainingLocal += amt;
                    }
                  }
                } catch {
                  periodContactPayablesRemainingLocal += amt;
                }
              } else {
                periodContactPayablesRemainingLocal += amt;
              }
            }
          }
        });
      }
    } catch {}
  }

  const dueThisMonthAmount = simpleDueThisMonthAmount + installmentsDueThisMonthAmount + periodContactPayablesRemainingLocal;

  const handleOpenAdd = () => {
    setModalTitle("Yeni Borç Ekle");
    setDebtId(undefined);
    setName("");
    setAmount("");
    setPaid("0");
    setCategory("Diğer");
    setDueDate("");
    setCreateAlarm(false);
    setIsInstallment(false);
    setInstallmentCount("12");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: Debt) => {
    setModalTitle("Borç Düzenle");
    setDebtId(d.id);
    setName(d.name);
    setAmount(formatNumberWithDots(d.amount.toString()));
    setPaid(formatNumberWithDots(d.paid.toString()));
    setCategory(d.category);
    setDueDate(d.dueDate || "");
    setCreateAlarm(false);
    setIsInstallment(false);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (focusedDebtId) {
      const d = debts.find((x) => x.id === focusedDebtId);
      if (d) {
        if (d.paid >= d.amount) {
          setActiveTab("paid");
        } else {
          setActiveTab("unpaid");
        }
        handleOpenEdit(d);
        setTimeout(() => {
          const el = document.getElementById(`debt-card-${focusedDebtId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-4", "ring-indigo-500", "scale-[1.03]");
            setTimeout(() => {
              el.classList.remove("ring-4", "ring-indigo-500", "scale-[1.03]");
            }, 3000);
          }
        }, 400);
      }
      if (setFocusedDebtId) {
        setFocusedDebtId(null);
      }
    }
  }, [focusedDebtId, debts, setFocusedDebtId]);

  const handleSave = () => {
    const parsedAmount = parseNumberFromDots(amount);
    const parsedPaid = parseNumberFromDots(paid);

    if (!name.trim()) {
      alert("Lütfen geçerli bir borç adı giriniz.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Lütfen sıfırdan büyük bir borç tutarı giriniz.");
      return;
    }
    if (parsedPaid > parsedAmount) {
      alert("Ödenen tutar, toplam borç tutarından büyük olamaz.");
      return;
    }

    if (isInstallment && debtId === undefined) {
      const count = parseInt(installmentCount) || 12;
      if (count <= 0) {
        alert("Lütfen geçerli bir taksit sayısı giriniz (en az 1).");
        return;
      }
      const perMonth = parsedAmount / count;
      const paidCount = Math.min(count, Math.round(parsedPaid / perMonth));

      if (onSaveInstallment) {
        onSaveInstallment({
          name: name.trim(),
          totalAmount: parsedAmount,
          installmentCount: count,
          paidInstallmentCount: paidCount,
          firstDueDate: dueDate || new Date().toISOString().slice(0, 10),
        });
      }
    } else {
      if (createAlarm && !dueDate) {
        alert("Klasik alarm kurulabilmesi için lütfen geçerli bir Vade Tarihi seçiniz.");
        return;
      }
      onSaveDebt({
        id: debtId,
        name: name.trim(),
        amount: parsedAmount,
        paid: parsedPaid,
        category,
        dueDate,
      }, createAlarm);
    }

    setIsModalOpen(false);
  };

  // Plain HTML Print & PDF trigger functions
  const handlePrint = (isPdf = false) => {
    // Bypassed premium block so everyone can use PDF exports
    const filtered = filteredDebts;
    if (filtered.length === 0) {
      alert("Yazdırılacak borç kaydı bulunamadı.");
      return;
    }

    if (isPdf) {
      const doc = new jsPDF();
      
      // Let's safe-convert turkish strings for standard PDF compatibility
      const safeText = (text: string) => {
        if (!text) return "";
        const map: { [key: string]: string } = {
          'ç': 'c', 'Ç': 'C',
          'ğ': 'g', 'Ğ': 'G',
          'ı': 'i', 'İ': 'I',
          'ö': 'o', 'Ö': 'O',
          'ş': 's', 'Ş': 'S',
          'ü': 'u', 'Ü': 'U'
        };
        return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, (match) => map[match] || match);
      };

      // Header Banner Box
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(0, 0, 210, 32, "F");

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Butcem Pro - Borc Durum Raporu", 15, 18);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(226, 232, 240);
      const activeText = activeTab === "unpaid" ? "Odenmemis" : activeTab === "paid" ? "Odenmis" : "Tumu";
      doc.text(`Tarih: ${new Date().toLocaleDateString("tr-TR")} | Borc Grubu: ${safeText(activeText)}`, 15, 26);

      // Section
      doc.setFontSize(11);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(safeText("Borç Detayları Listesi"), 15, 45);

      // Draw horizontal line
      doc.setDrawColor(226, 232, 240);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.5);
      doc.line(15, 48, 195, 48);

      let yPos = 56;

      // Table Header row
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(15, yPos - 5, 180, 8, "F");

      doc.setFontSize(9);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(safeText("Borç Adı"), 18, yPos);
      doc.text(safeText("Kategori"), 70, yPos);
      doc.text(safeText("Son Ödeme"), 105, yPos);
      doc.text(safeText("Tutar"), 140, yPos);
      doc.text(safeText("Ödenen"), 165, yPos);

      // Separator
      doc.setDrawColor(226, 232, 240);
      doc.line(15, yPos + 4, 195, yPos + 4);
      yPos += 10;

      // Row elements
      filtered.forEach((d) => {
        // Page break if we reach the end
        if (yPos > 270) {
          doc.addPage();
          yPos = 25;
          // Redraw table headers on new page
          doc.setFillColor(241, 245, 249);
          doc.rect(15, yPos - 5, 180, 8, "F");
          doc.setFont("Helvetica", "bold");
          doc.text(safeText("Borç Adı"), 18, yPos);
          doc.text(safeText("Kategori"), 70, yPos);
          doc.text(safeText("Son Ödeme"), 105, yPos);
          doc.text(safeText("Tutar"), 140, yPos);
          doc.text(safeText("Ödenen"), 165, yPos);
          doc.line(15, yPos + 4, 195, yPos + 4);
          yPos += 10;
        }

        doc.setFont("Helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        doc.text(safeText(d.name), 18, yPos);
        doc.text(safeText(d.category), 70, yPos);
        doc.text(safeText(d.dueDate || "Belirtilmemis"), 105, yPos);
        doc.text(format(d.amount), 140, yPos);
        doc.text(format(d.paid), 165, yPos);

        // Underline row
        doc.setDrawColor(241, 245, 249);
        doc.line(15, yPos + 3, 195, yPos + 3);
        yPos += 8;
      });

      // Totals Box
      if (yPos > 250) {
        doc.addPage();
        yPos = 25;
      }

      yPos += 5;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(15, yPos - 4, 180, 22, "F");
      doc.setFont("Helvetica", "bold");
      doc.setDrawColor(203, 213, 225);
      doc.rect(15, yPos - 4, 180, 22, "S");

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const totalAmount = filtered.reduce((s, d) => s + d.amount, 0);
      const totalPaid = filtered.reduce((s, d) => s + d.paid, 0);
      const totalRemaining = totalAmount - totalPaid;

      doc.text(safeText("TOPLAM BORÇ:"), 18, yPos + 2);
      doc.text(format(totalAmount), 50, yPos + 2);

      doc.text(safeText("TOPLAM ÖDENEN:"), 18, yPos + 9);
      doc.text(format(totalPaid), 50, yPos + 9);

      doc.text(safeText("KALAN ÖDENECEK BORÇ:"), 105, yPos + 5);
      doc.setFontSize(11);
      doc.setTextColor(220, 38, 38); // red-600
      doc.text(format(totalRemaining), 105, yPos + 12);

      // Footnote
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(safeText("Butcem Pro Akıllı Finans Yonetim Sistemi | v5.0 Ultimate"), 15, 285);

      // --- PAGE 2: TAKSITLI ALISVERISLER VE KREDILER ---
      doc.addPage();
      
      // Header Banner Box (Slate Accent)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Butcem Pro - Taksitli Alisverisler ve Krediler", 15, 15);
      
      doc.setFontSize(10);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      
      let periodStr = selectedMonth !== null && selectedYear !== null 
        ? `${selectedMonth + 1} / ${selectedYear}` 
        : "Tum Zamanlar (Filtresiz)";
      doc.text(safeText(`Secilen Donem Taksit Detaylari (${periodStr})`), 15, 38);
      
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.5);
      doc.line(15, 41, 195, 41);
      
      let tYPos = 49;
      
      // Headers
      doc.setFillColor(241, 245, 249);
      doc.rect(15, tYPos - 5, 180, 8, "F");
      doc.setFontSize(9);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(safeText("Taksit / Kredi Adı"), 18, tYPos);
      doc.text(safeText("Baslangic"), 75, tYPos);
      doc.text(safeText("Taksit Durumu"), 105, tYPos);
      doc.text(safeText("Aylik Taksit"), 140, tYPos);
      doc.text(safeText("Toplam Tutar"), 165, tYPos);
      
      doc.setDrawColor(226, 232, 240);
      doc.line(15, tYPos + 4, 195, tYPos + 4);
      tYPos += 10;
      
      // Get active list
      let instList: any[] = [];
      if (selectedMonth !== null && selectedYear !== null) {
        instList = installmentDebts.map((inst) => {
          const startDate = new Date(inst.firstDueDate || "");
          const startYear = startDate.getFullYear();
          const startMonth = startDate.getMonth();
          const monthDiff = (selectedYear - startYear) * 12 + (selectedMonth - startMonth);
          const isActive = monthDiff >= 0 && monthDiff < inst.installmentCount;
          const isPaid = inst.paidInstallmentCount > monthDiff;
          const installmentNoStr = isActive ? `${monthDiff + 1} / ${inst.installmentCount}` : "Pasif/Bitti";
          const paymentThisMonth = isActive ? (inst.totalAmount / (inst.installmentCount || 1)) : 0;
          return {
            ...inst,
            isActive,
            isPaid,
            installmentNoStr,
            paymentThisMonth
          };
        }).filter(item => item.isActive);
      } else {
        // All installments
        instList = installmentDebts.map((inst) => {
          return {
            ...inst,
            isActive: true,
            isPaid: inst.paidInstallmentCount >= inst.installmentCount,
            installmentNoStr: `${inst.paidInstallmentCount} / ${inst.installmentCount}`,
            paymentThisMonth: inst.totalAmount / (inst.installmentCount || 1)
          };
        });
      }
      
      if (instList.length === 0) {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(safeText("Bu doneme ait aktif taksitli harcama veya taksitli kredi bulunmuyor."), 18, tYPos + 5);
        tYPos += 15;
      } else {
        instList.forEach((inst) => {
          if (tYPos > 260) {
            doc.addPage();
            tYPos = 25;
            // Redraw header
            doc.setFillColor(241, 245, 249);
            doc.rect(15, tYPos - 5, 180, 8, "F");
            doc.setFont("Helvetica", "bold");
            doc.text(safeText("Taksit / Kredi Adı"), 18, tYPos);
            doc.text(safeText("Baslangic"), 75, tYPos);
            doc.text(safeText("Taksit Durumu"), 105, tYPos);
            doc.text(safeText("Aylik Taksit"), 140, tYPos);
            doc.text(safeText("Toplam Tutar"), 165, tYPos);
            doc.line(15, tYPos + 4, 195, tYPos + 4);
            tYPos += 10;
          }
          
          doc.setFont("Helvetica", "normal");
          doc.setTextColor(30, 41, 59);
          doc.text(safeText(inst.name || "Taksit"), 18, tYPos);
          doc.text(safeText(inst.firstDueDate || "-"), 75, tYPos);
          
          const statusText = inst.isPaid ? "Odenmis" : `${inst.installmentNoStr}`;
          doc.text(safeText(statusText), 105, tYPos);
          
          const monthlyPay = inst.totalAmount / (inst.installmentCount || 1);
          doc.text(format(monthlyPay), 140, tYPos);
          doc.text(format(inst.totalAmount), 165, tYPos);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(15, tYPos + 3, 195, tYPos + 3);
          tYPos += 9;
        });
      }
      
      // Totals of active installments
      const totalInstallmentsSum = instList.reduce((sum, item) => sum + (item.paymentThisMonth || 0), 0);
      doc.setFillColor(248, 250, 252);
      doc.rect(15, tYPos, 180, 12, "F");
      doc.setDrawColor(203, 213, 225);
      doc.rect(15, tYPos, 180, 12, "S");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(safeText("SECILEN DONEM TOPLAM TAKSIT ODEMESI:"), 18, tYPos + 8);
      doc.text(format(totalInstallmentsSum), 140, tYPos + 8);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(safeText("Butcem Pro Akıllı Finans Yonetim Sistemi | v5.0 Ultimate"), 15, 285);

      // --- PAGE 3: DONEM GIDER DETAYLARI VE HARCAMALAR ---
      doc.addPage();
      
      // Header Banner Box (Amber/Charcoal Accent)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Butcem Pro - Harcamalar ve Donemsel Giderler", 15, 15);
      
      doc.setFontSize(10);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(safeText(`Secilen Donem Harcama ve Gider Raporu (${periodStr})`), 15, 38);
      
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.5);
      doc.line(15, 41, 195, 41);
      
      let eYPos = 49;
      
      // Headers
      doc.setFillColor(241, 245, 249);
      doc.rect(15, eYPos - 5, 180, 8, "F");
      doc.setFontSize(9);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(safeText("Gider Basligi"), 18, eYPos);
      doc.text(safeText("Gider Kategorisi"), 80, eYPos);
      doc.text(safeText("Harcama Tarihi"), 120, eYPos);
      doc.text(safeText("Tutar"), 165, eYPos);
      
      doc.setDrawColor(226, 232, 240);
      doc.line(15, eYPos + 4, 195, eYPos + 4);
      eYPos += 10;
      
      // Filter expenses
      let filteredExpensesList: any[] = [];
      if (selectedMonth !== null && selectedYear !== null) {
        filteredExpensesList = expenses.filter((e) => {
          if (!e.date) return false;
          try {
            const expDate = new Date(e.date);
            return expDate.getMonth() === selectedMonth && expDate.getFullYear() === selectedYear;
          } catch {
            return false;
          }
        });
      } else {
        filteredExpensesList = [...expenses];
      }
      
      if (filteredExpensesList.length === 0) {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(safeText("Bu doneme ait kayitli harcama veya bütce gideri bulunmuyor."), 18, eYPos + 5);
        eYPos += 15;
      } else {
        filteredExpensesList.forEach((exp) => {
          if (eYPos > 260) {
            doc.addPage();
            eYPos = 25;
            doc.setFillColor(241, 245, 249);
            doc.rect(15, eYPos - 5, 180, 8, "F");
            doc.setFont("Helvetica", "bold");
            doc.text(safeText("Gider Basligi"), 18, eYPos);
            doc.text(safeText("Gider Kategorisi"), 80, eYPos);
            doc.text(safeText("Harcama Tarihi"), 120, eYPos);
            doc.text(safeText("Tutar"), 165, eYPos);
            doc.line(15, eYPos + 4, 195, eYPos + 4);
            eYPos += 10;
          }
          
          doc.setFont("Helvetica", "normal");
          doc.setTextColor(30, 41, 59);
          doc.text(safeText(exp.title || exp.description || "Gider"), 18, eYPos);
          doc.text(safeText(exp.category || "Genel"), 80, eYPos);
          doc.text(safeText(exp.date || "-"), 120, eYPos);
          doc.text(format(exp.amount), 165, eYPos);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(15, eYPos + 3, 195, eYPos + 3);
          eYPos += 9;
        });
      }
      
      // Totals of filtered expenses
      const totalExpensesSum = filteredExpensesList.reduce((sum, item) => sum + (item.amount || 0), 0);
      doc.setFillColor(248, 250, 252);
      doc.rect(15, eYPos, 180, 12, "F");
      doc.setDrawColor(203, 213, 225);
      doc.rect(15, eYPos, 180, 12, "S");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(safeText("SECILEN DONEM TOPLAM KAYITLI GIDER TUTARI:"), 18, eYPos + 8);
      doc.text(format(totalExpensesSum), 140, eYPos + 8);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(safeText("Butcem Pro Akıllı Finans Yonetim Sistemi | v5.0 Ultimate"), 15, 285);

      doc.save("Butcem_Pro_Borc_Raporu.pdf");
      return;
    }

    const html = `
      <div style="font-family: sans-serif; padding: 25px; color: #1e293b; background: white;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px;">
          <div>
            <h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">BÜTÇEM PRO</h2>
            <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Akıllı Bireysel Bütçe ve Borç Yönetim Sistemi</p>
          </div>
          <div style="text-align: right;">
            <h3 style="margin: 0; font-size: 14px; color: #0f172a;">Borç Durum Raporu</h3>
            <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">Tarih: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR")}</p>
          </div>
        </div>
        
        <p style="font-size: 13px; color: #475569; margin-bottom: 15px;">
          <strong>Rapor Tipi:</strong> ${activeTab === "unpaid" ? "Ödenmemiş Borçlar" : activeTab === "paid" ? "Ödenmiş Borçlar" : "Tüm Borçlar"}
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr>
              <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; background: #f1f5f9; font-weight: bold; color: #334155;">Borç Adı</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; background: #f1f5f9; font-weight: bold; color: #334155;">Kategori</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; background: #f1f5f9; font-weight: bold; color: #334155;">Son Ödeme</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; font-size: 12px; background: #f1f5f9; font-weight: bold; color: #334155;">Toplam Tutar</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; font-size: 12px; background: #f1f5f9; font-weight: bold; color: #334155;">Ödenen Tutar</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; font-size: 12px; background: #f1f5f9; font-weight: bold; color: #334155;">Kalan Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(
                (d) => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; color: #1e293b;">${d.name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; color: #475569;">${d.category}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; color: #475569;">${d.dueDate || "Belirtilmemiş"}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; text-align: right; color: #1e293b; font-weight: 500;">${format(d.amount)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; text-align: right; color: #16a34a; font-weight: 500;">${format(d.paid)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; text-align: right; color: ${d.amount - d.paid > 0 ? '#dc2626' : '#1e293b'}; font-weight: bold;">${format(d.amount - d.paid)}</td>
              </tr>
            `
              )
              .join("")}
            <tr style="font-weight: bold; background: #f8fafc;">
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 12px; color: #0f172a;">GENEL TOPLAM</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 12px; text-align: right; color: #0f172a;">${format(filtered.reduce((s, d) => s + d.amount, 0))}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 12px; text-align: right; color: #16a34a;">${format(filtered.reduce((s, d) => s + d.paid, 0))}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 12px; text-align: right; color: #dc2626; font-weight: 900;">${format(filtered.reduce((s, d) => s + (d.amount - d.paid), 0))}</td>
            </tr>
          </tbody>
        </table>
        
        <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 600;">
          Bütçem Pro Bireysel Finans ve Borç Yönetim Platformu | Güvenli & Şifreli Yerel Defter
        </div>
      </div>
    `;

    // Direct DOM printing overlay to bypass iframe restrictions in any sandboxed webview environment completely
    const printContainer = document.createElement("div");
    printContainer.id = "print-container-temp";
    printContainer.style.position = "absolute";
    printContainer.style.left = "0";
    printContainer.style.top = "0";
    printContainer.style.width = "100%";
    printContainer.style.backgroundColor = "white";
    printContainer.style.color = "black";
    printContainer.style.zIndex = "9999999";
    printContainer.innerHTML = html;
    document.body.appendChild(printContainer);

    const printStyle = document.createElement("style");
    printStyle.id = "print-style-temp";
    printStyle.innerHTML = `
      @media print {
        body {
          background-color: white !important;
          color: black !important;
        }
        body > *:not(#print-container-temp) {
          display: none !important;
        }
        #print-container-temp, #print-container-temp * {
          visibility: visible !important;
        }
      }
    `;
    document.head.appendChild(printStyle);

    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error("Yazdırma işlemi sırasında hata oluştu:", err);
      }
      setTimeout(() => {
        printContainer.remove();
        printStyle.remove();
      }, 1000);
    }, 150);
  };

  return (
    <div className="space-y-4">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <ClipboardList className="w-7 h-7 text-indigo-500 animate-pulse" /> BORÇ LİSTESİ
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      <PeriodFilter
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        setSelectedMonth={setSelectedMonth}
        setSelectedYear={setSelectedYear}
        themeColor="blue"
      />

      {/* Mini Stats and Title Button Bar */}
      <div className="flex flex-col gap-3 justify-center sm:flex-row sm:items-center">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (!isPremium) {
                onUpgradeClick?.();
              } else {
                setIsPrintModalOpen(true);
              }
            }}
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-slate-50 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Yazdır {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-sm font-black">PRO</span>}
          </button>
          <button
            onClick={() => {
              if (!isPremium) {
                onUpgradeClick?.();
              } else {
                handlePrint(true);
              }
            }}
            className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-600 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> PDF Al {!isPremium && <span className="ml-1 text-[8px] bg-slate-900 text-slate-100 dark:bg-amber-500 dark:text-slate-950 px-1.5 py-0.5 rounded-sm font-black">PRO</span>}
          </button>
          <button
            onClick={() => {
              if (!isPremium) {
                onUpgradeClick?.();
              } else {
                setIsScannerOpen(true);
              }
            }}
            className="px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-600/20 transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" /> Fatura Tara (AI) {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-sm font-black">PRO</span>}
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Ekle
          </button>
        </div>
      </div>

      {/* Top Level Key Debt Aggregates Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-gradient-to-br from-indigo-500/5 to-indigo-600/[0.02] dark:from-indigo-500/10 dark:to-transparent rounded-2xl border border-indigo-100/40 dark:border-indigo-900/30 shadow-xs relative overflow-hidden">
          <div className="absolute right-3.5 top-3.5 p-1 bg-indigo-500/10 text-indigo-500 rounded-lg">
            <ClipboardList className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest block">GENEL LİMİT TOPLAMI</span>
          <span className="text-base sm:text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">{format(stats?.totalDebt ?? allTimeTotalAmount)}</span>
          <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Tüm aktif & taksitli genel borçlar</span>
        </div>

        <div className="p-4 bg-gradient-to-br from-amber-500/5 to-amber-600/[0.02] dark:from-amber-500/10 dark:to-transparent rounded-2xl border border-amber-100/40 dark:border-amber-900/30 shadow-xs relative overflow-hidden">
          <div className="absolute right-3.5 top-3.5 p-1 bg-amber-500/10 text-amber-500 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest block">BU AY ÖDENECEK</span>
          <span className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-550 mt-1 block">{format(stats?.thisMonthTotalBorc ?? dueThisMonthAmount)}</span>
          <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Bu ay vadesi gelen tüm taksit & borçlar</span>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-500/5 to-emerald-600/[0.02] dark:from-emerald-500/10 dark:to-transparent rounded-2xl border border-emerald-100/40 dark:border-emerald-950/30 shadow-xs relative overflow-hidden">
          <div className="absolute right-3.5 top-3.5 p-1 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">BU AY ÖDENEN</span>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">{format(stats !== undefined ? (stats.thisMonthTotalBorc - stats.thisMonthKalanBorc) : (allTimeTotalPaid))}</span>
          <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Seçili ay kapatılan borç/taksitler</span>
        </div>

        <div className="p-4 bg-gradient-to-br from-rose-500/5 to-rose-600/[0.02] dark:from-rose-500/10 dark:to-transparent rounded-2xl border border-rose-100/40 dark:border-rose-900/30 shadow-xs relative overflow-hidden">
          <div className="absolute right-3.5 top-3.5 p-1 bg-rose-500/10 text-rose-500 rounded-lg">
            <AlertCircle className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">BU AY KALAN BORÇ</span>
          <span className="text-base sm:text-lg font-black font-mono text-rose-600 dark:text-rose-455 mt-1 block">{format(stats?.thisMonthKalanBorc ?? dueThisMonthAmount)}</span>
          <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Bu ay ödenmesi gereken net bakiye</span>
        </div>
      </div>

      {/* Tabs list and sorting mechanism */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/80 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-200/40 dark:border-slate-700/60 shadow-sm">
        <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl flex-1">
          <button
            onClick={() => setActiveTab("unpaid")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "unpaid" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            🚨 ÖDENMEMİŞ
          </button>
          <button
            onClick={() => setActiveTab("paid")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "paid" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            🟢 ÖDENMİŞ
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "all" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            📂 HEPSİ
          </button>
        </div>

        <div className="flex items-center gap-2 px-2 shrink-0 self-stretch sm:self-center justify-between sm:justify-start">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-400 uppercase tracking-wider">SIRALA:</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <option value="none">Varsayılan</option>
            <option value="amount_desc">En Yüksek Tutar</option>
            <option value="amount_asc">En Düşük Tutar</option>
            <option value="due_date_asc">Vade Tarihi (En Yakın Önce)</option>
            <option value="due_date_desc">Vade Tarihi (En Uzak Önce)</option>
          </select>
        </div>
      </div>

      {/* Debt Cards Listing */}
      <div className="space-y-3">
        {filteredDebts.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-medium">
            Gösterilecek borç bulunmuyor.
          </div>
        ) : (
          (() => {
            const totalPages = Math.max(1, Math.ceil(filteredDebts.length / itemsPerPage));
            const activePage = Math.min(currentPage, totalPages);
            const startIndex = (activePage - 1) * itemsPerPage;
            const paginatedDebts = filteredDebts.slice(startIndex, startIndex + itemsPerPage);

            return (
              <>
                {paginatedDebts.map((d) => {
                  const isPaid = d.paid >= d.amount;
                  const percentage = Math.min(((d.paid / d.amount) * 100), 100);
                  const isOverdue = !isPaid && d.dueDate && (() => {
                    try {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const due = new Date(d.dueDate);
                      due.setHours(0, 0, 0, 0);
                      return due < today;
                    } catch { return false; }
                  })();
                  const isNearDue = !isPaid && d.dueDate && (() => {
                    try {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const due = new Date(d.dueDate);
                      due.setHours(0, 0, 0, 0);
                      const diffTime = due.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return diffDays <= 3; // 3 days or less, including overdue (negative)
                    } catch { return false; }
                  })();
                  return (
                    <motion.div
                      key={d.id}
                      id={`debt-card-${d.id}`}
                      layout
                      initial={{ opacity: 0, scale: 0.98, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      className={`p-4 bg-white dark:bg-slate-800 rounded-2xl border-l-[6px] border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors duration-300 relative ${
                        isPaid ? "border-l-emerald-500" : "border-l-rose-500"
                      }`}
                    >
                      {isNearDue && (
                        <div className="absolute top-2 right-2 flex items-center justify-center p-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 shadow-xs animate-bounce" title="Vadesine Az Kaldı veya Geçti! ⏰">
                          <span className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
                          <BellRing className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 animate-pulse" />
                        </div>
                      )}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center flex-wrap gap-2 text-slate-800 dark:text-slate-100">
                          <span className="font-bold text-sm">{d.name}</span>
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold rounded-full">
                            📁 {d.category}
                          </span>
                          {isOverdue && (
                            <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-[10px] font-black rounded-full border border-rose-500/30 flex items-center gap-1 animate-pulse shrink-0 uppercase tracking-tight">
                              ⚠️ Vadesi Geçmiş
                            </span>
                          )}
                          {d.dueDate && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                              <Calendar className="w-3 h-3" /> SKT: {new Date(d.dueDate).toLocaleDateString("tr-TR")}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Tutar: <span className="font-bold font-mono">{format(d.amount)}</span> | Ödenen: <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{format(d.paid)}</span> | Kalan: <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">{format(d.amount - d.paid)}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center">
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteDebt(d.id)}
                          className="p-2 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => onToggleDebtPaid(d.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 select-none cursor-pointer transition-all duration-300 ${
                            isPaid 
                              ? "bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/10" 
                              : "bg-indigo-600 text-white hover:bg-indigo-750 shadow-md shadow-indigo-600/10"
                          }`}
                        >
                          <AnimatePresence mode="wait">
                            {isPaid ? (
                              <motion.span
                                key="checked"
                                initial={{ scale: 0.4, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0.4 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                className="flex items-center justify-center"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              </motion.span>
                            ) : (
                              <motion.span
                                key="unchecked"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.8 }}
                                className="flex items-center justify-center"
                              >
                                <Circle className="w-4 h-4" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <span>{isPaid ? "Ödeme Geri Al" : "Ödendi Yap"}</span>
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center flex-wrap gap-1.5 pt-4 text-xs font-bold">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={activePage === 1}
                      className="px-3 py-2 border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-xs select-none"
                    >
                      ← Önceki
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-xl transition-all duration-150 flex items-center justify-center cursor-pointer shadow-xs ${
                            activePage === pageNum
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                              : "border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={activePage === totalPages}
                      className="px-3 py-2 border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-xs select-none"
                    >
                      Sonraki →
                    </button>
                  </div>
                )}
              </>
            );
          })()
        )}
      </div>

      {/* Taksitli Borç Planları - Hızlı Erişim Paneli */}
      <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" />
            <h3 className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-100 uppercase">
              📊 Aktif Taksitli Borç Planlarınız (Hızlı Erişim)
            </h3>
          </div>
          <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold rounded-full">
            {installmentDebts.length} Aktif Plan
          </span>
        </div>

        {installmentDebts.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold italic text-center py-2">
            Eklenmiş taksitli borç planı bulunmamaktadır. "Taksitli Borçlar" sekmesinden veya yukarıdaki borç ekleme penceresindeki taksit seçeneğinden yeni planlar oluşturabilirsiniz.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/50 pb-2 text-[10px] uppercase font-black tracking-wider text-slate-400">
                  <th className="py-2">Borç Planı</th>
                  <th className="py-2">Toplam Borç</th>
                  <th className="py-2">Ödenen Vade</th>
                  <th className="py-2">Aylık Taksit</th>
                  <th className="py-2">Kalan Ödeme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/30">
                {installmentDebts.map((inst) => {
                  const monthly = inst.totalAmount / inst.installmentCount;
                  const paidValue = inst.paidInstallmentCount * monthly;
                  const remainingValue = inst.totalAmount - paidValue;
                  const isCompleted = inst.paidInstallmentCount >= inst.installmentCount;

                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition duration-150">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                        {inst.name}
                        {isCompleted && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[8px] font-black rounded-lg">ÖDENDİ</span>
                        )}
                      </td>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-300 font-mono">{format(inst.totalAmount)}</td>
                      <td className="py-2.5 font-bold text-slate-600 dark:text-slate-400 font-sans">
                        {inst.paidInstallmentCount} / {inst.installmentCount} Ay
                      </td>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-300 font-mono">{format(monthly)}</td>
                      <td className="py-2.5 font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                        {isCompleted ? "₺0" : format(remainingValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Borç Kapama Stratejisi Öneri Kutusu */}
      <div id="debt_strategy_advisor" className="p-5 bg-gradient-to-br from-indigo-50/70 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-800/60 rounded-3xl border border-indigo-100/40 dark:border-indigo-900/40 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            <h3 className="text-xs font-black tracking-wider text-indigo-950 dark:text-indigo-200 uppercase">
              BORÇ KAPAMA REHBERİ VE STRATEJİSİ
            </h3>
          </div>
          <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-[10px] font-extrabold rounded-full flex items-center gap-1">
            Yük/Gelir Oranı: {debtToIncomeRatio.toFixed(1)}x
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
          Planlanan bu ayki toplam borç miktarınız (taksitli borçların tamamı yerine sadece bu ayki taksit tutarları dahil edilmiştir): <strong className="text-slate-800 dark:text-slate-100 font-black">{format(totalRemainingDebt)}</strong> ve aylık gelir kaynağınız <strong className="text-emerald-600 dark:text-emerald-400 font-black">{format(incomeVal)}</strong>. 
          Bu finansal verilere göre bütçeniz için en uygun borç kapatma stratejisi: <span className="text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-100/30 dark:border-indigo-900/30">{recommendedStrategy === "snowball" ? "Kartopu (Snowball) Yöntemi" : "Çığ (Avalanche) Yöntemi"}</span>.
        </p>

        {/* Strategy Selection Buttons */}
        <div className="flex bg-slate-200/50 dark:bg-slate-900/60 p-1 rounded-2xl gap-1">
          <button
            onClick={() => setActiveStrategyView("snowball")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all relative flex items-center justify-center gap-1.5 cursor-pointer ${
              currentStrategyView === "snowball" 
                ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            ❄️ Kartopu Yöntemi
            {recommendedStrategy === "snowball" && (
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping shrink-0" />
            )}
          </button>
          
          <button
            onClick={() => setActiveStrategyView("avalanche")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all relative flex items-center justify-center gap-1.5 cursor-pointer ${
              currentStrategyView === "avalanche" 
                ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            ⚡ Çığ Yöntemi
            {recommendedStrategy === "avalanche" && (
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping shrink-0" />
            )}
          </button>
        </div>

        {/* Explanation Card */}
        <div className="p-4 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-100/60 dark:border-slate-800 space-y-3 shadow-xs">
          {currentStrategyView === "snowball" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1 w-full justify-between">
                <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest block">PSİKOLOJİK MOTİVASYON ODAKLI</span>
                {recommendedStrategy === "snowball" && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[8px] font-black rounded-lg">BİZE GÖRE EN UYGUNU</span>}
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">❄️ Kartopu (Snowball) Yöntemi Nedir?</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Borçlarınızı faizlerinden bağımsız olarak <strong>bu ay ödenecek en küçük tutardan en büyüğe</strong> doğru sıralayıp en küçüğünü hemen kapatma üzerine kurulu psikolojik odaklı yöntemdir. Küçük borçları kapatmak size zafer hissi ve motivasyon kazandırarak büyük borçları öderken dirençli olmanızı sağlar.
              </p>
              {smallestDebt ? (
                <div className="p-3 bg-indigo-500/5 dark:bg-indigo-950/10 border-l-[3px] border-indigo-500 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 space-y-1">
                  <span className="font-black text-[10px] text-indigo-600 dark:text-indigo-400 block uppercase tracking-wide">BUGÜNKÜ AKSİYON ADAYINIZ:</span>
                  En küçük kalan bakiyeye sahip <strong className="text-indigo-600 dark:text-indigo-400 font-bold">"{smallestDebt.name}"</strong> (kalan toplam tutar: {format(smallestDebt.remaining)}) borç kaydını öncelikli kapatarak Kartopu etkisini hemen başlatabilirsiniz!
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">Planlanacak aktif ödenmemiş borç bulunmamaktadır.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1 w-full justify-between">
                <span className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest block">MATEMATİKSEL FAİZ OPTİMİZASYONU</span>
                {recommendedStrategy === "avalanche" && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[8px] font-black rounded-lg">BİZE GÖRE EN UYGUNU</span>}
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">⚡ Çığ (Avalanche) Yöntemi Nedir?</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Borçlarınızı <strong>bu ay ödenecek en yüksek tutara</strong> sahip olanından başlayarak kapatma üzerine kurulu rasyonel, matematiksel yöntemdir. Bütçe açısından en akılcı ve finansal maliyeti en çok düşüren yoldur.
              </p>
              {largestDebt ? (
                <div className="p-3 bg-amber-500/5 dark:bg-amber-950/10 border-l-[3px] border-amber-500 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 space-y-1">
                  <span className="font-black text-[10px] text-amber-600 dark:text-amber-400 block uppercase tracking-wide">BUGÜNKÜ AKSİYON ADAYINIZ:</span>
                  En büyük kalan bakiyeye sahip <strong className="text-amber-600 dark:text-amber-400 font-bold">"{largestDebt.name}"</strong> (kalan toplam tutar: {format(largestDebt.remaining)}) borç kaydına ekstra kaynak katarak Çığ etkisinden yararlanabilirsiniz!
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">Planlanacak aktif ödenmemiş borç bulunmamaktadır.</p>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Debt Decreasing Timeline representation built via D3 */}
        <DebtTimelineChart
          debts={debts}
          installmentDebts={installmentDebts}
          strategy={currentStrategyView}
          totalIncome={totalIncome}
        />
      </div>

      {/* Debt Add/Edit Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h4 className="text-base font-bold flex items-center gap-1.5 border-b pb-2 dark:border-slate-700">
              <AlertCircle className="w-5 h-5 text-indigo-500" /> {modalTitle}
            </h4>

            {/* Quick scanning action */}
            <button
              onClick={() => {
                if (!isPremium) {
                  onUpgradeClick?.();
                } else {
                  setIsModalOpen(false); // Close first to prevent backdrop overlap
                  setTimeout(() => setIsScannerOpen(true), 150);
                }
              }}
              className="w-full py-2 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-dashed border-indigo-500/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse animate-duration-1000" /> Fatura Fotoğrafı ile Otomatik Doldur {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black">PRO</span>}
            </button>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">BORÇ TANIMI</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kredi borcu, fatura vb."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">TOPLAM TUTAR</label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(formatNumberWithDots(e.target.value))}
                    placeholder="₺5.000"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">ŞİMDİ ÖDENEN (İsteğe bağlı)</label>
                  <input
                    type="text"
                    value={paid}
                    onChange={(e) => setPaid(formatNumberWithDots(e.target.value))}
                    placeholder="₺0"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">BORÇ KATEGORİSİ</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">VADE DETAYI (SKT)</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                  />
                </div>
              </div>
              {debtId === undefined && (
                <div className="space-y-3.5 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center gap-2 cursor-pointer select-none" 
                    onClick={() => {
                      if (!isPremium) {
                        onUpgradeClick?.();
                      } else {
                        setCreateAlarm(!createAlarm);
                      }
                    }}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${createAlarm ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"}`}>
                      {createAlarm && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      ÖDEME HATIRLATICI ALARMI KUR {!isPremium && <span className="text-[8px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black">PRO</span>}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setIsInstallment(!isInstallment)}>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isInstallment ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"}`}>
                      {isInstallment && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">BU BORÇ TAKSİTLİ Mİ? (PLAN OLUŞTUR)</span>
                  </div>

                  {isInstallment && (
                    <div className="space-y-1 animate-fade-in pl-6">
                      <label className="text-[10px] font-bold text-indigo-500 block mb-1">TAKSİT SAYISI (VADE AYI)</label>
                      <input
                        type="number"
                        min="1"
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(e.target.value)}
                        placeholder="Örn: 12"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-bold font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpgradeClick?.();
                  }}
                  className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/10 cursor-pointer"
                >
                  👑 BU BORCU PRO SÜRÜME EKLE
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Borç Takip Sayfası Sponsorlu Reklamı - Google AdMob Banner (Only show when there is actual content) */}
      {!isPremium && debts && debts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 space-y-2"
        >
          <AdMobBanner unitType="banner" />
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

      {isPrintModalOpen && (
        <div id="print-preview-modal" className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 select-none">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-500 animate-pulse" />
                <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 tracking-tight">RAPOR ÖNİZLEME VE YAZDIRMA MERKEZİ</span>
              </div>
              <button 
                onClick={() => setIsPrintModalOpen(false)} 
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning / Explanation Box */}
            <div className="p-4 bg-amber-500/10 border-b border-amber-500/15 text-amber-850 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <p className="font-bold">Önemli Çerçeve (Iframe) Kısıtlaması:</p>
                <p className="font-medium text-[11px] opacity-90 leading-normal">
                  Bütçem Pro güvenli bir sanal ortamda çalıştığından tarayıcınızın doğrudan yazıcı iletişim penceresi engellenmiş olabilir. 
                  Bu ortamda en kararlı yöntem <strong>"PDF Raporu İndir"</strong> seçeneğidir. Raporunuzu kusursuz Türkçe karakterlerle PDF olarak indirebilir ve dilediğiniz zaman yazdırabilirsiniz.
                </p>
              </div>
            </div>

            {/* Document Preview (Simulated A4 Paper) */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950/40 select-text">
              <div className="bg-white text-slate-950 border border-slate-200 p-8 max-w-[21cm] mx-auto shadow-md rounded-xl text-left font-sans text-[11px] min-h-[14cm]">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #e2e8f0", paddingBottom: "12px", marginBottom: "20px" }}>
                  <div>
                    <h2 style={{ color: "#4f46e5", margin: 0, fontSize: "20px", fontWeight: 800 }}>BÜTÇEM PRO</h2>
                    <p style={{ margin: "3px 0 0 0", fontSize: "10px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Akıllı Bireysel Bütçe ve Borç Yönetim Sistemi</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <h3 style={{ margin: 0, fontSize: "12px", color: "#0f172a", fontWeight: "bold" }}>Borç Durum Raporu</h3>
                    <p style={{ margin: "3px 0 0 0", fontSize: "10px", color: "#64748b" }}>Tarih: {new Date().toLocaleDateString("tr-TR")} {new Date().toLocaleTimeString("tr-TR")}</p>
                  </div>
                </div>

                <p style={{ fontSize: "11px", color: "#475569", marginBottom: "15px" }}>
                  <strong>Rapor Tipi:</strong> {activeTab === "unpaid" ? "Ödenmemiş Borçlar" : activeTab === "paid" ? "Ödenmiş Borçlar" : "Tüm Borçlar"}
                </p>

                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "15px" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "left", fontSize: "10px", background: "#f1f5f9", fontWeight: "bold", color: "#334155" }}>Borç Adı</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "left", fontSize: "10px", background: "#f1f5f9", fontWeight: "bold", color: "#334155" }}>Kategori</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "left", fontSize: "10px", background: "#f1f5f9", fontWeight: "bold", color: "#334155" }}>Son Ödeme</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "right", fontSize: "10px", background: "#f1f5f9", fontWeight: "bold", color: "#334155" }}>Toplam Tutar</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "right", fontSize: "10px", background: "#f1f5f9", fontWeight: "bold", color: "#334155" }}>Ödenen Tutar</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "right", fontSize: "10px", background: "#f1f5f9", fontWeight: "bold", color: "#334155" }}>Kalan Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebts.map((d) => (
                      <tr key={d.id}>
                        <td style={{ border: "1px solid #cbd5e1", padding: "8px", color: "#1e293b" }}>{d.name}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "8px", color: "#475569" }}>{d.category}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "8px", color: "#475569" }}>{d.dueDate || "Belirtilmemiş"}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "right", color: "#1e293b", fontWeight: "500" }}>{format(d.amount)}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "right", color: "#16a34a", fontWeight: "500" }}>{format(d.paid)}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "right", color: d.amount - d.paid > 0 ? '#dc2626' : '#1e293b', fontWeight: "bold" }}>{format(d.amount - d.paid)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: "bold", background: "#f8fafc" }}>
                      <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "10px", color: "#0f172a" }}>GENEL TOPLAM</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "10px", textAlign: "right", color: "#0f172a" }}>{format(filteredDebts.reduce((s, d) => s + d.amount, 0))}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "10px", textAlign: "right", color: "#16a34a" }}>{format(filteredDebts.reduce((s, d) => s + d.paid, 0))}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "10px", textAlign: "right", color: "#dc2626", fontWeight: "900" }}>{format(filteredDebts.reduce((s, d) => s + (d.amount - d.paid), 0))}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: "40px", borderTop: "1px solid #e2e8f0", paddingTop: "15px", textAlign: "center", fontSize: "10px", color: "#94a3b8", fontWeight: "600" }}>
                  Bütçem Pro Bireysel Finans ve Borç Yönetim Platformu | Güvenli & Şifreli Yerel Defter
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row gap-2 justify-end select-none">
              <button
                onClick={() => {
                  handlePrint(true); // Call existing highly-compatible jsPDF downloader
                  setIsPrintModalOpen(false);
                }}
                className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-750 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
              >
                <FileText className="w-4 h-4" /> PDF Raporu Olarak İndir
              </button>
              <button
                onClick={() => {
                  try {
                    window.print();
                  } catch (e) {
                    alert("Doğrudan yazdırma bu tarayıcıda engellenmiştir. Lütfen PDF İndir butonunu kullanın.");
                  }
                }}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Tarayıcı Yazıcısını Dene
              </button>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <ReceiptScanner
          onScanCompleted={handleScanCompleted}
          onClose={() => setIsScannerOpen(false)}
          defaultType="debt"
        />
      )}
    </div>
  );
};

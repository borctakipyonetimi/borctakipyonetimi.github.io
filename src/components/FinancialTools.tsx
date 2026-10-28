import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Gauge,
  PiggyBank,
  TrendingUp,
  Coins,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  DollarSign,
  Calendar,
  CalendarRange,
  CalendarDays,
  Plus,
  Trash2,
  Calculator,
  Info,
  Check,
  AlertCircle,
  HelpCircle,
  Activity,
  ArrowRight,
  BadgePercent,
  Filter,
  CheckCircle2,
  Download,
  Sparkles,
  Clock,
  ShieldCheck,
  Building2,
  Landmark,
  ShieldAlert,
  Scale,
  Car,
  Home,
  Briefcase,
  Layers,
  Lock,
  Percent,
  RefreshCw,
  BookmarkCheck,
  CreditCard,
  Wallet
} from "lucide-react";
import { Debt, Income, Expense, InstallmentDebt, PaymentLog } from "../types";
import { AdMobBanner } from "./AdMobBanner";
import { jsPDF } from "jspdf";
import { t } from "../utils/translations";
import { useCurrency } from "../utils/CurrencyContext";
import { generateAnnualPdfReport, safePdfText } from "../utils/annualPdfReport";
import { Capacitor } from "@capacitor/core";
import { downloadFileWithCustomName, savePdfDocument } from "../utils/fileDownloadHelper";

interface FinancialToolsProps {
  debts: Debt[];
  incomes: Income[];
  expenses: Expense[];
  payments?: PaymentLog[];
  installmentDebts: InstallmentDebt[];
  currentUser: string | null;
  format: (val: number) => string;
  language?: "tr" | "en";
  isPremium?: boolean;
  onUpgradeClick?: (featureName?: string) => void;
  onSaveInstallment?: (inst: Partial<InstallmentDebt>) => void;
  defaultSubTab?: "health" | "calculators" | "savings" | "calendar" | "report";
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
}

export const TURKISH_MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

export function FinancialTools({
  debts,
  incomes,
  expenses,
  payments = [],
  installmentDebts,
  currentUser,
  format,
  language = "tr",
  isPremium = false,
  onUpgradeClick,
  onSaveInstallment,
  defaultSubTab
}: FinancialToolsProps) {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const [activeSubTab, setActiveSubTab] = useState<"health" | "calculators" | "savings" | "calendar" | "report">(defaultSubTab || "health");

  // Calculator Sub-tab State
  const [calcTab, setCalcTab] = useState<"loan" | "emergency" | "networth">("loan");

  // 1. Kredi Hesaplayıcı State
  const [loanType, setLoanType] = useState<"personal" | "housing" | "vehicle" | "commercial">("personal");
  const [loanAmount, setLoanAmount] = useState<number>(100000);
  const [loanTerm, setLoanTerm] = useState<number>(12);
  const [loanMonthlyRate, setLoanMonthlyRate] = useState<number>(3.49);
  const [showAmortization, setShowAmortization] = useState<boolean>(false);
  const [loanAddedToast, setLoanAddedToast] = useState<string>("");

  // 2. Acil Durum Fonu State
  const [emergencyRent, setEmergencyRent] = useState<number>(12000);
  const [emergencyBills, setEmergencyBills] = useState<number>(3500);
  const [emergencyFood, setEmergencyFood] = useState<number>(8000);
  const [emergencyTransport, setEmergencyTransport] = useState<number>(2500);
  const [emergencyDebts, setEmergencyDebts] = useState<number>(4000);
  const [emergencyOther, setEmergencyOther] = useState<number>(2000);
  const [emergencyMonths, setEmergencyMonths] = useState<number>(6);
  const [emergencyCurrentSaved, setEmergencyCurrentSaved] = useState<number>(15000);
  const [emergencyMonthlySaveCap, setEmergencyMonthlySaveCap] = useState<number>(5000);
  const [emergencySavedToast, setEmergencySavedToast] = useState<string>("");

  // 3. Net Varlık (Net Worth) State - Derived from actual app records (debts, installments, incomes, expenses, contacts) without hardcoded dummy values
  const [assetCash, setAssetCash] = useState<number>(() => {
    try {
      const savedIncomes = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const savedExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return Math.max(0, savedIncomes - savedExpenses);
    } catch {
      return 0;
    }
  });
  const [assetGoldFx, setAssetGoldFx] = useState<number>(0);
  const [assetInvest, setAssetInvest] = useState<number>(0);
  const [assetRealEstate, setAssetRealEstate] = useState<number>(0);
  const [assetVehicle, setAssetVehicle] = useState<number>(0);
  
  const [assetReceivables, setAssetReceivables] = useState<number>(() => {
    try {
      const savedT = localStorage.getItem(`${spaceKey}_contacts_transactions`);
      if (savedT) {
        const txs = JSON.parse(savedT);
        return txs.filter((t: any) => t.type === "receivable" && !t.isPaid).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      }
    } catch {}
    return 0;
  });
  const [assetOther, setAssetOther] = useState<number>(0);

  const [liabCreditCard, setLiabCreditCard] = useState<number>(() => {
    try {
      return (installmentDebts || []).reduce((s, i) => {
        const single = (i.totalAmount || 0) / (i.installmentCount || 1);
        return s + (Math.max(0, (i.installmentCount || 1) - (i.paidInstallmentCount || 0)) * single);
      }, 0);
    } catch {
      return 0;
    }
  });

  const [liabBankLoans, setLiabBankLoans] = useState<number>(() => {
    try {
      return (debts || []).filter(d => (d.amount - (d.paid || 0)) > 0).reduce((s, d) => s + Math.max(0, d.amount - (d.paid || 0)), 0);
    } catch {
      return 0;
    }
  });

  const [liabPersonalDebts, setLiabPersonalDebts] = useState<number>(() => {
    try {
      const savedT = localStorage.getItem(`${spaceKey}_contacts_transactions`);
      if (savedT) {
        const txs = JSON.parse(savedT);
        return txs.filter((t: any) => t.type === "payable" && !t.isPaid).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      }
    } catch {}
    return 0;
  });

  const [liabOther, setLiabOther] = useState<number>(0);
  const [netWorthSyncToast, setNetWorthSyncToast] = useState<string>("");

  // Local savings goals persistence
  const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => {
    try {
      const saved = localStorage.getItem(`${spaceKey}_savings_goals`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "sg_1", name: "⚠️ Acil Durum Fonu (3 Aylık Güvence)", targetAmount: 25000, currentAmount: 8500, category: "emergency" },
      { id: "sg_2", name: "📈 Yatırım & Büyüme Akçesi", targetAmount: 15000, currentAmount: 3000, category: "investment" },
      { id: "sg_3", name: "🚗 Taşıt & Ev Bakım Fonu", targetAmount: 10000, currentAmount: 1200, category: "saving" }
    ];
  });

  useEffect(() => {
    localStorage.setItem(`${spaceKey}_savings_goals`, JSON.stringify(savingsGoals));
  }, [savingsGoals, spaceKey]);

  // Load Contacts and Transactions for Report inclusion
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactTxs, setContactTxs] = useState<any[]>([]);

  useEffect(() => {
    const savedC = localStorage.getItem(`${spaceKey}_contacts_directory`);
    const savedT = localStorage.getItem(`${spaceKey}_contacts_transactions`);
    if (savedC) {
      try { setContacts(JSON.parse(savedC)); } catch {}
    } else {
      setContacts([]);
    }
    if (savedT) {
      try { setContactTxs(JSON.parse(savedT)); } catch {}
    } else {
      setContactTxs([]);
    }
  }, [spaceKey]);

  // --- DEDUPLICATION & CONSOLIDATION OF DEBTS & TRANSACTIONS ---
  // Eliminate repeated, confusing, or cross-listed debt records
  const cleanInstallments = useMemo(() => {
    const seenIds = new Set<any>();
    const seenKeys = new Set<string>();
    return (installmentDebts || []).filter((inst) => {
      if (!inst || !inst.name) return false;
      if (inst.id !== undefined && inst.id !== null) {
        if (seenIds.has(inst.id)) return false;
        seenIds.add(inst.id);
      }
      const normName = inst.name.trim().toLowerCase();
      const key = `${normName}_${inst.totalAmount}_${inst.installmentCount}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }, [installmentDebts]);

  const cleanDebts = useMemo(() => {
    const seenIds = new Set<any>();
    const seenKeys = new Set<string>();
    const installmentNames = new Set(
      cleanInstallments.map((inst) => inst.name.trim().toLowerCase())
    );

    return (debts || []).filter((d) => {
      if (!d || !d.name) return false;
      if (d.id !== undefined && d.id !== null) {
        if (seenIds.has(d.id)) return false;
        seenIds.add(d.id);
      }
      const normName = d.name.trim().toLowerCase();
      // If debt matches an installment debt by name and amount, exclude the duplicate simple debt record
      if (installmentNames.has(normName)) {
        const matchInst = cleanInstallments.find(
          (i) => i.name.trim().toLowerCase() === normName && Math.abs(i.totalAmount - d.amount) < 1
        );
        if (matchInst) return false;
      }
      const key = `${normName}_${d.amount}_${(d.category || "").toLowerCase()}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }, [debts, cleanInstallments]);

  const cleanContactTxs = useMemo(() => {
    const seen = new Set<string>();
    return (contactTxs || []).filter((tx) => {
      if (!tx || !tx.contactName) return false;
      const key = tx.id ? String(tx.id) : `${tx.contactName.trim().toLowerCase()}_${tx.type}_${tx.amount}_${tx.isPaid}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [contactTxs]);

  // Report filter and status message state
  const [reportDebtFilter, setReportDebtFilter] = useState<"all" | "active" | "paid">("all");
  const [reportStatusMessage, setReportStatusMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [reportPeriodMode, setReportPeriodMode] = useState<"monthly" | "yearly">("monthly");
  const [reportGroupingMode, setReportGroupingMode] = useState<"by_month" | "by_category">("by_month");
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>("all");

  useEffect(() => {
    if (reportStatusMessage) {
      const timer = setTimeout(() => setReportStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [reportStatusMessage]);

  // Savings inputs
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalCat, setNewGoalCat] = useState("emergency");
  const [goalAddAmounts, setGoalAddAmounts] = useState<Record<string, string>>({});

  // Live exchange rates from context
  const { rates } = useCurrency();
  const usdRate = rates.USD || 48.49;
  const eurRate = rates.EUR || 56.36;
  const goldRate = rates.GOLD_GRAM || 6898.85; // Gram Gold
  const [pegCalculatorInput, setPegCalculatorInput] = useState<string>("10000");
  const [pegCalculatorResult, setPegCalculatorResult] = useState({ usd: 0, eur: 0, gold: 0 });

  useEffect(() => {
    const val = Number(pegCalculatorInput) || 0;
    setPegCalculatorResult({
      usd: val / usdRate,
      eur: val / eurRate,
      gold: val / goldRate
    });
  }, [pegCalculatorInput, usdRate, eurRate, goldRate]);

  // Financial metrics calculations based on clean deduplicated data
  const totalIncomesSum = incomes.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
  const totalExpensesSum = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // Month-aware income & expense calculations
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthIncomes = incomes.filter(i => (i.date || "").startsWith(currentMonthStr));
  const currentMonthIncomeSum = currentMonthIncomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const incomeMonthsSet = new Set(incomes.map(i => (i.date || "").slice(0, 7)).filter(Boolean));
  const distinctMonthsCount = Math.max(1, incomeMonthsSet.size);

  // Effective Monthly & Annual Income:
  // If user entered income for the current month, take it;
  // If user entered total salary once or across multiple months, derive monthly and annual projection accurately
  const monthlyIncome = currentMonthIncomeSum > 0
    ? currentMonthIncomeSum
    : (distinctMonthsCount > 1 ? Math.round(totalIncomesSum / distinctMonthsCount) : totalIncomesSum);

  const annualIncome = distinctMonthsCount >= 10 ? totalIncomesSum : (monthlyIncome * 12);

  // Month-aware expenses:
  const currentMonthExpenses = expenses.filter(e => (e.date || "").startsWith(currentMonthStr));
  const currentMonthExpenseSum = currentMonthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const expenseMonthsSet = new Set(expenses.map(e => (e.date || "").slice(0, 7)).filter(Boolean));
  const distinctExpMonthsCount = Math.max(1, expenseMonthsSet.size);

  const monthlyExpense = currentMonthExpenseSum > 0
    ? currentMonthExpenseSum
    : (distinctExpMonthsCount > 1 ? Math.round(totalExpensesSum / distinctExpMonthsCount) : totalExpensesSum);

  const annualExpense = distinctExpMonthsCount >= 10 ? totalExpensesSum : (monthlyExpense * 12);

  // Monthly installment payment total:
  const totalMonthlyInstallmentLoad = cleanInstallments.reduce((sum, inst) => {
    const monthly = (Number(inst.totalAmount) || 0) / (inst.installmentCount || 1);
    const isFinished = (inst.paidInstallmentCount || 0) >= (inst.installmentCount || 1);
    return isFinished ? sum : sum + monthly;
  }, 0);

  // Group all debts, installments, and payables chronologically by month
  const monthlyDebtGroups = useMemo(() => {
    const groupsMap = new Map<string, Array<{
      id: string;
      name: string;
      category: string;
      dueDate: string;
      day: number;
      amount: number;
      paid: number;
      remaining: number;
      isPaid: boolean;
      type: "Banka Borcu" | "Kredi Kartı" | "Taksit" | "Kişi Borcu";
      details?: string;
    }>>();

    const addToGroup = (monthKey: string, item: any) => {
      if (!groupsMap.has(monthKey)) {
        groupsMap.set(monthKey, []);
      }
      groupsMap.get(monthKey)!.push(item);
    };

    // 1. Simple debts:
    cleanDebts.forEach(d => {
      const rem = Math.max(0, d.amount - (d.paid || 0));
      const isPaid = rem === 0;
      let mKey = "Tarihsiz";
      let day = 1;
      if (d.dueDate && d.dueDate.length >= 7) {
        mKey = d.dueDate.slice(0, 7);
        const parts = d.dueDate.split("-");
        if (parts[2]) day = parseInt(parts[2], 10) || 1;
      }

      addToGroup(mKey, {
        id: `debt_${d.id}`,
        name: d.name,
        category: d.category || "Banka Borcu",
        dueDate: d.dueDate || "",
        day,
        amount: d.amount,
        paid: d.paid || 0,
        remaining: rem,
        isPaid,
        type: (d.category || "").toLowerCase().includes("kart") ? "Kredi Kartı" : "Banka Borcu"
      });
    });

    // 2. Installments:
    cleanInstallments.forEach(inst => {
      const count = inst.installmentCount || 1;
      const paidCount = inst.paidInstallmentCount || 0;
      const monthlyAmt = inst.totalAmount / count;

      let startY = new Date().getFullYear();
      let startM = new Date().getMonth() + 1;
      let day = 15;
      if (inst.firstDueDate && inst.firstDueDate.includes("-")) {
        const parts = inst.firstDueDate.split("-").map(Number);
        if (parts[0]) startY = parts[0];
        if (parts[1]) startM = parts[1];
        if (parts[2]) day = parts[2] || 15;
      }

      for (let i = 0; i < count; i++) {
        const totalM = startM - 1 + i;
        const itemY = startY + Math.floor(totalM / 12);
        const itemM = (totalM % 12) + 1;
        const mKey = `${itemY}-${String(itemM).padStart(2, "0")}`;
        const itemDateStr = `${mKey}-${String(day).padStart(2, "0")}`;
        const isPaid = i < paidCount;

        addToGroup(mKey, {
          id: `inst_${inst.id}_${i + 1}`,
          name: `${inst.name} (${i + 1}/${count}. Taksit)`,
          category: (inst as any).category || "Taksit",
          dueDate: itemDateStr,
          day,
          amount: monthlyAmt,
          paid: isPaid ? monthlyAmt : 0,
          remaining: isPaid ? 0 : monthlyAmt,
          isPaid,
          type: "Taksit",
          details: `Taksit ${i + 1} / ${count}`
        });
      }
    });

    // 3. Contact Payables:
    cleanContactTxs.forEach(tx => {
      if (tx.type === "payable") {
        let mKey = "Tarihsiz";
        let day = 1;
        const dStr = tx.dueDate || tx.date;
        if (dStr && dStr.length >= 7) {
          mKey = dStr.slice(0, 7);
          const parts = dStr.split("-");
          if (parts[2]) day = parseInt(parts[2], 10) || 1;
        }

        addToGroup(mKey, {
          id: `contact_${tx.id || tx.contactName}_${tx.amount}`,
          name: `${tx.contactName} (Kişiye Borç)`,
          category: "Cari Kişi Borcu",
          dueDate: dStr || "",
          day,
          amount: tx.amount,
          paid: tx.isPaid ? tx.amount : 0,
          remaining: tx.isPaid ? 0 : tx.amount,
          isPaid: !!tx.isPaid,
          type: "Kişi Borcu"
        });
      }
    });

    const keys = Array.from(groupsMap.keys());
    const datedKeys = keys.filter(k => k !== "Tarihsiz").sort();
    if (groupsMap.has("Tarihsiz")) {
      datedKeys.push("Tarihsiz");
    }

    const nowMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    return datedKeys.map(k => {
      const rawItems = groupsMap.get(k) || [];
      const items = [...rawItems].sort((a, b) => a.day - b.day);

      let year = 0;
      let month = 0;
      let monthName = "Genel / Tarihsiz Borçlar";

      if (k !== "Tarihsiz") {
        const [y, m] = k.split("-").map(Number);
        year = y;
        month = m;
        monthName = `${TURKISH_MONTH_NAMES[m - 1] || m} ${y}`;
      }

      const totalAmount = items.reduce((s, it) => s + it.amount, 0);
      const totalPaid = items.reduce((s, it) => s + it.paid, 0);
      const totalRemaining = items.reduce((s, it) => s + it.remaining, 0);

      return {
        monthKey: k,
        year,
        month,
        monthName,
        isCurrentMonth: k === nowMonthKey,
        totalAmount,
        totalPaid,
        totalRemaining,
        items
      };
    });
  }, [cleanDebts, cleanInstallments, cleanContactTxs]);
  
  // Calculate remaining debt
  const simpleUnpaidDebt = cleanDebts.reduce((sum, d) => sum + Math.max(0, d.amount - d.paid), 0);
  const installmentUnpaidDebt = cleanInstallments.reduce((sum, inst) => {
    const monthly = inst.totalAmount / (inst.installmentCount || 1);
    const paidValue = (inst.paidInstallmentCount || 0) * monthly;
    return sum + Math.max(0, inst.totalAmount - paidValue);
  }, 0);
  const bankAndInstallmentDebt = simpleUnpaidDebt + installmentUnpaidDebt;

  // Person debts
  const contactPayablesRemaining = cleanContactTxs.reduce((sum, tx) => {
    if (!tx.isPaid && tx.type === "payable") {
      return sum + tx.amount;
    }
    return sum;
  }, 0);
  const contactReceivablesRemaining = cleanContactTxs.reduce((sum, tx) => {
    if (!tx.isPaid && tx.type === "receivable") {
      return sum + tx.amount;
    }
    return sum;
  }, 0);

  const grandTotalRemainingDebt = bankAndInstallmentDebt + contactPayablesRemaining;

  // BUDGET HEALTH SCORE (Algorithm: 0 to 100)
  const calculateBudgetScore = () => {
    if (totalIncomesSum === 0) return 30; // base score with no income

    let score = 70; // middle starting point

    // Income vs Expense Ratio (up to +20 or -30)
    const expenseRatio = totalExpensesSum / totalIncomesSum;
    if (expenseRatio < 0.3) score += 20;
    else if (expenseRatio < 0.5) score += 12;
    else if (expenseRatio < 0.75) score += 2;
    else if (expenseRatio < 1.0) score -= 15;
    else score -= 30; // spending more than earning is extremely unhealthy

    // Debt to Income Ratio (up to +10 or -35)
    const debtRatio = grandTotalRemainingDebt / totalIncomesSum;
    if (debtRatio === 0) score += 10;
    else if (debtRatio < 0.5) score += 5;
    else if (debtRatio < 1.5) score -= 5;
    else if (debtRatio < 3) score -= 15;
    else score -= 30; // debt is more than 3 times income

    // Savings capacity (up to +10)
    const surplus = totalIncomesSum - totalExpensesSum;
    if (surplus > 10000) score += 10;
    else if (surplus > 5000) score += 7;
    else if (surplus > 1000) score += 3;

    // Clamp score between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const healthScore = calculateBudgetScore();

  // Get dynamic advise text based on health score
  const getHealthAdvise = (score: number) => {
    if (score >= 85) {
      return {
        title: "Kusursuz Bütçe Yönetimi! 🚀👑",
        desc: "Geliriniz giderinizin çok üstünde ve borç yükünüz son derece kontrol altında. Kazancınızı yatırımlarla büyütmek ve yeni hedeflere yelkene açmak için harika bir dönemdesiniz. Birikim hedeflerinize daha agresif katkılar yapabilirsiniz.",
        bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400",
        badge: "Kusursuz",
        color: "text-emerald-500"
      };
    } else if (score >= 65) {
      return {
        title: "Güvenli ve İstikrarlı Bakiye 👍💹",
        desc: "Bütçe dengeniz gayet makul bir çizgide ilerliyor. Temel ödemelerinizi yapabiliyor ve ufak da olsa birikim ayırabiliyorsunuz. Borçlarınızı sıfırlama stratejisini kartopu yöntemiyle devam ettirerek skoru daha da yukarı çekebilirsiniz.",
        bg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-800 dark:text-indigo-400",
        badge: "Dengeli",
        color: "text-indigo-500"
      };
    } else if (score >= 45) {
      return {
        title: "Hafif Riskli Kırmızı Sınır ⚠️👀",
        desc: "Gider kalemleriniz veya borç taksitleriniz bütçenizi zorlamaya başlamış. Gelirinizin yarısından fazlası doğrudan borç ödemelerine veya cari harcamalara gidiyor olabilir. Harcamalarınızı kısarak bir tasarruf kalkanı oluşturmanız önerilir.",
        bg: "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400",
        badge: "Hassas Dengede",
        color: "text-amber-500"
      };
    } else {
      return {
        title: "Kritik Finansal Uyarı Kalkanı! 🚨🛑",
        desc: "Finansal sağlığınız alarm veriyor! Aylık borç ödemeleriniz ve harcamalarınız gelirinizin üzerine çıkmış veya gelir akışınız durma noktasına gelmiş. Acil durum önlem planı uygulayarak yeni borçlanmaları tamamen durdurmalı ve borç kapatma rehberini uygulamalısınız.",
        bg: "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-400",
        badge: "Yüksek Risk",
        color: "text-rose-500"
      };
    }
  };

  const advice = getHealthAdvise(healthScore);

  // Goal actions
  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim() || !newGoalTarget) return;

    const targetVal = parseFloat(newGoalTarget);
    if (isNaN(targetVal) || targetVal <= 0) return;

    const newGoal: SavingsGoal = {
      id: "sg_" + Date.now(),
      name: newGoalName,
      targetAmount: targetVal,
      currentAmount: 0,
      category: newGoalCat
    };

    setSavingsGoals([newGoal, ...savingsGoals]);
    setNewGoalName("");
    setNewGoalTarget("");
  };

  const handleUpdateGoalAmount = (goalId: string, add: boolean) => {
    const inputVal = parseFloat(goalAddAmounts[goalId] || "0");
    if (isNaN(inputVal) || inputVal <= 0) return;

    setSavingsGoals(prev => prev.map(g => {
      if (g.id === goalId) {
        let newAmt = add ? g.currentAmount + inputVal : g.currentAmount - inputVal;
        newAmt = Math.max(0, Math.min(g.targetAmount, newAmt));
        return { ...g, currentAmount: newAmt };
      }
      return g;
    }));

    setGoalAddAmounts(prev => ({ ...prev, [goalId]: "" }));
  };

  const handleDeleteGoal = (goalId: string) => {
    setSavingsGoals(prev => prev.filter(g => g.id !== goalId));
  };

  // Calendar due dates mapping & Month selection state
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth() + 1); // 1-indexed
  const daysInCalMonth = new Date(calYear, calMonth, 0).getDate();
  // Day of week of 1st day of month (Monday=0, ..., Sunday=6)
  const firstDayWeekday = (new Date(calYear, calMonth - 1, 1).getDay() + 6) % 7;

  // Highlight days helper for the selected calendar month & year
  const getDebtsOnDay = (dayNum: number) => {
    const paddedDay = dayNum.toString().padStart(2, "0");
    const formattedMonth = calMonth.toString().padStart(2, "0");
    const targetDateStr = `${calYear}-${formattedMonth}-${paddedDay}`;

    const matchedDebts: { name: string; amount: number; type: string; isPaid?: boolean }[] = [];

    // Check simple debts
    cleanDebts.forEach(d => {
      if (d.dueDate === targetDateStr) {
        const rem = Math.max(0, d.amount - (d.paid || 0));
        matchedDebts.push({
          name: d.name,
          amount: rem > 0 ? rem : d.amount,
          type: (d.category || "").toLowerCase().includes("kart") ? "Kredi Kartı" : "Banka Borcu",
          isPaid: rem === 0
        });
      }
    });

    // Check installment debts in this month
    cleanInstallments.forEach(inst => {
      try {
        if (!inst.firstDueDate) return;
        const [startY, startM, startD] = inst.firstDueDate.split("-").map(Number);
        if (startY && startM) {
          const diffMonths = (calYear - startY) * 12 + (calMonth - startM);
          if (diffMonths >= 0 && diffMonths < (inst.installmentCount || 1)) {
            const installmentIndex = diffMonths + 1;
            const targetDay = startD || 15;
            if (targetDay === dayNum) {
              const monthly = inst.totalAmount / (inst.installmentCount || 1);
              const isPaid = (inst.paidInstallmentCount || 0) >= installmentIndex;
              matchedDebts.push({
                name: `${inst.name} (${installmentIndex}/${inst.installmentCount}. Taksit)`,
                amount: monthly,
                type: "Taksit",
                isPaid
              });
            }
          }
        }
      } catch {}
    });

    // Check contact payables
    cleanContactTxs.forEach(tx => {
      if (tx.type === "payable") {
        const dStr = tx.dueDate || tx.date;
        if (dStr === targetDateStr) {
          matchedDebts.push({
            name: `${tx.contactName} (Kişi Borcu)`,
            amount: tx.amount,
            type: "Cari",
            isPaid: !!tx.isPaid
          });
        }
      }
    });

    return matchedDebts;
  };

  const selectedMonthPaymentsSummary = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;
    let count = 0;

    for (let day = 1; day <= daysInCalMonth; day++) {
      const items = getDebtsOnDay(day);
      items.forEach(it => {
        totalDue += it.amount;
        if (it.isPaid) totalPaid += it.amount;
        count++;
      });
    }

    return {
      totalDue,
      totalPaid,
      totalRemaining: Math.max(0, totalDue - totalPaid),
      count
    };
  }, [calYear, calMonth, daysInCalMonth, cleanDebts, cleanInstallments, cleanContactTxs]);

  // --- HESAPLAYICILAR VE SİMÜLASYON MOTORLARI ---
  // KKDF and BSMV rates according to Turkish legislation
  const kkdfRate = loanType === "housing" || loanType === "commercial" ? 0 : 0.15;
  const bsmvRate = loanType === "housing" ? 0 : loanType === "vehicle" ? 0.05 : loanType === "commercial" ? 0.05 : 0.15;

  const loanResults = useMemo(() => {
    const P = Math.max(100, Number(loanAmount) || 0);
    const n = Math.max(1, Number(loanTerm) || 1);
    const nominalMonthlyRate = (Number(loanMonthlyRate) || 0) / 100;
    const r = nominalMonthlyRate * (1 + kkdfRate + bsmvRate);

    let monthlyPayment = 0;
    if (r === 0) {
      monthlyPayment = P / n;
    } else {
      monthlyPayment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }

    const totalPayment = monthlyPayment * n;
    const totalCost = Math.max(0, totalPayment - P);
    const totalTax = totalCost * ((kkdfRate + bsmvRate) / (1 + kkdfRate + bsmvRate || 1));
    const totalInterest = Math.max(0, totalCost - totalTax);
    const annualEffectiveRate = (Math.pow(1 + r, 12) - 1) * 100;

    // Amortization schedule
    const schedule: Array<{ month: number; payment: number; principal: number; interest: number; tax: number; remaining: number }> = [];
    let remBalance = P;
    for (let m = 1; m <= n; m++) {
      const interestPart = remBalance * nominalMonthlyRate;
      const taxPart = interestPart * (kkdfRate + bsmvRate);
      const principalPart = Math.min(remBalance, monthlyPayment - (interestPart + taxPart));
      remBalance = Math.max(0, remBalance - principalPart);
      schedule.push({
        month: m,
        payment: monthlyPayment,
        principal: principalPart,
        interest: interestPart,
        tax: taxPart,
        remaining: remBalance
      });
    }

    return {
      monthlyPayment,
      totalPayment,
      totalCost,
      totalInterest,
      totalTax,
      annualEffectiveRate,
      schedule
    };
  }, [loanAmount, loanTerm, loanMonthlyRate, kkdfRate, bsmvRate]);

  const handleAddLoanToInstallments = () => {
    if (!onSaveInstallment) {
      alert("Taksit planı kaydedilemedi.");
      return;
    }
    const typeLabel = loanType === "personal" ? "İhtiyaç Kredisi" : loanType === "housing" ? "Konut Kredisi" : loanType === "vehicle" ? "Taşıt Kredisi" : "Ticari Kredi";
    const loanName = `${typeLabel} (${format(loanAmount)})`;
    onSaveInstallment({
      name: loanName,
      totalAmount: Math.round(loanResults.totalPayment),
      installmentCount: Number(loanTerm) || 1,
      paidInstallmentCount: 0,
      firstDueDate: new Date().toISOString().slice(0, 10)
    });
    setLoanAddedToast(`✅ '${loanName}' planı taksitli borçlarınıza başarıyla eklendi!`);
    setTimeout(() => setLoanAddedToast(""), 4000);
  };

  // 2. Emergency Fund Calculation
  const emergencyMonthlyTotal = useMemo(() => {
    return (
      (Number(emergencyRent) || 0) +
      (Number(emergencyBills) || 0) +
      (Number(emergencyFood) || 0) +
      (Number(emergencyTransport) || 0) +
      (Number(emergencyDebts) || 0) +
      (Number(emergencyOther) || 0)
    );
  }, [emergencyRent, emergencyBills, emergencyFood, emergencyTransport, emergencyDebts, emergencyOther]);

  const emergencyTargetTotal = useMemo(() => {
    return emergencyMonthlyTotal * emergencyMonths;
  }, [emergencyMonthlyTotal, emergencyMonths]);

  const emergencyMissingAmount = Math.max(0, emergencyTargetTotal - (Number(emergencyCurrentSaved) || 0));
  const emergencyProgressPct = Math.min(100, Math.round(((Number(emergencyCurrentSaved) || 0) / Math.max(1, emergencyTargetTotal)) * 100));
  const emergencyMonthsToFinish = emergencyMonthlySaveCap > 0 ? Math.ceil(emergencyMissingAmount / emergencyMonthlySaveCap) : 0;

  const handleAutoFillEmergencyFromApp = () => {
    const totalExp = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const monthlyInst = installmentDebts.reduce((s, i) => {
      if ((i.paidInstallmentCount || 0) >= (i.installmentCount || 1)) return s;
      return s + (i.totalAmount / (i.installmentCount || 1));
    }, 0);

    const baseRent = Math.round(totalExp * 0.35) || 12000;
    const baseBills = Math.round(totalExp * 0.15) || 3500;
    const baseFood = Math.round(totalExp * 0.30) || 8000;
    const baseTrans = Math.round(totalExp * 0.10) || 2500;
    const baseOther = Math.round(totalExp * 0.10) || 2000;

    setEmergencyRent(baseRent);
    setEmergencyBills(baseBills);
    setEmergencyFood(baseFood);
    setEmergencyTransport(baseTrans);
    setEmergencyDebts(Math.round(monthlyInst) || 4000);
    setEmergencyOther(baseOther);

    setEmergencySavedToast("⚡ Mevcut bütçe harcama ve taksit verileriniz hesaplayıcıya aktarıldı!");
    setTimeout(() => setEmergencySavedToast(""), 3500);
  };

  const handleAddEmergencyGoalToSavings = () => {
    const goalTitle = `⚠️ Acil Durum Fonu (${emergencyMonths} Aylık Güvence)`;
    const newGoal: SavingsGoal = {
      id: "sg_emg_" + Date.now(),
      name: goalTitle,
      targetAmount: emergencyTargetTotal,
      currentAmount: Math.min(emergencyTargetTotal, Number(emergencyCurrentSaved) || 0),
      category: "emergency"
    };
    setSavingsGoals([newGoal, ...savingsGoals.filter(g => !g.name.includes("Acil Durum Fonu"))]);
    setEmergencySavedToast(`🎯 '${goalTitle}' hedefi Kumbaranıza eklendi!`);
    setTimeout(() => setEmergencySavedToast(""), 4000);
  };

  // 3. Net Worth Calculation
  const totalAssetsSum = useMemo(() => {
    return (
      (Number(assetCash) || 0) +
      (Number(assetGoldFx) || 0) +
      (Number(assetInvest) || 0) +
      (Number(assetRealEstate) || 0) +
      (Number(assetVehicle) || 0) +
      (Number(assetReceivables) || 0) +
      (Number(assetOther) || 0)
    );
  }, [assetCash, assetGoldFx, assetInvest, assetRealEstate, assetVehicle, assetReceivables, assetOther]);

  const totalLiabilitiesSum = useMemo(() => {
    return (
      (Number(liabCreditCard) || 0) +
      (Number(liabBankLoans) || 0) +
      (Number(liabPersonalDebts) || 0) +
      (Number(liabOther) || 0)
    );
  }, [liabCreditCard, liabBankLoans, liabPersonalDebts, liabOther]);

  const netWorthValue = totalAssetsSum - totalLiabilitiesSum;
  const debtToAssetRatio = totalAssetsSum > 0 ? Math.round((totalLiabilitiesSum / totalAssetsSum) * 100) : 100;

  const handleAutoFillNetWorthFromApp = () => {
    const instRem = installmentDebts.reduce((s, i) => {
      const single = i.totalAmount / (i.installmentCount || 1);
      return s + (Math.max(0, (i.installmentCount || 1) - (i.paidInstallmentCount || 0)) * single);
    }, 0);
    const bankDebts = debts.filter(d => (d.amount - (d.paid || 0)) > 0).reduce((s, d) => s + Math.max(0, d.amount - (d.paid || 0)), 0);
    const contactPay = contactTxs.filter(t => t.type === "payable" && !t.isPaid).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const contactRec = contactTxs.filter(t => t.type === "receivable" && !t.isPaid).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    setLiabCreditCard(Math.round(instRem));
    setLiabBankLoans(Math.round(bankDebts));
    setLiabPersonalDebts(Math.round(contactPay));
    setAssetReceivables(Math.round(contactRec));

    setNetWorthSyncToast("⚡ Uygulamadaki borç, taksit ve kişi alacakları Net Değer tablosuna aktarıldı!");
    setTimeout(() => setNetWorthSyncToast(""), 3500);
  };

  const [selectedDayTab, setSelectedDayTab] = useState<number | null>(new Date().getDate());

  return (
    <div className="w-full space-y-6">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <Coins className="w-7 h-7 text-indigo-500 animate-pulse" /> FİNANSAL ANALİZ VE MODELLEME ARAÇLARI
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      {/* Visual Menu Header Bar */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="z-10 w-full text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              Akıllı Finans & Simülasyon Merkezi
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1">
              Kredi hesaplama, acil durum fonu, net varlık ve bütçe sağlık simülatörlerini tek noktadan yönetin.
            </p>
          </div>
          {!isPremium && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-black self-center md:self-auto">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PRO Raporlar Kilitli</span>
            </div>
          )}
        </div>

        {/* Subtab Navigation Pills */}
        <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl z-10 w-full border border-slate-200/50 dark:border-slate-800/80">
          <button
            onClick={() => setActiveSubTab("health")}
            className={`flex-1 min-w-[100px] px-3 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 select-none ${
              activeSubTab === "health"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Gauge className="w-3.5 h-3.5" /> Bütçe Sağlığı
          </button>
          <button
            onClick={() => setActiveSubTab("calculators")}
            className={`flex-1 min-w-[130px] px-3 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 select-none ${
              activeSubTab === "calculators"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-500" /> Mali Hesaplayıcılar
          </button>
          <button
            onClick={() => setActiveSubTab("savings")}
            className={`flex-1 min-w-[100px] px-3 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 select-none ${
              activeSubTab === "savings"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" /> Kumbara
          </button>
          <button
            onClick={() => setActiveSubTab("calendar")}
            className={`flex-1 min-w-[110px] px-3 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 select-none ${
              activeSubTab === "calendar"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" /> Ödeme Takvimi
          </button>
          <button
            onClick={() => setActiveSubTab("report")}
            className={`flex-1 min-w-[110px] px-3 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 select-none ${
              activeSubTab === "report"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Rapor Al
            {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-slate-950 px-1 py-0.5 rounded font-black font-mono">PRO</span>}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: BUDGET HEALTH */}
        {activeSubTab === "health" && (
          <motion.div
            key="health"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Speedometer Radial Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                REAL-TIME SAĞLIK İNDEKSİ
              </h3>

              {/* Dynamic SVG Circular Gauge */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="88"
                    cy="88"
                    r="72"
                    className="stroke-slate-100 dark:stroke-slate-800 fill-none"
                    strokeWidth="12"
                  />
                  <motion.circle
                    cx="88"
                    cy="88"
                    r="72"
                    className="fill-none"
                    strokeWidth="12"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "452 452", strokeDashoffset: 452 }}
                    animate={{ strokeDashoffset: 452 - (452 * healthScore) / 100 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{
                      stroke:
                        healthScore >= 80
                          ? "#10b981"
                          : healthScore >= 60
                          ? "#6366f1"
                          : healthScore >= 40
                          ? "#f59e0b"
                          : "#ef4444"
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-4xl font-extrabold text-slate-800 dark:text-white"
                  >
                    {healthScore}
                  </motion.span>
                  <span className="text-[10px] font-black text-slate-400 tracking-wider">
                    SKOR / 100
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex px-3 py-1 bg-slate-100 dark:bg-slate-850 rounded-full text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Kategori: <span className={`${advice.color} ml-1`}>{advice.badge}</span>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  Tasarruf oranı, borç/gelir dengesi ve yük limitleri bizzat analiz edilerek rasyonel olarak hesaplanmıştır.
                </p>
              </div>
            </div>

            {/* Advice and Metrics Breakdown */}
            <div className="lg:col-span-2 space-y-6">
              {/* Main Advice Box */}
              <div className={`p-6 rounded-3xl border ${advice.bg} space-y-3`}>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 animate-pulse" />
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">
                    {advice.title}
                  </h3>
                </div>
                <p className="text-xs font-semibold leading-relaxed">
                  {advice.desc}
                </p>
              </div>

              {/* Stat breakdown indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      TASARRUF KAPASİTESİ
                    </span>
                    <strong className="text-sm font-black text-slate-800 dark:text-white">
                      {format(totalIncomesSum - totalExpensesSum)}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      Kullanılabilir Net Fazla Bakiye
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      BORÇ YÜKÜ LİMİTİ
                    </span>
                    <strong className="text-sm font-black text-slate-800 dark:text-white">
                      {totalIncomesSum > 0 ? `%${Math.round((grandTotalRemainingDebt / (totalIncomesSum || 1)) * 100)}` : "Belirsiz"}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      Gelire Göre Toplam Borç Payı
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      GİDER ORANI
                    </span>
                    <strong className="text-sm font-black text-slate-800 dark:text-white">
                      {totalIncomesSum > 0 ? `%${Math.round((totalExpensesSum / totalIncomesSum) * 100)}` : "%0"}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      Aylık Gelirin Harcanan Yüzdesi
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      TOPLAM KALAN YÜK
                    </span>
                    <strong className="text-sm font-black text-rose-600 dark:text-rose-400">
                      {format(grandTotalRemainingDebt)}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      Ödenmemiş Alacak Dışı Borçlar
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB: FINANCIAL CALCULATORS & SIMULATION TOOLS */}
        {activeSubTab === "calculators" && (
          <motion.div
            key="calculators"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* 3 Calculator Tabs: Kredi Hesaplayıcı, Acil Durum Fonu, Net Varlık */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setCalcTab("loan")}
                className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                  calcTab === "loan"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Calculator className="w-3.5 h-3.5" /> 🧮 Kredi & Taksit Hesaplayıcı
              </button>
              <button
                type="button"
                onClick={() => setCalcTab("emergency")}
                className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                  calcTab === "emergency"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" /> 🛡️ Acil Durum Fonu Hesaplayıcı
              </button>
              <button
                type="button"
                onClick={() => setCalcTab("networth")}
                className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                  calcTab === "networth"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Scale className="w-3.5 h-3.5" /> 💎 Net Varlık (Net Worth) Hesabı
              </button>
            </div>

            {/* ======================================================== */}
            {/* SUB-CALCULATOR 1: KREDİ & TAKSİT HESAPLAYICI             */}
            {/* ======================================================== */}
            {calcTab === "loan" && (
              <div className="space-y-6 animate-fade-in">
                {loanAddedToast && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{loanAddedToast}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Inputs */}
                  <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-5">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <Calculator className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                          KREDİ PARAMETRELERİ
                        </h3>
                        <p className="text-[10px] text-slate-400">Tutar, vade ve faiz oranını belirleyin</p>
                      </div>
                    </div>

                    {/* Kredi Türü */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                        Kredi Türü
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "personal", label: "İhtiyaç Kredisi", icon: "💳", tax: "KKDF %15, BSMV %15" },
                          { id: "housing", label: "Konut Kredisi", icon: "🏠", tax: "Vergi Muafiyeti (%0)" },
                          { id: "vehicle", label: "Taşıt Kredisi", icon: "🚗", tax: "KKDF %15, BSMV %5" },
                          { id: "commercial", label: "Ticari / KOBİ", icon: "💼", tax: "BSMV %5" },
                        ].map((tItem) => (
                          <button
                            key={tItem.id}
                            type="button"
                            onClick={() => setLoanType(tItem.id as any)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              loanType === tItem.id
                                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            <div className="font-extrabold text-xs flex items-center gap-1">
                              <span>{tItem.icon}</span> {tItem.label}
                            </div>
                            <div className="text-[9px] text-slate-400 font-medium mt-0.5">{tItem.tax}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Kredi Tutarı */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        <span>Kredi Tutarı (TL)</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs">{format(loanAmount)}</span>
                      </div>
                      <input
                        type="number"
                        min="1000"
                        step="1000"
                        value={loanAmount || ""}
                        onChange={(e) => setLoanAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {[25000, 50000, 100000, 250000, 500000].map((quickAmt) => (
                          <button
                            key={quickAmt}
                            type="button"
                            onClick={() => setLoanAmount(quickAmt)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                              loanAmount === quickAmt
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {quickAmt >= 1000 ? `${quickAmt / 1000}K ₺` : quickAmt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vade (Ay) */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        <span>Vade Süresi (Ay)</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs">{loanTerm} Ay</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max={loanType === "housing" ? "120" : "60"}
                        step="1"
                        value={loanTerm}
                        onChange={(e) => setLoanTerm(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {[6, 12, 24, 36, 48, 60, ...(loanType === "housing" ? [120] : [])].map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => setLoanTerm(term)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                              loanTerm === term
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {term} Ay
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Aylık Faiz Oranı (%) */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        <span>Aylık Faiz / Kâr Payı (%)</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs">%{loanMonthlyRate.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="15"
                          value={loanMonthlyRate || ""}
                          onChange={(e) => setLoanMonthlyRate(parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Results & Simulation Analysis */}
                  <div className="lg:col-span-2 space-y-5">
                    {/* Big Monthly Payment Banner */}
                    <div className="p-6 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">
                            HESAPLANAN AYLIK TAKSİT TUTARI
                          </span>
                          <div className="text-2xl sm:text-4xl font-black font-mono tracking-tight mt-1">
                            {format(loanResults.monthlyPayment)} <span className="text-sm font-normal text-indigo-200">/ Ay</span>
                          </div>
                        </div>
                        <div className="text-right sm:text-right">
                          <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block">Yıllık Efektif Maliyet (YMO)</span>
                          <span className="text-lg font-black font-mono text-amber-300">
                            %{loanResults.annualEffectiveRate.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* 4 Detail Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/10">
                        <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                          <span className="text-[9px] text-indigo-200 block font-bold uppercase">Çekilen Anapara</span>
                          <span className="text-xs sm:text-sm font-black font-mono">{format(loanAmount)}</span>
                        </div>
                        <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                          <span className="text-[9px] text-indigo-200 block font-bold uppercase">Toplam Faiz Yükü</span>
                          <span className="text-xs sm:text-sm font-black font-mono text-amber-300">{format(loanResults.totalInterest)}</span>
                        </div>
                        <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                          <span className="text-[9px] text-indigo-200 block font-bold uppercase">Toplam Vergi (KKDF+BSMV)</span>
                          <span className="text-xs sm:text-sm font-black font-mono">{format(loanResults.totalTax)}</span>
                        </div>
                        <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                          <span className="text-[9px] text-indigo-200 block font-bold uppercase">Toplam Geri Ödeme</span>
                          <span className="text-xs sm:text-sm font-black font-mono text-emerald-300">{format(loanResults.totalPayment)}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {onSaveInstallment && (
                          <button
                            type="button"
                            onClick={handleAddLoanToInstallments}
                            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> Bu Krediyi Taksitli Borçlarıma Ekle ➕
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowAmortization(!showAmortization)}
                          className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <CalendarDays className="w-4 h-4" /> {showAmortization ? "Ödeme Planını Gizle" : "Ödeme Planını / Amortismanı Gör (Ay Ay)"}
                        </button>
                      </div>
                    </div>

                    {/* Amortization Table */}
                    {showAmortization && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            🗓️ Aylık Taksit & Amortisman Planı
                          </h4>
                          <span className="text-[10px] text-slate-400 font-bold">{loanTerm} Taksit</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto pr-1">
                          <table className="w-full text-[11px] text-left">
                            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase text-[9px] font-black">
                              <tr>
                                <th className="p-2">Ay</th>
                                <th className="p-2">Taksit Tutarı</th>
                                <th className="p-2">Anapara</th>
                                <th className="p-2">Faiz</th>
                                <th className="p-2">Vergi</th>
                                <th className="p-2">Kalan Borç</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {loanResults.schedule.map((row) => (
                                <tr key={row.month} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                                  <td className="p-2 font-bold">{row.month}. Ay</td>
                                  <td className="p-2 font-mono font-bold text-slate-800 dark:text-slate-200">{format(row.payment)}</td>
                                  <td className="p-2 font-mono text-emerald-600 dark:text-emerald-400">{format(row.principal)}</td>
                                  <td className="p-2 font-mono text-amber-600 dark:text-amber-400">{format(row.interest)}</td>
                                  <td className="p-2 font-mono text-slate-500">{format(row.tax)}</td>
                                  <td className="p-2 font-mono font-black text-slate-700 dark:text-slate-300">{format(row.remaining)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-CALCULATOR 2: ACİL DURUM FONU HESAPLAYICI            */}
            {/* ======================================================== */}
            {calcTab === "emergency" && (
              <div className="space-y-6 animate-fade-in">
                {emergencySavedToast && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{emergencySavedToast}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Monthly Expenses Inputs */}
                  <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        <div>
                          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                            AYLIK ZORUNLU GİDERLER
                          </h3>
                          <p className="text-[10px] text-slate-400">Hayatınızı idame ettirecek asgari giderler</p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoFillEmergencyFromApp}
                      className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Uygulamadaki Giderleri Otomatik Çek ⚡
                    </button>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          🏠 Kira / Konut / Aidat (TL)
                        </label>
                        <input
                          type="number"
                          value={emergencyRent || ""}
                          onChange={(e) => setEmergencyRent(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          💡 Faturalar (Elektrik, Su, Doğalgaz, Tel)
                        </label>
                        <input
                          type="number"
                          value={emergencyBills || ""}
                          onChange={(e) => setEmergencyBills(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          🛒 Temel Mutfak & Market
                        </label>
                        <input
                          type="number"
                          value={emergencyFood || ""}
                          onChange={(e) => setEmergencyFood(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          🚗 Ulaşım & Yakıt
                        </label>
                        <input
                          type="number"
                          value={emergencyTransport || ""}
                          onChange={(e) => setEmergencyTransport(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          💳 Asgari Borç / Kredi / Taksit Ödemeleri
                        </label>
                        <input
                          type="number"
                          value={emergencyDebts || ""}
                          onChange={(e) => setEmergencyDebts(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          💊 Sağlık & Diğer Zorunlu
                        </label>
                        <input
                          type="number"
                          value={emergencyOther || ""}
                          onChange={(e) => setEmergencyOther(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Emergency Target Setup & Strategy */}
                  <div className="lg:col-span-2 space-y-5">
                    {/* Duration & Saved Amount Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-5">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                          🎯 Hedef Güvence Süresi
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { m: 3, label: "3 Ay", desc: "Asgari Güvence" },
                            { m: 6, label: "6 Ay", desc: "Önerilen Standart ⭐" },
                            { m: 9, label: "9 Ay", desc: "Yüksek Güvenlik" },
                            { m: 12, label: "12 Ay", desc: "Maksimum Bağımsızlık" },
                          ].map((dur) => (
                            <button
                              key={dur.m}
                              type="button"
                              onClick={() => setEmergencyMonths(dur.m)}
                              className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                                emergencyMonths === dur.m
                                  ? "bg-amber-500 text-slate-950 font-black border-amber-500 shadow-md shadow-amber-500/20"
                                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              <div className="text-sm font-black">{dur.label}</div>
                              <div className="text-[9px] opacity-80 mt-0.5">{dur.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                            💰 Şu Anda Birikmiş Acil Fon Tutarı (TL)
                          </label>
                          <input
                            type="number"
                            value={emergencyCurrentSaved || ""}
                            onChange={(e) => setEmergencyCurrentSaved(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                            ⏳ Aylık Tasarruf Kapasiteniz (TL/Ay)
                          </label>
                          <input
                            type="number"
                            value={emergencyMonthlySaveCap || ""}
                            onChange={(e) => setEmergencyMonthlySaveCap(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Big Result Card */}
                    <div className="p-6 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 text-slate-950 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-950/80">
                            {emergencyMonths} AYLIK HEDEF ACİL DURUM FONU
                          </span>
                          <div className="text-2xl sm:text-4xl font-black font-mono tracking-tight text-slate-950 mt-1">
                            {format(emergencyTargetTotal)}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold text-amber-950/80 uppercase tracking-wider block">Aylık Yaşam Masrafı</span>
                          <span className="text-lg font-black font-mono text-slate-950">
                            {format(emergencyMonthlyTotal)} / Ay
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 pt-2 border-t border-amber-400/40">
                        <div className="flex justify-between text-xs font-black text-slate-950">
                          <span>Fon Tamamlanma Oranı: %{emergencyProgressPct}</span>
                          <span>Eksik Kalan: {format(emergencyMissingAmount)}</span>
                        </div>
                        <div className="w-full h-3 bg-amber-950/20 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${emergencyProgressPct}%` }}
                            transition={{ duration: 1 }}
                            className="h-full bg-slate-950 rounded-full"
                          />
                        </div>
                        <p className="text-[11px] font-semibold text-amber-950 mt-1">
                          {emergencyMissingAmount <= 0
                            ? "🎉 Tebrikler! Acil durum güvence fonunuz eksiksiz şekilde hazır."
                            : emergencyMonthlySaveCap > 0
                            ? `💡 Aylık ${format(emergencyMonthlySaveCap)} tasarruf ile yaklaşık ${emergencyMonthsToFinish} ay sonra fonunuz tamamlanacaktır.`
                            : "💡 Düzenli aylık tasarruf ayırarak acil durum güvence fonunuzu tamamlayabilirsiniz."}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleAddEmergencyGoalToSavings}
                          className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-400 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <PiggyBank className="w-4 h-4" /> Bu Fonu Kumbarama Hedef Olarak Ekle 🎯
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-CALCULATOR 3: NET VARLIK (NET WORTH) HESAPLAYICI     */}
            {/* ======================================================== */}
            {calcTab === "networth" && (
              <div className="space-y-6 animate-fade-in">
                {netWorthSyncToast && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{netWorthSyncToast}</span>
                  </div>
                )}

                {/* Big Net Worth Banner */}
                <div className={`p-6 rounded-3xl text-white shadow-xl space-y-4 relative overflow-hidden ${
                  netWorthValue >= 0
                    ? "bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900"
                    : "bg-gradient-to-br from-rose-600 via-red-700 to-slate-900"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200">
                        TOPLAM NET SERVET (NET WORTH)
                      </span>
                      <div className="text-2xl sm:text-4xl font-black font-mono tracking-tight mt-1">
                        {format(netWorthValue)}
                      </div>
                      <span className="text-xs text-emerald-100/90 font-medium">
                        (Toplam Varlıklar - Toplam Borçlar)
                      </span>
                    </div>

                    <div className="text-left sm:text-right space-y-1">
                      <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">
                        Finansal Sağlık Notu
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-xl text-xs font-black inline-block">
                        {netWorthValue > 500000
                          ? "🌟 MÜKEMMEL (AAA)"
                          : netWorthValue > 100000
                          ? "🟢 GÜÇLÜ (AA)"
                          : netWorthValue >= 0
                          ? "🟡 DENGELİ (A)"
                          : "🔴 BORÇ BASKISI (B)"}
                      </span>
                      <div className="text-[10px] text-emerald-200 font-mono">
                        Borç / Varlık Oranı: %{debtToAssetRatio}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleAutoFillNetWorthFromApp}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Uygulamadaki Borç & Alacakları Eşitle ⚡
                    </button>
                  </div>
                </div>

                {/* 2-Column Balance Sheet (Aktifler vs Pasifler) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Varlıklar (Assets) */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-emerald-500/20 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                          AKTİF VARLIKLAR (ASSETS)
                        </h3>
                      </div>
                      <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {format(totalAssetsSum)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          💵 Nakit & Vadesiz / Vadeli Banka (TL)
                        </label>
                        <input
                          type="number"
                          value={assetCash || ""}
                          onChange={(e) => setAssetCash(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          🥇 Altın & Döviz Varlıkları
                        </label>
                        <input
                          type="number"
                          value={assetGoldFx || ""}
                          onChange={(e) => setAssetGoldFx(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          📈 Hisse Senedi, Fon & Kripto
                        </label>
                        <input
                          type="number"
                          value={assetInvest || ""}
                          onChange={(e) => setAssetInvest(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          🏠 Gayrimenkul / Konut / Arsa Değerleri
                        </label>
                        <input
                          type="number"
                          value={assetRealEstate || ""}
                          onChange={(e) => setAssetRealEstate(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          🚗 Araç / Otomobil Değeri
                        </label>
                        <input
                          type="number"
                          value={assetVehicle || ""}
                          onChange={(e) => setAssetVehicle(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          🤝 Kişi / Şahıs Alacakları (Cari)
                        </label>
                        <input
                          type="number"
                          value={assetReceivables || ""}
                          onChange={(e) => setAssetReceivables(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Yükümlülükler (Liabilities) */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-rose-500/20 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                          PASİF YÜKÜMLÜLÜKLER (BORÇLAR)
                        </h3>
                      </div>
                      <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                        {format(totalLiabilitiesSum)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          💳 Kredi Kartı & Taksitli Borç Yükü (TL)
                        </label>
                        <input
                          type="number"
                          value={liabCreditCard || ""}
                          onChange={(e) => setLiabCreditCard(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          🏦 Banka Kredileri & Kalan Anapara
                        </label>
                        <input
                          type="number"
                          value={liabBankLoans || ""}
                          onChange={(e) => setLiabBankLoans(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          👥 Kişi / Şahıs Borçları (Verecekler)
                        </label>
                        <input
                          type="number"
                          value={liabPersonalDebts || ""}
                          onChange={(e) => setLiabPersonalDebts(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          📦 Diğer Borç & Taahhütler
                        </label>
                        <input
                          type="number"
                          value={liabOther || ""}
                          onChange={(e) => setLiabOther(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: PIGGY BANK / GOALS */}
        {activeSubTab === "savings" && (
          <motion.div
            key="savings"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left: Input Box */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <PiggyBank className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                  YENİ BİRİKİM RADARI KUR
                </h3>
              </div>

              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                    Kumbara Hedef Başlığı *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGoalName}
                    onChange={(e) => setNewGoalName(e.target.value)}
                    placeholder="Ör: Araba Peşinatı, Acil Fon"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                    Hedef Miktar (TL) *
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    placeholder="Ör: 15000"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                    Fon Kategorisi
                  </label>
                  <select
                    value={newGoalCat}
                    onChange={(e) => setNewGoalCat(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="emergency">🚨 Acil Durum Kalkanı</option>
                    <option value="investment">📈 Gelecek Yatırım</option>
                    <option value="saving">🚗 Birikim & Tasarruf</option>
                    <option value="debt">❄️ Borç Kapatma Akçesi</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer active:scale-97 shadow-md hover:shadow-indigo-500/20"
                >
                  Fon Akçesi Ekle 💡
                </button>
              </form>
            </div>

            {/* Right: Goals list */}
            <div className="lg:col-span-2 space-y-4">
              {savingsGoals.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200/60 dark:border-slate-800 text-center space-y-2">
                  <PiggyBank className="w-12 h-12 text-slate-300 mx-auto animate-bounce" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Henüz Tasarruf Kumbarası Bulunmuyor
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Sol kısımdaki paneli kullanarak hayalleriniz veya güvence kalkanınız için kumbara hedefleri başlatın!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savingsGoals.map(goal => {
                    const percent = Math.round((goal.currentAmount / goal.targetAmount) * 100) || 0;
                    return (
                      <div
                        key={goal.id}
                        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-between space-y-4 shadow-xs hover:border-indigo-500/30 transition-all group relative overflow-hidden"
                      >
                        {/* Piggy animation background elements */}
                        <div className="absolute -right-6 -bottom-6 opacity-3 group-hover:opacity-6 text-indigo-500 transition pointer-events-none transform group-hover:scale-110">
                          <PiggyBank className="w-24 h-24" />
                        </div>

                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100/20">
                              {goal.category === "emergency" ? "Acil Durum" : goal.category === "investment" ? "Yatırım" : goal.category === "debt" ? "Borç Fonu" : "Tasarruf"}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white mt-1.5 leading-snug">
                              {goal.name}
                            </h4>
                          </div>

                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Progress visual bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black text-slate-400">
                              Yolculuk Oranı
                            </span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                              %{percent}
                            </span>
                          </div>
                          
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative border border-slate-200/20">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-500 rounded-full"
                            />
                          </div>

                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>{format(goal.currentAmount)}</span>
                            <span>/ {format(goal.targetAmount)}</span>
                          </div>
                        </div>

                        {/* Fast update buttons */}
                        <div className="flex gap-1.5 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                          <input
                            type="number"
                            min="10"
                            placeholder="Tutar gir"
                            value={goalAddAmounts[goal.id] || ""}
                            onChange={(e) => setGoalAddAmounts(prev => ({ ...prev, [goal.id]: e.target.value }))}
                            className="w-1/2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-400 transition"
                          />
                          <button
                            onClick={() => handleUpdateGoalAmount(goal.id, true)}
                            className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-black rounded-lg cursor-pointer transition active:scale-95 text-center flex items-center justify-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Ekle
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}



        {/* TAB 4: INTERACTIVE due DATE CALENDAR */}
        {activeSubTab === "calendar" && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Calendar Grid Sheet */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
              {/* Header with Month Navigation and Month/Year selectors */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
                <div className="flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                      AYLIK BORÇ VADE MATRİSİ
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      İstediğiniz ayı ve yılı seçerek o aya ait tüm borç ve taksitleri inceleyebilirsiniz.
                    </p>
                  </div>
                </div>

                {/* Month / Year Controls */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                  {/* Prev Month */}
                  <button
                    type="button"
                    onClick={() => {
                      if (calMonth === 1) {
                        setCalYear(y => y - 1);
                        setCalMonth(12);
                      } else {
                        setCalMonth(m => m - 1);
                      }
                      setSelectedDayTab(1);
                    }}
                    title="Önceki Ay"
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Month Select */}
                  <select
                    value={calMonth}
                    onChange={(e) => {
                      setCalMonth(Number(e.target.value));
                      setSelectedDayTab(1);
                    }}
                    className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold px-2 py-1.5 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {TURKISH_MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>

                  {/* Year Select */}
                  <select
                    value={calYear}
                    onChange={(e) => {
                      setCalYear(Number(e.target.value));
                      setSelectedDayTab(1);
                    }}
                    className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold px-2 py-1.5 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>

                  {/* Next Month */}
                  <button
                    type="button"
                    onClick={() => {
                      if (calMonth === 12) {
                        setCalYear(y => y + 1);
                        setCalMonth(1);
                      } else {
                        setCalMonth(m => m + 1);
                      }
                      setSelectedDayTab(1);
                    }}
                    title="Sonraki Ay"
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Quick "Bugün" Jump Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const t = new Date();
                      setCalYear(t.getFullYear());
                      setCalMonth(t.getMonth() + 1);
                      setSelectedDayTab(t.getDate());
                    }}
                    title="Bu Aya Dön"
                    className="px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition cursor-pointer ml-1"
                  >
                    Bu Ay
                  </button>
                </div>
              </div>

              {/* Monthly Overview Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs font-medium">
                <span className="font-extrabold text-slate-700 dark:text-slate-200">
                  🗓️ {TURKISH_MONTH_NAMES[calMonth - 1]} {calYear} Matrisi
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">
                    Ödeme Sayısı: <b className="text-slate-800 dark:text-slate-200 font-black">{selectedMonthPaymentsSummary.count}</b>
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    Toplam: <b className="text-rose-600 dark:text-rose-400 font-black">{format(selectedMonthPaymentsSummary.totalDue)}</b>
                  </span>
                  {selectedMonthPaymentsSummary.totalPaid > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Ödenen: {format(selectedMonthPaymentsSummary.totalPaid)}
                    </span>
                  )}
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 text-center">
                {/* Days of week */}
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map(day => (
                  <span key={day} className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-1">
                    {day}
                  </span>
                ))}

                {/* Blank days before day 1 */}
                {Array.from({ length: firstDayWeekday }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-11 sm:h-12 rounded-xl bg-slate-50/20 dark:bg-slate-950/20" />
                ))}

                {/* Days matrix of the active month */}
                {Array.from({ length: daysInCalMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const matchedItems = getDebtsOnDay(dayNum);
                  const hasDebt = matchedItems.length > 0;
                  const isSelected = selectedDayTab === dayNum;
                  const isToday =
                    calYear === new Date().getFullYear() &&
                    calMonth === (new Date().getMonth() + 1) &&
                    dayNum === new Date().getDate();

                  const totalDayAmount = matchedItems.reduce((s, it) => s + it.amount, 0);

                  return (
                    <button
                      key={dayNum}
                      onClick={() => setSelectedDayTab(dayNum)}
                      title={hasDebt ? `${dayNum} ${TURKISH_MONTH_NAMES[calMonth - 1]}: ${matchedItems.length} borç (${format(totalDayAmount)})` : `${dayNum} ${TURKISH_MONTH_NAMES[calMonth - 1]}`}
                      className={`h-11 sm:h-12 relative rounded-xl font-mono text-[11px] font-black cursor-pointer transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-102"
                          : hasDebt
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20"
                          : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400"
                      } ${isToday && !isSelected ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
                    >
                      <span>{dayNum}</span>
                      
                      {/* Debt alert indicator dots */}
                      {hasDebt && !isSelected && (
                        <span className="absolute bottom-1 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        </span>
                      )}
                      {isToday && !hasDebt && !isSelected && (
                        <span className="absolute bottom-1 w-1 h-1 bg-indigo-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Agenda Side panel */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[340px]">
              <div>
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">GÜNLÜK VADE DETAYI</span>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight mt-0.5">
                      {selectedDayTab
                        ? `${selectedDayTab} ${TURKISH_MONTH_NAMES[calMonth - 1]} ${calYear} Ajandası`
                        : "Gün Seçiniz"}
                    </h3>
                  </div>
                  {selectedDayTab && (
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-lg">
                      {getDebtsOnDay(selectedDayTab).length} Kalem
                    </span>
                  )}
                </div>

                {selectedDayTab ? (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {getDebtsOnDay(selectedDayTab).length === 0 ? (
                      <div className="p-5 text-center space-y-2 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                        <Check className="w-8 h-8 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-full mx-auto" />
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Harika! Vade Bulunmuyor
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                          Bu günde ödenmesi gereken herhangi bir aktif borç kalemi veya taksit saptanmadı.
                        </p>
                      </div>
                    ) : (
                      getDebtsOnDay(selectedDayTab).map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border-l-[3px] flex justify-between items-center transition ${
                            item.isPaid
                              ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500"
                              : "bg-rose-500/5 dark:bg-rose-950/10 border-rose-500"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                                item.isPaid
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                                  : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400"
                              }`}>
                                {item.type}
                              </span>
                              {item.isPaid && (
                                <span className="text-[8px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> ÖDENDİ
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white mt-1">
                              {item.name}
                            </h4>
                          </div>
                          <strong className={`text-xs font-black ${
                            item.isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                          }`}>
                            {format(item.amount)}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center italic">
                    Günün ödemelerini listelemek için takvimden bir gün seçiniz.
                  </p>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-[10px] text-slate-400 font-semibold leading-normal mt-4">
                ℹ️ Ödeme günü takipleri, borç oluştururken girdiğiniz vadeleri ve taksitli borç başlangıç tarihlerini referans alarak seçilen aya özel dinamik hesaplanır.
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 5: FINANCIAL REPORT PDF EXPORTER */}
        {activeSubTab === "report" && (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6 animate-fadeIn"
          >
            {/* Elegant Print Style Override specifically for printing the target report beautifully */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                /* Hide non-report elements */
                body * {
                  visibility: hidden !important;
                }
                /* Make only the report sheet container and its descendants visible */
                #financial-audit-report, #financial-audit-report * {
                  visibility: visible !important;
                }
                /* Reposition report container to perfect alignment in print margins */
                #financial-audit-report {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 1rem !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: white !important;
                  color: black !important;
                }
                /* Ensure print has a crisp white background with fine dark borders */
                #financial-audit-report * {
                  background-color: transparent !important;
                  color: black !important;
                  border-color: #cbd5e1 !important;
                  box-shadow: none !important;
                  text-shadow: none !important;
                }
                .print-hidden, .print\\:hidden {
                  display: none !important;
                }
              }
            ` }} />

            {/* Notification / Feedback Banner */}
            {reportStatusMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-sm print:hidden ${
                  reportStatusMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : reportStatusMessage.type === "error"
                    ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                    : "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {reportStatusMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : reportStatusMessage.type === "error" ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 animate-spin" />
                  )}
                  <span>{reportStatusMessage.text}</span>
                </div>
                <button
                  onClick={() => setReportStatusMessage(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5 rounded cursor-pointer"
                >
                  ✕
                </button>
              </motion.div>
            )}

            {/* PRO Lock Notification Banner for Non-Premium Users */}
            {!isPremium && (
              <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-indigo-500/15 border-2 border-amber-500/40 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    PRO
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-amber-500" /> Resmi PDF Raporlama & Yazdırma Özellikleri Kilitli
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      PDF Denetim Raporu İndirme, Sistemden Yazdırma ve 12 Aylık Yıllık PDF Özeti Premium hesaplara özeldir.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpgradeClick?.("Resmi Denetim Raporu & PDF İndirme")}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl transition shadow-md shrink-0 cursor-pointer active:scale-95"
                >
                  Hemen PRO'ya Geç ✨
                </button>
              </div>
            )}

            {/* Control Panel Block */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                    RAPOR HAZIRLAYICI VE DENETİM PANELİ
                  </h4>
                  <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-[10px] font-black rounded-md">
                    v1.0 DÜZENLİ
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Finansal borçlarınızı tekrarlardan arındırılmış, şablonlu, resmi bir özet denetim raporu haline getirebilir, anında PDF olarak indirebilir veya yazdırabilirsiniz.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {/* 1. PDF Olarak İndir Butonu */}
                <button
                  disabled={isGeneratingPdf}
                  onClick={async () => {
                    if (!isPremium) {
                      onUpgradeClick?.("PDF Denetim Raporu İndirme");
                      return;
                    }
                    setIsGeneratingPdf(true);
                    setReportStatusMessage({ type: "info", text: "PDF Denetim Raporu hazırlanıyor..." });

                    try {
                      const doc = new jsPDF({
                        orientation: "portrait",
                        unit: "mm",
                        format: "a4"
                      });

                      const docId = `BP-${Date.now().toString().slice(-6)}`;
                      const formatPdf = (val: number) => safePdfText(format(val));

                      // Header Background Banner
                      doc.setFillColor(30, 41, 59); // slate-800
                      doc.rect(0, 0, 210, 36, "F");

                      // Header Text
                      doc.setTextColor(255, 255, 255);
                      doc.setFont("Helvetica", "bold");
                      doc.setFontSize(15);
                      doc.text("BUTCEM PRO - RESMI FINANSAL DENETIM RAPORU", 15, 16);

                      doc.setFont("Helvetica", "normal");
                      doc.setFontSize(8);
                      doc.setTextColor(203, 213, 225);
                      doc.text(
                        safePdfText(`Belge Seri No: ${docId} | Olusturma Tarihi: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR")}`),
                        15,
                        25
                      );
                      doc.text(
                        safePdfText(`Kullanici: ${currentUser || "Yerel Profil"} | Durum: ONAYLI FINANSAL DOSYA`),
                        15,
                        31
                      );

                      // Section 1: Summary Cards
                      doc.setFontSize(11);
                      doc.setFont("Helvetica", "bold");
                      doc.setTextColor(15, 23, 42); // slate-900
                      doc.text(safePdfText("1. GENEL GOSTERGELER VE DETAYLI FINANSAL OZET"), 15, 48);

                      doc.setDrawColor(203, 213, 225);
                      doc.setLineWidth(0.4);
                      doc.line(15, 51, 195, 51);

                      // KPI Blocks (3 columns, 2 rows)
                      const kpis = [
                        { label: "AYLIK NET GELIR", val: formatPdf(monthlyIncome), color: [16, 185, 129] },
                        { label: "YILLIK GELIR (12 AY)", val: formatPdf(annualIncome), color: [16, 185, 129] },
                        { label: "AYLIK GIDER", val: formatPdf(monthlyExpense), color: [244, 63, 94] },
                        { label: "AYLIK NET BAKIYE", val: formatPdf(monthlyIncome - monthlyExpense), color: [14, 165, 233] },
                        { label: "BANKA & TAKSIT BORCU", val: formatPdf(bankAndInstallmentDebt), color: [245, 158, 11] },
                        { label: "SAGLIK SKORU", val: `${healthScore} / 100`, color: [99, 102, 241] }
                      ];

                      let currentY = 56;
                      for (let row = 0; row < 2; row++) {
                        for (let col = 0; col < 3; col++) {
                          const idx = row * 3 + col;
                          const item = kpis[idx];
                          const x = 15 + col * 62;
                          const y = currentY;

                          doc.setFillColor(248, 250, 252);
                          doc.rect(x, y, 58, 18, "F");
                          doc.setDrawColor(226, 232, 240);
                          doc.rect(x, y, 58, 18, "S");

                          doc.setFont("Helvetica", "bold");
                          doc.setFontSize(7);
                          doc.setTextColor(100, 116, 139);
                          doc.text(safePdfText(item.label), x + 4, y + 6);

                          doc.setFontSize(10);
                          doc.setTextColor(item.color[0], item.color[1], item.color[2]);
                          doc.text(item.val, x + 4, y + 13);
                        }
                        currentY += 22;
                      }

                      // Section 2: Banka veya Kredi Kartı Borçları
                      let tableY = currentY + 6;
                      doc.setFontSize(11);
                      doc.setFont("Helvetica", "bold");
                      doc.setTextColor(15, 23, 42);
                      doc.text(safePdfText(`2. BANKA VEYA KREDI KARTI BORCLARI (${cleanDebts.length} Kalem)`), 15, tableY);
                      doc.setDrawColor(203, 213, 225);
                      doc.line(15, tableY + 3, 195, tableY + 3);
                      tableY += 9;

                      if (cleanDebts.length === 0) {
                        doc.setFont("Helvetica", "italic");
                        doc.setFontSize(8.5);
                        doc.setTextColor(100, 116, 139);
                        doc.text(safePdfText("Kayitli aktif banka borcu bulunmuyor."), 15, tableY);
                        tableY += 8;
                      } else {
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(7.5);
                        doc.setFillColor(241, 245, 249);
                        doc.rect(15, tableY - 3.5, 180, 6.5, "F");
                        doc.setTextColor(71, 85, 105);
                        doc.text(safePdfText("Borc Adi / Kategori"), 18, tableY + 1);
                        doc.text(safePdfText("Durum"), 105, tableY + 1);
                        doc.text(safePdfText("Odenen / Kalan / Toplam"), 135, tableY + 1);
                        tableY += 8;

                        cleanDebts.forEach((d) => {
                          if (tableY > 265) {
                            doc.addPage();
                            tableY = 22;
                          }
                          const rem = Math.max(0, d.amount - d.paid);
                          const isPaid = rem === 0;

                          doc.setFont("Helvetica", "bold");
                          doc.setFontSize(8);
                          doc.setTextColor(30, 41, 59);
                          const nameStr = safePdfText(`${d.name} (${d.category || "Genel"})`);
                          doc.text(nameStr.length > 38 ? nameStr.slice(0, 36) + ".." : nameStr, 18, tableY);

                          doc.setFont("Helvetica", "normal");
                          doc.setFontSize(7.5);
                          if (isPaid) {
                            doc.setTextColor(16, 185, 129);
                            doc.text(safePdfText("ODENDI"), 105, tableY);
                          } else {
                            doc.setTextColor(239, 68, 68);
                            doc.text(safePdfText("AKTIF"), 105, tableY);
                          }

                          doc.setTextColor(51, 65, 85);
                          doc.text(
                            `${formatPdf(d.paid)} / ${formatPdf(rem)} / ${formatPdf(d.amount)}`,
                            135,
                            tableY
                          );

                          doc.setDrawColor(241, 245, 249);
                          doc.line(15, tableY + 2.5, 195, tableY + 2.5);
                          tableY += 6.5;
                        });
                      }

                      // Section 3: Taksitli Borçlar ve Krediler
                      tableY += 6;
                      if (tableY > 245) {
                        doc.addPage();
                        tableY = 22;
                      }
                      doc.setFontSize(11);
                      doc.setFont("Helvetica", "bold");
                      doc.setTextColor(15, 23, 42);
                      doc.text(safePdfText(`3. TAKSITLI BORCLAR VE KREDILER (${cleanInstallments.length} Kalem)`), 15, tableY);
                      doc.setDrawColor(203, 213, 225);
                      doc.line(15, tableY + 3, 195, tableY + 3);
                      tableY += 9;

                      if (cleanInstallments.length === 0) {
                        doc.setFont("Helvetica", "italic");
                        doc.setFontSize(8.5);
                        doc.setTextColor(100, 116, 139);
                        doc.text(safePdfText("Kayitli taksitli borc bulunmuyor."), 15, tableY);
                        tableY += 8;
                      } else {
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(7.5);
                        doc.setFillColor(241, 245, 249);
                        doc.rect(15, tableY - 3.5, 180, 6.5, "F");
                        doc.setTextColor(71, 85, 105);
                        doc.text(safePdfText("Taksit Adi"), 18, tableY + 1);
                        doc.text(safePdfText("Taksit Durumu"), 105, tableY + 1);
                        doc.text(safePdfText("Kalan Tutar / Toplam"), 140, tableY + 1);
                        tableY += 8;

                        cleanInstallments.forEach((inst) => {
                          if (tableY > 265) {
                            doc.addPage();
                            tableY = 22;
                          }
                          const monthly = inst.totalAmount / (inst.installmentCount || 1);
                          const paidVal = (inst.paidInstallmentCount || 0) * monthly;
                          const rem = Math.max(0, inst.totalAmount - paidVal);

                          doc.setFont("Helvetica", "bold");
                          doc.setFontSize(8);
                          doc.setTextColor(30, 41, 59);
                          const instName = safePdfText(inst.name);
                          doc.text(instName.length > 38 ? instName.slice(0, 36) + ".." : instName, 18, tableY);

                          doc.setFont("Helvetica", "normal");
                          doc.setFontSize(7.5);
                          doc.setTextColor(79, 70, 229);
                          doc.text(`${inst.paidInstallmentCount || 0}/${inst.installmentCount} Taksit`, 105, tableY);

                          doc.setTextColor(51, 65, 85);
                          doc.text(`${formatPdf(rem)} / ${formatPdf(inst.totalAmount)}`, 140, tableY);

                          doc.setDrawColor(241, 245, 249);
                          doc.line(15, tableY + 2.5, 195, tableY + 2.5);
                          tableY += 6.5;
                        });
                      }

                      // Section 4: Kişi Bazlı Borç ve Alacaklar
                      tableY += 6;
                      if (tableY > 245) {
                        doc.addPage();
                        tableY = 22;
                      }
                      doc.setFontSize(11);
                      doc.setFont("Helvetica", "bold");
                      doc.setTextColor(15, 23, 42);
                      doc.text(safePdfText(`4. KISI BAZLI BORC VE ALACAKLAR (CARI) (${cleanContactTxs.length} Islem)`), 15, tableY);
                      doc.setDrawColor(203, 213, 225);
                      doc.line(15, tableY + 3, 195, tableY + 3);
                      tableY += 9;

                      if (cleanContactTxs.length === 0) {
                        doc.setFont("Helvetica", "italic");
                        doc.setFontSize(8.5);
                        doc.setTextColor(100, 116, 139);
                        doc.text(safePdfText("Kayitli kisi borcu veya alacagi bulunmuyor."), 15, tableY);
                        tableY += 8;
                      } else {
                        cleanContactTxs.forEach((tx) => {
                          if (tableY > 265) {
                            doc.addPage();
                            tableY = 22;
                          }
                          const typeLabel = tx.type === "payable" ? "Borc (Verecek)" : "Alacak";
                          const statusLabel = tx.isPaid ? "Odendi" : "Bekliyor";

                          doc.setFont("Helvetica", "bold");
                          doc.setFontSize(8);
                          doc.setTextColor(30, 41, 59);
                          doc.text(safePdfText(`${tx.contactName} (${typeLabel})`), 18, tableY);

                          doc.setFont("Helvetica", "normal");
                          doc.setFontSize(7.5);
                          doc.setTextColor(tx.isPaid ? 16 : 245, tx.isPaid ? 185 : 158, tx.isPaid ? 129 : 11);
                          doc.text(safePdfText(statusLabel), 110, tableY);

                          doc.setFont("Helvetica", "bold");
                          doc.setTextColor(30, 41, 59);
                          doc.text(formatPdf(tx.amount), 150, tableY);

                          doc.setDrawColor(241, 245, 249);
                          doc.line(15, tableY + 2.5, 195, tableY + 2.5);
                          tableY += 6.5;
                        });
                      }

                      // Section 5: Asistan Strateji ve Değerlendirme
                      tableY += 6;
                      if (tableY > 230) {
                        doc.addPage();
                        tableY = 22;
                      }
                      doc.setFont("Helvetica", "bold");
                      doc.setFontSize(10.5);
                      doc.setTextColor(79, 70, 229);
                      doc.text(safePdfText("5. FINANSAL SAGLIK VE ASISTAN STRATEJISI"), 15, tableY);
                      doc.setDrawColor(203, 213, 225);
                      doc.line(15, tableY + 3, 195, tableY + 3);
                      tableY += 8;

                      doc.setFillColor(248, 250, 252);
                      doc.rect(15, tableY - 2, 180, 22, "F");
                      doc.setDrawColor(226, 232, 240);
                      doc.rect(15, tableY - 2, 180, 22, "S");

                      doc.setFont("Helvetica", "normal");
                      doc.setFontSize(8);
                      doc.setTextColor(51, 65, 85);
                      const splitAdvice = doc.splitTextToSize(safePdfText(advice.desc), 172);
                      doc.text(splitAdvice, 18, tableY + 4);

                      // Footnote
                      doc.setFontSize(7);
                      doc.setTextColor(148, 163, 184);
                      doc.text(
                        safePdfText("Butcem Pro Guvenli Finansal Takip Sistemi • Yerel ve Gizli Denetim Raporu"),
                        15,
                        285
                      );

                      const fileName = `Butcem_Pro_Denetim_Raporu_${docId}.pdf`;

                      // Universal robust PDF download across Android WebView, Capacitor and Web
                      await savePdfDocument(doc, fileName);

                      setReportStatusMessage({
                        type: "success",
                        text: `PDF Denetim Raporu (${fileName}) başarıyla hazırlandı ve indirildi!`
                      });
                    } catch (err: any) {
                      console.error("PDF generation error:", err);
                      setReportStatusMessage({
                        type: "error",
                        text: "PDF oluşturulurken bir hata meydana geldi: " + (err?.message || "Bilinmeyen hata")
                      });
                    } finally {
                      setIsGeneratingPdf(false);
                    }
                  }}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer active:scale-97 flex items-center gap-1.5 shadow-md border border-amber-400/30"
                >
                  <FileText className="w-4 h-4" />
                  {isGeneratingPdf ? "PDF Hazırlanıyor..." : "PDF Olarak İndir 📥"}
                  {!isPremium && (
                    <span className="ml-1 text-[8px] bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded font-black font-mono">
                      PRO
                    </span>
                  )}
                </button>

                {/* 2. Sistemden Yazdır Butonu */}
                <button
                  onClick={() => {
                    if (!isPremium) {
                      onUpgradeClick?.("Finansal Rapor Yazdırma");
                      return;
                    }
                    setReportStatusMessage({
                      type: "info",
                      text: "Yazdırma penceresi hazırlanıyor..."
                    });
                    setTimeout(() => {
                      try {
                        window.print();
                        setReportStatusMessage({
                          type: "success",
                          text: "Yazdırma penceresi açıldı. Raporu doğrudan yazıcıya gönderebilir veya PDF olarak kaydedebilirsiniz."
                        });
                      } catch (err) {
                        console.warn("Direct window.print failed:", err);
                        setReportStatusMessage({
                          type: "error",
                          text: "Yazdırma komutu açılamadı. Lütfen 'PDF Olarak İndir' butonunu kullanarak belgeyi edinin."
                        });
                      }
                    }, 150);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer active:scale-97 flex items-center gap-1.5 shadow-md border border-slate-700/40"
                >
                  <Printer className="w-4 h-4 text-emerald-400" /> Sistemden Yazdır 🖨️
                  {!isPremium && (
                    <span className="ml-1 text-[8px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black font-mono">
                      PRO
                    </span>
                  )}
                </button>

                {/* 3. Yıllık PDF Özeti Butonu */}
                <button
                  onClick={async () => {
                    if (!isPremium) {
                      onUpgradeClick?.("12 Aylık Yıllık PDF Özeti");
                      return;
                    }
                    try {
                      setReportStatusMessage({ type: "info", text: "Yıllık Finansal Özet PDF oluşturuluyor..." });
                      const curYear = new Date().getFullYear();
                      const res = await generateAnnualPdfReport({
                        year: curYear,
                        incomes,
                        expenses,
                        payments,
                        debts: cleanDebts,
                        installmentDebts: cleanInstallments,
                        currencySymbol: "₺",
                        language
                      });
                      if (res?.fileName) {
                        setReportStatusMessage({
                          type: "success",
                          text: `Yıllık Finansal Özet PDF (${res.fileName}) başarıyla indirildi!`
                        });
                      }
                    } catch (err: any) {
                      console.error("Annual PDF generation error:", err);
                      setReportStatusMessage({
                        type: "error",
                        text: "Yıllık PDF oluşturulurken hata oluştu: " + (err?.message || "Bilinmeyen hata")
                      });
                    }
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer active:scale-97 flex items-center gap-1.5 shadow-md border border-indigo-400/20"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" /> Yıllık PDF Özeti (Tek Tuş) ✨
                  {!isPremium && (
                    <span className="ml-1 text-[8px] bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded font-black font-mono">
                      PRO
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Print/Audit Report Sheet container */}
            <div id="financial-audit-report" className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-inner max-w-4xl mx-auto space-y-7 print:border-0 print:shadow-none print:p-0">
              
              {/* Header inside Statement document */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-slate-800 pb-6 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-indigo-600 text-white font-black text-[10px] rounded-lg tracking-wider uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> RESMİ DENETİM RAPORU
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      SERİ NO: BP-{Date.now().toString().slice(-6)}
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-2">
                    📊 BÜTÇEM PRO FİNANSAL BORÇ VE BÜTÇE DENETİM RAPORU
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                    Rapor Düzenleme Tarihi: {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="text-right sm:self-center">
                  <span className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 font-black text-[10px] rounded-xl tracking-widest uppercase border border-emerald-300/40 inline-flex items-center gap-1">
                    ✓ ONAYLI FİNANSAL DOSYA
                  </span>
                </div>
              </div>

              {/* Report Timeframe Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5 print:hidden">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bütçe Zaman Ölçeği:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {reportPeriodMode === "monthly" ? "(Aylık Nakit Akışı Esaslı)" : "(12 Aylık Yıllık Projeksiyon)"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setReportPeriodMode("monthly")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      reportPeriodMode === "monthly"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    📅 Aylık Bütçe Görünümü
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportPeriodMode("yearly")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      reportPeriodMode === "yearly"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    📆 Yıllık Bütçe Görünümü (12 Ay)
                  </button>
                </div>
              </div>

              {/* Data Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    {reportPeriodMode === "monthly" ? "Aylık Net Gelir" : "Yıllık Toplam Gelir"}
                  </span>
                  <strong className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {format(reportPeriodMode === "monthly" ? monthlyIncome : annualIncome)}
                  </strong>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    {reportPeriodMode === "monthly"
                      ? `Yıllık: ${format(annualIncome)}`
                      : `Aylık Ort: ${format(monthlyIncome)}`}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    {reportPeriodMode === "monthly" ? "Aylık Gider" : "Yıllık Gider"}
                  </span>
                  <strong className="text-xs sm:text-sm font-black text-rose-500 mt-1 block">
                    {format(reportPeriodMode === "monthly" ? monthlyExpense : annualExpense)}
                  </strong>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    {reportPeriodMode === "monthly"
                      ? `Yıllık: ${format(annualExpense)}`
                      : `Aylık Ort: ${format(monthlyExpense)}`}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    {reportPeriodMode === "monthly" ? "Aylık Net Tasarruf" : "Yıllık Net Bakiye"}
                  </span>
                  <strong className={`text-xs sm:text-sm font-black mt-1 block ${
                    (reportPeriodMode === "monthly" ? monthlyIncome - monthlyExpense : annualIncome - annualExpense) >= 0
                      ? "text-sky-600 dark:text-sky-400"
                      : "text-rose-500"
                  }`}>
                    {format(reportPeriodMode === "monthly" ? monthlyIncome - monthlyExpense : annualIncome - annualExpense)}
                  </strong>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    {(reportPeriodMode === "monthly" ? monthlyIncome - monthlyExpense : annualIncome - annualExpense) >= 0
                      ? "Pozitif Bakiye"
                      : "Bütçe Açığı"}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Banka Borçları</span>
                  <strong className="text-xs sm:text-sm font-black text-amber-500 mt-1 block">
                    {format(bankAndInstallmentDebt)}
                  </strong>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    Aylık Taksit: {format(totalMonthlyInstallmentLoad)}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kişi Borçları</span>
                  <strong className="text-xs sm:text-sm font-black text-red-500 dark:text-red-400 mt-1 block">
                    {format(contactPayablesRemaining)}
                  </strong>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    Alacak: {format(contactReceivablesRemaining)}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Sağlık Skoru</span>
                  <strong className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {healthScore} / 100
                  </strong>
                  <span className="text-[9px] text-indigo-500 font-bold block mt-0.5">
                    {advice.badge}
                  </span>
                </div>
              </div>

              {/* In-Report Interactive Filter & Layout Controls */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 print:hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  {/* Status Filters */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-indigo-500" /> Durum:
                    </span>
                    <button
                      type="button"
                      onClick={() => setReportDebtFilter("all")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                        reportDebtFilter === "all"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                      }`}
                    >
                      Tüm Kayıtlar ({cleanDebts.length + cleanInstallments.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportDebtFilter("active")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 ${
                        reportDebtFilter === "active"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-400 inline-block animate-pulse"></span>
                      Yalnızca Kalan / Aktif
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportDebtFilter("paid")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 ${
                        reportDebtFilter === "paid"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50"
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Ödenenler
                    </button>
                  </div>

                  {/* Grouping Mode Switch */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setReportGroupingMode("by_month")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        reportGroupingMode === "by_month"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <CalendarDays className="w-3 h-3" /> Aylara Göre Sıralı
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportGroupingMode("by_category")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                        reportGroupingMode === "by_category"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Layers className="w-3 h-3" /> Kategoriye Göre
                    </button>
                  </div>
                </div>

                {/* If by_month mode, show Month quick picker pills */}
                {reportGroupingMode === "by_month" && monthlyDebtGroups.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-200/50 dark:border-slate-800/60 pb-1 scrollbar-none">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
                      Ay Filtresi:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedReportMonth("all")}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition cursor-pointer ${
                        selectedReportMonth === "all"
                          ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                      }`}
                    >
                      Tüm Aylar ({monthlyDebtGroups.length})
                    </button>
                    {monthlyDebtGroups.map((g) => (
                      <button
                        key={g.monthKey}
                        type="button"
                        onClick={() => setSelectedReportMonth(g.monthKey)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                          selectedReportMonth === g.monthKey
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                        }`}
                      >
                        {g.monthName}
                        {g.isCurrentMonth && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* AYLARA GÖRE BÖLÜMLENDİRİLMİŞ BORÇ LİSTESİ */}
              {reportGroupingMode === "by_month" && (
                <div className="space-y-6">
                  {monthlyDebtGroups
                    .filter((g) => selectedReportMonth === "all" || g.monthKey === selectedReportMonth)
                    .map((group) => {
                      const filteredItems = group.items.filter((item) => {
                        if (reportDebtFilter === "active") return !item.isPaid;
                        if (reportDebtFilter === "paid") return item.isPaid;
                        return true;
                      });

                      const groupTotal = filteredItems.reduce((s, it) => s + it.amount, 0);
                      const groupRemaining = filteredItems.reduce((s, it) => s + it.remaining, 0);
                      const groupPaid = filteredItems.reduce((s, it) => s + it.paid, 0);

                      return (
                        <div
                          key={group.monthKey}
                          className="bg-slate-50/70 dark:bg-slate-950/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3"
                        >
                          {/* Month Group Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                            <div className="flex items-center gap-2">
                              <CalendarRange className="w-4 h-4 text-indigo-500" />
                              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                                {group.monthName}
                                {group.isCurrentMonth && (
                                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider">
                                    🎯 BU AY
                                  </span>
                                )}
                              </h3>
                              <span className="px-2 py-0.5 bg-slate-200/60 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-md">
                                {filteredItems.length} Kalem
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                              <span className="text-slate-500">
                                Bu Ay Toplam: <b className="text-slate-800 dark:text-slate-200 font-black">{format(groupTotal)}</b>
                              </span>
                              <span className="text-rose-500 font-bold">
                                Kalan: <b className="font-black">{format(groupRemaining)}</b>
                              </span>
                              {groupPaid > 0 && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  Ödenen: {format(groupPaid)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Month Table */}
                          {filteredItems.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400 italic">
                              Bu ay için seçilen filtreye uygun borç kaydı bulunmamaktadır.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black">
                                  <tr>
                                    <th className="p-3">Borç / Kurum Adı</th>
                                    <th className="p-3">Türü & Kategori</th>
                                    <th className="p-3">Vade Günü</th>
                                    <th className="p-3">Durum</th>
                                    <th className="p-3 text-right">Ödenen</th>
                                    <th className="p-3 text-right">Kalan</th>
                                    <th className="p-3 text-right">Aylık Tutar</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                                  {filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                                      <td className="p-3">
                                        <div className="font-bold text-slate-900 dark:text-slate-100">
                                          {item.name}
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          item.type === "Taksit"
                                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400"
                                            : item.type === "Kişi Borcu"
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                                            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                                        }`}>
                                          {item.type}
                                        </span>
                                      </td>
                                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                                        {item.dueDate ? `${item.dueDate}` : `${item.day}. Gün`}
                                      </td>
                                      <td className="p-3">
                                        {item.isPaid ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                                            <Check className="w-2.5 h-2.5" /> ÖDENDİ
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                                            Ödeme Bekliyor
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                        {format(item.paid)}
                                      </td>
                                      <td className="p-3 text-right font-mono font-bold text-rose-500">
                                        {format(item.remaining)}
                                      </td>
                                      <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">
                                        {format(item.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {monthlyDebtGroups.length === 0 && (
                    <div className="p-8 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-400 italic">
                        Kayıtlı aktif borç veya taksit bulunmamaktadır.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* KATEGORİYE GÖRE BORÇ LİSTESİ */}
              {reportGroupingMode === "by_category" && (
                <>

              {/* 1. BANKA VEYA KREDİ KARTI BORÇLARI (Tekrarlardan Arındırılmış) */}
              <div className="space-y-3">
                {(() => {
                  const filteredDebts = cleanDebts.filter((d) => {
                    const rem = Math.max(0, d.amount - d.paid);
                    if (reportDebtFilter === "active") return rem > 0;
                    if (reportDebtFilter === "paid") return rem === 0;
                    return true;
                  });

                  const totalFilteredRem = filteredDebts.reduce((sum, d) => sum + Math.max(0, d.amount - d.paid), 0);
                  const totalFilteredAmount = filteredDebts.reduce((sum, d) => sum + d.amount, 0);

                  return (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                            💳 1. BANKA VEYA KREDİ KARTI BORÇLARI
                          </h3>
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-md">
                            {filteredDebts.length} Kalem
                          </span>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                          Kalan Borç: <span className="text-rose-600 dark:text-rose-400 font-black">{format(totalFilteredRem)}</span> / Toplam: <span className="text-slate-800 dark:text-slate-200 font-black">{format(totalFilteredAmount)}</span>
                        </div>
                      </div>

                      {filteredDebts.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                          <p className="text-xs text-slate-400 italic">
                            {reportDebtFilter === "active"
                              ? "Harika! Aktif ödenmemiş banka veya kredi kartı borcu kalmamıştır."
                              : "Bu filtreye uygun kayıtlı banka veya kredi kartı borcu bulunmamaktadır."}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black">
                              <tr>
                                <th className="p-3">Borç / Kurum Adı</th>
                                <th className="p-3">Kategori & Vade</th>
                                <th className="p-3">Durum</th>
                                <th className="p-3 text-right">Ödenen Tutar</th>
                                <th className="p-3 text-right">Kalan Borç</th>
                                <th className="p-3 text-right">Toplam Tutar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                              {filteredDebts.map((d) => {
                                const remaining = Math.max(0, d.amount - d.paid);
                                const isPaid = remaining === 0;
                                const percentPaid = d.amount > 0 ? Math.min(100, Math.round((d.paid / d.amount) * 100)) : 100;

                                return (
                                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                                    <td className="p-3">
                                      <div className="font-bold text-slate-900 dark:text-slate-100">
                                        {d.name}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded text-slate-600 dark:text-slate-400">
                                        {d.category || "Genel"}
                                      </span>
                                      {d.dueDate && (
                                        <span className="block text-[10px] text-slate-400 mt-0.5">
                                          Vade: {d.dueDate}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      {isPaid ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                                          <Check className="w-2.5 h-2.5" /> ÖDENDİ
                                        </span>
                                      ) : (
                                        <div className="space-y-1">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                                            Ödeniyor (%{percentPaid})
                                          </span>
                                          <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
                                            <div
                                              className="bg-emerald-500 h-1 rounded-full"
                                              style={{ width: `${percentPaid}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                      {format(d.paid)}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-rose-500">
                                      {format(remaining)}
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-200">
                                      {format(d.amount)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* 2. TAKSİTLİ BORÇLAR & KREDİLER (Tekrarlardan Arındırılmış) */}
              <div className="space-y-3">
                {(() => {
                  const filteredInstallments = cleanInstallments.filter((inst) => {
                    const monthly = inst.totalAmount / (inst.installmentCount || 1);
                    const paidVal = (inst.paidInstallmentCount || 0) * monthly;
                    const rem = Math.max(0, inst.totalAmount - paidVal);
                    if (reportDebtFilter === "active") return rem > 0;
                    if (reportDebtFilter === "paid") return rem === 0;
                    return true;
                  });

                  const totalFilteredRem = filteredInstallments.reduce((sum, inst) => {
                    const monthly = inst.totalAmount / (inst.installmentCount || 1);
                    const paidVal = (inst.paidInstallmentCount || 0) * monthly;
                    return sum + Math.max(0, inst.totalAmount - paidVal);
                  }, 0);
                  const totalFilteredAmount = filteredInstallments.reduce((sum, inst) => sum + inst.totalAmount, 0);

                  return (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                            🗓️ 2. TAKSİTLİ BORÇLAR & KREDİLER
                          </h3>
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-md">
                            {filteredInstallments.length} Kalem
                          </span>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                          Kalan Tutar: <span className="text-amber-500 font-black">{format(totalFilteredRem)}</span> / Toplam: <span className="text-slate-800 dark:text-slate-200 font-black">{format(totalFilteredAmount)}</span>
                        </div>
                      </div>

                      {filteredInstallments.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                          <p className="text-xs text-slate-400 italic">
                            {reportDebtFilter === "active"
                              ? "Harika! Aktif ödenmemiş taksitli borç veya kredi kalemi bulunmamaktadır."
                              : "Kayıtlı taksitli borç veya kredi kalemi bulunmamaktadır."}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black">
                              <tr>
                                <th className="p-3">Taksitli Borç Adı</th>
                                <th className="p-3">Taksit İlerlemesi</th>
                                <th className="p-3">Durum</th>
                                <th className="p-3 text-right">Aylık Taksit</th>
                                <th className="p-3 text-right">Kalan Borç</th>
                                <th className="p-3 text-right">Toplam Tutar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                              {filteredInstallments.map((inst) => {
                                const count = inst.installmentCount || 1;
                                const paidCount = inst.paidInstallmentCount || 0;
                                const monthly = inst.totalAmount / count;
                                const paidValue = paidCount * monthly;
                                const remaining = Math.max(0, inst.totalAmount - paidValue);
                                const isComplete = paidCount >= count || remaining === 0;

                                return (
                                  <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                                    <td className="p-3">
                                      <div className="font-bold text-slate-900 dark:text-slate-100">
                                        {inst.name}
                                      </div>
                                      {inst.firstDueDate && (
                                        <span className="text-[10px] text-slate-400">
                                          Başlangıç: {inst.firstDueDate}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold block">
                                        {paidCount} / {count} Taksit
                                      </span>
                                      <div className="w-20 bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden mt-1">
                                        <div
                                          className="bg-indigo-500 h-1 rounded-full"
                                          style={{ width: `${Math.min(100, Math.round((paidCount / count) * 100))}%` }}
                                        />
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      {isComplete ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                                          ✓ TAMAMLANDI
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                                          Devam Ediyor
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                      {format(monthly)}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-amber-500">
                                      {format(remaining)}
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-200">
                                      {format(inst.totalAmount)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* 3. KİŞİ BAZLI BORÇ VE ALACAKLAR (CARİ) */}
              <div className="space-y-3">
                {(() => {
                  const filteredContactTxs = cleanContactTxs.filter((tx) => {
                    if (reportDebtFilter === "active") return !tx.isPaid;
                    if (reportDebtFilter === "paid") return tx.isPaid;
                    return true;
                  });

                  return (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                            👥 3. KİŞİ BAZLI BORÇ VE ALACAKLAR (CARİ)
                          </h3>
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-md">
                            {filteredContactTxs.length} İşlem
                          </span>
                        </div>
                      </div>

                      {filteredContactTxs.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                          <p className="text-xs text-slate-400 italic">Kayıtlı kişi borç veya alacak kaydı bulunmamaktadır.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black">
                              <tr>
                                <th className="p-3">Kişi Adı</th>
                                <th className="p-3">İşlem Türü</th>
                                <th className="p-3">Durum</th>
                                <th className="p-3 text-right">Tutar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                              {filteredContactTxs.map((tx) => (
                                <tr key={tx.id || `${tx.contactName}_${tx.amount}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                                  <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                                    {tx.contactName}
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      tx.type === "payable" 
                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                                        : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400"
                                    }`}>
                                      {tx.type === "payable" ? "Kişiye Borç (Verecek)" : "Kişiden Alacak"}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    {tx.isPaid ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Tamamlandı
                                      </span>
                                    ) : (
                                      <span className="text-amber-500 font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Ödeme Bekliyor
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">
                                    {format(tx.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              </>
              )}

              {/* 4. BAŞ ASİSTAN STRATEJİ VE ANALİZ KARARI */}
              <div className="space-y-2 p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  🧠 4. BAŞ ASİSTAN STRATEJİ VE ANALİZ KARARI
                </h3>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                  {advice.desc}
                </p>
                <p className="text-[10px] text-slate-400 pt-1 font-medium">
                  • Öneri: Yüksek faizli borçları öncelikle sıfırlamak (Kartopu Yöntemi) ve asgari ödeme üzerindeki tasarruf birikimlerini doğrudan ana para ödemelerine aktarmak bütçe sağlığını en hızlı yükseltecek stratejidir.
                </p>
              </div>

              {/* Footer Stamp / Seal */}
              <div className="text-center pt-6 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-bold space-y-1">
                <p>⚠️ Bütçem Pro akıllı denetim yazılımı tarafından otomatik mühürlüdür.</p>
                <p className="text-[9px] font-normal">Bu veri tablosu tamamen kişisel gizlilik standartlarına uygun olarak tarayıcınızda yerel olarak derlenmiştir ve 3. şahıslara sızdırılmaz.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sponsor / Google AdMob Banner section for visitors and free users */}
      <AdMobBanner unitType="banner" className="my-4" />
    </div>
  );
}

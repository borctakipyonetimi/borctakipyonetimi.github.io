import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Gauge,
  PiggyBank,
  TrendingUp,
  Coins,
  FileText,
  Printer,
  ChevronRight,
  TrendingDown,
  DollarSign,
  CalendarRange,
  Plus,
  Trash2,
  Calculator,
  Info,
  Check,
  AlertCircle,
  HelpCircle,
  Activity,
  ArrowRight,
  BadgePercent
} from "lucide-react";
import { Debt, Income, Expense, InstallmentDebt } from "../types";
import { jsPDF } from "jspdf";
import { t } from "../utils/translations";

interface FinancialToolsProps {
  debts: Debt[];
  incomes: Income[];
  expenses: Expense[];
  installmentDebts: InstallmentDebt[];
  currentUser: string | null;
  format: (val: number) => string;
  language?: "tr" | "en";
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
}

export function FinancialTools({
  debts,
  incomes,
  expenses,
  installmentDebts,
  currentUser,
  format,
  language = "tr"
}: FinancialToolsProps) {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const [activeSubTab, setActiveSubTab] = useState<"health" | "savings" | "calendar" | "report">("health");

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

  // Savings inputs
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalCat, setNewGoalCat] = useState("emergency");
  const [goalAddAmounts, setGoalAddAmounts] = useState<Record<string, string>>({});

  // Exchange calculation states
  const usdRate = 32.48;
  const eurRate = 35.12;
  const goldRate = 2465.00; // Gram Gold
  const [pegCalculatorInput, setPegCalculatorInput] = useState<string>("10000");
  const [pegCalculatorResult, setPegCalculatorResult] = useState({ usd: 0, eur: 0, gold: 0 });

  useEffect(() => {
    const val = Number(pegCalculatorInput) || 0;
    setPegCalculatorResult({
      usd: val / usdRate,
      eur: val / eurRate,
      gold: val / goldRate
    });
  }, [pegCalculatorInput]);

  // Financial metrics calculations
  const totalIncomesSum = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const totalExpensesSum = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  // Calculate remaining debt
  const simpleUnpaidDebt = debts.reduce((sum, d) => sum + (d.amount - d.paid), 0);
  const installmentUnpaidDebt = installmentDebts.reduce((sum, inst) => {
    const monthly = inst.totalAmount / inst.installmentCount;
    const paidValue = inst.paidInstallmentCount * monthly;
    return sum + (inst.totalAmount - paidValue);
  }, 0);
  const grandTotalRemainingDebt = simpleUnpaidDebt + installmentUnpaidDebt;

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

  // Calendar due dates mapping
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Highlight days helper
  const getDebtsOnDay = (dayNum: number) => {
    const paddedDay = dayNum.toString().padStart(2, "0");
    const formattedMonth = currentMonth.toString().padStart(2, "0");
    const targetDateStr = `${currentYear}-${formattedMonth}-${paddedDay}`;

    const matchedDebts: { name: string; amount: number; type: string }[] = [];

    // Check simple debts
    debts.forEach(d => {
      if (d.dueDate === targetDateStr) {
        matchedDebts.push({ name: d.name, amount: d.amount - d.paid, type: "Borç" });
      }
    });

    // Check installment debts (just comparing the day part for simplicity since it repeats monthly)
    installmentDebts.forEach(inst => {
      try {
        const dayPart = inst.firstDueDate.split("-")[2];
        if (dayPart === paddedDay) {
          const monthly = inst.totalAmount / inst.installmentCount;
          matchedDebts.push({ name: `${inst.name} (Taksit)`, amount: monthly, type: "Taksit" });
        }
      } catch {}
    });

    return matchedDebts;
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="z-10 w-full text-center md:text-left">
          <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
            Premium Akıllı Modüller
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1">
            Bütçenizin sürdürülebilirliğini ölçümleyin, birikim havuzları dizayn edin, risk analiz raporlarını inceleyin.
          </p>
        </div>

        {/* Action button mock */}
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl z-10 w-full md:w-auto overflow-x-auto scrollbar-none border border-slate-200/50 dark:border-slate-800/80">
          <button
            onClick={() => setActiveSubTab("health")}
            className={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
              activeSubTab === "health"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Gauge className="w-3.5 h-3.5" /> Bütçe Sağlığı
          </button>
          <button
            onClick={() => setActiveSubTab("savings")}
            className={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
              activeSubTab === "savings"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" /> Kumbara
          </button>

          <button
            onClick={() => setActiveSubTab("calendar")}
            className={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
              activeSubTab === "calendar"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" /> Ödeme Takvimi
          </button>
          <button
            onClick={() => setActiveSubTab("report")}
            className={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
              activeSubTab === "report"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Rapor Al
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
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                    AYLIK BORÇ VADE MATRİSİ
                  </h3>
                </div>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-600 dark:text-slate-450 px-2.5 py-1 rounded-xl uppercase">
                  HAZİRAN 2026
                </span>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 text-center">
                {/* Days of week */}
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map(day => (
                  <span key={day} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {day}
                  </span>
                ))}

                {/* Days matrix of the active month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const matchedItems = getDebtsOnDay(dayNum);
                  const hasDebt = matchedItems.length > 0;
                  const isSelected = selectedDayTab === dayNum;

                  return (
                    <button
                      key={dayNum}
                      onClick={() => setSelectedDayTab(dayNum)}
                      className={`h-11 sm:h-12 relative rounded-xl font-mono text-[11px] font-black cursor-pointer transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                          : hasDebt
                          ? "bg-rose-500/10 text-rose-500 border border-semibold border-rose-500/20 hover:bg-rose-500/20"
                          : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <span>{dayNum}</span>
                      
                      {/* Debt alert indicator dots */}
                      {hasDebt && !isSelected && (
                        <span className="absolute bottom-1 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Agenda Side panel */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">GÜNLÜK VADE DETAYI</span>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight mt-0.5">
                    {selectedDayTab ? `${selectedDayTab} Haziran 2026 Ajandası` : "Gün Seçiniz"}
                  </h3>
                </div>

                {selectedDayTab ? (
                  <div className="space-y-2.5">
                    {getDebtsOnDay(selectedDayTab).length === 0 ? (
                      <div className="p-5 text-center space-y-2 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                        <Check className="w-8 h-8 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-full mx-auto" />
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350">
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
                          className="p-3 bg-rose-500/5 dark:bg-rose-950/10 border-l-[3px] border-rose-500 rounded-xl flex justify-between items-center"
                        >
                          <div>
                            <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 text-[8px] font-bold rounded">
                              {item.type}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white mt-1">
                              {item.name}
                            </h4>
                          </div>
                          <strong className="text-xs font-black text-rose-500">
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

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850 text-[10px] text-slate-400 font-semibold leading-normal mt-4">
                ℹ️ Ödeme günü takipleri, borç oluştururken girdiğiniz vadeleri ve taksitli borç başlangıç tarihlerini referans almaktadır.
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
                /* Hide everything by default on the printed page */
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
                  padding: 1.5rem !important;
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
              }
            ` }} />

            {/* Control Panel Block */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                  RAPOR HAZIRLAYICI VE DENETİM PANELİ
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Finansal kayıtlarınızı temiz, şablonlu, resmi bir özet rapor haline getirerek yazdırabilir ya da PDF formatında kaydedebilirsiniz.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => {
                    const doc = new jsPDF();
                    
                    // safe Turkish text converter for standard fonts
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

                    // Header Background Banner
                    doc.setFillColor(30, 41, 59); // slate-800
                    doc.rect(0, 0, 210, 35, "F");

                    // Header Text
                    doc.setTextColor(255, 255, 255);
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(16);
                    doc.text("Butcem Pro - Resmi Finansal Denetim Raporu", 15, 18);

                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(226, 232, 240);
                    const docId = `BP-${Date.now().toString().slice(-6)}`;
                    doc.text(`Belge Seri No: ${docId} | Olusturma Tarihi: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR")}`, 15, 27);

                    // Section 1: Summary Cards
                    doc.setFontSize(11);
                    doc.setFont("Helvetica", "bold");
                    doc.setTextColor(15, 23, 42); // slate-900
                    doc.text(safeText("1. GÖSTERGE VE DETAYLI FİNANSAL ÖZET"), 15, 50);

                    // separator
                    doc.setDrawColor(203, 213, 225);
                    doc.setLineWidth(0.5);
                    doc.line(15, 53, 195, 53);

                    // KPI Blocks
                    let blockY = 58;
                    // Left Box
                    doc.setFillColor(248, 250, 252); // slate-50
                    doc.rect(15, blockY, 85, 25, "F");
                    doc.setDrawColor(226, 232, 240);
                    doc.rect(15, blockY, 85, 25, "S");
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(safeText("TOPLAM GELİR AKIŞI"), 20, blockY + 8);
                    doc.setFontSize(11);
                    doc.setTextColor(16, 185, 129); // emerald-500
                    doc.text(format(totalIncomesSum), 20, blockY + 18);

                    // Right Box
                    doc.setFillColor(248, 250, 252); // slate-50
                    doc.rect(110, blockY, 85, 25, "F");
                    doc.rect(110, blockY, 85, 25, "S");
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(safeText("TOPLAM HARCAMALAR"), 115, blockY + 8);
                    doc.setFontSize(11);
                    doc.setTextColor(244, 63, 94); // rose-500
                    doc.text(format(totalExpensesSum), 115, blockY + 18);

                    blockY += 30;

                    // Left Box 2
                    doc.setFillColor(248, 250, 252); // slate-50
                    doc.rect(15, blockY, 85, 25, "F");
                    doc.rect(15, blockY, 85, 25, "S");
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(safeText("KALAN BORÇ PORTFÖYÜ"), 20, blockY + 8);
                    doc.setFontSize(11);
                    doc.setTextColor(249, 115, 22); // orange-500
                    doc.text(format(grandTotalRemainingDebt), 20, blockY + 18);

                    // Right Box 2
                    doc.setFillColor(248, 250, 252); // slate-50
                    doc.rect(110, blockY, 85, 25, "F");
                    doc.rect(110, blockY, 85, 25, "S");
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(safeText("BÜTÇE SAĞLIK SKORU"), 115, blockY + 8);
                    doc.setFontSize(11);
                    doc.setTextColor(79, 70, 229); // indigo-600
                    doc.text(`${healthScore} / 100`, 115, blockY + 18);

                    // Section 2: Active Debts Breakdown
                    let tableY = blockY + 38;
                    doc.setFontSize(11);
                    doc.setFont("Helvetica", "bold");
                    doc.setTextColor(15, 23, 42); // slate-900
                    doc.text(safeText("2. KALAN AKTİF BORÇLAR DÖKÜMÜ"), 15, tableY);

                    // separator
                    doc.setDrawColor(203, 213, 225);
                    doc.line(15, tableY + 3, 195, tableY + 3);

                    tableY += 10;
                    
                    // check if debts list empty
                    if (debts.length === 0 && installmentDebts.length === 0) {
                      doc.setFont("Helvetica", "italic");
                      doc.setFontSize(9);
                      doc.setTextColor(100, 116, 139);
                      doc.text(safeText("Kayıtlı aktif borç veya taksitli borç tespit edilmedi."), 15, tableY);
                      tableY += 8;
                    } else {
                      doc.setFont("Helvetica", "bold");
                      doc.setFontSize(9);
                      doc.setFillColor(241, 245, 249);
                      doc.rect(15, tableY - 4, 180, 7, "F");
                      doc.setTextColor(71, 85, 105);
                      doc.text(safeText("Borç Adı & Detayı"), 18, tableY + 1);
                      doc.text(safeText("Kalan Tutar / Toplam Tutar"), 120, tableY + 1);
                      tableY += 10;

                      debts.forEach(d => {
                        if (tableY > 265) {
                          doc.addPage();
                          tableY = 25;
                        }
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(9);
                        doc.setTextColor(30, 41, 59);
                        doc.text(safeText(`${d.name} (${d.category})`), 18, tableY);
                        doc.setFont("Helvetica", "normal");
                        doc.text(`Kalan: ${format(d.amount - d.paid)} / Toplam: ${format(d.amount)}`, 120, tableY);
                        doc.setDrawColor(241, 245, 249);
                        doc.line(15, tableY + 3, 195, tableY + 3);
                        tableY += 8;
                      });

                      installmentDebts.forEach(inst => {
                        if (tableY > 265) {
                          doc.addPage();
                          tableY = 25;
                        }
                        const monthly = inst.totalAmount / inst.installmentCount;
                        const paidValue = inst.paidInstallmentCount * monthly;
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(9);
                        doc.setTextColor(30, 41, 59);
                        doc.text(safeText(`${inst.name} (Taksitli Borç)`), 18, tableY);
                        doc.setFont("Helvetica", "normal");
                        doc.text(`Kalan: ${format(inst.totalAmount - paidValue)} / Toplam: ${format(inst.totalAmount)}`, 120, tableY);
                        doc.setDrawColor(241, 245, 249);
                        doc.line(15, tableY + 3, 195, tableY + 3);
                        tableY += 8;
                      });
                    }

                    // Section 3: AI Assistant Strategy
                    tableY += 5;
                    if (tableY > 240) {
                      doc.addPage();
                      tableY = 25;
                    }

                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(11);
                    doc.setTextColor(79, 70, 229); // indigo-600
                    doc.text(safeText("3. ASİSTAN STRATEJİ KARARI"), 15, tableY);
                    // separator
                    doc.setDrawColor(203, 213, 225);
                    doc.line(15, tableY + 3, 195, tableY + 3);

                    tableY += 10;
                    doc.setFillColor(243, 244, 246); // gray-100
                    doc.rect(15, tableY - 4, 180, 25, "F");
                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(55, 65, 81); // gray-700
                    
                    const splitAdvice = doc.splitTextToSize(safeText(advice.desc), 170);
                    doc.text(splitAdvice, 18, tableY + 2);

                    // Footnote
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text(safeText("Bu veri tablosu tamamen kişisel gizlilik standartlarına uygun olarak derlenmiştir."), 15, 285);

                    doc.save(`Butcem_Pro_Finansal_Rapor_${docId}.pdf`);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition cursor-pointer active:scale-97 flex items-center gap-1.5 shadow-md border border-amber-400/20"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF Olarak İndir 📥
                </button>

                <button
                  onClick={() => {
                    const reportHtml = document.getElementById("financial-audit-report")?.innerHTML;
                    if (!reportHtml) {
                      alert("Rapor içeriği bulunamadı.");
                      return;
                    }
                    
                    const html = `
                      <html>
                        <head>
                          <title>Bütçem Pro Raporu</title>
                          <style>
                            body { font-family: sans-serif; padding: 25px; color: #1e293b; background: #fff; }
                            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 18px; }
                            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
                            .p-4 { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; }
                            .flex { display: flex; justify-content: space-between; align-items: center; }
                            .border-b { border-bottom: 1px solid #e2e8f0; }
                            .pb-1\\.5 { padding-bottom: 6px; }
                            .py-1 { padding-top: 4px; padding-bottom: 4px; }
                            .pb-6 { padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
                            .text-xs { font-size: 12px; }
                            .text-[10px] { font-size: 10px; }
                            .font-mono { font-family: monospace; }
                            .space-y-2 > * { margin-bottom: 6px; }
                            .space-y-3 > * { margin-bottom: 8px; }
                            .space-y-8 > * { margin-bottom: 20px; }
                            .bg-slate-50 { background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 12px; border-radius: 8px; }
                            .text-emerald-600 { color: #059669; }
                            .text-rose-500 { color: #f43f5e; }
                            .text-orange-500 { color: #f97316; }
                            .text-indigo-600 { color: #4f46e5; }
                            .text-center { text-align: center; }
                            .pt-6 { padding-top: 16px; margin-top: 16px; border-top: 1px solid #e2e8f0; }
                            .text-slate-400 { color: #94a3b8; }
                            .font-black { font-weight: 800; }
                            .font-bold { font-weight: 700; }
                            .font-semibold { font-weight: 600; }
                            .block { display: block; }
                            .mt-1 { margin-top: 4px; }
                            .uppercase { text-transform: uppercase; }
                            .justify-between { justify-content: space-between; }
                            .text-rose-600 { color: #dc2626; }
                          </style>
                        </head>
                        <body>
                          <div style="max-width: 800px; margin: 0 auto;">
                            ${reportHtml}
                          </div>
                        </body>
                      </html>
                    `;

                    const printFrame = document.createElement("iframe");
                    printFrame.style.position = "fixed";
                    printFrame.style.right = "0";
                    printFrame.style.bottom = "0";
                    printFrame.style.width = "0";
                    printFrame.style.height = "0";
                    printFrame.style.border = "0";
                    document.body.appendChild(printFrame);

                    const printDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
                    if (printDoc) {
                      printDoc.write(html);
                      printDoc.close();
                      setTimeout(() => {
                        try {
                          printFrame.contentWindow?.focus();
                          printFrame.contentWindow?.print();
                        } catch (e) {
                          console.error("Iframe native print failed:", e);
                        }
                        setTimeout(() => {
                          document.body.removeChild(printFrame);
                        }, 1500);
                      }, 500);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer active:scale-97 flex items-center gap-1.5 shadow-md border border-indigo-400/20"
                >
                  <Printer className="w-3.5 h-3.5" /> Sistemden Yazdır 🖨️
                </button>
              </div>
            </div>

            {/* Print/Audit Report Sheet container styled to look extremely clean and official */}
            <div id="financial-audit-report" className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-inner max-w-4xl mx-auto space-y-8 print:border-0 print:shadow-none print:p-0">
              {/* Header inside Statement document */}
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    📊 BÜTÇEM PRO RESMİ BORÇ VE BÜTÇE DENETİM RAPORU
                  </h1>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider font-mono">
                    Belge Seri: BP-{Date.now().toString().slice(-6)} | Tarih: {new Date().toLocaleDateString("tr-TR")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-black text-[9px] rounded-lg tracking-widest uppercase">
                    AKTİF GÜNCEL DOSYA
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-405 font-medium mt-1">
                    Gelişmiş Biyometrik Finansal Profil
                  </p>
                </div>
              </div>

              {/* Data Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Toplam Gelir Akışı</span>
                  <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {format(totalIncomesSum)}
                  </strong>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Toplam Harcamalar</span>
                  <strong className="text-sm font-black text-rose-500 mt-1 block">
                    {format(totalExpensesSum)}
                  </strong>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kalan Borç Portföyü</span>
                  <strong className="text-sm font-black text-orange-500 mt-1 block">
                    {format(grandTotalRemainingDebt)}
                  </strong>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bütçe Sağlık Skoru</span>
                  <strong className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {healthScore} / 100
                  </strong>
                </div>
              </div>

              {/* Active Debts Detail Sheet */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  1. KALAN AKTİF BORÇLAR dökümü
                </h3>
                {debts.length === 0 && installmentDebts.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Kayıtlı aktif borç veya taksitli borç tespit edilmedi.</p>
                ) : (
                  <div className="space-y-2">
                    {debts.map(d => (
                      <div key={d.id} className="flex justify-between text-xs font-semibold py-1 border-b border-dashed border-slate-100 dark:border-slate-800/60 pb-1.5">
                        <span className="text-slate-700 dark:text-slate-300 font-bold">{d.name} ({d.category})</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">Kalan: {format(d.amount - d.paid)} / Toplam: {format(d.amount)}</span>
                      </div>
                    ))}
                    {installmentDebts.map(inst => {
                      const monthly = inst.totalAmount / inst.installmentCount;
                      const paidValue = inst.paidInstallmentCount * monthly;
                      return (
                        <div key={inst.id} className="flex justify-between text-xs font-semibold py-1 border-b border-dashed border-slate-100 dark:border-slate-800/60 pb-1.5">
                          <span className="text-slate-700 dark:text-slate-300 font-bold">{inst.name} (Taksitli Borç)</span>
                          <span className="font-mono text-slate-600 dark:text-slate-400">Kalan: {format(inst.totalAmount - paidValue)} / Toplam: {format(inst.totalAmount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Strategy & Advice Summary section */}
              <div className="space-y-2 p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/20">
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  2. BAŞ ASİSTAN STRATEJİ KARARI
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                  {advice.desc}
                </p>
                <div className="flex gap-4 text-[10px] text-slate-400 block pt-1 bg-transparent font-medium">
                  <span>• Öneri: Borçların sıfırlanmasında Kartopu Yöntemi ve asgari ödeme fazlası tasarrufların doğrudan aktarımı planlanmıştır.</span>
                </div>
              </div>

              {/* Disclaimer / footer of print */}
              <div className="text-center pt-6 border-t border-slate-250 dark:border-slate-800 text-[9px] text-slate-400 font-bold">
                ⚠️ Bütçem Pro akıllı denetim yazılımı tarafından otomatik mühürlüdür. Bu veri tablosu tamamen kişisel gizlilik standartlarına uygun olarak tarayıcınızda yerel olarak derlenmiştir ve 3. şahıslara sızdırılmaz.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

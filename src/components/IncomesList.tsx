/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { PlusCircle, Trash2, Edit, PiggyBank, Calendar, DollarSign, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { Income } from "../types";
import { DoughnutChart, LineChart } from "./BudgetCharts";
import { useCurrency } from "../utils/CurrencyContext";
import { t } from "../utils/translations";

import { PeriodFilter } from "./PeriodFilter";

interface IncomesListProps {
  incomes: Income[];
  onSaveIncome: (income: Partial<Income>) => void;
  onDeleteIncome: (id: number) => void;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
  carryOverBalance?: number;
  language?: "tr" | "en";
  selectedMonth: number | null;
  selectedYear: number | null;
  setSelectedMonth: (month: number | null) => void;
  setSelectedYear: (year: number | null) => void;
}

export const IncomesList: React.FC<IncomesListProps> = ({
  incomes,
  onSaveIncome,
  onDeleteIncome,
  isPremium = false,
  onUpgradeClick,
  carryOverBalance,
  language = "tr",
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const { format, currencySymbol } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Gelir Ekle");

  useEffect(() => {
    if (localStorage.getItem("auto_open_add_income") === "true") {
      localStorage.removeItem("auto_open_add_income");
      handleOpenAdd();
    }
  }, []);
  const [incomeId, setIncomeId] = useState<number | undefined>(undefined);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [isRecurring, setIsRecurring] = useState<boolean>(true);
  const [incomeAlarm, setIncomeAlarm] = useState(false);

  const handleOpenAdd = () => {
    setModalTitle("Gelir Ekle");
    setIncomeId(undefined);
    setName("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setIsRecurring(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (inc: Income) => {
    setModalTitle("Gelir Düzenle");
    setIncomeId(inc.id);
    setName(inc.name);
    setAmount(inc.amount.toString());
    setDate(inc.date ? inc.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setIsRecurring(inc.isRecurring !== false);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (!name.trim()) {
      alert("Lütfen gelir adını girin.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Lütfen geçerli bir gelir tutarı girin.");
      return;
    }

    onSaveIncome({
      id: incomeId,
      name: name.trim(),
      amount: parsedAmount,
      date: date || new Date().toISOString(),
      isRecurring,
    });
    setIsModalOpen(false);
  };

  const totalIncomes = incomes.reduce((s, i) => s + i.amount, 0);

  // Formatting colors for doughnut items
  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];
  const doughnutData = incomes.map((i, idx) => ({
    label: i.name,
    value: i.amount,
    color: colors[idx % colors.length],
  }));

  // Historical sorted trends
  const trendSorted = [...incomes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const trendLabels = trendSorted.map(t => t.name);
  const trendValues = trendSorted.map(t => t.amount);

  return (
    <div className="space-y-6">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <PiggyBank className="w-7 h-7 text-emerald-500 animate-pulse" /> GELİRLER
        </motion.h2>
        <div className="w-16 h-1 bg-emerald-500 rounded-full mt-2 opacity-80" />
      </div>

      <PeriodFilter
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        setSelectedMonth={setSelectedMonth}
        setSelectedYear={setSelectedYear}
        themeColor="green"
      />

      <div className="flex items-center justify-center">
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" /> Gelir Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300 rounded-2xl flex items-center justify-between font-bold text-xs border border-emerald-100/30">
          <span>Aylık Toplam Gelir Kazancı:</span>
          <span className="text-base text-emerald-600 dark:text-emerald-400 font-mono">{format(totalIncomes)}</span>
        </div>
        {carryOverBalance !== undefined && carryOverBalance !== 0 && (
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-300 rounded-2xl flex items-center justify-between font-bold text-xs border border-indigo-100/30">
            <span>Önceki Aydan Devreden Nakit:</span>
            <span className="text-base text-indigo-600 dark:text-indigo-400 font-mono">{format(carryOverBalance)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Listing */}
        <div className="space-y-3 lg:col-span-7">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Gelir Kayıtları</h4>
          {incomes.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 font-medium">
              Henüz bir gelir kaydı bulunmuyor.
            </div>
          ) : (
            incomes.map((i) => (
              <div
                key={i.id}
                className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center justify-between transition hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{i.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <p className="text-[10px] text-slate-400 flex items-center gap-0.5 font-medium">
                        <Calendar className="w-3 h-3" /> {new Date(i.date).toLocaleDateString("tr-TR")}
                      </p>
                      <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-md uppercase tracking-wider ${
                        i.isRecurring !== false 
                          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 border border-indigo-500/10" 
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-500/10"
                      }`}>
                        {i.isRecurring !== false ? "🔄 Sabit" : "✨ Ek Gelir"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                    {format(i.amount)}
                  </span>
                  <div className="flex items-center">
                    <button
                      onClick={() => handleOpenEdit(i)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded-lg transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteIncome(i.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Side: Visual Graphs */}
        <div className="space-y-6 lg:col-span-5">
          {incomes.length > 0 && (
            <>
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide text-center">Gelir Dağılım Grafiği</h4>
                <DoughnutChart data={doughnutData} type="income" />
              </div>

              {trendValues.length > 1 && (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide text-center">Gelir Eğilim Çizgisi</h4>
                  <LineChart labels={trendLabels} values={trendValues} lineColor="#10b981" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Gelir Sayfası Sponsorlu Reklamı - Vadeli Mevduat/Kazanım */}
      {!isPremium && (
        <div className="mt-6 p-4 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/20 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xl shrink-0">
              💰
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider rounded-md border border-emerald-500/20">
                  Birikim Fırsatı
                </span>
                <span className="text-[9px] text-slate-400 font-bold">
                  • Garanti BBVA E-Vadeli Hesap
                </span>
              </div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                Gelirlerinizi Boşta Tutmayın! %48.5 En Yüksek Tanışma Faizi Garanti'de! 💎
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">
                Garanti BBVA Mobil'den hemen hesap açın, birikimlerinizi yüksek e-vadeli faiz oranları ile anında büyüterek risksiz kazanın.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <a
              href="https://www.garantibbva.com.tr"
              target="_blank"
              rel="noreferrer referrer"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl transition shadow-xs cursor-pointer uppercase tracking-wider text-center flex-1 sm:flex-none"
            >
              Yüksek Faiz Al
            </a>
            <button
              onClick={onUpgradeClick}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-500 text-[10px] font-black rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1 uppercase tracking-tight shrink-0 flex-1 sm:flex-none"
            >
              Yükselt
            </button>
          </div>
        </div>
      )}

      {/* Income Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h4 className="text-base font-bold flex items-center gap-1.5 border-b pb-2 dark:border-slate-700">
              <DollarSign className="w-5 h-5 text-emerald-500" /> {modalTitle}
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">GELİR BAŞLIĞI</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maaş, prim, kira geliri vb."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">GELİR MİKTARI</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="₺15000"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">TAHSİLAT TARİHİ</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-200 dark:border-slate-700 accent-emerald-500 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="isRecurring" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  Sabit Gelir (Her Ay Otomatik Devretsin)
                </label>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="incomeAlarmOpt"
                  checked={isPremium && incomeAlarm}
                  onChange={(e) => {
                    if (!isPremium) {
                      onUpgradeClick?.();
                    } else {
                      setIncomeAlarm(e.target.checked);
                    }
                  }}
                  onClick={(e) => {
                    if (!isPremium) {
                      e.preventDefault();
                      onUpgradeClick?.();
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 border-slate-200 dark:border-slate-700 accent-indigo-505 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="incomeAlarmOpt" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none flex items-center gap-1">
                  Gelir Tahsilat Alarmı Kur {!isPremium && <span className="text-[7px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black">PRO</span>}
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

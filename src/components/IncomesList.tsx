/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  PlusCircle,
  Trash2,
  Edit,
  PiggyBank,
  Calendar,
  DollarSign,
  Wallet,
  Save,
  Download,
  Upload,
  FolderInput,
  Folder,
  Copy,
  CheckCircle2,
  X,
  Sparkles,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { motion } from "motion/react";
import { Income } from "../types";
import { DoughnutChart, LineChart } from "./BudgetCharts";
import { useCurrency } from "../utils/CurrencyContext";
import { t } from "../utils/translations";
import { PeriodFilter } from "./PeriodFilter";

interface IncomesListProps {
  incomes: Income[];
  allIncomes?: Income[];
  onSaveIncome: (income: Partial<Income>) => void;
  onDeleteIncome: (id: number) => void;
  onRestoreIncomes?: (newIncomes: Income[], mode?: "replace" | "merge", targetMonth?: number | null, targetYear?: number | null) => void;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
  carryOverBalance?: number;
  language?: "tr" | "en";
  selectedMonth: number | null;
  selectedYear: number | null;
  setSelectedMonth: (month: number | null) => void;
  setSelectedYear: (year: number | null) => void;
}

interface IncomeTemplate {
  id: string;
  name: string;
  date: string;
  count: number;
  totalAmount: number;
  incomes: Income[];
}

export const IncomesList: React.FC<IncomesListProps> = ({
  incomes,
  allIncomes = [],
  onSaveIncome,
  onDeleteIncome,
  onRestoreIncomes,
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

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Gelir Ekle");

  // Save Template Modal
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [templateSourceScope, setTemplateSourceScope] = useState<"current_month" | "all">("current_month");

  // Load Template Modal
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In-App Saved Named Templates
  const [namedTemplates, setNamedTemplates] = useState<IncomeTemplate[]>(() => {
    try {
      const saved = localStorage.getItem("user_named_income_templates");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const MONTH_NAMES = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  const selectedMonthVal = selectedMonth !== null ? selectedMonth : new Date().getMonth();
  const selectedYearVal = selectedYear !== null ? selectedYear : new Date().getFullYear();

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

  // Get incomes to be saved into template
  const getSourceIncomesForTemplate = () => {
    if (templateSourceScope === "all") {
      return allIncomes.length > 0 ? allIncomes : incomes;
    }
    return incomes;
  };

  const handleOpenSaveTemplateModal = () => {
    const defaultName = `Gelir_Sablonu_${MONTH_NAMES[selectedMonthVal]}_${selectedYearVal}`;
    setSaveTemplateName(defaultName);
    setTemplateSourceScope("current_month");
    setIsSaveTemplateModalOpen(true);
  };

  // Execute saving template
  const executeSaveTemplate = async (method: "file_picker" | "download" | "copy" | "in_app") => {
    if (!isPremium) {
      onUpgradeClick?.();
      return;
    }

    const targetIncomes = getSourceIncomesForTemplate();
    if (targetIncomes.length === 0) {
      alert("Kaydedilecek herhangi bir gelir bulunamadı!");
      return;
    }

    let cleanName = (saveTemplateName.trim() || `Gelir_Sablonu_${MONTH_NAMES[selectedMonthVal]}_${selectedYearVal}`).replace(/\.json$/i, "");
    const fileName = `${cleanName}.json`;

    const exportPayload = {
      type: "income_template",
      templateName: cleanName,
      createdAt: new Date().toISOString(),
      count: targetIncomes.length,
      totalAmount: targetIncomes.reduce((s, i) => s + (Number(i.amount) || 0), 0),
      incomes: targetIncomes,
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });

    if (method === "in_app") {
      const newT: IncomeTemplate = {
        id: "inc_tpl_" + Date.now(),
        name: cleanName,
        date: new Date().toLocaleDateString("tr-TR"),
        count: targetIncomes.length,
        totalAmount: exportPayload.totalAmount,
        incomes: targetIncomes,
      };
      const updated = [newT, ...namedTemplates.filter((t) => t.name !== cleanName)];
      setNamedTemplates(updated);
      try {
        localStorage.setItem("user_named_income_templates", JSON.stringify(updated));
      } catch (err) {
        console.warn("Could not save to localStorage:", err);
      }
      alert(`✅ '${cleanName}' isimli gelir şablonu başarıyla hafızaya kaydedildi!`);
      setIsSaveTemplateModalOpen(false);
      return;
    }

    if (method === "copy") {
      try {
        await navigator.clipboard.writeText(jsonString);
        alert("✅ Gelir şablon verisi panoya kopyalandı!");
        setIsSaveTemplateModalOpen(false);
      } catch {
        alert("❌ Panoya kopyalama başarısız oldu.");
      }
      return;
    }

    if (method === "file_picker") {
      // 1. Check Android / Mobile Web Share API for saving to Drive, Files, WhatsApp, etc.
      try {
        const testFile = new File([blob], fileName, { type: "application/json" });
        if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [testFile] })) {
          await navigator.share({
            title: "Gelir Şablonu",
            text: `Bütçem Gelir Şablonu (${fileName})`,
            files: [testFile],
          });
          alert(`✅ '${fileName}' gelir şablonu seçilen konuma / uygulamaya başarıyla iletildi!`);
          setIsSaveTemplateModalOpen(false);
          return;
        }
      } catch (shareErr: any) {
        if (shareErr.name === "AbortError") return;
        console.warn("Share bypassed, falling back:", shareErr);
      }

      // 1b. Desktop File System Access API
      const isMobileDevice = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile|wv/i.test(navigator.userAgent);
      if (!isMobileDevice && typeof window !== "undefined" && "showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: "JSON Gelir Şablon Dosyası",
                accept: { "application/json": [".json"] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(jsonString);
          await writable.close();
          alert(`✅ Gelir şablonu seçtiğiniz konuma başarıyla kaydedildi: ${fileName}`);
          setIsSaveTemplateModalOpen(false);
          return;
        } catch (err: any) {
          if (err.name === "AbortError") return;
          console.warn("showSaveFilePicker failed:", err);
        }
      }
    }

    // Direct clean download
    try {
      const localUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = localUrl;
      link.setAttribute("download", fileName);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(localUrl);
      }, 800);
      alert(`✅ Gelir Şablonu '${fileName}' adıyla İndirilenler klasörünüze başarıyla kaydedildi!`);
      setIsSaveTemplateModalOpen(false);
    } catch (e) {
      alert("İndirme sırasında bir hata oluştu.");
    }
  };

  // Process imported items into current list
  const handleImportIncomesData = (incomingIncomes: any[]) => {
    if (!Array.isArray(incomingIncomes) || incomingIncomes.length === 0) {
      alert("Yüklenecek geçerli bir gelir kaydı bulunamadı.");
      return;
    }

    const sanitized: Income[] = incomingIncomes
      .filter((i) => i && (i.name || i.amount))
      .map((i, idx) => ({
        id: i.id || Date.now() + idx,
        name: String(i.name || "Gelir").trim(),
        amount: Number(i.amount) || 0,
        date: i.date || new Date().toISOString().slice(0, 10),
        isRecurring: i.isRecurring !== false,
      }));

    if (onRestoreIncomes) {
      onRestoreIncomes(sanitized, restoreMode, selectedMonth, selectedYear);
    } else {
      sanitized.forEach((item) => onSaveIncome(item));
    }
    setIsLoadTemplateModalOpen(false);
  };

  // Handle file select from disk
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        const incoming = parsed.incomes || (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(incoming) && incoming.length > 0) {
          handleImportIncomesData(incoming);
        } else {
          alert("Seçilen dosya içerisinde gelir verisi bulunamadı!");
        }
      } catch (err) {
        alert("Dosya okunamadı veya geçersiz bir JSON formatı.");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };

  const handleDeleteNamedTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = namedTemplates.filter((t) => t.id !== id);
    setNamedTemplates(updated);
    try {
      localStorage.setItem("user_named_income_templates", JSON.stringify(updated));
    } catch {}
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
  const trendLabels = trendSorted.map((t) => t.name);
  const trendValues = trendSorted.map((t) => t.amount);

  return (
    <div className="space-y-6">
      {/* Hidden File Input for loading template */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileInputChange}
      />

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

      {/* Action Header: Add Income, Save/Export Income Template, Load Template */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" /> Gelir Ekle
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!isPremium) {
                onUpgradeClick?.();
                return;
              }
              handleOpenSaveTemplateModal();
            }}
            className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            title="Gelirleri dosyaya veya şablona kaydet"
          >
            <Save className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Gelirleri Kaydet / Şablon Sakla</span>
            {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-slate-950 px-1 py-0.5 rounded-sm font-black font-mono">PRO</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPremium) {
                onUpgradeClick?.();
                return;
              }
              setIsLoadTemplateModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            title="Kayıtlı gelir şablonu veya dosyadan gelirleri aktar"
          >
            <FolderInput className="w-3.5 h-3.5 text-indigo-500" />
            <span>Şablondan / Dosyadan Yükle</span>
            {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-slate-950 px-1 py-0.5 rounded-sm font-black font-mono">PRO</span>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300 rounded-2xl flex items-center justify-between font-bold text-xs border border-emerald-100/30">
          <span>Aylık Toplam Gelir Kazancı ({MONTH_NAMES[selectedMonthVal]} {selectedYearVal}):</span>
          <span className="text-base text-emerald-600 dark:text-emerald-400 font-mono">{format(totalIncomes)}</span>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Listing */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              Gelir Kayıtları ({incomes.length} Adet)
            </h4>
          </div>

          {incomes.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mx-auto text-xl">
                💰
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Seçili dönemde ({MONTH_NAMES[selectedMonthVal]} {selectedYearVal}) henüz bir gelir kaydı bulunmuyor.
              </p>
              <div className="flex justify-center gap-2 pt-1">
                <button
                  onClick={handleOpenAdd}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  + Yeni Gelir Ekle
                </button>
                {namedTemplates.length > 0 && (
                  <button
                    onClick={() => setIsLoadTemplateModalOpen(true)}
                    className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Şablondan Doldur
                  </button>
                )}
              </div>
            </div>
          ) : (
            incomes.map((i) => (
              <div
                key={i.id}
                className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center justify-between transition hover:shadow-md"
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
                      <span
                        className={`px-1.5 py-0.5 text-[8px] font-black rounded-md uppercase tracking-wider ${
                          i.isRecurring !== false
                            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 border border-indigo-500/10"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-500/10"
                        }`}
                      >
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
                      className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded-lg transition cursor-pointer"
                      title="Düzenle"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteIncome(i.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-lg transition cursor-pointer"
                      title="Sil"
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
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide text-center">
                  Gelir Dağılım Grafiği
                </h4>
                <DoughnutChart data={doughnutData} type="income" />
              </div>

              {trendValues.length > 1 && (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide text-center">
                    Gelir Eğilim Çizgisi
                  </h4>
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
                <span className="text-[9px] text-slate-400 font-bold">• Garanti BBVA E-Vadeli Hesap</span>
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
                  autoFocus
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
                  className="w-4 h-4 text-indigo-600 border-slate-200 dark:border-slate-700 accent-indigo-500 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="incomeAlarmOpt" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none flex items-center gap-1">
                  Gelir Tahsilat Alarmı Kur {!isPremium && <span className="text-[7px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black">PRO</span>}
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Income Template Modal */}
      {isSaveTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Gelirleri Şablon Olarak Kaydet</h3>
                  <p className="text-xs text-slate-500 font-medium">İsim vererek dosya veya hafızaya kaydedin</p>
                </div>
              </div>
              <button
                onClick={() => setIsSaveTemplateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                ŞABLON / DOSYA ADI
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  placeholder="Gelir_Sablonu_2026"
                  className="w-full pl-3.5 pr-16 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  autoFocus
                />
                <span className="absolute right-3 text-[10px] font-black font-mono text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-md uppercase">
                  .json
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                💡 Şablonunuza istediğiniz ismi vererek cihazınızda dilediğiniz konuma veya uygulama içi hafızaya kaydedebilirsiniz.
              </p>
            </div>

            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setTemplateSourceScope("current_month")}
                className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                  templateSourceScope === "current_month"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Seçili Ay ({incomes.length} Gelir)
              </button>
              <button
                type="button"
                onClick={() => setTemplateSourceScope("all")}
                className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                  templateSourceScope === "all"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Tüm Gelirler ({allIncomes.length || incomes.length})
              </button>
            </div>

            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span>Kaydedilecek Gelir Sayısı & Toplamı:</span>
              <span className="font-extrabold">
                {getSourceIncomesForTemplate().length} Adet • {format(getSourceIncomesForTemplate().reduce((s, i) => s + i.amount, 0))}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeSaveTemplate("file_picker")}
                className="w-full p-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-bold text-xs flex items-center justify-between shadow-md shadow-emerald-600/20 transition active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <Folder className="w-4 h-4 text-emerald-200" />
                  <div>
                    <div className="font-extrabold">📁 Konum Seç / Paylaş (Drive & Dosyalarım)</div>
                    <div className="text-[10px] text-emerald-200 font-normal">Android Dosyalarım, Google Drive veya klasör seçimi</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-emerald-200" />
              </button>

              <button
                type="button"
                onClick={() => executeSaveTemplate("in_app")}
                className="w-full p-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 rounded-2xl font-bold text-xs flex items-center justify-between transition active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <FolderInput className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <div className="font-extrabold">💾 Uygulama İçi Şablon Listesine Kaydet</div>
                    <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-normal">Dosya indirmeden uygulama hafızasında saklar</div>
                  </div>
                </div>
                <Save className="w-4 h-4 text-indigo-500" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => executeSaveTemplate("download")}
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Hızlı İndir (.json)
                </button>
                <button
                  type="button"
                  onClick={() => executeSaveTemplate("copy")}
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-500" /> JSON Kopyala
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSaveTemplateModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Income Load / Template Manager Modal */}
      {isLoadTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <FolderInput className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Gelir Şablonu / Dosyadan Yükle</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Hedef Dönem: <span className="font-bold text-emerald-600 dark:text-emerald-400">{MONTH_NAMES[selectedMonthVal]} {selectedYearVal}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLoadTemplateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Düzenli gelirlerinizi her ay tek tek girmek yerine kayıtlı şablonlarınızdan veya dosyanızdan <strong>{MONTH_NAMES[selectedMonthVal]} {selectedYearVal}</strong> dönemine tek tıkla aktarabilirsiniz.
            </p>

            {/* Restore Mode Switch */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setRestoreMode("merge")}
                className={`flex-1 py-1.5 font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                  restoreMode === "merge"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" /> Üzerine Ekle (Koru)
              </button>
              <button
                type="button"
                onClick={() => setRestoreMode("replace")}
                className={`flex-1 py-1.5 font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                  restoreMode === "replace"
                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Listeyi Değiştir (Sıfırla)
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {/* In-app saved templates */}
              {namedTemplates.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    KAYITLI GELİR ŞABLONLARINIZ ({namedTemplates.length})
                  </div>
                  <div className="space-y-2">
                    {namedTemplates.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {t.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{t.date}</span>
                            <span>•</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{t.count} Gelir</span>
                            <span>•</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{format(t.totalAmount || 0)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleImportIncomesData(t.incomes)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                          >
                            Bu Aya Yükle
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNamedTemplate(t.id, e)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-lg transition cursor-pointer"
                            title="Şablonu Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Load from File Section */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 transition active:scale-[0.99] cursor-pointer"
                >
                  <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                  <div className="text-center">
                    <span className="font-extrabold text-xs block">📂 Cihazdan / Klasörden Gelir Dosyası (.json) Seç</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                      Önceden indirdiğiniz veya yedeklediğiniz gelir JSON dosyasını içeri aktarır
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLoadTemplateModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

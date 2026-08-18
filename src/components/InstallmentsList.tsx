/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { PlusCircle, CalendarDays, Wallet, Edit, Trash2, Calendar, RotateCcw, Printer, FileText, Download, Upload, Save, Folder, FileJson, CheckCircle2, Copy, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { InstallmentDebt } from "../types";
import { useCurrency } from "../utils/CurrencyContext";
import { AdMobBanner } from "./AdMobBanner";
import { InstallmentsPortalChart } from "./BudgetCharts";
import { t } from "../utils/translations";
import { jsPDF } from "jspdf";

interface InstallmentsListProps {
  installmentDebts: InstallmentDebt[];
  onSaveInstallment: (inst: Partial<InstallmentDebt>) => void;
  onDeleteInstallment: (id: number) => void;
  onPayInstallment: (id: number, paymentDate?: string) => void;
  onRevertPayment?: (id: number) => void;
  onRestoreInstallments?: (installments: InstallmentDebt[], mode: "replace" | "merge") => void;
  isPremium?: boolean;
  language?: "tr" | "en";
  onUpgradeClick?: () => void;
  focusedInstallmentId?: number | null;
  setFocusedInstallmentId?: (id: number | null) => void;
}

export const InstallmentsList: React.FC<InstallmentsListProps> = ({
  installmentDebts,
  onSaveInstallment,
  onDeleteInstallment,
  onPayInstallment,
  onRevertPayment,
  onRestoreInstallments,
  isPremium = false,
  language = "tr",
  onUpgradeClick,
  focusedInstallmentId,
  setFocusedInstallmentId,
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const { format } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Yeni Taksitli Borç Planı");
  const [instId, setInstId] = useState<number | undefined>(undefined);
  const [name, setName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");
  const [paidInstallmentCount, setPaidInstallmentCount] = useState("0");
  const [firstDueDate, setFirstDueDate] = useState("");

  // Export & Import / Backup & Restore States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "merge">("merge");
  const [importedPreviewList, setImportedPreviewList] = useState<InstallmentDebt[] | null>(null);
  const [importError, setImportError] = useState<string>("");
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // State for Installment Payment Modal with Date Picker
  const [payModalInst, setPayModalInst] = useState<InstallmentDebt | null>(null);
  const [payDate, setPayDate] = useState<string>("");

  const handleOpenPayModal = (inst: InstallmentDebt) => {
    setPayModalInst(inst);
    let defaultDate = new Date().toISOString().slice(0, 10);
    if (inst.firstDueDate) {
      try {
        const parts = inst.firstDueDate.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1 + inst.paidInstallmentCount;
          const day = parseInt(parts[2], 10);
          const targetDate = new Date(year, month, day);
          const yStr = targetDate.getFullYear();
          const mStr = String(targetDate.getMonth() + 1).padStart(2, "0");
          const dStr = String(targetDate.getDate()).padStart(2, "0");
          defaultDate = `${yStr}-${mStr}-${dStr}`;
        }
      } catch {}
    }
    setPayDate(defaultDate);
  };

  const handleConfirmPayment = () => {
    if (!payModalInst) return;
    onPayInstallment(payModalInst.id, payDate || new Date().toISOString().slice(0, 10));
    setPayModalInst(null);
  };

  // --- TAKSİT DIŞA VE İÇE AKTARMA (YEDEKLEME & GERİ YÜKLEME) ---
  const handleOpenExportModal = () => {
    if (installmentDebts.length === 0) {
      alert("Dışa aktarılacak taksitli borç planı bulunmuyor.");
      return;
    }
    setExportFileName(`Taksitli_Borclar_${new Date().toISOString().slice(0, 10)}`);
    setIsExportModalOpen(true);
  };

  const executeExportInstallments = async (pickFolder: boolean = false) => {
    if (installmentDebts.length === 0) return;
    const jsonString = JSON.stringify(installmentDebts, null, 2);
    let rawName = (exportFileName || `Taksitli_Borclar_${new Date().toISOString().slice(0, 10)}`).trim();
    if (!rawName) rawName = `Taksitli_Borclar_${new Date().toISOString().slice(0, 10)}`;
    const baseName = rawName.replace(/\.json$/i, "");
    const fileName = `${baseName}.json`;

    if (pickFolder) {
      if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: "JSON Taksitli Borçlar Dosyası",
              accept: { "application/json": [".json"] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(jsonString);
          await writable.close();
          alert(`✅ '${fileName}' taksit yedeği başarıyla seçtiğiniz konuma kaydedildi!`);
          setIsExportModalOpen(false);
          return;
        } catch (err: any) {
          if (err.name === "AbortError") return;
          console.warn("showSaveFilePicker error:", err);
          alert(`💡 Tarayıcı güvenlik kısıtlaması nedeniyle doğrudan klasör seçilemedi, dosya '${fileName}' adıyla İndirilenler klasörünüze kaydediliyor...`);
        }
      } else {
        alert(`💡 Cihazınızda doğrudan konum seçimi desteklenmediğinden dosya '${fileName}' adıyla İndirilenler klasörünüze kaydediliyor...`);
      }
    }

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 300);

    alert(`✅ ${installmentDebts.length} adet taksit planı '${fileName}' olarak indirildi!`);
    setIsExportModalOpen(false);
  };

  const handleOpenImportModal = () => {
    setImportedPreviewList(null);
    setImportError("");
    setIsImportModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = JSON.parse(content);
        let list: any[] = [];
        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (parsed && Array.isArray(parsed.installmentDebts)) {
          list = parsed.installmentDebts;
        } else if (parsed && Array.isArray(parsed.installments)) {
          list = parsed.installments;
        } else {
          throw new Error("Dosya içinde geçerli taksitli borç listesi bulunamadı.");
        }

        const validList: InstallmentDebt[] = list.filter((i) => i && i.name && i.totalAmount).map((item, idx) => ({
          id: item.id || Date.now() + idx,
          name: String(item.name).trim(),
          totalAmount: Number(item.totalAmount) || 0,
          installmentCount: Number(item.installmentCount) || 1,
          paidInstallmentCount: Math.min(Number(item.installmentCount) || 1, Math.max(0, Number(item.paidInstallmentCount) || 0)),
          firstDueDate: item.firstDueDate || new Date().toISOString().slice(0, 10),
        }));

        if (validList.length === 0) {
          throw new Error("Dosyada geçerli taksit planı bulunamadı.");
        }

        setImportedPreviewList(validList);
        setImportError("");
      } catch (err: any) {
        setImportError(err.message || "JSON dosyası okunamadı veya hatalı formatta.");
        setImportedPreviewList(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestoreInstallments = () => {
    if (!importedPreviewList || importedPreviewList.length === 0) return;
    if (onRestoreInstallments) {
      onRestoreInstallments(importedPreviewList, importMode);
      setIsImportModalOpen(false);
      setImportedPreviewList(null);
    } else {
      alert("Geri yükleme işlemi gerçekleştirilemedi.");
    }
  };

  const formatNumberWithDots = (val: string): string => {
    const cleaned = val.replace(/\D/g, "");
    if (!cleaned) return "";
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumberFromDots = (val: string): number => {
    const cleaned = val.replace(/\./g, "");
    return parseFloat(cleaned) || 0;
  };

  const handleOpenAdd = () => {
    setModalTitle("Yeni Taksitli Borç Planı");
    setInstId(undefined);
    setName("");
    setTotalAmount("");
    setInstallmentCount("");
    setPaidInstallmentCount("0");
    setFirstDueDate(new Date().toISOString().slice(0, 10));
    setIsModalOpen(true);
  };

  const handleOpenEdit = (inst: InstallmentDebt) => {
    setModalTitle("Taksitli Borç Düzenle");
    setInstId(inst.id);
    setName(inst.name);
    setTotalAmount(formatNumberWithDots(inst.totalAmount.toString()));
    setInstallmentCount(inst.installmentCount.toString());
    setPaidInstallmentCount(inst.paidInstallmentCount.toString());
    setFirstDueDate(inst.firstDueDate ? inst.firstDueDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (focusedInstallmentId) {
      const inst = installmentDebts.find((x) => x.id === focusedInstallmentId);
      if (inst) {
        handleOpenEdit(inst);
        setTimeout(() => {
          const el = document.getElementById(`installment-card-${focusedInstallmentId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-4", "ring-indigo-500", "scale-[1.03]");
            setTimeout(() => {
              el.classList.remove("ring-4", "ring-indigo-500", "scale-[1.03]");
            }, 3000);
          }
        }, 400);
      }
      if (setFocusedInstallmentId) {
        setFocusedInstallmentId(null);
      }
    }
  }, [focusedInstallmentId, installmentDebts, setFocusedInstallmentId]);

  const handleSave = () => {
    const parsedTotal = parseNumberFromDots(totalAmount);
    const parsedCount = parseInt(installmentCount);
    const parsedPaid = parseInt(paidInstallmentCount) || 0;

    if (!name.trim()) {
      alert("Lütfen borç planı adını belirtin.");
      return;
    }
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      alert("Lütfen toplam borç tutarını geçerli girin.");
      return;
    }
    if (isNaN(parsedCount) || parsedCount <= 0) {
      alert("Lütfen geçerli taksit sayısını belirtin.");
      return;
    }
    if (parsedPaid < 0 || parsedPaid > parsedCount) {
      alert("Ödenen taksit adedi geçerli aralıkta olmalıdır (0 ile taksit adedi arası).");
      return;
    }

    onSaveInstallment({
      id: instId,
      name: name.trim(),
      totalAmount: parsedTotal,
      installmentCount: parsedCount,
      paidInstallmentCount: parsedPaid,
      firstDueDate: firstDueDate || new Date().toISOString().slice(0, 10),
    });
    setIsModalOpen(false);
  };

  const currentMonthDue = installmentDebts.reduce((sum, inst) => {
    if (inst.paidInstallmentCount >= inst.installmentCount) return sum;
    return sum + (inst.totalAmount / inst.installmentCount);
  }, 0);

  const totalRemaining = installmentDebts.reduce((sum, inst) => {
    const single = inst.totalAmount / inst.installmentCount;
    return sum + (inst.installmentCount - inst.paidInstallmentCount) * single;
  }, 0);

  const handlePrint = (isPdf = false) => {
    if (installmentDebts.length === 0) {
      alert("Yazdırılacak taksit kaydı bulunamadı.");
      return;
    }

    if (isPdf) {
      const doc = new jsPDF();
      const safeText = (text: string) => {
        if (!text) return "";
        const map: { [key: string]: string } = {
          'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
          'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
        };
        return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, (match) => map[match] || match);
      };

      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 32, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Butcem Pro - Taksitli Borc Raporu", 15, 18);
      doc.setFontSize(9);
      doc.text(`Tarih: ${new Date().toLocaleDateString("tr-TR")}`, 15, 26);

      let yPos = 45;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(safeText("Aktif Taksit Planları Listesi"), 15, yPos);
      doc.line(15, yPos + 3, 195, yPos + 3);
      yPos += 12;

      doc.setFillColor(241, 245, 249);
      doc.rect(15, yPos - 5, 180, 8, "F");
      doc.setFontSize(9);
      doc.text(safeText("Plan Adı"), 18, yPos);
      doc.text(safeText("Tutar"), 80, yPos);
      doc.text(safeText("Taksit"), 120, yPos);
      doc.text(safeText("Kalan"), 160, yPos);
      yPos += 10;

      installmentDebts.forEach((inst) => {
        if (yPos > 270) { doc.addPage(); yPos = 25; }
        doc.setFont("Helvetica", "normal");
        const single = inst.totalAmount / inst.installmentCount;
        const remaining = (inst.installmentCount - inst.paidInstallmentCount) * single;
        doc.text(safeText(inst.name), 18, yPos);
        doc.text(format(inst.totalAmount), 80, yPos);
        doc.text(`${inst.paidInstallmentCount}/${inst.installmentCount}`, 120, yPos);
        doc.text(format(remaining), 160, yPos);
        yPos += 8;
      });

      doc.save("Taksitli_Borc_Raporu.pdf");
      return;
    }

    const html = `
      <html><head><title>Taksitli Borç Raporu</title><style>
      body{font-family:sans-serif;padding:20px;color:#1e293b}
      table{width:100%;border-collapse:collapse;margin-top:15px}
      th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:12px}
      th{background:#f1f5f9}</style></head><body>
      <h2>🗓️ Taksitli Borç Raporu</h2>
      <p>Tarih: ${new Date().toLocaleDateString("tr-TR")}</p>
      <table><thead><tr><th>Plan Adı</th><th>Toplam</th><th>Taksit</th><th>Kalan</th></tr></thead>
      <tbody>${installmentDebts.map(inst => `<tr><td>${inst.name}</td><td>${format(inst.totalAmount)}</td><td>${inst.paidInstallmentCount}/${inst.installmentCount}</td><td>${format((inst.installmentCount - inst.paidInstallmentCount) * (inst.totalAmount / inst.installmentCount))}</td></tr>`).join("")}</tbody>
      </table></body></html>`;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed"; printFrame.style.width = "0"; printFrame.style.height = "0"; printFrame.style.border = "0";
    document.body.appendChild(printFrame);
    const docFrame = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (docFrame) {
      docFrame.write(html); docFrame.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus(); printFrame.contentWindow?.print();
        setTimeout(() => document.body.removeChild(printFrame), 1500);
      }, 500);
    }
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
          <CalendarDays className="w-7 h-7 text-indigo-500 animate-pulse" /> TAKSİTLİ BORÇLAR
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      <div className="flex flex-col gap-3 justify-center sm:flex-row sm:items-center">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={handleOpenExportModal}
            title="Taksitli borç planlarını dosya olarak kaydet / indir"
            className="px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-emerald-600/20 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Taksitleri İndir
          </button>
          <button
            onClick={handleOpenImportModal}
            title="Yedek dosyasından taksitli borçları geri yükle"
            className="px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-600/20 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Geri Yükle
          </button>
          <button
            onClick={() => {
              if (!isPremium) {
                onUpgradeClick?.();
              } else {
                handlePrint(false);
              }
            }}
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-slate-50 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Yazdır {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black">PRO</span>}
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
            <FileText className="w-3.5 h-3.5" /> PDF Al {!isPremium && <span className="ml-1 text-[8px] bg-slate-900 text-slate-100 dark:bg-amber-500 dark:text-slate-950 px-1 py-0.5 rounded-sm font-black font-mono">PRO</span>}
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 transition shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Taksit Planı Ekle
          </button>
        </div>
      </div>

      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-300 rounded-2xl grid gap-3 sm:grid-cols-2 font-bold text-xs">
        <div>💰 Toplam Kalan Taksit Borç Yükü: <span className="text-base text-rose-500 block font-mono">{format(totalRemaining)}</span></div>
        <div>🗓️ Bu Ay Ödenmesi Gereken Toplam Taksit: <span className="text-base text-indigo-600 dark:text-indigo-400 block font-mono">{format(currentMonthDue)}</span></div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {installmentDebts.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-medium md:col-span-2">
            Kayıtlı aktif taksitli borç planı bulunmuyor.
          </div>
        ) : (
          installmentDebts.map((inst) => {
            const singlePayment = inst.totalAmount / inst.installmentCount;
            const remaining = (inst.installmentCount - inst.paidInstallmentCount) * singlePayment;
            const percentage = (inst.paidInstallmentCount / inst.installmentCount) * 100;
            const isCompleted = inst.paidInstallmentCount === inst.installmentCount;

            // Pick a beautiful color theme dynamically based on installment name/id
            const CARD_THEMES = [
              {
                gradient: "from-slate-900 via-indigo-950 to-purple-950 dark:from-slate-950 dark:via-indigo-980 dark:to-purple-980",
                glow: "shadow-indigo-500/10",
                chip: "bg-amber-400/80 border-amber-300",
                brand: "PREMIUM PLATINUM",
                badge: "bg-indigo-500/30 text-indigo-200 border-indigo-400/20"
              },
              {
                gradient: "from-cyan-950 via-blue-950 to-indigo-950",
                glow: "shadow-cyan-500/10",
                chip: "bg-yellow-500/80 border-yellow-300",
                brand: "WORLD SIGNATURE",
                badge: "bg-cyan-500/30 text-cyan-200 border-cyan-400/20"
              },
              {
                gradient: "from-rose-950 via-purple-950 to-pink-950",
                glow: "shadow-rose-500/10",
                chip: "bg-amber-350/80 border-amber-200",
                brand: "AMEX ULTIMATE",
                badge: "bg-rose-500/30 text-rose-200 border-rose-400/20"
              },
              {
                gradient: "from-emerald-950 via-teal-950 to-emerald-900",
                glow: "shadow-emerald-500/10",
                chip: "bg-yellow-400/80 border-yellow-300",
                brand: "ECO CAPITAL",
                badge: "bg-emerald-500/30 text-emerald-200 border-emerald-400/20"
              },
              {
                gradient: "from-amber-950 via-orange-950 to-slate-950",
                glow: "shadow-amber-550/10",
                chip: "bg-amber-200/80 border-amber-100",
                brand: "GOLD METALLIC",
                badge: "bg-amber-550/30 text-amber-200 border-amber-400/20"
              }
            ];

            const themeIndex = (inst.id || 0) % CARD_THEMES.length;
            const cardTheme = CARD_THEMES[themeIndex];

            // Expiry Date (Valid thru) computation based on the plan count
            const getExpiryText = (firstDueDate: string, totalCount: number) => {
              try {
                const baseDate = new Date(firstDueDate);
                baseDate.setMonth(baseDate.getMonth() + totalCount);
                const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
                const yy = String(baseDate.getFullYear()).slice(-2);
                return `${mm}/${yy}`;
              } catch (e) {
                return "12/28";
              }
            };

            const expiryText = getExpiryText(inst.firstDueDate || new Date().toISOString(), inst.installmentCount);

            return (
              <motion.div
                key={inst.id}
                id={`installment-card-${inst.id}`}
                whileHover={{ scale: 1.025, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative overflow-hidden rounded-3xl p-5 border border-white/10 text-white bg-gradient-to-br ${cardTheme.gradient} shadow-xl ${cardTheme.glow} flex flex-col justify-between min-h-[210px] select-none`}
              >
                {/* Decorative intersecting circles context layout */}
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/5 blur-xl pointer-events-none" />
                <div className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full bg-white/3 blur-xl pointer-events-none" />

                {/* Upper Deck: Chip, Name, and Brand */}
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Simulated golden SIM card chip */}
                    <div className="w-8 h-6 rounded-md bg-amber-400/85 relative overflow-hidden border border-amber-300/40 shadow-inner shrink-0">
                      {/* Chip metal grid lines */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px p-0.5 opacity-60">
                        <div className="border border-amber-600/30 rounded-xs"></div>
                        <div className="border border-amber-600/30 rounded-xs"></div>
                        <div className="border border-amber-600/30 rounded-xs"></div>
                        <div className="border border-amber-600/30 rounded-xs"></div>
                        <div className="border border-amber-600/30 rounded-xs"></div>
                        <div className="border border-amber-600/30 rounded-xs"></div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-wide uppercase truncate max-w-[130px]">{inst.name}</h4>
                      <p className="text-[8px] opacity-75 font-mono tracking-widest">{cardTheme.brand}</p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 border text-[9px] font-black rounded-md tracking-wider shrink-0 shadow-xs uppercase leading-none ${cardTheme.badge}`}>
                    {inst.paidInstallmentCount} / {inst.installmentCount} Taksit
                  </span>
                </div>

                {/* Middle Deck: Large display of monthly payment amount */}
                <div className="relative z-10 my-3">
                  <span className="text-[9px] text-white/60 font-black uppercase tracking-widest block leading-none mb-1">
                    AYLIK ÖDEME TUTARI
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white drop-shadow-xs">
                      {format(singlePayment)}
                    </span>
                    <span className="text-[10px] text-white/70 font-bold">/ ay</span>
                  </div>
                </div>

                {/* Bottom Stats & Data section */}
                <div className="relative z-10 space-y-3">
                  {/* Real-time slider progress line */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-white/70 font-bold font-mono">
                      <span>Ödenen {inst.paidInstallmentCount} Taksit</span>
                      <span>%{percentage.toFixed(0)} pay</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden shadow-inner flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${isCompleted ? 'bg-emerald-400' : 'bg-gradient-to-r from-teal-300 to-amber-300'}`}
                      />
                    </div>
                  </div>

                  {/* Valid-thru, totals description and action buttons */}
                  <div className="flex items-center justify-between text-white/85 text-[10px] font-semibold gap-2 border-t border-white/10 pt-2.5">
                    <div className="flex gap-4 font-mono">
                      <div>
                        <span className="text-[8px] text-white/50 block font-normal leading-none mb-0.5">TOPLAM</span>
                        <span className="font-extrabold">{format(inst.totalAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-white/50 block font-normal leading-none mb-0.5">KALAN</span>
                        <span className="font-extrabold text-[#fda4af]">{format(remaining)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-white/50 block font-normal leading-none mb-0.5">VALİD THRU</span>
                        <span className="font-extrabold">{expiryText}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(inst)}
                        className="p-1 px-1.5 bg-white/15 hover:bg-white/25 rounded-md transition text-white"
                        title="Düzenle"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteInstallment(inst.id)}
                        className="p-1 px-1.5 bg-rose-500/30 hover:bg-rose-500/50 rounded-md transition text-rose-200"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {onRevertPayment && (
                        <button
                          disabled={inst.paidInstallmentCount === 0}
                          onClick={() => onRevertPayment(inst.id)}
                          title="Taksiti Geri Al"
                          className={`p-1 px-1.5 rounded-md transition ${
                            inst.paidInstallmentCount === 0
                              ? "opacity-35 cursor-not-allowed text-white/40"
                              : "bg-white/15 hover:bg-white/25 text-white"
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isCompleted && (
                        <button
                          onClick={() => handleOpenPayModal(inst)}
                          className="px-2.5 py-1 bg-white hover:bg-white/90 text-slate-900 font-extrabold text-[10px] rounded-md shadow-md transition active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <Wallet className="w-3 h-3 text-slate-800" /> Taksit Öde
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <InstallmentsPortalChart installmentDebts={installmentDebts} />

      {!isPremium && installmentDebts && installmentDebts.length > 0 && (
        <AdMobBanner unitType="banner" className="opacity-95 py-1" />
      )}

      {/* Installment Add/Edit Modal and Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h4 className="text-base font-bold flex items-center gap-1.5 border-b pb-2 dark:border-slate-700">
              <CalendarDays className="w-5 h-5 text-indigo-500" /> {modalTitle}
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">BORÇ PLANI ADI</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Beyaz eşya kredisi vb."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">TOPLAM TUTAR</label>
                  <input
                    type="text"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(formatNumberWithDots(e.target.value))}
                    placeholder="₺12.000"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">TAKSİT SAYISI</label>
                  <input
                    type="number"
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(e.target.value)}
                    placeholder="12"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">ÖDENMİŞ TAKSİT</label>
                  <input
                    type="number"
                    value={paidInstallmentCount}
                    onChange={(e) => setPaidInstallmentCount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">İLK ÖDEME TARİHİ</label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                  />
                </div>
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
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Payment Date Modal for Installments */}
      {payModalInst && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl border border-indigo-100 dark:border-slate-700">
            <h4 className="text-base font-bold flex items-center gap-2 border-b pb-2 dark:border-slate-700 text-indigo-600 dark:text-indigo-400">
              <Wallet className="w-5 h-5 text-indigo-500" /> Taksit Ödemesi Kaydet
            </h4>

            <div className="bg-indigo-50/70 dark:bg-slate-900/60 p-3 rounded-2xl space-y-1">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {payModalInst.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                <span>Taksit Adedi:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {payModalInst.paidInstallmentCount + 1}. Taksit / {payModalInst.installmentCount}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                <span>Ödenecek Tutar:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100">
                  {format(payModalInst.totalAmount / payModalInst.installmentCount)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                ÖDEME TARİHİ / AİT OLDUĞU AY
              </label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1 italic">
                * Bu taksit ödemesi seçtiğiniz tarihin ait olduğu ayın bütçe ve ödeme raporlarına yansıtılacaktır.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPayModalInst(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition active:scale-95 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                Ödemeyi Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Taksitleri Dışa Aktar (İndir) Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Taksitli Borçları İndir</h3>
                    <p className="text-xs text-slate-500 font-medium">Taksit planlarınızı JSON olarak yedekleyin</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  DOSYA ADI
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    placeholder="Taksitli_Borclar_Yedek"
                    className="w-full pl-3.5 pr-16 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    autoFocus
                  />
                  <span className="absolute right-3 text-[10px] font-black font-mono text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-md uppercase">
                    .json
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-1 text-xs text-emerald-900 dark:text-emerald-300">
                <div className="flex justify-between font-bold">
                  <span>Toplam Plan Sayısı:</span>
                  <span>{installmentDebts.length} Adet</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kalan Toplam Borç:</span>
                  <span>{format(totalRemaining)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {"showSaveFilePicker" in window && (
                  <button
                    type="button"
                    onClick={() => executeExportInstallments(true)}
                    className="w-full p-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-bold text-xs flex items-center justify-between shadow-md shadow-emerald-600/20 transition active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 text-left">
                      <Save className="w-4 h-4 text-emerald-200" />
                      <div>
                        <div className="font-extrabold">📁 Konum / Klasör Seçerek Kaydet</div>
                        <div className="text-[10px] text-emerald-200 font-normal">Cihazınızda istediğiniz klasörü seçin</div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-emerald-200" />
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => executeExportInstallments(false)}
                    className="p-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Doğrudan İndir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(installmentDebts, null, 2));
                      alert("✅ Taksit planları verisi panoya kopyalandı!");
                      setIsExportModalOpen(false);
                    }}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-500" /> JSON Kopyala
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Taksitleri İçe Aktar (Geri Yükle) Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Taksitli Borçları Geri Yükle</h3>
                    <p className="text-xs text-slate-500 font-medium">JSON dosyasından taksit planlarını aktarın</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                <div
                  onClick={() => importFileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 p-6 rounded-2xl text-center cursor-pointer bg-indigo-50/30 dark:bg-indigo-950/20 transition group"
                >
                  <FileJson className="w-8 h-8 text-indigo-500 mx-auto mb-2 group-hover:scale-110 transition" />
                  <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                    Taksit Yedek Dosyasını (.json) Seçin
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Cihazınızdaki yedek dosyasını yüklemek için tıklayın
                  </div>
                </div>

                {importError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {importedPreviewList && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                        <span>✅ Okunan Taksit Planı:</span>
                        <span>{importedPreviewList.length} Adet</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-[11px]">
                        {importedPreviewList.map((inst, idx) => (
                          <div key={idx} className="flex justify-between py-1 border-b border-emerald-500/10 text-slate-700 dark:text-slate-300">
                            <span className="font-bold truncate max-w-[200px]">{inst.name}</span>
                            <span>{format(inst.totalAmount)} ({inst.installmentCount} Taksit)</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                        YÜKLEME MODU
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setImportMode("merge")}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            importMode === "merge"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <div className="font-extrabold">➕ Üzerine Ekle</div>
                          <div className="text-[10px] font-normal opacity-80">Mevcut taksitleri korur, yeni olanları ekler</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportMode("replace")}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            importMode === "replace"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <div className="font-extrabold">🔄 Listeyi Değiştir</div>
                          <div className="text-[10px] font-normal opacity-80">Mevcut listeyi temizler ve yedektekileri yükler</div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  İptal
                </button>
                {importedPreviewList && (
                  <button
                    type="button"
                    onClick={handleConfirmRestoreInstallments}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition active:scale-95 shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    Geri Yüklemeyi Onayla ({importedPreviewList.length})
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

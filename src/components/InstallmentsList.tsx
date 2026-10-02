/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PlusCircle, CalendarDays, Wallet, Edit, Trash2, Calendar, RotateCcw, Printer, FileText, Download, Upload, Save, Folder, FileJson, CheckCircle2, Copy, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { InstallmentDebt, PaymentLog } from "../types";
import { useCurrency } from "../utils/CurrencyContext";
import { AdMobBanner } from "./AdMobBanner";
import { InstallmentsPortalChart } from "./BudgetCharts";
import { t } from "../utils/translations";
import { jsPDF } from "jspdf";
import { ProviderBadge, ProviderSelector } from "./ProviderBadge";
import { getProviderById, detectProviderFromName } from "../data/providers";
import { downloadFileWithCustomName, savePdfDocument } from "../utils/fileDownloadHelper";
import { isAndroidAlarmBridgeAvailable, shareAndroidNativeBackupFile, saveAndroidNativeBackupFile } from "../utils/androidAlarmBridge";

interface InstallmentsListProps {
  installmentDebts: InstallmentDebt[];
  payments?: PaymentLog[];
  selectedMonth?: number | null;
  selectedYear?: number | null;
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
  payments = [],
  selectedMonth,
  selectedYear,
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
  const [providerId, setProviderId] = useState<string | undefined>(undefined);

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
      alert("Dışa aktarılacak taksitli borç planı bulunmuyor. Lütfen önce bir taksit planı ekleyin.");
      return;
    }
    setExportFileName(`Taksitli_Borclar_${new Date().toISOString().slice(0, 10)}`);
    setIsExportModalOpen(true);
  };

  const executeExportInstallments = async (pickFolder: boolean = false) => {
    if (installmentDebts.length === 0) {
      alert("İndirilecek taksit planı bulunmuyor.");
      return;
    }
    const jsonString = JSON.stringify(installmentDebts, null, 2);
    let rawName = (exportFileName || `Taksitli_Borclar_${new Date().toISOString().slice(0, 10)}`).trim();
    if (!rawName) rawName = `Taksitli_Borclar_${new Date().toISOString().slice(0, 10)}`;
    const baseName = rawName.replace(/\.json$/i, "");
    const fileName = `${baseName}.json`;

    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });

    if (pickFolder) {
      // 1. Android Native App Bridge Check
      if (isAndroidAlarmBridgeAvailable()) {
        try {
          const isShared = shareAndroidNativeBackupFile(fileName, jsonString, "Taksitli Borç Planları");
          if (isShared) {
            alert(`✅ '${fileName}' taksit yedeği paylaşım ve kayıt menüsüne başarıyla aktarıldı!`);
            setIsExportModalOpen(false);
            return;
          }
          const isSaved = saveAndroidNativeBackupFile(fileName, jsonString);
          if (isSaved) {
            alert(`✅ '${fileName}' taksit yedeği İndirilenler klasörüne başarıyla kaydedildi!`);
            setIsExportModalOpen(false);
            return;
          }
        } catch (androidErr) {
          console.warn("Android native save/share failed:", androidErr);
        }
      }

      // Check for WebView environment (calling navigator.share in WebView often crashes WebView container)
      const isWebViewEnv = typeof navigator !== "undefined" && (
        /wv|Android.*Build\/|Version\/[0-9.]+/i.test(navigator.userAgent) && !/Chrome\/[0-9.]+\s+Mobile/i.test(navigator.userAgent)
      );

      // 2. Browser Web Share API (only if safe & not in WebView)
      if (!isWebViewEnv && typeof navigator !== "undefined" && navigator.canShare) {
        try {
          const testFile = new File([blob], fileName, { type: "application/json" });
          if (navigator.canShare({ files: [testFile] })) {
            await navigator.share({
              title: "Taksitli Borç Planları",
              text: `Bütçem Taksit Planları (${fileName})`,
              files: [testFile],
            });
            alert(`✅ '${fileName}' taksit yedeği seçilen konuma / uygulamaya başarıyla iletildi!`);
            setIsExportModalOpen(false);
            return;
          }
        } catch (shareErr: any) {
          if (shareErr.name === "AbortError") return;
          console.warn("navigator.share bypassed, trying file picker or download:", shareErr);
        }
      }

      // 3. Desktop File System Access API
      const isMobileDevice = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile|wv/i.test(navigator.userAgent);
      if (!isMobileDevice && typeof window !== "undefined" && "showSaveFilePicker" in window) {
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
        }
      }
    }

    // Direct clean download (Android APK & Browser Safe)
    downloadFileWithCustomName({
      fileName,
      content: jsonString,
      mimeType: "application/json",
      onSuccess: () => {
        alert(`✅ ${installmentDebts.length} adet taksit planı '${fileName}' adıyla İndirilenler klasörünüze kaydedildi!`);
        setIsExportModalOpen(false);
      },
      onError: () => {
        alert(`✅ ${installmentDebts.length} adet taksit planı '${fileName}' adıyla kaydedildi!`);
        setIsExportModalOpen(false);
      }
    });
  };

  const handleExportCsv = () => {
    if (installmentDebts.length === 0) {
      alert("Dışa aktarılacak taksitli borç planı bulunmuyor.");
      return;
    }
    const header = "Plan Adı,Toplam Borç,Taksit Sayısı,Ödenen Taksit,Kalan Taksit,Aylık Taksit Tutarı,İlk Vade Tarihi\n";
    const rows = installmentDebts.map((i) => {
      const single = i.totalAmount / (i.installmentCount || 1);
      const remaining = (i.installmentCount || 1) - (i.paidInstallmentCount || 0);
      return `"${(i.name || "").replace(/"/g, '""')}",${i.totalAmount},${i.installmentCount},${i.paidInstallmentCount || 0},${remaining},${single.toFixed(2)},${i.firstDueDate || ""}`;
    }).join("\n");
    const csvContent = "\uFEFF" + header + rows;
    const fileName = `Taksitli_Borclar_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFileWithCustomName({
      fileName,
      content: csvContent,
      mimeType: "text/csv;charset=utf-8",
      onSuccess: () => {
        alert(`✅ ${installmentDebts.length} adet taksit planı CSV/Excel olarak indirildi!`);
        setIsExportModalOpen(false);
      }
    });
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
    setProviderId(undefined);
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
    setProviderId(inst.providerId);
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
      providerId: providerId || null,
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

  const handlePrint = async (isPdf = false) => {
    if (installmentDebts.length === 0) {
      alert("Yazdırılacak veya indirilecek taksit kaydı bulunmuyor. Lütfen önce bir taksit planı ekleyin.");
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
      doc.text(safeText("Toplam Tutar"), 80, yPos);
      doc.text(safeText("Taksit"), 125, yPos);
      doc.text(safeText("Kalan Borç"), 160, yPos);
      yPos += 10;

      installmentDebts.forEach((inst) => {
        if (yPos > 270) { doc.addPage(); yPos = 25; }
        doc.setFont("Helvetica", "normal");
        const single = inst.totalAmount / (inst.installmentCount || 1);
        const remaining = ((inst.installmentCount || 1) - (inst.paidInstallmentCount || 0)) * single;
        doc.text(safeText(inst.name), 18, yPos);
        doc.text(format(inst.totalAmount), 80, yPos);
        doc.text(`${inst.paidInstallmentCount || 0}/${inst.installmentCount || 1}`, 125, yPos);
        doc.text(format(remaining), 160, yPos);
        yPos += 8;
      });

      try {
        await savePdfDocument(doc, `Taksitli_Borclar_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (pdfErr) {
        console.error("PDF export error:", pdfErr);
      }
      return;
    }

    // Direct Browser Print: Create a styled print window
    try {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Taksitli Borç Raporu - Bütçem Pro</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; }
              .header { border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
              h1 { font-size: 20px; margin: 0 0 6px 0; color: #1e1b4b; }
              .meta { font-size: 12px; color: #64748b; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
              th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
              th { background-color: #f8fafc; font-weight: 700; color: #334155; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .totals { margin-top: 24px; padding: 12px; background: #eef2ff; border-radius: 8px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🗓️ Bütçem Pro - Taksitli Borç Planı Raporu</h1>
              <div class="meta">Rapor Tarihi: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Taksit Plan Adı</th>
                  <th>Toplam Borç</th>
                  <th>Taksit Durumu</th>
                  <th>Aylık Taksit</th>
                  <th>Kalan Borç Tutarı</th>
                </tr>
              </thead>
              <tbody>
                ${installmentDebts.map((inst, idx) => {
                  const single = inst.totalAmount / (inst.installmentCount || 1);
                  const rem = ((inst.installmentCount || 1) - (inst.paidInstallmentCount || 0)) * single;
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><strong>${inst.name}</strong></td>
                      <td>${format(inst.totalAmount)}</td>
                      <td>${inst.paidInstallmentCount || 0} / ${inst.installmentCount || 1} Ödendi</td>
                      <td>${format(single)} / Ay</td>
                      <td><strong>${format(rem)}</strong></td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
            <div class="totals">
              Toplam Kalan Taksit Yükü: ${format(totalRemaining)} | Toplam Plan: ${installmentDebts.length} Adet
            </div>
            <script>
              window.onload = function() {
                window.focus();
                window.print();
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        window.print();
      }
    } catch (e) {
      window.print();
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
            onClick={() => handlePrint(false)}
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Yazdır
          </button>
          <button
            onClick={() => handlePrint(true)}
            className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-600 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> PDF Al
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 transition shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Taksit Planı Ekle
          </button>
        </div>
      </div>

      {/* Installment Summary Cards matching Dashboard Style */}
      {(() => {
        const totalPaid = installmentDebts.reduce((s, i) => s + ((Number(i.paidInstallmentCount) || 0) * (Number(i.totalAmount) / (Number(i.installmentCount) || 1))), 0);
        const activeCount = installmentDebts.filter(i => (i.paidInstallmentCount || 0) < (i.installmentCount || 1)).length;

        const now = new Date();
        const targetMonth = selectedMonth !== null && selectedMonth !== undefined ? selectedMonth : now.getMonth();
        const targetYear = selectedYear !== null && selectedYear !== undefined ? selectedYear : now.getFullYear();
        const targetTime = targetYear * 12 + targetMonth;

        // 1. Bu ay ödenen taksit tutarı (loglardan hesaplanır)
        const installmentPaymentsThisMonth = (payments || []).filter((p) => {
          if (p.type !== "installment") return false;
          try {
            const pDate = new Date(p.date);
            if (isNaN(pDate.getTime())) return false;
            return pDate.getMonth() === targetMonth && pDate.getFullYear() === targetYear;
          } catch {
            return false;
          }
        });
        const thisMonthPaidLogs = installmentPaymentsThisMonth.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        // 2. Taksit planları üzerinden bu ay planlanan ve sayaç/tarih bazlı ödenen tutarlar
        let scheduledForMonth = 0;
        let paidForMonthByCounter = 0;

        installmentDebts.forEach((inst) => {
          const count = Number(inst.installmentCount) || 1;
          const paidCount = Number(inst.paidInstallmentCount) || 0;
          const perMonth = (Number(inst.totalAmount) || 0) / count;

          if (paidCount >= count) {
            // Tamamen ödenmiş plan
            return;
          }

          let isDueInTargetMonth = true;
          let targetMonthIndex = -1;

          if (inst.firstDueDate) {
            try {
              const parts = inst.firstDueDate.split("-");
              if (parts.length >= 2) {
                const startYear = parseInt(parts[0], 10);
                const startMonth = parseInt(parts[1], 10) - 1;
                const startTime = startYear * 12 + startMonth;
                targetMonthIndex = targetTime - startTime;

                if (targetMonthIndex < 0 || targetMonthIndex >= count) {
                  isDueInTargetMonth = false;
                }
              }
            } catch {}
          }

          if (isDueInTargetMonth) {
            scheduledForMonth += perMonth;

            // Eğer taksit sayacı bu ayın taksitini geçmişse, bu ayın taksiti ödenmiş kabul edilir
            if (targetMonthIndex >= 0 && paidCount > targetMonthIndex) {
              paidForMonthByCounter += perMonth;
            }
          }
        });

        // Toplam bu ayki taksit yükümlülüğü
        const baseMonthlyDue = scheduledForMonth > 0 ? scheduledForMonth : currentMonthDue;
        const thisMonthPaid = Math.max(paidForMonthByCounter, thisMonthPaidLogs);
        const thisMonthTotal = Math.max(baseMonthlyDue, thisMonthPaid);
        // Bu ay kalan taksit borcu (Bu ayki ödenen taksitlerden kalan olacak)
        const thisMonthRemaining = Math.max(0, thisMonthTotal - thisMonthPaid);

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* 1. TOPLAM KALAN TAKSİT BORCU */}
            <motion.div 
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 dark:from-indigo-950 dark:via-indigo-900 dark:to-slate-900 border-2 border-indigo-400/40 dark:border-indigo-500/40 text-white rounded-2xl relative overflow-hidden shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all duration-300 flex flex-col justify-between text-center min-h-[104px] sm:min-h-[114px]"
            >
              <div className="flex items-center justify-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-wide">
                <Wallet className="w-3 h-3 text-indigo-200" />
                <span>KALAN TAKSİT YÜKÜ</span>
              </div>
              <div className="my-0.5">
                <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white leading-tight">{format(totalRemaining)}</p>
                <span className="text-[8px] sm:text-[8.5px] font-medium text-indigo-100/90 block">
                  Tüm Planların Kalanı
                </span>
              </div>
              <div className="w-full pt-1 border-t border-white/20 text-[8px] sm:text-[8.5px] font-bold text-indigo-200">
                Genel Anapara Borcu
              </div>
            </motion.div>

            {/* 2. BU AY ÖDENECEK TAKSİT & KALAN TAKSİT BORCU */}
            <motion.div 
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-violet-500 via-violet-600 to-purple-800 dark:from-violet-950 dark:via-purple-950 dark:to-slate-900 border-2 border-violet-400/40 dark:border-violet-500/40 text-white rounded-2xl relative overflow-hidden shadow-lg shadow-violet-500/20 hover:shadow-xl transition-all duration-300 flex flex-col justify-between text-center min-h-[104px] sm:min-h-[114px]"
            >
              <div className="flex items-center justify-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-violet-100 uppercase tracking-wide">
                <CalendarDays className="w-3 h-3 text-violet-200" />
                <span>BU AY TAKSİT</span>
              </div>
              <div className="my-0.5">
                <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white leading-tight">
                  {format(thisMonthTotal)}
                </p>
                <span className="text-[8px] sm:text-[8.5px] font-medium text-violet-100/90 block">
                  Bu Ay Toplam Taksit
                </span>
              </div>
              <div className="w-full pt-1 border-t border-white/20 space-y-1">
                <div className="flex items-center justify-between text-[8px] sm:text-[8.5px] font-bold bg-amber-400/25 px-1.5 py-0.5 rounded text-amber-100 shadow-xs" title="Bu ayki ödenen taksitlerden kalan borç">
                  <span className="text-amber-200 font-extrabold">Bu Ay Kalan:</span>
                  <span className="font-mono font-black">{format(thisMonthRemaining)}</span>
                </div>
                <div className="flex items-center justify-between text-[7.5px] sm:text-[8px] font-semibold text-violet-200/90 px-1">
                  <span>Ödenen:</span>
                  <span className="font-mono font-bold text-emerald-300">{format(thisMonthPaid)}</span>
                </div>
              </div>
            </motion.div>

            {/* 3. ÖDENEN TAKSİT TOPLAMI */}
            <motion.div 
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-800 dark:from-teal-950 dark:via-emerald-950 dark:to-slate-900 border-2 border-teal-400/40 dark:border-teal-500/40 text-white rounded-2xl relative overflow-hidden shadow-lg shadow-teal-500/20 hover:shadow-xl transition-all duration-300 flex flex-col justify-between text-center min-h-[104px] sm:min-h-[114px]"
            >
              <div className="flex items-center justify-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-teal-100 uppercase tracking-wide">
                <CheckCircle2 className="w-3 h-3 text-teal-200" />
                <span>ÖDENEN KISIM</span>
              </div>
              <div className="my-0.5">
                <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white leading-tight">{format(totalPaid)}</p>
                <span className="text-[8px] sm:text-[8.5px] font-medium text-teal-100/90 block">
                  Şimdiye Kadar Kapatılan
                </span>
              </div>
              <div className="w-full pt-1 border-t border-white/20 text-[8px] sm:text-[8.5px] font-bold text-teal-200">
                Toplam Kapatılan Tutar
              </div>
            </motion.div>

            {/* 4. AKTİF TAKSİT PLANLARI */}
            <motion.div 
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 dark:from-amber-950 dark:via-orange-950 dark:to-slate-900 border-2 border-amber-400/40 dark:border-amber-500/40 text-white rounded-2xl relative overflow-hidden shadow-lg shadow-amber-500/20 hover:shadow-xl transition-all duration-300 flex flex-col justify-between text-center min-h-[104px] sm:min-h-[114px]"
            >
              <div className="flex items-center justify-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-amber-100 uppercase tracking-wide">
                <Calendar className="w-3 h-3 text-amber-200" />
                <span>AKTİF PLANLAR</span>
              </div>
              <div className="my-0.5">
                <p className="text-sm sm:text-base font-black font-mono tracking-tight text-white leading-tight">{activeCount} / {installmentDebts.length} Plan</p>
                <span className="text-[8px] sm:text-[8.5px] font-medium text-amber-100/90 block">
                  Devam Eden Taksitler
                </span>
              </div>
              <div className="w-full pt-1 border-t border-white/20 text-[8px] sm:text-[8.5px] font-bold text-amber-200">
                Kalan Aktif Sayısı
              </div>
            </motion.div>
          </div>
        );
      })()}

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

            // Pick a vibrant color theme matching the modern glassmorphism design
            const CARD_THEMES = [
              {
                gradient: "from-indigo-600 via-indigo-700 to-slate-900 dark:from-indigo-950/95 dark:via-indigo-900/90 dark:to-slate-900",
                glow: "shadow-indigo-500/25 dark:shadow-indigo-500/20",
                border: "border-indigo-400/40 dark:border-indigo-400/30",
                brand: "PREMIUM PLATINUM",
                badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs"
              },
              {
                gradient: "from-blue-600 via-blue-700 to-slate-900 dark:from-blue-950/95 dark:via-cyan-950/90 dark:to-slate-900",
                glow: "shadow-blue-500/25 dark:shadow-blue-500/20",
                border: "border-blue-400/40 dark:border-blue-400/30",
                brand: "WORLD SIGNATURE",
                badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs"
              },
              {
                gradient: "from-rose-600 via-rose-700 to-slate-900 dark:from-rose-950/95 dark:via-rose-900/90 dark:to-slate-900",
                glow: "shadow-rose-500/25 dark:shadow-rose-500/20",
                border: "border-rose-400/40 dark:border-rose-400/30",
                brand: "AMEX ULTIMATE",
                badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs"
              },
              {
                gradient: "from-emerald-600 via-emerald-700 to-slate-900 dark:from-emerald-950/95 dark:via-teal-900/90 dark:to-slate-900",
                glow: "shadow-emerald-500/25 dark:shadow-emerald-500/20",
                border: "border-emerald-400/40 dark:border-emerald-400/30",
                brand: "ECO CAPITAL",
                badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs"
              },
              {
                gradient: "from-amber-600 via-orange-700 to-slate-900 dark:from-amber-950/95 dark:via-orange-900/90 dark:to-slate-900",
                glow: "shadow-amber-500/25 dark:shadow-amber-500/20",
                border: "border-amber-400/40 dark:border-amber-400/30",
                brand: "GOLD METALLIC",
                badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs"
              },
              {
                gradient: "from-purple-600 via-violet-700 to-slate-900 dark:from-violet-950/95 dark:via-purple-900/90 dark:to-slate-900",
                glow: "shadow-purple-500/25 dark:shadow-violet-500/20",
                border: "border-purple-400/40 dark:border-violet-400/30",
                brand: "TITANIUM BLACK",
                badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs"
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
                whileHover={{ scale: 1.02, y: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative overflow-hidden rounded-3xl p-5 border ${cardTheme.border} text-white bg-gradient-to-br ${cardTheme.gradient} shadow-md ${cardTheme.glow} flex flex-col justify-between min-h-[210px] select-none backdrop-blur-md`}
              >
                {/* Decorative intersecting circles context layout */}
                <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-white/5 blur-xl pointer-events-none" />

                {/* Upper Deck: Chip, Name, and Brand */}
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Simulated golden SIM card chip */}
                    <div className="w-8 h-6 rounded-md bg-amber-400/90 relative overflow-hidden border border-amber-300/60 shadow-xs shrink-0">
                      {/* Chip metal grid lines */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px p-0.5 opacity-60">
                        <div className="border border-amber-600/40 rounded-xs"></div>
                        <div className="border border-amber-600/40 rounded-xs"></div>
                        <div className="border border-amber-600/40 rounded-xs"></div>
                        <div className="border border-amber-600/40 rounded-xs"></div>
                        <div className="border border-amber-600/40 rounded-xs"></div>
                        <div className="border border-amber-600/40 rounded-xs"></div>
                      </div>
                    </div>
                    <div>
                      {(() => {
                        const provider = getProviderById(inst.providerId) || detectProviderFromName(inst.name);
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {provider && (
                              <ProviderBadge providerId={provider.id} size="sm" showLabel={false} />
                            )}
                            <h4 className="text-xs font-black tracking-wide uppercase truncate max-w-[140px] text-white" title={inst.name}>
                              {inst.name}
                            </h4>
                            {provider && (
                              <span className="text-[9px] text-white/80 font-bold">
                                ({provider.badgeLabel || provider.name})
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <p className="text-[8px] text-white/70 font-mono tracking-widest">{cardTheme.brand}</p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 border text-[9px] font-black rounded-md tracking-wider shrink-0 shadow-xs uppercase leading-none ${cardTheme.badge}`}>
                    {inst.paidInstallmentCount} / {inst.installmentCount} Taksit
                  </span>
                </div>

                {/* Middle Deck: Large display of monthly payment amount */}
                <div className="relative z-10 my-3">
                  <span className="text-[9px] text-white/70 font-black uppercase tracking-widest block leading-none mb-1">
                    AYLIK ÖDEME TUTARI
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white drop-shadow-xs">
                      {format(singlePayment)}
                    </span>
                    <span className="text-[10px] text-white/80 font-bold">/ ay</span>
                  </div>
                </div>

                {/* Bottom Stats & Data section */}
                <div className="relative z-10 space-y-3">
                  {/* Real-time slider progress line */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-white/80 font-bold font-mono">
                      <span>Ödenen {inst.paidInstallmentCount} Taksit</span>
                      <span>%{percentage.toFixed(0)} pay</span>
                    </div>
                    <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden shadow-inner flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${isCompleted ? 'bg-emerald-400' : 'bg-gradient-to-r from-teal-300 via-emerald-300 to-amber-300'}`}
                      />
                    </div>
                  </div>

                  {/* Valid-thru, totals description and action buttons */}
                  <div className="flex items-center justify-between text-white/90 text-[10px] font-semibold gap-2 border-t border-white/15 pt-2.5">
                    <div className="flex gap-4 font-mono">
                      <div>
                        <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">TOPLAM</span>
                        <span className="font-extrabold text-white">{format(inst.totalAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">KALAN</span>
                        <span className="font-extrabold text-amber-300">{format(remaining)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">VALİD THRU</span>
                        <span className="font-extrabold text-white">{expiryText}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(inst)}
                        className="p-1 px-1.5 bg-white/20 hover:bg-white/30 border border-white/20 text-white rounded-md transition shadow-xs cursor-pointer"
                        title="Düzenle"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteInstallment(inst.id)}
                        className="p-1 px-1.5 bg-rose-500/30 hover:bg-rose-500/50 border border-rose-300/30 text-white rounded-md transition shadow-xs cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {onRevertPayment && (
                        <button
                          disabled={inst.paidInstallmentCount === 0}
                          onClick={() => onRevertPayment(inst.id)}
                          title="Taksiti Geri Al"
                          className={`p-1 px-1.5 rounded-md transition shadow-xs cursor-pointer ${
                            inst.paidInstallmentCount === 0
                              ? "opacity-30 cursor-not-allowed text-white/40 border border-transparent"
                              : "bg-white/20 hover:bg-white/30 border border-white/20 text-white"
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
                          <Wallet className="w-3 h-3 text-slate-900" /> Taksit Öde
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

      {!isPremium && (
        <AdMobBanner unitType="banner" className="opacity-95 py-1" />
      )}

      {/* Installment Add/Edit Modal and Form */}
      {isModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-fade-in">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md space-y-4 shadow-2xl border border-slate-200/60 dark:border-slate-700/60 max-h-[90vh] overflow-y-auto my-auto relative">
            <h4 className="text-base font-bold flex items-center gap-1.5 border-b pb-2 dark:border-slate-700">
              <CalendarDays className="w-5 h-5 text-indigo-500" /> {modalTitle}
            </h4>
            <div className="space-y-3">
              <ProviderSelector
                selectedProviderId={providerId}
                onSelect={(id) => setProviderId(id)}
                onClear={() => setProviderId(undefined)}
                debtNameHint={name}
                language={language}
              />

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
        </div>,
        document.body
      )}

      {/* Custom Payment Date Modal for Installments */}
      {payModalInst && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-fade-in">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-5 sm:p-6 w-full max-w-sm space-y-4 shadow-2xl border border-indigo-100 dark:border-slate-700 max-h-[90vh] overflow-y-auto my-auto relative">
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
        </div>,
        document.body
      )}

      {/* Taksitleri Dışa Aktar (İndir) Modal */}
      <AnimatePresence>
        {isExportModalOpen && typeof document !== "undefined" && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto overscroll-contain animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto my-auto relative"
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
                <button
                  type="button"
                  onClick={() => executeExportInstallments(true)}
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

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => executeExportInstallments(false)}
                    className="p-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> .JSON İndir
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> .CSV Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(installmentDebts, null, 2));
                      alert("✅ Taksit planları verisi panoya kopyalandı!");
                      setIsExportModalOpen(false);
                    }}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-500" /> Kopyala
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
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Taksitleri İçe Aktar (Geri Yükle) Modal */}
      <AnimatePresence>
        {isImportModalOpen && typeof document !== "undefined" && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto overscroll-contain animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col my-auto relative"
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
          </div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
};

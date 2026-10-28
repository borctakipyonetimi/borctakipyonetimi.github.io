import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  MicOff,
  X,
  Volume2,
  VolumeX,
  Check,
  AlertCircle,
  Sparkles,
  Info,
  Loader2,
  Send,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  CreditCard,
  UserCheck,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Crown,
  FileCheck2,
  RotateCcw
} from "lucide-react";

import { Debt, Income, Expense, InstallmentDebt } from "../types";
import { getApiUrl } from "../utils/api";
import speechService from "../services/speechService";
import {
  parseFinancialVoiceCommand,
  ParsedVoiceCommand
} from "../utils/financialVoiceParser";

interface VoiceAssistantProps {
  debts?: Debt[];
  incomes?: Income[];
  expenses?: Expense[];
  installmentDebts?: InstallmentDebt[];
  onSaveDebt: (debtData: any, autoCreateAlarm?: boolean) => void;
  onSaveIncome: (incData: any) => void;
  onSaveExpense: (expData: any) => void;
  onSaveInstallment: (instData: any) => void;
  onSaveContactTx?: (
    contactName: string,
    amount: number,
    type: "receivable" | "payable",
    description?: string
  ) => void;
  onDeleteDebt?: (id: number) => void;
  onDeleteIncome?: (id: number) => void;
  onDeleteExpense?: (id: number) => void;
  currentUser?: string | null;
  userApiKey?: string;
  triggerToast: (msg: string) => void;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

export default function VoiceAssistant({
  debts = [],
  incomes = [],
  expenses = [],
  installmentDebts = [],
  onSaveDebt,
  onSaveIncome,
  onSaveExpense,
  onSaveInstallment,
  onSaveContactTx,
  onDeleteDebt,
  onDeleteIncome,
  onDeleteExpense,
  currentUser,
  userApiKey,
  triggerToast,
  isPremium = false,
  onUpgradeClick
}: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [status, setStatus] = useState<
    "idle" | "listening" | "processing" | "confirming" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [micVolume, setMicVolume] = useState<number>(0);

  // Doğrudan Onay Bekleyen Kayıt Formu Durumu
  const [pendingCommand, setPendingCommand] = useState<ParsedVoiceCommand | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState<number | string>(1);
  const [editContactType, setEditContactType] = useState<"receivable" | "payable">("payable");
  const [editInstallmentCount, setEditInstallmentCount] = useState<number>(12);

  // Son başarılı işlem açıklaması
  const [successMessage, setSuccessMessage] = useState("");

  const isSupported = speechService.isSupported();

  useEffect(() => {
    return () => {
      speechService.stopListening();
      speechService.stopSpeaking();
    };
  }, []);

  const speak = (text: string) => {
    if (!audioEnabled) return;
    speechService.speak(text);
  };

  /**
   * Ses dinleme başlatma
   */
  const handleStartListening = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!isPremium) {
      onUpgradeClick?.();
      return;
    }

    if (!isSupported) {
      triggerToast("Cihazınızda ses tanıma veya mikrofon desteği bulunamadı. Komutunuzu yazarak iletebilirsiniz.");
      setErrorMsg("Cihazınızda mikrofon desteği bulunamadı. Aşağıdaki alandan yazılı komut girebilirsiniz.");
      setStatus("error");
      return;
    }

    speechService.stopSpeaking();
    setTranscript("");
    setErrorMsg("");
    setPendingCommand(null);

    let recordedAudioDispatched = false;

    const started = await speechService.startListening({
      onStart: () => {
        setIsListening(true);
        setStatus("listening");
        setErrorMsg("");
      },
      onVolumeChange: (vol) => {
        setMicVolume(vol);
      },
      onResult: (text, isFinal) => {
        setTranscript(text);
        setManualInput(text);
      },
      onAudioRecorded: (base64Audio, mimeType) => {
        // Eğer Web Speech API metin üretemediyse, kaydedilen sesi doğrudan sunucuya (Gemini 2.5 Flash) ilet
        if (!transcript.trim()) {
          recordedAudioDispatched = true;
          processVoiceAudio(base64Audio, mimeType);
        }
      },
      onError: (errMsg, isFatal) => {
        setIsListening(false);
        setMicVolume(0);
        setStatus("error");
        setErrorMsg(errMsg);
      },
      onEnd: (finalText) => {
        setIsListening(false);
        setMicVolume(0);
        if (finalText && finalText.trim()) {
          processVoiceText(finalText.trim());
        } else if (!recordedAudioDispatched) {
          // Eğer metin yoksa ve henüz ses kaydı işlenmiyorsa durumu koru veya idle yap
          setTimeout(() => {
            setStatus((prev) => (prev === "listening" ? "idle" : prev));
          }, 300);
        }
      }
    });

    if (!started) {
      setIsListening(false);
      setStatus("error");
    }
  };

  const handleStopListening = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    speechService.stopListening();
    setIsListening(false);
    setMicVolume(0);
  };

  /**
   * MediaRecorder ses kaydını sunucuya gönderip Gemini 2.5 Flash ile Türkçe deşifre eder.
   */
  const processVoiceAudio = async (audioBase64: string, mimeType: string) => {
    setStatus("processing");
    setErrorMsg("");

    try {
      const res = await fetch(getApiUrl("/api/voice-command"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType, userApiKey })
      });

      if (!res.ok) {
        throw new Error("Ses kaydı çözümlenemedi.");
      }

      const aiData = await res.json();
      if (aiData.transcribedText) {
        setTranscript(aiData.transcribedText);
        setManualInput(aiData.transcribedText);
      }

      if (aiData.action && aiData.action !== "unknown") {
        const fallbackParsed = parseFinancialVoiceCommand(aiData.transcribedText || "");
        const finalCommand = mapServerResponseToParsedCommand(aiData, aiData.transcribedText || "", fallbackParsed);
        setupConfirmationForm(finalCommand);
      } else {
        setStatus("error");
        const msg = aiData.explanation || "Ses kaydından bir komut anlaşılamadı. Lütfen tekrar konuşun veya komutu yazın.";
        setErrorMsg(msg);
        speak(msg);
      }
    } catch (err: any) {
      console.warn("[VoiceAssistant] Ses kaydı analizi başarısız:", err);
      setStatus("error");
      setErrorMsg("Ses algılanamadı veya sunucu yanıt vermedi. Lütfen tekrar deneyin veya komutunuzu yazarak girin.");
    }
  };

  /**
   * Kullanıcının sesli/yazılı metnini akıllı finansal analiz motoruyla eşler.
   */
  const processVoiceText = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;

    setStatus("processing");
    setErrorMsg("");

    // 1. Önce yerel akıllı kural motoruyla hızlı analiz yap
    const localParsed = parseFinancialVoiceCommand(textToProcess);

    // Durum raporu ise hemen yanıtla
    if (localParsed.action === "statusReport") {
      const totalIncomeVal = incomes.reduce((sum, inc) => sum + inc.amount, 0);
      const totalExpenseVal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const remainingSimpleDebt = debts.reduce((sum, d) => sum + (d.amount - d.paid), 0);
      const remainingInstallmentDebt = installmentDebts.reduce((sum, inst) => {
        const monthly = inst.totalAmount / inst.installmentCount;
        const paidValue = inst.paidInstallmentCount * monthly;
        return sum + (inst.totalAmount - paidValue);
      }, 0);
      const netBalance = totalIncomeVal - totalExpenseVal;
      const totalDebt = remainingSimpleDebt + remainingInstallmentDebt;

      const reportExplanation = `🔊 Bütçem Pro sesli durum raporu: Aylık toplam geliriniz ₺${totalIncomeVal.toLocaleString(
        "tr-TR"
      )}, aylık harcamalarınız ise ₺${totalExpenseVal.toLocaleString(
        "tr-TR"
      )}. Güncel net bakiyeniz ₺${netBalance.toLocaleString(
        "tr-TR"
      )}. Toplam aktif borcunuz ₺${totalDebt.toLocaleString("tr-TR")}.`;

      setSuccessMessage(reportExplanation);
      setStatus("success");
      speak(reportExplanation);
      return;
    }

    // 2. Sunucu Gemini AI destekli analizi dene, hata alırsan anında yerel analiz sonucunu kullan
    let finalCommand: ParsedVoiceCommand = localParsed;

    try {
      const res = await fetch(getApiUrl("/api/voice-command"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToProcess, userApiKey })
      });

      if (res.ok) {
        const aiData = await res.json();
        if (aiData.action && aiData.action !== "unknown") {
          // Gemini'den gelen veriyi standart ParsedVoiceCommand yapısına dönüştür
          finalCommand = mapServerResponseToParsedCommand(aiData, textToProcess, localParsed);
        }
      }
    } catch (apiErr) {
      console.warn("[VoiceAssistant] Sunucu analizine ulaşılamadı, yerel motor kullanılıyor:", apiErr);
    }

    // Eğer bilinmeyen veya geçersiz eylem ise kullanıcıya hata bildir
    if (finalCommand.action === "unknown") {
      setStatus("error");
      setErrorMsg(finalCommand.explanation);
      speak(finalCommand.explanation);
      return;
    }

    // Silme eylemleri doğrudan onay gerektirebilir veya hemen uygulanabilir
    if (
      finalCommand.action === "deleteDebt" ||
      finalCommand.action === "deleteIncome" ||
      finalCommand.action === "deleteExpense"
    ) {
      applyDeleteAction(finalCommand);
      return;
    }

    // Veri Ekleme / Güncelleme Modülleri (Borç, Gider, Gelir, Kişi Borcu, Taksit):
    // Kullanıcı talebine göre doğrudan form alanlarını doldur ve ONAY KARTINI aç!
    setupConfirmationForm(finalCommand);
  };

  /**
   * Sunucu yanıtını standart ParsedVoiceCommand yapısına dönüştürür.
   */
  const mapServerResponseToParsedCommand = (
    aiData: any,
    rawText: string,
    fallback: ParsedVoiceCommand
  ): ParsedVoiceCommand => {
    const action = aiData.action;
    const today = new Date().toISOString().slice(0, 10);

    if (action === "addContactDebt" && aiData.contactDebtData) {
      return {
        action: "addContactDebt",
        moduleTitle: "Kişi Borçları",
        explanation: aiData.explanation || fallback.explanation,
        data: {
          title: aiData.contactDebtData.contactName || fallback.data.title,
          amount: Number(aiData.contactDebtData.amount) || fallback.data.amount,
          date: today,
          contactType: aiData.contactDebtData.type === "receivable" ? "receivable" : "payable",
          category: "Kişi Borcu"
        },
        rawText
      };
    }

    if (action === "addExpense" && aiData.expenseData) {
      return {
        action: "addExpense",
        moduleTitle: "Gider / Harcama Ekleme",
        explanation: aiData.explanation || fallback.explanation,
        data: {
          title: aiData.expenseData.description || fallback.data.title,
          amount: Number(aiData.expenseData.amount) || fallback.data.amount,
          categoryId: Number(aiData.expenseData.categoryId) || fallback.data.categoryId || 1,
          date: today
        },
        rawText
      };
    }

    if (action === "addIncome" && aiData.incomeData) {
      return {
        action: "addIncome",
        moduleTitle: "Gelir Ekleme",
        explanation: aiData.explanation || fallback.explanation,
        data: {
          title: aiData.incomeData.name || fallback.data.title,
          amount: Number(aiData.incomeData.amount) || fallback.data.amount,
          date: aiData.incomeData.date || today
        },
        rawText
      };
    }

    if (action === "addDebt" && aiData.debtData) {
      return {
        action: "addDebt",
        moduleTitle: "Borç Ekleme",
        explanation: aiData.explanation || fallback.explanation,
        data: {
          title: aiData.debtData.name || fallback.data.title,
          amount: Number(aiData.debtData.amount) || fallback.data.amount,
          category: aiData.debtData.category || "Şahıs",
          date: aiData.debtData.dueDate || today
        },
        rawText
      };
    }

    if (action === "addInstallment" && aiData.installmentData) {
      return {
        action: "addInstallment",
        moduleTitle: "Taksit Planı Ekleme",
        explanation: aiData.explanation || fallback.explanation,
        data: {
          title: aiData.installmentData.name || fallback.data.title,
          amount: Number(aiData.installmentData.totalAmount) || fallback.data.amount,
          installmentCount: Number(aiData.installmentData.installmentCount) || 12,
          date: aiData.installmentData.firstDueDate || today
        },
        rawText
      };
    }

    if (action === "updateDebtPaid" && aiData.updateDebtData) {
      return {
        action: "updateDebtPaid",
        moduleTitle: "Borç Ödemesi",
        explanation: aiData.explanation || fallback.explanation,
        data: {
          title: aiData.updateDebtData.name || fallback.data.title,
          amount: Number(aiData.updateDebtData.paidAmount) || fallback.data.amount,
          isAbsolute: aiData.updateDebtData.isAbsolute ?? false,
          date: today
        },
        rawText
      };
    }

    return fallback;
  };

  /**
   * Önceden doldurulmuş alanları Onay Formuna bağlar.
   */
  const setupConfirmationForm = (cmd: ParsedVoiceCommand) => {
    setPendingCommand(cmd);
    setEditTitle(cmd.data.title);
    setEditAmount(cmd.data.amount);
    setEditDate(cmd.data.date || new Date().toISOString().slice(0, 10));
    setEditCategory(cmd.data.categoryId || cmd.data.category || 1);
    setEditContactType(cmd.data.contactType || "payable");
    setEditInstallmentCount(cmd.data.installmentCount || 12);

    setStatus("confirming");

    // Kullanıcıya sesli geri bildirim ver: Onay istiyor
    speak(cmd.explanation);
  };

  /**
   * Silme işlemlerini uygular
   */
  const applyDeleteAction = (cmd: ParsedVoiceCommand) => {
    const { action, data } = cmd;
    const query = data.title.toLowerCase().trim();

    if (action === "deleteExpense" && onDeleteExpense) {
      const match = expenses.find((e) => e.description.toLowerCase().includes(query));
      if (match) {
        onDeleteExpense(match.id);
        const msg = `"${match.description}" harcaması başarıyla silindi.`;
        triggerToast(msg);
        setSuccessMessage(msg);
        setStatus("success");
        speak(msg);
      } else {
        const fail = `"${data.title}" açıklamalı bir harcama bulunamadı.`;
        triggerToast(fail);
        setErrorMsg(fail);
        setStatus("error");
        speak(fail);
      }
    } else if (action === "deleteIncome" && onDeleteIncome) {
      const match = incomes.find((i) => i.name.toLowerCase().includes(query));
      if (match) {
        onDeleteIncome(match.id);
        const msg = `"${match.name}" geliri başarıyla silindi.`;
        triggerToast(msg);
        setSuccessMessage(msg);
        setStatus("success");
        speak(msg);
      } else {
        const fail = `"${data.title}" isimli bir gelir kaydı bulunamadı.`;
        triggerToast(fail);
        setErrorMsg(fail);
        setStatus("error");
        speak(fail);
      }
    } else if (action === "deleteDebt" && onDeleteDebt) {
      const match = debts.find((d) => d.name.toLowerCase().includes(query));
      if (match) {
        onDeleteDebt(match.id);
        const msg = `"${match.name}" borcu başarıyla silindi.`;
        triggerToast(msg);
        setSuccessMessage(msg);
        setStatus("success");
        speak(msg);
      } else {
        const fail = `"${data.title}" isimli bir borç kaydı bulunamadı.`;
        triggerToast(fail);
        setErrorMsg(fail);
        setStatus("error");
        speak(fail);
      }
    }
  };

  /**
   * Kullanıcı Onay Butonuna bastığında veya sesli onay verdiğinde kaydı tamamlar!
   */
  const handleConfirmAndSave = () => {
    if (!pendingCommand) return;

    const action = pendingCommand.action;
    const title = editTitle.trim() || pendingCommand.data.title;
    const amount = Number(editAmount) || 0;
    const date = editDate || new Date().toISOString().slice(0, 10);

    if (amount <= 0) {
      triggerToast("Lütfen geçerli bir tutar girin.");
      return;
    }

    try {
      switch (action) {
        case "addContactDebt":
          if (onSaveContactTx) {
            onSaveContactTx(
              title,
              amount,
              editContactType,
              `Sesli Asistan: ${title}`
            );
            const msg = `"${title}" kişisine ₺${amount.toLocaleString("tr-TR")} tutarında ${
              editContactType === "receivable" ? "Alacak" : "Verecek/Borç"
            } kaydı başarıyla eklendi.`;
            triggerToast(msg);
            setSuccessMessage(msg);
            speak(msg);
          }
          break;

        case "addExpense":
          onSaveExpense({
            description: title,
            amount,
            categoryId: typeof editCategory === "number" ? editCategory : 1
          });
          const expMsg = `"${title}" için ₺${amount.toLocaleString("tr-TR")} tutarında harcama bütçenize kaydedildi.`;
          triggerToast(expMsg);
          setSuccessMessage(expMsg);
          speak(expMsg);
          break;

        case "addIncome":
          onSaveIncome({
            name: title,
            amount,
            date
          });
          const incMsg = `"${title}" unvanıyla ₺${amount.toLocaleString("tr-TR")} tutarında gelir başarıyla eklendi.`;
          triggerToast(incMsg);
          setSuccessMessage(incMsg);
          speak(incMsg);
          break;

        case "addDebt":
          onSaveDebt(
            {
              name: title,
              amount,
              paid: 0,
              category: typeof editCategory === "string" ? editCategory : "Şahıs",
              dueDate: date
            },
            true
          );
          const debtMsg = `"${title}" olarak ₺${amount.toLocaleString("tr-TR")} tutarında borç kaydedildi.`;
          triggerToast(debtMsg);
          setSuccessMessage(debtMsg);
          speak(debtMsg);
          break;

        case "addInstallment":
          onSaveInstallment({
            name: title,
            totalAmount: amount,
            installmentCount: editInstallmentCount,
            paidInstallmentCount: 0,
            firstDueDate: date
          });
          const instMsg = `${editInstallmentCount} Ay taksitli "${title}" planınız (₺${amount.toLocaleString(
            "tr-TR"
          )}) başarıyla oluşturuldu.`;
          triggerToast(instMsg);
          setSuccessMessage(instMsg);
          speak(instMsg);
          break;

        case "updateDebtPaid":
          const query = title.toLowerCase().trim();
          const match =
            debts.find((d) => d.name.toLowerCase().trim() === query) ||
            debts.find((d) => d.name.toLowerCase().includes(query)) ||
            debts.find((d) => query.includes(d.name.toLowerCase()));

          if (match) {
            const isAbs = pendingCommand.data.isAbsolute ?? false;
            const newPaid = isAbs ? amount : (match.paid || 0) + amount;
            onSaveDebt({
              ...match,
              paid: newPaid
            });
            const updateMsg = `"${match.name}" borcunun ödenmiş miktarı ₺${newPaid.toLocaleString("tr-TR")} olarak güncellendi.`;
            triggerToast(updateMsg);
            setSuccessMessage(updateMsg);
            speak(updateMsg);
          } else {
            const fail = `"${title}" unvanlı bir borç kaydı bulunamadı.`;
            triggerToast(fail);
            setErrorMsg(fail);
            setStatus("error");
            speak(fail);
            return;
          }
          break;
      }

      setStatus("success");
      setPendingCommand(null);
    } catch (err: any) {
      console.error("[VoiceAssistant] Kayıt hatası:", err);
      triggerToast("Kayıt sırasında bir hata oluştu.");
      setErrorMsg("Kayıt veritabanına eklenirken bir sorun oluştu.");
      setStatus("error");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setTranscript(manualInput);
    processVoiceText(manualInput);
  };

  const handleQuickCommand = (sampleCmd: string) => {
    setManualInput(sampleCmd);
    setTranscript(sampleCmd);
    processVoiceText(sampleCmd);
  };

  const toggleOpen = () => {
    if (!isPremium) {
      onUpgradeClick?.();
      return;
    }
    speechService.stopSpeaking();

    const next = !isOpen;
    setIsOpen(next);

    if (!next) {
      speechService.stopListening();
      setIsListening(false);
      setStatus("idle");
      setTranscript("");
      setManualInput("");
      setPendingCommand(null);
      setErrorMsg("");
    } else {
      setStatus("idle");
      setTranscript("");
      setManualInput("");
      setPendingCommand(null);
      setErrorMsg("");
    }
  };

  return (
    <>
      {/* Kayan Mikrofon Tetikleme Butonu */}
      <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-6 z-40">
        <motion.button
          onClick={toggleOpen}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.95 }}
          animate={isOpen ? { rotate: 90 } : {}}
          className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-lg hover:shadow-indigo-500/30 cursor-pointer border border-indigo-400/30 transition-shadow group"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <div className="relative">
              <Mic className="w-6 h-6" />
              {isPremium ? (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-pink-500"></span>
                </span>
              ) : (
                <span className="absolute -top-2.5 -right-2.5 bg-amber-500 text-[6.5px] scale-90 font-black px-1 py-0.5 rounded-sm select-none border border-amber-300 shadow-sm animate-pulse text-white font-mono flex items-center gap-0.5">
                  <Crown className="w-2 h-2" /> PRO
                </span>
              )}
            </div>
          )}

          <span className="absolute right-16 bg-slate-900 border border-slate-700 text-slate-100 text-[10px] font-black uppercase py-1 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none tracking-wider shadow-md whitespace-nowrap">
            {isPremium ? "Sesli Asistan 🎙️" : "Sesli Asistan (PRO) 👑"}
          </span>
        </motion.button>
      </div>

      {/* Sesli Asistan Ana Modal Penceresi */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-end sm:items-center justify-center p-4">
            {/* Arka Plan Bulanıklığı */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleOpen}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer"
            />

            {/* Modal Kartı */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 26, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh] sm:max-h-[85vh] z-10"
            >
              {/* Başlık Çubuğu */}
              <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white flex items-center gap-1.5 leading-none">
                      Bütçem Akıllı Sesli Asistan
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 inline" /> Pro Ses ve Yapay Zekâ Analiz Modülü
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (audioEnabled) {
                        speechService.stopSpeaking();
                      }
                      setAudioEnabled(!audioEnabled);
                    }}
                    className={`p-2 rounded-xl transition ${
                      audioEnabled
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                    }`}
                    title={audioEnabled ? "Sesli Yanıt Açık" : "Sesli Yanıt Kapalı"}
                  >
                    {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOpen();
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* İçerik Gövdesi */}
              <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5">
                {/* 1. Ses Dalgaları / Görsel Geri Bildirim Paneli */}
                <div className="flex flex-col items-center justify-center py-5 px-4 bg-slate-950/50 rounded-2xl border border-slate-800 relative overflow-hidden min-h-[170px]">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Dinleniyor Modu: Canlı Ses Şiddetine Göre Dalgalanan Animasyon */}
                  {isListening ? (
                    <div className="space-y-4 flex flex-col items-center justify-center w-full">
                      {/* Gerçek zamanlı dalgalar */}
                      <div className="flex items-center justify-center gap-1.5 h-16 w-full">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((bar) => {
                          const baseHeight = 12;
                          // micVolume (0-100) arttıkça barlar canlı şekilde yükselir
                          const dynamicHeight = Math.max(
                            baseHeight,
                            Math.min(58, baseHeight + (micVolume / 100) * 46 * (0.4 + (bar % 3) * 0.3))
                          );
                          return (
                            <motion.span
                              key={bar}
                              animate={{
                                height: [`${dynamicHeight * 0.7}px`, `${dynamicHeight}px`, `${dynamicHeight * 0.8}px`]
                              }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.35 + (bar % 4) * 0.1,
                                ease: "easeInOut"
                              }}
                              className="w-1.5 sm:w-2 rounded-full bg-gradient-to-t from-indigo-500 via-purple-500 to-pink-500"
                            />
                          );
                        })}
                      </div>

                      <div className="flex flex-col items-center gap-1.5">
                        <p className="text-xs text-indigo-300 font-extrabold tracking-wide uppercase animate-pulse">
                          Sizi dinliyorum, lütfen konuşun...
                        </p>
                        <span className="text-[9px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                          CANLI MİKROFON AKTİF
                        </span>

                        <motion.button
                          type="button"
                          onClick={(e) => handleStopListening(e)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
                        >
                          <span className="w-2.5 h-2.5 rounded-sm bg-white animate-pulse" />
                          <span>Kaydı Tamamla / Dinlemeyi Bitir ⏹️</span>
                        </motion.button>
                      </div>
                    </div>
                  ) : status === "processing" ? (
                    <div className="space-y-3 flex flex-col items-center">
                      <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                      <p className="text-xs text-indigo-200 font-extrabold tracking-wide uppercase animate-pulse">
                        Söylediklerinizi finansal olarak analiz ediyorum...
                      </p>
                    </div>
                  ) : status === "confirming" && pendingCommand ? (
                    /* 2. Akıllı Ön-Doldurulmuş Form & Onay Kartı */
                    <div className="w-full space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                            {pendingCommand.action === "addContactDebt" && <UserCheck className="w-4 h-4" />}
                            {pendingCommand.action === "addExpense" && <TrendingDown className="w-4 h-4" />}
                            {pendingCommand.action === "addIncome" && <TrendingUp className="w-4 h-4" />}
                            {pendingCommand.action === "addDebt" && <CreditCard className="w-4 h-4" />}
                            {pendingCommand.action === "addInstallment" && <Layers className="w-4 h-4" />}
                            {pendingCommand.action === "updateDebtPaid" && <FileCheck2 className="w-4 h-4" />}
                          </span>
                          <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">
                            {pendingCommand.moduleTitle}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Onayınız Bekleniyor
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 font-medium leading-relaxed italic bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-500/20">
                        "{pendingCommand.explanation}"
                      </p>

                      {/* İnteraktif Ön-Doldurulmuş Form Alanları */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            {pendingCommand.action === "addContactDebt"
                              ? "Kişi Adı"
                              : pendingCommand.action === "addExpense"
                              ? "Harcama Açıklaması"
                              : pendingCommand.action === "addIncome"
                              ? "Gelir Unvanı"
                              : "Borç / Plan Adı"}
                          </label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Tutar (₺)
                          </label>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        {/* Kişi Borcu için Yön Seçici */}
                        {pendingCommand.action === "addContactDebt" && (
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                              Borç / Alacak Türü
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setEditContactType("receivable")}
                                className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                                  editContactType === "receivable"
                                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30"
                                    : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                                }`}
                              >
                                Alacak (Ondan Alacağım Var)
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditContactType("payable")}
                                className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                                  editContactType === "payable"
                                    ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30"
                                    : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                                }`}
                              >
                                Verecek (Ona Borcum Var)
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Harcama için Kategori Seçici */}
                        {pendingCommand.action === "addExpense" && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                              Gider Kategorisi
                            </label>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-hidden"
                            >
                              <option value={1}>Diğer / Genel</option>
                              <option value={2}>Market Alışverişi</option>
                              <option value={3}>Ulaşım / Yakıt</option>
                              <option value={4}>Yeme & İçme</option>
                              <option value={5}>Faturalar (Elektrik, Su, vb.)</option>
                            </select>
                          </div>
                        )}

                        {/* Taksit için Taksit Sayısı */}
                        {pendingCommand.action === "addInstallment" && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                              Taksit Sayısı (Ay)
                            </label>
                            <input
                              type="number"
                              value={editInstallmentCount}
                              onChange={(e) => setEditInstallmentCount(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-hidden"
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Tarih / Vade
                          </label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Onaylama Butonları */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleConfirmAndSave}
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95 transition"
                        >
                          <Check className="w-4 h-4" />
                          <span>Onayla ve Kaydet</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPendingCommand(null);
                            setStatus("idle");
                          }}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 cursor-pointer active:scale-95 transition"
                        >
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  ) : status === "success" ? (
                    <div className="space-y-3 flex flex-col items-center text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-bounce">
                        <Check className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black text-emerald-400 tracking-wider uppercase bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/15">
                        İŞLEM BAŞARIYLA KAYDEDİLDİ
                      </span>
                      <p className="text-xs font-bold text-slate-200 leading-relaxed max-w-sm">
                        {successMessage || "Bütçe kaydınız ilgili modüle hatasız olarak aktarılmıştır."}
                      </p>
                      <div className="flex gap-2.5 mt-2">
                        <button
                          type="button"
                          onClick={(e) => handleStartListening(e)}
                          className="flex items-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition active:scale-95 cursor-pointer shadow-md hover:shadow-indigo-500/20 border border-indigo-400/20"
                        >
                          <Mic className="w-3.5 h-3.5" /> Yeni Komut Söyle
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatus("idle");
                            setTranscript("");
                            setManualInput("");
                            setSuccessMessage("");
                          }}
                          className="py-2 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white rounded-xl transition active:scale-95 cursor-pointer"
                        >
                          Temizle
                        </button>
                      </div>
                    </div>
                  ) : status === "error" ? (
                    <div className="space-y-3 flex flex-col items-center text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-rose-300 max-w-sm">
                        {errorMsg || "Bir sorun oluştu. Lütfen tekrar deneyin."}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleStartListening(e)}
                          className="py-1 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition active:scale-95 cursor-pointer mt-1"
                        >
                          Tekrar Dinle
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Boşta (Idle) Durumu: Mikrofona Dokunma Çağrısı */
                    <div className="flex flex-col items-center space-y-3">
                      <motion.button
                        type="button"
                        onClick={(e) => handleStartListening(e)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.94 }}
                        className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 hover:text-white hover:bg-indigo-600 flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-600/20 transition-all group"
                      >
                        <Mic className="w-7 h-7 group-hover:scale-110 transition-transform" />
                      </motion.button>
                      <p className="text-xs text-slate-300 font-extrabold max-w-xs text-center leading-relaxed">
                        Konuşmak için mikrofona dokunun
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Örn: "Ahmet'e 5000 TL borç ekle" veya "Elektrik faturasına 1200 TL gider yaz"
                      </span>
                    </div>
                  )}
                </div>

                {/* Algılanan Canlı Metin Göstergesi */}
                {transcript && (
                  <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      Algılanan Ses Dökümü
                    </span>
                    <p className="text-slate-200 font-medium italic">"{transcript}"</p>
                  </div>
                )}

                {/* Yazılı / Düzenlenebilir Komut Girişi */}
                <form onSubmit={handleManualSubmit} className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Yazılı Komut Gönder (Alternatif)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Örn: Ahmet'e 5000 TL borç ekle veya Market 250 TL"
                      disabled={isListening || status === "processing"}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl py-3 pl-4 pr-12 text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 transition"
                    />
                    <button
                      type="submit"
                      disabled={!manualInput.trim() || isListening || status === "processing"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl transition active:scale-95 cursor-pointer"
                    >
                      {status === "processing" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </form>

                {/* Pratik Örnek Sesli Komut Kartları */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Örnek Türkçe Sesli Komutlar:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Ahmet'e 5000 TL borç ekle")}
                      className="p-2.5 bg-slate-950/40 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-indigo-200">Kişi Borcu Ekle</span>
                        <span className="text-[10px] text-slate-400">"Ahmet'e 5000 TL borç ekle"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Bugün elektrik faturasına 1200 TL gider yaz")}
                      className="p-2.5 bg-slate-950/40 hover:bg-indigo-950/30 border border-slate-800 hover:border-rose-500/40 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-rose-200">Fatura / Gider Yaz</span>
                        <span className="text-[10px] text-slate-400">"Elektrik faturasına 1200 TL gider yaz"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Market alışverişi 350 lira gider")}
                      className="p-2.5 bg-slate-950/40 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <TrendingDown className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-amber-200">Market Harcaması</span>
                        <span className="text-[10px] text-slate-400">"Market alışverişi 350 lira gider"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Maaş yattı 45000 TL gelir ekle")}
                      className="p-2.5 bg-slate-950/40 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-emerald-200">Maaş / Gelir Ekle</span>
                        <span className="text-[10px] text-slate-400">"Maaş yattı 45000 TL gelir ekle"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Telefon taksiti 24000 TL 12 taksit")}
                      className="p-2.5 bg-slate-950/40 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <CreditCard className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-purple-200">Taksit Planı</span>
                        <span className="text-[10px] text-slate-400">"Telefon 24000 TL 12 taksit"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Bütçe durum raporu ver")}
                      className="p-2.5 bg-slate-950/40 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-sky-200">Sesli Bütçe Raporu</span>
                        <span className="text-[10px] text-slate-400">"Bütçe durum raporu ver"</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Alt Bilgi Çubuğu */}
              <div className="p-3.5 bg-slate-950 px-6 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-400">
                <Info className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                <span>
                  Asistan cümlenizi otomatik olarak doğru modüle eşler, form alanlarını doldurur ve kaydetmeden önce onayınızı alır.
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

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
  UserCheck
} from "lucide-react";

import { Debt, Income, Expense, InstallmentDebt } from "../types";
import { getApiUrl } from "../utils/api";

function convertTurkishWordsToNumbers(text: string): string {
  let result = text;

  // Replacements for explicit phrases first (order matters: larger compounds first)
  const explicitPhrases: [RegExp, string][] = [
    [/(\b)bir milyon(\b)/gi, "1000000"],
    [/(\b)yüz elli bin(\b)/gi, "150000"],
    [/(\b)yüz bin(\b)/gi, "100000"],
    [/(\b)elli bin(\b)/gi, "50000"],
    [/(\b)kırk bin(\b)/gi, "40000"],
    [/(\b)otuz bin(\b)/gi, "30000"],
    [/(\b)yirmi bin(\b)/gi, "20000"],
    [/(\b)on bin(\b)/gi, "10000"],
    [/(\b)dokuz bin(\b)/gi, "9000"],
    [/(\b)sekiz bin(\b)/gi, "8000"],
    [/(\b)yedi bin(\b)/gi, "7000"],
    [/(\b)altı bin(\b)/gi, "6000"],
    [/(\b)beş bin(\b)/gi, "5000"],
    [/(\b)dört bin(\b)/gi, "4000"],
    [/(\b)üç bin(\b)/gi, "3000"],
    [/(\b)iki bin(\b)/gi, "2000"],
    [/(\b)bin(\b)/gi, "1000"],
    [/(\b)beş yüz(\b)/gi, "500"],
    [/(\b)yedi yüz elli(\b)/gi, "750"],
    [/(\b)yedi yüz(\b)/gi, "700"],
    [/(\b)sekiz yüz(\b)/gi, "800"],
    [/(\b)dokuz yüz(\b)/gi, "900"],
    [/(\b)dört yüz(\b)/gi, "400"],
    [/(\b)üç yüz(\b)/gi, "300"],
    [/(\b)iki yüz(\b)/gi, "200"],
    [/(\b)yüz(\b)/gi, "100"],
    [/(\b)on iki(\b)/gi, "12"],
    [/(\b)on altı(\b)/gi, "16"],
    [/(\b)on sekiz(\b)/gi, "18"],
    [/(\b)yirmi dört(\b)/gi, "24"],
    [/(\b)otuz altı(\b)/gi, "36"]
  ];

  explicitPhrases.forEach(([regex, replacement]) => {
    result = result.replace(regex, replacement);
  });

  return result;
}

function cleanTurkishPersonName(rawName: string): string {
  let name = rawName.trim();
  // Strip any apostrophe suffix first e.g. Ahmet'e -> Ahmet
  if (name.includes("'") || name.includes("’")) {
    name = name.split(/['"’]/)[0].trim();
  }

  // Also strip suffix attached without apostrophe (common in browser speech recognition output)
  // e.g., Ahmete, Ahmetten, Ahmetye, Mehmetten, Mehmetye, Ayseden, Ayseye, Zeynepe
  name = name.replace(/(den|dan|ten|tan|nin|nın|nun|nün|ye|ya|de|da|te|ta|e|a)$/gi, (match, suffix, offset, fullStr) => {
    if (fullStr.length - match.length >= 3) {
      return "";
    }
    return match;
  });

  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

function parseVoiceCommandOfflineClient(rawText: string): any {
  // Convert spoken number words (e.g., "beş bin") to digits ("5000") first
  const text = convertTurkishWordsToNumbers(rawText);
  const norm = text.toLowerCase().trim();
  
  // Clean text of punctuation and replace some typical Turkish speech transcription artifacts
  const cleanNorm = norm
    .replace(/['"’\.]/g, "")
    .replace(/lira/gi, "tl")
    .replace(/türk lirası/gi, "tl");

  // Check for deletion first (since it might not contain a number, e.g. "Maaş gelirini sil" or "Ahmet borcunu sil")
  if (cleanNorm.includes("sil") || cleanNorm.includes("çıkar") || cleanNorm.includes("cikar") || cleanNorm.includes("kaldır") || cleanNorm.includes("kaldir")) {
    if (cleanNorm.includes("gelir")) {
      const name = text.replace(/(gelir|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteIncome",
        deleteIncomeData: { name },
        explanation: `🔊 Çevrimdışı Analiz: "${name || 'Gelir'}" unvanlı gelir kaydınızın silinmesini talep ettiniz. İşlem gerçekleştiriliyor.`
      };
    } else if (cleanNorm.includes("borç") || cleanNorm.includes("borc")) {
      const name = text.replace(/(borç|borc|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteDebt",
        deleteDebtData: { name },
        explanation: `🔊 Çevrimdışı Analiz: "${name || 'Borç'}" unvanlı borç kaydınızın silinmesini talep ettiniz. İşlem gerçekleştiriliyor.`
      };
    } else {
      // Default assume expense
      const desc = text.replace(/(harcama|gider|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteExpense",
        deleteExpenseData: { description: desc },
        explanation: `🔊 Çevrimdışı Analiz: "${desc || 'Harcama'}" unvanlı harcama kaydınızın silinmesini talep ettiniz. İşlem gerçekleştiriliyor.`
      };
    }
  }

  // Extract all numbers
  const numMatches = [...cleanNorm.matchAll(/(\d+[\d\s,.]*)/g)];
  if (numMatches.length === 0) {
    return {
      action: "unknown",
      explanation: `🤔 Söylediğiniz ifadede herhangi bir tutar/sayı algılayamadım: "${rawText}". Lütfen: "Ahmet 5000 lira borç verdim", "Market 150 TL" gibi bir tutar belirterek söyleyin.`
    };
  }

  // Parse the first number found (amount)
  let amount = 0;
  const rawNum1 = numMatches[0][1].replace(/\s/g, "");
  if (rawNum1.includes(",") && rawNum1.includes(".")) {
    amount = parseFloat(rawNum1.replace(/\./g, "").replace(/,/g, "."));
  } else if (rawNum1.includes(",")) {
    const parts = rawNum1.split(",");
    if (parts[1].length <= 2) {
      amount = parseFloat(rawNum1.replace(/,/g, "."));
    } else {
      amount = parseFloat(rawNum1.replace(/,/g, ""));
    }
  } else {
    amount = parseFloat(rawNum1);
  }

  amount = isNaN(amount) ? 0 : amount;

  if (amount <= 0) {
    return {
      action: "unknown",
      explanation: `🤔 Söylediğiniz ifadedeki tutar geçersiz: "${rawText}". Lütfen geçerli bir miktar belirtin.`
    };
  }

  // 1. Taksit (taksit, ay taksit, taksitle)
  if (cleanNorm.includes("taksit")) {
    let installmentCount = 12; // default
    if (numMatches.length >= 2) {
      const parsedCount = parseInt(numMatches[1][1].replace(/\s/g, ""));
      if (!isNaN(parsedCount) && parsedCount > 0) {
        installmentCount = parsedCount;
      }
    }
    
    let name = "Taksit Planı";
    const cleanedName = text.replace(/\d+/g, "").replace(/(taksit|taksitli|tl|türk lirası|lira|₺|ekle|kaydet|borç|borc|için|icin)/gi, "").trim();
    if (cleanedName.length > 2) {
      name = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }

    return {
      action: "addInstallment",
      installmentData: {
        name,
        totalAmount: amount,
        installmentCount,
        paidInstallmentCount: 0,
        firstDueDate: new Date().toISOString().slice(0, 10)
      },
      explanation: `🔊 Çevrimdışı Analiz: ${installmentCount} Ay taksitli "${name}" (Toplam: ₺${amount}) planınız başarıyla tanımlandı.`
    };
  }

  // 2. Income/Gelir (gelir, maaş, alacak, aldım, kazandım, yattı, yatti, yatta)
  if (cleanNorm.includes("gelir") || cleanNorm.includes("maaş") || cleanNorm.includes("maas") || cleanNorm.includes("kazandım") || cleanNorm.includes("kazandim") || cleanNorm.includes("yattı") || cleanNorm.includes("yatti") || cleanNorm.includes("yatta")) {
    let name = "Sesli Gelir";
    const cleanedName = text.replace(/\d+/g, "").replace(/(gelir|maaş|maas|tl|türk lirası|lira|₺|ekle|kaydet|aldım|aldim|kazandım|kazandim|yattı|yatti|yatta|için|icin|alacak)/gi, "").trim();
    if (cleanedName.length > 2) {
      name = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }

    return {
      action: "addIncome",
      incomeData: { name, amount, date: new Date().toISOString().slice(0, 10) },
      explanation: `🔊 Çevrimdışı Analiz: "${name}" bütçenize ₺${amount} tutarında gelir olarak eklenmiştir.`
    };
  }

  // 3. Debt update (e.g., 'Ahmet borcunun ödenen kısmını 500 TL yap' or 'Mehmet borcuna 200 TL ödedim')
  if ((cleanNorm.includes("borç") || cleanNorm.includes("borc")) && (cleanNorm.includes("ödenen") || cleanNorm.includes("yap") || cleanNorm.includes("güncelle") || cleanNorm.includes("guncelle") || cleanNorm.includes("öde") || cleanNorm.includes("ode") || cleanNorm.includes("tutar") || cleanNorm.includes("miktar"))) {
    const isAbsolute = cleanNorm.includes("yap") || cleanNorm.includes("olsun") || cleanNorm.includes("eşitle") || cleanNorm.includes("esitle");
    
    let debtName = "";
    const matchName = text.match(/^(.*?)(?:borç|borc|ödenen|ode|yap|güncelle|tutar|miktar)/i);
    if (matchName && matchName[1].trim().length > 1) {
      debtName = cleanTurkishPersonName(matchName[1]);
    }

    if (debtName) {
      return {
        action: "updateDebtPaid",
        updateDebtData: {
          name: debtName,
          paidAmount: amount,
          isAbsolute
        },
        explanation: `🔊 Çevrimdışı Analiz: "${debtName}" borcunun ödenen kısmı ₺${amount} olarak ${isAbsolute ? 'güncellenecektir.' : 'artırılacaktır.'}`
      };
    }
  }

  // 4. Debt/Borç (borç, borc, verecek, borçlandım, aldım, borclandim, borçlandık, borclandik, alacak)
  if (cleanNorm.includes("borç") || cleanNorm.includes("borc") || cleanNorm.includes("borçlandım") || cleanNorm.includes("borclandim") || cleanNorm.includes("borçlandık") || cleanNorm.includes("borclandik") || cleanNorm.includes("verecek") || cleanNorm.includes("alacak") || cleanNorm.includes("borcum")) {
    let name = "Sesli Borç";
    const cleanedName = text.replace(/\d+/g, "").replace(/(borç|borc|tl|türk lirası|lira|₺|ekle|kaydet|borçlandım|borclandim|borçlandık|borclandik|için|icin|verecek|alacak|verdim|aldım|borcum)/gi, "").trim();
    if (cleanedName.length > 2) {
      name = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }

    const rawBaseName = name.split(/['"’\s-]/)[0].replace(/[0-9]/g, "");
    const baseName = cleanTurkishPersonName(rawBaseName);
    const isPerson = cleanNorm.includes("verdim") || cleanNorm.includes("aldım") || cleanNorm.includes("alacağım") || cleanNorm.includes("alacagim") || cleanNorm.includes("borcum") || cleanNorm.includes("vereceğim") || cleanNorm.includes("verecegim") || (cleanedName.length < 25 && !cleanNorm.includes("banka") && !cleanNorm.includes("kart") && !cleanNorm.includes("kredi"));

    if (isPerson && baseName.length > 1) {
      const isReceivable = cleanNorm.includes("verdim") || cleanNorm.includes("alacak") || cleanNorm.includes("alacağım") || cleanNorm.includes("alacagim") || cleanNorm.includes("bana borç") || cleanNorm.includes("bana borc");
      const pType = isReceivable ? "receivable" : "payable";

      return {
        action: "addContactDebt",
        contactDebtData: {
          contactName: baseName,
          amount,
          type: pType,
          description: "Sesli kayıt ile otomatik oluşturuldu"
        },
        explanation: `🔊 Çevrimdışı Analiz: Kişi rehberinizdeki "${baseName}" isimli kişiye ₺${amount} tutarında ${pType === "receivable" ? "alacak" : "verecek/borç"} kaydı başarıyla eklenmiştir.`
      };
    }

    let debtCategory = "Şahıs";
    if (cleanNorm.includes("banka") || cleanNorm.includes("kredi")) debtCategory = "Banka";
    else if (cleanNorm.includes("kart")) debtCategory = "Kredi Kartı";
    else if (cleanNorm.includes("fatura")) debtCategory = "Fatura";
    else if (cleanNorm.includes("aidat")) debtCategory = "Aidat";

    return {
      action: "addDebt",
      debtData: {
        name,
        amount,
        paid: 0,
        category: debtCategory,
        dueDate: new Date().toISOString().slice(0, 10)
      },
      explanation: `🔊 Çevrimdışı Analiz: "${name}" olarak ₺${amount} değerinde yeni bir borç eklenmiştir.`
    };
  }

  // 5. Default Fallback -> It is an Expense! (market, gıda, yemek, fatura, benzin, vb. or simply general phrase with numbers)
  let categoryId = 1; // Default: Diğer
  let desc = "Gider Kaydı";
  
  if (cleanNorm.includes("market") || cleanNorm.includes("gıda") || cleanNorm.includes("gida") || cleanNorm.includes("manav") || cleanNorm.includes("süpermarket") || cleanNorm.includes("supermarket")) {
    categoryId = 2; // Market
    desc = "Market Gideri";
  } else if (cleanNorm.includes("ulaşım") || cleanNorm.includes("ulasim") || cleanNorm.includes("yol") || cleanNorm.includes("taksi") || cleanNorm.includes("yakıt") || cleanNorm.includes("benzin") || cleanNorm.includes("otobüs") || cleanNorm.includes("bilet")) {
    categoryId = 3; // Ulaşım
    desc = "Ulaşım Gideri";
  } else if (cleanNorm.includes("yemek") || cleanNorm.includes("kafe") || cleanNorm.includes("cafe") || cleanNorm.includes("lokanta") || cleanNorm.includes("restoran") || cleanNorm.includes("döner") || cleanNorm.includes("pizz")) {
    categoryId = 4; // Yeme İçme
    desc = "Yemek Gideri";
  } else if (cleanNorm.includes("fatura") || cleanNorm.includes("elektrik") || cleanNorm.includes("su") || cleanNorm.includes("gaz") || cleanNorm.includes("telefon") || cleanNorm.includes("internet") || cleanNorm.includes("aidat")) {
    categoryId = 5; // Faturalar
    desc = "Fatura Ödemesi";
  }

  const cleanedDesc = text.replace(/\d+/g, "").replace(/(gider|harcama|tl|türk lirası|lira|₺|ekle|kaydet|için|icin|satın|aldım|aldim|fatura|ödedim|odedim|ödeme|odeme)/gi, "").trim();
  if (cleanedDesc.length > 2) {
    desc = cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1);
  }

  return {
    action: "addExpense",
    expenseData: { amount, description: desc, categoryId },
    explanation: `🔊 Çevrimdışı Analiz: "${desc}" bütçenize ₺${amount} tutarında harcama olarak eklenmiştir.`
  };
}

interface VoiceAssistantProps {
  debts?: Debt[];
  incomes?: Income[];
  expenses?: Expense[];
  installmentDebts?: InstallmentDebt[];
  onSaveDebt: (debtData: any, autoCreateAlarm?: boolean) => void;
  onSaveIncome: (incData: any) => void;
  onSaveExpense: (expData: any) => void;
  onSaveInstallment: (instData: any) => void;
  onSaveContactTx?: (contactName: string, amount: number, type: "receivable" | "payable", description?: string) => void;
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
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "success" | "error">("idle");
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [micVolume, setMicVolume] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const isActiveRef = useRef(false);
  const accumulatedTranscriptRef = useRef<string>("");

  useEffect(() => {
    // Check initial support for speech recognition cross-browser / webview
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      // Cancel previous speakings
      window.speechSynthesis.cancel();

      // Clean emojis and replace currency signs so they are read beautifully in Turkish
      let cleanedText = text.replace(/₺/g, " TL");
      // Remove standard emojis and generic pictographs/decorations
      cleanedText = cleanedText.replace(/[\u{1F300}-\u{1F9FF}\u{1F400}-\u{1F6FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/gu, '');
      // Remove explicit symbolic characters
      cleanedText = cleanedText.replace(/[⏺️✔️❌🔊🤔👍👎📢🔔✨🌸⭐🌟⏰💼👥📈📉💹🛒🛠️📅🗓️🗺️❓❔❕❗]/gu, '');
      cleanedText = cleanedText.replace(/\s+/g, " ").trim();

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = "tr-TR";
      // Find a natural Turkish voice if possible
      const voices = window.speechSynthesis.getVoices();
      const trVoice = voices.find(v => v.lang.startsWith("tr"));
      if (trVoice) {
        utterance.voice = trVoice;
      }
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS Readback failure:", e);
    }
  };

  const startListening = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      triggerToast("Cihazınızda/tarayıcınızda ses tanıma servisi bulunamadı, komutunuzu yazarak iletebilirsiniz.");
      setErrorMsg("Cihazınızda ses tanıma özelliği desteklenmiyor. Lütfen aşağıdaki alandan yazılı komut girin.");
      setStatus("error");
      return;
    }
    
    // Stop any ongoing speech synthesis
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    setTranscript("");
    setErrorMsg("");
    setAiResponse(null);

    // Explicitly request microphone stream in Android WebView / Browser if supported
    // This triggers the Android OS microphone permission dialog if not already granted.
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (micErr: any) {
        console.warn("Microphone permission check warning:", micErr);
        if (micErr?.name === "NotAllowedError" || micErr?.name === "PermissionDeniedError") {
          setIsListening(false);
          isActiveRef.current = false;
          setMicVolume(0);
          setStatus("error");
          setErrorMsg("Mikrofon izni verilmedi. Lütfen cihaz/uygulama izinlerinden mikrofona izin verin.");
          triggerToast("Mikrofon izni verilmedi. Lütfen uygulama izinlerinden mikrofonu açın.");
          return;
        }
      }
    }

    // If already active, safely abort before restarting
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = false;
      rec.lang = "tr-TR";
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        isActiveRef.current = true;
        setIsListening(true);
        setStatus("listening");
        setErrorMsg("");
        accumulatedTranscriptRef.current = "";
        setMicVolume(30);
      };

      rec.onresult = (event: any) => {
        try {
          let fullTranscript = "";
          for (let i = 0; i < event.results.length; ++i) {
            fullTranscript += event.results[i][0].transcript;
          }

          if (fullTranscript.trim()) {
            setTranscript(fullTranscript);
            setManualInput(fullTranscript);
            accumulatedTranscriptRef.current = fullTranscript;
            setMicVolume(Math.floor(Math.random() * 40) + 40);
          }
        } catch (err) {
          console.warn("Speech onresult parsing error:", err);
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        isActiveRef.current = false;
        setIsListening(false);
        setMicVolume(0);
        
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setErrorMsg("Mikrofon izni verilmedi. Lütfen tarayıcı/cihaz ayarlarından mikrofon iznini etkinleştirin.");
        } else if (event.error === "network") {
          setErrorMsg("Ortamda internet bağlantısı bulunamadı. Ses analizi için aktif internet bağlantısı gereklidir.");
        } else if (event.error === "no-speech") {
          setErrorMsg("Herhangi bir ses algılanamadı. Mikrofona biraz daha yakın durarak konuşmayı deneyin.");
        } else if (event.error === "aborted") {
          setStatus("idle");
          return;
        } else {
          setErrorMsg(`Ses servisi uyarısı (${event.error || "bilinmiyor"}). Lütfen tekrar deneyin veya komutunuzu yazın.`);
        }
        setStatus("error");
      };

      rec.onend = () => {
        isActiveRef.current = false;
        setIsListening(false);
        setMicVolume(0);
        
        const finalTxt = accumulatedTranscriptRef.current.trim();
        if (finalTxt) {
          handleProcessText(finalTxt);
          accumulatedTranscriptRef.current = "";
        } else {
          setStatus((prev) => (prev === "listening" ? "idle" : prev));
        }
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
      setStatus("listening");
      isActiveRef.current = true;
    } catch (e: any) {
      console.error("Speech Recognition startup error:", e);
      setIsListening(false);
      isActiveRef.current = false;
      setMicVolume(0);
      setStatus("error");
      setErrorMsg("Mikrofon başlatılamadı. Lütfen cihaz mikrofon izinlerini kontrol edin veya yazılı komut girin.");
    }
  };

  const stopListening = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        console.warn("Speech stop warning:", e);
      }
    }
    isActiveRef.current = false;
    setIsListening(false);
    setMicVolume(0);
  };

  const handleProcessText = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;

    setStatus("processing");
    setErrorMsg("");

    const lowerText = textToProcess.toLowerCase().trim();
    const isStatusReport = lowerText.includes("durum") || 
                           lowerText.includes("rapor") || 
                           lowerText.includes("özet") || 
                           lowerText.includes("ozet") || 
                           lowerText.includes("hesabım") || 
                           lowerText.includes("hesabim") ||
                           lowerText.includes("analiz") || 
                           lowerText.includes("ne durumda");

    if (isStatusReport) {
      // Calculate dynamic accurate metrics for the voice report
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

      const reportExplanation = `🔊 Bütçem Pro sesli durum raporu: Aylık toplam geliriniz ₺${totalIncomeVal.toLocaleString("tr-TR")}, aylık harcamalarınız ise ₺${totalExpenseVal.toLocaleString("tr-TR")}. Kullanılabilir güncel net bütçe bakiyeniz ₺${netBalance.toLocaleString("tr-TR")}. Toplam ödenmemiş aktif borç yükünüz ise ₺${totalDebt.toLocaleString("tr-TR")}. Finansal sağlığınızı yüksek tutmak için Bütçe Sağlığı ve Borç Kapama Rehberi sekmesindeki önerileri takip edebilirsiniz!`;

      const mockResponse = {
        action: "statusReport",
        explanation: reportExplanation
      };

      setAiResponse(mockResponse);
      setStatus("success");
      if (audioEnabled) {
        speakText(reportExplanation);
      }
      return;
    }

    try {
      const res = await fetch(getApiUrl("/api/voice-command"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToProcess, userApiKey }),
      });

      if (!res.ok) {
        throw new Error("Sunucu bağlantısı kurulamadı (Ses Analizi).");
      }

      const data = await res.json();
      setAiResponse(data);

      if (data.action && data.action !== "unknown") {
        applyAction(data);
        setStatus("success");
        if (audioEnabled) {
          speakText(data.explanation);
        }
      } else {
        setStatus("error");
        setErrorMsg(data.explanation || "Söylediğiniz ifade bütçe şablonlarıyla eşleşmedi.");
        if (audioEnabled) {
          speakText(data.explanation || "Söylediğiniz ifade bütçe şablonlarıyla eşleşmedi. Lütfen farklı şekilde söylemeyi deneyin.");
        }
      }
    } catch (err: any) {
      console.warn("Sunucu bağlantısı kurulamadı, yerel/çevrimdışı ses analizine geçiliyor:", err);
      try {
        const offlineResult = parseVoiceCommandOfflineClient(textToProcess);
        setAiResponse(offlineResult);

        if (offlineResult.action && offlineResult.action !== "unknown") {
          applyAction(offlineResult);
          setStatus("success");
          if (audioEnabled) {
            speakText(offlineResult.explanation);
          }
        } else {
          setStatus("error");
          setErrorMsg(offlineResult.explanation || "Söylediğiniz ifadeyi bütçe şablonlarıyla eşleştiremedim.");
          if (audioEnabled) {
            speakText(offlineResult.explanation || "Söylediğiniz ifadeyi bütçe şablonlarıyla eşleştiremedim.");
          }
        }
      } catch (fallbackErr) {
        console.error("Yerel ses analizi de başarısız:", fallbackErr);
        setErrorMsg("Bütçe kaydı ayrıştırılırken bir servis hatası oluştu.");
        setStatus("error");
      }
    }
  };

  const applyAction = (data: any) => {
    const { 
      action, 
      debtData, 
      installmentData, 
      expenseData, 
      incomeData, 
      updateDebtData, 
      contactDebtData,
      deleteExpenseData,
      deleteIncomeData,
      deleteDebtData
    } = data;

    try {
      switch (action) {
        case "deleteExpense":
          if (onDeleteExpense && deleteExpenseData) {
            const queryDesc = (deleteExpenseData.description || "").toLowerCase().trim();
            if (queryDesc) {
              const match = expenses.find(e => e.description.toLowerCase().trim().includes(queryDesc));
              if (match) {
                onDeleteExpense(match.id);
                triggerToast(`"${match.description}" harcaması silindi.`);
                if (audioEnabled) {
                  speakText(`"${match.description}" harcaması başarıyla silinmiştir.`);
                }
              } else {
                const failMsg = `"${deleteExpenseData.description}" açıklamalı bir harcama bulunamadı.`;
                triggerToast(failMsg);
                if (audioEnabled) speakText(failMsg);
              }
            } else {
              triggerToast("Silinecek harcama adı anlaşılamadı.");
            }
          }
          break;

        case "deleteIncome":
          if (onDeleteIncome && deleteIncomeData) {
            const queryName = (deleteIncomeData.name || "").toLowerCase().trim();
            if (queryName) {
              const match = incomes.find(i => i.name.toLowerCase().trim().includes(queryName));
              if (match) {
                onDeleteIncome(match.id);
                triggerToast(`"${match.name}" geliri silindi.`);
                if (audioEnabled) {
                  speakText(`"${match.name}" geliri başarıyla silinmiştir.`);
                }
              } else {
                const failMsg = `"${deleteIncomeData.name}" açıklamalı bir gelir bulunamadı.`;
                triggerToast(failMsg);
                if (audioEnabled) speakText(failMsg);
              }
            } else {
              triggerToast("Silinecek gelir adı anlaşılamadı.");
            }
          }
          break;

        case "deleteDebt":
          if (onDeleteDebt && deleteDebtData) {
            const queryName = (deleteDebtData.name || "").toLowerCase().trim();
            if (queryName) {
              const match = debts.find(d => d.name.toLowerCase().trim().includes(queryName));
              if (match) {
                onDeleteDebt(match.id);
                triggerToast(`"${match.name}" borcu silindi.`);
                if (audioEnabled) {
                  speakText(`"${match.name}" borcu başarıyla silinmiştir.`);
                }
              } else {
                const failMsg = `"${deleteDebtData.name}" isimli bir borç bulunamadı.`;
                triggerToast(failMsg);
                if (audioEnabled) speakText(failMsg);
              }
            } else {
              triggerToast("Silinecek borç adı anlaşılamadı.");
            }
          }
          break;

        case "addContactDebt":
          if (onSaveContactTx && contactDebtData) {
            const { contactName, amount, type, description } = contactDebtData;
            onSaveContactTx(
              contactName || "Bilinmeyen Kişi",
              Number(amount) || 0,
              type === "payable" ? "payable" : "receivable",
              description || "Sesli asistan kaydı"
            );
          }
          break;
        case "updateDebtPaid":
          if (updateDebtData) {
            const { name, paidAmount, isAbsolute } = updateDebtData;
            const queryName = (name || "").toLowerCase().trim();
            if (!queryName) {
              triggerToast("Bulunacak borç adı belirtilmedi.");
              break;
            }

            // Find matching debt case-insensitively using exact, substring, or reverse matching
            let matchingDebt = debts.find(d => d.name.toLowerCase().trim() === queryName);
            if (!matchingDebt) {
              matchingDebt = debts.find(d => d.name.toLowerCase().includes(queryName));
            }
            if (!matchingDebt) {
              matchingDebt = debts.find(d => queryName.includes(d.name.toLowerCase()));
            }

            if (matchingDebt) {
              const previousPaid = matchingDebt.paid || 0;
              let newPaidVal = 0;
              if (isAbsolute) {
                newPaidVal = Number(paidAmount);
              } else {
                newPaidVal = previousPaid + Number(paidAmount);
              }

              onSaveDebt({
                ...matchingDebt,
                paid: newPaidVal
              });

              const feedbackMsg = `"${matchingDebt.name}" borcunun ödenmiş miktarı ₺${newPaidVal} olarak güncellendi.`;
              triggerToast(feedbackMsg);
              if (audioEnabled) {
                speakText(feedbackMsg);
              }
            } else {
              const failMsg = `"${name}" unvanlı aktif bir borç kaydı bulunamadı. Lütfen adı kontrol edin.`;
              triggerToast(failMsg);
              if (audioEnabled) {
                speakText(failMsg);
              }
              setStatus("error");
              setErrorMsg(failMsg);
            }
          }
          break;

        case "addDebt":
          if (debtData) {
            onSaveDebt({
              name: debtData.name || "Sesli Borç",
              amount: Number(debtData.amount) || 0,
              paid: Number(debtData.paid) || 0,
              category: debtData.category || "Şahıs",
              dueDate: debtData.dueDate || new Date().toISOString().slice(0, 10)
            }, true); // Auto create alarm
          }
          break;

        case "addInstallment":
          if (installmentData) {
            onSaveInstallment({
              name: installmentData.name || "Sesli Taksit",
              totalAmount: Number(installmentData.totalAmount) || 0,
              installmentCount: Number(installmentData.installmentCount) || 12,
              paidInstallmentCount: Number(installmentData.paidInstallmentCount) || 0,
              firstDueDate: installmentData.firstDueDate || new Date().toISOString().slice(0, 10)
            });
          }
          break;

        case "addExpense":
          if (expenseData) {
            onSaveExpense({
              amount: Number(expenseData.amount) || 0,
              description: expenseData.description || "Sesli Harcama",
              categoryId: Number(expenseData.categoryId) || 1
            });
          }
          break;

        case "addIncome":
          if (incomeData) {
            onSaveIncome({
              name: incomeData.name || "Sesli Gelir",
              amount: Number(incomeData.amount) || 0,
              date: incomeData.date || new Date().toISOString().slice(0, 10)
            });
          }
          break;

        default:
          console.warn("Bilinmeyen asistan işlemi:", action);
      }
    } catch (e) {
      console.error("Sesli asistan eylem kaydı hatası:", e);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setTranscript(manualInput);
    handleProcessText(manualInput);
  };

  const handleQuickCommand = (sampleCmd: string) => {
    setManualInput(sampleCmd);
    setTranscript(sampleCmd);
    handleProcessText(sampleCmd);
  };



  const toggleOpen = () => {
    if (!isPremium) {
      onUpgradeClick?.();
      return;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsOpen(!isOpen);
    // Reset state on toggle
    if (!isOpen) {
      setStatus("idle");
      setTranscript("");
      setManualInput("");
      setAiResponse(null);
      setErrorMsg("");
    } else {
      stopListening();
    }
  };

  return (
    <>
      {/* Floating Microphone Trigger Pin Button */}
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
              <Mic className="w-6 h-6 animate-none" />
              {/* Pulsing indicator circle when audio/assistance is active */}
              {isPremium ? (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-pink-500"></span>
                </span>
              ) : (
                <span className="absolute -top-2.5 -right-2.5 bg-amber-500 text-[6.5px] scale-90 font-black px-1 py-0.5 rounded-sm select-none border border-amber-300 shadow-sm animate-pulse text-white font-mono">
                  PRO
                </span>
              )}
            </div>
          )}
          
          {/* Label tooltip hovering slightly on desktop search */}
          <span className="absolute right-16 bg-slate-900 border border-slate-700 text-slate-100 text-[10px] font-black uppercase py-1 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none tracking-wider shadow-md whitespace-nowrap">
            {isPremium ? "Sesli Asistan 🔊" : "Sesli Asistan (PRO) 👑"}
          </span>
        </motion.button>
      </div>

      {/* Slide-over Full Custom Dialog Panel */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-end sm:items-center justify-center p-4">
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleOpen}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
            />

            {/* Modal Dialog container */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh] sm:max-h-[80vh] z-10"
            >
              {/* Aesthetic Card Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 animate-pulse">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white flex items-center gap-1.5 leading-none">
                      Bütçem Sesli Asistanı
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">
                      Yapay Zekâ ile Akıllı Bütçe Girişi
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Speech synthesis audio feedback toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAudioEnabled(!audioEnabled);
                    }}
                    className={`p-2 rounded-xl transition ${
                      audioEnabled 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20" 
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                    }`}
                    title={audioEnabled ? "Sesli Onay Açık" : "Sesli Onay Kapalı"}
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

              {/* Scrollable Dynamic Body Content */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                
                {/* Visual Audio Waveform panel */}
                <div className="flex flex-col items-center justify-center py-6 bg-slate-950/40 rounded-2xl border border-slate-800 relative overflow-hidden min-h-[160px]">
                  
                  {/* Backdrop glowing sphere decoration */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                  {isListening ? (
                    <div className="space-y-4 flex flex-col items-center justify-center">
                      {/* Animated Soundwave lines */}
                      <div className="flex items-center gap-1.5 h-12">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
                          const delays = [0.1, 0.3, 0.5, 0.2, 0.4, 0.6, 0.15, 0.35, 0.45, 0.25];
                          return (
                            <motion.span
                              key={bar}
                              animate={{ 
                                height: ["12px", "42px", "16px", "48px", "14px"],
                                backgroundColor: ["#6366f1", "#a855f7", "#ec4899", "#6366f1"]
                              }}
                              transition={{ 
                                repeat: Infinity, 
                                duration: 1.1, 
                                delay: delays[bar - 1],
                                ease: "easeInOut"
                              }}
                              className="w-1.5 rounded-full"
                            />
                          );
                        })}
                      </div>
                      
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-indigo-300 font-extrabold animate-pulse tracking-wide uppercase">
                          Sizi dinliyorum, konuşun...
                        </p>
                        <span className="text-[9px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                          SES DİNLENİYOR (CANLI)
                        </span>

                        <motion.button
                          type="button"
                          onClick={(e) => stopListening(e)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
                        >
                          <span className="w-2.5 h-2.5 rounded-sm bg-white animate-pulse" />
                          <span>Kaydı Tamamla / Durdur ⏹️</span>
                        </motion.button>
                      </div>
                    </div>
                  ) : status === "processing" ? (
                    <div className="space-y-3 flex flex-col items-center">
                      <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                      <p className="text-xs text-indigo-200 font-extrabold tracking-wide uppercase animate-pulse">
                        Söylediklerinizi analiz ediyorum...
                      </p>
                    </div>
                  ) : status === "success" && aiResponse ? (
                    <div className="space-y-3 flex flex-col items-center text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-bounce">
                        <Check className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black text-emerald-400 tracking-wider uppercase bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/15">
                        {aiResponse.action === "addDebt" && "KAYIT: NAKİT BORÇ"}
                        {aiResponse.action === "addInstallment" && "KAYIT: TAKSİT PLANI"}
                        {aiResponse.action === "addExpense" && "KAYIT: HARCAMA"}
                        {aiResponse.action === "addIncome" && "KAYIT: GELİR KAYDI"}
                        {aiResponse.action === "updateDebtPaid" && "GÜNCELLEME: BORÇ ÖDEMESİ"}
                      </span>
                      <p className="text-xs font-bold text-slate-200 leading-relaxed max-w-sm">
                        {aiResponse.explanation}
                      </p>
                      <div className="flex gap-2.5 mt-2">
                        <button
                          type="button"
                          onClick={(e) => startListening(e)}
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
                            setAiResponse(null);
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
                        {errorMsg}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => startListening(e)}
                          className="py-1 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-white rounded-lg transition active:scale-95 cursor-pointer mt-1"
                        >
                          Tekrar Dene
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-3">
                      <motion.button
                        type="button"
                        onClick={(e) => startListening(e)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.94 }}
                        className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:text-white hover:bg-indigo-600 flex items-center justify-center cursor-pointer shadow-lg transition-all"
                      >
                        <Mic className="w-7 h-7" />
                      </motion.button>
                      <p className="text-xs text-slate-400 font-bold max-w-xs text-center leading-relaxed">
                        Kaydı başlatmak için mikrofona dokunun ve komutunuzu sesli söyleyin.
                      </p>
                    </div>
                  )}
                </div>

                {/* Real-time transcribed display fallback */}
                {transcript && (
                  <div className="p-3.5 bg-slate-950/20 rounded-xl border border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      Algılanan Ses Kaydı
                    </span>
                    <p className="text-slate-200 font-medium italic">
                      "{transcript}"
                    </p>
                  </div>
                )}

                {/* Form Input for Manual Type Fallback (If not supported or in very noisy environments) */}
                <form onSubmit={handleManualSubmit} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Yazılı / Düzenlenebilir Bütçe Komutu
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Örn: Market için 150 lira gider kaydet"
                      disabled={isListening || status === "processing"}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl py-3 pl-4 pr-12 text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 transition"
                    />
                    <button
                      type="submit"
                      disabled={!manualInput.trim() || isListening || status === "processing"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl transition active:scale-95 cursor-pointer"
                    >
                      {status === "processing" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </form>

                {/* Practical examples & command guides panel */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Örnek Türkçe Sesli Komutlar:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Ahmet borcunun ödenen kısmını 500 TL yap")}
                      className="p-2.5 bg-slate-950/20 hover:bg-indigo-950/20 border border-slate-800 hover:border-indigo-500/30 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white sm:col-span-2"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-pink-200">Mevcut Borcu Güncelle</span>
                        <span className="text-slate-500">"Ahmet borcunun ödenen kısmını 500 TL yap" / "Ahmet borcuna 200 TL ödedim"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Ahmet'e borç 4000 lira")}
                      className="p-2.5 bg-slate-950/20 hover:bg-slate-950/40 border border-slate-800 hover:border-indigo-500/30 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-indigo-200">Kişisel Borç Kaydı</span>
                        <span className="text-slate-500">"Ahmet'e borç 4000 lira"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Telefon taksiti 12000 lira 12 taksit")}
                      className="p-2.5 bg-slate-950/20 hover:bg-indigo-950/20 border border-slate-800 hover:border-indigo-500/30 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-amber-200">Taksit Planı</span>
                        <span className="text-slate-500">"Telefon taksiti 12000 TL 11 taksit"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Market mutfak harcaması 250 lira")}
                      className="p-2.5 bg-slate-950/20 hover:bg-indigo-950/20 border border-slate-800 hover:border-indigo-500/30 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-rose-200">Anlık Harcama/Gider</span>
                        <span className="text-slate-500">"Market harcaması 250 TL"</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCommand("Maaş yattı 35000 lira")}
                      className="p-2.5 bg-slate-950/20 hover:bg-indigo-950/20 border border-slate-800 hover:border-indigo-500/30 rounded-xl transition flex items-center gap-2 text-left text-slate-300 hover:text-white"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-emerald-200">Gelir Kaydı</span>
                        <span className="text-slate-500">"Maaş yattı 35000 lira"</span>
                      </div>
                    </button>
                  </div>
                </div>

              </div>

              {/* Tips bottom bar Footer */}
              <div className="p-4 bg-slate-950 px-6 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-500">
                <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span>
                  Sesi algılama süresi bittiğinde veya konuşmayı kestiğinizde asistan bütçe girişini kendiliğinden saniyeler içinde tamamlar.
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

import React, { useState, useRef, useEffect } from "react";
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  Brain, 
  Target, 
  MessageSquareCode, 
  Settings, 
  TrendingUp, 
  Copy, 
  CheckCheck, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Mic, 
  MicOff, 
  X, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  TrendingDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Debt, Income, Expense, InstallmentDebt, FinancialStats } from "../types";
import { getApiUrl } from "../utils/api";
import { t } from "../utils/translations";
import { parseDateParts } from "../utils/dateUtils";
import { useCurrency } from "../utils/CurrencyContext";
import { LiveMarketCenterWidget } from "./LiveMarketCenterWidget";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  timestamp?: string;
}

interface AIChatProps {
  debts: Debt[];
  incomes: Income[];
  expenses: Expense[];
  installmentDebts: InstallmentDebt[];
  stats: FinancialStats;
  selectedMonth?: number | null;
  selectedYear?: number | null;
  expenseCategories?: { id: number; name: string; color?: string }[];
  language?: "tr" | "en";
  currentUser?: string | null;
  onTriggerToast?: (msg: string) => void;
}

const TURKISH_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

// Helper to highlight words between ** and money/percentage patterns
const renderFormattedSpan = (text: string) => {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <strong 
          key={i} 
          className="font-bold text-slate-900 dark:text-white bg-indigo-100/70 dark:bg-indigo-400/20 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs tracking-tight"
        >
          {part}
        </strong>
      );
    }
    
    // Highlight currency and percentages inside normal text
    const moneyParts = part.split(/(₺\s?[\d\.,]+|\$\s?[\d\.,]+|€\s?[\d\.,]+|%\s?[\d\.,]+)/g);
    if (moneyParts.length > 1) {
      return (
        <React.Fragment key={i}>
          {moneyParts.map((mp, j) => {
            if (/^(₺|\$|€|%)/.test(mp.trim())) {
              return (
                <span 
                  key={j} 
                  className="font-bold text-indigo-700 dark:text-indigo-300 font-mono text-[11px] sm:text-xs"
                >
                  {mp}
                </span>
              );
            }
            return mp;
          })}
        </React.Fragment>
      );
    }
    
    return part;
  });
};

// FormattedText component designed specifically for mobile vertical layout and high contrast in both Light & Dark modes
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const rawLines = text.split("\n");
  
  // Group table rows together if markdown table exists
  const blocks: Array<{ type: "table" | "line"; content: string | string[] }> = [];
  let currentTable: string[] = [];

  rawLines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      currentTable.push(trimmed);
    } else {
      if (currentTable.length > 0) {
        blocks.push({ type: "table", content: [...currentTable] });
        currentTable = [];
      }
      blocks.push({ type: "line", content: line });
    }
  });

  if (currentTable.length > 0) {
    blocks.push({ type: "table", content: [...currentTable] });
  }

  return (
    <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed font-sans text-slate-900 dark:text-slate-100">
      {blocks.map((block, bIdx) => {
        if (block.type === "table") {
          const tableLines = block.content as string[];
          if (tableLines.length < 2) return null;
          
          // Parse header and rows (skipping delimiter line like | :--- |)
          const rows = tableLines.map(row => 
            row.split("|")
              .map(c => c.trim())
              .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1)
          );
          
          const headerRow = rows[0];
          const dataRows = rows.slice(1).filter(r => !r.every(c => /^:?-+:?$/.test(c)));

          return (
            <div key={bIdx} className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-indigo-500/30 shadow-xs">
              <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-50 dark:bg-indigo-500/20 text-indigo-950 dark:text-indigo-200 font-bold border-b border-indigo-100 dark:border-indigo-500/20">
                    {headerRow.map((h, hIdx) => (
                      <th key={hIdx} className="p-2 sm:p-2.5 whitespace-nowrap">
                        {renderFormattedSpan(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-indigo-500/20 bg-white dark:bg-[#070c1d]">
                  {dataRows.map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition">
                      {r.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 sm:p-2.5 whitespace-nowrap text-slate-900 dark:text-slate-200 font-medium">
                          {renderFormattedSpan(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const line = block.content as string;
        const trimmed = line.trim();
        
        if (!trimmed) {
          return <div key={bIdx} className="h-1" />;
        }

        // Section Headers (### or emojis like 📊, 🚀, 💡, 🎯, 💰, 📌, ⚠️, 🟢, ⚡, 💵, 💸, 📈, 📉, 🔍, 🏆)
        if (
          trimmed.startsWith("###") ||
          trimmed.startsWith("##") ||
          trimmed.startsWith("#") ||
          /^(📊|🚀|💡|🎯|💰|📌|⚠️|🟢|⚡|💵|💸|📈|📉|🔍|🏆|🚨|⚖️|✨)/.test(trimmed)
        ) {
          const cleanText = trimmed.replace(/^#{1,4}\s*/, "");
          return (
            <div 
              key={bIdx} 
              className="mt-3.5 mb-1.5 p-2 bg-gradient-to-r from-indigo-50 via-purple-50/60 to-transparent dark:from-indigo-500/20 dark:via-purple-500/10 dark:to-transparent rounded-lg border-l-3.5 border-indigo-600 dark:border-indigo-400 font-bold text-slate-950 dark:text-white flex items-center gap-1.5 text-xs sm:text-sm tracking-tight shadow-2xs"
            >
              <span>{renderFormattedSpan(cleanText)}</span>
            </div>
          );
        }

        // Numbered Step Items (e.g. 1. Adım, 1️⃣, 2., 3.) - Vertically aligned step card
        const numMatch = trimmed.match(/^(\d+[\.\)]|\d+️⃣)\s*(.*)/);
        if (numMatch) {
          const stepNumber = numMatch[1].replace(/[\.\)️⃣]/g, "").trim();
          const stepContent = numMatch[2];
          return (
            <div 
              key={bIdx} 
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-[#070c1d] border border-indigo-100 dark:border-indigo-500/25 my-1.5 transition hover:border-indigo-300 dark:hover:border-indigo-500/40 shadow-2xs"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                {stepNumber}
              </div>
              <div className="flex-1 text-slate-900 dark:text-slate-100 font-medium">
                {renderFormattedSpan(stepContent)}
              </div>
            </div>
          );
        }

        // Bullet Points (•, -, *) - Distinct indented item with bullet dot
        if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
          const cleanText = trimmed.replace(/^[•\-\*]\s*/, "");
          return (
            <div key={bIdx} className="flex items-start gap-2 pl-1 sm:pl-2 py-0.5 text-slate-900 dark:text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-2 shrink-0" />
              <div className="flex-1 leading-relaxed font-normal">{renderFormattedSpan(cleanText)}</div>
            </div>
          );
        }

        // Default Paragraph
        return (
          <p key={bIdx} className="text-slate-900 dark:text-slate-200 leading-relaxed font-normal">
            {renderFormattedSpan(line)}
          </p>
        );
      })}
    </div>
  );
};

export const AIChat: React.FC<AIChatProps> = ({
  debts,
  incomes,
  expenses,
  installmentDebts,
  stats,
  selectedMonth = new Date().getMonth(),
  selectedYear = new Date().getFullYear(),
  expenseCategories = [],
  language = "tr",
  currentUser,
  onTriggerToast,
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  
  const { rates, isFetching: isRatesFetching, lastUpdated: ratesLastUpdated, updateRatesFromAPI } = useCurrency();

  // Toast notification helper that avoids intrusive browser window.alert
  const [chatToast, setChatToast] = useState<string | null>(null);
  const notify = (msg: string) => {
    if (onTriggerToast) {
      onTriggerToast(msg);
    } else {
      setChatToast(msg);
      setTimeout(() => setChatToast(null), 3500);
    }
  };

  // Contacts and Contact Transactions from LocalStorage
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactTxs, setContactTxs] = useState<any[]>([]);

  useEffect(() => {
    const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
    const savedC = localStorage.getItem(`${spaceKey}_contacts_directory`);
    const savedT = localStorage.getItem(`${spaceKey}_contacts_transactions`);
    if (savedC) {
      try {
        setContacts(JSON.parse(savedC));
      } catch (e) {
        console.error("Error parsing contacts directory in AIChat:", e);
      }
    } else {
      setContacts([]);
    }
    if (savedT) {
      try {
        setContactTxs(JSON.parse(savedT));
      } catch (e) {
        console.error("Error parsing contact transactions in AIChat:", e);
      }
    } else {
      setContactTxs([]);
    }
  }, [currentUser]);

  const initialBotWelcome = language === "tr"
    ? "Merhaba! 🌟 Ben en güncel Gemini 3.7 Flash altyapısıyla güçlendirilen Bütçem Pro akıllı finans koçunuz.\n\n### 💡 Size Nasıl Yardımcı Olabilirim?\n• **Borç Kapatma Stratejisi**: Kartopu veya Çığ yöntemleriyle borçlarınızı en az faizle kapatma yol haritası.\n• **Aylık Gelir/Gider Analizi**: 50/30/20 kuralına göre bütçe disiplininizi değerlendirme.\n• **Tasarruf Tavsiyeleri**: Kategori bazlı harcama kısıntısı fırsatları.\n• **Güncel Piyasa & Döviz**: Canlı Google Arama entegrasyonu ile Dolar, Euro, Altın ve piyasa faiz oranları.\n\nAşağıdaki hızlı butonları kullanabilir veya sorunuzu doğrudan yazabilirsiniz!"
    : "Hello! 🌟 I am your Bütçem Pro AI financial advisor powered by Gemini 3.7 Flash.\n\n### 💡 How can I assist you today?\n• **Debt Payoff Roadmap**: Snowball or Avalanche strategies tailored to your loans.\n• **Cash Flow Analysis**: 50/30/20 budget review and balance management.\n• **Savings Recommendations**: Actionable ways to reduce discretionary expenses.\n• **Market Rates**: Live Google Search grounding for USD, EUR, Gold and inflation.\n\nFeel free to choose a prompt below or ask any financial question!";

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      sender: "bot",
      text: initialBotWelcome,
      timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem("user_gemini_api_key") || "");
  const [showApiKeyField, setShowApiKeyField] = useState(false);
  const [isApiKeySaved, setIsApiKeySaved] = useState(() => !!localStorage.getItem("user_gemini_api_key"));
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  // Custom scroll refs to target ONLY the scrollable chat container
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    if (messages.length > 1 || loading) {
      const t = setTimeout(() => scrollToBottom("smooth"), 80);
      return () => clearTimeout(t);
    }
  }, [messages, loading]);

  // Handle Speech Recognition for voice input in chat
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify("Tarayıcınız ses tanıma özelliğini desteklemiyor. Klavyeden yazabilirsiniz.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === "tr" ? "tr-TR" : "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Speech recognition startup error:", e);
      setIsListening(false);
    }
  };

  // Handle Text-to-Speech (TTS)
  const toggleSpeakText = (text: string, idx: number) => {
    const synth = typeof window !== "undefined" ? (window.speechSynthesis || (window as any).webkitSpeechSynthesis) : null;
    if (!synth) {
      notify("Cihazınızda sesli okuma motoru (TTS) bulunamadı.");
      return;
    }

    if (speakingIdx === idx) {
      try {
        synth.cancel();
      } catch {}
      setSpeakingIdx(null);
      return;
    }

    try {
      synth.cancel();
      
      // Clean markdown characters, emojis and format currencies for smooth Turkish speech
      let cleanSpeech = text
        .replace(/###/g, "")
        .replace(/\*\*/g, "")
        .replace(/•/g, "")
        .replace(/\|/g, " ")
        .replace(/-/g, " ")
        .replace(/₺/g, " Türk Lirası ")
        .replace(/\$/g, " Dolar ")
        .replace(/€/g, " Euro ")
        .replace(/%/g, " Yüzde ")
        .replace(/[\u{1F300}-\u{1F9FF}\u{1F400}-\u{1F6FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/gu, "")
        .replace(/[📊🚀💡🎯💰📌⚠️🟢🔴⚡💵💸📈📉🔍🏆🚨⚖️✨]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanSpeech) {
        notify("Seslendirilecek metin bulunamadı.");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanSpeech);
      utterance.lang = language === "tr" ? "tr-TR" : "en-US";
      utterance.rate = 1.0;

      // Select Turkish voice if available
      try {
        const voices = synth.getVoices ? synth.getVoices() : [];
        const trVoice = voices.find((v: any) => v.lang && (v.lang.startsWith("tr") || v.lang.includes("tr-TR")));
        if (trVoice) {
          utterance.voice = trVoice;
        }
      } catch {}

      utterance.onend = () => {
        setSpeakingIdx(null);
      };

      utterance.onerror = (e) => {
        console.warn("[TTS Speech Error]:", e);
        setSpeakingIdx(null);
      };

      setSpeakingIdx(idx);
      synth.speak(utterance);
    } catch (err) {
      console.warn("[TTS Exception]:", err);
      setSpeakingIdx(null);
      notify("Sesli okuma başlatılamadı.");
    }
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleClearChat = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeakingIdx(null);
    setMessages([
      {
        sender: "bot",
        text: initialBotWelcome,
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      },
    ]);
  };

  const generateClientFallbackReply = (query: string): string => {
    const q = (query || "").toLowerCase();
    
    const dRatio = stats.totalIncome > 0 ? (stats.remaining / stats.totalIncome) : 0;
    const expensePercentage = stats.totalIncome > 0 ? (stats.totalExpense / stats.totalIncome) * 100 : 0;
    const savingsRate = stats.totalIncome > 0 ? ((stats.netIncome / stats.totalIncome) * 100) : 0;

    const categoriesList = [
      { id: 1, name: "Kira", color: "#3b82f6", icon: "🏠" },
      { id: 2, name: "Market", color: "#10b981", icon: "🛒" },
      { id: 3, name: "Ulaşım", color: "#f59e0b", icon: "🚗" },
      { id: 4, name: "Yeme İçme", color: "#ec4899", icon: "🍔" },
      { id: 5, name: "Faturalar", color: "#ef4444", icon: "⚡" }
    ];

    let reply = `✨ **Bütçem Pro Gelişmiş Finansal Analiz Raporu**\n\n`;

    if (q.includes("aylık analiz raporu") || q.includes("aylik analiz raporu") || q.includes("analiz raporu")) {
      const mNum = selectedMonth !== null && selectedMonth !== undefined ? selectedMonth : new Date().getMonth();
      const yNum = selectedYear !== null && selectedYear !== undefined ? selectedYear : new Date().getFullYear();
      const monthName = TURKISH_MONTHS[mNum] || "Mevcut Ay";

      const mExpenses = expenses.filter((e) => {
        if (selectedMonth === null || selectedYear === null) return true;
        const parts = parseDateParts(e.date);
        if (!parts) return true;
        return parts.month === mNum && parts.year === yNum;
      });

      const mIncomes = incomes.filter((i) => {
        if (selectedMonth === null || selectedYear === null) return true;
        const parts = parseDateParts(i.date);
        if (!parts) return true;
        if (i.isRecurring !== false) {
          const selectedTime = yNum * 12 + mNum;
          const incomeTime = parts.year * 12 + parts.month;
          return selectedTime >= incomeTime;
        } else {
          return parts.month === mNum && parts.year === yNum;
        }
      });

      const calculatedIncome = mIncomes.reduce((sum, i) => sum + i.amount, 0);
      const calculatedExpense = mExpenses.reduce((sum, e) => sum + e.amount, 0);

      const tIncome = stats?.totalIncome !== undefined ? stats.totalIncome : calculatedIncome;
      const tExpense = stats?.totalExpense !== undefined ? stats.totalExpense : calculatedExpense;
      const nIncome = stats?.netIncome !== undefined ? stats.netIncome : (tIncome - tExpense);

      const thisMonthDebtDue = stats?.thisMonthKalanBorc ?? 0;
      const thisMonthDebtPaid = stats?.thisMonthPaidBorc ?? 0;
      const thisMonthDebtTotal = stats?.thisMonthTotalBorc ?? (thisMonthDebtDue + thisMonthDebtPaid);

      const catTotals: { [key: number]: number } = {};
      mExpenses.forEach((e) => {
        catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + e.amount;
      });

      reply += `### 📊 ${monthName.toUpperCase()} ${yNum} - DETAYLI AYLIK ANALİZ RAPORU\n`;
      reply += `Sistemimizdeki bütçe ve gider kayıtlarınızı tarayarak **${monthName} ${yNum}** dönemi gelir/gider ve borç tablonuzu çıkardım:\n\n`;

      const totalDebtsRem = debts.reduce((sum, d) => sum + Math.max(0, d.amount - d.paid), 0);
      const totalInstsRem = installmentDebts.reduce((sum, inst) => {
        const perInst = inst.totalAmount / (inst.installmentCount || 1);
        const remCount = Math.max(0, inst.installmentCount - inst.paidInstallmentCount);
        return sum + (remCount * perInst);
      }, 0);
      let contactPayablesRem = 0;
      let contactReceivablesRem = 0;
      contactTxs.forEach((tx) => {
        if (!tx.isPaid) {
          if (tx.type === "payable") {
            contactPayablesRem += Number(tx.amount) || 0;
          } else if (tx.type === "receivable") {
            contactReceivablesRem += Number(tx.amount) || 0;
          }
        }
      });
      const totalLiabilities = stats?.remaining !== undefined ? stats.remaining : (totalDebtsRem + totalInstsRem + contactPayablesRem);

      reply += `### 💵 Aylık Mali Durum Özeti (${monthName} ${yNum})\n`;
      reply += `• **Toplam Aylık Gelir**: ₺${Math.round(tIncome).toLocaleString("tr-TR")}\n`;
      reply += `• **Toplam Aylık Gider**: ₺${Math.round(tExpense).toLocaleString("tr-TR")}\n`;
      reply += `• **Kalan Net Bakiye**: ₺${Math.round(nIncome).toLocaleString("tr-TR")} (${nIncome >= 0 ? "🟢 Bütçe Fazla Veriyor" : "🔴 Bütçe Açık Veriyor"})\n\n`;

      reply += `### 💸 Bu Ayki Borç ve Yükümlülük Durumu\n`;
      reply += `• **Bu Ay Vadesi Gelen Kalan Borç**: ₺${Math.round(thisMonthDebtDue).toLocaleString("tr-TR")}\n`;
      reply += `• **Bu Ay Ödenen Borç Tutarı**: ₺${Math.round(thisMonthDebtPaid).toLocaleString("tr-TR")}\n`;
      reply += `• **Bu Ayki Toplam Borç Yükü**: ₺${Math.round(thisMonthDebtTotal).toLocaleString("tr-TR")}\n`;
      reply += `• **Genel Toplam Kalan Borç Portföyü**: ₺${Math.round(totalLiabilities).toLocaleString("tr-TR")}\n\n`;

      // Group and deduplicate active debts (never list same debt 2-3 times)
      const activeDebtsMap = new Map<string, { name: string; category: string; remaining: number }>();
      let fullyPaidDebtsCount = 0;
      let fullyPaidDebtsTotal = 0;
      debts.forEach((d) => {
        const rem = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
        if (rem <= 0) {
          fullyPaidDebtsCount++;
          fullyPaidDebtsTotal += Number(d.paid) || Number(d.amount) || 0;
          return;
        }
        const key = d.name.trim().toLowerCase();
        if (!activeDebtsMap.has(key)) {
          activeDebtsMap.set(key, { name: d.name.trim(), category: d.category || "Genel", remaining: rem });
        } else {
          activeDebtsMap.get(key)!.remaining += rem;
        }
      });
      const sortedActiveDebts = Array.from(activeDebtsMap.values()).sort((a, b) => b.remaining - a.remaining);

      reply += `### 💳 Aktif Kalan Standart Borçlar (Tüm Liste)\n`;
      if (sortedActiveDebts.length > 0) {
        sortedActiveDebts.forEach((d, idx) => {
          reply += `• **${idx + 1}. ${d.name}** (${d.category}): Kalan ₺${Math.round(d.remaining).toLocaleString("tr-TR")}\n`;
        });
      } else {
        reply += `• Tebrikler! Kayıtlı açık standart borcunuz bulunmuyor.\n`;
      }
      if (fullyPaidDebtsCount > 0) {
        reply += `• 🟢 **Kapatılan Borçlar**: ${fullyPaidDebtsCount} adet borcunuz tamamen ödenip sıfırlandı (Toplam: ₺${Math.round(fullyPaidDebtsTotal).toLocaleString("tr-TR")}).\n`;
      }
      reply += `\n`;

      reply += `### 🗓️ Aktif Taksitli Borçlar ve Aylık Ödeme Planı\n`;
      const activeInstList: { name: string; perInst: number; remCount: number; totalCount: number; remAmount: number }[] = [];
      let completedInstCount = 0;
      (installmentDebts || []).forEach((inst) => {
        const total = Number(inst.totalAmount) || 0;
        const count = Number(inst.installmentCount) || 1;
        const paidCount = Number(inst.paidInstallmentCount) || 0;
        const perInst = total / count;
        const remCount = Math.max(0, count - paidCount);
        const remAmount = Math.max(0, total - (paidCount * perInst));
        if (remCount <= 0 || remAmount <= 0) {
          completedInstCount++;
        } else {
          activeInstList.push({
            name: inst.name,
            perInst,
            remCount,
            totalCount: count,
            remAmount
          });
        }
      });
      activeInstList.sort((a, b) => b.remAmount - a.remAmount);
      if (activeInstList.length > 0) {
        activeInstList.forEach((inst, idx) => {
          reply += `• **${idx + 1}. ${inst.name}**: Aylık ₺${Math.round(inst.perInst).toLocaleString("tr-TR")} | Kalan: ${inst.remCount}/${inst.totalCount} Taksit | Kalan Borç: ₺${Math.round(inst.remAmount).toLocaleString("tr-TR")}\n`;
        });
      } else {
        reply += `• Kayıtlı aktif taksitli borcunuz bulunmuyor.\n`;
      }
      if (completedInstCount > 0) {
        reply += `• 🟢 **Tamamlanan Taksitler**: ${completedInstCount} adet taksitli borç tamamen ödendi.\n`;
      }
      reply += `\n`;

      if (mExpenses.length > 0) {
        reply += `### 📉 Kategori Karşılaştırma Analizi\n`;
        reply += `| Gider Kategorisi | Harcanan Tutar | Gider Oranı (%) | Öneri Seviyesi |\n`;
        reply += `| :--- | :--- | :---: | :---: |\n`;

        const availableCats = expenseCategories && expenseCategories.length > 0 ? expenseCategories : categoriesList;
        const sortedCats = availableCats
          .map((c) => {
            const val = catTotals[c.id] || 0;
            return {
              name: c.name,
              value: val,
              pct: tExpense > 0 ? (val / tExpense) * 100 : 0
            };
          })
          .filter((c) => c.value > 0)
          .sort((a, b) => b.value - a.value);

        sortedCats.forEach((c) => {
          let recStatus = "🟢 Stabil";
          if (c.pct > 30) recStatus = "🚨 Çok Yüksek";
          else if (c.pct > 15) recStatus = "⚠️ Yüksek";

          reply += `| **${c.name}** | ₺${c.value.toLocaleString("tr-TR")} | %${c.pct.toFixed(1)} | ${recStatus} |\n`;
        });
        reply += `\n`;
      } else {
        reply += `### 📉 Harcama Dağılımı\n`;
        reply += `• Bu ay için henüz harcama girişi yapılmamış görünüyor. Düzenli harcama girişi yaparak bütçe optimizasyonunuzu takip edebilirsiniz.\n\n`;
      }

      reply += `### 💡 Stratejik Borç Kapatma ve Tasarruf Reçetesi\n`;
      reply += `1. **Kartopu Yöntemi (Snowball)**: Psikolojik ivme kazanmak için en küçük kalan borcu ilk sıraya alıp sıfırlayın.\n`;
      reply += `2. **50/30/20 Bütçe Kuralı**: Gelirinizin en fazla %50'sini zorunlu ihtiyaçlara, %30'unu kişisel harcamalara, en az %20'sini borç kapatma ve tasarrufa ayırın.\n`;
      reply += `3. **Sabit Gider Disiplini**: Düzenli olarak kullanmadığınız dijital abonelik ve kart aidatlarını gözden geçirin.\n`;
      return reply;
    }

    if (q.includes("risk") || q.includes("durum")) {
      reply += `### 🔍 Bütçe Risk ve Sağlık Değerlendirmesi\n`;
      reply += `• **Aylık Toplam Gelir**: ₺${stats.totalIncome.toLocaleString("tr-TR")}\n`;
      reply += `• **Aylık Toplam Gider**: ₺${stats.totalExpense.toLocaleString("tr-TR")}\n`;
      reply += `• **Net Kalan Bakiye**: ₺${stats.netIncome.toLocaleString("tr-TR")}\n`;
      reply += `• **Genel Kalan Borç**: ₺${stats.remaining.toLocaleString("tr-TR")}\n\n`;

      if (stats.netIncome < 0) {
        reply += `⚠️ **Yüksek Risk Uyarısı**: Aylık harcamalarınız gelirinizi aşıyor. Bütçenizde her ay ₺${Math.abs(stats.netIncome).toLocaleString("tr-TR")} açık oluşuyor. Acil olarak isteğe bağlı harcamaları durdurmalı ve borç yapılandırması yapmalısınız.\n`;
      } else if (stats.netIncome < stats.totalIncome * 0.15) {
        reply += `⚖️ **Orta Seviye Risk**: Bütçeniz pozitif bakiye veriyor ancak beklenmedik masraflara karşı tasarruf marjınız dar. Acil durum fonu oluşturmanızı öneririm.\n`;
      } else {
        reply += `🟢 **Güvenli Durum**: Gelirinizin %${savingsRate.toFixed(0)} kadarını koruyabiliyorsunuz. Borçlarınızı erken kapatmak veya yatırıma yönlendirmek için harika bir pozisyondasınız.\n`;
      }
      return reply;
    }

    if (q.includes("kartopu") || q.includes("avalanche") || q.includes("çığ") || q.includes("borç kapatma") || q.includes("en hızlı")) {
      reply += `### 🚀 Bilimsel Borç Kapatma Stratejileri\n\n`;
      reply += `1. **Kartopu Yöntemi (Snowball Method)**: En küçük bakiyeli borcu ilk sıraya koyup tüm ekstra paranızla onu sıfırlayın. Diğer borçların sadece asgari tutarını ödeyin. İlk borç kapandığında muazzam bir motivasyon kazanırsınız!\n\n`;
      reply += `2. **Çığ Yöntemi (Avalanche Method)**: En yüksek faiz oranına sahip borcu ilk sıraya koyup ekstra ödemeyi oraya yönlendirin. Matematiksel olarak en az faizi ödemenizi sağlar.\n\n`;
      reply += `3. **Bütçem Pro Önerisi**: Toplam borç yükünüz ₺${stats.remaining.toLocaleString("tr-TR")} seviyesinde. Hızlı zaferler için **Kartopu yöntemini** tercih etmenizi tavsiye ederim.\n`;
      return reply;
    }

    if (
      q.includes("altın") || q.includes("altin") ||
      q.includes("dolar") || q.includes("usd") ||
      q.includes("euro") || q.includes("eur") ||
      q.includes("sterlin") || q.includes("gbp") ||
      q.includes("kur") || q.includes("döviz") || q.includes("doviz") ||
      q.includes("piyasa") || q.includes("ons") || q.includes("çeyrek") || q.includes("ceyrek") ||
      q.includes("gram") || q.includes("btc") || q.includes("bitcoin")
    ) {
      const usd = rates?.USD || 45.85;
      const eur = rates?.EUR || 49.85;
      const gbp = rates?.GBP || 58.20;
      const goldOns = rates?.GOLD_ONS || 4474.20;
      const goldGram = rates?.GOLD_GRAM || ((goldOns * usd) / 31.10348);
      const goldCeyrek = rates?.GOLD_CEYREK || (goldGram * 1.635);
      const btcUsd = rates?.BTC_USD || 81588;

      reply += `### 💱 CANLI DÖVİZ & GÜNCEL ALTIN KURLARI RAPORU\n\n`;
      reply += `Entegre finans piyasaları ve borsalardan alınan anlık veriler:\n\n`;
      reply += `| Varlık Türü | Sembol | Anlık Fiyat (TL / USD) | Değişim / Birim |\n`;
      reply += `| :--- | :---: | :---: | :---: |\n`;
      reply += `| **Amerikan Doları** | 🇺🇸 USD | **₺${usd.toFixed(2)}** | 1 Dolar |\n`;
      reply += `| **Euro** | 🇪🇺 EUR | **₺${eur.toFixed(2)}** | 1 Euro |\n`;
      reply += `| **İngiliz Sterlini** | 🇬🇧 GBP | **₺${gbp.toFixed(2)}** | 1 Sterlin |\n`;
      reply += `| **Gram Altın (24K)** | 🥇 Gram | **₺${Math.round(goldGram).toLocaleString("tr-TR")} TL** | 1 Gram |\n`;
      reply += `| **Çeyrek Altın** | 🪙 Çeyrek | **₺${Math.round(goldCeyrek).toLocaleString("tr-TR")} TL** | 1 Adet |\n`;
      reply += `| **Ons Altın ($)** | 🪙 Ons | **$${Math.round(goldOns).toLocaleString("en-US")} USD** | 1 Ons (31.1g) |\n`;
      reply += `| **Bitcoin (BTC)** | ₿ BTC | **$${Math.round(btcUsd).toLocaleString("en-US")} USD** | 1 BTC |\n\n`;

      reply += `💡 **Bütçem Pro Finansal Tavsiyesi**:\n`;
      reply += `• **Bütçe Koruması**: Enflasyona karşı net bakiyeniz (**₺${stats.netIncome.toLocaleString("tr-TR")}**) ile Gram Altın biriktirerek alım gücünüzü koruyabilirsiniz.\n`;
      reply += `• **Dövizli Borç Riski**: Döviz borçlarınızı kur yükselmeden sabitlemeyi veya öncelikli ödemeyi değerlendirin.\n`;

      return reply;
    }

    reply += `### 🎯 Finansal Rehberlik ve Tavsiye\n`;
    reply += `Bütçe verilerinize göre aylık geliriniz **₺${stats.totalIncome.toLocaleString("tr-TR")}**, gideriniz **₺${stats.totalExpense.toLocaleString("tr-TR")}** ve kalan borç portföyünüz **₺${stats.remaining.toLocaleString("tr-TR")}** olarak görünmektedir.\n\n`;
    reply += `• Daha detaylı analiz için yukarıdaki **"Aylık Rapor"** butonuna basabilir veya doğrudan döviz, altın, borç kapatma stratejileri sorabilirsiniz.`;
    return reply;
  };

  const handleSend = async (customText?: string, displayText?: string) => {
    const question = customText || inputValue;
    if (!question.trim() || loading) return;

    const timeStr = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const bubbleText = displayText || question;
    const newMsg: ChatMessage = { sender: "user", text: bubbleText, timestamp: timeStr };
    setMessages((prev) => [...prev, newMsg]);
    setInputValue("");
    setLoading(true);

    const userApiKey = localStorage.getItem("user_gemini_api_key") || "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: question,
          context: {
            debts,
            incomes,
            expenses,
            installmentDebts,
            stats,
            contacts,
            contactTransactions: contactTxs,
            selectedMonth,
            selectedYear,
            rates,
          },
          chatHistory: messages.slice(-10),
          userApiKey: userApiKey,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Yapay zeka servisi yanıt vermedi.");
      }

      const data = await response.json();
      const botTime = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [...prev, { sender: "bot", text: data.reply, timestamp: botTime }]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn("[AIChat Frontend Fallback] Backend chat response fallback:", err);
      const fallbackReply = generateClientFallbackReply(question);
      const botTime = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: fallbackReply,
          timestamp: botTime
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (qn: string) => {
    handleSend(qn);
  };

  const handleGenerateMonthlyReport = () => {
    const mNum = selectedMonth !== null && selectedMonth !== undefined ? selectedMonth : new Date().getMonth();
    const yNum = selectedYear !== null && selectedYear !== undefined ? selectedYear : new Date().getFullYear();
    const monthName = TURKISH_MONTHS[mNum] || "Mevcut Ay";

    const monthlyExpenses = expenses.filter((e) => {
      if (selectedMonth === null || selectedYear === null) return true;
      const parts = parseDateParts(e.date);
      if (!parts) return true;
      return parts.month === mNum && parts.year === yNum;
    });

    const monthlyIncomes = incomes.filter((i) => {
      if (selectedMonth === null || selectedYear === null) return true;
      const parts = parseDateParts(i.date);
      if (!parts) return true;
      if (i.isRecurring !== false) {
        const selectedTime = yNum * 12 + mNum;
        const incomeTime = parts.year * 12 + parts.month;
        return selectedTime >= incomeTime;
      } else {
        return parts.month === mNum && parts.year === yNum;
      }
    });

    const categoryMap: { [key: number]: number } = {};
    monthlyExpenses.forEach((e) => {
      categoryMap[e.categoryId] = (categoryMap[e.categoryId] || 0) + e.amount;
    });

    let categoryDetailsStr = "";
    const availableCategories = expenseCategories && expenseCategories.length > 0 ? expenseCategories : [
      { id: 1, name: "Kira" },
      { id: 2, name: "Market" },
      { id: 3, name: "Ulaşım" },
      { id: 4, name: "Yeme İçme" },
      { id: 5, name: "Faturalar" }
    ];

    availableCategories.forEach((c) => {
      const amt = categoryMap[c.id] || 0;
      if (amt > 0) {
        categoryDetailsStr += `- ${c.name}: ₺${Math.round(amt).toLocaleString("tr-TR")}\n`;
      }
    });

    if (!categoryDetailsStr) {
      categoryDetailsStr = "- Bu ay için henüz kategori bazlı bir harcama kaydedilmemiş.\n";
    }

    const calculatedMonthlyExpense = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const calculatedMonthlyIncome = monthlyIncomes.reduce((sum, i) => sum + i.amount, 0);

    const totalMonthlyExpense = stats?.totalExpense !== undefined ? stats.totalExpense : calculatedMonthlyExpense;
    const totalMonthlyIncome = stats?.totalIncome !== undefined ? stats.totalIncome : calculatedMonthlyIncome;
    const totalMonthlyNet = stats?.netIncome !== undefined ? stats.netIncome : (totalMonthlyIncome - totalMonthlyExpense);

    const thisMonthDebtDue = stats?.thisMonthKalanBorc ?? 0;
    const thisMonthDebtPaid = stats?.thisMonthPaidBorc ?? 0;
    const thisMonthDebtTotal = stats?.thisMonthTotalBorc ?? (thisMonthDebtDue + thisMonthDebtPaid);
    const overallRemainingDebt = stats?.remaining ?? 0;

    // --- TEKİLLEŞTİRİLMİŞ AKTİF BORÇLAR (Aynı borcu 2-3 kez tekrar yazmayı ve 0 TL ödenmişleri engeller) ---
    const activeDebtsMap = new Map<string, { name: string; category: string; totalAmount: number; totalPaid: number; remaining: number }>();
    let paidDebtsCount = 0;
    let paidDebtsTotal = 0;

    if (debts && debts.length > 0) {
      debts.forEach((d) => {
        const rem = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
        if (rem <= 0) {
          paidDebtsCount++;
          paidDebtsTotal += Number(d.paid) || Number(d.amount) || 0;
          return;
        }

        const normalizedName = d.name.trim().toLowerCase();
        if (!activeDebtsMap.has(normalizedName)) {
          activeDebtsMap.set(normalizedName, {
            name: d.name.trim(),
            category: d.category || "Genel",
            totalAmount: Number(d.amount) || 0,
            totalPaid: Number(d.paid) || 0,
            remaining: rem
          });
        } else {
          const item = activeDebtsMap.get(normalizedName)!;
          item.totalAmount += Number(d.amount) || 0;
          item.totalPaid += Number(d.paid) || 0;
          item.remaining += rem;
        }
      });
    }

    const sortedActiveDebts = Array.from(activeDebtsMap.values()).sort((a, b) => b.remaining - a.remaining);

    let debtsDetailsStr = "";
    if (sortedActiveDebts.length > 0) {
      sortedActiveDebts.forEach((d, idx) => {
        debtsDetailsStr += `${idx + 1}. ${d.name} (${d.category}): Kalan ₺${Math.round(d.remaining).toLocaleString("tr-TR")} (Toplam: ₺${Math.round(d.totalAmount).toLocaleString("tr-TR")}, Ödenen: ₺${Math.round(d.totalPaid).toLocaleString("tr-TR")})\n`;
      });
    } else {
      debtsDetailsStr = "- Şu an ödenecek aktif standart borç bulunmuyor.\n";
    }

    if (paidDebtsCount > 0) {
      debtsDetailsStr += `• Tamamen Kapatılmış/Ödenmiş Borçlar: ${paidDebtsCount} adet borç tamamen sıfırlandı (Toplam Kapatılan: ₺${Math.round(paidDebtsTotal).toLocaleString("tr-TR")})\n`;
    }

    // --- TEKİLLEŞTİRİLMİŞ TAKSİTLİ BORÇLAR ---
    const activeInstMap = new Map<string, { name: string; totalAmount: number; perInst: number; remCount: number; remAmount: number; totalCount: number }>();
    let paidInstCount = 0;

    if (installmentDebts && installmentDebts.length > 0) {
      installmentDebts.forEach((inst) => {
        const total = Number(inst.totalAmount) || 0;
        const count = Number(inst.installmentCount) || 1;
        const paidCount = Number(inst.paidInstallmentCount) || 0;
        const perInst = total / count;
        const remCount = Math.max(0, count - paidCount);
        const remAmount = Math.max(0, total - (paidCount * perInst));

        if (remCount <= 0 || remAmount <= 0) {
          paidInstCount++;
          return;
        }

        const normalizedName = inst.name.trim().toLowerCase();
        if (!activeInstMap.has(normalizedName)) {
          activeInstMap.set(normalizedName, {
            name: inst.name.trim(),
            totalAmount: total,
            perInst,
            remCount,
            remAmount,
            totalCount: count
          });
        } else {
          const item = activeInstMap.get(normalizedName)!;
          item.totalAmount += total;
          item.remAmount += remAmount;
          item.remCount = Math.max(item.remCount, remCount);
        }
      });
    }

    let installmentDetailsStr = "";
    const sortedActiveInsts = Array.from(activeInstMap.values()).sort((a, b) => b.remAmount - a.remAmount);
    if (sortedActiveInsts.length > 0) {
      sortedActiveInsts.forEach((inst, idx) => {
        installmentDetailsStr += `${idx + 1}. ${inst.name}: Aylık Taksit ₺${Math.round(inst.perInst).toLocaleString("tr-TR")} (${inst.remCount}/${inst.totalCount} ay taksit kaldı, Toplam Kalan: ₺${Math.round(inst.remAmount).toLocaleString("tr-TR")})\n`;
      });
    } else {
      installmentDetailsStr = "- Kayıtlı aktif taksitli borç planı bulunmuyor.\n";
    }

    if (paidInstCount > 0) {
      installmentDetailsStr += `• Tamamen Kapatılmış Taksitler: ${paidInstCount} adet taksitli borç tamamen ödendi.\n`;
    }

    const prompt = `Lütfen benim için '${monthName} ${yNum} Aylık Finansal Analiz Raporu' oluştur.
KRİTİK VE KESİN KURALLAR:
1. TÜM BORÇLARI VE TAKSİTLERİ EKSİKSİZ TEK TEK SIRALA: Aşağıda verilen tüm standart borçları ve tüm taksitli borçları TEK TEK ayrı maddeler halinde döküm olarak listele. Asla 'Diğer borçlar', 've benzeri' adı altında gruplama yapma, hiçbir borcu gizleme!
2. TAKSİTLİ BORÇLAR BÖLÜMÜ: Raporda mutlaka '### 🗓️ Aktif Taksitli Borçlar ve Aylık Ödeme Planı' başlığı aç ve tüm taksitli borçları aylık taksiti, kalan taksit sayısı ve toplam kalan borcuyla tek tek listele.
3. STANDART BORÇLAR BÖLÜMÜ: '### 💳 Aktif Kalan Standart Borçlar' başlığı altında tüm standart borçları kalan tutarlarıyla tek tek listele.
4. Gelir, gider ve borç dengesini analiz et, tasarruf önerilerini net maddelerle sun.
5. Borçları Kartopu veya Çığ yöntemine göre önceliklendir.
6. Raporu mobil ekranda son derece ferah ve düzenli okunacak şekilde başlıklar ve maddelerle sun.

Aylık Finansal Durum Özetim (${monthName} ${yNum}):
- Toplam Aylık Gelir: ₺${Math.round(totalMonthlyIncome).toLocaleString("tr-TR")}
- Toplam Aylık Gider: ₺${Math.round(totalMonthlyExpense).toLocaleString("tr-TR")}
- Kalan Net Bakiye: ₺${Math.round(totalMonthlyNet).toLocaleString("tr-TR")} (${totalMonthlyNet >= 0 ? "Bütçe Fazla Veriyor" : "Bütçe Açık Veriyor"})
- Bu Ay Vadesi Gelen Kalan Borç: ₺${Math.round(thisMonthDebtDue).toLocaleString("tr-TR")}
- Bu Ay Ödenen Borç Tutarı: ₺${Math.round(thisMonthDebtPaid).toLocaleString("tr-TR")}
- Bu Ay Toplam Borç Yükü: ₺${Math.round(thisMonthDebtTotal).toLocaleString("tr-TR")}
- Genel Toplam Kalan Borç Portföyü: ₺${Math.round(overallRemainingDebt).toLocaleString("tr-TR")}

Kategori Bazlı Harcamalar:
${categoryDetailsStr}

Aktif Kalan Standart Borçlarım (Yalnızca ödenmesi gerekenler):
${debtsDetailsStr}

Aktif Taksitli Borçlarım:
${installmentDetailsStr}`;

    handleSend(prompt, `📊 ${monthName} ${yNum} Aylık Finansal Analiz Raporu`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in w-full max-w-3xl mx-auto px-0 flex flex-col items-stretch">
      
      {/* Modern AI Header with Gemini 3.7 Flash badge and actions */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-lg border border-indigo-500/30 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-purple-500/20 rounded-full blur-xl pointer-events-none" />
        
        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="relative">
              <motion.div
                className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl blur-xs"
                animate={{ opacity: [0.5, 0.9, 0.5] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
              />
              <div className="relative p-3 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl text-white shadow-lg shadow-indigo-500/30">
                <Bot className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h3 className="text-base sm:text-lg font-black tracking-tight uppercase bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent">
                  Bütçem AI Finans Asistanı
                </h3>
                <span className="px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-200 border border-indigo-400/40 rounded-full flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5 flex items-center justify-center sm:justify-start gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-300 font-semibold">Canlı Finans Koçu & Piyasa Analizi Aktif</span>
              </p>
            </div>
          </div>

          {/* Quick Chat Control Buttons */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleClearChat}
              title="Sohbeti Temizle"
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Temizle</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleGenerateMonthlyReport}
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/25 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Aylık Rapor Üret</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Chat Conversation Container (Positioned ABOVE Live Rates) */}
      <div className="relative border border-slate-200/80 dark:border-indigo-500/25 bg-white dark:bg-[#070c1d] rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-indigo-950/40 overflow-hidden flex flex-col w-full mx-auto">
        
        {/* Floating in-chat notification if browser warning or toast is triggered */}
        <AnimatePresence>
          {chatToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-slate-900/90 dark:bg-indigo-950/90 text-white text-xs font-semibold rounded-full shadow-lg border border-slate-700/50 backdrop-blur-md flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{chatToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages Scroll Viewport */}
        <div
          ref={chatContainerRef}
          className="h-[400px] sm:h-[460px] md:h-[500px] overflow-y-auto p-3.5 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-indigo-400/40 dark:scrollbar-thumb-indigo-500/40 scroll-smooth bg-slate-50/60 dark:bg-gradient-to-b dark:from-[#091124] dark:via-[#060a18] dark:to-[#030611]"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isUser = msg.sender === "user";
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={`flex flex-col ${isUser ? "items-end ml-auto" : "items-stretch"} w-full`}
                >
                  {/* Sender Header Badge */}
                  <div className={`flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="flex items-center gap-1">
                      {isUser ? (
                        <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                          <User className="w-2.5 h-2.5" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                          <Bot className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <span className="font-extrabold">{isUser ? "Siz" : "Gemini 3.7 Flash Asistan"}</span>
                    </span>
                    {msg.timestamp && (
                      <span className="text-[9px] opacity-75 font-mono">
                        • {msg.timestamp}
                      </span>
                    )}
                  </div>

                  {/* Message Card Bubble */}
                  <div
                    className={`rounded-2xl sm:rounded-3xl transition-all shadow-sm ${
                      isUser
                        ? "max-w-[90%] sm:max-w-[80%] p-3.5 sm:p-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white rounded-tr-xs border border-indigo-400/40 shadow-md shadow-indigo-500/20"
                        : "w-full p-4 sm:p-5 bg-white dark:bg-[#0c142b] text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200/90 dark:border-indigo-500/25 shadow-md dark:shadow-black/40"
                    }`}
                  >
                    {isUser ? (
                      <p className="text-xs sm:text-sm font-semibold leading-relaxed break-words whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        <FormattedText text={msg.text} />
                        
                        {/* Bot Action Bar (Copy & Voice Speak) */}
                        <div className="pt-2.5 mt-2.5 border-t border-slate-200 dark:border-indigo-500/20 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Doğrulanmış Finansal Analiz</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleSpeakText(msg.text, idx)}
                              title={speakingIdx === idx ? "Sesli Okumayı Durdur" : "Sesli Oku"}
                              className={`p-1.5 rounded-xl border transition cursor-pointer active:scale-95 ${
                                speakingIdx === idx
                                  ? "bg-indigo-600 text-white border-indigo-500 animate-pulse shadow-md shadow-indigo-500/30"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-[#070c1d] dark:hover:bg-[#0e172e] dark:text-slate-200 dark:border-indigo-500/25"
                              }`}
                            >
                              {speakingIdx === idx ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              onClick={() => handleCopyMessage(msg.text, idx)}
                              title="Metni Kopyala"
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#070c1d] dark:hover:bg-[#0e172e] dark:text-slate-200 dark:border-indigo-500/25 transition cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              {copiedIdx === idx ? (
                                <>
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black">Kopyalandı</span>
                                </>
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Loading Animation with Gemini Shimmer */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 w-full"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md animate-pulse shrink-0">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-[#0c142b] border border-slate-200 dark:border-indigo-500/25 shadow-md space-y-2 w-full">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-700 dark:text-indigo-300">
                  <span>Gemini 3.7 Flash bütçenizi analiz ediyor</span>
                  <span className="flex items-center gap-0.5">
                    <motion.span
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full"
                    />
                    <motion.span
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                      className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full"
                    />
                    <motion.span
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                      className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full"
                    />
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                  Borç vadeleri, nakit akışı ve piyasa parametreleri taranıyor...
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Quick Suggested Questions Bar */}
        <div className="px-3.5 py-3 bg-white/95 dark:bg-[#070c1d] border-t border-slate-200/80 dark:border-indigo-500/20">
          <div className="flex items-center gap-1.5 text-[10.5px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-2">
            <MessageSquareCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Hızlı Finansal Sorular (Dokunarak Sorun):</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
            {[
              {
                text: "Mevcut bütçemin genel risk durumu nedir?",
                label: "🔍 Bütçe Risk Durumum",
              },
              {
                text: "Borçlarımı en hızlı nasıl kapatabilirim? Kartopu mu Avalanche mi?",
                label: "🚀 Borç Kapatma Planı",
              },
              {
                text: "Gereksiz harcamaları azaltıp nasıl tasarruf fonu yaparım?",
                label: "🎯 Tasarruf Yönetimi",
              },
              {
                text: "Bugün güncel dolar, euro kuru ve altın fiyatları ne kadar?",
                label: "📈 Güncel Dolar & Altın",
              },
              {
                text: "Hangi borcumu öncelikli olarak ödemeliyim?",
                label: "⚖️ Borç Önceliği",
              },
            ].map((qn, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleQuickQuestion(qn.text)}
                disabled={loading}
                className="whitespace-nowrap px-3.5 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 text-xs font-bold rounded-xl border border-slate-200 hover:border-indigo-300 dark:bg-gradient-to-r dark:from-[#091124] dark:via-[#0c142b] dark:to-[#091124] dark:text-indigo-200 dark:hover:text-white dark:border-indigo-500/30 dark:hover:border-indigo-400 dark:hover:from-indigo-600 dark:hover:to-purple-600 transition-all shadow-2xs cursor-pointer shrink-0 disabled:opacity-40"
              >
                {qn.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* High-Visibility Writing & Input Bar with Voice Mic and Send Button */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#070c1d] border-t border-slate-200/80 dark:border-indigo-500/25">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading && inputValue.trim()) handleSend();
                }}
                disabled={loading}
                placeholder={isListening ? "🎙️ Dinleniyor... Lütfen sorunuzu söyleyin..." : "Finansal sorunuzu yazın (Örn: Bu ay ne kadar tasarruf edebilirim?)"}
                className={`w-full pl-4 pr-10 py-3.5 bg-slate-50 dark:bg-[#0c142b] text-slate-900 dark:text-white border-2 ${
                  isListening 
                    ? "border-red-500 ring-4 ring-red-500/30 bg-red-50 dark:bg-red-950/20" 
                    : "border-slate-200 hover:border-indigo-400 focus:border-indigo-500 dark:border-indigo-500/40 dark:hover:border-indigo-400 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20"
                } rounded-2xl text-xs sm:text-sm focus:outline-none focus:bg-white dark:focus:bg-[#0c142b] placeholder-slate-400 dark:placeholder-slate-500 font-medium transition shadow-inner`}
              />
              
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer transition"
                  title="Temizle"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Voice Input Mic Button */}
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={toggleSpeechRecognition}
              type="button"
              title={isListening ? "Dinlemeyi Durdur" : "Sesli Soru Sor"}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer ${
                isListening
                  ? "bg-red-500 text-white animate-pulse shadow-red-500/40 ring-4 ring-red-400/40"
                  : "bg-gradient-to-tr from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/30 border border-emerald-400/30"
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </motion.button>

            {/* Send Message Button */}
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => handleSend()}
              disabled={loading || !inputValue.trim()}
              className="w-12 h-12 bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer transition active:scale-95 border border-indigo-400/30"
              title="Gönder"
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

      </div>

      {/* Live Comprehensive Currency, Gold & Crypto Market Center (Matches Screenshot Exactly) */}
      <LiveMarketCenterWidget onAskAI={(prompt) => handleSend(prompt)} />

      {/* Advanced Gemini API Key / Engine Settings Drawer */}
      <div className="overflow-hidden bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xs">
        <button
          onClick={() => setShowApiKeyField(!showApiKeyField)}
          className="w-full flex items-center justify-between gap-3 text-left cursor-pointer focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <Settings className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200 block">
                Yapay Zekâ Motor Ayarları
              </span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Özel Gemini API anahtarı veya model ayarlarını yapılandırın
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-xl font-bold transition uppercase tracking-wider">
            {showApiKeyField ? "Gizle ▲" : "Yapılandır ▼"}
          </span>
        </button>

        <AnimatePresence>
          {showApiKeyField && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-3"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                Bütçem Pro varsayılan olarak sunucu taraflı <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">Gemini 3.7 Flash</strong> motoru ile çalışır. Dilerseniz kendi Google AI Studio API anahtarınızı bağlayabilirsiniz.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2 items-stretch max-w-lg">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setIsApiKeySaved(false);
                  }}
                  placeholder="AIzaSy... API anahtarınızı yapıştırın"
                  className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                />
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("user_gemini_api_key", apiKeyInput);
                    setIsApiKeySaved(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white rounded-xl shadow-xs transition cursor-pointer shrink-0"
                >
                  Kaydet 💾
                </button>
              </div>
              
              {isApiKeySaved && (
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Özel Gemini API anahtarı başarıyla kaydedildi!</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
};

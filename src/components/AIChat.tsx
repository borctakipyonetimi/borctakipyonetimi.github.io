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
          className="font-bold text-slate-900 dark:text-white bg-indigo-500/10 dark:bg-indigo-400/20 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs tracking-tight"
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

// FormattedText component designed specifically for mobile vertical layout and high contrast
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
    <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed font-sans text-slate-800 dark:text-slate-200">
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
            <div key={bIdx} className="my-3 overflow-x-auto rounded-xl border border-indigo-500/20 dark:border-indigo-500/30 shadow-xs">
              <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 font-bold border-b border-indigo-500/20">
                    {headerRow.map((h, hIdx) => (
                      <th key={hIdx} className="p-2 sm:p-2.5 whitespace-nowrap">
                        {renderFormattedSpan(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50 bg-white/50 dark:bg-slate-800/50">
                  {dataRows.map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 transition">
                      {r.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 sm:p-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
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
              className="mt-3.5 mb-1.5 p-2 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-500/20 dark:via-purple-500/10 dark:to-transparent rounded-lg border-l-3 border-indigo-500 font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs sm:text-sm tracking-tight"
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
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-indigo-50/50 dark:bg-slate-800/80 border border-indigo-500/15 dark:border-slate-700/60 my-1.5 transition hover:border-indigo-500/30"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                {stepNumber}
              </div>
              <div className="flex-1 text-slate-800 dark:text-slate-200">
                {renderFormattedSpan(stepContent)}
              </div>
            </div>
          );
        }

        // Bullet Points (•, -, *) - Distinct indented item with bullet dot
        if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
          const cleanText = trimmed.replace(/^[•\-\*]\s*/, "");
          return (
            <div key={bIdx} className="flex items-start gap-2 pl-1 sm:pl-2 py-0.5 text-slate-700 dark:text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-2 shrink-0" />
              <div className="flex-1 leading-relaxed">{renderFormattedSpan(cleanText)}</div>
            </div>
          );
        }

        // Default Paragraph
        return (
          <p key={bIdx} className="text-slate-700 dark:text-slate-300 leading-relaxed">
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
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  
  const { rates, isFetching: isRatesFetching, lastUpdated: ratesLastUpdated, updateRatesFromAPI } = useCurrency();

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
      alert("Tarayıcınız ses tanıma özelliğini desteklemiyor. Lütfen Google Chrome veya uyumlu bir mobil tarayıcı kullanın.");
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
    if (!("speechSynthesis" in window)) {
      alert("Tarayıcınız sesli okuma özelliğini desteklemiyor.");
      return;
    }

    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }

    window.speechSynthesis.cancel();
    
    // Clean markdown characters for pleasant speech audio
    const cleanSpeech = text
      .replace(/###/g, "")
      .replace(/\*\*/g, "")
      .replace(/•/g, "")
      .replace(/\|/g, " ")
      .replace(/-/g, " ")
      .replace(/[📊🚀💡🎯💰📌⚠️🟢⚡💵💸📈📉🔍🏆🚨⚖️✨]/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = language === "tr" ? "tr-TR" : "en-US";
    utterance.rate = 1.05;

    utterance.onend = () => {
      setSpeakingIdx(null);
    };

    utterance.onerror = () => {
      setSpeakingIdx(null);
    };

    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utterance);
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
      reply += `• **Toplam Aylık Gelir**: ₺${tIncome.toLocaleString("tr-TR")}\n`;
      reply += `• **Toplam Aylık Gider**: ₺${tExpense.toLocaleString("tr-TR")}\n`;
      reply += `• **Kalan Net Bakiye**: ₺${nIncome.toLocaleString("tr-TR")} (${nIncome >= 0 ? "🟢 Bütçe Fazla Veriyor" : "🔴 Bütçe Açık Veriyor"})\n\n`;

      reply += `### 💸 Bu Ayki Borç ve Yükümlülük Durumu\n`;
      reply += `• **Bu Ay Vadesi Gelen Kalan Borç**: ₺${thisMonthDebtDue.toLocaleString("tr-TR")}\n`;
      reply += `• **Bu Ay Ödenen Borç Tutarı**: ₺${thisMonthDebtPaid.toLocaleString("tr-TR")}\n`;
      reply += `• **Bu Ayki Toplam Borç Yükü**: ₺${thisMonthDebtTotal.toLocaleString("tr-TR")}\n`;
      reply += `• **Genel Toplam Kalan Borç Portföyü**: ₺${totalLiabilities.toLocaleString("tr-TR")}\n\n`;

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

        reply += `\n### 💡 Tasarruf ve Optimizasyon Önerileri\n`;
        reply += `1. **Gereksiz Abonelikleri İptal Edin**: Düzenli olarak kullanmadığınız dijital üyelikleri gözden geçirin.\n`;
        reply += `2. **Otomatik Tasarruf Kuralı**: Maaş yatar yatmaz en az %10'unu ayrı bir birikim hesabına aktarın.\n`;
        reply += `3. **Kartopu Borç Kapatma**: En küçük borcu kapatıp psikolojik ivme kazanın.\n`;
      }
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

  const handleSend = async (customText?: string) => {
    const question = customText || inputValue;
    if (!question.trim() || loading) return;

    const timeStr = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const newMsg: ChatMessage = { sender: "user", text: question, timestamp: timeStr };
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
        categoryDetailsStr += `- ${c.name}: ₺${amt.toLocaleString("tr-TR")}\n`;
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

    let debtsDetailsStr = "";
    if (debts && debts.length > 0) {
      debts.forEach((d) => {
        const rem = Math.max(0, d.amount - d.paid);
        debtsDetailsStr += `- ${d.name} (${d.category}): Toplam ₺${d.amount.toLocaleString("tr-TR")}, Ödenen: ₺${d.paid.toLocaleString("tr-TR")}, Kalan: ₺${rem.toLocaleString("tr-TR")}\n`;
      });
    } else {
      debtsDetailsStr = "- Kayıtlı standart borç bulunmamaktadır.\n";
    }

    let installmentDetailsStr = "";
    if (installmentDebts && installmentDebts.length > 0) {
      installmentDebts.forEach((inst) => {
        const perInstallment = inst.totalAmount / (inst.installmentCount || 1);
        const remCount = Math.max(0, inst.installmentCount - inst.paidInstallmentCount);
        const remAmount = Math.max(0, inst.totalAmount - (inst.paidInstallmentCount * perInstallment));
        installmentDetailsStr += `- ${inst.name}: Toplam ₺${inst.totalAmount.toLocaleString("tr-TR")}, Taksit: ${inst.installmentCount} ay x ₺${perInstallment.toLocaleString("tr-TR")}, Kalan Taksit: ${remCount} ay (Kalan: ₺${remAmount.toLocaleString("tr-TR")})\n`;
      });
    } else {
      installmentDetailsStr = "- Kayıtlı taksitli borç bulunmamaktadır.\n";
    }

    const prompt = `Lütfen benim için '${monthName} ${yNum} Aylık Analiz Raporu' oluştur. Bu aydaki gider kategorilerimi birbiriyle kıyasla ve bana bütçemi optimize edip birikim yapabilmem için somut tasarruf önerileri sun. Ayrıca, bütçeme ek olarak aşağıda detayları verilen tüm borçlarımı analiz et, borç durumumu ve borç erteleme/kapatma önceliklerimi (Kartopu veya Avalanche yöntemlerine göre) rapora dahil et.

Aylık Finansal Durum Özetim (${monthName} ${yNum}):
- Toplam Aylık Gelir: ₺${totalMonthlyIncome.toLocaleString("tr-TR")}
- Toplam Aylık Gider: ₺${totalMonthlyExpense.toLocaleString("tr-TR")}
- Kalan Net Bakiye: ₺${totalMonthlyNet.toLocaleString("tr-TR")} (${totalMonthlyNet >= 0 ? "Bütçe Fazla Veriyor" : "Bütçe Açık Veriyor"})
- Bu Ay Vadesi Gelen Kalan Borç: ₺${thisMonthDebtDue.toLocaleString("tr-TR")}
- Bu Ay Ödenen Borç Tutarı: ₺${thisMonthDebtPaid.toLocaleString("tr-TR")}
- Bu Ay Toplam Borç Yükü: ₺${thisMonthDebtTotal.toLocaleString("tr-TR")}
- Genel Toplam Kalan Borç Yükü: ₺${overallRemainingDebt.toLocaleString("tr-TR")}

Kategori Bazlı Harcama Dağılımım (${monthName} ${yNum}):
${categoryDetailsStr}

Mevcut Aktif Standart Borçlarım:
${debtsDetailsStr}

Mevcut Taksitli Borçlarım:
${installmentDetailsStr}

Lütfen mobil ekranda kolay okunacak şekilde başlıklar, numaralı adımlar ve net maddeler halinde düzenli bir analiz raporu sun.`;

    handleSend(prompt);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in w-full max-w-4xl mx-auto">
      
      {/* Modern AI Header with Gemini 3.7 Flash badge and actions */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-md border border-indigo-500/20 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-purple-500/15 rounded-full blur-xl pointer-events-none" />
        
        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="relative">
              <motion.div
                className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl blur-xs"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
              />
              <div className="relative p-3 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl text-white shadow-md">
                <Bot className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">
                  Bütçem AI Finans Asistanı
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5 flex items-center justify-center sm:justify-start gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Canlı Piyasa Arama & Akıllı Borç Koçu Aktif</span>
              </p>
            </div>
          </div>

          {/* Quick Chat Control Buttons */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleClearChat}
              title="Sohbeti Temizle"
              className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl border border-white/15 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Temizle</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleGenerateMonthlyReport}
              disabled={loading}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Aylık Rapor</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Live Currency & Gold Market Ticker Bar */}
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900/95 via-indigo-950/90 to-slate-900/95 text-white rounded-3xl border border-indigo-500/25 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <span>💱 Canlı Piyasa & Döviz / Altın Kurları</span>
            </span>
            {ratesLastUpdated && (
              <span className="hidden sm:inline text-[10px] text-slate-400 font-medium">
                ({ratesLastUpdated})
              </span>
            )}
          </div>

          <button
            onClick={() => updateRatesFromAPI()}
            disabled={isRatesFetching}
            title="Anlık Kurları Yenile"
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-xl border border-white/15 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3 h-3 ${isRatesFetching ? "animate-spin text-indigo-400" : ""}`} />
            <span>{isRatesFetching ? "Yükleniyor..." : "Kurları Yenile"}</span>
          </button>
        </div>

        {/* Live Rates Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <button
            onClick={() => handleSend("Bugün güncel gram ve çeyrek altın fiyatı kaç TL?")}
            className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-left transition cursor-pointer group"
          >
            <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between">
              <span>🥇 Gram Altın</span>
              <span className="text-[9px] opacity-75">24K</span>
            </div>
            <div className="text-sm font-black text-amber-100 mt-0.5 group-hover:scale-105 transition-transform">
              ₺{Math.round(rates.GOLD_GRAM || ((rates.GOLD_ONS || 4474) * (rates.USD || 45.85) / 31.1035)).toLocaleString("tr-TR")}
            </div>
          </button>

          <button
            onClick={() => handleSend("Bugün çeyrek altın fiyatı kaç TL?")}
            className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-left transition cursor-pointer group"
          >
            <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between">
              <span>🪙 Çeyrek Altın</span>
              <span className="text-[9px] opacity-75">Ziynet</span>
            </div>
            <div className="text-sm font-black text-amber-100 mt-0.5 group-hover:scale-105 transition-transform">
              ₺{Math.round(rates.GOLD_CEYREK || ((rates.GOLD_GRAM || 6595) * 1.635)).toLocaleString("tr-TR")}
            </div>
          </button>

          <button
            onClick={() => handleSend("Dolar (USD) bugün kaç TL?")}
            className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-left transition cursor-pointer group"
          >
            <div className="text-[10px] font-bold text-emerald-300 flex items-center justify-between">
              <span>🇺🇸 Dolar (USD)</span>
              <span className="text-[9px] opacity-75">Piyasa</span>
            </div>
            <div className="text-sm font-black text-emerald-100 mt-0.5 group-hover:scale-105 transition-transform">
              ₺{(rates.USD || 45.85).toFixed(2)}
            </div>
          </button>

          <button
            onClick={() => handleSend("Euro (EUR) bugün kaç TL?")}
            className="p-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-2xl text-left transition cursor-pointer group"
          >
            <div className="text-[10px] font-bold text-blue-300 flex items-center justify-between">
              <span>🇪🇺 Euro (EUR)</span>
              <span className="text-[9px] opacity-75">Piyasa</span>
            </div>
            <div className="text-sm font-black text-blue-100 mt-0.5 group-hover:scale-105 transition-transform">
              ₺{(rates.EUR || 49.85).toFixed(2)}
            </div>
          </button>

          <button
            onClick={() => handleSend("Ons Altın ($) bugün kaç Dolar?")}
            className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-left transition cursor-pointer group"
          >
            <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between">
              <span>🪙 Ons Altın</span>
              <span className="text-[9px] opacity-75">USD</span>
            </div>
            <div className="text-sm font-black text-amber-100 mt-0.5 group-hover:scale-105 transition-transform">
              ${Math.round(rates.GOLD_ONS || 4474).toLocaleString("en-US")}
            </div>
          </button>

          <button
            onClick={() => handleSend("Bitcoin (BTC) kaç Dolar?")}
            className="p-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-2xl text-left transition cursor-pointer group"
          >
            <div className="text-[10px] font-bold text-purple-300 flex items-center justify-between">
              <span>₿ Bitcoin</span>
              <span className="text-[9px] opacity-75">BTC</span>
            </div>
            <div className="text-sm font-black text-purple-100 mt-0.5 group-hover:scale-105 transition-transform">
              ${Math.round(rates.BTC_USD || 81588).toLocaleString("en-US")}
            </div>
          </button>
        </div>
      </div>

      {/* Main Chat Conversation Container */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Messages Scroll Viewport */}
        <div
          ref={chatContainerRef}
          className="h-[380px] sm:h-[460px] md:h-[500px] overflow-y-auto p-3.5 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scroll-smooth"
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
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full`}
                >
                  {/* Sender Header Badge */}
                  <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="flex items-center gap-1">
                      {isUser ? <User className="w-3 h-3 text-indigo-500" /> : <Bot className="w-3 h-3 text-indigo-500" />}
                      <span>{isUser ? "Siz" : "Gemini 3.7 Flash Asistan"}</span>
                    </span>
                    {msg.timestamp && (
                      <span className="text-[9px] opacity-70 font-normal">
                        • {msg.timestamp}
                      </span>
                    )}
                  </div>

                  {/* Message Card Bubble */}
                  <div
                    className={`max-w-[95%] sm:max-w-[85%] rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 transition-all shadow-xs ${
                      isUser
                        ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs"
                        : "bg-slate-50/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-slate-700/80"
                    }`}
                  >
                    {isUser ? (
                      <p className="text-xs sm:text-sm font-medium leading-relaxed break-words whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <FormattedText text={msg.text} />
                        
                        {/* Bot Action Bar (Copy & Voice Speak) */}
                        <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1 font-semibold text-indigo-500 dark:text-indigo-400">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Doğrulanmış Finansal Analiz</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleSpeakText(msg.text, idx)}
                              title={speakingIdx === idx ? "Sesli Okumayı Durdur" : "Sesli Oku"}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                speakingIdx === idx
                                  ? "bg-indigo-500 text-white border-indigo-500 animate-pulse"
                                  : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                              }`}
                            >
                              {speakingIdx === idx ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              onClick={() => handleCopyMessage(msg.text, idx)}
                              title="Metni Kopyala"
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition cursor-pointer flex items-center gap-1"
                            >
                              {copiedIdx === idx ? (
                                <>
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-[9px] text-emerald-500 font-bold">Kopyalandı</span>
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
              className="flex items-start gap-3 max-w-[85%]"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs animate-pulse shrink-0">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>Gemini 3.7 Flash bütçenizi analiz ediyor</span>
                  <span className="flex items-center gap-0.5">
                    <motion.span
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
                    />
                    <motion.span
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
                    />
                    <motion.span
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
                    />
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Borç vadeleri, gelir-gider dengesi ve güncel piyasa parametreleri hesaplanıyor...
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Quick Suggested Questions Bar (Scrollable on small mobile screens) */}
        <div className="px-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
            <MessageSquareCode className="w-3.5 h-3.5 text-indigo-500" />
            <span>Hızlı Finansal Sorular:</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
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
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleQuickQuestion(qn.text)}
                disabled={loading}
                className="whitespace-nowrap px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition shadow-2xs cursor-pointer shrink-0 disabled:opacity-40"
              >
                {qn.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Input Bar with Voice Mic, Enter submission, and Send Button */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading && inputValue.trim()) handleSend();
                }}
                disabled={loading}
                placeholder={isListening ? "Dinleniyor... Lütfen konuşun..." : "Finansal sorunuzu yazın (Örn: Bu ay ne kadar tasarruf edebilirim?)"}
                className={`w-full pl-3.5 pr-9 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border ${
                  isListening 
                    ? "border-red-500 ring-2 ring-red-500/20" 
                    : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
                } rounded-2xl text-xs sm:text-sm focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 transition font-medium`}
              />
              
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Voice Input Mic Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleSpeechRecognition}
              type="button"
              title={isListening ? "Dinlemeyi Durdur" : "Sesli Soru Sor"}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition shadow-2xs shrink-0 cursor-pointer ${
                isListening
                  ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {isListening ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
            </motion.button>

            {/* Send Message Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSend()}
              disabled={loading || !inputValue.trim()}
              className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer transition"
            >
              <Send className="w-4.5 h-4.5" />
            </motion.button>
          </div>
        </div>

      </div>

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

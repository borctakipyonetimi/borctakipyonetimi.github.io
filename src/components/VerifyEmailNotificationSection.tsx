/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  generateRichFinancialEmailThemeHtml,
  generateFormattedAsciiFinancialTableText,
  generateEmlContent,
  EMAIL_THEME_CONFIGS,
  EmailThemeKey,
} from "../utils/automatedMail";
import {
  Mail,
  CheckCircle2,
  Send,
  Eye,
  Sparkles,
  Copy,
  Download,
  Palette,
  FileCode2,
  Check,
  ExternalLink,
  ShieldCheck,
  Table as TableIcon,
  TrendingUp,
  TrendingDown,
  CreditCard,
  PieChart,
  User,
  Info,
  Share2,
  Loader2,
} from "lucide-react";

interface VerifyEmailNotificationSectionProps {
  debts?: any[];
  installmentDebts?: any[];
  incomes?: any[];
  expenses?: any[];
  language?: string;
  onSuccessToast?: (msg: string) => void;
}

export const VerifyEmailNotificationSection: React.FC<VerifyEmailNotificationSectionProps> = ({
  debts = [],
  installmentDebts = [],
  incomes = [],
  expenses = [],
  language = "tr",
  onSuccessToast,
}) => {
  // Stored state
  const [recipientEmail, setRecipientEmail] = useState<string>(() => {
    return localStorage.getItem("manual_report_recipient_email") || "";
  });

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem("manual_report_user_name") || "Bütçem Pro Kullanıcısı";
  });

  const [selectedTheme, setSelectedTheme] = useState<EmailThemeKey>(() => {
    return (localStorage.getItem("manual_report_theme") as EmailThemeKey) || "indigo";
  });

  const [copiedType, setCopiedType] = useState<"rich" | "code" | null>(null);
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem("manual_report_recipient_email", recipientEmail);
  }, [recipientEmail]);

  useEffect(() => {
    localStorage.setItem("manual_report_user_name", userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem("manual_report_theme", selectedTheme);
  }, [selectedTheme]);

  // Generate current HTML email template
  const currentEmailHtml = React.useMemo(() => {
    return generateRichFinancialEmailThemeHtml({
      user: userName.trim() || "Bütçem Pro Kullanıcısı",
      email: recipientEmail.trim(),
      theme: selectedTheme,
      incomes,
      expenses,
      debts,
      installmentDebts,
    });
  }, [userName, recipientEmail, selectedTheme, incomes, expenses, debts, installmentDebts]);

  // Generate ASCII box table text for plain text mailto
  const currentAsciiTableText = React.useMemo(() => {
    return generateFormattedAsciiFinancialTableText({
      user: userName.trim() || "Bütçem Pro Kullanıcısı",
      email: recipientEmail.trim(),
      theme: selectedTheme,
      incomes,
      expenses,
      debts,
      installmentDebts,
    });
  }, [userName, recipientEmail, selectedTheme, incomes, expenses, debts, installmentDebts]);

  // Calculations for display cards
  const totalIncome = incomes.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const totalActiveDebt =
    debts.filter((d) => !d.isPaid).reduce((acc, curr) => acc + (Number(curr.remaining ?? curr.amount) || 0), 0) +
    installmentDebts.filter((i) => !i.isCompleted).reduce((acc, curr) => acc + (Number(curr.remainingAmount ?? curr.totalAmount) || 0), 0);

  // 1. OPEN IN MAIL APP DIRECTLY (Generate .EML Draft with HTML Tables + Launch Mailto with ASCII Box Table)
  const handleOpenInMailAppWithTables = () => {
    const emlContent = generateEmlContent({
      user: userName.trim() || "Bütçem Pro Kullanıcısı",
      email: recipientEmail.trim(),
      theme: selectedTheme,
      incomes,
      expenses,
      debts,
      installmentDebts,
    });

    // Create .EML file blob
    const emlBlob = new Blob([emlContent], { type: "message/rfc822;charset=utf-8" });
    const emlUrl = URL.createObjectURL(emlBlob);
    
    // Download/Open .EML file
    const a = document.createElement("a");
    a.href = emlUrl;
    a.download = `ButcemPro_Finansal_Rapor_${new Date().toISOString().split("T")[0]}.eml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(emlUrl), 2000);

    // Also trigger mailto: with formatted ASCII box table
    const subject = encodeURIComponent(`Bütçem Pro: Finansal Rapor ve Bütçe Özeti (${new Date().toLocaleDateString("tr-TR")})`);
    const bodyText = encodeURIComponent(currentAsciiTableText);
    const mailtoUrl = `mailto:${recipientEmail ? encodeURIComponent(recipientEmail.trim()) : ""}?subject=${subject}&body=${bodyText}`;

    setTimeout(() => {
      window.location.href = mailtoUrl;
    }, 400);

    if (onSuccessToast) {
      onSuccessToast("Mail uygulamanız açıldı! Görsel tablo taslağı ve ASCII tablo içeriği hazırlandı.");
    }
  };

  // 2. DIRECT ONE-CLICK EMAIL DISPATCH FROM SERVER
  const handleDirectSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      if (onSuccessToast) {
        onSuccessToast("Lütfen geçerli bir alıcı e-posta adresi giriniz.");
      }
      return;
    }

    setIsSendingDirect(true);
    try {
      const res = await fetch("/api/notifications/email/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          subject: `Bütçem Pro: Finansal Rapor ve Bütçe Özeti (${new Date().toLocaleDateString("tr-TR")})`,
          htmlContent: currentEmailHtml,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (onSuccessToast) {
          onSuccessToast(data.message || "E-posta başarıyla gönderildi! 🚀");
        }
      } else {
        if (onSuccessToast) {
          onSuccessToast(`Gönderim uyarısı: ${data.error || "Sunucu e-posta gönderemedi."}`);
        }
      }
    } catch (err: any) {
      if (onSuccessToast) {
        onSuccessToast(`İşlem hatası: ${err.message || "Baglantı kurulamadı."}`);
      }
    } finally {
      setIsSendingDirect(false);
    }
  };

  // Copy Rich HTML to Clipboard
  const handleCopyRichText = async () => {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([currentEmailHtml], { type: "text/html" });
        const blobText = new Blob([currentEmailHtml.replace(/<[^>]+>/g, "")], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": blobHtml,
            "text/plain": blobText,
          }),
        ]);
        setCopiedType("rich");
        setTimeout(() => setCopiedType(null), 3000);
        if (onSuccessToast) {
          onSuccessToast("Zengin metin e-posta şablonu kopyalandı!");
        }
      } else {
        await navigator.clipboard.writeText(currentEmailHtml);
        setCopiedType("code");
        setTimeout(() => setCopiedType(null), 3000);
        if (onSuccessToast) {
          onSuccessToast("E-posta HTML kodu kopyalandı.");
        }
      }
    } catch {
      await navigator.clipboard.writeText(currentEmailHtml);
      setCopiedType("code");
      setTimeout(() => setCopiedType(null), 3000);
      if (onSuccessToast) {
        onSuccessToast("E-posta HTML kodu kopyalandı.");
      }
    }
  };

  // Copy raw HTML code
  const handleCopyRawHtml = async () => {
    await navigator.clipboard.writeText(currentEmailHtml);
    setCopiedType("code");
    setTimeout(() => setCopiedType(null), 3000);
    if (onSuccessToast) {
      onSuccessToast("E-posta HTML kodu panoya kopyalandı!");
    }
  };

  // Download HTML File
  const handleDownloadHtmlFile = () => {
    const blob = new Blob([currentEmailHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Butcem_Pro_Finansal_Rapor_${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onSuccessToast) {
      onSuccessToast("E-posta raporu HTML dosyası olarak indirildi.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Description Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl shadow-xl relative overflow-hidden border border-indigo-800/50">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-200 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Manüel E-Posta Şablonu & Finansal Rapor</span>
            </div>
            <span className="text-[11px] text-indigo-300/80 font-medium">
              Link içermeyen, şık e-posta tabloları
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Görsel E-Posta Raporu Hazırlama ve Paylaşma
          </h2>

          <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-2xl">
            Tüm borçlarınızı, taksitlerinizi, gelir ve giderlerinizi içeren <strong>link içermeyen, şık ve renkli</strong> bir e-posta raporu oluşturun. İstediğiniz temayı seçip şablonu kopyalayabilir veya mail uygulamanıza aktarabilirsiniz.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <span className="text-[10px] text-indigo-200 uppercase font-black tracking-wider block">Toplam Gelir</span>
              <span className="text-sm font-black text-emerald-300">
                ₺{totalIncome.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <span className="text-[10px] text-indigo-200 uppercase font-black tracking-wider block">Toplam Gider</span>
              <span className="text-sm font-black text-rose-300">
                ₺{totalExpense.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <span className="text-[10px] text-indigo-200 uppercase font-black tracking-wider block">Net Bakiye</span>
              <span className={`text-sm font-black ${netBalance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                ₺{netBalance.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <span className="text-[10px] text-indigo-200 uppercase font-black tracking-wider block">Toplam Borç</span>
              <span className="text-sm font-black text-amber-300">
                ₺{totalActiveDebt.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form & Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Control Column (Inputs & Theme Selection) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* User Details & Recipient Card */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  Rapor Sahibi ve Alıcı Bilgileri
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  E-posta başlığında görünecek isim ve alıcı adresi
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* User Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Hitap Edilecek İsim:
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ahmet Yılmaz"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Recipient Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Alıcı E-Posta Adresi (Opsiyonel):
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="ornek@domain.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* E-Posta Tema Seçimi */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    E-Posta Tasarım Temaları
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    E-postanız için şık bir görsel renk paleti seçin
                  </p>
                </div>
              </div>
            </div>

            {/* Theme Options Cards */}
            <div className="space-y-2">
              {(Object.keys(EMAIL_THEME_CONFIGS) as EmailThemeKey[]).map((key) => {
                const conf = EMAIL_THEME_CONFIGS[key];
                const isSelected = selectedTheme === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTheme(key)}
                    className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Theme color swatch dot */}
                      <div
                        className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center shadow-xs border border-white/20"
                        style={{ background: conf.headerBg }}
                      >
                        <span className="text-xs">💼</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {conf.name}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-white font-bold text-[9px] rounded-full">
                              Aktif
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          {conf.description}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons Box */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Raporu İletme Seçenekleri</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                Kopyalama Gerektirmez ✅
              </span>
            </h4>

            {/* 1. PRIMARY: Open Directly in Mail App with Tables (.EML Draft & Formatted Mailto) */}
            <button
              type="button"
              onClick={handleOpenInMailAppWithTables}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-black text-xs rounded-2xl shadow-xl shadow-indigo-600/25 transition transform active:scale-[0.99] flex items-center justify-between cursor-pointer border border-indigo-500/30"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Send className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-black text-xs">Mail Uygulamasında Aç (Tablo Şeklinde)</div>
                  <div className="text-[10px] text-indigo-100/80 font-normal">
                    Mail uygulamanızda görsel tablolu taslak açılır
                  </div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-indigo-200 shrink-0" />
            </button>

            {/* 2. SECONDARY: Direct Send Email from Server */}
            <button
              type="button"
              disabled={isSendingDirect}
              onClick={handleDirectSendEmail}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  {isSendingDirect ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Mail className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-black text-xs">
                    {isSendingDirect ? "E-Posta Gönderiliyor..." : "E-Postayı Doğrudan Gönder (Tek Tıkla)"}
                  </div>
                  <div className="text-[10px] text-emerald-100/80 font-normal">
                    {recipientEmail ? `${recipientEmail} adresine iletir` : "Alıcı adresine direkt gönderir"}
                  </div>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            </button>

            {/* 3. TERTIARY: Copy Rich Text Template */}
            <button
              type="button"
              onClick={handleCopyRichText}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedType === "rich" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Zengin Metin Şablonu Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Zengin Metin Şablonunu Kopyala (Panoya)</span>
                </>
              )}
            </button>

            {/* Secondary Utility Actions Row */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyRawHtml}
                className="py-2 px-3 bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                <span>HTML Kodunu Kopyala</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadHtmlFile}
                className="py-2 px-3 bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>.html Dosyası İndir</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium pt-1">
              🔒 E-posta şablonunda hiçbir yönlendirme linki veya buton bulunmaz. Tamamen güvenli tablodur.
            </p>
          </div>

        </div>

        {/* Right Live Preview Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col h-full min-h-[550px]">
            
            {/* Live Preview Bar Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Canlı E-Posta Önizlemesi
                    <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                      Link İçermez ✅
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Seçilen tema ile oluşturulan gerçek e-posta görünümü
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFullPreviewModal(true)}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Tam Ekran İncele</span>
              </button>
            </div>

            {/* Email Preview Container (iFrame rendering the exact HTML) */}
            <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 relative min-h-[450px]">
              <iframe
                title="E-posta Rapor Önizlemesi"
                srcDoc={currentEmailHtml}
                className="w-full h-full min-h-[480px] border-0 rounded-2xl bg-white"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Full Screen Preview Modal */}
      <AnimatePresence>
        {showFullPreviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-black text-sm text-slate-800 dark:text-slate-100">
                    Görsel E-Posta Şablonu Tam Ekran Önizleme
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyRichText}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Kopyala</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFullPreviewModal(false)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-300 cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>

              {/* Modal iFrame */}
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden">
                <iframe
                  title="Tam Ekran E-Posta Önizlemesi"
                  srcDoc={currentEmailHtml}
                  className="w-full h-full border-0 rounded-2xl bg-white"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

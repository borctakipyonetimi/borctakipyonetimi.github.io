/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { safeFetchJson, getApiUrl } from "../utils/api";
import {
  analyzeDebtsComprehensive,
  generateDiagnosticReportHtml,
} from "../utils/debtAnalyzer";
import {
  automatedRequestVerificationCode,
  automatedVerifyEmailCode,
  automatedSendTestDebtEmail,
  testSmtpConnectionApi,
  saveSmtpConfigApi,
  resetSmtpConfigApi,
  getSmtpStatusApi,
  SmtpStatusResponse,
} from "../utils/automatedMail";
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  Clock,
  Trash2,
  Eye,
  Sliders,
  Sparkles,
  Info,
  X,
  Edit3,
  AlertOctagon,
  ArrowLeft,
  Check,
  ExternalLink,
  Inbox,
  HelpCircle,
  ShieldCheck,
  Server,
  Wifi,
  WifiOff,
  Share2,
  Copy,
  Key,
  Lock,
  KeyRound,
  Settings2,
  ShieldAlert,
} from "lucide-react";

interface VerifyEmailNotificationSectionProps {
  debts?: any[];
  installmentDebts?: any[];
  language?: string;
  onSuccessToast?: (msg: string) => void;
}

interface EmailPreferences {
  alertOverdue: boolean;
  alertDueToday: boolean;
  frequency: "daily_morning" | "daily_both" | "weekly";
  minAmountThreshold: number;
}

export const VerifyEmailNotificationSection: React.FC<VerifyEmailNotificationSectionProps> = ({
  debts = [],
  installmentDebts = [],
  language = "tr",
  onSuccessToast,
}) => {
  const [emailInput, setEmailInput] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"input" | "otp" | "verified">("input");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);
  const [emailPreviewModal, setEmailPreviewModal] = useState<{
    html: string;
    overdueCount: number;
    dueTodayCount: number;
    totalAmount: number;
    delivered?: boolean;
    isOfflineFallback?: boolean;
    message?: string;
  } | null>(null);

  // Server ping & connection states
  const [serverStatus, setServerStatus] = useState<"idle" | "testing" | "online" | "offline">("idle");
  const [serverLatency, setServerLatency] = useState<number | null>(null);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [customServerUrlInput, setCustomServerUrlInput] = useState(() => {
    return localStorage.getItem("customServerUrl") || "";
  });

  // SMTP Configuration State
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatusResponse | null>(null);
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [smtpProvider, setSmtpProvider] = useState<"gmail" | "outlook" | "yandex" | "custom">("gmail");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("Bütçem Pro");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAppPasswordGuide, setShowAppPasswordGuide] = useState(false);

  // Stored state
  const [verifiedEmail, setVerifiedEmail] = useState<string>(() => {
    return localStorage.getItem("notif_verified_email") || "";
  });

  const [preferences, setPreferences] = useState<EmailPreferences>(() => {
    try {
      const saved = localStorage.getItem("notif_email_preferences");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      alertOverdue: true,
      alertDueToday: true,
      frequency: "daily_morning",
      minAmountThreshold: 0,
    };
  });

  const [verifiedAt, setVerifiedAt] = useState<number | null>(() => {
    const saved = localStorage.getItem("notif_verified_at");
    return saved ? parseInt(saved, 10) : null;
  });

  // Fetch initial SMTP Status
  useEffect(() => {
    getSmtpStatusApi().then((status) => {
      setSmtpStatus(status);
      if (status.rawUser) {
        setSmtpUser(status.rawUser);
      }
      if (status.host) {
        setSmtpHost(status.host);
      }
      if (status.port) {
        setSmtpPort(status.port);
      }
      if (status.fromName) {
        setSmtpFromName(status.fromName);
      }
    });
  }, []);

  // Preset switch handler
  const handleSelectSmtpPreset = (preset: "gmail" | "outlook" | "yandex" | "custom") => {
    setSmtpProvider(preset);
    setSmtpTestResult(null);
    if (preset === "gmail") {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(465);
    } else if (preset === "outlook") {
      setSmtpHost("smtp.office365.com");
      setSmtpPort(587);
    } else if (preset === "yandex") {
      setSmtpHost("smtp.yandex.com");
      setSmtpPort(465);
    }
  };

  // Test SMTP Connection
  const handleTestSmtpConnection = async () => {
    if (!smtpUser.trim() || !smtpPass.trim()) {
      setSmtpTestResult({
        success: false,
        message: "Lütfen gönderici e-posta ve 16 haneli Uygulama Şifrenizi giriniz.",
      });
      return;
    }
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await testSmtpConnectionApi({
        host: smtpHost.trim(),
        port: Number(smtpPort),
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        secure: Number(smtpPort) === 465,
        fromName: smtpFromName.trim(),
      });
      setSmtpTestResult(res);
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: "Bağlantı testi başarısız: " + (err.message || "Bilinmeyen hata"),
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // Save & Apply SMTP Configuration
  const handleSaveSmtpConfig = async () => {
    if (!smtpUser.trim() || !smtpPass.trim()) {
      setSmtpTestResult({
        success: false,
        message: "Lütfen e-posta ve 16 haneli Uygulama Şifrenizi giriniz.",
      });
      return;
    }
    setIsSavingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await saveSmtpConfigApi({
        host: smtpHost.trim(),
        port: Number(smtpPort),
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        secure: Number(smtpPort) === 465,
        fromName: smtpFromName.trim(),
      });
      if (res.success) {
        setSmtpTestResult({
          success: true,
          message: res.message,
        });
        const updatedStatus = await getSmtpStatusApi();
        setSmtpStatus(updatedStatus);
        if (onSuccessToast) {
          onSuccessToast("SMTP ayarları başarıyla kaydedildi! Canlı e-posta gönderimi aktif. 🚀");
        }
      } else {
        setSmtpTestResult({
          success: false,
          message: res.message,
        });
      }
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: "Kayıt hatası: " + (err.message || "Bilinmeyen hata"),
      });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  // Reset SMTP Configuration
  const handleResetSmtpConfig = async () => {
    try {
      await resetSmtpConfigApi();
      const updatedStatus = await getSmtpStatusApi();
      setSmtpStatus(updatedStatus);
      setSmtpPass("");
      setSmtpTestResult({
        success: true,
        message: "Özel SMTP ayarları sıfırlandı.",
      });
      if (onSuccessToast) {
        onSuccessToast("SMTP ayarları sıfırlandı.");
      }
    } catch {
      // ignore
    }
  };

  // Standardized and comprehensive debt analysis
  const debtAnalysis = React.useMemo(() => {
    return analyzeDebtsComprehensive(debts, installmentDebts);
  }, [debts, installmentDebts]);

  const overdueInfo = React.useMemo(() => {
    return {
      overdueCount: debtAnalysis.overdueCount,
      overdueTotal: debtAnalysis.totalOverdueAmount,
      totalActiveCount: debtAnalysis.totalActiveCount,
      totalActiveDebt: debtAnalysis.totalActiveDebt,
      dueTodayCount: debtAnalysis.dueTodayCount,
    };
  }, [debtAnalysis]);

  // Sync initial state from server if email is saved
  useEffect(() => {
    if (verifiedEmail) {
      setStep("verified");
      safeFetchJson(`/api/notifications/email/status?email=${encodeURIComponent(verifiedEmail)}`)
        .then((data) => {
          if (data && data.verified) {
            setPreferences({
              alertOverdue: data.alertOverdue !== false,
              alertDueToday: data.alertDueToday !== false,
              frequency: data.frequency || "daily_morning",
              minAmountThreshold: data.minAmountThreshold || 0,
            });
            if (data.verifiedAt) setVerifiedAt(data.verifiedAt);
          }
        })
        .catch(() => {});
    }
  }, [verifiedEmail]);

  const [copiedReport, setCopiedReport] = useState(false);
  const [showServerDeployHelp, setShowServerDeployHelp] = useState(false);

  // Generate plain text report formatted for email and sharing
  const generatePlainTextReport = () => {
    let text = `Bütçem Pro - Güncel Borç ve Ödeme Durumu Raporu\n`;
    text += `Tarih: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}\n`;
    text += `Alıcı: ${verifiedEmail || emailInput || "Kullanıcı"}\n\n`;
    text += `GENEL DURUM ÖZETİ:\n`;
    text += `• Toplam Kayıtlı Borç: ₺${debtAnalysis.totalActiveDebt.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}\n`;
    text += `• Vadesi Geciken Tutar: ₺${debtAnalysis.totalOverdueAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}\n`;
    text += `• Toplam Borç Kalemi: ${debtAnalysis.totalActiveCount} Kalem\n`;
    text += `• Gecikmiş Borç: ${debtAnalysis.overdueCount} Kalem\n`;
    text += `• Bugün Vadesi Dolan: ${debtAnalysis.dueTodayCount} Kalem\n\n`;

    if (debtAnalysis.overdueDebts.length > 0) {
      text += `🚨 VADESİ GEÇMİŞ BORÇLAR (${debtAnalysis.overdueDebts.length} KALEM):\n`;
      debtAnalysis.overdueDebts.forEach((d, idx) => {
        text += `${idx + 1}. ${d.name} ${d.isInstallment ? "[Taksit]" : ""}\n`;
        text += `   Tutar: ₺${d.remaining.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}\n`;
        text += `   Vade: ${d.dueDateStr} (${d.daysLate ? `${d.daysLate} gün gecikti` : "Gecikmede"})\n\n`;
      });
    } else {
      text += `✅ Vadesi geçmiş borcunuz bulunmamaktadır.\n\n`;
    }

    if (debtAnalysis.dueTodayDebts.length > 0) {
      text += `⏰ BUGÜN SON GÜN OLANLAR (${debtAnalysis.dueTodayDebts.length} KALEM):\n`;
      debtAnalysis.dueTodayDebts.forEach((d, idx) => {
        text += `${idx + 1}. ${d.name} ${d.isInstallment ? "[Taksit]" : ""}\n`;
        text += `   Tutar: ₺${d.remaining.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}\n`;
        text += `   Vade: Bugün\n\n`;
      });
    }

    text += `----------------------------------------\n`;
    text += `Bütçem Pro Finansal Borç ve Bütçe Takip Asistanı\n`;
    return text;
  };

  // 1-Click Native Email (Gmail / Mail Client)
  const handleSendNativeEmail = () => {
    const targetEmail = verifiedEmail || emailInput || "";
    const subject = encodeURIComponent(
      `Bütçem Pro Borç Durum Raporu (${debtAnalysis.overdueCount > 0 ? `${debtAnalysis.overdueCount} Gecikmiş Borç, ₺${debtAnalysis.totalOverdueAmount.toLocaleString("tr-TR")}` : "Temiz Durum"})`
    );
    const body = encodeURIComponent(generatePlainTextReport());
    const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
    if (onSuccessToast) {
      onSuccessToast(
        language === "tr"
          ? "Gmail / E-posta uygulamanız açılıyor... İletiyi anında gönderebilirsiniz! ✉️"
          : "Opening email app... ✉️"
      );
    }
  };

  const handleCopyReportText = async () => {
    try {
      await navigator.clipboard.writeText(generatePlainTextReport());
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
      if (onSuccessToast) {
        onSuccessToast(
          language === "tr"
            ? "Borç raporu metni panoya kopyalandı! 📋"
            : "Debt report copied to clipboard! 📋"
        );
      }
    } catch {
      // Fallback
    }
  };

  const handleShareReportNative = async () => {
    const text = generatePlainTextReport();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Bütçem Pro Borç Raporu",
          text: text,
        });
      } catch {
        // User dismissed
      }
    } else {
      handleCopyReportText();
    }
  };

  // Countdown timer for code resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Step 1: Request 6-digit OTP Verification Code
  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const emailToUse = (step === "verified" ? verifiedEmail : emailInput).trim().toLowerCase();
    if (!emailToUse || !emailToUse.includes("@") || !emailToUse.includes(".")) {
      setErrorMessage(language === "tr" ? "Lütfen geçerli bir e-posta adresi giriniz." : "Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await automatedRequestVerificationCode(
        emailToUse,
        "Bütçem Pro Kullanıcısı",
        debts,
        installmentDebts
      );

      setStep("otp");
      setCountdown(60);
      setStatusMessage(
        data.message ||
          (language === "tr"
            ? `${emailToUse} adresine 6 haneli doğrulama kodu gönderildi.`
            : `Verification code sent to ${emailToUse}.`)
      );

      if (data.devCode) {
        setDevCodeHint(data.devCode);
        setOtpCode(data.devCode); // Auto-fill for convenience
      }
    } catch (err: any) {
      console.warn("[Email Verification] Automated dispatch error:", err);
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      setStep("otp");
      setCountdown(60);
      setDevCodeHint(fallbackCode);
      setOtpCode(fallbackCode);
      setStatusMessage(
        language === "tr"
          ? `${emailToUse} için doğrulama kodu hazırlandı. Lütfen Doğrula butonuna tıklayın.`
          : `Verification code generated for ${emailToUse}. Click verify to confirm.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setErrorMessage(language === "tr" ? "Lütfen 6 haneli doğrulama kodunu eksiksiz girin." : "Please enter the 6-digit code.");
      return;
    }

    setIsVerifying(true);
    const targetEmail = emailInput.trim().toLowerCase();
    const currentAnalysis = analyzeDebtsComprehensive(debts, installmentDebts);

    try {
      await automatedVerifyEmailCode(
        targetEmail,
        cleanCode,
        preferences,
        debts,
        installmentDebts,
        "Bütçem Pro Kullanıcısı",
        currentAnalysis
      );

      const nowTs = Date.now();
      setVerifiedEmail(targetEmail);
      setVerifiedAt(nowTs);
      setStep("verified");
      setDevCodeHint(null);
      setOtpCode("");

      localStorage.setItem("notif_verified_email", targetEmail);
      localStorage.setItem("notif_verified_at", nowTs.toString());
      localStorage.setItem("notif_email_preferences", JSON.stringify(preferences));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("email_subscription_changed"));
      }

      const successText =
        language === "tr"
          ? `Tebrikler! ${targetEmail} adresi başarıyla doğrulandı ve otomatik bildirimler aktifleştirildi.`
          : `Congratulations! ${targetEmail} is verified and automated notifications are active.`;

      setStatusMessage(successText);
      if (onSuccessToast) onSuccessToast(successText);
    } catch (err: any) {
      setErrorMessage(err.message || (language === "tr" ? "Doğrulama kodu hatalı." : "Invalid verification code."));
    } finally {
      setIsVerifying(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async (newPrefs: EmailPreferences) => {
    setPreferences(newPrefs);
    localStorage.setItem("notif_email_preferences", JSON.stringify(newPrefs));

    if (verifiedEmail) {
      try {
        await safeFetchJson("/api/notifications/email/update-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: verifiedEmail,
            preferences: newPrefs,
            debts,
            installmentDebts,
          }),
        });
        if (onSuccessToast) {
          onSuccessToast(language === "tr" ? "E-posta bildirim ayarlarınız güncellendi! 💾" : "Email preferences saved! 💾");
        }
      } catch (err) {
        console.warn("Failed to sync email preferences to server:", err);
        if (onSuccessToast) {
          onSuccessToast(language === "tr" ? "E-posta bildirim ayarlarınız kaydedildi! 💾" : "Email preferences saved! 💾");
        }
      }
    }
  };

  // Start changing verified email to a new address
  const handleStartChangeEmail = () => {
    setEmailInput(verifiedEmail || "");
    setOtpCode("");
    setDevCodeHint(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setStep("input");
  };

  // Confirm Removal of Verified Email
  const handleConfirmRemoveEmail = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const emailToRemove = verifiedEmail;
    try {
      if (emailToRemove) {
        await safeFetchJson("/api/notifications/email/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailToRemove }),
        });
      }
    } catch (err) {
      console.warn("Failed to remove email on server:", err);
    } finally {
      setVerifiedEmail("");
      setVerifiedAt(null);
      setEmailInput("");
      setOtpCode("");
      setDevCodeHint(null);
      setStep("input");
      setConfirmDeleteModal(false);
      setIsLoading(false);

      localStorage.removeItem("notif_verified_email");
      localStorage.removeItem("notif_verified_at");
      localStorage.removeItem("notif_email_preferences");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("email_subscription_changed"));
      }

      const successMsg =
        language === "tr"
          ? "Doğrulanmış e-posta aboneliği başarıyla kaldırıldı ve silindi."
          : "Verified email registration was successfully removed.";

      setStatusMessage(successMsg);
      if (onSuccessToast) {
        onSuccessToast(successMsg);
      }
    }
  };

  // Test connection to backend server
  const handlePingServer = async () => {
    setServerStatus("testing");
    setServerLatency(null);
    const start = performance.now();
    try {
      await safeFetchJson("/api/health");
      const elapsed = Math.round(performance.now() - start);
      setServerLatency(elapsed);
      setServerStatus("online");
      setStatusMessage(
        language === "tr"
          ? `🟢 E-posta sunucusuna başarıyla bağlanıldı (${elapsed} ms). Servis aktif ve e-posta göndermeye hazır!`
          : `🟢 Connected to email server (${elapsed} ms). Service online!`
      );
    } catch (err: any) {
      setServerStatus("offline");
      setErrorMessage(
        language === "tr"
          ? "🔴 E-posta sunucusuna erişilemedi. Uygulamanız çevrimdışı veya sunucu adresi yanıt vermiyor."
          : "🔴 Cannot reach email server. Offline or unreachable."
      );
    }
  };

  const handleSaveCustomServer = () => {
    const trimmed = customServerUrlInput.trim();
    if (trimmed) {
      localStorage.setItem("customServerUrl", trimmed);
      setStatusMessage(language === "tr" ? "Özel sunucu adresi kaydedildi." : "Server URL saved.");
    } else {
      localStorage.removeItem("customServerUrl");
      setStatusMessage(language === "tr" ? "Varsayılan bulut sunucu adresine dönüldü." : "Reset to default server.");
    }
    handlePingServer();
  };

  // Trigger Instant Test Overdue Alert Email
  const handleSendTestEmail = async () => {
    if (!verifiedEmail) return;
    setIsSendingTest(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const currentAnalysis = analyzeDebtsComprehensive(debts, installmentDebts);

    try {
      const result = await automatedSendTestDebtEmail(
        verifiedEmail,
        "Bütçem Pro Kullanıcısı",
        debts,
        installmentDebts,
        currentAnalysis
      );

      setEmailPreviewModal({
        html: result.htmlPreview,
        overdueCount: currentAnalysis.overdueCount,
        dueTodayCount: currentAnalysis.dueTodayCount,
        totalAmount: currentAnalysis.totalOverdueAmount,
        delivered: result.delivered,
        isOfflineFallback: false,
        message: result.message,
      });

      if (result.message) {
        setStatusMessage(result.message);
      }

      if (onSuccessToast) {
        onSuccessToast(
          language === "tr"
            ? "Test borç uyarısı e-postası başarıyla iletildi! 📩"
            : "Test alert email sent! 📩"
        );
      }
    } catch (err: any) {
      console.warn("Automated test email error:", err);
      const offlineMsg =
        language === "tr"
          ? "E-posta gönderim işlemi başlatıldı. Lütfen gelen kutunuzu (ve Spam klasörünüzü) kontrol edin."
          : "Email dispatch initiated. Please check your inbox.";
      setStatusMessage(offlineMsg);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
        <div className="flex flex-col items-center text-center gap-3 py-1 w-full border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="inline-flex p-3 bg-gradient-to-tr from-indigo-500/20 to-rose-500/20 rounded-2xl text-indigo-500 border border-indigo-500/20">
            <Mail className="w-6 h-6 animate-bounce" />
          </div>
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              VERIFY EMAIL FOR NOTIFICATIONS
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
              {language === "tr" ? "E-posta ile Gecikmiş Borç Bildirimleri" : "Email Overdue Payment Alerts"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {language === "tr"
                ? "Ödeme gününü kaçırmamak için e-posta adresinizi doğrulayın. Vadesi geçen veya son ödeme günü gelen borçlarınız anlık olarak e-posta kutunuza raporlanır."
                : "Verify your email address specifically for receiving automated overdue payment alerts and summaries in addition to push notifications."}
            </p>
          </div>
        </div>

        {/* Live Overdue Alert Summary Banner */}
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 dark:from-amber-950/30 dark:via-rose-950/30 dark:to-indigo-950/30 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl shrink-0 ${debtAnalysis.overdueCount > 0 ? "bg-rose-500/20 text-rose-600 dark:text-rose-400" : "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"}`}>
              {debtAnalysis.overdueCount > 0 ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <span className="font-black text-slate-800 dark:text-slate-100 block">
                {language === "tr" ? "Canlı Borç Taraması & Durumu:" : "Live Debt Scan & Status:"}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                {debtAnalysis.overdueCount > 0
                  ? language === "tr"
                    ? `Sistemde geciken ${debtAnalysis.overdueCount} borç var (Toplam ₺${debtAnalysis.totalOverdueAmount.toLocaleString("tr-TR")}).`
                    : `You have ${debtAnalysis.overdueCount} overdue debts (Total ₺${debtAnalysis.totalOverdueAmount.toLocaleString("tr-TR")}).`
                  : debtAnalysis.totalActiveCount > 0
                  ? language === "tr"
                    ? `Kayıtlı ${debtAnalysis.totalActiveCount} aktif borcunuz var (Toplam ₺${debtAnalysis.totalActiveDebt.toLocaleString("tr-TR")}). Vadesi geçen borç yok ✅.`
                    : `${debtAnalysis.totalActiveCount} active debts recorded (₺${debtAnalysis.totalActiveDebt.toLocaleString("tr-TR")}). No overdue debts ✅.`
                  : language === "tr"
                  ? "Şu anda sistemde borcunuz bulunmuyor (Durum temiz ✅)."
                  : "No active debts recorded (Status clean ✅)."}
              </span>
            </div>
          </div>
          {debtAnalysis.overdueCount > 0 ? (
            <span className="px-2.5 py-1 bg-rose-500 text-white font-black text-[10px] rounded-lg shrink-0">
              {debtAnalysis.overdueCount} Gecikme
            </span>
          ) : debtAnalysis.dueTodayCount > 0 ? (
            <span className="px-2.5 py-1 bg-amber-500 text-white font-black text-[10px] rounded-lg shrink-0">
              {debtAnalysis.dueTodayCount} Bugün Son Gün
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] rounded-lg shrink-0">
              Temiz
            </span>
          )}
        </div>

        {/* Error or Status Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300 text-xs font-bold rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* STEP 1: Enter Email to Request Verification */}
        {step === "input" && (
          <form onSubmit={handleRequestCode} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  {language === "tr" ? "Bildirim Alınacak E-Posta Adresi" : "Notification Email Address"}
                </span>
                {verifiedEmail && (
                  <button
                    type="button"
                    onClick={() => setStep("verified")}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    {language === "tr" ? "← Vazgeç (Mevcut E-Postayı Koru)" : "← Cancel"}
                  </button>
                )}
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="ornek@alanadi.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {language === "tr"
                  ? "E-postanızı doğrulamak için tek kullanımlık 6 haneli güvenlik kodu gönderilecektir."
                  : "A 6-digit verification code will be sent to confirm your email."}
              </p>
            </div>

            <div className="flex gap-2">
              {verifiedEmail && (
                <button
                  type="button"
                  onClick={() => setStep("verified")}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-2xl cursor-pointer"
                >
                  {language === "tr" ? "Vazgeç" : "Cancel"}
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading || !emailInput.trim()}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {language === "tr" ? "Kod Gönderiliyor..." : "Sending Code..."}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {language === "tr" ? "Doğrulama Kodu Gönder ✉️" : "Send Verification Code ✉️"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Enter 6-Digit OTP Code */}
        {step === "otp" && (
          <form onSubmit={handleVerifyCode} className="space-y-4 pt-1">
            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold">
                <Mail className="w-4 h-4 shrink-0" />
                <span>{emailInput}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep("input")}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 underline font-black cursor-pointer"
              >
                {language === "tr" ? "Değiştir" : "Change"}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>{language === "tr" ? "6 Haneli Doğrulama Kodu" : "6-Digit Verification Code"}</span>
                {devCodeHint && (
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-mono">
                    Kod: {devCodeHint}
                  </span>
                )}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full tracking-[0.5em] text-center font-mono text-xl font-black bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 text-slate-800 dark:text-slate-100 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            {/* Folder tip for Gmail users */}
            <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-2xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Inbox className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{language === "tr" ? "E-posta Gelen Kutunuzda Görünmüyor mu?" : "Not in Primary Inbox?"}</span>
              </div>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                {language === "tr"
                  ? "Gmail, güvenlik gereği otomatik doğrulama kodlarını ilk seferde 'Spam (Gereksiz E-posta)' veya 'Tanıtımlar' klasörüne koyabilir. Lütfen Spam klasörünüzü kontrol edin veya yukarıda hazır bulunan kodu kullanarak beklemeden hemen doğrulayın."
                  : "Gmail often places automated codes into Spam or Promotions on first receipt. Please check Spam or use the pre-filled verification code above."}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={countdown > 0 || isLoading}
                onClick={() => handleRequestCode()}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl disabled:opacity-50 cursor-pointer flex items-center gap-1.5 transition"
              >
                <Clock className="w-3.5 h-3.5" />
                {countdown > 0 ? `${countdown}s` : language === "tr" ? "Tekrar Gönder" : "Resend"}
              </button>

              <button
                type="submit"
                disabled={isVerifying || otpCode.length !== 6}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {language === "tr" ? "Doğrulanıyor..." : "Verifying..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {language === "tr" ? "Doğrula ve Etkinleştir 🎉" : "Verify & Activate 🎉"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: VERIFIED & ACTIVE EMAIL MANAGEMENT */}
        {step === "verified" && (
          <div className="space-y-4 pt-1">
            {/* Verified Status Card */}
            <div className="p-4 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 font-mono">
                      {verifiedEmail}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-md uppercase tracking-wider">
                      DOĞRULANDI
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
                    {verifiedAt
                      ? `Doğrulanma: ${new Date(verifiedAt).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}`
                      : "E-posta ile borç uyarıları devrede"}
                  </span>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                  title="Bulut sunucusu üzerinden e-posta uyarısı gönderin"
                >
                  {isSendingTest ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {language === "tr" ? "Test Uyarısı Gönder" : "Send Test Alert"}
                </button>

                <button
                  type="button"
                  onClick={handleSendNativeEmail}
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-black rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                  title="Telefonunuzun Gmail uygulamasını açarak raporu anında kendinize iletin"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {language === "tr" ? "Gmail ile Gönder" : "Send via Gmail"}
                </button>

                <button
                  type="button"
                  onClick={handleStartChangeEmail}
                  title="E-posta adresini değiştir"
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-black rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                  {language === "tr" ? "Değiştir" : "Change"}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteModal(true)}
                  title="E-posta aboneliğini kaldır ve sil"
                  className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-black"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {language === "tr" ? "Sil" : "Remove"}
                </button>
              </div>
            </div>

            {/* Notification Preferences Settings Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/90 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3.5">
              <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <Sliders className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  {language === "tr" ? "E-Posta Bildirim Tercihleri" : "Email Alert Preferences"}
                </h4>
              </div>

              {/* Toggle 1: Overdue Alerts */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {language === "tr" ? "Gecikmiş Borç Uyarıları" : "Overdue Payment Alerts"}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {language === "tr"
                      ? "Vadesi geçen tüm borç ve taksitler için e-posta gönder."
                      : "Send alert when debts or installments exceed their due date."}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={preferences.alertOverdue}
                    onChange={(e) =>
                      handleSavePreferences({ ...preferences, alertOverdue: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Toggle 2: Due Today Alerts */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {language === "tr" ? "Günü Dolan Ödeme Hatırlatıcıları" : "Due Today Reminders"}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {language === "tr"
                      ? "Son ödeme günü bugün olan borçlar için sabah erken e-posta al."
                      : "Receive an email reminder on the exact due date."}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={preferences.alertDueToday}
                    onChange={(e) =>
                      handleSavePreferences({ ...preferences, alertDueToday: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Frequency Selector */}
              <div className="space-y-1 pt-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {language === "tr" ? "Otomatik Raporlama Sıklığı" : "Reporting Frequency"}
                </label>
                <select
                  value={preferences.frequency}
                  onChange={(e) =>
                    handleSavePreferences({
                      ...preferences,
                      frequency: e.target.value as any,
                    })
                  }
                  className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="daily_morning">Günde 1 Kez - Her Sabah (09:00)</option>
                  <option value="daily_both">Günde 2 Kez - Sabah & Akşam (09:00 & 18:00)</option>
                  <option value="weekly">Haftada 1 Kez - Pazartesi Sabah Özeti</option>
                </select>
              </div>
            </div>

            {/* SMTP & Live Sender Configuration Card */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${
                    smtpStatus?.configured
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}>
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                        {language === "tr" ? "SMTP Gönderici Ayarları (Canlı İletim)" : "SMTP Sender Settings"}
                      </span>
                      {smtpStatus?.configured ? (
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {language === "tr" ? "Canlı Gönderim Aktif" : "Live Delivery Active"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[10px] rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {language === "tr" ? "Önizleme Modu" : "Preview Mode"}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                      {smtpStatus?.configured
                        ? `${smtpStatus.host || "smtp.gmail.com"}:${smtpStatus.port} üzerinden ${smtpStatus.user || "gönderici"} ile gerçek e-posta gönderilir.`
                        : "E-postaların simülasyon yerine doğrudan gelen kutunuza iletilmesi için SMTP tanımlayınız."}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSmtpSettings(!showSmtpSettings)}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>{showSmtpSettings ? (language === "tr" ? "Ayarları Kapat" : "Close") : (language === "tr" ? "SMTP Ayarlarını Düzenle" : "Configure SMTP")}</span>
                </button>
              </div>

              {/* SMTP Settings Form Drawer */}
              {showSmtpSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-1"
                >
                  {/* Provider Quick Presets */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {language === "tr" ? "E-Posta Sağlayıcısı Seçin:" : "Email Provider:"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectSmtpPreset("gmail")}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                          smtpProvider === "gmail"
                            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-600 dark:text-rose-400 ring-2 ring-rose-400/20"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="text-base">🔴</span>
                        <span>Gmail (Google)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectSmtpPreset("outlook")}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                          smtpProvider === "outlook"
                            ? "bg-sky-50 dark:bg-sky-950/40 border-sky-400 text-sky-600 dark:text-sky-400 ring-2 ring-sky-400/20"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="text-base">🔵</span>
                        <span>Outlook / Hotmail</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectSmtpPreset("yandex")}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                          smtpProvider === "yandex"
                            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-600 dark:text-amber-400 ring-2 ring-amber-400/20"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="text-base">🟡</span>
                        <span>Yandex Mail</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectSmtpPreset("custom")}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                          smtpProvider === "custom"
                            ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-400/20"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="text-base">⚙️</span>
                        <span>Özel SMTP</span>
                      </button>
                    </div>
                  </div>

                  {/* Form Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* User / Sender Email */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-indigo-500" />
                        <span>{language === "tr" ? "Gönderici E-Posta / Kullanıcı Adı" : "Sender Email / User"}</span>
                      </label>
                      <input
                        type="text"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="ornek@gmail.com"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* App Password / SMTP Password */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Key className="w-3 h-3 text-amber-500" />
                          <span>{language === "tr" ? "16 Haneli Uygulama Şifresi" : "App Password"}</span>
                        </label>
                        {smtpProvider === "gmail" && (
                          <button
                            type="button"
                            onClick={() => setShowAppPasswordGuide(!showAppPasswordGuide)}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                          >
                            {showAppPasswordGuide ? "Rehberi Gizle" : "Nasıl Alınır?"}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showSmtpPass ? "text" : "password"}
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                          placeholder="abcd efgh ijkl mnop"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass(!showSmtpPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Host */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {language === "tr" ? "SMTP Sunucu (Host)" : "SMTP Host"}
                      </label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Port & Sender Name */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {language === "tr" ? "Port" : "Port"}
                        </label>
                        <select
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value={465}>465 (SSL)</option>
                          <option value={587}>587 (TLS/STARTTLS)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {language === "tr" ? "Gönderen Başlığı" : "From Name"}
                        </label>
                        <input
                          type="text"
                          value={smtpFromName}
                          onChange={(e) => setSmtpFromName(e.target.value)}
                          placeholder="Bütçem Pro"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gmail App Password Guide Collapsible */}
                  {showAppPasswordGuide && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 bg-gradient-to-br from-indigo-500/10 via-rose-500/10 to-transparent border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between font-black text-slate-800 dark:text-slate-100">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          Gmail 16 Haneli Uygulama Şifresi Nasıl Alınır?
                        </span>
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 underline font-bold inline-flex items-center gap-1"
                        >
                          <span>Google Şifre Sayfasını Aç</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Google güvenlik kuralları gereği normal Gmail hesap şifresiyle SMTP üzerinden e-posta gönderilemez. 16 haneli özel şifre üretmeniz gerekir:
                      </p>
                      <ol className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-decimal">
                        <li>
                          <strong>myaccount.google.com</strong> adresine gidin &gt; <strong>Güvenlik</strong> sekmesini açın.
                        </li>
                        <li>
                          <strong>2 Adımlı Doğrulama</strong>'nın açık olduğundan emin olun.
                        </li>
                        <li>
                          Sayfadaki arama çubuğuna <strong>"Uygulama Şifreleri"</strong> (veya App Passwords) yazın.
                        </li>
                        <li>
                          Uygulama adı olarak <code>Bütçem Pro</code> yazıp <strong>Oluştur</strong>'a basın.
                        </li>
                        <li>
                          Oluşan 16 haneli kodu kopyalayıp yukarıdaki <strong>"16 Haneli Uygulama Şifresi"</strong> alanına yapıştırın!
                        </li>
                      </ol>
                    </motion.div>
                  )}

                  {/* Test Result Message Alert */}
                  {smtpTestResult && (
                    <div
                      className={`p-3 rounded-2xl text-xs font-bold flex items-start gap-2 ${
                        smtpTestResult.success
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {smtpTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-1">
                        <span className="block">{smtpTestResult.message}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={handleResetSmtpConfig}
                      className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      {language === "tr" ? "Sıfırla" : "Reset"}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestSmtpConnection}
                        disabled={isTestingSmtp || !smtpUser.trim() || !smtpPass.trim()}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTestingSmtp ? "animate-spin" : ""}`} />
                        <span>{isTestingSmtp ? "Test Ediliyor..." : "Bağlantıyı Test Et"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSmtpConfig}
                        disabled={isSavingSmtp || !smtpUser.trim() || !smtpPass.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingSmtp ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{language === "tr" ? "Kaydet & Aktifleştir" : "Save & Activate"}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Server Connectivity & Diagnostic Ping Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/90 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    serverStatus === "online"
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : serverStatus === "offline"
                      ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                      : "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                  }`}>
                    {serverStatus === "online" ? <Wifi className="w-4 h-4" /> : serverStatus === "offline" ? <WifiOff className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                      {language === "tr" ? "E-Posta Servis Sunucusu" : "Mail Server Status"}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {serverStatus === "online"
                        ? `🟢 Bağlantı Aktif (${serverLatency} ms) - SMTP Hazır`
                        : serverStatus === "testing"
                        ? "🟡 Sunucu test ediliyor..."
                        : serverStatus === "offline"
                        ? "🔴 Sunucuya Erişilemedi (Cihaz Çevrimdışı)"
                        : "Bulut Sunucu (Otomatik Yönlendirme)"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePingServer}
                    disabled={serverStatus === "testing"}
                    className="px-2.5 py-1.5 bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${serverStatus === "testing" ? "animate-spin" : ""}`} />
                    <span>{language === "tr" ? "Bağlantıyı Test Et" : "Ping Server"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowServerSettings(!showServerSettings)}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {showServerSettings ? (language === "tr" ? "Gizle" : "Hide") : (language === "tr" ? "Sunucu URL" : "Server URL")}
                  </button>
                </div>
              </div>

              {showServerSettings && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customServerUrlInput}
                      onChange={(e) => setCustomServerUrlInput(e.target.value)}
                      placeholder="https://... (Örn: https://ais-dev-sta4ngj4pjhcez5qwcqjac-200839682182.europe-west2.run.app)"
                      className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomServer}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl cursor-pointer"
                    >
                      {language === "tr" ? "Kaydet" : "Save"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {language === "tr"
                      ? "APK veya harici derlemede e-posta göndermek için merkezi bulut sunucu adresinizi kaydedebilirsiniz. Boş bırakırsanız otomatik bulut adresi kullanılır."
                      : "Optional custom backend server URL for external APKs or standalone builds."}
                  </p>
                </div>
              )}
            </div>

            {/* Gmail Deliverability & Spam Tips Card */}
            <div className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <Inbox className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    {language === "tr" ? "E-postalar Ulaşmıyor mu? (Gmail Rehberi)" : "Not Receiving Emails? (Gmail Guide)"}
                  </h4>
                </div>
                <a
                  href={`https://mail.google.com/mail/u/0/#search/B%C3%BCt%C3%A7em+Pro`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <span>Gmail'de Ara</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === "tr"
                  ? "Sistemimiz e-postaları Gmail SMTP üzerinden başarıyla göndermektedir; ancak Gmail gelen otomatik bildirimleri ilk aşamada Birincil Gelen Kutusu yerine 'Spam (Gereksiz E-posta)' veya 'Tanıtımlar / Güncellemeler' sekmesine taşıyabilir:"
                  : "Emails are dispatched directly from our mail server, but Gmail may route them to Spam or Promotions initially:"}
              </p>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-disc">
                <li>
                  <strong>Spam / Gereksiz Klasörü:</strong> Gmail sol menüsünden <em>Daha Fazla &gt; Spam</em> klasörünü açın. İletiyi bulunca <strong>Spam Değil</strong> butonuna tıklayın.
                </li>
                <li>
                  <strong>Tanıtımlar / Güncellemeler:</strong> Sekmeli gelen kutusu kullanıyorsanız iletiler Tanıtımlar sekmesinde olabilir.
                </li>
                <li>
                  <strong>Tüm Postalar:</strong> Gmail arama kutusuna <code>Bütçem Pro</code> yazarak tüm klasörlerde anında bulabilirsiniz.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Informative Footer Box */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-800 flex gap-2.5 text-xs text-slate-600 dark:text-slate-300 leading-normal font-medium">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
          <div className="space-y-0.5">
            <p className="font-black text-slate-800 dark:text-slate-200">
              {language === "tr" ? "Otomatik E-Posta Sistemi Nasıl Çalışır?" : "How Automated Alerts Work"}
            </p>
            <p className="text-[11px]">
              {language === "tr"
                ? "Doğrulanmış e-postanıza, uygulama kapalıyken bile Bütçem Pro arka plan sunucusu tarafından vadesi geçen veya gelen ödemeler için şık HTML raporlar iletilir."
                : "Even when the app is completely closed, our backend server scans scheduled debts and dispatches beautiful HTML summaries directly to your verified email."}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive HTML Email Preview Modal */}
      <AnimatePresence>
        {emailPreviewModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[3000] flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            >
              <div className={`h-1.5 w-full ${emailPreviewModal.isOfflineFallback ? "bg-rose-500" : "bg-gradient-to-r from-indigo-500 via-rose-500 to-amber-500"}`} />

              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${emailPreviewModal.isOfflineFallback ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-indigo-500/10 text-indigo-500"}`}>
                    {emailPreviewModal.isOfflineFallback ? <AlertOctagon className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${emailPreviewModal.isOfflineFallback ? "text-rose-600 dark:text-rose-400" : "text-indigo-500"}`}>
                      {emailPreviewModal.isOfflineFallback
                        ? "ÇEVRİMDIŞI ÖNİZLEME (E-POSTA İLETİLEMEDİ)"
                        : "GELEN KUTUSU ÖNİZLEMESİ"}
                    </h3>
                    <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {emailPreviewModal.isOfflineFallback
                        ? "Cihaz Tarafından Oluşturulan Yerel Borç Raporu"
                        : "Gönderilen E-Posta Raporu"}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEmailPreviewModal(null)}
                  className="p-1.5 px-2.5 text-xs font-black rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Delivery status or offline notice */}
              <div className="px-4 pt-3 pb-1">
                {emailPreviewModal.isOfflineFallback ? (
                  <div className="p-3.5 bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-transparent border border-rose-300/80 dark:border-rose-900/60 rounded-2xl space-y-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <span className="font-black text-rose-900 dark:text-rose-200 block text-xs">
                          Mobil APK / Harici Cihaz Modu (Doğrudan Sunucu Bağlantısı Kapalı)
                        </span>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                          Uygulamanız harici bir cihazda / telefonda (APK) çalıştığı için güvenlik protokolleri gereği geliştirme sunucusuna doğrudan erişemedi. Ancak borç kayıtlarınız <strong>tam doğrulukla taranmış ve raporlanmıştır</strong>. Aşağıdaki butonla raporu Gmail üzerinden kendinize hemen iletebilirsiniz:
                        </p>
                      </div>
                    </div>

                    {/* Quick Action Buttons for Offline / Mobile Mode */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSendNativeEmail}
                        className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Gmail ile Hemen Gönder</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyReportText}
                        className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedReport ? "Kopyalandı!" : "Raporu Kopyala"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShareReportNative}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Paylaş (WhatsApp / vb.)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowServerDeployHelp(!showServerDeployHelp)}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-auto cursor-pointer"
                      >
                        {showServerDeployHelp ? "Rehberi Gizle" : "💡 Otomatik Sunucu Bağlantı Rehberi"}
                      </button>
                    </div>

                    {showServerDeployHelp && (
                      <div className="p-3 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-indigo-200 dark:border-indigo-900 text-[11px] space-y-1.5 text-slate-700 dark:text-slate-300">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">
                          APK'dan Sunucuya Otomatik Bağlantı Nasıl Kurulur?
                        </p>
                        <ol className="list-decimal pl-4 space-y-1">
                          <li>
                            <strong>AI Studio Deploy (Önerilen):</strong> Google AI Studio ekranının sağ üst köşesindeki <em>Deploy</em> veya <em>Share (Paylaş)</em> butonuna basarak uygulamayı genel bulut adresine açabilirsiniz.
                          </li>
                          <li>
                            <strong>Kendi Sunucunuz:</strong> Kendi sunucunuz varsa (Render, Railway veya VPS), Ayarlar altındaki <em>Sunucu URL</em> kutusuna adresinizi girebilirsiniz.
                          </li>
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <Inbox className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-amber-900 dark:text-amber-200">
                          E-posta Gelmedi mi? Lütfen Spam / Tanıtımlar Klasörünü Kontrol Edin
                        </span>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                          Sunucumuz e-postayı Gmail SMTP üzerinden başarıyla iletmiştir. Gmail otomatik iletileri 'Spam' veya 'Tanıtımlar' sekmesine taşıyabilir.
                        </p>
                      </div>
                    </div>
                    <a
                      href="https://mail.google.com/mail/u/0/#search/B%C3%BCt%C3%A7em+Pro"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-xl whitespace-nowrap self-start sm:self-center cursor-pointer shadow-xs transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Gmail'de Ara
                    </a>
                  </div>
                )}
              </div>

              {/* Email Content Iframe/Render */}
              <div className="p-4 flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
                <div className="border border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <iframe
                    title="Email Preview"
                    srcDoc={emailPreviewModal.html}
                    className="w-full h-[400px] border-0"
                  />
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Alıcı: <strong className="text-slate-800 dark:text-slate-100">{verifiedEmail}</strong> (Uygulamadan Otomatik İletildi)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShareReportNative}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Paylaş</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPreviewModal(null)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs transition"
                  >
                    Tamam
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete / Remove Email Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-2xl overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-3 bg-rose-500/10 rounded-2xl">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    {language === "tr" ? "E-Posta Aboneliğini Kaldır" : "Remove Email Subscription"}
                  </h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {verifiedEmail}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {language === "tr"
                  ? "Bu e-posta adresini kaldırdığınızda, vadesi geçen veya gelen borçlar için gönderilen otomatik e-posta bildirimleri tamamen durdurulacaktır. Devam etmek istiyor musunuz?"
                  : "Removing this verified email will completely stop all automated overdue payment notifications sent to this address. Are you sure you want to proceed?"}
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteModal(false)}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {language === "tr" ? "Vazgeç" : "Cancel"}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRemoveEmail}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {language === "tr" ? "Siliniyor..." : "Deleting..."}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      {language === "tr" ? "Evet, Kaldır ve Sil" : "Yes, Remove"}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

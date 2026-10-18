/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bütçem Pro - Tek Sayfalık Giriş ve Karşılama Ekranı (Welcome / Auth Screen)
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  CreditCard,
  MailCheck,
  PieChart,
  BellRing,
  Sparkles,
  Lock,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  Zap,
  UserCheck,
  UserPlus,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  Loader2,
  Check
} from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, firestore, doc, getDoc, withTimeout } from "../utils/firebase";
import {
  getDeviceUuid,
  saveUserSessionToFirestore,
  checkIsPremiumEmailInFirestore,
  checkUserTrialUsedInFirestore
} from "../utils/deviceSessionService";
import { sendWelcomeEmail } from "../utils/newsletterService";
import appLogo from "../assets/logo.png";

export interface LoginSuccessMeta {
  isPremium?: boolean;
  isGuest?: boolean;
  isPendingPayment?: boolean;
  isTrialActive?: boolean;
  isTrialExpired?: boolean;
  trialMessage?: string;
  createdAt?: string;
  hasUsedTrial?: boolean;
}

export interface WelcomeScreenProps {
  onLoginSuccess?: (email: string, meta?: LoginSuccessMeta) => void;
  onGuestContinue: () => void;
  onOpenUpgradeModal?: (featureName?: string) => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onLoginSuccess,
  onGuestContinue,
  onOpenUpgradeModal,
  onLoginClick,
  onRegisterClick
}) => {
  // Auth Form State (Giriş Yap / Kayıt Ol / Şifremi Unuttum)
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const formatAuthError = (errCode: string, defaultMsg: string): string => {
    switch (errCode) {
      case "auth/invalid-email":
        return "Geçersiz e-posta adresi formatı. Lütfen kontrol edin.";
      case "auth/user-not-found":
        return "Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen 'Kayıt Ol' sekmesinden yeni hesap oluşturun.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "E-posta veya şifre hatalı. Lütfen şifrenizi kontrol edin veya 'Şifremi Unuttum' bağlantısını kullanın.";
      case "auth/email-already-in-use":
        return "Bu e-posta adresiyle zaten kayıtlı bir hesap var. Lütfen 'Giriş Yap' sekmesinden şifrenizle giriş yapın.";
      case "auth/weak-password":
        return "Şifreniz çok zayıf. Güvenliğiniz için en az 6 karakterli bir şifre belirleyin.";
      case "auth/too-many-requests":
        return "Çok fazla başarısız deneme yapıldı. Güvenliğiniz nedeniyle lütfen birkaç dakika bekleyip tekrar deneyin.";
      case "auth/network-request-failed":
        return "İnternet bağlantısı kurulamadı. Lütfen ağ bağlantınızı kontrol edin.";
      default:
        return defaultMsg || "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.";
    }
  };

  // Tek Sayfa Giriş / Kayıt İşlemi
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      setErrorMessage("Lütfen geçerli bir e-posta adresi girin (örn: isim@gmail.com).");
      return;
    }

    // Şifremi Unuttum Akışı
    if (authMode === "forgot") {
      setIsLoading(true);
      setStatusMessage("Şifre sıfırlama bağlantısı gönderiliyor...");
      try {
        await sendPasswordResetEmail(auth, targetEmail);
        setSuccessMessage(`Şifre sıfırlama bağlantısı ${targetEmail} adresine gönderildi. Lütfen gelen kutunuzu ve spam klasörünü kontrol edin.`);
        setStatusMessage("");
      } catch (err: any) {
        setErrorMessage(formatAuthError(err?.code, err?.message));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Şifre kontrolü
    if (!password || password.length < 6) {
      setErrorMessage("Şifreniz en az 6 karakter uzunluğunda olmalıdır.");
      return;
    }

    // Kayıt Modunda Eşleşme Kontrolü
    if (authMode === "register" && password !== confirmPassword) {
      setErrorMessage("Girdiğiniz şifreler eşleşmiyor. Lütfen her iki alana da aynı şifreyi yazın.");
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === "login") {
        // -------------------------------------------------------------
        // GİRİŞ YAP AKIŞI
        // -------------------------------------------------------------
        setStatusMessage("Kimlik bilgileri doğrulanıyor...");
        const credential = await signInWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();
        const isSuperTestEmail = cleanUserEmail === "info.borcodemetakip@gmail.com";

        let isUserPremium = isSuperTestEmail;
        let determinedCreatedAt: string | null = null;
        let isGuestUser = false;

        setStatusMessage("Lisans ve oturum durumu sorgulanıyor...");

        if (!isSuperTestEmail) {
          try {
            const uSnap = await withTimeout(
              getDoc(doc(firestore, "users", user.uid)),
              3500,
              "Firestore kullanıcı sorgusu zaman aşımı"
            ).catch(() => null);

            if (uSnap && uSnap.exists()) {
              const uData = uSnap.data();
              if (uData?.createdAt) determinedCreatedAt = uData.createdAt;
              if (uData?.isGuest === true || uData?.hasUsedTrial === true) isGuestUser = true;

              if (uData?.isGuest !== true && (uData?.isPremium === true || uData?.activeSubscription === true)) {
                if (uData?.subscriptionExpiry) {
                  const expMs = new Date(uData.subscriptionExpiry).getTime();
                  isUserPremium = expMs > Date.now();
                } else {
                  isUserPremium = true;
                }
              }
            } else {
              const checkRes = await checkIsPremiumEmailInFirestore(cleanUserEmail);
              if (checkRes.isPremium) isUserPremium = true;
            }
          } catch (err) {
            console.warn("Lisans sorgulama uyarısı:", err);
          }
        }

        const deviceUuid = await Promise.race([
          getDeviceUuid(),
          new Promise<string>((res) => setTimeout(() => res("uuid_" + Math.random().toString(36).substring(2, 10)), 800))
        ]);

        if (!determinedCreatedAt && user.metadata?.creationTime) {
          determinedCreatedAt = new Date(user.metadata.creationTime).toISOString();
        }

        // Cihaz hafızasına kalıcı oturum durumunu kaydet (Auto-Login anahtarları)
        try {
          localStorage.setItem("userLoggedIn", "true");
          localStorage.setItem("hasCompletedOnboarding", "true");
          localStorage.setItem("currentUser", cleanUserEmail);
          localStorage.setItem("butcem_onboarding_welcome_v7", "true");
          localStorage.setItem("butcem_onboarding_completed_v7", "true");
          if (deviceUuid) localStorage.setItem("active_device_id", deviceUuid);
          if (determinedCreatedAt) localStorage.setItem("user_created_at", determinedCreatedAt);
        } catch (_) {}

        setStatusMessage("Giriş başarılı! Ana panoya yönlendiriliyorsunuz...");

        if (onLoginSuccess) {
          onLoginSuccess(cleanUserEmail, {
            isPremium: isUserPremium,
            isGuest: isGuestUser,
            isPendingPayment: !isUserPremium && !isGuestUser,
            createdAt: determinedCreatedAt || undefined
          });
        }
      } else {
        // -------------------------------------------------------------
        // KAYIT OL AKIŞI
        // -------------------------------------------------------------
        setStatusMessage("Yeni hesap oluşturuluyor...");
        const credential = await createUserWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();
        const nowIso = new Date().toISOString();

        const deviceUuid = await Promise.race([
          getDeviceUuid(),
          new Promise<string>((res) => setTimeout(() => res("uuid_" + Math.random().toString(36).substring(2, 10)), 800))
        ]);

        try {
          await Promise.race([
            saveUserSessionToFirestore({
              userId: user.uid,
              email: cleanUserEmail,
              isPremium: false,
              isGuest: true,
              deviceId: deviceUuid,
              createdAt: nowIso
            }),
            new Promise((res) => setTimeout(res, 1200))
          ]);
        } catch (sessErr) {
          console.warn("Firestore oturum kaydı uyarısı:", sessErr);
        }

        // Cihaz hafızasına kalıcı oturum durumunu kaydet (Auto-Login anahtarları)
        try {
          localStorage.setItem("userLoggedIn", "true");
          localStorage.setItem("hasCompletedOnboarding", "true");
          localStorage.setItem("currentUser", cleanUserEmail);
          localStorage.setItem("is_premium", "false");
          localStorage.setItem("is_guest", "true");
          localStorage.setItem("user_created_at", nowIso);
          localStorage.setItem("butcem_onboarding_welcome_v7", "true");
          localStorage.setItem("butcem_onboarding_completed_v7", "true");
          if (deviceUuid) localStorage.setItem("active_device_id", deviceUuid);
        } catch (_) {}

        // Yeni üye Hoş Geldiniz e-postası
        try {
          sendWelcomeEmail(cleanUserEmail).catch(() => {});
        } catch (_) {}

        setStatusMessage("Hesabınız oluşturuldu! Başarıyla giriş yapılıyor...");

        if (onLoginSuccess) {
          onLoginSuccess(cleanUserEmail, {
            isPremium: false,
            isGuest: true,
            createdAt: nowIso
          });
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrorMessage(formatAuthError(err?.code, err?.message));
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  // Misafir Devam Et Butonuna Basıldığında
  const handleGuestClick = () => {
    try {
      localStorage.setItem("hasCompletedOnboarding", "true");
      localStorage.setItem("userLoggedIn", "false");
      localStorage.setItem("is_guest", "true");
      localStorage.setItem("butcem_onboarding_welcome_v7", "true");
      localStorage.setItem("butcem_onboarding_completed_v7", "true");
      localStorage.setItem("skip_initial_login", "true");
    } catch (_) {}
    onGuestContinue();
  };

  return (
    <div
      id="welcome-screen-root"
      className="fixed inset-0 z-[999990] flex flex-col bg-[#050814] text-white select-none overflow-y-auto overflow-x-hidden font-sans"
    >
      {/* Dynamic Ambient Neon Lighting in Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: "strict" }}>
        <div className="absolute -top-32 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-cyan-500/15 rounded-full blur-[130px]" />
        <div className="absolute -bottom-20 left-1/4 w-[32rem] h-[32rem] bg-emerald-600/15 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,8,20,0.85)_100%)]" />
      </div>

      {/* Main Scrollable Content Container */}
      <div className="relative z-10 flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 pt-5 pb-24">
        {/* ======================================================== */}
        {/* ÜST KISIM: LOGO, BAŞLIK & SLOGAN                         */}
        {/* ======================================================== */}
        <header className="flex flex-col items-center text-center space-y-3 pt-2 sm:pt-4">
          {/* Top Badges (Turkey Flag + 2026 Edition) */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-300 text-[11px] font-black uppercase tracking-wider shadow-lg shadow-indigo-950/40 backdrop-blur-md">
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 1200 800" className="w-4 h-2.5 rounded-xs overflow-hidden inline-block shadow-xs">
                <rect width="1200" height="800" fill="#e30a17" />
                <circle cx="400" cy="400" r="200" fill="#ffffff" />
                <circle cx="450" cy="400" r="160" fill="#e30a17" />
                <polygon points="585,400 643.78,419.1 607.45,369.1 607.45,430.9 643.78,380.9" fill="#ffffff" transform="rotate(-30 585 400)" />
              </svg>
              <span>TÜRKİYE FİNANS SİSTEMİ</span>
            </span>
            <span className="w-1 h-1 rounded-full bg-indigo-400/50" />
            <span className="text-amber-400 font-extrabold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> PRO 2026
            </span>
          </div>

          {/* 3D / Neon Glow Logo */}
          <div className="relative my-2">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-3xl blur-xl opacity-60 animate-pulse" />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-2xl flex items-center justify-center border border-white/20"
            >
              <div className="w-full h-full bg-slate-950 rounded-[20px] p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={appLogo}
                  alt="Bütçem Pro"
                  className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9px] uppercase shadow-md tracking-wider">
                PRO
              </div>
            </motion.div>
          </div>

          {/* Slogan & Subtitle */}
          <div className="space-y-1.5 max-w-xl mx-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              BÜTÇEM PRO
            </h1>
            <p className="text-base sm:text-lg md:text-xl font-extrabold bg-gradient-to-r from-indigo-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              Bütçeni Yönet, Geleceğini Güçlendir!
            </p>
            <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed max-w-lg mx-auto">
              Borçlarınızı matematiksel stratejilerle eritirken nakit akışınızı kontrol altına alın; akıllı hatırlatıcılar ve kurumsal analitik tek ekranda.
            </p>
          </div>

          {/* Güvenlik Vurgusu (Security Pill Badge) */}
          <div className="pt-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>256-Bit Şifreleme ile Verileriniz Güvende</span>
            </div>
          </div>
        </header>

        {/* ======================================================== */}
        {/* ENTEGRE GİRİŞ & KAYIT ALANI (TEK SAYFADA KULLANICI GİRİŞİ) */}
        {/* ======================================================== */}
        <section className="mt-6 w-full max-w-lg mx-auto">
          <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-r from-indigo-500/50 via-purple-500/50 to-cyan-500/50 shadow-2xl shadow-indigo-950/60">
            <div className="bg-slate-950/95 backdrop-blur-2xl rounded-[23px] p-5 sm:p-7 border border-white/10 space-y-4">
              
              {/* Giriş / Kayıt Sekme Başlığı */}
              <div className="flex p-1 rounded-2xl bg-slate-900/90 border border-white/10">
                <button
                  type="button"
                  id="tab-welcome-login"
                  onClick={() => {
                    setAuthMode("login");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    authMode === "login"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-900/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Giriş Yap</span>
                </button>

                <button
                  type="button"
                  id="tab-welcome-register"
                  onClick={() => {
                    setAuthMode("register");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    authMode === "register"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-900/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Kayıt Ol</span>
                </button>
              </div>

              {/* Açıklama */}
              <p className="text-center text-xs text-slate-300">
                {authMode === "login" && "Kayıtlı e-posta ve şifrenizle giriş yapın, verilerinize anında ulaşın."}
                {authMode === "register" && "Saniyeler içinde hesabınızı oluşturun, bütçenizi tüm cihazlarınızda yönetin."}
                {authMode === "forgot" && "Şifre sıfırlama bağlantısı almak için e-posta adresinizi girin."}
              </p>

              {/* Hata ve Başarı Bildirimleri */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-snug font-medium">{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span className="leading-snug font-medium">{successMessage}</span>
                </div>
              )}

              {/* Form Alanları */}
              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                {/* E-posta Alanı */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>E-posta Adresi</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@gmail.com"
                      className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Şifre Alanı (Şifremi unuttum modunda gizlenir) */}
                {authMode !== "forgot" && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Şifre</span>
                      </label>
                      {authMode === "login" && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("forgot");
                            setErrorMessage("");
                            setSuccessMessage("");
                          }}
                          className="text-[10px] text-indigo-300 hover:text-indigo-200 underline font-medium cursor-pointer"
                        >
                          Şifremi Unuttum
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete={authMode === "register" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Şifre Tekrarı (Sadece Kayıt Modunda) */}
                {authMode === "register" && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-teal-400" />
                      <span>Şifre Tekrarı</span>
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Şifrenizi tekrar yazın"
                      className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 transition-all font-sans"
                    />
                  </div>
                )}

                {/* Ana Gönderim Butonu */}
                <button
                  type="submit"
                  disabled={isLoading}
                  id="btn-welcome-submit"
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60 active:scale-[0.98] ${
                    authMode === "register"
                      ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 shadow-emerald-500/20"
                      : "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white hover:from-indigo-500 hover:to-purple-600 shadow-indigo-600/30"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{statusMessage || "Lütfen bekleyin..."}</span>
                    </>
                  ) : authMode === "login" ? (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Giriş Yap ve Devam Et</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  ) : authMode === "register" ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Kayıt Ol ve Başla</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Sıfırlama Bağlantısı Gönder</span>
                    </>
                  )}
                </button>

                {/* Şifremi Unuttum modundan geri dön */}
                {authMode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="w-full py-2 text-center text-xs text-slate-400 hover:text-white transition cursor-pointer font-bold"
                  >
                    ← Giriş Ekranına Dön
                  </button>
                )}
              </form>

              {/* Ayırıcı */}
              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-slate-950 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  VEYA
                </span>
              </div>

              {/* 'Misafir Olarak Devam Et' Seçeneği */}
              <button
                type="button"
                id="btn-welcome-guest"
                onClick={handleGuestClick}
                className="w-full py-3 px-4 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 hover:border-slate-500 text-slate-200 hover:text-white font-bold text-xs sm:text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer group active:scale-[0.98]"
              >
                <span>Misafir Olarak Devam Et (Hesap Açmadan)</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </button>

              <p className="text-[10px] text-center text-slate-400 leading-snug">
                * Hesap açmadan da tüm borç, taksit ve bütçe araçlarını bu cihazda %100 çevrimdışı ve ücretsiz kullanabilirsiniz.
              </p>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* ORTA KISIM: 3D NEON MOCKUP KARTI                         */}
        {/* ======================================================== */}
        <section className="mt-7 w-full">
          <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-r from-indigo-500/40 via-cyan-500/40 to-emerald-500/40 shadow-2xl">
            <div className="bg-slate-950/90 backdrop-blur-xl rounded-[23px] p-4 sm:p-5 border border-white/5 space-y-3">
              {/* Mockup Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-1 text-[11px] font-black tracking-wider text-slate-300 uppercase">
                    Canlı Finansal Kontrol Paneli
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Sağlık: %94 (Güçlü)
                </span>
              </div>

              {/* 3 Kolonlu Finansal Özet Göstergesi */}
              <div className="grid grid-cols-3 gap-2 text-left">
                <div className="p-2.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20">
                  <span className="text-[10px] text-indigo-200/80 block font-semibold">Net Tasarruf</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">+₺18.500</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-950/30 border border-amber-500/20">
                  <span className="text-[10px] text-amber-200/80 block font-semibold">Aktif Taksit</span>
                  <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">5 / 12 Ödendi</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/20">
                  <span className="text-[10px] text-cyan-200/80 block font-semibold">Borç Hızı</span>
                  <span className="text-xs sm:text-sm font-black text-cyan-300 font-mono">2.4x Kartopu</span>
                </div>
              </div>

              {/* Taksit İlerleme Çubuğu Mockup */}
              <div className="p-2.5 bg-slate-900/80 rounded-2xl border border-white/5 space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Örnek Kredi Kartı & Taksit Sıfırlama İlerlemesi</span>
                  </span>
                  <span className="text-emerald-400 font-mono">%65 Kapatıldı ✓</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="bg-gradient-to-r from-emerald-400 to-cyan-400 w-[65%]" />
                  <div className="bg-indigo-500/40 w-[35%]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* ORTA KISIM: 4'LÜ ÖZELLİK VİTRİNİ (3D / NEON KARTLAR)      */}
        {/* ======================================================== */}
        <section className="mt-6 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>ÖNE ÇIKAN BÜTÇEM PRO YETENEKLERİ</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-bold">4 Temel Güç</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5 text-left">
            {/* 1. Akıllı Borç & Taksit Yönetimi */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-cyan-500/30 hover:border-cyan-400/60 transition shadow-lg shadow-cyan-950/20 group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0 group-hover:scale-105 transition">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-bold text-white">
                      Akıllı Borç & Taksit Yönetimi
                    </h3>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Kartopu & Çığ
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Kartopu ve Çığ stratejileriyle faiz yükünüzü en aza indirin, taksitlerinizi adım adım sıfırlayın.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Otomatik Aylık E-posta Raporu */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 hover:border-amber-400/60 transition shadow-lg shadow-amber-950/20 group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 group-hover:scale-105 transition">
                  <MailCheck className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-bold text-white">
                      Otomatik Aylık E-posta Raporu
                    </h3>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      PDF & Excel
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Ay sonlarında tüm finansal dökümünüz, harcama grafikleriniz ve raporlarınız otomatik posta kutunuza gelsin.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Gelir & Gider Analitiği */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 hover:border-emerald-400/60 transition shadow-lg shadow-emerald-950/20 group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 group-hover:scale-105 transition">
                  <PieChart className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-bold text-white">
                      Gelir & Gider Analitiği
                    </h3>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Net Bütçe
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Paranızın nereye gittiğini kategorize edilmiş renkli grafiklerle anında görün; birikim hedefinize ulaşın.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Vade & Taksit Hatırlatıcıları */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-purple-500/30 hover:border-purple-400/60 transition shadow-lg shadow-purple-950/20 group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0 group-hover:scale-105 transition">
                  <BellRing className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-bold text-white">
                      Vade & Taksit Hatırlatıcıları
                    </h3>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Sistem Alarmı
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Gecikme faizine son! Kritik ödeme tarihlerinden önce kilit ekranı ve bildirimlerle zamanında uyarı alın.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Trust Footnote */}
        <div className="mt-6 p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Verileriniz telefonunuzda ve bulutta 256-Bit SSL ile korunur; 3. şahıslarla asla paylaşılmaz.</span>
        </div>
      </div>
    </div>
  );
};

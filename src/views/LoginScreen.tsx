/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bütçem Pro - Standart Giriş Ekranı (Login Screen)
 * Oturum kapatıldığında veya oturum açılması gerektiğinde doğrudan bu ekran gösterilir.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  UserCheck,
  UserPlus,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles
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
  checkIsPremiumEmailInFirestore
} from "../utils/deviceSessionService";
import { sendWelcomeEmail } from "../utils/newsletterService";
import appLogo from "../assets/logo.png";
import { LoginSuccessMeta } from "./WelcomeScreen";

export interface LoginScreenProps {
  onLoginSuccess: (email: string, meta?: LoginSuccessMeta) => void;
  onGuestContinue: () => void;
  onOpenUpgradeModal?: (featureName?: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onGuestContinue,
  onOpenUpgradeModal
}) => {
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const formatAuthError = (errCode: string, defaultMsg: string): string => {
    switch (errCode) {
      case "auth/invalid-email":
        return "Geçersiz e-posta adresi formatı. Lütfen kontrol edin.";
      case "auth/user-not-found":
        return "Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen 'Kayıt Ol' sekmesinden yeni hesap oluşturun.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin veya 'Şifremi Unuttum' bağlantısını kullanın.";
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

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      setErrorMessage("Lütfen geçerli bir e-posta adresi girin (örn: isim@gmail.com).");
      return;
    }

    if (authMode === "forgot") {
      setIsLoading(true);
      setStatusMessage("Şifre sıfırlama bağlantısı gönderiliyor...");
      try {
        await sendPasswordResetEmail(auth, targetEmail);
        setSuccessMessage(`Şifre sıfırlama bağlantısı ${targetEmail} adresine gönderildi. Gelen kutunuzu ve spam klasörünüzü kontrol edin.`);
        setStatusMessage("");
      } catch (err: any) {
        setErrorMessage(formatAuthError(err?.code, err?.message));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage("Şifreniz en az 6 karakter uzunluğunda olmalıdır.");
      return;
    }

    if (authMode === "register" && password !== confirmPassword) {
      setErrorMessage("Girdiğiniz şifreler eşleşmiyor. Lütfen her iki alana da aynı şifreyi yazın.");
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === "login") {
        setStatusMessage("Kimlik bilgileri doğrulanıyor...");
        const credential = await signInWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();
        const isSuperTestEmail = cleanUserEmail === "info.borcodemetakip@gmail.com";

        let isUserPremium = isSuperTestEmail;
        let determinedCreatedAt: string | null = null;
        let isGuestUser = false;

        setStatusMessage("Hesap durumu ve yetkiler kontrol ediliyor...");

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

        // Cihaz hafızasına kalıcı oturum durumunu kaydet (Auto-Login aktif)
        try {
          localStorage.setItem("userLoggedIn", "true");
          localStorage.setItem("hasCompletedOnboarding", "true");
          localStorage.setItem("currentUser", cleanUserEmail);
          localStorage.setItem("butcem_onboarding_welcome_v7", "true");
          localStorage.setItem("butcem_onboarding_completed_v7", "true");
          if (deviceUuid) localStorage.setItem("active_device_id", deviceUuid);
          if (determinedCreatedAt) localStorage.setItem("user_created_at", determinedCreatedAt);
        } catch (_) {}

        setStatusMessage("Giriş başarılı! Ana ekrana yönlendiriliyorsunuz...");

        onLoginSuccess(cleanUserEmail, {
          isPremium: isUserPremium,
          isGuest: isGuestUser,
          isPendingPayment: !isUserPremium && !isGuestUser,
          createdAt: determinedCreatedAt || undefined
        });
      } else {
        // Kayıt Ol Modu
        setStatusMessage("Yeni hesabınız oluşturuluyor...");
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

        try {
          sendWelcomeEmail(cleanUserEmail).catch(() => {});
        } catch (_) {}

        setStatusMessage("Hesabınız oluşturuldu! Giriş yapılıyor...");

        onLoginSuccess(cleanUserEmail, {
          isPremium: false,
          isGuest: true,
          createdAt: nowIso
        });
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrorMessage(formatAuthError(err?.code, err?.message));
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

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
      id="login-screen-root"
      className="fixed inset-0 z-[999990] flex flex-col items-center justify-center bg-[#050814] text-white select-none overflow-y-auto px-4 py-8 font-sans"
    >
      {/* Dynamic Ambient Neon Lighting in Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: "strict" }}>
        <div className="absolute -top-32 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-cyan-500/15 rounded-full blur-[130px]" />
        <div className="absolute -bottom-20 left-1/4 w-[32rem] h-[32rem] bg-emerald-600/15 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,8,20,0.85)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md my-auto space-y-4">
        {/* Header with App Logo & Title */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-3xl blur-lg opacity-50 animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-xl flex items-center justify-center border border-white/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={appLogo}
                  alt="Bütçem Pro"
                  className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                />
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              BÜTÇEM PRO
            </h1>
            <p className="text-xs sm:text-sm font-bold bg-gradient-to-r from-indigo-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              {authMode === "forgot" ? "Şifre Sıfırlama" : authMode === "register" ? "Yeni Hesap Oluşturun" : "Tekrar Hoş Geldiniz"}
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-indigo-500/50 via-purple-500/50 to-cyan-500/50 shadow-2xl shadow-indigo-950/70">
          <div className="bg-slate-950/95 backdrop-blur-2xl rounded-[23px] p-5 sm:p-7 border border-white/10 space-y-4">
            
            {/* Mode Switch Tabs */}
            <div className="flex p-1 rounded-2xl bg-slate-900/90 border border-white/10">
              <button
                type="button"
                id="login-tab-login"
                onClick={() => {
                  setAuthMode("login");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex-1 py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "login"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-900/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Giriş Yap</span>
              </button>

              <button
                type="button"
                id="login-tab-register"
                onClick={() => {
                  setAuthMode("register");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex-1 py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "register"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-900/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Kayıt Ol</span>
              </button>
            </div>

            <p className="text-center text-xs text-slate-300">
              {authMode === "login" && "E-posta ve şifrenizle giriş yaparak bütçenizi yönetmeye devam edin."}
              {authMode === "register" && "Hemen ücretsiz hesabınızı oluşturun ve verilerinizi senkronize edin."}
              {authMode === "forgot" && "Kayıtlı e-posta adresinizi girerek sıfırlama bağlantısı alın."}
            </p>

            {/* Error & Success Banners */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-snug font-medium">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="leading-snug font-medium">{successMessage}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span>E-posta Adresi</span>
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@gmail.com"
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans"
                />
              </div>

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

              <button
                type="submit"
                disabled={isLoading}
                id="login-submit-btn"
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
                    <span>Giriş Yap</span>
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

            {/* Divider */}
            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-slate-950 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                VEYA
              </span>
            </div>

            {/* Guest Continue */}
            <button
              type="button"
              id="login-guest-btn"
              onClick={handleGuestClick}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer group active:scale-[0.98]"
            >
              <span>Misafir Olarak Devam Et</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-Bit SSL ile güvenli kimlik doğrulama</span>
        </div>
      </div>
    </div>
  );
};

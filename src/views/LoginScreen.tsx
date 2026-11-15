/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bütçem Pro - Tek Sayfalık Giriş ve Kayıt Ekranı
 * Sadece iki net giriş seçeneği sunar:
 * 1) Misafir Girişi (7 Günlük Ücretsiz Deneme)
 * 2) Premium Üye Girişi
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
  Sparkles,
  Zap,
  CreditCard,
  PieChart,
  BellRing,
  Crown
} from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously
} from "firebase/auth";
import { auth, firestore, doc, getDoc, withTimeout } from "../utils/firebase";
import {
  getDeviceUuid,
  saveUserSessionToFirestore,
  checkIsPremiumEmailInFirestore,
  checkUserTrialUsedInFirestore,
  provisionUserTrialInDatabases
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
  trialStartDate?: string;
  trialEndDate?: string;
  daysRemaining?: number;
  hasUsedTrial?: boolean;
}

export interface GuestTrialContinueMeta {
  uid: string;
  trialStartDate: string;
  trialEndDate: string;
  daysRemaining: number;
  isActive: boolean;
  isExpired: boolean;
}

export interface LoginScreenProps {
  onLoginSuccess: (email: string, meta?: LoginSuccessMeta) => void;
  onGuestContinue: (meta?: GuestTrialContinueMeta) => void;
  onOpenUpgradeModal?: (featureName?: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onGuestContinue,
  onOpenUpgradeModal
}) => {
  const [portalTab, setPortalTab] = useState<"guest_trial" | "premium">("guest_trial");
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("register");
  const [premiumSubMode, setPremiumSubMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
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
        setSuccessMessage(
          `Şifre sıfırlama bağlantısı ${targetEmail} adresine gönderildi. Gelen kutunuzu ve spam klasörünüzü kontrol edin.`
        );
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

    const isRegistering =
      (portalTab === "guest_trial" && authMode === "register") ||
      (portalTab === "premium" && premiumSubMode === "register");

    if (isRegistering && password !== confirmPassword) {
      setErrorMessage("Girdiğiniz şifreler eşleşmiyor. Lütfen her iki alana da aynı şifreyi yazın.");
      return;
    }

    setIsLoading(true);

    try {
      // ============================================================
      // 1) PREMİUM ÜYE GİRİŞİ / KAYDI
      // ============================================================
      if (portalTab === "premium") {
        if (premiumSubMode === "register") {
          setStatusMessage("Premium üye hesabınız oluşturuluyor...");
          const credential = await createUserWithEmailAndPassword(auth, targetEmail, password);
          const user = credential.user;
          const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();
          const nowIso = new Date().toISOString();
          const deviceUuid = await Promise.race([
            getDeviceUuid(),
            new Promise<string>((res) => setTimeout(() => res("uuid_" + Math.random().toString(36).substring(2, 10)), 800))
          ]);

          await saveUserSessionToFirestore({
            userId: user.uid,
            email: cleanUserEmail,
            isPremium: false,
            isGuest: false,
            deviceId: deviceUuid,
            createdAt: nowIso
          }).catch(() => {});

          try {
            localStorage.setItem("userLoggedIn", "true");
            localStorage.setItem("hasCompletedOnboarding", "true");
            localStorage.setItem("currentUser", cleanUserEmail);
            localStorage.setItem("is_premium", "false");
            localStorage.setItem("is_guest", "false");
            localStorage.setItem("user_created_at", nowIso);
            localStorage.removeItem("premium_source");
            localStorage.removeItem("trial_end_date");
            localStorage.setItem("butcem_onboarding_welcome_v7", "true");
            localStorage.setItem("butcem_onboarding_completed_v7", "true");
            if (deviceUuid) localStorage.setItem("active_device_id", deviceUuid);
          } catch (_) {}

          sendWelcomeEmail(cleanUserEmail).catch(() => {});

          onLoginSuccess(cleanUserEmail, {
            isPremium: false,
            isGuest: false,
            isPendingPayment: true,
            trialMessage: "Hesabınız oluşturuldu! Aboneliğinizi tamamlamak için lütfen bir Premium paket seçin.",
            createdAt: nowIso
          });

          if (onOpenUpgradeModal) {
            onOpenUpgradeModal("premium_signup");
          }
          return;
        }

        // Premium Giriş Yap
        setStatusMessage("Premium üyelik doğrulanıyor...");
        const credential = await signInWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();
        const isSuperTestEmail = cleanUserEmail === "info.borcodemetakip@gmail.com";

        let isUserPremium = isSuperTestEmail;
        let determinedCreatedAt: string | null = null;

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
              if (uData?.isGuest !== true && (uData?.isPremium === true || uData?.activeSubscription === true)) {
                if (uData?.subscriptionExpiry) {
                  isUserPremium = new Date(uData.subscriptionExpiry).getTime() > Date.now();
                } else {
                  isUserPremium = true;
                }
              }
            }
            if (!isUserPremium) {
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

        if (!isUserPremium) {
          try {
            localStorage.setItem("userLoggedIn", "true");
            localStorage.setItem("hasCompletedOnboarding", "true");
            localStorage.setItem("currentUser", cleanUserEmail);
            localStorage.setItem("is_premium", "false");
            localStorage.setItem("is_guest", "false");
            localStorage.removeItem("premium_source");
            localStorage.removeItem("trial_end_date");
            if (determinedCreatedAt) localStorage.setItem("user_created_at", determinedCreatedAt);
            if (deviceUuid) localStorage.setItem("active_device_id", deviceUuid);
          } catch (_) {}

          onLoginSuccess(cleanUserEmail, {
            isPremium: false,
            isGuest: false,
            isPendingPayment: true,
            trialMessage: "⚠️ Bu hesap için aktif bir Premium abonelik bulunamadı. Devam etmek için lütfen bir paket seçin.",
            createdAt: determinedCreatedAt || undefined
          });
          if (onOpenUpgradeModal) {
            onOpenUpgradeModal("unpaid_premium_login");
          }
          return;
        }

        await saveUserSessionToFirestore({
          userId: user.uid,
          email: cleanUserEmail,
          isPremium: true,
          isGuest: false,
          deviceId: deviceUuid,
          createdAt: determinedCreatedAt || undefined
        }).catch(() => {});

        try {
          localStorage.setItem("userLoggedIn", "true");
          localStorage.setItem("hasCompletedOnboarding", "true");
          localStorage.setItem("currentUser", cleanUserEmail);
          localStorage.setItem("is_premium", "true");
          localStorage.setItem("is_guest", "false");
          localStorage.setItem("is_guest_trial", "false");
          localStorage.setItem("is_trial_active", "false");
          localStorage.setItem("premium_source", "login");
          localStorage.removeItem("trial_end_date");
          localStorage.setItem("butcem_onboarding_welcome_v7", "true");
          localStorage.setItem("butcem_onboarding_completed_v7", "true");
          localStorage.removeItem("user_profile_avatar");
          if (deviceUuid) localStorage.setItem("active_device_id", deviceUuid);
        } catch (_) {}

        onLoginSuccess(cleanUserEmail, {
          isPremium: true,
          isGuest: false,
          createdAt: determinedCreatedAt || undefined
        });
        return;
      }

      // ============================================================
      // 2) MİSAFİR E-POSTA KAYIT / GİRİŞ (7 GÜNLÜK ÜCRETSİZ DENEME)
      // ============================================================
      if (authMode === "register") {
        setStatusMessage("7 Günlük Ücretsiz Deneme hakkı kontrol ediliyor...");
        const trialCheck = await checkUserTrialUsedInFirestore(targetEmail);
        if (trialCheck.hasUsedTrial) {
          setIsLoading(false);
          setErrorMessage(
            "Bu e-posta adresi için 7 günlük ücretsiz deneme hakkı daha önce kullanılmıştır. Lütfen 'Giriş Yap' sekmesinden giriş yapın."
          );
          return;
        }

        setStatusMessage("Misafir deneme hesabınız oluşturuluyor...");
        const credential = await createUserWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();

        const trialInfo = await provisionUserTrialInDatabases(user.uid, cleanUserEmail, false);

        try {
          localStorage.removeItem("user_profile_avatar");
          localStorage.setItem("userLoggedIn", "true");
          localStorage.setItem("hasCompletedOnboarding", "true");
          localStorage.setItem("currentUser", cleanUserEmail);
          localStorage.setItem("is_premium", "false");
          localStorage.setItem("is_guest", "false");
          localStorage.setItem("is_guest_trial", "false");
          localStorage.setItem("is_trial_active", "true");
          localStorage.setItem("trial_start_date", trialInfo.trialStartDate);
          localStorage.setItem("trial_end_date", trialInfo.trialEndDate);
          localStorage.setItem("user_created_at", trialInfo.trialStartDate);
          localStorage.setItem("has_used_trial", "true");
          localStorage.setItem("premium_source", "trial");
          localStorage.setItem("butcem_onboarding_welcome_v7", "true");
          localStorage.setItem("butcem_onboarding_completed_v7", "true");
        } catch (_) {}

        sendWelcomeEmail(cleanUserEmail).catch(() => {});

        onLoginSuccess(cleanUserEmail, {
          isPremium: false,
          isGuest: false,
          isTrialActive: true,
          isTrialExpired: false,
          hasUsedTrial: true,
          trialStartDate: trialInfo.trialStartDate,
          trialEndDate: trialInfo.trialEndDate,
          daysRemaining: trialInfo.daysRemaining,
          trialMessage: "🎁 7 Günlük Ücretsiz Deneme Hesabınız Aktif! 7 gün boyunca tüm Pro özellikler açık ve reklamsızdır.",
          createdAt: trialInfo.trialStartDate
        });
      } else {
        setStatusMessage("Misafir hesabınız doğrulanıyor...");
        const credential = await signInWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();
        const isSuperTestEmail = cleanUserEmail === "info.borcodemetakip@gmail.com";

        let isUserPremium = isSuperTestEmail;
        let determinedCreatedAt: string | null = null;
        let storedTrialEnd: string | null = null;

        if (!isSuperTestEmail) {
          try {
            const uSnap = await withTimeout(
              getDoc(doc(firestore, "users", user.uid)),
              3500,
              "Firestore kullanıcı sorgusu zaman aşımı"
            ).catch(() => null);

            if (uSnap && uSnap.exists()) {
              const uData = uSnap.data();
              if (uData?.trialStartDate || uData?.createdAt) {
                determinedCreatedAt = uData.trialStartDate || uData.createdAt;
              }
              if (uData?.trialEndDate) {
                storedTrialEnd = uData.trialEndDate;
              }
              if (uData?.isGuest !== true && (uData?.isPremium === true || uData?.activeSubscription === true)) {
                isUserPremium = uData?.subscriptionExpiry
                  ? new Date(uData.subscriptionExpiry).getTime() > Date.now()
                  : true;
              }
            }
          } catch (_) {}
        }

        if (!determinedCreatedAt && user.metadata?.creationTime) {
          determinedCreatedAt = new Date(user.metadata.creationTime).toISOString();
        }
        if (!determinedCreatedAt) {
          determinedCreatedAt = new Date().toISOString();
        }
        if (!storedTrialEnd) {
          storedTrialEnd = new Date(new Date(determinedCreatedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }

        const endMs = new Date(storedTrialEnd).getTime();
        const isTrialActiveNow = !isUserPremium && !isNaN(endMs) && Date.now() < endMs;
        const isTrialExpiredNow = !isUserPremium && !isNaN(endMs) && Date.now() >= endMs;
        const daysLeft = isTrialActiveNow
          ? Math.max(1, Math.min(7, Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24))))
          : 0;

        try {
          localStorage.setItem("userLoggedIn", "true");
          localStorage.setItem("hasCompletedOnboarding", "true");
          localStorage.setItem("currentUser", cleanUserEmail);
          localStorage.setItem("is_premium", isUserPremium ? "true" : "false");
          localStorage.setItem("is_guest", "false");
          localStorage.setItem("is_guest_trial", "false");
          localStorage.setItem("user_created_at", determinedCreatedAt);
          localStorage.setItem("trial_start_date", determinedCreatedAt);
          localStorage.setItem("trial_end_date", storedTrialEnd);
          localStorage.setItem("has_used_trial", "true");
          localStorage.setItem("is_trial_active", isTrialActiveNow ? "true" : "false");
          if (isUserPremium) {
            localStorage.setItem("premium_source", "login");
          } else if (isTrialActiveNow) {
            localStorage.setItem("premium_source", "trial");
          } else {
            localStorage.removeItem("premium_source");
          }
          localStorage.setItem("butcem_onboarding_welcome_v7", "true");
          localStorage.setItem("butcem_onboarding_completed_v7", "true");
          localStorage.removeItem("user_profile_avatar");
        } catch (_) {}

        onLoginSuccess(cleanUserEmail, {
          isPremium: isUserPremium,
          isGuest: false,
          isTrialActive: isTrialActiveNow,
          isTrialExpired: isTrialExpiredNow,
          hasUsedTrial: true,
          trialStartDate: determinedCreatedAt,
          trialEndDate: storedTrialEnd,
          daysRemaining: daysLeft,
          createdAt: determinedCreatedAt
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

  // Tek Tıkla Misafir Girişi -> 7 Günlük Ücretsiz Denemeyi Başlatır veya Kalan Günleri Sürdürür
  const handleQuickGuestTrialClick = async () => {
    setIsGuestLoading(true);
    setErrorMessage("");
    try {
      let guestUid = auth.currentUser?.uid || "";
      if (!guestUid) {
        try {
          const anonCred = await signInAnonymously(auth);
          guestUid = anonCred.user.uid;
        } catch (_) {
          const devUuid = await getDeviceUuid().catch(() => `guest_${Date.now()}`);
          guestUid = `guest_${devUuid}`;
        }
      }

      const trialInfo = await provisionUserTrialInDatabases(guestUid, "misafir@butcempro.app", true);

      try {
        localStorage.setItem("hasCompletedOnboarding", "true");
        localStorage.setItem("userLoggedIn", "true");
        localStorage.setItem("is_guest", "false");
        localStorage.setItem("is_guest_trial", "true");
        localStorage.setItem("is_premium", "false");
        localStorage.setItem("is_trial_active", trialInfo.isActive ? "true" : "false");
        localStorage.setItem("has_used_trial", "true");
        localStorage.setItem("trial_start_date", trialInfo.trialStartDate);
        localStorage.setItem("trial_end_date", trialInfo.trialEndDate);
        localStorage.setItem("user_created_at", trialInfo.trialStartDate);
        localStorage.setItem("currentUser", "misafir@butcempro.app");
        localStorage.setItem("butcem_onboarding_welcome_v7", "true");
        localStorage.setItem("butcem_onboarding_completed_v7", "true");
        if (trialInfo.isActive) {
          localStorage.setItem("premium_source", "trial");
        } else {
          localStorage.removeItem("premium_source");
        }
        localStorage.removeItem("user_profile_name");
        localStorage.removeItem("user_profile_avatar");
      } catch (_) {}

      onGuestContinue({
        uid: guestUid,
        trialStartDate: trialInfo.trialStartDate,
        trialEndDate: trialInfo.trialEndDate,
        daysRemaining: trialInfo.daysRemaining,
        isActive: trialInfo.isActive,
        isExpired: trialInfo.isExpired
      });
    } catch (err) {
      console.warn("Guest 7-day trial fallback:", err);
      const nowIso = new Date().toISOString();
      const endIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      onGuestContinue({
        uid: `guest_${Date.now()}`,
        trialStartDate: nowIso,
        trialEndDate: endIso,
        daysRemaining: 7,
        isActive: true,
        isExpired: false
      });
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div
      id="login-screen-root"
      className="fixed inset-0 z-[999990] flex flex-col items-center justify-center bg-[#040714] text-white select-none overflow-y-auto px-4 py-6 sm:py-10 font-sans"
    >
      {/* Dynamic Ambient Neon Lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: "strict" }}>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[34rem] h-[34rem] bg-indigo-600/25 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-cyan-500/20 rounded-full blur-[140px]" />
        <div className="absolute -bottom-20 -left-20 w-[30rem] h-[30rem] bg-emerald-600/20 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(4,7,20,0.85)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md my-auto space-y-4">
        {/* EN ÜST ORTA KISIM: BÜTÇEM PRO BAŞLIĞI */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute -inset-1.5 bg-gradient-to-tr from-amber-400 via-indigo-500 to-cyan-400 rounded-3xl blur-xl opacity-70 animate-pulse" />
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl p-1 bg-gradient-to-tr from-amber-400 via-indigo-500 to-cyan-400 shadow-2xl flex items-center justify-center border border-white/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] sm:rounded-[20px] p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={appLogo}
                  alt="Bütçem Pro"
                  className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]"
                />
              </div>
            </div>
          </motion.div>

          <div className="space-y-1">
            <motion.h1
              animate={{
                y: [0, -3, 0],
                filter: [
                  "drop-shadow(0 0 15px rgba(99,102,241,0.5))",
                  "drop-shadow(0 0 25px rgba(236,72,153,0.6))",
                  "drop-shadow(0 0 15px rgba(16,185,129,0.5))",
                  "drop-shadow(0 0 15px rgba(99,102,241,0.5))"
                ]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="text-3xl sm:text-4xl font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 via-indigo-300 to-emerald-300 select-none"
            >
              BÜTÇEM PRO
            </motion.h1>

            <p className="text-xs sm:text-sm font-extrabold text-slate-300 tracking-wide flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Akıllı Gelir, Gider & Taksitli Borç Takibi</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            </p>

            <div className="pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs shadow-emerald-500/20">
                <Crown className="w-3 h-3 text-amber-300" />
                <span>Misafir Girişine Özel 7 Gün Ücretsiz Deneme 🎁</span>
              </span>
            </div>
          </div>
        </div>

        {/* Mini feature badges */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5 text-center flex flex-col items-center justify-center gap-1">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span className="text-[9px] font-bold text-slate-300 leading-tight">Taksit & Borç</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5 text-center flex flex-col items-center justify-center gap-1">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <span className="text-[9px] font-bold text-slate-300 leading-tight">Gelir & Gider</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5 text-center flex flex-col items-center justify-center gap-1">
            <BellRing className="w-4 h-4 text-amber-400" />
            <span className="text-[9px] font-bold text-slate-300 leading-tight">Vade Hatırlatıcı</span>
          </div>
        </div>

        {/* Auth Card */}
        <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-emerald-500/40 via-indigo-500/40 to-amber-500/40 shadow-2xl shadow-indigo-950/70">
          <div className="bg-slate-950/95 backdrop-blur-2xl rounded-[23px] p-5 sm:p-6 border border-white/10 space-y-4">
            {/* ANA SEÇİM: Sadece 2 Giriş Modu -> 1) Misafir (7 Günlük Deneme) | 2) Premium Üye Girişi */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-white/10">
              <button
                type="button"
                id="login-portal-guest-trial"
                onClick={() => {
                  setPortalTab("guest_trial");
                  setAuthMode("register");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`py-2.5 px-2 rounded-xl font-black text-[11px] transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  portalTab === "guest_trial"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-900/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Misafir Girişi</span>
                </span>
                <span className={`text-[9px] font-bold ${portalTab === "guest_trial" ? "text-slate-950/80" : "text-emerald-400"}`}>
                  7 Gün Ücretsiz Deneme
                </span>
              </button>

              <button
                type="button"
                id="login-portal-premium"
                onClick={() => {
                  setPortalTab("premium");
                  setAuthMode("login");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`py-2.5 px-2 rounded-xl font-black text-[11px] transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  portalTab === "premium"
                    ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-900/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Premium Giriş</span>
                </span>
                <span className={`text-[9px] font-bold ${portalTab === "premium" ? "text-slate-950/80" : "text-amber-400"}`}>
                  Lisanslı Üye Girişi
                </span>
              </button>
            </div>

            {/* MİSAFİR 7 GÜNLÜK ÜCRETSİZ DENEME HIZLI GİRİŞ BUTONU */}
            {portalTab === "guest_trial" && (
              <div className="space-y-3">
                <button
                  type="button"
                  id="login-guest-btn"
                  disabled={isGuestLoading}
                  onClick={handleQuickGuestTrialClick}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer group active:scale-[0.98] shadow-lg shadow-emerald-500/25"
                >
                  {isGuestLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>7 Günlük Misafir Denemesi Başlatılıyor...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>Hemen Misafir Girişi Yap (7 Gün Ücretsiz)</span>
                      <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-all" />
                    </>
                  )}
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-white/10 w-full" />
                  <span className="bg-slate-950 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    VEYA E-POSTA İLE 7 GÜN DENEME
                  </span>
                </div>

                {/* Alt Mod Seçici: Kayıt Ol / Giriş Yap */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/10">
                  <button
                    type="button"
                    id="login-tab-register"
                    onClick={() => {
                      setAuthMode("register");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className={`py-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === "register"
                        ? "bg-slate-800 text-emerald-300 shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Kayıt Ol (7 Gün)</span>
                  </button>
                  <button
                    type="button"
                    id="login-tab-login"
                    onClick={() => {
                      setAuthMode("login");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className={`py-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === "login"
                        ? "bg-slate-800 text-indigo-300 shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Giriş Yap</span>
                  </button>
                </div>
              </div>
            )}

            {/* PREMİUM ALT MOD SEÇİCİ */}
            {portalTab === "premium" && authMode !== "forgot" && (
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setPremiumSubMode("login");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className={`py-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    premiumSubMode === "login"
                      ? "bg-slate-800 text-amber-300 shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Premium Giriş</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPremiumSubMode("register");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className={`py-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    premiumSubMode === "register"
                      ? "bg-slate-800 text-amber-300 shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Yeni Premium Hesap</span>
                </button>
              </div>
            )}

            <p className="text-center text-xs text-slate-300 font-medium">
              {authMode === "forgot"
                ? "Kayıtlı e-posta adresinize şifre sıfırlama bağlantısı gönderin."
                : portalTab === "premium"
                ? premiumSubMode === "register"
                  ? "Hesabınızı oluşturun, ardından doğrudan Premium paket seçimine geçin."
                  : "Lisanslı Premium hesabınızla giriş yaparak tüm özellikleri sınırsız kullanın."
                : authMode === "register"
                ? "E-posta ile kaydolun, 7 günlük ücretsiz denemeniz bulutta da korunsun."
                : "Mevcut misafir hesabınıza giriş yaparak kaldığınız günden devam edin."}
            </p>

            {/* Error & Success Banners */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-snug font-medium">{errorMessage}</span>
                </motion.div>
              )}

              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span className="leading-snug font-medium">{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  E-Posta Adresi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    id="login-email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@gmail.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-white text-xs placeholder:text-slate-600 transition outline-hidden"
                  />
                </div>
              </div>

              {authMode !== "forgot" && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Şifre
                    </label>
                    {((portalTab === "guest_trial" && authMode === "login") ||
                      (portalTab === "premium" && premiumSubMode === "login")) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setErrorMessage("");
                          setSuccessMessage("");
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                      >
                        Şifremi Unuttum?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      id="login-password-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={
                        (portalTab === "guest_trial" && authMode === "register") ||
                        (portalTab === "premium" && premiumSubMode === "register")
                          ? "new-password"
                          : "current-password"
                      }
                      className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-900 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-white text-xs placeholder:text-slate-600 transition outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {authMode !== "forgot" &&
                ((portalTab === "guest_trial" && authMode === "register") ||
                  (portalTab === "premium" && premiumSubMode === "register")) && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Şifre Tekrarı
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        id="login-confirm-password-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 text-white text-xs placeholder:text-slate-600 transition outline-hidden"
                      />
                    </div>
                  </div>
                )}

              <button
                type="submit"
                disabled={isLoading}
                id="login-submit-btn"
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60 active:scale-[0.98] ${
                  portalTab === "premium"
                    ? "bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 hover:from-amber-300 hover:to-yellow-400 shadow-amber-500/25"
                    : authMode === "register"
                    ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white hover:from-indigo-500 hover:to-purple-600 shadow-indigo-600/30"
                    : "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white hover:from-indigo-500 hover:to-purple-600 shadow-indigo-600/30"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{statusMessage || "Lütfen bekleyin..."}</span>
                  </>
                ) : authMode === "forgot" ? (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Sıfırlama Bağlantısı Gönder</span>
                  </>
                ) : portalTab === "premium" ? (
                  premiumSubMode === "register" ? (
                    <>
                      <Crown className="w-4 h-4" />
                      <span>Premium Hesap Aç & Plan Seç</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4" />
                      <span>Premium Üye Girişi Yap</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )
                ) : authMode === "register" ? (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>E-posta ile 7 Gün Ücretsiz Başla</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Misafir Hesabına Giriş Yap</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
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
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 text-center select-none">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>256-Bit SSL Güvenliği</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Otomatik Senkronizasyon</span>
          </div>
        </div>
      </div>
    </div>
  );
};

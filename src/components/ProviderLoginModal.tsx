/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield as ShieldIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  AlertCircle as AlertIcon,
  X as XIcon,
  CheckCircle2 as CheckIcon,
  Lock as LockIcon,
  ArrowRight as ArrowRightIcon,
  Server as ServerIcon,
  User as UserIcon,
  Mail as MailIcon,
  UserPlus as UserPlusIcon,
  LogIn as LogInIcon,
  KeyRound as KeyRoundIcon,
  Sparkles as SparklesIcon,
  Crown as CrownIcon,
  Smartphone as SmartphoneIcon,
  Info as InfoIcon
} from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, firestore, doc, getDoc } from "../utils/firebase";
import { 
  getDeviceUuid, 
  saveUserSessionToFirestore, 
  checkIsPremiumEmailInFirestore 
} from "../utils/deviceSessionService";

export type LoginPortalTab = "premium" | "guest_trial";

export interface LoginSuccessMeta {
  isPremium?: boolean;
  isGuest?: boolean;
  isPendingPayment?: boolean;
  isTrialActive?: boolean;
  isTrialExpired?: boolean;
  trialMessage?: string;
  createdAt?: string;
}

interface ProviderLoginModalProps {
  isOpen: boolean;
  provider?: string | null;
  onClose: () => void;
  onLoginSuccess: (email: string, meta?: LoginSuccessMeta) => void;
  isPremium?: boolean;
  currentUser?: string | null;
  onOpenUpgradeModal?: (featureName?: string) => void;
  onContinueGuest?: () => void;
  initialTab?: LoginPortalTab;
  initialSubMode?: "login" | "register";
}

export const ProviderLoginModal: React.FC<ProviderLoginModalProps> = ({
  isOpen,
  provider,
  onClose,
  onLoginSuccess,
  isPremium = false,
  currentUser = null,
  onOpenUpgradeModal,
  onContinueGuest,
  initialTab = "premium",
  initialSubMode
}) => {
  // Ana Sekme: "premium" (Premium Üye Girişi / Kaydı) veya "guest_trial" (7 Günlük Ücretsiz Deneme / Misafir)
  const [activeTab, setActiveTab] = useState<LoginPortalTab>(initialTab);

  // Premium sekmesindeki alt mod: "login" (Mevcut Üye Girişi) | "register" (Yeni Premium Hesap Oluştur & Ödemeye Geç)
  const [premiumSubMode, setPremiumSubMode] = useState<"login" | "register">("login");

  // Misafir / Deneme sekmesindeki alt mod: "login" | "register"
  const [guestSubMode, setGuestSubMode] = useState<"login" | "register">("register");

  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (initialSubMode) {
        if (initialTab === "guest_trial") setGuestSubMode(initialSubMode);
        if (initialTab === "premium") setPremiumSubMode(initialSubMode);
      }
    }
  }, [isOpen, initialTab, initialSubMode]);

  // Şifre sıfırlama modu
  const [isForgotMode, setIsForgotMode] = useState(false);

  // Form alanları
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Durumlar
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMsg("");
    setIsLoading(false);
    setIsForgotMode(false);
    setSyncLogs([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleContinueWithoutAccount = () => {
    resetForm();
    if (onContinueGuest) {
      onContinueGuest();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const formatAuthError = (errCode: string, defaultMsg: string): string => {
    switch (errCode) {
      case "auth/invalid-email":
        return "Geçersiz e-posta adresi formatı. Lütfen kontrol edin.";
      case "auth/user-not-found":
        return "Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen 'Yeni Premium Hesap Oluştur' seçeneği ile kaydolun.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "E-posta veya şifre hatalı. Lütfen şifrenizi kontrol edin veya 'Şifremi Unuttum' bağlantısını kullanın.";
      case "auth/email-already-in-use":
        return "Bu e-posta adresiyle zaten kayıtlı bir hesap var. Lütfen 'Giriş Yap' seçeneğini kullanarak şifrenizle giriş yapın.";
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

  // Form Gönderimi (Giriş / Kayıt / Şifre Sıfırlama)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      setError("Lütfen geçerli bir e-posta adresi girin (örn: ornek@gmail.com).");
      return;
    }

    // 1. Şifre Sıfırlama (Hem Premium hem Misafir hesapları için güvenli Firebase şifre sıfırlama)
    if (isForgotMode) {
      setIsLoading(true);
      setError("");
      setSuccessMsg("");
      setSyncLogs([
        "Firebase Güvenli Kimlik Doğrulama Servisine Bağlanılıyor...",
        "Şifre sıfırlama bağlantısı oluşturuluyor..."
      ]);

      try {
        await sendPasswordResetEmail(auth, targetEmail);
        setSuccessMsg(`Şifre sıfırlama bağlantısı (${targetEmail}) adresine başarıyla gönderildi! Lütfen gelen kutunuzu ve spam/gereksiz klasörünü kontrol edin.`);
        setSyncLogs(prev => [
          ...prev,
          "✅ Sıfırlama e-postası başarıyla gönderildi."
        ]);
        setIsLoading(false);
      } catch (err: any) {
        setIsLoading(false);
        setError(formatAuthError(err.code, err.message));
      }
      return;
    }

    // Şifre uzunluk kontrolü
    if (!password || password.length < 6) {
      setError("Şifreniz en az 6 karakter uzunluğunda olmalıdır.");
      return;
    }

    // Kayıt modlarında şifre eşleşme kontrolü (Premium Kayıt & Misafir Kayıt)
    const isRegistering = (activeTab === "premium" && premiumSubMode === "register") || (activeTab === "guest_trial" && guestSubMode === "register");
    if (isRegistering && password !== confirmPassword) {
      setError("Girdiğiniz şifreler birbiriyle eşleşmiyor. Lütfen her iki alana da aynı şifreyi yazın.");
      return;
    }

    setIsLoading(true);
    setSyncLogs([
      "Firebase Güvenli Kimlik Doğrulama Bağlantısı Kuruluyor...",
      "Kullanıcı kimliği işleniyor..."
    ]);

    try {
      // -------------------------------------------------------------
      // AKIŞ 1: PREMIUM KAYIT (ÖNCE HESAP OLUŞTURMA -> SATIN ALMAYA YÖNLENDİRME)
      // -------------------------------------------------------------
      if (activeTab === "premium" && premiumSubMode === "register") {
        setSyncLogs(prev => [
          ...prev,
          "Firebase Auth ile yeni kullanıcı hesabı oluşturuluyor...",
          "Firestore kullanıcı dokümanı (isPremium: false) hazırlanıyor..."
        ]);

        // 1. Firebase Auth ile yeni kullanıcı oluştur
        const credential = await createUserWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();
        const nowIso = new Date().toISOString();

        // 2. Cihaz donanım kimliği al
        const deviceUuid = await Promise.race([
          getDeviceUuid(),
          new Promise<string>(res => setTimeout(() => res("uuid_" + Math.random().toString(36).substring(2, 10)), 800))
        ]);

        // 3. Firestore'daki (users/{userId}) dokümanına isPremium: false, isGuest: false olarak kaydet
        try {
          await Promise.race([
            saveUserSessionToFirestore({
              userId: user.uid,
              email: cleanUserEmail,
              isPremium: false,
              isGuest: false,
              deviceId: deviceUuid,
              createdAt: nowIso
            }),
            new Promise(res => setTimeout(res, 1200))
          ]);
        } catch (sessErr) {
          console.warn("[Premium Signup] Firestore kullanıcı kaydı uyarısı:", sessErr);
        }

        // 4. LocalStorage oturumunu güncelle
        localStorage.setItem("currentUser", cleanUserEmail);
        localStorage.setItem("is_premium", "false");
        localStorage.setItem("is_guest", "false");
        localStorage.setItem("user_created_at", nowIso);
        localStorage.removeItem("premium_source");
        localStorage.removeItem("trial_end_date");
        if (deviceUuid) {
          localStorage.setItem("active_device_id", deviceUuid);
        }

        setSyncLogs(prev => [
          ...prev,
          "✅ Hesap başarıyla oluşturuldu!",
          "🚀 Satın Alma ve Abonelik Planlarına Yönlendiriliyorsunuz..."
        ]);

        setIsLoading(false);
        handleClose();

        // 5. Otomatik Satın Alma Sayfasına Yönlendir
        onLoginSuccess(cleanUserEmail, {
          isPremium: false,
          isGuest: false,
          isPendingPayment: true,
          trialMessage: "Hesabınız oluşturuldu! Aboneliğinizi tamamlamak için lütfen bir plan seçin.",
          createdAt: nowIso
        });

        if (onOpenUpgradeModal) {
          onOpenUpgradeModal("premium_signup");
        }
        return;
      }

      // -------------------------------------------------------------
      // AKIŞ 2: PREMIUM ÜYE GİRİŞİ (E-Posta & Şifre ile Giriş)
      // -------------------------------------------------------------
      if (activeTab === "premium" && premiumSubMode === "login") {
        setSyncLogs(prev => [...prev, "Cihaz donanım kimliği taranıyor..."]);
        
        // 1. Firebase Auth ile giriş yap
        const credential = await signInWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;

        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();
        const isSuperTestEmail = cleanUserEmail === "info.borcodemetakip@gmail.com";
        let isUserPremium = isSuperTestEmail;
        let determinedCreatedAt: string | null = null;
        let isGuestUser = false;

        if (!isSuperTestEmail) {
          try {
            // Firestore users/{uid} dokümanı ve email_subscribers kontrolü
            const uSnap = await Promise.race([
              getDoc(doc(firestore, "users", user.uid)),
              new Promise<null>(res => setTimeout(() => res(null), 1200))
            ]);
            if (uSnap && uSnap.exists()) {
              const uData = uSnap.data();
              if (uData?.isPremium === true) {
                isUserPremium = true;
              }
              if (uData?.isGuest === true) {
                isGuestUser = true;
              }
              if (uData?.createdAt) {
                determinedCreatedAt = uData.createdAt;
              }
            } else {
              const checkRes = await Promise.race([
                checkIsPremiumEmailInFirestore(cleanUserEmail),
                new Promise<{ exists: boolean; isPremium: boolean }>(res => setTimeout(() => res({ exists: false, isPremium: false }), 1200))
              ]);
              if (checkRes.isPremium) {
                isUserPremium = true;
              }
            }
          } catch {
            // Devam et
          }
        }

        // 2. @capacitor/device ile cihaz UUID'sini al
        const deviceUuid = await Promise.race([
          getDeviceUuid(),
          new Promise<string>(res => setTimeout(() => res("uuid_" + Math.random().toString(36).substring(2, 10)), 800))
        ]);

        if (!determinedCreatedAt && user.metadata?.creationTime) {
          determinedCreatedAt = new Date(user.metadata.creationTime).toISOString();
        }

        setSyncLogs(prev => [
          ...prev,
          `Giriş Doğrulandı: ${cleanUserEmail}`,
          isUserPremium 
            ? "👑 Lisanslı Premium Üyelik Doğrulandı" 
            : "⚠️ Abonelik Tamamlanmamış (Ödeme Bekleniyor)",
          "Güvenlik ve oturum kaydı işleniyor..."
        ]);

        // 3. Firestore'daki kullanıcı dokümanına kaydet
        try {
          await Promise.race([
            saveUserSessionToFirestore({
              userId: user.uid,
              email: cleanUserEmail,
              isPremium: isUserPremium,
              isGuest: isGuestUser,
              deviceId: deviceUuid,
              createdAt: determinedCreatedAt || undefined
            }),
            new Promise(res => setTimeout(res, 1200))
          ]);
        } catch (sessErr) {
          console.warn("[Login] Firestore oturum kaydı uyarısı:", sessErr);
        }

        // 4. Yerel hafızayı güncelle
        localStorage.setItem("currentUser", cleanUserEmail);
        localStorage.setItem("is_premium", isUserPremium ? "true" : "false");
        localStorage.setItem("is_guest", isGuestUser ? "true" : "false");
        if (determinedCreatedAt) {
          localStorage.setItem("user_created_at", determinedCreatedAt);
        }

        if (isUserPremium) {
          localStorage.setItem("premium_source", "login");
        } else {
          localStorage.removeItem("premium_source");
          localStorage.removeItem("trial_end_date");
        }

        if (deviceUuid) {
          localStorage.setItem("active_device_id", deviceUuid);
        }

        setIsLoading(false);
        handleClose();

        // 5. ÖDEME YAPMADAN ÇIKANLAR İÇİN KONTROL:
        // Eğer isPremium === false ise ana sayfaya geçişi engelle, kullanıcıyı doğrudan Satın Alma Sayfasına yönlendir!
        if (!isUserPremium) {
          onLoginSuccess(cleanUserEmail, {
            isPremium: false,
            isGuest: false,
            isPendingPayment: true,
            trialMessage: "Aboneliğinizi tamamlamak için lütfen bir plan seçin.",
            createdAt: determinedCreatedAt || undefined
          });

          if (onOpenUpgradeModal) {
            onOpenUpgradeModal("unpaid_premium_login");
          }
          return;
        }

        // Lisanslı Premium Kullanıcı -> Ana Sayfaya Aç
        onLoginSuccess(cleanUserEmail, {
          isPremium: true,
          isGuest: false,
          createdAt: determinedCreatedAt || undefined
        });
        return;
      } 
      // -------------------------------------------------------------
      // DURUM 2: "7 Günlük Ücretsiz Deneme (Misafir) Girişi / Kaydı"
      // -------------------------------------------------------------
      else {
        let user;
        const now = new Date();
        let determinedCreatedAt = now.toISOString();

        if (guestSubMode === "register") {
          setSyncLogs(prev => [...prev, "Yeni 7 Günlük Deneme hesabı oluşturuluyor..."]);
          const credential = await createUserWithEmailAndPassword(auth, targetEmail, password);
          user = credential.user;
          if (user.metadata?.creationTime) {
            determinedCreatedAt = new Date(user.metadata.creationTime).toISOString();
          }
        } else {
          setSyncLogs(prev => [...prev, "Misafir hesabı doğrulanıyor..."]);
          const credential = await signInWithEmailAndPassword(auth, targetEmail, password);
          user = credential.user;
          try {
            const userDocSnap = await getDoc(doc(firestore, "users", user.uid));
            if (userDocSnap.exists()) {
              const uData = userDocSnap.data();
              if (uData.createdAt) {
                determinedCreatedAt = uData.createdAt;
              }
            }
          } catch {
            // Devam et
          }
          if (!determinedCreatedAt && user.metadata?.creationTime) {
            determinedCreatedAt = new Date(user.metadata.creationTime).toISOString();
          }
        }

        const cleanUserEmail = (user.email || targetEmail).trim().toLowerCase();

        // 7 günlük süre kontrolü
        const createdAtMs = new Date(determinedCreatedAt).getTime();
        const diffDays = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24);
        const isTrialActive = diffDays < 7;
        const isTrialExpired = diffDays >= 7;

        // Firestore'daki kullanıcı dokümanına (users/{userId}) "isPremium": false ve "isGuest": true değerleri işlensin
        setSyncLogs(prev => [
          ...prev,
          `Hesap Bağlandı: ${cleanUserEmail}`,
          isTrialActive ? "🎁 7 Günlük Deneme hesabı tanımlanıyor..." : "⏳ Deneme süresi doldu"
        ]);

        try {
          await Promise.race([
            saveUserSessionToFirestore({
              userId: user.uid,
              email: cleanUserEmail,
              isPremium: false,
              isGuest: true,
              createdAt: determinedCreatedAt
            }),
            new Promise(res => setTimeout(res, 1200))
          ]);
        } catch (gErr) {
          console.warn("[Login] Misafir oturum kaydı uyarısı:", gErr);
        }

        const trialEndDate = new Date(createdAtMs + 7 * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem("currentUser", cleanUserEmail);
        localStorage.setItem("is_premium", isTrialActive ? "true" : "false");
        localStorage.setItem("is_guest", "true");
        localStorage.setItem("user_created_at", determinedCreatedAt);

        if (isTrialActive) {
          localStorage.setItem("trial_end_date", trialEndDate);
          localStorage.setItem("premium_source", "trial");
        } else {
          localStorage.removeItem("trial_end_date");
          localStorage.removeItem("premium_source");
        }

        setIsLoading(false);
        handleClose();

        if (isTrialExpired) {
          onLoginSuccess(cleanUserEmail, {
            isPremium: false,
            isGuest: true,
            isTrialExpired: true,
            createdAt: determinedCreatedAt
          });
        } else {
          onLoginSuccess(cleanUserEmail, {
            isPremium: true,
            isGuest: true,
            isTrialActive: true,
            trialMessage: guestSubMode === "register" 
              ? "🎁 Bütçem Pro 7 Günlük Ücretsiz Deneme Süreniz Başlatıldı! Tüm PRO özellikler açık!"
              : "🎁 7 Günlük Ücretsiz Deneme Süreniz Aktif! Tüm PRO özellikleri kullanabilirsiniz.",
            createdAt: determinedCreatedAt
          });
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(formatAuthError(err.code, err.message));
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="provider-login-modal-backdrop"
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[1000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      >
        <motion.div
          id="provider-login-modal-card"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative my-auto text-left"
        >
          {/* Üst Renkli Çizgi Vurgusu */}
          <div 
            className={`h-2 w-full transition-colors duration-300 ${
              activeTab === "premium"
                ? "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500"
                : "bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500"
            }`} 
          />

          {/* Modal Başlık Kısmı */}
          <div className="p-5 sm:p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="flex items-center gap-3">
              <div 
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs transition-colors ${
                  activeTab === "premium"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-500"
                    : "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                }`}
              >
                {activeTab === "premium" ? (
                  <CrownIcon className="w-5 h-5" />
                ) : (
                  <SparklesIcon className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block">
                  Bütçem Pro • Hesap & Oturum Merkezi
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  {isForgotMode
                    ? "Şifre Sıfırlama"
                    : activeTab === "premium"
                    ? (premiumSubMode === "register" ? "Yeni Premium Hesap Oluştur" : "Premium Üye Girişi")
                    : (guestSubMode === "register" ? "7 Günlük Ücretsiz Deneme Kaydı" : "Misafir Girişi")}
                </h2>
              </div>
            </div>

            <button
              id="provider-login-modal-close-button"
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-90 cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            {/* Şifre Sıfırlama Güvenlik Bilgilendirmesi */}
            {isForgotMode && (
              <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-start gap-2.5">
                <ShieldIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-left space-y-0.5">
                  <div className="text-xs font-black text-indigo-750 dark:text-indigo-300">
                    Şifre Sıfırlama Bağlantısı
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    Kayıtlı e-posta adresinizi girin. E-postanıza güvenli bir şifre sıfırlama bağlantısı gönderilecektir.
                  </p>
                </div>
              </div>
            )}
            {/* ----------------------------------------------------------------- */}
            {/* 1. İKİ SEÇENEĞİ NET OLARAK SUNAN ANA SEÇİM PANELİ (TAB SWITCHER) */}
            {/* ----------------------------------------------------------------- */}
            {!isForgotMode && (
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                {/* 1. SEÇENEK: Premium Üye Girişi */}
                <button
                  id="tab-premium-member-login"
                  type="button"
                  onClick={() => {
                    setActiveTab("premium");
                    setError("");
                    setSuccessMsg("");
                  }}
                  className={`p-2.5 sm:p-3 rounded-xl font-black text-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                    activeTab === "premium"
                      ? "bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <CrownIcon className="w-4 h-4" />
                    <span>👑 Premium Üyelik</span>
                  </div>
                  <span className={`text-[10px] font-bold ${activeTab === "premium" ? "text-slate-950/80" : "text-slate-400 dark:text-slate-500"}`}>
                    Kayıt & Giriş (PRO)
                  </span>
                </button>

                {/* 2. SEÇENEK: 7 Günlük Ücretsiz Deneme (Misafir) Girişi / Kaydı */}
                <button
                  id="tab-guest-trial-login"
                  type="button"
                  onClick={() => {
                    setActiveTab("guest_trial");
                    setError("");
                    setSuccessMsg("");
                  }}
                  className={`p-2.5 sm:p-3 rounded-xl font-black text-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                    activeTab === "guest_trial"
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 font-black"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <SparklesIcon className="w-4 h-4" />
                    <span>🎁 7 Günlük Deneme</span>
                  </div>
                  <span className={`text-[10px] font-bold ${activeTab === "guest_trial" ? "text-white/90" : "text-slate-400 dark:text-slate-500"}`}>
                    Misafir Girişi & Kayıt
                  </span>
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* BİLGİLENDİRME ROZETLERİ (SEÇİLEN SEKMEYE ÖZGÜ MİMARİ AÇIKLAMASI) */}
            {/* ------------------------------------------------------------- */}
            {!isForgotMode && activeTab === "premium" && (
              <div className="space-y-2">
                {/* Premium sekmesi için Giriş Yap / Yeni Kayıt alt seçicisi */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPremiumSubMode("login");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      premiumSubMode === "login"
                        ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <LogInIcon className="w-3.5 h-3.5" />
                    <span>Giriş Yap</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPremiumSubMode("register");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      premiumSubMode === "register"
                        ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <UserPlusIcon className="w-3.5 h-3.5" />
                    <span>Yeni Hesap Aç</span>
                  </button>
                </div>

                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5">
                  <SmartphoneIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-left space-y-0.5">
                    <div className="text-xs font-black text-amber-700 dark:text-amber-300">
                      {premiumSubMode === "register" 
                        ? "1. Adım: Hesap Oluşturma, 2. Adım: Plan Seçimi" 
                        : "Tek Cihaz Korumalı Premium Giriş"}
                    </div>
                    <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 font-medium leading-relaxed">
                      {premiumSubMode === "register"
                        ? "Başka bir cihaza geçtiğinizde şifrenizle girebilmeniz için önce hesabınızı oluşturun, ardından doğrudan abonelik ve ödeme sayfasına yönlendirileceksiniz."
                        : "Premium hesabınız bu cihaza bağlanır. Başka bir cihaza geçtiğinizde şifrenizle giriş yaparak lisansınızı kullanmaya devam edebilirsiniz."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isForgotMode && activeTab === "guest_trial" && (
              <div className="space-y-2">
                {/* Misafir sekmesi için Giriş Yap / Kayıt Ol alt seçicisi */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setGuestSubMode("register");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      guestSubMode === "register"
                        ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <UserPlusIcon className="w-3.5 h-3.5" />
                    <span>Yeni Kayıt Ol</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGuestSubMode("login");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      guestSubMode === "login"
                        ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <LogInIcon className="w-3.5 h-3.5" />
                    <span>Giriş Yap</span>
                  </button>
                </div>

                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-2.5">
                  <SparklesIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-left space-y-0.5">
                    <div className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                      7 Günlük Ücretsiz Deneme (Misafir Modu)
                    </div>
                    <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 font-medium leading-relaxed">
                      E-posta ve şifrenizi belirleyerek kaydolun veya mevcut misafir hesabınıza girin. 7 gün boyunca tüm özellikleri ücretsiz kullanabilirsiniz. Bu modda tek cihaz kısıtlaması uygulanmaz.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* YÜKLENİYOR / EŞİTLEME SÜRECİ EKRANI */}
            {/* ------------------------------------------------------------- */}
            {isLoading && syncLogs.length > 0 ? (
              <div className="py-6 space-y-4 text-center flex flex-col items-center">
                <div className="relative inline-block">
                  <span className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin inline-block" />
                  <ServerIcon className="w-5 h-5 text-indigo-500 absolute top-[14px] left-[14px] animate-pulse" />
                </div>
                <div className="p-3.5 bg-slate-950 text-slate-300 rounded-2xl border border-slate-800 font-mono text-[10px] space-y-1.5 max-h-40 overflow-y-auto text-left shadow-inner w-full">
                  {syncLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-emerald-400">➜</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ------------------------------------------------------------- */
              /* GİRİŞ & KAYIT FORMU */
              /* ------------------------------------------------------------- */
              <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
                {/* E-Posta Alanı */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    E-Posta Adresi
                  </label>
                  <div className="relative">
                    <input
                      id="auth-input-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                    />
                    <div className="absolute left-3.5 top-3 text-slate-400">
                      <MailIcon className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Şifre Alanı */}
                {!isForgotMode && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Şifre
                      </label>
                      {((activeTab === "premium" && premiumSubMode === "login") ||
                        (activeTab === "guest_trial" && guestSubMode === "login")) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotMode(true);
                            setError("");
                            setSuccessMsg("");
                          }}
                          className={`text-[11px] font-bold hover:underline cursor-pointer ${
                            activeTab === "premium" 
                              ? "text-amber-600 dark:text-amber-400" 
                              : "text-indigo-600 dark:text-indigo-400"
                          }`}
                        >
                          Şifremi Unuttum?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="auth-input-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                      />
                      <div className="absolute left-3.5 top-3 text-slate-400">
                        <LockIcon className="w-4 h-4" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Kayıt Modlarında Şifre Onayı (Hem Premium Kayıt hem Misafir Kayıt için) */}
                {!isForgotMode && (
                  (activeTab === "premium" && premiumSubMode === "register") ||
                  (activeTab === "guest_trial" && guestSubMode === "register")
                ) && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Şifre Tekrarı
                    </label>
                    <div className="relative">
                      <input
                        id="auth-input-confirm-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Şifrenizi tekrar girin"
                        className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 text-sm font-medium ${
                          activeTab === "premium" ? "focus:ring-amber-500" : "focus:ring-emerald-500"
                        }`}
                      />
                      <div className="absolute left-3.5 top-3 text-slate-400">
                        <LockIcon className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Hata Bildirimi */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-600 dark:text-rose-400 text-xs text-left"
                  >
                    <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Başarı Bildirimi */}
                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2 text-emerald-600 dark:text-emerald-400 text-xs text-left"
                  >
                    <CheckIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </motion.div>
                )}

                {/* Ana Gönderim Butonu */}
                <div className="pt-2">
                  <button
                    id="auth-submit-button"
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3.5 px-4 font-black text-xs uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.98] disabled:opacity-50 ${
                      isForgotMode
                        ? "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20"
                        : activeTab === "premium"
                        ? (premiumSubMode === "register"
                            ? "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-amber-500/25"
                            : "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-amber-500/25")
                        : guestSubMode === "register"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20"
                    }`}
                  >
                    {isForgotMode ? (
                      <>
                        <MailIcon className="w-4 h-4" />
                        <span>Sıfırlama Bağlantısı Gönder</span>
                      </>
                    ) : activeTab === "premium" ? (
                      premiumSubMode === "register" ? (
                        <>
                          <CrownIcon className="w-4 h-4 text-slate-950" />
                          <span>✨ Kaydol ve Ödemeye Geç</span>
                          <ArrowRightIcon className="w-4 h-4 text-slate-950" />
                        </>
                      ) : (
                        <>
                          <CrownIcon className="w-4 h-4 text-slate-950" />
                          <span>👑 Premium Üye Girişi Yap</span>
                          <ArrowRightIcon className="w-4 h-4 text-slate-950" />
                        </>
                      )
                    ) : guestSubMode === "register" ? (
                      <>
                        <SparklesIcon className="w-4 h-4" />
                        <span>🚀 7 Günlük Denemeyi Başlat (Kayıt Ol)</span>
                      </>
                    ) : (
                      <>
                        <LogInIcon className="w-4 h-4" />
                        <span>🚀 Misafir Hesabına Giriş Yap</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 2. PREMIUM ALT YÖNLENDİRMELERİ */}
                {!isForgotMode && activeTab === "premium" && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    {premiumSubMode === "login" ? (
                      <>
                        <div className="text-center">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Henüz bir Premium üyeliğiniz yok mu?
                          </span>
                        </div>
                        <button
                          id="btn-switch-to-premium-register"
                          type="button"
                          onClick={() => {
                            setPremiumSubMode("register");
                            setError("");
                            setSuccessMsg("");
                          }}
                          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 hover:from-amber-500/30 hover:to-amber-500/30 border border-amber-500/40 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          <UserPlusIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>✨ Yeni Premium Hesap Oluştur (Kayıt Ol)</span>
                          <ArrowRightIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        </button>
                        <p className="text-[10.5px] text-center text-slate-500 dark:text-slate-400 leading-snug">
                          🔒 Hesabınızı e-posta ve şifrenizle oluşturduktan sonra doğrudan Satın Alma Sayfasına yönlendirileceksiniz.
                        </p>
                      </>
                    ) : (
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setPremiumSubMode("login");
                            setError("");
                            setSuccessMsg("");
                          }}
                          className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                        >
                          <LogInIcon className="w-3.5 h-3.5" />
                          <span>Zaten bir hesabınız var mı? Giriş Yapın</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isForgotMode && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(false);
                        setError("");
                        setSuccessMsg("");
                      }}
                      className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      ← Giriş Ekranına Dön
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 3. KAYIT OLMADAN KEŞFET / ZİYARETÇİ MODU BUTONU */}
            {/* ------------------------------------------------------------- */}
            {!isForgotMode && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  id="btn-explore-without-login"
                  type="button"
                  onClick={handleContinueWithoutAccount}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <SparklesIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Kayıt Olmadan Devam Et / Keşfet (Ziyaretçi Modu)</span>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

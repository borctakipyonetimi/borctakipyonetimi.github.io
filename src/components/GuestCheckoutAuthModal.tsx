/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield as ShieldIcon,
  Lock as LockIcon,
  Mail as MailIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  CheckCircle2 as CheckIcon,
  X as XIcon,
  ArrowRight as ArrowRightIcon,
  Sparkles as SparklesIcon,
  AlertCircle as AlertIcon,
  UserCheck as UserCheckIcon
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential
} from "firebase/auth";
import { auth } from "../utils/firebase";
import { saveUserSessionToFirestore, getDeviceUuid } from "../utils/deviceSessionService";

interface GuestCheckoutAuthModalProps {
  isOpen: boolean;
  planTitle: string;
  planType: "monthly" | "yearly" | "lifetime";
  planPrice?: string;
  onClose: () => void;
  onSuccess: (registeredEmail: string) => void;
}

export const GuestCheckoutAuthModal: React.FC<GuestCheckoutAuthModalProps> = ({
  isOpen,
  planTitle,
  planType,
  planPrice,
  onClose,
  onSuccess
}) => {
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusStep, setStatusStep] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setErrorMessage("");
    setStatusStep("");
    setIsLoading(false);
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      setErrorMessage("Lütfen geçerli bir e-posta adresi girin.");
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
    setStatusStep("Güvenlik protokolü başlatılıyor...");

    try {
      let finalUserEmail = targetEmail;
      let userUid = "";

      if (authMode === "register") {
        setStatusStep("Firebase hesabı oluşturuluyor ve bağlanıyor...");

        // Anonim oturum varsa linkWithCredential ile gerçek hesaba dönüştür
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          try {
            const credential = EmailAuthProvider.credential(targetEmail, password);
            const userCred = await linkWithCredential(auth.currentUser, credential);
            userUid = userCred.user.uid;
            finalUserEmail = (userCred.user.email || targetEmail).toLowerCase();
          } catch (linkErr: any) {
            if (
              linkErr.code === "auth/credential-already-in-use" ||
              linkErr.code === "auth/email-already-in-use"
            ) {
              // E-posta zaten kayıtlıysa giriş yapmayı dene
              setStatusStep("Kayıtlı hesap tespit edildi, giriş yapılıyor...");
              const signCred = await signInWithEmailAndPassword(auth, targetEmail, password);
              userUid = signCred.user.uid;
              finalUserEmail = (signCred.user.email || targetEmail).toLowerCase();
            } else {
              // Diğer link hatalarında normal kayıt dene
              const createCred = await createUserWithEmailAndPassword(auth, targetEmail, password);
              userUid = createCred.user.uid;
              finalUserEmail = (createCred.user.email || targetEmail).toLowerCase();
            }
          }
        } else {
          // Normal yeni kayıt
          try {
            const createCred = await createUserWithEmailAndPassword(auth, targetEmail, password);
            userUid = createCred.user.uid;
            finalUserEmail = (createCred.user.email || targetEmail).toLowerCase();
          } catch (createErr: any) {
            if (createErr.code === "auth/email-already-in-use") {
              setErrorMessage("Bu e-posta adresi zaten kayıtlı. 'Zaten Hesabım Var' seçeneğiyle giriş yapabilirsiniz.");
              setIsLoading(false);
              return;
            }
            throw createErr;
          }
        }
      } else {
        // Mevcut hesap ile giriş modu
        setStatusStep("Hesabınıza giriş yapılıyor...");
        const signCred = await signInWithEmailAndPassword(auth, targetEmail, password);
        userUid = signCred.user.uid;
        finalUserEmail = (signCred.user.email || targetEmail).toLowerCase();
      }

      setStatusStep("Kullanıcı lisans kaydı doğrulanıyor...");

      // Cihaz UUID
      const deviceUuid = await Promise.race([
        getDeviceUuid(),
        new Promise<string>((res) => setTimeout(() => res("uuid_" + Math.random().toString(36).substring(2, 10)), 600))
      ]);

      const nowIso = new Date().toISOString();

      // Firestore oturum kaydı
      try {
        await saveUserSessionToFirestore({
          userId: userUid,
          email: finalUserEmail,
          isPremium: false,
          isGuest: false,
          deviceId: deviceUuid,
          createdAt: nowIso
        });
      } catch (fErr) {
        console.warn("[GuestCheckoutAuth] Firestore sync warning:", fErr);
      }

      // LocalStorage oturumunu güncelle
      localStorage.setItem("currentUser", finalUserEmail);
      localStorage.setItem("is_guest", "false");
      localStorage.setItem("user_created_at", nowIso);
      localStorage.removeItem("skip_initial_login");

      setStatusStep("✅ Hesap hazır! Kartla güvenli ödeme adımına aktarılıyorsunuz...");

      setTimeout(() => {
        setIsLoading(false);
        resetForm();
        onSuccess(finalUserEmail);
      }, 500);

    } catch (err: any) {
      setIsLoading(false);
      setStatusStep("");
      console.error("[GuestCheckoutAuth] Hata:", err);

      switch (err.code) {
        case "auth/invalid-email":
          setErrorMessage("Geçersiz e-posta adresi biçimi.");
          break;
        case "auth/email-already-in-use":
          setErrorMessage("Bu e-posta adresi zaten kayıtlı. Lütfen 'Zaten Hesabım Var' seçeneğiyle giriş yapın.");
          break;
        case "auth/weak-password":
          setErrorMessage("Şifreniz çok zayıf. En az 6 karakter kullanın.");
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setErrorMessage("Hatalı e-posta veya şifre girdiniz.");
          break;
        case "auth/user-not-found":
          setErrorMessage("Bu e-posta ile kayıtlı bir hesap bulunamadı.");
          break;
        default:
          setErrorMessage(err.message || "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.");
          break;
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[4000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-left"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-amber-500/10 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <ShieldIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                  Güvenli Satın Alma Adımı
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {authMode === "register" ? "Önce Hesabınızı Oluşturun" : "Hesabınıza Giriş Yapın"}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={handleModalClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Plan Badge Info */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <SparklesIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-amber-800 dark:text-amber-200 truncate">
                    Seçilen Paket: {planTitle}
                  </p>
                  <p className="text-[9px] text-amber-700/80 dark:text-amber-300/80 font-medium">
                    Satın alım sonrası lisansınız bu hesaba kalıcı olarak tanımlanacaktır.
                  </p>
                </div>
              </div>
              {planPrice && (
                <span className="text-xs font-black text-amber-700 dark:text-amber-300 font-mono shrink-0">
                  {planPrice}
                </span>
              )}
            </div>

            {/* Explanatory security note */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Misafir modundayken satın alım yaptığınızda lisansınızı başka telefonlarda veya cihazlarda da şifrenizle kullanabilmeniz için lütfen gerçek bir e-posta ve şifre belirleyin. Kayıt tamamlandığı an otomatik olarak kart ödeme adımına aktarılacaksınız.
            </p>

            {/* Mode switcher tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setErrorMessage("");
                }}
                className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === "register"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <UserCheckIcon className="w-3.5 h-3.5" />
                <span>Yeni Hesap Oluştur</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setErrorMessage("");
                }}
                className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === "login"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <LockIcon className="w-3.5 h-3.5" />
                <span>Zaten Hesabım Var</span>
              </button>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Progress status */}
            {isLoading && statusStep && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold animate-pulse">
                <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>{statusStep}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  E-Posta Adresi
                </label>
                <div className="relative">
                  <input
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

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Şifre
                </label>
                <div className="relative">
                  <input
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

              {/* Confirm Password (Register mode only) */}
              {authMode === "register" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Şifre Tekrar
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Şifrenizi tekrar girin"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                    />
                    <div className="absolute left-3.5 top-3 text-slate-400">
                      <LockIcon className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <span>İşlem Yapılıyor...</span>
                ) : (
                  <>
                    <span>{authMode === "register" ? "Kaydol ve Ödemeye Geç" : "Giriş Yap ve Ödemeye Geç"}</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

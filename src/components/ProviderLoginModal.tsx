/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  CheckCircle2,
  Lock,
  ArrowRight,
  Server,
  User,
  Mail,
  UserPlus,
  LogIn,
  KeyRound,
  Sparkles,
  RefreshCw
} from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "../utils/firebase";

interface ProviderLoginModalProps {
  isOpen: boolean;
  provider?: string | null;
  onClose: () => void;
  onLoginSuccess: (email: string) => void;
  isPremium?: boolean;
  onOpenUpgradeModal?: () => void;
}

export const ProviderLoginModal: React.FC<ProviderLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  isPremium = false,
  onOpenUpgradeModal
}) => {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  const resetForm = () => {
    setMode("login");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMsg("");
    setIsLoading(false);
    setSyncLogs([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const formatAuthError = (errCode: string, defaultMsg: string): string => {
    switch (errCode) {
      case "auth/invalid-email":
        return "Geçersiz e-posta adresi formatı. Lütfen kontrol edin.";
      case "auth/user-not-found":
        return "Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen 'Kayıt Ol' sekmesinden yeni hesap açın.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "E-posta veya şifre hatalı. Lütfen kişisel Gmail şifrenizi değil, Bütçem Pro için belirlediğiniz şifreyi girin. İlk kez kullanıyorsanız 'Kayıt Ol' sekmesinden yeni hesap oluşturun.";
      case "auth/email-already-in-use":
        return "Bu e-posta adresiyle zaten kayıtlı bir hesap var. Lütfen 'Giriş Yap' sekmesinden şifrenizle giriş yapın.";
      case "auth/weak-password":
        return "Şifreniz çok zayıf. Güvenliğiniz için en az 6 karakterli bir şifre belirleyin.";
      case "auth/too-many-requests":
        return "Çok fazla başarısız deneme yapıldı. Güvenlik nedeniyle lütfen birkaç dakika sonra tekrar deneyin.";
      case "auth/network-request-failed":
        return "İnternet bağlantısı kurulamadı. Lütfen ağ bağlantınızı kontrol edin.";
      default:
        return defaultMsg || "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      setError("Lütfen geçerli bir e-posta adresi girin (örn: ornek@gmail.com).");
      return;
    }

    // Forgot Password Flow
    if (mode === "forgot") {
      setIsLoading(true);
      try {
        await sendPasswordResetEmail(auth, targetEmail);
        setSuccessMsg("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi! Gelen kutunuzu ve spam klasörünü kontrol edin.");
        setIsLoading(false);
      } catch (err: any) {
        setIsLoading(false);
        setError(formatAuthError(err.code, err.message));
      }
      return;
    }

    if (!password || password.length < 6) {
      setError("Şifreniz en az 6 karakter uzunluğunda olmalıdır.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Girdiğiniz şifreler birbiriyle uyuşmuyor. Lütfen iki alanı da aynı şifreyle doldurun.");
      return;
    }

    setIsLoading(true);
    setSyncLogs([
      "Firebase SSL/TLS Güvenli Bağlantısı Kuruluyor...",
      "Kullanıcı kimliği doğrulanıyor...",
    ]);

    if (mode === "login") {
      try {
        const credential = await signInWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        setSyncLogs((prev) => [
          ...prev,
          `Giriş Başarılı: ${user.email}`,
          "Firestore bulut kayıtları taranıyor...",
          "Tüm borç, alacak ve bütçe verileriniz eşitleniyor! ⚡"
        ]);
        setTimeout(() => {
          onLoginSuccess(user.email || targetEmail);
          handleClose();
        }, 1200);
      } catch (err: any) {
        setIsLoading(false);
        setError(formatAuthError(err.code, err.message));
      }
    } else if (mode === "register") {
      try {
        const credential = await createUserWithEmailAndPassword(auth, targetEmail, password);
        const user = credential.user;
        setSyncLogs((prev) => [
          ...prev,
          `Hesap Başarıyla Açıldı: ${user.email}`,
          "Yeni Firestore bulut depolama alanı tahsis edildi...",
          "Cihazınızdaki kayıtlar hesabınıza bağlandı! 🎉"
        ]);
        setTimeout(() => {
          onLoginSuccess(user.email || targetEmail);
          handleClose();
        }, 1200);
      } catch (err: any) {
        setIsLoading(false);
        setError(formatAuthError(err.code, err.message));
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative"
        >
          {/* Top colored aesthetic streak */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

          {/* Header */}
          <div className="p-5 sm:p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-indigo-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 shadow-xs">
                {mode === "register" ? <UserPlus className="w-5 h-5" /> : mode === "forgot" ? <KeyRound className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                    Firebase Bulut Hesabı
                  </span>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                    <span>👑</span> PREMİUM ÖZEL
                  </span>
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                  {mode === "register" ? "Yeni Hesap Oluştur" : mode === "forgot" ? "Şifremi Sıfırla" : "E-Posta ile Giriş Yap"}
                </h2>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-90 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 sm:p-6 flex flex-col items-center text-center space-y-4 w-full">
            {/* Premium Özel VIP Uyarı ve Yönlendirme Kartı */}
            <div className="w-full max-w-[320px] p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/20 border-2 border-amber-500/40 rounded-2xl text-left shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-wide">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>👑 SADECE PREMİUM ÜYELERE ÖZEL</span>
                </div>
                <span className="text-[9px] bg-amber-500/25 text-amber-800 dark:text-amber-300 font-extrabold px-2 py-0.5 rounded-md uppercase">
                  VIP
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
                E-posta ile giriş ve cihazlar arası bulut senkronizasyonu <strong>Premium üyelere özel</strong> bir ayrıcalıktır.
              </p>
              {!isPremium && onOpenUpgradeModal && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenUpgradeModal();
                  }}
                  className="w-full mt-1 py-2 px-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:brightness-105 active:scale-98 text-slate-950 font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>👑 Premium Satın Al / Yükselt</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[320px] mx-auto">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccessMsg("");
                }}
                className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === "login"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Giriş Yap</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                  setSuccessMsg("");
                }}
                className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === "register"
                    ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Kayıt Ol</span>
              </button>
            </div>

            {/* Info Badge */}
            <div className="p-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-2.5 text-left w-full max-w-[320px] mx-auto">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {mode === "register"
                  ? "Kayıt olduğunuzda tüm borç ve bütçe verileriniz Firebase Firestore veritabanında sizin benzersiz kimliğinizle şifrelenerek yedeklenir."
                  : mode === "forgot"
                  ? "E-posta adresinizi girin; şifrenizi sıfırlamanız için size bir kurtarma bağlantısı göndereceğiz."
                  : "Giriş yaptığınızda başka bir telefondan veya bilgisayardan girdiğiniz tüm kayıtlarınız anında karşınıza gelir."}
              </p>
            </div>

            {/* Loading / Connecting Status Overlay */}
            {isLoading && syncLogs.length > 0 ? (
              <div className="py-6 space-y-4 text-center w-full max-w-[320px] mx-auto flex flex-col items-center">
                <div className="relative inline-block">
                  <span className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin inline-block" />
                  <Server className="w-5 h-5 text-indigo-500 absolute top-[14px] left-[14px] animate-pulse" />
                </div>
                <div className="p-3.5 bg-slate-950 text-slate-300 rounded-2xl border border-slate-800 font-mono text-[10px] space-y-1.5 max-h-36 overflow-y-auto text-left shadow-inner w-full">
                  {syncLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-emerald-400">➜</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Auth Form */
              <form onSubmit={handleSubmit} className="flex flex-col items-center w-full max-w-[320px] space-y-3.5 mx-auto text-left">
                {/* Önemli Güvenlik ve Şifre Bilgilendirme Kutusu */}
                <div className="w-full p-3.5 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 dark:border-amber-500/40 rounded-2xl text-left shadow-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-black text-xs">
                    <span>⚠️</span>
                    <span className="tracking-tight">Önemli Not:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90 font-medium">
                    Güvenliğiniz için kişisel e-posta (Gmail) şifrenizi buraya yazmayın. Eğer uygulamamızı ilk kez kullanıyorsanız, lütfen önce <strong className="font-bold underline cursor-pointer text-amber-950 dark:text-white" onClick={() => { setMode("register"); setError(""); setSuccessMsg(""); }}>"Kayıt Ol"</strong> butonuna basarak Bütçem Pro'ya özel yepyeni bir şifre belirleyin ve hesabınızı oluşturun. Ardından bu belirlediğiniz şifreyle giriş yapabilirsiniz.
                  </p>
                </div>

                {/* Email Field */}
                <div className="w-full max-w-[320px] space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block text-left">
                    E-Posta Adresi
                  </label>
                  <div className="relative w-full">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@gmail.com"
                      className="w-full max-w-[320px] pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium box-border"
                    />
                    <div className="absolute left-3.5 top-3 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Password Field */}
                {mode !== "forgot" && (
                  <div className="w-full max-w-[320px] space-y-1">
                    <div className="flex items-center justify-between w-full">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                        Şifre
                      </label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgot");
                            setError("");
                            setSuccessMsg("");
                          }}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Şifremi Unuttum?
                        </button>
                      )}
                    </div>
                    <div className="relative w-full">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full max-w-[320px] pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium box-border"
                      />
                      <div className="absolute left-3.5 top-3 text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirm Password (Only on Register) */}
                {mode === "register" && (
                  <div className="w-full max-w-[320px] space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block text-left">
                      Şifre Tekrarı
                    </label>
                    <div className="relative w-full">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full max-w-[320px] pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium box-border"
                      />
                      <div className="absolute left-3.5 top-3 text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-[320px] p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-600 dark:text-rose-400 text-xs text-left"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Success Banner */}
                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-[320px] p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2 text-emerald-600 dark:text-emerald-400 text-xs text-left"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <div className="pt-2 w-full max-w-[320px]">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full max-w-[320px] py-3 px-4 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.98] disabled:opacity-50 mx-auto ${
                      !isPremium
                        ? "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 shadow-amber-500/25"
                        : mode === "register"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20"
                        : mode === "forgot"
                        ? "bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-indigo-500/20"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/20"
                    }`}
                  >
                    {!isPremium ? (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950 animate-pulse" />
                        <span>👑 Giriş Yap (Premium Üyelik Gerekir)</span>
                      </>
                    ) : mode === "register" ? (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Hesap Oluştur ve Eşitle</span>
                      </>
                    ) : mode === "forgot" ? (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Sıfırlama Bağlantısı Gönder</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Giriş Yap ve Verileri Çek</span>
                      </>
                    )}
                  </button>
                </div>

                {mode === "forgot" && (
                  <div className="text-center pt-1 w-full max-w-[320px]">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


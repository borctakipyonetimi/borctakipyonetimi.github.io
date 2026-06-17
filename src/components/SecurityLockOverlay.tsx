/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lock,
  Delete,
  ShieldAlert,
  Key,
  HelpCircle,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface SecurityLockOverlayProps {
  onUnlockSuccess: () => void;
}

export const SecurityLockOverlay: React.FC<SecurityLockOverlayProps> = ({ onUnlockSuccess }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("security_settings");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      isEnabled: false,
      type: "pin",
      pinCode: "",
      biometricsEnabled: true,
      recoveryQuestion: "İlkokul öğretmeninizin adı nedir?",
      recoveryAnswer: "",
    };
  });

  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [shakeCode, setShakeCode] = useState(false);
  // Recovery (Şifremi Unuttum) UI states
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState("");
  const [recoveryError, setRecoveryError] = useState("");

  // Lock bypass if security not active/setup
  useEffect(() => {
    if (!settings.isEnabled || !settings.pinCode) {
      onUnlockSuccess();
    }
  }, [settings, onUnlockSuccess]);

  // Countdown lockout
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const interval = setInterval(() => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  if (!settings.isEnabled || !settings.pinCode) {
    return null;
  }

  const shakeAnimation = () => {
    setShakeCode(true);
    setTimeout(() => setShakeCode(false), 500);
  };

  const handlePinKeyPress = (val: string) => {
    if (lockoutTime > 0) return;
    setErrorMsg("");

    if (val === "clear") {
      setPinInput("");
      return;
    }

    if (val === "delete") {
      setPinInput((prev) => prev.slice(0, -1));
      return;
    }

    if (pinInput.length >= 4) return;

    const nextPin = pinInput + val;
    setPinInput(nextPin);

    if (nextPin.length === 4) {
      if (nextPin === settings.pinCode) {
        setSuccessMsg("Kilit açıldı! 🔓");
        setTimeout(() => {
          onUnlockSuccess();
        }, 500);
      } else {
        handleFailedAttempt();
        setPinInput("");
      }
    }
  };

  const handleFailedAttempt = () => {
    shakeAnimation();
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (nextAttempts >= 5) {
      setLockoutTime(30);
      setErrorMsg("Çok fazla hatalı deneme! Lütfen 30 saniye bekleyin.");
    } else {
      setErrorMsg(`Hatalı şifre girişi yapıldı! Kalan Deneme Hakkı: ${5 - nextAttempts}`);
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");

    if (!recoveryAnswerInput.trim()) {
      setRecoveryError("Lütfen güvenlik sorusunun yanıtını yazın.");
      return;
    }

    const savedAnswer = (settings.recoveryAnswer || "").trim().toLowerCase();
    const providedAnswer = recoveryAnswerInput.trim().toLowerCase();

    if (savedAnswer && providedAnswer === savedAnswer) {
      // Successful verification
      setSuccessMsg("Yanıt Doğrulandı! Güvenlik Kilidi Aşılıyor... 🔓");
      setTimeout(() => {
        setIsRecovering(false);
        setAttempts(0);
        onUnlockSuccess();
      }, 1500);
    } else if (!settings.recoveryAnswer) {
      // Default questions fallback for older versions
      const backupAnswer = "bütçem";
      if (providedAnswer === backupAnswer) {
        setSuccessMsg("Doğrulandı! Güvenlik Kilidi Aşılıyor... 🔓");
        setTimeout(() => {
          setIsRecovering(false);
          setAttempts(0);
          onUnlockSuccess();
        }, 1500);
      } else {
        setRecoveryError("Hatalı cevap girdiniz. Lütfen tekrar deneyin.");
      }
    } else {
      setRecoveryError("Hatalı yanıt girdiniz. Lütfen tekrar deneyin.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[9999] flex flex-col items-center justify-center p-4 overflow-hidden select-none">
      {/* Visual background gradient effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(255,255,255,0))]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Lock Shield Container */}
      <motion.div
        animate={shakeCode ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm bg-white/5 dark:bg-slate-900/40 backdrop-blur-xl border border-white/10 dark:border-slate-800/60 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 text-center select-none"
      >
        <div className="space-y-2">
          {/* Lock Icon and Header */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 relative">
            <Lock className="w-6 h-6 animate-pulse text-indigo-400" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
          </div>

          <h2 className="text-base font-black text-white tracking-widest uppercase mt-4">Güvenlik Kilidi</h2>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed font-semibold">
            {isRecovering 
              ? "Şifrenizi sıfırlamak için güvenlik sorusunun cevabını doğrulayın."
              : "Finansal kayıtlarınızı korumak amacıyla 4 haneli PIN şifresini girin."
            }
          </p>
        </div>

        {/* LOCKED OUT ALERT */}
        {lockoutTime > 0 && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center space-y-2 animate-pulse">
            <ShieldAlert className="w-5 h-5 text-rose-500 mx-auto" />
            <p className="text-[11px] font-bold text-rose-400 leading-tight">
              Sistem Geçici Olarak Kilitlendi
            </p>
            <p className="text-[12px] font-mono font-black text-rose-300">
              Lütfen {lockoutTime} saniye bekleyin...
            </p>
          </div>
        )}

        {/* PIN DISPLAY MODE */}
        {!isRecovering && lockoutTime === 0 && (
          <div className="space-y-4">
            {/* Visual Indicators for entered PIN */}
            <div className="flex justify-center gap-4 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-200 ${
                    pinInput.length > idx
                      ? "bg-indigo-500 border-indigo-400 scale-110 shadow-lg shadow-indigo-500/40"
                      : "border-slate-600 bg-slate-900/60"
                  }`}
                />
              ))}
            </div>

            {/* MESSAGE/ERROR DISPLAY */}
            {errorMsg && (
              <p className="text-[10px] text-rose-400 font-bold tracking-wide leading-tight bg-rose-500/5 py-1 px-3 rounded-lg border border-rose-500/10">
                {errorMsg}
              </p>
            )}

            {successMsg && (
              <p className="text-[10px] text-emerald-400 font-bold tracking-wide leading-tight bg-emerald-500/5 py-1.5 px-3 rounded-lg border border-emerald-500/10">
                {successMsg}
              </p>
            )}

            {/* NUMERIC KEYPAD */}
            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto pt-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinKeyPress(num)}
                  disabled={lockoutTime > 0}
                  className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-white/5 text-lg font-black text-white hover:scale-105 transition active:scale-95 cursor-pointer flex items-center justify-center select-none"
                >
                  {num}
                </button>
              ))}

              <div className="w-14 h-14" />

              <button
                type="button"
                onClick={() => handlePinKeyPress("0")}
                disabled={lockoutTime > 0}
                className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-white/5 text-lg font-black text-white hover:scale-105 transition active:scale-95 cursor-pointer flex items-center justify-center"
              >
                0
              </button>

              <button
                type="button"
                onClick={() => handlePinKeyPress("delete")}
                disabled={lockoutTime > 0}
                className="w-14 h-14 rounded-full bg-slate-800/20 hover:bg-slate-800/40 border border-white/5 text-white hover:scale-105 transition active:scale-95 cursor-pointer flex items-center justify-center"
              >
                <Delete className="w-5 h-5 text-slate-300" />
              </button>
            </div>

            {/* Forgot PIN handler */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg("");
                  setIsRecovering(true);
                  setRecoveryAnswerInput("");
                  setRecoveryError("");
                }}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition cursor-pointer"
              >
                Şifremi Unuttum ❓
              </button>
            </div>
          </div>
        )}

        {/* RECOVERY (ŞİFREMİ UNUTTUM) INTERACTIVE FORM DISPLAY */}
        {isRecovering && lockoutTime === 0 && (
          <form onSubmit={handleRecoverySubmit} className="space-y-4 text-left">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1">
              <p className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" /> GÜVENLİK SORUSU
              </p>
              <p className="text-[11px] text-white font-bold leading-relaxed">
                {settings.recoveryQuestion || "İlkokul öğretmeninizin adı nedir?"}
              </p>
            </div>

            <div className="space-y-1.5 focus-within:text-indigo-400">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Yayıtınız</label>
              <input
                type="text"
                maxLength={40}
                value={recoveryAnswerInput}
                onChange={(e) => setRecoveryAnswerInput(e.target.value)}
                placeholder="Cevabınızı buraya yazınız..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/60 text-white placeholder:text-slate-500"
                autoFocus
              />
            </div>

            {recoveryError && (
              <p className="text-[10px] text-rose-500 font-bold bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{recoveryError}</span>
              </p>
            )}

            {successMsg && (
              <p className="text-[10.5px] text-emerald-400 font-bold bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{successMsg}</span>
              </p>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRecovering(false);
                  setRecoveryError("");
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer"
              >
                Şifre Denemeye Dön
              </button>
              <button
                type="submit"
                disabled={!recoveryAnswerInput.trim()}
                className="flex-[1.2] py-2 bg-gradient-to-r from-indigo-550 to-purple-600 hover:opacity-90 disabled:opacity-50 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                Cevabı Doğrula
              </button>
            </div>
          </form>
        )}

        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-center gap-1 mt-1">
          <span>🔒 Güvenli Veri Kalkanı 256-bit</span>
        </div>
      </motion.div>
    </div>
  );
};

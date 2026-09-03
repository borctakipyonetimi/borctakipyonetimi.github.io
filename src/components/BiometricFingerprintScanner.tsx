/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Zap,
  Sparkles,
  Key
} from "lucide-react";

interface BiometricFingerprintScannerProps {
  mode: "unlock" | "enroll" | "test";
  onSuccess: () => void;
  onCancel?: () => void;
  autoStart?: boolean;
}

export const BiometricFingerprintScanner: React.FC<BiometricFingerprintScannerProps> = ({
  mode,
  onSuccess,
  onCancel,
  autoStart = true,
}) => {
  const [scanState, setScanState] = useState<"idle" | "scanning" | "matched" | "success">("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Parmak izinizi okuyucuya dokundurun");
  const [isHolding, setIsHolding] = useState(false);
  const [hasHardwareBiometrics, setHasHardwareBiometrics] = useState<boolean | null>(null);

  const scanIntervalRef = useRef<any>(null);
  const holdTimeoutRef = useRef<any>(null);

  // Audio synthesis feedback
  const playSound = (type: "scan" | "success") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "scan") {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
      } else if (type === "success") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.36);
      }
    } catch {
      // Audio context restricted or unavailable
    }
  };

  useEffect(() => {
    // Check if device supports platform authenticator (Touch ID, Windows Hello, Fingerprint)
    if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setHasHardwareBiometrics(available))
        .catch(() => setHasHardwareBiometrics(false));
    }

    if (autoStart) {
      triggerScanSequence();
    }

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    };
  }, []);

  const triggerScanSequence = () => {
    if (scanState === "success") return;

    setScanState("scanning");
    setStatusText("Parmak izi taranıyor...");
    setProgress(0);
    playSound("scan");

    let current = 0;
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(() => {
      current += 8;
      setProgress((prev) => Math.min(current, 100));

      if (current === 40) {
        setStatusText("Biyometrik desen analiz ediliyor...");
        playSound("scan");
      } else if (current === 75) {
        setStatusText("Biyometrik imza eşleştiriliyor...");
      } else if (current >= 100) {
        clearInterval(scanIntervalRef.current);
        setProgress(100);
        setScanState("success");
        playSound("success");

        if (mode === "enroll") {
          localStorage.setItem("biometric_enrolled_date", new Date().toISOString());
        }

        setStatusText(
          mode === "enroll"
            ? "Parmak İzi Başarıyla Kaydedildi! ✅"
            : "Parmak İzi Doğrulandı! Kilit Açılıyor... 🔓"
        );

        setTimeout(() => {
          onSuccess();
        }, 900);
      }
    }, 60);
  };

  const handleTouchOrMouseDown = () => {
    setIsHolding(true);
    triggerScanSequence();
  };

  const handleTouchOrMouseUp = () => {
    setIsHolding(false);
  };

  return (
    <div className="w-full max-w-xs mx-auto flex flex-col items-center justify-center text-center space-y-4 select-none">
      {/* SCANNER CIRCLE CONTAINER */}
      <div className="relative flex items-center justify-center p-3">
        {/* Pulsing Outer Rings */}
        <AnimatePresence>
          {scanState === "scanning" && (
            <>
              <motion.div
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute w-36 h-36 rounded-full bg-indigo-500/20 border border-indigo-500/40 pointer-events-none"
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 1.9, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                className="absolute w-36 h-36 rounded-full bg-cyan-500/20 border border-cyan-500/30 pointer-events-none"
              />
            </>
          )}
        </AnimatePresence>

        {/* Circular Progress SVG */}
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background track */}
            <circle
              cx="50"
              cy="50"
              r="44"
              className="text-slate-800 stroke-current"
              strokeWidth="4"
              fill="none"
            />
            {/* Active progress */}
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              className={`${
                scanState === "success" ? "text-emerald-400" : "text-indigo-500"
              } stroke-current transition-colors duration-300`}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="276.46"
              strokeDashoffset={276.46 - (276.46 * progress) / 100}
            />
          </svg>

          {/* Interactive Fingerprint Button */}
          <motion.button
            type="button"
            onMouseDown={handleTouchOrMouseDown}
            onMouseUp={handleTouchOrMouseUp}
            onTouchStart={handleTouchOrMouseDown}
            onTouchEnd={handleTouchOrMouseUp}
            onClick={triggerScanSequence}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            className={`absolute inset-3 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl border ${
              scanState === "success"
                ? "bg-gradient-to-tr from-emerald-950 to-emerald-900 border-emerald-500/60 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                : scanState === "scanning"
                ? "bg-gradient-to-tr from-indigo-950 via-slate-900 to-purple-950 border-indigo-500/60 text-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.35)]"
                : "bg-slate-900/90 border-slate-700/60 text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300"
            }`}
          >
            {/* Animated Laser Scanning Line inside button */}
            {scanState === "scanning" && (
              <motion.div
                animate={{ y: [-35, 35, -35] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute w-20 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_rgba(34,211,238,0.8)] pointer-events-none"
              />
            )}

            {scanState === "success" ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center justify-center"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
              </motion.div>
            ) : (
              <div className="relative flex flex-col items-center justify-center">
                <Fingerprint
                  className={`w-14 h-14 sm:w-16 sm:h-16 transition-all duration-300 ${
                    scanState === "scanning"
                      ? "text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]"
                      : "text-slate-400"
                  }`}
                />
              </div>
            )}
          </motion.button>
        </div>
      </div>

      {/* STATUS & FEEDBACK TEXT */}
      <div className="space-y-1 px-3">
        <p
          className={`text-xs font-black transition-colors ${
            scanState === "success"
              ? "text-emerald-400"
              : scanState === "scanning"
              ? "text-indigo-300"
              : "text-slate-200"
          }`}
        >
          {statusText}
        </p>
        <p className="text-[10px] text-slate-400 font-medium">
          {scanState === "success"
            ? "Giriş izni onaylandı"
            : "Okuyucuya dokunarak veya tıklayarak taramayı başlatın"}
        </p>
      </div>

      {/* CONTROLS */}
      <div className="flex items-center justify-center gap-2 pt-1 w-full">
        {scanState !== "success" && (
          <button
            type="button"
            onClick={triggerScanSequence}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition active:scale-95 border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tekrar Tara</span>
          </button>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition border border-indigo-500/30"
          >
            <Key className="w-3.5 h-3.5" />
            <span>PIN ile Aç</span>
          </button>
        )}
      </div>
    </div>
  );
};

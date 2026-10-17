import React from "react";
import { motion } from "motion/react";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  UserCheck,
  UserPlus,
  Sparkles
} from "lucide-react";
import appLogo from "../assets/logo.png";

export interface WelcomeScreenProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onGuestContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onLoginClick,
  onRegisterClick,
  onGuestContinue
}) => {
  return (
    <div
      id="welcome-screen-root"
      className="fixed inset-0 z-[999990] flex flex-col items-center justify-center bg-[#050814] text-white select-none px-4 sm:px-6 overflow-y-auto font-sans"
    >
      {/* Background Neon Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-cyan-500/15 rounded-full blur-[130px]" />
        <div className="absolute -bottom-20 left-1/4 w-[32rem] h-[32rem] bg-emerald-600/15 rounded-full blur-[140px]" />
      </div>

      {/* Card Container */}
      <div className="relative z-10 w-full max-w-md mx-auto bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-300 text-[11px] font-black uppercase tracking-wider shadow-lg">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 1200 800" className="w-4 h-2.5 rounded-xs overflow-hidden inline-block shadow-xs">
              <rect width="1200" height="800" fill="#e30a17"/>
              <circle cx="400" cy="400" r="200" fill="#ffffff"/>
              <circle cx="450" cy="400" r="160" fill="#e30a17"/>
              <polygon points="585,400 643.78,419.1 607.45,369.1 607.45,430.9 643.78,380.9" fill="#ffffff" transform="rotate(-30 585 400)"/>
            </svg>
            <span>TÜRKİYE FİNANS SİSTEMİ</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-indigo-400/50" />
          <span className="text-amber-400 font-extrabold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> PRO 2026
          </span>
        </div>

        {/* Logo */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-3xl blur-xl opacity-60 animate-pulse" />
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="relative w-full h-full rounded-3xl p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-2xl flex items-center justify-center border border-white/20"
          >
            <div className="w-full h-full bg-slate-950 rounded-[20px] p-2.5 flex items-center justify-center overflow-hidden">
              <img
                src={appLogo}
                alt="Bütçem Pro"
                className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]"
              />
            </div>
          </motion.div>
        </div>

        {/* Title & Short Intro Text */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            BÜTÇEM PRO
          </h1>
          <p className="text-sm sm:text-base font-extrabold bg-gradient-to-r from-indigo-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            Bütçeni Yönet, Geleceğini Güçlendir!
          </p>
          <p className="text-xs text-slate-300 font-normal leading-relaxed px-2">
            Borçlarınızı ve taksitlerinizi profesyonelce yönetmek, nakit akışınızı kontrol altına almak için e-posta adresinizle giriş yapın veya kayıt olun.
          </p>
        </div>

        {/* Security Badge */}
        <div className="pt-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>256-Bit SSL ile Güvenli Oturum</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Giriş Yap */}
          <button
            type="button"
            id="btn-welcome-login"
            onClick={onLoginClick}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-600 active:scale-[0.98] text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-indigo-200" />
            <span>E-posta ile Giriş Yap</span>
          </button>

          {/* Kayıt Ol */}
          <button
            type="button"
            id="btn-welcome-register"
            onClick={onRegisterClick}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 active:scale-[0.98] text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/30 border border-emerald-300/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-slate-950" />
            <span>Yeni Hesap / Kayıt Ol</span>
          </button>

          {/* Misafir Olarak Devam Et */}
          <div className="pt-1">
            <button
              type="button"
              id="btn-welcome-guest"
              onClick={onGuestContinue}
              className="group inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-bold transition-colors cursor-pointer py-1"
            >
              <span>Misafir Olarak Devam Et</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 leading-tight">
          * Uygulamayı her açtığınızda güvenliğiniz için giriş ekranı görüntülenir.
        </div>

      </div>
    </div>
  );
};

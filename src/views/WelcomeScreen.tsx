import React from "react";
import { motion } from "motion/react";
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
  UserPlus
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
      className="fixed inset-0 z-[999990] flex flex-col bg-[#050814] text-white select-none overflow-y-auto overflow-x-hidden font-sans"
    >
      {/* Dynamic Ambient Neon Lighting in Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: "strict" }}>
        <div className="absolute -top-32 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-cyan-500/15 rounded-full blur-[130px]" />
        <div className="absolute -bottom-20 left-1/4 w-[32rem] h-[32rem] bg-emerald-600/15 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,8,20,0.8)_100%)]" />
      </div>

      {/* Main Scrollable Content Container */}
      <div className="relative z-10 flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 pt-5 pb-32">
        {/* ======================================================== */}
        {/* ÜST KISIM: LOGO, BAŞLIK & SLOGAN                         */}
        {/* ======================================================== */}
        <header className="flex flex-col items-center text-center space-y-3 pt-2 sm:pt-4">
          {/* Top Badges (Turkey Flag + 2026 Edition) */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-300 text-[11px] font-black uppercase tracking-wider shadow-lg shadow-indigo-950/40 backdrop-blur-md">
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
        {/* ORTA KISIM: 3D NEON MOCKUP KARTI                         */}
        {/* ======================================================== */}
        <section className="mt-5 w-full">
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
        <section className="mt-5 space-y-2.5">
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
        <div className="mt-4 p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Verileriniz telefonunuzda ve bulutta 256-Bit SSL ile korunur; 3. şahıslarla asla paylaşılmaz.</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ALT KISIM: SABİTLENMİŞ CANLI EYLEM & GİRİŞ BUTONLARI     */}
      {/* ======================================================== */}
      <footer className="fixed bottom-0 inset-x-0 z-20 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 px-4 sm:px-6 py-3.5 shadow-2xl">
        <div className="max-w-xl mx-auto space-y-2 text-center">
          {/* 2 Ana Buton (Neon Mor / Yeşil Gradyanlı) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Giriş Yap Butonu */}
            <button
              type="button"
              id="btn-welcome-login"
              onClick={onLoginClick}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-600 active:scale-[0.98] text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-indigo-200" />
              <span>Giriş Yap</span>
            </button>

            {/* Kayıt Ol Butonu */}
            <button
              type="button"
              id="btn-welcome-register"
              onClick={onRegisterClick}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 active:scale-[0.98] text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/30 border border-emerald-300/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-slate-950" />
              <span>Kayıt Ol</span>
            </button>
          </div>

          {/* İkincil Link: Misafir Olarak Devam Et */}
          <div className="pt-0.5">
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

          <p className="text-[10px] text-slate-500 leading-tight">
            * Hesap açmadan da tüm borç, taksit ve bütçe araçlarını bu cihazda %100 çevrimdışı eksiksiz kullanabilirsiniz.
          </p>
        </div>
      </footer>
    </div>
  );
};

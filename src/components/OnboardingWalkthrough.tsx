/**
 * OnboardingWalkthrough.tsx
 * 2-Sayfalık Egzotik & Canlı Animasyonlu Uygulama Tanıtım ve Açılış Sayfası (Bütçem Pro)
 * 
 * Özellikler:
 * - 2 Sayfaya indirilmiş süper kompakt, akıcı ve egzotik lüks tasarım
 * - 1. Sayfa: Finansal Özgürlük, Gelir-Gider Dengesi, Kartopu/Çığ Borç Stratejileri, Taksitler ve Yapay Zeka Fiş Tarama
 * - 2. Sayfa: Google/Firebase Bulut Güvencesi, 256-Bit Şifreleme, E-Posta ile Giriş & "Giriş Yapmadan Doğrudan Başla"
 * - Egzotik canlı neon ışık auraları, yüzen finans parçacıkları (₺, $, €, ✦, ⚡), laser tarayıcı ve radar animasyonları
 * - Tamamlandığında Bütçem Pro'nun 4 kadranlı ikonik açılış splash ekranına kesintisiz geçiş
 */

import React, { useState } from "react";
import { motion, AnimatePresence, Variants } from "motion/react";
import {
  Wallet,
  CreditCard,
  Sparkles,
  Camera,
  Cloud,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
  Lock,
  Mail,
  Award,
  BarChart3,
  Bot
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../utils/firebase";
import { ProviderLoginModal } from "./ProviderLoginModal";

interface OnboardingWalkthroughProps {
  onComplete: () => void;
  language?: "tr" | "en";
  isPremium?: boolean;
  onOpenUpgradeModal?: () => void;
  onDirectLoginClick?: () => void;
}

interface SlideItem {
  id: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  features: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    tag?: string;
  }[];
  mockup: React.ReactNode;
}

export const OnboardingWalkthrough: React.FC<OnboardingWalkthroughProps> = ({
  onComplete,
  language = "tr",
  isPremium = false,
  onOpenUpgradeModal,
  onDirectLoginClick
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [isDismissed, setIsDismissed] = useState(false);

  // Kullanıcı isteği doğrultusunda 2 sayfaya düşürüldü
  const totalSlides = 2;

  // Slide 2 Auth States
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [showEmailLoginModal, setShowEmailLoginModal] = useState(false);

  const handleEmailLoginClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const container = document.getElementById("onboarding-walkthrough-container");
    if (container) {
      container.style.display = "none";
    }
    setIsDismissed(true);

    try {
      localStorage.setItem("butcem_onboarding_welcome_v7", "true");
      localStorage.setItem("butcem_onboarding_completed_v7", "true");
    } catch (err) {
      console.warn("Storage write error:", err);
    }

    if (onDirectLoginClick) {
      onDirectLoginClick();
    } else {
      onComplete();
      if (!isPremium && onOpenUpgradeModal) {
        onOpenUpgradeModal();
      }
    }
  };

  const handleContinueWithoutLogin = () => {
    onComplete();
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAuthSuccess("");
      setAuthError("");
    } catch (e) {
      console.error("Sign out error:", e);
    }
  };

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setDirection(1);
      setCurrentSlide((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleGoToSlide = (index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  };

  // 2 Ultra-Zengin, Canlı & Egzotik Tanıtım Sayfası
  const slides: SlideItem[] = [
    // -------------------------------------------------------------
    // 1. SAYFA: FİNANSAL ÖZGÜRLÜK, BÜTÇE, BORÇLAR & YAPAY ZEKA FİŞ TARAMA
    // -------------------------------------------------------------
    {
      id: 0,
      badge: "✨ 1. ADIM • FİNANSAL ÖZGÜRLÜK & AKILLI TAKİP",
      badgeColor: "bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 text-indigo-300 border-indigo-500/40",
      title: "Bütçenizi Yönetin, Geleceğinizi Güvenceye Alın!",
      subtitle: "Gelir-gider dengesi, akıllı borç kapatma stratejileri (Kartopu & Çığ), taksit planları ve kamera ile anında yapay zeka fiş okuma tek ekranda.",
      features: [
        {
          icon: <Wallet className="w-4 h-4 text-emerald-400" />,
          title: "Bilinçli Nakit Akışı",
          desc: "Tüm gelir, gider ve birikimlerinizi tek merkezden anlık izleyin; paranızın nereye gittiğini tam olarak görün.",
          tag: "Net Bütçe"
        },
        {
          icon: <CreditCard className="w-4 h-4 text-rose-400" />,
          title: "Kartopu & Çığ ile Borç Sıfırlama",
          desc: "Kredi kartı ve taksitlerinizi matematiksel stratejilerle en az faiz ve en hızlı sürede tamamen sıfırlayın.",
          tag: "Borçsuz Yaşam"
        },
        {
          icon: <Camera className="w-4 h-4 text-amber-400" />,
          title: "AI Kamera ile Anında Fiş Okuma",
          desc: "Alışveriş fişinizin fotoğrafını çekin; yapay zeka tutarı, tarihi ve kategoriyi saniyeler içinde otomatik işlesin.",
          tag: "Yapay Zeka"
        },
        {
          icon: <Award className="w-4 h-4 text-cyan-400" />,
          title: "Bütçem PRO VIP Ayrıcalıkları",
          desc: "%100 sıfır reklam, sınırsız yapay zeka asistanı, 12 aylık kurumsal PDF raporları ve VIP araçlarla kesintisiz hız.",
          tag: "Sıfır Reklam 👑"
        }
      ],
      mockup: (
        <div className="space-y-3 relative">
          {/* Egzotik Canlı Finans Gösterge Paneli */}
          <div className="p-4 bg-gradient-to-br from-slate-900/95 via-indigo-950/70 to-slate-950/95 border-2 border-indigo-500/40 rounded-3xl shadow-2xl space-y-3 relative overflow-hidden backdrop-blur-xl">
            {/* Arka plan hareketli ışık parıltısı */}
            <motion.div
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.25, 0.55, 0.25],
                rotate: [0, 90, 0]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-full blur-2xl pointer-events-none"
            />
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.2, 0.45, 0.2]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/25 rounded-full blur-2xl pointer-events-none"
            />

            {/* Radar / Pusula Skor Başlığı */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/30"
                >
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-sm font-black text-white">
                    🧭
                  </div>
                </motion.div>
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>Finansal Özgürlük Radarı</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  </h4>
                  <p className="text-[10px] text-indigo-200/80 font-medium">Bütçe & Birikim Sağlık Endeksi</p>
                </div>
              </div>
              <motion.span
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-xs"
              >
                Skor: %94 (Mükemmel)
              </motion.span>
            </div>

            {/* Canlı 3 Temel Finansal Sütun */}
            <div className="space-y-2 relative z-10 pt-1">
              <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-white block">Net Gelir-Gider Dengesi</span>
                    <span className="text-[9.5px] text-slate-400">₺18.500 Net Aylık Tasarruf Fazlası</span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-emerald-400 font-mono">+%38 Tasarruf</span>
              </div>

              {/* Taksit / Kredi Segmentli Canlı İlerleme Çubuğu */}
              <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-white/10 space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-300 flex items-center gap-1">
                    <span>💳 İhtiyaç Kredisi & Taksitler</span>
                  </span>
                  <span className="text-amber-300 font-mono">5 / 12 Ödendi</span>
                </div>
                <div className="grid grid-cols-12 gap-1 h-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-emerald-400 rounded-xs shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                      title="Ödendi"
                    />
                  ))}
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="bg-indigo-400 rounded-xs shadow-[0_0_8px_rgba(129,140,248,0.8)]"
                    title="Bu Ayki Taksit"
                  />
                  {[7, 8, 9, 10, 11, 12].map((i) => (
                    <div key={i} className="bg-slate-800 rounded-xs" />
                  ))}
                </div>
              </div>

              {/* Yapay Zeka Laser Fiş Tarama Canlı Kartı */}
              <div className="p-2.5 bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-slate-950/80 border border-amber-500/30 rounded-2xl flex items-center justify-between relative overflow-hidden">
                {/* Lazer Tarama Çizgisi Animasyonu */}
                <motion.div
                  animate={{ y: [-15, 30, -15] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400 to-transparent pointer-events-none shadow-[0_0_12px_#fbbf24]"
                />
                <div className="flex items-center gap-2 relative z-10">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs shadow-inner">
                    📷
                  </div>
                  <div>
                    <span className="text-[10.5px] font-black text-white block">AI Akıllı Fiş Tarama</span>
                    <span className="text-[9.5px] text-slate-300 font-mono">Market Fişi: ₺524,90 okundu</span>
                  </div>
                </div>
                <span className="text-[9.5px] font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full relative z-10">
                  Otomatik Eklendi ✓
                </span>
              </div>
            </div>

            {/* Alt Metrik İstatistikleri */}
            <div className="grid grid-cols-2 gap-2 pt-0.5 relative z-10">
              <div className="p-2 bg-slate-950/70 rounded-xl border border-white/5 text-center">
                <span className="text-[9px] text-slate-400 block font-medium">Borç Kapatma Hızı</span>
                <span className="text-xs font-black text-emerald-400 font-mono">2.4x Hızlı (Kartopu)</span>
              </div>
              <div className="p-2 bg-slate-950/70 rounded-xl border border-white/5 text-center">
                <span className="text-[9px] text-slate-400 block font-medium">12 Aylık Yıllık PDF</span>
                <span className="text-xs font-black text-cyan-300 font-mono">Tek Tuşla Hazır 📄</span>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // -------------------------------------------------------------
    // 2. SAYFA: BULUT GÜVENCESİ, 256-BİT GÜVENLİK & UYGULAMAYA BAŞLA
    // -------------------------------------------------------------
    {
      id: 1,
      badge: "🚀 2. ADIM • GÜVENLİ BULUT & UYGULAMAYA BAŞLA",
      badgeColor: "bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-300 border-emerald-500/40",
      title: "Hesabınızı Bağlayın veya Doğrudan Başlayın",
      subtitle: "Verilerinizin Google Cloud güvencesinde saklanması ve tüm cihazlarınızdan anlık erişebilmeniz için hesabınızı bağlayabilir veya hiçbir hesap açmadan anında çevrimdışı kullanmaya başlayabilirsiniz.",
      features: [
        {
          icon: <Cloud className="w-4 h-4 text-sky-400" />,
          title: "Firebase Firestore Bulut Güvencesi",
          desc: "256-Bit SSL şifrelemeyle tüm verileriniz bulutta yedeklenir, telefon ve bilgisayar arasında anlık eşitlenir.",
          tag: "Bulut Yedekleme"
        },
        {
          icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
          title: "%100 Çevrimdışı & Yerel Çalışma",
          desc: "Hesap açmasanız veya internetiniz olmasa bile tüm bütçe, borç ve raporlama araçları cihazınızda tam aktiftir.",
          tag: "Çevrimdışı Özgürlük"
        },
        {
          icon: <BarChart3 className="w-4 h-4 text-amber-400" />,
          title: "Tek Tuşla 12 Aylık PDF & Excel",
          desc: "Tüm finansal hareketlerinizi resmi kurumsal PDF dökümü veya Excel (CSV) olarak dilediğiniz an indirin.",
          tag: "Raporlama"
        },
        {
          icon: <Zap className="w-4 h-4 text-purple-400" />,
          title: "Esnek & Güvenli Mimari",
          desc: "İstediğiniz an Ayarlar menüsünden Google hesabınızı bağlayabilir veya yedeklerinizi dışa aktarabilirsiniz.",
          tag: "Tam Kontrol"
        }
      ],
      mockup: null
    }
  ];

  const current = slides[currentSlide];

  // Donanım hızlandırmalı egzotik ve akıcı slayt geçişi
  const slideVariants: Variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
      scale: 0.98
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.28,
        ease: [0.16, 1, 0.3, 1]
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
      scale: 0.98,
      transition: {
        duration: 0.18,
        ease: [0.16, 1, 0.3, 1]
      }
    })
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      id="onboarding-walkthrough-container"
      style={isDismissed ? { display: "none" } : undefined}
      className="fixed inset-0 z-[999990] flex flex-col bg-[#050814] text-white select-none overflow-hidden font-sans"
    >
      {/* Egzotik Çok Katmanlı Neon Parıltı & Parçacık Arka Planı */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: "strict" }}>
        {/* Canlı Yüzen Finans Glifleri & Parçacıkları */}
        {[
          { left: "8%", top: "18%", symbol: "₺", color: "text-indigo-400/25", duration: 18, delay: 0 },
          { left: "88%", top: "14%", symbol: "✦", color: "text-amber-400/30", duration: 14, delay: 1 },
          { left: "82%", top: "75%", symbol: "$", color: "text-emerald-400/25", duration: 22, delay: 2 },
          { left: "14%", top: "68%", symbol: "⚡", color: "text-cyan-400/30", duration: 16, delay: 0.5 },
          { left: "52%", top: "82%", symbol: "€", color: "text-purple-400/25", duration: 20, delay: 1.5 },
          { left: "48%", top: "8%", symbol: "★", color: "text-amber-300/30", duration: 15, delay: 3 }
        ].map((item, idx) => (
          <motion.div
            key={idx}
            animate={{
              y: [0, -18, 0],
              x: [0, 8, 0],
              opacity: [0.2, 0.6, 0.2],
              rotate: [0, 15, -15, 0]
            }}
            transition={{
              duration: item.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: item.delay
            }}
            className={`absolute font-black font-mono text-2xl sm:text-3xl ${item.color} select-none`}
            style={{ left: item.left, top: item.top }}
          >
            {item.symbol}
          </motion.div>
        ))}

        {/* Egzotik Parlayan Renk Küreleri */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-indigo-600/35 to-purple-600/35 rounded-full blur-[110px]"
        />
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-1/2 -right-32 w-96 h-96 bg-gradient-to-br from-cyan-500/25 to-emerald-500/25 rounded-full blur-[110px]"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.28, 0.15] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute -bottom-32 left-1/3 w-96 h-96 bg-gradient-to-tr from-amber-500/20 to-purple-600/25 rounded-full blur-[110px]"
        />
      </div>

      {/* Üst Başlık Barı (Logo, Sürüm ve Sayfa İndikatörü) */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/30"
          >
            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center font-black text-xs text-white">
              BP
            </div>
          </motion.div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-wider text-white">BÜTÇEM PRO</span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs">
                PRO 2026
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Finansal Özgürlük ve Bütçe Rehberi</p>
          </div>
        </div>

        {/* Sağ Taraf: 2 Sayfalık Sayaç Rozeti ve Hızlı Geçiş */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentSlide === 0 ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Tanıtım (1 / 2)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 shadow-xs">
              <Cloud className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Giriş & Başla (2 / 2)</span>
            </div>
          )}
          <button
            type="button"
            onClick={onComplete}
            title="Tanıtımı Atla ve Doğrudan Başla"
            className="text-[11px] font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer"
          >
            Atla ✕
          </button>
        </div>
      </header>

      {/* Ana Egzotik Slayt İçerik Alanı */}
      <main className="relative z-10 flex-1 flex flex-col justify-start items-center w-full max-w-5xl mx-auto px-4 sm:px-6 pt-3 sm:pt-6 pb-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ willChange: "transform, opacity" }}
            className="w-full max-w-4xl mx-auto py-1 sm:py-2"
          >
            {currentSlide === 0 ? (
              /* ========================================================= */
              /* 1. SAYFA: FİNANSAL ÖZGÜRLÜK, BÜTÇE, BORÇLAR & FİŞ TARAMA  */
              /* ========================================================= */
              <div className="w-full flex flex-col justify-start items-center space-y-3 sm:space-y-4 max-w-4xl mx-auto pt-1 pb-3 text-center">
                {/* 1. Egzotik Canlı Rozet */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-900 border border-indigo-400/40 text-[#93c5fd] text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-950/60"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  <span>YENİ NESİL KİŞİSEL FİNANS MOTORU</span>
                </motion.div>

                {/* 2. Büyük Başlık ve Karşılama Metni */}
                <div className="text-center space-y-2 sm:space-y-2.5">
                  <motion.h1
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white"
                  >
                    Bütçenizi Yönetin, <br />
                    <span className="bg-gradient-to-r from-[#818cf8] via-[#c084fc] to-[#34d399] bg-clip-text text-transparent drop-shadow-md">
                      Geleceğinizi Güvenceye Alın!
                    </span>
                  </motion.h1>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-bold shadow-sm"
                  >
                    <span>👋</span>
                    <span>Bütçem Pro Finansal Takip Programına Hoş Geldiniz!</span>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="text-xs sm:text-sm md:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed text-center px-2"
                  >
                    Gelir-gider dengenizi hesaplayın, birikim hedefleri oluşturun ve borçlarınızı bilimsel stratejilerle (Kartopu ve Çığ metodları) eritin. Yapay zeka ile alışveriş fişlerinizi anında tarayın!
                  </motion.p>
                </div>

                {/* 3. İki Sütunlu Canlı Sunum (Sol: 4 Temel Güç Kartı | Sağ: Canlı Mockup) */}
                <div className="w-full grid md:grid-cols-12 gap-5 sm:gap-6 items-center pt-2 text-left">
                  {/* Sol Taraf: 4 Güç Kartı */}
                  <div className="md:col-span-6 grid sm:grid-cols-2 gap-2.5">
                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-emerald-500/40 rounded-2xl transition space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white">Gelir-Gider Dengesi</h3>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Nakit akışınızı anlık hesaplayın; paranızın nereye gittiğini tam olarak bilin.
                      </p>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-rose-500/40 rounded-2xl transition space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white">Kartopu & Çığ Metodu</h3>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Kredi ve taksitlerinizi matematiksel stratejilerle en hızlı sürede sıfırlayın.
                      </p>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-amber-500/40 rounded-2xl transition space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Camera className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white">AI ile Fiş Tarama</h3>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Kamera ile tek kare fiş çekin; yapay zeka tutarı ve kalemi otomatik işlesin.
                      </p>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-cyan-500/40 rounded-2xl transition space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                          <Award className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white">Bütçem PRO Gücü</h3>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        %100 reklamsız, sınırsız asistan, 12 aylık PDF dökümü ve VIP araçlar.
                      </p>
                    </motion.div>
                  </div>

                  {/* Sağ Taraf: Egzotik Canlı Önizleme Mockup */}
                  <div className="md:col-span-6 w-full">
                    {current.mockup}
                  </div>
                </div>

                {/* 4. Butonlar (Sonraki Adıma Geç veya Doğrudan Başla) */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => {
                      setDirection(1);
                      setCurrentSlide(1);
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:opacity-95 text-white font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-indigo-600/30 flex items-center gap-2 active:scale-95 transition cursor-pointer"
                  >
                    <span>2. Adıma Geç (Güvenlik & Giriş)</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                  <button
                    type="button"
                    onClick={onComplete}
                    className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm border border-white/15 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Doğrudan Uygulamaya Başla 🚀</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ========================================================= */
              /* 2. SAYFA: BULUT HESABI, GÜVENLİK & UYGULAMAYA BAŞLA       */
              /* ========================================================= */
              <div className="w-full max-w-4xl mx-auto space-y-4 text-center">
                {/* Rozet */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black tracking-wide border shadow-sm uppercase bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>2. ADIM • BULUT HESABI VEYA DOĞRUDAN BAŞLA</span>
                </div>

                {/* Başlık Yazısı */}
                <div className="space-y-1.5 max-w-2xl mx-auto">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                    Hesabınızı Bağlayın veya Doğrudan Başlayın
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                    Verilerinizin bulutta güvende kalması ve tüm cihazlarınızdan erişebilmeniz için Google ile bağlanın. Dilerseniz hiçbir hesap açmadan uygulamayı anında çevrimdışı kullanabilirsiniz.
                  </p>
                </div>

                {/* Egzotik Canlı Giriş / Başlama Kartı */}
                <div className="w-full max-w-2xl mx-auto">
                  <div className="relative bg-gradient-to-b from-slate-900/95 via-indigo-950/80 to-slate-950/95 border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl overflow-hidden space-y-4 text-left">
                    {/* Arka plan hareketli ambient ışık animasyonları */}
                    <motion.div
                      animate={{
                        scale: [1, 1.25, 1],
                        x: [0, 25, 0],
                        y: [0, -20, 0],
                        opacity: [0.35, 0.65, 0.35]
                      }}
                      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none"
                    />
                    <motion.div
                      animate={{
                        scale: [1, 1.3, 1],
                        x: [0, -25, 0],
                        y: [0, 20, 0],
                        opacity: [0.25, 0.55, 0.25]
                      }}
                      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                      className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/25 rounded-full blur-3xl pointer-events-none"
                    />

                    {auth.currentUser ? (
                      <div className="space-y-4 text-center py-4 relative z-10">
                        <motion.div
                          animate={{ scale: [1, 1.08, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto text-xl shadow-lg shadow-emerald-500/20"
                        >
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                        </motion.div>
                        <div>
                          <h3 className="text-lg font-black text-white">Hesabınız Doğrulandı!</h3>
                          <p className="text-xs text-emerald-400 font-medium font-mono mt-1">
                            {auth.currentUser.email || auth.currentUser.uid}
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={onComplete}
                          className="w-full max-w-sm mx-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:opacity-95 text-white text-xs sm:text-sm font-black transition shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                          <span>Uygulamaya Giriş Yap 🚀</span>
                        </motion.button>
                        <div>
                          <button
                            type="button"
                            onClick={handleSignOut}
                            className="text-[11px] text-slate-400 hover:text-rose-400 transition underline cursor-pointer"
                          >
                            Farklı bir hesapla giriş yap
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5 relative z-10">
                        {/* Kart Üst Barı */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                          <div className="flex items-center gap-2.5">
                            <motion.div
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30"
                            >
                              <Lock className="w-4 h-4" />
                            </motion.div>
                            <div>
                              <h3 className="text-xs sm:text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                                <span>Google & Gmail Bulut Girişi</span>
                              </h3>
                              <p className="text-[10.5px] text-slate-400">Otomatik yedekleme ve tüm cihazlarda anlık eşitleme</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>256-Bit SSL</span>
                          </span>
                        </div>

                        {/* FIREBASE E-POSTA GİRİŞ & KAYIT KARTI */}
                        <div className="relative group">
                          <motion.div
                            animate={{
                              scale: [1, 1.02, 1],
                              opacity: [0.45, 0.75, 0.45]
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 rounded-3xl blur-md pointer-events-none"
                          />

                          <motion.button
                            type="button"
                            id="onboarding-email-login-button"
                            disabled={authLoading}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleEmailLoginClick}
                            className="relative w-full p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400/60 hover:border-amber-300 active:scale-[0.98] text-white font-black shadow-2xl transition-all duration-200 flex items-center justify-between cursor-pointer disabled:opacity-50 overflow-hidden text-left"
                          >
                            <motion.div
                              animate={{ x: ["-120%", "240%"] }}
                              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                              className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-amber-300/15 to-transparent skew-x-12 pointer-events-none"
                            />

                            <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
                              <motion.div
                                animate={{
                                  y: [0, -2, 0],
                                  rotate: [0, 3, -3, 0]
                                }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/30 border border-amber-400/50 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 text-amber-300"
                              >
                                <Mail className="w-6 h-6 sm:w-7 h-7 text-amber-300 drop-shadow" />
                              </motion.div>

                              <div>
                                <div className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                                  <span>E-Posta / Google ile Giriş Yap & Kayıt Ol</span>
                                </div>
                                <p className="text-xs text-amber-200/90 font-medium mt-0.5">
                                  👑 Sadece Premium üyelere özel bulut eşitleme ve yedekleme
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 relative z-10 shrink-0">
                              <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md flex items-center gap-1">
                                <span>👑</span> PREMİUM
                              </span>
                              <motion.div
                                animate={{ x: [0, 4, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <ArrowRight className="w-4 h-4 text-amber-300" />
                              </motion.div>
                            </div>
                          </motion.button>
                        </div>

                        {/* Hata & Başarı Bildirimleri */}
                        {authError && (
                          <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2 text-[11px] text-rose-300">
                            <span>{authError}</span>
                          </div>
                        )}

                        {authSuccess && (
                          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-[11px] text-emerald-300">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                            <span>{authSuccess}</span>
                          </div>
                        )}

                        {/* Ayırıcı */}
                        <div className="relative flex items-center justify-center my-2">
                          <div className="border-t border-white/10 w-full" />
                          <span className="bg-slate-900 px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                            VEYA HESAP AÇMADAN DOĞRUDAN BAŞLA
                          </span>
                          <div className="border-t border-white/10 w-full" />
                        </div>

                        {/* GİRİŞ YAPMADAN DEVAM ET GÖSTERİŞLİ BUTONU */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={handleContinueWithoutLogin}
                          className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500/25 via-indigo-500/25 to-teal-500/25 hover:from-emerald-500/35 hover:to-teal-500/35 active:scale-[0.98] border-2 border-emerald-400/50 hover:border-emerald-300 text-white font-black text-xs sm:text-sm transition-all duration-200 shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2.5 cursor-pointer group"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform animate-pulse" />
                          <span className="tracking-wide">Giriş Yapmadan Doğrudan Başla</span>
                          <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1.5 transition-transform" />
                        </motion.button>
                        <p className="text-[10.5px] text-center text-slate-400">
                          * Hesap açmadan da tüm borç, taksit, gelir, gider ve grafik araçlarını bu cihazda %100 çevrimdışı eksiksiz kullanabilirsiniz.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3 Güven & Mimari Sütun Kartı */}
                <div className="grid sm:grid-cols-3 gap-3 pt-2 text-left">
                  <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex items-start gap-2.5">
                    <div className="p-1.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0 mt-0.5">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Google & Cloud Güvencesi</h4>
                      <p className="text-[10.5px] text-slate-400 leading-snug">
                        256-Bit SSL şifreleme ve anında otomatik bulut yedekleme.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex items-start gap-2.5">
                    <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Çevrimdışı Tam Erişim</h4>
                      <p className="text-[10.5px] text-slate-400 leading-snug">
                        İnternet veya hesap olmadan da tüm özellikleri özgürce kullanın.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex items-start gap-2.5">
                    <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Dilediğiniz An Bağlama</h4>
                      <p className="text-[10.5px] text-slate-400 leading-snug">
                        Sol menü veya Ayarlar'dan dilediğiniz an hesabınızı eşleştirebilirsiniz.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Alt Kontrol ve Navigasyon Çubuğu */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 border-t border-white/10 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/80 backdrop-blur-md">
        {/* Sol: Geri Butonu */}
        <div className="w-full sm:w-auto flex justify-between sm:justify-start items-center gap-2">
          {currentSlide > 0 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-white/10 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Geri (1. Adım)</span>
            </button>
          ) : (
            <div className="w-20" />
          )}

          {/* Mobil İndikatörler */}
          <div className="flex sm:hidden items-center gap-2">
            {[0, 1].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleGoToSlide(idx)}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  idx === currentSlide
                    ? idx === 0
                      ? "w-8 h-2 bg-gradient-to-r from-amber-400 to-indigo-500 shadow-md shadow-amber-400/50"
                      : "w-8 h-2 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-md shadow-emerald-400/50"
                    : "w-2.5 h-2 bg-slate-700 hover:bg-slate-600"
                }`}
                title={`Sayfa ${idx + 1} / 2`}
              />
            ))}
          </div>
        </div>

        {/* Masaüstü 2 Sayfalık Kapsül İndikatörler */}
        <div className="hidden sm:flex items-center gap-3">
          {[0, 1].map((idx) => {
            const isActive = idx === currentSlide;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleGoToSlide(idx)}
                className={`transition-all duration-300 rounded-full cursor-pointer flex items-center justify-center ${
                  isActive
                    ? idx === 0
                      ? "w-10 h-3 bg-gradient-to-r from-amber-400 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/50"
                      : "w-10 h-3 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 shadow-lg shadow-emerald-500/50"
                    : "w-3 h-3 bg-slate-800 hover:bg-slate-700 border border-white/10"
                }`}
                title={idx === 0 ? "1. Adım: Finansal Özgürlük & Bütçe" : "2. Adım: Bulut Hesabı & Başla"}
              />
            );
          })}
        </div>

        {/* Sağ: İleri / Tamamla Butonu */}
        <div className="w-full sm:w-auto">
          {currentSlide === 0 ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleNext}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:brightness-110 text-white text-xs sm:text-sm font-black transition-all duration-200 shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>Devam Et (2. Adım)</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={handleContinueWithoutLogin}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:brightness-110 text-white text-xs sm:text-sm font-black transition-all duration-300 shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Uygulamaya Başla</span>
              <span className="text-base">🚀</span>
            </motion.button>
          )}
        </div>
      </footer>

      {/* Uygulama İçi E-Posta / Şifre Giriş & Kayıt Modalı */}
      <ProviderLoginModal
        isOpen={showEmailLoginModal}
        provider="google"
        isPremium={isPremium}
        onOpenUpgradeModal={onOpenUpgradeModal}
        onClose={() => setShowEmailLoginModal(false)}
        onLoginSuccess={(email, meta) => {
          localStorage.setItem("currentUser", email.trim().toLowerCase());
          if (meta?.isPremium !== undefined) {
            localStorage.setItem("is_premium", meta.isPremium ? "true" : "false");
          }
          setShowEmailLoginModal(false);
          setAuthSuccess(`Giriş yapıldı: ${email} 🎉`);
          setTimeout(() => {
            onComplete();
          }, 600);
        }}
      />
    </div>
  );
};

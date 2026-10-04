/**
 * OnboardingWalkthrough.tsx
 * 2-Sayfalık Yüksek Performanslı, Akıcı ve Stabil Tanıtım Sayfası (Bütçem Pro)
 * 
 * Optimizasyonlar:
 * - GPU kasan ağır blur animasyonları ve sonsuz döngüler temizlendi (0 donma, 0 kasma)
 * - E-posta giriş kartı tamamen SABİT, net ve prestijli hale getirildi (yanıp sönme kaldırıldı)
 * - 2 sayfaya optimize edilmiş ultra-hızlı, akıcı ve stabil gezinme
 * - Hafif statik ambiyans ve donanım hızlandırmalı pürüzsüz geçişler
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
  BarChart3
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

  // 2 sayfaya indirilmiş kompakt & ultra-akıcı akış
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

  // 2 Ultra-Zengin, Optimize Edilmiş ve Akıcı Sayfa
  const slides: SlideItem[] = [
    // -------------------------------------------------------------
    // 1. SAYFA: FİNANSAL ÖZGÜRLÜK, BÜTÇE, BORÇLAR & FİŞ TARAMA
    // -------------------------------------------------------------
    {
      id: 0,
      badge: "✨ 1. ADIM • FİNANSAL ÖZGÜRLÜK & AKILLI TAKİP",
      badgeColor: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
      title: "Bütçenizi Yönetin, Geleceğinizi Güvenceye Alın!",
      subtitle: "Gelir-gider dengesi, akıllı borç kapatma stratejileri (Kartopu & Çığ), taksit planları ve kamera ile anında yapay zeka fiş okuma tek ekranda.",
      features: [
        {
          icon: <Wallet className="w-4 h-4 text-emerald-400" />,
          title: "Bilinçli Nakit Akışı",
          desc: "Tüm gelir, gider ve birikimlerinizi tek merkezden izleyin; paranızın nereye gittiğini tam olarak görün.",
          tag: "Net Bütçe"
        },
        {
          icon: <CreditCard className="w-4 h-4 text-rose-400" />,
          title: "Kartopu & Çığ ile Borç Sıfırlama",
          desc: "Kredi kartı ve taksitlerinizi matematiksel stratejilerle en az faiz ve en hızlı sürede sıfırlayın.",
          tag: "Borçsuz Yaşam"
        },
        {
          icon: <Camera className="w-4 h-4 text-amber-400" />,
          title: "AI Kamera ile Anında Fiş Okuma",
          desc: "Alışveriş fişinizin fotoğrafını çekin; yapay zeka tutarı, tarihi ve kategoriyi saniyeler içinde işlesin.",
          tag: "Yapay Zeka"
        },
        {
          icon: <Award className="w-4 h-4 text-cyan-400" />,
          title: "Bütçem PRO VIP Ayrıcalıkları",
          desc: "%100 sıfır reklam, sınırsız yapay zeka asistanı, 12 aylık kurumsal PDF raporları ve VIP araçlar.",
          tag: "Sıfır Reklam 👑"
        }
      ],
      mockup: (
        <div className="space-y-3">
          {/* Canlı ve Hafif Finans Gösterge Paneli */}
          <div className="p-4 bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/40 rounded-3xl shadow-xl space-y-3">
            {/* Radar / Pusula Skor Başlığı */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-indigo-600 p-[1.5px] shadow-sm">
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-sm font-black text-white">
                    🧭
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>Finansal Özgürlük Radarı</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  </h4>
                  <p className="text-[10px] text-indigo-200/80 font-medium">Bütçe & Birikim Sağlık Endeksi</p>
                </div>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                Skor: %94 (Mükemmel)
              </span>
            </div>

            {/* Canlı 3 Temel Finansal Sütun */}
            <div className="space-y-2 pt-1">
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

              {/* Taksit / Kredi Segmentli İlerleme Çubuğu */}
              <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-white/10 space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-300 flex items-center gap-1">
                    <span>💳 İhtiyaç Kredisi & Taksitler</span>
                  </span>
                  <span className="text-amber-300 font-mono">5 / 12 Ödendi</span>
                </div>
                <div className="grid grid-cols-12 gap-1 h-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="bg-emerald-400 rounded-xs"
                      title="Ödendi"
                    />
                  ))}
                  <div
                    className="bg-indigo-400 rounded-xs"
                    title="Bu Ayki Taksit"
                  />
                  {[7, 8, 9, 10, 11, 12].map((i) => (
                    <div key={i} className="bg-slate-800 rounded-xs" />
                  ))}
                </div>
              </div>

              {/* Yapay Zeka Fiş Tarama Kartı */}
              <div className="p-2.5 bg-indigo-950/60 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs">
                    📷
                  </div>
                  <div>
                    <span className="text-[10.5px] font-black text-white block">AI Akıllı Fiş Tarama</span>
                    <span className="text-[9.5px] text-slate-300 font-mono">Market Fişi: ₺524,90 okundu</span>
                  </div>
                </div>
                <span className="text-[9.5px] font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Otomatik Eklendi ✓
                </span>
              </div>
            </div>

            {/* Alt Metrik İstatistikleri */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
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
      badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      title: "Hesabınızı Bağlayın veya Doğrudan Başlayın",
      subtitle: "Verilerinizin güvenli bulut altyapısında saklanması ve tüm cihazlarınızdan anlık erişebilmeniz için e-posta ile giriş yapabilir veya kayıt olabilirsiniz. Dilerseniz hiçbir hesap açmadan anında çevrimdışı kullanmaya başlayabilirsiniz.",
      features: [
        {
          icon: <Cloud className="w-4 h-4 text-sky-400" />,
          title: "Güvenli Bulut Altyapısı",
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
          desc: "İstediğiniz an Ayarlar menüsünden e-posta hesabınızla giriş yapabilir veya yedeklerinizi dışa aktarabilirsiniz.",
          tag: "Tam Kontrol"
        }
      ],
      mockup: null
    }
  ];

  const current = slides[currentSlide];

  // Donanım hızlandırmalı ultra-hafif slayt geçişi (0 gecikme)
  const slideVariants: Variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -40 : 40,
      opacity: 0,
      transition: {
        duration: 0.15,
        ease: "easeIn"
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
      className="fixed inset-0 z-[999990] flex flex-col bg-[#050814] text-white select-none overflow-hidden font-sans transform-gpu"
    >
      {/* Hafif, Statik ve Akıcı Arka Plan (GPU kasan sonsuz blur animasyonları kaldırıldı) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: "strict" }}>
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Üst Başlık Barı (Logo, Sürüm ve Sayfa İndikatörü) */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-[1.5px] shadow-sm">
            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center font-black text-xs text-white">
              BP
            </div>
          </div>
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
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Tanıtım (1 / 2)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
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

      {/* Ana Slayt İçerik Alanı */}
      <main className="relative z-10 flex-1 flex flex-col justify-start items-center w-full max-w-5xl mx-auto px-4 sm:px-6 pt-3 sm:pt-6 pb-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-4xl mx-auto py-1 sm:py-2 transform-gpu"
          >
            {currentSlide === 0 ? (
              /* ========================================================= */
              /* 1. SAYFA: FİNANSAL ÖZGÜRLÜK, BÜTÇE, BORÇLAR & FİŞ TARAMA  */
              /* ========================================================= */
              <div className="w-full flex flex-col justify-start items-center space-y-3 sm:space-y-4 max-w-4xl mx-auto pt-1 pb-3 text-center">
                {/* 1. Başlık Rozeti */}
                <div className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-slate-900 border border-indigo-400/40 text-[#93c5fd] text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>YENİ NESİL KİŞİSEL FİNANS MOTORU</span>
                </div>

                {/* 2. Büyük Başlık ve Karşılama Metni */}
                <div className="text-center space-y-2 sm:space-y-2.5">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
                    Bütçenizi Yönetin, <br />
                    <span className="bg-gradient-to-r from-[#818cf8] via-[#c084fc] to-[#34d399] bg-clip-text text-transparent">
                      Geleceğinizi Güvenceye Alın!
                    </span>
                  </h1>

                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-bold">
                    <span>👋</span>
                    <span>Bütçem Pro Finansal Takip Programına Hoş Geldiniz!</span>
                  </div>

                  <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed text-center px-2">
                    Gelir-gider dengenizi hesaplayın, birikim hedefleri oluşturun ve borçlarınızı bilimsel stratejilerle (Kartopu ve Çığ metodları) eritin. Yapay zeka ile alışveriş fişlerinizi anında tarayın!
                  </p>
                </div>

                {/* 3. İki Sütunlu Sunum (Sol: 4 Temel Güç Kartı | Sağ: Canlı Mockup) */}
                <div className="w-full grid md:grid-cols-12 gap-5 sm:gap-6 items-center pt-2 text-left">
                  {/* Sol Taraf: 4 Güç Kartı */}
                  <div className="md:col-span-6 grid sm:grid-cols-2 gap-2.5">
                    <div className="p-3 bg-slate-900/90 border border-white/10 hover:border-emerald-500/40 rounded-2xl transition space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white">Gelir-Gider Dengesi</h3>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Nakit akışınızı anlık hesaplayın; paranızın nereye gittiğini tam olarak bilin.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-900/90 border border-white/10 hover:border-rose-500/40 rounded-2xl transition space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white">Kartopu & Çığ Metodu</h3>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Kredi ve taksitlerinizi matematiksel stratejilerle en hızlı sürede sıfırlayın.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-900/90 border border-white/10 hover:border-amber-500/40 rounded-2xl transition space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Camera className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white">AI ile Fiş Tarama</h3>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Kamera ile tek kare fiş çekin; yapay zeka tutarı ve kalemi otomatik işlesin.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-900/90 border border-white/10 hover:border-cyan-500/40 rounded-2xl transition space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                          <Award className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-white">Bütçem PRO Gücü</h3>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        %100 reklamsız, sınırsız asistan, 12 aylık PDF dökümü ve VIP araçlar.
                      </p>
                    </div>
                  </div>

                  {/* Sağ Taraf: Canlı Önizleme Mockup */}
                  <div className="md:col-span-6 w-full">
                    {current.mockup}
                  </div>
                </div>

                {/* 4. Butonlar (Sonraki Adıma Geç veya Doğrudan Başla) */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(1);
                      setCurrentSlide(1);
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:opacity-95 text-white font-black text-xs sm:text-sm tracking-wide shadow-md flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>2. Adıma Geç (Güvenlik & Giriş)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onComplete}
                    className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm border border-white/15 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
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
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. ADIM • BULUT HESABI VEYA DOĞRUDAN BAŞLA</span>
                </div>

                {/* Başlık Yazısı */}
                <div className="space-y-1.5 max-w-2xl mx-auto">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                    Hesabınızı Bağlayın veya Doğrudan Başlayın
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                    Verilerinizin bulutta güvende kalması ve tüm cihazlarınızdan erişebilmeniz için e-posta ile giriş yapın veya kayıt olun. Dilerseniz hiçbir hesap açmadan uygulamayı anında çevrimdışı kullanabilirsiniz.
                  </p>
                </div>

                {/* SABİT, AKICI VE STABİL GİRİŞ / BAŞLAMA KARTI */}
                <div className="w-full max-w-2xl mx-auto">
                  <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-7 shadow-xl space-y-4 text-left">
                    {auth.currentUser ? (
                      <div className="space-y-4 text-center py-4">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto text-xl shadow-md">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white">Hesabınız Doğrulandı!</h3>
                          <p className="text-xs text-emerald-400 font-medium font-mono mt-1">
                            {auth.currentUser.email || auth.currentUser.uid}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onComplete}
                          className="w-full max-w-sm mx-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:opacity-95 text-white text-xs sm:text-sm font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Uygulamaya Giriş Yap 🚀</span>
                        </button>
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
                      <div className="space-y-5">
                        {/* Kart Üst Barı */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-xs sm:text-sm font-black text-white tracking-wide">
                                E-Posta ile Giriş ve Kayıt Ol
                              </h3>
                              <p className="text-[10.5px] text-slate-400">Otomatik yedekleme ve tüm cihazlarda anlık eşitleme</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                            256-Bit SSL
                          </span>
                        </div>

                        {/* SABİT, ŞIK & STABİL E-POSTA GİRİŞ & KAYIT KARTI (YANIP SÖNMEZ, SABİT KALIR) */}
                        <div className="w-full">
                          <button
                            type="button"
                            id="onboarding-email-login-button"
                            disabled={authLoading}
                            onClick={handleEmailLoginClick}
                            className="w-full p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border-2 border-amber-500/60 hover:border-amber-400 active:scale-[0.99] text-white font-black shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-between cursor-pointer disabled:opacity-50 text-left"
                          >
                            <div className="flex items-center gap-3.5 sm:gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shadow-xs shrink-0 text-amber-300">
                                <Mail className="w-6 h-6 sm:w-7 h-7 text-amber-300" />
                              </div>

                              <div>
                                <div className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                                  <span>E-Posta ile Giriş ve Kayıt Ol</span>
                                </div>
                                <p className="text-xs text-amber-200/90 font-medium mt-0.5">
                                  👑 Sadece Premium üyelere özel bulut eşitleme ve yedekleme
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs flex items-center gap-1">
                                <span>👑</span> PREMİUM
                              </span>
                              <ArrowRight className="w-4 h-4 text-amber-400" />
                            </div>
                          </button>
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

                        {/* GİRİŞ YAPMADAN DEVAM ET SABİT VE ŞIK BUTONU */}
                        <button
                          type="button"
                          onClick={handleContinueWithoutLogin}
                          className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-indigo-600/30 hover:from-emerald-600/40 hover:to-indigo-600/40 active:scale-[0.99] border-2 border-emerald-400/50 hover:border-emerald-400 text-white font-black text-xs sm:text-sm transition-all duration-150 shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span className="tracking-wide">Giriş Yapmadan Doğrudan Başla</span>
                          <ArrowRight className="w-4 h-4 text-emerald-400" />
                        </button>
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
                      <h4 className="text-xs font-bold text-white">Güvenli Bulut Altyapısı</h4>
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
                className={`transition-all duration-200 rounded-full cursor-pointer ${
                  idx === currentSlide
                    ? "w-8 h-2 bg-gradient-to-r from-amber-400 to-indigo-500"
                    : "w-2.5 h-2 bg-slate-700 hover:bg-slate-600"
                }`}
                title={`Sayfa ${idx + 1} / 2`}
              />
            ))}
          </div>
        </div>

        {/* Masaüstü 2 Sayfalık İndikatörler */}
        <div className="hidden sm:flex items-center gap-3">
          {[0, 1].map((idx) => {
            const isActive = idx === currentSlide;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleGoToSlide(idx)}
                className={`transition-all duration-200 rounded-full cursor-pointer flex items-center justify-center ${
                  isActive
                    ? idx === 0
                      ? "w-10 h-3 bg-gradient-to-r from-amber-400 via-indigo-500 to-purple-500 shadow-md shadow-indigo-500/40"
                      : "w-10 h-3 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 shadow-md shadow-emerald-500/40"
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
            <button
              type="button"
              onClick={handleNext}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:opacity-95 text-white text-xs sm:text-sm font-black transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>Devam Et (2. Adım)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinueWithoutLogin}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:opacity-95 text-white text-xs sm:text-sm font-black transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Uygulamaya Başla</span>
              <span className="text-base">🚀</span>
            </button>
          )}
        </div>
      </footer>

      {/* Uygulama İçi E-Posta / Şifre Giriş & Kayıt Modalı */}
      <ProviderLoginModal
        isOpen={showEmailLoginModal}
        provider="email"
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
          }, 400);
        }}
      />
    </div>
  );
};

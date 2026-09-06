/**
 * OnboardingWalkthrough.tsx
 * 5-Sayfalık Yan Yana Kayan Şık & İnteraktif Uygulama Tanıtım Sayfası (Bütçem Pro)
 * 
 * Özellikler:
 * - 5 sayfalık yan yana kaydırılabilir (swipeable & paginated) lüks tasarım
 * - Her sayfada "Devam Et" butonu, önceki butonu, interaktif nokta göstergeleri
 * - Bütçem Pro'nun tüm özelliklerini (Bütçe/Gelir/Gider, Borç/Taksit, Yapay Zeka & Fiş Tarama,
 *   Grafikler & Yıllık PDF Özeti, Çevrimdışı/Bulut Senkronizasyon & Android APK) kapsar
 * - En son sayfada "Uygulamaya Giriş Yap 🚀" butonu ile animasyonlu açılış sayfasına geçiş
 * - "Tanıtımı Atla" (Skip) seçeneği
 */

import React, { useState } from "react";
import { motion, AnimatePresence, Variants } from "motion/react";
import {
  Wallet,
  CreditCard,
  Sparkles,
  Camera,
  Mic,
  Bot,
  FileText,
  Download,
  Bell,
  Smartphone,
  Cloud,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  PieChart,
  Users,
  Zap,
  Lock,
  ChevronRight,
  Check,
  DollarSign,
  BarChart3,
  Flame,
  Award,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Loader2,
  AlertCircle
} from "lucide-react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { auth } from "../utils/firebase";

interface OnboardingWalkthroughProps {
  onComplete: () => void;
  language?: "tr" | "en";
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
  language = "tr"
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  // 1 Hoş Geldiniz/Vizyon (Slide 0) + 5 Özellik Tanıtım Sayfası (Slides 1-5) + 1 Google & Firebase Giriş Bölümü (Slide 6)
  const totalSlides = 7;

  // Slide 6 Firebase & Google Auth States
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const res = await signInWithPopup(auth, provider);
      if (res.user) {
        setAuthSuccess(`Google ile giriş yapıldı: ${res.user.email || "Başarılı"}`);
        setTimeout(() => {
          onComplete();
        }, 900);
      }
    } catch (err: any) {
      console.error("Walkthrough Google sign-in error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setAuthError("Giriş penceresi kapatıldı. Dilerseniz giriş yapmadan da devam edebilirsiniz.");
      } else {
        setAuthError(err.message || "Google ile giriş yapılırken bir hata oluştu.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authEmail.trim() || !authPassword) {
      setAuthError("Lütfen e-posta ve şifrenizi girin.");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    setAuthLoading(true);
    const targetEmail = authEmail.includes("@")
      ? authEmail.trim().toLowerCase()
      : `${authEmail.trim().toLowerCase()}@borctakip.app`;

    try {
      if (isSignUpMode) {
        const res = await createUserWithEmailAndPassword(auth, targetEmail, authPassword);
        setAuthSuccess(`Hesap başarıyla oluşturuldu: ${res.user.email}`);
      } else {
        const res = await signInWithEmailAndPassword(auth, targetEmail, authPassword);
        setAuthSuccess(`Giriş başarılı: ${res.user.email}`);
      }
      setTimeout(() => {
        onComplete();
      }, 900);
    } catch (err: any) {
      console.warn("Walkthrough Firebase email auth error:", err);
      if (err.code === "auth/email-already-in-use") {
        setAuthError("Bu e-posta adresi zaten kayıtlı. 'Giriş Yap' sekmesinden şifrenizle giriş yapabilirsiniz.");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setAuthError("Girdiğiniz şifre veya e-posta hatalı.");
      } else if (err.code === "auth/user-not-found") {
        setAuthError("Bu e-posta ile kayıtlı bir hesap bulunamadı. 'Yeni Hesap Aç' sekmesinden kaydolabilirsiniz.");
      } else {
        setAuthError(err.message || "Giriş işlemi gerçekleştirilemedi.");
      }
    } finally {
      setAuthLoading(false);
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

  // 6 Detailed, rich slides: Intro/Financial Freedom + 5 App Feature walkthroughs
  const slides: SlideItem[] = [
    // -------------------------------------------------------------
    // SLIDE 0: Bütçem Pro'ya Hoş Geldiniz - Yeni Nesil Kişisel Finans Motoru
    // -------------------------------------------------------------
    {
      id: 0,
      badge: "YENİ NESİL KİŞİSEL FİNANS MOTORU",
      badgeColor: "bg-[#141933] text-[#93c5fd] border-[#2b3560]",
      title: "Bütçenizi Kontrol Edin, Geleceğinizi Güvenceye Alın!",
      subtitle: "Bütçem Pro Finansal Takip Programına Hoş Geldiniz",
      features: [
        {
          icon: <Wallet className="w-4 h-4 text-emerald-400" />,
          title: "Bilinçli Finansal Takip",
          desc: "Tüm gelir, gider ve birikimlerinizi tek merkezden anlık izleyin; paranızın nereye gittiğini tam olarak bilin.",
          tag: "Finansal Takip"
        },
        {
          icon: <TrendingUp className="w-4 h-4 text-sky-400" />,
          title: "Finansal Özgürlük Rotası",
          desc: "Tasarruf oranınızı büyüterek birikim hedeflerinize güvenle ulaşın; geleceğinizi finansal bağımsızlıkla kurun.",
          tag: "Özgürlük"
        },
        {
          icon: <CreditCard className="w-4 h-4 text-rose-400" />,
          title: "Borçsuz Bir Gelecek",
          desc: "Kredi kartı, taksit ve borçlarınızı Kartopu ve Çığ algoritmalarıyla planlayarak borç yükünden kalıcı olarak kurtulun.",
          tag: "Borçsuz Yaşam"
        },
        {
          icon: <Award className="w-4 h-4 text-amber-400" />,
          title: "Bütçem PRO Avantajları",
          desc: "Pro sürüm satın alındığında %100 sıfır reklam, sınırsız yapay zeka asistanı ve VIP araçlarla kesintisiz hız.",
          tag: "Sıfır Reklam 👑"
        }
      ],
      mockup: (
        <div className="space-y-3">
          {/* Financial Freedom Compass Score Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-amber-500/30 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                  ✨
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Finansal Özgürlük Pusulası</h4>
                  <p className="text-[10px] text-slate-400">Kişisel Bütçe & Hedef Endeksi</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                Skor: %88
              </span>
            </div>

            {/* Financial Freedom 3 Pillars */}
            <div className="space-y-2 pt-1">
              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                    1
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-200 block">Bilinçli Harcama Takibi</span>
                    <span className="text-[9px] text-slate-400">Nereye harcadığını net gör</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-400">Tamamlandı ✓</span>
              </div>

              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-bold">
                    2
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-200 block">Borçları Sıfırlama Planı</span>
                    <span className="text-[9px] text-slate-400">Kartopu & Çığ algoritmaları</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-sky-400">Yolda 🚀</span>
              </div>

              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                    3
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-200 block">Finansal Bağımsızlık & Birikim</span>
                    <span className="text-[9px] text-slate-400">Hedeflenen tasarruf & gelecek</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-amber-400">Hedef 🎯</span>
              </div>
            </div>

            {/* Freedom Metric Summary */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2 bg-slate-950/60 rounded-xl border border-white/5 text-center">
                <span className="text-[9px] text-slate-400 block">Tasarruf Oranı</span>
                <span className="text-xs font-black text-emerald-400">%38 (Yüksek)</span>
              </div>
              <div className="p-2 bg-slate-950/60 rounded-xl border border-white/5 text-center">
                <span className="text-[9px] text-slate-400 block">Finansal Durum</span>
                <span className="text-xs font-black text-indigo-300">Güvenli Seviye</span>
              </div>
            </div>
          </div>

          {/* Motivational callout banner */}
          <div className="p-3 bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 border border-amber-500/25 rounded-xl flex items-center gap-2.5">
            <span className="text-lg">🛡️</span>
            <div>
              <span className="text-xs font-bold text-white block">Paranızın Kontrolü Artık Sizde!</span>
              <p className="text-[10px] text-slate-300">
                Aşağıdaki butonla özellikleri adım adım tanıyıp hemen başlayabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      )
    },

    // -------------------------------------------------------------
    // SLIDE 1: Bütçe, Gelir & Gider Yönetimi
    // -------------------------------------------------------------
    {
      id: 1,
      badge: "SAYFA 1 / 5 • BÜTÇE & NAKİT AKIŞI",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      title: "Akıllı Bütçe, Gelir ve Gider Yönetimi",
      subtitle: "Kişisel ve aile finansınızı tek ekrandan tam kontrol altına alın.",
      features: [
        {
          icon: <Wallet className="w-4 h-4 text-emerald-400" />,
          title: "Dinamik Gelir & Gider Takibi",
          desc: "Maaş, kira, serbest gelir ve tüm harcamalarınızı kategorilerine göre saniyeler içinde kaydedin.",
          tag: "Tam Kontrol"
        },
        {
          icon: <Flame className="w-4 h-4 text-amber-400" />,
          title: "Kategori Bütçe Limitleri & Uyarılar",
          desc: "Harcama kalemlerine bütçe tavanı tanımlayın; limit yaklaştığında veya aşıldığında anında uyarı alın.",
          tag: "Tasarruf"
        },
        {
          icon: <DollarSign className="w-4 h-4 text-sky-400" />,
          title: "Canlı Döviz, Altın & Kripto Kurları",
          desc: "TRY, USD, EUR, GBP, Gram Altın ve Bitcoin kurları anlık güncellenir ve bütçenize otomatik yansır.",
          tag: "Canlı Kur"
        },
        {
          icon: <Zap className="w-4 h-4 text-purple-400" />,
          title: "Akıllı Hava Durumu Bütçe Rehberi",
          desc: "Bulunduğunuz şehrin hava koşullarına göre günlük tasarruf önerileri ve akıllı analizler.",
          tag: "Akıllı"
        }
      ],
      mockup: (
        <div className="space-y-3">
          {/* Executive Balance Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-indigo-950/70 border border-white/10 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Aylık Net Bütçe Dengesi</span>
              <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> %68 Tasarruf
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black text-white font-mono">₺24.850,00</div>
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +14.2%
              </span>
            </div>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                <span>Harcama Limiti (₺12.500 / ₺20.000)</span>
                <span className="text-indigo-300 font-bold">%62,5</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-indigo-400" style={{ width: "62.5%" }} />
              </div>
            </div>
          </div>

          {/* Quick Categories Mini Pills */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-900/70 border border-white/10 rounded-xl flex items-center justify-between">
              <span className="font-bold text-slate-300 text-[11px]">🛒 Market & Gıda</span>
              <span className="font-mono font-black text-rose-400 text-[11px]">₺4.200</span>
            </div>
            <div className="p-2.5 bg-slate-900/70 border border-white/10 rounded-xl flex items-center justify-between">
              <span className="font-bold text-slate-300 text-[11px]">🏠 Kira & Faturalar</span>
              <span className="font-mono font-black text-rose-400 text-[11px]">₺6.500</span>
            </div>
          </div>

          {/* Live Rates Mini ticker */}
          <div className="flex items-center justify-between p-2 bg-slate-900/50 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">USD/TRY: ₺38,45</span>
            <span className="flex items-center gap-1 text-sky-400">EUR/TRY: ₺41,20</span>
            <span className="flex items-center gap-1 text-amber-400">Gram Altın: ₺3.420</span>
          </div>
        </div>
      )
    },

    // -------------------------------------------------------------
    // SLIDE 2: Borç & Taksit Takibi
    // -------------------------------------------------------------
    {
      id: 2,
      badge: "SAYFA 2 / 5 • BORÇ & TAKSİT DEFTERİ",
      badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      title: "Detaylı Borç, Alacak & Taksit Takibi",
      subtitle: "Vade günlerini ve kredi taksitlerini asla kaçırmayın.",
      features: [
        {
          icon: <CreditCard className="w-4 h-4 text-indigo-400" />,
          title: "Banka Kredisi & Kart Taksitleri",
          desc: "Toplam taksit adedi, aylık taksit tutarı ve kalan vadesi otomatik hesaplanan taksitli borç motoru.",
          tag: "Taksitler"
        },
        {
          icon: <Users className="w-4 h-4 text-emerald-400" />,
          title: "Kişisel Cari Borç/Alacak Defteri",
          desc: "Kişilere ve esnafa borç/alacaklarınızı listeleyin; ödemeleri parçalı olarak düşüp güncelleyin.",
          tag: "Cari Hesap"
        },
        {
          icon: <Smartphone className="w-4 h-4 text-green-400" />,
          title: "Rehber (.vcf) & WhatsApp Hatırlatma",
          desc: "Telefon rehberinizi yükleyip kişilere tek tıkla şablonlu WhatsApp borç hatırlatması gönderin.",
          tag: "WhatsApp"
        },
        {
          icon: <Bell className="w-4 h-4 text-amber-400" />,
          title: "Kilit Ekranı Alarmları & Push Bildirim",
          desc: "Android kilit ekranında tam zamanında çalan alarm, web push ve e-posta ile son ödeme gününü kaçırmayın.",
          tag: "Sesli Alarm"
        }
      ],
      mockup: (
        <div className="space-y-3">
          {/* Loan / Installment Mockup Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900/90 via-indigo-950/60 to-slate-900/90 border border-indigo-500/30 rounded-2xl shadow-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  🏦
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">İhtiyaç Kredisi (Garanti BBVA)</h4>
                  <p className="text-[10px] text-slate-400">Aylık: ₺3.250 • Son Ödeme: 15'i</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ⏳ 3 Gün Kaldı
              </span>
            </div>

            {/* Installment Tracker Progress */}
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-300">Ödenen: 5 / 12 Taksit</span>
                <span className="text-indigo-400">Kalan: ₺22.750</span>
              </div>
              <div className="grid grid-cols-12 gap-1 h-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-emerald-500 rounded-sm" title="Ödendi" />
                ))}
                <div className="bg-indigo-500 rounded-sm animate-pulse" title="Sıradaki" />
                {[7, 8, 9, 10, 11, 12].map((i) => (
                  <div key={i} className="bg-slate-800 rounded-sm" />
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
                <Bell className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span>Kilit Ekranı Alarmı Aktif</span>
              </div>
              <button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                <Check className="w-3 h-3" /> Taksiti Öde
              </button>
            </div>
          </div>

          {/* Contact Directory Debt Row */}
          <div className="p-3 bg-slate-900/60 border border-white/10 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[10px]">
                MK
              </span>
              <div>
                <span className="font-bold text-white text-[11px]">Mehmet Kaya (Kişisel Borç)</span>
                <p className="text-[9px] text-slate-400">Elden Alınan • ₺5.000</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1">
              💬 WhatsApp Hatırlat
            </span>
          </div>
        </div>
      )
    },

    // -------------------------------------------------------------
    // SLIDE 3: Yapay Zeka & Fiş Tarama (OCR)
    // -------------------------------------------------------------
    {
      id: 3,
      badge: "SAYFA 3 / 5 • YAPAY ZEKA & FİŞ TARAMA",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      title: "Yapay Zeka (AI) & Akıllı Fiş/Fatura Tarama",
      subtitle: "Gemini 3.7 gücüyle finansal koçunuz ve akıllı kamera asistanınız hazır.",
      features: [
        {
          icon: <Bot className="w-4 h-4 text-purple-400" />,
          title: "Gemini 3.7 Destekli Finans Koçu",
          desc: "Gelir-giderinizi analiz eden, kartopu borç kapama stratejileri ve 50/30/20 tasarruf tavsiyesi sunan asistan.",
          tag: "AI Koç"
        },
        {
          icon: <Camera className="w-4 h-4 text-indigo-400" />,
          title: "Akıllı Kamera & Fiş/Fatura OCR",
          desc: "Kamerayla fiş veya faturanın fotoğrafını çekin; tutar, tarih ve kategoriyi saniyeler içinde otomatik çıkarsın.",
          tag: "Otomatik OCR"
        },
        {
          icon: <Mic className="w-4 h-4 text-rose-400" />,
          title: "Sesli Komut İle Gider Kaydetme",
          desc: "Mikrofona 'Markete 350 TL ödedim' deyin; ses analiziyle harcamanız anında bütçenize eklensin.",
          tag: "Sesli Asistan"
        },
        {
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          title: "Akıllı Tasarruf & Bütçe İpuçları",
          desc: "Gereksiz abonelik ve harcama kaçaklarını tespit eder; paranızı büyütecek kişisel taktikler verir.",
          tag: "Tasarruf"
        }
      ],
      mockup: (
        <div className="space-y-3">
          {/* AI Chat Bubble Mockup */}
          <div className="p-3.5 bg-gradient-to-br from-slate-900/90 via-purple-950/40 to-slate-900/90 border border-purple-500/30 rounded-2xl shadow-xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center text-[10px] font-black shadow-md">
                ✨
              </div>
              <span className="text-[11px] font-black text-purple-300">Bütçem AI Danışman</span>
              <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">Online</span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
              "Tebrikler! 🎉 Bu ay market harcamanız %15 azaldı. Kalan <strong>₺1.850</strong> fazlalığı kredi kartı borcunuzun asgarisine ekleyerek <strong>₺340 faiz tasarrufu</strong> sağlayabilirsiniz!"
            </p>
          </div>

          {/* OCR Receipt Scanner Mockup */}
          <div className="p-3 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-indigo-400" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-white">Fiş Başarıyla Tarandı</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-[10px] text-slate-400">Migros A.Ş. • ₺485,50 • Market</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-[10px] font-black">
              Otomatik Kaydedildi
            </span>
          </div>

          {/* Voice Assistant Pill */}
          <div className="p-2 bg-slate-900/50 border border-white/5 rounded-xl flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold">
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              <span>Sesli Komut: "Akaryakıt 600 TL"</span>
            </div>
            <span className="text-emerald-400 font-mono font-bold">✓ Algılandı</span>
          </div>
        </div>
      )
    },

    // -------------------------------------------------------------
    // SLIDE 4: Grafikler & Tek Tuşla Yıllık PDF Özeti
    // -------------------------------------------------------------
    {
      id: 4,
      badge: "SAYFA 4 / 5 • GRAFİKLER & RAPORLAMA",
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
      title: "Gelişmiş Grafikler & Tek Tuşla Yıllık PDF Raporu",
      subtitle: "Mali tablolarınızı görselleştirin, profesyonel yıllık PDF dökümü alın.",
      features: [
        {
          icon: <BarChart3 className="w-4 h-4 text-sky-400" />,
          title: "İnteraktif Aylık & Yıllık Trendler",
          desc: "Gelir, gider ve borç kapatma eğilimlerini dinamik sütun ve çizgi grafikleriyle anlık takip edin.",
          tag: "Grafikler"
        },
        {
          icon: <FileText className="w-4 h-4 text-amber-400" />,
          title: "Tek Tuşla 12 Aylık Finansal PDF Özeti",
          desc: "Yıl boyunca yapılan tüm gelir, gider, borç ödemeleri ve kategori dağılımlarını resmi PDF olarak tek tıkla indirin.",
          tag: "YENİ • Tek Tuş"
        },
        {
          icon: <PieChart className="w-4 h-4 text-indigo-400" />,
          title: "Kategori Bazlı Harcama Dağılımı",
          desc: "Paranızın nereye gittiğini gösteren yüzdelik pasta dilimleri ve tasarruf fırsat göstergeleri.",
          tag: "Analiz"
        },
        {
          icon: <Download className="w-4 h-4 text-emerald-400" />,
          title: "Excel (CSV), HTML & E-Posta Çıktısı",
          desc: "Finansal verilerinizi Excel'e aktarın, yazıcı dostu makbuzlar basın ve EML formatında raporlayın.",
          tag: "Dışa Aktar"
        }
      ],
      mockup: (
        <div className="space-y-3">
          {/* Annual PDF Report Feature Highlight Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900/90 via-sky-950/50 to-slate-900/90 border border-sky-500/30 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-black">
                  <FileText className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">2026 Yıllık Finansal Özet PDF</h4>
                  <p className="text-[10px] text-slate-400">12 Aylık Resmi & Kurumsal Döküm</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Tek Tuşla İndir
              </span>
            </div>

            {/* Mini Chart Mockup */}
            <div className="p-2.5 bg-slate-950/70 rounded-xl border border-white/5 space-y-2">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>12 Aylık Finansal Akış</span>
                <span className="text-emerald-400 font-mono">Net: +₺84.500</span>
              </div>
              {/* Mini visual bars */}
              <div className="flex items-end justify-between h-14 pt-1 gap-1 px-1">
                {[35, 45, 60, 50, 75, 65, 80, 70, 90, 85, 95, 100].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-sm ${i === 11 ? "bg-gradient-to-t from-indigo-500 to-sky-400" : "bg-indigo-600/60"}`}
                      style={{ height: `${h * 0.45}px` }}
                    />
                    <span className="text-[7px] text-slate-500 font-mono">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Health Score */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-300 text-[11px]">Finansal Sağlık Skoru:</span>
              </div>
              <span className="font-mono font-black text-emerald-400 text-sm">94 / 100 • Harika</span>
            </div>
          </div>

          {/* Export badges row */}
          <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-center">
            <div className="p-2 bg-slate-900/60 border border-white/10 rounded-xl text-slate-300">
              📊 Excel (CSV)
            </div>
            <div className="p-2 bg-slate-900/60 border border-white/10 rounded-xl text-slate-300">
              🖨️ Yazıcı Makbuzu
            </div>
            <div className="p-2 bg-slate-900/60 border border-white/10 rounded-xl text-slate-300">
              ✉️ E-Posta Raporu
            </div>
          </div>
        </div>
      )
    },

    // -------------------------------------------------------------
    // SLIDE 5: Bulut Senkronizasyon, Çevrimdışı Güvenlik, Android APK & Bütçem PRO
    // -------------------------------------------------------------
    {
      id: 5,
      badge: "SAYFA 5 / 5 • GÜVENLİK & PRO SÜRÜM",
      badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
      title: "Güvenli Senkronizasyon, Android APK & PRO Sürüm",
      subtitle: "İster çevrimdışı, ister bulutta; PRO sürüm satın alındığında %100 sıfır reklam ve VIP ayrıcalıklar.",
      features: [
        {
          icon: <ShieldCheck className="w-4 h-4 text-teal-400" />,
          title: "%100 Çevrimdışı (Offline-First) Güvenlik",
          desc: "İnternet bağlantısı olmadan da tam kapasite çalışır; banka şifresi veya hassas kimlik bilgisi asla istemez.",
          tag: "Gizlilik"
        },
        {
          icon: <Cloud className="w-4 h-4 text-sky-400" />,
          title: "Google & Firebase Bulut Senkronizasyonu",
          desc: "Tek tıkla giriş yaparak verilerinizi telefon, tablet ve masaüstü bilgisayarınız arasında anında eşitleyin.",
          tag: "Çoklu Cihaz"
        },
        {
          icon: <Smartphone className="w-4 h-4 text-indigo-400" />,
          title: "Android Native APK Tam Uyumluluğu",
          desc: "Kilit ekranı alarmları, galeriye fiş kaydı, yerel bildirimler ve uygulama simgesiyle tam mobil deneyim.",
          tag: "Mobil APK"
        },
        {
          icon: <Award className="w-4 h-4 text-amber-400" />,
          title: "Bütçem PRO Sürüm: %100 Sıfır Reklam",
          desc: "Pro sürüm satın alındığında tüm AdMob reklamları kalıcı olarak kaldırılır; kesintisiz, odaklanmış ve hızlı kullanım sağlanır.",
          tag: "Sıfır Reklam 👑"
        }
      ],
      mockup: (
        <div className="space-y-3">
          {/* Security & Cloud Hybrid Badge */}
          <div className="p-4 bg-gradient-to-br from-slate-900/90 via-teal-950/40 to-slate-900/90 border border-teal-500/30 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Çift Modlu Hibrit Mimari</h4>
                  <p className="text-[10px] text-slate-400">Çevrimdışı Korumalı & Bulut Senkronize</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                256-Bit Koruma
              </span>
            </div>

            {/* Storage Toggle Indicator */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Yerel Depolama (Aktif)
                </span>
                <span className="flex items-center gap-1 text-indigo-300">
                  <Cloud className="w-3.5 h-3.5" /> Bulut Yedekleme (Hazır)
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Tüm verileriniz cihazınızda şifrelenir. İstediğiniz an Google hesabınızla bağlanıp cihazlar arası senkronize edebilirsiniz.
              </p>
            </div>

            {/* Android APK & Security Perks (Zero Ads removed from here and moved to PRO) */}
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 pt-0.5">
              <span className="flex items-center gap-1 text-indigo-300">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Android APK Uyumlu
              </span>
              <span className="text-teal-400">✓ 256-Bit Şifreli</span>
              <span className="text-amber-400">✓ Sınırsız Kayıt</span>
            </div>
          </div>

          {/* PRO Sürüm Satın Alındığında: Sıfır Reklam & VIP Ayrıcalıklar Showcase */}
          <div className="p-3.5 bg-gradient-to-br from-amber-500/15 via-purple-500/10 to-indigo-500/15 border border-amber-500/30 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-black text-xs">
                  👑
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    Bütçem PRO Sürüm
                    <span className="text-[8px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full">VIP</span>
                  </h4>
                  <p className="text-[9.5px] text-slate-400">Pro Sürüm Satın Alındığında</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                🚫 Sıfır Reklam
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10px]">
              <div className="p-1.5 bg-slate-950/70 rounded-lg border border-white/5 flex items-center gap-1.5 text-slate-200 font-medium">
                <span className="text-amber-400 font-bold">✓</span> %100 Reklamsız Deneyim
              </div>
              <div className="p-1.5 bg-slate-950/70 rounded-lg border border-white/5 flex items-center gap-1.5 text-slate-200 font-medium">
                <span className="text-amber-400 font-bold">✓</span> Sınırsız AI & Fiş OCR
              </div>
              <div className="p-1.5 bg-slate-950/70 rounded-lg border border-white/5 flex items-center gap-1.5 text-slate-200 font-medium">
                <span className="text-amber-400 font-bold">✓</span> Yıllık VIP A4 PDF Raporu
              </div>
              <div className="p-1.5 bg-slate-950/70 rounded-lg border border-white/5 flex items-center gap-1.5 text-slate-200 font-medium">
                <span className="text-amber-400 font-bold">✓</span> Öncelikli Bulut Senk.
              </div>
            </div>
          </div>

          {/* Final Call to Action Ready Banner */}
          <div className="p-3 bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-emerald-900/60 border border-white/10 rounded-xl text-center space-y-1">
            <span className="text-xs font-black text-white flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              Tüm Özellikler Kullanıma Hazır!
            </span>
            <p className="text-[10px] text-slate-300">
              Aşağıdaki butona tıklayarak Bütçem Pro ile finansal yolculuğunuza hemen başlayın.
            </p>
          </div>
        </div>
      )
    },

    // -------------------------------------------------------------
    // SLIDE 6: Google ve Firebase ile Giriş Bölümü (İsteğe Bağlı & Misafir Girişi)
    // -------------------------------------------------------------
    {
      id: 6,
      badge: "SON ADIM • GOOGLE & FIREBASE BULUT GİRİŞİ",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      title: "Hesabınızı Bağlayın veya Hemen Başlayın",
      subtitle: "Verilerinizin bulutta güvende kalması ve tüm cihazlarınızdan erişebilmeniz için Google veya Firebase hesabınızla giriş yapın. Dilerseniz hiçbir hesap açmadan uygulamayı doğrudan kullanabilirsiniz.",
      features: [
        {
          icon: <Cloud className="w-4 h-4 text-sky-400" />,
          title: "Google Cloud & Firebase Güvencesi",
          desc: "Verileriniz 256-Bit SSL şifrelemeyle Google Cloud altyapısında saklanır ve anında yedeklenir.",
          tag: "Bulut"
        },
        {
          icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
          title: "Giriş Yapmadan Çevrimdışı Kullanım",
          desc: "Hesap açmadan da tüm bütçe, borç ve grafik araçlarını offline olarak eksiksiz kullanabilirsiniz.",
          tag: "İsteğe Bağlı"
        },
        {
          icon: <Zap className="w-4 h-4 text-amber-400" />,
          title: "Dilediğiniz Zaman Bağlanma",
          desc: "Şimdi giriş yapmasanız dahi daha sonra Ayarlar menüsünden istediğiniz zaman hesabınızı eşleştirebilirsiniz.",
          tag: "Esnek"
        }
      ],
      mockup: null
    }
  ];

  const current = slides[currentSlide];

  // Ultra-smooth, hardware-accelerated slide transitions without stutter or scale jitter
  const slideVariants: Variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.22,
        ease: [0.16, 1, 0.3, 1],
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -50 : 50,
      opacity: 0,
      transition: {
        duration: 0.14,
        ease: [0.16, 1, 0.3, 1],
      }
    })
  };

  return (
    <div className="fixed inset-0 z-[999990] flex flex-col bg-slate-950 text-white select-none overflow-hidden font-sans">
      {/* Dynamic Background Ambient Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" style={{ contain: "strict" }}>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/25 rounded-full blur-2xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-600/25 rounded-full blur-2xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/20 rounded-full blur-2xl" />
      </div>

      {/* Top Header Navigation Bar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center font-black text-xs text-white">
              BP
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-wider text-white">BÜTÇEM PRO</span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO v4.5
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Finansal Özgürlük ve Bütçe Rehberi</p>
          </div>
        </div>

        {/* Right side: Page indicator */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentSlide === 0 ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Giriş • Bütçem Pro</span>
            </div>
          ) : currentSlide === 6 ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Google & Firebase</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <span>Tanıtım Sayfası</span>
              <span className="text-indigo-400 font-mono font-black">{currentSlide} / 5</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Interactive Slide Area - justify-start to ensure top header/badge never gets cut off */}
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
              /* SLIDE 0: GÖRSELDEKİ BÜYÜK ANİMASYONLU BAŞLIK, ROZET VE FİNANSAL YAZILAR */
              <div className="w-full flex flex-col justify-start items-center space-y-3 sm:space-y-4 max-w-4xl mx-auto pt-1 pb-3 text-center">
                {/* 1. Pill Badge - EXACT MATCH TO IMAGE */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-[#141933] border border-[#2b3560] text-[#93c5fd] text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-950/50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  <span>YENİ NESİL KİŞİSEL FİNANS MOTORU</span>
                </motion.div>

                {/* 2. Büyük Başlık - Tam ve Kesintisiz Görünüm */}
                <div className="text-center space-y-2 sm:space-y-2.5">
                  <motion.h1
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight sm:leading-tight text-white"
                  >
                    Bütçenizi Kontrol Edin, <br />
                    <span className="bg-gradient-to-r from-[#818cf8] via-[#a78bfa] to-[#34d399] bg-clip-text text-transparent drop-shadow-sm">
                      Geleceğinizi Güvenceye Alın!
                    </span>
                  </motion.h1>

                  {/* 3. Hoş Geldiniz Vurgusu */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-bold shadow-sm"
                  >
                    <span>👋</span>
                    <span>Bütçem Pro Finansal Takip Programına Hoş Geldiniz!</span>
                  </motion.div>

                  {/* 4. Alt Açıklama Paragrafı */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="text-xs sm:text-sm md:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed text-center px-2"
                  >
                    Bütçem ile gelir-gider dengenizi hesaplayın, birikim hedefleri oluşturun ve borçlarınızı bilimsel stratejilerle (Kartopu ve Çığ metodları) eritin. Yapay zeka bütçenizi analiz etsin!
                  </motion.p>
                </div>

                {/* 5. Dört Temel Finansal Güç Kartı */}
                <div className="w-full grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1 text-left">
                  <div className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/40 rounded-2xl transition space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold text-white">Gelir-Gider Dengesi</h3>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Nakit akışınızı anlık hesaplayın, paranızın nereye gittiğini tam olarak bilin.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/40 rounded-2xl transition space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold text-white">Birikim Hedefleri</h3>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Hayalleriniz için akıllı kasalar kurun, tasarruf oranınızı disiplinle büyütün.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/40 rounded-2xl transition space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold text-white">Kartopu & Çığ Yöntemi</h3>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Borçlarınızı bilimsel metodlarla en az faiz ve en hızlı süreyle eritin.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/40 rounded-2xl transition space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold text-white">Yapay Zeka Analizi</h3>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Harcamalarınızı yapay zeka analiz etsin, size özel tasarruf rotası çıkarsın.
                    </p>
                  </div>
                </div>

                {/* 6. Tanıtım Turuna Başla ve Doğrudan Uygulamaya Başla Butonları */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(1);
                      setCurrentSlide(1);
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:opacity-95 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-indigo-600/30 flex items-center gap-2 active:scale-95 transition cursor-pointer"
                  >
                    <span>Tüm Özellikleri Keşfet (5 Adım)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onComplete}
                    className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm border border-white/15 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Doğrudan Uygulamaya Başla</span>
                    <span>🚀</span>
                  </button>
                </div>
              </div>
            ) : currentSlide === 6 ? (
              /* SLIDE 6: GOOGLE VE FIREBASE İLE GİRİŞ BÖLÜMÜ (İSTEYEN GİRİŞ YAPMADAN DA DEVAM EDEBİLSİN) */
              <div className="w-full grid md:grid-cols-12 gap-6 lg:gap-8 items-center">
                {/* Sol Sütun: Açıklamalar ve Giriş Yapmadan Devam Et Butonu */}
                <div className="md:col-span-6 space-y-4 text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wide border shadow-sm uppercase">
                    <span className="px-2.5 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      SON ADIM • BULUT & GİRİŞ
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                      Hesabınızı Bağlayın veya Hemen Başlayın
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                      Verilerinizin bulutta güvende kalması ve tüm cihazlarınızdan erişebilmeniz için Google veya Firebase hesabınızla giriş yapın. Dilerseniz hiçbir hesap açmadan uygulamayı doğrudan kullanabilirsiniz.
                    </p>
                  </div>

                  {/* 3 Özellik Kutucuğu */}
                  <div className="space-y-2 pt-1">
                    <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex items-start gap-3">
                      <div className="p-1.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 mt-0.5">
                        <Cloud className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Google Cloud & Firebase Güvencesi</h4>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Verileriniz 256-Bit SSL şifrelemeyle Google Cloud altyapısında saklanır ve anında yedeklenir.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex items-start gap-3">
                      <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-0.5">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Giriş Yapmadan Çevrimdışı Kullanım</h4>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Hesap açmadan da tüm bütçe, borç ve grafik araçlarını offline olarak eksiksiz kullanabilirsiniz.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex items-start gap-3">
                      <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mt-0.5">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Dilediğiniz Zaman Bağlanma</h4>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Şimdi giriş yapmasanız dahi daha sonra Ayarlar menüsünden istediğiniz zaman hesabınızı eşleştirebilirsiniz.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* İsteyen Giriş Yapmadan Devam Edebilir Özel Alanı */}
                  <div className="p-3.5 bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-indigo-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        İsteyen Giriş Yapmadan Devam Edebilir
                      </span>
                      <span className="text-[9px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                        İsteğe Bağlı
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Kayıt olmadan tek tıkla doğrudan uygulamaya geçiş yapabilirsiniz.
                    </p>
                    <button
                      type="button"
                      onClick={handleContinueWithoutLogin}
                      className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black transition flex items-center justify-center gap-2 border border-white/15 active:scale-95 cursor-pointer shadow-sm"
                    >
                      <span>🚀 Giriş Yapmadan Doğrudan Başla</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                  </div>
                </div>

                {/* Sağ Sütun: İnteraktif Google & Firebase Giriş Kartı */}
                <div className="md:col-span-6 w-full">
                  <div className="relative bg-slate-900/95 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
                    {auth.currentUser ? (
                      <div className="space-y-4 text-center py-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-xl">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white">Hesabınız Doğrulandı</h3>
                          <p className="text-xs text-emerald-400 font-medium font-mono mt-1">
                            {auth.currentUser.email || auth.currentUser.uid}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onComplete}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs sm:text-sm font-black transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                          <span>Uygulamaya Giriş Yap 🚀</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="text-[11px] text-slate-400 hover:text-rose-400 transition"
                        >
                          Farklı bir hesapla giriş yap
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between pb-1 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h3 className="text-xs font-black text-white">Bulut Hesabı</h3>
                              <p className="text-[10px] text-slate-400">Google veya Firebase Girişi</p>
                            </div>
                          </div>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                            Güvenli 256-Bit
                          </span>
                        </div>

                        {/* Google Sign In Button */}
                        <button
                          type="button"
                          disabled={authLoading}
                          onClick={handleGoogleSignIn}
                          className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-black transition flex items-center justify-center gap-2.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          {authLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              />
                            </svg>
                          )}
                          <span>Google ile Hızlı Giriş Yap</span>
                        </button>

                        {/* Divider */}
                        <div className="relative flex items-center justify-center my-1.5">
                          <div className="border-t border-white/10 w-full" />
                          <span className="bg-slate-900 px-2.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                            veya Firebase e-posta ile
                          </span>
                          <div className="border-t border-white/10 w-full" />
                        </div>

                        {/* Tabs: Giriş Yap / Kayıt Ol */}
                        <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-white/5">
                          <button
                            type="button"
                            onClick={() => { setIsSignUpMode(false); setAuthError(""); }}
                            className={`py-1.5 text-xs font-bold rounded-lg transition ${
                              !isSignUpMode ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                            }`}
                          >
                            Giriş Yap
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsSignUpMode(true); setAuthError(""); }}
                            className={`py-1.5 text-xs font-bold rounded-lg transition ${
                              isSignUpMode ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                            }`}
                          >
                            Yeni Hesap Aç
                          </button>
                        </div>

                        {/* Email/Password Form */}
                        <form onSubmit={handleEmailPasswordAuth} className="space-y-2.5">
                          <div>
                            <div className="relative">
                              <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                              <input
                                type="email"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                placeholder="E-posta adresiniz"
                                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <div className="relative">
                              <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                              <input
                                type={showPassword ? "text" : "password"}
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                placeholder="Şifreniz (En az 6 karakter)"
                                className="w-full pl-9 pr-9 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition"
                              >
                                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {authError && (
                            <div className="p-2 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2 text-[11px] text-rose-300">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                              <span>{authError}</span>
                            </div>
                          )}

                          {authSuccess && (
                            <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-[11px] text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                              <span>{authSuccess}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={authLoading}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            {authLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : isSignUpMode ? (
                              <>
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Hesap Oluştur ve Giriş Yap</span>
                              </>
                            ) : (
                              <>
                                <LogIn className="w-3.5 h-3.5" />
                                <span>Firebase ile Giriş Yap</span>
                              </>
                            )}
                          </button>
                        </form>

                        {/* Bottom link: continue without login */}
                        <div className="pt-1.5 text-center border-t border-white/5">
                          <button
                            type="button"
                            onClick={handleContinueWithoutLogin}
                            className="text-[11px] text-slate-400 hover:text-indigo-300 font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                          >
                            <span>Giriş yapmadan misafir olarak devam et</span>
                            <ArrowRight className="w-3 h-3 text-indigo-400" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* SLIDES 1 - 5: 5 ÖZELLİK TANITIM SAYFASI (12 SÜTUNLU ZENGİN GÖSTERİM) */
              <div className="w-full grid md:grid-cols-12 gap-6 lg:gap-8 items-center">
                {/* Left Column */}
                <div className="md:col-span-7 space-y-4 text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wide border shadow-sm uppercase">
                    <span className={`px-2.5 py-0.5 rounded-full border ${current.badgeColor}`}>
                      {current.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                      {current.title}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                      {current.subtitle}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
                    {current.features.map((feat, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-900/60 hover:bg-slate-900/80 border border-white/10 rounded-2xl transition duration-200 space-y-1 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-white/5 border border-white/10">
                              {feat.icon}
                            </div>
                            <h3 className="text-xs font-bold text-white">{feat.title}</h3>
                          </div>
                          {feat.tag && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5">
                              {feat.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          {feat.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column */}
                <div className="md:col-span-5 w-full">
                  <div className="relative bg-slate-900/95 border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl">
                    {current.mockup}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Sticky Control & Navigation Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 border-t border-white/10 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/80 backdrop-blur-md">
        {/* Left: Previous Button */}
        <div className="w-full sm:w-auto flex justify-between sm:justify-start items-center gap-2">
          {currentSlide > 0 ? (
            <button
              onClick={handlePrev}
              className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-white/10 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Geri</span>
            </button>
          ) : (
            <div className="w-16" /> /* Spacer to balance layout */
          )}

          {/* Center Indicators for mobile */}
          <div className="flex sm:hidden items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleGoToSlide(idx)}
                className={`transition-all duration-200 rounded-full cursor-pointer ${
                  idx === currentSlide
                    ? idx === 0
                      ? "w-6 h-2 bg-amber-400 shadow-md shadow-amber-400/50"
                      : idx === 6
                      ? "w-6 h-2 bg-emerald-400 shadow-md shadow-emerald-400/50"
                      : "w-6 h-2 bg-indigo-500 shadow-md shadow-indigo-500/50"
                    : "w-2 h-2 bg-slate-700 hover:bg-slate-600"
                }`}
                title={
                  idx === 0
                    ? "Bütçem Pro'ya Hoş Geldiniz"
                    : idx === 6
                    ? "Google & Firebase Girişi"
                    : `Sayfa ${idx}`
                }
              />
            ))}
          </div>
        </div>

        {/* Center Desktop Pagination Dots */}
        <div className="hidden sm:flex items-center gap-2">
          {slides.map((_, idx) => {
            const isActive = idx === currentSlide;
            return (
              <button
                key={idx}
                onClick={() => handleGoToSlide(idx)}
                className={`transition-all duration-200 rounded-full cursor-pointer flex items-center justify-center ${
                  isActive
                    ? idx === 0
                      ? "w-8 h-2.5 bg-gradient-to-r from-amber-400 to-amber-500 shadow-lg shadow-amber-400/50"
                      : idx === 6
                      ? "w-8 h-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/50"
                      : "w-8 h-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/50"
                    : "w-2.5 h-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10"
                }`}
                title={
                  idx === 0
                    ? "Bütçem Pro'ya Hoş Geldiniz"
                    : idx === 6
                    ? "Google & Firebase ile Giriş"
                    : `Tanıtım Sayfası ${idx} / 5`
                }
              />
            );
          })}
        </div>

        {/* Right: Next / Complete Button */}
        <div className="w-full sm:w-auto">
          {currentSlide === 0 ? (
            <button
              onClick={handleNext}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-600 hover:to-purple-700 text-white text-xs sm:text-sm font-black transition-all duration-200 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>Tanıtım Turuna Başla (1/5)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : currentSlide >= 1 && currentSlide < 5 ? (
            <button
              onClick={handleNext}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs sm:text-sm font-black transition-all duration-200 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>Devam Et ({currentSlide + 1}/5)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : currentSlide === 5 ? (
            <button
              onClick={handleNext}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 hover:brightness-110 text-white text-xs sm:text-sm font-black transition-all duration-200 shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>Hesap ve Giriş Ekranına Geç (Son Adım)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            /* Slide 6 (Son Adım): Giriş Yapmadan Devam Et / Uygulamaya Başla */
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleContinueWithoutLogin}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:brightness-110 text-white text-xs sm:text-sm font-black transition-all duration-300 shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Giriş Yapmadan Devam Et</span>
              <span className="text-base">🚀</span>
            </motion.button>
          )}
        </div>
      </footer>
    </div>
  );
};

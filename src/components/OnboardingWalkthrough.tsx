
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { authService } from "../services/authService";
import { ProviderLoginModal } from "./ProviderLoginModal";

interface SlideItem {
  id: number;
  title: string;
  subtitle: string;
  gradient: string;
  icon: string;
  backgroundImage?: string;
}

export const OnboardingWalkthrough: React.FC<{
  onComplete: () => void;
  isPremium?: boolean;
  onOpenUpgradeModal?: () => void;
}> = ({ onComplete, isPremium = false, onOpenUpgradeModal }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showEmailLoginModal, setShowEmailLoginModal] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const slides: SlideItem[] = [
    { 
      id: 0, 
      title: "Hoş Geldiniz", 
      subtitle: "Bütçenizi akıllıca yönetin.", 
      gradient: "from-blue-900 to-indigo-950", 
      icon: "🚀",
      backgroundImage: "/src/assets/images/finance_pattern_1_1791945743028.jpg",
      features: ["Tüm hesaplarınız tek yerde", "Kişisel finans takibi", "Güvenli ve şeffaf veri"]
    },
    { 
      id: 1, 
      title: "Toplam Borç Analizi", 
      subtitle: "Borçlarınızı detaylı grafiklerle görün.", 
      gradient: "from-orange-900 to-red-950", 
      icon: "📈",
      backgroundImage: "/src/assets/images/finance_pattern_1_1791945743028.jpg",
      features: ["Detaylı borç dökümü", "Görsel ödeme takibi", "Taksit planlama"]
    },
    { 
      id: 2, 
      title: "Yaklaşan Ödemeler", 
      subtitle: "Ödemelerinizi anlık takip edin.", 
      gradient: "from-emerald-900 to-green-950", 
      icon: "✅",
      backgroundImage: "/src/assets/images/finance_pattern_1_1791945743028.jpg",
      features: ["Otomatik hatırlatıcılar", "Yaklaşan borç uyarıları", "Ödeme geçmişi"]
    },
    { 
      id: 3, 
      title: "Bütçeniz Hazır!", 
      subtitle: "Hemen yönetmeye başlayın.", 
      gradient: "from-cyan-900 to-blue-950", 
      icon: "✨",
      backgroundImage: "/src/assets/images/finance_pattern_1_1791945743028.jpg",
      features: ["Hızlı kurulum", "Kişiselleştirilmiş kontrol paneli", "Her yerden erişim"]
    }
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={slides[currentSlide].id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className={`w-full h-full flex flex-col items-center justify-center rounded-[2.5rem] p-8 bg-gradient-to-br ${slides[currentSlide].gradient} border border-white/10 shadow-2xl relative overflow-hidden`}
        >
          {slides[currentSlide].backgroundImage && (
            <img 
              src={slides[currentSlide].backgroundImage} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" 
            />
          )}
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />

          {!logoError ? (
            <motion.img 
              key={currentSlide}
              src="/notification-icon.png"
              alt="Butcem Pro Logo" 
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="w-32 h-32 mb-6 object-contain drop-shadow-2xl z-10"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-32 h-32 mb-6 bg-white/20 rounded-full flex items-center justify-center text-5xl z-10">
              {slides[currentSlide].icon}
            </div>
          )}
          
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 text-center tracking-tighter z-10">{slides[currentSlide].title}</h1>
          <p className="text-white/70 text-center text-md md:text-lg mb-6 max-w-md z-10">{slides[currentSlide].subtitle}</p>

          {slides[currentSlide].features && (
            <ul className="text-white/80 space-y-2 mb-8 text-left w-full max-w-xs z-10">
              {slides[currentSlide].features?.map((feat, i) => (
                <li key={i} className="flex items-center gap-2 text-sm md:text-base font-medium">
                  <span className="text-yellow-400">✓</span> {feat}
                </li>
              ))}
            </ul>
          )}

          {currentSlide === 3 && (
            <div className="w-full max-w-sm space-y-4 z-10">
              <button onClick={() => setShowEmailLoginModal(true)} className="w-full py-4 rounded-full bg-white text-indigo-950 font-black text-lg hover:scale-105 transition shadow-xl hover:shadow-white/20">E-posta ile Giriş Yap</button>
              <button onClick={async () => { await authService.signInAsGuest(); onComplete(); }} className="w-full py-4 rounded-full bg-transparent border-2 border-white/20 text-white font-bold text-lg hover:bg-white/10 transition">Misafir Olarak Başla</button>
            </div>
          )}

          <div className="flex gap-4 mt-8 z-10">
            {currentSlide > 0 && (
              <button onClick={() => setCurrentSlide(prev => prev - 1)} className="px-6 py-3 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition backdrop-blur-sm border border-white/10">
                Geri
              </button>
            )}
            {currentSlide < 3 && (
              <button onClick={() => setCurrentSlide(prev => prev + 1)} className="px-8 py-3 rounded-full bg-white text-slate-900 font-bold flex items-center gap-2 hover:scale-105 transition shadow-lg">
                Devam Et <ArrowRight />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <ProviderLoginModal
        isOpen={showEmailLoginModal}
        provider="email"
        isPremium={isPremium}
        onOpenUpgradeModal={onOpenUpgradeModal}
        onClose={() => setShowEmailLoginModal(false)}
        onLoginSuccess={() => { setShowEmailLoginModal(false); onComplete(); }}
      />
    </div>
  );
};

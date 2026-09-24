/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  PlayCircle,
  Clock,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  Download,
  Upload,
  BrainCircuit,
  Gift,
  Zap,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Film,
  Award,
  Maximize2
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  ADMOB_CONFIG,
  grant24HourPass,
  isPassActive,
  getRemainingPassTimeFormatted,
  RewardedFeatureType
} from "../utils/rewardedAdService";

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFeature?: RewardedFeatureType;
  onRewardGranted?: () => void;
  onUpgradeClick?: () => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  onClose,
  targetFeature = "any",
  onRewardGranted,
  onUpgradeClick
}) => {
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [adFinished, setAdFinished] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activePassTime, setActivePassTime] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsPlayingAd(false);
      setCountdown(8);
      setAdFinished(false);
      setActivePassTime(getRemainingPassTimeFormatted(targetFeature));
    }
  }, [isOpen, targetFeature]);

  if (!isOpen) return null;

  const featureTitleMap: Record<string, { 
    title: string; 
    shortName: string;
    desc: string; 
    icon: React.ElementType; 
    color: string;
    badge: string;
    adText: string;
  }> = {
    report: {
      title: "Finansal Rapor & CSV İndirme",
      shortName: "Finansal Rapor",
      desc: "Tüm gelir, gider, basit/kurumsal borçlar, taksitler ve kişi cari hesaplarını içeren filtreli finansal raporu CSV formatında tek tuşla indirin.",
      icon: FileSpreadsheet,
      color: "from-emerald-600 via-teal-600 to-green-700",
      badge: "SADECE FİNANSAL RAPOR KİLİDİ",
      adText: "Finansal Rapor ve CSV İndirme aracı için sponsorlu video hazırlanıyor. Reklam bitiminde 24 saatlik (1 tam gün) finansal rapor hakkınız açılacaktır."
    },
    ai: {
      title: "Yapay Zekâ Finans Danışmanı (Gemini AI)",
      shortName: "Yapay Zeka Analizi",
      desc: "Yapay zeka ile kişiselleştirilmiş bütçe analizi, kartopu borç kapatma stratejileri ve finansal tavsiyeler.",
      icon: BrainCircuit,
      color: "from-indigo-600 via-purple-600 to-indigo-700",
      badge: "SADECE YAPAY ZEKA KİLİDİ",
      adText: "Yapay Zeka Analiz Asistanı için sponsorlu video hazırlanıyor. Reklam bitiminde 24 saatlik AI erişiminiz başlayacaktır."
    },
    export: {
      title: "Veri Dışa Aktarma & Yedekleme",
      shortName: "Dışa Aktarma",
      desc: "Tüm borç, taksit, gelir ve bütçe kayıtlarınızı JSON, CSV, WhatsApp ve Google Drive formatlarında tek tuşla indirin ve paylaşın.",
      icon: Download,
      color: "from-blue-600 via-cyan-600 to-teal-600",
      badge: "SADECE DIŞA AKTARMA KİLİDİ",
      adText: "Veri Dışa Aktarma ve Yedekleme için sponsorlu video hazırlanıyor. Reklam bitiminde 24 saatlik dışa aktarma hakkınız açılacaktır."
    },
    import: {
      title: "Veri İçe Aktarma & Geri Yükleme",
      shortName: "İçe Aktarma",
      desc: "Daha önce aldığınız JSON yedek dosyalarını veya yedek kodlarını sisteme yükleyerek tüm verilerinizi anında geri getirin.",
      icon: Upload,
      color: "from-emerald-600 via-teal-600 to-cyan-700",
      badge: "SADECE İÇE AKTARMA KİLİDİ",
      adText: "Veri İçe Aktarma ve Geri Yükleme için sponsorlu video hazırlanıyor. Reklam bitiminde 24 saatlik içe aktarma hakkınız açılacaktır."
    },
    any: {
      title: "Kısıtlı Finansal Özellik",
      shortName: "Seçili Özellik",
      desc: "Kısa bir video izleyerek bu özelliği 24 saat boyunca sınırsız kullanın.",
      icon: Gift,
      color: "from-amber-500 to-orange-600",
      badge: "24 SAATLİK ERİŞİM",
      adText: "Sponsorlu video tamamlandığında seçili özelliğiniz 24 saatliğine aktif edilecektir."
    }
  };

  const featureInfo = featureTitleMap[targetFeature] || featureTitleMap.any;
  const FeatureIcon = featureInfo.icon;

  const handleStartWatchVideo = () => {
    setIsPlayingAd(true);
    setCountdown(8);
    setAdFinished(false);

    // Simulated rewarded video countdown with AdMob slot ID ca-app-pub-4449700232321088/6123306166
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setAdFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleClaimReward = () => {
    // 1. Grant 24-hour pass ONLY to the target feature
    grant24HourPass(targetFeature);

    // 2. High-speed celebratory confetti
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        gravity: 1.2,
        decay: 0.92,
        ticks: 120
      });
    } catch {
      // Confetti fallback
    }

    // 3. Callback to execute target feature
    setTimeout(() => {
      onClose();
      if (onRewardGranted) {
        onRewardGranted();
      }
    }, 600);
  };

  // FULLSCREEN VIDEO AD MODE
  if (isPlayingAd) {
    return (
      <div className="fixed inset-0 z-[100000] w-screen h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 select-none overflow-hidden animate-fade-in">
        {/* Ambient background glows */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.15),transparent_50%)] pointer-events-none" />

        {/* Top Video Header & Controls */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-black uppercase rounded-lg tracking-wider border border-amber-500/30 flex items-center gap-1.5 shadow-sm shadow-amber-500/10">
              <Film className="w-3.5 h-3.5 text-amber-400" /> GOOGLE ADMOB TAM EKRAN VİDEO REKLAMI
            </span>
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              Slot ID: {ADMOB_CONFIG.REWARDED_SLOT}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
              title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="px-3.5 py-1.5 bg-slate-900 text-amber-400 font-mono font-black text-xs sm:text-sm rounded-xl border border-amber-500/40 flex items-center gap-2 shadow-lg">
              <Clock className="w-4 h-4 animate-spin text-amber-400" />
              <span>{adFinished ? "ÖDÜL HAZIR ✅" : `${countdown} sn`}</span>
            </div>
          </div>
        </div>

        {/* Center Stage: Cinematic Video Simulation Canvas */}
        <div className="relative z-10 my-auto flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto py-6">
          <div className="w-full bg-linear-to-b from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-12 shadow-2xl relative overflow-hidden text-center flex flex-col items-center justify-center">
            
            {/* Top Progress bar across container */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800">
              <div
                className="bg-linear-to-r from-amber-500 via-orange-500 to-emerald-400 h-full transition-all duration-1000 ease-linear rounded-r-full"
                style={{ width: `${((8 - countdown) / 8) * 100}%` }}
              />
            </div>

            {!adFinished ? (
              <div className="space-y-6 max-w-lg">
                <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24">
                  <div className="absolute inset-0 rounded-3xl bg-linear-to-tr from-amber-500 to-indigo-600 blur-xl opacity-40 animate-pulse" />
                  <div className={`relative w-full h-full rounded-3xl bg-linear-to-tr ${featureInfo.color} flex items-center justify-center shadow-2xl border border-white/20`}>
                    <FeatureIcon className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-bounce" />
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-black uppercase tracking-widest border border-indigo-500/30 mb-2">
                    <Sparkles className="w-3 h-3 text-indigo-400" /> Sponsorlu İçerik Gösterimi
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {featureInfo.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium mt-2 max-w-md mx-auto leading-relaxed">
                    {featureInfo.adText}
                  </p>
                </div>

                {/* Simulated playback visualizer */}
                <div className="flex items-center justify-center gap-1.5 h-6">
                  {[40, 70, 95, 60, 80, 45, 90, 75, 50, 85, 65, 95, 40].map((height, i) => (
                    <span
                      key={i}
                      className="w-1 bg-amber-400/80 rounded-full animate-pulse"
                      style={{
                        height: `${height}%`,
                        animationDelay: `${i * 80}ms`
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-lg animate-fade-in">
                <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24">
                  <div className="absolute inset-0 rounded-full bg-emerald-500 blur-xl opacity-50 animate-pulse" />
                  <div className="relative w-full h-full rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center shadow-2xl">
                    <CheckCircle2 className="w-12 h-12 animate-scale-up" />
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-widest border border-emerald-500/40 mb-2">
                    <Award className="w-3.5 h-3.5 text-emerald-400" /> 1 Günlük Erişim Kazanıldı!
                  </div>
                  <h2 className="text-xl sm:text-3xl font-black text-white">
                    {featureInfo.shortName} Kilidi Açıldı! 🎉
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-300 font-medium mt-2 max-w-md mx-auto">
                    Tebrikler! <strong>{featureInfo.shortName}</strong> özelliği 24 saat (1 tam gün) boyunca sınırsız kullanımınıza açılmıştır.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Fullscreen Control Action Bar */}
        <div className="relative z-10 w-full max-w-4xl mx-auto">
          {adFinished ? (
            <button
              type="button"
              onClick={handleClaimReward}
              className="w-full py-4 px-6 bg-linear-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-emerald-500/30 transition active:scale-95 flex items-center justify-center gap-3 cursor-pointer border border-emerald-400/30 animate-bounce"
            >
              <span>🎉 Ödülü Al & {featureInfo.shortName} Özelliğini Başlat (24 Saat)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-full py-3.5 px-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Lütfen tam ekran videoyu kapatmayın. Süre bitince ({countdown}s) ödülünüz tanımlanacaktır.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // MODAL OFFER SCREEN MODE
  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative text-slate-800 dark:text-slate-100 my-auto">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition z-20 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Offer Screen Content */}
        <div className="p-6 space-y-5">
          {/* Header with gradient icon */}
          <div className="text-center space-y-3">
            <div className={`w-16 h-16 mx-auto rounded-2xl bg-linear-to-tr ${featureInfo.color} flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white`}>
              <FeatureIcon className="w-8 h-8" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase rounded-full tracking-wider border border-amber-500/20 inline-flex items-center gap-1">
                <Zap className="w-3 h-3" /> {featureInfo.badge} (1 GÜN)
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1.5">
                {featureInfo.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                {featureInfo.desc}
              </p>
            </div>
          </div>

          {/* Specific Feature Condition Callout */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>ÖZELLİK BAZLI REKLAM KURALI:</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Her kısıtlı özellik için <strong className="text-slate-900 dark:text-slate-200 font-bold">ayrı 1 video reklam</strong> izleme şartı bulunur. Bu video izlendiğinde <u>sadece {featureInfo.shortName}</u> 24 saatliğine açılır.
            </p>
          </div>

          {/* Pass status if already active for this feature */}
          {activePassTime && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{featureInfo.shortName} Süreniz Aktif:</span>
              </div>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                {activePassTime}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleStartWatchVideo}
              className="w-full py-3.5 px-4 bg-linear-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 text-slate-950 fill-current" />
              <span>Tam Ekran Reklamı İzle & Aç (24 Saat)</span>
            </button>

            {onUpgradeClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUpgradeClick();
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-2xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Reklamsız & Tüm Özellikler Açık PRO'ya Geç</span>
              </button>
            )}
          </div>

          {/* Footer trust notice */}
          <div className="text-center text-[9px] text-slate-400 font-medium">
            Google AdMob Güvenli Reklam Ağı • Reklam Birimi: {ADMOB_CONFIG.REWARDED_VIDEO_ID}
          </div>
        </div>
      </div>
    </div>
  );
};

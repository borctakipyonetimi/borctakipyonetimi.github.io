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
  ShieldCheck,
  Download,
  Upload,
  BrainCircuit,
  Gift,
  Zap,
  ArrowRight
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  ADMOB_CONFIG,
  grant24HourPass,
  isPassActive,
  getRemainingPassTimeFormatted
} from "../utils/rewardedAdService";

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFeature?: "ai" | "export" | "import" | "any";
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
      setActivePassTime(getRemainingPassTimeFormatted());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const featureTitleMap: Record<string, { title: string; desc: string; icon: any; color: string }> = {
    ai: {
      title: "Yapay Zeka Bütçe Analizi",
      desc: "Gemini AI ile akıllı borç kapatma stratejileri ve anlık finansal analiz",
      icon: BrainCircuit,
      color: "from-indigo-500 to-purple-600"
    },
    export: {
      title: "Veri Dışa Aktarma (Excel & JSON)",
      desc: "Tüm borç, taksit ve bütçe kayıtlarınızı tek tuşla yedekleyin ve indirin",
      icon: Download,
      color: "from-blue-500 to-cyan-600"
    },
    import: {
      title: "Veri İçe Aktarma & Geri Yükleme",
      desc: "Daha önce aldığınız yedekleri ve dosyaları anında sisteme aktarın",
      icon: Upload,
      color: "from-emerald-500 to-teal-600"
    },
    any: {
      title: "Gelişmiş Finansal Özellikler",
      desc: "Dışa Aktarma, İçe Aktarma ve Yapay Zeka Analizini 24 saat boyunca sınırsız kullanın",
      icon: Gift,
      color: "from-amber-500 to-orange-600"
    }
  };

  const featureInfo = featureTitleMap[targetFeature] || featureTitleMap.any;
  const FeatureIcon = featureInfo.icon;

  const handleStartWatchVideo = () => {
    setIsPlayingAd(true);
    setCountdown(8);
    setAdFinished(false);

    // Simulated high-fidelity rewarded video countdown
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
    // 1. Grant 24-hour pass
    grant24HourPass();

    // 2. Trigger high-speed confetti (gravity: 1.2, decay: 0.92)
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        gravity: 1.2,
        decay: 0.92,
        ticks: 120
      });
    } catch {
      // Confetti fallback safe
    }

    // 3. Callback to execute target feature
    setTimeout(() => {
      onClose();
      if (onRewardGranted) {
        onRewardGranted();
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative text-slate-800 dark:text-slate-100 my-auto">
        
        {/* Close Button */}
        {!isPlayingAd && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition z-20 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Video Player Screen Mode */}
        {isPlayingAd ? (
          <div className="p-6 space-y-5">
            {/* Top Video Header & Countdown */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase rounded tracking-wider border border-amber-500/20 flex items-center gap-1">
                  <PlayCircle className="w-3 h-3" /> ADMOB VİDEO REKLAMI
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  ID: {ADMOB_CONFIG.REWARDED_SLOT}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <div className="px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-amber-400 font-mono font-black text-xs rounded-lg border border-amber-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3 animate-spin" />
                  <span>{adFinished ? "Tamamlandı" : `${countdown}s`}</span>
                </div>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border border-slate-700/50 shadow-inner flex flex-col items-center justify-center p-6 text-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_70%)] animate-pulse pointer-events-none" />

              {!adFinished ? (
                <div className="space-y-3 z-10">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500 to-amber-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Sparkles className="w-7 h-7 text-slate-950 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white tracking-wide">
                      Bütçem Pro Sponsorlu Reklamı
                    </h3>
                    <p className="text-[11px] text-slate-300 font-medium max-w-xs mt-1">
                      Finansal hedeflerinizi büyütün, borçlarınızı sıfırlayın. Reklam bitiminde 24 saatlik tam erişim hakkınız tanımlanacaktır.
                    </p>
                  </div>
                  <div className="w-48 mx-auto bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="bg-amber-400 h-full transition-all duration-1000 ease-linear rounded-full"
                      style={{ width: `${((8 - countdown) / 8) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 z-10 animate-fade-in">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Ödül Kilidi Açıldı! 🎉
                    </h3>
                    <p className="text-[11px] text-emerald-300 font-medium">
                      24 saat boyunca tüm dışa aktarma, içe aktarma ve yapay zeka analiz özellikleri ücretsiz açıldı.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Reward Button */}
            {adFinished ? (
              <button
                type="button"
                onClick={handleClaimReward}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ödülü Al ve Devam Et</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="text-center text-[10px] text-slate-400 font-medium">
                ⏳ Reklamı kapatmadan lütfen sayacın tamamlanmasını bekleyin...
              </div>
            )}
          </div>
        ) : (
          /* Normal Info / Offer Screen Mode */
          <div className="p-6 space-y-6">
            
            {/* Header with gradient icon */}
            <div className="text-center space-y-3">
              <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr ${featureInfo.color} flex items-center justify-center shadow-lg shadow-indigo-500/20`}>
                <FeatureIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase rounded-full tracking-wider border border-amber-500/20 inline-flex items-center gap-1">
                  <Zap className="w-3 h-3" /> 1 GÜNLÜK ÜCRETSİZ ERİŞİM
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1.5">
                  {featureInfo.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                  Misafir ve ziyaretçi kullanıcılarımız için kısa bir video reklamı izleyerek bu özelliği <strong className="text-indigo-600 dark:text-indigo-400">1 tam gün (24 saat)</strong> boyunca sınırsız kullanabilirsiniz.
                </p>
              </div>
            </div>

            {/* Unlocked features card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-amber-500" /> VİDEO İLE 24 SAAT AÇILACAKLAR:
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-bold">
                  <Download className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Veri Dışa Aktarma (Excel, CSV ve JSON Yedekleme)</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-bold">
                  <Upload className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Veri İçe Aktarma (Yedek Geri Yükleme ve Dosya Yükleme)</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-bold">
                  <BrainCircuit className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Yapay Zeka Analizi (Gemini AI Strateji ve Bütçe Tavsiyeleri)</span>
                </div>
              </div>
            </div>

            {/* Pass status if already active */}
            {activePassTime && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>24 Saatlik Erişiminiz Aktif:</span>
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
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlayCircle className="w-4 h-4 text-slate-950 fill-current" />
                <span>Kısa Reklamı İzle & 24 Saat Kilidi Aç</span>
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
                  <span>Reklamsız & Sınırsız Bütçem Pro'ya Geç</span>
                </button>
              )}
            </div>

            {/* Footer trust notice */}
            <div className="text-center text-[9px] text-slate-400 font-medium">
              Google AdMob Güvenli Reklam Ağı • Reklam kimliği: ca-app-pub-4449700232321088/6123306166
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

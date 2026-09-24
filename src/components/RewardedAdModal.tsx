/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
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
  Pause,
  Play,
  RotateCcw
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  ADMOB_CONFIG,
  grant24HourPass,
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

// Official Google IMA / Google Ads sample test video streams
const TEST_VIDEO_SOURCES = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
];

const REQUIRED_WATCH_SECONDS = 10; // 10 seconds required viewing for test rewarded ad

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  onClose,
  targetFeature = "any",
  onRewardGranted,
  onUpgradeClick
}) => {
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [countdown, setCountdown] = useState(REQUIRED_WATCH_SECONDS);
  const [adFinished, setAdFinished] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [activePassTime, setActivePassTime] = useState<string | null>(null);
  const [videoIndex, setVideoIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setIsPlayingAd(false);
      setCountdown(REQUIRED_WATCH_SECONDS);
      setAdFinished(false);
      setVideoProgress(0);
      setIsVideoPaused(false);
      setActivePassTime(getRemainingPassTimeFormatted(targetFeature));
      // Randomize test video source
      setVideoIndex(Math.floor(Math.random() * TEST_VIDEO_SOURCES.length));
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, targetFeature]);

  // Handle Video Time Update and Sync Progress
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const duration = videoRef.current.duration || REQUIRED_WATCH_SECONDS;
    setVideoProgress((current / duration) * 100);

    // If video naturally ended or reached required duration
    if (current >= REQUIRED_WATCH_SECONDS && !adFinished) {
      setAdFinished(true);
      setCountdown(0);
    }
  };

  const handleVideoEnded = () => {
    setAdFinished(true);
    setCountdown(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleStartWatchVideo = () => {
    setIsPlayingAd(true);
    setCountdown(REQUIRED_WATCH_SECONDS);
    setAdFinished(false);
    setVideoProgress(0);

    // Start video playback
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch((e) => {
          console.warn("[RewardedAd] Autoplay prevented, retrying muted:", e);
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }, 100);

    // Countdown timer for required watch duration
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setAdFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPaused(false);
    } else {
      videoRef.current.pause();
      setIsVideoPaused(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleClaimReward = () => {
    // 1. Grant 24-hour pass ONLY to the target feature
    grant24HourPass(targetFeature);

    // 2. High-speed celebratory confetti
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        gravity: 1.1,
        decay: 0.92,
        ticks: 140
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

  if (!isOpen) return null;

  const featureTitleMap: Record<string, { 
    title: string; 
    shortName: string; 
    desc: string; 
    icon: React.ElementType; 
    color: string;
    badge: string;
  }> = {
    report: {
      title: "Finansal Rapor & CSV İndirme",
      shortName: "Finansal Rapor",
      desc: "Tüm gelir, gider, basit/kurumsal borçlar, taksitler ve kişi cari hesaplarını içeren filtreli finansal raporu CSV formatında tek tuşla indirin.",
      icon: FileSpreadsheet,
      color: "from-emerald-600 via-teal-600 to-green-700",
      badge: "SADECE FİNANSAL RAPOR KİLİDİ"
    },
    ai: {
      title: "Yapay Zekâ Finans Danışmanı (Gemini AI)",
      shortName: "Yapay Zeka Analizi",
      desc: "Yapay zeka ile kişiselleştirilmiş bütçe analizi, kartopu borç kapatma stratejileri ve finansal tavsiyeler.",
      icon: BrainCircuit,
      color: "from-indigo-600 via-purple-600 to-indigo-700",
      badge: "SADECE YAPAY ZEKA KİLİDİ"
    },
    export: {
      title: "Veri Dışa Aktarma & Yedekleme",
      shortName: "Dışa Aktarma",
      desc: "Tüm borç, taksit, gelir ve bütçe kayıtlarınızı JSON, CSV, WhatsApp ve Google Drive formatlarında tek tuşla indirin ve paylaşın.",
      icon: Download,
      color: "from-blue-600 via-cyan-600 to-teal-600",
      badge: "SADECE DIŞA AKTARMA KİLİDİ"
    },
    import: {
      title: "Veri İçe Aktarma & Geri Yükleme",
      shortName: "İçe Aktarma",
      desc: "Daha önce aldığınız JSON yedek dosyalarını veya yedek kodlarını sisteme yükleyerek tüm verilerinizi anında geri getirin.",
      icon: Upload,
      color: "from-emerald-600 via-teal-600 to-cyan-700",
      badge: "SADECE İÇE AKTARMA KİLİDİ"
    },
    any: {
      title: "Kısıtlı Finansal Özellik",
      shortName: "Seçili Özellik",
      desc: "Kısa bir Google test video reklamı izleyerek bu özelliği 24 saat boyunca sınırsız kullanın.",
      icon: Gift,
      color: "from-amber-500 to-orange-600",
      badge: "24 SAATLİK ERİŞİM"
    }
  };

  const featureInfo = featureTitleMap[targetFeature] || featureTitleMap.any;
  const FeatureIcon = featureInfo.icon;

  // ==========================================
  // 1. FULLSCREEN REAL VIDEO AD PLAYER
  // ==========================================
  if (isPlayingAd) {
    return (
      <div className="fixed inset-0 z-[100000] w-screen h-screen bg-black text-white flex flex-col justify-between select-none overflow-hidden animate-fade-in">
        
        {/* Top Header Bar with Google AdMob Test Badges & Timer */}
        <div className="relative z-30 flex items-center justify-between w-full px-4 sm:px-6 py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="px-2.5 py-1 bg-amber-500 text-black text-[11px] sm:text-xs font-black uppercase rounded-lg tracking-wider flex items-center gap-1.5 shadow-md">
              <Film className="w-3.5 h-3.5 text-black" /> GOOGLE ADMOB TEST REKLAMI
            </span>
            <span className="text-[11px] text-slate-300 font-mono hidden md:inline bg-black/60 px-2 py-0.5 rounded border border-white/10">
              Unit: {ADMOB_CONFIG.REWARDED_VIDEO_ID}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 text-white bg-black/70 hover:bg-black/90 rounded-xl border border-white/20 transition cursor-pointer"
              title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Countdown / Reward Badge */}
            <div className={`px-3.5 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg border ${
              adFinished 
                ? "bg-emerald-600 text-white border-emerald-400 animate-pulse" 
                : "bg-black/80 text-amber-400 border-amber-500/50"
            }`}>
              {adFinished ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>ÖDÜL HAZIR!</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Ödüle: {countdown} sn</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/20 z-40">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 transition-all duration-300 ease-linear"
            style={{ width: `${Math.min(100, Math.max(videoProgress, ((REQUIRED_WATCH_SECONDS - countdown) / REQUIRED_WATCH_SECONDS) * 100))}%` }}
          />
        </div>

        {/* Center Video Stage (HTML5 Real Video Element) */}
        <div className="relative z-10 flex-1 flex items-center justify-center w-full h-full max-h-[85vh] mx-auto overflow-hidden">
          <video
            ref={videoRef}
            src={TEST_VIDEO_SOURCES[videoIndex]}
            autoPlay
            playsInline
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            className="w-full h-full object-contain max-h-[85vh] drop-shadow-2xl cursor-pointer"
            onClick={toggleVideoPlay}
          />

          {/* Test Ad Watermark Overlay on top of video */}
          <div className="absolute top-16 left-4 sm:left-8 pointer-events-none z-20 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] sm:text-xs font-mono font-bold text-white uppercase tracking-wider">
              Google Test Video Stream • 1080p HD
            </span>
          </div>

          {/* Feature Badge Overlay */}
          <div className="absolute bottom-6 left-4 sm:left-8 pointer-events-none z-20 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 max-w-xs sm:max-w-sm hidden sm:flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${featureInfo.color} flex items-center justify-center shrink-0`}>
              <FeatureIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                Açılacak Özellik
              </div>
              <div className="text-xs font-black text-white line-clamp-1">
                {featureInfo.title} (24 Saat)
              </div>
            </div>
          </div>

          {/* Play/Pause Overlay indicator when paused */}
          {isVideoPaused && (
            <div 
              onClick={toggleVideoPlay}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center cursor-pointer z-25"
            >
              <div className="p-5 rounded-full bg-amber-500 text-black shadow-2xl animate-scale-up">
                <Play className="w-10 h-10 fill-current" />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control & Claim Bar */}
        <div className="relative z-30 w-full px-4 sm:px-8 py-4 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="max-w-3xl mx-auto">
            {adFinished ? (
              <button
                type="button"
                onClick={handleClaimReward}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm sm:text-base rounded-2xl shadow-2xl shadow-emerald-500/40 transition active:scale-95 flex items-center justify-center gap-3 cursor-pointer border border-emerald-300 animate-bounce"
              >
                <Award className="w-5 h-5 text-amber-300" />
                <span>🎉 Video Tamamlandı! {featureInfo.shortName} Özelliğini 24 Saat Aç</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-full py-3 px-4 bg-black/80 border border-white/10 rounded-2xl text-center text-xs text-slate-300 font-medium flex items-center justify-between gap-2 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-amber-300 font-bold">Google Test Reklamı Oynatılıyor...</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Kalan: <strong className="text-white font-mono">{countdown} saniye</strong>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  // ==========================================
  // 2. MODAL PREVIEW SCREEN (BEFORE AD STARTS)
  // ==========================================
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
          {/* Header with feature icon */}
          <div className="text-center space-y-3">
            <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr ${featureInfo.color} flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white`}>
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

          {/* Ad Policy / Specific unlock rule notice */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>ÖZELLİK BAZLI REKLAM KURALI:</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Her kısıtlı özellik için <strong className="text-slate-900 dark:text-slate-200 font-bold">ayrı 1 video reklam</strong> izlenir. Bu video izlendiğinde <u>sadece {featureInfo.shortName}</u> özelliği 24 saatliğine (1 tam gün) açılır.
            </p>
          </div>

          {/* Active pass status indicator if already unlocked */}
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

          {/* Video Start Action Button */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleStartWatchVideo}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 text-slate-950 fill-current" />
              <span>Google Video Reklamını Başlat & Aç (24 Saat)</span>
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
                <span>Reklamsız & Sınırsız PRO'ya Geç</span>
              </button>
            )}
          </div>

          {/* Google AdMob Unit Notice */}
          <div className="text-center text-[9px] text-slate-400 font-medium">
            Google AdMob Güvenli Test Reklam Ağı • Birim ID: {ADMOB_CONFIG.REWARDED_VIDEO_ID}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, ShieldCheck, Activity, AlertCircle } from "lucide-react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  BannerAdPluginEvents
} from "@capacitor-community/admob";
import { ADMOB_CONFIG, initNativeAdMobSdk } from "../utils/rewardedAdService";
import { useAuth } from "../context/AuthContext";

interface AdMobBannerProps {
  unitType?: "banner" | "native" | "interstitial";
  className?: string;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  unitType = "banner",
  className = ""
}) => {
  const auth = useAuth();
  const [localPrem, setLocalPrem] = useState(() => {
    return localStorage.getItem("is_premium") === "true" && localStorage.getItem("premium_source") !== "trial" && localStorage.getItem("is_guest") !== "true";
  });
  const [localTrialActive, setLocalTrialActive] = useState(() => {
    const end = localStorage.getItem("trial_end_date");
    const endMs = end ? new Date(end).getTime() : 0;
    const isG = localStorage.getItem("is_guest") === "true";
    return !isG && !isNaN(endMs) && Date.now() < endMs;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check premium and trial status dynamically
  useEffect(() => {
    const checkStatus = () => {
      const isSuper = (localStorage.getItem("currentUser") || "").toLowerCase().trim() === "info.borcodemetakip@gmail.com";
      const nextPrem = isSuper || (localStorage.getItem("is_premium") === "true" && localStorage.getItem("premium_source") !== "trial" && localStorage.getItem("is_guest") !== "true");
      setLocalPrem(nextPrem);

      const end = localStorage.getItem("trial_end_date");
      const endMs = end ? new Date(end).getTime() : 0;
      const isG = localStorage.getItem("is_guest") === "true";
      const nextTrial = !nextPrem && !isG && !isNaN(endMs) && Date.now() < endMs;
      setLocalTrialActive(nextTrial);
    };
    checkStatus();

    window.addEventListener("storage", checkStatus);
    window.addEventListener("premium_status_changed", checkStatus);

    return () => {
      window.removeEventListener("storage", checkStatus);
      window.removeEventListener("premium_status_changed", checkStatus);
    };
  }, []);

  const isPremium = auth?.isPremium || localPrem;
  const isTrialActive = auth?.isTrialActive || localTrialActive;

  // Initialize AdMob Banner (Native Capacitor + Web AdSense with official test IDs)
  useEffect(() => {
    if (isPremium || isTrialActive) return;

    let isMounted = true;
    const listeners: PluginListenerHandle[] = [];

    const setupBanner = async () => {
      setIsLoading(true);
      setAdError(false);

      // 1. CAPACITOR NATIVE ANDROID/IOS RUNTIME
      if (Capacitor.isNativePlatform()) {
        try {
          await initNativeAdMobSdk();

          // Register native BannerAdPluginEvents listeners
          const loadedHandle = await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
            if (isMounted) {
              console.log("[AdMob Native Banner] Loaded event received.");
              setAdLoaded(true);
              setIsLoading(false);
              setAdError(false);
            }
          });
          listeners.push(loadedHandle);

          const failedHandle = await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
            console.warn("[AdMob Native Banner] FailedToLoad event:", err);
            if (isMounted) {
              setAdLoaded(false);
              setIsLoading(false);
              setAdError(true);
              setErrorMessage(err?.message || "Test reklamı yüklenemedi");
            }
          });
          listeners.push(failedHandle);

          // Invoke showBanner with official Google test ID and BOTTOM_CENTER position
          await AdMob.showBanner({
            adId: ADMOB_CONFIG.BANNER_ID,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: true, // Açıkça isTesting: true belirtildi
          });

          if (isMounted) {
            // Assume loaded if showBanner resolved without exception
            setIsLoading(false);
            setAdLoaded(true);
          }
          return;
        } catch (nativeErr: any) {
          console.warn("[AdMob Native Banner] showBanner call error:", nativeErr);
          if (isMounted) {
            setAdError(true);
            setIsLoading(false);
            setErrorMessage(nativeErr?.message || "Native AdMob servisine bağlanılamadı.");
          }
        }
      }

      // 2. WEB / BROWSER ENVIRONMENT (AdSense / Responsive Web Unit)
      const timer = setTimeout(() => {
        try {
          const ads = document.querySelectorAll("ins.adsbygoogle");
          ads.forEach((ad) => {
            if (ad.getAttribute("data-adsbygoogle-status") !== "done") {
              try {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
                if (isMounted) {
                  setIsLoading(false);
                  setAdLoaded(true);
                }
              } catch (adPushErr) {
                console.warn("[AdMob Web Banner] Ad push error:", adPushErr);
                if (isMounted) {
                  setIsLoading(false);
                  setAdError(true);
                }
              }
            } else {
              if (isMounted) {
                setIsLoading(false);
                setAdLoaded(true);
              }
            }
          });
        } catch (err: any) {
          console.warn("[AdMob Web Banner] Init error:", err);
          if (isMounted) {
            setIsLoading(false);
            setAdError(true);
          }
        }
      }, 500);

      // Web Fallback timeout (detect if script is blocked by ad blocker)
      const fallbackTimer = setTimeout(() => {
        if (isMounted && !adLoaded) {
          const insEl = document.querySelector("ins.adsbygoogle");
          if (!insEl || insEl.innerHTML.trim() === "") {
            setIsLoading(false);
            setAdError(true);
          }
        }
      }, 2500);

      return () => {
        clearTimeout(timer);
        clearTimeout(fallbackTimer);
      };
    };

    setupBanner();

    return () => {
      isMounted = false;
      for (const handle of listeners) {
        try {
          handle.remove();
        } catch {
          // Safe fallback
        }
      }
    };
  }, [isPremium, isTrialActive, unitType]);

  // KESİN KURAL 3: Hiçbir sayfada veya alt kısımda hiçbir reklam (Banner, Interstitial vb.) gösterilmemeli
  if (isPremium || isTrialActive) return null;

  const clientPub = `ca-${ADMOB_CONFIG.PUBLISHER_ID}`;
  const slotId = unitType === "interstitial" ? ADMOB_CONFIG.INTERSTITIAL_SLOT : ADMOB_CONFIG.BANNER_SLOT;

  return (
    <div className={`w-full overflow-hidden my-1 ${className}`}>
      {/* Google AdMob Standard Test Banner Container */}
      <div className="relative w-full p-2.5 bg-slate-900/95 dark:bg-slate-950/95 rounded-xl border border-slate-700/80 shadow-md text-white">
        {/* AdMob Official Test Badge Header */}
        <div className="flex items-center justify-between mb-1.5 px-0.5 select-none">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-wider rounded border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Test Reklamı
            </span>
            <span className="text-[9.5px] font-mono font-bold text-slate-300">
              Google AdMob
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8.5px] font-mono text-slate-400">ca-app-pub-394025...</span>
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-serif font-black" title="Google Ads Seçenekleri">
              i
            </div>
          </div>
        </div>

        {/* Ad Content Container */}
        <div className="w-full relative min-h-[50px] flex items-center justify-between gap-3 bg-gradient-to-r from-slate-800/90 via-slate-800/60 to-slate-800/90 rounded-lg p-2.5 border border-slate-700/50">
          {/* Web Ins Element (when AdSense pushes live iframe) */}
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: "50px", position: "absolute", inset: 0, opacity: adLoaded ? 1 : 0, zIndex: adLoaded ? 20 : 0 }}
            data-ad-client={clientPub}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />

          {/* Test Ad Display Mockup (Shown when in web preview or test mode) */}
          <div className="flex items-center gap-2.5 min-w-0 z-10">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0">
              ⚡
            </div>
            <div className="min-w-0 text-left">
              <h4 className="text-xs font-black text-slate-100 truncate flex items-center gap-1.5">
                <span>Bütçem Pro — Akıllı Finans Asistanı</span>
                <span className="text-[8px] bg-slate-700 text-amber-300 px-1 rounded font-mono">Ad</span>
              </h4>
              <p className="text-[10px] text-slate-300 font-medium truncate mt-0.5">
                Borçlarınızı kartopu ve çığ yöntemi ile kolayca takip edip eritin.
              </p>
            </div>
          </div>

          <div className="shrink-0 z-10">
            <button
              type="button"
              className="px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-[10px] rounded-lg shadow-xs hover:brightness-110 active:scale-95 transition"
            >
              Yükle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, ShieldCheck, Activity, AlertCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  BannerAdPluginEvents,
  PluginListenerHandle
} from "@capacitor-community/admob";
import { ADMOB_CONFIG, initNativeAdMobSdk } from "../utils/rewardedAdService";

interface AdMobBannerProps {
  unitType?: "banner" | "native" | "interstitial";
  className?: string;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  unitType = "banner",
  className = ""
}) => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check premium status dynamically
  useEffect(() => {
    const checkStatus = () => {
      const nextPrem = localStorage.getItem("is_premium") === "true";
      setIsPremium((prev) => (prev !== nextPrem ? nextPrem : prev));
    };
    checkStatus();

    window.addEventListener("storage", checkStatus);
    window.addEventListener("premium_status_changed", checkStatus);

    return () => {
      window.removeEventListener("storage", checkStatus);
      window.removeEventListener("premium_status_changed", checkStatus);
    };
  }, []);

  // Initialize AdMob Banner (Native Capacitor + Web AdSense with official test IDs)
  useEffect(() => {
    if (isPremium) return;

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
  }, [isPremium, unitType]);

  // Premium users do not see ads
  if (isPremium) return null;

  const clientPub = `ca-${ADMOB_CONFIG.PUBLISHER_ID}`;
  const slotId = unitType === "interstitial" ? ADMOB_CONFIG.INTERSTITIAL_SLOT : ADMOB_CONFIG.BANNER_SLOT;

  return (
    <div className={`w-full overflow-hidden my-3 ${className}`}>
      {/* 1. KAPSAYICI CSS BOYUTLANDIRMASI: min-height 60px, width 100%, modern tema uyumlu arka plan (saf siyah yerine bg-slate-800/80) */}
      <div 
        className="relative p-3 sm:p-4 bg-slate-800/80 dark:bg-slate-900/90 rounded-2xl border border-slate-700/60 dark:border-slate-800 shadow-md text-white w-full"
        style={{ minHeight: "60px", width: "100%" }}
      >
        {/* Ad Header Label */}
        <div className="flex items-center justify-between mb-2 select-none">
          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider rounded border border-indigo-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" /> GOOGLE ADMOB TEST ALANI
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            TEST MODE: AKTİF
          </span>
        </div>

        {/* Ad Body Container with min-height: 60px and relative positioning */}
        <div 
          className="w-full flex flex-col items-center justify-center bg-slate-950/40 rounded-xl p-2 relative z-10 border border-slate-700/40"
          style={{ minHeight: "60px", width: "100%" }}
        >
          {/* Skeleton Loader / Yükleniyor Durumu */}
          {isLoading && !adLoaded && !adError && (
            <div className="flex items-center gap-2 py-2 text-xs font-bold text-slate-300 animate-pulse">
              <Activity className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Reklam Yükleniyor...</span>
            </div>
          )}

          {/* Web Ins Element for Responsive AdSense */}
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: "60px" }}
            data-ad-client={clientPub}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />

          {/* Native Active Indicator or Fallback Placeholder */}
          {Capacitor.isNativePlatform() && adLoaded && (
            <div className="w-full py-2 px-3 flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-bold">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Google AdMob Banner Aktif (Alt Konum)</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 bg-emerald-500/20 rounded font-mono text-emerald-200">
                OFFICIAL TEST ID
              </span>
            </div>
          )}

          {/* Test Ad Simulator Fallback Banner if ad script is blocked or fails to load */}
          {adError && (
            <div className="w-full py-2.5 px-3 flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 rounded-lg border border-indigo-500/30 text-center animate-fade-in">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10.5px] font-bold text-indigo-200">
                    Bütçem Pro Test Banner (isTesting: true)
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {errorMessage || "Reklam yüklenemedi veya engellendi. Test modu simülasyonu devrede."}
                  </p>
                </div>
              </div>
              <span className="text-[8.5px] font-black font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md shrink-0">
                TEST BANNER
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, ShieldCheck, Activity } from "lucide-react";
import { ADMOB_CONFIG } from "../utils/rewardedAdService";
import { Capacitor } from "@capacitor/core";

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
  const adInited = useRef(false);

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

  // Initialize AdMob Banner (Web / Capacitor Native integration with isTesting: true)
  useEffect(() => {
    if (isPremium) return;

    let isMounted = true;
    setIsLoading(true);

    // 1. Check if running in Capacitor Native with AdMob plugin available
    const initNativeAdMob = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Dynamic import or check for Capacitor AdMob plugin
          const admobModule = (window as any).Capacitor?.Plugins?.AdMob;
          if (admobModule) {
            await admobModule.initialize({ requestTrackingAuthorization: true });
            
            // Add event listeners for Loaded and FailedToLoad
            if (admobModule.addListener) {
              admobModule.addListener("bannerAdLoaded", () => {
                if (isMounted) {
                  setIsLoading(false);
                  setAdLoaded(true);
                }
              });
              admobModule.addListener("bannerAdFailedToLoad", (err: any) => {
                console.warn("[AdMob Native] FailedToLoad:", err);
                if (isMounted) {
                  setIsLoading(false);
                  setAdError(true);
                }
              });
            }

            await admobModule.showBanner({
              adId: ADMOB_CONFIG.BANNER_ID,
              position: "BOTTOM_CENTER",
              size: "BANNER",
              margin: 0,
              isTesting: true, // Açıkça isTesting true belirtildi
              autoShow: true,
            });
            return;
          }
        } catch (nativeErr) {
          console.warn("[AdMob Native] Plugin not found or error, falling back to Web/HTML banner:", nativeErr);
        }
      }

      // 2. Web / AdSense HTML fallback initialization
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
                console.warn("[AdMob Web] Ad push error:", adPushErr);
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
          adInited.current = true;
        } catch (err) {
          console.warn("[AdMob Web] Init error:", err);
          if (isMounted) {
            setIsLoading(false);
            setAdError(true);
          }
        }
      }, 600);

      // Fallback check if script is blocked by ad blocker
      const fallbackTimer = setTimeout(() => {
        if (isMounted) {
          const insEl = document.querySelector("ins.adsbygoogle");
          if (!adLoaded && (!insEl || insEl.innerHTML.trim() === "")) {
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

    initNativeAdMob();

    return () => {
      isMounted = false;
    };
  }, [isPremium, unitType]);

  // Premium users do not see ads
  if (isPremium) return null;

  const clientPub = `ca-${ADMOB_CONFIG.PUBLISHER_ID}`;
  const slotId = unitType === "interstitial" ? ADMOB_CONFIG.INTERSTITIAL_SLOT : ADMOB_CONFIG.BANNER_SLOT;

  return (
    <div className={`w-full overflow-hidden my-3 ${className}`}>
      {/* Container CSS Sizing: min-height 60px, width 100%, card-matching background (bg-slate-800/80 dark:bg-slate-950/90) avoiding pure black boxes */}
      <div className="relative p-3 sm:p-4 bg-slate-800/80 dark:bg-slate-900/90 rounded-2xl border border-slate-700/60 dark:border-slate-800 shadow-md text-white w-full min-h-[70px]">
        
        {/* Ad Header Label */}
        <div className="flex items-center justify-between mb-2 select-none">
          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider rounded border border-indigo-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" /> GOOGLE TEST REKLAM ALANI
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            ADMOB (TEST: TRUE)
          </span>
        </div>

        {/* Ad Body Container with min-height and relative positioning */}
        <div className="w-full min-h-[60px] overflow-hidden flex flex-col items-center justify-center bg-slate-950/40 rounded-xl p-2 relative z-10 border border-slate-700/40">
          
          {/* Skeleton Loader / Yükleniyor Durumu */}
          {isLoading && !adLoaded && !adError && (
            <div className="flex items-center gap-2 py-2 text-xs font-bold text-slate-300 animate-pulse">
              <Activity className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Reklam Yükleniyor...</span>
            </div>
          )}

          {/* AdSense / Web Ins Element */}
          <ins 
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: "60px" }}
            data-ad-client={clientPub}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />

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
                    Reklam yer tutucu aktif. Canlı ortamda test banner başarıyla yüklenecektir.
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

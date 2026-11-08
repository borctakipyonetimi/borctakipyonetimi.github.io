/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, ShieldCheck, ExternalLink } from "lucide-react";
import { ADMOB_CONFIG } from "../utils/rewardedAdService";

interface AdMobBannerProps {
  unitType?: "banner" | "native" | "interstitial";
  className?: string;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  unitType = "banner",
  className = ""
}) => {
  const [isPremium, setIsPremium] = useState(false);
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

  // Initialize Google AdMob Test Banner with robust error management & load check
  useEffect(() => {
    if (isPremium) return;

    const timer = setTimeout(() => {
      try {
        const ads = document.querySelectorAll("ins.adsbygoogle");
        ads.forEach((ad) => {
          if (ad.getAttribute("data-adsbygoogle-status") !== "done") {
            try {
              ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
              setAdLoaded(true);
            } catch (adPushErr) {
              console.warn("[AdMob Test Banner] Ad push caught:", adPushErr);
              setAdError(true);
            }
          } else {
            setAdLoaded(true);
          }
        });
        adInited.current = true;
      } catch (err) {
        console.warn("[AdMob Test Banner] Init error:", err);
        setAdError(true);
      }
    }, 500);

    // Fallback check if ad blocker prevents adsbygoogle from filling
    const fallbackTimer = setTimeout(() => {
      const insEl = document.querySelector("ins.adsbygoogle");
      if (insEl && insEl.innerHTML.trim() === "") {
        setAdError(true);
      }
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, [isPremium, unitType]);

  // Premium users do not see ads
  if (isPremium) return null;

  const clientPub = `ca-${ADMOB_CONFIG.PUBLISHER_ID}`;
  const slotId = unitType === "interstitial" ? ADMOB_CONFIG.INTERSTITIAL_SLOT : ADMOB_CONFIG.BANNER_SLOT;

  return (
    <div className={`w-full overflow-hidden my-3 ${className}`}>
      <div className="relative p-3 sm:p-4 bg-slate-900/95 dark:bg-[#0b0f19] rounded-2xl border border-slate-800/80 shadow-md text-white">
        
        {/* Ad Header Label */}
        <div className="flex items-center justify-between mb-2 select-none">
          <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded border border-indigo-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" /> GOOGLE TEST REKLAM ALANI
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            ADMIX / ADMOB
          </span>
        </div>

        {/* Live / Test Google AdMob Responsive Unit */}
        <div className="w-full overflow-hidden flex flex-col items-center justify-center min-h-[90px] bg-slate-950/75 rounded-xl p-2 relative z-10 border border-slate-800/50">
          <ins 
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: "90px" }}
            data-ad-client={clientPub}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />

          {/* Test Ad Simulator Fallback Banner if ad script is blocked by extension */}
          {adError && (
            <div className="w-full py-3 px-4 flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 rounded-lg border border-indigo-500/30 text-center animate-fade-in">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-indigo-200">
                    Bütçem Pro Test Banner (Google Test ID Aktif)
                  </p>
                  <p className="text-[9.5px] text-slate-400">
                    Reklam engelleyici aktif veya script yüklenemedi. Test modu simülasyonu devrede.
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-black font-mono bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md shrink-0">
                DEV TEST
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

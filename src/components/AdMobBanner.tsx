/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
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

  // Initialize official Google AdSense / AdMob responsive banner units
  useEffect(() => {
    if (isPremium) return;

    const delay = setTimeout(() => {
      try {
        const ads = document.querySelectorAll("ins.adsbygoogle");
        ads.forEach((ad) => {
          if (ad.getAttribute("data-adsbygoogle-status") !== "done") {
            try {
              ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
              setAdLoaded(true);
            } catch (adPushErr) {
              // Handled by AdSense script
            }
          }
        });
        adInited.current = true;
      } catch (err) {
        console.warn("[AdMob] Banner initialization status:", err);
      }
    }, 500);

    return () => clearTimeout(delay);
  }, [isPremium, unitType]);

  // Premium users do not see ads
  if (isPremium) return null;

  return (
    <div className={`w-full overflow-hidden my-3 ${className}`}>
      <div className="relative p-3 sm:p-4 bg-slate-900/90 dark:bg-[#0b0f19] rounded-2xl border border-slate-800 shadow-md text-white">
        
        {/* Google AdMob Official Header Label */}
        <div className="flex items-center justify-between mb-2.5 select-none">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> GOOGLE ADMOB TEST REKLAMI
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              Slot: {ADMOB_CONFIG.BANNER_SLOT}
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            REKLAM • AD
          </span>
        </div>

        {/* Live Google AdSense / AdMob Responsive Unit */}
        <div className="w-full overflow-hidden flex items-center justify-center min-h-[90px] bg-slate-950/80 rounded-xl border border-dashed border-slate-700/80 p-2 relative z-10 transition">
          <ins 
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: "90px" }}
            data-ad-client="ca-pub-4449700232321088"
            data-ad-slot="6318747286"
            data-ad-format="auto"
            data-full-width-responsive="true"
            data-adtest="on"
          />

          {/* Test Ad Info Watermark (Compliant with Google AdMob Testing) */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-center p-2 opacity-85">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black tracking-wide">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Google AdMob Test Reklam Birimi</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {ADMOB_CONFIG.BANNER_ID}
            </div>
            <div className="text-[9px] text-slate-400 mt-1">
              Test Modu Aktif • Gerçek AdMob Kampanyaları Canlı Sürümde Yayınlanır
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

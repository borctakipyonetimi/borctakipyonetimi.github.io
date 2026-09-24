/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";

interface AdMobBannerProps {
  unitType?: "banner" | "native" | "interstitial";
  className?: string;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  unitType = "banner",
  className = ""
}) => {
  const [isPremium, setIsPremium] = useState(false);
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

  // Initialize live Google AdSense / AdMob responsive banner units
  useEffect(() => {
    if (isPremium) return;

    const delay = setTimeout(() => {
      try {
        const ads = document.querySelectorAll("ins.adsbygoogle");
        ads.forEach((ad) => {
          if (ad.getAttribute("data-adsbygoogle-status") !== "done") {
            try {
              ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            } catch (adPushErr) {
              // Handled by AdSense script
            }
          }
        });
        adInited.current = true;
      } catch (err) {
        console.warn("[AdMob] Live banner init:", err);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [isPremium, unitType]);

  // Premium users do not see ads
  if (isPremium) return null;

  return (
    <div className={`w-full overflow-hidden my-3 ${className}`}>
      <div className="relative p-2.5 sm:p-3.5 bg-slate-900/90 dark:bg-[#0b0f19] rounded-2xl border border-slate-800 shadow-md text-white">
        
        {/* Ad Header Label */}
        <div className="flex items-center justify-between mb-2 select-none">
          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded border border-amber-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> SPONSORLU REKLAM
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            REKLAM
          </span>
        </div>

        {/* Live Google AdSense / AdMob Responsive Unit (Direct Live Real Ads) */}
        <div className="w-full overflow-hidden flex items-center justify-center min-h-[90px] bg-slate-950/60 rounded-xl p-1 relative z-10">
          <ins 
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: "90px" }}
            data-ad-client="ca-pub-4449700232321088"
            data-ad-slot="6318747286"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>

      </div>
    </div>
  );
};

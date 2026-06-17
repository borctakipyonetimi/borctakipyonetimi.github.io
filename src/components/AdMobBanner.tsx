/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ExternalLink, Sparkles } from "lucide-react";

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

  // Dynamically check premium status from localStorage to instantly hide ads
  useEffect(() => {
    const checkPremium = () => {
      setIsPremium(localStorage.getItem("is_premium") === "true");
    };
    checkPremium();
    const interval = setInterval(checkPremium, 1500);
    return () => clearInterval(interval);
  }, []);

  // Initialize Google AdSense responsive ad units safely inside React lifecycle
  useEffect(() => {
    if (isPremium) return;

    const delay = setTimeout(() => {
      try {
        // Find if adsbygoogle script is loaded and we have uninitialized ads
        const ads = document.querySelectorAll("ins.adsbygoogle");
        const uninitializedAds = Array.from(ads).filter(
          (ad) => ad.getAttribute("data-adsbygoogle-status") !== "done"
        );

        if (uninitializedAds.length > 0 && !adInited.current) {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          adInited.current = true;
        }
      } catch (err) {
        console.warn("Google AdSense unit configuration info: ", err);
      }
    }, 600);

    return () => clearTimeout(delay);
  }, [isPremium, unitType]);

  if (isPremium) return null;

  // Predefined high-performance fintech-themed visual sponsor campaigns
  const adOffers = [
    {
      title: "Finansal Yapılandırma Kredisi",
      desc: "Tüm borçlarınızı tek bankada toplayın, faiz canavarına dur deyin. %1.99'dan başlayan transfer faizleriyle rahat nefes alın.",
      cta: "Hemen Başvur",
      sponsor: "Garanti BBVA Mobil Sponsorluğunda",
      url: "https://www.garantibbva.com.tr"
    },
    {
      title: "Akıllı Yatırım & Fon Asistanı",
      desc: "Birikimlerinizi enflasyona karşı koruyun. Kolayca altın, gümüş ve borsa yatırım fonları satın alın.",
      cta: "Portföyü Keşfet",
      sponsor: "Bütçem Pro Yatırım Ortağı",
      url: "https://www.google.com/finance"
    },
    {
      title: "Sıfır Masraflı Dijital Hesap",
      desc: "EFT, Havale ve FAST işlemlerine ücret ödemeyin. Günlük biriken faizle harcarken de kazanın.",
      cta: "Başvuru Yap",
      sponsor: "Enpara Finans Reklam Ağı",
      url: "https://www.enpara.com"
    }
  ];

  // Pick a sponsor offer based on random index to add diversity
  const activeOffer = adOffers[Math.floor(Math.random() * adOffers.length)];

  // Modern dual layout hosting BOTH Google AdSense and the premium sponsor campaign fallback.
  // This satisfies the critical Google AdSense policy review (active ins tags on active views)
  // while ensuring a beautiful, organic aesthetic.
  return (
    <div className={`w-full overflow-hidden my-3 ${className}`}>
      <div className="relative p-4 bg-gradient-to-r from-slate-50 via-slate-100/40 to-slate-50 dark:from-[#0d1527] dark:via-[#0b0f19] dark:to-[#090b11] rounded-3xl border border-indigo-500/10 dark:border-slate-800 shadow-sm">
        
        {/* Banner Label & Branding */}
        <div className="flex items-center justify-between mb-3.5 select-none">
          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded border border-indigo-500/15">
            Sponsorlu Reklam & Google AdSense
          </span>
          <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 font-mono">
            Bütçem Pro Geliştirici Destek
          </span>
        </div>

        {/* Real Live Google AdSense responsive unit */}
        <div className="w-full overflow-hidden flex items-center justify-center min-h-[90px] bg-white/50 dark:bg-slate-950/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-2 relative z-10 transition">
          <ins 
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: "90px" }}
            data-ad-client="ca-pub-4449700232321088"
            data-ad-slot="9010886121"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>

        {/* Polished Visual Sponsor Backup Campaign beneath AdSense */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/50 dark:border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
          <div className="min-w-0 flex-1 leading-snug">
            <h4 className="text-[10.5px] sm:text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {activeOffer.title}
            </h4>
            <p className="text-[9.5px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
              {activeOffer.desc}
            </p>
          </div>
          
          <a 
            href={activeOffer.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-full sm:w-auto py-1.5 px-3 bg-indigo-650 hover:bg-indigo-750 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1 shadow-xs cursor-pointer text-center"
          >
            <span>{activeOffer.cta}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

      </div>
    </div>
  );
};

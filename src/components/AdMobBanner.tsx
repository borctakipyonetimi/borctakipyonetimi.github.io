/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  AdMob,
  BannerAdPluginEvents,
  type AdMobBannerSize
} from "@capacitor-community/admob";
import {
  ADMOB_CONFIG,
  showNativeBannerAd,
  hideNativeBannerAd
} from "../utils/rewardedAdService";
import { useAuth } from "../context/AuthContext";

interface AdMobBannerProps {
  unitType?: "banner" | "native" | "interstitial";
  placement?: "inline" | "bottom-dock";
  className?: string;
  onUpgradeClick?: () => void;
  upgradeLabel?: string;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  unitType = "banner",
  placement = "inline",
  className = "",
  onUpgradeClick,
  upgradeLabel = "Reklamları Kaldır 💎 Bütçem Pro'ya Geç"
}) => {
  const auth = useAuth();
  const isNative = Capacitor.isNativePlatform();
  const insRef = useRef<HTMLModElement | null>(null);

  const [localPrem, setLocalPrem] = useState(() => {
    return (
      localStorage.getItem("is_premium") === "true" &&
      localStorage.getItem("premium_source") !== "trial" &&
      localStorage.getItem("is_guest") !== "true"
    );
  });
  const [localTrialActive, setLocalTrialActive] = useState(() => {
    const end = localStorage.getItem("trial_end_date");
    const endMs = end ? new Date(end).getTime() : 0;
    const isG = localStorage.getItem("is_guest") === "true";
    return !isG && !isNaN(endMs) && Date.now() < endMs;
  });

  const [adLoaded, setAdLoaded] = useState(false);
  const [adUnfilled, setAdUnfilled] = useState(false);
  const [nativeBannerHeight, setNativeBannerHeight] = useState<number>(56);

  // Check premium and trial status dynamically
  useEffect(() => {
    const checkStatus = () => {
      const isSuper =
        (localStorage.getItem("currentUser") || "").toLowerCase().trim() ===
        "info.borcodemetakip@gmail.com";
      const nextPrem =
        isSuper ||
        (localStorage.getItem("is_premium") === "true" &&
          localStorage.getItem("premium_source") !== "trial" &&
          localStorage.getItem("is_guest") !== "true");
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
    window.addEventListener("auth_state_changed", checkStatus);

    return () => {
      window.removeEventListener("storage", checkStatus);
      window.removeEventListener("premium_status_changed", checkStatus);
      window.removeEventListener("auth_state_changed", checkStatus);
    };
  }, []);

  const isPremium = auth?.isPremium || localPrem;
  const isTrialActive = auth?.isTrialActive || localTrialActive;

  // Initialize Real Google AdMob Banner (Native Android/iOS) or Live Web AdSense Unit
  useEffect(() => {
    if (isPremium || isTrialActive) {
      if (isNative) {
        hideNativeBannerAd().catch(() => {});
      }
      return;
    }

    let isMounted = true;
    const listeners: PluginListenerHandle[] = [];

    // 1. CAPACITOR NATIVE ANDROID/IOS RUNTIME (Genuine Google AdMob Test Banner)
    if (isNative) {
      const setupNativeBanner = async () => {
        try {
          const loadedHandle = await AdMob.addListener(
            BannerAdPluginEvents.Loaded,
            () => {
              if (isMounted) {
                setAdLoaded(true);
                setAdUnfilled(false);
              }
            }
          );
          listeners.push(loadedHandle);

          const sizeHandle = await AdMob.addListener(
            BannerAdPluginEvents.SizeChanged,
            (size: AdMobBannerSize) => {
              if (isMounted && size?.height > 0) {
                setNativeBannerHeight(size.height);
                setAdLoaded(true);
                setAdUnfilled(false);
              }
            }
          );
          listeners.push(sizeHandle);

          const failedHandle = await AdMob.addListener(
            BannerAdPluginEvents.FailedToLoad,
            () => {
              if (isMounted) {
                setAdLoaded(false);
                setAdUnfilled(true);
              }
            }
          );
          listeners.push(failedHandle);

          const shown = await showNativeBannerAd();
          if (isMounted && shown) {
            setAdLoaded(true);
            setAdUnfilled(false);
          }
        } catch (nativeErr) {
          console.warn("[AdMob Native Banner] setup error:", nativeErr);
          if (isMounted) {
            setAdUnfilled(true);
          }
        }
      };

      setupNativeBanner();

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
    }

    // 2. WEB / BROWSER ENVIRONMENT (Strict live Google AdSense / AdMob Web element, NO fake static placeholders)
    const insEl = insRef.current;
    if (!insEl) return;

    let observer: MutationObserver | null = null;
    setAdUnfilled(false);

    const evaluateInsState = () => {
      if (!isMounted || !insEl) return;
      const status = insEl.getAttribute("data-ad-status");
      const hasIframe = Boolean(insEl.querySelector("iframe"));
      if (status === "filled" || (hasIframe && insEl.offsetHeight > 10)) {
        setAdLoaded(true);
        setAdUnfilled(false);
      } else if (status === "unfilled") {
        setAdLoaded(false);
        setAdUnfilled(true);
      }
    };

    observer = new MutationObserver(() => {
      evaluateInsState();
    });
    observer.observe(insEl, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["data-ad-status", "data-adsbygoogle-status"]
    });

    const pushTimer = setTimeout(() => {
      try {
        if (insEl.getAttribute("data-adsbygoogle-status") !== "done") {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        }
        evaluateInsState();
      } catch {
        if (isMounted) {
          setAdUnfilled(true);
        }
      }
    }, 350);

    // If no genuine ad iframe fills within timeout, collapse cleanly instead of showing a fake placeholder
    const fallbackTimer = setTimeout(() => {
      if (!isMounted) return;
      const status = insEl.getAttribute("data-ad-status");
      const hasIframe = Boolean(insEl.querySelector("iframe"));
      if (status !== "filled" && (!hasIframe || insEl.offsetHeight <= 10)) {
        setAdLoaded(false);
        setAdUnfilled(true);
      }
    }, 2600);

    return () => {
      isMounted = false;
      clearTimeout(pushTimer);
      clearTimeout(fallbackTimer);
      if (observer) observer.disconnect();
    };
  }, [isPremium, isTrialActive, isNative, unitType]);

  // KESİN KURAL 3: Premium ve aktif 7 günlük deneme kullanıcılarına HİÇBİR reklam gösterilmez
  if (isPremium || isTrialActive) return null;

  // Native Android/iOS:
  // @capacitor-community/admob renders real AdView banner (ca-app-pub-3940256099942544/6300978111) natively at BOTTOM_CENTER.
  // Inline mid-page slots do NOT render static fake banners on native.
  if (isNative) {
    if (placement !== "bottom-dock" || adUnfilled) {
      return null;
    }
    return (
      <div
        aria-label="Google AdMob Test Banner"
        data-admob-unit={ADMOB_CONFIG.BANNER_ID}
        className={`w-full bg-[#0f172a] border-t border-slate-800/80 transition-all duration-200 ${className}`}
        style={{ height: `${Math.max(50, nativeBannerHeight)}px` }}
      />
    );
  }

  // Web: If no real ad was filled (e.g. local preview or blocked), return null so zero fake banners or blank boxes render
  if (adUnfilled) return null;

  const adsenseMetaClient =
    typeof document !== "undefined"
      ? document
          .querySelector('meta[name="google-adsense-account"]')
          ?.getAttribute("content")
      : null;
  const webAdClient = adsenseMetaClient || `ca-${ADMOB_CONFIG.PUBLISHER_ID}`;
  const slotId =
    unitType === "interstitial"
      ? ADMOB_CONFIG.INTERSTITIAL_SLOT
      : ADMOB_CONFIG.BANNER_SLOT;

  if (placement === "bottom-dock") {
    return (
      <div
        className={`w-full bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-700/60 overflow-hidden transition-all duration-300 ${
          adLoaded ? "px-2 py-1 min-h-[54px]" : "h-0 overflow-hidden opacity-0 pointer-events-none"
        } ${className}`}
      >
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: "block", width: "100%", minHeight: "50px" }}
          data-ad-client={webAdClient}
          data-ad-slot={slotId}
          data-ad-unit-id={ADMOB_CONFIG.BANNER_ID}
          data-adtest="on"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-hidden transition-all duration-300 ${
        adLoaded ? "my-2 space-y-1.5" : "h-0 overflow-hidden opacity-0 pointer-events-none"
      } ${className}`}
    >
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", minHeight: "50px" }}
        data-ad-client={webAdClient}
        data-ad-slot={slotId}
        data-ad-unit-id={ADMOB_CONFIG.BANNER_ID}
        data-adtest="on"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      {adLoaded && onUpgradeClick && (
        <div className="flex justify-end pr-2">
          <button
            type="button"
            onClick={onUpgradeClick}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-500 hover:text-amber-600 dark:text-amber-400 text-[9px] font-black rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1 uppercase tracking-tight"
          >
            {upgradeLabel}
          </button>
        </div>
      )}
    </div>
  );
};

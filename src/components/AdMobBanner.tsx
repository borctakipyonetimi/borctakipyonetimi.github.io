/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useId, useRef } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type AdMobBannerSize
} from "@capacitor-community/admob";
import {
  ADMOB_CONFIG,
  showNativeBannerAd,
  hideNativeBannerAd,
  isUserAdFree
} from "../utils/rewardedAdService";
import { useAuth } from "../context/AuthContext";

interface AdMobBannerProps {
  unitType?: "banner" | "native" | "interstitial" | "rectangle";
  placement?: "inline" | "bottom-dock" | "drawer-square";
  active?: boolean;
  className?: string;
  onUpgradeClick?: () => void;
  upgradeLabel?: string;
}

declare global {
  interface Window {
    googletag?: any;
  }
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  unitType = "banner",
  placement = "inline",
  active = true,
  className = "",
  onUpgradeClick,
  upgradeLabel = "Reklamları Kaldır 💎 Bütçem Pro'ya Geç"
}) => {
  const auth = useAuth();
  const isNative = Capacitor.isNativePlatform();
  const rawReactId = useId();
  const slotDivId = `butcem-gpt-${rawReactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const slotContainerRef = useRef<HTMLDivElement | null>(null);

  const [localAdFree, setLocalAdFree] = useState(() => isUserAdFree());
  const [adLoaded, setAdLoaded] = useState(false);
  const [adUnfilled, setAdUnfilled] = useState(false);
  const [nativeBannerHeight, setNativeBannerHeight] = useState<number>(
    placement === "drawer-square" || unitType === "rectangle" ? 250 : 56
  );

  // Sync ad-free state (Paid Premium or Active 7-Day Trial)
  useEffect(() => {
    const checkStatus = () => {
      setLocalAdFree(isUserAdFree());
    };
    checkStatus();

    window.addEventListener("storage", checkStatus);
    window.addEventListener("premium_status_changed", checkStatus);
    window.addEventListener("trial_status_changed", checkStatus);
    window.addEventListener("auth_state_changed", checkStatus);

    return () => {
      window.removeEventListener("storage", checkStatus);
      window.removeEventListener("premium_status_changed", checkStatus);
      window.removeEventListener("trial_status_changed", checkStatus);
      window.removeEventListener("auth_state_changed", checkStatus);
    };
  }, []);

  const isPremium = Boolean(auth?.isPremium);
  const isTrialActive = Boolean(auth?.isTrialActive);
  const shouldHideAds = isPremium || isTrialActive || localAdFree;
  const isRectangle = placement === "drawer-square" || unitType === "rectangle";

  useEffect(() => {
    if (shouldHideAds) {
      setAdLoaded(false);
      if (isNative) {
        hideNativeBannerAd().catch(() => {});
      }
      return;
    }

    // Drawer square ad activates strictly when drawer is open
    if (placement === "drawer-square" && !active) {
      setAdLoaded(false);
      setAdUnfilled(false);
      return;
    }

    // Native bottom-dock only handles native ADAPTIVE_BANNER; skip inline duplicates.
    // For drawer-square on native: temporarily hide the bottom-dock native banner while drawer is open
    // (because Capacitor AdMob overlays screen-wide BOTTOM_CENTER outside <aside>) and render the 250x250 slot strictly inside <aside>.
    if (isNative && placement === "inline") {
      return;
    }

    if (isNative && placement === "drawer-square") {
      hideNativeBannerAd().catch(() => {});
    }

    let isMounted = true;
    setAdLoaded(false);
    setAdUnfilled(false);

    // 1. CAPACITOR NATIVE ANDROID / IOS RUNTIME FOR BOTTOM-DOCK (Genuine Google AdMob Test Banner)
    if (isNative && placement === "bottom-dock") {
      const listeners: PluginListenerHandle[] = [];

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
              if (!isMounted) return;
              if (size?.height > 0) {
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

          const shown = await showNativeBannerAd({
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: true
          });

          if (isMounted && !shown) {
            setAdLoaded(false);
            setAdUnfilled(true);
          }
        } catch (nativeErr) {
          console.warn("[AdMob Native Banner] setup error:", nativeErr);
          if (isMounted) {
            setAdLoaded(false);
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
            // Ignore listener cleanup errors
          }
        }
      };
    }

    // 2. DOM-CONTAINED GOOGLE PUBLISHER TAG TEST AD UNIT (/6355419/Travel)
    // Used for Web/PWA slots AND drawer-square (so the drawer square ad stays 100% inside <aside> bounds!)
    let activeSlot: any = null;
    let renderHandlerRef: ((event: any) => void) | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const adSizes: [number, number][] = isRectangle ? [[250, 250]] : [[320, 50]];

    const initGptSlot = () => {
      if (!isMounted || typeof window === "undefined") return;
      const googletag = (window.googletag = window.googletag || { cmd: [] });

      googletag.cmd.push(() => {
        if (!isMounted) return;
        const containerEl = document.getElementById(slotDivId);
        if (!containerEl) return;

        try {
          const pubads = googletag.pubads();

          const handleSlotRenderEnded = (event: any) => {
            if (!isMounted || !activeSlot || event?.slot !== activeSlot) return;
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }
            if (event.isEmpty) {
              setAdLoaded(false);
              setAdUnfilled(true);
            } else {
              setAdLoaded(true);
              setAdUnfilled(false);
            }
          };

          renderHandlerRef = handleSlotRenderEnded;
          pubads.addEventListener("slotRenderEnded", handleSlotRenderEnded);

          // Destroy any stale slot that might share the same DOM id
          try {
            const existing = pubads
              .getSlots?.()
              ?.find((s: any) => s?.getSlotElementId?.() === slotDivId);
            if (existing) {
              googletag.destroySlots([existing]);
            }
          } catch {}

          activeSlot = googletag
            .defineSlot("/6355419/Travel", adSizes, slotDivId)
            ?.addService(pubads);

          if (!activeSlot) {
            setAdLoaded(false);
            setAdUnfilled(true);
            return;
          }

          pubads.setCentering(true);
          googletag.enableServices();
          googletag.display(slotDivId);
        } catch (err) {
          console.warn("[GPT Test Ad] render warning:", err);
          if (isMounted) {
            setAdLoaded(false);
            setAdUnfilled(true);
          }
        }
      });
    };

    const startTimer = setTimeout(initGptSlot, 80);

    // Collapse cleanly if network/adblocker blocks Google test ads
    timeoutHandle = setTimeout(() => {
      if (!isMounted) return;
      const el = slotContainerRef.current;
      const hasIframe = Boolean(el?.querySelector("iframe"));
      if (!hasIframe) {
        setAdLoaded(false);
        setAdUnfilled(true);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(startTimer);
      if (timeoutHandle) clearTimeout(timeoutHandle);

      try {
        const googletag = window.googletag;
        if (googletag && Array.isArray(googletag.cmd)) {
          googletag.cmd.push(() => {
            try {
              if (renderHandlerRef && typeof googletag.pubads?.().removeEventListener === "function") {
                googletag.pubads().removeEventListener("slotRenderEnded", renderHandlerRef);
              }
              if (activeSlot) {
                googletag.destroySlots([activeSlot]);
                activeSlot = null;
              }
            } catch {}
          });
        }
      } catch {}

      if (isNative && placement === "drawer-square" && active && !isUserAdFree()) {
        showNativeBannerAd({
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: true
        }).catch(() => {});
      }
    };
  }, [shouldHideAds, isNative, unitType, placement, active, isRectangle, slotDivId]);

  // KESİN KURAL: Premium ve aktif 7 günlük deneme kullanıcılarına HİÇBİR reklam gösterilmez
  if (shouldHideAds) return null;

  if (placement === "drawer-square" && !active) return null;

  // Native Android/iOS bottom-dock: Only allocate spacer when BannerAdPluginEvents.Loaded confirms an actual banner rendered
  if (isNative && placement !== "drawer-square") {
    if (!adLoaded || adUnfilled || placement !== "bottom-dock") {
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

  // Collapse completely when unfilled/blocked so empty reserved areas never appear
  if (adUnfilled) return null;

  if (isRectangle) {
    return (
      <div
        className={`w-full max-w-[264px] mx-auto flex flex-col items-center justify-center rounded-2xl bg-[#0f172a]/95 border border-slate-800 overflow-hidden transition-all duration-300 ${
          adLoaded ? "p-1.5 min-h-[262px]" : "h-0 border-0 opacity-0 pointer-events-none"
        } ${className}`}
      >
        <div
          ref={slotContainerRef}
          id={slotDivId}
          data-admob-unit={ADMOB_CONFIG.BANNER_ID}
          style={{ width: "250px", height: "250px", maxWidth: "100%" }}
          className="flex items-center justify-center overflow-hidden rounded-xl"
        />
      </div>
    );
  }

  if (placement === "bottom-dock") {
    return (
      <div
        className={`w-full flex items-center justify-center bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-700/60 overflow-hidden transition-all duration-300 ${
          adLoaded ? "px-2 py-1 min-h-[58px]" : "h-0 border-t-0 opacity-0 pointer-events-none"
        } ${className}`}
      >
        <div
          ref={slotContainerRef}
          id={slotDivId}
          data-admob-unit={ADMOB_CONFIG.BANNER_ID}
          style={{ width: "320px", height: "50px" }}
          className="flex items-center justify-center overflow-hidden"
        />
      </div>
    );
  }

  return (
    <div
      className={`w-full flex flex-col items-center overflow-hidden transition-all duration-300 ${
        adLoaded ? "my-2 space-y-1.5" : "h-0 opacity-0 pointer-events-none"
      } ${className}`}
    >
      <div
        ref={slotContainerRef}
        id={slotDivId}
        data-admob-unit={ADMOB_CONFIG.BANNER_ID}
        style={{ width: "320px", height: "50px" }}
        className="flex items-center justify-center overflow-hidden rounded-xl"
      />
      {adLoaded && onUpgradeClick && (
        <div className="flex justify-end w-full pr-2">
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

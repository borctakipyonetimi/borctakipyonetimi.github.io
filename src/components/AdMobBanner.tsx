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
  NativeAdPluginEvents,
  type AdMobBannerSize
} from "@capacitor-community/admob";
import {
  ADMOB_CONFIG,
  showNativeBannerAd,
  hideNativeBannerAd,
  isUserAdFree,
  acquireInlineNativeFeed
} from "../utils/rewardedAdService";
import { useAuth } from "../context/AuthContext";

interface AdMobBannerProps {
  unitType?: "banner" | "native" | "interstitial" | "rectangle";
  placement?: "inline" | "bottom-dock";
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
  const cleanReactId = rawReactId.replace(/[^a-zA-Z0-9_-]/g, "");
  const slotDivId = `butcem-gpt-${cleanReactId}`;
  const nativeSlotKey = `inline_${cleanReactId}`;

  const slotContainerRef = useRef<HTMLDivElement | null>(null);
  const nativeSlotRef = useRef<HTMLDivElement | null>(null);

  const [localAdFree, setLocalAdFree] = useState(() => isUserAdFree());
  const [adLoaded, setAdLoaded] = useState(false);
  const [adUnfilled, setAdUnfilled] = useState(false);
  const [nativeBannerHeight, setNativeBannerHeight] = useState<number>(56);

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
  const shouldHideAds = isPremium || isTrialActive || localAdFree || !active;
  const isRectangle = unitType === "rectangle";

  useEffect(() => {
    if (shouldHideAds) {
      setAdLoaded(false);
      setAdUnfilled(false);
      if (isNative && placement === "bottom-dock") {
        hideNativeBannerAd().catch(() => {});
      }
      return;
    }

    // 1. NATIVE ANDROID / iOS: BOTTOM-DOCK ADAPTIVE BANNER
    if (isNative && placement === "bottom-dock") {
      let isMounted = true;
      const listeners: PluginListenerHandle[] = [];
      setAdLoaded(false);
      setAdUnfilled(false);

      const triggerShowBanner = async () => {
        if (!isMounted || isUserAdFree()) return;
        const shown = await showNativeBannerAd({
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: true,
          force: true
        });
        if (isMounted && !shown) {
          setAdLoaded(false);
          setAdUnfilled(true);
        }
      };

      const handleSyncEvent = (ev: Event) => {
        const detail = (ev as CustomEvent)?.detail;
        if (!isMounted || isUserAdFree()) return;
        if (detail?.action === "restore") {
          setAdUnfilled(false);
          triggerShowBanner().catch(() => {});
        }
      };

      window.addEventListener("admob_native_banner_sync", handleSyncEvent);

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

          await triggerShowBanner();
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
        window.removeEventListener("admob_native_banner_sync", handleSyncEvent);
        for (const handle of listeners) {
          try {
            handle.remove();
          } catch {
            // Ignore cleanup errors
          }
        }
      };
    }

    // 2. NATIVE ANDROID / iOS: INLINE NATIVE AD FEED
    // Uses real Google AdMob Native Test Ad (ca-app-pub-3940256099942544/2247696110) projected onto the DOM box.
    if (isNative) {
      let isMounted = true;
      let attachedFeed: any = null;
      let attachTimer: ReturnType<typeof setTimeout> | null = null;
      let failFallbackTimer: ReturnType<typeof setTimeout> | null = null;
      const listeners: PluginListenerHandle[] = [];

      setAdLoaded(false);
      setAdUnfilled(false);

      const mountNativeSlot = async () => {
        try {
          const feed = await acquireInlineNativeFeed();

          if (!isMounted || !feed || isUserAdFree()) {
            if (isMounted && !feed) {
              setAdUnfilled(true);
            }
            return;
          }

          attachedFeed = feed;

          const loadedHandle = await feed.addListener(
            NativeAdPluginEvents.Loaded,
            (ev: any) => {
              if (!isMounted || ev?.slotKey !== nativeSlotKey) return;
              if (failFallbackTimer) {
                clearTimeout(failFallbackTimer);
                failFallbackTimer = null;
              }
              setAdLoaded(true);
              setAdUnfilled(false);
            }
          );
          listeners.push(loadedHandle);

          const failedHandle = await feed.addListener(
            NativeAdPluginEvents.FailedToLoad,
            (ev: any) => {
              if (!isMounted || ev?.slotKey !== nativeSlotKey) return;
              if (failFallbackTimer) {
                clearTimeout(failFallbackTimer);
                failFallbackTimer = null;
              }
              setAdLoaded(false);
              setAdUnfilled(true);
            }
          );
          listeners.push(failedHandle);

          attachTimer = setTimeout(() => {
            if (!isMounted || !nativeSlotRef.current) return;
            try {
              feed.attach(nativeSlotKey, nativeSlotRef.current);
            } catch (attachErr) {
              console.warn("[AdMob NativeFeed] attach error:", attachErr);
              if (isMounted) setAdUnfilled(true);
            }
          }, 60);

          failFallbackTimer = setTimeout(() => {
            if (isMounted) {
              setAdLoaded((loaded) => {
                if (!loaded) {
                  setAdUnfilled(true);
                }
                return loaded;
              });
            }
          }, 9000);
        } catch (err) {
          console.warn("[AdMob NativeFeed] mount error:", err);
          if (isMounted) {
            setAdLoaded(false);
            setAdUnfilled(true);
          }
        }
      };

      mountNativeSlot();

      return () => {
        isMounted = false;
        if (attachTimer) clearTimeout(attachTimer);
        if (failFallbackTimer) clearTimeout(failFallbackTimer);
        if (attachedFeed && nativeSlotRef.current) {
          try {
            attachedFeed.detach(nativeSlotRef.current);
          } catch {}
        }
        for (const handle of listeners) {
          try {
            handle.remove();
          } catch {}
        }
      };
    }

    // 3. WEB / PWA ENVIRONMENT: REAL GOOGLE PUBLISHER TAG TEST AD UNIT (/6355419/Travel)
    let isMounted = true;
    let activeSlot: any = null;
    let renderHandlerRef: ((event: any) => void) | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    setAdLoaded(false);
    setAdUnfilled(false);

    const adSizes: [number, number][] = isRectangle ? [[300, 250], [250, 250]] : [[320, 50]];

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
    }, 6000);

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
    };
  }, [shouldHideAds, isNative, unitType, placement, isRectangle, slotDivId, nativeSlotKey]);

  // KESİN KURAL: Premium ve aktif 7 günlük deneme kullanıcılarına HİÇBİR reklam gösterilmez
  if (shouldHideAds) return null;

  // Collapse completely when unfilled/blocked so empty reserved areas never appear
  if (adUnfilled) return null;

  // Native Bottom-Dock Spacer: Allocates exact height for Google AdMob Adaptive Banner
  if (isNative && placement === "bottom-dock") {
    if (!adLoaded) return null;
    return (
      <div
        aria-label="Google AdMob Test Banner"
        data-admob-unit={ADMOB_CONFIG.BANNER_ID}
        className={`w-full bg-transparent border-t border-slate-200/80 dark:border-slate-800/80 transition-all duration-200 ${className}`}
        style={{ height: `${Math.max(54, nativeBannerHeight)}px` }}
      />
    );
  }

  // Native Inline Cards: Measured NativeUIProjection Slot (>=144x300px, 336px keeps MediaView >=120dp on scaled fonts)
  if (isNative) {
    return (
      <div className={`w-full flex flex-col items-center overflow-visible my-2 space-y-1.5 relative z-10 ${className}`}>
        <div
          ref={nativeSlotRef}
          aria-label="Google AdMob Native Test Ad"
          data-admob-unit={ADMOB_CONFIG.NATIVE_ID}
          data-admob-slot={nativeSlotKey}
          style={{ width: "100%", height: "336px", minHeight: "336px" }}
          className={`w-full rounded-2xl overflow-visible transition-colors duration-200 ${
            adLoaded
              ? "bg-transparent border border-transparent"
              : "bg-white/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 animate-pulse"
          }`}
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
  }

  // Web Rectangle GPT Slot
  if (isRectangle) {
    return (
      <div
        className={`w-full flex flex-col items-center justify-center rounded-2xl transition-all duration-300 relative ${
          adLoaded
            ? "bg-white/95 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 p-2 min-h-[266px] overflow-visible z-10 shadow-sm"
            : "h-0 overflow-visible pointer-events-none"
        } ${className}`}
      >
        <div
          ref={slotContainerRef}
          id={slotDivId}
          data-admob-unit={ADMOB_CONFIG.BANNER_ID}
          style={
            adLoaded
              ? { width: "300px", height: "250px", maxWidth: "100%" }
              : { width: "300px", height: "250px", position: "absolute", left: "0", top: "0", opacity: 0, pointerEvents: "none" }
          }
          className="flex items-center justify-center overflow-visible rounded-xl relative z-10"
        />
      </div>
    );
  }

  // Web Bottom-Dock GPT Slot
  if (placement === "bottom-dock") {
    return (
      <div
        className={`w-full flex items-center justify-center transition-all duration-300 relative ${
          adLoaded
            ? "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-700/60 px-2 py-1 min-h-[58px] overflow-visible z-10"
            : "h-0 border-t-0 overflow-visible pointer-events-none"
        } ${className}`}
      >
        <div
          ref={slotContainerRef}
          id={slotDivId}
          data-admob-unit={ADMOB_CONFIG.BANNER_ID}
          style={
            adLoaded
              ? { width: "320px", height: "50px" }
              : { width: "320px", height: "50px", position: "absolute", left: "0", top: "0", opacity: 0, pointerEvents: "none" }
          }
          className="flex items-center justify-center overflow-visible relative z-10"
        />
      </div>
    );
  }

  // Web Inline GPT Banner Slot
  return (
    <div
      className={`w-full flex flex-col items-center transition-all duration-300 relative ${
        adLoaded ? "my-2 space-y-1.5 overflow-visible z-10" : "h-0 overflow-visible pointer-events-none"
      } ${className}`}
    >
      <div
        ref={slotContainerRef}
        id={slotDivId}
        data-admob-unit={ADMOB_CONFIG.BANNER_ID}
        style={
          adLoaded
            ? { width: "320px", height: "50px" }
            : { width: "320px", height: "50px", position: "absolute", left: "0", top: "0", opacity: 0, pointerEvents: "none" }
        }
        className="flex items-center justify-center overflow-visible rounded-xl relative z-10"
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

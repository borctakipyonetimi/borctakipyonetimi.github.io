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
  acquireInlineNativeFeed,
  initNativeAdMobSdk,
  InlineAdMob,
  ensureNativeAdsBootReset,
  getCurrentInlineAdSessionId
} from "../utils/rewardedAdService";
import { useAuth } from "../context/AuthContext";

let inlineSlotSeqCounter = 0;

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
  const inlineSlotInstanceRef = useRef<number>(0);
  if (!inlineSlotInstanceRef.current) {
    inlineSlotInstanceRef.current = ++inlineSlotSeqCounter;
  }
  const slotDivId = `butcem-gpt-${cleanReactId}`;
  const nativeSlotKey = `inline_${cleanReactId}_${inlineSlotInstanceRef.current}`;

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
  const isAndroidNative = isNative && Capacitor.getPlatform() === "android";

  useEffect(() => {
    if (shouldHideAds) {
      setAdLoaded(false);
      setAdUnfilled(false);
      if (isNative && placement === "bottom-dock") {
        hideNativeBannerAd().catch(() => {});
      }
      if (isAndroidNative && placement !== "bottom-dock") {
        InlineAdMob.removeSlot({ slotKey: nativeSlotKey }).catch(() => {});
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

          await ensureNativeAdsBootReset();
          if (!isMounted || isUserAdFree()) return;
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

    // 2A. ANDROID NATIVE INLINE ADVIEW (Reliable Google AdMob 300x250 Medium Rectangle)
    if (isAndroidNative) {
      let isMounted = true;
      let isLoaded = false;
      let isPaused = false;
      let isScrolling = false;
      let scrollPauseSent = false;
      let rafId: number | null = null;
      let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
      let mountSettleTimer: ReturnType<typeof setTimeout> | null = null;
      let settleTimer: ReturnType<typeof setTimeout> | null = null;
      let failTimer: ReturnType<typeof setTimeout> | null = null;
      let lastSignature = "";
      let activeSessionId = "";
      let touchStartY = 0;
      let touchScrollTop = 0;
      const listeners: PluginListenerHandle[] = [];

      setAdLoaded(false);
      setAdUnfilled(false);

      const sendHiddenUpdate = () => {
        if (!activeSessionId) return;
        const sig = "hidden";
        if (lastSignature === sig && !scrollPauseSent) return;
        lastSignature = sig;
        scrollPauseSent = false;
        InlineAdMob.updateSlot({
          slotKey: nativeSlotKey,
          sessionId: activeSessionId,
          visible: false,
          resumeScroll: true,
          rectX: 0,
          rectY: 0,
          rectW: 0,
          rectH: 0,
          clipX: 0,
          clipY: 0,
          clipW: 0,
          clipH: 0,
          viewportW: window.innerWidth || 0
        }).catch(() => {});
      };

      const syncPlacement = () => {
        rafId = null;
        if (!isMounted) return;

        const slotEl = nativeSlotRef.current;
        const sessionStale = Boolean(activeSessionId && activeSessionId !== getCurrentInlineAdSessionId());
        if (!isLoaded || isPaused || isScrolling || sessionStale || document.hidden || isUserAdFree() || !slotEl || !slotEl.isConnected) {
          sendHiddenUpdate();
          return;
        }

        const cs = window.getComputedStyle(slotEl);
        const rect = slotEl.getBoundingClientRect();
        if (
          cs.display === "none" ||
          cs.visibility === "hidden" ||
          parseFloat(cs.opacity || "1") <= 0.05 ||
          rect.width < 50 ||
          rect.height < 50
        ) {
          sendHiddenUpdate();
          return;
        }

        const scrollContainer = document.getElementById("app-main-scroll-container");
        const scRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;
        const vpLeft = scRect ? Math.max(0, scRect.left) : 0;
        const vpTop = scRect ? Math.max(0, scRect.top) : 0;
        const vpRight = scRect ? Math.min(window.innerWidth, scRect.right) : window.innerWidth;
        const vpBottom = scRect ? Math.min(window.innerHeight, scRect.bottom) : window.innerHeight;

        const clipX = Math.max(rect.left, vpLeft);
        const clipY = Math.max(rect.top, vpTop);
        const clipRight = Math.min(rect.right, vpRight);
        const clipBottom = Math.min(rect.bottom, vpBottom);
        const clipW = Math.max(0, clipRight - clipX);
        const clipH = Math.max(0, clipBottom - clipY);

        // Require most of the 300x250 slot to be cleanly inside the scroll container to prevent awkward sliver clipping
        const minVisibleW = Math.min(rect.width * 0.75, 220);
        const minVisibleH = Math.min(rect.height * 0.65, 160);
        let visible = clipW >= minVisibleW && clipH >= minVisibleH;
        if (visible) {
          const cx = clipX + clipW / 2;
          const cy = clipY + clipH / 2;
          const topY = Math.min(cy, clipY + 14);
          const botY = Math.max(cy, clipBottom - 14);
          const centerEl = document.elementFromPoint(cx, cy);
          const topEdgeEl = document.elementFromPoint(cx, topY);
          const botEdgeEl = document.elementFromPoint(cx, botY);
          const isOwn = (el: Element | null) => Boolean(el && (el === slotEl || slotEl.contains(el)));
          if (!isOwn(centerEl) || !isOwn(topEdgeEl) || !isOwn(botEdgeEl)) {
            visible = false;
          }
        }

        const sig = visible
          ? `1|${Math.round(rect.left)}|${Math.round(rect.top)}|${Math.round(rect.width)}|${Math.round(rect.height)}|${Math.round(clipX)}|${Math.round(clipY)}|${Math.round(clipW)}|${Math.round(clipH)}|${Math.round(window.innerWidth)}`
          : "hidden";

        if (sig === lastSignature && !scrollPauseSent) return;
        lastSignature = sig;
        scrollPauseSent = false;

        InlineAdMob.updateSlot({
          slotKey: nativeSlotKey,
          sessionId: activeSessionId,
          visible,
          resumeScroll: true,
          rectX: rect.left,
          rectY: rect.top,
          rectW: rect.width,
          rectH: rect.height,
          clipX,
          clipY,
          clipW,
          clipH,
          viewportW: window.innerWidth || 0
        }).catch(() => {});
      };

      const scheduleSync = () => {
        if (!isMounted || isScrolling || rafId !== null) return;
        rafId = requestAnimationFrame(syncPlacement);
      };

      const isRelevantScrollTarget = (target: EventTarget | null): boolean => {
        if (!target || target === document || target === window || target === document.documentElement || target === document.body) {
          return true;
        }
        if (target instanceof Element) {
          if (target.id === "app-main-scroll-container") return true;
          if (nativeSlotRef.current && target.contains(nativeSlotRef.current)) return true;
        }
        return false;
      };

      const beginScrollHide = (ev?: Event) => {
        if (!isMounted || !isLoaded) return;
        if (ev?.type === "scroll" && !isRelevantScrollTarget(ev.target)) {
          return;
        }
        isScrolling = true;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (!scrollPauseSent) {
          scrollPauseSent = true;
          lastSignature = "hidden";
          InlineAdMob.setScrollPaused({ scrolling: true }).catch(() => {});
        }
        if (scrollIdleTimer) {
          clearTimeout(scrollIdleTimer);
        }
        scrollIdleTimer = setTimeout(() => {
          scrollIdleTimer = null;
          if (!isMounted) return;
          isScrolling = false;
          lastSignature = "";
          scheduleSync();
        }, 190);
      };

      const handleTouchStart = (ev: TouchEvent) => {
        touchStartY = ev.touches?.[0]?.clientY ?? 0;
        const sc = document.getElementById("app-main-scroll-container");
        touchScrollTop = sc ? sc.scrollTop : window.scrollY;
      };

      const handleTouchMove = (ev: TouchEvent) => {
        const currentY = ev.touches?.[0]?.clientY ?? touchStartY;
        const sc = document.getElementById("app-main-scroll-container");
        const currentScrollTop = sc ? sc.scrollTop : window.scrollY;
        if (Math.abs(currentScrollTop - touchScrollTop) > 1 || Math.abs(currentY - touchStartY) > 6) {
          beginScrollHide();
        }
      };

      const handlePause = () => {
        isPaused = true;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        sendHiddenUpdate();
      };

      const handleResume = () => {
        isPaused = false;
        isScrolling = false;
        scrollPauseSent = false;
        lastSignature = "";
        scheduleSync();
      };

      const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleSync) : null;
      const bodyObserver = typeof MutationObserver !== "undefined" ? new MutationObserver(scheduleSync) : null;
      let safetyInterval: ReturnType<typeof setInterval> | null = null;

      const mountAndroidInlineAd = async () => {
        try {
          const loadedHandle = await InlineAdMob.addListener("inlineAdLoaded", (ev: any) => {
            if (!isMounted || ev?.slotKey !== nativeSlotKey) return;
            if (activeSessionId && activeSessionId !== getCurrentInlineAdSessionId()) return;
            if (failTimer) {
              clearTimeout(failTimer);
              failTimer = null;
            }
            isLoaded = true;
            lastSignature = "";
            setAdLoaded(true);
            setAdUnfilled(false);
            requestAnimationFrame(() => {
              if (!isMounted) return;
              lastSignature = "";
              scheduleSync();
            });
            settleTimer = setTimeout(() => {
              if (!isMounted) return;
              lastSignature = "";
              scheduleSync();
            }, 250);
          });
          listeners.push(loadedHandle);

          const failedHandle = await InlineAdMob.addListener("inlineAdFailed", (ev: any) => {
            if (!isMounted || ev?.slotKey !== nativeSlotKey) return;
            if (failTimer) {
              clearTimeout(failTimer);
              failTimer = null;
            }
            isLoaded = false;
            setAdLoaded(false);
            setAdUnfilled(true);
          });
          listeners.push(failedHandle);

          if (!isMounted) return;

          document.addEventListener("scroll", beginScrollHide, { capture: true, passive: true });
          document.addEventListener("wheel", beginScrollHide, { capture: true, passive: true });
          document.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
          document.addEventListener("touchmove", handleTouchMove, { capture: true, passive: true });
          document.addEventListener("visibilitychange", scheduleSync);
          window.addEventListener("resize", scheduleSync, { passive: true });
          window.addEventListener("admob_inline_pause", handlePause);
          window.addEventListener("admob_inline_resume", handleResume);
          if (resizeObserver && nativeSlotRef.current) {
            resizeObserver.observe(nativeSlotRef.current);
            if (nativeSlotRef.current.parentElement) {
              resizeObserver.observe(nativeSlotRef.current.parentElement);
            }
          }
          if (bodyObserver && document.body) {
            bodyObserver.observe(document.body, { childList: true });
          }
          safetyInterval = setInterval(() => {
            if (isMounted && isLoaded && !isPaused && !isScrolling && !document.hidden) {
              scheduleSync();
            }
          }, 350);

          await ensureNativeAdsBootReset();
          await initNativeAdMobSdk();
          if (!isMounted || isUserAdFree()) return;

          // Wait briefly for tab/scroll transitions and parent session cleanup to settle before loading
          await new Promise<void>((resolve) => {
            mountSettleTimer = setTimeout(() => {
              mountSettleTimer = null;
              resolve();
            }, 220);
          });

          if (!isMounted || isUserAdFree() || !nativeSlotRef.current?.isConnected) return;

          activeSessionId = getCurrentInlineAdSessionId();
          const containerWidth = nativeSlotRef.current?.parentElement?.clientWidth || window.innerWidth - 32;
          await InlineAdMob.loadSlot({
            slotKey: nativeSlotKey,
            sessionId: activeSessionId,
            adId: ADMOB_CONFIG.BANNER_ID,
            adSize: "MEDIUM_RECTANGLE",
            maxWidthDp: Math.max(300, Math.floor(containerWidth))
          });

          failTimer = setTimeout(() => {
            if (isMounted && !isLoaded) {
              setAdUnfilled(true);
              InlineAdMob.removeSlot({ slotKey: nativeSlotKey }).catch(() => {});
            }
          }, 9000);
        } catch (err) {
          console.warn("[InlineAdMob] Android mount warning:", err);
          if (isMounted) {
            setAdLoaded(false);
            setAdUnfilled(true);
          }
        }
      };

      mountAndroidInlineAd();

      return () => {
        isMounted = false;
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
        if (mountSettleTimer) clearTimeout(mountSettleTimer);
        if (settleTimer) clearTimeout(settleTimer);
        if (failTimer) clearTimeout(failTimer);
        if (safetyInterval) clearInterval(safetyInterval);
        resizeObserver?.disconnect();
        bodyObserver?.disconnect();
        document.removeEventListener("scroll", beginScrollHide, { capture: true });
        document.removeEventListener("wheel", beginScrollHide, { capture: true });
        document.removeEventListener("touchstart", handleTouchStart, { capture: true });
        document.removeEventListener("touchmove", handleTouchMove, { capture: true });
        document.removeEventListener("visibilitychange", scheduleSync);
        window.removeEventListener("resize", scheduleSync);
        window.removeEventListener("admob_inline_pause", handlePause);
        window.removeEventListener("admob_inline_resume", handleResume);
        for (const handle of listeners) {
          try {
            handle.remove();
          } catch {}
        }
        InlineAdMob.removeSlot({ slotKey: nativeSlotKey }).catch(() => {});
      };
    }

    // 2B. iOS NATIVE: INLINE NATIVE AD FEED
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
  }, [shouldHideAds, isNative, isAndroidNative, unitType, placement, isRectangle, slotDivId, nativeSlotKey]);

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

  // Android Native Inline Cards: Reliable 300x250 Google AdView projected onto transparent DOM slot (no dark empty box)
  if (isAndroidNative) {
    return (
      <div
        className={`w-full flex flex-col items-center relative z-10 ${
          adLoaded ? "my-2 space-y-1.5 overflow-visible" : "h-0 overflow-hidden m-0 p-0 pointer-events-none"
        } ${className}`}
      >
        <div
          className={`w-full flex items-center justify-center bg-transparent border-0 shadow-none p-0 ${
            adLoaded ? "min-h-[250px]" : "h-0 overflow-hidden"
          }`}
        >
          <div
            ref={nativeSlotRef}
            aria-label="Google AdMob Test Ad"
            data-admob-unit={ADMOB_CONFIG.BANNER_ID}
            data-admob-slot={nativeSlotKey}
            style={{ width: "300px", maxWidth: "100%", height: "250px" }}
            className="flex items-center justify-center bg-transparent"
          />
        </div>
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

  // iOS Native Inline Cards: Measured NativeUIProjection Slot
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

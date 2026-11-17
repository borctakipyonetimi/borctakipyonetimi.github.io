/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  BannerAdPluginEvents,
  RewardAdPluginEvents,
  InterstitialAdPluginEvents
} from "@capacitor-community/admob";

// Official Google AdMob Test Identifiers configured for Bütçem Pro Testing & Development
export const ADMOB_CONFIG = {
  PUBLISHER_ID: "pub-3940256099942544",
  APP_ID: "ca-app-pub-3940256099942544~3347511713",
  BANNER_ID: "ca-app-pub-3940256099942544/6300978111",
  NATIVE_ID: "ca-app-pub-3940256099942544/2247696110",
  INTERSTITIAL_ID: "ca-app-pub-3940256099942544/1033173712",
  REWARDED_VIDEO_ID: "ca-app-pub-3940256099942544/5224354917",
  BANNER_SLOT: "6300978111",
  NATIVE_SLOT: "2247696110",
  INTERSTITIAL_SLOT: "1033173712",
  REWARDED_SLOT: "5224354917",
  ADS_TXT_ENTRY: "google.com, pub-3940256099942544, DIRECT, f08c47fec0942fa0"
};

export type RewardedFeatureType =
  | "trial7days"
  | "ai"
  | "export"
  | "import"
  | "report"
  | "debts"
  | "expenses"
  | "installments"
  | "incomes"
  | "contacts"
  | "tools"
  | "alarms"
  | "any";

const PASS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (1 gün)

export function getFeaturePassKey(feature: RewardedFeatureType | string = "any"): string {
  const cleanFeature = (feature || "any").toLowerCase().trim();
  return `butcem_rewarded_pass_${cleanFeature}_expiry`;
}

/**
 * Helper to check if user should have an ad-free Pro experience
 * KURAL 1: Kayıt olmadan girenler (is_guest === "true") ve 1 video izlememiş / süresi dolmuş kullanıcılar REKLAM GÖRÜR (false).
 * KURAL 2: E-posta ile kaydolup 1 ödüllü video izleyerek 7 günlük denemeyi başlatanlar süre boyunca REKLAMSIZDIR (true).
 * KURAL 3: Ücretli Premium üyeler her zaman REKLAMSIZDIR (true).
 */
export function isUserAdFree(): boolean {
  if (typeof window === "undefined") return false;
  const user = (localStorage.getItem("currentUser") || "").toLowerCase().trim();
  if (user === "info.borcodemetakip@gmail.com") return true;

  const isGuestOnly = localStorage.getItem("is_guest") === "true";
  if (isGuestOnly) return false;

  const pSource = localStorage.getItem("premium_source");
  const isPremium =
    localStorage.getItem("is_premium") === "true" &&
    pSource !== "trial";
  if (isPremium) return true;

  const hasTrialActivated =
    localStorage.getItem("has_used_trial") === "true" ||
    localStorage.getItem("is_trial_active") === "true" ||
    pSource === "trial";
  if (!hasTrialActivated) return false;

  const trialEndDate = localStorage.getItem("trial_end_date");
  if (trialEndDate) {
    const endMs = new Date(trialEndDate).getTime();
    if (!isNaN(endMs)) {
      return Date.now() < endMs;
    }
  }

  const startStr = localStorage.getItem("trial_start_date");
  if (startStr && (pSource === "trial" || localStorage.getItem("has_used_trial") === "true")) {
    const startMs = new Date(startStr).getTime();
    if (!isNaN(startMs)) {
      return Date.now() < startMs + 7 * 24 * 60 * 60 * 1000;
    }
  }

  return false;
}

/**
 * Checks strictly if a temporary pass is active from watching a rewarded video ad
 * (independent of permanent premium status).
 */
export function isTemporaryPassActive(feature: RewardedFeatureType | string = "any"): boolean {
  if (typeof window === "undefined") return false;
  // If the user has Pro access (Premium or 7-day trial), they don't have a temporary pass
  if (isUserAdFree()) {
    return false;
  }
  const cleanFeature = (feature || "any").toLowerCase().trim();
  const key = getFeaturePassKey(cleanFeature);
  const expiry = Number(localStorage.getItem(key) || 0);
  return Date.now() < expiry;
}

/**
 * Gets formatted remaining time string strictly for a temporary pass (e.g., "23 saat 45 dk kaldı").
 * Returns null if the user is permanent Premium or the pass has expired.
 */
export function getTemporaryPassTimeRemaining(feature: RewardedFeatureType | string = "any"): string | null {
  if (typeof window === "undefined") return null;
  if (isUserAdFree()) return null;

  const cleanFeature = (feature || "any").toLowerCase().trim();
  const key = getFeaturePassKey(cleanFeature);
  const expiry = Number(localStorage.getItem(key) || 0);
  const diff = expiry - Date.now();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours} saat ${minutes > 0 ? `${minutes} dk ` : ""}kaldı`;
  }
  return `${minutes} dakika kaldı`;
}

/**
 * Returns remaining days (>= 1 when active) strictly for a temporary rewarded ad pass.
 */
export function getTemporaryPassDaysRemaining(feature: RewardedFeatureType | string = "any"): number {
  if (typeof window === "undefined") return 0;
  if (isUserAdFree()) return 0;

  const cleanFeature = (feature || "any").toLowerCase().trim();
  const key = getFeaturePassKey(cleanFeature);
  const expiry = Number(localStorage.getItem(key) || 0);
  const diff = expiry - Date.now();
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Returns day-first label for temporary rewarded passes, e.g. "1 Gün Kaldı (23 saat 45 dk kaldı)".
 */
export function getTemporaryPassDurationLabel(feature: RewardedFeatureType | string = "any"): string | null {
  const days = getTemporaryPassDaysRemaining(feature);
  if (days <= 0) return null;
  const detail = getTemporaryPassTimeRemaining(feature);
  return detail ? `${days} Gün Kaldı (${detail})` : `${days} Gün Kaldı`;
}

/**
 * Checks if the user currently has active access for a SPECIFIC feature,
 * either because they have Pro status (Premium or 7-day trial) or an active 24-hour pass.
 */
export function isPassActive(feature: RewardedFeatureType | string = "any"): boolean {
  if (typeof window === "undefined") return false;
  
  // Pro users (Premium or active 7-day trial) have full access to all features without ads
  if (isUserAdFree()) {
    return true;
  }

  const cleanFeature = (feature || "any").toLowerCase().trim();
  const key = getFeaturePassKey(cleanFeature);
  const expiry = Number(localStorage.getItem(key) || 0);
  
  return Date.now() < expiry;
}

/**
 * Gets formatted remaining time string for a specific feature (e.g., "23 saat 45 dk kaldı").
 * For permanent PRO users returns "Sınırsız (Premium)".
 */
export function getRemainingPassTimeFormatted(feature: RewardedFeatureType | string = "any"): string | null {
  if (typeof window === "undefined") return null;
  if (isUserAdFree()) return "Sınırsız (Pro)";

  const cleanFeature = (feature || "any").toLowerCase().trim();
  const key = getFeaturePassKey(cleanFeature);
  const expiry = Number(localStorage.getItem(key) || 0);
  const diff = expiry - Date.now();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours} saat ${minutes > 0 ? `${minutes} dk ` : ""}kaldı`;
  }
  return `${minutes} dakika kaldı`;
}

/**
 * Grants 24-hour full access ONLY to the specified target feature (e.g. 'ai', 'export', or 'import')
 */
export function grant24HourPass(feature: RewardedFeatureType | string = "any"): { expiresAt: number; feature: string } {
  const cleanFeature = (feature || "any").toLowerCase().trim();
  const expiresAt = Date.now() + PASS_DURATION_MS;
  
  if (typeof window !== "undefined") {
    const key = getFeaturePassKey(cleanFeature);
    localStorage.setItem(key, String(expiresAt));
    window.dispatchEvent(
      new CustomEvent("rewarded_pass_updated", { detail: { feature: cleanFeature, expiresAt } })
    );
  }
  return { expiresAt, feature: cleanFeature };
}

/**
 * Determines whether a specific feature requires viewing a rewarded ad
 */
export function featureRequiresAd(feature: RewardedFeatureType | string): boolean {
  if (typeof window === "undefined") return false;
  if (isUserAdFree()) return false;
  return !isPassActive(feature);
}

// ============================================================================
// NATIVE CAPACITOR ADMOB INTEGRATION SERVICE (OFFICIAL TEST IDS & RESILIENT SDK)
// ============================================================================

let isAdMobSdkInitialized = false;
let initPromise: Promise<boolean> | null = null;
let isNativeBannerActive = false;
let currentNativeBannerKey: string | null = null;
let nativeBannerPromise: Promise<boolean> | null = null;

// ============================================================================
// WEBVIEW DARK TRANSITION LOCK (#0f172a) - PREVENTS WHITE FLICKER ON AD CLOSE
// ============================================================================
let darkLockCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let savedThemeState: {
  htmlBg: string;
  bodyBg: string;
  rootBg: string;
  metaThemeColor: string | null;
} | null = null;

export function lockDarkAdTransitionBackground(): void {
  if (typeof document === "undefined") return;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }

  darkLockCount += 1;

  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  const rootEl = document.getElementById("root");
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  if (!savedThemeState) {
    savedThemeState = {
      htmlBg: htmlEl.style.backgroundColor,
      bodyBg: bodyEl.style.backgroundColor,
      rootBg: rootEl ? rootEl.style.backgroundColor : "",
      metaThemeColor: metaTheme ? metaTheme.getAttribute("content") : null,
    };
  }

  htmlEl.classList.add("ad-transition-dark-lock");
  bodyEl.classList.add("ad-transition-dark-lock");
  htmlEl.style.backgroundColor = "#0f172a";
  bodyEl.style.backgroundColor = "#0f172a";
  if (rootEl) {
    rootEl.style.backgroundColor = "#0f172a";
  }
  if (metaTheme) {
    metaTheme.setAttribute("content", "#0f172a");
  }

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("StatusBar")) {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#0f172a" }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  }
}

export function releaseDarkAdTransitionBackground(delayMs = 450): void {
  if (typeof document === "undefined") return;
  darkLockCount = Math.max(0, darkLockCount - 1);
  if (darkLockCount > 0) return;

  if (releaseTimer) {
    clearTimeout(releaseTimer);
  }

  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (darkLockCount > 0) return;

    const restoreColors = () => {
      if (darkLockCount > 0) return;
      const htmlEl = document.documentElement;
      const bodyEl = document.body;
      const rootEl = document.getElementById("root");
      const metaTheme = document.querySelector('meta[name="theme-color"]');

      const isDark = htmlEl.classList.contains("dark");
      const targetBg = isDark ? "#0F172A" : "#F4F6F9";

      htmlEl.classList.remove("ad-transition-dark-lock");
      bodyEl.classList.remove("ad-transition-dark-lock");

      if (savedThemeState) {
        htmlEl.style.backgroundColor = savedThemeState.htmlBg || targetBg;
        bodyEl.style.backgroundColor = savedThemeState.bodyBg || targetBg;
        if (rootEl) {
          rootEl.style.backgroundColor = savedThemeState.rootBg || "";
        }
        if (metaTheme) {
          metaTheme.setAttribute("content", savedThemeState.metaThemeColor || targetBg);
        }
        savedThemeState = null;
      } else {
        htmlEl.style.backgroundColor = targetBg;
        bodyEl.style.backgroundColor = targetBg;
        if (rootEl) {
          rootEl.style.backgroundColor = "";
        }
      }

      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("StatusBar")) {
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
        StatusBar.setBackgroundColor({ color: targetBg }).catch(() => {});
        StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
      }
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(restoreColors);
    } else {
      restoreColors();
    }
  }, delayMs);
}

/**
 * Initializes AdMob SDK cleanly for Capacitor Native platform with test device setup
 */
export async function initNativeAdMobSdk(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  if (isAdMobSdkInitialized) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log("[AdMob Native] Initializing Mobile Ads SDK for testing...");
      await AdMob.initialize({
        initializeForTesting: true,
      });
      isAdMobSdkInitialized = true;
      console.log("[AdMob Native] Mobile Ads SDK initialized successfully.");
      return true;
    } catch (err) {
      console.warn("[AdMob Native] SDK Initialization warning:", err);
      // Even if warning, set to true to avoid repeated init fails
      isAdMobSdkInitialized = true;
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Shows native Banner Ad at the bottom of the screen with official test ID.
 * Supports `force: true` when an already-mounted AdMobBanner attaches fresh listeners.
 */
export async function showNativeBannerAd(options?: {
  position?: BannerAdPosition;
  adSize?: BannerAdSize;
  margin?: number;
  isTesting?: boolean;
  force?: boolean;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  if (isUserAdFree()) {
    await hideNativeBannerAd();
    return false;
  }

  const targetSize = options?.adSize || BannerAdSize.ADAPTIVE_BANNER;
  const targetPosition = options?.position || BannerAdPosition.BOTTOM_CENTER;
  const targetMargin = options?.margin ?? 0;
  const targetKey = `${targetSize}_${targetPosition}_${targetMargin}`;

  if (!options?.force && isNativeBannerActive && currentNativeBannerKey === targetKey) {
    return true;
  }

  if (nativeBannerPromise) {
    await nativeBannerPromise.catch(() => false);
    if (!options?.force && isNativeBannerActive && currentNativeBannerKey === targetKey) {
      return true;
    }
  }

  nativeBannerPromise = (async () => {
    try {
      await initNativeAdMobSdk();

      if (isNativeBannerActive && (currentNativeBannerKey !== targetKey || options?.force)) {
        try {
          await AdMob.removeBanner().catch(() => AdMob.hideBanner());
        } catch {
          // Ignore remove before reload/switch
        }
        isNativeBannerActive = false;
        currentNativeBannerKey = null;
      }

      await AdMob.showBanner({
        adId: ADMOB_CONFIG.BANNER_ID,
        adSize: targetSize,
        position: targetPosition,
        margin: targetMargin,
        isTesting: options?.isTesting !== false,
      });

      isNativeBannerActive = true;
      currentNativeBannerKey = targetKey;
      console.log(`[AdMob Native] Banner ad displayed (${targetSize}).`);
      return true;
    } catch (err) {
      isNativeBannerActive = false;
      currentNativeBannerKey = null;
      console.warn("[AdMob Native] showBanner error safely caught:", err);
      return false;
    } finally {
      nativeBannerPromise = null;
    }
  })();

  return nativeBannerPromise;
}

/**
 * Hides/Removes native banner ad cleanly so next showBanner creates a visible AdView
 */
export async function hideNativeBannerAd(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    isNativeBannerActive = false;
    currentNativeBannerKey = null;
    await AdMob.removeBanner().catch(() => AdMob.hideBanner());
  } catch (err) {
    console.warn("[AdMob Native] removeBanner/hideBanner error:", err);
  }
}

/**
 * Prepares and shows official Google Test Interstitial (Geçiş) Ad
 */
export async function showNativeInterstitialAd(options?: {
  isTesting?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    console.info("[AdMob Interstitial] Native platform not active (Web environment).");
    return { success: false, error: "Web ortamında geçiş reklamı desteklenmiyor." };
  }

  if (isUserAdFree()) {
    return { success: true };
  }

  lockDarkAdTransitionBackground();
  const handles: PluginListenerHandle[] = [];
  const cleanup = async () => {
    for (const h of handles) {
      try { await h.remove(); } catch {}
    }
    handles.length = 0;
  };

  try {
    await initNativeAdMobSdk();

    const dismissedHandle = await AdMob.addListener(
      InterstitialAdPluginEvents.Dismissed,
      async () => {
        await cleanup();
        releaseDarkAdTransitionBackground(420);
      }
    );
    handles.push(dismissedHandle);

    const failedHandle = await AdMob.addListener(
      InterstitialAdPluginEvents.FailedToLoad,
      async () => {
        await cleanup();
        releaseDarkAdTransitionBackground(200);
      }
    );
    handles.push(failedHandle);

    console.log("[AdMob Interstitial] Preparing test interstitial ad:", ADMOB_CONFIG.INTERSTITIAL_ID);
    await AdMob.prepareInterstitial({
      adId: ADMOB_CONFIG.INTERSTITIAL_ID,
      isTesting: options?.isTesting !== false,
    });

    console.log("[AdMob Interstitial] Showing interstitial ad...");
    await AdMob.showInterstitial();
    return { success: true };
  } catch (err: any) {
    console.warn("[AdMob Interstitial] Failed to show interstitial ad:", err);
    await cleanup();
    releaseDarkAdTransitionBackground(200);
    return {
      success: false,
      error: err?.message || "Geçiş reklamı yüklenirken bir hata oluştu."
    };
  }
}

/**
 * Prepares and shows official Google Test Rewarded (Ödüllü) Video Ad
 * Calls onRewarded() when the user watches the required video duration.
 * Locks WebView background to #0f172a during transition to prevent white flicker.
 */
export async function showNativeRewardedAd(callbacks: {
  onRewarded: () => void;
  onDismissed?: () => void;
  onError?: (err: any) => void;
}): Promise<{ success: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    console.info("[AdMob Rewarded] Native platform not active (Web environment). Falling back to web handler.");
    return { success: false, error: "Native platform required" };
  }

  if (isUserAdFree()) {
    callbacks.onRewarded();
    return { success: true };
  }

  lockDarkAdTransitionBackground();
  const listenerHandles: PluginListenerHandle[] = [];
  let rewardEarned = false;
  let settled = false;
  let safetyFlushTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanupListeners = async () => {
    if (safetyFlushTimer) {
      clearTimeout(safetyFlushTimer);
      safetyFlushTimer = null;
    }
    for (const h of listenerHandles) {
      try {
        await h.remove();
      } catch {
        // Safe fallback
      }
    }
    listenerHandles.length = 0;
  };

  const forceWebViewRepaint = () => {
    if (typeof document === "undefined" || !document.body) return;
    const prevScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    document.body.style.display = "none";
    void document.body.offsetHeight; // reflow tetikle
    document.body.style.display = "";
    if (prevScrollY > 0 && typeof window !== "undefined") {
      window.scrollTo(0, prevScrollY);
    }
  };

  const settleAfterAdClose = async (triggerDismissedCallback: boolean) => {
    if (settled) return;
    settled = true;
    await cleanupListeners();

    const runDeferredRefresh = () => {
      setTimeout(() => {
        if (rewardEarned) {
          try {
            callbacks.onRewarded();
          } catch (cbErr) {
            console.error("[AdMob Rewarded] Callback onRewarded error:", cbErr);
          }
        }
        if (triggerDismissedCallback && callbacks.onDismissed) {
          try {
            callbacks.onDismissed();
          } catch {
            // Safe fallback
          }
        }
        forceWebViewRepaint();
        releaseDarkAdTransitionBackground(480);
      }, 120);
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(runDeferredRefresh);
    } else {
      runDeferredRefresh();
    }
  };

  try {
    await initNativeAdMobSdk();

    // 1. Record reward earned; wait until native AdActivity finishes dismissing so header/WebView never repaints mid-transition
    const rewardedHandle = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      (reward) => {
        console.log("[AdMob Rewarded] User earned reward!", reward);
        rewardEarned = true;
        if (safetyFlushTimer) clearTimeout(safetyFlushTimer);
        safetyFlushTimer = setTimeout(() => {
          settleAfterAdClose(false).catch(() => {});
        }, 2500);
      }
    );
    listenerHandles.push(rewardedHandle);

    // 2. Listen for ad dismissal event and force immediate WebView reflow + smooth UI refresh
    const dismissedHandle = await AdMob.addListener(
      RewardAdPluginEvents.Dismissed,
      async () => {
        console.log("[AdMob Rewarded] Ad dismissed by user.");
        forceWebViewRepaint();
        await settleAfterAdClose(true);
      }
    );
    listenerHandles.push(dismissedHandle);

    // 3. Listen for load failure event
    const failedToLoadHandle = await AdMob.addListener(
      RewardAdPluginEvents.FailedToLoad,
      async (err) => {
        console.warn("[AdMob Rewarded] Ad failed to load:", err);
        if (settled) return;
        settled = true;
        await cleanupListeners();
        releaseDarkAdTransitionBackground(250);
        if (callbacks.onError) {
          callbacks.onError(err);
        }
      }
    );
    listenerHandles.push(failedToLoadHandle);

    // 4. Prepare Rewarded Video with official Google Test ID
    console.log("[AdMob Rewarded] Preparing rewarded video with Test ID:", ADMOB_CONFIG.REWARDED_VIDEO_ID);
    await AdMob.prepareRewardVideoAd({
      adId: ADMOB_CONFIG.REWARDED_VIDEO_ID,
      isTesting: true,
    });

    // 5. Show Rewarded Video
    console.log("[AdMob Rewarded] Showing rewarded video ad...");
    await AdMob.showRewardVideoAd();

    return { success: true };
  } catch (err: any) {
    console.warn("[AdMob Rewarded] Native rewarded ad preparation/show exception:", err);
    settled = true;
    await cleanupListeners();
    releaseDarkAdTransitionBackground(250);
    if (callbacks.onError) {
      callbacks.onError(err);
    }
    return {
      success: false,
      error: err?.message || "Ödüllü reklam yüklenemedi."
    };
  }
}

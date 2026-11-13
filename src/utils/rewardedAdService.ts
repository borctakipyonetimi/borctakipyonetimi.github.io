/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
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
  INTERSTITIAL_ID: "ca-app-pub-3940256099942544/1033173712",
  REWARDED_VIDEO_ID: "ca-app-pub-3940256099942544/5224354917",
  BANNER_SLOT: "6300978111",
  INTERSTITIAL_SLOT: "1033173712",
  REWARDED_SLOT: "5224354917",
  ADS_TXT_ENTRY: "google.com, pub-3940256099942544, DIRECT, f08c47fec0942fa0"
};

export type RewardedFeatureType = "ai" | "export" | "import" | "report" | "any";

const PASS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (1 gün)

export function getFeaturePassKey(feature: RewardedFeatureType | string = "any"): string {
  const cleanFeature = (feature || "any").toLowerCase().trim();
  return `butcem_rewarded_pass_${cleanFeature}_expiry`;
}

/**
 * Helper to check if user should have an ad-free Pro experience
 * KURAL 2 & 3: if (isPremium || isTrialActive) return true (No ads, Pro features unlocked)
 * KURAL 1: Guests and expired trial users return false (Must see mandatory ads)
 */
export function isUserAdFree(): boolean {
  if (typeof window === "undefined") return false;
  const user = (localStorage.getItem("currentUser") || "").toLowerCase().trim();
  if (user === "info.borcodemetakip@gmail.com") return true;
  
  const isGuest = localStorage.getItem("is_guest") === "true";
  if (isGuest) return false;

  const isPremium = localStorage.getItem("is_premium") === "true" && localStorage.getItem("premium_source") !== "trial";
  if (isPremium) return true;

  const isTrialActiveStorage = localStorage.getItem("is_trial_active") === "true";
  const trialEndDate = localStorage.getItem("trial_end_date");
  if (trialEndDate) {
    const endMs = new Date(trialEndDate).getTime();
    if (!isNaN(endMs) && Date.now() < endMs) {
      return true;
    }
  }
  return isTrialActiveStorage;
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
}

export function releaseDarkAdTransitionBackground(delayMs = 400): void {
  if (typeof document === "undefined") return;
  darkLockCount = Math.max(0, darkLockCount - 1);
  if (darkLockCount > 0) return;

  if (releaseTimer) {
    clearTimeout(releaseTimer);
  }

  releaseTimer = setTimeout(() => {
    releaseTimer = null;
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
 * Shows native Banner Ad at the bottom of the screen with official test ID
 * Deduplicated so multiple inline components never stack or flicker the native banner.
 */
export async function showNativeBannerAd(options?: {
  position?: BannerAdPosition;
  isTesting?: boolean;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  if (isUserAdFree()) {
    await hideNativeBannerAd();
    return false;
  }

  if (isNativeBannerActive) {
    return true;
  }

  if (nativeBannerPromise) {
    return nativeBannerPromise;
  }

  nativeBannerPromise = (async () => {
    try {
      await initNativeAdMobSdk();

      await AdMob.showBanner({
        adId: ADMOB_CONFIG.BANNER_ID,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: options?.position || BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: options?.isTesting !== false, // Always true for test mode
      });

      isNativeBannerActive = true;
      console.log("[AdMob Native] Banner ad displayed successfully.");
      return true;
    } catch (err) {
      console.warn("[AdMob Native] showBanner error safely caught:", err);
      return false;
    } finally {
      nativeBannerPromise = null;
    }
  })();

  return nativeBannerPromise;
}

/**
 * Hides/Removes native banner ad
 */
export async function hideNativeBannerAd(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    isNativeBannerActive = false;
    await AdMob.hideBanner();
  } catch (err) {
    console.warn("[AdMob Native] hideBanner error:", err);
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

  const cleanupListeners = async () => {
    for (const h of listenerHandles) {
      try {
        await h.remove();
      } catch {
        // Safe fallback
      }
    }
    listenerHandles.length = 0;
  };

  try {
    await initNativeAdMobSdk();

    // 1. Listen for reward grant event
    const rewardedHandle = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      (reward) => {
        console.log("[AdMob Rewarded] User earned reward!", reward);
        try {
          callbacks.onRewarded();
        } catch (cbErr) {
          console.error("[AdMob Rewarded] Callback onRewarded error:", cbErr);
        }
      }
    );
    listenerHandles.push(rewardedHandle);

    // 2. Listen for ad dismissal event
    const dismissedHandle = await AdMob.addListener(
      RewardAdPluginEvents.Dismissed,
      async () => {
        console.log("[AdMob Rewarded] Ad dismissed by user.");
        await cleanupListeners();
        if (callbacks.onDismissed) {
          callbacks.onDismissed();
        }
        releaseDarkAdTransitionBackground(450);
      }
    );
    listenerHandles.push(dismissedHandle);

    // 3. Listen for load failure event
    const failedToLoadHandle = await AdMob.addListener(
      RewardAdPluginEvents.FailedToLoad,
      async (err) => {
        console.warn("[AdMob Rewarded] Ad failed to load:", err);
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

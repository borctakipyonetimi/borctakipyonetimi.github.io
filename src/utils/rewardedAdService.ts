/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  BannerAdPluginEvents,
  RewardAdPluginEvents,
  InterstitialAdPluginEvents,
  NativeAdFeed,
  NativeAdTemplate
} from "@capacitor-community/admob";

export interface InlineAdMobPluginInterface {
  beginSession(options: { sessionId: string }): Promise<void>;
  clearAllSlots(): Promise<void>;
  setScrollPaused(options: { scrolling: boolean }): Promise<void>;
  loadSlot(options: {
    slotKey: string;
    sessionId?: string;
    adId?: string;
    adSize?: "MEDIUM_RECTANGLE" | "LARGE_BANNER" | "BANNER";
    maxWidthDp?: number;
  }): Promise<void>;
  updateSlot(options: {
    slotKey: string;
    sessionId?: string;
    visible: boolean;
    resumeScroll?: boolean;
    rectX: number;
    rectY: number;
    rectW: number;
    rectH: number;
    clipX: number;
    clipY: number;
    clipW: number;
    clipH: number;
    viewportW: number;
  }): Promise<void>;
  removeSlot(options: { slotKey: string }): Promise<void>;
  pauseAll(): Promise<void>;
  resumeAll(): Promise<void>;
  addListener(
    eventName: "inlineAdLoaded" | "inlineAdFailed",
    listenerFunc: (event: any) => void
  ): Promise<PluginListenerHandle>;
}

export const InlineAdMob = registerPlugin<InlineAdMobPluginInterface>("InlineAdMob");

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
let bannerGeneration = 0;

function createInlineSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

let currentInlineSessionId: string = createInlineSessionId();
let bootResetPromise: Promise<void> | null = null;

export function getCurrentInlineAdSessionId(): string {
  return currentInlineSessionId;
}

/**
 * Ensures any leftover native inline/banner overlays from a previous WebView session
 * (e.g., after window.location.reload()) are destroyed once on page boot before new ads mount.
 */
export function ensureNativeAdsBootReset(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve();
  }
  if (bootResetPromise) {
    return bootResetPromise;
  }
  bootResetPromise = (async () => {
    try {
      await Promise.allSettled([
        Capacitor.getPlatform() === "android"
          ? InlineAdMob.beginSession({ sessionId: currentInlineSessionId })
          : Promise.resolve(),
        AdMob.removeBanner().catch(() => AdMob.hideBanner().catch(() => {})),
      ]);
      isNativeBannerActive = false;
      currentNativeBannerKey = null;
    } catch {
      // Safe ignore on web/unsupported environments
    }
  })();
  return bootResetPromise;
}

export async function beginFreshInlineAdSession(): Promise<string> {
  currentInlineSessionId = createInlineSessionId();
  const nextSession = currentInlineSessionId;
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    try {
      await InlineAdMob.beginSession({ sessionId: nextSession });
    } catch {
      // Safe ignore
    }
  }
  return nextSession;
}

export async function clearAllInlineAdsAndBanners(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await Promise.allSettled([
    beginFreshInlineAdSession(),
    hideNativeBannerAd(),
  ]);
}

if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
  void ensureNativeAdsBootReset();

  const cleanupOnWebViewLeave = () => {
    bannerGeneration += 1;
    isNativeBannerActive = false;
    currentNativeBannerKey = null;
    if (Capacitor.getPlatform() === "android") {
      InlineAdMob.clearAllSlots().catch(() => {});
    }
    AdMob.removeBanner().catch(() => AdMob.hideBanner().catch(() => {}));
  };

  window.addEventListener("beforeunload", cleanupOnWebViewLeave);
  window.addEventListener("pagehide", cleanupOnWebViewLeave);
}

// ============================================================================
// DIRECT AD RETURN HELPERS (NO EXTRA TRANSITION CURTAINS OR DELAYED LOCKS)
// ============================================================================
export function lockDarkAdTransitionBackground(): void {
  // No-op: Android native theme (#0f172a) already anchors the WebView surface without DOM transition curtains.
}

export function releaseDarkAdTransitionBackground(_delayMs = 0): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("ad-transition-dark-lock");
  document.body.classList.remove("ad-transition-dark-lock");
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
      console.log("[AdMob Native] Initializing Mobile Ads SDK...");
      await AdMob.initialize();
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

  const myGeneration = ++bannerGeneration;

  nativeBannerPromise = (async () => {
    try {
      await ensureNativeAdsBootReset();
      if (myGeneration !== bannerGeneration || isUserAdFree()) {
        return false;
      }

      await initNativeAdMobSdk();
      if (myGeneration !== bannerGeneration || isUserAdFree()) {
        return false;
      }

      if (isNativeBannerActive && (currentNativeBannerKey !== targetKey || options?.force)) {
        try {
          await AdMob.removeBanner().catch(() => AdMob.hideBanner());
        } catch {
          // Ignore remove before reload/switch
        }
        isNativeBannerActive = false;
        currentNativeBannerKey = null;
      }

      if (myGeneration !== bannerGeneration || isUserAdFree()) {
        return false;
      }

      await AdMob.showBanner({
        adId: ADMOB_CONFIG.BANNER_ID,
        adSize: targetSize,
        position: targetPosition,
        margin: targetMargin,
        isTesting: options?.isTesting !== false,
      });

      if (myGeneration !== bannerGeneration || isUserAdFree()) {
        await AdMob.removeBanner().catch(() => AdMob.hideBanner().catch(() => {}));
        isNativeBannerActive = false;
        currentNativeBannerKey = null;
        return false;
      }

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
    bannerGeneration += 1;
    isNativeBannerActive = false;
    currentNativeBannerKey = null;
    await AdMob.removeBanner().catch(() => AdMob.hideBanner());
  } catch (err) {
    console.warn("[AdMob Native] removeBanner/hideBanner error:", err);
  }
}

// ============================================================================
// NATIVE ADMOB FEED MANAGER (Real Google AdMob Native Test Ads for Inline Cards)
// ============================================================================

function getNativeAdThemeStyle() {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  if (isDark) {
    return {
      backgroundColor: "#1e293b",
      borderColor: "#334155",
      borderWidth: 1,
      cornerRadius: 16,
      headlineColor: "#f8fafc",
      headlineFontSize: 15,
      bodyColor: "#cbd5e1",
      bodyFontSize: 12,
      callToActionBackgroundColor: "#f59e0b",
      callToActionTextColor: "#0f172a",
      callToActionFontSize: 13,
    };
  }

  return {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    cornerRadius: 16,
    headlineColor: "#0f172a",
    headlineFontSize: 15,
    bodyColor: "#475569",
    bodyFontSize: 12,
    callToActionBackgroundColor: "#4f46e5",
    callToActionTextColor: "#ffffff",
    callToActionFontSize: 13,
  };
}

let inlineNativeFeed: NativeAdFeed | null = null;
let inlineFeedCreatePromise: Promise<NativeAdFeed | null> | null = null;

export async function acquireInlineNativeFeed(): Promise<NativeAdFeed | null> {
  if (!Capacitor.isNativePlatform() || isUserAdFree()) return null;
  if (inlineNativeFeed) return inlineNativeFeed;
  if (inlineFeedCreatePromise) return inlineFeedCreatePromise;

  inlineFeedCreatePromise = (async () => {
    try {
      await initNativeAdMobSdk();
      const feed = await NativeAdFeed.create({
        feedId: "butcem_inline_feed",
        template: NativeAdTemplate.Medium,
        isTesting: true,
        adId: ADMOB_CONFIG.NATIVE_ID,
        style: getNativeAdThemeStyle(),
        androidScrollSnapshot: false,
      });
      inlineNativeFeed = feed;
      return feed;
    } catch (err) {
      console.warn("[AdMob NativeFeed] Inline feed init warning:", err);
      return null;
    } finally {
      inlineFeedCreatePromise = null;
    }
  })();

  return inlineFeedCreatePromise;
}

export async function pauseInlineNativeFeed(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await InlineAdMob.pauseAll();
  } catch {
    // Safe ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admob_inline_pause"));
  }
  if (inlineNativeFeed) {
    try {
      await inlineNativeFeed.pause();
    } catch {
      // Safe ignore if feed already paused or destroyed
    }
  }
}

export function resumeInlineNativeFeed(): void {
  if (!Capacitor.isNativePlatform() || isUserAdFree()) return;
  try {
    void InlineAdMob.resumeAll().catch(() => {});
  } catch {
    // Safe ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admob_inline_resume"));
  }
  if (inlineNativeFeed) {
    try {
      inlineNativeFeed.resume();
    } catch {
      // Safe ignore
    }
  }
}

export async function destroyAllNativeFeeds(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await InlineAdMob.pauseAll();
    } catch {}
  }
  const feed = inlineNativeFeed;
  inlineNativeFeed = null;
  if (feed) {
    try {
      await feed.destroy();
    } catch {
      // Ignore cleanup warning
    }
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

  let cleaned = false;
  const handles: PluginListenerHandle[] = [];
  const cleanup = async () => {
    cleaned = true;
    const toRemove = handles.splice(0, handles.length);
    for (const h of toRemove) {
      try { await h.remove(); } catch {}
    }
  };

  try {
    await initNativeAdMobSdk();

    const dismissedHandle = await AdMob.addListener(
      InterstitialAdPluginEvents.Dismissed,
      async () => {
        await cleanup();
      }
    );
    if (cleaned) {
      try { await dismissedHandle.remove(); } catch {}
    } else {
      handles.push(dismissedHandle);
    }

    const failedHandle = await AdMob.addListener(
      InterstitialAdPluginEvents.FailedToLoad,
      async () => {
        await cleanup();
      }
    );
    if (cleaned) {
      try { await failedHandle.remove(); } catch {}
    } else {
      handles.push(failedHandle);
    }

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
    return {
      success: false,
      error: err?.message || "Geçiş reklamı yüklenirken bir hata oluştu."
    };
  }
}

/**
 * Prepares and shows official Google Test Rewarded (Ödüllü) Video Ad
 * Calls onRewarded() synchronously once the ad settles cleanly.
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

  const listenerHandles: PluginListenerHandle[] = [];
  let rewardEarned = false;
  let settled = false;
  let cleaned = false;
  let safetyFlushTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanupListeners = async () => {
    cleaned = true;
    if (safetyFlushTimer) {
      clearTimeout(safetyFlushTimer);
      safetyFlushTimer = null;
    }
    const toRemove = listenerHandles.splice(0, listenerHandles.length);
    for (const h of toRemove) {
      try {
        await h.remove();
      } catch {
        // Safe fallback
      }
    }
  };

  const settleAfterAdClose = async (triggerDismissedCallback: boolean) => {
    if (settled) return;
    settled = true;
    await cleanupListeners();

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
  };

  try {
    await initNativeAdMobSdk();

    // 1. Record reward earned; wait for Dismissed event (with safety fallback)
    const rewardedHandle = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      (reward) => {
        console.log("[AdMob Rewarded] User earned reward!", reward);
        rewardEarned = true;
        if (safetyFlushTimer) clearTimeout(safetyFlushTimer);
        safetyFlushTimer = setTimeout(() => {
          settleAfterAdClose(false).catch(() => {});
        }, 1800);
      }
    );
    if (cleaned) {
      try { await rewardedHandle.remove(); } catch {}
    } else {
      listenerHandles.push(rewardedHandle);
    }

    // 2. Listen for ad dismissal event and return directly without extra curtains
    const dismissedHandle = await AdMob.addListener(
      RewardAdPluginEvents.Dismissed,
      async () => {
        console.log("[AdMob Rewarded] Ad dismissed by user.");
        await settleAfterAdClose(true);
      }
    );
    if (cleaned) {
      try { await dismissedHandle.remove(); } catch {}
    } else {
      listenerHandles.push(dismissedHandle);
    }

    // 3. Listen for load failure event
    const failedToLoadHandle = await AdMob.addListener(
      RewardAdPluginEvents.FailedToLoad,
      async (err) => {
        console.warn("[AdMob Rewarded] Ad failed to load:", err);
        if (settled) return;
        settled = true;
        await cleanupListeners();
        if (callbacks.onError) {
          callbacks.onError(err);
        }
      }
    );
    if (cleaned) {
      try { await failedToLoadHandle.remove(); } catch {}
    } else {
      listenerHandles.push(failedToLoadHandle);
    }

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
    if (callbacks.onError) {
      callbacks.onError(err);
    }
    return {
      success: false,
      error: err?.message || "Ödüllü reklam yüklenemedi."
    };
  }
}

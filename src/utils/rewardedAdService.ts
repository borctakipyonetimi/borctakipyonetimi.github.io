/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Official Google AdMob Identifiers configured for Bütçem Pro
export const ADMOB_CONFIG = {
  PUBLISHER_ID: "pub-4449700232321088",
  APP_ID: "ca-app-pub-4449700232321088~4683751583",
  BANNER_ID: "ca-app-pub-4449700232321088/6318747286",
  REWARDED_VIDEO_ID: "ca-app-pub-4449700232321088/6123306166",
  BANNER_SLOT: "6318747286",
  REWARDED_SLOT: "6123306166",
  ADS_TXT_ENTRY: "google.com, pub-4449700232321088, DIRECT, f08c47fec0942fa0"
};

export type RewardedFeatureType = "ai" | "export" | "import" | "report" | "any";

const PASS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (1 gün)

export function getFeaturePassKey(feature: RewardedFeatureType | string = "any"): string {
  const cleanFeature = (feature || "any").toLowerCase().trim();
  return `butcem_rewarded_pass_${cleanFeature}_expiry`;
}

/**
 * Checks if the user currently has an active 24-hour pass for a SPECIFIC feature,
 * or has permanent PRO status. Watching an ad for one feature (e.g. AI) only unlocks
 * that specific feature and does NOT unlock others (e.g. Export or Import).
 */
export function isPassActive(feature: RewardedFeatureType | string = "any"): boolean {
  if (typeof window === "undefined") return false;
  
  // Premium users have permanent access to all features without ads
  if (localStorage.getItem("is_premium") === "true") {
    return true;
  }

  const cleanFeature = (feature || "any").toLowerCase().trim();
  const key = getFeaturePassKey(cleanFeature);
  const expiry = Number(localStorage.getItem(key) || 0);
  
  return Date.now() < expiry;
}

/**
 * Gets formatted remaining time string for a specific feature (e.g., "23 saat 45 dk kaldı")
 */
export function getRemainingPassTimeFormatted(feature: RewardedFeatureType | string = "any"): string | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem("is_premium") === "true") return "Sınırsız (Premium)";

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
  if (localStorage.getItem("is_premium") === "true") return false;
  return !isPassActive(feature);
}

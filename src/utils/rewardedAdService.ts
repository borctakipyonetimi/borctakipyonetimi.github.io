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

const PASS_EXPIRY_KEY = "butcem_rewarded_pass_expiry";
const PASS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (1 gün)

/**
 * Checks if the user currently has an active 24-hour pass or premium status
 */
export function isPassActive(): boolean {
  if (typeof window === "undefined") return false;
  
  // Premium users have permanent access without ads
  if (localStorage.getItem("is_premium") === "true") {
    return true;
  }

  const expiry = Number(localStorage.getItem(PASS_EXPIRY_KEY) || 0);
  return Date.now() < expiry;
}

/**
 * Gets formatted remaining time string (e.g., "23 saat 45 dk kaldı")
 */
export function getRemainingPassTimeFormatted(): string | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem("is_premium") === "true") return "Sınırsız (Premium)";

  const expiry = Number(localStorage.getItem(PASS_EXPIRY_KEY) || 0);
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
 * Grants 24-hour full access to AI analysis, export, and import features
 */
export function grant24HourPass(): { expiresAt: number } {
  const expiresAt = Date.now() + PASS_DURATION_MS;
  if (typeof window !== "undefined") {
    localStorage.setItem(PASS_EXPIRY_KEY, String(expiresAt));
    window.dispatchEvent(
      new CustomEvent("rewarded_pass_updated", { detail: { expiresAt } })
    );
  }
  return { expiresAt };
}

/**
 * Determines whether a specific feature requires viewing a rewarded ad
 */
export function featureRequiresAd(feature: "ai" | "export" | "import" | "any"): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem("is_premium") === "true") return false;
  return !isPassActive();
}

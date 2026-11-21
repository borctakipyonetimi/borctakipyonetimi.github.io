import { Capacitor } from "@capacitor/core";

export const CLOUD_RUN_DEV_URL = "https://ais-dev-sta4ngj4pjhcez5qwcqjac-200839682182.europe-west2.run.app";
export const CLOUD_RUN_PRE_URL = "https://ais-pre-sta4ngj4pjhcez5qwcqjac-200839682182.europe-west2.run.app";
export const CLOUD_RUN_BACKEND_URL = CLOUD_RUN_DEV_URL;

function normalizeBaseUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getConfiguredEnvApiBaseUrl(): string | null {
  try {
    const env = (import.meta as any)?.env;
    return (
      normalizeBaseUrl(env?.VITE_API_BASE_URL) ||
      normalizeBaseUrl(env?.VITE_BACKEND_URL) ||
      null
    );
  } catch {
    return null;
  }
}

export function isCapacitorOrStaticLocalOrigin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // ignore
  }
  const { protocol, hostname, port } = window.location;
  if (
    protocol === "file:" ||
    protocol.startsWith("capacitor") ||
    protocol.startsWith("app")
  ) {
    return true;
  }
  // Capacitor Android/iOS serves static www/ on https://localhost or http://localhost without a backend port
  if ((hostname === "localhost" || hostname === "127.0.0.1") && !port) {
    return true;
  }
  if (
    hostname.includes("github.io") ||
    hostname.includes("borctakipyonetimi") ||
    hostname.includes("vercel.app") ||
    hostname.includes("netlify.app")
  ) {
    return true;
  }
  return false;
}

/**
 * Returns candidate base URLs to reach the Bütçem Pro backend server.
 */
export function getBackendCandidateUrls(): string[] {
  const candidates: string[] = [];
  const pushUnique = (url?: string | null) => {
    const norm = normalizeBaseUrl(url);
    if (norm && !candidates.includes(norm)) {
      candidates.push(norm);
    }
  };

  // 1. Optional custom configured server URL in localStorage
  if (typeof window !== "undefined") {
    try {
      pushUnique(localStorage.getItem("customServerUrl"));
    } catch {
      // ignore
    }
  }

  // 2. Optional build-time configured backend URL (if provided)
  pushUnique(getConfiguredEnvApiBaseUrl());

  // 3. Current origin only if we are NOT inside a static/Capacitor WebView bundle
  if (typeof window !== "undefined") {
    const { protocol, origin } = window.location;
    if (protocol.startsWith("http") && !isCapacitorOrStaticLocalOrigin()) {
      pushUnique(origin);
    }
  }

  return candidates;
}

/**
 * Resolves the API URL for the backend based on environment.
 * Never falls back to external preview servers when no backend URL is configured.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // 1. Optional custom server URL from app settings
  if (typeof window !== "undefined") {
    try {
      const savedServer = normalizeBaseUrl(localStorage.getItem("customServerUrl"));
      if (savedServer) {
        return `${savedServer}${cleanPath}`;
      }
    } catch {
      // ignore
    }
  }

  // 2. Optional build-time backend URL (only if explicitly configured)
  const envBase = getConfiguredEnvApiBaseUrl();
  if (envBase) {
    return `${envBase}${cleanPath}`;
  }

  // 3. Default to same-origin relative path (never send external server requests in APK/static builds)
  return cleanPath;
}

/**
 * Safely fetches JSON from an endpoint, handling non-JSON (HTML 404 / 500) responses gracefully
 * without calling external fallback servers when no server URL is configured.
 */
export async function safeFetchJson<T = any>(
  pathOrUrl: string,
  options?: RequestInit,
  fallbackBaseUrl?: string
): Promise<T> {
  const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const candidateUrls: string[] = [];

  if (pathOrUrl.startsWith("http")) {
    candidateUrls.push(pathOrUrl);
  } else {
    const initialUrl = getApiUrl(pathOrUrl);
    if (initialUrl.startsWith("http") || !isCapacitorOrStaticLocalOrigin()) {
      candidateUrls.push(initialUrl);
    }
  }

  if (fallbackBaseUrl) {
    const base = normalizeBaseUrl(fallbackBaseUrl);
    if (base) {
      const full = `${base}${cleanPath}`;
      if (!candidateUrls.includes(full)) {
        candidateUrls.push(full);
      }
    }
  }

  // Append configured candidate backends (never external Cloud Run URLs)
  if (typeof window !== "undefined" && !window.location.hostname.endsWith(".run.app")) {
    for (const base of getBackendCandidateUrls()) {
      const full = `${base}${cleanPath}`;
      if (!candidateUrls.includes(full)) {
        candidateUrls.push(full);
      }
    }
  }

  let primaryError: Error | null = null;
  let lastError: Error | null = null;

  for (let i = 0; i < candidateUrls.length; i++) {
    const currentUrl = candidateUrls[i];
    try {
      const res = await fetch(currentUrl, options);
      const rawText = await res.text();

      // Check if valid JSON
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        // Not valid JSON (likely HTML 404/cookie check/redirect), try next candidate
        continue;
      }

      if (!res.ok) {
        const appErr = new Error(json?.error || json?.message || `İşlem gerçekleştirilemedi (${res.status})`);
        if (i === 0) primaryError = appErr;
        throw appErr;
      }

      return json;
    } catch (err: any) {
      lastError = err;
      if (i === 0 && !primaryError) {
        primaryError = err;
      }
      // If error was an explicit application error from valid JSON, don't keep polling
      if (
        err?.message &&
        !err.message.includes("Failed to fetch") &&
        !err.message.includes("NetworkError") &&
        !err.message.includes("Sunucu beklenmeyen")
      ) {
        throw err;
      }
    }
  }

  // Check browser environment for static hosts
  const isStaticHost =
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith("github.io") ||
      window.location.hostname.endsWith("vercel.app") ||
      window.location.hostname.endsWith("netlify.app"));

  const finalMsg =
    primaryError?.message ||
    lastError?.message ||
    (isStaticHost
      ? "GitHub Pages statik bir sunucudur. Doğrudan canlı e-posta gönderimi için özel bir Node.js API sunucu URL'si bağlayabilir veya 'Mail Uygulamasında Aç (.EML)' butonunu kullanabilirsiniz."
      : "Sunucuya bağlanılamadı. Lütfen sunucu bağlantınızı kontrol ediniz.");
  throw new Error(finalMsg);
}

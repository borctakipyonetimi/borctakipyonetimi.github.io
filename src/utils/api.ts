export const CLOUD_RUN_DEV_URL = "https://ais-dev-sta4ngj4pjhcez5qwcqjac-200839682182.europe-west2.run.app";
export const CLOUD_RUN_PRE_URL = "https://ais-pre-sta4ngj4pjhcez5qwcqjac-200839682182.europe-west2.run.app";
export const CLOUD_RUN_BACKEND_URL = CLOUD_RUN_DEV_URL;

/**
 * Returns candidate base URLs to reach the Bütçem Pro email and notification server.
 */
export function getBackendCandidateUrls(): string[] {
  const candidates: string[] = [];

  // 1. Custom configured server URL in localStorage
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("customServerUrl")?.trim();
    if (custom) {
      candidates.push(custom.endsWith("/") ? custom.slice(0, -1) : custom);
    }
  }

  // 2. Current origin if valid
  if (typeof window !== "undefined") {
    const { protocol, origin, hostname } = window.location;
    if (protocol.startsWith("http")) {
      candidates.push(origin);
      // On Cloud Run domain, use current origin only to avoid cross-subdomain cookie check redirects
      if (hostname.endsWith(".run.app")) {
        return candidates;
      }
    }
  }

  // 3. Cloud Run URLs for external/static hosts only
  if (!candidates.includes(CLOUD_RUN_DEV_URL)) {
    candidates.push(CLOUD_RUN_DEV_URL);
  }
  if (!candidates.includes(CLOUD_RUN_PRE_URL)) {
    candidates.push(CLOUD_RUN_PRE_URL);
  }

  return candidates;
}

/**
 * Resolves the absolute API URL for the backend based on environment.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // 1. Custom server URL
  if (typeof window !== "undefined") {
    const savedServer = localStorage.getItem("customServerUrl")?.trim();
    if (savedServer) {
      const base = savedServer.endsWith("/") ? savedServer.slice(0, -1) : savedServer;
      return `${base}${cleanPath}`;
    }
  }

  // 2. Current browser environment
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;

    // If directly on *.run.app, relative path is direct
    if (hostname.endsWith(".run.app")) {
      return cleanPath;
    }

    // Packaged APK, Cordova, Capacitor, GitHub Pages, or local static files
    const isExternalOrStatic =
      protocol === "file:" ||
      protocol.startsWith("capacitor") ||
      protocol.startsWith("app") ||
      hostname.includes("github.io") ||
      hostname.includes("borctakipyonetimi") ||
      hostname.includes("vercel.app") ||
      hostname.includes("netlify.app") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.");

    if (isExternalOrStatic) {
      return `${CLOUD_RUN_DEV_URL}${cleanPath}`;
    }
  }

  return cleanPath;
}

/**
 * Safely fetches JSON from an endpoint, handling non-JSON (HTML 404 / 500) responses gracefully
 * and providing automatic multi-endpoint fallback across all candidate backend servers.
 */
export async function safeFetchJson<T = any>(
  pathOrUrl: string,
  options?: RequestInit,
  fallbackBaseUrl?: string
): Promise<T> {
  const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const initialUrl = pathOrUrl.startsWith("http") ? pathOrUrl : getApiUrl(pathOrUrl);

  const candidateUrls: string[] = [initialUrl];
  if (fallbackBaseUrl) {
    const base = fallbackBaseUrl.endsWith("/") ? fallbackBaseUrl.slice(0, -1) : fallbackBaseUrl;
    const full = `${base}${cleanPath}`;
    if (!candidateUrls.includes(full)) {
      candidateUrls.push(full);
    }
  }

  // Only append additional backend candidates if not running directly on *.run.app
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
        // Not valid JSON (likely HTML 404 page or redirect), try next candidate
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

  const finalMsg = primaryError?.message || lastError?.message || "E-posta sunucusuna bağlanılamadı.";
  throw new Error(finalMsg);
}


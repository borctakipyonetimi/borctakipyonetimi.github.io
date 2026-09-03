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

  // 2. Current origin if valid (e.g. running on web or container)
  if (typeof window !== "undefined") {
    const { protocol, origin, hostname } = window.location;
    if (protocol.startsWith("http") && !hostname.includes("localhost") && !hostname.includes("127.0.0.1")) {
      candidates.push(origin);
    }
  }

  // 3. Cloud Run URLs
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
    candidateUrls.push(`${base}${cleanPath}`);
  }

  for (const base of getBackendCandidateUrls()) {
    const full = `${base}${cleanPath}`;
    if (!candidateUrls.includes(full)) {
      candidateUrls.push(full);
    }
  }

  let lastError: Error | null = null;

  for (const currentUrl of candidateUrls) {
    try {
      const res = await fetch(currentUrl, options);
      const rawText = await res.text();

      // Check if valid JSON
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        // Not valid JSON (likely HTML 404 page or server error page), try next candidate URL
        continue;
      }

      if (!res.ok) {
        throw new Error(json?.error || json?.message || `İşlem gerçekleştirilemedi (${res.status})`);
      }

      return json;
    } catch (err: any) {
      lastError = err;
      // If error was an explicit application error from valid JSON, don't keep polling
      if (err?.message && !err.message.includes("Failed to fetch") && !err.message.includes("NetworkError") && !err.message.includes("Sunucu beklenmeyen")) {
        throw err;
      }
    }
  }

  throw new Error(
    lastError?.message ||
    "E-posta sunucusuna bağlanılamadı. Uygulamanız şu an çevrimdışı veya sunucu bağlantısı kapalı."
  );
}


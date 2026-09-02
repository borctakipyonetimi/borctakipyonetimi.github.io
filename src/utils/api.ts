export const CLOUD_RUN_BACKEND_URL = "https://ais-pre-sta4ngj4pjhcez5qwcqjac-200839682182.europe-west2.run.app";

/**
 * Resolves the absolute API URL for the backend based on environment.
 * If running inside an APK, WebView (using local files, capacitor, localhost, or file://), 
 * or on GitHub Pages (borctakipyonetimi.github.io),
 * it falls back to the production Cloud Run URL, and also reads from localStorage for custom server configurations.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // 1. Check if a custom server URL is specified in localStorage
  if (typeof window !== "undefined") {
    const savedServer = localStorage.getItem("customServerUrl")?.trim();
    if (savedServer) {
      const base = savedServer.endsWith("/") ? savedServer.slice(0, -1) : savedServer;
      return `${base}${cleanPath}`;
    }
  }

  // 2. Check current browser environment
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;

    // If we are currently running directly on the Cloud Run container (*.run.app), relative path is direct
    if (hostname.endsWith(".run.app")) {
      return cleanPath;
    }

    // Detect local environment, GitHub Pages, or packaged file protocols typical of APKs
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
      return `${CLOUD_RUN_BACKEND_URL}${cleanPath}`;
    }
  }

  // Otherwise, use the standard relative path
  return cleanPath;
}

/**
 * Safely fetches JSON from an endpoint, handling non-JSON (HTML 404 / 500) responses gracefully
 * and providing automatic fallback to the active Cloud Run backend server.
 */
export async function safeFetchJson<T = any>(
  pathOrUrl: string,
  options?: RequestInit,
  fallbackBaseUrl = CLOUD_RUN_BACKEND_URL
): Promise<T> {
  const targetUrl = pathOrUrl.startsWith("http") ? pathOrUrl : getApiUrl(pathOrUrl);

  let res: Response;
  try {
    res = await fetch(targetUrl, options);
  } catch (netErr: any) {
    const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    const altUrl = `${fallbackBaseUrl}${cleanPath}`;
    if (targetUrl !== altUrl) {
      try {
        res = await fetch(altUrl, options);
      } catch {
        throw new Error(netErr?.message || "Sunucuya erişilemedi. Lütfen internet bağlantınızı kontrol edin.");
      }
    } else {
      throw new Error(netErr?.message || "Sunucuya erişilemedi. Lütfen internet bağlantınızı kontrol edin.");
    }
  }

  const rawText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    // Response was not valid JSON (e.g. HTML 404 page from static host or error page)
    const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    const altUrl = `${fallbackBaseUrl}${cleanPath}`;
    if (targetUrl !== altUrl) {
      try {
        const altRes = await fetch(altUrl, options);
        const altText = await altRes.text();
        const altJson = JSON.parse(altText);
        if (!altRes.ok) {
          throw new Error(altJson?.error || altJson?.message || `Sunucu hatası (${altRes.status})`);
        }
        return altJson;
      } catch (altErr: any) {
        if (altErr?.message && !altErr.message.includes("Unexpected token")) {
          throw altErr;
        }
      }
    }

    throw new Error(`Sunucu beklenmeyen bir yanıt döndürdü (${res.status} ${res.statusText || ""}).`);
  }

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `İşlem gerçekleştirilemedi (${res.status})`);
  }

  return json;
}


/**
 * Resolves the absolute API URL for the backend based on environment.
 * If running inside an APK, WebView (using local files, capacitor, localhost, or file://), 
 * it falls back to the production Cloud Run URL, and also reads from localStorage for custom server configurations.
 */
export function getApiUrl(path: string): string {
  // Check if a custom server URL is specified in localStorage
  const savedServer = localStorage.getItem("customServerUrl")?.trim();
  if (savedServer) {
    const base = savedServer.endsWith("/") ? savedServer.slice(0, -1) : savedServer;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }

  // Detect local environment or packaged file protocols typical of APKs
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  const isApkOrPacked = 
    protocol === "file:" || 
    protocol.startsWith("capacitor") || 
    protocol.startsWith("app") ||
    hostname === "localhost" || 
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168."); // common local network APK testing

  if (isApkOrPacked) {
    // Fallback to our compiled/shared deployment URL
    const fallbackBase = "https://ais-pre-jq2fqdbd4ijsq6vv7lfvkr-200839682182.europe-west2.run.app";
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${fallbackBase}${cleanPath}`;
  }

  // Otherwise, use the standard relative path as it is a standard web-served client on the correct domain
  return path;
}

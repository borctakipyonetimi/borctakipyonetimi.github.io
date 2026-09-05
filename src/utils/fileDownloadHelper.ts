import { isAndroidAlarmBridgeAvailable, saveAndroidNativeBackupFile } from "./androidAlarmBridge";

export interface DownloadFileOptions {
  fileName: string;
  content: string;
  mimeType?: string;
  onSuccess?: () => void;
  onError?: (err: any) => void;
}

/**
 * Universal file download helper designed specifically to ensure custom file names
 * are never replaced with generic "json" or "download.json" across Web browsers,
 * Android WebViews, and installed APK packages.
 */
export async function downloadFileWithCustomName(options: DownloadFileOptions): Promise<boolean> {
  const { fileName, content, mimeType = "application/json;charset=utf-8", onSuccess, onError } = options;

  // 1. Check if running inside Android APK with Native Alarm/File Bridge
  if (isAndroidAlarmBridgeAvailable()) {
    try {
      const saved = saveAndroidNativeBackupFile(fileName, content);
      if (saved) {
        if (onSuccess) onSuccess();
        return true;
      }
    } catch (e) {
      console.warn("[downloadFileWithCustomName] Android native save fallback:", e);
    }
  }

  // 2. Detect if inside mobile WebView where client-side blob <a download> might be ignored by OS
  const isWebView = typeof window !== "undefined" && (
    /wv/i.test(navigator.userAgent) || 
    /Android.*Version\/[0-9.]+/i.test(navigator.userAgent) ||
    (window as any).Android ||
    (window as any).AndroidAlarm ||
    !(window.Notification)
  );

  // 3. For standard desktop/mobile browsers that fully respect HTML5 a[download]
  if (!isWebView) {
    try {
      const blob = new Blob([content], { type: mimeType });
      const localUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = localUrl;
      link.setAttribute("download", fileName);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(localUrl);
      }, 800);
      if (onSuccess) onSuccess();
      return true;
    } catch (e) {
      console.warn("[downloadFileWithCustomName] Blob download error, trying server bridge:", e);
    }
  }

  // 4. Mobile WebView fallback: Route via server endpoint with explicit filename in URL path & query
  try {
    const res = await fetch("/api/temp-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, filename: fileName })
    });
    const data = await res.json();
    if (data.success && data.key) {
      const encodedName = encodeURIComponent(fileName);
      const downloadUrl = `/api/download-temp/${encodedName}?key=${data.key}&filename=${encodedName}`;
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.setAttribute("download", fileName);
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      setTimeout(() => {
        if (document.body.contains(downloadLink)) {
          document.body.removeChild(downloadLink);
        }
      }, 1000);
      if (onSuccess) onSuccess();
      return true;
    }
  } catch (err) {
    console.error("[downloadFileWithCustomName] Server download temp error:", err);
    if (onError) onError(err);
  }

  return false;
}

import { 
  isAndroidAlarmBridgeAvailable, 
  saveAndroidNativeFile, 
  saveAndroidNativeBackupFile,
  saveAndroidNativeImageToGallery 
} from "./androidAlarmBridge";

export interface DownloadFileOptions {
  fileName: string;
  content: string;
  mimeType?: string;
  onSuccess?: () => void;
  onError?: (err: any) => void;
}

export interface SaveImageOptions {
  fileName: string;
  base64Data: string;
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

  // 1. Android APK / Native Bridge Kontrolü:
  // Eğer Android ortamındaysak, doğrudan Android MediaStore / Downloads APIsini çağırır.
  // Bu sayede Android sistemi asla generic 'download.json' veya 'download (1).json' üretmez!
  if (isAndroidAlarmBridgeAvailable()) {
    try {
      const saved = saveAndroidNativeFile(fileName, content, mimeType);
      if (saved) {
        if (onSuccess) onSuccess();
        return true;
      }
    } catch (e) {
      console.warn("[downloadFileWithCustomName] Android native save fallback:", e);
    }
  }

  // 2. Doğrudan Tarayıcı İndirmesi (Blob + HTML5 <a> download)
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
    console.warn("[downloadFileWithCustomName] Blob download error, trying server fallback:", e);
  }

  // 3. Fallback: Sunucu üzerinden açık dosya adı ile indirme
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

/**
 * Resim, dekont ve fotoğrafları Galeri / Pictures klasörüne kaydetme yardımcısı
 */
export function saveImageToGalleryWithCustomName(options: SaveImageOptions): boolean {
  const { fileName, base64Data, mimeType = "image/jpeg", onSuccess, onError } = options;

  if (isAndroidAlarmBridgeAvailable()) {
    try {
      const saved = saveAndroidNativeImageToGallery(fileName, base64Data, mimeType);
      if (saved) {
        if (onSuccess) onSuccess();
        return true;
      }
    } catch (e) {
      console.warn("[saveImageToGalleryWithCustomName] Android native save error:", e);
    }
  }

  // Tarayıcı indirme fallback'i
  try {
    const link = document.createElement("a");
    link.href = base64Data;
    link.setAttribute("download", fileName);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 800);
    if (onSuccess) onSuccess();
    return true;
  } catch (err) {
    if (onError) onError(err);
    return false;
  }
}

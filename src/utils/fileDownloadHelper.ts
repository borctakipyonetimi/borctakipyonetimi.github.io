import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { 
  isAndroidAlarmBridgeAvailable, 
  saveAndroidNativeFile, 
  saveAndroidNativeBackupFile,
  saveAndroidNativeImageToGallery 
} from "./androidAlarmBridge";
import { getApiUrl } from "./api";

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

  // 1. Capacitor Native Android / iOS APK Platformu (Doğrudan Documents / Downloads klasörüne yazar)
  if (Capacitor.isNativePlatform()) {
    try {
      const isBase64 = content.startsWith("data:") || (mimeType && mimeType.startsWith("image/"));
      const cleanData = isBase64 && content.includes(",") ? content.split(",")[1] : content;

      await Filesystem.writeFile({
        path: fileName,
        data: cleanData,
        directory: Directory.Documents,
        encoding: isBase64 ? undefined : Encoding.UTF8,
        recursive: true
      });

      if (onSuccess) onSuccess();
      return true;
    } catch (capErr) {
      console.warn("[downloadFileWithCustomName] Capacitor native write error:", capErr);
    }
  }

  // 2. Android Cordova / WebView Native Bridge Kontrolü:
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

  // 3. Doğrudan Tarayıcı İndirmesi (Blob + HTML5 <a> download)
  // Türkçe karakter desteği ve Excel için CSV/metin içeriklerine UTF-8 BOM eklenir
  try {
    const isCsvOrText = mimeType.includes("csv") || mimeType.includes("text");
    const contentToDownload = isCsvOrText && typeof content === "string" && !content.startsWith("\uFEFF")
      ? `\uFEFF${content}`
      : content;

    const blob = new Blob([contentToDownload], { type: mimeType });
    const localUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
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
    }, 1500);

    if (onSuccess) onSuccess();
    return true;
  } catch (e) {
    console.warn("[downloadFileWithCustomName] Blob download error, trying Data URI and server fallbacks:", e);
  }

  // 4. Data URI Fallback
  try {
    const isCsvOrText = mimeType.includes("csv") || mimeType.includes("text");
    const contentToDownload = isCsvOrText && typeof content === "string" && !content.startsWith("\uFEFF")
      ? `\uFEFF${content}`
      : content;
    const encodedUri = `data:${mimeType};charset=utf-8,${encodeURIComponent(contentToDownload)}`;
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = encodedUri;
    link.setAttribute("download", fileName);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 1500);
    if (onSuccess) onSuccess();
    return true;
  } catch (dataUriErr) {
    console.warn("[downloadFileWithCustomName] Data URI download error:", dataUriErr);
  }

  // 5. Sunucu üzerinden geçici dosya indirme fallback'i
  try {
    const res = await fetch(getApiUrl("/api/temp-backup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, filename: fileName })
    });
    const data = await res.json();
    if (data.success && data.key) {
      const encodedName = encodeURIComponent(fileName);
      const downloadUrl = getApiUrl(`/api/download-temp/${encodedName}?key=${data.key}&filename=${encodedName}`);
      const downloadLink = document.createElement("a");
      downloadLink.style.display = "none";
      downloadLink.href = downloadUrl;
      downloadLink.setAttribute("download", fileName);
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      setTimeout(() => {
        if (document.body.contains(downloadLink)) {
          document.body.removeChild(downloadLink);
        }
      }, 1500);
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
export async function saveImageToGalleryWithCustomName(options: SaveImageOptions): Promise<boolean> {
  const { fileName, base64Data, mimeType = "image/jpeg", onSuccess, onError } = options;

  // 1. Capacitor Native Android / iOS APK
  if (Capacitor.isNativePlatform()) {
    try {
      const cleanData = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: cleanData,
        directory: Directory.Documents,
        recursive: true
      });

      let shareUri = writeResult.uri;
      try {
        const cacheRes = await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Cache,
          recursive: true
        });
        shareUri = cacheRes.uri;
      } catch {}

      try {
        await Share.share({
          title: fileName,
          url: shareUri,
          dialogTitle: "Görseli Kaydet veya Paylaş"
        });
      } catch {}

      if (onSuccess) onSuccess();
      return true;
    } catch (e) {
      console.warn("[saveImageToGalleryWithCustomName] Capacitor native write error:", e);
    }
  }

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

/**
 * Universally downloads or shares any jsPDF document across Web, Android WebViews,
 * Capacitor native containers, and mobile browsers.
 */
export async function savePdfDocument(doc: any, fileName: string): Promise<boolean> {
  // Ensure valid .pdf extension
  const safeName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;

  // 1. Capacitor Native Platform (Android / iOS APK)
  if (Capacitor.isNativePlatform()) {
    try {
      const dataUri = doc.output("datauristring");
      const success = await downloadFileWithCustomName({
        fileName: safeName,
        content: dataUri,
        mimeType: "application/pdf"
      });
      if (success) return true;
    } catch (e) {
      console.warn("[savePdfDocument] Capacitor native failed, attempting fallback:", e);
    }
  }

  // 2. Android Native Alarm/Cordova Bridge
  if (isAndroidAlarmBridgeAvailable()) {
    try {
      const dataUri = doc.output("datauristring");
      const saved = saveAndroidNativeFile(safeName, dataUri, "application/pdf");
      if (saved) return true;
    } catch (e) {
      console.warn("[savePdfDocument] Android bridge failed:", e);
    }
  }

  // 3. Native jsPDF doc.save
  try {
    doc.save(safeName);
    return true;
  } catch (saveErr) {
    console.warn("[savePdfDocument] doc.save failed, trying blob link:", saveErr);
  }

  // 4. Blob URL with HTML5 download link
  try {
    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1500);
    return true;
  } catch (blobErr) {
    console.warn("[savePdfDocument] Blob download failed:", blobErr);
  }

  // 5. Data URI fallback via downloadFileWithCustomName
  try {
    const dataUri = doc.output("datauristring");
    return await downloadFileWithCustomName({
      fileName: safeName,
      content: dataUri,
      mimeType: "application/pdf"
    });
  } catch (err) {
    console.error("[savePdfDocument] All PDF download methods failed:", err);
    return false;
  }
}

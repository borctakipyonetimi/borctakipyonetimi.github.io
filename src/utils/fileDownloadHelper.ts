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
  openShareSheet?: boolean;
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

export interface PrintHtmlOptions {
  html: string;
  jobName?: string;
  pdfFallback?: () => Promise<boolean | void>;
  onStatus?: (type: "success" | "info" | "error", text: string) => void;
}

function isRunningInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|wv/i.test(navigator.userAgent);
}

function hasLegacyAndroidNativeFileBridge(): boolean {
  if (typeof window === "undefined") return false;
  const anyWin = window as any;
  const bridge = anyWin.AndroidAlarm || anyWin.ButcemAndroidBridge || anyWin.NativeBridge;
  return Boolean(
    bridge && (typeof bridge.saveFile === "function" || typeof bridge.saveBackupFile === "function")
  );
}

/**
 * Universal file download helper designed specifically to ensure custom file names
 * are never replaced with generic "json" or "download.json" across Web browsers,
 * Android WebViews, and installed APK packages.
 */
export async function downloadFileWithCustomName(options: DownloadFileOptions): Promise<boolean> {
  const { fileName, content, mimeType = "application/json;charset=utf-8", openShareSheet = false, onSuccess, onError } = options;
  const safeFileName = fileName.replace(/[\/\\?%*:|"<>]/g, "_");

  // 1. Capacitor Native Android / iOS APK Platformu
  if (Capacitor.isNativePlatform()) {
    try {
      const isBinaryBase64 = content.startsWith("data:") || (mimeType && (mimeType.startsWith("image/") || mimeType.includes("pdf")));
      const commaIdx = content.indexOf(",");
      const cleanData = isBinaryBase64 && commaIdx !== -1 ? content.slice(commaIdx + 1) : content;

      // Always write cleanly to app Cache first (works on all Android versions without Scoped Storage errors)
      const cacheRes = await Filesystem.writeFile({
        path: safeFileName,
        data: cleanData,
        directory: Directory.Cache,
        encoding: isBinaryBase64 ? undefined : Encoding.UTF8,
        recursive: true
      });

      // Best-effort persistent copy to Documents folder (use unique fallback name if file already exists from prior install)
      let savedToDocuments = false;
      try {
        await Filesystem.writeFile({
          path: safeFileName,
          data: cleanData,
          directory: Directory.Documents,
          encoding: isBinaryBase64 ? undefined : Encoding.UTF8,
          recursive: true
        });
        savedToDocuments = true;
      } catch {
        try {
          const extIdx = safeFileName.lastIndexOf(".");
          const uniqueName = extIdx > 0
            ? `${safeFileName.slice(0, extIdx)}_${Date.now().toString().slice(-4)}${safeFileName.slice(extIdx)}`
            : `${safeFileName}_${Date.now().toString().slice(-4)}`;
          await Filesystem.writeFile({
            path: `ButcemPro/${uniqueName}`,
            data: cleanData,
            directory: Directory.Documents,
            encoding: isBinaryBase64 ? undefined : Encoding.UTF8,
            recursive: true
          });
          savedToDocuments = true;
        } catch (docErr) {
          console.warn("[downloadFileWithCustomName] Documents copy skipped:", docErr);
        }
      }

      // On mobile APK, PDFs and requested exports (or when Documents failed) open the native Share/Open/Save sheet
      if (openShareSheet || mimeType.includes("pdf") || !savedToDocuments) {
        try {
          await Share.share({
            title: safeFileName,
            text: `Bütçem Pro • ${safeFileName}`,
            url: cacheRes.uri,
            dialogTitle: mimeType.includes("pdf")
              ? "PDF Raporunu Aç / Kaydet / Yazdır"
              : "Dosyayı Kaydet veya Paylaş"
          });
        } catch (shareErr: any) {
          const msg = String(shareErr?.message || "").toLowerCase();
          const isCancel = shareErr?.name === "AbortError" || msg.includes("cancel") || msg.includes("abort");
          if (!isCancel) {
            console.warn("[downloadFileWithCustomName] Share.share error:", shareErr);
            if (!savedToDocuments) throw shareErr;
          }
        }
      }

      if (onSuccess) onSuccess();
      return true;
    } catch (capErr) {
      console.warn("[downloadFileWithCustomName] Capacitor native write error:", capErr);
    }
  }

  // 2. Android Cordova / WebView Legacy Native Bridge Kontrolü (sadece gerçek köprü varsa):
  if (hasLegacyAndroidNativeFileBridge() && isAndroidAlarmBridgeAvailable()) {
    try {
      const saved = saveAndroidNativeFile(safeFileName, content, mimeType);
      if (saved) {
        if (onSuccess) onSuccess();
        return true;
      }
    } catch (e) {
      console.warn("[downloadFileWithCustomName] Android native save fallback:", e);
    }
  }

  // 3. Doğrudan Tarayıcı İndirmesi (Blob + HTML5 <a> download)
  try {
    let blobData: BlobPart = content;
    if (content.startsWith("data:") && content.includes(";base64,")) {
      const base64Part = content.split(",")[1];
      const binaryStr = atob(base64Part);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      blobData = bytes;
    } else {
      const isCsvOrText = mimeType.includes("csv") || mimeType.includes("text");
      blobData = isCsvOrText && typeof content === "string" && !content.startsWith("\uFEFF")
        ? `\uFEFF${content}`
        : content;
    }

    const blob = new Blob([blobData], { type: mimeType });
    const localUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = localUrl;
    link.setAttribute("download", safeFileName);
    link.download = safeFileName;
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
    const isAlreadyDataUri = content.startsWith("data:");
    const isCsvOrText = mimeType.includes("csv") || mimeType.includes("text");
    const contentToDownload = !isAlreadyDataUri && isCsvOrText && typeof content === "string" && !content.startsWith("\uFEFF")
      ? `\uFEFF${content}`
      : content;
    const encodedUri = isAlreadyDataUri
      ? content
      : `data:${mimeType};charset=utf-8,${encodeURIComponent(contentToDownload)}`;
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = encodedUri;
    link.setAttribute("download", safeFileName);
    link.download = safeFileName;
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

  // 5. Sunucu üzerinden geçici dosya indirme fallback'i (yalnızca backend varsa)
  try {
    const res = await fetch(getApiUrl("/api/temp-backup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, filename: safeFileName })
    });
    const data = await res.json();
    if (data.success && data.key) {
      const encodedName = encodeURIComponent(safeFileName);
      const downloadUrl = getApiUrl(`/api/download-temp/${encodedName}?key=${data.key}&filename=${encodedName}`);
      const downloadLink = document.createElement("a");
      downloadLink.style.display = "none";
      downloadLink.href = downloadUrl;
      downloadLink.setAttribute("download", safeFileName);
      downloadLink.download = safeFileName;
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

  if (onError) onError(new Error("Dosya indirilemedi"));
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
      const cacheRes = await Filesystem.writeFile({
        path: fileName,
        data: cleanData,
        directory: Directory.Cache,
        recursive: true
      });

      try {
        await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Documents,
          recursive: true
        });
      } catch {}

      try {
        await Share.share({
          title: fileName,
          url: cacheRes.uri,
          dialogTitle: "Görseli Kaydet veya Paylaş"
        });
      } catch {}

      if (onSuccess) onSuccess();
      return true;
    } catch (e) {
      console.warn("[saveImageToGalleryWithCustomName] Capacitor native write error:", e);
    }
  }

  if (hasLegacyAndroidNativeFileBridge() && isAndroidAlarmBridgeAvailable()) {
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
  const safeName = (fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`).replace(/[\/\\?%*:|"<>]/g, "_");
  const inIframe = isRunningInIframe();
  const isMobile = isMobileUserAgent();

  // 1. Capacitor Native Platform (Android / iOS APK) — Cache + Documents + System Share/Open Sheet
  if (Capacitor.isNativePlatform()) {
    try {
      const dataUri = doc.output("datauristring");
      const success = await downloadFileWithCustomName({
        fileName: safeName,
        content: dataUri,
        mimeType: "application/pdf",
        openShareSheet: true
      });
      if (success) return true;
    } catch (e) {
      console.warn("[savePdfDocument] Capacitor native failed, attempting fallback:", e);
    }
  }

  // 2. Desktop File System Access API (skip in Capacitor, mobile browsers, and cross-origin iframes)
  if (!Capacitor.isNativePlatform() && !isMobile && !inIframe && typeof window !== "undefined" && typeof (window as any).showSaveFilePicker === "function") {
    try {
      const opts = {
        suggestedName: safeName,
        types: [{
          description: "PDF Document",
          accept: { "application/pdf": [".pdf"] }
        }]
      };
      const handle = await (window as any).showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      const pdfBlob = doc.output("blob");
      await writable.write(pdfBlob);
      await writable.close();
      return true;
    } catch (pickerErr: any) {
      if (pickerErr?.name === "AbortError") {
        return false;
      }
      console.warn("[savePdfDocument] showSaveFilePicker error, falling back:", pickerErr);
    }
  }

  // 3. Legacy Android WebView Bridge (only when genuine JS interface exists)
  if (hasLegacyAndroidNativeFileBridge() && isAndroidAlarmBridgeAvailable()) {
    try {
      const dataUri = doc.output("datauristring");
      const saved = saveAndroidNativeFile(safeName, dataUri, "application/pdf");
      if (saved) return true;
    } catch (e) {
      console.warn("[savePdfDocument] Android bridge failed:", e);
    }
  }

  // 4. Blob URL with HTML5 download link (most reliable across browsers & iframes)
  try {
    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", safeName);
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
    console.warn("[savePdfDocument] Blob download failed, trying doc.save:", blobErr);
  }

  // 5. Native jsPDF doc.save
  try {
    doc.save(safeName);
    return true;
  } catch (saveErr) {
    console.warn("[savePdfDocument] doc.save failed, trying datauristring:", saveErr);
  }

  // 6. Data URI fallback via downloadFileWithCustomName
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

/**
 * Universal HTML Print helper that avoids window.open() popups, uses Android's
 * native PrintManager inside Capacitor APK, uses isolated @media print DOM injection
 * on Web, and automatically falls back to PDF export if a sandboxed iframe blocks printing.
 */
export async function printHtmlReport(options: PrintHtmlOptions): Promise<boolean> {
  const { html, jobName = "Butcem_Pro_Rapor", pdfFallback, onStatus } = options;
  const safeTitle = jobName.replace(/[\/\\?%*:|"<>]/g, "_");
  const fullHtml = /<html[\s>]/i.test(html)
    ? html
    : `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { background: #ffffff !important; color: #0f172a !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 12px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>${html}</body>
</html>`;

  // 1. Capacitor Native Android APK: use native AndroidPrint PrintManager JavascriptInterface
  if (typeof window !== "undefined") {
    const androidPrint = (window as any).AndroidPrint;
    if (androidPrint && typeof androidPrint.printHtml === "function") {
      try {
        androidPrint.printHtml(fullHtml, safeTitle);
        onStatus?.("success", "Yazdırma penceresi açıldı. Yazıcı seçebilir veya 'PDF olarak kaydet' yapabilirsiniz.");
        return true;
      } catch (nativePrintErr) {
        console.warn("[printHtmlReport] AndroidPrint.printHtml error:", nativePrintErr);
      }
    }
  }

  // If Capacitor Native lacks AndroidPrint (e.g. iOS or older wrapper), export PDF directly so Print never silently fails
  if (Capacitor.isNativePlatform()) {
    if (pdfFallback) {
      onStatus?.("info", "Mobil yazdırma için PDF dosyası hazırlanıyor...");
      const pdfOk = await pdfFallback();
      if (pdfOk) {
        onStatus?.("success", "PDF raporu açıldı — paylaşım menüsünden Yazdır veya Kaydet seçebilirsiniz.");
        return true;
      }
    }
    onStatus?.("error", "Doğrudan yazdırma başlatılamadı. Lütfen 'PDF Al' butonunu kullanın.");
    return false;
  }

  // 2. Web / Desktop / Iframe: Inject isolated print container and invoke window.print()
  if (typeof document === "undefined" || typeof window === "undefined") return false;

  const existingContainer = document.getElementById("print-container-temp");
  if (existingContainer) existingContainer.remove();
  const existingStyle = document.getElementById("print-style-temp");
  if (existingStyle) existingStyle.remove();

  const printContainer = document.createElement("div");
  printContainer.id = "print-container-temp";
  printContainer.style.position = "fixed";
  printContainer.style.left = "0";
  printContainer.style.top = "0";
  printContainer.style.width = "100%";
  printContainer.style.minHeight = "100vh";
  printContainer.style.backgroundColor = "#ffffff";
  printContainer.style.color = "#0f172a";
  printContainer.style.zIndex = "-1";
  printContainer.style.opacity = "0";
  printContainer.style.pointerEvents = "none";
  printContainer.innerHTML = html;
  document.body.appendChild(printContainer);

  const printStyle = document.createElement("style");
  printStyle.id = "print-style-temp";
  printStyle.innerHTML = `
    @media print {
      @page { size: A4; margin: 12mm; }
      html, body {
        background-color: #ffffff !important;
        color: #0f172a !important;
        height: auto !important;
        overflow: visible !important;
      }
      body > *:not(#print-container-temp) {
        display: none !important;
      }
      #print-container-temp {
        position: static !important;
        opacity: 1 !important;
        z-index: 999999 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        width: 100% !important;
        min-height: auto !important;
      }
      #print-container-temp, #print-container-temp * {
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;
  document.head.appendChild(printStyle);

  const cleanup = () => {
    printContainer.remove();
    printStyle.remove();
  };

  return await new Promise<boolean>((resolve) => {
    setTimeout(async () => {
      let printEventFired = false;
      const onBeforePrint = () => {
        printEventFired = true;
      };
      window.addEventListener("beforeprint", onBeforePrint);

      try {
        const startTime = Date.now();
        window.print();
        const elapsed = Date.now() - startTime;
        window.removeEventListener("beforeprint", onBeforePrint);

        setTimeout(cleanup, 800);

        const inIframe = isRunningInIframe();
        if (printEventFired || elapsed > 120 || !inIframe) {
          onStatus?.("success", "Yazdırma penceresi açıldı.");
          resolve(true);
          return;
        }

        // Sandboxed iframe silently ignored window.print()
        if (pdfFallback) {
          onStatus?.("info", "Bu pencerede tarayıcı yazıcısı kısıtlı olduğu için raporunuz PDF olarak indiriliyor...");
          const pdfOk = await pdfFallback();
          resolve(Boolean(pdfOk));
          return;
        }

        onStatus?.("error", "Tarayıcı doğrudan yazdırmayı bu pencerede kısıtlıyor. Lütfen 'PDF Al' butonunu kullanın.");
        resolve(false);
      } catch (err) {
        window.removeEventListener("beforeprint", onBeforePrint);
        cleanup();
        console.warn("[printHtmlReport] window.print failed:", err);

        if (pdfFallback) {
          onStatus?.("info", "Doğrudan yazdırma açılamadı; raporunuz PDF olarak indiriliyor...");
          const pdfOk = await pdfFallback();
          resolve(Boolean(pdfOk));
          return;
        }

        onStatus?.("error", "Yazdırma başlatılamadı. Lütfen 'PDF Al' butonunu kullanın.");
        resolve(false);
      }
    }, 120);
  });
}


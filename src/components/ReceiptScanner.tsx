import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Camera, 
  Upload, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Image as ImageIcon, 
  Download,
  X,
  ScanLine,
  ChevronDown,
  Monitor,
  Key,
  Eye,
  EyeOff
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  Camera as CapacitorCamera,
  CameraDirection,
  CameraResultType,
  CameraSource
} from "@capacitor/camera";
import { isCapacitorOrStaticLocalOrigin } from "../utils/api";
import { saveImageToGalleryWithCustomName } from "../utils/fileDownloadHelper";
import {
  GEMINI_KEY_UPDATED_EVENT,
  clearGeminiApiKey,
  getBuildGeminiApiKey,
  getStoredGeminiApiKey,
  hasAnyGeminiApiKey,
  saveGeminiApiKey
} from "../utils/geminiKeyStorage";

export interface ScannedReceiptResult {
  title: string;
  amount: number;
  date: string;
  categorySuggestion: string;
  type: "expense" | "debt";
}

interface ReceiptScannerProps {
  onScanCompleted: (result: ScannedReceiptResult) => void;
  onClose: () => void;
  defaultType?: "expense" | "debt";
}

/**
 * Client-side image compressor:
 * Downscales images to max 1280px dimension and converts to JPEG quality 0.8.
 * Validates non-empty image dimensions and base64 payload before OCR transmission.
 */
async function optimizeImageForOcr(fileOrDataUrl: File | string): Promise<{ base64: string; mimeType: string }> {
  if (!fileOrDataUrl) {
    throw new Error("Taranacak görsel verisi bulunamadı.");
  }
  if (typeof fileOrDataUrl === "string") {
    const trimmed = fileOrDataUrl.trim();
    if (!trimmed || (trimmed.startsWith("data:") && (!trimmed.includes(",") || trimmed.split(",")[1].length < 50))) {
      throw new Error("Yakalanan görsel verisi boş veya bozuk. Lütfen tekrar çekin.");
    }
  } else if (fileOrDataUrl.size === 0) {
    throw new Error("Seçilen dosya boş (0 bayt). Lütfen geçerli bir görsel seçin.");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (typeof fileOrDataUrl === "string" && /^https?:/i.test(fileOrDataUrl)) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      try {
        if (!img.width || !img.height || img.width < 10 || img.height < 10) {
          reject(new Error("Görsel boyutları çok küçük veya bozuk. Lütfen net bir fotoğraf çekin."));
          return;
        }

        const MAX_DIMENSION = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Görsel işleme tuvali (canvas) başlatılamadı. Lütfen tekrar deneyin."));
          return;
        }

        // Draw with smoothing for high-quality text edges
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        if (compressedDataUrl.length > 950000) {
          compressedDataUrl = canvas.toDataURL("image/jpeg", 0.74);
        }
        if (compressedDataUrl.length > 1400000) {
          compressedDataUrl = canvas.toDataURL("image/jpeg", 0.62);
        }
        const commaIdx = compressedDataUrl.indexOf(",");
        if (!compressedDataUrl.startsWith("data:image/") || commaIdx === -1 || compressedDataUrl.slice(commaIdx + 1).length < 100) {
          reject(new Error("Görsel sıkıştırılırken boş veri üretildi. Lütfen tekrar deneyin."));
          return;
        }

        resolve({ base64: compressedDataUrl, mimeType: "image/jpeg" });
      } catch (e: any) {
        reject(new Error(e?.message || "Görsel sıkıştırılırken bir hata oluştu."));
      }
    };

    img.onerror = () => {
      reject(new Error("Görsel yüklenemedi veya bozuk. Lütfen geçerli bir resim seçin."));
    };

    if (typeof fileOrDataUrl === "string") {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result) {
          reject(new Error("Görsel dosyası okunamadı."));
          return;
        }
        img.src = result;
      };
      reader.onerror = () => reject(new Error("Görsel dosyası okunurken hata oluştu."));
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

function parseOcrAmount(rawAmount: unknown): number {
  if (typeof rawAmount === "number") {
    return Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;
  }
  if (typeof rawAmount !== "string") return 0;
  let cleaned = rawAmount.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return 0;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function normalizeOcrDate(rawDate: unknown): string {
  const raw = typeof rawDate === "string" ? rawDate.trim() : "";
  const ymd = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }
  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return "";
}

async function scanReceiptDirectlyWithGemini(params: {
  base64DataUrl: string;
  mimeType: string;
  apiKey: string;
  defaultType: "expense" | "debt";
}): Promise<{
  title: string;
  amount: number;
  date: string;
  categorySuggestion: string;
  type: "expense" | "debt";
  warning?: string;
}> {
  const { base64DataUrl, mimeType, apiKey, defaultType } = params;
  const commaIdx = base64DataUrl.indexOf(",");
  const pureBase64 = (commaIdx !== -1 ? base64DataUrl.slice(commaIdx + 1) : base64DataUrl).replace(/\s+/g, "");
  let effectiveMime = mimeType || "image/jpeg";
  if (commaIdx !== -1) {
    const headerMatch = base64DataUrl.slice(0, commaIdx).match(/data:([^;]+);base64/i);
    if (headerMatch?.[1]) {
      effectiveMime = headerMatch[1].trim();
    }
  }

  const promptText =
    "Sen Türkiye'deki fiş, fatura, adisyon, dekont ve makbuzları okuyan uzman bir yapay zeka OCR sistemisin.\n\n" +
    "KESİN KURAL: Yalnızca ekteki görselde GERÇEKTEN GÖRDÜĞÜN ve OKUYABİLDİĞİN metinleri ve rakamları çıkar. Asla varsayım yapma veya örnek bilgi uydurma. Görsel boşsa, tek renkse, ilgisiz bir fotoğraf ise veya üzerindeki yazılar okunamayacak kadar bulanıksa `isReadableReceipt: false`, `title: \"\"`, `amount: 0`, `date: \"\"` döndür.\n\n" +
    "Görsel okunabilir bir fiş/fatura ise şu alanları JSON olarak döndür:\n" +
    "1. isReadableReceipt: Görsel gerçekten okunabilir bir fiş, fatura, makbuz veya dekont ise true; boş veya okunaksız ise false.\n" +
    "2. title: Belgedeki satıcı, mağaza, banka veya kurumun gerçek unvanı. Okunamıyorsa boş string \"\" döndür.\n" +
    "3. amount: Belgedeki ödenecek nihai toplam tutar (TOPLAM, GENEL TOPLAM, ÖDENECEK TUTAR, SON ÖDEME TUTARI; KDV dahil son tutarı nokta ondalık ayıracı ile döndür, örn: 1450.75). Okunamıyorsa 0 döndür.\n" +
    `4. date: ${
      defaultType === "debt"
        ? "Belgede 'Son Ödeme Tarihi', 'Vade Tarihi' veya 'SKT' varsa öncelikle o tarihi; yoksa belge/fatura tarihini"
        : "Belgenin üzerindeki fiş/fatura tarihini"
    } mutlaka YYYY-MM-DD formatında döndür. Belgede hiç tarih yoksa boş string \"\" döndür.\n` +
    "5. categorySuggestion: En uygun kategori ('Gıda / Market', 'Fatura', 'Ulaşım', 'Akaryakıt', 'Sağlık', 'Giyim', 'Yemek', 'Kredi Kartı', 'Konut', 'Araç', 'Eğitim', 'Diğer').\n" +
    `6. type: Peşin alışveriş/fiş ise 'expense', vadesi olan veya ödenecek fatura ise 'debt'. (Varsayılan: '${defaultType}').\n\n` +
    "Yalnızca geçerli bir JSON objesi döndür.";

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  const retryDelaysMs = [0, 800];
  let rawResponseText = "";
  let lastError: Error | null = null;

  directLoop:
  for (let attemptIdx = 0; attemptIdx < retryDelaysMs.length; attemptIdx++) {
    if (retryDelaysMs[attemptIdx] > 0) {
      await sleep(retryDelaysMs[attemptIdx]);
    }

    for (const modelName of modelsToTry) {
      const modelEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        const res = await fetch(modelEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inline_data: {
                      mime_type: effectiveMime,
                      data: pureBase64,
                    },
                  },
                  { text: promptText },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  isReadableReceipt: { type: "BOOLEAN" },
                  title: { type: "STRING" },
                  amount: { type: "NUMBER" },
                  date: { type: "STRING" },
                  categorySuggestion: { type: "STRING" },
                  type: { type: "STRING" },
                },
                required: ["isReadableReceipt", "title", "amount", "date"],
              },
            },
          }),
        });

        const rawText = await res.text();
        let jsonBody: any = null;
        try {
          jsonBody = rawText ? JSON.parse(rawText) : null;
        } catch {
          jsonBody = null;
        }

        if (!res.ok) {
          const apiErrMsg = String(jsonBody?.error?.message || "");
          if (
            res.status === 401 ||
            res.status === 403 ||
            (res.status === 400 && /API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(apiErrMsg))
          ) {
            throw new Error(`INVALID_API_KEY_${res.status}`);
          }
          lastError = new Error(
            res.status === 400 && apiErrMsg
              ? `API_BAD_REQUEST:${apiErrMsg}`
              : `HTTP_${res.status}`
          );
          if (res.status === 400 || res.status === 404 || res.status === 429 || res.status >= 500) {
            continue;
          }
          throw lastError;
        }

        const parts = jsonBody?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          rawResponseText = parts
            .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
            .join("")
            .trim();
        }

        if (rawResponseText) {
          break directLoop;
        }
        lastError = new Error("EMPTY_RESPONSE");
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err || "OCR_ERROR"));
        if (String(lastError.message).startsWith("INVALID_API_KEY")) {
          throw lastError;
        }
        if (err?.name === "AbortError") {
          lastError = new Error("TIMEOUT");
        } else if (/Failed to fetch|NetworkError|Load failed/i.test(String(lastError.message))) {
          lastError = new Error("NETWORK_ERROR");
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  if (!rawResponseText) {
    throw lastError || new Error("EMPTY_RESPONSE");
  }

  const cleanedText = rawResponseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  const jsonCandidate = jsonMatch ? jsonMatch[0] : cleanedText;

  let parsedData: Record<string, any>;
  try {
    const parsed = JSON.parse(jsonCandidate);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid JSON root");
    }
    parsedData = parsed;
  } catch {
    throw new Error("JSON_PARSE_ERROR");
  }

  if (parsedData.isReadableReceipt === false) {
    throw new Error("EMPTY_OCR_RESULT");
  }

  const parsedAmount = parseOcrAmount(parsedData.amount);
  const rawTitle = typeof parsedData.title === "string" ? parsedData.title.trim() : "";
  const isGenericTitle = /^(fatura|fiş|fis|harcama|alışveriş|alisveris|bilinmiyor|yok|none|null|n\/a|-)$/i.test(rawTitle);
  const cleanTitle = isGenericTitle ? "" : rawTitle;
  const parsedDate = normalizeOcrDate(parsedData.date);

  if (!cleanTitle && parsedAmount <= 0) {
    throw new Error("EMPTY_OCR_RESULT");
  }

  const missingFields: string[] = [];
  if (!cleanTitle) missingFields.push("Firma / kurum adı");
  if (parsedAmount <= 0) missingFields.push("Toplam tutar");
  if (!parsedDate) missingFields.push("Vade / belge tarihi");

  const cleanCategory =
    typeof parsedData.categorySuggestion === "string" && parsedData.categorySuggestion.trim()
      ? parsedData.categorySuggestion.trim()
      : defaultType === "debt"
        ? "Fatura"
        : "Gıda / Market";

  return {
    title: cleanTitle,
    amount: parsedAmount,
    date: parsedDate,
    categorySuggestion: cleanCategory,
    type: parsedData.type === "debt" ? "debt" : parsedData.type === "expense" ? "expense" : defaultType,
    warning:
      missingFields.length > 0
        ? `Görselden şu alan(lar) net okunamadı ve boş döndü: ${missingFields.join(", ")}. Lütfen kontrol edip manuel olarak tamamlayın.`
        : undefined,
  };
}

export default function ReceiptScanner({ onScanCompleted, onClose, defaultType = "expense" }: ReceiptScannerProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("camera");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("Görsel hazırlanıyor...");
  const [error, setError] = useState<string | null>(null);
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<ScannedReceiptResult | null>(null);
  const [showWebcamPreview, setShowWebcamPreview] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredGeminiApiKey());
  const [showApiKeyValue, setShowApiKeyValue] = useState(false);
  const [hasConfiguredKey, setHasConfiguredKey] = useState(() => hasAnyGeminiApiKey());
  const [showApiKeyPanel, setShowApiKeyPanel] = useState(() => !hasAnyGeminiApiKey());
  const [apiKeySaveMsg, setApiKeySaveMsg] = useState<string | null>(null);

  // Hidden file inputs always mounted at root
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  // Live webcam elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const syncKeyState = () => {
      setApiKeyInput(getStoredGeminiApiKey());
      setHasConfiguredKey(hasAnyGeminiApiKey());
    };
    window.addEventListener(GEMINI_KEY_UPDATED_EVENT, syncKeyState);
    return () => {
      window.removeEventListener(GEMINI_KEY_UPDATED_EVENT, syncKeyState);
    };
  }, []);

  // Clean up webcam stream on unmount or toggle
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  useEffect(() => {
    if (activeTab === "camera" && showWebcamPreview) {
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [activeTab, showWebcamPreview]);

  const startWebcam = async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setError("Tarayıcınızda canlı web kamerası önizlemesi desteklenmiyor. Lütfen telefon kamerasını açın.");
      setWebcamActive(false);
      return;
    }

    try {
      if (streamRef.current) {
        stopWebcam();
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setWebcamActive(true);
      }
    } catch (err: any) {
      console.warn("Webcam access error:", err);
      setError("Web kamerası başlatılamadı. Cihaz kamerasını açmak için aşağıdaki butona dokunun.");
      setWebcamActive(false);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
  };

  const captureFromWebcam = () => {
    if (!videoRef.current || !webcamActive) {
      setError("Web kamerası aktif değil. Lütfen kamerayı başlatıp tekrar deneyin.");
      return;
    }

    try {
      const video = videoRef.current;
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        setError("Web kamerası görüntüsü henüz hazır değil. Lütfen 1-2 saniye bekleyip tekrar deneyin.");
        return;
      }

      const MAX_DIM = 960;
      let targetW = video.videoWidth;
      let targetH = video.videoHeight;
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_DIM) / targetW);
          targetW = MAX_DIM;
        } else {
          targetW = Math.round((targetW * MAX_DIM) / targetH);
          targetH = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Kamera görüntüsü işlenemedi (canvas hatası). Lütfen tekrar deneyin.");
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(video, 0, 0, targetW, targetH);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      const commaIdx = dataUrl.indexOf(",");
      if (!dataUrl.startsWith("data:image/jpeg;base64,") || commaIdx === -1 || dataUrl.slice(commaIdx + 1).length < 500) {
        setError("Kameradan alınan görüntü boş veya bozuk. Kameranın kapalı/engelli olmadığından emin olun.");
        return;
      }

      stopWebcam();
      setShowWebcamPreview(false);
      handleProcessImage(dataUrl);
    } catch (e) {
      console.error("Frame capture error:", e);
      setError("Kameradan fotoğraf alınamadı. Lütfen tekrar deneyin.");
    }
  };

  // Trigger device's native rear camera directly via @capacitor/camera on native platforms
  const triggerNativeCamera = async () => {
    setError(null);
    setScanWarning(null);
    stopWebcam();
    setShowWebcamPreview(false);

    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await CapacitorCamera.checkPermissions();
        if (permStatus.camera !== "granted") {
          const requested = await CapacitorCamera.requestPermissions({ permissions: ["camera"] });
          if (requested.camera === "denied") {
            setError("Kamera izni reddedildi. Lütfen cihaz ayarlarından kamera iznini açıp tekrar deneyin.");
            return;
          }
        }

        const photo = await CapacitorCamera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          direction: CameraDirection.Rear,
          correctOrientation: true,
          width: 1280,
          height: 1280,
          saveToGallery: false
        });

        const capturedDataUrl =
          photo?.dataUrl ||
          (photo?.base64String ? `data:image/${photo.format || "jpeg"};base64,${photo.base64String}` : "");

        if (!capturedDataUrl || !capturedDataUrl.includes(",") || capturedDataUrl.split(",")[1].length < 100) {
          setError("Kameradan alınan fotoğraf verisi boş veya okunamadı. Lütfen tekrar çekin.");
          return;
        }

        await handleProcessImage(capturedDataUrl);
      } catch (err: any) {
        const code = String(err?.code || "");
        const msg = String(err?.message || "");
        if (code === "OS-PLUG-CAMR-0006" || /cancel|iptal|dismiss/i.test(msg)) {
          return;
        }
        if (code === "OS-PLUG-CAMR-0003" || /permission|izin|denied/i.test(msg)) {
          setError("Kamera izni gerekli. Lütfen uygulama izinlerinden kamera erişimini onaylayın.");
          return;
        }
        if (code === "OS-PLUG-CAMR-0007" || /no camera/i.test(msg)) {
          setError("Cihazda kullanılabilir kamera bulunamadı.");
          return;
        }
        console.warn("Capacitor Camera error:", err);
        setError(msg ? `Kamera açılamadı: ${msg}` : "Telefon kamerası açılamadı. Lütfen tekrar deneyin.");
      }
      return;
    }

    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    }
  };

  // Trigger file picker
  const triggerFilePicker = () => {
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file chosen from either native camera or file picker
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so re-selecting same file triggers change
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.name.match(/\.(png|jpe?g|webp|heic)$/i)) {
      setError("Lütfen geçerli bir görsel dosyası seçin (PNG, JPG, JPEG, WEBP).");
      return;
    }

    handleProcessImage(file);
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.name.match(/\.(png|jpe?g|webp|heic)$/i)) {
      setError("Lütfen geçerli bir görsel dosyası seçin (PNG, JPG, JPEG, WEBP).");
      return;
    }

    handleProcessImage(file);
  };

  // Compress, preview, and analyze via direct Gemini API (or same-origin web backend); fall back directly to manual entry on error
  const handleProcessImage = async (fileOrDataUrl: File | string) => {
    setLoading(true);
    setError(null);
    setScanWarning(null);
    setSuccessResult(null);
    setLoadingStep("Görsel sıkıştırılıyor ve hazırlanıyor...");

    let preparedBase64 = "";
    let preparedMime = "image/jpeg";

    try {
      const optimized = await optimizeImageForOcr(fileOrDataUrl);
      preparedBase64 = optimized.base64;
      preparedMime = optimized.mimeType;
      if (!preparedBase64 || !preparedBase64.includes(",") || preparedBase64.split(",")[1].length < 100) {
        setError("Görsel verisi boş olduğu için taranamadı. Lütfen tekrar çekin.");
        setLoading(false);
        return;
      }
      setSelectedImage(preparedBase64);
    } catch (prepErr: any) {
      setError(prepErr?.message || "Görsel hazırlanamadı. Lütfen geçerli bir fotoğraf seçin.");
      setLoading(false);
      return;
    }

    setLoadingStep("Yapay zeka faturayı inceliyor...");

    try {
      const userApiKey = getStoredGeminiApiKey() || undefined;
      const envGeminiKey = getBuildGeminiApiKey() || undefined;

      const directKeysToTry: string[] = [];
      if (userApiKey) directKeysToTry.push(userApiKey);
      if (envGeminiKey && !directKeysToTry.includes(envGeminiKey)) {
        directKeysToTry.push(envGeminiKey);
      }

      const isStaticOrApk = isCapacitorOrStaticLocalOrigin();
      let diagnosticError: string | null = null;
      let directErrorCode: string = "";

      const formatDirectOcrError = (code: string): string => {
        if (code.startsWith("INVALID_API_KEY")) {
          return "Gemini API anahtarı geçersiz veya yetkisiz görünüyor. Lütfen VITE_GEMINI_API_KEY veya kişisel API anahtarınızı kontrol edin.";
        }
        if (code === "EMPTY_OCR_RESULT" || code === "UNREADABLE_RECEIPT") {
          return "Görselden firma/kurum adı ve toplam tutar bilgisi çıkarılamadı. Fotoğraf bulanık veya düşük ışıklı olabilir; lütfen daha net bir fotoğraf çekin.";
        }
        if (code === "TIMEOUT") {
          return "Fatura okuma isteği zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.";
        }
        if (code === "HTTP_503") {
          return "Gemini OCR servisi şu anda yoğun olduğu için yanıt veremedi. Lütfen birkaç saniye sonra 'Tekrar Dene' butonuna basın.";
        }
        if (code === "HTTP_429") {
          return "Gemini API kullanım/kota sınırına ulaşıldı. Lütfen kısa bir süre sonra tekrar deneyin.";
        }
        if (code === "NETWORK_ERROR") {
          return "Gemini API'ye bağlanılamadı. Lütfen cihazınızın internet bağlantısını kontrol edip tekrar deneyin.";
        }
        if (code === "JSON_PARSE_ERROR" || code === "EMPTY_RESPONSE") {
          return "Yapay zeka yanıtı beklenen fatura formatında okunamadı. Lütfen daha net bir fotoğrafla tekrar deneyin.";
        }
        if (code.startsWith("API_BAD_REQUEST:")) {
          return `Gemini API görsel isteğini işleyemedi: ${code.slice("API_BAD_REQUEST:".length)}`;
        }
        return "Gemini görsel okuma isteği tamamlanamadı. Lütfen tekrar deneyin.";
      };

      const tryDirectGemini = async (): Promise<boolean> => {
        for (const apiKey of directKeysToTry) {
          try {
            const directRes = await scanReceiptDirectlyWithGemini({
              base64DataUrl: preparedBase64,
              mimeType: preparedMime,
              apiKey,
              defaultType,
            });
            setLoadingStep("Bilgiler ayrıştırıldı!");
            if (directRes.warning) {
              setScanWarning(directRes.warning);
            } else if (!directRes.title || directRes.amount <= 0) {
              const missing: string[] = [];
              if (!directRes.title) missing.push("Firma / kurum adı");
              if (directRes.amount <= 0) missing.push("Toplam tutar");
              setScanWarning(`Görselden şu alan(lar) net okunamadı: ${missing.join(", ")}. Lütfen kontrol edip tamamlayın.`);
            }
            setSuccessResult({
              title: directRes.title,
              amount: directRes.amount,
              date: directRes.date,
              categorySuggestion: directRes.categorySuggestion,
              type: directRes.type,
            });
            return true;
          } catch (err: any) {
            directErrorCode = String(err?.message || "");
            diagnosticError = formatDirectOcrError(directErrorCode);
            if (directErrorCode === "EMPTY_OCR_RESULT" || directErrorCode === "UNREADABLE_RECEIPT") {
              return false;
            }
          }
        }
        return false;
      };

      const tryBackendScan = async (endpointUrl: string, timeoutMs: number): Promise<boolean> => {
        const controller = new AbortController();
        const requestTimeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const attemptRes = await fetch(endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              image: preparedBase64,
              mimeType: preparedMime,
              defaultType,
              userApiKey,
            }),
          });

          const rawBody = await attemptRes.text();
          let parsedJson: any = null;
          if (rawBody) {
            try {
              parsedJson = JSON.parse(rawBody);
            } catch {
              parsedJson = null;
            }
          }

          if (!attemptRes.ok || !parsedJson || !parsedJson.success) {
            if (parsedJson?.error && typeof parsedJson.error === "string") {
              diagnosticError = parsedJson.error;
            } else if (attemptRes.status === 404 || attemptRes.status === 405 || !parsedJson) {
              diagnosticError = "Fatura okuma servisine ulaşılamadı.";
            } else {
              diagnosticError = `Fatura okuma servisi hata döndürdü (HTTP ${attemptRes.status}).`;
            }
            return false;
          }

          const cleanTitle = typeof parsedJson.title === "string" ? parsedJson.title.trim() : "";
          const parsedAmount = parseOcrAmount(parsedJson.amount);
          const normalizedDate = normalizeOcrDate(parsedJson.date);

          if (!cleanTitle && parsedAmount <= 0) {
            diagnosticError =
              "Gemini yanıtı boş döndü: Fişten firma/kurum adı ve toplam tutar çıkarılamadı. Lütfen daha net ve aydınlık bir fotoğrafla tekrar deneyin.";
            return false;
          }

          setLoadingStep("Bilgiler ayrıştırıldı!");
          const result: ScannedReceiptResult = {
            title: cleanTitle,
            amount: Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0,
            date: normalizedDate,
            categorySuggestion:
              typeof parsedJson.categorySuggestion === "string" && parsedJson.categorySuggestion.trim()
                ? parsedJson.categorySuggestion.trim()
                : defaultType === "debt"
                  ? "Fatura"
                  : "Gıda / Market",
            type: parsedJson.type === "debt" ? "debt" : parsedJson.type === "expense" ? "expense" : defaultType,
          };

          if (typeof parsedJson.warning === "string" && parsedJson.warning.trim()) {
            setScanWarning(parsedJson.warning.trim());
          } else {
            const missing: string[] = [];
            if (!result.title) missing.push("Firma / kurum adı");
            if (result.amount <= 0) missing.push("Toplam tutar");
            if (!result.date) missing.push("Vade / belge tarihi");
            if (missing.length > 0) {
              setScanWarning(`Görselden şu alan(lar) okunamadı ve boş döndü: ${missing.join(", ")}. Lütfen kontrol edip manuel olarak tamamlayın.`);
            }
          }

          setSuccessResult(result);
          return true;
        } catch (err: any) {
          if (err?.name === "AbortError") {
            diagnosticError = "Fatura analiz isteği zaman aşımına uğradı. Lütfen tekrar deneyin.";
          } else {
            diagnosticError = "Fatura analiz servisine bağlanılamadı. İnternet bağlantınızı kontrol edin.";
          }
          return false;
        } finally {
          clearTimeout(requestTimeout);
        }
      };

      // 1. Scan directly via Gemini API using user key or build-time VITE_GEMINI_API_KEY (no external server required)
      if (await tryDirectGemini()) {
        return;
      }

      // 2. On live Node/Express web sessions (not static/APK), fall back to same-origin /api/scan-receipt if direct scan was unreadable-free
      if (
        !isStaticOrApk &&
        directErrorCode !== "EMPTY_OCR_RESULT" &&
        directErrorCode !== "UNREADABLE_RECEIPT"
      ) {
        if (await tryBackendScan("/api/scan-receipt", 45000)) {
          return;
        }
      }

      // 3. Do NOT silently open an empty form! Explain why OCR returned empty/failed and let the user retry or choose manual fill.
      const finalErrorMsg =
        diagnosticError ||
        (directKeysToTry.length === 0
          ? "Doğrudan Gemini API ile fiş okumak için Gemini API anahtarı bulunamadı. Derlemede VITE_GEMINI_API_KEY tanımlı olduğundan veya AI Asistan ayarlarından kişisel API anahtarınızı kaydettiğinizden emin olun."
          : "Fiş görseli okunamadı veya boş sonuç döndü. Lütfen daha net bir fotoğrafla tekrar deneyin.");
      setError(finalErrorMsg);
    } catch (err: any) {
      setError(err?.message || "Fiş okuma sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  // Apply result to form and automatically close modal
  const handleApplyResult = () => {
    if (!successResult) return;
    const cleanTitle = successResult.title.trim();
    const numericAmount = Number(successResult.amount) || 0;
    if (!cleanTitle && numericAmount <= 0) {
      setScanWarning("Firma/kurum adı ve toplam tutar boş görünüyor. Lütfen en az birini doldurun veya yeniden tarayın.");
      return;
    }
    onScanCompleted({
      ...successResult,
      title: cleanTitle,
      amount: numericAmount,
      date: normalizeOcrDate(successResult.date),
    });
    stopWebcam();
    onClose();
  };

  // Fallback to manual fill ONLY when user explicitly selects it
  const handleManualFillFallback = () => {
    const fallbackResult: ScannedReceiptResult = {
      title: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      categorySuggestion: defaultType === "debt" ? "Fatura" : "Diğer",
      type: defaultType,
    };
    onScanCompleted(fallbackResult);
    stopWebcam();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[99999] overflow-y-auto animate-fade-in">
      {/* Hidden inputs permanently mounted */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl p-4 sm:p-6 w-full max-w-md border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-4 my-auto relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Fiş & Fatura Tara</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  AI OCR
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                Fotoğrafı çekin, tutar ve detaylar otomatik aktarılsın
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopWebcam();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection (Camera vs Upload) */}
        {!selectedImage && !loading && !successResult && (
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setActiveTab("camera");
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer ${
                activeTab === "camera"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Kamera İle Çek
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                stopWebcam();
                setShowWebcamPreview(false);
                setActiveTab("upload");
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer ${
                activeTab === "upload"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Galeriden / Dosya Seç
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="min-h-[220px] bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl flex flex-col justify-center items-center relative overflow-hidden p-3.5 text-center">
          
          {/* Error Message Box */}
          {error && !loading && (
            <div className="w-full mb-3 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex flex-col items-center gap-2.5 text-rose-600 dark:text-rose-400 text-xs">
              <div className="flex items-center gap-2 font-bold text-center">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
                {selectedImage && (
                  <button
                    type="button"
                    onClick={() => handleProcessImage(selectedImage)}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Tekrar Dene
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    triggerNativeCamera();
                  }}
                  className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" /> Kamerayı Yeniden Aç
                </button>
                <button
                  type="button"
                  onClick={handleManualFillFallback}
                  className="py-2 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs active:scale-95 transition cursor-pointer"
                >
                  Manuel Olarak Doldur
                </button>
              </div>
            </div>
          )}

          {/* Loading / Scanning Overlay */}
          {loading && (
            <div className="flex flex-col items-center justify-center p-6 space-y-3.5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                  <ScanLine className="w-8 h-8 text-indigo-500 animate-pulse" />
                </div>
                <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-spin" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {loadingStep}
                </p>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 max-w-[260px] mx-auto mt-1">
                  Görsel analiz ediliyor, satıcı unvanı, KDV dahil toplam tutar ve tarih bilgileri çıkarılıyor.
                </p>
              </div>
              <div className="w-32 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse w-3/4 rounded-full" />
              </div>
            </div>
          )}

          {/* Success Result View & Editable Form */}
          {!loading && successResult && (
            <div className="w-full space-y-3.5 text-left animate-fade-in">
              {/* Header status */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider block">Fatura Bilgileri Ayrıştırıldı</span>
                    <span className="text-[10px] text-slate-400 block">Bilgileri kontrol edip düzenleyebilirsiniz</span>
                  </div>
                </div>
                {selectedImage && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <img src={selectedImage} alt="Fiş" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {scanWarning && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>{scanWarning}</span>
                </div>
              )}

              {/* Form Fields */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Tespit Edilen Mağaza / Kurum
                  </label>
                  <input
                    type="text"
                    value={successResult.title}
                    onChange={(e) => setSuccessResult({ ...successResult, title: e.target.value })}
                    className="w-full text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 mt-1 focus:outline-none focus:border-indigo-500"
                    placeholder="Örn: Migros, Enerjisa..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Toplam Tutar (₺)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={successResult.amount > 0 ? successResult.amount : ""}
                      onChange={(e) => setSuccessResult({ ...successResult, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full text-sm font-black text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 mt-1 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Tarih
                    </label>
                    <input
                      type="date"
                      value={successResult.date}
                      onChange={(e) => setSuccessResult({ ...successResult, date: e.target.value })}
                      className="w-full text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 mt-1 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Önerilen Kategori
                  </label>
                  <input
                    type="text"
                    value={successResult.categorySuggestion}
                    onChange={(e) => setSuccessResult({ ...successResult, categorySuggestion: e.target.value })}
                    className="w-full text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 mt-1 focus:outline-none focus:border-indigo-500"
                    placeholder="Örn: Gıda / Market, Fatura..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {selectedImage && (
                  <button
                    type="button"
                    onClick={() => {
                      const cleanTitle = (successResult?.title || "belge").replace(/[^a-zA-Z0-9_-]/g, "_");
                      const dateStr = successResult?.date || new Date().toISOString().slice(0, 10);
                      const imgName = `butcem_fatura_${cleanTitle}_${dateStr}.jpg`;
                      saveImageToGalleryWithCustomName({
                        fileName: imgName,
                        base64Data: selectedImage,
                        mimeType: "image/jpeg",
                        onSuccess: () => alert(`🖼️ Fatura görseli '${imgName}' adıyla kaydedildi!`)
                      });
                    }}
                    className="py-2.5 px-3 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-amber-200/60 dark:border-amber-800/40"
                    title="Fatura fotoğrafını galeriye kaydet"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Kaydet</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setSuccessResult(null);
                    setScanWarning(null);
                    setError(null);
                  }}
                  className="py-2.5 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Yeniden Tara</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyResult}
                  className="flex-1 py-2.5 px-4 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Forma Aktar</span>
                </button>
              </div>
            </div>
          )}

          {/* Camera Tab Content */}
          {!loading && !successResult && activeTab === "camera" && (
            <div className="w-full flex flex-col items-center space-y-3 py-2">
              
              {/* PRIMARY CAMERA ACTION: Directly launch phone camera */}
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={triggerNativeCamera}
                  className="w-full py-4 px-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-95 transition duration-150"
                >
                  <Camera className="w-5 h-5 shrink-0" />
                  <span>Telefon Kamerasını Aç ve Fotoğraf Çek</span>
                </button>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  📱 Kameranızı anında açar. Faturayı net şekilde kadraja alıp çekin.
                </p>
              </div>

              {/* OPTIONAL LIVE WEBCAM ACCORDION (For Desktop/Laptop) */}
              <div className="w-full pt-2 border-t border-slate-200/60 dark:border-slate-800">
                {!showWebcamPreview ? (
                  <button
                    type="button"
                    onClick={() => setShowWebcamPreview(true)}
                    className="w-full py-3 px-4 text-xs font-bold text-slate-700 hover:text-indigo-700 dark:text-slate-200 dark:hover:text-white bg-white hover:bg-indigo-50/70 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-300 hover:border-indigo-400 dark:border-slate-600 dark:hover:border-indigo-400 rounded-xl shadow-sm hover:shadow transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Monitor className="w-4 h-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                    <span>Bilgisayar Web Kamerasını Kullan (Canlı Önizleme)</span>
                  </button>
                ) : (
                  <div className="w-full space-y-2">
                    <div className="relative w-full aspect-video rounded-xl bg-black overflow-hidden border border-slate-200 dark:border-slate-800">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 border border-indigo-500/30 pointer-events-none flex items-center justify-center">
                        <div className="w-4/5 h-3/4 border-2 border-dashed border-indigo-400/60 rounded-xl flex items-center justify-center">
                          <span className="text-[9px] font-black text-indigo-300 uppercase bg-slate-950/80 px-2 py-0.5 rounded-md">
                            Faturayı Buraya Hizalayın
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={captureFromWebcam}
                        disabled={!webcamActive}
                        className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Fotoğrafı Çek ve Tara</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowWebcamPreview(false)}
                        className="py-2.5 px-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                      >
                        Kapat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Tab Content */}
          {!loading && !successResult && activeTab === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={triggerFilePicker}
              className="w-full h-44 border-2 border-dashed border-slate-200 hover:border-indigo-500 dark:border-slate-800 dark:hover:border-indigo-400 rounded-2xl flex flex-col justify-center items-center p-4 cursor-pointer transition select-none group bg-slate-50/50 dark:bg-slate-950/30 hover:bg-indigo-50/20"
            >
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition shrink-0 mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
                Fiş / Fatura Görselini Seçin
              </p>
              <p className="text-[10.5px] text-slate-400 mt-1">
                Dosya seçmek için dokunun veya buraya sürükleyin
              </p>
              <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 mt-2 px-2 py-0.5 rounded-full bg-indigo-500/10">
                JPG, PNG, WEBP, HEIC
              </span>
            </div>
          )}

        </div>

        {/* Compact Gemini API Key Bar & Short Explanation */}
        <div className="bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Key className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">
                Gemini API Anahtarı
              </span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                  hasConfiguredKey
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }`}
              >
                {hasConfiguredKey ? "Aktif" : "Gerekli"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowApiKeyPanel((prev) => !prev)}
              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
            >
              <span>{showApiKeyPanel ? "Gizle" : "Düzenle"}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showApiKeyPanel ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showApiKeyPanel && (
            <div className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-slate-800/80">
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                Fiş ve faturaları yapay zeka ile okuyabilmek için kendi Google Gemini API anahtarınızın girilmesi gerekir.
              </p>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <input
                    type={showApiKeyValue ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setApiKeySaveMsg(null);
                    }}
                    placeholder="AIzaSy... Gemini API anahtarınız"
                    className="w-full pl-2.5 pr-8 py-1.5 text-[11px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyValue((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title={showApiKeyValue ? "Gizle" : "Göster"}
                  >
                    {showApiKeyValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const saved = saveGeminiApiKey(apiKeyInput);
                    setHasConfiguredKey(hasAnyGeminiApiKey());
                    if (saved) {
                      setApiKeySaveMsg("API anahtarı kaydedildi.");
                      if (error && /API anahtarı|tanımlı değil|bulunamadı/i.test(error)) {
                        setError(null);
                      }
                    } else {
                      setApiKeySaveMsg("Kayıtlı anahtar temizlendi.");
                    }
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer shrink-0"
                >
                  Kaydet
                </button>
                {getStoredGeminiApiKey() && (
                  <button
                    type="button"
                    onClick={() => {
                      clearGeminiApiKey();
                      setApiKeyInput("");
                      setHasConfiguredKey(hasAnyGeminiApiKey());
                      setApiKeySaveMsg("Kayıtlı anahtar silindi.");
                    }}
                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-xl transition cursor-pointer shrink-0"
                  >
                    Sil
                  </button>
                )}
              </div>
              {apiKeySaveMsg && (
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ {apiKeySaveMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Info footer disclaimer */}
        <p className="text-[9.5px] text-slate-400 dark:text-slate-500 italic text-center select-none pt-0.5">
          💡 Yapay zeka faturadaki mağaza unvanını, tarihi ve genel toplamı otomatik okur. Sonuçları onaylamadan önce dilediğiniz gibi düzenleyebilirsiniz.
        </p>
      </div>
    </div>,
    document.body
  );
}

import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, AlertCircle, Loader2, RefreshCw, Sparkles, Check, CheckCircle } from "lucide-react";
import { getApiUrl } from "../utils/api";

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

export default function ReceiptScanner({ onScanCompleted, onClose, defaultType = "expense" }: ReceiptScannerProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("upload");
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<ScannedReceiptResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Control camera power active/inactive
  useEffect(() => {
    if (activeTab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  }, [activeTab]);

  const startCamera = async () => {
    setError(null);
    try {
      if (streamRef.current) {
        stopCamera();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera Access Error:", err);
      setError(
        "Kameraya erişim sağlanamadı. Tarayıcınızdan kamera izinlerini kontrol edin veya 'Dosya Yükleme' sekmesini kullanın."
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Capture frame from active video preview
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (context) {
      // Use video natural resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setSelectedImage(dataUrl);
      stopCamera();
      
      // Auto submit for OCR scanning
      processImageForOcr(dataUrl);
    }
  };

  // Convert files to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Lütfen geçerli bir görsel dosyası seçin (PNG, JPG o JPEG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      setSelectedImage(base64String);
      processImageForOcr(base64String);
    };
    reader.onerror = () => {
      setError("Dosya okunurken bir hata oluştu.");
    };
    reader.readAsDataURL(file);
  };

  // Drag over drop event handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Sadece görsel dosyalarını (PNG, JPG) sürükleyip bırakabilirsiniz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      setSelectedImage(base64String);
      processImageForOcr(base64String);
    };
    reader.readAsDataURL(file);
  };

  // Perform full-stack OCR analysis call
  const processImageForOcr = async (base64Image: string) => {
    setLoading(true);
    setError(null);
    setSuccessResult(null);

    try {
      const response = await fetch(getApiUrl("/api/scan-receipt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image, defaultType })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Sunucu faturayı çözümleyemedi.");
      }

      const data = await response.json();
      if (data.success) {
        const result: ScannedReceiptResult = {
          title: data.title,
          amount: data.amount,
          date: data.date,
          categorySuggestion: data.categorySuggestion,
          type: data.type || defaultType
        };
        setSuccessResult(result);
      } else {
        throw new Error("Tarama sonucu çözümlenemedi.");
      }
    } catch (err: any) {
      console.error("OCR parse exception:", err);
      setError(err?.message || "Belge taranırken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyResult = () => {
    if (successResult) {
      onScanCompleted(successResult);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl p-5 w-full max-w-md border border-slate-200/80 dark:border-slate-800/80 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
          <div className="flex items-center gap-1.5 ">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
              Yapay Zeka Fiş/Fatura Tara
            </h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            Kapat
          </button>
        </div>

        {/* Tab Selection */}
        {!selectedImage && !loading && (
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
                activeTab === "upload"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Dosya Seç
            </button>
            <button
              onClick={() => setActiveTab("camera")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
                activeTab === "camera"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Kamera Çekimi
            </button>
          </div>
        )}

        {/* Dynamic Display Area */}
        <div className="min-h-[220px] bg-slate-50 dark:bg-slate-950/50 border border-slate-200/40 dark:border-slate-800/60 rounded-2xl flex flex-col justify-center items-center relative overflow-hidden p-3 text-center">
          
          {/* Error Message */}
          {error && (
            <div className="absolute top-2 left-2 right-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-1.5 text-rose-600 dark:text-rose-400 text-[10px] text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block text-[11px]">HATA!</span>
                {error}
              </div>
            </div>
          )}

          {/* Loader Overlay */}
          {loading && (
            <div className="flex flex-col items-center justify-center p-6 space-y-3">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
                <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-ping" />
              </div>
              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                Belge Yapay Zekaya Gönderiliyor...
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[250px]">
                Görsel analiz ediliyor, satıcı başlığı, toplam fiyat ve tarih bilgileri çıkarılıyor.
              </p>
            </div>
          )}

          {/* Success Result Approval Form */}
          {!loading && successResult && (
            <div className="w-full space-y-4 p-1">
              <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle className="w-8 h-8 animate-bounce" />
                <div className="text-left">
                  <span className="text-xs font-black uppercase tracking-wider block">BAŞARILI!</span>
                  <span className="text-[10px] text-slate-400 block pb-0.5">Bilgiler yüksek uyumla tespit edildi.</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 text-left space-y-2.5 shadow-xs">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tespit Edilen Mağaza/Kurum</label>
                  <input
                    type="text"
                    value={successResult.title}
                    onChange={(e) => setSuccessResult({ ...successResult, title: e.target.value })}
                    className="w-full text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200/40 dark:border-slate-800/50 mt-1 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Toplam Tutar</label>
                    <input
                      type="number"
                      value={successResult.amount}
                      onChange={(e) => setSuccessResult({ ...successResult, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-extrabold text-rose-500 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200/40 dark:border-slate-800/50 mt-1 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tarih</label>
                    <input
                      type="date"
                      value={successResult.date}
                      onChange={(e) => setSuccessResult({ ...successResult, date: e.target.value })}
                      className="w-full text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200/40 dark:border-slate-800/50 mt-1 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Önerilen Kategori Tahmini</label>
                  <input
                    type="text"
                    value={successResult.categorySuggestion}
                    onChange={(e) => setSuccessResult({ ...successResult, categorySuggestion: e.target.value })}
                    className="w-full text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200/40 dark:border-slate-800/50 mt-1 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setSuccessResult(null);
                    if (activeTab === "camera") {
                      startCamera();
                    }
                  }}
                  className="flex-1 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl transition duration-200 cursor-pointer"
                >
                  Yeniden Çek
                </button>
                <button
                  type="button"
                  onClick={handleApplyResult}
                  className="flex-1 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition duration-200 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Formu Doldur
                </button>
              </div>
            </div>
          )}

          {/* Camera Scan Display and Capture Mechanism */}
          {!loading && !successResult && activeTab === "camera" && (
            <div className="w-full flex flex-col items-center">
              {!cameraActive && !error && (
                <div className="py-10 text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  Kamera başlatılıyor...
                </div>
              )}
              
              <div className={`relative w-full aspect-video rounded-xl bg-black overflow-hidden border border-slate-200 dark:border-slate-800 ${cameraActive ? "block" : "hidden"}`}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Advanced Hud Targeting Overlays */}
                <div className="absolute inset-0 border-[2px] border-indigo-500/20 pointer-events-none">
                  {/* Scan target guidelines */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-2/3 border-2 border-dashed border-indigo-500/60 rounded-lg flex items-center justify-center">
                    <span className="text-[8px] font-black text-indigo-400 dark:text-indigo-300 uppercase bg-slate-950/70 py-0.5 px-1.5 rounded-md tracking-wider">
                      Faturayı Buraya Hizalayın
                    </span>
                  </div>
                  {/* Laser scan line anim */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent top-0 animate-bounce" style={{ animationDuration: "3s" }} />
                </div>
              </div>

              {cameraActive && (
                <button
                  onClick={capturePhoto}
                  className="mt-4 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all duration-150 active:scale-90 shadow-lg cursor-pointer flex items-center gap-2 text-xs font-bold"
                  title="Faturayı Tara"
                >
                  <Camera className="w-4 h-4" /> Fotoğraf Çek & Tara
                </button>
              )}
            </div>
          )}

          {/* File Picker Drag & Drop Overlay */}
          {!loading && !successResult && activeTab === "upload" && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-44 border-2 border-dashed border-slate-200 hover:border-indigo-400 dark:border-slate-800 dark:hover:border-indigo-500 rounded-2xl flex flex-col justify-center items-center p-4 cursor-pointer transition select-none group"
            >
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-full text-indigo-500 group-hover:scale-110 transition shrink-0 mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Fiş / Fatura Görselini Sürükleyin veya Seçin
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Desteklenen formatlar: PNG, JPG, JPEG veya HEIC
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Empty Canvas backer */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Info footer disclaimer */}
        <p className="text-[9px] text-slate-400 italic text-center select-none pt-1">
          💡 Yapay zeka makbuz tutarlarını, unvanını ve tarihini tamamen otomatik okur. Girişlerinizi onaylamadan önce her zaman değiştirebilirsiniz.
        </p>
      </div>
    </div>
  );
}

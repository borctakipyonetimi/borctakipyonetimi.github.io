/**
 * Bütçem Pro - Profesyonel Ses Tanıma, MediaRecorder ve Sesli Asistan Servisi
 * Web Speech API (SpeechRecognition & SpeechSynthesis), MediaRecorder ve Web Audio API entegrasyonu.
 * Android WebView ve mobil tarayıcılar için optimize edilmiştir.
 */

export interface SpeechListenCallbacks {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string, isFatal: boolean, rawError?: any) => void;
  onEnd?: (finalTranscript: string) => void;
  onVolumeChange?: (volume: number) => void; // 0 - 100 arası anlık ses şiddeti
  onAudioRecorded?: (base64Audio: string, mimeType: string) => void; // MediaRecorder ses kaydı çıktısı
}

class SpeechService {
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isListening: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private currentTranscript: string = "";
  private recordedMimeType: string = "audio/webm";
  private activeCallbacks: SpeechListenCallbacks | null = null;

  /**
   * Cihazda ses tanıma veya ses kayıt desteğinin (Web Speech API veya MediaRecorder) bulunup bulunmadığını kontrol eder.
   */
  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const hasWebSpeech = !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
    const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    return hasWebSpeech || hasMedia;
  }

  /**
   * Web Speech API (SpeechRecognition) desteğini kontrol eder.
   */
  public hasWebSpeech(): boolean {
    if (typeof window === "undefined") return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  /**
   * Tarayıcının Speech Synthesis (metin seslendirme) desteğini kontrol eder.
   */
  public isSynthesisSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "speechSynthesis" in window;
  }

  /**
   * Mikrofon iznini güvenli bir şekilde talep eder ve kontrol eder.
   */
  public async requestMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return {
        granted: false,
        error: "Cihazınızda veya tarayıcınızda mikrofon arayüzü (navigator.mediaDevices.getUserMedia) bulunamadı."
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      // İzin alındı, test stream'ini kapat
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (err: any) {
      console.warn("[SpeechService] Mikrofon erişim izni hatası:", err);
      let errorMsg = "Mikrofon izni alınamadı.";
      const errName = err?.name || "";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        errorMsg = "Mikrofon erişim izni verilmedi. Lütfen uygulama veya tarayıcı ayarlarından mikrofona izin verin.";
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        errorMsg = "Cihazınızda aktif bir mikrofon donanımı bulunamadı.";
      } else if (errName === "NotReadableError" || errName === "TrackStartError") {
        errorMsg = "Mikrofon donanımı meşgul veya başka bir uygulama tarafından kullanılıyor.";
      } else if (errName === "SecurityError") {
        errorMsg = "Güvenlik kısıtlaması nedeniyle mikrofona erişilemedi. Lütfen HTTPS veya güvenli WebView kullanın.";
      }
      return { granted: false, error: errorMsg };
    }
  }

  /**
   * Ses şiddetini (RMS) analiz ederek canlı dalga animasyonu üretir.
   * Mevcut mediaStream'i yeniden kullanarak ikinci bir getUserMedia çağrısı yapmaz.
   */
  private startAudioVolumeMonitor(stream: MediaStream, onVolumeChange?: (vol: number) => void) {
    if (!onVolumeChange || typeof window === "undefined") return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!this.isListening || !this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedVol = Math.min(100, Math.round((average / 128) * 100));
        onVolumeChange(normalizedVol);

        this.animFrameId = requestAnimationFrame(updateVolume);
      };

      this.animFrameId = requestAnimationFrame(updateVolume);
    } catch (err) {
      console.warn("[SpeechService] Ses dalgası analizi başlatılamadı:", err);
    }
  }

  private stopAudioVolumeMonitor() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      try {
        if (this.audioContext.state !== "closed") {
          this.audioContext.close();
        }
      } catch (_) {}
      this.audioContext = null;
    }
    this.analyser = null;
  }

  /**
   * Ses dinleme ve kayıt döngüsünü başlatır.
   * Tek bir MediaStream üzerinden hem ses dalgasını hem MediaRecorder kaydını hem de SpeechRecognition'ı yönetir.
   */
  public async startListening(callbacks: SpeechListenCallbacks, lang: string = "tr-TR"): Promise<boolean> {
    if (!this.isSupported()) {
      callbacks.onError?.("Cihazınızda mikrofon ve ses işleme desteği bulunamadı. Lütfen komutunuzu yazarak girin.", true);
      return false;
    }

    // Halihazırda açıksa temiz durdur
    this.stopListening();
    this.activeCallbacks = callbacks;
    this.currentTranscript = "";
    this.recordedChunks = [];

    // 1. Mikrofon akışını (MediaStream) tek seferde al
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.mediaStream = stream;
    } catch (streamErr: any) {
      console.warn("[SpeechService] getUserMedia hatası:", streamErr);
      let errorMsg = "Mikrofon başlatılamadı. Lütfen mikrofon izinlerini onaylayın.";
      const errName = streamErr?.name || "";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        errorMsg = "Mikrofon erişim izni verilmedi. Lütfen uygulama veya tarayıcı ayarlarından mikrofona izin verin.";
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        errorMsg = "Cihazınızda aktif bir mikrofon bulunamadı.";
      } else if (errName === "NotReadableError" || errName === "TrackStartError") {
        errorMsg = "Mikrofon donanımı başka bir uygulama tarafından meşgul edilmiş durumda.";
      }
      callbacks.onError?.(errorMsg, true, streamErr);
      return false;
    }

    this.isListening = true;
    callbacks.onStart?.();

    // 2. Canlı ses şiddeti monitörünü aynı stream ile başlat
    this.startAudioVolumeMonitor(stream, callbacks.onVolumeChange);

    // 3. MediaRecorder ile ses kaydını başlat (Yedek & AI destekli ses işleme)
    try {
      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          mimeType = "audio/ogg;codecs=opus";
        }

        this.recordedMimeType = mimeType;
        this.mediaRecorder = new MediaRecorder(stream, { mimeType });
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };
        this.mediaRecorder.start(250); // Her 250ms'de bir veri topla
      }
    } catch (recErr) {
      console.warn("[SpeechService] MediaRecorder başlatılamadı:", recErr);
    }

    // 4. Web Speech API varsa başlat (Canlı metin dökümü)
    if (this.hasWebSpeech()) {
      try {
        const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.recognition = new SpeechRecognitionClass();
        this.recognition.lang = lang;
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = (event: any) => {
          try {
            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscript += transcript;
              } else {
                interimTranscript += transcript;
              }
            }

            const combined = (finalTranscript || interimTranscript || "").trim();
            if (combined) {
              this.currentTranscript = combined;
              callbacks.onResult?.(combined, !!finalTranscript);
            }
          } catch (err) {
            console.warn("[SpeechService] onresult ayrıştırma hatası:", err);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn("[SpeechService] Web Speech algılama uyarısı:", event.error);

          // Web Speech API hata verse bile (örneğin WebView'da Google Speech Service kısıtlıysa),
          // MediaRecorder arka planda kayda devam ettiği için kullanıcıyı hemen kesmeyip
          // ses kaydını sunucuya gönderme yolunu koruyoruz.
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            console.log("[SpeechService] Web Speech izni/servisi bulunamadı, MediaRecorder moduna geçiliyor.");
          } else if (event.error === "no-speech") {
            // Sessizlik durumunda onEnd devreye girecektir
          } else if (event.error !== "aborted") {
            // Diğer hatalarda bilgilendir
            console.log("[SpeechService] Web Speech hata kodu:", event.error);
          }
        };

        this.recognition.onend = () => {
          // Kullanıcı konuşmayı bitirdiyse
          if (this.isListening) {
            this.stopListening();
          }
        };

        this.recognition.start();
      } catch (recogInitErr) {
        console.warn("[SpeechService] Web Speech başlatılamadı, MediaRecorder devrede:", recogInitErr);
      }
    }

    return true;
  }

  /**
   * Ses dinleme ve kaydı güvenli şekilde tamamlar ve toplanan verileri teslim eder.
   */
  public async stopListening(): Promise<void> {
    if (!this.isListening && !this.mediaStream && !this.mediaRecorder) {
      return;
    }

    this.isListening = false;
    const callbacks = this.activeCallbacks;
    this.activeCallbacks = null;

    // Ses analizi animasyonunu durdur
    this.stopAudioVolumeMonitor();

    // SpeechRecognition'ı kapat
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }

    // MediaRecorder kaydını tamamla ve Base64'e dönüştür
    const finishRecordingPromise = new Promise<{ base64: string; mimeType: string } | null>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          if (this.recordedChunks.length === 0) {
            resolve(null);
            return;
          }

          const blob = new Blob(this.recordedChunks, { type: this.recordedMimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve({ base64: base64String, mimeType: this.recordedMimeType });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        } catch (e) {
          console.warn("[SpeechService] Ses verisi dönüştürülemedi:", e);
          resolve(null);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (_) {
        resolve(null);
      }
    });

    // Donanım mikrofon track'lerini serbest bırak
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    const recordedData = await finishRecordingPromise;
    this.mediaRecorder = null;

    const finalTranscript = this.currentTranscript.trim();

    // Eğer Web Speech API metin çıkardıysa öncelikle onu ilet
    if (callbacks?.onEnd) {
      callbacks.onEnd(finalTranscript);
    }

    // Eğer ses kaydı alındıysa ve metin yoksa (veya ses kaydı dinleyicisi varsa)
    if (recordedData && callbacks?.onAudioRecorded) {
      callbacks.onAudioRecorded(recordedData.base64, recordedData.mimeType);
    }
  }

  /**
   * Ses dinlemeyi anında iptal eder (herhangi bir sonuç göndermeden).
   */
  public abortListening(): void {
    this.isListening = false;
    this.activeCallbacks = null;
    this.stopAudioVolumeMonitor();

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }

    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.stop();
      } catch (_) {}
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.recordedChunks = [];
    this.currentTranscript = "";
  }

  /**
   * Asistanın Türkçe metin seslendirmesi (Text-to-Speech).
   */
  public speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      onEnd?: () => void;
      onStart?: () => void;
    }
  ) {
    if (!this.isSynthesisSupported()) return;

    try {
      window.speechSynthesis.cancel();

      // Türkçe okunuşa uygun temizlik
      let cleaned = text
        .replace(/₺/g, " TL")
        .replace(/\bTL\b/gi, " Türk Lirası")
        .replace(/[*_#`~[\]()]/g, "") // Markdown işaretlerini temizle
        .replace(/[\u{1F300}-\u{1F9FF}\u{1F400}-\u{1F6FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu, "") // Emojileri temizle
        .replace(/\s+/g, " ")
        .trim();

      if (!cleaned) return;

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = "tr-TR";
      utterance.rate = options?.rate ?? 1.05;
      utterance.pitch = options?.pitch ?? 1.0;

      // Türkçe ses seçimi
      const voices = window.speechSynthesis.getVoices();
      const trVoice = voices.find((v) => v.lang.startsWith("tr"));
      if (trVoice) {
        utterance.voice = trVoice;
      }

      utterance.onstart = () => {
        options?.onStart?.();
      };

      utterance.onend = () => {
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        console.warn("[SpeechService] TTS seslendirme hatası:", e);
        options?.onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[SpeechService] speak() hatası:", err);
    }
  }

  /**
   * Aktif seslendirmeyi susturur.
   */
  public stopSpeaking() {
    if (this.isSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechService = new SpeechService();
export default speechService;

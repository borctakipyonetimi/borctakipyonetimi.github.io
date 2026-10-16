/**
 * Bütçem Pro - Profesyonel Ses Tanıma ve Sesli Asistan Servisi
 * Web Speech API (SpeechRecognition & SpeechSynthesis) ve Web Audio API entegrasyonu.
 */

export interface SpeechListenCallbacks {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string, isFatal: boolean, rawError?: any) => void;
  onEnd?: (finalTranscript: string) => void;
  onVolumeChange?: (volume: number) => void; // 0 - 100 arası anlık ses şiddeti
}

class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private currentTranscript: string = "";

  /**
   * Tarayıcı veya WebView'in Speech Recognition desteğini kontrol eder.
   */
  public isSupported(): boolean {
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
        error: "Tarayıcınızda veya cihazınızda ses kayıt arayüzü (getUserMedia) bulunamadı."
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
      // Test başarılı, track'leri kapat
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (err: any) {
      console.warn("[SpeechService] Mikrofon erişim hatası:", err);
      let errorMsg = "Mikrofon izni alınamadı.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Mikrofon izni reddedildi. Lütfen tarayıcı veya uygulama izinlerinden mikrofona erişim sağlayın.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "Cihazınızda aktif bir mikrofon donanımı bulunamadı.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMsg = "Mikrofon başka bir uygulama tarafından meşgul edilmiş durumda.";
      }
      return { granted: false, error: errorMsg };
    }
  }

  /**
   * Ses şiddetini (RMS) analiz ederek canlı dalga animasyonu üretir.
   */
  private async startAudioVolumeMonitor(onVolumeChange?: (vol: number) => void) {
    if (!onVolumeChange || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
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
        // 0 - 100 ölçeğine normalize et
        const normalizedVol = Math.min(100, Math.round((average / 128) * 100));
        onVolumeChange(normalizedVol);

        this.animFrameId = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn("[SpeechService] Ses dalgası analizi başlatılamadı:", err);
    }
  }

  private stopAudioVolumeMonitor() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
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
   * Ses dinleme döngüsünü başlatır.
   */
  public async startListening(callbacks: SpeechListenCallbacks, lang: string = "tr-TR"): Promise<boolean> {
    if (!this.isSupported()) {
      callbacks.onError?.("Cihazınızda Web Speech API desteği bulunamadı. Lütfen komutunuzu yazarak giriniz.", true);
      return false;
    }

    // Halihazırda açıksa durdur
    this.stopListening();

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.lang = lang;
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.currentTranscript = "";

      this.recognition.onstart = () => {
        this.isListening = true;
        callbacks.onStart?.();
        // Gerçek zamanlı ses şiddet ölçümünü başlat
        this.startAudioVolumeMonitor(callbacks.onVolumeChange);
      };

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
        console.warn("[SpeechService] Ses algılama hatası:", event.error);
        this.isListening = false;
        this.stopAudioVolumeMonitor();

        let friendlyMsg = "Ses algılanırken bir sorun oluştu.";
        let isFatal = false;

        switch (event.error) {
          case "not-allowed":
          case "service-not-allowed":
            friendlyMsg = "Mikrofon erişim izni verilmedi. Lütfen tarayıcı veya cihaz ayarlarından mikrofona izin verin.";
            isFatal = true;
            break;
          case "no-speech":
            friendlyMsg = "Ses algılanamadı. Mikrofona biraz daha yakınlaşarak tekrar konuşmayı deneyin.";
            break;
          case "network":
            friendlyMsg = "Ses tanıma için internet bağlantısı kurulamadı. Lütfen ağınızı kontrol edin veya yazarak girin.";
            isFatal = true;
            break;
          case "audio-capture":
            friendlyMsg = "Mikrofon donanımı bulunamadı veya başka bir program tarafından kullanılıyor.";
            isFatal = true;
            break;
          case "aborted":
            // Kullanıcı durdurdu
            return;
          default:
            friendlyMsg = `Ses servisi uyarısı (${event.error || "bilinmiyor"}). Lütfen tekrar deneyin.`;
        }

        callbacks.onError?.(friendlyMsg, isFatal, event);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.stopAudioVolumeMonitor();
        callbacks.onEnd?.(this.currentTranscript.trim());
      };

      this.recognition.start();
      return true;
    } catch (err: any) {
      console.error("[SpeechService] Dinleme başlatılamadı:", err);
      this.isListening = false;
      this.stopAudioVolumeMonitor();
      callbacks.onError?.("Mikrofon başlatılamadı. Lütfen uygulama izinlerini kontrol edin.", true, err);
      return false;
    }
  }

  /**
   * Ses dinlemeyi güvenli şekilde durdurur.
   */
  public stopListening() {
    this.isListening = false;
    this.stopAudioVolumeMonitor();

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
  }

  /**
   * Ses dinlemeyi anında iptal eder.
   */
  public abortListening() {
    this.isListening = false;
    this.stopAudioVolumeMonitor();

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
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

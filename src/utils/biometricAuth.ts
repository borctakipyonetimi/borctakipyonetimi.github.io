import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

// BiometricAuth Wrapper providing native and convenience helper APIs
export const BiometricAuth = {
  checkBiometry: async () => {
    try {
      if (!Capacitor.isNativePlatform()) {
        return { isAvailable: false, biometryType: BiometryType.NONE };
      }
      const res = await NativeBiometric.isAvailable();
      return { isAvailable: !!res.isAvailable, biometryType: res.biometryType };
    } catch (err) {
      return { isAvailable: false, biometryType: BiometryType.NONE };
    }
  },
  isAvailable: async (options?: any) => {
    if (!Capacitor.isNativePlatform()) {
      return { isAvailable: false, biometryType: BiometryType.NONE };
    }
    return NativeBiometric.isAvailable(options);
  },
  verifyBiometric: async (options?: {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    cancelButtonText?: string;
    negativeButtonText?: string;
  }) => {
    if (!Capacitor.isNativePlatform()) {
      return { verified: true };
    }
    try {
      await NativeBiometric.verifyIdentity({
        reason: options?.reason || "Bütçem Pro verilerinize erişmek için lütfen kimliğinizi doğrulayın",
        title: options?.title || "Güvenli Giriş",
        subtitle: options?.subtitle || "Biyometrik Kimlik Doğrulama",
        description: options?.description || options?.reason,
        negativeButtonText: options?.cancelButtonText || options?.negativeButtonText || "İptal",
        useFallback: false
      });
      return { verified: true };
    } catch (e) {
      return { verified: false, error: e };
    }
  },
  verifyIdentity: async (options?: any) => {
    return NativeBiometric.verifyIdentity(options);
  }
};

export async function BiyometrikDogrulamaYap(): Promise<boolean> {
  const kilitAktifMi = localStorage.getItem('biometric_lock') === 'true';
  if (!kilitAktifMi) return true; // Kilit açık değilse doğrudan uygulamaya gir

  // Önce cihazda parmak izi/yüz tanıma donanımı var mı kontrol et
  try {
    const result = await BiometricAuth.checkBiometry();
    if (result && result.isAvailable) {
      // Ekranı tamamen kapatıp resmi Android Biyometrik penceresini fırlatıyoruz
      try {
        const authResult = await BiometricAuth.verifyBiometric({
          reason: "Bütçem Pro verilerinize erişmek için lütfen kimliğinizi doğrulayın",
          title: "Güvenli Giriş",
          subtitle: "Biyometrik Kimlik Doğrulama",
          cancelButtonText: "İptal"
        });
        if (authResult && authResult.verified) {
          console.log("Giriş Başarılı!");
          // Burada ana ekranı görünür yap
          return true;
        } else {
          try {
            (navigator as any).app?.exitApp?.();
          } catch (_) {}
          return false;
        }
      } catch (error) {
        // Doğrulama başarısız olursa uygulamayı kapat veya kilitli ekranda tut
        try {
          (navigator as any).app?.exitApp?.();
        } catch (_) {}
        return false;
      }
    }
  } catch (err) {
    console.warn("Biyometrik kontrol atlandı:", err);
  }
  return true;
}

export { NativeBiometric, BiometryType };

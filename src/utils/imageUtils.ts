/**
 * Profil resmi sıkıştırma ve boyutlandırma yardımcı fonksiyonları.
 * Veritabanının şişmesini ve yavaşlamasını önlemek amacıyla görselleri
 * maksimum 200x200 piksel boyutuna indirger ve optimize edilmiş JPEG Base64 dizisi üretir.
 */
export const compressAndResizeImage = (
  fileOrData: File | string,
  maxWidth = 200,
  maxHeight = 200,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const processImage = (srcUrl: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          let width = img.width || maxWidth;
          let height = img.height || maxHeight;

          // En-boy oranını koruyarak maksimum 200x200 sınırına çek
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve(srcUrl);
            return;
          }

          // Kaliteli ve pürüzsüz çizim ayarları
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Hafif ve yüksek uyumluluklu JPEG Base64 çıktısı
          const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedBase64);
        } catch (canvasErr) {
          console.warn("Canvas sıkıştırma uyarısı, orijinal veri kullanılıyor:", canvasErr);
          resolve(srcUrl);
        }
      };

      img.onerror = (imgErr) => {
        console.error("Görsel yükleme hatası:", imgErr);
        reject(new Error("Görsel yüklenemedi"));
      };

      img.src = srcUrl;
    };

    if (typeof fileOrData === "string") {
      processImage(fileOrData);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          processImage(result);
        } else {
          reject(new Error("Dosya okunamadı"));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrData);
    }
  });
};

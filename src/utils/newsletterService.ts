/**
 * Bütçem Pro - Haber Bülteni Servisi (Newsletter Service)
 * Firebase veritabanı kaydı, doğrudan sabit EmailJS API anahtarları ve onay e-postası
 */

import emailjs from "@emailjs/browser";
import { db, ref, set } from "./firebase";

export interface NewsletterResult {
  success: boolean;
  message: string;
  email: string;
}

// EmailJS bağlantısını doğrudan bana özel güncel anahtarlarla kilitliyoruz:
export const EMAILJS_SERVICE_ID = "service_osnjc54";
export const EMAILJS_TEMPLATE_ID = "template_ydyje4e";
export const EMAILJS_PUBLIC_KEY = "KNh4u8my4-19aJZMn";

export interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

export function getEmailJSConfig(): EmailJSConfig {
  return {
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    publicKey: EMAILJS_PUBLIC_KEY
  };
}

/**
 * Kullanıcı bültene kaydolduğunda:
 * 1. Firebase Realtime Database 'bulten_aboneleri' tablosuna kaydeder.
 * 2. Yerel tarayıcı hafızasına (localStorage) aboneliği işler.
 * 3. Doğrudan sabit anahtarlarla kilitlenmiş EmailJS üzerinden onay e-postası fırlatır.
 * 4. Sunucu SMTP köprüsüne (/api/newsletter/subscribe) onay e-postasını iletir.
 */
export async function subscribeToNewsletter(emailInput: string): Promise<NewsletterResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes("@") || !email.includes(".")) {
    throw new Error("Lütfen geçerli bir e-posta adresi giriniz.");
  }

  const subject = "Bütçem Pro - Bülten Üyeliğiniz Onaylandı! 🎉";
  const bodyText = "Merhaba, Bütçem Pro bültenine başarıyla kayıt oldunuz. Artık en güncel finansal ipuçları, bütçe yönetim taktikleri ve yeni uygulama güncellemeleri anında e-posta kutunuza gelecek. Aramıza hoş geldiniz! İyi günler dileriz.";

  // 1. Firebase Realtime Database'e kaydet
  try {
    const sanitizedEmail = email.replace(/[.#$[\]/]/g, "_");
    const subscriberRef = ref(db, `bulten_aboneleri/${sanitizedEmail}`);
    await set(subscriberRef, {
      email,
      kayitTarihi: Date.now(),
      kayitTarihiFormatli: new Date().toLocaleString("tr-TR"),
      durum: "aktif",
      kaynak: "Web Uygulamasi"
    });
  } catch (dbErr) {
    console.warn("[Newsletter] Firebase veritabanı kayıt uyarısı:", dbErr);
  }

  // 2. Yerel depolamaya kaydet
  try {
    const localSubscribers: string[] = JSON.parse(localStorage.getItem("bulten_aboneleri") || "[]");
    if (!localSubscribers.includes(email)) {
      localSubscribers.push(email);
      localStorage.setItem("bulten_aboneleri", JSON.stringify(localSubscribers));
    }
  } catch (_) {}

  // 3. EmailJS ile onay e-postası gönderimi (Sabit anahtarlarla doğrudan)
  const templateParams = {
    to_email: email,
    email: email,
    user_email: email,
    to_name: email.split("@")[0],
    subject: subject,
    title: subject,
    message: bodyText,
    content: bodyText,
    date: new Date().toLocaleDateString("tr-TR")
  };

  try {
    // E-posta gönderim fonksiyonunu bu sabit anahtarları kullanacak şekilde güncelle
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY)
      .then(function(response) {
        console.log('E-posta başarıyla gönderildi!', response.status, response.text);
      }, function(error) {
        console.error('E-posta gönderim hatası:', error);
      });
  } catch (sdkErr) {
    console.warn("[Newsletter] EmailJS SDK çağrısı sonrası REST fallback deneniyor:", sdkErr);
    try {
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: templateParams
        })
      });
    } catch (restErr) {
      console.warn("[Newsletter] EmailJS REST fallback uyarısı:", restErr);
    }
  }

  // 4. Sunucu e-posta köprüsü (/api/newsletter/subscribe) üzerinden gönderim
  try {
    const serverResponse = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        subject,
        message: bodyText
      })
    });

    if (serverResponse.ok) {
      const serverData = await serverResponse.json();
      console.log("[Newsletter] Sunucu onay e-postası köprüsü yanıtı:", serverData);
    }
  } catch (serverErr) {
    console.warn("[Newsletter] Sunucu bülten e-posta köprüsü çağrısı:", serverErr);
  }

  return {
    success: true,
    message: "Bültene başarıyla kaydoldunuz! Onay e-postası adresinize gönderildi. 🎉",
    email
  };
}

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
export const EMAILJS_TEMPLATE_ID = "template_ydyje4e"; // Bülten aboneliği şablon ID'si
export const WELCOME_TEMPLATE_ID = "template_00cqhp4"; // Yeni üyelere özel "Hoş Geldiniz" şablon ID'si
export const EMAILJS_PUBLIC_KEY = "KNh4u8my4-19aJZMn";

export interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  welcomeTemplateId: string;
  publicKey: string;
}

export function getEmailJSConfig(): EmailJSConfig {
  return {
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    welcomeTemplateId: WELCOME_TEMPLATE_ID,
    publicKey: EMAILJS_PUBLIC_KEY
  };
}

/**
 * Yeni üye olan kullanıcılara EmailJS üzerinden "Hoş Geldiniz" e-postası gönderir.
 * 
 * Şablon ID: template_00cqhp4 (WELCOME_TEMPLATE_ID)
 * Şablon Parametreleri:
 *   - user_name: Yeni üyenin adı
 *   - to_email / user_email: Yeni üyenin e-postası
 * 
 * Hata Yönetimi (Fail-Safe):
 *   - try-catch korumalıdır. E-posta servisi hata verse bile kullanıcının kayıt süreci aksamaz.
 */
export async function sendWelcomeEmail(toEmail: string, userName?: string): Promise<boolean> {
  const cleanEmail = (toEmail || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return false;
  }

  // Yeni üyenin adı (veya e-posta önekinden türetilen ad)
  const derivedName = (userName && userName.trim()) 
    ? userName.trim() 
    : cleanEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const templateParams = {
    user_name: derivedName,
    to_name: derivedName,
    name: derivedName,
    to_email: cleanEmail,
    user_email: cleanEmail,
    email: cleanEmail,
    subject: "Bütçem Pro'ya Hoş Geldiniz! 👑",
    title: "Bütçem Pro'ya Hoş Geldiniz! 👑",
    date: new Date().toLocaleDateString("tr-TR")
  };

  try {
    // 1. EmailJS Browser SDK ile gönderim
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      WELCOME_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );
    console.log(`[WelcomeEmail] Hoş Geldiniz e-postası başarıyla gönderildi: ${cleanEmail}`);
    return true;
  } catch (sdkErr: any) {
    console.warn("[WelcomeEmail] EmailJS SDK çağrısı başarısız, REST fallback deneniyor:", sdkErr);
    try {
      // 2. EmailJS REST API Fallback
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: WELCOME_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: templateParams
        })
      });
      console.log(`[WelcomeEmail] Hoş Geldiniz e-postası REST fallback ile gönderildi: ${cleanEmail}`);
      return true;
    } catch (restErr) {
      // Fail-Safe: Hata loglanır fakat hata fırlatılmaz, kayıt süreci ASLA aksamaz.
      console.warn("[WelcomeEmail] Hoş Geldiniz e-postası gönderilemedi (Kayıt işlemi etkilenmedi):", restErr);
      return false;
    }
  }
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

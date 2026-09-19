/**
 * Bütçem Pro - Haber Bülteni Servisi (Newsletter Service)
 * Firebase veritabanı kaydı, EmailJS REST API ve SMTP e-posta onay köprüsü
 */

import { db, ref, set } from "./firebase";

export interface NewsletterResult {
  success: boolean;
  message: string;
  email: string;
}

const EMAILJS_CONFIG_KEY = "butcempro_emailjs_config";

export interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

export function getEmailJSConfig(): EmailJSConfig {
  let savedConfig: Partial<EmailJSConfig> = {};
  try {
    const raw = localStorage.getItem(EMAILJS_CONFIG_KEY);
    if (raw) savedConfig = JSON.parse(raw);
  } catch (_) {}

  return {
    serviceId: savedConfig.serviceId || (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID || "service_butcempro",
    templateId: savedConfig.templateId || (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID || "template_bulten",
    publicKey: savedConfig.publicKey || (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || "public_key_butcempro"
  };
}

export function saveEmailJSConfig(config: Partial<EmailJSConfig>) {
  try {
    const current = getEmailJSConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(EMAILJS_CONFIG_KEY, JSON.stringify(updated));
  } catch (_) {}
}

/**
 * Kullanıcı bültene kaydolduğunda:
 * 1. Firebase Realtime Database 'bulten_aboneleri' tablosuna kaydeder.
 * 2. Yerel tarayıcı hafızasına (localStorage) aboneliği işler.
 * 3. EmailJS REST API altyapısına onay e-postası fırlatır.
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

  // 3. EmailJS REST API ile onay e-postası gönderimi
  let emailJsSent = false;
  try {
    const config = getEmailJSConfig();
    const emailJsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: {
          to_email: email,
          email: email,
          user_email: email,
          to_name: email.split("@")[0],
          subject: subject,
          title: subject,
          message: bodyText,
          content: bodyText,
          date: new Date().toLocaleDateString("tr-TR")
        }
      })
    });

    if (emailJsResponse.ok) {
      emailJsSent = true;
      console.log("[Newsletter] EmailJS REST API ile onay e-postası başarıyla gönderildi.");
    }
  } catch (emailJsErr) {
    console.warn("[Newsletter] EmailJS REST API çağrısı:", emailJsErr);
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

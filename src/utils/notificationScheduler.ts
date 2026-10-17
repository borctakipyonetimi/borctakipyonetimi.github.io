/**
 * Dinamik Borç Hatırlatıcı ve Zamanlayıcı Servisi (Notification Scheduler)
 * 
 * Bu modül; şablondan veya manuel olarak eklenen borçlar için kullanıcının
 * "Bildirim Sıklığı ve Zamanı" ayarlarına göre dinamik hatırlatıcılar kurar.
 * 
 * Kurulum Zamanlaması:
 *  a) Son ödeme gününe 3 gün kala
 *  b) Son ödeme gününe kadar olan süreçte (-2, -1 gün ve vade günü)
 *  c) Vadesi geçtikten sonraki 3 gün boyunca (+1, +2, +3 gün)
 * 
 * Temizleme ve Çakışma Önleme:
 *  - Borç ödendiği an, o borca ait kurulmuş olan tüm dinamik hatırlatıcılar otomatik iptal edilir.
 *  - Her bildirim benzersiz borç ID'si ile ilişkilendirilir.
 */

import { Debt } from "../types";
import { parseDateParts } from "./dateUtils";
import {
  scheduleCapacitorAlarm,
  cancelCapacitorAlarm,
  scheduleAndroidDebtAlarm,
  cancelAndroidDebtAlarm
} from "./androidAlarmBridge";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * Kullanıcının ayarlardan seçtiği bildirim saatlerini döndürür.
 * "1" -> Günde 1 Kez (09:00)
 * "2" -> Günde 2 Kez (09:00, 18:00)
 * "3" -> Günde 3 Kez (09:00, 13:00, 19:00)
 * "4" -> Günde 4 Kez (09:00, 13:00, 18:00, 21:00)
 * "hourly" -> 2 Saatte Bir (09:00, 11:00, 13:00, 15:00, 17:00, 19:00, 21:00)
 */
export function getNotificationHours(frequency?: string): number[] {
  const freq = frequency || (typeof window !== "undefined" ? localStorage.getItem("pushNotificationFrequency") : null) || "2";

  switch (freq) {
    case "1":
      return [9];
    case "2":
      return [9, 18];
    case "3":
      return [9, 13, 19];
    case "4":
      return [9, 13, 18, 21];
    case "hourly":
      return [9, 11, 13, 15, 17, 19, 21];
    default:
      return [9, 18];
  }
}

/**
 * Belirli bir borç ID'si, gün ofseti ve saat sırası için benzersiz 32-bit bildirim ID'si üretir.
 * 300.000.000 + (debtId % 100000) * 100 + ((offset + 3) * 10) + hourIndex
 */
export function getDynamicNotificationId(debtId: number | string, dayOffset: number, hourIndex: number): number {
  const numId = typeof debtId === "number" ? Math.abs(debtId) : (parseInt(String(debtId), 10) || 1);
  const debtSlot = numId % 100000;
  const dayIndex = Math.min(6, Math.max(0, dayOffset + 3)); // -3 => 0, 0 => 3, +3 => 6
  const slot = (hourIndex % 10);
  return 300000000 + (debtSlot * 100) + (dayIndex * 10) + slot;
}

/**
 * Borca ait saklanmış dinamik bildirim ID'lerinin anahtarını verir.
 */
function getStorageKey(debtId: number | string): string {
  return `scheduled_debt_notifs_${debtId}`;
}

/**
 * Dinamik bildirim metinlerini ve başlıklarını üretir.
 */
function getReminderCopy(debtName: string, remainingFormatted: string, dateFormatted: string, dayOffset: number) {
  let title = "🚨 Bütçem Pro: Ödeme Hatırlatıcı!";
  let statusText = "Gecikmemesi için lütfen kontrol edin!";

  if (dayOffset === -3) {
    title = `🚨 Bütçem Pro: ${debtName} - 3 Gün Kaldı!`;
    statusText = "Son ödeme gününe 3 gün kaldı! Planlamanızı yapmayı unutmayın.";
  } else if (dayOffset === -2) {
    title = `🚨 Bütçem Pro: ${debtName} - 2 Gün Kaldı!`;
    statusText = "Son ödeme gününe 2 gün kaldı! Lütfen ödeme durumunu kontrol edin.";
  } else if (dayOffset === -1) {
    title = `⏰ Bütçem Pro: ${debtName} - Son Gün Yarın!`;
    statusText = "Son ödeme günü yarın! Gecikme faizinden kaçınmak için hazırlığınızı yapın.";
  } else if (dayOffset === 0) {
    title = `🔥 Bütçem Pro: ${debtName} - Bugün Son Gün!`;
    statusText = "Bugün son ödeme günü! Lütfen gün sonuna kadar ödemenizi tamamlayın.";
  } else if (dayOffset === 1) {
    title = `⚠️ Bütçem Pro: ${debtName} - 1 Gün Gecikti!`;
    statusText = "Vadesi 1 gün geçti! Ekstra ceza/faiz yansımaması için lütfen hemen ödeyin.";
  } else if (dayOffset === 2) {
    title = `⚠️ Bütçem Pro: ${debtName} - 2 Gün Gecikti!`;
    statusText = "Vadesi 2 gün geçti! Gecikme faizi işlememesi için kontrol edin.";
  } else if (dayOffset === 3) {
    title = `🚨 Bütçem Pro: ${debtName} - 3 Gün Gecikti!`;
    statusText = "Vadesi 3 gün geçti! Kredi puanınızın etkilenmemesi için borcunuzu kapatın.";
  }

  const message = `💰 Borç: ${debtName}\n💵 Miktar: ${remainingFormatted} TL\n📅 Vade: ${dateFormatted}\n⚠️ Durum: ${statusText}`;

  return { title, message, statusText };
}

export interface ScheduleNotificationOptions {
  frequency?: string;
  customHours?: number[];
  nowMs?: number;
}

/**
 * 1. ve 2. Gereksinim: Dinamik Hatırlatma Zamanlaması
 * 
 * Şablondan veya doğrudan eklenen borç için:
 *   a) Son ödeme gününe 3 gün kala
 *   b) Son ödeme gününe kadar olan süreçte (-2, -1, 0)
 *   c) Vadesi geçtikten sonraki 3 gün boyunca (+1, +2, +3)
 * seçilen "Bildirim Sıklığı ve Zamanı" ayarına göre otomatik bildirimleri zamanlar.
 * 
 * @param debt Borç nesnesi
 * @param options Opsiyonel sıklık ve saat parametreleri
 * @returns Kurulan bildirimlerin ID listesi
 */
export async function scheduleNotification(
  debt: Partial<Debt>,
  options?: ScheduleNotificationOptions
): Promise<number[]> {
  if (!debt || !debt.dueDate) return [];

  const debtId = debt.id || 1;
  const isPaid = Boolean(
    (debt as any).isPaid === true ||
    (debt as any).durum === "odendi" ||
    (debt as any).status === "paid" ||
    Number(debt.paid || 0) >= Number(debt.amount || 0)
  );

  // Borç ödendiyse kesinlikle alarm kurma, varsa tümünü temizle
  if (isPaid) {
    await cancelDebtNotifications(debtId);
    return [];
  }

  const dateParts = parseDateParts(debt.dueDate);
  if (!dateParts) return [];

  // Önce bu borca ait eski/çakışan tüm alarmları temizle
  await cancelDebtNotifications(debtId);

  const hours = options?.customHours || getNotificationHours(options?.frequency);
  const now = options?.nowMs || Date.now();
  const scheduledIds: number[] = [];

  const debtName = debt.name?.trim() || "Ödeme";
  const remaining = Math.max(0, Number(debt.amount || 0) - Number(debt.paid || 0));
  const remainingFormatted = remaining.toLocaleString("tr-TR");
  const dueDateFormatted = new Date(dateParts.year, dateParts.month, dateParts.day).toLocaleDateString("tr-TR");

  // Dinamik Zamanlama Matrisi:
  // a) Son ödeme gününe 3 gün kala (-3)
  // b) Son ödeme gününe kadar olan süreçte (-2, -1, 0)
  // c) Vadesi geçtikten sonraki 3 gün boyunca (+1, +2, +3)
  const offsetDays = [-3, -2, -1, 0, 1, 2, 3];

  for (const offset of offsetDays) {
    for (let hIdx = 0; hIdx < hours.length; hIdx++) {
      const hour = hours[hIdx];
      // Hedef tarih ve saat
      const targetDate = new Date(dateParts.year, dateParts.month, dateParts.day + offset, hour, 0, 0, 0);
      const triggerAtMillis = targetDate.getTime();

      // Geçmişe yönelik alarm kurulmaz
      if (triggerAtMillis <= now) {
        continue;
      }

      const notifId = getDynamicNotificationId(debtId, offset, hIdx);
      const { title, message, statusText } = getReminderCopy(
        debtName,
        remainingFormatted,
        dueDateFormatted,
        offset
      );

      try {
        // 1. Capacitor LocalNotifications (Modern Android, Doze Modu ve Ekran Kapalıyken Çalar)
        await scheduleCapacitorAlarm(
          notifId,
          title,
          triggerAtMillis,
          message,
          {
            debtId: Number(debtId),
            borcAdi: debtName,
            miktar: `${remainingFormatted} TL`,
            tarih: dueDateFormatted,
            durum: statusText,
            dayOffset: offset
          }
        );

        // 2. Android Yerel AlarmManager Köprüsü
        scheduleAndroidDebtAlarm(
          notifId,
          title,
          triggerAtMillis,
          message
        );

        scheduledIds.push(notifId);
      } catch (err) {
        console.warn(`[notificationScheduler] ID ${notifId} alarmı kurulurken hata:`, err);
      }
    }
  }

  // Kurulan bildirim ID'lerini bu borç ID'si ile ilişkilendirerek hafızaya kaydet
  if (typeof window !== "undefined" && scheduledIds.length > 0) {
    try {
      localStorage.setItem(getStorageKey(debtId), JSON.stringify(scheduledIds));
    } catch {}
  }

  return scheduledIds;
}

/**
 * 3. Gereksinim: Temizleme ve Çakışma Önleme
 * 
 * Borç ödendiği veya silindiği an, o borca ait kurulmuş olan TÜM dinamik
 * hatırlatıcıları (Capacitor, Cordova, AlarmManager) otomatik olarak siler ve iptal eder.
 * Her bildirim borç ID'si ile ilişkilendirildiğinden diğer borçların alarmlarına dokunmaz.
 * 
 * @param debtId Borcun benzersiz ID değeri
 */
export async function cancelDebtNotifications(debtId: number | string): Promise<boolean> {
  if (!debtId) return false;
  const numId = typeof debtId === "number" ? Math.abs(debtId) : (parseInt(String(debtId), 10) || 1);

  const idsToCancel: number[] = [];

  // 1. Hafızada saklanan dinamik bildirim ID'lerini al
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(getStorageKey(debtId));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => {
            if (typeof id === "number" && !idsToCancel.includes(id)) {
              idsToCancel.push(id);
            }
          });
        }
      }
    } catch {}
  }

  // 2. Deterministik tüm olası slotları da kapsayacak şekilde ekle (hafıza temizlenmiş olsa bile tam temizlik)
  const offsetDays = [-3, -2, -1, 0, 1, 2, 3];
  for (const offset of offsetDays) {
    for (let hIdx = 0; hIdx < 8; hIdx++) {
      const notifId = getDynamicNotificationId(numId, offset, hIdx);
      if (!idsToCancel.includes(notifId)) {
        idsToCancel.push(notifId);
      }
    }
  }

  // 3. Klasik statik borç alarmı ID'lerini de ekle
  if (!idsToCancel.includes(numId)) idsToCancel.push(numId);
  if (!idsToCancel.includes(200000 + numId)) idsToCancel.push(200000 + numId);
  if (!idsToCancel.includes(800000 + numId)) idsToCancel.push(800000 + numId);

  // 4. Capacitor LocalNotifications üzerinden topluca ve tek tek iptal et
  try {
    if (typeof (LocalNotifications as any)?.cancel === "function") {
      await LocalNotifications.cancel({
        notifications: idsToCancel.map((id) => ({ id }))
      }).catch(() => {});
    }
  } catch {}

  // 5. Capacitor Alarm ve Android Debt Alarm köprüsünden tek tek düşür
  idsToCancel.forEach((id) => {
    cancelCapacitorAlarm(id).catch(() => {});
    cancelAndroidDebtAlarm(id);
  });

  // 6. Hafızadaki ilişkilendirilmiş kayıt listesini temizle
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(getStorageKey(debtId));
    } catch {}
  }

  return true;
}

export async function cancelSubscriptionExpiryNotifications(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem("subscription_expiry_notif_ids");
    if (stored) {
      const ids: number[] = JSON.parse(stored);
      if (Array.isArray(ids) && ids.length > 0) {
        if (typeof (LocalNotifications as any)?.cancel === "function") {
          await LocalNotifications.cancel({
            notifications: ids.map((id) => ({ id }))
          }).catch(() => {});
        }
        ids.forEach((id) => {
          cancelCapacitorAlarm(id).catch(() => {});
          cancelAndroidDebtAlarm(id);
        });
      }
      localStorage.removeItem("subscription_expiry_notif_ids");
    }
  } catch (err) {
    console.warn("[notificationScheduler] cancelSubscriptionExpiryNotifications hatası:", err);
  }
}

/**
 * Abonelik bitiş tarihine son 7 gün kala her gün saat 10:00'da hatırlatıcı bildirim kurar.
 */
export async function scheduleSubscriptionExpiryNotifications(expiryDateStr?: string | null): Promise<number[]> {
  if (typeof window === "undefined") return [];
  
  // Önce eski abonelik bitiş bildirimlerini temizle
  await cancelSubscriptionExpiryNotifications();

  if (!expiryDateStr || expiryDateStr === "lifetime" || expiryDateStr === "false" || expiryDateStr === "null") {
    return [];
  }

  const expiryTime = new Date(expiryDateStr).getTime();
  if (isNaN(expiryTime) || expiryTime <= Date.now()) {
    return [];
  }

  const now = Date.now();
  const scheduledIds: number[] = [];
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const timeDifference = expiryTime - now;

  // Eğer bitiş tarihine 7 günden az kaldıysa veya tam 7 gün içindeyse bildirimleri kurmaya başla
  if (timeDifference <= sevenDaysMs) {
    // Son 7 gün için her gün saat 10:00'da (veya bugün için hemen 1 dakika sonra)
    for (let dayBefore = 7; dayBefore >= 1; dayBefore--) {
      const targetDate = new Date(expiryTime - (dayBefore * 24 * 60 * 60 * 1000));
      targetDate.setHours(10, 0, 0, 0);
      let triggerAtMillis = targetDate.getTime();

      if (triggerAtMillis <= now) {
        triggerAtMillis = now + 60000; // Geçmişte kaldıysa 1 dakika sonraya kur
      }

      const notifId = 990000 + dayBefore;
      const title = `🚨 Bütçem Pro: Aboneliğinizin Bitmesine ${dayBefore} Gün Kaldı!`;
      const message = `Premium aboneliğiniz ${new Date(expiryTime).toLocaleDateString("tr-TR")} tarihinde sona erecektir. Kesintisiz kullanım ve ayrıcalıklarınızdan ödün vermemek için lütfen aboneliğinizi yenileyin!`;

      try {
        await scheduleCapacitorAlarm(
          notifId,
          title,
          triggerAtMillis,
          message,
          {
            isSubscriptionExpiry: true,
            daysRemaining: dayBefore,
            expiryDate: new Date(expiryTime).toLocaleDateString("tr-TR")
          }
        );

        scheduleAndroidDebtAlarm(
          notifId,
          title,
          triggerAtMillis,
          message
        );

        scheduledIds.push(notifId);
      } catch (err) {
        console.warn(`[notificationScheduler] Abonelik bitiş bildirimi #${notifId} kurulamadı:`, err);
      }
    }

    if (scheduledIds.length > 0) {
      try {
        localStorage.setItem("subscription_expiry_notif_ids", JSON.stringify(scheduledIds));
        localStorage.setItem("subscription_expiry_target_date", expiryDateStr);
      } catch {}
    }
  }

  return scheduledIds;
}


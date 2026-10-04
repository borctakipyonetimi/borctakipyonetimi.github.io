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

/**
 * Şablondan borçlar aktarılırken her borç için otomatik bildirim kuran mantık
 */
export async function createFromTemplate(
  debtsToImport: Partial<Debt>[],
  frequency?: string
): Promise<{ scheduledDebtsCount: number; totalAlarmsCount: number }> {
  if (!Array.isArray(debtsToImport) || debtsToImport.length === 0) {
    return { scheduledDebtsCount: 0, totalAlarmsCount: 0 };
  }

  let scheduledDebtsCount = 0;
  let totalAlarmsCount = 0;

  for (const debt of debtsToImport) {
    if (!debt.dueDate) continue;
    const isPaid = Number(debt.paid || 0) >= Number(debt.amount || 0);
    if (isPaid) continue;

    const scheduled = await scheduleNotification(debt, { frequency });
    if (scheduled.length > 0) {
      scheduledDebtsCount++;
      totalAlarmsCount += scheduled.length;
    }
  }

  return { scheduledDebtsCount, totalAlarmsCount };
}

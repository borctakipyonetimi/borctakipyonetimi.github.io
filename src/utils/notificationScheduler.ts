/**
 * Dinamik Borç Hatırlatıcı ve Zamanlayıcı Servisi (Notification Scheduler)
 * 
 * Bu modül; şablondan veya manuel olarak eklenen borçlar ve taksitler için
 * kullanıcının "Bildirim Sıklığı ve Zamanı" ayarlarına (ör. 2 Saatte Bir - hourly)
 * göre dinamik hatırlatıcılar kurar.
 * 
 * Kurulum Zamanlaması:
 *  a) Vadesi geçmiş borçlar için gün içi periyodik hatırlatmalar (2 saatte bir veya günde X kez)
 *  b) Son ödeme gününe 3 gün kala
 *  c) Son ödeme gününe kadar olan süreçte (-2, -1 gün ve vade günü)
 *  d) Vadesi geçtikten sonraki günlerde düzenli aralıklarla
 * 
 * Temizleme ve Çakışma Önleme:
 *  - Borç veya taksit ödendiği an, o borca ait kurulmuş tüm dinamik hatırlatıcılar otomatik iptal edilir.
 *  - Her bildirim benzersiz borç ID'si ile ilişkilendirilir.
 */

import { Debt, InstallmentDebt } from "../types";
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
 */
export function getDynamicNotificationId(debtId: number | string, dayOffset: number, hourIndex: number): number {
  const numId = typeof debtId === "number" ? Math.abs(debtId) : (parseInt(String(debtId), 10) || 1);
  const debtSlot = numId % 100000;
  const dayIndex = Math.min(9, Math.max(0, dayOffset + 3)); // -3 => 0, 0 => 3, +3 => 6
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
function getReminderCopy(debtName: string, remainingFormatted: string, dateFormatted: string, dayOffset: number, isOverdueDebt = false) {
  let title = "🚨 Bütçem Pro: Ödeme Hatırlatıcı!";
  let statusText = "Gecikmemesi için lütfen kontrol edin!";

  if (isOverdueDebt) {
    title = `⚠️ Bütçem Pro: ${debtName} - Gecikmiş Ödeme Uyarısı!`;
    statusText = "Vadesi geçti! Gecikme faizi ve cezalardan kaçınmak için lütfen kontrol edin.";
  } else if (dayOffset === -3) {
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
  } else if (dayOffset >= 3) {
    title = `🚨 Bütçem Pro: ${debtName} - ${dayOffset} Gün Gecikti!`;
    statusText = `Vadesi ${dayOffset} gün geçti! Kredi puanınızın etkilenmemesi için borcunuzu kapatın.`;
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
 * Şablondan veya doğrudan eklenen borç için:
 *   a) Vadesi geçmiş borçlar için periyodik (örneğin 2 saatte bir) hatırlatmalar
 *   b) Son ödeme gününe 3 gün kala (-3)
 *   c) Son ödeme gününe kadar olan süreçte (-2, -1, 0)
 *   d) Vadesi geçtikten sonraki süreçte (+1, +2, +3)
 * seçilen "Bildirim Sıklığı ve Zamanı" ayarına göre otomatik bildirimleri zamanlar.
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
  if (remaining <= 0) return [];

  const remainingFormatted = remaining.toLocaleString("tr-TR");
  const dueDateFormatted = new Date(dateParts.year, dateParts.month, dateParts.day).toLocaleDateString("tr-TR");

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dueDateTime = new Date(dateParts.year, dateParts.month, dateParts.day, 0, 0, 0, 0).getTime();
  const diffDays = Math.round((dueDateTime - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // Vadesi geçmiş borç: Kullanıcının seçtiği saatlere göre bugün ve önümüzdeki 2 gün boyunca periyodik alarm kur
    const daysLate = Math.abs(diffDays);
    for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
      for (let hIdx = 0; hIdx < hours.length; hIdx++) {
        const hour = hours[hIdx];
        const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, hour, 0, 0, 0);
        const triggerAtMillis = targetDate.getTime();

        if (triggerAtMillis <= now) continue;

        const notifId = getDynamicNotificationId(debtId, dayOffset, hIdx);
        const totalLate = daysLate + dayOffset;
        const { title, message, statusText } = getReminderCopy(
          debtName,
          remainingFormatted,
          dueDateFormatted,
          totalLate,
          true
        );

        try {
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
              dayOffset: totalLate
            }
          );
          scheduleAndroidDebtAlarm(notifId, title, triggerAtMillis, message);
          scheduledIds.push(notifId);
        } catch (err) {
          console.warn(`[notificationScheduler] ID ${notifId} alarmı kurulurken hata:`, err);
        }
      }
    }
  } else {
    // Vadesi bugün veya gelecekte olan borç (-3 ile +3 gün arası)
    const offsetDays = [-3, -2, -1, 0, 1, 2, 3];

    for (const offset of offsetDays) {
      for (let hIdx = 0; hIdx < hours.length; hIdx++) {
        const hour = hours[hIdx];
        const targetDate = new Date(dateParts.year, dateParts.month, dateParts.day + offset, hour, 0, 0, 0);
        const triggerAtMillis = targetDate.getTime();

        if (triggerAtMillis <= now) continue;

        const notifId = getDynamicNotificationId(debtId, offset, hIdx);
        const { title, message, statusText } = getReminderCopy(
          debtName,
          remainingFormatted,
          dueDateFormatted,
          offset,
          false
        );

        try {
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
          scheduleAndroidDebtAlarm(notifId, title, triggerAtMillis, message);
          scheduledIds.push(notifId);
        } catch (err) {
          console.warn(`[notificationScheduler] ID ${notifId} alarmı kurulurken hata:`, err);
        }
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
 * Taksitli borçlar için yaklaşan / vadesi geçen taksit bildirimini kurar
 */
export async function scheduleInstallmentNotification(
  inst: Partial<InstallmentDebt>,
  options?: ScheduleNotificationOptions
): Promise<number[]> {
  if (!inst || !inst.firstDueDate) return [];
  const instId = Number(inst.id) || 1;
  const count = Number(inst.installmentCount) || 1;
  const paid = Number(inst.paidInstallmentCount) || 0;

  if (paid >= count) {
    await cancelInstallmentNotifications(instId);
    return [];
  }

  const dateParts = parseDateParts(inst.firstDueDate);
  if (!dateParts) return [];

  const nextDue = new Date(dateParts.year, dateParts.month, dateParts.day);
  nextDue.setMonth(nextDue.getMonth() + paid);
  const nextDueDateStr = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, '0')}-${String(nextDue.getDate()).padStart(2, '0')}`;
  const perAmount = (Number(inst.totalAmount) || 0) / count;
  const instTitle = `${inst.name || "Taksit"} (${paid + 1}/${count}. Taksit)`;

  return scheduleNotification(
    {
      id: 500000 + instId,
      name: instTitle,
      amount: perAmount,
      paid: 0,
      dueDate: nextDueDateStr
    },
    options
  );
}

/**
 * Taksit planına ait alarmları iptal eder
 */
export async function cancelInstallmentNotifications(installmentId: number | string): Promise<boolean> {
  const instId = Number(installmentId) || 1;
  return cancelDebtNotifications(500000 + instId);
}

/**
 * Tüm aktif borç ve taksitler için bildirimleri tek seferde baştan kurar
 */
export async function rescheduleAllNotifications(
  debts: Partial<Debt>[],
  installments?: Partial<InstallmentDebt>[],
  options?: ScheduleNotificationOptions
): Promise<number> {
  let count = 0;
  if (Array.isArray(debts)) {
    for (const d of debts) {
      const isPaid = (d as any).isPaid === true || (d as any).durum === "odendi" || (d as any).status === "paid" || Number(d.paid || 0) >= Number(d.amount || 0);
      if (!isPaid && d.dueDate) {
        const ids = await scheduleNotification(d, options);
        count += ids.length;
      }
    }
  }

  if (Array.isArray(installments)) {
    for (const inst of installments) {
      const isPaid = (inst as any).isPaid === true || (inst as any).durum === "odendi" || (inst as any).status === "paid" || Number(inst.paidInstallmentCount || 0) >= Number(inst.installmentCount || 1);
      if (!isPaid && inst.firstDueDate) {
        const ids = await scheduleInstallmentNotification(inst, options);
        count += ids.length;
      }
    }
  }

  return count;
}

/**
 * Borç ödendiği veya silindiği an, o borca ait kurulmuş olan TÜM dinamik
 * hatırlatıcıları (Capacitor, Cordova, AlarmManager) otomatik olarak siler ve iptal eder.
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

  // 2. Deterministik tüm olası slotları da kapsayacak şekilde ekle
  const offsetDays = [-3, -2, -1, 0, 1, 2, 3, 4, 5];
  for (const offset of offsetDays) {
    for (let hIdx = 0; hIdx < 10; hIdx++) {
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

  if (timeDifference <= sevenDaysMs) {
    for (let dayBefore = 7; dayBefore >= 1; dayBefore--) {
      const targetDate = new Date(expiryTime - (dayBefore * 24 * 60 * 60 * 1000));
      targetDate.setHours(10, 0, 0, 0);
      let triggerAtMillis = targetDate.getTime();

      if (triggerAtMillis <= now) {
        triggerAtMillis = now + 60000;
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

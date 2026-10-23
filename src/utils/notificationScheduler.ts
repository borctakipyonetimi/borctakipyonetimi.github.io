/**
 * Dinamik Borç ve Taksit Hatırlatıcı / Zamanlayıcı Servisi (OS Level Notification Scheduler)
 * 
 * Bu modül; şablondan veya manuel olarak eklenen borçlar ve taksitler için
 * kullanıcının "Bildirim Sıklığı ve Zamanı" ayarlarına (ör. Günde 2 defa, 2 saatte bir vb.)
 * %100 uyumlu olarak cihazın yerel bildirim kuyruğuna (OS-Level Exact Alarm Queue) alarmları kaydeder.
 * 
 * Bildirim Kuralları:
 *  1. Vadeye 3 gün kala başlayarak VADE GÜNÜNE KADAR her gün (-3, -2, -1, 0 gün)
 *  2. Vade günü geçtikten sonra da 3 GÜN BOYUNCA her gün (+1, +2, +3 gün) gecikme uyarısı
 *  3. Vadesi 3 günden fazla geçmiş aktif borçlar için bugünden başlayarak 3 gün boyunca gecikme uyarısı
 * 
 * Uygulama Kapalıyken Çalışma Garantisi:
 *  - Bildirimler sadece uygulama açıkken çalışan React döngülerine değil; doğrudan Capacitor
 *    LocalNotifications aracılığıyla sistem seviyesinde exact alarm (tam saatli tetikleyici)
 *    olarak AlarmManager kuyruğuna kaydedilir.
 *  - allowWhileIdle: true ve exact: true ile Doze modunda veya kilit ekranında bile tam saatinde çalar.
 */

import { Debt, InstallmentDebt } from "../types";
import { parseDateParts } from "./dateUtils";
import {
  initCapacitorNotificationChannel,
  scheduleAndroidDebtAlarm,
  cancelAndroidDebtAlarm,
  cancelCapacitorAlarm
} from "./androidAlarmBridge";
import { LocalNotifications, LocalNotificationSchema } from "@capacitor/local-notifications";

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
 * Android AlarmManager için 32-bit sınırında güvenle çalışır.
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
    if (dayOffset === 1) {
      title = `⚠️ Bütçem Pro: ${debtName} - 1 Gün Gecikti!`;
      statusText = "Vadesi 1 gün geçti! Ekstra ceza ve gecikme faizi yansımaması için lütfen kontrol edin.";
    } else if (dayOffset === 2) {
      title = `⚠️ Bütçem Pro: ${debtName} - 2 Gün Gecikti!`;
      statusText = "Vadesi 2 gün geçti! Gecikme faizinden kaçınmak için ödemenizi tamamlayın.";
    } else if (dayOffset >= 3) {
      title = `🚨 Bütçem Pro: ${debtName} - ${dayOffset} Gün Gecikti!`;
      statusText = `Vadesi ${dayOffset} gün geçti! Kredi puanınızın etkilenmemesi için lütfen hemen kapatın.`;
    } else {
      title = `⚠️ Bütçem Pro: ${debtName} - Gecikmiş Ödeme Uyarısı!`;
      statusText = "Vadesi geçti! Gecikme faizi ve cezalardan kaçınmak için lütfen kontrol edin.";
    }
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
 * Tek bir borç kaydı için OS seviyesinde planlanacak bildirim nesnelerini oluşturur.
 * Kural:
 * - Vadeye 3 gün kala başlayarak VADE GÜNÜNE KADAR her gün: [-3, -2, -1, 0]
 * - Vade günü geçtikten sonra da 3 GÜN BOYUNCA her gün: [+1, +2, +3]
 * - Vadesi 3 günden fazla geçmiş aktif borçlar için bugünden itibaren 3 gün boyunca gecikme uyarısı
 */
export function buildDebtNotificationItems(
  debt: Partial<Debt>,
  options?: ScheduleNotificationOptions
): LocalNotificationSchema[] {
  if (!debt || !debt.dueDate) return [];

  const isPaid = Boolean(
    (debt as any).isPaid === true ||
    (debt as any).durum === "odendi" ||
    (debt as any).status === "paid" ||
    Number(debt.paid || 0) >= Number(debt.amount || 0)
  );
  if (isPaid) return [];

  const dateParts = parseDateParts(debt.dueDate);
  if (!dateParts) return [];

  const debtId = debt.id || 1;
  const debtName = debt.name?.trim() || "Ödeme";
  const remaining = Math.max(0, Number(debt.amount || 0) - Number(debt.paid || 0));
  if (remaining <= 0) return [];

  const remainingFormatted = remaining.toLocaleString("tr-TR");
  const dueDateFormatted = new Date(dateParts.year, dateParts.month, dateParts.day).toLocaleDateString("tr-TR");

  const hours = options?.customHours || getNotificationHours(options?.frequency);
  const now = options?.nowMs || Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const dueDateTime = new Date(dateParts.year, dateParts.month, dateParts.day, 0, 0, 0, 0).getTime();
  const diffDays = Math.round((dueDateTime - today.getTime()) / (1000 * 60 * 60 * 24));

  const items: LocalNotificationSchema[] = [];

  if (diffDays >= -3) {
    // Vadeye 3 gün kala (-3, -2, -1, 0) ve vadeden sonraki 3 gün (+1, +2, +3)
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
          offset > 0
        );

        items.push({
          id: notifId,
          title,
          body: message,
          largeBody: message,
          summaryText: "Ödeme detaylarınızı kontrol etmeyi unutmayın.",
          schedule: {
            at: targetDate,
            allowWhileIdle: true,
            exact: true,
            allowInExactlyDatatype: true,
            forceShow: true
          } as any,
          channelId: "debt_reminders",
          autoCancel: true,
          smallIcon: "ic_stat_notify",
          largeIcon: "ic_stat_notify_large",
          iconColor: "#10B981",
          sound: "beep.wav",
          extra: {
            debtId: Number(debtId),
            borcAdi: debtName,
            miktar: `${remainingFormatted} TL`,
            tarih: dueDateFormatted,
            durum: statusText,
            dayOffset: offset
          }
        } as any);
      }
    }
  } else {
    // Vadesi 3 günden fazla geçmiş borçlar için bugünden başlayarak 3 gün boyunca gecikme uyarısı
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

        items.push({
          id: notifId,
          title,
          body: message,
          largeBody: message,
          summaryText: "Ödeme detaylarınızı kontrol etmeyi unutmayın.",
          schedule: {
            at: targetDate,
            allowWhileIdle: true,
            exact: true,
            allowInExactlyDatatype: true,
            forceShow: true
          } as any,
          channelId: "debt_reminders",
          autoCancel: true,
          smallIcon: "ic_stat_notify",
          largeIcon: "ic_stat_notify_large",
          iconColor: "#10B981",
          sound: "beep.wav",
          extra: {
            debtId: Number(debtId),
            borcAdi: debtName,
            miktar: `${remainingFormatted} TL`,
            tarih: dueDateFormatted,
            durum: statusText,
            dayOffset: totalLate
          }
        } as any);
      }
    }
  }

  return items;
}

/**
 * Taksitli borç kaydı için OS seviyesinde planlanacak bildirim nesnelerini oluşturur.
 */
export function buildInstallmentNotificationItems(
  inst: Partial<InstallmentDebt>,
  options?: ScheduleNotificationOptions
): LocalNotificationSchema[] {
  if (!inst || !inst.firstDueDate) return [];
  const instId = Number(inst.id) || 1;
  const count = Number(inst.installmentCount) || 1;
  const paid = Number(inst.paidInstallmentCount) || 0;
  if (paid >= count) return [];

  const dateParts = parseDateParts(inst.firstDueDate);
  if (!dateParts) return [];

  const nextDue = new Date(dateParts.year, dateParts.month, dateParts.day);
  nextDue.setMonth(nextDue.getMonth() + paid);
  const nextDueDateStr = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, '0')}-${String(nextDue.getDate()).padStart(2, '0')}`;
  const perAmount = (Number(inst.totalAmount) || 0) / count;
  const instTitle = `${inst.name || "Taksit"} (${paid + 1}/${count}. Taksit)`;

  return buildDebtNotificationItems(
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
 * Tek bir borç için alarmları OS yerel bildirim kuyruğuna planlar.
 */
export async function scheduleNotification(
  debt: Partial<Debt>,
  options?: ScheduleNotificationOptions
): Promise<number[]> {
  if (!debt) return [];
  const debtId = debt.id || 1;

  // Önce bu borca ait eski alarmları temizle
  await cancelDebtNotifications(debtId);

  const items = buildDebtNotificationItems(debt, options);
  if (items.length === 0) return [];

  await initCapacitorNotificationChannel();

  try {
    if (typeof (LocalNotifications as any)?.schedule === "function") {
      await LocalNotifications.schedule({
        notifications: items
      });
      console.log(`[notificationScheduler] Borç #${debtId} için ${items.length} adet OS bildirimi planlandı.`);
    }
  } catch (err) {
    console.warn(`[notificationScheduler] Borç #${debtId} planlama hatası:`, err);
  }

  // Android Debt Alarm köprüsünü de senkronize et
  items.forEach((item) => {
    const at = (item.schedule?.at as Date)?.getTime?.() || 0;
    if (at > 0) {
      scheduleAndroidDebtAlarm(item.id, item.title, at, item.body);
    }
  });

  const scheduledIds = items.map((i) => i.id);
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
  if (!inst) return [];
  const instId = Number(inst.id) || 1;
  const virtualDebtId = 500000 + instId;

  await cancelDebtNotifications(virtualDebtId);

  const items = buildInstallmentNotificationItems(inst, options);
  if (items.length === 0) return [];

  await initCapacitorNotificationChannel();

  try {
    if (typeof (LocalNotifications as any)?.schedule === "function") {
      await LocalNotifications.schedule({
        notifications: items
      });
      console.log(`[notificationScheduler] Taksit #${instId} için ${items.length} adet OS bildirimi planlandı.`);
    }
  } catch (err) {
    console.warn(`[notificationScheduler] Taksit #${instId} planlama hatası:`, err);
  }

  items.forEach((item) => {
    const at = (item.schedule?.at as Date)?.getTime?.() || 0;
    if (at > 0) {
      scheduleAndroidDebtAlarm(item.id, item.title, at, item.body);
    }
  });

  const scheduledIds = items.map((i) => i.id);
  if (typeof window !== "undefined" && scheduledIds.length > 0) {
    try {
      localStorage.setItem(getStorageKey(virtualDebtId), JSON.stringify(scheduledIds));
    } catch {}
  }

  return scheduledIds;
}

/**
 * Taksit planına ait alarmları iptal eder
 */
export async function cancelInstallmentNotifications(installmentId: number | string): Promise<boolean> {
  const instId = Number(installmentId) || 1;
  return cancelDebtNotifications(500000 + instId);
}

/**
 * TÜM AKTİF BORÇ VE TAKSİTLERİ CİHAZIN OS YEREL BİLDİRİM KUYRUĞUNA (LOCAL NOTIFICATION QUEUE) KAYDEDER.
 * 
 * Bu fonksiyon çağrıldığında:
 *  1. Önceden kurulmuş olan tüm borç/taksit alarmları OS kuyruğundan temizlenir.
 *  2. Aktif olan tüm borç ve taksitler için seçilen sıklığa (Günde 1, 2, 3, 4 kez veya 2 saatte bir)
 *     göre ileriye dönük tam takvim oluşturulur.
 *  3. Bütün bildirimler tek seferde toplu olarak (batch) OS kuyruğuna yazılır.
 *  4. Böylece uygulama kapalı veya arka planda olsa dahi Android AlarmManager zamanı geldiğinde
 *     bildirimi ekrana düşürür.
 */
export async function rescheduleAllNotifications(
  debts: Partial<Debt>[],
  installments?: Partial<InstallmentDebt>[],
  options?: ScheduleNotificationOptions
): Promise<number> {
  const allItems: LocalNotificationSchema[] = [];
  const allIdsToCancel: number[] = [];

  // 1. Önceki planlanmış ID'leri topla
  if (typeof window !== "undefined") {
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith("scheduled_debt_notifs_")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach((id) => {
                if (typeof id === "number" && !allIdsToCancel.includes(id)) {
                  allIdsToCancel.push(id);
                }
              });
            }
          }
          localStorage.removeItem(k);
        }
      }
    } catch {}
  }

  // 2. OS kuyruğundaki eski bildirimleri toplu iptal et
  if (allIdsToCancel.length > 0) {
    try {
      if (typeof (LocalNotifications as any)?.cancel === "function") {
        for (let i = 0; i < allIdsToCancel.length; i += 50) {
          const chunk = allIdsToCancel.slice(i, i + 50);
          await LocalNotifications.cancel({
            notifications: chunk.map((id) => ({ id }))
          }).catch(() => {});
        }
      }
    } catch {}
  }

  // 3. Aktif borçların bildirimlerini derle
  const debtIdToScheduledMap = new Map<number | string, number[]>();
  if (Array.isArray(debts)) {
    for (const d of debts) {
      const items = buildDebtNotificationItems(d, options);
      if (items.length > 0) {
        allItems.push(...items);
        debtIdToScheduledMap.set(d.id || 1, items.map((i) => i.id));
      }
    }
  }

  // 4. Aktif taksitlerin bildirimlerini derle
  if (Array.isArray(installments)) {
    for (const inst of installments) {
      const items = buildInstallmentNotificationItems(inst, options);
      if (items.length > 0) {
        allItems.push(...items);
        const virtualId = 500000 + (Number(inst.id) || 1);
        debtIdToScheduledMap.set(virtualId, items.map((i) => i.id));
      }
    }
  }

  if (allItems.length === 0) return 0;

  // 5. Bildirim kanalını hazırla
  await initCapacitorNotificationChannel();

  // 6. Cihazın yerel bildirim kuyruğuna (OS Level Queue) 50'şerli güvenli paketlerle kaydet
  try {
    if (typeof (LocalNotifications as any)?.schedule === "function") {
      for (let i = 0; i < allItems.length; i += 50) {
        const chunk = allItems.slice(i, i + 50);
        await LocalNotifications.schedule({
          notifications: chunk
        });
      }
      console.log(`[notificationScheduler] Toplam ${allItems.length} adet kesin alarm cihazın OS bildirim kuyruğuna (Local Notifications) kaydedildi.`);
    }
  } catch (err) {
    console.warn("[notificationScheduler] rescheduleAllNotifications batch schedule error:", err);
  }

  // 7. Android native köprüsünü de senkronize et
  allItems.forEach((item) => {
    const at = (item.schedule?.at as Date)?.getTime?.() || 0;
    if (at > 0) {
      scheduleAndroidDebtAlarm(item.id, item.title, at, item.body);
    }
  });

  // 8. ID'leri sakla
  if (typeof window !== "undefined") {
    try {
      debtIdToScheduledMap.forEach((ids, debtId) => {
        localStorage.setItem(getStorageKey(debtId), JSON.stringify(ids));
      });
      localStorage.setItem("last_os_notifications_sync_time", String(Date.now()));
      localStorage.setItem("last_os_notifications_count", String(allItems.length));
    } catch {}
  }

  return allItems.length;
}

/**
 * Bildirimler kapatıldığında tüm borç ve taksit alarmlarını OS kuyruğundan temizler.
 */
export async function cancelAllDebtAndInstallmentNotifications(): Promise<void> {
  const allIdsToCancel: number[] = [];
  if (typeof window !== "undefined") {
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith("scheduled_debt_notifs_")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach((id) => {
                if (typeof id === "number" && !allIdsToCancel.includes(id)) {
                  allIdsToCancel.push(id);
                }
              });
            }
          }
          localStorage.removeItem(k);
        }
      }
    } catch {}
  }

  if (allIdsToCancel.length > 0) {
    try {
      if (typeof (LocalNotifications as any)?.cancel === "function") {
        for (let i = 0; i < allIdsToCancel.length; i += 50) {
          const chunk = allIdsToCancel.slice(i, i + 50);
          await LocalNotifications.cancel({
            notifications: chunk.map((id) => ({ id }))
          }).catch(() => {});
        }
      }
    } catch {}
    allIdsToCancel.forEach((id) => {
      cancelAndroidDebtAlarm(id);
      cancelCapacitorAlarm(id).catch(() => {});
    });
  }
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
        if (typeof (LocalNotifications as any)?.schedule === "function") {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: notifId,
                title,
                body: message,
                schedule: {
                  at: new Date(triggerAtMillis),
                  allowWhileIdle: true,
                  exact: true
                } as any,
                channelId: "debt_reminders",
                autoCancel: true,
                smallIcon: "ic_stat_notify",
                iconColor: "#10B981",
                sound: "beep.wav"
              }
            ]
          }).catch(() => {});
        }

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

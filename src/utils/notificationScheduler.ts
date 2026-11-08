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
  cancelCapacitorAlarm,
  IS_NOTIFICATIONS_ISOLATED
} from "./androidAlarmBridge";
import { LocalNotifications, LocalNotificationSchema } from "@capacitor/local-notifications";
import {
  buildSpecialDayNotificationItems,
  scheduleSpecialDayNotifications,
  getTodaySpecialDay,
  checkAndTriggerTodaySpecialDayNotification,
  SPECIAL_DAYS,
  type SpecialDay
} from "./specialDays";

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
  userName?: string;
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
 * Hafta içi sabah 09:00 günlük genel borç özeti alarmlarını derler.
 * HAFTA İÇİ FİLTRESİ:
 * Cumartesi (day === 6) ve Pazar (day === 0) günleri KESİNLİKLE atlanır.
 * Yalnızca Pazartesi-Cuma günleri saat 09:00:00 için OS seviyesinde exact alarm üretir.
 * Uygulama kapalıyken veya telefon Doze modundayken bile tam saatinde uyanarak
 * kullanıcıya genel özet raporu sunar.
 */
export function buildWeekdayMorningReportItems(
  debts?: Partial<Debt>[],
  installments?: Partial<InstallmentDebt>[],
  options?: ScheduleNotificationOptions & { userName?: string }
): LocalNotificationSchema[] {
  const items: LocalNotificationSchema[] = [];
  const nowMs = options?.nowMs || Date.now();
  const now = new Date(nowMs);

  // 1. Aktif borçları ve taksitleri tara
  interface MorningDebtSummaryItem {
    name: string;
    amount: number;
    dueDate: Date;
    isInstallment?: boolean;
  }

  const activeItems: MorningDebtSummaryItem[] = [];

  if (Array.isArray(debts)) {
    debts.forEach((d) => {
      if (!d || !d.dueDate) return;
      const isPaid = Boolean(
        (d as any).isPaid === true ||
        (d as any).durum === "odendi" ||
        (d as any).status === "paid" ||
        Number(d.paid || 0) >= Number(d.amount || 0)
      );
      if (isPaid) return;
      const remaining = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
      if (remaining <= 0) return;

      const dateParts = parseDateParts(d.dueDate);
      if (!dateParts) return;
      const dueDate = new Date(dateParts.year, dateParts.month, dateParts.day, 0, 0, 0, 0);
      activeItems.push({
        name: d.name || "Borç",
        amount: remaining,
        dueDate
      });
    });
  }

  if (Array.isArray(installments)) {
    installments.forEach((inst) => {
      if (!inst || !inst.firstDueDate) return;
      const count = Number(inst.installmentCount) || 1;
      const paid = Number(inst.paidInstallmentCount) || 0;
      const isPaid = Boolean(
        (inst as any).isPaid === true ||
        (inst as any).durum === "odendi" ||
        (inst as any).status === "paid" ||
        paid >= count
      );
      if (isPaid) return;

      const dateParts = parseDateParts(inst.firstDueDate);
      if (!dateParts) return;
      const nextDue = new Date(dateParts.year, dateParts.month, dateParts.day, 0, 0, 0, 0);
      nextDue.setMonth(nextDue.getMonth() + paid);

      const perAmount = (Number(inst.totalAmount) || 0) / count;
      const instTitle = `${inst.name || "Taksit"} (${paid + 1}/${count}. Taksit)`;
      activeItems.push({
        name: instTitle,
        amount: perAmount,
        dueDate: nextDue,
        isInstallment: true
      });
    });
  }

  // Aktif borç yoksa alarm üretmeye gerek yok
  if (activeItems.length === 0) return [];

  const rawUserName = options?.userName?.trim()
    || (typeof window !== "undefined" ? localStorage.getItem("user_profile_name") : "")?.trim()
    || "DEĞERLİ KULLANICIMIZ";
  const safeUser = rawUserName.toUpperCase();

  // Önümüzdeki 14 takvim gününü tara (Hafta sonları Cumartesi ve Pazar KESİNLİKLE atlanır!)
  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 9, 0, 0, 0);
    const dayOfWeek = targetDate.getDay();

    // HAFTA İÇİ FİLTRESİ: 0 = Pazar, 6 = Cumartesi (Kesinlikle atlanır!)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    // Geçmiş saatleri atla (Bugün saat 09:00'ı geçtiyse yarından başla)
    if (targetDate.getTime() <= nowMs) {
      continue;
    }

    const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0).getTime();
    const dateFormatted = targetDate.toLocaleDateString("tr-TR");

    // Hedef gün bazında durum analizi
    const overdueMorning: MorningDebtSummaryItem[] = [];
    const dueTodayMorning: MorningDebtSummaryItem[] = [];
    const upcomingMorning: MorningDebtSummaryItem[] = [];
    let futureEnYakin: { name: string; daysLeft: number; amount: number } | null = null;

    activeItems.forEach((item) => {
      const dueTime = item.dueDate.getTime();
      const diffDays = Math.ceil((dueTime - targetStart) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        overdueMorning.push(item);
      } else if (diffDays === 0) {
        dueTodayMorning.push(item);
      } else if (diffDays > 0 && diffDays <= 3) {
        upcomingMorning.push(item);
      } else if (diffDays > 3) {
        if (!futureEnYakin || diffDays < (futureEnYakin as any).daysLeft) {
          futureEnYakin = { name: item.name, daysLeft: diffDays, amount: item.amount };
        }
      }
    });

    const totalRemainingAll = activeItems.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const totalFormatted = Math.round(totalRemainingAll).toLocaleString("tr-TR");

    let morningStatusText = "";
    if (overdueMorning.length > 0) {
      const overdueTotal = Math.round(overdueMorning.reduce((a, c) => a + c.amount, 0)).toLocaleString("tr-TR");
      morningStatusText += `🚨 Vadesi Geciken: ${overdueMorning.length} adet (${overdueTotal} TL)\n`;
    }
    if (dueTodayMorning.length > 0) {
      const dueTodayTotal = Math.round(dueTodayMorning.reduce((a, c) => a + c.amount, 0)).toLocaleString("tr-TR");
      morningStatusText += `⚠️ Bugün Ödenecek: ${dueTodayMorning.length} adet (${dueTodayTotal} TL)\n`;
    }
    if (upcomingMorning.length > 0) {
      const upcomingTotal = Math.round(upcomingMorning.reduce((a, c) => a + c.amount, 0)).toLocaleString("tr-TR");
      morningStatusText += `⏳ 3 Gün İçinde Yaklaşan: ${upcomingMorning.length} adet (${upcomingTotal} TL)\n`;
    }
    if (overdueMorning.length === 0 && dueTodayMorning.length === 0 && upcomingMorning.length === 0) {
      if (futureEnYakin) {
        morningStatusText += `✨ Bugün acil bir ödemeniz bulunmamaktadır.\n🗓️ Sıradaki en yakın ödemeniz: ${(futureEnYakin as any).name} (${(futureEnYakin as any).daysLeft} gün sonra - ${Math.round((futureEnYakin as any).amount).toLocaleString("tr-TR")} TL)\n`;
      } else {
        morningStatusText += `✨ Tüm borçlarınız güncel ve kontrol altındadır.\n`;
      }
    }

    const title = "📊 Bütçem Pro: Günlük Sabah Borç Raporu 🌅";
    const body =
      `👤 SN. ${safeUser}\n` +
      `📅 Rapor Tarihi: ${dateFormatted} (Sabah 09:00 Özeti)\n\n` +
      `📌 GENEL BORÇ & TAKSİT DURUMU:\n` +
      `• Toplam Aktif Borç/Taksit: ${activeItems.length} adet\n` +
      `• Toplam Kalan Borç Bakiyesi: ${totalFormatted} TL\n\n` +
      `${morningStatusText}\n` +
      `💡 Mali durumunuzu erkenden planlamanız için iyi günler dileriz. Bütçem Pro`;

    const notifId = 888000 + (targetDate.getMonth() * 32) + targetDate.getDate();

    items.push({
      id: notifId,
      title,
      body,
      largeBody: body,
      summaryText: "Günlük Sabah Borç Raporu (Hafta İçi 09:00)",
      schedule: {
        at: targetDate,
        allowWhileIdle: true,
        exact: true,
        forceShow: true
      } as any,
      channelId: "debt_reminders",
      autoCancel: true,
      smallIcon: "ic_stat_notify",
      largeIcon: "ic_stat_notify_large",
      iconColor: "#10B981",
      sound: "beep.wav",
      extra: {
        type: "weekday_morning_report",
        notifId,
        targetDateStr: dateFormatted,
        dayOfWeek
      }
    });
  }

  return items;
}

/**
 * Local Notifications eklentisine 50'şerli güvenli paketlerle bildirim planlar.
 * Android 12+ Exact Alarm (SCHEDULE_EXACT_ALARM) izni yoksa SecurityException ile uygulamanın çökmesini engeller;
 * exact: true başarısız olduğunda esnek fallback (exact: false) ile sistemi açık ve stabil tutar.
 */
async function safeScheduleLocalNotificationsBatch(items: LocalNotificationSchema[]): Promise<boolean> {
  if (IS_NOTIFICATIONS_ISOLATED) return false;
  if (!items || items.length === 0) return true;
  if (typeof (LocalNotifications as any)?.schedule !== "function") return false;

  // İzin kontrolü: Eğer izin henüz verilmemişse yerel planlamayı sessizce atla (çökmeyi önler)
  try {
    const perm = await LocalNotifications.checkPermissions().catch(() => ({ display: "denied" }));
    if (perm?.display !== "granted") {
      console.log("[notificationScheduler] Bildirim izni henüz verilmedi, OS planlama sessizce ertelendi.");
      return false;
    }
  } catch {
    // Desteklenmeyen ortamlarda devam et
  }

  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    // 1. ADIM: Exact Alarm ile planlamayı dene
    try {
      await LocalNotifications.schedule({
        notifications: chunk
      });
    } catch (exactErr: any) {
      console.warn("[notificationScheduler] Exact alarm planlanamadı, esnek fallback uygulanıyor:", exactErr?.message || exactErr);
      // 2. ADIM: Android 12+ SecurityException crash engelleme: exact: false ile esnek planla
      try {
        const relaxedChunk = chunk.map((item) => ({
          ...item,
          schedule: item.schedule
            ? {
                at: (item.schedule as any).at,
                allowWhileIdle: true,
                exact: false
              }
            : undefined
        }));
        await LocalNotifications.schedule({
          notifications: relaxedChunk as any
        });
      } catch (fallbackErr) {
        console.warn("[notificationScheduler] Esnek bildirim planlaması da yakalandı, uygulama çalışmaya devam ediyor:", fallbackErr);
      }
    }
  }
  return true;
}

/**
 * Belirtilen bildirim ID'lerini OS kuyruğundan 50'şerli güvenli paketlerle siler.
 */
async function safeCancelLocalNotificationsBatch(ids: number[]): Promise<void> {
  if (IS_NOTIFICATIONS_ISOLATED) return;
  if (!ids || ids.length === 0) return;
  if (typeof (LocalNotifications as any)?.cancel !== "function") return;

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      await LocalNotifications.cancel({
        notifications: chunk.map((id) => ({ id }))
      }).catch(() => {});
    } catch {}
  }
}

/**
 * Tek bir borç için alarmları OS yerel bildirim kuyruğuna planlar.
 */
export async function scheduleNotification(
  debt: Partial<Debt>,
  options?: ScheduleNotificationOptions
): Promise<number[]> {
  if (IS_NOTIFICATIONS_ISOLATED) return [];
  try {
    if (!debt) return [];
    const debtId = debt.id || 1;

    // Önce bu borca ait eski alarmları temizle
    await cancelDebtNotifications(debtId).catch(() => {});

    const items = buildDebtNotificationItems(debt, options);
    if (items.length === 0) return [];

    await initCapacitorNotificationChannel().catch(() => {});

    // Güvenli paketleme ve Exact Alarm Fallback
    await safeScheduleLocalNotificationsBatch(items);
    console.log(`[notificationScheduler] Borç #${debtId} için ${items.length} adet OS bildirimi planlandı.`);

    // Android Debt Alarm köprüsünü de senkronize et
    items.forEach((item) => {
      try {
        const at = (item.schedule?.at as Date)?.getTime?.() || 0;
        if (at > 0) {
          scheduleAndroidDebtAlarm(item.id, item.title, at, item.body);
        }
      } catch {}
    });

    const scheduledIds = items.map((i) => i.id);
    if (typeof window !== "undefined" && scheduledIds.length > 0) {
      try {
        localStorage.setItem(getStorageKey(debtId), JSON.stringify(scheduledIds));
      } catch {}
    }

    return scheduledIds;
  } catch (err) {
    console.warn(`[notificationScheduler] Borç planlama hatası yakalandı:`, err);
    return [];
  }
}

/**
 * Taksitli borçlar için yaklaşan / vadesi geçen taksit bildirimini kurar
 */
export async function scheduleInstallmentNotification(
  inst: Partial<InstallmentDebt>,
  options?: ScheduleNotificationOptions
): Promise<number[]> {
  if (IS_NOTIFICATIONS_ISOLATED) return [];
  try {
    if (!inst) return [];
    const instId = Number(inst.id) || 1;
    const virtualDebtId = 500000 + instId;

    await cancelDebtNotifications(virtualDebtId).catch(() => {});

    const items = buildInstallmentNotificationItems(inst, options);
    if (items.length === 0) return [];

    await initCapacitorNotificationChannel().catch(() => {});

    await safeScheduleLocalNotificationsBatch(items);
    console.log(`[notificationScheduler] Taksit #${instId} için ${items.length} adet OS bildirimi planlandı.`);

    items.forEach((item) => {
      try {
        const at = (item.schedule?.at as Date)?.getTime?.() || 0;
        if (at > 0) {
          scheduleAndroidDebtAlarm(item.id, item.title, at, item.body);
        }
      } catch {}
    });

    const scheduledIds = items.map((i) => i.id);
    if (typeof window !== "undefined" && scheduledIds.length > 0) {
      try {
        localStorage.setItem(getStorageKey(virtualDebtId), JSON.stringify(scheduledIds));
      } catch {}
    }

    return scheduledIds;
  } catch (err) {
    console.warn(`[notificationScheduler] Taksit planlama hatası yakalandı:`, err);
    return [];
  }
}

/**
 * Taksit planına ait alarmları iptal eder
 */
export async function cancelInstallmentNotifications(installmentId: number | string): Promise<boolean> {
  if (IS_NOTIFICATIONS_ISOLATED) return false;
  try {
    const instId = Number(installmentId) || 1;
    return await cancelDebtNotifications(500000 + instId);
  } catch {
    return false;
  }
}

let isReschedulingInProgress = false;

/**
 * TÜM AKTİF BORÇ VE TAKSİTLERİ CİHAZIN OS YEREL BİLDİRİM KUYRUĞUNA (LOCAL NOTIFICATION QUEUE) KAYDEDER.
 * 
 * Bu fonksiyon çağrıldığında:
 *  1. Önceden kurulmuş olan tüm borç/taksit alarmları OS kuyruğundan temizlenir.
 *  2. Aktif olan tüm borç ve taksitler için seçilen sıklığa göre takvim oluşturulur.
 *  3. Sistem ve bellek güvenliği için en yakın vadesi gelen maksimum 40 alarm güvenli paketlerle kaydedilir.
 *  4. Çiftleme ve Binder bellek taşmasını önlemek için asenkron kilit (mutex) kullanılır.
 */
export async function rescheduleAllNotifications(
  debts: Partial<Debt>[],
  installments?: Partial<InstallmentDebt>[],
  options?: ScheduleNotificationOptions
): Promise<number> {
  if (IS_NOTIFICATIONS_ISOLATED) return 0;
  if (isReschedulingInProgress) {
    console.log("[notificationScheduler] Planlama işlemi zaten devam ediyor, mükerrer çağrı engellendi.");
    return 0;
  }

  isReschedulingInProgress = true;
  try {
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
        const rawMorning = localStorage.getItem("scheduled_morning_report_ids");
        if (rawMorning) {
          const mArr = JSON.parse(rawMorning);
          if (Array.isArray(mArr)) {
            mArr.forEach((id) => {
              if (typeof id === "number" && !allIdsToCancel.includes(id)) {
                allIdsToCancel.push(id);
              }
            });
          }
          localStorage.removeItem("scheduled_morning_report_ids");
        }
      } catch {}
    }

    // 2. OS kuyruğundaki eski bildirimleri toplu ve güvenle iptal et
    await safeCancelLocalNotificationsBatch(allIdsToCancel);

    // 3. Aktif borçların bildirimlerini derle
    const debtIdToScheduledMap = new Map<number | string, number[]>();
    if (Array.isArray(debts)) {
      for (const d of debts) {
        try {
          const items = buildDebtNotificationItems(d, options);
          if (items.length > 0) {
            allItems.push(...items);
            debtIdToScheduledMap.set(d.id || 1, items.map((i) => i.id));
          }
        } catch {}
      }
    }

    // 4. Aktif taksitlerin bildirimlerini derle
    if (Array.isArray(installments)) {
      for (const inst of installments) {
        try {
          const items = buildInstallmentNotificationItems(inst, options);
          if (items.length > 0) {
            allItems.push(...items);
            const virtualId = 500000 + (Number(inst.id) || 1);
            debtIdToScheduledMap.set(virtualId, items.map((i) => i.id));
          }
        } catch {}
      }
    }

    // 4c. Önemli ve Resmi/Dini Günler (29 Ekim, 23 Nisan, 30 Ağustos vb.) alarmlarını derle
    try {
      const specialDayItems = buildSpecialDayNotificationItems({ nowMs: options?.nowMs });
      if (specialDayItems.length > 0) {
        allItems.push(...specialDayItems);
      }
    } catch (sdErr) {
      console.warn("[notificationScheduler] Özel gün bildirimleri derleme uyarısı:", sdErr);
    }

    // 4d. Hafta İçi Sabah 09:00 Günlük Genel Borç Raporu Alarmlarını Derle (Cumartesi-Pazar kesinlikle atlanır!)
    let morningReportIds: number[] = [];
    try {
      const morningItems = buildWeekdayMorningReportItems(debts, installments, options);
      if (morningItems.length > 0) {
        allItems.push(...morningItems);
        morningReportIds = morningItems.map((m) => m.id);
      }
    } catch (mErr) {
      console.warn("[notificationScheduler] Hafta içi sabah raporu derleme uyarısı:", mErr);
    }

    if (allItems.length === 0) return 0;

    // 5. Bellek ve Android Binder limiti koruması: En yakın vadesi gelen ilk 50 alarmı güvenle sınırla
    allItems.sort((a, b) => {
      const timeA = (a.schedule?.at as Date)?.getTime?.() || 0;
      const timeB = (b.schedule?.at as Date)?.getTime?.() || 0;
      return timeA - timeB;
    });
    const boundedItems = allItems.slice(0, 50);

    // 6. Bildirim kanalını hazırla
    await initCapacitorNotificationChannel().catch(() => {});

    // 7. Cihazın yerel bildirim kuyruğuna (OS Level Queue) güvenli paketlerle ve Exact Fallback ile kaydet
    await safeScheduleLocalNotificationsBatch(boundedItems);
    console.log(`[notificationScheduler] Toplam ${boundedItems.length} adet kesin alarm cihazın OS bildirim kuyruğuna (Local Notifications) kaydedildi.`);

    // 7b. Android Native AlarmManager köprüsünü (RTC_WAKEUP & setExactAndAllowWhileIdle) de senkronize et
    boundedItems.forEach((item) => {
      try {
        const at = (item.schedule?.at as Date)?.getTime?.() || 0;
        if (at > 0) {
          scheduleAndroidDebtAlarm(item.id, item.title, at, item.body);
        }
      } catch {}
    });

    // 8. ID'leri sakla
    if (typeof window !== "undefined") {
      try {
        debtIdToScheduledMap.forEach((ids, debtId) => {
          localStorage.setItem(getStorageKey(debtId), JSON.stringify(ids));
        });
        if (morningReportIds.length > 0) {
          localStorage.setItem("scheduled_morning_report_ids", JSON.stringify(morningReportIds));
        }
        localStorage.setItem("last_os_notifications_sync_time", String(Date.now()));
        localStorage.setItem("last_os_notifications_count", String(boundedItems.length));
      } catch {}
    }

    return boundedItems.length;
  } catch (err) {
    console.warn("[notificationScheduler] rescheduleAllNotifications safe catch:", err);
    return 0;
  } finally {
    isReschedulingInProgress = false;
  }
}

/**
 * Bildirimler kapatıldığında tüm borç ve taksit alarmlarını OS kuyruğundan temizler.
 */
export async function cancelAllDebtAndInstallmentNotifications(): Promise<void> {
  if (IS_NOTIFICATIONS_ISOLATED) return;
  try {
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
        const rawMorning = localStorage.getItem("scheduled_morning_report_ids");
        if (rawMorning) {
          const mArr = JSON.parse(rawMorning);
          if (Array.isArray(mArr)) {
            mArr.forEach((id) => {
              if (typeof id === "number" && !allIdsToCancel.includes(id)) {
                allIdsToCancel.push(id);
              }
            });
          }
          localStorage.removeItem("scheduled_morning_report_ids");
        }
      } catch {}
    }

    if (allIdsToCancel.length > 0) {
      await safeCancelLocalNotificationsBatch(allIdsToCancel);
      allIdsToCancel.forEach((id) => {
        try {
          cancelAndroidDebtAlarm(id);
          cancelCapacitorAlarm(id).catch(() => {});
        } catch {}
      });
    }
  } catch (e) {
    console.warn("[notificationScheduler] cancelAllDebtAndInstallmentNotifications hatası:", e);
  }
}

/**
 * Borç ödendiği veya silindiği an, o borca ait kurulmuş olan TÜM dinamik
 * hatırlatıcıları (Capacitor, Cordova, AlarmManager) otomatik olarak siler ve iptal eder.
 */
export async function cancelDebtNotifications(debtId: number | string): Promise<boolean> {
  if (IS_NOTIFICATIONS_ISOLATED) return false;
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

// Re-export special days utilities
export {
  SPECIAL_DAYS,
  SpecialDay,
  getTodaySpecialDay,
  scheduleSpecialDayNotifications,
  checkAndTriggerTodaySpecialDayNotification
};

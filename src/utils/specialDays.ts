/**
 * Bütçem Pro - Önemli Günler ve Resmi/Dini Bayramlar Takvimi & Otomatik Bildirim Sistemi
 *
 * Bu modül; 29 Ekim Cumhuriyet Bayramı, 23 Nisan, 19 Mayıs, 30 Ağustos, 15 Temmuz gibi milli bayramlar,
 * 10 Kasım Atatürk'ü Anma Günü, 18 Mart Çanakkale Zaferi, 24 Kasım Öğretmenler Günü,
 * 8 Mart Dünya Kadınlar Günü, 1 Ocak Yılbaşı, 1 Mayıs Emek ve Dayanışma Günü ve dini bayramlar
 * (Ramazan Bayramı 3 gün, Kurban Bayramı 4 gün) için dinamik tarih eşleştirme ve otomatik bildirim üretir.
 *
 * Uygulama kapalıyken veya arka plandayken bile Capacitor LocalNotifications / Android AlarmManager
 * altyapısı sayesinde tam gününde ve saatinde (09:00) kullanıcıya ulaşır.
 */

import { LocalNotifications, LocalNotificationSchema } from "@capacitor/local-notifications";
import {
  initCapacitorNotificationChannel,
  isCapacitorAvailable,
  IS_NOTIFICATIONS_ISOLATED,
  REMINDER_NOTIFICATION_CHANNEL_ID,
  REMINDER_NOTIFICATION_SOUND,
  scheduleAndroidDebtAlarm
} from "./androidAlarmBridge";

export interface SpecialDayDateRef {
  month: number; // 1 - 12
  day: number;   // 1 - 31
}

export interface SpecialDay {
  id: string;
  name: string;
  title: string;
  message: string;
  month: number; // 1 - 12 (sabit günler için)
  day: number;   // 1 - 31 (sabit günler için)
  isFixed: boolean; // Sabit her yıl aynı gün mü?
  durationDays?: number; // Çok günlük bayramlar için gün sayısı (ör. Ramazan 3, Kurban 4)
  emoji?: string;
  category: "national" | "religious" | "celebration" | "commemoration";
  // Hareketli günler için yıllara göre başlangıç tarih haritası
  yearlyDates?: { [year: number]: SpecialDayDateRef | SpecialDayDateRef[] };
}

/**
 * Yerel saat dilimine göre YYYY-MM-DD tarih dizesi üretir (UTC kaymasını önler).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Türkiye Resmi, Milli, Anma, Kutlama ve Dini Önemli Günler Listesi
 */
export const SPECIAL_DAYS: SpecialDay[] = [
  {
    id: "cumhuriyet-bayrami",
    name: "29 Ekim Cumhuriyet Bayramı",
    title: "29 Ekim Cumhuriyet Bayramınız Kutlu Olsun! 🇹🇷",
    message:
      "Bütçem Pro ailesi olarak Cumhuriyetimizin kurucusu Gazi Mustafa Kemal Atatürk'ü ve silah arkadaşlarını minnetle anıyoruz. Cumhuriyetimizin {yearCount}. yılı kutlu olsun!",
    month: 10,
    day: 29,
    isFixed: true,
    emoji: "🇹🇷",
    category: "national"
  },
  {
    id: "ataturku-anma",
    name: "10 Kasım Atatürk'ü Anma Günü",
    title: "10 Kasım: Sevgi, Saygı ve Özlemle Anıyoruz 🇹🇷",
    message:
      "Cumhuriyetimizin kurucusu Ulu Önder Gazi Mustafa Kemal Atatürk'ü ebediyete intikalinin yıl dönümünde saygı, minnet ve sonsuz özlemle anıyoruz.",
    month: 11,
    day: 10,
    isFixed: true,
    emoji: "🇹🇷",
    category: "commemoration"
  },
  {
    id: "ogretmenler-gunu",
    name: "24 Kasım Öğretmenler Günü",
    title: "24 Kasım Öğretmenler Günü Kutlu Olsun! 💐",
    message:
      "Başöğretmen Gazi Mustafa Kemal Atatürk başta olmak üzere, geleceğimizi sevgi ve emekle inşa eden tüm değerli öğretmenlerimizin 24 Kasım Öğretmenler Günü'nü en içten dileklerimizle kutlarız.",
    month: 11,
    day: 24,
    isFixed: true,
    emoji: "💐",
    category: "celebration"
  },
  {
    id: "zafer-bayrami",
    name: "30 Ağustos Zafer Bayramı",
    title: "30 Ağustos Zafer Bayramınız Kutlu Olsun! 🇹🇷",
    message:
      "Büyük Zafer'in yıl dönümünde Gazi Mustafa Kemal Atatürk, silah arkadaşları ve vatanımız uğruna can veren tüm şehitlerimizi rahmet ve minnetle anıyoruz.",
    month: 8,
    day: 30,
    isFixed: true,
    emoji: "🇹🇷",
    category: "national"
  },
  {
    id: "ulusal-egemenlik",
    name: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı",
    title: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı Kutlu Olsun! 🇹🇷",
    message:
      "Geleceğimizin teminatı tüm çocuklarımızın ve milletimizin 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı'nı kutluyor; Atatürk'ü minnetle anıyoruz.",
    month: 4,
    day: 23,
    isFixed: true,
    emoji: "🇹🇷",
    category: "national"
  },
  {
    id: "genclik-spor",
    name: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı",
    title: "19 Mayıs Gençlik ve Spor Bayramınız Kutlu Olsun! 🇹🇷",
    message:
      "Milli mücadelenin ilk adımının atıldığı bu anlamlı günde, tüm gençlerimizin bayramını kutluyor; Gazi Mustafa Kemal Atatürk'ü saygıyla anıyoruz.",
    month: 5,
    day: 19,
    isFixed: true,
    emoji: "🇹🇷",
    category: "national"
  },
  {
    id: "demokrasi-birlik",
    name: "15 Temmuz Demokrasi ve Milli Birlik Günü",
    title: "15 Temmuz Demokrasi ve Milli Birlik Günü 🇹🇷",
    message:
      "Vatanımız, milletimiz ve bağımsızlığımız uğruna can veren tüm aziz şehitlerimizi rahmetle, kahraman gazilerimizi minnetle anıyoruz.",
    month: 7,
    day: 15,
    isFixed: true,
    emoji: "🇹🇷",
    category: "national"
  },
  {
    id: "canakkale-zaferi",
    name: "18 Mart Çanakkale Zaferi ve Şehitleri Anma Günü",
    title: "18 Mart Çanakkale Zaferi ve Şehitleri Anma Günü 🇹🇷",
    message:
      "Çanakkale Geçilmez destanını yazan aziz şehitlerimizi ve Gazi Mustafa Kemal Atatürk'ü rahmet, saygı ve minnetle anıyoruz.",
    month: 3,
    day: 18,
    isFixed: true,
    emoji: "🇹🇷",
    category: "commemoration"
  },
  {
    id: "kadinlar-gunu",
    name: "8 Mart Dünya Kadınlar Günü",
    title: "8 Mart Dünya Kadınlar Günü Kutlu Olsun! 🌷",
    message:
      "Hayatın her alanına değer katan, emeği ve sevgisiyle dünyamızı güzelleştiren tüm kadınların 8 Mart Dünya Kadınlar Günü'nü kutlarız.",
    month: 3,
    day: 8,
    isFixed: true,
    emoji: "🌷",
    category: "celebration"
  },
  {
    id: "yilbasi",
    name: "1 Ocak Yılbaşı",
    title: "Mutlu Yıllar! Sağlık, Huzur ve Bereket Dolu Bir Yıl Dileriz 🎊",
    message:
      "Yeni yılın size ve sevdiklerinize sağlık, mutluluk ve finansal başarılar getirmesini temenni ederiz. Bütçem Pro ile hedeflerinize bir adım daha yakınsınız!",
    month: 1,
    day: 1,
    isFixed: true,
    emoji: "🎉",
    category: "celebration"
  },
  {
    id: "emek-dayanisma",
    name: "1 Mayıs Emek ve Dayanışma Günü",
    title: "1 Mayıs Emek ve Dayanışma Günü Kutlu Olsun! 🛠️",
    message:
      "Alın teriyle çalışan, üreten ve geleceğe değer katan tüm emekçilerimizin 1 Mayıs Emek ve Dayanışma Günü kutlu olsun.",
    month: 5,
    day: 1,
    isFixed: true,
    emoji: "🛠️",
    category: "celebration"
  },
  // Hareketli Dini Bayramlar (Diyanet Takvimi 2025-2035 + Hicri Takvim Dinamik Yedeği)
  {
    id: "ramazan-bayrami",
    name: "Ramazan Bayramı",
    title: "Ramazan Bayramınız Mübarek Olsun! 🍬",
    message:
      "Bütçem Pro ailesi olarak sevdiklerinizle birlikte sağlıklı, huzurlu, bereketli ve neşe dolu bir bayram geçirmenizi dileriz. Bayramınız mübarek olsun.",
    month: 3,
    day: 20,
    isFixed: false,
    durationDays: 3,
    emoji: "🍬",
    category: "religious",
    yearlyDates: {
      2025: { month: 3, day: 30 },
      2026: { month: 3, day: 20 },
      2027: { month: 3, day: 9 },
      2028: { month: 2, day: 27 },
      2029: { month: 2, day: 15 },
      2030: { month: 2, day: 5 },
      2031: { month: 1, day: 25 },
      2032: { month: 1, day: 14 },
      2033: [
        { month: 1, day: 2 },
        { month: 12, day: 23 }
      ],
      2034: { month: 12, day: 12 },
      2035: { month: 12, day: 1 }
    }
  },
  {
    id: "kurban-bayrami",
    name: "Kurban Bayramı",
    title: "Kurban Bayramınız Mübarek Olsun! 🐑",
    message:
      "Paylaşmanın, yardımlaşmanın ve bir arada olmanın güzelliğini yaşadığımız Kurban Bayramınızı en içten dileklerimizle kutlarız. Hayırlı bayramlar.",
    month: 5,
    day: 27,
    isFixed: false,
    durationDays: 4,
    emoji: "🐑",
    category: "religious",
    yearlyDates: {
      2025: { month: 6, day: 6 },
      2026: { month: 5, day: 27 },
      2027: { month: 5, day: 16 },
      2028: { month: 5, day: 5 },
      2029: { month: 4, day: 24 },
      2030: { month: 4, day: 13 },
      2031: { month: 4, day: 2 },
      2032: { month: 3, day: 22 },
      2033: { month: 3, day: 11 },
      2034: { month: 3, day: 1 },
      2035: { month: 2, day: 18 }
    }
  }
];

/**
 * Verilen SpecialDay nesnesinin başlık ve mesaj metinlerini hedef yıla göre dinamik olarak çözümler.
 * Sabit yıl (ör. 103. yıl) yerine hedef yıla göre doğru yıl dönümü sayısını hesaplar.
 */
export function resolveSpecialDayForYear(specialDay: SpecialDay, year: number, bayramDayNumber?: number): SpecialDay {
  const republicYearCount = Math.max(1, year - 1923);
  let resolvedMessage = specialDay.message.replace(/\{yearCount\}/g, String(republicYearCount));

  if (bayramDayNumber && bayramDayNumber > 1 && specialDay.durationDays && specialDay.durationDays > 1) {
    resolvedMessage = `${specialDay.name} (${bayramDayNumber}. Gün): ${resolvedMessage}`;
  }

  return {
    ...specialDay,
    message: resolvedMessage
  };
}

/**
 * Intl Hicri (Islamic Umm al-Qura) takviminden yılın hareketli bayram tarihini tespit eder (2036+ yedek).
 */
function getHijriHolidayDayNumber(id: string, date: Date): number | null {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") return null;
  try {
    const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      month: "numeric",
      day: "numeric"
    });
    const parts = formatter.formatToParts(date);
    const hMonth = Number(parts.find((p) => p.type === "month")?.value);
    const hDay = Number(parts.find((p) => p.type === "day")?.value);
    if (!hMonth || !hDay) return null;

    if (id === "ramazan-bayrami" && hMonth === 10 && hDay >= 1 && hDay <= 3) {
      return hDay;
    }
    if (id === "kurban-bayrami" && hMonth === 12 && hDay >= 10 && hDay <= 13) {
      return hDay - 9;
    }
  } catch {
    // Desteklenmeyen ortamlarda sessiz geç
  }
  return null;
}

/**
 * Yıl için tanımlı başlangıç tarihlerini dizi olarak döndürür.
 */
function getYearlyDateRefs(specialDay: SpecialDay, year: number): SpecialDayDateRef[] {
  const entry = specialDay.yearlyDates?.[year];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

/**
 * Verilen tarih ile özel gün başlangıç tarihi arasındaki gün farkını hesaplar ve aktif gün numarasını (1..N) döndürür.
 */
function matchMultiDayHoliday(target: Date, startYear: number, startRef: SpecialDayDateRef, durationDays: number): number | null {
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const startMidnight = new Date(startYear, startRef.month - 1, startRef.day).getTime();
  const diffDays = Math.round((targetMidnight - startMidnight) / (1000 * 60 * 60 * 24));
  if (diffDays >= 0 && diffDays < durationDays) {
    return diffDays + 1;
  }
  return null;
}

/**
 * Belirtilen bir tarihin (varsayılan: bugün) önemli gün olup olmadığını kontrol eder.
 * Ay-gün eşleşmesi, yıl dönümü metni ve çok günlük dini bayram aralıklarını dinamik olarak çözer.
 */
export function getTodaySpecialDay(testDate?: Date): SpecialDay | null {
  const target = testDate || new Date();
  const year = target.getFullYear();
  const month = target.getMonth() + 1; // 1 - 12
  const day = target.getDate();

  for (const sd of SPECIAL_DAYS) {
    if (sd.isFixed) {
      if (sd.month === month && sd.day === day) {
        return resolveSpecialDayForYear(sd, year);
      }
    } else {
      const duration = Math.max(1, sd.durationDays || 1);
      // Önceki yılın Aralık sonundan taşma olasılığı dahil mevcut ve komşu yılları kontrol et
      const candidateYears = [year, year - 1];
      let hasDefinedMapForCurrentYear = Boolean(sd.yearlyDates?.[year]);

      for (const y of candidateYears) {
        const refs = getYearlyDateRefs(sd, y);
        for (const ref of refs) {
          const dayNum = matchMultiDayHoliday(target, y, ref, duration);
          if (dayNum !== null) {
            return resolveSpecialDayForYear(sd, year, dayNum);
          }
        }
      }

      // yearlyDates haritası dışındaki uzak yıllar için dinamik Hicri takvim yedeği
      if (!hasDefinedMapForCurrentYear) {
        const hijriDayNum = getHijriHolidayDayNumber(sd.id, target);
        if (hijriDayNum !== null) {
          return resolveSpecialDayForYear(sd, year, hijriDayNum);
        }
      }
    }
  }

  return null;
}

/**
 * Belirli bir yıl için özel günün tetiklenecek tarihlerini (saat 09:00) üretir.
 */
export function getSpecialDayDatesForYear(specialDay: SpecialDay, year: number, hour = 9, minute = 0): Date[] {
  if (specialDay.isFixed) {
    return [new Date(year, specialDay.month - 1, specialDay.day, hour, minute, 0, 0)];
  }

  const refs = getYearlyDateRefs(specialDay, year);
  if (refs.length > 0) {
    return refs.map((ref) => new Date(year, ref.month - 1, ref.day, hour, minute, 0, 0));
  }

  // Harita dışındaki gelecek yıllar için Hicri takvim üzerinden ilk günü tara
  const found: Date[] = [];
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const candidate = new Date(year, m, d, hour, minute, 0, 0);
      if (getHijriHolidayDayNumber(specialDay.id, candidate) === 1) {
        found.push(candidate);
      }
    }
  }
  return found;
}

/**
 * Belirli bir yıl için özel günün ilk tarihini üretir.
 */
export function getSpecialDayDateForYear(specialDay: SpecialDay, year: number, hour = 9, minute = 0): Date {
  const dates = getSpecialDayDatesForYear(specialDay, year, hour, minute);
  if (dates.length > 0) return dates[0];
  return new Date(year, specialDay.month - 1, specialDay.day, hour, minute, 0, 0);
}

/**
 * Özel gün için 32-bit benzersiz bildirim ID'si üretir (700.000.000 bandı)
 */
export function getSpecialDayNotificationId(specialDay: SpecialDay, year: number, monthOverride?: number, dayOverride?: number): number {
  const targetDate = monthOverride && dayOverride ? null : getSpecialDayDateForYear(specialDay, year);
  const m = monthOverride ?? (targetDate ? targetDate.getMonth() + 1 : specialDay.month);
  const d = dayOverride ?? (targetDate ? targetDate.getDate() : specialDay.day);
  const yearSuffix = year % 100;
  const monthDay = m * 100 + d;
  return 700000000 + yearSuffix * 10000 + monthDay;
}

/**
 * Önümüzdeki 1 yıl içindeki tüm önemli günler için OS seviyesinde bildirim şablonlarını derler.
 */
export function buildSpecialDayNotificationItems(options?: { nowMs?: number }): LocalNotificationSchema[] {
  const now = options?.nowMs ? new Date(options.nowMs) : new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear + 1];
  const items: LocalNotificationSchema[] = [];

  for (const year of years) {
    for (const sd of SPECIAL_DAYS) {
      const triggerDates = getSpecialDayDatesForYear(sd, year, 9, 0);
      const resolved = resolveSpecialDayForYear(sd, year);

      for (const triggerDate of triggerDates) {
        // Sadece gelecekteki (veya bugünün saat 09:00 öncesindeki) alarmları planla
        if (triggerDate.getTime() > now.getTime()) {
          const notifId = getSpecialDayNotificationId(
            resolved,
            year,
            triggerDate.getMonth() + 1,
            triggerDate.getDate()
          );

          items.push({
            id: notifId,
            title: resolved.title,
            body: resolved.message,
            largeBody: resolved.message,
            summaryText: resolved.name,
            schedule: {
              at: triggerDate,
              allowWhileIdle: true,
              exact: true,
              forceShow: true
            } as any,
            sound: REMINDER_NOTIFICATION_SOUND,
            smallIcon: "ic_stat_notify",
            largeIcon: "ic_stat_notify_large",
            iconColor: "#10B981",
            autoCancel: true,
            channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
            extra: {
              specialDayId: resolved.id,
              isSpecialDay: true,
              year
            }
          } as any);
        }
      }
    }
  }

  // Zamana göre sırala (en yakından uzağa)
  items.sort((a, b) => {
    const timeA = (a.schedule?.at as Date)?.getTime?.() || 0;
    const timeB = (b.schedule?.at as Date)?.getTime?.() || 0;
    return timeA - timeB;
  });

  return items;
}

/**
 * Cihazın işletim sistemi bildirim kuyruğuna (Capacitor LocalNotifications / AlarmManager)
 * tüm özel gün alarmlarını kaydeder. Exact alarm izni yoksa güvenli fallback (exact: false) uygular.
 */
export async function scheduleSpecialDayNotifications(): Promise<number> {
  if (IS_NOTIFICATIONS_ISOLATED) return 0;
  try {
    const items = buildSpecialDayNotificationItems();
    if (items.length === 0) return 0;

    if (typeof window === "undefined" || !isCapacitorAvailable()) {
      return 0;
    }

    await initCapacitorNotificationChannel().catch(() => {});

    // İzin kontrolü: İzin yoksa sessizce çık (arka planda çökme/hata üretmez)
    try {
      const perm = await LocalNotifications.checkPermissions().catch(() => ({ display: "denied" }));
      if (perm?.display !== "granted") {
        console.log("[SpecialDays] Bildirim izni henüz verilmedi, özel gün OS planlaması ertelendi.");
        return 0;
      }
    } catch {
      // Desteklenmeyen ortamlarda devam et
    }

    if (typeof LocalNotifications !== "undefined" && typeof LocalNotifications.schedule === "function") {
      try {
        await LocalNotifications.schedule({ notifications: items });
      } catch (exactErr: any) {
        console.warn("[SpecialDays] Exact alarm izni alınamadı, esnek zamanlama uygulanıyor:", exactErr?.message || exactErr);
        const relaxedItems = items.map((item) => ({
          ...item,
          schedule: item.schedule
            ? {
                at: (item.schedule as any).at,
                allowWhileIdle: true,
                exact: false
              }
            : undefined
        }));
        await LocalNotifications.schedule({ notifications: relaxedItems as any }).catch(() => {});
      }
    }

    // Android native AlarmManager köprüsüne de senkronize et
    items.forEach((item) => {
      try {
        const at = (item.schedule?.at as Date)?.getTime?.() || 0;
        if (at > 0) {
          scheduleAndroidDebtAlarm(item.id, item.title, at, item.body);
        }
      } catch {}
    });

    console.log(`[SpecialDays] Toplam ${items.length} adet özel gün bildirimi cihazın OS bildirim kuyruğuna kaydedildi.`);
    return items.length;
  } catch (err) {
    console.warn("[SpecialDays] scheduleSpecialDayNotifications hatası:", err);
    return 0;
  }
}

/**
 * Uygulama açıkken veya arka plan tetiklendiğinde bugünün özel gün bildirimini kontrol eder
 * ve henüz gönderilmediyse anında kullanıcıya iletir.
 */
export function checkAndTriggerTodaySpecialDayNotification(
  sendNotificationFn: (title: string, body: string, id: number, specialDay: SpecialDay) => void
): boolean {
  try {
    const now = new Date();
    const todaySpecialDay = getTodaySpecialDay(now);
    if (!todaySpecialDay) return false;

    const todayDateStr = getLocalDateString(now);
    const storageKey = `special_day_notif_sent_${todayDateStr}_${todaySpecialDay.id}`;

    if (typeof window !== "undefined") {
      const alreadySent = localStorage.getItem(storageKey);
      if (alreadySent) {
        return false;
      }
    }

    const notifId = getSpecialDayNotificationId(
      todaySpecialDay,
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );
    sendNotificationFn(todaySpecialDay.title, todaySpecialDay.message, notifId, todaySpecialDay);

    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(Date.now()));
    }

    console.log(`[SpecialDays] Bugün ${todaySpecialDay.name}! Özel gün bildirimi kullanıcıya iletildi.`);
    return true;
  } catch (err) {
    console.warn("[SpecialDays] checkAndTriggerTodaySpecialDayNotification hatası:", err);
    return false;
  }
}

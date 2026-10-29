/**
 * Bütçem Pro - Önemli Günler ve Resmi/Dini Bayramlar Takvimi & Otomatik Bildirim Sistemi
 * 
 * Bu modül; 29 Ekim Cumhuriyet Bayramı, 23 Nisan, 19 Mayıs, 30 Ağustos gibi temel milli bayramlar,
 * 10 Kasım Atatürk'ü Anma Günü, 1 Ocak Yılbaşı, 1 Mayıs Emek ve Dayanışma Günü ve dini bayramlar için
 * özel hazırlanmış kutlama ve anma bildirimlerini yönetir.
 * 
 * Uygulama kapalıyken veya arka plandayken bile Capacitor LocalNotifications / AlarmManager
 * ve Service Worker altyapısı sayesinde tam gününde ve saatinde (09:00) kullanıcıya ulaşır.
 */

import { LocalNotifications, LocalNotificationSchema } from "@capacitor/local-notifications";
import { initCapacitorNotificationChannel } from "./androidAlarmBridge";

export interface SpecialDay {
  id: string;
  name: string;
  title: string;
  message: string;
  month: number; // 1 - 12
  day: number;   // 1 - 31
  isFixed: boolean; // Sabit her yıl aynı gün mü?
  emoji?: string;
  category: "national" | "religious" | "celebration" | "commemoration";
  // Hareketli günler için yıllara göre tarih haritası ("YYYY-MM-DD")
  yearlyDates?: { [year: number]: { month: number; day: number } };
}

/**
 * Türkiye Resmi, Milli ve Dini Önemli Günler Listesi
 */
export const SPECIAL_DAYS: SpecialDay[] = [
  {
    id: "cumhuriyet-bayrami",
    name: "29 Ekim Cumhuriyet Bayramı",
    title: "29 Ekim Cumhuriyet Bayramınız Kutlu Olsun! 🇹🇷",
    message: "Bütçem Pro ailesi olarak Cumhuriyetimizin kurucusu Gazi Mustafa Kemal Atatürk'ü ve silah arkadaşlarını minnetle anıyoruz. Cumhuriyetimizin 103. yılı kutlu olsun!",
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
    message: "Cumhuriyetimizin kurucusu Ulu Önder Gazi Mustafa Kemal Atatürk'ü ebediyete intikalinin yıl dönümünde saygı, minnet ve sonsuz özlemle anıyoruz.",
    month: 11,
    day: 10,
    isFixed: true,
    emoji: "🇹🇷",
    category: "commemoration"
  },
  {
    id: "zafer-bayrami",
    name: "30 Ağustos Zafer Bayramı",
    title: "30 Ağustos Zafer Bayramınız Kutlu Olsun! 🇹🇷",
    message: "Büyük Zafer'in yıl dönümünde Gazi Mustafa Kemal Atatürk, silah arkadaşları ve vatanımız uğruna can veren tüm şehitlerimizi rahmet ve minnetle anıyoruz.",
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
    message: "Geleceğimizin teminatı tüm çocuklarımızın ve milletimizin 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı'nı kutluyor; Atatürk'ü minnetle anıyoruz.",
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
    message: "Milli mücadelenin ilk adımının atıldığı bu anlamlı günde, tüm gençlerimizin bayramını kutluyor; Gazi Mustafa Kemal Atatürk'ü saygıyla anıyoruz.",
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
    message: "Vatanımız, milletimiz ve bağımsızlığımız uğruna can veren tüm aziz şehitlerimizi rahmetle, kahraman gazilerimizi minnetle anıyoruz.",
    month: 7,
    day: 15,
    isFixed: true,
    emoji: "🇹🇷",
    category: "national"
  },
  {
    id: "yilbasi",
    name: "1 Ocak Yılbaşı",
    title: "Mutlu Yıllar! Sağlık, Huzur ve Bereket Dolu Bir Yıl Dileriz 🎊",
    message: "Yeni yılın size ve sevdiklerinize sağlık, mutluluk ve finansal başarılar getirmesini temenni ederiz. Bütçem Pro ile hedeflerinize bir adım daha yakınsınız!",
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
    message: "Alın teriyle çalışan, üreten ve geleceğe değer katan tüm emekçilerimizin 1 Mayıs Emek ve Dayanışma Günü kutlu olsun.",
    month: 5,
    day: 1,
    isFixed: true,
    emoji: "🛠️",
    category: "celebration"
  },
  // Hareketli Dini Bayramlar
  {
    id: "ramazan-bayrami",
    name: "Ramazan Bayramı",
    title: "Ramazan Bayramınız Mübarek Olsun! 🍬",
    message: "Bütçem Pro ailesi olarak sevdiklerinizle birlikte sağlıklı, huzurlu, bereketli ve neşe dolu bir bayram geçirmenizi dileriz. Bayramınız mübarek olsun.",
    month: 3,
    day: 20,
    isFixed: false,
    emoji: "🍬",
    category: "religious",
    yearlyDates: {
      2025: { month: 3, day: 30 },
      2026: { month: 3, day: 20 },
      2027: { month: 3, day: 10 },
      2028: { month: 2, day: 27 },
      2029: { month: 2, day: 15 }
    }
  },
  {
    id: "kurban-bayrami",
    name: "Kurban Bayramı",
    title: "Kurban Bayramınız Mübarek Olsun! 🐑",
    message: "Paylaşmanın, yardımlaşmanın ve bir arada olmanın güzelliğini yaşadığımız Kurban Bayramınızı en içten dileklerimizle kutlarız. Hayırlı bayramlar.",
    month: 5,
    day: 27,
    isFixed: false,
    emoji: "🐑",
    category: "religious",
    yearlyDates: {
      2025: { month: 6, day: 6 },
      2026: { month: 5, day: 27 },
      2027: { month: 5, day: 17 },
      2028: { month: 5, day: 5 },
      2029: { month: 4, day: 24 }
    }
  }
];

/**
 * Belirtilen bir tarihin (varsayılan: bugün) önemli gün olup olmadığını kontrol eder.
 */
export function getTodaySpecialDay(testDate?: Date): SpecialDay | null {
  const target = testDate || new Date();
  const year = target.getFullYear();
  const month = target.getMonth() + 1; // 1 - 12
  const day = target.getDate();

  for (const sd of SPECIAL_DAYS) {
    if (sd.isFixed) {
      if (sd.month === month && sd.day === day) {
        return sd;
      }
    } else if (sd.yearlyDates && sd.yearlyDates[year]) {
      const yd = sd.yearlyDates[year];
      if (yd.month === month && yd.day === day) {
        return sd;
      }
    }
  }

  return null;
}

/**
 * Belirli bir yıl için özel günün tarihini üretir.
 */
export function getSpecialDayDateForYear(specialDay: SpecialDay, year: number, hour = 9, minute = 0): Date {
  let targetMonth = specialDay.month;
  let targetDay = specialDay.day;

  if (!specialDay.isFixed && specialDay.yearlyDates && specialDay.yearlyDates[year]) {
    targetMonth = specialDay.yearlyDates[year].month;
    targetDay = specialDay.yearlyDates[year].day;
  }

  return new Date(year, targetMonth - 1, targetDay, hour, minute, 0, 0);
}

/**
 * Özel gün için 32-bit benzersiz bildirim ID'si üretir (700.000.000 bandı)
 */
export function getSpecialDayNotificationId(specialDay: SpecialDay, year: number): number {
  const yearSuffix = year % 100;
  const monthDay = (specialDay.month * 100) + specialDay.day;
  return 700000000 + (yearSuffix * 10000) + monthDay;
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
      // Sabah saat 09:00'da tetiklenecek şekilde planla
      const triggerDate = getSpecialDayDateForYear(sd, year, 9, 0);

      // Sadece gelecekteki (veya bugünün saat 09:00 öncesindeki) alarmları planla
      if (triggerDate.getTime() > now.getTime()) {
        const notifId = getSpecialDayNotificationId(sd, year);

        items.push({
          id: notifId,
          title: sd.title,
          body: sd.message,
          schedule: {
            at: triggerDate,
            allowWhileIdle: true
          },
          sound: "res://raw/notification_sound",
          smallIcon: "res://drawable/ic_stat_name",
          largeIcon: "res://drawable/notification_icon",
          channelId: "butcem_pro_alarms",
          extra: {
            specialDayId: sd.id,
            isSpecialDay: true,
            year
          }
        });
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
 * tüm özel gün alarmlarını kesin saatli (allowWhileIdle) olarak kaydeder.
 */
export async function scheduleSpecialDayNotifications(): Promise<number> {
  try {
    const items = buildSpecialDayNotificationItems();
    if (items.length === 0) return 0;

    await initCapacitorNotificationChannel().catch(() => {});
    if (typeof LocalNotifications !== "undefined" && typeof LocalNotifications.schedule === "function") {
      await LocalNotifications.schedule({ notifications: items });
    }

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
  sendNotificationFn: (title: string, body: string, id: number) => void
): boolean {
  try {
    const todaySpecialDay = getTodaySpecialDay();
    if (!todaySpecialDay) return false;

    const todayDateStr = new Date().toISOString().slice(0, 10);
    const storageKey = `special_day_notif_sent_${todayDateStr}_${todaySpecialDay.id}`;

    if (typeof window !== "undefined") {
      const alreadySent = localStorage.getItem(storageKey);
      if (alreadySent) {
        return false;
      }
    }

    const notifId = getSpecialDayNotificationId(todaySpecialDay, new Date().getFullYear());
    sendNotificationFn(todaySpecialDay.title, todaySpecialDay.message, notifId);

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

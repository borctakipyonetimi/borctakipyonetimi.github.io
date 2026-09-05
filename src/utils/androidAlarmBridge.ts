/**
 * Android WebView AlarmManager JavaScript Interface Bridge
 * 
 * Bu yardımcı modül, borctakipyonetimi.github.io web uygulaması içinden
 * Android WebView'de tanımlı `window.AndroidAlarm` arayüzüne güvenli erişim sağlar.
 * Telefon kapalıyken veya ekran kilitliyken tam zamanlı sesli/titreşimli alarmların
 * donanım seviyesinde kurulmasını ve iptal edilmesini yönetir.
 */

declare global {
  interface Window {
    AndroidAlarm?: {
      setDebtAlarm: (id: number, title: string, triggerAtMillis: number, message?: string) => void;
      cancelDebtAlarm: (id: number) => void;
      isAvailable: () => boolean;
      showNotification?: (title: string, message: string) => void;
      syncAllData?: (alarmsJson: string, debtsJson: string, installmentDebtsJson: string) => void;
      testDelayedNotification?: (delaySeconds: number) => void;
      showToast?: (message: string) => void;
    };
  }
}

/**
 * Android köprüsünün mevcut olup olmadığını test eder.
 */
export function isAndroidAlarmBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.AndroidAlarm && (typeof window.AndroidAlarm.setDebtAlarm === "function" || window.AndroidAlarm.isAvailable?.()));
  } catch {
    return false;
  }
}

/**
 * Tekil bir borç veya taksit hatırlatıcısını Android AlarmManager'a kaydeder.
 */
export function scheduleAndroidDebtAlarm(
  id: number,
  title: string,
  triggerAtMillis: number,
  message?: string
): boolean {
  if (!isAndroidAlarmBridgeAvailable() || !window.AndroidAlarm) {
    return false;
  }

  try {
    const safeTitle = title.trim() || "Ödeme Hatırlatması ⏰";
    const safeMessage = message?.trim() || `Vadesi gelen borcunuz: ${safeTitle}`;
    
    // Geçmiş tarihlere alarm kurulmaz
    if (triggerAtMillis <= Date.now()) {
      return false;
    }

    window.AndroidAlarm.setDebtAlarm(id, safeTitle, triggerAtMillis, safeMessage);
    console.log(`[AndroidAlarmBridge] Alarm #${id} AlarmManager'a başarıyla kaydedildi (${new Date(triggerAtMillis).toLocaleString()})`);
    return true;
  } catch (err) {
    console.warn("[AndroidAlarmBridge] setDebtAlarm çağrılırken hata:", err);
    return false;
  }
}

/**
 * Belirli bir alarmı Android AlarmManager ve SharedPreferences deposundan siler.
 */
export function cancelAndroidDebtAlarm(id: number): boolean {
  if (!isAndroidAlarmBridgeAvailable() || !window.AndroidAlarm) {
    return false;
  }

  try {
    if (typeof window.AndroidAlarm.cancelDebtAlarm === "function") {
      window.AndroidAlarm.cancelDebtAlarm(id);
      console.log(`[AndroidAlarmBridge] Alarm #${id} AlarmManager'dan kaldırıldı.`);
      return true;
    }
  } catch (err) {
    console.warn("[AndroidAlarmBridge] cancelDebtAlarm çağrılırken hata:", err);
  }
  return false;
}

/**
 * Tüm alarmları, borçları ve taksitleri Android cihazın donanım katmanına (AlarmManager & SharedPreferences) senkronize eder.
 * Telefon kapalıyken veya ekran kilitliyken hem vadesi gelen alarmların hem de gecikmiş borç uyarılarının gelmesini sağlar.
 */
export function syncAllDebtsAndAlarmsToAndroid(
  alarms: any[],
  debts: any[],
  installmentDebts: any[]
): boolean {
  if (!isAndroidAlarmBridgeAvailable() || !window.AndroidAlarm) {
    return false;
  }

  try {
    const alarmsJson = JSON.stringify(alarms || []);
    const debtsJson = JSON.stringify(debts || []);
    const installmentDebtsJson = JSON.stringify(installmentDebts || []);

    if (typeof window.AndroidAlarm.syncAllData === "function") {
      window.AndroidAlarm.syncAllData(alarmsJson, debtsJson, installmentDebtsJson);
      console.log("[AndroidAlarmBridge] syncAllData çağrıldı (alarmlar, borçlar, taksitler donanıma yazıldı).");
      return true;
    } else {
      // Fallback: Eski sürümlerde tek tek alarm kur
      syncAllAlarmsToAndroid(alarms);
      return true;
    }
  } catch (err) {
    console.warn("[AndroidAlarmBridge] syncAllDebtsAndAlarmsToAndroid hatası:", err);
    return false;
  }
}

/**
 * Sistemdeki tüm aktif ve gelecekteki alarmları tek seferde Android AlarmManager ile senkronize eder.
 */
export function syncAllAlarmsToAndroid(
  alarms: Array<{ id: number; title: string; date?: string; timestamp?: number }>
): number {
  if (!isAndroidAlarmBridgeAvailable()) {
    return 0;
  }

  const now = Date.now();
  let scheduledCount = 0;

  alarms.forEach((alarm) => {
    let triggerMillis: number | null = null;

    if (alarm.timestamp && !isNaN(alarm.timestamp)) {
      triggerMillis = alarm.timestamp;
    } else if (alarm.date) {
      const parsed = new Date(alarm.date).getTime();
      if (!isNaN(parsed)) {
        triggerMillis = parsed;
      }
    }

    if (triggerMillis && triggerMillis > now) {
      const success = scheduleAndroidDebtAlarm(
        alarm.id,
        alarm.title,
        triggerMillis,
        `Ödeme vadesi geldi: ${alarm.title}`
      );
      if (success) scheduledCount++;
    }
  });

  return scheduledCount;
}

/**
 * Ekran kapalıyken veya uygulama arka plandayken bildirim test etmek için 5 sn sonra çalan donanım alarmını kurar.
 */
export function testAndroidBackgroundAlarm(delaySeconds: number = 5): boolean {
  if (!isAndroidAlarmBridgeAvailable() || !window.AndroidAlarm) {
    return false;
  }

  try {
    if (typeof window.AndroidAlarm.testDelayedNotification === "function") {
      window.AndroidAlarm.testDelayedNotification(delaySeconds);
      return true;
    } else {
      const trigger = Date.now() + (delaySeconds * 1000);
      return scheduleAndroidDebtAlarm(777777, "🔔 Ekran Kapalı Bildirim Testi", trigger, "Test bildirimi kilit ekranına ulaştı!");
    }
  } catch (e) {
    console.warn("[AndroidAlarmBridge] testAndroidBackgroundAlarm hatası:", e);
    return false;
  }
}

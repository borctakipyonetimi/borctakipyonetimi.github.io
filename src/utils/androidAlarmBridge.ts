/**
 * Android WebView AlarmManager JavaScript Interface Bridge
 * 
 * Bu yardımcı modül, borctakipyonetimi.github.io web uygulaması içinden
 * Android WebView'de tanımlı `window.AndroidAlarm` ve `window.Android` arayüzüne güvenli erişim sağlar.
 * Telefon kapalıyken veya ekran kilitliyken tam zamanlı sesli/titreşimli alarmların
 * donanım seviyesinde kurulmasını, yedekleme ve sistem paylaşım menüsünü yönetir.
 */

export interface AndroidBridgeInterface {
  setDebtAlarm?: (id: number, title: string, triggerAtMillis: number, message?: string) => void;
  cancelDebtAlarm?: (id: number) => void;
  isAvailable?: () => boolean;
  showNotification?: (title: string, message: string) => void;
  syncAllData?: (alarmsJson: string, debtsJson: string, installmentDebtsJson: string) => void;
  testDelayedNotification?: (delaySeconds: number) => void;
  showToast?: (message: string) => void;
  saveBackupFile?: (fileName: string, jsonContent: string) => void;
  shareBackupFile?: (fileName: string, jsonContent: string, title?: string) => void;
  openGoogleDrive?: () => void;
  openExternalUrl?: (url: string) => void;
}

declare global {
  interface Window {
    AndroidAlarm?: AndroidBridgeInterface;
    Android?: AndroidBridgeInterface;
  }
}

/**
 * Android köprüsünün aktif referansını döndürür
 */
function getActiveBridge(): AndroidBridgeInterface | null {
  if (typeof window === "undefined") return null;
  if (window.AndroidAlarm) return window.AndroidAlarm;
  if (window.Android) return window.Android;
  return null;
}

/**
 * Android köprüsünün mevcut olup olmadığını test eder.
 */
export function isAndroidAlarmBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const bridge = getActiveBridge();
    return Boolean(
      bridge && (
        typeof bridge.setDebtAlarm === "function" ||
        typeof bridge.saveBackupFile === "function" ||
        typeof bridge.shareBackupFile === "function" ||
        bridge.isAvailable?.()
      )
    );
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
  const bridge = getActiveBridge();
  if (!bridge || typeof bridge.setDebtAlarm !== "function") {
    return false;
  }

  try {
    const safeTitle = title.trim() || "Ödeme Hatırlatması ⏰";
    const safeMessage = message?.trim() || `Vadesi gelen borcunuz: ${safeTitle}`;
    
    // Geçmiş tarihlere alarm kurulmaz
    if (triggerAtMillis <= Date.now()) {
      return false;
    }

    bridge.setDebtAlarm(id, safeTitle, triggerAtMillis, safeMessage);
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
  const bridge = getActiveBridge();
  if (!bridge || typeof bridge.cancelDebtAlarm !== "function") {
    return false;
  }

  try {
    bridge.cancelDebtAlarm(id);
    console.log(`[AndroidAlarmBridge] Alarm #${id} AlarmManager'dan kaldırıldı.`);
    return true;
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
  const bridge = getActiveBridge();
  if (!bridge) {
    return false;
  }

  try {
    const alarmsJson = JSON.stringify(alarms || []);
    const debtsJson = JSON.stringify(debts || []);
    const installmentDebtsJson = JSON.stringify(installmentDebts || []);

    if (typeof bridge.syncAllData === "function") {
      bridge.syncAllData(alarmsJson, debtsJson, installmentDebtsJson);
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
  const bridge = getActiveBridge();
  if (!bridge) {
    return false;
  }

  try {
    if (typeof bridge.testDelayedNotification === "function") {
      bridge.testDelayedNotification(delaySeconds);
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

/**
 * Android cihazın İndirilenler (Downloads) klasörüne belirlenen dosya adıyla kaydeder.
 */
export function saveAndroidNativeBackupFile(fileName: string, jsonContent: string): boolean {
  const bridge = getActiveBridge();
  if (!bridge || typeof bridge.saveBackupFile !== "function") {
    return false;
  }
  try {
    bridge.saveBackupFile(fileName, jsonContent);
    return true;
  } catch (e) {
    console.warn("[AndroidAlarmBridge] saveBackupFile hatası:", e);
  }
  return false;
}

/**
 * Android Yerel Paylaşım Menüsünü (Bluetooth, Quick Share, Wi-Fi, WhatsApp, Drive, Telegram vb.) açar.
 */
export function shareAndroidNativeBackupFile(fileName: string, jsonContent: string, title?: string): boolean {
  const bridge = getActiveBridge();
  if (!bridge || typeof bridge.shareBackupFile !== "function") {
    return false;
  }
  try {
    bridge.shareBackupFile(fileName, jsonContent, title || "Bütçem Veri Yedeği");
    return true;
  } catch (e) {
    console.warn("[AndroidAlarmBridge] shareBackupFile hatası:", e);
  }
  return false;
}

/**
 * Google Drive uygulamasını veya web sayfasını güvenle açar.
 */
export function openAndroidGoogleDrive(): boolean {
  const bridge = getActiveBridge();
  if (!bridge) {
    return false;
  }
  try {
    if (typeof bridge.openGoogleDrive === "function") {
      bridge.openGoogleDrive();
      return true;
    }
  } catch (e) {
    console.warn("[AndroidAlarmBridge] openGoogleDrive hatası:", e);
  }
  return false;
}


/**
 * Android WebView AlarmManager JavaScript Interface Bridge
 * 
 * Bu yardımcı modül, borctakipyonetimi.github.io web uygulaması içinden
 * Android WebView'de tanımlı `window.AndroidAlarm` ve `window.Android` arayüzüne güvenli erişim sağlar.
 * Telefon kapalıyken veya ekran kilitliyken tam zamanlı sesli/titreşimli alarmların
 * donanım seviyesinde kurulmasını, yedekleme ve sistem paylaşım menüsünü yönetir.
 */

import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

export interface AndroidBridgeInterface {
  setDebtAlarm?: (id: number, title: string, triggerAtMillis: number, message?: string) => void;
  cancelDebtAlarm?: (id: number) => void;
  isAvailable?: () => boolean;
  showNotification?: (title: string, message: string) => void;
  syncAllData?: (alarmsJson: string, debtsJson: string, installmentDebtsJson: string) => void;
  testDelayedNotification?: (delaySeconds: number) => void;
  showToast?: (message: string) => void;
  saveBackupFile?: (fileName: string, jsonContent: string) => boolean | void;
  saveFile?: (fileName: string, content: string, mimeType?: string) => boolean | void;
  saveImageToGallery?: (fileName: string, base64Data: string, mimeType?: string) => boolean | void;
  shareBackupFile?: (fileName: string, jsonContent: string, title?: string) => void;
  openGoogleDrive?: () => void;
  openExternalUrl?: (url: string) => void;
}

declare global {
  interface Window {
    AndroidAlarm?: AndroidBridgeInterface;
    Android?: AndroidBridgeInterface;
    AndroidBridge?: AndroidBridgeInterface;
  }
}

/**
 * Android köprüsünün aktif referansını döndürür
 */
function getActiveBridge(): AndroidBridgeInterface | null {
  if (typeof window === "undefined") return null;
  if (window.AndroidAlarm) return window.AndroidAlarm;
  if (window.Android) return window.Android;
  if (window.AndroidBridge) return window.AndroidBridge;
  return null;
}

/**
 * Capacitor Local Notifications eklentisinin mevcut ve aktif olup olmadığını kontrol eder.
 */
export function isCapacitorAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(
      Capacitor.isNativePlatform() ||
      Capacitor.isPluginAvailable("LocalNotifications") ||
      (window as any).Capacitor?.isPluginAvailable?.("LocalNotifications")
    );
  } catch {
    return false;
  }
}

/**
 * Cordova Local Notification eklentisine güvenli erişim sağlar.
 */
export function getCordovaLocalNotification() {
  if (typeof window === "undefined") return null;
  const anyWin = window as any;
  if (anyWin.cordova?.plugins?.notification?.local) {
    return anyWin.cordova.plugins.notification.local;
  }
  return null;
}

/**
 * Cordova Local Notification eklentisinin cihazda mevcut olup olmadığını kontrol eder.
 */
export function isCordovaLocalNotificationAvailable(): boolean {
  return Boolean(getCordovaLocalNotification());
}

/**
 * Android köprüsünün, Capacitor'ün veya Cordova'nın mevcut olup olmadığını test eder.
 */
export function isAndroidAlarmBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (isCapacitorAvailable()) return true;
    if (isCordovaLocalNotificationAvailable()) return true;
    const bridge = getActiveBridge();
    return Boolean(
      bridge && (
        typeof bridge.setDebtAlarm === "function" ||
        typeof bridge.saveFile === "function" ||
        typeof bridge.saveBackupFile === "function" ||
        typeof bridge.shareBackupFile === "function" ||
        typeof bridge.saveImageToGallery === "function" ||
        bridge.isAvailable?.()
      )
    );
  } catch {
    return false;
  }
}

/**
 * Android 8.0+ için yüksek öncelikli sesli/titreşimli bildirim kanalını yapılandırır.
 */
export async function initCapacitorNotificationChannel(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await LocalNotifications.createChannel({
      id: "debt_reminders",
      name: "Borç ve Ödeme Hatırlatıcıları",
      description: "Vadesi gelen borçlar ve taksitler için sesli ve titreşimli sistem alarmları",
      importance: 5, // IMPORTANCE_HIGH (Heads-up banner + ses)
      visibility: 1, // VISIBILITY_PUBLIC (Kilit ekranında göster)
      sound: "beep.wav",
      vibration: true,
      lights: true,
      lightColor: "#4F46E5"
    });
  } catch (e) {
    // Web ortamında veya kanalı desteklemeyen platformlarda sessizce devam et
  }
}

/**
 * Capacitor yerel bildirim iznini denetler ve ister.
 */
export async function requestCapacitorNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const check = await LocalNotifications.checkPermissions();
    if (check.display === "granted") {
      await initCapacitorNotificationChannel();
      return true;
    }
    const requested = await LocalNotifications.requestPermissions();
    await initCapacitorNotificationChannel();
    return requested.display === "granted";
  } catch (err) {
    console.warn("[Capacitor LocalNotifications] İzin sorgulama hatası:", err);
    return false;
  }
}

/**
 * Capacitor LocalNotifications üzerinden arka planda/ekran kapalıyken çalan alarm kurar.
 */
export async function scheduleCapacitorAlarm(
  id: number,
  title: string,
  triggerAtMillis: number,
  message?: string
): Promise<boolean> {
  if (triggerAtMillis <= Date.now()) return false;
  try {
    // Android bildirim kanalını hazırla
    await initCapacitorNotificationChannel();

    const safeTitle = title.trim() || "Ödeme Hatırlatması ⏰";
    const safeMessage = message?.trim() || `Vadesi gelen borcunuz: ${safeTitle}`;
    const safeId = Math.abs(Number(id)) || Math.floor(Math.random() * 100000);

    // İzin kontrolü
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        await LocalNotifications.requestPermissions();
      }
    } catch {
      // İzin sorgusu desteklenmiyorsa devam et
    }

    // Aynı id ile önceden kalma bildirim varsa temizle
    try {
      await LocalNotifications.cancel({ notifications: [{ id: safeId }] });
    } catch {}

    // Kilit ekranında ve Doze modunda uyandırma için allowWhileIdle: true
    await LocalNotifications.schedule({
      notifications: [
        {
          id: safeId,
          title: safeTitle,
          body: safeMessage,
          schedule: {
            at: new Date(triggerAtMillis),
            allowWhileIdle: true // Ekran kilitliyken ve Doze modunda uyandırma sağlar
          },
          channelId: "debt_reminders",
          sound: "beep.wav",
          smallIcon: "res://icon",
          autoCancel: true,
          extra: {
            id: safeId,
            title: safeTitle,
            triggerAtMillis
          }
        }
      ]
    });
    console.log(`[Capacitor LocalNotifications] Alarm #${safeId} kuruldu (${new Date(triggerAtMillis).toLocaleString()})`);
    return true;
  } catch (err) {
    console.warn("[Capacitor LocalNotifications] schedule error:", err);
    return false;
  }
}

/**
 * Capacitor LocalNotifications üzerinden alarmı iptal eder.
 */
export async function cancelCapacitorAlarm(id: number): Promise<boolean> {
  try {
    const safeId = Math.abs(Number(id));
    await LocalNotifications.cancel({
      notifications: [{ id: safeId }]
    });
    console.log(`[Capacitor LocalNotifications] Alarm #${safeId} iptal edildi.`);
    return true;
  } catch (err) {
    console.warn("[Capacitor LocalNotifications] cancel error:", err);
    return false;
  }
}

/**
 * Tekil bir borç veya taksit hatırlatıcısını Capacitor, Cordova ve Android AlarmManager'a kaydeder.
 */
export function scheduleAndroidDebtAlarm(
  id: number,
  title: string,
  triggerAtMillis: number,
  message?: string
): boolean {
  const safeTitle = title.trim() || "Ödeme Hatırlatması ⏰";
  const safeMessage = message?.trim() || `Vadesi gelen borcunuz: ${safeTitle}`;
  
  // Geçmiş tarihlere alarm kurulmaz
  if (triggerAtMillis <= Date.now()) {
    return false;
  }

  let isScheduled = false;

  // 1. Capacitor LocalNotifications (Modern Android 13/14, Doze modu & allowWhileIdle desteği)
  scheduleCapacitorAlarm(id, safeTitle, triggerAtMillis, safeMessage).catch(() => {});
  isScheduled = true;

  // 2. Cordova Local Notification Plugin fallback
  const cordovaLocal = getCordovaLocalNotification();
  if (cordovaLocal && typeof cordovaLocal.schedule === "function") {
    try {
      cordovaLocal.schedule({
        id: Number(id),
        title: safeTitle,
        text: safeMessage,
        trigger: { at: new Date(triggerAtMillis) },
        foreground: true,
        vibrate: true,
        sound: true,
        priority: 2,
        wakeup: true,
        smallIcon: "res://icon",
        data: { id: Number(id), title: safeTitle, message: safeMessage }
      });
      isScheduled = true;
    } catch (cErr) {
      console.warn("[Cordova LocalNotification] schedule çağrısı hatası:", cErr);
    }
  }

  // 3. Android WebView AlarmManager Bridge fallback
  const bridge = getActiveBridge();
  if (bridge && typeof bridge.setDebtAlarm === "function") {
    try {
      bridge.setDebtAlarm(id, safeTitle, triggerAtMillis, safeMessage);
      isScheduled = true;
    } catch (err) {
      console.warn("[AndroidAlarmBridge] setDebtAlarm çağrılırken hata:", err);
    }
  }

  return isScheduled;
}

/**
 * Belirli bir alarmı Capacitor, Cordova ve Android AlarmManager'dan siler.
 */
export function cancelAndroidDebtAlarm(id: number): boolean {
  let isCancelled = false;

  // 1. Capacitor LocalNotifications
  cancelCapacitorAlarm(id).catch(() => {});
  isCancelled = true;

  // 2. Cordova Local Notification
  const cordovaLocal = getCordovaLocalNotification();
  if (cordovaLocal && typeof cordovaLocal.cancel === "function") {
    try {
      cordovaLocal.cancel(Number(id));
      isCancelled = true;
    } catch (cErr) {
      console.warn("[Cordova LocalNotification] cancel hatası:", cErr);
    }
  }

  // 3. Android WebView Bridge
  const bridge = getActiveBridge();
  if (bridge && typeof bridge.cancelDebtAlarm === "function") {
    try {
      bridge.cancelDebtAlarm(id);
      isCancelled = true;
    } catch (err) {
      console.warn("[AndroidAlarmBridge] cancelDebtAlarm çağrılırken hata:", err);
    }
  }

  return isCancelled;
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
  // Capacitor altyapısında gelecekteki tüm alarmları LocalNotifications.schedule ile zamanla
  if (isCapacitorAvailable() || typeof window !== "undefined") {
    syncAllAlarmsToAndroid(alarms);
  }

  const bridge = getActiveBridge();
  if (!bridge) {
    return isCapacitorAvailable();
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
  try {
    const bridge = getActiveBridge();
    if (bridge && typeof bridge.testDelayedNotification === "function") {
      bridge.testDelayedNotification(delaySeconds);
      return true;
    }
    const trigger = Date.now() + (delaySeconds * 1000);
    return scheduleAndroidDebtAlarm(777777, "🔔 Ekran Kapalı Bildirim Testi", trigger, "Test bildirimi kilit ekranına ulaştı!");
  } catch (e) {
    console.warn("[AndroidAlarmBridge] testAndroidBackgroundAlarm hatası:", e);
    return false;
  }
}

/**
 * Android cihazın İndirilenler (Downloads) klasörüne belirlenen dosya adıyla kaydeder.
 */
export function saveAndroidNativeFile(fileName: string, content: string, mimeType: string = "application/json"): boolean {
  const bridge = getActiveBridge();
  if (!bridge) return false;

  try {
    if (typeof bridge.saveFile === "function") {
      bridge.saveFile(fileName, content, mimeType);
      return true;
    } else if (typeof bridge.saveBackupFile === "function") {
      bridge.saveBackupFile(fileName, content);
      return true;
    }
  } catch (e) {
    console.warn("[AndroidAlarmBridge] saveAndroidNativeFile hatası:", e);
  }
  return false;
}

/**
 * Android cihazın İndirilenler (Downloads) klasörüne belirlenen dosya adıyla JSON kaydeder.
 */
export function saveAndroidNativeBackupFile(fileName: string, jsonContent: string): boolean {
  return saveAndroidNativeFile(fileName, jsonContent, "application/json");
}

/**
 * Android cihazın Galeri / Fotoğraflar (Pictures) klasörüne resim/dekont kaydeder.
 */
export function saveAndroidNativeImageToGallery(fileName: string, base64Data: string, mimeType: string = "image/jpeg"): boolean {
  const bridge = getActiveBridge();
  if (!bridge || typeof bridge.saveImageToGallery !== "function") {
    return false;
  }
  try {
    bridge.saveImageToGallery(fileName, base64Data, mimeType);
    return true;
  } catch (e) {
    console.warn("[AndroidAlarmBridge] saveAndroidNativeImageToGallery hatası:", e);
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


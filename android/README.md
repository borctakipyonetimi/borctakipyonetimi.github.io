# Bütçem Pro Android WebView & AlarmManager Entegrasyonu

Bu klasör, **borctakipyonetimi.github.io** web uygulamasının Android WebView sarmalayıcısını (wrapper) ve telefon kapalıyken dahi sesli/titreşimli alarm üreten yerel **AlarmManager** altyapısını içerir.

## Dosya Hiyerarşisi
- `app/src/main/AndroidManifest.xml`: İzinler (`POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE`) ve Receiver tanımları.
- `app/src/main/java/io/github/borctakipyonetimi/MainActivity.java`: WebView ayarları, JavaScript Interface köprüsü (`window.AndroidAlarm.setDebtAlarm`) ve çalışma zamanı bildirim izinleri.
- `app/src/main/java/io/github/borctakipyonetimi/DebtAlarmReceiver.java`: Telefon kapalıyken veya ekran kilitliyken `WakeLock` ile uyanıp sistem alarm sesini çalan ve kalıcı Heads-Up bildirim gösteren `BroadcastReceiver`.
- `app/src/main/java/io/github/borctakipyonetimi/BootReceiver.java`: Cihaz yeniden başlatıldığında (reboot) SharedPreferences'taki alarmları otomatik olarak `AlarmManager`'a yeniden kuran bileşen.

## JavaScript Köprüsü (Web <-> Android Bridge)
Web sayfasından aşağıdaki fonksiyonlar doğrudan çağrılabilir:
```javascript
// Tam parametreli borç alarmı kurma
window.AndroidAlarm.setDebtAlarm(id, title, triggerAtMillis, message);

// Basit çağrı
window.AndroidAlarm.setDebtAlarm(title, triggerAtMillis);

// Alarm iptali
window.AndroidAlarm.cancelDebtAlarm(id);

// Android köprüsü var mı kontrolü
if (window.AndroidAlarm && window.AndroidAlarm.isAvailable()) {
    console.log("Android AlarmManager aktif!");
}
```

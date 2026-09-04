# Bütçem Pro Android WebView & Acil AlarmManager Entegrasyonu

Bu klasör, **borctakipyonetimi.github.io** web uygulamasının Android WebView sarmalayıcısını (wrapper) ve telefon ekranı kapalıyken / kilitliyken dahi ekranı aydınlatıp üst bildirim çekmecesinden aşağı doğru açılan (Heads-Up) sesli ve titreşimli alarm üreten yerel **AlarmManager & FullScreenIntent** altyapısını içerir.

## 🚀 Ekran Kapalıyken Çalışma Mekanizması
1. **Ekranı Aydınlatma & WakeLock**: `PowerManager.SCREEN_BRIGHT_WAKE_LOCK | ACQUIRE_CAUSES_WAKEUP` ile telefon uyku (Doze) modundayken bile ekran fiziksel olarak açılır.
2. **Aşağı Doğru Açılan Bildirim (Heads-Up Banner)**: `NotificationCompat.Builder.setFullScreenIntent()` ve `PRIORITY_MAX` ile alarm vakti geldiğinde bildirim çekmecesinden aşağı doğru genişleyen acil uyarı penceresi (`AlarmAlertActivity`) ve bildirim kartı açılır.
3. **Kilit Ekranı Görünürlüğü**: `channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC)` ve `builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)` sayesinde kilit ekranında "İçerik gizlendi" yazmaz; borç başlığı, vade uyarısı ve "Ödemeyi Gör" / "Kapat" butonları doğrudan görünür.
4. **Kalıcı Bildirim Çekmecesi Desteği**: Bildirim `NotificationManager` ile çekmeceye yerleştirilir ve kullanıcı eylem seçene kadar çekmecede kalır.
5. **Ses & Titreşim Motoru**: Sistem alarm melodisi (`RingtoneManager.TYPE_ALARM`) donanımsal titreşim dalgası ile birlikte çalınır, "Kapat" butonuna basıldığında veya 45 saniye sonra otomatik susar.

## 📂 Dosya Hiyerarşisi
- `app/src/main/AndroidManifest.xml`: İzinler (`USE_FULL_SCREEN_INTENT`, `TURN_SCREEN_ON`, `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `WAKE_LOCK`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`), Activity ve Receiver tanımları.
- `app/src/main/java/io/github/borctakipyonetimi/DebtAlarmReceiver.java`: Ekranı uyandıran, Heads-up bildirimi basan ve sistem alarmını çalan ana BroadcastReceiver.
- `app/src/main/java/io/github/borctakipyonetimi/AlarmAlertActivity.java`: Ekran kilitliyken üstten açılan tam ekran/baş üstü alarm diyalog penceresi.
- `app/src/main/java/io/github/borctakipyonetimi/DebtAlarmDismissReceiver.java`: Bildirim çekmecesindeki "Kapat" butonuna tıklandığında sesi susturup bildirimi kaldıran alıcı.
- `app/src/main/java/io/github/borctakipyonetimi/MainActivity.java`: WebView ayarları, JavaScript Interface köprüsü (`window.AndroidAlarm`) ve kilit ekranı pencereleri (`setShowWhenLocked`).
- `app/src/main/java/io/github/borctakipyonetimi/BootReceiver.java`: Cihaz yeniden başlatıldığında (reboot) SharedPreferences'taki alarmları otomatik yeniden kuran bileşen.
- `app/src/main/res/drawable/ic_stat_alarm.xml`: Android bildirim standartlarına uygun beyaz alfa vektör ikon.
- `app/src/main/res/layout/activity_alarm_alert.xml`: Kilit ekranında açılan alarm kartı tasarımı.

## 🌐 JavaScript Köprüsü (Web <-> Android Bridge)
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

## 📦 GitHub'a Yükleme (Push)
Bu proje dosyalarını GitHub reponuza yüklemek için terminalden:
```bash
git add android/
git commit -m "feat(android): ekran kapalıyken açılan Heads-up bildirim ve alarm altyapısı entegre edildi"
git push origin main
```
komutlarını çalıştırabilirsiniz.

package io.github.borctakipyonetimi;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * DebtAlarmReceiver:
 * Web sitesinden veya yerel veritabanından gelen borç hatırlatma alarmlarını
 * telefon tamamen kapalıyken (ekran kilitli/uykuda) bile donanım seviyesinde yakalar.
 * 
 * - Ekranı fiziksel olarak aydınlatır (SCREEN_BRIGHT_WAKE_LOCK & ACQUIRE_CAUSES_WAKEUP).
 * - Bildirim çekmecesinden aşağı doğru açılan (Heads-Up Banner) uyarı üretir.
 * - Kapalı kilit ekranında tam mesajı gizlemeden (VISIBILITY_PUBLIC) gösterir.
 * - Sistem alarm sesini (TYPE_ALARM) ve titreşim motorunu tetikler.
 */
public class DebtAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "DebtAlarmReceiver";
    public static final String CHANNEL_ID = "borc_takip_alarm_channel_v3";
    public static final String CHANNEL_NAME = "Borç & Vade Acil Alarmları";
    public static final String CHANNEL_DESC = "Vadesi gelen borç ve taksitler için sesli, titreşimli ve açılır kilit ekranı uyarıları";

    public static final String EXTRA_ALARM_ID = "extra_alarm_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_MESSAGE = "extra_message";
    public static final String EXTRA_TIMESTAMP = "extra_timestamp";
    public static final String ACTION_CHECK_OVERDUE_DEBTS = "io.github.borctakipyonetimi.ACTION_CHECK_OVERDUE_DEBTS";

    private static Ringtone activeRingtone = null;
    private static final Handler soundTimeoutHandler = new Handler(Looper.getMainLooper());
    private static final Runnable stopSoundRunnable = DebtAlarmReceiver::stopAlarmSound;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        Log.d(TAG, "DebtAlarmReceiver tetiklendi! Intent: " + action);

        if (ACTION_CHECK_OVERDUE_DEBTS.equals(action)) {
            Log.i(TAG, "Gecikmiş borçları periyodik tarama başlatılıyor...");
            handleOverdueDebtsScan(context);
            return;
        }

        // 1. Ekranı Aydınlatma ve CPU WakeLock (Telefon ekran kapalıyken ekranı açmak için şarttır)
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        PowerManager.WakeLock screenLock = null;

        if (powerManager != null) {
            try {
                // CPU'yu uyanık tutan WakeLock
                wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                        "BorcTakip:CpuWakeLock"
                );
                wakeLock.acquire(15 * 1000L);

                // Fiziksel ekranı açan / aydınlatan WakeLock (Ekran kapalıyken uyarının görünmesini sağlar)
                @SuppressWarnings("deprecation")
                int screenFlags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE;
                screenLock = powerManager.newWakeLock(screenFlags, "BorcTakip:ScreenBrightWakeLock");
                screenLock.acquire(15 * 1000L);
            } catch (Exception e) {
                Log.w(TAG, "WakeLock başlatma uyarısı:", e);
            }
        }

        try {
            int alarmId = intent.getIntExtra(EXTRA_ALARM_ID, (int) System.currentTimeMillis());
            String title = intent.getStringExtra(EXTRA_TITLE);
            String message = intent.getStringExtra(EXTRA_MESSAGE);

            if (title == null || title.trim().isEmpty()) {
                title = "⏰ Ödeme Vadesi Geldi!";
            }
            if (message == null || message.trim().isEmpty()) {
                message = "Planlanan borç veya taksitinizin son ödeme günü geldi. Lütfen kontrol edin.";
            }

            // 2. Android 8.0+ Bildirim Kanalını oluştur (Yüksek öncelik, Heads-Up açılır pencere ve kilit ekranı görünürlüğü)
            createNotificationChannel(context);

            // 3. PendingIntentler:
            // a) Uygulamayı Aç (MainActivity)
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.putExtra("NAVIGATE_TO", "debts");
            openIntent.putExtra("ALARM_ID", alarmId);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                    context,
                    alarmId,
                    openIntent,
                    pendingFlags
            );

            // b) Tam Ekran ve Kilit Ekranı Heads-Up Intent (AlarmAlertActivity)
            Intent alertIntent = new Intent(context, AlarmAlertActivity.class);
            alertIntent.putExtra(AlarmAlertActivity.EXTRA_ALARM_ID, alarmId);
            alertIntent.putExtra(AlarmAlertActivity.EXTRA_TITLE, title);
            alertIntent.putExtra(AlarmAlertActivity.EXTRA_MESSAGE, message);
            alertIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                    context,
                    alarmId + 100000,
                    alertIntent,
                    pendingFlags
            );

            // c) Bildirimi Kapat Butonu Intent (DebtAlarmDismissReceiver)
            Intent dismissIntent = new Intent(context, DebtAlarmDismissReceiver.class);
            dismissIntent.setAction(DebtAlarmDismissReceiver.ACTION_DISMISS);
            dismissIntent.putExtra(EXTRA_ALARM_ID, alarmId);
            PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                    context,
                    alarmId + 200000,
                    dismissIntent,
                    pendingFlags
            );

            // 4. Sistem Alarm Zil Sesini Belirle
            Uri alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmSoundUri == null) {
                alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            if (alarmSoundUri == null) {
                alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            // 5. Titreşim Deseni
            long[] vibrationPattern = new long[]{0, 600, 250, 600, 250, 800};

            // 6. Küçük İkon Tespiti
            int smallIconId = R.drawable.ic_stat_alarm;
            if (smallIconId == 0) {
                smallIconId = context.getApplicationInfo().icon;
            }
            if (smallIconId == 0) {
                smallIconId = android.R.drawable.ic_dialog_info;
            }

            // 7. Resmi SMS Formatında Bildirim Metni Oluşturma
            SimpleDateFormat sdf = new SimpleDateFormat("dd.MM.yyyy", Locale.getDefault());
            String dateStr = sdf.format(new Date());

            String officialTitle = "BÜTÇEM PRO - VADE BİLGİLENDİRMESİ";
            String officialBody = "SN. DEĞERLİ KULLANICIMIZ\n" +
                    dateStr + " TARİHLİ BORÇ / VADE HATIRLATMANIZ:\n" +
                    "- " + title + "\n" +
                    (message != null && !message.trim().isEmpty() ? "- " + message + "\n" : "") +
                    "- VADE GECİKME FAİZLERİNDEN KORUNMAK İÇİN ÖDEMENİZİ ZAMANINDA YAPMANIZI RİCA EDERİZ.\n" +
                    "- BÜTÇEM PRO İYİ GÜNLER DİLERİZ B001";

            // 8. Bildirim Çekmecesinden Aşağı Açılan (Heads-Up) ve Kilit Ekranında Görünen Bildirim İnşası
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(smallIconId)
                    .setContentTitle(officialTitle)
                    .setContentText("SN. KULLANICIMIZ: " + title)
                    .setStyle(new NotificationCompat.BigTextStyle()
                            .setBigContentTitle("⏰ " + officialTitle)
                            .bigText(officialBody)
                            .setSummaryText("Vade & Borç Bildirimi"))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Kilit ekranında tam mesaj gösterimi
                    .setContentIntent(contentPendingIntent)
                    .setAutoCancel(true)
                    .setOngoing(false)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setSound(alarmSoundUri)
                    .setVibrate(vibrationPattern)
                    .setLights(Color.RED, 1000, 500)
                    .addAction(0, "Ödemeyi Gör", contentPendingIntent)
                    .addAction(0, "Kapat", dismissPendingIntent);

            // 9. Bildirimi Bildirim Çekmecesine Garantili Yayınla
            Notification notification = builder.build();
            boolean notificationSent = false;
            try {
                NotificationManagerCompat.from(context).notify(alarmId, notification);
                notificationSent = true;
                Log.i(TAG, "NotificationManagerCompat ile bildirim çekmecesine başarıyla yayınlandı. ID: " + alarmId);
            } catch (SecurityException se) {
                Log.e(TAG, "POST_NOTIFICATIONS izni bulunamadı:", se);
            } catch (Exception e) {
                Log.w(TAG, "NotificationManagerCompat notify uyarısı, standart servis deneniyor:", e);
            }

            if (!notificationSent) {
                try {
                    NotificationManager systemNotificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (systemNotificationManager != null) {
                        systemNotificationManager.notify(alarmId, notification);
                        Log.i(TAG, "NotificationManager ile bildirim çekmecesine yayınlandı. ID: " + alarmId);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Sistem NotificationManager notify hatası:", e);
                }
            }

            // 10. Donanımsal Titreşimi Tetikle
            triggerHardwareVibration(context, vibrationPattern);

            // 11. Alarm Sesini Oynat (Sistem kanalına ek olarak garantili ses)
            playAlarmSound(context, alarmSoundUri);

            Log.i(TAG, "Borç alarm bildirimi üst çekmeceye ve kilit ekranına başarıyla gönderildi. ID: " + alarmId);

        } catch (Exception e) {
            Log.e(TAG, "DebtAlarmReceiver işlem hatası:", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try { wakeLock.release(); } catch (Exception ignored) {}
            }
            if (screenLock != null && screenLock.isHeld()) {
                try { screenLock.release(); } catch (Exception ignored) {}
            }
        }
    }

    /**
     * SharedPreferences içinde kayıtlı borç ve taksitleri tarar.
     * Vadesi geçmiş veya bugün olan ödemeler için kilit ekranı ve bildirim çekmecesi
     * üzerinden sesli ve titreşimli heads-up bildirim yayınlar.
     */
    public static void handleOverdueDebtsScan(Context context) {
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        PowerManager.WakeLock screenLock = null;

        try {
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                        "BorcTakip:ScanWakeLock"
                );
                wakeLock.acquire(15 * 1000L);

                @SuppressWarnings("deprecation")
                int screenFlags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE;
                screenLock = powerManager.newWakeLock(screenFlags, "BorcTakip:ScanScreenLock");
                screenLock.acquire(15 * 1000L);
            }

            SharedPreferences prefs = context.getSharedPreferences("borc_takip_alarms_store", Context.MODE_PRIVATE);
            String debtsJson = prefs.getString("saved_debts_json", "[]");

            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
            cal.set(java.util.Calendar.MINUTE, 0);
            cal.set(java.util.Calendar.SECOND, 0);
            cal.set(java.util.Calendar.MILLISECOND, 0);
            long todayStart = cal.getTimeInMillis();

            JSONArray overdueList = new JSONArray();
            double totalOverdueAmount = 0;
            String topOverdueName = "";
            int maxDaysLate = 0;

            JSONArray debtsArray = new JSONArray(debtsJson);
            for (int i = 0; i < debtsArray.length(); i++) {
                JSONObject d = debtsArray.getJSONObject(i);
                boolean isPaid = d.optBoolean("isPaid", false);
                double amount = d.optDouble("amount", 0);
                double paid = d.optDouble("paid", 0);
                double remaining = amount - paid;
                String dueDateStr = d.optString("dueDate", "");

                if (!isPaid && remaining > 0 && !dueDateStr.isEmpty()) {
                    long dueTime = parseDateTimeFlexible(dueDateStr);
                    if (dueTime > 0 && dueTime < todayStart) {
                        int daysLate = (int) Math.max(1, (todayStart - dueTime) / (1000 * 60 * 60 * 24));
                        JSONObject item = new JSONObject();
                        item.put("name", d.optString("name", "Borç"));
                        item.put("remaining", remaining);
                        item.put("daysLate", daysLate);
                        overdueList.put(item);
                        totalOverdueAmount += remaining;
                        if (daysLate > maxDaysLate) {
                            maxDaysLate = daysLate;
                            topOverdueName = d.optString("name", "Borç");
                        }
                    }
                }
            }

            if (overdueList.length() > 0) {
                createNotificationChannel(context);
                int notifId = 888100;

                Intent openIntent = new Intent(context, MainActivity.class);
                openIntent.putExtra("NAVIGATE_TO", "debts");
                openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent contentPendingIntent = PendingIntent.getActivity(context, notifId, openIntent, pendingFlags);

                SimpleDateFormat sdf = new SimpleDateFormat("dd.MM.yyyy", Locale.getDefault());
                String todayStr = sdf.format(new Date());

                String title = "⚠️ Gecikmiş Borç Uyarısı (" + overdueList.length() + " Adet)";
                String body = "SN. DEĞERLİ KULLANICIMIZ\n" +
                        todayStr + " İTİBARIYLA GECİKMİŞ BORCUNUZ BULUNMAKTADIR:\n" +
                        "- " + topOverdueName + " (" + maxDaysLate + " gün gecikti)\n" +
                        "- Toplam Geciken Borç Tutarı: ₺" + String.format(Locale.getDefault(), "%,.0f", totalOverdueAmount) + "\n" +
                        "- Gecikme faizlerinden korunmak için ödemenizi yapmanızı rica ederiz.\n" +
                        "BÜTÇEM PRO İYİ GÜNLER DİLERİZ B001";

                int smallIconId = R.drawable.ic_stat_alarm;
                if (smallIconId == 0) smallIconId = context.getApplicationInfo().icon;
                if (smallIconId == 0) smallIconId = android.R.drawable.ic_dialog_info;

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                if (soundUri == null) soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(smallIconId)
                        .setContentTitle(title)
                        .setContentText("Sn. Kullanıcımız: " + topOverdueName + " için ödeme gecikti (" + maxDaysLate + " gün)")
                        .setStyle(new NotificationCompat.BigTextStyle().setBigContentTitle(title).bigText(body))
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_ALARM)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setContentIntent(contentPendingIntent)
                        .setAutoCancel(true)
                        .setDefaults(NotificationCompat.DEFAULT_ALL)
                        .setSound(soundUri)
                        .setVibrate(new long[]{0, 500, 200, 500})
                        .addAction(0, "Ödemeleri İncele", contentPendingIntent);

                Notification notification = builder.build();
                NotificationManagerCompat.from(context).notify(notifId, notification);
                Log.i(TAG, "Gecikmiş borç bildirimi yayınlandı. Toplam: " + overdueList.length());
            }

            // Bir sonraki periyodik kontrolü planla
            MainActivity.schedulePeriodicOverdueDebtCheck(context);

        } catch (Exception e) {
            Log.e(TAG, "handleOverdueDebtsScan hatası:", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try { wakeLock.release(); } catch (Exception ignored) {}
            }
            if (screenLock != null && screenLock.isHeld()) {
                try { screenLock.release(); } catch (Exception ignored) {}
            }
        }
    }

    public static long parseDateTimeFlexible(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) return 0;
        dateStr = dateStr.trim();
        try {
            if (dateStr.matches("^\\d+$")) {
                return Long.parseLong(dateStr);
            }
            if (dateStr.contains("T")) {
                String[] parts = dateStr.split("T");
                String[] dParts = parts[0].split("-");
                String[] tParts = parts[1].split(":");
                java.util.Calendar cal = java.util.Calendar.getInstance();
                cal.set(Integer.parseInt(dParts[0]), Integer.parseInt(dParts[1]) - 1, Integer.parseInt(dParts[2]),
                        Integer.parseInt(tParts[0]), Integer.parseInt(tParts[1]), 0);
                return cal.getTimeInMillis();
            } else if (dateStr.contains("-")) {
                String[] parts = dateStr.split(" ");
                String[] dParts = parts[0].split("-");
                int hr = 9, min = 0;
                if (parts.length > 1 && parts[1].contains(":")) {
                    String[] tParts = parts[1].split(":");
                    hr = Integer.parseInt(tParts[0]);
                    min = Integer.parseInt(tParts[1]);
                }
                java.util.Calendar cal = java.util.Calendar.getInstance();
                cal.set(Integer.parseInt(dParts[0]), Integer.parseInt(dParts[1]) - 1, Integer.parseInt(dParts[2]), hr, min, 0);
                return cal.getTimeInMillis();
            } else if (dateStr.contains(".")) {
                String[] parts = dateStr.split(" ");
                String[] dParts = parts[0].split("\\.");
                int hr = 9, min = 0;
                if (parts.length > 1 && parts[1].contains(":")) {
                    String[] tParts = parts[1].split(":");
                    hr = Integer.parseInt(tParts[0]);
                    min = Integer.parseInt(tParts[1]);
                }
                java.util.Calendar cal = java.util.Calendar.getInstance();
                cal.set(Integer.parseInt(dParts[2]), Integer.parseInt(dParts[1]) - 1, Integer.parseInt(dParts[0]), hr, min, 0);
                return cal.getTimeInMillis();
            }
        } catch (Exception e) {
            Log.w(TAG, "parseDateTimeFlexible başarısız: " + dateStr, e);
        }
        return 0;
    }

    /**
     * Android 8.0+ için Heads-Up ve Kilit Ekranı destekli bildirim kanalı oluşturur.
     */
    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(CHANNEL_DESC);
                channel.enableLights(true);
                channel.setLightColor(Color.RED);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 600, 250, 600, 250, 800});
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.setShowBadge(true);
                channel.setBypassDnd(true);

                Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmSound == null) {
                    alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }

                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build();

                channel.setSound(alarmSound, audioAttributes);
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Cihazın titreşim motorunu çalıştırır.
     */
    private void triggerHardwareVibration(Context context, long[] pattern) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vibratorManager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vibratorManager != null) {
                    Vibrator vibrator = vibratorManager.getDefaultVibrator();
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                }
            } else {
                Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (vibrator != null && vibrator.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                    } else {
                        vibrator.vibrate(pattern, -1);
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Titreşim motoru uyarısı:", e);
        }
    }

    /**
     * Sistem alarm sesini RingtoneManager ile çalar ve 45 saniye sonra otomatik durdurur.
     */
    private void playAlarmSound(Context context, Uri soundUri) {
        try {
            stopAlarmSound();
            Ringtone ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), soundUri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    ringtone.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
                }
                ringtone.play();
                activeRingtone = ringtone;

                // 45 saniye sonra çalmayı otomatik durdur
                soundTimeoutHandler.removeCallbacks(stopSoundRunnable);
                soundTimeoutHandler.postDelayed(stopSoundRunnable, 45 * 1000L);
            }
        } catch (Exception e) {
            Log.w(TAG, "Alarm sesi oynatma uyarısı:", e);
        }
    }

    /**
     * Çalmakta olan alarm sesini susturur.
     */
    public static synchronized void stopAlarmSound() {
        try {
            soundTimeoutHandler.removeCallbacks(stopSoundRunnable);
            if (activeRingtone != null && activeRingtone.isPlaying()) {
                activeRingtone.stop();
            }
            activeRingtone = null;
        } catch (Exception e) {
            Log.w(TAG, "Alarm sesini durdurma uyarısı:", e);
        }
    }
}

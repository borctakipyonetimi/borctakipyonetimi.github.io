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

    private static Ringtone activeRingtone = null;
    private static final Handler soundTimeoutHandler = new Handler(Looper.getMainLooper());
    private static final Runnable stopSoundRunnable = DebtAlarmReceiver::stopAlarmSound;

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "DebtAlarmReceiver tetiklendi! Intent: " + intent.getAction());

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

            // 6. Güvenli Küçük İkon Tespiti (Uygulama kaynaklarından geçerli drawable seçimi)
            int smallIconId = context.getResources().getIdentifier("ic_stat_alarm", "drawable", context.getPackageName());
            if (smallIconId == 0) {
                smallIconId = context.getApplicationInfo().icon;
            }
            if (smallIconId == 0) {
                smallIconId = android.R.drawable.stat_notify_more;
            }

            // 7. Heads-Up Bildirim İnşası
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(smallIconId)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(new NotificationCompat.BigTextStyle()
                            .setBigContentTitle("⏰ " + title)
                            .bigText(message + "\n\n💡 Vade gecikme faizlerinden korunmak için ödemenizi zamanında tamamlayın.")
                            .setSummaryText("Vade Hatırlatıcısı"))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Kilit ekranında tam içerik gösterimi
                    .setContentIntent(contentPendingIntent)
                    .setFullScreenIntent(fullScreenPendingIntent, true) // Bildirim çekmecesinden aşağı inen Heads-Up ve kilit ekranı uyarısı
                    .setAutoCancel(true)
                    .setOngoing(false)
                    .setSound(alarmSoundUri)
                    .setVibrate(vibrationPattern)
                    .setLights(Color.RED, 1000, 500)
                    .addAction(android.R.drawable.ic_menu_view, "Ödemeyi Gör", contentPendingIntent)
                    .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Kapat", dismissPendingIntent);

            // 8. Donanımsal Titreşimi Tetikle
            triggerHardwareVibration(context, vibrationPattern);

            // 9. Alarm Sesini Oynat (Sistem kanalına ek olarak garantili ses)
            playAlarmSound(context, alarmSoundUri);

            // 10. Bildirimi Hem NotificationManager Hem de NotificationManagerCompat ile Yayınla
            Notification notification = builder.build();
            NotificationManager systemNotificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (systemNotificationManager != null) {
                systemNotificationManager.notify(alarmId, notification);
            }

            try {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                        ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                    NotificationManagerCompat.from(context).notify(alarmId, notification);
                }
            } catch (Exception e) {
                Log.w(TAG, "NotificationManagerCompat notify uyarısı:", e);
            }

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
     * Android 8.0+ için Heads-Up ve Kilit Ekranı destekli bildirim kanalı oluşturur.
     */
    private void createNotificationChannel(Context context) {
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

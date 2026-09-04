package io.github.borctakipyonetimi;

import android.Manifest;
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
 * Web sitesinden veya yerel veri tabanından gelen borç hatırlatma alarmlarını
 * uygulama tamamen kapalıyken veya telefon uykudayken (Doze Mode) bile yakalar,
 * sistem alarm sesini çaldırır, güçlü titreşim üretir ve üst bildirim çekmecesinde
 * kalıcı (Heads-Up) bildirim oluşturur.
 */
public class DebtAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "DebtAlarmReceiver";
    public static final String CHANNEL_ID = "borc_takip_alarm_channel";
    public static final String CHANNEL_NAME = "Borç & Vade Alarmları";
    public static final String CHANNEL_DESC = "Vadesi gelen borç ve taksitler için sesli/titreşimli acil uyarılar";

    public static final String EXTRA_ALARM_ID = "extra_alarm_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_MESSAGE = "extra_message";
    public static final String EXTRA_TIMESTAMP = "extra_timestamp";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "DebtAlarmReceiver tetiklendi! Intent action: " + intent.getAction());

        // 1. CPU'yu uyanık tutmak için güvenli bir WakeLock al (telefon uykudayken alarmın çalması için şarttır)
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "BorcTakip:AlarmWakeLock"
            );
            wakeLock.acquire(10 * 1000L /* 10 saniye otomatik emniyet süresi */);
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

            // 2. Android 8.0 (API 26+) Bildirim Kanalını yapılandır (Yüksek öncelik, alarm sesi ve titreşim)
            createNotificationChannel(context);

            // 3. Bildirime tıklandığında MainActivity'yi açacak PendingIntent
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

            // 4. Sistem Alarm Zil Sesini Al (Varsayılan Alarm Sesi, yoksa Bildirim Sesi)
            Uri alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmSoundUri == null) {
                alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            if (alarmSoundUri == null) {
                alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            // 5. Titreşim Deseni (0ms bekle, 600ms titret, 250ms dur, 600ms titret, 250ms dur, 800ms titret)
            long[] vibrationPattern = new long[]{0, 600, 250, 600, 250, 800};

            // 6. Heads-Up Kalıcı Bildirim İnşası
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(message + "\n\n💡 Vade gecikme faizlerinden korunmak için ödemenizi zamanında tamamlayın."))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setContentIntent(contentPendingIntent)
                    .setAutoCancel(true)
                    .setOngoing(false)
                    .setSound(alarmSoundUri)
                    .setVibrate(vibrationPattern)
                    .setLights(Color.RED, 1000, 500)
                    .setFullScreenIntent(contentPendingIntent, true); // Kilit ekranında tam ekran alarm uyarısı

            // 7. Titreşim Servisini manuel olarak da tetikle (Bazı üreticilerin sessiz mod filtrelerini aşmak için)
            triggerHardwareVibration(context, vibrationPattern);

            // 8. Ses Çalmayı Bağımsız Olarak da Başlat (Sistem kanal sesine ek olarak garanti altına alma)
            playAlarmSound(context, alarmSoundUri);

            // 9. Android 13+ (API 33+) İzin Kontrolü yaparak bildirimi yayınla
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                    NotificationManagerCompat.from(context).notify(alarmId, builder.build());
                } else {
                    Log.w(TAG, "POST_NOTIFICATIONS izni henüz verilmemiş. Bildirim gösterilemedi ancak ses/titreşim çalındı.");
                }
            } else {
                NotificationManagerCompat.from(context).notify(alarmId, builder.build());
            }

            Log.i(TAG, "Borç alarm bildirimi başarıyla üst çekmeceye gönderildi. ID: " + alarmId);

        } catch (Exception e) {
            Log.e(TAG, "DebtAlarmReceiver alarm işleme hatası:", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }

    /**
     * Android 8.0+ için yüksek öncelikli, alarm sesli bildirim kanalı oluşturur.
     */
    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                // Kanal zaten varsa tekrar oluşturulmaz
                NotificationChannel existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (existingChannel == null) {
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
                    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                    Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                    if (alarmSound == null) {
                        alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    }

                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .build();

                    channel.setSound(alarmSound, audioAttributes);
                    channel.setBypassDnd(true); // Rahatsız etmeyin modunu aşma yetkisi
                    notificationManager.createNotificationChannel(channel);
                }
            }
        }
    }

    /**
     * Donanım titreşimini bağımsız olarak çalıştırır.
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
            Log.w(TAG, "Titreşim motoru çalıştırılamadı:", e);
        }
    }

    /**
     * Sistem alarm sesini RingtoneManager ile anında çalar.
     */
    private void playAlarmSound(Context context, Uri soundUri) {
        try {
            Ringtone ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), soundUri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    ringtone.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
                }
                ringtone.play();
            }
        } catch (Exception e) {
            Log.w(TAG, "Alarm zil sesi bağımsız oynatıcıda çalınamadı:", e);
        }
    }
}

package com.butcempro.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Bütçem Pro - Android Native Donanım Köprüsü (AlarmManager & Notification)
 * 
 * Bu sınıf, WebView içindeki React web uygulamasından gönderilen borç ve alarmları
 * Android işletim sisteminin yerel AlarmManager sistemine kaydeder.
 * Telefon kilitliyken veya uygulama tamamen kapalıyken bile setExactAndAllowWhileIdle
 * ve WakeLock mekanizmalarıyla sesli/titreşimli veya sessiz hatırlatma bildirimleri üretir.
 */
public class AndroidAlarmBridge {

    private Context context;
    private WebView webView;
    public static final String CHANNEL_ID = "butcem_pro_alarms";
    public static final String SILENT_CHANNEL_ID = "butcem_pro_silent_alarms";
    private static final String PREFS_NAME = "butcem_pro_prefs";
    private static final String KEY_FREQUENCY = "notification_frequency";
    private static final String KEY_LAST_NOTIF = "last_notification_time";

    public AndroidAlarmBridge(Context context, WebView webView) {
        this.context = context;
        this.webView = webView;
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // 1. Standart ve Yüksek Öncelikli Sesli/Titreşimli Alarm Kanalı
            CharSequence name = "Bütçem Pro Alarmları";
            String description = "Vadesi gelen borç ve ödeme hatırlatıcı sesli alarmlar";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.enableLights(true);
            notificationManager.createNotificationChannel(channel);

            // 2. Vadesi Geçmiş Borçlar İçin Sessiz Hatırlatma Kanalı
            CharSequence silentName = "Bütçem Pro Sessiz Hatırlatıcılar";
            String silentDescription = "Vadesi geçmiş borçlar için sessiz gün içi bildirimler";
            NotificationChannel silentChannel = new NotificationChannel(
                    SILENT_CHANNEL_ID,
                    silentName,
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            silentChannel.setDescription(silentDescription);
            silentChannel.enableVibration(false);
            silentChannel.setSound(null, null);
            notificationManager.createNotificationChannel(silentChannel);
        }
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return true;
    }

    /**
     * Günde kaç kez hatırlatma yapılacağını SharedPreferences'a kaydeder.
     * Seçenekler: "1", "2", "3", "4", "hourly"
     */
    @JavascriptInterface
    public void setNotificationFrequency(String frequency) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_FREQUENCY, frequency).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Ayarlanan bildirim sıklığına göre milisaniye cinsinden periyot döndürür.
     */
    public static long getPeriodMillisByFrequency(String frequency) {
        if (frequency == null) return 12 * 60 * 60 * 1000L; // Varsayılan: Günde 2 kez
        String freq = frequency.trim().toLowerCase();
        if ("1".equals(freq)) {
            return 24 * 60 * 60 * 1000L; // Günde 1 kez (24 saat)
        } else if ("2".equals(freq)) {
            return 12 * 60 * 60 * 1000L; // Günde 2 kez (12 saat)
        } else if ("3".equals(freq)) {
            return 8 * 60 * 60 * 1000L;  // Günde 3 kez (8 saat)
        } else if ("4".equals(freq)) {
            return 6 * 60 * 60 * 1000L;  // Günde 4 kez (6 saat)
        } else if ("hourly".equals(freq)) {
            return 2 * 60 * 60 * 1000L;  // 2 saat
        } else {
            try {
                double num = Double.parseDouble(freq);
                if (num > 0) {
                    if (num == 1) return 24 * 60 * 60 * 1000L;
                    if (num == 2) return 12 * 60 * 60 * 1000L;
                    if (num == 3) return 8 * 60 * 60 * 1000L;
                    if (num == 4) return 6 * 60 * 60 * 1000L;
                    return (long) ((24.0 / num) * 60 * 60 * 1000L);
                }
            } catch (Exception ignored) {}
            return 12 * 60 * 60 * 1000L;
        }
    }

    /**
     * Uygulama tamamen kapalıyken de bildirimlerin kesin gelmesi için
     * setExactAndAllowWhileIdle ve Android 11+ (API 31 canScheduleExactAlarms) kontrolüyle
     * güncellenmiş alarm kurma metodu.
     */
    @JavascriptInterface
    public void setDebtAlarm(int id, String title, long triggerAtMillis, String message) {
        setDebtAlarmInternal(id, title, triggerAtMillis, message, false);
    }

    public void setDebtAlarmInternal(int id, String title, long triggerAtMillis, String message, boolean isSilent) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.putExtra("id", id);
            intent.putExtra("title", title);
            intent.putExtra("message", message);
            intent.putExtra("silent", isSilent);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags);

            // Android 12+ (API 31+) canScheduleExactAlarms kontrolü
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Android 6.0 - 11 (API 23 - 30): Uyku/Doze modunda tam uyanış
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (SecurityException se) {
            // canScheduleExactAlarms izni verilmediyse güvenli fallback
            try {
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    Intent intent = new Intent(context, AlarmReceiver.class);
                    intent.putExtra("id", id);
                    intent.putExtra("title", title);
                    intent.putExtra("message", message);
                    intent.putExtra("silent", isSilent);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags |= PendingIntent.FLAG_IMMUTABLE;
                    }
                    PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags);
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } catch (Exception ignored) {}
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void cancelDebtAlarm(int id) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(context, AlarmReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags);
            if (alarmManager != null) {
                alarmManager.cancel(pendingIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void showNotification(String title, String message) {
        showNotificationInternal(title, message, false);
    }

    private void showNotificationInternal(String title, String message, boolean isSilent) {
        try {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            int notifId = (int) (System.currentTimeMillis() % 1000000);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, notifId, intent, flags);

            String channelToUse = isSilent ? SILENT_CHANNEL_ID : CHANNEL_ID;
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelToUse)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            if (isSilent) {
                builder.setPriority(NotificationCompat.PRIORITY_DEFAULT)
                       .setSilent(true)
                       .setVibrate(null);
            } else {
                builder.setPriority(NotificationCompat.PRIORITY_HIGH)
                       .setDefaults(NotificationCompat.DEFAULT_ALL);
            }

            notificationManager.notify(notifId, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Tarih metnini (ISO, YYYY-MM-DD veya DD.MM.YYYY) milisaniyeye çevirir.
     */
    private long parseDateToMillis(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) return 0;
        try {
            String clean = dateStr.trim();
            if (clean.matches("^\\d+$")) {
                return Long.parseLong(clean);
            }
            if (clean.contains("T")) {
                SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault());
                Date date = isoFormat.parse(clean);
                if (date != null) return date.getTime();
            }
            if (clean.contains("-")) {
                String[] parts = clean.split("-");
                if (parts.length >= 3) {
                    int y = Integer.parseInt(parts[0]);
                    int m = Integer.parseInt(parts[1]) - 1;
                    int d = Integer.parseInt(parts[2].split(" ")[0]);
                    Calendar cal = Calendar.getInstance();
                    cal.set(y, m, d, 9, 30, 0);
                    cal.set(Calendar.MILLISECOND, 0);
                    return cal.getTimeInMillis();
                }
            }
            if (clean.contains(".")) {
                String[] parts = clean.split("\\.");
                if (parts.length >= 3) {
                    int d = Integer.parseInt(parts[0]);
                    int m = Integer.parseInt(parts[1]) - 1;
                    int y = Integer.parseInt(parts[2].split(" ")[0]);
                    Calendar cal = Calendar.getInstance();
                    cal.set(y, m, d, 9, 30, 0);
                    cal.set(Calendar.MILLISECOND, 0);
                    return cal.getTimeInMillis();
                }
            }
        } catch (Exception ignored) {}
        return 0;
    }

    /**
     * Tüm verileri donanıma kaydeder:
     * 1. Manuel alarmları kurar.
     * 2. Ödenmemiş tüm borçlar için (manuel hatırlatıcı olsun/olmasın) son ödeme tarihine
     *    3 gün kaladan son güne kadar her gün sabah 09:30'a otomatik yerel alarm kurar.
     * 3. Vadesi geçmiş ödenmemiş borçlar için gün içinde sessizce hatırlatma yapar (ayarlardaki sıklık kontrolüyle).
     */
    @JavascriptInterface
    public void syncAllData(String alarmsJson, String debtsJson, String installmentDebtsJson) {
        try {
            long now = System.currentTimeMillis();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String frequency = prefs.getString(KEY_FREQUENCY, "2");
            long periodMs = getPeriodMillisByFrequency(frequency);
            long lastNotifTime = prefs.getLong(KEY_LAST_NOTIF, 0);

            // 1. Manuel Alarmları Kur
            if (alarmsJson != null && !alarmsJson.trim().isEmpty()) {
                try {
                    JSONArray alarms = new JSONArray(alarmsJson);
                    for (int i = 0; i < alarms.length(); i++) {
                        JSONObject alarm = alarms.getJSONObject(i);
                        int id = alarm.optInt("id", i + 1);
                        String title = alarm.optString("title", "Ödeme Hatırlatması ⏰");
                        long timestamp = alarm.optLong("timestamp", 0);
                        if (timestamp == 0 && alarm.has("date")) {
                            timestamp = parseDateToMillis(alarm.getString("date"));
                        }

                        if (timestamp > now) {
                            setDebtAlarmInternal(id, title, timestamp, "Vadesi gelen ödemeniz: " + title, false);
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            // 2. Normal Borçları Tara (Son 3 gün kala + son gün + vadesi geçmiş kontrolü)
            if (debtsJson != null && !debtsJson.trim().isEmpty()) {
                try {
                    JSONArray debts = new JSONArray(debtsJson);
                    for (int i = 0; i < debts.length(); i++) {
                        JSONObject debt = debts.getJSONObject(i);
                        boolean isPaid = debt.optBoolean("isPaid", false) ||
                                         "odendi".equalsIgnoreCase(debt.optString("durum", "")) ||
                                         "paid".equalsIgnoreCase(debt.optString("status", "")) ||
                                         debt.optDouble("paid", 0) >= debt.optDouble("amount", 0);
                        if (isPaid) continue;

                        int debtId = debt.optInt("id", i + 100);
                        String debtName = debt.optString("name", "Borç Ödemesi");
                        double amount = debt.optDouble("amount", 0);
                        String dueDateStr = debt.optString("dueDate", "");
                        long dueTime = parseDateToMillis(dueDateStr);
                        if (dueTime == 0) continue;

                        // A. Gelecek Ödemeler: Son 3 günden son güne kadar her gün alarm kur
                        if (dueTime >= now) {
                            for (int dayOffset = 3; dayOffset >= 0; dayOffset--) {
                                Calendar cal = Calendar.getInstance();
                                cal.setTimeInMillis(dueTime);
                                cal.add(Calendar.DAY_OF_YEAR, -dayOffset);
                                cal.set(Calendar.HOUR_OF_DAY, 9);
                                cal.set(Calendar.MINUTE, 30);
                                cal.set(Calendar.SECOND, 0);
                                cal.set(Calendar.MILLISECOND, 0);

                                long triggerTime = cal.getTimeInMillis();
                                if (triggerTime > now) {
                                    int autoAlarmId = 100000 + (debtId * 10) + dayOffset;
                                    String alarmTitle = dayOffset == 0 
                                            ? "🚨 Son Ödeme Günü Bugün! (" + debtName + ")"
                                            : "⏰ Son " + dayOffset + " Gün Kaldı! (" + debtName + ")";
                                    String alarmMsg = debtName + " borcunuz için ödeme zamanı yaklaşıyor. Tutar: " + (int)amount + " TL";
                                    setDebtAlarmInternal(autoAlarmId, alarmTitle, triggerTime, alarmMsg, false);
                                }
                            }
                        } 
                        // B. Vadesi Geçmiş Borçlar: Gün içinde sessizce hatırlatmaya devam et (Sıklık kuralına göre)
                        else {
                            if (lastNotifTime == 0 || (now - lastNotifTime) >= periodMs) {
                                int overdueAlarmId = 500000 + debtId;
                                String overdueTitle = "⚠️ Vadesi Geçmiş Ödeme: " + debtName;
                                String overdueMsg = debtName + " borcunuzun vadesi geçmiştir. Faiz veya ceza oluşmaması için kontrol edin.";
                                setDebtAlarmInternal(overdueAlarmId, overdueTitle, now + 15000L, overdueMsg, true);
                                prefs.edit().putLong(KEY_LAST_NOTIF, now).apply();
                                lastNotifTime = now;
                            }
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            // 3. Taksitli Borçları Tara
            if (installmentDebtsJson != null && !installmentDebtsJson.trim().isEmpty()) {
                try {
                    JSONArray installments = new JSONArray(installmentDebtsJson);
                    for (int i = 0; i < installments.length(); i++) {
                        JSONObject inst = installments.getJSONObject(i);
                        int count = inst.optInt("installmentCount", 1);
                        int paidCount = inst.optInt("paidInstallmentCount", 0);
                        boolean isPaid = inst.optBoolean("isPaid", false) ||
                                         "odendi".equalsIgnoreCase(inst.optString("durum", "")) ||
                                         "paid".equalsIgnoreCase(inst.optString("status", "")) ||
                                         paidCount >= count;
                        if (isPaid) continue;

                        int instId = inst.optInt("id", i + 500);
                        String title = inst.optString("title", inst.optString("name", "Taksit"));
                        double total = inst.optDouble("totalAmount", 0);
                        double perInst = count > 0 ? (total / count) : 0;
                        String firstDue = inst.optString("firstDueDate", "");
                        long baseDue = parseDateToMillis(firstDue);
                        if (baseDue == 0) continue;

                        Calendar nextDueCal = Calendar.getInstance();
                        nextDueCal.setTimeInMillis(baseDue);
                        nextDueCal.add(Calendar.MONTH, paidCount);
                        long currentInstallmentDue = nextDueCal.getTimeInMillis();

                        String fullTitle = title + " (" + (paidCount + 1) + "/" + count + ". Taksit)";

                        if (currentInstallmentDue >= now) {
                            for (int dayOffset = 3; dayOffset >= 0; dayOffset--) {
                                Calendar cal = Calendar.getInstance();
                                cal.setTimeInMillis(currentInstallmentDue);
                                cal.add(Calendar.DAY_OF_YEAR, -dayOffset);
                                cal.set(Calendar.HOUR_OF_DAY, 9);
                                cal.set(Calendar.MINUTE, 30);
                                cal.set(Calendar.SECOND, 0);
                                cal.set(Calendar.MILLISECOND, 0);

                                long triggerTime = cal.getTimeInMillis();
                                if (triggerTime > now) {
                                    int autoInstId = 300000 + (instId * 10) + dayOffset;
                                    String alarmTitle = dayOffset == 0 
                                            ? "🚨 Taksit Günü Bugün! (" + fullTitle + ")"
                                            : "⏰ Taksite Son " + dayOffset + " Gün! (" + fullTitle + ")";
                                    String alarmMsg = fullTitle + " ödemesi için son gün yaklaştı. Tutar: " + (int)perInst + " TL";
                                    setDebtAlarmInternal(autoInstId, alarmTitle, triggerTime, alarmMsg, false);
                                }
                            }
                        } else {
                            if (lastNotifTime == 0 || (now - lastNotifTime) >= periodMs) {
                                int overdueInstId = 700000 + instId;
                                String overdueTitle = "⚠️ Geciken Taksit: " + fullTitle;
                                String overdueMsg = fullTitle + " taksit ödemenizin vadesi geçmiştir. Lütfen kontrol ediniz.";
                                setDebtAlarmInternal(overdueInstId, overdueTitle, now + 20000L, overdueMsg, true);
                                prefs.edit().putLong(KEY_LAST_NOTIF, now).apply();
                                lastNotifTime = now;
                            }
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void showToast(String message) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
    }

    /**
     * Alarm vakti geldiğinde çalışan ve CPU'yu uyanık tutarak (WakeLock) bildirimi garanti eden BroadcastReceiver
     */
    public static class AlarmReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            PowerManager.WakeLock wakeLock = null;
            try {
                if (powerManager != null) {
                    wakeLock = powerManager.newWakeLock(
                            PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                            "ButcemPro:AlarmWakeLock"
                    );
                    wakeLock.acquire(10 * 1000L); // 10 saniye CPU uyanık tutulur
                }

                int id = intent.getIntExtra("id", 1);
                String title = intent.getStringExtra("title");
                String message = intent.getStringExtra("message");
                boolean isSilent = intent.getBooleanExtra("silent", false);

                if (title == null) title = "Bütçem Pro Ödeme Hatırlatması ⏰";
                if (message == null) message = "Vadesi gelen borcunuz veya alarmınız bulunmaktadır!";

                NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager == null) return;

                Intent mainIntent = new Intent(context, MainActivity.class);
                mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getActivity(context, id, mainIntent, flags);

                String channelToUse = isSilent ? SILENT_CHANNEL_ID : CHANNEL_ID;
                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelToUse)
                        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                        .setContentTitle(title)
                        .setContentText(message)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent);

                if (isSilent) {
                    builder.setPriority(NotificationCompat.PRIORITY_DEFAULT)
                           .setSilent(true)
                           .setVibrate(null);
                } else {
                    builder.setPriority(NotificationCompat.PRIORITY_MAX)
                           .setCategory(NotificationCompat.CATEGORY_ALARM)
                           .setDefaults(NotificationCompat.DEFAULT_ALL);
                }

                notificationManager.notify(id, builder.build());
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                if (wakeLock != null && wakeLock.isHeld()) {
                    try {
                        wakeLock.release();
                    } catch (Exception ignored) {}
                }
            }
        }
    }
}

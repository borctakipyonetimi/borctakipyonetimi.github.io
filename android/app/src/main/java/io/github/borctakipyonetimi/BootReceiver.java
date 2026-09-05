package io.github.borctakipyonetimi;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * BootReceiver:
 * Telefon yeniden başlatıldığında (Boot Completed) tetiklenir.
 * SharedPreferences içinde kayıtlı tüm gelecekteki borç hatırlatıcılarını
 * AlarmManager'a tam zamanlı (exact alarm) olarak yeniden kurar.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";
    private static final String PREF_NAME = "borc_takip_alarms_store";
    private static final String KEY_SAVED_ALARMS = "saved_alarms_json";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.i(TAG, "Cihaz açıldı (Boot tamamlandı). Kayıtlı borç alarmları yeniden kuruluyor...");

            rescheduleAllAlarms(context);
        }
    }

    public static void rescheduleAllAlarms(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String rawJson = prefs.getString(KEY_SAVED_ALARMS, "[]");
            JSONArray array = new JSONArray(rawJson);

            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            long now = System.currentTimeMillis();
            JSONArray updatedArray = new JSONArray();
            int rescheduledCount = 0;

            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.getJSONObject(i);
                int id = item.getInt("id");
                String title = item.getString("title");
                String message = item.optString("message", "");
                long triggerAtMillis = item.getLong("triggerAtMillis");

                // Yalnızca vadesi henüz geçmemiş veya son 5 dakika içinde olan alarmları yeniden kur
                if (triggerAtMillis > now) {
                    Intent alarmIntent = new Intent(context, DebtAlarmReceiver.class);
                    alarmIntent.setAction("io.github.borctakipyonetimi.ACTION_DEBT_ALARM");
                    alarmIntent.putExtra(DebtAlarmReceiver.EXTRA_ALARM_ID, id);
                    alarmIntent.putExtra(DebtAlarmReceiver.EXTRA_TITLE, title);
                    alarmIntent.putExtra(DebtAlarmReceiver.EXTRA_MESSAGE, message);
                    alarmIntent.putExtra(DebtAlarmReceiver.EXTRA_TIMESTAMP, triggerAtMillis);

                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags |= PendingIntent.FLAG_IMMUTABLE;
                    }

                    PendingIntent pendingIntent = PendingIntent.getBroadcast(
                            context,
                            id,
                            alarmIntent,
                            flags
                    );

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(
                                AlarmManager.RTC_WAKEUP,
                                triggerAtMillis,
                                pendingIntent
                        );
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                        alarmManager.setExact(
                                AlarmManager.RTC_WAKEUP,
                                triggerAtMillis,
                                pendingIntent
                        );
                    } else {
                        alarmManager.set(
                                AlarmManager.RTC_WAKEUP,
                                triggerAtMillis,
                                pendingIntent
                        );
                    }

                    updatedArray.put(item);
                    rescheduledCount++;
                }
            }

            // Süresi geçmiş olanları temizleyip güncel listeyi kaydet
            prefs.edit().putString(KEY_SAVED_ALARMS, updatedArray.toString()).apply();
            Log.i(TAG, rescheduledCount + " adet borç alarmı telefon açılışında başarıyla yeniden kuruldu.");

            // Periyodik gecikmiş borç kontrolünü de yeniden planla
            MainActivity.schedulePeriodicOverdueDebtCheck(context);

        } catch (Exception e) {
            Log.e(TAG, "Alarmları yeniden kurarken hata oluştu:", e);
        }
    }
}

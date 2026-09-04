package io.github.borctakipyonetimi;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * DebtAlarmDismissReceiver:
 * Üst bildirim çekmecesindeki "Kapat" eylem butonuna tıklandığında
 * alarm sesini ve titreşimini anında susturur ve bildirimi kaldırır.
 */
public class DebtAlarmDismissReceiver extends BroadcastReceiver {
    public static final String ACTION_DISMISS = "io.github.borctakipyonetimi.ACTION_DISMISS_ALARM";

    @Override
    public void onReceive(Context context, Intent intent) {
        DebtAlarmReceiver.stopAlarmSound();
        int alarmId = intent.getIntExtra(DebtAlarmReceiver.EXTRA_ALARM_ID, 0);
        if (alarmId != 0) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(alarmId);
            }
        }
    }
}

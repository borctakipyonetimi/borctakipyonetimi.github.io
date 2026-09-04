package io.github.borctakipyonetimi;

import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/**
 * AlarmAlertActivity:
 * Telefon kilitliyken veya ekran tamamen kapalıyken AlarmManager tarafından
 * FullScreenIntent ile çağrılır. Ekranı aydınlatır (Turn screen on), kilit ekranı
 * üzerinde bildirim çekmecesinden aşağı inen acil uyarı penceresini görüntüler.
 */
public class AlarmAlertActivity extends AppCompatActivity {

    public static final String EXTRA_ALARM_ID = "extra_alarm_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_MESSAGE = "extra_message";

    private int alarmId;
    private final Handler autoDismissHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoDismissRunnable = this::dismissAlarm;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Ekranı açma ve kilit ekranı üzerinde gösterme bayrakları
        setupWindowFlags();

        super.onCreate(savedInstanceState);
        supportRequestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.activity_alarm_alert);

        alarmId = getIntent().getIntExtra(EXTRA_ALARM_ID, 0);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        String message = getIntent().getStringExtra(EXTRA_MESSAGE);

        TextView tvTitle = findViewById(R.id.tvAlarmTitle);
        TextView tvMessage = findViewById(R.id.tvAlarmMessage);
        Button btnOpenApp = findViewById(R.id.btnOpenApp);
        Button btnDismiss = findViewById(R.id.btnDismiss);

        if (title != null && !title.trim().isEmpty()) {
            tvTitle.setText(title);
        }
        if (message != null && !message.trim().isEmpty()) {
            tvMessage.setText(message);
        }

        // Ödemeyi Gör butonu -> MainActivity'ye yönlendir
        btnOpenApp.setOnClickListener(v -> {
            stopSoundAndNotification();
            Intent mainIntent = new Intent(AlarmAlertActivity.this, MainActivity.class);
            mainIntent.putExtra("NAVIGATE_TO", "debts");
            mainIntent.putExtra("ALARM_ID", alarmId);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(mainIntent);
            finish();
        });

        // Kapat butonu -> Sesi durdur, bildirimi temizle ve kapat
        btnDismiss.setOnClickListener(v -> dismissAlarm());

        // 60 saniye sonra otomatik olarak uyarının sesini ve penceresini sonlandır
        autoDismissHandler.postDelayed(autoDismissRunnable, 60 * 1000L);
    }

    private void setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
    }

    private void stopSoundAndNotification() {
        // Çalan alarm sesini durdur
        DebtAlarmReceiver.stopAlarmSound();

        // Bildirim çekmecesindeki bildirimi temizle
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && alarmId != 0) {
                nm.cancel(alarmId);
            }
        } catch (Exception ignored) {}
    }

    private void dismissAlarm() {
        stopSoundAndNotification();
        finish();
    }

    @Override
    protected void onDestroy() {
        autoDismissHandler.removeCallbacks(autoDismissRunnable);
        DebtAlarmReceiver.stopAlarmSound();
        super.onDestroy();
    }
}

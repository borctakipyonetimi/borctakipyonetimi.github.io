package io.github.borctakipyonetimi;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * MainActivity:
 * https://borctakipyonetimi.github.io sitesini modern WebView içinde render eder.
 * JavaScript köprüsü (window.AndroidAlarm) üzerinden gelen borç hatırlatma taleplerini
 * doğrudan Android sistem AlarmManager servisine bağlar.
 */
public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private static final String DEFAULT_URL = "https://borctakipyonetimi.github.io";
    private static final int PERMISSION_REQUEST_CODE_NOTIFICATIONS = 101;
    private static final int PERMISSION_REQUEST_CODE_EXACT_ALARM = 102;

    public static final String PREF_NAME = "borc_takip_alarms_store";
    public static final String KEY_SAVED_ALARMS = "saved_alarms_json";

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        // 1. Android 13+ Bildirim İzni İsteme (POST_NOTIFICATIONS)
        requestNotificationPermissionIfNeeded();

        // 2. Android 12+ Tam Zamanlı Alarm İzni Kontrolü
        checkExactAlarmPermission();

        // 3. WebView ve JavaScript Yapılandırması
        configureWebView();

        // 4. JavaScript Köprüsünü (AndroidAlarm) Enjekte Et
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidAlarm");

        // 5. Hedef URL'yi yükle
        if (savedInstanceState == null) {
            webView.loadUrl(DEFAULT_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    /**
     * WebView ayarlarını optimize eder, JavaScript ve yerel depolama özelliklerini etkinleştirir.
     */
    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // Özel UserAgent etiketi ile sitenin Android APK içinde çalıştığını anlamasını sağlar
        String originalUA = settings.getUserAgentString();
        settings.setUserAgentString(originalUA + " BorcTakipApp/1.0 (Android; WebView; AlarmBridge)");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (progressBar != null) progressBar.setVisibility(View.VISIBLE);
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (progressBar != null) progressBar.setVisibility(View.GONE);
                super.onPageFinished(view, url);
                Log.d(TAG, "WebView sayfası yüklendi: " + url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                Log.w(TAG, "WebView kaynak hatası: " + error.toString());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar != null) {
                    progressBar.setProgress(newProgress);
                    if (newProgress >= 100) {
                        progressBar.setVisibility(View.GONE);
                    } else {
                        progressBar.setVisibility(View.VISIBLE);
                    }
                }
                super.onProgressChanged(view, newProgress);
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d("WebConsole", consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return super.onConsoleMessage(consoleMessage);
            }
        });
    }

    /**
     * Android 13+ (API 33+) için bildirim iznini çalışma zamanında kullanıcıdan talep eder.
     */
    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        PERMISSION_REQUEST_CODE_NOTIFICATIONS
                );
            }
        }
    }

    /**
     * Android 12+ (API 31+) için AlarmManager tam zamanlı alarm (exact alarm) iznini doğrular.
     */
    private void checkExactAlarmPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                Log.w(TAG, "SCHEDULE_EXACT_ALARM izni eksik, kullanıcı ayarlar sayfasına yönlendirilebilir.");
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE_NOTIFICATIONS) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "✅ Borç bildirim ve alarm izinleri onaylandı!", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "⚠️ Bildirim izni verilmediğinde telefon kapalıyken uyarı alamazsınız.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    // =========================================================================
    // JAVASCRIPT KÖPRÜSÜ (JavaScript Interface -> window.AndroidAlarm)
    // =========================================================================

    public class WebAppInterface {
        private final Context mContext;

        WebAppInterface(Context context) {
            this.mContext = context;
        }

        /**
         * Web uygulamasından tam parametrelerle çağrılan ana borç alarm kurma fonksiyonu.
         * window.AndroidAlarm.setDebtAlarm(id, title, triggerAtMillis, message)
         */
        @JavascriptInterface
        public void setDebtAlarm(int id, String title, long triggerAtMillis, String message) {
            scheduleAlarmInternal(id, title, triggerAtMillis, message);
        }

        /**
         * Aşırı yüklenmiş (overloaded) metod: Basit çağrılar için.
         * window.AndroidAlarm.setDebtAlarm(title, triggerAtMillis)
         */
        @JavascriptInterface
        public void setDebtAlarm(String title, long triggerAtMillis) {
            int generatedId = (int) (triggerAtMillis % 10000000);
            String message = "Vadesi gelen borcunuz: " + title;
            scheduleAlarmInternal(generatedId, title, triggerAtMillis, message);
        }

        /**
         * Aşırı yüklenmiş (overloaded) metod: id, title, triggerAtMillis
         */
        @JavascriptInterface
        public void setDebtAlarm(int id, String title, long triggerAtMillis) {
            String message = "Vadesi gelen borcunuz: " + title;
            scheduleAlarmInternal(id, title, triggerAtMillis, message);
        }

        /**
         * Kurulmuş bir borç alarmını iptal eder.
         * window.AndroidAlarm.cancelDebtAlarm(id)
         */
        @JavascriptInterface
        public void cancelDebtAlarm(int id) {
            try {
                AlarmManager alarmManager = (AlarmManager) mContext.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    Intent intent = new Intent(mContext, DebtAlarmReceiver.class);
                    intent.setAction("io.github.borctakipyonetimi.ACTION_DEBT_ALARM");

                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags |= PendingIntent.FLAG_IMMUTABLE;
                    }

                    PendingIntent pendingIntent = PendingIntent.getBroadcast(
                            mContext,
                            id,
                            intent,
                            flags
                    );

                    alarmManager.cancel(pendingIntent);
                    removeAlarmFromPreferences(id);
                    Log.i(TAG, "Borç alarmı AlarmManager'dan iptal edildi. ID: " + id);
                }
            } catch (Exception e) {
                Log.e(TAG, "cancelDebtAlarm hatası:", e);
            }
        }

        /**
         * JavaScript köprüsünün aktif olup olmadığını test etmek için kullanılır.
         * window.AndroidAlarm.isAvailable() -> true
         */
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        /**
         * Android yerel Toast mesajı göstermek için yardımcı fonksiyon.
         */
        @JavascriptInterface
        public void showToast(final String message) {
            runOnUiThread(() -> Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show());
        }

        /**
         * AlarmManager ile tam zamanlı (exact alarm / setExactAndAllowWhileIdle) kurma motoru.
         */
        private void scheduleAlarmInternal(int id, String title, long triggerAtMillis, String message) {
            try {
                long now = System.currentTimeMillis();
                if (triggerAtMillis <= now) {
                    Log.w(TAG, "Geçmiş bir zamana alarm kurulamaz. Trigger: " + triggerAtMillis + ", Now: " + now);
                    return;
                }

                AlarmManager alarmManager = (AlarmManager) mContext.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager == null) {
                    Log.e(TAG, "AlarmManager servisi bulunamadı!");
                    return;
                }

                Intent intent = new Intent(mContext, DebtAlarmReceiver.class);
                intent.setAction("io.github.borctakipyonetimi.ACTION_DEBT_ALARM");
                intent.putExtra(DebtAlarmReceiver.EXTRA_ALARM_ID, id);
                intent.putExtra(DebtAlarmReceiver.EXTRA_TITLE, title);
                intent.putExtra(DebtAlarmReceiver.EXTRA_MESSAGE, message);
                intent.putExtra(DebtAlarmReceiver.EXTRA_TIMESTAMP, triggerAtMillis);

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }

                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        mContext,
                        id,
                        intent,
                        flags
                );

                // Android sürümüne göre en hassas ve telefon uykudayken (Doze) uyandıracak metodu seç
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

                // Cihaz yeniden başlatıldığında kaybolmaması için SharedPreferences'a kaydet
                saveAlarmToPreferences(id, title, message, triggerAtMillis);

                Log.i(TAG, "Tam zamanlı borç alarmı kuruldu! ID: " + id + ", Başlık: " + title + ", Zaman: " + triggerAtMillis);

                runOnUiThread(() -> {
                    Toast.makeText(mContext, "⏰ Alarm Kuruldu: " + title, Toast.LENGTH_SHORT).show();
                });

            } catch (SecurityException se) {
                Log.e(TAG, "AlarmManager güvenlik hatası (Exact Alarm izni gerekiyor olabilir):", se);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    try {
                        Intent settingsIntent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                        settingsIntent.setData(Uri.parse("package:" + mContext.getPackageName()));
                        settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        mContext.startActivity(settingsIntent);
                    } catch (Exception e) {
                        Log.e(TAG, "Exact alarm ayarları açılamadı:", e);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "AlarmManager kurma hatası:", e);
            }
        }

        private void saveAlarmToPreferences(int id, String title, String message, long triggerAtMillis) {
            try {
                SharedPreferences prefs = mContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                String raw = prefs.getString(KEY_SAVED_ALARMS, "[]");
                JSONArray array = new JSONArray(raw);

                // Mevcut aynı ID'li alarm varsa güncelle, yoksa ekle
                JSONArray updated = new JSONArray();
                for (int i = 0; i < array.length(); i++) {
                    JSONObject obj = array.getJSONObject(i);
                    if (obj.getInt("id") != id) {
                        updated.put(obj);
                    }
                }

                JSONObject newAlarm = new JSONObject();
                newAlarm.put("id", id);
                newAlarm.put("title", title);
                newAlarm.put("message", message);
                newAlarm.put("triggerAtMillis", triggerAtMillis);
                updated.put(newAlarm);

                prefs.edit().putString(KEY_SAVED_ALARMS, updated.toString()).apply();
            } catch (Exception e) {
                Log.e(TAG, "saveAlarmToPreferences hatası:", e);
            }
        }

        private void removeAlarmFromPreferences(int id) {
            try {
                SharedPreferences prefs = mContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                String raw = prefs.getString(KEY_SAVED_ALARMS, "[]");
                JSONArray array = new JSONArray(raw);
                JSONArray updated = new JSONArray();

                for (int i = 0; i < array.length(); i++) {
                    JSONObject obj = array.getJSONObject(i);
                    if (obj.getInt("id") != id) {
                        updated.put(obj);
                    }
                }

                prefs.edit().putString(KEY_SAVED_ALARMS, updated.toString()).apply();
            } catch (Exception e) {
                Log.e(TAG, "removeAlarmFromPreferences hatası:", e);
            }
        }
    }
}

package io.github.borctakipyonetimi;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.NotificationManager;
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
import android.view.WindowManager;
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
import android.app.Notification;
import android.media.RingtoneManager;
import android.app.DownloadManager;
import android.os.Environment;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import androidx.core.content.FileProvider;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.ContentResolver;
import android.content.pm.ResolveInfo;
import android.provider.MediaStore;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
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
    public static final String KEY_SAVED_DEBTS = "saved_debts_json";
    public static final String KEY_SAVED_INSTALLMENTS = "saved_installments_json";
    public static final String ACTION_CHECK_OVERDUE_DEBTS = "io.github.borctakipyonetimi.ACTION_CHECK_OVERDUE_DEBTS";
    public static final int PERIODIC_CHECK_ALARM_ID = 999999;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setupWindowFlags();
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        handleIncomingAlarmIntent(getIntent());

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        // 1. Android 13+ Bildirim İzni İsteme (POST_NOTIFICATIONS)
        requestNotificationPermissionIfNeeded();

        // Bildirim kanalını başlat
        DebtAlarmReceiver.createNotificationChannel(this);

        // 2. Android 12+ Tam Zamanlı Alarm İzni Kontrolü
        checkExactAlarmPermission();

        // 3. Arka plan gecikmiş borç periyodik kontrol motorunu başlat (Uygulama kapalıyken bile çalışır)
        schedulePeriodicOverdueDebtCheck(this);

        // 4. WebView ve JavaScript Yapılandırması
        configureWebView();

        // 5. JavaScript Köprüsünü (AndroidAlarm & Android) Enjekte Et
        WebAppInterface webAppInterface = new WebAppInterface(this);
        webView.addJavascriptInterface(webAppInterface, "AndroidAlarm");
        webView.addJavascriptInterface(webAppInterface, "Android");

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
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    return handleExternalUrls(request.getUrl().toString());
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrls(url);
            }

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

        // Dosya İndirme Yöneticisi (DownloadListener): Web üzerinden inen dosyaların adını asla 'download.json' veya bozuk yapmaz
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                try {
                    // Blob veya Data URL yakalanırsa (JavaScript link.click sonucu)
                    if (url != null && (url.startsWith("blob:") || url.startsWith("data:"))) {
                        Log.d(TAG, "Blob/Data URL indirmesi yakalandı: " + url.substring(0, Math.min(30, url.length())));
                        // WebAppInterface zaten JavaScript katmanından doğrudan çağrıldığı için
                        // yine de indirme uyarısı verip kullanıcıyı bilgilendiriyoruz.
                        return;
                    }

                    String extractedName = null;

                    // 1. Content-Disposition başlığından dosya adını regex ile çıkar (UTF-8 ve standart formatlar)
                    if (contentDisposition != null && !contentDisposition.trim().isEmpty()) {
                        try {
                            Matcher m = Pattern.compile("filename\\*?=['\"]?(?:UTF-8'')?([^;'\"]+)", Pattern.CASE_INSENSITIVE).matcher(contentDisposition);
                            if (m.find()) {
                                extractedName = java.net.URLDecoder.decode(m.group(1).trim(), "UTF-8");
                            }
                        } catch (Exception ignored) {}
                    }

                    // 2. URL Query veya Path parametresinden dosya adını çıkar (?filename=xxx veya /api/download-temp/xxx)
                    if (extractedName == null || extractedName.equalsIgnoreCase("json") || extractedName.equalsIgnoreCase("downloadfile.bin") || extractedName.startsWith("download")) {
                        try {
                            Uri parsedUri = Uri.parse(url);
                            String qName = parsedUri.getQueryParameter("filename");
                            if (qName != null && !qName.trim().isEmpty()) {
                                extractedName = qName.trim();
                            } else {
                                String lastSegment = parsedUri.getLastPathSegment();
                                if (lastSegment != null && lastSegment.contains(".") && !lastSegment.equalsIgnoreCase("download-temp")) {
                                    extractedName = lastSegment;
                                }
                            }
                        } catch (Exception ignored) {}
                    }

                    // 3. Fallback: URLUtil.guessFileName
                    if (extractedName == null || extractedName.equalsIgnoreCase("json") || extractedName.equalsIgnoreCase("downloadfile.bin") || extractedName.startsWith("download")) {
                        extractedName = URLUtil.guessFileName(url, contentDisposition, mimetype);
                    }

                    // 4. Hâlâ generic 'json' veya 'download' ise düzgün zaman damgalı isim üret
                    if (extractedName == null || extractedName.equalsIgnoreCase("json") || extractedName.equalsIgnoreCase("json.json") ||
                        extractedName.equalsIgnoreCase("downloadfile.bin") || extractedName.startsWith("download-temp") || extractedName.startsWith("download.")) {
                        String dateStr = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(new java.util.Date());
                        String ext = (mimetype != null && mimetype.contains("csv")) ? ".csv" : ".json";
                        extractedName = "butcem_pro_rapor_" + dateStr + ext;
                    }

                    final String finalName = extractedName;

                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    String safeMime = (mimetype != null && !mimetype.isEmpty()) ? mimetype : "application/json";
                    request.setMimeType(safeMime);
                    request.setDescription("Bütçem Pro: " + finalName);
                    request.setTitle(finalName);
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, finalName);
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                        Toast.makeText(MainActivity.this, "📥 İndiriliyor: " + finalName, Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Log.e(TAG, "DownloadListener hatası:", e);
                }
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
     * Google Drive, WhatsApp, Telegram, telefon, e-posta veya sistem tarayıcısı
     * gerektiren harici URL'leri güvenle yakalar. WebView'ın çökmesini veya kapanmasını engeller.
     */
    private boolean handleExternalUrls(String url) {
        if (url == null || url.trim().isEmpty()) return false;

        // 1. Google Drive Linkleri: Uygulama varsa doğrudan Google Drive uygulamasında aç, yoksa güvenli tarayıcıda aç
        if (url.contains("drive.google.com") || url.contains("docs.google.com")) {
            try {
                Intent driveIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                driveIntent.setPackage("com.google.android.apps.docs");
                driveIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(driveIntent);
                return true;
            } catch (Exception e) {
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(browserIntent);
                    return true;
                } catch (Exception ex) {
                    Log.e(TAG, "Google Drive açılamadı:", ex);
                    Toast.makeText(this, "Google Drive açılamadı", Toast.LENGTH_SHORT).show();
                    return true;
                }
            }
        }

        // 2. Özel Intent Şemaları (intent://)
        if (url.startsWith("intent://")) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    if (intent.resolveActivity(getPackageManager()) != null) {
                        startActivity(intent);
                        return true;
                    }
                    String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                    if (fallbackUrl != null) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)));
                        return true;
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "intent:// ayrıştırılamadı:", e);
            }
            return true;
        }

        // 3. WhatsApp Doğrudan Linkleri
        if (url.startsWith("whatsapp://") || url.startsWith("https://wa.me/") || url.startsWith("https://api.whatsapp.com/")) {
            try {
                Intent waIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                waIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(waIntent);
                return true;
            } catch (Exception e) {
                Toast.makeText(this, "WhatsApp uygulaması bulunamadı", Toast.LENGTH_SHORT).show();
                return true;
            }
        }

        // 4. Sistem Şemaları (tel, mailto, market, geo)
        if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("market://") || url.startsWith("geo:")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                Log.e(TAG, "Harici eylem açılamadı:", e);
                return true;
            }
        }

        // 5. Harici Web Siteleri (Borç Takip sitesi harici)
        if (!url.contains("borctakipyonetimi.github.io") && !url.contains("localhost") && !url.contains("127.0.0.1") && (url.startsWith("http://") || url.startsWith("https://"))) {
            if (!url.contains("/api/download-temp")) {
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(browserIntent);
                    return true;
                } catch (Exception ignored) {}
            }
        }

        return false;
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
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingAlarmIntent(intent);
    }

    private void handleIncomingAlarmIntent(Intent intent) {
        if (intent != null) {
            DebtAlarmReceiver.stopAlarmSound();
            int alarmId = intent.getIntExtra("ALARM_ID", 0);
            if (alarmId != 0) {
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) {
                        nm.cancel(alarmId);
                    }
                } catch (Exception ignored) {}
            }
        }
    }

    private void setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
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

    /**
     * Arka planda uygulama kapalıyken veya ekran kilitliyken bile düzenli aralıklarla
     * gecikmiş borçları ve vadeleri denetleyen sistem alarmını kurar.
     */
    public static void schedulePeriodicOverdueDebtCheck(Context context) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, DebtAlarmReceiver.class);
            intent.setAction(ACTION_CHECK_OVERDUE_DEBTS);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    PERIODIC_CHECK_ALARM_ID,
                    intent,
                    flags
            );

            // Her 4 saatte bir kontrol et
            long interval = 4 * 60 * 60 * 1000L;
            long triggerAt = System.currentTimeMillis() + interval;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            }
            Log.i(TAG, "Periyodik gecikmiş borç kontrol alarmı ayarlandı. Sonraki: " + new java.util.Date(triggerAt));
        } catch (Exception e) {
            Log.e(TAG, "schedulePeriodicOverdueDebtCheck hatası:", e);
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
         * Web uygulamasından tüm borç, taksit ve alarmları tek seferde Android cihazın SharedPreferences
         * ve AlarmManager bileşenine yazar. Uygulama kapalıyken bile alarmların ve gecikmiş borç bildirimlerinin
         * donanım seviyesinde gelmesini garanti eder.
         */
        @JavascriptInterface
        public void syncAllData(final String alarmsJson, final String debtsJson, final String installmentDebtsJson) {
            try {
                SharedPreferences prefs = mContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                        .putString(KEY_SAVED_ALARMS, alarmsJson != null ? alarmsJson : "[]")
                        .putString(KEY_SAVED_DEBTS, debtsJson != null ? debtsJson : "[]")
                        .putString(KEY_SAVED_INSTALLMENTS, installmentDebtsJson != null ? installmentDebtsJson : "[]")
                        .apply();

                Log.i(TAG, "Tüm veriler (alarmlar, borçlar, taksitler) Android SharedPreferences'a senkronize edildi.");

                // 1. Borçların vadelerini AlarmManager'a planla
                if (debtsJson != null && !debtsJson.trim().isEmpty()) {
                    try {
                        JSONArray debtsArr = new JSONArray(debtsJson);
                        long now = System.currentTimeMillis();
                        for (int i = 0; i < debtsArr.length(); i++) {
                            JSONObject d = debtsArr.getJSONObject(i);
                            if (!d.optBoolean("isPaid", false) && d.has("dueDate")) {
                                String dueStr = d.optString("dueDate", "");
                                long triggerTime = DebtAlarmReceiver.parseDateTimeFlexible(dueStr);
                                if (triggerTime > now) {
                                    int debtAlarmId = 2000000 + d.optInt("id", i + 1);
                                    String debtTitle = "Ödeme Vadesi: " + d.optString("name", "Borç");
                                    String debtMsg = d.optString("name", "Borç") + " için son ödeme günü geldi. Tutar: ₺" + d.optDouble("amount", 0);
                                    scheduleAlarmInternal(debtAlarmId, debtTitle, triggerTime, debtMsg);
                                }
                            }
                        }
                    } catch (Exception err) {
                        Log.e(TAG, "Borç vadelerini AlarmManager'a aktarma hatası:", err);
                    }
                }

                // 2. Alarmları AlarmManager'a planla
                if (alarmsJson != null && !alarmsJson.trim().isEmpty()) {
                    try {
                        JSONArray alarmsArr = new JSONArray(alarmsJson);
                        long now = System.currentTimeMillis();
                        for (int i = 0; i < alarmsArr.length(); i++) {
                            JSONObject a = alarmsArr.getJSONObject(i);
                            long triggerTime = a.optLong("timestamp", 0);
                            if (triggerTime == 0 && a.has("date")) {
                                triggerTime = DebtAlarmReceiver.parseDateTimeFlexible(a.optString("date", ""));
                            }
                            if (triggerTime > now) {
                                int alarmId = a.optInt("id", (int) (triggerTime % 1000000));
                                String title = a.optString("title", "Ödeme Hatırlatıcısı");
                                String msg = a.optString("message", "Vadesi gelen ödeme: " + title);
                                scheduleAlarmInternal(alarmId, title, triggerTime, msg);
                            }
                        }
                    } catch (Exception err) {
                        Log.e(TAG, "Alarmları AlarmManager'a aktarma hatası:", err);
                    }
                }

                // 3. Periyodik kontrolü yenile
                schedulePeriodicOverdueDebtCheck(mContext);

            } catch (Exception e) {
                Log.e(TAG, "syncAllData genel hatası:", e);
            }
        }

        /**
         * Test için: Belirtilen saniye sonra (ör. 5 sn sonra ekran kapalıyken)
         * donanım alarmını çaldırıp ekranı aydınlatır ve bildirim gönderir.
         */
        @JavascriptInterface
        public void testDelayedNotification(final int delaySeconds) {
            int safeDelay = delaySeconds > 0 ? delaySeconds : 5;
            long triggerAt = System.currentTimeMillis() + (safeDelay * 1000L);
            scheduleAlarmInternal(777777, "🔔 Test Uyarısı (Ekran Kapalı/Açık)", triggerAt,
                    "Bu test bildirimi cihaz kilitliyken/ekran kapalıyken tam zamanlı olarak başarıyla teslim edilmiştir!");
            runOnUiThread(() -> Toast.makeText(mContext, "⏰ Test alarmı " + safeDelay + " saniye sonraya kuruldu. Ekranınızı kilitleyebilirsiniz!", Toast.LENGTH_LONG).show());
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
         * Web uygulamasından doğrudan üst bildirim çekmecesine anlık bildirim gönderme köprüsü.
         * window.AndroidAlarm.showNotification(title, message)
         */
        @JavascriptInterface
        public void showNotification(final String title, final String message) {
            runOnUiThread(() -> {
                try {
                    DebtAlarmReceiver.createNotificationChannel(mContext);

                    Intent openIntent = new Intent(mContext, MainActivity.class);
                    openIntent.putExtra("NAVIGATE_TO", "debts");
                    openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                    int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
                    }

                    int notifId = (int) (System.currentTimeMillis() % 1000000);
                    PendingIntent contentPendingIntent = PendingIntent.getActivity(
                            mContext,
                            notifId,
                            openIntent,
                            pendingFlags
                    );

                    int smallIconId = R.drawable.ic_stat_alarm;
                    if (smallIconId == 0) {
                        smallIconId = mContext.getApplicationInfo().icon;
                    }
                    if (smallIconId == 0) {
                        smallIconId = android.R.drawable.ic_dialog_info;
                    }

                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

                    NotificationCompat.Builder builder = new NotificationCompat.Builder(mContext, DebtAlarmReceiver.CHANNEL_ID)
                            .setSmallIcon(smallIconId)
                            .setContentTitle(title)
                            .setContentText(message)
                            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                            .setPriority(NotificationCompat.PRIORITY_MAX)
                            .setCategory(NotificationCompat.CATEGORY_ALARM)
                            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                            .setContentIntent(contentPendingIntent)
                            .setAutoCancel(true)
                            .setOngoing(false)
                            .setDefaults(NotificationCompat.DEFAULT_ALL)
                            .setSound(soundUri)
                            .addAction(0, "Ödemeyi Gör", contentPendingIntent);

                    Notification notification = builder.build();
                    NotificationManagerCompat.from(mContext).notify(notifId, notification);
                    Log.i(TAG, "WebAppInterface.showNotification üst bildirim çekmecesine verildi: " + title);
                } catch (Exception e) {
                    Log.e(TAG, "WebAppInterface.showNotification hatası:", e);
                }
            });
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

        /**
         * Web uygulamasında kullanıcının belirlediği isimle dosyayı Android İndirilenler (Downloads)
         * klasörüne doğrudan kaydeder. Dosya adı asla generic 'json' veya 'download.json' olmaz!
         */
        @JavascriptInterface
        public boolean saveFile(final String fileName, final String content, final String mimeType) {
            try {
                if (content == null) {
                    runOnUiThread(() -> Toast.makeText(mContext, "Kaydedilecek dosya içeriği boş!", Toast.LENGTH_SHORT).show());
                    return false;
                }

                String cleanName = (fileName != null && !fileName.trim().isEmpty()) ? fileName.trim() : "butcem_pro_dosya";
                String safeMime = (mimeType != null && !mimeType.trim().isEmpty()) ? mimeType.trim() : "application/json";

                // Eğer uzantı yoksa mime türüne göre uzantı ekle
                if (!cleanName.contains(".")) {
                    if (safeMime.contains("csv")) cleanName += ".csv";
                    else if (safeMime.contains("html")) cleanName += ".html";
                    else if (safeMime.contains("eml")) cleanName += ".eml";
                    else if (safeMime.contains("text")) cleanName += ".txt";
                    else cleanName += ".json";
                }

                final String finalFileName = cleanName;
                boolean savedSuccessfully = false;

                // 1. Android 10+ (API 29+) MediaStore API ile İndirilenler klasörüne kaydetme
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, finalFileName);
                        values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        values.put(MediaStore.Downloads.IS_PENDING, 1);

                        ContentResolver resolver = mContext.getContentResolver();
                        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                        if (uri != null) {
                            try (OutputStream out = resolver.openOutputStream(uri)) {
                                if (out != null) {
                                    out.write(content.getBytes(StandardCharsets.UTF_8));
                                    out.flush();
                                }
                            }
                            values.clear();
                            values.put(MediaStore.Downloads.IS_PENDING, 0);
                            resolver.update(uri, values, null, null);
                            savedSuccessfully = true;
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "MediaStore ile indirme başarısız, doğrudan File fallback deneniyor:", e);
                    }
                }

                // 2. Klasik Dosya Sistemi Fallback (API <= 28 veya MediaStore hatasında)
                if (!savedSuccessfully) {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }

                    File targetFile = new File(downloadsDir, finalFileName);
                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(content.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                    }

                    // Sistem medya tarayıcısına bildir ki Dosyalarım/İndirilenler klasöründe anında listelensin
                    try {
                        android.media.MediaScannerConnection.scanFile(
                                mContext,
                                new String[]{targetFile.getAbsolutePath()},
                                new String[]{safeMime},
                                null
                        );
                    } catch (Exception ignored) {}
                    savedSuccessfully = true;
                }

                showNotification("📁 Dosya İndirildi", finalFileName + " İndirilenler klasörüne kaydedildi.");
                runOnUiThread(() -> Toast.makeText(mContext, "✅ '" + finalFileName + "' İndirilenler klasörüne başarıyla kaydedildi!", Toast.LENGTH_LONG).show());
                Log.i(TAG, "Dosya başarıyla kaydedildi: " + finalFileName);
                return true;

            } catch (Exception e) {
                Log.e(TAG, "saveFile hatası:", e);
                runOnUiThread(() -> Toast.makeText(mContext, "❌ Dosya kaydedilemedi: " + e.getMessage(), Toast.LENGTH_LONG).show());
                return false;
            }
        }

        /**
         * Geriye dönük uyumluluk için saveBackupFile
         */
        @JavascriptInterface
        public boolean saveBackupFile(final String fileName, final String jsonContent) {
            return saveFile(fileName, jsonContent, "application/json");
        }

        /**
         * Resim, Dekont ve Fotoğrafları doğrudan Galeri / Pictures klasörüne kaydeder
         */
        @JavascriptInterface
        public boolean saveImageToGallery(final String fileName, final String base64Data, final String mimeType) {
            try {
                if (base64Data == null || base64Data.trim().isEmpty()) {
                    runOnUiThread(() -> Toast.makeText(mContext, "Kaydedilecek resim verisi boş!", Toast.LENGTH_SHORT).show());
                    return false;
                }

                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                byte[] imageBytes = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT);

                String cleanName = (fileName != null && !fileName.trim().isEmpty()) ? fileName.trim() : ("butcem_resim_" + System.currentTimeMillis() + ".jpg");
                if (!cleanName.contains(".")) {
                    cleanName += ".jpg";
                }
                final String finalFileName = cleanName;
                String safeMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "image/jpeg";
                boolean saved = false;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Images.Media.DISPLAY_NAME, finalFileName);
                        values.put(MediaStore.Images.Media.MIME_TYPE, safeMime);
                        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ButcemPro");
                        values.put(MediaStore.Images.Media.IS_PENDING, 1);

                        ContentResolver resolver = mContext.getContentResolver();
                        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            try (OutputStream out = resolver.openOutputStream(uri)) {
                                if (out != null) {
                                    out.write(imageBytes);
                                    out.flush();
                                }
                            }
                            values.clear();
                            values.put(MediaStore.Images.Media.IS_PENDING, 0);
                            resolver.update(uri, values, null, null);
                            saved = true;
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "MediaStore image save error:", e);
                    }
                }

                if (!saved) {
                    File picturesDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "ButcemPro");
                    if (!picturesDir.exists()) {
                        picturesDir.mkdirs();
                    }
                    File targetFile = new File(picturesDir, finalFileName);
                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(imageBytes);
                        fos.flush();
                    }
                    try {
                        android.media.MediaScannerConnection.scanFile(
                                mContext,
                                new String[]{targetFile.getAbsolutePath()},
                                new String[]{safeMime},
                                null
                        );
                    } catch (Exception ignored) {}
                    saved = true;
                }

                showNotification("🖼️ Resim Galeriye Kaydedildi", finalFileName + " Galeriye eklendi.");
                runOnUiThread(() -> Toast.makeText(mContext, "🖼️ '" + finalFileName + "' Galeriye başarıyla kaydedildi!", Toast.LENGTH_LONG).show());
                return true;

            } catch (Exception e) {
                Log.e(TAG, "saveImageToGallery hatası:", e);
                runOnUiThread(() -> Toast.makeText(mContext, "❌ Resim kaydedilemedi: " + e.getMessage(), Toast.LENGTH_LONG).show());
                return false;
            }
        }

        /**
         * Cihaz Paylaşım Menüsünü (Android Native Intent.ACTION_SEND Chooser) açar.
         * Bluetooth, Quick Share (Nearby Share / Wi-Fi Direct), WhatsApp, Google Drive ('Drive'a Kaydet'),
         * Telegram, Gmail, Xiaomi/Samsung Share ve Dosyalarım gibi TÜM paylaşım hedeflerini anında listeler.
         */
        @JavascriptInterface
        public void shareBackupFile(final String fileName, final String jsonContent, final String title) {
            runOnUiThread(() -> {
                try {
                    if (jsonContent == null) {
                        Toast.makeText(mContext, "Paylaşılacak yedek içeriği boş!", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    String cleanName = (fileName != null && !fileName.trim().isEmpty()) ? fileName.trim() : "butcem_pro_yedek";
                    if (!cleanName.toLowerCase().endsWith(".json")) {
                        cleanName += ".json";
                    }

                    File shareFolder = new File(mContext.getCacheDir(), "shared_backups");
                    if (!shareFolder.exists()) {
                        shareFolder.mkdirs();
                    }

                    File shareFile = new File(shareFolder, cleanName);
                    try (FileOutputStream fos = new FileOutputStream(shareFile)) {
                        fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                    }

                    Uri contentUri = FileProvider.getUriForFile(
                            mContext,
                            mContext.getPackageName() + ".fileprovider",
                            shareFile
                    );

                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    // '*/*' MIME türü Bluetooth, Wi-Fi Paylaşımı, Quick Share ve tüm sistem servislerini tetikler
                    shareIntent.setType("*/*");
                    shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    String safeTitle = (title != null && !title.trim().isEmpty()) ? title : "Bütçem Veri Yedeği";
                    shareIntent.putExtra(Intent.EXTRA_SUBJECT, safeTitle);
                    shareIntent.putExtra(Intent.EXTRA_TEXT, "Bütçem Pro Veri Yedeği: " + cleanName);
                    shareIntent.setClipData(ClipData.newRawUri(cleanName, contentUri));
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

                    // Hedef uygulamalara (Bluetooth servisi, Quick Share vb.) URI okuma yetkisini açıkça ver
                    try {
                        List<ResolveInfo> resInfoList = mContext.getPackageManager().queryIntentActivities(shareIntent, PackageManager.MATCH_DEFAULT_ONLY);
                        for (ResolveInfo resolveInfo : resInfoList) {
                            String packageName = resolveInfo.activityInfo.packageName;
                            mContext.grantUriPermission(packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        }
                    } catch (Exception ignored) {}

                    Intent chooser = Intent.createChooser(shareIntent, "Bütçem Yedeğini Paylaş (WhatsApp, Drive, Bluetooth, Wi-Fi...)");
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    mContext.startActivity(chooser);

                } catch (Exception e) {
                    Log.e(TAG, "shareBackupFile hatası:", e);
                    Toast.makeText(mContext, "Paylaşım menüsü açılamadı: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        /**
         * Google Drive'ı güvenle açar. Uygulama yüklüyse Google Drive uygulamasını,
         * değilse harici sistem tarayıcısını açar. Asla çökme veya kapanma yaşanmaz.
         */
        @JavascriptInterface
        public void openGoogleDrive() {
            runOnUiThread(() -> {
                try {
                    Intent driveIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://drive.google.com/drive/my-drive"));
                    driveIntent.setPackage("com.google.android.apps.docs");
                    driveIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    mContext.startActivity(driveIntent);
                } catch (Exception e) {
                    try {
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://drive.google.com/drive/my-drive"));
                        browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        mContext.startActivity(browserIntent);
                    } catch (Exception ex) {
                        Log.e(TAG, "Google Drive açılamadı:", ex);
                        Toast.makeText(mContext, "Google Drive açılamadı", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        /**
         * Harici bir web bağlantısını sistemin varsayılan tarayıcısında güvenle açar.
         */
        @JavascriptInterface
        public void openExternalUrl(final String url) {
            runOnUiThread(() -> {
                try {
                    if (url == null || url.trim().isEmpty()) return;
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    mContext.startActivity(browserIntent);
                } catch (Exception e) {
                    Log.e(TAG, "openExternalUrl hatası:", e);
                }
            });
        }
    }
}

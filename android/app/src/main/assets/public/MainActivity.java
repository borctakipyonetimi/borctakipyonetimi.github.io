package com.butcempro.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * Bütçem Pro - MainActivity WebView & JavascriptBridge Bağlantısı
 */
public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private static final int PERMISSION_REQUEST_CODE = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Donanım Alarm ve Bildirim Köprüsünü WebView'e Bağla ("AndroidAlarm" ismiyle)
        AndroidAlarmBridge bridge = new AndroidAlarmBridge(this, webView);
        webView.addJavascriptInterface(bridge, "AndroidAlarm");
        webView.addJavascriptInterface(bridge, "Android");

        webView.setWebViewClient(new WebViewClient());

        // Web Uygulamasının Canlı Sunucu veya Yerel Adresi
        webView.loadUrl("https://borctakipyonetimi.github.io");

        // Android 13+ Bildirim İznini İste
        requestNotificationPermissions();
    }

    private void requestNotificationPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQUEST_CODE);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}

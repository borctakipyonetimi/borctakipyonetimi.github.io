package com.butcempro.app;

import android.os.Bundle;
import android.os.Build;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Bütçem Pro - Ultra Güvenli MainActivity
 * Açılışta hiçbir ağır alarm/zamanlayıcı yüklemesi yapmaz, doğrudan WebView konteynerini güvenle ayağa kaldırır.
 * Donanım alarmları ve bildirimler tamamen web uygulaması ve AndroidAlarmBridge üzerinden asenkron yönetilir.
 */
public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            webView = new WebView(this);
            setContentView(webView);

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);

            // Güvenli Alarm Köprüsünü bağla
            try {
                AndroidAlarmBridge bridge = new AndroidAlarmBridge(this, webView);
                webView.addJavascriptInterface(bridge, "AndroidAlarm");
                webView.addJavascriptInterface(bridge, "Android");
            } catch (Throwable bridgeErr) {
                bridgeErr.printStackTrace();
            }

            webView.setWebViewClient(new WebViewClient());
            webView.loadUrl("https://borctakipyonetimi.github.io");
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    @Override
    public void onBackPressed() {
        try {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return;
            }
        } catch (Exception ignored) {}
        super.onBackPressed();
    }
}

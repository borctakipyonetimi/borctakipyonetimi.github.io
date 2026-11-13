package com.butcetakip.app;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    private static final int RECORD_AUDIO_REQUEST_CODE = 1002;
    private static final int DARK_WEBVIEW_BG = Color.parseColor("#0f172a");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyStatusBarTheme();
        applyWebViewDarkBackground();
        requestAudioPermissionsIfNecessary();
        setupAudioWebChromeClient();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyStatusBarTheme();
        applyWebViewDarkBackground();
    }

    private void applyWebViewDarkBackground() {
        try {
            Window window = getWindow();
            if (window != null) {
                window.setBackgroundDrawable(new ColorDrawable(DARK_WEBVIEW_BG));
                View decor = window.getDecorView();
                if (decor != null) {
                    decor.setBackgroundColor(DARK_WEBVIEW_BG);
                }
            }
            Bridge bridge = this.getBridge();
            if (bridge != null && bridge.getWebView() != null) {
                WebView webView = bridge.getWebView();
                webView.setBackgroundColor(DARK_WEBVIEW_BG);
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void requestAudioPermissionsIfNecessary() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                        this,
                        new String[]{
                            Manifest.permission.RECORD_AUDIO,
                            Manifest.permission.MODIFY_AUDIO_SETTINGS
                        },
                        RECORD_AUDIO_REQUEST_CODE
                    );
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void setupAudioWebChromeClient() {
        try {
            Bridge bridge = this.getBridge();
            if (bridge != null && bridge.getWebView() != null) {
                WebView webView = bridge.getWebView();
                webView.setBackgroundColor(DARK_WEBVIEW_BG);
                webView.setWebChromeClient(new BridgeWebChromeClient(bridge) {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                            ActivityCompat.requestPermissions(
                                                MainActivity.this,
                                                new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS},
                                                RECORD_AUDIO_REQUEST_CODE
                                            );
                                        }
                                    }
                                    // Otomatik olarak WebView mikrofon ve ses kaynaklarına izin ver (grant)
                                    request.grant(request.getResources());
                                } catch (Exception e) {
                                    e.printStackTrace();
                                    super.onPermissionRequest(request);
                                }
                            }
                        });
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void applyStatusBarTheme() {
        try {
            Window window = getWindow();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.setStatusBarColor(Color.parseColor("#0b132b"));
                window.setNavigationBarColor(Color.parseColor("#020617"));
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                decor.setSystemUiVisibility(flags);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

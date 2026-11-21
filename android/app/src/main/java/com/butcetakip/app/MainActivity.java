package com.butcetakip.app;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
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
    private boolean printBridgeAttached = false;
    private WebView mPrintWebView = null;

    private class AndroidPrintBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public void printCurrentPage(final String jobName) {
            MainActivity.this.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Bridge bridge = MainActivity.this.getBridge();
                        if (bridge != null && bridge.getWebView() != null) {
                            PrintManager printManager = (PrintManager) MainActivity.this.getSystemService(Context.PRINT_SERVICE);
                            if (printManager != null) {
                                String safeTitle = (jobName != null && !jobName.trim().isEmpty()) ? jobName.trim() : "Butcem_Pro_Rapor";
                                PrintDocumentAdapter adapter = bridge.getWebView().createPrintDocumentAdapter(safeTitle);
                                printManager.print(safeTitle, adapter, new PrintAttributes.Builder().build());
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        @JavascriptInterface
        public void printHtml(final String htmlContent, final String jobName) {
            MainActivity.this.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        final PrintManager printManager = (PrintManager) MainActivity.this.getSystemService(Context.PRINT_SERVICE);
                        if (printManager == null) return;
                        final String safeTitle = (jobName != null && !jobName.trim().isEmpty()) ? jobName.trim() : "Butcem_Pro_Rapor";
                        final WebView printWebView = new WebView(MainActivity.this);
                        printWebView.getSettings().setJavaScriptEnabled(false);
                        printWebView.setWebViewClient(new WebViewClient() {
                            @Override
                            public void onPageFinished(WebView view, String url) {
                                try {
                                    PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(safeTitle);
                                    printManager.print(safeTitle, adapter, new PrintAttributes.Builder().build());
                                } catch (Exception e) {
                                    e.printStackTrace();
                                } finally {
                                    mPrintWebView = null;
                                }
                            }
                        });
                        mPrintWebView = printWebView;
                        printWebView.loadDataWithBaseURL("about:blank", htmlContent != null ? htmlContent : "", "text/html", "UTF-8", null);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }
    }

    private void setupPrintBridge() {
        try {
            if (printBridgeAttached) return;
            Bridge bridge = this.getBridge();
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().addJavascriptInterface(new AndroidPrintBridge(), "AndroidPrint");
                printBridgeAttached = true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyStatusBarTheme();
        applyWebViewDarkBackground();
        requestAudioPermissionsIfNecessary();
        setupAudioWebChromeClient();
        setupPrintBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyStatusBarTheme();
        applyWebViewDarkBackground();
        setupPrintBridge();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyStatusBarTheme();
            applyWebViewDarkBackground();
        }
    }

    private void applyWebViewDarkBackground() {
        try {
            final int bgColor = Color.parseColor("#0f172a");
            Window window = getWindow();
            if (window != null) {
                window.setBackgroundDrawable(new ColorDrawable(bgColor));
                View decor = window.getDecorView();
                if (decor != null) {
                    decor.setBackgroundColor(bgColor);
                }
            }
            Bridge bridge = this.getBridge();
            if (bridge != null && bridge.getWebView() != null) {
                final WebView webView = bridge.getWebView();
                webView.setBackgroundColor(Color.parseColor("#0f172a"));
                webView.setLayerType(View.LAYER_TYPE_NONE, null);
                if (webView.getParent() instanceof View) {
                    ((View) webView.getParent()).setBackgroundColor(bgColor);
                }
                webView.invalidate();
                webView.post(new Runnable() {
                    @Override
                    public void run() {
                        webView.setBackgroundColor(Color.parseColor("#0f172a"));
                        webView.invalidate();
                    }
                });
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
                        if (request == null) {
                            return;
                        }
                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                        java.util.List<String> needed = new java.util.ArrayList<>();
                                        String[] resources = request.getResources();
                                        if (resources != null) {
                                            for (String res : resources) {
                                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res) &&
                                                    ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                                    needed.add(Manifest.permission.RECORD_AUDIO);
                                                    needed.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
                                                }
                                                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res) &&
                                                    ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                                    needed.add(Manifest.permission.CAMERA);
                                                }
                                            }
                                        }
                                        if (!needed.isEmpty()) {
                                            ActivityCompat.requestPermissions(
                                                MainActivity.this,
                                                needed.toArray(new String[0]),
                                                RECORD_AUDIO_REQUEST_CODE
                                            );
                                        }
                                    }
                                    // Otomatik olarak WebView kamera/mikrofon kaynaklarına izin ver (grant)
                                    request.grant(request.getResources());
                                } catch (Exception e) {
                                    e.printStackTrace();
                                    try {
                                        request.deny();
                                    } catch (Exception ignored) {
                                    }
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

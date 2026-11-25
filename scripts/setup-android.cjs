const fs = require('fs');
const path = require('path');

console.log('🚀 Running Android setup script...');

// 1. Ensure resource and Java directories exist
const resValuesDir = path.resolve('android/app/src/main/res/values');
const resValuesV31Dir = path.resolve('android/app/src/main/res/values-v31');
const javaAppDir = path.resolve('android/app/src/main/java/com/butcetakip/app');

fs.mkdirSync(resValuesDir, { recursive: true });
fs.mkdirSync(resValuesV31Dir, { recursive: true });
fs.mkdirSync(javaAppDir, { recursive: true });

// 2. Setup colors.xml
const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0b132b</color>
    <color name="colorPrimaryDark">#0b132b</color>
    <color name="colorAccent">#10b981</color>
    <color name="statusBarColor">#0b132b</color>
    <color name="navigationBarColor">#020617</color>
</resources>
`;
fs.writeFileSync(path.join(resValuesDir, 'colors.xml'), colorsXml, 'utf8');
console.log('✅ Created colors.xml');

// 3. Setup styles.xml
const stylesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">#0b132b</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:navigationBarColor">#020617</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowIsTranslucent">false</item>
        <item name="android:colorBackground">#0f172a</item>
        <item name="android:windowBackground">#0f172a</item>
        <item name="android:statusBarColor">#0f172a</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:navigationBarColor">#0f172a</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">#0f172a</item>
        <item name="android:colorBackground">#0f172a</item>
        <item name="android:windowBackground">#0f172a</item>
        <item name="android:statusBarColor">#0f172a</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:navigationBarColor">#0f172a</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
</resources>
`;
fs.writeFileSync(path.join(resValuesDir, 'styles.xml'), stylesXml, 'utf8');
console.log('✅ Created styles.xml');

// 4. Setup styles-v31.xml
const stylesV31Xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">#0f172a</item>
        <item name="windowSplashScreenBackground">#0f172a</item>
        <item name="android:windowBackground">#0f172a</item>
        <item name="android:statusBarColor">#0f172a</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:navigationBarColor">#0f172a</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
</resources>
`;
fs.writeFileSync(path.join(resValuesV31Dir, 'styles.xml'), stylesV31Xml, 'utf8');
console.log('✅ Created styles-v31.xml');

// 4b. Lock activity_main.xml CoordinatorLayout and WebView background to #0f172a
const activityMainLayoutPath = path.resolve('android/app/src/main/res/layout/activity_main.xml');
if (fs.existsSync(activityMainLayoutPath)) {
  const darkLayoutXml = `<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#0f172a"
    tools:context=".MainActivity">

    <WebView
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="#0f172a" />
</androidx.coordinatorlayout.widget.CoordinatorLayout>
`;
  fs.writeFileSync(activityMainLayoutPath, darkLayoutXml, 'utf8');
  console.log('✅ Locked activity_main.xml background to #0f172a');
}

// 5. Inject AndroidManifest permissions and configurations safely
const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let content = fs.readFileSync(manifestPath, 'utf8');
  
  const perms = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
    '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
    '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
    '<uses-permission android:name="android.permission.USE_BIOMETRIC" />',
    '<uses-permission android:name="android.permission.USE_FINGERPRINT" />'
  ];

  // Identify any missing permissions/features by android:name attribute
  const missingPerms = perms.filter(perm => {
    const match = perm.match(/android:name="([^"]+)"/);
    if (match && content.includes(match[1])) {
      return false;
    }
    return !content.includes(perm);
  });

  // Inject permissions directly before <application tag so XML syntax remains 100% valid
  if (missingPerms.length > 0) {
    const permsBlock = missingPerms.map(p => '    ' + p).join('\n');
    content = content.replace(/<application/, permsBlock + '\n\n    <application');
  }

  // Ensure usesCleartextTraffic is safely added without breaking tag attributes
  if (!content.includes('android:usesCleartextTraffic')) {
    content = content.replace(/<application\s*/, '<application\n        android:usesCleartextTraffic="true"\n        ');
  }

  // Ensure notification meta-data is injected inside the application/activity element
  if (!content.includes('com.google.firebase.messaging.default_notification_icon')) {
    const metaBlock = `
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@mipmap/ic_stat_notify" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:value="#10B981" />`;
    if (content.includes('</activity>')) {
      content = content.replace('</activity>', '</activity>' + metaBlock);
    } else if (content.includes('</application>')) {
      content = content.replace('</application>', metaBlock + '\n    </application>');
    }
  }

  // Ensure FileProvider is registered for @capacitor/camera photo capture
  if (!content.includes('.fileprovider')) {
    const providerBlock = `
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>`;
    if (content.includes('</application>')) {
      content = content.replace('</application>', providerBlock + '\n    </application>');
    }
  }

  // Ensure AdMob Native Ad Validator overlay is disabled on test native ads
  if (!content.includes('com.google.android.gms.ads.flag.NATIVE_AD_DEBUGGER_ENABLED')) {
    const validatorMetaBlock = `
        <meta-data
            android:name="com.google.android.gms.ads.flag.NATIVE_AD_DEBUGGER_ENABLED"
            android:value="false" />`;
    if (content.includes('</application>')) {
      content = content.replace('</application>', validatorMetaBlock + '\n    </application>');
    }
  }

  // Remove any legacy widget receivers if present
  content = content.replace(/\s*<!--[\s\S]*?Widget[\s\S]*?-->/g, '');
  content = content.replace(/\s*<receiver[\s\S]*?(?:BudgetWidgetProvider|QuickSummaryWidgetProvider)[\s\S]*?<\/receiver>/g, '');

  fs.writeFileSync(manifestPath, content, 'utf8');
  console.log('✅ Updated AndroidManifest.xml with clean XML syntax');
}

// 6a. Write InlineAdMobPlugin.java for reliable inline Google AdView rendering
const inlineAdMobPluginPath = path.join(javaAppDir, 'InlineAdMobPlugin.java');
const inlineAdMobPluginJava = `package com.butcetakip.app;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.coordinatorlayout.widget.CoordinatorLayout;
import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

@CapacitorPlugin(name = "InlineAdMob")
public class InlineAdMobPlugin extends Plugin {

    private static final String DEFAULT_TEST_BANNER_ID = "ca-app-pub-3940256099942544/6300978111";

    private static class InlineSlot {
        final String slotKey;
        final String sessionId;
        final FrameLayout container;
        final AdView adView;
        final int adWidthDp;
        final int adHeightDp;
        boolean loaded = false;
        boolean hasPlacement = false;
        boolean visible = false;
        double rectX = 0;
        double rectY = 0;
        double rectW = 0;
        double rectH = 0;
        double clipX = 0;
        double clipY = 0;
        double clipW = 0;
        double clipH = 0;
        double viewportW = 0;

        InlineSlot(String slotKey, String sessionId, FrameLayout container, AdView adView, int adWidthDp, int adHeightDp) {
            this.slotKey = slotKey;
            this.sessionId = sessionId;
            this.container = container;
            this.adView = adView;
            this.adWidthDp = adWidthDp;
            this.adHeightDp = adHeightDp;
        }
    }

    private final Map<String, InlineSlot> slots = new HashMap<>();
    private boolean paused = false;
    private String currentSessionId = "";

    private ViewGroup resolveOverlayParent() {
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null && bridge.getWebView().getParent() instanceof ViewGroup) {
            return (ViewGroup) bridge.getWebView().getParent();
        }
        Activity activity = getActivity();
        if (activity == null) return null;
        View content = activity.findViewById(android.R.id.content);
        if (content instanceof ViewGroup && ((ViewGroup) content).getChildCount() > 0) {
            View first = ((ViewGroup) content).getChildAt(0);
            if (first instanceof ViewGroup) {
                return (ViewGroup) first;
            }
        }
        return null;
    }

    private void runOnUi(Runnable task) {
        Activity activity = getActivity();
        if (activity != null && !activity.isFinishing() && !activity.isDestroyed()) {
            activity.runOnUiThread(task);
        }
    }

    private void destroyAllSlotsInternal() {
        Iterator<String> it = slots.keySet().iterator();
        while (it.hasNext()) {
            String key = it.next();
            InlineSlot slot = slots.get(key);
            it.remove();
            if (slot != null) {
                try {
                    slot.adView.pause();
                    ViewGroup parent = (ViewGroup) slot.container.getParent();
                    if (parent != null) {
                        parent.removeView(slot.container);
                    }
                    slot.adView.destroy();
                } catch (Exception ignored) {
                }
            }
        }
    }

    @PluginMethod
    public void beginSession(final PluginCall call) {
        final String sessionId = call.getString("sessionId", "");
        runOnUi(() -> {
            currentSessionId = sessionId != null ? sessionId : "";
            paused = false;
            destroyAllSlotsInternal();
            call.resolve();
        });
    }

    @PluginMethod
    public void clearAllSlots(final PluginCall call) {
        runOnUi(() -> {
            paused = false;
            destroyAllSlotsInternal();
            call.resolve();
        });
    }

    @PluginMethod
    public void loadSlot(final PluginCall call) {
        final String slotKey = call.getString("slotKey");
        if (slotKey == null || slotKey.trim().isEmpty()) {
            call.reject("slotKey must not be empty");
            return;
        }
        final String sessionId = call.getString("sessionId", "");
        final String adId = call.getString("adId", DEFAULT_TEST_BANNER_ID);
        final String requestedSize = call.getString("adSize", "MEDIUM_RECTANGLE");
        final int maxWidthDp = call.getInt("maxWidthDp", 300);

        runOnUi(() -> {
            try {
                if (sessionId != null && !sessionId.isEmpty() && !currentSessionId.isEmpty() && !sessionId.equals(currentSessionId)) {
                    call.resolve();
                    return;
                }
                Context context = getContext();
                if (context == null) {
                    call.reject("Android context unavailable");
                    return;
                }
                MobileAds.initialize(context, status -> {});

                ViewGroup parent = resolveOverlayParent();
                if (parent == null) {
                    call.reject("Overlay parent unavailable");
                    return;
                }

                destroySlotInternal(slotKey);

                DisplayMetrics metrics = context.getResources().getDisplayMetrics();
                float density = metrics.density > 0 ? metrics.density : 1f;

                AdSize selectedSize;
                if ("MEDIUM_RECTANGLE".equals(requestedSize) && maxWidthDp >= 300) {
                    selectedSize = AdSize.MEDIUM_RECTANGLE;
                } else if (maxWidthDp >= 320) {
                    selectedSize = AdSize.LARGE_BANNER;
                } else {
                    selectedSize = AdSize.BANNER;
                }

                int widthDp = Math.max(300, selectedSize.getWidth());
                int heightDp = Math.max(50, selectedSize.getHeight());
                int widthPx = Math.round(widthDp * density);
                int heightPx = Math.round(heightDp * density);

                FrameLayout container = new FrameLayout(context);
                container.setClipChildren(true);
                container.setClipToPadding(true);
                GradientDrawable bg = new GradientDrawable();
                bg.setColor(Color.WHITE);
                bg.setCornerRadius(12f * density);
                container.setBackground(bg);
                container.setVisibility(View.INVISIBLE);
                container.setAlpha(0f);

                AdView adView = new AdView(context);
                adView.setAdUnitId(adId != null && !adId.trim().isEmpty() ? adId : DEFAULT_TEST_BANNER_ID);
                adView.setAdSize(selectedSize);
                adView.setBackgroundColor(Color.WHITE);

                FrameLayout.LayoutParams adParams = new FrameLayout.LayoutParams(widthPx, heightPx, Gravity.TOP | Gravity.START);
                container.addView(adView, adParams);

                ViewGroup.LayoutParams parentParams;
                if (parent instanceof CoordinatorLayout) {
                    CoordinatorLayout.LayoutParams lp = new CoordinatorLayout.LayoutParams(widthPx, heightPx);
                    lp.gravity = Gravity.TOP | Gravity.START;
                    parentParams = lp;
                } else {
                    parentParams = new FrameLayout.LayoutParams(widthPx, heightPx, Gravity.TOP | Gravity.START);
                }
                parent.addView(container, parentParams);

                final InlineSlot slot = new InlineSlot(slotKey, sessionId != null ? sessionId : "", container, adView, widthDp, heightDp);
                slots.put(slotKey, slot);

                adView.setAdListener(new AdListener() {
                    @Override
                    public void onAdLoaded() {
                        if (slots.get(slotKey) != slot) return;
                        if (!slot.sessionId.isEmpty() && !currentSessionId.isEmpty() && !slot.sessionId.equals(currentSessionId)) {
                            destroySlotInternal(slotKey);
                            return;
                        }
                        slot.loaded = true;
                        applyPlacementInternal(slot);
                        JSObject data = new JSObject();
                        data.put("slotKey", slotKey);
                        data.put("width", slot.adWidthDp);
                        data.put("height", slot.adHeightDp);
                        notifyListeners("inlineAdLoaded", data);
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        if (slots.get(slotKey) != slot) return;
                        slot.loaded = false;
                        slot.container.setVisibility(View.GONE);
                        JSObject data = new JSObject();
                        data.put("slotKey", slotKey);
                        data.put("code", error.getCode());
                        data.put("message", error.getMessage());
                        notifyListeners("inlineAdFailed", data);
                    }
                });

                adView.loadAd(new AdRequest.Builder().build());
                call.resolve();
            } catch (Exception ex) {
                call.reject(ex.getLocalizedMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void updateSlot(final PluginCall call) {
        final String slotKey = call.getString("slotKey");
        if (slotKey == null || slotKey.trim().isEmpty()) {
            call.resolve();
            return;
        }
        final String sessionId = call.getString("sessionId", "");
        final boolean visible = Boolean.TRUE.equals(call.getBoolean("visible", false));
        final double rectX = call.getDouble("rectX", 0.0);
        final double rectY = call.getDouble("rectY", 0.0);
        final double rectW = call.getDouble("rectW", 0.0);
        final double rectH = call.getDouble("rectH", 0.0);
        final double clipX = call.getDouble("clipX", 0.0);
        final double clipY = call.getDouble("clipY", 0.0);
        final double clipW = call.getDouble("clipW", 0.0);
        final double clipH = call.getDouble("clipH", 0.0);
        final double viewportW = call.getDouble("viewportW", 0.0);

        runOnUi(() -> {
            InlineSlot slot = slots.get(slotKey);
            if (slot == null) return;
            if (sessionId != null && !sessionId.isEmpty() && !currentSessionId.isEmpty() && !sessionId.equals(currentSessionId)) {
                destroySlotInternal(slotKey);
                return;
            }
            slot.hasPlacement = true;
            slot.visible = visible;
            slot.rectX = rectX;
            slot.rectY = rectY;
            slot.rectW = rectW;
            slot.rectH = rectH;
            slot.clipX = clipX;
            slot.clipY = clipY;
            slot.clipW = clipW;
            slot.clipH = clipH;
            slot.viewportW = viewportW;
            applyPlacementInternal(slot);
        });
        call.resolve();
    }

    private void applyPlacementInternal(InlineSlot slot) {
        if (slot == null) return;
        if (!slot.sessionId.isEmpty() && !currentSessionId.isEmpty() && !slot.sessionId.equals(currentSessionId)) {
            if (slot.container.getVisibility() != View.GONE) {
                slot.container.setVisibility(View.GONE);
                slot.adView.pause();
            }
            return;
        }
        if (!slot.loaded) {
            return;
        }
        if (paused || !slot.hasPlacement || !slot.visible || slot.clipW <= 0 || slot.clipH <= 0) {
            if (slot.container.getVisibility() != View.GONE) {
                slot.container.setVisibility(View.GONE);
                slot.adView.pause();
            }
            return;
        }

        Bridge bridge = getBridge();
        View webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) return;

        Context context = getContext();
        float density = context != null && context.getResources().getDisplayMetrics().density > 0
            ? context.getResources().getDisplayMetrics().density
            : 1f;
        float scale = (slot.viewportW > 0 && webView.getWidth() > 0)
            ? (float) webView.getWidth() / (float) slot.viewportW
            : density;

        int clipXPx = Math.round((float) slot.clipX * scale);
        int clipYPx = Math.round((float) slot.clipY * scale);
        int clipWPx = Math.max(1, Math.round((float) slot.clipW * scale));
        int clipHPx = Math.max(1, Math.round((float) slot.clipH * scale));

        int rectXPx = Math.round((float) slot.rectX * scale);
        int rectYPx = Math.round((float) slot.rectY * scale);
        int adWPx = Math.round(slot.adWidthDp * density);
        int adHPx = Math.round(slot.adHeightDp * density);
        int centerOffsetX = Math.max(0, Math.round(((float) slot.rectW * scale - adWPx) / 2f));
        int centerOffsetY = Math.max(0, Math.round(((float) slot.rectH * scale - adHPx) / 2f));

        ViewGroup.LayoutParams lp = slot.container.getLayoutParams();
        if (lp != null && (lp.width != clipWPx || lp.height != clipHPx)) {
            lp.width = clipWPx;
            lp.height = clipHPx;
            slot.container.setLayoutParams(lp);
        }

        slot.container.setTranslationX(webView.getX() + clipXPx);
        slot.container.setTranslationY(webView.getY() + clipYPx);
        slot.adView.setTranslationX((rectXPx - clipXPx) + centerOffsetX);
        slot.adView.setTranslationY((rectYPx - clipYPx) + centerOffsetY);

        boolean wasVisible = slot.container.getVisibility() == View.VISIBLE && slot.container.getAlpha() > 0.5f;
        slot.container.setAlpha(1f);
        if (slot.container.getVisibility() != View.VISIBLE) {
            slot.container.setVisibility(View.VISIBLE);
            slot.adView.resume();
        }
        if (!wasVisible) {
            slot.container.bringToFront();
            slot.container.requestLayout();
            slot.adView.requestLayout();
        }
    }

    @PluginMethod
    public void removeSlot(final PluginCall call) {
        final String slotKey = call.getString("slotKey");
        runOnUi(() -> {
            if (slotKey != null) {
                destroySlotInternal(slotKey);
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void pauseAll(final PluginCall call) {
        runOnUi(() -> {
            paused = true;
            for (InlineSlot slot : slots.values()) {
                if (slot.container.getVisibility() != View.GONE) {
                    slot.container.setVisibility(View.GONE);
                    slot.adView.pause();
                }
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void resumeAll(final PluginCall call) {
        runOnUi(() -> {
            paused = false;
            for (InlineSlot slot : slots.values()) {
                applyPlacementInternal(slot);
            }
        });
        call.resolve();
    }

    private void destroySlotInternal(String slotKey) {
        InlineSlot existing = slots.remove(slotKey);
        if (existing == null) return;
        try {
            existing.adView.pause();
            ViewGroup parent = (ViewGroup) existing.container.getParent();
            if (parent != null) {
                parent.removeView(existing.container);
            }
            existing.adView.destroy();
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void handleOnDestroy() {
        runOnUi(this::destroyAllSlotsInternal);
        super.handleOnDestroy();
    }
}
`;
fs.writeFileSync(inlineAdMobPluginPath, inlineAdMobPluginJava, 'utf8');
console.log('✅ Created InlineAdMobPlugin.java');

// 6. Inject Native Dark StatusBar & WebView Dark Background (#0f172a) in MainActivity.java
const mainActivityPath = path.join(javaAppDir, 'MainActivity.java');
const mainActivityJava = `package com.butcetakip.app;

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
        registerPlugin(InlineAdMobPlugin.class);
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
                webView.setLayerType(View.LAYER_TYPE_NONE, null);
                if (webView.getParent() instanceof View) {
                    ((View) webView.getParent()).setBackgroundColor(DARK_WEBVIEW_BG);
                }
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
`;
fs.writeFileSync(mainActivityPath, mainActivityJava, 'utf8');
console.log('✅ Updated MainActivity.java with dark status bar and #0f172a WebView background');

// 7. Configure signingConfigs in android/app/build.gradle and ensure keystore exists
const appBuildGradlePath = path.resolve('android/app/build.gradle');
const keystoreDest = path.resolve('android/app/upload-keystore.jks');
const rootKeystore = path.resolve('upload-keystore.jks');

if (fs.existsSync(rootKeystore) && !fs.existsSync(keystoreDest)) {
  fs.copyFileSync(rootKeystore, keystoreDest);
  console.log('✅ Copied upload-keystore.jks to android/app');
}

if (fs.existsSync(appBuildGradlePath)) {
  let gradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
  let modifiedGradle = false;
  if (!gradleContent.includes('com.google.android.gms:play-services-ads')) {
    const adsDepLine = '    implementation "com.google.android.gms:play-services-ads:${rootProject.hasProperty(\'playServicesAdsVersion\') ? rootProject.ext.playServicesAdsVersion : \'25.4.+\'}"\n';
    gradleContent = gradleContent.replace("    implementation project(':capacitor-android')", adsDepLine + "    implementation project(':capacitor-android')");
    modifiedGradle = true;
    console.log('✅ Added play-services-ads dependency to android/app/build.gradle');
  }
  if (!gradleContent.includes('signingConfigs {')) {
    const signingBlock = `    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "upload-keystore.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: "Emir@2014"
            keyAlias System.getenv("KEY_ALIAS") ?: "butcempro"
            keyPassword System.getenv("KEY_PASSWORD") ?: "Emir@2014"
        }
    }
    buildTypes {`;
    gradleContent = gradleContent.replace(/buildTypes\s*\{/, signingBlock);
    gradleContent = gradleContent.replace(/release\s*\{/, 'release {\n            signingConfig signingConfigs.release');
    modifiedGradle = true;
    console.log('✅ Injected signingConfigs in android/app/build.gradle');
  } else {
    console.log('ℹ️ signingConfigs already present in android/app/build.gradle');
  }
  if (modifiedGradle) {
    fs.writeFileSync(appBuildGradlePath, gradleContent, 'utf8');
  }
}

// 8. Ensure strings.xml has clean syntax without widget references
const stringsXmlPath = path.resolve('android/app/src/main/res/values/strings.xml');
if (fs.existsSync(stringsXmlPath)) {
  let stringsContent = fs.readFileSync(stringsXmlPath, 'utf8');
  stringsContent = stringsContent.replace(/\s*<string name="widget_[^"]*">[\s\S]*?<\/string>/g, '');
  fs.writeFileSync(stringsXmlPath, stringsContent, 'utf8');
  console.log('✅ Cleaned strings.xml');
}

// 9. Ensure notification icons are synced to all res directories
const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const largeSizes = { mdpi: 64, hdpi: 96, xhdpi: 128, xxhdpi: 192, xxxhdpi: 256 };
const smallSizes = { mdpi: 32, hdpi: 48, xhdpi: 64, xxhdpi: 96, xxxhdpi: 128 };
let masterIcon = path.resolve('notification-icon.png');
if (!fs.existsSync(masterIcon) && fs.existsSync(path.resolve('public/notification-icon.png'))) {
  masterIcon = path.resolve('public/notification-icon.png');
}

if (fs.existsSync(masterIcon)) {
  const { execSync } = require('child_process');
  let hasConvert = false;
  try {
    execSync('which convert', { stdio: 'ignore' });
    hasConvert = true;
  } catch {}

  densities.forEach(dpi => {
    const dDir = path.resolve(`android/app/src/main/res/drawable-${dpi}`);
    const mDir = path.resolve(`android/app/src/main/res/mipmap-${dpi}`);
    fs.mkdirSync(dDir, { recursive: true });
    fs.mkdirSync(mDir, { recursive: true });

    const lSize = largeSizes[dpi];
    const sSize = smallSizes[dpi];
    const tmpLarge = `/tmp/setup_large_${dpi}.png`;
    const tmpSmall = `/tmp/setup_small_${dpi}.png`;

    if (hasConvert) {
      try {
        execSync(`convert "${masterIcon}" -resize ${lSize}x${lSize} -gravity center -background none -extent ${lSize}x${lSize} PNG32:"${tmpLarge}"`);
        execSync(`convert "${masterIcon}" -resize ${sSize}x${sSize} -gravity center -background none -extent ${sSize}x${sSize} PNG32:"${tmpSmall}"`);
      } catch (cErr) {
        fs.copyFileSync(masterIcon, tmpLarge);
        fs.copyFileSync(masterIcon, tmpSmall);
      }
    } else {
      fs.copyFileSync(masterIcon, tmpLarge);
      fs.copyFileSync(masterIcon, tmpSmall);
    }

    // Large notification icon (for right side of notification)
    fs.copyFileSync(tmpLarge, path.join(dDir, 'ic_stat_notify_large.png'));
    fs.copyFileSync(tmpLarge, path.join(mDir, 'ic_stat_notify_large.png'));

    // Small notification icons
    ['ic_stat_notify.png', 'ic_notification.png', 'notification_icon.png'].forEach(name => {
      fs.copyFileSync(tmpSmall, path.join(dDir, name));
      fs.copyFileSync(tmpSmall, path.join(mDir, name));
    });
  });

  // Default drawable directory
  const defaultDrawable = path.resolve('android/app/src/main/res/drawable');
  fs.mkdirSync(defaultDrawable, { recursive: true });
  const tmpDefLarge = '/tmp/setup_large_def.png';
  const tmpDefSmall = '/tmp/setup_small_def.png';
  if (hasConvert) {
    try {
      execSync(`convert "${masterIcon}" -resize 256x256 -gravity center -background none -extent 256x256 PNG32:"${tmpDefLarge}"`);
      execSync(`convert "${masterIcon}" -resize 96x96 -gravity center -background none -extent 96x96 PNG32:"${tmpDefSmall}"`);
    } catch {
      fs.copyFileSync(masterIcon, tmpDefLarge);
      fs.copyFileSync(masterIcon, tmpDefSmall);
    }
  } else {
    fs.copyFileSync(masterIcon, tmpDefLarge);
    fs.copyFileSync(masterIcon, tmpDefSmall);
  }
  fs.copyFileSync(tmpDefLarge, path.join(defaultDrawable, 'ic_stat_notify_large.png'));
  fs.copyFileSync(tmpDefSmall, path.join(defaultDrawable, 'ic_stat_notify.png'));
  fs.copyFileSync(tmpDefSmall, path.join(defaultDrawable, 'ic_notification.png'));
  fs.copyFileSync(tmpDefSmall, path.join(defaultDrawable, 'notification_icon.png'));

  console.log('✅ Synchronized crisp notification icons (large & small) across all res directories');
}

console.log('🎉 Android setup script completed successfully!');

const fs = require('fs');
const path = require('path');

console.log('🚀 Running Android setup script...');

// 1. Ensure resource and Java directories exist
const resValuesDir = path.resolve('android/app/src/main/res/values');
const resValuesV31Dir = path.resolve('android/app/src/main/res/values-v31');
const javaAppDir = path.resolve('android/app/src/main/java/com/borctakip/app');

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

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">#020617</item>
        <item name="android:statusBarColor">#0b132b</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:navigationBarColor">#020617</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@android:color/black</item>
        <item name="android:statusBarColor">#0b132b</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:navigationBarColor">#020617</item>
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
        <item name="android:background">@android:color/black</item>
        <item name="windowSplashScreenBackground">#020617</item>
        <item name="android:statusBarColor">#0b132b</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:navigationBarColor">#020617</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
</resources>
`;
fs.writeFileSync(path.join(resValuesV31Dir, 'styles.xml'), stylesV31Xml, 'utf8');
console.log('✅ Created styles-v31.xml');

// 5. Inject AndroidManifest permissions and configurations
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

  for (const perm of perms) {
    if (!content.includes(perm)) {
      content = content.replace('<manifest', '<manifest\n    ' + perm);
    }
  }

  if (!content.includes('usesCleartextTraffic')) {
    content = content.replace('<application', '<application android:usesCleartextTraffic="true"');
  }

  if (!content.includes('com.google.firebase.messaging.default_notification_icon')) {
    content = content.replace(
      '</activity>',
      '</activity>\n        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@mipmap/ic_stat_notify" />\n        <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:value="#10B981" />'
    );
  }

  fs.writeFileSync(manifestPath, content, 'utf8');
  console.log('✅ Updated AndroidManifest.xml');
}

// 6. Inject Native Dark StatusBar in MainActivity.java
const mainActivityPath = path.join(javaAppDir, 'MainActivity.java');
const mainActivityJava = `package com.borctakip.app;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.graphics.Color;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyStatusBarTheme();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyStatusBarTheme();
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
console.log('✅ Updated MainActivity.java with dark status bar');

console.log('🎉 Android setup script completed successfully!');

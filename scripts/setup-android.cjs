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

  // Remove any legacy widget receivers if present
  content = content.replace(/\s*<!--[\s\S]*?Widget[\s\S]*?-->/g, '');
  content = content.replace(/\s*<receiver[\s\S]*?(?:BudgetWidgetProvider|QuickSummaryWidgetProvider)[\s\S]*?<\/receiver>/g, '');

  fs.writeFileSync(manifestPath, content, 'utf8');
  console.log('✅ Updated AndroidManifest.xml with clean XML syntax');
}

// 6. Inject Native Dark StatusBar in MainActivity.java
const mainActivityPath = path.join(javaAppDir, 'MainActivity.java');
const mainActivityJava = `package com.butcetakip.app;

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
    fs.writeFileSync(appBuildGradlePath, gradleContent, 'utf8');
    console.log('✅ Injected signingConfigs in android/app/build.gradle');
  } else {
    console.log('ℹ️ signingConfigs already present in android/app/build.gradle');
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

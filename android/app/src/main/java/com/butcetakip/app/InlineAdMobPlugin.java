package com.butcetakip.app;

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

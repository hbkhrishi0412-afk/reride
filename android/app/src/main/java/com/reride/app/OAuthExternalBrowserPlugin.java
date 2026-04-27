package com.reride.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens Supabase / Google OAuth in Chrome Custom Tabs (or trusted browser fallback).
 * <p>
 * A plain {@code Intent.ACTION_VIEW} to Chrome can leave Google’s account page stuck loading
 * on some emulators and OEM builds. Custom Tabs is Google’s supported OAuth container and
 * hands off {@code com.reride.app://oauth-callback} reliably after sign-in.
 * <p>
 * We intentionally do not use Capacitor’s in-app {@code Browser} WebView for OAuth (403 /
 * disallowed user agent / endless spinner on accounts.google.com).
 */
@CapacitorPlugin(name = "OAuthExternalBrowser")
public class OAuthExternalBrowserPlugin extends Plugin {

    private static final String TAG = "OAuthExternalBrowser";

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing url");
            return;
        }
        try {
            Uri uri = Uri.parse(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) {
                openExternalViewFallback(uri, call);
                return;
            }
            if (getActivity() == null) {
                call.reject("Activity not available");
                return;
            }
            try {
                CustomTabColorSchemeParams darkParams =
                    new CustomTabColorSchemeParams.Builder().build();
                CustomTabsIntent tabsIntent =
                    new CustomTabsIntent.Builder()
                        .setDefaultColorSchemeParams(darkParams)
                        .setShowTitle(true)
                        .setUrlBarHidingEnabled(false)
                        .build();
                tabsIntent.launchUrl(getActivity(), uri);
            } catch (Exception cctErr) {
                Log.w(TAG, "Custom Tabs failed, falling back to default browser", cctErr);
                openExternalViewFallback(uri, call);
                return;
            }
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No browser available to open sign-in", e);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    /** Last resort: same as legacy behavior (e.g. non-http schemes). */
    private void openExternalViewFallback(@NonNull Uri uri, @Nullable PluginCall callToResolve) {
        if (getActivity() == null) {
            if (callToResolve != null) {
                callToResolve.reject("Activity not available");
            }
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(intent);
        if (callToResolve != null) {
            callToResolve.resolve();
        }
    }
}

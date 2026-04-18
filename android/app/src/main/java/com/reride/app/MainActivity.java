package com.reride.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "ReRideMainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OAuthExternalBrowserPlugin.class);
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        installRenderProcessGoneRecovery();
    }

    /**
     * With {@code launchMode="singleTask"} the activity is reused when the
     * {@code com.reride.app://oauth-callback?code=...} deep link fires. Capacitor's
     * {@link BridgeActivity#onNewIntent(Intent)} dispatches {@code appUrlOpen} to JS, but does
     * not update the activity's stored intent. Without {@link #setIntent(Intent)} here, a later
     * {@code App.getLaunchUrl()} (our resume-time fallback in {@code utils/oauthMobile.ts})
     * still returns the original launcher intent and the PKCE {@code ?code=} is lost whenever
     * the {@code appUrlOpen} event is missed (MIUI/ColorOS, cold-start races). Replacing the
     * intent here makes the resume fallback deterministic.
     *
     * Also pushes the URL to the WebView via {@code window.__rerideNativeOAuthUrl} so the
     * handler fires even if Capacitor's event bus isn't ready yet.
     */
    @Override
    protected void onNewIntent(Intent intent) {
        try {
            if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
                Uri data = intent.getData();
                if (data != null) {
                    String scheme = data.getScheme();
                    if ("com.reride.app".equalsIgnoreCase(scheme)) {
                        setIntent(intent);
                        forwardOAuthUrlToWebView(data.toString());
                    }
                }
            }
        } catch (Exception err) {
            Log.w(TAG, "onNewIntent OAuth handling failed", err);
        }
        super.onNewIntent(intent);
    }

    /**
     * Calls into the SPA's JS bridge to hand the deep-link URL to the OAuth return handler.
     * Safe to call before/after Capacitor's {@code appUrlOpen} listener attaches — the handler
     * in {@code utils/oauthMobile.ts} deduplicates via {@code lastHandledOAuthUrl}.
     */
    private void forwardOAuthUrlToWebView(final String url) {
        if (url == null || url.isEmpty()) return;
        try {
            final Bridge bridge = getBridge();
            if (bridge == null || bridge.getWebView() == null) return;
            final WebView webView = bridge.getWebView();
            final String escaped = url
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "");
            final String js =
                "try{if(typeof window.__rerideNativeOAuthUrl==='function'){" +
                "window.__rerideNativeOAuthUrl('" + escaped + "');}}catch(e){}";
            webView.post(() -> {
                try {
                    webView.evaluateJavascript(js, null);
                } catch (Exception err) {
                    Log.w(TAG, "forwardOAuthUrlToWebView evaluateJavascript failed", err);
                }
            });
        } catch (Exception err) {
            Log.w(TAG, "forwardOAuthUrlToWebView failed", err);
        }
    }

    /**
     * Capacitor uses {@code androidScheme: https}, so the WebView origin is {@code https://localhost}.
     * Fetching a dev API at {@code http://10.0.2.2:3001} (or LAN IP) is mixed active content and is
     * blocked unless we allow it. Production API calls use HTTPS and are unaffected.
     */
    @Override
    public void onResume() {
        super.onResume();
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception ignored) {
            // WebView not ready yet; next resume will retry.
        }
    }

    /**
     * Without this, Android killing the WebView renderer (common on low-RAM phones right after the
     * post-login re-render that mounts the HOME view) propagates back to the Activity and the user
     * perceives it as the app "force-closing". We extend Capacitor's own {@link BridgeWebViewClient}
     * so every other callback (deep links, custom scheme handling, SSL errors, etc.) keeps working,
     * and only add the renderer-recovery hook. Returning {@code true} and reloading the WebView
     * keeps the host Activity alive and drops the user back on the SPA instead of crashing out.
     */
    private void installRenderProcessGoneRecovery() {
        try {
            final Bridge bridge = getBridge();
            if (bridge == null || bridge.getWebView() == null) {
                return;
            }
            final WebView webView = bridge.getWebView();
            webView.setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    boolean crashed = detail != null && detail.didCrash();
                    Log.w(
                        TAG,
                        "WebView renderer gone (didCrash=" + crashed + "). Recovering without closing app."
                    );
                    try {
                        if (view != null) {
                            // Detach current document before reloading; prevents the dead renderer's
                            // DOM from leaking into the recovered page and blowing memory again.
                            view.loadUrl("about:blank");
                            view.postDelayed(() -> {
                                try {
                                    view.reload();
                                } catch (Exception reloadErr) {
                                    Log.w(TAG, "WebView reload failed after renderer gone", reloadErr);
                                }
                            }, 250);
                        }
                    } catch (Exception err) {
                        Log.w(TAG, "Failed to recover after renderer gone", err);
                    }
                    return true;
                }
            });
        } catch (Exception err) {
            Log.w(TAG, "installRenderProcessGoneRecovery failed", err);
        }
    }
}

package com.reride.app;

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

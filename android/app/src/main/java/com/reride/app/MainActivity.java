package com.reride.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
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
}

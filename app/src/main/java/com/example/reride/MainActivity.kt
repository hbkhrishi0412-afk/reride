package com.example.reride

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler
import org.json.JSONObject

/**
 * Opens Google OAuth in Chrome Custom Tabs (see [AndroidOAuthBridge]) so Google does not block WebView
 * (403 disallowed_useragent). PKCE completes via [com.reride.app] deep link → JS
 * [window.__rerideNativeOAuthUrl].
 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", AssetsPathHandler(this))
            .build()

        webView = WebView(this)
        setContentView(webView)

        webView.addJavascriptInterface(AndroidOAuthBridge(this), "AndroidOAuth")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val uri = request.url
                val path = uri.path.orEmpty()

                if (path.startsWith("/api/")) return null

                if (uri.host != "appassets.androidplatform.net") return null

                return assetLoader.shouldInterceptRequest(uri)
            }
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false

        webView.loadUrl("https://appassets.androidplatform.net/index.html")
        handleOAuthIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleOAuthIntent(intent)
    }

    private fun handleOAuthIntent(intent: Intent?) {
        val dataStr = intent?.dataString ?: return
        if (!dataStr.startsWith("com.reride.app://oauth-callback")) return
        if (!::webView.isInitialized) return

        val quoted = JSONObject.quote(dataStr)
        webView.evaluateJavascript(
            "(function(u){try{if(window.__rerideNativeOAuthUrl){window.__rerideNativeOAuthUrl(u);}}catch(e){}})($quoted)",
            null
        )
    }
}

private class AndroidOAuthBridge(private val activity: ComponentActivity) {
    @JavascriptInterface
    fun openChromeTab(url: String) {
        activity.runOnUiThread {
            try {
                CustomTabsIntent.Builder().build().launchUrl(activity, Uri.parse(url))
            } catch (_: Exception) {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                activity.startActivity(intent)
            }
        }
    }
}

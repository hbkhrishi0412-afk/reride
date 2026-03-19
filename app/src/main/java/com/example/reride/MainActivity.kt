package com.example.reride

import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", AssetsPathHandler(this))
            .build()

        // Use a plain WebView to avoid dependency/classpath issues.
        // The critical fix for vehicles/Home is the /api/* interception rule below.
        val webView = WebView(this)
        setContentView(webView)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val uri = request.url
                val path = uri.path.orEmpty()

                // Important: DO NOT route backend API calls through WebViewAssetLoader.
                // Your frontend calls `/api/...` relative to the current origin (which becomes
                // `https://appassets.androidplatform.net/...` inside WebView). If we intercept it,
                // WebViewAssetLoader tries to find `assets/api/...` packaged resources and returns 404/empty.
                if (path.startsWith("/api/") || path == "/api") return null

                // Only intercept requests intended for the packaged web host.
                if (uri.host != "appassets.androidplatform.net") return null

                return assetLoader.shouldInterceptRequest(uri)
            }
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false

        webView.loadUrl("https://appassets.androidplatform.net/index.html")
    }
}
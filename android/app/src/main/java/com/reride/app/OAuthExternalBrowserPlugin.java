package com.reride.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens OAuth URLs in the user's default browser (Chrome) instead of Custom Tabs.
 * Custom Tabs often fail to hand off {@code com.reride.app://oauth-callback} to the app, leaving
 * users stuck on Google / Supabase after sign-in. External browser resolves the deep link reliably.
 */
@CapacitorPlugin(name = "OAuthExternalBrowser")
public class OAuthExternalBrowserPlugin extends Plugin {

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing url");
            return;
        }
        try {
            Uri uri = Uri.parse(url);
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No browser available to open sign-in", e);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }
}

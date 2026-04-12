/**
 * Android: opens Google/Supabase OAuth in the system browser (not Custom Tabs).
 * Registered native plugin: {@code OAuthExternalBrowser} in MainActivity.
 */
import { registerPlugin } from '@capacitor/core';

export interface OAuthExternalBrowserPlugin {
  openUrl(options: { url: string }): Promise<void>;
}

export const OAuthExternalBrowser = registerPlugin<OAuthExternalBrowserPlugin>(
  'OAuthExternalBrowser',
);

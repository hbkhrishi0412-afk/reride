/**
 * Google OAuth in Android WebView hits Error 403 disallowed_useragent — Google blocks embedded WebViews.
 * We open the Supabase OAuth URL in Chrome Custom Tabs / system browser and complete PKCE via deep link.
 */

import { Capacitor } from '@capacitor/core';
import { getSupabaseClient } from '../lib/supabase.js';

/** Must match Android intent-filter + Supabase Dashboard → Redirect URLs. */
export const NATIVE_OAUTH_REDIRECT = 'com.reride.app://oauth-callback';

let oauthReturnHandlerInstalled = false;
let lastHandledOAuthUrl = '';

export function shouldUseNativeGoogleOAuthFlow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (cap?.isNativePlatform?.() === true) return true;
  } catch {
    /* ignore */
  }
  const h = (window.location.hostname || '').toLowerCase();
  return (
    h === 'appassets.androidplatform.net' || h.includes('appassets.androidplatform.net')
  );
}

export function getNativeOAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return shouldUseNativeGoogleOAuthFlow() ? NATIVE_OAUTH_REDIRECT : undefined;
}

function parsePkceCodeFromCallbackUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const code = url.searchParams.get('code');
    if (code) return code;
    const hash = url.hash?.replace(/^#/, '') || '';
    if (hash) {
      const hp = new URLSearchParams(hash);
      return hp.get('code');
    }
  } catch {
    return null;
  }
  return null;
}

async function handleOAuthReturnUrl(url: string): Promise<void> {
  if (!url || url.indexOf('oauth-callback') === -1) return;
  if (url === lastHandledOAuthUrl) return;
  lastHandledOAuthUrl = url;

  const code = parsePkceCodeFromCallbackUrl(url);
  if (!code) {
    return;
  }

  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close().catch(() => {});
  } catch {
    /* not on Capacitor or plugin unavailable */
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn('[ReRide OAuth] exchangeCodeForSession:', error.message);
    }
  } catch (e) {
    console.warn('[ReRide OAuth] exchangeCodeForSession failed:', e);
  }
}

/**
 * Called once at startup. Handles:
 * - Capacitor: App URL open when returning from Custom Tab
 * - Standalone WebView: MainActivity.evaluateJavascript → window.__rerideNativeOAuthUrl(url)
 */
export function initNativeGoogleOAuthReturnHandler(): void {
  if (typeof window === 'undefined' || oauthReturnHandlerInstalled) return;
  oauthReturnHandlerInstalled = true;

  (window as unknown as { __rerideNativeOAuthUrl?: (u: string) => void }).__rerideNativeOAuthUrl =
    (u: string) => {
      void handleOAuthReturnUrl(u);
    };

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  void import('@capacitor/app').then(({ App }) => {
    App.addListener('appUrlOpen', ({ url }) => {
      void handleOAuthReturnUrl(url);
    });
    App.getLaunchUrl()
      .then((res) => {
        if (res?.url) void handleOAuthReturnUrl(res.url);
      })
      .catch(() => {});
  });
}

/** Opens Supabase Google OAuth URL in Custom Tab (Capacitor) or Android bridge; never in embedded WebView. */
export async function openGoogleOAuthUrl(oauthUrl: string): Promise<void> {
  if (!oauthUrl) return;

  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: oauthUrl });
    return;
  }

  const bridge = (window as unknown as { AndroidOAuth?: { openChromeTab?: (u: string) => void } })
    .AndroidOAuth;
  if (bridge?.openChromeTab) {
    bridge.openChromeTab(oauthUrl);
    return;
  }

  window.location.assign(oauthUrl);
}

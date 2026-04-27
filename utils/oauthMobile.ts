/**
 * Google OAuth in Android WebView hits Error 403 disallowed_useragent — Google blocks embedded WebViews.
 * We open the Supabase OAuth URL in Chrome Custom Tabs / system browser and complete PKCE via deep link.
 */

import { Capacitor } from '@capacitor/core';
import { getSupabaseClient } from '../lib/supabase.js';
import { OAuthExternalBrowser } from './oauthExternalBrowser';
import { isAndroidAppAssetsHost } from './apiConfig';

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
  const h = window.location.hostname || '';
  return isAndroidAppAssetsHost(h);
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

function parseOAuthErrorFromCallbackUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const desc = url.searchParams.get('error_description');
    const err = url.searchParams.get('error');
    const raw = desc || err;
    if (!raw) return null;
    try {
      return decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

function dispatchOAuthFailed(message: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent('reride:oauth-failed', { detail: { message } }),
    );
  } catch {
    /* ignore */
  }
}

async function closeOAuthBrowser(): Promise<void> {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close().catch(() => {});
  } catch {
    /* not on Capacitor or plugin unavailable */
  }
}

async function handleOAuthReturnUrl(url: string): Promise<void> {
  if (!url || url.indexOf('oauth-callback') === -1) return;
  if (url === lastHandledOAuthUrl) return;

  const oauthErr = parseOAuthErrorFromCallbackUrl(url);
  if (oauthErr) {
    lastHandledOAuthUrl = url;
    await closeOAuthBrowser();
    dispatchOAuthFailed(oauthErr);
    return;
  }

  const code = parsePkceCodeFromCallbackUrl(url);
  if (!code) {
    lastHandledOAuthUrl = url;
    await closeOAuthBrowser();
    dispatchOAuthFailed(
      'Google sign-in did not return to the app. In Supabase Dashboard → Authentication → URL Configuration, add redirect URL: com.reride.app://oauth-callback',
    );
    console.warn(
      '[ReRide OAuth] Callback had no ?code=. If Chrome showed your website (e.g. eride.co.in) instead of closing, Supabase is not redirecting to the app deep link.',
    );
    return;
  }

  lastHandledOAuthUrl = url;

  await closeOAuthBrowser();

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn('[ReRide OAuth] exchangeCodeForSession:', error.message);
      dispatchOAuthFailed(
        error.message || 'Could not finish Google sign-in. Try again or use email sign-in.',
      );
      lastHandledOAuthUrl = '';
    }
  } catch (e) {
    console.warn('[ReRide OAuth] exchangeCodeForSession failed:', e);
    dispatchOAuthFailed(
      e instanceof Error ? e.message : 'Could not finish Google sign-in. Try again.',
    );
    lastHandledOAuthUrl = '';
  }
}

/**
 * Called once at startup. Handles:
 * - Capacitor: {@code appUrlOpen} when returning from the system browser deep link
 * - Capacitor: {@code appStateChange} (resume) — re-checks {@code getLaunchUrl()} so OEMs
 *   that drop {@code appUrlOpen} (MIUI/ColorOS battery savers, cold-start races) still
 *   exchange the PKCE code once the WebView is foregrounded again
 * - Standalone WebView: {@code MainActivity.evaluateJavascript} → {@code window.__rerideNativeOAuthUrl(url)}
 *
 * Dedupe on {@code lastHandledOAuthUrl} means the overlapping paths are safe to run together.
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

    const checkLaunchUrl = () => {
      App.getLaunchUrl()
        .then((res) => {
          if (res?.url) void handleOAuthReturnUrl(res.url);
        })
        .catch(() => {});
    };

    // Initial check on cold start (app was launched directly by the deep link).
    checkLaunchUrl();

    // Resume check: user returns from the external browser. MainActivity.onNewIntent has
    // already called setIntent(), so getLaunchUrl() now returns the fresh oauth-callback URL.
    // Guarded by lastHandledOAuthUrl so we only run the PKCE exchange once per callback.
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) checkLaunchUrl();
    });

    App.addListener('resume', () => {
      checkLaunchUrl();
    });
  });
}

/** Opens Supabase Google OAuth URL in Custom Tab (Capacitor) or Android bridge; never in embedded WebView. */
export async function openGoogleOAuthUrl(oauthUrl: string): Promise<void> {
  if (!oauthUrl) return;

  if (Capacitor.isNativePlatform()) {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await OAuthExternalBrowser.openUrl({ url: oauthUrl });
        return;
      } catch (e) {
        console.warn('[ReRide OAuth] System browser open failed; falling back to in-app browser.', e);
      }
    }
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

  window.location.replace(oauthUrl);
}

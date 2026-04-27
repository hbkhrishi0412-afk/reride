/**
 * Google OAuth in a plain WebView hits 403 (disallowed user agent) or endless loading. Android uses
 * Chrome Custom Tabs in OAuthExternalBrowserPlugin; iOS may use the Capacitor Browser (Safari VC).
 * PKCE return: com.reride.app://oauth-callback (see handleOAuthReturnUrl).
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

/**
 * Supabase custom-scheme returns usually look like
 * `com.reride.app://oauth-callback?code=...&state=...` (code in search).
 * Some stacks put params in the fragment; mirror `consumeWebSupabaseOAuthCallback` heuristics.
 */
function parsePkceCodeFromCallbackUrl(urlString: string): string | null {
  try {
    const u = new URL(urlString);
    const fromQuery = u.searchParams.get('code');
    if (fromQuery) {
      return fromQuery;
    }
    const hash = u.hash?.replace(/^#/, '') || '';
    if (!hash) {
      return null;
    }
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) {
      const hp = new URLSearchParams(hash.slice(qIdx + 1));
      const c = hp.get('code');
      if (c) {
        return c;
      }
    }
    if (!hash.startsWith('/')) {
      const hp = new URLSearchParams(hash);
      const c = hp.get('code');
      if (c) {
        return c;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function parseOAuthErrorFromCallbackUrl(urlString: string): string | null {
  const decode = (raw: string): string => {
    try {
      return decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      return raw;
    }
  };
  const pick = (err: string | null, desc: string | null): string | null => {
    const raw = desc || err;
    if (!raw) {
      return null;
    }
    return decode(raw);
  };
  try {
    const u = new URL(urlString);
    const fromQuery = pick(u.searchParams.get('error'), u.searchParams.get('error_description'));
    if (fromQuery) {
      return fromQuery;
    }
    const hash = u.hash?.replace(/^#/, '') || '';
    if (!hash) {
      return null;
    }
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) {
      const hp = new URLSearchParams(hash.slice(qIdx + 1));
      const p = pick(hp.get('error'), hp.get('error_description'));
      if (p) {
        return p;
      }
    }
    if (!hash.startsWith('/')) {
      const hp = new URLSearchParams(hash);
      return pick(hp.get('error'), hp.get('error_description'));
    }
  } catch {
    return null;
  }
  return null;
}

function dispatchNativeOAuthFailed(message: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent('reride:native-oauth-failed', { detail: { message } }),
    );
  } catch {
    /* ignore */
  }
}

/** Supabase authorize / Google account pages must not be opened in Capacitor’s in-app Browser (WebView). */
function isSupabaseOrGoogleOAuthUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h === 'accounts.google.com' || h.endsWith('.google.com')) {
      return true;
    }
    if (h.endsWith('.supabase.co') && u.pathname.includes('/auth/')) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
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
  if (!url || !/oauth-callback/i.test(url)) {
    return;
  }
  if (url === lastHandledOAuthUrl) {
    return;
  }

  const oauthErr = parseOAuthErrorFromCallbackUrl(url);
  if (oauthErr) {
    lastHandledOAuthUrl = url;
    await closeOAuthBrowser();
    dispatchNativeOAuthFailed(oauthErr);
    return;
  }

  const code = parsePkceCodeFromCallbackUrl(url);
  if (!code) {
    lastHandledOAuthUrl = url;
    await closeOAuthBrowser();
    dispatchNativeOAuthFailed(
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
    if (typeof supabase.auth.exchangeCodeForSession !== 'function') {
      console.error(
        '[ReRide OAuth] exchangeCodeForSession missing — check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
      );
      dispatchNativeOAuthFailed('Could not complete sign-in. Reinstall the app or contact support.');
      lastHandledOAuthUrl = '';
      return;
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const m = (error.message || '').toLowerCase();
      const isBenignRace =
        m.includes('already') ||
        m.includes('invalid_grant') ||
        m.includes('bad request') ||
        m.includes('code verifier') ||
        m.includes('expired');
      if (!isBenignRace) {
        console.warn('[ReRide OAuth] exchangeCodeForSession:', error.message);
      }
      const {
        data: { session: after },
      } = await supabase.auth.getSession();
      if (after) {
        return;
      }
      dispatchNativeOAuthFailed(
        error.message || 'Could not finish Google sign-in. Try again or use email sign-in.',
      );
      lastHandledOAuthUrl = '';
    }
  } catch (e) {
    console.warn('[ReRide OAuth] exchangeCodeForSession failed:', e);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session: after },
      } = await supabase.auth.getSession();
      if (after) {
        return;
      }
    } catch {
      /* ignore */
    }
    dispatchNativeOAuthFailed(
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

/** Opens Supabase Google OAuth in Chrome Custom Tabs (Android) or SFSafariViewController; never WebView. */
export async function openGoogleOAuthUrl(oauthUrl: string): Promise<void> {
  if (!oauthUrl) return;

  if (Capacitor.isNativePlatform()) {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await OAuthExternalBrowser.openUrl({ url: oauthUrl });
        return;
      } catch (e) {
        console.warn('[ReRide OAuth] Custom Tabs / system open failed.', e);
        if (isSupabaseOrGoogleOAuthUrl(oauthUrl)) {
          dispatchNativeOAuthFailed(
            'Sign-in could not open in the browser. Add VITE_GOOGLE_WEB_CLIENT_ID to use built-in Google sign-in, or ensure Chrome is installed and try again.',
          );
          return;
        }
      }
    } else {
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: oauthUrl });
        return;
      } catch (e) {
        console.warn('[ReRide OAuth] Browser.open failed (iOS).', e);
        if (isSupabaseOrGoogleOAuthUrl(oauthUrl)) {
          dispatchNativeOAuthFailed(
            'Sign-in could not open. Set VITE_GOOGLE_WEB_CLIENT_ID for native Google sign-in or try again.',
          );
        }
        return;
      }
    }
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

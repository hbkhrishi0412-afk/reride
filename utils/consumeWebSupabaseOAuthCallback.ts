/**
 * After Google OAuth, Supabase redirects to the SPA with `?code=` (PKCE).
 * On mobile Chrome / in-app browsers, `detectSessionInUrl` sometimes never completes
 * before the UI renders, so the user stays "Guest". Exchange explicitly as early as possible.
 * Native Android/iOS use `com.reride.app://` + `oauthMobile.handleOAuthReturnUrl` instead.
 */

import { Capacitor } from '@capacitor/core';
import { getSupabaseClient } from '../lib/supabase.js';

function stripOAuthParamsFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('code') && !url.searchParams.has('state')) return;
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    const qs = url.searchParams.toString();
    const next = `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', next);
  } catch {
    /* ignore */
  }
}

/**
 * Await this before React mounts so PKCE completes before AppProvider's first getSession()
 * (otherwise session-restore logic could "give up" while the session is still being created).
 */
export async function completeWebSupabaseOAuthCallbackIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (Capacitor.isNativePlatform()) return;

  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const supabase = getSupabaseClient();
    const auth = supabase.auth as {
      getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
      exchangeCodeForSession?: (c: string) => Promise<{ error?: { message?: string } | null }>;
    };
    if (typeof auth.exchangeCodeForSession !== 'function') return;

    const {
      data: { session: before },
    } = await auth.getSession();
    if (before) {
      stripOAuthParamsFromUrl();
      return;
    }

    const { error } = await auth.exchangeCodeForSession(code);
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (!m.includes('already') && !m.includes('invalid_grant') && !m.includes('bad request')) {
        console.warn('[ReRide OAuth] Web exchangeCodeForSession:', error.message);
        try {
          window.dispatchEvent(
            new CustomEvent('reride:oauth-failed', {
              detail: {
                message:
                  error.message ||
                  'Sign-in could not be completed. Try again, or use email sign-in. If you use a private window, try a normal one.',
              },
            }),
          );
        } catch {
          /* ignore */
        }
      }
      return;
    }

    stripOAuthParamsFromUrl();
  } catch (e) {
    console.warn('[ReRide OAuth] Web callback consume failed:', e);
  }
}

/** @deprecated Prefer awaiting {@link completeWebSupabaseOAuthCallbackIfNeeded} before mount. */
export function consumeWebSupabaseOAuthCallbackIfNeeded(): void {
  void completeWebSupabaseOAuthCallbackIfNeeded();
}

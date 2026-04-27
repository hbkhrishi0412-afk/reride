/**
 * After Google OAuth, Supabase redirects to the SPA with `?code=` (PKCE).
 * On mobile Chrome / in-app browsers, `detectSessionInUrl` sometimes never completes
 * before the UI renders, so the user stays "Guest". Exchange explicitly as early as possible.
 * Native: primary path is `com.reride.app://` + `oauthMobile.handleOAuthReturnUrl` (no `code` in
 * `window.location`). If a misconfiguration leaves `?code=` on the Capacitor WebView URL
 * (`https://localhost/...` or `appassets...`), the same early exchange runs so PKCE is not lost.
 */

import { getSupabaseClient } from '../lib/supabase.js';

function getPkceCodeAndStateFromLocation(): { code: string | null; state: string | null } {
  const fromSearch = new URLSearchParams(window.location.search);
  let code = fromSearch.get('code');
  let state = fromSearch.get('state');
  if (code) {
    return { code, state };
  }

  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx >= 0) {
    const hp = new URLSearchParams(hash.slice(qIdx + 1));
    code = hp.get('code');
    state = hp.get('state');
    if (code) {
      return { code, state };
    }
  }

  const bare = hash.replace(/^#/, '');
  if (bare && !bare.startsWith('/')) {
    const hp = new URLSearchParams(bare);
    code = hp.get('code');
    state = hp.get('state');
  }
  return { code, state };
}

function stripOAuthParamsFromUrl(): void {
  try {
    const u = new URL(window.location.href);
    let changed = false;
    if (u.searchParams.has('code') || u.searchParams.has('state')) {
      u.searchParams.delete('code');
      u.searchParams.delete('state');
      changed = true;
    }
    if (u.hash) {
      const h = u.hash;
      const qm = h.indexOf('?');
      if (qm >= 0) {
        const pathPart = h.slice(0, qm);
        const hp = new URLSearchParams(h.slice(qm + 1));
        if (hp.has('code') || hp.has('state')) {
          hp.delete('code');
          hp.delete('state');
          const rest = hp.toString();
          u.hash = `${pathPart}${rest ? `?${rest}` : ''}`;
          changed = true;
        }
      } else {
        const noHash = h.replace(/^#/, '');
        if (noHash && !noHash.startsWith('/')) {
          const hp = new URLSearchParams(noHash);
          if (hp.has('code') || hp.has('state')) {
            hp.delete('code');
            hp.delete('state');
            const rest = hp.toString();
            u.hash = rest ? `#${rest}` : '';
            changed = true;
          }
        }
      }
    }
    if (!changed) return;
    const next = `${u.pathname}${u.search}${u.hash}`;
    window.history.replaceState(window.history.state, '', next);
  } catch {
    /* ignore */
  }
}

function stripOAuthErrorParamsFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (
      !url.searchParams.has('error') &&
      !url.searchParams.has('error_description') &&
      !url.searchParams.has('error_code')
    ) {
      return;
    }
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    url.searchParams.delete('error_code');
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

  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('error') || searchParams.get('error_description')) {
      stripOAuthErrorParamsFromUrl();
      return;
    }

    const { code } = getPkceCodeAndStateFromLocation();
    if (!code) return;

    const supabase = getSupabaseClient();
    const auth = supabase.auth as {
      getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
      exchangeCodeForSession?: (c: string) => Promise<{ error?: { message?: string } | null }>;
    };
    if (typeof auth.exchangeCodeForSession !== 'function') {
      console.error(
        '[ReRide OAuth] Supabase client cannot exchange PKCE (missing exchangeCodeForSession). ' +
          'Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY and rebuild.',
      );
      return;
    }

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
      const isBenignRace =
        m.includes('already') ||
        m.includes('invalid_grant') ||
        m.includes('bad request') ||
        m.includes('code verifier') ||
        m.includes('expired');
      if (!isBenignRace) {
        console.warn('[ReRide OAuth] exchangeCodeForSession (document):', error.message);
      }
      const {
        data: { session: after },
      } = await auth.getSession();
      if (after) {
        stripOAuthParamsFromUrl();
      }
      return;
    }

    stripOAuthParamsFromUrl();
  } catch (e) {
    console.warn('[ReRide OAuth] Document callback consume failed:', e);
  }
}

/** @deprecated Prefer awaiting {@link completeWebSupabaseOAuthCallbackIfNeeded} before mount. */
export function consumeWebSupabaseOAuthCallbackIfNeeded(): void {
  void completeWebSupabaseOAuthCallbackIfNeeded();
}

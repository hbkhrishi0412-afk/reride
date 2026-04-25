/**
 * Read JWT / session tokens from browser storage in a way that matches how the app
 * actually persists auth (custom reRide tokens + Supabase JS localStorage keys).
 *
 * Supabase v2 stores sessions under keys like `sb-<project-ref>-auth-token`, not `sb-access-token`.
 *
 * On first-party web, refresh tokens are HttpOnly cookies (not readable from JS); access JWTs
 * for the custom app flow live in sessionStorage when that mode is active.
 */

import { resolveApiUrl, isCapacitorNative, isApiRequestCrossOrigin } from './apiConfig';

/** First-party web: refresh token is HttpOnly; Capacitor / cross-API-origin still use JSON + localStorage. */
export function useHttpOnlyRefreshCookie(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCapacitorNative()) return false;
  try {
    return !isApiRequestCrossOrigin(resolveApiUrl('/api/users'));
  } catch {
    return false;
  }
}

/** Standard JWT: three base64url segments (header.payload.sig). */
function looksLikeJwt(s: string): boolean {
  const t = s.trim();
  if (t.length < 20) return false;
  const parts = t.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/** `exp` claim in seconds, or null if missing/unparseable. */
function jwtExpSeconds(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function tryParseAccessToken(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('eyJ')) {
    return trimmed;
  }
  try {
    const parsed = JSON.parse(raw) as {
      access_token?: string;
      currentSession?: { access_token?: string };
    };
    const t = parsed?.access_token ?? parsed?.currentSession?.access_token;
    return typeof t === 'string' && t.length > 10 ? t : null;
  } catch {
    return null;
  }
}

/**
 * Returns Supabase access_token from localStorage if present (any supported key shape).
 */
export function getSupabaseAccessTokenFromStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const direct =
      tryParseAccessToken(localStorage.getItem('sb-access-token')) ||
      tryParseAccessToken(localStorage.getItem('supabase.auth.token'));
    if (direct) return direct;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const t = tryParseAccessToken(localStorage.getItem(key));
      if (t) return t;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Remove persisted Supabase Auth keys from localStorage without calling the network.
 * Global `signOut()` hits `logout?scope=global` and returns 403 when the JWT is already invalid,
 * which blocks logout; use `signOut({ scope: 'local' })` plus this as a safety net.
 */
export function clearSupabaseAuthStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === 'sb-access-token' || key === 'supabase.auth.token') {
        toRemove.push(key);
        continue;
      }
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function getCustomJwtFromBrowserStorage(): string | null {
  if (typeof window === 'undefined') return null;
  let custom: string | null = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      custom = sessionStorage.getItem('reRideAccessToken');
    }
    if (!custom && typeof localStorage !== 'undefined') {
      custom = localStorage.getItem('reRideAccessToken');
    }
  } catch {
    return null;
  }
  if (!custom || custom.trim().length <= 10) return null;
  const t = custom.trim();
  if (!looksLikeJwt(t)) return null;
  const exp = jwtExpSeconds(t);
  const nowSec = Math.floor(Date.now() / 1000);
  const bufferSec = 60;
  if (exp != null && exp > nowSec + bufferSec) {
    return t;
  }
  const supa = getSupabaseAccessTokenFromStorage();
  if (supa) return supa;
  return t;
}

export function clearSessionStoredAccessToken(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('reRideAccessToken');
    }
  } catch {
    /* ignore */
  }
}

/**
 * Prefer custom app JWT, then Supabase session token (website + mobile WebView).
 * If reRideAccessToken is present but not JWT-shaped (corrupt/legacy), fall back to Supabase
 * so API routes can use verifyIdTokenFromHeader after legacy verifyToken would fail.
 */
export function getBrowserAccessTokenForApi(): string | null {
  try {
    if (typeof localStorage === 'undefined' && typeof sessionStorage === 'undefined') return null;
    const customJwt = getCustomJwtFromBrowserStorage();
    if (customJwt) return customJwt;
    return getSupabaseAccessTokenFromStorage();
  } catch {
    return null;
  }
}

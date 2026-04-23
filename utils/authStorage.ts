/**
 * Read JWT / session tokens from browser storage in a way that matches how the app
 * actually persists auth (custom reRide tokens + Supabase JS localStorage keys).
 *
 * Supabase v2 stores sessions under keys like `sb-<project-ref>-auth-token`, not `sb-access-token`.
 */

/** Standard JWT: three base64url segments (header.payload.sig). */
function looksLikeJwt(s: string): boolean {
  const t = s.trim();
  if (t.length < 20) return false;
  const parts = t.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
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
 * Prefer custom app JWT, then Supabase session token (website + mobile WebView).
 * If reRideAccessToken is present but not JWT-shaped (corrupt/legacy), fall back to Supabase
 * so API routes can use verifyIdTokenFromHeader after legacy verifyToken would fail.
 */
export function getBrowserAccessTokenForApi(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const custom = localStorage.getItem('reRideAccessToken');
    if (custom && custom.trim().length > 10) {
      const t = custom.trim();
      if (looksLikeJwt(t)) return t;
    }
    return getSupabaseAccessTokenFromStorage();
  } catch {
    return null;
  }
}

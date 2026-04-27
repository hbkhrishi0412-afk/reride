/**
 * Read `token` for /forgot-password from both standard query and hash-based routes.
 * Capacitor uses HashRouter: `https://app/#/forgot-password?token=...` — there is often no
 * `window.location.search`, so the token lives after `?` inside `location.hash`.
 */

export function getPasswordResetTokenFromBrowser(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromSearch = new URLSearchParams(window.location.search).get('token')?.trim();
    if (fromSearch) return fromSearch;

    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) {
      const fromHash = new URLSearchParams(hash.slice(qIdx + 1)).get('token')?.trim();
      if (fromHash) return fromHash;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseRecoverySignalsFromBrowser(): {
  hasUsersTableToken: boolean;
  hasSupabaseRecovery: boolean;
} {
  if (typeof window === 'undefined') {
    return { hasUsersTableToken: false, hasSupabaseRecovery: false };
  }
  if (getPasswordResetTokenFromBrowser()) {
    return { hasUsersTableToken: true, hasSupabaseRecovery: false };
  }
  try {
    const search = new URLSearchParams(window.location.search);
    if (search.get('type') === 'recovery' || search.get('code')) {
      return { hasUsersTableToken: false, hasSupabaseRecovery: true };
    }

    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    const inHash = qIdx >= 0 ? new URLSearchParams(hash.slice(qIdx + 1)) : null;
    if (
      inHash?.get('type') === 'recovery' ||
      inHash?.get('code') ||
      hash.includes('type=recovery')
    ) {
      return { hasUsersTableToken: false, hasSupabaseRecovery: true };
    }
  } catch {
    /* ignore */
  }
  return { hasUsersTableToken: false, hasSupabaseRecovery: false };
}

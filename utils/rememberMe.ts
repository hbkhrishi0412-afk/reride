/**
 * Remember Me — tab-scoped auth persistence
 *
 * When the user ticks "Remember me" we behave as before: Supabase persists the
 * session to localStorage and reRideCurrentUser survives browser restarts.
 *
 * When the user does NOT tick "Remember me" we want the session to end when the
 * last tab closes. Rather than swapping Supabase's storage adapter (which would
 * require reconfiguring an already-initialised client and break the many places
 * that read `localStorage.getItem('reRideCurrentUser')` directly), we use a
 * small bootstrap step:
 *
 *   • On successful login we write the user's preference to localStorage and
 *     stamp sessionStorage with a "tab alive" marker.
 *   • On every app boot (before React renders) we check: if the preference is
 *     "don't remember" AND there is no tab-alive marker in the current
 *     sessionStorage, the previous browser session is over — clear all auth
 *     data from localStorage so the user appears logged out.
 *
 * Result: within a single tab/window the app behaves normally; once all tabs
 * close, the "don't remember" user is logged out on the next launch.
 */
const PREF_KEY = 'reride_remember_me';
const ALIVE_KEY = 'reride_session_alive';

const AUTH_LOCAL_KEYS = [
  'reRideCurrentUser',
  'reRideAccessToken',
  'reRideRefreshToken',
];

function getLocal(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function getSession(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** Clear every Supabase-managed auth token from localStorage (keys look like `sb-<ref>-auth-token`). */
function clearSupabaseAuthTokens(): void {
  const ls = getLocal();
  if (!ls) return;
  const toRemove: string[] = [];
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i);
    if (!key) continue;
    if (
      key.startsWith('sb-') &&
      (key.endsWith('-auth-token') ||
        key.endsWith('-auth-token-code-verifier') ||
        key.includes('-auth-token.'))
    ) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => {
    try {
      ls.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Run once at app bootstrap (before Supabase client and user restoration).
 * Drops stale auth data when the user opted out of "Remember me" in the
 * previous browser session.
 */
export function enforceRememberMePolicyOnBoot(): void {
  const ls = getLocal();
  const ss = getSession();
  if (!ls || !ss) return;

  let pref: string | null = null;
  try {
    pref = ls.getItem(PREF_KEY);
  } catch {
    return;
  }

  // Default (no preference recorded yet) and explicit "true" → keep session.
  if (pref !== 'false') {
    try {
      ss.setItem(ALIVE_KEY, '1');
    } catch {
      /* ignore */
    }
    return;
  }

  // Preference is "don't remember".
  let alive: string | null = null;
  try {
    alive = ss.getItem(ALIVE_KEY);
  } catch {
    /* ignore */
  }

  if (alive === '1') {
    // Same tab / same navigation — keep session.
    return;
  }

  // New browser session for a user who did NOT check remember me — log them out.
  AUTH_LOCAL_KEYS.forEach((k) => {
    try {
      ls.removeItem(k);
    } catch {
      /* ignore */
    }
  });
  clearSupabaseAuthTokens();

  try {
    ls.removeItem(PREF_KEY);
  } catch {
    /* ignore */
  }
}

/** Record the user's "Remember me" choice right after a successful login. */
export function setRememberMePreference(remember: boolean): void {
  const ls = getLocal();
  const ss = getSession();
  try {
    ls?.setItem(PREF_KEY, remember ? 'true' : 'false');
  } catch {
    /* ignore */
  }
  try {
    ss?.setItem(ALIVE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Clear remember-me state on logout so the next sign-in starts from a clean slate. */
export function clearRememberMeState(): void {
  const ls = getLocal();
  const ss = getSession();
  try {
    ls?.removeItem(PREF_KEY);
  } catch {
    /* ignore */
  }
  try {
    ss?.removeItem(ALIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function getRememberMePreference(): boolean {
  const ls = getLocal();
  try {
    return ls?.getItem(PREF_KEY) !== 'false';
  } catch {
    return true;
  }
}

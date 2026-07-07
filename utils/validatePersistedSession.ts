import type { User } from '../types.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { getBrowserAccessTokenForApi } from './authStorage.js';
import { isTokenLikelyValid, refreshAuthToken } from './authenticatedFetch.js';
import { isCapacitorNative } from './apiConfig.js';
import { getNativeMemoryRefreshToken } from './nativeTokenStorage.js';
import { useHttpOnlyRefreshCookie } from './authStorage.js';

const VALID_ROLES = ['customer', 'seller', 'admin', 'service_provider', 'finance_partner'] as const;

function hasLikelyRefreshSource(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('reRideRefreshToken')) return true;
    if (isCapacitorNative()) {
      if (getNativeMemoryRefreshToken()) return true;
      if (localStorage.getItem('reRideCurrentUser')) return true;
    }
    if (useHttpOnlyRefreshCookie() && localStorage.getItem('reRideCurrentUser')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Read and normalize a persisted user snapshot (no token validation). */
export function readPersistedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const savedUser = localStorage.getItem('reRideCurrentUser');
    const savedSession = sessionStorage.getItem('currentUser');
    const raw = savedUser || savedSession;
    if (!raw) return null;

    const user = JSON.parse(raw) as User;
    if (!user?.email || typeof user.email !== 'string') return null;

    if (!user.role || typeof user.role !== 'string') {
      user.role = user.dealershipName ? 'seller' : 'customer';
    }
    if (!VALID_ROLES.includes(user.role as (typeof VALID_ROLES)[number])) {
      user.role = 'customer';
    }
    return user;
  } catch {
    return null;
  }
}

export function clearPersistedUserSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('reRideCurrentUser');
    sessionStorage.removeItem('currentUser');
  } catch {
    /* ignore */
  }
}

function hasUsableApiToken(): boolean {
  return !!getBrowserAccessTokenForApi();
}

/**
 * Attempt to restore API credentials (app JWT or Supabase access token) for persisted sessions.
 * Call before authenticated API requests when the UI was restored from localStorage alone.
 */
export async function rehydrateApiCredentials(): Promise<boolean> {
  if (hasUsableApiToken() && isTokenLikelyValid()) {
    return true;
  }

  if (hasLikelyRefreshSource()) {
    try {
      const refreshed = await refreshAuthToken();
      if (refreshed && hasUsableApiToken()) {
        return true;
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const { resolveSupabaseAccessTokenForApi } = await import('./authStorage.js');
    await resolveSupabaseAccessTokenForApi(2500);
    if (hasUsableApiToken()) {
      return true;
    }
  } catch {
    /* fall through */
  }

  const user = readPersistedUser();
  if (user?.email) {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token && session.user) {
        const role: 'customer' | 'seller' =
          user.role === 'seller' || user.role === 'admin' ? 'seller' : 'customer';
        const meta = (session.user.app_metadata ?? {}) as Record<string, unknown>;
        const authProvider: 'google' | 'phone' | 'email' =
          meta.provider === 'google' ? 'google' : session.user.phone ? 'phone' : 'email';
        const { syncWithBackend } = await import('../services/supabase-auth-service.js');
        const result = await syncWithBackend(
          session.user as Record<string, unknown>,
          role,
          authProvider,
          session.access_token,
        );
        if (result.success && hasUsableApiToken()) {
          return true;
        }
        if (session.access_token) {
          return true;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return hasUsableApiToken();
}

/**
 * Returns true when persisted credentials can still authenticate API calls.
 * Supabase-only sessions (no custom JWT yet) also qualify after rehydration.
 */
export async function isPersistedSessionAuthenticated(): Promise<boolean> {
  const user = readPersistedUser();
  if (!user) return false;
  return rehydrateApiCredentials();
}

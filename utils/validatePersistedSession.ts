import type { User } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { getBrowserAccessTokenForApi } from './authStorage';
import { isTokenLikelyValid, refreshAuthToken } from './authenticatedFetch';
import { isDevelopmentEnvironment } from './environment';
import { isCapacitorNative } from './apiConfig';
import { getNativeMemoryRefreshToken } from './nativeTokenStorage';
import { useHttpOnlyRefreshCookie } from './authStorage';

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

/**
 * Returns true when persisted credentials can still authenticate API calls.
 * Supabase-only sessions (no custom JWT yet) also qualify.
 */
export async function isPersistedSessionAuthenticated(): Promise<boolean> {
  const user = readPersistedUser();
  if (!user) return false;
  if (isDevelopmentEnvironment()) return true;

  if (getBrowserAccessTokenForApi() && isTokenLikelyValid()) {
    return true;
  }

  if (hasLikelyRefreshSource()) {
    try {
      const refreshed = await refreshAuthToken();
      if (refreshed && getBrowserAccessTokenForApi()) {
        return true;
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

/**
 * Service-provider dashboard API calls (web + Capacitor).
 * Uses authenticatedFetch so cross-origin WebView gets JWT + X-App-Client + CSRF.
 *
 * Providers often sign in via email/password (legacy reRide JWT), not Supabase OAuth.
 * Prefer getBrowserAccessTokenForApi before getValidAccessToken so refreshSession is not
 * called without a Supabase session (which surfaces as "Auth session missing!").
 */
import { authenticatedFetch } from './authenticatedFetch.js';
import { getBrowserAccessTokenForApi } from './authStorage.js';
import { getValidAccessToken } from '../services/supabase-auth-service.js';

export async function spApiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (getBrowserAccessTokenForApi()) {
    return authenticatedFetch(path, init);
  }

  const t = await getValidAccessToken();
  if (!t.success || !t.accessToken) {
    throw new Error(t.reason || 'Not authenticated. Please sign in again.');
  }
  return authenticatedFetch(path, init);
}

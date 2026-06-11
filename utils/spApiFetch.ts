/**
 * Service-provider dashboard API calls (web + Capacitor).
 * Uses authenticatedFetch so cross-origin WebView gets JWT + X-App-Client + CSRF.
 */
import { authenticatedFetch } from './authenticatedFetch.js';
import { getValidAccessToken } from '../services/supabase-auth-service.js';

export async function spApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const t = await getValidAccessToken();
  if (!t.success || !t.accessToken) {
    throw new Error(t.reason || 'Not authenticated. Please sign in again.');
  }
  return authenticatedFetch(path, init);
}

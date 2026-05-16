/**
 * Single entry for app → API calls. Resolves Capacitor/cross-origin URLs,
 * credentials, CSRF, and X-App-Client via authenticatedFetch.
 */
export { authenticatedFetch, ensureCsrfToken, getAuthHeaders, handleApiResponse } from './authenticatedFetch';

import { authenticatedFetch } from './authenticatedFetch';

/** Public endpoints (GET/HEAD or CSRF-exempt POST). No Authorization header. */
export function publicApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return authenticatedFetch(path, { ...init, skipAuth: true });
}

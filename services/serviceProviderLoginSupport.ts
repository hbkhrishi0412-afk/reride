import type { User } from '../types.js';
import { getBrowserAccessTokenForApi } from '../utils/authStorage.js';
import { authenticatedFetch } from '../utils/authenticatedFetch.js';
import { login } from './userService.js';

/**
 * Build a minimal car-services dashboard profile from a `users` row when
 * `service_providers` has no row yet (e.g. role just switched to service_provider).
 */
export function userToServiceProviderProfile(user: User): Record<string, unknown> {
  return {
    id: user.id,
    uid: user.id,
    name: user.name,
    email: user.email,
    phone: user.mobile,
    city: user.location || '',
    state: (user as { state?: string }).state,
    district: (user as { district?: string }).district,
  };
}

export async function fetchServiceProviderProfileWithAppJwt(): Promise<Record<string, unknown> | null> {
  const token = getBrowserAccessTokenForApi();
  if (!token) return null;
  try {
    const resp = await authenticatedFetch('/api/service-providers');
    if (!resp.ok) return null;
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Prefer API profile when present; otherwise build a dashboard stub from the users row. */
export function providerFromLoginUser(
  user: User,
  apiProfile?: Record<string, unknown> | null,
): Record<string, unknown> {
  return apiProfile ?? userToServiceProviderProfile(user);
}

function enrichServiceProviderProfileInBackground(): void {
  void fetchServiceProviderProfileWithAppJwt().then((apiProfile) => {
    if (!apiProfile || typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent('serviceProviderProfileUpdated', { detail: { profile: apiProfile } }),
      );
    } catch {
      /* ignore */
    }
  });
}

/**
 * Service provider email/password sign-in via `public.users` (bcrypt) + JWT from POST /api/users.
 * Returns a usable provider immediately; extended `service_providers` fields hydrate in the background.
 */
export async function loginServiceProviderWithUsersTable(
  email: string,
  password: string,
): Promise<{ ok: true; provider: Record<string, unknown> } | { ok: false; message: string }> {
  const result = await login({ email, password, role: 'service_provider' });
  if (!result.success || !result.user) {
    return { ok: false, message: result.reason || 'Login failed' };
  }
  const provider = providerFromLoginUser(result.user);
  enrichServiceProviderProfileInBackground();
  return { ok: true, provider };
}

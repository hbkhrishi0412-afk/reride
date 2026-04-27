import type { User } from '../types';
import { getBrowserAccessTokenForApi } from '../utils/authStorage';
import { login } from './userService';

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
    const resp = await fetch('/api/service-providers', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Service provider email/password sign-in via `public.users` (bcrypt) + JWT from POST /api/users,
 * then loads extended profile from `service_providers` when present.
 */
export async function loginServiceProviderWithUsersTable(
  email: string,
  password: string,
): Promise<{ ok: true; provider: Record<string, unknown> } | { ok: false; message: string }> {
  const result = await login({ email, password, role: 'service_provider' });
  if (!result.success || !result.user) {
    return { ok: false, message: result.reason || 'Login failed' };
  }
  const apiProfile = await fetchServiceProviderProfileWithAppJwt();
  if (apiProfile) {
    return { ok: true, provider: apiProfile };
  }
  return { ok: true, provider: userToServiceProviderProfile(result.user) };
}

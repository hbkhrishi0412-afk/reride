/**
 * Single place to map DB / UI / legacy role strings to canonical app roles.
 * Prevents "Customer" vs "customer" login failures and SP-only login from working
 * (SP uses Supabase Auth; other roles use /api/users with strict string compare).
 */
const CANONICAL = new Set<string>([
  'customer',
  'seller',
  'admin',
  'service_provider',
  'finance_partner',
]);

export type AppUserRole = 'customer' | 'seller' | 'admin' | 'service_provider' | 'finance_partner';

export function normalizeUserRoleString(raw: unknown): AppUserRole {
  if (raw == null || raw === '') return 'customer';
  let s = String(raw).trim().toLowerCase().replace(/-/g, '_');
  if (s === 'service provider' || s === 'provider' || s === 'serviceprovider') s = 'service_provider';
  if (CANONICAL.has(s)) return s as AppUserRole;
  return 'customer';
}

export function userRolesEqual(a: unknown, b: unknown): boolean {
  return normalizeUserRoleString(a) === normalizeUserRoleString(b);
}

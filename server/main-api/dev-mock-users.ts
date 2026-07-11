import type { User as UserType } from '../../types.js';

/** Well-known local dev / Playwright E2E accounts (never enabled in production). */
const DEV_MOCK_USERS: Record<
  string,
  {
    password: string;
    user: Omit<UserType, 'email' | 'password'> & { email: string };
  }
> = {
  'admin@test.com': {
    password: 'password',
    user: {
      id: 'test-admin-1',
      email: 'admin@test.com',
      name: 'Test Admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  },
  'seller@test.com': {
    password: 'password',
    user: {
      id: 'test-seller-1',
      email: 'seller@test.com',
      name: 'Test Seller',
      role: 'seller',
      status: 'active',
      subscriptionPlan: 'premium',
      createdAt: new Date().toISOString(),
    },
  },
  'customer@test.com': {
    password: 'password',
    user: {
      id: 'test-customer-1',
      email: 'customer@test.com',
      name: 'Test Customer',
      role: 'customer',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  },
};

export function isDevMockLoginEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && String(process.env.VERCEL || '') !== '1';
}

/** Resolve a mock user for local dev when Supabase has no matching account. */
export function resolveDevMockUser(
  normalizedEmail: string,
  password: string,
  requestedRole?: string,
): UserType | null {
  if (!isDevMockLoginEnabled()) return null;

  const entry = DEV_MOCK_USERS[normalizedEmail];
  if (!entry || entry.password !== password) return null;

  if (requestedRole && entry.user.role !== requestedRole) {
    return null;
  }

  return {
    ...entry.user,
    email: normalizedEmail,
    // Satisfy downstream checks; password validation is skipped for dev mock logins.
    password: entry.password,
  } as UserType;
}

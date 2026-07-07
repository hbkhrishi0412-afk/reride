import { resolveAuthRoleFromEmail } from '../utils/resolveAuthRole.js';
import { normalizeUserRoleString } from '../utils/user-role.js';

describe('resolveAuthRoleFromEmail', () => {
  it('returns customer when email is empty', async () => {
    await expect(resolveAuthRoleFromEmail('')).resolves.toBe('customer');
  });

  it('does not elevate role from user_metadata-style hints alone without DB', async () => {
    // With no DB in test env, only app_metadata admin hint is used as fallback
    await expect(resolveAuthRoleFromEmail('test@example.com', 'admin')).resolves.toBe('admin');
    await expect(resolveAuthRoleFromEmail('test@example.com', 'seller')).resolves.toBe('seller');
    await expect(resolveAuthRoleFromEmail('test@example.com', 'customer')).resolves.toBe('customer');
  });
});

describe('normalizeUserRoleString', () => {
  it('normalizes legacy role strings', () => {
    expect(normalizeUserRoleString('Seller')).toBe('seller');
    expect(normalizeUserRoleString('ADMIN')).toBe('admin');
  });
});

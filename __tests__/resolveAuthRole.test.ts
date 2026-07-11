import { resolveAuthRoleFromEmail } from '../utils/resolveAuthRole.js';
import { normalizeUserRoleString } from '../utils/user-role.js';

describe('resolveAuthRoleFromEmail', () => {
  it('returns customer when email is empty', async () => {
    await expect(resolveAuthRoleFromEmail('')).resolves.toBe('customer');
  });

  it('does not elevate role from user_metadata-style hints alone without DB', async () => {
    await expect(resolveAuthRoleFromEmail('test@example.com', 'admin')).resolves.toBe('admin');
    await expect(resolveAuthRoleFromEmail('test@example.com', 'seller')).resolves.toBe('seller');
    await expect(resolveAuthRoleFromEmail('test@example.com', 'customer')).resolves.toBe('customer');
  });

  it('maps service_provider and finance_partner from app_metadata hint', async () => {
    await expect(resolveAuthRoleFromEmail('sp@test.com', 'service_provider')).resolves.toBe(
      'service_provider',
    );
    await expect(resolveAuthRoleFromEmail('fp@test.com', 'finance_partner')).resolves.toBe(
      'finance_partner',
    );
  });
});

describe('normalizeUserRoleString', () => {
  it('normalizes legacy role strings', () => {
    expect(normalizeUserRoleString('Seller')).toBe('seller');
    expect(normalizeUserRoleString('ADMIN')).toBe('admin');
  });
});

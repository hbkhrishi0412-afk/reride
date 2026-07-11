import {
  hasLeakedPasswordProtectionEnabled,
  verifyProductionSecurityReadiness,
} from '../server/production-security.js';

describe('production-security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('detects leaked password protection flags', () => {
    expect(hasLeakedPasswordProtectionEnabled({ password_hibp_enabled: true })).toBe(true);
    expect(
      hasLeakedPasswordProtectionEnabled({ security: { password: { haveibeenpwned_enabled: true } } }),
    ).toBe(true);
    expect(hasLeakedPasswordProtectionEnabled({ mailer_autoconfirm: true })).toBe(false);
  });

  it('skips checks outside production', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;
    const result = await verifyProductionSecurityReadiness();
    expect(result.ok).toBe(true);
  });

  it('fails when no distributed store in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.SUPABASE_DISTRIBUTED_SECURITY_VERIFIED;
    const result = await verifyProductionSecurityReadiness();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.includes('distributed security') || i.includes('Upstash'))).toBe(
        true,
      );
    }
  });
});

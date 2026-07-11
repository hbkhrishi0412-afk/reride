import {
  FREE_TIER_MIN_PASSWORD_LENGTH,
  hasLeakedPasswordProtectionEnabled,
  isFreeTierPasswordPolicyReady,
  isHibpPlanBlockResponse,
  resetProductionSecurityProbeCachesForTests,
  verifyProductionSecurityReadiness,
} from '../server/production-security.js';

describe('production-security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetProductionSecurityProbeCachesForTests();
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
    delete process.env.SUPABASE_ACCESS_TOKEN;
    const result = await verifyProductionSecurityReadiness();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.includes('distributed security') || i.includes('Upstash'))).toBe(
        true,
      );
    }
  });

  it('detects Supabase plan-block responses for HIBP', () => {
    expect(isHibpPlanBlockResponse(402, '{}')).toBe(true);
    expect(isHibpPlanBlockResponse(400, 'Requires a Pro plan or higher')).toBe(true);
    expect(isHibpPlanBlockResponse(200, 'ok')).toBe(false);
  });

  it('requires stronger min length for free-tier compensating controls', () => {
    expect(isFreeTierPasswordPolicyReady({ password_min_length: 8 })).toBe(true);
    expect(isFreeTierPasswordPolicyReady({ password_min_length: 6 })).toBe(false);
    expect(isFreeTierPasswordPolicyReady({})).toBe(false);
    expect(FREE_TIER_MIN_PASSWORD_LENGTH).toBe(8);
  });
});

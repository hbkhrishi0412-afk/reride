import {
  getRateLimitTierConfig,
  resolveGatewayRateLimit,
} from '../lib/rate-limit-policy.js';

describe('rate-limit-policy', () => {
  it('uses public-read tier for anonymous catalog GET', () => {
    const decision = resolveGatewayRateLimit({
      pathname: '/api/vehicles',
      method: 'GET',
      clientIp: '203.0.113.10',
      userEmail: null,
    });
    expect(decision.tier).toBe('public-read');
    expect(decision.identifier).toBe('ip:203.0.113.10');
    expect(decision.maxRequests).toBeGreaterThanOrEqual(2000);
  });

  it('uses auth-read tier for signed-in dashboard GET', () => {
    const decision = resolveGatewayRateLimit({
      pathname: '/api/conversations',
      method: 'GET',
      clientIp: '203.0.113.10',
      userEmail: 'seller@test.com',
    });
    expect(decision.tier).toBe('auth-read');
    expect(decision.identifier).toBe('user:seller@test.com');
  });

  it('uses upload tier for image uploads independent of other buckets', () => {
    const decision = resolveGatewayRateLimit({
      pathname: '/api/upload-image',
      method: 'POST',
      clientIp: '203.0.113.10',
      userEmail: 'seller@test.com',
    });
    expect(decision.tier).toBe('upload');
    expect(decision.bucket).toBe('upload');
    expect(decision.maxRequests).toBeGreaterThanOrEqual(250);
  });

  it('uses auth-write tier for signed-in listing mutations', () => {
    const decision = resolveGatewayRateLimit({
      pathname: '/api/vehicles',
      method: 'POST',
      clientIp: '203.0.113.10',
      userEmail: 'seller@test.com',
    });
    expect(decision.tier).toBe('auth-write');
    expect(decision.identifier).toBe('user:seller@test.com');
  });

  it('uses auth-sensitive tier for unauthenticated login POST', () => {
    const decision = resolveGatewayRateLimit({
      pathname: '/api/users',
      method: 'POST',
      clientIp: '203.0.113.10',
      userEmail: null,
    });
    expect(decision.tier).toBe('auth-sensitive');
    expect(decision.identifier).toMatch(/^ip:/);
  });

  it('uses auth-write (not auth-sensitive) for signed-in profile POST', () => {
    const decision = resolveGatewayRateLimit({
      pathname: '/api/users',
      method: 'POST',
      clientIp: '203.0.113.10',
      userEmail: 'seller@test.com',
    });
    expect(decision.tier).toBe('auth-write');
  });

  it('exposes generous startup defaults for auth-read tier', () => {
    const cfg = getRateLimitTierConfig('auth-read');
    expect(cfg.maxRequests).toBeGreaterThanOrEqual(1200);
    expect(cfg.windowMs).toBe(15 * 60 * 1000);
  });
});

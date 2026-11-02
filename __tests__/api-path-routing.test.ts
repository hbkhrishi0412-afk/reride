import {
  matchesApiRoute,
  pathHasSegment,
  resolveEffectiveApiPathname,
  scanApiPathFromString,
} from '../utils/api-path-routing';

describe('pathHasSegment', () => {
  it('matches whole segments only', () => {
    expect(pathHasSegment('/api/users', '/users')).toBe(true);
    expect(pathHasSegment('/api/users/123', '/users')).toBe(true);
    expect(pathHasSegment('/api/users-export', '/users')).toBe(false);
    expect(pathHasSegment('/api/vehicles/users-report', '/users')).toBe(false);
  });
});

describe('matchesApiRoute', () => {
  it('matches exact and nested routes', () => {
    expect(matchesApiRoute('/api/users', '/api/users')).toBe(true);
    expect(matchesApiRoute('/users', '/api/users')).toBe(true);
    expect(matchesApiRoute('/api/users/profile', '/api/users')).toBe(true);
    expect(matchesApiRoute('/api/users-export', '/api/users')).toBe(false);
  });
});

describe('scanApiPathFromString', () => {
  it('maps known API segments after Vercel rewrite', () => {
    expect(scanApiPathFromString('/api/conversations?foo=1')).toBe('/api/conversations');
    expect(scanApiPathFromString('/api/buyer-activity')).toBe('/api/buyer-activity');
    expect(scanApiPathFromString('/api/vehicles?action=track-view')).toBe('/api/vehicles');
    expect(scanApiPathFromString('/api/service-providers/register')).toBe(
      '/api/service-providers/register',
    );
    expect(scanApiPathFromString('/api/login')).toBe('/api/login');
  });

  it('does not treat lookalike paths as /users', () => {
    expect(scanApiPathFromString('/api/users-export')).toBeNull();
    expect(scanApiPathFromString('/api/vehicles/users-report')).toBe('/api/vehicles');
  });

  it('prefers /admin over nested /users', () => {
    expect(scanApiPathFromString('/api/admin/users')).toBe('/api/admin');
  });

  it('returns null for unknown paths', () => {
    expect(scanApiPathFromString('/api/unknown-widget')).toBeNull();
    expect(scanApiPathFromString('')).toBeNull();
  });
});

describe('resolveEffectiveApiPathname', () => {
  const baseReq = {
    headers: {} as Record<string, string | string[] | undefined>,
    url: '/api/main',
    query: {} as Record<string, string | string[] | undefined>,
  };

  it('uses x-vercel-original-path when pathname is /api/main', () => {
    const req = {
      ...baseReq,
      headers: { 'x-vercel-original-path': '/api/conversations' },
    };
    expect(resolveEffectiveApiPathname(req, '/api/main')).toBe('/api/conversations');
  });

  it('does not let spoofed headers override a concrete pathname', () => {
    const req = {
      ...baseReq,
      url: '/api/users',
      headers: { 'x-vercel-original-path': '/api/health' },
    };
    expect(resolveEffectiveApiPathname(req, '/api/users')).toBe('/api/users');
  });

  it('infers /api/vehicles from track-view query on rewritten main', () => {
    const req = {
      ...baseReq,
      query: { action: 'track-view' },
    };
    expect(resolveEffectiveApiPathname(req, '/api/main')).toBe('/api/vehicles');
  });

  it('leaves an already-correct pathname unchanged', () => {
    const req = { ...baseReq, url: '/api/buyer-activity' };
    expect(resolveEffectiveApiPathname(req, '/api/buyer-activity')).toBe('/api/buyer-activity');
  });
});

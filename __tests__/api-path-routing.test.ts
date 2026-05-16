import { resolveEffectiveApiPathname, scanApiPathFromString } from '../utils/api-path-routing';

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

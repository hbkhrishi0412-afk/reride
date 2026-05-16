import type { VercelRequest } from '@vercel/node';

/** Ordered most-specific first — `includes()` matching. */
const API_PATH_SEGMENTS: ReadonlyArray<{ needle: string; route: string }> = [
  { needle: '/service-providers/register', route: '/api/service-providers/register' },
  { needle: '/csrf-token', route: '/api/csrf-token' },
  { needle: '/vehicle-data', route: '/api/vehicle-data' },
  { needle: '/buyer-activity', route: '/api/buyer-activity' },
  { needle: '/conversations', route: '/api/conversations' },
  { needle: '/notifications', route: '/api/notifications' },
  { needle: '/audit-log', route: '/api/audit-log' },
  { needle: '/support-tickets', route: '/api/support-tickets' },
  { needle: '/content-reports', route: '/api/content-reports' },
  { needle: '/upload-image', route: '/api/upload-image' },
  { needle: '/provider-services', route: '/api/provider-services' },
  { needle: '/service-providers', route: '/api/service-providers' },
  { needle: '/service-requests', route: '/api/service-requests' },
  { needle: '/db-health', route: '/api/db-health' },
  { needle: '/sell-car', route: '/api/sell-car' },
  { needle: '/payments', route: '/api/payments' },
  { needle: '/plans', route: '/api/plans' },
  { needle: '/faqs', route: '/api/faqs' },
  { needle: '/settings', route: '/api/settings' },
  { needle: '/vehicles', route: '/api/vehicles' },
  { needle: '/users', route: '/api/users' },
  { needle: '/login', route: '/api/login' },
  { needle: '/content', route: '/api/content' },
  { needle: '/chat', route: '/api/chat' },
  { needle: '/gemini', route: '/api/gemini' },
  { needle: '/admin', route: '/api/admin' },
];

export function scanApiPathFromString(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const pathOnly = raw.split('?')[0] || '';
  for (const { needle, route } of API_PATH_SEGMENTS) {
    if (pathOnly.includes(needle)) return route;
  }
  return null;
}

function firstQueryParam(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

/**
 * After Vercel rewrite to /api/main.ts, recover the client-facing API path.
 */
export function resolveEffectiveApiPathname(
  req: Pick<VercelRequest, 'headers' | 'url' | 'query'>,
  pathname: string,
): string {
  const mainLike =
    pathname === '/api/main' ||
    pathname === '/main' ||
    pathname.endsWith('/api/main.ts') ||
    pathname.endsWith('/main.ts');

  const headerVals = [
    req.headers['x-vercel-original-path'],
    req.headers['x-invoke-path'],
    req.headers['x-matched-path'],
  ];
  for (const h of headerVals) {
    const v = Array.isArray(h) ? h[0] : h;
    const hit = scanApiPathFromString(String(v || ''));
    if (hit) return hit;
  }

  const urlHit = scanApiPathFromString(typeof req.url === 'string' ? req.url : '');
  if (urlHit) return urlHit;

  if (mainLike) {
    const t = firstQueryParam(req.query?.type);
    const a = firstQueryParam(req.query?.aggregate);
    const skip = firstQueryParam(req.query?.skipExpiryCheck);
    const act = firstQueryParam(req.query?.action);
    if (t === 'data' || a === 'storefront' || skip === 'true' || act === 'track-view') {
      return '/api/vehicles';
    }
    for (const val of Object.values(req.headers)) {
      const s = Array.isArray(val) ? val[0] : val;
      if (typeof s !== 'string' || s.length < 6 || !s.includes('/api/')) continue;
      const hit = scanApiPathFromString(s);
      if (hit) return hit;
    }
  }

  return pathname;
}

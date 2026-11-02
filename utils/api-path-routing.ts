import type { VercelRequest } from '@vercel/node';

/** Ordered most-specific first — segment-boundary matching (not substring). */
const API_PATH_SEGMENTS: ReadonlyArray<{ needle: string; route: string }> = [
  { needle: '/service-providers/register', route: '/api/service-providers/register' },
  { needle: '/csrf-token', route: '/api/csrf-token' },
  { needle: '/vehicle-trust', route: '/api/vehicle-trust' },
  { needle: '/deals', route: '/api/deals' },
  { needle: '/complaints', route: '/api/complaints' },
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
  { needle: '/admin', route: '/api/admin' },
  { needle: '/vehicles', route: '/api/vehicles' },
  { needle: '/users', route: '/api/users' },
  { needle: '/login', route: '/api/login' },
  { needle: '/content', route: '/api/content' },
  { needle: '/chat', route: '/api/chat' },
  { needle: '/gemini', route: '/api/gemini' },
  { needle: '/health', route: '/api/health' },
];

/**
 * True when `needle` appears in `pathOnly` as a full path segment sequence,
 * not as a prefix of a longer segment (`/users` must not match `/users-export`).
 */
export function pathHasSegment(pathOnly: string, needle: string): boolean {
  if (!pathOnly || !needle) return false;
  let from = 0;
  while (from <= pathOnly.length) {
    const idx = pathOnly.indexOf(needle, from);
    if (idx === -1) return false;
    const afterIdx = idx + needle.length;
    const after = pathOnly[afterIdx];
    if (after === undefined || after === '/' || after === '?' || after === '#') {
      return true;
    }
    from = idx + 1;
  }
  return false;
}

/** Exact route or nested under it (`/api/users`, `/users`, `/api/users/x`). */
export function matchesApiRoute(pathname: string, route: string): boolean {
  const pathOnly = (pathname || '').split('?')[0] || '';
  const normalized = route.startsWith('/api/') ? route : `/api${route.startsWith('/') ? route : `/${route}`}`;
  const bare = normalized.replace(/^\/api/, '') || '/';
  for (const candidate of [normalized, bare]) {
    if (pathOnly === candidate || pathOnly.startsWith(candidate + '/')) return true;
  }
  return false;
}

export function isApiRewriteDestination(pathname: string): boolean {
  const p = (pathname || '').split('?')[0] || '';
  return (
    p === '/api/main' ||
    p === '/main' ||
    p === '/api/main.ts' ||
    p.endsWith('/main.ts') ||
    p === '/api/platform' ||
    p === '/platform' ||
    p === '/api/platform.ts' ||
    p.endsWith('/platform.ts')
  );
}

export function scanApiPathFromString(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const pathOnly = raw.split('?')[0] || '';
  for (const { needle, route } of API_PATH_SEGMENTS) {
    if (pathHasSegment(pathOnly, needle)) return route;
  }
  return null;
}

function firstQueryParam(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

function headerPathValue(h: string | string[] | undefined): string {
  const v = Array.isArray(h) ? h[0] : h;
  return typeof v === 'string' ? v : '';
}

/**
 * After Vercel rewrite to /api/main.ts, recover the client-facing API path.
 * Spoofable invoke/original-path headers are only consulted when `pathname` is a rewrite sink.
 */
export function resolveEffectiveApiPathname(
  req: Pick<VercelRequest, 'headers' | 'url' | 'query'>,
  pathname: string,
): string {
  const pathOnly = (pathname || '').split('?')[0] || '/';

  // Concrete API path already known — never let client headers override it.
  if (!isApiRewriteDestination(pathOnly)) {
    const direct = scanApiPathFromString(pathOnly);
    if (direct) return direct;
    const urlHit = scanApiPathFromString(typeof req.url === 'string' ? req.url : '');
    if (urlHit) return urlHit;
    return pathOnly;
  }

  const headerVals = [
    req.headers['x-vercel-original-path'],
    req.headers['x-invoke-path'],
    req.headers['x-matched-path'],
  ];
  for (const h of headerVals) {
    const hit = scanApiPathFromString(headerPathValue(h));
    if (hit) return hit;
  }

  const urlHit = scanApiPathFromString(typeof req.url === 'string' ? req.url : '');
  if (urlHit) return urlHit;

  const t = firstQueryParam(req.query?.type);
  const a = firstQueryParam(req.query?.aggregate);
  const skip = firstQueryParam(req.query?.skipExpiryCheck);
  const act = firstQueryParam(req.query?.action);
  if (t === 'data' || a === 'storefront' || skip === 'true' || act === 'track-view') {
    return '/api/vehicles';
  }

  // Last resort: scan other header values for an /api/... path (rewrite recovery only).
  for (const val of Object.values(req.headers)) {
    const s = Array.isArray(val) ? val[0] : val;
    if (typeof s !== 'string' || s.length < 6 || !s.includes('/api/')) continue;
    const hit = scanApiPathFromString(s);
    if (hit) return hit;
  }

  return pathOnly;
}

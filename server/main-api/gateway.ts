import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveRateLimit } from '../../lib/rate-limit-resolver.js';
import {
  rateLimitRetryAfterSeconds,
  resolveGatewayRateLimit,
} from '../../lib/rate-limit-policy.js';
import {
  attachApiCors,
  authenticateRequestDual,
  errorToPublicMessage,
  generateCsrfToken,
  getClientIP,
  getCsrfCookieName,
  getEffectivePathnameForErrorFallback,
  logError,
  logInfo,
  logWarn,
  mergeQueryStringFromRequestUrl,
  resolveEffectiveApiPathname,
  shouldSkipCsrfForCapacitorNative,
  validateCsrfToken,
  type HandlerOptions,
} from './shared.js';
import {
  dispatchMarketplaceRewrite,
  dispatchMarketplaceRoute,
} from './routes-marketplace.js';
import {
  dispatchPlatformRewrite,
  dispatchPlatformRoute,
} from './routes-platform.js';
import { verifyProductionSecurityReadiness } from '../production-security.js';
import {
  isApiRewriteDestination,
  matchesApiRoute,
} from '../../utils/api-path-routing.js';

export type ApiBundle = 'marketplace' | 'platform';

// Lightweight liveness only — db-health hits the DB and must stay rate-limited.
const HEALTH_PATHS = new Set(['/api/health', '/health']);
const LOGIN_PATHS = new Set(['/api/login', '/login', '/api/admin/login', '/admin/login']);
const CSRF_TOKEN_PATHS = new Set(['/api/csrf-token', '/csrf-token']);
const USERS_AUTH_ACTIONS = new Set([
  'login',
  'register',
  'refresh-token',
  'request-password-reset',
  'complete-password-reset',
  'oauth-login',
  'oauth-service-provider',
  'logout',
]);

function pathOnlyFromRaw(requestUrl: string, host: string): string {
  if (!requestUrl) return '';
  try {
    if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
      return new URL(requestUrl).pathname;
    }
    if (requestUrl.startsWith('/')) {
      return requestUrl.split('?')[0];
    }
    return new URL(requestUrl, `http://${host || 'localhost'}`).pathname;
  } catch {
    const match = requestUrl.match(/^([^?]+)/);
    return match ? match[1] : '';
  }
}

/**
 * Prefer req.url when it is a concrete API path. Spoofable x-vercel-original-path /
 * x-invoke-path are only used to recover the route after a rewrite to /api/main|/api/platform.
 */
function resolvePathname(req: VercelRequest): string {
  const host = String(req.headers.host || 'localhost');
  const urlPath = pathOnlyFromRaw(typeof req.url === 'string' ? req.url : '', host) || '/';

  if (urlPath.startsWith('/api/') && !isApiRewriteDestination(urlPath)) {
    return resolveEffectiveApiPathname(req, urlPath);
  }

  let pathname = urlPath;
  try {
    const originalPath = req.headers['x-vercel-original-path'] as string;
    const invokePath = req.headers['x-invoke-path'] as string;
    const fromHeader = pathOnlyFromRaw(originalPath || invokePath || '', host);
    if (fromHeader) {
      pathname = fromHeader;
    }
  } catch {
    /* keep urlPath */
  }

  if (isApiRewriteDestination(pathname) && urlPath.startsWith('/api/') && !isApiRewriteDestination(urlPath)) {
    pathname = urlPath;
  }

  return resolveEffectiveApiPathname(req, pathname);
}

async function runApiCore(
  req: VercelRequest,
  res: VercelResponse,
  bundle: ApiBundle,
): Promise<void | VercelResponse> {
  attachApiCors(req, res);

  const rawOrigin = req.headers?.origin;
  const originHeader =
    typeof rawOrigin === 'string' ? rawOrigin : Array.isArray(rawOrigin) ? rawOrigin[0] : undefined;

  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', '0');
    }
    return res.status(200).end();
  }

  mergeQueryStringFromRequestUrl(req);
  const pathname = resolvePathname(req);

  if (process.env.NODE_ENV !== 'production') {
    logInfo(`📍 [${bundle}] ${req.method} ${pathname}`);
  }

  if (req.method === 'GET' && CSRF_TOKEN_PATHS.has(pathname)) {
    const token = generateCsrfToken();
    const cookieName = getCsrfCookieName();
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || '';
    const useCrossSiteCookie = forwardedProto === 'https' || process.env.VERCEL === '1';
    const sameSite = useCrossSiteCookie ? 'None' : 'Lax';
    const secureSuffix = useCrossSiteCookie ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=${token}; Path=/; SameSite=${sameSite}; Max-Age=86400${secureSuffix}`,
    );
    return res.status(200).json({ token });
  }

  // Exact matches only: routing must not treat `/api/users/health` as the health probe.
  const isHealthEndpoint = HEALTH_PATHS.has(pathname);

  if (!isHealthEndpoint) {
    try {
      const securityReadiness = await verifyProductionSecurityReadiness();
      if (!securityReadiness.ok) {
        logError('❌ Production security prerequisites not satisfied:', {
          issues: securityReadiness.issues,
          requiredActions: securityReadiness.requiredActions,
        });
        return res.status(503).json({
          success: false,
          reason: 'Service temporarily unavailable.',
        });
      }
    } catch (securityError) {
      logError('❌ Production security readiness check threw:', securityError);
      return res.status(503).json({
        success: false,
        reason: 'Service temporarily unavailable.',
      });
    }

    let userEmail: string | null = null;
    try {
      const auth = await authenticateRequestDual(req);
      if (auth.isValid && auth.user?.email) {
        userEmail = auth.user.email.toLowerCase().trim();
      }
    } catch {
      /* unauthenticated */
    }

    try {
      const rateDecision = resolveGatewayRateLimit({
        pathname,
        method: req.method || 'GET',
        clientIp: getClientIP(req),
        userEmail,
      });

      let rateLimitResult: { allowed: boolean; remaining: number };
      try {
        const resolved = await resolveRateLimit(rateDecision.bucket, rateDecision.identifier, {
          maxRequests: rateDecision.maxRequests,
          windowMs: rateDecision.windowMs,
        });
        rateLimitResult = { allowed: resolved.allowed, remaining: resolved.remaining };
      } catch {
        // Fail open for reads/authenticated writes; fail closed where abuse costs money or enables brute force
        const failClosed = rateDecision.tier === 'auth-sensitive' || rateDecision.tier === 'anonymous-write';
        rateLimitResult = { allowed: !failClosed, remaining: failClosed ? 0 : rateDecision.maxRequests };
      }
      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitRetryAfterSeconds(rateDecision.windowMs);
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          success: false,
          reason: 'Too many requests. Please try again later.',
          retryAfter,
          tier: rateDecision.tier,
        });
      }
      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      res.setHeader('X-RateLimit-Limit', rateDecision.maxRequests.toString());
      res.setHeader('X-RateLimit-Tier', rateDecision.tier);
    } catch (rateLimitError) {
      logWarn('⚠️ Rate limit setup failed — allowing request:', rateLimitError);
    }
  }

  const isStateChanging =
    req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';
  const appClientHeader = String(req.headers['x-app-client'] || req.headers['X-App-Client'] || '').toLowerCase();
  const skipCsrfForCapacitorNative = shouldSkipCsrfForCapacitorNative(appClientHeader, originHeader);
  const bodyAction =
    req.body &&
    typeof req.body === 'object' &&
    !Array.isArray(req.body) &&
    typeof (req.body as { action?: unknown }).action === 'string'
      ? String((req.body as { action: string }).action)
      : '';
  // CSRF exempt only for explicit auth actions — empty/missing action is NOT exempt
  // (handleUsers already 400s bodyless POSTs; do not open a CSRF hole for future handlers).
  const isUsersAuthAction =
    req.method === 'POST' &&
    matchesApiRoute(pathname, '/api/users') &&
    USERS_AUTH_ACTIONS.has(bodyAction);
  const isCsrfExempt =
    LOGIN_PATHS.has(pathname) ||
    isHealthEndpoint ||
    isUsersAuthAction ||
    skipCsrfForCapacitorNative;

  if (isStateChanging && !isCsrfExempt) {
    const headerToken = (req.headers['x-csrf-token'] || req.headers['X-CSRF-Token']) as string | undefined;
    const cookieToken = (req.headers.cookie || '')
      .split(';')
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith(getCsrfCookieName() + '='));
    const cookieValue = cookieToken ? cookieToken.split('=')[1]?.trim() : undefined;
    if (!validateCsrfToken(headerToken, cookieValue)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or missing CSRF token',
        reason: 'Please refresh the page and try again.',
      });
    }
  }

  const handlerOptions: HandlerOptions = {};

  if (pathname === '/api/main' || pathname === '/main' || pathname === '/api/platform' || pathname === '/platform') {
    const originalPath = req.headers['x-vercel-original-path'] as string;
    const invokePath = req.headers['x-invoke-path'] as string;
    const pathOnly = typeof req.url === 'string' ? req.url.split('?')[0] : '';
    const isRewrittenDest =
      pathOnly === '/api/main' ||
      pathOnly === '/api/main.ts' ||
      pathOnly.endsWith('/main') ||
      pathOnly === '/api/platform' ||
      pathOnly === '/api/platform.ts' ||
      pathOnly.endsWith('/platform');
    const urlPath = pathOnly.startsWith('/api/') && !isRewrittenDest ? pathOnly : '';
    // Prefer non-rewrite req.url over spoofable headers when both are present.
    const checkPath = urlPath || originalPath || invokePath;
    if (checkPath) {
      const rewriteResult =
        bundle === 'marketplace'
          ? await dispatchMarketplaceRewrite(req, res, checkPath, handlerOptions)
          : await dispatchPlatformRewrite(req, res, checkPath, handlerOptions);
      if (rewriteResult !== undefined) return rewriteResult;
    }
    if ((req.method === 'PUT' || req.method === 'POST') && req.body && (req.body as { email?: string }).email) {
      const b = req.body as Record<string, unknown>;
      // Explicit service-provider registration fallback only — never route arbitrary
      // email-bearing bodies to handleUsers (prevents accidental user mutation).
      if (
        bundle === 'marketplace' &&
        req.method === 'POST' &&
        b.action === undefined &&
        typeof b.password === 'string' &&
        typeof b.phone === 'string' &&
        typeof b.city === 'string' &&
        typeof b.name === 'string'
      ) {
        const { handleServiceProviderRegister } = await import('../handlers/service-providers.js');
        return await handleServiceProviderRegister(req, res);
      }
    }
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({
      success: false,
      reason: 'API route not found',
      error: 'Unknown endpoint after rewrite',
    });
  }

  return bundle === 'marketplace'
    ? await dispatchMarketplaceRoute(req, res, pathname, handlerOptions)
    : await dispatchPlatformRoute(req, res, pathname, handlerOptions);
}

export function createApiHandler(bundle: ApiBundle) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    try {
      attachApiCors(req, res);
    } catch {
      /* minimal cors fallback handled in entry files if needed */
    }

    if (req.method === 'OPTIONS' || req.method === 'HEAD') {
      if (req.method === 'HEAD') res.setHeader('Content-Length', '0');
      return res.status(200).end();
    }

    mergeQueryStringFromRequestUrl(req);

    try {
      return await runApiCore(req, res, bundle);
    } catch (error) {
      logError(`❌ Fatal error in ${bundle} API handler:`, error);
      res.setHeader('Content-Type', 'application/json');
      const effectivePath = getEffectivePathnameForErrorFallback(req);
      const message = errorToPublicMessage(error);
      return res.status(500).json({ success: false, reason: message, error: message, path: effectivePath });
    }
  };
}

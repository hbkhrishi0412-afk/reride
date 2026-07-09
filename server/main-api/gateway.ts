import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  attachApiCors,
  authenticateRequestDual,
  checkRateLimit,
  checkUpstashRateLimit,
  errorToPublicMessage,
  firstQueryParam,
  generateCsrfToken,
  getClientIP,
  getCsrfCookieName,
  getEffectivePathnameForErrorFallback,
  logError,
  logInfo,
  logWarn,
  mergeQueryStringFromRequestUrl,
  resolveEffectiveApiPathname,
  securityConfig,
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
import { handleUsers } from './marketplace-handlers.js';
import { verifyProductionSecurityReadiness } from '../production-security.js';

export type ApiBundle = 'marketplace' | 'platform';

function resolvePathname(req: VercelRequest): string {
  let pathname = '/';
  try {
    const originalPath = req.headers['x-vercel-original-path'] as string;
    const invokePath = req.headers['x-invoke-path'] as string;
    const requestUrl = originalPath || invokePath || req.url || '';
    if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
      pathname = new URL(requestUrl).pathname;
    } else if (requestUrl.startsWith('/')) {
      pathname = requestUrl.split('?')[0];
    } else {
      pathname = new URL(requestUrl, `http://${req.headers.host || 'localhost'}`).pathname;
    }
  } catch {
    if (req.url) {
      const match = req.url.match(/^([^?]+)/);
      if (match) pathname = match[1];
    }
  }
  if (
    (pathname === '/api/main' || pathname === '/main' || pathname === '/api/platform' || pathname === '/platform') &&
    req.url &&
    req.url.startsWith('/api/') &&
    req.url !== '/api/main' &&
    req.url !== '/api/platform'
  ) {
    pathname = req.url.split('?')[0];
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

  if (req.method === 'GET' && (pathname.includes('/csrf-token') || pathname.endsWith('/csrf-token'))) {
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

  const isHealthEndpoint =
    pathname.includes('/db-health') ||
    pathname.includes('/health') ||
    pathname.endsWith('/db-health') ||
    pathname.endsWith('/health');

  if (!isHealthEndpoint) {
    const securityReadiness = await verifyProductionSecurityReadiness();
    if (!securityReadiness.ok) {
      return res.status(503).json({
        success: false,
        reason: 'Production security prerequisites are not satisfied.',
        issues: securityReadiness.issues,
        requiredActions: securityReadiness.requiredActions,
      });
    }

    let rateLimitIdentifier = getClientIP(req);
    try {
      const auth = await authenticateRequestDual(req);
      if (auth.isValid && auth.user?.email) {
        rateLimitIdentifier = `user:${auth.user.email.toLowerCase().trim()}`;
      }
    } catch {
      /* unauthenticated */
    }
    let rateLimitResult: { allowed: boolean; remaining: number };
    try {
      const upstashResult = await checkUpstashRateLimit(rateLimitIdentifier);
      rateLimitResult = upstashResult.configured ? upstashResult : await checkRateLimit(rateLimitIdentifier);
    } catch {
      rateLimitResult = await checkRateLimit(rateLimitIdentifier);
    }
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        reason: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(securityConfig.RATE_LIMIT.WINDOW_MS / 1000),
      });
    }
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.setHeader('X-RateLimit-Limit', securityConfig.RATE_LIMIT.MAX_REQUESTS.toString());
  }

  const isStateChanging =
    req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';
  const appClientHeader = String(req.headers['x-app-client'] || req.headers['X-App-Client'] || '').toLowerCase();
  const skipCsrfForCapacitorNative = shouldSkipCsrfForCapacitorNative(appClientHeader, originHeader);
  const isCsrfExempt =
    pathname.includes('/login') ||
    pathname.includes('/csrf-token') ||
    pathname.includes('/health') ||
    pathname.includes('/db-health') ||
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
    const checkPath = originalPath || invokePath || urlPath;
    if (checkPath) {
      const rewriteResult =
        bundle === 'marketplace'
          ? await dispatchMarketplaceRewrite(req, res, checkPath, handlerOptions)
          : await dispatchPlatformRewrite(req, res, checkPath, handlerOptions);
      if (rewriteResult !== undefined) return rewriteResult;
    }
    if ((req.method === 'PUT' || req.method === 'POST') && req.body && (req.body as { email?: string }).email) {
      const b = req.body as Record<string, unknown>;
      if (
        bundle === 'marketplace' &&
        req.method === 'POST' &&
        b.action === undefined &&
        typeof b.password === 'string' &&
        typeof b.phone === 'string' &&
        typeof b.city === 'string' &&
        typeof b.name === 'string'
      ) {
        const { handleServiceProviderRegister } = await import('../../api/service-providers.js');
        return await handleServiceProviderRegister(req, res);
      }
      if (bundle === 'marketplace') {
        return await handleUsers(req, res, handlerOptions);
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

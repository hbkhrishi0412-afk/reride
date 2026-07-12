/**
 * Gateway rate-limit policy for ReRide.
 *
 * Limits are **per client identity** (user email or IP), not platform-wide.
 * Listing 1 or 10,000 vehicles does not shrink these buckets — only concurrent
 * users and each user's request pattern matter.
 *
 * Tiers (env overrides documented in security-config RATE_LIMIT.TIERS):
 * - public-read   — anonymous catalog browsing (high)
 * - auth-read     — signed-in dashboard polling (high)
 * - auth-write    — signed-in mutations: listings, profile, deals (moderate)
 * - upload        — image uploads during listing create/edit (separate)
 * - auth-sensitive — login / registration attempts (strict, per IP)
 * - anonymous-write — unauthenticated POST/PUT/DELETE (strict, per IP)
 *
 * Applies equally to website (same-origin or Vercel) and Capacitor mobile
 * (`X-App-Client: capacitor`) — identity is user email when JWT is valid,
 * otherwise client IP.
 */
import { getSecurityConfig } from '../utils/security-config.js';

export type RateLimitTier =
  | 'public-read'
  | 'auth-read'
  | 'auth-write'
  | 'upload'
  | 'auth-sensitive'
  | 'anonymous-write';

export interface RateLimitTierConfig {
  maxRequests: number;
  windowMs: number;
}

export interface GatewayRateLimitDecision {
  tier: RateLimitTier;
  bucket: string;
  identifier: string;
  maxRequests: number;
  windowMs: number;
}

export interface ResolveGatewayRateLimitInput {
  pathname: string;
  method: string;
  clientIp: string;
  userEmail?: string | null;
}

function normalizePath(pathname: string): string {
  return pathname.split('?')[0].toLowerCase();
}

function isReadMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

function isUploadPath(path: string): boolean {
  return path.includes('/upload-image');
}

function isAuthSensitivePath(path: string, method: string, isAuthenticated: boolean): boolean {
  if (path.includes('/login')) return true;
  if (path.includes('/send-otp') || path.includes('/verify-otp')) return true;
  // Login / register / refresh-token — only when caller is not already signed in.
  if (!isReadMethod(method) && path.includes('/users') && !isAuthenticated) return true;
  return false;
}

/** Public catalog & content reads — safe to rate generously per IP. */
function isPublicCatalogRead(path: string, method: string): boolean {
  if (!isReadMethod(method)) return false;
  return (
    path.includes('/vehicles') ||
    path.includes('/vehicle-data') ||
    path.includes('/plans') ||
    path.includes('/faqs') ||
    path.includes('/content') ||
    path.includes('/settings') ||
    path.includes('/services') ||
    path.includes('/service-providers') ||
    path.includes('/vehicle-trust') ||
    path.includes('/sell-car')
  );
}

export function getRateLimitTierConfig(tier: RateLimitTier): RateLimitTierConfig {
  const tiers = getSecurityConfig().RATE_LIMIT.TIERS;
  const pick = (entry: { MAX_REQUESTS: number; WINDOW_MS: number }): RateLimitTierConfig => ({
    maxRequests: entry.MAX_REQUESTS,
    windowMs: entry.WINDOW_MS,
  });
  switch (tier) {
    case 'public-read':
      return pick(tiers.PUBLIC_READ);
    case 'auth-read':
      return pick(tiers.AUTH_READ);
    case 'auth-write':
      return pick(tiers.AUTH_WRITE);
    case 'upload':
      return pick(tiers.UPLOAD);
    case 'auth-sensitive':
      return pick(tiers.AUTH_SENSITIVE);
    case 'anonymous-write':
      return pick(tiers.ANONYMOUS_WRITE);
    default:
      return pick(tiers.PUBLIC_READ);
  }
}

export function resolveGatewayRateLimit(input: ResolveGatewayRateLimitInput): GatewayRateLimitDecision {
  const path = normalizePath(input.pathname);
  const method = (input.method || 'GET').toUpperCase();
  const read = isReadMethod(method);
  const normalizedEmail = input.userEmail?.toLowerCase().trim() || '';
  const isAuthenticated = normalizedEmail.length > 0;
  const ipIdentifier = `ip:${input.clientIp || 'unknown'}`;
  const userIdentifier = `user:${normalizedEmail}`;

  let tier: RateLimitTier;

  if (isUploadPath(path)) {
    tier = 'upload';
  } else if (isAuthSensitivePath(path, method, isAuthenticated)) {
    tier = 'auth-sensitive';
  } else if (read && isPublicCatalogRead(path, method) && !isAuthenticated) {
    tier = 'public-read';
  } else if (read && isAuthenticated) {
    tier = 'auth-read';
  } else if (read) {
    tier = 'public-read';
  } else if (isAuthenticated) {
    tier = 'auth-write';
  } else {
    tier = 'anonymous-write';
  }

  const { maxRequests, windowMs } = getRateLimitTierConfig(tier);
  const identifier =
    tier === 'auth-sensitive'
      ? ipIdentifier
      : tier === 'public-read' || tier === 'anonymous-write'
        ? ipIdentifier
        : isAuthenticated
          ? userIdentifier
          : ipIdentifier;

  return {
    tier,
    bucket: tier,
    identifier,
    maxRequests,
    windowMs,
  };
}

export function rateLimitRetryAfterSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

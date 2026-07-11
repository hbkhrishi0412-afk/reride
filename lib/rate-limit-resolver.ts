/**
 * Unified rate limiting: Upstash when configured, in-memory fallback otherwise.
 * Supports per-endpoint limits via bucket prefix.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getSecurityConfig } from '../utils/security-config.js';
import {
  checkSupabaseRateLimit,
  isSupabaseSecurityKvConfigured,
  securityKvTouch,
} from './security-kv-supabase.js';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/** Accepts camelCase or SECURITY_CONFIG-style keys from ENDPOINT_RATE_LIMITS. */
export type RateLimitConfigInput = Partial<RateLimitConfig> & {
  MAX_REQUESTS?: number;
  WINDOW_MS?: number;
};

function normalizeRateLimitConfig(config?: RateLimitConfigInput): Partial<RateLimitConfig> {
  if (!config) return {};
  return {
    maxRequests: config.maxRequests ?? config.MAX_REQUESTS,
    windowMs: config.windowMs ?? config.WINDOW_MS,
  };
}

const upstashLimiters = new Map<string, Ratelimit>();

interface MemoryEntry {
  count: number;
  resetTime: number;
}

const memoryCache = new Map<string, MemoryEntry>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

function windowLabel(windowMs: number): `${number} s` | `${number} m` | `${number} h` | `${number} d` {
  if (windowMs % (24 * 60 * 60 * 1000) === 0) {
    return `${windowMs / (24 * 60 * 60 * 1000)} d`;
  }
  if (windowMs % (60 * 60 * 1000) === 0) {
    return `${windowMs / (60 * 60 * 1000)} h`;
  }
  if (windowMs % (60 * 1000) === 0) {
    return `${windowMs / (60 * 1000)} m`;
  }
  return `${Math.max(1, Math.round(windowMs / 1000))} s`;
}

function getUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const key = `${config.maxRequests}:${config.windowMs}`;
  const cached = upstashLimiters.get(key);
  if (cached) return cached;

  try {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.maxRequests, windowLabel(config.windowMs)),
      analytics: true,
    });
    upstashLimiters.set(key, limiter);
    return limiter;
  } catch {
    return null;
  }
}

function cleanupMemoryCache(now: number): void {
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.resetTime < now) memoryCache.delete(key);
  }
}

async function checkMemoryRateLimit(
  cacheKey: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  cleanupMemoryCache(now);

  const cached = memoryCache.get(cacheKey);
  if (cached && cached.resetTime >= now) {
    cached.count += 1;
    if (cached.count > config.maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: Math.max(0, config.maxRequests - cached.count) };
  }

  memoryCache.set(cacheKey, { count: 1, resetTime: now + config.windowMs });
  return { allowed: true, remaining: config.maxRequests - 1 };
}

export async function resolveRateLimit(
  bucket: string,
  identifier: string,
  config?: RateLimitConfigInput,
): Promise<{ allowed: boolean; remaining: number; configured: boolean }> {
  const normalized = normalizeRateLimitConfig(config);
  const defaults = getSecurityConfig().RATE_LIMIT;
  const resolved: RateLimitConfig = {
    maxRequests: normalized.maxRequests ?? defaults.MAX_REQUESTS,
    windowMs: normalized.windowMs ?? defaults.WINDOW_MS,
  };

  const cacheKey = `${bucket}:${identifier}`;
  const upstash = getUpstashLimiter(resolved);
  if (upstash) {
    const result = await upstash.limit(cacheKey);
    return {
      allowed: result.success,
      remaining: result.remaining,
      configured: true,
    };
  }

  if (isSupabaseSecurityKvConfigured()) {
    const windowSeconds = Math.max(1, Math.round(resolved.windowMs / 1000));
    const bucketKey = `${cacheKey}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await securityKvTouch(bucketKey, windowSeconds);
    if (count != null) {
      return {
        allowed: count <= resolved.maxRequests,
        remaining: Math.max(0, resolved.maxRequests - count),
        configured: true,
      };
    }
  }

  const memory = await checkMemoryRateLimit(cacheKey, resolved);
  return { ...memory, configured: false };
}

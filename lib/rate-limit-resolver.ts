/**
 * Unified rate limiting: Upstash when configured, in-memory fallback otherwise.
 * Supports per-endpoint limits via bucket prefix.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getSecurityConfig } from '../utils/security-config.js';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
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
  config?: Partial<RateLimitConfig>,
): Promise<{ allowed: boolean; remaining: number; configured: boolean }> {
  const defaults = getSecurityConfig().RATE_LIMIT;
  const resolved: RateLimitConfig = {
    maxRequests: config?.maxRequests ?? defaults.MAX_REQUESTS,
    windowMs: config?.windowMs ?? defaults.WINDOW_MS,
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

  const memory = await checkMemoryRateLimit(cacheKey, resolved);
  return { ...memory, configured: false };
}

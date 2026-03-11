/**
 * Server-side rate limiting using Upstash Redis.
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, use Upstash;
 * otherwise the API falls back to in-memory rate limiting (see api/main.ts).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit: Ratelimit | null = null;

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

export function getUpstashRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const redis = getRedis();
  if (!redis) return null;
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) : 1000,
      '15 m'
    ),
    analytics: true,
  });
  return ratelimit;
}

export async function checkUpstashRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const rl = getUpstashRatelimit();
  if (!rl) return { allowed: true, remaining: 999 };
  const result = await rl.limit(identifier);
  return {
    allowed: result.success,
    remaining: result.remaining,
  };
}

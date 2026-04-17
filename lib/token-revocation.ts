/**
 * Refresh-token revocation store.
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, revoked jtis are
 * stored in Redis with a TTL equal to the remaining refresh-token lifetime, so a
 * stolen refresh token can no longer be exchanged for a new access token after
 * the legitimate user rotates.
 *
 * If Redis is not configured (local dev, or env misconfigured), we fall back to an
 * in-memory Set. That still provides per-instance protection but is NOT safe for
 * multi-instance production — ensure Upstash is configured in prod.
 */
import { Redis } from '@upstash/redis';

const REVOKED_PREFIX = 'refresh:revoked:';

let cachedRedis: Redis | null | undefined;
let redisWarningLogged = false;

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!redisWarningLogged && process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️ UPSTASH_REDIS_REST_URL/TOKEN not set — refresh-token revocation falling back to in-memory. ' +
        'This is NOT safe for multi-instance deployments.',
      );
      redisWarningLogged = true;
    }
    cachedRedis = null;
    return null;
  }
  try {
    cachedRedis = new Redis({ url, token });
  } catch {
    cachedRedis = null;
  }
  return cachedRedis;
}

const memoryRevoked = new Map<string, number>();

function pruneMemoryStore() {
  const now = Date.now();
  for (const [jti, exp] of memoryRevoked) {
    if (exp <= now) memoryRevoked.delete(jti);
  }
}

export async function revokeRefreshToken(jti: string | undefined, ttlSeconds: number): Promise<void> {
  if (!jti) return;
  const effectiveTtl = Math.max(1, Math.floor(ttlSeconds) || 1);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`${REVOKED_PREFIX}${jti}`, '1', { ex: effectiveTtl });
      return;
    } catch {
      // fall through to in-memory
    }
  }
  pruneMemoryStore();
  memoryRevoked.set(jti, Date.now() + effectiveTtl * 1000);
}

export async function isRefreshTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  const redis = getRedis();
  if (redis) {
    try {
      const result = await redis.get<string | null>(`${REVOKED_PREFIX}${jti}`);
      return result !== null && result !== undefined;
    } catch {
      // fall through to in-memory
    }
  }
  pruneMemoryStore();
  const exp = memoryRevoked.get(jti);
  return typeof exp === 'number' && exp > Date.now();
}

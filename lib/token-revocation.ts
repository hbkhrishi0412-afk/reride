/**
 * Token revocation store (single refresh jtis + "all sessions of a user").
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, entries are
 * stored in Redis with a TTL equal to the remaining token lifetime, so a
 * stolen refresh token can no longer be exchanged for a new access token after
 * the legitimate user rotates.
 *
 * If Redis is not configured (local dev, or env misconfigured), we fall back to an
 * in-memory Map. That still provides per-instance protection but is NOT safe for
 * multi-instance production — ensure Upstash is configured in prod.
 */
import { Redis } from '@upstash/redis';
import {
  isSupabaseSecurityKvConfigured,
  securityKvGet,
  securityKvSet,
} from './security-kv-supabase.js';

const REVOKED_PREFIX = 'refresh:revoked:';
const USER_REVOKED_PREFIX = 'user:sessions-revoked-at:';
/** Must outlive the longest token (refresh = 14d). */
const USER_REVOCATION_TTL_SECONDS = 15 * 24 * 60 * 60;

let cachedRedis: Redis | null | undefined;
let redisWarningLogged = false;

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (isSupabaseSecurityKvConfigured()) {
      cachedRedis = null;
      return null;
    }
    if (!redisWarningLogged && process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️ UPSTASH_REDIS_REST_URL/TOKEN not set — refresh-token revocation falling back to in-memory. ' +
        'Configure Upstash or Supabase security_kv (run npm run db:apply-security-kv).',
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

const memoryStore = new Map<string, { value: string; exp: number }>();

function pruneMemoryStore() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.exp <= now) memoryStore.delete(key);
  }
}

async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const ttl = Math.max(1, Math.floor(ttlSeconds) || 1);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttl });
      return;
    } catch {
      // fall through
    }
  }
  if (isSupabaseSecurityKvConfigured() && (await securityKvSet(key, value, ttl))) return;
  pruneMemoryStore();
  memoryStore.set(key, { value, exp: Date.now() + ttl * 1000 });
}

async function kvGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get<string | number | null>(key);
      return v === null || v === undefined ? null : String(v);
    } catch {
      // fall through
    }
  }
  if (isSupabaseSecurityKvConfigured()) return securityKvGet(key);
  pruneMemoryStore();
  return memoryStore.get(key)?.value ?? null;
}

export async function revokeRefreshToken(jti: string | undefined, ttlSeconds: number): Promise<void> {
  if (!jti) return;
  await kvSet(`${REVOKED_PREFIX}${jti}`, '1', ttlSeconds);
}

export async function isRefreshTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  return (await kvGet(`${REVOKED_PREFIX}${jti}`)) !== null;
}

export const SESSION_REVOKED_ERROR = 'Session was signed out (password changed). Please log in again.';

/** Sign out every session of a user (password change/reset): tokens issued before now are rejected. */
export async function revokeAllUserSessions(email: string): Promise<void> {
  const key = email.toLowerCase().trim();
  if (!key) return;
  await kvSet(`${USER_REVOKED_PREFIX}${key}`, String(Math.floor(Date.now() / 1000)), USER_REVOCATION_TTL_SECONDS);
}

/**
 * True when an already-verified JWT (app or Supabase) was issued before the user's last
 * revokeAllUserSessions. Tokens minted in the same second as the revocation stay valid, so the
 * session that changed the password can be handed fresh tokens. Fails open if the store errors.
 */
export async function isTokenRevokedForUser(token: string | undefined, email: string | undefined): Promise<boolean> {
  const key = (email || '').toLowerCase().trim();
  if (!token || !key) return false;
  try {
    const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
    const iat = Number(JSON.parse(Buffer.from(raw.split('.')[1] || '', 'base64url').toString('utf8')).iat);
    const revokedAt = Number(await kvGet(`${USER_REVOKED_PREFIX}${key}`));
    return Number.isFinite(iat) && revokedAt > 0 && iat < revokedAt;
  } catch {
    return false;
  }
}

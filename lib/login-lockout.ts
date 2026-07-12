/**
 * Login brute-force protection — in-memory fallback when Upstash is unavailable.
 * Uses SECURITY_CONFIG.RATE_LIMIT.LOGIN_MAX_ATTEMPTS / LOGIN_LOCKOUT_TIME.
 */

import { getSecurityConfig } from '../utils/security-config.js';
import { getRateLimitTierConfig } from './rate-limit-policy.js';
import { resolveRateLimit } from './rate-limit-resolver.js';

type LockEntry = { attempts: number; lockedUntil: number };

const memoryLocks = new Map<string, LockEntry>();

function getConfig() {
  const cfg = getSecurityConfig();
  return {
    maxAttempts: cfg.RATE_LIMIT.LOGIN_MAX_ATTEMPTS,
    lockoutMs: cfg.RATE_LIMIT.LOGIN_LOCKOUT_TIME,
  };
}

export async function checkLoginAllowed(email: string): Promise<{ allowed: boolean; reason?: string }> {
  const key = email.toLowerCase().trim();
  if (!key) return { allowed: true };

  const sensitive = getRateLimitTierConfig('auth-sensitive');
  const upstash = await Promise.race([
    resolveRateLimit('login-attempt', `login:${key}`, sensitive),
    new Promise<{ allowed: boolean; remaining: number; configured: boolean }>((resolve) => {
      setTimeout(
        () => resolve({ allowed: true, remaining: -1, configured: false }),
        2_000,
      );
    }),
  ]);
  if (!upstash.allowed) {
    return { allowed: false, reason: 'Too many login attempts. Please try again later.' };
  }

  const { lockoutMs } = getConfig();
  const entry = memoryLocks.get(key);
  if (entry && entry.lockedUntil > Date.now()) {
    return { allowed: false, reason: 'Too many login attempts. Please try again later.' };
  }
  if (entry && entry.lockedUntil <= Date.now()) {
    memoryLocks.delete(key);
  }
  return { allowed: true };
}

export async function recordFailedLogin(email: string): Promise<void> {
  const key = email.toLowerCase().trim();
  if (!key) return;

  const { maxAttempts, lockoutMs } = getConfig();
  const entry = memoryLocks.get(key) ?? { attempts: 0, lockedUntil: 0 };
  entry.attempts += 1;
  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = Date.now() + lockoutMs;
    entry.attempts = 0;
  }
  memoryLocks.set(key, entry);

  const sensitive = getRateLimitTierConfig('auth-sensitive');
  await resolveRateLimit('login-fail', `login-fail:${key}`, sensitive);
}

export function clearLoginLockout(email: string): void {
  const key = email.toLowerCase().trim();
  if (key) memoryLocks.delete(key);
}

#!/usr/bin/env node
/**
 * Verify Upstash Redis connectivity for rate limiting + token revocation.
 *
 * Usage:
 *   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/verify-upstash.js
 *
 * Or pull from Vercel first:
 *   vercel env pull .env.local
 *   node --env-file=.env.local scripts/verify-upstash.js
 */

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

async function main() {
  console.log('Upstash verification\n');

  if (!url || !token) {
    fail(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.\n' +
        '   Add them in Vercel → Settings → Environment Variables (Production + Preview).',
    );
  }

  ok('Environment variables present');

  const { Redis } = await import('@upstash/redis');
  const { Ratelimit } = await import('@upstash/ratelimit');

  const redis = new Redis({ url, token });

  const probeKey = `reride:upstash-probe:${Date.now()}`;
  await redis.set(probeKey, 'ok', { ex: 60 });
  const probeVal = await redis.get(probeKey);
  if (probeVal !== 'ok') {
    fail(`Redis SET/GET failed (got ${String(probeVal)})`);
  }
  await redis.del(probeKey);
  ok('Redis REST ping (SET/GET/DEL)');

  const max = process.env.RATE_LIMIT_MAX_REQUESTS
    ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10)
    : 1000;
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, '15 m'),
    prefix: 'reride:verify',
  });

  const testId = `verify-${Date.now()}`;
  const first = await rl.limit(testId);
  const second = await rl.limit(testId);

  if (!first.success) {
    fail('Ratelimit first call was not allowed');
  }
  if (first.remaining <= second.remaining) {
    fail(
      `Ratelimit counter did not decrement (first=${first.remaining}, second=${second.remaining})`,
    );
  }
  ok(`Ratelimit sliding window (${max}/15m): ${first.remaining} → ${second.remaining} remaining`);

  const revokeKey = `refresh:revoked:verify-${Date.now()}`;
  await redis.set(revokeKey, '1', { ex: 30 });
  const revoked = await redis.get(revokeKey);
  if (revoked !== '1') {
    fail('Token-revocation key pattern (SET/GET) failed');
  }
  await redis.del(revokeKey);
  ok('Token-revocation key pattern (refresh:revoked:*)');

  console.log('\nAll Upstash checks passed.');
}

main().catch((err) => {
  console.error('❌ Upstash verification error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

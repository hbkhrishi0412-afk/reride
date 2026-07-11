#!/usr/bin/env node
/**
 * Verify Supabase security_kv (distributed rate limit + token revocation without Upstash).
 * Loads .env.local when present.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

async function main() {
  console.log('Supabase security_kv verification\n');

  if (!url?.trim() || !serviceKey?.trim()) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }

  ok('Supabase service credentials present');

  const { probeSupabaseSecurityKv, isSupabaseSecurityKvConfigured } = await import(
    '../lib/security-kv-supabase.ts'
  );

  if (!isSupabaseSecurityKvConfigured()) {
    fail('Supabase security KV client could not be initialized.');
  }

  const passed = await probeSupabaseSecurityKv();
  if (!passed) {
    fail(
      'security_kv probe failed. Run npm run db:apply-security-kv (or paste supabase/migrations/20260711000004_security_kv.sql in Supabase SQL Editor).',
    );
  }

  ok('security_kv SET/GET/DEL probe');

  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (anonKey) {
    const rpcRes = await fetch(`${url.trim()}/rest/v1/rpc/security_kv_get`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_key: '__verify_anon_blocked__' }),
    });
    const rpcBody = await rpcRes.text();
    const anonBlocked =
      rpcRes.status === 401 ||
      rpcRes.status === 403 ||
      rpcBody.includes('permission denied') ||
      rpcBody.includes('42501') ||
      rpcBody.includes('PGRST301');
    if (!anonBlocked) {
      fail(
        'anon can execute security_kv_get. Run scripts/migrations/fix-security-kv-rpc-grants.sql (or fix-launch-security-grants.sql) in Supabase SQL Editor.',
      );
    }
    ok('security_kv RPC blocked for anon');
  }

  console.log('\nSupabase distributed security store is ready (Upstash not required).');
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});

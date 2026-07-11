#!/usr/bin/env node
/**
 * Verify anon/authenticated cannot read users.password via PostgREST.
 * Uses VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from .env.local (no DATABASE_URL).
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, '.env.local'));

async function probePasswordReadable(key, label) {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  if (!url || !key) return { label, skipped: true };

  const res = await fetch(`${url}/rest/v1/users?select=password&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    const denied =
      res.status === 401 ||
      res.status === 403 ||
      body.includes('permission denied') ||
      body.includes('42501');
    return {
      label,
      blocked: denied,
      detail: denied ? 'password column blocked' : `HTTP ${res.status}`,
    };
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    return { label, blocked: true, detail: 'empty result (RLS or column revoke)' };
  }

  const hasPasswordField = data.some((row) => Object.prototype.hasOwnProperty.call(row, 'password'));
  const hasPasswordValue = data.some((row) => row.password != null && String(row.password).length > 0);
  return {
    label,
    blocked: !hasPasswordValue && !hasPasswordField,
    detail: hasPasswordField
      ? hasPasswordValue
        ? 'password hash returned'
        : 'password column present but null'
      : 'password column not in response',
  };
}

async function main() {
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!anonKey) {
    console.error('[verify-password-revoke] Set VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }

  const result = await probePasswordReadable(anonKey, 'anon');
  if (result.skipped) {
    console.error('[verify-password-revoke] Missing Supabase URL/key');
    process.exit(1);
  }

  console.log(`[verify-password-revoke] ${result.label}: ${result.detail}`);
  if (!result.blocked) {
    console.error(`
[verify-password-revoke] FAIL — anon can read password hashes.

Fix: run in Supabase SQL Editor:
  scripts/migrations/fix-revoke-users-password.sql
  (must REVOKE ALL on users first — bare REVOKE SELECT (password) does not stick)

Or: npm run db:apply-launch-security (requires DATABASE_URL)
`);
    process.exit(1);
  }

  console.log('[verify-password-revoke] OK — password column not exposed to anon');
}

main().catch((err) => {
  console.error('[verify-password-revoke] Error:', err.message || err);
  process.exit(1);
});

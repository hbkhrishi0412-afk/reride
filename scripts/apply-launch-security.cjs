#!/usr/bin/env node
/**
 * Apply remaining launch-security SQL (password column revoke).
 * Requires DATABASE_URL in .env.local — Supabase → Settings → Database → URI.
 *
 * Usage:
 *   node scripts/apply-launch-security.cjs
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

const SQL_FILES = [
  'scripts/migrations/fix-users-rls-recursion.sql',
  'scripts/migrations/fix-users-rls-anon-access.sql',
  'scripts/migrations/fix-revoke-users-password.sql',
  'scripts/migrations/fix-security-kv-rpc-grants.sql',
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.error(`
[apply-launch-security] DATABASE_URL is not set.

Paste this in Supabase SQL Editor instead:
  scripts/migrations/fix-users-rls-recursion.sql

Then verify: npm run db:verify-password-revoke && npm run db:verify-rls
`);
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('[apply-launch-security] Install pg: npm install --save-dev pg');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[apply-launch-security] Connected');

  for (const rel of SQL_FILES) {
    const sql = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    console.log(`[apply-launch-security] Applying ${rel}...`);
    await client.query(sql);
    console.log(`[apply-launch-security] OK: ${rel}`);
  }

  await client.end();
  console.log('[apply-launch-security] Done. Run: npm run db:verify-password-revoke');
}

main().catch((err) => {
  console.error('[apply-launch-security] Failed:', err.message || err);
  process.exit(1);
});

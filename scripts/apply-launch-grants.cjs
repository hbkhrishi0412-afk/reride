#!/usr/bin/env node
/**
 * Apply launch grant fixes only (password column + security_kv RPC lockdown).
 * Requires DATABASE_URL in .env.local — or paste scripts/migrations/fix-launch-security-grants.sql in SQL Editor.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const sqlPath = path.join(ROOT, 'scripts/migrations/fix-launch-security-grants.sql');

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

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  let projectRef = process.env.SUPABASE_PROJECT_REF || '';
  if (!projectRef && projectUrl) {
    try {
      projectRef = new URL(projectUrl).hostname.split('.')[0];
    } catch {
      /* ignore */
    }
  }

  if (!databaseUrl) {
    console.error(`
[db:apply-launch-grants] DATABASE_URL is not set.

Paste this file in Supabase SQL Editor:
  scripts/migrations/fix-launch-security-grants.sql

Dashboard: https://supabase.com/dashboard/project/${projectRef || 'YOUR_PROJECT_REF'}/sql/new

Then verify:
  npm run db:verify-password-revoke
  npm run verify:supabase-security-kv
`);
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('[db:apply-launch-grants] Install pg: npm install --save-dev pg');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('[db:apply-launch-grants] SUCCESS — password revoke + security_kv RPC lockdown applied.');
    console.log('[db:apply-launch-grants] Run: npm run db:verify-password-revoke && npm run verify:supabase-security-kv');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db:apply-launch-grants] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

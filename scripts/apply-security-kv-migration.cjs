#!/usr/bin/env node
/**
 * Apply security_kv migration (Upstash alternative) to Supabase Postgres.
 * Loads .env.local. Requires DATABASE_URL or SUPABASE_DB_URL (Supabase → Database → URI).
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const sqlPath = path.join(ROOT, 'supabase/migrations/20260711000004_security_kv.sql');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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
  const sql = fs.readFileSync(sqlPath, 'utf8');

  if (!databaseUrl) {
    const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    let projectRef = process.env.SUPABASE_PROJECT_REF || '';
    if (!projectRef && projectUrl) {
      try {
        projectRef = new URL(projectUrl).hostname.split('.')[0];
      } catch {
        /* ignore */
      }
    }
    console.error(`
[db:apply-security-kv] DATABASE_URL is not set.

Option A — Supabase SQL Editor (fastest):
  1. Open https://supabase.com/dashboard/project/${projectRef || 'YOUR_PROJECT_REF'}/sql/new
  2. Paste contents of: supabase/migrations/20260711000004_security_kv.sql
  3. Run, then: npm run verify:supabase-security-kv

Option B — CLI with direct Postgres URI:
  Add DATABASE_URL to .env.local (Supabase → Project Settings → Database → Connection string)
  Then re-run: npm run db:apply-security-kv
`);
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('[db:apply-security-kv] Install pg: npm install --save-dev pg');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('SUCCESS: security_kv migration applied.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db:apply-security-kv] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Apply production SQL migrations to Supabase via DATABASE_URL (direct Postgres).
 *
 * Setup:
 *   Supabase Dashboard → Project Settings → Database → Connection string (URI)
 *   Set DATABASE_URL in .env.local (never commit)
 *
 * Usage:
 *   node scripts/apply-production-migrations.cjs
 *   node scripts/apply-production-migrations.cjs --dry-run
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const dryRun = process.argv.includes('--dry-run');

const MIGRATION_FILES = [
  'scripts/migrations/add-deal-platform-rls-policies.sql',
  'scripts/migrations/add-support-chat-tables.sql',
];

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
  if (!databaseUrl) {
    console.error(`
[apply-migrations] DATABASE_URL is not set.

Run these SQL files manually in Supabase SQL Editor (in order):
${MIGRATION_FILES.map((f) => `  - ${f}`).join('\n')}

Also run (if not already):
  - scripts/enable-rls-production.sql

Then set SUPABASE_RLS_PRODUCTION_VERIFIED=true in Vercel.
`);
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('[apply-migrations] Install pg: npm install --save-dev pg');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  if (dryRun) {
    console.log('[apply-migrations] Dry run — would apply:');
    for (const rel of MIGRATION_FILES) {
      const abs = path.join(ROOT, rel);
      console.log(`  ${rel} (${fs.statSync(abs).size} bytes)`);
    }
    return;
  }

  await client.connect();
  console.log('[apply-migrations] Connected to Postgres');

  for (const rel of MIGRATION_FILES) {
    const abs = path.join(ROOT, rel);
    const sql = fs.readFileSync(abs, 'utf8');
    console.log(`[apply-migrations] Applying ${rel}...`);
    await client.query(sql);
    console.log(`[apply-migrations] OK: ${rel}`);
  }

  await client.end();
  console.log('[apply-migrations] Done. Set SUPABASE_RLS_PRODUCTION_VERIFIED=true and redeploy.');
}

main().catch((err) => {
  console.error('[apply-migrations] Failed:', err.message || err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * One-shot setup when you have Supabase but not Upstash:
 * 1. Apply security_kv migration (needs DATABASE_URL) or print SQL Editor link
 * 2. Enable leaked-password protection (needs SUPABASE_ACCESS_TOKEN)
 * 3. Run verify:supabase-security-kv + verify:production-security
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

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

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
  return r.status ?? 1;
}

async function main() {
  console.log('=== ReRide setup: Supabase-only (no Upstash) ===\n');

  const hasDb = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
  if (hasDb) {
    console.log('Step 1: Applying security_kv migration...');
    run('node', ['scripts/apply-security-kv-migration.cjs']);
  } else {
    console.log('Step 1: security_kv migration (manual — no DATABASE_URL)\n');
    run('node', ['scripts/apply-security-kv-migration.cjs']);
  }

  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    console.log('\nStep 2: Configuring auth security...');
    const hibpStatus = run('node', ['scripts/enable-compromised-password-protection.cjs']);
    if (hibpStatus !== 0) {
      console.log('\nStep 2b: HIBP unavailable (likely Free tier) — applying compensating controls...');
      run('node', ['scripts/configure-free-tier-auth.cjs']);
    }
  } else {
    console.log('\nStep 2: SKIP — add SUPABASE_ACCESS_TOKEN to .env.local, then run:');
    console.log('  npm run security:configure-free-tier-auth');
  }

  console.log('\nStep 3: Verifying Supabase security_kv...');
  const kvStatus = run('node', ['scripts/verify-supabase-security-kv.cjs']);

  console.log('\nStep 4: Production security readiness...');
  process.env.NODE_ENV = 'production';
  process.env.VERCEL_ENV = 'production';
  run('node', ['--import', 'tsx', 'scripts/verify-production-security-readiness.cjs']);

  process.exit(kvStatus);
}

main();

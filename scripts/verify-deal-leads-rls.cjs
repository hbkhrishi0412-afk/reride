#!/usr/bin/env node
/**
 * Verify critical RLS policies via Supabase REST (no DATABASE_URL required).
 * Falls back to direct Postgres when DATABASE_URL is set.
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

const REQUIRED_TABLES = [
  'deal_leads',
  'deal_offers',
  'platform_settings',
  'support_chat_sessions',
  'support_chat_messages',
];

function getSupabaseConfig() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, anonKey, serviceKey };
}

async function verifyViaRest() {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  if (!url || !anonKey || !serviceKey) {
    console.error('[verify-rls] Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const headers = (key) => ({
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  });

  let failed = false;
  console.log('[verify-rls] REST probes (no DATABASE_URL):');

  // platform_settings: anon blocked, service role allowed
  const [anonPlatform, svcPlatform] = await Promise.all([
    fetch(`${url}/rest/v1/platform_settings?select=id&limit=1`, { headers: headers(anonKey) }),
    fetch(`${url}/rest/v1/platform_settings?select=id&limit=1`, { headers: headers(serviceKey) }),
  ]);
  const anonPlatformData = anonPlatform.ok ? await anonPlatform.json() : [];
  const svcPlatformData = svcPlatform.ok ? await svcPlatform.json() : [];
  const platformOk =
    Array.isArray(anonPlatformData) &&
    anonPlatformData.length === 0 &&
    Array.isArray(svcPlatformData) &&
    svcPlatformData.length > 0;
  console.log(`  ${platformOk ? '✓' : '✗'} platform_settings: anon blocked, service role reads`);
  if (!platformOk) failed = true;

  // users: anon can read public directory without infinite recursion
  const usersRes = await fetch(`${url}/rest/v1/users?select=id,email,role&limit=1`, {
    headers: headers(anonKey),
  });
  const usersBody = usersRes.ok ? await usersRes.json() : await usersRes.text().catch(() => '');
  const usersDenied =
    typeof usersBody === 'string' &&
    (usersBody.includes('infinite recursion') || usersBody.includes('permission denied for function is_admin'));
  const usersOk = usersRes.ok && !usersDenied;
  console.log(
    `  ${usersOk ? '✓' : '✗'} users: anon SELECT works (${usersOk ? 'public directory readable' : `HTTP ${usersRes.status}`})`,
  );
  if (!usersOk) failed = true;

  // deal tables exist and respond (service role)
  for (const table of ['deal_leads', 'deal_offers', 'support_chat_sessions', 'support_chat_messages']) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers: headers(serviceKey) });
    const ok = res.ok;
    console.log(`  ${ok ? '✓' : '✗'} ${table}: reachable`);
    if (!ok) failed = true;
  }

  return failed;
}

async function verifyViaPg(databaseUrl) {
  const pg = require('pg');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows } = await client.query(
    `SELECT tablename, COUNT(*)::int AS policy_count
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = ANY($1::text[])
     GROUP BY tablename
     ORDER BY tablename`,
    [REQUIRED_TABLES],
  );

  const byTable = Object.fromEntries(rows.map((r) => [r.tablename, r.policy_count]));
  let failed = false;

  console.log('[verify-rls] Policy counts (DATABASE_URL):');
  for (const table of REQUIRED_TABLES) {
    const count = byTable[table] ?? 0;
    const ok = count > 0;
    console.log(`  ${ok ? '✓' : '✗'} ${table}: ${count} policies`);
    if (!ok) failed = true;
  }

  await client.end();
  return failed;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  let failed = false;

  if (databaseUrl) {
    try {
      failed = await verifyViaPg(databaseUrl);
    } catch (err) {
      console.error('[verify-rls] Postgres check failed:', err.message || err);
      failed = true;
    }
  } else {
    failed = await verifyViaRest();
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('[verify-rls] Error:', err.message || err);
  process.exit(1);
});

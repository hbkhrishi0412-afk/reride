#!/usr/bin/env node
/**
 * Apply SQL to the linked Supabase project via Management API.
 * Uses SUPABASE_ACCESS_TOKEN + project ref from SUPABASE_URL.
 *
 * Usage:
 *   node scripts/apply-sql-via-management-api.cjs supabase/migrations/20260722000000_messages_normalize_and_perf_indexes.sql
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));
loadEnvFile(path.join(process.cwd(), '.env.local'));

async function main() {
  const rel = process.argv[2];
  if (!rel) {
    console.error('Usage: node scripts/apply-sql-via-management-api.cjs <sql-file>');
    process.exit(1);
  }
  const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const refMatch = url.match(/https:\/\/([^.]+)\./);
  const ref = process.env.SUPABASE_PROJECT_REF || (refMatch && refMatch[1]);

  if (!token || !ref) {
    console.error('Need SUPABASE_ACCESS_TOKEN and SUPABASE_URL (or SUPABASE_PROJECT_REF)');
    process.exit(1);
  }

  const query = fs.readFileSync(abs, 'utf8');
  console.log(`[apply-sql] Applying ${path.relative(process.cwd(), abs)} to project ${ref}…`);

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[apply-sql] FAILED ${res.status}`);
    console.error(text.slice(0, 2000));
    process.exit(1);
  }
  console.log('[apply-sql] OK');
  if (text && text !== '[]' && text !== 'null') {
    console.log(text.slice(0, 1000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

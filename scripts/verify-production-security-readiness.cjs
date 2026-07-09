#!/usr/bin/env node
/**
 * Verifies production security prerequisites using live Supabase probes.
 * Loads .env.local when present. Does not print secrets.
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

process.env.NODE_ENV = 'production';
process.env.VERCEL_ENV = process.env.VERCEL_ENV || 'production';

async function main() {
  const { verifyProductionSecurityReadiness } = await import('../server/production-security.ts');
  const result = await verifyProductionSecurityReadiness();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

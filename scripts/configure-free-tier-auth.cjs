#!/usr/bin/env node
/**
 * Configures Supabase Auth compensating controls for Free tier (no HIBP).
 * Sets password_min_length=8 via Management API.
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

const SUPABASE_API_BASE = 'https://api.supabase.com/v1';
const TARGET_MIN_LENGTH = 8;

function getEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function deriveProjectRef() {
  const explicit = getEnv('SUPABASE_PROJECT_REF');
  if (explicit) return explicit;
  const projectUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
  if (!projectUrl) return '';
  try {
    return new URL(projectUrl).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { ok: response.ok, status: response.status, body: json };
}

async function main() {
  const accessToken = getEnv('SUPABASE_ACCESS_TOKEN');
  const projectRef = deriveProjectRef();
  if (!accessToken) {
    console.error('FAILED: Missing SUPABASE_ACCESS_TOKEN in .env.local');
    process.exit(1);
  }
  if (!projectRef) {
    console.error('FAILED: Missing SUPABASE_PROJECT_REF or SUPABASE_URL');
    process.exit(1);
  }

  const authConfigUrl = `${SUPABASE_API_BASE}/projects/${projectRef}/config/auth`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const current = await requestJson(authConfigUrl, { method: 'GET', headers });
  if (!current.ok) {
    console.error(`FAILED: Could not read auth config (status ${current.status})`);
    process.exit(1);
  }

  const currentMin = current.body?.password_min_length;
  if (typeof currentMin === 'number' && currentMin >= TARGET_MIN_LENGTH) {
    console.log(`OK: Supabase password_min_length is already ${currentMin}.`);
    process.exit(0);
  }

  const patch = await requestJson(authConfigUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ password_min_length: TARGET_MIN_LENGTH }),
  });

  if (!patch.ok) {
    const message = typeof patch.body?.message === 'string' ? patch.body.message : '';
    console.error(`FAILED: Could not set password_min_length (status ${patch.status})`);
    if (message) console.error(message);
    process.exit(1);
  }

  const verify = await requestJson(authConfigUrl, { method: 'GET', headers });
  const updatedMin = verify.body?.password_min_length;
  if (typeof updatedMin === 'number' && updatedMin >= TARGET_MIN_LENGTH) {
    console.log(`SUCCESS: Supabase password_min_length set to ${updatedMin}.`);
    console.log('Free-tier compensating control is active (server also enforces strength on register/reset).');
    process.exit(0);
  }

  console.error('FAILED: PATCH succeeded but password_min_length was not updated as expected.');
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

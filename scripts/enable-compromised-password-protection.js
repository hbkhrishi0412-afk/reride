#!/usr/bin/env node
/**
 * Enables Supabase Auth leaked-password protection (Have I Been Pwned).
 *
 * Required environment variables:
 * - SUPABASE_ACCESS_TOKEN: Personal access token from Supabase dashboard
 * - SUPABASE_PROJECT_REF: Project ref (e.g. abcd1234xyz)
 *   OR VITE_SUPABASE_URL / SUPABASE_URL so project ref can be derived
 */

const SUPABASE_API_BASE = 'https://api.supabase.com/v1';

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
    const host = new URL(projectUrl).hostname;
    return host.split('.')[0] || '';
  } catch {
    return '';
  }
}

function collectTruthyFlags(input, out = new Set()) {
  if (!input || typeof input !== 'object') return out;

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'boolean' && value === true) {
      out.add(key.toLowerCase());
      continue;
    }

    if (value && typeof value === 'object') {
      collectTruthyFlags(value, out);
    }
  }

  return out;
}

function hasCompromisedPasswordProtectionEnabled(config) {
  const keys = collectTruthyFlags(config);
  const expectedTokens = ['hibp', 'pwned', 'compromised', 'leaked'];

  return Array.from(keys).some((key) => expectedTokens.some((token) => key.includes(token)));
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

async function enableProtection() {
  const accessToken = getEnv('SUPABASE_ACCESS_TOKEN');
  const projectRef = deriveProjectRef();

  if (!accessToken) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN');
  }
  if (!projectRef) {
    throw new Error('Missing SUPABASE_PROJECT_REF (or valid VITE_SUPABASE_URL / SUPABASE_URL)');
  }

  const authConfigUrl = `${SUPABASE_API_BASE}/projects/${projectRef}/config/auth`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const payloadCandidates = [
    { password_hibp_enabled: true },
    { security: { password_hibp_enabled: true } },
    { security: { password: { hibp_enabled: true } } },
    { security: { password: { haveibeenpwned_enabled: true } } },
    { leaked_password_protection_enabled: true },
  ];

  let lastFailure = null;

  for (const payload of payloadCandidates) {
    const patchResult = await requestJson(authConfigUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });

    if (!patchResult.ok) {
      lastFailure = patchResult;
      continue;
    }

    const verifyResult = await requestJson(authConfigUrl, {
      method: 'GET',
      headers,
    });

    if (!verifyResult.ok) {
      lastFailure = verifyResult;
      continue;
    }

    if (hasCompromisedPasswordProtectionEnabled(verifyResult.body)) {
      return {
        projectRef,
        config: verifyResult.body,
      };
    }

    lastFailure = {
      status: 200,
      body: {
        message: 'PATCH succeeded but expected leaked-password flag was not found in auth config.',
        attemptedPayload: payload,
      },
    };
  }

  const suffix = lastFailure ? ` (status ${lastFailure.status})` : '';
  throw new Error(`Unable to enable compromised password protection${suffix}`);
}

async function main() {
  try {
    const result = await enableProtection();
    console.log('SUCCESS: Supabase leaked-password protection is enabled.');
    console.log(`Project ref: ${result.projectRef}`);
  } catch (error) {
    console.error('FAILED: Could not enable leaked-password protection.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('enable-compromised-password-protection.js')) {
  main();
}

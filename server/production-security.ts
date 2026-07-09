type SecurityCheckResult =
  | { ok: true }
  | {
      ok: false;
      issues: string[];
      requiredActions: string[];
    };

const RLS_PROBE_CACHE_MS = 5 * 60 * 1000;
let rlsProbeCache: { verified: boolean; checkedAt: number } | null = null;

function isProdDeployment(): boolean {
  const vercelEnv = String(process.env.VERCEL_ENV || '').toLowerCase();
  return process.env.NODE_ENV === 'production' || vercelEnv === 'production';
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function getSupabaseProbeConfig(): { url: string; anonKey: string; serviceRoleKey: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !anonKey || !serviceRoleKey) return null;
  if (
    url.includes('your-project-ref') ||
    anonKey.includes('your_supabase') ||
    serviceRoleKey.includes('your_supabase_service_role_key')
  ) {
    return null;
  }
  return { url, anonKey, serviceRoleKey };
}

async function probeRlsProductionState(): Promise<boolean> {
  const now = Date.now();
  if (rlsProbeCache && now - rlsProbeCache.checkedAt < RLS_PROBE_CACHE_MS) {
    return rlsProbeCache.verified;
  }

  const config = getSupabaseProbeConfig();
  if (!config) {
    rlsProbeCache = { verified: false, checkedAt: now };
    return false;
  }

  const headers = (key: string) => ({
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  });

  try {
    // platform_settings has server-only rows; with RLS enabled anon must see [] while service role sees data.
    const [adminRes, anonRes] = await Promise.all([
      fetch(`${config.url}/rest/v1/platform_settings?select=id&limit=1`, {
        headers: headers(config.serviceRoleKey),
      }),
      fetch(`${config.url}/rest/v1/platform_settings?select=id&limit=1`, {
        headers: headers(config.anonKey),
      }),
    ]);

    if (!adminRes.ok) {
      rlsProbeCache = { verified: false, checkedAt: now };
      return false;
    }

    const adminData = await adminRes.json();
    const anonData = anonRes.ok ? await anonRes.json() : null;
    const adminHasRows = Array.isArray(adminData) && adminData.length > 0;
    const anonBlocked = Array.isArray(anonData) && anonData.length === 0;

    const verified = adminHasRows && anonBlocked;
    rlsProbeCache = { verified, checkedAt: now };
    return verified;
  } catch {
    rlsProbeCache = { verified: false, checkedAt: now };
    return false;
  }
}

async function isRlsProductionReady(): Promise<boolean> {
  if (parseBooleanEnv(process.env.SUPABASE_RLS_PRODUCTION_VERIFIED)) {
    return true;
  }
  return probeRlsProductionState();
}

/**
 * Fail closed for production if critical security rollout steps were skipped.
 * This prevents accidental deployment where anon key + missing RLS or Redis
 * fallback would weaken protections in serverless environments.
 */
export async function verifyProductionSecurityReadiness(): Promise<SecurityCheckResult> {
  if (!isProdDeployment()) return { ok: true };

  const issues: string[] = [];
  const requiredActions: string[] = [];

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!upstashUrl || !upstashToken) {
    issues.push('UPSTASH_REDIS_REST_URL/TOKEN are missing in production.');
    requiredActions.push(
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel (Production), then run scripts/verify-upstash.js.',
    );
  }

  const rlsReady = await isRlsProductionReady();
  if (!rlsReady) {
    issues.push('SUPABASE_RLS_PRODUCTION_VERIFIED is not enabled and live RLS checks did not pass.');
    requiredActions.push(
      'Run scripts/enable-rls-production.sql and scripts/revoke-users-password-from-anon.sql in Supabase SQL Editor, validate policies, then set SUPABASE_RLS_PRODUCTION_VERIFIED=true in Vercel (or redeploy after RLS is confirmed).',
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues, requiredActions };
  }
  return { ok: true };
}

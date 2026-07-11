import {
  isSupabaseSecurityKvConfigured,
  probeSupabaseSecurityKv,
} from '../lib/security-kv-supabase.js';
type SecurityCheckResult =
  | { ok: true }
  | {
      ok: false;
      issues: string[];
      requiredActions: string[];
    };

const RLS_PROBE_CACHE_MS = 5 * 60 * 1000;
const UPSTASH_PROBE_CACHE_MS = 2 * 60 * 1000;
const HIBP_PLAN_PROBE_CACHE_MS = 24 * 60 * 60 * 1000;
/** Compensating control when Supabase HIBP is unavailable on Free tier. */
const FREE_TIER_MIN_PASSWORD_LENGTH = 8;
let rlsProbeCache: { verified: boolean; checkedAt: number } | null = null;
let upstashProbeCache: { verified: boolean; checkedAt: number } | null = null;
let hibpPlanProbeCache: { blockedByPlan: boolean; checkedAt: number } | null = null;

/** @internal test helper */
export function resetProductionSecurityProbeCachesForTests(): void {
  rlsProbeCache = null;
  upstashProbeCache = null;
  hibpPlanProbeCache = null;
}

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

function deriveSupabaseProjectRef(): string {
  const explicit = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) return explicit;
  const projectUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  if (!projectUrl) return '';
  try {
    return new URL(projectUrl).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function collectTruthyFlags(input: unknown, out = new Set<string>()): Set<string> {
  if (!input || typeof input !== 'object') return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
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

function hasLeakedPasswordProtectionEnabled(config: unknown): boolean {
  const keys = collectTruthyFlags(config);
  const expectedTokens = ['hibp', 'pwned', 'compromised', 'leaked'];
  return Array.from(keys).some((key) => expectedTokens.some((token) => key.includes(token)));
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

async function isDistributedSecurityReady(): Promise<boolean> {
  if (parseBooleanEnv(process.env.SUPABASE_DISTRIBUTED_SECURITY_VERIFIED)) {
    return true;
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) {
    return probeUpstashConnectivity();
  }

  if (!isSupabaseSecurityKvConfigured()) {
    return false;
  }
  return probeSupabaseSecurityKv();
}

async function probeUpstashConnectivity(): Promise<boolean> {
  const now = Date.now();
  if (upstashProbeCache && now - upstashProbeCache.checkedAt < UPSTASH_PROBE_CACHE_MS) {
    return upstashProbeCache.verified;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    upstashProbeCache = { verified: false, checkedAt: now };
    return false;
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url, token });
    const probeKey = `reride:security-probe:${Date.now()}`;
    await redis.set(probeKey, 'ok', { ex: 30 });
    const val = await redis.get(probeKey);
    await redis.del(probeKey);
    const verified = val === 'ok';
    upstashProbeCache = { verified, checkedAt: now };
    return verified;
  } catch {
    upstashProbeCache = { verified: false, checkedAt: now };
    return false;
  }
}

function isHibpPlanBlockResponse(status: number, bodyText: string): boolean {
  return status === 402 || /pro plan/i.test(bodyText) || /plan or higher/i.test(bodyText);
}

function isFreeTierPasswordPolicyReady(config: unknown): boolean {
  if (!config || typeof config !== 'object') return false;
  const minLength = (config as { password_min_length?: unknown }).password_min_length;
  return typeof minLength === 'number' && minLength >= FREE_TIER_MIN_PASSWORD_LENGTH;
}

async function fetchSupabaseAuthConfig(): Promise<Record<string, unknown> | null> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = deriveSupabaseProjectRef();
  if (!accessToken || !projectRef) return null;

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const config = await response.json();
    return config && typeof config === 'object' ? (config as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function isHibpBlockedBySupabasePlan(): Promise<boolean> {
  const now = Date.now();
  if (hibpPlanProbeCache && now - hibpPlanProbeCache.checkedAt < HIBP_PLAN_PROBE_CACHE_MS) {
    return hibpPlanProbeCache.blockedByPlan;
  }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = deriveSupabaseProjectRef();
  if (!accessToken || !projectRef) {
    hibpPlanProbeCache = { blockedByPlan: false, checkedAt: now };
    return false;
  }

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ password_hibp_enabled: true }),
    });
    const bodyText = await response.text();
    const blockedByPlan = isHibpPlanBlockResponse(response.status, bodyText);
    hibpPlanProbeCache = { blockedByPlan, checkedAt: now };
    return blockedByPlan;
  } catch {
    hibpPlanProbeCache = { blockedByPlan: false, checkedAt: now };
    return false;
  }
}

async function isLeakedPasswordProtectionReady(): Promise<boolean> {
  if (parseBooleanEnv(process.env.SUPABASE_LEAKED_PASSWORD_PROTECTION_VERIFIED)) {
    return true;
  }

  const config = await fetchSupabaseAuthConfig();
  if (!config) return false;

  if (hasLeakedPasswordProtectionEnabled(config)) {
    return true;
  }

  if (config.password_hibp_enabled === false) {
    const planBlocked = await isHibpBlockedBySupabasePlan();
    if (planBlocked) {
      // Free tier: HIBP is unavailable — require compensating password policy instead.
      return isFreeTierPasswordPolicyReady(config);
    }
  }

  return false;
}

/**
 * Fail closed for production if critical security rollout steps were skipped.
 */
export async function verifyProductionSecurityReadiness(): Promise<SecurityCheckResult> {
  if (!isProdDeployment()) return { ok: true };

  const issues: string[] = [];
  const requiredActions: string[] = [];

  const distributedReady = await isDistributedSecurityReady();
  if (!distributedReady) {
    const hasUpstash = Boolean(
      process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
    );
    if (hasUpstash) {
      issues.push('Upstash Redis credentials are set but connectivity probe failed.');
      requiredActions.push(
        'Verify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, then run npm run verify:upstash.',
      );
    } else {
      issues.push(
        'No distributed security store: set Upstash Redis OR apply Supabase security_kv migration.',
      );
      requiredActions.push(
        'Without Upstash: run npm run db:apply-security-kv (or paste supabase/migrations/20260711000004_security_kv.sql in Supabase SQL Editor), then npm run verify:supabase-security-kv.',
      );
      requiredActions.push(
        'Optional: set SUPABASE_DISTRIBUTED_SECURITY_VERIFIED=true in Vercel after verify:supabase-security-kv passes.',
      );
    }
  }

  const rlsReady = await isRlsProductionReady();
  if (!rlsReady) {
    issues.push('SUPABASE_RLS_PRODUCTION_VERIFIED is not enabled and live RLS checks did not pass.');
    requiredActions.push(
      'Run scripts/enable-rls-production.sql and scripts/revoke-users-password-from-anon.sql in Supabase SQL Editor, validate policies, then set SUPABASE_RLS_PRODUCTION_VERIFIED=true in Vercel (or redeploy after RLS is confirmed).',
    );
  }

  const leakedPasswordReady = await isLeakedPasswordProtectionReady();
  if (!leakedPasswordReady) {
    const config = await fetchSupabaseAuthConfig();
    const onFreeTier =
      config?.password_hibp_enabled === false && (await isHibpBlockedBySupabasePlan());
    if (onFreeTier && config && !isFreeTierPasswordPolicyReady(config)) {
      issues.push(
        `Supabase Free tier: password_min_length must be at least ${FREE_TIER_MIN_PASSWORD_LENGTH} (HIBP unavailable on Free).`,
      );
      requiredActions.push(
        `Run npm run security:configure-free-tier-auth to set Supabase password_min_length=${FREE_TIER_MIN_PASSWORD_LENGTH}.`,
      );
    } else {
      issues.push('Supabase leaked-password protection (HaveIBeenPwned) is not enabled.');
      requiredActions.push(
        'Run npm run security:enable-compromised-password-protection (needs Supabase Pro for HIBP). On Free tier, run npm run security:configure-free-tier-auth instead.',
      );
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues, requiredActions };
  }
  return { ok: true };
}

export {
  FREE_TIER_MIN_PASSWORD_LENGTH,
  hasLeakedPasswordProtectionEnabled,
  isFreeTierPasswordPolicyReady,
  isHibpPlanBlockResponse,
  probeUpstashConnectivity,
  isHibpBlockedBySupabasePlan,
  isLeakedPasswordProtectionReady,
  isDistributedSecurityReady,
};

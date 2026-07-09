type SecurityCheckResult =
  | { ok: true }
  | {
      ok: false;
      issues: string[];
      requiredActions: string[];
    };

function isProdDeployment(): boolean {
  const vercelEnv = String(process.env.VERCEL_ENV || '').toLowerCase();
  return process.env.NODE_ENV === 'production' || vercelEnv === 'production';
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

/**
 * Fail closed for production if critical security rollout steps were skipped.
 * This prevents accidental deployment where anon key + missing RLS or Redis
 * fallback would weaken protections in serverless environments.
 */
export function verifyProductionSecurityReadiness(): SecurityCheckResult {
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

  const rlsVerified = parseBooleanEnv(process.env.SUPABASE_RLS_PRODUCTION_VERIFIED);
  if (!rlsVerified) {
    issues.push('SUPABASE_RLS_PRODUCTION_VERIFIED is not enabled.');
    requiredActions.push(
      'Run scripts/enable-rls-production.sql and scripts/revoke-users-password-from-anon.sql in Supabase SQL Editor, validate policies, then set SUPABASE_RLS_PRODUCTION_VERIFIED=true in Vercel.',
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues, requiredActions };
  }
  return { ok: true };
}

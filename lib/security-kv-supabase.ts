/**
 * Supabase Postgres-backed distributed KV (rate limits, token revocation).
 * Production-safe on serverless when Upstash is not configured.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null | undefined;

export function getSupabaseSecurityKvClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key || key.includes('your_supabase_service_role_key')) {
    cachedClient = null;
    return null;
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export function isSupabaseSecurityKvConfigured(): boolean {
  return getSupabaseSecurityKvClient() !== null;
}

export async function securityKvSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const client = getSupabaseSecurityKvClient();
  if (!client) return false;
  const { error } = await client.rpc('security_kv_set', {
    p_key: key,
    p_value: value,
    p_ttl_seconds: Math.max(1, Math.floor(ttlSeconds)),
  });
  return !error;
}

export async function securityKvGet(key: string): Promise<string | null> {
  const client = getSupabaseSecurityKvClient();
  if (!client) return null;
  const { data, error } = await client.rpc('security_kv_get', { p_key: key });
  if (error || data == null) return null;
  return String(data);
}

export async function securityKvDelete(key: string): Promise<boolean> {
  const client = getSupabaseSecurityKvClient();
  if (!client) return false;
  const { error } = await client.rpc('security_kv_delete', { p_key: key });
  return !error;
}

export async function securityKvTouch(key: string, ttlSeconds: number): Promise<number | null> {
  const client = getSupabaseSecurityKvClient();
  if (!client) return null;
  const { data, error } = await client.rpc('security_kv_touch', {
    p_key: key,
    p_ttl_seconds: Math.max(1, Math.floor(ttlSeconds)),
  });
  if (error || data == null) return null;
  return Number(data);
}

export async function probeSupabaseSecurityKv(): Promise<boolean> {
  const key = `reride:supabase-kv-probe:${Date.now()}`;
  if (!(await securityKvSet(key, 'ok', 60))) return false;
  const val = await securityKvGet(key);
  await securityKvDelete(key);
  return val === 'ok';
}

export async function checkSupabaseRateLimit(
  identifier: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; configured: boolean }> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `ratelimit:${identifier}:${bucket}`;
  const count = await securityKvTouch(key, windowSeconds);
  if (count == null) return { allowed: true, remaining: -1, configured: false };
  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    configured: true,
  };
}

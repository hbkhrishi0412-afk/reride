import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from './supabase-admin.js';

const isServerSide = typeof window === 'undefined';

/** Pick admin (server) or anon (browser) client without loading Capacitor auth storage on Vercel. */
export async function resolveSupabaseClient(): Promise<SupabaseClient> {
  if (isServerSide) {
    return getSupabaseAdminClient();
  }
  const { getSupabaseClient } = await import('./supabase-client.js');
  return getSupabaseClient();
}

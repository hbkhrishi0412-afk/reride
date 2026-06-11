// Server-only Supabase admin client (service_role). No client-side auth storage imports.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabaseServerConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
});

const validateSupabaseServerConfig = (config: { url: string; anonKey: string }) => {
  const missingFields: string[] = [];

  if (!config.url || config.url.trim() === '' || config.url.includes('your-project-ref')) {
    missingFields.push('SUPABASE_URL');
  }

  if (!config.anonKey || config.anonKey.trim() === '' || config.anonKey.includes('your_supabase_anon_key')) {
    missingFields.push('SUPABASE_ANON_KEY');
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Supabase configuration is missing required fields: ${missingFields.join(', ')}. ` +
        'Set SUPABASE_URL, SUPABASE_ANON_KEY, etc. in your server environment variables (Vercel, etc.)'
    );
  }

  if (!config.url.startsWith('https://') || !config.url.includes('.supabase.co')) {
    throw new Error('Invalid Supabase URL format. Expected format: https://xxxxx.supabase.co');
  }
};

let supabaseAdminClient: SupabaseClient | null = null;

/** Server-side admin client (service_role). Never import this from browser code. */
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Supabase admin client (service_role) can only be used on the server-side. ' +
        'Never use service_role key in client-side code!'
    );
  }

  if (!supabaseAdminClient) {
    const config = getSupabaseServerConfig();

    if (
      !config.serviceRoleKey ||
      config.serviceRoleKey.trim() === '' ||
      config.serviceRoleKey.includes('your_supabase_service_role_key')
    ) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is required for admin operations. ' +
          'Set it in your server environment variables (Vercel, etc.). ' +
          '⚠️ Keep this key secret - never expose it in client-side code!'
      );
    }

    validateSupabaseServerConfig({ url: config.url, anonKey: config.anonKey });

    try {
      supabaseAdminClient = createClient(config.url, config.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (error) {
      console.error('❌ Supabase admin client initialization error:', error);
      throw new Error(
        `Supabase admin client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return supabaseAdminClient;
}

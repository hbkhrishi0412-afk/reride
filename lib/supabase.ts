// supabase.ts
// Supabase client configuration for both client-side and server-side usage

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to detect if we're running on the server
const isServerSide = typeof window === 'undefined';

// Get Supabase configuration
// CRITICAL: Direct static access to import.meta.env is required for Vite to include these in the build
// Vite statically analyzes the code and only includes env vars that are directly referenced
// DO NOT use dynamic keys or helper functions - use direct property access only
const getSupabaseConfig = () => {
  if (isServerSide) {
    // Server-side: Use process.env (can use both SUPABASE_* and VITE_SUPABASE_*)
    return {
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    };
  } else {
    // Client-side: MUST use direct static import.meta.env access (Vite requirement)
    // This matches the approach in lib/firebase.ts
    return {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      serviceRoleKey: '', // Never use service_role key on client-side
    };
  }
};

// Validate Supabase configuration
const validateSupabaseConfig = (config: { url: string; anonKey: string; serviceRoleKey?: string }) => {
  const missingFields: string[] = [];
  
  if (!config.url || config.url.trim() === '' || config.url.includes('your-project-ref')) {
    missingFields.push(isServerSide ? 'SUPABASE_URL' : 'VITE_SUPABASE_URL');
  }
  
  if (!config.anonKey || config.anonKey.trim() === '' || config.anonKey.includes('your_supabase_anon_key')) {
    missingFields.push(isServerSide ? 'SUPABASE_ANON_KEY' : 'VITE_SUPABASE_ANON_KEY');
  }
  
  if (missingFields.length > 0) {
    const envHint = isServerSide
      ? 'Set SUPABASE_URL, SUPABASE_ANON_KEY, etc. in your server environment variables (Vercel, etc.)'
      : 'Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc. in your .env.local file';
    
    throw new Error(
      `Supabase configuration is missing required fields: ${missingFields.join(', ')}. ${envHint}`
    );
  }
  
  // Validate URL format
  if (!config.url.startsWith('https://') || !config.url.includes('.supabase.co')) {
    throw new Error(
      `Invalid Supabase URL format. Expected format: https://xxxxx.supabase.co`
    );
  }
  
  // Validate anon key format (Supabase keys are typically very long JWT tokens)
  if (config.anonKey.length < 100) {
    console.warn('Supabase anon key seems too short. Make sure you copied the entire key.');
  }
};

// Get Supabase client for client-side operations (uses anon key)
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const config = getSupabaseConfig();
    validateSupabaseConfig(config);
    
    try {
      supabaseClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (error) {
      console.error('❌ Supabase client initialization error:', error);
      throw new Error(
        `Supabase client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  return supabaseClient;
}

// Get Supabase admin client for server-side operations (uses service_role key)
// ⚠️ WARNING: Only use this on the server-side. Never expose service_role key in client code.
let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (!isServerSide) {
    throw new Error(
      'Supabase admin client (service_role) can only be used on the server-side. ' +
      'Never use service_role key in client-side code!'
    );
  }
  
  if (!supabaseAdminClient) {
    const config = getSupabaseConfig();
    
    if (!config.serviceRoleKey || config.serviceRoleKey.trim() === '' || config.serviceRoleKey.includes('your_supabase_service_role_key')) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is required for admin operations. ' +
        'Set it in your server environment variables (Vercel, etc.). ' +
        '⚠️ Keep this key secret - never expose it in client-side code!'
      );
    }
    
    validateSupabaseConfig({ url: config.url, anonKey: config.anonKey });
    
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

// Export a default client instance for convenience
export const supabase = getSupabaseClient();




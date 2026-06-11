// Browser-oriented Supabase anon client (Capacitor auth storage). Not imported by Vercel API routes.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAuthStorage } from '../utils/supabaseNativeAuthStorage.js';

const isServerSide = typeof window === 'undefined';

const getSupabaseConfig = () => {
  if (isServerSide) {
    return {
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
      serviceRoleKey: '',
    };
  }
  return {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: '',
  };
};

const validateSupabaseConfig = (config: { url: string; anonKey: string }) => {
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

  if (!config.url.startsWith('https://') || !config.url.includes('.supabase.co')) {
    throw new Error('Invalid Supabase URL format. Expected format: https://xxxxx.supabase.co');
  }

  if (config.anonKey.length < 100) {
    console.warn('Supabase anon key seems too short. Make sure you copied the entire key.');
  }
};

let supabaseClient: SupabaseClient | null = null;
let supabaseConfigInvalid = false;
let stubClientInstance: SupabaseClient | null = null;

function createStubClient(): SupabaseClient {
  if (stubClientInstance) return stubClientInstance;
  const noop = () => {};
  const stubChannel = {
    on: () => stubChannel,
    subscribe: (cb?: (status: string) => void) => {
      if (cb) setTimeout(() => cb('CHANNEL_ERROR'), 0);
      return { unsubscribe: noop };
    },
    unsubscribe: noop,
  };
  const stubFromChain = () => Promise.resolve({ data: null, error: null });
  const stubFrom = () => ({
    select: () => ({
      eq: () => ({
        single: () => stubFromChain(),
        order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
      }),
      insert: () => ({ select: () => ({ single: () => stubFromChain() }) }),
      update: () => ({ eq: () => stubFromChain() }),
      delete: () => ({ eq: () => ({ select: () => stubFromChain() }) }),
    }),
  });
  stubClientInstance = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
      exchangeCodeForSession: async () => ({
        data: { session: null, user: null },
        error: new Error('Supabase not configured (missing VITE env in build)'),
      }),
      setSession: async () => ({ data: null, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      persistSession: true,
      autoRefreshToken: true,
    } as any,
    channel: () => stubChannel as any,
    removeChannel: noop,
    from: stubFrom as any,
  } as unknown as SupabaseClient;
  return stubClientInstance;
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }
  if (supabaseConfigInvalid) {
    return createStubClient();
  }
  const config = getSupabaseConfig();
  const missing =
    !config.url ||
    config.url.trim() === '' ||
    config.url.includes('your-project-ref') ||
    !config.anonKey ||
    config.anonKey.trim() === '' ||
    config.anonKey.includes('your_supabase');
  if (!isServerSide && missing) {
    supabaseConfigInvalid = true;
    console.warn(
      'Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing or placeholder). ReRide will load without real-time features. Set env vars and rebuild to enable.'
    );
    return createStubClient();
  }
  try {
    validateSupabaseConfig(config);
  } catch (e) {
    if (!isServerSide) {
      supabaseConfigInvalid = true;
      console.warn('Supabase config invalid:', e instanceof Error ? e.message : e);
      return createStubClient();
    }
    throw e;
  }
  try {
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: getSupabaseAuthStorage(),
      },
    });
  } catch (error) {
    console.error('❌ Supabase client initialization error:', error);
    if (!isServerSide) {
      supabaseConfigInvalid = true;
      return createStubClient();
    }
    throw new Error(
      `Supabase client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
  return supabaseClient;
}

export function getSupabase(): SupabaseClient {
  return getSupabaseClient();
}

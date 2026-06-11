/**
 * Supabase Auth session storage on Capacitor: encrypted Keychain / Keystore instead of WebView localStorage.
 * Web builds continue to use localStorage (browser default).
 */
import type { SupportedStorage } from '@supabase/supabase-js';
import { isCapacitorNativeApp as isCapacitorNative } from './isCapacitorNative.js';

const LEGACY_SUPABASE_KEYS = ['sb-access-token', 'supabase.auth.token'] as const;

let cachedSupabaseAccessToken: string | null = null;

function parseAccessTokenFromSessionJson(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('eyJ')) return trimmed;
  try {
    const parsed = JSON.parse(raw) as {
      access_token?: string;
      currentSession?: { access_token?: string };
    };
    const t = parsed?.access_token ?? parsed?.currentSession?.access_token;
    return typeof t === 'string' && t.length > 10 ? t : null;
  } catch {
    return null;
  }
}

function refreshSupabaseAccessTokenCache(key: string, raw: string | null): void {
  if (!key.includes('auth-token') && !LEGACY_SUPABASE_KEYS.includes(key as (typeof LEGACY_SUPABASE_KEYS)[number])) {
    return;
  }
  cachedSupabaseAccessToken = parseAccessTokenFromSessionJson(raw);
}

/** Sync read for `getBrowserAccessTokenForApi` after SecureStorage hydration. */
export function getCachedSupabaseAccessTokenSync(): string | null {
  return cachedSupabaseAccessToken;
}

function supabaseAuthKeyFromProjectUrl(): string | null {
  try {
    const url =
      typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_SUPABASE_URL || '') : '';
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/i);
    return match?.[1] ? `sb-${match[1]}-auth-token` : null;
  } catch {
    return null;
  }
}

async function secureStorage() {
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
  return SecureStorage;
}

async function secureGet(key: string): Promise<string | null> {
  try {
    const S = await secureStorage();
    return await S.getItem(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string | null): Promise<void> {
  try {
    const S = await secureStorage();
    if (value) {
      await S.setItem(key, value);
    } else {
      await S.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/** One-time migration from WebView localStorage → SecureStorage. */
async function migrateLegacyLocalKey(key: string): Promise<string | null> {
  if (typeof localStorage === 'undefined') return null;
  try {
    const legacy = localStorage.getItem(key);
    if (!legacy) return null;
    await secureSet(key, legacy);
    localStorage.removeItem(key);
    return legacy;
  } catch {
    return null;
  }
}

function createCapacitorSupabaseAuthStorage(): SupportedStorage {
  return {
    getItem: async (key: string) => {
      const secure = await secureGet(key);
      if (secure != null) {
        refreshSupabaseAccessTokenCache(key, secure);
        return secure;
      }
      const migrated = await migrateLegacyLocalKey(key);
      refreshSupabaseAccessTokenCache(key, migrated);
      return migrated;
    },
    setItem: async (key: string, value: string) => {
      await secureSet(key, value);
      refreshSupabaseAccessTokenCache(key, value);
      try {
        localStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    removeItem: async (key: string) => {
      await secureSet(key, null);
      refreshSupabaseAccessTokenCache(key, null);
      try {
        localStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

let capacitorStorage: SupportedStorage | null = null;

export function getSupabaseAuthStorage(): SupportedStorage {
  if (!isCapacitorNative()) {
    return localStorage;
  }
  if (!capacitorStorage) {
    capacitorStorage = createCapacitorSupabaseAuthStorage();
  }
  return capacitorStorage;
}

/** Clear Supabase auth keys from SecureStorage on native logout. */
export async function clearSupabaseSecureAuthStorage(): Promise<void> {
  if (!isCapacitorNative()) return;
  cachedSupabaseAccessToken = null;
  const keys = new Set<string>([...LEGACY_SUPABASE_KEYS]);
  const projectKey = supabaseAuthKeyFromProjectUrl();
  if (projectKey) keys.add(projectKey);
  await Promise.all([...keys].map((key) => secureSet(key, null)));
}

/** Warm access-token cache after boot (Capacitor init). */
export async function hydrateSupabaseAuthTokenCache(): Promise<void> {
  if (!isCapacitorNative()) return;
  const key = supabaseAuthKeyFromProjectUrl();
  if (!key) return;
  const storage = getSupabaseAuthStorage();
  await storage.getItem(key);
}

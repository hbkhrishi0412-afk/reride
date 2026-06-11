/**
 * Native token persistence — encrypted storage on iOS Keychain / Android Keystore.
 * Falls back to Capacitor Preferences on web and during one-time migration from legacy Preferences keys.
 */

import { isCapacitorNativeApp as isCapacitorNative } from './isCapacitorNative.js';

const ACCESS_KEY = 'reRideAccessToken';
const REFRESH_KEY = 'reRideRefreshToken';

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;
let hydrated = false;
let migrationDone = false;

async function secureStorage() {
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
  return SecureStorage;
}

async function legacyPreferences() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

async function migrateFromLegacyPreferences(): Promise<void> {
  if (!isCapacitorNative() || migrationDone) return;
  migrationDone = true;
  try {
    const P = await legacyPreferences();
    const S = await secureStorage();
    for (const key of [ACCESS_KEY, REFRESH_KEY]) {
      const legacy = await P.get({ key });
      if (legacy.value) {
        await S.setItem(key, legacy.value);
        await P.remove({ key });
      }
    }
  } catch {
    /* non-fatal — secure storage may be unavailable in some emulators */
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (!isCapacitorNative()) return null;
  try {
    const S = await secureStorage();
    return await S.getItem(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string | null): Promise<void> {
  if (!isCapacitorNative()) return;
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

export async function hydrateNativeTokensFromPreferences(): Promise<void> {
  if (!isCapacitorNative() || hydrated) return;
  try {
    await migrateFromLegacyPreferences();
    memoryAccessToken = await secureGet(ACCESS_KEY);
    memoryRefreshToken = await secureGet(REFRESH_KEY);
  } catch {
    memoryAccessToken = null;
    memoryRefreshToken = null;
  } finally {
    hydrated = true;
  }
}

export function getNativeMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export function getNativeMemoryRefreshToken(): string | null {
  return memoryRefreshToken;
}

export async function setNativeAccessToken(token: string | null): Promise<void> {
  memoryAccessToken = token;
  await secureSet(ACCESS_KEY, token);
}

export async function setNativeRefreshToken(token: string | null): Promise<void> {
  memoryRefreshToken = token;
  await secureSet(REFRESH_KEY, token);
}

export async function clearNativeTokens(): Promise<void> {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  await secureSet(ACCESS_KEY, null);
  await secureSet(REFRESH_KEY, null);
}

export async function getNativeRefreshToken(): Promise<string | null> {
  if (memoryRefreshToken) return memoryRefreshToken;
  memoryRefreshToken = await secureGet(REFRESH_KEY);
  return memoryRefreshToken;
}

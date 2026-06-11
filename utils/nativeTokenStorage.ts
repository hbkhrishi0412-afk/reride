/**
 * Native token persistence — encrypted storage on iOS Keychain / Android Keystore where available,
 * with an automatic fallback to Capacitor Preferences (see nativeKeyValueStorage) so iPhone (SPM) builds
 * keep users signed in across restarts.
 */

import { isCapacitorNativeApp as isCapacitorNative } from './isCapacitorNative.js';
import { nativeKvGet, nativeKvRemove, nativeKvSet } from './nativeKeyValueStorage.js';

const ACCESS_KEY = 'reRideAccessToken';
const REFRESH_KEY = 'reRideRefreshToken';

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;
let hydrated = false;
let migrationDone = false;

async function legacyPreferences() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

async function migrateFromLegacyPreferences(): Promise<void> {
  if (!isCapacitorNative() || migrationDone) return;
  migrationDone = true;
  try {
    const P = await legacyPreferences();
    for (const key of [ACCESS_KEY, REFRESH_KEY]) {
      const legacy = await P.get({ key });
      if (legacy.value) {
        const backend = await nativeKvSet(key, legacy.value);
        // Only clear the plaintext Preferences copy if it was promoted to a different (secure) store.
        // When Preferences IS the active backend (iOS SPM), removing here would delete what we just wrote.
        if (backend === 'secure') {
          await P.remove({ key });
        }
      }
    }
  } catch {
    /* non-fatal — secure storage may be unavailable in some emulators */
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (!isCapacitorNative()) return null;
  return nativeKvGet(key);
}

async function secureSet(key: string, value: string | null): Promise<void> {
  if (!isCapacitorNative()) return;
  if (value) {
    await nativeKvSet(key, value);
  } else {
    await nativeKvRemove(key);
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

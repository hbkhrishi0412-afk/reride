/**
 * Mirror critical WebView localStorage session keys to native Keychain / Preferences on
 * Capacitor so they survive WebView localStorage clears on iOS/Android cold starts.
 */
import { isCapacitorNative } from './apiConfig.js';
import { nativeKvGet, nativeKvRemove, nativeKvSet } from './nativeKeyValueStorage.js';

export const SESSION_MIRROR_KEYS = [
  'reride_remember_me',
  'reRideCurrentUser',
  'reride_last_login_role',
] as const;

export type SessionMirrorKey = (typeof SESSION_MIRROR_KEYS)[number];

function nativeMirrorKey(localKey: string): string {
  return `reride_ls_mirror:${localKey}`;
}

/** Restore mirrored session keys from native storage into WebView localStorage before auth boot. */
export async function hydrateNativeSessionMirror(): Promise<void> {
  if (!isCapacitorNative() || typeof localStorage === 'undefined') return;
  await Promise.all(
    SESSION_MIRROR_KEYS.map(async (key) => {
      try {
        const value = await nativeKvGet(nativeMirrorKey(key));
        if (value != null) {
          localStorage.setItem(key, value);
        }
      } catch {
        /* ignore per-key failures */
      }
    }),
  );
}

export async function mirrorSessionKeyToNative(
  key: SessionMirrorKey,
  value: string | null,
): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const nk = nativeMirrorKey(key);
    if (value != null) {
      await nativeKvSet(nk, value);
    } else {
      await nativeKvRemove(nk);
    }
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget native mirror — use only when an awaited write is not possible. */
export function mirrorSessionKeyToNativeSync(key: SessionMirrorKey, value: string | null): void {
  if (!isCapacitorNative()) return;
  void mirrorSessionKeyToNative(key, value);
}

export async function clearNativeSessionMirrorExceptPref(): Promise<void> {
  if (!isCapacitorNative()) return;
  await Promise.all([
    mirrorSessionKeyToNative('reRideCurrentUser', null),
    mirrorSessionKeyToNative('reride_last_login_role', null),
  ]);
}

export function persistCurrentUserMirrorSync(userJson: string): void {
  mirrorSessionKeyToNativeSync('reRideCurrentUser', userJson);
}

export async function persistCurrentUserMirrorAsync(userJson: string): Promise<void> {
  await mirrorSessionKeyToNative('reRideCurrentUser', userJson);
}

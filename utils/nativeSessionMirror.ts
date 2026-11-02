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

type ReadyGate = {
  promise: Promise<void>;
  resolve: () => void;
};

function createReadyGate(alreadyReady: boolean): ReadyGate {
  if (alreadyReady) {
    return { promise: Promise.resolve(), resolve: () => {} };
  }
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const readyGate = createReadyGate(!isCapacitorNative());
let hydrateStarted = false;

/**
 * Resolves when native session keys have been mirrored into WebView localStorage
 * and the Remember me policy has been applied (or immediately on web).
 * Auth restore must await this so a cold start cannot sign a user back in
 * after they opted out.
 * Caps wait at 2s so a hung Preferences/SecureStorage bridge can't stall login UI.
 */
export function whenNativeSessionReady(): Promise<void> {
  if (!isCapacitorNative()) return Promise.resolve();
  return Promise.race([
    readyGate.promise,
    new Promise<void>((resolve) => {
      setTimeout(resolve, 2_000);
    }),
  ]);
}

async function mirrorKeyIntoLocalStorage(key: SessionMirrorKey): Promise<void> {
  try {
    const value = await nativeKvGet(nativeMirrorKey(key));
    if (value != null) {
      localStorage.setItem(key, value);
    }
  } catch {
    /* ignore per-key failures */
  }
}

/** Restore mirrored session keys from native storage into WebView localStorage before auth boot. */
export async function hydrateNativeSessionMirror(): Promise<void> {
  if (!isCapacitorNative() || typeof localStorage === 'undefined') {
    readyGate.resolve();
    return;
  }
  if (hydrateStarted) return readyGate.promise;
  hydrateStarted = true;

  try {
    // Pref first → wipe if needed → only then mirror the user. Avoids a
    // whenNativeSessionReady 2s timeout restoring someone who opted out.
    await mirrorKeyIntoLocalStorage('reride_remember_me');
    const { enforceRememberMePolicyOnBoot } = await import('./rememberMe.js');
    const wiped = await enforceRememberMePolicyOnBoot();
    if (!wiped) {
      await Promise.all([
        mirrorKeyIntoLocalStorage('reRideCurrentUser'),
        mirrorKeyIntoLocalStorage('reride_last_login_role'),
      ]);
    }
    // Tokens only after policy. Parallel Preferences reads can rewrite memory
    // after clearNativeTokens if these run beside the wipe.
    const { hydrateNativeTokensFromPreferences } = await import('./nativeTokenStorage.js');
    const { hydrateSupabaseAuthTokenCache } = await import('./supabaseNativeAuthStorage.js');
    await Promise.all([hydrateNativeTokensFromPreferences(), hydrateSupabaseAuthTokenCache()]);
  } finally {
    readyGate.resolve();
  }

  return readyGate.promise;
}

/**
 * Kick off hydrate without blocking React mount. Safe to call multiple times.
 */
export function startNativeSessionHydrate(): Promise<void> {
  if (!isCapacitorNative()) {
    readyGate.resolve();
    return Promise.resolve();
  }
  return hydrateNativeSessionMirror();
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

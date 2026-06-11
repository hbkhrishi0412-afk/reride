/**
 * Native key/value storage with graceful backend selection.
 *
 * - Prefers encrypted SecureStorage (iOS Keychain / Android Keystore) when the native plugin is registered.
 * - Falls back to @capacitor/preferences when SecureStorage is unavailable. This matters on iOS, where
 *   @aparajita/capacitor-secure-storage ships as a CocoaPods-only plugin and is therefore NOT linked into
 *   the Swift Package Manager (CapApp-SPM) build. Without this fallback, iPhone users would be silently
 *   logged out on app restart because the native Keychain calls reject.
 *
 * @capacitor/preferences IS SPM-compatible and already installed, so it guarantees persistence everywhere.
 */

let secureUnavailable = false;

async function trySecure() {
  if (secureUnavailable) return null;
  try {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    return SecureStorage;
  } catch {
    secureUnavailable = true;
    return null;
  }
}

async function preferences() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

export type KvBackend = 'secure' | 'preferences' | 'none';

export async function nativeKvGet(key: string): Promise<string | null> {
  const S = await trySecure();
  if (S) {
    try {
      return await S.getItem(key);
    } catch {
      // Native Keychain not implemented (e.g. iOS SPM build) — switch to Preferences for the session.
      secureUnavailable = true;
    }
  }
  try {
    const P = await preferences();
    const res = await P.get({ key });
    return res.value ?? null;
  } catch {
    return null;
  }
}

export async function nativeKvSet(key: string, value: string): Promise<KvBackend> {
  const S = await trySecure();
  if (S) {
    try {
      await S.setItem(key, value);
      return 'secure';
    } catch {
      secureUnavailable = true;
    }
  }
  try {
    const P = await preferences();
    await P.set({ key, value });
    return 'preferences';
  } catch {
    return 'none';
  }
}

export async function nativeKvRemove(key: string): Promise<void> {
  const S = await trySecure();
  if (S) {
    try {
      await S.removeItem(key);
    } catch {
      secureUnavailable = true;
    }
  }
  // Always clear the Preferences fallback copy too, so a key can never linger in either store.
  try {
    const P = await preferences();
    await P.remove({ key });
  } catch {
    /* ignore */
  }
}

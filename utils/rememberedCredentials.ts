/**
 * Persist login email when the user checks "Remember me".
 *
 * Email only, on web and on Capacitor. Passwords are never written to
 * localStorage or native KV — the OS password manager fills them back in.
 * Any legacy native password key is deleted the next time credentials load.
 */
import { isCapacitorNative } from './apiConfig.js';
import { mirrorSessionKeyToNative, mirrorSessionKeyToNativeSync } from './nativeSessionMirror.js';
import { nativeKvGet, nativeKvRemove, nativeKvSet } from './nativeKeyValueStorage.js';

export const LAST_ROLE_KEY = 'reride_last_login_role';

export interface RememberedCredentials {
  email: string;
  /** Empty on web; may be set on Capacitor from native secure storage only. */
  password: string;
}

function roleKeyPart(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function rememberedEmailKey(role: string): string {
  return `remembered${roleKeyPart(role)}Email`;
}

export function rememberedPasswordKey(role: string): string {
  return `remembered${roleKeyPart(role)}Password`;
}

function nativeEmailKey(role: string): string {
  return `reride_remembered_${role}_email`;
}

function nativePasswordKey(role: string): string {
  return `reride_remembered_${role}_password`;
}

/** Remove legacy plaintext/obfuscated passwords from web localStorage. */
function scrubLegacyPasswordFromLocal(role: string): void {
  const ls = getLocal();
  if (!ls) return;
  try {
    ls.removeItem(rememberedPasswordKey(role));
  } catch {
    /* ignore */
  }
}

function writeLastLoginRole(role: string | null): void {
  const ls = getLocal();
  if (!ls) return;
  if (role) {
    ls.setItem(LAST_ROLE_KEY, role);
    mirrorSessionKeyToNativeSync('reride_last_login_role', role);
  } else {
    ls.removeItem(LAST_ROLE_KEY);
    mirrorSessionKeyToNativeSync('reride_last_login_role', null);
  }
}

function getLocal(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function writeLocalCredentials(
  role: string,
  email: string,
  _password: string,
  remember: boolean,
): void {
  const ek = rememberedEmailKey(role);
  const pk = rememberedPasswordKey(role);
  const ls = getLocal();
  if (!ls) return;
  // Never persist passwords in localStorage (XSS / shared-device risk).
  ls.removeItem(pk);
  if (remember && email.trim()) {
    ls.setItem(ek, email.trim());
    writeLastLoginRole(role);
  } else {
    ls.removeItem(ek);
    const last = ls.getItem(LAST_ROLE_KEY);
    if (last === role) {
      writeLastLoginRole(null);
    }
  }
}

/** Synchronous read from localStorage — used for first paint (email only on web). */
export function loadRememberedCredentialsSync(role: string): RememberedCredentials | null {
  const ls = getLocal();
  if (!ls) return null;
  try {
    scrubLegacyPasswordFromLocal(role);
    const email = ls.getItem(rememberedEmailKey(role));
    if (!email) return null;
    return {
      email,
      password: '',
    };
  } catch {
    return null;
  }
}

/** Last role the user signed in with while "Remember me" was enabled. */
export function loadLastRememberedLoginRole(): string | null {
  const ls = getLocal();
  if (!ls) return null;
  try {
    const role = ls.getItem(LAST_ROLE_KEY);
    return role && role.trim() ? role.trim() : null;
  } catch {
    return null;
  }
}

/** On Capacitor, hydrate last login role from native when localStorage is empty. */
export async function resolveLastRememberedLoginRole(): Promise<string | null> {
  const fromLocal = loadLastRememberedLoginRole();
  if (fromLocal || !isCapacitorNative()) {
    return fromLocal;
  }
  try {
    const role = await nativeKvGet('reride_ls_mirror:reride_last_login_role');
    if (role && role.trim()) {
      const ls = getLocal();
      ls?.setItem(LAST_ROLE_KEY, role.trim());
      return role.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** On Capacitor, hydrate from native KV when localStorage is empty or stale. */
export async function hydrateRememberedCredentialsFromNative(
  role: string,
): Promise<RememberedCredentials | null> {
  if (!isCapacitorNative()) {
    return loadRememberedCredentialsSync(role);
  }
  try {
    const email = await nativeKvGet(nativeEmailKey(role));
    await nativeKvRemove(nativePasswordKey(role));
    if (!email) return loadRememberedCredentialsSync(role);
    const ls = getLocal();
    if (ls) {
      ls.setItem(rememberedEmailKey(role), email);
      // Keep password out of WebView localStorage even on native.
      ls.removeItem(rememberedPasswordKey(role));
      writeLastLoginRole(role);
    }
    return { email, password: '' };
  } catch {
    return loadRememberedCredentialsSync(role);
  }
}

async function persistRememberedCredentialsNative(
  role: string,
  email: string,
  _password: string,
  remember: boolean,
): Promise<void> {
  const nek = nativeEmailKey(role);
  const npk = nativePasswordKey(role);
  if (remember && email.trim()) {
    await nativeKvSet(nek, email.trim());
    await nativeKvRemove(npk);
    await mirrorSessionKeyToNative('reride_last_login_role', role);
  } else {
    await nativeKvRemove(nek);
    await nativeKvRemove(npk);
    const ls = getLocal();
    if (!ls?.getItem(LAST_ROLE_KEY)) {
      await mirrorSessionKeyToNative('reride_last_login_role', null);
    }
  }
}

/** Save or clear the remembered email. The password argument is ignored. */
export function saveRememberedCredentials(
  role: string,
  email: string,
  password: string,
  remember: boolean,
): void {
  try {
    writeLocalCredentials(role, email, password, remember);
  } catch {
    /* ignore */
  }
  if (isCapacitorNative()) {
    void persistRememberedCredentialsNative(role, email, password, remember);
  }
}

/**
 * Save credentials and await native persistence (required on Capacitor production
 * builds where navigation after login can interrupt fire-and-forget writes).
 */
export async function saveRememberedCredentialsAsync(
  role: string,
  email: string,
  password: string,
  remember: boolean,
): Promise<void> {
  try {
    writeLocalCredentials(role, email, password, remember);
  } catch {
    /* ignore */
  }
  if (isCapacitorNative()) {
    try {
      await persistRememberedCredentialsNative(role, email, password, remember);
    } catch {
      /* ignore — email still in localStorage this session */
    }
  }
}

export function hasRememberedCredentials(role: string): boolean {
  const ls = getLocal();
  if (!ls) return false;
  try {
    return Boolean(ls.getItem(rememberedEmailKey(role)));
  } catch {
    return false;
  }
}

/** Apply remembered credentials to login form state. */
export async function resolveRememberedCredentials(
  role: string,
): Promise<RememberedCredentials | null> {
  if (isCapacitorNative()) {
    return hydrateRememberedCredentialsFromNative(role);
  }
  return loadRememberedCredentialsSync(role);
}

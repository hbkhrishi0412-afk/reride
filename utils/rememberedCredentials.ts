/**
 * Persist login email + password when the user checks "Remember me".
 *
 * Web: localStorage (password is base64-obfuscated, not encrypted).
 * Capacitor: also mirrors to native secure/preferences storage so credentials
 * survive WebView localStorage clears on iOS/Android.
 */
import { isCapacitorNative } from './apiConfig';
import { nativeKvGet, nativeKvRemove, nativeKvSet } from './nativeKeyValueStorage';

const PWD_PREFIX = 'v1:';
const LAST_ROLE_KEY = 'reride_last_login_role';

export interface RememberedCredentials {
  email: string;
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

function encodePassword(password: string): string {
  try {
    return `${PWD_PREFIX}${btoa(encodeURIComponent(password))}`;
  } catch {
    return '';
  }
}

function decodePassword(encoded: string | null): string {
  if (!encoded || !encoded.startsWith(PWD_PREFIX)) return '';
  try {
    return decodeURIComponent(atob(encoded.slice(PWD_PREFIX.length)));
  } catch {
    return '';
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
  password: string,
  remember: boolean,
): void {
  const ek = rememberedEmailKey(role);
  const pk = rememberedPasswordKey(role);
  const ls = getLocal();
  if (!ls) return;
  if (remember && email.trim()) {
    ls.setItem(ek, email.trim());
    if (password) {
      ls.setItem(pk, encodePassword(password));
    } else {
      ls.removeItem(pk);
    }
    ls.setItem(LAST_ROLE_KEY, role);
  } else {
    ls.removeItem(ek);
    ls.removeItem(pk);
    const last = ls.getItem(LAST_ROLE_KEY);
    if (last === role) {
      ls.removeItem(LAST_ROLE_KEY);
    }
  }
}

/** Synchronous read from localStorage — used for first paint. */
export function loadRememberedCredentialsSync(role: string): RememberedCredentials | null {
  const ls = getLocal();
  if (!ls) return null;
  try {
    const email = ls.getItem(rememberedEmailKey(role));
    if (!email) return null;
    return {
      email,
      password: decodePassword(ls.getItem(rememberedPasswordKey(role))),
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

/** On Capacitor, hydrate from native KV when localStorage is empty or stale. */
export async function hydrateRememberedCredentialsFromNative(
  role: string,
): Promise<RememberedCredentials | null> {
  if (!isCapacitorNative()) {
    return loadRememberedCredentialsSync(role);
  }
  try {
    const [email, pwdEnc] = await Promise.all([
      nativeKvGet(nativeEmailKey(role)),
      nativeKvGet(nativePasswordKey(role)),
    ]);
    if (!email) return loadRememberedCredentialsSync(role);
    const password = decodePassword(pwdEnc);
    const ls = getLocal();
    if (ls) {
      ls.setItem(rememberedEmailKey(role), email);
      if (pwdEnc) {
        ls.setItem(rememberedPasswordKey(role), pwdEnc);
      } else {
        ls.removeItem(rememberedPasswordKey(role));
      }
      ls.setItem(LAST_ROLE_KEY, role);
    }
    return { email, password };
  } catch {
    return loadRememberedCredentialsSync(role);
  }
}

async function persistRememberedCredentialsNative(
  role: string,
  email: string,
  password: string,
  remember: boolean,
): Promise<void> {
  const nek = nativeEmailKey(role);
  const npk = nativePasswordKey(role);
  if (remember && email.trim()) {
    await nativeKvSet(nek, email.trim());
    if (password) {
      await nativeKvSet(npk, encodePassword(password));
    } else {
      await nativeKvRemove(npk);
    }
  } else {
    await nativeKvRemove(nek);
    await nativeKvRemove(npk);
  }
}

/** Save or clear remembered email + password for a role (localStorage only). */
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
      /* ignore — localStorage copy still available this session */
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

const ALPHANUM = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Cryptographically strong random string for client-side IDs (replaces Math.random for scanners).
 */
export function randomAlphanumeric(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHANUM[bytes[i]! % ALPHANUM.length];
  }
  return out;
}

/** Uniform-ish integer in [0, max) using crypto; `max` must be <= 2**32. */
export function randomIntBelow(max: number): number {
  if (max <= 0) return 0;
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0]! % max;
}

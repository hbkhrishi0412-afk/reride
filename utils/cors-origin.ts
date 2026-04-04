/**
 * Shared CORS origin parsing for API handlers (attach-api-cors, main.ts).
 * WebView / Capacitor sometimes send Origin casing or forms that must still match allowlists.
 */

/** Canonical `https://appassets.androidplatform.net` — Android WebViewAssetLoader. */
export const ANDROID_WEBVIEW_ASSET_ORIGIN = 'https://appassets.androidplatform.net';

export function normalizeRequestOrigin(raw: string | undefined): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    const defaultPort = (u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80');
    const port = !u.port || defaultPort ? '' : `:${u.port}`;
    return `${u.protocol}//${host}${port}`;
  } catch {
    return undefined;
  }
}

export function isAndroidWebViewAssetLoaderOrigin(origin: string | undefined): boolean {
  const n = normalizeRequestOrigin(origin);
  if (!n) return false;
  try {
    return new URL(n).hostname === 'appassets.androidplatform.net';
  } catch {
    return false;
  }
}

/**
 * Capacitor / embedded WebView shells that call the production API on www (not browser same-origin).
 */
export function isCapacitorShellOrigin(origin: string | undefined): boolean {
  const n = normalizeRequestOrigin(origin);
  if (!n) return false;
  try {
    const u = new URL(n);
    const h = u.hostname.toLowerCase();
    if (h === 'appassets.androidplatform.net') return true;
    if (h === 'localhost' || h === '127.0.0.1') return true;
  } catch {
    return false;
  }
  const raw = origin.trim();
  return raw.startsWith('capacitor://') || raw.startsWith('ionic://');
}

/**
 * Centralized API base URL configuration.
 *
 * In the browser (web deployment on Vercel), relative paths like `/api/...`
 * resolve correctly because the same origin serves both the SPA and serverless
 * API routes.
 *
 * In Capacitor (Android/iOS), the WebView serves files from
 * `https://localhost` (androidScheme: 'https') so relative `/api/` calls hit
 * the WebView's own origin and 404. We detect this and prepend the production
 * API origin so fetches go to the real server.
 */

/** Primary production API host (matches Vercel `PRIMARY_ORIGIN` / live site). */
const DEFAULT_PRODUCTION_ORIGIN = 'https://www.reride.co.in';

/**
 * Android emulator cannot reach the dev machine via localhost/127.0.0.1 — use 10.0.2.2.
 * Physical devices still need your LAN IP; this only rewrites when running on Android native.
 */
function rewriteLocalhostForAndroidEmulator(baseUrl: string): string {
  if (typeof window === 'undefined') return baseUrl;
  try {
    const cap = (window as any).Capacitor;
    if (cap?.getPlatform?.() !== 'android') return baseUrl;
    const u = new URL(baseUrl);
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') {
      u.hostname = '10.0.2.2';
      return u.toString().replace(/\/+$/, '');
    }
  } catch {
    return baseUrl;
  }
  return baseUrl;
}

/** Matches `dev-api-server.js` default unless overridden via `VITE_LOCAL_API_PORT`. */
function getLocalApiPort(): string {
  const p =
    typeof import.meta !== 'undefined'
      ? (import.meta as any).env?.VITE_LOCAL_API_PORT
      : undefined;
  const s = (p != null && String(p).trim() !== '' ? String(p) : '3001').replace(/^:/, '');
  return s;
}

function getLocalApiPortNumber(): number {
  const n = parseInt(getLocalApiPort(), 10);
  return Number.isFinite(n) ? n : 3001;
}

/**
 * Host:port for dev WebSocket / Socket.io when the API runs on your machine.
 * The Android emulator cannot reach the host via localhost; 10.0.2.2 is the standard alias.
 * Defaults to the same port as the local REST API (`VITE_LOCAL_API_PORT` or 3001).
 */
export function getDevSocketHost(port?: number): string {
  const resolved = port ?? getLocalApiPortNumber();
  if (typeof window === 'undefined') return `localhost:${resolved}`;
  try {
    const cap = (window as any).Capacitor;
    if (cap?.getPlatform?.() === 'android') {
      return `10.0.2.2:${resolved}`;
    }
  } catch {
    /* ignore */
  }
  return `localhost:${resolved}`;
}

function getProductionOrigin(): string {
  const fromEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as any).env?.VITE_PRODUCTION_ORIGIN ||
        (import.meta as any).env?.VITE_APP_URL
      : undefined;
  const origin = (fromEnv || DEFAULT_PRODUCTION_ORIGIN).toString();
  return origin.replace(/\/+$/, '');
}

/**
 * Base URL for the Node dev API on your PC when testing the Capacitor app.
 * Android emulator: `10.0.2.2` reaches the host; iOS Simulator: `localhost` works.
 */
export function getMobileLocalApiOrigin(): string {
  const port = getLocalApiPort();
  if (typeof window === 'undefined') {
    return `http://127.0.0.1:${port}`;
  }
  try {
    const cap = (window as any).Capacitor;
    if (cap?.getPlatform?.() === 'android') {
      return `http://10.0.2.2:${port}`;
    }
  } catch {
    /* ignore */
  }
  return `http://localhost:${port}`;
}

/**
 * Use PC-local API + `.env.development` Supabase when building with
 * `vite build --mode development` and `VITE_MOBILE_LOCAL_DEV=true`.
 * Production store builds use `vite build` (mode production) → live API + `.env.production` Supabase.
 */
function shouldUseBundledMobileLocalApi(): boolean {
  if (typeof import.meta === 'undefined') return false;
  const env = import.meta.env;
  return (
    env.VITE_MOBILE_LOCAL_DEV === 'true' &&
    env.MODE === 'development'
  );
}

// Cache only "true" results.
// In Android debug builds, `window.Capacitor` can be available slightly after our first JS tick.
// If we cache "false", the API fetch rewrite might never be applied.
let _isNativeWebViewCached: boolean | null = null;

export function isCapacitorNative(): boolean {
  if (_isNativeWebViewCached === true) return true;
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    const isCapacitorNativePlatform =
      (window as any).Capacitor?.isNativePlatform?.() === true;

    // Support custom Android WebView wrappers using WebViewAssetLoader host.
    const isAndroidAssetLoaderHost =
      window.location.hostname === 'appassets.androidplatform.net';

    // Capacitor bridge can appear after the first JS tick. Rely on the WebView
    // origin so /api/* is rewritten immediately (otherwise requests hit
    // https://localhost and 404 in production).
    const port = window.location.port || '';
    const devServerPorts = ['5173', '4173', '3000', '8080'];
    const host = window.location.hostname;
    const proto = window.location.protocol;
    const loopback = host === 'localhost' || host === '127.0.0.1';
    // Packaged app: https/http loopback without a Vite dev port (not :5173 etc.)
    const isPackagedWebViewShell =
      loopback &&
      (proto === 'https:' || proto === 'http:') &&
      !devServerPorts.includes(port);
    const isCapacitorLikeOrigin =
      host === 'appassets.androidplatform.net' ||
      host.includes('appassets.androidplatform.net') ||
      (host === 'localhost' && proto === 'capacitor:') ||
      (host === 'localhost' && proto === 'ionic:') ||
      (loopback && proto === 'capacitor:') ||
      (loopback && proto === 'ionic:') ||
      isPackagedWebViewShell;

    const result =
      isCapacitorNativePlatform ||
      isAndroidAssetLoaderHost ||
      isCapacitorLikeOrigin;
    if (result) _isNativeWebViewCached = true;
    return result;
  } catch {
  }
  return false;
}

/**
 * Returns the base URL to prepend to `/api/...` endpoints.
 *
 * - Web (dev):   '' (empty — relative `/api/` proxied by Vite)
 * - Web (prod):  '' (empty — same Vercel origin)
 * - Capacitor:   'https://reride.co.in' (override with `VITE_API_URL` / `VITE_PRODUCTION_ORIGIN`)
 *
 * Override via `VITE_API_URL` env var for custom deployments.
 */
export function getApiBaseUrl(): string {
  const envOverride =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_API_URL
      : undefined;
  if (envOverride) {
    return rewriteLocalhostForAndroidEmulator(envOverride.replace(/\/+$/, ''));
  }

  if (isCapacitorNative()) {
    if (shouldUseBundledMobileLocalApi()) {
      return rewriteLocalhostForAndroidEmulator(getMobileLocalApiOrigin());
    }
    return getProductionOrigin();
  }

  return '';
}

/**
 * Resolve a path like `/api/vehicles` to a full URL when running in Capacitor.
 * On the web, returns the path unchanged.
 */
export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  let base = getApiBaseUrl();
  // Defense-in-depth: if base is still empty, never leave `/api/*` relative — that hits
  // `https://localhost/api/*` in the WebView and fails (login sync, CSRF, etc.).
  if (!base && typeof window !== 'undefined' && path.startsWith('/api/')) {
    const port = window.location.port || '';
    const devServerPorts = ['5173', '4173', '3000', '8080'];
    const h = window.location.hostname;
    const proto = window.location.protocol;
    const loopback = h === 'localhost' || h === '127.0.0.1';
    const looksPackagedShell =
      h === 'appassets.androidplatform.net' ||
      h.includes('appassets.androidplatform.net') ||
      (loopback &&
        (proto === 'https:' || proto === 'http:') &&
        !devServerPorts.includes(port));
    if (looksPackagedShell) {
      base = shouldUseBundledMobileLocalApi()
        ? rewriteLocalhostForAndroidEmulator(getMobileLocalApiOrigin())
        : getProductionOrigin();
    }
  }
  if (!base) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Patch the global fetch so that any call to a relative `/api/...` path is
 * automatically rewritten to the production origin when running inside
 * Capacitor. This avoids having to touch every individual fetch call.
 *
 * Call this once at app startup (e.g. in index.tsx before React renders).
 */
let _fetchPatched = false;
export function patchFetchForCapacitor(retryCount: number = 40): void {
  if (_fetchPatched) return;
  if (typeof window === 'undefined') return;
  if (!isCapacitorNative()) {
    // Retry: rare WebViews where origin detection is delayed.
    if (retryCount > 0) {
      setTimeout(() => patchFetchForCapacitor(retryCount - 1), 150);
    }
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = resolveApiUrl(input);
    } else if (input instanceof Request && input.url.startsWith('/api/')) {
      input = new Request(resolveApiUrl(input.url), input);
    }
    return originalFetch(input, init);
  } as typeof window.fetch;

  _fetchPatched = true;
}

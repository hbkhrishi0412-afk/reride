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

/** Same-project Vercel host (see `security-config` CORS list). Used as last-resort API origin on mobile WebView. */
const VERCEL_APP_FALLBACK_ORIGIN = 'https://reride-app.vercel.app';

/**
 * `https://reride.co.in` redirects to www; CORS preflight (OPTIONS) cannot follow redirects.
 * Normalize apex → `www` for any env override or absolute URL so Android WebView / Capacitor
 * never calls the apex host for `/api/*`.
 */
export function normalizeRerideApiHostToWww(urlOrOrigin: string): string {
  const raw = urlOrOrigin.trim();
  // Rewrite apex in any absolute URL string (covers build-time env typos and bypasses URL edge cases).
  const apexStripped = raw.replace(
    /(https?:\/\/)reride\.co\.in(?=[:/?#]|$)/gi,
    '$1www.reride.co.in'
  );
  try {
    const u = new URL(
      apexStripped.includes('://') ? apexStripped : `https://${apexStripped}`
    );
    if (u.hostname !== 'reride.co.in') {
      return apexStripped.replace(/\/+$/, '');
    }
    u.hostname = 'www.reride.co.in';
    if (u.pathname === '/' && !u.search && !u.hash) {
      return `${u.protocol}//${u.host}`;
    }
    return u.toString();
  } catch {
    return apexStripped.replace(/\/+$/, '');
  }
}

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
  return normalizeRerideApiHostToWww(origin.replace(/\/+$/, ''));
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
      window.location.hostname.toLowerCase() === 'appassets.androidplatform.net' ||
      window.location.hostname.toLowerCase().includes('appassets.androidplatform.net');

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
 * Optional alternate origin for `DataService` network retries when the primary
 * `www.reride.co.in` request fails with `TypeError: Failed to fetch` (DNS, TLS, or transient CDN issues).
 *
 * - Set `VITE_API_FALLBACK_URL` for a custom mirror.
 * - Otherwise, on Capacitor / Android WebViewAssetLoader only, defaults to the Vercel deployment
 *   if the app is still configured to use the canonical production API base (no `VITE_API_URL` override).
 */
export function getAlternateApiOriginForFallback(): string | null {
  const explicit =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_API_FALLBACK_URL &&
    String(import.meta.env.VITE_API_FALLBACK_URL).trim() !== ''
      ? normalizeRerideApiHostToWww(
          String(import.meta.env.VITE_API_FALLBACK_URL).trim().replace(/\/+$/, ''),
        )
      : null;
  if (explicit) return explicit;

  if (typeof window === 'undefined') return null;

  const hl = window.location.hostname.toLowerCase();
  const mobileShell =
    isCapacitorNative() ||
    hl === 'appassets.androidplatform.net' ||
    hl.includes('appassets.androidplatform.net');
  if (!mobileShell) return null;

  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_API_URL &&
    String(import.meta.env.VITE_API_URL).trim() !== ''
  ) {
    return null;
  }

  const base = getApiBaseUrl();
  const canonicalProd = normalizeRerideApiHostToWww(DEFAULT_PRODUCTION_ORIGIN);
  if (!base || normalizeRerideApiHostToWww(base) !== canonicalProd) {
    return null;
  }

  const vercel = normalizeRerideApiHostToWww(VERCEL_APP_FALLBACK_ORIGIN);
  return vercel === canonicalProd ? null : vercel;
}

/**
 * Returns the base URL to prepend to `/api/...` endpoints.
 *
 * - Web (dev):   '' (empty — relative `/api/` proxied by Vite)
 * - Web (prod):  '' (empty — same Vercel origin), except on apex `reride.co.in` where we use
 *                `getProductionOrigin()` so `/api/*` is not requested on apex (307 → www breaks
 *                credentialed fetch + CSRF for many browsers).
 * - Capacitor:   `getProductionOrigin()` (default `https://www.reride.co.in`; override via env)
 *
 * Override via `VITE_API_URL` env var for custom deployments.
 */
export function getApiBaseUrl(): string {
  const envOverride =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_API_URL
      : undefined;
  if (envOverride) {
    return normalizeRerideApiHostToWww(
      rewriteLocalhostForAndroidEmulator(envOverride.replace(/\/+$/, ''))
    );
  }

  // Android WebViewAssetLoader (Chrome Custom Tab / packaged host): never rely solely on
  // Capacitor detection — empty base makes `/api/*` relative to this origin and breaks login + data.
  if (typeof window !== 'undefined') {
    const hl = window.location.hostname.toLowerCase();
    if (
      hl === 'appassets.androidplatform.net' ||
      hl.includes('appassets.androidplatform.net')
    ) {
      if (shouldUseBundledMobileLocalApi()) {
        return rewriteLocalhostForAndroidEmulator(getMobileLocalApiOrigin());
      }
      return getProductionOrigin();
    }
  }

  if (isCapacitorNative()) {
    if (shouldUseBundledMobileLocalApi()) {
      return rewriteLocalhostForAndroidEmulator(getMobileLocalApiOrigin());
    }
    return getProductionOrigin();
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'reride.co.in') {
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
    return normalizeRerideApiHostToWww(path);
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
    const hl = h.toLowerCase();
    const looksPackagedShell =
      hl === 'appassets.androidplatform.net' ||
      hl.includes('appassets.androidplatform.net') ||
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
  return normalizeRerideApiHostToWww(`${base}${normalizedPath}`);
}

/**
 * True when a resolved API URL targets a different origin than the current page (e.g. Android
 * WebView at `appassets.androidplatform.net` calling `https://www.reride.co.in/api/...`).
 * Credentialed cross-origin fetches often fail CORS/preflight in WebView; use `credentials: 'omit'`
 * plus `X-App-Client` / CSRF header instead (see `authenticatedFetch`).
 */
export function isApiRequestCrossOrigin(resolvedPathOrUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const abs =
      resolvedPathOrUrl.startsWith('http://') || resolvedPathOrUrl.startsWith('https://')
        ? resolvedPathOrUrl
        : new URL(resolvedPathOrUrl, window.location.origin).href;
    return new URL(abs).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Patch global `fetch` so API calls always behave correctly:
 * - Relative `/api/...` → resolved via `resolveApiUrl` (WebView / Capacitor → `www`, Vite dev unchanged).
 * - Absolute `https://reride.co.in/...` (apex) → `https://www.reride.co.in/...` (avoids 307 + broken CORS preflight).
 *
 * Installed for **all** browser sessions (not only when `isCapacitorNative()` is true) so a delayed or
 * missed native detection cannot leave requests pointing at the apex host.
 *
 * Call once at startup (e.g. `utils/capacitorInit.ts` imported before `App`).
 */
let _fetchPatched = false;
export function patchFetchForCapacitor(_retryCount: number = 40): void {
  if (_fetchPatched) return;
  if (typeof window === 'undefined') return;

  // Always chain on top of `public/reride-api-fetch-boot.js` (or native fetch) so apex → www
  // and `/api/*` resolution stay correct even if an older boot script shipped in the APK.
  const originalFetch = window.fetch.bind(window);

  const rewriteFetchInput = (input: RequestInfo | URL): RequestInfo | URL => {
    if (typeof input === 'string') {
      if (input.startsWith('/api/')) return resolveApiUrl(input);
      // Any absolute URL to apex (http/https) — avoid 307 on OPTIONS preflight.
      if (/(https?:\/\/)reride\.co\.in(?=[:/?#]|$)/i.test(input)) {
        return normalizeRerideApiHostToWww(input);
      }
      return input;
    }
    if (input instanceof URL) {
      if (input.hostname === 'reride.co.in') {
        return new URL(normalizeRerideApiHostToWww(input.href));
      }
      return input;
    }
    if (input instanceof Request) {
      const u = input.url;
      try {
        const parsed = new URL(u);
        if (parsed.pathname.startsWith('/api/')) {
          return new Request(
            resolveApiUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`),
            input
          );
        }
        if (parsed.hostname === 'reride.co.in') {
          return new Request(normalizeRerideApiHostToWww(u), input);
        }
      } catch {
        if (u.startsWith('/api/')) {
          return new Request(resolveApiUrl(u), input);
        }
      }
      return input;
    }
    return input;
  };

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    return originalFetch(rewriteFetchInput(input), init);
  } as typeof window.fetch;

  _fetchPatched = true;
}

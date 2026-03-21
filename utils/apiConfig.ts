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

const DEFAULT_PRODUCTION_ORIGIN = 'https://www.reride.co.in';

function getProductionOrigin(): string {
  const fromEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as any).env?.VITE_PRODUCTION_ORIGIN ||
        (import.meta as any).env?.VITE_APP_URL
      : undefined;
  const origin = (fromEnv || DEFAULT_PRODUCTION_ORIGIN).toString();
  return origin.replace(/\/+$/, '');
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
    const isCapacitorLikeOrigin =
      host === 'appassets.androidplatform.net' ||
      host.includes('appassets.androidplatform.net') ||
      (host === 'localhost' && proto === 'capacitor:') ||
      (host === 'localhost' && proto === 'ionic:') ||
      (host === 'localhost' &&
        proto === 'https:' &&
        !devServerPorts.includes(port));

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
 * - Capacitor:   'https://www.reride.co.in'
 *
 * Override via `VITE_API_URL` env var for custom deployments.
 */
export function getApiBaseUrl(): string {
  const envOverride =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_API_URL
      : undefined;
  if (envOverride) return envOverride.replace(/\/+$/, '');

  if (isCapacitorNative()) return getProductionOrigin();

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
  const base = getApiBaseUrl();
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
  const base = getApiBaseUrl();

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = `${base}${input}`;
    } else if (input instanceof Request && input.url.startsWith('/api/')) {
      input = new Request(`${base}${input.url}`, input);
    }
    return originalFetch(input, init);
  } as typeof window.fetch;

  _fetchPatched = true;
}

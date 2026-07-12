/**
 * Mobile-friendly fetch: AbortController timeout (reliable in Android WebView) plus optional
 * alternate API origin retry when the primary host is unreachable (same strategy as DataService).
 */

import {
  getAlternateApiOriginForFallback,
  isCapacitorNative,
  normalizeRerideApiHostToWww,
} from './apiConfig.js';

export function resolveFallbackApiUrl(primaryUrl: string): string | null {
  try {
    const altOrigin = getAlternateApiOriginForFallback();
    if (!altOrigin) return null;
    const parsed = new URL(primaryUrl);
    const candidate = `${altOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    const normalized = normalizeRerideApiHostToWww(candidate);
    return normalized !== primaryUrl ? normalized : null;
  } catch {
    return null;
  }
}

/** Shorter on Capacitor so login/data calls fail fast instead of hanging on bad DNS/TLS. */
export function getCapacitorAuthFetchTimeoutMs(): number {
  return isCapacitorNative() ? 20_000 : 60_000;
}

/**
 * Fetch with a hard timeout and one retry against the configured fallback API origin.
 */
export async function fetchWithTimeoutAndFallback(
  url: string,
  init: RequestInit,
  timeoutMs?: number,
): Promise<Response> {
  const resolvedTimeout = timeoutMs ?? getCapacitorAuthFetchTimeoutMs();
  const fallbackUrl = resolveFallbackApiUrl(url);

  const doFetch = async (targetUrl: string): Promise<Response> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onExternalAbort = () => controller.abort();
    const externalSignal = init.signal;
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error('Request timed out'), { name: 'TimeoutError' }));
        }, resolvedTimeout);
      });

      return await Promise.race([
        fetch(targetUrl, { ...init, signal: controller.signal }),
        timeoutPromise,
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  };

  try {
    return await doFetch(url);
  } catch (primaryErr) {
    if (!fallbackUrl) throw primaryErr;
    try {
      return await doFetch(fallbackUrl);
    } catch {
      throw primaryErr;
    }
  }
}

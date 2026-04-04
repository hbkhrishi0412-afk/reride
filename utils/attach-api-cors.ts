import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isAndroidWebViewAssetLoaderOrigin,
  isCapacitorShellOrigin,
  normalizeRequestOrigin,
} from './cors-origin.js';
import { getSecurityConfig } from './security-config.js';
import { getSecurityHeaders } from './security.js';

/**
 * Compare two origin strings with URL parsing (avoids substring bypasses like
 * https://www.reride.co.in.evil.com matching "www.reride.co.in").
 */
function originsMatchForCors(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.protocol === ub.protocol &&
      ua.hostname.toLowerCase() === ub.hostname.toLowerCase() &&
      ua.port === ub.port
    );
  } catch {
    return false;
  }
}

function isOriginInAllowlist(
  origin: string | undefined,
  allowedList: readonly string[],
): boolean {
  if (!origin) return false;
  const normalized = normalizeRequestOrigin(origin) || origin;
  if (allowedList.includes(origin) || allowedList.includes(normalized)) return true;
  return allowedList.some(
    (entry) => originsMatchForCors(origin, entry) || originsMatchForCors(normalized, entry),
  );
}

/** tchar per RFC 9110 — reject CRLF / delimiter injection in reflected header names */
const HEADER_NAME_TOKEN = /^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/;
const MAX_HEADER_NAME_LEN = 64;

function sanitizeAdditionalHeaderName(name: string): string | null {
  const t = name.trim();
  if (t.length === 0 || t.length > MAX_HEADER_NAME_LEN) return null;
  if (!HEADER_NAME_TOKEN.test(t)) return null;
  return t;
}

/** Minimal CORS if the full path throws (must never leave preflight without ACAO for trusted shells). */
function applyMinimalCorsForTrustedShells(req: VercelRequest, res: VercelResponse): void {
  const rawOrigin = req.headers.origin;
  const origin =
    typeof rawOrigin === 'string'
      ? rawOrigin
      : Array.isArray(rawOrigin)
        ? rawOrigin[0]
        : undefined;
  const normalized = normalizeRequestOrigin(origin);
  if (!normalized) return;
  if (!isAndroidWebViewAssetLoaderOrigin(origin) && !isCapacitorShellOrigin(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', normalized);
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-App-Client',
      'Accept',
      'Accept-Language',
      'If-None-Match',
    ].join(', '),
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

/**
 * Apply security + CORS headers for the unified Vercel API (`api/main.ts`).
 * Merges safe `Access-Control-Request-Headers` tokens so preflight succeeds for
 * Sentry/tracing without echoing arbitrary strings.
 */
export function attachApiCors(req: VercelRequest, res: VercelResponse): void {
  try {
    attachApiCorsInner(req, res);
  } catch {
    applyMinimalCorsForTrustedShells(req, res);
  }
}

function attachApiCorsInner(req: VercelRequest, res: VercelResponse): void {
  const config = getSecurityConfig();
  const primaryOrigin =
    process.env.PRIMARY_ORIGIN ||
    process.env.ALLOWED_ORIGIN ||
    'https://www.reride.co.in';

  const securityHeaders = getSecurityHeaders();
  for (const [key, value] of Object.entries(securityHeaders)) {
    res.setHeader(key, value);
  }

  const rawOrigin = req.headers.origin;
  const origin =
    typeof rawOrigin === 'string'
      ? rawOrigin
      : Array.isArray(rawOrigin)
        ? rawOrigin[0]
        : undefined;
  const normalizedOrigin = normalizeRequestOrigin(origin);

  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalhost =
    !!origin &&
    (origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('::1'));

  const isPackagedAndroidWebView = isAndroidWebViewAssetLoaderOrigin(origin);
  const isCapacitorApp =
    origin === 'https://localhost' ||
    origin === 'https://127.0.0.1' ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost' ||
    origin === 'http://localhost' ||
    origin === 'http://127.0.0.1' ||
    isPackagedAndroidWebView;

  const allowlisted =
    isOriginInAllowlist(origin, config.CORS.ALLOWED_ORIGINS) ||
    (!isProduction && isLocalhost) ||
    isCapacitorApp ||
    isCapacitorShellOrigin(origin);

  /**
   * Browsers require Access-Control-Allow-Origin to **match** the request Origin exactly
   * (when credentials are used). Never send PRIMARY_ORIGIN (www) for unrelated cross-origin
   * clients (e.g. appassets) — that fails CORS and looks like a missing/wrong header.
   */
  const echoOrigin = normalizedOrigin || origin;
  if (allowlisted && echoOrigin) {
    res.setHeader('Access-Control-Allow-Origin', echoOrigin);
  } else if (!isProduction) {
    res.setHeader('Access-Control-Allow-Origin', echoOrigin || '*');
  } else if (origin && originsMatchForCors(origin, primaryOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', primaryOrigin);
  }
  // Untrusted cross-origin in production: omit Access-Control-Allow-Origin (do not spoof www).

  res.setHeader('Access-Control-Allow-Methods', config.CORS.ALLOWED_METHODS.join(', '));

  const allowHeadersList = [...config.CORS.ALLOWED_HEADERS];
  const seenLower = new Set(allowHeadersList.map((h) => h.toLowerCase()));
  const acrhRaw =
    (req.headers['access-control-request-headers'] ||
      req.headers['Access-Control-Request-Headers']) as string | undefined;
  if (typeof acrhRaw === 'string' && acrhRaw.trim()) {
    for (const part of acrhRaw.split(',')) {
      const safe = sanitizeAdditionalHeaderName(part);
      if (!safe) continue;
      const low = safe.toLowerCase();
      if (!seenLower.has(low)) {
        seenLower.add(low);
        allowHeadersList.push(safe);
      }
    }
  }
  res.setHeader('Access-Control-Allow-Headers', allowHeadersList.join(', '));

  res.setHeader('Access-Control-Allow-Credentials', config.CORS.CREDENTIALS.toString());
  res.setHeader('Access-Control-Max-Age', config.CORS.MAX_AGE.toString());

  const prevVary = res.getHeader('Vary');
  const varyParts: string[] =
    typeof prevVary === 'string'
      ? prevVary.split(',').map((s) => s.trim()).filter(Boolean)
      : Array.isArray(prevVary)
        ? prevVary
            .flatMap((v) => String(v).split(','))
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
  if (!varyParts.some((p) => p.toLowerCase() === 'origin')) {
    varyParts.push('Origin');
  }
  res.setHeader('Vary', varyParts.join(', '));

  if (req.method !== 'OPTIONS' && req.method !== 'HEAD') {
    res.setHeader('Content-Type', 'application/json');
  }
}

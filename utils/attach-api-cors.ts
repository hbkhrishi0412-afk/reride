import type { VercelRequest, VercelResponse } from '@vercel/node';
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
  if (allowedList.includes(origin)) return true;
  return allowedList.some((entry) => originsMatchForCors(origin, entry));
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

/**
 * Apply security + CORS headers for the unified Vercel API (`api/main.ts`).
 * Merges safe `Access-Control-Request-Headers` tokens so preflight succeeds for
 * Sentry/tracing without echoing arbitrary strings.
 */
export function attachApiCors(req: VercelRequest, res: VercelResponse): void {
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
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalhost =
    !!origin &&
    (origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('::1'));

  let isPackagedAndroidWebView = false;
  if (origin) {
    try {
      isPackagedAndroidWebView =
        new URL(origin).hostname.toLowerCase() === 'appassets.androidplatform.net';
    } catch {
      /* ignore */
    }
  }

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
    isCapacitorApp;

  if (allowlisted && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (isProduction && origin) {
    // Unknown origin: do not echo attacker Origin; browser will block credentialed cross-origin reads.
    res.setHeader('Access-Control-Allow-Origin', primaryOrigin);
  } else if (!isProduction) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', primaryOrigin);
  }

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

  res.setHeader('Content-Type', 'application/json');
}

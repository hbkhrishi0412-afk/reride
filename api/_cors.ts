import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSecurityConfig } from '../utils/security-config.js';
import { getSecurityHeaders } from '../utils/security.js';

/**
 * Apply CORS + security headers for Vercel serverless handlers.
 *
 * Returns true when the request is fully handled (OPTIONS/HEAD).
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const config = getSecurityConfig();
  const primaryOrigin =
    process.env.PRIMARY_ORIGIN ||
    process.env.ALLOWED_ORIGIN ||
    'https://www.reride.co.in';

  // Security headers (safe to set repeatedly)
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
  const originLc = origin?.toLowerCase() ?? '';
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalhost =
    !!origin &&
    (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('::1'));

  // Capacitor Android/iOS WebView origins (androidScheme can be 'https' or 'capacitor')
  const isCapacitorApp =
    origin === 'https://localhost' ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost' ||
    origin === 'http://localhost' ||
    originLc === 'https://appassets.androidplatform.net' ||
    originLc.includes('appassets.androidplatform.net');

  if (config.CORS.ALLOWED_ORIGINS.includes(origin as string) || (!isProduction && isLocalhost) || isCapacitorApp) {
    res.setHeader('Access-Control-Allow-Origin', origin as string);
  } else if (isProduction && origin) {
    const isAllowedProductionOrigin = config.CORS.ALLOWED_ORIGINS.some((allowedOrigin) => {
      return origin === allowedOrigin || origin.includes(allowedOrigin.replace('https://', ''));
    });
    res.setHeader('Access-Control-Allow-Origin', isAllowedProductionOrigin ? (origin as string) : primaryOrigin);
  } else if (!isProduction) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', primaryOrigin);
  }

  res.setHeader('Access-Control-Allow-Methods', config.CORS.ALLOWED_METHODS.join(', '));
  res.setHeader('Access-Control-Allow-Headers', config.CORS.ALLOWED_HEADERS.join(', '));
  res.setHeader('Access-Control-Allow-Credentials', config.CORS.CREDENTIALS.toString());
  res.setHeader('Access-Control-Max-Age', config.CORS.MAX_AGE.toString());

  const prevVary = res.getHeader('Vary');
  const varyParts: string[] =
    typeof prevVary === 'string'
      ? prevVary.split(',').map((s) => s.trim()).filter(Boolean)
      : Array.isArray(prevVary)
        ? prevVary.flatMap((v) => String(v).split(',')).map((s) => s.trim()).filter(Boolean)
        : [];
  if (!varyParts.some((p) => p.toLowerCase() === 'origin')) {
    varyParts.push('Origin');
  }
  res.setHeader('Vary', varyParts.join(', '));

  // Ensure we don't accidentally return HTML from a serverless runtime error page
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', '0');
    }
    res.status(200).end();
    return true;
  }

  return false;
}


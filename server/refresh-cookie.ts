/**
 * HttpOnly refresh-token cookie helpers (Vercel / Node API only — do not import from the SPA bundle).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSecurityConfig } from '../utils/security-config.js';

const REFRESH_COOKIE_DEV = 'reride_rt';
const REFRESH_COOKIE_PROD = '__Host-reride_rt';

export function refreshCookieName(): string {
  const prod =
    process.env.NODE_ENV === 'production' || String(process.env.VERCEL_ENV || '') === 'production';
  return prod ? REFRESH_COOKIE_PROD : REFRESH_COOKIE_DEV;
}

export function isCapacitorAppClient(req: VercelRequest): boolean {
  const v = req.headers['x-app-client'];
  return typeof v === 'string' && v.toLowerCase() === 'capacitor';
}

export function refreshCookieMaxAgeSeconds(): number {
  try {
    const exp = getSecurityConfig().JWT.REFRESH_TOKEN_EXPIRES_IN;
    if (typeof exp !== 'string') return 1209600;
    const t = exp.trim();
    const d = /^(\d+)d$/i.exec(t);
    if (d) return parseInt(d[1]!, 10) * 86400;
    const h = /^(\d+)h$/i.exec(t);
    if (h) return parseInt(h[1]!, 10) * 3600;
    const m = /^(\d+)m$/i.exec(t);
    if (m) return parseInt(m[1]!, 10) * 60;
  } catch {
    /* ignore */
  }
  return 14 * 86400;
}

function getCookie(req: VercelRequest, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw || typeof raw !== 'string') return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    const val = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  }
  return null;
}

/**
 * Refresh token from JSON body (Capacitor / cross-origin) or HttpOnly cookie (first-party web).
 */
export function getRefreshTokenFromRequest(req: VercelRequest): string | null {
  const body = (req.body || {}) as Record<string, unknown>;
  const fromBody = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';
  if (fromBody) return fromBody;
  const primary = getCookie(req, refreshCookieName());
  if (primary) return primary;
  return getCookie(req, REFRESH_COOKIE_DEV);
}

function appendSetCookie(res: VercelResponse, cookie: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookie]);
  }
}

export function appendRefreshTokenCookie(res: VercelResponse, token: string, maxAgeSec: number): void {
  const name = refreshCookieName();
  const secure =
    process.env.NODE_ENV === 'production' || String(process.env.VERCEL_ENV || '') === 'production';
  const securePart = secure ? 'Secure; ' : '';
  const c = `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${securePart}SameSite=Lax; Max-Age=${maxAgeSec}`;
  appendSetCookie(res, c);
}

export function clearRefreshTokenCookie(res: VercelResponse): void {
  const name = refreshCookieName();
  const secure =
    process.env.NODE_ENV === 'production' || String(process.env.VERCEL_ENV || '') === 'production';
  const securePart = secure ? 'Secure; ' : '';
  appendSetCookie(res, `${name}=; Path=/; HttpOnly; ${securePart}SameSite=Lax; Max-Age=0`);
}

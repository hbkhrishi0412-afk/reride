import type { VercelRequest } from '@vercel/node';
import { getSecurityConfig } from './security-config.js';
import { shouldSkipCsrfForCapacitorNative } from './csrfCapacitorExempt.js';

function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function originAllowed(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const allowed = getSecurityConfig().CORS.ALLOWED_ORIGINS;
  return allowed.some((entry) => {
    try {
      return new URL(entry).origin === normalized;
    } catch {
      return entry === origin || entry === normalized;
    }
  });
}

/**
 * Require a trusted same-site Origin (or Referer) for state-changing AI routes.
 * Capacitor native clients are exempt when X-App-Client + trusted origin match.
 */
export function requireSameSiteOrigin(req: VercelRequest): { ok: true } | { ok: false; reason: string } {
  const appClient = String(req.headers['x-app-client'] || req.headers['X-App-Client'] || '').toLowerCase();
  const rawOrigin = req.headers.origin;
  const origin =
    typeof rawOrigin === 'string' ? rawOrigin : Array.isArray(rawOrigin) ? rawOrigin[0] : undefined;

  if (shouldSkipCsrfForCapacitorNative(appClient, origin)) {
    return { ok: true };
  }

  if (origin && originAllowed(origin)) {
    return { ok: true };
  }

  const referer = req.headers.referer || req.headers.referrer;
  const refererStr = typeof referer === 'string' ? referer : Array.isArray(referer) ? referer[0] : undefined;
  if (refererStr) {
    try {
      const refererOrigin = new URL(refererStr).origin;
      if (originAllowed(refererOrigin)) {
        return { ok: true };
      }
    } catch {
      /* ignore */
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return { ok: true };
  }

  return { ok: false, reason: 'Cross-site requests to this endpoint are not allowed.' };
}

/**
 * server/handlers/shared.ts — Shared utilities for all API handlers
 *
 * Contains authentication, rate limiting, normalization helpers,
 * and common types used by every handler module.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { User as UserType, Vehicle as VehicleType } from '../../types.js';
import { getSecurityConfig } from '../../utils/security-config.js';
import { verifyToken } from '../../utils/security.js';
import { logWarn } from '../../utils/logger.js';
import { supabaseUserService } from '../../services/supabase-user-service.js';
import { supabaseVehicleService } from '../../services/supabase-vehicle-service.js';
import { supabaseConversationService } from '../../services/supabase-conversation-service.js';
import { getSupabaseAdminClient } from '../../lib/supabase.js';
import {
  adminRead,
  adminReadAll,
  adminCreate,
  adminUpdate,
  adminDelete,
  DB_PATHS,
} from '../../server/supabase-admin-db.js';
import {
  hashPassword,
  validatePassword,
  generateAccessToken,
  generateRefreshToken,
  validateUserInput,
  getSecurityHeaders,
  sanitizeObject,
  sanitizeString,
  validateEmail,
  refreshAccessToken,
} from '../../utils/security.js';

// ── Re-exports for handler convenience ──────────────────────────────────────

export {
  adminRead,
  adminReadAll,
  adminCreate,
  adminUpdate,
  adminDelete,
  DB_PATHS,
  hashPassword,
  validatePassword,
  generateAccessToken,
  generateRefreshToken,
  validateUserInput,
  getSecurityHeaders,
  sanitizeObject,
  sanitizeString,
  validateEmail,
  refreshAccessToken,
  supabaseUserService,
  supabaseVehicleService,
  supabaseConversationService,
  getSupabaseAdminClient,
  logWarn,
};

export type { VercelRequest, VercelResponse, UserType, VehicleType };

// ── Supabase availability flag ──────────────────────────────────────────────

let _useSupabase = false;
try {
  getSupabaseAdminClient();
  _useSupabase = true;
} catch {
  _useSupabase = false;
}

export const USE_SUPABASE = _useSupabase;

export function getSupabaseErrorMessage(): string {
  try {
    getSupabaseAdminClient();
    return '';
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return `Supabase database is not available: ${msg}. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`;
  }
}

// ── Handler options ─────────────────────────────────────────────────────────

export type HandlerOptions = Record<string, never>;

// ── Normalized user type ────────────────────────────────────────────────────

export interface NormalizedUser extends Omit<UserType, 'password'> {
  id: string;
}

// ── User normalizer ─────────────────────────────────────────────────────────

export function normalizeUser(user: UserType | null | undefined): NormalizedUser | null {
  if (!user) return null;

  let id = user.id;
  if (!id && user.email) {
    const emailKey = user.email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
    id = emailKey;
  }
  if (!id) return null;

  let role: 'customer' | 'seller' | 'admin' = user.role;
  if (!role || !['customer', 'seller', 'admin'].includes(role)) {
    role = 'customer';
  }

  const email = user.email?.toLowerCase().trim() ?? '';
  if (!email) return null;

  const { password: _pw, ...userWithoutPassword } = user;
  return { id, ...userWithoutPassword, email, role };
}

// ── Authentication helpers ──────────────────────────────────────────────────

export interface AuthResult {
  isValid: boolean;
  user?: { userId: string; email: string; role: string; type?: string };
  error?: string;
}

export const authenticateRequest = (req: VercelRequest): AuthResult => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'No valid authorization header' };
  }

  try {
    const token = authHeader.substring(7);
    const securityConfig = getSecurityConfig();
    if (!securityConfig.JWT.SECRET) {
      return { isValid: false, error: 'JWT_SECRET is not configured.' };
    }

    const decoded = verifyToken(token);
    return {
      isValid: true,
      user: { ...decoded, role: decoded.role || 'customer' },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { isValid: false, error: msg };
  }
};

export const requireAuth = (
  req: VercelRequest,
  res: VercelResponse,
  context: string,
): AuthResult | null => {
  const auth = authenticateRequest(req);
  if (!auth.isValid) {
    res.status(401).json({
      success: false,
      reason: auth.error || 'Authentication required.',
    });
    return null;
  }
  return auth;
};

export const requireAdmin = (
  req: VercelRequest,
  res: VercelResponse,
  context: string,
): AuthResult | null => {
  const auth = requireAuth(req, res, context);
  if (!auth) return null;
  if (auth.user?.role !== 'admin') {
    res.status(403).json({ success: false, reason: 'Admin access required.' });
    return null;
  }
  return auth;
};

// ── Rate limiting ───────────────────────────────────────────────────────────

const config = getSecurityConfig();

interface RateLimitCacheEntry {
  count: number;
  resetTime: number;
}

const rateLimitCache = new Map<string, RateLimitCacheEntry>();

function cleanupRateLimitCache() {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache.entries()) {
    if (entry.resetTime < now) rateLimitCache.delete(key);
  }
}

export async function checkRateLimit(
  identifier: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  cleanupRateLimitCache();

  const cached = rateLimitCache.get(identifier);
  if (cached && cached.resetTime >= now) {
    cached.count += 1;
    if (cached.count > config.RATE_LIMIT.MAX_REQUESTS) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: Math.max(0, config.RATE_LIMIT.MAX_REQUESTS - cached.count) };
  }

  rateLimitCache.set(identifier, { count: 1, resetTime: now + config.RATE_LIMIT.WINDOW_MS });
  return { allowed: true, remaining: config.RATE_LIMIT.MAX_REQUESTS - 1 };
}

// ── Client IP extraction ────────────────────────────────────────────────────

export function getClientIP(req: VercelRequest): string {
  const tryHeader = (name: string): string | undefined => {
    const val = req.headers[name];
    const str = Array.isArray(val) ? val[0] : val;
    const ip = str?.split(',')[0]?.trim();
    return ip && ip !== '::1' && ip !== '127.0.0.1' ? ip : undefined;
  };

  return (
    tryHeader('x-vercel-forwarded-for') ??
    tryHeader('cf-connecting-ip') ??
    tryHeader('x-forwarded-for') ??
    tryHeader('x-real-ip') ??
    req.socket?.remoteAddress ??
    'unknown'
  );
}

// ── Vehicle cache ───────────────────────────────────────────────────────────

interface VehicleCacheEntry {
  vehicles: VehicleType[];
  timestamp: number;
  totalCount?: number;
}

export const vehicleCache = new Map<string, VehicleCacheEntry>();
export const VEHICLE_CACHE_TTL = 30_000; // 30 seconds

export function cleanupVehicleCache() {
  const now = Date.now();
  for (const [key, entry] of vehicleCache.entries()) {
    if (now - entry.timestamp > VEHICLE_CACHE_TTL) vehicleCache.delete(key);
  }
}

// ── Distance calculation ────────────────────────────────────────────────────

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Security config re-export ───────────────────────────────────────────────

export { config as securityConfig };

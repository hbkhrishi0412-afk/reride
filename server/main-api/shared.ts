import type { VercelRequest, VercelResponse } from '@vercel/node';
/**
 * PROJECT RULE: api/ may have at most 12 top-level route modules (see .cursor/rules/api-routes-limit.mdc).
 * Handler logic belongs in server/handlers/ — do NOT add new files under api/.
 * This file is the Vercel catch-all router; keep extracting handlers out of here.
 */
import { randomBytes, createHmac, randomInt } from 'crypto';
import { PLAN_DETAILS } from '../../constants/plans.js';
import {
  buildListingRenewalUpdates,
  computeListingExpiresAtForSeller,
  isSellerPlanExpired,
  validateListingRenewal,
} from '../../utils/listingPlanRules.js';
import {
  listingLimitGuardResponse,
  invalidateSellerPlanCache,
  resolveSellerPlanDetails,
  validateSellerCanCreateListing,
  validateSellerCanPublishListing,
} from '../sellerPlanLimits.js';
import type { User as UserType, Vehicle as VehicleType, VerificationStatus } from '../../types.js';
import { VehicleCategory } from '../../vehicle-category.js';
// Supabase services
import { supabaseUserService } from '../../services/supabase-user-service.js';
import { supabaseVehicleService } from '../../services/supabase-vehicle-service.js';
import { supabaseConversationService } from '../../services/supabase-conversation-service.js';
import { supabaseServiceProviderService } from '../../services/supabase-service-provider-service.js';
import { getSupabaseAdminClient } from '../../lib/supabase-admin.js';
import { isRerideStaffPick } from '../../utils/staffPick.js';
import { userRolesEqual, normalizeUserRoleString } from '../../utils/user-role.js';
import { verifySupabaseToken } from '../supabase-auth.js';
import { readVehicleCatalogFromSupabase, writeVehicleCatalogToSupabase } from '../../lib/vehicleCatalogSupabase.js';
import { sendInquiryNotificationToSeller } from '../../lib/email.js';
import { notifySellerInquiryChannels } from '../../lib/sellerInquiryAlerts.js';
import {
  parseVehicleIdentityFromBody,
  hasResolvableVehicleIdentity,
  normalizeVehiclesList,
  MUTATION_IDENTITY_REFRESH_MESSAGE,
  sanitizeVehicleMediaUrls,
} from '../../utils/vehicleIdentity.js';
import { isPublicBuyListing } from '../../services/listingLifecycleService.js';
import { lookupVehicleSpecsFromCarQuery } from '../../lib/carquerySpecs.js';
import { participantIdMatchesAppUser } from '../../utils/conversationParticipants.js';
import {
  detectBufferContentType,
} from '../../utils/fileContentValidation.js';
// Supabase admin database utilities (replaces Firebase admin functions)
import { 
  adminRead, 
  adminReadAll, 
  adminCreate, 
  adminUpdate, 
  adminDelete,
  DB_PATHS 
} from '../supabase-admin-db.js';
import { handleAdmin, seedUsers, seedVehicles } from '../handlers/admin.js';
import { handleHealth, handleSystem, handleUtils } from '../handlers/system.js';

// Use Supabase instead of Firebase
// Note: This is checked at module load time. If Supabase is not available,
// API routes will return proper error messages with details on how to fix it.
// CRITICAL FIX: Wrap in try-catch to prevent function crashes if Supabase initialization fails
let USE_SUPABASE = false;
try {
  // Try to initialize Supabase admin client to check availability
  getSupabaseAdminClient();
  USE_SUPABASE = true;
} catch (error) {
  // Don't crash the function if Supabase initialization fails at module load
  // We'll handle this gracefully in each handler by returning 503 errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.warn('⚠️ Supabase initialization failed at module load (function will still work, but Supabase operations will return 503):', errorMessage);
  USE_SUPABASE = false;
}

// Get Supabase status with detailed error information
function getSupabaseErrorMessage(): string {
  try {
    getSupabaseAdminClient();
    return '';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return `Supabase database is not available: ${errorMessage}. Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY configuration.`;
  }
}

// All services now use Supabase directly
const userService = supabaseUserService;
const vehicleService = supabaseVehicleService;
const conversationService = supabaseConversationService;

type VehicleMutationResolve =
  | { ok: true; vehicle: VehicleType; primaryKey: string }
  | { ok: false; status: number; reason: string };

/** Resolve listing for seller mutations — prefers `databaseId`, then numeric `id`. */
async function resolveVehicleForMutation(
  body: Record<string, unknown>,
  options?: { sellerEmailHint?: string },
): Promise<VehicleMutationResolve> {
  const parsed = parseVehicleIdentityFromBody(body);
  if (!hasResolvableVehicleIdentity(parsed)) {
    return { ok: false, status: 400, reason: 'Vehicle ID is required.' };
  }
  const sellerEmailHint =
    options?.sellerEmailHint ||
    (typeof body.sellerEmail === 'string' ? body.sellerEmail.trim().toLowerCase() : undefined);
  try {
    const resolved = await vehicleService.resolveVehicleIdentity({
      id: parsed.numericId,
      databaseId: parsed.databaseId,
      sellerEmail: sellerEmailHint,
    });
    if (
      !parsed.databaseId &&
      parsed.numericId !== undefined &&
      resolved.vehicle.id !== parsed.numericId
    ) {
      return { ok: false, status: 400, reason: 'Vehicle id does not match listing.' };
    }
    return { ok: true, vehicle: resolved.vehicle, primaryKey: resolved.primaryKey };
  } catch {
    if (!parsed.databaseId && parsed.numericId !== undefined) {
      return { ok: false, status: 400, reason: MUTATION_IDENTITY_REFRESH_MESSAGE };
    }
    return { ok: false, status: 404, reason: 'Vehicle not found.' };
  }
}

function setVehicleApiCacheHeaders(req: VercelRequest, res: VercelResponse): void {
  const hasAuth =
    Boolean(req.headers.authorization) ||
    Boolean(req.headers.cookie && String(req.headers.cookie).includes('refreshToken'));
  if (hasAuth) {
    res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
    res.setHeader('Vary', 'Authorization, Cookie');
  }
}
import { 
  hashPassword, 
  validatePassword, 
  generateAccessToken, 
  generateRefreshToken, 
  generatePasswordResetToken,
  verifyPasswordResetToken,
  validateUserInput,
  validatePasswordStrength,
  sanitizeObject,
  sanitizeString,
  validateEmail,
  verifyToken,
  rotateRefreshToken,
  type TokenPayload
} from '../../utils/security.js';
import { isRefreshTokenRevoked, revokeRefreshToken } from '../../lib/token-revocation.js';
import { getSecurityConfig } from '../../utils/security-config.js';
import { attachApiCors } from '../../utils/attach-api-cors.js';
import { shouldSkipCsrfForCapacitorNative } from '../../utils/csrfCapacitorExempt.js';
import { logInfo, logWarn, logError, logSecurity } from '../../utils/logger.js';
import { generateCsrfToken, validateCsrfToken, getCsrfCookieName, getCsrfHeaderName } from '../../utils/csrf.js';
import { getPublicAppOriginForPasswordReset, sendPasswordResetEmail } from '../../api/lib/send-password-reset-email.js';
import { checkUpstashRateLimit } from '../../lib/rate-limit-upstash.js';
import { checkLoginAllowed, recordFailedLogin, clearLoginLockout } from '../../lib/login-lockout.js';
import { resolveEffectiveApiPathname } from '../../utils/api-path-routing.js';
import {
  appendRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  isCapacitorAppClient,
  refreshCookieMaxAgeSeconds,
} from '../refresh-cookie.js';

// Allow larger JSON payloads for base64 image uploads (seller dashboard, chat attachments).
// Vercel default parser limits are lower and can reject valid resized images before route logic runs.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

// Type for normalized user (without password)
interface NormalizedUser extends Omit<UserType, 'password'> {
  id: string;
  hasPassword: boolean;
}

// Helper: Calculate distance between coordinates
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Normalize user object for frontend consumption
// Ensures role is present, and removes password
function normalizeUser(user: UserType | null | undefined): NormalizedUser | null {
  if (!user) return null;
  
  // CRITICAL FIX: Generate id from email if missing (shouldn't happen but handle gracefully)
  let id = user.id;
  if (!id && user.email) {
    const emailKey = user.email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
    logWarn('⚠️ User object missing id field, generating from email:', { email: user.email, generatedId: emailKey });
    id = emailKey;
  }
  
  if (!id) {
    logWarn('⚠️ User object missing both id and email fields, cannot normalize');
    return null;
  }
  
  // Ensure role is present (critical for seller / service provider dashboard access)
  const validRoles = ['customer', 'seller', 'admin', 'service_provider', 'finance_partner'] as const;
  let role: (typeof validRoles)[number] = user.role as (typeof validRoles)[number];
  if (!role || typeof role !== 'string' || !validRoles.includes(role as (typeof validRoles)[number])) {
    logWarn('⚠️ User object missing or invalid role field:', user.email, 'role:', role);
    role = 'customer';
  }
  
  // Ensure email is present and normalized (derive from id if missing for backwards compatibility)
  let email = user.email ? String(user.email).toLowerCase().trim() : '';
  if (!email && id && typeof id === 'string') {
    // Some legacy rows use id as email key; use provided lookup email when available in caller
    logWarn('⚠️ User object missing email field, id present:', id);
    email = id.includes('@') ? id : '';
  }
  if (!email) {
    logWarn('⚠️ User object missing email field');
    return null;
  }

  // Build normalized user object (exclude password)
  const hasPassword = !!(user.password && String(user.password).trim());
  const { password, ...userWithoutPassword } = user;
  const normalized: NormalizedUser = {
    id,
    ...userWithoutPassword,
    email,
    role,
    hasPassword,
  };

  normalized.rerideRecommended = isRerideStaffPick(
    (normalized as { rerideRecommended?: unknown }).rerideRecommended,
  );

  return normalized;
}

/** Public dealer/service-provider directory — omits phone; keep email for profile links. */
function toPublicDirectoryUser(user: NormalizedUser): NormalizedUser {
  const { mobile: _omitMobile, password: _omitPw, ...safe } = user as NormalizedUser & {
    mobile?: string;
    password?: string;
  };
  return safe as NormalizedUser;
}

// Authentication middleware
interface AuthResult {
  isValid: boolean;
  user?: { userId: string; email: string; role: string; type?: string };
  error?: string;
}

const normalizeAuthActorEmail = (auth: AuthResult | null | undefined): string => {
  const email = auth?.user?.email ? String(auth.user.email).toLowerCase().trim() : '';
  if (email) return email;
  const userId = auth?.user?.userId ? String(auth.user.userId).toLowerCase().trim() : '';
  return userId.includes('@') ? userId : '';
};

const authenticateRequest = (req: VercelRequest): AuthResult => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'No valid authorization header' };
  }
  
  try {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Check if JWT_SECRET is configured before attempting verification
    // Use getSecurityConfig().JWT.SECRET (same source as verifyToken) to ensure consistency
    const securityConfig = getSecurityConfig();
    const secret = securityConfig.JWT.SECRET;
    if (!secret) {
      logWarn('⚠️ JWT_SECRET is not set - authentication will fail');
      return { 
        isValid: false, 
        error: 'Server configuration error: JWT_SECRET is missing. Please configure JWT_SECRET in your environment variables.' 
      };
    }
    
    const decoded = verifyToken(token);
    // Ensure role is present for the user object
    const user = {
      ...decoded,
      role: decoded.role || 'customer' as 'customer' | 'seller' | 'admin'
    };
    return { isValid: true, user };
  } catch (error) {
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('JWT_SECRET')) {
      return { 
        isValid: false, 
        error: 'Server configuration error: JWT_SECRET is missing. Please configure JWT_SECRET in your environment variables.' 
      };
    }
    // Preserve JWT-specific error messages from verifyToken (e.g., 'Token has expired', 'Invalid token format')
    // These provide better debugging information than a generic message
    return { isValid: false, error: errorMessage };
  }
};

const requireAuth = async (
  req: VercelRequest,
  res: VercelResponse,
  context: string
): Promise<AuthResult | null> => {
  const auth = await authenticateRequestDual(req);
  if (!auth.isValid) {
    logWarn(`⚠️ ${context} - Authentication failed:`, auth.error);
    res.status(401).json({
      success: false,
      reason: auth.error || 'Authentication required.',
      error: 'Invalid or expired authentication token'
    });
    return null;
  }
  return auth;
};

/** App JWT (reRideAccessToken) or Supabase access_token in Authorization header. */
const authenticateRequestDual = async (req: VercelRequest): Promise<AuthResult> => {
  const legacy = authenticateRequest(req);
  if (legacy.isValid) return legacy;
  try {
    const sb = await verifySupabaseToken(req.headers.authorization);
    const email = (sb.email || '').toLowerCase().trim();
    if (!email) {
      return { isValid: false, error: 'Invalid Supabase token' };
    }
    const meta = sb.user?.app_metadata as Record<string, unknown> | undefined;
    const appMetaRole = typeof meta?.role === 'string' ? meta.role : undefined;
    const { resolveAuthRoleFromEmail } = await import('../../utils/resolveAuthRole.js');
    const role = await resolveAuthRoleFromEmail(email, appMetaRole);
    return {
      isValid: true,
      user: {
        userId: sb.uid,
        email,
        role,
      },
    };
  } catch {
    return { isValid: false, error: legacy.error || 'Authentication required' };
  }
};

const requireAdmin = async (
  req: VercelRequest,
  res: VercelResponse,
  context: string
): Promise<AuthResult | null> => {
  const auth = await authenticateRequestDual(req);
  if (!auth.isValid) {
    logWarn(`⚠️ ${context} - Authentication failed:`, auth.error);
    res.status(401).json({
      success: false,
      reason: auth.error || 'Authentication required.',
      error: 'Invalid or expired authentication token',
    });
    return null;
  }

  let role = auth.user?.role;
  if (role !== 'admin' && auth.user?.email && USE_SUPABASE) {
    try {
      const dbUser = await userService.findByEmail(auth.user.email.toLowerCase().trim());
      if (dbUser && normalizeUserRoleString(dbUser.role) === 'admin') {
        role = 'admin';
        auth.user = { ...auth.user!, role: 'admin' };
      }
    } catch {
      /* non-fatal */
    }
  }

  if (role !== 'admin') {
    res.status(403).json({
      success: false,
      reason: 'Forbidden. Admin access required.',
    });
    return null;
  }
  return auth;
};

// Rate limiting using Supabase for serverless compatibility
const securityConfig = getSecurityConfig();

type HandlerOptions = {
  // Supabase-only - no additional options needed
};

import { getTrustedClientIP } from '../../utils/trusted-client-ip.js';
import { resolveRateLimit } from '../../lib/rate-limit-resolver.js';
import { attachViewTrackTokens } from '../../utils/view-track-token.js';

const getClientIP = (req: VercelRequest): string => getTrustedClientIP(req);

async function checkTrackViewRateLimit(
  identifier: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const limits = securityConfig.ENDPOINT_RATE_LIMITS.TRACK_VIEW;
  const result = await resolveRateLimit('track-view', identifier, limits);
  return { allowed: result.allowed, remaining: result.remaining };
}

// In-memory rate limit cache for fallback (with TTL)
interface RateLimitCacheEntry {
  count: number;
  resetTime: number;
}

const rateLimitCache = new Map<string, RateLimitCacheEntry>();

// Clean up expired cache entries
const cleanupRateLimitCache = () => {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache.entries()) {
    if (entry.resetTime < now) {
      rateLimitCache.delete(key);
    }
  }
};

// Simple cache for published vehicles (30 second TTL for fast loading)
interface VehicleCacheEntry {
  vehicles: VehicleType[];
  timestamp: number;
  totalCount?: number; // Cache total count separately for pagination
}

const vehicleCache = new Map<string, VehicleCacheEntry>();
const VEHICLE_CACHE_TTL = 30000; // 30 seconds

/** Short TTL cache for home discovery counts (category / city) — avoids full-table scans on the client. */
let storefrontAggregateCache: { body: Record<string, unknown>; timestamp: number } | null = null;
const STOREFRONT_AGGREGATE_CACHE_TTL_MS = 45000;

function setStorefrontAggregateCache(entry: { body: Record<string, unknown>; timestamp: number } | null): void {
  storefrontAggregateCache = entry;
}

// Clean up expired vehicle cache entries
const cleanupVehicleCache = () => {
  const now = Date.now();
  for (const [key, entry] of vehicleCache.entries()) {
    if (now - entry.timestamp > VEHICLE_CACHE_TTL) {
      vehicleCache.delete(key);
    }
  }
};

// Rate limiting for serverless environments
const checkRateLimit = async (identifier: string): Promise<{ allowed: boolean; remaining: number }> => {
  const now = Date.now();
  const resetTime = now + securityConfig.RATE_LIMIT.WINDOW_MS;
  
  // Use in-memory cache with TTL for rate limiting
  cleanupRateLimitCache();
  const cached = rateLimitCache.get(identifier);
  
  if (cached && cached.resetTime >= now) {
    // Entry exists and is still valid
    cached.count += 1;
    if (cached.count > securityConfig.RATE_LIMIT.MAX_REQUESTS) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: Math.max(0, securityConfig.RATE_LIMIT.MAX_REQUESTS - cached.count) };
  } else {
    // Create new entry
    rateLimitCache.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: securityConfig.RATE_LIMIT.MAX_REQUESTS - 1 };
  }
}

function firstQueryParam(val: string | string[] | undefined): string | undefined {
  if (val === undefined) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

function copyQueryRecord(
  source: VercelRequest['query'],
): Record<string, string | string[] | undefined> {
  if (!source || typeof source !== 'object') return {};
  const out: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(source)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Vercel may provide a frozen/non-extensible `req.query`. Routing and handlers must
 * not mutate that object in place — copy first.
 */
function ensureMutableRequestQuery(req: VercelRequest): void {
  req.query = copyQueryRecord(req.query);
}

/**
 * Vercel rewrites /api/* → /api/main.ts; the query string may be present on `req.url` but not parsed into `req.query`.
 * Merging before routing fixes resolveEffectiveApiPathname() (skipExpiryCheck, type=data, etc.).
 */
function mergeQueryStringFromRequestUrl(req: VercelRequest): void {
  ensureMutableRequestQuery(req);
  if (typeof req.url !== 'string' || !req.url.includes('?')) return;
  try {
    const qPart = req.url.split('?').slice(1).join('?');
    if (!qPart) return;
    const params = new URLSearchParams(qPart);
    const q = req.query as Record<string, string | string[] | undefined>;
    for (const [k, v] of params) {
      if (q[k] === undefined) {
        q[k] = v;
      }
    }
  } catch {
    // ignore malformed URLs
  }
}

function respondServiceUnavailable(
  res: VercelResponse,
  error: unknown,
  reason?: string,
): VercelResponse {
  return res.status(503).json({
    success: false,
    reason: reason ?? errorToPublicMessage(error),
  });
}

function errorToPublicMessage(error: unknown): string {
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.VERCEL_ENV === 'development';
  if (!isDev) {
    return 'An unexpected server error occurred.';
  }
  if (error instanceof Error) {
    const m = error.message;
    if (m && m !== '[object Object]') return m;
  } else if (typeof error === 'string' && error) {
    return error;
  }
  try {
    if (error !== null && error !== undefined && typeof error === 'object') {
      return JSON.stringify(error);
    }
  } catch {
    // ignore
  }
  return 'An unexpected server error occurred.';
}

/**
 * Pathname for error fallbacks when the handler throws before/during routing.
 * Mirrors mainHandler's rewrite resolution so we don't treat /api/main as the real route.
 */
function getEffectivePathnameForErrorFallback(req: VercelRequest): string {
  mergeQueryStringFromRequestUrl(req);
  let pathname = '/';
  try {
    const originalPath = req.headers['x-vercel-original-path'] as string;
    const invokePath = req.headers['x-invoke-path'] as string;
    const requestUrl = originalPath || invokePath || req.url || '';
    if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
      pathname = new URL(requestUrl).pathname;
    } else if (requestUrl.startsWith('/')) {
      pathname = requestUrl.split('?')[0];
    } else if (requestUrl) {
      pathname = new URL(requestUrl, `http://${req.headers.host || 'localhost'}`).pathname;
    }
  } catch {
    if (req.url) {
      const m = req.url.match(/^([^?]+)/);
      if (m) pathname = m[1];
    }
  }
  if (
    (pathname === '/api/main' || pathname === '/main') &&
    req.url &&
    req.url.startsWith('/api/') &&
    req.url !== '/api/main'
  ) {
    pathname = req.url.split('?')[0];
  }
  try {
    return resolveEffectiveApiPathname(req, pathname);
  } catch {
    return pathname;
  }
}


export type { HandlerOptions, AuthResult, NormalizedUser, UserType, VehicleType, VerificationStatus, VehicleMutationResolve, TokenPayload };
export {
  USE_SUPABASE, getSupabaseErrorMessage, userService, vehicleService, conversationService,
  resolveVehicleForMutation, setVehicleApiCacheHeaders, calculateDistance, normalizeUser,
  toPublicDirectoryUser, normalizeAuthActorEmail, authenticateRequest, authenticateRequestDual,
  requireAuth, requireAdmin, getClientIP, checkRateLimit, checkTrackViewRateLimit, attachViewTrackTokens,
  cleanupVehicleCache, vehicleCache, VEHICLE_CACHE_TTL, storefrontAggregateCache,
  setStorefrontAggregateCache, STOREFRONT_AGGREGATE_CACHE_TTL_MS, firstQueryParam, ensureMutableRequestQuery,
  mergeQueryStringFromRequestUrl,
  errorToPublicMessage, getEffectivePathnameForErrorFallback,
  getSupabaseAdminClient, PLAN_DETAILS, buildListingRenewalUpdates, computeListingExpiresAtForSeller,
  isSellerPlanExpired, validateListingRenewal, listingLimitGuardResponse, invalidateSellerPlanCache,
  resolveSellerPlanDetails, validateSellerCanCreateListing, validateSellerCanPublishListing,
  VehicleCategory, supabaseUserService, supabaseServiceProviderService, isRerideStaffPick,
  userRolesEqual, normalizeUserRoleString, verifySupabaseToken, readVehicleCatalogFromSupabase,
  writeVehicleCatalogToSupabase, sendInquiryNotificationToSeller, notifySellerInquiryChannels,
  parseVehicleIdentityFromBody, hasResolvableVehicleIdentity, normalizeVehiclesList,
  MUTATION_IDENTITY_REFRESH_MESSAGE, sanitizeVehicleMediaUrls, isPublicBuyListing,
  lookupVehicleSpecsFromCarQuery, participantIdMatchesAppUser, detectBufferContentType,
  adminRead, adminReadAll, adminCreate, adminUpdate, adminDelete, DB_PATHS,
  handleAdmin, seedUsers, seedVehicles, handleHealth, handleSystem, handleUtils,
  hashPassword, validatePassword, generateAccessToken, generateRefreshToken,
  generatePasswordResetToken, verifyPasswordResetToken, validateUserInput, validatePasswordStrength, sanitizeObject,
  sanitizeString, validateEmail, verifyToken, rotateRefreshToken, isRefreshTokenRevoked,
  revokeRefreshToken, getSecurityConfig, attachApiCors, shouldSkipCsrfForCapacitorNative,
  logInfo, logWarn, logError, logSecurity, generateCsrfToken, validateCsrfToken,
  getCsrfCookieName, getPublicAppOriginForPasswordReset, sendPasswordResetEmail,
  checkUpstashRateLimit, checkLoginAllowed, recordFailedLogin, clearLoginLockout,
  resolveEffectiveApiPathname, appendRefreshTokenCookie, clearRefreshTokenCookie,
  getRefreshTokenFromRequest, isCapacitorAppClient, refreshCookieMaxAgeSeconds, randomBytes,
  createHmac, randomInt, securityConfig, respondServiceUnavailable,
};

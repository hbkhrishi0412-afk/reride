import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { PLAN_DETAILS } from '../constants.js';
import type { User as UserType, Vehicle as VehicleType, VerificationStatus } from '../types.js';
import { VehicleCategory } from '../types.js';
// Supabase services
import { supabaseUserService } from '../services/supabase-user-service.js';
import { supabaseVehicleService } from '../services/supabase-vehicle-service.js';
import { supabaseConversationService } from '../services/supabase-conversation-service.js';
import { supabaseServiceProviderService } from '../services/supabase-service-provider-service.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';
// Supabase admin database utilities (replaces Firebase admin functions)
import { 
  adminRead, 
  adminReadAll, 
  adminCreate, 
  adminUpdate, 
  adminDelete,
  DB_PATHS 
} from '../server/supabase-admin-db.js';

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
  verifyToken,
  refreshAccessToken,
  type TokenPayload
} from '../utils/security.js';
import { getSecurityConfig } from '../utils/security-config.js';
import { logInfo, logWarn, logError, logSecurity } from '../utils/logger.js';

// Type for normalized user (without password)
interface NormalizedUser extends Omit<UserType, 'password'> {
  id: string;
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
  
  // Ensure role is present (critical for seller dashboard access)
  let role: 'customer' | 'seller' | 'admin' = user.role;
  if (!role || typeof role !== 'string' || !['customer', 'seller', 'admin'].includes(role)) {
    logWarn('⚠️ User object missing or invalid role field:', user.email, 'role:', role);
    role = 'customer';
  }
  
  // Ensure email is present and normalized
  const email = user.email ? user.email.toLowerCase().trim() : '';
  if (!email) {
    logWarn('⚠️ User object missing email field');
    return null;
  }
  
  // Build normalized user object (exclude password)
  const { password, ...userWithoutPassword } = user;
  const normalized: NormalizedUser = {
    id,
    ...userWithoutPassword,
    email,
    role,
  };
  
  return normalized;
}

// Authentication middleware
interface AuthResult {
  isValid: boolean;
  user?: { userId: string; email: string; role: string; type?: string };
  error?: string;
}

const authenticateRequest = (req: VercelRequest): AuthResult => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'No valid authorization header' };
  }
  
  try {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Check if JWT_SECRET is configured before attempting verification
    // Use getSecurityConfig().JWT.SECRET (same source as verifyToken) to ensure consistency
    // This allows development fallback to work correctly
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

const requireAuth = (
  req: VercelRequest,
  res: VercelResponse,
  context: string
): AuthResult | null => {
  const auth = authenticateRequest(req);
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

const requireAdmin = (
  req: VercelRequest,
  res: VercelResponse,
  context: string
): AuthResult | null => {
  const auth = requireAuth(req, res, context);
  if (!auth) {
    return null;
  }
  if (auth.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      reason: 'Forbidden. Admin access required.'
    });
    return null;
  }
  return auth;
};

// Rate limiting using Supabase for serverless compatibility
const config = getSecurityConfig();

type HandlerOptions = {
  // Supabase-only - no additional options needed
};

// Extract client IP from request headers (handles proxies and Vercel)
// Improved for Vercel to prevent all requests from being counted as the same user
const getClientIP = (req: VercelRequest): string => {
  // Vercel-specific headers (check these first for better IP detection)
  const vercelForwardedFor = req.headers['x-vercel-forwarded-for'];
  if (vercelForwardedFor) {
    const ips = Array.isArray(vercelForwardedFor) ? vercelForwardedFor[0] : vercelForwardedFor;
    // Take the first IP (original client IP) from the comma-separated list
    const clientIP = ips.split(',')[0].trim();
    if (clientIP && clientIP !== '::1' && clientIP !== '127.0.0.1') {
      return clientIP;
    }
  }
  
  // Cloudflare header (if behind Cloudflare)
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  if (cfConnectingIP) {
    const ip = Array.isArray(cfConnectingIP) ? cfConnectingIP[0] : cfConnectingIP;
    if (ip && ip !== '::1' && ip !== '127.0.0.1') {
      return ip;
    }
  }
  
  // Standard x-forwarded-for header
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    // x-forwarded-for can contain multiple IPs: client, proxy1, proxy2
    // The first IP is usually the original client IP
    const clientIP = ips.split(',')[0].trim();
    if (clientIP && clientIP !== '::1' && clientIP !== '127.0.0.1') {
      return clientIP;
    }
  }
  
  // x-real-ip header (some proxies use this)
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    const ip = Array.isArray(realIP) ? realIP[0] : realIP;
    if (ip && ip !== '::1' && ip !== '127.0.0.1') {
      return ip;
    }
  }
  
  // Fallback to socket remote address
  const socketIP = req.socket?.remoteAddress;
  if (socketIP && socketIP !== '::1' && socketIP !== '127.0.0.1') {
    return socketIP;
  }
  
  // Last resort: use a combination of headers to create a unique identifier
  // This helps when all requests appear to come from the same IP (Vercel edge)
  const userAgentHeader = req.headers['user-agent'];
  const acceptLanguageHeader = req.headers['accept-language'];
  
  // Handle arrays properly (headers can be string | string[] | undefined)
  // Also handle empty arrays by defaulting to 'unknown'
  const userAgent = Array.isArray(userAgentHeader) 
    ? (userAgentHeader[0] || 'unknown')
    : (userAgentHeader || 'unknown');
  const acceptLanguage = Array.isArray(acceptLanguageHeader)
    ? (acceptLanguageHeader[0] || 'unknown')
    : (acceptLanguageHeader || 'unknown');
  
  // Create a hash-like identifier from headers (not perfect but better than 'unknown')
  const fallbackId = `${socketIP || 'fallback'}-${userAgent.substring(0, 20)}-${acceptLanguage.substring(0, 10)}`;
  return fallbackId;
};

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
  const resetTime = now + config.RATE_LIMIT.WINDOW_MS;
  
  // Use in-memory cache with TTL for rate limiting
  cleanupRateLimitCache();
  const cached = rateLimitCache.get(identifier);
  
  if (cached && cached.resetTime >= now) {
    // Entry exists and is still valid
    cached.count += 1;
    if (cached.count > config.RATE_LIMIT.MAX_REQUESTS) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: Math.max(0, config.RATE_LIMIT.MAX_REQUESTS - cached.count) };
  } else {
    // Create new entry
    rateLimitCache.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: config.RATE_LIMIT.MAX_REQUESTS - 1 };
  }
}

// Main handler with comprehensive error handling
async function mainHandler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set security headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Set CORS headers with proper security
  const origin = req.headers.origin;
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1') ||
    origin.includes('::1')
  );
  
  // Allow requests from allowed origins or localhost in development
  if (config.CORS.ALLOWED_ORIGINS.includes(origin as string) || (!isProduction && isLocalhost)) {
    res.setHeader('Access-Control-Allow-Origin', origin as string);
  } else if (isProduction && origin) {
    // In production, check if origin matches any allowed production domain
    const isAllowedProductionOrigin = config.CORS.ALLOWED_ORIGINS.some(allowedOrigin => 
      origin === allowedOrigin || origin?.includes(allowedOrigin.replace('https://', ''))
    );
    if (isAllowedProductionOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin as string);
    } else {
      // Fallback to primary production domain
      res.setHeader('Access-Control-Allow-Origin', 'https://www.reride.co.in');
    }
  } else if (!isProduction) {
    // In development, allow all origins as fallback
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    // Production fallback - use primary domain
    res.setHeader('Access-Control-Allow-Origin', 'https://www.reride.co.in');
  }
  
  res.setHeader('Access-Control-Allow-Methods', config.CORS.ALLOWED_METHODS.join(', '));
  res.setHeader('Access-Control-Allow-Headers', config.CORS.ALLOWED_HEADERS.join(', '));
  res.setHeader('Access-Control-Allow-Credentials', config.CORS.CREDENTIALS.toString());
  res.setHeader('Access-Control-Max-Age', config.CORS.MAX_AGE.toString());
  
  // Always set JSON content type to prevent HTML responses
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight (OPTIONS) and browser checks (HEAD)
  // This MUST be checked before any routing to prevent 405 errors
  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    // Set proper headers for HEAD requests
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', '0');
    }
    return res.status(200).end();
  }

  // Extract pathname early for routing and Supabase Admin checks
  // Handle Vercel rewrites - check original path if available
  let pathname = '/';
  try {
      // Vercel sets multiple headers for the original path
      // x-vercel-original-path contains the original request path before rewrite
      // x-invoke-path is another header Vercel sometimes uses
      const originalPath = req.headers['x-vercel-original-path'] as string;
      const invokePath = req.headers['x-invoke-path'] as string;
      
      // Priority: originalPath > invokePath > req.url
      // req.url might be /api/main after rewrite, so we prefer the headers
      let requestUrl = originalPath || invokePath || req.url || '';
      
      // If we don't have a path from headers and req.url is /api/main, 
      // we need to check if there's a way to get the original path
      // For now, use what we have
      
      // If requestUrl doesn't start with /, it might be a full URL or relative
      if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
        const url = new URL(requestUrl);
        pathname = url.pathname;
      } else if (requestUrl.startsWith('/')) {
        pathname = requestUrl.split('?')[0]; // Remove query string
      } else {
        // Try to construct URL
        const url = new URL(requestUrl, `http://${req.headers.host || 'localhost'}`);
        pathname = url.pathname;
      }
      
      // Log for debugging to help identify routing issues
      logInfo(`📍 Request routing - method: ${req.method}, originalPath: ${originalPath || 'none'}, invokePath: ${invokePath || 'none'}, req.url: ${req.url || 'none'}, final pathname: ${pathname}`);
    } catch (urlError) {
      // Only log in development to avoid information leakage
      logWarn('⚠️ Error parsing URL, using fallback:', urlError);
      // Fallback: try to extract pathname from req.url directly
      if (req.url) {
        const match = req.url.match(/^([^?]+)/);
        if (match) {
          pathname = match[1];
        }
      }
      // Only log in development to avoid information leakage
      logInfo(`📍 Fallback pathname: ${pathname}, req.url: ${req.url}`);
    }

  try {
    // Check if this is a health check endpoint or HEAD request (exempt from rate limiting)
    const isHealthEndpoint = pathname.includes('/db-health') || 
                             pathname.includes('/health') || 
                             pathname.endsWith('/db-health') || 
                             pathname.endsWith('/health');
    const isHeadRequest = req.method === 'HEAD';
    const shouldExemptFromRateLimit = isHealthEndpoint || isHeadRequest;

    // Rate limiting (after database connection check and pathname extraction)
    // Exempt health check endpoints and HEAD requests
    if (!shouldExemptFromRateLimit) {
      // For authenticated requests, use user email as identifier (prevents shared rate limits)
      // This is critical for serverless where all requests might share the same IP
      let rateLimitIdentifier = getClientIP(req);
      
      // Try to get user from token for authenticated requests
      try {
        const auth = authenticateRequest(req);
        if (auth.isValid && auth.user?.email) {
          // Use user email as identifier for authenticated requests
          // This gives each user their own rate limit bucket
          rateLimitIdentifier = `user:${auth.user.email.toLowerCase().trim()}`;
        }
      } catch (authError) {
        // If auth fails or throws, fall back to IP-based limiting
        // This is fine for unauthenticated requests
      }
      
      const rateLimitResult = await checkRateLimit(rateLimitIdentifier);
      
      if (!rateLimitResult.allowed) {
        // Only log in development to avoid information leakage
        if (process.env.NODE_ENV !== 'production') {
          logWarn(`⚠️ Rate limit exceeded for ${rateLimitIdentifier} on ${pathname}`);
        }
        return res.status(429).json({
          success: false,
          reason: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(config.RATE_LIMIT.WINDOW_MS / 1000)
        });
      }
      
      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      res.setHeader('X-RateLimit-Limit', config.RATE_LIMIT.MAX_REQUESTS.toString());
    } else {
      // Set rate limit headers even for exempted requests (with max values)
      res.setHeader('X-RateLimit-Remaining', config.RATE_LIMIT.MAX_REQUESTS.toString());
      res.setHeader('X-RateLimit-Limit', config.RATE_LIMIT.MAX_REQUESTS.toString());
    }

    // Early detection: If this is a PUT/POST request and we can't determine the route,
    // check if it's likely a user operation based on URL patterns or headers
    if ((req.method === 'PUT' || req.method === 'POST') && (pathname === '/' || pathname === '/api/main' || pathname === '/main')) {
      const originalPath = req.headers['x-vercel-original-path'] as string;
      const invokePath = req.headers['x-invoke-path'] as string;
      const urlPath = req.url || '';
      
      // Check if any of these indicate a /users endpoint
      if (originalPath?.includes('/users') || invokePath?.includes('/users') || urlPath.includes('/users')) {
        // Only log in development to avoid information leakage
        logInfo(`🔍 Early detection: Routing ${req.method} to handleUsers based on URL/header pattern`);
        const handlerOptions: HandlerOptions = {};
        return await handleUsers(req, res, handlerOptions);
      }
    }

    // Route to appropriate handler
    const handlerOptions: HandlerOptions = {};

    // Special handling: If pathname is /api/main (after Vercel rewrite), 
    // check the original path header to determine the actual route
    if (pathname === '/api/main' || pathname === '/main') {
      const originalPath = req.headers['x-vercel-original-path'] as string;
      const invokePath = req.headers['x-invoke-path'] as string;
      const checkPath = originalPath || invokePath;
      
      if (checkPath) {
        // Extract the actual path from the original path
        if (checkPath.includes('/users') || checkPath.endsWith('/users')) {
          logInfo(`✅ Routing ${req.method} request from /api/main to handleUsers (original: ${checkPath})`);
          return await handleUsers(req, res, handlerOptions);
        } else if (checkPath.includes('/vehicles') || checkPath.endsWith('/vehicles')) {
          logInfo(`✅ Routing ${req.method} request from /api/main to handleVehicles (original: ${checkPath})`);
          return await handleVehicles(req, res, handlerOptions);
        } else if (checkPath.includes('/faqs') || checkPath.endsWith('/faqs')) {
          logInfo(`✅ Routing ${req.method} request from /api/main to handleContent/FAQs (original: ${checkPath})`);
          req.query = req.query || {};
          req.query.type = 'faqs';
          return await handleContent(req, res, handlerOptions);
        } else if (checkPath.includes('/support-tickets') || checkPath.endsWith('/support-tickets')) {
          logInfo(`✅ Routing ${req.method} request from /api/main to handleContent/SupportTickets (original: ${checkPath})`);
          req.query = req.query || {};
          req.query.type = 'support-tickets';
          return await handleContent(req, res, handlerOptions);
        } else if (checkPath.includes('/content') || checkPath.endsWith('/content')) {
          logInfo(`✅ Routing ${req.method} request from /api/main to handleContent (original: ${checkPath})`);
          return await handleContent(req, res, handlerOptions);
        }
      }
      
      // Fallback: If we can't determine the route from headers, check the request body or method
      // For PUT/POST requests, if we have a body with email, it's likely a user update
      if ((req.method === 'PUT' || req.method === 'POST') && req.body && req.body.email) {
        // Only log in development to avoid information leakage
        if (process.env.NODE_ENV !== 'production') {
          logInfo(`✅ Routing ${req.method} request from /api/main to handleUsers (fallback: body contains email)`);
        }
        return await handleUsers(req, res, handlerOptions);
      }
      
      // Last resort: default to users handler for /api/main
      // Only log in development to avoid information leakage
      if (process.env.NODE_ENV !== 'production') {
        logInfo(`⚠️ Routing ${req.method} request from /api/main to handleUsers (default fallback - no original path found)`);
      }
      return await handleUsers(req, res, handlerOptions);
    }

    // Enhanced routing check for /users endpoint - handles /api/users, /users, and variations
    if (pathname.includes('/users') || pathname.endsWith('/users') || pathname === '/api/users' || pathname === '/users') {
      // Only log in development to avoid information leakage
      if (process.env.NODE_ENV !== 'production') {
        logInfo(`✅ Routing ${req.method} request to handleUsers handler`);
      }
      return await handleUsers(req, res, handlerOptions);
    } else if (pathname.includes('/vehicles') || pathname.endsWith('/vehicles')) {
      try {
        return await handleVehicles(req, res, handlerOptions);
      } catch (error) {
        logError('⚠️ Error in handleVehicles wrapper:', error);
        // For vehicles?type=data, ensure we never return 500
        if (req.query?.type === 'data') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json({
            FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
            TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
          });
        }
        // For other vehicle endpoints, let the error propagate to outer catch
        throw error;
      }
    } else if ((pathname.includes('/api/admin') || pathname === '/api/admin' || pathname.endsWith('/api/admin')) && !pathname.includes('/admin/login')) {
      return await handleAdmin(req, res, handlerOptions);
    } else if (pathname.includes('/db-health') || pathname.endsWith('/db-health')) {
      return await handleHealth(req, res);
    } else if (pathname.includes('/seed') || pathname.endsWith('/seed')) {
      return await handleSeed(req, res, handlerOptions);
    } else     if (pathname.includes('/vehicle-data') || pathname.endsWith('/vehicle-data')) {
      try {
        return await handleVehicleData(req, res, handlerOptions);
      } catch (error) {
        logError('⚠️ Error in handleVehicleData wrapper:', error);
        // Ensure we never return 500 for vehicle-data endpoints
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({
          FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
          TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
        });
      }
    } else if (pathname.includes('/new-cars') || pathname.endsWith('/new-cars')) {
      return await handleNewCars(req, res, handlerOptions);
    } else if (pathname.includes('/system') || pathname.endsWith('/system')) {
      return await handleSystem(req, res, handlerOptions);
    } else if (pathname.includes('/utils') || pathname.endsWith('/utils') || pathname.includes('/test-connection') || pathname.includes('/test-firebase-writes')) {
      return await handleUtils(req, res, handlerOptions);
    } else if (pathname.includes('/ai') || pathname.endsWith('/ai') || pathname.includes('/gemini')) {
      return await handleAI(req, res, handlerOptions);
    } else if (pathname.includes('/faqs') || pathname.endsWith('/faqs') || pathname === '/api/faqs' || pathname === '/faqs') {
      // Set query type for handleContent to route to FAQs handler
          // Only log in development to avoid information leakage
          if (process.env.NODE_ENV !== 'production') {
            logInfo(`✅ Routing ${req.method} request to handleContent/FAQs handler`);
          }
      req.query = req.query || {};
      req.query.type = 'faqs';
      return await handleContent(req, res, handlerOptions);
    } else if (pathname.includes('/support-tickets') || pathname.endsWith('/support-tickets')) {
      // Set query type for handleContent to route to Support Tickets handler
      req.query = req.query || {};
      req.query.type = 'support-tickets';
      return await handleContent(req, res, handlerOptions);
    } else if (pathname.includes('/content') || pathname.endsWith('/content')) {
      return await handleContent(req, res, handlerOptions);
    } else if (pathname.includes('/sell-car') || pathname.endsWith('/sell-car')) {
      return await handleSellCar(req, res, handlerOptions);
    } else if (pathname.includes('/payments') || pathname.endsWith('/payments') || pathname.includes('/plans') || pathname.endsWith('/plans') || pathname.includes('/business')) {
      return await handleBusiness(req, res, handlerOptions);
    } else if (pathname.includes('/conversations') || pathname.endsWith('/conversations')) {
      return await handleConversations(req, res, handlerOptions);
    } else if (pathname.includes('/notifications') || pathname.endsWith('/notifications')) {
      return await handleNotifications(req, res, handlerOptions);
    } else if (pathname.includes('/buyer-activity') || pathname.endsWith('/buyer-activity')) {
      return await handleBuyerActivity(req, res, handlerOptions);
    } else if (pathname.includes('/login') || pathname.endsWith('/login')) {
      // Import and call login handler
      const { handleLogin } = await import('./login.js');
      return await handleLogin(req, res);
    } else if (pathname.includes('/services') && !pathname.includes('/service-')) {
      // Import and call services handler (exclude service-providers, service-requests)
      const { handleServices } = await import('./services.js');
      return await handleServices(req, res);
    } else if (pathname.includes('/provider-services') || pathname.endsWith('/provider-services')) {
      // Import and call provider-services handler
      const { handleProviderServices } = await import('./provider-services.js');
      return await handleProviderServices(req, res);
    } else if (pathname.includes('/service-providers') || pathname.endsWith('/service-providers')) {
      // Import and call service-providers handler
      const { handleServiceProviders } = await import('./service-providers.js');
      return await handleServiceProviders(req, res);
    } else if (pathname.includes('/service-requests') || pathname.endsWith('/service-requests')) {
      // Import and call service-requests handler
      const { handleServiceRequests } = await import('./service-requests.js');
      return await handleServiceRequests(req, res);
    } else if (pathname.includes('/chat') && !pathname.includes('/chat-websocket')) {
      // Import and call chat handler
      // @ts-ignore - chat.js is a JavaScript file
      const { handleChat } = await import('./chat.js');
      return await handleChat(req, res);
    } else {
      // Default to users for backward compatibility
      // This catches any unmatched routes, especially important for PUT /api/users
      // when pathname extraction fails or doesn't match expected patterns
      // Only log in development to avoid information leakage
      if (process.env.NODE_ENV !== 'production') {
        logInfo(`⚠️ Default route: Routing ${req.method} request (pathname: ${pathname}) to handleUsers handler`);
      }
      return await handleUsers(req, res, handlerOptions);
    }

  } catch (error) {
    logError('Main API Error:', error);
    
    // Ensure we always return JSON, never HTML
    res.setHeader('Content-Type', 'application/json');
    
    // Last resort: If this is a PUT request to /api/users and routing failed,
    // try to route it to handleUsers directly
    const urlPath = req.url || '';
    const originalPath = req.headers['x-vercel-original-path'] as string;
    if ((req.method === 'PUT' || req.method === 'POST') && 
        (urlPath.includes('/users') || originalPath?.includes('/users'))) {
      logInfo(`🆘 Error handler: Attempting to route ${req.method} /users request to handleUsers as last resort`);
      try {
        const handlerOptions: HandlerOptions = {};
        return await handleUsers(req, res, handlerOptions);
      } catch (handlerError) {
        logError('❌ Even handleUsers failed in error handler:', handlerError);
        // Fall through to return error
      }
    }
    
    // Special handling for vehicle-data endpoints - NEVER return 500
    const pathname = req.url?.split('?')[0] || '';
    const isVehicleDataEndpoint = pathname.includes('/vehicle-data') || 
                                  pathname.includes('/vehicles') && req.query?.type === 'data';
    
    if (isVehicleDataEndpoint) {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({
        FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
        TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
      });
    }
    
    // Check for Supabase/database errors first
    const isDbError = error instanceof Error && (
      error.message.includes('SUPABASE') || 
      error.message.includes('Supabase') ||
      error.message.includes('firebase') ||
      error.message.includes('PERMISSION_DENIED') ||
      error.message.includes('UNAUTHENTICATED') ||
      error.message.includes('UNAVAILABLE') ||
      // Database connection-related errors
      ((error.message.includes('connect') || error.message.includes('timeout') || error.message.includes('network')) && (
        error.message.includes('Supabase') ||
        error.message.includes('supabase') ||
        error.message.includes('database') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ))
    );
    
    if (isDbError) {
      logError('❌ Database error in main handler:', error instanceof Error ? error.message : 'Unknown error');
      // Check if it's a configuration error vs connection error
      if (error instanceof Error && (error.message.includes('SUPABASE') || error.message.includes('Supabase') || error.message.includes('supabase'))) {
        return res.status(503).json({ 
          success: false, 
          reason: 'Supabase configuration error. Please check Supabase environment variables.',
          details: 'The application requires Supabase to be properly configured. Please verify your Supabase credentials and project settings.'
        });
      }
      // General database connection/auth error
      return res.status(503).json({ 
        success: false, 
        reason: 'Database connection failed. Please ensure Supabase is properly configured and accessible.',
        details: 'Unable to connect to Supabase database. Please check your Supabase configuration, credentials, and network connectivity.'
      });
    }
    
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Users handler - preserves exact functionality from users.ts
async function handleUsers(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  try {
    // FIX: Handle HEAD requests immediately to prevent 405 errors
    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    // Check Firebase availability
    if (!USE_SUPABASE) {
      const errorMsg = getSupabaseErrorMessage();
      logWarn('⚠️ Firebase not available:', errorMsg);
      return res.status(503).json({
        success: false,
        reason: errorMsg,
        details: 'Please check your Firebase configuration. Server-side requires FIREBASE_* environment variables (without VITE_ prefix).',
        fallback: true
      });
    }

  // Handle authentication actions (POST with action parameter)
  if (req.method === 'POST') {

    const { action, email, password, role, name, mobile, authProvider, avatarUrl } = req.body;

    // Validate that action is provided
    if (!action || typeof action !== 'string') {
      logWarn('⚠️ POST /api/users: Missing or invalid action field', { body: req.body });
      return res.status(400).json({ 
        success: false, 
        reason: 'Invalid action. Please provide a valid action: login, register, oauth-login, or refresh-token.' 
      });
    }

    // LOGIN
    if (action === 'login') {
      if (!email || !password) {
        return res.status(400).json({ success: false, reason: 'Email and password are required.' });
      }
      
      // Sanitize input
      const sanitizedData = await sanitizeObject({ email, password, role });
      
      // Validate email format
      if (!validateEmail(sanitizedData.email)) {
        return res.status(400).json({ success: false, reason: 'Invalid email format.' });
      }
      
      // CRITICAL: Normalize email to lowercase for consistent database lookup
      // This MUST match the normalization used when saving users
      const normalizedEmail = sanitizedData.email.toLowerCase().trim();
      
      // Use Supabase for user lookup
      let user: UserType | null = null;
      
      try {
        // CRITICAL: Use normalized email for lookup
        user = await userService.findByEmail(normalizedEmail);
        
        // If user not found, log for debugging (but don't reveal to user for security)
        if (!user) {
          logWarn('⚠️ Login attempt - user not found:', {
            normalizedEmail,
            emailFormat: sanitizedData.email,
            role: sanitizedData.role
          });
        }
      } catch (error) {
        logError('❌ Supabase user lookup error:', error);
        return res.status(500).json({ success: false, reason: 'Database error. Please try again.' });
      }

      if (!user) {
        // Auto-create test users if missing (development/testing only)
        // SECURITY: Only allow in non-production environments
        const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
        
        if (!isProduction) {
          const testUsers = {
            'admin@test.com': {
              password: 'password',
              name: 'Admin User',
              mobile: '9876543210',
              location: 'Mumbai, Maharashtra',
              role: 'admin' as const,
              status: 'active' as const,
              isVerified: true,
              subscriptionPlan: 'premium' as const,
              featuredCredits: 100,
            },
            'seller@test.com': {
              password: 'password123', // Updated to match common test password
              name: 'Prestige Motors',
              mobile: '+91-98765-43210',
              location: 'Delhi, NCR',
              role: 'seller' as const,
              status: 'active' as const,
              isVerified: true,
              subscriptionPlan: 'premium' as const,
              featuredCredits: 5,
              usedCertifications: 1,
              dealershipName: 'Prestige Motors',
              bio: 'Specializing in luxury and performance electric vehicles since 2020.',
              logoUrl: 'https://i.pravatar.cc/100?u=seller',
              avatarUrl: 'https://i.pravatar.cc/150?u=seller@test.com',
            },
            'customer@test.com': {
              password: 'password',
              name: 'Test Customer',
              mobile: '9876543212',
              location: 'Bangalore, Karnataka',
              role: 'customer' as const,
              status: 'active' as const,
              isVerified: false,
              subscriptionPlan: 'free' as const,
              featuredCredits: 0,
              avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com',
            }
          };

          const testUserConfig = testUsers[normalizedEmail as keyof typeof testUsers];
          
          if (testUserConfig && sanitizedData.role === testUserConfig.role) {
          try {
            logInfo(`⚠️ ${testUserConfig.role} user not found, auto-creating ${normalizedEmail}...`);
            
            // Check Supabase availability before creating
            if (!USE_SUPABASE) {
              logError('❌ Cannot auto-create user: Supabase not available');
              throw new Error('Supabase database is not available');
            }
            
            const hashedPassword = await hashPassword(testUserConfig.password);
            const newUser = await userService.create({
              email: normalizedEmail,
              ...testUserConfig,
              password: hashedPassword, // Override with hashed password after spreading testUserConfig
              authProvider: 'email',
              createdAt: new Date().toISOString()
            });
            user = newUser;
            logInfo(`✅ ${testUserConfig.role} user auto-created successfully`, {
              email: newUser.email,
              id: newUser.id,
              role: newUser.role
            });
          } catch (createError) {
            logError(`❌ Failed to auto-create ${testUserConfig.role} user:`, createError);
            // Log detailed error for debugging
            const errorDetails = createError instanceof Error 
              ? { message: createError.message, stack: createError.stack }
              : createError;
            logError('Auto-create error details:', errorDetails);
            // Fall through to return error
          }
          }
        }
        
        if (!user) {
          // Don't reveal whether email exists or not (security best practice)
          return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
        }
      }
      
      // Check if user has a password set (might be an OAuth user)
      if (!user.password) {
        // Allow OAuth users to set a password during login
        // Hash the provided password and update the user
        try {
          const hashedPassword = await hashPassword(sanitizedData.password);
          await supabaseUserService.update(normalizedEmail, {
            password: hashedPassword,
            authProvider: user.authProvider === 'email' ? 'email' : user.authProvider, // Keep existing authProvider
            updatedAt: new Date().toISOString()
          });
          
          // Update the user object with the new password
          user.password = hashedPassword;
          
          logInfo('✅ Password set for OAuth user during login:', normalizedEmail);
        } catch (updateError) {
          logError('❌ Failed to set password for OAuth user:', updateError);
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to set password. Please try again or use your original sign-in method.' 
          });
        }
      }
      
      // Verify password using bcrypt
      let isPasswordValid = await validatePassword(sanitizedData.password, user.password);
      
      // CRITICAL FIX: Handle plain text passwords (migration from old system)
      // If password validation fails and the stored password is not a bcrypt hash,
      // check if it's a plain text password that matches, then rehash it
      if (!isPasswordValid && user.password && user.password.trim() && !user.password.startsWith('$2')) {
        // Password is stored as plain text - check if it matches
        if (user.password.trim() === sanitizedData.password.trim()) {
          logInfo('🔄 Plain text password detected - rehashing and updating user:', normalizedEmail);
          
          try {
            // Rehash the password and update the user
            const hashedPassword = await hashPassword(sanitizedData.password);
            await supabaseUserService.update(normalizedEmail, {
              password: hashedPassword,
              updatedAt: new Date().toISOString()
            });
            
            // Update the user object with the hashed password
            user.password = hashedPassword;
            
            // Password is now valid (we just verified it matches)
            isPasswordValid = true;
            
            logInfo('✅ Password rehashed successfully for user:', normalizedEmail);
          } catch (rehashError) {
            logError('❌ Failed to rehash password:', rehashError);
            // Continue to return invalid credentials error below
          }
        }
      }
      
      if (!isPasswordValid) {
        // SECURITY: Log minimal details - don't expose password hash prefixes
        if (process.env.NODE_ENV !== 'production') {
          logWarn('⚠️ Password validation failed:', {
            email: normalizedEmail,
            hasPassword: !!user.password,
            authProvider: user.authProvider,
            passwordIsHashed: user.password?.startsWith('$2') || false
          });
        }
        
        return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
      }
      
      // CRITICAL FIX: Check if user is a service provider trying to login as regular seller
      // Service providers should only login through the service provider login page
      if (user.role === 'seller') {
        try {
          const serviceProvider = await supabaseServiceProviderService.findByEmail(normalizedEmail);
          if (serviceProvider) {
            // User is a service provider - they must use the service provider login page
            logWarn('⚠️ Service provider attempted regular login:', {
              email: normalizedEmail,
              requestedRole: sanitizedData.role
            });
            return res.status(403).json({ 
              success: false, 
              reason: 'Service providers must login through the Service Provider login page.',
              isServiceProvider: true
            });
          }
        } catch (spError) {
          // If service provider lookup fails, log but don't block login
          // This ensures regular sellers can still login even if service provider service has issues
          logWarn('⚠️ Error checking service provider status:', spError);
        }
      }
      
      if (sanitizedData.role && user.role !== sanitizedData.role) {
        return res.status(403).json({ success: false, reason: `User is not a registered ${sanitizedData.role}.` });
      }
      if (user.status === 'inactive') {
        return res.status(403).json({ success: false, reason: 'Your account has been deactivated.' });
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Normalize user object for frontend (ensure role is present)
      const normalizedUser = normalizeUser(user);
      
          if (!normalizedUser || !normalizedUser.role) {
        logError('❌ Failed to normalize user object:', { 
          email: user.email, 
          hasRole: !!user.role,
          userObject: {
            id: user.id,
            email: user.email,
            role: user.role,
            hasId: !!user.id
          }
        });
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to process user data. Please try again.' 
        });
      }
      
      // Validate role matches requested role (critical for seller dashboard access)
      if (sanitizedData.role && normalizedUser.role !== sanitizedData.role) {
        logWarn('⚠️ Role mismatch in login response:', { 
          userRole: normalizedUser.role, 
          requestedRole: sanitizedData.role,
          email: normalizedUser.email
        });
        // Don't fail the login, but log the warning
        // The frontend will handle role validation
      }
      
      // Ensure email is present (critical for seller dashboard)
      if (!normalizedUser.email) {
        logError('❌ Normalized user missing email:', { 
          userId: normalizedUser.id,
          role: normalizedUser.role
        });
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to process user data. Please try again.' 
        });
      }
      
      logInfo('✅ Login successful:', { 
        email: normalizedUser.email, 
        role: normalizedUser.role,
        userId: normalizedUser.id
      });
      
      return res.status(200).json({ 
        success: true, 
        user: normalizedUser,
        accessToken,
        refreshToken
      });
    }

    // REGISTER
    if (action === 'register') {
      if (!email || !password || !name || !mobile || !role) {
        return res.status(400).json({ success: false, reason: 'All fields are required.' });
      }

      // Supabase connection is handled automatically - no need for connection checks

      // Sanitize and validate input data
      const sanitizedData = await sanitizeObject({ email, password, name, mobile, role });
      
      // SECURITY: Block admin role self-registration - admin accounts must be created internally
      if (sanitizedData.role === 'admin') {
        return res.status(403).json({ 
          success: false, 
          reason: 'Admin accounts cannot be created through public registration. Admin accounts must be provisioned internally.' 
        });
      }
      
      const validation = await validateUserInput(sanitizedData);
      
      if (!validation.isValid) {
        return res.status(400).json({ 
          success: false, 
          reason: 'Validation failed', 
          errors: validation.errors 
        });
      }

      // Normalize email to lowercase for consistent duplicate checking
      // This MUST match the normalization used when saving (line 294)
      const normalizedEmail = sanitizedData.email.toLowerCase().trim();

      try {
        // Check if user already exists
        let existingUser: UserType | null = null;
        
        try {
          existingUser = await userService.findByEmail(normalizedEmail);
        } catch (error) {
          logError('❌ Supabase user lookup error:', error);
          return res.status(500).json({ success: false, reason: 'Database error. Please try again.' });
        }
        
        if (existingUser) {
          logWarn('⚠️ Registration attempt with existing email:', normalizedEmail);
          return res.status(400).json({ success: false, reason: 'User already exists.' });
        }

        // Hash password before storing
        const hashedPassword = await hashPassword(sanitizedData.password);
        // Never log password hashing status or user emails in production
        if (process.env.NODE_ENV !== 'production') {
          logInfo('🔐 Password hashed successfully for user:', normalizedEmail);
        }

        // CRITICAL FIX: Don't generate userId - supabase-user-service will use emailKey as id
        // This ensures consistent id format matching the Supabase key

        const userData: Omit<UserType, 'id'> = {
          email: normalizedEmail,
          password: hashedPassword,
          name: sanitizedData.name,
          mobile: sanitizedData.mobile,
          role: sanitizedData.role,
          location: '', // Default empty location, can be updated later
          authProvider: 'email', // CRITICAL: Set authProvider for email/password users
          status: 'active' as const,
          isVerified: false,
          subscriptionPlan: 'free' as const,
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        };

        let newUser: UserType;
        
        try {
          logInfo('💾 Attempting to save user to Supabase...');
          newUser = await userService.create(userData);
          logInfo('✅ New user registered and saved to Supabase:', normalizedEmail);
          
          // CRITICAL FIX: Add retry logic and better error handling
          let verifyUser = await userService.findByEmail(normalizedEmail);
          let retryCount = 0;
          const maxRetries = 3;
          
          while (!verifyUser && retryCount < maxRetries) {
            logWarn(`⚠️ User not found after save, retrying... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            verifyUser = await userService.findByEmail(normalizedEmail);
            retryCount++;
          }
          
          if (!verifyUser) {
            // CRITICAL FIX: Check if user was actually created (might be a race condition)
            // Try one more time to find the user, and if found, use it
            // This prevents returning error when user was actually created
            const finalCheck = await userService.findByEmail(normalizedEmail);
            if (finalCheck) {
              logWarn('⚠️ User found on final check - race condition resolved');
              newUser = finalCheck;
            } else {
              logError('❌ User registration verification failed - user not found after save and retries');
              // CRITICAL: Check if user might have been created but verification is failing
              // In this case, we should still try to proceed if newUser was set from create()
              if (newUser && newUser.email === normalizedEmail) {
                logWarn('⚠️ Using user from create() despite verification failure - user may exist');
                // Continue with newUser from create() - verification might be a timing issue
              } else {
                return res.status(500).json({ 
                  success: false, 
                  reason: 'User registration failed - user was not saved to database. Please try again.' 
                });
              }
            }
          } else {
            logInfo('✅ User registration verified in database. User ID:', verifyUser.id);
            newUser = verifyUser;
          }
        } catch (error) {
          logError('❌ Error saving user to Supabase:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // CRITICAL FIX: Check for specific Supabase errors
          if (errorMessage.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            logError('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in production environment!');
            return res.status(500).json({ 
              success: false, 
              reason: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
                      'Please configure this environment variable in your production deployment (Vercel). ' +
                      'This is required for user registration to work.',
              error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
            });
          }
          
          if (errorMessage.includes('permission-denied') || errorMessage.includes('PERMISSION_DENIED') || 
              errorMessage.includes('row-level security') || errorMessage.includes('RLS Policy')) {
            logError('❌ RLS Policy Error - User creation blocked by Row Level Security');
            return res.status(500).json({ 
              success: false, 
              reason: 'Database permission error: Row Level Security (RLS) is blocking user creation. ' +
                      'Either add an INSERT policy for the users table or ensure SUPABASE_SERVICE_ROLE_KEY is configured.',
              error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
            });
          }
          
          if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
            return res.status(400).json({ 
              success: false, 
              reason: 'User with this email already exists.' 
            });
          }
          
          // Log full error details in non-production for debugging
          if (process.env.NODE_ENV !== 'production') {
            logError('❌ Full error details:', {
              message: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
              error: error
            });
          }
          
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to save user to database. Please try again.',
            error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
          });
        }
      
        // Generate JWT tokens for new user
        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);
        
        if (!newUser || !newUser.role) {
          logError('❌ Failed to normalize new user object:', { email: userData.email, hasRole: !!userData.role });
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to process user data. Please try again.' 
          });
        }
        
        logInfo('✅ Registration complete. User ID:', newUser.id);
        return res.status(201).json({ 
          success: true, 
          user: newUser,
          accessToken,
          refreshToken
        });
      } catch (saveError) {
        logError('❌ Error saving user to Supabase:', saveError);
        const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error';
        
        // Check for duplicate key error (email already exists)
        if (saveError instanceof Error && 
            (errorMessage.includes('already exists') || 
             errorMessage.includes('duplicate'))) {
          return res.status(400).json({ 
            success: false, 
            reason: 'User with this email already exists.' 
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to save user to database. Please try again.',
          error: errorMessage
        });
      }
    }

    // OAUTH LOGIN
    if (action === 'oauth-login') {
      // REMOVED: firebaseUid requirement - not used in Supabase
      if (!email || !name || !role) {
        return res.status(400).json({ success: false, reason: 'OAuth data incomplete.' });
      }

      // Sanitize OAuth data (removed firebaseUid - not used in Supabase)
      const sanitizedData = await sanitizeObject({ email, name, role, authProvider, avatarUrl });
      const mobile = req.body.mobile || '';
      const location = req.body.location || '';

      // SECURITY: Block admin role in OAuth registration - admin accounts must be created internally
      if (sanitizedData.role === 'admin') {
        return res.status(403).json({ 
          success: false, 
          reason: 'Admin accounts cannot be created via OAuth. Admin accounts must be provisioned internally.' 
        });
      }
      
      // Validate role is one of allowed OAuth roles
      const allowedOauthRoles = ['customer', 'seller'] as const;
      if (!allowedOauthRoles.includes(sanitizedData.role as typeof allowedOauthRoles[number])) {
        return res.status(400).json({ 
          success: false, 
          reason: `Invalid role for OAuth registration. Allowed roles: ${allowedOauthRoles.join(', ')}` 
        });
      }

      // Normalize email to lowercase for consistent database lookup
      const normalizedEmail = sanitizedData.email.toLowerCase().trim();
      let user = await userService.findByEmail(normalizedEmail);
      
      if (!user) {
        logInfo('🔄 OAuth registration - Creating new user:', normalizedEmail);
        const userData: Omit<UserType, 'id'> = {
          email: normalizedEmail,
          name: sanitizedData.name,
          mobile: mobile,
          location: location,
          role: sanitizedData.role,
          // REMOVED: firebaseUid - not used in Supabase
          authProvider: sanitizedData.authProvider,
          avatarUrl: sanitizedData.avatarUrl,
          status: 'active' as const,
          isVerified: true,
          subscriptionPlan: 'free' as const,
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        };
        
        logInfo('💾 Saving OAuth user to Supabase...');
        user = await userService.create(userData);
        logInfo('✅ OAuth user saved to Supabase:', normalizedEmail);
        
        // CRITICAL FIX: Add retry logic for OAuth user verification
        let verifyUser = await userService.findByEmail(normalizedEmail);
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!verifyUser && retryCount < maxRetries) {
          logWarn(`⚠️ OAuth user not found after save, retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          verifyUser = await userService.findByEmail(normalizedEmail);
          retryCount++;
        }
        
        if (!verifyUser) {
          // CRITICAL FIX: Check if user was actually created (might be a race condition)
          // Try one more time to find the user, and if found, use it
          const finalCheck = await userService.findByEmail(normalizedEmail);
          if (finalCheck) {
            logWarn('⚠️ OAuth user found on final check - race condition resolved');
            user = finalCheck;
          } else {
            logError('❌ OAuth user registration verification failed - user not found after save and retries');
            // CRITICAL: Check if user might have been created but verification is failing
            // In this case, we should still try to proceed if user was set from create()
            if (user && user.email === normalizedEmail) {
              logWarn('⚠️ Using OAuth user from create() despite verification failure - user may exist');
              // Continue with user from create() - verification might be a timing issue
            } else {
              return res.status(500).json({ 
                success: false, 
                reason: 'OAuth registration failed - user was not saved to database. Please try again.' 
              });
            }
          }
        } else {
          logInfo('✅ OAuth user registration verified in database. User ID:', verifyUser.id);
          // Use the verified user to ensure we have the latest data
          user = verifyUser;
        }
      } else {
        logInfo('✅ OAuth login - Existing user found:', sanitizedData.email);
      }

      // Generate JWT tokens for OAuth users
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Normalize user object for frontend (ensure role is present)
      const normalizedUser = normalizeUser(user);
      
      if (!normalizedUser || !normalizedUser.role) {
        logError('❌ Failed to normalize OAuth user object:', { email: user.email, hasRole: !!user.role });
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to process user data. Please try again.' 
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        user: normalizedUser,
        accessToken,
        refreshToken
      });
    }

    // TOKEN REFRESH
    if (action === 'refresh-token') {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        logWarn('⚠️ Refresh token request missing token');
        return res.status(400).json({ 
          success: false, 
          reason: 'Refresh token is required.',
          error: 'No refresh token provided in request body'
        });
      }

      try {
        // FIX: Use the utility to verify and refresh the token properly
        // This recovers the original user data from the refresh token
        logInfo('🔄 Refreshing access token...');
        const newAccessToken = refreshAccessToken(refreshToken);
        logInfo('✅ Access token refreshed successfully');
        
        // CRITICAL FIX: Also return a new refresh token to extend the session
        // This prevents refresh token expiration issues
        // Note: refreshAccessToken only returns access token, so we keep the same refresh token
        // In a production system, you might want to rotate refresh tokens for security
        return res.status(200).json({ 
          success: true, 
          accessToken: newAccessToken,
          refreshToken: refreshToken // Keep the same refresh token (or implement rotation)
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logWarn('❌ Refresh token failed:', errorMessage);
        return res.status(401).json({ 
          success: false, 
          reason: 'Invalid or expired refresh token. Please log in again.',
          error: errorMessage
        });
      }
    }

    // KARIX OTP - Send OTP via Karix SMS
    if (action === 'send-otp-karix') {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          reason: 'Phone number is required.' 
        });
      }

      try {
        // Import Karix service dynamically to avoid module load errors if not configured
        const { sendKarixOTP, getKarixConfig } = await import('../services/karixService.js');
        const karixConfig = getKarixConfig();
        
        if (!karixConfig) {
          return res.status(503).json({ 
            success: false, 
            reason: 'Karix SMS service is not configured. Please set KARIX_API_KEY and KARIX_API_SECRET environment variables.' 
          });
        }

        // Format phone number (E.164 format)
        let cleanedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        if (!cleanedNumber.startsWith('+')) {
          cleanedNumber = cleanedNumber.replace(/^(0|91)/, '');
          cleanedNumber = `+91${cleanedNumber}`;
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in Supabase database with expiration (10 minutes)
        const supabase = getSupabaseAdminClient();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
        
        // Hash OTP for storage (use simple hash for now, or use crypto for better security)
        const crypto = await import('crypto');
        const otpHash = crypto.createHash('sha256').update(otp + process.env.JWT_SECRET || 'default-secret').digest('hex');
        
        // Store OTP in a temporary table (create if doesn't exist)
        // Using Supabase's admin client to insert into a table
        const { error: storeError } = await supabase
          .from('otp_verifications')
          .upsert({
            phone: cleanedNumber,
            otp_hash: otpHash,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'phone'
          });

        // If table doesn't exist, we'll handle it gracefully
        if (storeError && !storeError.message.includes('relation') && !storeError.message.includes('does not exist')) {
          logWarn('⚠️ Could not store OTP in database (table may not exist):', storeError.message);
          // Continue anyway - we can verify OTP from the hash
        }

        // Send OTP via Karix
        const karixResult = await sendKarixOTP(cleanedNumber, otp, karixConfig);
        
        if (!karixResult.success) {
          logError('❌ Karix SMS send failed:', karixResult.error);
          return res.status(500).json({ 
            success: false, 
            reason: karixResult.error || 'Failed to send OTP via Karix' 
          });
        }
        
        logInfo('✅ OTP sent via Karix to:', cleanedNumber);
        return res.status(200).json({ 
          success: true, 
          message: 'OTP sent successfully',
          phone: cleanedNumber,
          // Don't return OTP in production - only for testing
          ...(process.env.NODE_ENV !== 'production' ? { otp } : {})
        });
      } catch (error: any) {
        logError('❌ Karix OTP send error:', error);
        return res.status(500).json({ 
          success: false, 
          reason: error.message || 'Failed to send OTP' 
        });
      }
    }

    // KARIX OTP - Verify OTP (uses Supabase verification)
    if (action === 'verify-otp-karix') {
      const { phoneNumber, otp } = req.body;
      
      if (!phoneNumber || !otp) {
        return res.status(400).json({ 
          success: false, 
          reason: 'Phone number and OTP are required.' 
        });
      }

      try {
        const supabase = getSupabaseAdminClient();
        
        // Format phone number
        let cleanedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        if (!cleanedNumber.startsWith('+')) {
          cleanedNumber = cleanedNumber.replace(/^(0|91)/, '');
          cleanedNumber = `+91${cleanedNumber}`;
        }

        // Verify OTP using Supabase
        const { data, error } = await supabase.auth.verifyOtp({
          phone: cleanedNumber,
          token: otp,
          type: 'sms',
        });

        if (error) {
          logError('❌ OTP verification failed:', error.message);
          return res.status(400).json({ 
            success: false, 
            reason: error.message || 'Invalid OTP' 
          });
        }

        if (!data.user) {
          return res.status(400).json({ 
            success: false, 
            reason: 'OTP verification failed' 
          });
        }

        // Get or create user in our database
        const userEmail = data.user.email || `${cleanedNumber.replace('+', '')}@phone.reride.co.in`;
        let user = await userService.findByEmail(userEmail);
        
        if (!user) {
          // Create user from phone auth
          const userData: Omit<UserType, 'id'> = {
            email: userEmail,
            name: `User ${cleanedNumber}`,
            mobile: cleanedNumber,
            role: req.body.role || 'customer',
            location: '', // Required field, can be updated later
            authProvider: 'phone',
            status: 'active' as const,
            isVerified: true,
            subscriptionPlan: 'free' as const,
            featuredCredits: 0,
            usedCertifications: 0,
            createdAt: new Date().toISOString()
          };
          user = await userService.create(userData);
        }

        // Generate JWT tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        const normalizedUser = normalizeUser(user);

        return res.status(200).json({ 
          success: true, 
          user: normalizedUser,
          accessToken,
          refreshToken
        });
      } catch (error: any) {
        logError('❌ OTP verification error:', error);
        return res.status(500).json({ 
          success: false, 
          reason: error.message || 'Failed to verify OTP' 
        });
      }
    }

    logWarn('⚠️ POST /api/users: Invalid action received', { action, bodyKeys: Object.keys(req.body || {}) });
    return res.status(400).json({ 
      success: false, 
      reason: `Invalid action: "${action}". Please use one of: login, register, oauth-login, or refresh-token.` 
    });
  }

  // HEAD - Handle browser pre-flight checks
  if (req.method === 'HEAD') {
    // Return 200 OK with no body, same headers as GET would have
    return res.status(200).end();
  }

  // GET - Get users (authenticated)
  if (req.method === 'GET') {
    const { action, email, role } = req.query;
    
    // PUBLIC ACCESS: Allow fetching sellers without authentication (for Dealers page)
    if (role === 'seller' && !action && !email) {
      try {
        logInfo('📊 GET /users?role=seller: Public access - fetching sellers...');
        const sellers = await userService.findByRole('seller');
        logInfo(`✅ Fetched ${sellers.length} sellers from database`);
        
        // SECURITY FIX: Normalize all sellers to remove passwords
        const normalizedSellers = sellers.map(user => {
          const normalized = normalizeUser(user);
          if (!normalized) {
            logWarn(`⚠️ Seller filtered out during normalization:`, { 
              email: user.email, 
              id: user.id, 
              hasId: !!user.id, 
              hasEmail: !!user.email,
              hasRole: !!user.role 
            });
          }
          return normalized;
        }).filter((u): u is NormalizedUser => u !== null);
        
        logInfo(`✅ Returning ${normalizedSellers.length} normalized sellers (${sellers.length - normalizedSellers.length} filtered out)`);
        return res.status(200).json(normalizedSellers);
      } catch (error) {
        logError('❌ Error fetching sellers:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError('❌ Error details:', { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
        // Return empty array on error instead of 500 to prevent page crashes
        return res.status(200).json([]);
      }
    }
    
    // For non-admin requests without auth, return empty array instead of 401
    // This prevents console errors when users aren't logged in
    const authResult = authenticateRequest(req);
    if (!authResult.isValid) {
      // If no auth and not requesting specific action, return empty array gracefully
      if (!action && !email) {
        // Only log in development to avoid information leakage
        if (process.env.NODE_ENV !== 'production') {
          logInfo('📊 GET /users: No authentication, returning empty array');
        }
        return res.status(200).json([]);
      }
      // For specific actions (like trust-score), still require auth
      const auth = requireAuth(req, res, 'GET /users');
      if (!auth) {
        return;
      }
    } else {
      // Auth is valid, continue with normal flow
      const auth = requireAuth(req, res, 'GET /users');
      if (!auth) {
        return;
      }
    }
    
    // Get auth user for the rest of the handler
    const auth = requireAuth(req, res, 'GET /users');
    if (!auth || !auth.user) {
      // This shouldn't happen if we got here, but handle it gracefully
      return res.status(200).json([]);
    }
    const authUser = auth.user;

    if (action === 'trust-score' && email) {
      try {
        // Sanitize and normalize email
        const sanitizedEmail = await sanitizeString(String(email));
        const normalizedEmail = sanitizedEmail.toLowerCase().trim();
        const normalizedAuthEmail = authUser?.email ? authUser.email.toLowerCase().trim() : '';

        if (authUser?.role !== 'admin' && normalizedAuthEmail !== normalizedEmail) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to trust score.' });
        }

        const user = await userService.findByEmail(normalizedEmail);
        if (!user) {
          return res.status(404).json({ success: false, reason: 'User not found' });
        }
        
        const trustScore = calculateTrustScore(user);
        return res.status(200).json({ 
          success: true, 
          trustScore,
          email: user.email,
          name: user.name
        });
      } catch (error) {
        logError('Error fetching trust score:', error);
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to fetch trust score',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    if (authUser?.role !== 'admin') {
      return res.status(403).json({ success: false, reason: 'Forbidden. Admin access required.' });
    }
    
    try {
      logInfo('📊 GET /api/users: Admin request - Fetching all users from Supabase...');
      logInfo('📊 Admin user details:', { 
        email: authUser.email, 
        role: authUser.role, 
        id: authUser.userId 
      });
      
      // Check Supabase availability
      if (!USE_SUPABASE) {
        const errorMsg = getSupabaseErrorMessage();
        logError('❌ Supabase not available for user fetch:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: []
        });
      }
      
      // CRITICAL: Check if SUPABASE_SERVICE_ROLE_KEY is configured
      // This is required for admin operations to bypass RLS
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey || 
          serviceRoleKey.trim() === '' ||
          serviceRoleKey.includes('your_supabase_service_role_key')) {
        const errorMsg = 'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
                        'This is required for fetching users in the admin panel. ' +
                        'Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables (Production). ' +
                        'Get the key from Supabase Dashboard → Settings → API → service_role key. ' +
                        'IMPORTANT: After adding the key, you must redeploy your application for it to take effect.';
        logError('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing for user fetch:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: [],
          diagnostic: 'Service role key is required to bypass RLS policies and fetch users'
        });
      }
      
      // Verify key format (should be a JWT token, typically 100+ characters)
      if (serviceRoleKey.length < 50) {
        logWarn('⚠️ SUPABASE_SERVICE_ROLE_KEY seems too short. Expected 100+ characters. Current length:', serviceRoleKey.length);
        logWarn('   This might indicate the key was not copied completely.');
      }
      
      logInfo('✅ SUPABASE_SERVICE_ROLE_KEY is configured (length: ' + serviceRoleKey.length + ' characters)');
      
      logInfo('✅ SUPABASE_SERVICE_ROLE_KEY is configured, proceeding with user fetch...');
      
      // Test the service role key by attempting to create admin client
      try {
        getSupabaseAdminClient();
        logInfo('✅ Supabase admin client created successfully');
      } catch (clientError: any) {
        const clientErrorMessage = clientError instanceof Error ? clientError.message : String(clientError);
        logError('❌ Failed to create Supabase admin client:', clientErrorMessage);
        return res.status(503).json({
          success: false,
          reason: `Failed to initialize Supabase admin client: ${clientErrorMessage}. ` +
                  'This might indicate the SUPABASE_SERVICE_ROLE_KEY is invalid or malformed. ' +
                  'Please verify the key is correct in Vercel environment variables.',
          users: [],
          diagnostic: 'Service role key validation failed during client initialization'
        });
      }
      
      // CRITICAL: Add direct database query test before using service
      logInfo('🔍 Testing direct database query with admin client...');
      try {
        const testClient = getSupabaseAdminClient();
        const { data: testData, error: testError, count: testCount } = await testClient
          .from('users')
          .select('*', { count: 'exact', head: false })
          .limit(1);
        
        if (testError) {
          logError('❌ Direct query test failed:', {
            message: testError.message,
            details: testError.details,
            hint: testError.hint,
            code: testError.code
          });
        } else {
          logInfo(`✅ Direct query test: Found ${testCount || 0} users in database`);
          if (testData && testData.length > 0) {
            logInfo('📊 Sample row from direct query:', {
              hasId: !!testData[0].id,
              id: testData[0].id,
              hasEmail: !!testData[0].email,
              email: testData[0].email,
              hasRole: !!testData[0].role,
              role: testData[0].role,
              rowKeys: Object.keys(testData[0])
            });
          }
        }
      } catch (testErr) {
        logError('❌ Direct query test exception:', testErr);
      }
      
      const users = await userService.findAll();
      logInfo(`✅ Fetched ${users.length} raw users from Supabase database via userService`);
      
      if (users.length === 0) {
        logWarn('⚠️ Supabase returned 0 users. This might indicate:');
        logWarn('   1. No users exist in the database');
        logWarn('   2. RLS (Row Level Security) policies are blocking access (even with service role key)');
        logWarn('   3. Database connection issue');
        logWarn('   4. Table name mismatch (expected: "users")');
        logWarn('   5. Service role key might not have proper permissions');
        logWarn('   6. SUPABASE_SERVICE_ROLE_KEY might not be configured in Vercel environment variables');
        logWarn('   7. Users might be getting filtered out during conversion');
        
        // CRITICAL: Try a raw count query to verify users exist
        try {
          const countClient = getSupabaseAdminClient();
          const { count, error: countError } = await countClient
            .from('users')
            .select('*', { count: 'exact', head: true });
          
          if (countError) {
            logError('❌ Count query error:', countError);
          } else {
            logInfo(`📊 Raw count query result: ${count || 0} users in database`);
            if (count && count > 0) {
              logWarn('⚠️ Users exist in database but userService.findAll() returned 0!');
              logWarn('   This suggests an issue with the userService.findAll() method or data conversion.');
            }
          }
        } catch (countErr) {
          logError('❌ Count query exception:', countErr);
        }
        
        // Return a warning but still return empty array (not an error)
        return res.status(200).json([]);
      }
      
      // CRITICAL FIX: Log user data structure for debugging
      if (users.length > 0) {
        const sampleUser = users[0];
        logInfo('📊 Sample user structure:', {
          hasId: !!sampleUser.id,
          idType: typeof sampleUser.id,
          idValue: sampleUser.id,
          hasEmail: !!sampleUser.email,
          email: sampleUser.email,
          hasRole: !!sampleUser.role,
          role: sampleUser.role,
          keys: Object.keys(sampleUser)
        });
      }
      
      // SECURITY FIX: Normalize all users to remove passwords
      // CRITICAL FIX: Don't filter out users - fix them instead
      const normalizedUsers = users.map(user => {
        // CRITICAL FIX: If user doesn't have an id, try to generate one from email
        if (!user.id && user.email) {
          const emailKey = user.email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
          logWarn(`⚠️ User missing id, generating from email:`, { email: user.email, generatedId: emailKey });
          user.id = emailKey;
        }
        
        const normalized = normalizeUser(user);
        if (!normalized) {
          logWarn(`⚠️ User filtered out during normalization:`, { 
            email: user.email, 
            id: user.id, 
            hasId: !!user.id, 
            hasEmail: !!user.email,
            hasRole: !!user.role,
            roleValue: user.role,
            fullUser: JSON.stringify(user).substring(0, 200) // First 200 chars for debugging
          });
        }
        return normalized;
      }).filter((u): u is NormalizedUser => u !== null);
      
      const filteredCount = users.length - normalizedUsers.length;
      if (filteredCount > 0) {
        logWarn(`⚠️ ${filteredCount} users were filtered out during normalization`);
        logWarn(`   Original count: ${users.length}, Normalized count: ${normalizedUsers.length}`);
      }
      
      logInfo(`✅ Returning ${normalizedUsers.length} normalized users to admin panel (from ${users.length} raw users)`);
      return res.status(200).json(normalizedUsers);
    } catch (error) {
      logError('❌ Error fetching users from Supabase:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Check for service role key errors specifically
      if (errorMessage.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        const errorMsg = 'SUPABASE_SERVICE_ROLE_KEY is not configured or invalid. ' +
                        'This is required for fetching users in the admin panel. ' +
                        'Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables (Production). ' +
                        'Get the key from Supabase Dashboard → Settings → API → service_role key. ' +
                        'After setting, redeploy your application.';
        logError('❌ CRITICAL: Service role key error:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: [],
          diagnostic: 'Service role key is required to bypass RLS policies and fetch users',
          error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
        });
      }
      
      // Check for RLS policy errors
      if (errorMessage.includes('permission denied') || 
          errorMessage.includes('row-level security') || 
          errorMessage.includes('RLS') ||
          errorMessage.includes('42501')) {
        const errorMsg = 'Row Level Security (RLS) policy is blocking access to users table. ' +
                        'Even with service role key, RLS policies might be misconfigured. ' +
                        'Check your Supabase RLS policies for the users table. ' +
                        'Service role key should bypass RLS, but verify the key is correct.';
        logError('❌ RLS Policy Error:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: [],
          diagnostic: 'RLS policy blocking access - verify service role key and RLS policies',
          error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
        });
      }
      
      // Check for database connection errors
      if (errorMessage.includes('connection') || 
          errorMessage.includes('timeout') ||
          errorMessage.includes('network') ||
          errorMessage.includes('ECONNREFUSED')) {
        const errorMsg = 'Database connection error. Unable to connect to Supabase. ' +
                        'Please check your SUPABASE_URL and network connectivity.';
        logError('❌ Database Connection Error:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: [],
          diagnostic: 'Database connection failed - check SUPABASE_URL and network',
          error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
        });
      }
      
      logError('❌ Error details:', { 
        message: errorMessage, 
        stack: errorStack,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      
      // Return error details in development, but still return empty array to prevent crashes
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (isDevelopment) {
        return res.status(500).json({
          success: false,
          reason: `Failed to fetch users: ${errorMessage}`,
          error: errorMessage,
          users: [],
          debug: {
            stack: errorStack,
            supabaseAvailable: USE_SUPABASE
          }
        });
      }
      
      // In production, return empty array gracefully but log the error
      res.setHeader('X-Data-Fallback', 'true');
      res.setHeader('X-Error', 'true');
      return res.status(200).json([]);
    }
  }

  // PUT - Update user
  if (req.method === 'PUT') {
    // SECURITY FIX: Verify Auth
    const auth = authenticateRequest(req);
    if (!auth.isValid) {
      logWarn('⚠️ PUT /users - Authentication failed:', auth.error);
      return res.status(401).json({ 
        success: false, 
        reason: auth.error || 'Authentication failed. Please log in again.',
        error: 'Invalid or expired authentication token'
      });
    }
    try {
      // Supabase connection is handled automatically
      const { email, ...updateData } = req.body;
      
      // SECURITY FIX: Authorization Check
      // Only allow updates if user is admin or updating their own profile
      // Normalize emails for comparison (critical for production)
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      const normalizedRequestEmail = email ? String(email).toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedAuthEmail !== normalizedRequestEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You can only update your own profile.' });
      }
      
      if (!email) {
        return res.status(400).json({ success: false, reason: 'Email is required for update.' });
      }

      // Only log in development to avoid information leakage
      logInfo('🔄 PUT /users - Updating user:', { email, hasPassword: !!updateData.password, fields: Object.keys(updateData) });

      // Separate null values (to be unset) from regular updates
      const updateFields: Record<string, unknown> = {};
      const unsetFields: Record<string, unknown> = {};
      
      // Handle password update separately - it needs to be hashed
      // CRITICAL: Store plain text password before hashing for Supabase Auth sync
      let plainTextPassword: string | null = null;
      
      if (updateData.password !== undefined && updateData.password !== null) {
        try {
          // Validate password is a string
          if (typeof updateData.password !== 'string' || updateData.password.trim().length === 0) {
            return res.status(400).json({ 
              success: false, 
              reason: 'Password must be a non-empty string.' 
            });
          }

          // Check if password is already hashed (bcrypt hashes start with $2)
          // If not hashed, hash it before updating
          const isAlreadyHashed = updateData.password.startsWith('$2');
          
          if (isAlreadyHashed) {
            // Password is already hashed (edge case - for backward compatibility)
            updateFields.password = updateData.password;
            // Only log in development to avoid information leakage
            if (process.env.NODE_ENV !== 'production') {
              logInfo('🔐 Password already hashed, using as-is');
            }
            // Cannot sync to Supabase Auth if password is already hashed
            plainTextPassword = null;
          } else {
            // Store plain text password for Supabase Auth sync (before hashing)
            plainTextPassword = updateData.password;
            
            // Hash the plain text password before updating users table
            // Only log in development to avoid information leakage
            if (process.env.NODE_ENV !== 'production') {
              logInfo('🔐 Hashing password...');
            }
            updateFields.password = await hashPassword(updateData.password);
            // Never log password hashing success in production
            if (process.env.NODE_ENV !== 'production') {
              logInfo('✅ Password hashed successfully');
            }
          }
        } catch (hashError) {
          // Only log errors in development to avoid information leakage
          if (process.env.NODE_ENV !== 'production') {
            logError('❌ Error hashing password:', hashError);
          }
          const errorMessage = hashError instanceof Error ? hashError.message : 'Unknown error';
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to process password update. Please try again.',
            error: errorMessage
          });
        }
      }
      
      // Process other fields
      Object.keys(updateData).forEach(key => {
        // Skip password as it's already handled above
        if (key === 'password') {
          return;
        }
        
        if (updateData[key] === null) {
          unsetFields[key] = '';
        } else if (updateData[key] !== undefined) {
          updateFields[key] = updateData[key];
        }
      });
      
      // CRITICAL: Sync verificationStatus with individual verification fields
      // If verificationStatus is being updated, also update individual fields
      if (updateFields.verificationStatus && typeof updateFields.verificationStatus === 'object') {
        const verificationStatus = updateFields.verificationStatus as Record<string, unknown>;
        
        // Sync phoneVerified
        if (verificationStatus.phoneVerified !== undefined && typeof verificationStatus.phoneVerified === 'boolean') {
          updateFields.phoneVerified = verificationStatus.phoneVerified;
        }
        
        // Sync emailVerified
        if (verificationStatus.emailVerified !== undefined && typeof verificationStatus.emailVerified === 'boolean') {
          updateFields.emailVerified = verificationStatus.emailVerified;
        }
        
        // Sync govtIdVerified
        if (verificationStatus.govtIdVerified !== undefined && typeof verificationStatus.govtIdVerified === 'boolean') {
          updateFields.govtIdVerified = verificationStatus.govtIdVerified;
        }
      }
      
      // Also sync in reverse: if individual fields are updated, update verificationStatus
      if (!updateFields.verificationStatus) {
        updateFields.verificationStatus = {} as Partial<VerificationStatus>;
      }
      
      const verificationStatus = updateFields.verificationStatus as Partial<VerificationStatus>;
      if (updateFields.phoneVerified !== undefined && updateFields.phoneVerified !== null && typeof updateFields.phoneVerified === 'boolean') {
        verificationStatus.phoneVerified = updateFields.phoneVerified;
      }
      if (updateFields.emailVerified !== undefined && updateFields.emailVerified !== null && typeof updateFields.emailVerified === 'boolean') {
        verificationStatus.emailVerified = updateFields.emailVerified;
      }
      if (updateFields.govtIdVerified !== undefined && updateFields.govtIdVerified !== null && typeof updateFields.govtIdVerified === 'boolean') {
        verificationStatus.govtIdVerified = updateFields.govtIdVerified;
      }

      // Build update object for Supabase
      const supabaseUpdates: Record<string, unknown> = {};
      
      // Add fields to update
      Object.keys(updateFields).forEach(key => {
        supabaseUpdates[key] = updateFields[key];
      });
      
      // For unset fields, set to null (Supabase will handle null values)
      Object.keys(unsetFields).forEach(key => {
        supabaseUpdates[key] = null;
      });

      // Only proceed with update if there are fields to update
      if (Object.keys(supabaseUpdates).length === 0) {
        return res.status(400).json({ success: false, reason: 'No fields to update.' });
      }

      logInfo('💾 Updating user in Supabase...', { 
        email, 
        hasPasswordUpdate: !!updateFields.password,
        updateFields: Object.keys(supabaseUpdates)
      });

      // Sanitize and normalize email
      const sanitizedEmail = await sanitizeString(String(email));
      const normalizedEmail = sanitizedEmail.toLowerCase().trim();
      
      let existingUser: UserType | null;
      try {
        existingUser = await userService.findByEmail(normalizedEmail);
      } catch (findError) {
        logError('❌ Error finding user:', findError);
        const errorMessage = findError instanceof Error ? findError.message : 'Unknown error';
        return res.status(500).json({ 
          success: false, 
          reason: `Database error while finding user: ${errorMessage}`,
          error: 'Database connection error'
        });
      }
      
      if (!existingUser) {
        logWarn('⚠️ User not found:', email);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      logInfo('📝 Found user, applying update operation...');
      
      // Update user in Supabase
      try {
        await userService.update(normalizedEmail, supabaseUpdates);
        logInfo('✅ User update operation completed in Supabase');
        
        // Fetch updated user
        let updatedUser: UserType | null;
        try {
          updatedUser = await userService.findByEmail(normalizedEmail);
        } catch (fetchError) {
          logError('❌ Error fetching updated user:', fetchError);
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          return res.status(500).json({ 
            success: false, 
            reason: `Database error while fetching updated user: ${errorMessage}`,
            error: 'Database connection error'
          });
        }
        
        if (!updatedUser) {
          logError('❌ Failed to fetch updated user after update');
          return res.status(500).json({ 
            success: false, 
            reason: 'User update completed but failed to verify. Please refresh and try again.',
            error: 'Verification error'
          });
        }

        logInfo('✅ User updated successfully:', updatedUser.email);

        // CRITICAL FIX: Sync password update with Supabase Auth
        // When password is updated in users table, also update Supabase Auth password
        // This must be done BEFORE updating the users table to ensure both are in sync
        if (plainTextPassword) {
          try {
            const supabaseAdmin = getSupabaseAdminClient();
            
            // Get the user's auth ID from Supabase Auth by email
            // Use listUsers with pagination to find the user efficiently
            const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            
            if (listError) {
              logWarn('⚠️ Could not list auth users to sync password:', listError.message);
            } else {
              // Find the auth user by email (case-insensitive)
              const authUser = authUsers.users.find(u => 
                u.email?.toLowerCase().trim() === normalizedEmail
              );
              
              if (authUser) {
                // Update password in Supabase Auth (use plain text password)
                // Supabase Auth will hash it with its own algorithm
                const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
                  authUser.id,
                  { password: plainTextPassword }
                );
                
                if (authUpdateError) {
                  logWarn('⚠️ Failed to update Supabase Auth password:', authUpdateError.message);
                  // Don't fail the entire update - users table password was updated successfully
                } else {
                  logInfo('✅ Password synced to Supabase Auth successfully');
                }
              } else {
                logWarn('⚠️ Auth user not found for email (user may not have Supabase Auth account):', normalizedEmail);
                // This is OK - user might only exist in users table (legacy users)
              }
            }
          } catch (authSyncError) {
            logWarn('⚠️ Error syncing password to Supabase Auth:', authSyncError);
            // Don't fail the entire update - users table password was updated successfully
          }
        } else if (updateFields.password) {
          logWarn('⚠️ Password was updated but plain text not available for Supabase Auth sync (password was already hashed)');
        }

        // SYNC VEHICLE EXPIRY DATES when planExpiryDate is updated
        if (updateFields.planExpiryDate !== undefined || unsetFields.planExpiryDate !== undefined) {
          try {
            const normalizedEmail = email.toLowerCase().trim();
            const newPlanExpiryDate = updateFields.planExpiryDate || null;
            
            // PERFORMANCE FIX: Use findBySellerEmail instead of fetching all vehicles
            // This uses the idx_vehicles_seller_email index for fast lookup
            const allSellerVehicles = await vehicleService.findBySellerEmail(normalizedEmail);
            const sellerVehicles = allSellerVehicles.filter(v => v.status === 'published');
            
            if (sellerVehicles.length > 0) {
              const now = new Date();
              
              for (const vehicle of sellerVehicles) {
                const vehicleUpdateFields: Record<string, unknown> = {};
                
                if (updatedUser.subscriptionPlan === 'premium') {
                  if (newPlanExpiryDate && (typeof newPlanExpiryDate === 'string' || newPlanExpiryDate instanceof Date)) {
                    // Premium plan with expiry: set vehicle expiry to plan expiry
                    const expiryDate = typeof newPlanExpiryDate === 'string' ? new Date(newPlanExpiryDate) : newPlanExpiryDate;
                    vehicleUpdateFields.listingExpiresAt = expiryDate.toISOString();
                    
                    // If vehicle was expired but plan is now extended, reactivate it
                    if (vehicle.listingExpiresAt && new Date(vehicle.listingExpiresAt) < now && expiryDate >= now) {
                      vehicleUpdateFields.listingStatus = 'active';
                      vehicleUpdateFields.status = 'published';
                    }
                  } else {
                    // Premium plan without expiry: remove vehicle expiry
                    vehicleUpdateFields.listingExpiresAt = null;
                    vehicleUpdateFields.listingStatus = 'active';
                    // Ensure status is published
                    if (vehicle.status !== 'published') {
                      vehicleUpdateFields.status = 'published';
                    }
                  }
                } else {
                  // Free/Pro plans: set 30-day expiry from today
                  const expiryDate = new Date();
                  expiryDate.setDate(expiryDate.getDate() + 30);
                  vehicleUpdateFields.listingExpiresAt = expiryDate.toISOString();
                  
                  // Reactivate if was expired
                  if (vehicle.listingExpiresAt && new Date(vehicle.listingExpiresAt) < now) {
                    vehicleUpdateFields.listingStatus = 'active';
                    vehicleUpdateFields.status = 'published';
                  }
                }
                
                if (Object.keys(vehicleUpdateFields).length > 0) {
                  await vehicleService.update(vehicle.id, vehicleUpdateFields);
                }
              }
              
              logInfo(`✅ Synced ${sellerVehicles.length} vehicle expiry dates for seller ${normalizedEmail}`);
            }
          } catch (syncError) {
            logError('⚠️ Error syncing vehicle expiry dates:', syncError);
            // Don't fail the user update if vehicle sync fails
          }
        }

        // Verify the update by querying again
        const verifyEmail = await sanitizeString(String(email));
        const verifyUser = await userService.findByEmail(verifyEmail.toLowerCase().trim());
        if (!verifyUser) {
          logWarn('⚠️ User update verification failed - user not found after update');
        } else {
          logInfo('✅ User update verified in database');
        }

        // Remove password from response for security
        const { password: _, ...userWithoutPassword } = updatedUser;
        
        // CRITICAL FIX: Signal to frontend that password was updated so it can clear cache
        if (updateFields.password) {
          res.setHeader('X-Password-Updated', 'true');
          logInfo('🔐 Password update completed - frontend should clear cache');
        }
        
        return res.status(200).json({ success: true, user: userWithoutPassword });
      } catch (dbError) {
        logError('❌ Database error during user update:', dbError);
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        
        // Provide more specific error messages based on error type
        let userFriendlyReason = 'Database error occurred. Please try again later.';
        
        if (errorMessage.includes('permission') || errorMessage.includes('Permission denied')) {
          userFriendlyReason = 'Permission denied. Please check your authentication and try again.';
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          userFriendlyReason = 'Database connection error. Please check your internet connection and try again.';
        } else if (errorMessage.includes('timeout')) {
          userFriendlyReason = 'Request timed out. Please try again.';
        } else if (updateFields.password) {
          // Password-specific error
          userFriendlyReason = 'Failed to update password. Please try again or contact support if the issue persists.';
        }
        
        return res.status(500).json({ 
          success: false, 
          reason: userFriendlyReason,
          error: errorMessage
        });
      }
    } catch (putError) {
      logError('❌ Error in PUT handler:', putError);
      return res.status(500).json({
        success: false,
        reason: 'Failed to update user',
        error: putError instanceof Error ? putError.message : 'Unknown error'
      });
    }
  }

  // DELETE - Delete user
  if (req.method === 'DELETE') {
    // SECURITY FIX: Verify Auth
    const auth = authenticateRequest(req);
    if (!auth.isValid) {
      return res.status(401).json({ success: false, reason: auth.error });
    }
    try {
      const { email } = req.body;
      
      // SECURITY FIX: Authorization Check
      // Normalize emails for comparison (critical for production)
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      const normalizedRequestEmail = email ? String(email).toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedAuthEmail !== normalizedRequestEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized action.' });
      }
      
      if (!email) {
        return res.status(400).json({ success: false, reason: 'Email is required for deletion.' });
      }

      // Sanitize email
      const sanitizedEmail = await sanitizeString(String(email));
      const normalizedEmail = sanitizedEmail.toLowerCase().trim();
      logInfo('🔄 DELETE /users - Deleting user:', normalizedEmail);

      // Check if user exists
      const existingUser = await userService.findByEmail(normalizedEmail);
      if (!existingUser) {
        logWarn('⚠️ User not found for deletion:', normalizedEmail);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      // Delete user from Supabase users table
      await userService.delete(normalizedEmail);
      logInfo('✅ User deleted successfully from Supabase users table:', normalizedEmail);

      // CRITICAL FIX: Also delete user from Supabase Auth
      try {
        const supabaseAdmin = getSupabaseAdminClient();
        
        // Get the user's auth ID from Supabase Auth by email
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          logWarn('⚠️ Could not list auth users to delete:', listError.message);
        } else {
          // Find the auth user by email
          const authUser = authUsers.users.find(u => 
            u.email?.toLowerCase().trim() === normalizedEmail
          );
          
          if (authUser) {
            // Delete user from Supabase Auth
            const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
              authUser.id
            );
            
            if (authDeleteError) {
              logWarn('⚠️ Failed to delete user from Supabase Auth:', authDeleteError.message);
              // Don't fail the entire deletion - users table record was deleted successfully
            } else {
              logInfo('✅ User deleted from Supabase Auth successfully');
            }
          } else {
            logWarn('⚠️ Auth user not found for email (may have been deleted already):', normalizedEmail);
          }
        }
      } catch (authDeleteError) {
        logWarn('⚠️ Error deleting user from Supabase Auth:', authDeleteError);
        // Don't fail the entire deletion - users table record was deleted successfully
      }

      // Verify the user was deleted by querying it
      const verifyUser = await userService.findByEmail(normalizedEmail);
      if (verifyUser) {
        logError('❌ User deletion verification failed - user still exists in database');
      } else {
        logInfo('✅ User deletion verified in database');
      }

      return res.status(200).json({ success: true, message: 'User deleted successfully.' });
    } catch (error) {
      logError('❌ Error deleting user:', error);
      return res.status(500).json({
        success: false,
        reason: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

    return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    // Extract detailed error information for better debugging
    const errorDetails = error instanceof Error 
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
          ...(error as any)
        }
      : typeof error === 'object' && error !== null
      ? error
      : { value: error };
    logError('❌ Error in handleUsers:', errorDetails);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // For GET requests, always use fallback instead of 500 to prevent crashes
    if (req.method === 'GET') {
      try {
        const fallbackUsers = await getFallbackUsers();
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(fallbackUsers);
      } catch (fallbackError) {
        logError('❌ Fallback users also failed:', fallbackError);
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json([]);
      }
    }
    
    // Check for Supabase database errors
    const isDbError = error instanceof Error && (
      error.message.includes('Supabase') ||
      error.message.includes('supabase') ||
      error.message.includes('database') && error.message.includes('unavailable')
    );
    
    if (isDbError) {
      console.error('❌ Database connection error detected:', error instanceof Error ? error.message : 'Unknown error');
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true,
        error: error instanceof Error ? error.message : 'Database connection error'
      });
    }
    
    // For authentication/authorization errors (user auth, NOT database auth), return 401 instead of 500
    // Only check for user authentication errors if it's NOT a database error
    // IMPORTANT: Only return 401 if it's clearly a USER authentication error (JWT tokens, login sessions)
    // NOT database authentication errors (those are already handled above as 503)
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      // Check for user authentication errors (JWT tokens, login sessions, Bearer tokens)
      // These are distinct from database authentication errors
      const isUserAuthError = 
        errorMsg.includes('jwt') || 
        errorMsg.includes('token') || 
        errorMsg.includes('bearer') ||
        errorMsg.includes('login') ||
        errorMsg.includes('session') ||
        errorMsg.includes('unauthorized') ||
        (errorMsg.includes('authentication') && (
          errorMsg.includes('user') ||
          errorMsg.includes('invalid') ||
          errorMsg.includes('expired')
        ));
      
      // Only return 401 if it's clearly a user auth error
      // If it contains "authentication" but doesn't match user auth patterns, treat as 500 (safer)
      if (isUserAuthError && !errorMsg.includes('firebase') && !errorMsg.includes('database') && !errorMsg.includes('connection')) {
        return res.status(401).json({
          success: false,
          reason: 'Authentication failed. Please log in again.',
          error: error.message
        });
      }
    }
    
    // For other errors on non-GET requests, return 500 with error details
    // But log the full error for debugging
    console.error('❌ Unexpected error in handleUsers:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      url: req.url
    });
    
    return res.status(500).json({
      success: false,
      reason: 'An error occurred while processing the request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Vehicles handler - preserves exact functionality from vehicles.ts
async function handleVehicles(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  try {
    // FIX: Handle HEAD requests immediately to prevent 405 errors
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', '0');
      return res.status(200).end();
    }

    // Check Firebase availability
    if (!USE_SUPABASE) {
      const errorMsg = getSupabaseErrorMessage();
      logWarn('⚠️ Firebase not available:', errorMsg);
      return res.status(503).json({
        success: false,
        reason: errorMsg,
        details: 'Please check your Firebase configuration. Server-side requires FIREBASE_* environment variables (without VITE_ prefix).',
        fallback: true
      });
    }

    // Check action type from query parameter
    const { type, action } = req.query;

  // VEHICLE DATA ENDPOINTS (brands, models, variants)
  if (type === 'data') {
    // Ensure JSON content type
    res.setHeader('Content-Type', 'application/json');
    
    // Default vehicle data (fallback)
    const defaultData = {
      FOUR_WHEELER: [
        {
          name: "Maruti Suzuki",
          models: [
            { name: "Swift", variants: ["LXi", "VXi", "VXi (O)", "ZXi", "ZXi+"] },
            { name: "Baleno", variants: ["Sigma", "Delta", "Zeta", "Alpha"] },
            { name: "Dzire", variants: ["LXi", "VXi", "ZXi", "ZXi+"] }
          ]
        },
        {
          name: "Hyundai",
          models: [
            { name: "i20", variants: ["Magna", "Sportz", "Asta", "Asta (O)"] },
            { name: "Verna", variants: ["S", "SX", "SX (O)", "SX Turbo"] }
          ]
        },
        {
          name: "Tata",
          models: [
            { name: "Nexon", variants: ["XE", "XM", "XZ+", "XZ+ (O)"] },
            { name: "Safari", variants: ["XE", "XM", "XZ", "XZ+"] }
          ]
        }
      ],
      TWO_WHEELER: [
        {
          name: "Honda",
          models: [
            { name: "Activa 6G", variants: ["Standard", "DLX", "Smart"] },
            { name: "Shine", variants: ["Standard", "SP", "SP (Drum)"] }
          ]
        },
        {
          name: "Bajaj",
          models: [
            { name: "Pulsar 150", variants: ["Standard", "DTS-i", "NS"] },
            { name: "CT 100", variants: ["Standard", "X"] }
          ]
        }
      ]
    };

    try {
      if (req.method === 'GET') {
        try {
          // Try to get vehicle data from Firebase using Admin SDK (bypasses security rules)
          const vehicleData = await adminRead<{ data: typeof defaultData }>(DB_PATHS.VEHICLE_DATA, 'default');
          if (vehicleData && vehicleData.data) {
            return res.status(200).json(vehicleData.data);
          }
          
          // If no data exists, create default using Admin SDK (bypasses security rules)
          await adminCreate(DB_PATHS.VEHICLE_DATA, { data: defaultData }, 'default');
          return res.status(200).json(defaultData);
        } catch (dbError) {
          console.warn('⚠️ Database connection failed for vehicles data, returning default data:', dbError);
          // Return default data as fallback - NEVER return 500
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json(defaultData);
        }
      }

      if (req.method === 'POST') {
        try {
      if (!requireAdmin(req, res, 'Vehicle data update')) {
        return;
      }
          // Save vehicle data to Firebase using Admin SDK (bypasses security rules)
          await adminUpdate(DB_PATHS.VEHICLE_DATA, 'default', {
            data: req.body,
            updatedAt: new Date().toISOString()
          });
          
          console.log('✅ Vehicle data saved successfully to Firebase');
          return res.status(200).json({ 
            success: true, 
            data: req.body,
            message: 'Vehicle data updated successfully',
            timestamp: new Date().toISOString()
          });
        } catch (dbError) {
          console.warn('⚠️ Database connection failed for vehicles data save:', dbError);
          
          // For POST requests, we should still return success but indicate fallback
          // This prevents the sync from failing completely - NEVER return 500
          console.log('📝 Returning success with fallback indication for POST request');
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json({
            success: true,
            data: req.body,
            message: 'Vehicle data processed (database unavailable, using fallback)',
            fallback: true,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      // Ultimate fallback - catch any unexpected errors
      console.error('⚠️ Unexpected error in handleVehicles type=data:', error);
      res.setHeader('X-Data-Fallback', 'true');
      if (req.method === 'GET') {
        return res.status(200).json(defaultData);
      } else {
        return res.status(200).json({
          success: true,
          data: req.body || {},
          message: 'Vehicle data processed (error occurred, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // VEHICLE CRUD OPERATIONS
  if (req.method === 'GET') {
    try {
      if (action === 'city-stats' && req.query.city) {
        // Sanitize city input
        const sanitizedCity = await sanitizeString(String(req.query.city));
        // PERFORMANCE FIX: Use database-level filtering instead of fetching all vehicles
        const cityVehicles = await vehicleService.findByCityAndStatus(sanitizedCity, 'published');
        const stats = {
          totalVehicles: cityVehicles.length,
          averagePrice: cityVehicles.reduce((sum, v) => sum + (v.price || 0), 0) / (cityVehicles.length || 1),
          popularMakes: getPopularMakes(cityVehicles),
          priceRange: getPriceRange(cityVehicles)
        };
        return res.status(200).json(stats);
      }

      if (action === 'radius-search' && req.query.lat && req.query.lng && req.query.radius) {
        const allVehicles = await vehicleService.findByStatus('published', {
          orderBy: 'created_at',
          orderDirection: 'desc'
        });
        const nearbyVehicles = allVehicles.filter(vehicle => {
          if (!vehicle.exactLocation?.lat || !vehicle.exactLocation?.lng) return false;
          const distance = calculateDistance(
            parseFloat(req.query.lat as string),
            parseFloat(req.query.lng as string),
            vehicle.exactLocation.lat,
            vehicle.exactLocation.lng
          );
          return distance <= parseFloat(req.query.radius as string);
        });
        return res.status(200).json(nearbyVehicles);
      }

      // ADMIN ENDPOINT: Return all vehicles including unpublished/sold (requires admin auth)
      if (action === 'admin-all') {
        // SECURITY: Verify Auth and Admin Role
        const adminAuth = authenticateRequest(req);
        if (!adminAuth.isValid) {
          console.error('❌ Admin vehicles request failed: Authentication required');
          return res.status(401).json({ success: false, reason: adminAuth.error });
        }
        if (adminAuth.user?.role !== 'admin') {
          console.error('❌ Admin vehicles request failed: Admin role required', { role: adminAuth.user?.role });
          return res.status(403).json({ 
            success: false, 
            reason: 'Forbidden. Admin access required to view all vehicles.' 
          });
        }
        
        try {
          // PERFORMANCE FIX: Use COUNT queries for status breakdown instead of fetching all
          const [publishedCount, unpublishedCount, soldCount] = await Promise.all([
            vehicleService.countByStatus('published'),
            vehicleService.countByStatus('unpublished'),
            vehicleService.countByStatus('sold')
          ]);
          const totalCount = publishedCount + unpublishedCount + soldCount;
          const statusCounts = {
            published: publishedCount,
            unpublished: unpublishedCount,
            sold: soldCount,
            total: totalCount
          };
          console.log(`🔍 ADMIN: Vehicle status breakdown:`, statusCounts);
          
          // Fetch all vehicles for admin view (admin endpoints need full data)
          const allVehicles = await vehicleService.findAll();
          console.log(`📊 ADMIN: Returning ${allVehicles.length} total vehicles (all statuses)`);
          
          // Sort by createdAt descending
          const sortedVehicles = allVehicles.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
          
          return res.status(200).json(sortedVehicles);
        } catch (error) {
          console.error('❌ Error fetching all vehicles for admin:', error);
          return res.status(500).json({
            success: false,
            reason: 'Failed to fetch all vehicles',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // DEBUG ENDPOINT: Return all vehicles including unpublished (for testing)
      if (action === 'debug-all') {
        const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
        if (isProduction) {
          return res.status(403).json({ success: false, reason: 'Debug endpoint disabled in production' });
        }
        const adminAuth = requireAdmin(req, res, 'Debug vehicles');
        if (!adminAuth) {
          return;
        }
        // PERFORMANCE FIX: Use COUNT queries for status breakdown instead of fetching all first
        const [publishedCount, unpublishedCount, soldCount] = await Promise.all([
          vehicleService.countByStatus('published'),
          vehicleService.countByStatus('unpublished'),
          vehicleService.countByStatus('sold')
        ]);
        const totalCount = publishedCount + unpublishedCount + soldCount;
        const statusCounts = {
          published: publishedCount,
          unpublished: unpublishedCount,
          sold: soldCount,
          total: totalCount
        };
        console.log(`🔍 DEBUG: Vehicle status breakdown:`, statusCounts);
        
        // Fetch all vehicles for debug view (debug endpoints need full data)
        const allVehicles = await vehicleService.findAll();
        return res.status(200).json({
          total: allVehicles.length,
          statusCounts,
          vehicles: allVehicles
        });
      }

      // PERFORMANCE OPTIMIZATION: Check cache first, then query only published vehicles
      // This dramatically reduces the amount of data fetched and processed
      cleanupVehicleCache();
      const cacheKey = 'published_vehicles';
      const cached = vehicleCache.get(cacheKey);
      
      // PAGINATION SUPPORT: Parse pagination parameters early
      // Default to pagination (50 per page) for better performance
      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = parseInt(String(req.query.limit || '50'), 10) || 50; // Default 50, 0 means no limit (return all)
      const skipExpiryCheck = req.query.skipExpiryCheck === 'true'; // Skip expensive expiry checks for fast initial load
      
      let vehicles: VehicleType[];
      let totalVehiclesCount: number = 0;
      
      if (cached && (Date.now() - cached.timestamp) < VEHICLE_CACHE_TTL && limit === 0) {
        // Use cache only for non-paginated requests (cache contains full list)
        console.log(`📊 Using cached published vehicles (${cached.vehicles.length} vehicles)`);
        vehicles = cached.vehicles;
        totalVehiclesCount = vehicles.length;
      } else {
        // PERFORMANCE: Use database-level sorting and pagination (much faster)
        if (limit > 0) {
          // For paginated requests, fetch only the paginated subset
          const offset = (page - 1) * limit;
          vehicles = await vehicleService.findByStatus('published', {
            orderBy: 'created_at',
            orderDirection: 'desc',
            limit: limit,
            offset: offset
          });
          
          // Get total count from cache if available, otherwise use COUNT query (much faster)
          const cachedCount = cached?.totalCount;
          if (cachedCount !== undefined) {
            totalVehiclesCount = cachedCount;
            console.log(`📊 Using cached total count: ${totalVehiclesCount}`);
          } else {
            // Use COUNT query instead of fetching all vehicles (dramatically faster)
            try {
              totalVehiclesCount = await vehicleService.countByStatus('published');
              // Update cache with total count
              if (cached) {
                cached.totalCount = totalVehiclesCount;
              } else {
                vehicleCache.set(cacheKey, { vehicles: [], timestamp: Date.now(), totalCount: totalVehiclesCount });
              }
              console.log(`📊 Fetched total count using COUNT query: ${totalVehiclesCount}`);
            } catch (countError) {
              // Fallback to old method if COUNT query fails
              console.warn('⚠️ COUNT query failed, falling back to fetch-all method:', countError);
              const allVehiclesForCount = await vehicleService.findByStatus('published', {
                orderBy: 'created_at',
                orderDirection: 'desc'
              });
              totalVehiclesCount = allVehiclesForCount.length;
              if (cached) {
                cached.totalCount = totalVehiclesCount;
              } else {
                vehicleCache.set(cacheKey, { vehicles: [], timestamp: Date.now(), totalCount: totalVehiclesCount });
              }
              console.log(`📊 Fetched and cached total count (fallback): ${totalVehiclesCount}`);
            }
          }
          
          console.log(`📊 Published vehicles fetched (paginated): ${vehicles.length} of ${totalVehiclesCount} total`);
        } else {
          // For non-paginated requests (limit=0), fetch all with database sorting
          // Skip extra COUNT query for fast full-list fetches used by initial client hydration.
          vehicles = await vehicleService.findByStatus('published', {
            orderBy: 'created_at',
            orderDirection: 'desc'
          });
          if (skipExpiryCheck) {
            totalVehiclesCount = vehicles.length;
            console.log(`📊 Published vehicles fetched (fast path): ${vehicles.length}`);
          } else {
            // Use COUNT query for total count instead of vehicles.length
            try {
              totalVehiclesCount = await vehicleService.countByStatus('published');
              console.log(`📊 Published vehicles fetched: ${vehicles.length} (total: ${totalVehiclesCount})`);
            } catch (countError) {
              totalVehiclesCount = vehicles.length;
              console.log(`📊 Published vehicles fetched: ${vehicles.length} (count query failed, using length)`);
            }
          }
          
          // DIAGNOSTIC: Log if no vehicles found
          if (vehicles.length === 0) {
            console.warn('⚠️ No published vehicles found in database. Checking all vehicles...');
            try {
              // PERFORMANCE FIX: Use COUNT queries instead of fetching all vehicles
              const [publishedCount, unpublishedCount, soldCount] = await Promise.all([
                vehicleService.countByStatus('published'),
                vehicleService.countByStatus('unpublished'),
                vehicleService.countByStatus('sold')
              ]);
              const totalCount = publishedCount + unpublishedCount + soldCount;
              const statusBreakdown = {
                published: publishedCount,
                unpublished: unpublishedCount,
                sold: soldCount,
                total: totalCount
              };
              console.warn('⚠️ Vehicle status breakdown:', statusBreakdown);
              
              // If there are vehicles but none published, log a warning
              if (totalCount > 0 && statusBreakdown.published === 0) {
                console.warn('⚠️ Database has vehicles but none are published. Consider publishing some vehicles.');
              } else if (totalCount === 0) {
                console.warn('⚠️ Database is empty. No vehicles found at all.');
              }
            } catch (diagError) {
              console.error('❌ Failed to run diagnostic query:', diagError);
            }
          }
          
          // Cache the full result with total count for non-paginated requests
          vehicleCache.set(cacheKey, { vehicles, timestamp: Date.now(), totalCount: totalVehiclesCount });
        }
      }
      
      // Only sort in-memory if we got cached data (database already sorted new queries)
      if (cached && vehicles === cached.vehicles) {
        vehicles = vehicles.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      }
      
      // PERFORMANCE: Skip expensive seller expiry checks for fast initial loads
      // These checks can be done in background or on-demand
      let sellerMap = new Map<string, UserType>();
      let vehicleUpdates: Array<{ id: number; updates: Partial<VehicleType> }> = [];
      
      if (!skipExpiryCheck) {
        // Only do expiry checks if explicitly requested (not for initial fast load)
        const now = new Date();
        const sellerEmails = new Set<string>();
        
        // Only collect seller emails for vehicles that need expiry checks
        vehicles.forEach(vehicle => {
          if (!vehicle.listingExpiresAt && vehicle.sellerEmail) {
            sellerEmails.add(vehicle.sellerEmail.toLowerCase());
          }
        });
        
        // PERFORMANCE OPTIMIZATION: Batch fetch all sellers in a single query (much faster)
        if (sellerEmails.size > 0) {
          try {
          // Use batch fetch method if available (much faster than individual queries)
          const sellerEmailArray = Array.from(sellerEmails);
          const sellers = await userService.findByEmails(sellerEmailArray);
          
          // Build seller map from batch-fetched users
          sellers.forEach(seller => {
            if (seller && seller.email) {
              const normalizedEmail = seller.email.toLowerCase().trim();
              sellerMap.set(normalizedEmail, seller);
            }
          });
          
          console.log(`📊 Batch fetched ${sellerMap.size} sellers for expiry checks (out of ${sellerEmails.size} needed)`);
        } catch (batchError) {
          // Fallback to individual fetches if batch fails
          console.warn('⚠️ Batch user fetch failed, falling back to individual queries:', batchError);
          const sellerEmailArray = Array.from(sellerEmails);
          const userPromises = sellerEmailArray.map(async (email) => {
            try {
              return await userService.findByEmail(email);
            } catch (err) {
              console.warn(`⚠️ Failed to fetch user ${email}:`, err);
              return null;
            }
          });
          
          const results = await Promise.allSettled(userPromises);
          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              const seller = result.value;
              if (seller && seller.email) {
                const normalizedEmail = seller.email.toLowerCase().trim();
                sellerMap.set(normalizedEmail, seller);
              }
            }
          });
          
          console.log(`📊 Fetched ${sellerMap.size} sellers (fallback method)`);
          }
        }
        
        // Process expiry checks only if not skipped
        vehicles.forEach(vehicle => {
        const updateFields: Record<string, any> = {};
        
        if (!vehicle.listingExpiresAt && vehicle.status === 'published' && vehicle.sellerEmail) {
          const seller = sellerMap.get(vehicle.sellerEmail.toLowerCase());
          if (seller) {
            // If seller's plan has expired, force-unpublish even if listingExpiresAt is not set
            if (seller.planExpiryDate) {
              const sellerExpiry = new Date(seller.planExpiryDate);
              if (!isNaN(sellerExpiry.getTime()) && sellerExpiry < now) {
                updateFields.status = 'unpublished';
                updateFields.listingStatus = 'expired';
              }
            }
            
            // Set listing expiry based on plan
            if (seller.subscriptionPlan === 'premium' && seller.planExpiryDate) {
              updateFields.listingExpiresAt = seller.planExpiryDate;
            } else if (seller.subscriptionPlan !== 'premium') {
              const expiryDate = new Date();
              expiryDate.setDate(expiryDate.getDate() + 30);
              updateFields.listingExpiresAt = expiryDate.toISOString();
            }
            // Premium without expiry: leave listingExpiresAt undefined (no expiry)
          }
        }
        
        if (vehicle.listingExpiresAt && vehicle.status === 'published') {
          const expiryDate = new Date(vehicle.listingExpiresAt);
          const seller = sellerMap.get(vehicle.sellerEmail?.toLowerCase());
          const isPremiumNoExpiry = seller?.subscriptionPlan === 'premium' && !seller?.planExpiryDate;
          
          // Sync expiry date with plan expiry if they don't match (for Premium plans)
          if (seller?.subscriptionPlan === 'premium' && seller?.planExpiryDate) {
            const planExpiry = new Date(seller.planExpiryDate);
            const vehicleExpiry = new Date(vehicle.listingExpiresAt);
            
            // If plan expiry is different from vehicle expiry, sync them
            if (Math.abs(planExpiry.getTime() - vehicleExpiry.getTime()) > 1000) { // More than 1 second difference
              updateFields.listingExpiresAt = seller.planExpiryDate;
              
              // If vehicle was expired but plan is now valid, reactivate it
              if (vehicleExpiry < now && planExpiry >= now) {
                updateFields.listingStatus = 'active';
                updateFields.status = 'published';
              }
            }
          }
          
          // Only auto-unpublish if listing has expired AND it's not a Premium plan without expiry
          if (expiryDate < now && !isPremiumNoExpiry) {
            updateFields.status = 'unpublished';
            updateFields.listingStatus = 'expired';
          } else if (isPremiumNoExpiry && expiryDate < now) {
            // For Premium plans without expiry, remove the listingExpiresAt to prevent future expiry
            updateFields.listingExpiresAt = undefined;
          }
        }
        
        if (Object.keys(updateFields).length > 0) {
          vehicleUpdates.push({
            id: vehicle.id,
            updates: updateFields
          });
        }
      });
      } // End of if (!skipExpiryCheck) block
      
      // Enforce plan listing limits: keep most recent listings within limit, unpublish extras
      // Only enforce if not skipping expiry checks
      if (!skipExpiryCheck) {
      try {
        // Build per-seller published vehicles list (newest first)
        const sellerToPublished: Map<string, VehicleType[]> = new Map();
        vehicles.forEach(v => {
          if (v.status === 'published' && v.sellerEmail) {
            const key = v.sellerEmail.toLowerCase();
            if (!sellerToPublished.has(key)) sellerToPublished.set(key, []);
            sellerToPublished.get(key)!.push(v);
          }
        });
        sellerToPublished.forEach(list => {
          list.sort((a, b) => {
            // Use createdAt if available, otherwise use a default timestamp
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
        });
        
        // For each seller, apply plan limit
        sellerToPublished.forEach((publishedVehicles, email) => {
          const seller = sellerMap.get(email);
          const planKey = (seller?.subscriptionPlan || 'free') as keyof typeof PLAN_DETAILS;
          const planDetails = PLAN_DETAILS[planKey] || PLAN_DETAILS.free;
          const limit = planDetails.listingLimit;
          if (limit === 'unlimited') {
            return;
          }
          const numericLimit = Number(limit) || 0;
          if (publishedVehicles.length > numericLimit) {
            const extras = publishedVehicles.slice(numericLimit); // older ones
            extras.forEach(v => {
              if (v.id) {
                vehicleUpdates.push({
                  id: v.id,
                  updates: { status: 'unpublished', listingStatus: 'suspended' }
                });
              }
            });
          }
        });
      } catch (limitErr) {
        console.warn('⚠️ Error applying plan listing limits:', limitErr);
      }
      } // End of plan limits check
      
      // Apply all updates in background to not block response (only if not skipping)
      if (!skipExpiryCheck && vehicleUpdates.length > 0) {
        // Do updates in background to not block response
        Promise.all(vehicleUpdates.map(update => 
          vehicleService.update(update.id, update.updates).catch(err => 
            console.warn(`⚠️ Failed to update vehicle ${update.id}:`, err)
          )
        )).then(() => {
          // Invalidate cache after updates (in background)
          vehicleCache.delete('published_vehicles');
        });
      }
      
      // PERFORMANCE OPTIMIZATION: Skip refresh if we skipped expiry checks (for speed)
      let finalVehicles = vehicles;
      if (!skipExpiryCheck && vehicleUpdates.length > 0) {
        // Only refresh published vehicles after updates (with database sorting)
        finalVehicles = await vehicleService.findByStatus('published', {
          orderBy: 'created_at',
          orderDirection: 'desc'
        });
        console.log(`📊 Refreshed ${finalVehicles.length} published vehicles after ${vehicleUpdates.length} updates`);
      }
      
      // Normalize sellerEmail to lowercase for consistent filtering
      let normalizedVehicles = finalVehicles.map(v => ({
        ...v,
        sellerEmail: v.sellerEmail?.toLowerCase().trim() || v.sellerEmail
      }));
      
      // Use the total count we fetched earlier (or from cache)
      const finalTotalCount = totalVehiclesCount || normalizedVehicles.length;
      
      // Return paginated response with metadata if pagination was requested
      if (limit > 0) {
        const totalPages = Math.ceil(finalTotalCount / limit);
        console.log(`📊 Returning ${normalizedVehicles.length} published vehicles (page ${page} of ${totalPages}, total: ${finalTotalCount})`);
        return res.status(200).json({
          vehicles: normalizedVehicles,
          pagination: {
            page,
            limit,
            total: finalTotalCount,
            pages: totalPages,
            hasMore: page < totalPages
          }
        });
      }
      
      // Return all vehicles if no pagination requested (backward compatible)
      console.log(`📊 Returning ${normalizedVehicles.length} published vehicles to client`);
      return res.status(200).json(normalizedVehicles);
    } catch (error) {
      console.error('❌ Error fetching vehicles:', error);
      // Fallback to mock data if database query fails
      const fallbackVehicles = await getFallbackVehicles();
      // Filter to only published vehicles for public-facing endpoint
      const publishedFallbackVehicles = fallbackVehicles.filter(v => v.status === 'published');
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json(publishedFallbackVehicles);
    }
  }

  if (req.method === 'POST') {
    // PUBLIC ACTION: Track view doesn't require authentication (it's just tracking public views)
    if (action === 'track-view') {
      try {
        const { vehicleId } = req.body || {};
        const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
        if (!vehicleIdNum || Number.isNaN(vehicleIdNum)) {
          return res.status(400).json({ success: false, reason: 'Valid vehicleId is required' });
        }

        const vehicle = await vehicleService.findById(vehicleIdNum);
        if (!vehicle) {
          return res.status(404).json({ success: false, reason: 'Vehicle not found' });
        }

        const currentViews = typeof vehicle.views === 'number' ? vehicle.views : 0;
        await vehicleService.update(vehicleIdNum, {
          views: currentViews + 1
        });

        return res.status(200).json({ success: true, views: vehicle.views });
      } catch (error) {
        return res.status(500).json({ success: false, reason: 'Failed to track view', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // CRITICAL FIX: Verify Auth for all other POST actions BEFORE processing
    const auth = authenticateRequest(req);
    if (!auth.isValid) {
      logWarn('⚠️ POST /vehicles - Authentication failed:', auth.error);
      return res.status(401).json({ 
        success: false, 
        reason: auth.error || 'Authentication required to create vehicles. Please log in again.',
        error: 'Invalid or expired authentication token'
      });
    }
    
    // CRITICAL FIX: Verify user exists in database
    const user = await userService.findByEmail(auth.user?.email || '');
    if (!user) {
      logError('❌ POST /vehicles - User not found in database:', auth.user?.email);
      return res.status(401).json({ 
        success: false, 
        reason: 'User account not found. Please log in again.' 
      });
    }
    
    // CRITICAL FIX: Ensure sellerEmail matches authenticated user
    // Auto-correct sellerEmail to match authenticated user (security: prevent users from creating vehicles for other users)
    const authenticatedEmail = auth.user?.email || '';
    if (!req.body.sellerEmail || req.body.sellerEmail.toLowerCase() !== authenticatedEmail.toLowerCase()) {
      logWarn('⚠️ POST /vehicles - sellerEmail mismatch or missing:', {
        provided: req.body.sellerEmail,
        authenticated: authenticatedEmail
      });
      // Auto-correct sellerEmail to match authenticated user
      req.body.sellerEmail = authenticatedEmail;
    }
    
    // CRITICAL FIX: Enforce plan expiry and listing limits for creation (no action or unknown action)
    // Only applies to standard create flow (i.e., when not handling action sub-routes above)
    if (!action || (action !== 'refresh' && action !== 'boost' && action !== 'certify' && action !== 'sold' && action !== 'unsold' && action !== 'feature')) {
      try {
        // CRITICAL FIX: Use authenticated email (already normalized and verified)
        const normalizedEmail = authenticatedEmail.toLowerCase().trim();
        if (!normalizedEmail) {
          return res.status(400).json({ success: false, reason: 'Seller email is required' });
        }
            // Load seller
            const seller = await userService.findByEmail(normalizedEmail);
        if (!seller) {
          return res.status(404).json({ success: false, reason: 'Seller not found' });
        }
        // Check plan expiry
        const nowIso = new Date();
        const planExpiryDate = seller.planExpiryDate ? new Date(seller.planExpiryDate) : undefined;
        const planExpired = !!(planExpiryDate && planExpiryDate.getTime() < nowIso.getTime());
        if (planExpired) {
          return res.status(403).json({
            success: false,
            reason: 'Your subscription plan has expired. Please renew your plan to create new listings.',
            planExpired: true,
            expiredOn: seller.planExpiryDate
          });
        }
        // Determine listing limit for current plan
        const planKey = (seller.subscriptionPlan || 'free') as keyof typeof PLAN_DETAILS;
        const planDetails = PLAN_DETAILS[planKey] || PLAN_DETAILS.free;
        const listingLimit = planDetails.listingLimit;
        if (listingLimit !== 'unlimited') {
          const sellerVehicles = await vehicleService.findBySellerEmail(normalizedEmail);
          const currentActiveCount = sellerVehicles.filter(v => v.status === 'published').length;
          if (currentActiveCount >= (Number(listingLimit) || 0)) {
            return res.status(403).json({
              success: false,
              reason: `Listing limit reached for your ${planDetails.name} plan. You can have up to ${listingLimit} active listing(s).`,
              limitReached: true,
              activeListings: currentActiveCount,
              limit: listingLimit
            });
          }
        }
      } catch (guardError) {
        console.error('❌ Error validating plan/limits before vehicle creation:', guardError);
        return res.status(500).json({
          success: false,
          reason: 'Failed to validate plan or listing limits. Please try again.',
        });
      }
    }

    if (action === 'refresh') {
      const { vehicleId, refreshAction, sellerEmail } = req.body;
      const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
      const vehicle = await vehicleService.findById(vehicleIdNum);
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
      const normalizedRequestSellerEmail = sellerEmail ? String(sellerEmail).toLowerCase().trim() : '';
      if (normalizedVehicleSellerEmail !== normalizedRequestSellerEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized' });
      }
      
      const updates: Partial<VehicleType> = {};
      if (refreshAction === 'refresh') {
        updates.views = 0;
        updates.inquiriesCount = 0;
      } else if (refreshAction === 'renew') {
        updates.listingExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      
      await vehicleService.update(vehicleIdNum, updates);
      const updatedVehicle = await vehicleService.findById(vehicleIdNum);
      return res.status(200).json({ success: true, vehicle: updatedVehicle });
    }

    if (action === 'boost') {
      const { vehicleId, packageId } = req.body;
      const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
      const vehicle = await vehicleService.findById(vehicleIdNum);
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      // Add boost information if packageId is provided
      // packageId format is like "top_search_3", "homepage_spot", etc.
      // Extract type and duration from packageId
      let boostType: 'top_search' | 'homepage_spotlight' | 'featured_badge' | 'multi_city' = 'top_search';
      let boostDuration = 7; // Default 7 days
      
      if (packageId) {
        const parts = packageId.split('_');
        if (parts.length >= 2) {
          // Extract type (first parts except last if it's a number)
          const lastPart = parts[parts.length - 1];
          const isLastPartNumber = !isNaN(Number(lastPart));
          
          if (isLastPartNumber) {
            const extractedType = parts.slice(0, -1).join('_');
            // Validate and set boostType
            if (extractedType === 'top_search' || extractedType === 'homepage_spotlight' || 
                extractedType === 'featured_badge' || extractedType === 'multi_city') {
              boostType = extractedType;
            }
            boostDuration = Number(lastPart);
          } else {
            const extractedType = parts.join('_');
            // Validate and set boostType
            if (extractedType === 'top_search' || extractedType === 'homepage_spotlight' || 
                extractedType === 'featured_badge' || extractedType === 'multi_city') {
              boostType = extractedType;
            }
            // Use default duration based on package
            boostDuration = 7; // Default
          }
        }
      }
      
      const boostInfo = {
        id: `boost_${Date.now()}`,
        vehicleId: vehicleIdNum,
        packageId: packageId || 'standard',
        type: boostType,
        startDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + boostDuration * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      };
      
      const activeBoosts = vehicle.activeBoosts || [];
      activeBoosts.push(boostInfo);
      
      await vehicleService.update(vehicleIdNum, {
        activeBoosts,
        isFeatured: true
      });
      
      const updatedVehicle = await vehicleService.findById(vehicleIdNum);
      return res.status(200).json({ success: true, vehicle: updatedVehicle });
    }

      if (action === 'certify') {
        try {
          const { vehicleId } = req.body;
          const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
          if (!vehicleIdNum) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          const vehicle = await vehicleService.findById(vehicleIdNum);
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          // Sanitize seller email
          const sanitizedSellerEmail = await sanitizeString(String(vehicle.sellerEmail));
          const seller = await userService.findByEmail(sanitizedSellerEmail.toLowerCase().trim());
          if (!seller) {
            return res.status(404).json({ success: false, reason: 'Seller not found for this vehicle' });
          }

          const planKey = (seller.subscriptionPlan || 'free') as keyof typeof PLAN_DETAILS;
          const planDetails = PLAN_DETAILS[planKey] || PLAN_DETAILS.free;
          const allowedCertifications = planDetails.freeCertifications ?? 0;
          const usedCertifications = seller.usedCertifications ?? 0;

          if (allowedCertifications <= 0) {
            return res.status(403).json({
              success: false,
              reason: 'Your current plan does not include certification requests. Please upgrade your plan.'
            });
          }

          if (usedCertifications >= allowedCertifications) {
            return res.status(403).json({
              success: false,
              reason: `You have used all ${allowedCertifications} certification requests included in your plan.`
            });
          }

          if (vehicle.certificationStatus === 'requested') {
            return res.status(200).json({
              success: true,
              vehicle,
              alreadyRequested: true,
              usedCertifications,
              remainingCertifications: Math.max(allowedCertifications - usedCertifications, 0)
            });
          }

          await vehicleService.update(vehicleIdNum, {
            certificationStatus: 'requested',
            certificationRequestedAt: new Date().toISOString()
          });
          
          await userService.update(seller.email, {
            usedCertifications: usedCertifications + 1
          });
          
          const updatedVehicle = await vehicleService.findById(vehicleIdNum);
          const updatedSeller = await userService.findByEmail(seller.email);
          const totalUsed = updatedSeller?.usedCertifications ?? usedCertifications + 1;
          const remaining = Math.max(allowedCertifications - totalUsed, 0);
          
          return res.status(200).json({ 
            success: true, 
            vehicle: updatedVehicle,
            usedCertifications: totalUsed,
            remainingCertifications: remaining 
          });
        } catch (error) {
          console.error('❌ Error requesting vehicle certification:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      if (action === 'feature') {
        try {
          // SECURITY FIX: Verify ownership
          const { vehicleId } = req.body;
          const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
          if (!vehicleIdNum) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          const vehicle = await vehicleService.findById(vehicleIdNum);
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }

          // Verify ownership (unless admin)
          const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
          const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
          if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
            console.error('❌ Feature action failed: Ownership mismatch', { 
              vehicleSeller: normalizedVehicleSellerEmail, 
              authenticated: normalizedAuthEmail 
            });
            return res.status(403).json({ 
              success: false, 
              reason: 'Unauthorized: You can only feature your own listings.' 
            });
          }

          if (vehicle.isFeatured) {
            return res.status(200).json({ 
              success: true, 
              vehicle,
              alreadyFeatured: true 
            });
          }

          const sellerEmail = vehicle.sellerEmail;
          if (!sellerEmail) {
            return res.status(400).json({ success: false, reason: 'Vehicle does not have an associated seller.' });
          }

          // Sanitize seller email
          const sanitizedSellerEmail = await sanitizeString(String(sellerEmail));
          const seller = await userService.findByEmail(sanitizedSellerEmail.toLowerCase().trim());
          if (!seller) {
            return res.status(404).json({ success: false, reason: 'Seller not found for this vehicle.' });
          }

          // Determine plan-based featured credit allowance
          const FEATURE_CREDIT_LIMITS: Record<string, number> = {
            free: 0,
            pro: 2,
            premium: 5
          };

          const sellerPlan = (seller.subscriptionPlan || 'free') as string;
          const planLimit = FEATURE_CREDIT_LIMITS[sellerPlan] ?? 0;

          // Initialize featured credits if undefined
          let remainingCredits = typeof seller.featuredCredits === 'number' ? seller.featuredCredits : planLimit;
          if (!Number.isFinite(remainingCredits)) {
            remainingCredits = 0;
          }

          if (planLimit === 0) {
            return res.status(403).json({
              success: false,
              reason: 'Your current plan does not include featured listings. Upgrade to unlock featured credits.',
              remainingCredits: remainingCredits
            });
          }

          if (remainingCredits <= 0) {
            return res.status(403).json({
              success: false,
              reason: 'You have no featured credits remaining. Upgrade your plan or wait until your credits refresh.',
              remainingCredits: remainingCredits
            });
          }

          await vehicleService.update(vehicleIdNum, {
            isFeatured: true,
            featuredAt: new Date().toISOString()
          });

          // Deduct one featured credit
          await userService.update(seller.email, {
            featuredCredits: Math.max(0, remainingCredits - 1)
          });
          
          const updatedVehicle = await vehicleService.findById(vehicleIdNum);
          const updatedSeller = await userService.findByEmail(seller.email);
          
          return res.status(200).json({ 
            success: true, 
            vehicle: updatedVehicle,
            remainingCredits: updatedSeller?.featuredCredits ?? 0
          });
        } catch (error) {
          console.error('❌ Error featuring vehicle:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      if (action === 'sold') {
        try {
          const { vehicleId } = req.body;
          console.log('📝 Marking vehicle as sold, vehicleId:', vehicleId, 'type:', typeof vehicleId);
          
          if (!vehicleId && vehicleId !== 0) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          // Convert vehicleId to number if it's a string
          const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
          if (isNaN(vehicleIdNum)) {
            return res.status(400).json({ success: false, reason: 'Invalid vehicle ID format' });
          }
          
          console.log('🔍 Finding vehicle with id:', vehicleIdNum);
          const vehicle = await vehicleService.findById(vehicleIdNum);
          
          if (!vehicle) {
            console.warn('⚠️ Vehicle not found with id:', vehicleIdNum);
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }

          // SECURITY FIX: Verify ownership (unless admin)
          const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
          const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
          if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
            console.error('❌ Mark as sold failed: Ownership mismatch', { 
              vehicleSeller: normalizedVehicleSellerEmail, 
              authenticated: normalizedAuthEmail 
            });
            return res.status(403).json({ 
              success: false, 
              reason: 'Unauthorized: You can only mark your own listings as sold.' 
            });
          }
          
          console.log('✏️ Updating vehicle status to sold...');
          await vehicleService.update(vehicleIdNum, {
            status: 'sold',
            listingStatus: 'sold',
            soldAt: new Date().toISOString()
          });
          
          console.log('✅ Vehicle saved successfully');
          const updatedVehicle = await vehicleService.findById(vehicleIdNum);
          
          return res.status(200).json({ success: true, vehicle: updatedVehicle });
        } catch (error) {
          console.error('❌ Error marking vehicle as sold:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return res.status(500).json({ 
            success: false, 
            reason: errorMessage
          });
        }
      }

      if (action === 'unsold') {
        try {
          const { vehicleId } = req.body;
          const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
          if (!vehicleIdNum) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          const vehicle = await vehicleService.findById(vehicleIdNum);
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }

          // SECURITY FIX: Verify ownership (unless admin)
          const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
          const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
          if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
            console.error('❌ Mark as unsold failed: Ownership mismatch', { 
              vehicleSeller: normalizedVehicleSellerEmail, 
              authenticated: normalizedAuthEmail 
            });
            return res.status(403).json({ 
              success: false, 
              reason: 'Unauthorized: You can only mark your own listings as unsold.' 
            });
          }
          
          await vehicleService.update(vehicleIdNum, {
            status: 'published',
            listingStatus: 'active'
          });
          
          const updatedVehicle = await vehicleService.findById(vehicleIdNum);
          
          return res.status(200).json({ success: true, vehicle: updatedVehicle });
        } catch (error) {
          console.error('❌ Error marking vehicle as unsold:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

    // Create new vehicle
    // SECURITY FIX: Verify Auth
    const vehicleAuth = authenticateRequest(req);
    if (!vehicleAuth.isValid) {
      console.error('❌ Vehicle creation failed: Authentication required');
      return res.status(401).json({ success: false, reason: vehicleAuth.error });
    }
    
    // Verify seller email matches authenticated user (unless admin)
    if (req.body.sellerEmail) {
      const sanitizedEmail = (await sanitizeString(String(req.body.sellerEmail))).toLowerCase().trim();
      const normalizedAuthEmail = vehicleAuth.user?.email ? vehicleAuth.user.email.toLowerCase().trim() : '';
      
      if (vehicleAuth.user?.role !== 'admin' && sanitizedEmail !== normalizedAuthEmail) {
        console.error('❌ Vehicle creation failed: Seller email mismatch', { 
          provided: sanitizedEmail, 
          authenticated: normalizedAuthEmail 
        });
        return res.status(403).json({ 
          success: false, 
          reason: 'Unauthorized: You can only create listings for your own account.' 
        });
      }
      
      // Check if seller's plan has expired and block creation if so
      const seller = await userService.findByEmail(sanitizedEmail);
      if (seller && seller.planExpiryDate) {
        const expiryDate = new Date(seller.planExpiryDate);
        const isExpired = expiryDate < new Date();
        if (isExpired) {
          console.error('❌ Vehicle creation failed: Plan expired', { email: sanitizedEmail, expiryDate: seller.planExpiryDate });
          return res.status(403).json({ 
            success: false, 
            reason: 'Your subscription plan has expired. Please renew your plan to create new vehicle listings.' 
          });
        }
      }
    }
    
    // Set listingExpiresAt based on seller's plan expiry date
    let listingExpiresAt: string | undefined;
    if (req.body.sellerEmail) {
      // Sanitize email input
      const sanitizedEmail = (await sanitizeString(String(req.body.sellerEmail))).toLowerCase().trim();
      const seller = await userService.findByEmail(sanitizedEmail);
      if (seller) {
        // Plan is not expired (checked above), so compute expiry for active plans
        if (seller.subscriptionPlan === 'premium') {
          if (seller.planExpiryDate) {
            // Premium plan active: use plan expiry date
            listingExpiresAt = seller.planExpiryDate;
          } else {
            // Premium without expiry date: leave undefined (no expiry)
            listingExpiresAt = undefined;
          }
        } else if (seller.subscriptionPlan === 'free' || seller.subscriptionPlan === 'pro') {
          // Free and Pro plans get 30-day expiry from today
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          listingExpiresAt = expiryDate.toISOString();
        }
        // If Premium without planExpiryDate, listingExpiresAt remains undefined (no expiry)
      }
    }
    
    // Normalize images to always be an array
    const normalizedImages = Array.isArray(req.body.images) 
      ? req.body.images 
      : typeof req.body.images === 'string' 
        ? [req.body.images] 
        : [];
    
    // Validate images array size to prevent vehicle object from exceeding Firebase limits
    // Firebase Realtime Database has 16MB limit per node
    // Each base64 image can be ~1-1.5MB, so limit to 10 images max
    if (normalizedImages.length > 10) {
      logWarn('⚠️ Vehicle has too many images, limiting to 10', { 
        provided: normalizedImages.length,
        sellerEmail: req.body.sellerEmail 
      });
      normalizedImages.splice(10); // Keep only first 10 images
    }
    
    // Estimate total size of images (base64 strings)
    const totalImageSize = normalizedImages.reduce((total: number, img: string) => {
      return total + (typeof img === 'string' ? img.length : 0);
    }, 0);
    
    // Warn if images are very large (approaching 16MB limit)
    const maxRecommendedSize = 10 * 1024 * 1024; // 10MB (leaving room for other vehicle data)
    if (totalImageSize > maxRecommendedSize) {
      logWarn('⚠️ Vehicle images are very large, may approach Firebase size limits', {
        totalSize: `${(totalImageSize / 1024 / 1024).toFixed(2)} MB`,
        imageCount: normalizedImages.length,
        sellerEmail: req.body.sellerEmail
      });
    }
    
    const vehicleData = {
      id: Date.now(),
      ...req.body,
      images: normalizedImages,
      views: 0,
      inquiriesCount: 0,
      createdAt: new Date().toISOString(),
      listingExpiresAt
    };
    
    try {
      console.log('💾 Saving new vehicle to Firebase...', { 
        id: vehicleData.id, 
        make: vehicleData.make, 
        model: vehicleData.model,
        sellerEmail: vehicleData.sellerEmail 
      });
      
      const newVehicle = await vehicleService.create(vehicleData);
      console.log('✅ Vehicle saved successfully to Firebase:', newVehicle.id);
      
      // Verify the vehicle was saved by querying it back
      const verifyVehicle = await vehicleService.findById(newVehicle.id);
      if (!verifyVehicle) {
        console.error('❌ Vehicle creation verification failed - vehicle not found after save', { id: newVehicle.id });
        return res.status(500).json({ 
          success: false, 
          reason: 'Vehicle was created but could not be verified. Please refresh and check your listings.' 
        });
      } else {
        console.log('✅ Vehicle creation verified in database', { id: verifyVehicle.id });
      }
      
      return res.status(201).json(verifyVehicle);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to create vehicle in Firebase:', errorMessage, error);
      return res.status(500).json({ 
        success: false, 
        reason: `Failed to create vehicle: ${errorMessage}`,
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }

  if (req.method === 'PUT') {
    // SECURITY FIX: Verify Auth
    const auth = authenticateRequest(req);
    if (!auth.isValid) {
      return res.status(401).json({ success: false, reason: auth.error });
    }
    try {
      const { id, ...updateData } = req.body;
      const vehicleIdNum = typeof id === 'string' ? parseInt(id, 10) : Number(id);
      if (!vehicleIdNum) {
        return res.status(400).json({ success: false, reason: 'Vehicle ID is required for update.' });
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 PUT /vehicles - Updating vehicle:', { id: vehicleIdNum, fields: Object.keys(updateData) });
      }
      
      // SECURITY FIX: Ownership Check
      // Fetch vehicle to verify ownership before update
      const existingVehicle = await vehicleService.findById(vehicleIdNum);
      if (!existingVehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = existingVehicle.sellerEmail ? existingVehicle.sellerEmail.toLowerCase().trim() : '';
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You do not own this listing.' });
      }
      
      // Normalize images to always be an array
      if (updateData.images !== undefined) {
        updateData.images = Array.isArray(updateData.images) 
          ? updateData.images 
          : typeof updateData.images === 'string' 
            ? [updateData.images] 
            : [];
      }
      
      // Update vehicle in Firebase
      await vehicleService.update(vehicleIdNum, updateData);
      console.log('✅ Vehicle updated and saved successfully:', vehicleIdNum);
      
      // Verify the update by querying again
      const updatedVehicle = await vehicleService.findById(vehicleIdNum);
      if (!updatedVehicle) {
        console.warn('⚠️ Vehicle update verification failed - vehicle not found after update');
        return res.status(500).json({ success: false, reason: 'Failed to update vehicle.' });
      } else {
        console.log('✅ Vehicle update verified in database');
      }
      
      return res.status(200).json(updatedVehicle);
    } catch (error) {
      console.error('❌ Error updating vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  if (req.method === 'DELETE') {
    // SECURITY FIX: Verify Auth
    const auth = authenticateRequest(req);
    if (!auth.isValid) {
      return res.status(401).json({ success: false, reason: auth.error });
    }
    try {
      const { id } = req.body;
      const vehicleIdNum = typeof id === 'string' ? parseInt(id, 10) : Number(id);
      if (!vehicleIdNum) {
        return res.status(400).json({ success: false, reason: 'Vehicle ID is required for deletion.' });
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 DELETE /vehicles - Deleting vehicle:', vehicleIdNum);
      }
      
      // SECURITY FIX: Ownership Check
      const vehicleToDelete = await vehicleService.findById(vehicleIdNum);
      if (!vehicleToDelete) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = vehicleToDelete.sellerEmail ? vehicleToDelete.sellerEmail.toLowerCase().trim() : '';
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You do not own this listing.' });
      }
      
      await vehicleService.delete(vehicleIdNum);
      console.log('✅ Vehicle deleted successfully from Firebase:', vehicleIdNum);
      
      // Verify the vehicle was deleted by querying it
      const verifyVehicle = await vehicleService.findById(vehicleIdNum);
      if (verifyVehicle) {
        console.error('❌ Vehicle deletion verification failed - vehicle still exists in database');
      } else {
        console.log('✅ Vehicle deletion verified in database');
      }
      
      return res.status(200).json({ success: true, message: 'Vehicle deleted successfully.' });
    } catch (error) {
      console.error('❌ Error deleting vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

    return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    console.error('Error in handleVehicles:', error);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Special handling for vehicle-data endpoints - NEVER return 500
    const isVehicleDataEndpoint = req.query?.type === 'data';
    if (isVehicleDataEndpoint) {
      res.setHeader('X-Data-Fallback', 'true');
      const defaultData = {
        FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
        TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
      };
      if (req.method === 'GET') {
        return res.status(200).json(defaultData);
      } else {
        return res.status(200).json({
          success: true,
          data: req.body || {},
          message: 'Vehicle data processed (error occurred, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // If it's a database connection error, return 200 with fallback data instead of 503
    if (error instanceof Error && (error.message.includes('FIREBASE') || error.message.includes('Firebase') || error.message.includes('connect'))) {
      const fallbackVehicles = await getFallbackVehicles();
      const publishedFallbackVehicles = fallbackVehicles.filter(v => v.status === 'published');
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json(publishedFallbackVehicles);
    }
    
    // For GET requests, always return 200 with fallback data instead of 500
    if (req.method === 'GET') {
      try {
        const fallbackVehicles = await getFallbackVehicles();
        const publishedFallbackVehicles = fallbackVehicles.filter(v => v.status === 'published');
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(publishedFallbackVehicles);
      } catch (fallbackError) {
        // Even fallback failed, return empty array
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json([]);
      }
    }
    
    // For other methods, return 500 with error details
    return res.status(500).json({
      success: false,
      reason: 'An error occurred while processing the request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Admin handler - preserves exact functionality from admin.ts
async function handleAdmin(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const { action } = req.query;

  // SECURITY: Require authentication for all admin endpoints
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      reason: 'Unauthorized. Admin endpoints require authentication.',
      message: 'Please provide a valid JWT token in the Authorization header (Bearer token)'
    });
  }

  // Verify JWT token
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  let decoded: TokenPayload & { [key: string]: unknown };
  try {
    decoded = { ...verifyToken(token) } as TokenPayload & { [key: string]: unknown };
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      reason: 'Invalid or expired token.',
      message: 'The provided authentication token is invalid or has expired. Please login again.'
    });
  }

  // SECURITY: Verify user has admin role
  if (decoded.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      reason: 'Forbidden. Admin access required.',
      message: 'This endpoint requires administrator privileges. Your current role does not have access.',
      userRole: decoded.role
    });
  }

  // Log admin action for security auditing
  // SECURITY: Always log admin actions for security monitoring
  logSecurity(`Admin action '${action}' accessed by user: ${decoded.email}`, { userId: decoded.userId, action });

  if (action === 'health') {
    try {
      if (!USE_SUPABASE) {
        return res.status(200).json({
          success: false,
          message: 'Firebase environment variables are not configured',
          details: 'Please add Firebase environment variables in Vercel dashboard under Environment Variables',
          checks: [
            { name: 'Firebase Configuration', status: 'FAIL', details: 'Firebase environment variables not found' }
          ]
        });
      }

      // Test Firebase connection using Admin SDK (bypasses security rules)
      await adminRead(DB_PATHS.USERS, 'test');
      
      return res.status(200).json({
        success: true,
        message: 'Firebase connected successfully',
        collections: Object.values(DB_PATHS),
        checks: [
          { name: 'Firebase Configuration', status: 'PASS', details: 'Firebase environment variables are set' },
          { name: 'Database Connection', status: 'PASS', details: 'Successfully connected to Firebase Realtime Database' }
        ]
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (action === 'seed') {
    // Prevent seed function from running in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        reason: 'Seed function cannot run in production environment'
      });
    }
    
    if (!USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        message: 'Firebase is not configured. Cannot seed data.',
        fallback: true
      });
    }
    try {
      const users = await seedUsers();
      const vehicles = await seedVehicles();
      
      return res.status(200).json({
        success: true,
        message: 'Database seeded successfully',
        data: { users: users.length, vehicles: vehicles.length }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Seeding failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(400).json({ success: false, reason: 'Invalid admin action' });
}

// Health handler - preserves exact functionality from db-health.ts
async function handleHealth(_req: VercelRequest, res: VercelResponse) {
  try {
    if (!USE_SUPABASE) {
      return res.status(500).json({
        status: 'error',
        message: 'Firebase is not configured. Please set Firebase environment variables.',
        timestamp: new Date().toISOString()
      });
    }
    
    // Test Firebase connection using Admin SDK
    await adminRead(DB_PATHS.USERS, 'test');
    
    return res.status(200).json({
      status: 'ok',
      message: 'Firebase connected successfully.',
      database: 'Firebase Realtime Database',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    let errorMessage = 'Firebase connection failed';
    
    if (error instanceof Error) {
      if (error.message.includes('Firebase') || error.message.includes('firebase')) {
        errorMessage += ' - Check Firebase environment variables in Vercel dashboard';
      } else if (error.message.includes('connect') || error.message.includes('timeout')) {
        errorMessage += ' - Check Firebase project status and network connectivity';
      }
    }
    
    return res.status(500).json({
      status: 'error',
      message: errorMessage,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Seed handler - preserves exact functionality from seed.ts
async function handleSeed(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  // SECURITY: Require secret key for seeding - never use default in production
  const secretKey = req.headers['x-seed-secret'] || req.body?.secretKey;
  const validSecret = process.env.SEED_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  
  // In production, require valid secret key from environment
  if (isProduction) {
    if (!validSecret) {
      logError('❌ SEED_SECRET_KEY not configured in production');
      return res.status(503).json({
        success: false,
        reason: 'Seeding is disabled in production without SEED_SECRET_KEY configuration.'
      });
    }
    if (!secretKey || secretKey !== validSecret) {
      return res.status(403).json({
        success: false,
        reason: 'Invalid or missing secret key for production seeding. Provide x-seed-secret header or secretKey in body.'
      });
    }
  }

  if (!USE_SUPABASE) {
    return res.status(503).json({
      success: false,
      message: 'Firebase is not configured. Cannot seed data.',
      fallback: true
    });
  }

  try {
    const users = await seedUsers(isProduction ? secretKey : undefined);
    const vehicles = await seedVehicles();
    
    // SECURITY: Don't return credentials in response - they should be logged separately or retrieved via admin panel
    return res.status(200).json({
      success: true,
      message: 'Database seeded successfully',
      data: { 
        users: { inserted: users.length }, 
        vehicles: { inserted: vehicles.length } 
      }
      // SECURITY: Credentials removed from response - use admin panel to view user details
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Seeding failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Vehicle Data handler - preserves exact functionality from vehicle-data.ts
async function handleVehicleData(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  // Ensure JSON content type
  res.setHeader('Content-Type', 'application/json');
  
  const defaultData = {
    FOUR_WHEELER: [
      {
        name: "Maruti Suzuki",
        models: [
          { name: "Swift", variants: ["LXi", "VXi", "VXi (O)", "ZXi", "ZXi+"] },
          { name: "Baleno", variants: ["Sigma", "Delta", "Zeta", "Alpha"] }
        ]
      }
    ],
    TWO_WHEELER: [
      {
        name: "Honda",
        models: [
          { name: "Activa 6G", variants: ["Standard", "DLX", "Smart"] }
        ]
      }
    ]
  };

  try {
    if (req.method === 'GET') {
      try {
        // Try to get vehicle data from Firebase using Admin SDK (bypasses security rules)
        const vehicleData = await adminRead<{ data: typeof defaultData }>(DB_PATHS.VEHICLE_DATA, 'default');
        if (vehicleData && vehicleData.data) {
          return res.status(200).json(vehicleData.data);
        }
        
        // If no data exists, create default using Admin SDK (bypasses security rules)
        await adminCreate(DB_PATHS.VEHICLE_DATA, { data: defaultData }, 'default');
        return res.status(200).json(defaultData);
      } catch (dbError) {
        logWarn('⚠️ Database connection failed for vehicle-data, returning default data:', dbError);
        // Return default data as fallback - NEVER return 500
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(defaultData);
      }
    }

    if (req.method === 'POST') {
      try {
        if (!requireAdmin(req, res, 'Vehicle data update')) {
          return;
        }
        // Save vehicle data to Firebase using Admin SDK (bypasses security rules)
        await adminUpdate(DB_PATHS.VEHICLE_DATA, 'default', {
          data: req.body,
          updatedAt: new Date().toISOString()
        });
        
        console.log('✅ Vehicle data saved successfully to Firebase');
        return res.status(200).json({ 
          success: true, 
          data: req.body,
          message: 'Vehicle data updated successfully',
          timestamp: new Date().toISOString()
        });
      } catch (dbError) {
        logWarn('⚠️ Database connection failed for vehicle-data save:', dbError);
        
        // For POST requests, we should still return success but indicate fallback
        // This prevents the sync from failing completely - NEVER return 500
        console.log('📝 Returning success with fallback indication for POST request');
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({
          success: true,
          data: req.body,
          message: 'Vehicle data processed (database unavailable, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Ultimate fallback - catch any unexpected errors
    logError('⚠️ Unexpected error in handleVehicleData:', error);
    res.setHeader('X-Data-Fallback', 'true');
    if (req.method === 'GET') {
      return res.status(200).json(defaultData);
    } else {
      return res.status(200).json({
        success: true,
        data: req.body || {},
        message: 'Vehicle data processed (error occurred, using fallback)',
        fallback: true,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Note: In-memory caching is removed for serverless compatibility
// Each function invocation will load fresh data from constants
// For production, consider using Vercel KV or Redis for caching

async function getFallbackVehicles(): Promise<VehicleType[]> {
  // Return minimal fallback to prevent 500 errors
  // Don't import from constants.js to avoid circular dependency (MOCK_VEHICLES tries to fetch from /api/vehicles)
  return [
    {
      id: 1,
      make: 'Maruti Suzuki',
      model: 'Swift',
      variant: 'VXi',
      year: 2020,
      price: 650000,
      mileage: 25000,
      location: 'Mumbai, Maharashtra',
      images: ['https://via.placeholder.com/800x600?text=Swift'],
      status: 'published',
      category: VehicleCategory.FOUR_WHEELER,
      city: 'Mumbai',
      state: 'Maharashtra',
      sellerEmail: 'demo@reride.com',
      features: [],
      description: 'Well-maintained Maruti Suzuki Swift in excellent condition.',
      engine: '1.2L Petrol',
      transmission: 'Manual',
      fuelType: 'Petrol',
      fuelEfficiency: '23.2 km/l',
      color: 'White',
      isFeatured: false,
      registrationYear: 2020,
      insuranceValidity: '2025-12-31',
      insuranceType: 'Comprehensive',
      rto: 'MH-01',
      noOfOwners: 1,
      displacement: '1197 cc',
      groundClearance: '163 mm',
      bootSpace: '268 litres'
    } satisfies VehicleType
  ];
}

async function getFallbackUsers(): Promise<NormalizedUser[]> {
  // Return minimal fallback user data
  return [
    {
      id: 'fallback-user-1',
      name: 'Demo User',
      email: 'demo@reride.com',
      mobile: '9876543210',
      role: 'customer',
      location: 'Mumbai',
      status: 'active',
      createdAt: new Date().toISOString(),
      subscriptionPlan: 'free',
      isVerified: false
    }
  ];
}

// Helper functions
function calculateTrustScore(user: any): number {
  let score = 50; // Base score
  
  const plan = user.subscriptionPlan || user.plan;
  if (user.isVerified) score += 20;
  if (plan === 'premium') score += 15;
  if (plan === 'pro') score += 10;
  if (user.status === 'active') score += 10;
  
  return Math.min(100, score);
}

function getPopularMakes(vehicles: VehicleType[]): string[] {
  const makeCounts: { [key: string]: number } = {};
  vehicles.forEach(v => {
    makeCounts[v.make] = (makeCounts[v.make] || 0) + 1;
  });
  
  return Object.entries(makeCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([make]) => make);
}

function getPriceRange(vehicles: VehicleType[]): { min: number; max: number } {
  if (vehicles.length === 0) return { min: 0, max: 0 };
  
  const prices = vehicles.map(v => v.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };
}

// New Cars handler - CRUD for new car catalog
async function handleNewCars(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  if (!USE_SUPABASE) {
    return res.status(503).json({
      success: false,
      reason: 'Firebase is not configured. Please set Firebase environment variables.',
      fallback: true
    });
  }

  if (req.method === 'GET') {
    const items = await adminReadAll<Record<string, unknown>>(DB_PATHS.NEW_CARS);
    // CRITICAL: Spread data first, then set id to preserve string ID from key
    const itemsArray = Object.entries(items).map(([id, data]) => ({ ...data, id }))
      .sort((a, b) => {
        const aTime = (a as Record<string, unknown>).updatedAt ? new Date((a as Record<string, unknown>).updatedAt as string).getTime() : 0;
        const bTime = (b as Record<string, unknown>).updatedAt ? new Date((b as Record<string, unknown>).updatedAt as string).getTime() : 0;
        return bTime - aTime;
      });
    return res.status(200).json(itemsArray);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (!payload || !payload.brand_name || !payload.model_name || !payload.model_year) {
      return res.status(400).json({ success: false, reason: 'Missing required fields' });
    }
    const id = `${payload.brand_name}_${payload.model_name}_${payload.model_year}_${Date.now()}`;
    const doc = { ...payload, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    await adminCreate(DB_PATHS.NEW_CARS, doc, id);
    return res.status(201).json({ success: true, data: { id, ...doc } });
  }

  if (req.method === 'PUT') {
    const { id, _id, ...updateData } = req.body || {};
    const docId = _id || id;
    if (!docId) {
      return res.status(400).json({ success: false, reason: 'Document id is required' });
    }
    const existing = await adminRead<Record<string, unknown>>(DB_PATHS.NEW_CARS, String(docId));
    if (!existing) {
      return res.status(404).json({ success: false, reason: 'New car document not found' });
    }
    await adminUpdate(DB_PATHS.NEW_CARS, String(docId), { ...updateData, updatedAt: new Date().toISOString() });
    const updated = await adminRead<Record<string, unknown>>(DB_PATHS.NEW_CARS, String(docId));
    return res.status(200).json({ success: true, data: { id: docId, ...updated } });
  }

  if (req.method === 'DELETE') {
    const { id, _id } = req.body || {};
    const docId = _id || id;
    if (!docId) {
      return res.status(400).json({ success: false, reason: 'Document id is required' });
    }
    await adminDelete(DB_PATHS.NEW_CARS, String(docId));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed.' });
}

// Generate cryptographically random password
function generateRandomPassword(): string {
  return randomBytes(32).toString('hex');
}

async function seedUsers(productionSecret?: string): Promise<UserType[]> {
  // Allow production seeding if secret is provided
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProduction && !productionSecret) {
    throw new Error('Production seeding requires secret key');
  }
  
  // Use environment variables for seed passwords or use defaults based on environment
  const adminPasswordEnv = process.env.SEED_ADMIN_PASSWORD;
  const sellerPasswordEnv = process.env.SEED_SELLER_PASSWORD;
  const customerPasswordEnv = process.env.SEED_CUSTOMER_PASSWORD;
  
  // In production, require env vars or generate random passwords (security)
  // In development, allow 'password' as fallback for testing convenience
  const adminPasswordPlain = adminPasswordEnv || (isProduction ? generateRandomPassword() : 'password');
  const sellerPasswordPlain = sellerPasswordEnv || (isProduction ? generateRandomPassword() : 'password');
  const customerPasswordPlain = customerPasswordEnv || (isProduction ? generateRandomPassword() : 'password');
  
  // Hash passwords before inserting
  const adminPassword = await hashPassword(adminPasswordPlain);
  const sellerPassword = await hashPassword(sellerPasswordPlain);
  const customerPassword = await hashPassword(customerPasswordPlain);
  
  // Log generated passwords in development (not in production)
  if (process.env.NODE_ENV !== 'production') {
    logInfo('⚠️ SEED PASSWORDS (Development only):');
    logInfo('Admin:', adminPasswordEnv ? '[from env]' : adminPasswordPlain);
    logInfo('Seller:', sellerPasswordEnv ? '[from env]' : sellerPasswordPlain);
    logInfo('Customer:', customerPasswordEnv ? '[from env]' : customerPasswordPlain);
  }
  
  // Set plan dates for seller
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month from now
  
  const sampleUsers: Array<Omit<UserType, 'id'>> = [
    {
      email: 'admin@test.com',
      password: adminPassword,
      name: 'Admin User',
      mobile: '9876543210',
      location: 'Mumbai, Maharashtra',
      role: 'admin' as const,
      status: 'active' as const,
      isVerified: true,
      subscriptionPlan: 'premium' as const,
      featuredCredits: 100,
      createdAt: new Date().toISOString()
    },
    {
      email: 'seller@test.com',
      password: sellerPassword,
      name: 'Prestige Motors',
      mobile: '+91-98765-43210',
      location: 'Delhi, NCR',
      role: 'seller' as const,
      status: 'active' as const,
      isVerified: true,
      subscriptionPlan: 'premium' as const,
      featuredCredits: 5,
      usedCertifications: 1,
      dealershipName: 'Prestige Motors',
      bio: 'Specializing in luxury and performance electric vehicles since 2020.',
      logoUrl: 'https://i.pravatar.cc/100?u=seller',
      avatarUrl: 'https://i.pravatar.cc/150?u=seller@test.com',
      planActivatedDate: now.toISOString(),
      planExpiryDate: expiryDate.toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      email: 'customer@test.com',
      password: customerPassword,
      name: 'Test Customer',
      mobile: '9876543212',
      location: 'Bangalore, Karnataka',
      role: 'customer' as const,
      status: 'active' as const,
      isVerified: false,
      subscriptionPlan: 'free' as const,
      featuredCredits: 0,
      avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com',
      createdAt: new Date().toISOString()
    }
  ];

  // Delete existing users and create new ones in Firebase
  const existingUsers = await userService.findAll();
  for (const user of existingUsers) {
    if (['admin@test.com', 'seller@test.com', 'customer@test.com'].includes(user.email.toLowerCase())) {
      await userService.delete(user.email);
    }
  }
  
  const users: UserType[] = [];
  for (const userData of sampleUsers) {
    const user = await userService.create(userData);
    users.push(user);
  }
  
  return users;
}

async function seedVehicles(): Promise<VehicleType[]> {
  // Generate 50 vehicles instead of just 2
  const vehicleCount = 50;
  const sampleVehicles: Array<Omit<VehicleType, 'id'>> = [];
  
  const makes = ['Tata', 'Mahindra', 'Hyundai', 'Maruti Suzuki', 'Honda', 'Toyota', 'Kia', 'MG'];
  const modelsByMake: Record<string, string[]> = {
    'Tata': ['Nexon', 'Harrier', 'Safari', 'Punch', 'Altroz'],
    'Mahindra': ['XUV700', 'Scorpio', 'Thar', 'XUV300', 'Bolero'],
    'Hyundai': ['Creta', 'Venue', 'i20', 'Verna', 'Alcazar'],
    'Maruti Suzuki': ['Brezza', 'Swift', 'Baleno', 'Ertiga', 'Dzire'],
    'Honda': ['City', 'Amaze', 'Jazz', 'WR-V', 'Civic'],
    'Toyota': ['Fortuner', 'Innova Crysta', 'Glanza', 'Urban Cruiser', 'Camry'],
    'Kia': ['Seltos', 'Sonet', 'Carens', 'Carnival', 'EV6'],
    'MG': ['Hector', 'Astor', 'ZS EV', 'Gloster', 'Comet']
  };
  const colors = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Grey', 'Brown'];
  const fuelTypes = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
  const transmissions = ['Manual', 'Automatic', 'AMT', 'CVT', 'DCT'];
  const variants = ['ZX', 'VX', 'SX', 'LX', 'Base', 'Top'];
  const sellers = ['seller@test.com'];
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Chennai', 'Hyderabad'];
  const statesByCity: Record<string, string> = {
    'Mumbai': 'MH', 'Pune': 'MH', 'Delhi': 'DL', 'Bangalore': 'KA', 
    'Chennai': 'TN', 'Hyderabad': 'TS'
  };
  
  for (let i = 1; i <= vehicleCount; i++) {
    const make = makes[Math.floor(Math.random() * makes.length)];
    const models = modelsByMake[make] || ['Model'];
    const model = models[Math.floor(Math.random() * models.length)];
    const variant = variants[Math.floor(Math.random() * variants.length)];
    const year = 2015 + Math.floor(Math.random() * 10);
    const city = cities[Math.floor(Math.random() * cities.length)];
    const state = statesByCity[city] || 'MH';
    const price = Math.round((300000 + Math.floor(Math.random() * 2000000)) / 5000) * 5000;
    const mileage = Math.floor(Math.random() * 100000);
    const fuelType = fuelTypes[Math.floor(Math.random() * fuelTypes.length)];
    const transmission = transmissions[Math.floor(Math.random() * transmissions.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const engineSize = 1000 + Math.floor(Math.random() * 1500);
    
    sampleVehicles.push({
      make,
      model,
      variant: `${model} ${variant}`,
      year,
      price,
      mileage,
      category: VehicleCategory.FOUR_WHEELER,
      sellerEmail: sellers[0],
      status: 'published' as const,
      isFeatured: Math.random() > 0.7,
      views: Math.floor(Math.random() * 1000),
      inquiriesCount: Math.floor(Math.random() * 50),
      images: [
        `https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&auto=format&q=80&sig=${i}`,
        `https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&q=80&sig=${i + 1000}`
      ],
      features: ['Power Steering', 'Air Conditioning', 'Alloy Wheels', 'ABS', 'Airbags', 'Music System'],
      description: `Well maintained ${year} ${make} ${model} in excellent condition. Single owner, full service history. Available in ${city}.`,
      engine: `${engineSize} cc`,
      transmission,
      fuelType,
      fuelEfficiency: `${12 + Math.floor(Math.random() * 13)} km/l`,
      color,
      location: `${city}, ${state}`,
      city,
      state,
      registrationYear: year,
      insuranceValidity: new Date(Date.now() + Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000).toISOString(),
      insuranceType: Math.random() > 0.5 ? 'Comprehensive' : 'Third Party',
      rto: `${state}-${String(Math.floor(Math.random() * 50) + 1).padStart(2, '0')}`,
      noOfOwners: 1 + Math.floor(Math.random() * 3),
      displacement: `${engineSize} cc`,
      groundClearance: `${150 + Math.floor(Math.random() * 70)} mm`,
      bootSpace: `${250 + Math.floor(Math.random() * 250)} litres`,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // Delete existing test vehicles (from seller@test.com) before creating new ones
  // This prevents duplicates when re-seeding
  try {
    const existingVehicles = await vehicleService.findAll();
    const testVehicles = existingVehicles.filter(v => 
      v.sellerEmail?.toLowerCase() === 'seller@test.com'
    );
    
    if (testVehicles.length > 0) {
      console.log(`🗑️ Deleting ${testVehicles.length} existing test vehicles...`);
      for (const vehicle of testVehicles) {
        try {
          await vehicleService.delete(vehicle.id);
        } catch (deleteError) {
          console.warn(`⚠️ Failed to delete vehicle ${vehicle.id}:`, deleteError);
        }
      }
    }
  } catch (cleanupError) {
    console.warn('⚠️ Error during vehicle cleanup, continuing with seed:', cleanupError);
  }
  
  // Create new vehicles
  const vehicles: VehicleType[] = [];
  console.log(`🚗 Creating ${sampleVehicles.length} vehicles...`);
  
  for (let i = 0; i < sampleVehicles.length; i++) {
    const vehicleData = sampleVehicles[i];
    try {
      const vehicle = await vehicleService.create(vehicleData);
      vehicles.push(vehicle);
      if ((i + 1) % 10 === 0) {
        console.log(`   ✓ Created ${i + 1}/${sampleVehicles.length} vehicles...`);
      }
    } catch (createError) {
      console.error(`❌ Failed to create vehicle ${i + 1}:`, createError);
      // Continue with other vehicles even if one fails
    }
  }
  
  console.log(`✅ Successfully created ${vehicles.length} vehicles`);
  return vehicles;
}

// System handler - consolidates system.ts
async function handleSystem(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const { action } = req.query;
  
  switch (action) {
    case 'health':
      return await handleHealth(req, res);
    case 'test-connection':
      return await handleTestConnection(req, res);
    default:
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid system action. Use ?action=health or ?action=test-connection' 
      });
  }
}

// Test Connection Handler
async function handleTestConnection(_req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🔍 Testing Firebase connection...');
    
    if (!USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        message: 'Firebase is not configured',
        timestamp: new Date().toISOString(),
        details: {
          connection: 'failed',
          database: 'unreachable',
          reason: 'Firebase environment variables not set'
        }
      });
    }
    
    // Test Firebase connection by reading a test path
    await adminRead(DB_PATHS.USERS, 'test');
    
    return res.status(200).json({
      success: true,
      message: 'Firebase connection test successful',
      timestamp: new Date().toISOString(),
      details: {
        connection: 'active',
        database: 'Firebase Realtime Database',
        collections: 'accessible'
      }
    });
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Firebase connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      details: {
        connection: 'failed',
        database: 'unreachable',
        collections: 'inaccessible'
      }
    });
  }
}

// Firebase write operations test handler
async function handleTestFirebaseWrites(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      reason: 'Method not allowed. Use POST to run tests.' 
    });
  }

  try {
    console.log('🧪 Testing Firebase write operations...');
    
    if (!USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        message: 'Firebase is not configured',
        timestamp: new Date().toISOString(),
        details: {
          connection: 'failed',
          database: 'unreachable',
          reason: 'Firebase environment variables not set'
        }
      });
    }

    const testResults: {
      create: { success: boolean; error?: string; testId?: string };
      update: { success: boolean; error?: string };
      modify: { success: boolean; error?: string };
      delete: { success: boolean; error?: string };
    } = {
      create: { success: false },
      update: { success: false },
      modify: { success: false },
      delete: { success: false },
    };

    const testCollection = 'test_firebase_writes';
    const testId = `test_${Date.now()}`;

    // Type for test data
    type TestData = {
      testField: string;
      testNumber: number;
      testBoolean: boolean;
      createdAt?: string;
      updatedAt?: string;
    };

    // Test 1: CREATE Operation
    try {
      console.log(`📋 Test 1: CREATE - Creating test document ${testId}`);
      const testData = {
        testField: 'original_value',
        testNumber: 100,
        testBoolean: true,
        createdAt: new Date().toISOString(),
      };
      
      await adminCreate(testCollection, testData, testId);
      
      // Verify create
      const created = await adminRead<TestData>(testCollection, testId);
      if (created && created.testField === 'original_value') {
        testResults.create = { success: true, testId };
        console.log(`✅ CREATE test passed: ${testId}`);
      } else {
        testResults.create = { success: false, error: 'Created document verification failed', testId };
        console.log(`❌ CREATE test failed: Verification failed`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      testResults.create = { success: false, error: errorMessage, testId };
      console.error(`❌ CREATE test failed:`, errorMessage);
    }

    // Test 2: UPDATE Operation (only if CREATE succeeded)
    if (testResults.create.success) {
      try {
        console.log(`📋 Test 2: UPDATE - Updating test document ${testId}`);
        const updates = {
          testField: 'updated_value',
          testNumber: 200,
          updatedAt: new Date().toISOString(),
        };
        
        await adminUpdate(testCollection, testId, updates);
        
        // Verify update
        const updated = await adminRead<TestData>(testCollection, testId);
        if (updated && updated.testField === 'updated_value' && updated.testNumber === 200) {
          testResults.update = { success: true };
          console.log(`✅ UPDATE test passed: ${testId}`);
        } else {
          testResults.update = { success: false, error: 'Update verification failed' };
          console.log(`❌ UPDATE test failed: Verification failed`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        testResults.update = { success: false, error: errorMessage };
        console.error(`❌ UPDATE test failed:`, errorMessage);
      }
    } else {
      testResults.update = { success: false, error: 'Skipped: CREATE test failed' };
    }

    // Test 3: MODIFY Operation (partial update)
    if (testResults.update.success) {
      try {
        console.log(`📋 Test 3: MODIFY - Partially updating test document ${testId}`);
        const partialUpdates = {
          testNumber: 300,
        };
        
        await adminUpdate(testCollection, testId, partialUpdates);
        
        // Verify modify
        const modified = await adminRead<TestData>(testCollection, testId);
        if (modified && modified.testNumber === 300 && modified.testField === 'updated_value') {
          testResults.modify = { success: true };
          console.log(`✅ MODIFY test passed: ${testId}`);
        } else {
          testResults.modify = { success: false, error: 'Modify verification failed' };
          console.log(`❌ MODIFY test failed: Verification failed`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        testResults.modify = { success: false, error: errorMessage };
        console.error(`❌ MODIFY test failed:`, errorMessage);
      }
    } else {
      testResults.modify = { success: false, error: 'Skipped: UPDATE test failed' };
    }

    // Test 4: DELETE Operation (only if previous tests succeeded)
    if (testResults.create.success) {
      try {
        console.log(`📋 Test 4: DELETE - Deleting test document ${testId}`);
        await adminDelete(testCollection, testId);
        
        // Verify delete
        const deleted = await adminRead(testCollection, testId);
        if (!deleted) {
          testResults.delete = { success: true };
          console.log(`✅ DELETE test passed: ${testId}`);
        } else {
          testResults.delete = { success: false, error: 'Delete verification failed - document still exists' };
          console.log(`❌ DELETE test failed: Document still exists`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        testResults.delete = { success: false, error: errorMessage };
        console.error(`❌ DELETE test failed:`, errorMessage);
      }
    } else {
      testResults.delete = { success: false, error: 'Skipped: CREATE test failed' };
    }

    // Calculate overall success
    const allTestsPassed = Object.values(testResults).every(test => test.success);
    const passedCount = Object.values(testResults).filter(test => test.success).length;
    const totalCount = Object.keys(testResults).length;

    return res.status(allTestsPassed ? 200 : 500).json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? `All ${totalCount} Firebase write operation tests passed!`
        : `${passedCount}/${totalCount} tests passed`,
      timestamp: new Date().toISOString(),
      results: testResults,
      summary: {
        total: totalCount,
        passed: passedCount,
        failed: totalCount - passedCount,
        testId: testResults.create.testId,
        collection: testCollection,
      },
    });

  } catch (error) {
    console.error('❌ Firebase write operations test failed:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Firebase write operations test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

// Utils handler - consolidates utils.ts
async function handleUtils(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.includes('/test-connection') || pathname.endsWith('/test-connection')) {
    return await handleTestConnection(req, res);
  } else if (pathname.includes('/test-firebase-writes') || pathname.endsWith('/test-firebase-writes')) {
    return await handleTestFirebaseWrites(req, res);
  } else {
    return res.status(404).json({ success: false, reason: 'Utility endpoint not found' });
  }
}

// AI handler - consolidates ai.ts
async function handleAI(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.includes('/gemini') || pathname.endsWith('/gemini')) {
    return await handleGemini(req, res);
  } else {
    return res.status(404).json({ success: false, reason: 'AI endpoint not found' });
  }
}

// Gemini handler
async function handleGemini(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  try {
    const { payload } = req.body;
    
    if (!payload) {
      return res.status(400).json({ 
        success: false, 
        reason: 'Payload is required' 
      });
    }

    // Validate API key presence
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        reason: 'GEMINI_API_KEY environment variable is not configured'
      });
    }

    // Extract model, contents, and config from payload
    const model = payload.model || 'gemini-2.5-flash';
    const contents = payload.contents || payload.prompt || '';
    const config = payload.config || {};

    // Build the request body for Gemini API
    const requestBody: any = {
      contents: typeof contents === 'string' 
        ? [{ parts: [{ text: contents }] }]
        : contents
    };

    // Add generation config if provided
    if (config.responseMimeType) {
      requestBody.generationConfig = {
        responseMimeType: config.responseMimeType
      };
    }

    // Add response schema if provided
    if (config.responseSchema) {
      if (!requestBody.generationConfig) {
        requestBody.generationConfig = {};
      }
      requestBody.generationConfig.responseSchema = config.responseSchema;
    }

    // Add thinking config if provided
    if (config.thinkingConfig) {
      requestBody.generationConfig = requestBody.generationConfig || {};
      requestBody.generationConfig.thinkingConfig = config.thinkingConfig;
    }

    // Use the new Gemini API endpoint format
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `API error: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.error || errorBody || errorMessage;
      } catch {
        errorMessage = errorBody || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Extract response text - handle both text and JSON responses
    let generatedText = '';
    if (data.candidates && data.candidates[0]) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        // For JSON responses, the text might be in parts[0].text
        generatedText = candidate.content.parts[0]?.text || '';
      }
    }

    // If no text found, try alternative paths
    if (!generatedText && data.text) {
      generatedText = data.text;
    }

    // If still no text, return the full response for debugging
    if (!generatedText) {
      generatedText = JSON.stringify(data);
    }

    return res.status(200).json({
      success: true,
      response: generatedText,
      result: generatedText, // Alias for compatibility
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    
    return res.status(500).json({
      success: false,
      reason: 'Gemini API call failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Content handler - consolidates content.ts
async function handleContent(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  if (!USE_SUPABASE) {
    // For GET requests, return 200 with empty array instead of 503
    if (req.method === 'GET') {
      const { type } = req.query;
      res.setHeader('X-Data-Fallback', 'true');
      if (type === 'faqs' || type === 'support-tickets') {
        return res.status(200).json([]);
      }
    }
    return res.status(503).json({
      success: false,
      reason: 'Firebase is not configured. Please set Firebase environment variables.'
    });
  }

  try {
    const { type } = req.query;
    
    switch (type) {
      case 'faqs':
        return await handleFAQs(req, res);
      case 'support-tickets':
        return await handleSupportTickets(req, res);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid content type. Use ?type=faqs or ?type=support-tickets' 
        });
    }
  } catch (error) {
    console.error('Content API Error:', error);
    
    // For GET requests, always return 200 with empty array instead of 500
    if (req.method === 'GET') {
      const { type } = req.query;
      if (type === 'faqs') {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json([]);
      }
      if (type === 'support-tickets') {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json([]);
      }
    }
    
    // For other methods, return 500 with error details
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// FAQs Handler
async function handleFAQs(req: VercelRequest, res: VercelResponse) {
  const faqsPath = 'faqs';

  switch (req.method) {
    case 'GET':
      return await handleGetFAQs(req, res, faqsPath);
    case 'POST':
      return await handleCreateFAQ(req, res, faqsPath);
    case 'PUT':
      return await handleUpdateFAQ(req, res, faqsPath);
    case 'DELETE':
      return await handleDeleteFAQ(req, res, faqsPath);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetFAQs(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const { category } = req.query;
    
    const allFaqs = await adminReadAll<Record<string, unknown>>(faqsPath);
    // CRITICAL: Spread data first, then set id to preserve string ID from key
    let faqs = Object.entries(allFaqs).map(([id, data]) => ({ ...data, id }));
    
    if (category && category !== 'all' && typeof category === 'string') {
      // Sanitize category
      const sanitizedCategory = await sanitizeString(category);
      faqs = faqs.filter(faq => ((faq as Record<string, unknown>).category as string) === sanitizedCategory);
    }
    
    return res.status(200).json({
      success: true,
      faqs,
      count: faqs.length
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    // Always return 200 with empty array instead of 500
    res.setHeader('X-Data-Fallback', 'true');
    return res.status(200).json({
      success: true,
      faqs: [],
      count: 0
    });
  }
}

async function handleCreateFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const faqData = req.body;
    
    if (!faqData.question || !faqData.answer || !faqData.category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, answer, category'
      });
    }

    const id = `faq_${Date.now()}`;
    const faq = {
      ...faqData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await adminCreate(faqsPath, faq, id);

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      faq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create FAQ'
    });
  }
}

async function handleUpdateFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    const existing = await adminRead<Record<string, unknown>>(faqsPath, String(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    await adminUpdate(faqsPath, String(id), {
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'FAQ updated successfully'
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update FAQ'
    });
  }
}

async function handleDeleteFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    await adminDelete(faqsPath, String(id));

    return res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ'
    });
  }
}

// Support Tickets Handler
async function handleSupportTickets(req: VercelRequest, res: VercelResponse) {
  const ticketsPath = 'support_tickets';
  const auth = requireAuth(req, res, 'Support tickets');
  if (!auth) {
    return;
  }

  switch (req.method) {
    case 'GET':
      return await handleGetSupportTickets(req, res, ticketsPath, auth);
    case 'POST':
      return await handleCreateSupportTicket(req, res, ticketsPath, auth);
    case 'PUT':
      return await handleUpdateSupportTicket(req, res, ticketsPath, auth);
    case 'DELETE':
      return await handleDeleteSupportTicket(req, res, ticketsPath, auth);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetSupportTickets(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: AuthResult
) {
  try {
    const { userEmail, status } = req.query;
    const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
    const isAdmin = auth.user?.role === 'admin';
    
    const allTickets = await adminReadAll<Record<string, unknown>>(ticketsPath);
    // CRITICAL: Spread data first, then set id to preserve string ID from key
    let tickets = Object.entries(allTickets).map(([id, data]) => ({ ...data, id }));
    
    if (userEmail && typeof userEmail === 'string') {
      // Sanitize email
      const sanitizedEmail = await sanitizeString(userEmail);
      if (!isAdmin && normalizedAuthEmail !== sanitizedEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: 'Unauthorized access to support tickets' });
      }
      tickets = tickets.filter(ticket => ((ticket as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() === sanitizedEmail.toLowerCase().trim());
    } else if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to support tickets' });
    }
    
    if (status && typeof status === 'string') {
      // Validate status is one of allowed values
      const allowedStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
      if (allowedStatuses.includes(status)) {
        tickets = tickets.filter(ticket => (ticket as Record<string, unknown>).status === status);
      }
    }

    // Sort by createdAt descending
    tickets = tickets.sort((a, b) => {
      const aTime = (a as Record<string, unknown>).createdAt ? new Date((a as Record<string, unknown>).createdAt as string).getTime() : 0;
      const bTime = (b as Record<string, unknown>).createdAt ? new Date((b as Record<string, unknown>).createdAt as string).getTime() : 0;
      return bTime - aTime;
    });
    
    return res.status(200).json({
      success: true,
      tickets: tickets,
      count: tickets.length
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch support tickets' 
    });
  }
}

async function handleCreateSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: AuthResult
) {
  try {
    const ticketData = req.body;
    const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
    const isAdmin = auth.user?.role === 'admin';
    
    if (!ticketData.userEmail || !ticketData.userName || !ticketData.subject || !ticketData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userEmail, userName, subject, message'
      });
    }

    const sanitizedEmail = (await sanitizeString(String(ticketData.userEmail))).toLowerCase().trim();
    if (!isAdmin && sanitizedEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket creation' });
    }

    const id = `ticket_${Date.now()}`;
    const ticket = {
      ...ticketData,
      userEmail: isAdmin ? sanitizedEmail : normalizedAuthEmail,
      id,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: []
    };

    await adminCreate(ticketsPath, ticket, id);

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
}

async function handleUpdateSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: AuthResult
) {
  try {
    const { id } = req.query;
    const updateData = req.body;
    const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
    const isAdmin = auth.user?.role === 'admin';

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const existing = await adminRead<Record<string, unknown>>(ticketsPath, String(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    const existingOwnerEmail = ((existing as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() || '';
    if (!isAdmin && existingOwnerEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket update' });
    }

    if (!isAdmin && updateData?.userEmail) {
      delete updateData.userEmail;
    }

    await adminUpdate(ticketsPath, String(id), {
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Support ticket updated successfully'
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update support ticket'
    });
  }
}

async function handleDeleteSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: AuthResult
) {
  try {
    const { id } = req.query;
    const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
    const isAdmin = auth.user?.role === 'admin';

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const existing = await adminRead<Record<string, unknown>>(ticketsPath, String(id));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Support ticket not found' });
    }

    const existingOwnerEmail = ((existing as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() || '';
    if (!isAdmin && existingOwnerEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket deletion' });
    }

    await adminDelete(ticketsPath, String(id));

    return res.status(200).json({
      success: true,
      message: 'Support ticket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete support ticket'
    });
  }
}

// Sell Car handler - consolidates sell-car/index.ts
async function handleSellCar(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  if (!USE_SUPABASE) {
    return res.status(503).json({
      success: false,
      reason: 'Firebase is not configured. Please set Firebase environment variables.'
    });
  }

  const { method } = req;

  const submissionsPath = 'sell_car_submissions';

  try {

    switch (method) {
      case 'POST':
        const submissionData = {
          ...req.body,
          submittedAt: new Date().toISOString(),
          status: 'pending'
        };

        const requiredFields = [
          'registration', 'make', 'model', 'variant', 'year', 
          'district', 'noOfOwners', 'kilometers', 'fuelType', 
          'transmission', 'customerContact'
        ];

        const missingFields: string[] = [];
        for (const field of requiredFields) {
          if (!submissionData[field as keyof typeof submissionData]) {
            missingFields.push(field);
          }
        }

        if (missingFields.length > 0) {
          return res.status(400).json({ 
            error: `Missing required fields: ${missingFields.join(', ')}` 
          });
        }

        // Check for existing submission
        const existingSubmissions = await adminReadAll<Record<string, unknown>>(submissionsPath);
        const existingSubmission = Object.values(existingSubmissions).find(
          (sub: any) => sub.registration === submissionData.registration
        );

        if (existingSubmission) {
          return res.status(409).json({ 
            error: 'Car with this registration number already submitted' 
          });
        }

        // Sanitize submission data
        const sanitizedSubmissionData = await sanitizeObject(submissionData);
        const submissionId = `submission_${Date.now()}`;
        await adminCreate(submissionsPath, sanitizedSubmissionData, submissionId);
        
        res.status(201).json({
          success: true,
          id: submissionId,
          message: 'Car submission received successfully'
        });
        break;

      case 'GET':
        const { page = 1, limit = 10, status: statusFilter, search } = req.query;
        const pageNum = parseInt(String(page), 10) || 1;
        const limitNum = parseInt(String(limit), 10) || 10;
        
        let allSubmissions = await adminReadAll<Record<string, unknown>>(submissionsPath);
        // CRITICAL: Spread data first, then set id to preserve string ID from key
        let submissions = Object.entries(allSubmissions).map(([id, data]) => ({ ...data, id }));
        
        // Filter by status
        if (statusFilter && typeof statusFilter === 'string') {
          const allowedStatuses = ['pending', 'approved', 'rejected', 'processing'];
          if (allowedStatuses.includes(statusFilter.toLowerCase())) {
            submissions = submissions.filter((sub: any) => sub.status === statusFilter);
          }
        }
        
        // Filter by search
        if (search && typeof search === 'string') {
          const sanitizedSearch = await sanitizeString(search);
          const searchLower = sanitizedSearch.toLowerCase();
          submissions = submissions.filter((sub: any) => 
            (sub.registration as string)?.toLowerCase().includes(searchLower) ||
            (sub.make as string)?.toLowerCase().includes(searchLower) ||
            (sub.model as string)?.toLowerCase().includes(searchLower) ||
            (sub.customerContact as string)?.toLowerCase().includes(searchLower)
          );
        }

        // Sort by submittedAt descending
        submissions = submissions.sort((a, b) => {
          const aTime = (a as Record<string, unknown>).submittedAt ? new Date((a as Record<string, unknown>).submittedAt as string).getTime() : 0;
          const bTime = (b as Record<string, unknown>).submittedAt ? new Date((b as Record<string, unknown>).submittedAt as string).getTime() : 0;
          return bTime - aTime;
        });

        const total = submissions.length;
        const skip = Math.max(0, (pageNum - 1) * limitNum);
        const paginatedSubmissions = submissions.slice(skip, skip + limitNum);

        res.status(200).json({
          success: true,
          data: paginatedSubmissions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        });
        break;

      case 'PUT':
        const { id: submissionUpdateId, status: updateStatus, adminNotes, estimatedPrice } = req.body;
        
        if (!submissionUpdateId) {
          return res.status(400).json({ error: 'Submission ID is required' });
        }

        const existing = await adminRead<Record<string, unknown>>(submissionsPath, String(submissionUpdateId));
        if (!existing) {
          return res.status(404).json({ error: 'Submission not found' });
        }

        interface SubmissionUpdateData {
          status?: string;
          adminNotes?: string;
          estimatedPrice?: number;
          updatedAt: string;
        }
        const submissionUpdates: SubmissionUpdateData = {
          updatedAt: new Date().toISOString()
        };
        
        // Validate and sanitize update fields
        if (updateStatus && typeof updateStatus === 'string') {
          const allowedStatuses = ['pending', 'approved', 'rejected', 'processing'];
          if (allowedStatuses.includes(updateStatus.toLowerCase())) {
            submissionUpdates.status = updateStatus;
          }
        }
        if (adminNotes && typeof adminNotes === 'string') {
          submissionUpdates.adminNotes = await sanitizeString(adminNotes);
        }
        if (estimatedPrice && typeof estimatedPrice === 'number') {
          submissionUpdates.estimatedPrice = estimatedPrice;
        }

        await adminUpdate(submissionsPath, String(submissionUpdateId), submissionUpdates as unknown as Record<string, unknown>);

        res.status(200).json({
          success: true,
          message: 'Submission updated successfully'
        });
        break;

      case 'DELETE':
        const { id: deleteId } = req.query;
        
        if (!deleteId) {
          return res.status(400).json({ error: 'Submission ID is required' });
        }

        await adminDelete(submissionsPath, String(deleteId));

        res.status(200).json({
          success: true,
          message: 'Submission deleted successfully'
        });
        break;

      default:
        res.setHeader('Allow', 'POST, GET, PUT, DELETE');
        res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('❌ Sell Car API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage
    });
  }
}

// Business handler - consolidates business.ts (payments and plans)
async function handleBusiness(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname || '';
    
    // Preferred: explicit query (?type=payments|plans)
    let type = (req.query.type as string) || '';
    
    // Backward/alternate compatibility: infer from path
    if (!type) {
      if (pathname.includes('/payments')) {
        type = 'payments';
      } else if (pathname.includes('/plans')) {
        type = 'plans';
      }
    }
    
    switch (type) {
      case 'payments':
        return await handlePayments(req, res, _options);
      case 'plans':
        return await handlePlans(req, res, _options);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid business type. Use ?type=payments or ?type=plans' 
        });
    }
  } catch (error) {
    console.error('Business API Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Payments Handler
async function handlePayments(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  try {
    if (!USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    const { action } = req.query;
    const paymentRequestsPath = 'payment_requests';

    if (action === 'create') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { sellerEmail, amount, plan, packageId } = req.body;
        
        if (!sellerEmail || !amount || !plan) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email, amount, and plan are required' 
          });
        }

        // Persist payment request in Supabase
        const paymentRequest = {
          id: `payment_${Date.now()}`,
          sellerEmail,
          amount,
          plan,
          packageId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await adminCreate(paymentRequestsPath, paymentRequest, String(paymentRequest.id));

        return res.status(201).json({
          success: true,
          paymentRequest,
          message: 'Payment request created successfully'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to create payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'status') {
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { sellerEmail } = req.query;
        
        if (!sellerEmail) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email is required' 
          });
        }

        const allRequests = await adminReadAll<Record<string, unknown>>(paymentRequestsPath);
        const sellerRequests = Object.values(allRequests)
          .filter((r) => String(r.sellerEmail || '').toLowerCase().trim() === String(sellerEmail).toLowerCase().trim())
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
            const bTime = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
            return bTime - aTime;
          });

        const latest = sellerRequests[0];
        const paymentStatus = latest
          ? {
              sellerEmail: String(latest.sellerEmail || sellerEmail),
              status: String(latest.status || 'pending'),
              lastPayment: latest,
              nextDue: null
            }
          : {
              sellerEmail: sellerEmail as string,
              status: 'none',
              lastPayment: null,
              nextDue: null
            };

        return res.status(200).json({
          success: true,
          paymentStatus
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment status',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'approve') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { paymentRequestId } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        await adminUpdate(paymentRequestsPath, String(paymentRequestId), {
          status: 'approved',
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: req.body?.notes,
          adminEmail: req.body?.adminEmail
        });

        return res.status(200).json({
          success: true,
          message: 'Payment request approved successfully',
          paymentRequestId
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to approve payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'reject') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { paymentRequestId, rejectionReason } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        await adminUpdate(paymentRequestsPath, String(paymentRequestId), {
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          rejectionReason: rejectionReason || 'No reason provided',
          adminEmail: req.body?.adminEmail
        });

        return res.status(200).json({
          success: true,
          message: 'Payment request rejected',
          paymentRequestId,
          reason: rejectionReason || 'No reason provided'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to reject payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Get all payment requests
    if (req.method === 'GET') {
      try {
        const { status } = req.query;
        const allRequests = await adminReadAll<Record<string, unknown>>(paymentRequestsPath);
        let paymentRequests = Object.values(allRequests);

        if (status && typeof status === 'string') {
          const normalizedStatus = status.toLowerCase().trim();
          paymentRequests = paymentRequests.filter((request) =>
            String(request.status || '').toLowerCase().trim() === normalizedStatus
          );
        }

        paymentRequests = paymentRequests.sort((a, b) => {
          const aTime = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
          const bTime = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
          return bTime - aTime;
        });
        
        return res.status(200).json({
          success: true,
          paymentRequests
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment requests',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Handle invalid or missing action parameter
    if (!action) {
      return res.status(400).json({ 
        success: false, 
        reason: 'Action parameter is required. Valid actions: create, status, approve, reject' 
      });
    }

    // If action doesn't match any known action, return 400 instead of 500
    return res.status(400).json({ 
      success: false, 
      reason: `Invalid payment action: ${action}. Valid actions: create, status, approve, reject` 
    });
  } catch (error) {
    console.error('Payments Handler Error:', error);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // If it's a database connection error, return 503
    if (error instanceof Error && (error.message.includes('FIREBASE') || error.message.includes('Firebase') || error.message.includes('connect'))) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Payments handler failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Conversations Handler
async function handleConversations(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  try {
    if (!USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    // CRITICAL FIX: Make authentication optional for GET requests
    // If no auth token, return empty array instead of 401 (user might not be logged in yet)
    let auth: AuthResult | null = null;
    let normalizedAuthEmail = '';
    let isAdmin = false;
    
    if (req.method === 'GET') {
      // Try to authenticate, but don't fail if no token
      auth = authenticateRequest(req);
      if (auth.isValid && auth.user) {
        normalizedAuthEmail = auth.user.email ? auth.user.email.toLowerCase().trim() : '';
        isAdmin = auth.user.role === 'admin';
      }
      // If auth fails, continue with empty auth (will return empty array)
    } else {
      // POST/PUT/DELETE require authentication
      auth = requireAuth(req, res, 'Conversations');
      if (!auth) {
        return;
      }
      normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      isAdmin = auth.user?.role === 'admin';
    }

    // GET - Retrieve conversations
    if (req.method === 'GET') {
      const { customerId, sellerId, conversationId } = req.query;
      
      if (conversationId) {
        // Get single conversation
        const conversation = await conversationService.findById(String(conversationId));
        if (!conversation) {
          return res.status(404).json({ success: false, reason: 'Conversation not found' });
        }
        const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
        const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
        // If not authenticated, return 404 (don't reveal conversation exists)
        if (!auth || !auth.isValid) {
          return res.status(404).json({ success: false, reason: 'Conversation not found' });
        }
        if (!isAdmin && normalizedAuthEmail !== normalizedCustomerId && normalizedAuthEmail !== normalizedSellerId) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to conversation' });
        }
        return res.status(200).json({ success: true, data: conversation });
      }
      
      let conversations;
      if (customerId) {
        const normalizedCustomerId = String(customerId).toLowerCase().trim();
        // If not authenticated, return empty array
        if (!auth || !auth.isValid) {
          return res.status(200).json({ success: true, data: [] });
        }
        if (!isAdmin && normalizedAuthEmail !== normalizedCustomerId) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to conversations' });
        }
        conversations = await conversationService.findByCustomerId(String(customerId));
      } else if (sellerId) {
        const normalizedSellerId = String(sellerId).toLowerCase().trim();
        // If not authenticated, return empty array
        if (!auth || !auth.isValid) {
          return res.status(200).json({ success: true, data: [] });
        }
        if (!isAdmin && normalizedAuthEmail !== normalizedSellerId) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to conversations' });
        }
        // CRITICAL: Pass normalized sellerId to service for consistent matching
        // The service will also normalize internally, but passing normalized ensures consistency
        conversations = await conversationService.findBySellerId(normalizedSellerId);
        
        // Log for debugging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 API: Fetching conversations for seller', {
            originalSellerId: String(sellerId),
            normalizedSellerId,
            foundCount: conversations?.length || 0
          });
        }
      } else {
        // No customerId or sellerId - return empty array if not admin or not authenticated
        if (!auth || !auth.isValid || !isAdmin) {
          // Return empty array instead of 401 for unauthenticated requests
          return res.status(200).json({ success: true, data: [] });
        }
        conversations = await conversationService.findAll();
      }
      
      // Sort by lastMessageAt descending
      conversations = conversations.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
      
      return res.status(200).json({ success: true, data: conversations });
    }

    // POST - Create or update conversation
    if (req.method === 'POST') {
      const conversationData = req.body;
      
      if (!conversationData.id) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      const normalizedCustomerId = String(conversationData.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversationData.sellerId || '').toLowerCase().trim();
      if (!isAdmin && normalizedAuthEmail !== normalizedCustomerId && normalizedAuthEmail !== normalizedSellerId) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
      }

      // Check if conversation exists
      const existing = await conversationService.findById(conversationData.id);
      if (existing) {
        await conversationService.update(conversationData.id, conversationData);
        const updated = await conversationService.findById(conversationData.id);
        return res.status(200).json({ success: true, data: updated });
      } else {
        const conversation = await conversationService.create(conversationData);
        return res.status(200).json({ success: true, data: conversation });
      }
    }

    // PUT - Update conversation (add message)
    if (req.method === 'PUT') {
      const { conversationId, message } = req.body;
      
      if (!conversationId || !message) {
        return res.status(400).json({ success: false, reason: 'Conversation ID and message are required' });
      }

      const conversation = await conversationService.findById(String(conversationId));

      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
      if (!isAdmin && normalizedAuthEmail !== normalizedCustomerId && normalizedAuthEmail !== normalizedSellerId) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
      }

      try {
        console.log('💾 API: Adding message to conversation:', { conversationId, messageId: message?.id });
        await conversationService.addMessage(String(conversationId), message);
        const updatedConversation = await conversationService.findById(String(conversationId));
        
        if (!updatedConversation) {
          console.error('❌ API: Conversation not found after adding message:', conversationId);
          return res.status(500).json({ success: false, reason: 'Failed to retrieve updated conversation' });
        }
        
        console.log('✅ API: Message added successfully:', { conversationId, messageId: message?.id, messageCount: updatedConversation.messages?.length });
        return res.status(200).json({ success: true, data: updatedConversation });
      } catch (error) {
        console.error('❌ API: Error adding message:', {
          conversationId,
          messageId: message?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        return res.status(500).json({ 
          success: false, 
          reason: error instanceof Error ? error.message : 'Failed to add message to conversation' 
        });
      }
    }

    // DELETE - Delete conversation
    if (req.method === 'DELETE') {
      const { conversationId } = req.query;
      
      if (!conversationId) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      const conversation = await conversationService.findById(String(conversationId));
      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
      if (!isAdmin && normalizedAuthEmail !== normalizedCustomerId && normalizedAuthEmail !== normalizedSellerId) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation deletion' });
      }

      await conversationService.delete(String(conversationId));
      return res.status(200).json({ success: true, message: 'Conversation deleted successfully' });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Enhanced error logging with context
    const errorDetails: any = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      requestMethod: req.method,
      requestUrl: req.url,
      queryParams: req.query,
    };
    
    if (error instanceof Error) {
      errorDetails.stack = error.stack;
      errorDetails.name = error.name;
    } else if (error && typeof error === 'object') {
      // Try to serialize the error object
      try {
        const errorObj = error as Record<string, any>;
        if (Object.keys(errorObj).length > 0) {
          errorDetails.errorObject = errorObj;
        } else {
          errorDetails.note = 'Error object is empty';
        }
      } catch (e) {
        errorDetails.serializationError = 'Failed to serialize error object';
      }
    } else {
      errorDetails.rawValue = String(error);
    }
    
    logError('Conversations Handler Error:', errorDetails);
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('FIREBASE') || errorMessage.includes('Firebase') || errorMessage.includes('connect')) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Failed to process conversation request',
      error: errorMessage
    });
  }
}

// Notifications Handler
async function handleNotifications(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  try {
    if (!USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    // CRITICAL FIX: Make authentication optional for GET requests
    // If no auth token, return empty array instead of 401 (user might not be logged in yet)
    let auth: AuthResult | null = null;
    let normalizedAuthEmail = '';
    let isAdmin = false;
    
    if (req.method === 'GET') {
      // Try to authenticate, but don't fail if no token
      auth = authenticateRequest(req);
      if (auth.isValid && auth.user) {
        normalizedAuthEmail = auth.user.email ? auth.user.email.toLowerCase().trim() : '';
        isAdmin = auth.user.role === 'admin';
      }
      // If auth fails, continue with empty auth (will return empty array for non-admin)
    } else {
      // POST/PUT/DELETE require authentication
      auth = requireAuth(req, res, 'Notifications');
      if (!auth) {
        return;
      }
      normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      isAdmin = auth.user?.role === 'admin';
    }

    // GET - Retrieve notifications
    if (req.method === 'GET') {
      const { recipientEmail, isRead, notificationId } = req.query;
      
      if (notificationId) {
        // Get single notification from Supabase
        // If not authenticated, return 404 (don't reveal notification exists)
        if (!auth || !auth.isValid) {
          return res.status(404).json({ success: false, reason: 'Notification not found' });
        }
        
        const supabase = getSupabaseAdminClient();
        const { data: notification, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', String(notificationId))
          .single();
        
        if (error || !notification) {
          return res.status(404).json({ success: false, reason: 'Notification not found' });
        }
        
        const recipient = (notification.recipient_email || notification.user_id || '').toString().toLowerCase().trim();
        if (!isAdmin && recipient && recipient !== normalizedAuthEmail) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to notification' });
        }
        return res.status(200).json({ success: true, data: notification });
      }
      
      // Get all notifications from Supabase and filter
      const supabase = getSupabaseAdminClient();
      const { data: allNotifications, error: fetchError } = await supabase
        .from('notifications')
        .select('*');
      
      if (fetchError) {
        logError('❌ Failed to fetch notifications:', fetchError);
        return res.status(500).json({ success: false, reason: 'Failed to fetch notifications' });
      }
      
      let notifications = (allNotifications || []).map((notif: any) => ({
        ...notif,
        id: notif.id,
        recipientEmail: notif.recipient_email || notif.user_id,
        isRead: notif.read || notif.is_read
      }));
      
      if (recipientEmail) {
        const emailValue = Array.isArray(recipientEmail) ? recipientEmail[0] : recipientEmail;
        const normalizedEmail = emailValue.toLowerCase().trim();
        // If not authenticated or not admin, only return notifications for the authenticated user
        if (!auth || !auth.isValid) {
          // No auth token - return empty array instead of 401
          return res.status(200).json({ success: true, data: [] });
        }
        if (!isAdmin && normalizedAuthEmail !== normalizedEmail) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to notifications' });
        }
        notifications = notifications.filter(n => {
          const recipient = n.recipientEmail || n.recipient_email || n.user_id || '';
          return recipient.toString().toLowerCase().trim() === normalizedEmail;
        });
      } else {
        // No recipientEmail specified - only admins can see all notifications
        if (!auth || !auth.isValid || !isAdmin) {
          // Return empty array instead of 401/403 for unauthenticated or non-admin requests
          return res.status(200).json({ success: true, data: [] });
        }
      }
      
      if (isRead !== undefined) {
        const isReadValue = Array.isArray(isRead) ? isRead[0] : isRead;
        const isReadBool = isReadValue === 'true';
        notifications = notifications.filter(n => (n.isRead || n.read) === isReadBool);
      }
      
      // Sort by timestamp descending
      notifications = notifications.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
      
      return res.status(200).json({ success: true, data: notifications });
    }

    // POST - Create notification
    if (req.method === 'POST') {
      const notificationData = req.body;
      
      if (!notificationData.id || !notificationData.recipientEmail) {
        return res.status(400).json({ success: false, reason: 'Notification ID and recipient email are required' });
      }

      // Normalize email
      const normalizedEmail = notificationData.recipientEmail.toLowerCase().trim();
      if (!isAdmin && normalizedEmail !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification creation' });
      }
      
      // Create notification in Supabase
      const supabase = getSupabaseAdminClient();
      const notificationRecord = {
        id: String(notificationData.id),
        user_id: normalizedEmail,
        recipient_email: normalizedEmail,
        type: notificationData.targetType || 'general',
        title: notificationData.title || notificationData.message?.substring(0, 50) || 'Notification',
        message: notificationData.message || '',
        read: notificationData.isRead || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: notificationData
      };
      
      const { data: created, error: createError } = await supabase
        .from('notifications')
        .insert(notificationRecord)
        .select()
        .single();
      
      if (createError) {
        logError('❌ Failed to create notification:', createError);
        return res.status(500).json({ success: false, reason: 'Failed to create notification' });
      }
      
      return res.status(201).json({ success: true, data: created });
    }

    // PUT - Update notification (mark as read, etc.)
    if (req.method === 'PUT') {
      const { notificationId, updates } = req.body;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }

      // Get existing notification from Supabase
      const supabase = getSupabaseAdminClient();
      const { data: existing, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', String(notificationId))
        .single();
      
      if (fetchError || !existing) {
        return res.status(404).json({ success: false, reason: 'Notification not found' });
      }
      
      const recipient = (existing.recipient_email || existing.user_id || '').toString().toLowerCase().trim();
      if (!isAdmin && recipient && recipient !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification update' });
      }

      // Update notification in Supabase
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Map updates to Supabase column names
      if (updates.isRead !== undefined) updateData.read = updates.isRead;
      if (updates.message !== undefined) updateData.message = updates.message;
      if (updates.title !== undefined) updateData.title = updates.title;
      
      const { data: updated, error: updateError } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', String(notificationId))
        .select()
        .single();
      
      if (updateError) {
        logError('❌ Failed to update notification:', updateError);
        return res.status(500).json({ success: false, reason: 'Failed to update notification' });
      }
      
      return res.status(200).json({ success: true, data: updated });
    }

    // DELETE - Delete notification
    if (req.method === 'DELETE') {
      const { notificationId } = req.query;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }
      // Get existing notification from Supabase
      const supabase = getSupabaseAdminClient();
      const { data: existing, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', String(notificationId))
        .single();
      
      if (fetchError || !existing) {
        return res.status(404).json({ success: false, reason: 'Notification not found' });
      }
      
      const recipient = (existing.recipient_email || existing.user_id || '').toString().toLowerCase().trim();
      if (!isAdmin && recipient && recipient !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification deletion' });
      }

      // Delete notification from Supabase
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', String(notificationId));
      
      if (deleteError) {
        logError('❌ Failed to delete notification:', deleteError);
        return res.status(500).json({ success: false, reason: 'Failed to delete notification' });
      }
      
      return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Enhanced error logging with context
    const errorDetails: any = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      requestMethod: req.method,
      requestUrl: req.url,
      queryParams: req.query,
    };
    
    if (error instanceof Error) {
      errorDetails.stack = error.stack;
      errorDetails.name = error.name;
    } else if (error && typeof error === 'object') {
      // Try to serialize the error object
      try {
        const errorObj = error as Record<string, any>;
        if (Object.keys(errorObj).length > 0) {
          errorDetails.errorObject = errorObj;
        } else {
          errorDetails.note = 'Error object is empty';
        }
      } catch (e) {
        errorDetails.serializationError = 'Failed to serialize error object';
      }
    } else {
      errorDetails.rawValue = String(error);
    }
    
    logError('Notifications Handler Error:', errorDetails);
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('FIREBASE') || errorMessage.includes('Firebase') || errorMessage.includes('connect')) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Failed to process notification request',
      error: errorMessage
    });
  }
}

// Buyer Activity Handler
async function handleBuyerActivity(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  try {
    if (!USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Supabase is not configured. Please set Supabase environment variables.'
      });
    }

    const auth = requireAuth(req, res, 'Buyer Activity');
    if (!auth) {
      return;
    }
    const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
    const isAdmin = auth.user?.role === 'admin';

    // GET - Retrieve buyer activity
    if (req.method === 'GET') {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ success: false, reason: 'User ID is required' });
      }

      const userIdValue = Array.isArray(userId) ? userId[0] : userId;
      const normalizedUserId = userIdValue.toLowerCase().trim();
      
      // Users can only access their own activity (unless admin)
      if (!isAdmin && normalizedUserId !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized access to buyer activity' });
      }

      const supabase = getSupabaseAdminClient();
      const { data: activity, error } = await supabase
        .from('buyer_activity')
        .select('*')
        .eq('user_id', normalizedUserId)
        .single();

      if (error) {
        // If not found, return default activity
        if (error.code === 'PGRST116') {
          return res.status(200).json({
            success: true,
            data: {
              id: `activity_${normalizedUserId}`,
              userId: normalizedUserId,
              recentlyViewed: [],
              savedSearches: [],
              notifications: {
                priceDrops: [],
                newMatches: []
              }
            }
          });
        }
        logError('❌ Failed to fetch buyer activity:', error);
        return res.status(500).json({ success: false, reason: 'Failed to fetch buyer activity' });
      }

      // Transform database format to app format
      const transformedActivity = {
        id: activity.id,
        userId: activity.user_id,
        recentlyViewed: activity.recently_viewed || [],
        savedSearches: activity.saved_searches || [],
        notifications: {
          priceDrops: activity.price_drops || [],
          newMatches: activity.new_matches || []
        }
      };

      return res.status(200).json({ success: true, data: transformedActivity });
    }

    // POST - Create or update buyer activity
    if (req.method === 'POST' || req.method === 'PUT') {
      const activityData = req.body;
      
      if (!activityData.userId) {
        return res.status(400).json({ success: false, reason: 'User ID is required' });
      }

      const normalizedUserId = activityData.userId.toLowerCase().trim();
      
      // Users can only save their own activity (unless admin)
      if (!isAdmin && normalizedUserId !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized to save buyer activity' });
      }

      const supabase = getSupabaseAdminClient();
      
      // Check if activity exists
      const { data: existing } = await supabase
        .from('buyer_activity')
        .select('id')
        .eq('user_id', normalizedUserId)
        .single();

      const activityRecord: Record<string, unknown> = {
        id: existing?.id || `activity_${normalizedUserId}_${Date.now()}`,
        user_id: normalizedUserId,
        recently_viewed: activityData.recentlyViewed || [],
        saved_searches: activityData.savedSearches || [],
        price_drops: activityData.notifications?.priceDrops || [],
        new_matches: activityData.notifications?.newMatches || [],
        updated_at: new Date().toISOString()
      };

      let result;
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('buyer_activity')
          .update(activityRecord)
          .eq('user_id', normalizedUserId)
          .select()
          .single();

        if (error) {
          logError('❌ Failed to update buyer activity:', error);
          return res.status(500).json({ success: false, reason: 'Failed to update buyer activity' });
        }
        result = data;
      } else {
        // Create new
        activityRecord.created_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('buyer_activity')
          .insert(activityRecord)
          .select()
          .single();

        if (error) {
          logError('❌ Failed to create buyer activity:', error);
          return res.status(500).json({ success: false, reason: 'Failed to create buyer activity' });
        }
        result = data;
      }

      // Transform back to app format
      const transformedActivity = {
        id: result.id,
        userId: result.user_id,
        recentlyViewed: result.recently_viewed || [],
        savedSearches: result.saved_searches || [],
        notifications: {
          priceDrops: result.price_drops || [],
          newMatches: result.new_matches || []
        }
      };

      return res.status(200).json({ success: true, data: transformedActivity });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    logError('❌ Buyer Activity API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, reason: errorMessage, error: errorMessage });
  }
}

// Plans Handler
async function handlePlans(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  try {
    if (!USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }
    const plansPath = 'plans';
    const basePlanOrder = ['free', 'pro', 'premium'];
    const toNumber = (value: unknown, fallback: number): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const toListingLimit = (value: unknown, fallback: number | 'unlimited'): number | 'unlimited' => {
      if (value === 'unlimited' || value === 'unlimited') {
        return 'unlimited';
      }
      const n = Number(value);
      return Number.isFinite(n) ? n : (typeof fallback === 'number' ? fallback : 0);
    };

    const toPlanDetails = (id: string, row: Record<string, unknown>) => {
      const basePlan = PLAN_DETAILS[id as keyof typeof PLAN_DETAILS];
      const metadata = (row.metadata as Record<string, unknown> | undefined) || {};
      return {
        id,
        name: String(row.name || basePlan?.name || 'Custom Plan'),
        price: toNumber(row.price, basePlan?.price ?? 0),
        features: Array.isArray(row.features) ? row.features.map(String) : (basePlan?.features || []),
        listingLimit: toListingLimit(row.listingLimit ?? metadata.listingLimit, basePlan?.listingLimit ?? 0),
        featuredCredits: toNumber(row.featuredCredits ?? metadata.featuredCredits, basePlan?.featuredCredits ?? 0),
        freeCertifications: toNumber(row.freeCertifications ?? metadata.freeCertifications, basePlan?.freeCertifications ?? 0),
        isMostPopular: Boolean(row.isMostPopular ?? metadata.isMostPopular ?? basePlan?.isMostPopular ?? false),
      };
    };

    switch (req.method) {
      case 'GET': {
        const allRows = await adminReadAll<Record<string, unknown>>(plansPath);
        const fromDb = Object.entries(allRows).map(([id, row]) => toPlanDetails(id, row));
        const presentIds = new Set(fromDb.map((plan) => String(plan.id)));

        // Ensure base plans always exist in response
        const basePlans = Object.entries(PLAN_DETAILS)
          .filter(([id]) => !presentIds.has(id))
          .map(([id, plan]) => ({
            id,
            name: plan.name,
            price: plan.price,
            features: plan.features,
            listingLimit: plan.listingLimit,
            featuredCredits: plan.featuredCredits,
            freeCertifications: plan.freeCertifications,
            isMostPopular: Boolean(plan.isMostPopular),
          }));

        const plans = [...fromDb, ...basePlans].sort((a, b) => {
          const aIndex = basePlanOrder.indexOf(String(a.id));
          const bIndex = basePlanOrder.indexOf(String(b.id));
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return String(a.name).localeCompare(String(b.name));
        });

        return res.status(200).json(plans);
      }

      case 'POST': {
        if (!requireAdmin(req, res, 'Create plan')) {
          return;
        }
        const newPlanData = req.body || {};
        if (!newPlanData.name) {
          return res.status(400).json({ error: 'Plan name is required' });
        }

        const planId = String(newPlanData.id || `custom_${Date.now()}`);
        const record = {
          id: planId,
          name: String(newPlanData.name),
          price: toNumber(newPlanData.price, 0),
          features: Array.isArray(newPlanData.features) ? newPlanData.features : [],
          listingLimit: toNumber(newPlanData.listingLimit, 0),
          featuredCredits: toNumber(newPlanData.featuredCredits, 0),
          freeCertifications: toNumber(newPlanData.freeCertifications, 0),
          isMostPopular: Boolean(newPlanData.isMostPopular),
          isCustom: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await adminCreate(plansPath, record, planId);
        return res.status(201).json(toPlanDetails(planId, record));
      }

      case 'PUT': {
        if (!requireAdmin(req, res, 'Update plan')) {
          return;
        }
        const { planId: updatePlanId, ...updateData } = req.body || {};
        if (!updatePlanId || typeof updatePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }

        const existing = await adminRead<Record<string, unknown>>(plansPath, updatePlanId);
        const basePlan = PLAN_DETAILS[updatePlanId as keyof typeof PLAN_DETAILS];
        const merged = {
          ...(existing || {}),
          id: updatePlanId,
          name: String(updateData.name ?? existing?.name ?? basePlan?.name ?? 'Plan'),
          price: toNumber(updateData.price ?? existing?.price, basePlan?.price ?? 0),
          features: Array.isArray(updateData.features)
            ? updateData.features
            : (Array.isArray(existing?.features) ? existing?.features : (basePlan?.features || [])),
          listingLimit: toListingLimit(updateData.listingLimit ?? existing?.listingLimit, basePlan?.listingLimit ?? 0),
          featuredCredits: toNumber(updateData.featuredCredits ?? existing?.featuredCredits, basePlan?.featuredCredits ?? 0),
          freeCertifications: toNumber(updateData.freeCertifications ?? existing?.freeCertifications, basePlan?.freeCertifications ?? 0),
          isMostPopular: Boolean(updateData.isMostPopular ?? existing?.isMostPopular ?? basePlan?.isMostPopular ?? false),
          isCustom: !basePlan,
          updatedAt: new Date().toISOString(),
        };

        if (existing) {
          await adminUpdate(plansPath, updatePlanId, merged);
        } else {
          await adminCreate(plansPath, { ...merged, createdAt: new Date().toISOString() }, updatePlanId);
        }

        return res.status(200).json(toPlanDetails(updatePlanId, merged));
      }

      case 'DELETE': {
        if (!requireAdmin(req, res, 'Delete plan')) {
          return;
        }
        const { planId: deletePlanId } = req.query;
        if (!deletePlanId || typeof deletePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        if (['free', 'pro', 'premium'].includes(deletePlanId)) {
          return res.status(400).json({ error: 'Cannot delete base plans' });
        }

        await adminDelete(plansPath, deletePlanId);
        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Plans Handler Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Export with error wrapper to catch any initialization or module loading errors
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    return await mainHandler(req, res);
  } catch (error) {
    // Catch any errors that occur during handler initialization or module loading
    logError('❌ Fatal error in API handler:', error);
    
    // Ensure response headers are set
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown fatal error';
      const pathname = req.url?.split('?')[0] || '';
      
      // Special handling for critical endpoints - never return 500
      const isCriticalEndpoint = 
        pathname.includes('/vehicle-data') || 
        pathname.includes('/vehicles') && req.query?.type === 'data' ||
        pathname.includes('/users') ||
        pathname.includes('/vehicles') ||
        pathname.includes('/faqs');
      
      if (isCriticalEndpoint) {
        // Return 200 with fallback data instead of 500
        res.setHeader('X-Error-Fallback', 'true');
        
        if (pathname.includes('/vehicle-data') || (pathname.includes('/vehicles') && req.query?.type === 'data')) {
          return res.status(200).json({
            FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
            TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
          });
        }
        
        if (pathname.includes('/users')) {
          return res.status(200).json([]);
        }
        
        if (pathname.includes('/vehicles')) {
          return res.status(200).json([]);
        }
        
        if (pathname.includes('/faqs')) {
          return res.status(200).json([]);
        }
      }
      
      // For other endpoints, return 500 but with a user-friendly message
      return res.status(500).json({ 
        success: false, 
        reason: 'Internal server error',
        error: errorMessage
      });
    }
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { PLAN_DETAILS } from '../constants.js';
import { planService } from '../services/planService.js';
import type { User as UserType, Vehicle as VehicleType, SubscriptionPlan } from '../types.js';
import { VehicleCategory } from '../types.js';
// Firebase services
import { firebaseUserService } from '../services/firebase-user-service.js';
import { firebaseVehicleService } from '../services/firebase-vehicle-service.js';
import { firebaseConversationService } from '../services/firebase-conversation-service.js';
import { isDatabaseAvailable as isFirebaseAvailable, getDatabaseStatus } from '../lib/firebase-db.js';
import { 
  create,
  read,
  readAll,
  updateData,
  deleteData,
  queryByField,
  DB_PATHS
} from '../lib/firebase-db.js';

// Always use Firebase - MongoDB removed
// Note: This is checked at module load time. If Firebase is not available,
// API routes will return proper error messages with details on how to fix it.
const USE_FIREBASE = isFirebaseAvailable();

// Get Firebase status with detailed error information
function getFirebaseErrorMessage(): string {
  try {
    const status = getDatabaseStatus();
    if (status.available) {
      return '';
    }
    return status.details || status.error || 'Firebase database is not available. Please check your configuration.';
  } catch {
    return 'Firebase database is not available. Please check your configuration.';
  }
}
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

// Helper: Normalize Firebase user object for frontend consumption
// Ensures role is present, and removes password
function normalizeUser(user: UserType | null | undefined): NormalizedUser | null {
  if (!user) return null;
  
  // Firebase users already have id field (no _id conversion needed)
  const id = user.id;
  if (!id) {
    logWarn('⚠️ User object missing id field');
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
    const decoded = verifyToken(token);
    // Ensure role is present for the user object
    const user = {
      ...decoded,
      role: decoded.role || 'customer' as 'customer' | 'seller' | 'admin'
    };
    return { isValid: true, user };
  } catch (error) {
    return { isValid: false, error: 'Invalid or expired token' };
  }
};

// Rate limiting using MongoDB for serverless compatibility
const config = getSecurityConfig();

type HandlerOptions = {
  // Firebase-only - no MongoDB options needed
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

// Firebase-based rate limiting for serverless environments
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

  try {
    // Check Firebase availability
    if (!USE_FIREBASE) {
      const errorMsg = getFirebaseErrorMessage();
      logError('❌ Firebase not available:', errorMsg);
      if (req.method !== 'GET') {
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          details: 'Please check your Firebase configuration. Server-side requires FIREBASE_* environment variables (without VITE_ prefix).',
          fallback: true
        });
      }
      res.setHeader('X-Database-Fallback', 'true');
    }

    // Extract pathname early to check for rate limit exemptions
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
    } else if (pathname.includes('/admin') || pathname.endsWith('/admin')) {
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
    } else if (pathname.includes('/utils') || pathname.endsWith('/utils') || pathname.includes('/test-connection')) {
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
    
    // Check for Firebase/database errors first
    const isDbError = error instanceof Error && (
      error.message.includes('FIREBASE') || 
      error.message.includes('Firebase') ||
      error.message.includes('firebase') ||
      error.message.includes('PERMISSION_DENIED') ||
      error.message.includes('UNAUTHENTICATED') ||
      error.message.includes('UNAVAILABLE') ||
      // Firebase connection-related errors
      ((error.message.includes('connect') || error.message.includes('timeout') || error.message.includes('network')) && (
        error.message.includes('Firebase') ||
        error.message.includes('firebase') ||
        error.message.includes('database') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ))
    );
    
    if (isDbError) {
      logError('❌ Database error in main handler:', error instanceof Error ? error.message : 'Unknown error');
      // Check if it's a configuration error vs connection error
      if (error instanceof Error && (error.message.includes('FIREBASE') || error.message.includes('Firebase') || error.message.includes('firebase'))) {
        return res.status(503).json({ 
          success: false, 
          reason: 'Firebase configuration error. Please check Firebase environment variables.',
          details: 'The application requires Firebase to be properly configured. Please verify your Firebase credentials and project settings.'
        });
      }
      // General database connection/auth error
      return res.status(503).json({ 
        success: false, 
        reason: 'Database connection failed. Please ensure Firebase is properly configured and accessible.',
        details: 'Unable to connect to Firebase Realtime Database. Please check your Firebase configuration, credentials, and network connectivity.'
      });
    }
    
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Users handler - preserves exact functionality from users.ts
async function handleUsers(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    // FIX: Handle HEAD requests immediately to prevent 405 errors
    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    // Check Firebase availability
    if (!USE_FIREBASE) {
      const errorMsg = getFirebaseErrorMessage();
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

    const { action, email, password, role, name, mobile, firebaseUid, authProvider, avatarUrl } = req.body;

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
      
      // Normalize email to lowercase for consistent database lookup
      const normalizedEmail = sanitizedData.email.toLowerCase().trim();
      
      // Use Firebase only
      let user: UserType | null = null;
      
      try {
        user = await firebaseUserService.findByEmail(normalizedEmail);
      } catch (error) {
        logError('❌ Firebase user lookup error:', error);
        return res.status(500).json({ success: false, reason: 'Database error. Please try again.' });
      }

      if (!user) {
        return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
      }
      
      // Check if user has a password set (might be an OAuth user)
      if (!user.password) {
        return res.status(400).json({ 
          success: false, 
          reason: 'This account uses Google/Phone sign-in. Please use that method to login.' 
        });
      }
      
      // Verify password using bcrypt
      const isPasswordValid = await validatePassword(sanitizedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
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

      // Firebase connection is handled automatically - no need for connection checks

      // Sanitize and validate input data
      const sanitizedData = await sanitizeObject({ email, password, name, mobile, role });
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
          existingUser = await firebaseUserService.findByEmail(normalizedEmail);
        } catch (error) {
          logError('❌ Firebase user lookup error:', error);
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

        // Generate unique ID to avoid collisions
        const userId = Date.now() + Math.floor(Math.random() * 1000);

        const userData = {
          id: userId.toString(),
          email: normalizedEmail,
          password: hashedPassword,
          name: sanitizedData.name,
          mobile: sanitizedData.mobile,
          role: sanitizedData.role,
          location: '', // Default empty location, can be updated later
          status: 'active' as const,
          isVerified: false,
          subscriptionPlan: 'free' as const,
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        };

        let newUser: UserType;
        
        try {
          logInfo('💾 Attempting to save user to Firebase...');
          newUser = await firebaseUserService.create(userData);
          logInfo('✅ New user registered and saved to Firebase:', normalizedEmail);
          
          // Verify the user was saved
          const verifyUser = await firebaseUserService.findByEmail(normalizedEmail);
          if (!verifyUser) {
            logError('❌ User registration verification failed - user not found after save');
            return res.status(500).json({ 
              success: false, 
              reason: 'User registration failed - user was not saved to database. Please try again.' 
            });
          } else {
            logInfo('✅ User registration verified in database. User ID:', verifyUser.id);
            newUser = verifyUser;
          }
        } catch (error) {
          logError('❌ Error saving user to Firebase:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
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
        logError('❌ Error saving user to Firebase:', saveError);
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
      if (!firebaseUid || !email || !name || !role) {
        return res.status(400).json({ success: false, reason: 'OAuth data incomplete.' });
      }

      // Sanitize OAuth data
      const sanitizedData = await sanitizeObject({ firebaseUid, email, name, role, authProvider, avatarUrl });

      // Normalize email to lowercase for consistent database lookup
      const normalizedEmail = sanitizedData.email.toLowerCase().trim();
      let user = await firebaseUserService.findByEmail(normalizedEmail);
      
      if (!user) {
        logInfo('🔄 OAuth registration - Creating new user:', normalizedEmail);
        const userData = {
          id: Date.now().toString(),
          email: normalizedEmail,
          name: sanitizedData.name,
          role: sanitizedData.role,
          firebaseUid: sanitizedData.firebaseUid,
          authProvider: sanitizedData.authProvider,
          avatarUrl: sanitizedData.avatarUrl,
          status: 'active' as const,
          isVerified: true,
          subscriptionPlan: 'free' as const,
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        };
        
        logInfo('💾 Saving OAuth user to Firebase...');
        user = await firebaseUserService.create(userData);
        logInfo('✅ OAuth user saved to Firebase:', normalizedEmail);
        
        // Verify the user was saved by querying it back
        const verifyUser = await firebaseUserService.findByEmail(normalizedEmail);
        if (!verifyUser) {
          logError('❌ OAuth user registration verification failed - user not found after save');
          return res.status(500).json({ 
            success: false, 
            reason: 'OAuth registration failed - user was not saved to database. Please try again.' 
          });
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
        
        return res.status(200).json({ 
          success: true, 
          accessToken: newAccessToken 
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

  // GET - Get all users
  if (req.method === 'GET') {
    const { action, email } = req.query;
    
    if (action === 'trust-score' && email) {
      try {
        // Sanitize and normalize email
        const sanitizedEmail = await sanitizeString(String(email));
        const normalizedEmail = sanitizedEmail.toLowerCase().trim();
        const user = await firebaseUserService.findByEmail(normalizedEmail);
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
    
    try {
      
      const users = await firebaseUserService.findAll();
      // SECURITY FIX: Normalize all users to remove passwords
      const normalizedUsers = users.map(user => normalizeUser(user)).filter((u): u is NormalizedUser => u !== null);
      return res.status(200).json(normalizedUsers);
    } catch (error) {
      logError('❌ Error fetching users:', error);
      // Always return fallback instead of 500 to prevent crashes
      try {
        const fallbackUsers = await getFallbackUsers();
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(fallbackUsers);
      } catch (fallbackError) {
        // Even fallback failed, return empty array instead of 500
        logError('❌ Fallback users also failed:', fallbackError);
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json([]);
      }
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
      // Firebase connection is handled automatically
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
          } else {
            // Hash the plain text password before updating
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

      // Build update object for Firebase (no $set/$unset needed)
      const firebaseUpdates: Record<string, unknown> = {};
      
      // Add fields to update
      Object.keys(updateFields).forEach(key => {
        firebaseUpdates[key] = updateFields[key];
      });
      
      // For unset fields, set to null (Firebase will remove them)
      Object.keys(unsetFields).forEach(key => {
        firebaseUpdates[key] = null;
      });

      // Only proceed with update if there are fields to update
      if (Object.keys(firebaseUpdates).length === 0) {
        return res.status(400).json({ success: false, reason: 'No fields to update.' });
      }

      logInfo('💾 Updating user in Firebase...', { 
        email, 
        hasPasswordUpdate: !!updateFields.password,
        updateFields: Object.keys(firebaseUpdates)
      });

      // Sanitize and normalize email
      const sanitizedEmail = await sanitizeString(String(email));
      const normalizedEmail = sanitizedEmail.toLowerCase().trim();
      const existingUser = await firebaseUserService.findByEmail(normalizedEmail);
      if (!existingUser) {
        logWarn('⚠️ User not found:', email);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      logInfo('📝 Found user, applying update operation...');
      
      // Update user in Firebase
      try {
        await firebaseUserService.update(normalizedEmail, firebaseUpdates);
        
        // Fetch updated user
        const updatedUser = await firebaseUserService.findByEmail(normalizedEmail);
        if (!updatedUser) {
          logError('❌ Failed to fetch updated user');
          return res.status(500).json({ success: false, reason: 'Failed to update user.' });
        }

        logInfo('✅ User updated successfully:', updatedUser.email);

        // SYNC VEHICLE EXPIRY DATES when planExpiryDate is updated
        if (updateFields.planExpiryDate !== undefined || unsetFields.planExpiryDate !== undefined) {
          try {
            const normalizedEmail = email.toLowerCase().trim();
            const newPlanExpiryDate = updateFields.planExpiryDate || null;
            
            // Find all published vehicles for this seller
            const allVehicles = await firebaseVehicleService.findAll();
            const sellerVehicles = allVehicles.filter(v => 
              v.sellerEmail?.toLowerCase().trim() === normalizedEmail && v.status === 'published'
            );
            
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
                  await firebaseVehicleService.update(vehicle.id, vehicleUpdateFields);
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
        const verifyUser = await firebaseUserService.findByEmail(verifyEmail.toLowerCase().trim());
        if (!verifyUser) {
          logWarn('⚠️ User update verification failed - user not found after update');
        } else {
          logInfo('✅ User update verified in database');
        }

        // Remove password from response for security
        const { password: _, ...userWithoutPassword } = updatedUser;
        return res.status(200).json({ success: true, user: userWithoutPassword });
      } catch (dbError) {
        logError('❌ Database error during user update:', dbError);
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        
        return res.status(500).json({ 
          success: false, 
          reason: 'Database error occurred. Please try again later.',
          error: errorMessage
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
      const existingUser = await firebaseUserService.findByEmail(normalizedEmail);
      if (!existingUser) {
        logWarn('⚠️ User not found for deletion:', normalizedEmail);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      // Delete user from Firebase
      await firebaseUserService.delete(normalizedEmail);
      logInfo('✅ User deleted successfully from Firebase:', normalizedEmail);

      // Verify the user was deleted by querying it
      const verifyUser = await firebaseUserService.findByEmail(normalizedEmail);
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
    logError('❌ Error in handleUsers:', error);
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
    
    // Check for Firebase database errors
    const isDbError = error instanceof Error && (
      error.message.includes('Firebase') ||
      error.message.includes('firebase') ||
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
async function handleVehicles(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    // Check Firebase availability
    if (!USE_FIREBASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.',
        fallback: true
      });
    }
    
    // Check action type from query parameter
    const { type, action } = req.query;

  // HEAD - Handle browser pre-flight checks (backup handler in case global handler misses it)
  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', '0');
    return res.status(200).end();
  }

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
          // Try to get vehicle data from Firebase
          const vehicleData = await read<{ data: typeof defaultData }>(DB_PATHS.VEHICLE_DATA, 'default');
          if (vehicleData && vehicleData.data) {
            return res.status(200).json(vehicleData.data);
          }
          
          // If no data exists, create default and return it
          await create(DB_PATHS.VEHICLE_DATA, { data: defaultData }, 'default');
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
          // Save vehicle data to Firebase
          await updateData(DB_PATHS.VEHICLE_DATA, 'default', {
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
        const allVehicles = await firebaseVehicleService.findAll();
        const cityVehicles = allVehicles.filter(v => v.city === sanitizedCity && v.status === 'published');
        const stats = {
          totalVehicles: cityVehicles.length,
          averagePrice: cityVehicles.reduce((sum, v) => sum + (v.price || 0), 0) / (cityVehicles.length || 1),
          popularMakes: getPopularMakes(cityVehicles),
          priceRange: getPriceRange(cityVehicles)
        };
        return res.status(200).json(stats);
      }

      if (action === 'radius-search' && req.query.lat && req.query.lng && req.query.radius) {
        const allVehicles = await firebaseVehicleService.findByStatus('published');
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

      // DEBUG ENDPOINT: Return all vehicles including unpublished (for testing)
      if (action === 'debug-all') {
        const allVehicles = await firebaseVehicleService.findAll();
        const statusCounts = {
          published: allVehicles.filter(v => v.status === 'published').length,
          unpublished: allVehicles.filter(v => v.status === 'unpublished').length,
          sold: allVehicles.filter(v => v.status === 'sold').length,
          total: allVehicles.length
        };
        console.log(`🔍 DEBUG: Vehicle status breakdown:`, statusCounts);
        return res.status(200).json({
          total: allVehicles.length,
          statusCounts,
          vehicles: allVehicles
        });
      }

      // Get all vehicles and auto-disable expired listings
      let vehicles = await firebaseVehicleService.findAll();
      console.log(`📊 Total vehicles fetched from Firebase: ${vehicles.length}`);
      // Sort by createdAt descending
      vehicles = vehicles.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      
      const now = new Date();
      const sellerEmails = new Set<string>();
      
      vehicles.forEach(vehicle => {
        if (!vehicle.listingExpiresAt && vehicle.status === 'published' && vehicle.sellerEmail) {
          sellerEmails.add(vehicle.sellerEmail.toLowerCase());
        }
      });
      
      const sellerMap = new Map<string, UserType>();
      if (sellerEmails.size > 0) {
        const allUsers = await firebaseUserService.findAll();
        allUsers.forEach((seller) => {
          if (seller.email) {
            const normalizedEmail = seller.email.toLowerCase().trim();
            if (sellerEmails.has(normalizedEmail)) {
              sellerMap.set(normalizedEmail, seller);
            }
          }
        });
      }
      
      const vehicleUpdates: Array<{ id: number; updates: Partial<Vehicle> }> = [];
      
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
      
      // Enforce plan listing limits: keep most recent listings within limit, unpublish extras
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
      
      // Apply all updates to Firebase
      for (const update of vehicleUpdates) {
        await firebaseVehicleService.update(update.id, update.updates);
      }
      
      // Return vehicles after checking expiry (latest data)
      const refreshedVehicles = vehicleUpdates.length > 0
        ? await firebaseVehicleService.findAll()
        : vehicles;
      
      // Sort refreshed vehicles
      const sortedVehicles = refreshedVehicles.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      
      // Filter to only published vehicles for public-facing endpoint
      const publishedVehicles = sortedVehicles.filter(v => v.status === 'published');
      const unpublishedCount = sortedVehicles.length - publishedVehicles.length;
      console.log(`📊 Published vehicles after filtering: ${publishedVehicles.length} out of ${sortedVehicles.length} total (${unpublishedCount} unpublished/sold)`);
      
      // Log status breakdown for debugging
      const statusBreakdown = {
        published: sortedVehicles.filter(v => v.status === 'published').length,
        unpublished: sortedVehicles.filter(v => v.status === 'unpublished').length,
        sold: sortedVehicles.filter(v => v.status === 'sold').length,
        other: sortedVehicles.filter(v => !['published', 'unpublished', 'sold'].includes(v.status || '')).length
      };
      console.log(`📊 Vehicle status breakdown:`, statusBreakdown);
      
      // Normalize sellerEmail to lowercase for consistent filtering
      const normalizedVehicles = publishedVehicles.map(v => ({
        ...v,
        sellerEmail: v.sellerEmail?.toLowerCase().trim() || v.sellerEmail
      }));
      
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

        const vehicle = await firebaseVehicleService.findById(vehicleIdNum);
        if (!vehicle) {
          return res.status(404).json({ success: false, reason: 'Vehicle not found' });
        }

        const currentViews = typeof vehicle.views === 'number' ? vehicle.views : 0;
        vehicle.views = currentViews + 1;
        await vehicle.save();

        return res.status(200).json({ success: true, views: vehicle.views });
      } catch (error) {
        return res.status(500).json({ success: false, reason: 'Failed to track view', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // SECURITY FIX: Verify Auth for all other POST actions
    const auth = authenticateRequest(req);
    if (!auth.isValid) {
      return res.status(401).json({ success: false, reason: auth.error });
    }
        // Enforce plan expiry and listing limits for creation (no action or unknown action)
        // Only applies to standard create flow (i.e., when not handling action sub-routes above)
        if (!action || (action !== 'refresh' && action !== 'boost' && action !== 'certify' && action !== 'sold' && action !== 'unsold' && action !== 'feature')) {
          try {
            const { sellerEmail } = req.body || {};
            if (!sellerEmail || typeof sellerEmail !== 'string') {
              return res.status(400).json({ success: false, reason: 'Seller email is required' });
            }
            // Sanitize and normalize email
            const sanitizedEmail = await sanitizeString(String(sellerEmail));
            const normalizedEmail = sanitizedEmail.toLowerCase().trim();
            // Load seller
            const seller = await firebaseUserService.findByEmail(normalizedEmail);
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
          const sellerVehicles = await firebaseVehicleService.findBySellerEmail(normalizedEmail);
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
      const vehicle = await firebaseVehicleService.findById(vehicleIdNum);
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
      const normalizedRequestSellerEmail = sellerEmail ? String(sellerEmail).toLowerCase().trim() : '';
      if (normalizedVehicleSellerEmail !== normalizedRequestSellerEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized' });
      }
      
      const updates: Partial<Vehicle> = {};
      if (refreshAction === 'refresh') {
        updates.views = 0;
        updates.inquiriesCount = 0;
      } else if (refreshAction === 'renew') {
        updates.listingExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      
      await firebaseVehicleService.update(vehicleIdNum, updates);
      const updatedVehicle = await firebaseVehicleService.findById(vehicleIdNum);
      return res.status(200).json({ success: true, vehicle: updatedVehicle });
    }

    if (action === 'boost') {
      const { vehicleId, packageId } = req.body;
      const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
      const vehicle = await firebaseVehicleService.findById(vehicleIdNum);
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      // Add boost information if packageId is provided
      // packageId format is like "top_search_3", "homepage_spot", etc.
      // Extract type and duration from packageId
      let boostType = 'top_search';
      let boostDuration = 7; // Default 7 days
      
      if (packageId) {
        const parts = packageId.split('_');
        if (parts.length >= 2) {
          // Extract type (first parts except last if it's a number)
          const lastPart = parts[parts.length - 1];
          const isLastPartNumber = !isNaN(Number(lastPart));
          
          if (isLastPartNumber) {
            boostType = parts.slice(0, -1).join('_');
            boostDuration = Number(lastPart);
          } else {
            boostType = parts.join('_');
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
      
      await firebaseVehicleService.update(vehicleIdNum, {
        activeBoosts,
        isFeatured: true
      });
      
      const updatedVehicle = await firebaseVehicleService.findById(vehicleIdNum);
      return res.status(200).json({ success: true, vehicle: updatedVehicle });
    }

      if (action === 'certify') {
        try {
          const { vehicleId } = req.body;
          const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
          if (!vehicleIdNum) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          const vehicle = await firebaseVehicleService.findById(vehicleIdNum);
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          // Sanitize seller email
          const sanitizedSellerEmail = await sanitizeString(String(vehicle.sellerEmail));
          const seller = await firebaseUserService.findByEmail(sanitizedSellerEmail.toLowerCase().trim());
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

          await firebaseVehicleService.update(vehicleIdNum, {
            certificationStatus: 'requested',
            certificationRequestedAt: new Date().toISOString()
          });
          
          await firebaseUserService.update(seller.email, {
            usedCertifications: usedCertifications + 1
          });
          
          const updatedVehicle = await firebaseVehicleService.findById(vehicleIdNum);
          const updatedSeller = await firebaseUserService.findByEmail(seller.email);
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
          const { vehicleId } = req.body;
          const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
          if (!vehicleIdNum) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          const vehicle = await firebaseVehicleService.findById(vehicleIdNum);
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
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
          const seller = await firebaseUserService.findByEmail(sanitizedSellerEmail.toLowerCase().trim());
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

          await firebaseVehicleService.update(vehicleIdNum, {
            isFeatured: true,
            featuredAt: new Date().toISOString()
          });

          // Deduct one featured credit
          await firebaseUserService.update(seller.email, {
            featuredCredits: Math.max(0, remainingCredits - 1)
          });
          
          const updatedVehicle = await firebaseVehicleService.findById(vehicleIdNum);
          const updatedSeller = await firebaseUserService.findByEmail(seller.email);
          
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
          const vehicle = await firebaseVehicleService.findById(vehicleIdNum);
          
          if (!vehicle) {
            console.warn('⚠️ Vehicle not found with id:', vehicleIdNum);
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          console.log('✏️ Updating vehicle status to sold...');
          await firebaseVehicleService.update(vehicleIdNum, {
            status: 'sold',
            listingStatus: 'sold',
            soldAt: new Date().toISOString()
          });
          
          console.log('✅ Vehicle saved successfully');
          const updatedVehicle = await firebaseVehicleService.findById(vehicleIdNum);
          
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

          const vehicle = await firebaseVehicleService.findById(vehicleIdNum);
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          await firebaseVehicleService.update(vehicleIdNum, {
            status: 'published',
            listingStatus: 'active',
            soldAt: null
          });
          
          const updatedVehicle = await firebaseVehicleService.findById(vehicleIdNum);
          
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
    // Check if seller's plan has expired and block creation if so
    if (req.body.sellerEmail) {
      // Sanitize email input
      const sanitizedEmail = (await sanitizeString(String(req.body.sellerEmail))).toLowerCase().trim();
      const seller = await firebaseUserService.findByEmail(sanitizedEmail);
      if (seller && seller.planExpiryDate) {
        const expiryDate = new Date(seller.planExpiryDate);
        const isExpired = expiryDate < new Date();
        if (isExpired) {
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
      const seller = await firebaseUserService.findByEmail(sanitizedEmail);
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
        } else if (seller.subscriptionPlan !== 'premium') {
          // Free and Pro plans get 30-day expiry from today
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          listingExpiresAt = expiryDate.toISOString();
        }
        // If Premium without planExpiryDate, listingExpiresAt remains undefined (no expiry)
      }
    }
    
    const vehicleData = {
      id: Date.now(),
      ...req.body,
      views: 0,
      inquiriesCount: 0,
      createdAt: new Date().toISOString(),
      listingExpiresAt
    };
    
    console.log('💾 Saving new vehicle to Firebase...');
    const newVehicle = await firebaseVehicleService.create(vehicleData);
    console.log('✅ Vehicle saved successfully to Firebase:', newVehicle.id);
    
    // Verify the vehicle was saved by querying it back
    const verifyVehicle = await firebaseVehicleService.findById(newVehicle.id);
    if (!verifyVehicle) {
      console.error('❌ Vehicle creation verification failed - vehicle not found after save');
    } else {
      console.log('✅ Vehicle creation verified in database');
    }
    
    return res.status(201).json(newVehicle);
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
      
      console.log('🔄 PUT /vehicles - Updating vehicle:', { id: vehicleIdNum, fields: Object.keys(updateData) });
      
      // SECURITY FIX: Ownership Check
      // Fetch vehicle to verify ownership before update
      const existingVehicle = await firebaseVehicleService.findById(vehicleIdNum);
      if (!existingVehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = existingVehicle.sellerEmail ? existingVehicle.sellerEmail.toLowerCase().trim() : '';
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You do not own this listing.' });
      }
      
      // Update vehicle in Firebase
      await firebaseVehicleService.update(vehicleIdNum, updateData);
      console.log('✅ Vehicle updated and saved successfully:', vehicleIdNum);
      
      // Verify the update by querying again
      const updatedVehicle = await firebaseVehicleService.findById(vehicleIdNum);
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
      
      console.log('🔄 DELETE /vehicles - Deleting vehicle:', vehicleIdNum);
      
      // SECURITY FIX: Ownership Check
      const vehicleToDelete = await firebaseVehicleService.findById(vehicleIdNum);
      if (!vehicleToDelete) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = vehicleToDelete.sellerEmail ? vehicleToDelete.sellerEmail.toLowerCase().trim() : '';
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You do not own this listing.' });
      }
      
      await firebaseVehicleService.delete(vehicleIdNum);
      console.log('✅ Vehicle deleted successfully from Firebase:', vehicleIdNum);
      
      // Verify the vehicle was deleted by querying it
      const verifyVehicle = await firebaseVehicleService.findById(vehicleIdNum);
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
async function handleAdmin(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
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
      if (!USE_FIREBASE) {
        return res.status(200).json({
          success: false,
          message: 'Firebase environment variables are not configured',
          details: 'Please add Firebase environment variables in Vercel dashboard under Environment Variables',
          checks: [
            { name: 'Firebase Configuration', status: 'FAIL', details: 'Firebase environment variables not found' }
          ]
        });
      }

      // Test Firebase connection
      await read(DB_PATHS.USERS, 'test');
      
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
    
    if (!USE_FIREBASE) {
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
    if (!USE_FIREBASE) {
      return res.status(500).json({
        status: 'error',
        message: 'Firebase is not configured. Please set Firebase environment variables.',
        timestamp: new Date().toISOString()
      });
    }
    
    // Test Firebase connection
    await read(DB_PATHS.USERS, 'test');
    
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
async function handleSeed(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  // Prevent seed function from running in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      reason: 'Seed function cannot run in production environment'
    });
  }

  if (!USE_FIREBASE) {
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

// Vehicle Data handler - preserves exact functionality from vehicle-data.ts
async function handleVehicleData(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
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
        // Try to get vehicle data from Firebase
        const vehicleData = await read<{ data: typeof defaultData }>(DB_PATHS.VEHICLE_DATA, 'default');
        if (vehicleData && vehicleData.data) {
          return res.status(200).json(vehicleData.data);
        }
        
        // If no data exists, create default and return it
        await create(DB_PATHS.VEHICLE_DATA, { data: defaultData }, 'default');
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
        // Save vehicle data to Firebase
        await updateData(DB_PATHS.VEHICLE_DATA, 'default', {
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
async function handleNewCars(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  if (!USE_FIREBASE) {
    return res.status(503).json({
      success: false,
      reason: 'Firebase is not configured. Please set Firebase environment variables.',
      fallback: true
    });
  }

  if (req.method === 'GET') {
    const items = await readAll<Record<string, unknown>>(DB_PATHS.NEW_CARS);
    const itemsArray = Object.entries(items).map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt as string).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt as string).getTime() : 0;
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
    await create(DB_PATHS.NEW_CARS, doc, id);
    return res.status(201).json({ success: true, data: { id, ...doc } });
  }

  if (req.method === 'PUT') {
    const { id, _id, ...updateData } = req.body || {};
    const docId = _id || id;
    if (!docId) {
      return res.status(400).json({ success: false, reason: 'Document id is required' });
    }
    const existing = await read<Record<string, unknown>>(DB_PATHS.NEW_CARS, String(docId));
    if (!existing) {
      return res.status(404).json({ success: false, reason: 'New car document not found' });
    }
    await updateData(DB_PATHS.NEW_CARS, String(docId), { ...updateData, updatedAt: new Date().toISOString() });
    const updated = await read<Record<string, unknown>>(DB_PATHS.NEW_CARS, String(docId));
    return res.status(200).json({ success: true, data: { id: docId, ...updated } });
  }

  if (req.method === 'DELETE') {
    const { id, _id } = req.body || {};
    const docId = _id || id;
    if (!docId) {
      return res.status(400).json({ success: false, reason: 'Document id is required' });
    }
    await deleteData(DB_PATHS.NEW_CARS, String(docId));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed.' });
}

// Generate cryptographically random password
function generateRandomPassword(): string {
  return randomBytes(32).toString('hex');
}

async function seedUsers(): Promise<UserType[]> {
  // Prevent seed function from running in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed function cannot run in production environment');
  }
  
  // Use environment variables for seed passwords or generate cryptographically random ones
  const adminPasswordEnv = process.env.SEED_ADMIN_PASSWORD;
  const sellerPasswordEnv = process.env.SEED_SELLER_PASSWORD;
  const customerPasswordEnv = process.env.SEED_CUSTOMER_PASSWORD;
  
  // Generate random passwords if env vars not set
  const adminPasswordPlain = adminPasswordEnv || generateRandomPassword();
  const sellerPasswordPlain = sellerPasswordEnv || generateRandomPassword();
  const customerPasswordPlain = customerPasswordEnv || generateRandomPassword();
  
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
  
  const sampleUsers = [
    {
      id: '1',
      email: 'admin@test.com',
      password: adminPassword,
      name: 'Admin User',
      mobile: '9876543210',
      role: 'admin' as const,
      status: 'active' as const,
      isVerified: true,
      subscriptionPlan: 'premium' as const,
      featuredCredits: 100,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      email: 'seller@test.com',
      password: sellerPassword,
      name: 'Prestige Motors',
      mobile: '+91-98765-43210',
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
      id: '3',
      email: 'customer@test.com',
      password: customerPassword,
      name: 'Test Customer',
      mobile: '9876543212',
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
  const existingUsers = await firebaseUserService.findAll();
  for (const user of existingUsers) {
    if (['admin@test.com', 'seller@test.com', 'customer@test.com'].includes(user.email.toLowerCase())) {
      await firebaseUserService.delete(user.email);
    }
  }
  
  const users: UserType[] = [];
  for (const userData of sampleUsers) {
    const user = await firebaseUserService.create(userData);
    users.push(user);
  }
  
  return users;
}

async function seedVehicles(): Promise<VehicleType[]> {
  const sampleVehicles = [
    {
      id: 1,
      views: 324,
      make: 'Maruti Suzuki',
      model: 'Swift',
      variant: 'VXi',
      year: 2022,
      price: 650000,
      mileage: 15000,
      category: 'FOUR_WHEELER' as const,
      sellerEmail: 'seller@test.com',
      status: 'published' as const,
      isFeatured: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      views: 512,
      make: 'Honda',
      model: 'City',
      variant: 'VX',
      year: 2021,
      price: 850000,
      mileage: 25000,
      category: 'FOUR_WHEELER' as const,
      sellerEmail: 'seller@test.com',
      status: 'published' as const,
      isFeatured: true,
      createdAt: new Date().toISOString()
    }
  ];

  // Delete existing test vehicles and create new ones in Firebase
  const existingVehicles = await firebaseVehicleService.findAll();
  for (const vehicle of existingVehicles) {
    if (vehicle.sellerEmail?.toLowerCase() === 'seller@test.com') {
      await firebaseVehicleService.delete(vehicle.id);
    }
  }
  
  const vehicles: VehicleType[] = [];
  for (const vehicleData of sampleVehicles) {
    const vehicle = await firebaseVehicleService.create(vehicleData);
    vehicles.push(vehicle);
  }
  
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
    
    if (!USE_FIREBASE) {
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
    await read(DB_PATHS.USERS, 'test');
    
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

// Utils handler - consolidates utils.ts
async function handleUtils(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.includes('/test-connection') || pathname.endsWith('/test-connection')) {
    return await handleTestConnection(req, res);
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
async function handleContent(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  if (!USE_FIREBASE) {
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
  const faqsPath = `${DB_PATHS.VEHICLE_DATA}/faqs`;

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
    
    const allFaqs = await readAll<Record<string, unknown>>(faqsPath);
    let faqs = Object.entries(allFaqs).map(([id, data]) => ({ id, ...data }));
    
    if (category && category !== 'all' && typeof category === 'string') {
      // Sanitize category
      const sanitizedCategory = await sanitizeString(category);
      faqs = faqs.filter(faq => (faq.category as string) === sanitizedCategory);
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

    await create(faqsPath, faq, id);

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

    const existing = await read<Record<string, unknown>>(faqsPath, String(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    await updateData(faqsPath, String(id), {
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

    await deleteData(faqsPath, String(id));

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
  const ticketsPath = `${DB_PATHS.VEHICLE_DATA}/supportTickets`;

  switch (req.method) {
    case 'GET':
      return await handleGetSupportTickets(req, res, ticketsPath);
    case 'POST':
      return await handleCreateSupportTicket(req, res, ticketsPath);
    case 'PUT':
      return await handleUpdateSupportTicket(req, res, ticketsPath);
    case 'DELETE':
      return await handleDeleteSupportTicket(req, res, ticketsPath);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetSupportTickets(req: VercelRequest, res: VercelResponse, ticketsPath: string) {
  try {
    const { userEmail, status } = req.query;
    
    const allTickets = await readAll<Record<string, unknown>>(ticketsPath);
    let tickets = Object.entries(allTickets).map(([id, data]) => ({ id, ...data }));
    
    if (userEmail && typeof userEmail === 'string') {
      // Sanitize email
      const sanitizedEmail = await sanitizeString(userEmail);
      tickets = tickets.filter(ticket => (ticket.userEmail as string)?.toLowerCase().trim() === sanitizedEmail.toLowerCase().trim());
    }
    
    if (status && typeof status === 'string') {
      // Validate status is one of allowed values
      const allowedStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
      if (allowedStatuses.includes(status)) {
        tickets = tickets.filter(ticket => ticket.status === status);
      }
    }

    // Sort by createdAt descending
    tickets = tickets.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
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

async function handleCreateSupportTicket(req: VercelRequest, res: VercelResponse, ticketsPath: string) {
  try {
    const ticketData = req.body;
    
    if (!ticketData.userEmail || !ticketData.userName || !ticketData.subject || !ticketData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userEmail, userName, subject, message'
      });
    }

    const id = `ticket_${Date.now()}`;
    const ticket = {
      ...ticketData,
      id,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: []
    };

    await create(ticketsPath, ticket, id);

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

async function handleUpdateSupportTicket(req: VercelRequest, res: VercelResponse, ticketsPath: string) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const existing = await read<Record<string, unknown>>(ticketsPath, String(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    await updateData(ticketsPath, String(id), {
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

async function handleDeleteSupportTicket(req: VercelRequest, res: VercelResponse, ticketsPath: string) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    await deleteData(ticketsPath, String(id));

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
async function handleSellCar(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  if (!USE_FIREBASE) {
    return res.status(503).json({
      success: false,
      reason: 'Firebase is not configured. Please set Firebase environment variables.'
    });
  }

  const { method } = req;

  const submissionsPath = `${DB_PATHS.VEHICLE_DATA}/sellCarSubmissions`;

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
        const existingSubmissions = await readAll<Record<string, unknown>>(submissionsPath);
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
        const id = `submission_${Date.now()}`;
        await create(submissionsPath, sanitizedSubmissionData, id);
        
        res.status(201).json({
          success: true,
          id,
          message: 'Car submission received successfully'
        });
        break;

      case 'GET':
        const { page = 1, limit = 10, status: statusFilter, search } = req.query;
        const pageNum = parseInt(String(page), 10) || 1;
        const limitNum = parseInt(String(limit), 10) || 10;
        
        let allSubmissions = await readAll<Record<string, unknown>>(submissionsPath);
        let submissions = Object.entries(allSubmissions).map(([id, data]) => ({ id, ...data }));
        
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
          const aTime = a.submittedAt ? new Date(a.submittedAt as string).getTime() : 0;
          const bTime = b.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
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
        const { id, status: updateStatus, adminNotes, estimatedPrice } = req.body;
        
        if (!id) {
          return res.status(400).json({ error: 'Submission ID is required' });
        }

        const existing = await read<Record<string, unknown>>(submissionsPath, String(id));
        if (!existing) {
          return res.status(404).json({ error: 'Submission not found' });
        }

        interface UpdateData {
          status?: string;
          adminNotes?: string;
          estimatedPrice?: number;
          updatedAt: string;
        }
        const updateData: UpdateData = {
          updatedAt: new Date().toISOString()
        };
        
        // Validate and sanitize update fields
        if (updateStatus && typeof updateStatus === 'string') {
          const allowedStatuses = ['pending', 'approved', 'rejected', 'processing'];
          if (allowedStatuses.includes(updateStatus.toLowerCase())) {
            updateData.status = updateStatus;
          }
        }
        if (adminNotes && typeof adminNotes === 'string') {
          updateData.adminNotes = await sanitizeString(adminNotes);
        }
        if (estimatedPrice && typeof estimatedPrice === 'number') {
          updateData.estimatedPrice = estimatedPrice;
        }

        await updateData(submissionsPath, String(id), updateData);

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

        await deleteData(submissionsPath, String(deleteId));

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
async function handleBusiness(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
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
        return await handlePayments(req, res, options);
      case 'plans':
        return await handlePlans(req, res, options);
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
async function handlePayments(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    if (!USE_FIREBASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    const { action } = req.query;

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

        // Create payment request (simplified for demo)
        const paymentRequest = {
          id: Date.now(),
          sellerEmail,
          amount,
          plan,
          packageId,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

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

        // Get payment status (simplified for demo)
        const paymentStatus = {
          sellerEmail: sellerEmail as string,
          status: 'pending',
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

        // Approve payment (simplified for demo)
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
        const { paymentRequestId, reason } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        // Reject payment (simplified for demo)
        return res.status(200).json({
          success: true,
          message: 'Payment request rejected',
          paymentRequestId,
          reason: reason || 'No reason provided'
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
        // Return empty array for demo (in real implementation, fetch from database)
        const paymentRequests: any[] = [];
        
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
async function handleConversations(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    if (!USE_FIREBASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    // GET - Retrieve conversations
    if (req.method === 'GET') {
      const { customerId, sellerId, conversationId } = req.query;
      
      if (conversationId) {
        // Get single conversation
        const conversation = await firebaseConversationService.findById(String(conversationId));
        if (!conversation) {
          return res.status(404).json({ success: false, reason: 'Conversation not found' });
        }
        return res.status(200).json({ success: true, data: conversation });
      }
      
      let conversations;
      if (customerId) {
        conversations = await firebaseConversationService.findByCustomerId(String(customerId));
      } else if (sellerId) {
        conversations = await firebaseConversationService.findBySellerId(String(sellerId));
      } else {
        conversations = await firebaseConversationService.findAll();
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

      // Check if conversation exists
      const existing = await firebaseConversationService.findById(conversationData.id);
      if (existing) {
        await firebaseConversationService.update(conversationData.id, conversationData);
        const updated = await firebaseConversationService.findById(conversationData.id);
        return res.status(200).json({ success: true, data: updated });
      } else {
        const conversation = await firebaseConversationService.create(conversationData);
        return res.status(200).json({ success: true, data: conversation });
      }
    }

    // PUT - Update conversation (add message)
    if (req.method === 'PUT') {
      const { conversationId, message } = req.body;
      
      if (!conversationId || !message) {
        return res.status(400).json({ success: false, reason: 'Conversation ID and message are required' });
      }

      await firebaseConversationService.addMessage(String(conversationId), message);
      const conversation = await firebaseConversationService.findById(String(conversationId));

      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      return res.status(200).json({ success: true, data: conversation });
    }

    // DELETE - Delete conversation
    if (req.method === 'DELETE') {
      const { conversationId } = req.query;
      
      if (!conversationId) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      await firebaseConversationService.delete(String(conversationId));
      return res.status(200).json({ success: true, message: 'Conversation deleted successfully' });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    logError('Conversations Handler Error:', error);
    return res.status(500).json({
      success: false,
      reason: 'Failed to process conversation request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Notifications Handler
async function handleNotifications(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    if (!USE_FIREBASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    // GET - Retrieve notifications
    if (req.method === 'GET') {
      const { recipientEmail, isRead, notificationId } = req.query;
      
      if (notificationId) {
        // Get single notification
        const notification = await read<Record<string, unknown>>(DB_PATHS.NOTIFICATIONS, String(notificationId));
        if (!notification) {
          return res.status(404).json({ success: false, reason: 'Notification not found' });
        }
        return res.status(200).json({ success: true, data: { id: notificationId, ...notification } });
      }
      
      // Get all notifications and filter
      const allNotifications = await readAll<Record<string, unknown>>(DB_PATHS.NOTIFICATIONS);
      let notifications = Object.entries(allNotifications).map(([id, data]) => ({ id, ...data }));
      
      if (recipientEmail) {
        const emailValue = Array.isArray(recipientEmail) ? recipientEmail[0] : recipientEmail;
        const normalizedEmail = emailValue.toLowerCase().trim();
        notifications = notifications.filter(n => (n.recipientEmail as string)?.toLowerCase().trim() === normalizedEmail);
      }
      
      if (isRead !== undefined) {
        const isReadValue = Array.isArray(isRead) ? isRead[0] : isRead;
        const isReadBool = isReadValue === 'true';
        notifications = notifications.filter(n => n.isRead === isReadBool);
      }
      
      // Sort by timestamp descending
      notifications = notifications.sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp as string).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp as string).getTime() : 0;
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
      const notification = {
        ...notificationData,
        recipientEmail: normalizedEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await create(DB_PATHS.NOTIFICATIONS, notification, String(notificationData.id));
      return res.status(201).json({ success: true, data: { id: notificationData.id, ...notification } });
    }

    // PUT - Update notification (mark as read, etc.)
    if (req.method === 'PUT') {
      const { notificationId, updates } = req.body;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }

      const existing = await read<Record<string, unknown>>(DB_PATHS.NOTIFICATIONS, String(notificationId));
      if (!existing) {
        return res.status(404).json({ success: false, reason: 'Notification not found' });
      }

      await updateData(DB_PATHS.NOTIFICATIONS, String(notificationId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      
      const updated = await read<Record<string, unknown>>(DB_PATHS.NOTIFICATIONS, String(notificationId));
      return res.status(200).json({ success: true, data: { id: notificationId, ...updated } });
    }

    // DELETE - Delete notification
    if (req.method === 'DELETE') {
      const { notificationId } = req.query;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }

      await deleteData(DB_PATHS.NOTIFICATIONS, String(notificationId));
      return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    logError('Notifications Handler Error:', error);
    return res.status(500).json({
      success: false,
      reason: 'Failed to process notification request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Plans Handler
async function handlePlans(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    if (!USE_FIREBASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    switch (req.method) {
      case 'GET':
        // Get all plans
        const plans = await planService.getAllPlans();
        return res.status(200).json(plans);

      case 'POST':
        // Create new plan
        const newPlanData = req.body;
        if (!newPlanData || !newPlanData.name) {
          return res.status(400).json({ error: 'Plan name is required' });
        }
        
        const planId = await planService.createPlan(newPlanData);
        const createdPlan = await planService.getCustomPlanDetails(planId);
        
        return res.status(201).json(createdPlan);

      case 'PUT':
        // Update existing plan
        const { planId: updatePlanId, ...updateData } = req.body;
        if (!updatePlanId) {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        
        // Validate planId is a string and a valid SubscriptionPlan
        if (typeof updatePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID must be a string' });
        }
        if (!['free', 'pro', 'premium'].includes(updatePlanId)) {
          return res.status(400).json({ error: 'Invalid plan ID. Must be one of: free, pro, premium' });
        }
        
        planService.updatePlan(updatePlanId as SubscriptionPlan, updateData);
        const updatedPlan = await planService.getPlanDetails(updatePlanId as SubscriptionPlan);
        
        return res.status(200).json(updatedPlan);

      case 'DELETE':
        // Delete plan
        const { planId: deletePlanId } = req.query;
        if (!deletePlanId || typeof deletePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        
        const deleted = await planService.deletePlan(deletePlanId);
        if (!deleted) {
          return res.status(400).json({ error: 'Cannot delete base plans' });
        }
        
        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });

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


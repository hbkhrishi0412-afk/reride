import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import connectToDatabase, { MongoConfigError, ensureConnection, isConnectionHealthy, getConnectionState } from '../lib/db.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import VehicleDataModel from '../models/VehicleData.js';
import { PLAN_DETAILS } from '../constants.js';
import NewCar from '../models/NewCar.js';
import RateLimit from '../models/RateLimit.js';
import Conversation from '../models/Conversation.js';
import Notification from '../models/Notification.js';
import { planService } from '../services/planService.js';
import type { User as UserType, Vehicle as VehicleType, SubscriptionPlan } from '../types.js';
import { VehicleCategory } from '../types.js';
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
import { ObjectId } from 'mongodb';
import { logInfo, logWarn, logError, logSecurity } from '../utils/logger.js';

// Type for MongoDB user document (with _id)
interface UserDocument extends Omit<UserType, 'id'> {
  _id?: mongoose.Types.ObjectId;
  id?: string;
  [key: string]: unknown;
}

// Type for normalized user (without _id and password)
interface NormalizedUser extends Omit<UserType, 'password'> {
  id: string;
}

// Type for MongoDB bulk update operations
interface BulkUpdateOperation {
  updateOne: {
    filter: Record<string, unknown>;
    update: Record<string, unknown>;
  };
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

// Helper: Normalize MongoDB user object for frontend consumption
// Converts _id to id, ensures role is present, and removes password
function normalizeUser(user: UserDocument | null | undefined): NormalizedUser | null {
  if (!user) return null;
  
  // Convert _id to id if _id exists and id doesn't
  const id = user.id || (user._id ? user._id.toString() : undefined);
  if (!id) {
    // Only log in development to avoid information leakage
    logWarn('⚠️ User object missing both id and _id fields');
    return null;
  }
  
  // Ensure role is present (critical for seller dashboard access)
  // Only set default if role is truly missing - don't overwrite existing roles
  let role: 'customer' | 'seller' | 'admin' = user.role;
  if (!role || typeof role !== 'string' || !['customer', 'seller', 'admin'].includes(role)) {
    logWarn('⚠️ User object missing or invalid role field:', user.email, 'role:', role);
    // Default to 'customer' only if role is completely missing
    // This should rarely happen as role is required in the schema
    role = 'customer';
  }
  
  // Ensure email is present and normalized
  const email = user.email ? user.email.toLowerCase().trim() : '';
  if (!email) {
    // Only log in development to avoid information leakage
    logWarn('⚠️ User object missing email field');
    return null;
  }
  
  // Build normalized user object
  const normalized: NormalizedUser = {
    id,
    name: user.name || '',
    email,
    mobile: user.mobile || '',
    role,
    location: user.location || '',
    status: user.status || 'active',
    createdAt: user.createdAt || new Date().toISOString(),
    ...(user.avatarUrl && { avatarUrl: user.avatarUrl }),
    ...(user.isVerified !== undefined && { isVerified: user.isVerified }),
    ...(user.firebaseUid && { firebaseUid: user.firebaseUid }),
    ...(user.authProvider && { authProvider: user.authProvider }),
    ...(user.dealershipName && { dealershipName: user.dealershipName }),
    ...(user.bio && { bio: user.bio }),
    ...(user.logoUrl && { logoUrl: user.logoUrl }),
    ...(user.averageRating !== undefined && { averageRating: user.averageRating }),
    ...(user.ratingCount !== undefined && { ratingCount: user.ratingCount }),
    ...(user.badges && { badges: user.badges }),
    ...(user.subscriptionPlan && { subscriptionPlan: user.subscriptionPlan }),
    ...(user.featuredCredits !== undefined && { featuredCredits: user.featuredCredits }),
    ...(user.usedCertifications !== undefined && { usedCertifications: user.usedCertifications }),
    ...(user.planActivatedDate && { planActivatedDate: user.planActivatedDate }),
    ...(user.planExpiryDate && { planExpiryDate: user.planExpiryDate }),
    ...(user.phoneVerified !== undefined && { phoneVerified: user.phoneVerified }),
    ...(user.emailVerified !== undefined && { emailVerified: user.emailVerified }),
    ...(user.govtIdVerified !== undefined && { govtIdVerified: user.govtIdVerified }),
    ...(user.verificationDate && { verificationDate: user.verificationDate }),
    ...(user.pendingPlanUpgrade && { pendingPlanUpgrade: user.pendingPlanUpgrade }),
    ...(user.responseTime !== undefined && { responseTime: user.responseTime }),
    ...(user.responseRate !== undefined && { responseRate: user.responseRate }),
    ...(user.joinedDate && { joinedDate: user.joinedDate }),
    ...(user.lastActiveAt && { lastActiveAt: user.lastActiveAt }),
    ...(user.activeListings !== undefined && { activeListings: user.activeListings }),
    ...(user.soldListings !== undefined && { soldListings: user.soldListings }),
    ...(user.totalViews !== undefined && { totalViews: user.totalViews }),
    ...(user.reportedCount !== undefined && { reportedCount: user.reportedCount }),
    ...(user.isBanned !== undefined && { isBanned: user.isBanned }),
    ...(user.trustScore !== undefined && { trustScore: user.trustScore }),
    ...(user.alternatePhone && { alternatePhone: user.alternatePhone }),
    ...(user.preferredContactHours && { preferredContactHours: user.preferredContactHours }),
    ...(user.showEmailPublicly !== undefined && { showEmailPublicly: user.showEmailPublicly }),
    ...(user.verificationStatus && { verificationStatus: user.verificationStatus }),
    ...(user.aadharCard && { aadharCard: user.aadharCard }),
    ...(user.panCard && { panCard: user.panCard }),
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
  mongoAvailable: boolean;
  mongoFailureReason?: string;
};

// Extract client IP from request headers (handles proxies)
const getClientIP = (req: VercelRequest): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  return req.socket?.remoteAddress || 'unknown';
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

// Database-based rate limiting for serverless environments
const checkRateLimit = async (identifier: string, mongoAvailable: boolean): Promise<{ allowed: boolean; remaining: number }> => {
  const now = Date.now();
  const resetTime = now + config.RATE_LIMIT.WINDOW_MS;
  
  // If MongoDB is not available, use in-memory fallback with TTL
  if (!mongoAvailable) {
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
  
  try {
    // Clean up expired entries
    await RateLimit.deleteMany({ resetTime: { $lt: now } });
    
    // Find or create rate limit entry
    const rateLimit = await RateLimit.findOneAndUpdate(
      { 
        identifier,
        resetTime: { $gte: now } // Only consider active windows
      },
      {
        $inc: { count: 1 },
        $setOnInsert: { 
          identifier,
          resetTime,
          createdAt: new Date()
        }
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );
    
    const count = rateLimit?.count || 1;
    const remaining = Math.max(0, config.RATE_LIMIT.MAX_REQUESTS - count);
    
    // If count exceeds limit, update resetTime for next window
    if (count > config.RATE_LIMIT.MAX_REQUESTS) {
      await RateLimit.updateOne(
        { identifier },
        { $set: { resetTime } }
      );
      return { allowed: false, remaining: 0 };
    }
    
    return { allowed: true, remaining };
  } catch (error) {
    // On error, allow request (fail open) but log the error
    logError('Rate limiting error:', error);
    return { allowed: true, remaining: config.RATE_LIMIT.MAX_REQUESTS };
  }
};

// Helper function to ensure MongoDB connection is ready
// This replaces all the redundant connection checks throughout the code
async function ensureMongoConnection(): Promise<void> {
  if (!isConnectionHealthy()) {
    await ensureConnection();
    // Double-check after connection attempt
    if (!isConnectionHealthy()) {
      const state = getConnectionState();
      throw new Error(`MongoDB connection not ready: ${state.stateName} (${state.state})`);
    }
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
    let mongoAvailable = true;
    let mongoFailureReason: string | undefined;

    const connectWithGracefulFallback = async () => {
      try {
        // Use ensureConnection which handles retries and connection state
        await ensureConnection();
        
        // Double-check connection is actually ready
        if (!isConnectionHealthy()) {
          const state = getConnectionState();
          throw new Error(`Connection not ready: ${state.stateName} (${state.state})`);
        }
        
        // Verify connection works with a ping
        try {
          await mongoose.connection.db.admin().ping();
        } catch (pingError) {
          throw new Error('Connection ping failed - database not responding');
        }
      } catch (dbError) {
        mongoAvailable = false;
        
        // Provide more helpful error messages
        if (dbError instanceof MongoConfigError) {
          mongoFailureReason = 'MongoDB is not configured. Set MONGODB_URL (or MONGODB_URI) in your environment.';
        } else if (dbError instanceof Error) {
          const errorMsg = dbError.message.toLowerCase();
          // Provide specific guidance based on error type (only in development)
          if (process.env.NODE_ENV !== 'production') {
            if (errorMsg.includes('authentication') || errorMsg.includes('bad auth')) {
              mongoFailureReason = 'Database authentication failed. Check your username and password. Special characters in password must be URL-encoded.';
            } else if (errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('enotfound')) {
              mongoFailureReason = 'Database connection failed. Check network access settings in MongoDB Atlas and ensure your IP is whitelisted (add 0.0.0.0/0 for all IPs).';
            } else if (errorMsg.includes('not configured') || errorMsg.includes('not defined')) {
              mongoFailureReason = 'MongoDB is not configured. Set MONGODB_URL (or MONGODB_URI) in your environment.';
            } else {
              mongoFailureReason = `Database temporarily unavailable: ${dbError.message}. Please check your connection settings.`;
            }
          } else {
            // Production: generic message to avoid information leakage
            mongoFailureReason = 'Database temporarily unavailable. Please try again later.';
          }
        } else {
          mongoFailureReason = 'Database temporarily unavailable. Please try again later.';
        }
        
        // Only log in development to avoid information leakage
        if (process.env.NODE_ENV !== 'production') {
          logWarn('Database connection issue:', dbError instanceof Error ? dbError.message : dbError);
          logWarn('💡 Run "npm run db:diagnose" to diagnose the connection issue.');
        }
        if (req.method !== 'GET') {
          return res.status(503).json({
            success: false,
            reason: mongoFailureReason,
            fallback: true
          });
        }
        res.setHeader('X-Database-Fallback', 'true');
      }
      return undefined;
    };

    const earlyResponse = await connectWithGracefulFallback();
    if (earlyResponse) {
      return earlyResponse;
    }

    // Rate limiting (after database connection check)
    const clientIP = getClientIP(req);
    const rateLimitResult = await checkRateLimit(clientIP, mongoAvailable);
    
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        reason: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(config.RATE_LIMIT.WINDOW_MS / 1000)
      });
    }
    
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.setHeader('X-RateLimit-Limit', config.RATE_LIMIT.MAX_REQUESTS.toString());

    // Route based on the path
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
        const handlerOptions: HandlerOptions = {
          mongoAvailable,
          mongoFailureReason
        };
        return await handleUsers(req, res, handlerOptions);
      }
    }

    // Route to appropriate handler
    const handlerOptions: HandlerOptions = {
      mongoAvailable,
      mongoFailureReason
    };

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
        const handlerOptions: HandlerOptions = {
          mongoAvailable: true,
          mongoFailureReason: undefined
        };
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
    
    // Check for MongoDB/database errors first (including authentication errors from MongoDB)
    const isDbError = error instanceof Error && (
      error.message.includes('MONGODB_URI') || 
      error.message.includes('MONGODB_URL') ||
      error.message.includes('MongoServerError') ||
      error.message.includes('MongoNetworkError') ||
      error.message.includes('MongoTimeoutError') ||
      error.name === 'MongoServerError' ||
      error.name === 'MongoNetworkError' ||
      error.name === 'MongoTimeoutError' ||
      // MongoDB authentication errors (database connection auth, not user auth)
      (error.message.includes('authentication') && (
        error.message.includes('Mongo') ||
        error.message.includes('connection') ||
        error.message.includes('database') ||
        error.message.includes('credentials') ||
        error.message.includes('username') ||
        error.message.includes('password')
      )) ||
      // Connection-related errors
      ((error.message.includes('connect') || error.message.includes('timeout')) && (
        error.message.includes('Mongo') ||
        error.message.includes('database') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ))
    );
    
    if (isDbError) {
      logError('❌ Database error in main handler:', error instanceof Error ? error.message : 'Unknown error');
      // Check if it's a configuration error vs connection error
      if (error instanceof Error && (error.message.includes('MONGODB_URI') || error.message.includes('MONGODB_URL'))) {
        return res.status(503).json({ 
          success: false, 
          reason: 'Database configuration error. Please check MONGODB_URL (or MONGODB_URI) environment variable.',
          details: 'The application is configured to use MongoDB but the connection string is not properly configured.'
        });
      }
      // General database connection/auth error
      return res.status(503).json({ 
        success: false, 
        reason: 'Database connection failed. Please ensure the database is running and accessible.',
        details: 'Unable to connect to MongoDB database. Please check your database configuration, credentials, and network connectivity.'
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

    const { mongoAvailable, mongoFailureReason } = options;
    const unavailableResponse = () => res.status(503).json({
      success: false,
      reason: mongoFailureReason || 'Database is currently unavailable. Please try again later.',
      fallback: true
    });

  // Handle authentication actions (POST with action parameter)
  if (req.method === 'POST') {
    if (!mongoAvailable) {
      return unavailableResponse();
    }

    const { action, email, password, role, name, mobile, firebaseUid, authProvider, avatarUrl } = req.body;

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
      const user = await User.findOne({ email: normalizedEmail }).lean() as UserDocument | null;

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

      // Normalize user object for frontend (convert _id to id, ensure role is present)
      const normalizedUser = normalizeUser(user);
      
      if (!normalizedUser || !normalizedUser.role) {
        logError('❌ Failed to normalize user object:', { 
          email: user.email, 
          hasRole: !!user.role,
          userObject: {
            id: user.id || user._id,
            email: user.email,
            role: user.role,
            has_id: !!user._id,
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

      // Ensure database connection before proceeding
      try {
        // Ensure connection is ready before registration
        await ensureMongoConnection();
      } catch (dbError) {
        logError('❌ Database connection error during registration:', dbError);
        return res.status(503).json({ 
          success: false, 
          reason: 'Database connection failed. Please check MONGODB_URL (or MONGODB_URI) configuration.',
          error: dbError instanceof Error ? dbError.message : 'Connection error'
        });
      }

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
        const existingUser = await User.findOne({ email: normalizedEmail });
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

        const newUser = new User({
          id: userId,
          email: normalizedEmail,
          password: hashedPassword, // Store hashed password
          name: sanitizedData.name,
          mobile: sanitizedData.mobile,
          role: sanitizedData.role,
          status: 'active',
          isVerified: false,
          subscriptionPlan: 'free', // Fixed: should be subscriptionPlan not plan
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        });

        logInfo('💾 Attempting to save user to MongoDB...');
        await newUser.save();
        logInfo('✅ New user registered and saved to MongoDB:', normalizedEmail);
      
        // Verify the user was saved by querying it back
        const verifyUser = await User.findOne({ email: normalizedEmail });
        if (!verifyUser) {
          logError('❌ User registration verification failed - user not found after save');
          return res.status(500).json({ 
            success: false, 
            reason: 'User registration failed - user was not saved to database. Please try again.' 
          });
        } else {
          logInfo('✅ User registration verified in database. User ID:', verifyUser._id);
        }
      
        // Generate JWT tokens for new user
        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);
        
        // Normalize user object for frontend (convert _id to id, ensure role is present)
        const normalizedUser = normalizeUser(newUser.toObject());
        
        if (!normalizedUser || !normalizedUser.role) {
          logError('❌ Failed to normalize new user object:', { email: newUser.email, hasRole: !!newUser.role });
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to process user data. Please try again.' 
          });
        }
        
        logInfo('✅ Registration complete. User ID:', newUser._id);
        return res.status(201).json({ 
          success: true, 
          user: normalizedUser,
          accessToken,
          refreshToken
        });
      } catch (saveError) {
        logError('❌ Error saving user to MongoDB:', saveError);
        const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error';
        const errorStack = saveError instanceof Error ? saveError.stack : undefined;
        
        // Log full error details for debugging
        logError('Registration error details:', { 
          message: errorMessage, 
          stack: errorStack,
          email: normalizedEmail 
        });
        
        // Check for duplicate key error (email already exists)
        if (saveError instanceof Error && 
            (saveError.message.includes('E11000') || 
             saveError.message.includes('duplicate key') ||
             saveError.message.includes('email_1 dup key'))) {
          return res.status(400).json({ 
            success: false, 
            reason: 'User with this email already exists.' 
          });
        }
        
        // Check for validation errors
        if (saveError instanceof Error && saveError.name === 'ValidationError') {
          return res.status(400).json({ 
            success: false, 
            reason: 'Invalid user data provided.',
            error: errorMessage
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to save user to database. Please check MongoDB connection and try again.',
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
      let user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        logInfo('🔄 OAuth registration - Creating new user:', normalizedEmail);
        user = new User({
          id: Date.now(),
          email: normalizedEmail,
          name: sanitizedData.name,
          role: sanitizedData.role,
          firebaseUid: sanitizedData.firebaseUid,
          authProvider: sanitizedData.authProvider,
          avatarUrl: sanitizedData.avatarUrl,
          status: 'active',
          isVerified: true,
          subscriptionPlan: 'free', // Fixed: should be subscriptionPlan not plan
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        });
        
        logInfo('💾 Saving OAuth user to MongoDB...');
        await user.save();
        logInfo('✅ OAuth user saved to MongoDB:', normalizedEmail);
        
        // Verify the user was saved by querying it back
        const verifyUser = await User.findOne({ email: normalizedEmail });
        if (!verifyUser) {
          logError('❌ OAuth user registration verification failed - user not found after save');
          return res.status(500).json({ 
            success: false, 
            reason: 'OAuth registration failed - user was not saved to database. Please try again.' 
          });
        } else {
          logInfo('✅ OAuth user registration verified in database. User ID:', verifyUser._id);
          // Use the verified user to ensure we have the latest data
          user = verifyUser;
        }
      } else {
        logInfo('✅ OAuth login - Existing user found:', sanitizedData.email);
      }

      // Generate JWT tokens for OAuth users
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Normalize user object for frontend (convert _id to id, ensure role is present)
      const normalizedUser = normalizeUser(user.toObject());
      
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
        return res.status(400).json({ success: false, reason: 'Refresh token is required.' });
      }

      try {
        // FIX: Use the utility to verify and refresh the token properly
        // This recovers the original user data from the refresh token
        const newAccessToken = refreshAccessToken(refreshToken);
        
        return res.status(200).json({ 
          success: true, 
          accessToken: newAccessToken 
        });
      } catch (error) {
        logWarn('Refresh token failed:', error);
        return res.status(401).json({ success: false, reason: 'Invalid or expired refresh token.' });
      }
    }

    return res.status(400).json({ success: false, reason: 'Invalid action.' });
  }

  // HEAD - Handle browser pre-flight checks
  if (req.method === 'HEAD') {
    // Return 200 OK with no body, same headers as GET would have
    return res.status(200).end();
  }

  // GET - Get all users
  if (req.method === 'GET') {
    const { action, email } = req.query;

    if (!mongoAvailable) {
      const fallbackUsers = await getFallbackUsers();
      if (action === 'trust-score' && email) {
        // Normalize email to lowercase for consistent lookup
        const normalizedEmail = (email as string).toLowerCase().trim();
        const user = fallbackUsers.find(u => u.email?.toLowerCase().trim() === normalizedEmail);
        if (!user) {
          return res.status(404).json({ success: false, reason: 'User not found', fallback: true });
        }
        const trustScore = calculateTrustScore(user);
        return res.status(200).json({
          success: true,
          trustScore,
          email: user.email,
          name: user.name,
          fallback: true
        });
      }
      return res.status(200).json(fallbackUsers);
    }
    
    if (action === 'trust-score' && email) {
      try {
        // Sanitize and normalize email to prevent NoSQL injection
        const sanitizedEmail = await sanitizeString(String(email));
        const normalizedEmail = sanitizedEmail.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });
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
      // Ensure database connection before querying
      let isMongoAvailable: boolean = mongoAvailable;
      // Ensure connection is ready if MongoDB is available
      if (isMongoAvailable) {
        try {
          await ensureMongoConnection();
        } catch (connError) {
          logWarn('⚠️ Database connection failed during GET /users, using fallback');
          isMongoAvailable = false;
        }
      }
      
      if (!isMongoAvailable) {
        const fallbackUsers = await getFallbackUsers();
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(fallbackUsers);
      }
      
      const users = await User.find({}).sort({ createdAt: -1 }).lean();
      // SECURITY FIX: Normalize all users to remove passwords and convert _id to id
      const normalizedUsers = users.map(user => normalizeUser(user as unknown as UserDocument));
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
      return res.status(401).json({ success: false, reason: auth.error });
    }
    if (!mongoAvailable) {
      return unavailableResponse();
    }
    try {
      // Ensure database connection is established and ready
      logInfo('🔌 Ensuring database connection for user update...');
      await ensureMongoConnection();
      const state = getConnectionState();
      logInfo('✅ Database ready for user update, state:', state.stateName);
      
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

      // Build update operation
      const updateOperation: {
        $set?: Record<string, unknown>;
        $unset?: Record<string, string | number>;
      } = {};
      if (Object.keys(updateFields).length > 0) {
        updateOperation.$set = updateFields;
      }
      if (Object.keys(unsetFields).length > 0) {
        // Convert unsetFields to proper format (MongoDB $unset expects empty string or 1)
        const unsetObj: Record<string, string | number> = {};
        Object.keys(unsetFields).forEach(key => {
          unsetObj[key] = '';
        });
        updateOperation.$unset = unsetObj;
      }

      // Only proceed with update if there are fields to update
      if (Object.keys(updateOperation).length === 0) {
        return res.status(400).json({ success: false, reason: 'No fields to update.' });
      }

      logInfo('💾 Updating user in database...', { 
        email, 
        operationKeys: Object.keys(updateOperation),
        hasPasswordUpdate: !!updateFields.password,
        updateFields: Object.keys(updateFields),
        connectionState: mongoose.connection.readyState
      });

      // Double-check connection before update
      // Ensure connection is ready before update
      await ensureMongoConnection();

      // Sanitize and normalize email to prevent NoSQL injection
      const sanitizedEmail = await sanitizeString(String(email));
      const normalizedEmail = sanitizedEmail.toLowerCase().trim();
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (!existingUser) {
        logWarn('⚠️ User not found:', email);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      logInfo('📝 Found user, applying update operation...');
      
      // For password updates, use findOneAndUpdate which already persists changes
      if (updateFields.password) {
        try {
          // Ensure MongoDB connection is active before update
          try {
            await ensureMongoConnection();
          } catch (reconnectError) {
            logError('❌ Failed to ensure MongoDB connection:', reconnectError);
            return res.status(503).json({ 
              success: false, 
              reason: 'Database connection lost. Please try again later.',
              error: 'MongoDB connection unavailable'
            });
          }

          // Use findOneAndUpdate - it already persists changes to the database
          // No need for additional save() call as findOneAndUpdate is atomic and persistent
          const updatedUser = await User.findOneAndUpdate(
            { email: email.toLowerCase().trim() }, // Ensure email is normalized
            updateOperation,
            { new: true, runValidators: true }
          );

          if (!updatedUser) {
            logError('❌ Failed to update user after findOneAndUpdate');
            return res.status(500).json({ success: false, reason: 'Failed to update user. User not found.' });
          }

          logInfo('✅ User updated successfully:', updatedUser.email);
          // Never log password update status in production
          if (process.env.NODE_ENV !== 'production') {
            logInfo('✅ Password updated via findOneAndUpdate');
          }

          // Verify the update actually saved by checking the user again
          const verifyEmail = await sanitizeString(String(email));
          const verifyUser = await User.findOne({ email: verifyEmail.toLowerCase().trim() });
          if (verifyUser && verifyUser.password) {
            // Never log password update verification in production
            if (process.env.NODE_ENV !== 'production') {
              logInfo('✅ Password update verified in database');
              // Verify it's different from the old password (if we can check)
              if (verifyUser.password !== existingUser.password) {
                logInfo('✅ Password hash changed, update confirmed');
              } else {
                logWarn('⚠️ Password hash unchanged - update may not have worked');
              }
            }
          } else {
            // Only log errors in development to avoid information leakage
            if (process.env.NODE_ENV !== 'production') {
              logError('❌ Password update verification failed - password not found in database');
            }
          }

          // Remove password from response for security
          const { password: _, ...userWithoutPassword } = updatedUser.toObject();
          return res.status(200).json({ success: true, user: userWithoutPassword });
        } catch (passwordUpdateError) {
          logError('❌ Error during password update:', passwordUpdateError);
          logError('❌ Error stack:', passwordUpdateError instanceof Error ? passwordUpdateError.stack : 'No stack trace');
          logError('❌ Error name:', passwordUpdateError instanceof Error ? passwordUpdateError.name : 'Unknown');
          
          const errorMessage = passwordUpdateError instanceof Error ? passwordUpdateError.message : 'Unknown error';
          const errorName = passwordUpdateError instanceof Error ? passwordUpdateError.name : 'Unknown';
          
          // Provide more specific error messages based on error type
          if (errorName === 'ValidationError') {
            return res.status(400).json({ 
              success: false, 
              reason: 'Password validation failed. Please check password requirements.',
              error: errorMessage
            });
          }
          
          if (errorMessage.includes('MongoServerError') || errorMessage.includes('MongoNetworkError') || errorMessage.includes('connection')) {
            return res.status(503).json({ 
              success: false, 
              reason: 'Database connection error. Please try again later.',
              error: errorMessage
            });
          }
          
          if (errorMessage.includes('CastError') || errorMessage.includes('Cast to')) {
            return res.status(400).json({ 
              success: false, 
              reason: 'Invalid data format. Please try again.',
              error: errorMessage
            });
          }
          
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to update password. Please try again.',
            error: errorMessage
          });
        }
      } else {
        // For non-password updates, use standard findOneAndUpdate
        const updatedUser = await User.findOneAndUpdate(
          { email: email.toLowerCase().trim() }, // Ensure email is normalized
          updateOperation,
          { new: true, runValidators: true }
        );

        if (!updatedUser) {
          logError('❌ Failed to update user after findOneAndUpdate');
          return res.status(500).json({ success: false, reason: 'Failed to update user.' });
        }

        // Explicitly save to ensure persistence
        await updatedUser.save();
        logInfo('✅ User updated successfully:', updatedUser.email);

        // SYNC VEHICLE EXPIRY DATES when planExpiryDate is updated
        if (updateFields.planExpiryDate !== undefined || unsetFields.planExpiryDate !== undefined) {
          try {
            const normalizedEmail = email.toLowerCase().trim();
            const newPlanExpiryDate = updateFields.planExpiryDate || null;
            
            // Find all published vehicles for this seller
            const sellerVehicles = await Vehicle.find({ 
              sellerEmail: normalizedEmail,
              status: 'published'
            });
            
            if (sellerVehicles.length > 0) {
              const now = new Date();
              const bulkUpdates: BulkUpdateOperation[] = [];
              
              sellerVehicles.forEach(vehicle => {
                const vehicleUpdateFields: Record<string, unknown> = {};
                
                if (updatedUser.subscriptionPlan === 'premium') {
                  if (newPlanExpiryDate && (typeof newPlanExpiryDate === 'string' || newPlanExpiryDate instanceof Date)) {
                    // Premium plan with expiry: set vehicle expiry to plan expiry
                    const expiryDate = typeof newPlanExpiryDate === 'string' ? new Date(newPlanExpiryDate) : newPlanExpiryDate;
                    vehicleUpdateFields.listingExpiresAt = expiryDate;
                    
                    // If vehicle was expired but plan is now extended, reactivate it
                    if (vehicle.listingExpiresAt && new Date(vehicle.listingExpiresAt) < now && expiryDate >= now) {
                      vehicleUpdateFields.listingStatus = 'active';
                      vehicleUpdateFields.status = 'published';
                    }
                  } else {
                    // Premium plan without expiry: remove vehicle expiry
                    vehicleUpdateFields.listingExpiresAt = undefined;
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
                  bulkUpdates.push({
                    updateOne: {
                      filter: { _id: vehicle._id },
                      update: { 
                        $set: vehicleUpdateFields,
                        ...(vehicleUpdateFields.listingExpiresAt === undefined ? { $unset: { listingExpiresAt: '' } } : {})
                      }
                    }
                  });
                }
              });
              
              if (bulkUpdates.length > 0) {
                await Vehicle.bulkWrite(bulkUpdates, { ordered: false });
                logInfo(`✅ Synced ${bulkUpdates.length} vehicle expiry dates for seller ${normalizedEmail}`);
              }
            }
          } catch (syncError) {
            logError('⚠️ Error syncing vehicle expiry dates:', syncError);
            // Don't fail the user update if vehicle sync fails
          }
        }

        // Verify the update by querying again
        const verifyEmail = await sanitizeString(String(email));
        const verifyUser = await User.findOne({ email: verifyEmail.toLowerCase().trim() });
        if (!verifyUser) {
          logWarn('⚠️ User update verification failed - user not found after update');
        } else {
          logInfo('✅ User update verified in database');
        }

        // Remove password from response for security
        const { password: _, ...userWithoutPassword } = updatedUser.toObject();
        return res.status(200).json({ success: true, user: userWithoutPassword });
      }
    } catch (dbError) {
      logError('❌ Database error during user update:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      const errorStack = dbError instanceof Error ? dbError.stack : undefined;
      
      // Log full error for debugging
      logError('Error details:', { message: errorMessage, stack: errorStack });
      
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
    if (!mongoAvailable) {
      return unavailableResponse();
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

      // Sanitize email to prevent NoSQL injection
      const sanitizedEmail = await sanitizeString(String(email));
      const normalizedEmail = sanitizedEmail.toLowerCase().trim();
      logInfo('🔄 DELETE /users - Deleting user:', normalizedEmail);

      const deletedUser = await User.findOneAndDelete({ email: normalizedEmail });
      if (!deletedUser) {
        logWarn('⚠️ User not found for deletion:', normalizedEmail);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      logInfo('✅ User deleted successfully from MongoDB:', normalizedEmail);

      // Verify the user was deleted by querying it
      const verifyEmail = await sanitizeString(String(email));
      const verifyUser = await User.findOne({ email: verifyEmail.toLowerCase().trim() });
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
    
    // CRITICAL: Check for database connection errors FIRST before checking user authentication errors
    // MongoDB connection/auth errors (e.g., "Authentication failed" from wrong MongoDB credentials)
    // should return 503 (Service Unavailable), NOT 401 (Unauthorized)
    // Only user authentication errors (JWT tokens, login sessions) should return 401
    // Check for MongoDB-specific errors first (including authentication errors from MongoDB)
    const isDbError = error instanceof Error && (
      error.message.includes('MONGODB') || 
      error.message.includes('MongoConfigError') ||
      error.message.includes('MongoServerError') ||
      error.message.includes('MongoNetworkError') ||
      error.message.includes('MongoTimeoutError') ||
      error.message.includes('MongoParseError') ||
      error.name === 'MongoServerError' ||
      error.name === 'MongoNetworkError' ||
      error.name === 'MongoTimeoutError' ||
      // MongoDB authentication errors (database connection auth, not user auth)
      (error.message.includes('authentication') && (
        error.message.includes('Mongo') ||
        error.message.includes('connection') ||
        error.message.includes('database') ||
        error.message.includes('credentials') ||
        error.message.includes('username') ||
        error.message.includes('password')
      )) ||
      // Connection-related errors
      (error.message.includes('connect') && (
        error.message.includes('Mongo') ||
        error.message.includes('database') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ))
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
      if (isUserAuthError && !errorMsg.includes('mongo') && !errorMsg.includes('database') && !errorMsg.includes('connection')) {
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
    const { mongoAvailable, mongoFailureReason } = options;
    // Check action type from query parameter
    const { type, action } = req.query;
    const unavailableResponse = () => res.status(503).json({
      success: false,
      reason: mongoFailureReason || 'Database is currently unavailable. Please try again later.',
      fallback: true
    });

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
        // Always return default data if mongo is not available
        if (!mongoAvailable) {
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json(defaultData);
        }
        try {
          await ensureMongoConnection();
          console.log('📡 Connected to database for vehicles data fetch operation');
          
          let vehicleDataDoc = await VehicleDataModel.findOne();
          if (!vehicleDataDoc) {
            // Create default vehicle data if none exists
            vehicleDataDoc = new VehicleDataModel({ data: defaultData });
            await vehicleDataDoc.save();
          }
          
          return res.status(200).json(vehicleDataDoc.data);
        } catch (dbError) {
          console.warn('⚠️ Database connection failed for vehicles data, returning default data:', dbError);
          // Return default data as fallback - NEVER return 500
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json(defaultData);
        }
      }

      if (req.method === 'POST') {
        // Always return success response, even if mongo is not available
        if (!mongoAvailable) {
          res.setHeader('X-Data-Fallback', 'true');
          console.warn('⚠️ Vehicle data save attempted without MongoDB. Returning fallback acknowledgement.');
          return res.status(200).json({
            success: true,
            data: req.body,
            message: 'Vehicle data processed (database unavailable, using fallback)',
            fallback: true,
            timestamp: new Date().toISOString()
          });
        }
        try {
          await ensureMongoConnection();
          console.log('📡 Connected to database for vehicles data save operation');
          
          const vehicleData = await VehicleDataModel.findOneAndUpdate(
            {},
            { 
              data: req.body,
              updatedAt: new Date()
            },
            { 
              upsert: true, 
              new: true,
              setDefaultsOnInsert: true
            }
          );
          
          console.log('✅ Vehicle data saved successfully to database');
          return res.status(200).json({ 
            success: true, 
            data: vehicleData.data,
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
    if (!mongoAvailable) {
      const fallbackVehicles = await getFallbackVehicles();
      if (action === 'city-stats' && req.query.city) {
        // Sanitize city input to prevent injection
        const sanitizedCity = await sanitizeString(String(req.query.city));
        const cityVehicles = fallbackVehicles.filter(v => v.city === sanitizedCity && v.status === 'published');
        const stats = {
          totalVehicles: cityVehicles.length,
          averagePrice: cityVehicles.reduce((sum, v) => sum + (v.price || 0), 0) / (cityVehicles.length || 1),
          popularMakes: getPopularMakes(cityVehicles),
          priceRange: getPriceRange(cityVehicles)
        };
        return res.status(200).json({ ...stats, fallback: true });
      }

      if (action === 'radius-search' && req.query.lat && req.query.lng && req.query.radius) {
        const nearbyVehicles = fallbackVehicles.filter(vehicle => {
          if (!vehicle.exactLocation?.lat || !vehicle.exactLocation?.lng) return false;
          const distance = calculateDistance(
            parseFloat(req.query.lat as string),
            parseFloat(req.query.lng as string),
            vehicle.exactLocation.lat,
            vehicle.exactLocation.lng
          );
          return distance <= parseFloat(req.query.radius as string);
        });
        // Filter to only published vehicles
        const publishedNearbyVehicles = nearbyVehicles.filter(v => v.status === 'published');
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(publishedNearbyVehicles);
      }

      // Filter to only published vehicles for public-facing endpoint
      const publishedFallbackVehicles = fallbackVehicles.filter(v => v.status === 'published');
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json(publishedFallbackVehicles);
    }

    try {
      // Ensure database connection is established
      await ensureMongoConnection();
      
      if (action === 'city-stats' && req.query.city) {
        // Sanitize city input to prevent NoSQL injection
        const sanitizedCity = await sanitizeString(String(req.query.city));
        const cityVehicles = await Vehicle.find({ city: sanitizedCity, status: 'published' });
        const stats = {
          totalVehicles: cityVehicles.length,
          averagePrice: cityVehicles.reduce((sum, v) => sum + v.price, 0) / cityVehicles.length || 0,
          popularMakes: getPopularMakes(cityVehicles),
          priceRange: getPriceRange(cityVehicles)
        };
        return res.status(200).json(stats);
      }

      if (action === 'radius-search' && req.query.lat && req.query.lng && req.query.radius) {
        const vehicles = await Vehicle.find({ status: 'published' });
        const nearbyVehicles = vehicles.filter(vehicle => {
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

      // Get all vehicles and auto-disable expired listings
      const vehicles = await Vehicle.find({}).sort({ createdAt: -1 });
      
      const now = new Date();
      const sellerEmails = new Set<string>();
      
      vehicles.forEach(vehicle => {
        if (!vehicle.listingExpiresAt && vehicle.status === 'published' && vehicle.sellerEmail) {
          sellerEmails.add(vehicle.sellerEmail.toLowerCase());
        }
      });
      
      const sellerMap = new Map<string, UserDocument>();
      if (sellerEmails.size > 0) {
        const sellers = await User.find({ email: { $in: Array.from(sellerEmails) } }).lean();
        sellers.forEach((seller) => {
          if (seller.email) {
            // Convert lean document to UserDocument format
            const userDoc: UserDocument = {
              ...seller,
              _id: seller._id as mongoose.Types.ObjectId,
              email: seller.email.toLowerCase().trim(),
              name: seller.name || '',
              mobile: seller.mobile || '',
              role: (seller.role as 'customer' | 'seller' | 'admin') || 'customer',
              status: seller.status || 'active',
              createdAt: seller.createdAt || new Date().toISOString(),
              location: seller.location || '',
            };
            sellerMap.set(seller.email.toLowerCase(), userDoc);
          }
        });
      }
      
      const bulkUpdates: BulkUpdateOperation[] = [];
      
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
          bulkUpdates.push({
            updateOne: {
              filter: { _id: vehicle._id },
              update: { $set: updateFields }
            }
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
              // Vehicles from MongoDB have _id, but VehicleType doesn't include it
              // Use id or sellerEmail+make+model as fallback identifier
              const vehicleId = (v as unknown as { _id?: unknown })._id || v.id;
              if (vehicleId) {
                bulkUpdates.push({
                  updateOne: {
                    filter: { _id: vehicleId },
                    update: { $set: { status: 'unpublished', listingStatus: 'suspended' } }
                  }
                });
              }
            });
          }
        });
      } catch (limitErr) {
        console.warn('⚠️ Error applying plan listing limits:', limitErr);
      }
      
      if (bulkUpdates.length > 0) {
        await Vehicle.bulkWrite(bulkUpdates, { ordered: false });
      }
      
      // Return vehicles after checking expiry (latest data)
      const refreshedVehicles = bulkUpdates.length > 0
        ? await Vehicle.find({}).sort({ createdAt: -1 })
        : vehicles;
      
      // Filter to only published vehicles for public-facing endpoint
      // (Admin panel and other endpoints can access all vehicles via different routes)
      const publishedVehicles = refreshedVehicles.filter(v => v.status === 'published');
      
      // Normalize sellerEmail to lowercase for consistent filtering
      const normalizedVehicles = publishedVehicles.map(v => {
        const vehicleObj = v.toObject ? v.toObject() : v;
        return {
          ...vehicleObj,
          sellerEmail: vehicleObj.sellerEmail?.toLowerCase().trim() || vehicleObj.sellerEmail
        };
      });
      
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

        if (!mongoAvailable) {
          return unavailableResponse();
        }

        await ensureMongoConnection();
        const vehicle = await Vehicle.findOne({ id: vehicleIdNum });
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
    if (!mongoAvailable) {
      return unavailableResponse();
    }
    // Enforce plan expiry and listing limits for creation (no action or unknown action)
    // Only applies to standard create flow (i.e., when not handling action sub-routes above)
    if (!action || (action !== 'refresh' && action !== 'boost' && action !== 'certify' && action !== 'sold' && action !== 'unsold' && action !== 'feature')) {
      try {
        const { sellerEmail } = req.body || {};
        if (!sellerEmail || typeof sellerEmail !== 'string') {
          return res.status(400).json({ success: false, reason: 'Seller email is required' });
        }
        // Sanitize and normalize email to prevent NoSQL injection
        const sanitizedEmail = await sanitizeString(String(sellerEmail));
        const normalizedEmail = sanitizedEmail.toLowerCase().trim();
        // Ensure DB connection for safety
        await ensureMongoConnection();
        // Load seller
        const seller = await User.findOne({ email: normalizedEmail });
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
          const currentActiveCount = await Vehicle.countDocuments({ sellerEmail: normalizedEmail, status: 'published' });
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
      const vehicle = await Vehicle.findOne({ id: vehicleId });
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
      const normalizedRequestSellerEmail = sellerEmail ? String(sellerEmail).toLowerCase().trim() : '';
      if (normalizedVehicleSellerEmail !== normalizedRequestSellerEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized' });
      }
      
      if (refreshAction === 'refresh') {
        vehicle.views = 0;
        vehicle.inquiriesCount = 0;
      } else if (refreshAction === 'renew') {
        vehicle.listingExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
      
      await vehicle.save();
      return res.status(200).json({ success: true, vehicle });
    }

    if (action === 'boost') {
      const { vehicleId, packageId } = req.body;
      const vehicle = await Vehicle.findOne({ id: vehicleId });
      
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
        vehicleId: vehicleId,
        packageId: packageId || 'standard',
        type: boostType,
        startDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + boostDuration * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      };
      
      if (!vehicle.activeBoosts) {
        vehicle.activeBoosts = [];
      }
      vehicle.activeBoosts.push(boostInfo);
      vehicle.isFeatured = true;

      await vehicle.save();
      return res.status(200).json({ success: true, vehicle });
    }

      if (action === 'certify') {
        try {
          const { vehicleId } = req.body;
          if (!vehicleId) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          await ensureMongoConnection();
          const vehicle = await Vehicle.findOne({ id: vehicleId });
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          // Sanitize seller email to prevent NoSQL injection
          const sanitizedSellerEmail = await sanitizeString(String(vehicle.sellerEmail));
          const seller = await User.findOne({ email: sanitizedSellerEmail.toLowerCase().trim() });
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
            const vehicleObj = vehicle.toObject();
            return res.status(200).json({
              success: true,
              vehicle: vehicleObj,
              alreadyRequested: true,
              usedCertifications,
              remainingCertifications: Math.max(allowedCertifications - usedCertifications, 0)
            });
          }

          vehicle.certificationStatus = 'requested';
          vehicle.certificationRequestedAt = new Date().toISOString();
          
          seller.usedCertifications = usedCertifications + 1;
          await Promise.all([vehicle.save(), seller.save()]);
          
          // Convert Mongoose document to plain object
          const vehicleObj = vehicle.toObject();
          const totalUsed = seller.usedCertifications ?? usedCertifications + 1;
          const remaining = Math.max(allowedCertifications - totalUsed, 0);
          
          return res.status(200).json({ 
            success: true, 
            vehicle: vehicleObj,
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
          if (!vehicleId) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          await ensureMongoConnection();
          const vehicle = await Vehicle.findOne({ id: vehicleId });
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }

          if (vehicle.isFeatured) {
            const vehicleObj = vehicle.toObject();
            return res.status(200).json({ 
              success: true, 
              vehicle: vehicleObj,
              alreadyFeatured: true 
            });
          }

          const sellerEmail = vehicle.sellerEmail;
          if (!sellerEmail) {
            return res.status(400).json({ success: false, reason: 'Vehicle does not have an associated seller.' });
          }

          // Sanitize seller email to prevent NoSQL injection
          const sanitizedSellerEmail = await sanitizeString(String(sellerEmail));
          const seller = await User.findOne({ email: sanitizedSellerEmail.toLowerCase().trim() });
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

          vehicle.isFeatured = true;
          vehicle.featuredAt = new Date().toISOString();
          await vehicle.save();

          // Deduct one featured credit
          seller.featuredCredits = Math.max(0, remainingCredits - 1);
          await seller.save();
          
          const vehicleObj = vehicle.toObject();
          
          return res.status(200).json({ 
            success: true, 
            vehicle: vehicleObj,
            remainingCredits: seller.featuredCredits
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

          // Ensure database connection is established
          console.log('🔌 Ensuring database connection...');
          await ensureMongoConnection();
          const state = getConnectionState();
          console.log('✅ Database ready, state:', state.stateName);
          
          console.log('🔍 Finding vehicle with id:', vehicleIdNum);
          const vehicle = await Vehicle.findOne({ id: vehicleIdNum });
          
          if (!vehicle) {
            console.warn('⚠️ Vehicle not found with id:', vehicleIdNum);
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          console.log('✏️ Updating vehicle status to sold...');
          vehicle.status = 'sold';
          vehicle.listingStatus = 'sold';
          vehicle.soldAt = new Date().toISOString();
          
          await vehicle.save();
          console.log('✅ Vehicle saved successfully');
          
          // Convert Mongoose document to plain object
          const vehicleObj = vehicle.toObject();
          
          return res.status(200).json({ success: true, vehicle: vehicleObj });
        } catch (error) {
          console.error('❌ Error marking vehicle as sold:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error('❌ Error message:', errorMessage);
          if (errorStack) {
            console.error('❌ Error stack:', errorStack);
          }
          return res.status(500).json({ 
            success: false, 
            reason: errorMessage
          });
        }
      }

      if (action === 'unsold') {
        try {
          const { vehicleId } = req.body;
          if (!vehicleId) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          await ensureMongoConnection();
          const vehicle = await Vehicle.findOne({ id: vehicleId });
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          vehicle.status = 'published';
          vehicle.listingStatus = 'active';
          vehicle.soldAt = undefined;
          
          await vehicle.save();
          
          // Convert Mongoose document to plain object
          const vehicleObj = vehicle.toObject();
          
          return res.status(200).json({ success: true, vehicle: vehicleObj });
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
      // Sanitize email input to prevent NoSQL injection
      const sanitizedEmail = (await sanitizeString(String(req.body.sellerEmail))).toLowerCase().trim();
      const seller = await User.findOne({ email: sanitizedEmail });
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
      // Sanitize email input to prevent NoSQL injection
      const sanitizedEmail = (await sanitizeString(String(req.body.sellerEmail))).toLowerCase().trim();
      const seller = await User.findOne({ email: sanitizedEmail });
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
    
    const newVehicle = new Vehicle({
      id: Date.now(),
      ...req.body,
      views: 0,
      inquiriesCount: 0,
      createdAt: new Date().toISOString(),
      listingExpiresAt
    });
    
    console.log('💾 Saving new vehicle to database...');
    await newVehicle.save();
    console.log('✅ Vehicle saved successfully to MongoDB:', newVehicle.id);
    
    // Verify the vehicle was saved by querying it back
    const verifyVehicle = await Vehicle.findOne({ id: newVehicle.id });
    if (!verifyVehicle) {
      console.error('❌ Vehicle creation verification failed - vehicle not found after save');
    } else {
      console.log('✅ Vehicle creation verified in database');
    }
    
    // Convert Mongoose document to plain object for JSON serialization
    const vehicleObj = newVehicle.toObject();
    
    return res.status(201).json(vehicleObj);
  }

  if (req.method === 'PUT') {
    // SECURITY FIX: Verify Auth
    const auth = authenticateRequest(req);
    if (!auth.isValid) {
      return res.status(401).json({ success: false, reason: auth.error });
    }
    if (!mongoAvailable) {
      return unavailableResponse();
    }
    try {
      // Ensure database connection
      await ensureMongoConnection();
      
      const { id, ...updateData } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, reason: 'Vehicle ID is required for update.' });
      }
      
      console.log('🔄 PUT /vehicles - Updating vehicle:', { id, fields: Object.keys(updateData) });
      
      // SECURITY FIX: Ownership Check
      // Fetch vehicle to verify ownership before update
      const existingVehicle = await Vehicle.findOne({ id });
      if (!existingVehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = existingVehicle.sellerEmail ? existingVehicle.sellerEmail.toLowerCase().trim() : '';
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You do not own this listing.' });
      }
      
      // Use findOneAndUpdate with $set to ensure proper update
      const updatedVehicle = await Vehicle.findOneAndUpdate(
        { id },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!updatedVehicle) {
        console.error('❌ Failed to update vehicle after findOneAndUpdate');
        return res.status(500).json({ success: false, reason: 'Failed to update vehicle.' });
      }
      
      // Explicitly save to ensure persistence (especially for nested fields)
      await updatedVehicle.save();
      console.log('✅ Vehicle updated and saved successfully:', id);
      
      // Verify the update by querying again
      const verifyVehicle = await Vehicle.findOne({ id });
      if (!verifyVehicle) {
        console.warn('⚠️ Vehicle update verification failed - vehicle not found after update');
      } else {
        console.log('✅ Vehicle update verified in database');
      }
      
      // Convert Mongoose document to plain object for JSON serialization
      const vehicleObj = updatedVehicle.toObject();
      
      return res.status(200).json(vehicleObj);
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
    if (!mongoAvailable) {
      return unavailableResponse();
    }
    try {
      // Ensure database connection
      await ensureMongoConnection();
      
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, reason: 'Vehicle ID is required for deletion.' });
      }
      
      console.log('🔄 DELETE /vehicles - Deleting vehicle:', id);
      
      // SECURITY FIX: Ownership Check
      const vehicleToDelete = await Vehicle.findOne({ id });
      if (!vehicleToDelete) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = vehicleToDelete.sellerEmail ? vehicleToDelete.sellerEmail.toLowerCase().trim() : '';
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You do not own this listing.' });
      }
      
      const deletedVehicle = await Vehicle.findOneAndDelete({ id });
      if (!deletedVehicle) {
        console.warn('⚠️ Vehicle not found for deletion:', id);
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      console.log('✅ Vehicle deleted successfully from MongoDB:', id);
      
      // Verify the vehicle was deleted by querying it
      const verifyVehicle = await Vehicle.findOne({ id });
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
    if (error instanceof Error && (error.message.includes('MONGODB') || error.message.includes('connect'))) {
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
  const { mongoAvailable, mongoFailureReason } = options;

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
      const hasMongoUri = !!(process.env.MONGODB_URL || process.env.MONGODB_URI);
      
      if (!hasMongoUri) {
        return res.status(200).json({
          success: false,
          message: 'MONGODB_URL (or MONGODB_URI) environment variable is not configured',
          details: 'Please add MONGODB_URL in Vercel dashboard under Environment Variables (MONGODB_URI also works)',
          checks: [
            { name: 'MongoDB URL/URI Configuration', status: 'FAIL', details: 'MONGODB_URL (or MONGODB_URI) environment variable not found' }
          ]
        });
      }

      if (!mongoAvailable) {
        return res.status(200).json({
          success: false,
          message: mongoFailureReason || 'Database connection unavailable.',
          details: mongoFailureReason || 'The API is running in fallback mode without MongoDB.',
          checks: [
            { name: 'MongoDB Availability', status: 'FAIL', details: mongoFailureReason || 'Connection failed' }
          ]
        });
      }

      await ensureMongoConnection();
      const db = Vehicle.db?.db;
      const collections = db ? await db.listCollections().toArray() : [];
      
      return res.status(200).json({
        success: true,
        message: 'Database connected successfully',
        collections: collections.map(c => c.name),
          checks: [
            { name: 'MongoDB URL/URI Configuration', status: 'PASS', details: 'MONGODB_URL (or MONGODB_URI) is set' },
            { name: 'Database Connection', status: 'PASS', details: 'Successfully connected to MongoDB' }
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
    
    if (!mongoAvailable) {
      return res.status(503).json({
        success: false,
        message: mongoFailureReason || 'Database unavailable. Cannot seed data.',
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
    await ensureMongoConnection();
    const state = getConnectionState();
    return res.status(200).json({
      status: 'ok',
      message: 'Database connected successfully.',
      connectionState: state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    let errorMessage = 'Database connection failed';
    
    if (error instanceof Error) {
      if (error.message.includes('MONGODB_URI') || error.message.includes('MONGODB_URL')) {
        errorMessage += ' - Check MONGODB_URL (or MONGODB_URI) environment variable in Vercel dashboard';
      } else if (error.message.includes('connect') || error.message.includes('timeout')) {
        errorMessage += ' - Check database server status and network connectivity';
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

  if (!options.mongoAvailable) {
    return res.status(503).json({
      success: false,
      message: options.mongoFailureReason || 'Database unavailable. Cannot seed data.',
      fallback: true
    });
  }

  try {
    await ensureMongoConnection();
    
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
      // Always return default data if mongo is not available
      if (!options.mongoAvailable) {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(defaultData);
      }

      try {
        await ensureMongoConnection();
        logInfo('📡 Connected to database for vehicle-data fetch operation');
        
        let vehicleDataDoc = await VehicleDataModel.findOne();
        if (!vehicleDataDoc) {
          // Create default vehicle data if none exists
          vehicleDataDoc = new VehicleDataModel({ data: defaultData });
          await vehicleDataDoc.save();
        }
        
        return res.status(200).json(vehicleDataDoc.data);
      } catch (dbError) {
        logWarn('⚠️ Database connection failed for vehicle-data, returning default data:', dbError);
        // Return default data as fallback - NEVER return 500
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(defaultData);
      }
    }

    if (req.method === 'POST') {
      // Always return success response, even if mongo is not available
      if (!options.mongoAvailable) {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({
          success: true,
          data: req.body,
          message: 'Vehicle data processed (database unavailable, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }

      try {
        await ensureMongoConnection();
        logInfo('📡 Connected to database for vehicle-data save operation');
        
        const vehicleData = await VehicleDataModel.findOneAndUpdate(
          {},
          { 
            data: req.body,
            updatedAt: new Date()
          },
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
          }
        );
        
        console.log('✅ Vehicle data saved successfully to database');
        return res.status(200).json({ 
          success: true, 
          data: vehicleData.data,
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
  if (!options.mongoAvailable) {
    return res.status(503).json({
      success: false,
      reason: options.mongoFailureReason || 'Database unavailable. New car catalog requires MongoDB.',
      fallback: true
    });
  }

  if (req.method === 'GET') {
    const items = await NewCar.find({}).sort({ updatedAt: -1 });
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (!payload || !payload.brand_name || !payload.model_name || !payload.model_year) {
      return res.status(400).json({ success: false, reason: 'Missing required fields' });
    }
    const doc = new NewCar({ ...payload });
    await doc.save();
    return res.status(201).json({ success: true, data: doc });
  }

  if (req.method === 'PUT') {
    const { id, _id, ...updateData } = req.body || {};
    const docId = _id || id;
    if (!docId) {
      return res.status(400).json({ success: false, reason: 'Document id (_id) is required' });
    }
    const updated = await NewCar.findByIdAndUpdate(docId, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, reason: 'New car document not found' });
    }
    return res.status(200).json({ success: true, data: updated });
  }

  if (req.method === 'DELETE') {
    const { id, _id } = req.body || {};
    const docId = _id || id;
    if (!docId) {
      return res.status(400).json({ success: false, reason: 'Document id (_id) is required' });
    }
    const deleted = await NewCar.findByIdAndDelete(docId);
    if (!deleted) {
      return res.status(404).json({ success: false, reason: 'New car document not found' });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed.' });
}

// Generate cryptographically random password
function generateRandomPassword(): string {
  return randomBytes(32).toString('hex');
}

async function seedUsers(): Promise<UserDocument[]> {
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
      id: 1,
      email: 'admin@test.com',
      password: adminPassword,
      name: 'Admin User',
      mobile: '9876543210',
      role: 'admin',
      status: 'active',
      isVerified: true,
      subscriptionPlan: 'premium',
      featuredCredits: 100,
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      email: 'seller@test.com',
      password: sellerPassword,
      name: 'Prestige Motors',
      mobile: '+91-98765-43210',
      role: 'seller',
      status: 'active',
      isVerified: true,
      subscriptionPlan: 'premium',
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
      id: 3,
      email: 'customer@test.com',
      password: customerPassword,
      name: 'Test Customer',
      mobile: '9876543212',
      role: 'customer',
      status: 'active',
      isVerified: false,
      subscriptionPlan: 'free',
      featuredCredits: 0,
      avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com',
      createdAt: new Date().toISOString()
    }
  ];

  await User.deleteMany({});
  const users = await User.insertMany(sampleUsers);
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
      category: 'FOUR_WHEELER',
      sellerEmail: 'seller@test.com',
      status: 'published',
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
      category: 'FOUR_WHEELER',
      sellerEmail: 'seller@test.com',
      status: 'published',
      isFeatured: true,
      createdAt: new Date().toISOString()
    }
  ];

  await Vehicle.deleteMany({});
  const vehicles = await Vehicle.insertMany(sampleVehicles);
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
    console.log('🔍 Testing MongoDB connection and collection...');
    
    await ensureMongoConnection();
    
    return res.status(200).json({
      success: true,
      message: 'MongoDB connection test successful',
      timestamp: new Date().toISOString(),
      details: {
        connection: 'active',
        database: 'reride',
        collections: 'accessible'
      }
    });
  } catch (error) {
    console.error('❌ MongoDB connection test failed:', error);
    
    return res.status(500).json({
      success: false,
      message: 'MongoDB connection test failed',
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

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: payload.prompt || JSON.stringify(payload)
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || `API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

    return res.status(200).json({
      success: true,
      response: generatedText,
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
  if (!options.mongoAvailable) {
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
      reason: options.mongoFailureReason || 'Database is currently unavailable'
    });
  }

  try {
    await ensureMongoConnection();
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection not available' 
      });
    }
    
    const { type } = req.query;
    
    switch (type) {
      case 'faqs':
        return await handleFAQs(req, res, db);
      case 'support-tickets':
        return await handleSupportTickets(req, res, db);
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
async function handleFAQs(req: VercelRequest, res: VercelResponse, db: any) {
  const collection = db.collection('faqs');

  switch (req.method) {
    case 'GET':
      return await handleGetFAQs(req, res, collection);
    case 'POST':
      return await handleCreateFAQ(req, res, collection);
    case 'PUT':
      return await handleUpdateFAQ(req, res, collection);
    case 'DELETE':
      return await handleDeleteFAQ(req, res, collection);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetFAQs(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { category } = req.query;
    
    interface FAQQuery {
      category?: string;
    }
    const query: FAQQuery = {};
    
    if (category && category !== 'all' && typeof category === 'string') {
      // Sanitize category to prevent NoSQL injection
      query.category = await sanitizeString(category);
    }

    const faqs = await collection.find(query).toArray();
    
    // Transform MongoDB documents to include id field
    interface FAQDocument {
      _id?: { toString(): string };
      id?: number;
      question?: string;
      answer?: string;
      category?: string;
    }
    const transformedFaqs = faqs.map((faq: FAQDocument, index: number) => ({
      id: faq.id || (faq._id ? parseInt(faq._id.toString().slice(-8), 16) : index + 1),
      question: faq.question || '',
      answer: faq.answer || '',
      category: faq.category || 'General',
      _id: faq._id // Keep _id for MongoDB operations
    }));
    
    return res.status(200).json({
      success: true,
      faqs: transformedFaqs,
      count: transformedFaqs.length
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

async function handleCreateFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const faqData = req.body;
    
    if (!faqData.question || !faqData.answer || !faqData.category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, answer, category'
      });
    }

    const result = await collection.insertOne({
      ...faqData,
      createdAt: new Date().toISOString()
    });

    // Transform to include id field
    const createdFaq = {
      id: faqData.id || parseInt(result.insertedId.toString().slice(-8), 16),
      question: faqData.question,
      answer: faqData.answer,
      category: faqData.category,
      _id: result.insertedId
    };

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      faq: createdFaq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create FAQ'
    });
  }
}

async function handleUpdateFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(id as string);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid FAQ ID format'
      });
    }

    const result = await collection.updateOne(
      { _id: objectId },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'FAQ updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update FAQ'
    });
  }
}

async function handleDeleteFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(id as string);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid FAQ ID format'
      });
    }

    const result = await collection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully',
      deletedCount: result.deletedCount
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
async function handleSupportTickets(req: VercelRequest, res: VercelResponse, db: any) {
  const collection = db.collection('supportTickets');

  switch (req.method) {
    case 'GET':
      return await handleGetSupportTickets(req, res, collection);
    case 'POST':
      return await handleCreateSupportTicket(req, res, collection);
    case 'PUT':
      return await handleUpdateSupportTicket(req, res, collection);
    case 'DELETE':
      return await handleDeleteSupportTicket(req, res, collection);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetSupportTickets(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { userEmail, status } = req.query;
    
    interface TicketQuery {
      userEmail?: string;
      status?: string;
    }
    const query: TicketQuery = {};
    
    if (userEmail && typeof userEmail === 'string') {
      // Sanitize email to prevent NoSQL injection
      query.userEmail = await sanitizeString(userEmail);
    }
    
    if (status && typeof status === 'string') {
      // Validate status is one of allowed values
      const allowedStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
      if (allowedStatuses.includes(status)) {
        query.status = status;
      }
    }

    const tickets = await collection.find(query).sort({ createdAt: -1 }).toArray();
    
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

async function handleCreateSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const ticketData = req.body;
    
    if (!ticketData.userEmail || !ticketData.userName || !ticketData.subject || !ticketData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userEmail, userName, subject, message'
      });
    }

    const result = await collection.insertOne({
      ...ticketData,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: []
    });

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket: { ...ticketData, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
}

async function handleUpdateSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(id as string);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid support ticket ID format'
      });
    }

    const result = await collection.updateOne(
      { _id: objectId },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Support ticket updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update support ticket'
    });
  }
}

async function handleDeleteSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(id as string);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid support ticket ID format'
      });
    }

    const result = await collection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Support ticket deleted successfully',
      deletedCount: result.deletedCount
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
  if (!options.mongoAvailable) {
    return res.status(503).json({
      success: false,
      reason: options.mongoFailureReason || 'Database is currently unavailable'
    });
  }

  const { method } = req;

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection not available' 
      });
    }
    
    // Verify we're connected to the correct database (reride)
    const dbName = db.databaseName;
    if (dbName.toLowerCase() !== 'reride') {
      console.warn(`⚠️ handleSellCar: Connected to database "${dbName}" but expected "reride"`);
    } else {
      console.log(`✅ handleSellCar: Connected to correct database: ${dbName}`);
    }
    
    const collection = db.collection('sellCarSubmissions');

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

        const existingSubmission = await collection.findOne({
          registration: submissionData.registration
        });

        if (existingSubmission) {
          return res.status(409).json({ 
            error: 'Car with this registration number already submitted' 
          });
        }

        // Sanitize submission data to prevent NoSQL injection
        const sanitizedSubmissionData = await sanitizeObject(submissionData);
        const result = await collection.insertOne(sanitizedSubmissionData);
        
        res.status(201).json({
          success: true,
          id: result.insertedId.toString(),
          message: 'Car submission received successfully'
        });
        break;

      case 'GET':
        const { page = 1, limit = 10, status: statusFilter, search } = req.query;
        const pageNum = parseInt(String(page), 10) || 1;
        const limitNum = parseInt(String(limit), 10) || 10;
        const skip = Math.max(0, (pageNum - 1) * limitNum);

        interface SubmissionFilter {
          status?: string;
          $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
        }
        const filter: SubmissionFilter = {};
        
        if (statusFilter && typeof statusFilter === 'string') {
          // Validate status is one of allowed values
          const allowedStatuses = ['pending', 'approved', 'rejected', 'processing'];
          if (allowedStatuses.includes(statusFilter.toLowerCase())) {
            filter.status = statusFilter;
          }
        }
        
        if (search && typeof search === 'string') {
          // Sanitize search term to prevent NoSQL injection
          const sanitizedSearch = await sanitizeString(search);
          filter.$or = [
            { registration: { $regex: sanitizedSearch, $options: 'i' } },
            { make: { $regex: sanitizedSearch, $options: 'i' } },
            { model: { $regex: sanitizedSearch, $options: 'i' } },
            { customerContact: { $regex: sanitizedSearch, $options: 'i' } }
          ];
        }

        const submissions = await collection
          .find(filter)
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .toArray();

        const total = await collection.countDocuments(filter);

        res.status(200).json({
          success: true,
          data: submissions,
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

        let objectId;
        try {
          objectId = new ObjectId(id);
        } catch (error) {
          return res.status(400).json({ error: 'Invalid submission ID format' });
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

        const updateResult = await collection.updateOne(
          { _id: objectId },
          { $set: updateData }
        );

        if (updateResult.matchedCount === 0) {
          return res.status(404).json({ error: 'Submission not found' });
        }

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

        let deleteObjectId;
        try {
          deleteObjectId = new ObjectId(deleteId as string);
        } catch (error) {
          return res.status(400).json({ error: 'Invalid submission ID format' });
        }

        const deleteResult = await collection.deleteOne({ _id: deleteObjectId });
        
        if (deleteResult.deletedCount === 0) {
          return res.status(404).json({ error: 'Submission not found' });
        }

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
    if (!options.mongoAvailable) {
      return res.status(503).json({
        success: false,
        reason: options.mongoFailureReason || 'Database is currently unavailable'
      });
    }

    await ensureMongoConnection();

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
    if (error instanceof Error && (error.message.includes('MONGODB') || error.message.includes('connect'))) {
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
    if (!options.mongoAvailable) {
      return res.status(503).json({
        success: false,
        reason: options.mongoFailureReason || 'Database is currently unavailable'
      });
    }

    // GET - Retrieve conversations
    if (req.method === 'GET') {
      const { customerId, sellerId, conversationId } = req.query;
      
      if (conversationId) {
        // Get single conversation
        const conversation = await Conversation.findOne({ id: conversationId }).lean();
        if (!conversation) {
          return res.status(404).json({ success: false, reason: 'Conversation not found' });
        }
        return res.status(200).json({ success: true, data: conversation });
      }
      
      // Build query
      const query: any = {};
      if (customerId) query.customerId = customerId;
      if (sellerId) query.sellerId = sellerId;
      
      const conversations = await Conversation.find(query).sort({ lastMessageAt: -1 }).lean();
      return res.status(200).json({ success: true, data: conversations });
    }

    // POST - Create or update conversation
    if (req.method === 'POST') {
      const conversationData = req.body;
      
      if (!conversationData.id) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      // Use upsert to create or update
      const conversation = await Conversation.findOneAndUpdate(
        { id: conversationData.id },
        conversationData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();

      return res.status(200).json({ success: true, data: conversation });
    }

    // PUT - Update conversation (add message)
    if (req.method === 'PUT') {
      const { conversationId, message } = req.body;
      
      if (!conversationId || !message) {
        return res.status(400).json({ success: false, reason: 'Conversation ID and message are required' });
      }

      const conversation = await Conversation.findOneAndUpdate(
        { id: conversationId },
        { 
          $push: { messages: message },
          $set: { lastMessageAt: message.timestamp }
        },
        { new: true }
      ).lean();

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

      await Conversation.deleteOne({ id: conversationId });
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
    if (!options.mongoAvailable) {
      return res.status(503).json({
        success: false,
        reason: options.mongoFailureReason || 'Database is currently unavailable'
      });
    }

    // GET - Retrieve notifications
    if (req.method === 'GET') {
      const { recipientEmail, isRead, notificationId } = req.query;
      
      if (notificationId) {
        // Get single notification
        const notification = await Notification.findOne({ id: Number(notificationId) }).lean();
        if (!notification) {
          return res.status(404).json({ success: false, reason: 'Notification not found' });
        }
        return res.status(200).json({ success: true, data: notification });
      }
      
      // Build query
      const query: any = {};
      if (recipientEmail) {
        const emailValue = Array.isArray(recipientEmail) ? recipientEmail[0] : recipientEmail;
        query.recipientEmail = emailValue.toLowerCase().trim();
      }
      if (isRead !== undefined) {
        const isReadValue = Array.isArray(isRead) ? isRead[0] : isRead;
        query.isRead = isReadValue === 'true';
      }
      
      const notifications = await Notification.find(query).sort({ timestamp: -1 }).lean();
      return res.status(200).json({ success: true, data: notifications });
    }

    // POST - Create notification
    if (req.method === 'POST') {
      const notificationData = req.body;
      
      if (!notificationData.id || !notificationData.recipientEmail) {
        return res.status(400).json({ success: false, reason: 'Notification ID and recipient email are required' });
      }

      // Normalize email
      notificationData.recipientEmail = notificationData.recipientEmail.toLowerCase().trim();

      const notification = await Notification.create(notificationData);
      return res.status(201).json({ success: true, data: notification.toObject() });
    }

    // PUT - Update notification (mark as read, etc.)
    if (req.method === 'PUT') {
      const { notificationId, updates } = req.body;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }

      const notification = await Notification.findOneAndUpdate(
        { id: Number(notificationId) },
        { $set: updates },
        { new: true }
      ).lean();

      if (!notification) {
        return res.status(404).json({ success: false, reason: 'Notification not found' });
      }

      return res.status(200).json({ success: true, data: notification });
    }

    // DELETE - Delete notification
    if (req.method === 'DELETE') {
      const { notificationId } = req.query;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }

      await Notification.deleteOne({ id: Number(notificationId) });
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
    if (!options.mongoAvailable) {
      return res.status(503).json({
        success: false,
        reason: options.mongoFailureReason || 'Database is currently unavailable'
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


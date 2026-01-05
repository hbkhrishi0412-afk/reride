import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import type { User } from '../types.js';
import { getSecurityConfig } from './security-config.js';

// Get security configuration
const config = getSecurityConfig();

// Cached promise for DOMPurify to avoid multiple imports
let dompurifyPromise: Promise<any> | null = null;

const getDOMPurify = async () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!dompurifyPromise) {
    dompurifyPromise = import('dompurify').then(module => module.default).catch(() => null);
  }
  
  return dompurifyPromise;
};

// Safe HTML sanitizer usable in both browser and server environments.
// - In browser: use DOMPurify if available.
// - In server (Vercel functions): fall back to validator-based escaping.
const sanitizeHtml = async (input: string): Promise<string> => {
  try {
    // Use DOMPurify only when running in a browser-like environment
    if (typeof window !== 'undefined') {
      const DOMPurify = await getDOMPurify();
      if (DOMPurify && DOMPurify.sanitize) {
        return DOMPurify.sanitize(input);
      }
    }
  } catch {
    // Ignore and fall back to validator escaping below
  }
  // Server-side fallback: escape potentially dangerous characters
  return validator.escape(input);
};

// Password hashing utilities
export const hashPassword = async (password: string): Promise<string> => {
  try {
    return await bcrypt.hash(password, 12); // Use secure salt rounds
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

/**
 * Constant-time string comparison to prevent timing attacks
 * Uses crypto.timingSafeEqual for secure comparison
 * Never falls back to timing-unsafe comparison - fails securely if crypto operations fail
 */
const constantTimeCompare = (a: string, b: string): boolean => {
  try {
    // Convert strings to buffers for timing-safe comparison
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');
    
    // If lengths differ, pad the shorter buffer to match the longer one
    // This ensures we always perform a full comparison operation
    // to maintain constant-time behavior
    if (bufferA.length !== bufferB.length) {
      const maxLength = Math.max(bufferA.length, bufferB.length);
      const paddedA = Buffer.alloc(maxLength, 0);
      const paddedB = Buffer.alloc(maxLength, 0);
      bufferA.copy(paddedA);
      bufferB.copy(paddedB);
      // Perform comparison with padded buffers to maintain constant time
      // Result will be false since lengths differ, but timing is preserved
      // Use void to explicitly discard result while preventing optimization
      void crypto.timingSafeEqual(paddedA, paddedB);
      return false;
    }
    
    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    // Fail securely: never degrade to timing-unsafe comparison
    // If crypto.timingSafeEqual fails, it indicates a serious system error
    // Log the error and throw to prevent silent security degradation
    console.error('CRITICAL: Timing-safe comparison failed:', error);
    throw new Error('Password comparison failed due to system error. Authentication aborted for security.');
  }
};

export const validatePassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    // Add check for missing hash
    if (!hash) {
      console.warn('Password validation failed: hash is missing');
      return false;
    }
    
    // CRITICAL FIX: Check if hash is a bcrypt hash BEFORE trying bcrypt.compare
    // This prevents errors when comparing plain text passwords
    const isBcryptHash = hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
    
    if (isBcryptHash) {
      // Hash is a bcrypt hash, use bcrypt.compare
      try {
        const bcryptResult = await bcrypt.compare(password, hash);
        return bcryptResult;
      } catch (bcryptError) {
        // If bcrypt.compare throws an error, the hash format is invalid
        console.warn('bcrypt.compare error (invalid hash format):', bcryptError);
        return false;
      }
    } else {
      // Hash is NOT a bcrypt hash (likely plain text)
      // Use plain text comparison for backward compatibility
      const normalizedPassword = password.trim();
      const normalizedHash = hash.trim();
      
      // Only log warning in non-production environments to avoid log noise
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Password stored as plain text in database. Please update to hashed password for security.');
      }
      
      return constantTimeCompare(normalizedPassword, normalizedHash);
    }
  } catch (error) {
    // Log the error but return false to treat it as an authentication failure
    console.warn('Password validation error:', error);
    return false;
  }
};

// JWT token utilities
export const generateAccessToken = (user: User): string => {
  const payload = {
    userId: user.id || user.email,
    email: user.email,
    role: user.role,
    type: 'access'
  };
  
  const secret = config.JWT.SECRET;
  if (!secret) {
    throw new Error('CRITICAL: JWT_SECRET is not defined in environment variables');
  }
  
  // CRITICAL FIX: Ensure expiration is properly set
  const expiresIn = config.JWT.ACCESS_TOKEN_EXPIRES_IN;
  if (!expiresIn || expiresIn === '1m' || expiresIn === '60s') {
    console.error('❌ CRITICAL: Token expiration is set to 1 minute! Using default 48h');
    return jwt.sign(payload, secret, { 
      expiresIn: '48h', // Force 48 hours
      issuer: config.JWT.ISSUER,
      audience: config.JWT.AUDIENCE
    });
  }
  
  return jwt.sign(payload, secret, { 
    expiresIn: expiresIn as any,
    issuer: config.JWT.ISSUER,
    audience: config.JWT.AUDIENCE
  });
};

export const generateRefreshToken = (user: User): string => {
  const payload = {
    userId: user.id || user.email,
    email: user.email,
    type: 'refresh'
  };
  
  const secret = config.JWT.SECRET;
  if (!secret) {
    throw new Error('CRITICAL: JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign(payload, secret, { 
    expiresIn: config.JWT.REFRESH_TOKEN_EXPIRES_IN as any,
    issuer: config.JWT.ISSUER,
    audience: config.JWT.AUDIENCE
  });
};

export interface TokenPayload {
  userId: string;
  email: string;
  role?: 'customer' | 'seller' | 'admin';
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export const verifyToken = (token: string): TokenPayload => {
  try {
    const secret = config.JWT.SECRET;
    if (!secret) {
      throw new Error('CRITICAL: JWT_SECRET is not defined in environment variables');
    }
    
    try {
      const decoded = jwt.verify(token, secret, {
        issuer: config.JWT.ISSUER,
        audience: config.JWT.AUDIENCE
      });
      
      if (typeof decoded === 'string' || !decoded) {
        throw new Error('Invalid token payload');
      }
      
      return decoded as TokenPayload;
    } catch (jwtError: unknown) {
      // Preserve JWT-specific errors for better debugging
      // jsonwebtoken throws errors with specific names
      if (jwtError && typeof jwtError === 'object' && 'name' in jwtError) {
        const errorName = (jwtError as { name: string }).name;
        if (errorName === 'TokenExpiredError') {
          throw new Error('Token has expired');
        } else if (errorName === 'JsonWebTokenError') {
          throw new Error('Invalid token format');
        } else if (errorName === 'NotBeforeError') {
          throw new Error('Token not yet valid');
        }
      }
      // For other JWT errors, throw a generic message
      throw new Error('Invalid or expired token');
    }
  } catch (error) {
    // Re-throw errors that are already user-friendly JWT-specific errors
    // These are the specific error messages thrown from the inner catch block above
    if (error instanceof Error) {
      const errorMsg = error.message;
      if (errorMsg === 'Token has expired' || 
          errorMsg === 'Invalid token format' || 
          errorMsg === 'Token not yet valid' ||
          errorMsg.includes('JWT_SECRET')) {
        throw error; // Preserve JWT-specific errors
      }
    }
    // For other errors, provide a generic message
    throw new Error('Invalid or expired token');
  }
};

export const refreshAccessToken = (refreshToken: string): string => {
  const decoded = verifyToken(refreshToken);
  
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  
  const user: Partial<User> = {
    id: decoded.userId as string,
    email: decoded.email as string,
    role: (decoded.role as 'customer' | 'seller' | 'admin') || 'customer' // Use role from token or default
  };
  
  return generateAccessToken(user as User);
};

// Input sanitization utilities
export const sanitizeString = async (input: string): Promise<string> => {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potential XSS attacks (browser) or escape (server)
  const sanitized = await sanitizeHtml(input);

  // Ensure HTML entities are escaped even after DOMPurify
  return validator.escape(sanitized);
};

export const sanitizeObject = async <T>(obj: T): Promise<T> => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return (await sanitizeString(obj)) as T;
  }
  
  if (Array.isArray(obj)) {
    return (await Promise.all(obj.map(item => sanitizeObject(item)))) as T;
  }
  
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize both key and value
      const sanitizedKey = await sanitizeString(key);
      sanitized[sanitizedKey] = await sanitizeObject(value);
    }
    return sanitized as T;
  }
  
  return obj;
};

// Validation utilities
export const validateEmail = (email: string): boolean => {
  return validator.isEmail(email) && email.length <= config.VALIDATION.EMAIL_MAX_LENGTH;
};

export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < config.PASSWORD.MIN_LENGTH) {
    errors.push(`Password must be at least ${config.PASSWORD.MIN_LENGTH} characters long`);
  }
  
  if (password.length > config.PASSWORD.MAX_LENGTH) {
    errors.push(`Password must be less than ${config.PASSWORD.MAX_LENGTH} characters`);
  }
  
  if (config.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (config.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (config.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (config.PASSWORD.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords (only if list is not empty)
  if (config.PASSWORD.COMMON_PASSWORDS.length > 0 && config.PASSWORD.COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common, please choose a stronger password');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateMobile = (mobile: string): boolean => {
  // Indian mobile numbers are exactly 10 digits and start with 6-9
  const cleaned = mobile.replace(/\D/g, ''); // Remove all non-digits
  // Validate: exactly 10 digits and starts with 6, 7, 8, or 9 (valid Indian mobile prefixes)
  return cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned);
};

interface UserInputData {
  email?: string;
  password?: string;
  name?: string;
  mobile?: string;
  role?: string;
  [key: string]: unknown;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: UserInputData;
}

export const validateUserInput = async (userData: unknown): Promise<ValidationResult> => {
  const errors: string[] = [];
  
  // Handle null/undefined input
  if (!userData || typeof userData !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid input data'],
      sanitizedData: undefined
    };
  }
  
  // Sanitize input first
  const sanitizedData = await sanitizeObject(userData as UserInputData) as UserInputData;
  
  // Validate email
  if (!sanitizedData.email || !validateEmail(sanitizedData.email)) {
    errors.push('Valid email address is required');
  }
  
  // Validate password if provided
  if (sanitizedData.password) {
    const passwordValidation = validatePasswordStrength(sanitizedData.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }
  
  // Validate name
  if (!sanitizedData.name || sanitizedData.name.trim().length < config.VALIDATION.NAME_MIN_LENGTH) {
    errors.push(`Name must be at least ${config.VALIDATION.NAME_MIN_LENGTH} characters long`);
  }
  
  if (sanitizedData.name && sanitizedData.name.length > config.VALIDATION.NAME_MAX_LENGTH) {
    errors.push(`Name must be less than ${config.VALIDATION.NAME_MAX_LENGTH} characters`);
  }
  
  // Validate mobile
  if (!sanitizedData.mobile || !validateMobile(sanitizedData.mobile)) {
    errors.push(`Valid 10-digit mobile number is required`);
  }
  
  // Validate role
  if (!sanitizedData.role || !config.VALIDATION.ALLOWED_ROLES.includes(sanitizedData.role)) {
    errors.push(`Valid role (${config.VALIDATION.ALLOWED_ROLES.join(', ')}) is required`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined
  };
};

// Rate limiting utilities
export const createRateLimitKey = (identifier: string, action: string): string => {
  return `rate_limit:${action}:${identifier}`;
};

// Security headers
export const getSecurityHeaders = (): Record<string, string> => {
  return config.SECURITY_HEADERS;
};

// Session management
export interface SessionData {
  userId: string;
  email: string;
  role: string;
  loginTime: number;
  lastActivity: number;
}

export const createSession = (user: User): SessionData => {
  const now = Date.now();
  return {
    userId: user.id || user.email,
    email: user.email,
    role: user.role,
    loginTime: now,
    lastActivity: now
  };
};

export const isSessionValid = (session: SessionData, maxInactivity: number = 30 * 60 * 1000): boolean => {
  const now = Date.now();
  return (now - session.lastActivity) < maxInactivity;
};

export const updateSessionActivity = (session: SessionData): SessionData => {
  return {
    ...session,
    lastActivity: Date.now()
  };
};

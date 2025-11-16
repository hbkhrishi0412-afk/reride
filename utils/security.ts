import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import validator from 'validator';
import type { User } from '../types';
import { getSecurityConfig } from './security-config';

// Get security configuration
const config = getSecurityConfig();

// Safe HTML sanitizer usable in both browser and server environments.
// - In browser: use DOMPurify if available.
// - In server (Vercel functions): fall back to validator-based escaping.
const sanitizeHtml = (input: string): string => {
  try {
    // Use DOMPurify only when running in a browser-like environment
    if (typeof window !== 'undefined') {
      // Lazy import to avoid bundling issues in serverless
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const DOMPurify = require('dompurify');
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

export const validatePassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error('Password validation failed');
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
  
  const secret = config.JWT.SECRET || 'fallback-secret-change-in-production';
  return jwt.sign(payload, secret, { 
    expiresIn: config.JWT.ACCESS_TOKEN_EXPIRES_IN as any,
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
  
  const secret = config.JWT.SECRET || 'fallback-secret-change-in-production';
  return jwt.sign(payload, secret, { 
    expiresIn: config.JWT.REFRESH_TOKEN_EXPIRES_IN as any,
    issuer: config.JWT.ISSUER,
    audience: config.JWT.AUDIENCE
  });
};

export const verifyToken = (token: string): any => {
  try {
    const secret = config.JWT.SECRET || 'fallback-secret-change-in-production';
    return jwt.verify(token, secret, {
      issuer: config.JWT.ISSUER,
      audience: config.JWT.AUDIENCE
    });
  } catch (error) {
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
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potential XSS attacks (browser) or escape (server)
  const sanitized = sanitizeHtml(input);

  // Ensure HTML entities are escaped even after DOMPurify
  return validator.escape(sanitized);
};

export const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize both key and value
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
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
  
  // Check for common weak passwords
  if (config.PASSWORD.COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common, please choose a stronger password');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateMobile = (mobile: string): boolean => {
  return validator.isMobilePhone(mobile, 'en-IN') && mobile.length === config.VALIDATION.MOBILE_LENGTH;
};

export const validateUserInput = (userData: any): { isValid: boolean; errors: string[]; sanitizedData?: any } => {
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
  const sanitizedData = sanitizeObject(userData);
  
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
    errors.push(`Valid ${config.VALIDATION.MOBILE_LENGTH}-digit mobile number is required`);
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

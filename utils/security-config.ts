// Security Configuration
// This file centralizes all security-related configuration

export const SECURITY_CONFIG = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    COMMON_PASSWORDS: [
      'password', '123456', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', 'dragon',
      'master', 'hello', 'login', 'pass', '1234'
    ]
  },

  // JWT Configuration
  JWT: {
    SECRET: process.env.JWT_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL: JWT_SECRET must be set in production environment');
      }
      return 'dev-only-secret-not-for-production';
    })(),
    ACCESS_TOKEN_EXPIRES_IN: '24h',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    ISSUER: 'reride-app',
    AUDIENCE: 'reride-users'
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: process.env.NODE_ENV === 'production' ? 1000 : 100, // 1000 requests/15min in production, 100 in dev
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_LOCKOUT_TIME: 30 * 60 * 1000 // 30 minutes
  },

  // CORS Configuration
  CORS: {
    ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
      ? [
          process.env.ALLOWED_ORIGIN || 'https://www.reride.co.in',
          'https://www.reride.co.in',
          'https://reride.co.in',
          'https://reride-app.vercel.app' // Keep for backward compatibility
        ]
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:5174',  // FIXED: Added port 5174 for consistency
          'https://reride-app.vercel.app',
          'https://reride--2-.vercel.app',
          'https://www.reride.co.in',
          'https://reride.co.in'
        ],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
    CREDENTIALS: true,
    MAX_AGE: 86400 // 24 hours
  },

  // Security Headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  },

  // Input Validation
  VALIDATION: {
    EMAIL_MAX_LENGTH: 254,
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    MOBILE_LENGTH: 10,
    ALLOWED_ROLES: ['customer', 'seller', 'admin']
  },

  // Session Management
  SESSION: {
    MAX_INACTIVITY: 30 * 60 * 1000, // 30 minutes
    MAX_SESSION_DURATION: 24 * 60 * 60 * 1000 // 24 hours
  },

  // Logging
  LOGGING: {
    LOG_AUTHENTICATION_ATTEMPTS: false, // SECURITY: Don't log auth attempts
    LOG_SENSITIVE_DATA: false, // SECURITY: Never log passwords or tokens
    LOG_ERRORS: true,
    LOG_SECURITY_EVENTS: true
  }
};

// Environment-specific overrides
export const getSecurityConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    ...SECURITY_CONFIG,
    JWT: {
      ...SECURITY_CONFIG.JWT,
      SECRET: isProduction 
        ? process.env.JWT_SECRET 
        : SECURITY_CONFIG.JWT.SECRET
    },
    LOGGING: {
      ...SECURITY_CONFIG.LOGGING,
      LOG_AUTHENTICATION_ATTEMPTS: !isProduction,
      LOG_SENSITIVE_DATA: false // Never log sensitive data
    }
  };
};

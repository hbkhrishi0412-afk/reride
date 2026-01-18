// Security Configuration
// Plain JavaScript version for runtime environments that do not transpile TypeScript.

const SECURITY_CONFIG = {
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
    // Lazy evaluation - only check JWT_SECRET when actually used, not at module load
    // This prevents errors during module initialization
    get SECRET() {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        if (process.env.NODE_ENV === 'production') {
          // In production, log warning only once to reduce noise
          if (!SECURITY_CONFIG.JWT._warned) {
            console.warn('⚠️ JWT_SECRET not set in production. Using fallback. Please set JWT_SECRET in Vercel environment variables.');
            SECURITY_CONFIG.JWT._warned = true;
          }
          // Return a fallback secret to prevent complete failure
          // This should be fixed by setting JWT_SECRET in Vercel
          return 'fallback-secret-please-set-jwt-secret-in-vercel';
        }
        return 'dev-only-secret-not-for-production';
      }
      return secret;
    },
    _warned: false, // Flag to prevent duplicate warnings
    // Token expiration times
    // Access tokens: shorter-lived for security (compromised tokens expire faster)
    // Refresh tokens: longer-lived for better UX (users don't need to re-login frequently)
    // Options: '15m', '30m', '1h', '2h', '4h', '8h', '12h', '24h', '48h', '7d', '14d', '30d'
    ACCESS_TOKEN_EXPIRES_IN: '48h', // Increased from '24h' to 48 hours for better UX
    REFRESH_TOKEN_EXPIRES_IN: '30d', // Increased from '7d' to 30 days for better UX
    ISSUER: 'reride-app',
    AUDIENCE: 'reride-users'
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_LOCKOUT_TIME: 30 * 60 * 1000 // 30 minutes
  },

  // CORS Configuration
  CORS: {
    ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
      ? [process.env.ALLOWED_ORIGIN || 'https://reride-app.vercel.app']
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://reride-app.vercel.app',
          'https://reride--2-.vercel.app'
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
    ALLOWED_ROLES: ['customer', 'seller']
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
      LOG_SENSITIVE_DATA: false
    }
  };
};

export { SECURITY_CONFIG };














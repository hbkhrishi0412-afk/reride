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
    // Do not throw at read — module init must not crash. Use getSecurityConfig().JWT.SECRET for signing.
    get SECRET() {
      const secret = (process.env.JWT_SECRET || '').trim();
      if (secret) return secret;
      if (process.env.NODE_ENV === 'production') {
        return '';
      }
      return 'dev-only-secret-not-for-production';
    },
    // Token expiration times
    // Access tokens: shorter-lived for security (compromised tokens expire faster)
    // Refresh tokens: longer-lived for better UX (users don't need to re-login frequently)
    // Options: '15m', '30m', '1h', '2h', '4h', '8h', '12h', '24h', '48h', '7d', '14d', '30d'
    ACCESS_TOKEN_EXPIRES_IN: '48h', // Increased from '24h' to 48 hours for better UX
    REFRESH_TOKEN_EXPIRES_IN: '30d', // Increased from '7d' to 30 days for better UX
    CLOCK_TOLERANCE_SECONDS: 60, // Grace period for minor clock skew
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
    // IMPORTANT:
    // - Vercel API runs on https://www.reride.co.in (or preview domains)
    // - Capacitor WebView origin is https://localhost (androidScheme: 'https')
    // If https://localhost is not allowed, Android WebView fetch() will be blocked by CORS.
    ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
      ? (() => {
          const fromEnv = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').trim();
          const envList = fromEnv
            ? fromEnv.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          // Always include canonical production domains + Capacitor origins.
          const defaults = [
            'https://www.reride.co.in',
            'https://reride.co.in',
            // Android WebViewAssetLoader origin (used by MainActivity)
            'https://appassets.androidplatform.net',
            'https://localhost',
            'capacitor://localhost',
            'http://localhost'
          ];
          // Keep historical Vercel domains as a fallback.
          const vercelDefaults = [
            'https://reride-app.vercel.app',
            'https://reride--2-.vercel.app'
          ];
          return Array.from(new Set([...envList, ...defaults, ...vercelDefaults]));
        })()
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://localhost',
          'capacitor://localhost',
          'https://appassets.androidplatform.net',
          'https://reride-app.vercel.app',
          'https://reride--2-.vercel.app'
        ],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // Must match utils/security-config.ts — Capacitor / WebView sends X-App-Client; web sends X-CSRF-Token.
    ALLOWED_HEADERS: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-App-Client'
    ],
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
    // Capacitor WebView (https://localhost) must be allowed to read JSON from www.reride.co.in (see security-config.ts).
    'Cross-Origin-Resource-Policy': 'cross-origin'
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
  const envSecret = (process.env.JWT_SECRET || '').trim();

  const jwtStatic = SECURITY_CONFIG.JWT;
  return {
    ...SECURITY_CONFIG,
    JWT: {
      ACCESS_TOKEN_EXPIRES_IN: jwtStatic.ACCESS_TOKEN_EXPIRES_IN,
      REFRESH_TOKEN_EXPIRES_IN: jwtStatic.REFRESH_TOKEN_EXPIRES_IN,
      CLOCK_TOLERANCE_SECONDS: jwtStatic.CLOCK_TOLERANCE_SECONDS,
      ISSUER: jwtStatic.ISSUER,
      AUDIENCE: jwtStatic.AUDIENCE,
      get SECRET() {
        if (envSecret) return envSecret;
        if (isProduction) {
          throw new Error(
            'JWT_SECRET is required in production but is not set. ' +
              'Configure JWT_SECRET in your environment (e.g. Vercel → Environment Variables).'
          );
        }
        return 'dev-only-secret-not-for-production';
      },
    },
    LOGGING: {
      ...SECURITY_CONFIG.LOGGING,
      LOG_AUTHENTICATION_ATTEMPTS: !isProduction,
      LOG_SENSITIVE_DATA: false
    }
  };
};

export { SECURITY_CONFIG };














// Security Configuration
// This file centralizes all security-related configuration

export const SECURITY_CONFIG = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: false, // Optional for better UX, but recommended
    REQUIRE_LOWERCASE: true, // Required for security
    REQUIRE_NUMBERS: true, // Required for security
    REQUIRE_SPECIAL_CHARS: false, // Optional for better UX, but recommended
    COMMON_PASSWORDS: [
      'password', '123456', '12345678', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', 'dragon',
      'master', 'hello', 'login', 'pass', '1234', '1234567890'
    ]
  },

  // JWT Configuration
  JWT: {
    // Do not throw in production here — any read during module init would crash the serverless bundle.
    // Use getSecurityConfig().JWT.SECRET (getter) for signing; it throws in prod when JWT_SECRET is unset.
    get SECRET() {
      const secret = process.env.JWT_SECRET?.trim();
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
    ACCESS_TOKEN_EXPIRES_IN: '24h', // Balance between security and UX
    REFRESH_TOKEN_EXPIRES_IN: '14d', // Balance between security and UX
    CLOCK_TOLERANCE_SECONDS: 60, // Grace period for minor clock skew
    ISSUER: 'reride-app',
    AUDIENCE: 'reride-users'
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    // Safer rate limits - configurable via environment variables
    // Each authenticated user gets their own rate limit bucket, so this is per-user
    MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS 
      ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10)
      : process.env.NODE_ENV === 'production' ? 1000 : 100, // 1000 requests/15min in production (reduced from 10000), 100 in dev
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
          'https://reride-app.vercel.app', // Keep for backward compatibility
          // Android WebViewAssetLoader origin (used by MainActivity)
          'https://appassets.androidplatform.net',
          'https://localhost',             // REQUIRED FOR CAPACITOR ANDROID APP
          'capacitor://localhost'          // REQUIRED FOR CAPACITOR IOS APP
        ]
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:5174',
          'https://reride-app.vercel.app',
          'https://reride--2-.vercel.app',
          'https://www.reride.co.in',
          'https://reride.co.in',
          'https://appassets.androidplatform.net',
          'https://localhost',
          'capacitor://localhost'
        ],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    ALLOWED_HEADERS: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-App-Client',
      'Accept',
      'Accept-Language',
      'If-None-Match',
      'sentry-trace',
      'baggage',
      'traceparent',
      'tracestate',
    ],
    CREDENTIALS: true,
    MAX_AGE: 86400 // 24 hours
  },

  // Security Headers (Helmet-like configuration)
  // Strong CSP policy with nonce support for inline scripts/styles
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0', // Disabled - CSP provides better protection
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // Enhanced CSP: More restrictive while allowing necessary functionality
    // Note: 'unsafe-inline' and 'unsafe-eval' are required for Vite HMR in development
    // In production, consider using nonces for inline scripts
    'Content-Security-Policy': process.env.NODE_ENV === 'production'
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com", // Required for Vite, allow analytics
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow Google Fonts
          "img-src 'self' data: https: blob:", // Allow images from any HTTPS source
          "connect-src 'self' https: wss: ws:", // Allow API calls and WebSockets
          "font-src 'self' data: https://fonts.gstatic.com", // Allow Google Fonts
          "object-src 'none'", // Block plugins
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'", // Prevent framing
          "upgrade-insecure-requests", // Force HTTPS
        ].join('; ')
      : [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Vite HMR
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https: blob:",
          "connect-src 'self' https: wss: ws: http://localhost:*", // Allow localhost for dev
          "font-src 'self' data: https:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    // require-corp on JSON API responses can break cross-origin fetch in some WebViews; keep API embeddable.
    'Cross-Origin-Embedder-Policy': 'unsafe-none',
    'Cross-Origin-Opener-Policy': 'same-origin',
    // Must allow cross-origin reads: Capacitor WebView (https://localhost) fetches this API on www.reride.co.in.
    // same-origin caused fetch() to fail in the native app with "Failed to fetch" / network errors.
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

// Environment-specific overrides.
// JWT_SECRET must be set in production for auth — but getSecurityConfig() must NOT throw at call time:
// Vercel loads api/main.ts as one bundle; throwing here prevents the function from booting, so every
// request returns FUNCTION_INVOCATION_FAILED with no CORS headers (browsers report a CORS error).
// Token helpers throw only when SECRET is actually read (see getter below).
export const getSecurityConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const envSecret = process.env.JWT_SECRET?.trim() || '';

  const jwtStatic = SECURITY_CONFIG.JWT;
  return {
    ...SECURITY_CONFIG,
    JWT: {
      ACCESS_TOKEN_EXPIRES_IN: jwtStatic.ACCESS_TOKEN_EXPIRES_IN,
      REFRESH_TOKEN_EXPIRES_IN: jwtStatic.REFRESH_TOKEN_EXPIRES_IN,
      CLOCK_TOLERANCE_SECONDS: jwtStatic.CLOCK_TOLERANCE_SECONDS,
      ISSUER: jwtStatic.ISSUER,
      AUDIENCE: jwtStatic.AUDIENCE,
      get SECRET(): string {
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

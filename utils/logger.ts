/**
 * Centralized logging utility
 * Gates all console statements to prevent logging in production
 * and potential information leakage
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Check if logging is enabled for the current environment
 */
const shouldLog = (level: LogLevel): boolean => {
  // Always log errors, even in production (but without sensitive data)
  if (level === 'error') {
    return true;
  }
  // Only log other levels in development
  return isDevelopment;
};

/**
 * Sanitize data to prevent logging sensitive information
 */
const sanitizeData = (data: unknown): unknown => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'auth', 'credential'];
  const sanitized = Array.isArray(data) ? [...data] : { ...data as Record<string, unknown> };

  if (Array.isArray(sanitized)) {
    return sanitized.map(item => sanitizeData(item));
  }

  const obj = sanitized as Record<string, unknown>;
  for (const key in obj) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      obj[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      obj[key] = sanitizeData(obj[key]);
    }
  }

  return sanitized;
};

/**
 * Logger object with methods for different log levels
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (shouldLog('log')) {
      console.log(...args.map(sanitizeData));
    }
  },

  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info(...args.map(sanitizeData));
    }
  },

  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(...args.map(sanitizeData));
    }
  },

  error: (...args: unknown[]) => {
    // Always log errors, but sanitize sensitive data
    const sanitized = args.map(sanitizeData);
    if (isProduction) {
      // In production, send to error tracking service (Sentry, etc.)
      // For now, just log without sensitive data
      console.error(...sanitized);
    } else {
      console.error(...sanitized);
    }
  },

  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug(...args.map(sanitizeData));
    }
  },
};

export default logger;

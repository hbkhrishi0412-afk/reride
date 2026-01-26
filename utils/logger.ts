/**
 * Centralized Logging Utility
 * Provides environment-aware logging that is automatically removed in production builds
 * SECURITY: All logs are sanitized to prevent secret exposure
 */

import { sanitizeErrorForLogging, sanitizeObject } from './secretSanitizer.js';

/**
 * Sanitizes log arguments to prevent secret exposure
 */
function sanitizeLogArgs(args: unknown[]): unknown[] {
  return args.map(arg => {
    if (arg instanceof Error) {
      return sanitizeErrorForLogging(arg);
    }
    if (typeof arg === 'string') {
      return sanitizeObject(arg);
    }
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeObject(arg);
    }
    return arg;
  });
}

/**
 * Logs information (only in development)
 */
export function logInfo(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    const sanitized = sanitizeLogArgs(args);
    console.log(...sanitized);
  }
}

/**
 * Logs warning messages (only in development)
 * @param args - Arguments to log (same as console.warn)
 * @example
 * logWarn('Deprecated API used:', apiName);
 */
export function logWarn(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    const sanitized = sanitizeLogArgs(args);
    console.warn(...sanitized);
  }
}

/**
 * Logs errors (always logged, but can be filtered in production)
 * SECURITY: Secrets are automatically sanitized before logging
 */
export function logError(...args: unknown[]): void {
  // Sanitize all error arguments to prevent secret exposure
  const sanitized = sanitizeLogArgs(args);
  console.error(...sanitized);
  
  // In production, send to error tracking service (e.g., Sentry, LogRocket)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with error tracking service
    // Example: if (window.Sentry) window.Sentry.captureException(args[0]);
  }
}

/**
 * Logs debug information (only in development)
 * @param args - Arguments to log (same as console.debug)
 * @example
 * logDebug('Component state:', state);
 */
export function logDebug(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    const sanitized = sanitizeLogArgs(args);
    console.debug(...sanitized);
  }
}

/**
 * Logs security-related events (always logged)
 * SECURITY: Secrets are automatically sanitized before logging
 */
export function logSecurity(...args: unknown[]): void {
  // Security events should always be logged, but sanitized
  const sanitized = sanitizeLogArgs(args);
  console.warn('[SECURITY]', ...sanitized);
  
  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with security monitoring service
  }
}

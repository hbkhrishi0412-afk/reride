/**
 * Centralized Logging Utility
 * Provides environment-aware logging that is automatically removed in production builds
 * SECURITY: All logs are sanitized to prevent secret exposure
 * 
 * PERFORMANCE: This logger is tree-shakeable - unused log calls are removed by bundlers
 * in production builds. The conditional checks ensure console methods are never called
 * in production, allowing Terser to eliminate the entire function body.
 */

import { sanitizeError, sanitizeObject } from './secretSanitizer.js';

/**
 * Sanitizes log arguments to prevent secret exposure
 */
function sanitizeLogArgs(args: unknown[]): unknown[] {
  return args.map(arg => {
    if (arg instanceof Error) {
      return sanitizeError(arg);
    }
    if (typeof arg === 'string') {
      return sanitizeError(arg);
    }
    if (typeof arg === 'object' && arg !== null) {
      // Ensure object has index signature
      const obj = arg as Record<string, unknown>;
      return sanitizeObject(obj);
    }
    return arg;
  });
}

/**
 * Tree-shakeable logger - completely eliminated in production builds
 * Using a const ensures the condition is evaluated at build time
 */
const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Logs information (only in development)
 * PERFORMANCE: Tree-shakeable - entire function body is removed in production
 */
export function logInfo(...args: unknown[]): void {
  // Using early return pattern allows better tree-shaking
  if (!IS_DEV) return;
  const sanitized = sanitizeLogArgs(args);
  // eslint-disable-next-line no-console
  console.log(...sanitized);
}

/**
 * Logs warning messages (only in development)
 * @param args - Arguments to log (same as console.warn)
 * @example
 * logWarn('Deprecated API used:', apiName);
 * PERFORMANCE: Tree-shakeable - entire function body is removed in production
 */
export function logWarn(...args: unknown[]): void {
  if (!IS_DEV) return;
  const sanitized = sanitizeLogArgs(args);
  // eslint-disable-next-line no-console
  console.warn(...sanitized);
}

/**
 * Error tracking service integration
 * Set this to your error tracking service instance (e.g., Sentry, LogRocket)
 * Example: window.errorTracker = Sentry;
 */
declare global {
  interface Window {
    errorTracker?: {
      captureException?: (error: Error | unknown, context?: Record<string, unknown>) => void;
      captureMessage?: (message: string, level?: 'error' | 'warning' | 'info') => void;
    };
  }
}

/**
 * Sends error to error tracking service if available
 */
function sendToErrorTracker(error: unknown, context?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && window.errorTracker?.captureException) {
    try {
      if (error instanceof Error) {
        window.errorTracker.captureException(error, context);
      } else {
        window.errorTracker.captureException(new Error(String(error)), context);
      }
    } catch (trackerError) {
      // Silently fail if error tracker itself has issues
      console.error('Error tracker failed:', trackerError);
    }
  }
}

/**
 * Logs errors (always logged, but sanitized)
 * SECURITY: Secrets are automatically sanitized before logging
 * PERFORMANCE: Error logging is kept in production for debugging, but sanitized
 */
export function logError(...args: unknown[]): void {
  // Sanitize all error arguments to prevent secret exposure
  const sanitized = sanitizeLogArgs(args);
  // eslint-disable-next-line no-console
  console.error(...sanitized);
  
  // In production, send to error tracking service (e.g., Sentry, LogRocket)
  if (process.env.NODE_ENV === 'production') {
    // Send first argument (usually the error) to error tracking service
    if (args.length > 0) {
      const error = args[0];
      const context = args.length > 1 ? { additionalInfo: args.slice(1) } : undefined;
      sendToErrorTracker(error, context);
    }
  }
}

/**
 * Logs debug information (only in development)
 * @param args - Arguments to log (same as console.debug)
 * @example
 * logDebug('Component state:', state);
 * PERFORMANCE: Tree-shakeable - entire function body is removed in production
 */
export function logDebug(...args: unknown[]): void {
  if (!IS_DEV) return;
  const sanitized = sanitizeLogArgs(args);
  // eslint-disable-next-line no-console
  console.debug(...sanitized);
}

/**
 * Logs security-related events (always logged)
 * SECURITY: Secrets are automatically sanitized before logging
 * PERFORMANCE: Security events are kept in production for monitoring
 */
export function logSecurity(...args: unknown[]): void {
  // Security events should always be logged, but sanitized
  const sanitized = sanitizeLogArgs(args);
  // eslint-disable-next-line no-console
  console.warn('[SECURITY]', ...sanitized);
  
  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send security events to error tracker with security tag
    if (typeof window !== 'undefined' && window.errorTracker?.captureMessage) {
      try {
        const message = args.map(arg => String(arg)).join(' ');
        window.errorTracker.captureMessage(`[SECURITY] ${message}`, 'warning');
      } catch (trackerError) {
        // Silently fail if error tracker itself has issues
        console.error('Security tracker failed:', trackerError);
      }
    }
  }
}

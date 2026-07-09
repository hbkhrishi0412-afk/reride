import { logInfo } from '../utils/logger.js';
/**
 * Monitoring and Observability Utilities
 * Centralized error tracking, performance monitoring, and logging
 */

// Error Tracking (Sentry integration)
export interface ErrorTracking {
  captureException: (error: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
  setUser: (user: { id: string; email?: string }) => void;
  setContext: (key: string, context: Record<string, unknown>) => void;
}

let errorTracker: ErrorTracking | null = null;

/**
 * Initialize error tracking (Sentry)
 */
export async function initErrorTracking(): Promise<void> {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    // Dynamic import to avoid bundling Sentry in development (optional dependency)
    const Sentry = await import('@sentry/react').catch(() => null);
    if (!Sentry?.init) return;

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1, // 10% of transactions
      beforeSend(event: { request?: { headers?: Record<string, string> } }) {
        if (event.request?.headers) {
          const h = event.request.headers as Record<string, string>;
          delete h['Authorization'];
          delete h['Cookie'];
        }
        return event as any;
      },
    });

    errorTracker = {
      captureException: (error, context) => Sentry.captureException(error, { contexts: { custom: context } }),
      captureMessage: (message, level) => Sentry.captureMessage(message, level || 'error'),
      setUser: (user) => Sentry.setUser(user),
      setContext: (key, context) => Sentry.setContext(key, context),
    };

    // Bridge utils/logger.ts production error reporting
    window.errorTracker = {
      captureException: (error, context) => {
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
          contexts: { custom: context },
        });
      },
      captureMessage: (message, level) => {
        Sentry.captureMessage(message, level === 'warning' ? 'warning' : level === 'info' ? 'info' : 'error');
      },
    };
  } catch (error) {
    console.warn('Failed to initialize error tracking:', error);
  }
}

/**
 * Track error
 */
export function trackError(error: Error, context?: Record<string, unknown>): void {
  if (errorTracker) {
    errorTracker.captureException(error, context);
  } else {
    console.error('Error:', error, context);
  }
}

/**
 * Track message
 */
export function trackMessage(message: string, level: 'info' | 'warning' | 'error' = 'error'): void {
  if (errorTracker) {
    errorTracker.captureMessage(message, level);
  } else {
    const method = level === 'warning' ? 'warn' : level;
    (console as unknown as Record<string, (m: string) => void>)[method](message);
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: { id: string; email?: string }): void {
  if (errorTracker) {
    errorTracker.setUser(user);
  }
}

export function clearUserContext(): void {
  if (errorTracker) {
    errorTracker.setUser({ id: '' });
  }
}

// Performance Monitoring (Web Vitals)
export interface WebVitals {
  name: string;
  value: number;
  id: string;
  delta: number;
}

/**
 * Initialize Web Vitals monitoring
 */
export function initWebVitals(onPerfEntry?: (metric: WebVitals) => void): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
    return;
  }

  import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
    const reportMetric = (metric: WebVitals) => {
      // Send to analytics endpoint
      if (onPerfEntry) {
        onPerfEntry(metric);
      }
      
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        logInfo(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms`);
      }
    };

    onCLS(reportMetric);
    onINP(reportMetric); // Replaces deprecated onFID in web-vitals v3
    onFCP(reportMetric);
    onLCP(reportMetric);
    onTTFB(reportMetric);
  }).catch(() => {
    // Web Vitals not available
  });
}

// Structured Logging
export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

const logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Structured log entry
 */
export function structuredLog(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // In production, forward to error tracking / remote logging when configured.
  if (process.env.NODE_ENV === 'production') {
    if (level === 'error') {
      trackError(new Error(message), context);
    } else {
      trackMessage(message, level === 'debug' ? 'info' : level);
    }
  } else {
    console[level](`[${entry.timestamp}] ${message}`, context || '');
  }
}

/**
 * Get recent logs
 */
export function getRecentLogs(count: number = 50): LogEntry[] {
  return logBuffer.slice(-count);
}















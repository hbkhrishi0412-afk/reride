/**
 * Safe logging utility that gates console statements in production
 * Prevents information leakage and performance issues
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Log info messages (only in development)
 */
export const logInfo = (...args: any[]): void => {
  if (isDevelopment) {
    console.log(...args);
  }
};

/**
 * Log warning messages (only in development, unless critical)
 */
export const logWarn = (...args: any[]): void => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

/**
 * Log error messages (always logged, but sanitized in production)
 */
export const logError = (...args: any[]): void => {
  // Process arguments to extract error information properly
  const processedArgs = args.map(arg => {
    if (arg instanceof Error) {
      // Extract Error properties explicitly and sanitize sensitive fields
      const errorObj: Record<string, any> = {
        name: arg.name,
        message: arg.message,
        stack: arg.stack,
      };
      
      // Extract custom properties from Error object
      Object.getOwnPropertyNames(arg).forEach(key => {
        if (key !== 'name' && key !== 'message' && key !== 'stack') {
          try {
            errorObj[key] = (arg as any)[key];
          } catch {
            // Skip non-enumerable or problematic properties
          }
        }
      });
      
      // Sanitize sensitive fields from Error object
      delete errorObj.password;
      delete errorObj.token;
      delete errorObj.secret;
      delete errorObj.apiKey;
      
      return errorObj;
    }
    if (typeof arg === 'object' && arg !== null) {
      // Remove sensitive fields
      const sanitized = { ...arg };
      delete (sanitized as any).password;
      delete (sanitized as any).token;
      delete (sanitized as any).secret;
      delete (sanitized as any).apiKey;
      return sanitized;
    }
    return arg;
  });

  if (isDevelopment) {
    console.error(...processedArgs);
  } else {
    // In production, log errors but sanitize sensitive data
    console.error(...processedArgs);
  }
};

/**
 * Log security events (always logged, but use proper logging service in production)
 */
export const logSecurity = (message: string, data?: any): void => {
  if (isDevelopment) {
    console.log(`[SECURITY] ${message}`, data || '');
  } else {
    // In production, use proper logging service (Sentry, CloudWatch, etc.)
    // For now, log to console but consider implementing structured logging
    console.log(`[SECURITY] ${message}`, data ? JSON.stringify(data) : '');
    // TODO: Replace with proper logging service
    // Example: Sentry.captureMessage(message, { level: 'info', extra: data });
  }
};

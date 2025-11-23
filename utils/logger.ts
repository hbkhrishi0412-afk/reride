// Centralized logging utility with environment-based controls
// Prevents information leakage and reduces performance overhead

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogOptions {
  level?: LogLevel;
  context?: string;
  data?: unknown;
}

class Logger {
  private isProduction: boolean;
  private isDevelopment: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isDevelopment = !this.isProduction;
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log errors and warnings
    if (this.isProduction) {
      return level === 'error' || level === 'warn';
    }
    // In development, log everything
    return true;
  }

  private sanitizeData(data: unknown): unknown {
    if (!data) return data;
    
    // Remove sensitive fields from logs
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data as Record<string, unknown> };
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization', 'accessToken', 'refreshToken'];
      
      for (const field of sensitiveFields) {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]';
        }
      }
      
      return sanitized;
    }
    
    return data;
  }

  info(message: string, options?: LogOptions): void {
    if (!this.shouldLog('info')) return;
    
    const context = options?.context ? `[${options.context}]` : '';
    const data = options?.data ? this.sanitizeData(options.data) : undefined;
    
    if (data) {
      console.log(`${context} ${message}`, data);
    } else {
      console.log(`${context} ${message}`);
    }
  }

  warn(message: string, options?: LogOptions): void {
    if (!this.shouldLog('warn')) return;
    
    const context = options?.context ? `[${options.context}]` : '';
    const data = options?.data ? this.sanitizeData(options.data) : undefined;
    
    if (data) {
      console.warn(`${context} ${message}`, data);
    } else {
      console.warn(`${context} ${message}`);
    }
  }

  error(message: string, error?: Error | unknown, options?: LogOptions): void {
    if (!this.shouldLog('error')) return;
    
    const context = options?.context ? `[${options.context}]` : '';
    const sanitizedData = options?.data ? this.sanitizeData(options.data) : undefined;
    
    if (error instanceof Error) {
      // Log error without sensitive stack trace in production
      if (this.isProduction) {
        console.error(`${context} ${message}: ${error.message}`);
      } else {
        console.error(`${context} ${message}`, error, sanitizedData);
      }
    } else if (error) {
      console.error(`${context} ${message}`, error, sanitizedData);
    } else {
      console.error(`${context} ${message}`, sanitizedData);
    }
  }

  debug(message: string, options?: LogOptions): void {
    // Only log debug in development
    if (!this.isDevelopment) return;
    
    const context = options?.context ? `[${options.context}]` : '';
    const data = options?.data ? this.sanitizeData(options.data) : undefined;
    
    if (data) {
      console.debug(`${context} ${message}`, data);
    } else {
      console.debug(`${context} ${message}`);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };


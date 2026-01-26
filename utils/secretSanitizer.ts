/**
 * Secret Sanitization Utility
 * Prevents sensitive information (API keys, passwords, tokens) from being exposed in error messages
 */

/**
 * Patterns that indicate sensitive information
 */
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  /(secret|token|password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/gi,
  // JWT tokens
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // Supabase keys (long base64-like strings)
  /supabase[_-]?(url|key|secret|service[_-]?role[_-]?key)\s*[:=]\s*['"]?([^\s'"]{50,})['"]?/gi,
  // Connection strings
  /(mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi,
  // Firebase keys
  /firebase[_-]?(api[_-]?key|project[_-]?id|private[_-]?key)\s*[:=]\s*['"]?([^\s'"]{20,})['"]?/gi,
  // AWS keys
  /aws[_-]?(access[_-]?key|secret[_-]?key|session[_-]?token)\s*[:=]\s*['"]?([^\s'"]{20,})['"]?/gi,
];

/**
 * Sanitizes an error object or message to remove sensitive information
 * @param error - Error object, string, or unknown type
 * @returns Sanitized error message safe for logging
 * @example
 * const safeError = sanitizeError(new Error('API key: abc123...'));
 * // Returns: "API key: [REDACTED]"
 */
export function sanitizeError(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  let errorMessage = '';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    try {
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = String(error);
    }
  }

  // Sanitize the message
  let sanitized = errorMessage;
  
  // Replace sensitive patterns with placeholders
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, (match, key, value) => {
      if (key) {
        return `${key}=[REDACTED]`;
      }
      return '[REDACTED]';
    });
  });

  // Additional sanitization for common patterns
  // Remove any remaining long strings that might be keys
  sanitized = sanitized.replace(/([a-zA-Z0-9_\-]{40,})/g, (match) => {
    // If it looks like a key/token (long alphanumeric), redact it
    if (match.length > 40 && /^[a-zA-Z0-9_\-]+$/.test(match)) {
      return '[REDACTED]';
    }
    return match;
  });

  // Ensure we don't return empty string
  if (!sanitized || sanitized.trim() === '') {
    return 'An error occurred (details sanitized for security)';
  }

  return sanitized;
}

/**
 * Sanitizes an object by removing sensitive fields
 * @param obj - Object to sanitize
 * @param sensitiveFields - Array of field names to redact (default: common sensitive fields)
 * @returns Sanitized object with sensitive fields redacted
 * @example
 * const user = { email: 'user@example.com', password: 'secret123' };
 * const safe = sanitizeObject(user);
 * // Returns: { email: 'user@example.com', password: '[REDACTED]' }
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  sensitiveFields: string[] = ['password', 'token', 'secret', 'key', 'apiKey', 'accessToken', 'refreshToken', 'privateKey', 'serviceRoleKey']
): Partial<T> {
  const sanitized = { ...obj };
  
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]' as T[Extract<keyof T, string>];
    }
  });

  return sanitized;
}

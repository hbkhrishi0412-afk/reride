/**
 * Standardized error response utility
 * Ensures consistent error format across all API endpoints
 */

export interface StandardErrorResponse {
  success: false;
  reason: string;
  message?: string;
  error?: string;
  code?: string;
  timestamp?: string;
  fallback?: boolean;
}

export interface StandardSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
  timestamp?: string;
}

export type StandardResponse<T = unknown> = StandardSuccessResponse<T> | StandardErrorResponse;

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  reason: string,
  statusCode: number = 400,
  options?: {
    message?: string;
    error?: string;
    code?: string;
    fallback?: boolean;
  }
): { status: number; body: StandardErrorResponse } {
  return {
    status: statusCode,
    body: {
      success: false,
      reason,
      message: options?.message,
      error: options?.error,
      code: options?.code,
      timestamp: new Date().toISOString(),
      fallback: options?.fallback || false,
    },
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): StandardSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Common error reasons
 */
export const ErrorReasons = {
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  VALIDATION_ERROR: 'Validation error',
  SERVER_ERROR: 'Server error',
  DATABASE_ERROR: 'Database error',
  INVALID_INPUT: 'Invalid input',
  MISSING_REQUIRED_FIELD: 'Missing required field',
  INVALID_CREDENTIALS: 'Invalid credentials',
  TOKEN_EXPIRED: 'Token expired',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
} as const;


/**
 * Standardized Error Utilities
 * Provides consistent error formatting and handling across the application
 * 
 * @module errorUtils
 * @example
 * ```typescript
 * const error = createError('User not found', ErrorCode.RESOURCE_NOT_FOUND);
 * const response = createErrorResponse(error, 404);
 * res.status(404).json(response);
 * ```
 */

export interface StandardError {
  error: string;
  code: number;
  message?: string;
  details?: Record<string, unknown>;
}

export enum ErrorCode {
  // Authentication errors (1000-1099)
  AUTH_REQUIRED = 1001,
  AUTH_INVALID_TOKEN = 1002,
  AUTH_TOKEN_EXPIRED = 1003,
  AUTH_INVALID_CREDENTIALS = 1004,
  AUTH_INSUFFICIENT_PERMISSIONS = 1005,

  // Validation errors (1100-1199)
  VALIDATION_FAILED = 1101,
  VALIDATION_INVALID_EMAIL = 1102,
  VALIDATION_INVALID_PASSWORD = 1103,
  VALIDATION_MISSING_FIELD = 1104,
  VALIDATION_INVALID_FORMAT = 1105,

  // Resource errors (1200-1299)
  RESOURCE_NOT_FOUND = 1201,
  RESOURCE_ALREADY_EXISTS = 1202,
  RESOURCE_CONFLICT = 1203,
  RESOURCE_DELETED = 1204,

  // Server errors (1300-1399)
  SERVER_ERROR = 1301,
  SERVER_UNAVAILABLE = 1302,
  SERVER_TIMEOUT = 1303,
  DATABASE_ERROR = 1304,

  // Rate limiting (1400-1499)
  RATE_LIMIT_EXCEEDED = 1401,

  // Network errors (1500-1599)
  NETWORK_ERROR = 1501,
  NETWORK_TIMEOUT = 1502,
  NETWORK_CONNECTION_FAILED = 1503,

  // Business logic errors (1600-1699)
  BUSINESS_RULE_VIOLATION = 1601,
  OPERATION_NOT_ALLOWED = 1602,
  INSUFFICIENT_BALANCE = 1603,
}

/**
 * Creates a standardized error object
 * @param error - Error message or Error object
 * @param code - Error code from ErrorCode enum
 * @param details - Additional error details
 * @returns StandardError object
 */
export function createError(
  error: string | Error,
  code: ErrorCode,
  details?: Record<string, unknown>
): StandardError {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return {
    error: errorMessage,
    code,
    message: errorMessage,
    details,
  };
}

/**
 * Creates an HTTP error response
 * @param error - StandardError object
 * @param statusCode - HTTP status code (default: 500)
 * @returns Formatted error response
 */
export function createErrorResponse(
  error: StandardError,
  statusCode: number = 500
): { success: false; error: string; code: number; message?: string; details?: Record<string, unknown> } {
  return {
    success: false,
    error: error.error,
    code: error.code,
    message: error.message,
    details: error.details,
  };
}

/**
 * Maps ErrorCode to HTTP status code
 * @param code - ErrorCode
 * @returns HTTP status code
 */
export function getHttpStatusFromErrorCode(code: ErrorCode): number {
  switch (code) {
    // Authentication errors
    case ErrorCode.AUTH_REQUIRED:
    case ErrorCode.AUTH_INVALID_TOKEN:
    case ErrorCode.AUTH_TOKEN_EXPIRED:
    case ErrorCode.AUTH_INVALID_CREDENTIALS:
      return 401;
    case ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS:
      return 403;

    // Validation errors
    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.VALIDATION_INVALID_EMAIL:
    case ErrorCode.VALIDATION_INVALID_PASSWORD:
    case ErrorCode.VALIDATION_MISSING_FIELD:
    case ErrorCode.VALIDATION_INVALID_FORMAT:
      return 400;

    // Resource errors
    case ErrorCode.RESOURCE_NOT_FOUND:
    case ErrorCode.RESOURCE_DELETED:
      return 404;
    case ErrorCode.RESOURCE_ALREADY_EXISTS:
    case ErrorCode.RESOURCE_CONFLICT:
      return 409;

    // Rate limiting
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return 429;

    // Server errors
    case ErrorCode.SERVER_ERROR:
    case ErrorCode.DATABASE_ERROR:
      return 500;
    case ErrorCode.SERVER_UNAVAILABLE:
      return 503;
    case ErrorCode.SERVER_TIMEOUT:
      return 504;

    // Network errors
    case ErrorCode.NETWORK_ERROR:
    case ErrorCode.NETWORK_TIMEOUT:
    case ErrorCode.NETWORK_CONNECTION_FAILED:
      return 0; // Network errors don't have HTTP status

    // Business logic errors
    case ErrorCode.BUSINESS_RULE_VIOLATION:
    case ErrorCode.OPERATION_NOT_ALLOWED:
      return 400;
    case ErrorCode.INSUFFICIENT_BALANCE:
      return 402;

    default:
      return 500;
  }
}

/**
 * Formats error for user display
 * @param error - StandardError object
 * @returns User-friendly error message
 */
export function formatErrorForUser(error: StandardError): string {
  // Map error codes to user-friendly messages
  switch (error.code) {
    case ErrorCode.AUTH_REQUIRED:
    case ErrorCode.AUTH_INVALID_TOKEN:
    case ErrorCode.AUTH_TOKEN_EXPIRED:
      return 'Your session has expired. Please log in again.';
    case ErrorCode.AUTH_INVALID_CREDENTIALS:
      return 'Invalid email or password. Please try again.';
    case ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS:
      return 'You do not have permission to perform this action.';
    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.VALIDATION_INVALID_EMAIL:
      return 'Please enter a valid email address.';
    case ErrorCode.VALIDATION_INVALID_PASSWORD:
      return 'Password does not meet requirements.';
    case ErrorCode.VALIDATION_MISSING_FIELD:
      return 'Please fill in all required fields.';
    case ErrorCode.RESOURCE_NOT_FOUND:
      return 'The requested resource was not found.';
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return 'Too many requests. Please try again later.';
    case ErrorCode.NETWORK_ERROR:
    case ErrorCode.NETWORK_CONNECTION_FAILED:
      return 'Unable to connect to the server. Please check your internet connection.';
    case ErrorCode.SERVER_ERROR:
    case ErrorCode.SERVER_UNAVAILABLE:
      return 'The server is temporarily unavailable. Please try again later.';
    default:
      return error.message || error.error || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Checks if error is a network error
 * @param error - Error to check
 * @returns true if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Network request failed') ||
      error.message.includes('ERR_NETWORK')
    );
  }
  return false;
}

/**
 * Checks if error is a timeout error
 * @param error - Error to check
 * @returns true if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('timeout') ||
      error.message.includes('TIMEOUT') ||
      error.name === 'TimeoutError'
    );
  }
  return false;
}


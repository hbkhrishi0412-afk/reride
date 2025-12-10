/**
 * Connection Error Handler
 * Provides user-friendly error messages for MongoDB connection issues
 */

export interface ConnectionError {
  type: 'config' | 'network' | 'auth' | 'timeout' | 'unknown';
  message: string;
  userMessage: string;
  canRetry: boolean;
}

/**
 * Analyzes error and provides user-friendly information
 */
export function analyzeConnectionError(error: unknown): ConnectionError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Configuration errors
  if (
    lowerMessage.includes('mongodb_url') ||
    lowerMessage.includes('mongodb_uri') ||
    lowerMessage.includes('not configured') ||
    lowerMessage.includes('not defined') ||
    lowerMessage.includes('environment variable')
  ) {
    return {
      type: 'config',
      message: errorMessage,
      userMessage: 'Database configuration error. Please contact support if this persists.',
      canRetry: false
    };
  }

  // Authentication errors
  if (
    lowerMessage.includes('authentication failed') ||
    lowerMessage.includes('auth failed') ||
    lowerMessage.includes('invalid credentials') ||
    lowerMessage.includes('username') ||
    lowerMessage.includes('password')
  ) {
    return {
      type: 'auth',
      message: errorMessage,
      userMessage: 'Database authentication failed. Please try again later.',
      canRetry: true
    };
  }

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('dns') ||
    lowerMessage.includes('connection refused')
  ) {
    return {
      type: 'network',
      message: errorMessage,
      userMessage: 'Network connection issue. Please check your internet connection and try again.',
      canRetry: true
    };
  }

  // Timeout errors
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('server selection timeout')
  ) {
    return {
      type: 'timeout',
      message: errorMessage,
      userMessage: 'Connection timeout. The server is taking longer than expected. Please try again.',
      canRetry: true
    };
  }

  // Unknown errors
  return {
    type: 'unknown',
    message: errorMessage,
    userMessage: 'Database connection error. Please try again later.',
    canRetry: true
  };
}

/**
 * Checks if an HTTP response indicates a database connection error
 */
export function isDatabaseErrorResponse(response: Response): boolean {
  if (response.status === 503) {
    return true;
  }

  // Check response headers
  const fallbackHeader = response.headers.get('X-Database-Fallback');
  if (fallbackHeader === 'true') {
    return true;
  }

  return false;
}

/**
 * Extracts error message from API response
 */
export async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data.reason) {
      return data.reason;
    }
    if (data.error) {
      return data.error;
    }
    if (data.message) {
      return data.message;
    }
  } catch {
    // If JSON parsing fails, use status text
  }

  return response.statusText || 'Unknown error';
}

/**
 * Gets user-friendly error message for display
 */
export async function getUserFriendlyError(response: Response, error?: unknown): Promise<string> {
  // Check if it's a database error
  if (isDatabaseErrorResponse(response)) {
    const errorText = await extractErrorMessage(response);
    const analyzed = analyzeConnectionError(new Error(errorText));
    return analyzed.userMessage;
  }

  // Handle other errors
  if (error) {
    const analyzed = analyzeConnectionError(error);
    return analyzed.userMessage;
  }

  // Default message
  if (response.status === 503) {
    return 'Service temporarily unavailable. Please try again in a moment.';
  }

  if (response.status >= 500) {
    return 'Server error. Please try again later.';
  }

  return 'An error occurred. Please try again.';
}


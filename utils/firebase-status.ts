/**
 * Firebase Database Connection Status Utilities
 * Provides utilities to check and report Firebase database connection status
 */

import { isDatabaseAvailable, getDatabaseStatus } from '../lib/firebase-db';

export interface FirebaseStatus {
  available: boolean;
  error?: string;
  details?: string;
  timestamp: number;
}

let cachedStatus: FirebaseStatus | null = null;
let statusCheckTime = 0;
const STATUS_CACHE_DURATION = 30000; // Cache status for 30 seconds

/**
 * Get Firebase database connection status
 * Caches the result for 30 seconds to avoid excessive checks
 */
export function getFirebaseStatus(): FirebaseStatus {
  const now = Date.now();
  
  // Return cached status if still valid
  if (cachedStatus && (now - statusCheckTime) < STATUS_CACHE_DURATION) {
    return cachedStatus;
  }
  
  // Check availability - wrap in try-catch to prevent crashes
  let status;
  try {
    status = getDatabaseStatus();
  } catch (error) {
    // If getDatabaseStatus throws, return a safe error status
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cachedStatus = {
      available: false,
      error: `Database status check failed: ${errorMessage}`,
      details: errorMessage,
      timestamp: now,
    };
    statusCheckTime = now;
    return cachedStatus;
  }
  
  cachedStatus = {
    ...status,
    timestamp: now,
  };
  
  statusCheckTime = now;
  return cachedStatus;
}

/**
 * Check if Firebase is available (simple boolean check)
 */
export function isFirebaseAvailable(): boolean {
  return isDatabaseAvailable();
}

/**
 * Clear cached status (useful for testing or after configuration changes)
 */
export function clearStatusCache(): void {
  cachedStatus = null;
  statusCheckTime = 0;
}

/**
 * Get user-friendly error message for Firebase connection issues
 * Safely handles null/undefined status objects
 */
export function getFirebaseErrorMessage(status: FirebaseStatus | null | undefined): string {
  // Handle null/undefined status
  if (!status) {
    return 'Firebase database is not available. Please check your configuration.';
  }
  
  if (status.available) {
    return '';
  }
  
  // Safely check error string
  const errorMessage = status.error || '';
  
  if (errorMessage.includes('configuration is missing')) {
    return 'Firebase configuration is missing. Please check your environment variables.';
  }
  
  if (errorMessage.includes('DATABASE_URL')) {
    return 'Firebase Database URL is not configured. Please set FIREBASE_DATABASE_URL.';
  }
  
  if (errorMessage.includes('PERMISSION_DENIED')) {
    return 'Permission denied. Please check Firebase security rules.';
  }
  
  return errorMessage || 'Firebase database is not available. Please check your configuration.';
}







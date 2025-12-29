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
  
  // Check availability
  const status = getDatabaseStatus();
  
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
 */
export function getFirebaseErrorMessage(status: FirebaseStatus): string {
  if (status.available) {
    return '';
  }
  
  if (status.error?.includes('configuration is missing')) {
    return 'Firebase configuration is missing. Please check your environment variables.';
  }
  
  if (status.error?.includes('DATABASE_URL')) {
    return 'Firebase Database URL is not configured. Please set FIREBASE_DATABASE_URL.';
  }
  
  if (status.error?.includes('PERMISSION_DENIED')) {
    return 'Permission denied. Please check Firebase security rules.';
  }
  
  return status.error || 'Firebase database is not available. Please check your configuration.';
}






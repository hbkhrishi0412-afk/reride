/**
 * Safe storage utilities that work in both client and server environments
 * Prevents "localStorage is not defined" errors in serverless environments
 */

/**
 * Safely get item from localStorage (client-side only)
 */
export const safeGetItem = (key: string): string | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Failed to get item from localStorage: ${key}`, error);
    }
    return null;
  }
};

/**
 * Safely set item in localStorage (client-side only)
 */
export const safeSetItem = (key: string, value: string): boolean => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Failed to set item in localStorage: ${key}`, error);
    }
    return false;
  }
};

/**
 * Safely remove item from localStorage (client-side only)
 */
export const safeRemoveItem = (key: string): boolean => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Failed to remove item from localStorage: ${key}`, error);
    }
    return false;
  }
};

/**
 * Check if localStorage is available
 */
export const isStorageAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};









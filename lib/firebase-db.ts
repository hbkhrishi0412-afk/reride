import { getDatabase, ref, get, set, push, update, remove, query, orderByChild, equalTo, startAt, endAt, Database, DatabaseReference } from 'firebase/database';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

// Initialize Firebase Realtime Database
let database: Database | undefined;
let firebaseApp: FirebaseApp | undefined;

// Cache for availability check to avoid repeated initialization attempts
let availabilityCache: { available: boolean; timestamp: number } | null = null;
const AVAILABILITY_CACHE_DURATION = 5000; // Cache for 5 seconds

// Get or initialize Firebase app (works on both client and server)
function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    try {
      // Check if app already exists
      const existingApps = getApps();
      if (existingApps.length > 0) {
        firebaseApp = existingApps[0];
      } else {
        // Initialize for server-side use
        // CRITICAL: For server-side (API routes, serverless), prioritize FIREBASE_* (without VITE_ prefix)
        // VITE_ prefixed variables are only available in client-side builds and may not be present in serverless environments
        // On client-side, MUST use direct import.meta.env access (same as firebase.ts) for Vite to embed variables
        const isServerSide = typeof window === 'undefined';
        
        // CRITICAL FIX: On client-side, use DIRECT static access to import.meta.env (same as firebase.ts)
        // This is required for Vite to statically analyze and embed the variables at build time
        // DO NOT use dynamic access or process.env fallback on client-side
        const firebaseConfig = isServerSide ? {
          // Server-side: Use process.env (can use both FIREBASE_* and VITE_FIREBASE_*)
          apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '',
          authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '',
          databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || '',
        } : {
          // Client-side: MUST use direct static import.meta.env access (Vite requirement)
          // This matches the approach in lib/firebase.ts
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
          databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
        };

        // Validate required fields
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
          const missingFields: string[] = [];
          if (!firebaseConfig.apiKey) missingFields.push(isServerSide ? 'FIREBASE_API_KEY' : 'VITE_FIREBASE_API_KEY');
          if (!firebaseConfig.projectId) missingFields.push(isServerSide ? 'FIREBASE_PROJECT_ID' : 'VITE_FIREBASE_PROJECT_ID');
          
          const envHint = isServerSide 
            ? 'Set FIREBASE_API_KEY, FIREBASE_PROJECT_ID, etc. in your server environment variables (Vercel, etc.)'
            : 'Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc. in your .env.local file';
          
          throw new Error(
            `Firebase configuration is missing required fields: ${missingFields.join(', ')}. ${envHint}`
          );
        }

        firebaseApp = initializeApp(firebaseConfig);
      }
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      throw new Error(`Firebase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return firebaseApp;
}

// Get database instance
export function getFirebaseDatabase(): Database {
  if (!database) {
    try {
      const app = getFirebaseApp();
      const isServerSide = typeof window === 'undefined';
      
      // Get database URL with proper priority
      // CRITICAL: On client-side, MUST use direct static import.meta.env access (same as firebase.ts)
      // On server-side, we can use process.env for both FIREBASE_* and VITE_FIREBASE_*
      const databaseURL = isServerSide
        ? (process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL)
        : (import.meta.env.VITE_FIREBASE_DATABASE_URL || '');
      
      // For client-side, also try to get from firebaseConfig if available (from lib/firebase.ts)
      // This is a fallback if VITE_FIREBASE_DATABASE_URL wasn't set but firebaseConfig has it
      if (!databaseURL && !isServerSide && typeof window !== 'undefined') {
        try {
          // Try to get from the initialized app's options
          const appOptions = app.options;
          if (appOptions && appOptions.databaseURL) {
            // Use the databaseURL from the app config as fallback
            const fallbackURL = appOptions.databaseURL;
            if (fallbackURL && fallbackURL.includes('firebasedatabase')) {
              console.log('📊 Using databaseURL from Firebase app config');
              database = getDatabase(app, fallbackURL);
              return database;
            }
          }
        } catch (e) {
          // Silently fail - we'll use default below
        }
      }
      
      // For server-side operations, database URL should be provided for reliability
      // Client-side can use default from firebaseConfig, but server-side should be explicit
      if (databaseURL && databaseURL.trim() !== '') {
        // Validate URL format
        if (!databaseURL.startsWith('https://') || !databaseURL.includes('firebasedatabase')) {
          console.warn('⚠️ FIREBASE_DATABASE_URL format may be incorrect. Expected format: https://your-project-default-rtdb.region.firebasedatabase.app/');
        }
        database = getDatabase(app, databaseURL);
      } else {
        if (isServerSide) {
          // Server-side: Warn but allow default (for backward compatibility)
          // In production, this should be set explicitly
          console.warn(
            '⚠️ FIREBASE_DATABASE_URL not set for server-side. Using default database URL. ' +
            'This may cause issues in serverless environments. ' +
            'Please set FIREBASE_DATABASE_URL in your environment variables.'
          );
        } else {
          // Client-side: This is a critical error - database URL should be set
          const isProd = typeof window !== 'undefined' && 
            (window.location.hostname.includes('vercel.app') || 
             window.location.hostname.includes('reride.co.in'));
          
          if (isProd) {
            console.error(
              '❌ VITE_FIREBASE_DATABASE_URL is not set in production. ' +
              'Please set VITE_FIREBASE_DATABASE_URL in Vercel environment variables and redeploy. ' +
              'The database will not work without this variable.'
            );
          } else {
            console.warn(
              '⚠️ VITE_FIREBASE_DATABASE_URL is not set. ' +
              'Please add VITE_FIREBASE_DATABASE_URL to your .env.local file. ' +
              'Using default database URL as fallback.'
            );
          }
        }
        // Use default database URL (from firebaseConfig if available)
        database = getDatabase(app);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Firebase database initialization error:', errorMessage);
      throw new Error(`Firebase database initialization failed: ${errorMessage}`);
    }
  }
  return database;
}

// Database paths
export const DB_PATHS = {
  USERS: 'users',
  VEHICLES: 'vehicles',
  CONVERSATIONS: 'conversations',
  NOTIFICATIONS: 'notifications',
  VEHICLE_DATA: 'vehicleData',
  NEW_CARS: 'newCars',
  PLANS: 'plans',
  RATE_LIMITS: 'rateLimits',
} as const;

// Helper to get a reference to a path
export function getRef(path: string): DatabaseReference {
  const db = getFirebaseDatabase();
  return ref(db, path);
}

// Helper to get a reference with a key
export function getRefWithKey(collection: string, key: string): DatabaseReference {
  return getRef(`${collection}/${key}`);
}

// Generic CRUD operations
export async function create<T extends Record<string, unknown>>(
  collection: string,
  data: T,
  key?: string
): Promise<string> {
  try {
    const db = getFirebaseDatabase();
    let refPath: DatabaseReference;
    
    if (key) {
      refPath = ref(db, `${collection}/${key}`);
      await set(refPath, {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return key;
    } else {
      refPath = ref(db, collection);
      const newRef = push(refPath);
      await set(newRef, {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return newRef.key!;
    }
  } catch (error) {
    console.error(`❌ Firebase create error at ${collection}/${key || 'auto'}:`, error);
    throw error; // Re-throw to be handled by caller
  }
}

export async function read<T>(collection: string, key?: string): Promise<T | null> {
  try {
    const db = getFirebaseDatabase();
    const refPath = key ? ref(db, `${collection}/${key}`) : ref(db, collection);
    const snapshot = await get(refPath);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    if (key) {
      // CRITICAL: Spread data first, then set id to preserve string ID from key
      return { ...snapshot.val(), id: key } as T;
    }
    
    return snapshot.val() as T;
  } catch (error) {
    console.error(`❌ Firebase read error at ${collection}/${key || ''}:`, error);
    throw error; // Re-throw to be handled by caller
  }
}

export async function readAll<T>(collection: string, throwOnError = false): Promise<Record<string, T>> {
  try {
    const db = getFirebaseDatabase();
    const refPath = ref(db, collection);
    const snapshot = await get(refPath);
    
    if (!snapshot.exists()) {
      // This is not an error - collection simply has no data
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        console.log(`📊 Firebase readAll: No data found at path "${collection}"`);
      }
      return {};
    }
    
    const data = snapshot.val() as Record<string, T>;
    const count = Object.keys(data).length;
    const dataSize = JSON.stringify(data).length;
    
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.log(`📊 Firebase readAll: Retrieved ${count} items from "${collection}" (${(dataSize / 1024).toFixed(2)} KB)`);
      
      // Log sample keys for debugging (first 5 keys)
      const sampleKeys = Object.keys(data).slice(0, 5);
      if (sampleKeys.length > 0) {
        console.log(`📊 Sample keys: ${sampleKeys.join(', ')}${count > 5 ? '...' : ''}`);
      }
    }
    
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's a permission error (security rules) vs connection error
    const isPermissionError = errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission');
    
    if (isPermissionError) {
      // Permission errors are expected in serverless contexts without Admin SDK
      // Log as warning instead of error to reduce noise
      console.warn(`⚠️ Firebase readAll permission denied for "${collection}". This is expected in serverless contexts.`);
      console.warn(`💡 To fix: Use Firebase Admin SDK or update security rules for server-side access.`);
    } else {
      // Log actual errors (connection issues, etc.)
      console.error(`❌ Firebase readAll error for "${collection}":`, errorMessage);
    }
    
    if (throwOnError) {
      throw error;
    }
    
    // Return empty object to prevent cascading failures, but log the error
    // Callers should check for empty results and handle appropriately
    return {};
  }
}

export async function updateData<T extends Record<string, unknown>>(
  collection: string,
  key: string,
  updates: Partial<T>
): Promise<void> {
  try {
    const db = getFirebaseDatabase();
    const refPath = ref(db, `${collection}/${key}`);
    
    await update(refPath, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ Firebase updateData error at ${collection}/${key}:`, error);
    throw error; // Re-throw to be handled by caller
  }
}

export async function deleteData(collection: string, key: string): Promise<void> {
  try {
    const db = getFirebaseDatabase();
    const refPath = ref(db, `${collection}/${key}`);
    await remove(refPath);
  } catch (error) {
    console.error(`❌ Firebase deleteData error at ${collection}/${key}:`, error);
    throw error; // Re-throw to be handled by caller
  }
}

// Query operations
export async function queryByField<T>(
  collection: string,
  field: string,
  value: string | number | boolean,
  throwOnError = false
): Promise<Record<string, T>> {
  try {
    const db = getFirebaseDatabase();
    const refPath = ref(db, collection);
    const q = query(refPath, orderByChild(field), equalTo(value));
    const snapshot = await get(q);
    
    if (!snapshot.exists()) {
      // No results found - this is normal, not an error
      return {};
    }
    
    return snapshot.val() as Record<string, T>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase queryByField error at ${collection} (${field}=${value}):`, errorMessage);
    
    // Check if it's a permission error vs other error
    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
      console.error(`💡 Permission denied. Check Firebase security rules for path: "${collection}"`);
    } else if (errorMessage.includes('index')) {
      console.error(`💡 Index error. You may need to create an index in Firebase Console for: "${collection}/${field}"`);
    }
    
    if (throwOnError) {
      throw error;
    }
    
    // Return empty object to prevent cascading failures
    return {};
  }
}

export async function queryByRange<T>(
  collection: string,
  field: string,
  startValue: string | number,
  endValue: string | number,
  throwOnError = false
): Promise<Record<string, T>> {
  try {
    const db = getFirebaseDatabase();
    const refPath = ref(db, collection);
    const q = query(refPath, orderByChild(field), startAt(startValue), endAt(endValue));
    const snapshot = await get(q);
    
    if (!snapshot.exists()) {
      // No results found - this is normal, not an error
      return {};
    }
    
    return snapshot.val() as Record<string, T>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase queryByRange error at ${collection} (${field}=${startValue}-${endValue}):`, errorMessage);
    
    // Check if it's a permission error vs other error
    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
      console.error(`💡 Permission denied. Check Firebase security rules for path: "${collection}"`);
    } else if (errorMessage.includes('index')) {
      console.error(`💡 Index error. You may need to create an index in Firebase Console for: "${collection}/${field}"`);
    }
    
    if (throwOnError) {
      throw error;
    }
    
    // Return empty object to prevent cascading failures
    return {};
  }
}

// Helper to convert Firebase snapshot to array
// CRITICAL: Spread data first, then set id to preserve string ID from key
export function snapshotToArray<T>(snapshot: Record<string, T>): Array<T & { id: string }> {
  return Object.entries(snapshot).map(([id, data]) => ({
    ...data,
    id,
  }));
}

// Helper to find one by field
export async function findOneByField<T>(
  collection: string,
  field: string,
  value: string | number | boolean
): Promise<(T & { id: string }) | null> {
  const results = await queryByField<T>(collection, field, value);
  const entries = Object.entries(results);
  
  if (entries.length === 0) {
    return null;
  }
  
  const [id, data] = entries[0];
  // CRITICAL: Spread data first, then set id to preserve string ID from key
  return { ...data, id } as T & { id: string };
}

// Helper function to safely get and validate environment variable value
// Handles edge cases like empty strings, "undefined" strings, etc.
function getEnvVarValue(env: any, key: string): string | undefined {
  if (!env) return undefined;
  const value = env[key];
  // Check if value exists and is a valid non-empty string
  if (value && typeof value === 'string' && value.trim() !== '' && value !== 'undefined' && value !== 'null') {
    return value;
  }
  return undefined;
}

// Helper to check if database is available
// Uses caching to avoid repeated expensive initialization checks
export function isDatabaseAvailable(): boolean {
  // Return cached result if still valid (performance optimization)
  const now = Date.now();
  if (availabilityCache && (now - availabilityCache.timestamp) < AVAILABILITY_CACHE_DURATION) {
    return availabilityCache.available;
  }
  
  try {
    // First check if required environment variables exist (without initializing)
    // This prevents crashes during module load if config is missing
    const isServerSide = typeof window === 'undefined';
    // On client-side, use import.meta.env (Vite's way), on server-side use process.env
    const clientEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
    
    // CRITICAL FIX: Use helper function to properly validate environment variables
    // This handles edge cases like empty strings, "undefined" strings, etc.
    const hasApiKey = isServerSide 
      ? (getEnvVarValue(process.env, 'FIREBASE_API_KEY') || getEnvVarValue(process.env, 'VITE_FIREBASE_API_KEY'))
      : getEnvVarValue(clientEnv, 'VITE_FIREBASE_API_KEY');
    const hasProjectId = isServerSide
      ? (getEnvVarValue(process.env, 'FIREBASE_PROJECT_ID') || getEnvVarValue(process.env, 'VITE_FIREBASE_PROJECT_ID'))
      : getEnvVarValue(clientEnv, 'VITE_FIREBASE_PROJECT_ID');
    // Also check for database URL on client-side (critical for Realtime Database)
    const hasDatabaseURL = isServerSide
      ? (getEnvVarValue(process.env, 'FIREBASE_DATABASE_URL') || getEnvVarValue(process.env, 'VITE_FIREBASE_DATABASE_URL'))
      : getEnvVarValue(clientEnv, 'VITE_FIREBASE_DATABASE_URL');
    
    // If basic config is missing, cache and return false without trying to initialize
    if (!hasApiKey || !hasProjectId) {
      const isProd = !isServerSide && typeof window !== 'undefined' && 
        (window.location.hostname.includes('vercel.app') || 
         window.location.hostname.includes('reride.co.in'));
      const isDev = process.env.NODE_ENV === 'development' || 
                    process.env.VERCEL_ENV === 'development' || 
                    process.env.NODE_ENV !== 'production';
      
      // Always log in production to help debug (but don't expose to users in UI)
      if (isProd || isDev) {
        console.warn('⚠️ Firebase database not available: Missing required environment variables.');
        console.warn('💡 Make sure Firebase environment variables are set correctly.');
        if (isServerSide) {
          console.warn('   Server-side: FIREBASE_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, etc.');
        } else {
          console.warn('   Client-side: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_DATABASE_URL, etc.');
          // Debug info for production
          if (isProd) {
            console.warn('🔍 Debug: Available env vars:', clientEnv ? Object.keys(clientEnv).filter(k => k.startsWith('VITE_FIREBASE')).join(', ') : 'none');
            console.warn('🔍 Debug: API Key present:', !!getEnvVarValue(clientEnv, 'VITE_FIREBASE_API_KEY'));
            console.warn('🔍 Debug: Project ID present:', !!getEnvVarValue(clientEnv, 'VITE_FIREBASE_PROJECT_ID'));
            console.warn('🔍 Debug: Database URL present:', !!getEnvVarValue(clientEnv, 'VITE_FIREBASE_DATABASE_URL'));
          }
        }
      }
      availabilityCache = { available: false, timestamp: now };
      return false;
    }
    
    // On client-side, also check for database URL (critical for Realtime Database)
    if (!isServerSide && !hasDatabaseURL) {
      const isProd = typeof window !== 'undefined' && 
        (window.location.hostname.includes('vercel.app') || 
         window.location.hostname.includes('reride.co.in'));
      
      if (isProd) {
        console.error('❌ VITE_FIREBASE_DATABASE_URL is missing in production. Database will not work.');
        console.error('💡 Set VITE_FIREBASE_DATABASE_URL in Vercel environment variables and redeploy.');
        console.error('💡 CRITICAL: After setting variables in Vercel, you MUST trigger a new deployment!');
      } else {
        console.warn('⚠️ VITE_FIREBASE_DATABASE_URL is missing. Database may not work correctly.');
        console.warn('💡 Add VITE_FIREBASE_DATABASE_URL to your .env.local file.');
      }
      // Don't return false here - allow it to try with default URL, but log the warning
    }
    
    // Only try to get database if config exists and it's not already initialized
    // Check if already initialized first (performance optimization)
    if (database) {
      availabilityCache = { available: true, timestamp: now };
      return true;
    }
    
    // Try to initialize (this can still throw, but we catch it below)
    const db = getFirebaseDatabase();
    const available = !!db;
    availabilityCache = { available, timestamp: now };
    return available;
  } catch (error) {
    // Never throw - always return false to prevent function crashes
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isServerSide = typeof window === 'undefined';
    
    // Always log errors in development/debug environments and production
    const isProd = !isServerSide && typeof window !== 'undefined' && 
      (window.location.hostname.includes('vercel.app') || 
       window.location.hostname.includes('reride.co.in'));
    const isDev = process.env.NODE_ENV === 'development' || 
                  process.env.VERCEL_ENV === 'development' || 
                  process.env.NODE_ENV !== 'production';
    
    if (isDev || isProd) {
      console.warn('⚠️ Firebase database not available:', errorMessage);
      console.warn('💡 Make sure Firebase environment variables are set correctly.');
      if (isServerSide) {
        console.warn('   Server-side: FIREBASE_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, etc.');
      } else {
        console.warn('   Client-side: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc.');
      }
    } else {
      // In other environments, log to console but don't expose details to users
      console.error('❌ Firebase database unavailable. Check configuration.');
    }
    
    // Cache the failure to avoid repeated attempts
    availabilityCache = { available: false, timestamp: now };
    
    // CRITICAL: Always return false, never throw
    return false;
  }
}

// Helper to get database connection status with details
// CRITICAL: This function must NEVER throw - always return a status object
export function getDatabaseStatus(): {
  available: boolean;
  error?: string;
  details?: string;
} {
  try {
    // Check if database is available without throwing
    const isAvailable = isDatabaseAvailable();
    if (!isAvailable) {
      // Return unavailable status without throwing
      const isServerSide = typeof window === 'undefined';
      // Check if variables might be set but not embedded (common issue)
      const isClientSide = !isServerSide;
      const isProd = isClientSide && typeof window !== 'undefined' && 
        (window.location.hostname.includes('vercel.app') || 
         window.location.hostname.includes('reride.co.in'));
      
      let details = '';
      if (isClientSide && isProd) {
        details = 'Please check VITE_FIREBASE_* environment variables (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_DATABASE_URL). CRITICAL: VITE_FIREBASE_DATABASE_URL must be set for Realtime Database to work. ⚠️ IMPORTANT: If you just set these variables in Vercel, you MUST trigger a new deployment (Vercel Dashboard → Deployments → Redeploy) because Vite embeds environment variables at build time.';
      } else if (isServerSide) {
        details = 'Please check FIREBASE_* environment variables (FIREBASE_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL). If you just set these in Vercel, trigger a new deployment.';
      } else {
        details = 'Please check VITE_FIREBASE_* environment variables (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_DATABASE_URL). CRITICAL: VITE_FIREBASE_DATABASE_URL must be set for Realtime Database to work.';
      }
      
      return {
        available: false,
        error: 'Firebase database is not available',
        details
      };
    }
    
    // Try to get database instance (this might still throw, so we catch it)
    try {
      const db = getFirebaseDatabase();
      return { available: !!db };
    } catch (dbError) {
      // If getFirebaseDatabase throws, return error status
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      const isServerSide = typeof window === 'undefined';
      
      let details = '';
      if (errorMessage.includes('configuration is missing')) {
        details = isServerSide
          ? 'Please set FIREBASE_* environment variables (FIREBASE_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, etc.)'
          : 'Please set VITE_FIREBASE_* environment variables in .env.local (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_DATABASE_URL, etc.)';
      } else if (errorMessage.includes('DATABASE_URL')) {
        details = isServerSide
          ? 'Please set FIREBASE_DATABASE_URL environment variable'
          : 'Please set VITE_FIREBASE_DATABASE_URL environment variable (CRITICAL for client-side Realtime Database)';
      }
      
      return {
        available: false,
        error: errorMessage,
        details,
      };
    }
  } catch (outerError) {
    // Final safety catch - if anything else throws, return safe error status
    const errorMessage = outerError instanceof Error ? outerError.message : String(outerError);
    return {
      available: false,
      error: `Database status check failed: ${errorMessage}`,
      details: 'An unexpected error occurred while checking database status'
    };
  }
}


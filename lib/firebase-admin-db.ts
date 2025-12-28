import admin from 'firebase-admin';
import { initializeFirebaseAdmin } from './firebase-admin.js';
import { DB_PATHS } from './firebase-db.js';

// Get Firebase Admin Database instance
function getFirebaseAdminDatabase(): admin.database.Database | null {
  // Check if databaseURL is set (required for database operations)
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  
  // Diagnostic logging to help debug environment variable issues
  if (!databaseURL) {
    console.error('❌ Firebase Admin DB: FIREBASE_DATABASE_URL environment variable is not set.');
    console.error('💡 Please set FIREBASE_DATABASE_URL in your environment variables (e.g., in Vercel dashboard).');
    console.error('   Format: https://your-project-default-rtdb.region.firebasedatabase.app');
    console.error('   Checked: process.env.FIREBASE_DATABASE_URL and process.env.VITE_FIREBASE_DATABASE_URL');
    return null;
  }
  
  console.log('📡 Firebase Admin DB: Using databaseURL:', databaseURL.substring(0, 60) + '...');
  
  const app = initializeFirebaseAdmin();
  if (!app) {
    console.error('❌ Firebase Admin DB: Failed to initialize Firebase Admin app');
    return null;
  }
  
  // Database URL should be set during app initialization in firebase-admin.ts
  // admin.database() will use the URL from the app configuration
  // If the app was initialized without the databaseURL, we need to pass it explicitly
  // However, admin.database() doesn't accept URL as parameter, so we must ensure
  // the app is initialized with the databaseURL (which our updated firebase-admin.ts does)
  try {
    const db = admin.database(app);
    console.log('✅ Firebase Admin DB: Database instance created successfully');
    return db;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Can't determine Firebase Database URL")) {
      console.error('❌ Firebase Admin DB: Database URL not configured in app initialization.');
      console.error('💡 The app was initialized without a databaseURL. This may happen if:');
      console.error('   1. The app was initialized in a previous deployment before FIREBASE_DATABASE_URL was added');
      console.error('   2. The serverless function instance was cached from a previous cold start');
      console.error('   3. The app was initialized elsewhere without the databaseURL');
      console.error('   Solution: Redeploy your application to ensure a fresh initialization with FIREBASE_DATABASE_URL.');
      console.error(`   Current FIREBASE_DATABASE_URL env value: ${databaseURL ? 'SET (' + databaseURL.substring(0, 50) + '...)' : 'NOT SET'}`);
      console.error('   This is a serverless caching issue - redeployment will fix it.');
    }
    throw error;
  }
}

// Helper to convert record to array
function snapshotToArray<T>(data: Record<string, T>): T[] {
  if (!data || typeof data !== 'object') {
    return [];
  }
  return Object.keys(data).map(key => ({ id: key, ...data[key] } as T));
}

// Admin SDK Database Operations (bypasses security rules)

export async function adminRead<T>(collection: string, key?: string): Promise<T | null> {
  try {
    const db = getFirebaseAdminDatabase();
    if (!db) {
      throw new Error('Firebase Admin Database not initialized');
    }
    
    const refPath = key ? db.ref(`${collection}/${key}`) : db.ref(collection);
    const snapshot = await refPath.once('value');
    
    if (!snapshot.exists()) {
      return null;
    }
    
    if (key) {
      return { id: key, ...snapshot.val() } as T;
    }
    
    return snapshot.val() as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin read error at ${collection}${key ? `/${key}` : ''}:`, errorMessage);
    throw error;
  }
}

export async function adminReadAll<T>(collection: string): Promise<Record<string, T>> {
  try {
    const db = getFirebaseAdminDatabase();
    if (!db) {
      throw new Error('Firebase Admin Database not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY or link Firebase project in Vercel.');
    }
    
    const refPath = db.ref(collection);
    const snapshot = await refPath.once('value');
    
    if (!snapshot.exists()) {
      return {};
    }
    
    const data = snapshot.val();
    return data as Record<string, T>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin readAll error for "${collection}":`, errorMessage);
    
    // If Admin SDK is not initialized, provide helpful error message
    if (errorMessage.includes('not initialized') || errorMessage.includes('credential')) {
      console.error('💡 To fix: Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel environment variables');
      console.error('   Or link Firebase project in Vercel (Settings → Integrations → Firebase)');
    }
    
    throw error;
  }
}

export async function adminCreate<T extends Record<string, unknown>>(
  collection: string,
  data: T,
  key?: string
): Promise<string> {
  try {
    const db = getFirebaseAdminDatabase();
    if (!db) {
      throw new Error('Firebase Admin Database not initialized');
    }
    
    if (key) {
      const refPath = db.ref(`${collection}/${key}`);
      await refPath.set(data);
      return key;
    } else {
      const refPath = db.ref(collection);
      const newRef = refPath.push();
      await newRef.set(data);
      return newRef.key || '';
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin create error at ${collection}:`, errorMessage);
    throw error;
  }
}

export async function adminUpdate<T extends Record<string, unknown>>(
  collection: string,
  key: string,
  updates: Partial<T>
): Promise<void> {
  try {
    const db = getFirebaseAdminDatabase();
    if (!db) {
      throw new Error('Firebase Admin Database not initialized');
    }
    
    const refPath = db.ref(`${collection}/${key}`);
    await refPath.update(updates);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin update error at ${collection}/${key}:`, errorMessage);
    throw error;
  }
}

export async function adminDelete(collection: string, key: string): Promise<void> {
  try {
    const db = getFirebaseAdminDatabase();
    if (!db) {
      throw new Error('Firebase Admin Database not initialized');
    }
    
    const refPath = db.ref(`${collection}/${key}`);
    await refPath.remove();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin delete error at ${collection}/${key}:`, errorMessage);
    throw error;
  }
}

export async function adminQueryByField<T>(
  collection: string,
  field: string,
  value: string | number | boolean | null
): Promise<Record<string, T>> {
  try {
    const db = getFirebaseAdminDatabase();
    if (!db) {
      throw new Error('Firebase Admin Database not initialized');
    }
    
    const refPath = db.ref(collection);
    const snapshot = await refPath.orderByChild(field).equalTo(value).once('value');
    
    if (!snapshot.exists()) {
      return {};
    }
    
    return snapshot.val() as Record<string, T>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin queryByField error for "${collection}" (${field}=${value}):`, errorMessage);
    throw error;
  }
}

export async function adminFindOneByField<T>(
  collection: string,
  field: string,
  value: string | number | boolean | null
): Promise<T | null> {
  try {
    const results = await adminQueryByField<T>(collection, field, value);
    const keys = Object.keys(results);
    if (keys.length === 0) {
      return null;
    }
    return { id: keys[0], ...results[keys[0]] } as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin findOneByField error for "${collection}" (${field}=${value}):`, errorMessage);
    return null;
  }
}

// Export helper functions
export { snapshotToArray, DB_PATHS };


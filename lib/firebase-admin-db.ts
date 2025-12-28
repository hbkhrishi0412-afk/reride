import admin from 'firebase-admin';
import { initializeFirebaseAdmin } from './firebase-admin.js';
import { DB_PATHS } from './firebase-db.js';

// Get Firebase Admin Database instance
function getFirebaseAdminDatabase(): admin.database.Database | null {
  const app = initializeFirebaseAdmin();
  if (!app) {
    return null;
  }
  
  // Get database URL from environment
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    console.warn('⚠️ Firebase Admin DB: FIREBASE_DATABASE_URL not set');
    return null;
  }
  
  return admin.database(app);
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


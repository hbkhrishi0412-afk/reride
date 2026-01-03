// SERVER-ONLY: Firebase Admin Database operations
// This file must NEVER be imported in frontend code

import admin from './firebase-admin.js';
import { DB_PATHS } from '../lib/firebase-db.js';

// Get Firebase Admin Database instance
function getFirebaseAdminDatabase(): admin.database.Database {
  // If we get here and Admin is not initialized, it should have thrown during module load
  // But double-check to fail fast
  if (!admin.apps.length) {
    throw new Error('Firebase Admin is not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
  }
  
  const app = admin.app();
  return admin.database(app);
}

// Helper to convert record to array
// CRITICAL: Spread data first, then set id to preserve string ID from key
function snapshotToArray<T>(data: Record<string, T>): T[] {
  if (!data || typeof data !== 'object') {
    return [];
  }
  return Object.keys(data).map(key => ({ ...data[key], id: key } as T));
}

// Admin SDK Database Operations (bypasses security rules)

export async function adminRead<T>(collection: string, key?: string): Promise<T | null> {
  const db = getFirebaseAdminDatabase();
  const refPath = key ? db.ref(`${collection}/${key}`) : db.ref(collection);
  const snapshot = await refPath.once('value');
  
  if (!snapshot.exists()) {
    return null;
  }
  
  if (key) {
    // CRITICAL: Spread data first, then set id to preserve string ID from key
    return { ...snapshot.val(), id: key } as T;
  }
  
  return snapshot.val() as T;
}

export async function adminReadAll<T>(collection: string): Promise<Record<string, T>> {
  const db = getFirebaseAdminDatabase();
  const refPath = db.ref(collection);
  const snapshot = await refPath.once('value');
  
  if (!snapshot.exists()) {
    return {};
  }
  
  return snapshot.val() as Record<string, T>;
}

export async function adminCreate<T extends Record<string, unknown>>(
  collection: string,
  data: T,
  key?: string
): Promise<string> {
  const db = getFirebaseAdminDatabase();
  
  // Add timestamps to match client SDK behavior
  // Preserve existing createdAt if provided (e.g., for seed data with intentional dates)
  // Use explicit undefined check to preserve falsy values like 0 or empty strings
  const dataWithTimestamps = {
    ...data,
    createdAt: data.createdAt !== undefined ? data.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  if (key) {
    const refPath = db.ref(`${collection}/${key}`);
    await refPath.set(dataWithTimestamps);
    return key;
  } else {
    const refPath = db.ref(collection);
    const newRef = refPath.push();
    await newRef.set(dataWithTimestamps);
    return newRef.key || '';
  }
}

export async function adminUpdate<T extends Record<string, unknown>>(
  collection: string,
  key: string,
  updates: Partial<T>
): Promise<void> {
  try {
    const db = getFirebaseAdminDatabase();
    const refPath = db.ref(`${collection}/${key}`);
    
    // Log the update operation for debugging
    console.log(`🔄 Firebase Admin Update: ${collection}/${key}`, {
      updateKeys: Object.keys(updates),
      databaseURL: db.app.options.databaseURL,
    });
    
    // Add updatedAt timestamp to match client SDK behavior
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    await refPath.update(updateData);
    
    console.log(`✅ Firebase Admin Update successful: ${collection}/${key}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin Update failed: ${collection}/${key}`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      updates: Object.keys(updates),
    });
    throw error; // Re-throw to ensure errors are not silently swallowed
  }
}

export async function adminDelete(collection: string, key: string): Promise<void> {
  try {
    const db = getFirebaseAdminDatabase();
    const refPath = db.ref(`${collection}/${key}`);
    
    console.log(`🗑️ Firebase Admin Delete: ${collection}/${key}`, {
      databaseURL: db.app.options.databaseURL,
    });
    
    await refPath.remove();
    
    console.log(`✅ Firebase Admin Delete successful: ${collection}/${key}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Firebase Admin Delete failed: ${collection}/${key}`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Re-throw to ensure errors are not silently swallowed
  }
}

export async function adminQueryByField<T>(
  collection: string,
  field: string,
  value: string | number | boolean | null
): Promise<Record<string, T>> {
  const db = getFirebaseAdminDatabase();
  const refPath = db.ref(collection);
  const snapshot = await refPath.orderByChild(field).equalTo(value).once('value');
  
  if (!snapshot.exists()) {
    return {};
  }
  
  return snapshot.val() as Record<string, T>;
}

export async function adminFindOneByField<T>(
  collection: string,
  field: string,
  value: string | number | boolean | null
): Promise<T | null> {
  const results = await adminQueryByField<T>(collection, field, value);
  const keys = Object.keys(results);
  if (keys.length === 0) {
    return null;
  }
  // CRITICAL: Spread data first, then set id to preserve string ID from key
  return { ...results[keys[0]], id: keys[0] } as T;
}

// Export helper functions
export { snapshotToArray, DB_PATHS };


import { getDatabase, ref, get, set, push, update, remove, query, orderByChild, equalTo, startAt, endAt, Database, DatabaseReference } from 'firebase/database';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

// Initialize Firebase Realtime Database
let database: Database | undefined;
let firebaseApp: FirebaseApp | undefined;

// Get or initialize Firebase app (works on both client and server)
function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    // Check if app already exists
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0];
    } else {
      // Initialize for server-side use
      // For server-side, prioritize FIREBASE_* (without VITE_ prefix) for better serverless compatibility
      // Fallback to VITE_FIREBASE_* for backward compatibility
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '',
        databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || '',
      };

      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        throw new Error('Firebase configuration is missing. Please set Firebase environment variables.');
      }

      firebaseApp = initializeApp(firebaseConfig);
    }
  }
  return firebaseApp;
}

// Get database instance
export function getFirebaseDatabase(): Database {
  if (!database) {
    const app = getFirebaseApp();
    const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
    
    if (databaseURL) {
      database = getDatabase(app, databaseURL);
    } else {
      // For server-side operations, database URL should be provided
      // But we allow fallback to default for backward compatibility
      if (typeof window === 'undefined') {
        console.warn('⚠️ FIREBASE_DATABASE_URL not set. Using default database URL. This may cause issues in serverless environments.');
      }
      database = getDatabase(app);
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
}

export async function read<T>(collection: string, key?: string): Promise<T | null> {
  const db = getFirebaseDatabase();
  const refPath = key ? ref(db, `${collection}/${key}`) : ref(db, collection);
  const snapshot = await get(refPath);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  if (key) {
    return { id: key, ...snapshot.val() } as T;
  }
  
  return snapshot.val() as T;
}

export async function readAll<T>(collection: string): Promise<Record<string, T>> {
  const db = getFirebaseDatabase();
  const refPath = ref(db, collection);
  const snapshot = await get(refPath);
  
  if (!snapshot.exists()) {
    return {};
  }
  
  return snapshot.val() as Record<string, T>;
}

export async function updateData<T extends Record<string, unknown>>(
  collection: string,
  key: string,
  updates: Partial<T>
): Promise<void> {
  const db = getFirebaseDatabase();
  const refPath = ref(db, `${collection}/${key}`);
  
  await update(refPath, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteData(collection: string, key: string): Promise<void> {
  const db = getFirebaseDatabase();
  const refPath = ref(db, `${collection}/${key}`);
  await remove(refPath);
}

// Query operations
export async function queryByField<T>(
  collection: string,
  field: string,
  value: string | number | boolean
): Promise<Record<string, T>> {
  const db = getFirebaseDatabase();
  const refPath = ref(db, collection);
  const q = query(refPath, orderByChild(field), equalTo(value));
  const snapshot = await get(q);
  
  if (!snapshot.exists()) {
    return {};
  }
  
  return snapshot.val() as Record<string, T>;
}

export async function queryByRange<T>(
  collection: string,
  field: string,
  startValue: string | number,
  endValue: string | number
): Promise<Record<string, T>> {
  const db = getFirebaseDatabase();
  const refPath = ref(db, collection);
  const q = query(refPath, orderByChild(field), startAt(startValue), endAt(endValue));
  const snapshot = await get(q);
  
  if (!snapshot.exists()) {
    return {};
  }
  
  return snapshot.val() as Record<string, T>;
}

// Helper to convert Firebase snapshot to array
export function snapshotToArray<T>(snapshot: Record<string, T>): Array<T & { id: string }> {
  return Object.entries(snapshot).map(([id, data]) => ({
    id,
    ...data,
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
  return { id, ...data } as T & { id: string };
}

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  try {
    const db = getFirebaseDatabase();
    return !!db;
  } catch (error) {
    // Log error in development, but fail silently in production
    if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development') {
      console.warn('⚠️ Firebase database not available:', error instanceof Error ? error.message : String(error));
    }
    return false;
  }
}


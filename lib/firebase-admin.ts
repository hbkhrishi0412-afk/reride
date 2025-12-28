import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let adminApp: admin.app.App | null = null;
let initializationAttempted = false;

export function initializeFirebaseAdmin(): admin.app.App | null {
  // Get database URL from environment (required for database operations)
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  
  // Return existing app if already initialized (but only if we have databaseURL configured)
  if (adminApp) {
    return adminApp;
  }

  // Check if Firebase Admin is already initialized
  // Note: In serverless environments, if an app was initialized without databaseURL
  // in a previous cold start, we'll return it here. This is why we ensure databaseURL
  // is always included in new initializations below.
  if (admin.apps.length > 0) {
    adminApp = admin.apps[0] as admin.app.App;
    // Log if we're using an existing app (might have been initialized without databaseURL)
    if (!databaseURL) {
      console.warn('⚠️ Using existing Firebase Admin app, but FIREBASE_DATABASE_URL is not set');
      console.warn('💡 If database operations fail, redeploy to ensure app is initialized with databaseURL');
    }
    return adminApp;
  }

  // Prevent multiple initialization attempts
  if (initializationAttempted) {
    return null;
  }

  initializationAttempted = true;

  try {
    // Get project ID from environment variables
    // Server-side uses FIREBASE_* (without VITE_ prefix), fallback to VITE_FIREBASE_*
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

    if (!projectId) {
      console.warn('⚠️ Firebase Admin: FIREBASE_PROJECT_ID not set. Firebase Auth profile updates will be skipped.');
      return null;
    }

    // Check if we have a service account key (for local development or explicit setup)
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      // Parse service account key if provided as JSON string
      try {
        const key = typeof serviceAccountKey === 'string' 
          ? JSON.parse(serviceAccountKey) 
          : serviceAccountKey;
        
        const initConfig: admin.AppOptions = {
          credential: admin.credential.cert(key),
          projectId: key.project_id || projectId,
        };
        
        // Include databaseURL if it's defined (required for database operations)
        if (databaseURL) {
          initConfig.databaseURL = databaseURL;
        } else {
          console.warn('⚠️ Firebase Admin: FIREBASE_DATABASE_URL not set. Database operations will fail.');
          console.warn('💡 Set FIREBASE_DATABASE_URL in your environment variables.');
          console.warn('   Format: https://your-project-default-rtdb.region.firebasedatabase.app');
        }
        
        adminApp = admin.initializeApp(initConfig);
        console.log('✅ Firebase Admin initialized with service account key');
        if (databaseURL) {
          console.log('✅ Database URL configured:', databaseURL.substring(0, 50) + '...');
        } else {
          console.warn('⚠️ Database URL not configured - database operations will fail');
        }
        return adminApp;
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        console.warn('⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', errorMsg);
        // Continue to try other methods
      }
    }

    // Try to initialize with Application Default Credentials
    // This works on Vercel if Firebase project is linked, or if GOOGLE_APPLICATION_CREDENTIALS is set
    try {
      const initConfig: admin.AppOptions = {
        projectId: projectId,
      };
      
      // Include databaseURL if it's defined (required for database operations)
      if (databaseURL) {
        initConfig.databaseURL = databaseURL;
      } else {
        console.warn('⚠️ Firebase Admin: FIREBASE_DATABASE_URL not set. Database operations will fail.');
        console.warn('💡 Set FIREBASE_DATABASE_URL in your environment variables.');
        console.warn('   Format: https://your-project-default-rtdb.region.firebasedatabase.app');
      }
      
      adminApp = admin.initializeApp(initConfig);
      console.log('✅ Firebase Admin initialized with Application Default Credentials');
      if (databaseURL) {
        console.log('✅ Database URL configured:', databaseURL.substring(0, 50) + '...');
      } else {
        console.warn('⚠️ Database URL not configured - database operations will fail');
      }
      return adminApp;
    } catch (initError) {
      const errorMsg = initError instanceof Error ? initError.message : String(initError);
      // Don't log as error - this is expected if credentials aren't set up
      console.warn('⚠️ Firebase Admin: Could not initialize with Application Default Credentials:', errorMsg);
      console.warn('💡 To enable Firebase Auth profile updates, either:');
      console.warn('   1. Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable with service account JSON');
      console.warn('   2. Link Firebase project in Vercel (Settings → Integrations → Firebase)');
      console.warn('   3. Set GOOGLE_APPLICATION_CREDENTIALS to point to service account key file');
      return null;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Firebase Admin initialization error:', errorMsg);
    return null;
  }
}

// Get Firebase Admin Auth instance
export function getFirebaseAdminAuth(): admin.auth.Auth | null {
  const app = initializeFirebaseAdmin();
  if (!app) {
    return null;
  }
  return admin.auth(app);
}

// Check if Firebase Admin is initialized
export function isFirebaseAdminInitialized(): boolean {
  return adminApp !== null || admin.apps.length > 0;
}

// Update Firebase Auth user profile
export async function updateFirebaseAuthProfile(
  firebaseUid: string,
  updates: {
    displayName?: string;
    photoURL?: string;
    email?: string;
    phoneNumber?: string;
  }
): Promise<void> {
  try {
    const auth = getFirebaseAdminAuth();
    
    // If Firebase Admin is not initialized, skip silently
    // This allows the app to work even if Firebase Admin credentials aren't set up
    if (!auth) {
      console.warn('⚠️ Firebase Admin not initialized. Skipping Firebase Auth profile update.');
      return;
    }
    
    // Build update object with only provided fields
    const authUpdates: admin.auth.UpdateRequest = {};
    
    if (updates.displayName !== undefined) {
      authUpdates.displayName = updates.displayName;
    }
    if (updates.photoURL !== undefined) {
      authUpdates.photoURL = updates.photoURL;
    }
    if (updates.email !== undefined) {
      authUpdates.email = updates.email;
    }
    if (updates.phoneNumber !== undefined) {
      authUpdates.phoneNumber = updates.phoneNumber;
    }

    // Only update if there are fields to update
    if (Object.keys(authUpdates).length === 0) {
      return;
    }

    await auth.updateUser(firebaseUid, authUpdates);
    console.log('✅ Firebase Auth profile updated successfully:', firebaseUid, Object.keys(authUpdates));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to update Firebase Auth profile:', errorMsg);
    // Don't throw - allow the database update to succeed even if Auth update fails
    // This is a non-critical operation
  }
}


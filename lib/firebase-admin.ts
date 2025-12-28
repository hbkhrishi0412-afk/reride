import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (Vercel-safe)
// Prevents re-initialization in serverless environments
if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL || `https://${serviceAccount.project_id}.firebaseio.com`,
      });
      console.log('✅ Firebase Admin initialized with service account');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
      throw error;
    }
  } else {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT environment variable not set. Firebase Admin will not be initialized.');
    console.warn('💡 Set FIREBASE_SERVICE_ACCOUNT in Vercel environment variables with the full service account JSON.');
  }
}

export default admin;

// Get Firebase Admin Auth instance
export function getFirebaseAdminAuth(): admin.auth.Auth | null {
  if (!admin.apps.length) {
    return null;
  }
  return admin.auth();
}

// Check if Firebase Admin is initialized
export function isFirebaseAdminInitialized(): boolean {
  return admin.apps.length > 0;
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
    if (!admin.apps.length) {
      console.warn('⚠️ Firebase Admin not initialized. Skipping Firebase Auth profile update.');
      return;
    }
    
    const auth = admin.auth();
    
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


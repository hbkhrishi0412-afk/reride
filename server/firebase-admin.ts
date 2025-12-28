// SERVER-ONLY: Firebase Admin SDK
// This file must NEVER be imported in frontend code
// Vercel serverless functions only

import admin from 'firebase-admin';

// Simple, deterministic initialization
// One parse, one initialize, one failure path
if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!serviceAccountJson) {
    const error = new Error(
      'FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
      'Set it in Vercel: Settings → Environment Variables → FIREBASE_SERVICE_ACCOUNT'
    );
    console.error('❌', error.message);
    throw error; // Stop immediately - do not continue
  }
  
  try {
    // Parse JSON once - trust the environment variable
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Validate required fields
    if (!serviceAccount.private_key || !serviceAccount.client_email) {
      const error = new Error(
        'FIREBASE_SERVICE_ACCOUNT missing required fields (private_key, client_email). ' +
        'Check your service account JSON format.'
      );
      console.error('❌', error.message);
      throw error; // Stop immediately
    }
    
    // Initialize once
    const databaseURL = process.env.FIREBASE_DATABASE_URL || 
                        `https://${serviceAccount.project_id || 'default'}.firebaseio.com`;
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
    });
    
    console.log('✅ Firebase Admin initialized successfully');
    
  } catch (error) {
    // If parsing or initialization fails, stop immediately
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (error instanceof SyntaxError) {
      // JSON parse error
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', errorMsg);
      console.error('💡 Make sure the environment variable contains valid JSON');
      console.error('   - No outer quotes around the JSON');
      console.error('   - Use \\n for newlines in private_key (not actual newlines)');
      console.error('   - Format: {"type":"service_account","project_id":"xxx",...}');
    } else {
      // Initialization error
      console.error('❌ Failed to initialize Firebase Admin:', errorMsg);
    }
    
    // Re-throw to stop the serverless function
    throw error;
  }
}

export default admin;

// Get Firebase Admin Auth instance
export function getFirebaseAdminAuth(): admin.auth.Auth {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin is not initialized');
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
  if (!admin.apps.length) {
    throw new Error('Firebase Admin is not initialized');
  }
  
  const auth = admin.auth();
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

  if (Object.keys(authUpdates).length === 0) {
    return;
  }

  await auth.updateUser(firebaseUid, authUpdates);
  console.log('✅ Firebase Auth profile updated:', firebaseUid);
}


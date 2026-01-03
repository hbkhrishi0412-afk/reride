/**
 * Sync Users to Firebase Authentication
 * 
 * This script:
 * 1. Fetches all users from MongoDB
 * 2. Creates Firebase Auth users for each user
 * 3. Updates MongoDB with firebaseUid
 * 
 * Requirements:
 * - Firebase Admin SDK service account key
 * - MongoDB connection string
 * - Firebase project configured
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const FIREBASE_SERVICE_ACCOUNT_PATH = join(__dirname, '..', 'firebase-service-account.json');
const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;

// Initialize Firebase Admin
function initializeFirebaseAdmin() {
  try {
    // Check if already initialized
    if (getApps().length > 0) {
      console.log('✅ Firebase Admin already initialized');
      return getAuth();
    }

    // Check if service account file exists
    if (!existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
      throw new Error(
        `Firebase service account file not found at: ${FIREBASE_SERVICE_ACCOUNT_PATH}\n` +
        'Please download your service account key from Firebase Console:\n' +
        '1. Go to Firebase Console → Project Settings → Service Accounts\n' +
        '2. Click "Generate new private key"\n' +
        '3. Save as firebase-service-account.json in project root'
      );
    }

    const serviceAccount = JSON.parse(readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf-8'));

    initializeApp({
      credential: cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized');
    return getAuth();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    throw error;
  }
}

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    if (!MONGODB_URI) {
      throw new Error(
        'MONGODB_URI not found in environment variables.\n' +
        'Please set MONGODB_URI in your .env.local file or environment.'
      );
    }

    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected');
      return;
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

// Create Firebase user from MongoDB user
async function createFirebaseUser(auth, user) {
  try {
    // Check if user already has Firebase UID
    if (user.firebaseUid) {
      // Verify user still exists in Firebase
      try {
        await auth.getUser(user.firebaseUid);
        console.log(`⏭️  User ${user.email} already has Firebase UID: ${user.firebaseUid}`);
        return { success: true, uid: user.firebaseUid, existing: true };
      } catch (error) {
        // User doesn't exist in Firebase, need to recreate
        console.log(`⚠️  Firebase UID ${user.firebaseUid} not found in Firebase, will recreate`);
      }
    }

    // Prepare user data for Firebase
    const userRecord = {
      email: user.email,
      emailVerified: user.emailVerified || user.isVerified || false,
      displayName: user.name,
      photoURL: user.avatarUrl || undefined,
      disabled: user.status === 'inactive',
    };

    // Add phone number if available
    if (user.mobile) {
      // Format phone number (ensure it has country code)
      let phoneNumber = user.mobile.trim();
      if (!phoneNumber.startsWith('+')) {
        // Assume India (+91) if no country code
        phoneNumber = `+91${phoneNumber.replace(/^91/, '')}`;
      }
      userRecord.phoneNumber = phoneNumber;
    }

    // Create user in Firebase
    let firebaseUser;
    try {
      firebaseUser = await auth.createUser(userRecord);
      console.log(`✅ Created Firebase user for ${user.email} (UID: ${firebaseUser.uid})`);
    } catch (error) {
      // User might already exist
      if (error.code === 'auth/email-already-exists') {
        // Get existing user by email
        firebaseUser = await auth.getUserByEmail(user.email);
        console.log(`⚠️  User ${user.email} already exists in Firebase (UID: ${firebaseUser.uid})`);
      } else {
        throw error;
      }
    }

    // Set custom claims (role)
    if (user.role) {
      await auth.setCustomUserClaims(firebaseUser.uid, {
        role: user.role,
        authProvider: user.authProvider || 'email',
      });
      console.log(`✅ Set custom claims for ${user.email} (role: ${user.role})`);
    }

    // Set password if available (for email/password users)
    if (user.password && user.authProvider === 'email') {
      try {
        await auth.updateUser(firebaseUser.uid, {
          password: user.password,
        });
        console.log(`✅ Set password for ${user.email}`);
      } catch (error) {
        console.warn(`⚠️  Could not set password for ${user.email}: ${error.message}`);
      }
    }

    return { success: true, uid: firebaseUser.uid, existing: false };
  } catch (error) {
    console.error(`❌ Failed to create Firebase user for ${user.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Update MongoDB user with Firebase UID
async function updateUserWithFirebaseUid(userId, firebaseUid, authProvider = 'email') {
  try {
    await User.findByIdAndUpdate(userId, {
      firebaseUid,
      authProvider,
    });
    console.log(`✅ Updated MongoDB user with Firebase UID: ${firebaseUid}`);
  } catch (error) {
    console.error(`❌ Failed to update MongoDB user:`, error.message);
    throw error;
  }
}

// Main sync function
async function syncUsersToFirebase() {
  console.log('\n🚀 Starting User Sync to Firebase...\n');
  console.log('═'.repeat(60));

  try {
    // Initialize Firebase Admin
    const auth = initializeFirebaseAdmin();

    // Connect to MongoDB
    await connectToMongoDB();

    // Fetch all users from MongoDB
    console.log('\n📥 Fetching users from MongoDB...');
    const users = await User.find({}).lean();
    console.log(`✅ Found ${users.length} users in database\n`);

    if (users.length === 0) {
      console.log('⚠️  No users found in database. Nothing to sync.');
      return;
    }

    // Statistics
    let stats = {
      total: users.length,
      created: 0,
      updated: 0,
      existing: 0,
      failed: 0,
      errors: [],
    };

    // Process each user
    console.log('🔄 Processing users...\n');
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const progress = `[${i + 1}/${users.length}]`;
      
      console.log(`${progress} Processing: ${user.email} (${user.role})`);

      try {
        // Create/update Firebase user
        const result = await createFirebaseUser(auth, user);

        if (result.success) {
          // Update MongoDB with Firebase UID if not already set
          if (!user.firebaseUid || user.firebaseUid !== result.uid) {
            await updateUserWithFirebaseUid(
              user._id,
              result.uid,
              user.authProvider || 'email'
            );
            stats.updated++;
          } else if (result.existing) {
            stats.existing++;
          } else {
            stats.created++;
          }
        } else {
          stats.failed++;
          stats.errors.push({
            email: user.email,
            error: result.error,
          });
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          email: user.email,
          error: error.message,
        });
        console.error(`❌ Error processing ${user.email}:`, error.message);
      }

      // Add small delay to avoid rate limiting
      if (i < users.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Sync Summary:');
    console.log('═'.repeat(60));
    console.log(`Total users:     ${stats.total}`);
    console.log(`✅ Created:       ${stats.created}`);
    console.log(`🔄 Updated:       ${stats.updated}`);
    console.log(`⏭️  Existing:      ${stats.existing}`);
    console.log(`❌ Failed:        ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(({ email, error }) => {
        console.log(`   - ${email}: ${error}`);
      });
    }

    console.log('\n✅ Sync completed!\n');
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
    }
  }
}

// Run sync
syncUsersToFirebase()
  .then(() => {
    console.log('✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });













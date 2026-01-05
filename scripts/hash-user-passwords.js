/**
 * Hash All Plain Text Passwords in Firebase
 * 
 * This script:
 * 1. Fetches all users from Firebase Realtime Database
 * 2. Identifies users with plain text passwords (not bcrypt hashes)
 * 3. Hashes those passwords using bcrypt
 * 4. Updates the users in Firebase
 * 
 * Requirements:
 * - Firebase Admin SDK configured
 * - FIREBASE_SERVICE_ACCOUNT_KEY environment variable set
 */

import admin from '../server/firebase-admin.js';
import { hashPassword } from '../utils/security.js';
import { DB_PATHS } from '../lib/firebase-db.js';

// Get Firebase Admin Database instance
function getFirebaseAdminDatabase() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin is not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
  }
  
  const app = admin.app();
  return admin.database(app);
}

// Check if password is already hashed
function isHashed(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }
  // Bcrypt hashes start with $2a$, $2b$, or $2y$
  return password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$');
}

async function hashAllPasswords() {
  try {
    console.log('🔍 Fetching all users from Firebase...');
    const db = getFirebaseAdminDatabase();
    const usersRef = db.ref(DB_PATHS.USERS);
    const snapshot = await usersRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('⚠️  No users found in database');
      return;
    }
    
    const users = snapshot.val();
    const userKeys = Object.keys(users);
    console.log(`📊 Found ${userKeys.length} users`);
    
    let hashedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const userKey of userKeys) {
      const user = users[userKey];
      
      // Skip if user doesn't have a password
      if (!user.password) {
        console.log(`⏭️  Skipping ${user.email || userKey} (no password)`);
        skippedCount++;
        continue;
      }
      
      // Skip if password is already hashed
      if (isHashed(user.password)) {
        console.log(`⏭️  Skipping ${user.email || userKey} (password already hashed)`);
        skippedCount++;
        continue;
      }
      
      try {
        console.log(`🔐 Hashing password for ${user.email || userKey}...`);
        const hashedPassword = await hashPassword(user.password);
        
        // Update user with hashed password
        const userRef = db.ref(`${DB_PATHS.USERS}/${userKey}`);
        await userRef.update({ password: hashedPassword });
        
        console.log(`✅ Updated password for ${user.email || userKey}`);
        hashedCount++;
      } catch (error) {
        console.error(`❌ Error hashing password for ${user.email || userKey}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Hashed: ${hashedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('\n✅ Password hashing complete!');
    
  } catch (error) {
    console.error('❌ Error hashing passwords:', error);
    process.exit(1);
  }
}

// Run the script
hashAllPasswords()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });


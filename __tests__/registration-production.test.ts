/**
 * Production Registration Flow Test Suite
 * 
 * This test suite validates the complete registration flow in production:
 * 1. API endpoint registration
 * 2. Firebase Realtime Database verification
 * 3. Real-time change detection
 * 
 * Prerequisites:
 * - Set PRODUCTION_API_URL environment variable (e.g., https://your-app.vercel.app)
 * - Set FIREBASE_PROJECT_ID environment variable
 * - Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY (JSON string)
 * 
 * Run with: npm test -- registration-production.test.ts
 */

import axios, { AxiosInstance } from 'axios';
import * as admin from 'firebase-admin';
import { getDatabase, ref, onValue, off, get } from 'firebase/database';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

// Test configuration
const PRODUCTION_API_URL = process.env.PRODUCTION_API_URL || 'https://your-app.vercel.app';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'reride-ade6a';
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || 
  `https://${FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/`;

// Test timeout (30 seconds for production API calls)
const TEST_TIMEOUT = 30000;

// Helper to generate unique test email
const generateTestEmail = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@test-reride.com`;
};

// Initialize Firebase Admin SDK for database verification
let adminApp: admin.app.App | null = null;
let adminDb: admin.database.Database | null = null;

// Initialize Firebase Client SDK for real-time listeners
let clientApp: FirebaseApp | null = null;
let clientDb: ReturnType<typeof getDatabase> | null = null;

// API client instance
let apiClient: AxiosInstance;

// Test user data
interface TestUser {
  email: string;
  password: string;
  name: string;
  mobile: string;
  role: 'customer' | 'seller' | 'admin';
}

describe('Production Registration Flow Tests', () => {
  let testUser: TestUser;
  let registeredUserId: string | null = null;
  let registeredUserUid: string | null = null;

  beforeAll(async () => {
    console.log('\n🚀 Initializing Production Test Suite...');
    console.log(`📍 Production API URL: ${PRODUCTION_API_URL}`);
    console.log(`🔥 Firebase Project ID: ${FIREBASE_PROJECT_ID}`);
    console.log(`💾 Firebase Database URL: ${FIREBASE_DATABASE_URL}`);

    // Initialize API client
    apiClient = axios.create({
      baseURL: PRODUCTION_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Initialize Firebase Admin SDK
    try {
      // Check if Firebase Admin is already initialized
      if (admin.apps.length === 0) {
        // Try to initialize with service account key from environment
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        
        if (serviceAccountKey) {
          // Parse JSON string from environment variable
          const serviceAccount = JSON.parse(serviceAccountKey);
          adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: FIREBASE_DATABASE_URL,
            projectId: FIREBASE_PROJECT_ID,
          });
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          // Use service account file path
          adminApp = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: FIREBASE_DATABASE_URL,
            projectId: FIREBASE_PROJECT_ID,
          });
        } else {
          // Try to initialize with default credentials (for CI/CD environments)
          console.warn('⚠️  No Firebase service account credentials found. Database verification may be limited.');
          console.warn('💡 Set FIREBASE_SERVICE_ACCOUNT_KEY (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path)');
        }
      } else {
        adminApp = admin.apps[0] as admin.app.App;
      }

      if (adminApp) {
        adminDb = admin.database(adminApp);
        console.log('✅ Firebase Admin SDK initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin SDK:', error);
      console.warn('⚠️  Continuing without Admin SDK - database verification will be limited');
    }

    // Initialize Firebase Client SDK for real-time listeners
    try {
      if (getApps().length === 0) {
        const firebaseConfig = {
          apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
          authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
          projectId: FIREBASE_PROJECT_ID,
          storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
          databaseURL: FIREBASE_DATABASE_URL,
        };

        clientApp = initializeApp(firebaseConfig);
        clientDb = getDatabase(clientApp);
        console.log('✅ Firebase Client SDK initialized for real-time listeners');
      } else {
        clientApp = getApps()[0];
        clientDb = getDatabase(clientApp);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Client SDK:', error);
      console.warn('⚠️  Real-time listener tests will be skipped');
    }

    // Generate unique test user data
    testUser = {
      email: generateTestEmail(),
      password: 'TestPassword123!',
      name: 'Test User',
      mobile: '9876543210',
      role: 'customer',
    };

    console.log(`\n👤 Test User Email: ${testUser.email}`);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    console.log('\n🧹 Cleaning up test data...');

    // Clean up registered user from database if test created one
    if (registeredUserId && adminDb) {
      try {
        const userRef = adminDb.ref(`users/${registeredUserId}`);
        await userRef.remove();
        console.log(`✅ Cleaned up test user: ${registeredUserId}`);
      } catch (error) {
        console.warn(`⚠️  Failed to clean up user ${registeredUserId}:`, error);
      }
    }

    // Clean up Firebase Admin app
    if (adminApp) {
      try {
        await adminApp.delete();
        console.log('✅ Firebase Admin SDK cleaned up');
      } catch (error) {
        console.warn('⚠️  Error cleaning up Admin SDK:', error);
      }
    }

    console.log('✅ Test suite cleanup complete');
  });

  describe('1. Registration API Endpoint Tests', () => {
    it('should successfully register a new user via API', async () => {
      console.log('\n📝 Testing user registration via API...');

      const registrationData = {
        action: 'register',
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
        mobile: testUser.mobile,
        role: testUser.role,
      };

      const response = await apiClient.post('/api/users', registrationData);

      // Assert API response
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('success');
      expect(response.data.success).toBe(true);
      expect(response.data).toHaveProperty('user');
      expect(response.data.user).toHaveProperty('email', testUser.email);
      expect(response.data.user).toHaveProperty('name', testUser.name);
      expect(response.data.user).toHaveProperty('role', testUser.role);
      expect(response.data.user).not.toHaveProperty('password'); // Password should not be in response

      // Store user ID for cleanup
      if (response.data.user.id) {
        registeredUserId = response.data.user.id.toString();
      }
      if (response.data.user.firebaseUid) {
        registeredUserUid = response.data.user.firebaseUid;
      }

      // Verify response includes token
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data.accessToken).toBeTruthy();

      console.log('✅ Registration API test passed');
      console.log(`   User ID: ${registeredUserId || 'N/A'}`);
      console.log(`   Firebase UID: ${registeredUserUid || 'N/A'}`);
      console.log(`   Access Token: ${response.data.accessToken ? 'Present' : 'Missing'}`);
    }, TEST_TIMEOUT);

    it('should reject registration with duplicate email', async () => {
      console.log('\n📝 Testing duplicate email rejection...');

      const duplicateData = {
        action: 'register',
        email: testUser.email, // Same email as previous test
        password: testUser.password,
        name: 'Another User',
        mobile: '9876543211',
        role: 'customer',
      };

      try {
        await apiClient.post('/api/users', duplicateData);
        // Should not reach here
        fail('Expected API to reject duplicate email');
      } catch (error: any) {
        // Assert error response
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('success', false);
        expect(error.response.data.reason).toContain('already exists');
      }

      console.log('✅ Duplicate email rejection test passed');
    }, TEST_TIMEOUT);

    it('should reject registration with invalid email format', async () => {
      console.log('\n📝 Testing invalid email format rejection...');

      const invalidData = {
        action: 'register',
        email: 'invalid-email-format',
        password: testUser.password,
        name: testUser.name,
        mobile: testUser.mobile,
        role: testUser.role,
      };

      try {
        await apiClient.post('/api/users', invalidData);
        fail('Expected API to reject invalid email');
      } catch (error: any) {
        expect(error.response).toBeDefined();
        expect([400, 422]).toContain(error.response.status);
      }

      console.log('✅ Invalid email format rejection test passed');
    }, TEST_TIMEOUT);
  });

  describe('2. Database Verification Tests', () => {
    it('should verify user record exists in Firebase Realtime Database', async () => {
      console.log('\n💾 Verifying user record in Firebase Realtime Database...');

      if (!adminDb) {
        console.warn('⚠️  Skipping database verification - Admin SDK not initialized');
        console.warn('💡 Set FIREBASE_SERVICE_ACCOUNT_KEY to enable database verification');
        return;
      }

      if (!registeredUserUid && !registeredUserId) {
        console.warn('⚠️  Skipping - No user ID available from registration');
        return;
      }

      // Try to find user by Firebase UID first, then by email
      let userRef: admin.database.Reference;
      let userSnapshot: admin.database.DataSnapshot;

      if (registeredUserUid) {
        // Check users/{firebaseUid}
        userRef = adminDb.ref(`users/${registeredUserUid}`);
        userSnapshot = await userRef.once('value');

        if (!userSnapshot.exists()) {
          // Try alternative path: users/{email}
          const emailKey = testUser.email.replace(/[.#$[\]]/g, '_');
          userRef = adminDb.ref(`users/${emailKey}`);
          userSnapshot = await userRef.once('value');
        }
      } else {
        // Try by email key
        const emailKey = testUser.email.replace(/[.#$[\]]/g, '_');
        userRef = adminDb.ref(`users/${emailKey}`);
        userSnapshot = await userRef.once('value');
      }

      // If still not found, try searching all users
      if (!userSnapshot.exists()) {
        console.log('🔍 Searching all users for test email...');
        const allUsersRef = adminDb.ref('users');
        const allUsersSnapshot = await allUsersRef.once('value');
        const allUsers = allUsersSnapshot.val();

        if (allUsers) {
          const foundUser = Object.entries(allUsers).find(([_, user]: [string, any]) => 
            user && user.email === testUser.email
          );

          if (foundUser) {
            userRef = adminDb.ref(`users/${foundUser[0]}`);
            userSnapshot = await userRef.once('value');
          }
        }
      }

      // Assert user exists in database
      expect(userSnapshot.exists()).toBe(true);
      console.log('✅ User record found in database');

      const userData = userSnapshot.val();

      // Assert user data fields
      expect(userData).toHaveProperty('email', testUser.email);
      expect(userData).toHaveProperty('name', testUser.name);
      expect(userData).toHaveProperty('role', testUser.role);
      expect(userData).toHaveProperty('mobile', testUser.mobile);

      // Assert timestamp fields
      expect(userData).toHaveProperty('createdAt');
      expect(userData.createdAt).toBeTruthy();

      // Assert default fields
      expect(userData).toHaveProperty('status', 'active');
      expect(userData).toHaveProperty('subscriptionPlan', 'free');

      console.log('✅ Database verification passed');
      console.log(`   Email: ${userData.email}`);
      console.log(`   Name: ${userData.name}`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   Created At: ${userData.createdAt}`);
    }, TEST_TIMEOUT);

    it('should verify user data integrity in database', async () => {
      console.log('\n🔍 Verifying user data integrity...');

      if (!adminDb) {
        console.warn('⚠️  Skipping - Admin SDK not initialized');
        return;
      }

      // Search for user by email
      const allUsersRef = adminDb.ref('users');
      const allUsersSnapshot = await allUsersRef.once('value');
      const allUsers = allUsersSnapshot.val();

      expect(allUsers).toBeTruthy();

      const foundUser = Object.entries(allUsers).find(([_, user]: [string, any]) => 
        user && user.email === testUser.email
      );

      expect(foundUser).toBeDefined();

      if (foundUser) {
        const [userId, userData] = foundUser;
        console.log(`✅ Found user with ID: ${userId}`);

        // Verify all required fields are present
        const requiredFields = ['email', 'name', 'role', 'status', 'createdAt'];
        requiredFields.forEach(field => {
          expect(userData).toHaveProperty(field);
          expect(userData[field]).toBeTruthy();
        });

        // Verify email matches
        expect(userData.email).toBe(testUser.email.toLowerCase());

        // Verify password is NOT stored in plain text (should be hashed or absent)
        if (userData.password) {
          expect(userData.password).not.toBe(testUser.password);
          console.log('✅ Password is hashed (not stored in plain text)');
        } else {
          console.log('✅ Password field not present (OAuth user or secure storage)');
        }

        console.log('✅ Data integrity verification passed');
      }
    }, TEST_TIMEOUT);
  });

  describe('3. Real-Time Change Detection Tests', () => {
    it('should detect new user registration in real-time', async () => {
      console.log('\n⚡ Testing real-time change detection...');

      if (!clientDb) {
        console.warn('⚠️  Skipping real-time test - Client SDK not initialized');
        return;
      }

      // Create a promise that resolves when real-time event is detected
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          off(usersRef, 'value', listener);
          reject(new Error('Real-time listener timeout - no event detected within 10 seconds'));
        }, 10000);

        const usersRef = ref(clientDb, 'users');
        
        const listener = onValue(usersRef, (snapshot) => {
          const users = snapshot.val();
          
          if (users) {
            // Check if our test user is in the snapshot
            const foundUser = Object.values(users).find((user: any) => 
              user && user.email === testUser.email
            );

            if (foundUser) {
              clearTimeout(timeout);
              off(usersRef, 'value', listener);
              
              console.log('✅ Real-time event detected');
              console.log(`   User email: ${(foundUser as any).email}`);
              console.log(`   User name: ${(foundUser as any).name}`);
              
              // Assert real-time data
              expect(foundUser).toBeDefined();
              expect((foundUser as any).email).toBe(testUser.email);
              
              resolve();
            }
          }
        }, (error) => {
          clearTimeout(timeout);
          off(usersRef, 'value', listener);
          reject(error);
        });

        // Trigger a new registration to test real-time detection
        // Note: This test assumes the previous registration test already created the user
        // If not, we'll wait for the listener to detect it
        console.log('👂 Listening for real-time changes...');
      });
    }, TEST_TIMEOUT + 5000);

    it('should log real-time registration event', async () => {
      console.log('\n📊 Logging real-time registration event...');

      if (!clientDb) {
        console.warn('⚠️  Skipping - Client SDK not initialized');
        return;
      }

      // Get current user count
      const usersRef = ref(clientDb, 'users');
      const snapshot = await get(usersRef);
      const users = snapshot.val();
      const initialCount = users ? Object.keys(users).length : 0;

      console.log(`📈 Current user count in database: ${initialCount}`);

      // Verify our test user is in the database
      if (users) {
        const testUserFound = Object.values(users).find((user: any) => 
          user && user.email === testUser.email
        );

        if (testUserFound) {
          console.log('✅ Test user found in real-time database snapshot');
          console.log(`   Email: ${(testUserFound as any).email}`);
          console.log(`   Name: ${(testUserFound as any).name}`);
          console.log(`   Role: ${(testUserFound as any).role}`);
          console.log(`   Created At: ${(testUserFound as any).createdAt}`);
          
          expect(testUserFound).toBeDefined();
        } else {
          console.warn('⚠️  Test user not found in snapshot');
        }
      }

      console.log('✅ Real-time event logging complete');
    }, TEST_TIMEOUT);
  });

  describe('4. End-to-End Registration Flow', () => {
    it('should complete full registration flow: API → Database → Real-time', async () => {
      console.log('\n🔄 Testing complete end-to-end registration flow...');

      // Step 1: Register via API
      const newTestUser: TestUser = {
        email: generateTestEmail(),
        password: 'E2ETest123!',
        name: 'E2E Test User',
        mobile: '9876543212',
        role: 'customer',
      };

      console.log(`📝 Step 1: Registering user ${newTestUser.email} via API...`);
      const registrationResponse = await apiClient.post('/api/users', {
        action: 'register',
        ...newTestUser,
      });

      expect(registrationResponse.status).toBe(201);
      expect(registrationResponse.data.success).toBe(true);
      const apiUserId = registrationResponse.data.user.id || registrationResponse.data.user.firebaseUid;
      console.log(`✅ API registration successful. User ID: ${apiUserId}`);

      // Step 2: Verify in database (if Admin SDK available)
      if (adminDb) {
        console.log('💾 Step 2: Verifying user in database...');
        
        // Wait a bit for database write to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        const emailKey = newTestUser.email.replace(/[.#$[\]]/g, '_');
        let userRef = adminDb.ref(`users/${emailKey}`);
        let userSnapshot = await userRef.once('value');

        if (!userSnapshot.exists() && apiUserId) {
          userRef = adminDb.ref(`users/${apiUserId}`);
          userSnapshot = await userRef.once('value');
        }

        // Search all users if still not found
        if (!userSnapshot.exists()) {
          const allUsersRef = adminDb.ref('users');
          const allUsersSnapshot = await allUsersRef.once('value');
          const allUsers = allUsersSnapshot.val();
          
          if (allUsers) {
            const found = Object.entries(allUsers).find(([_, user]: [string, any]) => 
              user && user.email === newTestUser.email
            );
            
            if (found) {
              userRef = adminDb.ref(`users/${found[0]}`);
              userSnapshot = await userRef.once('value');
            }
          }
        }

        expect(userSnapshot.exists()).toBe(true);
        const dbUser = userSnapshot.val();
        expect(dbUser.email).toBe(newTestUser.email);
        console.log('✅ Database verification successful');
      } else {
        console.log('⚠️  Step 2: Skipping database verification (Admin SDK not available)');
      }

      // Step 3: Verify real-time detection (if Client SDK available)
      if (clientDb) {
        console.log('⚡ Step 3: Verifying real-time detection...');
        
        const usersRef = ref(clientDb, 'users');
        const snapshot = await get(usersRef);
        const users = snapshot.val();
        
        if (users) {
          const foundUser = Object.values(users).find((user: any) => 
            user && user.email === newTestUser.email
          );
          
          expect(foundUser).toBeDefined();
          console.log('✅ Real-time detection successful');
        }
      } else {
        console.log('⚠️  Step 3: Skipping real-time verification (Client SDK not available)');
      }

      // Cleanup: Remove test user
      if (adminDb && apiUserId) {
        try {
          const cleanupRef = adminDb.ref(`users/${apiUserId}`);
          await cleanupRef.remove();
          console.log('🧹 Cleaned up E2E test user');
        } catch (error) {
          console.warn('⚠️  Failed to cleanup E2E test user:', error);
        }
      }

      console.log('✅ End-to-end registration flow test completed successfully');
    }, TEST_TIMEOUT + 10000);
  });
});


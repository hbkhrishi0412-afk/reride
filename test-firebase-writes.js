/**
 * Test Firebase Realtime Database Write Operations
 * 
 * This script tests CREATE, UPDATE, MODIFY, and DELETE operations
 * to verify Firebase writes are working in production.
 */

import { adminCreate, adminUpdate, adminDelete, adminRead, DB_PATHS } from './server/firebase-admin-db.js';
import admin from './server/firebase-admin.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testFirebaseWrites() {
  console.log('\n');
  log('🧪 Testing Firebase Realtime Database Write Operations', 'cyan');
  log('='.repeat(60), 'cyan');
  console.log('');

  // Test 1: Check Firebase Admin Initialization
  log('📋 Test 1: Firebase Admin Initialization', 'blue');
  try {
    if (!admin.apps.length) {
      log('❌ Firebase Admin is NOT initialized', 'red');
      log('💡 Check FIREBASE_SERVICE_ACCOUNT_KEY environment variable', 'yellow');
      return;
    }
    log('✅ Firebase Admin is initialized', 'green');
    
    const app = admin.app();
    const db = admin.database(app);
    log(`   Database URL: ${db.app.options.databaseURL || 'default'}`, 'cyan');
  } catch (error) {
    log(`❌ Error checking Firebase Admin: ${error.message}`, 'red');
    return;
  }
  console.log('');

  // Test 2: CREATE Operation
  log('📋 Test 2: CREATE Operation', 'blue');
  let testVehicleId = null;
  try {
    const testVehicle = {
      make: 'Test Make',
      model: 'Test Model',
      price: 99999,
      sellerEmail: 'test@example.com',
      status: 'published',
      createdAt: new Date().toISOString(),
    };
    
    testVehicleId = Date.now().toString();
    await adminCreate(DB_PATHS.VEHICLES, testVehicle, testVehicleId);
    log(`✅ CREATE successful: Vehicle ID ${testVehicleId}`, 'green');
    
    // Verify the create
    const created = await adminRead(DB_PATHS.VEHICLES, testVehicleId);
    if (created) {
      log(`✅ CREATE verified: Data exists in database`, 'green');
    } else {
      log(`❌ CREATE verification failed: Data not found after creation`, 'red');
    }
  } catch (error) {
    log(`❌ CREATE failed: ${error.message}`, 'red');
    log(`   Stack: ${error.stack}`, 'yellow');
  }
  console.log('');

  // Test 3: UPDATE Operation
  log('📋 Test 3: UPDATE Operation', 'blue');
  if (testVehicleId) {
    try {
      const updates = {
        price: 88888,
        model: 'Updated Test Model',
        updatedAt: new Date().toISOString(),
      };
      
      await adminUpdate(DB_PATHS.VEHICLES, testVehicleId, updates);
      log(`✅ UPDATE successful: Vehicle ID ${testVehicleId}`, 'green');
      
      // Verify the update
      const updated = await adminRead(DB_PATHS.VEHICLES, testVehicleId);
      if (updated && updated.price === 88888 && updated.model === 'Updated Test Model') {
        log(`✅ UPDATE verified: Changes saved correctly`, 'green');
        log(`   Updated price: ${updated.price}`, 'cyan');
        log(`   Updated model: ${updated.model}`, 'cyan');
      } else {
        log(`❌ UPDATE verification failed: Changes not reflected`, 'red');
        log(`   Expected price: 88888, Got: ${updated?.price}`, 'yellow');
        log(`   Expected model: Updated Test Model, Got: ${updated?.model}`, 'yellow');
      }
    } catch (error) {
      log(`❌ UPDATE failed: ${error.message}`, 'red');
      log(`   Stack: ${error.stack}`, 'yellow');
    }
  } else {
    log(`⚠️  Skipping UPDATE test: CREATE test failed`, 'yellow');
  }
  console.log('');

  // Test 4: MODIFY Operation (Partial Update)
  log('📋 Test 4: MODIFY Operation (Partial Update)', 'blue');
  if (testVehicleId) {
    try {
      const partialUpdates = {
        price: 77777,
      };
      
      await adminUpdate(DB_PATHS.VEHICLES, testVehicleId, partialUpdates);
      log(`✅ MODIFY successful: Vehicle ID ${testVehicleId}`, 'green');
      
      // Verify the modify
      const modified = await adminRead(DB_PATHS.VEHICLES, testVehicleId);
      if (modified && modified.price === 77777) {
        log(`✅ MODIFY verified: Partial update saved correctly`, 'green');
        log(`   Modified price: ${modified.price}`, 'cyan');
        log(`   Other fields preserved: model=${modified.model}`, 'cyan');
      } else {
        log(`❌ MODIFY verification failed: Partial update not reflected`, 'red');
      }
    } catch (error) {
      log(`❌ MODIFY failed: ${error.message}`, 'red');
      log(`   Stack: ${error.stack}`, 'yellow');
    }
  } else {
    log(`⚠️  Skipping MODIFY test: CREATE test failed`, 'yellow');
  }
  console.log('');

  // Test 5: DELETE Operation
  log('📋 Test 5: DELETE Operation', 'blue');
  if (testVehicleId) {
    try {
      await adminDelete(DB_PATHS.VEHICLES, testVehicleId);
      log(`✅ DELETE successful: Vehicle ID ${testVehicleId}`, 'green');
      
      // Verify the delete
      const deleted = await adminRead(DB_PATHS.VEHICLES, testVehicleId);
      if (!deleted) {
        log(`✅ DELETE verified: Data removed from database`, 'green');
      } else {
        log(`❌ DELETE verification failed: Data still exists after deletion`, 'red');
      }
    } catch (error) {
      log(`❌ DELETE failed: ${error.message}`, 'red');
      log(`   Stack: ${error.stack}`, 'yellow');
    }
  } else {
    log(`⚠️  Skipping DELETE test: CREATE test failed`, 'yellow');
  }
  console.log('');

  // Summary
  log('='.repeat(60), 'cyan');
  log('🏁 Test Summary', 'cyan');
  log('All tests completed. Check results above for any failures.', 'blue');
  console.log('');
}

// Run the tests
testFirebaseWrites().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});












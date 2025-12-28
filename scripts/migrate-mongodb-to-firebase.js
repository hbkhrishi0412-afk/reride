/**
 * Migration script to move data from MongoDB to Firebase Realtime Database
 * 
 * Usage:
 *   node scripts/migrate-mongodb-to-firebase.js
 * 
 * IMPORTANT: Before running, update Firebase security rules to allow writes:
 *   1. Go to: https://console.firebase.google.com/project/reride-ade6a/database/reride-ade6a-default-rtdb/rules
 *   2. Replace rules with: {"rules": {".read": true, ".write": true}}
 *   3. Click Publish
 * 
 * Make sure you have:
 *   1. MONGODB_URI set in your environment (source)
 *   2. Firebase environment variables set (destination)
 *   3. FIREBASE_DATABASE_URL set to your Firebase Realtime Database URL
 */

import mongoose from 'mongoose';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

// Try to load dotenv if available (optional dependency)
let dotenv;
try {
  dotenv = await import('dotenv');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  dotenv.default.config({ path: join(__dirname, '..', '.env.local') });
} catch (e) {
  // dotenv not installed, use environment variables directly
  console.log('ℹ️  dotenv not found, using environment variables directly');
}

// Firebase configuration and database will be initialized in main() function
let app;
let db;

// Optimized batch processing with higher concurrency (parallel processing)
async function processBatch(items, concurrency, processor) {
  const results = { migrated: 0, skipped: 0 };
  const startTime = Date.now();
  
  // Parallel processing with controlled concurrency
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const promises = batch.map(item => processor(item));
    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value === true) {
        results.migrated++;
      } else {
        results.skipped++;
        if (result.status === 'rejected') {
          console.error(`   ❌ Error: ${result.reason?.message || result.reason}`);
        }
      }
    });
    
    // Progress reporting with ETA
    const processed = Math.min(i + concurrency, items.length);
    if (processed % Math.max(50, Math.floor(items.length / 10)) === 0 || processed >= items.length) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 0) {
        const rate = processed / elapsed;
        const remaining = items.length - processed;
        const eta = remaining / rate;
        console.log(`   ✅ Processed ${processed}/${items.length} (${rate.toFixed(1)} items/sec${remaining > 0 ? `, ETA: ${eta.toFixed(1)}s` : ''})...`);
      }
    }
  }
  
  return results;
}

// MongoDB schemas (simplified for migration)
const userSchema = new mongoose.Schema({}, { strict: false });
const vehicleSchema = new mongoose.Schema({}, { strict: false });
const conversationSchema = new mongoose.Schema({}, { strict: false });
const notificationSchema = new mongoose.Schema({}, { strict: false });
const vehicleDataSchema = new mongoose.Schema({}, { strict: false });
const newCarSchema = new mongoose.Schema({}, { strict: false });
const planSchema = new mongoose.Schema({}, { strict: false });
const rateLimitSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
const VehicleData = mongoose.models.VehicleData || mongoose.model('VehicleData', vehicleDataSchema);
const NewCar = mongoose.models.NewCar || mongoose.model('NewCar', newCarSchema);
const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);
const RateLimit = mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema);

// Helper to convert email to Firebase-safe key
function emailToKey(email) {
  return email ? email.toLowerCase().trim().replace(/[.#$[\]]/g, '_') : null;
}

// Helper to convert MongoDB document to plain object
function toPlainObject(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  // Remove MongoDB-specific fields
  delete obj.__v;
  return obj;
}

async function migrateUsers(db) {
  console.log('\n📦 Migrating Users...');
  const users = await User.find({});
  console.log(`   Found ${users.length} users`);
  
  const startTime = Date.now();
  const results = await processBatch(users, 30, async (user) => {
    const userObj = toPlainObject(user);
    if (!userObj.email) {
      return false;
    }
    
    const emailKey = emailToKey(userObj.email);
    delete userObj._id;
    userObj.id = emailKey;
    
    const userRef = ref(db, `users/${emailKey}`);
    await set(userRef, userObj);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ Users migration complete: ${results.migrated} migrated, ${results.skipped} skipped (${elapsed}s)`);
  return results;
}

async function migrateVehicles(db) {
  console.log('\n🚗 Migrating Vehicles...');
  const vehicles = await Vehicle.find({});
  console.log(`   Found ${vehicles.length} vehicles`);
  
  const startTime = Date.now();
  const results = await processBatch(vehicles, 50, async (vehicle) => {
    const vehicleObj = toPlainObject(vehicle);
    if (!vehicleObj.id) {
      return false;
    }
    
    delete vehicleObj._id;
    const vehicleRef = ref(db, `vehicles/${vehicleObj.id}`);
    await set(vehicleRef, vehicleObj);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ Vehicles migration complete: ${results.migrated} migrated, ${results.skipped} skipped (${elapsed}s)`);
  return results;
}

async function migrateConversations(db) {
  console.log('\n💬 Migrating Conversations...');
  const conversations = await Conversation.find({});
  console.log(`   Found ${conversations.length} conversations`);
  
  const startTime = Date.now();
  const results = await processBatch(conversations, 50, async (conversation) => {
    const convObj = toPlainObject(conversation);
    if (!convObj.id) {
      if (convObj.customerId && convObj.vehicleId) {
        convObj.id = `${convObj.customerId}_${convObj.vehicleId}`;
      } else {
        return false;
      }
    }
    
    delete convObj._id;
    const convRef = ref(db, `conversations/${convObj.id}`);
    await set(convRef, convObj);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ Conversations migration complete: ${results.migrated} migrated, ${results.skipped} skipped (${elapsed}s)`);
  return results;
}

async function migrateNotifications(db) {
  console.log('\n🔔 Migrating Notifications...');
  const notifications = await Notification.find({});
  console.log(`   Found ${notifications.length} notifications`);
  
  const startTime = Date.now();
  const results = await processBatch(notifications, 50, async (notification) => {
    const notifObj = toPlainObject(notification);
    if (!notifObj.id) {
      notifObj.id = notification._id.toString();
    }
    
    delete notifObj._id;
    const notifRef = ref(db, `notifications/${notifObj.id}`);
    await set(notifRef, notifObj);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ Notifications migration complete: ${results.migrated} migrated, ${results.skipped} skipped (${elapsed}s)`);
  return results;
}

async function migrateVehicleData(db) {
  console.log('\n📊 Migrating Vehicle Data...');
  const vehicleDataDocs = await VehicleData.find({});
  console.log(`   Found ${vehicleDataDocs.length} vehicle data documents`);
  
  const startTime = Date.now();
  const results = await processBatch(vehicleDataDocs, 25, async (doc) => {
    const dataObj = toPlainObject(doc);
    if (!dataObj.data) {
      return false;
    }
    
    // Use document _id or a unique identifier as the key to avoid overwriting
    // Get the ID before deleting _id
    const docId = (dataObj._id ? dataObj._id.toString() : (doc._id ? doc._id.toString() : 'main'));
    delete dataObj._id;
    const dataRef = ref(db, `vehicleData/${docId}`);
    await set(dataRef, dataObj.data);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ Vehicle Data migration complete: ${results.migrated} migrated, ${results.skipped} skipped (${elapsed}s)`);
  return results;
}

async function migrateNewCars(db) {
  console.log('\n🚙 Migrating New Cars...');
  const newCars = await NewCar.find({});
  console.log(`   Found ${newCars.length} new cars`);
  
  const startTime = Date.now();
  const results = await processBatch(newCars, 50, async (car) => {
    const carObj = toPlainObject(car);
    if (!carObj.id && !carObj._id) {
      if (carObj.brand_name && carObj.model_name && carObj.model_year) {
        const carId = `${carObj.brand_name}_${carObj.model_name}_${carObj.model_year}`.replace(/[.#$[\]]/g, '_');
        carObj.id = carId;
      } else {
        return false;
      }
    } else if (carObj._id) {
      carObj.id = carObj._id.toString();
    }
    
    delete carObj._id;
    const carRef = ref(db, `newCars/${carObj.id}`);
    await set(carRef, carObj);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ New Cars migration complete: ${results.migrated} migrated, ${results.skipped} skipped (${elapsed}s)`);
  return results;
}

async function migratePlans(db) {
  console.log('\n💳 Migrating Plans...');
  const plans = await Plan.find({});
  console.log(`   Found ${plans.length} plans`);
  
  const startTime = Date.now();
  const results = await processBatch(plans, 50, async (plan) => {
    const planObj = toPlainObject(plan);
    if (!planObj.planId) {
      return false;
    }
    
    delete planObj._id;
    const planRef = ref(db, `plans/${planObj.planId}`);
    await set(planRef, planObj);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ Plans migration complete: ${results.migrated} migrated, ${results.skipped} skipped (${elapsed}s)`);
  return results;
}

async function migrateRateLimits(db) {
  console.log('\n⏱️  Migrating Rate Limits...');
  const rateLimits = await RateLimit.find({});
  console.log(`   Found ${rateLimits.length} rate limit entries`);
  
  const startTime = Date.now();
  const results = await processBatch(rateLimits, 50, async (rateLimit) => {
    const limitObj = toPlainObject(rateLimit);
    if (!limitObj.identifier) {
      return false;
    }
    
    const identifierKey = limitObj.identifier.replace(/[.#$[\]]/g, '_');
    delete limitObj._id;
    const limitRef = ref(db, `rateLimits/${identifierKey}`);
    await set(limitRef, limitObj);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✅ Rate Limits migration complete: ${results.migrated} migrated, ${results.skipped} skipped (${elapsed}s)`);
  return results;
}

async function main() {
  console.log('🚀 Starting MongoDB to Firebase Realtime Database Migration\n');
  
  // Validate MongoDB connection
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI or MONGODB_URL environment variable is not set!');
    process.exit(1);
  }
  
  // Validate Firebase configuration
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || 'https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/',
  };
  
  // Validate required Firebase config fields
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('❌ Firebase configuration is missing required fields!');
    console.error('   Required: FIREBASE_API_KEY (or VITE_FIREBASE_API_KEY)');
    console.error('   Required: FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID)');
    console.error('   Optional but recommended: FIREBASE_DATABASE_URL');
    process.exit(1);
  }
  
  if (!firebaseConfig.databaseURL || firebaseConfig.databaseURL === 'https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/') {
    console.warn('⚠️  Using default Firebase Database URL. If this is incorrect, set FIREBASE_DATABASE_URL environment variable.');
  }
  
  console.log('📡 Using Firebase Database URL:', firebaseConfig.databaseURL);
  console.log('✅ Using Firebase Client SDK with optimized parallel batch processing\n');
  
  try {
    // Initialize Firebase
    console.log('🔥 Initializing Firebase...');
    app = initializeApp(firebaseConfig);
    db = getDatabase(app, firebaseConfig.databaseURL);
    console.log('✅ Firebase initialized successfully\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    const migrationStartTime = Date.now();
    
    // Run migrations
    const results = {
      users: await migrateUsers(db),
      vehicles: await migrateVehicles(db),
      conversations: await migrateConversations(db),
      notifications: await migrateNotifications(db),
      vehicleData: await migrateVehicleData(db),
      newCars: await migrateNewCars(db),
      plans: await migratePlans(db),
      rateLimits: await migrateRateLimits(db),
    };
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Users:        ${results.users.migrated} migrated, ${results.users.skipped} skipped`);
    console.log(`Vehicles:     ${results.vehicles.migrated} migrated, ${results.vehicles.skipped} skipped`);
    console.log(`Conversations: ${results.conversations.migrated} migrated, ${results.conversations.skipped} skipped`);
    console.log(`Notifications: ${results.notifications.migrated} migrated, ${results.notifications.skipped} skipped`);
    console.log(`Vehicle Data: ${results.vehicleData.migrated} migrated, ${results.vehicleData.skipped} skipped`);
    console.log(`New Cars:     ${results.newCars.migrated} migrated, ${results.newCars.skipped} skipped`);
    console.log(`Plans:        ${results.plans.migrated} migrated, ${results.plans.skipped} skipped`);
    console.log(`Rate Limits:  ${results.rateLimits.migrated} migrated, ${results.rateLimits.skipped} skipped`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const totalMigrated = Object.values(results).reduce((sum, r) => sum + r.migrated, 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
    const totalTime = ((Date.now() - migrationStartTime) / 1000).toFixed(2);
    const avgRate = totalTime > 0 ? (totalMigrated / parseFloat(totalTime)).toFixed(1) : 0;
    
    console.log(`\n✅ Total: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    console.log(`⏱️  Total time: ${totalTime}s (${avgRate} items/sec)`);
    
    if (totalSkipped > 0 && totalMigrated === 0) {
      console.log('\n⚠️  All items were skipped! This usually means:');
      console.log('   1. Firebase security rules are blocking writes');
      console.log('   2. Go to: https://console.firebase.google.com/project/reride-ade6a/database/reride-ade6a-default-rtdb/rules');
      console.log('   3. Update rules to: {"rules": {".read": true, ".write": true}}');
      console.log('   4. Click Publish, then run migration again');
    } else if (totalMigrated > 0) {
      console.log('\n🎉 Migration complete!');
      console.log('⚠️  Remember to update Firebase security rules for production!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n📡 MongoDB connection closed');
  }
}

main();

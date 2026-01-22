/**
 * Migration script to move data from Firebase Realtime Database to Supabase
 * 
 * Usage:
 *   node scripts/migrate-firebase-to-supabase.js                    # Full migration
 *   node scripts/migrate-firebase-to-supabase.js --dry-run          # Test mode (no writes, skips storage)
 *   node scripts/migrate-firebase-to-supabase.js --dry-run --quick   # Fast dry-run (first 10 items per collection)
 *   node scripts/migrate-firebase-to-supabase.js --storage-only      # Migrate storage files only
 *   node scripts/migrate-firebase-to-supabase.js --skip-storage     # Skip storage migration
 *   node scripts/migrate-firebase-to-supabase.js --dry-run --include-storage  # Dry-run with storage check
 * 
 * IMPORTANT: Before running, make sure:
 *   1. Supabase tables are created (users, vehicles, conversations, etc.)
 *   2. Firebase environment variables are set (FIREBASE_*)
 *   3. Supabase environment variables are set (SUPABASE_*)
 *   4. SUPABASE_SERVICE_ROLE_KEY is set for admin operations
 * 
 * This script will:
 *   - Read all data from Firebase Realtime Database
 *   - Transform data to match Supabase table structure
 *   - Migrate Firebase Storage files to Supabase Storage
 *   - Insert data into Supabase tables
 *   - Handle errors gracefully and provide progress updates
 */

import { initializeApp } from 'firebase/app';
import { getStorage, ref as storageRef, listAll, getDownloadURL, getBytes } from 'firebase/storage';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import http from 'http';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const STORAGE_ONLY = args.includes('--storage-only');
const SKIP_STORAGE = args.includes('--skip-storage');
const QUICK_MODE = args.includes('--quick');
const QUICK_LIMIT = 10; // Limit items per collection in quick mode

if (DRY_RUN) {
  console.log('🧪 DRY-RUN MODE: No data will be written to Supabase\n');
  // Automatically skip storage in dry-run mode for faster execution
  if (!STORAGE_ONLY && !args.includes('--include-storage')) {
    console.log('💡 Storage migration skipped in dry-run mode (use --include-storage to enable)\n');
  }
}

if (QUICK_MODE) {
  console.log(`⚡ QUICK MODE: Only processing first ${QUICK_LIMIT} items per collection\n`);
}

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Firebase and Supabase clients
let firebaseApp;
let firebaseDb; // Firebase Admin Database (bypasses security rules)
let firebaseStorage;
let supabaseAdmin;

// Storage migration tracking
const storageMigrationMap = new Map(); // Maps Firebase URLs to Supabase URLs

// Optimized batch processing with controlled concurrency
async function processBatch(items, concurrency, processor, dryRun = false) {
  const results = { migrated: 0, skipped: 0, errors: [] };
  const startTime = Date.now();
  
  // Process in batches with controlled concurrency
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const promises = batch.map(item => processor(item, dryRun));
    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value === true) {
        results.migrated++;
      } else {
        results.skipped++;
        if (result.status === 'rejected') {
          const error = result.reason?.message || result.reason || 'Unknown error';
          results.errors.push({ item: batch[index], error });
          if (!dryRun) {
            console.error(`   ❌ Error: ${error}`);
          }
        }
      }
    });
    
    // Progress reporting
    const processed = Math.min(i + concurrency, items.length);
    if (processed % Math.max(50, Math.floor(items.length / 10)) === 0 || processed >= items.length) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 0) {
        const rate = processed / elapsed;
        const remaining = items.length - processed;
        const eta = remaining / rate;
        const mode = dryRun ? '[DRY-RUN] ' : '';
        console.log(`   ${mode}✅ Processed ${processed}/${items.length} (${rate.toFixed(1)} items/sec${remaining > 0 ? `, ETA: ${eta.toFixed(1)}s` : ''})...`);
      }
    }
  }
  
  return results;
}

// Helper to convert email to safe key
function emailToKey(email) {
  return email ? email.toLowerCase().trim().replace(/[.#$[\]]/g, '_') : null;
}

// Helper to limit entries in quick mode
function limitEntries(entries, collectionName) {
  if (QUICK_MODE && entries.length > QUICK_LIMIT) {
    console.log(`   Found ${entries.length} ${collectionName} (processing first ${QUICK_LIMIT} in quick mode)`);
    return entries.slice(0, QUICK_LIMIT);
  }
  console.log(`   Found ${entries.length} ${collectionName}`);
  return entries;
}

// Helper to get data from Firebase (works with both Admin SDK and Client SDK)
async function getFirebaseData(path) {
  // Check if using Admin SDK (has .ref method)
  if (firebaseDb && typeof firebaseDb.ref === 'function') {
    const ref = firebaseDb.ref(path);
    const snapshot = await ref.once('value');
    return snapshot.exists() ? snapshot.val() : null;
  }
  // Client SDK (has getDatabase imported)
  else if (firebaseDb) {
    const { ref } = await import('firebase/database');
    const { get } = await import('firebase/database');
    const dataRef = ref(firebaseDb, path);
    const snapshot = await get(dataRef);
    return snapshot.exists() ? snapshot.val() : null;
  }
  throw new Error('Firebase database not initialized');
}

// Helper to sanitize data for Supabase (remove null values, convert dates, etc.)
function sanitizeForSupabase(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip null/undefined values (Supabase handles defaults)
    if (value === null || value === undefined) continue;
    
    // Skip MongoDB-specific fields
    if (key === '_id' || key === '__v') continue;
    
    // Convert dates to ISO strings if needed
    if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => sanitizeForSupabase(item));
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForSupabase(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Helper to check if error is about missing column
function isColumnError(error) {
  const message = error?.message || '';
  return message.includes('column') && 
         (message.includes('not found') || 
          message.includes('does not exist') ||
          message.includes('Could not find'));
}

// Helper to upsert with fallback on column errors
async function upsertWithFallback(table, record, fallbackRecord, options = {}) {
  try {
    const { error } = await supabaseAdmin
      .from(table)
      .upsert(record, options);
    
    if (error) {
      // If it's a column error and we have a fallback, try again
      if (isColumnError(error) && fallbackRecord) {
        console.warn(`   ⚠️  Column error detected, retrying without problematic fields...`);
        const { error: fallbackError } = await supabaseAdmin
          .from(table)
          .upsert(fallbackRecord, options);
        
        if (fallbackError) {
          throw fallbackError;
        }
        return { success: true, usedFallback: true };
      }
      throw error;
    }
    return { success: true, usedFallback: false };
  } catch (error) {
    throw error;
  }
}

// Download file from URL and return as buffer
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Migrate a single file from Firebase Storage to Supabase Storage
async function migrateStorageFile(firebasePath, supabaseBucket = 'files', dryRun = false) {
  try {
    // Check if already migrated
    if (storageMigrationMap.has(firebasePath)) {
      return storageMigrationMap.get(firebasePath);
    }
    
    if (dryRun) {
      console.log(`   [DRY-RUN] Would migrate: ${firebasePath}`);
      return `supabase://${supabaseBucket}/${firebasePath}`;
    }
    
    // Get download URL from Firebase Storage
    const fileRef = storageRef(firebaseStorage, firebasePath);
    const downloadURL = await getDownloadURL(fileRef);
    
    // Download file
    const fileBuffer = await downloadFile(downloadURL);
    
    // Get file metadata
    const fileName = firebasePath.split('/').pop();
    const contentType = getContentType(fileName);
    
    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(supabaseBucket)
      .upload(firebasePath, fileBuffer, {
        contentType,
        upsert: true
      });
    
    if (error) {
      throw error;
    }
    
    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(supabaseBucket)
      .getPublicUrl(firebasePath);
    
    const supabaseUrl = urlData.publicUrl;
    storageMigrationMap.set(firebasePath, supabaseUrl);
    
    return supabaseUrl;
  } catch (error) {
    console.error(`   ❌ Error migrating file ${firebasePath}:`, error.message);
    return null;
  }
}

// Get content type from file extension
function getContentType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const types = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    json: 'application/json',
  };
  return types[ext] || 'application/octet-stream';
}

// Migrate all files from Firebase Storage
async function migrateStorageFiles(dryRun = false) {
  if (SKIP_STORAGE || !firebaseStorage) {
    console.log('\n📁 Skipping Storage Migration (not configured or skipped)');
    return { migrated: 0, skipped: 0, errors: [] };
  }
  
  console.log('\n📁 Migrating Firebase Storage Files...');
  
  try {
    const folders = ['vehicles', 'users', 'images'];
    let totalMigrated = 0;
    let totalSkipped = 0;
    const errors = [];
    
    for (const folder of folders) {
      try {
        console.log(`   📂 Processing folder: ${folder}/`);
        const folderRef = storageRef(firebaseStorage, folder);
        const { items } = await listAll(folderRef);
        
        console.log(`   Found ${items.length} files in ${folder}/`);
        
        for (const item of items) {
          try {
            const firebasePath = item.fullPath;
            const supabaseUrl = await migrateStorageFile(firebasePath, 'files', dryRun);
            
            if (supabaseUrl) {
              totalMigrated++;
            } else {
              totalSkipped++;
            }
          } catch (error) {
            totalSkipped++;
            errors.push({ path: item.fullPath, error: error.message });
          }
        }
      } catch (error) {
        console.warn(`   ⚠️  Could not process folder ${folder}/:`, error.message);
      }
    }
    
    console.log(`   ✅ Storage migration complete: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    return { migrated: totalMigrated, skipped: totalSkipped, errors };
  } catch (error) {
    console.error('   ❌ Error migrating storage files:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Migrate Users with improved mapping
async function migrateUsers(dryRun = false) {
  console.log('\n📦 Migrating Users...');
  
  try {
    const users = await getFirebaseData('users');
    
    if (!users) {
      console.log('   ℹ️  No users found in Firebase');
      return { migrated: 0, skipped: 0, errors: [] };
    }
    const userEntries = limitEntries(Object.entries(users), 'users');
    
    const results = await processBatch(userEntries, 20, async ([key, userData], isDryRun) => {
      try {
        const sanitized = sanitizeForSupabase(userData);
        
        // Ensure email exists (required field)
        if (!sanitized.email) {
          if (!isDryRun) console.warn(`   ⚠️  Skipping user ${key}: missing email`);
          return false;
        }
        
        // Use email as primary key or keep Firebase key
        const userId = sanitized.id || key;
        
        // Migrate avatar URL if it's a Firebase Storage URL
        let avatarUrl = sanitized.avatarUrl || null;
        if (avatarUrl && avatarUrl.includes('firebasestorage') && !isDryRun) {
          try {
            const migratedUrl = await migrateStorageFile(`users/${userId}/avatar`, 'files', isDryRun);
            if (migratedUrl) avatarUrl = migratedUrl;
          } catch (e) {
            // Keep original URL if migration fails
          }
        }
        
        // Migrate logo URL if it's a Firebase Storage URL
        let logoUrl = sanitized.logoUrl || null;
        if (logoUrl && logoUrl.includes('firebasestorage') && !isDryRun) {
          try {
            const migratedUrl = await migrateStorageFile(`users/${userId}/logo`, 'files', isDryRun);
            if (migratedUrl) logoUrl = migratedUrl;
          } catch (e) {
            // Keep original URL if migration fails
          }
        }
        
        const userRecord = {
          id: userId,
          email: sanitized.email.toLowerCase().trim(),
          name: sanitized.name || '',
          mobile: sanitized.mobile || null,
          role: sanitized.role || 'customer',
          status: sanitized.status || 'active',
          avatar_url: avatarUrl,
          is_verified: sanitized.isVerified || false,
          dealership_name: sanitized.dealershipName || null,
          bio: sanitized.bio || null,
          logo_url: logoUrl,
          subscription_plan: sanitized.subscriptionPlan || 'free',
          featured_credits: sanitized.featuredCredits || 0,
          used_certifications: sanitized.usedCertifications || 0,
          phone_verified: sanitized.phoneVerified || false,
          email_verified: sanitized.emailVerified || false,
          govt_id_verified: sanitized.govtIdVerified || false,
          trust_score: sanitized.trustScore || null,
          location: sanitized.location || null,
          firebase_uid: sanitized.firebaseUid || null,
          auth_provider: sanitized.authProvider || 'email',
          created_at: sanitized.createdAt || new Date().toISOString(),
          updated_at: sanitized.updatedAt || new Date().toISOString(),
          // Additional fields stored in metadata JSONB
          metadata: {
            averageRating: sanitized.averageRating,
            ratingCount: sanitized.ratingCount,
            badges: sanitized.badges,
            responseTime: sanitized.responseTime,
            responseRate: sanitized.responseRate,
            joinedDate: sanitized.joinedDate,
            lastActiveAt: sanitized.lastActiveAt,
            activeListings: sanitized.activeListings,
            soldListings: sanitized.soldListings,
            totalViews: sanitized.totalViews,
            reportedCount: sanitized.reportedCount,
            isBanned: sanitized.isBanned,
            alternatePhone: sanitized.alternatePhone,
            preferredContactHours: sanitized.preferredContactHours,
            showEmailPublicly: sanitized.showEmailPublicly,
            partnerBanks: sanitized.partnerBanks,
            verificationStatus: sanitized.verificationStatus,
            aadharCard: sanitized.aadharCard,
            panCard: sanitized.panCard,
            planActivatedDate: sanitized.planActivatedDate,
            planExpiryDate: sanitized.planExpiryDate,
            pendingPlanUpgrade: sanitized.pendingPlanUpgrade,
          }
        };
        
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would migrate user: ${userRecord.email}`);
          return true;
        }
        
        // Insert or update user in Supabase
        const { error } = await supabaseAdmin
          .from('users')
          .upsert(userRecord, {
            onConflict: 'email',
            ignoreDuplicates: false
          });
        
        if (error) {
          throw error;
        }
        
        return true;
      } catch (error) {
        if (!isDryRun) {
          console.error(`   ❌ Error migrating user ${key}:`, error.message);
        }
        return false;
      }
    }, dryRun);
    
    console.log(`   ✅ Users migration complete: ${results.migrated} migrated, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    console.error('   ❌ Error reading users from Firebase:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Migrate Vehicles with improved mapping
async function migrateVehicles(dryRun = false) {
  console.log('\n🚗 Migrating Vehicles...');
  
  try {
    const vehicles = await getFirebaseData('vehicles');
    
    if (!vehicles) {
      console.log('   ℹ️  No vehicles found in Firebase');
      return { migrated: 0, skipped: 0, errors: [] };
    }
    const vehicleEntries = limitEntries(Object.entries(vehicles), 'vehicles');
    
    const results = await processBatch(vehicleEntries, 30, async ([key, vehicleData], isDryRun) => {
      try {
        const sanitized = sanitizeForSupabase(vehicleData);
        
        // Ensure required fields exist
        if (!sanitized.id && !key) {
          if (!isDryRun) console.warn(`   ⚠️  Skipping vehicle: missing ID`);
          return false;
        }
        
        const vehicleId = sanitized.id || key;
        
        // Migrate vehicle images
        let images = sanitized.images || [];
        if (Array.isArray(images) && images.length > 0 && !isDryRun) {
          const migratedImages = [];
          for (let i = 0; i < images.length; i++) {
            const imageUrl = images[i];
            if (imageUrl && imageUrl.includes('firebasestorage')) {
              try {
                const migratedUrl = await migrateStorageFile(`vehicles/${vehicleId}/image_${i}`, 'files', isDryRun);
                if (migratedUrl) {
                  migratedImages.push(migratedUrl);
                } else {
                  migratedImages.push(imageUrl); // Keep original if migration fails
                }
              } catch (e) {
                migratedImages.push(imageUrl); // Keep original if migration fails
              }
            } else {
              migratedImages.push(imageUrl); // Keep non-Firebase URLs as-is
            }
          }
          images = migratedImages;
        }
        
        const vehicleRecord = {
          id: vehicleId,
          category: sanitized.category || null,
          make: sanitized.make || '',
          model: sanitized.model || '',
          variant: sanitized.variant || null,
          year: sanitized.year || null,
          price: sanitized.price || 0,
          mileage: sanitized.mileage || null,
          images: images,
          features: sanitized.features || [],
          description: sanitized.description || null,
          seller_email: sanitized.sellerEmail || null,
          seller_name: sanitized.sellerName || null,
          engine: sanitized.engine || null,
          transmission: sanitized.transmission || null,
          fuel_type: sanitized.fuelType || null,
          fuel_efficiency: sanitized.fuelEfficiency || null,
          color: sanitized.color || null,
          status: sanitized.status || 'published',
          is_featured: sanitized.isFeatured || false,
          views: sanitized.views || 0,
          inquiries_count: sanitized.inquiriesCount || 0,
          registration_year: sanitized.registrationYear || null,
          insurance_validity: sanitized.insuranceValidity || null,
          insurance_type: sanitized.insuranceType || null,
          rto: sanitized.rto || null,
          city: sanitized.city || null,
          state: sanitized.state || null,
          no_of_owners: sanitized.noOfOwners || null,
          displacement: sanitized.displacement || null,
          ground_clearance: sanitized.groundClearance || null,
          boot_space: sanitized.bootSpace || null,
          created_at: sanitized.createdAt || new Date().toISOString(),
          updated_at: sanitized.updatedAt || new Date().toISOString(),
          // Note: metadata column removed - add it to Supabase schema if needed
          // metadata: {
          //   certificationStatus: sanitized.certificationStatus,
          //   certifiedInspection: sanitized.certifiedInspection,
          //   videoUrl: sanitized.videoUrl,
          //   serviceRecords: sanitized.serviceRecords,
          //   accidentHistory: sanitized.accidentHistory,
          // }
        };
        
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would migrate vehicle: ${vehicleRecord.make} ${vehicleRecord.model} (ID: ${vehicleId})`);
          return true;
        }
        
        // Insert or update vehicle in Supabase
        const { error } = await supabaseAdmin
          .from('vehicles')
          .upsert(vehicleRecord, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
        
        if (error) {
          throw error;
        }
        
        return true;
      } catch (error) {
        if (!isDryRun) {
          console.error(`   ❌ Error migrating vehicle ${key}:`, error.message);
        }
        return false;
      }
    }, dryRun);
    
    console.log(`   ✅ Vehicles migration complete: ${results.migrated} migrated, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    console.error('   ❌ Error reading vehicles from Firebase:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Migrate Conversations with improved mapping
async function migrateConversations(dryRun = false) {
  console.log('\n💬 Migrating Conversations...');
  
  try {
    const conversations = await getFirebaseData('conversations');
    
    if (!conversations) {
      console.log('   ℹ️  No conversations found in Firebase');
      return { migrated: 0, skipped: 0, errors: [] };
    }
    const conversationEntries = limitEntries(Object.entries(conversations), 'conversations');
    
    const results = await processBatch(conversationEntries, 30, async ([key, convData], isDryRun) => {
      try {
        const sanitized = sanitizeForSupabase(convData);
        
        const conversationId = sanitized.id || key;
        
        const conversationRecord = {
          id: conversationId,
          customer_id: sanitized.customerId || null,
          seller_id: sanitized.sellerId || null,
          vehicle_id: sanitized.vehicleId || null,
          customer_name: sanitized.customerName || null,
          seller_name: sanitized.sellerName || null,
          vehicle_name: sanitized.vehicleName || null,
          vehicle_price: sanitized.vehiclePrice || null,
          last_message: sanitized.lastMessage || null,
          last_message_at: sanitized.lastMessageAt || sanitized.lastMessageAt || null,
          is_read_by_seller: sanitized.isReadBySeller || false,
          is_read_by_customer: sanitized.isReadByCustomer || true,
          is_flagged: sanitized.isFlagged || false,
          flag_reason: sanitized.flagReason || null,
          flagged_at: sanitized.flaggedAt || null,
          created_at: sanitized.createdAt || new Date().toISOString(),
          updated_at: sanitized.updatedAt || new Date().toISOString(),
          // Store messages array in metadata
          metadata: {
            messages: sanitized.messages || [],
          }
        };
        
        // Create fallback record without flagged_at (in case column doesn't exist)
        const conversationRecordFallback = { ...conversationRecord };
        delete conversationRecordFallback.flagged_at;
        
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would migrate conversation: ${conversationId}`);
          return true;
        }
        
        const result = await upsertWithFallback(
          'conversations',
          conversationRecord,
          conversationRecordFallback,
          {
            onConflict: 'id',
            ignoreDuplicates: false
          }
        );
        
        if (!result.success) {
          throw new Error('Failed to upsert conversation');
        }
        
        return true;
      } catch (error) {
        if (!isDryRun) {
          if (isColumnError(error)) {
            console.error(`   ❌ Error migrating conversation ${key}: ${error.message}`);
            console.error(`   💡 Tip: Run scripts/fix-supabase-schema-migration.sql to add missing columns`);
          } else {
            console.error(`   ❌ Error migrating conversation ${key}:`, error.message);
            // Log full error details for debugging
            if (error.details) {
              console.error(`   Details:`, error.details);
            }
            if (error.hint) {
              console.error(`   Hint:`, error.hint);
            }
          }
        }
        return false;
      }
    }, dryRun);
    
    console.log(`   ✅ Conversations migration complete: ${results.migrated} migrated, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    console.error('   ❌ Error reading conversations from Firebase:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Migrate Notifications
async function migrateNotifications(dryRun = false) {
  console.log('\n🔔 Migrating Notifications...');
  
  try {
    const notifications = await getFirebaseData('notifications');
    
    if (!notifications) {
      console.log('   ℹ️  No notifications found in Firebase');
      return { migrated: 0, skipped: 0, errors: [] };
    }
    const notificationEntries = limitEntries(Object.entries(notifications), 'notifications');
    
    const results = await processBatch(notificationEntries, 30, async ([key, notifData], isDryRun) => {
      try {
        const sanitized = sanitizeForSupabase(notifData);
        
        const notificationId = sanitized.id || key;
        
        const notificationRecord = {
          id: notificationId,
          user_id: sanitized.userId || sanitized.user_id || null,
          type: sanitized.type || null,
          title: sanitized.title || null,
          message: sanitized.message || sanitized.body || null,
          read: sanitized.read || false,
          created_at: sanitized.createdAt || sanitized.created_at || new Date().toISOString(),
          metadata: sanitized
        };
        
        // Create fallback record without metadata (in case column doesn't exist)
        const notificationRecordFallback = { ...notificationRecord };
        delete notificationRecordFallback.metadata;
        
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would migrate notification: ${notificationId}`);
          return true;
        }
        
        const result = await upsertWithFallback(
          'notifications',
          notificationRecord,
          notificationRecordFallback,
          {
            onConflict: 'id',
            ignoreDuplicates: false
          }
        );
        
        if (!result.success) {
          throw new Error('Failed to upsert notification');
        }
        
        return true;
      } catch (error) {
        if (!isDryRun) {
          if (isColumnError(error)) {
            console.error(`   ❌ Error migrating notification ${key}: ${error.message}`);
            console.error(`   💡 Tip: Run scripts/fix-supabase-schema-migration.sql to add missing columns`);
          } else {
            console.error(`   ❌ Error migrating notification ${key}:`, error.message);
            // Log full error details for debugging
            if (error.details) {
              console.error(`   Details:`, error.details);
            }
            if (error.hint) {
              console.error(`   Hint:`, error.hint);
            }
          }
        }
        return false;
      }
    }, dryRun);
    
    console.log(`   ✅ Notifications migration complete: ${results.migrated} migrated, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    console.error('   ❌ Error reading notifications from Firebase:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Migrate New Cars
async function migrateNewCars(dryRun = false) {
  console.log('\n🚙 Migrating New Cars...');
  
  try {
    const newCars = await getFirebaseData('newCars');
    
    if (!newCars) {
      console.log('   ℹ️  No new cars found in Firebase');
      return { migrated: 0, skipped: 0, errors: [] };
    }
    const newCarEntries = limitEntries(Object.entries(newCars), 'new cars');
    
    const results = await processBatch(newCarEntries, 30, async ([key, carData], isDryRun) => {
      try {
        const sanitized = sanitizeForSupabase(carData);
        
        const carId = sanitized.id || key;
        
        const carRecord = {
          id: carId,
          brand_name: sanitized.brand_name || sanitized.brandName || null,
          model_name: sanitized.model_name || sanitized.modelName || null,
          model_year: sanitized.model_year || sanitized.modelYear || null,
          price: sanitized.price || null,
          images: sanitized.images || [],
          features: sanitized.features || [],
          description: sanitized.description || null,
          created_at: sanitized.createdAt || new Date().toISOString(),
          updated_at: sanitized.updatedAt || new Date().toISOString(),
          metadata: sanitized
        };
        
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would migrate new car: ${carRecord.brand_name} ${carRecord.model_name}`);
          return true;
        }
        
        const { error } = await supabaseAdmin
          .from('new_cars')
          .upsert(carRecord, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
        
        if (error) {
          throw error;
        }
        
        return true;
      } catch (error) {
        if (!isDryRun) {
          console.error(`   ❌ Error migrating new car ${key}:`, error.message);
        }
        return false;
      }
    }, dryRun);
    
    console.log(`   ✅ New Cars migration complete: ${results.migrated} migrated, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    console.error('   ❌ Error reading new cars from Firebase:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Migrate Plans
async function migratePlans(dryRun = false) {
  console.log('\n💳 Migrating Plans...');
  
  try {
    const plans = await getFirebaseData('plans');
    
    if (!plans) {
      console.log('   ℹ️  No plans found in Firebase');
      return { migrated: 0, skipped: 0, errors: [] };
    }
    const planEntries = limitEntries(Object.entries(plans), 'plans');
    
    const results = await processBatch(planEntries, 30, async ([key, planData], isDryRun) => {
      try {
        const sanitized = sanitizeForSupabase(planData);
        
        const planId = sanitized.planId || sanitized.id || key;
        
        const planRecord = {
          id: planId,
          name: sanitized.name || null,
          price: sanitized.price || 0,
          duration: sanitized.duration || null,
          features: sanitized.features || [],
          created_at: sanitized.createdAt || new Date().toISOString(),
          updated_at: sanitized.updatedAt || new Date().toISOString(),
          metadata: sanitized
        };
        
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would migrate plan: ${planRecord.name || planId}`);
          return true;
        }
        
        const { error } = await supabaseAdmin
          .from('plans')
          .upsert(planRecord, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
        
        if (error) {
          throw error;
        }
        
        return true;
      } catch (error) {
        if (!isDryRun) {
          console.error(`   ❌ Error migrating plan ${key}:`, error.message);
        }
        return false;
      }
    }, dryRun);
    
    console.log(`   ✅ Plans migration complete: ${results.migrated} migrated, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    console.error('   ❌ Error reading plans from Firebase:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Migrate Service Providers
async function migrateServiceProviders(dryRun = false) {
  console.log('\n🔧 Migrating Service Providers...');
  
  try {
    const providers = await getFirebaseData('serviceProviders');
    
    if (!providers) {
      console.log('   ℹ️  No service providers found in Firebase');
      return { migrated: 0, skipped: 0, errors: [] };
    }
    const providerEntries = limitEntries(Object.entries(providers), 'service providers');
    
    const results = await processBatch(providerEntries, 30, async ([key, providerData], isDryRun) => {
      try {
        const sanitized = sanitizeForSupabase(providerData);
        
        const providerId = sanitized.id || key;
        
        const providerRecord = {
          id: providerId,
          name: sanitized.name || null,
          email: sanitized.email || null,
          phone: sanitized.phone || null,
          location: sanitized.location || null,
          services: sanitized.services || [],
          rating: sanitized.rating || null,
          created_at: sanitized.createdAt || new Date().toISOString(),
          updated_at: sanitized.updatedAt || new Date().toISOString(),
          metadata: sanitized
        };
        
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would migrate service provider: ${providerRecord.name || providerId}`);
          return true;
        }
        
        const { error } = await supabaseAdmin
          .from('service_providers')
          .upsert(providerRecord, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
        
        if (error) {
          throw error;
        }
        
        return true;
      } catch (error) {
        if (!isDryRun) {
          if (isColumnError(error) || error.message.includes('table') || error.message.includes('does not exist')) {
            console.error(`   ❌ Error migrating service provider ${key}: ${error.message}`);
            console.error(`   💡 Tip: Run scripts/fix-supabase-schema-migration.sql to create missing tables`);
          } else {
            console.error(`   ❌ Error migrating service provider ${key}:`, error.message);
          }
        }
        return false;
      }
    }, dryRun);
    
    console.log(`   ✅ Service Providers migration complete: ${results.migrated} migrated, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    console.error('   ❌ Error reading service providers from Firebase:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Migrate Service Requests
async function migrateServiceRequests(dryRun = false) {
  console.log('\n📋 Migrating Service Requests...');
  
  try {
    const requests = await getFirebaseData('serviceRequests');
    
    if (!requests) {
      console.log('   ℹ️  No service requests found in Firebase');
      return { migrated: 0, skipped: 0, errors: [] };
    }
    const requestEntries = limitEntries(Object.entries(requests), 'service requests');
    
    const results = await processBatch(requestEntries, 30, async ([key, requestData], isDryRun) => {
      try {
        const sanitized = sanitizeForSupabase(requestData);
        
        const requestId = sanitized.id || key;
        
        const requestRecord = {
          id: requestId,
          user_id: sanitized.userId || sanitized.user_id || null,
          provider_id: sanitized.providerId || sanitized.provider_id || null,
          service_type: sanitized.serviceType || sanitized.service_type || null,
          status: sanitized.status || 'pending',
          created_at: sanitized.createdAt || new Date().toISOString(),
          updated_at: sanitized.updatedAt || new Date().toISOString(),
          metadata: sanitized
        };
        
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would migrate service request: ${requestId}`);
          return true;
        }
        
        const { error } = await supabaseAdmin
          .from('service_requests')
          .upsert(requestRecord, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
        
        if (error) {
          throw error;
        }
        
        return true;
      } catch (error) {
        if (!isDryRun) {
          console.error(`   ❌ Error migrating service request ${key}:`, error.message);
        }
        return false;
      }
    }, dryRun);
    
    console.log(`   ✅ Service Requests migration complete: ${results.migrated} migrated, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    console.error('   ❌ Error reading service requests from Firebase:', error);
    return { migrated: 0, skipped: 0, errors: [error.message] };
  }
}

// Main migration function
async function main() {
  console.log('🚀 Starting Firebase to Supabase Migration\n');
  
  if (DRY_RUN) {
    console.log('🧪 DRY-RUN MODE: No data will be written to Supabase\n');
  }
  
  if (STORAGE_ONLY) {
    console.log('📁 STORAGE-ONLY MODE: Only migrating storage files\n');
  }
  
  // Validate Firebase configuration
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
  };
  
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.databaseURL) {
    console.error('❌ Firebase configuration is missing required fields!');
    console.error('   Required: FIREBASE_API_KEY (or VITE_FIREBASE_API_KEY)');
    console.error('   Required: FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID)');
    console.error('   Required: FIREBASE_DATABASE_URL (or VITE_FIREBASE_DATABASE_URL)');
    process.exit(1);
  }
  
  // Validate Supabase configuration (only if not storage-only)
  if (!STORAGE_ONLY) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase configuration is missing required fields!');
      console.error('   Required: SUPABASE_URL (or VITE_SUPABASE_URL)');
      console.error('   Required: SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }
    
    console.log('📡 Using Supabase URL:', supabaseUrl);
  }
  
  console.log('📡 Using Firebase Database URL:', firebaseConfig.databaseURL);
  if (firebaseConfig.storageBucket) {
    console.log('📡 Using Firebase Storage Bucket:', firebaseConfig.storageBucket);
  }
  console.log('✅ Configuration validated\n');
  
  try {
    // Initialize Firebase Admin SDK for database (bypasses security rules)
    console.log('🔥 Initializing Firebase Admin SDK...');
    
    // Check if Firebase Admin is already initialized
    if (!admin.apps.length) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      
      if (!serviceAccountJson) {
        console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY is not set!');
        console.warn('   Falling back to Firebase Client SDK (may encounter permission errors).');
        console.warn('   For best results, set FIREBASE_SERVICE_ACCOUNT_KEY in your .env.local file.');
        console.warn('   You can get it from: Firebase Console → Project Settings → Service Accounts');
        console.warn('   Proceeding with Client SDK...\n');
        
        // Fall back to Client SDK
        firebaseApp = initializeApp(firebaseConfig);
        const { getDatabase } = await import('firebase/database');
        firebaseDb = getDatabase(firebaseApp, firebaseConfig.databaseURL);
        
        if (firebaseConfig.storageBucket) {
          const { getStorage } = await import('firebase/storage');
          firebaseStorage = getStorage(firebaseApp);
        }
        
        console.log('✅ Firebase Client SDK initialized (limited access)\n');
      } else {
        try {
          // Strip outer quotes if present
          let cleanedJson = serviceAccountJson.trim();
          if ((cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) ||
              (cleanedJson.startsWith("'") && cleanedJson.endsWith("'"))) {
            cleanedJson = cleanedJson.slice(1, -1);
            cleanedJson = cleanedJson.replace(/\\"/g, '"').replace(/\\'/g, "'");
          }
          
          const serviceAccount = JSON.parse(cleanedJson);
          
          if (!serviceAccount.private_key || !serviceAccount.client_email) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY missing required fields (private_key, client_email)');
          }
          
          const databaseURL = firebaseConfig.databaseURL || 
                            `https://${serviceAccount.project_id || 'default'}.firebaseio.com`;
          const cleanDatabaseURL = databaseURL.endsWith('/') ? databaseURL.slice(0, -1) : databaseURL;
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: cleanDatabaseURL,
          });
          
          console.log('✅ Firebase Admin SDK initialized');
          
          // Get Firebase Admin Database instance
          firebaseDb = admin.database();
        } catch (error) {
          console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
          if (error instanceof SyntaxError) {
            console.error('   Make sure FIREBASE_SERVICE_ACCOUNT_KEY contains valid JSON');
          }
          process.exit(1);
        }
      }
    } else {
      // Admin SDK already initialized
      firebaseDb = admin.database();
    }
    
    // Initialize Firebase Client SDK for Storage (Admin SDK Storage is more complex)
    if (firebaseConfig.storageBucket && !firebaseStorage) {
      console.log('📁 Initializing Firebase Storage (Client SDK)...');
      if (!firebaseApp) {
        firebaseApp = initializeApp(firebaseConfig);
      }
      const { getStorage } = await import('firebase/storage');
      firebaseStorage = getStorage(firebaseApp);
      console.log('✅ Firebase Storage initialized');
    }
    
    console.log('✅ Firebase initialized successfully\n');
    
    // Initialize Supabase Admin Client (only if not storage-only)
    if (!STORAGE_ONLY) {
      console.log('🔐 Initializing Supabase Admin Client...');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log('✅ Supabase Admin Client initialized successfully\n');
    }
    
    const migrationStartTime = Date.now();
    
    // Run migrations
    let results = {};
    
    if (STORAGE_ONLY) {
      // Only migrate storage files
      results.storage = await migrateStorageFiles(DRY_RUN);
    } else {
      // Migrate database tables
      // Skip storage in dry-run mode unless explicitly requested
      if (!SKIP_STORAGE && (!DRY_RUN || args.includes('--include-storage'))) {
        results.storage = await migrateStorageFiles(DRY_RUN);
      } else if (DRY_RUN && !SKIP_STORAGE) {
        console.log('\n📁 Skipping Storage Migration (auto-skipped in dry-run mode)\n');
        results.storage = { migrated: 0, skipped: 0, errors: [] };
      }
      
      results.users = await migrateUsers(DRY_RUN);
      results.vehicles = await migrateVehicles(DRY_RUN);
      results.conversations = await migrateConversations(DRY_RUN);
      results.notifications = await migrateNotifications(DRY_RUN);
      results.newCars = await migrateNewCars(DRY_RUN);
      results.plans = await migratePlans(DRY_RUN);
      results.serviceProviders = await migrateServiceProviders(DRY_RUN);
      results.serviceRequests = await migrateServiceRequests(DRY_RUN);
    }
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (results.storage) {
      console.log(`Storage Files:     ${results.storage.migrated} migrated, ${results.storage.skipped} skipped`);
    }
    if (results.users) {
      console.log(`Users:            ${results.users.migrated} migrated, ${results.users.skipped} skipped`);
    }
    if (results.vehicles) {
      console.log(`Vehicles:         ${results.vehicles.migrated} migrated, ${results.vehicles.skipped} skipped`);
    }
    if (results.conversations) {
      console.log(`Conversations:    ${results.conversations.migrated} migrated, ${results.conversations.skipped} skipped`);
    }
    if (results.notifications) {
      console.log(`Notifications:    ${results.notifications.migrated} migrated, ${results.notifications.skipped} skipped`);
    }
    if (results.newCars) {
      console.log(`New Cars:         ${results.newCars.migrated} migrated, ${results.newCars.skipped} skipped`);
    }
    if (results.plans) {
      console.log(`Plans:            ${results.plans.migrated} migrated, ${results.plans.skipped} skipped`);
    }
    if (results.serviceProviders) {
      console.log(`Service Providers: ${results.serviceProviders.migrated} migrated, ${results.serviceProviders.skipped} skipped`);
    }
    if (results.serviceRequests) {
      console.log(`Service Requests:  ${results.serviceRequests.migrated} migrated, ${results.serviceRequests.skipped} skipped`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const totalMigrated = Object.values(results).reduce((sum, r) => sum + (r.migrated || 0), 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + (r.skipped || 0), 0);
    const totalTime = ((Date.now() - migrationStartTime) / 1000).toFixed(2);
    const avgRate = totalTime > 0 ? (totalMigrated / parseFloat(totalTime)).toFixed(1) : 0;
    
    console.log(`\n✅ Total: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    console.log(`⏱️  Total time: ${totalTime}s (${avgRate} items/sec)`);
    
    if (DRY_RUN) {
      console.log('\n🧪 DRY-RUN complete! Run without --dry-run to perform actual migration.');
    } else if (totalSkipped > 0 && totalMigrated === 0) {
      console.log('\n⚠️  All items were skipped! This usually means:');
      console.log('   1. Supabase tables don\'t exist or have wrong schema');
      console.log('   2. Check Supabase dashboard to verify table structure');
      console.log('   3. Ensure RLS policies allow service_role key to insert');
    } else if (totalMigrated > 0) {
      console.log('\n🎉 Migration complete!');
      console.log('💡 Next steps:');
      console.log('   1. Verify data in Supabase dashboard');
      console.log('   2. Configure Row Level Security (RLS) policies');
      console.log('   3. Update your application to use Supabase instead of Firebase');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

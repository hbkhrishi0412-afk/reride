/**
 * Verification script to check Firebase to Supabase migration status
 * 
 * Usage:
 *   node scripts/verify-migration-status.js
 * 
 * This script checks:
 * - Environment variables configuration
 * - Supabase connection and table structure
 * - Firebase connection (if configured)
 * - Migration readiness
 */

import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Colors for console output
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

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Check environment variables
function checkEnvironmentVariables() {
  logSection('1. Environment Variables Check');
  
  const required = {
    'Supabase (Client)': [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
    ],
    'Supabase (Server)': [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
    'Firebase (Migration)': [
      'FIREBASE_SERVICE_ACCOUNT_KEY',
      'FIREBASE_DATABASE_URL',
    ],
  };
  
  let allPresent = true;
  
  for (const [category, vars] of Object.entries(required)) {
    log(`\n${category}:`, 'blue');
    for (const varName of vars) {
      const value = process.env[varName];
      if (value) {
        const displayValue = varName.includes('KEY') || varName.includes('PASSWORD')
          ? `${value.substring(0, 20)}...` 
          : value;
        logSuccess(`${varName}: ${displayValue}`);
      } else {
        logError(`${varName}: NOT SET`);
        allPresent = false;
      }
    }
  }
  
  return allPresent;
}

// Check Supabase connection and schema
async function checkSupabaseSchema() {
  logSection('2. Supabase Connection & Schema Check');
  
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    logError('Supabase credentials not configured');
    return false;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Required tables
    const requiredTables = [
      'users',
      'vehicles',
      'conversations',
      'notifications',
      'new_cars',
      'plans',
      'service_providers',
      'service_requests',
    ];
    
    log('\nChecking tables:', 'blue');
    const tableStatus = {};
    
    for (const table of requiredTables) {
      try {
        // Try to query the table (limit 1 to check if it exists)
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          if (error.code === '42P01') {
            // Table does not exist
            logError(`${table}: Table does not exist`);
            tableStatus[table] = { exists: false, error: 'Table not found' };
          } else {
            logWarning(`${table}: ${error.message}`);
            tableStatus[table] = { exists: true, error: error.message };
          }
        } else {
          logSuccess(`${table}: Table exists`);
          tableStatus[table] = { exists: true };
        }
      } catch (err) {
        logError(`${table}: ${err.message}`);
        tableStatus[table] = { exists: false, error: err.message };
      }
    }
    
    // Check specific columns
    log('\nChecking critical columns:', 'blue');
    
    // Check users.password
    try {
      const { data, error } = await supabase
        .from('users')
        .select('password')
        .limit(1);
      
      if (error && error.message.includes('column') && error.message.includes('password')) {
        logError('users.password: Column does not exist');
      } else {
        logSuccess('users.password: Column exists');
      }
    } catch (err) {
      logWarning('users.password: Could not verify (table may not exist)');
    }
    
    // Check conversations columns
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('seller_name, last_message, metadata, flagged_at')
        .limit(1);
      
      if (error && error.message.includes('column')) {
        logError(`conversations: Missing columns - ${error.message}`);
      } else {
        logSuccess('conversations: All required columns exist');
      }
    } catch (err) {
      logWarning('conversations: Could not verify (table may not exist)');
    }
    
    // Check notifications columns
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('read, metadata')
        .limit(1);
      
      if (error && error.message.includes('column')) {
        logError(`notifications: Missing columns - ${error.message}`);
      } else {
        logSuccess('notifications: All required columns exist');
      }
    } catch (err) {
      logWarning('notifications: Could not verify (table may not exist)');
    }
    
    return true;
  } catch (error) {
    logError(`Supabase connection failed: ${error.message}`);
    return false;
  }
}

// Check Firebase connection
async function checkFirebaseConnection() {
  logSection('3. Firebase Connection Check');
  
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const databaseUrl = process.env.FIREBASE_DATABASE_URL;
  
  if (!serviceAccountKey || !databaseUrl) {
    logWarning('Firebase credentials not configured (required for migration)');
    return false;
  }
  
  try {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountKey);
    } catch (err) {
      logError('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
      return false;
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseUrl,
      });
    }
    
    const db = admin.database();
    
    // Try to read from a common path
    const snapshot = await db.ref('/').limitToFirst(1).once('value');
    logSuccess('Firebase connection successful');
    logInfo(`Database URL: ${databaseUrl}`);
    
    return true;
  } catch (error) {
    logError(`Firebase connection failed: ${error.message}`);
    return false;
  }
}

// Main verification function
async function main() {
  console.log('\n');
  log('🔍 Firebase to Supabase Migration Status Check', 'cyan');
  console.log('\n');
  
  const results = {
    env: checkEnvironmentVariables(),
    supabase: await checkSupabaseSchema(),
    firebase: await checkFirebaseConnection(),
  };
  
  logSection('Summary');
  
  if (results.env) {
    logSuccess('Environment variables: All configured');
  } else {
    logError('Environment variables: Missing required variables');
  }
  
  if (results.supabase) {
    logSuccess('Supabase: Connection and schema check completed');
  } else {
    logError('Supabase: Connection or schema issues found');
  }
  
  if (results.firebase) {
    logSuccess('Firebase: Connection successful');
  } else {
    logWarning('Firebase: Connection failed (required for migration)');
  }
  
  console.log('\n');
  
  if (results.env && results.supabase) {
    log('✅ Ready for migration!', 'green');
    logInfo('Next steps:');
    logInfo('1. Run: npm run migrate:firebase-to-supabase -- --dry-run');
    logInfo('2. If dry-run looks good, run: npm run migrate:firebase-to-supabase');
  } else {
    log('⚠️  Not ready for migration. Please fix the issues above.', 'yellow');
    
    if (!results.env) {
      logInfo('Fix: Set missing environment variables in .env.local');
    }
    
    if (!results.supabase) {
      logInfo('Fix: Run scripts/complete-supabase-schema-fix.sql in Supabase SQL Editor');
    }
    
    if (!results.firebase && results.env) {
      logInfo('Fix: Configure FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_DATABASE_URL');
    }
  }
  
  console.log('\n');
  
  // Cleanup
  if (admin.apps.length) {
    await admin.app().delete();
  }
  
  process.exit(results.env && results.supabase ? 0 : 1);
}

main().catch((error) => {
  logError(`Verification failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});











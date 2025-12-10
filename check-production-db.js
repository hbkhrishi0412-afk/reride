#!/usr/bin/env node
/**
 * Production Database Connection Checker
 * 
 * This script helps verify your production database setup by:
 * 1. Testing the connection string format
 * 2. Attempting to connect to MongoDB
 * 3. Checking if collections exist
 * 4. Providing specific recommendations
 */

import mongoose from 'mongoose';
import { validateMongoUri, ensureDatabaseInUri } from './lib/db.js';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

async function checkProductionDatabase() {
  logSection('🔍 Production Database Connection Check');
  
  // Get connection string from command line or environment
  const mongoUri = process.argv[2] || process.env.MONGODB_URL || process.env.MONGODB_URI;
  
  if (!mongoUri) {
    log('❌ No connection string provided!', 'red');
    console.log('\nUsage:');
    console.log('  node check-production-db.js "mongodb+srv://..."');
    console.log('  Or set MONGODB_URI environment variable\n');
    console.log('💡 Get your connection string from:');
    console.log('   MongoDB Atlas → Clusters → Connect → Connect your application\n');
    return false;
  }
  
  // Step 1: Validate format
  logSection('Step 1: Validating Connection String');
  
  const validation = validateMongoUri(mongoUri);
  if (!validation.valid) {
    log(`❌ Invalid format: ${validation.error}`, 'red');
    return false;
  }
  
  log('✅ Connection string format is valid', 'green');
  const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  log(`   URI: ${maskedUri}`, 'cyan');
  
  // Step 2: Check database name
  logSection('Step 2: Checking Database Configuration');
  
  try {
    const normalizedUri = ensureDatabaseInUri(mongoUri);
    const dbName = normalizedUri.match(/\/([^?\/]+)(\?|$)/)?.[1] || 'reride';
    log(`✅ Database name: ${dbName}`, 'green');
    
    if (dbName.toLowerCase() !== 'reride') {
      log(`⚠️  Warning: Expected database name 'reride', but found '${dbName}'`, 'yellow');
    }
  } catch (error) {
    log(`❌ Error processing URI: ${error.message}`, 'red');
    return false;
  }
  
  // Step 3: Test connection
  logSection('Step 3: Testing Connection to MongoDB Atlas');
  
  try {
    log('🔄 Attempting to connect...', 'blue');
    
    const connectionOptions = {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      retryWrites: true,
      retryReads: true,
    };
    
    await mongoose.connect(mongoUri, connectionOptions);
    log('✅ Connection successful!', 'green');
    
    // Get connection details
    log('\n📊 Connection Details:', 'bright');
    log(`   Database: ${mongoose.connection.name}`, 'cyan');
    log(`   Host: ${mongoose.connection.host}`, 'cyan');
    log(`   Port: ${mongoose.connection.port || 'N/A (Atlas)}`, 'cyan');
    log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)`, 'cyan');
    
    // Check collections
    log('\n📁 Checking Collections:', 'bright');
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      if (collections.length > 0) {
        log(`✅ Found ${collections.length} collection(s):`, 'green');
        collections.forEach(col => {
          log(`   - ${col.name}`, 'cyan');
        });
      } else {
        log('⚠️  No collections found - database is empty', 'yellow');
        log('   💡 You may need to seed the database', 'yellow');
      }
    } catch (err) {
      log(`⚠️  Could not list collections: ${err.message}`, 'yellow');
    }
    
    // Test a simple query
    log('\n🧪 Testing Database Operations:', 'bright');
    try {
      const testResult = await mongoose.connection.db.admin().ping();
      if (testResult.ok === 1) {
        log('✅ Database ping successful - operations working!', 'green');
      }
    } catch (err) {
      log(`⚠️  Ping test failed: ${err.message}`, 'yellow');
    }
    
    await mongoose.disconnect();
    log('\n✅ Disconnected successfully', 'green');
    
    logSection('✅ All Checks Passed!');
    console.log('Your production database connection is working correctly.\n');
    console.log('💡 Next steps:');
    console.log('   1. Make sure this connection string is set in Vercel Environment Variables');
    console.log('   2. Verify MongoDB Atlas Network Access allows 0.0.0.0/0');
    console.log('   3. Redeploy on Vercel if you just set the environment variable\n');
    return true;
    
  } catch (error) {
    log(`❌ Connection failed: ${error.message}`, 'red');
    
    // Provide specific troubleshooting
    console.log('\n🔧 Troubleshooting:\n');
    
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      log('Authentication Error:', 'yellow');
      console.log('   • Check username and password are correct');
      console.log('   • Verify special characters in password are URL-encoded');
      console.log('   • Check database user exists in MongoDB Atlas → Database Access\n');
    } else if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      log('Network Error:', 'yellow');
      console.log('   • Go to MongoDB Atlas → Network Access');
      console.log('   • Click "Add IP Address" → "Allow Access from Anywhere"');
      console.log('   • This adds 0.0.0.0/0 (allows all IPs)');
      console.log('   • Wait 2-3 minutes for changes to propagate');
      console.log('   • Verify cluster is running (not paused)\n');
    } else if (error.message.includes('MongoServerSelectionError')) {
      log('Server Selection Error:', 'yellow');
      console.log('   • Check if cluster is paused in MongoDB Atlas');
      console.log('   • Go to Clusters → Click "Resume" if paused');
      console.log('   • Verify network access is configured\n');
    } else {
      log('General Error:', 'yellow');
      console.log('   • Check MongoDB Atlas cluster status');
      console.log('   • Verify connection string is correct');
      console.log('   • Check MongoDB Atlas logs\n');
    }
    
    console.log('💡 Common fixes:');
    console.log('   1. MongoDB Atlas → Network Access → Add 0.0.0.0/0');
    console.log('   2. MongoDB Atlas → Clusters → Ensure cluster is RUNNING');
    console.log('   3. Vercel → Settings → Environment Variables → Set MONGODB_URI');
    console.log('   4. Redeploy on Vercel after setting environment variable\n');
    
    return false;
  }
}

// Run check
checkProductionDatabase()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });


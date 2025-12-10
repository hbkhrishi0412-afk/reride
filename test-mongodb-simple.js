#!/usr/bin/env node
/**
 * Simple MongoDB Connection Test
 * Tests if MongoDB is connected and working
 */

import mongoose from 'mongoose';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testConnection() {
  console.log('\n🔍 Testing MongoDB Connection...\n');
  
  // Get connection string
  const mongoUri = process.argv[2] || process.env.MONGODB_URL || process.env.MONGODB_URI;
  
  if (!mongoUri) {
    log('❌ No connection string provided!', 'red');
    console.log('\nUsage:');
    console.log('  node test-mongodb-simple.js "mongodb+srv://..."');
    console.log('  Or set MONGODB_URL environment variable\n');
    return false;
  }
  
  // Mask password in output
  const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  log(`📡 Connection String: ${maskedUri}`, 'cyan');
  
  try {
    log('\n🔄 Attempting to connect...', 'blue');
    
    // Ensure database name is in URI
    let uri = mongoUri;
    if (!uri.includes('/reride') && !uri.includes('/?') && !uri.includes('?')) {
      uri = uri.replace(/\/$/, '') + '/reride';
    } else if (uri.includes('/?')) {
      uri = uri.replace('/?', '/reride?');
    }
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
    });
    
    log('✅ Connection successful!', 'green');
    
    // Get connection details
    log('\n📊 Connection Details:', 'cyan');
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)`);
    
    // Test ping
    log('\n🧪 Testing database operations...', 'blue');
    const pingResult = await mongoose.connection.db.admin().ping();
    if (pingResult.ok === 1) {
      log('✅ Ping successful - database is responding!', 'green');
    }
    
    // List collections
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      log(`\n📁 Collections found: ${collections.length}`, 'cyan');
      if (collections.length > 0) {
        collections.forEach(col => {
          console.log(`   - ${col.name}`);
        });
      } else {
        log('   ⚠️  Database is empty - you may need to seed it', 'yellow');
      }
    } catch (err) {
      log(`⚠️  Could not list collections: ${err.message}`, 'yellow');
    }
    
    await mongoose.disconnect();
    log('\n✅ Disconnected successfully', 'green');
    log('\n✅ MongoDB is connected and working fine!', 'green');
    console.log('');
    return true;
    
  } catch (error) {
    log(`\n❌ Connection failed: ${error.message}`, 'red');
    
    console.log('\n🔧 Troubleshooting:');
    
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      log('\nAuthentication Error:', 'yellow');
      console.log('   • Check username and password are correct');
      console.log('   • Verify user exists in MongoDB Atlas → Database Access');
      console.log('   • URL-encode special characters in password (@ → %40, # → %23)');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      log('\nNetwork Error:', 'yellow');
      console.log('   • MongoDB Atlas → Network Access → Add 0.0.0.0/0');
      console.log('   • Wait 2-3 minutes for changes to propagate');
    } else if (error.message.includes('MongoServerSelectionError')) {
      log('\nServer Selection Error:', 'yellow');
      console.log('   • Check if cluster is paused in MongoDB Atlas');
      console.log('   • Go to Clusters → Resume if needed');
    }
    
    console.log('');
    return false;
  }
}

testConnection()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    process.exit(1);
  });


#!/usr/bin/env node
/**
 * Comprehensive Production Setup Verification
 * 
 * Checks:
 * 1. MongoDB connection string format
 * 2. Actual database connection
 * 3. Collections exist
 * 4. Can perform operations
 * 5. Provides actionable recommendations
 */

import mongoose from 'mongoose';

// Standalone validation functions (to avoid TypeScript import issues)
function validateMongoUri(uri) {
  if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
    return { valid: false, error: 'MongoDB URI is empty or invalid' };
  }
  
  const uriPattern = /^mongodb(\+srv)?:\/\//i;
  if (!uriPattern.test(uri)) {
    return { valid: false, error: 'MongoDB URI must start with mongodb:// or mongodb+srv://' };
  }
  
  try {
    new URL(uri);
  } catch (error) {
    return { valid: false, error: 'MongoDB URI format is invalid. Check for special characters that need URL encoding.' };
  }
  
  return { valid: true };
}

function ensureDatabaseInUri(uri, dbName = 'reride') {
  const validation = validateMongoUri(uri);
  if (!validation.valid) {
    throw new Error(`Invalid MongoDB URI: ${validation.error}`);
  }
  
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname || '';
    const currentDbName = pathname.length > 1 ? pathname.slice(1).split('/')[0] : null;
    
    const hasDatabase = currentDbName && currentDbName.length > 0 && !currentDbName.match(/^[\/\?]+$/);
    
    if (!hasDatabase) {
      parsed.pathname = `/${dbName}`;
      return parsed.toString();
    }
    
    if (currentDbName.toLowerCase() !== dbName.toLowerCase()) {
      parsed.pathname = `/${dbName}`;
      return parsed.toString();
    }
    
    return parsed.toString();
  } catch (error) {
    // Fallback: simple string replacement
    if (!uri.includes(`/${dbName}`) && !uri.includes(`/${dbName}?`)) {
      if (uri.includes('?')) {
        return uri.replace('?', `/${dbName}?`);
      }
      return uri.endsWith('/') ? `${uri}${dbName}` : `${uri}/${dbName}`;
    }
    return uri;
  }
}

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
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

function logCheck(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${name}`, color);
  if (details) {
    log(`   ${details}`, 'cyan');
  }
}

async function verifyProductionSetup() {
  logSection('🔍 Production Database Setup Verification');
  
  const mongoUri = process.argv[2] || process.env.MONGODB_URL || process.env.MONGODB_URI;
  
  if (!mongoUri) {
    log('❌ No connection string provided!', 'red');
    console.log('\n📝 Usage:');
    console.log('   node verify-production-setup.js "mongodb+srv://..."');
    console.log('   Or set MONGODB_URI environment variable\n');
    console.log('💡 Get connection string from MongoDB Atlas:');
    console.log('   Clusters → Connect → Connect your application\n');
    return false;
  }
  
  let allChecksPassed = true;
  const results = {
    format: false,
    connection: false,
    database: false,
    collections: false,
    operations: false,
  };
  
  // Check 1: Format validation
  logSection('Check 1: Connection String Format');
  
  const validation = validateMongoUri(mongoUri);
  if (validation.valid) {
    logCheck('Format is valid', true);
    results.format = true;
    const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    log(`   ${maskedUri}`, 'cyan');
  } else {
    logCheck('Format is invalid', false, validation.error);
    results.format = false;
    allChecksPassed = false;
    console.log('\n❌ Cannot proceed with invalid connection string.\n');
    return false;
  }
  
  // Check 2: Database name
  logSection('Check 2: Database Configuration');
  
  try {
    const normalizedUri = ensureDatabaseInUri(mongoUri);
    const dbName = normalizedUri.match(/\/([^?\/]+)(\?|$)/)?.[1] || 'reride';
    
    if (dbName.toLowerCase() === 'reride') {
      logCheck('Database name is correct', true, `Using database: ${dbName}`);
      results.database = true;
    } else {
      logCheck('Database name mismatch', false, `Found: ${dbName}, Expected: reride`);
      results.database = false;
      allChecksPassed = false;
    }
  } catch (error) {
    logCheck('Database configuration error', false, error.message);
    results.database = false;
    allChecksPassed = false;
  }
  
  // Check 3: Connection test
  logSection('Check 3: Database Connection');
  
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
    logCheck('Connection successful', true);
    results.connection = true;
    
    log('\n📊 Connection Details:', 'bright');
    log(`   Database: ${mongoose.connection.name}`, 'cyan');
    log(`   Host: ${mongoose.connection.host}`, 'cyan');
    log(`   Port: ${mongoose.connection.port || 'N/A (Atlas)'}`, 'cyan');
    log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)`, 'cyan');
    
  } catch (error) {
    logCheck('Connection failed', false, error.message);
    results.connection = false;
    allChecksPassed = false;
    
    console.log('\n🔧 Connection Error Troubleshooting:\n');
    
    if (error.message.includes('authentication')) {
      log('Authentication Issue:', 'yellow');
      console.log('   • Check username and password');
      console.log('   • URL-encode special characters in password');
      console.log('   • Verify user exists in MongoDB Atlas → Database Access\n');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      log('Network Issue:', 'yellow');
      console.log('   • Go to MongoDB Atlas → Network Access');
      console.log('   • Add IP Address → Allow Access from Anywhere (0.0.0.0/0)');
      console.log('   • Wait 2-3 minutes for changes to propagate\n');
    } else if (error.message.includes('MongoServerSelectionError')) {
      log('Server Selection Issue:', 'yellow');
      console.log('   • Check if cluster is paused');
      console.log('   • MongoDB Atlas → Clusters → Resume if needed\n');
    }
    
    return false;
  }
  
  // Check 4: Collections
  logSection('Check 4: Database Collections');
  
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    if (collections.length > 0) {
      logCheck('Collections found', true, `Found ${collections.length} collection(s)`);
      results.collections = true;
      
      log('\n📁 Collections:', 'bright');
      const expectedCollections = ['users', 'vehicles', 'conversations', 'vehicleData'];
      collections.forEach(col => {
        const isExpected = expectedCollections.includes(col.name);
        const icon = isExpected ? '✅' : '⚠️';
        log(`   ${icon} ${col.name}`, isExpected ? 'green' : 'yellow');
      });
      
      // Check for expected collections
      const missingCollections = expectedCollections.filter(
        name => !collections.find(c => c.name === name)
      );
      
      if (missingCollections.length > 0) {
        log('\n⚠️  Missing expected collections:', 'yellow');
        missingCollections.forEach(name => {
          log(`   - ${name}`, 'yellow');
        });
        log('   💡 You may need to seed the database', 'yellow');
      }
    } else {
      logCheck('No collections found', false, 'Database appears to be empty');
      results.collections = false;
      log('   💡 You may need to seed the database', 'yellow');
    }
  } catch (err) {
    logCheck('Could not list collections', false, err.message);
    results.collections = false;
  }
  
  // Check 5: Operations test
  logSection('Check 5: Database Operations');
  
  try {
    // Test ping
    const pingResult = await mongoose.connection.db.admin().ping();
    if (pingResult.ok === 1) {
      logCheck('Ping operation', true, 'Database responds to queries');
      results.operations = true;
    } else {
      logCheck('Ping operation', false, 'Database did not respond correctly');
      results.operations = false;
      allChecksPassed = false;
    }
    
    // Test read operation if collections exist
    if (results.collections) {
      try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        if (collections.length > 0) {
          const testCollection = collections[0].name;
          const count = await mongoose.connection.db.collection(testCollection).countDocuments();
          logCheck('Read operation', true, `Can read from ${testCollection} (${count} documents)`);
        }
      } catch (readErr) {
        logCheck('Read operation', false, readErr.message);
        results.operations = false;
      }
    }
  } catch (err) {
    logCheck('Operations test failed', false, err.message);
    results.operations = false;
    allChecksPassed = false;
  }
  
  // Final summary
  logSection('📋 Verification Summary');
  
  const checks = [
    ['Connection String Format', results.format],
    ['Database Name', results.database],
    ['Database Connection', results.connection],
    ['Collections', results.collections],
    ['Operations', results.operations],
  ];
  
  checks.forEach(([name, passed]) => {
    logCheck(name, passed);
  });
  
  console.log('');
  
  if (allChecksPassed) {
    log('✅ All checks passed! Your database is ready for production.', 'green');
    console.log('\n💡 Next steps:');
    console.log('   1. Verify MONGODB_URI is set in Vercel Environment Variables');
    console.log('   2. Ensure MongoDB Atlas Network Access allows 0.0.0.0/0');
    console.log('   3. Redeploy on Vercel if you just set the environment variable');
    console.log('   4. Test your API: https://www.reride.co.in/api/admin?action=health\n');
  } else {
    log('❌ Some checks failed. Please fix the issues above.', 'red');
    console.log('\n🔧 Common fixes:');
    console.log('   • MongoDB Atlas → Network Access → Add 0.0.0.0/0');
    console.log('   • Vercel → Settings → Environment Variables → Set MONGODB_URI');
    console.log('   • Verify connection string format and password encoding\n');
  }
  
  // Cleanup
  try {
    await mongoose.disconnect();
    log('✅ Disconnected from database', 'green');
  } catch (err) {
    // Ignore disconnect errors
  }
  
  return allChecksPassed;
}

// Run verification
verifyProductionSetup()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });


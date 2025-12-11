#!/usr/bin/env node
/**
 * Database Connection Diagnostic Tool
 * 
 * This script helps diagnose MongoDB connection issues by:
 * 1. Checking if environment variables are set
 * 2. Validating the connection string format
 * 3. Testing the actual connection
 * 4. Providing specific fix recommendations
 */

import mongoose from 'mongoose';

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

// Validate MongoDB URI format (standalone version)
function validateMongoUri(uri) {
  if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
    return { valid: false, error: 'MongoDB URI is empty or invalid' };
  }

  // Check for basic MongoDB URI patterns
  const uriPattern = /^mongodb(\+srv)?:\/\//i;
  if (!uriPattern.test(uri)) {
    return { valid: false, error: 'MongoDB URI must start with mongodb:// or mongodb+srv://' };
  }

  // Check for special characters that need URL encoding
  try {
    new URL(uri);
  } catch (error) {
    return { valid: false, error: 'MongoDB URI format is invalid. Check for special characters that need URL encoding.' };
  }

  return { valid: true };
}

// Ensure database name is in URI (standalone version)
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
    
    const normalizedCurrentDbName = currentDbName.toLowerCase();
    if (normalizedCurrentDbName !== dbName.toLowerCase()) {
      parsed.pathname = `/${dbName}`;
      return parsed.toString();
    }
    
    if (currentDbName !== dbName) {
      parsed.pathname = `/${dbName}`;
    }
    
    return parsed.toString();
  } catch (error) {
    // Fallback handling
    const lowerUri = uri.toLowerCase();
    const dbNamePattern = /(mongodb\+?srv?:\/\/[^\/]+)\/([^?\/\s]+)/i;
    const match = uri.match(dbNamePattern);
    
    if (match) {
      const existingDbName = match[2];
      if (existingDbName.toLowerCase() !== dbName.toLowerCase()) {
        return uri.replace(dbNamePattern, `$1/${dbName}`);
      }
      return uri;
    }
    
    const hasRerideVariation = lowerUri.includes('/re-ride') || lowerUri.includes('/re_ride') || lowerUri.includes('/reride');
    if (hasRerideVariation) {
      return uri.replace(/\/re-ride/i, `/${dbName}`).replace(/\/re_ride/i, `/${dbName}`).replace(/\/reride/i, `/${dbName}`);
    }
    
    if (uri.includes('?')) {
      const [base, query] = uri.split('?');
      const sanitizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      return `${sanitizedBase}/${dbName}?${query}`;
    }
    
    return uri.endsWith('/') ? `${uri}${dbName}` : `${uri}/${dbName}`;
  }
}

async function diagnoseConnection() {
  logSection('🔍 MongoDB Connection Diagnostic Tool');
  
  // Step 1: Check environment variables
  logSection('Step 1: Checking Environment Variables');
  
  // MONGODB_URL is preferred, MONGODB_URI for backward compatibility
  const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
  
  if (!mongoUri) {
    log('❌ MONGODB_URL or MONGODB_URI is not set!', 'red');
    console.log('\n📝 To fix this:\n');
    console.log('1. Create a .env.local file in your project root:');
    console.log('   MONGODB_URI=your_connection_string_here\n');
    console.log('2. Or set it as an environment variable:');
    console.log('   Windows PowerShell:');
    console.log('   $env:MONGODB_URI="your_connection_string_here"\n');
    console.log('   Windows CMD:');
    console.log('   set MONGODB_URI=your_connection_string_here\n');
    console.log('   Linux/Mac:');
    console.log('   export MONGODB_URI="your_connection_string_here"\n');
    console.log('3. For Vercel deployment:');
    console.log('   - Go to Vercel Dashboard → Settings → Environment Variables');
    console.log('   - Add MONGODB_URI with your connection string\n');
    console.log('💡 Connection string examples:');
    console.log('   - MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/reride');
    console.log('   - Local MongoDB: mongodb://localhost:27017/reride\n');
    return false;
  }
  
  log('✅ Environment variable found', 'green');
  const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  log(`   URI: ${maskedUri}`, 'cyan');
  
  // Step 2: Validate URI format
  logSection('Step 2: Validating Connection String Format');
  
  const validation = validateMongoUri(mongoUri);
  if (!validation.valid) {
    log(`❌ Invalid MongoDB URI format: ${validation.error}`, 'red');
    console.log('\n📝 Common issues:');
    console.log('   - URI must start with mongodb:// or mongodb+srv://');
    console.log('   - Special characters in password must be URL-encoded');
    console.log('   - @ symbol in password should be %40');
    console.log('   - Spaces are not allowed\n');
    return false;
  }
  
  log('✅ URI format is valid', 'green');
  
  // Step 3: Check URI normalization
  logSection('Step 3: Checking Database Name');
  
  try {
    const normalizedUri = ensureDatabaseInUri(mongoUri);
    if (normalizedUri !== mongoUri) {
      log('⚠️  Database name adjusted in URI', 'yellow');
      log(`   Original: ${maskedUri}`, 'cyan');
      const maskedNormalized = normalizedUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
      log(`   Normalized: ${maskedNormalized}`, 'cyan');
    } else {
      log('✅ Database name is correct', 'green');
    }
  } catch (error) {
    log(`❌ Error processing URI: ${error.message}`, 'red');
    return false;
  }
  
  // Step 4: Test connection
  logSection('Step 4: Testing Database Connection');
  
  try {
    log('🔄 Attempting to connect...', 'blue');
    
    // Use the normalized URI
    const normalizedUri = ensureDatabaseInUri(mongoUri);
    
    // Add retryWrites if not present
    let finalUri = normalizedUri;
    if (!finalUri.includes('retryWrites')) {
      const separator = finalUri.includes('?') ? '&' : '?';
      finalUri = `${finalUri}${separator}retryWrites=true&w=majority`;
    }
    
    const connectionOptions = {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 20000,
      dbName: 'reride',
      retryWrites: true,
    };
    
    await mongoose.connect(finalUri, connectionOptions);
    log('✅ Connection successful!', 'green');
    
    // Test basic operations
    log('\n📊 Connection Details:', 'bright');
    log(`   Database: ${mongoose.connection.name}`, 'cyan');
    log(`   Host: ${mongoose.connection.host}`, 'cyan');
    log(`   Port: ${mongoose.connection.port || 'N/A (Atlas)'}`, 'cyan');
    log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)`, 'cyan');
    
    // Test ping
    try {
      await mongoose.connection.db.admin().ping();
      log('   Ping: ✅ Success', 'green');
    } catch (pingError) {
      log(`   Ping: ❌ Failed - ${pingError.message}`, 'red');
    }
    
    // List collections
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      log(`\n📁 Collections (${collections.length}):`, 'bright');
      if (collections.length > 0) {
        collections.forEach(col => {
          log(`   - ${col.name}`, 'cyan');
        });
      } else {
        log('   (No collections found - database may be empty)', 'yellow');
        log('   💡 Run: node seed-database.js to populate the database', 'yellow');
      }
    } catch (err) {
      log(`⚠️  Could not list collections: ${err.message}`, 'yellow');
    }
    
    await mongoose.disconnect();
    log('\n✅ Disconnected successfully', 'green');
    
    logSection('✅ All Checks Passed!');
    console.log('Your database connection is working correctly.\n');
    console.log('💡 Next steps:');
    console.log('   1. Try logging in again');
    console.log('   2. If database is empty, run: node seed-database.js\n');
    return true;
    
  } catch (error) {
    log(`❌ Connection failed: ${error.message}`, 'red');
    
    // Provide specific troubleshooting based on error type
    console.log('\n🔧 Troubleshooting Guide:\n');
    
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      log('Authentication Error:', 'yellow');
      console.log('   1. Check your username and password are correct');
      console.log('   2. Verify the database user exists in MongoDB Atlas');
      console.log('   3. Ensure the user has read/write permissions');
      console.log('   4. Check if special characters in password are URL-encoded');
      console.log('      - @ should be %40');
      console.log('      - # should be %23');
      console.log('      - / should be %2F');
      console.log('      - : should be %3A\n');
    } else if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      log('Network Error:', 'yellow');
      console.log('   1. Check your internet connection');
      console.log('   2. Verify MongoDB Atlas cluster is running');
      console.log('   3. Check MongoDB Atlas Network Access settings:');
      console.log('      - Go to MongoDB Atlas → Network Access');
      console.log('      - Add your IP address (or 0.0.0.0/0 for development)');
      console.log('   4. Verify the cluster hostname is correct');
      console.log('   5. Check if firewall is blocking the connection\n');
    } else if (error.message.includes('MongoServerSelectionError')) {
      log('Server Selection Error:', 'yellow');
      console.log('   1. Check if MongoDB Atlas cluster is paused (free tier)');
      console.log('   2. Verify the cluster is running in MongoDB Atlas dashboard');
      console.log('   3. Check network connectivity');
      console.log('   4. Verify connection string hostname matches cluster\n');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      log('DNS Resolution Error:', 'yellow');
      console.log('   1. Check if the cluster hostname is correct');
      console.log('   2. Verify internet connection');
      console.log('   3. Try pinging the MongoDB Atlas hostname\n');
    } else {
      log('General Error:', 'yellow');
      console.log('   1. Check MongoDB Atlas cluster status');
      console.log('   2. Verify connection string format');
      console.log('   3. Check MongoDB Atlas logs for more details');
      console.log('   4. Try regenerating the connection string in MongoDB Atlas\n');
    }
    
    console.log('💡 For more help:');
    console.log('   - MongoDB Atlas Docs: https://docs.atlas.mongodb.com/');
    console.log('   - Connection String Guide: https://docs.atlas.mongodb.com/getting-started/\n');
    
    return false;
  }
}

// Run diagnostic
diagnoseConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });

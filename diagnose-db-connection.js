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
    
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };
    
    await mongoose.connect(mongoUri, connectionOptions);
    log('✅ Connection successful!', 'green');
    
    // Test basic operations
    log('\n📊 Connection Details:', 'bright');
    log(`   Database: ${mongoose.connection.name}`, 'cyan');
    log(`   Host: ${mongoose.connection.host}`, 'cyan');
    log(`   Port: ${mongoose.connection.port || 'N/A (Atlas)'}`, 'cyan');
    log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)`, 'cyan');
    
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
      }
    } catch (err) {
      log(`⚠️  Could not list collections: ${err.message}`, 'yellow');
    }
    
    await mongoose.disconnect();
    log('\n✅ Disconnected successfully', 'green');
    
    logSection('✅ All Checks Passed!');
    console.log('Your database connection is working correctly.\n');
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


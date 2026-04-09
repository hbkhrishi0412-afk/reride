#!/usr/bin/env node
/**
 * Vercel Environment Variables Verification Script
 * 
 * This script helps verify that all required environment variables are set
 * Run this locally to check what needs to be added to Vercel
 */

const requiredEnvVars = {
  // Firebase - Client-side (VITE_ prefix)
  client: [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_DATABASE_URL',
  ],
  // Firebase - Server-side (without VITE_ prefix)
  server: [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'FIREBASE_DATABASE_URL',
  ],
  // Other required variables
  other: [
    'JWT_SECRET',
    'MONGODB_URI',
    'GEMINI_API_KEY',
  ],
};

console.log('🔍 Vercel Environment Variables Verification\n');
console.log('='.repeat(60));
console.log('📋 Required Environment Variables Checklist\n');

let allPresent = true;
const missingVars = [];

// Check client-side Firebase variables
console.log('🌐 Client-Side Firebase Variables (VITE_ prefix):');
requiredEnvVars.client.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}`);
  } else {
    console.log(`  ❌ ${varName} - MISSING`);
    allPresent = false;
    missingVars.push(varName);
  }
});

console.log('\n🔧 Server-Side Firebase Variables (without VITE_ prefix):');
requiredEnvVars.server.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}`);
  } else {
    console.log(`  ❌ ${varName} - MISSING`);
    allPresent = false;
    missingVars.push(varName);
  }
});

console.log('\n🔐 Other Required Variables:');
requiredEnvVars.other.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}`);
  } else {
    console.log(`  ❌ ${varName} - MISSING`);
    allPresent = false;
    missingVars.push(varName);
  }
});

console.log('\n' + '='.repeat(60));

if (allPresent) {
  console.log('\n✅ All required environment variables are set!');
  console.log('💡 Note: This checks local .env files. Make sure all variables are also set in Vercel Dashboard.');
} else {
  console.log('\n❌ Missing Environment Variables:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  
  console.log('\n📝 Instructions to Fix:');
  console.log('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.log('2. Add each missing variable listed above');
  console.log('3. For Firebase variables:');
  console.log('   - Client-side: Use VITE_FIREBASE_* (same values)');
  console.log('   - Server-side: Use FIREBASE_* (same values, without VITE_ prefix)');
  console.log('4. Enable all variables for: Production, Preview, Development');
  console.log('5. Redeploy your application after adding variables');
  console.log('\n💡 For JWT_SECRET, generate one using:');
  console.log('   node scripts/generate-jwt-secret.js');
}

console.log('\n' + '='.repeat(60));
process.exit(allPresent ? 0 : 1);


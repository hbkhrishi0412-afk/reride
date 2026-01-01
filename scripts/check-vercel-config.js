#!/usr/bin/env node
/**
 * Check Vercel Configuration Status
 * 
 * This script helps identify what might be causing 401/503 errors
 * even when JWT_SECRET is already set.
 */

console.log('🔍 Vercel Configuration Check\n');
console.log('='.repeat(60));
console.log('📋 Configuration Status Analysis\n');

const issues = [];
const recommendations = [];

// Check if JWT_SECRET is set
if (process.env.JWT_SECRET) {
  console.log('✅ JWT_SECRET is set');
  
  // Check if it looks valid (should be at least 32 characters for security)
  if (process.env.JWT_SECRET.length < 32) {
    issues.push('JWT_SECRET is too short (should be at least 32 characters)');
    recommendations.push('Generate a new JWT_SECRET using: node scripts/generate-jwt-secret.js');
  } else {
    console.log('   ✓ JWT_SECRET length is adequate');
  }
} else {
  console.log('❌ JWT_SECRET is NOT set');
  issues.push('JWT_SECRET is missing');
  recommendations.push('Add JWT_SECRET to Vercel environment variables');
}

console.log('');

// Check Firebase variables
console.log('🔥 Firebase Configuration:');

const firebaseVars = {
  client: [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_DATABASE_URL',
  ],
  server: [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'FIREBASE_DATABASE_URL',
  ],
};

console.log('\n  Client-Side (VITE_ prefix):');
let clientMissing = 0;
firebaseVars.client.forEach(varName => {
  if (process.env[varName]) {
    console.log(`    ✅ ${varName}`);
  } else {
    console.log(`    ❌ ${varName} - MISSING`);
    clientMissing++;
  }
});

console.log('\n  Server-Side (without VITE_ prefix):');
let serverMissing = 0;
firebaseVars.server.forEach(varName => {
  if (process.env[varName]) {
    console.log(`    ✅ ${varName}`);
  } else {
    console.log(`    ❌ ${varName} - MISSING`);
    serverMissing++;
  }
});

if (serverMissing > 0) {
  issues.push(`${serverMissing} server-side Firebase variables are missing`);
  recommendations.push('Add FIREBASE_* variables (without VITE_ prefix) to Vercel');
  recommendations.push('Use the same values as your VITE_FIREBASE_* variables');
}

console.log('');

// Check other required variables
console.log('🔐 Other Required Variables:');
const otherVars = ['MONGODB_URI', 'GEMINI_API_KEY'];
otherVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}`);
  } else {
    console.log(`  ❌ ${varName} - MISSING`);
    issues.push(`${varName} is missing`);
  }
});

console.log('\n' + '='.repeat(60));

if (issues.length === 0) {
  console.log('\n✅ All required environment variables are set!');
  console.log('\n💡 If you\'re still getting 401 errors:');
  console.log('   1. Clear browser tokens and log in again');
  console.log('   2. Redeploy your application');
  console.log('   3. Check Vercel function logs for specific errors');
} else {
  console.log('\n❌ Issues Found:');
  issues.forEach((issue, index) => {
    console.log(`   ${index + 1}. ${issue}`);
  });
  
  console.log('\n📝 Recommendations:');
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Add missing variables to Vercel Dashboard');
  console.log('   2. Enable all variables for: Production, Preview, Development');
  console.log('   3. Redeploy your application');
  console.log('   4. Clear browser tokens and log in again');
}

console.log('\n' + '='.repeat(60));
process.exit(issues.length === 0 ? 0 : 1);


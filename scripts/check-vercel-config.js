#!/usr/bin/env node
/**
 * Check Local Environment Configuration
 * 
 * ⚠️ NOTE: This script checks LOCAL environment variables (process.env)
 * For Vercel production, use the Vercel Dashboard to verify variables.
 * 
 * This script helps identify missing environment variables locally.
 * For production verification, see VERCEL_ENV_VERIFICATION.md
 * 
 * To verify Vercel environment variables:
 * 1. Go to Vercel Dashboard → Settings → Environment Variables
 * 2. Check browser console on production site
 * 3. See VERCEL_ENV_VERIFICATION.md for complete guide
 */

console.log('🔍 Local Environment Configuration Check\n');
console.log('⚠️  NOTE: This checks LOCAL variables only. For Vercel, use the dashboard.\n');
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

if (clientMissing > 0) {
  issues.push(`${clientMissing} client-side Firebase variables are missing`);
  recommendations.push('Add VITE_FIREBASE_* variables to Vercel');
  recommendations.push('These are required for client-side Firebase initialization');
}

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
    if (varName === 'MONGODB_URI') {
      recommendations.push('Add MONGODB_URI to Vercel environment variables (your MongoDB connection string)');
    } else if (varName === 'GEMINI_API_KEY') {
      recommendations.push('Add GEMINI_API_KEY to Vercel environment variables (your Google Gemini API key)');
    }
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
  console.log('   3. Redeploy your application (CRITICAL - variables are embedded at build time)');
  console.log('   4. Verify in production using VERCEL_ENV_VERIFICATION.md');
  console.log('   5. Clear browser tokens and log in again');
}

console.log('\n' + '='.repeat(60));
console.log('\n📚 For complete Vercel verification guide, see: VERCEL_ENV_VERIFICATION.md\n');
process.exit(issues.length === 0 ? 0 : 1);


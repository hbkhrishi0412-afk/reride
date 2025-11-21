#!/usr/bin/env node
/**
 * Generate a secure JWT_SECRET for production use
 * Usage: node scripts/generate-jwt-secret.js
 */

import crypto from 'crypto';

// Generate a secure random string (64 characters)
const generateSecureSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

const jwtSecret = generateSecureSecret(64);

console.log('\n🔐 Generated JWT_SECRET for Production\n');
console.log('='.repeat(70));
console.log(jwtSecret);
console.log('='.repeat(70));
console.log('\n📋 Next Steps:\n');
console.log('1. Copy the secret above');
console.log('2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
console.log('3. Add new variable:');
console.log('   - Key: JWT_SECRET');
console.log('   - Value: <paste the secret above>');
console.log('   - Environment: Production (and Preview if needed)');
console.log('4. Save and redeploy your application\n');
console.log('⚠️  IMPORTANT: Keep this secret secure! Do not commit it to git.\n');

// Also output in .env format for local development
console.log('💡 For local development, add this to your .env file:\n');
console.log(`JWT_SECRET=${jwtSecret}\n`);


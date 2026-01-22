#!/usr/bin/env node
/**
 * Environment Variables Checker
 * Verifies all required environment variables are set correctly
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Required environment variables
const requiredVars = {
  // Firebase - Client-side
  client: [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_DATABASE_URL',
  ],
  // Firebase - Server-side
  server: [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'FIREBASE_DATABASE_URL',
  ],
  // Supabase - Client-side
  supabaseClient: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ],
  // Supabase - Server-side
  supabaseServer: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  // Optional but recommended
  optional: [
    'GEMINI_API_KEY',
    'JWT_SECRET',
  ],
};

// Load .env.local file
function loadEnvFile() {
  const envPath = join(projectRoot, '.env.local');
  try {
    const content = readFileSync(envPath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    return env;
  } catch (error) {
    return {};
  }
}

// Check environment variables
function checkEnvVars() {
  console.log('🔍 Checking Environment Variables...\n');
  console.log('═'.repeat(70));

  const envFile = loadEnvFile();
  const allVars = [
    ...requiredVars.client,
    ...requiredVars.server,
    ...requiredVars.supabaseClient,
    ...requiredVars.supabaseServer,
  ];

  const missing = [];
  const invalid = [];
  const found = [];
  const optional = [];

  // Check required variables
  allVars.forEach(varName => {
    const value = process.env[varName] || envFile[varName];
    
    if (!value) {
      missing.push(varName);
      console.log(`❌ ${varName}: MISSING`);
    } else if (
      value.includes('your-') || 
      value.includes('YOUR_') || 
      value.includes('your-project-ref') ||
      value.includes('your_supabase') ||
      value === 'your_gemini_api_key_here' ||
      value === 'your_jwt_secret_here'
    ) {
      invalid.push(varName);
      console.log(`⚠️  ${varName}: SET BUT INVALID (contains placeholder)`);
    } else {
      found.push(varName);
      // Mask sensitive values
      const masked = varName.includes('KEY') || varName.includes('SECRET')
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`✅ ${varName}: ${masked}`);
    }
  });

  // Check optional variables
  requiredVars.optional.forEach(varName => {
    const value = process.env[varName] || envFile[varName];
    if (value && !value.includes('your-') && !value.includes('YOUR_')) {
      optional.push(varName);
      console.log(`💡 ${varName}: SET (optional)`);
    } else {
      console.log(`⚪ ${varName}: NOT SET (optional)`);
    }
  });

  console.log('\n' + '═'.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Configured: ${found.length}/${allVars.length}`);
  console.log(`   ❌ Missing: ${missing.length}`);
  console.log(`   ⚠️  Invalid: ${invalid.length}`);
  console.log(`   💡 Optional: ${optional.length}/${requiredVars.optional.length}`);

  if (missing.length > 0) {
    console.log(`\n❌ Missing Environment Variables:`);
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log(`\n💡 To fix:`);
    console.log(`   1. Open .env.local file in the project root`);
    console.log(`   2. Add all missing variables`);
    console.log(`   3. Get values from:`);
    console.log(`      - Firebase: https://console.firebase.google.com/`);
    console.log(`      - Supabase: https://supabase.com/dashboard`);
    console.log(`   4. Restart the dev server`);
  }

  if (invalid.length > 0) {
    console.log(`\n⚠️  Invalid Environment Variables (contain placeholders):`);
    invalid.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log(`\n💡 Replace placeholder values with actual credentials`);
  }

  // Specific Supabase check
  const supabaseMissing = missing.filter(v => v.includes('SUPABASE'));
  const supabaseInvalid = invalid.filter(v => v.includes('SUPABASE'));
  
  if (supabaseMissing.length > 0 || supabaseInvalid.length > 0) {
    console.log(`\n🔴 SUPABASE CONFIGURATION ISSUE:`);
    console.log(`   The app uses Supabase for database operations.`);
    console.log(`   Missing or invalid Supabase variables will cause runtime errors.`);
    console.log(`\n   How to get Supabase credentials:`);
    console.log(`   1. Go to https://supabase.com/dashboard`);
    console.log(`   2. Select your project`);
    console.log(`   3. Go to Settings → API`);
    console.log(`   4. Copy Project URL and keys`);
    console.log(`   5. Add them to .env.local`);
  }

  // Firebase check
  const firebaseMissing = missing.filter(v => v.includes('FIREBASE'));
  const firebaseInvalid = invalid.filter(v => v.includes('FIREBASE'));
  
  if (firebaseMissing.length > 0 || firebaseInvalid.length > 0) {
    console.log(`\n🟡 FIREBASE CONFIGURATION ISSUE:`);
    console.log(`   Some Firebase variables are missing or invalid.`);
    console.log(`   This may affect authentication and storage features.`);
  }

  console.log('\n' + '═'.repeat(70));

  if (missing.length === 0 && invalid.length === 0) {
    console.log('\n✅ All required environment variables are properly configured!');
    return true;
  } else {
    console.log('\n❌ Please fix the issues above before running the application.');
    return false;
  }
}

// Run the check
const success = checkEnvVars();
process.exit(success ? 0 : 1);


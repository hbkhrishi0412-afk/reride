/**
 * Firebase Configuration Verification Script
 * Checks if all required Firebase environment variables are set
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

function checkEnvFile() {
  const envFiles = ['.env.local', '.env', '.env.production'];
  let envContent = {};

  for (const envFile of envFiles) {
    const envPath = join(__dirname, '..', envFile);
    if (existsSync(envPath)) {
      console.log(`\n📄 Found ${envFile}`);
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            envContent[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      break; // Use first found file
    }
  }

  return envContent;
}

function checkEnvironmentVariables() {
  console.log('\n🔍 Checking Firebase Configuration...\n');
  console.log('═'.repeat(60));

  const envFile = checkEnvFile();
  const missing = [];
  const found = [];
  const invalid = [];

  requiredEnvVars.forEach(varName => {
    // Check in process.env (for runtime)
    const value = process.env[varName] || envFile[varName];
    
    if (!value) {
      missing.push(varName);
      console.log(`❌ ${varName}: MISSING`);
    } else if (value.includes('YOUR_') || value.includes('your-')) {
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

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Configured: ${found.length}/${requiredEnvVars.length}`);
  console.log(`   ❌ Missing: ${missing.length}`);
  console.log(`   ⚠️  Invalid: ${invalid.length}`);

  if (missing.length > 0) {
    console.log(`\n❌ Missing Environment Variables:`);
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log(`\n💡 To fix:`);
    console.log(`   1. Create a .env.local file in the project root`);
    console.log(`   2. Add all required Firebase variables`);
    console.log(`   3. Get values from Firebase Console → Project Settings`);
    return false;
  }

  if (invalid.length > 0) {
    console.log(`\n⚠️  Invalid Environment Variables (contain placeholders):`);
    invalid.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log(`\n💡 Replace placeholder values with actual Firebase config values`);
    return false;
  }

  console.log(`\n✅ All Firebase environment variables are configured!`);
  console.log(`\n📝 Next Steps:`);
  console.log(`   1. Ensure Firebase Authentication is enabled in Firebase Console`);
  console.log(`   2. Enable Google Sign-In method in Firebase Console`);
  console.log(`   3. Enable Phone Authentication in Firebase Console`);
  console.log(`   4. Test authentication in the application`);
  
  return true;
}

// Run check if executed directly
checkEnvironmentVariables();

export { checkEnvironmentVariables, requiredEnvVars };


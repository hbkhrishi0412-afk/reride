#!/usr/bin/env node
/**
 * Environment Variables Setup Helper
 * Checks and helps set up missing environment variables
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const envLocalPath = path.join(projectRoot, '.env.local');
const envExamplePath = path.join(projectRoot, 'env.example');

// Required Supabase variables
const requiredSupabaseVars = {
  client: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ],
  server: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
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
}

function checkSupabaseVars() {
  console.log('🔍 Checking Supabase Environment Variables...\n');
  console.log('═'.repeat(70));

  const envFile = loadEnvFile(envLocalPath);
  const allSupabaseVars = [
    ...requiredSupabaseVars.client,
    ...requiredSupabaseVars.server,
  ];

  const missing = [];
  const invalid = [];
  const found = [];

  allSupabaseVars.forEach(varName => {
    const value = envFile[varName];
    
    if (!value) {
      missing.push(varName);
      console.log(`❌ ${varName}: MISSING`);
    } else if (
      value.includes('your-') || 
      value.includes('YOUR_') || 
      value.includes('your-project-ref') ||
      value.includes('your_supabase')
    ) {
      invalid.push(varName);
      console.log(`⚠️  ${varName}: SET BUT INVALID (contains placeholder)`);
    } else {
      found.push(varName);
      const masked = varName.includes('KEY') || varName.includes('SECRET')
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`✅ ${varName}: ${masked}`);
    }
  });

  console.log('\n' + '═'.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Configured: ${found.length}/${allSupabaseVars.length}`);
  console.log(`   ❌ Missing: ${missing.length}`);
  console.log(`   ⚠️  Invalid: ${invalid.length}`);

  if (missing.length > 0 || invalid.length > 0) {
    console.log(`\n🔴 SUPABASE CONFIGURATION REQUIRED`);
    console.log(`\n   The application requires Supabase for database operations.`);
    console.log(`   Missing or invalid Supabase variables will cause runtime errors.`);
    console.log(`\n   📝 How to get Supabase credentials:`);
    console.log(`   1. Go to https://supabase.com/dashboard`);
    console.log(`   2. Select your project (or create a new one)`);
    console.log(`   3. Go to Settings → API`);
    console.log(`   4. Copy these values:`);
    console.log(`      - Project URL (e.g., https://xxxxx.supabase.co)`);
    console.log(`      - anon public key (safe for client-side)`);
    console.log(`      - service_role key (KEEP SECRET - server-side only)`);
    console.log(`\n   📝 How to add to .env.local:`);
    console.log(`   1. Open .env.local file in the project root`);
    console.log(`   2. Add these lines (replace with your actual values):`);
    console.log(`\n      # Supabase - Client-side`);
    missing.filter(v => v.startsWith('VITE_')).forEach(v => {
      console.log(`      ${v}=your_value_here`);
    });
    console.log(`\n      # Supabase - Server-side`);
    missing.filter(v => !v.startsWith('VITE_')).forEach(v => {
      console.log(`      ${v}=your_value_here`);
    });
    console.log(`\n   3. Save the file`);
    console.log(`   4. Restart the dev server (npm run dev)`);
    console.log(`\n   ⚠️  IMPORTANT:`);
    console.log(`   - Never commit .env.local to version control`);
    console.log(`   - Keep service_role key secret`);
    console.log(`   - Use actual values, not placeholders`);
    
    return false;
  }

  console.log('\n✅ All Supabase environment variables are properly configured!');
  return true;
}

// Run the check
const success = checkSupabaseVars();
process.exit(success ? 0 : 1);


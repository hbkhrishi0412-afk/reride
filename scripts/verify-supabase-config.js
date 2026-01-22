#!/usr/bin/env node
/**
 * Verify Supabase Configuration
 * Checks if Supabase environment variables are properly set
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const envLocalPath = path.join(projectRoot, '.env.local');

// Required Supabase variables
const requiredVars = {
  client: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  server: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
};

function loadEnvFile() {
  if (!fs.existsSync(envLocalPath)) {
    return {};
  }
  
  const content = fs.readFileSync(envLocalPath, 'utf-8');
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

function validateValue(value, varName) {
  if (!value) {
    return { valid: false, reason: 'MISSING' };
  }
  
  // Check for placeholders
  const placeholders = [
    'your-',
    'YOUR_',
    'your-project-ref',
    'your_supabase',
    'your-project-ref.supabase.co',
    'your_anon_key_here',
    'your_service_role_key_here',
  ];
  
  for (const placeholder of placeholders) {
    if (value.includes(placeholder)) {
      return { valid: false, reason: 'PLACEHOLDER' };
    }
  }
  
  // Validate URL format for URL variables
  if (varName.includes('URL')) {
    if (!value.startsWith('https://')) {
      return { valid: false, reason: 'INVALID_URL_FORMAT' };
    }
    if (!value.includes('.supabase.co')) {
      return { valid: false, reason: 'INVALID_SUPABASE_URL' };
    }
  }
  
  // Validate key length (Supabase keys are typically very long)
  if (varName.includes('KEY')) {
    if (value.length < 50) {
      return { valid: false, reason: 'KEY_TOO_SHORT' };
    }
  }
  
  return { valid: true };
}

function verifySupabaseConfig() {
  console.log('🔍 Verifying Supabase Configuration...\n');
  console.log('═'.repeat(70));

  const env = loadEnvFile();
  const allVars = [...requiredVars.client, ...requiredVars.server];
  
  const results = {
    valid: [],
    invalid: [],
    missing: [],
  };

  allVars.forEach(varName => {
    const value = env[varName];
    const validation = validateValue(value, varName);
    
    if (!value) {
      results.missing.push(varName);
      console.log(`❌ ${varName}: MISSING`);
    } else if (!validation.valid) {
      results.invalid.push({ var: varName, reason: validation.reason });
      const masked = varName.includes('KEY') || varName.includes('SECRET')
        ? `${value.substring(0, 15)}...${value.substring(value.length - 10)}`
        : value;
      console.log(`⚠️  ${varName}: INVALID (${validation.reason})`);
      console.log(`   Value: ${masked}`);
    } else {
      results.valid.push(varName);
      const masked = varName.includes('KEY') || varName.includes('SECRET')
        ? `${value.substring(0, 15)}...${value.substring(value.length - 10)}`
        : value;
      console.log(`✅ ${varName}: VALID`);
      console.log(`   Value: ${masked}`);
    }
  });

  console.log('\n' + '═'.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Valid: ${results.valid.length}/${allVars.length}`);
  console.log(`   ❌ Missing: ${results.missing.length}`);
  console.log(`   ⚠️  Invalid: ${results.invalid.length}`);

  if (results.missing.length > 0) {
    console.log(`\n❌ Missing Variables:`);
    results.missing.forEach(v => console.log(`   - ${v}`));
  }

  if (results.invalid.length > 0) {
    console.log(`\n⚠️  Invalid Variables:`);
    results.invalid.forEach(({ var: v, reason }) => {
      console.log(`   - ${v}: ${reason}`);
      if (reason === 'PLACEHOLDER') {
        console.log(`     → Replace placeholder with actual Supabase credentials`);
      } else if (reason === 'INVALID_URL_FORMAT') {
        console.log(`     → URL must start with https://`);
      } else if (reason === 'INVALID_SUPABASE_URL') {
        console.log(`     → URL must be a valid Supabase URL (contains .supabase.co)`);
      } else if (reason === 'KEY_TOO_SHORT') {
        console.log(`     → Key seems too short. Make sure you copied the entire key.`);
      }
    });
  }

  console.log('\n' + '═'.repeat(70));

  if (results.missing.length === 0 && results.invalid.length === 0) {
    console.log('\n✅ All Supabase environment variables are properly configured!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Restart your dev server: npm run dev');
    console.log('   2. Check browser console for any initialization errors');
    console.log('   3. Test database connection by using the app');
    return true;
  } else {
    console.log('\n❌ Please fix the issues above before using Supabase features.');
    return false;
  }
}

// Run verification
const success = verifySupabaseConfig();
process.exit(success ? 0 : 1);


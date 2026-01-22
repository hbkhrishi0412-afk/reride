import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found');
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf-8');
const lines = content.split('\n');

const requiredVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

console.log('\n🔍 Verifying Supabase Environment Variables...\n');
console.log('═'.repeat(70));

const env = {};
lines.forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }
});

let allValid = true;
const results = { valid: [], invalid: [], missing: [] };

requiredVars.forEach(varName => {
  const value = env[varName];
  
  if (!value) {
    results.missing.push(varName);
    console.log(`❌ ${varName}: MISSING`);
    allValid = false;
  } else {
    // Check for placeholders
    const placeholders = [
      'your-',
      'YOUR_',
      'your-project-ref',
      'your_supabase',
      'your_anon_key',
      'your_service_role',
    ];
    
    const hasPlaceholder = placeholders.some(p => value.includes(p));
    
    // Validate URL format
    let isValid = true;
    let reason = '';
    
    if (varName.includes('URL')) {
      if (!value.startsWith('https://')) {
        isValid = false;
        reason = 'INVALID_URL_FORMAT';
      } else if (!value.includes('.supabase.co')) {
        isValid = false;
        reason = 'INVALID_SUPABASE_URL';
      }
    }
    
    // Validate key length
    if (varName.includes('KEY')) {
      if (value.length < 50) {
        isValid = false;
        reason = 'KEY_TOO_SHORT';
      }
    }
    
    if (hasPlaceholder) {
      isValid = false;
      reason = 'PLACEHOLDER';
    }
    
    if (!isValid) {
      results.invalid.push({ var: varName, reason });
      const masked = varName.includes('KEY') || varName.includes('SECRET')
        ? `${value.substring(0, 15)}...${value.substring(value.length - 10)}`
        : value;
      console.log(`⚠️  ${varName}: INVALID (${reason})`);
      console.log(`   Value: ${masked}`);
      allValid = false;
    } else {
      results.valid.push(varName);
      const masked = varName.includes('KEY') || varName.includes('SECRET')
        ? `${value.substring(0, 15)}...${value.substring(value.length - 10)}`
        : value;
      console.log(`✅ ${varName}: VALID`);
      console.log(`   Value: ${masked}`);
    }
  }
});

console.log('\n' + '═'.repeat(70));
console.log(`\n📊 Summary:`);
console.log(`   ✅ Valid: ${results.valid.length}/${requiredVars.length}`);
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

if (allValid) {
  console.log('\n✅ All Supabase environment variables are properly configured!');
  console.log('\n💡 Next Steps:');
  console.log('   1. Restart your dev server: npm run dev');
  console.log('   2. Check browser console for any initialization errors');
  console.log('   3. Test database connection by using the app');
  process.exit(0);
} else {
  console.log('\n❌ Please fix the issues above before using Supabase features.');
  process.exit(1);
}


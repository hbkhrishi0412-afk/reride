#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');

console.log('🔍 Checking Supabase Environment Variables...\n');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found!');
  console.log('   Create .env.local in the project root and add Supabase variables.');
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const lines = content.split('\n');

const requiredVars = {
  client: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  server: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
};

const found = {};
const missing = [];
const invalid = [];

// Parse env file
lines.forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      found[key] = value;
    }
  }
});

// Check all required variables
const allVars = [...requiredVars.client, ...requiredVars.server];
allVars.forEach(varName => {
  const value = found[varName];
  
  if (!value) {
    missing.push(varName);
    console.log(`❌ ${varName}: MISSING`);
  } else if (value.includes('your-') || value.includes('YOUR_') || value.includes('your-project-ref') || value.includes('your_anon_key') || value.includes('your_service_role')) {
    invalid.push(varName);
    console.log(`⚠️  ${varName}: PLACEHOLDER VALUE (not replaced)`);
  } else if (varName.includes('URL') && (!value.startsWith('https://') || !value.includes('.supabase.co'))) {
    invalid.push(varName);
    console.log(`⚠️  ${varName}: INVALID URL FORMAT`);
  } else if (varName.includes('KEY') && value.length < 50) {
    invalid.push(varName);
    console.log(`⚠️  ${varName}: KEY TOO SHORT (may be incomplete)`);
  } else {
    const masked = varName.includes('KEY') 
      ? `${value.substring(0, 20)}...${value.substring(value.length - 10)}`
      : value;
    console.log(`✅ ${varName}: VALID`);
    console.log(`   Value: ${masked}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Summary:`);
console.log(`   ✅ Valid: ${allVars.length - missing.length - invalid.length}/${allVars.length}`);
console.log(`   ❌ Missing: ${missing.length}`);
console.log(`   ⚠️  Invalid: ${invalid.length}`);

if (missing.length > 0) {
  console.log(`\n❌ Missing Variables:`);
  missing.forEach(v => console.log(`   - ${v}`));
}

if (invalid.length > 0) {
  console.log(`\n⚠️  Invalid Variables:`);
  invalid.forEach(v => console.log(`   - ${v}`));
}

console.log('\n' + '='.repeat(60));

if (missing.length === 0 && invalid.length === 0) {
  console.log('\n✅ All Supabase environment variables are properly configured!');
  console.log('\n💡 Next Steps:');
  console.log('   1. Restart your dev server: npm run dev');
  console.log('   2. Check browser console for Supabase initialization');
  console.log('   3. Test the application features');
  process.exit(0);
} else {
  console.log('\n❌ Please fix the issues above.');
  process.exit(1);
}


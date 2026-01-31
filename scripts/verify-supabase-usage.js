#!/usr/bin/env node

/**
 * Verify if the website is using Supabase
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

// Check 1: Supabase library files
function checkSupabaseFiles() {
  logSection('1. Checking Supabase Library Files');
  
  const files = [
    'lib/supabase.ts',
    'services/supabase-user-service.ts',
    'services/supabase-vehicle-service.ts',
    'services/supabase-conversation-service.ts',
    'server/supabase-auth.ts'
  ];
  
  let allExist = true;
  files.forEach(file => {
    const exists = fs.existsSync(file);
    if (exists) {
      log(`✅ ${file}`, 'green');
    } else {
      log(`❌ ${file} - MISSING`, 'red');
      allExist = false;
    }
  });
  
  return allExist;
}

// Check 2: Environment variables
function checkEnvironmentVariables() {
  logSection('2. Checking Environment Variables');
  
  const envFiles = ['.env.local', '.env'];
  let envContent = '';
  let envFile = '';
  
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      envContent = fs.readFileSync(file, 'utf8');
      envFile = file;
      break;
    }
  }
  
  if (!envContent) {
    log('⚠️ No .env.local or .env file found', 'yellow');
    log('   Create .env.local and add Supabase variables', 'yellow');
    return false;
  }
  
  log(`📄 Found ${envFile}`, 'blue');
  
  const requiredVars = {
    client: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    server: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  };
  
  let allSet = true;
  
  log('\n📱 Client-side variables:', 'blue');
  requiredVars.client.forEach(varName => {
    const hasVar = envContent.includes(varName) && 
                   !envContent.match(new RegExp(`${varName}\\s*=\\s*['"]?['"]`)) &&
                   !envContent.includes(`${varName}=your-`) &&
                   !envContent.includes(`${varName}=https://your-project`);
    if (hasVar) {
      log(`   ✅ ${varName}`, 'green');
    } else {
      log(`   ❌ ${varName} - MISSING or placeholder`, 'red');
      allSet = false;
    }
  });
  
  log('\n🖥️  Server-side variables:', 'blue');
  requiredVars.server.forEach(varName => {
    const hasVar = envContent.includes(varName) && 
                   !envContent.match(new RegExp(`${varName}\\s*=\\s*['"]?['"]`)) &&
                   !envContent.includes(`${varName}=your-`) &&
                   !envContent.includes(`${varName}=https://your-project`);
    if (hasVar) {
      log(`   ✅ ${varName}`, 'green');
    } else {
      log(`   ❌ ${varName} - MISSING or placeholder`, 'red');
      allSet = false;
    }
  });
  
  return allSet;
}

// Check 3: API usage
function checkAPIUsage() {
  logSection('3. Checking API Usage of Supabase');
  
  const apiFile = 'api/main.ts';
  if (!fs.existsSync(apiFile)) {
    log(`❌ ${apiFile} not found`, 'red');
    return false;
  }
  
  const content = fs.readFileSync(apiFile, 'utf8');
  
  const checks = [
    { pattern: /supabaseUserService|supabaseVehicleService|supabaseConversationService/, name: 'Supabase services imported' },
    { pattern: /getSupabaseAdminClient|getSupabaseClient/, name: 'Supabase client functions used' },
    { pattern: /USE_SUPABASE/, name: 'USE_SUPABASE flag' },
    { pattern: /getSupabaseErrorMessage/, name: 'Supabase error handling' }
  ];
  
  let allFound = true;
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      log(`✅ ${check.name}`, 'green');
    } else {
      log(`❌ ${check.name} - NOT FOUND`, 'red');
      allFound = false;
    }
  });
  
  // Check for Firebase (should NOT be present)
  if (content.includes('firebaseUserService') || content.includes('USE_FIREBASE')) {
    log(`⚠️  Firebase references still found in API`, 'yellow');
  } else {
    log(`✅ No Firebase references in API`, 'green');
  }
  
  return allFound;
}

// Check 4: Package.json
function checkPackageJson() {
  logSection('4. Checking package.json');
  
  const packageFile = 'package.json';
  if (!fs.existsSync(packageFile)) {
    log(`❌ ${packageFile} not found`, 'red');
    return false;
  }
  
  const content = fs.readFileSync(packageFile, 'utf8');
  const packageJson = JSON.parse(content);
  
  // Check for Supabase package
  const hasSupabase = packageJson.dependencies && packageJson.dependencies['@supabase/supabase-js'];
  if (hasSupabase) {
    log(`✅ @supabase/supabase-js installed (v${packageJson.dependencies['@supabase/supabase-js']})`, 'green');
  } else {
    log(`❌ @supabase/supabase-js NOT installed`, 'red');
    return false;
  }
  
  // Check for Firebase (should NOT be present)
  const hasFirebase = packageJson.dependencies && 
                     (packageJson.dependencies['firebase'] || packageJson.dependencies['firebase-admin']);
  if (hasFirebase) {
    log(`⚠️  Firebase packages still in dependencies`, 'yellow');
    log(`   Run: npm uninstall firebase firebase-admin`, 'yellow');
  } else {
    log(`✅ No Firebase packages in dependencies`, 'green');
  }
  
  return true;
}

// Check 5: Component usage
function checkComponentUsage() {
  logSection('5. Checking Component Usage');
  
  const files = [
    'App.tsx',
    'components/AppProvider.tsx'
  ];
  
  let allGood = true;
  files.forEach(file => {
    if (!fs.existsSync(file)) {
      log(`⚠️  ${file} not found`, 'yellow');
      return;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    if (content.includes('supabase') || content.includes('Supabase')) {
      log(`✅ ${file} uses Supabase`, 'green');
    } else if (content.includes('firebase') || content.includes('Firebase')) {
      log(`⚠️  ${file} still has Firebase references`, 'yellow');
      allGood = false;
    } else {
      log(`ℹ️  ${file} - no direct Supabase/Firebase references`, 'blue');
    }
  });
  
  return allGood;
}

// Generate summary
function generateSummary(results) {
  logSection('📊 Verification Summary');
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    log('✅ Your website IS using Supabase!', 'green');
    log('\nAll checks passed:', 'green');
    log('  ✅ Supabase library files exist', 'green');
    log('  ✅ Environment variables configured', 'green');
    log('  ✅ API uses Supabase services', 'green');
    log('  ✅ Supabase package installed', 'green');
    log('  ✅ Components configured for Supabase', 'green');
  } else {
    log('⚠️  Your website is PARTIALLY using Supabase', 'yellow');
    log('\nIssues found:', 'yellow');
    
    if (!results.files) {
      log('  ❌ Supabase library files missing', 'red');
    }
    if (!results.env) {
      log('  ❌ Environment variables not configured', 'red');
      log('     Add Supabase variables to .env.local', 'yellow');
    }
    if (!results.api) {
      log('  ❌ API not fully using Supabase', 'red');
    }
    if (!results.package) {
      log('  ❌ Supabase package not installed', 'red');
      log('     Run: npm install @supabase/supabase-js', 'yellow');
    }
    if (!results.components) {
      log('  ⚠️  Some components may still reference Firebase', 'yellow');
    }
  }
  
  log('\n' + '='.repeat(60));
}

// Main function
async function main() {
  log('\n🔍 Supabase Usage Verification', 'cyan');
  log('Checking if your website is using Supabase...\n', 'blue');
  
  const results = {
    files: checkSupabaseFiles(),
    env: checkEnvironmentVariables(),
    api: checkAPIUsage(),
    package: checkPackageJson(),
    components: checkComponentUsage()
  };
  
  generateSummary(results);
  
  log('\n✅ Verification complete!\n', 'green');
}

main().catch(err => {
  log(`\n❌ Verification error: ${err.message}`, 'red');
  process.exit(1);
});







#!/usr/bin/env node
/**
 * Diagnostic script to check Supabase configuration for production
 * This helps identify why user details might not be getting added to Supabase
 */

import https from 'https';

// Color codes for terminal output
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

function checkEnvVar(name, value, isRequired = true) {
  const exists = value && value.trim() !== '';
  const isPlaceholder = value && (
    value.includes('your-') ||
    value.includes('YOUR_') ||
    value.includes('your-project-ref') ||
    value.includes('your_supabase')
  );

  if (!exists) {
    if (isRequired) {
      log(`❌ ${name}: MISSING (REQUIRED)`, 'red');
      return { exists: false, valid: false, isPlaceholder: false };
    } else {
      log(`⚠️  ${name}: Not set (optional)`, 'yellow');
      return { exists: false, valid: true, isPlaceholder: false };
    }
  }

  if (isPlaceholder) {
    log(`⚠️  ${name}: Contains placeholder value`, 'yellow');
    return { exists: true, valid: false, isPlaceholder: true };
  }

  // Validate format
  if (name.includes('URL') && (!value.startsWith('https://') || !value.includes('.supabase.co'))) {
    log(`⚠️  ${name}: Invalid URL format`, 'yellow');
    return { exists: true, valid: false, isPlaceholder: false };
  }

  if (name.includes('KEY') && value.length < 100) {
    log(`⚠️  ${name}: Key seems too short (may be invalid)`, 'yellow');
    return { exists: true, valid: false, isPlaceholder: false };
  }

  log(`✅ ${name}: Configured`, 'green');
  return { exists: true, valid: true, isPlaceholder: false };
}

async function testSupabaseConnection(url, anonKey) {
  return new Promise((resolve) => {
    if (!url || !anonKey) {
      resolve({ success: false, error: 'Missing URL or key' });
      return;
    }

    // Test connection by querying a simple endpoint
    const testUrl = new URL('/rest/v1/', url);
    
    const options = {
      hostname: testUrl.hostname,
      path: testUrl.pathname,
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 401) {
          // 401 is expected for anon key without proper auth, but means connection works
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          resolve({ success: false, statusCode: res.statusCode, error: data });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ success: false, error: 'Connection timeout' });
    });

    req.end();
  });
}

async function main() {
  log('\n🔍 Supabase Production Configuration Diagnostic\n', 'cyan');
  log('This script checks your Supabase configuration to identify why user details might not be getting added.\n');

  // Check environment variables
  log('📋 Checking Environment Variables...\n', 'blue');

  const clientVars = {
    'VITE_SUPABASE_URL': process.env.VITE_SUPABASE_URL,
    'VITE_SUPABASE_ANON_KEY': process.env.VITE_SUPABASE_ANON_KEY,
  };

  const serverVars = {
    'SUPABASE_URL': process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  log('Client-side variables (for React app):', 'cyan');
  const clientResults = {};
  for (const [name, value] of Object.entries(clientVars)) {
    clientResults[name] = checkEnvVar(name, value, true);
  }

  log('\nServer-side variables (for API routes):', 'cyan');
  const serverResults = {};
  for (const [name, value] of Object.entries(serverVars)) {
    const isRequired = name !== 'SUPABASE_SERVICE_ROLE_KEY' || true; // Service role is critical for user creation
    serverResults[name] = checkEnvVar(name, value, isRequired);
  }

  // Check for critical issues
  log('\n🔴 Critical Issues:', 'red');
  const criticalIssues = [];

  if (!serverResults.SUPABASE_SERVICE_ROLE_KEY?.exists || !serverResults.SUPABASE_SERVICE_ROLE_KEY?.valid) {
    criticalIssues.push({
      issue: 'SUPABASE_SERVICE_ROLE_KEY is missing or invalid',
      impact: 'User registration will FAIL because the API cannot bypass RLS policies',
      solution: 'Set SUPABASE_SERVICE_ROLE_KEY in your Vercel environment variables'
    });
  }

  if (!serverResults.SUPABASE_URL?.exists || !serverResults.SUPABASE_URL?.valid) {
    criticalIssues.push({
      issue: 'SUPABASE_URL is missing or invalid',
      impact: 'API cannot connect to Supabase',
      solution: 'Set SUPABASE_URL in your Vercel environment variables'
    });
  }

  if (!serverResults.SUPABASE_ANON_KEY?.exists || !serverResults.SUPABASE_ANON_KEY?.valid) {
    criticalIssues.push({
      issue: 'SUPABASE_ANON_KEY is missing or invalid',
      impact: 'API cannot authenticate with Supabase',
      solution: 'Set SUPABASE_ANON_KEY in your Vercel environment variables'
    });
  }

  if (criticalIssues.length === 0) {
    log('✅ No critical issues found!', 'green');
  } else {
    criticalIssues.forEach((issue, index) => {
      log(`\n${index + 1}. ${issue.issue}`, 'red');
      log(`   Impact: ${issue.impact}`, 'yellow');
      log(`   Solution: ${issue.solution}`, 'cyan');
    });
  }

  // Test connection
  log('\n🌐 Testing Supabase Connection...\n', 'blue');
  const connectionTest = await testSupabaseConnection(
    serverVars.SUPABASE_URL,
    serverVars.SUPABASE_ANON_KEY
  );

  if (connectionTest.success) {
    log('✅ Supabase connection successful', 'green');
  } else {
    log('❌ Supabase connection failed', 'red');
    if (connectionTest.error) {
      log(`   Error: ${connectionTest.error}`, 'yellow');
    }
    if (connectionTest.statusCode) {
      log(`   Status Code: ${connectionTest.statusCode}`, 'yellow');
    }
  }

  // Recommendations
  log('\n💡 Recommendations:', 'cyan');
  log('\n1. For Vercel Production:', 'blue');
  log('   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  log('   - Add these variables (if not already set):');
  log('     • SUPABASE_URL');
  log('     • SUPABASE_ANON_KEY');
  log('     • SUPABASE_SERVICE_ROLE_KEY (CRITICAL for user registration)');
  log('   - Make sure to set them for "Production" environment');
  log('   - Redeploy after adding variables');

  log('\n2. Check RLS Policies:', 'blue');
  log('   - Go to Supabase Dashboard → Authentication → Policies');
  log('   - Check if "users" table has RLS enabled');
  log('   - If RLS is enabled, you need either:');
  log('     a) SUPABASE_SERVICE_ROLE_KEY set (bypasses RLS) - RECOMMENDED');
  log('     b) An INSERT policy for the users table');
  log('   - Run scripts/fix-users-insert-policy.sql if needed');

  log('\n3. Check Vercel Logs:', 'blue');
  log('   - Go to Vercel Dashboard → Your Project → Deployments → View Function Logs');
  log('   - Look for errors containing:');
  log('     • "SUPABASE_SERVICE_ROLE_KEY"');
  log('     • "permission denied"');
  log('     • "row-level security"');
  log('     • "RLS Policy"');

  log('\n4. Test User Registration:', 'blue');
  log('   - Try registering a new user');
  log('   - Check Vercel function logs for detailed error messages');
  log('   - Check Supabase Dashboard → Table Editor → users table');

  // Summary
  log('\n📊 Summary:', 'cyan');
  const hasAllRequired = 
    serverResults.SUPABASE_URL?.valid &&
    serverResults.SUPABASE_ANON_KEY?.valid &&
    serverResults.SUPABASE_SERVICE_ROLE_KEY?.valid;

  if (hasAllRequired && connectionTest.success) {
    log('✅ Configuration looks good!', 'green');
    log('   If users are still not being added, check:');
    log('   - RLS policies on users table');
    log('   - Vercel function logs for runtime errors');
    log('   - Supabase dashboard for any database errors');
  } else {
    log('❌ Configuration has issues that need to be fixed', 'red');
    log('   Fix the critical issues listed above and redeploy');
  }

  log('\n');
}

// Run if called directly
// Check if this is the main module (ES module equivalent of require.main === module)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('diagnose-production-supabase.js')) {
  main().catch((error) => {
    console.error('Error running diagnostic:', error);
    process.exit(1);
  });
}

export { main };


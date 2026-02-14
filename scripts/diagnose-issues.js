#!/usr/bin/env node

/**
 * Diagnostic script to identify vehicle loading and login issues
 */

const https = require('https');
const http = require('http');

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

async function checkApiServer() {
  logSection('1. Checking API Server');
  
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/vehicles',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const vehicles = JSON.parse(data);
            if (Array.isArray(vehicles)) {
              log(`✅ API server is running on port 3001`, 'green');
              log(`   Found ${vehicles.length} vehicles`, 'green');
              resolve({ success: true, vehicleCount: vehicles.length });
            } else {
              log(`⚠️ API server responded but returned invalid format`, 'yellow');
              resolve({ success: false, error: 'Invalid response format' });
            }
          } catch (e) {
            log(`⚠️ API server responded but response is not JSON`, 'yellow');
            resolve({ success: false, error: 'Invalid JSON response' });
          }
        } else {
          log(`⚠️ API server returned status ${res.statusCode}`, 'yellow');
          resolve({ success: false, error: `Status ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        log(`❌ API server is NOT running on port 3001`, 'red');
        log(`   Start it with: npm run dev:api`, 'yellow');
      } else {
        log(`❌ API server error: ${err.message}`, 'red');
      }
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      log(`❌ API server timeout (not responding)`, 'red');
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

async function checkEnvironmentVariables() {
  logSection('2. Checking Environment Variables');
  
  const requiredVars = {
    client: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    server: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    firebase: ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']
  };

  let allGood = true;

  // Check client-side vars (would be in .env.local)
  log('\n📱 Client-side variables (VITE_*):', 'blue');
  requiredVars.client.forEach(varName => {
    // Note: We can't read .env.local directly in Node, but we can check if it exists
    log(`   ${varName}: ${process.env[varName] ? '✅ Set' : '❌ Missing'}`, 
        process.env[varName] ? 'green' : 'red');
    if (!process.env[varName]) allGood = false;
  });

  // Check server-side vars
  log('\n🖥️  Server-side variables:', 'blue');
  requiredVars.server.forEach(varName => {
    log(`   ${varName}: ${process.env[varName] ? '✅ Set' : '❌ Missing'}`, 
        process.env[varName] ? 'green' : 'red');
    if (!process.env[varName]) allGood = false;
  });

  // Check Firebase vars
  log('\n🔥 Firebase variables:', 'blue');
  requiredVars.firebase.forEach(varName => {
    log(`   ${varName}: ${process.env[varName] ? '✅ Set' : '❌ Missing'}`, 
        process.env[varName] ? 'green' : 'red');
    if (!process.env[varName]) allGood = false;
  });

  if (!allGood) {
    log('\n⚠️  Some environment variables are missing!', 'yellow');
    log('   Check your .env.local file and ensure all required variables are set.', 'yellow');
  }

  return { success: allGood };
}

async function testLogin() {
  logSection('3. Testing Login Endpoint');
  
  return new Promise((resolve) => {
    const testCredentials = {
      action: 'login',
      email: 'test@example.com',
      password: 'testpassword',
      role: 'customer'
    };

    const postData = JSON.stringify(testCredentials);

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 401) {
            log(`✅ Login endpoint is working (returned expected 401 for invalid credentials)`, 'green');
            resolve({ success: true, message: 'Endpoint working' });
          } else if (res.statusCode === 200 && result.success) {
            log(`✅ Login endpoint is working (test login succeeded)`, 'green');
            resolve({ success: true, message: 'Login working' });
          } else {
            log(`⚠️ Login endpoint returned unexpected response`, 'yellow');
            log(`   Status: ${res.statusCode}, Response: ${data.substring(0, 200)}`, 'yellow');
            resolve({ success: false, error: 'Unexpected response' });
          }
        } catch (e) {
          log(`⚠️ Login endpoint returned non-JSON response`, 'yellow');
          log(`   Response: ${data.substring(0, 200)}`, 'yellow');
          resolve({ success: false, error: 'Invalid JSON' });
        }
      });
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        log(`❌ Cannot test login - API server not running`, 'red');
      } else {
        log(`❌ Login test error: ${err.message}`, 'red');
      }
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      log(`❌ Login test timeout`, 'red');
      resolve({ success: false, error: 'Timeout' });
    });

    req.write(postData);
    req.end();
  });
}

function checkLocalStorage() {
  logSection('4. Checking Browser LocalStorage (Manual Check)');
  
  log('To check localStorage in your browser:', 'blue');
  log('1. Open browser DevTools (F12)', 'yellow');
  log('2. Go to Application/Storage tab → Local Storage', 'yellow');
  log('3. Check for these keys:', 'yellow');
  log('   - reRideVehicles_prod (should contain vehicles array)', 'yellow');
  log('   - reRideCurrentUser (should contain user object if logged in)', 'yellow');
  log('   - reRideAccessToken (should contain auth token if logged in)', 'yellow');
  log('\nIf these are missing or empty, the app will try to fetch from API.', 'yellow');
}

function generateReport(results) {
  logSection('📊 Diagnostic Report');
  
  const issues = [];
  const recommendations = [];

  if (!results.apiServer.success) {
    issues.push('API server is not running');
    recommendations.push('Start the API server: npm run dev:api');
  }

  if (!results.env.success) {
    issues.push('Missing environment variables');
    recommendations.push('Check .env.local file and ensure all required variables are set');
  }

  if (!results.login.success) {
    issues.push('Login endpoint may have issues');
    recommendations.push('Check API server logs for login errors');
  }

  if (issues.length === 0) {
    log('✅ No critical issues found!', 'green');
    log('\nIf you\'re still experiencing problems:', 'yellow');
    log('1. Check browser console for JavaScript errors', 'yellow');
    log('2. Check Network tab for failed API requests', 'yellow');
    log('3. Verify database has data (vehicles and users)', 'yellow');
    log('4. Clear browser cache and localStorage', 'yellow');
  } else {
    log('❌ Issues Found:', 'red');
    issues.forEach((issue, i) => {
      log(`   ${i + 1}. ${issue}`, 'red');
    });

    log('\n💡 Recommendations:', 'yellow');
    recommendations.forEach((rec, i) => {
      log(`   ${i + 1}. ${rec}`, 'yellow');
    });
  }

  log('\n' + '='.repeat(60));
}

async function main() {
  log('\n🔍 ReRide Diagnostic Tool', 'cyan');
  log('Checking for vehicle loading and login issues...\n', 'blue');

  const results = {
    apiServer: await checkApiServer(),
    env: await checkEnvironmentVariables(),
    login: await testLogin()
  };

  checkLocalStorage();
  generateReport(results);

  log('\n✅ Diagnostic complete!\n', 'green');
}

main().catch(err => {
  log(`\n❌ Diagnostic script error: ${err.message}`, 'red');
  process.exit(1);
});















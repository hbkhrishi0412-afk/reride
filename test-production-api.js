#!/usr/bin/env node
/**
 * Test Production API Endpoints
 * Verifies that the production API is working after MongoDB connection is fixed
 */

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(url, name) {
  try {
    log(`\n🧪 Testing ${name}...`, 'blue');
    log(`   URL: ${url}`, 'cyan');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const status = response.status;
    const statusText = response.statusText;
    
    if (status === 200 || status === 201) {
      log(`   ✅ Status: ${status} ${statusText}`, 'green');
      
      try {
        const data = await response.json();
        log(`   📦 Response: ${JSON.stringify(data).substring(0, 100)}...`, 'cyan');
        return { success: true, status, data };
      } catch (e) {
        const text = await response.text();
        log(`   📦 Response: ${text.substring(0, 100)}...`, 'cyan');
        return { success: true, status, text };
      }
    } else if (status === 503) {
      log(`   ❌ Status: ${status} ${statusText}`, 'red');
      log(`   ⚠️  Service Unavailable - Database connection issue!`, 'yellow');
      return { success: false, status, error: 'Service Unavailable' };
    } else {
      log(`   ⚠️  Status: ${status} ${statusText}`, 'yellow');
      try {
        const data = await response.json();
        log(`   📦 Response: ${JSON.stringify(data)}`, 'cyan');
      } catch (e) {
        const text = await response.text();
        log(`   📦 Response: ${text}`, 'cyan');
      }
      return { success: false, status };
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testProductionAPI() {
  console.log('\n' + '='.repeat(70));
  log('🔍 Production API Test', 'bright');
  console.log('='.repeat(70) + '\n');
  
  const baseUrl = process.argv[2] || 'https://www.reride.co.in';
  log(`🌐 Testing: ${baseUrl}`, 'cyan');
  
  const endpoints = [
    {
      url: `${baseUrl}/api/admin?action=health`,
      name: 'Health Check',
      critical: true,
    },
    {
      url: `${baseUrl}/api/users`,
      name: 'Users API',
      critical: true,
    },
    {
      url: `${baseUrl}/api/vehicles`,
      name: 'Vehicles API',
      critical: false,
    },
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.url, endpoint.name);
    results.push({ ...endpoint, ...result });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  log('📋 Test Summary', 'bright');
  console.log('='.repeat(70) + '\n');
  
  const criticalTests = results.filter(r => r.critical);
  const allCriticalPassed = criticalTests.every(r => r.success);
  const allPassed = results.every(r => r.success);
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`${icon} ${result.name}: ${result.success ? 'PASS' : 'FAIL'}`, color);
    if (result.status) {
      log(`   Status: ${result.status}`, 'cyan');
    }
  });
  
  console.log('');
  
  if (allCriticalPassed) {
    log('✅ All critical endpoints are working!', 'green');
    log('✅ MongoDB connection is working in production!', 'green');
  } else {
    log('❌ Some critical endpoints are failing', 'red');
    log('⚠️  Check Vercel environment variables and redeploy', 'yellow');
  }
  
  if (!allPassed && allCriticalPassed) {
    log('\n💡 Some non-critical endpoints may need attention', 'yellow');
  }
  
  console.log('');
  
  return allCriticalPassed;
}

// Run tests
testProductionAPI()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });


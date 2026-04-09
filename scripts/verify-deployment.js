#!/usr/bin/env node

/**
 * Deployment Verification Script
 * 
 * This script verifies that the Vehicle Management sync functionality
 * is working properly in the deployed environment.
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  // Update this URL to your deployed application
  BASE_URL: process.env.DEPLOYMENT_URL || 'https://your-app.vercel.app',
  TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000 // 2 seconds
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const requestOptions = {
      timeout: CONFIG.TIMEOUT,
      ...options
    };

    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function retryRequest(url, options = {}, attempts = CONFIG.RETRY_ATTEMPTS) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await makeRequest(url, options);
    } catch (error) {
      if (i === attempts) {
        throw error;
      }
      log(`Attempt ${i} failed, retrying in ${CONFIG.RETRY_DELAY}ms...`, 'yellow');
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
    }
  }
}

async function checkHealth() {
  log('\n🔍 Checking Database Health...', 'cyan');
  
  try {
    const response = await retryRequest(`${CONFIG.BASE_URL}/api/db-health`);
    
    if (response.status === 200 && response.data.success) {
      log('✅ Database health check passed', 'green');
      log(`   Database: ${response.data.details?.database || 'Unknown'}`, 'blue');
      log(`   Collections: ${response.data.details?.collections?.length || 0}`, 'blue');
      log(`   Vehicle Data Count: ${response.data.details?.vehicleDataCount || 0}`, 'blue');
      return true;
    } else {
      log('❌ Database health check failed', 'red');
      log(`   Status: ${response.status}`, 'red');
      log(`   Message: ${response.data.message || 'Unknown error'}`, 'red');
      return false;
    }
  } catch (error) {
    log('❌ Database health check failed with error', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkVehicleDataAPI() {
  log('\n🔍 Checking Vehicle Data API...', 'cyan');
  
  try {
    // Test GET request
    const getResponse = await retryRequest(`${CONFIG.BASE_URL}/api/vehicle-data`);
    
    if (getResponse.status === 200) {
      log('✅ Vehicle Data GET endpoint working', 'green');
      log(`   Data structure: ${typeof getResponse.data}`, 'blue');
      
      if (typeof getResponse.data === 'object') {
        const categories = Object.keys(getResponse.data);
        log(`   Categories: ${categories.join(', ')}`, 'blue');
      }
    } else {
      log('❌ Vehicle Data GET endpoint failed', 'red');
      log(`   Status: ${getResponse.status}`, 'red');
      return false;
    }

    // Test POST request with sample data
    const testData = {
      FOUR_WHEELER: [
        {
          name: "Test Make",
          models: [
            { name: "Test Model", variants: ["Test Variant"] }
          ]
        }
      ]
    };

    const postResponse = await retryRequest(`${CONFIG.BASE_URL}/api/vehicle-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    if (postResponse.status === 200 && postResponse.data.success) {
      log('✅ Vehicle Data POST endpoint working', 'green');
    } else {
      log('❌ Vehicle Data POST endpoint failed', 'red');
      log(`   Status: ${postResponse.status}`, 'red');
      return false;
    }

    return true;
  } catch (error) {
    log('❌ Vehicle Data API check failed with error', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkMainAPI() {
  log('\n🔍 Checking Main API Endpoints...', 'cyan');
  
  try {
    // Test consolidated endpoint
    const response = await retryRequest(`${CONFIG.BASE_URL}/api/vehicles?type=data`);
    
    if (response.status === 200) {
      log('✅ Consolidated vehicles endpoint working', 'green');
      return true;
    } else {
      log('❌ Consolidated vehicles endpoint failed', 'red');
      log(`   Status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log('❌ Main API check failed with error', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkFrontend() {
  log('\n🔍 Checking Frontend...', 'cyan');
  
  try {
    const response = await retryRequest(`${CONFIG.BASE_URL}/`);
    
    if (response.status === 200) {
      log('✅ Frontend is accessible', 'green');
      return true;
    } else {
      log('❌ Frontend check failed', 'red');
      log(`   Status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log('❌ Frontend check failed with error', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('🚀 Starting Deployment Verification...', 'bright');
  log(`📍 Target URL: ${CONFIG.BASE_URL}`, 'blue');
  
  const results = {
    health: false,
    vehicleDataAPI: false,
    mainAPI: false,
    frontend: false
  };

  // Run all checks
  results.health = await checkHealth();
  results.vehicleDataAPI = await checkVehicleDataAPI();
  results.mainAPI = await checkMainAPI();
  results.frontend = await checkFrontend();

  // Summary
  log('\n📊 Verification Summary:', 'bright');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  const checks = [
    { name: 'Database Health', result: results.health },
    { name: 'Vehicle Data API', result: results.vehicleDataAPI },
    { name: 'Main API', result: results.mainAPI },
    { name: 'Frontend', result: results.frontend }
  ];

  let allPassed = true;
  
  checks.forEach(check => {
    const status = check.result ? '✅ PASS' : '❌ FAIL';
    const color = check.result ? 'green' : 'red';
    log(`   ${check.name}: ${status}`, color);
    if (!check.result) allPassed = false;
  });

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  if (allPassed) {
    log('\n🎉 All checks passed! Vehicle Management sync should be working properly.', 'green');
    log('💡 You can now test the sync functionality in your deployed application.', 'blue');
  } else {
    log('\n⚠️  Some checks failed. Please review the issues above.', 'yellow');
    log('💡 Common solutions:', 'blue');
    log('   - Check MONGODB_URI environment variable in Vercel dashboard', 'blue');
    log('   - Ensure MongoDB database is accessible from Vercel', 'blue');
    log('   - Verify API endpoints are properly deployed', 'blue');
    log('   - Check Vercel function logs for detailed error messages', 'blue');
  }

  process.exit(allPassed ? 0 : 1);
}

// Handle command line arguments
if (process.argv.length > 2) {
  CONFIG.BASE_URL = process.argv[2];
}

// Run the verification
main().catch(error => {
  log(`\n💥 Verification script failed: ${error.message}`, 'red');
  process.exit(1);
});

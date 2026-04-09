#!/usr/bin/env node

/**
 * Category Sync Test Script
 * 
 * This script tests the category synchronization between Admin Dashboard and Seller Dashboard
 */

import https from 'https';
import http from 'http';

// Configuration
const CONFIG = {
  BASE_URL: process.env.DEPLOYMENT_URL || 'http://localhost:5173',
  TIMEOUT: 10000,
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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

async function testCategoryConsistency() {
  log('\n🔍 Testing Category Consistency...', 'cyan');
  
  try {
    // Test vehicle data endpoint
    const response = await makeRequest(`${CONFIG.BASE_URL}/api/vehicle-data`);
    
    if (response.status === 200 && response.data) {
      const categories = Object.keys(response.data);
      log(`✅ Vehicle data loaded successfully`, 'green');
      log(`   Categories found: ${categories.length}`, 'blue');
      log(`   Categories: ${categories.join(', ')}`, 'blue');
      
      // Check if all expected categories are present
      const expectedCategories = [
        'FOUR_WHEELER',
        'TWO_WHEELER', 
        'THREE_WHEELER',
        'COMMERCIAL',
        'FARM',
        'CONSTRUCTION'
      ];
      
      const missingCategories = expectedCategories.filter(cat => !categories.includes(cat));
      const extraCategories = categories.filter(cat => !expectedCategories.includes(cat));
      
      if (missingCategories.length === 0 && extraCategories.length === 0) {
        log('✅ All expected categories are present', 'green');
        return true;
      } else {
        if (missingCategories.length > 0) {
          log(`❌ Missing categories: ${missingCategories.join(', ')}`, 'red');
        }
        if (extraCategories.length > 0) {
          log(`⚠️ Extra categories: ${extraCategories.join(', ')}`, 'yellow');
        }
        return false;
      }
    } else {
      log('❌ Failed to load vehicle data', 'red');
      log(`   Status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log('❌ Category consistency test failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testCategoryPersistence() {
  log('\n🔍 Testing Category Persistence...', 'cyan');
  
  try {
    // First, get current data
    const getResponse = await makeRequest(`${CONFIG.BASE_URL}/api/vehicle-data`);
    
    if (getResponse.status !== 200) {
      log('❌ Failed to get current vehicle data', 'red');
      return false;
    }
    
    const currentData = getResponse.data;
    const originalCategoryCount = Object.keys(currentData).length;
    
    // Add a test category
    const testData = {
      ...currentData,
      TEST_CATEGORY: [
        {
          name: "Test Make",
          models: [
            { name: "Test Model", variants: ["Test Variant"] }
          ]
        }
      ]
    };
    
    // Save the test data
    const saveResponse = await makeRequest(`${CONFIG.BASE_URL}/api/vehicle-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    if (saveResponse.status !== 200 || !saveResponse.data.success) {
      log('❌ Failed to save test category', 'red');
      return false;
    }
    
    log('✅ Test category saved successfully', 'green');
    
    // Verify the category was saved
    const verifyResponse = await makeRequest(`${CONFIG.BASE_URL}/api/vehicle-data`);
    
    if (verifyResponse.status === 200 && verifyResponse.data) {
      const newCategoryCount = Object.keys(verifyResponse.data).length;
      const hasTestCategory = verifyResponse.data.TEST_CATEGORY;
      
      if (newCategoryCount > originalCategoryCount && hasTestCategory) {
        log('✅ Test category persisted successfully', 'green');
        
        // Clean up - restore original data
        const restoreResponse = await makeRequest(`${CONFIG.BASE_URL}/api/vehicle-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(currentData)
        });
        
        if (restoreResponse.status === 200) {
          log('✅ Original data restored', 'green');
        } else {
          log('⚠️ Failed to restore original data', 'yellow');
        }
        
        return true;
      } else {
        log('❌ Test category was not persisted', 'red');
        return false;
      }
    } else {
      log('❌ Failed to verify test category', 'red');
      return false;
    }
  } catch (error) {
    log('❌ Category persistence test failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testCategorySync() {
  log('\n🔍 Testing Category Sync...', 'cyan');
  
  try {
    // Test both endpoints return the same data
    const endpoint1Response = await makeRequest(`${CONFIG.BASE_URL}/api/vehicle-data`);
    const endpoint2Response = await makeRequest(`${CONFIG.BASE_URL}/api/vehicles?type=data`);
    
    if (endpoint1Response.status === 200 && endpoint2Response.status === 200) {
      const data1 = endpoint1Response.data;
      const data2 = endpoint2Response.data;
      
      const categories1 = Object.keys(data1).sort();
      const categories2 = Object.keys(data2).sort();
      
      if (JSON.stringify(categories1) === JSON.stringify(categories2)) {
        log('✅ Both endpoints return consistent category data', 'green');
        return true;
      } else {
        log('❌ Endpoints return different category data', 'red');
        log(`   Endpoint 1 categories: ${categories1.join(', ')}`, 'red');
        log(`   Endpoint 2 categories: ${categories2.join(', ')}`, 'red');
        return false;
      }
    } else {
      log('❌ Failed to test category sync', 'red');
      log(`   Endpoint 1 status: ${endpoint1Response.status}`, 'red');
      log(`   Endpoint 2 status: ${endpoint2Response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log('❌ Category sync test failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('🚀 Starting Category Sync Tests...', 'bright');
  log(`📍 Target URL: ${CONFIG.BASE_URL}`, 'blue');
  
  const results = {
    consistency: false,
    persistence: false,
    sync: false
  };

  // Run all tests
  results.consistency = await testCategoryConsistency();
  results.persistence = await testCategoryPersistence();
  results.sync = await testCategorySync();

  // Summary
  log('\n📊 Test Results Summary:', 'bright');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  const tests = [
    { name: 'Category Consistency', result: results.consistency },
    { name: 'Category Persistence', result: results.persistence },
    { name: 'Category Sync', result: results.sync }
  ];

  let allPassed = true;
  
  tests.forEach(test => {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    const color = test.result ? 'green' : 'red';
    log(`   ${test.name}: ${status}`, color);
    if (!test.result) allPassed = false;
  });

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  if (allPassed) {
    log('\n🎉 All category tests passed!', 'green');
    log('💡 Category synchronization is working properly.', 'blue');
    log('💡 Admin Dashboard and Seller Dashboard should now show consistent categories.', 'blue');
  } else {
    log('\n⚠️  Some category tests failed.', 'yellow');
    log('💡 Please check the issues above and verify your deployment.', 'blue');
  }

  process.exit(allPassed ? 0 : 1);
}

// Handle command line arguments
if (process.argv.length > 2) {
  CONFIG.BASE_URL = process.argv[2];
}

// Run the tests
main().catch(error => {
  log(`\n💥 Test script failed: ${error.message}`, 'red');
  process.exit(1);
});

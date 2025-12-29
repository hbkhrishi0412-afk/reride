/**
 * Critical Features Test Suite
 * Tests all critical functionality to ensure 100% accuracy
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';
const API_URL = `${BASE_URL}/api`;

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper function to make API requests
async function testEndpoint(method, endpoint, body = null, description) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (response.ok) {
      results.passed.push(`✅ ${description}`);
      return { success: true, data };
    } else {
      results.failed.push(`❌ ${description}: ${response.status} - ${data.error || data.message || 'Unknown error'}`);
      return { success: false, error: data };
    }
  } catch (error) {
    results.failed.push(`❌ ${description}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test suite
async function runTests() {
  console.log('🧪 Starting Critical Features Test Suite...\n');
  
  // 1. Database Health Check
  console.log('1. Testing Database Health...');
  await testEndpoint('GET', '/db-health', null, 'Database health check');
  
  // 2. System Connection Test
  console.log('2. Testing System Connection...');
  await testEndpoint('GET', '/system?action=test-connection', null, 'System connection test');
  
  // 3. Get Vehicles (should return array)
  console.log('3. Testing Vehicle Listings...');
  const vehiclesTest = await testEndpoint('GET', '/vehicles', null, 'Get vehicles list');
  if (vehiclesTest.success && Array.isArray(vehiclesTest.data)) {
    results.passed.push('✅ Vehicles endpoint returns array');
  } else {
    results.warnings.push('⚠️ Vehicles endpoint may not return expected format');
  }
  
  // 4. Get Users (should return array)
  console.log('4. Testing User Management...');
  const usersTest = await testEndpoint('GET', '/users', null, 'Get users list');
  if (usersTest.success && Array.isArray(usersTest.data)) {
    results.passed.push('✅ Users endpoint returns array');
  } else {
    results.warnings.push('⚠️ Users endpoint may not return expected format');
  }
  
  // 5. Vehicle Data Endpoint
  console.log('5. Testing Vehicle Data...');
  await testEndpoint('GET', '/vehicles?type=data', null, 'Get vehicle data (brands/models)');
  
  // 6. FAQs Endpoint
  console.log('6. Testing FAQs...');
  await testEndpoint('GET', '/faqs', null, 'Get FAQs');
  
  // 7. Content Endpoint
  console.log('7. Testing Content...');
  await testEndpoint('GET', '/content?type=faqs', null, 'Get content (FAQs)');
  
  // 8. Admin Endpoint (should handle unauthorized gracefully)
  console.log('8. Testing Admin Endpoint...');
  const adminTest = await testEndpoint('GET', '/admin', null, 'Admin endpoint (unauthorized)');
  if (!adminTest.success && (adminTest.error?.error === 'Unauthorized' || adminTest.error?.reason === 'Unauthorized')) {
    results.passed.push('✅ Admin endpoint properly handles unauthorized access');
  }
  
  // 9. AI/Gemini Endpoint (should handle missing key gracefully)
  console.log('9. Testing AI Endpoint...');
  await testEndpoint('POST', '/ai', { prompt: 'test' }, 'AI endpoint (may require API key)');
  
  // 10. Health Check with detailed status
  console.log('10. Testing Detailed Health Status...');
  await testEndpoint('GET', '/system?action=health', null, 'Detailed health status');
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${results.passed.length}`);
  results.passed.forEach(result => console.log(`   ${result}`));
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${results.warnings.length}`);
    results.warnings.forEach(warning => console.log(`   ${warning}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(failure => console.log(`   ${failure}`));
  }
  
  console.log('\n' + '='.repeat(60));
  const totalTests = results.passed.length + results.failed.length;
  const passRate = totalTests > 0 ? ((results.passed.length / totalTests) * 100).toFixed(1) : 0;
  console.log(`\n📈 Pass Rate: ${passRate}%`);
  console.log(`✅ Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log('='.repeat(60) + '\n');
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ with fetch API or run in browser');
  console.log('💡 To run in Node.js, use: node --experimental-fetch test-critical-features.js');
  process.exit(1);
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});


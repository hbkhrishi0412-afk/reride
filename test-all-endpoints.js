#!/usr/bin/env node

/**
 * Comprehensive test script to verify all API endpoints
 * Tests: Vehicles, Users, FAQs, Support Tickets, Admin Logs
 */

const API_BASE_URL = 'http://localhost:3001';

// Test helper functions
async function testEndpoint(method, endpoint, data = null, description = '') {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        const url = endpoint.includes('?') 
            ? `${API_BASE_URL}${endpoint}`
            : `${API_BASE_URL}${endpoint}`;
        
        const response = await fetch(url, options);
        const responseData = await response.json();
        
        return {
            success: response.ok,
            status: response.status,
            data: responseData,
            description: description || `${method} ${endpoint}`
        };
    } catch (error) {
        return {
            success: false,
            status: 0,
            error: error.message,
            description: description || `${method} ${endpoint}`
        };
    }
}

// Test results tracker
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(result) {
    results.tests.push(result);
    if (result.success) {
        results.passed++;
        console.log(`✅ ${result.description} - Status: ${result.status}`);
    } else {
        results.failed++;
        console.log(`❌ ${result.description} - Status: ${result.status}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        } else if (result.data?.error) {
            console.log(`   Error: ${result.data.error}`);
        }
    }
}

async function runTests() {
    console.log('🧪 Starting comprehensive API endpoint tests...\n');
    console.log(`📍 Testing API at: ${API_BASE_URL}\n`);
    
    // Test Health Check
    console.log('📋 Testing Health Check...');
    logTest(await testEndpoint('GET', '/api/health', null, 'Health Check'));
    console.log('');
    
    // Test Vehicles
    console.log('🚗 Testing Vehicles Endpoints...');
    logTest(await testEndpoint('GET', '/api/vehicles', null, 'GET all vehicles'));
    
    const createVehicleResult = await testEndpoint('POST', '/api/vehicles', {
        id: Date.now(),
        category: 'FOUR_WHEELER',
        make: 'Test Make',
        model: 'Test Model',
        year: 2023,
        price: 500000,
        mileage: 10000,
        sellerEmail: 'test@example.com',
        sellerName: 'Test Seller'
    }, 'POST create vehicle');
    logTest(createVehicleResult);
    
    if (createVehicleResult.success && createVehicleResult.data?.id) {
        const vehicleId = createVehicleResult.data.id;
        logTest(await testEndpoint('GET', `/api/vehicles?id=${vehicleId}`, null, 'GET single vehicle'));
        logTest(await testEndpoint('PUT', `/api/vehicles?id=${vehicleId}`, { price: 550000 }, 'PUT update vehicle'));
        logTest(await testEndpoint('DELETE', `/api/vehicles?id=${vehicleId}`, null, 'DELETE vehicle'));
    }
    console.log('');
    
    // Test Users
    console.log('👥 Testing Users Endpoints...');
    logTest(await testEndpoint('GET', '/api/users', null, 'GET all users'));
    
    const testEmail = `test${Date.now()}@example.com`;
    const createUserResult = await testEndpoint('POST', '/api/users', {
        action: 'register',
        email: testEmail,
        password: 'Test123!@#',
        name: 'Test User',
        mobile: '1234567890',
        role: 'customer'
    }, 'POST register user');
    logTest(createUserResult);
    
    if (createUserResult.success) {
        logTest(await testEndpoint('GET', `/api/users?email=${testEmail}`, null, 'GET single user by email'));
        logTest(await testEndpoint('PUT', '/api/users', { email: testEmail, name: 'Updated Name' }, 'PUT update user'));
        
        // Test login
        logTest(await testEndpoint('POST', '/api/users', {
            action: 'login',
            email: testEmail,
            password: 'Test123!@#'
        }, 'POST login user'));
        
        // Clean up - delete test user
        logTest(await testEndpoint('DELETE', `/api/users?email=${testEmail}`, null, 'DELETE user'));
    }
    console.log('');
    
    // Test FAQs
    console.log('❓ Testing FAQ Endpoints...');
    logTest(await testEndpoint('GET', '/api/faqs', null, 'GET all FAQs'));
    
    const createFaqResult = await testEndpoint('POST', '/api/faqs', {
        question: 'Test Question?',
        answer: 'Test Answer',
        category: 'General'
    }, 'POST create FAQ');
    logTest(createFaqResult);
    
    if (createFaqResult.success && createFaqResult.data?.faq?.id) {
        const faqId = createFaqResult.data.faq.id;
        logTest(await testEndpoint('GET', `/api/faqs?id=${faqId}`, null, 'GET single FAQ'));
        logTest(await testEndpoint('PUT', `/api/faqs?id=${faqId}`, { answer: 'Updated Answer' }, 'PUT update FAQ'));
        logTest(await testEndpoint('DELETE', `/api/faqs?id=${faqId}`, null, 'DELETE FAQ'));
    }
    console.log('');
    
    // Test Support Tickets
    console.log('🎫 Testing Support Tickets Endpoints...');
    logTest(await testEndpoint('GET', '/api/support-tickets', null, 'GET all support tickets'));
    
    const createTicketResult = await testEndpoint('POST', '/api/support-tickets', {
        userEmail: 'test@example.com',
        userName: 'Test User',
        subject: 'Test Ticket',
        message: 'This is a test support ticket'
    }, 'POST create support ticket');
    logTest(createTicketResult);
    
    if (createTicketResult.success && createTicketResult.data?.ticket?.id) {
        const ticketId = createTicketResult.data.ticket.id;
        logTest(await testEndpoint('GET', `/api/support-tickets?id=${ticketId}`, null, 'GET single ticket'));
        logTest(await testEndpoint('GET', '/api/support-tickets?userEmail=test@example.com', null, 'GET tickets by user email'));
        logTest(await testEndpoint('PUT', `/api/support-tickets?id=${ticketId}`, { status: 'In Progress' }, 'PUT update ticket'));
        logTest(await testEndpoint('DELETE', `/api/support-tickets?id=${ticketId}`, null, 'DELETE ticket'));
    }
    console.log('');
    
    // Test Admin Logs
    console.log('📋 Testing Admin Logs Endpoints...');
    logTest(await testEndpoint('GET', '/api/admin-logs', null, 'GET all admin logs'));
    
    const createLogResult = await testEndpoint('POST', '/api/admin-logs', {
        actor: 'admin@example.com',
        action: 'test_action',
        target: 'test_target',
        details: 'Test audit log entry'
    }, 'POST create admin log');
    logTest(createLogResult);
    
    if (createLogResult.success && createLogResult.data?.log?.id) {
        const logId = createLogResult.data.log.id;
        logTest(await testEndpoint('GET', `/api/admin-logs?id=${logId}`, null, 'GET single log'));
        logTest(await testEndpoint('GET', '/api/admin-logs?actor=admin@example.com', null, 'GET logs by actor'));
        logTest(await testEndpoint('GET', '/api/admin-logs?limit=10', null, 'GET logs with limit'));
    }
    console.log('');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Total: ${results.passed + results.failed}`);
    console.log(`🎯 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    if (results.failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.tests
            .filter(t => !t.success)
            .forEach(t => console.log(`   - ${t.description} (Status: ${t.status})`));
    }
    
    console.log('\n' + (results.failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed. Check the server logs.'));
}

// Check if server is running
async function checkServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Main execution
(async () => {
    console.log('🔍 Checking if server is running...\n');
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        console.error('❌ Server is not running!');
        console.error(`   Please start the server first: node dev-api-server-mongodb.js`);
        console.error(`   Expected server at: ${API_BASE_URL}`);
        process.exit(1);
    }
    
    console.log('✅ Server is running!\n');
    await runTests();
    process.exit(results.failed === 0 ? 0 : 1);
})();












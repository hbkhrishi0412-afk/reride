/**
 * Password Update Diagnostic Script
 * 
 * Copy and paste this entire script into your browser console (F12)
 * when you're on your app's profile page and experiencing password update issues.
 * 
 * Usage:
 * 1. Open browser console (F12)
 * 2. Go to Console tab
 * 3. Paste this entire script
 * 4. Press Enter
 * 5. Review the results
 */

(async function diagnosePasswordIssue() {
  console.log('🔍 Starting Password Update Diagnostic...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  function logResult(name, passed, message, isWarning = false) {
    const icon = passed ? '✅' : (isWarning ? '⚠️' : '❌');
    const status = passed ? 'PASS' : (isWarning ? 'WARN' : 'FAIL');
    console.log(`${icon} [${status}] ${name}: ${message}`);
    
    if (passed) {
      results.passed.push({ name, message });
    } else if (isWarning) {
      results.warnings.push({ name, message });
    } else {
      results.failed.push({ name, message });
    }
  }
  
  // Test 1: Firebase Connection
  console.log('\n1️⃣  Testing Firebase Connection...');
  try {
    const healthRes = await fetch('/api/db-health');
    const healthData = await healthRes.json();
    
    if (healthData.status === 'ok') {
      logResult('Firebase Connection', true, 'Connected successfully');
    } else {
      logResult('Firebase Connection', false, healthData.message || 'Connection failed');
    }
  } catch (err) {
    logResult('Firebase Connection', false, `Error: ${err.message}`);
  }
  
  // Test 2: Authentication Token
  console.log('\n2️⃣  Checking Authentication...');
  const token = localStorage.getItem('reRideAccessToken');
  const refreshToken = localStorage.getItem('reRideRefreshToken');
  
  if (!token) {
    logResult('Access Token', false, 'No access token found. Please log in.');
  } else {
    logResult('Access Token', true, 'Token found');
    
    // Check token expiration
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expDate = new Date(payload.exp * 1000);
      const now = new Date();
      const isExpired = expDate < now;
      
      if (isExpired) {
        logResult('Token Expiration', false, `Token expired at ${expDate.toISOString()}`);
      } else {
        const timeLeft = Math.floor((expDate - now) / 1000 / 60);
        logResult('Token Expiration', true, `Valid for ${timeLeft} more minutes`);
      }
    } catch (e) {
      logResult('Token Validation', false, 'Invalid token format');
    }
  }
  
  if (!refreshToken) {
    logResult('Refresh Token', false, 'No refresh token found');
  } else {
    logResult('Refresh Token', true, 'Refresh token found');
  }
  
  // Test 3: Current User Data
  console.log('\n3️⃣  Checking User Data...');
  const currentUserStr = localStorage.getItem('reRideCurrentUser');
  if (!currentUserStr) {
    logResult('User Data', false, 'No user data found in localStorage');
  } else {
    try {
      const currentUser = JSON.parse(currentUserStr);
      logResult('User Data', true, `User: ${currentUser.email || 'Unknown'}`);
      
      if (!currentUser.email) {
        logResult('User Email', false, 'Email missing from user data');
      } else {
        logResult('User Email', true, currentUser.email);
      }
      
      if (!currentUser.role) {
        logResult('User Role', false, 'Role missing from user data');
      } else {
        logResult('User Role', true, currentUser.role);
      }
      
      if (currentUser.status === 'inactive') {
        logResult('User Status', false, 'Account is inactive');
      } else {
        logResult('User Status', true, currentUser.status || 'active');
      }
      
      if (!currentUser.firebaseUid) {
        logResult('Firebase UID', false, 'Firebase UID missing (may affect password sync)');
      } else {
        logResult('Firebase UID', true, 'Present');
      }
    } catch (e) {
      logResult('User Data Parse', false, `Error parsing user data: ${e.message}`);
    }
  }
  
  // Test 4: API Reachability
  console.log('\n4️⃣  Testing API Reachability...');
  try {
    const testRes = await fetch('/api/db-health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    logResult('API Reachability', testRes.ok, `Status: ${testRes.status}`);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      logResult('API Reachability', false, 'Request timed out (network issue)');
    } else {
      logResult('API Reachability', false, `Error: ${err.message}`);
    }
  }
  
  // Test 5: Permission Check (if authenticated)
  console.log('\n5️⃣  Testing Update Permissions...');
  if (token && currentUserStr) {
    try {
      const currentUser = JSON.parse(currentUserStr);
      if (currentUser.email) {
        const permRes = await fetch('/api/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: currentUser.email,
            name: currentUser.name // Safe test field - won't actually change anything
          })
        });
        
        const permData = await permRes.json();
        if (permRes.ok && permData.success) {
          logResult('Update Permission', true, 'Can update profile');
        } else {
          logResult('Update Permission', false, permData.reason || 'Permission denied');
        }
      } else {
        logResult('Update Permission', false, 'Cannot test - no user email');
      }
    } catch (err) {
      logResult('Update Permission', false, `Error: ${err.message}`);
    }
  } else {
    logResult('Update Permission', false, 'Cannot test - not authenticated');
  }
  
  // Test 6: Network Check
  console.log('\n6️⃣  Checking Network Connection...');
  if (navigator.onLine) {
    logResult('Network Status', true, 'Online');
  } else {
    logResult('Network Status', false, 'Offline');
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 DIAGNOSTIC SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED CHECKS:');
    results.failed.forEach(item => {
      console.log(`   - ${item.name}: ${item.message}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(item => {
      console.log(`   - ${item.name}: ${item.message}`);
    });
  }
  
  if (results.failed.length === 0 && results.warnings.length === 0) {
    console.log('\n✅ All checks passed! If password update still fails, check server logs.');
  } else {
    console.log('\n💡 Next Steps:');
    if (results.failed.some(r => r.name.includes('Firebase'))) {
      console.log('   1. Check Firebase environment variables in Vercel');
      console.log('   2. Verify Firebase Realtime Database is enabled');
    }
    if (results.failed.some(r => r.name.includes('Token'))) {
      console.log('   1. Log out and log in again');
      console.log('   2. Check token refresh mechanism');
    }
    if (results.failed.some(r => r.name.includes('Permission'))) {
      console.log('   1. Verify you are updating your own profile');
      console.log('   2. Check user role and status');
    }
    console.log('   3. Check Vercel server logs for detailed error messages');
    console.log('   4. See PASSWORD_UPDATE_TROUBLESHOOTING.md for detailed steps');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return results;
})();























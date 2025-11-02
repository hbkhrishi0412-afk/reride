// Debug script for seller login issue
// Run this in browser console: 
// import('./debug-seller-login.js').then(m => m.debugSellerLogin())

export async function debugSellerLogin() {
    console.log('🔍 Starting Seller Login Debug...\n');
    
    // Step 1: Check localStorage
    console.log('📦 Step 1: Checking localStorage...');
    const usersJson = localStorage.getItem('reRideUsers');
    if (!usersJson) {
        console.error('❌ No users in localStorage!');
        console.log('💡 Fix: Run resetLocalStorage() to populate users');
        return;
    }
    
    try {
        const users = JSON.parse(usersJson);
        console.log(`✅ Found ${users.length} users in localStorage`);
        
        // Step 2: Find seller@test.com
        console.log('\n📧 Step 2: Looking for seller@test.com...');
        const seller = users.find(u => 
            (u.email || '').trim().toLowerCase() === 'seller@test.com'
        );
        
        if (!seller) {
            console.error('❌ seller@test.com NOT FOUND!');
            console.log('Available emails:', users.map(u => u.email));
            console.log('\n💡 Fix: Run resetLocalStorage() to add seller@test.com');
            return;
        }
        
        console.log('✅ Found seller@test.com:', {
            name: seller.name,
            email: seller.email,
            role: seller.role,
            status: seller.status,
            hasPassword: !!seller.password,
            passwordLength: seller.password?.length || 0
        });
        
        // Step 3: Test password
        console.log('\n🔐 Step 3: Testing password...');
        const testPassword = 'password';
        const storedPassword = (seller.password || '').trim();
        const passwordMatch = storedPassword === testPassword;
        
        console.log(`Stored password: "${storedPassword}" (length: ${storedPassword.length})`);
        console.log(`Test password: "${testPassword}" (length: ${testPassword.length})`);
        console.log(`Match: ${passwordMatch ? '✅ YES' : '❌ NO'}`);
        
        if (!passwordMatch) {
            console.error('\n❌ Password mismatch!');
            console.log('Expected: "password"');
            console.log(`Got: "${storedPassword}"`);
            console.log('\n💡 Fix: Password is incorrect in localStorage');
            return;
        }
        
        // Step 4: Test role
        console.log('\n👤 Step 4: Checking role...');
        if (seller.role !== 'seller') {
            console.error(`❌ Wrong role! Expected 'seller', got '${seller.role}'`);
            return;
        }
        console.log('✅ Role is correct: seller');
        
        // Step 5: Test status
        console.log('\n📊 Step 5: Checking status...');
        if (seller.status !== 'active') {
            console.error(`❌ Account inactive! Status: '${seller.status}'`);
            return;
        }
        console.log('✅ Status is active');
        
        // Step 6: Test actual login function
        console.log('\n🚀 Step 6: Testing login function...');
        try {
            const { login } = await import('./services/userService.ts');
            const result = await login({
                email: 'seller@test.com',
                password: 'password',
                role: 'seller'
            });
            
            if (result.success) {
                console.log('✅ LOGIN FUNCTION WORKS!');
                console.log('User:', result.user);
            } else {
                console.error('❌ LOGIN FUNCTION FAILED:', result.reason);
            }
        } catch (error) {
            console.error('❌ Error calling login function:', error);
        }
        
        console.log('\n✅ Debug complete!');
        
    } catch (error) {
        console.error('❌ Error parsing users:', error);
    }
}

export function resetLocalStorage() {
    console.log('🔄 Resetting localStorage...');
    localStorage.removeItem('reRideUsers');
    
    const FALLBACK_USERS = [
        {
            name: 'Prestige Motors',
            email: 'seller@test.com',
            password: 'password',
            mobile: '+91-98765-43210',
            role: 'seller',
            location: 'Mumbai',
            status: 'active',
            createdAt: new Date().toISOString(),
            dealershipName: 'Prestige Motors',
            bio: 'Specializing in luxury and performance electric vehicles since 2020.',
            logoUrl: 'https://i.pravatar.cc/100?u=seller',
            avatarUrl: 'https://i.pravatar.cc/150?u=seller@test.com',
            isVerified: true,
            subscriptionPlan: 'premium',
            featuredCredits: 5,
            usedCertifications: 1
        },
        {
            name: 'Mock Customer',
            email: 'customer@test.com',
            password: 'password',
            mobile: '555-987-6543',
            role: 'customer',
            location: 'Delhi',
            status: 'active',
            createdAt: new Date().toISOString(),
            avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com'
        },
        {
            name: 'Mock Admin',
            email: 'admin@test.com',
            password: 'password',
            mobile: '111-222-3333',
            role: 'admin',
            location: 'Bangalore',
            status: 'active',
            createdAt: new Date().toISOString(),
            avatarUrl: 'https://i.pravatar.cc/150?u=admin@test.com'
        }
    ];
    
    localStorage.setItem('reRideUsers', JSON.stringify(FALLBACK_USERS));
    console.log('✅ localStorage reset with seller@test.com (password: password)');
    console.log('💡 Now refresh the page and try logging in again');
}

// Make functions available globally for console use
if (typeof window !== 'undefined') {
    (window as any).debugSellerLogin = debugSellerLogin;
    (window as any).resetLocalStorage = resetLocalStorage;
    console.log('💡 Debug functions loaded! Run:');
    console.log('  - debugSellerLogin() to diagnose issues');
    console.log('  - resetLocalStorage() to reset and populate localStorage');
}


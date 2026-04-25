// Run this script to populate localStorage with users and vehicles data
// Open your browser console (F12) and paste this entire script

console.log('🔄 Starting data population...');

function cryptoRandomInt(min, maxExclusive) {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('crypto.getRandomValues is required');
  }
  const span = maxExclusive - min;
  if (span <= 0) return min;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return min + (buf[0] % span);
}

const pick = (arr) => arr[cryptoRandomInt(0, arr.length)];

// Helper function
const daysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
};

// Mock Users
const MOCK_USERS = [
    { name: 'Prestige Motors', email: 'seller@test.com', password: 'password', mobile: '+91-98765-43210', role: 'seller', status: 'active', createdAt: daysAgo(30), dealershipName: 'Prestige Motors', bio: 'Specializing in luxury and performance electric vehicles since 2020.', logoUrl: 'https://i.pravatar.cc/100?u=seller', avatarUrl: 'https://i.pravatar.cc/150?u=seller@test.com', isVerified: true, subscriptionPlan: 'premium', featuredCredits: 5, usedCertifications: 1 },
    { name: 'Mock Customer', email: 'customer@test.com', password: 'password', mobile: '555-987-6543', role: 'customer', status: 'active', createdAt: daysAgo(15), avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com' },
    { name: 'Mock Admin', email: 'admin@test.com', password: 'password', mobile: '111-222-3333', role: 'admin', status: 'active', createdAt: daysAgo(100), avatarUrl: 'https://i.pravatar.cc/150?u=admin@test.com' },
    { name: 'Jane Doe', email: 'jane.doe@customer.com', password: 'password', mobile: '555-111-2222', role: 'customer', status: 'active', createdAt: daysAgo(5), avatarUrl: 'https://i.pravatar.cc/150?u=jane.doe@customer.com' },
    { name: 'Reliable Rides', email: 'john.smith@seller.com', password: 'password', mobile: '555-333-4444', role: 'seller', status: 'active', createdAt: daysAgo(60), dealershipName: 'Reliable Rides', bio: 'Your trusted source for pre-owned family cars and SUVs.', logoUrl: 'https://i.pravatar.cc/100?u=johnsmith', avatarUrl: 'https://i.pravatar.cc/150?u=john.smith@seller.com', isVerified: false, subscriptionPlan: 'pro', featuredCredits: 2, usedCertifications: 0 },
];

// Generate mock vehicles (simple version)
const generateMockVehicles = (count) => {
    const vehicles = [];
    const makes = ['Tata', 'Mahindra', 'Hyundai', 'Maruti Suzuki', 'Honda'];
    const models = ['Nexon', 'XUV700', 'Creta', 'Brezza', 'City'];
    const colors = ['White', 'Black', 'Silver', 'Red', 'Blue'];
    const fuelTypes = ['Petrol', 'Diesel', 'Electric', 'CNG'];
    const transmissions = ['Manual', 'Automatic'];
    
    for (let i = 1; i <= count; i++) {
        const make = pick(makes);
        const model = pick(models);
        const year = 2015 + cryptoRandomInt(0, 9);

        vehicles.push({
            id: i,
            category: 'four-wheeler',
            make,
            model,
            variant: `${model} ZX`,
            year,
            price: 500000 + cryptoRandomInt(0, 1_500_000),
            mileage: cryptoRandomInt(0, 100_000),
            images: [
                'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800',
                'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800'
            ],
            features: ['Power Steering', 'Air Conditioning', 'Alloy Wheels', 'ABS'],
            description: `Well maintained ${make} ${model} in excellent condition.`,
            sellerEmail: 'seller@test.com',
            sellerName: 'Prestige Motors',
            engine: '1498 cc',
            transmission: pick(transmissions),
            fuelType: pick(fuelTypes),
            fuelEfficiency: '15-18 km/l',
            color: pick(colors),
            status: 'published',
            isFeatured: cryptoRandomInt(0, 10) > 7,
            views: cryptoRandomInt(0, 1000),
            inquiriesCount: cryptoRandomInt(0, 50),
            registrationYear: year,
            insuranceValidity: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            insuranceType: 'Comprehensive',
            rto: 'MH-01',
            city: 'Mumbai',
            state: 'MH',
            noOfOwners: 1 + cryptoRandomInt(0, 2),
            displacement: '1498 cc',
            groundClearance: '170 mm',
            bootSpace: '350 litres'
        });
    }
    return vehicles;
};

const MOCK_VEHICLES = generateMockVehicles(50);

// Populate localStorage
try {
    console.log(`📦 Saving ${MOCK_USERS.length} users to localStorage...`);
    localStorage.setItem('reRideUsers', JSON.stringify(MOCK_USERS));
    console.log('✅ Users saved successfully!');
    
    console.log(`🚗 Saving ${MOCK_VEHICLES.length} vehicles to localStorage...`);
    localStorage.setItem('reRideVehicles', JSON.stringify(MOCK_VEHICLES));
    console.log('✅ Vehicles saved successfully!');
    
    console.log('\n🎉 Data population complete!');
    console.log(`📊 Summary:`);
    console.log(`   - ${MOCK_USERS.length} users loaded`);
    console.log(`   - ${MOCK_VEHICLES.length} vehicles loaded`);
    console.log('\n💡 Now refresh the page to see the data!');
    
    // Auto-refresh after 2 seconds
    setTimeout(() => {
        console.log('🔄 Refreshing page...');
        window.location.reload();
    }, 2000);
    
} catch (error) {
    console.error('❌ Error populating data:', error);
}



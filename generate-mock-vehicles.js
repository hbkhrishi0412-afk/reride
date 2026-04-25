// Script to generate mock vehicles for development
// Run this in the browser console or as a simple script

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

const generateMockVehicles = (count = 20) => {
  const makes = ['Maruti Suzuki', 'Hyundai', 'Tata', 'Honda', 'Toyota', 'Mahindra', 'Kia', 'Nissan'];
  const models = {
    'Maruti Suzuki': ['Swift', 'Baleno', 'Brezza', 'Ertiga', 'WagonR', 'Alto'],
    'Hyundai': ['Creta', 'Venue', 'i20', 'Verna', 'Aura', 'Grand i10'],
    'Tata': ['Nexon', 'Harrier', 'Safari', 'Tiago', 'Tigor', 'Altroz'],
    'Honda': ['City', 'Amaze', 'WR-V', 'Jazz', 'Civic'],
    'Toyota': ['Innova', 'Fortuner', 'Glanza', 'Urban Cruiser', 'Camry'],
    'Mahindra': ['XUV300', 'XUV700', 'Scorpio', 'Bolero', 'Thar'],
    'Kia': ['Seltos', 'Sonet', 'Carnival', 'EV6'],
    'Nissan': ['Magnite', 'Kicks', 'Micra']
  };
  
  const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'Electric'];
  const transmissions = ['Manual', 'Automatic', 'CVT'];
  const colors = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Grey'];
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Pune', 'Hyderabad', 'Ahmedabad'];
  
  const vehicles = [];
  
  for (let i = 1; i <= count; i++) {
    const make = pick(makes);
    const model = pick(models[make]);
    const year = 2018 + cryptoRandomInt(0, 6);
    const price = 300000 + cryptoRandomInt(0, 2_000_000);
    const mileage = 10000 + cryptoRandomInt(0, 100_000);

    vehicles.push({
      id: i,
      make,
      model,
      year,
      price,
      mileage,
      fuelType: pick(fuelTypes),
      transmission: pick(transmissions),
      location: pick(cities),
      sellerEmail: `seller${cryptoRandomInt(1, 6)}@test.com`,
      images: [`https://picsum.photos/seed/${make}${model}${i}/800/600`],
      description: `Well maintained ${make} ${model} in excellent condition. Single owner, no accidents.`,
      status: 'published',
      isFeatured: cryptoRandomInt(0, 10) > 6,
      views: cryptoRandomInt(0, 200),
      inquiriesCount: cryptoRandomInt(0, 20),
      certificationStatus: cryptoRandomInt(0, 2) === 0 ? 'certified' : 'none',
      category: 'four-wheeler', // Using string instead of enum
      features: ['Power Steering', 'Air Conditioning', 'Power Windows', 'Central Locking'],
      engine: `${(1.0 + cryptoRandomInt(0, 2000) / 1000).toFixed(1)}L ${pick(fuelTypes)}`,
      fuelEfficiency: `${15 + cryptoRandomInt(0, 10)} KMPL`,
      color: pick(colors),
      noOfOwners: cryptoRandomInt(0, 3) + 1,
      registrationYear: year,
      insuranceValidity: `${new Date().getFullYear() + 1}-${String(cryptoRandomInt(1, 13)).padStart(2, '0')}`,
      insuranceType: 'Comprehensive',
      rto: `${pick(cities).substring(0, 2).toUpperCase()}${cryptoRandomInt(1, 100)}`,
      city: pick(cities),
      state: 'MH',
      displacement: `${1000 + cryptoRandomInt(0, 2000)} cc`,
      groundClearance: `${150 + cryptoRandomInt(0, 50)} mm`,
      bootSpace: `${300 + cryptoRandomInt(0, 200)} litres`
    });
  }
  
  return vehicles;
};

// If running in browser, populate localStorage
if (typeof window !== 'undefined') {
  const mockVehicles = generateMockVehicles(50);
  localStorage.setItem('reRideVehicles', JSON.stringify(mockVehicles));
  console.log(`✅ Generated and saved ${mockVehicles.length} mock vehicles to localStorage`);
  console.log('Sample vehicles:', mockVehicles.slice(0, 3));
  
  // Also generate some mock users
  const mockUsers = [
    {
      name: 'Prestige Motors',
      email: 'seller@test.com',
      password: 'password',
      mobile: '+91-98765-43210',
      role: 'seller',
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
      status: 'active',
      createdAt: new Date().toISOString(),
      avatarUrl: 'https://i.pravatar.cc/150?u=admin@test.com'
    }
  ];
  
  localStorage.setItem('reRideUsers', JSON.stringify(mockUsers));
  console.log(`✅ Generated and saved ${mockUsers.length} mock users to localStorage`);
  
  console.log('\n🎉 Local storage populated successfully!');
  console.log('\n📋 Available test accounts:');
  console.log('   Admin: admin@test.com / password');
  console.log('   Customer: customer@test.com / password');
  console.log('   Seller: seller@test.com / password');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateMockVehicles };
}
// Script to generate mock vehicles for development
// Run this in the browser console or as a simple script

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
    const make = makes[Math.floor(Math.random() * makes.length)];
    const model = models[make][Math.floor(Math.random() * models[make].length)];
    const year = 2018 + Math.floor(Math.random() * 6);
    const price = 300000 + Math.floor(Math.random() * 2000000);
    const mileage = 10000 + Math.floor(Math.random() * 100000);
    
    vehicles.push({
      id: i,
      make,
      model,
      year,
      price,
      mileage,
      fuelType: fuelTypes[Math.floor(Math.random() * fuelTypes.length)],
      transmission: transmissions[Math.floor(Math.random() * transmissions.length)],
      location: cities[Math.floor(Math.random() * cities.length)],
      sellerEmail: `seller${Math.floor(Math.random() * 5) + 1}@test.com`,
      images: [`https://picsum.photos/seed/${make}${model}${i}/800/600`],
      description: `Well maintained ${make} ${model} in excellent condition. Single owner, no accidents.`,
      status: 'published',
      isFeatured: Math.random() > 0.7,
      views: Math.floor(Math.random() * 200),
      inquiriesCount: Math.floor(Math.random() * 20),
      certificationStatus: Math.random() > 0.5 ? 'certified' : 'none',
      category: 'four-wheeler', // Using string instead of enum
      features: ['Power Steering', 'Air Conditioning', 'Power Windows', 'Central Locking'],
      engine: `${(1.0 + Math.random() * 2.0).toFixed(1)}L ${fuelTypes[Math.floor(Math.random() * fuelTypes.length)]}`,
      fuelEfficiency: `${15 + Math.floor(Math.random() * 10)} KMPL`,
      color: colors[Math.floor(Math.random() * colors.length)],
      noOfOwners: Math.floor(Math.random() * 3) + 1,
      registrationYear: year,
      insuranceValidity: `${new Date().getFullYear() + 1}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}`,
      insuranceType: 'Comprehensive',
      rto: `${cities[Math.floor(Math.random() * cities.length)].substring(0, 2).toUpperCase()}${Math.floor(Math.random() * 99) + 1}`,
      city: cities[Math.floor(Math.random() * cities.length)],
      state: 'MH',
      displacement: `${1000 + Math.floor(Math.random() * 2000)} cc`,
      groundClearance: `${150 + Math.floor(Math.random() * 50)} mm`,
      bootSpace: `${300 + Math.floor(Math.random() * 200)} litres`
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
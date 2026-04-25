// Script to create mock data files for development
import fs from 'fs';
import { randomInt } from 'crypto';

const pick = (arr) => arr[randomInt(0, arr.length)];

const generateMockVehicles = (count = 50) => {
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
    const year = 2018 + randomInt(0, 6);
    const price = 300000 + randomInt(0, 2_000_000);
    const mileage = 10000 + randomInt(0, 100_000);

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
      sellerEmail: `seller${randomInt(1, 6)}@test.com`,
      images: [`https://picsum.photos/seed/${make}${model}${i}/800/600`],
      description: `Well maintained ${make} ${model} in excellent condition. Single owner, no accidents.`,
      status: 'published',
      isFeatured: randomInt(0, 10) > 6,
      views: randomInt(0, 200),
      inquiriesCount: randomInt(0, 20),
      certificationStatus: randomInt(0, 2) === 0 ? 'certified' : 'none',
      category: 'four-wheeler',
      features: ['Power Steering', 'Air Conditioning', 'Power Windows', 'Central Locking'],
      engine: `${(1.0 + randomInt(0, 2000) / 1000).toFixed(1)}L ${pick(fuelTypes)}`,
      fuelEfficiency: `${15 + randomInt(0, 10)} KMPL`,
      color: pick(colors),
      noOfOwners: randomInt(0, 3) + 1,
      registrationYear: year,
      insuranceValidity: `${new Date().getFullYear() + 1}-${String(randomInt(1, 13)).padStart(2, '0')}`,
      insuranceType: 'Comprehensive',
      rto: `${pick(cities).substring(0, 2).toUpperCase()}${randomInt(1, 100)}`,
      city: pick(cities),
      state: 'MH',
      displacement: `${1000 + randomInt(0, 2000)} cc`,
      groundClearance: `${150 + randomInt(0, 50)} mm`,
      bootSpace: `${300 + randomInt(0, 200)} litres`
    });
  }
  
  return vehicles;
};

const generateMockUsers = () => {
  return [
    {
      name: 'Demo Seller',
      email: 'seller1@test.com',
      password: 'password',
      mobile: '555-123-4567',
      role: 'seller',
      status: 'active',
      createdAt: new Date().toISOString(),
      dealershipName: 'Prestige Motors',
      bio: 'Specializing in luxury and performance vehicles since 2020.',
      logoUrl: 'https://i.pravatar.cc/100?u=seller1',
      avatarUrl: 'https://i.pravatar.cc/150?u=seller1@test.com',
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
};

// Generate mock data
const mockVehicles = generateMockVehicles(50);
const mockUsers = generateMockUsers();

// Save to JSON files
fs.writeFileSync('mock-vehicles.json', JSON.stringify(mockVehicles, null, 2));
fs.writeFileSync('mock-users.json', JSON.stringify(mockUsers, null, 2));

console.log(`✅ Generated ${mockVehicles.length} mock vehicles and ${mockUsers.length} mock users`);
console.log('📁 Files created:');
console.log('   - mock-vehicles.json');
console.log('   - mock-users.json');
console.log('\n📋 Available test accounts:');
console.log('   Admin: admin@test.com / password');
console.log('   Customer: customer@test.com / password');
console.log('   Seller: seller1@test.com / password');
console.log('\n💡 To use this data, copy the contents of these files to localStorage in your browser console:');
console.log('   localStorage.setItem("reRideVehicles", JSON.stringify(vehiclesData));');
console.log('   localStorage.setItem("reRideUsers", JSON.stringify(usersData));');

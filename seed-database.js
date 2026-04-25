// Complete database seeding script with users AND vehicles
// Run this with: node seed-database.js

import mongoose from 'mongoose';
import { randomInt } from 'crypto';

const pick = (arr) => arr[randomInt(0, arr.length)];

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reride';

// Helper to generate past dates
const daysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
};

// Mock users data
const MOCK_USERS = [
    { 
        name: 'Prestige Motors', 
        email: 'seller@test.com', 
        password: 'password', 
        mobile: '555-123-4567', 
        role: 'seller', 
        status: 'active', 
        createdAt: daysAgo(30), 
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
        createdAt: daysAgo(15), 
        avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com' 
    },
    { 
        name: 'Mock Admin', 
        email: 'admin@test.com', 
        password: 'password', 
        mobile: '111-222-3333', 
        role: 'admin', 
        status: 'active', 
        createdAt: daysAgo(100), 
        avatarUrl: 'https://i.pravatar.cc/150?u=admin@test.com' 
    },
    { 
        name: 'Jane Doe', 
        email: 'jane.doe@customer.com', 
        password: 'password', 
        mobile: '555-111-2222', 
        role: 'customer', 
        status: 'active', 
        createdAt: daysAgo(5), 
        avatarUrl: 'https://i.pravatar.cc/150?u=jane.doe@customer.com' 
    },
    { 
        name: 'Reliable Rides', 
        email: 'john.smith@seller.com', 
        password: 'password', 
        mobile: '555-333-4444', 
        role: 'seller', 
        status: 'active', 
        createdAt: daysAgo(60), 
        dealershipName: 'Reliable Rides', 
        bio: 'Your trusted source for pre-owned family cars and SUVs.', 
        logoUrl: 'https://i.pravatar.cc/100?u=johnsmith', 
        avatarUrl: 'https://i.pravatar.cc/150?u=john.smith@seller.com', 
        isVerified: false, 
        subscriptionPlan: 'pro', 
        featuredCredits: 2, 
        usedCertifications: 0 
    }
];

// Generate mock vehicles
const generateMockVehicles = (count) => {
    const vehicles = [];
    const makes = ['Tata', 'Mahindra', 'Hyundai', 'Maruti Suzuki', 'Honda', 'Toyota', 'Kia', 'MG'];
    const modelsByMake = {
        'Tata': ['Nexon', 'Harrier', 'Safari', 'Punch', 'Altroz'],
        'Mahindra': ['XUV700', 'Scorpio', 'Thar', 'XUV300', 'Bolero'],
        'Hyundai': ['Creta', 'Venue', 'i20', 'Verna', 'Alcazar'],
        'Maruti Suzuki': ['Brezza', 'Swift', 'Baleno', 'Ertiga', 'Dzire'],
        'Honda': ['City', 'Amaze', 'Jazz', 'WR-V', 'Civic'],
        'Toyota': ['Fortuner', 'Innova Crysta', 'Glanza', 'Urban Cruiser', 'Camry'],
        'Kia': ['Seltos', 'Sonet', 'Carens', 'Carnival', 'EV6'],
        'MG': ['Hector', 'Astor', 'ZS EV', 'Gloster', 'Comet']
    };
    const colors = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Grey', 'Brown'];
    const fuelTypes = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
    const transmissions = ['Manual', 'Automatic', 'AMT', 'CVT', 'DCT'];
    const sellers = ['seller@test.com', 'john.smith@seller.com'];
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Chennai', 'Hyderabad'];
    
    const variantSuffixes = ['ZX', 'VX', 'SX', 'LX'];
    const stateCodes = ['MH', 'DL', 'KA', 'TN', 'TS'];
    for (let i = 1; i <= count; i++) {
        const make = pick(makes);
        const models = modelsByMake[make];
        const model = pick(models);
        const year = 2015 + randomInt(0, 10);
        const city = pick(cities);

        vehicles.push({
            id: i,
            category: 'four-wheeler',
            make,
            model,
            variant: `${model} ${pick(variantSuffixes)}`,
            year,
            price: 300000 + randomInt(0, 2_000_000),
            mileage: randomInt(0, 100_000),
            images: [
                `https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&auto=format&q=80`,
                `https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&q=80`,
                `https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&auto=format&q=80`
            ],
            features: ['Power Steering', 'Air Conditioning', 'Alloy Wheels', 'ABS', 'Airbags', 'Music System'],
            description: `Well maintained ${year} ${make} ${model} in excellent condition. Single owner, full service history.`,
            sellerEmail: pick(sellers),
            sellerName: sellers[0] === 'seller@test.com' ? 'Prestige Motors' : 'Reliable Rides',
            engine: `${1000 + randomInt(0, 1500)} cc`,
            transmission: pick(transmissions),
            fuelType: pick(fuelTypes),
            fuelEfficiency: `${12 + randomInt(0, 13)} km/l`,
            color: pick(colors),
            status: 'published',
            isFeatured: randomInt(0, 10) > 6,
            views: randomInt(0, 1000),
            inquiriesCount: randomInt(0, 50),
            registrationYear: year,
            insuranceValidity: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            insuranceType: randomInt(0, 2) === 0 ? 'Comprehensive' : 'Third Party',
            rto: `${pick(stateCodes)}-${String(randomInt(1, 51)).padStart(2, '0')}`,
            city,
            state: city === 'Mumbai' || city === 'Pune' ? 'MH' : city === 'Delhi' ? 'DL' : city === 'Bangalore' ? 'KA' : city === 'Chennai' ? 'TN' : 'TS',
            noOfOwners: 1 + randomInt(0, 3),
            displacement: `${1000 + randomInt(0, 1500)} cc`,
            groundClearance: `${150 + randomInt(0, 70)} mm`,
            bootSpace: `${250 + randomInt(0, 250)} litres`
        });
    }
    return vehicles;
};

const MOCK_VEHICLES = generateMockVehicles(50);

// Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  password: { type: String, required: false },
  mobile: { type: String, required: false },
  firebaseUid: { type: String, unique: true, sparse: true, index: true },
  authProvider: { type: String, enum: ['email', 'google', 'phone'], default: 'email' },
  role: { type: String, enum: ['customer', 'seller', 'admin'], required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  avatarUrl: String,
  isVerified: { type: Boolean, default: false },
  dealershipName: String,
  bio: String,
  logoUrl: String,
  subscriptionPlan: { type: String, enum: ['free', 'pro', 'premium'], default: 'free' },
  featuredCredits: { type: Number, default: 0 },
  usedCertifications: { type: Number, default: 0 },
  createdAt: String
}, { timestamps: true });

const vehicleSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  category: String,
  make: { type: String, required: true },
  model: { type: String, required: true },
  variant: String,
  year: { type: Number, required: true },
  price: { type: Number, required: true },
  mileage: Number,
  images: [String],
  features: [String],
  description: String,
  sellerEmail: { type: String, required: true },
  sellerName: String,
  engine: String,
  transmission: String,
  fuelType: String,
  fuelEfficiency: String,
  color: String,
  status: { type: String, enum: ['published', 'unpublished', 'sold'], default: 'published' },
  isFeatured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  inquiriesCount: { type: Number, default: 0 },
  registrationYear: Number,
  insuranceValidity: String,
  insuranceType: String,
  rto: String,
  city: String,
  state: String,
  noOfOwners: Number,
  displacement: String,
  groundClearance: String,
  bootSpace: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

async function seedDatabase() {
  try {
    console.log('🔄 Starting database seeding...\n');
    console.log('📡 Connecting to MongoDB...');
    console.log('   URI:', MONGODB_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://***:***@'));
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Seed Users
    console.log('👥 Seeding users...');
    console.log('   Clearing existing users...');
    await User.deleteMany({});
    console.log('   Inserting new users...');
    await User.insertMany(MOCK_USERS);
    console.log(`✅ Seeded ${MOCK_USERS.length} users\n`);

    // Seed Vehicles
    console.log('🚗 Seeding vehicles...');
    console.log('   Clearing existing vehicles...');
    await Vehicle.deleteMany({});
    console.log('   Inserting new vehicles...');
    await Vehicle.insertMany(MOCK_VEHICLES);
    console.log(`✅ Seeded ${MOCK_VEHICLES.length} vehicles\n`);

    console.log('🎉 Database seeded successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST LOGIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🔴 Admin:');
    console.log('   Email:    admin@test.com');
    console.log('   Password: password\n');
    
    console.log('🔵 Seller 1:');
    console.log('   Email:    seller@test.com');
    console.log('   Password: password');
    console.log('   Name:     Prestige Motors\n');
    
    console.log('🔵 Seller 2:');
    console.log('   Email:    john.smith@seller.com');
    console.log('   Password: password');
    console.log('   Name:     Reliable Rides\n');
    
    console.log('🟢 Customer 1:');
    console.log('   Email:    customer@test.com');
    console.log('   Password: password\n');
    
    console.log('🟢 Customer 2:');
    console.log('   Email:    jane.doe@customer.com');
    console.log('   Password: password\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATABASE SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`   Total Users:    ${MOCK_USERS.length}`);
    console.log(`   Total Vehicles: ${MOCK_VEHICLES.length}`);
    console.log(`   Makes:          ${[...new Set(MOCK_VEHICLES.map(v => v.make))].join(', ')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error.message);
    console.error('\n💡 Troubleshooting:');
    
    if (error.message.includes('authentication failed')) {
      console.error('   - Check your MongoDB username and password');
      console.error('   - Verify credentials in MongoDB Atlas');
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.error('   - Check your internet connection');
      console.error('   - Verify MongoDB Atlas network access (IP whitelist)');
      console.error('   - Try adding 0.0.0.0/0 to allow access from anywhere');
    } else if (error.message.includes('MONGODB_URI')) {
      console.error('   - Set MONGODB_URI environment variable');
      console.error('   - Or update the connection string in this file');
    } else {
      console.error('   Full error:', error);
    }
    
    process.exit(1);
  }
}

seedDatabase();



/**
 * Realistic Mock Data Generator for Indian Vehicle Marketplace
 * Generates accurate vehicle data for testing and demos
 */

import type { Vehicle, User } from '../types';
import { VehicleCategory } from '../vehicle-category';

// Realistic Indian cities with RTO codes
const INDIAN_LOCATIONS: Array<{
  city: string;
  state: string;
  stateCode: string;
  rtoCodes: string[];
}> = [
  { city: 'Mumbai', state: 'Maharashtra', stateCode: 'MH', rtoCodes: ['MH-01', 'MH-02', 'MH-03', 'MH-04', 'MH-47'] },
  { city: 'Delhi', state: 'Delhi', stateCode: 'DL', rtoCodes: ['DL-01', 'DL-02', 'DL-03', 'DL-04', 'DL-05', 'DL-06', 'DL-07', 'DL-08'] },
  { city: 'Bangalore', state: 'Karnataka', stateCode: 'KA', rtoCodes: ['KA-01', 'KA-02', 'KA-03', 'KA-04', 'KA-05', 'KA-50', 'KA-51'] },
  { city: 'Hyderabad', state: 'Telangana', stateCode: 'TS', rtoCodes: ['TS-07', 'TS-08', 'TS-09', 'TS-10'] },
  { city: 'Chennai', state: 'Tamil Nadu', stateCode: 'TN', rtoCodes: ['TN-01', 'TN-02', 'TN-03', 'TN-04', 'TN-05', 'TN-06', 'TN-07'] },
  { city: 'Kolkata', state: 'West Bengal', stateCode: 'WB', rtoCodes: ['WB-01', 'WB-02', 'WB-03', 'WB-04', 'WB-05'] },
  { city: 'Pune', state: 'Maharashtra', stateCode: 'MH', rtoCodes: ['MH-12', 'MH-14', 'MH-15'] },
  { city: 'Ahmedabad', state: 'Gujarat', stateCode: 'GJ', rtoCodes: ['GJ-01', 'GJ-02', 'GJ-06', 'GJ-27'] },
  { city: 'Jaipur', state: 'Rajasthan', stateCode: 'RJ', rtoCodes: ['RJ-14', 'RJ-45'] },
  { city: 'Lucknow', state: 'Uttar Pradesh', stateCode: 'UP', rtoCodes: ['UP-32'] },
  { city: 'Chandigarh', state: 'Chandigarh', stateCode: 'CH', rtoCodes: ['CH-01', 'CH-02', 'CH-03'] },
  { city: 'Kochi', state: 'Kerala', stateCode: 'KL', rtoCodes: ['KL-07', 'KL-40', 'KL-41'] },
  { city: 'Indore', state: 'Madhya Pradesh', stateCode: 'MP', rtoCodes: ['MP-09'] },
  { city: 'Nagpur', state: 'Maharashtra', stateCode: 'MH', rtoCodes: ['MH-31', 'MH-40'] },
  { city: 'Surat', state: 'Gujarat', stateCode: 'GJ', rtoCodes: ['GJ-05', 'GJ-21'] },
];

// Realistic vehicle specifications by make/model
interface VehicleSpec {
  make: string;
  model: string;
  variants: string[];
  category: VehicleCategory;
  yearRange: [number, number];
  priceRange: [number, number]; // Used car price range
  fuelTypes: string[];
  transmissions: string[];
  engine: string;
  displacement: string;
  fuelEfficiency: string;
  colors: string[];
  features: string[];
  bodyType: string;
}

const VEHICLE_SPECS: VehicleSpec[] = [
  // Popular Hatchbacks
  {
    make: 'Maruti Suzuki',
    model: 'Swift',
    variants: ['LXi', 'VXi', 'ZXi', 'ZXi+'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2018, 2024],
    priceRange: [450000, 850000],
    fuelTypes: ['Petrol', 'CNG'],
    transmissions: ['Manual', 'AMT'],
    engine: '1.2L K-Series Dual Jet',
    displacement: '1197 cc',
    fuelEfficiency: '22.56 km/l',
    colors: ['Solid Fire Red', 'Pearl Arctic White', 'Magma Grey', 'Sizzling Red with Pearl Midnight Black Roof'],
    features: ['SmartPlay Studio', 'Auto Gear Shift', 'Dual Airbags', 'ABS with EBD', 'Rear Parking Camera'],
    bodyType: 'Hatchback',
  },
  {
    make: 'Maruti Suzuki',
    model: 'Baleno',
    variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2019, 2024],
    priceRange: [550000, 950000],
    fuelTypes: ['Petrol', 'CNG'],
    transmissions: ['Manual', 'AMT'],
    engine: '1.2L K-Series Dual Jet',
    displacement: '1197 cc',
    fuelEfficiency: '22.35 km/l',
    colors: ['Nexa Blue', 'Pearl Arctic White', 'Splendid Silver', 'Grandeur Grey'],
    features: ['9-inch SmartPlay Pro+', 'Heads-up Display', '360° View Camera', 'Suzuki Connect'],
    bodyType: 'Hatchback',
  },
  {
    make: 'Hyundai',
    model: 'i20',
    variants: ['Magna', 'Sportz', 'Asta', 'Asta (O)'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2020, 2024],
    priceRange: [650000, 1100000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'IVT', 'DCT'],
    engine: '1.2L Kappa',
    displacement: '1197 cc',
    fuelEfficiency: '20.35 km/l',
    colors: ['Polar White', 'Titan Grey', 'Fiery Red', 'Starry Night'],
    features: ['10.25-inch Touchscreen', 'Bose Premium Sound', 'Sunroof', 'BlueLink Connected Car'],
    bodyType: 'Hatchback',
  },
  {
    make: 'Tata',
    model: 'Altroz',
    variants: ['XE', 'XM', 'XT', 'XZ', 'XZ+'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2020, 2024],
    priceRange: [550000, 950000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'DCA'],
    engine: '1.2L Revotron',
    displacement: '1199 cc',
    fuelEfficiency: '19.28 km/l',
    colors: ['High Street Gold', 'Downtown Red', 'Harbour Blue'],
    features: ['iRA Connected Car', '7-inch Touchscreen', '5-Star GNCAP Safety', 'Projector Headlamps'],
    bodyType: 'Hatchback',
  },
  
  // Popular Sedans
  {
    make: 'Honda',
    model: 'City',
    variants: ['V', 'VX', 'ZX'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2018, 2024],
    priceRange: [850000, 1400000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'CVT'],
    engine: '1.5L i-VTEC',
    displacement: '1498 cc',
    fuelEfficiency: '18.4 km/l',
    colors: ['Platinum White Pearl', 'Modern Steel Metallic', 'Golden Brown Metallic', 'Radiant Red Metallic'],
    features: ['8-inch Touchscreen', 'Honda Sensing', 'LaneWatch Camera', 'Electric Sunroof'],
    bodyType: 'Sedan',
  },
  {
    make: 'Hyundai',
    model: 'Verna',
    variants: ['S', 'S+', 'SX', 'SX(O)'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2020, 2024],
    priceRange: [900000, 1600000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'IVT', 'DCT'],
    engine: '1.5L MPi Petrol',
    displacement: '1497 cc',
    fuelEfficiency: '19.2 km/l',
    colors: ['Typhoon Silver', 'Phantom Black', 'Fiery Red', 'Atlas White'],
    features: ['10.25-inch Infotainment', 'BlueLink', 'Ventilated Seats', 'ADAS Level 2'],
    bodyType: 'Sedan',
  },
  {
    make: 'Maruti Suzuki',
    model: 'Dzire',
    variants: ['LXi', 'VXi', 'ZXi', 'ZXi+'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2017, 2024],
    priceRange: [500000, 850000],
    fuelTypes: ['Petrol', 'CNG'],
    transmissions: ['Manual', 'AMT'],
    engine: '1.2L K-Series',
    displacement: '1197 cc',
    fuelEfficiency: '23.26 km/l',
    colors: ['Oxford Blue', 'Silky Silver', 'Pearl Arctic White', 'Sherwood Brown'],
    features: ['SmartPlay Studio', 'Auto Gear Shift', 'Cruise Control', 'Keyless Entry'],
    bodyType: 'Sedan',
  },
  
  // Popular SUVs
  {
    make: 'Hyundai',
    model: 'Creta',
    variants: ['E', 'EX', 'S', 'SX', 'SX(O)'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2020, 2024],
    priceRange: [1000000, 1800000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'IVT', 'DCT'],
    engine: '1.5L MPi Petrol',
    displacement: '1497 cc',
    fuelEfficiency: '17.4 km/l',
    colors: ['Atlas White', 'Abyss Black', 'Titan Grey', 'Ranger Khaki'],
    features: ['Panoramic Sunroof', 'BlueLink', 'Bose Sound System', 'ADAS'],
    bodyType: 'SUV',
  },
  {
    make: 'Tata',
    model: 'Nexon',
    variants: ['XE', 'XM', 'XZ', 'XZ+', 'XZA+'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2019, 2024],
    priceRange: [750000, 1400000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'AMT'],
    engine: '1.2L Revotron',
    displacement: '1199 cc',
    fuelEfficiency: '17.4 km/l',
    colors: ['Fearless Purple', 'Pure Grey', 'Flame Red', 'Foliage Green'],
    features: ['10.25-inch Touchscreen', 'iRA Connected', '5-Star GNCAP', 'Sunroof'],
    bodyType: 'SUV',
  },
  {
    make: 'Kia',
    model: 'Seltos',
    variants: ['HTE', 'HTK', 'HTK+', 'HTX', 'GTX+'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2019, 2024],
    priceRange: [1000000, 1900000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'IVT', 'DCT'],
    engine: '1.5L Smartstream',
    displacement: '1497 cc',
    fuelEfficiency: '18.5 km/l',
    colors: ['Glacier White Pearl', 'Gravity Grey', 'Intense Red', 'Aurora Black Pearl'],
    features: ['10.25-inch Touchscreen', 'Kia Connect', 'Bose Premium Audio', 'ADAS'],
    bodyType: 'SUV',
  },
  {
    make: 'Mahindra',
    model: 'XUV700',
    variants: ['MX', 'AX3', 'AX5', 'AX7', 'AX7 L'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2021, 2024],
    priceRange: [1300000, 2500000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'Automatic'],
    engine: '2.0L mStallion Turbo Petrol',
    displacement: '1997 cc',
    fuelEfficiency: '13.2 km/l',
    colors: ['Everest White', 'Midnight Black', 'Electric Blue', 'Dazzling Silver'],
    features: ['AdrenoX', 'ADAS Level 2', 'Dual 10.25-inch Screens', 'Sony 3D Sound'],
    bodyType: 'SUV',
  },
  {
    make: 'Tata',
    model: 'Harrier',
    variants: ['XE', 'XM', 'XT', 'XZ', 'XZA+'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2019, 2024],
    priceRange: [1400000, 2400000],
    fuelTypes: ['Diesel'],
    transmissions: ['Manual', 'Automatic'],
    engine: '2.0L Kryotec Diesel',
    displacement: '1956 cc',
    fuelEfficiency: '14.6 km/l',
    colors: ['Coral Red', 'Calisto Copper', 'Orcus White', 'Atlas Black'],
    features: ['10.25-inch Touchscreen', 'JBL Premium Audio', 'Panoramic Sunroof', 'ADAS'],
    bodyType: 'SUV',
  },
  {
    make: 'Toyota',
    model: 'Fortuner',
    variants: ['4x2 AT', '4x2 MT', '4x4 AT'],
    category: VehicleCategory.FOUR_WHEELER,
    yearRange: [2017, 2024],
    priceRange: [2500000, 4500000],
    fuelTypes: ['Petrol', 'Diesel'],
    transmissions: ['Manual', 'Automatic'],
    engine: '2.8L GD Diesel',
    displacement: '2755 cc',
    fuelEfficiency: '10.1 km/l',
    colors: ['Super White', 'Attitude Black', 'Phantom Brown', 'Avant-Garde Bronze'],
    features: ['8-inch Touchscreen', 'JBL Sound System', 'Wireless Charging', 'Toyota Safety Sense'],
    bodyType: 'SUV',
  },
  
  // Two Wheelers
  {
    make: 'Honda',
    model: 'Activa 6G',
    variants: ['Standard', 'DLX', 'H-Smart'],
    category: VehicleCategory.TWO_WHEELER,
    yearRange: [2020, 2024],
    priceRange: [60000, 85000],
    fuelTypes: ['Petrol'],
    transmissions: ['Automatic'],
    engine: '109.51cc',
    displacement: '109.51 cc',
    fuelEfficiency: '60 km/l',
    colors: ['Pearl Precious White', 'Glitter Blue Metallic', 'Black', 'Red'],
    features: ['LED Headlamp', 'External Fuel Lid', 'Silent Start', 'ACG Starter'],
    bodyType: 'Scooter',
  },
  {
    make: 'Royal Enfield',
    model: 'Classic 350',
    variants: ['Classic', 'Dark', 'Chrome'],
    category: VehicleCategory.TWO_WHEELER,
    yearRange: [2020, 2024],
    priceRange: [150000, 220000],
    fuelTypes: ['Petrol'],
    transmissions: ['Manual'],
    engine: '349cc J-Series',
    displacement: '349 cc',
    fuelEfficiency: '35 km/l',
    colors: ['Stealth Black', 'Chrome Red', 'Halcyon Green', 'Signals Marsh Grey'],
    features: ['Tripper Navigation', 'Dual Channel ABS', 'USB Charging', 'Hazard Switch'],
    bodyType: 'Cruiser',
  },
  {
    make: 'Bajaj',
    model: 'Pulsar NS200',
    variants: ['Standard', 'ABS'],
    category: VehicleCategory.TWO_WHEELER,
    yearRange: [2018, 2024],
    priceRange: [110000, 145000],
    fuelTypes: ['Petrol'],
    transmissions: ['Manual'],
    engine: '199.5cc Triple Spark',
    displacement: '199.5 cc',
    fuelEfficiency: '40 km/l',
    colors: ['Burnt Red', 'Graphite Black', 'Chrome Red'],
    features: ['Projector Headlamp', 'Digital Speedometer', 'ABS', 'Clip-on Handlebars'],
    bodyType: 'Sports',
  },
];

// Realistic descriptions templates
const DESCRIPTION_TEMPLATES = [
  (v: VehicleSpec, year: number, km: number, owners: number) => 
    `Well-maintained ${year} ${v.make} ${v.model} with ${km.toLocaleString('en-IN')} km on the odometer. ${owners === 1 ? 'Single owner vehicle' : `${owners} owner vehicle`} with complete service history from authorized service center. All documents are in order and insurance is valid. The ${v.bodyType.toLowerCase()} is in excellent condition with no accidents. Genuine buyers may contact for test drive.`,
  
  (v: VehicleSpec, year: number, km: number, owners: number) =>
    `${year} ${v.make} ${v.model} ${v.variants[Math.floor(Math.random() * v.variants.length)]} for sale. Driven ${km.toLocaleString('en-IN')} km only. ${owners === 1 ? 'First owner' : `${owners}nd owner`}, ${v.fuelTypes[0]} variant with all original spare parts. New tyres fitted recently. AC cooling is excellent. All service done on time. Price slightly negotiable for quick sale.`,
  
  (v: VehicleSpec, year: number, km: number, owners: number) =>
    `Selling my ${v.make} ${v.model} (${year} model). This ${v.bodyType.toLowerCase()} has been driven ${km.toLocaleString('en-IN')} km and maintained immaculately. Features include ${v.features.slice(0, 3).join(', ')}. ${owners === 1 ? 'I am the first owner' : `This is a ${owners} owner vehicle`}. Car is in showroom condition. Reason for selling: upgrading to a bigger car. No brokers please.`,
  
  (v: VehicleSpec, year: number, km: number, owners: number) =>
    `${v.make} ${v.model} ${year} model available for sale. ${v.fuelTypes[0]} engine with ${v.transmissions[0]} transmission. Total ${km.toLocaleString('en-IN')} km driven. ${owners === 1 ? 'Single owner' : `${owners} owners`}. All tyres in good condition, battery replaced recently. Comprehensive insurance valid till next year. Interior is scratch-free. Serious buyers only.`,
];

// Seller names for mock data
const SELLER_NAMES = [
  'Rahul Sharma', 'Priya Singh', 'Amit Kumar', 'Sneha Patel', 'Vikram Reddy',
  'Anjali Mehta', 'Rajesh Gupta', 'Neha Kapoor', 'Suresh Iyer', 'Deepika Nair',
  'Arjun Malhotra', 'Kavita Joshi', 'Nikhil Saxena', 'Pooja Agarwal', 'Manish Tiwari',
  'Sanjay Motors', 'City Auto Sales', 'Premium Cars Hub', 'Reliable Wheels', 'Trust Auto Dealers',
];

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random item from an array
 */
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a realistic registration number
 */
function generateRegistrationNumber(rtoCode: string): string {
  const series = String.fromCharCode(65 + randomInt(0, 25)) + String.fromCharCode(65 + randomInt(0, 25));
  const number = randomInt(1000, 9999);
  return `${rtoCode}-${series}-${number}`;
}

/**
 * Generate a single realistic vehicle
 */
export function generateRealisticVehicle(id: number): Partial<Vehicle> {
  const spec = randomPick(VEHICLE_SPECS);
  const location = randomPick(INDIAN_LOCATIONS);
  
  const year = randomInt(spec.yearRange[0], spec.yearRange[1]);
  const ageYears = new Date().getFullYear() - year;
  
  // Mileage based on age (avg 10-15k km/year)
  const baseMileage = ageYears * randomInt(8000, 15000);
  const mileage = Math.max(5000, Math.min(200000, baseMileage + randomInt(-5000, 5000)));
  
  // Price depreciation based on age and mileage
  const basePrice = randomInt(spec.priceRange[0], spec.priceRange[1]);
  const ageDepreciation = ageYears * 0.08; // 8% per year
  const mileageDepreciation = (mileage / 100000) * 0.1; // 10% per 100k km
  const finalPrice = Math.round(basePrice * (1 - ageDepreciation - mileageDepreciation));
  
  const owners = randomInt(1, Math.min(3, ageYears + 1));
  const rtoCode = randomPick(location.rtoCodes);
  const variant = randomPick(spec.variants);
  const fuelType = randomPick(spec.fuelTypes);
  const transmission = randomPick(spec.transmissions);
  const color = randomPick(spec.colors);
  
  const descTemplate = randomPick(DESCRIPTION_TEMPLATES);
  const description = descTemplate(spec, year, mileage, owners);
  
  const sellerName = randomPick(SELLER_NAMES);
  const isDealer = sellerName.includes('Motors') || sellerName.includes('Auto') || sellerName.includes('Cars') || sellerName.includes('Wheels') || sellerName.includes('Dealers');
  const sellerEmail = isDealer 
    ? `${sellerName.toLowerCase().replace(/\s+/g, '')}@dealer.com`
    : `${sellerName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
  
  // Random features subset
  const vehicleFeatures = spec.features
    .sort(() => Math.random() - 0.5)
    .slice(0, randomInt(3, spec.features.length));
  
  // Insurance validity (random future date)
  const insuranceMonth = randomInt(1, 12);
  const insuranceYear = new Date().getFullYear() + randomInt(0, 1);
  const insuranceValidity = `${insuranceYear}-${String(insuranceMonth).padStart(2, '0')}`;
  
  return {
    id,
    category: spec.category,
    make: spec.make,
    model: spec.model,
    variant,
    year,
    price: finalPrice,
    mileage,
    fuelType,
    transmission,
    color,
    engine: spec.engine,
    displacement: spec.displacement,
    fuelEfficiency: spec.fuelEfficiency,
    features: vehicleFeatures,
    description,
    sellerEmail,
    sellerName,
    status: 'published',
    isFeatured: Math.random() < 0.1, // 10% featured
    views: randomInt(10, 500),
    inquiriesCount: randomInt(0, 20),
    noOfOwners: owners,
    registrationYear: year,
    insuranceValidity,
    insuranceType: Math.random() < 0.7 ? 'Comprehensive' : 'Third Party',
    rto: rtoCode,
    city: location.city,
    state: location.stateCode,
    location: `${location.city}, ${location.state}`,
    registrationNumber: generateRegistrationNumber(rtoCode),
    groundClearance: spec.category === VehicleCategory.FOUR_WHEELER ? `${randomInt(150, 210)} mm` : undefined,
    bootSpace: spec.category === VehicleCategory.FOUR_WHEELER && spec.bodyType !== 'Hatchback' 
      ? `${randomInt(300, 500)} litres` 
      : undefined,
    createdAt: new Date(Date.now() - randomInt(1, 90) * 24 * 60 * 60 * 1000).toISOString(),
    listingStatus: 'active',
    images: [], // Will be replaced with actual images
  };
}

/**
 * Generate multiple realistic vehicles
 */
export function generateRealisticVehicles(count: number): Partial<Vehicle>[] {
  const vehicles: Partial<Vehicle>[] = [];
  
  for (let i = 1; i <= count; i++) {
    vehicles.push(generateRealisticVehicle(i));
  }
  
  return vehicles;
}

/**
 * Generate a realistic mock user
 */
export function generateRealisticUser(email: string, role: 'seller' | 'customer' | 'admin'): Partial<User> {
  const name = randomPick(SELLER_NAMES.filter(n => !n.includes('Motors') && !n.includes('Auto')));
  const location = randomPick(INDIAN_LOCATIONS);
  const isVerified = Math.random() < 0.4; // 40% verified
  
  return {
    email,
    name,
    mobile: `+91-${randomInt(70000, 99999)}-${randomInt(10000, 99999)}`,
    role,
    location: location.city,
    status: 'active',
    createdAt: new Date(Date.now() - randomInt(30, 365) * 24 * 60 * 60 * 1000).toISOString(),
    isVerified,
    phoneVerified: Math.random() < 0.8,
    emailVerified: Math.random() < 0.9,
    govtIdVerified: isVerified,
    averageRating: isVerified ? Number((3.5 + Math.random() * 1.5).toFixed(1)) : undefined,
    ratingCount: isVerified ? randomInt(5, 50) : 0,
    responseTime: randomInt(15, 180),
    responseRate: randomInt(60, 100),
    activeListings: role === 'seller' ? randomInt(1, 10) : 0,
    soldListings: role === 'seller' ? randomInt(0, 30) : 0,
    subscriptionPlan: role === 'seller' 
      ? (Math.random() < 0.3 ? 'premium' : Math.random() < 0.5 ? 'pro' : 'free')
      : undefined,
  };
}

// CLI execution
if (typeof process !== 'undefined' && process.argv[1]?.includes('generateRealisticMockData')) {
  const count = parseInt(process.argv[2] || '50', 10);
  console.log(`Generating ${count} realistic vehicles...`);
  
  const vehicles = generateRealisticVehicles(count);
  console.log(JSON.stringify(vehicles, null, 2));
}

export { VEHICLE_SPECS, INDIAN_LOCATIONS };


import type { Vehicle, User, PlanDetails, FAQItem, SupportTicket } from './types';
import { VehicleCategory, type SubscriptionPlan } from './types';
import { VEHICLE_DATA, getPlaceholderImage } from './components/vehicleData';

// Helper to generate past dates
const daysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
};

export const INSPECTION_SERVICE_FEE = 2500; // Price for a certified inspection report

export const PLAN_DETAILS: Record<SubscriptionPlan, PlanDetails> = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        listingLimit: 1,
        featuredCredits: 0,
        freeCertifications: 0,
        features: [
            '1 Active Listing',
            'Basic Seller Profile',
            'Standard Support',
        ],
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 1999,
        listingLimit: 10,
        featuredCredits: 2,
        freeCertifications: 1,
        isMostPopular: true,
        features: [
            '10 Active Listings',
            '2 Featured Credits/month',
            '1 Free Certified Inspection/month',
            'Enhanced Seller Profile',
            'Performance Analytics',
            'Priority Support',
        ],
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        price: 4999,
        listingLimit: 'unlimited',
        featuredCredits: 5,
        freeCertifications: 3,
        features: [
            'Unlimited Active Listings',
            '5 Featured Credits/month',
            '3 Free Certified Inspections/month',
            'AI Listing Assistant',
            'Advanced Analytics',
            'Dedicated Support',
        ],
    },
};

export const INDIAN_STATES = [
    { name: 'Andaman & Nicobar Islands', code: 'AN' }, { name: 'Andhra Pradesh', code: 'AP' },
    { name: 'Arunachal Pradesh', code: 'AR' }, { name: 'Assam', code: 'AS' }, { name: 'Bihar', code: 'BR' },
    { name: 'Chandigarh', code: 'CH' }, { name: 'Chhattisgarh', code: 'CG' },
    { name: 'Dadra & Nagar Haveli and Daman & Diu', code: 'DD' }, { name: 'Delhi', code: 'DL' },
    { name: 'Goa', code: 'GA' }, { name: 'Gujarat', code: 'GJ' }, { name: 'Haryana', code: 'HR' },
    { name: 'Himachal Pradesh', code: 'HP' }, { name: 'Jammu & Kashmir', code: 'JK' },
    { name: 'Jharkhand', code: 'JH' }, { name: 'Karnataka', code: 'KA' }, { name: 'Kerala', code: 'KL' },
    { name: 'Ladakh', code: 'LA' }, { name: 'Lakshadweep', code: 'LD' }, { name: 'Madhya Pradesh', code: 'MP' },
    { name: 'Maharashtra', code: 'MH' }, { name: 'Manipur', code: 'MN' }, { name: 'Meghalaya', code: 'ML' },
    { name: 'Mizoram', code: 'MZ' }, { name: 'Nagaland', code: 'NL' }, { name: 'Odisha', code: 'OR' },
    { name: 'Puducherry', code: 'PY' }, { name: 'Punjab', code: 'PB' }, { name: 'Rajasthan', code: 'RJ' },
    { name: 'Sikkim', code: 'SK' }, { name: 'Tamil Nadu', code: 'TN' }, { name: 'Telangana', code: 'TS' },
    { name: 'Tripura', code: 'TR' }, { name: 'Uttar Pradesh', code: 'UP' }, { name: 'Uttarakhand', code: 'UK' },
    { name: 'West Bengal', code: 'WB' },
];

export const CITIES_BY_STATE: Record<string, string[]> = {
    'AP': ['Visakhapatnam', 'Vijayawada', 'Guntur'], 'AR': ['Itanagar'], 'AS': ['Guwahati', 'Dibrugarh'],
    'BR': ['Patna', 'Gaya'], 'CG': ['Raipur', 'Bhilai'], 'GA': ['Panaji', 'Margao'],
    'GJ': ['Ahmedabad', 'Surat', 'Vadodara'], 'HR': ['Gurugram', 'Faridabad', 'Chandigarh'],
    'HP': ['Shimla', 'Manali'], 'JH': ['Ranchi', 'Jamshedpur'], 'KA': ['Bengaluru', 'Mysuru', 'Mangaluru'],
    'KL': ['Kochi', 'Thiruvananthapuram', 'Kozhikode'], 'MP': ['Indore', 'Bhopal', 'Jabalpur'],
    'MH': ['Mumbai', 'Pune', 'Nagpur'], 'MN': ['Imphal'], 'ML': ['Shillong'], 'MZ': ['Aizawl'],
    'NL': ['Kohima'], 'OR': ['Bhubaneswar', 'Cuttack'], 'PB': ['Ludhiana', 'Amritsar'],
    'RJ': ['Jaipur', 'Jodhpur', 'Udaipur'], 'SK': ['Gangtok'], 'TN': ['Chennai', 'Coimbatore', 'Madurai'],
    'TS': ['Hyderabad', 'Warangal'], 'TR': ['Agartala'], 'UP': ['Lucknow', 'Kanpur', 'Noida'],
    'UK': ['Dehradun', 'Haridwar'], 'WB': ['Kolkata', 'Howrah'], 'DL': ['New Delhi'],
    'JK': ['Srinagar', 'Jammu'], 'LA': ['Leh'], 'AN': ['Port Blair'], 'CH': ['Chandigarh'],
    'DD': ['Daman'], 'LD': ['Kavaratti'], 'PY': ['Puducherry'],
};

// Fetch users from MongoDB API
export async function getMockUsers(): Promise<User[]> {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        return data.users || [];
    } catch (error) {
        console.error('Error fetching users:', error);
        return getFallbackUsers();
    }
}

// Fallback users for when API is not available
export const getFallbackUsers = (): User[] => [
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

// For backward compatibility, export a function that returns users
export const MOCK_USERS = getMockUsers;

// Fetch FAQs from MongoDB API
export async function getMockFAQs(): Promise<FAQItem[]> {
    try {
        const response = await fetch('/api/faqs');
        const data = await response.json();
        return data.faqs || [];
    } catch (error) {
        console.error('Error fetching FAQs:', error);
        return getFallbackFAQs();
    }
}

// Fallback FAQs for when API is not available
export const getFallbackFAQs = (): FAQItem[] => [
    { 
        id: 1,
        question: "How do I list my car for sale?", 
        answer: "Navigate to the 'Sell' section, log in or register as a seller, and follow the on-screen instructions to create a new vehicle listing. You'll need details like make, model, year, and photos.", 
        category: "Selling" 
    },
    { 
        id: 2,
        question: "What is AI Price Suggestion?", 
        answer: "Our AI Price Suggestion tool analyzes your vehicle's details and compares them with current market listings to recommend a fair and competitive price, helping you sell faster.", 
        category: "Selling" 
    }
];

// For backward compatibility, export a function that returns FAQs
export const MOCK_FAQS = getMockFAQs;

// Fetch Support Tickets from MongoDB API
export async function getMockSupportTickets(): Promise<SupportTicket[]> {
    try {
        const response = await fetch('/api/support-tickets');
        const data = await response.json();
        return data.tickets || [];
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        return getFallbackSupportTickets();
    }
}

// Fallback support tickets for when API is not available
export const getFallbackSupportTickets = (): SupportTicket[] => [
    { 
        id: 1,
        userEmail: 'customer@test.com', 
        userName: 'Mock Customer', 
        subject: 'Issue with chat', 
        message: 'I am unable to see messages from a seller.', 
        status: 'Open', 
        createdAt: daysAgo(2), 
        updatedAt: daysAgo(2), 
        replies: [] 
    }
];

// For backward compatibility, export a function that returns support tickets
export const MOCK_SUPPORT_TICKETS = getMockSupportTickets;


const COLORS = ['White', 'Black', 'Silver', 'Grey', 'Red', 'Blue', 'Brown', 'Beige'];
const FEATURES = ['Sunroof', 'Touchscreen Infotainment', 'Automatic Climate Control', 'Alloy Wheels', 'Ventilated Seats', '360 Camera', 'ADAS', 'Wireless Charging', 'Cruise Control', 'LED Headlamps'];
const TRANSMISSIONS = ['Automatic', 'Manual', 'CVT', 'DCT'];
export const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];

const randomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomNumber = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateMockVehicles = (count: number): Vehicle[] => {
    const vehicles: Vehicle[] = [];
    const sellers = getFallbackUsers().filter(u => u.role === 'seller');

    for (let i = 1; i <= count; i++) {
        const category = VehicleCategory.FOUR_WHEELER;
        if (!VEHICLE_DATA[category] || VEHICLE_DATA[category].length === 0) continue;

        const makeData = randomItem(VEHICLE_DATA[category]);
        const make = makeData.name;
        if (!makeData.models || makeData.models.length === 0) continue;

        const modelData = randomItem(makeData.models);
        const model = modelData.name;
        const variants = modelData.variants;
        const variant = variants.length > 0 ? randomItem(variants) : undefined;
        
        const year = randomNumber(2015, new Date().getFullYear());
        const mileage = randomNumber(5000, 120000);
        const price = Math.round(randomNumber(400000, 4000000) / 5000) * 5000;
        const seller = randomItem(sellers);
        const state = randomItem(Object.keys(CITIES_BY_STATE));
        const city = randomItem(CITIES_BY_STATE[state]);

        const vehicle: Vehicle = {
            id: i,
            category,
            make,
            model,
            variant,
            year,
            price,
            mileage,
            location: `${city}, ${state}`,
            images: [getPlaceholderImage(make, model), getPlaceholderImage(make, `${model}${i}`)],
            videoUrl: Math.random() > 0.7 ? 'https://cdn.coverr.co/videos/coverr-a-porsche-911-on-a-bridge-638/1080p.mp4' : undefined,
            features: Array.from(new Set(Array.from({ length: randomNumber(3, 7) }, () => randomItem(FEATURES)))),
            description: `A well-maintained ${year} ${make} ${model} ${variant || ''}. Comes with features like ${randomItem(FEATURES)} and ${randomItem(FEATURES)}. Available in ${city}.`,
            sellerEmail: seller.email,
            status: 'published',
            isFeatured: Math.random() < 0.1,
            views: randomNumber(0, 500),
            inquiriesCount: randomNumber(0, 50),
            certificationStatus: randomItem(['none', 'requested', 'approved', 'rejected', 'certified']),
            engine: `${randomNumber(1, 2)}.${randomNumber(0, 9)}L ${randomItem(FUEL_TYPES)}`,
            transmission: randomItem(TRANSMISSIONS),
            fuelType: randomItem(FUEL_TYPES),
            fuelEfficiency: `${randomNumber(12, 25)} KMPL`,
            color: randomItem(COLORS),
            noOfOwners: randomNumber(1, 3),
            registrationYear: randomNumber(2015, 2024),
            insuranceValidity: `${randomNumber(2024, 2026)}-${String(randomNumber(1, 12)).padStart(2, '0')}`,
            insuranceType: randomItem(['Comprehensive', 'Third Party']),
            rto: `${randomItem(['MH', 'DL', 'KA', 'TN', 'GJ'])}${randomNumber(10, 99)}`,
            city,
            state,
            displacement: `${randomNumber(1000, 3000)} cc`,
            groundClearance: `${randomNumber(150, 200)} mm`,
            bootSpace: `${randomNumber(300, 600)} litres`
        };

        vehicles.push(vehicle);
    }
    return vehicles;
};

// Fetch Vehicles from MongoDB API
export async function getMockVehicles(): Promise<Vehicle[]> {
    try {
        const response = await fetch('/api/vehicles');
        const data = await response.json();
        return data.vehicles || [];
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        return generateMockVehicles(10); // Fallback to generated vehicles
    }
}

// For backward compatibility, export a function that returns vehicles
export const MOCK_VEHICLES = getMockVehicles;

// ============================================
// LOCATION & DISCOVERY CONSTANTS
// ============================================
export const INDIAN_LANDMARKS: import('./types').NearbyLandmark[] = [
  // Mumbai
  { id: 1, name: 'Andheri Metro Station', type: 'metro', location: { lat: 19.1197, lng: 72.8464 }, city: 'Mumbai', state: 'MH' },
  { id: 2, name: 'CST Railway Station', type: 'railway', location: { lat: 18.9398, lng: 72.8355 }, city: 'Mumbai', state: 'MH' },
  { id: 3, name: 'Phoenix Marketcity', type: 'mall', location: { lat: 19.0874, lng: 72.8886 }, city: 'Mumbai', state: 'MH' },
  { id: 4, name: 'Mumbai Airport', type: 'airport', location: { lat: 19.0896, lng: 72.8656 }, city: 'Mumbai', state: 'MH' },
  // Delhi
  { id: 5, name: 'Rajiv Chowk Metro', type: 'metro', location: { lat: 28.6328, lng: 77.2197 }, city: 'New Delhi', state: 'DL' },
  { id: 6, name: 'New Delhi Railway Station', type: 'railway', location: { lat: 28.6431, lng: 77.2197 }, city: 'New Delhi', state: 'DL' },
  { id: 7, name: 'IGI Airport', type: 'airport', location: { lat: 28.5562, lng: 77.1000 }, city: 'New Delhi', state: 'DL' },
  // Bangalore
  { id: 8, name: 'MG Road Metro', type: 'metro', location: { lat: 12.9758, lng: 77.6065 }, city: 'Bengaluru', state: 'KA' },
  { id: 9, name: 'Bangalore Railway Station', type: 'railway', location: { lat: 12.9775, lng: 77.5718 }, city: 'Bengaluru', state: 'KA' },
  { id: 10, name: 'Kempegowda Airport', type: 'airport', location: { lat: 13.1979, lng: 77.7068 }, city: 'Bengaluru', state: 'KA' },
  // Hyderabad
  { id: 11, name: 'Ameerpet Metro', type: 'metro', location: { lat: 17.4374, lng: 78.4482 }, city: 'Hyderabad', state: 'TS' },
  { id: 12, name: 'Secunderabad Railway', type: 'railway', location: { lat: 17.4342, lng: 78.5025 }, city: 'Hyderabad', state: 'TS' },
];

export const CITY_COORDINATES: Record<string, import('./types').LocationCoordinates> = {
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'New Delhi': { lat: 28.6139, lng: 77.2090 },
  'Bengaluru': { lat: 12.9716, lng: 77.5946 },
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Kolkata': { lat: 22.5726, lng: 88.3639 },
};

export const POPULAR_SEARCHES_BY_CITY: Record<string, import('./types').PopularSearch[]> = {
  'Mumbai': [
    { id: 1, query: 'Maruti Swift under 5 lakhs', count: 1250, city: 'Mumbai', state: 'MH', createdAt: new Date().toISOString() },
    { id: 2, query: 'Hyundai Creta 2020', count: 980, city: 'Mumbai', state: 'MH', createdAt: new Date().toISOString() },
    { id: 3, query: 'Honda City automatic', count: 756, city: 'Mumbai', state: 'MH', createdAt: new Date().toISOString() },
  ],
  'New Delhi': [
    { id: 4, query: 'Toyota Fortuner diesel', count: 1150, city: 'New Delhi', state: 'DL', createdAt: new Date().toISOString() },
    { id: 5, query: 'Tata Nexon EV', count: 890, city: 'New Delhi', state: 'DL', createdAt: new Date().toISOString() },
  ],
  'Bengaluru': [
    { id: 6, query: 'Mercedes E-Class', count: 980, city: 'Bengaluru', state: 'KA', createdAt: new Date().toISOString() },
    { id: 7, query: 'Mahindra XUV700', count: 650, city: 'Bengaluru', state: 'KA', createdAt: new Date().toISOString() },
  ],
};

// ============================================
// MONETIZATION CONSTANTS
// ============================================
export const BOOST_PACKAGES: import('./types').BoostPackage[] = [
  {
    id: 'top_search_3',
    name: 'Top Search - 3 Days',
    type: 'top_search',
    durationDays: 3,
    price: 299,
    features: ['Top of search results', '3x more visibility', 'Priority placement'],
  },
  {
    id: 'top_search_7',
    name: 'Top Search - 7 Days',
    type: 'top_search',
    durationDays: 7,
    price: 599,
    features: ['Top of search results', '3x more visibility', 'Priority placement', 'Best Value'],
  },
  {
    id: 'homepage_spot',
    name: 'Homepage Spotlight',
    type: 'homepage_spotlight',
    durationDays: 7,
    price: 999,
    features: ['Featured on homepage', 'Maximum visibility', 'Premium badge', 'Guaranteed views'],
  },
  {
    id: 'featured_badge',
    name: 'Featured Badge',
    type: 'featured_badge',
    durationDays: 15,
    price: 499,
    features: ['Featured badge', 'Stand out from crowd', 'Trust indicator'],
  },
  {
    id: 'multi_city',
    name: 'Multi-City Promotion',
    type: 'multi_city',
    durationDays: 7,
    price: 1499,
    features: ['Visible in 3 cities', 'Maximum reach', 'Best for dealers', 'Top placement'],
  },
];

// ============================================
// TRUST & SAFETY CONSTANTS
// ============================================
export const SAFETY_TIPS = [
  'Always meet in a public place during daylight hours',
  'Never share bank details or OTP with anyone',
  'Verify vehicle documents before making payment',
  'Test drive with seller present and valid documents',
  'Check vehicle history and registration details',
  'Avoid advance payments without proper agreement',
  'Report suspicious listings immediately',
];

export const LISTING_EXPIRY_DAYS = 30; // Listings expire after 30 days
export const AUTO_REFRESH_DAYS = 7; // Auto-refresh every 7 days
export const MAX_FREE_LISTINGS = 1;
export const MAX_PRO_LISTINGS = 10;

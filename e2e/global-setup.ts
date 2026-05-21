import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { ensureSoldVehicleForE2E } from './helpers/catalog';
import { E2E_TEST_USERS } from './fixtures/test-users';

const SEED_STORAGE_PATH = path.join(process.cwd(), 'e2e/.auth/seed-storage.json');

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Test Global Setup...');
  
  // Start the development server if not already running
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for the application to be ready
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('✅ Application is ready for testing');
    
    // Seed test data if needed
    await seedTestData(page);
    await fs.mkdir(path.dirname(SEED_STORAGE_PATH), { recursive: true });
    await page.context().storageState({ path: SEED_STORAGE_PATH });
    await waitForDevApi();
    const sold = await ensureSoldVehicleForE2E();
    if (sold) {
      console.log(`✅ E2E sold fixture ready (vehicle id: ${sold.id})`);
    } else {
      console.warn('⚠️ No sold vehicle seeded — sold listing E2E may skip');
    }
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('✅ Global setup completed');
}

async function waitForDevApi() {
  const base = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // API still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Dev API did not become ready for E2E setup');
}

async function seedTestData(page: any) {
  console.log('🌱 Seeding test data...');
  
  const testUsers = [...E2E_TEST_USERS];

  // Create test vehicles
  const testVehicles = [
    {
      id: 1,
      make: 'Honda',
      model: 'City',
      year: 2020,
      price: 850000,
      mileage: 25000,
      category: 'FOUR_WHEELER',
      sellerEmail: 'seller@test.com',
      status: 'published',
      images: ['https://via.placeholder.com/400x300/FF6B35/FFFFFF?text=Honda+City'],
      features: ['Air Conditioning', 'Power Steering', 'Central Locking'],
      description: 'Well maintained Honda City in excellent condition.',
      city: 'Mumbai',
      state: 'MH',
      fuelType: 'Petrol',
      transmission: 'Manual',
      engine: '1.5L',
      color: 'White'
    },
    {
      id: 2,
      make: 'Maruti',
      model: 'Swift',
      year: 2019,
      price: 650000,
      mileage: 30000,
      category: 'FOUR_WHEELER',
      sellerEmail: 'seller@test.com',
      status: 'published',
      images: ['https://via.placeholder.com/400x300/FF6B35/FFFFFF?text=Maruti+Swift'],
      features: ['Air Conditioning', 'Power Steering', 'Music System'],
      description: 'Low mileage Maruti Swift in good condition.',
      city: 'Delhi',
      state: 'DL',
      fuelType: 'Petrol',
      transmission: 'Manual',
      engine: '1.2L',
      color: 'Red'
    }
  ];

  // Create test conversations
  const testConversations = [
    {
      id: 'conv-test-1',
      customerId: 'customer@test.com',
      customerName: 'Test Customer',
      sellerId: 'seller@test.com',
      vehicleId: 1,
      vehicleName: 'Honda City',
      messages: [
        {
          id: 1,
          sender: 'customer',
          text: 'Is this vehicle still available?',
          timestamp: new Date().toISOString(),
          isRead: true,
          type: 'text'
        },
        {
          id: 2,
          sender: 'seller',
          text: 'Yes, it is available. Would you like to schedule a viewing?',
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'text'
        }
      ],
      lastMessageAt: new Date().toISOString(),
      isReadBySeller: false,
      isReadByCustomer: true
    }
  ];

  // Store test data in localStorage
  await page.evaluate(({ users, vehicles, conversations }) => {
    localStorage.setItem('reRideUsers', JSON.stringify(users));
    localStorage.setItem('reRideUsers_prod', JSON.stringify(users));
    localStorage.setItem('reRideVehicles', JSON.stringify(vehicles));
    localStorage.setItem('reRideConversations', JSON.stringify(conversations));
  }, { users: testUsers, vehicles: testVehicles, conversations: testConversations });

  console.log('✅ Test data seeded successfully');
}

export default globalSetup;

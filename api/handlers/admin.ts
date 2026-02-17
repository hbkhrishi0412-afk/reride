/**
 * api/handlers/admin.ts — Admin endpoint handler
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE, adminRead, DB_PATHS, HandlerOptions,
  supabaseUserService as userService,
  supabaseVehicleService as vehicleService,
} from './shared';
import { verifyToken, hashPassword, type TokenPayload } from '../../utils/security.js';
import { logSecurity, logError, logInfo } from '../../utils/logger.js';
import { VehicleCategory } from '../../types.js';
import type { User as UserType, Vehicle as VehicleType } from '../../types.js';
import { randomBytes } from 'crypto';

function generateRandomPassword(): string {
  return randomBytes(32).toString('hex');
}

export async function handleAdmin(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const { action } = req.query;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      reason: 'Unauthorized. Admin endpoints require authentication.',
    });
  }

  const token = authHeader.substring(7);
  let decoded: TokenPayload & { [key: string]: unknown };
  try {
    decoded = { ...verifyToken(token) } as TokenPayload & { [key: string]: unknown };
  } catch {
    return res.status(401).json({ success: false, reason: 'Invalid or expired token.' });
  }

  if (decoded.role !== 'admin') {
    return res.status(403).json({ success: false, reason: 'Admin access required.' });
  }

  logSecurity(`Admin action '${action}' by: ${decoded.email}`, { userId: decoded.userId, action });

  if (action === 'health') {
    try {
      if (!USE_SUPABASE) {
        return res.status(200).json({
          success: false,
          message: 'Database not configured',
          checks: [{ name: 'Database Configuration', status: 'FAIL' }],
        });
      }
      await adminRead(DB_PATHS.USERS, 'test');
      return res.status(200).json({
        success: true,
        message: 'Database connected',
        checks: [
          { name: 'Database Configuration', status: 'PASS' },
          { name: 'Database Connection', status: 'PASS' },
        ],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (action === 'seed') {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, reason: 'Seed disabled in production' });
    }
    if (!USE_SUPABASE) {
      return res.status(503).json({ success: false, message: 'Database not configured', fallback: true });
    }
    try {
      const users = await seedUsers();
      const vehicles = await seedVehicles();
      return res.status(200).json({
        success: true,
        message: 'Database seeded',
        data: { users: users.length, vehicles: vehicles.length },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Seeding failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(400).json({ success: false, reason: 'Invalid admin action' });
}

// ── Seed helpers ────────────────────────────────────────────────────────────

export async function seedUsers(productionSecret?: string): Promise<UserType[]> {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProduction && !productionSecret) throw new Error('Production seeding requires secret key');

  const adminPw = process.env.SEED_ADMIN_PASSWORD || (isProduction ? generateRandomPassword() : 'password');
  const sellerPw = process.env.SEED_SELLER_PASSWORD || (isProduction ? generateRandomPassword() : 'password');
  const customerPw = process.env.SEED_CUSTOMER_PASSWORD || (isProduction ? generateRandomPassword() : 'password');

  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + 1);

  const sampleUsers: Array<Omit<UserType, 'id'>> = [
    { email: 'admin@test.com', password: await hashPassword(adminPw), name: 'Admin User', mobile: '9876543210', location: 'Mumbai', role: 'admin', status: 'active', isVerified: true, subscriptionPlan: 'premium', featuredCredits: 100, createdAt: now.toISOString() },
    { email: 'seller@test.com', password: await hashPassword(sellerPw), name: 'Prestige Motors', mobile: '+91-98765-43210', location: 'Delhi', role: 'seller', status: 'active', isVerified: true, subscriptionPlan: 'premium', featuredCredits: 5, usedCertifications: 1, dealershipName: 'Prestige Motors', bio: 'Luxury vehicles', planActivatedDate: now.toISOString(), planExpiryDate: expiry.toISOString(), createdAt: now.toISOString() },
    { email: 'customer@test.com', password: await hashPassword(customerPw), name: 'Test Customer', mobile: '9876543212', location: 'Bangalore', role: 'customer', status: 'active', isVerified: false, subscriptionPlan: 'free', featuredCredits: 0, createdAt: now.toISOString() },
  ];

  if (!isProduction) {
    logInfo('Seed passwords: admin=' + (process.env.SEED_ADMIN_PASSWORD ? '[env]' : adminPw) + ' seller=' + (process.env.SEED_SELLER_PASSWORD ? '[env]' : sellerPw));
  }

  const existing = await userService.findAll();
  for (const u of existing) {
    if (['admin@test.com', 'seller@test.com', 'customer@test.com'].includes(u.email.toLowerCase())) {
      await userService.delete(u.email);
    }
  }

  const users: UserType[] = [];
  for (const ud of sampleUsers) {
    users.push(await userService.create(ud));
  }
  return users;
}

export async function seedVehicles(): Promise<VehicleType[]> {
  const makes = ['Tata', 'Mahindra', 'Hyundai', 'Maruti Suzuki', 'Honda', 'Toyota', 'Kia', 'MG'];
  const modelsByMake: Record<string, string[]> = { Tata: ['Nexon', 'Harrier', 'Safari'], Mahindra: ['XUV700', 'Scorpio', 'Thar'], Hyundai: ['Creta', 'Venue', 'i20'], 'Maruti Suzuki': ['Brezza', 'Swift', 'Baleno'], Honda: ['City', 'Amaze'], Toyota: ['Fortuner', 'Innova'], Kia: ['Seltos', 'Sonet'], MG: ['Hector', 'Astor'] };
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Chennai', 'Hyderabad'];
  const statesByCity: Record<string, string> = { Mumbai: 'MH', Pune: 'MH', Delhi: 'DL', Bangalore: 'KA', Chennai: 'TN', Hyderabad: 'TS' };

  // Cleanup existing test vehicles
  try {
    const existing = await vehicleService.findAll();
    for (const v of existing.filter(v => v.sellerEmail?.toLowerCase() === 'seller@test.com')) {
      try { await vehicleService.delete(v.id); } catch { /* skip */ }
    }
  } catch { /* skip cleanup errors */ }

  const vehicles: VehicleType[] = [];
  for (let i = 1; i <= 50; i++) {
    const make = makes[Math.floor(Math.random() * makes.length)];
    const models = modelsByMake[make] || ['Model'];
    const model = models[Math.floor(Math.random() * models.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const state = statesByCity[city] || 'MH';
    const year = 2015 + Math.floor(Math.random() * 10);
    const engineSize = 1000 + Math.floor(Math.random() * 1500);

    try {
      const v = await vehicleService.create({
        make, model, variant: model, year,
        price: Math.round((300000 + Math.random() * 2000000) / 5000) * 5000,
        mileage: Math.floor(Math.random() * 100000),
        category: VehicleCategory.FOUR_WHEELER,
        sellerEmail: 'seller@test.com',
        status: 'published', isFeatured: Math.random() > 0.7,
        views: Math.floor(Math.random() * 1000),
        images: [`https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&sig=${i}`],
        features: ['Power Steering', 'AC', 'ABS', 'Airbags'],
        description: `${year} ${make} ${model} in ${city}`,
        engine: `${engineSize} cc`, transmission: 'Manual', fuelType: 'Petrol',
        fuelEfficiency: `${12 + Math.floor(Math.random() * 13)} km/l`,
        color: 'White', location: `${city}, ${state}`, city, state,
        registrationYear: year, insuranceValidity: new Date(Date.now() + 365 * 86400000).toISOString(),
        insuranceType: 'Comprehensive', rto: `${state}-01`,
        noOfOwners: 1, displacement: `${engineSize} cc`,
        groundClearance: '170 mm', bootSpace: '300 litres',
      });
      vehicles.push(v);
    } catch { /* skip individual failures */ }
  }
  return vehicles;
}


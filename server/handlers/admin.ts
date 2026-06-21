/**
 * server/handlers/admin.ts — Admin endpoint handler
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE, adminRead, DB_PATHS, HandlerOptions,
  supabaseUserService as userService,
  supabaseVehicleService as vehicleService,
  getSupabaseAdminClient,
  authenticateRequestDual,
} from '../handler-shared.js';
import { hashPassword } from '../../utils/security.js';
import { logSecurity, logError, logInfo } from '../../utils/logger.js';
import { normalizeUserRoleString } from '../../utils/user-role.js';
import { VehicleCategory } from '../../vehicle-category.js';
import type { User as UserType, Vehicle as VehicleType } from '../../types.js';
import { randomBytes, randomInt } from 'crypto';

function generateRandomPassword(): string {
  return randomBytes(32).toString('hex');
}

function firstQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export async function handleAdminBuyerInspections(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, reason: 'Method not allowed' });
    return;
  }
  if (!USE_SUPABASE) {
    res.status(503).json({ success: false, reason: 'Database not available' });
    return;
  }

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').toLowerCase().trim();
  const flaggedOnly = String(req.query.flaggedOnly || '') === '1';

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('buyer_inspections')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (flaggedOnly) {
    query = query.not('flagged_keys', 'eq', '[]');
  }

  const { data: rows, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ success: false, reason: error.message });
    return;
  }

  const inspectionIds = (rows || []).map((r) => r.id as string);
  const vehicleIds = [...new Set((rows || []).map((r) => String(r.vehicle_id)))];

  const { data: flags } =
    inspectionIds.length > 0
      ? await supabase.from('disclosure_flags').select('*').in('inspection_id', inspectionIds)
      : { data: [] as Array<Record<string, unknown>> };

  const flagByInspection = new Map(
    (flags || []).map((f) => [String(f.inspection_id), f]),
  );

  const vehicleSellerById = new Map<string, string>();
  await Promise.all(
    vehicleIds.map(async (vehicleId) => {
      try {
        const num = Number(vehicleId);
        const isPlainNumericId =
          Number.isFinite(num) && num > 0 && String(num) === vehicleId;
        const resolved = await vehicleService.resolveVehicleIdentity(
          isPlainNumericId ? { id: num, databaseId: vehicleId } : { databaseId: vehicleId },
        );
        if (resolved.vehicle?.sellerEmail) {
          vehicleSellerById.set(vehicleId, resolved.vehicle.sellerEmail);
        }
      } catch {
        /* skip */
      }
    }),
  );

  let inspections = (rows || []).map((row) => {
    const flag = flagByInspection.get(String(row.id));
    return {
      id: String(row.id),
      vehicleId: String(row.vehicle_id),
      buyerEmail: String(row.buyer_email),
      items: Array.isArray(row.items) ? row.items : [],
      flaggedKeys: Array.isArray(row.flagged_keys) ? row.flagged_keys : [],
      generalNotes: row.general_notes != null ? String(row.general_notes) : null,
      createdAt: String(row.created_at),
      sellerEmail: flag?.seller_email
        ? String(flag.seller_email)
        : vehicleSellerById.get(String(row.vehicle_id)) || null,
      disclosureReason: flag?.reason != null ? String(flag.reason) : null,
    };
  });

  if (search) {
    inspections = inspections.filter((row) => {
      const haystack = [
        row.buyerEmail,
        row.vehicleId,
        row.sellerEmail || '',
        row.generalNotes || '',
        row.disclosureReason || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const total = count ?? inspections.length;
  res.status(200).json({
    success: true,
    inspections,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function handleAdmin(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const action = firstQueryParam(req.query.action as string | string[] | undefined);

  const adminAuth = await authenticateRequestDual(req);
  if (!adminAuth.isValid || !adminAuth.user) {
    return res.status(401).json({
      success: false,
      reason: 'Unauthorized. Admin endpoints require authentication.',
    });
  }

  let adminRole = adminAuth.user.role;
  if (adminRole !== 'admin' && adminAuth.user.email && USE_SUPABASE) {
    try {
      const dbUser = await userService.findByEmail(adminAuth.user.email.toLowerCase().trim());
      if (dbUser && normalizeUserRoleString(dbUser.role) === 'admin') {
        adminRole = 'admin';
      }
    } catch {
      /* non-fatal */
    }
  }

  if (adminRole !== 'admin') {
    return res.status(403).json({ success: false, reason: 'Admin access required.' });
  }

  logSecurity(`Admin action '${action}' by: ${adminAuth.user.email}`, {
    userId: adminAuth.user.userId,
    action,
  });

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

  if (action === 'buyer-inspections') {
    return handleAdminBuyerInspections(req, res);
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
      try {
        await vehicleService.delete(v.databaseId || String(v.id));
      } catch {
        /* skip */
      }
    }
  } catch { /* skip cleanup errors */ }

  const vehicles: VehicleType[] = [];
  const pick = <T>(arr: T[]): T => arr[randomInt(0, arr.length)]!;
  for (let i = 1; i <= 50; i++) {
    const make = pick(makes);
    const models = modelsByMake[make] || ['Model'];
    const model = pick(models);
    const city = pick(cities);
    const state = statesByCity[city] || 'MH';
    const year = 2015 + randomInt(0, 10);
    const engineSize = 1000 + randomInt(0, 1500);

    try {
      const v = await vehicleService.create({
        make, model, variant: model, year,
        price: Math.round((300000 + randomInt(0, 2_000_000)) / 5000) * 5000,
        mileage: randomInt(0, 100_000),
        category: VehicleCategory.FOUR_WHEELER,
        sellerEmail: 'seller@test.com',
        status: 'published', isFeatured: randomInt(0, 10) > 6,
        views: randomInt(0, 1000),
        images: [`https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&sig=${i}`],
        features: ['Power Steering', 'AC', 'ABS', 'Airbags'],
        description: `${year} ${make} ${model} in ${city}`,
        engine: `${engineSize} cc`, transmission: 'Manual', fuelType: 'Petrol',
        fuelEfficiency: `${12 + randomInt(0, 13)} km/l`,
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

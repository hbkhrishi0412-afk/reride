import { 
  create, 
  read, 
  readAll, 
  updateData, 
  deleteData, 
  queryByField,
  snapshotToArray,
  DB_PATHS 
} from '../lib/firebase-db.js';
import type { Vehicle } from '../types.js';

// Import Admin SDK functions for server-side operations (serverless functions)
// Only import when in server context to avoid bundling in client
let adminDbFunctions: {
  adminReadAll: <T>(collection: string) => Promise<Record<string, T>>;
  adminCreate: <T extends Record<string, unknown>>(collection: string, data: T, key?: string) => Promise<string>;
  adminRead: <T>(collection: string, key: string) => Promise<T | null>;
  adminUpdate: <T extends Record<string, unknown>>(collection: string, key: string, updates: Partial<T>) => Promise<void>;
  adminDelete: (collection: string, key: string) => Promise<void>;
  adminQueryByField: <T>(collection: string, field: string, value: string | number | boolean) => Promise<Record<string, T>>;
  snapshotToArray: <T>(data: Record<string, T>) => Array<T & { id: string }>;
} | null = null;

// Lazy load Admin SDK functions only in server context
async function getAdminDbFunctions() {
  if (typeof window !== 'undefined') {
    // Client-side: Admin SDK not available
    return null;
  }
  
  if (!adminDbFunctions) {
    try {
      // Dynamic import to avoid bundling Admin SDK in client code
      const adminDb = await import('../server/firebase-admin-db.js');
      adminDbFunctions = {
        adminReadAll: adminDb.adminReadAll,
        adminCreate: adminDb.adminCreate,
        adminRead: adminDb.adminRead,
        adminUpdate: adminDb.adminUpdate,
        adminDelete: adminDb.adminDelete,
        adminQueryByField: adminDb.adminQueryByField,
        snapshotToArray: (data: Record<string, any>) => {
          return Object.keys(data).map(key => ({ id: key, ...data[key] }));
        },
      };
    } catch (error) {
      // If Admin SDK fails to load, log error but continue (will fall back to client SDK)
      console.warn('⚠️ Failed to load Firebase Admin SDK, falling back to client SDK:', error);
      return null;
    }
  }
  
  return adminDbFunctions;
}

// Helper function to safely convert string ID to number
// Ensures we always return a number (never a string) to maintain type safety
function convertIdToNumber(idString: string): number {
  const parsedId = Number(idString);
  return isNaN(parsedId) ? 0 : parsedId;
}

// Helper function to convert snapshot array items to Vehicle objects with numeric IDs
function convertSnapshotToVehicles<T extends { id: string }>(items: T[]): Vehicle[] {
  return items.map(v => ({
    ...v,
    id: convertIdToNumber(v.id),
  })) as Vehicle[];
}

// Vehicle service for Firebase Realtime Database
// Uses Admin SDK in server context (serverless functions), Client SDK in browser context
export const firebaseVehicleService = {
  // Create a new vehicle
  async create(vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    // Generate a unique ID
    const id = Date.now();
    
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      await adminDb.adminCreate(DB_PATHS.VEHICLES, vehicleData, id.toString());
    } else {
      await create(DB_PATHS.VEHICLES, vehicleData, id.toString());
    }
    
    return {
      id,
      ...vehicleData,
    } as Vehicle;
  },

  // Find vehicle by ID
  async findById(id: number): Promise<Vehicle | null> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      const vehicle = await adminDb.adminRead<Vehicle & { id: string }>(DB_PATHS.VEHICLES, id.toString());
      // adminRead returns { id: string, ...data }, convert to numeric id
      if (vehicle) {
        const { id: stringId, ...vehicleData } = vehicle;
        return { ...vehicleData, id } as Vehicle;
      }
      return null;
    } else {
      const vehicle = await read<Vehicle>(DB_PATHS.VEHICLES, id.toString());
      return vehicle ? { ...vehicle, id } : null;
    }
  },

  // Get all vehicles
  async findAll(): Promise<Vehicle[]> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      const vehicles = await adminDb.adminReadAll<Vehicle>(DB_PATHS.VEHICLES);
      const vehicleArray = convertSnapshotToVehicles(adminDb.snapshotToArray(vehicles));
      console.log(`📊 firebaseVehicleService.findAll (Admin SDK): Converted ${Object.keys(vehicles).length} records to ${vehicleArray.length} vehicles`);
      return vehicleArray;
    } else {
      const vehicles = await readAll<Vehicle>(DB_PATHS.VEHICLES);
      const vehicleArray = convertSnapshotToVehicles(snapshotToArray(vehicles));
      console.log(`📊 firebaseVehicleService.findAll (Client SDK): Converted ${Object.keys(vehicles).length} records to ${vehicleArray.length} vehicles`);
      return vehicleArray;
    }
  },

  // Update vehicle
  async update(id: number, updates: Partial<Vehicle>): Promise<void> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      await adminDb.adminUpdate(DB_PATHS.VEHICLES, id.toString(), updates);
    } else {
      await updateData(DB_PATHS.VEHICLES, id.toString(), updates);
    }
  },

  // Delete vehicle
  async delete(id: number): Promise<void> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      await adminDb.adminDelete(DB_PATHS.VEHICLES, id.toString());
    } else {
      await deleteData(DB_PATHS.VEHICLES, id.toString());
    }
  },

  // Find vehicles by seller email
  async findBySellerEmail(sellerEmail: string): Promise<Vehicle[]> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      const vehicles = await adminDb.adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'sellerEmail', sellerEmail.toLowerCase().trim());
      return convertSnapshotToVehicles(adminDb.snapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'sellerEmail', sellerEmail.toLowerCase().trim());
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find vehicles by status
  async findByStatus(status: 'published' | 'unpublished' | 'sold'): Promise<Vehicle[]> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      const vehicles = await adminDb.adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'status', status);
      return convertSnapshotToVehicles(adminDb.snapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'status', status);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find featured vehicles
  async findFeatured(): Promise<Vehicle[]> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      const vehicles = await adminDb.adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'isFeatured', true);
      return convertSnapshotToVehicles(adminDb.snapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'isFeatured', true);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find vehicles by category
  async findByCategory(category: string): Promise<Vehicle[]> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      const vehicles = await adminDb.adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'category', category);
      return convertSnapshotToVehicles(adminDb.snapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'category', category);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find vehicles by city
  async findByCity(city: string): Promise<Vehicle[]> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      const vehicles = await adminDb.adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'city', city);
      return convertSnapshotToVehicles(adminDb.snapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'city', city);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find vehicles by state
  async findByState(state: string): Promise<Vehicle[]> {
    // Try Admin SDK first (server-side), fall back to client SDK
    const adminDb = await getAdminDbFunctions();
    if (adminDb) {
      const vehicles = await adminDb.adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'state', state);
      return convertSnapshotToVehicles(adminDb.snapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'state', state);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },
};


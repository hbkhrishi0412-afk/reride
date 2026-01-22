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
// This service is only used in api/main.ts (server-side), so we can use static imports
// Static import like api/main.ts does - works reliably in serverless functions
import {
  adminReadAll,
  adminCreate,
  adminRead,
  adminUpdate,
  adminDelete,
  adminQueryByField
} from '../server/firebase-admin-db.js';

// Helper to convert Admin SDK snapshot format to array with string IDs
// CRITICAL: Spread data first, then set id to preserve string ID from key
function adminSnapshotToArray<T>(data: Record<string, T>): Array<T & { id: string }> {
  return Object.keys(data).map(key => ({ ...data[key], id: key }));
}

// Check if we're in server context (where Admin SDK is available)
const isServerContext = typeof window === 'undefined';

// Helper function to safely convert string ID to number
// Ensures we always return a number (never a string) to maintain type safety
function convertIdToNumber(idString: string): number {
  const parsedId = Number(idString);
  return isNaN(parsedId) ? 0 : parsedId;
}

// Helper function to convert snapshot array items to Vehicle objects with numeric IDs
function convertSnapshotToVehicles(items: Array<Vehicle & { id: string }>): Vehicle[] {
  return items.map(v => {
    const { id: stringId, ...vehicleData } = v;
    return {
      ...vehicleData,
      id: convertIdToNumber(stringId),
    } as Vehicle;
  });
}

// Vehicle service for Firebase Realtime Database
// Uses Admin SDK in server context (serverless functions), Client SDK in browser context
export const firebaseVehicleService = {
  // Create a new vehicle
  async create(vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    // Generate a unique ID
    const id = Date.now();
    
    // Use Admin SDK in server context (api/main.ts), Client SDK elsewhere
    if (isServerContext) {
      await adminCreate(DB_PATHS.VEHICLES, vehicleData, id.toString());
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
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      const vehicle = await adminRead<Vehicle & { id: string }>(DB_PATHS.VEHICLES, id.toString());
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
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      const vehicles = await adminReadAll<Vehicle>(DB_PATHS.VEHICLES);
      const vehicleArray = convertSnapshotToVehicles(adminSnapshotToArray(vehicles));
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
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      await adminUpdate(DB_PATHS.VEHICLES, id.toString(), updates);
    } else {
      await updateData(DB_PATHS.VEHICLES, id.toString(), updates);
    }
  },

  // Delete vehicle
  async delete(id: number): Promise<void> {
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      await adminDelete(DB_PATHS.VEHICLES, id.toString());
    } else {
      await deleteData(DB_PATHS.VEHICLES, id.toString());
    }
  },

  // Find vehicles by seller email
  async findBySellerEmail(sellerEmail: string): Promise<Vehicle[]> {
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      const vehicles = await adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'sellerEmail', sellerEmail.toLowerCase().trim());
      return convertSnapshotToVehicles(adminSnapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'sellerEmail', sellerEmail.toLowerCase().trim());
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find vehicles by status (options parameter for compatibility, but Firebase doesn't support DB-level sorting/pagination)
  async findByStatus(
    status: 'published' | 'unpublished' | 'sold',
    options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number }
  ): Promise<Vehicle[]> {
    // Use Admin SDK in server context, Client SDK elsewhere
    let vehicles: Vehicle[];
    if (isServerContext) {
      const vehicleData = await adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'status', status);
      vehicles = convertSnapshotToVehicles(adminSnapshotToArray(vehicleData));
    } else {
      const vehicleData = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'status', status);
      vehicles = convertSnapshotToVehicles(snapshotToArray(vehicleData));
    }
    
    // Firebase doesn't support database-level sorting, so sort in-memory
    if (options?.orderBy === 'created_at' || options?.orderBy === 'createdAt') {
      vehicles = vehicles.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return options.orderDirection === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }
    
    // Apply pagination in-memory (Firebase doesn't support offset/limit in queries)
    if (options?.limit) {
      const startIndex = options.offset || 0;
      vehicles = vehicles.slice(startIndex, startIndex + options.limit);
    }
    
    return vehicles;
  },

  // Find featured vehicles
  async findFeatured(): Promise<Vehicle[]> {
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      const vehicles = await adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'isFeatured', true);
      return convertSnapshotToVehicles(adminSnapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'isFeatured', true);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find vehicles by category
  async findByCategory(category: string): Promise<Vehicle[]> {
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      const vehicles = await adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'category', category);
      return convertSnapshotToVehicles(adminSnapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'category', category);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find vehicles by city
  async findByCity(city: string): Promise<Vehicle[]> {
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      const vehicles = await adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'city', city);
      return convertSnapshotToVehicles(adminSnapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'city', city);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },

  // Find vehicles by state
  async findByState(state: string): Promise<Vehicle[]> {
    // Use Admin SDK in server context, Client SDK elsewhere
    if (isServerContext) {
      const vehicles = await adminQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'state', state);
      return convertSnapshotToVehicles(adminSnapshotToArray(vehicles));
    } else {
      const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'state', state);
      return convertSnapshotToVehicles(snapshotToArray(vehicles));
    }
  },
};

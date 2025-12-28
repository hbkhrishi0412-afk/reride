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

// Vehicle service for Firebase Realtime Database
export const firebaseVehicleService = {
  // Create a new vehicle
  async create(vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    // Generate a unique ID if not provided
    const id = vehicleData.id || Date.now();
    await create(DB_PATHS.VEHICLES, vehicleData, id.toString());
    
    return {
      id,
      ...vehicleData,
    } as Vehicle;
  },

  // Find vehicle by ID
  async findById(id: number): Promise<Vehicle | null> {
    const vehicle = await read<Vehicle>(DB_PATHS.VEHICLES, id.toString());
    return vehicle ? { ...vehicle, id } : null;
  },

  // Get all vehicles
  async findAll(): Promise<Vehicle[]> {
    const vehicles = await readAll<Vehicle>(DB_PATHS.VEHICLES);
    return snapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Update vehicle
  async update(id: number, updates: Partial<Vehicle>): Promise<void> {
    await updateData(DB_PATHS.VEHICLES, id.toString(), updates);
  },

  // Delete vehicle
  async delete(id: number): Promise<void> {
    await deleteData(DB_PATHS.VEHICLES, id.toString());
  },

  // Find vehicles by seller email
  async findBySellerEmail(sellerEmail: string): Promise<Vehicle[]> {
    const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'sellerEmail', sellerEmail.toLowerCase().trim());
    return snapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find vehicles by status
  async findByStatus(status: 'published' | 'unpublished' | 'sold'): Promise<Vehicle[]> {
    const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'status', status);
    return snapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find featured vehicles
  async findFeatured(): Promise<Vehicle[]> {
    const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'isFeatured', true);
    return snapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find vehicles by category
  async findByCategory(category: string): Promise<Vehicle[]> {
    const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'category', category);
    return snapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find vehicles by city
  async findByCity(city: string): Promise<Vehicle[]> {
    const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'city', city);
    return snapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find vehicles by state
  async findByState(state: string): Promise<Vehicle[]> {
    const vehicles = await queryByField<Vehicle>(DB_PATHS.VEHICLES, 'state', state);
    return snapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },
};


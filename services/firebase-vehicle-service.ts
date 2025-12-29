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
import {
  adminRead,
  adminReadAll,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminQueryByField,
  snapshotToArray as adminSnapshotToArray
} from '../server/firebase-admin-db.js';
import type { Vehicle } from '../types.js';

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

// Use Admin SDK functions in server context, client SDK in browser
const dbRead = isServerSide ? adminRead : read;
const dbReadAll = isServerSide ? adminReadAll : readAll;
const dbCreate = isServerSide ? adminCreate : create;
const dbUpdate = isServerSide ? adminUpdate : updateData;
const dbDelete = isServerSide ? adminDelete : deleteData;
const dbQueryByField = isServerSide ? adminQueryByField : queryByField;
const dbSnapshotToArray = isServerSide ? adminSnapshotToArray : snapshotToArray;

// Vehicle service for Firebase Realtime Database
export const firebaseVehicleService = {
  // Create a new vehicle
  async create(vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    // Generate a unique ID
    const id = Date.now();
    await dbCreate(DB_PATHS.VEHICLES, vehicleData, id.toString());
    
    return {
      id,
      ...vehicleData,
    } as Vehicle;
  },

  // Find vehicle by ID
  async findById(id: number): Promise<Vehicle | null> {
    const vehicle = await dbRead<Vehicle>(DB_PATHS.VEHICLES, id.toString());
    return vehicle ? { ...vehicle, id } : null;
  },

  // Get all vehicles
  async findAll(): Promise<Vehicle[]> {
    const vehicles = await dbReadAll<Vehicle>(DB_PATHS.VEHICLES);
    const vehicleArray = dbSnapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
    console.log(`📊 firebaseVehicleService.findAll: Converted ${Object.keys(vehicles).length} records to ${vehicleArray.length} vehicles`);
    return vehicleArray;
  },

  // Update vehicle
  async update(id: number, updates: Partial<Vehicle>): Promise<void> {
    await dbUpdate(DB_PATHS.VEHICLES, id.toString(), updates);
  },

  // Delete vehicle
  async delete(id: number): Promise<void> {
    await dbDelete(DB_PATHS.VEHICLES, id.toString());
  },

  // Find vehicles by seller email
  async findBySellerEmail(sellerEmail: string): Promise<Vehicle[]> {
    const vehicles = await dbQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'sellerEmail', sellerEmail.toLowerCase().trim());
    return dbSnapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find vehicles by status
  async findByStatus(status: 'published' | 'unpublished' | 'sold'): Promise<Vehicle[]> {
    const vehicles = await dbQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'status', status);
    return dbSnapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find featured vehicles
  async findFeatured(): Promise<Vehicle[]> {
    const vehicles = await dbQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'isFeatured', true);
    return dbSnapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find vehicles by category
  async findByCategory(category: string): Promise<Vehicle[]> {
    const vehicles = await dbQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'category', category);
    return dbSnapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find vehicles by city
  async findByCity(city: string): Promise<Vehicle[]> {
    const vehicles = await dbQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'city', city);
    return dbSnapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },

  // Find vehicles by state
  async findByState(state: string): Promise<Vehicle[]> {
    const vehicles = await dbQueryByField<Vehicle>(DB_PATHS.VEHICLES, 'state', state);
    return dbSnapshotToArray(vehicles).map(v => ({
      ...v,
      id: parseInt(v.id) || v.id,
    })) as Vehicle[];
  },
};


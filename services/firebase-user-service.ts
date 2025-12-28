import { 
  create, 
  read, 
  readAll, 
  updateData, 
  deleteData, 
  queryByField, 
  findOneByField,
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
  adminFindOneByField,
  snapshotToArray as adminSnapshotToArray
} from '../lib/firebase-admin-db.js';
import type { User } from '../types.js';

// Convert email to a Firebase-safe key (replace special chars)
function emailToKey(email: string): string {
  return email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
}

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

// Use Admin SDK functions in server context, client SDK in browser
const dbRead = isServerSide ? adminRead : read;
const dbReadAll = isServerSide ? adminReadAll : readAll;
const dbCreate = isServerSide ? adminCreate : create;
const dbUpdate = isServerSide ? adminUpdate : updateData;
const dbDelete = isServerSide ? adminDelete : deleteData;
const dbQueryByField = isServerSide ? adminQueryByField : queryByField;
const dbFindOneByField = isServerSide ? adminFindOneByField : findOneByField;
const dbSnapshotToArray = isServerSide ? adminSnapshotToArray : snapshotToArray;

// User service for Firebase Realtime Database
export const firebaseUserService = {
  // Create a new user
  async create(userData: Omit<User, 'id'>): Promise<User> {
    const emailKey = emailToKey(userData.email);
    const id = await dbCreate(DB_PATHS.USERS, {
      ...userData,
      email: userData.email.toLowerCase().trim(),
    }, emailKey);
    
    return {
      id,
      ...userData,
    };
  },

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    const emailKey = emailToKey(email);
    const user = await dbRead<User>(DB_PATHS.USERS, emailKey);
    return user ? { ...user, id: emailKey } : null;
  },

  // Find user by ID
  async findById(id: string): Promise<User | null> {
    const user = await dbRead<User>(DB_PATHS.USERS, id);
    return user ? { ...user, id } : null;
  },

  // Find user by Firebase UID
  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return await dbFindOneByField<User>(DB_PATHS.USERS, 'firebaseUid', firebaseUid);
  },

  // Get all users
  async findAll(): Promise<User[]> {
    const users = await dbReadAll<User>(DB_PATHS.USERS);
    return dbSnapshotToArray(users);
  },

  // Update user
  async update(email: string, updates: Partial<User>): Promise<void> {
    const emailKey = emailToKey(email);
    await dbUpdate(DB_PATHS.USERS, emailKey, updates);
  },

  // Update user by ID
  async updateById(id: string, updates: Partial<User>): Promise<void> {
    await dbUpdate(DB_PATHS.USERS, id, updates);
  },

  // Delete user
  async delete(email: string): Promise<void> {
    const emailKey = emailToKey(email);
    await dbDelete(DB_PATHS.USERS, emailKey);
  },

  // Find users by role
  async findByRole(role: 'customer' | 'seller' | 'admin'): Promise<User[]> {
    const users = await dbQueryByField<User>(DB_PATHS.USERS, 'role', role);
    return dbSnapshotToArray(users);
  },

  // Find users by status
  async findByStatus(status: 'active' | 'inactive'): Promise<User[]> {
    const users = await dbQueryByField<User>(DB_PATHS.USERS, 'status', status);
    return dbSnapshotToArray(users);
  },
};



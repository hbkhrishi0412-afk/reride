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
import type { User } from '../types.js';

// Convert email to a Firebase-safe key (replace special chars)
function emailToKey(email: string): string {
  return email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
}

// User service for Firebase Realtime Database
export const firebaseUserService = {
  // Create a new user
  async create(userData: Omit<User, 'id'>): Promise<User> {
    const emailKey = emailToKey(userData.email);
    const id = await create(DB_PATHS.USERS, {
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
    const user = await read<User>(DB_PATHS.USERS, emailKey);
    return user ? { ...user, id: emailKey } : null;
  },

  // Find user by ID
  async findById(id: string): Promise<User | null> {
    const user = await read<User>(DB_PATHS.USERS, id);
    return user ? { ...user, id } : null;
  },

  // Find user by Firebase UID
  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return await findOneByField<User>(DB_PATHS.USERS, 'firebaseUid', firebaseUid);
  },

  // Get all users
  async findAll(): Promise<User[]> {
    const users = await readAll<User>(DB_PATHS.USERS);
    return snapshotToArray(users);
  },

  // Update user
  async update(email: string, updates: Partial<User>): Promise<void> {
    const emailKey = emailToKey(email);
    await updateData(DB_PATHS.USERS, emailKey, updates);
  },

  // Update user by ID
  async updateById(id: string, updates: Partial<User>): Promise<void> {
    await updateData(DB_PATHS.USERS, id, updates);
  },

  // Delete user
  async delete(email: string): Promise<void> {
    const emailKey = emailToKey(email);
    await deleteData(DB_PATHS.USERS, emailKey);
  },

  // Find users by role
  async findByRole(role: 'customer' | 'seller' | 'admin'): Promise<User[]> {
    const users = await queryByField<User>(DB_PATHS.USERS, 'role', role);
    return snapshotToArray(users);
  },

  // Find users by status
  async findByStatus(status: 'active' | 'inactive'): Promise<User[]> {
    const users = await queryByField<User>(DB_PATHS.USERS, 'status', status);
    return snapshotToArray(users);
  },
};



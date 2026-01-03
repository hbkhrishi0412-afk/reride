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
} from '../server/firebase-admin-db.js';
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
    // CRITICAL: Normalize email before creating key to ensure consistency
    const normalizedEmail = userData.email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
    
    // Prepare user data with normalized email
    const userToSave = {
      ...userData,
      email: normalizedEmail, // Always store normalized email
    };
    
    // Save to Firebase with emailKey as the document key
    await dbCreate(DB_PATHS.USERS, userToSave, emailKey);
    
    // CRITICAL: Use emailKey as id (not the userId from userData if it exists)
    // This ensures the id matches the Firebase key for consistent lookups
    return {
      ...userToSave,
      id: emailKey, // Always use emailKey as the id for consistency
    };
  },

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    // CRITICAL: Normalize email before creating key
    const normalizedEmail = email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
    
    try {
      // Primary lookup: Use emailKey to find user
      const user = await dbRead<User>(DB_PATHS.USERS, emailKey);
      
      if (user) {
        // Ensure email is normalized in returned user
        return { 
          ...user, 
          id: emailKey, // Use emailKey as id for consistency
          email: user.email?.toLowerCase().trim() || normalizedEmail
        };
      }
      
      // Fallback: If not found by key, try querying by email field
      // This handles edge cases where users might have been saved with different key formats
      try {
        const usersByEmail = await dbQueryByField<User>(DB_PATHS.USERS, 'email', normalizedEmail);
        if (usersByEmail && Object.keys(usersByEmail).length > 0) {
          // Get first matching user
          const foundKey = Object.keys(usersByEmail)[0];
          const foundUser = usersByEmail[foundKey];
          
          // Return user with normalized email and correct id
          return {
            ...foundUser,
            id: foundKey, // Use the actual key from database
            email: normalizedEmail
          };
        }
      } catch (queryError) {
        // Query failed, continue with null return
        if (process.env.NODE_ENV !== 'production') {
          console.warn('⚠️ Fallback email query failed:', queryError);
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error finding user by email:', error);
      return null;
    }
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
    // CRITICAL: Normalize email before creating key
    const normalizedEmail = email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
    
    // If email is being updated, normalize it
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }
    
    await dbUpdate(DB_PATHS.USERS, emailKey, updates);
  },

  // Update user by ID
  async updateById(id: string, updates: Partial<User>): Promise<void> {
    // If email is being updated, normalize it
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }
    
    await dbUpdate(DB_PATHS.USERS, id, updates);
  },

  // Delete user
  async delete(email: string): Promise<void> {
    // CRITICAL: Normalize email before creating key
    const normalizedEmail = email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
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



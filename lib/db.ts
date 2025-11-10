

import mongoose from 'mongoose';
import type { Mongoose } from 'mongoose';

// Connection caching logic to prevent multiple connections in a serverless environment.
// FIX: Replace 'global' with 'globalThis' for broader environment compatibility.
let cached = (globalThis as any).mongoose;

if (!cached) {
// FIX: Replace 'global' with 'globalThis' for broader environment compatibility.
  cached = (globalThis as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase(): Promise<Mongoose> {
  // Return existing connection if available and healthy
  if (cached.conn && mongoose.connection.readyState === 1) {
    // Verify connection is still alive by checking readyState
    try {
      await mongoose.connection.db.admin().ping();
      console.log('✅ Using existing MongoDB connection');
      return cached.conn;
    } catch (error) {
      // Connection is dead, reset cache
      console.warn('⚠️ Cached connection is dead, reconnecting...');
      cached.conn = null;
      cached.promise = null;
      mongoose.connection.close().catch(() => {}); // Close dead connection
    }
  }

  if (!cached.promise) {
    if (!process.env.MONGODB_URI) {
        throw new Error('Please define the MONGODB_URI environment variable.');
    }

    // Parse URI to check if database name is already included
    const uri = process.env.MONGODB_URI;
    let dbNameFromUri: string | null = null;
    
    try {
      // Handle mongodb:// and mongodb+srv:// URIs
      const uriMatch = uri.match(/mongodb(\+srv)?:\/\/[^/]+(?:\/([^?]+))?/);
      if (uriMatch && uriMatch[2]) {
        dbNameFromUri = uriMatch[2];
      }
    } catch (error) {
      // If URI parsing fails, assume no database name in URI
      console.warn('⚠️ Could not parse MongoDB URI, using default database name');
    }
    
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    };

    // Only specify dbName if not already in URI
    if (!dbNameFromUri) {
      opts.dbName = 'reride';
    } else {
      console.log(`📝 Using database name from URI: ${dbNameFromUri}`);
    }

    console.log('🔄 Creating new MongoDB connection...');
    cached.promise = mongoose.connect(uri, opts)
      .then(async (mongooseInstance) => {
        console.log('✅ MongoDB connected successfully to database:', mongooseInstance.connection.name);
        return mongooseInstance;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error);
        cached.promise = null; // Reset on error
        cached.conn = null; // Clear cached connection on error
        throw error;
      });
  }
  
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null; // Reset promise on error
    cached.conn = null; // Clear cached connection on error
    throw error;
  }
}

export default connectToDatabase;

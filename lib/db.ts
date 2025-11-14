

import mongoose from 'mongoose';
import type { Mongoose } from 'mongoose';

class MongoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MongoConfigError';
  }
}

// Connection caching logic to prevent multiple connections in a serverless environment.
// FIX: Replace 'global' with 'globalThis' for broader environment compatibility.
let cached = (globalThis as any).mongoose;

if (!cached) {
// FIX: Replace 'global' with 'globalThis' for broader environment compatibility.
  cached = (globalThis as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase(): Promise<Mongoose> {
  // Return existing connection if available
  if (cached.conn && mongoose.connection.readyState === 1) {
    console.log('✅ Using existing MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      dbName: 'reride' // Explicitly specify database name
    };

    if (!process.env.MONGODB_URI) {
        throw new MongoConfigError('Please define the MONGODB_URI environment variable.');
    }

    console.log('🔄 Creating new MongoDB connection...');
    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts)
      .then(async (mongooseInstance) => {
        console.log('✅ MongoDB connected successfully to database:', mongooseInstance.connection.name);
        return mongooseInstance;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error);
        cached.promise = null; // Reset on error
        throw error;
      });
  }
  
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null; // Reset promise on error
    throw error;
  }
}

export { MongoConfigError };
export default connectToDatabase;

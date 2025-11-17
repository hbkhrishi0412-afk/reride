

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

export function ensureDatabaseInUri(uri: string, dbName = 'reride'): string {
  try {
    const parsed = new URL(uri);
    const hasDatabase = parsed.pathname && parsed.pathname !== '/' && parsed.pathname.length > 1;
    
    if (!hasDatabase) {
      parsed.pathname = `/${dbName}`;
      console.warn(`⚠️ MONGODB_URL/MONGODB_URI missing database name. Defaulting to /${dbName}.`);
      return parsed.toString();
    }
    
    // Normalize database name in URI to lowercase 'reride' if it's a variation
    const currentDbName = parsed.pathname.slice(1); // Remove leading slash
    const normalizedDbName = currentDbName.toLowerCase();
    
    // If the database name in URI is a variation of 'reride', normalize it
    if (normalizedDbName === 're-ride' || normalizedDbName === 'reride' || normalizedDbName === 're_ride') {
      if (currentDbName !== dbName) {
        console.warn(`⚠️ Database name in URI is "${currentDbName}", normalizing to "${dbName}"`);
        parsed.pathname = `/${dbName}`;
      }
    }
    
    return parsed.toString();
  } catch (error) {
    console.warn('⚠️ Unable to parse MONGODB_URL/MONGODB_URI. Falling back to manual handling.', error);
    if (uri.includes(`/${dbName}`) || uri.toLowerCase().includes('/re-ride') || uri.toLowerCase().includes('/re_ride')) {
      // Replace variations with correct database name
      return uri.replace(/\/re-ride/i, `/${dbName}`).replace(/\/re_ride/i, `/${dbName}`);
    }
    if (uri.includes('?')) {
      const [base, query] = uri.split('?');
      const sanitizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      return `${sanitizedBase}/${dbName}?${query}`;
    }
    return uri.endsWith('/') ? `${uri}${dbName}` : `${uri}/${dbName}`;
  }
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

    // Check MONGODB_URL first, then fallback to MONGODB_URI for backward compatibility
    const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
    
    if (!mongoUri) {
        throw new MongoConfigError('Please define the MONGODB_URL or MONGODB_URI environment variable.');
    }

    const normalizedUri = ensureDatabaseInUri(mongoUri);

    console.log('🔄 Creating new MongoDB connection...');
    console.log(`📡 Database name in connection options: ${opts.dbName}`);
    cached.promise = mongoose.connect(normalizedUri, opts)
      .then(async (mongooseInstance) => {
        const actualDbName = mongooseInstance.connection.name;
        console.log('✅ MongoDB connected successfully to database:', actualDbName);
        
        // Verify database name matches expected
        if (actualDbName.toLowerCase() !== 'reride') {
          console.warn(`⚠️ WARNING: Connected to database "${actualDbName}" but expected "reride"`);
          console.warn(`   This may cause data retrieval issues. Please verify your MONGODB_URL or MONGODB_URI.`);
        }
        
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

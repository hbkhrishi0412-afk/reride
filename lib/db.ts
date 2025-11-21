

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
    
    // Always ensure the database name is 'reride'
    const currentDbName = hasDatabase ? parsed.pathname.slice(1) : null;
    
    if (!hasDatabase) {
      // No database name in URI - add it
      parsed.pathname = `/${dbName}`;
      console.warn(`⚠️ MONGODB_URL/MONGODB_URI missing database name. Defaulting to /${dbName}.`);
      return parsed.toString();
    }
    
    // Check if database name is already 'reride' (case-insensitive)
    // TypeScript assertion: currentDbName cannot be null here due to early return above
    const normalizedCurrentDbName = currentDbName!.toLowerCase();
    if (normalizedCurrentDbName !== dbName.toLowerCase()) {
      // Database name is different - force it to 'reride'
      console.warn(`⚠️ Database name in URI is "${currentDbName}", changing to "${dbName}" to ensure correct database access.`);
      parsed.pathname = `/${dbName}`;
      return parsed.toString();
    }
    
    // Database name is already 'reride' - ensure it's lowercase
    if (currentDbName !== dbName) {
      parsed.pathname = `/${dbName}`;
    }
    
    return parsed.toString();
  } catch (error) {
    console.warn('⚠️ Unable to parse MONGODB_URL/MONGODB_URI. Falling back to manual handling.', error);
    
    // Always ensure database name is 'reride' in fallback handling
    const lowerUri = uri.toLowerCase();
    const hasRerideVariation = lowerUri.includes('/re-ride') || lowerUri.includes('/re_ride') || lowerUri.includes('/reride');
    
    if (hasRerideVariation) {
      // Replace any variation with correct database name
      return uri.replace(/\/re-ride/i, `/${dbName}`).replace(/\/re_ride/i, `/${dbName}`).replace(/\/reride/i, `/${dbName}`);
    }
    
    // If URI has a database name that's not 'reride', replace it
    // Match pattern: mongodb://.../DATABASE_NAME or mongodb+srv://.../DATABASE_NAME
    const dbNamePattern = /(mongodb\+?srv?:\/\/[^\/]+)\/([^?\/]+)/i;
    if (dbNamePattern.test(uri)) {
      return uri.replace(dbNamePattern, `$1/${dbName}`);
    }
    
    // If no database name found, add it
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
        const errorMessage = [
          '❌ MONGODB_URL or MONGODB_URI environment variable is not defined.',
          '',
          'To fix this:',
          '1. Create a .env file in your project root (copy from .env.example)',
          '2. Add: MONGODB_URL=mongodb://localhost:27017/reride?retryWrites=true&w=majority',
          '   Or for MongoDB Atlas: MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/reride?retryWrites=true&w=majority',
          '3. For Vercel deployment: Add MONGODB_URL in Vercel dashboard → Settings → Environment Variables',
          '',
          'See .env.example for all required environment variables.'
        ].join('\n');
        throw new MongoConfigError(errorMessage);
    }

    let normalizedUri = ensureDatabaseInUri(mongoUri);
    
    // Add retryWrites parameter if not present (critical for serverless cold starts)
    if (!normalizedUri.includes('retryWrites')) {
      const separator = normalizedUri.includes('?') ? '&' : '?';
      normalizedUri = `${normalizedUri}${separator}retryWrites=true&w=majority`;
    }

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

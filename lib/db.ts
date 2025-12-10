

import mongoose from 'mongoose';
import type { Mongoose } from 'mongoose';

class MongoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MongoConfigError';
  }
}

// Connection state tracking
interface ConnectionCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
  lastAttempt: number;
  retryCount: number;
  isConnecting: boolean;
}

// Connection caching logic to prevent multiple connections in a serverless environment.
// FIX: Replace 'global' with 'globalThis' for broader environment compatibility.
let cached: ConnectionCache = (globalThis as any).mongoose;

if (!cached) {
// FIX: Replace 'global' with 'globalThis' for broader environment compatibility.
  cached = (globalThis as any).mongoose = { 
    conn: null, 
    promise: null,
    lastAttempt: 0,
    retryCount: 0,
    isConnecting: false
  };
}

// Connection health check
export function isConnectionHealthy(): boolean {
  return mongoose.connection.readyState === 1 && cached.conn !== null;
}

// Get connection state
export function getConnectionState(): {
  ready: boolean;
  state: number;
  stateName: string;
} {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    ready: mongoose.connection.readyState === 1,
    state: mongoose.connection.readyState,
    stateName: states[mongoose.connection.readyState] || 'unknown'
  };
}

// Validate MongoDB URI format
export function validateMongoUri(uri: string): { valid: boolean; error?: string } {
  if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
    return { valid: false, error: 'MongoDB URI is empty or invalid' };
  }

  // Check for basic MongoDB URI patterns
  const uriPattern = /^mongodb(\+srv)?:\/\//i;
  if (!uriPattern.test(uri)) {
    return { valid: false, error: 'MongoDB URI must start with mongodb:// or mongodb+srv://' };
  }

  // Check for special characters that need URL encoding
  try {
    new URL(uri);
  } catch (error) {
    return { valid: false, error: 'MongoDB URI format is invalid. Check for special characters that need URL encoding.' };
  }

  return { valid: true };
}

export function ensureDatabaseInUri(uri: string, dbName = 'reride'): string {
  // Validate URI first
  const validation = validateMongoUri(uri);
  if (!validation.valid) {
    throw new MongoConfigError(`Invalid MongoDB URI: ${validation.error}`);
  }

  try {
    const parsed = new URL(uri);
    
    // Extract database name from pathname (remove leading slash)
    const pathname = parsed.pathname || '';
    const currentDbName = pathname.length > 1 ? pathname.slice(1).split('/')[0] : null;
    
    // Check if we have a valid database name (not empty, not just special chars)
    const hasDatabase = currentDbName && currentDbName.length > 0 && !currentDbName.match(/^[\/\?]+$/);
    
    if (!hasDatabase) {
      // No database name in URI - add it silently
      // The dbName option in connection options will ensure correct database is used
      parsed.pathname = `/${dbName}`;
      return parsed.toString();
    }
    
    // Check if database name is already 'reride' (case-insensitive)
    const normalizedCurrentDbName = currentDbName.toLowerCase();
    if (normalizedCurrentDbName !== dbName.toLowerCase()) {
      // Database name is different - force it to 'reride'
      parsed.pathname = `/${dbName}`;
      return parsed.toString();
    }
    
    // Database name is already 'reride' - ensure it's exactly 'reride' (lowercase)
    if (currentDbName !== dbName) {
      parsed.pathname = `/${dbName}`;
    }
    
    return parsed.toString();
  } catch (error) {
    // Fallback handling for URIs that can't be parsed by URL constructor
    const lowerUri = uri.toLowerCase();
    
    // Check for database name patterns in the URI string
    // Pattern 1: mongodb://host:port/database or mongodb+srv://user:pass@host/database
    const dbNamePattern = /(mongodb\+?srv?:\/\/[^\/]+)\/([^?\/\s]+)/i;
    const match = uri.match(dbNamePattern);
    
    if (match) {
      const existingDbName = match[2];
      // If database name exists and is not 'reride', replace it
      if (existingDbName.toLowerCase() !== dbName.toLowerCase()) {
        return uri.replace(dbNamePattern, `$1/${dbName}`);
      }
      // Database name is correct, return as-is
      return uri;
    }
    
    // Pattern 2: Check for reride variations
    const hasRerideVariation = lowerUri.includes('/re-ride') || lowerUri.includes('/re_ride') || lowerUri.includes('/reride');
    if (hasRerideVariation) {
      // Replace any variation with correct database name
      return uri.replace(/\/re-ride/i, `/${dbName}`).replace(/\/re_ride/i, `/${dbName}`).replace(/\/reride/i, `/${dbName}`);
    }
    
    // Pattern 3: No database name found - add it before query parameters
    if (uri.includes('?')) {
      const [base, query] = uri.split('?');
      const sanitizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      return `${sanitizedBase}/${dbName}?${query}`;
    }
    
    // Pattern 4: No query parameters, just add database name
    return uri.endsWith('/') ? `${uri}${dbName}` : `${uri}/${dbName}`;
  }
}

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const CONNECTION_COOLDOWN = 5000; // 5 seconds between connection attempts

// Exponential backoff delay calculation
function getRetryDelay(retryCount: number): number {
  const delay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
    MAX_RETRY_DELAY
  );
  return delay;
}

async function connectToDatabase(retryCount = 0): Promise<Mongoose> {
  // Return existing healthy connection if available - verify with ping
  if (cached.conn && mongoose.connection.readyState === 1) {
    try {
      // Verify connection is actually working with a ping
      await mongoose.connection.db.admin().ping();
      return cached.conn;
    } catch (error) {
      // Connection is stale, clear it and reconnect
      console.warn('⚠️ Stale connection detected, reconnecting...');
      cached.conn = null;
      try {
        await mongoose.connection.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }

  // Prevent multiple simultaneous connection attempts
  if (cached.isConnecting && cached.promise) {
    const now = Date.now();
    // If connection attempt is recent (within cooldown), wait for existing promise
    if (now - cached.lastAttempt < CONNECTION_COOLDOWN) {
      try {
        return await cached.promise;
      } catch (error) {
        // If existing promise fails, continue with new attempt
        cached.promise = null;
        cached.isConnecting = false;
      }
    }
  }

  // Check if we should retry
  if (retryCount >= MAX_RETRIES) {
    cached.promise = null;
    cached.isConnecting = false;
    throw new MongoConfigError(
      `Failed to connect to MongoDB after ${MAX_RETRIES} attempts. Please check your connection string and network connectivity.`
    );
  }

  // Create new connection promise
  if (!cached.promise) {
    cached.isConnecting = true;
    cached.lastAttempt = Date.now();
    cached.retryCount = retryCount;

    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 1, // Keep at least 1 connection alive
      // Increased timeouts for serverless cold starts
      serverSelectionTimeoutMS: 20000, // Increased to 20s for serverless
      socketTimeoutMS: 45000,
      connectTimeoutMS: 20000, // Increased to 20s
      family: 4, // Use IPv4, skip trying IPv6
      dbName: 'reride', // Explicitly specify database name
      // Retry configuration
      retryWrites: true,
      retryReads: true,
      autoIndex: true,
      autoCreate: false,
    };

    // Check MONGODB_URL first (preferred), then fallback to MONGODB_URI for backward compatibility
    const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      cached.isConnecting = false;
      cached.promise = null;
      const errorMessage = [
        '❌ MONGODB_URL (or MONGODB_URI) environment variable is not defined.',
        '',
        'To fix this:',
        '1. Create a .env.local file in your project root',
        '2. Add: MONGODB_URL=mongodb://localhost:27017/reride?retryWrites=true&w=majority',
        '   Or for MongoDB Atlas: MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/reride?retryWrites=true&w=majority',
        '3. For Vercel deployment: Add MONGODB_URL in Vercel dashboard → Settings → Environment Variables',
        '',
        'Note: MONGODB_URL is preferred, but MONGODB_URI will also work for backward compatibility.'
      ].join('\n');
      throw new MongoConfigError(errorMessage);
    }

    // Validate URI format
    const validation = validateMongoUri(mongoUri);
    if (!validation.valid) {
      cached.isConnecting = false;
      cached.promise = null;
      throw new MongoConfigError(`Invalid MongoDB URI: ${validation.error}`);
    }

    let normalizedUri = ensureDatabaseInUri(mongoUri);
    
    // Add retryWrites parameter if not present (critical for serverless cold starts)
    if (!normalizedUri.includes('retryWrites')) {
      const separator = normalizedUri.includes('?') ? '&' : '?';
      normalizedUri = `${normalizedUri}${separator}retryWrites=true&w=majority`;
    }

    if (retryCount === 0) {
      console.log('🔄 Creating new MongoDB connection...');
    } else {
      console.log(`🔄 Retrying MongoDB connection (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    }
    console.log(`📡 Database name in connection options: ${opts.dbName}`);

    cached.promise = mongoose.connect(normalizedUri, opts)
      .then(async (mongooseInstance) => {
        const actualDbName = mongooseInstance.connection.name;
        console.log('✅ MongoDB connected successfully to database:', actualDbName);
        
        // Verify database name matches expected
        if (actualDbName.toLowerCase() !== 'reride') {
          console.warn(`⚠️ WARNING: Connected to database "${actualDbName}" but expected "reride"`);
          console.warn(`   This may cause data retrieval issues. Please verify your MONGODB_URL (or MONGODB_URI).`);
        }

        // Set up connection event handlers for monitoring
        // Remove any existing listeners to prevent duplicates on retries
        mongooseInstance.connection.removeAllListeners('error');
        mongooseInstance.connection.removeAllListeners('disconnected');
        mongooseInstance.connection.removeAllListeners('reconnected');
        
        mongooseInstance.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err);
          cached.conn = null;
          cached.promise = null;
          cached.isConnecting = false;
        });

        mongooseInstance.connection.on('disconnected', () => {
          console.warn('⚠️ MongoDB disconnected - will reconnect on next request');
          cached.conn = null;
          cached.promise = null;
          cached.isConnecting = false;
        });

        mongooseInstance.connection.on('reconnected', () => {
          console.log('✅ MongoDB reconnected');
          cached.conn = mongooseInstance;
        });

        // Test connection with ping before marking as ready
        try {
          await mongooseInstance.connection.db.admin().ping();
          console.log('✅ MongoDB connection verified with ping');
        } catch (pingError) {
          console.warn('⚠️ MongoDB ping failed:', pingError instanceof Error ? pingError.message : pingError);
        }

        // Assign cached.conn immediately when connection is ready
        // This prevents the window where readyState === 1 but cached.conn is null
        cached.conn = mongooseInstance;
        cached.isConnecting = false;
        cached.retryCount = 0;
        return mongooseInstance;
      })
      .catch(async (error) => {
        console.error(`❌ MongoDB connection error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
        cached.promise = null;
        cached.isConnecting = false;

        // Retry with exponential backoff for transient errors
        if (retryCount < MAX_RETRIES - 1) {
          const isTransientError = 
            error.message.includes('timeout') ||
            error.message.includes('ENOTFOUND') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('network') ||
            error.message.includes('authentication') ||
            error.name === 'MongoNetworkError' ||
            error.name === 'MongoTimeoutError' ||
            error.name === 'MongoServerSelectionError';

          if (isTransientError) {
            const delay = getRetryDelay(retryCount);
            console.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return connectToDatabase(retryCount + 1);
          }
        }

        throw error;
      });
  }
  
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.isConnecting = false;
    // If it's a transient error and we haven't exhausted retries, retry
    if (retryCount < MAX_RETRIES - 1) {
      const isTransientError = 
        error instanceof Error && (
          error.message.includes('timeout') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('network') ||
          error.message.includes('authentication') ||
          error.name === 'MongoNetworkError' ||
          error.name === 'MongoTimeoutError' ||
          error.name === 'MongoServerSelectionError'
        );

      if (isTransientError) {
        const delay = getRetryDelay(retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return connectToDatabase(retryCount + 1);
      }
    }
    throw error;
  }
}

// Helper function to ensure connection is ready before operations
export async function ensureConnection(): Promise<Mongoose> {
  // Check if connection is healthy
  if (isConnectionHealthy()) {
    // Verify with ping to ensure it's actually working
    try {
      await mongoose.connection.db.admin().ping();
      return cached.conn!;
    } catch (error) {
      // Connection is stale, reconnect
      console.warn('⚠️ Connection health check failed, reconnecting...');
      cached.conn = null;
      try {
        await mongoose.connection.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }

  // Attempt to connect
  try {
    return await connectToDatabase();
  } catch (error) {
    // Log detailed error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ MongoDB connection failed:', error);
      const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
      if (mongoUri) {
        const masked = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
        console.error('   Connection string:', masked);
      }
    }
    throw error;
  }
}

export { MongoConfigError };
export default connectToDatabase;

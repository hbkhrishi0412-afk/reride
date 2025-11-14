import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import connectToDatabase, { MongoConfigError } from '../lib/db';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import VehicleDataModel from '../models/VehicleData';
import { PLAN_DETAILS } from '../constants';
import NewCar from '../models/NewCar';
import { 
  hashPassword, 
  validatePassword, 
  generateAccessToken, 
  generateRefreshToken, 
  validateUserInput,
  getSecurityHeaders,
  sanitizeObject,
  validateEmail
} from '../utils/security';
import { getSecurityConfig } from '../utils/security-config';

// Helper: Calculate distance between coordinates
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Authentication middleware (currently unused but kept for future use)
// const authenticateRequest = (req: VercelRequest): { isValid: boolean; user?: any; error?: string } => {
//   const authHeader = req.headers.authorization;
//   
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return { isValid: false, error: 'No valid authorization header' };
//   }
//   
//   try {
//     const token = authHeader.substring(7); // Remove 'Bearer ' prefix
//     const decoded = verifyToken(token);
//     return { isValid: true, user: decoded };
//   } catch (error) {
//     return { isValid: false, error: 'Invalid or expired token' };
//   }
// };

// Rate limiting (simple in-memory implementation for demo)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const config = getSecurityConfig();

const checkRateLimit = (identifier: string): { allowed: boolean; remaining: number } => {
  const now = Date.now();
  const key = identifier;
  const current = rateLimitMap.get(key);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + config.RATE_LIMIT.WINDOW_MS });
    return { allowed: true, remaining: config.RATE_LIMIT.MAX_REQUESTS - 1 };
  }
  
  if (current.count >= config.RATE_LIMIT.MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  current.count++;
  return { allowed: true, remaining: config.RATE_LIMIT.MAX_REQUESTS - current.count };
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set security headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Set CORS headers with proper security
  const origin = req.headers.origin;
  if (config.CORS.ALLOWED_ORIGINS.includes(origin as string)) {
    res.setHeader('Access-Control-Allow-Origin', origin as string);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://reride-app.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', config.CORS.ALLOWED_METHODS.join(', '));
  res.setHeader('Access-Control-Allow-Headers', config.CORS.ALLOWED_HEADERS.join(', '));
  res.setHeader('Access-Control-Allow-Credentials', config.CORS.CREDENTIALS.toString());
  res.setHeader('Access-Control-Max-Age', config.CORS.MAX_AGE.toString());
  
  // Always set JSON content type to prevent HTML responses
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const rateLimitResult = checkRateLimit(clientIP as string);
  
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      reason: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(config.RATE_LIMIT.WINDOW_MS / 1000)
    });
  }
  
  res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());

  try {
    // Try to connect to database, but don't fail if it's not available
    // For PUT/POST/DELETE requests, let individual handlers manage connection errors
    // For GET requests, return early if connection fails
    if (req.method === 'GET') {
      try {
        await connectToDatabase();
      } catch (dbError) {
        const reason = dbError instanceof MongoConfigError
          ? 'MongoDB is not configured. Set MONGODB_URI in your environment.'
          : 'Database temporarily unavailable. Please try again later.';
        console.warn('Database connection failed for GET request, using fallback data:', dbError);
        return res.status(503).json({ 
          success: false, 
          reason,
          fallback: true,
          data: []
        });
      }
    } else {
      // For non-GET requests, attempt connection but let handler manage errors
      try {
        await connectToDatabase();
      } catch (dbError) {
        console.warn('Database connection warning for', req.method, 'request:', dbError);
        // Don't return early - let the handler manage the connection error
      }
    }

    // Route based on the path
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Route to appropriate handler
    if (pathname.includes('/users') || pathname.endsWith('/users')) {
      return await handleUsers(req, res);
    } else if (pathname.includes('/vehicles') || pathname.endsWith('/vehicles')) {
      return await handleVehicles(req, res);
    } else if (pathname.includes('/admin') || pathname.endsWith('/admin')) {
      return await handleAdmin(req, res);
    } else if (pathname.includes('/db-health') || pathname.endsWith('/db-health')) {
      return await handleHealth(req, res);
    } else if (pathname.includes('/seed') || pathname.endsWith('/seed')) {
      return await handleSeed(req, res);
    } else if (pathname.includes('/vehicle-data') || pathname.endsWith('/vehicle-data')) {
      return await handleVehicleData(req, res);
    } else if (pathname.includes('/new-cars') || pathname.endsWith('/new-cars')) {
      return await handleNewCars(req, res);
    } else {
      // Default to users for backward compatibility
      return await handleUsers(req, res);
    }

  } catch (error) {
    console.error('Main API Error:', error);
    
    // Ensure we always return JSON, never HTML
    res.setHeader('Content-Type', 'application/json');
    
    if (error instanceof Error && error.message.includes('MONGODB_URI')) {
      return res.status(500).json({ 
        success: false, 
        reason: 'Database configuration error. Please check MONGODB_URI environment variable.',
        details: 'The application is configured to use MongoDB but the connection string is not properly configured.'
      });
    }
    
    if (error instanceof Error && (error.message.includes('connect') || error.message.includes('timeout'))) {
      return res.status(500).json({ 
        success: false, 
        reason: 'Database connection failed. Please ensure the database is running and accessible.',
        details: 'Unable to connect to MongoDB database. Please check your database configuration and network connectivity.'
      });
    }
    
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Users handler - preserves exact functionality from users.ts
async function handleUsers(req: VercelRequest, res: VercelResponse) {
  // Handle authentication actions (POST with action parameter)
  if (req.method === 'POST') {
    const { action, email, password, role, name, mobile, firebaseUid, authProvider, avatarUrl } = req.body;

    // LOGIN
    if (action === 'login') {
      if (!email || !password) {
        return res.status(400).json({ success: false, reason: 'Email and password are required.' });
      }
      
      // Sanitize input
      const sanitizedData = sanitizeObject({ email, password, role });
      
      // Validate email format
      if (!validateEmail(sanitizedData.email)) {
        return res.status(400).json({ success: false, reason: 'Invalid email format.' });
      }
      
      const user = await User.findOne({ email: sanitizedData.email }).lean() as any;

      if (!user) {
        return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
      }
      
      // Verify password using bcrypt
      const isPasswordValid = await validatePassword(sanitizedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
      }
      
      if (sanitizedData.role && user.role !== sanitizedData.role) {
        return res.status(403).json({ success: false, reason: `User is not a registered ${sanitizedData.role}.` });
      }
      if (user.status === 'inactive') {
        return res.status(403).json({ success: false, reason: 'Your account has been deactivated.' });
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      const { password: _, ...userWithoutPassword } = user;
      return res.status(200).json({ 
        success: true, 
        user: userWithoutPassword,
        accessToken,
        refreshToken
      });
    }

    // REGISTER
    if (action === 'register') {
      if (!email || !password || !name || !mobile || !role) {
        return res.status(400).json({ success: false, reason: 'All fields are required.' });
      }

      // Ensure database connection before proceeding
      try {
        if (mongoose.connection.readyState !== 1) {
          console.log('🔄 Connecting to database for user registration...');
          await connectToDatabase();
        }
      } catch (dbError) {
        console.error('❌ Database connection error during registration:', dbError);
        return res.status(503).json({ 
          success: false, 
          reason: 'Database connection failed. Please check MONGODB_URI configuration.',
          error: dbError instanceof Error ? dbError.message : 'Connection error'
        });
      }

      // Sanitize and validate input data
      const sanitizedData = sanitizeObject({ email, password, name, mobile, role });
      const validation = validateUserInput(sanitizedData);
      
      if (!validation.isValid) {
        return res.status(400).json({ 
          success: false, 
          reason: 'Validation failed', 
          errors: validation.errors 
        });
      }

      // Normalize email to lowercase for consistent duplicate checking
      // This MUST match the normalization used when saving (line 294)
      const normalizedEmail = sanitizedData.email.toLowerCase().trim();

      try {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          console.warn('⚠️ Registration attempt with existing email:', normalizedEmail);
          return res.status(400).json({ success: false, reason: 'User already exists.' });
        }

        // Hash password before storing
        const hashedPassword = await hashPassword(sanitizedData.password);
        console.log('🔐 Password hashed successfully for user:', normalizedEmail);

        // Generate unique ID to avoid collisions
        const userId = Date.now() + Math.floor(Math.random() * 1000);

        const newUser = new User({
          id: userId,
          email: normalizedEmail,
          password: hashedPassword, // Store hashed password
          name: sanitizedData.name,
          mobile: sanitizedData.mobile,
          role: sanitizedData.role,
          status: 'active',
          isVerified: false,
          subscriptionPlan: 'free', // Fixed: should be subscriptionPlan not plan
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        });

        console.log('💾 Attempting to save user to MongoDB...');
        await newUser.save();
        console.log('✅ New user registered and saved to MongoDB:', normalizedEmail);
      
        // Generate JWT tokens for new user
        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);
        
        const { password: _, ...userWithoutPassword } = newUser.toObject();
        
        console.log('✅ Registration complete. User ID:', newUser._id);
        return res.status(201).json({ 
          success: true, 
          user: userWithoutPassword,
          accessToken,
          refreshToken
        });
      } catch (saveError) {
        console.error('❌ Error saving user to MongoDB:', saveError);
        const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error';
        const errorStack = saveError instanceof Error ? saveError.stack : undefined;
        
        // Log full error details for debugging
        console.error('Registration error details:', { 
          message: errorMessage, 
          stack: errorStack,
          email: normalizedEmail 
        });
        
        // Check for duplicate key error (email already exists)
        if (saveError instanceof Error && 
            (saveError.message.includes('E11000') || 
             saveError.message.includes('duplicate key') ||
             saveError.message.includes('email_1 dup key'))) {
          return res.status(400).json({ 
            success: false, 
            reason: 'User with this email already exists.' 
          });
        }
        
        // Check for validation errors
        if (saveError instanceof Error && saveError.name === 'ValidationError') {
          return res.status(400).json({ 
            success: false, 
            reason: 'Invalid user data provided.',
            error: errorMessage
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to save user to database. Please check MongoDB connection and try again.',
          error: errorMessage
        });
      }
    }

    // OAUTH LOGIN
    if (action === 'oauth-login') {
      if (!firebaseUid || !email || !name || !role) {
        return res.status(400).json({ success: false, reason: 'OAuth data incomplete.' });
      }

      // Sanitize OAuth data
      const sanitizedData = sanitizeObject({ firebaseUid, email, name, role, authProvider, avatarUrl });

      let user = await User.findOne({ email: sanitizedData.email });
      if (!user) {
        user = new User({
          id: Date.now(),
          email: sanitizedData.email,
          name: sanitizedData.name,
          role: sanitizedData.role,
          firebaseUid: sanitizedData.firebaseUid,
          authProvider: sanitizedData.authProvider,
          avatarUrl: sanitizedData.avatarUrl,
          status: 'active',
          isVerified: true,
          plan: 'basic',
          featuredCredits: 0,
          createdAt: new Date().toISOString()
        });
        await user.save();
      }

      // Generate JWT tokens for OAuth users
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      const { password: _, ...userWithoutPassword } = user.toObject();
      return res.status(200).json({ 
        success: true, 
        user: userWithoutPassword,
        accessToken,
        refreshToken
      });
    }

    // TOKEN REFRESH
    if (action === 'refresh-token') {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ success: false, reason: 'Refresh token is required.' });
      }

      try {
        const newAccessToken = generateAccessToken({ 
          id: 'temp', 
          email: 'temp@example.com', 
          name: 'Temp User',
          mobile: '0000000000',
          role: 'customer',
          location: 'Unknown',
          status: 'active',
          createdAt: new Date().toISOString()
        });
        return res.status(200).json({ 
          success: true, 
          accessToken: newAccessToken 
        });
      } catch (error) {
        return res.status(401).json({ success: false, reason: 'Invalid refresh token.' });
      }
    }

    return res.status(400).json({ success: false, reason: 'Invalid action.' });
  }

  // GET - Get all users
  if (req.method === 'GET') {
    const { action, email } = req.query;
    
    if (action === 'trust-score' && email) {
      const user = await User.findOne({ email: email as string });
      if (!user) {
        return res.status(404).json({ success: false, reason: 'User not found' });
      }
      
      const trustScore = calculateTrustScore(user);
      return res.status(200).json({ 
        success: true, 
        trustScore,
        email: user.email,
        name: user.name
      });
    }
    
    const users = await User.find({}).sort({ createdAt: -1 });
    return res.status(200).json(users);
  }

  // PUT - Update user
  if (req.method === 'PUT') {
    try {
      // Ensure database connection is established first
      console.log('🔌 Connecting to database for user update...');
      await connectToDatabase();
      
      // Ensure mongoose connection is ready
      if (mongoose.connection.readyState !== 1) {
        console.warn('⚠️ MongoDB connection not ready, reconnecting...');
        await connectToDatabase();
      }
      
      console.log('✅ Database connected for user update, readyState:', mongoose.connection.readyState);
      
      const { email, ...updateData } = req.body;
      
      if (!email) {
        return res.status(400).json({ success: false, reason: 'Email is required for update.' });
      }

      console.log('🔄 PUT /users - Updating user:', { email, hasPassword: !!updateData.password, fields: Object.keys(updateData) });

      // Separate null values (to be unset) from regular updates
      const updateFields: any = {};
      const unsetFields: any = {};
      
      // Handle password update separately - it needs to be hashed
      if (updateData.password !== undefined && updateData.password !== null) {
        try {
          // Validate password is a string
          if (typeof updateData.password !== 'string' || updateData.password.trim().length === 0) {
            return res.status(400).json({ 
              success: false, 
              reason: 'Password must be a non-empty string.' 
            });
          }

          // Check if password is already hashed (bcrypt hashes start with $2)
          // If not hashed, hash it before updating
          const isAlreadyHashed = updateData.password.startsWith('$2');
          
          if (isAlreadyHashed) {
            // Password is already hashed (edge case - for backward compatibility)
            updateFields.password = updateData.password;
            console.log('🔐 Password already hashed, using as-is');
          } else {
            // Hash the plain text password before updating
            console.log('🔐 Hashing password...');
            updateFields.password = await hashPassword(updateData.password);
            console.log('✅ Password hashed successfully');
          }
        } catch (hashError) {
          console.error('❌ Error hashing password:', hashError);
          const errorMessage = hashError instanceof Error ? hashError.message : 'Unknown error';
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to process password update. Please try again.',
            error: errorMessage
          });
        }
      }
      
      // Process other fields
      Object.keys(updateData).forEach(key => {
        // Skip password as it's already handled above
        if (key === 'password') {
          return;
        }
        
        if (updateData[key] === null) {
          unsetFields[key] = '';
        } else if (updateData[key] !== undefined) {
          updateFields[key] = updateData[key];
        }
      });

      // Build update operation
      const updateOperation: any = {};
      if (Object.keys(updateFields).length > 0) {
        updateOperation.$set = updateFields;
      }
      if (Object.keys(unsetFields).length > 0) {
        updateOperation.$unset = unsetFields;
      }

      // Only proceed with update if there are fields to update
      if (Object.keys(updateOperation).length === 0) {
        return res.status(400).json({ success: false, reason: 'No fields to update.' });
      }

      console.log('💾 Updating user in database...', { 
        email, 
        operationKeys: Object.keys(updateOperation),
        hasPasswordUpdate: !!updateFields.password,
        updateFields: Object.keys(updateFields),
        connectionState: mongoose.connection.readyState
      });

      // Double-check connection before update
      if (mongoose.connection.readyState !== 1) {
        console.warn('⚠️ Connection not ready before update, reconnecting...');
        await connectToDatabase();
      }

      // Find user first to ensure they exist
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (!existingUser) {
        console.warn('⚠️ User not found:', email);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      console.log('📝 Found user, applying update operation...');
      
      const updatedUser = await User.findOneAndUpdate(
        { email: email.toLowerCase().trim() }, // Ensure email is normalized
        updateOperation,
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        console.error('❌ Failed to update user after findOneAndUpdate');
        return res.status(500).json({ success: false, reason: 'Failed to update user.' });
      }

      // Explicitly save the document to ensure password is persisted
      if (updateFields.password) {
        console.log('💾 Explicitly saving user document to ensure password persistence...');
        await updatedUser.save();
        console.log('✅ User document saved successfully');
      }

      console.log('✅ User updated successfully:', updatedUser.email);
      console.log('✅ Password updated:', !!updateFields.password);

      // Verify the update actually saved by checking the user again
      if (updateFields.password) {
        const verifyUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (verifyUser && verifyUser.password) {
          console.log('✅ Password update verified in database');
          // Verify it's different from the old password (if we can check)
          if (verifyUser.password !== existingUser.password) {
            console.log('✅ Password hash changed, update confirmed');
          } else {
            console.warn('⚠️ Password hash unchanged - update may not have worked');
          }
        } else {
          console.error('❌ Password update verification failed - password not found in database');
        }
      }

      // Remove password from response for security
      const { password: _, ...userWithoutPassword } = updatedUser.toObject();
      return res.status(200).json({ success: true, user: userWithoutPassword });
    } catch (dbError) {
      console.error('❌ Database error during user update:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      const errorStack = dbError instanceof Error ? dbError.stack : undefined;
      
      // Log full error for debugging
      console.error('Error details:', { message: errorMessage, stack: errorStack });
      
      return res.status(500).json({ 
        success: false, 
        reason: 'Database error occurred. Please try again later.',
        error: errorMessage
      });
    }
  }

  // DELETE - Delete user
  if (req.method === 'DELETE') {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, reason: 'Email is required for deletion.' });
    }

    const deletedUser = await User.findOneAndDelete({ email });
    if (!deletedUser) {
      return res.status(404).json({ success: false, reason: 'User not found.' });
    }

    return res.status(200).json({ success: true, message: 'User deleted successfully.' });
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed.' });
}

// Vehicles handler - preserves exact functionality from vehicles.ts
async function handleVehicles(req: VercelRequest, res: VercelResponse) {
  // Check action type from query parameter
  const { type, action } = req.query;

  // VEHICLE DATA ENDPOINTS (brands, models, variants)
  if (type === 'data') {
    // Default vehicle data (fallback)
    const defaultData = {
      FOUR_WHEELER: [
        {
          name: "Maruti Suzuki",
          models: [
            { name: "Swift", variants: ["LXi", "VXi", "VXi (O)", "ZXi", "ZXi+"] },
            { name: "Baleno", variants: ["Sigma", "Delta", "Zeta", "Alpha"] },
            { name: "Dzire", variants: ["LXi", "VXi", "ZXi", "ZXi+"] }
          ]
        },
        {
          name: "Hyundai",
          models: [
            { name: "i20", variants: ["Magna", "Sportz", "Asta", "Asta (O)"] },
            { name: "Verna", variants: ["S", "SX", "SX (O)", "SX Turbo"] }
          ]
        },
        {
          name: "Tata",
          models: [
            { name: "Nexon", variants: ["XE", "XM", "XZ+", "XZ+ (O)"] },
            { name: "Safari", variants: ["XE", "XM", "XZ", "XZ+"] }
          ]
        }
      ],
      TWO_WHEELER: [
        {
          name: "Honda",
          models: [
            { name: "Activa 6G", variants: ["Standard", "DLX", "Smart"] },
            { name: "Shine", variants: ["Standard", "SP", "SP (Drum)"] }
          ]
        },
        {
          name: "Bajaj",
          models: [
            { name: "Pulsar 150", variants: ["Standard", "DTS-i", "NS"] },
            { name: "CT 100", variants: ["Standard", "X"] }
          ]
        }
      ]
    };

    if (req.method === 'GET') {
      try {
        await connectToDatabase();
        console.log('📡 Connected to database for vehicles data fetch operation');
        
        let vehicleDataDoc = await VehicleDataModel.findOne();
        if (!vehicleDataDoc) {
          // Create default vehicle data if none exists
          vehicleDataDoc = new VehicleDataModel({ data: defaultData });
          await vehicleDataDoc.save();
        }
        
        return res.status(200).json(vehicleDataDoc.data);
      } catch (dbError) {
        console.warn('⚠️ Database connection failed for vehicles data, returning default data:', dbError);
        // Return default data as fallback
        return res.status(200).json(defaultData);
      }
    }

    if (req.method === 'POST') {
      try {
        await connectToDatabase();
        console.log('📡 Connected to database for vehicles data save operation');
        
        const vehicleData = await VehicleDataModel.findOneAndUpdate(
          {},
          { 
            data: req.body,
            updatedAt: new Date()
          },
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
          }
        );
        
        console.log('✅ Vehicle data saved successfully to database');
        return res.status(200).json({ 
          success: true, 
          data: vehicleData.data,
          message: 'Vehicle data updated successfully',
          timestamp: new Date().toISOString()
        });
      } catch (dbError) {
        console.warn('⚠️ Database connection failed for vehicles data save:', dbError);
        
        // For POST requests, we should still return success but indicate fallback
        // This prevents the sync from failing completely
        console.log('📝 Returning success with fallback indication for POST request');
        return res.status(200).json({
          success: true,
          data: req.body,
          message: 'Vehicle data processed (database unavailable, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // VEHICLE CRUD OPERATIONS
  if (req.method === 'GET') {
    if (action === 'city-stats' && req.query.city) {
      const cityVehicles = await Vehicle.find({ city: req.query.city as string });
      const stats = {
        totalVehicles: cityVehicles.length,
        averagePrice: cityVehicles.reduce((sum, v) => sum + v.price, 0) / cityVehicles.length || 0,
        popularMakes: getPopularMakes(cityVehicles),
        priceRange: getPriceRange(cityVehicles)
      };
      return res.status(200).json(stats);
    }

    if (action === 'radius-search' && req.query.lat && req.query.lng && req.query.radius) {
      const vehicles = await Vehicle.find({ status: 'published' });
      const nearbyVehicles = vehicles.filter(vehicle => {
        if (!vehicle.exactLocation?.lat || !vehicle.exactLocation?.lng) return false;
        const distance = calculateDistance(
          parseFloat(req.query.lat as string),
          parseFloat(req.query.lng as string),
          vehicle.exactLocation.lat,
          vehicle.exactLocation.lng
        );
        return distance <= parseFloat(req.query.radius as string);
      });
      return res.status(200).json(nearbyVehicles);
    }

    // Get all vehicles and auto-disable expired listings
    const vehicles = await Vehicle.find({}).sort({ createdAt: -1 });
    
    const now = new Date();
    const sellerEmails = new Set<string>();
    
    vehicles.forEach(vehicle => {
      if (!vehicle.listingExpiresAt && vehicle.status === 'published' && vehicle.sellerEmail) {
        sellerEmails.add(vehicle.sellerEmail.toLowerCase());
      }
    });
    
    const sellerMap = new Map<string, any>();
    if (sellerEmails.size > 0) {
      const sellers = await User.find({ email: { $in: Array.from(sellerEmails) } }).lean();
      sellers.forEach(seller => {
        sellerMap.set(seller.email.toLowerCase(), seller);
      });
    }
    
    const bulkUpdates: any[] = [];
    
    vehicles.forEach(vehicle => {
      const updateFields: Record<string, any> = {};
      
      if (!vehicle.listingExpiresAt && vehicle.status === 'published' && vehicle.sellerEmail) {
        const seller = sellerMap.get(vehicle.sellerEmail.toLowerCase());
        if (seller) {
          if (seller.subscriptionPlan === 'premium' && seller.planExpiryDate) {
            updateFields.listingExpiresAt = seller.planExpiryDate;
          } else if (seller.subscriptionPlan !== 'premium') {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            updateFields.listingExpiresAt = expiryDate.toISOString();
          }
        }
      }
      
      if (vehicle.listingExpiresAt && vehicle.status === 'published') {
        const expiryDate = new Date(vehicle.listingExpiresAt);
        if (expiryDate < now) {
          updateFields.status = 'unpublished';
          updateFields.listingStatus = 'expired';
        }
      }
      
      if (Object.keys(updateFields).length > 0) {
        bulkUpdates.push({
          updateOne: {
            filter: { _id: vehicle._id },
            update: { $set: updateFields }
          }
        });
      }
    });
    
    if (bulkUpdates.length > 0) {
      await Vehicle.bulkWrite(bulkUpdates, { ordered: false });
    }
    
    // Return vehicles after checking expiry (latest data)
    const refreshedVehicles = bulkUpdates.length > 0
      ? await Vehicle.find({}).sort({ createdAt: -1 })
      : vehicles;
    
    return res.status(200).json(refreshedVehicles);
  }

  if (req.method === 'POST') {
    if (action === 'refresh') {
      const { vehicleId, refreshAction, sellerEmail } = req.body;
      const vehicle = await Vehicle.findOne({ id: vehicleId });
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      if (vehicle.sellerEmail !== sellerEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized' });
      }
      
      if (refreshAction === 'refresh') {
        vehicle.views = 0;
        vehicle.inquiriesCount = 0;
      } else if (refreshAction === 'renew') {
        vehicle.listingExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
      
      await vehicle.save();
      return res.status(200).json({ success: true, vehicle });
    }

    if (action === 'boost') {
      const { vehicleId, packageId } = req.body;
      const vehicle = await Vehicle.findOne({ id: vehicleId });
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      // Add boost information if packageId is provided
      // packageId format is like "top_search_3", "homepage_spot", etc.
      // Extract type and duration from packageId
      let boostType = 'top_search';
      let boostDuration = 7; // Default 7 days
      
      if (packageId) {
        const parts = packageId.split('_');
        if (parts.length >= 2) {
          // Extract type (first parts except last if it's a number)
          const lastPart = parts[parts.length - 1];
          const isLastPartNumber = !isNaN(Number(lastPart));
          
          if (isLastPartNumber) {
            boostType = parts.slice(0, -1).join('_');
            boostDuration = Number(lastPart);
          } else {
            boostType = parts.join('_');
            // Use default duration based on package
            boostDuration = 7; // Default
          }
        }
      }
      
      const boostInfo = {
        id: `boost_${Date.now()}`,
        vehicleId: vehicleId,
        packageId: packageId || 'standard',
        type: boostType,
        startDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + boostDuration * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      };
      
      if (!vehicle.activeBoosts) {
        vehicle.activeBoosts = [];
      }
      vehicle.activeBoosts.push(boostInfo);
      vehicle.isFeatured = true;

      await vehicle.save();
      return res.status(200).json({ success: true, vehicle });
    }

      if (action === 'certify') {
        try {
          const { vehicleId } = req.body;
          if (!vehicleId) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          await connectToDatabase();
          const vehicle = await Vehicle.findOne({ id: vehicleId });
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          const seller = await User.findOne({ email: vehicle.sellerEmail });
          if (!seller) {
            return res.status(404).json({ success: false, reason: 'Seller not found for this vehicle' });
          }

          const planKey = (seller.subscriptionPlan || 'free') as keyof typeof PLAN_DETAILS;
          const planDetails = PLAN_DETAILS[planKey] || PLAN_DETAILS.free;
          const allowedCertifications = planDetails.freeCertifications ?? 0;
          const usedCertifications = seller.usedCertifications ?? 0;

          if (allowedCertifications <= 0) {
            return res.status(403).json({
              success: false,
              reason: 'Your current plan does not include certification requests. Please upgrade your plan.'
            });
          }

          if (usedCertifications >= allowedCertifications) {
            return res.status(403).json({
              success: false,
              reason: `You have used all ${allowedCertifications} certification requests included in your plan.`
            });
          }

          if (vehicle.certificationStatus === 'requested') {
            const vehicleObj = vehicle.toObject();
            return res.status(200).json({
              success: true,
              vehicle: vehicleObj,
              alreadyRequested: true,
              usedCertifications,
              remainingCertifications: Math.max(allowedCertifications - usedCertifications, 0)
            });
          }

          vehicle.certificationStatus = 'requested';
          vehicle.certificationRequestedAt = new Date().toISOString();
          
          seller.usedCertifications = usedCertifications + 1;
          await Promise.all([vehicle.save(), seller.save()]);
          
          // Convert Mongoose document to plain object
          const vehicleObj = vehicle.toObject();
          const totalUsed = seller.usedCertifications ?? usedCertifications + 1;
          const remaining = Math.max(allowedCertifications - totalUsed, 0);
          
          return res.status(200).json({ 
            success: true, 
            vehicle: vehicleObj,
            usedCertifications: totalUsed,
            remainingCertifications: remaining 
          });
        } catch (error) {
          console.error('❌ Error requesting vehicle certification:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      if (action === 'feature') {
        try {
          const { vehicleId } = req.body;
          if (!vehicleId) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          await connectToDatabase();
          const vehicle = await Vehicle.findOne({ id: vehicleId });
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }

          if (vehicle.isFeatured) {
            const vehicleObj = vehicle.toObject();
            return res.status(200).json({ 
              success: true, 
              vehicle: vehicleObj,
              alreadyFeatured: true 
            });
          }

          const sellerEmail = vehicle.sellerEmail;
          if (!sellerEmail) {
            return res.status(400).json({ success: false, reason: 'Vehicle does not have an associated seller.' });
          }

          const seller = await User.findOne({ email: sellerEmail });
          if (!seller) {
            return res.status(404).json({ success: false, reason: 'Seller not found for this vehicle.' });
          }

          // Determine plan-based featured credit allowance
          const FEATURE_CREDIT_LIMITS: Record<string, number> = {
            free: 0,
            pro: 2,
            premium: 5
          };

          const sellerPlan = (seller.subscriptionPlan || 'free') as string;
          const planLimit = FEATURE_CREDIT_LIMITS[sellerPlan] ?? 0;

          // Initialize featured credits if undefined
          let remainingCredits = typeof seller.featuredCredits === 'number' ? seller.featuredCredits : planLimit;
          if (!Number.isFinite(remainingCredits)) {
            remainingCredits = 0;
          }

          if (planLimit === 0) {
            return res.status(403).json({
              success: false,
              reason: 'Your current plan does not include featured listings. Upgrade to unlock featured credits.',
              remainingCredits: remainingCredits
            });
          }

          if (remainingCredits <= 0) {
            return res.status(403).json({
              success: false,
              reason: 'You have no featured credits remaining. Upgrade your plan or wait until your credits refresh.',
              remainingCredits: remainingCredits
            });
          }

          vehicle.isFeatured = true;
          vehicle.featuredAt = new Date().toISOString();
          await vehicle.save();

          // Deduct one featured credit
          seller.featuredCredits = Math.max(0, remainingCredits - 1);
          await seller.save();
          
          const vehicleObj = vehicle.toObject();
          
          return res.status(200).json({ 
            success: true, 
            vehicle: vehicleObj,
            remainingCredits: seller.featuredCredits
          });
        } catch (error) {
          console.error('❌ Error featuring vehicle:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      if (action === 'sold') {
        try {
          const { vehicleId } = req.body;
          console.log('📝 Marking vehicle as sold, vehicleId:', vehicleId, 'type:', typeof vehicleId);
          
          if (!vehicleId && vehicleId !== 0) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          // Convert vehicleId to number if it's a string
          const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
          if (isNaN(vehicleIdNum)) {
            return res.status(400).json({ success: false, reason: 'Invalid vehicle ID format' });
          }

          // Ensure database connection is established
          console.log('🔌 Connecting to database...');
          await connectToDatabase();
          console.log('✅ Database connected, readyState:', mongoose.connection.readyState);
          
          console.log('🔍 Finding vehicle with id:', vehicleIdNum);
          const vehicle = await Vehicle.findOne({ id: vehicleIdNum });
          
          if (!vehicle) {
            console.warn('⚠️ Vehicle not found with id:', vehicleIdNum);
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          console.log('✏️ Updating vehicle status to sold...');
          vehicle.status = 'sold';
          vehicle.listingStatus = 'sold';
          vehicle.soldAt = new Date().toISOString();
          
          await vehicle.save();
          console.log('✅ Vehicle saved successfully');
          
          // Convert Mongoose document to plain object
          const vehicleObj = vehicle.toObject();
          
          return res.status(200).json({ success: true, vehicle: vehicleObj });
        } catch (error) {
          console.error('❌ Error marking vehicle as sold:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error('❌ Error message:', errorMessage);
          if (errorStack) {
            console.error('❌ Error stack:', errorStack);
          }
          return res.status(500).json({ 
            success: false, 
            reason: errorMessage
          });
        }
      }

      if (action === 'unsold') {
        try {
          const { vehicleId } = req.body;
          if (!vehicleId) {
            return res.status(400).json({ success: false, reason: 'Vehicle ID is required' });
          }

          await connectToDatabase();
          const vehicle = await Vehicle.findOne({ id: vehicleId });
          
          if (!vehicle) {
            return res.status(404).json({ success: false, reason: 'Vehicle not found' });
          }
          
          vehicle.status = 'published';
          vehicle.listingStatus = 'active';
          vehicle.soldAt = undefined;
          
          await vehicle.save();
          
          // Convert Mongoose document to plain object
          const vehicleObj = vehicle.toObject();
          
          return res.status(200).json({ success: true, vehicle: vehicleObj });
        } catch (error) {
          console.error('❌ Error marking vehicle as unsold:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

    // Create new vehicle
    // Set listingExpiresAt based on seller's plan expiry date
    let listingExpiresAt: string | undefined;
    if (req.body.sellerEmail) {
      const seller = await User.findOne({ email: req.body.sellerEmail });
      if (seller) {
        if (seller.subscriptionPlan === 'premium' && seller.planExpiryDate) {
          // Premium plan: use plan expiry date
          listingExpiresAt = seller.planExpiryDate;
        } else if (seller.subscriptionPlan !== 'premium') {
          // Free and Pro plans get 30-day expiry from today
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          listingExpiresAt = expiryDate.toISOString();
        }
        // If Premium without planExpiryDate, listingExpiresAt remains undefined (no expiry)
      }
    }
    
    const newVehicle = new Vehicle({
      id: Date.now(),
      ...req.body,
      createdAt: new Date().toISOString(),
      listingExpiresAt
    });
    
    await newVehicle.save();
    return res.status(201).json(newVehicle);
  }

  if (req.method === 'PUT') {
    try {
      // Ensure database connection
      await connectToDatabase();
      
      const { id, ...updateData } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, reason: 'Vehicle ID is required for update.' });
      }
      
      const updatedVehicle = await Vehicle.findOneAndUpdate(
        { id },
        updateData,
        { new: true }
      );
      
      if (!updatedVehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      // Convert Mongoose document to plain object for JSON serialization
      const vehicleObj = updatedVehicle.toObject();
      
      return res.status(200).json(vehicleObj);
    } catch (error) {
      console.error('❌ Error updating vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Ensure database connection
      await connectToDatabase();
      
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, reason: 'Vehicle ID is required for deletion.' });
      }
      
      const deletedVehicle = await Vehicle.findOneAndDelete({ id });
      if (!deletedVehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
      }
      
      return res.status(200).json({ success: true, message: 'Vehicle deleted successfully.' });
    } catch (error) {
      console.error('❌ Error deleting vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed.' });
}

// Admin handler - preserves exact functionality from admin.ts
async function handleAdmin(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  if (action === 'health') {
    try {
      const hasMongoUri = !!process.env.MONGODB_URI;
      
      if (!hasMongoUri) {
        return res.status(200).json({
          success: false,
          message: 'MONGODB_URI environment variable is not configured',
          details: 'Please add MONGODB_URI in Vercel dashboard under Environment Variables',
          checks: [
            { name: 'MongoDB URI Configuration', status: 'FAIL', details: 'MONGODB_URI environment variable not found' }
          ]
        });
      }

      await connectToDatabase();
      const db = Vehicle.db?.db;
      const collections = db ? await db.listCollections().toArray() : [];
      
      return res.status(200).json({
        success: true,
        message: 'Database connected successfully',
        collections: collections.map(c => c.name),
        checks: [
          { name: 'MongoDB URI Configuration', status: 'PASS', details: 'MONGODB_URI is set' },
          { name: 'Database Connection', status: 'PASS', details: 'Successfully connected to MongoDB' }
        ]
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (action === 'seed') {
    try {
      const users = await seedUsers();
      const vehicles = await seedVehicles();
      
      return res.status(200).json({
        success: true,
        message: 'Database seeded successfully',
        data: { users: users.length, vehicles: vehicles.length }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Seeding failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(400).json({ success: false, reason: 'Invalid admin action' });
}

// Health handler - preserves exact functionality from db-health.ts
async function handleHealth(_req: VercelRequest, res: VercelResponse) {
  try {
    await connectToDatabase();
    return res.status(200).json({
      status: 'ok',
      message: 'Database connected successfully.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    let errorMessage = 'Database connection failed';
    
    if (error instanceof Error) {
      if (error.message.includes('MONGODB_URI')) {
        errorMessage += ' - Check MONGODB_URI environment variable in Vercel dashboard';
      } else if (error.message.includes('connect') || error.message.includes('timeout')) {
        errorMessage += ' - Check database server status and network connectivity';
      }
    }
    
    return res.status(500).json({
      status: 'error',
      message: errorMessage,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Seed handler - preserves exact functionality from seed.ts
async function handleSeed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  try {
    await connectToDatabase();
    
    const users = await seedUsers();
    const vehicles = await seedVehicles();
    
    return res.status(200).json({
      success: true,
      message: 'Database seeded successfully',
      data: { users: users.length, vehicles: vehicles.length }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Seeding failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Vehicle Data handler - preserves exact functionality from vehicle-data.ts
async function handleVehicleData(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    let vehicleDataDoc = await VehicleDataModel.findOne();
    if (!vehicleDataDoc) {
      const defaultData = {
        FOUR_WHEELER: [
          {
            name: "Maruti Suzuki",
            models: [
              { name: "Swift", variants: ["LXi", "VXi", "VXi (O)", "ZXi", "ZXi+"] },
              { name: "Baleno", variants: ["Sigma", "Delta", "Zeta", "Alpha"] }
            ]
          }
        ],
        TWO_WHEELER: [
          {
            name: "Honda",
            models: [
              { name: "Activa 6G", variants: ["Standard", "DLX", "Smart"] }
            ]
          }
        ]
      };
      
      vehicleDataDoc = new VehicleDataModel({ data: defaultData });
      await vehicleDataDoc.save();
    }
    
    return res.status(200).json(vehicleDataDoc.data);
  }

  if (req.method === 'POST') {
    const vehicleData = await VehicleDataModel.findOneAndUpdate(
      {},
      { data: req.body },
      { upsert: true, new: true }
    );
    return res.status(200).json({ success: true, data: vehicleData });
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed' });
}

// Helper functions
function calculateTrustScore(user: any): number {
  let score = 50; // Base score
  
  const plan = user.subscriptionPlan || user.plan;
  if (user.isVerified) score += 20;
  if (plan === 'premium') score += 15;
  if (plan === 'pro') score += 10;
  if (user.status === 'active') score += 10;
  
  return Math.min(100, score);
}

function getPopularMakes(vehicles: any[]): string[] {
  const makeCounts: { [key: string]: number } = {};
  vehicles.forEach(v => {
    makeCounts[v.make] = (makeCounts[v.make] || 0) + 1;
  });
  
  return Object.entries(makeCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([make]) => make);
}

function getPriceRange(vehicles: any[]): { min: number; max: number } {
  if (vehicles.length === 0) return { min: 0, max: 0 };
  
  const prices = vehicles.map(v => v.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };
}

// New Cars handler - CRUD for new car catalog
async function handleNewCars(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const items = await NewCar.find({}).sort({ updatedAt: -1 });
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (!payload || !payload.brand_name || !payload.model_name || !payload.model_year) {
      return res.status(400).json({ success: false, reason: 'Missing required fields' });
    }
    const doc = new NewCar({ ...payload });
    await doc.save();
    return res.status(201).json({ success: true, data: doc });
  }

  if (req.method === 'PUT') {
    const { id, _id, ...updateData } = req.body || {};
    const docId = _id || id;
    if (!docId) {
      return res.status(400).json({ success: false, reason: 'Document id (_id) is required' });
    }
    const updated = await NewCar.findByIdAndUpdate(docId, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, reason: 'New car document not found' });
    }
    return res.status(200).json({ success: true, data: updated });
  }

  if (req.method === 'DELETE') {
    const { id, _id } = req.body || {};
    const docId = _id || id;
    if (!docId) {
      return res.status(400).json({ success: false, reason: 'Document id (_id) is required' });
    }
    const deleted = await NewCar.findByIdAndDelete(docId);
    if (!deleted) {
      return res.status(404).json({ success: false, reason: 'New car document not found' });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed.' });
}

async function seedUsers(): Promise<any[]> {
  // Hash passwords before inserting
  const adminPassword = await hashPassword('password');
  const sellerPassword = await hashPassword('password');
  const customerPassword = await hashPassword('password');
  
  // Set plan dates for seller
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month from now
  
  const sampleUsers = [
    {
      id: 1,
      email: 'admin@test.com',
      password: adminPassword,
      name: 'Admin User',
      mobile: '9876543210',
      role: 'admin',
      status: 'active',
      isVerified: true,
      subscriptionPlan: 'premium',
      featuredCredits: 100,
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      email: 'seller@test.com',
      password: sellerPassword,
      name: 'Prestige Motors',
      mobile: '+91-98765-43210',
      role: 'seller',
      status: 'active',
      isVerified: true,
      subscriptionPlan: 'premium',
      featuredCredits: 5,
      usedCertifications: 1,
      dealershipName: 'Prestige Motors',
      bio: 'Specializing in luxury and performance electric vehicles since 2020.',
      logoUrl: 'https://i.pravatar.cc/100?u=seller',
      avatarUrl: 'https://i.pravatar.cc/150?u=seller@test.com',
      planActivatedDate: now.toISOString(),
      planExpiryDate: expiryDate.toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      email: 'customer@test.com',
      password: customerPassword,
      name: 'Test Customer',
      mobile: '9876543212',
      role: 'customer',
      status: 'active',
      isVerified: false,
      subscriptionPlan: 'free',
      featuredCredits: 0,
      avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com',
      createdAt: new Date().toISOString()
    }
  ];

  await User.deleteMany({});
  const users = await User.insertMany(sampleUsers);
  return users;
}

async function seedVehicles(): Promise<any[]> {
  const sampleVehicles = [
    {
      id: 1,
      make: 'Maruti Suzuki',
      model: 'Swift',
      variant: 'VXi',
      year: 2022,
      price: 650000,
      mileage: 15000,
      category: 'FOUR_WHEELER',
      sellerEmail: 'seller@test.com',
      status: 'published',
      isFeatured: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      make: 'Honda',
      model: 'City',
      variant: 'VX',
      year: 2021,
      price: 850000,
      mileage: 25000,
      category: 'FOUR_WHEELER',
      sellerEmail: 'seller@test.com',
      status: 'published',
      isFeatured: true,
      createdAt: new Date().toISOString()
    }
  ];

  await Vehicle.deleteMany({});
  const vehicles = await Vehicle.insertMany(sampleVehicles);
  return vehicles;
}


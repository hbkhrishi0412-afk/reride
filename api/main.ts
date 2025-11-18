import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import connectToDatabase, { MongoConfigError, ensureDatabaseInUri } from '../lib/db.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import VehicleDataModel from '../models/VehicleData.js';
import { PLAN_DETAILS } from '../constants.js';
import NewCar from '../models/NewCar.js';
import { planService } from '../services/planService.js';
import { 
  hashPassword, 
  validatePassword, 
  generateAccessToken, 
  generateRefreshToken, 
  validateUserInput,
  getSecurityHeaders,
  sanitizeObject,
  validateEmail
} from '../utils/security.js';
import { getSecurityConfig } from '../utils/security-config.js';
import { MongoClient, ObjectId } from 'mongodb';

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

type HandlerOptions = {
  mongoAvailable: boolean;
  mongoFailureReason?: string;
};

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
    let mongoAvailable = true;
    let mongoFailureReason: string | undefined;

    const connectWithGracefulFallback = async () => {
      try {
        await connectToDatabase();
      } catch (dbError) {
        mongoAvailable = false;
        mongoFailureReason = dbError instanceof MongoConfigError
          ? 'MongoDB is not configured. Set MONGODB_URL or MONGODB_URI in your environment.'
          : 'Database temporarily unavailable. Please try again later.';
        console.warn('Database connection issue:', dbError);
        if (req.method !== 'GET') {
          return res.status(503).json({
            success: false,
            reason: mongoFailureReason,
            fallback: true
          });
        }
        res.setHeader('X-Database-Fallback', 'true');
      }
      return undefined;
    };

    const earlyResponse = await connectWithGracefulFallback();
    if (earlyResponse) {
      return earlyResponse;
    }

    // Route based on the path
    // Handle Vercel rewrites - check original path if available
    let pathname = '/';
    try {
      const originalPath = req.headers['x-vercel-original-path'] as string;
      const requestUrl = originalPath || req.url || '';
      
      // If requestUrl doesn't start with /, it might be a full URL or relative
      if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
        const url = new URL(requestUrl);
        pathname = url.pathname;
      } else if (requestUrl.startsWith('/')) {
        pathname = requestUrl.split('?')[0]; // Remove query string
      } else {
        // Try to construct URL
        const url = new URL(requestUrl, `http://${req.headers.host || 'localhost'}`);
        pathname = url.pathname;
      }
    } catch (urlError) {
      console.warn('⚠️ Error parsing URL, using fallback:', urlError);
      // Fallback: try to extract pathname from req.url directly
      if (req.url) {
        const match = req.url.match(/^([^?]+)/);
        if (match) {
          pathname = match[1];
        }
      }
    }
    
    // Log for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📍 Request pathname: ${pathname}, url: ${req.url}`);
    }

    // Route to appropriate handler
    const handlerOptions: HandlerOptions = {
      mongoAvailable,
      mongoFailureReason
    };

    if (pathname.includes('/users') || pathname.endsWith('/users')) {
      return await handleUsers(req, res, handlerOptions);
    } else if (pathname.includes('/vehicles') || pathname.endsWith('/vehicles')) {
      try {
        return await handleVehicles(req, res, handlerOptions);
      } catch (error) {
        console.error('⚠️ Error in handleVehicles wrapper:', error);
        // For vehicles?type=data, ensure we never return 500
        if (req.query?.type === 'data') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json({
            FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
            TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
          });
        }
        // For other vehicle endpoints, let the error propagate to outer catch
        throw error;
      }
    } else if (pathname.includes('/admin') || pathname.endsWith('/admin')) {
      return await handleAdmin(req, res, handlerOptions);
    } else if (pathname.includes('/db-health') || pathname.endsWith('/db-health')) {
      return await handleHealth(req, res);
    } else if (pathname.includes('/seed') || pathname.endsWith('/seed')) {
      return await handleSeed(req, res, handlerOptions);
    } else     if (pathname.includes('/vehicle-data') || pathname.endsWith('/vehicle-data')) {
      try {
        return await handleVehicleData(req, res, handlerOptions);
      } catch (error) {
        console.error('⚠️ Error in handleVehicleData wrapper:', error);
        // Ensure we never return 500 for vehicle-data endpoints
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({
          FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
          TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
        });
      }
    } else if (pathname.includes('/new-cars') || pathname.endsWith('/new-cars')) {
      return await handleNewCars(req, res, handlerOptions);
    } else if (pathname.includes('/system') || pathname.endsWith('/system')) {
      return await handleSystem(req, res, handlerOptions);
    } else if (pathname.includes('/utils') || pathname.endsWith('/utils') || pathname.includes('/test-connection')) {
      return await handleUtils(req, res, handlerOptions);
    } else if (pathname.includes('/ai') || pathname.endsWith('/ai') || pathname.includes('/gemini')) {
      return await handleAI(req, res, handlerOptions);
    } else if (pathname.includes('/content') || pathname.endsWith('/content')) {
      return await handleContent(req, res, handlerOptions);
    } else if (pathname.includes('/sell-car') || pathname.endsWith('/sell-car')) {
      return await handleSellCar(req, res, handlerOptions);
    } else if (pathname.includes('/payments') || pathname.endsWith('/payments') || pathname.includes('/plans') || pathname.endsWith('/plans') || pathname.includes('/business')) {
      return await handleBusiness(req, res, handlerOptions);
    } else {
      // Default to users for backward compatibility
      return await handleUsers(req, res, handlerOptions);
    }

  } catch (error) {
    console.error('Main API Error:', error);
    
    // Ensure we always return JSON, never HTML
    res.setHeader('Content-Type', 'application/json');
    
    // Special handling for vehicle-data endpoints - NEVER return 500
    const pathname = req.url?.split('?')[0] || '';
    const isVehicleDataEndpoint = pathname.includes('/vehicle-data') || 
                                  pathname.includes('/vehicles') && req.query?.type === 'data';
    
    if (isVehicleDataEndpoint) {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({
        FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
        TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
      });
    }
    
    if (error instanceof Error && (error.message.includes('MONGODB_URI') || error.message.includes('MONGODB_URL'))) {
      return res.status(500).json({ 
        success: false, 
        reason: 'Database configuration error. Please check MONGODB_URL or MONGODB_URI environment variable.',
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
async function handleUsers(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    const { mongoAvailable, mongoFailureReason } = options;
    const unavailableResponse = () => res.status(503).json({
      success: false,
      reason: mongoFailureReason || 'Database is currently unavailable. Please try again later.',
      fallback: true
    });

  // Handle authentication actions (POST with action parameter)
  if (req.method === 'POST') {
    if (!mongoAvailable) {
      return unavailableResponse();
    }

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
          reason: 'Database connection failed. Please check MONGODB_URL or MONGODB_URI configuration.',
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

    if (!mongoAvailable) {
      const fallbackUsers = await getFallbackUsers();
      if (action === 'trust-score' && email) {
        const user = fallbackUsers.find(u => u.email === email);
        if (!user) {
          return res.status(404).json({ success: false, reason: 'User not found', fallback: true });
        }
        const trustScore = calculateTrustScore(user);
        return res.status(200).json({
          success: true,
          trustScore,
          email: user.email,
          name: user.name,
          fallback: true
        });
      }
      return res.status(200).json(fallbackUsers);
    }
    
    if (action === 'trust-score' && email) {
      try {
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
      } catch (error) {
        console.error('Error fetching trust score:', error);
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to fetch trust score',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    try {
      const users = await User.find({}).sort({ createdAt: -1 });
      return res.status(200).json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      // Fallback to local users if database query fails
      const fallbackUsers = await getFallbackUsers();
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json(fallbackUsers);
    }
  }

  // PUT - Update user
  if (req.method === 'PUT') {
    if (!mongoAvailable) {
      return unavailableResponse();
    }
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
    if (!mongoAvailable) {
      return unavailableResponse();
    }
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, reason: 'Email is required for deletion.' });
      }

      const deletedUser = await User.findOneAndDelete({ email });
      if (!deletedUser) {
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      return res.status(200).json({ success: true, message: 'User deleted successfully.' });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({
        success: false,
        reason: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    console.error('Error in handleUsers:', error);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // If it's a database connection error, return 503
    if (error instanceof Error && (error.message.includes('MONGODB') || error.message.includes('connect'))) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    // For other errors, return 500 with error details
    return res.status(500).json({
      success: false,
      reason: 'An error occurred while processing the request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Vehicles handler - preserves exact functionality from vehicles.ts
async function handleVehicles(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    const { mongoAvailable, mongoFailureReason } = options;
    // Check action type from query parameter
    const { type, action } = req.query;
    const unavailableResponse = () => res.status(503).json({
      success: false,
      reason: mongoFailureReason || 'Database is currently unavailable. Please try again later.',
      fallback: true
    });

  // VEHICLE DATA ENDPOINTS (brands, models, variants)
  if (type === 'data') {
    // Ensure JSON content type
    res.setHeader('Content-Type', 'application/json');
    
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

    try {
      if (req.method === 'GET') {
        // Always return default data if mongo is not available
        if (!mongoAvailable) {
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json(defaultData);
        }
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
          // Return default data as fallback - NEVER return 500
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json(defaultData);
        }
      }

      if (req.method === 'POST') {
        // Always return success response, even if mongo is not available
        if (!mongoAvailable) {
          res.setHeader('X-Data-Fallback', 'true');
          console.warn('⚠️ Vehicle data save attempted without MongoDB. Returning fallback acknowledgement.');
          return res.status(200).json({
            success: true,
            data: req.body,
            message: 'Vehicle data processed (database unavailable, using fallback)',
            fallback: true,
            timestamp: new Date().toISOString()
          });
        }
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
          // This prevents the sync from failing completely - NEVER return 500
          console.log('📝 Returning success with fallback indication for POST request');
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json({
            success: true,
            data: req.body,
            message: 'Vehicle data processed (database unavailable, using fallback)',
            fallback: true,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      // Ultimate fallback - catch any unexpected errors
      console.error('⚠️ Unexpected error in handleVehicles type=data:', error);
      res.setHeader('X-Data-Fallback', 'true');
      if (req.method === 'GET') {
        return res.status(200).json(defaultData);
      } else {
        return res.status(200).json({
          success: true,
          data: req.body || {},
          message: 'Vehicle data processed (error occurred, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // VEHICLE CRUD OPERATIONS
  if (req.method === 'GET') {
    if (!mongoAvailable) {
      const fallbackVehicles = await getFallbackVehicles();
      if (action === 'city-stats' && req.query.city) {
        const cityVehicles = fallbackVehicles.filter(v => v.city === req.query.city);
        const stats = {
          totalVehicles: cityVehicles.length,
          averagePrice: cityVehicles.reduce((sum, v) => sum + (v.price || 0), 0) / (cityVehicles.length || 1),
          popularMakes: getPopularMakes(cityVehicles),
          priceRange: getPriceRange(cityVehicles)
        };
        return res.status(200).json({ ...stats, fallback: true });
      }

      if (action === 'radius-search' && req.query.lat && req.query.lng && req.query.radius) {
        const nearbyVehicles = fallbackVehicles.filter(vehicle => {
          if (!vehicle.exactLocation?.lat || !vehicle.exactLocation?.lng) return false;
          const distance = calculateDistance(
            parseFloat(req.query.lat as string),
            parseFloat(req.query.lng as string),
            vehicle.exactLocation.lat,
            vehicle.exactLocation.lng
          );
          return distance <= parseFloat(req.query.radius as string);
        });
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(nearbyVehicles);
      }

      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json(fallbackVehicles);
    }

    try {
      // Ensure database connection is established
      await connectToDatabase();
      
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
            // If seller's plan has expired, force-unpublish even if listingExpiresAt is not set
            if (seller.planExpiryDate) {
              const sellerExpiry = new Date(seller.planExpiryDate);
              if (!isNaN(sellerExpiry.getTime()) && sellerExpiry < now) {
                updateFields.status = 'unpublished';
                updateFields.listingStatus = 'expired';
              }
            }
            
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
      
      // Enforce plan listing limits: keep most recent listings within limit, unpublish extras
      try {
        // Build per-seller published vehicles list (newest first)
        const sellerToPublished: Map<string, any[]> = new Map();
        vehicles.forEach(v => {
          if (v.status === 'published' && v.sellerEmail) {
            const key = v.sellerEmail.toLowerCase();
            if (!sellerToPublished.has(key)) sellerToPublished.set(key, []);
            sellerToPublished.get(key)!.push(v);
          }
        });
        sellerToPublished.forEach(list => {
          list.sort((a, b) => {
            const aTime = new Date(a.createdAt || a._id?.getTimestamp?.() || 0).getTime();
            const bTime = new Date(b.createdAt || b._id?.getTimestamp?.() || 0).getTime();
            return bTime - aTime;
          });
        });
        
        // For each seller, apply plan limit
        sellerToPublished.forEach((publishedVehicles, email) => {
          const seller = sellerMap.get(email);
          const planKey = (seller?.subscriptionPlan || 'free') as keyof typeof PLAN_DETAILS;
          const planDetails = PLAN_DETAILS[planKey] || PLAN_DETAILS.free;
          const limit = planDetails.listingLimit;
          if (limit === 'unlimited') {
            return;
          }
          const numericLimit = Number(limit) || 0;
          if (publishedVehicles.length > numericLimit) {
            const extras = publishedVehicles.slice(numericLimit); // older ones
            extras.forEach(v => {
              bulkUpdates.push({
                updateOne: {
                  filter: { _id: v._id },
                  update: { $set: { status: 'unpublished', listingStatus: 'suspended' } }
                }
              });
            });
          }
        });
      } catch (limitErr) {
        console.warn('⚠️ Error applying plan listing limits:', limitErr);
      }
      
      if (bulkUpdates.length > 0) {
        await Vehicle.bulkWrite(bulkUpdates, { ordered: false });
      }
      
      // Return vehicles after checking expiry (latest data)
      const refreshedVehicles = bulkUpdates.length > 0
        ? await Vehicle.find({}).sort({ createdAt: -1 })
        : vehicles;
      
      return res.status(200).json(refreshedVehicles);
    } catch (error) {
      console.error('❌ Error fetching vehicles:', error);
      // Fallback to mock data if database query fails
      const fallbackVehicles = await getFallbackVehicles();
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json(fallbackVehicles);
    }
  }

  if (req.method === 'POST') {
    if (!mongoAvailable) {
      return unavailableResponse();
    }
    // Enforce plan expiry and listing limits for creation (no action or unknown action)
    // Only applies to standard create flow (i.e., when not handling action sub-routes above)
    if (!action || (action !== 'refresh' && action !== 'boost' && action !== 'certify' && action !== 'sold' && action !== 'unsold' && action !== 'feature' && action !== 'track-view')) {
      try {
        const { sellerEmail } = req.body || {};
        if (!sellerEmail || typeof sellerEmail !== 'string') {
          return res.status(400).json({ success: false, reason: 'Seller email is required' });
        }
        // Normalize email
        const normalizedEmail = sellerEmail.toLowerCase().trim();
        // Ensure DB connection for safety
        await connectToDatabase();
        // Load seller
        const seller = await User.findOne({ email: normalizedEmail });
        if (!seller) {
          return res.status(404).json({ success: false, reason: 'Seller not found' });
        }
        // Check plan expiry
        const nowIso = new Date();
        const planExpiryDate = seller.planExpiryDate ? new Date(seller.planExpiryDate) : undefined;
        const planExpired = !!(planExpiryDate && planExpiryDate.getTime() < nowIso.getTime());
        if (planExpired) {
          return res.status(403).json({
            success: false,
            reason: 'Your subscription plan has expired. Please renew your plan to create new listings.',
            planExpired: true,
            expiredOn: seller.planExpiryDate
          });
        }
        // Determine listing limit for current plan
        const planKey = (seller.subscriptionPlan || 'free') as keyof typeof PLAN_DETAILS;
        const planDetails = PLAN_DETAILS[planKey] || PLAN_DETAILS.free;
        const listingLimit = planDetails.listingLimit;
        if (listingLimit !== 'unlimited') {
          const currentActiveCount = await Vehicle.countDocuments({ sellerEmail: normalizedEmail, status: 'published' });
          if (currentActiveCount >= (Number(listingLimit) || 0)) {
            return res.status(403).json({
              success: false,
              reason: `Listing limit reached for your ${planDetails.name} plan. You can have up to ${listingLimit} active listing(s).`,
              limitReached: true,
              activeListings: currentActiveCount,
              limit: listingLimit
            });
          }
        }
      } catch (guardError) {
        console.error('❌ Error validating plan/limits before vehicle creation:', guardError);
        return res.status(500).json({
          success: false,
          reason: 'Failed to validate plan or listing limits. Please try again.',
        });
      }
    }

    // Track a single view for a vehicle
    if (action === 'track-view') {
      try {
        const { vehicleId } = req.body || {};
        const vehicleIdNum = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId);
        if (!vehicleIdNum || Number.isNaN(vehicleIdNum)) {
          return res.status(400).json({ success: false, reason: 'Valid vehicleId is required' });
        }

        await connectToDatabase();
        const vehicle = await Vehicle.findOne({ id: vehicleIdNum });
        if (!vehicle) {
          return res.status(404).json({ success: false, reason: 'Vehicle not found' });
        }

        const currentViews = typeof vehicle.views === 'number' ? vehicle.views : 0;
        vehicle.views = currentViews + 1;
        await vehicle.save();

        return res.status(200).json({ success: true, views: vehicle.views });
      } catch (error) {
        return res.status(500).json({ success: false, reason: 'Failed to track view', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
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
        // If plan has expired, block already above; here we only compute expiry for active plans
        const isExpired = seller.planExpiryDate ? new Date(seller.planExpiryDate) < new Date() : false;
        if (seller.subscriptionPlan === 'premium') {
          if (!isExpired && seller.planExpiryDate) {
            // Premium plan active: use plan expiry date
            listingExpiresAt = seller.planExpiryDate;
          } else {
            // Premium without expiry date: leave undefined (no expiry)
            listingExpiresAt = listingExpiresAt;
          }
        } else if (seller.subscriptionPlan !== 'premium') {
          // Free and Pro plans get 30-day expiry from today
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          listingExpiresAt = expiryDate.toISOString();
        }
        // If Premium without planExpiryDate, listingExpiresAt remains as-is (no expiry)
      }
    }
    
    const newVehicle = new Vehicle({
      id: Date.now(),
      ...req.body,
      views: 0,
      inquiriesCount: 0,
      createdAt: new Date().toISOString(),
      listingExpiresAt
    });
    
    await newVehicle.save();
    return res.status(201).json(newVehicle);
  }

  if (req.method === 'PUT') {
    if (!mongoAvailable) {
      return unavailableResponse();
    }
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
    if (!mongoAvailable) {
      return unavailableResponse();
    }
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
  } catch (error) {
    console.error('Error in handleVehicles:', error);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Special handling for vehicle-data endpoints - NEVER return 500
    const isVehicleDataEndpoint = req.query?.type === 'data';
    if (isVehicleDataEndpoint) {
      res.setHeader('X-Data-Fallback', 'true');
      const defaultData = {
        FOUR_WHEELER: [{ name: "Maruti Suzuki", models: [{ name: "Swift", variants: ["LXi", "VXi", "ZXi"] }] }],
        TWO_WHEELER: [{ name: "Honda", models: [{ name: "Activa 6G", variants: ["Standard", "DLX"] }] }]
      };
      if (req.method === 'GET') {
        return res.status(200).json(defaultData);
      } else {
        return res.status(200).json({
          success: true,
          data: req.body || {},
          message: 'Vehicle data processed (error occurred, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // If it's a database connection error, return 503
    if (error instanceof Error && (error.message.includes('MONGODB') || error.message.includes('connect'))) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    // For other errors, return 500 with error details
    return res.status(500).json({
      success: false,
      reason: 'An error occurred while processing the request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Admin handler - preserves exact functionality from admin.ts
async function handleAdmin(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  const { action } = req.query;
  const { mongoAvailable, mongoFailureReason } = options;

  if (action === 'health') {
    try {
      const hasMongoUri = !!(process.env.MONGODB_URL || process.env.MONGODB_URI);
      
      if (!hasMongoUri) {
        return res.status(200).json({
          success: false,
          message: 'MONGODB_URL or MONGODB_URI environment variable is not configured',
          details: 'Please add MONGODB_URL or MONGODB_URI in Vercel dashboard under Environment Variables',
          checks: [
            { name: 'MongoDB URL/URI Configuration', status: 'FAIL', details: 'MONGODB_URL or MONGODB_URI environment variable not found' }
          ]
        });
      }

      if (!mongoAvailable) {
        return res.status(200).json({
          success: false,
          message: mongoFailureReason || 'Database connection unavailable.',
          details: mongoFailureReason || 'The API is running in fallback mode without MongoDB.',
          checks: [
            { name: 'MongoDB Availability', status: 'FAIL', details: mongoFailureReason || 'Connection failed' }
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
            { name: 'MongoDB URL/URI Configuration', status: 'PASS', details: 'MONGODB_URL or MONGODB_URI is set' },
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
    if (!mongoAvailable) {
      return res.status(503).json({
        success: false,
        message: mongoFailureReason || 'Database unavailable. Cannot seed data.',
        fallback: true
      });
    }
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
      if (error.message.includes('MONGODB_URI') || error.message.includes('MONGODB_URL')) {
        errorMessage += ' - Check MONGODB_URL or MONGODB_URI environment variable in Vercel dashboard';
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
async function handleSeed(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  if (!options.mongoAvailable) {
    return res.status(503).json({
      success: false,
      message: options.mongoFailureReason || 'Database unavailable. Cannot seed data.',
      fallback: true
    });
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
async function handleVehicleData(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  // Ensure JSON content type
  res.setHeader('Content-Type', 'application/json');
  
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

  try {
    if (req.method === 'GET') {
      // Always return default data if mongo is not available
      if (!options.mongoAvailable) {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(defaultData);
      }

      try {
        await connectToDatabase();
        console.log('📡 Connected to database for vehicle-data fetch operation');
        
        let vehicleDataDoc = await VehicleDataModel.findOne();
        if (!vehicleDataDoc) {
          // Create default vehicle data if none exists
          vehicleDataDoc = new VehicleDataModel({ data: defaultData });
          await vehicleDataDoc.save();
        }
        
        return res.status(200).json(vehicleDataDoc.data);
      } catch (dbError) {
        console.warn('⚠️ Database connection failed for vehicle-data, returning default data:', dbError);
        // Return default data as fallback - NEVER return 500
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(defaultData);
      }
    }

    if (req.method === 'POST') {
      // Always return success response, even if mongo is not available
      if (!options.mongoAvailable) {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({
          success: true,
          data: req.body,
          message: 'Vehicle data processed (database unavailable, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }

      try {
        await connectToDatabase();
        console.log('📡 Connected to database for vehicle-data save operation');
        
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
        console.warn('⚠️ Database connection failed for vehicle-data save:', dbError);
        
        // For POST requests, we should still return success but indicate fallback
        // This prevents the sync from failing completely - NEVER return 500
        console.log('📝 Returning success with fallback indication for POST request');
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({
          success: true,
          data: req.body,
          message: 'Vehicle data processed (database unavailable, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Ultimate fallback - catch any unexpected errors
    console.error('⚠️ Unexpected error in handleVehicleData:', error);
    res.setHeader('X-Data-Fallback', 'true');
    if (req.method === 'GET') {
      return res.status(200).json(defaultData);
    } else {
      return res.status(200).json({
        success: true,
        data: req.body || {},
        message: 'Vehicle data processed (error occurred, using fallback)',
        fallback: true,
        timestamp: new Date().toISOString()
      });
    }
  }
}

let cachedFallbackVehicles: any[] | null = null;
let cachedFallbackUsers: any[] | null = null;

async function getFallbackVehicles(): Promise<any[]> {
  if (cachedFallbackVehicles) {
    return cachedFallbackVehicles;
  }

  try {
    const { MOCK_VEHICLES } = await import('../constants.js');
    const vehicles = await MOCK_VEHICLES();
    cachedFallbackVehicles = vehicles;
    return vehicles;
  } catch (error) {
    console.warn('⚠️ Unable to load MOCK_VEHICLES fallback:', error);
  }

  cachedFallbackVehicles = [];
  return cachedFallbackVehicles;
}

async function getFallbackUsers(): Promise<any[]> {
  if (cachedFallbackUsers) {
    return cachedFallbackUsers;
  }

  cachedFallbackUsers = [
    {
      name: 'Demo User',
      email: 'demo@reride.com',
      mobile: '9876543210',
      role: 'customer',
      location: 'Mumbai',
      status: 'active',
      createdAt: new Date().toISOString(),
      subscriptionPlan: 'free',
      isVerified: false
    }
  ];

  return cachedFallbackUsers;
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
async function handleNewCars(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  if (!options.mongoAvailable) {
    return res.status(503).json({
      success: false,
      reason: options.mongoFailureReason || 'Database unavailable. New car catalog requires MongoDB.',
      fallback: true
    });
  }

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
      views: 324,
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
      views: 512,
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

// System handler - consolidates system.ts
async function handleSystem(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const { action } = req.query;
  
  switch (action) {
    case 'health':
      return await handleHealth(req, res);
    case 'test-connection':
      return await handleTestConnection(req, res);
    default:
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid system action. Use ?action=health or ?action=test-connection' 
      });
  }
}

// Test Connection Handler
async function handleTestConnection(_req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🔍 Testing MongoDB connection and collection...');
    
    await connectToDatabase();
    
    return res.status(200).json({
      success: true,
      message: 'MongoDB connection test successful',
      timestamp: new Date().toISOString(),
      details: {
        connection: 'active',
        database: 'reride',
        collections: 'accessible'
      }
    });
  } catch (error) {
    console.error('❌ MongoDB connection test failed:', error);
    
    return res.status(500).json({
      success: false,
      message: 'MongoDB connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      details: {
        connection: 'failed',
        database: 'unreachable',
        collections: 'inaccessible'
      }
    });
  }
}

// Utils handler - consolidates utils.ts
async function handleUtils(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.includes('/test-connection') || pathname.endsWith('/test-connection')) {
    return await handleTestConnection(req, res);
  } else {
    return res.status(404).json({ success: false, reason: 'Utility endpoint not found' });
  }
}

// AI handler - consolidates ai.ts
async function handleAI(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.includes('/gemini') || pathname.endsWith('/gemini')) {
    return await handleGemini(req, res);
  } else {
    return res.status(404).json({ success: false, reason: 'AI endpoint not found' });
  }
}

// Gemini handler
async function handleGemini(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  try {
    const { payload } = req.body;
    
    if (!payload) {
      return res.status(400).json({ 
        success: false, 
        reason: 'Payload is required' 
      });
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: payload.prompt || JSON.stringify(payload)
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || `API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

    return res.status(200).json({
      success: true,
      response: generatedText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    
    return res.status(500).json({
      success: false,
      reason: 'Gemini API call failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Content handler - consolidates content.ts
async function handleContent(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  if (!options.mongoAvailable) {
    return res.status(503).json({
      success: false,
      reason: options.mongoFailureReason || 'Database is currently unavailable'
    });
  }

  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection not available' 
      });
    }
    
    const { type } = req.query;
    
    switch (type) {
      case 'faqs':
        return await handleFAQs(req, res, db);
      case 'support-tickets':
        return await handleSupportTickets(req, res, db);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid content type. Use ?type=faqs or ?type=support-tickets' 
        });
    }
  } catch (error) {
    console.error('Content API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// FAQs Handler
async function handleFAQs(req: VercelRequest, res: VercelResponse, db: any) {
  const collection = db.collection('faqs');

  switch (req.method) {
    case 'GET':
      return await handleGetFAQs(req, res, collection);
    case 'POST':
      return await handleCreateFAQ(req, res, collection);
    case 'PUT':
      return await handleUpdateFAQ(req, res, collection);
    case 'DELETE':
      return await handleDeleteFAQ(req, res, collection);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetFAQs(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { category } = req.query;
    
    let query: any = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }

    const faqs = await collection.find(query).toArray();
    
    return res.status(200).json({
      success: true,
      faqs: faqs,
      count: faqs.length
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch FAQs' 
    });
  }
}

async function handleCreateFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const faqData = req.body;
    
    if (!faqData.question || !faqData.answer || !faqData.category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, answer, category'
      });
    }

    const result = await collection.insertOne({
      ...faqData,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      faq: { ...faqData, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create FAQ'
    });
  }
}

async function handleUpdateFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(id as string);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid FAQ ID format'
      });
    }

    const result = await collection.updateOne(
      { _id: objectId },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'FAQ updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update FAQ'
    });
  }
}

async function handleDeleteFAQ(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(id as string);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid FAQ ID format'
      });
    }

    const result = await collection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ'
    });
  }
}

// Support Tickets Handler
async function handleSupportTickets(req: VercelRequest, res: VercelResponse, db: any) {
  const collection = db.collection('supportTickets');

  switch (req.method) {
    case 'GET':
      return await handleGetSupportTickets(req, res, collection);
    case 'POST':
      return await handleCreateSupportTicket(req, res, collection);
    case 'PUT':
      return await handleUpdateSupportTicket(req, res, collection);
    case 'DELETE':
      return await handleDeleteSupportTicket(req, res, collection);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetSupportTickets(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { userEmail, status } = req.query;
    
    let query: any = {};
    
    if (userEmail) {
      query.userEmail = userEmail;
    }
    
    if (status) {
      query.status = status;
    }

    const tickets = await collection.find(query).sort({ createdAt: -1 }).toArray();
    
    return res.status(200).json({
      success: true,
      tickets: tickets,
      count: tickets.length
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch support tickets' 
    });
  }
}

async function handleCreateSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const ticketData = req.body;
    
    if (!ticketData.userEmail || !ticketData.userName || !ticketData.subject || !ticketData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userEmail, userName, subject, message'
      });
    }

    const result = await collection.insertOne({
      ...ticketData,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: []
    });

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket: { ...ticketData, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
}

async function handleUpdateSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(id as string);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid support ticket ID format'
      });
    }

    const result = await collection.updateOne(
      { _id: objectId },
      { $set: { ...updateData, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Support ticket updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update support ticket'
    });
  }
}

async function handleDeleteSupportTicket(req: VercelRequest, res: VercelResponse, collection: any) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(id as string);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid support ticket ID format'
      });
    }

    const result = await collection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Support ticket deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete support ticket'
    });
  }
}

// Sell Car handler - consolidates sell-car/index.ts
async function handleSellCar(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  if (!options.mongoAvailable) {
    return res.status(503).json({
      success: false,
      reason: options.mongoFailureReason || 'Database is currently unavailable'
    });
  }

  const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const DB_NAME = process.env.DB_NAME || 'reride';

  let cachedClient: MongoClient | null = null;
  let cachedDb: any = null;

  async function connectToDatabaseSellCar() {
    if (cachedClient && cachedDb) {
      try {
        await cachedDb.admin().ping();
        return { client: cachedClient, db: cachedDb };
      } catch (error) {
        cachedClient = null;
        cachedDb = null;
      }
    }

    try {
      if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
        throw new Error('MONGODB_URL or MONGODB_URI environment variable is not set');
      }

      // Normalize the URI to ensure correct database name
      const normalizedUri = ensureDatabaseInUri(MONGODB_URI, DB_NAME);
      console.log(`🔗 Connecting to MongoDB with normalized URI (database: ${DB_NAME})`);

      const client = new MongoClient(normalizedUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      
      await client.connect();
      const db = client.db(DB_NAME);
      
      cachedClient = client;
      cachedDb = db;
      
      console.log(`✅ MongoDB client connected to database: ${db.databaseName}`);
      
      return { client, db };
    } catch (error) {
      cachedClient = null;
      cachedDb = null;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ MongoDB client connection failed: ${errorMessage}`);
      throw new Error(`Database connection failed: ${errorMessage}`);
    }
  }

  const { method } = req;

  try {
    const { db } = await connectToDatabaseSellCar();
    const collection = db.collection('sellCarSubmissions');

    switch (method) {
      case 'POST':
        const submissionData = {
          ...req.body,
          submittedAt: new Date().toISOString(),
          status: 'pending'
        };

        const requiredFields = [
          'registration', 'make', 'model', 'variant', 'year', 
          'district', 'noOfOwners', 'kilometers', 'fuelType', 
          'transmission', 'customerContact'
        ];

        const missingFields: string[] = [];
        for (const field of requiredFields) {
          if (!submissionData[field as keyof typeof submissionData]) {
            missingFields.push(field);
          }
        }

        if (missingFields.length > 0) {
          return res.status(400).json({ 
            error: `Missing required fields: ${missingFields.join(', ')}` 
          });
        }

        const existingSubmission = await collection.findOne({
          registration: submissionData.registration
        });

        if (existingSubmission) {
          return res.status(409).json({ 
            error: 'Car with this registration number already submitted' 
          });
        }

        const result = await collection.insertOne(submissionData as any);
        
        res.status(201).json({
          success: true,
          id: result.insertedId.toString(),
          message: 'Car submission received successfully'
        });
        break;

      case 'GET':
        const { page = 1, limit = 10, status: statusFilter, search } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        let filter: any = {};
        
        if (statusFilter) {
          filter.status = statusFilter;
        }
        
        if (search) {
          filter.$or = [
            { registration: { $regex: search, $options: 'i' } },
            { make: { $regex: search, $options: 'i' } },
            { model: { $regex: search, $options: 'i' } },
            { customerContact: { $regex: search, $options: 'i' } }
          ];
        }

        const submissions = await collection
          .find(filter)
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .toArray();

        const total = await collection.countDocuments(filter);

        res.status(200).json({
          success: true,
          data: submissions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        });
        break;

      case 'PUT':
        const { id, status: updateStatus, adminNotes, estimatedPrice } = req.body;
        
        if (!id) {
          return res.status(400).json({ error: 'Submission ID is required' });
        }

        let objectId;
        try {
          objectId = new ObjectId(id);
        } catch (error) {
          return res.status(400).json({ error: 'Invalid submission ID format' });
        }

        const updateData: any = {};
        if (updateStatus) updateData.status = updateStatus;
        if (adminNotes) updateData.adminNotes = adminNotes;
        if (estimatedPrice) updateData.estimatedPrice = estimatedPrice;
        updateData.updatedAt = new Date().toISOString();

        const updateResult = await collection.updateOne(
          { _id: objectId },
          { $set: updateData }
        );

        if (updateResult.matchedCount === 0) {
          return res.status(404).json({ error: 'Submission not found' });
        }

        res.status(200).json({
          success: true,
          message: 'Submission updated successfully'
        });
        break;

      case 'DELETE':
        const { id: deleteId } = req.query;
        
        if (!deleteId) {
          return res.status(400).json({ error: 'Submission ID is required' });
        }

        let deleteObjectId;
        try {
          deleteObjectId = new ObjectId(deleteId as string);
        } catch (error) {
          return res.status(400).json({ error: 'Invalid submission ID format' });
        }

        const deleteResult = await collection.deleteOne({ _id: deleteObjectId });
        
        if (deleteResult.deletedCount === 0) {
          return res.status(404).json({ error: 'Submission not found' });
        }

        res.status(200).json({
          success: true,
          message: 'Submission deleted successfully'
        });
        break;

      default:
        res.setHeader('Allow', 'POST, GET, PUT, DELETE');
        res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('❌ Sell Car API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage
    });
  }
}

// Business handler - consolidates business.ts (payments and plans)
async function handleBusiness(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname || '';
    
    // Preferred: explicit query (?type=payments|plans)
    let type = (req.query.type as string) || '';
    
    // Backward/alternate compatibility: infer from path
    if (!type) {
      if (pathname.includes('/payments')) {
        type = 'payments';
      } else if (pathname.includes('/plans')) {
        type = 'plans';
      }
    }
    
    switch (type) {
      case 'payments':
        return await handlePayments(req, res, options);
      case 'plans':
        return await handlePlans(req, res, options);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid business type. Use ?type=payments or ?type=plans' 
        });
    }
  } catch (error) {
    console.error('Business API Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Payments Handler
async function handlePayments(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    if (!options.mongoAvailable) {
      return res.status(503).json({
        success: false,
        reason: options.mongoFailureReason || 'Database is currently unavailable'
      });
    }

    await connectToDatabase();

    const { action } = req.query;

    if (action === 'create') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { sellerEmail, amount, plan, packageId } = req.body;
        
        if (!sellerEmail || !amount || !plan) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email, amount, and plan are required' 
          });
        }

        // Create payment request (simplified for demo)
        const paymentRequest = {
          id: Date.now(),
          sellerEmail,
          amount,
          plan,
          packageId,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        return res.status(201).json({
          success: true,
          paymentRequest,
          message: 'Payment request created successfully'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to create payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'status') {
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { sellerEmail } = req.query;
        
        if (!sellerEmail) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email is required' 
          });
        }

        // Get payment status (simplified for demo)
        const paymentStatus = {
          sellerEmail: sellerEmail as string,
          status: 'pending',
          lastPayment: null,
          nextDue: null
        };

        return res.status(200).json({
          success: true,
          paymentStatus
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment status',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'approve') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { paymentRequestId } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        // Approve payment (simplified for demo)
        return res.status(200).json({
          success: true,
          message: 'Payment request approved successfully',
          paymentRequestId
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to approve payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'reject') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { paymentRequestId, reason } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        // Reject payment (simplified for demo)
        return res.status(200).json({
          success: true,
          message: 'Payment request rejected',
          paymentRequestId,
          reason: reason || 'No reason provided'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to reject payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Get all payment requests
    if (req.method === 'GET') {
      try {
        // Return empty array for demo (in real implementation, fetch from database)
        const paymentRequests: any[] = [];
        
        return res.status(200).json({
          success: true,
          paymentRequests
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment requests',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Handle invalid or missing action parameter
    if (!action) {
      return res.status(400).json({ 
        success: false, 
        reason: 'Action parameter is required. Valid actions: create, status, approve, reject' 
      });
    }

    // If action doesn't match any known action, return 400 instead of 500
    return res.status(400).json({ 
      success: false, 
      reason: `Invalid payment action: ${action}. Valid actions: create, status, approve, reject` 
    });
  } catch (error) {
    console.error('Payments Handler Error:', error);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // If it's a database connection error, return 503
    if (error instanceof Error && (error.message.includes('MONGODB') || error.message.includes('connect'))) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Payments handler failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Plans Handler
async function handlePlans(req: VercelRequest, res: VercelResponse, options: HandlerOptions) {
  try {
    if (!options.mongoAvailable) {
      return res.status(503).json({
        success: false,
        reason: options.mongoFailureReason || 'Database is currently unavailable'
      });
    }

    switch (req.method) {
      case 'GET':
        // Get all plans
        const plans = await planService.getAllPlans();
        return res.status(200).json(plans);

      case 'POST':
        // Create new plan
        const newPlanData = req.body;
        if (!newPlanData || !newPlanData.name) {
          return res.status(400).json({ error: 'Plan name is required' });
        }
        
        const planId = planService.createPlan(newPlanData);
        const createdPlan = planService.getCustomPlanDetails(planId);
        
        return res.status(201).json(createdPlan);

      case 'PUT':
        // Update existing plan
        const { planId: updatePlanId, ...updateData } = req.body;
        if (!updatePlanId) {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        
        planService.updatePlan(updatePlanId, updateData);
        const updatedPlan = await planService.getPlanDetails(updatePlanId as any);
        
        return res.status(200).json(updatedPlan);

      case 'DELETE':
        // Delete plan
        const { planId: deletePlanId } = req.query;
        if (!deletePlanId || typeof deletePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        
        const deleted = await planService.deletePlan(deletePlanId);
        if (!deleted) {
          return res.status(400).json({ error: 'Cannot delete base plans' });
        }
        
        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Plans Handler Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


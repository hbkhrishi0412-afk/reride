import type { VercelRequest, VercelResponse } from '@vercel/node';
import connectToDatabase from '../lib/db.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import VehicleDataModel from '../models/VehicleData.js';
import NewCar from '../models/NewCar.js';
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
    try {
      await connectToDatabase();
    } catch (dbError) {
      console.warn('Database connection failed, using fallback data:', dbError);
      // Return consistent error response for all methods
      return res.status(503).json({ 
        success: false, 
        reason: 'Database temporarily unavailable. Please try again later.',
        fallback: true,
        data: req.method === 'GET' ? [] : null
      });
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

      const existingUser = await User.findOne({ email: sanitizedData.email });
      if (existingUser) {
        return res.status(400).json({ success: false, reason: 'User already exists.' });
      }

      // Hash password before storing
      const hashedPassword = await hashPassword(sanitizedData.password);

      // Generate unique ID to avoid collisions
      const userId = Date.now() + Math.floor(Math.random() * 1000);

      const newUser = new User({
        id: userId,
        email: sanitizedData.email,
        password: hashedPassword, // Store hashed password
        name: sanitizedData.name,
        mobile: sanitizedData.mobile,
        role: sanitizedData.role,
        status: 'active',
        isVerified: false,
        plan: 'basic',
        featuredCredits: 0,
        createdAt: new Date().toISOString()
      });

      await newUser.save();
      
      // Generate JWT tokens for new user
      const accessToken = generateAccessToken(newUser);
      const refreshToken = generateRefreshToken(newUser);
      
      const { password: _, ...userWithoutPassword } = newUser.toObject();
      return res.status(201).json({ 
        success: true, 
        user: userWithoutPassword,
        accessToken,
        refreshToken
      });
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
    const { email, ...updateData } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, reason: 'Email is required for update.' });
    }

    // Separate null values (to be unset) from regular updates
    const updateFields: any = {};
    const unsetFields: any = {};
    
    Object.keys(updateData).forEach(key => {
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

    const updatedUser = await User.findOneAndUpdate(
      { email },
      updateOperation,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, reason: 'User not found.' });
    }

    return res.status(200).json({ success: true, user: updatedUser });
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
    
    // Migration: Set expiry dates for existing vehicles without listingExpiresAt
    const now = new Date();
    for (const vehicle of vehicles) {
      // If vehicle is published but has no expiry date, migrate it
      if (!vehicle.listingExpiresAt && vehicle.status === 'published') {
        const seller = await User.findOne({ email: vehicle.sellerEmail });
        if (seller) {
          if (seller.subscriptionPlan === 'premium' && seller.planExpiryDate) {
            // Premium plan: use plan expiry date
            vehicle.listingExpiresAt = seller.planExpiryDate;
            await vehicle.save();
          } else if (seller.subscriptionPlan !== 'premium') {
            // Free and Pro plans get 30-day expiry from today
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            vehicle.listingExpiresAt = expiryDate.toISOString();
            await vehicle.save();
          }
        }
      }
      
      // Auto-disable expired listings
      if (vehicle.listingExpiresAt && vehicle.status === 'published') {
        const expiryDate = new Date(vehicle.listingExpiresAt);
        if (expiryDate < now) {
          vehicle.status = 'unpublished';
          vehicle.listingStatus = 'expired';
          await vehicle.save();
        }
      }
    }
    
    // Return vehicles after checking expiry
    return res.status(200).json(vehicles);
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
      const { vehicleId } = req.body;
      const vehicle = await Vehicle.findOne({ id: vehicleId });
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      vehicle.certificationStatus = 'requested';
      vehicle.certificationRequestedAt = new Date().toISOString();
      
      await vehicle.save();
      return res.status(200).json({ success: true, vehicle });
    }

    if (action === 'feature') {
      const { vehicleId } = req.body;
      const vehicle = await Vehicle.findOne({ id: vehicleId });
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      vehicle.isFeatured = true;
      vehicle.featuredAt = new Date().toISOString();
      
      await vehicle.save();
      return res.status(200).json({ success: true, vehicle });
    }

    if (action === 'sold') {
      const { vehicleId } = req.body;
      const vehicle = await Vehicle.findOne({ id: vehicleId });
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      vehicle.status = 'sold';
      vehicle.listingStatus = 'sold';
      vehicle.soldAt = new Date().toISOString();
      
      await vehicle.save();
      return res.status(200).json({ success: true, vehicle });
    }

    if (action === 'unsold') {
      const { vehicleId } = req.body;
      const vehicle = await Vehicle.findOne({ id: vehicleId });
      
      if (!vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }
      
      vehicle.status = 'published';
      vehicle.listingStatus = 'active';
      vehicle.soldAt = undefined;
      
      await vehicle.save();
      return res.status(200).json({ success: true, vehicle });
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
    
    return res.status(200).json(updatedVehicle);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, reason: 'Vehicle ID is required for deletion.' });
    }
    
    const deletedVehicle = await Vehicle.findOneAndDelete({ id });
    if (!deletedVehicle) {
      return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
    }
    
    return res.status(200).json({ success: true, message: 'Vehicle deleted successfully.' });
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
  
  if (user.isVerified) score += 20;
  if (user.plan === 'premium') score += 15;
  if (user.plan === 'pro') score += 10;
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

import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import connectToDatabase, { MongoConfigError } from '../lib/db';
import User from '../models/User';
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

// Helper function to calculate trust score (if needed)
function calculateTrustScore(user: any): number {
  // Simple trust score calculation
  let score = 0;
  if (user.isVerified) score += 20;
  if (user.emailVerified) score += 10;
  if (user.phoneVerified) score += 10;
  if (user.govtIdVerified) score += 20;
  if (user.soldListings) score += Math.min(user.soldListings, 40);
  return Math.min(score, 100);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set security headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Set CORS headers
  const config = getSecurityConfig();
  const origin = req.headers.origin;
  if (config.CORS.ALLOWED_ORIGINS.includes(origin as string)) {
    res.setHeader('Access-Control-Allow-Origin', origin as string);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', config.CORS.ALLOWED_HEADERS.join(', '));
  res.setHeader('Access-Control-Allow-Credentials', config.CORS.CREDENTIALS.toString());
  res.setHeader('Access-Control-Max-Age', config.CORS.MAX_AGE.toString());
  
  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ensure database connection for all requests
    await connectToDatabase();
    
    // Ensure mongoose connection is ready
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ MongoDB connection not ready, reconnecting...');
      await connectToDatabase();
    }
    
    // Verify connection is actually ready
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection failed - readyState is not 1');
    }
    
    console.log('✅ Database connection verified, readyState:', mongoose.connection.readyState);
  } catch (dbError) {
    console.error('❌ Database connection failed:', dbError);
    const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
    
    // Return error for all methods that require database access
    if (req.method === 'GET') {
      if (dbError instanceof MongoConfigError) {
        return res.status(503).json({
          success: false,
          reason: 'MongoDB is not configured. Set MONGODB_URI in your environment.',
          data: []
        });
      }
      return res.status(503).json({ 
        success: false, 
        reason: 'Database temporarily unavailable. Please try again later.',
        data: []
      });
    }
    
    // For PUT/POST/DELETE, return error immediately
    if (dbError instanceof MongoConfigError) {
      return res.status(503).json({
        success: false,
        reason: 'MongoDB is not configured. Please set MONGODB_URI in Vercel or your environment.',
      });
    }
    
    return res.status(503).json({ 
      success: false, 
      reason: 'Database connection failed. Please check MONGODB_URI environment variable in Vercel.',
      error: errorMessage
    });
  }

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
      
      // Ensure user has a password set (OAuth users may not)
      if (!user.password || typeof user.password !== 'string') {
        return res.status(400).json({ 
          success: false, 
          reason: 'Password login is not available for this account. Please use your original sign-in method.' 
        });
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
        if (dbError instanceof MongoConfigError) {
          return res.status(503).json({
            success: false,
            reason: 'MongoDB is not configured. Set MONGODB_URI before registering users.'
          });
        }
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
          password: hashedPassword,
          name: sanitizedData.name,
          mobile: sanitizedData.mobile,
          role: sanitizedData.role,
          status: 'active',
          isVerified: false,
          subscriptionPlan: 'free',
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
        
        // Check for duplicate key error
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
          subscriptionPlan: 'free',
          featuredCredits: 0,
          createdAt: new Date().toISOString()
        });
        await user.save();
      }

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

  // PUT - Update user (including password updates)
  if (req.method === 'PUT') {
    try {
      // Connection should already be established in the initial try-catch above
      // But verify it's still connected
      if (mongoose.connection.readyState !== 1) {
        console.warn('⚠️ Connection lost, reconnecting for PUT request...');
        await connectToDatabase();
        
        if (mongoose.connection.readyState !== 1) {
          throw new Error('Failed to establish MongoDB connection for user update');
        }
      }
      
      console.log('✅ Database connected for user update, readyState:', mongoose.connection.readyState);
      
      const { email, ...updateData } = req.body;
      
      if (!email) {
        return res.status(400).json({ success: false, reason: 'Email is required for update.' });
      }

      console.log('🔄 PUT /api/users - Updating user:', { email, hasPassword: !!updateData.password, fields: Object.keys(updateData) });

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
          const isAlreadyHashed = updateData.password.startsWith('$2');
          
          if (isAlreadyHashed) {
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
      let existingUser;
      try {
        existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      } catch (findError) {
        console.error('❌ Error finding user:', findError);
        const errorMessage = findError instanceof Error ? findError.message : 'Unknown error';
        return res.status(500).json({ 
          success: false, 
          reason: 'Database query failed. Please check MongoDB connection.',
          error: errorMessage
        });
      }
      
      if (!existingUser) {
        console.warn('⚠️ User not found:', email);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      console.log('📝 Found user, applying update operation...');
      
      let updatedUser;
      try {
        updatedUser = await User.findOneAndUpdate(
          { email: email.toLowerCase().trim() },
          updateOperation,
          { new: true, runValidators: true }
        );
      } catch (updateError) {
        console.error('❌ Error updating user:', updateError);
        const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
        const errorStack = updateError instanceof Error ? updateError.stack : undefined;
        console.error('Update error details:', { message: errorMessage, stack: errorStack });
        
        // Check for validation errors
        if (updateError instanceof Error && updateError.name === 'ValidationError') {
          return res.status(400).json({ 
            success: false, 
            reason: 'Validation failed. Please check your input data.',
            error: errorMessage
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to update user in database. Please check MongoDB connection and try again.',
          error: errorMessage
        });
      }

      if (!updatedUser) {
        console.error('❌ Failed to update user after findOneAndUpdate');
        return res.status(500).json({ success: false, reason: 'Failed to update user.' });
      }

      // Explicitly save the document to ensure password is persisted
      if (updateFields.password) {
        try {
          console.log('💾 Explicitly saving user document to ensure password persistence...');
          await updatedUser.save();
          console.log('✅ User document saved successfully');
        } catch (saveError) {
          console.error('❌ Error saving user document:', saveError);
          const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error';
          // Even if save fails, the findOneAndUpdate might have succeeded
          // So we'll still return success but log the error
          console.warn('⚠️ Save failed but update may have succeeded:', errorMessage);
        }
      }

      console.log('✅ User updated successfully:', updatedUser.email);
      console.log('✅ Password updated:', !!updateFields.password);

      // Verify the update actually saved by checking the user again
      if (updateFields.password) {
        try {
          const verifyUser = await User.findOne({ email: email.toLowerCase().trim() });
          if (verifyUser && verifyUser.password) {
            console.log('✅ Password update verified in database');
            // Verify it's different from the old password
            if (verifyUser.password !== existingUser.password) {
              console.log('✅ Password hash changed, update confirmed');
            } else {
              console.warn('⚠️ Password hash unchanged - update may not have worked');
            }
          } else {
            console.error('❌ Password update verification failed - password not found in database');
          }
        } catch (verifyError) {
          console.error('❌ Error verifying password update:', verifyError);
          // Don't fail the request if verification fails
        }
      }

      // Remove password from response for security
      const { password: _, ...userWithoutPassword } = updatedUser.toObject();
      return res.status(200).json({ success: true, user: userWithoutPassword });
    } catch (dbError) {
      console.error('❌ Database error during user update:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      const errorStack = dbError instanceof Error ? dbError.stack : undefined;
      
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

    const deletedUser = await User.findOneAndDelete({ email: email.toLowerCase().trim() });
    if (!deletedUser) {
      return res.status(404).json({ success: false, reason: 'User not found.' });
    }

    return res.status(200).json({ success: true, message: 'User deleted successfully.' });
  }

  return res.status(405).json({ success: false, reason: 'Method not allowed.' });
}


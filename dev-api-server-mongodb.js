// Development API server with MongoDB integration
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { hashPassword, validatePassword, generateAccessToken, generateRefreshToken, sanitizeObject, validateUserInput } from './utils/security.js';

dotenv.config();

const app = express();
const PORT = 3001;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not defined. Set it in your .env file or shell before starting dev-api-server-mongodb.');
}

// Enable CORS for all routes
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
async function connectToDatabase() {
    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not configured');
        }

        await mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4,
            dbName: 'reride'
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }
}

// Vehicle schema
const vehicleSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true, index: true },
    category: { type: String, required: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    variant: String,
    year: { type: Number, required: true },
    price: { type: Number, required: true },
    mileage: { type: Number, required: true },
    images: [String],
    features: [String],
    description: String,
    sellerEmail: { type: String, required: true },
    sellerName: String,
    engine: String,
    transmission: String,
    fuelType: String,
    fuelEfficiency: String,
    color: String,
    status: { type: String, default: 'published' },
    isFeatured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    inquiriesCount: { type: Number, default: 0 },
    city: { type: String, index: true },
    state: { type: String, index: true },
    location: String,
    // Certification fields
    certificationStatus: { type: String, enum: ['none', 'requested', 'approved', 'rejected', 'certified'], default: 'none' },
    certificationRequestedAt: Date,
    // Listing lifecycle fields
    listingExpiresAt: Date,
    listingLastRefreshed: Date,
    listingRenewalCount: { type: Number, default: 0 },
    listingStatus: { type: String, enum: ['active', 'expired', 'sold', 'suspended', 'draft'], default: 'active' },
    // Sold fields
    soldAt: Date,
    // Featured fields
    featuredAt: Date,
    // Boost fields
    activeBoosts: [{ type: mongoose.Schema.Types.Mixed }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);

// User schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    mobile: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, default: 'active' },
    avatarUrl: String,
    isVerified: { type: Boolean, default: false },
    dealershipName: String,
    bio: String,
    logoUrl: String,
    subscriptionPlan: { type: String, default: 'free' },
    featuredCredits: { type: Number, default: 0 },
    usedCertifications: { type: Number, default: 0 },
    createdAt: String
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// FAQ schema
const faqSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'General' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const FAQ = mongoose.models.FAQ || mongoose.model('FAQ', faqSchema);

// Support Ticket schema
const supportTicketSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true, index: true },
    userEmail: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Closed'], default: 'Open', index: true },
    replies: [{
        author: { type: String, required: true },
        message: { type: String, required: true },
        timestamp: { type: String, required: true }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);

// Audit Log schema
const auditLogSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true, index: true },
    timestamp: { type: String, required: true, index: true },
    actor: { type: String, required: true, index: true }, // email of the admin
    action: { type: String, required: true },
    target: { type: String, required: true }, // e.g., user email or vehicle ID
    details: String,
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: false // We use timestamp field instead
});

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

// Vehicles API endpoint
app.get('/api/vehicles', async (req, res) => {
    try {
        const { id } = req.query;
        
        // Get single vehicle by ID
        if (id) {
            console.log(`🚗 GET /api/vehicles?id=${id} - Fetching single vehicle from MongoDB`);
            const vehicle = await Vehicle.findOne({ id: Number(id) });
            
            if (!vehicle) {
                return res.status(404).json({ error: 'Vehicle not found' });
            }
            
            console.log('✅ Found vehicle:', id);
            return res.json(vehicle);
        }
        
        // Get all vehicles
        console.log('🚗 GET /api/vehicles - Fetching vehicles from MongoDB');
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
                        vehicle.listingExpiresAt = new Date(seller.planExpiryDate);
                        await vehicle.save();
                    } else if (seller.subscriptionPlan !== 'premium') {
                        // Free and Pro plans get 30-day expiry from today
                        const expiryDate = new Date();
                        expiryDate.setDate(expiryDate.getDate() + 30);
                        vehicle.listingExpiresAt = expiryDate;
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
        
        console.log(`✅ Found ${vehicles.length} vehicles`);
        res.json(vehicles);
    } catch (error) {
        console.error('❌ Error fetching vehicles:', error.message);
        res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
});

app.post('/api/vehicles', async (req, res) => {
    try {
        // Support both query parameter and body for action
        const action = req.query.action || req.body.action;
        const { vehicleId, refreshAction, sellerEmail, id, packageId } = req.body;
        
        // Handle different actions
        if (action === 'refresh') {
            console.log('🔄 POST /api/vehicles - Refresh/Renew action');
            console.log('Request body:', { action, vehicleId, refreshAction, sellerEmail });
            
            const vehicle = await Vehicle.findOne({ id: vehicleId });
            
            if (!vehicle) {
                console.log('❌ Vehicle not found:', vehicleId);
                return res.status(404).json({ success: false, reason: 'Vehicle not found' });
            }
            
            if (vehicle.sellerEmail !== sellerEmail) {
                console.log('❌ Unauthorized access:', { vehicleEmail: vehicle.sellerEmail, requestEmail: sellerEmail });
                return res.status(403).json({ success: false, reason: 'Unauthorized' });
            }
            
            if (refreshAction === 'refresh') {
                vehicle.views = 0;
                vehicle.inquiriesCount = 0;
                vehicle.listingLastRefreshed = new Date();
                console.log('✅ Vehicle refreshed');
            } else if (refreshAction === 'renew') {
                vehicle.listingExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                vehicle.listingRenewalCount = (vehicle.listingRenewalCount || 0) + 1;
                console.log('✅ Vehicle renewed');
            }
            
            await vehicle.save();
            return res.status(200).json({ success: true, vehicle });
        }
        
        if (action === 'certify') {
            console.log('🛡️ POST /api/vehicles - Certification request');
            const vehicle = await Vehicle.findOne({ id: vehicleId });
            
            if (!vehicle) {
                return res.status(404).json({ success: false, reason: 'Vehicle not found' });
            }
            
            vehicle.certificationStatus = 'requested';
            vehicle.certificationRequestedAt = new Date();
            
            await vehicle.save();
            return res.status(200).json({ success: true, vehicle });
        }
        
        if (action === 'sold') {
            console.log('✅ POST /api/vehicles - Mark as sold');
            const vehicle = await Vehicle.findOne({ id: vehicleId });
            
            if (!vehicle) {
                return res.status(404).json({ success: false, reason: 'Vehicle not found' });
            }
            
            vehicle.status = 'sold';
            vehicle.soldAt = new Date();
            vehicle.listingStatus = 'sold';
            
            await vehicle.save();
            return res.status(200).json({ success: true, vehicle });
        }
        
        if (action === 'unsold') {
            console.log('✅ POST /api/vehicles - Mark as unsold');
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
        
        if (action === 'feature') {
            console.log('⭐ POST /api/vehicles - Feature listing');
            const vehicle = await Vehicle.findOne({ id: vehicleId });
            
            if (!vehicle) {
                return res.status(404).json({ success: false, reason: 'Vehicle not found' });
            }
            
            vehicle.isFeatured = true;
            vehicle.featuredAt = new Date();
            
            await vehicle.save();
            return res.status(200).json({ success: true, vehicle });
        }
        
        if (action === 'boost') {
            console.log('🚀 POST /api/vehicles - Boost listing');
            const vehicle = await Vehicle.findOne({ id: vehicleId });
            
            if (!vehicle) {
                return res.status(404).json({ success: false, reason: 'Vehicle not found' });
            }
            
            // Extract type and duration from packageId
            let boostType = 'top_search';
            let boostDuration = 7;
            
            if (packageId) {
                const parts = packageId.split('_');
                if (parts.length >= 2) {
                    const lastPart = parts[parts.length - 1];
                    const isLastPartNumber = !isNaN(Number(lastPart));
                    
                    if (isLastPartNumber) {
                        boostType = parts.slice(0, -1).join('_');
                        boostDuration = Number(lastPart);
                    } else {
                        boostType = parts.join('_');
                        boostDuration = 7;
                    }
                }
            }
            
            const boostInfo = {
                id: `boost_${Date.now()}`,
                vehicleId: vehicleId,
                packageId: packageId || 'standard',
                type: boostType,
                startDate: new Date(),
                expiresAt: new Date(Date.now() + boostDuration * 24 * 60 * 60 * 1000),
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
        
        // Default: Create new vehicle
        console.log('🚗 POST /api/vehicles - Creating new vehicle');
        // Set listingExpiresAt based on seller's plan expiry date
        let listingExpiresAt = undefined;
        if (req.body.sellerEmail) {
            const seller = await User.findOne({ email: req.body.sellerEmail });
            if (seller) {
                if (seller.subscriptionPlan === 'premium' && seller.planExpiryDate) {
                    // Premium plan: use plan expiry date
                    listingExpiresAt = new Date(seller.planExpiryDate);
                } else if (seller.subscriptionPlan !== 'premium') {
                    // Free and Pro plans get 30-day expiry from today
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + 30);
                    listingExpiresAt = expiryDate;
                }
                // If Premium without planExpiryDate, listingExpiresAt remains undefined (no expiry)
            }
        }
        
        const vehicle = new Vehicle({
            ...req.body,
            listingExpiresAt
        });
        await vehicle.save();
        res.status(201).json(vehicle);
        
    } catch (error) {
        console.error('❌ Error in vehicles POST:', error.message);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

app.put('/api/vehicles', async (req, res) => {
    try {
        console.log('🚗 PUT /api/vehicles - Updating vehicle');
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'Vehicle ID is required' });
        }
        
        const vehicle = await Vehicle.findOneAndUpdate({ id: Number(id) }, req.body, { new: true });
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        
        res.json(vehicle);
    } catch (error) {
        console.error('❌ Error updating vehicle:', error.message);
        res.status(500).json({ error: 'Failed to update vehicle' });
    }
});

app.delete('/api/vehicles', async (req, res) => {
    try {
        console.log('🚗 DELETE /api/vehicles - Deleting vehicle');
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'Vehicle ID is required' });
        }
        
        const deletedVehicle = await Vehicle.findOneAndDelete({ id: Number(id) });
        
        if (!deletedVehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        
        res.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting vehicle:', error.message);
        res.status(500).json({ error: 'Failed to delete vehicle' });
    }
});

// Users API endpoint
app.get('/api/users', async (req, res) => {
    try {
        const { email, id } = req.query;
        
        // Get single user by email
        if (email) {
            console.log(`👥 GET /api/users?email=${email} - Fetching single user from MongoDB`);
            const normalizedEmail = email.toLowerCase().trim();
            const user = await User.findOne({ email: normalizedEmail });
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Return user without password
            const userObj = user.toObject();
            delete userObj.password;
            userObj.id = userObj._id?.toString() || userObj.id;
            
            console.log('✅ Found user:', normalizedEmail);
            return res.json(userObj);
        }
        
        // Get single user by MongoDB _id
        if (id) {
            console.log(`👥 GET /api/users?id=${id} - Fetching single user from MongoDB`);
            const user = await User.findById(id);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Return user without password
            const userObj = user.toObject();
            delete userObj.password;
            userObj.id = userObj._id?.toString() || userObj.id;
            
            console.log('✅ Found user:', id);
            return res.json(userObj);
        }
        
        // Get all users
        console.log('👥 GET /api/users - Fetching users from MongoDB');
        const users = await User.find({});
        
        // Remove passwords from all users
        const usersWithoutPasswords = users.map(user => {
            const userObj = user.toObject();
            delete userObj.password;
            userObj.id = userObj._id?.toString() || userObj.id;
            return userObj;
        });
        
        console.log(`✅ Found ${users.length} users`);
        res.json(usersWithoutPasswords);
    } catch (error) {
        console.error('❌ Error fetching users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const { action } = req.body;
        
        // LOGIN
        if (action === 'login') {
            const { email, password, role } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ success: false, reason: 'Email and password are required.' });
            }
            
            const normalizedEmail = email.toLowerCase().trim();
            const user = await User.findOne({ email: normalizedEmail });
            
            if (!user) {
                return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
            }
            
            // Validate password
            const isPasswordValid = await validatePassword(password, user.password || '');
            if (!isPasswordValid) {
                return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
            }
            
            // Check role if provided
            if (role && user.role !== role) {
                return res.status(403).json({ success: false, reason: `User is not a registered ${role}.` });
            }
            
            // Generate tokens
            const accessToken = generateAccessToken(user.toObject());
            const refreshToken = generateRefreshToken(user.toObject());
            
            // Return user without password
            const userObj = user.toObject();
            delete userObj.password;
            userObj.id = userObj._id?.toString() || userObj.id;
            
            return res.json({
                success: true,
                user: userObj,
                accessToken,
                refreshToken
            });
        }
        
        // REGISTER
        if (action === 'register') {
            const { email, password, name, mobile, role } = req.body;
            
            if (!email || !password || !name || !mobile || !role) {
                return res.status(400).json({ success: false, reason: 'All fields are required.' });
            }
            
            // Sanitize and validate input
            const sanitizedData = await sanitizeObject({ email, password, name, mobile, role });
            const validation = await validateUserInput(sanitizedData);
            
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    reason: 'Validation failed',
                    errors: validation.errors
                });
            }
            
            const normalizedEmail = sanitizedData.email.toLowerCase().trim();
            
            // Check if user already exists
            const existingUser = await User.findOne({ email: normalizedEmail });
            if (existingUser) {
                return res.status(400).json({ success: false, reason: 'User already exists.' });
            }
            
            // Hash password
            const hashedPassword = await hashPassword(sanitizedData.password);
            
            // Generate unique ID
            const userId = Date.now() + Math.floor(Math.random() * 1000);
            
            // Create new user
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
            
            // Verify the user was saved
            const verifyUser = await User.findOne({ email: normalizedEmail });
            if (!verifyUser) {
                console.error('❌ User registration verification failed - user not found after save');
                return res.status(500).json({
                    success: false,
                    reason: 'User registration failed - user was not saved to database. Please try again.'
                });
            }
            
            // Generate tokens
            const accessToken = generateAccessToken(newUser.toObject());
            const refreshToken = generateRefreshToken(newUser.toObject());
            
            // Return user without password
            const userObj = newUser.toObject();
            delete userObj.password;
            userObj.id = userObj._id?.toString() || userObj.id;
            
            console.log('✅ Registration complete. User ID:', newUser._id);
            return res.status(201).json({
                success: true,
                user: userObj,
                accessToken,
                refreshToken
            });
        }
        
        // OAUTH LOGIN
        if (action === 'oauth-login') {
            const { firebaseUid, email, name, mobile, role, avatarUrl, authProvider } = req.body;
            
            if (!firebaseUid || !email || !role) {
                return res.status(400).json({ success: false, reason: 'Firebase UID, email, and role are required.' });
            }
            
            const normalizedEmail = email.toLowerCase().trim();
            
            // Check if user exists by firebaseUid or email
            let user = await User.findOne({ 
                $or: [
                    { firebaseUid },
                    { email: normalizedEmail }
                ]
            });
            
            if (user) {
                // Update existing user if needed
                if (!user.firebaseUid) {
                    user.firebaseUid = firebaseUid;
                }
                if (avatarUrl && !user.avatarUrl) {
                    user.avatarUrl = avatarUrl;
                }
                await user.save();
            } else {
                // Create new user
                const userId = Date.now() + Math.floor(Math.random() * 1000);
                user = new User({
                    id: userId,
                    email: normalizedEmail,
                    firebaseUid,
                    name: name || email.split('@')[0],
                    mobile: mobile || '',
                    role,
                    authProvider: authProvider || 'google',
                    status: 'active',
                    isVerified: true, // OAuth users are considered verified
                    subscriptionPlan: 'free',
                    featuredCredits: 0,
                    usedCertifications: 0,
                    avatarUrl: avatarUrl || '',
                    createdAt: new Date().toISOString()
                });
                await user.save();
                console.log('✅ New OAuth user created:', normalizedEmail);
            }
            
            // Generate tokens
            const accessToken = generateAccessToken(user.toObject());
            const refreshToken = generateRefreshToken(user.toObject());
            
            // Return user without password
            const userObj = user.toObject();
            delete userObj.password;
            userObj.id = userObj._id?.toString() || userObj.id;
            
            return res.json({
                success: true,
                user: userObj,
                accessToken,
                refreshToken
            });
        }
        
        // Default: Invalid action
        return res.status(400).json({ success: false, reason: 'Invalid action. Use action: login, register, or oauth-login' });
    } catch (error) {
        console.error('❌ Error in POST /api/users:', error);
        
        // Handle duplicate key error
        if (error instanceof Error && 
            (error.message.includes('E11000') || 
             error.message.includes('duplicate key') ||
             error.message.includes('email_1 dup key'))) {
            return res.status(400).json({
                success: false,
                reason: 'User with this email already exists.'
            });
        }
        
        // Handle validation errors
        if (error instanceof Error && error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                reason: 'Invalid user data provided.',
                error: error.message
            });
        }
        
        return res.status(500).json({
            success: false,
            reason: 'Failed to process user request.',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// PUT /api/users - Update user
app.put('/api/users', async (req, res) => {
    try {
        const { email, ...updateData } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, reason: 'Email is required for update.' });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            return res.status(404).json({ success: false, reason: 'User not found.' });
        }
        
        // Update user fields (exclude password from direct updates)
        if (updateData.password) {
            updateData.password = await hashPassword(updateData.password);
        }
        
        Object.assign(user, updateData);
        user.updatedAt = new Date();
        await user.save();
        
        // Return user without password
        const userObj = user.toObject();
        delete userObj.password;
        userObj.id = userObj._id?.toString() || userObj.id;
        
        console.log('✅ Updated user:', normalizedEmail);
        return res.json({
            success: true,
            user: userObj
        });
    } catch (error) {
        console.error('❌ Error updating user:', error);
        return res.status(500).json({
            success: false,
            reason: 'Failed to update user.',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// DELETE /api/users - Delete user
app.delete('/api/users', async (req, res) => {
    try {
        const { email } = req.body || req.query;
        
        if (!email) {
            return res.status(400).json({ success: false, reason: 'Email is required.' });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOneAndDelete({ email: normalizedEmail });
        
        if (!user) {
            return res.status(404).json({ success: false, reason: 'User not found.' });
        }
        
        console.log('✅ Deleted user:', normalizedEmail);
        return res.json({ success: true, email: normalizedEmail });
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        return res.status(500).json({
            success: false,
            reason: 'Failed to delete user.',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// FAQ API endpoints
app.get('/api/faqs', async (req, res) => {
    try {
        const { id } = req.query;
        
        // Get single FAQ by ID
        if (id) {
            console.log(`❓ GET /api/faqs?id=${id} - Fetching single FAQ from MongoDB`);
            const faq = await FAQ.findOne({ id: Number(id) });
            
            if (!faq) {
                return res.status(404).json({ error: 'FAQ not found' });
            }
            
            console.log('✅ Found FAQ:', id);
            return res.json({ faq });
        }
        
        // Get all FAQs
        console.log('❓ GET /api/faqs - Fetching FAQs from MongoDB');
        const faqs = await FAQ.find({}).sort({ createdAt: -1 });
        console.log(`✅ Found ${faqs.length} FAQs`);
        res.json({ faqs });
    } catch (error) {
        console.error('❌ Error fetching FAQs:', error.message);
        res.status(500).json({ error: 'Failed to fetch FAQs' });
    }
});

app.post('/api/faqs', async (req, res) => {
    try {
        console.log('❓ POST /api/faqs - Creating new FAQ');
        const { question, answer, category } = req.body;
        
        if (!question || !answer) {
            return res.status(400).json({ error: 'Question and answer are required' });
        }
        
        // Generate unique ID
        const faqId = Date.now() + Math.floor(Math.random() * 1000);
        
        const faq = new FAQ({
            id: faqId,
            question,
            answer,
            category: category || 'General'
        });
        
        await faq.save();
        console.log('✅ FAQ created:', faqId);
        res.status(201).json({ faq });
    } catch (error) {
        console.error('❌ Error creating FAQ:', error.message);
        res.status(500).json({ error: 'Failed to create FAQ' });
    }
});

app.put('/api/faqs', async (req, res) => {
    try {
        console.log('❓ PUT /api/faqs - Updating FAQ');
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'FAQ ID is required' });
        }
        
        const faq = await FAQ.findOneAndUpdate(
            { id: Number(id) },
            { ...req.body, updatedAt: new Date() },
            { new: true }
        );
        
        if (!faq) {
            return res.status(404).json({ error: 'FAQ not found' });
        }
        
        console.log('✅ FAQ updated:', id);
        res.json({ faq });
    } catch (error) {
        console.error('❌ Error updating FAQ:', error.message);
        res.status(500).json({ error: 'Failed to update FAQ' });
    }
});

app.delete('/api/faqs', async (req, res) => {
    try {
        console.log('❓ DELETE /api/faqs - Deleting FAQ');
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'FAQ ID is required' });
        }
        
        const deletedFaq = await FAQ.findOneAndDelete({ id: Number(id) });
        
        if (!deletedFaq) {
            return res.status(404).json({ error: 'FAQ not found' });
        }
        
        console.log('✅ FAQ deleted:', id);
        res.json({ success: true, message: 'FAQ deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting FAQ:', error.message);
        res.status(500).json({ error: 'Failed to delete FAQ' });
    }
});

// Support Tickets API endpoints
app.get('/api/support-tickets', async (req, res) => {
    try {
        const { id, userEmail } = req.query;
        
        // Get single ticket by ID
        if (id) {
            console.log(`🎫 GET /api/support-tickets?id=${id} - Fetching single ticket from MongoDB`);
            const ticket = await SupportTicket.findOne({ id: Number(id) });
            
            if (!ticket) {
                return res.status(404).json({ error: 'Support ticket not found' });
            }
            
            console.log('✅ Found ticket:', id);
            return res.json({ ticket });
        }
        
        // Get tickets by user email
        if (userEmail) {
            console.log(`🎫 GET /api/support-tickets?userEmail=${userEmail} - Fetching user tickets from MongoDB`);
            const tickets = await SupportTicket.find({ userEmail: userEmail.toLowerCase().trim() }).sort({ createdAt: -1 });
            console.log(`✅ Found ${tickets.length} tickets for user`);
            return res.json({ tickets });
        }
        
        // Get all tickets
        console.log('🎫 GET /api/support-tickets - Fetching support tickets from MongoDB');
        const tickets = await SupportTicket.find({}).sort({ createdAt: -1 });
        console.log(`✅ Found ${tickets.length} support tickets`);
        res.json({ tickets });
    } catch (error) {
        console.error('❌ Error fetching support tickets:', error.message);
        res.status(500).json({ error: 'Failed to fetch support tickets' });
    }
});

app.post('/api/support-tickets', async (req, res) => {
    try {
        console.log('🎫 POST /api/support-tickets - Creating new support ticket');
        const { userEmail, userName, subject, message } = req.body;
        
        if (!userEmail || !userName || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Generate unique ID
        const ticketId = Date.now() + Math.floor(Math.random() * 1000);
        
        const ticket = new SupportTicket({
            id: ticketId,
            userEmail: userEmail.toLowerCase().trim(),
            userName,
            subject,
            message,
            status: 'Open',
            replies: []
        });
        
        await ticket.save();
        console.log('✅ Support ticket created:', ticketId);
        res.status(201).json({ ticket });
    } catch (error) {
        console.error('❌ Error creating support ticket:', error.message);
        res.status(500).json({ error: 'Failed to create support ticket' });
    }
});

app.put('/api/support-tickets', async (req, res) => {
    try {
        console.log('🎫 PUT /api/support-tickets - Updating support ticket');
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'Ticket ID is required' });
        }
        
        const ticket = await SupportTicket.findOneAndUpdate(
            { id: Number(id) },
            { ...req.body, updatedAt: new Date() },
            { new: true }
        );
        
        if (!ticket) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }
        
        console.log('✅ Support ticket updated:', id);
        res.json({ ticket });
    } catch (error) {
        console.error('❌ Error updating support ticket:', error.message);
        res.status(500).json({ error: 'Failed to update support ticket' });
    }
});

app.delete('/api/support-tickets', async (req, res) => {
    try {
        console.log('🎫 DELETE /api/support-tickets - Deleting support ticket');
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'Ticket ID is required' });
        }
        
        const deletedTicket = await SupportTicket.findOneAndDelete({ id: Number(id) });
        
        if (!deletedTicket) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }
        
        console.log('✅ Support ticket deleted:', id);
        res.json({ success: true, message: 'Support ticket deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting support ticket:', error.message);
        res.status(500).json({ error: 'Failed to delete support ticket' });
    }
});

// Admin Logs (Audit Logs) API endpoints
app.get('/api/admin-logs', async (req, res) => {
    try {
        const { id, actor, target, limit } = req.query;
        
        // Get single log by ID
        if (id) {
            console.log(`📋 GET /api/admin-logs?id=${id} - Fetching single log from MongoDB`);
            const log = await AuditLog.findOne({ id: Number(id) });
            
            if (!log) {
                return res.status(404).json({ error: 'Audit log not found' });
            }
            
            console.log('✅ Found log:', id);
            return res.json({ log });
        }
        
        // Build query
        const query = {};
        if (actor) {
            query.actor = actor.toLowerCase().trim();
        }
        if (target) {
            query.target = target;
        }
        
        // Get logs with optional limit
        const limitNum = limit ? parseInt(limit) : 200;
        console.log('📋 GET /api/admin-logs - Fetching audit logs from MongoDB');
        const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(limitNum);
        console.log(`✅ Found ${logs.length} audit logs`);
        res.json({ logs });
    } catch (error) {
        console.error('❌ Error fetching audit logs:', error.message);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

app.post('/api/admin-logs', async (req, res) => {
    try {
        console.log('📋 POST /api/admin-logs - Creating new audit log entry');
        const { actor, action, target, details } = req.body;
        
        if (!actor || !action || !target) {
            return res.status(400).json({ error: 'Actor, action, and target are required' });
        }
        
        // Generate unique ID
        const logId = Date.now() + Math.floor(Math.random() * 1000);
        
        const log = new AuditLog({
            id: logId,
            timestamp: new Date().toISOString(),
            actor: actor.toLowerCase().trim(),
            action,
            target,
            details: details || undefined
        });
        
        await log.save();
        console.log('✅ Audit log created:', logId);
        res.status(201).json({ log });
    } catch (error) {
        console.error('❌ Error creating audit log:', error.message);
        res.status(500).json({ error: 'Failed to create audit log' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'API server with MongoDB is running',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        endpoints: {
            vehicles: '/api/vehicles',
            users: '/api/users',
            faqs: '/api/faqs',
            supportTickets: '/api/support-tickets',
            adminLogs: '/api/admin-logs',
            health: '/api/health'
        }
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Development API server running on http://localhost:${PORT}`);
    console.log('🔄 Connecting to MongoDB...');
    await connectToDatabase();
    console.log(`\n📋 Available endpoints:`);
    console.log(`   - GET  /api/vehicles - Get all vehicles (or ?id=123 for single vehicle)`);
    console.log(`   - POST /api/vehicles - Create new vehicle`);
    console.log(`   - PUT  /api/vehicles - Update vehicle (?id=123)`);
    console.log(`   - DELETE /api/vehicles - Delete vehicle (?id=123)`);
    console.log(`   - GET  /api/users - Get all users (or ?email=... or ?id=... for single user)`);
    console.log(`   - POST /api/users - Login/Register (action: login|register|oauth-login)`);
    console.log(`   - PUT  /api/users - Update user`);
    console.log(`   - DELETE /api/users - Delete user`);
    console.log(`   - GET  /api/faqs - Get all FAQs (or ?id=123 for single FAQ)`);
    console.log(`   - POST /api/faqs - Create new FAQ`);
    console.log(`   - PUT  /api/faqs - Update FAQ (?id=123)`);
    console.log(`   - DELETE /api/faqs - Delete FAQ (?id=123)`);
    console.log(`   - GET  /api/support-tickets - Get all tickets (or ?id=123 or ?userEmail=... for filtered)`);
    console.log(`   - POST /api/support-tickets - Create new support ticket`);
    console.log(`   - PUT  /api/support-tickets - Update ticket (?id=123)`);
    console.log(`   - DELETE /api/support-tickets - Delete ticket (?id=123)`);
    console.log(`   - GET  /api/admin-logs - Get audit logs (or ?id=123, ?actor=..., ?target=..., ?limit=200)`);
    console.log(`   - POST /api/admin-logs - Create new audit log entry`);
    console.log(`   - GET  /api/health - Server health check`);
    console.log(`\n🔗 Test the API:`);
    console.log(`   curl http://localhost:${PORT}/api/vehicles`);
    console.log(`   curl http://localhost:${PORT}/api/users`);
    console.log(`   curl http://localhost:${PORT}/api/faqs`);
    console.log(`   curl http://localhost:${PORT}/api/support-tickets`);
    console.log(`   curl http://localhost:${PORT}/api/admin-logs`);
    console.log(`   curl http://localhost:${PORT}/api/health`);
});

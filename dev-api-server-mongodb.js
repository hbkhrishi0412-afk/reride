// Development API server with MongoDB integration
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const app = express();
const PORT = 3001;

// MongoDB connection - Use environment variable (SECURE)
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  console.error('📝 Please create a .env file with your MongoDB connection string.');
  console.error('💡 See .env.example for the required format.');
  process.exit(1);
}

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Connect to MongoDB
async function connectToDatabase() {
    try {
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

// Vehicles API endpoint
app.get('/api/vehicles', async (req, res) => {
    try {
        console.log('🚗 GET /api/vehicles - Fetching vehicles from MongoDB');
        const vehicles = await Vehicle.find({}).sort({ createdAt: -1 });
        console.log(`✅ Found ${vehicles.length} vehicles`);
        res.json(vehicles);
    } catch (error) {
        console.error('❌ Error fetching vehicles:', error.message);
        res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
});

app.post('/api/vehicles', async (req, res) => {
    try {
        const { action, vehicleId, refreshAction, sellerEmail, id } = req.body;
        
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
        
        // Default: Create new vehicle
        console.log('🚗 POST /api/vehicles - Creating new vehicle');
        const vehicle = new Vehicle(req.body);
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
        const vehicle = await Vehicle.findOneAndUpdate({ id }, req.body, { new: true });
        
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
        
        const deletedVehicle = await Vehicle.findOneAndDelete({ id });
        
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
        console.log('👥 GET /api/users - Fetching users from MongoDB');
        const users = await User.find({});
        console.log(`✅ Found ${users.length} users`);
        res.json(users);
    } catch (error) {
        console.error('❌ Error fetching users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        console.log('👥 POST /api/users - Creating new user');
        const user = new User(req.body);
        await user.save();
        res.status(201).json(user);
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        res.status(500).json({ error: 'Failed to create user' });
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
    console.log(`   - GET  /api/vehicles - Get all vehicles from MongoDB`);
    console.log(`   - POST /api/vehicles - Create new vehicle`);
    console.log(`   - GET  /api/users - Get all users from MongoDB`);
    console.log(`   - POST /api/users - Create new user`);
    console.log(`   - GET  /api/health - Server health check`);
    console.log(`\n🔗 Test the API:`);
    console.log(`   curl http://localhost:${PORT}/api/vehicles`);
    console.log(`   curl http://localhost:${PORT}/api/users`);
    console.log(`   curl http://localhost:${PORT}/api/health`);
});

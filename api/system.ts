import type { VercelRequest, VercelResponse } from '@vercel/node';
import connectToDatabase from '../lib/db';
import VehicleDataModel from '../models/VehicleData';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Route based on system action
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
  } catch (error) {
    console.error('System API Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Health Check Handler
async function handleHealth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      reason: 'Method not allowed. Only GET requests are supported.' 
    });
  }

  try {
    console.log('🔍 Starting database health check...');
    
    // Check if MongoDB URI is configured
    const hasMongoUri = !!process.env.MONGODB_URI;
    if (!hasMongoUri) {
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'MONGODB_URI environment variable is not configured',
        details: 'Please add MONGODB_URI in Vercel dashboard under Environment Variables',
        checks: [
          { 
            name: 'MongoDB URI Configuration', 
            status: 'FAIL', 
            details: 'MONGODB_URI environment variable not found',
            timestamp: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString()
      });
    }

    // Attempt to connect to database
    console.log('📡 Attempting to connect to MongoDB...');
    const mongoose = await connectToDatabase();
    
    // Test database operations
    console.log('🧪 Testing database operations...');
    
    // Test VehicleData collection
    const vehicleDataCount = await VehicleDataModel.countDocuments();
    console.log(`📊 VehicleData documents: ${vehicleDataCount}`);
    
    // Test basic CRUD operation
    const testData = { 
      data: { 
        TEST_CATEGORY: [{ 
          name: "Test Make", 
          models: [{ name: "Test Model", variants: ["Test Variant"] }] 
        }] 
      } 
    };
    
    const testDoc = new VehicleDataModel(testData);
    await testDoc.save();
    console.log('✅ Test document created successfully');
    
    // Clean up test document
    await VehicleDataModel.findByIdAndDelete(testDoc._id);
    console.log('🧹 Test document cleaned up');
    
    // Get database info
    const db = mongoose.connection.db;
    
    if (!db) {
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'Database connection not available',
        error: 'Database connection is undefined'
      });
    }
    
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('✅ Database health check completed successfully');
    
    return res.status(200).json({
      success: true,
      status: 'ok',
      message: 'Database connected successfully',
      details: {
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        collections: collectionNames,
        vehicleDataCount
      },
      checks: [
        { 
          name: 'MongoDB URI Configuration', 
          status: 'PASS', 
          details: 'MONGODB_URI is properly configured',
          timestamp: new Date().toISOString()
        },
        { 
          name: 'Database Connection', 
          status: 'PASS', 
          details: 'Successfully connected to MongoDB',
          timestamp: new Date().toISOString()
        },
        { 
          name: 'VehicleData Collection', 
          status: 'PASS', 
          details: `Found ${vehicleDataCount} vehicle data documents`,
          timestamp: new Date().toISOString()
        },
        { 
          name: 'CRUD Operations', 
          status: 'PASS', 
          details: 'Create, read, and delete operations working',
          timestamp: new Date().toISOString()
        }
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database health check failed:', error);
    
    let errorMessage = 'Database connection failed';
    let errorDetails = 'Unknown error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('MONGODB_URI')) {
        errorDetails = 'Check MONGODB_URI environment variable in Vercel dashboard';
      } else if (error.message.includes('connect') || error.message.includes('timeout')) {
        errorDetails = 'Check database server status and network connectivity';
      } else if (error.message.includes('authentication')) {
        errorDetails = 'Check database credentials and permissions';
      } else if (error.message.includes('network')) {
        errorDetails = 'Check network connectivity and firewall settings';
      }
    }
    
    return res.status(500).json({
      success: false,
      status: 'error',
      message: errorMessage,
      details: errorDetails,
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: [
        { 
          name: 'Database Connection', 
          status: 'FAIL', 
          details: errorMessage,
          timestamp: new Date().toISOString()
        }
      ],
      timestamp: new Date().toISOString()
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

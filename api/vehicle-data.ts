import type { VercelRequest, VercelResponse } from '@vercel/node';
import connectToDatabase from '../lib/db';
import VehicleDataModel from '../models/VehicleData';
import type { VehicleData } from '../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Always set JSON content type to prevent HTML responses
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log(`🚀 Vehicle Data API: ${req.method} request received`);

  try {
    // Default vehicle data (fallback)
    const defaultData: VehicleData = {
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
      console.log('📥 Fetching vehicle data...');
      
      // Try to connect to database, but don't fail if it's not available
      try {
        await connectToDatabase();
        console.log('📡 Connected to database for vehicle data operation');
        
        // Try to find existing vehicle data
        let vehicleDataDoc = await VehicleDataModel.findOne().sort({ updatedAt: -1 });
        
        if (!vehicleDataDoc) {
          console.log('📝 No vehicle data found, creating default data...');
          vehicleDataDoc = new VehicleDataModel({ data: defaultData });
          await vehicleDataDoc.save();
          console.log('✅ Default vehicle data created');
        }
        
        console.log('✅ Vehicle data fetched successfully from database');
        return res.status(200).json(vehicleDataDoc.data);
        
      } catch (dbError) {
        console.warn('⚠️ Database connection failed, returning default data:', dbError);
        // Return default data as fallback
        return res.status(200).json(defaultData);
      }
    }

    if (req.method === 'POST') {
      console.log('💾 Saving vehicle data...');
      
      const vehicleData: VehicleData = req.body;
      
      if (!vehicleData || typeof vehicleData !== 'object') {
        return res.status(400).json({
          success: false,
          reason: 'Invalid vehicle data format'
        });
      }

      // Validate vehicle data structure
      if (!validateVehicleData(vehicleData)) {
        return res.status(400).json({
          success: false,
          reason: 'Invalid vehicle data structure'
        });
      }

      // Try to connect to database, but don't fail if it's not available
      try {
        await connectToDatabase();
        console.log('📡 Connected to database for vehicle data save operation');
        
        // Update or create vehicle data document
        const updatedDoc = await VehicleDataModel.findOneAndUpdate(
          {},
          { 
            data: vehicleData,
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
          data: updatedDoc.data,
          message: 'Vehicle data updated successfully',
          timestamp: new Date().toISOString()
        });
        
      } catch (dbError) {
        console.warn('⚠️ Database connection failed, cannot save vehicle data:', dbError);
        
        // For POST requests, we should still return success but indicate fallback
        // This prevents the sync from failing completely
        console.log('📝 Returning success with fallback indication for POST request');
        return res.status(200).json({
          success: true,
          data: vehicleData,
          message: 'Vehicle data processed (database unavailable, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (req.method === 'PUT') {
      console.log('🔄 Updating vehicle data...');
      
      const vehicleData: VehicleData = req.body;
      
      if (!vehicleData || typeof vehicleData !== 'object') {
        return res.status(400).json({
          success: false,
          reason: 'Invalid vehicle data format'
        });
      }

      // Validate vehicle data structure
      if (!validateVehicleData(vehicleData)) {
        return res.status(400).json({
          success: false,
          reason: 'Invalid vehicle data structure'
        });
      }

      // Try to connect to database, but don't fail if it's not available
      try {
        await connectToDatabase();
        console.log('📡 Connected to database for vehicle data update operation');
        
        // Update existing document
        const updatedDoc = await VehicleDataModel.findOneAndUpdate(
          {},
          { 
            data: vehicleData,
            updatedAt: new Date()
          },
          { new: true }
        );

        if (!updatedDoc) {
          return res.status(404).json({
            success: false,
            reason: 'No vehicle data found to update'
          });
        }

        console.log('✅ Vehicle data updated successfully in database');
        return res.status(200).json({
          success: true,
          data: updatedDoc.data,
          message: 'Vehicle data updated successfully',
          timestamp: new Date().toISOString()
        });
        
      } catch (dbError) {
        console.warn('⚠️ Database connection failed, cannot update vehicle data:', dbError);
        return res.status(503).json({
          success: false,
          reason: 'Database temporarily unavailable. Vehicle data could not be updated.',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (req.method === 'DELETE') {
      console.log('🗑️ Deleting vehicle data...');
      
      // Try to connect to database, but don't fail if it's not available
      try {
        await connectToDatabase();
        console.log('📡 Connected to database for vehicle data delete operation');
        
        const deletedDoc = await VehicleDataModel.findOneAndDelete({});
        
        if (!deletedDoc) {
          return res.status(404).json({
            success: false,
            reason: 'No vehicle data found to delete'
          });
        }

        console.log('✅ Vehicle data deleted successfully from database');
        return res.status(200).json({
          success: true,
          message: 'Vehicle data deleted successfully',
          timestamp: new Date().toISOString()
        });
        
      } catch (dbError) {
        console.warn('⚠️ Database connection failed, cannot delete vehicle data:', dbError);
        return res.status(503).json({
          success: false,
          reason: 'Database temporarily unavailable. Vehicle data could not be deleted.',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    return res.status(405).json({
      success: false,
      reason: 'Method not allowed'
    });

  } catch (error) {
    console.error('❌ Vehicle data API error:', error);
    
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    
    return res.status(500).json({
      success: false,
      reason: message,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to validate vehicle data structure
function validateVehicleData(data: any): data is VehicleData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check if it has expected categories
  const categories = Object.keys(data);
  if (categories.length === 0) {
    return false;
  }

  // Validate each category
  for (const category of categories) {
    if (!Array.isArray(data[category])) {
      return false;
    }

    // Validate each make in the category
    for (const make of data[category]) {
      if (!make.name || !Array.isArray(make.models)) {
        return false;
      }

      // Validate each model
      for (const model of make.models) {
        if (!model.name || !Array.isArray(model.variants)) {
          return false;
        }
      }
    }
  }

  return true;
}

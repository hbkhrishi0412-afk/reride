// Server-side API handler for Vercel deployment
// This file handles the actual MongoDB operations on the server

import { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'reride';

interface SellCarSubmission {
  registration: string;
  make: string;
  model: string;
  variant: string;
  year: string;
  district: string;
  noOfOwners: string;
  kilometers: string;
  fuelType: string;
  transmission: string;
  customerContact: string;
  submittedAt: string;
  status: 'pending' | 'contacted' | 'completed' | 'rejected';
  adminNotes?: string;
  estimatedPrice?: number;
  _id?: string;
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase() {
  // Check if cached connection is still alive
  if (cachedClient && cachedDb) {
    try {
      // Ping the database to verify connection is alive
      await cachedDb.admin().ping();
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      // Connection is dead, reset cache
      console.warn('⚠️ Cached MongoDB connection is dead, reconnecting...');
      try {
        await cachedClient.close();
      } catch (closeError) {
        // Ignore close errors
      }
      cachedClient = null;
      cachedDb = null;
    }
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not configured');
  }

  try {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    await client.connect();
    
    // Parse URI to check if database name is already included
    let dbNameFromUri: string | null = null;
    
    try {
      // Handle mongodb:// and mongodb+srv:// URIs
      const uriMatch = MONGODB_URI.match(/mongodb(\+srv)?:\/\/[^/]+(?:\/([^?]+))?/);
      if (uriMatch && uriMatch[2]) {
        dbNameFromUri = uriMatch[2];
      }
    } catch (error) {
      // If URI parsing fails, use default database name
      console.warn('⚠️ Could not parse MongoDB URI, using default database name');
    }
    
    const dbName = dbNameFromUri || DB_NAME;
    
    const db = client.db(dbName);
    
    // Verify connection by pinging
    await db.admin().ping();
    
    cachedClient = client;
    cachedDb = db;
    
    console.log(`✅ MongoDB connected successfully to database: ${dbName}`);
    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    cachedClient = null;
    cachedDb = null;
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method } = req;

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('sellCarSubmissions');

    switch (method) {
      case 'POST':
        // Submit new sell car data
        const submissionData: SellCarSubmission = {
          ...req.body,
          submittedAt: new Date().toISOString(),
          status: 'pending'
        };

        // Validate required fields
        const requiredFields = [
          'registration', 'make', 'model', 'variant', 'year', 
          'district', 'noOfOwners', 'kilometers', 'fuelType', 
          'transmission', 'customerContact'
        ];

        for (const field of requiredFields) {
          if (!submissionData[field as keyof SellCarSubmission]) {
            return res.status(400).json({ 
              error: `Missing required field: ${field}` 
            });
          }
        }

        // Check if registration number already exists
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
          id: result.insertedId,
          message: 'Car submission received successfully'
        });
        break;

      case 'GET':
        // Get all sell car submissions (admin only)
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
        // Update submission status or add admin notes
        const { id, status: updateStatus, adminNotes, estimatedPrice } = req.body;
        
        if (!id) {
          return res.status(400).json({ error: 'Submission ID is required' });
        }

        const updateData: any = {};
        if (updateStatus) updateData.status = updateStatus;
        if (adminNotes) updateData.adminNotes = adminNotes;
        if (estimatedPrice) updateData.estimatedPrice = estimatedPrice;
        updateData.updatedAt = new Date().toISOString();

        const updateResult = await collection.updateOne(
          { _id: id },
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
        // Delete submission (admin only)
        const { id: deleteId } = req.query;
        
        if (!deleteId) {
          return res.status(400).json({ error: 'Submission ID is required' });
        }

        const deleteResult = await collection.deleteOne({ _id: deleteId });
        
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
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

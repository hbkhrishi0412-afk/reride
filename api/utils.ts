import type { VercelRequest, VercelResponse } from '@vercel/node';
import connectToDatabase from '../lib/db';

// This file consolidates utility functions and test connections
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
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Route to appropriate utility function
    if (pathname.includes('/test-connection') || pathname.endsWith('/test-connection')) {
      return await handleTestConnection(req, res);
    } else {
      return res.status(404).json({ success: false, reason: 'Utility endpoint not found' });
    }

  } catch (error) {
    console.error('Utils API Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Test connection handler - preserves exact functionality from test-connection.ts
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

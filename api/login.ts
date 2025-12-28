// api/login.ts - Firebase ID Token Verification Endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from '../lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(token);

    return res.status(200).json({ uid: decoded.uid });
  } catch (err) {
    console.error('Firebase ID token verification error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}



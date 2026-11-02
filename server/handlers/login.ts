// api/login.ts - Supabase JWT Token Verification Endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySupabaseToken } from '../supabase-auth.js';
import { applyCors } from '../../lib/api-route-cors.js';

export async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : null;
    const token = typeof body?.token === 'string' ? body.token : undefined;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Verify Supabase JWT token
    const decoded = await verifySupabaseToken(`Bearer ${token}`);

    return res.status(200).json({ uid: decoded.uid });
  } catch (err) {
    console.error('Supabase JWT token verification error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

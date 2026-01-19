import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from '../server/firebase-admin.js';
import { adminCreate, adminRead } from '../server/firebase-admin-db.js';
import { DB_PATHS } from '../lib/firebase-db.js';

interface ServiceProviderPayload {
  name: string;
  email: string;
  phone: string;
  city: string;
  workshops?: string[];
  skills?: string[];
  availability?: string;
}

const COLLECTION = DB_PATHS.SERVICE_PROVIDERS;

async function verifyIdTokenFromHeader(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }
  const token = authHeader.replace('Bearer ', '').trim();
  return admin.auth().verifyIdToken(token);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const decoded = await verifyIdTokenFromHeader(req);
    const uid = decoded.uid;
    const email = decoded.email || '';

    if (req.method === 'GET') {
      const provider = await adminRead<ServiceProviderPayload & { id?: string }>(COLLECTION, uid);
      if (!provider) {
        return res.status(404).json({ error: 'Service provider profile not found' });
      }
      return res.status(200).json({ ...provider, uid });
    }

    if (req.method === 'POST') {
      const body = req.body as Partial<ServiceProviderPayload>;
      if (!body.name || !body.email || !body.phone || !body.city) {
        return res.status(400).json({ error: 'Missing required fields: name, email, phone, city' });
      }

      // Enforce separation from main user collection by storing under dedicated path
      const payload: ServiceProviderPayload = {
        name: body.name,
        email: body.email.toLowerCase(),
        phone: body.phone,
        city: body.city,
        workshops: body.workshops || [],
        skills: body.skills || [],
        availability: body.availability || 'weekdays',
      };

      // Only allow creating profile for the authenticated Firebase user
      if (payload.email !== email.toLowerCase()) {
        return res.status(403).json({ error: 'Email mismatch with authenticated user' });
      }

      await adminCreate<ServiceProviderPayload>(COLLECTION, payload, uid);
      return res.status(201).json({ uid, ...payload });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Service provider API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(401).json({ error: message });
  }
}


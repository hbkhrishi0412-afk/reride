import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from '../server/firebase-admin.js';
import { adminCreate, adminRead, adminReadAll, adminUpdate } from '../server/firebase-admin-db.js';
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
    const scope = (req.query.scope as string) || 'mine';

    if (req.method === 'GET') {
      if (scope === 'all') {
        const all = await adminReadAll<Record<string, ServiceProviderPayload>>(COLLECTION);
        const list = all ? Object.entries(all).map(([id, rec]) => ({ id, ...rec })) : [];
        return res.status(200).json(list);
      }

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

      // Also sync into admin users collection so the provider shows up in admin panel
      const emailKey = payload.email.replace(/[.#$[\]]/g, '_');
      const existingUser = await adminRead<any>(DB_PATHS.USERS, emailKey);
      if (!existingUser) {
        const now = new Date().toISOString();
        await adminCreate(DB_PATHS.USERS, {
          name: payload.name,
          email: payload.email,
          mobile: payload.phone,
          role: 'seller', // reuse seller slot for providers in admin panel
          location: payload.city,
          status: 'active',
          authProvider: 'email',
          firebaseUid: uid,
          createdAt: now,
          updatedAt: now,
        }, emailKey);
      }

      return res.status(201).json({ uid, ...payload });
    }

    if (req.method === 'PATCH') {
      const existing = await adminRead<ServiceProviderPayload>(COLLECTION, uid);
      if (!existing) {
        return res.status(404).json({ error: 'Service provider profile not found' });
      }

      const body = req.body as Partial<ServiceProviderPayload>;
      const updates: Partial<ServiceProviderPayload> = {};
      
      if (body.skills !== undefined) updates.skills = body.skills;
      if (body.workshops !== undefined) updates.workshops = body.workshops;
      if (body.availability !== undefined) updates.availability = body.availability;
      if (body.name !== undefined) updates.name = body.name;
      if (body.phone !== undefined) updates.phone = body.phone;
      if (body.city !== undefined) updates.city = body.city;

      await adminUpdate<ServiceProviderPayload>(COLLECTION, uid, updates);
      const updated = await adminRead<ServiceProviderPayload>(COLLECTION, uid);
      return res.status(200).json({ ...updated, uid });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Service provider API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(401).json({ error: message });
  }
}


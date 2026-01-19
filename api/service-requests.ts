import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from '../server/firebase-admin.js';
import { adminCreate, adminRead, adminUpdate, adminQueryByField } from '../server/firebase-admin-db.js';
import { DB_PATHS } from '../lib/firebase-db.js';

interface ServiceRequestPayload {
  providerId: string;
  title: string;
  serviceType?: string;
  customerName?: string;
  customerPhone?: string;
  vehicle?: string;
  city?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  scheduledAt?: string;
  notes?: string;
}

const COLLECTION = DB_PATHS.SERVICE_REQUESTS;

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
    const providerId = decoded.uid;

    if (req.method === 'GET') {
      const records = await adminQueryByField<ServiceRequestPayload>(COLLECTION, 'providerId', providerId);
      return res.status(200).json(
        Object.entries(records).map(([id, rec]) => ({ id, ...rec }))
      );
    }

    if (req.method === 'POST') {
      const body = req.body as Partial<ServiceRequestPayload>;
      if (!body.title) {
        return res.status(400).json({ error: 'Missing required field: title' });
      }

      const payload: ServiceRequestPayload = {
        providerId,
        title: body.title,
        serviceType: body.serviceType || 'General',
        customerName: body.customerName || '',
        customerPhone: body.customerPhone || '',
        vehicle: body.vehicle || '',
        city: body.city || '',
        status: (body.status as ServiceRequestPayload['status']) || 'pending',
        scheduledAt: body.scheduledAt || '',
        notes: body.notes || '',
      };

      const id = await adminCreate<ServiceRequestPayload>(COLLECTION, payload);
      return res.status(201).json({ id, ...payload });
    }

    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body as Partial<ServiceRequestPayload> & { id?: string };
      if (!id) {
        return res.status(400).json({ error: 'Missing request id' });
      }
      const existing = await adminRead<ServiceRequestPayload>(COLLECTION, id);
      if (!existing || existing.providerId !== providerId) {
        return res.status(404).json({ error: 'Request not found' });
      }
      await adminUpdate<ServiceRequestPayload>(COLLECTION, id, updates);
      const updated = await adminRead<ServiceRequestPayload>(COLLECTION, id);
      return res.status(200).json({ id, ...(updated || {}) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Service requests API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message.includes('Missing bearer token') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}


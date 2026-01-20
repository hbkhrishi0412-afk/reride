import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from '../server/firebase-admin.js';
import { adminCreate, adminRead, adminUpdate, adminQueryByField } from '../server/firebase-admin-db.js';
import { DB_PATHS } from '../lib/firebase-db.js';

interface ServiceRequestPayload {
  providerId?: string | null;
  candidateProviderIds?: string[];
  title: string;
  serviceType?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicle?: string;
  city?: string;
  addressLine?: string;
  pincode?: string;
  status?: 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  scheduledAt?: string;
  notes?: string;
  carDetails?: string;
  createdAt?: string;
  updatedAt?: string;
  claimedAt?: string;
  completedAt?: string;
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
    const scope = (req.query.scope as string) || 'mine';

    if (req.method === 'GET') {
      if (scope === 'open') {
        const records = await adminQueryByField<ServiceRequestPayload>(COLLECTION, 'status', 'open');
        const cityFilter = (req.query.city as string) || '';
        const serviceTypeFilter = (req.query.serviceType as string) || '';
        const list = Object.entries(records).map(([id, rec]) => ({ id, ...rec }));
        const filtered = list.filter((item) => {
          const cityMatches = cityFilter ? item.city?.toLowerCase() === cityFilter.toLowerCase() : true;
          const serviceMatches = serviceTypeFilter ? item.serviceType === serviceTypeFilter : true;
          const candidateOk =
            !item.candidateProviderIds ||
            item.candidateProviderIds.length === 0 ||
            item.candidateProviderIds.includes(providerId);
          return cityMatches && serviceMatches && candidateOk;
        });
        return res.status(200).json(filtered);
      }

      if (scope === 'all') {
        const all = await adminRead<Record<string, ServiceRequestPayload>>(COLLECTION);
        const list = all
          ? Object.entries(all).map(([id, rec]) => ({ id, ...rec }))
          : [];
        return res.status(200).json(list);
      }

      const records = await adminQueryByField<ServiceRequestPayload>(COLLECTION, 'providerId', providerId);
      return res.status(200).json(Object.entries(records).map(([id, rec]) => ({ id, ...rec })));
    }

    if (req.method === 'POST') {
      const body = req.body as Partial<ServiceRequestPayload>;
      if (!body.title) {
        return res.status(400).json({ error: 'Missing required field: title' });
      }

      const payload: ServiceRequestPayload = {
        providerId: body.providerId ?? null,
        candidateProviderIds: Array.isArray(body.candidateProviderIds) ? body.candidateProviderIds : [],
        title: body.title,
        serviceType: body.serviceType || 'General',
        customerName: body.customerName || '',
        customerPhone: body.customerPhone || '',
        customerEmail: body.customerEmail || '',
        vehicle: body.vehicle || '',
        city: body.city || '',
        addressLine: body.addressLine || '',
        pincode: body.pincode || '',
        status: (body.status as ServiceRequestPayload['status']) || 'open',
        scheduledAt: body.scheduledAt || '',
        notes: body.notes || '',
        carDetails: body.carDetails || '',
      };

      const id = await adminCreate<ServiceRequestPayload>(COLLECTION, payload);
      return res.status(201).json({ id, ...payload });
    }

    if (req.method === 'PATCH') {
      const { id, action, ...updates } = req.body as Partial<ServiceRequestPayload> & {
        id?: string;
        action?: 'claim';
      };
      if (!id) {
        return res.status(400).json({ error: 'Missing request id' });
      }
      const existing = await adminRead<ServiceRequestPayload>(COLLECTION, id);
      if (!existing) {
        return res.status(404).json({ error: 'Request not found' });
      }

      if (action === 'claim') {
        if (existing.status !== 'open' || existing.providerId) {
          return res.status(409).json({ error: 'Request already claimed' });
        }
        const candidateOk =
          !existing.candidateProviderIds ||
          existing.candidateProviderIds.length === 0 ||
          existing.candidateProviderIds.includes(providerId);
        if (!candidateOk) {
          return res.status(403).json({ error: 'Not allowed to claim this request' });
        }
        await adminUpdate<ServiceRequestPayload>(COLLECTION, id, {
          providerId,
          status: 'accepted',
          claimedAt: new Date().toISOString(),
        });
        const updatedClaim = await adminRead<ServiceRequestPayload>(COLLECTION, id);
        return res.status(200).json({ id, ...(updatedClaim || {}) });
      }

      if (existing.providerId !== providerId) {
        return res.status(403).json({ error: 'Not allowed to update this request' });
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


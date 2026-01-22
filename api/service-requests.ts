import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { supabaseServiceRequestService } from '../services/supabase-service-request-service.js';
import type { ServiceRequestPayload } from '../services/supabase-service-request-service.js';

// ServiceRequestPayload is now imported from the service file

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
        const records = await supabaseServiceRequestService.findByStatus('open');
        const cityFilter = (req.query.city as string) || '';
        const serviceTypeFilter = (req.query.serviceType as string) || '';
        const filtered = records.filter((item) => {
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
        const all = await supabaseServiceRequestService.findAll();
        return res.status(200).json(all);
      }

      const records = await supabaseServiceRequestService.findByProviderId(providerId);
      return res.status(200).json(records);
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

      const created = await supabaseServiceRequestService.create(payload);
      return res.status(201).json(created);
    }

    if (req.method === 'PATCH') {
      const { id, action, ...updates } = req.body as Partial<ServiceRequestPayload> & {
        id?: string;
        action?: 'claim';
      };
      if (!id) {
        return res.status(400).json({ error: 'Missing request id' });
      }
      const existing = await supabaseServiceRequestService.findById(id);
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
        await supabaseServiceRequestService.update(id, {
          providerId,
          status: 'accepted',
          claimedAt: new Date().toISOString(),
        });
        const updatedClaim = await supabaseServiceRequestService.findById(id);
        return res.status(200).json(updatedClaim || { id, ...existing });
      }

      if (existing.providerId !== providerId) {
        return res.status(403).json({ error: 'Not allowed to update this request' });
      }

      await supabaseServiceRequestService.update(id, updates);
      const updated = await supabaseServiceRequestService.findById(id);
      return res.status(200).json(updated || { id, ...existing });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Service requests API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message.includes('Missing bearer token') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}


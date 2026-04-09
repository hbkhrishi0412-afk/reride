import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { authenticateRequest } from './auth.js';
import { supabaseServiceRequestService } from '../services/supabase-service-request-service.js';
import { supabaseUserService } from '../services/supabase-user-service.js';
import { supabaseServiceProviderService } from '../services/supabase-service-provider-service.js';
import type { ServiceRequestPayload } from '../services/supabase-service-request-service.js';
import { applyCors } from '../lib/api-route-cors.js';

/**
 * Customers and providers authenticate with either a Supabase session JWT or the legacy
 * app JWT stored as reRideAccessToken (same pattern as api/services.ts). Service requests
 * previously only accepted Supabase tokens, so email/password logins failed verification.
 */
type ActorInfo = {
  id: string;
  role: string;
};

function isServiceProviderRole(role: string): boolean {
  const r = String(role || '').toLowerCase().replace(/-/g, '_');
  return r === 'service_provider' || r === 'provider';
}

/** Empty or missing list = any provider may see/claim; otherwise only listed provider IDs. */
function providerMatchesCandidateList(candidateProviderIds: unknown, providerId: string): boolean {
  if (!Array.isArray(candidateProviderIds) || candidateProviderIds.length === 0) {
    return true;
  }
  return candidateProviderIds.some((id) => String(id) === String(providerId));
}

async function resolveServiceRequestActor(req: VercelRequest): Promise<ActorInfo> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.substring(7).trim() === '') {
    throw new Error('Missing bearer token');
  }
  try {
    const decoded = await verifyIdTokenFromHeader(req);
    let resolvedRole =
      decoded.user?.app_metadata?.role ||
      decoded.user?.user_metadata?.role ||
      'customer';

    // If JWT metadata doesn't carry role, resolve from users table by email.
    if (resolvedRole !== 'admin' && decoded.email) {
      try {
        const profile = await supabaseUserService.findByEmail(decoded.email);
        if (profile?.role) {
          resolvedRole = profile.role;
        }
      } catch {
        // Keep JWT-derived role if user lookup fails
      }
    }

    // Profiles were historically synced with role "seller"; treat service_providers row as source of truth.
    if (resolvedRole !== 'admin' && !isServiceProviderRole(String(resolvedRole))) {
      try {
        const sp = await supabaseServiceProviderService.findById(decoded.uid);
        if (sp) {
          resolvedRole = 'service_provider';
        }
      } catch {
        /* ignore */
      }
    }

    return { id: decoded.uid, role: String(resolvedRole) };
  } catch {
    const legacy = authenticateRequest(req);
    if (!legacy.isValid || !legacy.user?.userId) {
      throw new Error(legacy.error || 'Authentication required');
    }
    let resolvedRole = legacy.user.role || 'customer';
    if (resolvedRole !== 'admin' && !isServiceProviderRole(String(resolvedRole))) {
      try {
        const sp = await supabaseServiceProviderService.findById(legacy.user.userId);
        if (sp) {
          resolvedRole = 'service_provider';
        }
      } catch {
        /* ignore */
      }
    }
    return { id: legacy.user.userId, role: String(resolvedRole) };
  }
}

// ServiceRequestPayload is now imported from the service file

export async function handleServiceRequests(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  try {
    const actor = await resolveServiceRequestActor(req);
    const actorId = actor.id;
    const isAdmin = actor.role === 'admin';
    const scope = (req.query.scope as string) || 'mine';

    if (req.method === 'GET') {
      if (scope === 'open') {
        if (!isAdmin && !isServiceProviderRole(actor.role)) {
          return res.status(403).json({ error: 'Service provider access required for open request pool' });
        }
        const records = await supabaseServiceRequestService.findByStatus('open');
        const cityFilter = (req.query.city as string) || '';
        const serviceTypeFilter = (req.query.serviceType as string) || '';
        const filtered = records.filter((item) => {
          const cityMatches = cityFilter ? item.city?.toLowerCase() === cityFilter.toLowerCase() : true;
          const serviceMatches = serviceTypeFilter ? item.serviceType === serviceTypeFilter : true;
          const candidateOk =
            isAdmin || providerMatchesCandidateList(item.candidateProviderIds, actorId);
          return cityMatches && serviceMatches && candidateOk;
        });
        return res.status(200).json(filtered);
      }

      if (scope === 'all') {
        if (!isAdmin) {
          return res.status(403).json({ error: 'Admin access required for scope=all' });
        }
        const all = await supabaseServiceRequestService.findAll();
        return res.status(200).json(all);
      }

      if (scope === 'customer') {
        const customerRecords = await supabaseServiceRequestService.findByCustomerId(actorId);
        return res.status(200).json(customerRecords);
      }

      const records = await supabaseServiceRequestService.findByProviderId(actorId);
      return res.status(200).json(records);
    }

    if (req.method === 'POST') {
      const body = req.body as Partial<ServiceRequestPayload>;
      if (!body.title) {
        return res.status(400).json({ error: 'Missing required field: title' });
      }

      const payload: ServiceRequestPayload = {
        providerId: body.providerId ?? null,
        customerId: actorId,
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
        carDetails: body.carDetails ?? '',
        services: Array.isArray(body.services) ? body.services : undefined,
        addressId: typeof body.addressId === 'string' ? body.addressId : undefined,
        slotId: typeof body.slotId === 'string' ? body.slotId : undefined,
        scheduledDate: typeof body.scheduledDate === 'string' ? body.scheduledDate : undefined,
        slotTimeLabel: typeof body.slotTimeLabel === 'string' ? body.slotTimeLabel : undefined,
        total: typeof body.total === 'number' ? body.total : undefined,
        couponCode: typeof body.couponCode === 'string' ? body.couponCode : undefined,
      };

      const created = await supabaseServiceRequestService.create(payload);
      return res.status(201).json(created);
    }

    if (req.method === 'PATCH') {
      const { id, action, ...updates } = req.body as Partial<ServiceRequestPayload> & {
        id?: string;
        action?: 'claim' | 'cancel';
      };
      if (!id) {
        return res.status(400).json({ error: 'Missing request id' });
      }
      const existing = await supabaseServiceRequestService.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Request not found' });
      }

      const isCustomerOwner = existing.customerId === actorId;
      const customerWantsCancel =
        action === 'cancel' || (isCustomerOwner && updates.status === 'cancelled');

      if (customerWantsCancel) {
        if (!isCustomerOwner) {
          return res.status(403).json({ error: 'Not allowed to cancel this request' });
        }
        if (existing.status === 'cancelled') {
          return res.status(409).json({ error: 'Request already cancelled' });
        }
        if (existing.status === 'completed') {
          return res.status(409).json({ error: 'Request already completed' });
        }
        if (existing.status === 'in_progress') {
          return res.status(409).json({ error: 'Cannot cancel while service is in progress' });
        }
        if (existing.status !== 'open' && existing.status !== 'accepted') {
          return res.status(409).json({ error: 'Request cannot be cancelled' });
        }
        const cancelledAt = new Date().toISOString();
        await supabaseServiceRequestService.update(id, {
          status: 'cancelled',
          cancelledAt,
        });
        const updatedCancel = await supabaseServiceRequestService.findById(id);
        return res.status(200).json(updatedCancel || existing);
      }

      if (action === 'claim') {
        if (!isAdmin && !isServiceProviderRole(actor.role)) {
          return res.status(403).json({ error: 'Only service providers can claim requests' });
        }
        if (
          !isAdmin &&
          !providerMatchesCandidateList(existing.candidateProviderIds, actorId)
        ) {
          return res.status(403).json({ error: 'This request is not assigned to your workshop' });
        }
        if (existing.status !== 'open' || existing.providerId) {
          return res.status(409).json({ error: 'Request already claimed' });
        }
        await supabaseServiceRequestService.update(id, {
          providerId: actorId,
          status: 'accepted',
          claimedAt: new Date().toISOString(),
        });
        const updatedClaim = await supabaseServiceRequestService.findById(id);
        return res.status(200).json(updatedClaim || existing);
      }

      if (!isAdmin && existing.providerId !== actorId) {
        return res.status(403).json({ error: 'Not allowed to update this request' });
      }

      const normalizedStatus = updates.status as ServiceRequestPayload['status'] | undefined;
      if (normalizedStatus === 'in_progress' && !updates.startedAt) {
        updates.startedAt = new Date().toISOString();
      }
      if (normalizedStatus === 'completed' && !updates.completedAt) {
        updates.completedAt = new Date().toISOString();
      }
      if (normalizedStatus === 'cancelled' && !updates.cancelledAt) {
        updates.cancelledAt = new Date().toISOString();
      }

      await supabaseServiceRequestService.update(id, updates);
      const updated = await supabaseServiceRequestService.findById(id);
      return res.status(200).json(updated || existing);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Service requests API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const lower = message.toLowerCase();
    const isAuthFailure =
      lower.includes('missing bearer') ||
      lower.includes('authentication') ||
      lower.includes('authorization') ||
      lower.includes('invalid or expired') ||
      lower.includes('token has expired') ||
      lower.includes('invalid token') ||
      lower.includes('no valid authorization');
    const status = isAuthFailure ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}

// Vercel serverless expects a default export when the module is loaded directly
export default handleServiceRequests;


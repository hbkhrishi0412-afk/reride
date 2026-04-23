import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { authenticateRequest } from './auth.js';
import { supabaseServiceRequestService } from '../services/supabase-service-request-service.js';
import { supabaseUserService } from '../services/supabase-user-service.js';
import { supabaseServiceProviderService } from '../services/supabase-service-provider-service.js';
import { serviceRequestAuditService } from '../services/service-request-audit-service.js';
import type { ServiceRequestPayload } from '../services/supabase-service-request-service.js';
import { applyCors } from '../lib/api-route-cors.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';

/**
 * Customers and providers authenticate with either a Supabase session JWT or the legacy
 * app JWT stored as reRideAccessToken (same pattern as api/services.ts). Service requests
 * previously only accepted Supabase tokens, so email/password logins failed verification.
 */
type ActorInfo = {
  id: string;
  role: string;
};

function normalizeVehicleText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const raw = value as Record<string, unknown>;
  const makeModel = [raw.make, raw.model]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join(' ');
  const year = typeof raw.year === 'number' || typeof raw.year === 'string' ? String(raw.year).trim() : '';
  const fuel = typeof raw.fuel === 'string' ? raw.fuel.trim() : '';
  const reg = typeof raw.reg === 'string' ? raw.reg.trim() : '';
  const city = typeof raw.city === 'string' ? raw.city.trim() : '';
  const label = [makeModel, year ? `(${year})` : '', fuel, reg ? `· ${reg}` : '', city ? `· ${city}` : '']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+·/g, ' ·')
    .trim();
  if (label) return label;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function normalizeServiceRequestResponse<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    vehicle: normalizeVehicleText(row.vehicle),
    carDetails: normalizeVehicleText(row.carDetails),
  };
}

function normalizeServiceRequestListResponse<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => normalizeServiceRequestResponse(row));
}

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

async function notifyCandidateProvidersOnOpenRequest(
  request: ServiceRequestPayload & { id: string },
): Promise<void> {
  const candidateProviderIds = Array.isArray(request.candidateProviderIds)
    ? request.candidateProviderIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (candidateProviderIds.length === 0) return;

  try {
    const providers = await Promise.all(
      candidateProviderIds.map(async (providerId) => {
        const provider = await supabaseServiceProviderService.findById(providerId);
        if (!provider?.email) return null;
        return { id: providerId, email: String(provider.email).toLowerCase().trim() };
      }),
    );
    const recipients = providers.filter((p): p is { id: string; email: string } => Boolean(p));
    if (recipients.length === 0) return;

    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const records = recipients.map((recipient, idx) => ({
      id: `${Date.now()}_${idx}_${recipient.id}`,
      recipient_email: recipient.email,
      type: 'service_request_open',
      title: 'New service request available',
      message: `${request.serviceType || 'General'} request in ${request.city || 'your area'}`,
      read: false,
      created_at: now,
      metadata: {
        requestId: request.id,
        providerId: recipient.id,
        serviceType: request.serviceType || 'General',
        city: request.city || '',
      },
    }));
    const { error } = await supabase.from('notifications').insert(records);
    if (error) {
      console.warn('Failed to create provider notifications for open request:', error.message);
    }
  } catch (error) {
    console.warn('Open request provider notification flow failed:', error);
  }
}

async function resolveRoleForSupabaseUser(decoded: {
  uid: string;
  email: string;
  user: { app_metadata?: { role?: string }; user_metadata?: { role?: string } } | null;
}): Promise<string> {
  let resolvedRole =
    decoded.user?.app_metadata?.role || decoded.user?.user_metadata?.role || 'customer';

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
  return String(resolvedRole);
}

/**
 * Order matches `getBrowserAccessTokenForApi`: try app JWT first, then Supabase.
 * Supabase getUser() rejects reRide tokens; if we try Supabase first, we still fall back, but
 * "Invalid token format" from jsonwebtoken for the wrong *kind* of JWT confused operators.
 */
async function resolveServiceRequestActor(req: VercelRequest): Promise<ActorInfo> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.substring(7).trim() === '') {
    throw new Error('Missing bearer token');
  }

  const legacy = authenticateRequest(req);
  if (legacy.isValid && legacy.user?.userId) {
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

  try {
    const decoded = await verifyIdTokenFromHeader(req);
    const resolvedRole = await resolveRoleForSupabaseUser(decoded);
    return { id: decoded.uid, role: resolvedRole };
  } catch (supabaseErr) {
    const supMsg = supabaseErr instanceof Error ? supabaseErr.message : String(supabaseErr);
    const legMsg = legacy.error;
    // reRide JWT and Supabase JWT use different secrets; a valid Supabase access token
    // always fails legacy verify with "Invalid token format". Do not chain that with
    // the real error (e.g. expired session) or operators see a useless combined message.
    const legacyFormatMismatch = !legacy.isValid && legMsg === 'Invalid token format';
    if (legMsg && supMsg && legMsg !== supMsg && !legacyFormatMismatch) {
      throw new Error(`Authentication failed: ${legMsg} | ${supMsg}`);
    }
    throw new Error(supMsg || legMsg || 'Authentication required');
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
        const rawCity = String((req.query.city as string) || '').trim();
        const cityFilter =
          rawCity.toLowerCase() === 'pending setup' ? '' : rawCity;
        const serviceTypeFilter = (req.query.serviceType as string) || '';
        const recentHours = Number(req.query.recentHours || 0);
        const recentCutoff =
          Number.isFinite(recentHours) && recentHours > 0
            ? Date.now() - recentHours * 60 * 60 * 1000
            : null;
        const filtered = records.filter((item) => {
          const cityMatches = cityFilter ? item.city?.toLowerCase() === cityFilter.toLowerCase() : true;
          const serviceMatches = serviceTypeFilter ? item.serviceType === serviceTypeFilter : true;
          const candidateOk =
            isAdmin || providerMatchesCandidateList(item.candidateProviderIds, actorId);
          const recentMatches =
            recentCutoff == null ||
            (item.createdAt ? new Date(item.createdAt).getTime() >= recentCutoff : true);
          return cityMatches && serviceMatches && candidateOk && recentMatches;
        });
        return res.status(200).json(normalizeServiceRequestListResponse(filtered));
      }

      if (scope === 'all') {
        if (!isAdmin) {
          return res.status(403).json({ error: 'Admin access required for scope=all' });
        }
        const all = await supabaseServiceRequestService.findAll();
        return res.status(200).json(normalizeServiceRequestListResponse(all));
      }

      if (scope === 'metrics') {
        if (!isAdmin) {
          return res.status(403).json({ error: 'Admin access required for scope=metrics' });
        }
        const all = await supabaseServiceRequestService.findAll();
        const totals = {
          total: all.length,
          open: 0,
          accepted: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
          unassigned: 0,
          assigned: 0,
        };
        const byCity: Record<string, number> = {};
        const byServiceType: Record<string, number> = {};
        for (const row of all) {
          const status = String(row.status || 'open') as keyof typeof totals;
          if (status in totals) totals[status] += 1;
          if (row.providerId) totals.assigned += 1;
          else totals.unassigned += 1;
          const city = String(row.city || 'unknown').trim().toLowerCase() || 'unknown';
          byCity[city] = (byCity[city] || 0) + 1;
          const serviceType = String(row.serviceType || 'General').trim() || 'General';
          byServiceType[serviceType] = (byServiceType[serviceType] || 0) + 1;
        }
        return res.status(200).json({ totals, byCity, byServiceType, generatedAt: new Date().toISOString() });
      }

      if (scope === 'customer') {
        const customerRecords = await supabaseServiceRequestService.findByCustomerId(actorId);
        return res.status(200).json(normalizeServiceRequestListResponse(customerRecords));
      }

      const records = await supabaseServiceRequestService.findByProviderId(actorId);
      return res.status(200).json(normalizeServiceRequestListResponse(records));
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
        vehicle: normalizeVehicleText(body.vehicle),
        city: body.city || '',
        addressLine: body.addressLine || '',
        pincode: body.pincode || '',
        status: (body.status as ServiceRequestPayload['status']) || 'open',
        scheduledAt: body.scheduledAt || '',
        notes: body.notes || '',
        carDetails: normalizeVehicleText(body.carDetails),
        services: Array.isArray(body.services) ? body.services : undefined,
        addressId: typeof body.addressId === 'string' ? body.addressId : undefined,
        slotId: typeof body.slotId === 'string' ? body.slotId : undefined,
        scheduledDate: typeof body.scheduledDate === 'string' ? body.scheduledDate : undefined,
        slotTimeLabel: typeof body.slotTimeLabel === 'string' ? body.slotTimeLabel : undefined,
        total: typeof body.total === 'number' ? body.total : undefined,
        couponCode: typeof body.couponCode === 'string' ? body.couponCode : undefined,
      };

      const created = await supabaseServiceRequestService.create(payload);
      await serviceRequestAuditService.log({
        requestId: String(created.id),
        actorId,
        actorRole: actor.role,
        action: 'request_created',
        previousStatus: null,
        nextStatus: created.status || 'open',
        details: {
          serviceType: created.serviceType || 'General',
          city: created.city || '',
          candidateCount: Array.isArray(created.candidateProviderIds) ? created.candidateProviderIds.length : 0,
        },
      });
      await notifyCandidateProvidersOnOpenRequest(created);
      return res.status(201).json(normalizeServiceRequestResponse(created));
    }

    if (req.method === 'PATCH') {
      const { id, action, ...updates } = req.body as Partial<ServiceRequestPayload> & {
        id?: string;
        action?: 'claim' | 'cancel' | 'submit_review';
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
        await serviceRequestAuditService.log({
          requestId: id,
          actorId,
          actorRole: actor.role,
          action: 'request_cancelled',
          previousStatus: existing.status || null,
          nextStatus: 'cancelled',
          details: { cancelledAt },
        });
        const updatedCancel = await supabaseServiceRequestService.findById(id);
        return res.status(200).json(normalizeServiceRequestResponse(updatedCancel || existing));
      }

      if (action === 'submit_review') {
        if (!isCustomerOwner) {
          return res.status(403).json({ error: 'Only the customer can submit a review' });
        }
        if (existing.status !== 'completed') {
          return res.status(409).json({ error: 'You can only review completed services' });
        }
        if (!existing.providerId) {
          return res.status(409).json({ error: 'No provider assigned to this request' });
        }
        const current = await supabaseServiceRequestService.findById(id);
        if (current?.customerReview?.submittedAt) {
          return res.status(409).json({ error: 'You have already submitted a review for this service' });
        }
        const body = req.body as { stars?: unknown; comment?: unknown };
        const rawStars = Number(body.stars);
        const stars = Math.round(rawStars);
        if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
          return res.status(400).json({ error: 'Invalid rating: provide stars between 1 and 5' });
        }
        const comment = String(body.comment || '').trim().slice(0, 2000);
        await supabaseServiceRequestService.update(id, {
          customerReview: {
            stars,
            ...(comment ? { comment } : {}),
            submittedAt: new Date().toISOString(),
          },
        });
        await serviceRequestAuditService.log({
          requestId: id,
          actorId,
          actorRole: actor.role,
          action: 'review_submitted',
          previousStatus: existing.status || null,
          nextStatus: existing.status || null,
          details: { stars, hasComment: Boolean(comment) },
        });
        await supabaseServiceProviderService.recalculateAverageRating(String(existing.providerId));
        const updatedReview = await supabaseServiceRequestService.findById(id);
        return res.status(200).json(normalizeServiceRequestResponse(updatedReview || existing));
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
        await serviceRequestAuditService.log({
          requestId: id,
          actorId,
          actorRole: actor.role,
          action: 'request_claimed',
          previousStatus: existing.status || null,
          nextStatus: 'accepted',
          details: { providerId: actorId },
        });
        const updatedClaim = await supabaseServiceRequestService.findById(id);
        return res.status(200).json(normalizeServiceRequestResponse(updatedClaim || existing));
      }

      if (!isAdmin && existing.providerId !== actorId) {
        return res.status(403).json({ error: 'Not allowed to update this request' });
      }

      const normalizedStatus = updates.status as ServiceRequestPayload['status'] | undefined;
      const providerOwnsRequest = existing.providerId === actorId;

      // Terminal status guard: once cancelled/completed, providers cannot move the request again.
      if (normalizedStatus && normalizedStatus !== existing.status) {
        if (existing.status === 'cancelled') {
          return res.status(409).json({ error: 'Cancelled requests are locked and cannot be updated' });
        }
        if (existing.status === 'completed') {
          return res.status(409).json({ error: 'Completed requests are locked and cannot be updated' });
        }
      }

      // Only the customer cancellation flow (action=cancel) can set cancelled status.
      if (
        normalizedStatus === 'cancelled' &&
        !isAdmin &&
        !isCustomerOwner &&
        providerOwnsRequest
      ) {
        return res.status(403).json({ error: 'Providers cannot cancel customer requests' });
      }

      if (normalizedStatus) {
        const current = existing.status;
        const allowedTransitions: Record<string, string[]> = {
          accepted: ['in_progress'],
          in_progress: ['completed'],
          completed: [],
          cancelled: [],
          open: [],
        };
        const nextAllowed = (current ? allowedTransitions[current] : undefined) || [];
        if (normalizedStatus !== current && !nextAllowed.includes(normalizedStatus)) {
          return res.status(409).json({
            error: `Invalid status transition from ${current} to ${normalizedStatus}`,
          });
        }
      }
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
      if (normalizedStatus && normalizedStatus !== existing.status) {
        await serviceRequestAuditService.log({
          requestId: id,
          actorId,
          actorRole: actor.role,
          action: 'status_changed',
          previousStatus: existing.status || null,
          nextStatus: normalizedStatus,
          details: {
            startedAt: updates.startedAt || null,
            completedAt: updates.completedAt || null,
            cancelledAt: updates.cancelledAt || null,
          },
        });
      }
      const updated = await supabaseServiceRequestService.findById(id);
      return res.status(200).json(normalizeServiceRequestResponse(updated || existing));
    }

    if (req.method === 'DELETE') {
      const id = String((req.query.id as string) || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Missing request id' });
      }
      const existing = await supabaseServiceRequestService.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Request not found' });
      }

      const isProviderOwner = existing.providerId === actorId;
      const isCustomerOwner = existing.customerId === actorId;
      if (!isAdmin && !isProviderOwner && !isCustomerOwner) {
        return res.status(403).json({ error: 'Not allowed to delete this request' });
      }
      if (existing.status !== 'cancelled') {
        return res.status(409).json({ error: 'Only cancelled requests can be deleted' });
      }

      await supabaseServiceRequestService.delete(id);
      await serviceRequestAuditService.log({
        requestId: id,
        actorId,
        actorRole: actor.role,
        action: 'request_deleted',
        previousStatus: existing.status || null,
        nextStatus: null,
      });
      return res.status(200).json({ success: true });
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


import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequestDual } from './auth.js';
import { supabaseServiceRequestService } from '../services/supabase-service-request-service.js';
import type { ServiceLineItem, ServiceRequestPayload } from '../services/supabase-service-request-service.js';
import { supabaseUserService } from '../services/supabase-user-service.js';
import { supabaseServiceProviderService } from '../services/supabase-service-provider-service.js';
import { serviceRequestAuditService } from '../services/service-request-audit-service.js';
import { applyCors } from '../lib/api-route-cors.js';
import { getSupabaseAdminClient } from '../lib/supabase-admin.js';
import {
  assignedWorkshopId,
  collectProviderIdAliases,
  incomingVisibleToProvider,
  providerMatchesActor,
} from '../utils/workshopBooking.js';
import { completeLineTotal } from '../utils/pricedServiceTotal.js';
import { insertAppNotifications } from '../server/insert-app-notification.js';

type ProviderCatalogService = {
  price?: number;
  active?: boolean;
  includedServices?: Array<{ id: string; price?: number; active?: boolean }>;
};

async function resolvePricedServices(
  providerId: string | null,
  services: ServiceLineItem[] | undefined,
): Promise<{ services?: ServiceLineItem[]; total?: number }> {
  if (!services?.length) return { services };
  if (!providerId) {
    return {
      services: services.map((line) => ({
        id: String(line.id || ''),
        name: String(line.name || line.id || ''),
        quantity: Math.max(1, Number(line.quantity) || 1),
      })),
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('service_providers')
    .select('metadata')
    .eq('id', providerId)
    .maybeSingle();
  const catalog = ((data?.metadata as { services?: Record<string, ProviderCatalogService> } | null)?.services)
    || {};

  const priced: ServiceLineItem[] = [];
  for (const line of services) {
    const qty = Math.max(1, Number(line.quantity) || 1);
    const raw = line as ServiceLineItem & { serviceType?: string; includedServiceId?: string };
    const key = String(raw.serviceType || raw.name || raw.id || '').trim();
    const entry = catalog[key];
    let unit: number | undefined;
    if (entry && entry.active !== false) {
      if (raw.includedServiceId && Array.isArray(entry.includedServices)) {
        const inc = entry.includedServices.find(
          (i) => String(i.id) === String(raw.includedServiceId) && i.active !== false,
        );
        unit = inc?.price != null && Number.isFinite(Number(inc.price)) && Number(inc.price) >= 0
          ? Number(inc.price)
          : undefined;
      } else if (entry.price != null && Number.isFinite(Number(entry.price)) && Number(entry.price) >= 0) {
        unit = Number(entry.price);
      }
    }
    const item: ServiceLineItem = {
      id: String(line.id || key),
      name: String(line.name || key),
      quantity: qty,
      ...(unit != null ? { price: unit } : {}),
    };
    priced.push(item);
  }
  return { services: priced, total: completeLineTotal(priced) };
}

/**
 * Customers and providers authenticate with either a Supabase session JWT or the legacy
 * app JWT stored as reRideAccessToken (same pattern as api/services.ts). Service requests
 * previously only accepted Supabase tokens, so email/password logins failed verification.
 */
type ActorInfo = {
  id: string;
  role: string;
  email?: string;
  canonicalProviderId: string;
  aliases: string[];
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

async function notifyProvidersOnOpenRequest(
  request: ServiceRequestPayload & { id: string },
): Promise<void> {
  try {
    const assignedId = assignedWorkshopId(request);
    const candidateProviderIds = Array.isArray(request.candidateProviderIds)
      ? request.candidateProviderIds.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const notifyIds = assignedId ? [assignedId] : candidateProviderIds;

    let recipients: { id: string; email: string }[] = [];

    if (notifyIds.length > 0) {
      const supabase = getSupabaseAdminClient();
      const idKeys = notifyIds.filter((id) => !id.includes('@'));
      const emailKeys = notifyIds.filter((id) => id.includes('@')).map((id) => id.toLowerCase());
      const [byId, byEmail] = await Promise.all([
        idKeys.length
          ? supabase.from('service_providers').select('id, email').in('id', idKeys)
          : Promise.resolve({ data: [] as { id?: string; email?: string }[] }),
        emailKeys.length
          ? supabase.from('service_providers').select('id, email').in('email', emailKeys)
          : Promise.resolve({ data: [] as { id?: string; email?: string }[] }),
      ]);
      const seen = new Set<string>();
      for (const provider of [...(byId.data || []), ...(byEmail.data || [])]) {
        const email = String(provider.email || '').toLowerCase().trim();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        recipients.push({ id: String(provider.id || email), email });
      }
    }

    if (recipients.length === 0) return;

    await insertAppNotifications(recipients.map((recipient) => ({
      recipientEmail: recipient.email,
      type: 'service_request',
      title: 'New order',
      message: `${request.serviceType || 'General'} order${request.city ? ` in ${request.city}` : ''} — tap to accept`,
      metadata: {
        targetType: 'service_request',
        targetId: request.id,
        requestId: request.id,
        providerId: recipient.id,
        serviceType: request.serviceType || 'General',
        city: request.city || '',
        action: 'request_created',
      },
    })));
  } catch (error) {
    console.warn('Open request provider notification flow failed:', error);
  }
}

const STATUS_LABELS: Record<string, string> = {
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

async function notifyCustomerOnStatusChange(
  request: ServiceRequestPayload & { id: string },
  previousStatus: string | null,
  newStatus: string,
  providerId?: string | null,
): Promise<void> {
  try {
    const customerEmail = String(request.customerEmail || '').toLowerCase().trim();
    const customerId = String(request.customerId || '').trim();
    if (!customerEmail && !customerId) return;

    let recipientEmail = customerEmail;
    if (!recipientEmail && customerId) {
      try {
        const user = await supabaseUserService.findById(customerId);
        recipientEmail = String(user?.email || '').toLowerCase().trim();
      } catch {
        /* best effort */
      }
    }
    if (!recipientEmail) return;

    let providerName = '';
    if (providerId) {
      try {
        const sp = await supabaseServiceProviderService.findById(providerId);
        providerName = sp?.name || '';
      } catch {
        /* ignore */
      }
    }

    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    const serviceLabel = request.serviceType || 'General';
    let title = '';
    let message = '';

    switch (newStatus) {
      case 'accepted':
        title = 'Service request accepted';
        message = providerName
          ? `${providerName} accepted your ${serviceLabel} request`
          : `Your ${serviceLabel} request has been accepted by a workshop`;
        break;
      case 'in_progress':
        title = 'Service started';
        message = providerName
          ? `${providerName} has started working on your ${serviceLabel} service`
          : `Your ${serviceLabel} service is now in progress`;
        break;
      case 'completed':
        title = 'Service completed';
        message = `Your ${serviceLabel} service is complete! Please review your experience`;
        break;
      case 'cancelled':
        title = 'Service request cancelled';
        message = `Your ${serviceLabel} request has been cancelled`;
        break;
      default:
        title = `Request status: ${statusLabel}`;
        message = `Your ${serviceLabel} request status changed to ${statusLabel}`;
    }

    await insertAppNotifications([{
      recipientEmail,
      type: 'service_request',
      title,
      message,
      metadata: {
        targetType: 'service_request',
        targetId: request.id,
        requestId: request.id,
        previousStatus,
        newStatus,
        serviceType: serviceLabel,
        providerId: providerId || null,
        providerName: providerName || null,
      },
    }]);
  } catch (error) {
    console.warn('Customer notification flow failed:', error);
  }
}

async function notifyProviderOnCancel(
  request: ServiceRequestPayload & { id: string },
): Promise<void> {
  try {
    if (!request.providerId) return;
    const provider = await supabaseServiceProviderService.findById(String(request.providerId));
    if (!provider?.email) return;
    const recipientEmail = String(provider.email).toLowerCase().trim();
    if (!recipientEmail) return;

    await insertAppNotifications([{
      recipientEmail,
      type: 'service_request',
      title: 'Customer cancelled request',
      message: `${request.customerName || 'Customer'} cancelled their ${request.serviceType || 'General'} request`,
      metadata: {
        targetType: 'service_request',
        targetId: request.id,
        requestId: request.id,
        action: 'request_cancelled',
        serviceType: request.serviceType || 'General',
      },
    }]);
  } catch (error) {
    console.warn('Provider cancel notification flow failed:', error);
  }
}

async function resolveServiceRequestActor(req: VercelRequest): Promise<ActorInfo> {
  const auth = await authenticateRequestDual(req);
  if (!auth.isValid || !auth.user?.userId) {
    throw new Error(auth.error || 'Authentication required');
  }

  const jwtId = auth.user.userId;
  const email = String(auth.user.email || '').toLowerCase().trim();
  let resolvedRole = auth.user.role || 'customer';
  const aliasParts: Array<string | undefined> = [jwtId, email];
  let canonicalProviderId = jwtId;

  try {
    const byId = await supabaseServiceProviderService.findById(jwtId);
    const byEmail = !byId && email ? await supabaseServiceProviderService.findByEmail(email) : byId;
    if (byEmail) {
      resolvedRole = 'service_provider';
      canonicalProviderId = String((byEmail as { id?: string }).id || jwtId);
      aliasParts.push(canonicalProviderId, byEmail.email);
    }
  } catch {
    /* ignore */
  }

  if (isServiceProviderRole(String(resolvedRole)) && email) {
    try {
      const user = await supabaseUserService.findByEmail(email);
      if (user?.id) aliasParts.push(user.id);
      if (user?.firebaseUid) aliasParts.push(user.firebaseUid);
    } catch {
      /* ignore */
    }
  }

  return {
    id: jwtId,
    role: String(resolvedRole),
    email,
    canonicalProviderId,
    aliases: collectProviderIdAliases(...aliasParts),
  };
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
          const incomingOk =
            isAdmin || incomingVisibleToProvider(item, actor.aliases);
          const recentMatches =
            recentCutoff == null ||
            (item.createdAt ? new Date(item.createdAt).getTime() >= recentCutoff : true);
          return cityMatches && serviceMatches && incomingOk && recentMatches;
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

      const records = await supabaseServiceRequestService.findByProviderIds(actor.aliases);
      return res.status(200).json(normalizeServiceRequestListResponse(records));
    }

    if (req.method === 'POST') {
      const body = req.body as Partial<ServiceRequestPayload>;
      if (!body.title) {
        return res.status(400).json({ error: 'Missing required field: title' });
      }

      const requestedWorkshop = assignedWorkshopId({
        providerId: body.providerId,
        candidateProviderIds: body.candidateProviderIds,
      });
      if (!isAdmin && !requestedWorkshop) {
        return res.status(400).json({ error: 'Choose a workshop' });
      }

      let canonicalAssigned: string | null = requestedWorkshop;
      if (requestedWorkshop) {
        const byId = await supabaseServiceProviderService.findById(requestedWorkshop);
        const byEmail =
          !byId && requestedWorkshop.includes('@')
            ? await supabaseServiceProviderService.findByEmail(requestedWorkshop)
            : byId;
        if (byEmail) {
          canonicalAssigned = String((byEmail as { id?: string }).id || requestedWorkshop);
        }
      }

      let customerName = '';
      let customerEmail = actor.email || '';
      let customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
      try {
        const user =
          (await supabaseUserService.findById(actorId))
          || (actor.email ? await supabaseUserService.findByEmail(actor.email) : null);
        if (user) {
          customerName = String(user.name || '').trim();
          customerEmail = String(user.email || customerEmail).toLowerCase().trim();
          if (!customerPhone) customerPhone = String((user as { mobile?: string }).mobile || '').trim();
        }
      } catch {
        /* best effort — fall back to auth email */
      }
      // Admins may book on behalf of a customer; everyone else uses their own profile.
      if (isAdmin) {
        if (typeof body.customerName === 'string' && body.customerName.trim()) {
          customerName = body.customerName.trim();
        }
        if (typeof body.customerEmail === 'string' && body.customerEmail.trim()) {
          customerEmail = body.customerEmail.trim().toLowerCase();
        }
      }

      const rawServices = Array.isArray(body.services) ? (body.services as ServiceLineItem[]) : undefined;
      const priced = await resolvePricedServices(canonicalAssigned, rawServices);

      const payload: ServiceRequestPayload = {
        providerId: canonicalAssigned,
        customerId: actorId,
        candidateProviderIds: canonicalAssigned ? [canonicalAssigned] : [],
        title: body.title,
        serviceType: body.serviceType || 'General',
        customerName,
        customerPhone,
        customerEmail,
        vehicle: normalizeVehicleText(body.vehicle),
        city: body.city || '',
        addressLine: body.addressLine || '',
        pincode: body.pincode || '',
        status: isAdmin && body.status ? (body.status as ServiceRequestPayload['status']) : 'open',
        scheduledAt: body.scheduledAt || '',
        notes: body.notes || '',
        carDetails: normalizeVehicleText(body.carDetails),
        services: priced.services,
        addressId: typeof body.addressId === 'string' ? body.addressId : undefined,
        slotId: typeof body.slotId === 'string' ? body.slotId : undefined,
        scheduledDate: typeof body.scheduledDate === 'string' ? body.scheduledDate : undefined,
        slotTimeLabel: typeof body.slotTimeLabel === 'string' ? body.slotTimeLabel : undefined,
        total: priced.total,
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
      await notifyProvidersOnOpenRequest(created);
      return res.status(201).json(normalizeServiceRequestResponse(created));
    }

    if (req.method === 'PATCH') {
      const { id, action, status } = req.body as Partial<ServiceRequestPayload> & {
        id?: string;
        action?: 'claim' | 'accept' | 'decline' | 'cancel' | 'submit_review';
      };
      // Only status is client-writable; reviews, ownership and totals have dedicated actions.
      const updates: Partial<ServiceRequestPayload> = status ? { status } : {};
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
        const cancelled = await supabaseServiceRequestService.updateIfStatus(
          id,
          ['open', 'accepted'],
          { status: 'cancelled', cancelledAt },
        );
        if (!cancelled) {
          return res.status(409).json({ error: 'Request cannot be cancelled' });
        }
        await serviceRequestAuditService.log({
          requestId: id,
          actorId,
          actorRole: actor.role,
          action: 'request_cancelled',
          previousStatus: existing.status || null,
          nextStatus: 'cancelled',
          details: { cancelledAt },
        });
        await notifyProviderOnCancel(existing);
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
        if (existing.customerReview?.submittedAt) {
          return res.status(409).json({ error: 'You have already submitted a review for this service' });
        }
        const body = req.body as { stars?: unknown; comment?: unknown };
        const rawStars = Number(body.stars);
        const stars = Math.round(rawStars);
        if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
          return res.status(400).json({ error: 'Invalid rating: provide stars between 1 and 5' });
        }
        const comment = String(body.comment || '').trim().slice(0, 2000);
        const reviewed = await supabaseServiceRequestService.updateIfNoReview(id, {
          customerReview: {
            stars,
            ...(comment ? { comment } : {}),
            submittedAt: new Date().toISOString(),
          },
        });
        if (!reviewed) {
          return res.status(409).json({ error: 'You have already submitted a review for this service' });
        }
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

      if (action === 'claim' || action === 'accept') {
        if (!isAdmin && !isServiceProviderRole(actor.role)) {
          return res.status(403).json({ error: 'Only service providers can accept orders' });
        }
        if (!isAdmin && !incomingVisibleToProvider(existing, actor.aliases)) {
          return res.status(403).json({ error: 'This order is not assigned to your workshop' });
        }
        if (existing.status !== 'open') {
          return res.status(409).json({ error: 'Order already accepted' });
        }
        const canonical = actor.canonicalProviderId;
        const accepted = await supabaseServiceRequestService.updateIfOpen(
          id,
          {
            providerId: canonical,
            status: 'accepted',
            claimedAt: new Date().toISOString(),
          },
          existing.providerId ?? null,
        );
        if (!accepted) {
          return res.status(409).json({ error: 'Order already accepted' });
        }
        await serviceRequestAuditService.log({
          requestId: id,
          actorId,
          actorRole: actor.role,
          action: 'request_claimed',
          previousStatus: existing.status || null,
          nextStatus: 'accepted',
          details: { providerId: canonical },
        });
        await notifyCustomerOnStatusChange(existing, existing.status || 'open', 'accepted', canonical);
        const updatedClaim = await supabaseServiceRequestService.findById(id);
        return res.status(200).json(normalizeServiceRequestResponse(updatedClaim || existing));
      }

      if (action === 'decline') {
        if (!isAdmin && !isServiceProviderRole(actor.role)) {
          return res.status(403).json({ error: 'Only service providers can decline orders' });
        }
        if (!isAdmin && !incomingVisibleToProvider(existing, actor.aliases)) {
          return res.status(403).json({ error: 'This order is not assigned to your workshop' });
        }
        if (existing.status !== 'open') {
          return res.status(409).json({ error: 'Only waiting orders can be declined' });
        }
        const cancelledAt = new Date().toISOString();
        const declined = await supabaseServiceRequestService.updateIfStatus(id, 'open', {
          status: 'cancelled',
          cancelledAt,
          providerId: existing.providerId || actor.canonicalProviderId,
        });
        if (!declined) {
          return res.status(409).json({ error: 'Only waiting orders can be declined' });
        }
        await serviceRequestAuditService.log({
          requestId: id,
          actorId,
          actorRole: actor.role,
          action: 'request_declined',
          previousStatus: existing.status || null,
          nextStatus: 'cancelled',
          details: { providerId: actor.canonicalProviderId },
        });
        await notifyCustomerOnStatusChange(
          existing,
          existing.status || 'open',
          'cancelled',
          actor.canonicalProviderId,
        );
        const updatedDecline = await supabaseServiceRequestService.findById(id);
        return res.status(200).json(normalizeServiceRequestResponse(updatedDecline || existing));
      }

      const providerOwnsRequest = providerMatchesActor(existing.providerId, actor.aliases);
      if (!isAdmin && !providerOwnsRequest) {
        return res.status(403).json({ error: 'Not allowed to update this request' });
      }

      const normalizedStatus = updates.status as ServiceRequestPayload['status'] | undefined;
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
          open: ['accepted'],
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

      if (normalizedStatus && normalizedStatus !== existing.status) {
        const transitioned = await supabaseServiceRequestService.updateIfStatus(
          id,
          existing.status || 'open',
          updates,
        );
        if (!transitioned) {
          return res.status(409).json({
            error: `Invalid status transition from ${existing.status} to ${normalizedStatus}`,
          });
        }
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
        await notifyCustomerOnStatusChange(
          existing,
          existing.status || null,
          normalizedStatus,
          existing.providerId || updates.providerId || null,
        );
        if (normalizedStatus === 'completed') {
          const providerId = String(existing.providerId || updates.providerId || '').trim();
          if (providerId) {
            try {
              const { syncProviderTrustMetadata } = await import('../services/provider-trust-stats.js');
              await syncProviderTrustMetadata(providerId);
            } catch (syncErr) {
              console.warn('Provider trust sync after completion failed:', syncErr);
            }
          }
        }
      } else {
        await supabaseServiceRequestService.update(id, updates);
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

      const isProviderOwner = providerMatchesActor(existing.providerId, actor.aliases);
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
    if (isAuthFailure) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

// Vercel serverless expects a default export when the module is loaded directly
export default handleServiceRequests;


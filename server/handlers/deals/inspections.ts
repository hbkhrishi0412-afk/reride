import { getSupabaseAdminClient } from '../handler-shared.js';
import type { DealInspectionBookingStatus, DealLeadMetadata, DealStage } from '../../types.js';
import type { DealActionHandler } from './context.js';
import {
  assertDealParticipant,
  fetchLeadWithTimeline,
  firstQueryParam,
  generateId,
  getAuthEmail,
  insertDealNotification,
  insertTimelineEvent,
  mapInspectionBookingRow,
  normalizeEmail,
  syncKanbanStatus,
  updateLeadStage,
  INSPECTION_BOOKING_STAGES,
} from './shared.js';

const BOOKING_STATUSES: DealInspectionBookingStatus[] = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
];

/** Mechanic inspection booking lifecycle. */
export const handleInspections: DealActionHandler = async (ctx) => {
  const { req, res, subPath, method } = ctx;

  if (method === 'POST' && subPath === 'book-inspection') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const scheduledDate = String(body.scheduledDate || '').trim();
    const scheduledTime = String(body.scheduledTime || '').trim();
    const address = String(body.address || '').trim();
    const notes = body.notes ? String(body.notes) : undefined;
    const mechanicName = body.mechanicName ? String(body.mechanicName) : undefined;

    if (!leadId || !scheduledDate || !scheduledTime || !address) {
      res.status(400).json({
        success: false,
        reason: 'leadId, scheduledDate, scheduledTime, and address are required',
      });
      return true;
    }

    const participant = await assertDealParticipant(leadId, auth);
    if (!participant) {
      res.status(403).json({ success: false, reason: 'Not authorized or lead not found' });
      return true;
    }

    const currentStage = String(participant.row.current_stage);
    const meta = (participant.row.metadata || {}) as DealLeadMetadata;
    const offerAccepted =
      INSPECTION_BOOKING_STAGES.has(currentStage as DealStage) ||
      Boolean(meta.acceptedOfferAmount) ||
      meta.offers?.some((o) => o.status === 'accepted');
    if (!offerAccepted) {
      res.status(400).json({
        success: false,
        reason: 'Inspection can only be booked after an offer is accepted',
      });
      return true;
    }

    const bookingId = generateId('insp');
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();

    const { error: insertError } = await supabase.from('deal_inspection_bookings').insert({
      id: bookingId,
      lead_id: leadId,
      booked_by: auth.email,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      address,
      notes: notes || null,
      mechanic_name: mechanicName || null,
      status: 'scheduled',
      created_at: now,
      updated_at: now,
    });
    if (insertError) {
      res.status(500).json({ success: false, reason: insertError.message });
      return true;
    }

    const metadata = { ...(participant.row.metadata as DealLeadMetadata) };
    metadata.inspection = {
      ...metadata.inspection,
      requestedAt: metadata.inspection?.requestedAt || now,
      bookingId,
      scheduledDate,
      scheduledTime,
      address,
      mechanicName,
    };
    if (
      metadata.assistanceFulfillment?.needsInspectionBooking
      && metadata.assistanceFulfillment.status !== 'completed'
      && metadata.assistanceFulfillment.status !== 'cancelled'
    ) {
      metadata.assistanceFulfillment = {
        ...metadata.assistanceFulfillment,
        status: 'in_progress',
      };
    }

    const stage = participant.row.current_stage as DealStage;
    const updates: Record<string, unknown> = {
      metadata,
      updated_at: now,
    };
    if (!['inspection_requested', 'inspection_completed'].includes(stage)) {
      updates.current_stage = 'inspection_requested';
    }
    await supabase.from('deal_leads').update(updates).eq('id', leadId);
    await syncKanbanStatus(leadId);

    await insertTimelineEvent({
      leadId,
      stage: 'inspection_requested',
      eventType: 'inspection_booked',
      actorEmail: auth.email,
      label: `Inspection booked: ${scheduledDate} ${scheduledTime}`,
      payload: { bookingId, scheduledDate, scheduledTime, address },
    });

    const sellerEmail = normalizeEmail(String(participant.row.seller_email));
    const buyerEmail = normalizeEmail(String(participant.row.buyer_email));
    const notifyEmail = auth.email === buyerEmail ? sellerEmail : buyerEmail;
    await insertDealNotification({
      recipientEmail: notifyEmail,
      title: 'Inspection scheduled',
      message: `Mechanic visit booked for ${scheduledDate} at ${scheduledTime}`,
      leadId,
      conversationId: participant.row.conversation_id
        ? String(participant.row.conversation_id)
        : undefined,
    });

    const booking = mapInspectionBookingRow({
      id: bookingId,
      lead_id: leadId,
      booked_by: auth.email,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      address,
      notes: notes || null,
      mechanic_name: mechanicName || null,
      status: 'scheduled',
      created_at: now,
      updated_at: now,
    });

    const lead = await fetchLeadWithTimeline(leadId);
    res.status(201).json({ success: true, booking, lead });
    return true;
  }

  if (method === 'GET' && subPath === 'inspection-bookings') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const leadId = firstQueryParam(req.query?.leadId);
    const supabase = getSupabaseAdminClient();

    if (leadId) {
      const participant = await assertDealParticipant(leadId, auth);
      if (!participant) {
        res.status(403).json({ success: false, reason: 'Not authorized' });
        return true;
      }
      const { data: rows, error } = await supabase
        .from('deal_inspection_bookings')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) {
        res.status(500).json({ success: false, reason: error.message });
        return true;
      }
      res.status(200).json({
        success: true,
        bookings: (rows || []).map(mapInspectionBookingRow),
      });
      return true;
    }

    if (auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const { data: rows, error } = await supabase
      .from('deal_inspection_bookings')
      .select('*')
      .in('status', ['scheduled', 'confirmed'])
      .order('scheduled_date', { ascending: true })
      .limit(100);

    if (error) {
      res.status(500).json({ success: false, reason: error.message });
      return true;
    }

    res.status(200).json({
      success: true,
      bookings: (rows || []).map(mapInspectionBookingRow),
    });
    return true;
  }

  if (method === 'POST' && subPath === 'update-inspection-booking') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const bookingId = String(body.bookingId || '');
    const status = String(body.status || '') as DealInspectionBookingStatus;
    const mechanicName = body.mechanicName ? String(body.mechanicName) : undefined;

    if (!bookingId || !BOOKING_STATUSES.includes(status)) {
      res.status(400).json({ success: false, reason: 'bookingId and valid status required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase
      .from('deal_inspection_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    if (!existing) {
      res.status(404).json({ success: false, reason: 'Booking not found' });
      return true;
    }

    const leadId = String(existing.lead_id);
    const participant = await assertDealParticipant(leadId, auth);
    if (!participant) {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status, updated_at: now };
    if (mechanicName !== undefined) updates.mechanic_name = mechanicName;

    const { error } = await supabase
      .from('deal_inspection_bookings')
      .update(updates)
      .eq('id', bookingId);
    if (error) {
      res.status(500).json({ success: false, reason: error.message });
      return true;
    }

    if (status === 'completed') {
      const metadata = { ...(participant.row.metadata as DealLeadMetadata) };
      metadata.inspection = {
        ...metadata.inspection,
        completedAt: now,
        mechanicName: mechanicName || metadata.inspection?.mechanicName,
      };
      await updateLeadStage(leadId, 'inspection_completed', { metadata });
      await insertTimelineEvent({
        leadId,
        stage: 'inspection_completed',
        eventType: 'inspection_completed',
        actorEmail: auth.email,
        label: 'Inspection visit completed',
      });
    }

    const booking = mapInspectionBookingRow({ ...existing, ...updates });
    res.status(200).json({ success: true, booking });
    return true;
  }

  return false;
};

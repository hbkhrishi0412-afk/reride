import { getSupabaseAdminClient } from '../../handler-shared.js';
import type { DealLeadMetadata, DealStage } from '../../../types.js';
import { validateAdvanceStage } from './stage-validation.js';
import type { DealActionHandler } from './context.js';
import {
  assertDealParticipant,
  fetchLeadWithTimeline,
  generateId,
  getAuthEmail,
  insertTimelineEvent,
  normalizeEmail,
  syncDualWriteForStage,
  tryInsertDealOffer,
  tryUpdateDealOfferStatus,
  updateLeadStage,
  markVehicleSoldForCompletedDeal,
} from './shared.js';

/** Pipeline stage advancement and offer responses. */
export const handleStageHandlers: DealActionHandler = async (ctx) => {
  const { req, res, subPath, method } = ctx;

  if (method === 'POST' && subPath === 'advance-stage') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const stage = String(body.stage || '') as DealStage;
    const payload = (body.payload || {}) as Record<string, unknown>;

    if (!leadId || !stage) {
      res.status(400).json({ success: false, reason: 'leadId and stage are required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: row } = await supabase.from('deal_leads').select('*').eq('id', leadId).single();
    if (!row) {
      res.status(404).json({ success: false, reason: 'Lead not found' });
      return true;
    }

    const sellerEmail = normalizeEmail(String(row.seller_email));
    const buyerEmail = normalizeEmail(String(row.buyer_email));
    const isParticipant = auth.email === sellerEmail || auth.email === buyerEmail;
    if (!isParticipant && auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    const stageError = validateAdvanceStage({ stage, row, auth, payload });
    if (stageError) {
      res.status(400).json({ success: false, reason: stageError });
      return true;
    }

    const metadata = { ...(row.metadata as DealLeadMetadata) };
    let label = String(body.label || stage);

    switch (stage) {
      case 'test_drive_scheduled':
        metadata.testDrive = {
          date: String(payload.date || ''),
          time: String(payload.time || ''),
          status: 'confirmed',
        };
        label = 'Test Drive Scheduled';
        break;
      case 'test_drive_completed':
        metadata.testDrive = {
          ...metadata.testDrive,
          date: metadata.testDrive?.date || '',
          time: metadata.testDrive?.time || '',
          status: 'completed',
        };
        label = 'Test Drive Completed';
        break;
      case 'offer_made': {
        const offerId = generateId('offer');
        const offers = metadata.offers || [];
        offers.push({
          id: offerId,
          amount: Number(payload.amount),
          offeredBy: auth.email === buyerEmail ? 'buyer' : 'seller',
          status: 'pending',
          parentOfferId: payload.parentOfferId ? String(payload.parentOfferId) : undefined,
          createdAt: new Date().toISOString(),
        });
        metadata.offers = offers;
        metadata.currentOfferId = offerId;
        label = `Offer: ₹${Number(payload.amount).toLocaleString('en-IN')}`;
        break;
      }
      case 'offer_accepted': {
        const amount = Number(payload.amount);
        metadata.acceptedOfferAmount = amount;
        if (metadata.offers && metadata.currentOfferId) {
          metadata.offers = metadata.offers.map((o) =>
            o.id === metadata.currentOfferId ? { ...o, status: 'accepted' } : o,
          );
        }
        label = `Price agreed: ₹${amount.toLocaleString('en-IN')}`;
        break;
      }
      case 'inspection_requested':
        metadata.inspection = { requestedAt: new Date().toISOString() };
        label = 'Inspection Requested';
        break;
      case 'inspection_completed':
        metadata.inspection = {
          ...metadata.inspection,
          reportUrl: payload.reportUrl ? String(payload.reportUrl) : undefined,
          mechanicName: payload.mechanicName ? String(payload.mechanicName) : undefined,
          completedAt: new Date().toISOString(),
        };
        label = 'Inspection Completed';
        break;
      case 'token_uploaded':
        metadata.token = {
          receiptUrl: String(payload.receiptUrl || ''),
          amount: payload.amount ? Number(payload.amount) : undefined,
          uploadedAt: new Date().toISOString(),
        };
        label = 'Token Receipt Uploaded';
        break;
      case 'token_confirmed':
        metadata.token = { ...metadata.token, confirmedAt: new Date().toISOString() };
        label = 'Token Confirmed';
        break;
      case 'delivery_pending':
        if (auth.email === buyerEmail) {
          metadata.delivery = { ...metadata.delivery, buyerConfirmedAt: new Date().toISOString() };
          label = 'Buyer: Vehicle Received';
        } else {
          metadata.delivery = { ...metadata.delivery, sellerConfirmedAt: new Date().toISOString() };
          label = 'Seller: Vehicle Delivered';
        }
        break;
      case 'delivery_completed':
        label = 'Delivery Completed';
        break;
      case 'documents_pending':
        if (auth.email === buyerEmail && payload.saleAgreementUrl) {
          metadata.documents = {
            ...metadata.documents,
            saleAgreementUrl: String(payload.saleAgreementUrl),
            buyerUploadedAt: new Date().toISOString(),
          };
          label = 'Sale Agreement Uploaded';
        } else if (auth.email === sellerEmail && payload.deliveryNoteUrl) {
          metadata.documents = {
            ...metadata.documents,
            deliveryNoteUrl: String(payload.deliveryNoteUrl),
            sellerUploadedAt: new Date().toISOString(),
          };
          label = 'Delivery Note Uploaded';
        }
        break;
      case 'documents_completed':
        label = 'Documents Completed';
        break;
      case 'rc_pending':
        metadata.rc = {
          transferDocUrl: payload.transferDocUrl ? String(payload.transferDocUrl) : undefined,
          sellerUploadedAt: new Date().toISOString(),
        };
        label = 'RC Transfer Started';
        break;
      case 'rc_completed':
        metadata.rc = { ...metadata.rc, buyerConfirmedAt: new Date().toISOString() };
        label = 'RC Transfer Completed';
        break;
      case 'deal_completed':
        label = 'Deal Completed';
        break;
      default:
        break;
    }

    const isComplete = stage === 'deal_completed';
    await updateLeadStage(leadId, stage, {
      metadata,
      status: isComplete ? 'completed' : undefined,
      completedAt: isComplete ? new Date().toISOString() : undefined,
    });

    await insertTimelineEvent({
      leadId,
      stage,
      eventType: stage,
      actorEmail: auth.email,
      label,
      payload,
    });

    await syncDualWriteForStage(leadId, stage, metadata, auth.email);

    if (isComplete) {
      await markVehicleSoldForCompletedDeal(String(row.vehicle_id));
    }

    if (stage === 'delivery_pending') {
      const d = metadata.delivery;
      if (d?.buyerConfirmedAt && d?.sellerConfirmedAt) {
        await updateLeadStage(leadId, 'delivery_completed', { metadata });
        await insertTimelineEvent({
          leadId,
          stage: 'delivery_completed',
          eventType: 'delivery_completed',
          label: 'Delivery Completed',
        });
      }
    }

    if (stage === 'documents_pending') {
      const docs = metadata.documents;
      if (docs?.saleAgreementUrl && docs?.deliveryNoteUrl) {
        await updateLeadStage(leadId, 'documents_completed', { metadata });
        await insertTimelineEvent({
          leadId,
          stage: 'documents_completed',
          eventType: 'documents_completed',
          label: 'Documents Completed',
        });
      }
    }

    const lead = await fetchLeadWithTimeline(leadId);
    res.status(200).json({ success: true, lead });
    return true;
  }

  if (method === 'POST' && subPath === 'respond-offer') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const response = String(body.response || '');
    const counterAmount = body.counterAmount != null ? Number(body.counterAmount) : undefined;

    if (!leadId) {
      res.status(400).json({ success: false, reason: 'leadId is required' });
      return true;
    }
    if (!['accepted', 'rejected', 'countered'].includes(response)) {
      res.status(400).json({ success: false, reason: 'Invalid response' });
      return true;
    }
    if (response === 'countered' && (!Number.isFinite(counterAmount) || (counterAmount ?? 0) <= 0)) {
      res.status(400).json({ success: false, reason: 'Valid counter amount is required' });
      return true;
    }

    const participant = await assertDealParticipant(leadId, auth);
    if (!participant) {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }
    const row = participant.row;

    const metadata = { ...(row.metadata as DealLeadMetadata) };
    const currentOffer = metadata.offers?.find((o) => o.id === metadata.currentOfferId);
    if (!currentOffer) {
      res.status(400).json({ success: false, reason: 'No pending offer' });
      return true;
    }
    if (currentOffer.status !== 'pending') {
      res.status(400).json({ success: false, reason: 'Offer is no longer pending' });
      return true;
    }

    const buyerEmail = normalizeEmail(String(row.buyer_email));
    const sellerEmail = normalizeEmail(String(row.seller_email));
    const offererEmail = currentOffer.offeredBy === 'buyer' ? buyerEmail : sellerEmail;
    if (auth.email === offererEmail && auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Cannot respond to your own offer' });
      return true;
    }

    if (response === 'accepted') {
      currentOffer.status = 'accepted';
      metadata.acceptedOfferAmount = currentOffer.amount;
      await tryUpdateDealOfferStatus(currentOffer.id, 'accepted');
      await updateLeadStage(leadId, 'offer_accepted', { metadata });
      await insertTimelineEvent({
        leadId,
        stage: 'offer_accepted',
        eventType: 'offer_accepted',
        actorEmail: auth.email,
        label: `Price agreed: ₹${currentOffer.amount.toLocaleString('en-IN')}`,
      });
    } else if (response === 'rejected') {
      currentOffer.status = 'rejected';
      await tryUpdateDealOfferStatus(currentOffer.id, 'rejected');
      await updateLeadStage(leadId, 'offer_made', { metadata });
      await insertTimelineEvent({
        leadId,
        stage: 'offer_made',
        eventType: 'offer_rejected',
        actorEmail: auth.email,
        label: 'Offer Rejected',
      });
    } else if (response === 'countered' && counterAmount) {
      currentOffer.status = 'countered';
      const offerId = generateId('offer');
      metadata.offers = [
        ...(metadata.offers || []),
        {
          id: offerId,
          amount: counterAmount,
          offeredBy: auth.email === buyerEmail ? 'buyer' : 'seller',
          status: 'pending',
          parentOfferId: currentOffer.id,
          createdAt: new Date().toISOString(),
        },
      ];
      metadata.currentOfferId = offerId;
      await tryUpdateDealOfferStatus(currentOffer.id, 'countered');
      await tryInsertDealOffer({
        id: offerId,
        leadId,
        amount: counterAmount,
        offeredBy: auth.email === buyerEmail ? 'buyer' : 'seller',
        status: 'pending',
        parentOfferId: currentOffer.id,
      });
      await updateLeadStage(leadId, 'offer_made', { metadata });
      await insertTimelineEvent({
        leadId,
        stage: 'offer_made',
        eventType: 'offer_countered',
        actorEmail: auth.email,
        label: `Counter Offer: ₹${counterAmount.toLocaleString('en-IN')}`,
        payload: { amount: counterAmount },
      });
    }

    const lead = await fetchLeadWithTimeline(leadId);
    res.status(200).json({ success: true, lead });
    return true;
  }

  return false;
};

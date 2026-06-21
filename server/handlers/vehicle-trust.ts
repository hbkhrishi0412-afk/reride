/**
 * Vehicle trust API: VAHAN verify, buyer inspections, deals, peer ratings.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE,
  supabaseUserService,
  supabaseVehicleService,
  getSupabaseAdminClient,
  type HandlerOptions,
} from '../handler-shared.js';
import {
  createManualVahanSnapshot,
  fetchVahanByRegistration,
  vahanLookupMessage,
} from '../../lib/vahanVerification.js';
import {
  compareBuyerToSeller,
  type BuyerInspectionItem,
  type SellerDisclosureChecklist,
} from '../../lib/vehicleDisclosureChecklist.js';
import { VehicleCategory } from '../../vehicle-category.js';
import type { RatingEligibility, VehicleTrustDeal, Vehicle } from '../../types.js';

function firstQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getAuthEmail(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const { verifyToken } = await import('../../utils/security.js');
    const payload = verifyToken(authHeader.slice(7));
    if (payload?.email) return normalizeEmail(payload.email);
  } catch {
    // Fall through — client may send a Supabase access_token instead of app JWT.
  }

  try {
    const { verifySupabaseToken } = await import('../supabase-auth.js');
    const sb = await verifySupabaseToken(authHeader);
    const email = (sb.email || '').toLowerCase().trim();
    return email || null;
  } catch {
    return null;
  }
}

async function resolveVehicleId(vehicleIdRaw: string): Promise<{
  primaryKey: string;
  vehicle: Awaited<ReturnType<typeof supabaseVehicleService.resolveVehicleIdentity>>['vehicle'];
} | null> {
  try {
    const trimmed = vehicleIdRaw.trim();
    const num = Number(trimmed);
    const isPlainNumericId =
      Number.isFinite(num) && num > 0 && String(num) === trimmed;
    const result = await supabaseVehicleService.resolveVehicleIdentity(
      isPlainNumericId ? { id: num, databaseId: trimmed } : { databaseId: trimmed },
    );
    return { primaryKey: result.primaryKey, vehicle: result.vehicle };
  } catch {
    return null;
  }
}

async function recomputeUserRatings(email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const normalized = normalizeEmail(email);
  const { data: ratings } = await supabase
    .from('peer_ratings')
    .select('rating')
    .eq('rated_email', normalized);

  const list = ratings || [];
  const count = list.length;
  const average = count > 0 ? list.reduce((s, r) => s + Number(r.rating), 0) / count : 0;

  await supabaseUserService.update(normalized, {
    averageRating: Math.round(average * 10) / 10,
    ratingCount: count,
    sellerAverageRating: Math.round(average * 10) / 10,
    sellerRatingCount: count,
  });
}

async function incrementNonDisclosureCount(sellerEmail: string): Promise<void> {
  const user = await supabaseUserService.findByEmail(sellerEmail);
  if (!user) return;
  const current = user.reportedCount || 0;
  const trustScore = Math.max(0, (user.trustScore ?? 50) - 5);
  await supabaseUserService.update(sellerEmail, {
    reportedCount: current + 1,
    trustScore,
  });
}

export async function handleVehicleTrust(
  req: VercelRequest,
  res: VercelResponse,
  _options: HandlerOptions,
) {
  if (!USE_SUPABASE) {
    return res.status(503).json({ success: false, reason: 'Database not available' });
  }

  const subPath = firstQueryParam(req.query?.action) || '';
  const method = req.method || 'GET';

  try {
    // POST vahan-verify
    if (method === 'POST' && subPath === 'vahan-verify') {
      const authEmail = await getAuthEmail(req);
      if (!authEmail) {
        return res.status(401).json({ success: false, reason: 'Authentication required' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const registrationNumber = String(body.registrationNumber || '').trim().toUpperCase();
      const vehicleIdRaw = body.vehicleId != null ? String(body.vehicleId) : undefined;

      if (!registrationNumber) {
        return res.status(400).json({ success: false, reason: 'registrationNumber is required' });
      }

      const lookup = await fetchVahanByRegistration(registrationNumber);
      const verified = Boolean(lookup.snapshot);
      const responseSnapshot = lookup.snapshot ?? createManualVahanSnapshot(registrationNumber);

      if (vehicleIdRaw) {
        const resolved = await resolveVehicleId(vehicleIdRaw);
        if (resolved) {
          const updates: Partial<Vehicle> = {
            registrationNumber,
          };
          if (verified && lookup.snapshot) {
            updates.vahanVerifiedAt = lookup.snapshot.verifiedAt;
            updates.vahanSnapshot = lookup.snapshot;
            if (lookup.snapshot.engineNumber) updates.engineNumber = lookup.snapshot.engineNumber;
            if (lookup.snapshot.chassisNumber) updates.chassisNumber = lookup.snapshot.chassisNumber;
            if (lookup.snapshot.ownerCount != null) updates.noOfOwners = lookup.snapshot.ownerCount;
            if (lookup.snapshot.insuranceUpto) updates.insuranceValidity = lookup.snapshot.insuranceUpto;
            if (lookup.snapshot.manufacturer) updates.make = lookup.snapshot.manufacturer;
            if (lookup.snapshot.model) updates.model = lookup.snapshot.model;
            if (lookup.snapshot.fuelType) updates.fuelType = lookup.snapshot.fuelType;
            if (lookup.snapshot.rtoCode) updates.rto = lookup.snapshot.rtoCode;
          }
          try {
            await supabaseVehicleService.update(resolved.primaryKey, updates);
          } catch (persistError) {
            console.warn('Vahan verify: could not persist to vehicle row', persistError);
          }
        }
      }

      return res.status(200).json({
        success: true,
        snapshot: responseSnapshot,
        verified,
        message: vahanLookupMessage(lookup, registrationNumber),
      });
    }

    // POST buyer-inspection
    if (method === 'POST' && subPath === 'buyer-inspection') {
      const authEmail = await getAuthEmail(req);
      if (!authEmail) {
        return res.status(401).json({ success: false, reason: 'Authentication required' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const vehicleIdRaw = String(body.vehicleId || '');
      const items = body.items as BuyerInspectionItem[] | undefined;
      const generalNotes = body.generalNotes as string | undefined;

      if (!vehicleIdRaw || !items?.length) {
        return res.status(400).json({ success: false, reason: 'vehicleId and items are required' });
      }

      const resolved = await resolveVehicleId(vehicleIdRaw);
      if (!resolved?.vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }

      const sellerChecklist = resolved.vehicle.sellerDisclosureChecklist as
        | SellerDisclosureChecklist
        | undefined;
      const category =
        (body.category as VehicleCategory) ||
        resolved.vehicle.category ||
        VehicleCategory.FOUR_WHEELER;
      const flaggedKeys = compareBuyerToSeller(sellerChecklist, items, category);

      const inspectionId = generateId('bins');
      const supabase = getSupabaseAdminClient();

      const { error: insertError } = await supabase.from('buyer_inspections').insert({
        id: inspectionId,
        vehicle_id: resolved.primaryKey,
        buyer_email: authEmail,
        items,
        flagged_keys: flaggedKeys,
        general_notes: generalNotes || null,
      });

      if (insertError) {
        console.error('buyer_inspections insert failed:', insertError);
        return res.status(500).json({
          success: false,
          reason: insertError.message || 'Failed to save buyer inspection',
        });
      }

      if (flaggedKeys.length > 0 && resolved.vehicle.sellerEmail) {
        const flagId = generateId('dflag');
        await supabase.from('disclosure_flags').insert({
          id: flagId,
          vehicle_id: resolved.primaryKey,
          seller_email: normalizeEmail(resolved.vehicle.sellerEmail),
          buyer_email: authEmail,
          inspection_id: inspectionId,
          flagged_keys: flaggedKeys,
          reason: generalNotes || 'Buyer reported disclosure mismatch',
        });
        await incrementNonDisclosureCount(resolved.vehicle.sellerEmail);
      }

      return res.status(200).json({
        success: true,
        inspectionId,
        flaggedKeys,
        flaggedCount: flaggedKeys.length,
      });
    }

    // POST deal-initiate (seller marks sold with buyer)
    if (method === 'POST' && subPath === 'deal-initiate') {
      const authEmail = await getAuthEmail(req);
      if (!authEmail) {
        return res.status(401).json({ success: false, reason: 'Authentication required' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const vehicleIdRaw = String(body.vehicleId || '');
      const buyerEmail = normalizeEmail(String(body.buyerEmail || ''));

      if (!vehicleIdRaw || !buyerEmail) {
        return res.status(400).json({ success: false, reason: 'vehicleId and buyerEmail are required' });
      }

      const resolved = await resolveVehicleId(vehicleIdRaw);
      if (!resolved?.vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }

      const sellerEmail = normalizeEmail(resolved.vehicle.sellerEmail || '');
      if (sellerEmail !== authEmail) {
        return res.status(403).json({ success: false, reason: 'Only the seller can initiate a deal' });
      }

      const dealId = generateId('deal');
      const now = new Date().toISOString();
      const supabase = getSupabaseAdminClient();

      await supabase.from('vehicle_trust_deals').insert({
        id: dealId,
        vehicle_id: resolved.primaryKey,
        seller_email: sellerEmail,
        buyer_email: buyerEmail,
        status: 'pending_buyer_confirm',
        seller_confirmed_at: now,
      });

      await supabaseVehicleService.update(resolved.primaryKey, {
        status: 'sold',
        soldAt: now,
        listingStatus: 'sold',
      });

      const seller = await supabaseUserService.findByEmail(sellerEmail);
      if (seller) {
        const sold = (seller.soldListings || 0) + 1;
        await supabaseUserService.update(sellerEmail, { soldListings: sold });
      }

      return res.status(200).json({
        success: true,
        dealId,
        status: 'pending_buyer_confirm',
      });
    }

    // POST deal-confirm (buyer confirms purchase)
    if (method === 'POST' && subPath === 'deal-confirm') {
      const authEmail = await getAuthEmail(req);
      if (!authEmail) {
        return res.status(401).json({ success: false, reason: 'Authentication required' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const dealId = String(body.dealId || '');

      if (!dealId) {
        return res.status(400).json({ success: false, reason: 'dealId is required' });
      }

      const supabase = getSupabaseAdminClient();
      const { data: deal, error } = await supabase
        .from('vehicle_trust_deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (error || !deal) {
        return res.status(404).json({ success: false, reason: 'Deal not found' });
      }

      if (normalizeEmail(deal.buyer_email) !== authEmail) {
        return res.status(403).json({ success: false, reason: 'Only the buyer can confirm this deal' });
      }

      const now = new Date().toISOString();
      await supabase
        .from('vehicle_trust_deals')
        .update({
          status: 'completed',
          buyer_confirmed_at: now,
          completed_at: now,
        })
        .eq('id', dealId);

      return res.status(200).json({ success: true, dealId, status: 'completed' });
    }

    // GET pending-deals
    if (method === 'GET' && subPath === 'pending-deals') {
      const authEmail = await getAuthEmail(req);
      if (!authEmail) {
        return res.status(401).json({ success: false, reason: 'Authentication required' });
      }

      const supabase = getSupabaseAdminClient();
      const { data } = await supabase
        .from('vehicle_trust_deals')
        .select('*')
        .eq('buyer_email', authEmail)
        .eq('status', 'pending_buyer_confirm')
        .order('created_at', { ascending: false });

      const deals: VehicleTrustDeal[] = (data || []).map((d) => ({
        id: d.id,
        vehicleId: d.vehicle_id,
        sellerEmail: d.seller_email,
        buyerEmail: d.buyer_email,
        status: d.status as VehicleTrustDeal['status'],
        createdAt: d.created_at,
        sellerConfirmedAt: d.seller_confirmed_at,
        buyerConfirmedAt: d.buyer_confirmed_at,
        completedAt: d.completed_at,
      }));

      return res.status(200).json({ success: true, deals });
    }

    // GET rating-eligibility?vehicleId=
    if (method === 'GET' && subPath === 'rating-eligibility') {
      const authEmail = await getAuthEmail(req);
      if (!authEmail) {
        return res.status(401).json({ success: false, reason: 'Authentication required' });
      }

      const vehicleIdRaw = firstQueryParam(req.query?.vehicleId) || '';
      if (!vehicleIdRaw) {
        return res.status(400).json({ success: false, reason: 'vehicleId is required' });
      }

      const resolved = await resolveVehicleId(vehicleIdRaw);
      if (!resolved?.vehicle) {
        return res.status(404).json({ success: false, reason: 'Vehicle not found' });
      }

      const supabase = getSupabaseAdminClient();
      const { data: deals } = await supabase
        .from('vehicle_trust_deals')
        .select('*')
        .eq('vehicle_id', resolved.primaryKey)
        .eq('status', 'completed');

      const deal = (deals || []).find(
        (d) =>
          normalizeEmail(d.seller_email) === authEmail ||
          normalizeEmail(d.buyer_email) === authEmail,
      );

      const eligibility: RatingEligibility = {
        canRateSeller: false,
        canRateBuyer: false,
        reason: 'Complete a verified transaction to rate',
      };

      if (!deal) {
        return res.status(200).json({ success: true, eligibility });
      }

      const { data: existing } = await supabase
        .from('peer_ratings')
        .select('rater_email')
        .eq('deal_id', deal.id);

      const alreadyRated = new Set(
        (existing || []).map((r) => normalizeEmail(r.rater_email)),
      );

      const sellerEmail = normalizeEmail(deal.seller_email);
      const buyerEmail = normalizeEmail(deal.buyer_email);

      if (authEmail === buyerEmail && !alreadyRated.has(authEmail)) {
        eligibility.canRateSeller = true;
        eligibility.dealId = deal.id;
        eligibility.reason = undefined;
      }
      if (authEmail === sellerEmail && !alreadyRated.has(authEmail)) {
        eligibility.canRateBuyer = true;
        eligibility.dealId = deal.id;
        eligibility.reason = undefined;
      }

      if (eligibility.canRateSeller || eligibility.canRateBuyer) {
        eligibility.reason = undefined;
      }

      return res.status(200).json({ success: true, eligibility, dealId: deal.id });
    }

    // POST submit-rating
    if (method === 'POST' && subPath === 'submit-rating') {
      const authEmail = await getAuthEmail(req);
      if (!authEmail) {
        return res.status(401).json({ success: false, reason: 'Authentication required' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const dealId = String(body.dealId || '');
      const rating = Number(body.rating);
      const comment = body.comment as string | undefined;

      if (!dealId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, reason: 'dealId and rating (1-5) are required' });
      }

      const supabase = getSupabaseAdminClient();
      const { data: deal } = await supabase
        .from('vehicle_trust_deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (!deal || deal.status !== 'completed') {
        return res.status(400).json({ success: false, reason: 'Deal not completed' });
      }

      const sellerEmail = normalizeEmail(deal.seller_email);
      const buyerEmail = normalizeEmail(deal.buyer_email);

      let ratedEmail: string | null = null;
      if (authEmail === buyerEmail) ratedEmail = sellerEmail;
      if (authEmail === sellerEmail) ratedEmail = buyerEmail;

      if (!ratedEmail) {
        return res.status(403).json({ success: false, reason: 'You are not part of this deal' });
      }

      const ratingId = generateId('rating');
      const { error: insertError } = await supabase.from('peer_ratings').insert({
        id: ratingId,
        deal_id: dealId,
        rater_email: authEmail,
        rated_email: ratedEmail,
        rating: Math.round(rating),
        comment: comment || null,
      });

      if (insertError?.code === '23505') {
        return res.status(409).json({ success: false, reason: 'You already rated this transaction' });
      }
      if (insertError) {
        throw new Error(insertError.message);
      }

      await recomputeUserRatings(ratedEmail);

      return res.status(200).json({ success: true, ratingId });
    }

    // GET inspectors (pre-purchase service providers)
    if (method === 'GET' && subPath === 'inspectors') {
      const city = firstQueryParam(req.query?.city)?.toLowerCase();
      const supabase = getSupabaseAdminClient();
      const { data: providers } = await supabase
        .from('users')
        .select('email, name, location, city, avatar_url, average_rating, rating_count, metadata')
        .eq('role', 'service_provider')
        .eq('status', 'active');

      const flagged = (providers || []).filter((p) => {
        const meta = (p.metadata as Record<string, unknown>) || {};
        return meta.offersPrePurchaseInspection === true || meta.isInspector === true;
      });

      const pool = flagged.length > 0 ? flagged : providers || [];

      const inspectors = pool
        .filter((p) => {
          if (!city) return true;
          const loc = String(p.city || p.location || '').toLowerCase();
          return loc.includes(city);
        })
        .map((p) => ({
          email: p.email,
          name: p.name,
          city: p.city || p.location,
          avatarUrl: p.avatar_url,
          averageRating: p.average_rating,
          ratingCount: p.rating_count,
        }));

      return res.status(200).json({ success: true, inspectors });
    }

    return res.status(404).json({ success: false, reason: 'Unknown vehicle-trust action' });
  } catch (error) {
    console.error('vehicle-trust error:', error);
    return res.status(500).json({
      success: false,
      reason: error instanceof Error ? error.message : 'Internal error',
    });
  }
}

/**
 * Client API for vehicle trust: disclosure, VAHAN, inspections, deals, ratings.
 */
import { finalizeSellerChecklist } from '../lib/universalChecklist/helpers.js';
import type { VehicleCategory } from '../vehicle-category.js';
import { authenticatedFetch } from '../utils/authenticatedFetch.js';
import type {
  BuyerInspectionItem,
  RatingEligibility,
  UniversalSellerChecklist,
  VahanSnapshot,
  VehicleTrustDeal,
} from '../types.js';

const BASE = '/api/vehicle-trust';

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const reason = (data as { reason?: unknown }).reason;
    const message =
      typeof reason === 'string'
        ? reason
        : reason && typeof reason === 'object' && 'message' in reason && typeof (reason as { message: unknown }).message === 'string'
          ? (reason as { message: string }).message
          : 'Request failed';
    throw new Error(message);
  }
  return data as T;
}

export async function verifyVahanRegistration(
  registrationNumber: string,
  vehicleId?: number | string,
): Promise<{ snapshot: VahanSnapshot | null; verified: boolean; message?: string }> {
  const response = await authenticatedFetch(`${BASE}?action=vahan-verify`, {
    method: 'POST',
    body: JSON.stringify({ registrationNumber, vehicleId }),
  });
  const data = await parseJson<{
    success: boolean;
    snapshot: VahanSnapshot | null;
    verified: boolean;
    message?: string;
  }>(response);
  return { snapshot: data.snapshot, verified: data.verified, message: data.message };
}

export async function submitBuyerInspection(
  vehicleId: number | string,
  items: BuyerInspectionItem[],
  generalNotes?: string,
  category?: VehicleCategory,
): Promise<{ inspectionId: string; flaggedKeys: string[]; flaggedCount: number }> {
  const response = await authenticatedFetch(`${BASE}?action=buyer-inspection`, {
    method: 'POST',
    body: JSON.stringify({ vehicleId, items, generalNotes, category }),
  });
  const data = await parseJson<{
    success: boolean;
    inspectionId: string;
    flaggedKeys: string[];
    flaggedCount: number;
  }>(response);
  return {
    inspectionId: data.inspectionId,
    flaggedKeys: data.flaggedKeys,
    flaggedCount: data.flaggedCount,
  };
}

export async function initiateTrustDeal(
  vehicleId: number | string,
  buyerEmail: string,
): Promise<{ dealId: string; status: string }> {
  const response = await authenticatedFetch(`${BASE}?action=deal-initiate`, {
    method: 'POST',
    body: JSON.stringify({ vehicleId, buyerEmail }),
  });
  const data = await parseJson<{ success: boolean; dealId: string; status: string }>(response);
  return { dealId: data.dealId, status: data.status };
}

export async function confirmTrustDeal(dealId: string): Promise<void> {
  const response = await authenticatedFetch(`${BASE}?action=deal-confirm`, {
    method: 'POST',
    body: JSON.stringify({ dealId }),
  });
  await parseJson<{ success: boolean }>(response);
}

export async function fetchPendingDeals(): Promise<VehicleTrustDeal[]> {
  const response = await authenticatedFetch(`${BASE}?action=pending-deals`);
  const data = await parseJson<{ success: boolean; deals: VehicleTrustDeal[] }>(response);
  return data.deals || [];
}

export async function fetchRatingEligibility(
  vehicleId: number | string,
): Promise<{ eligibility: RatingEligibility; dealId?: string }> {
  const response = await authenticatedFetch(
    `${BASE}?action=rating-eligibility&vehicleId=${encodeURIComponent(String(vehicleId))}`,
  );
  const data = await parseJson<{
    success: boolean;
    eligibility: RatingEligibility;
    dealId?: string;
  }>(response);
  return { eligibility: data.eligibility, dealId: data.dealId };
}

export async function submitPeerRating(
  dealId: string,
  rating: number,
  comment?: string,
): Promise<void> {
  const response = await authenticatedFetch(`${BASE}?action=submit-rating`, {
    method: 'POST',
    body: JSON.stringify({ dealId, rating, comment }),
  });
  await parseJson<{ success: boolean }>(response);
}

export interface PrePurchaseInspector {
  email: string;
  name: string;
  city?: string;
  avatarUrl?: string;
  averageRating?: number;
  ratingCount?: number;
}

export async function fetchPrePurchaseInspectors(city?: string): Promise<PrePurchaseInspector[]> {
  const qs = city ? `?action=inspectors&city=${encodeURIComponent(city)}` : '?action=inspectors';
  const response = await authenticatedFetch(`${BASE}${qs}`);
  const data = await parseJson<{ success: boolean; inspectors: PrePurchaseInspector[] }>(response);
  return data.inspectors || [];
}

export function buildSellerDisclosureChecklist(
  category: import('../vehicle-category.js').VehicleCategory,
  items: UniversalSellerChecklist['items'],
): UniversalSellerChecklist {
  return finalizeSellerChecklist(category, items);
}

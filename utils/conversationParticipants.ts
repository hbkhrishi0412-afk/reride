import type { Conversation } from '../types.js';
import { emailToKey } from '../services/supabase-user-service.js';

/**
 * True if a stored participant id (email, users.id UUID, or emailToKey slug) refers to the signed-in user.
 * Mirrors server-side `participantIdQueryValues` so client filters match API/Supabase rows.
 */
export function participantIdMatchesAppUser(
  participantId: string | null | undefined,
  userEmail: string | null | undefined,
  userId?: string | null
): boolean {
  if (!participantId || !userEmail) return false;
  const p = String(participantId).toLowerCase().trim();
  const e = userEmail.toLowerCase().trim();
  if (!p || !e) return false;
  if (p === e) return true;
  if (p === emailToKey(e)) return true;
  const uid = userId ? String(userId).toLowerCase().trim() : '';
  if (uid && p === uid) return true;
  return false;
}

export function conversationBelongsToSeller(
  conv: Conversation | null | undefined,
  sellerEmail: string | null | undefined,
  sellerUserId?: string | null
): boolean {
  if (!conv?.sellerId || !sellerEmail) return false;
  return participantIdMatchesAppUser(conv.sellerId, sellerEmail, sellerUserId);
}

export function conversationBelongsToCustomer(
  conv: Conversation | null | undefined,
  customerEmail: string | null | undefined,
  customerUserId?: string | null
): boolean {
  if (!conv?.customerId || !customerEmail) return false;
  return participantIdMatchesAppUser(conv.customerId, customerEmail, customerUserId);
}

export function normalizeInboxRole(role: string | undefined | null): 'seller' | 'customer' | null {
  const r = role?.toLowerCase().trim();
  if (r === 'seller') return 'seller';
  if (r === 'customer') return 'customer';
  return null;
}

export function conversationMatchesVehicle(
  conv: Conversation | null | undefined,
  vehicle: { id?: number | string } | null | undefined,
): boolean {
  if (!conv?.vehicleId || vehicle?.id == null) return false;
  return String(conv.vehicleId) === String(vehicle.id);
}

export function countInquiriesForVehicles(
  vehicles: Array<{ id?: number | string }>,
  conversations: Conversation[],
  sellerEmail: string | null | undefined,
  sellerUserId?: string | null,
): number {
  if (!sellerEmail || vehicles.length === 0) return 0;
  const vehicleIds = new Set(vehicles.map((v) => String(v.id)));
  return conversations.filter(
    (c) =>
      c &&
      conversationBelongsToSeller(c, sellerEmail, sellerUserId) &&
      c.vehicleId != null &&
      vehicleIds.has(String(c.vehicleId)),
  ).length;
}

export function countInquiriesForVehicle(
  vehicle: { id?: number | string },
  conversations: Conversation[],
  sellerEmail: string | null | undefined,
  sellerUserId?: string | null,
): number {
  if (!sellerEmail) return 0;
  return conversations.filter(
    (c) =>
      c &&
      conversationBelongsToSeller(c, sellerEmail, sellerUserId) &&
      conversationMatchesVehicle(c, vehicle),
  ).length;
}

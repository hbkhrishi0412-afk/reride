import type { User, Vehicle } from '../types.js';
import { emailToKey } from '../services/supabase-user-service.js';

export function findUserByParticipantId(users: User[], participantId: string | undefined | null): User | undefined {
  if (!participantId) return undefined;
  const lid = participantId.toLowerCase().trim();
  return users.find((u) => {
    if (!u?.email) return false;
    const e = u.email.toLowerCase().trim();
    if (e === lid) return true;
    if (u.id && (u.id === participantId || u.id === lid)) return true;
    return emailToKey(e) === participantId || emailToKey(lid) === u.id;
  });
}

export function resolveSellerPhoneFromProfileOrListing(
  users: User[],
  vehicles: Vehicle[] | undefined,
  sellerId: string,
  vehicleId: number
): string {
  const u = findUserByParticipantId(users, sellerId);
  const m = u?.mobile?.trim();
  if (m) return m;
  const v = vehicles?.find((x) => x.id === vehicleId);
  return (v?.sellerPhone || '').trim();
}

export function resolveChatCallPhone(
  users: User[],
  vehicles: Vehicle[],
  conversation: { sellerId: string; customerId: string; vehicleId: number },
  viewerRole: 'customer' | 'seller'
): string {
  if (viewerRole === 'customer') {
    return resolveSellerPhoneFromProfileOrListing(users, vehicles, conversation.sellerId, conversation.vehicleId);
  }
  const u = findUserByParticipantId(users, conversation.customerId);
  return (u?.mobile?.trim() || (u as { phone?: string })?.phone?.trim?.() || '') as string;
}

export function resolveChatOtherPartyName(
  users: User[],
  conversation: { sellerId: string; customerName: string },
  viewerRole: 'customer' | 'seller'
): string {
  if (viewerRole === 'customer') {
    const s = findUserByParticipantId(users, conversation.sellerId);
    return s?.name || s?.dealershipName || 'Seller';
  }
  return conversation.customerName;
}

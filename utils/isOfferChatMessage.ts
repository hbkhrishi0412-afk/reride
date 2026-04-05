import type { ChatMessage } from '../types';

/** True if this row should use offer UI / offer-response handling (type may be missing in older DB rows). */
export function isOfferChatMessage(msg: Pick<ChatMessage, 'type' | 'payload' | 'text'>): boolean {
  if (msg.type === 'offer') return true;
  const p = msg.payload?.offerPrice;
  return typeof p === 'number' && Number.isFinite(p);
}

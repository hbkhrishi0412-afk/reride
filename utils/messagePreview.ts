import type { ChatMessage } from '../types';

/** One-line preview for thread lists (Messenger-style). */
export function getThreadLastMessagePreview(
  last: ChatMessage | undefined,
  opts?: { youLabel?: string; otherLabel?: string; viewer?: 'customer' | 'seller' }
): { prefix: string; text: string } {
  const you = opts?.youLabel ?? 'You';
  const other = opts?.otherLabel ?? '';
  const viewer = opts?.viewer ?? 'customer';
  const youSender = viewer === 'customer' ? 'user' : 'seller';
  const otherSender = viewer === 'customer' ? 'seller' : 'user';

  if (!last) {
    return { prefix: '', text: 'No messages yet' };
  }
  if (last.type === 'offer') {
    const price = last.payload?.offerPrice;
    const formatted =
      typeof price === 'number' ? `₹${price.toLocaleString('en-IN')}` : '—';
    const body = `Offer: ${formatted}`;
    if (last.sender === youSender) {
      return { prefix: `${you}: `, text: body };
    }
    return { prefix: other ? `${other}: ` : '', text: body };
  }
  if (last.type === 'test_drive_request') {
    return { prefix: '', text: 'Test drive request' };
  }
  const body = last.text?.trim() || 'Message';
  if (last.sender === youSender) {
    return { prefix: `${you}: `, text: body };
  }
  if (last.sender === otherSender && other) {
    return { prefix: `${other}: `, text: body };
  }
  return { prefix: '', text: body };
}

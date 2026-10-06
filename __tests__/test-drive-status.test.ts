import { resolveOfferStatus, resolveTestDriveStatus, TEST_DRIVE_VEHICLE_SLOT } from '../components/ReadReceiptIcon';
import type { ChatMessage, DealLead } from '../types';

const request = { id: 1, type: 'test_drive_request', payload: { status: 'pending' } } as unknown as ChatMessage;
const lead = (currentStage: string) => ({ currentStage, metadata: {} }) as unknown as DealLead;

describe('resolveTestDriveStatus', () => {
  it('uses the persisted seller reply', () => {
    const reply = { id: 2, type: 'text', payload: { originalMessageId: 1, status: 'rejected' } } as unknown as ChatMessage;
    expect(resolveTestDriveStatus(request, [request, reply])).toBe('rejected');
  });

  it('marks a pending request completed once the deal is past the test drive', () => {
    expect(resolveTestDriveStatus(request, [request], lead('delivery_completed'))).toBe('completed');
  });

  it('recognises legacy reply text that has no originalMessageId', () => {
    const seller = { id: 2, sender: 'seller', type: 'text', text: 'Test drive request declined for 2024 Bajaj Maxima C.' } as unknown as ChatMessage;
    const userRequest = { ...request, sender: 'user' } as ChatMessage;
    const templates = [
      { status: 'confirmed', template: `Test drive confirmed for ${TEST_DRIVE_VEHICLE_SLOT}. We'll contact you shortly.` },
      { status: 'rejected', template: `Test drive request declined for ${TEST_DRIVE_VEHICLE_SLOT}.` },
    ];
    expect(resolveTestDriveStatus(userRequest, [userRequest, seller], null, templates)).toBe('rejected');
  });

  it('stays pending while the deal has not reached the test drive', () => {
    expect(resolveTestDriveStatus(request, [request], lead('inspection_completed'))).toBe('pending');
  });
});

describe('resolveOfferStatus', () => {
  const offer = (offerPrice: number) =>
    ({ id: 3, type: 'offer', payload: { offerPrice, status: 'pending' } }) as unknown as ChatMessage;
  const dealWith = (currentStage: string, metadata: Record<string, unknown>) =>
    ({ currentStage, metadata }) as unknown as DealLead;

  it('prefers the linked deal offer id over a same-amount offer', () => {
    const msg = { id: 4, type: 'offer', payload: { offerPrice: 85000, status: 'pending', dealOfferId: 'offer_a' } } as unknown as ChatMessage;
    const deal = dealWith('offer_made', {
      offers: [
        { id: 'offer_a', amount: 85000, status: 'rejected' },
        { id: 'offer_b', amount: 85000, status: 'pending' },
      ],
    });
    expect(resolveOfferStatus(msg, deal)).toBe('rejected');
  });

  it('takes the status from the matching deal offer', () => {
    const deal = dealWith('offer_made', { offers: [{ amount: 85000, status: 'rejected' }] });
    expect(resolveOfferStatus(offer(85000), deal)).toBe('rejected');
  });

  it('marks the agreed amount accepted and other open offers closed after agreement', () => {
    const deal = dealWith('delivery_completed', { acceptedOfferAmount: 89999 });
    expect(resolveOfferStatus(offer(89999), deal)).toBe('accepted');
    expect(resolveOfferStatus(offer(80000), deal)).toBe('closed');
  });
});

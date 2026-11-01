import { buildNotificationRecords } from '../server/insert-app-notification';
import { phoneDigits, phoneMatchTail, syntheticPhoneEmail, toE164IndianPhone } from '../server/phone-login-identity';
import { completeLineTotal } from '../utils/pricedServiceTotal';
import { mergeBuyerActivityRecord, savedSearchesForClient, storedSavedSearches } from '../server/handlers/buyer-activity-merge';

describe('notification rows match the bigint id column', () => {
  it('omits id and only sets user_id when the email maps to a users.id', () => {
    const records = buildNotificationRecords(
      [
        { recipientEmail: 'A@Example.com', type: 'deal', title: 'T', message: 'M' },
        { recipientEmail: 'missing@example.com', type: 'deal', title: 'T', message: 'M' },
        { recipientEmail: 'not-an-email', type: 'deal', title: 'T', message: 'M' },
      ],
      new Map([['a@example.com', 'uuid-1']]),
      '2026-11-02T00:00:00.000Z',
    );
    expect(records).toHaveLength(2);
    expect(records[0]).not.toHaveProperty('id');
    expect(records[0]).toMatchObject({ user_id: 'uuid-1', recipient_email: 'a@example.com' });
    expect(records[1]).toMatchObject({ user_id: null, recipient_email: 'missing@example.com' });
  });
});

describe('phone login identity', () => {
  it('builds the same synthetic email for formatted and digit-only numbers', () => {
    expect(phoneDigits('+91 98765-43210')).toBe('919876543210');
    expect(syntheticPhoneEmail('+919876543210')).toBe(syntheticPhoneEmail('919876543210'));
    expect(phoneMatchTail('+91 98765 43210')).toBe('9876543210');
  });

  it('does not strip a leading 91 from a 10-digit local mobile', () => {
    expect(toE164IndianPhone('9123456789')).toBe('+919123456789');
    expect(toE164IndianPhone('9876543210')).toBe('+919876543210');
    expect(toE164IndianPhone('919876543210')).toBe('+919876543210');
    expect(toE164IndianPhone('+91 98765-43210')).toBe('+919876543210');
    expect(toE164IndianPhone('09876543210')).toBe('+919876543210');
    expect(toE164IndianPhone('12345')).toBeNull();
  });
});

describe('completeLineTotal', () => {
  it('omits the total when any line has no catalog price', () => {
    expect(completeLineTotal([{ price: 100, quantity: 2 }, { quantity: 1 }])).toBeUndefined();
  });

  it('sums every line when each price is known, including zero', () => {
    expect(completeLineTotal([{ price: 100, quantity: 2 }, { price: 0, quantity: 1 }])).toBe(200);
  });
});

describe('saved-search tombstone', () => {
  it('does not restore a removed search from a stale snapshot', () => {
    const first = mergeBuyerActivityRecord(
      { saved_searches: [{ id: 's1' }, { id: 's2' }] },
      { savedSearches: [{ id: 's1' }], removeSavedSearchIds: ['s2'] },
    );
    const stored = storedSavedSearches(first.saved_searches, first.removedSavedSearchIds);
    const second = mergeBuyerActivityRecord(
      { saved_searches: stored },
      { savedSearches: [{ id: 's1' }, { id: 's2' }] },
    );
    expect(savedSearchesForClient(second.saved_searches).map((item) => (item as { id: string }).id)).toEqual(['s1']);
  });
});

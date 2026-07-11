import type { Conversation } from '../types';
import { countUnreadMessageThreads } from '../utils/unreadCounts';

describe('countUnreadMessageThreads', () => {
  const conversations: Conversation[] = [
    {
      id: 'c1',
      customerId: 'buyer@test.com',
      sellerId: 'seller@test.com',
      isReadByCustomer: false,
      isReadBySeller: true,
    } as Conversation,
    {
      id: 'c2',
      customerId: 'buyer@test.com',
      sellerId: 'seller@test.com',
      isReadByCustomer: true,
      isReadBySeller: false,
    } as Conversation,
  ];

  it('counts unread threads for customer', () => {
    expect(countUnreadMessageThreads(conversations, 'customer', 'buyer@test.com')).toBe(1);
  });

  it('counts unread threads for seller', () => {
    expect(countUnreadMessageThreads(conversations, 'seller', 'seller@test.com')).toBe(1);
  });

  it('returns 0 without email or role', () => {
    expect(countUnreadMessageThreads(conversations, undefined, 'buyer@test.com')).toBe(0);
    expect(countUnreadMessageThreads(conversations, 'customer', undefined)).toBe(0);
  });
});

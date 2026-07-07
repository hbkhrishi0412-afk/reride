import { buildNotificationDeepLinkUrl } from '../utils/notificationDeepLink';
import type { Notification } from '../types';

function baseNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    title: 'Test',
    message: 'Body',
    timestamp: new Date().toISOString(),
    isRead: false,
    type: 'general',
    ...overrides,
  } as Notification;
}

describe('notificationDeepLink', () => {
  it('uses hash vehicle routes for listing notifications', () => {
    expect(
      buildNotificationDeepLinkUrl(baseNotification({ vehicleId: 42 })),
    ).toBe('/#/vehicle/42');
  });

  it('routes messages to inbox', () => {
    expect(
      buildNotificationDeepLinkUrl(baseNotification({ type: 'message' })),
    ).toBe('/#/inbox');
  });

  it('routes wishlist alerts to wishlist', () => {
    expect(
      buildNotificationDeepLinkUrl(baseNotification({ type: 'wishlist' })),
    ).toBe('/#/wishlist');
  });

  it('routes admin assistance notifications to assistance queue', () => {
    expect(
      buildNotificationDeepLinkUrl(
        baseNotification({
          targetType: 'deal',
          dealAction: 'view_assistance',
          dealLeadId: 'RR-LD-001',
        }),
      ),
    ).toBe('/#/admin?tab=assistanceQueue&leadId=RR-LD-001');
  });
});

import {
  applyNotificationDeepLinkUrl,
  normalizeNativePushPayload,
} from '../utils/nativePushPayload';

describe('nativePushPayload', () => {
  it('normalizes string FCM data fields', () => {
    expect(
      normalizeNativePushPayload({
        url: '/#/vehicle/9',
        notificationId: '42',
        vehicleId: '9',
      }),
    ).toEqual({
      url: '/#/vehicle/9',
      notificationId: 42,
      vehicleId: 9,
      view: undefined,
      type: undefined,
      targetType: undefined,
      targetId: undefined,
    });
  });

  it('applies hash deep links', () => {
    applyNotificationDeepLinkUrl('/#/inbox');
    expect(window.location.hash).toBe('#/inbox');
  });

  it('maps legacy query links to hash routes', () => {
    applyNotificationDeepLinkUrl('/?view=DETAIL&id=55');
    expect(window.location.hash).toBe('#/vehicle/55');
  });
});

import { View } from '../types';
import { mobileChromeForView } from '../utils/mobileChrome';

describe('mobileChromeForView', () => {
  it('gives home the brand bar and bottom nav, and no back button', () => {
    expect(mobileChromeForView(View.HOME)).toEqual({
      showBrandBar: true,
      showBottomNav: true,
      showBack: false,
      backTarget: View.USED_CARS,
    });
  });

  it('hides the frame on auth screens', () => {
    const chrome = mobileChromeForView(View.LOGIN_PORTAL);
    expect(chrome.showBrandBar).toBe(false);
    expect(chrome.showBottomNav).toBe(false);
    expect(chrome.showBack).toBe(false);
  });

  it('sends listing back to used cars and activity back home', () => {
    expect(mobileChromeForView(View.DETAIL)).toMatchObject({
      showBottomNav: false,
      showBack: true,
      backTarget: View.USED_CARS,
    });
    expect(mobileChromeForView(View.NOTIFICATIONS_CENTER)).toMatchObject({
      showBottomNav: false,
      showBack: true,
      backTarget: View.HOME,
    });
  });
});

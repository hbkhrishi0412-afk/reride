import { View } from '../types';
import { mobileChatBottomClearancePx } from '../utils/mobileChatClearance';

describe('mobileChatBottomClearancePx', () => {
  it('clears the detail sticky CTA and the tab bar elsewhere', () => {
    expect(mobileChatBottomClearancePx(true, true, View.DETAIL)).toBe(88);
    expect(mobileChatBottomClearancePx(true, true, View.HOME)).toBe(56);
    expect(mobileChatBottomClearancePx(true, true, View.NOTIFICATIONS_CENTER)).toBe(0);
    expect(mobileChatBottomClearancePx(true, false, View.HOME)).toBe(0);
    expect(mobileChatBottomClearancePx(false, true, View.HOME)).toBe(0);
  });
});

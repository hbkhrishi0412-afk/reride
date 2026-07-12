import {
  normalizeToastDedupeKey,
  shouldShowInboundMessageToast,
  shouldShowOfflineToast,
  resetOfflineToastSession,
} from '../utils/toastPolicy';

describe('toastPolicy', () => {
  beforeEach(() => {
    resetOfflineToastSession();
  });

  it('normalizes dedupe keys', () => {
    expect(normalizeToastDedupeKey('  Saved! ', 'success')).toBe('success:saved!');
  });

  it('suppresses inbound message toast when thread is open', () => {
    expect(shouldShowInboundMessageToast('conv-1', 'conv-1')).toBe(false);
    expect(shouldShowInboundMessageToast('conv-1', 'conv-2')).toBe(true);
  });

  it('shows offline toast only once per session', () => {
    expect(shouldShowOfflineToast()).toBe(true);
    expect(shouldShowOfflineToast()).toBe(false);
    resetOfflineToastSession();
    expect(shouldShowOfflineToast()).toBe(true);
  });
});

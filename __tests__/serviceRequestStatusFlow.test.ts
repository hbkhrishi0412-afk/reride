import {
  nextPrimaryStatus,
  primaryAdvanceButtonLabel,
  allowedManualStatusOptions,
} from '../utils/serviceRequestStatusFlow.js';

describe('serviceRequestStatusFlow', () => {
  it('advances open → accepted → in_progress → completed', () => {
    expect(nextPrimaryStatus('open')).toBe('accepted');
    expect(nextPrimaryStatus('accepted')).toBe('in_progress');
    expect(nextPrimaryStatus('in_progress')).toBe('completed');
    expect(nextPrimaryStatus('completed')).toBeNull();
  });

  it('returns button labels for active states', () => {
    expect(primaryAdvanceButtonLabel('open')).toBe('Accept');
    expect(primaryAdvanceButtonLabel('cancelled')).toBeNull();
  });

  it('allows realistic manual transitions', () => {
    expect(allowedManualStatusOptions('open')).toEqual(['open', 'accepted', 'cancelled']);
    expect(allowedManualStatusOptions('completed')).toEqual(['completed']);
  });
});

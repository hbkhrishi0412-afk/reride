import { issueViewTrackToken, verifyViewTrackToken } from '../utils/view-track-token';

describe('view-track-token', () => {
  const prev = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-view-track-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = prev;
  });

  it('issues and verifies a token for a vehicle', () => {
    const token = issueViewTrackToken(42, 'db-abc');
    expect(token).toBeTruthy();
    expect(verifyViewTrackToken(token, 42, 'db-abc')).toBe(true);
  });

  it('rejects tampered vehicle id', () => {
    const token = issueViewTrackToken(42);
    expect(verifyViewTrackToken(token, 99)).toBe(false);
  });

  it('rejects missing token', () => {
    expect(verifyViewTrackToken(undefined, 1)).toBe(false);
  });
});

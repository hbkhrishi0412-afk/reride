import { trackViewBodySchema, supportChatPostSchema, loginBodySchema, registerBodySchema } from '../utils/api-schemas';

describe('api-schemas', () => {
  it('validates track-view body', () => {
    const result = trackViewBodySchema.safeParse({
      vehicleId: 1,
      viewToken: 'abc.def',
    });
    expect(result.success).toBe(true);
  });

  it('rejects track-view without token', () => {
    const result = trackViewBodySchema.safeParse({ vehicleId: 1 });
    expect(result.success).toBe(false);
  });

  it('validates support chat post', () => {
    const result = supportChatPostSchema.safeParse({ message: 'Hello' });
    expect(result.success).toBe(true);
  });

  it('validates login body', () => {
    const result = loginBodySchema.safeParse({
      email: 'user@example.com',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('validates register body', () => {
    const result = registerBodySchema.safeParse({
      name: 'Test User',
      email: 'user@example.com',
      password: 'secret123',
      mobile: '9876543210',
      role: 'customer',
    });
    expect(result.success).toBe(true);
  });

  it('rejects register with short password', () => {
    const result = registerBodySchema.safeParse({
      name: 'Test User',
      email: 'user@example.com',
      password: 'short',
      mobile: '9876543210',
      role: 'customer',
    });
    expect(result.success).toBe(false);
  });
});

import { createHmac } from 'crypto';

const mockInsert = jest.fn();
const mockSupabaseAdmin = () => ({
  getSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      insert: mockInsert,
    }),
  }),
});
jest.mock('../lib/supabase-admin', () => mockSupabaseAdmin());
jest.mock('../lib/supabase-admin.js', () => mockSupabaseAdmin());

// eslint-disable-next-line @typescript-eslint/no-var-requires -- must load after jest.mock (esbuild hoists imports)
const {
  claimRazorpayPayment,
  computeStackedPlanExpiry,
  verifyRazorpayPayment,
} = require('../lib/razorpay') as typeof import('../lib/razorpay');

const SECRET = 'test_secret';
const sign = (o: string, p: string) => createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');

function mockRazorpay(order: Record<string, unknown>, payment: Record<string, unknown>) {
  global.fetch = jest.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes('/orders/') ? order : payment),
  })) as unknown as typeof fetch;
}

const base = { orderId: 'order_1', paymentId: 'pay_1', productId: 'pro', payerEmail: 'seller@x.com' };

describe('verifyRazorpayPayment', () => {
  beforeAll(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test';
    process.env.RAZORPAY_KEY_SECRET = SECRET;
  });

  it('accepts a captured payment matching the order amount', async () => {
    mockRazorpay(
      { amount: 199900, notes: { productId: 'pro', sellerEmail: 'seller@x.com' } },
      { order_id: 'order_1', status: 'captured', amount: 199900 },
    );
    const r = await verifyRazorpayPayment({ ...base, signature: sign('order_1', 'pay_1') });
    expect(r).toEqual({ ok: true, amountPaise: 199900, durationDays: 30 });
  });

  it('rejects authorized-but-uncaptured payments', async () => {
    mockRazorpay(
      { amount: 199900, notes: { productId: 'pro', sellerEmail: 'seller@x.com' } },
      { order_id: 'order_1', status: 'authorized', amount: 199900 },
    );
    const r = await verifyRazorpayPayment({ ...base, signature: sign('order_1', 'pay_1') });
    expect(r).toMatchObject({ ok: false, status: 402 });
  });

  it('compares against the order amount, not the current catalog price', async () => {
    // Catalog pro is 1999 INR; order was created earlier at 99900 paise.
    mockRazorpay(
      { amount: 99900, notes: { productId: 'pro', sellerEmail: 'seller@x.com' } },
      { order_id: 'order_1', status: 'captured', amount: 99900 },
    );
    const r = await verifyRazorpayPayment({ ...base, signature: sign('order_1', 'pay_1') });
    expect(r).toEqual({ ok: true, amountPaise: 99900, durationDays: 30 });
  });

  it('rejects when payment amount differs from order amount', async () => {
    mockRazorpay(
      { amount: 199900, notes: { productId: 'pro', sellerEmail: 'seller@x.com' } },
      { order_id: 'order_1', status: 'captured', amount: 1 },
    );
    const r = await verifyRazorpayPayment({ ...base, signature: sign('order_1', 'pay_1') });
    expect(r.ok).toBe(false);
  });

  it('rejects a payment made for a different product', async () => {
    mockRazorpay(
      { amount: 999999, notes: { productId: 'boost:top_search_3', sellerEmail: 'seller@x.com' } },
      { order_id: 'order_1', status: 'captured', amount: 999999 },
    );
    const r = await verifyRazorpayPayment({ ...base, productId: 'premium', signature: sign('order_1', 'pay_1') });
    expect(r.ok).toBe(false);
  });

  it('rejects a bad signature without calling Razorpay', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const r = await verifyRazorpayPayment({ ...base, signature: 'nope' });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('computeStackedPlanExpiry', () => {
  it('keeps remaining days when renewing before expiry', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const existing = '2026-01-11T00:00:00.000Z'; // 10 days left
    const expiry = computeStackedPlanExpiry(existing, 30, now);
    expect(expiry.toISOString()).toBe('2026-02-10T00:00:00.000Z');
  });

  it('starts from now when the existing plan already expired', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiry = computeStackedPlanExpiry('2025-12-01T00:00:00.000Z', 30, now);
    expect(expiry.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});

describe('claimRazorpayPayment', () => {
  it('returns false when the payment id was already claimed', async () => {
    mockInsert.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { code: '23505', message: 'dup' } });
    expect(await claimRazorpayPayment({ transactionId: 'pay_1' })).toBe(true);
    expect(await claimRazorpayPayment({ transactionId: 'pay_1' })).toBe(false);
    expect(mockInsert).toHaveBeenCalledWith({ transactionId: 'pay_1', id: 'payment_rzp_pay_1' });
  });
});

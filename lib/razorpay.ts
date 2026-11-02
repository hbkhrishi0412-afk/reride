// Server-only Razorpay helpers: server-side pricing, payment verification, and single-use claims.
import { createHmac, timingSafeEqual } from 'crypto';
import { PLAN_DETAILS } from '../constants/plans.js';
import { BOOST_PACKAGES } from '../constants/boost.js';
import { DEAL_ASSISTANCE_PACKAGES } from '../types.js';
import { getSupabaseAdminClient } from './supabase-admin.js';

type Fail = { ok: false; status: number; reason: string };
const fail = (status: number, reason: string): Fail => ({ ok: false, status, reason });

const RAZORPAY_FETCH_TIMEOUT_MS = 10_000;

function razorpayFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const signal =
    init.signal ??
    (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(RAZORPAY_FETCH_TIMEOUT_MS)
      : undefined);
  return fetch(url, { ...init, signal });
}

/**
 * Product ids: `pro` / `premium` / custom plan id, `boost:<packageId>`, `deal_assist:<packageId>`.
 * Returns null when the product cannot be bought online.
 */
export async function resolveRazorpayProductPrice(
  productId: string,
): Promise<{ priceInr: number; durationDays?: number } | null> {
  const sep = productId.indexOf(':');
  const kind = sep === -1 ? 'plan' : productId.slice(0, sep);
  const pkgId = sep === -1 ? productId : productId.slice(sep + 1);

  if (kind === 'boost') {
    const pkg = BOOST_PACKAGES.find((p) => p.id === pkgId && p.paymentMethod === 'razorpay');
    return pkg ? { priceInr: pkg.price } : null;
  }
  if (kind === 'deal_assist') {
    const pkg = DEAL_ASSISTANCE_PACKAGES.find((p) => p.id === pkgId);
    return pkg ? { priceInr: pkg.price } : null;
  }
  if (kind !== 'plan' || pkgId === 'free' || pkgId === 'basic') return null;

  const { data } = await getSupabaseAdminClient()
    .from('plans')
    .select('price, duration_days')
    .eq('id', pkgId)
    .maybeSingle();
  const base = PLAN_DETAILS[pkgId as keyof typeof PLAN_DETAILS];
  const priceInr = Number(data?.price ?? base?.price);
  if (!Number.isFinite(priceInr) || priceInr <= 0) return null;
  const dbDays = Number(data?.duration_days);
  return { priceInr, durationDays: dbDays > 0 ? dbDays : base?.durationDays ?? 30 };
}

/** Stack plan days onto an existing future expiry (renewals keep remaining days). */
export function computeStackedPlanExpiry(
  existingExpiryIso: string | null | undefined,
  durationDays: number,
  now: Date = new Date(),
): Date {
  const days = Number.isFinite(durationDays) && durationDays > 0 ? Math.floor(durationDays) : 30;
  let start = now;
  if (existingExpiryIso) {
    const existing = new Date(existingExpiryIso);
    if (Number.isFinite(existing.getTime()) && existing.getTime() > now.getTime()) {
      start = existing;
    }
  }
  const expiry = new Date(start.getTime());
  expiry.setUTCDate(expiry.getUTCDate() + days);
  return expiry;
}

function razorpayAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

/** Creates an order priced on the server; the client never chooses the amount. */
export async function createRazorpayOrder(
  productId: string,
  payerEmail: string,
): Promise<{ ok: true; orderId: string; amount: number; currency: string; keyId: string } | Fail> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return fail(503, 'Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.');
  }
  const price = await resolveRazorpayProductPrice(productId);
  if (!price) return fail(400, 'This product cannot be purchased online.');

  let rzRes: Response;
  try {
    rzRes = await razorpayFetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: razorpayAuthHeader(keyId, keySecret), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(price.priceInr * 100),
        currency: 'INR',
        receipt: `reride_${Date.now()}`,
        payment_capture: 1,
        notes: { productId, planId: productId, sellerEmail: payerEmail.toLowerCase().trim() },
      }),
    });
  } catch {
    return fail(504, 'Razorpay order timed out. Please try again.');
  }
  const rz = (await rzRes.json().catch(() => ({}))) as Record<string, any>;
  if (!rzRes.ok) {
    return fail(502, rz?.error?.description || rz?.description || 'Razorpay order failed');
  }
  return { ok: true, orderId: String(rz.id), amount: Number(rz.amount), currency: String(rz.currency), keyId };
}

/**
 * Verifies the checkout signature, then asks Razorpay that the payment belongs to the order,
 * was captured, was created for this product + payer, and matches the order amount.
 */
export async function verifyRazorpayPayment(p: {
  orderId: string;
  paymentId: string;
  signature: string;
  productId: string;
  payerEmail: string;
}): Promise<{ ok: true; amountPaise: number; durationDays?: number } | Fail> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return fail(503, 'Online payments are not configured.');

  const expected = Buffer.from(createHmac('sha256', keySecret).update(`${p.orderId}|${p.paymentId}`).digest('hex'));
  const given = Buffer.from(String(p.signature));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return fail(400, 'Invalid payment signature');
  }

  const headers = { Authorization: razorpayAuthHeader(keyId, keySecret) };
  let orderRes: Response;
  let paymentRes: Response;
  try {
    [orderRes, paymentRes] = await Promise.all([
      razorpayFetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(p.orderId)}`, { headers }),
      razorpayFetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(p.paymentId)}`, { headers }),
    ]);
  } catch {
    return fail(504, 'Razorpay verification timed out. Please try again.');
  }
  if (!orderRes.ok || !paymentRes.ok) return fail(502, 'Could not verify payment with Razorpay');
  const order = (await orderRes.json()) as Record<string, any>;
  const payment = (await paymentRes.json()) as Record<string, any>;

  // Authorized-but-uncaptured payments can be voided later — only captured counts as paid.
  if (payment.order_id !== p.orderId || payment.status !== 'captured') {
    return fail(402, 'Payment has not been completed');
  }
  const notes = (order.notes || {}) as Record<string, unknown>;
  const noteProduct = String(notes.productId ?? notes.planId ?? '');
  const noteEmail = String(notes.sellerEmail ?? '').toLowerCase().trim();
  if (noteProduct !== p.productId || noteEmail !== p.payerEmail.toLowerCase().trim()) {
    return fail(400, 'Payment does not match this purchase');
  }

  const orderAmount = Number(order.amount);
  const paidAmount = Number(payment.amount);
  if (!Number.isFinite(orderAmount) || !Number.isFinite(paidAmount) || paidAmount !== orderAmount) {
    return fail(400, 'Payment amount does not match the order');
  }

  // Duration comes from the product catalog; amount already locked at order creation time.
  const price = await resolveRazorpayProductPrice(p.productId);
  return { ok: true, amountPaise: paidAmount, durationDays: price?.durationDays };
}

/**
 * Inserts the payment_requests audit row keyed by Razorpay payment id.
 * Returns false when this payment was already used (primary-key conflict).
 */
export async function claimRazorpayPayment(
  record: Record<string, unknown> & { transactionId: string },
): Promise<boolean> {
  const { error } = await getSupabaseAdminClient()
    .from('payment_requests')
    .insert({ ...record, id: `payment_rzp_${record.transactionId}` });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw new Error(`Failed to record payment: ${error.message}`);
}

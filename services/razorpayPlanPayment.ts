import type { SubscriptionPlan } from '../types';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function isRazorpayConfiguredInClient(): boolean {
  return Boolean(
    typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_RAZORPAY_KEY_ID &&
      String(import.meta.env.VITE_RAZORPAY_KEY_ID).trim().length > 0
  );
}

export function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-rzp-checkout="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(!!window.Razorpay), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.dataset.rzpCheckout = '1';
    s.onload = () => resolve(!!window.Razorpay);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function createRazorpayOrder(params: {
  amountPaise: number;
  planId: SubscriptionPlan;
  sellerEmail: string;
}): Promise<{ orderId: string; keyId: string; amount: number }> {
  const response = await authenticatedFetch('/api/payments?action=create-razorpay-order', {
    method: 'POST',
    body: JSON.stringify({
      amountPaise: params.amountPaise,
      planId: params.planId,
      sellerEmail: params.sellerEmail,
    }),
  });
  const result = await handleApiResponse<{
    orderId?: string;
    keyId?: string;
    amount?: number;
    reason?: string;
  }>(response);
  if (!result.success || !result.data?.orderId || !result.data?.keyId) {
    throw new Error(result.reason || result.error || 'Could not start payment');
  }
  return {
    orderId: result.data.orderId,
    keyId: result.data.keyId,
    amount: Number(result.data.amount) || params.amountPaise,
  };
}

async function confirmRazorpayOnServer(body: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  planId: SubscriptionPlan;
  sellerEmail: string;
  amount: number;
}): Promise<void> {
  const response = await authenticatedFetch('/api/payments?action=confirm-razorpay-payment', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const result = await handleApiResponse(response);
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Payment verification failed');
  }
}

/**
 * Opens Razorpay Checkout for seller plan upgrade; verifies signature on server and records payment.
 */
export function openRazorpayPlanCheckout(options: {
  planId: SubscriptionPlan;
  amountInr: number;
  sellerEmail: string;
  sellerName?: string;
  onSuccess: () => void;
  onFailure: (message: string) => void;
}): void {
  const { planId, amountInr, sellerEmail, sellerName, onSuccess, onFailure } = options;
  const keyFromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_RAZORPAY_KEY_ID
      ? String(import.meta.env.VITE_RAZORPAY_KEY_ID).trim()
      : '';

  void (async () => {
    try {
      const loaded = await loadRazorpayCheckoutScript();
      if (!loaded || !window.Razorpay) {
        onFailure('Could not load payment gateway. Try again or use manual transfer.');
        return;
      }

      const amountPaise = Math.max(1, Math.round(Number(amountInr) * 100));
      const order = await createRazorpayOrder({ amountPaise, planId, sellerEmail });
      const keyId = keyFromEnv || order.keyId;

      const rzp = new window.Razorpay!({
        key: keyId,
        amount: order.amount,
        currency: 'INR',
        name: 'ReRide',
        description: `Subscription: ${planId}`,
        order_id: order.orderId,
        prefill: {
          email: sellerEmail,
          name: sellerName || sellerEmail.split('@')[0],
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await confirmRazorpayOnServer({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId,
              sellerEmail,
              amount: amountInr,
            });
            onSuccess();
          } catch (e) {
            onFailure(e instanceof Error ? e.message : 'Verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            /* user closed — no-op */
          },
        },
      });
      rzp.open();
    } catch (e) {
      onFailure(e instanceof Error ? e.message : 'Payment could not start');
    }
  })();
}

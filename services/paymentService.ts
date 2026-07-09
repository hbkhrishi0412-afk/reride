/**
 * Unified Payment Service
 * Handles all payment-related operations: subscriptions, boosts, inspections, and credits
 */

import type { SubscriptionPlan, BoostPackage, User } from '../types.js';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch.js';
import { 
  loadRazorpayCheckoutScript, 
  isRazorpayConfiguredInClient,
  openRazorpayPlanCheckout,
  openRazorpayBoostCheckout 
} from './razorpayPlanPayment.js';

// Product types for payments
export type PaymentProductType = 
  | 'subscription'
  | 'boost'
  | 'inspection'
  | 'featured_credits'
  | 'certification';

// Payment method types
export type PaymentMethod = 'razorpay' | 'upi' | 'bank_transfer' | 'manual';

// Pricing configuration
export const PRICING = {
  subscriptions: {
    free: { price: 0, period: 'monthly' as const },
    pro: { price: 499, period: 'monthly' as const },
    premium: { price: 1999, period: 'monthly' as const },
  },
  boosts: {
    top_search_7d: { price: 199, duration: 7 },
    featured_7d: { price: 99, duration: 7 },
    spotlight_3d: { price: 499, duration: 3 },
    multi_city_7d: { price: 299, duration: 7 },
  },
  inspections: {
    physical_doorstep: { price: 999, description: 'Doorstep Physical Inspection' },
    physical_center: { price: 799, description: 'Inspection at our center' },
  },
  credits: {
    featured_5: { price: 399, credits: 5 },
    featured_10: { price: 699, credits: 10 },
    featured_25: { price: 1499, credits: 25 },
  },
};

// Payment status
export interface PaymentStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  orderId?: string;
  amount: number;
  currency: 'INR';
  productType: PaymentProductType;
  productId: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

// Payment intent
export interface PaymentIntent {
  orderId: string;
  amount: number;
  currency: 'INR';
  productType: PaymentProductType;
  productId: string;
  description: string;
  sellerEmail: string;
  expiresAt: string;
}

/**
 * Check if Razorpay is available
 */
export function isPaymentGatewayAvailable(): boolean {
  return isRazorpayConfiguredInClient();
}

/**
 * Get payment method availability
 */
export function getAvailablePaymentMethods(): PaymentMethod[] {
  const methods: PaymentMethod[] = ['upi', 'bank_transfer', 'manual'];
  
  if (isRazorpayConfiguredInClient()) {
    methods.unshift('razorpay');
  }
  
  return methods;
}

/**
 * Calculate plan price with any applicable discounts
 */
export function calculatePlanPrice(
  planId: SubscriptionPlan,
  billingPeriod: 'monthly' | 'yearly' = 'monthly'
): { price: number; originalPrice?: number; discount?: number } {
  const basePrices = PRICING.subscriptions;
  const basePrice = basePrices[planId]?.price || 0;
  
  if (billingPeriod === 'yearly' && planId !== 'free') {
    const yearlyPrice = basePrice * 10; // 2 months free
    return {
      price: yearlyPrice,
      originalPrice: basePrice * 12,
      discount: 17, // ~17% off
    };
  }
  
  return { price: basePrice };
}

/**
 * Process subscription upgrade
 */
export async function processSubscriptionUpgrade(options: {
  planId: SubscriptionPlan;
  sellerEmail: string;
  sellerName?: string;
  paymentMethod: PaymentMethod;
}): Promise<{ success: boolean; error?: string }> {
  const { planId, sellerEmail, sellerName, paymentMethod } = options;
  const pricing = calculatePlanPrice(planId);
  
  if (pricing.price === 0) {
    // Free plan - just update
    return await updateSubscriptionDirect(planId, sellerEmail);
  }
  
  if (paymentMethod === 'razorpay') {
    return new Promise((resolve) => {
      openRazorpayPlanCheckout({
        planId,
        amountInr: pricing.price,
        sellerEmail,
        sellerName,
        onSuccess: () => resolve({ success: true }),
        onFailure: (message) => resolve({ success: false, error: message }),
      });
    });
  }
  
  if (paymentMethod === 'upi' || paymentMethod === 'bank_transfer') {
    // Create manual payment request for admin approval
    return await createManualPaymentRequest({
      productType: 'subscription',
      productId: planId,
      amount: pricing.price,
      sellerEmail,
      paymentMethod,
    });
  }
  
  return { success: false, error: 'Invalid payment method' };
}

/**
 * Process boost purchase
 */
export async function processBoostPurchase(options: {
  vehicleId: number;
  packageId: keyof typeof PRICING.boosts;
  sellerEmail: string;
  sellerName?: string;
  paymentMethod: PaymentMethod;
}): Promise<{ success: boolean; error?: string }> {
  const { vehicleId, packageId, sellerEmail, sellerName, paymentMethod } = options;
  const boostPricing = PRICING.boosts[packageId];
  
  if (!boostPricing) {
    return { success: false, error: 'Invalid boost package' };
  }
  
  if (paymentMethod === 'razorpay') {
    return new Promise((resolve) => {
      openRazorpayBoostCheckout({
        vehicleId,
        packageId,
        packageName: getBoostPackageName(packageId),
        amountInr: boostPricing.price,
        sellerEmail,
        sellerName,
        onSuccess: async (razorpay) => {
          // Verify and apply boost on server
          const result = await verifyAndApplyBoost({
            vehicleId,
            packageId,
            ...razorpay,
          });
          resolve(result);
        },
        onFailure: (message) => resolve({ success: false, error: message }),
      });
    });
  }
  
  return await createManualPaymentRequest({
    productType: 'boost',
    productId: `${vehicleId}:${packageId}`,
    amount: boostPricing.price,
    sellerEmail,
    paymentMethod,
  });
}

/**
 * Process inspection purchase
 */
export async function processInspectionPurchase(options: {
  vehicleId: number;
  inspectionType: keyof typeof PRICING.inspections;
  sellerEmail: string;
  paymentMethod: PaymentMethod;
}): Promise<{ success: boolean; inspectionId?: string; error?: string }> {
  const { vehicleId, inspectionType, sellerEmail, paymentMethod } = options;
  const inspectionPricing = PRICING.inspections[inspectionType];
  
  if (!inspectionPricing) {
    return { success: false, error: 'Invalid inspection type' };
  }
  
  // Paid inspection
  if (paymentMethod === 'razorpay') {
    return new Promise((resolve) => {
      void (async () => {
        try {
          const loaded = await loadRazorpayCheckoutScript();
          if (!loaded) {
            resolve({ success: false, error: 'Payment gateway unavailable' });
            return;
          }
          
          // Create order and process payment
          const response = await authenticatedFetch('/api/payments?action=create-razorpay-order', {
            method: 'POST',
            body: JSON.stringify({
              amountPaise: inspectionPricing.price * 100,
              planId: `inspection:${inspectionType}`,
              sellerEmail,
              metadata: { vehicleId },
            }),
          });
          
          const result = await handleApiResponse<{ orderId: string; keyId: string }>(response);
          if (!result.success || !result.data?.orderId) {
            resolve({ success: false, error: 'Could not create payment order' });
            return;
          }
          
          const keyId = import.meta.env?.VITE_RAZORPAY_KEY_ID || result.data.keyId;
          
          const rzp = new window.Razorpay!({
            key: keyId,
            amount: inspectionPricing.price * 100,
            currency: 'INR',
            name: 'ReRide',
            description: inspectionPricing.description,
            order_id: result.data.orderId,
            prefill: { email: sellerEmail },
            handler: async (razorpayResponse: any) => {
              const verification = await verifyInspectionPayment({
                vehicleId,
                inspectionType,
                ...razorpayResponse,
              });
              resolve(verification);
            },
            modal: {
              ondismiss: () => resolve({ success: false, error: 'Payment cancelled' }),
            },
          });
          
          rzp.open();
        } catch (e) {
          resolve({ success: false, error: e instanceof Error ? e.message : 'Payment failed' });
        }
      })();
    });
  }
  
  return await createManualPaymentRequest({
    productType: 'inspection',
    productId: `${vehicleId}:${inspectionType}`,
    amount: inspectionPricing.price,
    sellerEmail,
    paymentMethod,
  });
}

/**
 * Purchase featured listing credits
 */
export async function purchaseFeaturedCredits(options: {
  packageId: keyof typeof PRICING.credits;
  sellerEmail: string;
  paymentMethod: PaymentMethod;
}): Promise<{ success: boolean; creditsAdded?: number; error?: string }> {
  const { packageId, sellerEmail, paymentMethod } = options;
  const creditPricing = PRICING.credits[packageId];
  
  if (!creditPricing) {
    return { success: false, error: 'Invalid credit package' };
  }
  
  if (paymentMethod === 'razorpay') {
    return new Promise((resolve) => {
      void (async () => {
        try {
          const loaded = await loadRazorpayCheckoutScript();
          if (!loaded) {
            resolve({ success: false, error: 'Payment gateway unavailable' });
            return;
          }
          
          const response = await authenticatedFetch('/api/payments?action=create-razorpay-order', {
            method: 'POST',
            body: JSON.stringify({
              amountPaise: creditPricing.price * 100,
              planId: `credits:${packageId}`,
              sellerEmail,
            }),
          });
          
          const result = await handleApiResponse<{ orderId: string; keyId: string }>(response);
          if (!result.success || !result.data?.orderId) {
            resolve({ success: false, error: 'Could not create payment order' });
            return;
          }
          
          const keyId = import.meta.env?.VITE_RAZORPAY_KEY_ID || result.data.keyId;
          
          const rzp = new window.Razorpay!({
            key: keyId,
            amount: creditPricing.price * 100,
            currency: 'INR',
            name: 'ReRide',
            description: `${creditPricing.credits} Featured Credits`,
            order_id: result.data.orderId,
            prefill: { email: sellerEmail },
            handler: async (razorpayResponse: any) => {
              const verification = await verifyCreditPurchase({
                packageId,
                credits: creditPricing.credits,
                sellerEmail,
                ...razorpayResponse,
              });
              resolve(verification);
            },
            modal: {
              ondismiss: () => resolve({ success: false, error: 'Payment cancelled' }),
            },
          });
          
          rzp.open();
        } catch (e) {
          resolve({ success: false, error: e instanceof Error ? e.message : 'Payment failed' });
        }
      })();
    });
  }
  
  return await createManualPaymentRequest({
    productType: 'featured_credits',
    productId: packageId,
    amount: creditPricing.price,
    sellerEmail,
    paymentMethod,
  });
}

/**
 * Get seller's current subscription and credits
 */
export async function getSellerPaymentStatus(sellerEmail: string): Promise<{
  subscription: {
    plan: SubscriptionPlan;
    expiresAt?: string;
    autoRenew: boolean;
  };
  credits: {
    featured: number;
    certifications: number;
  };
  recentTransactions: PaymentStatus[];
}> {
  const response = await authenticatedFetch(`/api/payments?action=seller-status&email=${encodeURIComponent(sellerEmail)}`);
  const result = await handleApiResponse<any>(response);
  
  if (!result.success || !result.data) {
    return {
      subscription: { plan: 'free', autoRenew: false },
      credits: { featured: 0, certifications: 0 },
      recentTransactions: [],
    };
  }
  
  return result.data;
}

// Helper functions

async function updateSubscriptionDirect(
  planId: SubscriptionPlan,
  sellerEmail: string
): Promise<{ success: boolean; error?: string }> {
  const response = await authenticatedFetch('/api/users', {
    method: 'PUT',
    body: JSON.stringify({
      email: sellerEmail,
      subscriptionPlan: planId,
      planActivatedDate: new Date().toISOString(),
    }),
  });
  
  const result = await handleApiResponse(response);
  return { success: result.success, error: result.reason };
}

async function createManualPaymentRequest(params: {
  productType: PaymentProductType;
  productId: string;
  amount: number;
  sellerEmail: string;
  paymentMethod: PaymentMethod;
}): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const response = await authenticatedFetch('/api/payments?action=create-manual-request', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  
  const result = await handleApiResponse<{ requestId: string }>(response);
  return {
    success: result.success,
    requestId: result.data?.requestId,
    error: result.reason,
  };
}

async function verifyAndApplyBoost(params: {
  vehicleId: number;
  packageId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ success: boolean; error?: string }> {
  const response = await authenticatedFetch('/api/vehicles?action=boost', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  
  const result = await handleApiResponse(response);
  return { success: result.success, error: result.reason };
}

async function verifyInspectionPayment(_params: {
  vehicleId: number;
  inspectionType: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ success: boolean; inspectionId?: string; error?: string }> {
  return {
    success: false,
    error: 'Paid physical inspection checkout is not available yet. Contact support@reride.com for assistance.',
  };
}

async function verifyCreditPurchase(params: {
  packageId: string;
  credits: number;
  sellerEmail: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ success: boolean; creditsAdded?: number; error?: string }> {
  const response = await authenticatedFetch('/api/payments?action=verify-credits', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  
  const result = await handleApiResponse<{ creditsAdded: number }>(response);
  return {
    success: result.success,
    creditsAdded: result.data?.creditsAdded,
    error: result.reason,
  };
}

function getBoostPackageName(packageId: string): string {
  const names: Record<string, string> = {
    top_search_7d: 'Top of Search (7 days)',
    featured_7d: 'Featured Badge (7 days)',
    spotlight_3d: 'Homepage Spotlight (3 days)',
    multi_city_7d: 'Multi-City Visibility (7 days)',
  };
  return names[packageId] || packageId;
}

// UPI Intent helper (for mobile apps)
export function generateUPIIntent(options: {
  amount: number;
  orderId: string;
  description: string;
}): string {
  const { amount, orderId, description } = options;
  const upiId = import.meta.env?.VITE_UPI_ID || 'reride@upi';
  
  return `upi://pay?pa=${upiId}&pn=ReRide&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}&tr=${orderId}`;
}

// Re-export PaymentRequest from types for consistency
import type { PaymentRequest } from '../types.js';
export type { PaymentRequest };

/**
 * Get all payment requests (admin function)
 */
export async function getPaymentRequests(
  adminEmail: string,
  status?: string
): Promise<PaymentRequest[]> {
  const queryParams = new URLSearchParams();
  queryParams.append('action', 'list-requests');
  queryParams.append('adminEmail', adminEmail);
  if (status) queryParams.append('status', status);

  const response = await authenticatedFetch(`/api/payments?${queryParams.toString()}`);
  const result = await handleApiResponse<{ requests: PaymentRequest[] }>(response);
  
  return result.data?.requests || [];
}

/**
 * Create a payment request
 */
export async function createPaymentRequest(
  sellerEmail: string,
  planId: SubscriptionPlan,
  amount: number,
  paymentProof?: string,
  paymentMethod?: 'upi' | 'bank_transfer' | 'card' | 'other',
  transactionId?: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const response = await authenticatedFetch('/api/payments?action=create-request', {
    method: 'POST',
    body: JSON.stringify({
      sellerEmail,
      planId,
      amount,
      paymentProof,
      paymentMethod,
      transactionId,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    }),
  });
  
  const result = await handleApiResponse<{ requestId: string }>(response);
  return {
    success: result.success,
    requestId: result.data?.requestId,
    error: result.reason,
  };
}

/**
 * Get status of a specific payment request
 */
export async function getPaymentRequestStatus(requestId: string): Promise<PaymentRequest | null> {
  const response = await authenticatedFetch(`/api/payments?action=request-status&requestId=${encodeURIComponent(requestId)}`);
  const result = await handleApiResponse<PaymentRequest>(response);
  
  return result.data || null;
}

/**
 * Approve a payment request (admin function)
 */
export async function approvePaymentRequest(
  requestId: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  const response = await authenticatedFetch('/api/payments?action=approve-request', {
    method: 'POST',
    body: JSON.stringify({ 
      requestId, 
      approvedBy: adminEmail,
      approvedAt: new Date().toISOString(),
    }),
  });
  
  const result = await handleApiResponse(response);
  return { success: result.success, error: result.reason };
}

/**
 * Reject a payment request (admin function)
 */
export async function rejectPaymentRequest(
  requestId: string,
  adminEmail: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const response = await authenticatedFetch('/api/payments?action=reject-request', {
    method: 'POST',
    body: JSON.stringify({ 
      requestId, 
      rejectedBy: adminEmail,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
    }),
  });
  
  const result = await handleApiResponse(response);
  return { success: result.success, error: result.reason };
}

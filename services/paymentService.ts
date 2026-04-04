import type { PaymentRequest, SubscriptionPlan } from '../types';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

// Create a payment request for plan upgrade
export const createPaymentRequest = async (
  sellerEmail: string,
  planId: SubscriptionPlan,
  amount: number,
  paymentProof?: string,
  paymentMethod?: 'upi' | 'bank_transfer' | 'card' | 'other',
  transactionId?: string
): Promise<PaymentRequest> => {
  try {
    const response = await authenticatedFetch('/api/payments?action=create', {
      method: 'POST',
      body: JSON.stringify({
        sellerEmail,
        planId,
        amount,
        paymentProof,
        paymentMethod,
        transactionId
      }),
    });

    const result = await handleApiResponse<{ paymentRequest?: PaymentRequest }>(response);
    if (!result.success) {
      throw new Error(result.reason || result.error || 'Failed to create payment request');
    }
    if (!result.data?.paymentRequest) {
      throw new Error('Invalid server response: missing paymentRequest');
    }
    return result.data.paymentRequest;
  } catch (error) {
    console.error('Error creating payment request:', error);
    throw error;
  }
};

function normalizePaymentRequestFromApi(
  raw: Record<string, unknown>,
  sellerEmail: string
): PaymentRequest | null {
  const planId = (raw.planId ?? raw.plan) as PaymentRequest['planId'] | undefined;
  const status = raw.status as PaymentRequest['status'] | undefined;
  const amount = Number(raw.amount ?? 0);
  if (
    !planId ||
    !['pending', 'approved', 'rejected'].includes(String(status))
  ) {
    return null;
  }
  return {
    id: String(raw.id || ''),
    sellerEmail: String(raw.sellerEmail || sellerEmail),
    planId,
    amount,
    status: status as PaymentRequest['status'],
    paymentProof: raw.paymentProof as string | undefined,
    paymentMethod: raw.paymentMethod as PaymentRequest['paymentMethod'],
    transactionId: raw.transactionId as string | undefined,
    requestedAt: String(
      raw.requestedAt || raw.createdAt || new Date().toISOString()
    ),
  };
}

// Get payment request status for a seller
export const getPaymentRequestStatus = async (sellerEmail: string): Promise<PaymentRequest | null> => {
  try {
    const response = await authenticatedFetch(`/api/payments?action=status&sellerEmail=${encodeURIComponent(sellerEmail)}`);
    const result = await handleApiResponse<Record<string, unknown>>(response);
    if (!result.success) {
      throw new Error(result.reason || result.error || 'Failed to get payment request status');
    }
    const data = result.data;
    if (!data || typeof data !== 'object') return null;

    const direct = data.paymentRequest as PaymentRequest | undefined;
    if (direct?.planId && direct.status) return direct;

    const wrapper = data.paymentStatus as Record<string, unknown> | undefined;
    if (!wrapper || String(wrapper.status).toLowerCase() === 'none') {
      return null;
    }
    const last = wrapper.lastPayment as Record<string, unknown> | undefined;
    if (!last) return null;
    return normalizePaymentRequestFromApi(last, sellerEmail);
  } catch (error) {
    console.error('Error getting payment request status:', error);
    return null;
  }
};

// Admin functions
export const getPaymentRequests = async (adminEmail: string, status?: string): Promise<PaymentRequest[]> => {
  try {
    const url = `/api/payments?action=list&adminEmail=${encodeURIComponent(adminEmail)}${status ? `&status=${status}` : ''}`;
    const response = await authenticatedFetch(url);
    const result = await handleApiResponse<{ paymentRequests?: PaymentRequest[] }>(response);
    if (!result.success) {
      throw new Error(result.reason || result.error || 'Failed to get payment requests');
    }
    return result.data?.paymentRequests || [];
  } catch (error) {
    console.error('Error getting payment requests:', error);
    throw error;
  }
};

export const approvePaymentRequest = async (
  paymentRequestId: string,
  adminEmail: string,
  notes?: string
): Promise<PaymentRequest> => {
  try {
    const response = await authenticatedFetch('/api/payments?action=approve', {
      method: 'POST',
      body: JSON.stringify({
        paymentRequestId,
        adminEmail,
        notes
      }),
    });

    const result = await handleApiResponse<{ paymentRequest?: PaymentRequest }>(response);
    if (!result.success) {
      throw new Error(result.reason || result.error || 'Failed to approve payment request');
    }
    return result.data?.paymentRequest || ({ id: paymentRequestId } as unknown as PaymentRequest);
  } catch (error) {
    console.error('Error approving payment request:', error);
    throw error;
  }
};

export const rejectPaymentRequest = async (
  paymentRequestId: string,
  adminEmail: string,
  rejectionReason?: string
): Promise<PaymentRequest> => {
  try {
    const response = await authenticatedFetch('/api/payments?action=reject', {
      method: 'POST',
      body: JSON.stringify({
        paymentRequestId,
        adminEmail,
        rejectionReason
      }),
    });

    const result = await handleApiResponse<{ paymentRequest?: PaymentRequest }>(response);
    if (!result.success) {
      throw new Error(result.reason || result.error || 'Failed to reject payment request');
    }
    return result.data?.paymentRequest || ({ id: paymentRequestId } as unknown as PaymentRequest);
  } catch (error) {
    console.error('Error rejecting payment request:', error);
    throw error;
  }
};

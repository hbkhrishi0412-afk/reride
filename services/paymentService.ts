import type { PaymentRequest, SubscriptionPlan } from '../types';

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
    const response = await fetch('/api/payments?action=create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sellerEmail,
        planId,
        amount,
        paymentProof,
        paymentMethod,
        transactionId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create payment request');
    }

    const data = await response.json();
    return data.paymentRequest;
  } catch (error) {
    console.error('Error creating payment request:', error);
    throw error;
  }
};

// Get payment request status for a seller
export const getPaymentRequestStatus = async (sellerEmail: string): Promise<PaymentRequest | null> => {
  try {
    const response = await fetch(`/api/payments?action=status&sellerEmail=${encodeURIComponent(sellerEmail)}`);
    
    if (!response.ok) {
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get payment request status');
      } else {
        throw new Error(`API endpoint not found (${response.status})`);
      }
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      // Backend returns { paymentStatus }, normalize to PaymentRequest-like object if present
      return data.paymentRequest || data.paymentStatus || null;
    } else {
      throw new Error('API returned non-JSON response');
    }
  } catch (error) {
    console.error('Error getting payment request status:', error);
    return null;
  }
};

// Admin functions
export const getPaymentRequests = async (adminEmail: string, status?: string): Promise<PaymentRequest[]> => {
  try {
    const url = `/api/payments?action=list&adminEmail=${encodeURIComponent(adminEmail)}${status ? `&status=${status}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get payment requests');
    }

    const data = await response.json();
    return data.paymentRequests || [];
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
    const response = await fetch('/api/payments?action=approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentRequestId,
        adminEmail,
        notes
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve payment request');
    }

    const data = await response.json();
    return data.paymentRequest || { id: paymentRequestId } as unknown as PaymentRequest;
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
    const response = await fetch('/api/payments?action=reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentRequestId,
        adminEmail,
        rejectionReason
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject payment request');
    }

    const data = await response.json();
    return data.paymentRequest || { id: paymentRequestId } as unknown as PaymentRequest;
  } catch (error) {
    console.error('Error rejecting payment request:', error);
    throw error;
  }
};

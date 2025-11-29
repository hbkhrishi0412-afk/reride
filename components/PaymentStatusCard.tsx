import React, { useState, useEffect } from 'react';
import type { PaymentRequest, User } from '../types';
import { getPaymentRequestStatus } from '../services/paymentService';

interface PaymentStatusCardProps {
  currentUser: User;
}

const PaymentStatusCard: React.FC<PaymentStatusCardProps> = ({ currentUser }) => {
  // CRITICAL FIX: Hooks must be called unconditionally (React Rules of Hooks)
  // Moved useState hooks BEFORE any conditional returns
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPaymentStatus = async () => {
    try {
      setLoading(true);
      // Add safety check for currentUser and email
      if (!currentUser || !currentUser.email) {
        console.warn('PaymentStatusCard: currentUser or email is missing');
        setLoading(false);
        return;
      }
      const request = await getPaymentRequestStatus(currentUser.email);
      setPaymentRequest(request);
    } catch (error) {
      console.error('Error loading payment status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.email) {
      loadPaymentStatus();
    } else {
      // If no email, set loading to false to prevent infinite loading state
      setLoading(false);
    }
  }, [currentUser?.email]);

  // Early return AFTER hooks - this is the correct pattern
  if (!currentUser || !currentUser.email) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!paymentRequest) {
    return null; // No pending payment request
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'approved':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'rejected':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={`p-2 rounded-full ${getStatusColor(paymentRequest.status)}`}>
            {getStatusIcon(paymentRequest.status)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Payment Request Status
            </h3>
            <p className="text-sm text-gray-600">
              {paymentRequest.planId.charAt(0).toUpperCase() + paymentRequest.planId.slice(1)} Plan - ₹{paymentRequest.amount.toLocaleString('en-IN')}/month
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(paymentRequest.status)}`}>
          {paymentRequest.status.charAt(0).toUpperCase() + paymentRequest.status.slice(1)}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Requested:</span>
          <span className="text-gray-900">{formatDate(paymentRequest.requestedAt)}</span>
        </div>
        
        {paymentRequest.transactionId && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Transaction ID:</span>
            <span className="text-gray-900 font-mono">{paymentRequest.transactionId}</span>
          </div>
        )}

        {paymentRequest.paymentMethod && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Payment Method:</span>
            <span className="text-gray-900">{paymentRequest.paymentMethod.replace('_', ' ').toUpperCase()}</span>
          </div>
        )}

        {paymentRequest.status === 'approved' && paymentRequest.approvedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Approved:</span>
            <span className="text-gray-900">{formatDate(paymentRequest.approvedAt)}</span>
          </div>
        )}

        {paymentRequest.status === 'rejected' && paymentRequest.rejectedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Rejected:</span>
            <span className="text-gray-900">{formatDate(paymentRequest.rejectedAt)}</span>
          </div>
        )}

        {paymentRequest.status === 'rejected' && paymentRequest.rejectionReason && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>Rejection Reason:</strong> {paymentRequest.rejectionReason}
            </p>
          </div>
        )}

        {paymentRequest.status === 'pending' && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Your payment request is under review. Plan activation typically takes 1-2 business days after payment verification.
            </p>
          </div>
        )}

        {paymentRequest.status === 'approved' && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Congratulations!</strong> Your payment has been verified and your {paymentRequest.planId.charAt(0).toUpperCase() + paymentRequest.planId.slice(1)} plan is now active.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentStatusCard;

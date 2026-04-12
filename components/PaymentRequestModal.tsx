import React, { useState } from 'react';
import type { SubscriptionPlan } from '../types';
import { createPaymentRequest } from '../services/paymentService';
import { isRazorpayConfiguredInClient, openRazorpayPlanCheckout } from '../services/razorpayPlanPayment';

interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: SubscriptionPlan;
  amount: number;
  sellerEmail: string;
  onSuccess: () => void;
  /** User feedback (replaces window.alert). */
  onNotify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const PaymentRequestModal: React.FC<PaymentRequestModalProps> = ({
  isOpen,
  onClose,
  planId,
  amount,
  sellerEmail,
  onSuccess,
  onNotify,
}) => {
  const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    if (onNotify) onNotify(message, type);
    else if (type === 'error') console.error(message);
    else console.info(message);
  };

  const razorpayEnabled = isRazorpayConfiguredInClient();
  const [payMode, setPayMode] = useState<'razorpay' | 'manual'>(razorpayEnabled ? 'razorpay' : 'manual');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank_transfer' | 'card' | 'other'>('upi');
  const [transactionId, setTransactionId] = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGatewayBusy, setIsGatewayBusy] = useState(false);

  const resetForm = () => {
    setTransactionId('');
    setPaymentProof('');
    setPaymentMethod('upi');
    setIsSubmitting(false);
    setIsGatewayBusy(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transactionId.trim()) {
      notify('Please enter transaction ID/reference', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await createPaymentRequest(
        sellerEmail,
        planId,
        amount,
        paymentProof,
        paymentMethod,
        transactionId
      );

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Payment request error:', error);
      notify('Failed to submit payment request. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const startRazorpay = () => {
    if (!sellerEmail) {
      notify('You must be signed in to pay.', 'error');
      return;
    }
    setIsGatewayBusy(true);
    openRazorpayPlanCheckout({
      planId,
      amountInr: amount,
      sellerEmail,
      onSuccess: () => {
        setIsGatewayBusy(false);
        notify('Payment successful. Your plan will update shortly.', 'success');
        onSuccess();
        onClose();
        resetForm();
      },
      onFailure: (msg) => {
        setIsGatewayBusy(false);
        notify(msg, 'error');
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Upgrade plan</h2>
            <button
              type="button"
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-orange-800">
                  <strong>Amount:</strong> ₹{amount.toLocaleString('en-IN')}/month —{' '}
                  {planId.charAt(0).toUpperCase() + planId.slice(1)}
                </p>
              </div>
            </div>
          </div>

          {razorpayEnabled && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-4">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium ${payMode === 'razorpay' ? 'bg-orange-500 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setPayMode('razorpay')}
              >
                Pay online
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium ${payMode === 'manual' ? 'bg-orange-500 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setPayMode('manual')}
              >
                Bank / UPI proof
              </button>
            </div>
          )}

          {payMode === 'razorpay' && razorpayEnabled ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Pay securely with UPI, cards, or netbanking via Razorpay. Your subscription is recorded automatically after payment.
              </p>
              <button
                type="button"
                disabled={isGatewayBusy}
                onClick={startRazorpay}
                className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-semibold"
              >
                {isGatewayBusy ? 'Opening checkout…' : `Pay ₹${amount.toLocaleString('en-IN')}`}
              </button>
              <p className="text-xs text-gray-500">
                If checkout fails, use &quot;Bank / UPI proof&quot; and our team will verify manually.
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'upi' | 'bank_transfer' | 'card' | 'other')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="upi">UPI Payment</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction ID / Reference Number *
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder={
                    paymentMethod === 'upi'
                      ? 'UPI Transaction ID'
                      : paymentMethod === 'bank_transfer'
                        ? 'Bank reference'
                        : 'Transaction reference'
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Proof (Optional)</label>
                <textarea
                  value={paymentProof}
                  onChange={(e) => setPaymentProof(e.target.value)}
                  placeholder="Screenshot URL or payment note"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Payment'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Manual submissions are reviewed within 1–2 business days. Online payments are verified automatically when Razorpay is enabled.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentRequestModal;

import React, { useState, useEffect } from 'react';
import type { PaymentRequest, User } from '../types';
import { getPaymentRequests, approvePaymentRequest, rejectPaymentRequest } from '../services/paymentService';
import {
    AdminPageIntro,
    AdminSegmentedTabs,
    AdminDataTableFrame,
    AdminEmptyState,
    adminTableHeadClass,
} from './admin/AdminPrimitives';

interface PaymentManagementProps {
  currentUser: User;
}

const PaymentManagement: React.FC<PaymentManagementProps> = ({ currentUser }) => {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadPaymentRequests();
  }, [filter]);

  const loadPaymentRequests = async () => {
    try {
      setLoading(true);
      const requests = await getPaymentRequests(currentUser.email, filter === 'all' ? undefined : filter);
      setPaymentRequests(requests);
    } catch (error) {
      console.error('Error loading payment requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentRequestId: string) => {
    try {
      await approvePaymentRequest(paymentRequestId, currentUser.email);
      await loadPaymentRequests();
    } catch (error) {
      console.error('Error approving payment request:', error);
      alert('Failed to approve payment request');
    }
  };

  const handleReject = async (paymentRequestId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await rejectPaymentRequest(paymentRequestId, currentUser.email, reason);
      await loadPaymentRequests();
    } catch (error) {
      console.error('Error rejecting payment request:', error);
      alert('Failed to reject payment request');
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  const filterTabs = (['all', 'pending', 'approved', 'rejected'] as const).map((status) => ({
    id: status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
  }));

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Commerce"
        title="Payment requests"
        description="Review seller plan upgrades and payouts. Approve or reject with a clear audit trail."
      />
      <AdminSegmentedTabs
        aria-label="Payment request status"
        value={filter}
        onChange={(id) => setFilter(id)}
        items={filterTabs}
      />

      {paymentRequests.length === 0 ? (
        <AdminEmptyState
          title="No requests in this view"
          description="When sellers submit payments, they will appear here for review."
        />
      ) : (
        <AdminDataTableFrame title="Request queue" subtitle={`${paymentRequests.length} record(s)`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className={`${adminTableHeadClass} px-4 py-3`}>Seller</th>
                  <th className={`${adminTableHeadClass} px-4 py-3`}>Plan</th>
                  <th className={`${adminTableHeadClass} px-4 py-3`}>Amount</th>
                  <th className={`${adminTableHeadClass} px-4 py-3`}>Payment method</th>
                  <th className={`${adminTableHeadClass} px-4 py-3`}>Transaction ID</th>
                  <th className={`${adminTableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${adminTableHeadClass} px-4 py-3`}>Requested</th>
                  <th className={`${adminTableHeadClass} px-4 py-3 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paymentRequests.map((request) => (
                  <tr key={request.id} className="transition-colors hover:bg-violet-50/[0.35]">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {request.sellerName || request.sellerEmail}
                        </div>
                        <div className="text-xs text-slate-500">{request.sellerEmail}</div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">
                        {request.planId.charAt(0).toUpperCase() + request.planId.slice(1)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        ₹{request.amount.toLocaleString('en-IN')}/mo
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {request.paymentMethod ? request.paymentMethod.replace('_', ' ').toUpperCase() : 'N/A'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {request.transactionId || 'N/A'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={getStatusBadge(request.status)}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {formatDate(request.requestedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                      {request.status === 'pending' && (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleApprove(request.id)}
                            className="text-emerald-600 hover:text-emerald-800"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(request.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {request.status === 'approved' && (
                        <span className="text-emerald-700">Approved · {request.approvedBy}</span>
                      )}
                      {request.status === 'rejected' && (
                        <span className="text-red-700">Rejected · {request.rejectedBy}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminDataTableFrame>
      )}
    </div>
  );
};

export default PaymentManagement;

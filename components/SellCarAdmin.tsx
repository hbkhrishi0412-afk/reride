import React, { useState, useEffect } from 'react';
import { View as ViewEnum } from '../types';
import { sellCarAPI } from '../services/sellCarService';

interface SellCarSubmission {
  _id?: string;
  registration: string;
  make: string;
  model: string;
  variant: string;
  year: string;
  district: string;
  noOfOwners: string;
  kilometers: string;
  fuelType: string;
  transmission: string;
  customerContact: string;
  submittedAt: string;
  status: 'pending' | 'contacted' | 'completed' | 'rejected';
  adminNotes?: string;
  estimatedPrice?: number;
  updatedAt?: string;
}

interface SellCarAdminProps {
  onNavigate: (view: ViewEnum) => void;
}

const SellCarAdmin: React.FC<SellCarAdminProps> = ({ onNavigate }) => {
  const [submissions, setSubmissions] = useState<SellCarSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<SellCarSubmission | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [newStatus, setNewStatus] = useState<'pending' | 'contacted' | 'completed' | 'rejected'>('pending');

  const itemsPerPage = 10;

  useEffect(() => {
    fetchSubmissions();
  }, [currentPage, statusFilter, searchTerm]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const result = await sellCarAPI.getSubmissions({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm || undefined
      });

      if (result.success && result.data) {
        setSubmissions(result.data);
        setTotalPages(result.pagination?.pages || 1);
      } else {
        setError(result.error || 'Failed to fetch submissions');
      }
    } catch (err) {
      setError('Failed to fetch submissions');
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSubmission = async (id: string | undefined, updates: Partial<SellCarSubmission>) => {
    if (!id) return;
    try {
      const result = await sellCarAPI.updateSubmission(id, {
        status: updates.status,
        adminNotes: updates.adminNotes,
        estimatedPrice: updates.estimatedPrice
      });

      if (result.success) {
        fetchSubmissions();
        setSelectedSubmission(null);
        setAdminNotes('');
        setEstimatedPrice('');
      } else {
        alert(result.error || 'Failed to update submission');
      }
    } catch (err) {
      alert('Failed to update submission');
      console.error('Error updating submission:', err);
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) {
      return;
    }

    try {
      const result = await sellCarAPI.deleteSubmission(id);
      
      if (result.success) {
        fetchSubmissions();
      } else {
        alert(result.error || 'Failed to delete submission');
      }
    } catch (err) {
      alert('Failed to delete submission');
      console.error('Error deleting submission:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'contacted': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sell Car Submissions</h1>
              <p className="text-gray-600 mt-1">Manage customer car selling requests</p>
            </div>
            <button
              onClick={() => onNavigate(ViewEnum.HOME)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Search by registration, make, model, or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Submissions Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Car Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {submissions.map((submission) => (
                  <tr key={submission._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {submission.registration}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {submission.year} {submission.make} {submission.model}
                      </div>
                      <div className="text-sm text-gray-500">
                        {submission.variant} • {submission.fuelType} • {submission.transmission}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {submission.customerContact}
                      </div>
                      <div className="text-sm text-gray-500">
                        {submission.district}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(submission.submittedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedSubmission(submission)}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => submission._id && deleteSubmission(submission._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{currentPage}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Submission Details
                </h3>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Registration Number</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.registration}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Make & Model</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.make} {selectedSubmission.model}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Variant</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.variant}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.year}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">District</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.district}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Number of Owners</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.noOfOwners}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kilometers</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.kilometers}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fuel Type</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.fuelType}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Transmission</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.transmission}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer Contact</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedSubmission.customerContact}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedSubmission.status)}`}>
                    {selectedSubmission.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Submitted At</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(selectedSubmission.submittedAt)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="contacted">Contacted</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this submission..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Price (₹)</label>
                  <input
                    type="number"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value)}
                    placeholder="Enter estimated price..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateSubmission(selectedSubmission._id, {
                    status: newStatus,
                    adminNotes,
                    estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : undefined
                  })}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Update Submission
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellCarAdmin;

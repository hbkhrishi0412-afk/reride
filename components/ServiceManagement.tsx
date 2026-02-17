import React, { useState, useEffect } from 'react';
import { getAuthHeaders as getSharedAuthHeaders } from '../utils/authenticatedFetch';

interface Service {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  base_price: number;
  min_price: number;
  max_price: number;
  price_range?: string;
  icon_name?: string;
  active: boolean;
  display_order: number;
  metadata?: Record<string, unknown>;
}

const ServiceManagement: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const headers = getSharedAuthHeaders() as Record<string, string>;
    return headers;
  };

  const hasAuthorizationHeader = (headers: Record<string, string>): boolean => {
    return typeof headers.Authorization === 'string' && headers.Authorization.trim().length > 0;
  };

  const loadServices = async () => {
    setLoading(true);
    setError(null);
    try {
      // GET requests are public, but include auth header if available
      const headers = getAuthHeaders();

      const response = await fetch('/api/services', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to load services: ${response.statusText}`;
        
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('Admin access required. Please log in with an admin account.');
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setServices(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load services';
      if (errorMessage.includes('Admin access required') || errorMessage.includes('403')) {
        setError('Admin access required. Please log in with an admin account.');
      } else if (errorMessage.includes('Session expired') || errorMessage.includes('401')) {
        setError('Session expired. Please log in again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleEdit = (service: Service) => {
    setEditingService({ ...service });
  };

  const handleSave = async () => {
    if (!editingService) return;

    setSaving(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      if (!hasAuthorizationHeader(headers)) {
        setError('Authentication required. Please log in again to save changes.');
        return;
      }

      const response = await fetch('/api/services', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(editingService),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to update service: ${response.statusText}`;
        
        // Provide more helpful error messages for common issues
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('Admin access required. Please log in with an admin account.');
        }
        
        throw new Error(errorMessage);
      }

      await loadServices();
      setEditingService(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save service';
      if (errorMessage.includes('Admin access required') || errorMessage.includes('403')) {
        setError('Unable to save changes. Admin access is required.');
      } else if (errorMessage.includes('Session expired') || errorMessage.includes('401')) {
        setError('Session expired. Please log in again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingService(null);
    setError(null);
  };

  const handleToggleActive = async (service: Service) => {
    setSaving(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      if (!hasAuthorizationHeader(headers)) {
        setError('Authentication required. Please log in again to update service status.');
        return;
      }

      const response = await fetch('/api/services', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: service.id,
          active: !service.active,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to update service: ${response.statusText}`;
        
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('Admin access required. Please log in with an admin account.');
        }
        
        throw new Error(errorMessage);
      }

      await loadServices();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update service';
      if (errorMessage.includes('Admin access required') || errorMessage.includes('403')) {
        setError('Unable to update service. Admin access is required.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">Loading services...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Management</h2>
          <p className="text-sm text-gray-600 mt-1">Manage service pricing and availability</p>
        </div>
        <button
          onClick={loadServices}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {/* Edit Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Service: {editingService.display_name}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={editingService.display_name}
                  onChange={(e) => setEditingService({ ...editingService, display_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingService.description || ''}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Base Price (₹)</label>
                  <input
                    type="number"
                    value={editingService.base_price}
                    onChange={(e) => setEditingService({ ...editingService, base_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Min Price (₹)</label>
                  <input
                    type="number"
                    value={editingService.min_price}
                    onChange={(e) => setEditingService({ ...editingService, min_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Max Price (₹)</label>
                  <input
                    type="number"
                    value={editingService.max_price}
                    onChange={(e) => setEditingService({ ...editingService, max_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Price Range (Display)</label>
                <input
                  type="text"
                  value={editingService.price_range || ''}
                  onChange={(e) => setEditingService({ ...editingService, price_range: e.target.value })}
                  placeholder="e.g., ₹2,499 - ₹4,999"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingService.active}
                  onChange={(e) => setEditingService({ ...editingService, active: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <label className="text-sm font-semibold text-gray-700">Active</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Services Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Base Price</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Price Range</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No services found. Please run the SQL script to create default services.
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{service.display_name}</div>
                        {service.description && (
                          <div className="text-xs text-gray-500 mt-1">{service.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₹{service.base_price.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{service.price_range || `₹${service.min_price.toLocaleString()} - ₹${service.max_price.toLocaleString()}`}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(service)}
                        disabled={saving}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          service.active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {service.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(service)}
                        className="px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ServiceManagement;


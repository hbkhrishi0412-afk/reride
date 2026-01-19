import React, { useEffect, useMemo, useState } from 'react';
import { getAuth } from 'firebase/auth';
import '../lib/firebase';

interface Provider {
  name: string;
  email: string;
  phone: string;
  city: string;
  workshops?: string[];
  skills?: string[];
  availability?: string;
}

type RequestStatus = 'pending' | 'in_progress' | 'completed';

interface ServiceRequest {
  id: string;
  title: string;
  serviceType?: string;
  customerName?: string;
  customerPhone?: string;
  vehicle?: string;
  city?: string;
  status: RequestStatus;
  scheduledAt?: string;
  notes?: string;
}

interface CarServiceDashboardProps {
  provider: Provider | null;
}

const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const CarServiceDashboard: React.FC<CarServiceDashboardProps> = ({ provider }) => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    serviceType: 'General',
    customerName: '',
    customerPhone: '',
    vehicle: '',
    city: '',
    scheduledAt: '',
    notes: '',
  });

  const auth = getAuth();

  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) => {
        const order = ['pending', 'in_progress', 'completed'] as RequestStatus[];
        return order.indexOf(a.status) - order.indexOf(b.status);
      }),
    [requests]
  );

  const withToken = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  };

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load requests');
      }
      const data = await resp.json();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      if (!form.title.trim()) {
        setError('Title is required');
        setCreating(false);
        return;
      }
      const token = await withToken();
      const resp = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create request');
      }
      const newReq = await resp.json();
      setRequests(prev => [newReq, ...prev]);
      setForm({
        title: '',
        serviceType: 'General',
        customerName: '',
        customerPhone: '',
        vehicle: '',
        city: '',
        scheduledAt: '',
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, status: RequestStatus) => {
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-requests', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update status');
      }
      const updated = await resp.json();
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  useEffect(() => {
    if (provider) {
      fetchRequests();
    }
  }, [provider]);

  if (!provider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
          <p className="text-gray-700 font-semibold">No provider data. Please log in again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Service Dashboard</h1>
            <p className="text-sm text-gray-600">{provider.city}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900">{provider.name}</p>
            <p className="text-sm text-gray-600">{provider.email}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Availability</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{provider.availability || 'Not set'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Skills</p>
            <p className="text-sm text-gray-800 mt-1">
              {provider.skills?.length ? provider.skills.join(', ') : 'Not set'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Workshops</p>
            <p className="text-sm text-gray-800 mt-1">
              {provider.workshops?.length ? provider.workshops.join(', ') : 'Not set'}
            </p>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Service Requests</h2>
              <p className="text-sm text-gray-600">Create and manage incoming jobs.</p>
            </div>
          </div>
          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4" onSubmit={createRequest}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Service Type</label>
              <input
                type="text"
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Phone</label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicle</label>
              <input
                type="text"
                value={form.vehicle}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Scheduled At</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create Request'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-gray-600">Loading requests...</div>
            ) : sortedRequests.length === 0 ? (
              <div className="text-sm text-gray-600">No requests yet.</div>
            ) : (
              sortedRequests.map((req) => (
                <div key={req.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{req.title}</p>
                      <p className="text-sm text-gray-600">
                        {req.serviceType} {req.vehicle ? `• ${req.vehicle}` : ''} {req.city ? `• ${req.city}` : ''}
                      </p>
                      <p className="text-sm text-gray-600">
                        {req.customerName && `${req.customerName}`} {req.customerPhone && `• ${req.customerPhone}`}
                      </p>
                      {req.scheduledAt && (
                        <p className="text-xs text-gray-500">Scheduled: {req.scheduledAt}</p>
                      )}
                      {req.notes && <p className="text-xs text-gray-500 mt-1">Notes: {req.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={req.status}
                        onChange={(e) => updateStatus(req.id, e.target.value as RequestStatus)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default CarServiceDashboard;


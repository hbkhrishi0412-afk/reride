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

type RequestStatus = 'open' | 'accepted' | 'in_progress' | 'completed';

interface ServiceRequest {
  id: string;
  providerId?: string | null;
  title: string;
  serviceType?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicle?: string;
  city?: string;
  addressLine?: string;
  pincode?: string;
  status: RequestStatus;
  scheduledAt?: string;
  notes?: string;
  carDetails?: string;
  createdAt?: string;
  updatedAt?: string;
  claimedAt?: string;
}

interface CarServiceDashboardProps {
  provider: Provider | null;
}

const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const serviceOptions = [
  'General',
  'Periodic Service',
  'Engine & Transmission',
  'AC & Cooling',
  'Electrical & Battery',
  'Brakes & Suspension',
  'Body Work & Paint',
  'Tyres & Alignment',
  'Detailing & Cleaning',
];

const CarServiceDashboard: React.FC<CarServiceDashboardProps> = ({ provider }) => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [openRequests, setOpenRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [openLoading, setOpenLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [openFilters, setOpenFilters] = useState({
    city: provider?.city || '',
    serviceType: 'all',
  });
  const [providerServices, setProviderServices] = useState<
    Array<{ serviceType: string; price?: number; description?: string; etaMinutes?: number; active?: boolean }>
  >([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    serviceType: serviceOptions[0],
    price: '',
    description: '',
    etaMinutes: '',
    active: true,
  });
  const [editingSkills, setEditingSkills] = useState(false);
  const [editingWorkshops, setEditingWorkshops] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [workshopsInput, setWorkshopsInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [localProvider, setLocalProvider] = useState<Provider | null>(provider);

  const auth = getAuth();

  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) => {
        const order = ['accepted', 'in_progress', 'completed'] as RequestStatus[];
        const aIndex = order.indexOf(a.status);
        const bIndex = order.indexOf(b.status);
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      }),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return sortedRequests;
    return sortedRequests.filter((req) => req.status === statusFilter);
  }, [sortedRequests, statusFilter]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      open: openRequests.length,
      accepted: requests.filter((r) => r.status === 'accepted').length,
      inProgress: requests.filter((r) => r.status === 'in_progress').length,
      completed: requests.filter((r) => r.status === 'completed').length,
    }),
    [requests, openRequests]
  );

  const formatDateTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const statusBadge = (status: RequestStatus) => {
    const base = 'px-2 py-1 rounded-full text-xs font-semibold';
    if (status === 'open') return `${base} bg-amber-100 text-amber-800 border border-amber-200`;
    if (status === 'accepted') return `${base} bg-blue-100 text-blue-800 border border-blue-200`;
    if (status === 'in_progress') return `${base} bg-indigo-100 text-indigo-800 border border-indigo-200`;
    return `${base} bg-emerald-100 text-emerald-800 border border-emerald-200`;
  };

  const getAuthHeaders = async () => {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
    if (process.env.NODE_ENV === 'development') {
      return { 'x-mock-provider-id': provider?.email || provider?.name || 'dev-mock-provider' };
    }
    throw new Error('Not authenticated');
  };

  // Dummy data helpers for quick UI checks (dev only)
  const buildSampleRequests = (assigned: boolean): ServiceRequest[] => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 16);
    const baseCity = provider?.city || 'Mock City';
    return [
      {
        id: `sample-${Date.now()}-1`,
        title: 'Oil change & filter',
        serviceType: 'General',
        customerName: 'Demo User',
        customerPhone: '9999999999',
        vehicle: 'Honda City',
        city: baseCity,
        status: assigned ? 'accepted' : 'open',
        scheduledAt: fmt(now),
        notes: 'Please pick up from doorstep',
        providerId: assigned ? provider?.name || 'demo-provider' : null,
      },
      {
        id: `sample-${Date.now()}-2`,
        title: 'Brake inspection',
        serviceType: 'Brakes & Suspension',
        customerName: 'Alex Rider',
        customerPhone: '8888888888',
        vehicle: 'Hyundai i20',
        city: baseCity,
        status: assigned ? 'in_progress' : 'open',
        scheduledAt: fmt(new Date(now.getTime() + 3600 * 1000)),
        notes: 'Has minor squeak',
        providerId: assigned ? provider?.name || 'demo-provider' : null,
      },
    ];
  };

  const loadSampleOpenRequests = () => {
    setOpenRequests(buildSampleRequests(false));
  };

  const loadSampleMyRequests = () => {
    setRequests(buildSampleRequests(true));
  };

  const fetchProviderServices = async () => {
    setServicesLoading(true);
    setServicesError(null);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch('/api/provider-services?scope=mine', { headers });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load services');
      }
      const data = await resp.json();
      setProviderServices(data);
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setServicesLoading(false);
    }
  };

  const upsertService = async () => {
    setSavingService(true);
    setServicesError(null);
    try {
      const headers = await getAuthHeaders();
      const body = {
        serviceType: serviceForm.serviceType,
        price: serviceForm.price ? Number(serviceForm.price) : undefined,
        description: serviceForm.description,
        etaMinutes: serviceForm.etaMinutes ? Number(serviceForm.etaMinutes) : undefined,
        active: serviceForm.active,
      };
      const resp = await fetch('/api/provider-services', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save service');
      }
      const data = await resp.json();
      setProviderServices(data);
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Failed to save service');
    } finally {
      setSavingService(false);
    }
  };

  const toggleServiceActive = async (serviceType: string, active: boolean) => {
    setSavingService(true);
    setServicesError(null);
    try {
      const headers = await getAuthHeaders();
      const body = { serviceType, active };
      const resp = await fetch('/api/provider-services', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update service');
      }
      const data = await resp.json();
      setProviderServices(data);
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Failed to update service');
    } finally {
      setSavingService(false);
    }
  };

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

  const fetchOpenRequests = async () => {
    setOpenLoading(true);
    try {
      const token = await withToken();
      const params = new URLSearchParams();
      params.set('scope', 'open');
      if (openFilters.city.trim()) params.set('city', openFilters.city.trim());
      if (openFilters.serviceType !== 'all') params.set('serviceType', openFilters.serviceType);
      const resp = await fetch(`/api/service-requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load open requests');
      }
      const data = await resp.json();
      setOpenRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load open requests');
    } finally {
      setOpenLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchRequests();
    fetchOpenRequests();
  };

  const claimRequest = async (id: string) => {
    setClaimingId(id);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-requests', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'claim' }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to claim request');
      }
      const updated = await resp.json();
      setRequests((prev) => [updated, ...prev]);
      setOpenRequests((prev) => prev.filter((req) => req.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim request');
    } finally {
      setClaimingId(null);
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
      setLocalProvider(provider);
      setSkillsInput(provider.skills?.join(', ') || '');
      setWorkshopsInput(provider.workshops?.join(', ') || '');
      fetchRequests();
      fetchOpenRequests();
      fetchProviderServices();
    }
  }, [provider]);

  const saveSkills = async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const skillsArray = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
      const token = await withToken();
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: skillsArray }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update skills');
      }
      const updated = await resp.json();
      setLocalProvider({ ...localProvider, skills: skillsArray });
      setEditingSkills(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skills');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveWorkshops = async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const workshopsArray = workshopsInput.split(',').map(w => w.trim()).filter(Boolean);
      const token = await withToken();
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshops: workshopsArray }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update workshops');
      }
      const updated = await resp.json();
      setLocalProvider({ ...localProvider, workshops: workshopsArray });
      setEditingWorkshops(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workshops');
    } finally {
      setSavingProfile(false);
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Service Dashboard</h1>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {provider.city}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="font-semibold text-gray-900">{provider.name}</p>
                <p className="text-sm text-gray-600">{provider.email}</p>
                {provider.phone && (
                  <p className="text-sm text-gray-500 flex items-center justify-end gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {provider.phone}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || openLoading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-60 shadow-md transition-all flex items-center gap-2"
              >
                <svg className={`w-4 h-4 ${loading || openLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading || openLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Profile Overview Section */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profile Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-700">Availability</p>
              </div>
              <p className="text-xl font-bold text-gray-900 mb-1">{provider.availability || 'Not set'}</p>
              <p className="text-xs text-gray-500">Preferred working days/hours</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Skills</p>
                </div>
                {!editingSkills && (
                  <button
                    type="button"
                    onClick={() => setEditingSkills(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
            {editingSkills ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="Comma-separated skills"
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveSkills}
                    disabled={savingProfile}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingProfile ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSkills(false);
                      setSkillsInput(localProvider?.skills?.join(', ') || '');
                    }}
                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-800 mt-1">
                  {localProvider?.skills?.length ? localProvider.skills.join(', ') : 'Not set'}
                </p>
                <p className="text-xs text-gray-500 mt-1">What you can service</p>
              </>
            )}
          </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Workshops</p>
                </div>
                {!editingWorkshops && (
                  <button
                    type="button"
                    onClick={() => setEditingWorkshops(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
            {editingWorkshops ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={workshopsInput}
                  onChange={(e) => setWorkshopsInput(e.target.value)}
                  placeholder="Comma-separated locations"
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveWorkshops}
                    disabled={savingProfile}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingProfile ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkshops(false);
                      setWorkshopsInput(localProvider?.workshops?.join(', ') || '');
                    }}
                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-800 mt-1">
                  {localProvider?.workshops?.length ? localProvider.workshops.join(', ') : 'Not set'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Locations you operate</p>
              </>
            )}
          </div>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">My Requests</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Open (pool)</p>
            <p className="text-2xl font-bold text-amber-700">{stats.open}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Accepted</p>
            <p className="text-2xl font-bold text-blue-700">{stats.accepted}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.completed}</p>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">My Services & Pricing</h2>
              <p className="text-sm text-gray-600">Control which services you offer and their price.</p>
            </div>
          </div>
          {servicesError && <div className="mb-3 text-sm text-red-600">{servicesError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Service</label>
              <select
                value={serviceForm.serviceType}
                onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Price (₹)</label>
              <input
                type="number"
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 1999"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ETA (minutes)</label>
              <input
                type="number"
                value={serviceForm.etaMinutes}
                onChange={(e) => setServiceForm({ ...serviceForm, etaMinutes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 120"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={serviceForm.active}
                  onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
                  className="h-4 w-4"
                />
                Active
              </label>
            </div>
            <div className="md:col-span-4 flex flex-col gap-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional details or inclusions"
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button
                type="button"
                onClick={upsertService}
                disabled={savingService}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 shadow"
              >
                {savingService ? 'Saving...' : 'Save Service'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="text-gray-600">
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">ETA</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Active</th>
                </tr>
              </thead>
              <tbody>
                {servicesLoading ? (
                  <tr>
                    <td className="py-3 text-gray-600" colSpan={5}>
                      Loading services...
                    </td>
                  </tr>
                ) : providerServices.length === 0 ? (
                  <tr>
                    <td className="py-3 text-gray-600" colSpan={5}>
                      No services added yet.
                    </td>
                  </tr>
                ) : (
                  providerServices.map((svc) => (
                    <tr key={svc.serviceType} className="border-t border-gray-100">
                      <td className="py-2 pr-4 font-semibold text-gray-900">{svc.serviceType}</td>
                      <td className="py-2 pr-4 text-gray-800">{svc.price !== undefined ? `₹${svc.price}` : '-'}</td>
                      <td className="py-2 pr-4 text-gray-800">{svc.etaMinutes ? `${svc.etaMinutes} min` : '-'}</td>
                      <td className="py-2 pr-4 text-gray-700">{svc.description || '-'}</td>
                      <td className="py-2 pr-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={svc.active !== false}
                            onChange={(e) => toggleServiceActive(svc.serviceType, e.target.checked)}
                            className="h-4 w-4"
                          />
                          {svc.active !== false ? 'Active' : 'Inactive'}
                        </label>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Open Requests (claimable)</h2>
              <p className="text-sm text-gray-600">Pool of new jobs you can accept.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={openFilters.city}
                onChange={(e) => setOpenFilters((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Filter by city"
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={openFilters.serviceType}
                onChange={(e) => setOpenFilters((prev) => ({ ...prev, serviceType: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All services</option>
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchOpenRequests}
                className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900"
              >
                Apply
              </button>
            </div>
          </div>
          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
          <div className="space-y-3">
            {openLoading ? (
              <div className="text-sm text-gray-600">Loading open requests...</div>
            ) : openRequests.length === 0 ? (
              <div className="text-sm text-gray-600 flex items-center justify-between">
                <span>No open requests right now.</span>
                <button
                  type="button"
                  onClick={loadSampleOpenRequests}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  Add dummy open requests
                </button>
              </div>
            ) : (
              openRequests.map((req) => (
                <div key={req.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-gray-900">{req.title}</p>
                        <span className={statusBadge(req.status)}>
                          {statusOptions.find((s) => s.value === req.status)?.label || req.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 flex flex-wrap gap-2 items-center">
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
                          {req.serviceType || 'General'}
                        </span>
                        {req.vehicle && <span className="text-sm text-gray-600">• {req.vehicle}</span>}
                        {req.city && <span className="text-sm text-gray-600">• {req.city}</span>}
                      </p>
                      <p className="text-sm text-gray-600">
                        {req.customerName && `${req.customerName}`}
                        {req.customerPhone && ` • ${req.customerPhone}`}
                        {req.customerEmail && ` • ${req.customerEmail}`}
                      </p>
                      {req.addressLine && (
                        <p className="text-xs text-gray-500">{req.addressLine}{req.pincode ? `, ${req.pincode}` : ''}</p>
                      )}
                      {req.carDetails && <p className="text-xs text-gray-500">Vehicle: {req.carDetails}</p>}
                      {req.scheduledAt && (
                        <p className="text-xs text-gray-500">Scheduled: {formatDateTime(req.scheduledAt)}</p>
                      )}
                      {req.notes && <p className="text-xs text-gray-500 mt-1">Notes: {req.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => claimRequest(req.id)}
                        disabled={claimingId === req.id}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                      >
                        {claimingId === req.id ? 'Claiming...' : 'Claim'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">My Requests</h2>
              <p className="text-sm text-gray-600">Manage jobs you have claimed.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'accepted', 'in_progress', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-sm border transition ${
                    statusFilter === status
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {status === 'all'
                    ? 'All'
                    : status === 'in_progress'
                    ? 'In Progress'
                    : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-gray-600">Loading requests...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-sm text-gray-600 flex items-center justify-between">
                <span>No requests yet.</span>
                <button
                  type="button"
                  onClick={loadSampleMyRequests}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  Add dummy my requests
                </button>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div key={req.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-gray-900">{req.title}</p>
                        <span className={statusBadge(req.status)}>
                          {statusOptions.find((s) => s.value === req.status)?.label || req.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 flex flex-wrap gap-2 items-center">
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
                          {req.serviceType || 'General'}
                        </span>
                        {req.vehicle && <span className="text-sm text-gray-600">• {req.vehicle}</span>}
                        {req.city && <span className="text-sm text-gray-600">• {req.city}</span>}
                      </p>
                      <p className="text-sm text-gray-600">
                        {req.customerName && `${req.customerName}`} {req.customerPhone && `• ${req.customerPhone}`}
                      </p>
                      {req.scheduledAt && (
                        <p className="text-xs text-gray-500">Scheduled: {formatDateTime(req.scheduledAt)}</p>
                      )}
                      {req.notes && <p className="text-xs text-gray-500 mt-1">Notes: {req.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={req.status}
                        onChange={(e) => updateStatus(req.id, e.target.value as RequestStatus)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {statusOptions
                          .filter((opt) => opt.value !== 'open')
                          .map((opt) => (
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


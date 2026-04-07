import React, { useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '../utils/authenticatedFetch';

type Provider = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state?: string;
  district?: string;
  availability?: string;
  skills?: string[];
  workshops?: string[];
  serviceCategories?: string[];
};

type ProviderService = {
  providerId: string;
  serviceType: string;
  price?: number;
  etaMinutes?: number;
  description?: string;
  active?: boolean;
};

type ServiceRequest = {
  id: string;
  providerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  claimedAt?: string;
  startedAt?: string;
  completedAt?: string;
  candidateProviderIds?: string[];
  title: string;
  serviceType?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicle?: string;
  city?: string;
  addressLine?: string;
  pincode?: string;
  status: string;
  scheduledAt?: string;
  notes?: string;
  carDetails?: string;
};

const statusColors: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800 border border-amber-200',
  accepted: 'bg-blue-100 text-blue-800 border border-blue-200',
  in_progress: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  completed: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-700 border border-gray-200',
};

const TRACKING_STEPS = [
  { key: 'raised', label: 'Raised' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
] as const;

const STEP_TO_STATUS: Partial<Record<(typeof TRACKING_STEPS)[number]['key'], ServiceRequest['status']>> = {
  accepted: 'accepted',
  in_progress: 'in_progress',
  completed: 'completed',
};

const getStepState = (status: string, stepKey: (typeof TRACKING_STEPS)[number]['key']) => {
  if (status === 'cancelled') {
    return stepKey === 'raised' ? 'done' : 'cancelled';
  }
  switch (stepKey) {
    case 'raised':
      return 'done';
    case 'accepted':
      return status === 'accepted' || status === 'in_progress' || status === 'completed' ? 'done' : 'pending';
    case 'in_progress':
      return status === 'in_progress' || status === 'completed' ? 'done' : 'pending';
    case 'completed':
      return status === 'completed' ? 'done' : 'pending';
    default:
      return 'pending';
  }
};

const AdminServiceOps: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'services' | 'providers'>('requests');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [requestPage, setRequestPage] = useState(1);
  const [servicesPage, setServicesPage] = useState(1);
  const [providersPage, setProvidersPage] = useState(1);
  const itemsPerPage = 10;

  const [filters, setFilters] = useState({
    status: 'all',
    serviceType: 'all',
    city: '',
    providerId: 'all',
  });
  const [serviceSearch, setServiceSearch] = useState('');
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pResp, sResp, rResp] = await Promise.all([
        authenticatedFetch('/api/service-providers?scope=all'),
        authenticatedFetch('/api/provider-services?scope=public'),
        authenticatedFetch('/api/service-requests?scope=all'),
      ]);
      if (!pResp.ok || !sResp.ok || !rResp.ok) {
        throw new Error('Failed to load admin service operations data');
      }
      const [p, s, r] = await Promise.all([pResp.json(), sResp.json(), rResp.json()]);
      setProviders(Array.isArray(p) ? p : []);
      setServices(Array.isArray(s) ? s : []);
      setRequests(Array.isArray(r) ? r : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Listen for service updates from provider dashboard
    const handleServiceUpdate = () => {
      loadData();
    };
    
    // Listen for profile updates from provider dashboard
    const handleProfileUpdate = () => {
      loadData();
    };
    
    // Listen for custom events
    window.addEventListener('serviceProviderServicesUpdated', handleServiceUpdate);
    window.addEventListener('serviceProviderProfileUpdated', handleProfileUpdate);
    
    // Listen for storage events (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'serviceProviderServicesLastUpdate' || e.key === 'serviceProviderProfileLastUpdate') {
        loadData();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also poll periodically to catch updates from other sources
    const pollInterval = setInterval(() => {
      if (activeTab === 'services' || activeTab === 'providers' || activeTab === 'requests') {
        loadData();
      }
    }, 15000); // Poll every 15 seconds for near real-time visibility
    
    return () => {
      window.removeEventListener('serviceProviderServicesUpdated', handleServiceUpdate);
      window.removeEventListener('serviceProviderProfileUpdated', handleProfileUpdate);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [activeTab]);

  const providerMap = useMemo(
    () =>
      providers.reduce<Record<string, Provider>>((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {}),
    [providers]
  );

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const statusOk = filters.status === 'all' || r.status === filters.status;
      const serviceOk = filters.serviceType === 'all' || r.serviceType === filters.serviceType;
      const cityOk = filters.city ? (r.city || '').toLowerCase() === filters.city.toLowerCase() : true;
      const providerOk =
        filters.providerId === 'all' ||
        r.providerId === filters.providerId ||
        (r.candidateProviderIds || []).includes(filters.providerId);
      return statusOk && serviceOk && cityOk && providerOk;
    });
  }, [filters, requests]);

  const paginated = <T,>(data: T[], page: number) => {
    const start = (page - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  };

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesProvider = filters.providerId === 'all' || s.providerId === filters.providerId;
      const matchesSearch = serviceSearch
        ? s.serviceType.toLowerCase().includes(serviceSearch.toLowerCase())
        : true;
      return matchesProvider && matchesSearch;
    });
  }, [services, filters.providerId, serviceSearch]);

  const pagedRequests = useMemo(() => paginated(filteredRequests, requestPage), [filteredRequests, requestPage]);
  const pagedServices = useMemo(() => paginated(filteredServices, servicesPage), [filteredServices, servicesPage]);
  const pagedProviders = useMemo(() => paginated(providers, providersPage), [providers, providersPage]);

  const statusChips: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const renderRequests = () => (
    <section className="bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {statusChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => {
                setFilters((prev) => ({ ...prev, status: chip.key }));
                setRequestPage(1);
              }}
              className={`px-3 py-1 rounded-full text-sm border ${
                filters.status === chip.key
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <input
          value={filters.city}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, city: e.target.value }));
            setRequestPage(1);
          }}
          placeholder="City"
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <select
          value={filters.providerId}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, providerId: e.target.value }));
            setRequestPage(1);
          }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-600 border-b">
              <th className="py-2 pr-4 text-left">Title</th>
              <th className="py-2 pr-4 text-left">Service</th>
              <th className="py-2 pr-4 text-left">Location</th>
              <th className="py-2 pr-4 text-left">Provider(s)</th>
              <th className="py-2 pr-4 text-left">Status</th>
              <th className="py-2 pr-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedRequests.map((r) => {
              const expanded = expandedRequestId === r.id;
              return (
                <React.Fragment key={r.id}>
                  <tr
                    className="border-b last:border-none hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedRequestId(expanded ? null : r.id)}
                  >
                    <td className="py-2 pr-4 font-semibold text-gray-900">{r.title}</td>
                    <td className="py-2 pr-4 text-gray-800">{r.serviceType || '-'}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      <div>{r.city || '-'}</div>
                      {r.scheduledAt && <div className="text-xs text-gray-500">Sched: {r.scheduledAt}</div>}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      <div className="space-y-1">
                        {r.providerId && (
                          <div className="text-xs text-blue-700">
                            Assigned: {providerMap[r.providerId]?.name || r.providerId}
                          </div>
                        )}
                        {r.candidateProviderIds && r.candidateProviderIds.length > 0 && (
                          <div className="text-xs text-gray-600">
                            Pool:{' '}
                            {r.candidateProviderIds.map((id) => providerMap[id]?.name || id).join(', ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          statusColors[r.status] || 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        {(['accepted', 'in_progress', 'completed', 'cancelled'] as const).map((next) => (
                          <button
                            key={next}
                            type="button"
                            disabled={updatingRequestId === r.id || r.status === next}
                            onClick={async () => {
                              try {
                                setUpdatingRequestId(r.id);
                                setStatusNotice(null);
                                const resp = await authenticatedFetch('/api/service-requests', {
                                  method: 'PATCH',
                                  body: JSON.stringify({ id: r.id, status: next }),
                                });
                                if (!resp.ok) {
                                  const data = await resp.json().catch(() => ({}));
                                  throw new Error(data.error || `Failed to set status ${next}`);
                                }
                                const updated = await resp.json();
                                setRequests((prev) => prev.map((req) => (req.id === r.id ? { ...req, ...updated } : req)));
                                setStatusNotice(`Request ${r.id} updated to ${next.replace('_', ' ')}`);
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Failed to update request status');
                              } finally {
                                setUpdatingRequestId(null);
                              }
                            }}
                            className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
                          >
                            {next.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-gray-50 border-b">
                      <td colSpan={6} className="p-3 text-sm text-gray-700">
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <div className="font-semibold">Customer</div>
                            <div>{r.customerName || '-'}</div>
                            <div className="text-xs text-gray-600">
                              {r.customerPhone || ''} {r.customerEmail ? `• ${r.customerEmail}` : ''}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold">Address</div>
                            <div className="text-xs text-gray-600">
                              {r.addressLine || '-'} {r.pincode ? `, ${r.pincode}` : ''}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold">Notes</div>
                            <div className="text-xs text-gray-700">{r.notes || '-'}</div>
                          </div>
                          <div>
                            <div className="font-semibold">Vehicle</div>
                            <div className="text-xs text-gray-700">{r.carDetails || r.vehicle || '-'}</div>
                          </div>
                          <div>
                            <div className="font-semibold">Progress Timeline</div>
                            <div className="my-2">
                              <div className="flex items-center gap-2">
                                {TRACKING_STEPS.map((step, idx) => {
                                  const state = getStepState(r.status, step.key);
                                  return (
                                    <React.Fragment key={step.key}>
                                      <div className="flex flex-col items-center min-w-[56px]">
                                        <button
                                          type="button"
                                          disabled={!STEP_TO_STATUS[step.key] || updatingRequestId === r.id}
                                          onClick={async () => {
                                            const targetStatus = STEP_TO_STATUS[step.key];
                                            if (!targetStatus) return;
                                            try {
                                              setUpdatingRequestId(r.id);
                                              setStatusNotice(null);
                                              const resp = await authenticatedFetch('/api/service-requests', {
                                                method: 'PATCH',
                                                body: JSON.stringify({ id: r.id, status: targetStatus }),
                                              });
                                              if (!resp.ok) {
                                                const data = await resp.json().catch(() => ({}));
                                                throw new Error(data.error || `Failed to set status ${targetStatus}`);
                                              }
                                              const updated = await resp.json();
                                              setRequests((prev) => prev.map((req) => (req.id === r.id ? { ...req, ...updated } : req)));
                                              setStatusNotice(`Request ${r.id} updated to ${targetStatus.replace('_', ' ')}`);
                                            } catch (e) {
                                              setError(e instanceof Error ? e.message : 'Failed to update request status');
                                            } finally {
                                              setUpdatingRequestId(null);
                                            }
                                          }}
                                          className={`h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-opacity ${
                                            state === 'done'
                                              ? 'bg-emerald-500 text-white'
                                              : state === 'cancelled'
                                                ? 'bg-gray-300 text-gray-600'
                                                : 'bg-gray-200 text-gray-500'
                                          } ${!STEP_TO_STATUS[step.key] ? 'cursor-default' : 'hover:opacity-90'} disabled:opacity-60`}
                                          title={STEP_TO_STATUS[step.key] ? `Set status to ${step.label}` : step.label}
                                        >
                                          {idx + 1}
                                        </button>
                                        <span className="mt-1 text-[10px] text-gray-600 text-center">{step.label}</span>
                                      </div>
                                      {idx < TRACKING_STEPS.length - 1 && (
                                        <div
                                          className={`h-1 flex-1 rounded ${
                                            getStepState(r.status, TRACKING_STEPS[idx + 1].key) === 'done'
                                              ? 'bg-emerald-400'
                                              : r.status === 'cancelled'
                                                ? 'bg-gray-300'
                                                : 'bg-gray-200'
                                          }`}
                                        />
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="text-xs text-gray-700">
                              Raised: {r.createdAt || '-'}
                              <br />
                              Accepted: {r.claimedAt || '-'}
                              <br />
                              In progress: {r.startedAt || '-'}
                              <br />
                              Completed: {r.completedAt || '-'}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {pagedRequests.length === 0 && (
              <tr>
                <td className="py-3 text-gray-600" colSpan={6}>
                  No requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end items-center gap-2 p-3">
        <button
          className="px-3 py-1 border rounded text-sm"
          disabled={requestPage === 1}
          onClick={() => setRequestPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="text-xs text-gray-600">
          Page {requestPage} / {Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage))}
        </span>
        <button
          className="px-3 py-1 border rounded text-sm"
          disabled={requestPage >= Math.ceil(filteredRequests.length / itemsPerPage)}
          onClick={() => setRequestPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
      {statusNotice && <div className="px-3 pb-2 text-xs text-emerald-700">{statusNotice}</div>}
    </section>
  );

  const renderServices = () => (
    <section className="bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex flex-wrap gap-2 items-center">
        <select
          value={filters.providerId}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, providerId: e.target.value }));
            setServicesPage(1);
          }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={serviceSearch}
          onChange={(e) => {
            setServiceSearch(e.target.value);
            setServicesPage(1);
          }}
          placeholder="Search service"
          className="px-3 py-2 border rounded-lg text-sm"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-600 border-b">
              <th className="py-2 pr-4 text-left">Provider</th>
              <th className="py-2 pr-4 text-left">Service</th>
              <th className="py-2 pr-4 text-left">Price</th>
              <th className="py-2 pr-4 text-left">ETA</th>
              <th className="py-2 pr-4 text-left">Active</th>
            </tr>
          </thead>
          <tbody>
            {pagedServices.map((s, idx) => (
              <tr key={`${s.providerId}-${s.serviceType}-${idx}`} className="border-b last:border-none">
                <td className="py-2 pr-4 text-gray-900">{providerMap[s.providerId]?.name || s.providerId}</td>
                <td className="py-2 pr-4 text-gray-800">{s.serviceType}</td>
                <td className="py-2 pr-4 text-gray-800">{s.price !== undefined ? `₹${s.price}` : '-'}</td>
                <td className="py-2 pr-4 text-gray-700">{s.etaMinutes ? `${s.etaMinutes} min` : '-'}</td>
                <td className="py-2 pr-4 text-gray-700">{s.active === false ? 'Inactive' : 'Active'}</td>
              </tr>
            )) || null}
            {pagedServices.length === 0 && (
              <tr>
                <td className="py-3 text-gray-600" colSpan={5}>
                  No services found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end items-center gap-2 p-3">
        <button
          className="px-3 py-1 border rounded text-sm"
          disabled={servicesPage === 1}
          onClick={() => setServicesPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="text-xs text-gray-600">
          Page {servicesPage} / {Math.max(1, Math.ceil(filteredServices.length / itemsPerPage))}
        </span>
        <button
          className="px-3 py-1 border rounded text-sm"
          disabled={servicesPage >= Math.ceil(filteredServices.length / itemsPerPage)}
          onClick={() => setServicesPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );

  const renderProviders = () => (
    <section className="bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-600 border-b">
              <th className="py-2 pr-4 text-left">Name</th>
              <th className="py-2 pr-4 text-left">Location</th>
              <th className="py-2 pr-4 text-left">Contact</th>
              <th className="py-2 pr-4 text-left">Availability</th>
              <th className="py-2 pr-4 text-left">Categories</th>
              <th className="py-2 pr-4 text-left">Skills</th>
              <th className="py-2 pr-4 text-left">Workshops</th>
            </tr>
          </thead>
          <tbody>
            {pagedProviders.map((p) => (
              <tr key={p.id} className="border-b last:border-none">
                <td className="py-2 pr-4 font-semibold text-gray-900">{p.name}</td>
                <td className="py-2 pr-4 text-gray-700">
                  <div>{p.city}</div>
                  {p.state && <div className="text-xs text-gray-600">{p.state}</div>}
                  {p.district && <div className="text-xs text-gray-500">{p.district}</div>}
                </td>
                <td className="py-2 pr-4 text-gray-700">
                  <div>{p.email}</div>
                  <div className="text-xs text-gray-600">{p.phone}</div>
                </td>
                <td className="py-2 pr-4 text-gray-700">{p.availability || '-'}</td>
                <td className="py-2 pr-4 text-gray-700">
                  {p.serviceCategories && p.serviceCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.serviceCategories.map((cat: string, idx: number) => (
                        <span key={idx} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          {cat}
                        </span>
                      ))}
                    </div>
                  ) : '-'}
                </td>
                <td className="py-2 pr-4 text-gray-700">{p.skills?.join(', ') || '-'}</td>
                <td className="py-2 pr-4 text-gray-700">{p.workshops?.join(', ') || '-'}</td>
              </tr>
            ))}
            {pagedProviders.length === 0 && (
              <tr>
                <td className="py-3 text-gray-600" colSpan={7}>
                  No providers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end items-center gap-2 p-3">
        <button
          className="px-3 py-1 border rounded text-sm"
          disabled={providersPage === 1}
          onClick={() => setProvidersPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="text-xs text-gray-600">
          Page {providersPage} / {Math.max(1, Math.ceil(providers.length / itemsPerPage))}
        </span>
        <button
          className="px-3 py-1 border rounded text-sm"
          disabled={providersPage >= Math.ceil(providers.length / itemsPerPage)}
          onClick={() => setProvidersPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Service Operations (Admin)</h1>
          <p className="text-sm text-gray-600">Providers, services, and requests overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 rounded-lg text-sm border bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <div className="flex gap-2">
            {(['requests', 'services', 'providers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  activeTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {tab === 'requests' ? 'Requests' : tab === 'services' ? 'Services' : 'Providers'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm text-gray-700">Loading...</div>}

      {activeTab === 'requests' && renderRequests()}
      {activeTab === 'services' && renderServices()}
      {activeTab === 'providers' && renderProviders()}
    </div>
  );
};

export default AdminServiceOps;


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

type ServiceRequestMetrics = {
  totals: {
    total: number;
    open: number;
    accepted: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    unassigned: number;
    assigned: number;
  };
  byCity: Record<string, number>;
  byServiceType: Record<string, number>;
  generatedAt: string;
};

const defaultMetricsTotals: ServiceRequestMetrics['totals'] = {
  total: 0,
  open: 0,
  accepted: 0,
  in_progress: 0,
  completed: 0,
  cancelled: 0,
  unassigned: 0,
  assigned: 0,
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const sanitizeRecord = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, count]) => {
    acc[key] = toNumber(count);
    return acc;
  }, {});
};

const sanitizeMetrics = (value: unknown): ServiceRequestMetrics => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const totalsSource =
    source.totals && typeof source.totals === 'object' && !Array.isArray(source.totals)
      ? (source.totals as Record<string, unknown>)
      : {};

  return {
    totals: {
      total: toNumber(totalsSource.total),
      open: toNumber(totalsSource.open),
      accepted: toNumber(totalsSource.accepted),
      in_progress: toNumber(totalsSource.in_progress),
      completed: toNumber(totalsSource.completed),
      cancelled: toNumber(totalsSource.cancelled),
      unassigned: toNumber(totalsSource.unassigned),
      assigned: toNumber(totalsSource.assigned),
    },
    byCity: sanitizeRecord(source.byCity),
    byServiceType: sanitizeRecord(source.byServiceType),
    generatedAt: typeof source.generatedAt === 'string' && source.generatedAt.trim() ? source.generatedAt : '',
  };
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
    unassignedOnly: false,
  });
  const [serviceSearch, setServiceSearch] = useState('');
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ServiceRequestMetrics | null>(null);

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
      const mResp = await authenticatedFetch('/api/service-requests?scope=metrics');
      if (mResp.ok) {
        const m = await mResp.json();
        setMetrics(sanitizeMetrics(m));
      }
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
      const unassignedOk = !filters.unassignedOnly || !r.providerId;
      return statusOk && serviceOk && cityOk && providerOk && unassignedOk;
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

  const activeQuickFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (filters.status !== 'all') parts.push(filters.status.replace('_', ' '));
    if (filters.unassignedOnly) parts.push('unassigned');
    if (filters.providerId !== 'all') parts.push('provider scoped');
    if (parts.length === 0) return '';
    return `Quick filter: ${parts.join(' + ')}`;
  }, [filters.providerId, filters.status, filters.unassignedOnly]);

  const topCities = useMemo(
    () =>
      Object.entries(metrics?.byCity || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [metrics?.byCity],
  );

  const topServices = useMemo(
    () =>
      Object.entries(metrics?.byServiceType || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [metrics?.byServiceType],
  );

  const metricTotals = metrics?.totals ?? defaultMetricsTotals;

  const metricsGeneratedAt = metrics?.generatedAt
    ? new Date(metrics.generatedAt).toLocaleString()
    : '-';

  const [actionDropdownId, setActionDropdownId] = useState<string | null>(null);

  const handleStatusUpdate = async (requestId: string, nextStatus: string) => {
    try {
      setUpdatingRequestId(requestId);
      setStatusNotice(null);
      const resp = await authenticatedFetch('/api/service-requests', {
        method: 'PATCH',
        body: JSON.stringify({ id: requestId, status: nextStatus }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Failed to set status ${nextStatus}`);
      }
      const updated = await resp.json();
      setRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, ...updated } : req)));
      setStatusNotice(`Request updated to ${nextStatus.replace('_', ' ')}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update request status');
    } finally {
      setUpdatingRequestId(null);
      setActionDropdownId(null);
    }
  };

  const renderRequests = () => (
    <section className="bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="sticky top-0 z-10 bg-white border-b px-5 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 flex-wrap">
          {statusChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => {
                setFilters((prev) => ({ ...prev, status: chip.key }));
                setRequestPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filters.status === chip.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <input
          value={filters.city}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, city: e.target.value }));
            setRequestPage(1);
          }}
          placeholder="Filter by city..."
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.unassignedOnly}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, unassignedOnly: e.target.checked }));
              setRequestPage(1);
            }}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Unassigned only
        </label>
        <select
          value={filters.providerId}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, providerId: e.target.value }));
            setRequestPage(1);
          }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        >
          <option value="all">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {activeQuickFilterLabel && (
          <button
            type="button"
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: 'all', providerId: 'all', unassignedOnly: false }));
              setRequestPage(1);
            }}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mobile</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedRequests.map((r) => {
              const expanded = expandedRequestId === r.id;
              const assignedProvider = r.providerId ? providerMap[r.providerId] : null;
              return (
                <React.Fragment key={r.id}>
                  <tr
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => setExpandedRequestId(expanded ? null : r.id)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(r.customerName || r.title || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{r.customerName || r.title}</p>
                          {r.customerEmail && (
                            <p className="text-xs text-gray-500 truncate">{r.customerEmail}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-900">{r.serviceType || '-'}</p>
                      {r.scheduledAt && (
                        <p className="text-xs text-gray-500 mt-0.5">Scheduled: {new Date(r.scheduledAt).toLocaleDateString()}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-900">{r.city || '-'}</p>
                      {r.addressLine && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">{r.addressLine}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-900 font-mono">{r.customerPhone || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      {assignedProvider ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {assignedProvider.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-900">{assignedProvider.name}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          statusColors[r.status] || 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActionDropdownId(actionDropdownId === r.id ? null : r.id)}
                          disabled={updatingRequestId === r.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-colors"
                        >
                          Update
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {actionDropdownId === r.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                            {(['accepted', 'in_progress', 'completed', 'cancelled'] as const).map((next) => (
                              <button
                                key={next}
                                type="button"
                                disabled={r.status === next}
                                onClick={() => handleStatusUpdate(r.id, next)}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                  r.status === next
                                    ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${
                                    next === 'accepted' ? 'bg-blue-400' :
                                    next === 'in_progress' ? 'bg-indigo-400' :
                                    next === 'completed' ? 'bg-emerald-400' :
                                    'bg-gray-400'
                                  }`} />
                                  {next.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
                                  {r.status === next && <span className="ml-auto text-gray-400">(current)</span>}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-gray-50/70">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle</p>
                            <p className="text-sm text-gray-800">{r.carDetails || r.vehicle || '-'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Address</p>
                            <p className="text-sm text-gray-800">{r.addressLine || '-'}{r.pincode ? `, ${r.pincode}` : ''}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</p>
                            <p className="text-sm text-gray-800">{r.notes || '-'}</p>
                          </div>
                          {r.candidateProviderIds && r.candidateProviderIds.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Provider Pool</p>
                              <div className="flex flex-wrap gap-1.5">
                                {r.candidateProviderIds.map((id) => (
                                  <span key={id} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">
                                    {providerMap[id]?.name || id}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="md:col-span-3 pt-2 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Progress Timeline</p>
                            <div className="flex items-center gap-3">
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
                                          await handleStatusUpdate(r.id, targetStatus);
                                        }}
                                        className={`h-7 w-7 rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                                          state === 'done'
                                            ? 'bg-emerald-500 text-white shadow-sm'
                                            : state === 'cancelled'
                                              ? 'bg-gray-300 text-gray-600'
                                              : 'bg-gray-200 text-gray-500'
                                        } ${!STEP_TO_STATUS[step.key] ? 'cursor-default' : 'hover:scale-110'} disabled:opacity-60`}
                                        title={STEP_TO_STATUS[step.key] ? `Set status to ${step.label}` : step.label}
                                      >
                                        {state === 'done' ? (
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        ) : (
                                          idx + 1
                                        )}
                                      </button>
                                      <span className="mt-1.5 text-[10px] font-medium text-gray-600 text-center">{step.label}</span>
                                    </div>
                                    {idx < TRACKING_STEPS.length - 1 && (
                                      <div
                                        className={`h-0.5 flex-1 rounded-full ${
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
                            <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-gray-500">
                              <span>Raised: {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}</span>
                              <span>Accepted: {r.claimedAt ? new Date(r.claimedAt).toLocaleDateString() : '-'}</span>
                              <span>Started: {r.startedAt ? new Date(r.startedAt).toLocaleDateString() : '-'}</span>
                              <span>Completed: {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '-'}</span>
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
                <td className="px-5 py-8 text-center text-sm text-gray-500" colSpan={7}>
                  No requests found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          Showing {pagedRequests.length} of {filteredRequests.length} requests
        </span>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={requestPage === 1}
            onClick={() => setRequestPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-xs text-gray-600 px-2">
            {requestPage} / {Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage))}
          </span>
          <button
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={requestPage >= Math.ceil(filteredRequests.length / itemsPerPage)}
            onClick={() => setRequestPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {statusNotice && (
        <div className="px-5 pb-3">
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{statusNotice}</div>
        </div>
      )}
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
      {metrics && (
        <section className="grid gap-3 md:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('requests');
              setFilters((prev) => ({ ...prev, status: 'all', providerId: 'all', unassignedOnly: false }));
              setRequestPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm text-left hover:border-blue-300 transition-colors"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Requests</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{metricTotals.total}</p>
            <p className="text-xs text-gray-500">Open {metricTotals.open} · Accepted {metricTotals.accepted}</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('requests');
              setFilters((prev) => ({ ...prev, status: 'in_progress', providerId: 'all', unassignedOnly: false }));
              setRequestPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm text-left hover:border-indigo-300 transition-colors"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">Pipeline Health</p>
            <p className="mt-1 text-sm text-gray-700">
              In progress <span className="font-semibold text-indigo-700">{metricTotals.in_progress}</span> · Completed{' '}
              <span className="font-semibold text-emerald-700">{metricTotals.completed}</span>
            </p>
            <p className="text-xs text-gray-500">Cancelled {metricTotals.cancelled}</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('requests');
              setFilters((prev) => ({ ...prev, status: 'open', providerId: 'all', unassignedOnly: true }));
              setRequestPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm text-left hover:border-amber-300 transition-colors"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">Assignment</p>
            <p className="mt-1 text-sm text-gray-700">
              Assigned <span className="font-semibold text-blue-700">{metricTotals.assigned}</span> · Unassigned{' '}
              <span className="font-semibold text-amber-700">{metricTotals.unassigned}</span>
            </p>
            <p className="text-xs text-gray-500">Generated {metricsGeneratedAt}</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('requests');
              setFilters((prev) => ({ ...prev, status: 'open', providerId: 'all', unassignedOnly: false }));
              setRequestPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm text-left hover:border-emerald-300 transition-colors"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">Top Demand</p>
            <p className="mt-1 text-xs text-gray-700">
              Cities: {topCities.length > 0 ? topCities.map(([k, v]) => `${k} (${v})`).join(', ') : '-'}
            </p>
            <p className="text-xs text-gray-700">
              Services: {topServices.length > 0 ? topServices.map(([k, v]) => `${k} (${v})`).join(', ') : '-'}
            </p>
          </button>
        </section>
      )}

      {activeTab === 'requests' && renderRequests()}
      {activeTab === 'services' && renderServices()}
      {activeTab === 'providers' && renderProviders()}
    </div>
  );
};

export default AdminServiceOps;


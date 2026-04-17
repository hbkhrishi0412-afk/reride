import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSession } from '../services/supabase-auth-service';
import { getSupabaseClient } from '../lib/supabase';
import {
  CAR_SERVICE_OPTIONS,
  DEFAULT_SERVICE_TEMPLATE_NAMES,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_MAP,
  SERVICE_TEMPLATE_PRESETS,
  type ServiceCategory,
} from '../constants/serviceProviderCatalog.js';

interface Provider {
  name: string;
  email: string;
  phone: string;
  city: string;
  state?: string;
  district?: string;
  workshops?: string[];
  skills?: string[];
  availability?: string;
  serviceCategories?: ServiceCategory[];
}

type RequestStatus = 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

type ServiceLineItem = { id: string; name: string; quantity?: number; price?: number };
type IncludedServicePrice = { id: string; name: string; price?: number; etaMinutes?: number; active?: boolean };
type ProviderServiceRow = {
  serviceType: string;
  price?: number;
  description?: string;
  etaMinutes?: number;
  active?: boolean;
  updatedAt?: string;
  includedServices?: IncludedServicePrice[];
};

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
  /** Line items from customer cart (when provided by API). */
  services?: ServiceLineItem[];
  total?: number;
  createdAt?: string;
  updatedAt?: string;
  claimedAt?: string;
}

type MatchReason = 'city_match' | 'service_match' | 'new_request';

function ServiceRequestPackages({ services, total }: { services?: ServiceLineItem[]; total?: number }) {
  const lines = (services ?? []).filter(
    (s): s is ServiceLineItem =>
      !!s &&
      typeof s === 'object' &&
      (typeof s.name === 'string' || typeof s.id === 'string'),
  );
  const computedAmount = lines.reduce((sum, line) => {
    const qty = line.quantity != null && line.quantity > 0 ? line.quantity : 1;
    const unitPrice =
      line.price != null && Number.isFinite(line.price) && line.price > 0 ? line.price : 0;
    return sum + unitPrice * qty;
  }, 0);
  const finalAmount = computedAmount > 0 ? computedAmount : total && total > 0 ? total : null;

  if (lines.length === 0) return null;
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-2">Packages</p>
      <ul className="space-y-1.5">
        {lines.map((line) => {
          const label = line.name?.trim() || line.id;
          const qty = line.quantity != null && line.quantity > 0 ? line.quantity : 1;
          const price =
            line.price != null && Number.isFinite(line.price) && line.price > 0 ? line.price : null;
          return (
            <li
              key={`${line.id}-${label}`}
              className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-sm text-gray-800"
            >
              <span className="font-medium text-gray-900">{label}</span>
              <span className="text-gray-600 tabular-nums shrink-0">
                ×{qty}
                {price != null ? ` · ₹${price.toLocaleString('en-IN')}` : ''}
                {price != null ? ` = ₹${(price * qty).toLocaleString('en-IN')}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 border-t border-indigo-200 pt-2 text-right">
        <span className="text-xs font-semibold text-indigo-700">
          Amount: {finalAmount != null ? `₹${finalAmount.toLocaleString('en-IN')}` : 'Pending quote'}
        </span>
      </div>
    </div>
  );
}

interface CarServiceDashboardProps {
  provider: Provider | null;
}

const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const serviceOptions = CAR_SERVICE_OPTIONS;

const parseIncludedServicesText = (raw: string): IncludedServicePrice[] => {
  const result: IncludedServicePrice[] = [];
  raw.split('\n').forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const [nameRaw, priceRaw, etaRaw] = trimmed.split('|').map((part) => part.trim());
    const name = nameRaw || '';
    if (!name) return;
    const price = priceRaw ? Number(priceRaw) : undefined;
    const etaMinutes = etaRaw ? Number(etaRaw) : undefined;
    const entry: IncludedServicePrice = {
      id: `inc-${idx + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      name,
      active: true,
    };
    if (price != null && Number.isFinite(price)) entry.price = price;
    if (etaMinutes != null && Number.isFinite(etaMinutes)) entry.etaMinutes = etaMinutes;
    result.push(entry);
  });
  return result;
};

const formatIncludedServicesText = (items?: IncludedServicePrice[]): string =>
  (items || [])
    .filter((item) => item.active !== false)
    .map((item) => [item.name, item.price != null ? String(item.price) : '', item.etaMinutes != null ? String(item.etaMinutes) : ''].join(' | '))
    .join('\n');

const CarServiceDashboard: React.FC<CarServiceDashboardProps> = ({ provider }) => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [openRequests, setOpenRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [openLoading, setOpenLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all' | 'due_today' | 'overdue'>('all');
  const [overviewRange, setOverviewRange] = useState<'today' | '7d' | '30d'>('7d');
  const [openFilters, setOpenFilters] = useState({
    // Default to all cities so providers do not accidentally hide request pool.
    city: '',
    serviceType: 'all',
    last24h: false,
  });
  const [lastOpenRefreshAt, setLastOpenRefreshAt] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [providerServices, setProviderServices] = useState<ProviderServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    serviceType: serviceOptions[0],
    price: '',
    description: '',
    etaMinutes: '',
    includedServicesText: '',
    active: true,
  });
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editingServiceType, setEditingServiceType] = useState<string | null>(null);
  const [editingSkills, setEditingSkills] = useState(false);
  const [editingWorkshops, setEditingWorkshops] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [workshopsInput, setWorkshopsInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<ServiceCategory[]>(provider?.serviceCategories || []);
  const [savingProfile, setSavingProfile] = useState(false);
  const [localProvider, setLocalProvider] = useState<Provider | null>(provider);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'services' | 'open' | 'my-requests'>(() => {
    try {
      const savedTab = sessionStorage.getItem('serviceProviderActiveTab');
      if (savedTab && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(savedTab)) {
        sessionStorage.removeItem('serviceProviderActiveTab');
        return savedTab as 'overview' | 'profile' | 'services' | 'open' | 'my-requests';
      }
    } catch { /* storage unavailable */ }
    // Check URL hash as fallback
    const hash = window.location.hash.slice(1);
    if (hash && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(hash)) {
      return hash as 'overview' | 'profile' | 'services' | 'open' | 'my-requests';
    }
    return 'overview';
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: provider?.name || '',
    email: provider?.email || '',
    phone: provider?.phone || '',
    city: provider?.city || '',
    state: provider?.state || '',
    district: provider?.district || '',
    availability: provider?.availability || '',
  });

  useEffect(() => {
    const c = (provider?.city || '').trim();
    if (c.toLowerCase() === 'pending setup') {
      setOpenFilters((prev) =>
        prev.city.trim().toLowerCase() === 'pending setup' ? { ...prev, city: '' } : prev
      );
    }
  }, [provider?.city]);

  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) => {
        const order = ['accepted', 'in_progress', 'completed', 'cancelled'] as RequestStatus[];
        const aIndex = order.indexOf(a.status);
        const bIndex = order.indexOf(b.status);
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      }),
    [requests]
  );

  const isScheduledToday = (value?: string) => {
    if (!value) return false;
    const dt = new Date(value);
    if (!Number.isFinite(dt.getTime())) return false;
    const now = new Date();
    return dt.getDate() === now.getDate() && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  };

  const isOverdueRequest = (req: ServiceRequest) => {
    if (!req.scheduledAt || req.status === 'completed' || req.status === 'cancelled') return false;
    const scheduledMs = new Date(req.scheduledAt).getTime();
    return Number.isFinite(scheduledMs) && scheduledMs < Date.now();
  };

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return sortedRequests;
    if (statusFilter === 'due_today') return sortedRequests.filter((req) => isScheduledToday(req.scheduledAt));
    if (statusFilter === 'overdue') return sortedRequests.filter((req) => isOverdueRequest(req));
    return sortedRequests.filter((req) => req.status === statusFilter);
  }, [sortedRequests, statusFilter]);

  const myRequestStats = useMemo(() => {
    const completedToday = requests.filter((req) => req.status === 'completed' && isScheduledToday(req.scheduledAt)).length;
    const dueToday = requests.filter((req) => isScheduledToday(req.scheduledAt)).length;
    const overdue = requests.filter((req) => isOverdueRequest(req)).length;
    return {
      total: requests.length,
      accepted: requests.filter((r) => r.status === 'accepted').length,
      inProgress: requests.filter((r) => r.status === 'in_progress').length,
      completedToday,
      dueToday,
      overdue,
    };
  }, [requests]);

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

  const isWithinOverviewRange = (iso?: string) => {
    if (!iso) return false;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return false;
    const now = Date.now();
    if (overviewRange === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return ts >= start.getTime() && ts <= now;
    }
    const days = overviewRange === '7d' ? 7 : 30;
    return now - ts <= days * 24 * 60 * 60 * 1000;
  };

  const overviewRequests = useMemo(
    () => requests.filter((r) => isWithinOverviewRange(r.createdAt || r.updatedAt)),
    [overviewRange, requests],
  );

  const overviewOpenRequests = useMemo(
    () => openRequests.filter((r) => isWithinOverviewRange(r.createdAt || r.updatedAt)),
    [openRequests, overviewRange],
  );

  const overviewStats = useMemo(
    () => ({
      total: overviewRequests.length,
      open: overviewOpenRequests.length,
      accepted: overviewRequests.filter((r) => r.status === 'accepted').length,
      inProgress: overviewRequests.filter((r) => r.status === 'in_progress').length,
      completed: overviewRequests.filter((r) => r.status === 'completed').length,
      cancelled: overviewRequests.filter((r) => r.status === 'cancelled').length,
    }),
    [overviewOpenRequests.length, overviewRequests],
  );

  const activeProviderServices = useMemo(
    () => providerServices.filter((svc) => svc.active !== false),
    [providerServices],
  );

  const filteredProviderServices = useMemo(() => {
    return providerServices.filter((svc) => {
      const statusOk =
        serviceStatusFilter === 'all' ||
        (serviceStatusFilter === 'active' ? svc.active !== false : svc.active === false);
      const searchOk = serviceSearch
        ? String(svc.serviceType || '').toLowerCase().includes(serviceSearch.toLowerCase())
        : true;
      return statusOk && searchOk;
    });
  }, [providerServices, serviceSearch, serviceStatusFilter]);

  const providerSetupReady = useMemo(() => {
    const cityReady = Boolean((localProvider?.city || provider?.city || '').trim());
    const serviceReady = activeProviderServices.length > 0;
    return cityReady && serviceReady;
  }, [activeProviderServices.length, localProvider?.city, provider?.city]);

  const recommendedCategories = useMemo(() => {
    const activeNames = new Set(
      activeProviderServices.map((svc) => String(svc.serviceType || '').trim().toLowerCase()).filter(Boolean),
    );
    return SERVICE_CATEGORIES.filter((category) =>
      SERVICE_CATEGORY_MAP[category].some((service) => activeNames.has(service.toLowerCase())),
    );
  }, [activeProviderServices]);

  const effectiveSelectedCategories = useMemo(
    () => ((localProvider?.serviceCategories?.length ? localProvider.serviceCategories : selectedCategories) as ServiceCategory[]),
    [localProvider?.serviceCategories, selectedCategories],
  );

  const suggestedServiceTemplateNames = useMemo(() => {
    const names = effectiveSelectedCategories.flatMap((category) => SERVICE_CATEGORY_MAP[category] || []);
    const deduped = Array.from(new Set(names));
    return deduped.length > 0 ? deduped : DEFAULT_SERVICE_TEMPLATE_NAMES;
  }, [effectiveSelectedCategories]);

  const suggestedServiceTemplates = useMemo(
    () =>
      suggestedServiceTemplateNames.map((serviceType) => ({
        serviceType,
        ...SERVICE_TEMPLATE_PRESETS[serviceType],
      })),
    [suggestedServiceTemplateNames],
  );

  const profileReadiness = useMemo(() => {
    const checks = [
      Boolean((localProvider?.city || '').trim()),
      Boolean((localProvider?.availability || '').trim()),
      Boolean(localProvider?.skills?.length),
      Boolean(localProvider?.workshops?.length),
      activeProviderServices.length > 0,
      Boolean(localProvider?.serviceCategories?.length),
    ];
    const completed = checks.filter(Boolean).length;
    return {
      percent: Math.round((completed / checks.length) * 100),
      completed,
      total: checks.length,
      checks,
    };
  }, [activeProviderServices.length, localProvider]);

  const avgServicePrice = useMemo(() => {
    const priced = activeProviderServices
      .map((s) => s.price)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);
    if (priced.length === 0) return null;
    return Math.round(priced.reduce((sum, p) => sum + p, 0) / priced.length);
  }, [activeProviderServices]);

  const recentOpenCount = useMemo(() => overviewOpenRequests.length, [overviewOpenRequests.length]);

  const acceptanceRate = useMemo(() => {
    const actionable = overviewStats.accepted + overviewStats.inProgress + overviewStats.completed;
    if (actionable === 0) return 0;
    return Math.round((overviewStats.completed / actionable) * 100);
  }, [overviewStats.accepted, overviewStats.completed, overviewStats.inProgress]);

  const priorityAlerts = useMemo(() => {
    const alerts: Array<{ level: 'warn' | 'critical'; message: string }> = [];
    if (!(localProvider?.availability || '').trim()) {
      alerts.push({ level: 'warn', message: 'Availability is not set. You may miss matching opportunities.' });
    }
    if (activeProviderServices.length === 0) {
      alerts.push({ level: 'critical', message: 'No active services. You are unlikely to receive requests.' });
    }
    const staleOpen = openRequests.filter((req) => {
      if (!req.createdAt) return false;
      const ts = new Date(req.createdAt).getTime();
      return Number.isFinite(ts) && Date.now() - ts > 2 * 60 * 60 * 1000;
    }).length;
    if (staleOpen > 0) {
      alerts.push({ level: 'warn', message: `${staleOpen} open requests are older than 2h.` });
    }
    return alerts;
  }, [activeProviderServices.length, localProvider?.availability, openRequests]);

  const recentActivity = useMemo(() => {
    return [...overviewRequests]
      .sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      })
      .slice(0, 5)
      .map((req) => ({
        id: req.id,
        title: req.title,
        when: req.updatedAt || req.createdAt,
        status: req.status,
      }));
  }, [overviewRequests]);

  const nextBestAction = useMemo(() => {
    if (!(localProvider?.availability || '').trim()) {
      return 'Set your availability to appear in more customer matches.';
    }
    if (activeProviderServices.length < 3) {
      return 'Add or activate at least 3 services to increase discoverability.';
    }
    if (!(localProvider?.serviceCategories || []).length) {
      return 'Select service categories so jobs are routed accurately.';
    }
    if (!(localProvider?.workshops || []).length) {
      return 'Add workshop locations to improve local request targeting.';
    }
    return 'Great setup. Keep response time low to maximize acceptance rate.';
  }, [activeProviderServices.length, localProvider]);

  const enrichedOpenRequests = useMemo(() => {
    const providerCity = (localProvider?.city || provider?.city || '').trim().toLowerCase();
    const activeServiceNames = new Set(
      activeProviderServices.map((svc) => String(svc.serviceType || '').trim().toLowerCase()).filter(Boolean),
    );
    const now = Date.now();
    return [...openRequests]
      .map((req) => {
        let score = 0;
        const reasons: MatchReason[] = [];
        const reqCity = (req.city || '').trim().toLowerCase();
        if (providerCity && reqCity && providerCity === reqCity) {
          score += 50;
          reasons.push('city_match');
        }
        const reqService = String(req.serviceType || '').trim().toLowerCase();
        if (reqService && activeServiceNames.has(reqService)) {
          score += 35;
          reasons.push('service_match');
        }
        const createdAt = req.createdAt ? new Date(req.createdAt).getTime() : Number.NaN;
        if (!Number.isNaN(createdAt)) {
          const mins = (now - createdAt) / 60000;
          if (mins <= 10) {
            score += 25;
            reasons.push('new_request');
          } else if (mins <= 60) {
            score += 10;
          }
        }
        return { ...req, _matchScore: score, _matchReasons: reasons };
      })
      .sort((a, b) => b._matchScore - a._matchScore);
  }, [activeProviderServices, localProvider?.city, openRequests, provider?.city]);

  const openRequestInsights = useMemo(() => {
    const total = enrichedOpenRequests.length;
    const strongMatches = enrichedOpenRequests.filter((req) => req._matchScore >= 60).length;
    const newPool = enrichedOpenRequests.filter((req) => req._matchReasons.includes('new_request')).length;
    const cityMatched = enrichedOpenRequests.filter((req) => req._matchReasons.includes('city_match')).length;
    return { total, strongMatches, newPool, cityMatched };
  }, [enrichedOpenRequests]);

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

  const normalizeVehicleText = (vehicle: unknown): string => {
    if (typeof vehicle === 'string') return vehicle.trim();
    if (!vehicle || typeof vehicle !== 'object') return '';
    const raw = vehicle as Record<string, unknown>;
    const makeModel = [raw.make, raw.model]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim())
      .join(' ');
    const year = typeof raw.year === 'number' || typeof raw.year === 'string' ? String(raw.year).trim() : '';
    const reg = typeof raw.reg === 'string' ? raw.reg.trim() : '';
    const city = typeof raw.city === 'string' ? raw.city.trim() : '';
    const fuel = typeof raw.fuel === 'string' ? raw.fuel.trim() : '';
    const label = [makeModel, year ? `(${year})` : '', fuel, reg ? `· ${reg}` : '', city ? `· ${city}` : '']
      .filter(Boolean)
      .join(' ')
      .replace(/\s+·/g, ' ·')
      .trim();
    if (label) return label;
    try {
      return JSON.stringify(vehicle);
    } catch {
      return '';
    }
  };

  const normalizeServiceRequest = (req: ServiceRequest): ServiceRequest => ({
    ...req,
    vehicle: normalizeVehicleText(req.vehicle),
    carDetails: normalizeVehicleText(req.carDetails),
    city: typeof req.city === 'string' ? req.city : '',
  });

  const formatRelative = (value?: string) => {
    if (!value) return 'just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'just now';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const formatSlaRemaining = (createdAt?: string) => {
    if (!createdAt) return null;
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return null;
    const SLA_MINUTES = 120;
    const remaining = SLA_MINUTES - Math.floor((Date.now() - created) / 60000);
    if (remaining <= 0) return 'Expired';
    if (remaining < 60) return `${remaining}m left`;
    return `${Math.floor(remaining / 60)}h ${remaining % 60}m left`;
  };

  const statusBadge = (status: RequestStatus) => {
    const base = 'px-3 py-1.5 rounded-full text-xs font-bold border-2 shadow-sm';
    if (status === 'open') return `${base} bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border-amber-300`;
    if (status === 'accepted') return `${base} bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-300`;
    if (status === 'in_progress') return `${base} bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-800 border-indigo-300`;
    if (status === 'cancelled') return `${base} bg-gradient-to-r from-red-50 to-red-100 text-red-800 border-red-300`;
    return `${base} bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border-emerald-300`;
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const sessionResult = await getSession();
      if (sessionResult.success && sessionResult.session?.access_token) {
        return { Authorization: `Bearer ${sessionResult.session.access_token}` };
      }
      if (process.env.NODE_ENV === 'development') {
        return { 'x-mock-provider-id': provider?.email || provider?.name || 'dev-mock-provider' };
      }
      throw new Error('Not authenticated');
    } catch (error) {
      console.error('Error getting auth headers:', error);
      // In development, still allow with mock provider
      if (process.env.NODE_ENV === 'development') {
        return { 'x-mock-provider-id': provider?.email || provider?.name || 'dev-mock-provider' };
      }
      throw error;
    }
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
        services: [
          { id: 'pkg-oil', name: 'Standard oil change', quantity: 1, price: 2499 },
          { id: 'pkg-filter', name: 'Air filter replacement', quantity: 1, price: 450 },
        ],
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
        services: [{ id: 'pkg-brake', name: 'Brake inspection', quantity: 1 }],
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
      setEditingServiceType(null);
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
        includedServices: parseIncludedServicesText(serviceForm.includedServicesText),
        active: serviceForm.active,
      };
      const resp = await fetch('/api/provider-services', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' } as Record<string, string>,
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save service');
      }
      const data = await resp.json();
      setProviderServices(data);
      
      // Reset form after successful save
      clearServiceForm();
      
      // Dispatch event to notify admin panel of service update
      window.dispatchEvent(new CustomEvent('serviceProviderServicesUpdated', {
        detail: { providerId: provider?.email || provider?.name, services: data }
      }));
      
      // Also update localStorage to trigger cross-tab sync
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('serviceProviderServicesLastUpdate', Date.now().toString());
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err) {
      console.error('Error saving service:', err);
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
        headers: { ...headers, 'Content-Type': 'application/json' } as Record<string, string>,
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update service');
      }
      const data = await resp.json();
      setProviderServices(data);
      
      // Dispatch event to notify admin panel of service update
      window.dispatchEvent(new CustomEvent('serviceProviderServicesUpdated', {
        detail: { providerId: provider?.email || provider?.name, services: data }
      }));
      
      // Also update localStorage to trigger cross-tab sync
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('serviceProviderServicesLastUpdate', Date.now().toString());
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err) {
      console.error('Error toggling service:', err);
      setServicesError(err instanceof Error ? err.message : 'Failed to update service');
      // Revert the checkbox state on error
      const updatedServices = providerServices.map(svc => 
        svc.serviceType === serviceType ? { ...svc, active: !active } : svc
      );
      setProviderServices(updatedServices);
    } finally {
      setSavingService(false);
    }
  };

  const startEditService = (service: {
    serviceType: string;
    price?: number;
    description?: string;
    etaMinutes?: number;
    active?: boolean;
    includedServices?: IncludedServicePrice[];
  }) => {
    setEditingServiceType(service.serviceType);
    setServiceForm({
      serviceType: service.serviceType,
      price: service.price != null ? String(service.price) : '',
      description: service.description || '',
      etaMinutes: service.etaMinutes != null ? String(service.etaMinutes) : '',
      includedServicesText: formatIncludedServicesText(service.includedServices),
      active: service.active !== false,
    });
  };

  const clearServiceForm = () => {
    setEditingServiceType(null);
    setServiceForm({
      serviceType: suggestedServiceTemplateNames[0] || serviceOptions[0],
      price: '',
      description: '',
      etaMinutes: '',
      includedServicesText: '',
      active: true,
    });
  };

  const applyServiceTemplate = (template: { serviceType: string; price: string; etaMinutes: string; description: string }) => {
    setEditingServiceType(null);
    setServiceForm({
      serviceType: template.serviceType,
      price: template.price,
      description: template.description,
      etaMinutes: template.etaMinutes,
      includedServicesText: '',
      active: true,
    });
  };

  const deleteService = async (serviceType: string) => {
    if (!window.confirm(`Delete "${serviceType}" from your service list?`)) return;
    setSavingService(true);
    setServicesError(null);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/provider-services?serviceType=${encodeURIComponent(serviceType)}`, {
        method: 'DELETE',
        headers,
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete service');
      }
      const data = await resp.json();
      setProviderServices(Array.isArray(data) ? data : []);
      if (editingServiceType === serviceType) {
        clearServiceForm();
      }
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setSavingService(false);
    }
  };

  const withToken = async (): Promise<string> => {
    const sessionResult = await getSession();
    if (!sessionResult.success || !sessionResult.session?.access_token) {
      // In development, allow with mock provider
      if (process.env.NODE_ENV === 'development') {
        return 'dev-mock-token';
      }
      throw new Error('Not authenticated');
    }
    return sessionResult.session.access_token;
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
      const normalized = Array.isArray(data) ? data.map((req) => normalizeServiceRequest(req as ServiceRequest)) : [];
      setRequests(normalized);
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
      const cityRaw = openFilters.city.trim();
      const cityQuery =
        cityRaw.toLowerCase() === 'pending setup' ? '' : cityRaw;
      if (cityQuery) params.set('city', cityQuery);
      if (openFilters.serviceType !== 'all') params.set('serviceType', openFilters.serviceType);
      if (openFilters.last24h) params.set('recentHours', '24');
      const resp = await fetch(`/api/service-requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load open requests');
      }
      const data = await resp.json();
      const normalized = Array.isArray(data) ? data.map((req) => normalizeServiceRequest(req as ServiceRequest)) : [];
      // Dev-only telemetry hook (avoid noisy localhost calls in production).
      if (process.env.NODE_ENV !== 'production') {
        fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0a2ed1' },
          body: JSON.stringify({
            sessionId: '0a2ed1',
            runId: 'post-fix',
            hypothesisId: 'H1-H5',
            location: 'CarServiceDashboard.tsx:fetchOpenRequests',
            message: 'open pool client response',
            data: {
              query: params.toString(),
              cityFilterSent: Boolean(cityQuery),
              cityFilterRawLen: cityRaw.length,
              isPlaceholderCityFilter: cityRaw.toLowerCase() === 'pending setup',
              serviceType: openFilters.serviceType,
              ok: resp.ok,
              resultCount: normalized.length,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      setOpenRequests(normalized);
      setLastOpenRefreshAt(new Date().toISOString());
      setRefreshNotice(`Open requests refreshed (${normalized.length})`);
      window.setTimeout(() => setRefreshNotice(null), 2200);
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

  const handleRefreshRef = useRef(handleRefresh);
  handleRefreshRef.current = handleRefresh;

  useEffect(() => {
    if (!provider) return;
    const tick = () => handleRefreshRef.current();
    const interval = window.setInterval(tick, 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [provider]);

  useEffect(() => {
    if (!provider) return;
    let active = true;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`provider-open-requests-${provider.email || provider.name || 'unknown'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests' },
        () => {
          if (!active) return;
          handleRefreshRef.current();
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [provider]);

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
      const updated = normalizeServiceRequest(await resp.json());
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
      const currentRequest = requests.find((req) => req.id === id);
      if (currentRequest?.status === 'cancelled' || currentRequest?.status === 'completed') {
        setError('This request is locked and its status cannot be changed.');
        window.setTimeout(() => {
          setError((prev) =>
            prev === 'This request is locked and its status cannot be changed.' ? null : prev,
          );
        }, 2500);
        return;
      }
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
      const updated = normalizeServiceRequest(await resp.json());
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const deleteCancelledRequest = async (id: string) => {
    if (!window.confirm('Delete this cancelled request permanently?')) return;
    setDeletingId(id);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch(`/api/service-requests?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete request');
      }
      setRequests((prev) => prev.filter((req) => req.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete request');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (provider) {
      setLocalProvider(provider);
      setSkillsInput(provider.skills?.join(', ') || '');
      setWorkshopsInput(provider.workshops?.join(', ') || '');
      setProfileForm({
        name: provider.name || '',
        email: provider.email || '',
        phone: provider.phone || '',
        city: provider.city || '',
        state: provider.state || '',
        district: provider.district || '',
        availability: provider.availability || '',
      });
      fetchRequests();
      fetchOpenRequests();
      fetchProviderServices();
    }
  }, [provider]);

  // Listen for profile updates from other tabs/windows
  useEffect(() => {
    const handleProfileUpdate = async () => {
      // Refresh provider data when updated elsewhere
      try {
        const token = await withToken();
        const resp = await fetch('/api/service-providers', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const updated = await resp.json();
          setLocalProvider(updated);
          setProfileForm({
            name: updated.name || '',
            email: updated.email || '',
            phone: updated.phone || '',
            city: updated.city || '',
            state: updated.state || '',
            district: updated.district || '',
            availability: updated.availability || '',
          });
          setSelectedCategories(updated.serviceCategories || []);
        }
      } catch (err) {
        console.warn('Failed to refresh provider data:', err);
      }
    };
    
    window.addEventListener('serviceProviderProfileUpdated', handleProfileUpdate);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'serviceProviderProfileLastUpdate') {
        handleProfileUpdate();
      }
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      window.removeEventListener('serviceProviderProfileUpdated', handleProfileUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Listen for tab changes from external sources (e.g., header dropdown)
  useEffect(() => {
    const checkTab = () => {
      try {
        const savedTab = sessionStorage.getItem('serviceProviderActiveTab');
        if (savedTab && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(savedTab)) {
          setActiveTab(savedTab as 'overview' | 'profile' | 'services' | 'open' | 'my-requests');
          sessionStorage.removeItem('serviceProviderActiveTab');
        }
      } catch { /* storage unavailable */ }
    };
    
    // Listen for custom event from header
    const handleTabChange = (e: CustomEvent) => {
      const tab = e.detail?.tab;
      if (tab && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(tab)) {
        setActiveTab(tab as 'overview' | 'profile' | 'services' | 'open' | 'my-requests');
      }
    };
    
    // Check on mount
    checkTab();
    
    // Listen for custom event
    window.addEventListener('serviceProviderTabChange', handleTabChange as EventListener);
    
    return () => {
      window.removeEventListener('serviceProviderTabChange', handleTabChange as EventListener);
    };
  }, []);

  const saveProfile = async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: localProvider.email,
          name: profileForm.name,
          phone: profileForm.phone,
          city: profileForm.city,
          state: profileForm.state,
          district: profileForm.district,
          availability: profileForm.availability,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update profile');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setEditingProfile(false);
      
      // Dispatch event to notify admin panel and other components
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: updated?.email || updated?.name, profile: updated }
      }));
      
      // Update localStorage to trigger cross-tab sync
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('serviceProviderProfileLastUpdate', Date.now().toString());
        window.dispatchEvent(new Event('storage'));
      }
      
      // Refresh provider data to ensure sync
      try {
        const refreshResp = await fetch('/api/service-providers', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refreshResp.ok) {
          const refreshed = await refreshResp.json();
          setLocalProvider(refreshed);
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh provider data:', refreshErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

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
        body: JSON.stringify({ email: localProvider.email, skills: skillsArray }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update skills');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setEditingSkills(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: updated?.email || updated?.name, profile: updated }
      }));
      localStorage.setItem('serviceProviderProfileLastUpdate', Date.now().toString());
      window.dispatchEvent(new Event('storage'));
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
        body: JSON.stringify({ email: localProvider.email, workshops: workshopsArray }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update workshops');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setEditingWorkshops(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: updated?.email || updated?.name, profile: updated }
      }));
      localStorage.setItem('serviceProviderProfileLastUpdate', Date.now().toString());
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workshops');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveCategories = async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: localProvider.email, serviceCategories: selectedCategories }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update service categories');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setEditingCategories(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: updated?.email || updated?.name, profile: updated }
      }));
      localStorage.setItem('serviceProviderProfileLastUpdate', Date.now().toString());
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service categories');
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
      <header className="bg-gradient-to-r from-white via-blue-50/30 to-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Service Dashboard</h1>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {localProvider?.city || 'Not set'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || openLoading}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white text-sm font-semibold hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 disabled:opacity-60 shadow-md transition-all flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading || openLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading || openLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Enhanced Tab Navigation */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-1.5">
          <nav className="flex space-x-2 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 whitespace-nowrap relative ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Overview
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 whitespace-nowrap ${
                activeTab === 'services'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Services & Pricing
            </button>
            <button
              onClick={() => setActiveTab('open')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 whitespace-nowrap relative ${
                activeTab === 'open'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Open Requests
              {stats.open > 0 && (
                <span className={`ml-2 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'open' ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {stats.open}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('my-requests')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 whitespace-nowrap relative ${
                activeTab === 'my-requests'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              My Requests
              {stats.total > 0 && (
                <span className={`ml-2 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'my-requests' ? 'bg-white/20 text-white' : 'bg-blue-500 text-white'
                }`}>
                  {stats.total}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              <section className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Profile readiness: {profileReadiness.percent}% ({profileReadiness.completed}/{profileReadiness.total})
                    </p>
                    <p className="text-xs text-blue-800 mt-1">Complete setup items to unlock better matching and conversion.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('services')}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Complete setup
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                  <span className={`rounded-full px-2.5 py-1 font-medium ${profileReadiness.checks[0] ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>City</span>
                  <span className={`rounded-full px-2.5 py-1 font-medium ${profileReadiness.checks[1] ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>Availability</span>
                  <span className={`rounded-full px-2.5 py-1 font-medium ${profileReadiness.checks[2] ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>Skills</span>
                  <span className={`rounded-full px-2.5 py-1 font-medium ${profileReadiness.checks[3] ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>Workshops</span>
                  <span className={`rounded-full px-2.5 py-1 font-medium ${profileReadiness.checks[4] ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>Active services</span>
                  <span className={`rounded-full px-2.5 py-1 font-medium ${profileReadiness.checks[5] ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>Categories</span>
                </div>
              </section>

              {priorityAlerts.length > 0 && (
                <section className="mb-6 space-y-2">
                  {priorityAlerts.map((alert, idx) => (
                    <div
                      key={`${alert.message}-${idx}`}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        alert.level === 'critical'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {alert.message}
                    </div>
                  ))}
                </section>
              )}

              {/* Profile Overview Section */}
              <section className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    Profile Overview
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="group bg-gradient-to-br from-white to-blue-50/30 rounded-xl border-2 border-gray-200 p-4 shadow-md hover:shadow-lg hover:border-blue-300 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Availability</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-gray-900 mb-1">{localProvider?.availability || 'Not set'}</p>
                    <p className="text-xs text-gray-500">Preferred working days/hours</p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('profile');
                        setEditingProfile(true);
                      }}
                      className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      {localProvider?.availability ? 'Edit availability' : 'Set availability'}
                    </button>
                  </div>
                  <div className="group bg-gradient-to-br from-white to-purple-50/30 rounded-xl border-2 border-gray-200 p-4 shadow-md hover:shadow-lg hover:border-purple-300 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Skills</p>
                        </div>
                      </div>
                      {!editingSkills && (
                        <button
                          type="button"
                          onClick={() => setEditingSkills(true)}
                          className="px-2.5 py-1 text-xs font-semibold text-purple-600 hover:text-white hover:bg-purple-600 rounded-md transition-all duration-300 border border-purple-200 hover:border-purple-600"
                        >
                          Edit
                        </button>
                      )}
                    </div>
            {editingSkills ? (
                      <div className="space-y-3">
                <input
                  type="text"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="Comma-separated skills"
                          className="w-full px-4 py-2.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveSkills}
                    disabled={savingProfile}
                            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-60 shadow-md transition-all"
                  >
                    {savingProfile ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSkills(false);
                      setSkillsInput(localProvider?.skills?.join(', ') || '');
                    }}
                            className="px-4 py-2 text-sm font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                        <p className="text-lg font-bold text-gray-900 mb-2">
                  {localProvider?.skills?.length ? localProvider.skills.join(', ') : 'Not set'}
                </p>
                        <p className="text-xs text-gray-500 font-medium">What you can service</p>
                        {!localProvider?.skills?.length && (
                          <button
                            type="button"
                            onClick={() => setEditingSkills(true)}
                            className="mt-2 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                          >
                            Add skills
                          </button>
                        )}
              </>
            )}
          </div>
                  <div className="group bg-gradient-to-br from-white to-emerald-50/30 rounded-xl border-2 border-gray-200 p-4 shadow-md hover:shadow-lg hover:border-emerald-300 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Workshops</p>
                        </div>
                      </div>
                      {!editingWorkshops && (
                        <button
                          type="button"
                          onClick={() => setEditingWorkshops(true)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-md transition-all duration-300 border border-emerald-200 hover:border-emerald-600"
                        >
                          Edit
                        </button>
                      )}
                    </div>
            {editingWorkshops ? (
                      <div className="space-y-3">
                <input
                  type="text"
                  value={workshopsInput}
                  onChange={(e) => setWorkshopsInput(e.target.value)}
                  placeholder="Comma-separated locations"
                          className="w-full px-4 py-2.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveWorkshops}
                    disabled={savingProfile}
                            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-60 shadow-md transition-all"
                  >
                    {savingProfile ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkshops(false);
                      setWorkshopsInput(localProvider?.workshops?.join(', ') || '');
                    }}
                            className="px-4 py-2 text-sm font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                        <p className="text-lg font-bold text-gray-900 mb-2">
                  {localProvider?.workshops?.length ? localProvider.workshops.join(', ') : 'Not set'}
                </p>
                        <p className="text-xs text-gray-500 font-medium">Locations you operate</p>
                        {!localProvider?.workshops?.length && (
                          <button
                            type="button"
                            onClick={() => setEditingWorkshops(true)}
                            className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            Add workshop
                          </button>
                        )}
              </>
            )}
          </div>
          </div>
        </section>

            {/* Service Categories Section */}
            <section className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  Service Categories
                </h2>
                {!editingCategories && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategories(recommendedCategories);
                        setEditingCategories(true);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-all"
                    >
                      Auto-select suggested
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCategories(true)}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-semibold hover:from-indigo-700 hover:to-indigo-800 shadow-md transition-all flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                )}
              </div>
              {!editingCategories && (
                <p className="text-xs text-gray-600 mb-3">
                  Selected {localProvider?.serviceCategories?.length || 0} of {SERVICE_CATEGORIES.length}.{' '}
                  {recommendedCategories.length > 0 && localProvider?.serviceCategories?.length === 0
                    ? `Suggested: ${recommendedCategories.join(', ')}`
                    : 'These categories decide which service suggestions appear in pricing.'}
                </p>
              )}
              {editingCategories ? (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-lg">
                  <p className="text-sm text-gray-600 mb-3">
                    Select the categories you offer. Pricing suggestions will follow these selections.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {SERVICE_CATEGORIES.map((category) => {
                      const isSelected = selectedCategories.includes(category);
                      const categoryServices = SERVICE_CATEGORY_MAP[category];
                      return (
                        <label
                          key={category}
                          className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 shadow-md'
                              : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCategories([...selectedCategories, category]);
                                } else {
                                  setSelectedCategories(selectedCategories.filter(c => c !== category));
                                }
                              }}
                              className="h-4 w-4 rounded border-2 border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-gray-900">{category}</span>
                          </div>
                          <div className="text-xs text-gray-600 ml-6">
                            Includes: {categoryServices.join(', ')}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategories(false);
                        setSelectedCategories(localProvider?.serviceCategories || []);
                      }}
                      className="px-4 py-2 text-sm font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveCategories}
                      disabled={savingProfile}
                      className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-60 shadow-md transition-all"
                    >
                      {savingProfile ? 'Saving...' : 'Save Categories'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {SERVICE_CATEGORIES.map((category) => {
                    const isSelected = localProvider?.serviceCategories?.includes(category);
                    const categoryServices = SERVICE_CATEGORY_MAP[category];
                    return (
                      <div
                        key={category}
                        className={`p-4 rounded-lg border-2 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-gray-50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {isSelected && (
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span className="font-semibold text-gray-900">{category}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {isSelected ? `Suggested services: ${categoryServices.join(', ')}` : 'Not selected'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

              {/* Stats Cards */}
              <section className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    Request Statistics
                  </h2>
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
                    {(['today', '7d', '30d'] as const).map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setOverviewRange(range)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                          overviewRange === range
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {range === 'today' ? 'Today' : range}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('my-requests');
                      setStatusFilter('all');
                    }}
                    className="group text-left bg-gradient-to-br from-white via-blue-50/50 to-white border-2 border-blue-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:border-blue-400"
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">My Requests</p>
                    <p className="text-3xl font-extrabold text-gray-900">{overviewStats.total}</p>
                    <p className="text-xs text-gray-500 mt-1">Tap to view all claimed jobs</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('open')}
                    className="group text-left bg-gradient-to-br from-white via-amber-50/50 to-white border-2 border-amber-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:border-amber-400"
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Open (pool)</p>
                    <p className="text-3xl font-extrabold text-amber-700">{overviewStats.open}</p>
                    <p className="text-xs text-gray-500 mt-1">{recentOpenCount} in selected period</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('my-requests');
                      setStatusFilter('accepted');
                    }}
                    className="group text-left bg-gradient-to-br from-white via-blue-50/50 to-white border-2 border-blue-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:border-blue-400"
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Accepted</p>
                    <p className="text-3xl font-extrabold text-blue-700">{overviewStats.accepted}</p>
                    <p className="text-xs text-gray-500 mt-1">Acceptance quality: {acceptanceRate}%</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('my-requests');
                      setStatusFilter('completed');
                    }}
                    className="group text-left bg-gradient-to-br from-white via-emerald-50/50 to-white border-2 border-emerald-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:border-emerald-400"
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Completed</p>
                    <p className="text-3xl font-extrabold text-emerald-700">{overviewStats.completed}</p>
                    <p className="text-xs text-gray-500 mt-1">Estimated revenue: ₹{((avgServicePrice || 0) * overviewStats.completed).toLocaleString('en-IN')}</p>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Operational Metrics</p>
                    <p className="text-sm text-gray-700 mt-2">Jobs in progress: <span className="font-semibold">{overviewStats.inProgress}</span></p>
                    <p className="text-sm text-gray-700">Avg job value: <span className="font-semibold">{avgServicePrice ? `₹${avgServicePrice.toLocaleString('en-IN')}` : '-'}</span></p>
                    <p className="text-sm text-gray-700">Cancellation rate: <span className="font-semibold">{overviewStats.total ? Math.round((overviewStats.cancelled / overviewStats.total) * 100) : 0}%</span></p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Recent Activity</p>
                    <div className="mt-2 space-y-2">
                      {recentActivity.length === 0 ? (
                        <p className="text-sm text-gray-500">No activity yet.</p>
                      ) : (
                        recentActivity.map((item) => (
                          <div key={item.id} className="text-xs text-gray-700">
                            <span className="font-semibold">{item.title}</span> is {item.status.replace('_', ' ')} · {formatRelative(item.when)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-indigo-700">Next best action</p>
                    <p className="text-sm text-indigo-900 mt-2 font-medium">{nextBestAction}</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('services')}
                      className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Fix now
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  Profile Settings
                </h2>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:from-blue-700 hover:to-blue-800 shadow-md transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>
                )}
              </div>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Name
                    </label>
                    {editingProfile ? (
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    ) : (
                      <div className="px-4 py-2.5 bg-gray-50 rounded-lg border-2 border-gray-200 text-gray-900 font-medium">
                        {localProvider?.name || 'Not set'}
            </div>
                    )}
          </div>
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </label>
                    <div className="px-4 py-2.5 bg-gray-50 rounded-lg border-2 border-gray-200 text-gray-600">
                      {localProvider?.email || 'Not set'}
                      <span className="ml-2 text-xs text-gray-500">(Cannot be changed)</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Phone
                    </label>
                    {editingProfile ? (
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="e.g., 1234567890"
                      />
                    ) : (
                      <div className="px-4 py-2.5 bg-gray-50 rounded-lg border-2 border-gray-200 text-gray-900 font-medium">
                        {localProvider?.phone || 'Not set'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      City
                    </label>
                    {editingProfile ? (
                      <input
                        type="text"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="e.g., Mumbai"
                      />
                    ) : (
                      <div className="px-4 py-2.5 bg-gray-50 rounded-lg border-2 border-gray-200 text-gray-900 font-medium">
                        {localProvider?.city || 'Not set'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      State
                    </label>
                    {editingProfile ? (
                      <input
                        type="text"
                        value={profileForm.state}
                        onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="e.g., Maharashtra"
                      />
                    ) : (
                      <div className="px-4 py-2.5 bg-gray-50 rounded-lg border-2 border-gray-200 text-gray-900 font-medium">
                        {localProvider?.state || 'Not set'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      District
                    </label>
                    {editingProfile ? (
                      <input
                        type="text"
                        value={profileForm.district}
                        onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="e.g., Mumbai Suburban"
                      />
                    ) : (
                      <div className="px-4 py-2.5 bg-gray-50 rounded-lg border-2 border-gray-200 text-gray-900 font-medium">
                        {localProvider?.district || 'Not set'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Availability
                    </label>
                    {editingProfile ? (
                      <input
                        type="text"
                        value={profileForm.availability}
                        onChange={(e) => setProfileForm({ ...profileForm, availability: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="e.g., Monday-Friday, 9 AM - 6 PM"
                      />
                    ) : (
                      <div className="px-4 py-2.5 bg-gray-50 rounded-lg border-2 border-gray-200 text-gray-900 font-medium">
                        {localProvider?.availability || 'Not set'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {editingProfile && (
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setEditingProfile(false);
                      setProfileForm({
                        name: localProvider?.name || '',
                        email: localProvider?.email || '',
                        phone: localProvider?.phone || '',
                        city: localProvider?.city || '',
                        state: localProvider?.state || '',
                        district: localProvider?.district || '',
                        availability: localProvider?.availability || '',
                      });
                    }}
                    className="px-6 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 shadow-md transition-all flex items-center gap-2"
                  >
                    {savingProfile ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Services & Pricing Tab */}
          {activeTab === 'services' && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    My Services & Pricing
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Add your services and pricing. Suggestions are based on your selected service categories.
                  </p>
                </div>
              </div>
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">Eligibility status</p>
            <p className="text-xs text-blue-800 mt-1">
              {providerSetupReady
                ? 'You are eligible to receive matched requests.'
                : 'Complete your setup to improve request matching and visibility.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-medium ${((localProvider?.city || '').trim() ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}`}>
                City: {(localProvider?.city || '').trim() ? 'Ready' : 'Missing'}
              </span>
              <span className={`rounded-full px-2.5 py-1 font-medium ${activeProviderServices.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                Active services: {activeProviderServices.length}
              </span>
            </div>
          </div>
          {servicesError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {servicesError}
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 mr-1">Quick add from your categories:</span>
            {suggestedServiceTemplates.map((template) => (
              <button
                key={template.serviceType}
                type="button"
                onClick={() => applyServiceTemplate(template)}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
              >
                Use {template.serviceType}
              </button>
            ))}
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl p-5 mb-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Service
                </label>
              <select
                value={serviceForm.serviceType}
                onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all shadow-sm hover:shadow-md"
              >
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Price (₹)
                </label>
              <input
                type="number"
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                placeholder="e.g., 1999"
              />
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ETA (minutes)
                </label>
              <input
                type="number"
                value={serviceForm.etaMinutes}
                onChange={(e) => setServiceForm({ ...serviceForm, etaMinutes: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                placeholder="e.g., 120"
              />
            </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={serviceForm.active}
                  onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
                    className="h-5 w-5 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 transition-all"
                />
                  <span className="group-hover:text-blue-600 transition-colors">Active</span>
              </label>
            </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Description
              </label>
              <textarea
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md resize-none"
                placeholder="Optional details or inclusions"
                rows={3}
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Included services and prices (one per line: `Service name | price | eta`)
              </label>
              <textarea
                value={serviceForm.includedServicesText}
                onChange={(e) => setServiceForm({ ...serviceForm, includedServicesText: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md resize-y font-mono text-xs"
                placeholder={'Engine diagnostics | 499 | 25\nBattery health analysis | 299 | 15'}
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-500">
                Customer can pick any one or more included services. Total is calculated using selected lines.
              </p>
            </div>
            <div className="flex justify-end">
              {editingServiceType && (
                <button
                  type="button"
                  onClick={clearServiceForm}
                  className="mr-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Cancel edit
                </button>
              )}
              <button
                type="button"
                onClick={upsertService}
                disabled={savingService}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2"
              >
                {savingService ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {editingServiceType ? 'Update Service' : 'Save Service'}
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder="Search service"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 text-sm"
            />
            <select
              value={serviceStatusFilter}
              onChange={(e) => setServiceStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 rounded-lg border-2 border-gray-200 text-sm bg-white"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Service</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Price</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">ETA</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Description</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Included</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Last updated</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Active</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {servicesLoading ? (
                  <tr>
                    <td className="py-8 px-4 text-center text-gray-500" colSpan={8}>
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      Loading services...
                      </div>
                    </td>
                  </tr>
                ) : filteredProviderServices.length === 0 ? (
                  <tr>
                    <td className="py-12 px-4 text-center" colSpan={8}>
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-600 font-medium">No services added yet.</p>
                        <p className="text-sm text-gray-500 mt-1">Add your first service using the form above.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProviderServices.map((svc) => (
                    <tr key={svc.serviceType} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">{svc.serviceType}</td>
                      <td className="py-3 px-4 text-gray-800 font-medium">{svc.price !== undefined ? `₹${svc.price.toLocaleString()}` : '-'}</td>
                      <td className="py-3 px-4 text-gray-800">{svc.etaMinutes ? `${svc.etaMinutes} min` : '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{svc.description || '-'}</td>
                      <td className="py-3 px-4 text-xs text-gray-700">
                        {svc.includedServices && svc.includedServices.length > 0
                          ? `${svc.includedServices.filter((line) => line.active !== false).length} lines`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">{svc.updatedAt ? formatDateTime(svc.updatedAt) : '-'}</td>
                      <td className="py-3 px-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={svc.active !== false}
                            onChange={(e) => toggleServiceActive(svc.serviceType, e.target.checked)}
                            className="h-4 w-4 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                          <span className={`text-sm font-medium ${svc.active !== false ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {svc.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditService(svc)}
                            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteService(svc.serviceType)}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
          )}

          {/* Open Requests Tab */}
          {activeTab === 'open' && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Open Requests (claimable)
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Pool of new jobs you can accept.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              <input
                type="text"
                value={openFilters.city}
                onChange={(e) => setOpenFilters((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Filter by city"
                  className="pl-10 pr-4 py-2.5 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
              />
              </div>
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 sm:hidden"
                title="Showing all cities by default"
                aria-label="Showing all cities by default"
              >
                i
              </span>
              <span className="hidden items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 sm:inline-flex">
                Showing all cities by default
              </span>
              <select
                value={openFilters.serviceType}
                onChange={(e) => setOpenFilters((prev) => ({ ...prev, serviceType: e.target.value }))}
                className="px-4 py-2.5 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all shadow-sm hover:shadow-md"
              >
                <option value="all">All services</option>
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={openFilters.last24h}
                  onChange={(e) => setOpenFilters((prev) => ({ ...prev, last24h: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Last 24h
              </label>
              <button
                type="button"
                onClick={() => setOpenFilters({ city: '', serviceType: 'all', last24h: false })}
                className="px-4 py-2.5 rounded-lg border-2 border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={fetchOpenRequests}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold hover:from-gray-900 hover:to-black shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Apply
              </button>
            </div>
          </div>
          {(openFilters.city || openFilters.serviceType !== 'all' || openFilters.last24h) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active filters:</span>
              {openFilters.city && (
                <button
                  type="button"
                  onClick={() => setOpenFilters((prev) => ({ ...prev, city: '' }))}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800"
                >
                  City: {openFilters.city} ×
                </button>
              )}
              {openFilters.serviceType !== 'all' && (
                <button
                  type="button"
                  onClick={() => setOpenFilters((prev) => ({ ...prev, serviceType: 'all' }))}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800"
                >
                  Service: {openFilters.serviceType} ×
                </button>
              )}
              {openFilters.last24h && (
                <button
                  type="button"
                  onClick={() => setOpenFilters((prev) => ({ ...prev, last24h: false }))}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                >
                  Last 24h ×
                </button>
              )}
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>Last refreshed: {lastOpenRefreshAt ? formatDateTime(lastOpenRefreshAt) : 'not yet'}</span>
            {refreshNotice && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                {refreshNotice}
              </span>
            )}
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total open</p>
              <p className="text-lg font-bold text-gray-900">{openRequestInsights.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Strong matches</p>
              <p className="text-lg font-bold text-emerald-900">{openRequestInsights.strongMatches}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">New requests</p>
              <p className="text-lg font-bold text-amber-900">{openRequestInsights.newPool}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">City matches</p>
              <p className="text-lg font-bold text-blue-900">{openRequestInsights.cityMatched}</p>
            </div>
          </div>
          {!providerSetupReady && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Complete setup to improve request matching: add workshop city and enable at least one service.
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          <div className="space-y-4">
            {openLoading ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center gap-3 text-gray-600">
                  <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-medium">Loading open requests...</span>
                </div>
              </div>
            ) : enrichedOpenRequests.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-amber-50/30 rounded-xl border-2 border-dashed border-gray-300">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-700 font-semibold mb-1">No open requests right now.</p>
                  <p className="text-sm text-gray-500 mb-4">Try clearing filters or checking the most recent pool.</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenFilters({ city: '', serviceType: 'all', last24h: false })}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Show all services
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenFilters((prev) => ({ ...prev, last24h: true }))}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      Last 24h
                    </button>
                    <button
                      type="button"
                      onClick={loadSampleOpenRequests}
                      className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add dummy open requests
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              enrichedOpenRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50/60 p-5 shadow-sm transition-all duration-300 hover:border-blue-300 hover:shadow-lg"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-bold text-gray-900">{req.title}</h3>
                        <span className={statusBadge(req.status)}>
                          {statusOptions.find((s) => s.value === req.status)?.label || req.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Raised {formatRelative(req.createdAt)} · {formatDateTime(req.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => claimRequest(req.id)}
                      disabled={claimingId === req.id}
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:opacity-60"
                    >
                      {claimingId === req.id ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Claiming...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Claim
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      {req.serviceType || 'General'}
                    </span>
                    {req._matchReasons.includes('city_match') && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        City match
                      </span>
                    )}
                    {req._matchReasons.includes('service_match') && (
                      <span className="rounded-full border border-indigo-200 bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                        Service match
                      </span>
                    )}
                    {req._matchReasons.includes('new_request') && (
                      <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                        New request
                      </span>
                    )}
                    <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      Score {req._matchScore}
                    </span>
                    {req.city && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {req.city}
                      </span>
                    )}
                    {normalizeVehicleText(req.vehicle) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {normalizeVehicleText(req.vehicle)}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                    <div className="space-y-3">
                      <ServiceRequestPackages services={req.services} total={req.total} />
                      {req.notes && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                          <p className="flex items-start gap-2 text-xs font-medium text-amber-800">
                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Notes: {req.notes}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer & Visit Details</p>
                      <div className="space-y-2">
                        {formatSlaRemaining(req.createdAt) && (
                          <p className="text-xs font-semibold text-amber-700">Claim window: {formatSlaRemaining(req.createdAt)}</p>
                        )}
                        {req.customerName && (
                          <p className="flex items-center gap-2 text-sm text-gray-700">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-medium">{req.customerName}</span>
                          </p>
                        )}
                        {req.customerPhone && <p className="text-xs text-gray-600">Phone: {req.customerPhone}</p>}
                        {req.customerEmail && <p className="text-xs text-gray-600">Email: {req.customerEmail}</p>}
                        {req.addressLine && (
                          <p className="flex items-start gap-2 text-xs text-gray-600">
                            <svg className="mt-0.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{req.addressLine}{req.pincode ? `, ${req.pincode}` : ''}</span>
                          </p>
                        )}
                        {normalizeVehicleText(req.carDetails) && (
                          <p className="text-xs text-gray-600">Vehicle: {normalizeVehicleText(req.carDetails)}</p>
                        )}
                        {req.scheduledAt && (
                          <p className="text-xs text-gray-600">Scheduled: {formatDateTime(req.scheduledAt)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
          )}

          {/* My Requests Tab */}
          {activeTab === 'my-requests' && (
            <section className="rounded-xl border border-gray-200 bg-slate-50/60 p-6 shadow-lg">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    My Requests
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Manage jobs you have claimed.</p>
            </div>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-900">{myRequestStats.total}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Accepted</p>
              <p className="text-lg font-bold text-indigo-900">{myRequestStats.accepted}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">In Progress</p>
              <p className="text-lg font-bold text-amber-900">{myRequestStats.inProgress}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Completed Today</p>
              <p className="text-lg font-bold text-emerald-900">{myRequestStats.completedToday}</p>
            </div>
          </div>

          <div className="sticky top-16 z-10 mb-6 -mx-1 rounded-xl border border-gray-200 bg-white/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/75">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'All', count: myRequestStats.total },
                { key: 'accepted', label: 'Accepted', count: myRequestStats.accepted },
                { key: 'in_progress', label: 'In Progress', count: myRequestStats.inProgress },
                { key: 'completed', label: 'Completed', count: requests.filter((r) => r.status === 'completed').length },
                { key: 'cancelled', label: 'Cancelled', count: requests.filter((r) => r.status === 'cancelled').length },
                { key: 'due_today', label: 'Due Today', count: myRequestStats.dueToday },
                { key: 'overdue', label: 'Overdue', count: myRequestStats.overdue },
              ].map((status) => (
                <button
                  key={status.key}
                  type="button"
                  onClick={() => setStatusFilter(status.key as RequestStatus | 'all' | 'due_today' | 'overdue')}
                  className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                    statusFilter === status.key
                      ? 'border-blue-600 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {status.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      statusFilter === status.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {status.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center gap-3 text-gray-600">
                  <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-medium">Loading requests...</span>
                </div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl border-2 border-dashed border-gray-300">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-700 font-semibold mb-1">
                    {statusFilter === 'all'
                      ? 'No requests yet.'
                      : statusFilter === 'due_today'
                      ? 'No requests due today.'
                      : statusFilter === 'overdue'
                      ? 'No overdue requests.'
                      : `No ${String(statusFilter).replace('_', ' ')} requests.`}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    {statusFilter === 'all'
                      ? 'Start by claiming requests from the open pool.'
                      : 'Try another filter or switch to all requests.'}
                  </p>
                  {statusFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className="mb-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      View all requests
                    </button>
                  )}
                <button
                  type="button"
                  onClick={loadSampleMyRequests}
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  Add dummy my requests
                </button>
                </div>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div key={req.id} className="rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-blue-300 hover:shadow-lg">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-bold text-gray-900">{req.title}</h3>
                        <span className={statusBadge(req.status)}>
                          {statusOptions.find((s) => s.value === req.status)?.label || req.status}
                        </span>
                        {isOverdueRequest(req) && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Created {formatRelative(req.createdAt)} {req.createdAt ? `(${formatDateTime(req.createdAt)})` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              req.id,
                              req.status === 'accepted'
                                ? 'in_progress'
                                : req.status === 'in_progress'
                                ? 'completed'
                                : req.status
                            )
                          }
                          className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${
                            req.status === 'accepted'
                              ? 'bg-indigo-600 hover:bg-indigo-700'
                              : req.status === 'in_progress'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-gray-600 hover:bg-gray-700'
                          }`}
                        >
                          {req.status === 'accepted'
                            ? 'Start Job'
                            : req.status === 'in_progress'
                            ? 'Mark Complete'
                            : 'View Summary'}
                        </button>
                      )}
                      {req.status === 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => deleteCancelledRequest(req.id)}
                          disabled={deletingId === req.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === req.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                      <select
                        value={req.status}
                        onChange={(e) => updateStatus(req.id, e.target.value as RequestStatus)}
                        disabled={
                          deletingId === req.id ||
                          req.status === 'cancelled' ||
                          req.status === 'completed'
                        }
                        className="rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all hover:shadow-md focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        {(req.status === 'accepted'
                          ? statusOptions.filter((opt) => ['accepted', 'in_progress'].includes(opt.value))
                          : req.status === 'in_progress'
                          ? statusOptions.filter((opt) => ['in_progress', 'completed'].includes(opt.value))
                          : statusOptions.filter((opt) => opt.value === req.status)
                        ).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      {req.serviceType || 'General'}
                    </span>
                    {req.city && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {req.city}
                      </span>
                    )}
                    {normalizeVehicleText(req.vehicle) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {normalizeVehicleText(req.vehicle)}
                      </span>
                    )}
                    {req.scheduledAt && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        Scheduled {formatDateTime(req.scheduledAt)}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                    <div className="space-y-3">
                      <ServiceRequestPackages services={req.services} total={req.total} />
                      {req.notes && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                          <p className="flex items-start gap-2 text-xs font-medium text-amber-800">
                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Notes: {req.notes}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer Details</p>
                      <div className="space-y-2">
                        {req.customerName && (
                          <p className="flex items-center gap-2 text-sm text-gray-700">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-medium">{req.customerName}</span>
                          </p>
                        )}
                        {req.customerPhone && <p className="text-xs text-gray-600">Phone: {req.customerPhone}</p>}
                        {req.customerEmail && <p className="text-xs text-gray-600">Email: {req.customerEmail}</p>}
                        {req.addressLine && (
                          <p className="text-xs text-gray-600">
                            Address: {req.addressLine}
                            {req.pincode ? `, ${req.pincode}` : ''}
                          </p>
                        )}
                        {normalizeVehicleText(req.carDetails) && (
                          <p className="text-xs text-gray-600">Vehicle: {normalizeVehicleText(req.carDetails)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default CarServiceDashboard;



import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getValidAccessToken } from '../services/supabase-auth-service';
import { getSupabaseClient } from '../lib/supabase';
import {
  CAR_SERVICE_OPTIONS,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_DESCRIPTIONS,
  SERVICE_CATEGORY_MAP,
  SERVICE_TEMPLATE_PRESETS,
  type ServiceCategory,
} from '../constants/serviceProviderCatalog';
import {
  getSubServicesFor,
  subServiceIdFromName,
  type SubServiceTemplate,
} from '../constants/carServiceSubServices.js';
import { nextPrimaryStatus, primaryAdvanceButtonLabel } from '../utils/serviceRequestStatusFlow';
import { View as ViewEnum } from '../types';

type IncludedServicePrice = {
  id: string;
  name: string;
  price?: number;
  etaMinutes?: number;
  active?: boolean;
};

// --- ETA + sub-service draft helpers (aligned with `CarServiceDashboard`) ---
type EtaUnit = 'min' | 'hr' | 'day';

const pickEtaUnit = (minutes: number | undefined | null): EtaUnit => {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return 'min';
  if (minutes >= 1440 && minutes % 1440 === 0) return 'day';
  if (minutes >= 60 && minutes % 60 === 0) return 'hr';
  return 'min';
};

const etaValueInUnit = (minutes: number, unit: EtaUnit): number => {
  if (unit === 'day') return minutes / 1440;
  if (unit === 'hr') return minutes / 60;
  return minutes;
};

const etaToMinutes = (value: number, unit: EtaUnit): number => {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (unit === 'day') return Math.round(value * 1440);
  if (unit === 'hr') return Math.round(value * 60);
  return Math.round(value);
};

type IncludedServiceDraft = {
  id: string;
  name: string;
  priceText: string;
  etaText: string;
  etaUnit: EtaUnit;
  active: boolean;
};

const draftFromIncluded = (item: IncludedServicePrice, fallbackIdx: number): IncludedServiceDraft => {
  const unit = pickEtaUnit(item.etaMinutes);
  return {
    id:
      (item.id && String(item.id).trim()) ||
      subServiceIdFromName(item.name) ||
      `line-${fallbackIdx + 1}`,
    name: item.name || '',
    priceText: item.price != null && Number.isFinite(item.price) ? String(item.price) : '',
    etaText:
      item.etaMinutes != null && Number.isFinite(item.etaMinutes)
        ? String(etaValueInUnit(item.etaMinutes, unit))
        : '',
    etaUnit: unit,
    active: item.active !== false,
  };
};

const draftFromTemplate = (tmpl: SubServiceTemplate, fallbackIdx: number): IncludedServiceDraft => {
  const unit = pickEtaUnit(tmpl.suggestedEtaMinutes);
  return {
    id: tmpl.id || subServiceIdFromName(tmpl.name) || `line-${fallbackIdx + 1}`,
    name: tmpl.name,
    priceText:
      tmpl.suggestedPrice != null && Number.isFinite(tmpl.suggestedPrice) && tmpl.suggestedPrice > 0
        ? String(tmpl.suggestedPrice)
        : '',
    etaText:
      tmpl.suggestedEtaMinutes != null && Number.isFinite(tmpl.suggestedEtaMinutes)
        ? String(etaValueInUnit(tmpl.suggestedEtaMinutes, unit))
        : '',
    etaUnit: unit,
    active: true,
  };
};

const buildDraftsForServiceType = (
  serviceType: string,
  existing?: IncludedServicePrice[],
): IncludedServiceDraft[] => {
  const canonical = getSubServicesFor(serviceType);
  const existingByKey = new Map<string, IncludedServicePrice>();
  (existing || []).forEach((item) => {
    const key = subServiceIdFromName(item.name) || String(item.id || '').trim();
    if (key) existingByKey.set(key, item);
  });

  const drafts: IncludedServiceDraft[] = [];
  const used = new Set<string>();

  canonical.forEach((tmpl, idx) => {
    const key = subServiceIdFromName(tmpl.name);
    const match = existingByKey.get(key);
    if (match) {
      drafts.push(draftFromIncluded(match, idx));
      used.add(key);
    } else {
      drafts.push({
        ...draftFromTemplate(tmpl, idx),
        active: existing && existing.length > 0 ? false : true,
      });
    }
  });

  (existing || []).forEach((item, idx) => {
    const key = subServiceIdFromName(item.name) || String(item.id || '').trim();
    if (!key || used.has(key)) return;
    drafts.push(draftFromIncluded(item, canonical.length + idx));
    used.add(key);
  });

  return drafts;
};

const includedDraftsToPayload = (drafts: IncludedServiceDraft[]): IncludedServicePrice[] =>
  drafts
    .map((draft, idx) => {
      const name = (draft.name || '').trim();
      if (!name) return null;
      const priceNum = draft.priceText.trim() ? Number(draft.priceText) : undefined;
      const etaRaw = draft.etaText.trim() ? Number(draft.etaText) : undefined;
      const etaMin =
        etaRaw != null && Number.isFinite(etaRaw) && etaRaw >= 0
          ? etaToMinutes(etaRaw, draft.etaUnit || 'min')
          : undefined;
      const entry: IncludedServicePrice = {
        id: draft.id || subServiceIdFromName(name) || `line-${idx + 1}`,
        name,
        active: draft.active,
      };
      if (priceNum != null && Number.isFinite(priceNum) && priceNum >= 0) entry.price = priceNum;
      if (etaMin != null) entry.etaMinutes = etaMin;
      return entry;
    })
    .filter((entry): entry is IncludedServicePrice => entry !== null);

const rebuildSubServicesForNewType = (
  nextType: string,
  previousDrafts: IncludedServiceDraft[],
): IncludedServiceDraft[] => {
  const canonicalForNext = getSubServicesFor(nextType);
  const canonicalKeys = new Set(canonicalForNext.map((t) => subServiceIdFromName(t.name)));
  const prevByKey = new Map<string, IncludedServiceDraft>();
  previousDrafts.forEach((d) => {
    const key = subServiceIdFromName(d.name);
    if (key && canonicalKeys.has(key)) prevByKey.set(key, d);
  });
  return canonicalForNext.map((tmpl, idx) => {
    const key = subServiceIdFromName(tmpl.name);
    const preserved = prevByKey.get(key);
    const base = draftFromTemplate(tmpl, idx);
    if (preserved) {
      return {
        ...base,
        priceText: preserved.priceText || base.priceText,
        etaText: preserved.etaText || base.etaText,
        etaUnit: preserved.etaText ? preserved.etaUnit : base.etaUnit,
        active: true,
      };
    }
    return { ...base, active: true };
  });
};

/**
 * Mobile-first dashboard for service providers.
 * Mirrors the workflows of `CarServiceDashboard` (open pool, my jobs, services,
 * profile) but uses a layout that works on a 360px viewport and integrates with
 * `MobileLayout`. Renders inside the existing mobile shell so the page header /
 * bottom nav still appear.
 */

type RequestStatus = 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

type ServiceLineItem = { id: string; name: string; quantity?: number; price?: number };

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
  vehicle?: unknown;
  city?: string;
  addressLine?: string;
  pincode?: string;
  status: RequestStatus;
  scheduledAt?: string;
  notes?: string;
  carDetails?: unknown;
  services?: ServiceLineItem[];
  total?: number;
  createdAt?: string;
  updatedAt?: string;
  claimedAt?: string;
}

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

interface Props {
  provider: Provider | null;
  onNavigate?: (view: ViewEnum) => void;
  onLogout?: () => void;
}

type TabId = 'overview' | 'open' | 'mine' | 'services' | 'profile';

const TAB_ORDER: { id: TabId; label: string; short: string }[] = [
  { id: 'overview', label: 'Overview', short: 'Overview' },
  { id: 'open', label: 'Open Pool', short: 'Pool' },
  { id: 'mine', label: 'My Jobs', short: 'Jobs' },
  { id: 'services', label: 'Services', short: 'Services' },
  { id: 'profile', label: 'Profile', short: 'Profile' },
];

const STATUS_LABELS: Record<RequestStatus, string> = {
  open: 'Open',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusBadgeClasses = (status: RequestStatus): string => {
  switch (status) {
    case 'open':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'accepted':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'in_progress':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatRelative = (value?: string): string => {
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

const formatVehicle = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const raw = value as Record<string, unknown>;
  const makeModel = [raw.make, raw.model]
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim())
    .join(' ');
  const year =
    typeof raw.year === 'number' || typeof raw.year === 'string' ? String(raw.year).trim() : '';
  const reg = typeof raw.reg === 'string' ? raw.reg.trim() : '';
  const fuel = typeof raw.fuel === 'string' ? raw.fuel.trim() : '';
  return [makeModel, year ? `(${year})` : '', fuel, reg ? `· ${reg}` : '']
    .filter(Boolean)
    .join(' ')
    .trim();
};

const normalizeRequest = (req: ServiceRequest): ServiceRequest => ({
  ...req,
  vehicle: formatVehicle(req.vehicle),
  carDetails: formatVehicle(req.carDetails),
  city: typeof req.city === 'string' ? req.city : '',
});

const MobileCarServiceDashboard: React.FC<Props> = ({ provider, onNavigate, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [localProvider, setLocalProvider] = useState<Provider | null>(provider);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [openRequests, setOpenRequests] = useState<ServiceRequest[]>([]);
  const [providerServices, setProviderServices] = useState<ProviderServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openLoading, setOpenLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [openCity, setOpenCity] = useState('');
  const [openServiceType, setOpenServiceType] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all');
  const [editorOpen, setEditorOpen] = useState<null | { mode: 'create' | 'edit'; row?: ProviderServiceRow }>(
    null,
  );
  /** Remount service sheet so form state resets every time it opens. */
  const [serviceEditorKey, setServiceEditorKey] = useState(0);
  const openServiceEditor = useCallback((config: { mode: 'create' | 'edit'; row?: ProviderServiceRow }) => {
    setServiceEditorKey((k) => k + 1);
    setEditorOpen(config);
  }, []);
  const closeServiceEditor = useCallback(() => setEditorOpen(null), []);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: provider?.name || '',
    phone: provider?.phone || '',
    city: provider?.city || '',
    state: provider?.state || '',
    district: provider?.district || '',
    availability: provider?.availability || '',
    skills: (provider?.skills || []).join(', '),
    workshops: (provider?.workshops || []).join(', '),
    serviceCategories: provider?.serviceCategories || [],
  });

  // Sync local copy when prop changes (login, refresh).
  useEffect(() => {
    if (!provider) return;
    setLocalProvider(provider);
    setProfileForm({
      name: provider.name || '',
      phone: provider.phone || '',
      city: provider.city || '',
      state: provider.state || '',
      district: provider.district || '',
      availability: provider.availability || '',
      skills: (provider.skills || []).join(', '),
      workshops: (provider.workshops || []).join(', '),
      serviceCategories: provider.serviceCategories || [],
    });
  }, [provider]);

  const flashInfo = useCallback((message: string) => {
    setInfo(message);
    window.setTimeout(() => setInfo((current) => (current === message ? null : current)), 2400);
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const t = await getValidAccessToken();
    if (t.success && t.accessToken) {
      return { Authorization: `Bearer ${t.accessToken}` };
    }
    throw new Error(t.reason || 'Not authenticated. Please sign in again.');
  }, []);

  const fetchMyRequests = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch('/api/service-requests', { headers });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load requests');
      }
      const data = await resp.json();
      setRequests(Array.isArray(data) ? data.map((r) => normalizeRequest(r as ServiceRequest)) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, provider]);

  const fetchOpenRequests = useCallback(async () => {
    if (!provider) return;
    setOpenLoading(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set('scope', 'open');
      const cityRaw = openCity.trim();
      const city = cityRaw.toLowerCase() === 'pending setup' ? '' : cityRaw;
      if (city) params.set('city', city);
      if (openServiceType !== 'all') params.set('serviceType', openServiceType);
      const resp = await fetch(`/api/service-requests?${params.toString()}`, { headers });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load open requests');
      }
      const data = await resp.json();
      setOpenRequests(Array.isArray(data) ? data.map((r) => normalizeRequest(r as ServiceRequest)) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load open requests');
    } finally {
      setOpenLoading(false);
    }
  }, [getAuthHeaders, openCity, openServiceType, provider]);

  const fetchProviderServices = useCallback(async () => {
    if (!provider) return;
    setServicesLoading(true);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch('/api/provider-services?scope=mine', { headers });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load services');
      }
      const data = await resp.json();
      setProviderServices(Array.isArray(data) ? (data as ProviderServiceRow[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setServicesLoading(false);
    }
  }, [getAuthHeaders, provider]);

  const refreshAll = useCallback(() => {
    fetchMyRequests();
    fetchOpenRequests();
    fetchProviderServices();
  }, [fetchMyRequests, fetchOpenRequests, fetchProviderServices]);

  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;

  // Initial load + reload when provider arrives.
  useEffect(() => {
    if (!provider) return;
    refreshAllRef.current();
  }, [provider]);

  // Background poll every 30s + on visibility change.
  useEffect(() => {
    if (!provider) return;
    const tick = () => refreshAllRef.current();
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

  // Realtime updates from supabase: refresh when a service_requests row changes.
  useEffect(() => {
    if (!provider) return;
    let active = true;
    let channel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null = null;
    try {
      const supabase = getSupabaseClient();
      const channelName = `mobile-provider-${provider.email || provider.name || 'unknown'}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'service_requests' },
          () => {
            if (!active) return;
            refreshAllRef.current();
          },
        )
        .subscribe();
    } catch {
      // realtime is best-effort; polling will keep things fresh.
    }
    return () => {
      active = false;
      try {
        if (channel) {
          const supabase = getSupabaseClient();
          void supabase.removeChannel(channel);
        }
      } catch {
        // ignore
      }
    };
  }, [provider]);

  // Refetch open pool when filters change.
  useEffect(() => {
    if (!provider) return;
    fetchOpenRequests();
  }, [fetchOpenRequests, provider]);

  /* ----- Stats ----- */
  const stats = useMemo(() => {
    const accepted = requests.filter((r) => r.status === 'accepted').length;
    const inProgress = requests.filter((r) => r.status === 'in_progress').length;
    const completed = requests.filter((r) => r.status === 'completed').length;
    return {
      total: requests.length,
      open: openRequests.length,
      accepted,
      inProgress,
      completed,
      cancelled: requests.filter((r) => r.status === 'cancelled').length,
    };
  }, [requests, openRequests]);

  const filteredMine = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const sortedOpen = useMemo(() => {
    const providerCity = (localProvider?.city || provider?.city || '').trim().toLowerCase();
    const activeServiceNames = new Set(
      providerServices
        .filter((s) => s.active !== false)
        .map((s) => String(s.serviceType || '').trim().toLowerCase())
        .filter(Boolean),
    );
    return [...openRequests]
      .map((req) => {
        let score = 0;
        if (providerCity && req.city && providerCity === req.city.trim().toLowerCase()) score += 50;
        const reqService = String(req.serviceType || '').trim().toLowerCase();
        if (reqService && activeServiceNames.has(reqService)) score += 35;
        return { ...req, _matchScore: score };
      })
      .sort((a, b) => b._matchScore - a._matchScore);
  }, [openRequests, providerServices, localProvider?.city, provider?.city]);

  /* ----- Mutations ----- */
  const claimRequest = useCallback(
    async (id: string) => {
      setClaimingId(id);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch('/api/service-requests', {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'claim' }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to claim request');
        }
        const updated = normalizeRequest((await resp.json()) as ServiceRequest);
        setRequests((prev) => [updated, ...prev.filter((r) => r.id !== id)]);
        setOpenRequests((prev) => prev.filter((r) => r.id !== id));
        flashInfo('Request claimed - moved to My Jobs');
        setActiveTab('mine');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to claim request');
      } finally {
        setClaimingId(null);
      }
    },
    [getAuthHeaders, flashInfo],
  );

  const updateStatus = useCallback(
    async (id: string, status: RequestStatus) => {
      setUpdatingId(id);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch('/api/service-requests', {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update status');
        }
        const updated = normalizeRequest((await resp.json()) as ServiceRequest);
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
        flashInfo(`Marked as ${STATUS_LABELS[status]}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update status');
      } finally {
        setUpdatingId(null);
      }
    },
    [getAuthHeaders, flashInfo],
  );

  const deleteRequest = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this cancelled request?')) return;
      setDeletingId(id);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(`/api/service-requests?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers,
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete');
        }
        setRequests((prev) => prev.filter((r) => r.id !== id));
        flashInfo('Request deleted');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete');
      } finally {
        setDeletingId(null);
      }
    },
    [getAuthHeaders, flashInfo],
  );

  const toggleServiceActive = useCallback(
    async (serviceType: string, active: boolean) => {
      setSavingService(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch('/api/provider-services', {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceType, active }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update service');
        }
        const data = await resp.json();
        setProviderServices(Array.isArray(data) ? (data as ProviderServiceRow[]) : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update service');
      } finally {
        setSavingService(false);
      }
    },
    [getAuthHeaders],
  );

  const deleteService = useCallback(
    async (serviceType: string) => {
      if (!window.confirm(`Remove "${serviceType}" from your services?`)) return;
      setSavingService(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(
          `/api/provider-services?serviceType=${encodeURIComponent(serviceType)}`,
          { method: 'DELETE', headers },
        );
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to remove service');
        }
        const data = await resp.json();
        setProviderServices(Array.isArray(data) ? (data as ProviderServiceRow[]) : []);
        flashInfo('Service removed');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove service');
      } finally {
        setSavingService(false);
      }
    },
    [getAuthHeaders, flashInfo],
  );

  const upsertService = useCallback(
    async (payload: {
      serviceType: string;
      price?: number;
      etaMinutes?: number;
      description?: string;
      active: boolean;
      includedServices: IncludedServicePrice[];
    }) => {
      setSavingService(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch('/api/provider-services', {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save service');
        }
        const data = await resp.json();
        setProviderServices(Array.isArray(data) ? (data as ProviderServiceRow[]) : []);
        closeServiceEditor();
        flashInfo('Service saved');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save service');
      } finally {
        setSavingService(false);
      }
    },
    [getAuthHeaders, flashInfo, closeServiceEditor],
  );

  const saveProfile = useCallback(async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const skills = profileForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const workshops = profileForm.workshops
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        email: localProvider.email,
        name: profileForm.name,
        phone: profileForm.phone,
        city: profileForm.city,
        state: profileForm.state,
        district: profileForm.district,
        availability: profileForm.availability,
        skills,
        workshops,
        serviceCategories: profileForm.serviceCategories,
      };
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update profile');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setProfileEditorOpen(false);
      flashInfo('Profile updated');
      try {
        localStorage.setItem(
          'reRideServiceProvider',
          JSON.stringify({
            ...updated,
            name: updated?.name || localProvider.name,
            city: updated?.city || localProvider.city,
          }),
        );
        window.dispatchEvent(new Event('storage'));
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }, [getAuthHeaders, localProvider, profileForm, flashInfo]);

  /* ----- No provider: App.tsx auto-redirects to CAR_SERVICE_LOGIN; render
   *        nothing so the user never sees an intermediate "sign-in required"
   *        card after logout or a missing session. ----- */
  if (!provider) {
    return null;
  }

  /* ----- Render helpers ----- */
  const StatCard: React.FC<{ label: string; value: number | string; tone?: 'amber' | 'blue' | 'indigo' | 'green' | 'gray' }> = ({
    label,
    value,
    tone = 'gray',
  }) => {
    const toneMap: Record<string, string> = {
      amber: 'from-amber-50 to-amber-100 border-amber-200 text-amber-900',
      blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-900',
      indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-900',
      green: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900',
      gray: 'from-gray-50 to-gray-100 border-gray-200 text-gray-900',
    };
    return (
      <div
        className={`rounded-2xl border bg-gradient-to-br p-3 ${toneMap[tone]}`}
      >
        <p className="text-[11px] uppercase tracking-wide font-semibold opacity-75">{label}</p>
        <p className="text-2xl font-extrabold mt-0.5 tabular-nums">{value}</p>
      </div>
    );
  };

  const RequestCard: React.FC<{ req: ServiceRequest; isOpenPool?: boolean }> = ({
    req,
    isOpenPool,
  }) => {
    const vehicleText = formatVehicle(req.vehicle) || formatVehicle(req.carDetails);
    const lineItems = (req.services || []).filter(
      (s): s is ServiceLineItem => !!s && (typeof s.name === 'string' || typeof s.id === 'string'),
    );
    const totalAmount = lineItems.reduce((sum, line) => {
      const qty = line.quantity != null && line.quantity > 0 ? line.quantity : 1;
      const price = line.price != null && Number.isFinite(line.price) && line.price > 0 ? line.price : 0;
      return sum + qty * price;
    }, 0);
    const finalAmount = totalAmount > 0 ? totalAmount : req.total && req.total > 0 ? req.total : null;
    const phoneHref = req.customerPhone ? `tel:${req.customerPhone.replace(/\s+/g, '')}` : null;
    const nextPrimary = nextPrimaryStatus(req.status as RequestStatus);
    const isLocked = req.status === 'completed' || req.status === 'cancelled';

    return (
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-900 leading-snug truncate">{req.title || req.serviceType || 'Service request'}</h3>
            <p className="mt-0.5 text-[12px] text-gray-500">
              {req.serviceType ? `${req.serviceType} · ` : ''}
              {formatRelative(req.createdAt || req.updatedAt)}
            </p>
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadgeClasses(req.status)}`}
          >
            {STATUS_LABELS[req.status]}
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
          {req.customerName && (
            <div>
              <p className="text-gray-400 uppercase text-[10px] font-semibold">Customer</p>
              <p className="text-gray-800 font-medium truncate">{req.customerName}</p>
            </div>
          )}
          {req.customerPhone && (
            <div>
              <p className="text-gray-400 uppercase text-[10px] font-semibold">Phone</p>
              <p className="text-gray-800 font-medium truncate">{req.customerPhone}</p>
            </div>
          )}
          {vehicleText && (
            <div className="col-span-2">
              <p className="text-gray-400 uppercase text-[10px] font-semibold">Vehicle</p>
              <p className="text-gray-800 font-medium truncate">{vehicleText}</p>
            </div>
          )}
          {req.city && (
            <div>
              <p className="text-gray-400 uppercase text-[10px] font-semibold">City</p>
              <p className="text-gray-800 font-medium truncate">{req.city}</p>
            </div>
          )}
          {req.scheduledAt && (
            <div>
              <p className="text-gray-400 uppercase text-[10px] font-semibold">Scheduled</p>
              <p className="text-gray-800 font-medium truncate">{formatDateTime(req.scheduledAt)}</p>
            </div>
          )}
          {req.addressLine && (
            <div className="col-span-2">
              <p className="text-gray-400 uppercase text-[10px] font-semibold">Address</p>
              <p className="text-gray-800 font-medium truncate">
                {req.addressLine}
                {req.pincode ? ` · ${req.pincode}` : ''}
              </p>
            </div>
          )}
        </div>

        {lineItems.length > 0 && (
          <div className="mt-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-indigo-700">Packages</p>
            <ul className="mt-1 space-y-0.5">
              {lineItems.slice(0, 4).map((line) => {
                const qty = line.quantity && line.quantity > 0 ? line.quantity : 1;
                return (
                  <li
                    key={`${line.id}-${line.name}`}
                    className="flex justify-between text-[12px] text-gray-800"
                  >
                    <span className="truncate pr-2">{line.name?.trim() || line.id}</span>
                    <span className="text-gray-500 tabular-nums shrink-0">×{qty}</span>
                  </li>
                );
              })}
              {lineItems.length > 4 && (
                <li className="text-[11px] text-gray-500">+{lineItems.length - 4} more</li>
              )}
            </ul>
            {finalAmount != null && (
              <p className="mt-1.5 text-right text-[12px] font-semibold text-indigo-700">
                Total: ₹{finalAmount.toLocaleString('en-IN')}
              </p>
            )}
          </div>
        )}

        {req.notes && (
          <p className="mt-2 text-[12px] text-gray-600 italic line-clamp-3">"{req.notes}"</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {isOpenPool ? (
            <button
              type="button"
              onClick={() => claimRequest(req.id)}
              disabled={claimingId === req.id}
              className="flex-1 min-w-[120px] rounded-xl bg-blue-600 text-white text-sm font-semibold py-2.5 active:scale-[0.98] disabled:opacity-60 transition"
            >
              {claimingId === req.id ? 'Claiming…' : 'Claim job'}
            </button>
          ) : (
            <>
              {!isLocked && nextPrimary && (
                <button
                  type="button"
                  onClick={() => updateStatus(req.id, nextPrimary)}
                  disabled={updatingId === req.id}
                  className="flex-1 min-w-[110px] rounded-xl bg-blue-600 text-white text-sm font-semibold py-2.5 disabled:opacity-60 active:scale-[0.98]"
                >
                  {updatingId === req.id
                    ? 'Updating…'
                    : primaryAdvanceButtonLabel(req.status as RequestStatus) ?? 'Continue'}
                </button>
              )}
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => updateStatus(req.id, 'cancelled')}
                  disabled={updatingId === req.id}
                  className="rounded-xl border border-red-200 text-red-700 bg-red-50 text-sm font-semibold px-3 py-2.5 disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
              {req.status === 'cancelled' && (
                <button
                  type="button"
                  onClick={() => deleteRequest(req.id)}
                  disabled={deletingId === req.id}
                  className="rounded-xl border border-gray-200 text-gray-700 bg-white text-sm font-semibold px-3 py-2.5 disabled:opacity-60"
                >
                  {deletingId === req.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </>
          )}
          {phoneHref && (
            <a
              href={phoneHref}
              className="rounded-xl border border-gray-200 text-gray-700 bg-white text-sm font-semibold px-3 py-2.5 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.7 2.804a2 2 0 01-.45 1.95l-1.2 1.2a16 16 0 006.586 6.586l1.2-1.2a2 2 0 011.95-.45l2.804.7A2 2 0 0121 18.72V21a2 2 0 01-2 2A18 18 0 013 5z" />
              </svg>
              Call
            </a>
          )}
        </div>
      </div>
    );
  };

  /* ----- Tabs render ----- */
  const renderOverview = () => (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white p-4 shadow-md">
        <p className="text-xs uppercase tracking-wider opacity-80">Welcome back</p>
        <h2 className="text-lg font-extrabold leading-tight mt-0.5">{localProvider?.name || 'Service Provider'}</h2>
        <div className="mt-1.5 flex items-center gap-2 text-xs opacity-90 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {localProvider?.city?.trim() || 'City pending'}
          </span>
          {localProvider?.availability && (
            <>
              <span className="opacity-60">·</span>
              <span>{localProvider.availability}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Open pool" value={stats.open} tone="amber" />
        <StatCard label="Accepted" value={stats.accepted} tone="blue" />
        <StatCard label="In progress" value={stats.inProgress} tone="indigo" />
        <StatCard label="Completed" value={stats.completed} tone="green" />
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Quick actions</h3>
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading || openLoading || servicesLoading}
            className="text-[12px] font-semibold text-blue-600 disabled:opacity-50"
          >
            {loading || openLoading || servicesLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className="rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold py-3"
          >
            View open pool ({stats.open})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className="rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold py-3"
          >
            My active jobs ({stats.accepted + stats.inProgress})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('services');
              openServiceEditor({ mode: 'create' });
            }}
            className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold py-3"
          >
            + Add a service
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setProfileEditorOpen(true);
            }}
            className="rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold py-3"
          >
            Edit profile
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Recent activity</h3>
        <ul className="mt-3 divide-y divide-gray-100">
          {requests.slice(0, 4).map((r) => (
            <li key={r.id} className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{r.title || r.serviceType || 'Request'}</p>
                <p className="text-[12px] text-gray-500">{formatRelative(r.updatedAt || r.createdAt)}</p>
              </div>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClasses(r.status)}`}
              >
                {STATUS_LABELS[r.status]}
              </span>
            </li>
          ))}
          {requests.length === 0 && (
            <li className="py-3 text-center text-sm text-gray-500">No activity yet.</li>
          )}
        </ul>
      </div>
    </div>
  );

  const renderOpenPool = () => (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white border border-gray-200 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={openCity}
            onChange={(e) => setOpenCity(e.target.value)}
            placeholder="Filter by city"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={fetchOpenRequests}
            disabled={openLoading}
            className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-3 py-2 disabled:opacity-60"
          >
            {openLoading ? '…' : 'Go'}
          </button>
        </div>
        <div className="mt-2 -mx-1 px-1 flex gap-1.5 overflow-x-auto no-scrollbar">
          {(['all', ...CAR_SERVICE_OPTIONS] as const).map((opt) => {
            const isActive = openServiceType === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setOpenServiceType(opt)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
                  isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {opt === 'all' ? 'All services' : opt}
              </button>
            );
          })}
        </div>
      </div>

      {openLoading && sortedOpen.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center text-sm text-gray-500">
          Loading open requests…
        </div>
      ) : sortedOpen.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center">
          <p className="text-sm font-semibold text-gray-700">No open requests right now</p>
          <p className="mt-1 text-[12px] text-gray-500">
            Pull to refresh or expand your service categories to receive more matches.
          </p>
        </div>
      ) : (
        sortedOpen.map((r) => <RequestCard key={r.id} req={r} isOpenPool />)
      )}
    </div>
  );

  const renderMyJobs = () => (
    <div className="space-y-3">
      <div className="-mx-1 px-1 flex gap-1.5 overflow-x-auto no-scrollbar">
        {(['all', 'accepted', 'in_progress', 'completed', 'cancelled'] as const).map((status) => {
          const isActive = statusFilter === status;
          const label =
            status === 'all'
              ? `All (${stats.total})`
              : `${STATUS_LABELS[status as RequestStatus]} (${
                  status === 'accepted'
                    ? stats.accepted
                    : status === 'in_progress'
                      ? stats.inProgress
                      : status === 'completed'
                        ? stats.completed
                        : stats.cancelled
                })`;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
                isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading && filteredMine.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center text-sm text-gray-500">
          Loading your jobs…
        </div>
      ) : filteredMine.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center">
          <p className="text-sm font-semibold text-gray-700">No jobs in this list</p>
          <p className="mt-1 text-[12px] text-gray-500">Claim a request from the Open Pool to get started.</p>
          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className="mt-3 inline-flex justify-center rounded-xl bg-blue-600 text-white text-sm font-semibold px-4 py-2"
          >
            Browse open pool
          </button>
        </div>
      ) : (
        filteredMine.map((r) => <RequestCard key={r.id} req={r} />)
      )}
    </div>
  );

  const renderServices = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">My services ({providerServices.length})</h3>
        <button
          type="button"
          onClick={() => openServiceEditor({ mode: 'create' })}
          className="rounded-xl bg-blue-600 text-white text-sm font-semibold px-3 py-2"
        >
          + Add
        </button>
      </div>

      {servicesLoading && providerServices.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center text-sm text-gray-500">
          Loading services…
        </div>
      ) : providerServices.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center">
          <p className="text-sm font-semibold text-gray-700">No services yet</p>
          <p className="mt-1 text-[12px] text-gray-500">
            Add your first service to start receiving matched requests.
          </p>
          <button
            type="button"
            onClick={() => openServiceEditor({ mode: 'create' })}
            className="mt-3 inline-flex justify-center rounded-xl bg-blue-600 text-white text-sm font-semibold px-4 py-2"
          >
            Add a service
          </button>
        </div>
      ) : (
        providerServices.map((svc) => (
          <div
            key={svc.serviceType}
            className="rounded-2xl bg-white border border-gray-200 p-3.5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-gray-900 truncate">{svc.serviceType}</h4>
                <p className="mt-0.5 text-[12px] text-gray-500 line-clamp-2">
                  {svc.description || 'No description'}
                </p>
              </div>
              <label className="inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={svc.active !== false}
                  onChange={(e) => toggleServiceActive(svc.serviceType, e.target.checked)}
                  disabled={savingService}
                />
                <span className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[12px] text-gray-700">
              <span className="font-semibold">
                {svc.price != null ? `₹${svc.price.toLocaleString('en-IN')}` : '— price'}
              </span>
              <span className="text-gray-400">·</span>
              <span>
                {svc.etaMinutes != null && svc.etaMinutes > 0
                  ? `~${svc.etaMinutes} min`
                  : 'ETA not set'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-600">
              {svc.includedServices && svc.includedServices.length > 0 ? (
                (() => {
                  const actives = svc.includedServices.filter((line) => line.active !== false);
                  const priced = actives.filter(
                    (line) =>
                      line.price != null && Number.isFinite(line.price) && (line.price as number) > 0,
                  ).length;
                  return (
                    <>
                      Sub-services: <span className="font-medium text-gray-800">{actives.length}</span> active ·{' '}
                      <span className="font-medium text-gray-800">{priced}</span> priced
                    </>
                  );
                })()
              ) : (
                <span className="text-gray-500">Sub-services: not configured (tap Edit to add)</span>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => openServiceEditor({ mode: 'edit', row: svc })}
                className="flex-1 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold py-2"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteService(svc.serviceType)}
                disabled={savingService}
                className="rounded-xl border border-red-200 text-red-700 bg-red-50 text-sm font-semibold px-3 py-2 disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900 truncate">{localProvider?.name}</h3>
            <p className="text-[12px] text-gray-500 truncate">{localProvider?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => setProfileEditorOpen(true)}
            className="rounded-xl bg-blue-600 text-white text-sm font-semibold px-3 py-2 shrink-0"
          >
            Edit
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
          <div>
            <dt className="text-gray-400 uppercase text-[10px] font-semibold">Phone</dt>
            <dd className="text-gray-800 font-medium">{localProvider?.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400 uppercase text-[10px] font-semibold">City</dt>
            <dd className="text-gray-800 font-medium">{localProvider?.city || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400 uppercase text-[10px] font-semibold">State</dt>
            <dd className="text-gray-800 font-medium">{localProvider?.state || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400 uppercase text-[10px] font-semibold">Availability</dt>
            <dd className="text-gray-800 font-medium">{localProvider?.availability || '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-400 uppercase text-[10px] font-semibold">Workshops</dt>
            <dd className="text-gray-800 font-medium">
              {localProvider?.workshops?.length ? localProvider.workshops.join(', ') : '—'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-400 uppercase text-[10px] font-semibold">Skills</dt>
            <dd className="text-gray-800 font-medium">
              {localProvider?.skills?.length ? localProvider.skills.join(', ') : '—'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-400 uppercase text-[10px] font-semibold">Categories</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {(localProvider?.serviceCategories || []).length === 0 && (
                <span className="text-gray-500">—</span>
              )}
              {(localProvider?.serviceCategories || []).map((cat) => (
                <span
                  key={cat}
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {cat}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      {onLogout && (
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem('reRideServiceProvider');
            } catch {
              // ignore
            }
            onLogout();
          }}
          className="w-full rounded-xl border border-red-200 text-red-700 bg-red-50 text-sm font-semibold py-3"
        >
          Log out
        </button>
      )}
    </div>
  );

  return (
    <div className="px-3 py-3 pb-24 max-w-3xl mx-auto">
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-10 -mx-3 px-3 py-2 bg-gradient-to-b from-gray-50 via-gray-50/95 to-gray-50/80 backdrop-blur-md mb-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {TAB_ORDER.map((t) => {
            const isActive = activeTab === t.id;
            const badge =
              t.id === 'open' && stats.open > 0
                ? stats.open
                : t.id === 'mine' && stats.total > 0
                  ? stats.total
                  : null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {t.label}
                {badge != null && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-extrabold px-1 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {(error || info) && (
        <div className="mb-3">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 flex items-start justify-between gap-2">
              <span className="leading-snug">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}
          {info && !error && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
              {info}
            </div>
          )}
        </div>
      )}

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'open' && renderOpenPool()}
      {activeTab === 'mine' && renderMyJobs()}
      {activeTab === 'services' && renderServices()}
      {activeTab === 'profile' && renderProfile()}

      {/* Service editor sheet */}
      {editorOpen && (
        <ServiceEditorSheet
          key={serviceEditorKey}
          mode={editorOpen.mode}
          row={editorOpen.row}
          saving={savingService}
          onClose={closeServiceEditor}
          onSubmit={upsertService}
        />
      )}

      {/* Profile editor sheet */}
      {profileEditorOpen && (
        <ProfileEditorSheet
          form={profileForm}
          setForm={setProfileForm}
          saving={savingProfile}
          onClose={() => setProfileEditorOpen(false)}
          onSubmit={saveProfile}
        />
      )}
    </div>
  );
};

/* ===== Service editor bottom sheet ===== */

interface ServiceEditorProps {
  mode: 'create' | 'edit';
  row?: ProviderServiceRow;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    serviceType: string;
    price?: number;
    etaMinutes?: number;
    description?: string;
    active: boolean;
    includedServices: IncludedServicePrice[];
  }) => void;
}

const ServiceEditorSheet: React.FC<ServiceEditorProps> = ({ mode, row, saving, onClose, onSubmit }) => {
  const initialType = row?.serviceType || CAR_SERVICE_OPTIONS[0];
  const initialUnit = pickEtaUnit(row?.etaMinutes);

  const [serviceType, setServiceType] = useState<string>(initialType);
  const [price, setPrice] = useState<string>(row?.price != null ? String(row.price) : '');
  const [etaMinutes, setEtaMinutes] = useState<string>(
    row?.etaMinutes != null ? String(etaValueInUnit(row.etaMinutes, initialUnit)) : '',
  );
  const [etaUnit, setEtaUnit] = useState<EtaUnit>(initialUnit);
  const [description, setDescription] = useState<string>(row?.description || '');
  const [active, setActive] = useState<boolean>(row?.active !== false);
  const [includedDrafts, setIncludedDrafts] = useState<IncludedServiceDraft[]>(() =>
    buildDraftsForServiceType(initialType, row?.includedServices),
  );

  const subServiceTotal = useMemo(
    () =>
      includedDrafts.reduce((sum, d) => {
        if (!d.active) return sum;
        const n = Number(d.priceText);
        return Number.isFinite(n) && n > 0 ? sum + n : sum;
      }, 0),
    [includedDrafts],
  );

  const updateSub = (idx: number, patch: Partial<IncludedServiceDraft>) => {
    setIncludedDrafts((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };
  const removeSub = (idx: number) => {
    setIncludedDrafts((prev) => {
      const next = prev.slice();
      next.splice(idx, 1);
      return next;
    });
  };
  const addCustom = () => {
    setIncludedDrafts((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: '',
        priceText: '',
        etaText: '',
        etaUnit: 'min',
        active: true,
      },
    ]);
  };
  const toggleAll = (v: boolean) => {
    setIncludedDrafts((prev) => prev.map((d) => ({ ...d, active: v })));
  };

  const onServiceTypeChange = (name: string) => {
    setServiceType(name);
    const tmpl = SERVICE_TEMPLATE_PRESETS[name];
    if (tmpl) {
      if (!price) setPrice(tmpl.price);
      if (!etaMinutes && tmpl.etaMinutes) {
        const etaMin = Number(tmpl.etaMinutes);
        if (Number.isFinite(etaMin)) {
          const u = pickEtaUnit(etaMin);
          setEtaUnit(u);
          setEtaMinutes(String(etaValueInUnit(etaMin, u)));
        }
      }
      if (!description) setDescription(tmpl.description);
    }
    if (mode === 'create') {
      setIncludedDrafts((prev) => rebuildSubServicesForNewType(name, prev));
    }
  };

  const applySubTotalAsBase = () => {
    if (subServiceTotal <= 0) return;
    setPrice(String(subServiceTotal));
  };

  const handleSubmit = () => {
    const etaRaw = etaMinutes ? Number(etaMinutes) : undefined;
    const etaM =
      etaRaw != null && Number.isFinite(etaRaw) && etaRaw >= 0
        ? etaToMinutes(etaRaw, etaUnit)
        : undefined;
    onSubmit({
      serviceType,
      price: price ? Number(price) : undefined,
      etaMinutes: etaM,
      description: description.trim(),
      active,
      includedServices: includedDraftsToPayload(includedDrafts),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[min(92vh,900px)] flex flex-col">
        <div className="shrink-0 border-b border-gray-100 px-4 py-3 flex items-center justify-between bg-white rounded-t-2xl">
          <h3 className="text-base font-bold text-gray-900">
            {mode === 'edit' ? 'Edit service' : 'Add service'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-500 text-sm font-semibold">
            Cancel
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">Service</label>
            <select
              value={serviceType}
              onChange={(e) => onServiceTypeChange(e.target.value)}
              disabled={mode === 'edit'}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50"
            >
              {CAR_SERVICE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">Full service price (₹)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                min={0}
                placeholder="0"
                className="w-full min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none tabular-nums"
              />
              {subServiceTotal > 0 && (
                <button
                  type="button"
                  onClick={applySubTotalAsBase}
                  className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-blue-700 whitespace-nowrap"
                >
                  Use ₹{subServiceTotal.toLocaleString('en-IN')}
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">Charged when a customer books the full bundle.</p>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">ETA</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(e.target.value)}
                min={0}
                step="any"
                inputMode="decimal"
                placeholder={etaUnit === 'day' ? '1' : etaUnit === 'hr' ? '2' : '120'}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none tabular-nums"
              />
              <select
                value={etaUnit}
                onChange={(e) => setEtaUnit(e.target.value as EtaUnit)}
                className="shrink-0 px-2 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                aria-label="ETA unit"
              >
                <option value="min">min</option>
                <option value="hr">hr</option>
                <option value="day">days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What's included, how you work, etc."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/80">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[12px] font-semibold text-gray-800">Sub-services &amp; per-item pricing</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Set a price for each sub-task. Customers can book the full service or only what they need.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={() => toggleAll(true)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-800"
                >
                  Enable all
                </button>
                <button
                  type="button"
                  onClick={() => toggleAll(false)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-800"
                >
                  Disable all
                </button>
                <button
                  type="button"
                  onClick={addCustom}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-blue-700"
                >
                  + Add custom
                </button>
              </div>
            </div>

            {includedDrafts.length === 0 ? (
              <p className="mt-3 text-center text-xs text-gray-500 py-4 border border-dashed border-gray-300 rounded-lg bg-white">
                No sub-services. Tap &ldquo;+ Add custom&rdquo; to add one.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {includedDrafts.map((draft, idx) => (
                  <li
                    key={draft.id || `sub-${idx}`}
                    className={`rounded-xl border p-2.5 bg-white ${draft.active ? '' : 'opacity-60'}`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) => updateSub(idx, { active: e.target.checked })}
                        className="h-5 w-5 mt-0.5 rounded border-gray-300 text-blue-600"
                        style={{ accentColor: '#2563EB' }}
                        title={draft.active ? 'On — visible' : 'Off — hidden'}
                      />
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => updateSub(idx, { name: e.target.value })}
                        placeholder="Sub-service name"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm"
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">Price (₹)</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.priceText}
                          onChange={(e) => updateSub(idx, { priceText: e.target.value })}
                          inputMode="decimal"
                          placeholder="0"
                          className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">ETA</span>
                        <div className="mt-0.5 flex gap-1">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={draft.etaText}
                            onChange={(e) => updateSub(idx, { etaText: e.target.value })}
                            inputMode="decimal"
                            placeholder={draft.etaUnit === 'day' ? '1' : draft.etaUnit === 'hr' ? '2' : '30'}
                            className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm tabular-nums"
                          />
                          <select
                            value={draft.etaUnit || 'min'}
                            onChange={(e) => updateSub(idx, { etaUnit: e.target.value as EtaUnit })}
                            className="shrink-0 max-w-[4.5rem] px-1 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                            aria-label="Sub-service ETA unit"
                          >
                            <option value="min">min</option>
                            <option value="hr">hr</option>
                            <option value="day">day</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeSub(idx)}
                        className="text-xs font-semibold text-red-600 py-1 px-2 -mr-2"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {subServiceTotal > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-100 px-2.5 py-2 text-xs text-gray-800">
                <span>Sum of active sub-service prices</span>
                <span className="font-semibold tabular-nums">₹{subServiceTotal.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 bg-white">
            <span className="text-sm font-semibold text-gray-800">Active (visible to customers)</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-5 w-5"
              style={{ accentColor: '#2563EB' }}
            />
          </label>
        </div>

        <div className="shrink-0 border-t border-gray-100 p-3 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !serviceType}
            className="w-full rounded-xl bg-blue-600 text-white text-sm font-bold py-3 disabled:opacity-60 active:scale-[0.98]"
          >
            {saving ? 'Saving…' : mode === 'edit' ? 'Update service' : 'Save service'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===== Profile editor bottom sheet ===== */

interface ProfileFormState {
  name: string;
  phone: string;
  city: string;
  state: string;
  district: string;
  availability: string;
  skills: string;
  workshops: string;
  serviceCategories: ServiceCategory[];
}

interface ProfileEditorProps {
  form: ProfileFormState;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const ProfileEditorSheet: React.FC<ProfileEditorProps> = ({
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}) => {
  const toggleCategory = (cat: ServiceCategory) => {
    setForm((prev) => {
      const has = prev.serviceCategories.includes(cat);
      return {
        ...prev,
        serviceCategories: has
          ? prev.serviceCategories.filter((c) => c !== cat)
          : [...prev.serviceCategories, cat],
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Edit profile</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Name">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label="District">
              <input
                type="text"
                value={form.district}
                onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
          </div>
          <Field label="Availability">
            <input
              type="text"
              value={form.availability}
              onChange={(e) => setForm((p) => ({ ...p, availability: e.target.value }))}
              placeholder="weekdays / weekends / 24x7"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Workshops (comma separated)">
            <input
              type="text"
              value={form.workshops}
              onChange={(e) => setForm((p) => ({ ...p, workshops: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Skills (comma separated)">
            <input
              type="text"
              value={form.skills}
              onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </Field>
          <div>
            <p className="text-[12px] font-semibold text-gray-700">Service categories</p>
            <p className="text-[11px] text-gray-500 mt-0.5 mb-1.5">
              Tap a card to turn that group on or off. Each group unlocks the service types listed under it; you set
              exact prices in Services.
            </p>
            <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[10px] text-gray-600">
              <p className="font-semibold text-gray-800">What this means</p>
              <p className="mt-0.5 leading-relaxed">
                Categories are <span className="text-gray-800">buckets</span>, not the long checklist on Services &
                Pricing. The Services tab has one dropdown per <span className="text-gray-800">main service</span> (e.g.
                Periodic Services) and checkboxes for <span className="text-gray-800">sub-tasks</span> (e.g. oil change)
                under that main service.
              </p>
            </div>
            <div className="space-y-2">
              {SERVICE_CATEGORIES.map((cat) => {
                const active = form.serviceCategories.includes(cat);
                const includes = (SERVICE_CATEGORY_MAP[cat] || []).join(' · ');
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`w-full text-left rounded-xl border p-2.5 transition ${
                      active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white active:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
                          active ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                        }`}
                        aria-hidden
                      >
                        {active ? (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[12px] font-semibold ${active ? 'text-blue-900' : 'text-gray-900'}`}>{cat}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5 leading-relaxed">
                          {SERVICE_CATEGORY_DESCRIPTIONS[cat]}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          <span className="font-medium text-gray-600">Types: </span>
                          {includes}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 text-white text-sm font-bold py-3 disabled:opacity-60 active:scale-[0.98]"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[12px] font-semibold text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

export default MobileCarServiceDashboard;

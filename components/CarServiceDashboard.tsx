import React, { useEffect, useMemo, useState } from 'react';
import { getSession } from '../services/supabase-auth-service';

type ServiceCategory = 'Essential Service' | 'Deep Detailing' | 'Care Plus';

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

// Service category mapping
const SERVICE_CATEGORY_MAP: Record<ServiceCategory, string[]> = {
  'Essential Service': ['Periodic Service', 'Engine & Transmission', 'General'],
  'Deep Detailing': ['Detailing & Cleaning', 'Body Work & Paint'],
  'Care Plus': ['Brakes & Suspension', 'Tyres & Alignment', 'Electrical & Battery'],
};

const SERVICE_CATEGORIES: ServiceCategory[] = ['Essential Service', 'Deep Detailing', 'Care Plus'];

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
  const [editingCategories, setEditingCategories] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [workshopsInput, setWorkshopsInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<ServiceCategory[]>(provider?.serviceCategories || []);
  const [savingProfile, setSavingProfile] = useState(false);
  const [localProvider, setLocalProvider] = useState<Provider | null>(provider);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'services' | 'open' | 'my-requests'>(() => {
    // Check sessionStorage for desired tab (set from header dropdown)
    const savedTab = sessionStorage.getItem('serviceProviderActiveTab');
    if (savedTab && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(savedTab)) {
      sessionStorage.removeItem('serviceProviderActiveTab'); // Clear after reading
      return savedTab as 'overview' | 'profile' | 'services' | 'open' | 'my-requests';
    }
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
    const base = 'px-3 py-1.5 rounded-full text-xs font-bold border-2 shadow-sm';
    if (status === 'open') return `${base} bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border-amber-300`;
    if (status === 'accepted') return `${base} bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-300`;
    if (status === 'in_progress') return `${base} bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-800 border-indigo-300`;
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
      setServiceForm({
        serviceType: serviceOptions[0],
        price: '',
        description: '',
        etaMinutes: '',
        active: true,
      });
      
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
      const savedTab = sessionStorage.getItem('serviceProviderActiveTab');
      if (savedTab && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(savedTab)) {
        setActiveTab(savedTab as 'overview' | 'profile' | 'services' | 'open' | 'my-requests');
        sessionStorage.removeItem('serviceProviderActiveTab');
      }
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
      setLocalProvider({ ...localProvider, ...updated });
      setEditingProfile(false);
      
      // Dispatch event to notify admin panel and other components
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: localProvider?.email || localProvider?.name, profile: updated }
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
          setLocalProvider({ ...refreshed, ...updated });
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
        body: JSON.stringify({ skills: skillsArray }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update skills');
      }
      const updated = await resp.json();
      setLocalProvider({ ...localProvider, skills: skillsArray });
      setEditingSkills(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: localProvider?.email || localProvider?.name, profile: updated }
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
        body: JSON.stringify({ workshops: workshopsArray }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update workshops');
      }
      const updated = await resp.json();
      setLocalProvider({ ...localProvider, workshops: workshopsArray });
      setEditingWorkshops(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: localProvider?.email || localProvider?.name, profile: updated }
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
        body: JSON.stringify({ serviceCategories: selectedCategories }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update service categories');
      }
      const updated = await resp.json();
      setLocalProvider({ ...localProvider, serviceCategories: selectedCategories });
      setEditingCategories(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: localProvider?.email || localProvider?.name, profile: updated }
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
                  {provider.city}
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
                    <p className="text-xl font-bold text-gray-900 mb-1">{provider.availability || 'Not set'}</p>
                    <p className="text-xs text-gray-500">Preferred working days/hours</p>
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
                )}
              </div>
              {editingCategories ? (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-lg">
                  <p className="text-sm text-gray-600 mb-3">Select the service categories you provide:</p>
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
                          {isSelected ? `Includes: ${categoryServices.join(', ')}` : 'Not selected'}
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
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="group bg-gradient-to-br from-white via-blue-50/50 to-white border-2 border-blue-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:border-blue-400">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">My Requests</p>
                    <p className="text-3xl font-extrabold text-gray-900">{stats.total}</p>
                  </div>
                  <div className="group bg-gradient-to-br from-white via-amber-50/50 to-white border-2 border-amber-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:border-amber-400">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Open (pool)</p>
                    <p className="text-3xl font-extrabold text-amber-700">{stats.open}</p>
                  </div>
                  <div className="group bg-gradient-to-br from-white via-blue-50/50 to-white border-2 border-blue-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:border-blue-400">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Accepted</p>
                    <p className="text-3xl font-extrabold text-blue-700">{stats.accepted}</p>
                  </div>
                  <div className="group bg-gradient-to-br from-white via-emerald-50/50 to-white border-2 border-emerald-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:border-emerald-400">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Completed</p>
                    <p className="text-3xl font-extrabold text-emerald-700">{stats.completed}</p>
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
                  <p className="text-sm text-gray-600 mt-1">Control which services you offer and their price.</p>
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
            <div className="flex justify-end">
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
                    Save Service
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Service</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Price</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">ETA</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Description</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Active</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {servicesLoading ? (
                  <tr>
                    <td className="py-8 px-4 text-center text-gray-500" colSpan={5}>
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      Loading services...
                      </div>
                    </td>
                  </tr>
                ) : providerServices.length === 0 ? (
                  <tr>
                    <td className="py-12 px-4 text-center" colSpan={5}>
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
                  providerServices.map((svc) => (
                    <tr key={svc.serviceType} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">{svc.serviceType}</td>
                      <td className="py-3 px-4 text-gray-800 font-medium">{svc.price !== undefined ? `₹${svc.price.toLocaleString()}` : '-'}</td>
                      <td className="py-3 px-4 text-gray-800">{svc.etaMinutes ? `${svc.etaMinutes} min` : '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{svc.description || '-'}</td>
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
            ) : openRequests.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-amber-50/30 rounded-xl border-2 border-dashed border-gray-300">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-700 font-semibold mb-1">No open requests right now.</p>
                  <p className="text-sm text-gray-500 mb-4">Check back later for new service requests.</p>
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
            ) : (
              openRequests.map((req) => (
                <div key={req.id} className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50/50 shadow-md hover:shadow-lg transition-all duration-300 hover:border-blue-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900">{req.title}</h3>
                        <span className={statusBadge(req.status)}>
                          {statusOptions.find((s) => s.value === req.status)?.label || req.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold border border-blue-200">
                          {req.serviceType || 'General'}
                        </span>
                        {req.vehicle && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {req.vehicle}
                          </span>
                        )}
                        {req.city && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {req.city}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {req.customerName && (
                          <p className="text-sm text-gray-700 flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-medium">{req.customerName}</span>
                            {req.customerPhone && <span className="text-gray-500">• {req.customerPhone}</span>}
                            {req.customerEmail && <span className="text-gray-500">• {req.customerEmail}</span>}
                          </p>
                        )}
                      {req.addressLine && (
                          <p className="text-xs text-gray-600 flex items-start gap-2">
                            <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{req.addressLine}{req.pincode ? `, ${req.pincode}` : ''}</span>
                          </p>
                        )}
                        {req.carDetails && (
                          <p className="text-xs text-gray-600 flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Vehicle: {req.carDetails}
                          </p>
                        )}
                      {req.scheduledAt && (
                          <p className="text-xs text-gray-600 flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Scheduled: {formatDateTime(req.scheduledAt)}
                          </p>
                        )}
                        {req.notes && (
                          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-800 font-medium flex items-start gap-2">
                              <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Notes: {req.notes}</span>
                            </p>
                    </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => claimRequest(req.id)}
                        disabled={claimingId === req.id}
                        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
                      >
                        {claimingId === req.id ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Claiming...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Claim
                          </>
                        )}
                      </button>
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
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
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
            <div className="flex gap-2 flex-wrap">
              {(['all', 'accepted', 'in_progress', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all duration-300 ${
                    statusFilter === status
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-600 text-white shadow-md'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
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
                  <p className="text-gray-700 font-semibold mb-1">No requests yet.</p>
                  <p className="text-sm text-gray-500 mb-4">Start by claiming requests from the open pool.</p>
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
                <div key={req.id} className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50/50 shadow-md hover:shadow-lg transition-all duration-300 hover:border-blue-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900">{req.title}</h3>
                        <span className={statusBadge(req.status)}>
                          {statusOptions.find((s) => s.value === req.status)?.label || req.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold border border-blue-200">
                          {req.serviceType || 'General'}
                        </span>
                        {req.vehicle && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {req.vehicle}
                          </span>
                        )}
                        {req.city && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {req.city}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {req.customerName && (
                          <p className="text-sm text-gray-700 flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-medium">{req.customerName}</span>
                            {req.customerPhone && <span className="text-gray-500">• {req.customerPhone}</span>}
                          </p>
                        )}
                      {req.scheduledAt && (
                          <p className="text-xs text-gray-600 flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Scheduled: {formatDateTime(req.scheduledAt)}
                          </p>
                        )}
                        {req.notes && (
                          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-800 font-medium flex items-start gap-2">
                              <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Notes: {req.notes}</span>
                            </p>
                    </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <select
                        value={req.status}
                        onChange={(e) => updateStatus(req.id, e.target.value as RequestStatus)}
                        className="text-sm border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-semibold shadow-sm hover:shadow-md transition-all"
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
          )}
        </div>
      </main>
    </div>
  );
};

export default CarServiceDashboard;



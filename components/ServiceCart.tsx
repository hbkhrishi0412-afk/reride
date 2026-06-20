import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from 'react';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import { getSupabaseClient } from '../lib/supabase';
import {
    buildServiceBookingConfirmationMessage,
    supportWhatsAppHref,
    PLATFORM_SUPPORT_PHONE_E164,
} from '../utils/whatsappShare.js';
import { CAR_SERVICE_OPTIONS } from '../constants/serviceProviderCatalog.js';
import { useIsMobileApp } from '../hooks/useIsMobileApp';
import { useVisualViewportBottomInset } from '../hooks/useVisualViewportBottomInset';

type ServicePackage = {
    id: string;
    name: string;
    price: number;
    warrantyMonths: number;
    description?: string;
    isCustom?: boolean;
    parentServiceType?: string;
    includedServiceId?: string;
};

type CartItem = {
    serviceId: string;
    quantity: number;
};

type CarDetails = {
    make: string;
    model: string;
    year: string;
    fuel: string;
    reg?: string;
    city?: string;
};

type Address = {
    id: string;
    label: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
};

type TimeSlot = {
    id: string;
    label: string;
};

type ServiceProvider = {
    id: string;
    name: string;
    city: string;
    distanceKm?: number;
    /** Aggregated workshop rating (1–5), when available */
    rating?: number | null;
    reviewCount?: number;
    completedJobs?: number;
    isVerified?: boolean;
    serviceCategories?: string[];
    services?: Array<{
        serviceType: string;
        price?: number;
        description?: string;
        etaMinutes?: number;
        active?: boolean;
        includedServices?: Array<{
            id: string;
            name: string;
            price?: number;
            etaMinutes?: number;
            active?: boolean;
        }>;
    }>;
};

type Coupon = {
    code: string;
    label: string;
    amountOff: number;
};

type CustomerServiceRequest = {
    id: string;
    title: string;
    serviceType?: string;
    providerId?: string | null;
    status: 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
    city?: string;
    scheduledAt?: string;
    vehicle?: string;
    carDetails?: string;
    createdAt?: string;
    updatedAt?: string;
    claimedAt?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
    notes?: string;
    customerReview?: { stars: number; comment?: string; submittedAt: string };
};

type ProviderIncludedServiceApiRow = {
    id?: string;
    name?: string;
    price?: number;
    etaMinutes?: number;
    active?: boolean;
};

type ProviderServiceApiRow = {
    providerId?: string;
    serviceType?: string;
    price?: number;
    description?: string;
    etaMinutes?: number;
    active?: boolean;
    includedServices?: ProviderIncludedServiceApiRow[];
};

type ServiceCartPrefill = {
    serviceId?: string;
    serviceName?: string;
    price?: number;
    customQuote?: boolean;
    carDetails?: CarDetails;
    includedServices?: Array<{ id: string; name: string; price?: number }>;
};

const customerRequestVehicleLabel = (req: CustomerServiceRequest) => {
    const v = typeof req.vehicle === 'string' ? req.vehicle.trim() : '';
    const c = typeof req.carDetails === 'string' ? req.carDetails.trim() : '';
    return v || c;
};

type Props = {
    isLoggedIn: boolean;
    onLogin?: () => void;
    onSubmitRequest?: (payload: {
        items: Array<{ serviceId: string; quantity: number }>;
        addressId: string;
        address?: Address;
        slotId: string;
        /** Local calendar date for the visit (YYYY-MM-DD). */
        scheduledDate: string;
        /** Time window label only, e.g. "10:00 - 12:00". */
        slotTimeLabel: string;
        couponCode?: string;
        providerId: string;
        total: number;
        note?: string;
        carDetails?: { make: string; model: string; year: string; fuel: string; reg?: string; city?: string };
    }) => Promise<void> | void;
    // Optional: allow injecting real data
    servicePackages?: ServicePackage[];
    addresses?: Address[];
    timeSlots?: TimeSlot[];
    serviceProviders?: ServiceProvider[];
    coupons?: Coupon[];
    onUseMyLocation?: () => void;
    isLocating?: boolean;
    locationError?: string;
    /** When true, only the customer tracking UI is rendered (used inside Buyer Dashboard). */
    embedTrackOnly?: boolean;
    /** Initial tab when the component mounts (defaults to booking). */
    initialTab?: 'book' | 'track';
    /** Supabase auth user id — enables realtime sync of request status when the table is in Realtime publication. */
    customerUserId?: string | null;
};

const mockServicePackages: ServicePackage[] = [
    { id: 'pkg-comprehensive', name: 'Comprehensive Service Package', price: 6099, warrantyMonths: 3, description: '3 months warranty' },
    { id: 'pkg-standard', name: 'Standard Service Package', price: 2599, warrantyMonths: 3, description: '3 months warranty' },
    { id: 'pkg-care-plus', name: 'Care Plus', price: 0, warrantyMonths: 0, description: 'Custom quote', isCustom: true },
];

const mockAddresses: Address[] = [
    { id: 'addr-1', label: 'Home', line1: '221B Baker Street', city: 'London', state: 'LDN', pincode: 'NW16XE' },
    { id: 'addr-2', label: 'Office', line1: '100 Market Street', city: 'London', state: 'LDN', pincode: 'SW1A1AA' },
];

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const formatLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const tomorrowLocalYmd = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatLocalYmd(d);
};

const resolveStoredBookingDate = (raw: string | undefined) => {
    const today = formatLocalYmd(new Date());
    if (!raw || !YMD_RE.test(raw)) return tomorrowLocalYmd();
    if (raw < today) return today;
    return raw;
};

const mockSlots: TimeSlot[] = [
    { id: 'slot-0', label: '08:00 - 10:00' },
    { id: 'slot-1', label: '10:00 - 12:00' },
    { id: 'slot-2', label: '12:00 - 14:00' },
    { id: 'slot-3', label: '14:00 - 16:00' },
    { id: 'slot-4', label: '16:00 - 18:00' },
];

const defaultSlotIdForList = (slots: TimeSlot[]) =>
    slots.find(s => s.id === 'slot-1')?.id ?? slots[0]?.id ?? '';

const includedLinePackageId = (serviceType: string, includedId: string) =>
    `line-${serviceType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${includedId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const mockProviders: ServiceProvider[] = [
    { id: 'sp-1', name: 'City Auto Care', city: 'London', distanceKm: 4.2, rating: 4.7, reviewCount: 128, completedJobs: 340, isVerified: true },
    { id: 'sp-2', name: 'Prime Garage', city: 'London', distanceKm: 6.8, rating: 4.5, reviewCount: 86, completedJobs: 210, isVerified: true },
];

const mockCoupons: Coupon[] = [
    { code: 'SAVE200', label: 'Flat ₹200 off', amountOff: 200 },
    { code: 'SAVE10', label: '10% off up to ₹500', amountOff: 500 }, // capped; simplified as flat for mock
];

const SERVICE_PACKAGE_TO_CATEGORY: Record<string, string> = {
    'pkg-comprehensive': 'Essential Service',
    'pkg-standard': 'Deep Detailing',
    'pkg-care-plus': 'Care Plus',
};

/** Shared booking-flow surfaces — matches CarServices grid warmth */
const BOOKING_SURFACE =
    'rounded-[18px] bg-white dark:bg-slate-900/70 p-5 sm:p-6 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06]';
const BOOKING_OPTION_BASE =
    'w-full rounded-[16px] px-4 py-3.5 text-left transition-all duration-200 shadow-[0_4px_14px_-8px_rgba(15,23,42,0.15)] ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] hover:shadow-[0_12px_28px_-12px_rgba(79,70,229,0.28)] hover:ring-indigo-300/50';
const BOOKING_OPTION_SELECTED =
    'ring-2 ring-indigo-500/50 shadow-[0_16px_36px_-14px_rgba(79,70,229,0.4)] bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-white dark:from-indigo-950/40 dark:via-blue-950/20 dark:to-slate-900/60';
const STEP_BADGE =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-400 via-indigo-500 to-purple-600 text-white font-black text-sm shadow-lg shadow-indigo-500/30';
const STEP_BADGE_MUTED =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-black text-sm';
const BOOKING_INPUT =
    'w-full rounded-xl px-3.5 py-3 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all';

const FUEL_OPTIONS = ['Petrol', 'Diesel', 'CNG', 'EV'] as const;

const CART_KEY = 'service_cart_v1';
const REQUEST_STATUS_STYLES: Record<CustomerServiceRequest['status'], string> = {
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

/** Worst-case ETA across selected line items (parallel jobs at the workshop). */
function estimateBookingEtaMinutes(
    providerId: string,
    items: CartItem[],
    providerServices: Record<string, ServiceProvider['services']>,
    availableServicePackages: ServicePackage[],
): number | undefined {
    const services = providerServices[providerId] || [];
    const minutes: number[] = [];
    for (const item of items) {
        const svcMeta = availableServicePackages.find((s) => s.id === item.serviceId);
        const serviceName = svcMeta?.parentServiceType || svcMeta?.name || item.serviceId;
        const match = services.find((s) => s.serviceType === serviceName && s.active !== false);
        let eta = match?.etaMinutes;
        if (svcMeta?.includedServiceId) {
            eta = (match?.includedServices || []).find((line) => line.active !== false && String(line.id) === String(svcMeta.includedServiceId))?.etaMinutes;
        }
        if (eta != null && Number.isFinite(eta)) minutes.push(eta);
    }
    if (minutes.length === 0) return undefined;
    return Math.max(...minutes);
}

function parseSlotStartHour(slotLabel: string): number | null {
    const firstPart = slotLabel.split('-')[0]?.trim();
    const hour = Number((firstPart || '').split(':')[0]);
    if (!Number.isFinite(hour)) return null;
    return hour;
}

const getStepState = (req: CustomerServiceRequest, stepKey: (typeof TRACKING_STEPS)[number]['key']) => {
    if (req.status === 'cancelled') {
        return stepKey === 'raised' ? 'done' : 'cancelled';
    }
    switch (stepKey) {
        case 'raised':
            return 'done';
        case 'accepted':
            return req.status === 'accepted' || req.status === 'in_progress' || req.status === 'completed' ? 'done' : 'pending';
        case 'in_progress':
            return req.status === 'in_progress' || req.status === 'completed' ? 'done' : 'pending';
        case 'completed':
            return req.status === 'completed' ? 'done' : 'pending';
        default:
            return 'pending';
    }
};

const ServiceCart: React.FC<Props> = ({
    isLoggedIn,
    onLogin,
    onSubmitRequest,
    servicePackages = mockServicePackages,
    addresses: initialAddresses = mockAddresses,
    timeSlots = mockSlots,
    serviceProviders = mockProviders,
    coupons = mockCoupons,
    onUseMyLocation,
    isLocating = false,
    locationError,
    embedTrackOnly = false,
    initialTab = 'book',
    customerUserId = null,
}) => {
    const [activeTab, setActiveTab] = useState<'book' | 'track'>(initialTab);
    const [customerRequests, setCustomerRequests] = useState<CustomerServiceRequest[]>([]);
    const [providerNameById, setProviderNameById] = useState<Record<string, string>>({});
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [requestsError, setRequestsError] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
    const [postBookingWhatsAppUrl, setPostBookingWhatsAppUrl] = useState<string | null>(null);
    const [reviewDrafts, setReviewDrafts] = useState<Record<string, { stars: number; comment: string }>>({});
    const [reviewSubmittingId, setReviewSubmittingId] = useState<string | null>(null);
    const [items, setItems] = useState<CartItem[]>([]);
    const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
    const [selectedAddress, setSelectedAddress] = useState(addresses[0]?.id || '');
    const [selectedBookingDate, setSelectedBookingDate] = useState(() => tomorrowLocalYmd());
    const [scheduleError, setScheduleError] = useState('');
    const [selectedSlot, setSelectedSlot] = useState(() => defaultSlotIdForList(timeSlots));
    const minBookingDateYmd = formatLocalYmd(new Date());
    const [selectedCoupon, setSelectedCoupon] = useState<string | undefined>();
    const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
    const [providerServices, setProviderServices] = useState<Record<string, ServiceProvider['services']>>({});
    const [availableServicePackages, setAvailableServicePackages] = useState<ServicePackage[]>(servicePackages);
    const [activeServicePackageId, setActiveServicePackageId] = useState<string>('');
    const [hasExplicitServiceSelection, setHasExplicitServiceSelection] = useState(false);
    /** True after "Pick items" with no parent line yet — cart can be empty without collapsing the sub-service panel. */
    const [inSubPickMode, setInSubPickMode] = useState(false);
    const [extrasPanelOpen, setExtrasPanelOpen] = useState(false);
    const [showAllAddons, setShowAllAddons] = useState(false);
    const configureSectionRef = useRef<HTMLElement>(null);
    const { isMobileApp } = useIsMobileApp();
    const keyboardInset = useVisualViewportBottomInset();
    const mobileBottomNavOffset = isMobileApp
        ? 'calc(56px + env(safe-area-inset-bottom, 0px))'
        : '0px';

    const resolveItemUnitPrice = useCallback((item: CartItem, providerId?: string): number | undefined => {
        const svcMeta = availableServicePackages.find((s) => s.id === item.serviceId);
        if (!svcMeta) return undefined;
        if (!providerId) return svcMeta.price;
        const services = providerServices[providerId] || [];
        const serviceName = svcMeta.parentServiceType || svcMeta.name || item.serviceId;
        const match = services.find((s) => s.serviceType === serviceName && s.active !== false);
        if (!match) return svcMeta.price;
        if (svcMeta.includedServiceId) {
            const included = (match.includedServices || []).find((line) => {
                const lineId = String(line.id || '').trim();
                return line.active !== false && lineId === String(svcMeta.includedServiceId);
            });
            return included?.price ?? svcMeta.price;
        }
        return match.price ?? svcMeta.price;
    }, [availableServicePackages, providerServices]);

    useLayoutEffect(() => {
        setActiveTab(embedTrackOnly ? 'track' : initialTab);
    }, [embedTrackOnly, initialTab]);

    useEffect(() => {
        const fetchProviderServices = async () => {
            try {
                // Fetch provider services
                const servicesResp = await authenticatedFetch('/api/provider-services?scope=public', {
                    method: 'GET',
                    skipAuth: true,
                });
                
                if (!servicesResp.ok) return;
                const rawServicesData = await servicesResp.json();
                const servicesData: ProviderServiceApiRow[] = Array.isArray(rawServicesData) ? rawServicesData : [];
                const grouped: Record<string, ServiceProvider['services']> = {};
                servicesData.forEach((entry) => {
                    const pid = entry.providerId;
                    if (!pid || !entry.serviceType) return;
                    grouped[pid] = grouped[pid] || [];
                    grouped[pid].push({
                        serviceType: entry.serviceType,
                        price: entry.price,
                        description: entry.description,
                        etaMinutes: entry.etaMinutes,
                        active: entry.active !== false,
                        includedServices: Array.isArray(entry.includedServices)
                            ? entry.includedServices.map((line) => ({
                                id: String(line.id || line.name || ''),
                                name: line.name || String(line.id || ''),
                                price: line.price,
                                etaMinutes: line.etaMinutes,
                                active: line.active !== false,
                            }))
                            : [],
                    });
                });
                setProviderServices(grouped);
                
                // Build service packages from actual provider services
                const serviceTypeMap = new Map<string, { price?: number; description?: string; etaMinutes?: number; count: number }>();
                const includedLineMap = new Map<string, ServicePackage>();
                servicesData.forEach((entry) => {
                    if (!entry.serviceType || entry.active === false) return;
                    const serviceType = entry.serviceType;
                    const existing = serviceTypeMap.get(entry.serviceType) || { count: 0 };
                    serviceTypeMap.set(serviceType, {
                        price: existing.price === undefined ? entry.price : Math.min(existing.price || Infinity, entry.price || Infinity),
                        description: entry.description || existing.description,
                        etaMinutes: entry.etaMinutes || existing.etaMinutes,
                        count: existing.count + 1,
                    });
                    if (Array.isArray(entry.includedServices)) {
                        entry.includedServices.forEach((line) => {
                            if (!line || line.active === false || !line.name) return;
                            const includedId = String(line.id || line.name);
                            const key = `${serviceType}::${includedId}`;
                            const linePrice = typeof line.price === 'number' ? line.price : 0;
                            const existingLine = includedLineMap.get(key);
                            if (!existingLine || linePrice < existingLine.price) {
                                includedLineMap.set(key, {
                                    id: includedLinePackageId(serviceType, includedId),
                                    name: `${serviceType} - ${line.name}`,
                                    price: linePrice,
                                    warrantyMonths: 3,
                                    description: `Included in ${serviceType}`,
                                    isCustom: linePrice === 0,
                                    parentServiceType: serviceType,
                                    includedServiceId: includedId,
                                });
                            }
                        });
                    }
                });
                
                // Convert to service packages
                const dynamicPackages: ServicePackage[] = [
                    ...Array.from(serviceTypeMap.entries())
                    .filter(([_, meta]) => meta.count > 0) // Only show services that at least one provider offers
                    .map(([serviceType, meta]) => ({
                        id: `pkg-${serviceType.toLowerCase().replace(/\s+/g, '-')}`,
                        name: serviceType,
                        price: meta.price || 0,
                        warrantyMonths: 3, // Default warranty
                        description: meta.description || `${meta.count} provider${meta.count > 1 ? 's' : ''} available`,
                        isCustom: meta.price === undefined || meta.price === 0,
                    })),
                    ...Array.from(includedLineMap.values()),
                ];
                
                // Merge dynamic packages with existing packages (including mock and prefill packages)
                setAvailableServicePackages(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newPackages = dynamicPackages.filter(p => !existingIds.has(p.id));
                    // Merge: keep existing packages (mock, prefill) and add new API packages
                    const merged = [...prev, ...newPackages];
                    // Also update existing packages if they match by name (for API updates)
                    return merged.map(pkg => {
                        const apiMatch = dynamicPackages.find(api => api.name === pkg.name && api.id !== pkg.id);
                        // Only update if it's not a prefill package (prefill packages have service- prefix)
                        if (apiMatch && !pkg.id.startsWith('service-')) {
                            return { ...pkg, price: apiMatch.price, description: apiMatch.description };
                        }
                        return pkg;
                    });
                });
                
            } catch (error) {
                console.error('Error fetching provider services:', error);
            }
        };
        fetchProviderServices();
        
        // Refresh services periodically to stay in sync
        const interval = setInterval(fetchProviderServices, 30000); // Every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const loadCustomerRequestsInFlightRef = useRef(0);
    /** Count of in-flight loads that should show the full-page list spinner (excludes silent polls). */
    const requestsForegroundLoadsRef = useRef(0);

    const loadCustomerRequests = useCallback(async (source = 'unknown') => {
        const silentRefresh =
            source === 'interval-5s' || source === 'visibility' || source === 'supabase-realtime';
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ad4bf7' },
            body: JSON.stringify({
                sessionId: 'ad4bf7',
                hypothesisId: 'H1-H5',
                runId: 'post-fix',
                location: 'ServiceCart.tsx:loadCustomerRequests:start',
                message: 'loadCustomerRequests start',
                data: {
                    source,
                    silentRefresh,
                    isLoggedIn,
                    activeTab,
                    customerUserId: customerUserId ?? null,
                    inFlight: loadCustomerRequestsInFlightRef.current,
                    foregroundLoads: requestsForegroundLoadsRef.current,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        loadCustomerRequestsInFlightRef.current += 1;
        const t0 = Date.now();
        let startedForegroundSpinner = false;
        try {
            if (!isLoggedIn) {
                setCustomerRequests([]);
                return;
            }
            if (!silentRefresh) {
                requestsForegroundLoadsRef.current += 1;
                startedForegroundSpinner = true;
                setRequestsLoading(true);
                setRequestsError(null);
            }
            const resp = await authenticatedFetch('/api/service-requests?scope=customer');
            if (!resp.ok) {
                throw new Error(`Failed to load requests (${resp.status})`);
            }
            const data = await resp.json();
            const records: CustomerServiceRequest[] = Array.isArray(data) ? data : [];
            records.sort((a, b) => {
                const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
                return bt - at;
            });
            setCustomerRequests(records);
            if (silentRefresh) {
                setRequestsError(null);
            }
        } catch (error) {
            setRequestsError(error instanceof Error ? error.message : 'Failed to load your requests');
        } finally {
            loadCustomerRequestsInFlightRef.current -= 1;
            if (startedForegroundSpinner) {
                requestsForegroundLoadsRef.current -= 1;
                if (requestsForegroundLoadsRef.current <= 0) {
                    requestsForegroundLoadsRef.current = 0;
                    setRequestsLoading(false);
                }
            }
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ad4bf7' },
                body: JSON.stringify({
                    sessionId: 'ad4bf7',
                    hypothesisId: 'H1-H4',
                    runId: 'post-fix',
                    location: 'ServiceCart.tsx:loadCustomerRequests:finally',
                    message: 'loadCustomerRequests end',
                    data: {
                        source,
                        silentRefresh,
                        startedForegroundSpinner,
                        durationMs: Date.now() - t0,
                        isLoggedIn,
                        inFlight: loadCustomerRequestsInFlightRef.current,
                        foregroundLoads: requestsForegroundLoadsRef.current,
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
        }
    }, [activeTab, customerUserId, isLoggedIn]);

    const loadCustomerRequestsRef = useRef<(source?: string) => Promise<void>>(
        async () => {},
    );
    useEffect(() => {
        loadCustomerRequestsRef.current = (src = 'ref-unknown') => loadCustomerRequests(src);
    }, [loadCustomerRequests]);

    const cancelCustomerRequest = async (requestId: string) => {
        if (!window.confirm('Cancel this service request? Providers will no longer see it as active.')) {
            return;
        }
        try {
            setCancellingId(requestId);
            setRequestsError(null);
            const resp = await authenticatedFetch('/api/service-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: requestId, action: 'cancel' }),
            });
            if (!resp.ok) {
                let message = `Could not cancel (${resp.status})`;
                try {
                    const errBody = await resp.json();
                    if (errBody?.error && typeof errBody.error === 'string') {
                        message = errBody.error;
                    }
                } catch {
                    /* ignore */
                }
                throw new Error(message);
            }
            await loadCustomerRequests('after-cancel');
        } catch (error) {
            setRequestsError(error instanceof Error ? error.message : 'Failed to cancel request');
        } finally {
            setCancellingId(null);
        }
    };

    const deleteCustomerRequest = async (requestId: string) => {
        if (!window.confirm('Delete this cancelled request permanently?')) {
            return;
        }
        const previousRequests = customerRequests;
        try {
            setDeletingRequestId(requestId);
            setRequestsError(null);
            setCustomerRequests((prev) => prev.filter((req) => req.id !== requestId));
            const resp = await authenticatedFetch(`/api/service-requests?id=${encodeURIComponent(requestId)}`, {
                method: 'DELETE',
            });
            if (!resp.ok) {
                let message = `Could not delete request (${resp.status})`;
                try {
                    const errBody = await resp.json();
                    if (errBody?.error && typeof errBody.error === 'string') {
                        message = errBody.error;
                    }
                } catch {
                    /* ignore */
                }
                throw new Error(message);
            }
        } catch (error) {
            setCustomerRequests(previousRequests);
            setRequestsError(error instanceof Error ? error.message : 'Failed to delete request');
        } finally {
            setDeletingRequestId(null);
        }
    };

    const submitCustomerReview = async (requestId: string) => {
        const d = reviewDrafts[requestId] ?? { stars: 5, comment: '' };
        try {
            setReviewSubmittingId(requestId);
            setRequestsError(null);
            const resp = await authenticatedFetch('/api/service-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: requestId,
                    action: 'submit_review',
                    stars: d.stars,
                    comment: d.comment.trim(),
                }),
            });
            if (!resp.ok) {
                let message = `Could not submit review (${resp.status})`;
                try {
                    const errBody = await resp.json();
                    if (errBody?.error && typeof errBody.error === 'string') {
                        message = errBody.error;
                    }
                } catch {
                    /* ignore */
                }
                throw new Error(message);
            }
            await loadCustomerRequests('after-review');
        } catch (e) {
            setRequestsError(e instanceof Error ? e.message : 'Failed to submit review');
        } finally {
            setReviewSubmittingId(null);
        }
    };

    useEffect(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ad4bf7' },
            body: JSON.stringify({
                sessionId: 'ad4bf7',
                hypothesisId: 'H2',
                runId: 'pre-fix',
                location: 'ServiceCart.tsx:useEffect[track-deps]',
                message: 'effect activeTab isLoggedIn',
                data: { activeTab, isLoggedIn },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        if (activeTab !== 'track') return;
        void loadCustomerRequests('effect-activeTab-isLoggedIn');
    }, [activeTab, isLoggedIn, loadCustomerRequests]);

    useEffect(() => {
        if (activeTab !== 'track' || !isLoggedIn) return;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ad4bf7' },
            body: JSON.stringify({
                sessionId: 'ad4bf7',
                hypothesisId: 'H4',
                runId: 'pre-fix',
                location: 'ServiceCart.tsx:useEffect[interval-5s]',
                message: 'interval armed',
                data: { activeTab, isLoggedIn },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        const timer = setInterval(() => {
            void loadCustomerRequestsRef.current('interval-5s');
        }, 5000);
        return () => clearInterval(timer);
    }, [activeTab, isLoggedIn]);

    useEffect(() => {
        if (activeTab !== 'track' || !isLoggedIn) return;
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void loadCustomerRequestsRef.current('visibility');
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [activeTab, isLoggedIn]);

    useEffect(() => {
        if (activeTab !== 'track' || !isLoggedIn || !customerUserId) return;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ad4bf7' },
            body: JSON.stringify({
                sessionId: 'ad4bf7',
                hypothesisId: 'H3',
                runId: 'pre-fix',
                location: 'ServiceCart.tsx:useEffect[supabase]',
                message: 'subscribe service_requests',
                data: { customerUserId },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        const sb = getSupabaseClient();
        const channel = sb
            .channel(`service_requests_customer_${customerUserId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'service_requests',
                    filter: `user_id=eq.${customerUserId}`,
                },
                () => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ad4bf7' },
                        body: JSON.stringify({
                            sessionId: 'ad4bf7',
                            hypothesisId: 'H3',
                            runId: 'pre-fix',
                            location: 'ServiceCart.tsx:supabase:postgres_changes',
                            message: 'realtime event',
                            data: { customerUserId },
                            timestamp: Date.now(),
                        }),
                    }).catch(() => {});
                    // #endregion
                    void loadCustomerRequestsRef.current('supabase-realtime');
                },
            )
            .subscribe();
        return () => {
            void sb.removeChannel(channel);
        };
    }, [activeTab, isLoggedIn, customerUserId]);

    useEffect(() => {
        const loadProvidersForNames = async () => {
            if (!isLoggedIn || activeTab !== 'track') return;
            try {
                const { fetchPublicServiceProviderDirectory } = await import('../utils/serviceProviderDirectory');
                const providers = await fetchPublicServiceProviderDirectory();
                const next: Record<string, string> = {};
                providers.forEach((p) => {
                    if (p.id) next[p.id] = p.name || p.id;
                });
                setProviderNameById(next);
            } catch {
                // Ignore provider-name map failures in tracking tab
            }
        };
        loadProvidersForNames();
    }, [activeTab, isLoggedIn]);
    const [note, setNote] = useState('');
    const [carDetails, setCarDetails] = useState<CarDetails | null>(null);
    const [carForm, setCarForm] = useState({ make: '', model: '', year: '', fuel: '', reg: '', city: '' });
    const [carFormError, setCarFormError] = useState('');
    const [carFormOpen, setCarFormOpen] = useState(true);
    const [couponInput, setCouponInput] = useState('');
    const [couponMessage, setCouponMessage] = useState('');
    const [isPriceExpanded, setIsPriceExpanded] = useState(false);
    /** 1 = vehicle, services, provider. 2 = address, schedule, pay. */
    const [bookingFlowStep, setBookingFlowStep] = useState<1 | 2>(1);
    const checkoutBarBottom = `calc(${mobileBottomNavOffset} + ${keyboardInset}px)`;
    const mobileScrollPaddingBottom = isMobileApp
        ? bookingFlowStep === 2
            ? `calc(8rem + 56px + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`
            : `calc(2rem + 56px + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`
        : bookingFlowStep === 2
            ? `calc(7rem + ${keyboardInset}px)`
            : `calc(2rem + ${keyboardInset}px)`;
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [addressForm, setAddressForm] = useState<Partial<Address>>({});

    // Hydrate cart from localStorage before the persist effect runs; otherwise the first
    // persist write would overwrite storage with default mock addresses and deletions
    // would "come back" after refresh.
    useLayoutEffect(() => {
        let hasPrefill: string | null = null;
        try { hasPrefill = sessionStorage.getItem('service_cart_prefill'); } catch { /* storage unavailable */ }
        if (hasPrefill) {
            let raw: string | null = null;
            try { raw = localStorage.getItem(CART_KEY); } catch { /* storage unavailable */ }
            if (!raw) return;
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.addresses)) {
                    setAddresses(parsed.addresses);
                }
                const nextAddresses: Address[] = Array.isArray(parsed.addresses) ? parsed.addresses : initialAddresses;
                // Don't set items - let prefill handle it
                setSelectedAddress(
                    parsed.selectedAddress && nextAddresses.some((a: Address) => a.id === parsed.selectedAddress)
                        ? parsed.selectedAddress
                        : nextAddresses[0]?.id || '',
                );
                setSelectedBookingDate(resolveStoredBookingDate(parsed.selectedBookingDate));
                setSelectedSlot(
                    parsed.selectedSlot && timeSlots.some(s => s.id === parsed.selectedSlot)
                        ? parsed.selectedSlot
                        : defaultSlotIdForList(timeSlots),
                );
                setSelectedCoupon(parsed.selectedCoupon);
                setSelectedProviders(Array.isArray(parsed.selectedProviders) ? parsed.selectedProviders : []);
                setNote(parsed.note || '');
                if (parsed.carDetails) {
                    setCarDetails(parsed.carDetails);
                    setCarForm(parsed.carDetails);
                    setCarFormOpen(false);
                }
                if (parsed.bookingFlowStep === 2) setBookingFlowStep(2);
            } catch {
                // ignore parse errors
            }
            return;
        }

        let raw: string | null = null;
        try { raw = localStorage.getItem(CART_KEY); } catch { /* storage unavailable */ }
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.addresses)) {
                setAddresses(parsed.addresses);
            }
            const nextAddresses: Address[] = Array.isArray(parsed.addresses) ? parsed.addresses : initialAddresses;
            setItems(parsed.items || []);
            setSelectedAddress(
                parsed.selectedAddress && nextAddresses.some((a: Address) => a.id === parsed.selectedAddress)
                    ? parsed.selectedAddress
                    : nextAddresses[0]?.id || '',
            );
            setSelectedBookingDate(resolveStoredBookingDate(parsed.selectedBookingDate));
            setSelectedSlot(
                parsed.selectedSlot && timeSlots.some(s => s.id === parsed.selectedSlot)
                    ? parsed.selectedSlot
                    : defaultSlotIdForList(timeSlots),
            );
            setSelectedCoupon(parsed.selectedCoupon);
            setSelectedProviders(Array.isArray(parsed.selectedProviders) ? parsed.selectedProviders : []);
            setNote(parsed.note || '');
            if (parsed.carDetails) {
                setCarDetails(parsed.carDetails);
                setCarForm(parsed.carDetails);
                setCarFormOpen(false);
            }
            if (parsed.bookingFlowStep === 2) setBookingFlowStep(2);
        } catch {
            // ignore parse errors
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist cart state
    useEffect(() => {
        try {
            const payload = {
                items,
                selectedAddress,
                selectedBookingDate,
                selectedSlot,
                selectedCoupon,
                selectedProviders,
                note,
                carDetails,
                addresses,
                bookingFlowStep,
            };
            localStorage.setItem(CART_KEY, JSON.stringify(payload));
        } catch { /* storage unavailable */ }
    }, [items, selectedAddress, selectedBookingDate, selectedSlot, selectedCoupon, selectedProviders, note, carDetails, addresses, bookingFlowStep]);

    // Store prefill data in a ref to use in multiple effects
    const prefillDataRef = useRef<ServiceCartPrefill | null>(null);

    // Prefill from session (coming from landing cards or service detail page)
    useEffect(() => {
        let raw: string | null = null;
        try { raw = sessionStorage.getItem('service_cart_prefill'); } catch { /* storage unavailable */ }
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as ServiceCartPrefill;
            prefillDataRef.current = parsed;
            
            const prefillServiceId = parsed.serviceId;
            if (prefillServiceId) {
                // Check if this is a service ID from ServiceDetail (starts with 'service-')
                if (prefillServiceId.startsWith('service-')) {
                    // Use the serviceName from parsed data, or extract from serviceId
                    let serviceName = parsed.serviceName;
                    if (!serviceName) {
                        // Fallback: Extract service name from serviceId
                        serviceName = prefillServiceId
                            .replace('service-', '')
                            .split('-')
                            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                    }
                    
                    // Create a dynamic package for this service
                    const dynamicPackage: ServicePackage = {
                        id: prefillServiceId,
                        name: serviceName,
                        price: parsed.price || 0,
                        warrantyMonths: 3,
                        description: parsed.customQuote ? 'Custom quote' : '3 months warranty',
                        isCustom: parsed.customQuote || parsed.price === 0,
                    };
                    
                    // Add to available packages and set items in the same update cycle
                    setAvailableServicePackages(prev => {
                        const extraLinePackages: ServicePackage[] = Array.isArray(parsed.includedServices)
                            ? parsed.includedServices.map((line) => ({
                                id: includedLinePackageId(serviceName, String(line.id || line.name || 'line')),
                                name: `${serviceName} - ${line.name || line.id}`,
                                price: typeof line.price === 'number' ? line.price : 0,
                                warrantyMonths: 3,
                                description: `Included in ${serviceName}`,
                                isCustom: typeof line.price !== 'number' || line.price <= 0,
                                parentServiceType: serviceName,
                                includedServiceId: String(line.id || line.name || ''),
                            }))
                            : [];
                        const updated = prev.some(p => p.id === dynamicPackage.id)
                            ? prev.map(p => p.id === dynamicPackage.id ? dynamicPackage : p)
                            : [...prev, dynamicPackage];
                        const withLines = extraLinePackages.reduce((acc, linePkg) => (
                            acc.some((entry) => entry.id === linePkg.id) ? acc : [...acc, linePkg]
                        ), updated);
                        
                        // Set items after package is added (using functional update)
                        // This ensures the package exists when items are set
                        setItems(prevItems => {
                            if (extraLinePackages.length > 0) {
                                const filtered = prevItems.filter((item) => item.serviceId !== prefillServiceId);
                                const lineItems = extraLinePackages.map((linePkg) => ({ serviceId: linePkg.id, quantity: 1 }));
                                return [...filtered, ...lineItems];
                            }
                            // Check if item already exists
                            if (prevItems.some(item => item.serviceId === prefillServiceId)) {
                                return prevItems.map(item => 
                                    item.serviceId === prefillServiceId
                                        ? { ...item, quantity: Math.max(1, item.quantity) }
                                        : item
                                );
                            }
                            // Add the new item - package is guaranteed to exist in updated array
                            return [...prevItems, { serviceId: prefillServiceId, quantity: 1 }];
                        });
                        
                        return withLines;
                    });
                } else {
                    // For non-service- prefixed IDs, check if package exists first
                    setItems(prev => {
                        if (prev.some(item => item.serviceId === prefillServiceId)) {
                            return prev;
                        }
                        // Check if package exists in available packages
                        setAvailableServicePackages(currentPackages => {
                            if (currentPackages.some(p => p.id === prefillServiceId)) {
                                return currentPackages;
                            }
                            // Package doesn't exist, can't add item
                            return currentPackages;
                        });
                        return [...prev, { serviceId: prefillServiceId, quantity: 1 }];
                    });
                }
            }
            
            if (parsed.carDetails) {
                setCarDetails(parsed.carDetails);
                setCarForm({
                    make: parsed.carDetails.make,
                    model: parsed.carDetails.model,
                    year: parsed.carDetails.year,
                    fuel: parsed.carDetails.fuel,
                    reg: parsed.carDetails.reg || '',
                    city: parsed.carDetails.city || '',
                });
                setCarFormOpen(false);
            }
            
            try { sessionStorage.removeItem('service_cart_prefill'); } catch { /* storage unavailable */ }
            prefillDataRef.current = null;
        } catch (error) {
            console.error('Error processing prefill:', error);
            prefillDataRef.current = null;
            try { sessionStorage.removeItem('service_cart_prefill'); } catch { /* storage unavailable */ }
        }
    }, []);

    // Backup: Set items after package is available in availableServicePackages
    // This handles cases where the package might be added asynchronously (e.g., from API)
    useEffect(() => {
        if (!prefillDataRef.current?.serviceId) return;
        
        const serviceId = prefillDataRef.current.serviceId;
        const packageExists = availableServicePackages.some(p => p.id === serviceId);
        
        if (packageExists) {
            // Package is now available, ensure item is in cart
            setItems(prev => {
                // If the item is already in cart, keep it
                if (prev.some(item => item.serviceId === serviceId)) {
                    return prev;
                }
                // Otherwise, add it to the cart
                return [...prev, { serviceId, quantity: 1 }];
            });
            // Clear the ref after using it
            prefillDataRef.current = null;
        }
    }, [availableServicePackages]);

    const totals = useMemo(() => {
        const pricingProviderId = selectedProviders[0];
        const packageSubtotal = items.reduce((sum, item) => {
            const unitPrice = resolveItemUnitPrice(item, pricingProviderId);
            return sum + ((unitPrice || 0) * item.quantity);
        }, 0);
        const subtotal = packageSubtotal;
        const couponValue = coupons.find(c => c.code === selectedCoupon)?.amountOff || 0;
        const discount = Math.min(couponValue, subtotal);
        const pickupFee = subtotal > 0 && subtotal < 3000 ? 149 : 0;
        const platformFee = subtotal > 0 ? 49 : 0;
        const tax = Math.round(subtotal * 0.05); // simple 5% mock tax
        const total = subtotal - discount + pickupFee + platformFee + tax;
        return { packageSubtotal, subtotal, discount, pickupFee, platformFee, tax, total };
    }, [items, selectedCoupon, coupons, selectedProviders, resolveItemUnitPrice]);

    const checkoutReadiness = useMemo(() => {
        const missing: string[] = [];
        if (!carDetails) missing.push('Add car details');
        if (!selectedAddress) missing.push('Select address');
        if (!selectedBookingDate || !selectedSlot) missing.push('Pick booking date and slot');
        if (items.length === 0) missing.push('Add at least one package');
        if (selectedProviders.length === 0) missing.push('Choose a workshop');
        return missing;
    }, [carDetails, selectedAddress, selectedBookingDate, selectedSlot, items.length, selectedProviders.length]);

    const step1Blockers = useMemo(() => {
        const m: string[] = [];
        if (items.length === 0) m.push('Add at least one service');
        if (selectedProviders.length === 0) m.push('Choose a workshop');
        return m;
    }, [items.length, selectedProviders.length]);

    const canProceedToStep2 = step1Blockers.length === 0;

    const estimatedDurationMins = useMemo(() => {
        const providerId = selectedProviders[0];
        if (!providerId) return undefined;
        const base = estimateBookingEtaMinutes(providerId, items, providerServices, availableServicePackages);
        if (base == null) return undefined;
        return base;
    }, [selectedProviders, items, providerServices, availableServicePackages]);

    const completionEstimate = useMemo(() => {
        if (!selectedBookingDate || !selectedSlot || estimatedDurationMins == null) return '';
        const slotMeta = timeSlots.find((slot) => slot.id === selectedSlot);
        if (!slotMeta) return '';
        const startHour = parseSlotStartHour(slotMeta.label);
        if (startHour == null) return '';
        const start = new Date(`${selectedBookingDate}T${String(startHour).padStart(2, '0')}:00:00`);
        if (Number.isNaN(start.getTime())) return '';
        const end = new Date(start.getTime() + estimatedDurationMins * 60000);
        const endText = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `Approx. ${Math.ceil(estimatedDurationMins / 60)}h ${estimatedDurationMins % 60}m, ready by ${endText}`;
    }, [selectedBookingDate, selectedSlot, timeSlots, estimatedDurationMins]);

    const bestCoupon = useMemo(() => {
        if (totals.subtotal <= 0 || coupons.length === 0) return undefined;
        return [...coupons].sort((a, b) => b.amountOff - a.amountOff)[0];
    }, [totals.subtotal, coupons]);

    const slotDemandLevel = useMemo(() => {
        if (!selectedSlot) return '';
        const slotMeta = timeSlots.find((slot) => slot.id === selectedSlot);
        if (!slotMeta) return '';
        const hour = parseSlotStartHour(slotMeta.label);
        if (hour == null) return '';
        if (hour >= 10 && hour <= 14) return 'High demand';
        if (hour >= 8 && hour < 10) return 'Fills fast';
        return 'Good availability';
    }, [selectedSlot, timeSlots]);

    // Get service categories from selected items
    const selectedServiceCategories = useMemo(() => {
        const list = items
            .map((item) => {
                const category = SERVICE_PACKAGE_TO_CATEGORY[item.serviceId];
                if (category) return category;
                const svcMeta = availableServicePackages.find((s) => s.id === item.serviceId);
                return svcMeta?.name || item.serviceId;
            })
            .filter(Boolean);
        return Array.from(new Set(list));
    }, [items, availableServicePackages]);

    // Get service types from selected items (for backward compatibility)
    const selectedServiceTypes = useMemo(() => {
        const fromItems = items
            .map((item) => {
                const svcMeta = availableServicePackages.find((s) => s.id === item.serviceId);
                return svcMeta?.parentServiceType || svcMeta?.name || item.serviceId;
            })
            .filter(Boolean);
        const unique = Array.from(new Set(fromItems));
        if (unique.length > 0) return unique;
        if (activeServicePackageId) {
            const activeMeta = availableServicePackages.find((s) => s.id === activeServicePackageId);
            if (activeMeta?.name) return [activeMeta.name];
        }
        return unique;
    }, [items, availableServicePackages, activeServicePackageId]);

    const parentServicePackages = useMemo(
        () => availableServicePackages.filter((pkg) => !pkg.includedServiceId),
        [availableServicePackages],
    );

    const websiteServicePackages = useMemo(() => {
        return CAR_SERVICE_OPTIONS.map((serviceType) => {
            const match = parentServicePackages.find((pkg) => pkg.name === serviceType);
            if (match) return match;
            return {
                id: `pkg-${serviceType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                name: serviceType,
                price: 0,
                warrantyMonths: 3,
                description: 'Provider pricing shown after provider selection',
                isCustom: true,
                parentServiceType: serviceType,
            } as ServicePackage;
        });
    }, [parentServicePackages]);

    /** Lowest published price per service type across all workshops (for upfront "From ₹" hints). */
    const serviceStartingPrices = useMemo(() => {
        const prices: Record<string, number> = {};
        Object.values(providerServices).forEach((services) => {
            (services || []).forEach((svc) => {
                if (svc.active === false || !svc.serviceType) return;
                const price = svc.price;
                if (price == null || price <= 0) return;
                const key = svc.serviceType;
                prices[key] = prices[key] != null ? Math.min(prices[key], price) : price;
            });
        });
        return prices;
    }, [providerServices]);

    /** Parent package is in cart as full-service line and/or has sub-service lines selected. */
    const isParentPackageInCart = useCallback(
        (parentPkgId: string, cart: CartItem[]) => {
            if (cart.some((i) => i.serviceId === parentPkgId)) return true;
            const parentMeta = availableServicePackages.find((p) => p.id === parentPkgId);
            if (!parentMeta) return false;
            const parentType = (parentMeta.parentServiceType || parentMeta.name).toLowerCase();
            return cart.some((entry) => {
                const meta = availableServicePackages.find((p) => p.id === entry.serviceId);
                return (
                    Boolean(meta?.includedServiceId) &&
                    (meta?.parentServiceType || '').toLowerCase() === parentType
                );
            });
        },
        [availableServicePackages],
    );

    const stripParentPackageFromCart = useCallback(
        (cart: CartItem[], parentPkgId: string): CartItem[] => {
            const parentMeta = availableServicePackages.find((p) => p.id === parentPkgId);
            if (!parentMeta) return cart.filter((i) => i.serviceId !== parentPkgId);
            const parentType = (parentMeta.parentServiceType || parentMeta.name).toLowerCase();
            return cart.filter((entry) => {
                if (entry.serviceId === parentPkgId) return false;
                const meta = availableServicePackages.find((p) => p.id === entry.serviceId);
                if (meta?.includedServiceId && (meta.parentServiceType || '').toLowerCase() === parentType) {
                    return false;
                }
                return true;
            });
        },
        [availableServicePackages],
    );

    useEffect(() => {
        if (!activeServicePackageId) {
            if (items.length === 0) setHasExplicitServiceSelection(false);
            return;
        }
        if (!isParentPackageInCart(activeServicePackageId, items)) {
            const fallback = websiteServicePackages.find((pkg) => isParentPackageInCart(pkg.id, items));
            if (fallback) {
                setActiveServicePackageId(fallback.id);
                return;
            }
            if (items.length === 0 && inSubPickMode) {
                // User opened "Pick items" — keep panel until they choose subs, full service, or uncheck.
                return;
            }
            setInSubPickMode(false);
            setActiveServicePackageId('');
            if (items.length === 0) setHasExplicitServiceSelection(false);
        }
    }, [items, activeServicePackageId, websiteServicePackages, isParentPackageInCart, inSubPickMode]);

    const includedOptionsForActiveService = useMemo(() => {
        if (!activeServicePackageId) return [];
        const activeService = availableServicePackages.find((pkg) => pkg.id === activeServicePackageId);
        if (!activeService) return [];
        const parentType = activeService.parentServiceType || activeService.name;
        return availableServicePackages.filter(
            (pkg) => pkg.includedServiceId && (pkg.parentServiceType || '').toLowerCase() === parentType.toLowerCase(),
        );
    }, [activeServicePackageId, availableServicePackages]);

    const includedOptionsForActiveServicePriced = useMemo(() => {
        const providerId = selectedProviders[0];
        if (!providerId) {
            return includedOptionsForActiveService.map((line) => ({ ...line, providerPrice: undefined as number | undefined }));
        }
        return includedOptionsForActiveService.map((line) => {
            const unitPrice = resolveItemUnitPrice({ serviceId: line.id, quantity: 1 }, providerId);
            return { ...line, providerPrice: unitPrice };
        });
    }, [includedOptionsForActiveService, selectedProviders, resolveItemUnitPrice]);

    useEffect(() => {
        if (!activeServicePackageId) return;
        if (websiteServicePackages.some((pkg) => pkg.id === activeServicePackageId)) return;
        setActiveServicePackageId('');
        setHasExplicitServiceSelection(false);
    }, [activeServicePackageId, websiteServicePackages]);

    // Filter providers: only after the user has chosen at least one service (or is configuring one)
    const availableProviders = useMemo(() => {
        if (selectedServiceTypes.length === 0) {
            return [];
        }

        return serviceProviders.filter(p => {
            // First check if provider has matching categories
            const providerCategories = p.serviceCategories || [];
            const hasMatchingCategory = selectedServiceCategories.some(category => 
                providerCategories.includes(category)
            );
            
            if (hasMatchingCategory) return true;
            
            // Fallback: check individual services
            const services = providerServices[p.id] || [];
            return selectedServiceTypes.every((serviceType) => {
                return services.some(s => 
                    s.serviceType === serviceType && 
                    s.active !== false
                );
            });
        });
    }, [providerServices, selectedServiceTypes, selectedServiceCategories, serviceProviders]);

    // Clear provider if they no longer offer the current service selection
    useEffect(() => {
        setSelectedProviders((prev) => {
            if (prev.length === 0) return prev;
            const allowed = new Set(availableProviders.map((p) => p.id));
            const next = prev.filter((id) => allowed.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [availableProviders]);

    const providerTotals = useMemo(() => {
        const result: Record<string, { total: number; breakdown: Array<{ id: string; name: string; price?: number }> }> = {};
        availableProviders.forEach(p => {
            const services = providerServices[p.id] || [];
            let total = 0;
            const breakdown: Array<{ id: string; name: string; price?: number }> = [];
            
            // Calculate totals based on selected items with quantities
            items.forEach((item) => {
                const svcMeta = availableServicePackages.find(s => s.id === item.serviceId);
                const serviceName = svcMeta?.parentServiceType || svcMeta?.name || item.serviceId;
                const match = services.find(s => s.serviceType === serviceName && s.active !== false);
                let price = match?.price;
                if (svcMeta?.includedServiceId) {
                    const included = (match?.includedServices || []).find((line) => {
                        const lineId = String(line.id || '').trim();
                        return line.active !== false && (lineId === svcMeta.includedServiceId || line.name === svcMeta.name.replace(`${serviceName} - `, ''));
                    });
                    price = included?.price;
                }
                const quantity = item.quantity || 1;
                
                if (price !== undefined) {
                    total += price * quantity;
                }
                breakdown.push({ 
                    id: item.serviceId, 
                    name: serviceName, 
                    price: price !== undefined ? price * quantity : undefined 
                });
            });
            
            result[p.id] = { total, breakdown };
        });
        return result;
    }, [availableProviders, providerServices, items, availableServicePackages]);

    const sortedAvailableProviders = useMemo(() => {
        return [...availableProviders].sort((a, b) => {
            const at = providerTotals[a.id]?.total ?? Number.POSITIVE_INFINITY;
            const bt = providerTotals[b.id]?.total ?? Number.POSITIVE_INFINITY;
            if (at !== bt) return at - bt;
            const ad = a.distanceKm ?? Number.POSITIVE_INFINITY;
            const bd = b.distanceKm ?? Number.POSITIVE_INFINITY;
            return ad - bd;
        });
    }, [availableProviders, providerTotals]);

    const selectedProviderPrimary = useMemo(() => {
        if (selectedProviders.length === 0) return undefined;
        return sortedAvailableProviders.find((p) => p.id === selectedProviders[0]);
    }, [selectedProviders, sortedAvailableProviders]);

    const selectedProviderId = selectedProviders[0];
    const activeWebsitePackage = useMemo(
        () => websiteServicePackages.find((p) => p.id === activeServicePackageId),
        [websiteServicePackages, activeServicePackageId],
    );
    const hasSubServiceLines = includedOptionsForActiveServicePriced.length > 0;

    const isFullServiceLineMode =
        Boolean(activeServicePackageId) && items.some((i) => i.serviceId === activeServicePackageId);
    const selectedSubCount = items.filter((i) =>
        includedOptionsForActiveServicePriced.some((s) => s.id === i.serviceId),
    ).length;

    const bookingSummaryGroups = useMemo(() => {
        return websiteServicePackages
            .filter((pkg) => isParentPackageInCart(pkg.id, items))
            .map((pkg) => {
                const hasFullParent = items.some((i) => i.serviceId === pkg.id);
                const parentType = (pkg.parentServiceType || pkg.name).toLowerCase();
                const subLineCount = items.filter((entry) => {
                    if (entry.serviceId === pkg.id) return false;
                    const meta = availableServicePackages.find((p) => p.id === entry.serviceId);
                    return (
                        Boolean(meta?.includedServiceId) &&
                        (meta?.parentServiceType || '').toLowerCase() === parentType
                    );
                }).length;
                return {
                    packageId: pkg.id,
                    name: pkg.name,
                    hasFullParent,
                    subLineCount,
                };
            });
    }, [websiteServicePackages, items, isParentPackageInCart, availableServicePackages]);

    const packageHasConfigurableAddons = useCallback(
        (packageId: string) => {
            const pkg = websiteServicePackages.find((p) => p.id === packageId);
            if (!pkg) return false;
            const parentType = (pkg.parentServiceType || pkg.name).toLowerCase();
            return availableServicePackages.some(
                (p) =>
                    Boolean(p.includedServiceId) &&
                    (p.parentServiceType || '').toLowerCase() === parentType,
            );
        },
        [websiteServicePackages, availableServicePackages],
    );

    const showServicePackageBuilder =
        Boolean(selectedProviderId) &&
        items.length > 0 &&
        bookingSummaryGroups.some((g) => packageHasConfigurableAddons(g.packageId));

    useEffect(() => {
        setExtrasPanelOpen(false);
        setShowAllAddons(false);
    }, [selectedProviders[0]]);

    useEffect(() => {
        if (selectedSubCount > 0 && !isFullServiceLineMode) {
            setExtrasPanelOpen(true);
        }
    }, [selectedSubCount, isFullServiceLineMode]);

    const focusPackageForConfigure = useCallback((packageId: string) => {
        setHasExplicitServiceSelection(true);
        setActiveServicePackageId(packageId);
        setInSubPickMode(false);
        setExtrasPanelOpen(true);
        requestAnimationFrame(() => {
            configureSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }, []);

    const removeBookingLine = useCallback(
        (packageId: string) => {
            setItems((prev) => {
                const next = stripParentPackageFromCart(prev, packageId);
                if (activeServicePackageId === packageId) {
                    const fallback = websiteServicePackages.find((p) => isParentPackageInCart(p.id, next));
                    setActiveServicePackageId(fallback?.id || '');
                    if (!fallback) setHasExplicitServiceSelection(false);
                    setInSubPickMode(false);
                }
                return next;
            });
        },
        [activeServicePackageId, stripParentPackageFromCart, websiteServicePackages, isParentPackageInCart],
    );

    const selectServiceForBooking = (serviceId: string) => {
        const selectedMeta =
            websiteServicePackages.find((pkg) => pkg.id === serviceId) ||
            availableServicePackages.find((pkg) => pkg.id === serviceId);
        if (!selectedMeta) return;
        setHasExplicitServiceSelection(true);
        setActiveServicePackageId(serviceId);
        setItems((prev) => {
            const inCart = isParentPackageInCart(serviceId, prev);
            if (!inCart) {
                return [...prev, { serviceId, quantity: 1 }];
            }
            // In cart: second click on the *focused* row removes the service; click on another
            // selected row only moves focus so you can set add-ons per service.
            if (activeServicePackageId === serviceId) {
                setInSubPickMode(false);
                return stripParentPackageFromCart(prev, serviceId);
            }
            setInSubPickMode(false);
            return prev;
        });
    };

    /** Book the full bundled service (provider's declared base price). */
    const pickFullServiceForActive = () => {
        if (!activeServicePackageId) return;
        setInSubPickMode(false);
        setItems((prev) => {
            const cleared = stripParentPackageFromCart(prev, activeServicePackageId);
            return [...cleared, { serviceId: activeServicePackageId, quantity: 1 }];
        });
    };

    /** Switch to sub-service selection mode for the active parent service. */
    const pickSubServicesForActive = () => {
        if (!activeServicePackageId) return;
        setInSubPickMode(true);
        setItems((prev) => prev.filter((entry) => entry.serviceId !== activeServicePackageId));
    };

    const toggleIncludedServiceLine = (serviceId: string) => {
        setItems((prev) => {
            // Switching to any sub-service always drops the full-service parent
            // to keep pricing unambiguous.
            const withoutParent = prev.filter((entry) => entry.serviceId !== activeServicePackageId);
            if (withoutParent.some((entry) => entry.serviceId === serviceId)) {
                return withoutParent.filter((entry) => entry.serviceId !== serviceId);
            }
            return [...withoutParent, { serviceId, quantity: 1 }];
        });
    };

    const handleApplyCoupon = (code: string) => {
        if (coupons.some(c => c.code === code)) {
            setSelectedCoupon(code);
            setCouponMessage(`Coupon ${code} applied.`);
        } else {
            setCouponMessage('Coupon code is not valid.');
        }
    };

    const applyCouponInput = () => {
        const code = couponInput.trim().toUpperCase();
        if (!code) {
            setCouponMessage('Enter a coupon code.');
            return;
        }
        if (coupons.some((c) => c.code.toUpperCase() === code)) {
            setSelectedCoupon(code);
            setCouponInput(code);
            setCouponMessage(`Coupon ${code} applied.`);
            return;
        }
        setCouponMessage(`Coupon ${code} is not available.`);
    };

    const handleSubmit = async () => {
        if (!isLoggedIn) {
            onLogin?.();
            return;
        }
        if (!selectedAddress || !selectedSlot || items.length === 0) return;
        const todayYmd = formatLocalYmd(new Date());
        if (!selectedBookingDate || !YMD_RE.test(selectedBookingDate) || selectedBookingDate < todayYmd) {
            setScheduleError('Please choose a valid date (today or later).');
            return;
        }
        setScheduleError('');
        if (!carDetails) {
            setCarFormError('Please add your car details before checkout.');
            setCarFormOpen(true);
            return;
        }
        
        // Ensure we have at least one provider selected or available
        const providersToNotify = selectedProviders.length > 0 
            ? selectedProviders 
            : availableProviders.map(p => p.id);
        
        if (providersToNotify.length === 0) {
            setCarFormError('No service providers available for the selected services. Please try different services.');
            return;
        }
        
        // Use the first provider as the primary providerId
        const primaryProviderId = providersToNotify[0];
        
        // Build servicePackages array from selected items
        const servicePackages = items.map(item => {
            const svc = availableServicePackages.find(s => s.id === item.serviceId);
            const serviceType = svc?.parentServiceType || svc?.name || item.serviceId;
            const providerSvc = (providerServices[primaryProviderId] || []).find((entry) => entry.serviceType === serviceType && entry.active !== false);
            let resolvedPrice = providerSvc?.price;
            if (svc?.includedServiceId) {
                resolvedPrice = (providerSvc?.includedServices || []).find((line) => line.active !== false && String(line.id) === String(svc.includedServiceId))?.price;
            }
            return {
                id: item.serviceId,
                name: svc?.name || item.serviceId,
                serviceType,
                includedServiceId: svc?.includedServiceId,
                price: resolvedPrice,
                quantity: item.quantity || 1,
            };
        });
        
        const slotMeta = timeSlots.find(s => s.id === selectedSlot);
        const payload = {
            items,
            addressId: selectedAddress,
            address: addresses.find(a => a.id === selectedAddress),
            slotId: selectedSlot,
            scheduledDate: selectedBookingDate,
            slotTimeLabel: slotMeta?.label || selectedSlot,
            couponCode: selectedCoupon,
            providerId: primaryProviderId,
            candidateProviderIds: providersToNotify, // Include all providers to notify
            total: (providerTotals[primaryProviderId]?.total || totals.subtotal) + totals.pickupFee + totals.platformFee + totals.tax - totals.discount,
            note,
            carDetails,
            servicePackages,
            serviceTypes: selectedServiceTypes,
        };
        
        try {
            await onSubmitRequest?.(payload);
            const summary = servicePackages.map((p) => p.name).join(', ');
            const addr = addresses.find((a) => a.id === selectedAddress);
            setPostBookingWhatsAppUrl(
                supportWhatsAppHref(
                    buildServiceBookingConfirmationMessage({
                        serviceSummary: summary,
                        date: selectedBookingDate,
                        slot: slotMeta?.label || selectedSlot,
                        city: addr?.city,
                        addressLine: addr?.line1,
                    }),
                ),
            );
            setActiveTab('track');
            await loadCustomerRequests('after-submit');
        } catch (error) {
            console.error('Error submitting service request:', error);
            setCarFormError(error instanceof Error ? error.message : 'Failed to submit service request. Please try again.');
        }
    };

    const handleSaveCarDetails = () => {
        if (!carForm.make || !carForm.model || !carForm.year || !carForm.fuel) {
            setCarFormError('Please fill required fields: make, model, year, fuel.');
            return;
        }
        setCarFormError('');
        setCarDetails(carForm);
        setCarFormOpen(false);
    };

    const trackSection = (
        <div className={embedTrackOnly ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'}>
            <section
                className={
                    embedTrackOnly
                        ? 'bg-transparent p-0'
                        : 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6'
                }
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">My Service Requests</h2>
                    <button
                        type="button"
                        onClick={() => void loadCustomerRequests('refresh-click')}
                        disabled={requestsLoading || !isLoggedIn}
                        className="px-3 py-2 rounded-lg text-sm border bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Refresh
                    </button>
                </div>
                {postBookingWhatsAppUrl && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
                        <span className="text-gray-800 dark:text-gray-200 font-medium">
                            {PLATFORM_SUPPORT_PHONE_E164
                                ? 'Confirm your booking on WhatsApp with ReRide support'
                                : 'Open WhatsApp with your booking message ready to send'}
                        </span>
                        <a
                            href={postBookingWhatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                        >
                            Open WhatsApp
                        </a>
                        <button
                            type="button"
                            onClick={() => setPostBookingWhatsAppUrl(null)}
                            className="text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        >
                            Dismiss
                        </button>
                    </div>
                )}
                {!isLoggedIn && (
                    <div className="text-sm text-gray-600 dark:text-gray-300">Login to see your request progress.</div>
                )}
                {isLoggedIn && requestsLoading && (
                    <div className="text-sm text-gray-600 dark:text-gray-300">Loading requests...</div>
                )}
                {isLoggedIn && requestsError && (
                    <div className="text-sm text-red-600">{requestsError}</div>
                )}
                {isLoggedIn && !requestsLoading && !requestsError && (
                    <div className="space-y-3">
                        {customerRequests.map((req) => (
                            <div key={req.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white">{req.serviceType || req.title || 'Service request'}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {req.city || 'City not provided'} {req.scheduledAt ? `• Slot: ${req.scheduledAt}` : ''}
                                        </div>
                                        {customerRequestVehicleLabel(req) && (
                                            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                                Vehicle: {customerRequestVehicleLabel(req)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(req.status === 'open' || req.status === 'accepted') && (
                                            <button
                                                type="button"
                                                onClick={() => cancelCustomerRequest(req.id)}
                                                disabled={cancellingId === req.id || deletingRequestId === req.id || requestsLoading}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
                                            >
                                                {cancellingId === req.id ? 'Cancelling…' : 'Cancel request'}
                                            </button>
                                        )}
                                        {req.status === 'cancelled' && (
                                            <button
                                                type="button"
                                                onClick={() => deleteCustomerRequest(req.id)}
                                                disabled={deletingRequestId === req.id || requestsLoading}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                            >
                                                {deletingRequestId === req.id ? 'Deleting…' : 'Delete'}
                                            </button>
                                        )}
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${REQUEST_STATUS_STYLES[req.status] || REQUEST_STATUS_STYLES.open}`}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                {req.providerId && (
                                    <div className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                                        Assigned provider: {providerNameById[req.providerId] || req.providerId}
                                    </div>
                                )}
                                <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Progress Timeline</div>
                                    <div className="mb-3">
                                        <div className="flex items-center gap-2">
                                            {TRACKING_STEPS.map((step, idx) => {
                                                const stepState = getStepState(req, step.key);
                                                return (
                                                    <React.Fragment key={step.key}>
                                                        <div className="flex flex-col items-center min-w-[56px]">
                                                            <div
                                                                className={`h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                                                    stepState === 'done'
                                                                        ? 'bg-emerald-500 text-white'
                                                                        : stepState === 'cancelled'
                                                                            ? 'bg-gray-300 text-gray-600'
                                                                            : 'bg-gray-200 text-gray-500'
                                                                }`}
                                                            >
                                                                {idx + 1}
                                                            </div>
                                                            <span className="mt-1 text-[10px] text-gray-600 dark:text-gray-400 text-center">{step.label}</span>
                                                        </div>
                                                        {idx < TRACKING_STEPS.length - 1 && (
                                                            <div
                                                                className={`h-1 flex-1 rounded ${
                                                                    getStepState(req, TRACKING_STEPS[idx + 1].key) === 'done'
                                                                        ? 'bg-emerald-400'
                                                                        : req.status === 'cancelled'
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-600 dark:text-gray-400">
                                        <div>Raised: {req.createdAt || '-'}</div>
                                        <div>Accepted: {req.claimedAt || '-'}</div>
                                        <div>In progress: {req.startedAt || '-'}</div>
                                        <div>Completed: {req.completedAt || '-'}</div>
                                        {req.status === 'cancelled' && (
                                            <div className="sm:col-span-2 text-red-600 dark:text-red-400 font-medium">
                                                Cancelled: {req.cancelledAt || '-'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {req.notes && (
                                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                                        Note: {req.notes}
                                    </div>
                                )}
                                {req.status === 'completed' && req.providerId && !req.customerReview && (
                                    <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
                                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                            Rate this workshop
                                        </div>
                                        <div className="flex gap-1 mb-2">
                                            {[1, 2, 3, 4, 5].map((s) => {
                                                const selected = (reviewDrafts[req.id]?.stars ?? 5) >= s;
                                                return (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() =>
                                                            setReviewDrafts((prev) => ({
                                                                ...prev,
                                                                [req.id]: {
                                                                    stars: s,
                                                                    comment: prev[req.id]?.comment ?? '',
                                                                },
                                                            }))
                                                        }
                                                        className={`text-lg leading-none px-1 ${
                                                            selected ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'
                                                        }`}
                                                        aria-label={`${s} stars`}
                                                    >
                                                        ★
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <textarea
                                            value={reviewDrafts[req.id]?.comment ?? ''}
                                            onChange={(e) =>
                                                setReviewDrafts((prev) => ({
                                                    ...prev,
                                                    [req.id]: {
                                                        stars: prev[req.id]?.stars ?? 5,
                                                        comment: e.target.value.slice(0, 500),
                                                    },
                                                }))
                                            }
                                            placeholder="Optional feedback (max 500 characters)"
                                            rows={2}
                                            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 mb-2"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void submitCustomerReview(req.id)}
                                            disabled={reviewSubmittingId === req.id}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                                        >
                                            {reviewSubmittingId === req.id ? 'Submitting…' : 'Submit review'}
                                        </button>
                                    </div>
                                )}
                                {req.customerReview && (
                                    <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                                        Your rating: {req.customerReview.stars}/5
                                        {req.customerReview.comment
                                            ? ` — “${req.customerReview.comment}”`
                                            : ''}
                                    </div>
                                )}
                            </div>
                        ))}
                        {customerRequests.length === 0 && (
                            <div className="text-sm text-gray-600 dark:text-gray-300">No service requests yet.</div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );

    if (embedTrackOnly) {
        return (
            <div className="min-h-0">
                {trackSection}
            </div>
        );
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
                <div className="inline-flex bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 shadow-sm">
                    <button
                        onClick={() => setActiveTab('book')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            activeTab === 'book'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        Book Service
                    </button>
                    <button
                        onClick={() => setActiveTab('track')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            activeTab === 'track'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        Track Requests
                    </button>
                </div>
            </div>
            {activeTab === 'track' ? (
                trackSection
            ) : (
            <>
            {/* Header Section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 text-white">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.2),transparent_25%)]" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 relative">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-base">
                                SC
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black leading-tight">Book a service</h1>
                                <p className="text-white/85 mt-0.5 text-xs sm:text-sm">Pick service → workshop → done</p>
                            </div>
                        </div>
                        {!isLoggedIn && (
                            <button
                                onClick={onLogin}
                                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-blue-700 font-bold shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 text-sm sm:text-base touch-manipulation min-h-[44px]"
                            >
                                Proceed to login
                            </button>
                        )}
                        {isLoggedIn && (
                            <div className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold text-sm sm:text-base text-center">
                                ✓ Logged in
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-lg:pb-28"
                style={{ paddingBottom: mobileScrollPaddingBottom }}
            >
                {/* Progress stepper */}
                <nav aria-label="Booking progress" className="mb-5 sm:mb-7">
                    <ol className="flex items-stretch gap-2 sm:gap-3">
                        {[
                            {
                                n: 1,
                                title: 'Services & workshop',
                                desc: 'Pick and go',
                                done: canProceedToStep2 && bookingFlowStep === 2,
                                active: bookingFlowStep === 1,
                                disabled: false,
                            },
                            {
                                n: 2,
                                title: 'Time & checkout',
                                desc: 'Address and pay',
                                done: false,
                                active: bookingFlowStep === 2,
                                disabled: !canProceedToStep2,
                            },
                        ].map((s) => {
                            const isActive = s.active;
                            const isDone = s.done;
                            return (
                                <li key={s.n} className="flex-1 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (s.disabled) return;
                                            setBookingFlowStep(s.n as 1 | 2);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        disabled={s.disabled}
                                        title={s.disabled ? step1Blockers.join(' · ') : s.title}
                                        aria-current={isActive ? 'step' : undefined}
                                        className={`group relative w-full text-left rounded-xl border px-3 sm:px-4 py-3 sm:py-3.5 transition-all flex items-center gap-3 ${
                                            isActive
                                                ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-900/20 shadow-sm'
                                                : isDone
                                                  ? 'border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800/40 hover:border-emerald-400'
                                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                                        } ${s.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
                                    >
                                        <span
                                            className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                                isActive
                                                    ? 'bg-blue-600 text-white'
                                                    : isDone
                                                      ? 'bg-emerald-500 text-white'
                                                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                            }`}
                                            aria-hidden
                                        >
                                            {isDone ? (
                                                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                s.n
                                            )}
                                        </span>
                                        <div className="min-w-0">
                                            <div className={`text-xs sm:text-sm font-bold truncate ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>
                                                Step {s.n} · {s.title}
                                            </div>
                                            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                                                {s.desc}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                    {bookingFlowStep === 1 && step1Blockers.length > 0 && (
                        <p className="mt-2 text-[11px] sm:text-xs text-amber-700 dark:text-amber-300">
                            To unlock Step 2: {step1Blockers.join(' · ')}
                        </p>
                    )}
                </nav>

                {bookingFlowStep === 2 && (
                    <a
                        href="#service-booking-payment-summary"
                        className="lg:hidden no-underline mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 dark:border-slate-600 bg-white dark:bg-slate-800/90 px-4 py-3 text-slate-900 dark:text-white shadow-sm active:scale-[0.99] transition-transform"
                    >
                        <div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Estimated total</div>
                            <div className="text-lg font-bold tabular-nums">₹{totals.total.toLocaleString('en-IN')}</div>
                        </div>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">Summary and book ↓</span>
                    </a>
                )}

                {bookingFlowStep === 2 && (
                <section className={`${BOOKING_SURFACE} mb-4 sm:mb-5`}>
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className={STEP_BADGE}>
                                        <svg className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17a2 2 0 104 0m6 0a2 2 0 104 0M3 13l2-7h14l2 7M3 13h18M3 13v4h18v-4" />
                                        </svg>
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">Vehicle details</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{carDetails ? 'Saved — tap Edit to change' : 'So the mechanic knows your car'}</p>
                                    </div>
                                </div>
                                {carDetails && (
                                    <button
                                        onClick={() => setCarFormOpen(!carFormOpen)}
                                        className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    >
                                        {carFormOpen ? (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Close
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                            {carDetails && !carFormOpen && (
                                <div className="rounded-[16px] bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/40 dark:from-indigo-950/30 dark:via-slate-900/40 dark:to-blue-950/20 p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-indigo-100/80 dark:ring-indigo-900/40">
                                    <div className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                                        {carDetails.make} {carDetails.model}
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm">
                                            {carDetails.year}
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm">
                                            {carDetails.fuel}
                                        </span>
                                        {carDetails.reg && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-xs font-bold text-white uppercase tracking-wide shadow-sm">
                                                {carDetails.reg}
                                            </span>
                                        )}
                                        {carDetails.city && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm">
                                                {carDetails.city}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {(carFormOpen || !carDetails) && (
                                <div className="space-y-3.5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <label className="block">
                                            <span className="block text-[11px] font-bold text-indigo-600/80 dark:text-indigo-300/80 mb-1.5 uppercase tracking-wide">Make<span className="text-red-500 ml-0.5">*</span></span>
                                            <input
                                                className={BOOKING_INPUT}
                                                placeholder="e.g. Maruti"
                                                value={carForm.make}
                                                onChange={(e) => setCarForm({ ...carForm, make: e.target.value })}
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="block text-[11px] font-bold text-indigo-600/80 dark:text-indigo-300/80 mb-1.5 uppercase tracking-wide">Model<span className="text-red-500 ml-0.5">*</span></span>
                                            <input
                                                className={BOOKING_INPUT}
                                                placeholder="e.g. Swift"
                                                value={carForm.model}
                                                onChange={(e) => setCarForm({ ...carForm, model: e.target.value })}
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="block text-[11px] font-bold text-indigo-600/80 dark:text-indigo-300/80 mb-1.5 uppercase tracking-wide">Year<span className="text-red-500 ml-0.5">*</span></span>
                                            <input
                                                className={BOOKING_INPUT}
                                                placeholder="2021"
                                                value={carForm.year}
                                                onChange={(e) => setCarForm({ ...carForm, year: e.target.value })}
                                            />
                                        </label>
                                        <div className="block sm:col-span-2">
                                            <span className="block text-[11px] font-bold text-indigo-600/80 dark:text-indigo-300/80 mb-1.5 uppercase tracking-wide">Fuel<span className="text-red-500 ml-0.5">*</span></span>
                                            <div className="grid grid-cols-4 gap-2">
                                                {FUEL_OPTIONS.map((fuel) => {
                                                    const selected = carForm.fuel.toLowerCase() === fuel.toLowerCase();
                                                    return (
                                                        <button
                                                            key={fuel}
                                                            type="button"
                                                            onClick={() => setCarForm({ ...carForm, fuel })}
                                                            aria-pressed={selected}
                                                            className={`rounded-xl px-2 py-2.5 text-xs font-bold transition-all ring-1 ${
                                                                selected
                                                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white ring-indigo-400 shadow-sm'
                                                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 ring-slate-200/80 dark:ring-slate-700 hover:ring-indigo-300 dark:hover:ring-indigo-700'
                                                            }`}
                                                        >
                                                            {fuel}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <label className="block">
                                        <span className="block text-[11px] font-bold text-indigo-600/80 dark:text-indigo-300/80 mb-1.5 uppercase tracking-wide">Registration</span>
                                        <input
                                            className={`${BOOKING_INPUT} uppercase`}
                                            placeholder="e.g. KA01AB1234"
                                            value={carForm.reg}
                                            onChange={(e) => setCarForm({ ...carForm, reg: e.target.value })}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="block text-[11px] font-bold text-indigo-600/80 dark:text-indigo-300/80 mb-1.5 uppercase tracking-wide">City / Pincode</span>
                                        <input
                                            className={BOOKING_INPUT}
                                            placeholder="Bengaluru / 560001"
                                            value={carForm.city}
                                            onChange={(e) => setCarForm({ ...carForm, city: e.target.value })}
                                        />
                                    </label>
                                    {carFormError && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
                                            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>{carFormError}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleSaveCarDetails}
                                        className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all min-h-[44px]"
                                    >
                                        Save vehicle
                                    </button>
                                </div>
                            )}
                        </section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-4 sm:gap-6 items-start">
                    <div className="order-1 space-y-4 min-w-0">
                        {bookingFlowStep === 1 && (
                        <>
                        {/* Card 1 — Services */}
                        <section className={BOOKING_SURFACE}>
                            <header className="flex items-start justify-between gap-3 mb-5">
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className={STEP_BADGE}>A</span>
                                    <div className="min-w-0">
                                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                            Choose services
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {selectedServiceTypes.length === 0
                                                ? 'Tap one or more services'
                                                : selectedServiceTypes.length > 1
                                                  ? `${selectedServiceTypes.length} selected`
                                                  : '1 selected · pick a workshop next'}
                                        </p>
                                    </div>
                                </div>
                                {items.length > 0 && (
                                    <span className="shrink-0 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-3 py-1 text-[11px] font-black text-indigo-700 dark:text-indigo-300 tabular-nums ring-1 ring-indigo-200/60 dark:ring-indigo-800/60">
                                        {items.length} added
                                    </span>
                                )}
                            </header>
                            {!selectedProviderId && items.length > 0 && (
                                <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-indigo-50/70 dark:bg-indigo-950/30 px-3.5 py-2.5 text-[11px] text-indigo-800/80 dark:text-indigo-200/80 ring-1 ring-indigo-100 dark:ring-indigo-900/50">
                                    <svg className="w-3.5 h-3.5 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Exact prices lock in once you pick a workshop.</span>
                                </div>
                            )}
                            <div className="space-y-2.5">
                                {websiteServicePackages.map((pkg) => {
                                    const inCart = isParentPackageInCart(pkg.id, items);
                                    const isConfiguringThis =
                                        hasExplicitServiceSelection && activeServicePackageId === pkg.id;
                                    const isSelected = inCart || isConfiguringThis;
                                    const serviceType = pkg.parentServiceType || pkg.name;
                                    const rowPrice = selectedProviderId
                                        ? resolveItemUnitPrice({ serviceId: pkg.id, quantity: 1 }, selectedProviderId)
                                        : undefined;
                                    const startingPrice =
                                        serviceStartingPrices[serviceType] ??
                                        (pkg.price > 0 && !pkg.isCustom ? pkg.price : undefined);
                                    const displayPrice = rowPrice ?? (selectedProviderId ? pkg.price : startingPrice);
                                    const hasUpfrontPrice = displayPrice != null && displayPrice > 0;
                                    return (
                                        <button
                                            type="button"
                                            key={pkg.id}
                                            role="checkbox"
                                            aria-checked={isSelected}
                                            onClick={() => selectServiceForBooking(pkg.id)}
                                            className={`${BOOKING_OPTION_BASE} flex items-center justify-between gap-3 ${
                                                isSelected ? BOOKING_OPTION_SELECTED : 'bg-white dark:bg-slate-900/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span
                                                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
                                                        isSelected
                                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm'
                                                            : 'ring-2 ring-slate-200 dark:ring-slate-600 bg-white dark:bg-slate-900 text-transparent'
                                                    }`}
                                                >
                                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 min-w-0">
                                                        <span className="truncate">{pkg.name}</span>
                                                        {inCart && (
                                                            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                                                                Selected
                                                            </span>
                                                        )}
                                                    </div>
                                                    {pkg.description && !selectedProviderId && (
                                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                            {pkg.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-right shrink-0 tabular-nums max-w-[9rem]">
                                                {selectedProviderId ? (
                                                    hasUpfrontPrice ? (
                                                        <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                                                            ₹{displayPrice!.toLocaleString('en-IN')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium italic">At checkout</span>
                                                    )
                                                ) : hasUpfrontPrice ? (
                                                    <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                                                        From ₹{displayPrice!.toLocaleString('en-IN')}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400/80 dark:text-slate-500 font-normal">View on selection</span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Card 2 — Workshop / provider */}
                        <section className={BOOKING_SURFACE}>
                            <header className="flex items-start justify-between gap-3 mb-5">
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className={selectedServiceTypes.length === 0 ? STEP_BADGE_MUTED : STEP_BADGE}>
                                        B
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                            Pick a workshop
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {selectedServiceTypes.length === 0
                                                ? 'Choose a service first'
                                                : `${sortedAvailableProviders.length} ${sortedAvailableProviders.length === 1 ? 'workshop' : 'workshops'} can do all your services`}
                                        </p>
                                    </div>
                                </div>
                                {onUseMyLocation && (
                                    <button
                                        type="button"
                                        onClick={onUseMyLocation}
                                        disabled={isLocating}
                                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2.5 py-1.5 rounded-md disabled:opacity-60"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0L6.343 16.657A8 8 0 1117.657 16.657z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        {isLocating ? 'Detecting…' : 'Near me'}
                                    </button>
                                )}
                            </header>
                            {selectedServiceTypes.length === 0 ? (
                                <div className="rounded-[16px] px-4 py-10 text-center ring-1 ring-dashed ring-slate-200 dark:ring-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                                    <svg className="mx-auto w-10 h-10 text-indigo-200 dark:text-indigo-900 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No workshops yet</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                                        Select at least one service above to see trusted workshops in your area.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sortedAvailableProviders.map((p) => {
                                        const pTotals = providerTotals[p.id];
                                        const etaMin = estimateBookingEtaMinutes(
                                            p.id,
                                            items,
                                            providerServices,
                                            availableServicePackages,
                                        );
                                        const rating =
                                            p.rating != null && Number.isFinite(Number(p.rating))
                                                ? Number(p.rating)
                                                : undefined;
                                        const reviewCount = p.reviewCount;
                                        const completedJobs = p.completedJobs;
                                        const isChosen = selectedProviderId === p.id;
                                        return (
                                            <label
                                                key={p.id}
                                                className={`flex items-start gap-3 p-4 sm:p-4 cursor-pointer min-h-[44px] ${BOOKING_OPTION_BASE} ${
                                                    isChosen ? BOOKING_OPTION_SELECTED : 'bg-white dark:bg-slate-900/50'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="service-booking-provider"
                                                    className="h-4 w-4 mt-1 text-indigo-600 focus:ring-2 focus:ring-indigo-500 shrink-0"
                                                    checked={isChosen}
                                                    onChange={() => setSelectedProviders([p.id])}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className="text-sm font-black text-gray-900 dark:text-white truncate">
                                                                    {p.name}
                                                                </div>
                                                                {p.isVerified && (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/80 dark:ring-emerald-800/60 shrink-0">
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                        Verified Partner
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                                                {rating != null && (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-black text-amber-700 dark:text-amber-300 ring-1 ring-amber-200/70 dark:ring-amber-800/50">
                                                                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                                                        {rating.toFixed(1)}
                                                                    </span>
                                                                )}
                                                                {reviewCount != null && reviewCount > 0 && (
                                                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                                        {reviewCount.toLocaleString('en-IN')} reviews
                                                                    </span>
                                                                )}
                                                                {completedJobs != null && completedJobs > 0 && (
                                                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                                        {completedJobs.toLocaleString('en-IN')} jobs completed
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {pTotals && pTotals.total > 0 && (
                                                            <span className="text-base font-black text-indigo-700 dark:text-indigo-300 tabular-nums shrink-0">
                                                                ₹{pTotals.total.toLocaleString('en-IN')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        {p.city && p.city !== 'Unknown' ? (
                                                            <span className="inline-flex items-center gap-1">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0L6.343 16.657A8 8 0 1117.657 16.657zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                {p.city}
                                                            </span>
                                                        ) : null}
                                                        {p.distanceKm != null ? <span>{Number(p.distanceKm).toFixed(1)} km away</span> : null}
                                                        {etaMin != null ? <span>~{etaMin} min</span> : null}
                                                    </div>
                                                    {(!pTotals || pTotals.total <= 0) && items.length > 0 && (
                                                        <div className="text-[11px] text-amber-700/90 dark:text-amber-400 mt-2 font-medium">
                                                            Final price confirmed at booking.
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                    {availableProviders.length === 0 && (
                                        <div className="rounded-[16px] px-4 py-8 text-center ring-1 ring-amber-200/80 dark:ring-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20">
                                            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">No workshops match</p>
                                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 max-w-sm mx-auto">
                                                {selectedServiceTypes.length > 1
                                                    ? 'No single workshop offers all selected services. Try a different mix.'
                                                    : 'No workshops available for this service yet.'}
                                            </p>
                                        </div>
                                    )}
                                    {locationError && (
                                        <div className="text-xs text-red-700 dark:text-red-400 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                            {locationError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Optional extras — collapsed by default for a fast checkout */}
                        {showServicePackageBuilder && (
                        <div ref={configureSectionRef}>
                            {!extrasPanelOpen ? (
                                <div className={`${BOOKING_SURFACE} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                                            Ready to continue
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Standard package included · add-ons are optional
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!activeServicePackageId && bookingSummaryGroups[0]) {
                                                focusPackageForConfigure(bookingSummaryGroups[0].packageId);
                                            } else {
                                                setExtrasPanelOpen(true);
                                                requestAnimationFrame(() => {
                                                    configureSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                });
                                            }
                                        }}
                                        className="shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                    >
                                        Customize add-ons
                                    </button>
                                </div>
                            ) : activeWebsitePackage && (
                        <section className={`${BOOKING_SURFACE} ring-2 ring-indigo-200/50 dark:ring-indigo-800/40`}>
                            <header className="flex items-start justify-between gap-3 mb-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className={STEP_BADGE}>C</span>
                                    <div className="min-w-0">
                                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                            Optional add-ons
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Skip this step if the standard package is enough
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setExtrasPanelOpen(false);
                                        setShowAllAddons(false);
                                    }}
                                    className="shrink-0 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                >
                                    Done
                                </button>
                            </header>
                            <div className="space-y-4">
                                {bookingSummaryGroups.length > 1 && (
                                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Services to customize">
                                        {bookingSummaryGroups.filter((g) => packageHasConfigurableAddons(g.packageId)).map((group) => {
                                            const isActive = activeServicePackageId === group.packageId;
                                            return (
                                                <button
                                                    key={group.packageId}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={isActive}
                                                    onClick={() => focusPackageForConfigure(group.packageId)}
                                                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                                        isActive
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    {group.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {hasSubServiceLines && (
                                    <div>
                                        {isFullServiceLineMode && (
                                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-2">
                                                ✓ Full {activeWebsitePackage.name} package selected
                                            </p>
                                        )}
                                        {!isFullServiceLineMode && selectedSubCount > 0 && (
                                            <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium mb-2">
                                                {selectedSubCount} add-on{selectedSubCount === 1 ? '' : 's'} selected
                                            </p>
                                        )}
                                        <div className="space-y-1.5">
                                            {(showAllAddons
                                                ? includedOptionsForActiveServicePriced
                                                : includedOptionsForActiveServicePriced.slice(0, 4)
                                            ).map((line) => {
                                                const checked = items.some((item) => item.serviceId === line.id);
                                                const lineLabel = line.name.replace(/^[^-]+-\s*/, '');
                                                return (
                                                    <button
                                                        type="button"
                                                        key={line.id}
                                                        onClick={() => {
                                                            if (isFullServiceLineMode) pickSubServicesForActive();
                                                            toggleIncludedServiceLine(line.id);
                                                        }}
                                                        aria-pressed={checked && !isFullServiceLineMode}
                                                        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left rounded-xl ring-1 transition-colors ${
                                                            checked && !isFullServiceLineMode
                                                                ? 'ring-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40'
                                                                : 'ring-slate-200/80 dark:ring-slate-700 bg-white dark:bg-slate-900/40'
                                                        }`}
                                                    >
                                                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                                                            {lineLabel}
                                                        </span>
                                                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 shrink-0 tabular-nums">
                                                            {line.providerPrice != null && line.providerPrice > 0
                                                                ? `+₹${line.providerPrice.toLocaleString('en-IN')}`
                                                                : '—'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {includedOptionsForActiveServicePriced.length > 4 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllAddons((v) => !v)}
                                                className="mt-2 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 hover:underline"
                                            >
                                                {showAllAddons
                                                    ? 'Show fewer'
                                                    : `Show all ${includedOptionsForActiveServicePriced.length} add-ons`}
                                            </button>
                                        )}
                                        {!isFullServiceLineMode && (
                                            <button
                                                type="button"
                                                onClick={pickFullServiceForActive}
                                                className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:underline"
                                            >
                                                Reset to full package
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                            )}
                        </div>
                        )}

                        {/* Continue button (mobile) — desktop uses sticky summary card */}
                        <div className="lg:hidden mt-2 flex flex-col gap-2">
                            {bookingSummaryGroups.length > 0 && (
                                <div className="rounded-xl border border-slate-200/90 dark:border-slate-600 bg-white dark:bg-slate-800/90 px-3.5 py-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                                        Your services
                                    </div>
                                    <ul className="space-y-2">
                                        {bookingSummaryGroups.map((group) => (
                                            <li
                                                key={group.packageId}
                                                className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 px-2 py-1.5"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                        {group.name}
                                                    </div>
                                                    {group.subLineCount > 0 && (
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            {group.hasFullParent
                                                                ? 'Full package'
                                                                : `${group.subLineCount} add-on${group.subLineCount === 1 ? '' : 's'}`}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeBookingLine(group.packageId)}
                                                    aria-label={`Remove ${group.name}`}
                                                    className="shrink-0 rounded-md p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                    title="Remove"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {step1Blockers.length > 0 && (
                                <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
                                    {step1Blockers.join(' · ')}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (!canProceedToStep2) return;
                                    setBookingFlowStep(2);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                disabled={!canProceedToStep2}
                                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none min-h-[44px]"
                            >
                                Continue to time &amp; place →
                            </button>
                        </div>
                        </>
                        )}

                        {bookingFlowStep === 2 && (
                        <>
                        {/* Card 1 — Address */}
                        <section className={BOOKING_SURFACE}>
                            <header className="flex items-start justify-between gap-3 mb-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0L6.343 16.657A8 8 0 1117.657 16.657zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                            Pickup address
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Where should we pick up your car?
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newId = `addr-${Date.now()}`;
                                        setAddresses(prev => [...prev, {
                                            id: newId,
                                            label: 'New Address',
                                            line1: '',
                                            city: '',
                                            state: '',
                                            pincode: '',
                                        }]);
                                        setEditingAddressId(newId);
                                        setAddressForm({ label: 'New Address', line1: '', city: '', state: '', pincode: '' });
                                    }}
                                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                    New
                                </button>
                            </header>
                            <div className="space-y-2">
                                {addresses.map(addr => {
                                    const isEditing = editingAddressId === addr.id;
                                    const isSelected = selectedAddress === addr.id;
                                    return (
                                        <div
                                            key={addr.id}
                                            className={`rounded-xl border-2 transition-all ${
                                                isEditing
                                                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-900/10 p-3.5'
                                                    : isSelected
                                                      ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/15 dark:border-indigo-700 shadow-sm'
                                                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                            }`}
                                        >
                                            {isEditing ? (
                                                <div className="space-y-2.5">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                                                            Edit address
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingAddressId(null);
                                                                setAddressForm({});
                                                            }}
                                                            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 font-semibold"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={addressForm.label || addr.label}
                                                        onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                                                        placeholder="Label (Home, Office, …)"
                                                        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={addressForm.line1 || addr.line1}
                                                        onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                                                        placeholder="Street address"
                                                        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent"
                                                    />
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <input
                                                            type="text"
                                                            value={addressForm.city || addr.city}
                                                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                                                            placeholder="City"
                                                            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={addressForm.state || addr.state}
                                                            onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                                                            placeholder="State"
                                                            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={addressForm.pincode || addr.pincode}
                                                            onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                                                            placeholder="Pincode"
                                                            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent"
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between pt-1">
                                                        <button
                                                            onClick={() => {
                                                                setAddresses(prev => prev.filter(a => a.id !== addr.id));
                                                                if (selectedAddress === addr.id) {
                                                                    setSelectedAddress(addresses.find(a => a.id !== addr.id)?.id || '');
                                                                }
                                                                setEditingAddressId(null);
                                                                setAddressForm({});
                                                            }}
                                                            className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-semibold transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (addressForm.label || addressForm.line1 || addressForm.city) {
                                                                    setAddresses(prev => prev.map(a =>
                                                                        a.id === addr.id
                                                                            ? { ...a, ...addressForm }
                                                                            : a
                                                                    ));
                                                                }
                                                                setEditingAddressId(null);
                                                                setAddressForm({});
                                                            }}
                                                            className="px-4 py-1.5 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-bold transition-colors"
                                                        >
                                                            Save address
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className="flex items-start gap-3 cursor-pointer p-3.5">
                                                    <input
                                                        type="radio"
                                                        className="mt-1 w-4 h-4 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                                                        checked={isSelected}
                                                        onChange={() => setSelectedAddress(addr.id)}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{addr.label}</span>
                                                                {isSelected && (
                                                                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-1.5 py-0.5 rounded">
                                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                                        Selected
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setEditingAddressId(addr.id);
                                                                    setAddressForm({
                                                                        label: addr.label,
                                                                        line1: addr.line1,
                                                                        city: addr.city,
                                                                        state: addr.state,
                                                                        pincode: addr.pincode,
                                                                    });
                                                                }}
                                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                                            >
                                                                Edit
                                                            </button>
                                                        </div>
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                                            {addr.line1}{addr.line1 ? ', ' : ''}{addr.city} {addr.pincode}
                                                        </div>
                                                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                            Free home pickup
                                                            {selectedProviderPrimary?.distanceKm ? ` · ${selectedProviderPrimary.distanceKm.toFixed(1)} km` : ''}
                                                        </div>
                                                    </div>
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Card 2 — Schedule */}
                        <section className={BOOKING_SURFACE}>
                            <header className="flex items-start gap-3 mb-4">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </span>
                                <div className="min-w-0">
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                        Pick a time
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Choose a date and 2-hour slot — we&apos;ll confirm with the workshop
                                    </p>
                                </div>
                            </header>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="service-booking-date" className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1.5">
                                        Date
                                    </label>
                                    <input
                                        id="service-booking-date"
                                        type="date"
                                        min={minBookingDateYmd}
                                        value={selectedBookingDate}
                                        onChange={e => {
                                            setSelectedBookingDate(e.target.value);
                                            setScheduleError('');
                                        }}
                                        className={`${BOOKING_INPUT} max-w-[16rem] font-semibold [color-scheme:light] dark:[color-scheme:dark]`}
                                    />
                                    {scheduleError && (
                                        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{scheduleError}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">
                                        Time slot
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {timeSlots.map(slot => {
                                            const isSelected = selectedSlot === slot.id;
                                            return (
                                                <button
                                                    key={slot.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedSlot(slot.id);
                                                        setScheduleError('');
                                                    }}
                                                    aria-pressed={isSelected}
                                                    className={`rounded-lg border-2 px-3 py-2.5 text-sm font-bold transition-all ${
                                                        isSelected
                                                            ? 'border-indigo-600 bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md'
                                                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-white dark:bg-gray-900'
                                                    }`}
                                                >
                                                    <div className="text-sm">{slot.label}</div>
                                                    {isSelected && slotDemandLevel && (
                                                        <div className="text-[10px] mt-0.5 opacity-90 font-medium normal-case">{slotDemandLevel}</div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {completionEstimate && (
                                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-semibold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 flex items-start gap-2">
                                        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span>{completionEstimate}</span>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="service-booking-note" className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-1.5">
                                        Note <span className="font-normal normal-case text-slate-400">(optional)</span>
                                    </label>
                                    <textarea
                                        id="service-booking-note"
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className={`${BOOKING_INPUT} resize-none`}
                                        rows={2}
                                        placeholder="Warning lights? Pickup landmark? Preferred call time?"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Card 3 — Coupon */}
                        <section className={BOOKING_SURFACE}>
                            <header className="flex items-start justify-between gap-3 mb-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                            Coupon &amp; offers
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Apply a code or pick from available offers
                                        </p>
                                    </div>
                                </div>
                                {selectedCoupon && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCoupon(undefined);
                                            setCouponInput('');
                                            setCouponMessage('');
                                        }}
                                        className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400"
                                    >
                                        Remove
                                    </button>
                                )}
                            </header>

                            <div className="flex gap-2">
                                <input
                                    value={couponInput}
                                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                    placeholder="Enter code"
                                    className={`${BOOKING_INPUT} flex-1 font-semibold uppercase`}
                                />
                                <button
                                    type="button"
                                    onClick={applyCouponInput}
                                    className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold transition-colors"
                                >
                                    Apply
                                </button>
                            </div>
                            {couponMessage && (
                                <p className={`mt-2 text-xs font-medium ${selectedCoupon ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                    {couponMessage}
                                </p>
                            )}
                            {bestCoupon && !selectedCoupon && (
                                <button
                                    type="button"
                                    onClick={() => handleApplyCoupon(bestCoupon.code)}
                                    className="mt-3 w-full inline-flex items-center justify-between gap-2 rounded-lg border border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-900/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        Best offer for your cart
                                    </span>
                                    <span className="font-bold">Apply {bestCoupon.code}</span>
                                </button>
                            )}
                            {coupons.length > 0 && (
                                <div className="mt-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                                        Available offers
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {coupons.map(c => {
                                            const isSelected = selectedCoupon === c.code;
                                            return (
                                                <button
                                                    key={c.code}
                                                    type="button"
                                                    onClick={() => handleApplyCoupon(c.code)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                                                        isSelected
                                                            ? 'border-indigo-600 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                                                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-900'
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                    {c.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </section>
                        </>
                        )}
                    </div>

                    <aside className="order-2 flex flex-col gap-4 min-w-0 w-full lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                        {bookingFlowStep === 1 && (
                        <section className="max-lg:hidden w-full min-w-0 max-w-full rounded-[20px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shadow-lg shadow-indigo-950/30 ring-1 ring-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black uppercase tracking-wider text-white/90">Your booking</h3>
                                {totals.total > 0 && (
                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-sky-400/20 to-purple-500/20 text-white/90 ring-1 ring-white/15">Estimate</span>
                                )}
                            </div>
                            <div className="space-y-4 text-sm">
                                <div className="rounded-[14px] bg-white/[0.06] ring-1 ring-white/10 p-3.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-200/70 mb-2">Services</div>
                                    {items.length === 0 ? (
                                        <div className="flex items-center gap-2 text-indigo-100/50 text-xs">
                                            <span className="h-8 w-8 rounded-lg bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center shrink-0">
                                                <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            </span>
                                            <span className="italic">None selected yet</span>
                                        </div>
                                    ) : (
                                        <ul className="space-y-2">
                                            {bookingSummaryGroups.map((group) => (
                                                <li
                                                    key={group.packageId}
                                                    className="flex items-start gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 ring-1 ring-white/[0.06]"
                                                >
                                                    <span className="h-1.5 w-1.5 mt-2 rounded-full bg-gradient-to-r from-sky-400 to-purple-400 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium text-white/95">
                                                            {group.name}
                                                        </div>
                                                        {group.subLineCount > 0 && (
                                                            <div className="text-[10px] text-indigo-200/60">
                                                                {group.hasFullParent
                                                                    ? 'Full package'
                                                                    : `${group.subLineCount} add-on${group.subLineCount === 1 ? '' : 's'}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBookingLine(group.packageId)}
                                                        aria-label={`Remove ${group.name}`}
                                                        className="shrink-0 rounded-md p-1.5 text-indigo-200/70 hover:text-white hover:bg-white/10 transition-colors"
                                                        title="Remove"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="rounded-[14px] bg-white/[0.06] ring-1 ring-white/10 p-3.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-200/70 mb-2">Workshop</div>
                                    {selectedProviderPrimary ? (
                                        <div className="text-white/95 text-sm font-semibold truncate">{selectedProviderPrimary.name}</div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-indigo-100/50 text-xs">
                                            <span className="h-8 w-8 rounded-lg bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center shrink-0">
                                                <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
                                            </span>
                                            <span className="italic">None selected yet</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-baseline justify-between pt-1 border-t border-white/10">
                                    <span className="text-indigo-200/70 text-xs font-bold uppercase tracking-wide">Est. total</span>
                                    <span className="text-2xl font-black tabular-nums bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-transparent">
                                        {totals.total > 0 ? `₹${totals.total.toLocaleString('en-IN')}` : '—'}
                                    </span>
                                </div>
                                {totals.total <= 0 && (
                                    <p className="text-[11px] text-indigo-200/50 italic text-center -mt-1">Updates as you choose services</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!canProceedToStep2) return;
                                    setBookingFlowStep(2);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                disabled={!canProceedToStep2}
                                className="mt-5 w-full rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 px-4 py-3 text-sm font-black transition shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none min-h-[44px]"
                            >
                                Continue to time & place →
                            </button>
                            {!canProceedToStep2 && (
                                <p className="mt-2 text-[11px] text-amber-300/90 text-center">
                                    {step1Blockers[0]}
                                </p>
                            )}
                            {canProceedToStep2 && !extrasPanelOpen && showServicePackageBuilder && (
                                <p className="mt-2 text-[10px] text-indigo-200/60 text-center">
                                    Add-ons are optional — continue when ready
                                </p>
                            )}
                        </section>
                        )}

                        {bookingFlowStep === 2 && (
                        <>
                        <section className={BOOKING_SURFACE}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Booking summary
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBookingFlowStep(1);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    Edit
                                </button>
                            </div>
                            <div className="space-y-3.5">
                                {carDetails && (
                                    <div className="flex items-start gap-2.5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17a2 2 0 104 0m6 0a2 2 0 104 0M3 13l2-7h14l2 7M3 13h18M3 13v4h18v-4" /></svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vehicle</div>
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {carDetails.make} {carDetails.model}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {carDetails.year} · {carDetails.fuel}{carDetails.reg ? ` · ${carDetails.reg}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {items.length > 0 && (
                                    <div className="flex items-start gap-2.5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Services</div>
                                            <ul className="text-sm text-slate-900 dark:text-white space-y-0.5">
                                                {items.slice(0, 5).map((line) => {
                                                    const meta = availableServicePackages.find((p) => p.id === line.serviceId);
                                                    return (
                                                        <li key={line.serviceId + String(line.quantity)} className="truncate">
                                                            {meta?.name || line.serviceId}{line.quantity > 1 ? ` ×${line.quantity}` : ''}
                                                        </li>
                                                    );
                                                })}
                                                {items.length > 5 && (
                                                    <li className="text-[11px] text-slate-500 dark:text-slate-400">+{items.length - 5} more</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                {selectedProviderPrimary && (
                                    <div className="flex items-start gap-2.5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workshop</div>
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selectedProviderPrimary.name}</div>
                                            {selectedProviderPrimary.distanceKm != null && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">~{Number(selectedProviderPrimary.distanceKm).toFixed(1)} km away</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {selectedBookingDate && selectedSlot && (
                                    <div className="flex items-start gap-2.5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">When</div>
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {new Date(selectedBookingDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {timeSlots.find((s) => s.id === selectedSlot)?.label}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section
                            id="service-booking-payment-summary"
                            className={`scroll-mt-4 ${BOOKING_SURFACE}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Payment</h3>
                                {selectedCoupon && totals.discount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        {selectedCoupon}
                                    </span>
                                )}
                            </div>
                            {checkoutReadiness.length > 0 && (
                                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 flex items-start gap-2">
                                    <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span><span className="font-semibold">Complete:</span> {checkoutReadiness.join(' · ')}</span>
                                </div>
                            )}
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>Services</span>
                                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums">₹{totals.packageSubtotal.toLocaleString('en-IN')}</span>
                                </div>
                                {totals.discount > 0 && (
                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                        <span>Discount</span>
                                        <span className="font-semibold tabular-nums">-₹{totals.discount.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsPriceExpanded((prev) => !prev)}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                    <svg className={`w-3 h-3 transition-transform ${isPriceExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    {isPriceExpanded ? 'Hide breakdown' : 'See fees & taxes'}
                                </button>
                                {isPriceExpanded && (
                                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pl-4 border-l border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between">
                                            <span>Pickup fee</span>
                                            <span className="tabular-nums">{totals.pickupFee === 0 ? 'Free' : `₹${totals.pickupFee.toLocaleString('en-IN')}`}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Platform fee</span>
                                            <span className="tabular-nums">₹{totals.platformFee.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Taxes</span>
                                            <span className="tabular-nums">₹{totals.tax.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                )}
                                {!isPriceExpanded && (
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Taxes &amp; fees</span>
                                        <span className="font-semibold text-slate-900 dark:text-white tabular-nums">₹{(totals.tax + totals.platformFee + totals.pickupFee).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-baseline pt-3 mt-1 border-t border-slate-200 dark:border-slate-700">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
                                    <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">₹{totals.total.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                type="button"
                                className="max-lg:hidden mt-4 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                disabled={checkoutReadiness.length > 0}
                            >
                                Place service request
                            </button>
                            {selectedCoupon && totals.discount > 0 && (
                                <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold text-center">
                                    You saved ₹{totals.discount.toLocaleString('en-IN')} with {selectedCoupon}
                                </p>
                            )}
                            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                <span>Cancel within 5 mins</span>
                            </div>
                        </section>
                        </>
                        )}
                    </aside>
                </div>
                {bookingFlowStep === 2 && (
                <div
                    className="lg:hidden fixed left-0 right-0 z-50 border-t border-slate-200/90 dark:border-slate-600 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-[0_-8px_32px_rgba(0,0,0,0.08)]"
                    style={{
                        bottom: checkoutBarBottom,
                        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
                    }}
                    role="region"
                    aria-label="Checkout and total"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 sm:gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</div>
                            <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
                                ₹{totals.total.toLocaleString('en-IN')}
                            </div>
                        </div>
                        <a
                            href="#service-booking-payment-summary"
                            className="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400 py-1"
                        >
                            Breakdown
                        </a>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={checkoutReadiness.length > 0}
                            className="shrink-0 min-w-[7.5rem] rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Book
                        </button>
                    </div>
                </div>
                )}
            </div>
            </>
            )}
        </div>
    );
};

export default ServiceCart;


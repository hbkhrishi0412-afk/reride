import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from 'react';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import { getSupabaseClient } from '../lib/supabase';
import {
    buildServiceBookingConfirmationMessage,
    supportWhatsAppHref,
    PLATFORM_SUPPORT_PHONE_E164,
} from '../utils/whatsappShare.js';
import { CAR_SERVICE_OPTIONS } from '../constants/serviceProviderCatalog.js';

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

type AddOn = {
    id: string;
    name: string;
    description: string;
    price: number;
    durationMins: number;
};

type CustomerServiceRequest = {
    id: string;
    title: string;
    serviceType?: string;
    providerId?: string | null;
    status: 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
    city?: string;
    scheduledAt?: string;
    createdAt?: string;
    updatedAt?: string;
    claimedAt?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
    notes?: string;
    customerReview?: { stars: number; comment?: string; submittedAt: string };
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
        addOns?: Array<{ id: string; name: string; price: number }>;
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
    { id: 'sp-1', name: 'City Auto Care', city: 'London', distanceKm: 4.2 },
    { id: 'sp-2', name: 'Prime Garage', city: 'London', distanceKm: 6.8 },
];

const mockCoupons: Coupon[] = [
    { code: 'SAVE200', label: 'Flat ₹200 off', amountOff: 200 },
    { code: 'SAVE10', label: '10% off up to ₹500', amountOff: 500 }, // capped; simplified as flat for mock
];

const mockAddOns: AddOn[] = [
    { id: 'addon-wheel-alignment', name: 'Wheel Alignment', description: 'Improves handling and tire life', price: 899, durationMins: 40 },
    { id: 'addon-ac-disinfection', name: 'AC Disinfection', description: 'Cabin and vent sanitization', price: 499, durationMins: 25 },
    { id: 'addon-battery-check', name: 'Battery Health Check', description: 'Load test and terminal cleanup', price: 299, durationMins: 20 },
];

const BOOKING_STEPS = [
    { key: 'car', label: 'Vehicle' },
    { key: 'address', label: 'Address' },
    { key: 'slot', label: 'Slot' },
    { key: 'package', label: 'Service' },
    { key: 'provider', label: 'Provider' },
    { key: 'review', label: 'Review' },
] as const;

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
    const [selectedProviders, setSelectedProviders] = useState<string[]>(serviceProviders[0]?.id ? [serviceProviders[0].id] : []);
    const [providerServices, setProviderServices] = useState<Record<string, ServiceProvider['services']>>({});
    const [availableServicePackages, setAvailableServicePackages] = useState<ServicePackage[]>(servicePackages);
    const [activeServicePackageId, setActiveServicePackageId] = useState<string>('');
    const [hasExplicitServiceSelection, setHasExplicitServiceSelection] = useState(false);

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
                const servicesData = await servicesResp.json();
                const grouped: Record<string, ServiceProvider['services']> = {};
                servicesData.forEach((entry: any) => {
                    const pid = entry.providerId;
                    if (!pid) return;
                    grouped[pid] = grouped[pid] || [];
                    grouped[pid].push({
                        serviceType: entry.serviceType,
                        price: entry.price,
                        description: entry.description,
                        etaMinutes: entry.etaMinutes,
                        active: entry.active !== false,
                        includedServices: Array.isArray(entry.includedServices) ? entry.includedServices : [],
                    });
                });
                setProviderServices(grouped);
                
                // Build service packages from actual provider services
                const serviceTypeMap = new Map<string, { price?: number; description?: string; etaMinutes?: number; count: number }>();
                const includedLineMap = new Map<string, ServicePackage>();
                servicesData.forEach((entry: any) => {
                    if (!entry.serviceType || entry.active === false) return;
                    const existing = serviceTypeMap.get(entry.serviceType) || { count: 0 };
                    serviceTypeMap.set(entry.serviceType, {
                        price: existing.price === undefined ? entry.price : Math.min(existing.price || Infinity, entry.price || Infinity),
                        description: entry.description || existing.description,
                        etaMinutes: entry.etaMinutes || existing.etaMinutes,
                        count: existing.count + 1,
                    });
                    if (Array.isArray(entry.includedServices)) {
                        entry.includedServices.forEach((line: any) => {
                            if (!line || line.active === false || !line.name) return;
                            const includedId = String(line.id || line.name);
                            const key = `${entry.serviceType}::${includedId}`;
                            const linePrice = typeof line.price === 'number' ? line.price : 0;
                            const existingLine = includedLineMap.get(key);
                            if (!existingLine || linePrice < existingLine.price) {
                                includedLineMap.set(key, {
                                    id: includedLinePackageId(entry.serviceType, includedId),
                                    name: `${entry.serviceType} - ${line.name}`,
                                    price: linePrice,
                                    warrantyMonths: 3,
                                    description: `Included in ${entry.serviceType}`,
                                    isCustom: linePrice === 0,
                                    parentServiceType: entry.serviceType,
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
                
                // Only auto-add first service if cart is empty and no prefill is pending
                if (items.length === 0 && !prefillDataRef.current?.serviceId) {
                    setItems(prev => {
                        if (prev.length > 0) return prev;
                        // Prefer dynamic packages, but fall back to mock
                        const firstPackage = dynamicPackages.length > 0 
                            ? dynamicPackages[0] 
                            : servicePackages[0];
                        if (firstPackage) {
                            return [{ serviceId: firstPackage.id, quantity: 1 }];
                        }
                        return prev;
                    });
                }
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

    const loadCustomerRequests = async (source = 'unknown') => {
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
            const records = Array.isArray(data) ? data : [];
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
    };

    const loadCustomerRequestsRef = useRef<(source?: string) => ReturnType<typeof loadCustomerRequests>>(
        async () => {},
    );
    loadCustomerRequestsRef.current = (src = 'ref-unknown') => loadCustomerRequests(src);

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
    }, [activeTab, isLoggedIn]);

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
                const resp = await authenticatedFetch('/api/service-providers?scope=all');
                if (!resp.ok) return;
                const data = await resp.json();
                if (!Array.isArray(data)) return;
                const next: Record<string, string> = {};
                data.forEach((p: any) => {
                    const id = p?.id || p?.uid;
                    if (id) next[id] = p?.name || id;
                });
                setProviderNameById(next);
            } catch {
                // Ignore provider-name map failures in tracking tab
            }
        };
        loadProvidersForNames();
    }, [activeTab, isLoggedIn]);
    const [note, setNote] = useState('');
    const [carDetails, setCarDetails] = useState<any>(null);
    const [carForm, setCarForm] = useState({ make: '', model: '', year: '', fuel: '', reg: '', city: '' });
    const [carFormError, setCarFormError] = useState('');
    const [carFormOpen, setCarFormOpen] = useState(true);
    const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
    const [couponInput, setCouponInput] = useState('');
    const [couponMessage, setCouponMessage] = useState('');
    const [isPriceExpanded, setIsPriceExpanded] = useState(false);
    const [isAddOnsExpanded, setIsAddOnsExpanded] = useState(false);
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
                setSelectedAddOns(Array.isArray(parsed.selectedAddOns) ? parsed.selectedAddOns : []);
                setSelectedProviders(parsed.selectedProviders || (serviceProviders[0]?.id ? [serviceProviders[0].id] : []));
                setNote(parsed.note || '');
                if (parsed.carDetails) {
                    setCarDetails(parsed.carDetails);
                    setCarForm(parsed.carDetails);
                    setCarFormOpen(false);
                }
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
            setSelectedAddOns(Array.isArray(parsed.selectedAddOns) ? parsed.selectedAddOns : []);
            setSelectedProviders(parsed.selectedProviders || (serviceProviders[0]?.id ? [serviceProviders[0].id] : []));
            setNote(parsed.note || '');
            if (parsed.carDetails) {
                setCarDetails(parsed.carDetails);
                setCarForm(parsed.carDetails);
                setCarFormOpen(false);
            }
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
                selectedAddOns,
                selectedProviders,
                note,
                carDetails,
                addresses,
            };
            localStorage.setItem(CART_KEY, JSON.stringify(payload));
        } catch { /* storage unavailable */ }
    }, [items, selectedAddress, selectedBookingDate, selectedSlot, selectedCoupon, selectedAddOns, selectedProviders, note, carDetails, addresses]);

    // Store prefill data in a ref to use in multiple effects
    const prefillDataRef = useRef<{
        serviceId: string;
        serviceName?: string;
        price?: number;
        customQuote?: boolean;
        carDetails?: any;
        includedServices?: Array<{ id: string; name: string; price?: number }>;
    } | null>(null);

    // Prefill from session (coming from landing cards or service detail page)
    useEffect(() => {
        let raw: string | null = null;
        try { raw = sessionStorage.getItem('service_cart_prefill'); } catch { /* storage unavailable */ }
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            prefillDataRef.current = parsed;
            
            if (parsed.serviceId) {
                // Check if this is a service ID from ServiceDetail (starts with 'service-')
                if (parsed.serviceId.startsWith('service-')) {
                    // Use the serviceName from parsed data, or extract from serviceId
                    let serviceName = parsed.serviceName;
                    if (!serviceName) {
                        // Fallback: Extract service name from serviceId
                        serviceName = parsed.serviceId
                            .replace('service-', '')
                            .split('-')
                            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                    }
                    
                    // Create a dynamic package for this service
                    const dynamicPackage: ServicePackage = {
                        id: parsed.serviceId,
                        name: serviceName,
                        price: parsed.price || 0,
                        warrantyMonths: 3,
                        description: parsed.customQuote ? 'Custom quote' : '3 months warranty',
                        isCustom: parsed.customQuote || parsed.price === 0,
                    };
                    
                    // Add to available packages and set items in the same update cycle
                    setAvailableServicePackages(prev => {
                        const extraLinePackages: ServicePackage[] = Array.isArray(parsed.includedServices)
                            ? parsed.includedServices.map((line: any) => ({
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
                                const filtered = prevItems.filter((item) => item.serviceId !== parsed.serviceId);
                                const lineItems = extraLinePackages.map((linePkg) => ({ serviceId: linePkg.id, quantity: 1 }));
                                return [...filtered, ...lineItems];
                            }
                            // Check if item already exists
                            if (prevItems.some(item => item.serviceId === parsed.serviceId)) {
                                return prevItems.map(item => 
                                    item.serviceId === parsed.serviceId 
                                        ? { ...item, quantity: Math.max(1, item.quantity) }
                                        : item
                                );
                            }
                            // Add the new item - package is guaranteed to exist in updated array
                            return [...prevItems, { serviceId: parsed.serviceId, quantity: 1 }];
                        });
                        
                        return withLines;
                    });
                } else {
                    // For non-service- prefixed IDs, check if package exists first
                    setItems(prev => {
                        if (prev.some(item => item.serviceId === parsed.serviceId)) {
                            return prev;
                        }
                        // Check if package exists in available packages
                        setAvailableServicePackages(currentPackages => {
                            if (currentPackages.some(p => p.id === parsed.serviceId)) {
                                return currentPackages;
                            }
                            // Package doesn't exist, can't add item
                            return currentPackages;
                        });
                        return [...prev, { serviceId: parsed.serviceId, quantity: 1 }];
                    });
                }
            }
            
            if (parsed.carDetails) {
                setCarDetails(parsed.carDetails);
                setCarForm(parsed.carDetails);
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
        const addOnSubtotal = selectedAddOns.reduce((sum, addOnId) => {
            const addOn = mockAddOns.find((entry) => entry.id === addOnId);
            return sum + (addOn?.price || 0);
        }, 0);
        const subtotal = packageSubtotal + addOnSubtotal;
        const couponValue = coupons.find(c => c.code === selectedCoupon)?.amountOff || 0;
        const discount = Math.min(couponValue, subtotal);
        const pickupFee = subtotal >= 3000 ? 0 : 149;
        const platformFee = subtotal > 0 ? 49 : 0;
        const tax = Math.round(subtotal * 0.05); // simple 5% mock tax
        const total = subtotal - discount + pickupFee + platformFee + tax;
        return { packageSubtotal, addOnSubtotal, subtotal, discount, pickupFee, platformFee, tax, total };
    }, [items, selectedAddOns, selectedCoupon, coupons, selectedProviders, resolveItemUnitPrice]);

    const bookingChecklist = useMemo(() => {
        const slotMeta = timeSlots.find((s) => s.id === selectedSlot);
        return {
            car: Boolean(carDetails),
            address: Boolean(selectedAddress),
            slot: Boolean(selectedSlot && selectedBookingDate && slotMeta),
            package: items.length > 0,
            provider: selectedProviders.length > 0,
            review: totals.total > 0,
        };
    }, [carDetails, selectedAddress, selectedSlot, selectedBookingDate, timeSlots, items.length, selectedProviders.length, totals.total]);

    const checkoutReadiness = useMemo(() => {
        const missing: string[] = [];
        if (!carDetails) missing.push('Add car details');
        if (!selectedAddress) missing.push('Select address');
        if (!selectedBookingDate || !selectedSlot) missing.push('Pick booking date and slot');
        if (items.length === 0) missing.push('Add at least one package');
        if (selectedProviders.length === 0) missing.push('Choose a provider');
        return missing;
    }, [carDetails, selectedAddress, selectedBookingDate, selectedSlot, items.length, selectedProviders.length]);

    const estimatedDurationMins = useMemo(() => {
        const providerId = selectedProviders[0];
        if (!providerId) return undefined;
        const base = estimateBookingEtaMinutes(providerId, items, providerServices, availableServicePackages);
        const addOnMinutes = selectedAddOns.reduce((sum, addOnId) => {
            const addOn = mockAddOns.find((entry) => entry.id === addOnId);
            return sum + (addOn?.durationMins || 0);
        }, 0);
        if (base == null && addOnMinutes === 0) return undefined;
        return (base || 90) + addOnMinutes;
    }, [selectedProviders, items, providerServices, availableServicePackages, selectedAddOns]);

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


    // Map service package IDs to categories
    const SERVICE_PACKAGE_TO_CATEGORY: Record<string, string> = {
        'pkg-comprehensive': 'Essential Service',
        'pkg-standard': 'Deep Detailing',
        'pkg-care-plus': 'Care Plus',
    };

    // Get service categories from selected items
    const selectedServiceCategories = useMemo(() => {
        return items.map(item => {
            const category = SERVICE_PACKAGE_TO_CATEGORY[item.serviceId];
            if (category) return category;
            // Fallback: try to match by name
            const svcMeta = availableServicePackages.find(s => s.id === item.serviceId);
            return svcMeta?.name || item.serviceId;
        }).filter(Boolean);
    }, [items, availableServicePackages]);

    // Get service types from selected items (for backward compatibility)
    const selectedServiceTypes = useMemo(() => {
        const fromItems = items.map(item => {
            const svcMeta = availableServicePackages.find(s => s.id === item.serviceId);
            return svcMeta?.parentServiceType || svcMeta?.name || item.serviceId;
        }).filter(Boolean);
        if (fromItems.length > 0) return fromItems;
        if (activeServicePackageId) {
            const activeMeta = availableServicePackages.find((s) => s.id === activeServicePackageId);
            if (activeMeta?.name) return [activeMeta.name];
        }
        return fromItems;
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

    // Filter providers based on selected service categories and types
    const availableProviders = useMemo(() => {
        if (selectedServiceTypes.length === 0) {
            return serviceProviders; // Show all if no services selected
        }
        
        return serviceProviders.filter(p => {
            // First check if provider has matching categories
            const providerCategories = (p as any).serviceCategories || [];
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

    const updateQuantity = (serviceId: string, delta: number) => {
        setItems(prev => {
            const svcMeta = availableServicePackages.find((s) => s.id === serviceId);
            if (svcMeta?.includedServiceId) {
                // Included line items are binary selections; keep quantity fixed at 1.
                return prev;
            }
            const next = prev.map(item => item.serviceId === serviceId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item);
            return next;
        });
    };

    const selectServiceForBooking = (serviceId: string) => {
        setHasExplicitServiceSelection(true);
        setActiveServicePackageId(serviceId);
        const selectedMeta =
            websiteServicePackages.find((pkg) => pkg.id === serviceId) ||
            availableServicePackages.find((pkg) => pkg.id === serviceId);
        if (!selectedMeta) return;
        // Always default to "Full service" mode so customers get a single-click
        // booking experience. They can switch to "Pick sub-services" via the
        // toggle to customise which sub-services are included.
        setItems([{ serviceId, quantity: 1 }]);
    };

    /** Book the full bundled service (provider's declared base price). */
    const pickFullServiceForActive = () => {
        if (!activeServicePackageId) return;
        setItems([{ serviceId: activeServicePackageId, quantity: 1 }]);
    };

    /** Switch to sub-service selection mode for the active parent service. */
    const pickSubServicesForActive = () => {
        if (!activeServicePackageId) return;
        setItems((prev) => prev.filter((entry) => entry.serviceId !== activeServicePackageId));
    };

    /** Select every available sub-service under the active parent service. */
    const selectAllSubServicesForActive = () => {
        if (!activeServicePackageId) return;
        const activeService = availableServicePackages.find((pkg) => pkg.id === activeServicePackageId);
        if (!activeService) return;
        const parentType = (activeService.parentServiceType || activeService.name).toLowerCase();
        const subIds = availableServicePackages
            .filter(
                (pkg) =>
                    pkg.includedServiceId &&
                    (pkg.parentServiceType || '').toLowerCase() === parentType,
            )
            .map((pkg) => pkg.id);
        setItems((prev) => {
            const withoutParent = prev.filter((entry) => entry.serviceId !== activeServicePackageId);
            const existing = new Set(withoutParent.map((entry) => entry.serviceId));
            const additions = subIds
                .filter((id) => !existing.has(id))
                .map((id) => ({ serviceId: id, quantity: 1 }));
            return [...withoutParent, ...additions];
        });
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

    const removeService = (serviceId: string) => {
        setItems(prev => prev.filter(i => i.serviceId !== serviceId));
    };

    const handleApplyCoupon = (code: string) => {
        if (coupons.some(c => c.code === code)) {
            setSelectedCoupon(code);
            setCouponMessage(`Coupon ${code} applied.`);
        } else {
            setCouponMessage('Coupon code is not valid.');
        }
    };

    const toggleAddOn = (addOnId: string) => {
        setSelectedAddOns((prev) =>
            prev.includes(addOnId) ? prev.filter((entry) => entry !== addOnId) : [...prev, addOnId],
        );
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
            addOns: selectedAddOns
                .map((id) => {
                    const addOn = mockAddOns.find((entry) => entry.id === id);
                    return addOn ? { id: addOn.id, name: addOn.name, price: addOn.price } : null;
                })
                .filter(Boolean) as Array<{ id: string; name: string; price: number }>,
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-lg sm:text-xl">
                                SC
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black leading-tight">Service Cart</h1>
                                <p className="text-white/90 mt-1 text-sm sm:text-base">Complete your service booking</p>
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

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
                <section className="mb-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Booking progress</h2>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {Object.values(bookingChecklist).filter(Boolean).length}/{BOOKING_STEPS.length} complete
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {BOOKING_STEPS.map((step, index) => {
                            const done = bookingChecklist[step.key];
                            return (
                                <div
                                    key={step.key}
                                    className={`rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
                                        done
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                                            : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                                    }`}
                                >
                                    <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                                        {done ? '✓' : index + 1}
                                    </span>
                                    {step.label}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                    <div className="lg:col-span-2 space-y-4">
                        {/* Car Details Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Car details</h2>
                                {carDetails && (
                                    <button
                                        onClick={() => setCarFormOpen(!carFormOpen)}
                                        className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2"
                                    >
                                        {carFormOpen ? (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Hide
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                            {carDetails && !carFormOpen && (
                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {carDetails.make} {carDetails.model}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        {carDetails.year} · {carDetails.fuel}
                                        {(carDetails.reg || carDetails.city) ? ` · ${[carDetails.reg, carDetails.city].filter(Boolean).join(' · ')}` : ''}
                                    </div>
                                </div>
                            )}
                            {(carFormOpen || !carDetails) && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input
                                            className="border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="Make *"
                                            value={carForm.make}
                                            onChange={(e) => setCarForm({ ...carForm, make: e.target.value })}
                                        />
                                        <input
                                            className="border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="Model *"
                                            value={carForm.model}
                                            onChange={(e) => setCarForm({ ...carForm, model: e.target.value })}
                                        />
                                        <input
                                            className="border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="Year *"
                                            value={carForm.year}
                                            onChange={(e) => setCarForm({ ...carForm, year: e.target.value })}
                                        />
                                        <input
                                            className="border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="Fuel *"
                                            value={carForm.fuel}
                                            onChange={(e) => setCarForm({ ...carForm, fuel: e.target.value })}
                                        />
                                        <input
                                            className="border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="Registration number"
                                            value={carForm.reg}
                                            onChange={(e) => setCarForm({ ...carForm, reg: e.target.value })}
                                        />
                                        <input
                                            className="border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="City / Pincode"
                                            value={carForm.city}
                                            onChange={(e) => setCarForm({ ...carForm, city: e.target.value })}
                                        />
                                    </div>
                                    {carFormError && (
                                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                                            {carFormError}
                                        </div>
                                    )}
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={handleSaveCarDetails}
                                            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
                                        >
                                            Save car details
                                        </button>
                                    </div>
                                </>
                            )}
                        </section>

                        {/* Address Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Address</h2>
                                <button
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
                                    className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add address
                                </button>
                            </div>
                            <div className="space-y-3">
                                {addresses.map(addr => {
                                    const isEditing = editingAddressId === addr.id;
                                    return (
                                        <div key={addr.id} className={`p-3 rounded-lg border transition-colors ${selectedAddress === addr.id ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 bg-white dark:bg-gray-900'}`}>
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-sm font-bold text-gray-900 dark:text-white">Label</label>
                                                        <button
                                                            onClick={() => {
                                                                setEditingAddressId(null);
                                                                setAddressForm({});
                                                            }}
                                                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-semibold"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={addressForm.label || addr.label}
                                                        onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                                                        placeholder="e.g., Home, Office"
                                                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={addressForm.line1 || addr.line1}
                                                        onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                                                        placeholder="Street address"
                                                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                                                    />
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <input
                                                            type="text"
                                                            value={addressForm.city || addr.city}
                                                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                                                            placeholder="City"
                                                            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={addressForm.state || addr.state}
                                                            onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                                                            placeholder="State"
                                                            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={addressForm.pincode || addr.pincode}
                                                        onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                                                        placeholder="Pincode"
                                                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                                                    />
                                                    <div className="flex gap-3 justify-end mt-4">
                                                        <button
                                                            onClick={() => {
                                                                setAddresses(prev => prev.filter(a => a.id !== addr.id));
                                                                if (selectedAddress === addr.id) {
                                                                    setSelectedAddress(addresses.find(a => a.id !== addr.id)?.id || '');
                                                                }
                                                                setEditingAddressId(null);
                                                                setAddressForm({});
                                                            }}
                                                            className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-semibold transition-colors"
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
                                                            className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className="flex items-start gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        className="mt-1 w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                                        checked={selectedAddress === addr.id}
                                                        onChange={() => setSelectedAddress(addr.id)}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <div className="font-black text-gray-900 dark:text-white">{addr.label}</div>
                                                            <button
                                                                onClick={(e) => {
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
                                                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                                Edit
                                                            </button>
                                                        </div>
                                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{addr.line1}, {addr.city} {addr.pincode}</div>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                                            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold">
                                                                {selectedProviderPrimary?.distanceKm ? `${selectedProviderPrimary.distanceKm.toFixed(1)} km from provider` : 'Route optimized'}
                                                            </span>
                                                            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold">
                                                                Home pickup included
                                                            </span>
                                                        </div>
                                                    </div>
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Slot Selection Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Slot selection</h2>
                            <div className="mb-5">
                                <label htmlFor="service-booking-date" className="text-sm font-bold text-gray-900 dark:text-white mb-2 block">
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
                                    className="w-full max-w-xs border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:light] dark:[color-scheme:dark]"
                                />
                                {scheduleError ? (
                                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{scheduleError}</p>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap gap-3 mb-6">
                                {timeSlots.map(slot => (
                                    <button
                                        key={slot.id}
                                        onClick={() => {
                                            setSelectedSlot(slot.id);
                                            setScheduleError('');
                                        }}
                                        className={`px-5 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                            selectedSlot === slot.id 
                                                ? 'border-blue-600 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                                                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-900'
                                        }`}
                                    >
                                        <div className="font-semibold">{slot.label}</div>
                                        {selectedSlot === slot.id && slotDemandLevel && (
                                            <div className="text-[10px] mt-1 opacity-90">{slotDemandLevel}</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {completionEstimate && (
                                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    {completionEstimate}
                                </div>
                            )}
                            <div>
                                <label className="text-sm font-bold text-gray-900 dark:text-white mb-2 block">Note (optional)</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                    rows={3}
                                    placeholder="Any warning lights? Pickup landmark? Preferred call time?"
                                />
                            </div>
                        </section>

                    </div>

                    <div className="space-y-4">
                        {/* Service Section — single list, inline sub-service picker */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Service</h3>
                                {items.length > 0 && totals.packageSubtotal > 0 && (
                                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 tabular-nums">
                                        ₹{totals.packageSubtotal.toLocaleString('en-IN')}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                {websiteServicePackages.map((pkg) => {
                                    const isActive = hasExplicitServiceSelection && activeServicePackageId === pkg.id;
                                    const subServices = isActive ? includedOptionsForActiveServicePriced : [];
                                    const hasSubs = subServices.length > 0;
                                    const isFullServiceMode = isActive && items.some((i) => i.serviceId === pkg.id);
                                    const selectedSubs = isActive
                                        ? items.filter((i) => subServices.some((s) => s.id === i.serviceId)).length
                                        : 0;
                                    const providerPrice = isActive
                                        ? resolveItemUnitPrice({ serviceId: pkg.id, quantity: 1 }, selectedProviders[0])
                                        : undefined;
                                    const displayPrice = providerPrice ?? pkg.price;
                                    return (
                                        <div
                                            key={pkg.id}
                                            className={`rounded-lg border transition-colors ${
                                                isActive
                                                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/10'
                                                    : 'border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => selectServiceForBooking(pkg.id)}
                                                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span
                                                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                                            isActive
                                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                                : 'border-gray-300 bg-white text-transparent'
                                                        }`}
                                                    >
                                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                            {pkg.name}
                                                        </div>
                                                        {pkg.description && !isActive && (
                                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                                {pkg.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400 shrink-0 tabular-nums">
                                                    {displayPrice > 0
                                                        ? `₹${displayPrice.toLocaleString('en-IN')}`
                                                        : 'At checkout'}
                                                </span>
                                            </button>

                                            {/* Inline detail panel for the active service */}
                                            {isActive && hasSubs && (
                                                <div className="border-t border-blue-100 dark:border-blue-900/40 px-3 py-3 space-y-2.5">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={pickFullServiceForActive}
                                                            aria-pressed={isFullServiceMode}
                                                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                                isFullServiceMode
                                                                    ? 'border-blue-600 bg-blue-600 text-white'
                                                                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600'
                                                            }`}
                                                        >
                                                            Full service
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={pickSubServicesForActive}
                                                            aria-pressed={!isFullServiceMode}
                                                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                                !isFullServiceMode
                                                                    ? 'border-blue-600 bg-blue-600 text-white'
                                                                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600'
                                                            }`}
                                                        >
                                                            Pick items{selectedSubs > 0 ? ` (${selectedSubs})` : ''}
                                                        </button>
                                                    </div>
                                                    {!isFullServiceMode && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                                    Sub-services
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={selectAllSubServicesForActive}
                                                                    className="text-[11px] font-semibold text-blue-700 hover:underline"
                                                                >
                                                                    Select all
                                                                </button>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {subServices.map((line) => {
                                                                    const checked = items.some((item) => item.serviceId === line.id);
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            key={line.id}
                                                                            onClick={() => toggleIncludedServiceLine(line.id)}
                                                                            aria-pressed={checked}
                                                                            className={`flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                                                                                checked
                                                                                    ? 'border-blue-500 bg-blue-100/60 dark:bg-blue-900/30'
                                                                                    : 'border-gray-200 bg-white hover:border-blue-300 dark:bg-gray-900 dark:border-gray-700'
                                                                            }`}
                                                                        >
                                                                            <span className="flex items-center gap-2 min-w-0">
                                                                                <span
                                                                                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                                                        checked
                                                                                            ? 'border-blue-600 bg-blue-600 text-white'
                                                                                            : 'border-gray-300 bg-white text-transparent'
                                                                                    }`}
                                                                                >
                                                                                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path
                                                                                            strokeLinecap="round"
                                                                                            strokeLinejoin="round"
                                                                                            strokeWidth={3}
                                                                                            d="M5 13l4 4L19 7"
                                                                                        />
                                                                                    </svg>
                                                                                </span>
                                                                                <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                                                                                    {line.name}
                                                                                </span>
                                                                            </span>
                                                                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 shrink-0 tabular-nums">
                                                                                {line.providerPrice != null && line.providerPrice > 0
                                                                                    ? `₹${line.providerPrice.toLocaleString('en-IN')}`
                                                                                    : 'At checkout'}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {isActive && !hasSubs && (
                                                <div className="border-t border-blue-100 dark:border-blue-900/40 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                                                    Sub-services not published yet — provider will confirm pricing on acceptance.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>


                        {/* Provider Selection Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Provider</h3>
                                {onUseMyLocation && (
                                    <button
                                        type="button"
                                        onClick={onUseMyLocation}
                                        disabled={isLocating}
                                        className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-60"
                                    >
                                        {isLocating ? 'Detecting…' : 'Use my location'}
                                    </button>
                                )}
                            </div>
                            {selectedServiceTypes.length === 0 ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Select a service above to see available providers.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {sortedAvailableProviders.map(p => {
                                        const totals = providerTotals[p.id];
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
                                        const isSelected = selectedProviders.includes(p.id);
                                        return (
                                            <label
                                                key={p.id}
                                                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/10'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setSelectedProviders(prev =>
                                                            checked
                                                                ? Array.from(new Set([...prev, p.id]))
                                                                : prev.filter(id => id !== p.id),
                                                        );
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                            {p.name}
                                                        </div>
                                                        {totals && totals.total > 0 && (
                                                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400 tabular-nums shrink-0">
                                                                ₹{totals.total.toLocaleString('en-IN')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                                                        {rating != null && <span>★ {rating.toFixed(1)}</span>}
                                                        <span>{p.city}</span>
                                                        {p.distanceKm ? <span>{p.distanceKm} km</span> : null}
                                                        {etaMin != null ? <span>~{etaMin} min</span> : null}
                                                    </div>
                                                    {!totals && (
                                                        <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                                            Pricing not set for selected services.
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                    {availableProviders.length === 0 && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
                                            No providers offer all selected services.
                                        </div>
                                    )}
                                    {locationError && (
                                        <div className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                                            {locationError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Add-ons (collapsible) */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                            <button
                                type="button"
                                onClick={() => setIsAddOnsExpanded((prev) => !prev)}
                                className="w-full flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Add-ons</h3>
                                    {selectedAddOns.length > 0 && (
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                                            {selectedAddOns.length} selected
                                        </span>
                                    )}
                                </div>
                                <svg
                                    className={`w-4 h-4 text-gray-400 transition-transform ${isAddOnsExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {isAddOnsExpanded && (
                                <div className="mt-3 space-y-2">
                                    {mockAddOns.map((addOn) => {
                                        const selected = selectedAddOns.includes(addOn.id);
                                        return (
                                            <button
                                                key={addOn.id}
                                                type="button"
                                                onClick={() => toggleAddOn(addOn.id)}
                                                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                                                    selected
                                                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{addOn.name}</div>
                                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                            {addOn.description} · {addOn.durationMins} min
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-semibold text-blue-700 dark:text-blue-400 tabular-nums shrink-0">
                                                        ₹{addOn.price.toLocaleString('en-IN')}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Coupon (compact inline) */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Coupon</h3>
                            <div className="flex gap-2">
                                <input
                                    value={couponInput}
                                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                    placeholder="Enter code"
                                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    type="button"
                                    onClick={applyCouponInput}
                                    className="px-4 py-2 rounded-md bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-semibold"
                                >
                                    Apply
                                </button>
                            </div>
                            {bestCoupon && !selectedCoupon && (
                                <button
                                    type="button"
                                    onClick={() => handleApplyCoupon(bestCoupon.code)}
                                    className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                                >
                                    Auto-apply best offer ({bestCoupon.code})
                                </button>
                            )}
                            {couponMessage && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{couponMessage}</p>}
                            <div className="flex flex-wrap gap-2 mt-3">
                                {coupons.map(c => (
                                    <button
                                        key={c.code}
                                        onClick={() => handleApplyCoupon(c.code)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                            selectedCoupon === c.code
                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                                        }`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Payment Summary */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 lg:sticky lg:top-4">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Payment summary</h3>
                            {checkoutReadiness.length > 0 && (
                                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                    Complete: {checkoutReadiness.join(' • ')}
                                </div>
                            )}
                            <div className="space-y-2 text-sm mb-4">
                                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                                    <span>Services</span>
                                    <span className="font-semibold tabular-nums">₹{totals.packageSubtotal.toLocaleString('en-IN')}</span>
                                </div>
                                {totals.addOnSubtotal > 0 && (
                                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                                        <span>Add-ons</span>
                                        <span className="font-semibold tabular-nums">₹{totals.addOnSubtotal.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsPriceExpanded((prev) => !prev)}
                                    className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                                >
                                    {isPriceExpanded ? 'Hide fees' : 'Show fees'}
                                </button>
                                {isPriceExpanded && (
                                    <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 pl-2">
                                        <div className="flex justify-between">
                                            <span>Pickup fee</span>
                                            <span className="tabular-nums">{totals.pickupFee === 0 ? 'Free' : `₹${totals.pickupFee.toLocaleString('en-IN')}`}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Platform fee</span>
                                            <span className="tabular-nums">₹{totals.platformFee.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                )}
                                {totals.discount > 0 && (
                                    <div className="flex justify-between text-green-600 dark:text-green-400">
                                        <span>Discount</span>
                                        <span className="font-semibold tabular-nums">-₹{totals.discount.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                                    <span>Taxes</span>
                                    <span className="font-semibold tabular-nums">₹{totals.tax.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <span>Total</span>
                                    <span className="tabular-nums">₹{totals.total.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={checkoutReadiness.length > 0}
                            >
                                Place service request
                            </button>
                            {selectedCoupon && totals.discount > 0 && (
                                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold text-center">
                                    You saved ₹{totals.discount.toLocaleString('en-IN')}
                                </p>
                            )}
                            <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 text-center">
                                Free cancellation up to 2h · 3-month warranty
                            </p>
                        </section>
                    </div>
                </div>
            </div>
            </>
            )}
        </div>
    );
};

export default ServiceCart;


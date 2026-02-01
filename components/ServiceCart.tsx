import React, { useEffect, useMemo, useState } from 'react';

type ServicePackage = {
    id: string;
    name: string;
    price: number;
    warrantyMonths: number;
    description?: string;
    isCustom?: boolean;
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
    serviceCategories?: string[];
    services?: Array<{
        serviceType: string;
        price?: number;
        description?: string;
        etaMinutes?: number;
        active?: boolean;
    }>;
};

type Coupon = {
    code: string;
    label: string;
    amountOff: number;
};

type Props = {
    isLoggedIn: boolean;
    onLogin?: () => void;
    onSubmitRequest?: (payload: {
        items: Array<{ serviceId: string; quantity: number }>;
        addressId: string;
        address?: Address;
        slotId: string;
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

const mockSlots: TimeSlot[] = [
    { id: 'slot-1', label: 'Tomorrow 10:00 - 12:00' },
    { id: 'slot-2', label: 'Tomorrow 12:00 - 14:00' },
    { id: 'slot-3', label: 'Tomorrow 14:00 - 16:00' },
];

const mockProviders: ServiceProvider[] = [
    { id: 'sp-1', name: 'City Auto Care', city: 'London', distanceKm: 4.2 },
    { id: 'sp-2', name: 'Prime Garage', city: 'London', distanceKm: 6.8 },
];

const mockCoupons: Coupon[] = [
    { code: 'SAVE200', label: 'Flat ₹200 off', amountOff: 200 },
    { code: 'SAVE10', label: '10% off up to ₹500', amountOff: 500 }, // capped; simplified as flat for mock
];

const CART_KEY = 'service_cart_v1';

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
}) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
    const [selectedAddress, setSelectedAddress] = useState(addresses[0]?.id || '');
    const [selectedSlot, setSelectedSlot] = useState(timeSlots[0]?.id || '');
    const [selectedCoupon, setSelectedCoupon] = useState<string | undefined>();
    const [selectedProviders, setSelectedProviders] = useState<string[]>(serviceProviders[0]?.id ? [serviceProviders[0].id] : []);
    const [providerServices, setProviderServices] = useState<Record<string, ServiceProvider['services']>>({});
    const [availableServicePackages, setAvailableServicePackages] = useState<ServicePackage[]>(servicePackages);

    useEffect(() => {
        const fetchProviderServices = async () => {
            try {
                // Fetch provider services
                const servicesResp = await fetch('/api/provider-services?scope=public');
                
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
                    });
                });
                setProviderServices(grouped);
                
                // Build service packages from actual provider services
                const serviceTypeMap = new Map<string, { price?: number; description?: string; etaMinutes?: number; count: number }>();
                servicesData.forEach((entry: any) => {
                    if (!entry.serviceType || entry.active === false) return;
                    const existing = serviceTypeMap.get(entry.serviceType) || { count: 0 };
                    serviceTypeMap.set(entry.serviceType, {
                        price: existing.price === undefined ? entry.price : Math.min(existing.price || Infinity, entry.price || Infinity),
                        description: entry.description || existing.description,
                        etaMinutes: entry.etaMinutes || existing.etaMinutes,
                        count: existing.count + 1,
                    });
                });
                
                // Convert to service packages
                const dynamicPackages: ServicePackage[] = Array.from(serviceTypeMap.entries())
                    .filter(([_, meta]) => meta.count > 0) // Only show services that at least one provider offers
                    .map(([serviceType, meta]) => ({
                        id: `pkg-${serviceType.toLowerCase().replace(/\s+/g, '-')}`,
                        name: serviceType,
                        price: meta.price || 0,
                        warrantyMonths: 3, // Default warranty
                        description: meta.description || `${meta.count} provider${meta.count > 1 ? 's' : ''} available`,
                        isCustom: meta.price === undefined || meta.price === 0,
                    }));
                
                // If we have dynamic packages, use them; otherwise fall back to mock
                if (dynamicPackages.length > 0) {
                    setAvailableServicePackages(dynamicPackages);
                    // Update items if the first service is no longer available
                    setItems(prev => {
                        const validItems = prev.filter(item => 
                            dynamicPackages.some(pkg => pkg.id === item.serviceId)
                        );
                        // If no valid items, add the first available service
                        if (validItems.length === 0 && dynamicPackages[0]) {
                            return [{ serviceId: dynamicPackages[0].id, quantity: 1 }];
                        }
                        return validItems;
                    });
                } else {
                    // Fall back to provided servicePackages or mock
                    setAvailableServicePackages(servicePackages);
                    if (items.length === 0 && servicePackages[0]) {
                        setItems([{ serviceId: servicePackages[0].id, quantity: 1 }]);
                    }
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
    const [note, setNote] = useState('');
    const [carDetails, setCarDetails] = useState<any>(null);
    const [carForm, setCarForm] = useState({ make: '', model: '', year: '', fuel: '', reg: '', city: '' });
    const [carFormError, setCarFormError] = useState('');
    const [carFormOpen, setCarFormOpen] = useState(true);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [addressForm, setAddressForm] = useState<Partial<Address>>({});

    // Persist cart state
    useEffect(() => {
        const payload = { items, selectedAddress, selectedSlot, selectedCoupon, selectedProviders, note, carDetails, addresses };
        localStorage.setItem(CART_KEY, JSON.stringify(payload));
    }, [items, selectedAddress, selectedSlot, selectedCoupon, selectedProviders, note, carDetails, addresses]);

    // Load persisted cart
    useEffect(() => {
        const raw = localStorage.getItem(CART_KEY);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (parsed.addresses && Array.isArray(parsed.addresses) && parsed.addresses.length > 0) {
                setAddresses(parsed.addresses);
            }
            setItems(parsed.items || []);
            setSelectedAddress(parsed.selectedAddress || addresses[0]?.id || '');
            setSelectedSlot(parsed.selectedSlot || timeSlots[0]?.id || '');
            setSelectedCoupon(parsed.selectedCoupon);
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

    // Prefill from session (coming from landing cards or service detail page)
    useEffect(() => {
        const raw = sessionStorage.getItem('service_cart_prefill');
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
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
                    
                    // Add to available packages if it doesn't exist
                    setAvailableServicePackages(prev => {
                        if (prev.some(p => p.id === dynamicPackage.id)) {
                            // Update existing package with new data
                            return prev.map(p => p.id === dynamicPackage.id ? dynamicPackage : p);
                        }
                        return [...prev, dynamicPackage];
                    });
                }
                
                setItems([{ serviceId: parsed.serviceId, quantity: 1 }]);
            }
            if (parsed.carDetails) {
                setCarDetails(parsed.carDetails);
                setCarForm(parsed.carDetails);
                setCarFormOpen(false);
            }
            // Clear the prefill after using it
            sessionStorage.removeItem('service_cart_prefill');
        } catch {
            // ignore
        }
    }, []);

    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, item) => {
            const svc = availableServicePackages.find(s => s.id === item.serviceId);
            return sum + (svc ? svc.price * item.quantity : 0);
        }, 0);
        const couponValue = coupons.find(c => c.code === selectedCoupon)?.amountOff || 0;
        const discount = Math.min(couponValue, subtotal);
        const tax = Math.round(subtotal * 0.05); // simple 5% mock tax
        const total = subtotal - discount + tax;
        return { subtotal, discount, tax, total };
    }, [items, selectedCoupon, coupons, availableServicePackages]);


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
        return items.map(item => {
            const svcMeta = availableServicePackages.find(s => s.id === item.serviceId);
            return svcMeta?.name || item.serviceId;
        }).filter(Boolean);
    }, [items, availableServicePackages]);

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
                const serviceName = svcMeta?.name || item.serviceId;
                const match = services.find(s => s.serviceType === serviceName && s.active !== false);
                const price = match?.price;
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

    const updateQuantity = (serviceId: string, delta: number) => {
        setItems(prev => {
            const next = prev.map(item => item.serviceId === serviceId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item);
            return next;
        });
    };

    const addService = (serviceId: string) => {
        setItems(prev => {
            if (prev.some(i => i.serviceId === serviceId)) return prev;
            return [...prev, { serviceId, quantity: 1 }];
        });
    };

    const removeService = (serviceId: string) => {
        setItems(prev => prev.filter(i => i.serviceId !== serviceId));
    };

    const handleApplyCoupon = (code: string) => {
        if (coupons.some(c => c.code === code)) {
            setSelectedCoupon(code);
        }
    };

    const handleSubmit = async () => {
        if (!isLoggedIn) {
            onLogin?.();
            return;
        }
        if (!selectedAddress || !selectedSlot || items.length === 0) return;
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
        
        const payload = {
            items,
            addressId: selectedAddress,
            address: addresses.find(a => a.id === selectedAddress),
            slotId: selectedSlot,
            couponCode: selectedCoupon,
            providerId: primaryProviderId,
            total: totals.total,
            note,
            carDetails,
        };
        await onSubmitRequest?.(payload);
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

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Car Details Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-black text-gray-900 dark:text-white">Car Details</h2>
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
                                <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-blue-200 dark:border-gray-600">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                            🚗
                                        </div>
                                        <div>
                                            <div className="font-black text-lg text-gray-900 dark:text-white">{carDetails.make} {carDetails.model}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">{carDetails.year} • {carDetails.fuel}</div>
                                            {(carDetails.reg || carDetails.city) && (
                                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{carDetails.reg} {carDetails.city}</div>
                                            )}
                                        </div>
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
                                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                                        >
                                            Save car details
                                        </button>
                                    </div>
                                </>
                            )}
                        </section>

                        {/* Address Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-black text-gray-900 dark:text-white">Address</h2>
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
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Address
                                </button>
                            </div>
                            <div className="space-y-3">
                                {addresses.map(addr => {
                                    const isEditing = editingAddressId === addr.id;
                                    return (
                                        <div key={addr.id} className={`p-4 rounded-xl border-2 transition-all ${selectedAddress === addr.id ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 shadow-md' : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-900'}`}>
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
                                                    </div>
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Slot Selection Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Slot Selection</h2>
                            <div className="flex flex-wrap gap-3 mb-6">
                                {timeSlots.map(slot => (
                                    <button
                                        key={slot.id}
                                        onClick={() => setSelectedSlot(slot.id)}
                                        className={`px-5 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                            selectedSlot === slot.id 
                                                ? 'border-blue-600 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                                                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-900'
                                        }`}
                                    >
                                        {slot.label}
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-900 dark:text-white mb-2 block">Note (optional)</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                    rows={3}
                                    placeholder="Add vehicle details, preferred time window, etc."
                                />
                            </div>
                        </section>

                    </div>

                    <div className="space-y-6">
                        {/* Order Details Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white">Selected Packages</h3>
                                {items.length > 0 && (
                                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold">
                                        {items.length} {items.length === 1 ? 'Package' : 'Packages'}
                                    </span>
                                )}
                            </div>
                            
                            {items.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">No packages selected</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Add a service package below to get started</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {items.map((item, index) => {
                                        const svc = availableServicePackages.find(s => s.id === item.serviceId);
                                        if (!svc) {
                                            console.warn('Service package not found for item:', item.serviceId);
                                            return null;
                                        }
                                        const itemTotal = svc.price * item.quantity;
                                        return (
                                            <div key={`${item.serviceId}-${index}`} className="relative flex flex-col sm:flex-row gap-4 sm:gap-4 items-start bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 sm:p-6 border-2 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-shadow">
                                                {/* Selected Badge */}
                                                <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center shadow-md">
                                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                
                                                {/* Package Icon */}
                                                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg flex-shrink-0">
                                                    {svc.name.slice(0, 1)}
                                                </div>
                                                
                                                {/* Package Details */}
                                                <div className="flex-1 min-w-0 w-full sm:pr-8">
                                                    {/* Package Name */}
                                                    <div className="font-black text-gray-900 dark:text-white text-lg sm:text-xl mb-2 pr-8 sm:pr-0">
                                                        {svc.name}
                                                    </div>
                                                    
                                                    {/* Warranty & Description */}
                                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                                        {svc.warrantyMonths > 0 && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-semibold">
                                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                </svg>
                                                                {svc.warrantyMonths} months warranty
                                                            </span>
                                                        )}
                                                        {svc.description && (
                                                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                                                                {svc.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Price Information */}
                                                    <div className="mb-3 sm:mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                                                            <div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Unit Price</div>
                                                                <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                                                                    {svc.price > 0 ? `₹${svc.price.toLocaleString()}` : 'Custom quote'}
                                                                </div>
                                                            </div>
                                                            {item.quantity > 1 && (
                                                                <div className="text-left sm:text-right">
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</div>
                                                                    <div className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                                                                        {item.quantity} × ₹{svc.price.toLocaleString()} = ₹{itemTotal.toLocaleString()}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Quantity Controls & Actions */}
                                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                                        {/* Mobile: Stack vertically, Desktop: Side by side */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                            {/* Quantity Section */}
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Quantity</label>
                                                                <div className="flex items-center gap-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm w-fit">
                                                                    <button
                                                                        onClick={() => updateQuantity(item.serviceId, -1)}
                                                                        className="h-9 w-9 rounded-l-lg flex items-center justify-center text-gray-700 dark:text-gray-300 active:bg-blue-100 dark:active:bg-blue-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all font-bold text-lg border-r border-gray-300 dark:border-gray-600 touch-manipulation"
                                                                        aria-label="Decrease quantity"
                                                                    >−</button>
                                                                    <span className="h-9 w-10 flex items-center justify-center text-base font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border-x border-gray-300 dark:border-gray-600">
                                                                        {item.quantity}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => updateQuantity(item.serviceId, 1)}
                                                                        className="h-9 w-9 rounded-r-lg flex items-center justify-center text-gray-700 dark:text-gray-300 active:bg-blue-100 dark:active:bg-blue-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all font-bold text-lg border-l border-gray-300 dark:border-gray-600 touch-manipulation"
                                                                        aria-label="Increase quantity"
                                                                    >+</button>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Remove Button */}
                                                            <div className="flex flex-col sm:items-end">
                                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide sm:opacity-0 sm:h-0">Action</label>
                                                                <button
                                                                    onClick={() => removeService(item.serviceId)}
                                                                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 active:bg-red-100 dark:active:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 font-semibold rounded-lg transition-all border border-red-300 dark:border-red-700 hover:border-red-400 dark:hover:border-red-600 shadow-sm hover:shadow touch-manipulation min-h-[36px] sm:min-h-0"
                                                                    aria-label="Remove package"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                    <span className="text-sm">Remove</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Add More Packages Section - Suggestions */}
                            {items.length > 0 && availableServicePackages.filter(pkg => !items.some(item => item.serviceId === pkg.id)).length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                    <h4 className="text-base font-black text-gray-900 dark:text-white mb-1">Suggested Packages</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Add more services to your order</p>
                                    <div className="space-y-3">
                                        {availableServicePackages
                                            .filter(pkg => !items.some(item => item.serviceId === pkg.id))
                                            .map(pkg => (
                                            <button
                                                key={pkg.id}
                                                onClick={() => addService(pkg.id)}
                                                className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-left hover:border-blue-500 dark:hover:border-blue-600 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 font-semibold transition-all bg-white dark:bg-gray-900 flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-4 flex-1">
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-md flex-shrink-0">
                                                        {pkg.name.slice(0, 1)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-black text-gray-900 dark:text-white text-base mb-1">{pkg.name}</div>
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                                            {pkg.warrantyMonths > 0 && (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                    </svg>
                                                                    {pkg.warrantyMonths} months warranty
                                                                </span>
                                                            )}
                                                            {pkg.description && <span>• {pkg.description}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <div className="text-right">
                                                        <div className="text-base font-black text-blue-600 dark:text-blue-400">
                                                            {pkg.price > 0 ? `₹${pkg.price.toLocaleString()}` : 'Custom quote'}
                                                        </div>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Show all packages if none selected */}
                            {items.length === 0 && (
                                <div className="mt-4">
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Available Packages</h4>
                                    <div className="space-y-2">
                                        {availableServicePackages.map(pkg => (
                                            <button
                                                key={pkg.id}
                                                onClick={() => addService(pkg.id)}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-semibold transition-all bg-white dark:bg-gray-900 flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-sm">
                                                        {pkg.name.slice(0, 1)}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-bold">{pkg.name}</div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">{pkg.description}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                                        {pkg.price > 0 ? `₹${pkg.price.toLocaleString()}` : 'Custom quote'}
                                                    </span>
                                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Provider Selection Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Choose Provider</h3>
                                    {selectedServiceTypes.length > 0 && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            Showing providers for: {selectedServiceTypes.join(', ')}
                                        </p>
                                    )}
                                </div>
                                {onUseMyLocation && (
                                    <button
                                        type="button"
                                        onClick={onUseMyLocation}
                                        disabled={isLocating}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-60 transition-colors"
                                    >
                                        {isLocating ? 'Detecting...' : 'Use my location'}
                                    </button>
                                )}
                            </div>
                            {selectedServiceTypes.length === 0 && (
                                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
                                    <p className="text-sm text-amber-800 dark:text-amber-300 font-semibold">
                                        Please select a service above to see available providers.
                                    </p>
                                </div>
                            )}
                            <div className="space-y-3">
                                {sortedAvailableProviders.map(p => {
                                    const totals = providerTotals[p.id];
                                    return (
                                        <label key={p.id} className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                            selectedProviders.includes(p.id)
                                                ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 shadow-md'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-900'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 mt-1 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                                checked={selectedProviders.includes(p.id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setSelectedProviders(prev =>
                                                        checked ? Array.from(new Set([...prev, p.id])) : prev.filter(id => id !== p.id)
                                                    );
                                                }}
                                            />
                                            <div className="flex-1 space-y-2">
                                                <div className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                    <span>{p.name}</span>
                                                    {totals && totals.total > 0 && (
                                                        <span className="text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1 rounded-full">
                                                            ₹{totals.total.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">{p.city}{p.distanceKm ? ` • ${p.distanceKm} km away` : ''}</div>
                                                {totals && totals.breakdown.some(b => b.price !== undefined) && (
                                                    <div className="text-xs text-gray-700 dark:text-gray-300 flex flex-wrap gap-2">
                                                        {totals.breakdown.map(b => (
                                                            <span key={b.id} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full font-semibold">
                                                                {b.name}{b.price !== undefined ? ` • ₹${b.price}` : ''}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {!totals && (
                                                    <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Pricing not set for selected services.</div>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                                {availableProviders.length === 0 && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">No providers offer all selected services.</div>
                                )}
                                {locationError && (
                                    <div className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                                        {locationError}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Coupons Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4">Coupons</h3>
                            <div className="flex flex-wrap gap-3">
                                {coupons.map(c => (
                                    <button
                                        key={c.code}
                                        onClick={() => handleApplyCoupon(c.code)}
                                        className={`px-5 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                            selectedCoupon === c.code 
                                                ? 'border-blue-600 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                                                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-900'
                                        }`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Payment Summary Section */}
                        <section className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border-2 border-blue-200 dark:border-blue-800 p-6">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4">Payment Summary</h3>
                            <div className="space-y-3 mb-4">
                                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-semibold">Base price</span>
                                    <span className="font-bold">₹{totals.subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-semibold">Discount</span>
                                    <span className="font-bold text-green-600 dark:text-green-400">-₹{totals.discount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-semibold">Taxes</span>
                                    <span className="font-bold">₹{totals.tax.toLocaleString()}</span>
                                </div>
                                <hr className="border-gray-300 dark:border-gray-600" />
                                <div className="flex justify-between text-lg font-black text-gray-900 dark:text-white pt-2">
                                    <span>Total</span>
                                    <span className="text-blue-600 dark:text-blue-400">₹{totals.total.toLocaleString()}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-black py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                disabled={!selectedAddress || !selectedSlot || items.length === 0}
                            >
                                Place service request
                            </button>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceCart;


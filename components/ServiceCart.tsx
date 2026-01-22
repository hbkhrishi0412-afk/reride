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
                // Fetch providers with their categories
                const [servicesResp, providersResp] = await Promise.all([
                    fetch('/api/provider-services?scope=public'),
                    fetch('/api/service-providers?scope=all').catch(() => null),
                ]);
                
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
                
                // Update providers with categories if available
                if (providersResp && providersResp.ok) {
                    const providersData = await providersResp.json();
                    const providersWithCategories = serviceProviders.map(p => {
                        const providerData = providersData.find((pd: any) => pd.id === p.id || pd.uid === p.id);
                        return providerData ? { ...p, serviceCategories: providerData.serviceCategories || [] } : p;
                    });
                    // Note: This would require updating the serviceProviders prop, but we'll use it in filtering
                }
                
                // Build service packages from actual provider services
                const serviceTypeMap = new Map<string, { price?: number; description?: string; etaMinutes?: number; count: number }>();
                data.forEach((entry: any) => {
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

    // Prefill from session (coming from landing cards)
    useEffect(() => {
        const raw = sessionStorage.getItem('service_cart_prefill');
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (parsed.serviceId) {
                setItems([{ serviceId: parsed.serviceId, quantity: 1 }]);
            }
            if (parsed.carDetails) {
                setCarDetails(parsed.carDetails);
                setCarForm(parsed.carDetails);
                setCarFormOpen(false);
            }
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

    const selectedServiceIds = useMemo(() => items.map(i => i.serviceId), [items]);

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
        
        const payload = {
            items,
            addressId: selectedAddress,
            address: addresses.find(a => a.id === selectedAddress),
            slotId: selectedSlot,
            couponCode: selectedCoupon,
            candidateProviderIds: providersToNotify,
            total: totals.total,
            note,
            carDetails,
            servicePackages: availableServicePackages,
            serviceTypes: selectedServiceTypes, // Include service types for better matching
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
        <div className="bg-white min-h-screen py-8 px-4 md:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold">SC</div>
                        <h1 className="text-xl font-bold text-gray-900">Cart</h1>
                    </div>
                    <button
                        onClick={isLoggedIn ? undefined : onLogin}
                        className={`px-4 py-2 rounded-md text-sm font-semibold ${isLoggedIn ? 'bg-gray-100 text-gray-600' : 'bg-purple-700 text-white'}`}
                    >
                        {isLoggedIn ? 'Logged in' : 'Proceed to login'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <section className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-semibold text-gray-900">Car details</h2>
                                {carDetails && (
                                    <button
                                        onClick={() => setCarFormOpen(!carFormOpen)}
                                        className="text-xs text-purple-700 font-semibold hover:underline"
                                    >
                                        {carFormOpen ? 'Hide' : 'Edit'}
                                    </button>
                                )}
                            </div>
                            {carDetails && !carFormOpen && (
                                <div className="text-sm text-gray-700 space-y-1 mb-3">
                                    <div className="font-semibold">{carDetails.make} {carDetails.model}</div>
                                    <div>{carDetails.year} • {carDetails.fuel}</div>
                                    {(carDetails.reg || carDetails.city) && <div>{carDetails.reg} {carDetails.city}</div>}
                                </div>
                            )}
                            {(carFormOpen || !carDetails) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input
                                        className="border border-gray-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="Make *"
                                        value={carForm.make}
                                        onChange={(e) => setCarForm({ ...carForm, make: e.target.value })}
                                    />
                                    <input
                                        className="border border-gray-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="Model *"
                                        value={carForm.model}
                                        onChange={(e) => setCarForm({ ...carForm, model: e.target.value })}
                                    />
                                    <input
                                        className="border border-gray-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="Year *"
                                        value={carForm.year}
                                        onChange={(e) => setCarForm({ ...carForm, year: e.target.value })}
                                    />
                                    <input
                                        className="border border-gray-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="Fuel *"
                                        value={carForm.fuel}
                                        onChange={(e) => setCarForm({ ...carForm, fuel: e.target.value })}
                                    />
                                    <input
                                        className="border border-gray-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="Registration number"
                                        value={carForm.reg}
                                        onChange={(e) => setCarForm({ ...carForm, reg: e.target.value })}
                                    />
                                    <input
                                        className="border border-gray-200 rounded-md px-3 py-2 text-sm"
                                        placeholder="City / Pincode"
                                        value={carForm.city}
                                        onChange={(e) => setCarForm({ ...carForm, city: e.target.value })}
                                    />
                                </div>
                            )}
                            {carFormError && <div className="text-sm text-red-600 mt-2">{carFormError}</div>}
                            {(carFormOpen || !carDetails) && (
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={handleSaveCarDetails}
                                        className="px-4 py-2 rounded-md bg-purple-700 text-white text-sm font-semibold"
                                    >
                                        Save car details
                                    </button>
                                </div>
                            )}
                        </section>

                        <section className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-semibold text-gray-900">1. Address</h2>
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
                                    className="text-xs text-purple-700 font-semibold hover:underline flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Address
                                </button>
                            </div>
                            <div className="space-y-2">
                                {addresses.map(addr => {
                                    const isEditing = editingAddressId === addr.id;
                                    return (
                                        <div key={addr.id} className={`p-3 rounded-md border ${selectedAddress === addr.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-500'}`}>
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-semibold text-gray-700">Label</label>
                                                        <button
                                                            onClick={() => {
                                                                setEditingAddressId(null);
                                                                setAddressForm({});
                                                            }}
                                                            className="text-xs text-gray-500 hover:text-gray-700"
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
                                                    <div className="flex gap-2 justify-end">
                                                        <button
                                                            onClick={() => {
                                                                setAddresses(prev => prev.filter(a => a.id !== addr.id));
                                                                if (selectedAddress === addr.id) {
                                                                    setSelectedAddress(addresses.find(a => a.id !== addr.id)?.id || '');
                                                                }
                                                                setEditingAddressId(null);
                                                                setAddressForm({});
                                                            }}
                                                            className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md"
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
                                                            className="px-3 py-1.5 text-xs bg-purple-700 text-white rounded-md hover:bg-purple-800"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className="flex items-start gap-3 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        className="mt-1"
                                                        checked={selectedAddress === addr.id}
                                                        onChange={() => setSelectedAddress(addr.id)}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <div className="font-semibold text-gray-900">{addr.label}</div>
                                                            <div className="flex gap-2">
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
                                                                    className="text-xs text-purple-700 hover:underline"
                                                                >
                                                                    Edit
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="text-sm text-gray-600">{addr.line1}, {addr.city} {addr.pincode}</div>
                                                    </div>
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                            <section className="border border-gray-200 rounded-lg p-4">
                                <h2 className="text-sm font-semibold text-gray-900 mb-3">2. Slot selection</h2>
                                <div className="flex flex-wrap gap-2">
                                    {timeSlots.map(slot => (
                                        <button
                                            key={slot.id}
                                            onClick={() => setSelectedSlot(slot.id)}
                                            className={`px-3 py-2 rounded-md text-sm border ${selectedSlot === slot.id ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-gray-200 text-gray-700 hover:border-purple-400'}`}
                                        >
                                            {slot.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <label className="text-sm font-semibold text-gray-900">Note (optional)</label>
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="mt-2 w-full border border-gray-200 rounded-md p-2 text-sm"
                                        rows={3}
                                        placeholder="Add vehicle details, preferred time window, etc."
                                    />
                                </div>
                            </section>

                            {carDetails && (
                                <section className="border border-gray-200 rounded-lg p-4">
                                    <h2 className="text-sm font-semibold text-gray-900 mb-3">Car details</h2>
                                    <div className="text-sm text-gray-700 space-y-1">
                                        <div className="font-semibold">{carDetails.make} {carDetails.model}</div>
                                        <div>{carDetails.year} • {carDetails.fuel}</div>
                                        <div>{carDetails.reg || 'Registration N/A'}</div>
                                        <div>{carDetails.city || carDetails.pincode || ''}</div>
                                    </div>
                                </section>
                            )}
                    </div>

                    <div className="space-y-4">
                        <section className="border border-gray-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Order details</h3>
                            <div className="space-y-3">
                                {items.map(item => {
                                    const svc = availableServicePackages.find(s => s.id === item.serviceId);
                                    if (!svc) return null;
                                    return (
                                        <div key={item.serviceId} className="flex gap-3 items-start border border-gray-100 rounded-md p-3">
                                            <div className="h-12 w-12 rounded-md bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-sm font-bold text-purple-700">
                                                {svc.name.slice(0, 1)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-900 text-sm">{svc.name}</div>
                                                <div className="text-xs text-gray-600">{svc.description}</div>
                                                <div className="text-xs text-gray-600">
                                                    {svc.price > 0 ? `₹${svc.price.toLocaleString()}` : 'Custom quote'}
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <button
                                                        onClick={() => updateQuantity(item.serviceId, -1)}
                                                        className="h-8 w-8 rounded border border-gray-300 flex items-center justify-center text-gray-700"
                                                    >-</button>
                                                    <span className="text-sm font-semibold">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.serviceId, 1)}
                                                        className="h-8 w-8 rounded border border-gray-300 flex items-center justify-center text-gray-700"
                                                    >+</button>
                                                    <button
                                                        onClick={() => removeService(item.serviceId)}
                                                        className="text-xs text-red-500 ml-2"
                                                    >Remove</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="flex flex-wrap gap-2">
                                    {availableServicePackages
                                        .filter(pkg => !items.some(item => item.serviceId === pkg.id))
                                        .map(pkg => (
                                        <button
                                            key={pkg.id}
                                            onClick={() => addService(pkg.id)}
                                            className="px-3 py-2 rounded-md border border-gray-200 text-xs text-gray-700 hover:border-purple-500"
                                        >
                                            Add {pkg.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Choose provider</h3>
                                    {selectedServiceTypes.length > 0 && (
                                        <p className="text-xs text-gray-600 mt-1">
                                            Showing providers for: {selectedServiceTypes.join(', ')}
                                        </p>
                                    )}
                                </div>
                                {onUseMyLocation && (
                                    <button
                                        type="button"
                                        onClick={onUseMyLocation}
                                        disabled={isLocating}
                                        className="text-xs font-semibold text-purple-700 hover:text-purple-800 disabled:opacity-60"
                                    >
                                        {isLocating ? 'Detecting...' : 'Use my location'}
                                    </button>
                                )}
                            </div>
                            {selectedServiceTypes.length === 0 && (
                                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                    <p className="text-xs text-amber-800">
                                        Please select a service above to see available providers.
                                    </p>
                                </div>
                            )}
                            <div className="space-y-2">
                        {sortedAvailableProviders.map(p => {
                                    const totals = providerTotals[p.id];
                                    return (
                                        <label key={p.id} className="flex items-start gap-3 p-3 rounded-md border border-gray-200 hover:border-purple-500 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 mt-1"
                                                checked={selectedProviders.includes(p.id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setSelectedProviders(prev =>
                                                        checked ? Array.from(new Set([...prev, p.id])) : prev.filter(id => id !== p.id)
                                                    );
                                                }}
                                            />
                                            <div className="flex-1 space-y-1">
                                                <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                                    <span>{p.name}</span>
                                                    {totals && totals.total > 0 && (
                                                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                                                            ₹{totals.total.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-600">{p.city}{p.distanceKm ? ` • ${p.distanceKm} km away` : ''}</div>
                                                {totals && totals.breakdown.some(b => b.price !== undefined) && (
                                                    <div className="text-xs text-gray-700 flex flex-wrap gap-2">
                                                        {totals.breakdown.map(b => (
                                                            <span key={b.id} className="px-2 py-1 bg-gray-100 rounded-full">
                                                                {b.name}{b.price !== undefined ? ` • ₹${b.price}` : ''}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {!totals && (
                                                    <div className="text-xs text-amber-700">Pricing not set for selected services.</div>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                                {availableProviders.length === 0 && (
                                    <div className="text-xs text-gray-600">No providers offer all selected services.</div>
                                )}
                                {locationError && (
                                    <div className="text-xs text-red-600">{locationError}</div>
                                )}
                            </div>
                        </section>

                        <section className="border border-gray-200 rounded-lg p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900">Coupons</h3>
                            <div className="flex flex-wrap gap-2">
                                {coupons.map(c => (
                                    <button
                                        key={c.code}
                                        onClick={() => handleApplyCoupon(c.code)}
                                        className={`px-3 py-1.5 rounded-md text-xs border ${selectedCoupon === c.code ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-gray-200 text-gray-700 hover:border-purple-400'}`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="border border-gray-200 rounded-lg p-4 space-y-2">
                            <h3 className="text-sm font-semibold text-gray-900">Payment summary</h3>
                            <div className="flex justify-between text-sm text-gray-700">
                                <span>Base price</span>
                                <span>₹{totals.subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-700">
                                <span>Discount</span>
                                <span className="text-green-600">-₹{totals.discount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-700">
                                <span>Taxes</span>
                                <span>₹{totals.tax.toLocaleString()}</span>
                            </div>
                            <hr />
                            <div className="flex justify-between text-sm font-bold text-gray-900">
                                <span>Total</span>
                                <span>₹{totals.total.toLocaleString()}</span>
                            </div>
                            <button
                                onClick={handleSubmit}
                                className="mt-3 w-full bg-purple-700 text-white font-semibold py-3 rounded-md hover:bg-purple-800 transition-colors disabled:opacity-60"
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


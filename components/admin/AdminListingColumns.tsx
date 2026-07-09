import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, SubscriptionPlan, User, Vehicle } from '../../types';
import { PLAN_DETAILS } from '../../constants/plans';
import { isSellerListingOfferVisible } from '../../utils/vehicleOffer';
import { adminTableHeadClass } from './AdminPrimitives';

export type ListingColumnId =
    | 'vehicle'
    | 'vehicleNumber'
    | 'seller'
    | 'sellerPlan'
    | 'price'
    | 'status'
    | 'offer'
    | 'buyerName'
    | 'buyerNumber'
    | 'city'
    | 'state'
    | 'category'
    | 'mileage'
    | 'fuelType'
    | 'transmission'
    | 'color'
    | 'listedDate'
    | 'views'
    | 'featured'
    | 'listingType'
    | 'sellerPhone';

export const LISTING_COLUMN_DEFS: {
    id: ListingColumnId;
    label: string;
    defaultVisible: boolean;
    group: 'core' | 'seller' | 'buyer' | 'vehicle' | 'performance';
}[] = [
    { id: 'vehicle', label: 'Vehicle', defaultVisible: true, group: 'core' },
    { id: 'vehicleNumber', label: 'Vehicle number', defaultVisible: false, group: 'vehicle' },
    { id: 'seller', label: 'Seller', defaultVisible: true, group: 'seller' },
    { id: 'sellerPlan', label: 'Seller plan', defaultVisible: false, group: 'seller' },
    { id: 'sellerPhone', label: 'Seller phone', defaultVisible: false, group: 'seller' },
    { id: 'price', label: 'Price', defaultVisible: true, group: 'core' },
    { id: 'status', label: 'Status', defaultVisible: true, group: 'core' },
    { id: 'offer', label: 'Offer', defaultVisible: true, group: 'core' },
    { id: 'buyerName', label: 'Buyer name', defaultVisible: false, group: 'buyer' },
    { id: 'buyerNumber', label: 'Buyer number', defaultVisible: false, group: 'buyer' },
    { id: 'category', label: 'Category', defaultVisible: false, group: 'vehicle' },
    { id: 'mileage', label: 'Mileage', defaultVisible: false, group: 'vehicle' },
    { id: 'fuelType', label: 'Fuel type', defaultVisible: false, group: 'vehicle' },
    { id: 'transmission', label: 'Transmission', defaultVisible: false, group: 'vehicle' },
    { id: 'color', label: 'Color', defaultVisible: false, group: 'vehicle' },
    { id: 'city', label: 'City', defaultVisible: false, group: 'vehicle' },
    { id: 'state', label: 'State', defaultVisible: false, group: 'vehicle' },
    { id: 'listingType', label: 'Listing type', defaultVisible: false, group: 'vehicle' },
    { id: 'listedDate', label: 'Listed date', defaultVisible: false, group: 'performance' },
    { id: 'views', label: 'Views', defaultVisible: false, group: 'performance' },
    { id: 'featured', label: 'Featured', defaultVisible: false, group: 'performance' },
];

const STORAGE_KEY = 'reride_admin_listing_columns';

const DEFAULT_VISIBLE = LISTING_COLUMN_DEFS.filter((c) => c.defaultVisible).map((c) => c.id);

const ALL_COLUMN_IDS = new Set(LISTING_COLUMN_DEFS.map((c) => c.id));

function loadVisibleColumns(): ListingColumnId[] {
    if (typeof window === 'undefined') return DEFAULT_VISIBLE;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_VISIBLE;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return DEFAULT_VISIBLE;
        const valid = parsed.filter(
            (id): id is ListingColumnId => typeof id === 'string' && ALL_COLUMN_IDS.has(id as ListingColumnId),
        );
        return valid.length > 0 ? valid : DEFAULT_VISIBLE;
    } catch {
        return DEFAULT_VISIBLE;
    }
}

function formatInrAmount(value: unknown): string {
    const n = typeof value === 'number' ? value : Number(value);
    return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN');
}

function formatDate(value?: string): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function planLabel(plan?: SubscriptionPlan): string {
    const key = plan || 'free';
    return PLAN_DETAILS[key]?.name ?? key;
}

export interface ListingBuyerInfo {
    name: string;
    number: string;
}

export function buildListingLookupMaps(users: User[], conversations: Conversation[]) {
    const userByEmail = new Map<string, User>();
    for (const u of users) {
        userByEmail.set(u.email.toLowerCase().trim(), u);
    }

    const buyerByVehicleKey = new Map<string, ListingBuyerInfo>();

    const sortedConversations = [...(conversations || [])].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );

    for (const conv of sortedConversations) {
        const keys = [String(conv.vehicleId)];
        if (!buyerByVehicleKey.has(keys[0])) {
            const buyerEmail = (conv.customerId || '').toLowerCase().trim();
            const buyerUser = buyerEmail ? userByEmail.get(buyerEmail) : undefined;
            buyerByVehicleKey.set(keys[0], {
                name: conv.customerName || buyerUser?.name || buyerEmail || '—',
                number: buyerUser?.mobile || '—',
            });
        }
    }

    return { userByEmail, buyerByVehicleKey };
}

function vehicleKeys(vehicle: Vehicle): string[] {
    const keys = [String(vehicle.id)];
    if (vehicle.databaseId) keys.push(vehicle.databaseId);
    return keys;
}

function resolveBuyer(
    vehicle: Vehicle,
    buyerByVehicleKey: Map<string, ListingBuyerInfo>,
): ListingBuyerInfo {
    for (const key of vehicleKeys(vehicle)) {
        const info = buyerByVehicleKey.get(key);
        if (info) return info;
    }
    return { name: '—', number: '—' };
}

function resolveSeller(vehicle: Vehicle, userByEmail: Map<string, User>): User | undefined {
    const email = vehicle.sellerEmail?.toLowerCase().trim();
    return email ? userByEmail.get(email) : undefined;
}

export function useListingColumnVisibility() {
    const [visibleColumns, setVisibleColumns] = useState<ListingColumnId[]>(loadVisibleColumns);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
        }
    }, [visibleColumns]);

    const toggleColumn = useCallback((id: ListingColumnId) => {
        setVisibleColumns((prev) => {
            if (prev.includes(id)) {
                const next = prev.filter((c) => c !== id);
                return next.length > 0 ? next : prev;
            }
            const order = LISTING_COLUMN_DEFS.map((c) => c.id);
            return [...prev, id].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        });
    }, []);

    const resetColumns = useCallback(() => setVisibleColumns(DEFAULT_VISIBLE), []);

    const visibleColumnDefs = useMemo(
        () => LISTING_COLUMN_DEFS.filter((c) => visibleColumns.includes(c.id)),
        [visibleColumns],
    );

    return { visibleColumns, visibleColumnDefs, toggleColumn, resetColumns, setVisibleColumns };
}

export const AdminListingColumnCustomizer: React.FC<{
    visibleColumns: ListingColumnId[];
    onToggle: (id: ListingColumnId) => void;
    onReset: () => void;
}> = ({ visibleColumns, onToggle, onReset }) => {
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const grouped = useMemo(() => {
        const groups: Record<string, typeof LISTING_COLUMN_DEFS> = {
            core: [],
            seller: [],
            buyer: [],
            vehicle: [],
            performance: [],
        };
        for (const col of LISTING_COLUMN_DEFS) {
            groups[col.group].push(col);
        }
        return groups;
    }, []);

    const groupLabels: Record<string, string> = {
        core: 'Core',
        seller: 'Seller',
        buyer: 'Buyer',
        vehicle: 'Vehicle details',
        performance: 'Performance',
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
                aria-expanded={open}
                aria-haspopup="true"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    />
                </svg>
                Customize columns
            </button>

            {open ? (
                <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg ring-1 ring-slate-900/5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">Show columns</p>
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-xs font-medium text-violet-600 hover:text-violet-800"
                        >
                            Reset
                        </button>
                    </div>
                    <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                        {Object.entries(grouped).map(([groupKey, cols]) =>
                            cols.length === 0 ? null : (
                                <div key={groupKey}>
                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        {groupLabels[groupKey]}
                                    </p>
                                    <ul className="space-y-1">
                                        {cols.map((col) => (
                                            <li key={col.id}>
                                                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleColumns.includes(col.id)}
                                                        onChange={() => onToggle(col.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                                    />
                                                    {col.label}
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ),
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export function renderListingCell(
    columnId: ListingColumnId,
    vehicle: Vehicle,
    ctx: {
        userByEmail: Map<string, User>;
        buyerByVehicleKey: Map<string, ListingBuyerInfo>;
    },
): React.ReactNode {
    const seller = resolveSeller(vehicle, ctx.userByEmail);
    const buyer = resolveBuyer(vehicle, ctx.buyerByVehicleKey);

    switch (columnId) {
        case 'vehicle':
            return (
                <span className="font-medium">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                </span>
            );
        case 'vehicleNumber':
            return vehicle.registrationNumber || String(vehicle.databaseId || vehicle.id);
        case 'seller':
            return vehicle.sellerEmail || '—';
        case 'sellerPlan':
            return planLabel(seller?.subscriptionPlan);
        case 'sellerPhone':
            return vehicle.sellerPhone || seller?.mobile || '—';
        case 'price':
            return `₹${formatInrAmount(vehicle.price)}`;
        case 'status':
            return (
                <span
                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        vehicle.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : vehicle.status === 'sold'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                    }`}
                >
                    {vehicle.status}
                </span>
            );
        case 'offer':
            if (!vehicle.offerEnabled) return <span className="text-gray-400">—</span>;
            if (isSellerListingOfferVisible(vehicle)) {
                return (
                    <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                        Active
                    </span>
                );
            }
            return (
                <span
                    className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
                    title="Offer is enabled but hidden from buyers (check dates or offer text)"
                >
                    Inactive
                </span>
            );
        case 'buyerName':
            return buyer.name;
        case 'buyerNumber':
            return buyer.number;
        case 'category':
            return vehicle.category || '—';
        case 'mileage':
            return vehicle.mileage != null ? `${vehicle.mileage.toLocaleString('en-IN')} km` : '—';
        case 'fuelType':
            return vehicle.fuelType || '—';
        case 'transmission':
            return vehicle.transmission || '—';
        case 'color':
            return vehicle.color || '—';
        case 'city':
            return vehicle.city || '—';
        case 'state':
            return vehicle.state || '—';
        case 'listingType':
            return vehicle.listingType === 'rental' ? 'Rental' : 'Buy';
        case 'listedDate':
            return formatDate(vehicle.createdAt);
        case 'views':
            return vehicle.views ?? 0;
        case 'featured':
            return vehicle.isFeatured ? 'Yes' : 'No';
        default:
            return '—';
    }
}

export function ListingTableHeader({ visibleColumnDefs }: { visibleColumnDefs: typeof LISTING_COLUMN_DEFS }) {
    return (
        <tr>
            {visibleColumnDefs.map((col) => (
                <th key={col.id} className={`${adminTableHeadClass} px-4 py-3`}>
                    {col.label}
                </th>
            ))}
            <th className={`${adminTableHeadClass} px-4 py-3 text-right`}>Actions</th>
        </tr>
    );
}

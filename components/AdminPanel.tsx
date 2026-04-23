
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Vehicle, User, Conversation, PlatformSettings, AuditLogEntry, VehicleData, SupportTicket, FAQItem, SubscriptionPlan, PlanDetails } from '../types';
import { View } from '../types';
import EditUserModal from './EditUserModal';
import EditVehicleModal from './EditVehicleModal';
import PaymentManagement from './PaymentManagement';
// Removed blocking import - will lazy load PLAN_DETAILS when needed
import { VehicleDataBulkUploadModal } from './VehicleDataBulkUploadModal';
import VehicleDataManagement from './VehicleDataManagement';
import SellerFormPreview from './SellerFormPreview';
import { planService } from '../services/planService';
import ImportVehiclesModal from './ImportVehiclesModal';
import ImportUsersModal from './ImportUsersModal';
import AdminServiceOps from './AdminServiceOps';
import ServiceManagement from './ServiceManagement';
import SellCarAdmin from './SellCarAdmin';
import { isSellerListingOfferVisible } from '../utils/vehicleOffer';
import { isRerideStaffPick } from '../utils/staffPick';
import {
    AdminContentFrame,
    AdminStatTile,
    AdminDataTableFrame,
    AdminBarChartPanel,
    AdminSegmentedTabs,
    AdminEmptyState,
    AdminPageIntro,
    AdminToolbar,
    adminTableHeadClass,
} from './admin/AdminPrimitives';

/** Safe ₹ formatting — API/mock data can omit or invalidate numeric fields. */
function formatInrAmount(value: unknown): string {
    const n = typeof value === 'number' ? value : Number(value);
    return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN');
}

// --- Seller Filter Dropdown Component ---
interface SellerFilterDropdownProps {
    sellers: User[];
    selectedSeller: string;
    onSellerChange: (sellerEmail: string) => void;
}

const SellerFilterDropdown: React.FC<SellerFilterDropdownProps> = ({ 
    sellers, 
    selectedSeller, 
    onSellerChange 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredSellers = useMemo(() => {
        if (!searchTerm.trim()) return sellers;
        const lowercasedFilter = searchTerm.toLowerCase();
        return sellers.filter(seller => 
            seller.name.toLowerCase().includes(lowercasedFilter) ||
            seller.email.toLowerCase().includes(lowercasedFilter)
        );
    }, [sellers, searchTerm]);

    const selectedSellerName = useMemo(() => {
        if (selectedSeller === 'all') return 'All Sellers';
        const seller = sellers.find(s => s.email === selectedSeller);
        return seller ? `${seller.name} (${seller.email})` : 'All Sellers';
    }, [selectedSeller, sellers]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex min-w-[200px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
                <span className="truncate">{selectedSellerName}</span>
                <svg 
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-gray-200">
                        <input
                            type="text"
                            placeholder="Search sellers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        <button
                            onClick={() => {
                                onSellerChange('all');
                                setIsOpen(false);
                                setSearchTerm('');
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                selectedSeller === 'all' ? 'bg-orange-50 text-orange-600' : ''
                            }`}
                        >
                            All Sellers
                        </button>
                        {filteredSellers.map(seller => (
                            <button
                                key={seller.email}
                                onClick={() => {
                                    onSellerChange(seller.email);
                                    setIsOpen(false);
                                    setSearchTerm('');
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                    selectedSeller === seller.email ? 'bg-orange-50 text-orange-600' : ''
                                }`}
                            >
                                <div className="font-medium">{seller.name}</div>
                                <div className="text-xs text-gray-500">{seller.email}</div>
                            </button>
                        ))}
                        {filteredSellers.length === 0 && searchTerm && (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                No sellers found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface AdminPanelProps {
    users: User[];
    currentUser: User;
    vehicles: Vehicle[];
    conversations: Conversation[];
    isLoading?: boolean;
    onCreateUser?: (userData: Omit<User, 'status'>) => Promise<{ success: boolean, reason: string }>;
    onToggleUserStatus: (email: string) => void;
    onDeleteUser: (email: string) => void;
    onAdminUpdateUser: (email: string, details: Partial<User>) => void;
    onUpdateUserPlan: (email: string, plan: SubscriptionPlan) => void;
    onUpdateVehicle: (vehicle: Vehicle) => void;
    onDeleteVehicle: (vehicleId: number) => void;
    onToggleVehicleStatus: (vehicleId: number) => void;
    onToggleVehicleFeature: (vehicleId: number) => void;
    onResolveFlag: (type: 'vehicle' | 'conversation', id: number | string) => void;
    platformSettings: PlatformSettings;
    onUpdateSettings: (settings: PlatformSettings) => void;
    onSendBroadcast: (message: string) => void;
    auditLog: AuditLogEntry[];
    onExportUsers: () => void;
    onImportUsers: (users: Omit<User, 'id' | 'firebaseUid'>[]) => Promise<void>;
    onExportVehicles: () => void;
    onImportVehicles: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => Promise<void>;
    onExportSales: () => void;
    onNavigate?: (view: View) => void;
    onLogout?: () => void;
    vehicleData: VehicleData;
    onUpdateVehicleData: (newData: VehicleData) => void;
    onToggleVerifiedStatus: (email: string) => void;
    supportTickets: SupportTicket[];
    onUpdateSupportTicket: (ticket: SupportTicket) => void;
    faqItems: FAQItem[];
    onAddFaq: (faq: Omit<FAQItem, 'id'>) => void;
    onUpdateFaq: (faq: FAQItem) => void;
    onDeleteFaq: (id: number) => void;
    onCertificationApproval: (vehicleId: number, decision: 'approved' | 'rejected') => void;
}

type AdminView = 'analytics' | 'users' | 'listings' | 'moderation' | 'certificationRequests' | 'vehicleData' | 'sellCarAdmin' | 'auditLog' | 'settings' | 'support' | 'faq' | 'payments' | 'planManagement' | 'serviceOps' | 'serviceManagement';
type RoleFilter = 'all' | 'customer' | 'seller' | 'admin' | 'finance_partner';
// FIX: Restrict sortable keys to prevent comparison errors on incompatible types.
type SortableUserKey = 'name' | 'status' | 'partnerBanks';
type SortConfig = {
    key: SortableUserKey;
    direction: 'ascending' | 'descending';
};

/** Users with linked bank partners (sellers/service providers) or the finance_partner role — matches the "Finance partners" column and tab. */
const userHasFinancePartnerAffiliation = (u: User): boolean => {
    if (u.role === 'finance_partner') return true;
    if (u.role === 'seller' || u.role === 'service_provider') {
        return Array.isArray(u.partnerBanks) && u.partnerBanks.length > 0;
    }
    return false;
};

const ADMIN_SIDEBAR_COLLAPSED_KEY = 'reride_admin_sidebar_collapsed';

/** Compact icons for collapsed (rail) sidebar — matches `AdminView` routes. */
const AdminViewNavIcon: React.FC<{ view: AdminView; className?: string }> = ({ view, className = 'h-5 w-5' }) => {
    const c = `${className} shrink-0`;
    switch (view) {
        case 'analytics':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            );
        case 'users':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            );
        case 'listings':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            );
        case 'sellCarAdmin':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            );
        case 'vehicleData':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
            );
        case 'moderation':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
            );
        case 'certificationRequests':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            );
        case 'payments':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            );
        case 'planManagement':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            );
        case 'support':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            );
        case 'faq':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        case 'serviceOps':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.586L11.42 15.17z"
                    />
                </svg>
            );
        case 'serviceManagement':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            );
        case 'auditLog':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
            );
        case 'settings':
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            );
        default:
            return (
                <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            );
    }
};

// --- Sub-components ---

const SortableHeader: React.FC<{
    title: string;
    sortKey: SortableUserKey;
    sortConfig: SortConfig | null;
    requestSort: (key: SortableUserKey) => void;
}> = ({ title, sortKey, sortConfig, requestSort }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = isSorted ? sortConfig.direction : undefined;

    return (
        <th className={`${adminTableHeadClass} px-3 py-2.5 whitespace-nowrap`}>
            <button onClick={() => requestSort(sortKey)} className="group flex items-center gap-1.5 hover:text-slate-900">
                <span className="group-hover:text-gray-900">{title}</span>
                <span className="text-gray-500 text-xs">
                    {isSorted ? (direction === 'ascending' ? '▲' : '▼') : '↕'}
                </span>
            </button>
        </th>
    );
};

// --- Certification Requests View Component ---
const CertificationRequestsView: React.FC<{
    requests: Vehicle[];
    users: User[];
    onCertificationApproval: (vehicleId: number, decision: 'approved' | 'rejected') => void;
}> = ({ requests, users, onCertificationApproval }) => {
    
    // Certification Request Row Component
    const CertificationRequestRow: React.FC<{ vehicle: Vehicle }> = ({ vehicle }) => {
        const [sellerInfo, setSellerInfo] = useState<{ planName: string; usage: string; hasFreeCredits: boolean } | null>(null);
        
        useEffect(() => {
            const getSellerInfo = async () => {
                const seller = users.find(u => u.email === vehicle.sellerEmail);
                if (!seller) {
                    setSellerInfo({ planName: 'N/A', usage: 'N/A', hasFreeCredits: false });
                    return;
                }
                const plan = await planService.getPlanDetails(seller.subscriptionPlan || 'free');
                const used = seller.usedCertifications || 0;
                const total = plan.freeCertifications;
                const usage = `${used}/${total}`;
                setSellerInfo({ planName: plan.name, usage, hasFreeCredits: used < total });
            };
            getSellerInfo();
        }, [vehicle.sellerEmail]);
        
        if (!sellerInfo) {
            return (
                <tr key={vehicle.id}>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        Loading seller info...
                    </td>
                </tr>
            );
        }
        
        return (
            <tr key={vehicle.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</td>
                <td className="px-6 py-4">{vehicle.sellerEmail}</td>
                <td className="px-6 py-4">
                    <div>Plan: <span className="font-semibold">{sellerInfo.planName}</span></div>
                    <div className="text-sm">Free Certs Used: {sellerInfo.usage}</div>
                    {!sellerInfo.hasFreeCredits && <div className="text-xs text-reride-text-dark">No free credits left</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button onClick={() => onCertificationApproval(vehicle.id, 'approved')} className="text-reride-orange hover:text-reride-orange">Approve</button>
                    <button onClick={() => onCertificationApproval(vehicle.id, 'rejected')} className="text-reride-orange hover:text-reride-orange">Reject</button>
                </td>
            </tr>
        );
    };

    return (
        <AdminDataTableFrame
            title="Certification requests"
            subtitle={`${requests.length} pending`}
        >
            {requests.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-100">
                    <thead>
                        <tr>
                            <th className={`${adminTableHeadClass} px-4 py-3`}>Vehicle</th>
                            <th className={`${adminTableHeadClass} px-4 py-3`}>Seller</th>
                            <th className={`${adminTableHeadClass} px-4 py-3`}>Plan details</th>
                            <th className={`${adminTableHeadClass} px-4 py-3 text-right`}>Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {requests.map((vehicle) => (
                            <CertificationRequestRow key={vehicle.id} vehicle={vehicle} />
                        ))}
                    </tbody>
                </table>
            ) : (
                <AdminEmptyState
                    title="No pending requests"
                    description="When sellers request certification, they will appear in this table for review."
                />
            )}
        </AdminDataTableFrame>
    );
};

// --- Audit Log View Component ---
const AuditLogView: React.FC<{ auditLog: AuditLogEntry[] }> = ({ auditLog }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLog = useMemo(() => {
    if (!searchTerm.trim()) return auditLog;
    const lowercasedFilter = searchTerm.toLowerCase();
    return auditLog.filter(entry =>
      entry.actor.toLowerCase().includes(lowercasedFilter) ||
      entry.action.toLowerCase().includes(lowercasedFilter) ||
      entry.target.toLowerCase().includes(lowercasedFilter) ||
      (entry.details && entry.details.toLowerCase().includes(lowercasedFilter))
    );
  }, [auditLog, searchTerm]);

  const searchAction = (
    <input
      type="text"
      placeholder="Search logs…"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200 sm:w-72"
    />
  );

  return (
    <AdminDataTableFrame title="Audit log" subtitle="Immutable history of admin actions" actions={searchAction}>
      <table className="min-w-full divide-y divide-slate-100">
        <thead>
          <tr>
            <th className={`${adminTableHeadClass} px-4 py-3`}>Timestamp</th>
            <th className={`${adminTableHeadClass} px-4 py-3`}>Actor</th>
            <th className={`${adminTableHeadClass} px-4 py-3`}>Action</th>
            <th className={`${adminTableHeadClass} px-4 py-3`}>Target</th>
            <th className={`${adminTableHeadClass} px-4 py-3`}>Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {filteredLog.map((entry) => (
            <tr key={entry.id} className="transition-colors hover:bg-violet-50/[0.35]">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{new Date(entry.timestamp).toLocaleString()}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{entry.actor}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{entry.action}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{entry.target}</td>
              <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600" title={entry.details}>{entry.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredLog.length === 0 && (
        <div className="px-4 py-10">
          <AdminEmptyState title="No entries" description="Try another search term or clear the filter." />
        </div>
      )}
    </AdminDataTableFrame>
  );
};

// --- Add New Plan Modal Component ---
const AddNewPlanModal: React.FC<{
    onClose: () => void;
    onCreate: (planData: Omit<PlanDetails, 'id'>) => void;
}> = ({ onClose, onCreate }) => {
    const [formData, setFormData] = useState<Omit<PlanDetails, 'id'>>({
        name: '',
        price: 0,
        listingLimit: 1,
        featuredCredits: 0,
        freeCertifications: 0,
        features: [],
        isMostPopular: false
    });
    const [newFeature, setNewFeature] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isCreating, setIsCreating] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const numericFields = ['price', 'listingLimit', 'featuredCredits', 'freeCertifications'];
        const parsedValue = numericFields.includes(name) ? parseInt(value) || 0 : value;
        
        // Clear errors when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        
        setFormData(prev => ({ ...prev, [name]: parsedValue }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.name || formData.name.trim() === '') {
            newErrors.name = 'Plan name is required';
        }
        
        if (formData.price < 0) {
            newErrors.price = 'Price cannot be negative';
        }
        
        if (formData.listingLimit !== 'unlimited' && formData.listingLimit < 1) {
            newErrors.listingLimit = 'Listing limit must be at least 1';
        }
        
        if (formData.featuredCredits < 0) {
            newErrors.featuredCredits = 'Featured credits cannot be negative';
        }
        
        if (formData.freeCertifications < 0) {
            newErrors.freeCertifications = 'Free certifications cannot be negative';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddFeature = () => {
        if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
            setFormData(prev => ({ ...prev, features: [...prev.features, newFeature.trim()] }));
            setNewFeature('');
        }
    };

    const handleRemoveFeature = (featureToRemove: string) => {
        setFormData(prev => ({ ...prev, features: prev.features.filter(f => f !== featureToRemove) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsCreating(true);
        try {
            await onCreate(formData);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white">Create New Plan</h2>
                        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">
                                    Plan Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.name 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                    placeholder="Enter plan name"
                                />
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">
                                    Price (₹/month) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    min="0"
                                    step="1"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.price 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                    placeholder="0"
                                />
                                {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Listing Limit</label>
                                <input
                                    type="number"
                                    name="listingLimit"
                                    value={formData.listingLimit === 'unlimited' ? '' : formData.listingLimit}
                                    onChange={handleChange}
                                    min="1"
                                    placeholder="Leave empty for unlimited"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.listingLimit 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                />
                                {errors.listingLimit && <p className="mt-1 text-sm text-red-500">{errors.listingLimit}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Featured Credits</label>
                                <input
                                    type="number"
                                    name="featuredCredits"
                                    value={formData.featuredCredits}
                                    onChange={handleChange}
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.featuredCredits 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                />
                                {errors.featuredCredits && <p className="mt-1 text-sm text-red-500">{errors.featuredCredits}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Free Certifications</label>
                                <input
                                    type="number"
                                    name="freeCertifications"
                                    value={formData.freeCertifications}
                                    onChange={handleChange}
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.freeCertifications 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                />
                                {errors.freeCertifications && <p className="mt-1 text-sm text-red-500">{errors.freeCertifications}</p>}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    name="isMostPopular"
                                    checked={formData.isMostPopular}
                                    onChange={handleCheckboxChange}
                                    className="w-4 h-4 text-reride-orange bg-gray-100 border-gray-300 rounded focus:ring-reride-orange"
                                />
                                <label className="text-sm font-medium text-reride-text-dark dark:text-white">
                                    Mark as Most Popular
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Features</label>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={newFeature}
                                    onChange={(e) => setNewFeature(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                                    placeholder="Add new feature..."
                                    className="flex-grow px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-reride-orange"
                                />
                                <button type="button" onClick={handleAddFeature} className="px-4 py-2 bg-reride-orange text-white rounded-lg hover:bg-reride-orange/90">
                                    Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.features.map((feature, index) => (
                                    <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        <span className="text-reride-text-dark dark:text-white">{feature}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFeature(feature)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {Object.keys(errors).length > 0 && (
                                    <span className="text-red-500">Please fix {Object.keys(errors).length} error(s) before creating</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-reride-text-dark dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isCreating || Object.keys(errors).length > 0}
                                    className="px-6 py-2 bg-reride-orange text-white rounded-lg hover:bg-reride-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {isCreating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Plan'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Plan Edit Modal Component ---
const PlanEditModal: React.FC<{
    plan: PlanDetails;
    onClose: () => void;
    onSave: (plan: PlanDetails) => void;
}> = ({ plan, onClose, onSave }) => {
    const [formData, setFormData] = useState(plan);
    const [newFeature, setNewFeature] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const numericFields = ['price', 'listingLimit', 'featuredCredits', 'freeCertifications'];
        const parsedValue = numericFields.includes(name) ? parseInt(value) || 0 : value;
        
        // Clear errors when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        
        setFormData(prev => ({ ...prev, [name]: parsedValue }));
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.name || formData.name.trim() === '') {
            newErrors.name = 'Plan name is required';
        }
        
        if (formData.price < 0) {
            newErrors.price = 'Price cannot be negative';
        }
        
        if (formData.listingLimit !== 'unlimited' && formData.listingLimit < 0) {
            newErrors.listingLimit = 'Listing limit cannot be negative';
        }
        
        if (formData.featuredCredits < 0) {
            newErrors.featuredCredits = 'Featured credits cannot be negative';
        }
        
        if (formData.freeCertifications < 0) {
            newErrors.freeCertifications = 'Free certifications cannot be negative';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddFeature = () => {
        if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
            setFormData(prev => ({ ...prev, features: [...prev.features, newFeature.trim()] }));
            setNewFeature('');
        }
    };

    const handleRemoveFeature = (featureToRemove: string) => {
        setFormData(prev => ({ ...prev, features: prev.features.filter(f => f !== featureToRemove) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsSaving(true);
        try {
            await onSave(formData);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white">Edit Plan</h2>
                        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">
                                    Plan Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.name 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                    placeholder="Enter plan name"
                                />
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">
                                    Price (₹/month) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    min="0"
                                    step="1"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.price 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                    placeholder="0"
                                />
                                {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Listing Limit</label>
                                <input
                                    type="number"
                                    name="listingLimit"
                                    value={formData.listingLimit === 'unlimited' ? '' : formData.listingLimit}
                                    onChange={handleChange}
                                    min="0"
                                    placeholder="Leave empty for unlimited"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.listingLimit 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                />
                                {errors.listingLimit && <p className="mt-1 text-sm text-red-500">{errors.listingLimit}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Featured Credits</label>
                                <input
                                    type="number"
                                    name="featuredCredits"
                                    value={formData.featuredCredits}
                                    onChange={handleChange}
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.featuredCredits 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                />
                                {errors.featuredCredits && <p className="mt-1 text-sm text-red-500">{errors.featuredCredits}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Free Certifications</label>
                                <input
                                    type="number"
                                    name="freeCertifications"
                                    value={formData.freeCertifications}
                                    onChange={handleChange}
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.freeCertifications 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-reride-orange'
                                    }`}
                                />
                                {errors.freeCertifications && <p className="mt-1 text-sm text-red-500">{errors.freeCertifications}</p>}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    name="isMostPopular"
                                    checked={formData.isMostPopular}
                                    onChange={(e) => setFormData(prev => ({ ...prev, isMostPopular: e.target.checked }))}
                                    className="w-4 h-4 text-reride-orange bg-gray-100 border-gray-300 rounded focus:ring-reride-orange"
                                />
                                <label className="text-sm font-medium text-reride-text-dark dark:text-white">
                                    Mark as Most Popular
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Features</label>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={newFeature}
                                    onChange={(e) => setNewFeature(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                                    placeholder="Add new feature..."
                                    className="flex-grow px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-reride-orange"
                                />
                                <button type="button" onClick={handleAddFeature} className="px-4 py-2 bg-reride-orange text-white rounded-lg hover:bg-reride-orange/90">
                                    Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.features.map((feature, index) => (
                                    <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        <span className="text-reride-text-dark dark:text-white">{feature}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFeature(feature)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {Object.keys(errors).length > 0 && (
                                    <span className="text-red-500">Please fix {Object.keys(errors).length} error(s) before saving</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-reride-text-dark dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving || Object.keys(errors).length > 0}
                                    className="px-6 py-2 bg-reride-orange text-white rounded-lg hover:bg-reride-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Changes'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Main AdminPanel Component ---
const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    const {
        users, currentUser, vehicles, conversations, isLoading = false, onToggleUserStatus, onDeleteUser,
        onAdminUpdateUser, onUpdateUserPlan, onUpdateVehicle, onDeleteVehicle, onToggleVehicleStatus,
        onToggleVehicleFeature,
        onResolveFlag, platformSettings, onUpdateSettings, onSendBroadcast: _onSendBroadcast,
        auditLog, onExportUsers, onImportUsers, onExportVehicles, onImportVehicles, onNavigate: _onNavigate, onLogout, vehicleData, onUpdateVehicleData,
        supportTickets, onUpdateSupportTicket, faqItems, onAddFaq, onUpdateFaq, onDeleteFaq,
        onCertificationApproval,
    } = props;
    const [activeView, setActiveView] = useState<AdminView>('analytics');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [userListSearch, setUserListSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [selectedSeller, setSelectedSeller] = useState<string>('all');
    
    // Pagination state (vehicle listings)
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [userDirectoryPage, setUserDirectoryPage] = useState(1);
    const [userDirectoryPageSize, setUserDirectoryPageSize] = useState(10);
    
    // Modal states
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

    // Loading states for actions
    const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
    const [showImportModal, setShowImportModal] = useState(false);
    const [showImportUsersModal, setShowImportUsersModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const hasFetchedUsersRef = useRef(false);
    const [configError, setConfigError] = useState<{ reason: string; diagnostic?: string } | null>(null);
    
    // Check for configuration errors from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const errorInfo = localStorage.getItem('reRideUsers_error');
            if (errorInfo) {
                try {
                    const error = JSON.parse(errorInfo);
                    // Only show error if it's recent (within last hour)
                    if (error.timestamp && Date.now() - error.timestamp < 3600000) {
                        setConfigError({
                            reason: error.reason || 'Configuration error',
                            diagnostic: error.diagnostic
                        });
                    } else {
                        // Clear stale error
                        localStorage.removeItem('reRideUsers_error');
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            } else {
                setConfigError(null);
            }
        }
    }, [users]); // Re-check when users change

    // Fetch users when AdminPanel mounts if they're empty (for admin users)
    useEffect(() => {
        // Only fetch if:
        // 1. Current user is admin
        // 2. Users array is empty
        // 3. We haven't already tried to fetch
        // 4. Not currently loading
        if (
            currentUser?.role === 'admin' &&
            (!users || users.length === 0) &&
            !hasFetchedUsersRef.current &&
            !isLoading &&
            !isRefreshing
        ) {
            hasFetchedUsersRef.current = true;
            console.log('📊 AdminPanel: Users array is empty, fetching users...');
            
            const fetchUsers = async () => {
                try {
                    const { dataService } = await import('../services/dataService');
                    // CRITICAL FIX: Force refresh to bypass cache and get fresh data from database
                    const usersData = await dataService.getUsers(true); // forceRefresh = true
                    console.log(`✅ AdminPanel: Fetched ${usersData.length} users (forced refresh)`);
                    
                    // Clear any configuration errors on success
                    if (usersData.length > 0) {
                        setConfigError(null);
                        if (typeof window !== 'undefined') {
                            localStorage.removeItem('reRideUsers_error');
                        }
                    }
                    
                    if (usersData.length === 0) {
                        console.warn('⚠️ AdminPanel: API returned 0 users. This might indicate:');
                        console.warn('   1. No users exist in the database');
                        console.warn('   2. Authentication/authorization issue - check if admin token is valid');
                        console.warn('   3. Database connection problem');
                        console.warn('   4. RLS policies blocking access');
                        console.warn('   5. SUPABASE_SERVICE_ROLE_KEY might be missing in Vercel environment variables');
                        console.warn('   → Check Vercel Dashboard → Settings → Environment Variables');
                        console.warn('   → Ensure SUPABASE_SERVICE_ROLE_KEY is set for Production environment');
                        console.warn('   → After setting, redeploy the application');
                        // Show config banner when 0 users and a stored error (e.g. 503 from missing service role key)
                        if (typeof window !== 'undefined') {
                            try {
                                const errRaw = localStorage.getItem('reRideUsers_error');
                                if (errRaw) {
                                    const err = JSON.parse(errRaw);
                                    if (err.reason && (!err.timestamp || Date.now() - err.timestamp < 3600000)) {
                                        setConfigError({ reason: err.reason, diagnostic: err.diagnostic });
                                    }
                                }
                            } catch (_) { /* ignore */ }
                        }
                        hasFetchedUsersRef.current = false; // Allow retry
                        return;
                    }
                    
                    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                        localStorage.setItem('reRideUsers_prod', JSON.stringify(usersData));
                        localStorage.setItem('reRideUsers', JSON.stringify(usersData));
                        window.dispatchEvent(
                            new CustomEvent('usersCacheUpdated', { detail: { users: usersData } })
                        );
                    }
                    console.log('✅ AdminPanel: User list synced from database (no reload)');
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorAny = error as any;
                    console.error('❌ AdminPanel: Failed to fetch users:', errorMessage);
                    
                    // Check for specific error types
                    if (errorMessage.includes('SUPABASE_SERVICE_ROLE_KEY') || errorMessage.includes('Service temporarily unavailable') || errorMessage.includes('503') || errorAny?.status === 503) {
                        const errorData = errorAny?.errorData || {};
                        setConfigError({
                            reason: errorData.reason || errorMessage || 'SUPABASE_SERVICE_ROLE_KEY is not configured',
                            diagnostic: errorData.diagnostic
                        });
                        console.error('❌ CRITICAL: This appears to be a configuration issue.');
                        console.error('   The SUPABASE_SERVICE_ROLE_KEY environment variable is likely missing or misconfigured.');
                        console.error('   Action required:');
                        console.error('   1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
                        console.error('   2. Add SUPABASE_SERVICE_ROLE_KEY for Production environment');
                        console.error('   3. Get the key from Supabase Dashboard → Settings → API → service_role key');
                        console.error('   4. Redeploy your application after setting the variable');
                    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('Admin access required')) {
                        console.error('❌ Access denied: Ensure you are logged in as an admin user.');
                    } else if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
                        console.error('❌ Authentication failed: Please log in again.');
                    }
                    
                    hasFetchedUsersRef.current = false; // Allow retry on next mount
                }
            };
            
            fetchUsers();
        }
    }, [currentUser?.role, users, isLoading, isRefreshing]);
    
    // Helper function to handle loading states
    const handleActionWithLoading = async (actionKey: string, action: () => void | Promise<void>) => {
        setLoadingActions(prev => new Set(prev).add(actionKey));
        try {
            await action();
        } finally {
            setLoadingActions(prev => {
                const newSet = new Set(prev);
                newSet.delete(actionKey);
                return newSet;
            });
        }
    };
    
    /** Sync users from API/Supabase without a full page reload (AppProvider listens for `usersCacheUpdated`). */
    const handleRefreshData = async () => {
        setIsRefreshing(true);
        try {
            const { dataService } = await import('../services/dataService');
            const usersData = await dataService.getUsers(true);
            console.log(`🔄 Refresh: Loaded ${usersData.length} users from database`);

            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                localStorage.setItem('reRideUsers_prod', JSON.stringify(usersData));
                localStorage.setItem('reRideUsers', JSON.stringify(usersData));
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('usersCacheUpdated', { detail: { users: usersData } })
                );
            }
        } catch (error) {
            console.error('Failed to refresh data:', error);
            alert('Failed to refresh data. Please try again.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const analytics = useMemo(() => {
        // Add null/undefined checks to prevent length errors
        const safeUsers = users || [];
        const safeVehicles = vehicles || [];
        const safeConversations = conversations || [];
        
        const totalUsers = safeUsers.length;
        const totalVehicles = safeVehicles.length;
        const activeListings = safeVehicles.filter(v => v.status === 'published').length;
        const soldListings = safeVehicles.filter(v => v.status === 'sold');
        // FIX: Added Number() to ensure v.price is treated as a number, preventing arithmetic errors on potentially mixed types.
        const totalSales = soldListings.reduce((sum: number, v) => sum + (Number(v.price) || 0), 0);
        const flaggedVehiclesCount = safeVehicles.reduce((sum: number, v) => v.isFlagged ? sum + 1 : sum, 0);
        const flaggedConversationsCount = safeConversations.reduce((sum: number, c) => c.isFlagged ? sum + 1 : sum, 0);
        const flaggedContent = flaggedVehiclesCount + flaggedConversationsCount;
        const certificationRequests = safeVehicles.filter(v => v.certificationStatus === 'requested').length;
        
        const listingsByMake = safeVehicles.reduce((acc, v) => {
            acc[v.make] = (acc[v.make] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalUsers,
            totalVehicles,
            activeListings,
            totalSales,
            flaggedContent,
            certificationRequests,
            listingsByMake: Object.entries(listingsByMake)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([make, count]) => ({ label: make, value: count }))
        };
    }, [users, vehicles, conversations]);

    const openSupportCount = useMemo(
        () => (supportTickets || []).filter((t) => t.status === 'Open').length,
        [supportTickets]
    );

    type AdminNavItem = { view: AdminView; label: string; count?: number };
    type AdminNavGroup = { id: string; label: string; items: AdminNavItem[] };

    /** Grouped admin nav: sidebar sections + mobile optgroups share this structure. */
    const adminNavGroups = useMemo((): AdminNavGroup[] => [
                {
                    id: 'overview',
                    label: 'Overview',
                    items: [{ view: 'analytics' as const, label: 'Analytics' }],
                },
                {
                    id: 'people',
                    label: 'People & accounts',
                    items: [{ view: 'users' as const, label: 'User management' }],
                },
                {
                    id: 'marketplace',
                    label: 'Marketplace & listings',
                    items: [
                        { view: 'listings' as const, label: 'Listings' },
                        { view: 'sellCarAdmin' as const, label: 'Sell car submissions' },
                        { view: 'vehicleData' as const, label: 'Vehicle data' },
                    ],
                },
                {
                    id: 'trust',
                    label: 'Trust & safety',
                    items: [
                        { view: 'moderation' as const, label: 'Moderation queue', count: analytics.flaggedContent },
                        {
                            view: 'certificationRequests' as const,
                            label: 'Certification requests',
                            count: analytics.certificationRequests,
                        },
                    ],
                },
                {
                    id: 'commerce',
                    label: 'Commerce & billing',
                    items: [
                        { view: 'payments' as const, label: 'Payment requests' },
                        { view: 'planManagement' as const, label: 'Plan management' },
                    ],
                },
                {
                    id: 'support',
                    label: 'Support & content',
                    items: [
                        { view: 'support' as const, label: 'Support tickets', count: openSupportCount },
                        { view: 'faq' as const, label: 'FAQ management' },
                    ],
                },
                {
                    id: 'services',
                    label: 'Services',
                    items: [
                        { view: 'serviceOps' as const, label: 'Service ops' },
                        { view: 'serviceManagement' as const, label: 'Service management' },
                    ],
                },
                {
                    id: 'system',
                    label: 'System',
                    items: [
                        { view: 'auditLog' as const, label: 'Audit log' },
                        { view: 'settings' as const, label: 'Settings' },
                    ],
                },
        ],
        [analytics.certificationRequests, analytics.flaggedContent, openSupportCount]
    );

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === '1';
        } catch {
            return false;
        }
    });

    const toggleSidebarCollapsed = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
            } catch {
                /* ignore */
            }
            return next;
        });
    };

    const handleSaveUser = (email: string, details: Partial<User>) => {
        onAdminUpdateUser(email, details);
        setEditingUser(null);
    };

    const handleSaveVehicle = async (updatedVehicle: Vehicle) => {
        await Promise.resolve(onUpdateVehicle(updatedVehicle));
        setEditingVehicle(null);
    };

    const requestSort = (key: SortableUserKey) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'ascending' 
                    ? { key, direction: 'descending' }
                    : null;
            }
            return { key, direction: 'ascending' };
        });
    };

    const sortedUsers = useMemo(() => {
        const list = users || [];
        if (!sortConfig) return list;

        return [...list].sort((a, b) => {
            if (sortConfig.key === 'partnerBanks') {
                const firstBank = (p?: string[]) =>
                    p?.length
                        ? [...p].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }))[0]!.toLowerCase()
                        : '';
                const av = firstBank(a.partnerBanks);
                const bv = firstBank(b.partnerBanks);
                if (av < bv) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (av > bv) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            }
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }, [users, sortConfig]);

    const filteredUsers = useMemo(() => {
        if (roleFilter === 'all') return sortedUsers;
        if (roleFilter === 'finance_partner') {
            return sortedUsers.filter(userHasFinancePartnerAffiliation);
        }
        return sortedUsers.filter(user => user.role === roleFilter);
    }, [sortedUsers, roleFilter]);

    const userRoleCounts = useMemo(() => {
        const list = users || [];
        return {
            all: list.length,
            customer: list.filter(u => u.role === 'customer').length,
            seller: list.filter(u => u.role === 'seller').length,
            admin: list.filter(u => u.role === 'admin').length,
            finance_partner: list.filter(u => userHasFinancePartnerAffiliation(u)).length,
        };
    }, [users]);

    const usersDisplayed = useMemo(() => {
        const q = userListSearch.trim().toLowerCase();
        if (!q) return filteredUsers;
        return filteredUsers.filter(u => {
            const name = (u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const mobile = (u.mobile || '').replace(/\s/g, '').toLowerCase();
            const addr = (u.address || u.location || '').toLowerCase();
            const banks = (u.partnerBanks || []).join(' ').toLowerCase();
            return name.includes(q) || email.includes(q) || mobile.includes(q) || addr.includes(q) || banks.includes(q);
        });
    }, [filteredUsers, userListSearch]);

    const userDirectoryNeedsPagination = usersDisplayed.length > 10;

    const userDirectoryTotalPages = Math.max(1, Math.ceil(usersDisplayed.length / userDirectoryPageSize));

    const directoryTableRows = useMemo(() => {
        if (!userDirectoryNeedsPagination) return usersDisplayed;
        const start = (userDirectoryPage - 1) * userDirectoryPageSize;
        return usersDisplayed.slice(start, start + userDirectoryPageSize);
    }, [usersDisplayed, userDirectoryNeedsPagination, userDirectoryPage, userDirectoryPageSize]);

    const showUserDirectorySellerColumns =
        roleFilter === 'all' || roleFilter === 'seller' || roleFilter === 'finance_partner';
    const userDirectoryColumnCount = showUserDirectorySellerColumns ? 11 : 9;

    useEffect(() => {
        setUserDirectoryPage(1);
    }, [roleFilter, userListSearch]);

    useEffect(() => {
        setUserDirectoryPage(p => (p > userDirectoryTotalPages ? userDirectoryTotalPages : p));
    }, [userDirectoryTotalPages]);

    const handleUserDirectoryPageSizeChange = (size: number) => {
        setUserDirectoryPageSize(size);
        setUserDirectoryPage(1);
    };

    // Pagination logic for vehicles
    const filteredVehicles = useMemo(() => {
        const vList = vehicles || [];
        if (selectedSeller === 'all') return vList;
        // Normalize emails for comparison (critical for production)
        const normalizedSelectedSeller = selectedSeller ? selectedSeller.toLowerCase().trim() : '';
        return vList.filter(vehicle => {
          if (!vehicle?.sellerEmail) return false;
          return vehicle.sellerEmail.toLowerCase().trim() === normalizedSelectedSeller;
        });
    }, [vehicles, selectedSeller]);

    const paginatedVehicles = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredVehicles.slice(startIndex, endIndex);
    }, [filteredVehicles, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1); // Reset to first page when changing items per page
    };

    const renderContent = () => {
        switch (activeView) {
            case 'analytics':
                // Show loading skeleton if data is still loading
                // Only show loading if explicitly loading OR if we have no data AND no cache (first load)
                const safeUsersLen = (users || []).length;
                const safeVehiclesLen = (vehicles || []).length;
                const hasNoData = safeUsersLen === 0 && safeVehiclesLen === 0;
                const hasCache = typeof window !== 'undefined' && 
                    (localStorage.getItem('reRideVehicles_prod') || localStorage.getItem('reRideUsers_prod'));
                if (isLoading || (hasNoData && !hasCache)) {
                    return (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                                    >
                                        <div className="mb-4 flex items-center justify-between">
                                            <div className="h-5 w-24 rounded bg-slate-200" />
                                            <div className="h-10 w-10 rounded-xl bg-slate-200" />
                                        </div>
                                        <div className="h-8 w-20 rounded bg-slate-200" />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                                    <div className="mb-4 h-6 w-40 rounded bg-slate-200" />
                                    <div className="h-52 rounded-xl bg-slate-100" />
                                </div>
                                <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                                    <div className="mb-4 h-6 w-32 rounded bg-slate-200" />
                                    <div className="space-y-3">
                                        <div className="h-4 rounded bg-slate-200" />
                                        <div className="h-4 rounded bg-slate-200" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-3 py-10">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                                <span className="text-sm font-medium text-slate-600">Loading dashboard…</span>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="space-y-6">
                        <AdminPageIntro
                            eyebrow="Overview"
                            title="Operations dashboard"
                            description="Live snapshot of users, inventory, and items that need trust or certification attention."
                        />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <AdminStatTile
                                accent="violet"
                                title="Total users"
                                value={analytics.totalUsers}
                                icon={<span className="text-xl">👥</span>}
                            />
                            <AdminStatTile
                                accent="sky"
                                title="Total vehicles"
                                value={analytics.totalVehicles}
                                icon={<span className="text-xl">🚗</span>}
                            />
                            <AdminStatTile
                                accent="emerald"
                                title="Active listings"
                                value={analytics.activeListings}
                                icon={<span className="text-xl">📋</span>}
                            />
                            <AdminStatTile
                                accent="amber"
                                title="Total sales"
                                value={`₹${formatInrAmount(analytics.totalSales)}`}
                                icon={<span className="text-xl">💰</span>}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <AdminBarChartPanel title="Top vehicle makes" data={analytics.listingsByMake} />
                            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-6">
                                <h3 className="text-base font-semibold tracking-tight text-slate-900">Trust queue</h3>
                                <p className="mt-0.5 text-xs text-slate-500">Moderation and certification workload</p>
                                <div className="mt-6 space-y-3">
                                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50/80 to-violet-50/30 px-4 py-3.5">
                                        <span className="text-sm font-medium text-slate-600">Flagged content</span>
                                        <span className="text-xl font-bold tabular-nums text-slate-900">
                                            {analytics.flaggedContent}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50/80 to-indigo-50/30 px-4 py-3.5">
                                        <span className="text-sm font-medium text-slate-600">Certification requests</span>
                                        <span className="text-xl font-bold tabular-nums text-slate-900">
                                            {analytics.certificationRequests}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                );
            case 'users':
    return (
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-gray-200/90 bg-white shadow-sm overflow-hidden">
                            <div className="border-b border-gray-100 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 px-4 py-4 sm:px-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">User management</h2>
                                        <p className="text-xs text-gray-500 mt-1 max-w-xl">
                                            Role filters and search run locally. The Finance partners tab lists anyone with the finance partner role or with linked partner banks (sellers and service providers). Refresh pulls the latest users from the server (Supabase-backed API) and updates the app instantly—no full page reload.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleRefreshData();
                                            }}
                                            disabled={isRefreshing}
                                            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                                                isRefreshing
                                                    ? 'bg-slate-200 text-slate-600 cursor-wait'
                                                    : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 hover:shadow'
                                            }`}
                                            title="Fetch latest users from the database"
                                        >
                                            {isRefreshing ? (
                                                <>
                                                    <span className="h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" aria-hidden />
                                                    Syncing…
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                    Refresh
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setShowImportUsersModal(true);
                                            }}
                                            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                                        >
                                            Import
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleActionWithLoading('export-users', onExportUsers);
                                            }}
                                            disabled={loadingActions.has('export-users')}
                                            className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition-colors ${
                                                loadingActions.has('export-users')
                                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            }`}
                                        >
                                            {loadingActions.has('export-users') ? 'Exporting…' : 'Export'}
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="inline-flex flex-wrap rounded-xl bg-gray-100/90 p-1 gap-0.5" role="group" aria-label="Filter by role">
                                        <button
                                            type="button"
                                            onClick={() => setRoleFilter('all')}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                                                roleFilter === 'all'
                                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/80'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            All <span className="text-gray-400 font-normal">({userRoleCounts.all})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRoleFilter('customer')}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                                                roleFilter === 'customer'
                                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/80'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            Customers <span className="text-gray-400 font-normal">({userRoleCounts.customer})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRoleFilter('seller')}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                                                roleFilter === 'seller'
                                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/80'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            Sellers <span className="text-gray-400 font-normal">({userRoleCounts.seller})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRoleFilter('admin')}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                                                roleFilter === 'admin'
                                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/80'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            Admins <span className="text-gray-400 font-normal">({userRoleCounts.admin})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRoleFilter('finance_partner')}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                                                roleFilter === 'finance_partner'
                                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/80'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            Finance partners <span className="text-gray-400 font-normal">({userRoleCounts.finance_partner})</span>
                                        </button>
                                    </div>
                                    <label className="relative block w-full sm:max-w-xs">
                                        <span className="sr-only">Search users</span>
                                        <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="search"
                                            value={userListSearch}
                                            onChange={(e) => setUserListSearch(e.target.value)}
                                            placeholder="Search name, email, phone, bank…"
                                            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200/90 bg-white shadow-sm overflow-hidden">
                            <div className="flex flex-col gap-1 border-b border-gray-100 bg-gray-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                                <h3 className="text-sm font-semibold text-gray-900">
                                    Directory
                                    <span className="ml-1.5 font-normal text-gray-500">
                                        {(() => {
                                            const rangeSuffix =
                                                userDirectoryNeedsPagination && usersDisplayed.length > 0
                                                    ? ` · ${(userDirectoryPage - 1) * userDirectoryPageSize + 1}–${Math.min(
                                                          userDirectoryPage * userDirectoryPageSize,
                                                          usersDisplayed.length
                                                      )} of ${usersDisplayed.length}`
                                                    : '';
                                            if (userListSearch.trim()) {
                                                return `${usersDisplayed.length} shown · ${filteredUsers.length} in view${rangeSuffix}`;
                                            }
                                            return `${filteredUsers.length} in view${rangeSuffix}`;
                                        })()}
                                    </span>
                                </h3>
                                {userListSearch.trim() ? (
                                    <button
                                        type="button"
                                        onClick={() => setUserListSearch('')}
                                        className="self-start text-xs font-medium text-indigo-600 hover:text-indigo-800 sm:self-auto"
                                    >
                                        Clear search
                                    </button>
                                ) : null}
                            </div>
                            <div className="overflow-x-auto">
                                <div className="max-h-[min(70vh,720px)] overflow-y-auto">
                                <table className="w-full divide-y divide-gray-200" style={{ minWidth: '880px' }}>
                                    <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgb(229_231_235)]">
                                        <tr>
                                            <SortableHeader title="Name" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} />
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Email</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Mobile</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Address</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Role</th>
                                            <SortableHeader title="Status" sortKey="status" sortConfig={sortConfig} requestSort={requestSort} />
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Member Since</th>
                                            {showUserDirectorySellerColumns ? (
                                              <SortableHeader title="Finance partners" sortKey="partnerBanks" sortConfig={sortConfig} requestSort={requestSort} />
                                            ) : null}
                                            {showUserDirectorySellerColumns ? (
                                              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Recommended</th>
                                            ) : null}
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Documents</th>
                                            <th className="w-1 px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {directoryTableRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={userDirectoryColumnCount} className="px-4 py-10 text-center text-sm text-gray-500">
                                                    No users match this filter or search.
                                                </td>
                                            </tr>
                                        ) : null}
                                        {directoryTableRows.map(user => {
                                            const memberSince = user.createdAt || user.joinedDate;
                                            const formattedDate = memberSince 
                                                ? (() => {
                                                    try {
                                                        const date = new Date(memberSince);
                                                        if (!isNaN(date.getTime())) {
                                                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                                        }
                                                    } catch (e) {
                                                        // Invalid date
                                                    }
                                                    return 'N/A';
                                                })()
                                                : 'N/A';
                                            return (
                                            <tr key={user.email} className="transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-indigo-50/40">
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="font-medium text-sm text-gray-900">{user.name}</div>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">{user.email}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">{user.mobile || 'N/A'}</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-xs">
                                                    <div className="truncate" title={user.address || user.location || 'N/A'}>
                                                        {user.address || user.location || 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 inline-flex text-xs font-medium rounded-full ${
                                                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                        user.role === 'seller' ? 'bg-blue-100 text-blue-700' :
                                                        user.role === 'service_provider' ? 'bg-teal-100 text-teal-800' :
                                                        user.role === 'finance_partner' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-emerald-100 text-emerald-800'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 inline-flex text-xs font-medium rounded-full ${
                                                        user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {user.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">{formattedDate}</td>
                                                {showUserDirectorySellerColumns && (
                                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {user.partnerBanks && user.partnerBanks.length > 0 &&
                                                    (user.role === 'seller' || user.role === 'service_provider' || user.role === 'finance_partner') ? (
                                                      <div className="flex flex-wrap gap-1">
                                                        {user.partnerBanks.slice(0, 2).map((bank, idx) => (
                                                          <span
                                                            key={idx}
                                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
                                                          >
                                                            {bank}
                                                          </span>
                                                        ))}
                                                        {user.partnerBanks.length > 2 && (
                                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-gray-500">
                                                            +{user.partnerBanks.length - 2}
                                                          </span>
                                                        )}
                                                      </div>
                                                    ) : user.role === 'seller' || user.role === 'service_provider' ? (
                                                      <span className="text-xs text-gray-400">No partners</span>
                                                    ) : user.role === 'finance_partner' ? (
                                                      <span className="text-xs text-gray-400">Role account</span>
                                                    ) : (
                                                      <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                  </td>
                                                )}
                                                {showUserDirectorySellerColumns && (
                                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {user.role === 'seller' || user.role === 'service_provider' ? (
                                                      <span className={`px-2 py-0.5 inline-flex text-xs font-medium rounded-full ${
                                                        isRerideStaffPick(user.rerideRecommended) ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                                                      }`}>
                                                        {isRerideStaffPick(user.rerideRecommended) ? 'Yes' : 'No'}
                                                      </span>
                                                    ) : (
                                                      <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                  </td>
                                                )}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.aadharCard?.documentUrl && (
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                                user.aadharCard?.isVerified 
                                                                    ? 'bg-green-100 text-green-700' 
                                                                    : 'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                                A{user.aadharCard.isVerified ? '✓' : '!'}
                                                            </span>
                                                        )}
                                                        {user.panCard?.documentUrl && (
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                                user.panCard?.isVerified 
                                                                    ? 'bg-green-100 text-green-700' 
                                                                    : 'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                                P{user.panCard.isVerified ? '✓' : '!'}
                                                            </span>
                                                        )}
                                                        {(!user.aadharCard?.documentUrl && !user.panCard?.documentUrl) && (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-2 py-2 text-right">
                                                    <div
                                                        className="inline-flex shrink-0 items-center justify-end gap-0.5"
                                                        role="group"
                                                        aria-label={`Actions for ${user.name || user.email}`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setEditingUser(user);
                                                            }}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                                            title="Edit user"
                                                            aria-label={`Edit ${user.email}`}
                                                        >
                                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                                                />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                const action = user.status === 'active' ? 'suspend' : 'activate';
                                                                if (window.confirm(`Are you sure you want to ${action} user ${user.email}?`)) {
                                                                    handleActionWithLoading(`toggle-user-${user.email}`, () =>
                                                                        onToggleUserStatus(user.email)
                                                                    );
                                                                }
                                                            }}
                                                            disabled={loadingActions.has(`toggle-user-${user.email}`)}
                                                            title={
                                                                user.status === 'active' ? 'Suspend account' : 'Activate account'
                                                            }
                                                            aria-label={
                                                                user.status === 'active'
                                                                    ? `Suspend ${user.email}`
                                                                    : `Activate ${user.email}`
                                                            }
                                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                                                                loadingActions.has(`toggle-user-${user.email}`)
                                                                    ? 'cursor-not-allowed text-slate-300'
                                                                    : 'text-amber-700 hover:bg-amber-50 hover:text-amber-900'
                                                            }`}
                                                        >
                                                            {loadingActions.has(`toggle-user-${user.email}`) ? (
                                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" aria-hidden />
                                                            ) : user.status === 'active' ? (
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                                                                </svg>
                                                            ) : (
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (
                                                                    window.confirm(
                                                                        `Are you sure you want to delete user ${user.email}? This action cannot be undone.`
                                                                    )
                                                                ) {
                                                                    handleActionWithLoading(`delete-user-${user.email}`, () =>
                                                                        onDeleteUser(user.email)
                                                                    );
                                                                }
                                                            }}
                                                            disabled={loadingActions.has(`delete-user-${user.email}`)}
                                                            title="Delete user"
                                                            aria-label={`Delete ${user.email}`}
                                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                                                                loadingActions.has(`delete-user-${user.email}`)
                                                                    ? 'cursor-not-allowed text-slate-300'
                                                                    : 'text-red-600 hover:bg-red-50 hover:text-red-800'
                                                            }`}
                                                        >
                                                            {loadingActions.has(`delete-user-${user.email}`) ? (
                                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" aria-hidden />
                                                            ) : (
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                                    />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                </div>
                                {userDirectoryNeedsPagination ? (
                                    <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                                        <label className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                            <span className="font-medium text-gray-700">Rows per page</span>
                                            <select
                                                value={userDirectoryPageSize}
                                                onChange={(e) => handleUserDirectoryPageSizeChange(Number(e.target.value))}
                                                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            >
                                                <option value={10}>10</option>
                                                <option value={20}>20</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                            </select>
                                        </label>
                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            <span className="text-xs text-gray-500 tabular-nums sm:text-sm">
                                                Page {userDirectoryPage} of {userDirectoryTotalPages}
                                            </span>
                                            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => setUserDirectoryPage((p) => Math.max(1, p - 1))}
                                                    disabled={userDirectoryPage <= 1}
                                                    className="rounded-md px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setUserDirectoryPage((p) =>
                                                            Math.min(userDirectoryTotalPages, p + 1)
                                                        )
                                                    }
                                                    disabled={userDirectoryPage >= userDirectoryTotalPages}
                                                    className="rounded-md px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                );
            case 'listings':
                return (
                    <div className="space-y-6">
                        <AdminPageIntro
                            eyebrow="Marketplace"
                            title="Vehicle listings"
                            description="Filter by seller, paginate in bulk, and import or export inventory for operations."
                        />
                        <AdminToolbar
                            left={
                                <>
                                    <SellerFilterDropdown
                                        sellers={users.filter((u) => u.role === 'seller')}
                                        selectedSeller={selectedSeller}
                                        onSellerChange={setSelectedSeller}
                                    />
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                                    >
                                        <option value={10}>10 per page</option>
                                        <option value={20}>20 per page</option>
                                        <option value={50}>50 per page</option>
                                        <option value={100}>100 per page</option>
                                    </select>
                                </>
                            }
                            right={
                                <>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowImportModal(true);
                                        }}
                                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                    >
                                        Import vehicles
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleActionWithLoading('export-vehicles', onExportVehicles);
                                        }}
                                        disabled={loadingActions.has('export-vehicles')}
                                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
                                            loadingActions.has('export-vehicles')
                                                ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        }`}
                                    >
                                        {loadingActions.has('export-vehicles') ? 'Exporting…' : 'Export vehicles'}
                                    </button>
                                </>
                            }
                        />
                        <AdminDataTableFrame
                            title="All listings"
                            subtitle={`${filteredVehicles.length} total · showing ${paginatedVehicles.length} on this page`}
                        >
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead>
                                    <tr>
                                        <th className={`${adminTableHeadClass} px-4 py-3`}>Vehicle</th>
                                        <th className={`${adminTableHeadClass} px-4 py-3`}>Seller</th>
                                        <th className={`${adminTableHeadClass} px-4 py-3`}>Price</th>
                                        <th className={`${adminTableHeadClass} px-4 py-3`}>Status</th>
                                        <th className={`${adminTableHeadClass} px-4 py-3`}>Offer</th>
                                        <th className={`${adminTableHeadClass} px-4 py-3 text-right`}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {paginatedVehicles.map(vehicle => (
                                        <tr key={vehicle.id}>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">{vehicle.sellerEmail}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">₹{formatInrAmount(vehicle.price)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    vehicle.status === 'published' ? 'bg-green-100 text-green-800' :
                                                    vehicle.status === 'sold' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {vehicle.status}
                                                </span>
                                    </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {!vehicle.offerEnabled ? (
                                                    <span className="text-gray-400">—</span>
                                                ) : isSellerListingOfferVisible(vehicle) ? (
                                                    <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="px-2 py-0.5 inline-flex text-xs font-medium rounded-full bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                                                        title="Offer is enabled but hidden from buyers (check dates or offer text)"
                                                    >
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                <button 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setEditingVehicle(vehicle);
                                                    }} 
                                                    className="text-blue-600 hover:text-blue-800 cursor-pointer"
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const action = vehicle.status === 'published' ? 'unpublish' : 'publish';
                                                        if (window.confirm(`Are you sure you want to ${action} this vehicle listing?`)) {
                                                            handleActionWithLoading(`toggle-vehicle-${vehicle.id}`, () => onToggleVehicleStatus(vehicle.id));
                                                        }
                                                    }} 
                                                    disabled={loadingActions.has(`toggle-vehicle-${vehicle.id}`)}
                                                    className={`cursor-pointer ${
                                                        loadingActions.has(`toggle-vehicle-${vehicle.id}`)
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : 'text-yellow-600 hover:text-yellow-800'
                                                    }`}
                                                >
                                                    {loadingActions.has(`toggle-vehicle-${vehicle.id}`) ? '...' : (vehicle.status === 'published' ? 'Unpublish' : 'Publish')}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleActionWithLoading(
                                                            `feature-vehicle-${vehicle.id}`,
                                                            () => onToggleVehicleFeature(vehicle.id)
                                                        );
                                                    }}
                                                    disabled={loadingActions.has(`feature-vehicle-${vehicle.id}`)}
                                                    className={`cursor-pointer ${
                                                        loadingActions.has(`feature-vehicle-${vehicle.id}`)
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : vehicle.isFeatured
                                                                ? 'text-purple-600 hover:text-purple-800'
                                                                : 'text-green-600 hover:text-green-800'
                                                    }`}
                                                >
                                                    {loadingActions.has(`feature-vehicle-${vehicle.id}`)
                                                        ? '...'
                                                        : vehicle.isFeatured
                                                            ? 'Unfeature'
                                                            : 'Feature'}
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (window.confirm(`Are you sure you want to delete this vehicle listing? This action cannot be undone.`)) {
                                                            handleActionWithLoading(`delete-vehicle-${vehicle.id}`, () => onDeleteVehicle(vehicle.id));
                                                        }
                                                    }} 
                                                    disabled={loadingActions.has(`delete-vehicle-${vehicle.id}`)}
                                                    className={`cursor-pointer ${
                                                        loadingActions.has(`delete-vehicle-${vehicle.id}`)
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : 'text-red-600 hover:text-red-800'
                                                    }`}
                                                >
                                                    {loadingActions.has(`delete-vehicle-${vehicle.id}`) ? '...' : 'Delete'}
                                                </button>
                                    </td>
                                </tr>
                           ))}
                        </tbody>
                    </table>
                            {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 text-sm font-medium tabular-nums text-slate-600">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
            </AdminDataTableFrame>
        </div>
    );
            case 'moderation':
                return <ModerationQueueView />;
            case 'certificationRequests':
                return <CertificationRequestsView requests={vehicles.filter(v => v.certificationStatus === 'requested')} users={users} onCertificationApproval={onCertificationApproval} />;
            case 'vehicleData':
                return (
                    <VehicleDataManagement 
                        vehicleData={vehicleData} 
                        onUpdate={onUpdateVehicleData}
                        onPreview={() => setShowPreviewModal(true)}
                        onBulkUpload={() => setIsBulkUploadOpen(true)}
                    />
                );
            case 'sellCarAdmin':
                return props.onNavigate ? (
                    <SellCarAdmin onNavigate={props.onNavigate} embedded />
                ) : null;
            case 'auditLog':
                return <AuditLogView auditLog={auditLog} />;
            case 'settings':
                return <PlatformSettingsView />;
            case 'support':
                return <SupportTicketsView />;
            case 'faq':
                return <FAQManagementView />;
            case 'payments':
                return <PaymentManagement currentUser={currentUser} />;
            case 'planManagement':
                return <PlanManagementView />;
            case 'serviceOps':
                return <AdminServiceOps />;
            case 'serviceManagement':
                return <ServiceManagement />;
            default:
                return null;
        }
    };

    // Moderation Queue View Component
    const ModerationQueueView = () => {
        const [filter, setFilter] = useState<'all' | 'vehicles' | 'conversations'>('all');
        
        const flaggedVehicles = vehicles.filter(v => v.isFlagged);
        const flaggedConversations = conversations.filter(c => c.isFlagged);
        
        const getFilteredItems = () => {
            switch (filter) {
                case 'vehicles':
                    return flaggedVehicles;
                case 'conversations':
                    return flaggedConversations;
                default:
                    return [...flaggedVehicles, ...flaggedConversations];
            }
        };

        const handleResolveFlag = (type: 'vehicle' | 'conversation', id: number | string) => {
            if (window.confirm(`Are you sure you want to resolve this ${type} flag?`)) {
                onResolveFlag(type, id);
        }
    };

    return (
            <div className="space-y-6">
                <AdminPageIntro
                    eyebrow="Trust & safety"
                    title="Moderation queue"
                    description="Review flagged vehicles and conversations. Resolve when issues are cleared."
                />
                <AdminSegmentedTabs
                    aria-label="Moderation filter"
                    value={filter}
                    onChange={setFilter}
                    items={[
                        {
                            id: 'all',
                            label: 'All',
                            count: flaggedVehicles.length + flaggedConversations.length,
                        },
                        { id: 'vehicles', label: 'Vehicles', count: flaggedVehicles.length },
                        {
                            id: 'conversations',
                            label: 'Conversations',
                            count: flaggedConversations.length,
                        },
                    ]}
                />

                {getFilteredItems().length === 0 ? (
                    <AdminEmptyState
                        variant="success"
                        title="All clear"
                        description="No flagged content is waiting in the queue right now."
                    />
                ) : (
                    <div className="space-y-4">
                        {/* Flagged Vehicles */}
                        {filter === 'all' || filter === 'vehicles' ? (
                            flaggedVehicles.length > 0 && (
                                <AdminDataTableFrame title={`Flagged Vehicles (${flaggedVehicles.length})`}>
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-white dark:bg-white">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Vehicle</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Seller</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Price</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                                            {flaggedVehicles.map(vehicle => (
                                                <tr key={vehicle.id} className="bg-red-50">
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                                                        {vehicle.year} {vehicle.make} {vehicle.model}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{vehicle.sellerEmail}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">₹{formatInrAmount(vehicle.price)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                            FLAGGED
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleResolveFlag('vehicle', vehicle.id);
                                                            }}
                                                            className="text-green-600 hover:text-green-800 font-medium cursor-pointer"
                                                        >
                                                            Resolve Flag
                            </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                console.log('🔄 Toggle flagged vehicle status button clicked for vehicle:', vehicle.id);
                                                                onToggleVehicleStatus(vehicle.id);
                                                            }}
                                                            className="text-yellow-600 hover:text-yellow-800 font-medium cursor-pointer"
                                                        >
                                                            {vehicle.status === 'published' ? 'Unpublish' : 'Publish'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </AdminDataTableFrame>
                            )
                        ) : null}

                        {/* Flagged Conversations */}
                        {filter === 'all' || filter === 'conversations' ? (
                            flaggedConversations.length > 0 && (
                                <AdminDataTableFrame title={`Flagged Conversations (${flaggedConversations.length})`}>
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-white dark:bg-white">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Customer</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Seller</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Vehicle</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Last Message</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                                            {flaggedConversations.map(conversation => {
                                                const vehicle = vehicles.find(v => v.id === conversation.vehicleId);
                                                const lastMessage = conversation.messages && conversation.messages.length > 0 
                                                    ? conversation.messages[conversation.messages.length - 1] 
                                                    : null;
                                                return (
                                                    <tr key={conversation.id} className="bg-red-50">
                                                        <td className="px-6 py-4 whitespace-nowrap">{conversation.customerId}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">{conversation.sellerId}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                            {lastMessage ? lastMessage.text?.substring(0, 50) + '...' : 'No messages'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    console.log('🔄 Resolve conversation flag button clicked for conversation:', conversation.id);
                                                                    handleResolveFlag('conversation', conversation.id);
                                                                }}
                                                                className="text-green-600 hover:text-green-800 font-medium cursor-pointer"
                                                            >
                                                                Resolve Flag
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </AdminDataTableFrame>
                            )
                        ) : null}
                        </div>
                )}
                             </div>
        );
    };

    const PlatformSettingsView = () => {
        const [draft, setDraft] = useState<PlatformSettings>(() => ({
            listingFee: platformSettings.listingFee,
            siteAnnouncement: platformSettings.siteAnnouncement || '',
        }));

        useEffect(() => {
            setDraft({
                listingFee: platformSettings.listingFee,
                siteAnnouncement: platformSettings.siteAnnouncement || '',
            });
        }, [platformSettings.listingFee, platformSettings.siteAnnouncement]);

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const fee = Number(draft.listingFee);
            onUpdateSettings({
                listingFee: Number.isFinite(fee) ? Math.max(0, fee) : platformSettings.listingFee,
                siteAnnouncement: String(draft.siteAnnouncement || '').trim(),
            });
        };

        return (
            <div className="mx-auto max-w-2xl space-y-8">
                <AdminPageIntro
                    eyebrow="System"
                    title="Platform settings"
                    description="Persisted to Supabase (platform_settings). Changes sync across devices; this session keeps a local copy for instant feedback."
                />
                <form
                    onSubmit={handleSubmit}
                    className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-900/40"
                >
                    <div>
                        <label
                            htmlFor="admin-listing-fee"
                            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
                        >
                            Listing fee (₹)
                        </label>
                        <input
                            id="admin-listing-fee"
                            type="number"
                            min={0}
                            step={1}
                            value={draft.listingFee}
                            onChange={(e) =>
                                setDraft((d) => ({ ...d, listingFee: e.target.value === '' ? 0 : Number(e.target.value) }))
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="admin-site-announcement"
                            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
                        >
                            Site announcement
                        </label>
                        <textarea
                            id="admin-site-announcement"
                            rows={4}
                            value={draft.siteAnnouncement}
                            onChange={(e) => setDraft((d) => ({ ...d, siteAnnouncement: e.target.value }))}
                            placeholder="Short message for banners or future homepage use"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                        />
                    </div>
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-indigo-700"
                    >
                        Save settings
                    </button>
                </form>
            </div>
        );
    };

    const SupportTicketsView = () => {
        const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'In Progress' | 'Closed'>('All');
        const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);

        const filteredTickets = (supportTickets || []).filter(ticket =>
            statusFilter === 'All' || ticket.status === statusFilter
        );

        const getStatusColor = (status: string) => {
            switch (status) {
                case 'Open':
                    return 'bg-red-100 text-red-800';
                case 'In Progress':
                    return 'bg-yellow-100 text-yellow-800';
                case 'Resolved':
                    return 'bg-blue-100 text-blue-800';
                case 'Closed':
                    return 'bg-green-100 text-green-800';
                default:
                    return 'bg-gray-100 text-gray-800';
            }
        };

        const nextQuickStatus = (ticket: SupportTicket): SupportTicket['status'] => {
            if (ticket.status === 'Open') return 'In Progress';
            if (ticket.status === 'In Progress') return 'Closed';
            if (ticket.status === 'Resolved') return 'Open';
            return 'Open';
        };

        const quickStatusLabel = (ticket: SupportTicket) => {
            if (ticket.status === 'Open') return 'Start Progress';
            if (ticket.status === 'In Progress') return 'Close';
            if (ticket.status === 'Resolved') return 'Reopen';
            return 'Reopen';
        };

        const formatTicketDate = (iso: string) => {
            if (!iso) return '—';
            const d = new Date(iso);
            return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
        };

        const handleSaveEditedTicket = async () => {
            if (!editingTicket) return;
            if (!editingTicket.subject.trim() || !editingTicket.message.trim()) {
                alert('Subject and message are required.');
                return;
            }
            try {
                await Promise.resolve(onUpdateSupportTicket({
                    ...editingTicket,
                    updatedAt: new Date().toISOString()
                }));
                setEditingTicket(null);
            } catch {
                // Toasts are handled in AppProvider
            }
        };

        return (
            <div className="space-y-6">
                <AdminPageIntro
                    eyebrow="Support"
                    title="Support tickets"
                    description="Track customer issues from open through closed. Use quick actions to move tickets forward."
                />
                <AdminSegmentedTabs
                    aria-label="Ticket status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    items={(['All', 'Open', 'In Progress', 'Closed'] as const).map((status) => ({
                        id: status,
                        label: status,
                        count:
                            status === 'All'
                                ? (supportTickets || []).length
                                : (supportTickets || []).filter((t) => t.status === status).length,
                    }))}
                />

                <AdminDataTableFrame
                    title="Ticket inbox"
                    subtitle={`${filteredTickets.length} in this view`}
                >
                    {filteredTickets.length === 0 ? (
                        <div className="px-4 py-10">
                            <AdminEmptyState
                                title="No tickets"
                                description="Nothing matches this filter right now."
                            />
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead>
                                <tr>
                                    <th className={`${adminTableHeadClass} px-4 py-3`}>ID</th>
                                    <th className={`${adminTableHeadClass} px-4 py-3`}>User</th>
                                    <th className={`${adminTableHeadClass} px-4 py-3`}>Subject</th>
                                    <th className={`${adminTableHeadClass} px-4 py-3`}>Priority</th>
                                    <th className={`${adminTableHeadClass} px-4 py-3`}>Status</th>
                                    <th className={`${adminTableHeadClass} px-4 py-3`}>Created</th>
                                    <th className={`${adminTableHeadClass} px-4 py-3 text-right`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredTickets.map(ticket => (
                                    <tr key={String(ticket.id)} data-testid="support-ticket" className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            #{ticket.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {ticket.userEmail}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={ticket.subject}>
                                            {ticket.subject}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            —
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatTicketDate(ticket.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setEditingTicket({ ...ticket });
                                                }}
                                                className="text-gray-700 hover:text-gray-900 font-medium cursor-pointer"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const newStatus = nextQuickStatus(ticket);
                                                    void Promise.resolve(onUpdateSupportTicket({ ...ticket, status: newStatus })).catch(() => {});
                                                }}
                                                className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                            >
                                                {quickStatusLabel(ticket)}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </AdminDataTableFrame>

                {editingTicket && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div
                            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
                            data-testid="ticket-details"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="edit-ticket-title"
                        >
                            <h3 id="edit-ticket-title" className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                                Edit support ticket
                            </h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Ticket ID</span>
                                        <p className="text-gray-900 dark:text-white mt-1">#{editingTicket.id}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Created</span>
                                        <p className="text-gray-900 dark:text-white mt-1">{formatTicketDate(editingTicket.createdAt)}</p>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Requester</span>
                                        <p className="text-gray-900 dark:text-white mt-1">{editingTicket.userName} ({editingTicket.userEmail})</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Subject</label>
                                    <input
                                        type="text"
                                        value={editingTicket.subject}
                                        onChange={(e) => setEditingTicket({ ...editingTicket, subject: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Message</label>
                                    <textarea
                                        value={editingTicket.message}
                                        onChange={(e) => setEditingTicket({ ...editingTicket, message: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        rows={5}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Status</label>
                                    <select
                                        value={editingTicket.status}
                                        onChange={(e) => setEditingTicket({
                                            ...editingTicket,
                                            status: e.target.value as SupportTicket['status']
                                        })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="Open">Open</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Resolved">Resolved</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setEditingTicket(null)}
                                    className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleSaveEditedTicket()}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                >
                                    Save changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const FAQManagementView = () => {
        const [categoryFilter, setCategoryFilter] = useState<string>('All');
        const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
        const [showAddModal, setShowAddModal] = useState(false);
        const [newFaq, setNewFaq] = useState<Omit<FAQItem, 'id'>>({
            question: '',
            answer: '',
            category: 'General'
        });

        // Get unique categories from FAQs
        const categories = useMemo(() => {
            const cats = new Set<string>();
            (faqItems || []).forEach(faq => cats.add(faq.category));
            return Array.from(cats).sort();
        }, [faqItems]);

        const filteredFaqs = useMemo(() => {
            if (categoryFilter === 'All') return faqItems || [];
            return (faqItems || []).filter(faq => faq.category === categoryFilter);
        }, [faqItems, categoryFilter]);

        const handleSaveFaq = () => {
            if (editingFaq) {
                onUpdateFaq(editingFaq);
                setEditingFaq(null);
            } else {
                if (!newFaq.question || !newFaq.answer || !newFaq.category) {
                    alert('Please fill in all fields');
                    return;
                }
                onAddFaq(newFaq);
                setNewFaq({ question: '', answer: '', category: 'General' });
                setShowAddModal(false);
            }
        };

        const handleDeleteFaq = (id: number) => {
            if (window.confirm('Are you sure you want to delete this FAQ?')) {
                onDeleteFaq(id);
            }
        };

        const faqTabItems = [
            { id: 'All' as const, label: 'All', count: faqItems?.length || 0 },
            ...categories.map((c) => ({
                id: c,
                label: c,
                count: (faqItems || []).filter((f) => f.category === c).length,
            })),
        ];

        return (
            <div className="space-y-6">
                <AdminPageIntro
                    eyebrow="Content"
                    title="FAQ management"
                    description="Curate help articles by category. Edits apply to the public FAQ when saved."
                    actions={
                        <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                            + Add FAQ
                        </button>
                    }
                />

                <AdminSegmentedTabs
                    aria-label="FAQ category"
                    value={categoryFilter}
                    onChange={(id) => setCategoryFilter(id)}
                    items={faqTabItems}
                />

                {/* FAQs Table */}
                <AdminDataTableFrame title={`FAQs (${filteredFaqs.length})`}>
                    {filteredFaqs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {faqItems?.length === 0 
                                ? 'No FAQs found. Click "Add FAQ" to create your first FAQ.'
                                : 'No FAQs found for the selected category.'}
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-white dark:bg-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Question</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Answer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredFaqs.map(faq => (
                                    <tr key={faq.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            #{faq.id}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                                            <div className="truncate" title={faq.question}>
                                                {faq.question}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                                            <div className="truncate" title={faq.answer}>
                                                {faq.answer}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {faq.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => setEditingFaq(faq)}
                                                className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFaq(faq.id)}
                                                className="text-red-600 hover:text-red-800 font-medium cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </AdminDataTableFrame>

                {/* Add FAQ Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add New FAQ</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Question</label>
                                    <input
                                        type="text"
                                        value={newFaq.question}
                                        onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="Enter question"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Answer</label>
                                    <textarea
                                        value={newFaq.answer}
                                        onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="Enter answer"
                                        rows={4}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Category</label>
                                    <input
                                        type="text"
                                        value={newFaq.category}
                                        onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="e.g., General, Selling, Buying"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setNewFaq({ question: '', answer: '', category: 'General' });
                                    }}
                                    className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveFaq}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                >
                                    Save FAQ
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit FAQ Modal */}
                {editingFaq && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit FAQ</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Question</label>
                                    <input
                                        type="text"
                                        value={editingFaq.question}
                                        onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Answer</label>
                                    <textarea
                                        value={editingFaq.answer}
                                        onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        rows={4}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Category</label>
                                    <input
                                        type="text"
                                        value={editingFaq.category}
                                        onChange={(e) => setEditingFaq({ ...editingFaq, category: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setEditingFaq(null)}
                                    className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveFaq}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const PlanManagementView = () => {
        const [editingPlan, setEditingPlan] = useState<PlanDetails | null>(null);
        const [showPlanModal, setShowPlanModal] = useState(false);
        const [showAddPlanModal, setShowAddPlanModal] = useState(false);
        const [showPlanAssignmentModal, setShowPlanAssignmentModal] = useState(false);
        const [assigningUser, setAssigningUser] = useState<User | null>(null);
        const [assigningPlan, setAssigningPlan] = useState<SubscriptionPlan | null>(null);
        const [showExpiryEditModal, setShowExpiryEditModal] = useState(false);
        const [editingExpiryUser, setEditingExpiryUser] = useState<User | null>(null);
        const [planFilter, setPlanFilter] = useState<'all' | SubscriptionPlan>('all');
        const [planStats, setPlanStats] = useState<Record<SubscriptionPlan, number>>({
            free: 0,
            basic: 0,
            pro: 0,
            premium: 0
        });
        const [plans, setPlans] = useState<PlanDetails[]>([]);

        // Helper function to check if a plan is custom
        const isCustomPlan = async (planId: string): Promise<boolean> => {
            try {
                await planService.getOriginalPlanDetails(planId as SubscriptionPlan);
                return false; // If we can get original details, it's a base plan
            } catch (error) {
                return true; // If we can't get original details, it's a custom plan
            }
        };

        // User Row Component
        const UserRow: React.FC<{ user: User; currentPlan: SubscriptionPlan }> = ({ user, currentPlan }) => {
            const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
            
            useEffect(() => {
                planService.getPlanDetails(currentPlan).then(setPlanDetails);
            }, [currentPlan]);
            
            // Normalize emails for comparison (critical for production)
            const normalizedUserEmail = user?.email ? user.email.toLowerCase().trim() : '';
            const userVehicles = vehicles.filter((v: Vehicle) => {
              if (!v?.sellerEmail) return false;
              return v.sellerEmail.toLowerCase().trim() === normalizedUserEmail;
            });
            const activeListings = userVehicles.filter((v: Vehicle) => v.status === 'published').length;
            const featuredListings = userVehicles.filter((v: Vehicle) => v.isFeatured).length;

            const planFeaturedCredits = planDetails?.featuredCredits ?? 0;
            const storedRemainingCredits = typeof user.featuredCredits === 'number'
                ? user.featuredCredits
                : planFeaturedCredits;

            const calculatedRemaining = Math.min(
                storedRemainingCredits,
                Math.max(planFeaturedCredits - featuredListings, 0)
            );
            const usedCredits = Math.max(planFeaturedCredits - calculatedRemaining, featuredListings);
            
            if (!planDetails) {
                return (
                    <tr key={user.email}>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                            Loading plan details...
                        </td>
                    </tr>
                );
            }
            
            return (
                <tr key={user.email}>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-reride-orange flex items-center justify-center text-white font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            currentPlan === 'free' ? 'bg-gray-100 text-gray-800' :
                            currentPlan === 'pro' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                        }`}>
                            {planDetails.name}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {activeListings} / {planDetails.listingLimit === 'unlimited' ? '∞' : planDetails.listingLimit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className="flex-1">
                                <div className="text-sm text-gray-900 dark:text-white">
                                                    {user.usedCertifications || 0} / {planDetails.freeCertifications}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {planFeaturedCredits > 0 ? (
                            <div>
                                <div className="font-medium">
                                    {usedCredits} used / {planFeaturedCredits}
                                </div>
                                <div className="text-xs text-gray-500">
                                    Remaining: {Math.max(planFeaturedCredits - usedCredits, 0)}
                                </div>
                            </div>
                        ) : (
                            <span className="text-gray-400">Not included</span>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex flex-col gap-2">
                                            {currentPlan !== 'free' && (
                                                <button 
                                                    onClick={() => handleAssignPlan(user, 'free')}
                                                    className="text-gray-600 hover:text-gray-800 transition-colors"
                                                >
                                                    Assign Free
                                                </button>
                                            )}
                                            {currentPlan !== 'pro' && (
                                                <button 
                                                    onClick={() => handleAssignPlan(user, 'pro')}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                                >
                                                    Assign Pro
                                                </button>
                                            )}
                                            {currentPlan !== 'premium' && (
                                                <button 
                                                    onClick={() => handleAssignPlan(user, 'premium')}
                                                    className="text-purple-600 hover:text-purple-800 transition-colors"
                                                >
                                                    Assign Premium
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {user.planActivatedDate 
                                            ? new Date(user.planActivatedDate).toLocaleDateString('en-IN', { 
                                                year: 'numeric', 
                                                month: 'short', 
                                                day: 'numeric' 
                                            })
                                            : <span className="text-gray-400">Not set</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                {user.planExpiryDate 
                                                    ? (() => {
                                                        const expiryDate = new Date(user.planExpiryDate);
                                                        const isExpired = expiryDate < new Date();
                                                        const daysRemaining = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                        return (
                                                            <div>
                                                                <div className={isExpired ? 'text-red-600 font-semibold' : daysRemaining <= 7 ? 'text-orange-600 font-semibold' : ''}>
                                                                    {expiryDate.toLocaleDateString('en-IN', { 
                                                                        year: 'numeric', 
                                                                        month: 'short', 
                                                                        day: 'numeric' 
                                                                    })}
                                                                </div>
                                                                {!isExpired && daysRemaining <= 30 && (
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()
                                                    : currentPlan === 'free' 
                                                        ? <span className="text-gray-400">No expiry</span>
                                                        : <span className="text-gray-400">Not set</span>
                                                }
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditingExpiryUser(user);
                                                    setShowExpiryEditModal(true);
                                                }}
                                                className="text-blue-600 hover:text-blue-800 text-xs underline"
                                                title="Edit expiry date"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </td>
                                </tr>
            );
        };

        // Plan Card Component
        const PlanCard: React.FC<{ plan: PlanDetails }> = ({ plan }) => {
            const [isCustom, setIsCustom] = useState<boolean>(false);
            
            useEffect(() => {
                isCustomPlan(plan.id).then(setIsCustom);
            }, [plan.id]);

            const featureList = Array.isArray(plan.features) ? plan.features : [];

            return (
                <div
                    key={plan.id}
                    className={`rounded-2xl border p-6 shadow-sm ring-1 ring-slate-900/[0.03] transition-shadow hover:shadow-md ${
                        isCustom
                            ? 'border-violet-300 bg-gradient-to-b from-violet-50/80 to-white dark:border-violet-600 dark:from-violet-950/40 dark:to-slate-900/40'
                            : 'border-slate-200/90 bg-white dark:border-slate-700 dark:bg-slate-900/30'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark">{plan.name}</h3>
                                {isCustom && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                                        CUSTOM
                                    </span>
                                )}
                            </div>
                            <p className="text-2xl font-bold text-reride-text-dark dark:text-reride-text-dark mt-2">
                                ₹{formatInrAmount(plan?.price)}
                                <span className="text-sm font-normal text-gray-500">/month</span>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleEditPlan(plan)}
                                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                                Edit
                            </button>
                            {isCustom && (
                                <button
                                    onClick={() => handleDeletePlan(plan)}
                                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Listings:</span>
                            <span className="font-medium">{plan.listingLimit}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Featured Credits:</span>
                            <span className="font-medium">{plan.featuredCredits}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Free Certifications:</span>
                            <span className="font-medium">{plan.freeCertifications}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Features:</p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {featureList.map((feature, index) => (
                                <li key={index} className="flex items-center gap-2">
                                    <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {plan.isMostPopular && (
                        <div className="mt-4 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full text-center">
                            MOST POPULAR
                        </div>
                    )}
                </div>
            );
        };

        // Load plans from service
        useEffect(() => {
            const loadPlans = async () => {
                const allPlans = await planService.getAllPlans();
                setPlans(allPlans);
            };
            loadPlans();
        }, []);

        // Calculate plan statistics
        useEffect(() => {
            // Only count sellers for plan statistics
            const sellerUsers = users.filter(user => user.role === 'seller');
            const initial: Record<SubscriptionPlan, number> = { free: 0, basic: 0, pro: 0, premium: 0 };
            const stats = sellerUsers.reduce((acc, user) => {
                const plan = user.subscriptionPlan || 'free';
                acc[plan] = (acc[plan] ?? 0) + 1;
                return acc;
            }, { ...initial });
            setPlanStats(stats);
        }, [users]);

        const filteredUsers = useMemo(() => {
            // First filter by role - only show sellers
            const sellerUsers = users.filter(user => user.role === 'seller');
            
            // Then filter by plan type if not 'all'
            if (planFilter === 'all') return sellerUsers;
            return sellerUsers.filter(user => (user.subscriptionPlan || 'free') === planFilter);
        }, [users, planFilter]);

        const handleEditPlan = (plan: PlanDetails) => {
            setEditingPlan(plan);
            setShowPlanModal(true);
        };

        const handleAddNewPlan = async () => {
            if (!(await planService.canAddNewPlan())) {
                alert('Maximum of 4 plans allowed. Please delete an existing custom plan first.');
                return;
            }
            setShowAddPlanModal(true);
        };

        const handleSavePlan = async (updatedPlan: PlanDetails) => {
            // Update the plan using the plan service
            planService.updatePlan(updatedPlan.id, updatedPlan);
            
            // Refresh the plans list
            const allPlans = await planService.getAllPlans();
            setPlans(allPlans);
            
            // Close modal
            setShowPlanModal(false);
            setEditingPlan(null);
            
            // Show success message
            alert(`Plan "${updatedPlan.name}" has been updated successfully!`);
        };

        const handleCreatePlan = async (newPlanData: Omit<PlanDetails, 'id'>) => {
            // Create new plan using the plan service
            planService.createPlan(newPlanData);
            
            // Refresh the plans list
            const allPlans = await planService.getAllPlans();
            setPlans(allPlans);
            
            // Close modal
            setShowAddPlanModal(false);
            
            // Show success message
            alert(`Plan "${newPlanData.name}" has been created successfully!`);
        };

        const handleDeletePlan = async (plan: PlanDetails) => {
            // Check if it's a base plan by trying to get original details
            try {
                const originalPlan = await planService.getOriginalPlanDetails(plan.id as SubscriptionPlan);
                if (originalPlan) {
                    alert('Cannot delete base plans (Free, Pro, Premium).');
                    return;
                }
            } catch (error) {
                // If we can't get original details, it's likely a custom plan
            }
            
            if (window.confirm(`Are you sure you want to delete the "${plan.name}" plan? This action cannot be undone.`)) {
                if (await planService.deletePlan(plan.id)) {
                    setPlans(await planService.getAllPlans());
                    alert(`Plan "${plan.name}" has been deleted successfully!`);
                }
            }
        };

        const handleAssignPlan = (user: User, plan: SubscriptionPlan) => {
            setAssigningUser(user);
            setAssigningPlan(plan);
            setShowPlanAssignmentModal(true);
        };

        return (
            <div className="space-y-8">
                <AdminPageIntro
                    eyebrow="Commerce"
                    title="Plan management"
                    description="Monitor seller distribution by tier, edit plan definitions, and assign subscriptions."
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <AdminStatTile
                        accent="violet"
                        title="Free sellers"
                        value={planStats.free}
                        icon={<span className="text-xl">🆓</span>}
                        onClick={() => setPlanFilter('free')}
                    />
                    <AdminStatTile
                        accent="sky"
                        title="Basic sellers"
                        value={planStats.basic}
                        icon={<span className="text-xl">📋</span>}
                        onClick={() => setPlanFilter('basic')}
                    />
                    <AdminStatTile
                        accent="emerald"
                        title="Pro sellers"
                        value={planStats.pro}
                        icon={<span className="text-xl">⭐</span>}
                        onClick={() => setPlanFilter('pro')}
                    />
                    <AdminStatTile
                        accent="amber"
                        title="Premium sellers"
                        value={planStats.premium}
                        icon={<span className="text-xl">👑</span>}
                        onClick={() => setPlanFilter('premium')}
                    />
                    <AdminStatTile
                        accent="violet"
                        title="Total sellers"
                        value={users.filter((u) => u.role === 'seller').length}
                        icon={<span className="text-xl">👥</span>}
                        onClick={() => setPlanFilter('all')}
                    />
                </div>

                <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-8">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Plan configuration</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {(plans || []).length}/4 plans configured
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={async () => {
                                    const allPlans = await planService.getAllPlans();
                                    setPlans(allPlans);
                                    alert('Plans refreshed successfully!');
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                            >
                                Refresh
                            </button>
                            <button
                                type="button"
                                onClick={handleAddNewPlan}
                                disabled={(plans || []).length >= 4}
                                className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
                                    (plans || []).length < 4
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600'
                                        : 'cursor-not-allowed bg-slate-200 text-slate-500'
                                }`}
                            >
                                {(plans || []).length < 4 ? '+ Add new plan' : 'Max plans reached'}
                            </button>
                        </div>
                    </div>

                    <div
                        className={`grid gap-6 ${(plans || []).length <= 2 ? 'grid-cols-1 md:grid-cols-2' : (plans || []).length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}
                    >
                        {(plans || []).map(plan => (
                            <PlanCard key={plan.id} plan={plan} />
                        ))}
                    </div>
                </section>

                <AdminDataTableFrame
                    title="Seller directory"
                    subtitle={planFilter !== 'all' ? `Filtered: ${planFilter}` : 'All subscription tiers'}
                    actions={
                        <select
                            value={planFilter}
                            onChange={(e) => setPlanFilter(e.target.value as SubscriptionPlan)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                        >
                            <option value="all">All plans</option>
                            <option value="free">Free</option>
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="premium">Premium</option>
                        </select>
                    }
                >
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead>
                            <tr>
                                <th className={`${adminTableHeadClass} px-4 py-3`}>User</th>
                                <th className={`${adminTableHeadClass} px-4 py-3`}>Current plan</th>
                                <th className={`${adminTableHeadClass} px-4 py-3`}>Usage</th>
                                <th className={`${adminTableHeadClass} px-4 py-3`}>Featured credits</th>
                                <th className={`${adminTableHeadClass} px-4 py-3`}>Actions</th>
                                <th className={`${adminTableHeadClass} px-4 py-3`}>Activated</th>
                                <th className={`${adminTableHeadClass} px-4 py-3`}>Expiry</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredUsers.map(user => {
                                    const currentPlan = user.subscriptionPlan || 'free';
                                    return <UserRow key={user.email} user={user} currentPlan={currentPlan} />;
                                })}
                            </tbody>
                       </table>
                   </AdminDataTableFrame>

                {/* Plan Edit Modal */}
                {showPlanModal && editingPlan && (
                    <PlanEditModal 
                        plan={editingPlan}
                        onClose={() => {
                            setShowPlanModal(false);
                            setEditingPlan(null);
                        }}
                        onSave={handleSavePlan}
                    />
                )}

                {/* Add New Plan Modal */}
                {showAddPlanModal && (
                    <AddNewPlanModal 
                        onClose={() => setShowAddPlanModal(false)}
                        onCreate={handleCreatePlan}
                    />
                )}

                {/* Expiry Date Edit Modal */}
                {showExpiryEditModal && editingExpiryUser && (
                    <ExpiryDateEditModal
                        user={editingExpiryUser}
                        currentPlan={editingExpiryUser.subscriptionPlan || 'free'}
                        onClose={() => {
                            setShowExpiryEditModal(false);
                            setEditingExpiryUser(null);
                        }}
                        onSave={async (expiryDate: string | null) => {
                            try {
                                // Prepare update data
                                const updateData: Partial<User> = {};
                                
                                // Handle expiry date update
                                if (expiryDate !== null && expiryDate !== '') {
                                    // Ensure date is in ISO string format
                                    const dateObj = new Date(expiryDate);
                                    if (isNaN(dateObj.getTime())) {
                                        throw new Error('Invalid date format');
                                    }
                                    updateData.planExpiryDate = dateObj.toISOString();
                                } else {
                                    // Remove expiry date
                                    updateData.planExpiryDate = undefined;
                                }
                                
                                console.log('Updating user expiry date:', {
                                    email: editingExpiryUser.email,
                                    planExpiryDate: updateData.planExpiryDate
                                });
                                
                                // Update via onAdminUpdateUser which updates both local state and Supabase
                                await onAdminUpdateUser(editingExpiryUser.email, updateData);
                                
                                // Close modal
                                setShowExpiryEditModal(false);
                                setEditingExpiryUser(null);
                                
                                // Show success message
                                const successMsg = expiryDate 
                                    ? `Expiry date set to ${new Date(expiryDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}`
                                    : 'Expiry date removed successfully';
                                
                                console.log('✅', successMsg);
                                
                            } catch (error: any) {
                                console.error('Failed to update expiry date:', error);
                                const errorMessage = error?.message || error?.toString() || 'Unknown error';
                                
                                // Show error notification
                                const errorNotification = document.createElement('div');
                                errorNotification.textContent = `Failed to update expiry date: ${errorMessage}`;
                                errorNotification.className = 'fixed top-5 right-5 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] text-sm font-medium animate-slide-up';
                                document.body?.appendChild(errorNotification);
                                
                                setTimeout(() => {
                                    errorNotification.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                                    errorNotification.style.opacity = '0';
                                    errorNotification.style.transform = 'translateX(100%)';
                                    setTimeout(() => {
                                        if (errorNotification.parentNode) {
                                            errorNotification.parentNode.removeChild(errorNotification);
                                        }
                                    }, 300);
                                }, 4000);
                            }
                        }}
                    />
                )}

                {/* Plan Assignment Modal */}
                {showPlanAssignmentModal && assigningUser && assigningPlan && (
                    <PlanAssignmentModal
                        user={assigningUser}
                        plan={assigningPlan}
                        onClose={() => {
                            setShowPlanAssignmentModal(false);
                            setAssigningUser(null);
                            setAssigningPlan(null);
                        }}
                        onAssign={async (activatedDate: string, expiryDate: string | null) => {
                            try {
                                // Update plan
                                onUpdateUserPlan(assigningUser.email, assigningPlan);
                                
                                // Update user with dates via API
                                const { updateUser } = await import('../services/userService');
                                await updateUser({
                                    email: assigningUser.email,
                                    subscriptionPlan: assigningPlan,
                                    planActivatedDate: activatedDate,
                                    planExpiryDate: expiryDate || undefined
                                });
                                
                                setShowPlanAssignmentModal(false);
                                setAssigningUser(null);
                                setAssigningPlan(null);
                                
                                // Show success message
                                alert(`Plan "${assigningPlan}" assigned successfully with dates.`);
                                
                                // Refresh users list - this would typically trigger a reload
                                window.location.reload();
                            } catch (error) {
                                console.error('Failed to assign plan with dates:', error);
                                alert('Failed to save plan dates. Plan was assigned but dates may not be saved.');
                            }
                        }}
                    />
                )}
            </div>
        );
    };

    // Plan Assignment Modal Component
    const PlanAssignmentModal: React.FC<{
        user: User;
        plan: SubscriptionPlan;
        onClose: () => void;
        onAssign: (activatedDate: string, expiryDate: string | null) => void;
    }> = ({ user, plan, onClose, onAssign }) => {
        const today = new Date().toISOString().split('T')[0];
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 30); // Default 30 days
        const defaultExpiryDate = defaultExpiry.toISOString().split('T')[0];
        
        const [activationDate, setActivationDate] = useState(today);
        const [expiryDate, setExpiryDate] = useState<string>(plan === 'free' ? '' : defaultExpiryDate);
        const [useCustomExpiry, setUseCustomExpiry] = useState(plan !== 'free');

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const activated = new Date(activationDate).toISOString();
            const expiry = expiryDate ? new Date(expiryDate).toISOString() : null;
            onAssign(activated, expiry);
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <form onSubmit={handleSubmit}>
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold text-gray-900">Assign Plan</h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600 text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-2">
                                    Assigning <span className="font-semibold capitalize">{plan}</span> plan to:
                                </p>
                                <p className="font-medium text-gray-900">{user.name} ({user.email})</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="activation-date" className="block text-sm font-medium text-gray-700 mb-2">
                                        Plan Activation Date
                                    </label>
                                    <input
                                        type="date"
                                        id="activation-date"
                                        value={activationDate}
                                        onChange={(e) => {
                                            setActivationDate(e.target.value);
                                            // Update expiry date min if activation date is after current expiry date
                                            if (expiryDate && e.target.value > expiryDate) {
                                                const newExpiry = new Date(e.target.value);
                                                newExpiry.setDate(newExpiry.getDate() + 30);
                                                setExpiryDate(newExpiry.toISOString().split('T')[0]);
                                            }
                                        }}
                                        max={today}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-reride-orange"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Select when the plan was/will be activated</p>
                                </div>

                                <div>
                                    <label className="flex items-center mb-2">
                                        <input
                                            type="checkbox"
                                            checked={useCustomExpiry}
                                            onChange={(e) => {
                                                setUseCustomExpiry(e.target.checked);
                                                if (!e.target.checked) {
                                                    setExpiryDate('');
                                                } else if (!expiryDate) {
                                                    setExpiryDate(defaultExpiryDate);
                                                }
                                            }}
                                            className="mr-2"
                                        />
                                        <span className="text-sm font-medium text-gray-700">
                                            Set Expiry Date {plan === 'free' && '(Optional)'}
                                        </span>
                                    </label>
                                    {useCustomExpiry && (
                                        <input
                                            type="date"
                                            id="expiry-date"
                                            value={expiryDate}
                                            onChange={(e) => setExpiryDate(e.target.value)}
                                            min={activationDate}
                                            required={useCustomExpiry && plan !== 'free'}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-reride-orange"
                                        />
                                    )}
                                    {plan === 'free' && (
                                        <p className="text-xs text-gray-500 mt-1">Free plans typically don't expire</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-reride-orange text-white rounded-md hover:bg-orange-600 transition-colors"
                                >
                                    Assign Plan
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // Expiry Date Edit Modal Component
    const ExpiryDateEditModal: React.FC<{
        user: User;
        currentPlan: SubscriptionPlan;
        onClose: () => void;
        onSave: (expiryDate: string | null) => void;
    }> = ({ user, currentPlan, onClose, onSave }) => {
        const today = new Date().toISOString().split('T')[0];
        const currentExpiry = user.planExpiryDate ? new Date(user.planExpiryDate).toISOString().split('T')[0] : '';
        
        const [expiryDate, setExpiryDate] = useState<string>(currentExpiry);
        const [useCustomExpiry, setUseCustomExpiry] = useState<boolean>(!!user.planExpiryDate && currentPlan !== 'free');
        const [removeExpiry, setRemoveExpiry] = useState<boolean>(false);

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (removeExpiry || (currentPlan === 'free' && !useCustomExpiry)) {
                onSave(null);
            } else if (useCustomExpiry && expiryDate) {
                onSave(new Date(expiryDate).toISOString());
            } else {
                alert('Please select an expiry date or choose to remove expiry.');
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <form onSubmit={handleSubmit}>
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold text-gray-900">Edit Expiry Date</h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600 text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-2">
                                    Editing expiry date for:
                                </p>
                                <p className="font-medium text-gray-900">{user.name} ({user.email})</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Current Plan: <span className="font-semibold capitalize">{currentPlan}</span>
                                </p>
                                {user.planActivatedDate && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Plan Activated: {new Date(user.planActivatedDate).toLocaleDateString('en-IN', { 
                                            year: 'numeric', 
                                            month: 'short', 
                                            day: 'numeric' 
                                        })}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-4">
                                {currentPlan === 'free' && (
                                    <div className="bg-gray-50 p-3 rounded-md">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={removeExpiry || !useCustomExpiry}
                                                onChange={(e) => {
                                                    setRemoveExpiry(e.target.checked);
                                                    setUseCustomExpiry(!e.target.checked);
                                                }}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-gray-700">Remove expiry (No expiry for free plans)</span>
                                        </label>
                                    </div>
                                )}

                                {!removeExpiry && (
                                    <div>
                                        <label className="flex items-center mb-2">
                                            <input
                                                type="checkbox"
                                                checked={useCustomExpiry}
                                                onChange={(e) => {
                                                    setUseCustomExpiry(e.target.checked);
                                                    if (!e.target.checked && currentPlan === 'free') {
                                                        setRemoveExpiry(true);
                                                    }
                                                }}
                                                className="mr-2"
                                            />
                                            <span className="text-sm font-medium text-gray-700">
                                                Set Expiry Date {currentPlan === 'free' && '(Optional)'}
                                            </span>
                                        </label>
                                        {useCustomExpiry && (
                                            <>
                                                <input
                                                    type="date"
                                                    id="expiry-date-edit"
                                                    value={expiryDate}
                                                    onChange={(e) => setExpiryDate(e.target.value)}
                                                    min={user.planActivatedDate ? new Date(user.planActivatedDate).toISOString().split('T')[0] : today}
                                                    required={useCustomExpiry && currentPlan !== 'free'}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-reride-orange mt-2"
                                                />
                                                {user.planActivatedDate && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Must be after activation date: {new Date(user.planActivatedDate).toLocaleDateString('en-IN', { 
                                                            year: 'numeric', 
                                                            month: 'short', 
                                                            day: 'numeric' 
                                                        })}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {user.planExpiryDate && !removeExpiry && (
                                    <div className="bg-blue-50 p-3 rounded-md">
                                        <p className="text-sm text-gray-700">
                                            <strong>Current Expiry:</strong> {new Date(user.planExpiryDate).toLocaleDateString('en-IN', { 
                                                year: 'numeric', 
                                                month: 'short', 
                                                day: 'numeric' 
                                            })}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-reride-orange text-white rounded-md hover:bg-orange-600 transition-colors"
                                >
                                    Save Expiry Date
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const NavItemButton: React.FC<{ view: AdminView; label: string; count?: number }> = ({ view, label, count }) => (
        <button
            type="button"
            onClick={() => setActiveView(view)}
            className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeView === view
                    ? 'bg-violet-600 font-medium text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
            }`}
        >
            <span className="min-w-0 flex-1 leading-snug">{label}</span>
            {count !== undefined && count > 0 && (
                <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        activeView === view ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
                    }`}
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    );

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-orange-200/15 to-pink-200/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
            </div>
            
            <div className="relative z-10 flex min-h-screen min-w-0 w-full flex-col lg:flex-row">
                {/* Mobile / small tablet: jump menu grouped like the sidebar */}
                <div className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 px-3 py-2.5 backdrop-blur-md lg:hidden">
                    <label htmlFor="admin-panel-view" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Admin workspace
                    </label>
                    <select
                        id="admin-panel-view"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                        value={activeView}
                        onChange={(e) => setActiveView(e.target.value as AdminView)}
                    >
                        {adminNavGroups.map((group) => (
                            <optgroup key={group.id} label={group.label}>
                                {group.items.map((item) => (
                                    <option key={item.view} value={item.view}>
                                        {item.label}
                                        {item.count !== undefined && item.count > 0 ? ` (${item.count > 99 ? '99+' : item.count})` : ''}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                <aside
                    className={`hidden shrink-0 flex-col border-r border-slate-200/80 bg-white/90 shadow-xl backdrop-blur-xl transition-[width] duration-200 ease-out lg:flex ${
                        sidebarCollapsed ? 'w-[4.5rem]' : 'w-72'
                    }`}
                >
                    <div
                        className={`flex max-h-screen min-h-0 flex-1 flex-col ${
                            sidebarCollapsed ? 'items-center p-2' : 'p-5'
                        }`}
                    >
                        {sidebarCollapsed ? (
                            <div className="mb-2 flex w-full shrink-0 flex-col items-center gap-2">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700">
                                    <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                        <path
                                            fillRule="evenodd"
                                            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleSidebarCollapsed}
                                    className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-violet-700"
                                    title="Expand sidebar"
                                    aria-label="Expand sidebar"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="mb-5 shrink-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700">
                                            <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                                <path
                                                    fillRule="evenodd"
                                                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <h1 className="text-lg font-bold tracking-tight text-slate-900">Admin</h1>
                                            <p className="text-xs text-slate-500">ReRide operations</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleSidebarCollapsed}
                                        className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-violet-700"
                                        title="Minimize sidebar"
                                        aria-label="Minimize sidebar"
                                    >
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {sidebarCollapsed ? (
                            <nav
                                className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300"
                                aria-label="Admin navigation"
                            >
                                {adminNavGroups.map((group, gi) => (
                                    <React.Fragment key={group.id}>
                                        {gi > 0 && <div className="mx-auto my-1 h-px w-8 bg-slate-200" aria-hidden />}
                                        {group.items.map((item) => {
                                            const count = 'count' in item ? item.count : undefined;
                                            const c = count !== undefined && count > 0 ? `${item.label} (${count > 99 ? '99+' : count})` : item.label;
                                            return (
                                                <button
                                                    key={item.view}
                                                    type="button"
                                                    onClick={() => setActiveView(item.view)}
                                                    title={c}
                                                    aria-label={item.label}
                                                    aria-current={activeView === item.view ? 'page' : undefined}
                                                    className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                                        activeView === item.view
                                                            ? 'bg-violet-600 text-white shadow-sm'
                                                            : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <AdminViewNavIcon view={item.view} className="h-5 w-5" />
                                                    {count !== undefined && count > 0 && (
                                                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white tabular-nums">
                                                            {count > 99 ? '99+' : count}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </nav>
                        ) : (
                            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                                {adminNavGroups.map((group) => (
                                    <div key={group.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                                        <div className="mb-1 px-1 py-1.5">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                {group.label}
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {group.items.map((item) => (
                                                <NavItemButton
                                                    key={item.view}
                                                    view={item.view}
                                                    label={item.label}
                                                    count={'count' in item ? item.count : undefined}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </nav>
                        )}

                        {sidebarCollapsed ? (
                            <div className="mt-auto flex shrink-0 flex-col items-center gap-2 border-t border-slate-200 pt-3 dark:border-gray-700">
                                <div
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white"
                                    title={`${currentUser.name ?? 'Admin'} — ${currentUser.email ?? ''}`}
                                >
                                    {currentUser.name?.charAt(0)?.toUpperCase() || 'A'}
                                </div>
                                {onLogout && (
                                    <button
                                        type="button"
                                        onClick={onLogout}
                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                                        title="Log out"
                                        aria-label="Log out"
                                    >
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                            />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="mt-4 shrink-0 border-t border-slate-200 pt-4 dark:border-gray-700">
                                <div className="mb-4 flex items-center space-x-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500">
                                        <span className="text-sm font-bold text-white">
                                            {currentUser.name?.charAt(0)?.toUpperCase() || 'A'}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{currentUser.name}</p>
                                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                                    </div>
                                </div>
                                {onLogout && (
                                    <button
                                        type="button"
                                        onClick={onLogout}
                                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        Log Out
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </aside>
                <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
                    <div className="min-h-[min(600px,80vh)] overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/50 p-4 shadow-[0_24px_60px_-28px_rgba(49,46,129,0.2)] ring-1 ring-slate-900/[0.04] sm:rounded-3xl sm:p-6 lg:p-8">
                        {/* Configuration Error Banner */}
                        {configError && (
                            <div className="mb-6 rounded-2xl border border-red-200/80 bg-red-50/95 p-4 shadow-sm ring-1 ring-red-900/[0.06]">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3 flex-1">
                                    <h3 className="text-sm font-medium text-red-800 mb-2">
                                        Configuration Error: Cannot Fetch Data from Supabase
                                    </h3>
                                    <p className="text-sm text-red-700 mb-2">
                                        {configError.reason}
                                    </p>
                                    {configError.diagnostic && (
                                        <p className="text-xs text-red-600 mb-3">
                                            {configError.diagnostic}
                                        </p>
                                    )}
                                    <div className="text-xs text-red-600 space-y-1">
                                        <p className="font-semibold">To fix this issue:</p>
                                        <ol className="list-decimal list-inside space-y-1 ml-2">
                                            <li>Go to <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">Vercel Dashboard</a> → Your Project → Settings → Environment Variables</li>
                                            <li>Add <code className="bg-red-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> for <strong>Production</strong> environment</li>
                                            <li>Get the key from <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" className="underline">Supabase Dashboard</a> → Settings → API → service_role key</li>
                                            <li><strong>Redeploy your application</strong> after setting the variable (environment variables only take effect after redeploy)</li>
                                        </ol>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setConfigError(null);
                                            if (typeof window !== 'undefined') {
                                                localStorage.removeItem('reRideUsers_error');
                                            }
                                            hasFetchedUsersRef.current = false;
                                            window.location.reload();
                                        }}
                                        className="mt-3 text-sm text-red-700 hover:text-red-900 underline"
                                    >
                                        Dismiss and Retry
                                    </button>
                                </div>
                            </div>
                        </div>
                        )}
                        <AdminContentFrame>{renderContent()}</AdminContentFrame>
                    </div>
                </main>
            </div>

            {editingUser && (
                <EditUserModal 
                    user={editingUser} 
                    onClose={() => setEditingUser(null)} 
                    onSave={(email, details) => handleSaveUser(email, details)}
                    onVerifyDocument={async (email, documentType, verified) => {
                        try {
                            const user = users.find(u => u.email === email);
                            if (!user) return;

                            const updateData: any = {};
                            if (documentType === 'aadharCard') {
                                updateData.aadharCard = {
                                    ...user.aadharCard,
                                    isVerified: verified,
                                    verifiedAt: verified ? new Date().toISOString() : '',
                                    verifiedBy: verified ? currentUser?.email || 'admin' : '',
                                };
                            } else if (documentType === 'panCard') {
                                updateData.panCard = {
                                    ...user.panCard,
                                    isVerified: verified,
                                    verifiedAt: verified ? new Date().toISOString() : '',
                                    verifiedBy: verified ? currentUser?.email || 'admin' : '',
                                };
                            }

                            await onAdminUpdateUser(email, updateData);
                            
                            // Update local state
                            setEditingUser({
                                ...editingUser,
                                ...updateData
                            });
                        } catch (error) {
                            console.error('Failed to verify document:', error);
                        }
                    }}
                />
            )}
            {editingVehicle && <EditVehicleModal vehicle={editingVehicle} onClose={() => setEditingVehicle(null)} onSave={handleSaveVehicle} />}
            
            {/* Seller Form Preview Modal */}
            {showPreviewModal && (
                <SellerFormPreview 
                    vehicleData={vehicleData} 
                    onClose={() => setShowPreviewModal(false)} 
                />
            )}
            
            {/* Bulk Upload Modal */}
            {isBulkUploadOpen && (
                <VehicleDataBulkUploadModal 
                    onClose={() => setIsBulkUploadOpen(false)} 
                    onUpdateData={onUpdateVehicleData}
                />
            )}
            
            {/* Import Vehicles Modal */}
            {showImportModal && onImportVehicles && (
                <ImportVehiclesModal 
                    onClose={() => setShowImportModal(false)} 
                    onImportVehicles={onImportVehicles}
                />
            )}
            
            {/* Import Users Modal */}
            {showImportUsersModal && onImportUsers && (
                <ImportUsersModal 
                    onClose={() => setShowImportUsersModal(false)} 
                    onImportUsers={onImportUsers}
                />
            )}
        </div>
    );
};

export default AdminPanel;

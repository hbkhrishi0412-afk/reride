
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
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-left min-w-[200px] flex justify-between items-center hover:bg-gray-50"
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

type AdminView = 'analytics' | 'users' | 'listings' | 'moderation' | 'certificationRequests' | 'vehicleData' | 'sellCarAdmin' | 'auditLog' | 'settings' | 'support' | 'faq' | 'payments' | 'planManagement';
type RoleFilter = 'all' | 'customer' | 'seller' | 'admin';
// FIX: Restrict sortable keys to prevent comparison errors on incompatible types.
type SortableUserKey = 'name' | 'status';
type SortConfig = {
    key: SortableUserKey;
    direction: 'ascending' | 'descending';
};

// --- Sub-components ---

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode, onClick?: () => void }> = ({ title, value, icon, onClick }) => (
  <div className={`bg-white p-6 rounded-lg shadow-md flex items-center ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-transform' : ''}`} onClick={onClick}>
    <div className="p-3 rounded-full mr-4" style={{ background: 'rgba(30, 136, 229, 0.1)' }}>{icon}</div>
    <div>
      <h3 className="text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark">{title}</h3>
      <p className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark">{value}</p>
    </div>
  </div>
);

const TableContainer: React.FC<{ title: string; children: React.ReactNode; actions?: React.ReactNode }> = ({ title, children, actions }) => (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h2 className="text-xl font-bold text-spinny-text-dark dark:text-spinny-text-dark">{title}</h2>
            {actions && <div className="w-full sm:w-auto">{actions}</div>}
        </div>
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
            <div className="inline-block min-w-full align-middle">
                {children}
            </div>
        </div>
    </div>
);

const SortableHeader: React.FC<{
    title: string;
    sortKey: SortableUserKey;
    sortConfig: SortConfig | null;
    requestSort: (key: SortableUserKey) => void;
}> = ({ title, sortKey, sortConfig, requestSort }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = isSorted ? sortConfig.direction : undefined;

    return (
        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1.5 group hover:text-gray-900">
                <span className="group-hover:text-gray-900">{title}</span>
                <span className="text-gray-500 text-xs">
                    {isSorted ? (direction === 'ascending' ? '▲' : '▼') : '↕'}
                </span>
            </button>
        </th>
    );
};

const BarChart: React.FC<{ title: string; data: { label: string; value: number }[] }> = ({ title, data }) => {
    const maxValue = Math.max(...(data || []).map(d => d.value), 1);
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-4">{title}</h3>
            <div className="space-y-4">
                {(data || []).map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-[100px_1fr] items-center gap-4 text-sm">
                        <span className="font-medium text-spinny-text-dark dark:text-spinny-text-dark truncate text-right">{label}</span>
                        <div className="flex items-center gap-2">
                            <div className="w-full bg-white-dark dark:bg-white rounded-full h-5">
                                <div
                                    className="h-5 rounded-full text-white text-xs flex items-center justify-end pr-2"
                                    style={{ width: `${(value / maxValue) * 100}%`, background: 'var(--gradient-warm)' }}
                                >
                                    {value}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
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
                    {!sellerInfo.hasFreeCredits && <div className="text-xs text-spinny-text-dark">No free credits left</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button onClick={() => onCertificationApproval(vehicle.id, 'approved')} className="text-spinny-orange hover:text-spinny-orange">Approve</button>
                    <button onClick={() => onCertificationApproval(vehicle.id, 'rejected')} className="text-spinny-orange hover:text-spinny-orange">Reject</button>
                </td>
            </tr>
        );
    };

    return (
        <TableContainer title={`Pending Certification Requests (${requests.length})`}>
            {requests.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-white dark:bg-white">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Vehicle</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Seller</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Plan Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                        {requests.map(vehicle => (
                            <CertificationRequestRow key={vehicle.id} vehicle={vehicle} />
                        ))}
                    </tbody>
                </table>
            ) : <p className="text-center py-8 text-spinny-text-dark dark:text-spinny-text-dark">No pending certification requests.</p>}
        </TableContainer>
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
      placeholder="Search logs..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="flex-grow p-2 border border-gray-200 dark:border-gray-200-300 rounded-lg bg-white dark:text-spinny-text-dark focus:outline-none transition w-full sm:w-64" onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--spinny-orange)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
    />
  );

  return (
    <TableContainer title="Audit Log" actions={searchAction}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-white dark:bg-white text-spinny-text-dark dark:text-spinny-text-dark">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Timestamp</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Actor</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Action</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Target</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Details</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
          {filteredLog.map(entry => (
            <tr key={entry.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-spinny-text-dark dark:text-spinny-text-dark">{new Date(entry.timestamp).toLocaleString()}</td>
              <td className="px-6 py-4 whitespace-nowrap font-medium">{entry.actor}</td>
              <td className="px-6 py-4 whitespace-nowrap">{entry.action}</td>
              <td className="px-6 py-4 whitespace-nowrap">{entry.target}</td>
              <td className="px-6 py-4 text-sm text-spinny-text-dark dark:text-spinny-text-dark truncate max-w-xs" title={entry.details}>{entry.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredLog.length === 0 && <p className="text-center py-8 text-spinny-text-dark dark:text-spinny-text-dark">No log entries found matching your search.</p>}
    </TableContainer>
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
                        <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-white">Create New Plan</h2>
                        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">
                                    Plan Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.name 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
                                    }`}
                                    placeholder="Enter plan name"
                                />
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">
                                    Price (₹/month) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    min="0"
                                    step="1"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.price 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
                                    }`}
                                    placeholder="0"
                                />
                                {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Listing Limit</label>
                                <input
                                    type="number"
                                    name="listingLimit"
                                    value={formData.listingLimit === 'unlimited' ? '' : formData.listingLimit}
                                    onChange={handleChange}
                                    min="1"
                                    placeholder="Leave empty for unlimited"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.listingLimit 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
                                    }`}
                                />
                                {errors.listingLimit && <p className="mt-1 text-sm text-red-500">{errors.listingLimit}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Featured Credits</label>
                                <input
                                    type="number"
                                    name="featuredCredits"
                                    value={formData.featuredCredits}
                                    onChange={handleChange}
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.featuredCredits 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
                                    }`}
                                />
                                {errors.featuredCredits && <p className="mt-1 text-sm text-red-500">{errors.featuredCredits}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Free Certifications</label>
                                <input
                                    type="number"
                                    name="freeCertifications"
                                    value={formData.freeCertifications}
                                    onChange={handleChange}
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.freeCertifications 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
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
                                    className="w-4 h-4 text-spinny-orange bg-gray-100 border-gray-300 rounded focus:ring-spinny-orange"
                                />
                                <label className="text-sm font-medium text-spinny-text-dark dark:text-white">
                                    Mark as Most Popular
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Features</label>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={newFeature}
                                    onChange={(e) => setNewFeature(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                                    placeholder="Add new feature..."
                                    className="flex-grow px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-spinny-orange"
                                />
                                <button type="button" onClick={handleAddFeature} className="px-4 py-2 bg-spinny-orange text-white rounded-lg hover:bg-spinny-orange/90">
                                    Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.features.map((feature, index) => (
                                    <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        <span className="text-spinny-text-dark dark:text-white">{feature}</span>
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
                                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-spinny-text-dark dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isCreating || Object.keys(errors).length > 0}
                                    className="px-6 py-2 bg-spinny-orange text-white rounded-lg hover:bg-spinny-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                        <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-white">Edit Plan</h2>
                        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">
                                    Plan Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.name 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
                                    }`}
                                    placeholder="Enter plan name"
                                />
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">
                                    Price (₹/month) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    min="0"
                                    step="1"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.price 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
                                    }`}
                                    placeholder="0"
                                />
                                {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Listing Limit</label>
                                <input
                                    type="number"
                                    name="listingLimit"
                                    value={formData.listingLimit === 'unlimited' ? '' : formData.listingLimit}
                                    onChange={handleChange}
                                    min="0"
                                    placeholder="Leave empty for unlimited"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.listingLimit 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
                                    }`}
                                />
                                {errors.listingLimit && <p className="mt-1 text-sm text-red-500">{errors.listingLimit}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Featured Credits</label>
                                <input
                                    type="number"
                                    name="featuredCredits"
                                    value={formData.featuredCredits}
                                    onChange={handleChange}
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.featuredCredits 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
                                    }`}
                                />
                                {errors.featuredCredits && <p className="mt-1 text-sm text-red-500">{errors.featuredCredits}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Free Certifications</label>
                                <input
                                    type="number"
                                    name="freeCertifications"
                                    value={formData.freeCertifications}
                                    onChange={handleChange}
                                    min="0"
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                        errors.freeCertifications 
                                            ? 'border-red-500 focus:ring-red-500' 
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-spinny-orange'
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
                                    className="w-4 h-4 text-spinny-orange bg-gray-100 border-gray-300 rounded focus:ring-spinny-orange"
                                />
                                <label className="text-sm font-medium text-spinny-text-dark dark:text-white">
                                    Mark as Most Popular
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Features</label>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={newFeature}
                                    onChange={(e) => setNewFeature(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                                    placeholder="Add new feature..."
                                    className="flex-grow px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-spinny-orange"
                                />
                                <button type="button" onClick={handleAddFeature} className="px-4 py-2 bg-spinny-orange text-white rounded-lg hover:bg-spinny-orange/90">
                                    Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.features.map((feature, index) => (
                                    <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        <span className="text-spinny-text-dark dark:text-white">{feature}</span>
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
                                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-spinny-text-dark dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving || Object.keys(errors).length > 0}
                                    className="px-6 py-2 bg-spinny-orange text-white rounded-lg hover:bg-spinny-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
        users, currentUser, vehicles, conversations, onToggleUserStatus, onDeleteUser,
        onAdminUpdateUser, onUpdateUserPlan, onUpdateVehicle, onDeleteVehicle, onToggleVehicleStatus,
        onToggleVehicleFeature,
        onResolveFlag, platformSettings, onUpdateSettings, onSendBroadcast,
        auditLog, onExportUsers, onImportUsers, onExportVehicles, onImportVehicles, onNavigate, onLogout, vehicleData, onUpdateVehicleData,
        supportTickets, onUpdateSupportTicket, faqItems, onAddFaq, onUpdateFaq, onDeleteFaq,
        onCertificationApproval
    } = props;
    const [activeView, setActiveView] = useState<AdminView>('analytics');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [selectedSeller, setSelectedSeller] = useState<string>('all');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    
    // Modal states
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    
    // Loading states for actions
    const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
    const [showImportModal, setShowImportModal] = useState(false);
    const [showImportUsersModal, setShowImportUsersModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
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
    
    // Refresh data from database
    const handleRefreshData = async () => {
        setIsRefreshing(true);
        try {
            const { dataService } = await import('../services/dataService');
            const [vehiclesData, usersData] = await Promise.all([
                dataService.getVehicles(true), // Pass true to get all vehicles including unpublished/sold
                dataService.getUsers()
            ]);
            
            // Update localStorage cache to trigger refresh in AppProvider
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                localStorage.setItem('reRideVehicles', JSON.stringify(vehiclesData));
                localStorage.setItem('reRideUsers', JSON.stringify(usersData));
                // Trigger storage event to notify other components
                window.dispatchEvent(new Event('storage'));
            }
            
            // Force page reload to ensure all components get updated data
            // This is the most reliable way to ensure sync
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (error) {
            console.error('Failed to refresh data:', error);
            alert('Failed to refresh data. Please try again.');
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

    const handleSaveUser = (email: string, details: Partial<User>) => {
        onAdminUpdateUser(email, details);
        setEditingUser(null);
    };

    const handleSaveVehicle = (updatedVehicle: Vehicle) => {
        onUpdateVehicle(updatedVehicle);
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
        if (!sortConfig) return users;
        
        return [...users].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }, [users, sortConfig]);

    const filteredUsers = useMemo(() => {
        if (roleFilter === 'all') return sortedUsers;
        return sortedUsers.filter(user => user.role === roleFilter);
    }, [sortedUsers, roleFilter]);

    // Pagination logic for vehicles
    const filteredVehicles = useMemo(() => {
        if (selectedSeller === 'all') return vehicles;
        // Normalize emails for comparison (critical for production)
        const normalizedSelectedSeller = selectedSeller ? selectedSeller.toLowerCase().trim() : '';
        return vehicles.filter(vehicle => {
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
    return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Total Users" value={analytics.totalUsers} icon={<span className="text-2xl">👥</span>} />
                            <StatCard title="Total Vehicles" value={analytics.totalVehicles} icon={<span className="text-2xl">🚗</span>} />
                            <StatCard title="Active Listings" value={analytics.activeListings} icon={<span className="text-2xl">📋</span>} />
                            <StatCard title="Total Sales" value={`₹${analytics.totalSales.toLocaleString('en-IN')}`} icon={<span className="text-2xl">💰</span>} />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <BarChart title="Top Vehicle Makes" data={analytics.listingsByMake} />
            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-lg font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-4">Quick Stats</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between">
                                        <span>Flagged Content:</span>
                                        <span className="font-semibold">{analytics.flaggedContent}</span>
                    </div>
                                    <div className="flex justify-between">
                                        <span>Certification Requests:</span>
                                        <span className="font-semibold">{analytics.certificationRequests}</span>
                    </div>
                    </div>
            </div>
            </div>
        </div>
    );
            case 'users':
    return (
                    <div className="space-y-4">
                        {/* Compact Header with Filters and Export */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700 mr-2">Filter:</span>
                                    <button 
                                        onClick={() => setRoleFilter('all')}
                                        className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                                            roleFilter === 'all' 
                                                ? 'bg-blue-500 text-white shadow-sm' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        All ({users.length})
                                    </button>
                                    <button 
                                        onClick={() => setRoleFilter('customer')}
                                        className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                                            roleFilter === 'customer' 
                                                ? 'bg-blue-500 text-white shadow-sm' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Customers ({users.filter(u => u.role === 'customer').length})
                                    </button>
                                    <button 
                                        onClick={() => setRoleFilter('seller')}
                                        className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                                            roleFilter === 'seller' 
                                                ? 'bg-blue-500 text-white shadow-sm' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Sellers ({users.filter(u => u.role === 'seller').length})
                                    </button>
                                    <button 
                                        onClick={() => setRoleFilter('admin')}
                                        className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                                            roleFilter === 'admin' 
                                                ? 'bg-blue-500 text-white shadow-sm' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Admins ({users.filter(u => u.role === 'admin').length})
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleRefreshData();
                                        }} 
                                        disabled={isRefreshing}
                                        className={`px-4 py-1.5 text-sm rounded-md font-medium cursor-pointer transition-colors flex items-center gap-2 ${
                                            isRefreshing 
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                                        }`}
                                        title="Refresh data from database"
                                    >
                                        {isRefreshing ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Refreshing...
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Refresh
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowImportUsersModal(true);
                                        }} 
                                        className="px-4 py-1.5 text-sm rounded-md font-medium cursor-pointer transition-colors bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
                                    >
                                        Import Users
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleActionWithLoading('export-users', onExportUsers);
                                        }} 
                                        disabled={loadingActions.has('export-users')}
                                        className={`px-4 py-1.5 text-sm rounded-md font-medium cursor-pointer transition-colors ${
                                            loadingActions.has('export-users') 
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                                : 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
                                        }`}
                                    >
                                        {loadingActions.has('export-users') ? 'Exporting...' : 'Export Users'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Compact Finance Partner Summary - Only for Seller/All views */}
                        {roleFilter === 'seller' || roleFilter === 'all' ? (() => {
                            const sellers = filteredUsers.filter(u => u.role === 'seller');
                            const sellersWithBanks = sellers.filter(s => s.partnerBanks && s.partnerBanks.length > 0);
                            const totalBanks = sellersWithBanks.reduce((acc, s) => acc + (s.partnerBanks?.length || 0), 0);
                            
                            return (
                                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-4">
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                            </svg>
                                            <h3 className="text-sm font-semibold text-gray-900">Finance Partner Summary</h3>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-600">Total Sellers:</span>
                                                <span className="font-bold text-gray-900">{sellers.length}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-600">With Partners:</span>
                                                <span className="font-bold text-purple-600">{sellersWithBanks.length}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-600">Total Partnerships:</span>
                                                <span className="font-bold text-blue-600">{totalBanks}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })() : null}
                        
                        {/* Compact Table */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                                <h3 className="text-sm font-semibold text-gray-900">
                                    User Management <span className="text-gray-600 font-normal">({filteredUsers.length} users)</span>
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full divide-y divide-gray-200" style={{ minWidth: '800px' }}>
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <SortableHeader title="Name" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} />
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Email</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Mobile</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Role</th>
                                            <SortableHeader title="Status" sortKey="status" sortConfig={sortConfig} requestSort={requestSort} />
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Member Since</th>
                                            {roleFilter === 'seller' || roleFilter === 'all' ? (
                                              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Finance Partners</th>
                                            ) : null}
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Documents</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredUsers.map(user => {
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
                                            <tr key={user.email} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="font-medium text-sm text-gray-900">{user.name}</div>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">{user.email}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">{user.mobile || 'N/A'}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 inline-flex text-xs font-medium rounded-full ${
                                                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                        user.role === 'seller' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
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
                                                {(roleFilter === 'seller' || roleFilter === 'all') && (
                                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {user.role === 'seller' && user.partnerBanks && user.partnerBanks.length > 0 ? (
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
                                                    ) : user.role === 'seller' ? (
                                                      <span className="text-xs text-gray-400">No partners</span>
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
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setEditingUser(user);
                                                            }} 
                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium cursor-pointer transition-colors"
                                                        >
                                                            Edit
                                                        </button>
                                                        <span className="text-gray-300">|</span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                const action = user.status === 'active' ? 'suspend' : 'activate';
                                                                if (window.confirm(`Are you sure you want to ${action} user ${user.email}?`)) {
                                                                    handleActionWithLoading(`toggle-user-${user.email}`, () => onToggleUserStatus(user.email));
                                                                }
                                                            }} 
                                                            disabled={loadingActions.has(`toggle-user-${user.email}`)}
                                                            className={`text-xs font-medium cursor-pointer transition-colors ${
                                                                loadingActions.has(`toggle-user-${user.email}`)
                                                                    ? 'text-gray-400 cursor-not-allowed'
                                                                    : 'text-yellow-600 hover:text-yellow-800'
                                                            }`}
                                                        >
                                                            {loadingActions.has(`toggle-user-${user.email}`) ? '...' : (user.status === 'active' ? 'Suspend' : 'Activate')}
                                                        </button>
                                                        <span className="text-gray-300">|</span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (window.confirm(`Are you sure you want to delete user ${user.email}? This action cannot be undone.`)) {
                                                                    handleActionWithLoading(`delete-user-${user.email}`, () => onDeleteUser(user.email));
                                                                }
                                                            }} 
                                                            disabled={loadingActions.has(`delete-user-${user.email}`)}
                                                            className={`text-xs font-medium cursor-pointer transition-colors ${
                                                                loadingActions.has(`delete-user-${user.email}`)
                                                                    ? 'text-gray-400 cursor-not-allowed'
                                                                    : 'text-red-600 hover:text-red-800'
                                                            }`}
                                                        >
                                                            {loadingActions.has(`delete-user-${user.email}`) ? '...' : 'Delete'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'listings':
                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div className="flex gap-4">
                                <SellerFilterDropdown 
                                    sellers={users.filter(u => u.role === 'seller')}
                                    selectedSeller={selectedSeller}
                                    onSellerChange={setSelectedSeller}
                                />
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                                    className="px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                    <option value={10}>10 per page</option>
                                    <option value={20}>20 per page</option>
                                    <option value={50}>50 per page</option>
                                    <option value={100}>100 per page</option>
                                </select>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowImportModal(true);
                                }} 
                                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                            >
                                Import Vehicles
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleActionWithLoading('export-vehicles', onExportVehicles);
                                }} 
                                disabled={loadingActions.has('export-vehicles')}
                                className={`px-4 py-2 rounded-lg cursor-pointer ${
                                    loadingActions.has('export-vehicles') 
                                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                                        : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                            >
                                {loadingActions.has('export-vehicles') ? 'Exporting...' : 'Export Vehicles'}
                            </button>
                        </div>
                        <TableContainer title={`All Listings (${filteredVehicles.length} total, showing ${paginatedVehicles.length})`}>
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
                                    {paginatedVehicles.map(vehicle => (
                                        <tr key={vehicle.id}>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">{vehicle.sellerEmail}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">₹{vehicle.price.toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    vehicle.status === 'published' ? 'bg-green-100 text-green-800' :
                                                    vehicle.status === 'sold' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {vehicle.status}
                                                </span>
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
                                <div className="flex justify-center items-center gap-2 mt-4">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
            </TableContainer>
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
                return (
                    <div className="p-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sell Car Submissions</h2>
                            <p className="text-gray-600 mb-6">Manage customer car selling requests</p>
                            <button
                                onClick={() => {
                                    if (props.onNavigate) {
                                        props.onNavigate(View.SELL_CAR_ADMIN);
                                    }
                                }}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                Open Sell Car Admin Panel
                            </button>
                        </div>
                    </div>
                );
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
                {/* Filter Tabs */}
                    <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            filter === 'all' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        All ({flaggedVehicles.length + flaggedConversations.length})
                            </button>
                    <button
                        onClick={() => setFilter('vehicles')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            filter === 'vehicles' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Vehicles ({flaggedVehicles.length})
                    </button>
                    <button
                        onClick={() => setFilter('conversations')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            filter === 'conversations' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Conversations ({flaggedConversations.length})
                    </button>
                    </div>

                {/* Content */}
                {getFilteredItems().length === 0 ? (
                    <div className="bg-white p-8 rounded-lg shadow-md text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
                        <p className="text-gray-600">No flagged content requiring moderation.</p>
                                </div>
                ) : (
                    <div className="space-y-4">
                        {/* Flagged Vehicles */}
                        {filter === 'all' || filter === 'vehicles' ? (
                            flaggedVehicles.length > 0 && (
                                <TableContainer title={`Flagged Vehicles (${flaggedVehicles.length})`}>
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
                                                    <td className="px-6 py-4 whitespace-nowrap">₹{vehicle.price.toLocaleString('en-IN')}</td>
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
                                </TableContainer>
                            )
                        ) : null}

                        {/* Flagged Conversations */}
                        {filter === 'all' || filter === 'conversations' ? (
                            flaggedConversations.length > 0 && (
                                <TableContainer title={`Flagged Conversations (${flaggedConversations.length})`}>
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
                                </TableContainer>
                            )
                        ) : null}
                        </div>
                )}
                             </div>
        );
    };

    const PlatformSettingsView = () => (
        <div className="space-y-6">
            <div className="text-center py-8 text-gray-500">
                Platform settings functionality would be implemented here
            </div>
        </div>
    );

    const SupportTicketsView = () => {
        const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'In Progress' | 'Closed'>('All');
        
        const filteredTickets = (supportTickets || []).filter(ticket => 
            statusFilter === 'All' || ticket.status === statusFilter
        );

        const getStatusColor = (status: string) => {
            switch (status) {
                case 'Open':
                    return 'bg-red-100 text-red-800';
                case 'In Progress':
                    return 'bg-yellow-100 text-yellow-800';
                case 'Closed':
                    return 'bg-green-100 text-green-800';
                default:
                    return 'bg-gray-100 text-gray-800';
            }
        };

        return (
            <div className="space-y-6">
                {/* Filter Tabs */}
                <div className="flex gap-2">
                    {(['All', 'Open', 'In Progress', 'Closed'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                statusFilter === status 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            {status} ({status === 'All' ? (supportTickets || []).length : (supportTickets || []).filter(t => t.status === status).length})
                        </button>
                    ))}
                    </div>

                {/* Tickets Table */}
                <TableContainer title={`Support Tickets (${filteredTickets.length})`}>
                    {filteredTickets.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No support tickets found for the selected filter.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-white dark:bg-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Subject</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Priority</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredTickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            #{ticket.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {ticket.userEmail}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={ticket.subject}>
                                            {ticket.subject}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(ticket.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const newStatus = ticket.status === 'Open' ? 'In Progress' : 
                                                                   ticket.status === 'In Progress' ? 'Closed' : 'Open';
                                                    console.log('🔄 Support ticket status change:', ticket.id, 'from', ticket.status, 'to', newStatus);
                                                    onUpdateSupportTicket({ ...ticket, status: newStatus });
                                                }}
                                                className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                            >
                                                {ticket.status === 'Open' ? 'Start Progress' : 
                                                 ticket.status === 'In Progress' ? 'Close' : 'Reopen'}
                                            </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
                    )}
        </TableContainer>
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

        return (
            <div className="space-y-6">
                {/* Header with Add Button */}
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">FAQ Management</h2>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        + Add FAQ
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setCategoryFilter('All')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            categoryFilter === 'All' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        All ({faqItems?.length || 0})
                    </button>
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setCategoryFilter(category)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                categoryFilter === category 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            {category} ({(faqItems || []).filter(f => f.category === category).length})
                        </button>
                    ))}
                </div>

                {/* FAQs Table */}
                <TableContainer title={`FAQs (${filteredFaqs.length})`}>
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
                </TableContainer>

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
                                <div className="h-10 w-10 rounded-full bg-spinny-orange flex items-center justify-center text-white font-bold">
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

            return (
                <div key={plan.id} className={`border rounded-lg p-6 hover:shadow-lg transition-shadow ${
                    isCustom 
                        ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20' 
                        : 'border-gray-200 dark:border-gray-700'
                }`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark">{plan.name}</h3>
                                {isCustom && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                                        CUSTOM
                                    </span>
                                )}
                            </div>
                            <p className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mt-2">
                                ₹{plan.price.toLocaleString()}
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
                            {plan.features.map((feature, index) => (
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
            const stats = sellerUsers.reduce((acc, user) => {
            const plan = user.subscriptionPlan || 'free';
            acc[plan] = (acc[plan] || 0) + 1;
            return acc;
            }, {} as Record<SubscriptionPlan, number>);
            setPlanStats(stats);
        }, [users]);

        const filteredUsers = useMemo(() => {
            // First filter by role - only show sellers
            let sellerUsers = users.filter(user => user.role === 'seller');
            
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
            <div className="space-y-6">
                {/* Plan Statistics - Sellers Only */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard 
                        title="Free Sellers" 
                        value={planStats.free} 
                        icon={<span className="text-2xl">🆓</span>} 
                        onClick={() => setPlanFilter('free')}
                    />
                    <StatCard 
                        title="Pro Sellers" 
                        value={planStats.pro} 
                        icon={<span className="text-2xl">⭐</span>} 
                        onClick={() => setPlanFilter('pro')}
                    />
                    <StatCard 
                        title="Premium Sellers" 
                        value={planStats.premium} 
                        icon={<span className="text-2xl">👑</span>} 
                        onClick={() => setPlanFilter('premium')}
                    />
                    <StatCard 
                        title="Total Sellers" 
                        value={users.filter(u => u.role === 'seller').length} 
                        icon={<span className="text-2xl">👥</span>} 
                        onClick={() => setPlanFilter('all')}
                    />
                </div>

                {/* Plan Configuration */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-spinny-text-dark dark:text-spinny-text-dark">Plan Configuration</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {(plans || []).length}/4 plans configured
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={async () => {
                                    const allPlans = await planService.getAllPlans();
                                    setPlans(allPlans);
                                    alert('Plans refreshed successfully!');
                                }}
                                className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                🔄 Refresh
                            </button>
                            <button 
                                onClick={handleAddNewPlan}
                                disabled={(plans || []).length >= 4}
                                className={`font-bold py-2 px-4 rounded-lg transition-colors ${
                                    (plans || []).length < 4
                                        ? 'bg-spinny-orange text-white hover:bg-spinny-orange/90'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {(plans || []).length < 4 ? '+ Add New Plan' : 'Max Plans Reached'}
                            </button>
                        </div>
                    </div>
                    
                    <div className={`grid gap-6 ${(plans || []).length <= 2 ? 'grid-cols-1 md:grid-cols-2' : (plans || []).length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
                        {(plans || []).map(plan => (
                            <PlanCard key={plan.id} plan={plan} />
                        ))}
                    </div>
                </div>

                {/* User Plan Management - Sellers Only */}
                <TableContainer 
                    title={`Seller Plan Management ${planFilter !== 'all' ? `(${planFilter})` : ''}`}
                    actions={
                        <select 
                            value={planFilter} 
                            onChange={(e) => setPlanFilter(e.target.value as SubscriptionPlan)}
                            className="p-2 border border-gray-200 dark:border-gray-200-300 rounded-lg bg-white dark:text-spinny-text-dark"
                        >
                            <option value="all">All Plans</option>
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="premium">Premium</option>
                    </select>
                    }
                >
                       <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-white dark:bg-white">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Current Plan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Usage</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Featured Credits</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Plan Activated</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Expiry Date</th>
                            </tr>
                        </thead>
                            <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredUsers.map(user => {
                                    const currentPlan = user.subscriptionPlan || 'free';
                                    return <UserRow key={user.email} user={user} currentPlan={currentPlan} />;
                                })}
                            </tbody>
                       </table>
                   </TableContainer>

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
                                    // Remove expiry date by setting to null
                                    updateData.planExpiryDate = null as any;
                                }
                                
                                console.log('Updating user expiry date:', {
                                    email: editingExpiryUser.email,
                                    planExpiryDate: updateData.planExpiryDate
                                });
                                
                                // Update via onAdminUpdateUser which updates both local state and MongoDB
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
                                document.body.appendChild(errorNotification);
                                
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
                                await updateUser(assigningUser.email, {
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-spinny-orange"
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
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-spinny-orange"
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
                                    className="flex-1 px-4 py-2 bg-spinny-orange text-white rounded-md hover:bg-orange-600 transition-colors"
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
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-spinny-orange mt-2"
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
                                    className="flex-1 px-4 py-2 bg-spinny-orange text-white rounded-md hover:bg-orange-600 transition-colors"
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

    const NavItem: React.FC<{ view: AdminView; label: string; count?: number }> = ({ view, label, count }) => (
            <button
                onClick={() => setActiveView(view)}
            className={`group w-full flex items-center justify-between px-4 py-3 text-left rounded-xl transition-all duration-300 ${
                activeView === view
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5'
            }`}
        >
            <span className="font-medium">{label}</span>
            {count !== undefined && count > 0 && (
                <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                    activeView === view 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                }`}>
                    {count}
                </span>
            )}
            </button>
    );

    const AppNavItem: React.FC<{ view: View; label: string; count?: number }> = ({ view, label, count }) => (
        <button
            onClick={() => {
                // Use the navigate function passed from props
                if (props.onNavigate) {
                    props.onNavigate(view);
                } else {
                    // Fallback to event system
                    const event = new CustomEvent('navigate', { detail: { view } });
                    window.dispatchEvent(event);
                }
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
            <span>{label}</span>
            {count !== undefined && count > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                    {count}
                </span>
            )}
        </button>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-orange-200/15 to-pink-200/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
            </div>
            
            <div className="relative z-10 flex">
                <aside className="w-64 bg-white/80 backdrop-blur-xl shadow-xl border-r border-white/20">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">Admin Panel</h1>
                        </div>
                        <nav className="space-y-2">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
                                    </svg>
                                </div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Admin Panel</h3>
                            </div>
                            <NavItem view="analytics" label="Analytics" />
                            <NavItem view="users" label="User Management" />
                            <NavItem view="listings" label="Listings" />
                            <NavItem view="moderation" label="Moderation Queue" count={analytics.flaggedContent} />
                            <NavItem view="certificationRequests" label="Certification Requests" count={analytics.certificationRequests} />
                             <NavItem view="support" label="Support Tickets" count={(supportTickets || []).filter(t => t.status === 'Open').length} />
                            <NavItem view="payments" label="Payment Requests" />
                            <NavItem view="planManagement" label="Plan Management" />
                            <NavItem view="faq" label="FAQ Management" />
                            <NavItem view="vehicleData" label="Vehicle Data" />
                            <NavItem view="sellCarAdmin" label="Sell Car Submissions" />
                            <NavItem view="auditLog" label="Audit Log" />
                            <NavItem view="settings" label="Settings" />
                        </nav>
                        
                        {/* Profile Section */}
                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">
                                        {currentUser.name?.charAt(0)?.toUpperCase() || 'A'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {currentUser.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {currentUser.email}
                                    </p>
                                </div>
                            </div>
                            {onLogout && (
                                <button
                                    onClick={onLogout}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    Log Out
                                </button>
                            )}
                        </div>
                    </div>
                </aside>
                <main className="flex-1 p-8">
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 min-h-[600px]">
                        {renderContent()}
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

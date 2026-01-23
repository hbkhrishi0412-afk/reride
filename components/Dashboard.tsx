import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import type { Vehicle, User, Conversation, VehicleData, ChatMessage, VehicleDocument } from '../types';
import { View, VehicleCategory } from '../types';
import { generateVehicleDescription, getAiVehicleSuggestions } from '../services/geminiService';
import { getSafeImageSrc } from '../utils/imageUtils';
import { formatSalesValue } from '../utils/numberUtils';
import VehicleCard from './VehicleCard';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, LineController, BarController } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import AiAssistant from './AiAssistant';
// FIX: ChatWidget is a named export, not a default. Corrected the import syntax.
import { ChatWidget } from './ChatWidget';
// Removed blocking import - will lazy load location data when needed
import { planService } from '../services/planService';
import BulkUploadModal from './BulkUploadModal';
import { getPlaceholderImage } from './vehicleData';
import PricingGuidance from './PricingGuidance';
// Removed unused OfferModal import
// NEW FEATURES
import BoostListingModal from './BoostListingModal';
import ListingLifecycleIndicator from './ListingLifecycleIndicator';
import PaymentStatusCard from './PaymentStatusCard';
import { authenticatedFetch } from '../utils/authenticatedFetch';
// Firebase status utilities removed - using Supabase

// Safely register Chart.js components - wrap in try-catch to prevent crashes if Chart.js fails to load
try {
  ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, LineController, BarController);
} catch (error) {
  console.error('❌ Failed to register Chart.js components:', error);
  // Don't throw - allow component to render without charts
}


interface DashboardProps {
  seller: User;
  sellerVehicles: Vehicle[];
  allVehicles: Vehicle[];
  reportedVehicles: Vehicle[];
  onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, isFeaturing: boolean) => void;
  onAddMultipleVehicles: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => void;
  onUpdateVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: number) => void;
  onMarkAsSold: (vehicleId: number) => void;
  onMarkAsUnsold?: (vehicleId: number) => void;
  conversations: Conversation[];
  onSellerSendMessage: (conversationId: string, messageText: string, type?: ChatMessage['type'], payload?: any) => void;
  onMarkConversationAsReadBySeller: (conversationId: string) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onUpdateSellerProfile: (details: { dealershipName: string; bio: string; logoUrl: string; partnerBanks?: string[] }) => void;
  vehicleData: VehicleData;
  onFeatureListing: (vehicleId: number) => Promise<void>;
  onRequestCertification: (vehicleId: number) => void;
  onNavigate: (view: View) => void;
  onTestDriveResponse?: (conversationId: string, messageId: number, newStatus: 'confirmed' | 'rejected') => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
  onViewVehicle?: (vehicle: Vehicle) => void;
}

type DashboardView = 'overview' | 'listings' | 'form' | 'inquiries' | 'analytics' | 'salesHistory' | 'reports' | 'settings';

const HelpTooltip: React.FC<{ text: string }> = memo(({ text }) => (
    <span className="group relative ml-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-spinny-text-dark cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span className="absolute bottom-full mb-2 w-48 bg-white text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 left-1/2 -translate-x-1/2 z-10">{text}</span>
    </span>
));

// Combobox component for Make, Model, and Variant fields
const ComboboxInput: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  options: string[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  tooltip?: string;
}> = ({ label, name, value, onChange, options, placeholder, error, required = false, disabled = false, tooltip }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ensure options is always an array
  const safeOptions = Array.isArray(options) ? options : [];

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Filter options based on input
  useEffect(() => {
    if (!inputValue || inputValue.trim() === '') {
      setFilteredOptions(safeOptions);
    } else {
      const filtered = safeOptions.filter(opt => 
        opt && typeof opt === 'string' && opt.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [inputValue, safeOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const newValue = e.target.value || '';
      setInputValue(newValue);
      setIsOpen(true);
      onChange(e);
    } catch (error) {
      console.error('Error in handleInputChange:', error);
    }
  };

  const handleSelectOption = (option: string) => {
    if (!option || typeof option !== 'string') return;
    setInputValue(option);
    setIsOpen(false);
    // Create synthetic event for onChange
    try {
      // Create a minimal event object that handleChange expects
      const syntheticEvent = {
        target: {
          name,
          value: option
        } as HTMLInputElement,
        currentTarget: inputRef.current
      } as React.ChangeEvent<HTMLInputElement>;
      
      onChange(syntheticEvent);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error in handleSelectOption:', error);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    try {
      if (e.key === 'ArrowDown' && Array.isArray(filteredOptions) && filteredOptions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'Enter' && isOpen && Array.isArray(filteredOptions) && filteredOptions.length > 0 && filteredOptions[0]) {
        e.preventDefault();
        handleSelectOption(filteredOptions[0]);
      }
    } catch (error) {
      console.error('Error in handleInputKeyDown:', error);
    }
  };

  // Safety check - ensure we have valid data before rendering
  if (typeof name !== 'string' || name.length === 0) {
    console.error('ComboboxInput: Invalid name prop');
    return null;
  }

  return (
    <div className="relative">
      <label htmlFor={name} className="flex items-center text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark mb-1">
        {label}{required && <span className="text-spinny-orange ml-0.5">*</span>}
        {tooltip && <HelpTooltip text={tooltip} />}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={name}
          name={name}
          value={inputValue || ''}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          className={`block w-full p-3 pr-10 border rounded-lg focus:outline-none transition bg-white dark:text-spinny-text-dark disabled:bg-white dark:disabled:bg-white ${error ? 'border-spinny-orange' : 'border-gray-200 dark:border-gray-200-300'}`}
          style={!error ? { boxShadow: 'none' } : {}}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {isOpen && !disabled && Array.isArray(filteredOptions) && filteredOptions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {filteredOptions.slice(0, 10).map((option, index) => {
              if (!option || typeof option !== 'string') return null;
              return (
                <button
                  key={option || `option-${index}`}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
                >
                  {option}
                </button>
              );
            })}
            {filteredOptions.length > 10 && (
              <div className="px-4 py-2 text-xs text-gray-500 text-center">
                +{filteredOptions.length - 10} more options
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-spinny-orange">{error}</p>}
    </div>
  );
};

const FormInput: React.FC<{ label: string; name: keyof Vehicle | 'summary'; type?: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void; onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void; error?: string; tooltip?: string; required?: boolean; children?: React.ReactNode; disabled?: boolean; placeholder?: string; rows?: number }> = 
  ({ label, name, type = 'text', value, onChange, onBlur, error, tooltip, required = false, children, disabled = false, placeholder, rows }) => (
  <div>
    <label htmlFor={String(name)} className="flex items-center text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark mb-1">
        {label}{required && <span className="text-spinny-orange ml-0.5">*</span>}
        {tooltip && <HelpTooltip text={tooltip} />}
    </label>
    {type === 'select' ? (
        <select id={String(name)} name={String(name)} value={String(value)} onChange={onChange} required={required} disabled={disabled} className={`block w-full p-3 border rounded-lg focus:outline-none transition bg-white dark:text-spinny-text-dark disabled:bg-white dark:disabled:bg-white ${error ? 'border-spinny-orange' : 'border-gray-200 dark:border-gray-200-300'}`} onFocus={(e) => !error && (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)')} onBlur={(e) => e.currentTarget.style.boxShadow = ''}>
            {children}
        </select>
    ) : type === 'textarea' ? (
        <textarea id={String(name)} name={String(name)} value={String(value)} onChange={onChange} required={required} disabled={disabled} placeholder={placeholder} rows={rows} className={`block w-full p-3 border rounded-lg focus:outline-none transition bg-white dark:text-spinny-text-dark disabled:bg-white dark:disabled:bg-white ${error ? 'border-spinny-orange' : 'border-gray-200 dark:border-gray-200-300'}`} onFocus={(e) => !error && (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)')} onBlur={(e) => e.currentTarget.style.boxShadow = ''} />
    ) : (
        <input type={type} id={String(name)} name={String(name)} value={value} onChange={onChange} required={required} disabled={disabled} placeholder={placeholder} className={`block w-full p-3 border rounded-lg focus:outline-none transition bg-white dark:text-spinny-text-dark disabled:bg-white dark:disabled:bg-white ${error ? 'border-spinny-orange' : 'border-gray-200 dark:border-gray-200-300'}`} onFocus={(e) => !error && (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)')} onBlur={(e) => { e.currentTarget.style.boxShadow = ''; if (onBlur) onBlur(e); }} />
    )}
    {error && <p className="mt-1 text-xs text-spinny-orange">{error}</p>}
  </div>
);


const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; gradient?: string }> = memo(({ title, value, icon, gradient = "from-blue-500 to-indigo-600" }) => (
  <div className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border border-gray-100 hover:border-blue-200 hover:-translate-y-1 overflow-hidden">
    <div className="flex items-center justify-between mb-4 gap-3 overflow-hidden">
      <div className={`w-12 h-12 flex-shrink-0 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
        <div className="text-white">
          {icon}
        </div>
      </div>
      <div className="text-right min-w-0 flex-1 overflow-hidden">
        <p className="text-xs sm:text-sm md:text-base lg:text-lg font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent break-words break-all">
          {value}
        </p>
      </div>
    </div>
    <h3 className="text-sm font-semibold text-gray-600 group-hover:text-blue-600 transition-colors duration-300">
      {title}
    </h3>
  </div>
));

const PlanStatusCard: React.FC<{
    seller: User;
    activeListingsCount: number;
    featuredListingsCount: number;
    onNavigate: (view: View) => void;
}> = memo(({ seller, activeListingsCount, featuredListingsCount, onNavigate }) => {
    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Real-time update state for expiry dates
    const [currentTime, setCurrentTime] = useState(new Date());
    
    // Real-time expiry date updates - update every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute (60000ms)
        
        return () => clearInterval(interval);
    }, []);
    
    useEffect(() => {
        const loadPlan = async () => {
            try {
                const planDetails = await planService.getPlanDetails(seller.subscriptionPlan || 'free');
                setPlan(planDetails);
            } catch (error) {
                console.error('Failed to load plan details:', error);
                // Fallback to basic plan info
                setPlan({
                    name: 'Free Plan',
                    listingLimit: 3,
                    price: 0
                });
            } finally {
                setLoading(false);
            }
        };
        loadPlan();
    }, [seller.subscriptionPlan]);
    
    if (loading || !plan) {
        return (
            <div className="text-white p-6 rounded-lg shadow-lg flex flex-col h-full" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Plan Status</h3>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </div>
                <p className="text-sm opacity-90">Loading plan details...</p>
            </div>
        );
    }
    
    const listingLimit = plan.listingLimit === 'unlimited' ? Infinity : plan.listingLimit;
    const planFeaturedCredits = typeof plan.featuredCredits === 'number' ? plan.featuredCredits : 0;
    const storedRemainingCredits = typeof seller.featuredCredits === 'number'
        ? seller.featuredCredits
        : planFeaturedCredits;
    const featuredCreditsAfterUsage = Math.max(planFeaturedCredits - featuredListingsCount, 0);
    const effectiveFeaturedCredits = Math.min(storedRemainingCredits, featuredCreditsAfterUsage);
    const usagePercentage = listingLimit === Infinity ? 0 : (activeListingsCount / listingLimit) * 100;
    // Use currentTime for real-time updates
    const planIsExpired = !!seller.planExpiryDate && new Date(seller.planExpiryDate) < currentTime;

    return (
        <div className="text-white p-6 rounded-lg shadow-lg flex flex-col h-full" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' }}>
            <h3 className="text-lg font-bold flex justify-between items-center">
                <span>Your Plan: <span className="text-spinny-text-dark">{plan.name}</span></span>
            </h3>
            <div className="mt-4 space-y-3 text-sm flex-grow">
                <div className="flex justify-between">
                    <span>Active Listings:</span>
                    <span className="font-semibold">{activeListingsCount} / {plan.listingLimit === 'unlimited' ? '∞' : plan.listingLimit}</span>
                </div>
                <div className="w-full rounded-full h-2 mb-2" style={{ background: 'rgba(30, 136, 229, 0.1)' }}>
                    <div
                        className="bg-spinny-blue h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    ></div>
                </div>
                <div className="flex justify-between">
                    <span>Featured Credits:</span>
                    <span className="font-semibold">{effectiveFeaturedCredits} remaining</span>
                </div>
                 <div className="flex justify-between">
                    <span>Free Certifications:</span>
                    <span className="font-semibold">
                        {Math.max((plan.freeCertifications ?? 0) - (seller.usedCertifications || 0), 0)} remaining
                    </span>
                </div>

                {/* Always show expiry date section */}
                <div className="mt-4 pt-4 border-t border-spinny-white/20 space-y-2">
                    {seller.planActivatedDate && (
                        <div className="flex justify-between text-xs">
                            <span>Plan Activated:</span>
                            <span className="font-semibold">
                                {new Date(seller.planActivatedDate).toLocaleDateString('en-IN', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                })}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between text-xs">
                        <span>Expiry Date:</span>
                        {seller.planExpiryDate ? (
                            <span className={`font-semibold ${
                                (() => {
                                    const expiryDate = new Date(seller.planExpiryDate);
                                    const isExpired = expiryDate < currentTime;
                                    const daysRemaining = Math.ceil((expiryDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
                                    if (isExpired) return 'text-red-300';
                                    if (daysRemaining <= 7) return 'text-orange-300';
                                    return '';
                                })()
                            }`}>
                                {new Date(seller.planExpiryDate).toLocaleDateString('en-IN', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                })}
                                {(() => {
                                    const expiryDate = new Date(seller.planExpiryDate);
                                    const isExpired = expiryDate < currentTime;
                                    const daysRemaining = Math.ceil((expiryDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
                                    if (isExpired) {
                                        return <span className="ml-2 text-red-200 font-bold">(Expired)</span>;
                                    }
                                    if (daysRemaining <= 30 && daysRemaining > 0) {
                                        return <span className="ml-2 text-orange-200">({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left)</span>;
                                    }
                                    return null;
                                })()}
                            </span>
                        ) : (
                            <span className="font-semibold text-gray-300 text-xs">Not set</span>
                        )}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-spinny-white/20">
                    <h4 className="font-semibold mb-2">Plan Features:</h4>
                    <ul className="space-y-2 text-xs">
                        {(plan.features || []).map((feature: string) => (
                            <li key={feature} className="flex items-start">
                                <svg className="w-4 h-4 text-spinny-orange mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                </svg>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            {(planIsExpired || plan.id !== 'premium') && (
                <button
                    onClick={() => onNavigate(View.PRICING)}
                    className="mt-6 w-full bg-white text-spinny-orange font-bold py-2 px-4 rounded-lg hover:bg-white transition-colors"
                >
                    {planIsExpired ? 'Renew Plan' : 'Upgrade Plan'}
                </button>
            )}
        </div>
    );
});

const initialFormState: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'> = {
  make: '', model: '', variant: '', year: new Date().getFullYear(), price: 0, mileage: 0,
  description: '', engine: '', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '',
  color: '', features: [], images: [], documents: [],
  sellerEmail: '',
  category: VehicleCategory.FOUR_WHEELER, // Start with default category
  status: 'published',
  isFeatured: false,
  registrationYear: new Date().getFullYear(),
  insuranceValidity: '',
  insuranceType: 'Comprehensive',
  rto: '',
  city: '',
  state: '',
  location: '',
  noOfOwners: 1,
  displacement: '',
  groundClearance: '',
  bootSpace: '',
  qualityReport: {
    summary: '',
    fixesDone: [],
  },
  certifiedInspection: null,
  certificationStatus: 'none',
};

const FormFieldset: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <fieldset className="border border-gray-200 dark:border-gray-200-200 rounded-lg p-4">
            <legend className="px-2 text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark">
                <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2">
                    <span>{isOpen ? '▼' : '►'}</span>
                    {title}
                </button>
            </legend>
            {isOpen && <div className="mt-4 animate-fade-in">{children}</div>}
        </fieldset>
    );
};

interface VehicleFormProps {
    seller: User;
    editingVehicle: Vehicle | null;
    allVehicles: Vehicle[];
    onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, isFeaturing: boolean) => void;
    onUpdateVehicle: (vehicle: Vehicle) => void;
    onFeatureListing: (vehicleId: number) => Promise<void>;
    onCancel: () => void;
    vehicleData: VehicleData;
}

// Settings View Component for Bank Partner Selection
const SettingsView: React.FC<{ seller: User; onUpdateSeller: (details: { dealershipName: string; bio: string; logoUrl: string; partnerBanks?: string[] }) => void | Promise<void> }> = ({ seller, onUpdateSeller }) => {
  const [selectedBanks, setSelectedBanks] = useState<string[]>(seller?.partnerBanks || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Update selectedBanks when seller data changes
  useEffect(() => {
    if (seller?.partnerBanks) {
      setSelectedBanks(seller.partnerBanks);
    } else {
      setSelectedBanks([]);
    }
  }, [seller?.partnerBanks]);

  // Safety check
  if (!seller || !seller.email) {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
        <p className="text-gray-600">Unable to load seller information. Please refresh the page.</p>
      </div>
    );
  }

  // Common Indian banks for vehicle financing
  const availableBanks = [
    'HDFC Bank',
    'ICICI Bank',
    'State Bank of India (SBI)',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'Bajaj Finserv',
    'Tata Capital',
    'Mahindra Finance',
    'Yes Bank',
    'IDFC First Bank',
    'Bank of Baroda',
    'Punjab National Bank (PNB)',
    'Union Bank of India',
    'Canara Bank',
    'Indian Bank'
  ];

  const handleBankToggle = (bankName: string) => {
    setSelectedBanks(prev => {
      if (prev.includes(bankName)) {
        return prev.filter(b => b !== bankName);
      } else {
        return [...prev, bankName];
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateSeller({
        dealershipName: seller.dealershipName || seller.name,
        bio: seller.bio || '',
        logoUrl: seller.logoUrl || '',
        partnerBanks: selectedBanks
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save bank partners:', error);
      alert('Failed to save bank partners. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-6">Settings</h2>
      
      <div className="space-y-6">
        {/* Finance Partner Banks Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Finance Partner Banks
            </h3>
            <p className="text-sm text-gray-600">
              Select the banks you are partnered with for vehicle financing. This information will be displayed to potential buyers on your listings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {availableBanks.map((bank) => {
              const isSelected = selectedBanks.includes(bank);
              return (
                <label
                  key={bank}
                  className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleBankToggle(bank)}
                    className="sr-only"
                  />
                  <div className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                    isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                    {bank}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedBanks.length > 0 && (
            <div className="mb-4 p-3 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-900 mb-2">Selected Partners ({selectedBanks.length}):</p>
              <div className="flex flex-wrap gap-2">
                {selectedBanks.map((bank) => (
                  <span
                    key={bank}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200"
                  >
                    {bank}
                    <button
                      onClick={() => handleBankToggle(bank)}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                      aria-label={`Remove ${bank}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {selectedBanks.length === 0 
                ? 'No banks selected. Buyers won\'t see finance partner information.' 
                : `This information will be displayed on all your vehicle listings.`}
            </p>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                isSaving
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : saveSuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {isSaving ? 'Saving...' : saveSuccess ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const VehicleForm: React.FC<VehicleFormProps> = memo(({ editingVehicle, onAddVehicle, onUpdateVehicle, onCancel, vehicleData, seller, onFeatureListing, allVehicles }) => {
    const [formData, setFormData] = useState(editingVehicle ? { 
        ...initialFormState, 
        ...editingVehicle, 
        sellerEmail: editingVehicle.sellerEmail,
        sellerName: editingVehicle.sellerName || seller.name || seller.dealershipName || 'Seller'
    } : { 
        ...initialFormState, 
        sellerEmail: seller.email,
        sellerName: seller.name || seller.dealershipName || 'Seller'
    });
    
    // Debug logging for form initialization
    console.log('🔧 VehicleForm initialized:', {
        editingVehicle: !!editingVehicle,
        sellerEmail: seller.email,
        formDataSellerEmail: formData.sellerEmail,
        formDataMake: formData.make,
        formDataModel: formData.model,
        vehicleDataKeys: Object.keys(vehicleData),
        vehicleDataStructure: vehicleData
    });

    // Safety check for vehicleData
    const safeVehicleData = useMemo(() => {
        if (!vehicleData || Object.keys(vehicleData).length === 0) {
            console.warn('⚠️ VehicleData is empty or undefined, using fallback');
            // Use a minimal fallback structure
            return {
                'four-wheeler': [
                    { name: 'Maruti Suzuki', models: [{ name: 'Swift', variants: ['LXI', 'VXI', 'ZXI'] }] },
                    { name: 'Hyundai', models: [{ name: 'i20', variants: ['Magna', 'Sportz', 'Asta'] }] }
                ],
                'two-wheeler': [
                    { name: 'Honda', models: [{ name: 'Activa', variants: ['Standard', 'Deluxe'] }] },
                    { name: 'Bajaj', models: [{ name: 'Pulsar', variants: ['150', '180', '220'] }] }
                ]
            };
        }
        return vehicleData;
    }, [vehicleData]);
    
    // Location data state for this component
    const [indianStates, setIndianStates] = useState<Array<{name: string, code: string}>>([]);
    const [citiesByState, setCitiesByState] = useState<Record<string, string[]>>({});
    
    const [featureInput, setFeatureInput] = useState('');
    const [fixInput, setFixInput] = useState('');
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, string>>>({});
    // Real-time update state for expiry dates
    const [currentTime, setCurrentTime] = useState(new Date());
    
    // Real-time expiry date updates - update every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute (60000ms)
        
        return () => clearInterval(interval);
    }, []);
    const [isUploading, setIsUploading] = useState(false);
    const [isFeaturing, setIsFeaturing] = useState(false);
    
    const [aiSuggestions, setAiSuggestions] = useState<{
        structuredSpecs: Partial<Pick<Vehicle, 'engine' | 'transmission' | 'fuelType' | 'fuelEfficiency' | 'displacement' | 'groundClearance' | 'bootSpace'>>;
        featureSuggestions: Record<string, string[]>;
    } | null>(null);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

    // Ensure seller email is always set in form data
    useEffect(() => {
        if (!formData.sellerEmail && seller.email) {
            setFormData(prev => ({ ...prev, sellerEmail: seller.email }));
        }
    }, [seller.email, formData.sellerEmail]);

    // Load location data when component mounts
    useEffect(() => {
        const loadLocationData = async () => {
            try {
                const { loadLocationData } = await import('../utils/dataLoaders');
                const locationData = await loadLocationData();
                setIndianStates(locationData.INDIAN_STATES || []);
                setCitiesByState(locationData.CITIES_BY_STATE || {});
            } catch (error) {
                console.error('Failed to load location data:', error);
            }
        };
        loadLocationData();
    }, []);

    const availableMakes = useMemo(() => {
        try {
            if (!formData.category || !safeVehicleData || !safeVehicleData[formData.category]) {
                return [];
            }
            
            const categoryData = safeVehicleData[formData.category];
            if (!Array.isArray(categoryData)) {
                return [];
            }
            
            const makes = categoryData
                .map(make => make?.name)
                .filter((name): name is string => typeof name === 'string' && name.length > 0)
                .sort();
            return makes;
        } catch (error) {
            console.error('Error calculating availableMakes:', error);
            return [];
        }
    }, [formData.category, safeVehicleData]);

    const availableModels = useMemo(() => {
        try {
            if (!formData.category || !formData.make || !safeVehicleData || !safeVehicleData[formData.category]) {
                return [];
            }
            
            const categoryData = safeVehicleData[formData.category];
            if (!Array.isArray(categoryData)) {
                return [];
            }
            
            const makeData = categoryData.find(m => m?.name === formData.make);
            if (!makeData || !Array.isArray(makeData.models)) {
                return [];
            }
            
            return makeData.models
                .map(model => model?.name)
                .filter((name): name is string => typeof name === 'string' && name.length > 0)
                .sort();
        } catch (error) {
            console.error('Error calculating availableModels:', error);
            return [];
        }
    }, [formData.category, formData.make, safeVehicleData]);

    const availableVariants = useMemo(() => {
        try {
            if (!formData.category || !formData.make || !formData.model || !safeVehicleData || !safeVehicleData[formData.category]) {
                return [];
            }
            
            const categoryData = safeVehicleData[formData.category];
            if (!Array.isArray(categoryData)) {
                return [];
            }
            
            const makeData = categoryData.find(m => m?.name === formData.make);
            if (!makeData || !Array.isArray(makeData.models)) {
                return [];
            }
            
            const modelData = makeData.models.find(m => m?.name === formData.model);
            if (!modelData || !Array.isArray(modelData.variants)) {
                return [];
            }
            
            return modelData.variants
                .filter((variant): variant is string => typeof variant === 'string' && variant.length > 0)
                .sort();
        } catch (error) {
            console.error('Error calculating availableVariants:', error);
            return [];
        }
    }, [formData.category, formData.make, formData.model, safeVehicleData]);

    const availableCities = useMemo(() => {
        if (!formData.state || !citiesByState || !citiesByState[formData.state]) return [];
        return citiesByState[formData.state].sort();
    }, [formData.state, citiesByState]);

    // Check if vehicle data is available for the selected category
    const hasVehicleData = useMemo(() => {
        return formData.category && vehicleData[formData.category] && vehicleData[formData.category].length > 0;
    }, [formData.category, vehicleData]);

    const handleGetAiSuggestions = async () => {
        const { make, model, year, variant } = formData;
        if (!make || !model || !year) {
            alert('Please select a Make, Model, and Year first.');
            return;
        }
        
        setIsGeneratingSuggestions(true);
        setAiSuggestions(null);
        try {
            console.log('🤖 Fetching AI suggestions for:', { make, model, year, variant });
            const suggestions = await getAiVehicleSuggestions({ make, model, year, variant });
            console.log('📋 AI Suggestions received:', suggestions);
            setAiSuggestions(suggestions);

            // Auto-apply structured specs if the fields are empty
            if (suggestions.structuredSpecs) {
                const updates: Partial<Vehicle> = {};
                for (const key in suggestions.structuredSpecs) {
                    const specKey = key as keyof typeof suggestions.structuredSpecs;
                    const currentValue = formData[specKey];
                    const suggestedValue = suggestions.structuredSpecs[specKey];
                    
                    // Only apply if:
                    // 1. Field is empty (empty string, null, undefined) OR equals 'N/A'
                    // 2. Suggested value exists and is not 'N/A'
                    const isEmpty = !currentValue || currentValue === '' || currentValue === 'N/A';
                    const hasValidSuggestion = suggestedValue && suggestedValue !== 'N/A' && suggestedValue !== '';
                    
                    if (isEmpty && hasValidSuggestion) {
                        updates[specKey] = suggestedValue as any;
                        console.log(`✅ Will auto-fill ${specKey}: "${currentValue}" → "${suggestedValue}"`);
                    } else {
                        console.log(`⏭️ Skipping ${specKey}: isEmpty=${isEmpty}, hasValidSuggestion=${hasValidSuggestion}, current="${currentValue}", suggested="${suggestedValue}"`);
                    }
                }
                if (Object.keys(updates).length > 0) {
                    console.log('✅ Auto-filling Vehicle Specifications:', updates);
                    setFormData(prev => ({ ...prev, ...updates }));
                } else {
                    console.log('⚠️ No updates to apply - fields may already have values or AI returned N/A');
                }
            } else {
                console.warn('⚠️ No structuredSpecs in AI response');
            }
        } catch (error) {
            console.error("❌ Failed to fetch AI suggestions:", error);
            setAiSuggestions({ structuredSpecs: {}, featureSuggestions: { "Error": ["Could not fetch suggestions."] } });
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };
    
    const validateField = (name: keyof Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, value: any): string => {
      switch(name) {
          case 'make': case 'model': return value.trim().length < 2 ? `${name} must be at least 2 characters long.` : '';
          case 'year': {
              const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
              return isNaN(numValue) || numValue < 1900 || numValue > new Date().getFullYear() + 1 ? 'Please enter a valid year.' : '';
          }
          case 'price': {
              const numValue = typeof value === 'string' ? parseFloat(value) : value;
              return isNaN(numValue) || numValue <= 0 ? 'Price must be greater than 0.' : '';
          }
          case 'mileage': {
              const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
              return isNaN(numValue) || numValue < 0 ? 'Mileage cannot be negative.' : '';
          }
          default: return '';
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target as { name: keyof typeof initialFormState; value: string };
      
      // Store as string during editing, parse only on blur
      setFormData(prev => {
        const newState = { ...prev, [name]: value };
        if (name === 'category') {
            newState.make = ''; newState.model = ''; newState.variant = '';
        } else if (name === 'make') {
            newState.model = ''; newState.variant = '';
        } else if (name === 'model') {
            newState.variant = '';
        } else if (name === 'state') {
            newState.city = '';
        }
        return newState;
      });

      // Clear error when user starts typing
      setErrors(prev => ({...prev, [name]: ''}));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target as { name: keyof typeof initialFormState; value: string };
      const isNumeric = ['year', 'price', 'mileage', 'noOfOwners', 'registrationYear'].includes(name);
      
      // Parse numeric fields only when user finishes editing
      if (isNumeric && value !== '') {
        const num = name === 'price' ? parseFloat(value) : parseInt(value, 10);
        if (!isNaN(num)) {
          setFormData(prev => ({ ...prev, [name]: num }));
          const error = validateField(name, num);
          setErrors(prev => ({...prev, [name]: error}));
        }
      }
    };

    const handleQualityReportChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            qualityReport: {
                ...(prev.qualityReport!),
                [name]: value,
            },
        }));
    };
  
    const handleAddFeature = () => {
      if (featureInput.trim() && !formData.features.includes(featureInput.trim())) {
        setFormData(prev => ({ ...prev, features: [...prev.features, featureInput.trim()] }));
        setFeatureInput('');
      }
    };
  
    const handleRemoveFeature = (featureToRemove: string) => {
      setFormData(prev => ({ ...prev, features: prev.features.filter(f => f !== featureToRemove) }));
    };

    const handleAddFix = () => {
        if (fixInput.trim() && !formData.qualityReport?.fixesDone.includes(fixInput.trim())) {
            setFormData(prev => ({
                ...prev,
                qualityReport: {
                    summary: prev.qualityReport?.summary || '',
                    fixesDone: [...(prev.qualityReport?.fixesDone || []), fixInput.trim()]
                }
            }));
            setFixInput('');
        }
    };

    const handleRemoveFix = (fixToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            qualityReport: {
                summary: prev.qualityReport?.summary || '',
                fixesDone: (prev.qualityReport?.fixesDone || []).filter(f => f !== fixToRemove)
            }
        }));
    };

    const handleSuggestedFeatureToggle = (feature: string) => {
        setFormData(prev => {
            const currentFeatures = prev.features;
            const newFeatures = currentFeatures.includes(feature)
                ? currentFeatures.filter(f => f !== feature)
                : [...currentFeatures, feature];
            return { ...prev, features: newFeatures.sort() };
        });
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
        const input = e.target;
        if (!input.files) return;

        setIsUploading(true);
        const files = Array.from(input.files);
        
        try {
            // Import image upload service
            const { uploadImages, validateImageFile } = await import('../services/imageUploadService');
            
            // Validate all files first
            for (const file of files) {
                if (type === 'image') {
                    const validation = validateImageFile(file);
                    if (!validation.valid) {
                        alert(validation.error || 'Invalid image file');
                        setIsUploading(false);
                        if (input) input.value = '';
                        return;
                    }
                }
            }
            
            // Upload images to cloud storage (or convert to base64 if not configured)
            // Pass seller email for ownership tracking
            const uploadResults = await uploadImages(files, 'vehicles', seller?.email);
            
            // Check for upload errors
            const failedUploads = uploadResults.filter(r => !r.success);
            if (failedUploads.length > 0) {
                const errorMessage = failedUploads.map(r => r.error).join(', ');
                console.error('❌ Image upload failed:', errorMessage);
                alert(`Failed to upload ${failedUploads.length} file(s): ${errorMessage}`);
                setIsUploading(false);
                if (input) input.value = '';
                return;
            }
            
            // Get successful upload URLs
            const successfulUrls = uploadResults
                .filter(r => r.success && r.url)
                .map(r => r.url!);
            
            if (successfulUrls.length > 0) {
                if (type === 'image') {
                    // Limit total images to prevent vehicle object from becoming too large
                    // Firebase Realtime Database has 16MB limit per node
                    const currentImages = formData.images || [];
                    const maxImages = 10; // Limit to 10 images per vehicle
                    const remainingSlots = maxImages - currentImages.length;
                    
                    if (remainingSlots <= 0) {
                        alert(`Maximum ${maxImages} images allowed per vehicle. Please remove some images before adding more.`);
                        setIsUploading(false);
                        if (input) input.value = '';
                        return;
                    }
                    
                    const imagesToAdd = successfulUrls.slice(0, remainingSlots);
                    if (successfulUrls.length > remainingSlots) {
                        alert(`Only ${remainingSlots} image(s) added. Maximum ${maxImages} images allowed per vehicle.`);
                    }
                    
                    setFormData(prev => ({ ...prev, images: [...prev.images, ...imagesToAdd] }));
                    console.log(`✅ Successfully uploaded ${imagesToAdd.length} image(s) (${currentImages.length + imagesToAdd.length}/${maxImages} total)`);
                } else {
                    const docType = (document.getElementById('document-type') as HTMLSelectElement).value as VehicleDocument['name'];
                    const newDocs: VehicleDocument[] = successfulUrls.map((url, idx) => ({ 
                        name: docType, 
                        url, 
                        fileName: files[idx]?.name || 'document' 
                    }));
                    setFormData(prev => ({ ...prev, documents: [...(prev.documents || []), ...newDocs] }));
                }
            } else {
                console.warn('⚠️ No images were successfully uploaded');
                alert('No images were uploaded. Please try again.');
            }
        } catch (error) { 
            console.error("Error uploading files:", error);
            alert('Failed to upload files. Please try again.');
        } 
        finally {
            setIsUploading(false);
            if (input) input.value = '';
        }
    };
  
    const handleRemoveImageUrl = (urlToRemove: string) => {
      setFormData(prev => ({...prev, images: prev.images.filter(url => url !== urlToRemove)}));
    };

    const handleRemoveDocument = (urlToRemove: string) => {
        setFormData(prev => ({ ...prev, documents: (prev.documents || []).filter(doc => doc.url !== urlToRemove) }));
    };
  
    const handleGenerateDescription = async () => {
      if (!formData.make || !formData.model || !formData.year) {
        alert('Please enter Make, Model, and Year before generating a description.');
        return;
      }
      setIsGeneratingDesc(true);
      try {
        const description = await generateVehicleDescription(formData);
        if (description.includes("Failed to generate")) alert(description);
        else setFormData(prev => ({ ...prev, description }));
      } catch (error) { console.error(error); alert('There was an error generating the description.'); }
      finally { setIsGeneratingDesc(false); }
    };

    // Determine if seller's plan is expired (client-side UX guard; server still enforces)
    // Use currentTime for real-time updates
    const isPlanExpired = !!seller?.planExpiryDate && new Date(seller.planExpiryDate) < currentTime;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Block new listings if plan is expired (allow editing existing vehicles)
        if (!editingVehicle && isPlanExpired) {
            alert('Your subscription plan has expired. Please renew your plan to create new listings.');
            return;
        }
        console.log('📝 Dashboard form submitted');
        console.log('📋 Form data:', formData);
        console.log('⭐ Is featuring:', isFeaturing);
        console.log('✉️ Seller email in form:', formData.sellerEmail);
        
        // CRITICAL FIX: Validate required numeric fields BEFORE sanitization
        const priceValue = typeof formData.price === 'string' ? parseFloat(formData.price) : formData.price;
        const mileageValue = typeof formData.mileage === 'string' ? parseInt(formData.mileage, 10) : formData.mileage;
        
        if (!priceValue || isNaN(priceValue) || priceValue <= 0) {
            alert('Please enter a valid price greater than 0');
            console.error('❌ Invalid price:', formData.price, '→', priceValue);
            return;
        }
        
        if (isNaN(mileageValue) || mileageValue < 0) {
            alert('Please enter a valid mileage (km driven)');
            console.error('❌ Invalid mileage:', formData.mileage, '→', mileageValue);
            return;
        }
        
        // FIX: Ensure all numeric fields are actual numbers before submission
        const sanitizedFormData = {
            ...formData,
            year: typeof formData.year === 'string' ? parseInt(formData.year, 10) : formData.year,
            price: priceValue,
            mileage: mileageValue,
            registrationYear: typeof formData.registrationYear === 'string' ? parseInt(formData.registrationYear, 10) : formData.registrationYear,
            noOfOwners: typeof formData.noOfOwners === 'string' ? parseInt(formData.noOfOwners, 10) : formData.noOfOwners,
        };
        
        console.log('🔄 Sanitized form data:', sanitizedFormData);
        console.log('💰 Price check:', { original: formData.price, sanitized: sanitizedFormData.price, type: typeof sanitizedFormData.price });
        
        if (editingVehicle) {
            console.log('✏️ Editing existing vehicle:', editingVehicle.id);
            onUpdateVehicle({ ...editingVehicle, ...sanitizedFormData });
            if (isFeaturing && !editingVehicle.isFeatured) {
                void onFeatureListing(editingVehicle.id);
            }
        } else {
            console.log('➕ Adding new vehicle');
            console.log('📧 Seller email in sanitized data:', sanitizedFormData.sellerEmail);
            console.log('📧 Seller email from props:', seller.email);
            onAddVehicle(sanitizedFormData, isFeaturing);
        }
        onCancel();
    };

    const previewVehicle: Vehicle = {
        id: editingVehicle?.id || Date.now(),
        averageRating: 0, ratingCount: 0,
        ...formData,
        images: formData.images.length > 0 ? formData.images : [getPlaceholderImage(formData.make, formData.model)],
    };

    const applyAiSpec = (specKey: 'engine' | 'transmission' | 'fuelType' | 'fuelEfficiency' | 'displacement' | 'groundClearance' | 'bootSpace') => {
        if (aiSuggestions?.structuredSpecs?.[specKey]) {
            setFormData(prev => ({ ...prev, [specKey]: aiSuggestions.structuredSpecs[specKey] }));
        }
    };

    return (
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-6 border-b dark:border-gray-200-200 pb-4">
          {editingVehicle ? 'Edit Vehicle Listing' : 'List a New Vehicle'}
        </h2>
        {isPlanExpired && (
            <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
                Your plan has expired. Renew your plan to add new listings.
            </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Form Column */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormFieldset title="Vehicle Overview">
                <div className="flex justify-between items-center mb-4 -mt-4">
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-spinny-text-dark dark:text-spinny-text-dark">Enter core details about your vehicle.</p>
                        {hasVehicleData && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Admin Managed
                            </span>
                        )}
                    </div>
                    <button type="button" onClick={handleGetAiSuggestions} disabled={isGeneratingSuggestions || !formData.make || !formData.model || !formData.year} className="text-sm font-semibold text-spinny-orange disabled:opacity-50 flex items-center gap-1">
                        {isGeneratingSuggestions ? (<><div className="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-current"></div><span>Generating...</span></>) : '✨ Auto-fill with AI'}
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    <FormInput label="Category" name="category" type="select" value={formData.category} onChange={handleChange} required>
                        <option value="" disabled>Select Category</option>
                        {(() => {
                            const categories = Object.keys(safeVehicleData);
                            // Categories loaded successfully
                            
                            if (categories.length === 0) {
                                return <option value="" disabled>Loading categories...</option>;
                            }
                            
                            return categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                </option>
                            ));
                        })()}
                    </FormInput>
                    <ComboboxInput
                        label="Make"
                        name="make"
                        value={formData.make || ''}
                        onChange={handleChange}
                        options={Array.isArray(availableMakes) ? availableMakes : []}
                        placeholder={!formData.category ? 'Select Category First' : 'Select or type Make'}
                        error={errors.make}
                        disabled={!formData.category}
                        required
                    />
                    <ComboboxInput
                        label="Model"
                        name="model"
                        value={formData.model || ''}
                        onChange={handleChange}
                        options={Array.isArray(availableModels) ? availableModels : []}
                        placeholder={!formData.make ? 'Select Make First' : 'Select or type Model'}
                        error={errors.model}
                        disabled={!formData.make}
                        required
                    />
                    <ComboboxInput
                        label="Variant"
                        name="variant"
                        value={formData.variant || ''}
                        onChange={handleChange}
                        options={Array.isArray(availableVariants) ? availableVariants : []}
                        placeholder="Select or type Variant (Optional)"
                        disabled={!formData.model}
                    />
                    <FormInput label="Make Year" name="year" type="number" value={formData.year} onChange={handleChange} onBlur={handleBlur} error={errors.year} required />
                    <FormInput label="Registration Year" name="registrationYear" type="number" value={formData.registrationYear} onChange={handleChange} onBlur={handleBlur} required />
                    <div>
                        <FormInput label="Price (₹)" name="price" type="number" value={formData.price} onChange={handleChange} onBlur={handleBlur} error={errors.price} tooltip="Enter the listing price without commas or symbols." required />
                        <PricingGuidance vehicleDetails={formData} allVehicles={allVehicles} />
                    </div>
                    <FormInput label="Km Driven" name="mileage" type="number" value={formData.mileage} onChange={handleChange} onBlur={handleBlur} error={errors.mileage} />
                    <FormInput label="No. of Owners" name="noOfOwners" type="number" value={formData.noOfOwners} onChange={handleChange} onBlur={handleBlur} />
                    <FormInput label="RTO" name="rto" value={formData.rto} onChange={handleChange} placeholder="e.g., MH01" />
                    <FormInput label="State" name="state" type="select" value={formData.state} onChange={handleChange} required>
                        <option value="" disabled>Select State</option>
                        {indianStates.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </FormInput>
                    <FormInput label="City" name="city" type="select" value={formData.city} onChange={handleChange} disabled={!formData.state} required>
                        <option value="" disabled>Select City</option>
                        {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </FormInput>
                    <FormInput label="Insurance Type" name="insuranceType" type="select" value={formData.insuranceType} onChange={handleChange}>
                        <option>Comprehensive</option>
                        <option>Third Party</option>
                        <option>Expired</option>
                    </FormInput>
                    <FormInput label="Insurance Validity" name="insuranceValidity" value={formData.insuranceValidity} onChange={handleChange} placeholder="e.g., Aug 2026" />
                </div>
            </FormFieldset>
            
            <FormFieldset title="Vehicle Specifications">
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    <div>
                        <FormInput label="Engine" name="engine" value={formData.engine} onChange={handleChange} tooltip="e.g., 1.5L Petrol, 150kW Motor"/>
                        {aiSuggestions?.structuredSpecs.engine && formData.engine !== aiSuggestions.structuredSpecs.engine && (<button type="button" onClick={() => applyAiSpec('engine')} className="text-xs text-spinny-orange hover:underline mt-1">Apply: "{aiSuggestions.structuredSpecs.engine}"</button>)}
                    </div>
                    <div>
                        <FormInput label="Displacement" name="displacement" value={formData.displacement} onChange={handleChange} placeholder="e.g., 1497 cc"/>
                        {aiSuggestions?.structuredSpecs.displacement && formData.displacement !== aiSuggestions.structuredSpecs.displacement && (<button type="button" onClick={() => applyAiSpec('displacement')} className="text-xs text-spinny-orange hover:underline mt-1">Apply: "{aiSuggestions.structuredSpecs.displacement}"</button>)}
                    </div>
                     <div>
                        <FormInput label="Transmission" name="transmission" type="select" value={formData.transmission} onChange={handleChange}>
                            <option>Automatic</option><option>Manual</option><option>CVT</option><option>DCT</option>
                        </FormInput>
                        {aiSuggestions?.structuredSpecs.transmission && formData.transmission !== aiSuggestions.structuredSpecs.transmission && (<button type="button" onClick={() => applyAiSpec('transmission')} className="text-xs text-spinny-orange hover:underline mt-1">Apply: "{aiSuggestions.structuredSpecs.transmission}"</button>)}
                    </div>
                    <div>
                        <FormInput label="Fuel Type" name="fuelType" type="select" value={formData.fuelType} onChange={handleChange}>
                            <option>Petrol</option><option>Diesel</option><option>Electric</option><option>CNG</option><option>Hybrid</option>
                        </FormInput>
                         {aiSuggestions?.structuredSpecs.fuelType && formData.fuelType !== aiSuggestions.structuredSpecs.fuelType && (<button type="button" onClick={() => applyAiSpec('fuelType')} className="text-xs text-spinny-orange hover:underline mt-1">Apply: "{aiSuggestions.structuredSpecs.fuelType}"</button>)}
                    </div>
                    <div>
                        <FormInput label="Mileage / Range" name="fuelEfficiency" value={formData.fuelEfficiency} onChange={handleChange} tooltip="e.g., 18 KMPL or 300 km range"/>
                         {aiSuggestions?.structuredSpecs.fuelEfficiency && formData.fuelEfficiency !== aiSuggestions.structuredSpecs.fuelEfficiency && (<button type="button" onClick={() => applyAiSpec('fuelEfficiency')} className="text-xs text-spinny-orange hover:underline mt-1">Apply: "{aiSuggestions.structuredSpecs.fuelEfficiency}"</button>)}
                    </div>
                     <div>
                        <FormInput label="Ground Clearance" name="groundClearance" value={formData.groundClearance} onChange={handleChange} placeholder="e.g., 190 mm"/>
                        {aiSuggestions?.structuredSpecs.groundClearance && formData.groundClearance !== aiSuggestions.structuredSpecs.groundClearance && (<button type="button" onClick={() => applyAiSpec('groundClearance')} className="text-xs text-spinny-orange hover:underline mt-1">Apply: "{aiSuggestions.structuredSpecs.groundClearance}"</button>)}
                    </div>
                    <div>
                        <FormInput label="Boot Space" name="bootSpace" value={formData.bootSpace} onChange={handleChange} placeholder="e.g., 433 litres"/>
                        {aiSuggestions?.structuredSpecs.bootSpace && formData.bootSpace !== aiSuggestions.structuredSpecs.bootSpace && (<button type="button" onClick={() => applyAiSpec('bootSpace')} className="text-xs text-spinny-orange hover:underline mt-1">Apply: "{aiSuggestions.structuredSpecs.bootSpace}"</button>)}
                    </div>
                    <FormInput label="Color" name="color" value={formData.color} onChange={handleChange} onBlur={handleBlur} />
                 </div>
            </FormFieldset>

            <FormFieldset title="Quality Report">
                <div className="space-y-4">
                    <FormInput label="Summary" name="summary" type="textarea" value={formData.qualityReport?.summary || ''} onChange={handleQualityReportChange} rows={3} placeholder="e.g., Excellent condition, single owner, full service history..."/>
                    <div>
                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark mb-1">Fixes Done / Upgrades</label>
                        <div className="flex gap-2">
                            <input type="text" value={fixInput} onChange={(e) => setFixInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFix(); } }} placeholder="e.g., New tires installed" className="flex-grow p-3 border border-gray-200 dark:border-gray-200-300 rounded-lg" />
                            <button type="button" onClick={handleAddFix} className="bg-white-dark dark:bg-white font-bold py-2 px-4 rounded-lg">Add Fix</button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {(formData.qualityReport?.fixesDone || []).map(fix => (
                                <span key={fix} className="bg-spinny-orange-light text-spinny-orange text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-2">
                                    {fix}
                                    <button type="button" onClick={() => handleRemoveFix(fix)}>&times;</button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </FormFieldset>
            
            <FormFieldset title="Media, Documents & Description">
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark">Images</label>
                        <div className="mt-1">
                            <label htmlFor="file-upload" className={`relative cursor-pointer bg-white rounded-lg border-2 border-gray-200 dark:border-gray-200-300 border-dashed transition-colors duration-200 flex flex-col items-center justify-center text-center p-6 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ borderColor: isUploading ? '' : undefined }} onMouseEnter={(e) => !isUploading && (e.currentTarget.style.borderColor = 'var(--spinny-orange)')} onMouseLeave={(e) => !isUploading && (e.currentTarget.style.borderColor = '')}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-spinny-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="mt-2 block text-sm font-semibold" style={{ color: '#FF6B35' }}>
                                    {isUploading ? 'Uploading...' : 'Upload images'}
                                </span>
                                <input id="file-upload" type="file" className="sr-only" multiple accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'image')} disabled={isUploading} />
                            </label>
                        </div>
                        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            {formData.images.map((url, index) => (
                                <div key={index} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                    <img src={getSafeImageSrc(url)} className="w-full h-full object-cover rounded-lg shadow-sm" alt={`Vehicle thumbnail ${index + 1}`} />
                                    <button type="button" onClick={() => handleRemoveImageUrl(url)} className="absolute top-1 right-1 bg-spinny-orange text-white rounded-full h-6 w-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark">Documents</label>
                        <div className="mt-1 flex items-center gap-2">
                             <select id="document-type" className="p-3 border rounded-lg bg-white dark:text-spinny-text-dark border-gray-200 dark:border-gray-200-300">
                                <option>Registration Certificate (RC)</option>
                                <option>Insurance</option>
                                <option>Pollution Under Control (PUC)</option>
                                <option>Service Record</option>
                                <option>Other</option>
                            </select>
                            <label htmlFor="doc-upload" className={`cursor-pointer font-semibold text-white py-2 px-4 rounded-lg transition-colors ${isUploading ? 'bg-white' : 'btn-brand-primary'}`} style={!isUploading ? { background: 'var(--gradient-primary)', cursor: 'pointer' } : undefined}>
                                {isUploading ? '...' : 'Upload'}
                                <input id="doc-upload" type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleFileUpload(e, 'document')} disabled={isUploading} />
                            </label>
                        </div>
                         <div className="mt-2 flex flex-wrap gap-2">
                            {(formData.documents || []).map(doc => (
                                <span key={doc.url} className="bg-white-dark dark:bg-white text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-2">
                                    {doc.fileName} ({doc.name})
                                    <button type="button" onClick={() => handleRemoveDocument(doc.url)}>&times;</button>
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark mb-1">Key Features</label>
                        <div className="flex gap-2">
                            <input type="text" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }} placeholder="e.g., Sunroof" className="flex-grow p-3 border border-gray-200 dark:border-gray-200-300 rounded-lg" />
                            <button type="button" onClick={handleAddFeature} className="bg-white-dark dark:bg-white font-bold py-2 px-4 rounded-lg">Add</button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">{formData.features.map(feature => ( <span key={feature} className="brand-badge-orange text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-2">{feature}<button type="button" onClick={() => handleRemoveFeature(feature)}>&times;</button></span> ))}</div>
                    </div>
                     <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="description" className="block text-sm font-medium">Vehicle Description</label>
                            <button type="button" onClick={handleGenerateDescription} disabled={isGeneratingDesc || !formData.make || !formData.model} className="text-sm font-semibold text-spinny-orange disabled:opacity-50"> {isGeneratingDesc ? '...' : '✨ Generate with AI'}</button>
                        </div>
                        <textarea id="description" name="description" rows={4} value={formData.description} onChange={handleChange} className="block w-full p-3 border border-gray-200 dark:border-gray-200-300 rounded-lg" />
                    </div>
                </div>
            </FormFieldset>

            <FormFieldset title="Promotion">
                {(!editingVehicle || !editingVehicle.isFeatured) && (
                    <div className="p-4 bg-spinny-orange dark:bg-spinny-orange/20 border border-spinny-orange dark:border-spinny-orange rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <label htmlFor="feature-listing" className="font-bold text-white dark:text-white flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                    Feature this Listing
                                </label>
                                <p className="text-xs text-white dark:text-white mt-1">
                                    Use 1 of your {seller.featuredCredits || 0} available credits.
                                </p>
                            </div>
                            <input
                                id="feature-listing"
                                type="checkbox"
                                checked={isFeaturing}
                                onChange={(e) => setIsFeaturing(e.target.checked)}
                                disabled={(seller.featuredCredits || 0) <= 0}
                                className="h-6 w-6 text-spinny-orange bg-white border-gray-200 rounded focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        {(seller.featuredCredits || 0) <= 0 && <p className="text-xs text-spinny-orange mt-2">You have no featured credits. Upgrade your plan to get more.</p>}
                    </div>
                )}
            </FormFieldset>

            <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
                <button 
                    type="submit" 
                    disabled={!editingVehicle && isPlanExpired} 
                    className={`w-full sm:w-auto flex-grow font-bold py-3 px-6 rounded-lg text-lg ${
                        !editingVehicle && isPlanExpired 
                            ? 'opacity-50 cursor-not-allowed btn-brand-primary' 
                            : 'btn-brand-primary'
                    }`}
                > 
                    {editingVehicle ? 'Update Vehicle' : 'List My Vehicle'} 
                </button>
                <button type="button" onClick={onCancel} className="w-full sm:w-auto bg-white0 text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-white">Cancel</button>
            </div>
          </form>

          <div className="hidden lg:block">
              <div className="sticky top-24 self-start space-y-6">
                  <div>
                      <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">Live Preview</h3>
                      <div className="pointer-events-none">
                         <VehicleCard vehicle={previewVehicle} onSelect={() => {}} onToggleCompare={() => {}} isSelectedForCompare={false} onToggleWishlist={() => {}} isInWishlist={false} isCompareDisabled={true} onViewSellerProfile={() => {}} onQuickView={() => {}} />
                      </div>
                  </div>
                   {aiSuggestions && Object.keys(aiSuggestions.featureSuggestions).length > 0 && (
                     <div>
                        <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4 flex items-center gap-2">✨ Suggested Features</h3>
                        <div className="bg-brand-gray-light dark:bg-white p-4 rounded-lg border dark:border-gray-200-200 max-h-96 overflow-y-auto">
                            {Object.entries(aiSuggestions.featureSuggestions).map(([category, features]) => {
                                if (!Array.isArray(features) || features.length === 0) return null;
                                return (
                                    <div key={category} className="mb-4 last:mb-0">
                                        <h4 className="font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-2 pb-1 border-b dark:border-gray-200-300">{category}</h4>
                                        <div className="space-y-2">
                                            {features.map(feature => (
                                                <label key={feature} className="flex items-center space-x-3 cursor-pointer group">
                                                    <input type="checkbox" checked={formData.features.includes(feature)} onChange={() => handleSuggestedFeatureToggle(feature)} className="h-4 w-4 rounded border-gray-200 dark:border-gray-500 bg-transparent" style={{ accentColor: '#FF6B35' }} />
                                                    <span className="text-sm text-spinny-text-dark dark:text-spinny-text-dark transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--spinny-orange)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>{feature}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
              </div>
          </div>
        </div>
      </div>
    );
});

const InquiriesView: React.FC<{
  conversations: Conversation[];
  sellerEmail: string;
  onMarkConversationAsReadBySeller: (conversationId: string) => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onSelectConv: (conv: Conversation) => void;

}> = memo(({ conversations, sellerEmail, onMarkConversationAsReadBySeller, onMarkMessagesAsRead, onSelectConv }) => {

    const handleSelectConversation = (conv: Conversation) => {
      onSelectConv(conv);
      if(!conv.isReadBySeller) {
        onMarkConversationAsReadBySeller(conv.id);
        onMarkMessagesAsRead(conv.id, 'seller');
      }
    };
    
    // Removed unused test drive handlers

    const sortedConversations = useMemo(() => {
        // Filter conversations to only show those for the current seller
        if (!conversations || !Array.isArray(conversations) || !sellerEmail) return [];
        // Normalize emails for case-insensitive comparison (critical for production)
        const normalizedSellerEmail = (sellerEmail || '').toLowerCase().trim();
        const sellerConversations = conversations.filter(conv => {
          if (!conv || !conv.sellerId) return false;
          const normalizedConvSellerId = (conv.sellerId || '').toLowerCase().trim();
          return normalizedConvSellerId === normalizedSellerEmail;
        });
        return [...sellerConversations].sort((a, b) => {
          const dateA = a?.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const dateB = b?.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return dateB - dateA;
        });
    }, [conversations, sellerEmail]);

    return (
       <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
         <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-6">Customer Inquiries</h2>
         <div className="space-y-2">
            {sortedConversations.length > 0 ? sortedConversations.map(conv => {
              if (!conv) return null;
              const lastMessage = conv.messages && Array.isArray(conv.messages) && conv.messages.length > 0 
                ? conv.messages[conv.messages.length - 1] 
                : null;
              const lastMessageTime = conv.lastMessageAt 
                ? new Date(conv.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                : 'N/A';
              return (
              <div key={conv.id} onClick={() => handleSelectConversation(conv)} className="p-4 rounded-lg cursor-pointer hover:bg-brand-gray-light dark:hover:bg-white border-b dark:border-gray-200-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {!conv.isReadBySeller && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#FF6B35' }}></div>}
                    <div>
                      <p className="font-bold text-spinny-text-dark dark:text-spinny-text-dark">
                        {conv.customerName || 'Unknown'} - <span className="font-normal text-spinny-text-dark dark:text-spinny-text-dark">{conv.vehicleName || 'Unknown Vehicle'}</span>
                      </p>
                      <p className="text-sm text-spinny-text-dark dark:text-spinny-text-dark truncate max-w-md">
                        {lastMessage?.text || 'New conversation'}
                      </p>
                    </div>
                </div>
                <span className="text-xs text-spinny-text-dark dark:text-spinny-text-dark">{lastMessageTime}</span>
              </div>
            );
            }) : (
                <div className="text-center py-16 px-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-spinny-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h3 className="mt-2 text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">No inquiries yet</h3>
                    <p className="mt-1 text-sm text-spinny-text-dark dark:text-spinny-text-dark">When a customer sends a message about one of your listings, it will appear here.</p>
                </div>
            )}
         </div>
       </div>
    );
});




const ReportsView: React.FC<{
    reportedVehicles: Vehicle[];
    onEditVehicle: (vehicle: Vehicle) => void;
    onDeleteVehicle: (vehicleId: number) => void;
}> = memo(({ reportedVehicles, onEditVehicle, onDeleteVehicle }) => {
    // Create safe version locally within this component
    const safeReportedVehicles = reportedVehicles || [];
    
    return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-6">Reported Listings</h2>
        {safeReportedVehicles.length > 0 ? (
            <div className="space-y-4">
                {safeReportedVehicles.map(v => (
                    <div key={v.id} className="border border-gray-200 dark:border-gray-200 bg-spinny-blue-light dark:bg-spinny-blue/20 p-4 rounded-lg">
                        <h3 className="font-bold text-spinny-text-dark dark:text-spinny-text-dark">{v.year} {v.make} {v.model}</h3>
                        <p className="text-sm text-spinny-text-dark dark:text-spinny-text-dark mt-1">Reported on: {v.flaggedAt ? new Date(v.flaggedAt).toLocaleString() : 'N/A'}</p>
                        <p className="mt-2 text-sm italic text-spinny-text-dark dark:text-spinny-text-dark">Reason: "{v.flagReason || 'No reason provided.'}"</p>
                        <p className="text-xs text-spinny-text-dark dark:text-spinny-text-dark mt-2">An administrator will review this report. You can edit the listing to correct any issues or delete it if it's no longer valid.</p>
                        <div className="mt-3 space-x-4">
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEditVehicle(v);
                                }} 
                                className="font-semibold text-sm hover:underline transition-colors cursor-pointer" 
                                style={{ color: '#FF6B35' }} 
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--spinny-blue)'} 
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--spinny-orange)'}
                            > 
                                Edit Listing
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDeleteVehicle(v.id);
                                }} 
                                className="text-spinny-orange font-semibold text-sm hover:underline cursor-pointer"
                            >
                                Delete Listing
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
             <div className="text-center py-16 px-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-spinny-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="mt-2 text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">All Clear!</h3>
                <p className="mt-1 text-sm text-spinny-text-dark dark:text-spinny-text-dark">You have no reported listings at this time.</p>
            </div>
        )}
    </div>
    );
});


// Main Dashboard Component
const Dashboard: React.FC<DashboardProps> = ({ seller, sellerVehicles, reportedVehicles, onAddVehicle, onAddMultipleVehicles, onUpdateVehicle, onDeleteVehicle, onMarkAsSold, onMarkAsUnsold, conversations, onSellerSendMessage, onMarkConversationAsReadBySeller, typingStatus, onUserTyping, onMarkMessagesAsRead, onUpdateSellerProfile, vehicleData, onFeatureListing, onRequestCertification, onNavigate, onTestDriveResponse, allVehicles, onOfferResponse, onViewVehicle }) => {
  // Note: onRequestCertification, and onTestDriveResponse are part of the interface contract
  // but are not currently used in this component. They may be used in future features or passed to child components.
  void onRequestCertification;
  void onTestDriveResponse;
  
  // CRITICAL: All hooks must be called before any conditional returns (React Rules of Hooks)
  // Initialize all state hooks first
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  // NEW: Boost listing feature
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [vehicleToBoost, setVehicleToBoost] = useState<Vehicle | null>(null);
  // Pagination state for Active Listings
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  // Month selector state for analytics
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  
  // Production error logging helper (must be after hooks)
  const logProductionError = useCallback((error: Error | unknown, context: string) => {
    const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
    if (isProduction) {
      console.error(`[Dashboard Error] ${context}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sellerEmail: seller?.email,
        timestamp: new Date().toISOString()
      });
    } else if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ ${context}:`, error);
    }
  }, [seller?.email]);

  // Safety checks: Ensure arrays are initialized and validate all props (must be after hooks)
  const safeSellerVehicles = useMemo(() => Array.isArray(sellerVehicles) ? sellerVehicles : [], [sellerVehicles]);
  const safeConversations = useMemo(() => Array.isArray(conversations) ? conversations : [], [conversations]);
  const safeReportedVehicles = useMemo(() => Array.isArray(reportedVehicles) ? reportedVehicles : [], [reportedVehicles]);
  const safeVehicleData = useMemo(() => {
    const result = vehicleData && typeof vehicleData === 'object' && Object.keys(vehicleData).length > 0 
      ? vehicleData 
      : {
          'four-wheeler': [],
          'two-wheeler': [],
          'three-wheeler': []
        };
    return result;
  }, [vehicleData]);

  // Check Firebase connection status (only in browser, not SSR)
  const [databaseStatus, setDatabaseStatus] = useState<{ available: boolean; error?: string; details?: string } | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Safely get Firebase status - wrap in try-catch to prevent crashes
        // Firebase removed - using Supabase
        const status = { available: true };
        setDatabaseStatus(status);
      } catch (error) {
        // If Firebase status check fails, set a safe default
        // Don't throw - just log and continue
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn('⚠️ Dashboard: Failed to check Firebase status:', errorMessage);
        setDatabaseStatus({ 
          available: false, 
          error: 'Unable to check Firebase status',
          details: errorMessage
        });
      }
    }
  }, []);

  // Guard against missing seller (AFTER all hooks)
  if (!seller || !seller.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Seller Information Missing</h2>
          <p className="text-gray-600 mb-6">Unable to load dashboard. Please try logging in again.</p>
          <button
            onClick={() => onNavigate(View.SELLER_LOGIN)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }
  
  // Ensure all callback functions are defined (AFTER all hooks)
  if (!onAddVehicle || !onUpdateVehicle || !onDeleteVehicle || !onMarkAsSold) {
    console.error('❌ Dashboard: Missing required callback functions');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration Error</h2>
          <p className="text-gray-600 mb-6">Dashboard is missing required functions. Please contact support.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
  
  // Refresh user data from API to get updated plan expiry date
  // FIXED: Removed window.location.reload() to prevent crashes - now uses localStorage update only
  useEffect(() => {
    // Only refresh if seller is authenticated
    if (!seller || !seller.email) {
      return;
    }
    
    let isMounted = true; // Track if component is still mounted
    let refreshTimeout: NodeJS.Timeout | null = null;
    
    const refreshUserData = async () => {
      // Prevent refresh if component is unmounted
      if (!isMounted) {
        return;
      }
      
      try {
        // Validate seller object before making API call
        if (!seller || !seller.email || typeof seller.email !== 'string') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Invalid seller object, skipping user data refresh');
          }
          return;
        }
        
        // Wrap authenticatedFetch in additional error handling to catch network errors
        let response: Response;
        try {
          // Use authenticatedFetch to include JWT token for production API
          // Include token if available (user is logged in, so token should exist)
          // This prevents 401 errors from middleware/proxy layers in production
          // GET /api/users doesn't validate the token, but including it prevents proxy rejection
          response = await authenticatedFetch('/api/users');
          
          // Handle 401 gracefully - don't show error, just skip refresh
          if (response.status === 401) {
            if (process.env.NODE_ENV === 'development' && isMounted) {
              console.warn('⚠️ User data refresh skipped: Authentication required');
            }
            return; // Exit early on 401
          }
        } catch (fetchError) {
          // Catch network errors, CORS errors, or any other fetch-related errors
          // Don't throw - just silently fail to prevent ErrorBoundary from catching
          if (process.env.NODE_ENV === 'development' && isMounted) {
            console.warn('⚠️ Network error during user data refresh:', fetchError);
          }
          return; // Exit early on fetch errors
        }
        
        // Check if component is still mounted after async operation
        if (!isMounted) {
          return;
        }
        
        // Validate response object exists
        if (!response || typeof response !== 'object') {
          if (process.env.NODE_ENV === 'development' && isMounted) {
            console.warn('⚠️ Invalid response object from authenticatedFetch');
          }
          return;
        }
        
        if (response.ok) {
          // Check content type before parsing
          const contentType = response.headers?.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ API returned non-JSON response, skipping user refresh');
            }
            return;
          }
          
          let users;
          try {
            users = await response.json();
          } catch (jsonError) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ Failed to parse JSON response:', jsonError);
            }
            return;
          }
          
          // Check if component is still mounted after async operation
          if (!isMounted) {
            return;
          }
          
          if (Array.isArray(users) && seller?.email) {
            // Normalize emails for comparison (critical for production)
            const normalizedSellerEmail = seller.email.toLowerCase().trim();
            const updatedSeller = users.find((u: User) => {
              if (!u || !u.email) return false;
              return u.email.toLowerCase().trim() === normalizedSellerEmail;
            });
            if (updatedSeller) {
              // Check if plan expiry date has changed
              const currentExpiry = seller.planExpiryDate;
              const newExpiry = updatedSeller.planExpiryDate;
              
              // Only update if expiry date actually changed
              if (currentExpiry !== newExpiry || 
                  updatedSeller.planActivatedDate !== seller.planActivatedDate ||
                  updatedSeller.subscriptionPlan !== seller.subscriptionPlan) {
                try {
                  // Update localStorage with fresh user data
                  // FIXED: Removed window.location.reload() - localStorage update is sufficient
                  // The App component will pick up the change through its own refresh mechanism
                  localStorage.setItem('reRideCurrentUser', JSON.stringify(updatedSeller));
                  
                  // Dispatch a custom event to notify other components of the update
                  // This allows the app to update without a full page reload
                  window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { user: updatedSeller } 
                  }));
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log('✅ User data updated in localStorage (plan expiry changed)');
                  }
                } catch (storageError) {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('⚠️ Failed to update localStorage:', storageError);
                  }
                }
              }
            }
          }
        } else {
          // Log non-OK responses but don't throw errors (except 401 which is handled above)
          if (response.status !== 401 && process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ User refresh API returned ${response.status}: ${response.statusText}`);
          }
        }
      } catch (error) {
        // Log errors in production for debugging
        if (isMounted) {
          logProductionError(error, 'Failed to refresh user data');
        }
        // Don't throw - silently fail to prevent dashboard crash
      }
    };

    // Refresh user data when component mounts and every 60 seconds (increased from 30 to reduce load)
    // FIXED: Only refresh on mount, not on every dependency change to prevent loops
    refreshUserData();
    refreshTimeout = setInterval(() => {
      if (isMounted) {
        refreshUserData();
      }
    }, 60000); // Refresh every 60 seconds (reduced frequency)
    
    return () => {
      isMounted = false; // Mark as unmounted
      if (refreshTimeout) {
        clearInterval(refreshTimeout);
      }
    };
  }, [seller.email, seller.planExpiryDate, seller.planActivatedDate, seller.subscriptionPlan]); // FIXED: Include all plan-related fields to prevent stale closures
  
  // Location data is now handled by individual components that need it
  
  // Helper function to filter vehicles by month
  const filterVehiclesByMonth = useCallback((vehicles: Vehicle[], month: string): Vehicle[] => {
    if (month === 'all') return vehicles;
    
    const [year, monthNum] = month.split('-');
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);
    
    return vehicles.filter(v => {
      const vehicleDate = v.createdAt ? new Date(v.createdAt) : null;
      if (!vehicleDate) return false;
      return vehicleDate >= startDate && vehicleDate <= endDate;
    });
  }, []);
  
  // Generate month options for the last 12 months
  const getMonthOptions = useCallback(() => {
    const months: { value: string; label: string }[] = [{ value: 'all', label: 'All Time' }];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      months.push({ value: monthValue, label: monthLabel });
    }
    
    return months;
  }, []);


  // Refresh vehicle data from API when form view is opened or when editing a vehicle
  useEffect(() => {
    if (activeView === 'form' || editingVehicle) {
      const refreshVehicleData = async () => {
        try {
          // Validate that we have a valid seller before fetching data
          if (!seller || !seller.email) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ Cannot refresh vehicle data: seller information missing');
            }
            return;
          }

          const { getVehicleData } = await import('../services/vehicleDataService');
          const freshData = await getVehicleData();
          
          // Validate the data before using it
          if (freshData && typeof freshData === 'object' && Object.keys(freshData).length > 0) {
            try {
              // Update localStorage to trigger storage event for other tabs
              localStorage.setItem('reRideVehicleData', JSON.stringify(freshData));
              // Dispatch custom event for same-tab sync
              window.dispatchEvent(new CustomEvent('vehicleDataUpdated', { detail: { vehicleData: freshData } }));
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Vehicle data refreshed when opening form');
              }
            } catch (storageError) {
              // Log storage errors but don't crash
              logProductionError(storageError, 'Failed to save vehicle data to localStorage');
            }
          } else {
            logProductionError(new Error('Invalid vehicle data structure'), 'Vehicle data refresh returned invalid data');
          }
        } catch (error) {
          // Log errors but don't crash the dashboard
          logProductionError(error, 'Failed to refresh vehicle data when opening form');
        }
      };
      refreshVehicleData();
    }
  }, [activeView, editingVehicle, seller]);

  useEffect(() => {
    // FIXED: Added safety checks to prevent crashes
    if (selectedConv && safeConversations && Array.isArray(safeConversations)) {
        try {
            const updatedConversation = safeConversations.find(c => c && c.id && c.id === selectedConv.id);
            if (updatedConversation) {
                // Using stringify is a simple way to deep-compare for changes.
                // Added try-catch to handle circular references or serialization errors
                try {
                    if (JSON.stringify(updatedConversation) !== JSON.stringify(selectedConv)) {
                        setSelectedConv(updatedConversation);
                    }
                } catch (stringifyError) {
                    // If stringify fails, do a shallow comparison instead
                    if (updatedConversation.messages?.length !== selectedConv.messages?.length ||
                        updatedConversation.isReadBySeller !== selectedConv.isReadBySeller) {
                        setSelectedConv(updatedConversation);
                    }
                }
            } else {
                // The selected conversation is no longer in the list, so deselect it.
                setSelectedConv(null);
            }
        } catch (error) {
            // Silently handle errors to prevent crashes
            if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Error updating selected conversation:', error);
            }
        }
    }
  }, [safeConversations, selectedConv]);

  const handleNavigate = (view: DashboardView) => {
    if (view !== 'inquiries') {
        setSelectedConv(null);
    }
    setActiveView(view);
  };

  const handleRefreshVehicle = async (vehicleId: number) => {
    try {
      const response = await authenticatedFetch('/api/vehicles?action=refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'refresh',
          vehicleId, 
          refreshAction: 'refresh', 
          sellerEmail: seller?.email 
        })
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              // Update local state instead of reloading page
              onUpdateVehicle(result.vehicle);
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Vehicle refreshed successfully');
              }
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse refresh response:', jsonError);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Failed to refresh vehicle: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error refreshing vehicle:', error);
      }
    }
  };

  const handleRenewVehicle = async (vehicleId: number) => {
    try {
      const response = await authenticatedFetch('/api/vehicles?action=refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'refresh',
          vehicleId, 
          refreshAction: 'renew', 
          sellerEmail: seller?.email 
        })
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              // Update local state instead of reloading page
              onUpdateVehicle(result.vehicle);
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Vehicle renewed successfully');
              }
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse renew response:', jsonError);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Failed to renew vehicle: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error renewing vehicle:', error);
      }
    }
  };

  const handleCertifyVehicle = async (vehicleId: number) => {
    try {
      const response = await authenticatedFetch('/api/vehicles?action=certify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId })
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              // Update local state
              onUpdateVehicle(result.vehicle);
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Certification request submitted');
              }
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse certification response:', jsonError);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Failed to submit certification request: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error submitting certification request:', error);
      }
    }
  };

  const handleMarkAsSold = async (vehicleId: number) => {
    try {
      const response = await authenticatedFetch('/api/vehicles?action=sold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId })
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              // Update local state
              onUpdateVehicle(result.vehicle);
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Vehicle marked as sold');
              }
            } else if (result && result.reason) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Failed to mark vehicle as sold:', result.reason);
              }
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse sold response:', jsonError);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          try {
            const errorText = await response.text();
            console.warn(`⚠️ Failed to mark vehicle as sold: ${response.status} ${errorText}`);
          } catch (textError) {
            console.warn(`⚠️ Failed to mark vehicle as sold: ${response.status}`);
          }
        }
      }
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error marking vehicle as sold:', error);
      }
    }
  };

  const handleMarkAsUnsold = async (vehicleId: number) => {
    try {
      // Use the onMarkAsUnsold prop if available (handles through App.tsx with proper state updates and toast notifications)
      if (onMarkAsUnsold) {
        await onMarkAsUnsold(vehicleId);
        return;
      }

      // Fallback: direct API call if prop not available
      const response = await authenticatedFetch('/api/vehicles?action=unsold', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicleId })
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              // Update local state
              onUpdateVehicle(result.vehicle);
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Vehicle marked as unsold');
              }
            } else if (result && result.reason) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Failed to mark vehicle as unsold:', result.reason);
              }
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse unsold response:', jsonError);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          try {
            const errorText = await response.text();
            console.warn(`⚠️ Failed to mark vehicle as unsold: ${response.status} ${errorText}`);
          } catch (textError) {
            console.warn(`⚠️ Failed to mark vehicle as unsold: ${response.status}`);
          }
        }
      }
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error marking vehicle as unsold:', error);
      }
      // Error is logged, but UI feedback should come from App.tsx via onMarkAsUnsold prop
      if (!onMarkAsUnsold) {
        // Only show alert if prop is not available (shouldn't happen in normal flow)
        alert(error instanceof Error ? error.message : 'Failed to mark vehicle as unsold. Please try again.');
      }
    }
  };

  const handleFeatureVehicle = async (vehicleId: number) => {
    console.log('🚀 handleFeatureVehicle called for vehicle:', vehicleId);
    try {
      await onFeatureListing(vehicleId);
    } catch (error) {
      console.error('❌ Error featuring vehicle via callback:', error);
    }
  };
  
  const handleEditClick = (vehicle: Vehicle) => {
    // FIXED: Added safety check to prevent crashes
    if (!vehicle || !vehicle.id) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Attempted to edit invalid vehicle');
      }
      return;
    }
    try {
      setEditingVehicle(vehicle);
      handleNavigate('form');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleEditClick:', error);
      }
    }
  };
  
  const handleAddNewClick = () => {
    try {
      setEditingVehicle(null);
      handleNavigate('form');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleAddNewClick:', error);
      }
    }
  }

  const handleFormCancel = () => {
    try {
      setEditingVehicle(null);
      handleNavigate('listings');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleFormCancel:', error);
      }
    }
  }

  const handleNavigateToVehicle = (vehicleId: number) => {
    // FIXED: Added safety checks
    if (!vehicleId || !Number.isInteger(vehicleId)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Invalid vehicleId provided:', vehicleId);
      }
      return;
    }
    try {
      const vehicle = safeSellerVehicles.find(v => v && v.id === vehicleId);
      if (vehicle) {
        handleEditClick(vehicle);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleNavigateToVehicle:', error);
      }
    }
  };

  const handleNavigateToInquiry = (conversationId: string) => {
    // FIXED: Added safety checks
    if (!conversationId || typeof conversationId !== 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Invalid conversationId provided:', conversationId);
      }
      return;
    }
    try {
      const conv = safeConversations.find(c => c && c.id === conversationId);
      if (conv) {
        setSelectedConv(conv);
        handleNavigate('inquiries');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleNavigateToInquiry:', error);
      }
    }
  };

  const unreadCount = useMemo(() => {
    if (!seller?.email) return 0;
    const normalizedSellerEmail = seller.email.toLowerCase().trim();
    return safeConversations.filter(c => {
      if (!c || c.isReadBySeller || !c.sellerId) return false;
      return c.sellerId.toLowerCase().trim() === normalizedSellerEmail;
    }).length;
  }, [safeConversations, seller?.email]);
  const activeListings = useMemo(() => safeSellerVehicles.filter(v => v && v.status !== 'sold'), [safeSellerVehicles]);
  const soldListings = useMemo(() => safeSellerVehicles.filter(v => v && v.status === 'sold'), [safeSellerVehicles]);
  const reportedCount = useMemo(() => safeReportedVehicles.length, [safeReportedVehicles]);
  
  // Pagination for sold listings (Sales History)
  const [soldPage, setSoldPage] = useState(1);
  const SOLD_PAGE_SIZE = 10;
  const totalSoldPages = Math.max(1, Math.ceil(soldListings.length / SOLD_PAGE_SIZE));
  const paginatedSoldListings = useMemo(() => {
    const start = (soldPage - 1) * SOLD_PAGE_SIZE;
    return soldListings.slice(start, start + SOLD_PAGE_SIZE);
  }, [soldListings, soldPage]);
  useEffect(() => {
    // Reset to first page whenever the underlying list changes
    setSoldPage(1);
  }, [soldListings]);
  
  // Filter listings by selected month for analytics
  const filteredActiveListings = useMemo(() => 
    filterVehiclesByMonth(activeListings, selectedMonth), 
    [activeListings, selectedMonth, filterVehiclesByMonth]
  );
  const filteredSoldListings = useMemo(() => 
    filterVehiclesByMonth(soldListings, selectedMonth), 
    [soldListings, selectedMonth, filterVehiclesByMonth]
  );
  
  // Pagination calculations for Active Listings
  const totalPages = useMemo(() => Math.ceil(activeListings.length / itemsPerPage), [activeListings.length, itemsPerPage]);
  const paginatedListings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return activeListings.slice(startIndex, endIndex);
  }, [activeListings, currentPage, itemsPerPage]);
  
  // Reset to page 1 when listings change or view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeListings.length, activeView]);
  
  const analyticsData = useMemo(() => {
    // FIXED: Added safety checks to prevent crashes from null/undefined data
    try {
      const safeFilteredSoldListings = Array.isArray(filteredSoldListings) ? filteredSoldListings : [];
      const safeFilteredActiveListings = Array.isArray(filteredActiveListings) ? filteredActiveListings : [];
      
      const totalSalesValue = safeFilteredSoldListings.reduce((sum: number, v) => {
        if (!v || typeof v.price !== 'number') return sum;
        return sum + v.price;
      }, 0);
      
      const totalViews = safeFilteredActiveListings.reduce((sum, v) => {
        if (!v || typeof v.views !== 'number') return sum;
        return sum + v.views;
      }, 0);
      
      const totalInquiries = safeFilteredActiveListings.reduce((sum, v) => {
        if (!v || typeof v.inquiriesCount !== 'number') return sum;
        return sum + v.inquiriesCount;
      }, 0);
      
      const chartLabels = safeFilteredActiveListings.map(v => {
        if (!v) return '';
        const year = v.year || '';
        const model = v.model || '';
        const variant = v.variant || '';
        return `${year} ${model} ${variant}`.trim().slice(0, 25);
      }).filter(label => label.length > 0);
      
      const chartData = {
        labels: chartLabels,
        datasets: [
          {
            label: 'Views',
            data: safeFilteredActiveListings.map(v => (v && typeof v.views === 'number') ? v.views : 0),
            backgroundColor: 'rgba(255, 107, 53, 0.5)',
            borderColor: 'rgba(255, 107, 53, 1)',
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            label: 'Inquiries',
            data: safeFilteredActiveListings.map(v => (v && typeof v.inquiriesCount === 'number') ? v.inquiriesCount : 0),
            backgroundColor: 'rgba(30, 136, 229, 0.5)',
            borderColor: 'rgba(30, 136, 229, 1)',
            borderWidth: 1,
            yAxisID: 'y1',
          },
        ],
      };
      return { totalSalesValue, totalViews, totalInquiries, chartData };
    } catch (error) {
      // Return safe defaults if computation fails
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Error computing analytics data:', error);
      }
      return {
        totalSalesValue: 0,
        totalViews: 0,
        totalInquiries: 0,
        chartData: {
          labels: [],
          datasets: [
            { label: 'Views', data: [], backgroundColor: 'rgba(255, 107, 53, 0.5)', borderColor: 'rgba(255, 107, 53, 1)', borderWidth: 1, yAxisID: 'y' },
            { label: 'Inquiries', data: [], backgroundColor: 'rgba(30, 136, 229, 0.5)', borderColor: 'rgba(30, 136, 229, 1)', borderWidth: 1, yAxisID: 'y1' }
          ]
        }
      };
    }
  }, [filteredActiveListings, filteredSoldListings]);

  const getCertificationButton = (vehicle: Vehicle) => {
        const status = vehicle.certificationStatus || 'none';
        switch (status) {
            case 'requested':
                return <button type="button" disabled className="px-1.5 py-0.5 text-spinny-text-dark text-xs border border-gray-300 rounded opacity-50" title="Certification pending approval">🕐 Pending</button>;
            case 'approved':
                return <span className="px-1.5 py-0.5 text-spinny-green text-xs border border-spinny-green rounded bg-spinny-green-light" title="Vehicle is certified">✅ Certified</span>;
            case 'rejected':
                return <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCertifyVehicle(vehicle.id);
                  }} 
                  className="px-1.5 py-0.5 text-spinny-orange hover:text-spinny-orange text-xs border border-spinny-orange rounded hover:bg-spinny-orange-light cursor-pointer" 
                  title="Certification was rejected, you can request again."
                >🔄 Retry</button>;
            case 'none':
            default:
                return <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCertifyVehicle(vehicle.id);
                  }} 
                  className="px-1.5 py-0.5 text-teal-600 hover:text-teal-800 text-xs border border-teal-600 rounded hover:bg-teal-50 cursor-pointer" 
                  title="Request a certified inspection report"
                >🛡️ Certify</button>;
        }
    };

  const renderContent = () => {
    switch(activeView) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard title="Active Listings" value={activeListings.length} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17v-2a4 4 0 00-4-4h-1.5m1.5 4H13m-2 0a2 2 0 104 0 2 2 0 00-4 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 11V7a4 4 0 00-4-4H7a4 4 0 00-4 4v4" /></svg>} />
              <StatCard title="Unread Messages" value={unreadCount} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} />
              <StatCard title="Your Seller Rating" value={`${(seller && typeof seller.averageRating === 'number' ? seller.averageRating : 0).toFixed(1)} (${seller && typeof seller.ratingCount === 'number' ? seller.ratingCount : 0})`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.522 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.522 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.522-4.674a1 1 0 00-.363-1.118L2.98 8.11c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.522-4.674z" /></svg>} />
            </div>
            <PlanStatusCard
              seller={seller}
              activeListingsCount={activeListings.length}
              featuredListingsCount={safeSellerVehicles.filter(v => v && v.isFeatured).length}
              onNavigate={onNavigate}
            />
            <PaymentStatusCard currentUser={seller} />
            <AiAssistant
              vehicles={activeListings}
              conversations={safeConversations.filter(c => {
                if (!c || !c.sellerId || !seller?.email) return false;
                return c.sellerId.toLowerCase().trim() === seller.email.toLowerCase().trim();
              })}
              onNavigateToVehicle={handleNavigateToVehicle}
              onNavigateToInquiry={handleNavigateToInquiry}
            />
          </div>
        );
      case 'analytics':
        return (
            <div className="space-y-6">
                {/* Month Selector */}
                <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
                    <h2 className="text-xl font-bold text-spinny-text-dark dark:text-spinny-text-dark">Analytics Overview</h2>
                    <div className="flex items-center gap-3">
                        <label htmlFor="month-selector" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            Filter by Month:
                        </label>
                        <select
                            id="month-selector"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white text-spinny-text-dark focus:outline-none focus:ring-2 focus:ring-spinny-orange focus:border-transparent"
                        >
                            {getMonthOptions().map(month => (
                                <option key={month.value} value={month.value}>{month.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Active Listings" value={filteredActiveListings.length} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17v-2a4 4 0 00-4-4h-1.5m1.5 4H13m-2 0a2 2 0 104 0 2 2 0 00-4 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 11V7a4 4 0 00-4-4H7a4 4 0 00-4 4v4" /></svg>} />
                    <StatCard title="Total Sales Value" value={formatSalesValue(analyticsData.totalSalesValue)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
                    <StatCard title="Total Views" value={analyticsData.totalViews.toLocaleString('en-IN')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057 5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
                    <StatCard title="Total Inquiries" value={analyticsData.totalInquiries.toLocaleString('en-IN')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} />
                </div>
                
                {/* Boost Analytics */}
                {(() => {
                  const activeBoosts = safeSellerVehicles.flatMap(v => 
                    v && v.activeBoosts ? v.activeBoosts.filter(boost => boost.isActive && new Date(boost.expiresAt) > new Date()) : []
                  );
                  
                  if (activeBoosts.length > 0) {
                    return (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span>🚀</span>
                            Active Boost Campaigns
                          </h3>
                          <span className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            {activeBoosts.length} Active
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {activeBoosts.map(boost => {
                            const vehicle = safeSellerVehicles.find(v => v && v.activeBoosts?.some(b => b.id === boost.id));
                            const daysLeft = Math.ceil((new Date(boost.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            
                            return (
                              <div key={boost.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">
                                    {boost.type === 'homepage_spotlight' ? '⭐' : 
                                     boost.type === 'top_search' ? '🔝' : 
                                     boost.type === 'featured_badge' ? '🏆' : 
                                     boost.type === 'multi_city' ? '🌍' : '🚀'}
                                  </span>
                                  <span className="font-semibold text-sm capitalize">{boost.type.replace('_', ' ')}</span>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">
                                  {vehicle?.year} {vehicle?.make} {vehicle?.model}
                                </p>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">{daysLeft} days left</span>
                                  <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                                      style={{ width: `${Math.max(0, Math.min(100, (daysLeft / 30) * 100))}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-6">Listing Performance</h2>
                    {filteredActiveListings.length > 0 ? (
                        (() => {
                          try {
                            // Safety check: ensure chartData is valid before rendering
                            if (!analyticsData?.chartData || !analyticsData.chartData.labels || !analyticsData.chartData.datasets) {
                              return (
                                <div className="text-center py-16 px-6">
                                  <h3 className="mt-2 text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">Chart Data Unavailable</h3>
                                  <p className="mt-1 text-sm text-spinny-text-dark dark:text-spinny-text-dark">
                                    Unable to load chart data. Please refresh the page.
                                  </p>
                                </div>
                              );
                            }
                            
                            // Check if Chart.js is available
                            if (typeof ChartJS === 'undefined' || typeof Bar === 'undefined') {
                              return (
                                <div className="text-center py-16 px-6">
                                  <h3 className="mt-2 text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">Chart Library Not Loaded</h3>
                                  <p className="mt-1 text-sm text-spinny-text-dark dark:text-spinny-text-dark">
                                    Please refresh the page to load the chart library.
                                  </p>
                                </div>
                              );
                            }
                            
                            return (
                              <Bar 
                                  data={analyticsData.chartData} 
                                  options={{ 
                                      responsive: true, 
                                      plugins: { 
                                          legend: { position: 'top' }, 
                                          title: { display: true, text: 'Views vs. Inquiries per Vehicle' } 
                                      },
                                      scales: {
                                          y: {
                                              type: 'linear',
                                              display: true,
                                              position: 'left',
                                              title: {
                                                  display: true,
                                                  text: 'Views'
                                              }
                                          },
                                          y1: {
                                              type: 'linear',
                                              display: true,
                                              position: 'right',
                                              title: {
                                                  display: true,
                                                  text: 'Inquiries'
                                              },
                                              grid: {
                                                  drawOnChartArea: false, // only want the grid lines for one axis to show up
                                              },
                                          },
                                      }
                                  }} 
                              />
                            );
                          } catch (chartError) {
                            // Log error but don't crash the dashboard
                            if (process.env.NODE_ENV === 'development') {
                              console.error('❌ Error rendering chart:', chartError);
                            }
                            return (
                              <div className="text-center py-16 px-6">
                                <h3 className="mt-2 text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">Chart Error</h3>
                                <p className="mt-1 text-sm text-spinny-text-dark dark:text-spinny-text-dark">
                                  Unable to display chart. Please refresh the page.
                                </p>
                              </div>
                            );
                          }
                        })()
                    ) : (
                        <div className="text-center py-16 px-6">
                            <h3 className="mt-2 text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">No Data to Display</h3>
                            <p className="mt-1 text-sm text-spinny-text-dark dark:text-spinny-text-dark">
                                {selectedMonth === 'all' 
                                    ? 'Add a vehicle to see performance data.' 
                                    : 'No data available for the selected month.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
      case 'listings':
        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark">Active Listings</h2>
              <div className="flex gap-2">
                <button onClick={() => setIsBulkUploadOpen(true)} className="bg-spinny-orange text-white font-bold py-2 px-4 rounded-lg hover:bg-spinny-orange">Bulk Upload</button>
                <button onClick={handleAddNewClick} className="btn-brand-primary text-white font-bold py-2 px-4 rounded-lg">List New Vehicle</button>
              </div>
            </div>
            {activeListings.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-white dark:bg-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                      {paginatedListings.map((v) => (
                      <tr 
                        key={v.id}
                        onClick={() => {
                          if (onViewVehicle) {
                            onViewVehicle(v);
                          }
                        }}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium">{v.year} {v.make} {v.model} {v.variant || ''}</td>
                        <td className="px-6 py-4">₹{v.price.toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <ListingLifecycleIndicator vehicle={v} seller={seller} compact={true} onRefresh={() => handleRefreshVehicle(v.id)} onRenew={() => handleRenewVehicle(v.id)} />
                            
                            {/* Boost Status Indicators */}
                            {v.activeBoosts?.filter(boost => boost.isActive && new Date(boost.expiresAt) > new Date()).map(boost => {
                              const getBoostIcon = (type: string) => {
                                switch (type) {
                                  case 'homepage_spotlight': return '⭐';
                                  case 'top_search': return '🔝';
                                  case 'featured_badge': return '🏆';
                                  case 'multi_city': return '🌍';
                                  default: return '🚀';
                                }
                              };
                              
                              const getBoostColor = (type: string) => {
                                switch (type) {
                                  case 'homepage_spotlight': return 'from-yellow-500 to-orange-500';
                                  case 'top_search': return 'from-blue-500 to-purple-500';
                                  case 'featured_badge': return 'from-green-500 to-teal-500';
                                  case 'multi_city': return 'from-indigo-500 to-blue-500';
                                  default: return 'from-gray-500 to-gray-600';
                                }
                              };
                              
                              const daysLeft = Math.ceil((new Date(boost.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                              
                              return (
                                <div key={boost.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white bg-gradient-to-r ${getBoostColor(boost.type)}`}>
                                  <span>{getBoostIcon(boost.type)}</span>
                                  <span className="capitalize">{boost.type.replace('_', ' ')}</span>
                                  <span>({daysLeft}d)</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td 
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Desktop Layout - 4+4 Grid */}
                          <div className="hidden lg:flex flex-col space-y-1">
                            {/* First Row - 4 buttons */}
                            <div className="flex items-center space-x-1">
                              <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setVehicleToBoost(v);
                                    setShowBoostModal(true);
                                  }} 
                                className="px-2 py-0.5 bg-spinny-orange text-white rounded hover:bg-orange-600 text-xs font-medium cursor-pointer" 
                                title="Boost for more visibility"
                              >
                                🚀 Boost
                              </button>
                              {!v.isFeatured && (seller.featuredCredits ?? 0) > 0 ? (
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleFeatureVehicle(v.id);
                                    }} 
                                  className="px-1.5 py-0.5 text-spinny-orange hover:text-spinny-orange text-xs border border-spinny-orange rounded hover:bg-spinny-orange-light cursor-pointer" 
                                  title="Use a credit to feature this listing"
                                >
                                  ⭐ Feature
                                </button>
                              ) : (
                                <div className="px-1.5 py-0.5 text-xs text-gray-400 border border-gray-300 rounded opacity-50">
                                  ⭐ Feature
                                </div>
                              )}
                            </div>
                            
                            {/* Second Row - 4 buttons */}
                            <div className="flex items-center space-x-1">
                              {getCertificationButton(v)}
                              <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('🔄 Mark as sold button clicked for vehicle:', v.id);
                                    handleMarkAsSold(v.id);
                                }} 
                                className="px-1.5 py-0.5 text-spinny-orange hover:text-spinny-orange text-xs border border-spinny-orange rounded hover:bg-spinny-orange-light cursor-pointer"
                              >
                                ✅ Sold
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('🔄 Edit vehicle button clicked for vehicle:', v.id);
                                    handleEditClick(v);
                                }} 
                                className="px-1.5 py-0.5 text-spinny-blue hover:text-spinny-blue text-xs border border-spinny-blue rounded hover:bg-spinny-blue-light cursor-pointer"
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('🔄 Delete vehicle button clicked for vehicle:', v.id);
                                    onDeleteVehicle(v.id);
                                }} 
                                className="px-1.5 py-0.5 text-red-600 hover:text-red-700 text-xs border border-red-600 rounded hover:bg-red-50 cursor-pointer"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                          
                          {/* Mobile/Tablet Layout - 4+4 Grid */}
                          <div className="lg:hidden">
                            <div className="flex flex-col space-y-1">
                              {/* First Row - 4 buttons */}
                              <div className="flex items-center space-x-1">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setVehicleToBoost(v);
                                      setShowBoostModal(true);
                                    }} 
                                  className="px-1.5 py-0.5 bg-spinny-orange text-white rounded text-xs cursor-pointer"
                                  title="Boost"
                                >
                                  🚀
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleFeatureVehicle(v.id);
                                    }} 
                                  className="px-1.5 py-0.5 text-spinny-orange text-xs border border-spinny-orange rounded cursor-pointer"
                                  title="Feature"
                                >
                                  ⭐
                                </button>
                              </div>
                              
                              {/* Second Row - 4 buttons */}
                              <div className="flex items-center space-x-1">
                                {getCertificationButton(v)}
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('🔄 Mark as sold button clicked for vehicle:', v.id);
                                      handleMarkAsSold(v.id);
                                  }} 
                                  className="px-1.5 py-0.5 text-spinny-orange text-xs border border-spinny-orange rounded cursor-pointer"
                                  title="Sold"
                                >
                                  ✅
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('🔄 Edit vehicle button clicked for vehicle:', v.id);
                                      handleEditClick(v);
                                  }} 
                                  className="px-1.5 py-0.5 text-spinny-blue text-xs border border-spinny-blue rounded cursor-pointer"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('🔄 Delete vehicle button clicked for vehicle:', v.id);
                                      onDeleteVehicle(v.id);
                                  }} 
                                  className="px-1.5 py-0.5 text-red-600 text-xs border border-red-600 rounded cursor-pointer"
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {activeListings.length > itemsPerPage && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(currentPage * itemsPerPage, activeListings.length)}</span> of{' '}
                        <span className="font-medium">{activeListings.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {(() => {
                          const pages: (number | string)[] = [];
                          
                          // Always show first page
                          pages.push(1);
                          
                          // Add ellipsis after first page if needed
                          if (currentPage > 3) {
                            pages.push('ellipsis-start');
                          }
                          
                          // Show pages around current page
                          for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                            if (i !== 1 && i !== totalPages) {
                              pages.push(i);
                            }
                          }
                          
                          // Add ellipsis before last page if needed
                          if (currentPage < totalPages - 2) {
                            pages.push('ellipsis-end');
                          }
                          
                          // Always show last page (if more than 1 page)
                          if (totalPages > 1) {
                            pages.push(totalPages);
                          }
                          
                          return pages.map((page) => {
                            if (typeof page === 'string') {
                              return (
                                <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  ...
                                </span>
                              );
                            }
                            
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  currentPage === page
                                    ? 'z-10 bg-spinny-orange border-spinny-orange text-white'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          });
                        })()}
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
              </>
            ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-200 dark:border-gray-200-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-spinny-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2-2H5a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="mt-2 text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">No vehicles listed yet</h3>
                    <p className="mt-1 text-sm text-spinny-text-dark dark:text-spinny-text-dark">Ready to sell? Add your first vehicle to get started.</p>
                    <div className="mt-6">
                        <button
                            onClick={handleAddNewClick}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white btn-brand-primary focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ boxShadow: 'var(--shadow-red)' }}
                        >
                            List Your First Vehicle
                        </button>
                    </div>
                </div>
            )}
          </div>
        );
      case 'salesHistory':
        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-6">Sales History</h2>
            {soldListings.length > 0 ? (
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-white dark:bg-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">Vehicle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">Sold Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedSoldListings.map((v) => (
                      <tr 
                        key={v.id}
                        onClick={() => {
                          if (onViewVehicle) {
                            onViewVehicle(v);
                          }
                        }}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium">{v.year} {v.make} {v.model} {v.variant || ''}</td>
                        <td className="px-6 py-4">₹{v.price.toLocaleString('en-IN')}</td>
                        <td 
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsUnsold(v.id);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100 hover:text-green-800 transition-colors"
                          >
                            Mark as Unsold
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination Controls */}
                {totalSoldPages > 1 && (
                  <div className="flex items-center justify-between mt-4 px-2">
                    <div className="text-xs text-gray-600">
                      Showing {(soldPage - 1) * SOLD_PAGE_SIZE + 1}
                      {' - '}
                      {Math.min(soldPage * SOLD_PAGE_SIZE, soldListings.length)} of {soldListings.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSoldPage(p => Math.max(1, p - 1))}
                        disabled={soldPage === 1}
                        className={`px-3 py-1.5 text-xs rounded-lg border ${soldPage === 1 ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed' : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-300'}`}
                      >
                        Previous
                      </button>
                      <span className="text-xs text-gray-600">
                        Page {soldPage} of {totalSoldPages}
                      </span>
                      <button
                        onClick={() => setSoldPage(p => Math.min(totalSoldPages, p + 1))}
                        disabled={soldPage === totalSoldPages}
                        className={`px-3 py-1.5 text-xs rounded-lg border ${soldPage === totalSoldPages ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed' : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-300'}`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
                <p className="text-center text-spinny-text-dark dark:text-spinny-text-dark py-8">You have not sold any vehicles yet.</p>
            )}
          </div>
        );
      case 'form':
        return <VehicleForm 
            seller={seller}
            editingVehicle={editingVehicle} 
            onAddVehicle={onAddVehicle} 
            onUpdateVehicle={onUpdateVehicle} 
            onCancel={handleFormCancel} 
            vehicleData={safeVehicleData} 
            onFeatureListing={onFeatureListing}
            allVehicles={allVehicles}
        />;
      case 'inquiries':
        return (
          <div className="space-y-6">
            <InquiriesView 
              conversations={safeConversations} 
              sellerEmail={seller.email}
              onMarkConversationAsReadBySeller={onMarkConversationAsReadBySeller} 
              onMarkMessagesAsRead={onMarkMessagesAsRead}
              onSelectConv={setSelectedConv}
            />
            {selectedConv && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <ChatWidget
                  conversation={selectedConv}
                  currentUserRole="seller"
                  otherUserName={selectedConv.customerName}
                  callTargetPhone={(() => {
                    const contact = users?.find?.(u => u && u.email && u.email.toLowerCase().trim() === selectedConv.customerId?.toLowerCase().trim());
                    return contact?.mobile || (contact as any)?.phone || '';
                  })()}
                  callTargetName={selectedConv.customerName}
                  isInlineLaunch={true}
                  onStartCall={(phone) => { if (phone) window.open(`tel:${phone}`); }}
                  onClose={() => setSelectedConv(null)}
                  onSendMessage={(messageText) => onSellerSendMessage(selectedConv.id, messageText)}
                  typingStatus={typingStatus}
                  onUserTyping={onUserTyping}
                  onMarkMessagesAsRead={onMarkMessagesAsRead}
                  onFlagContent={() => {}}
                  onOfferResponse={onOfferResponse}
                />
              </div>
            )}
          </div>
        );
      case 'settings':
        if (!seller) {
          return (
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
              <p className="text-gray-600">Loading seller information...</p>
            </div>
          );
        }
        return <SettingsView seller={seller} onUpdateSeller={onUpdateSellerProfile} />;
      case 'reports':
        return <ReportsView
                    reportedVehicles={safeReportedVehicles}
                    onEditVehicle={handleEditClick}
                    onDeleteVehicle={onDeleteVehicle}
                />;
      default:
        return (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">
              Page Not Found
            </h2>
            <p className="text-gray-600">The requested dashboard section could not be found.</p>
          </div>
        );
    }
  }

  const NavItem: React.FC<{ view: DashboardView, children: React.ReactNode, count?: number }> = ({ view, children, count }) => (
    <button 
      onClick={() => handleNavigate(view)} 
      className={`group flex justify-between items-center w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ${
        activeView === view 
          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105' 
          : 'text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <span className="font-medium">{children}</span>
      {count && count > 0 && (
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

  // Removed unused AppNavItem component

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-orange-200/15 to-pink-200/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      {/* Firebase Connection Status Banner */}
      {databaseStatus && !databaseStatus.available && (
        <div className="relative z-20 bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Database Connection Issue
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {(() => {
                    try {
                      // Supabase error message - Firebase removed
                      return databaseStatus?.error || 'Supabase database is not available. Please check your configuration.';
                    } catch (error) {
                      // Fallback error message
                      console.warn('⚠️ Error getting database error message:', error);
                      return 'Database is not available. Please check your configuration.';
                    }
                  })()}
                </p>
                {databaseStatus?.details && (
                  <p className="mt-1 text-xs">{databaseStatus.details}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="relative z-10 container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Premium Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 space-y-3 sticky top-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                  Dashboard
                </h3>
              </div>
              
              <NavItem view="overview">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"/>
                  </svg>
                  <span>Overview</span>
                </div>
              </NavItem>
              
              <NavItem view="analytics">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  <span>Analytics</span>
                </div>
              </NavItem>
              
              <NavItem view="listings">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                  <span>My Listings</span>
                </div>
              </NavItem>
              
              <NavItem view="reports" count={reportedCount}>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span>Reports</span>
                </div>
              </NavItem>
              
              <NavItem view="salesHistory">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                  </svg>
                  <span>Sales History</span>
                </div>
              </NavItem>
              
              <NavItem view="form">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  <span>Add Vehicle</span>
                </div>
              </NavItem>
              
              <NavItem view="inquiries" count={unreadCount}>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                  <span>Inquiries</span>
                </div>
              </NavItem>
              
              <NavItem view="settings">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <span>Settings</span>
                </div>
              </NavItem>
            </div>
          </aside>
          
          {/* Premium Main Content */}
          <main className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 min-h-[600px]">
              {(() => {
                try {
                  return renderContent();
                } catch (error) {
                  // Log error for debugging but don't crash the entire dashboard
                  if (process.env.NODE_ENV === 'development') {
                    console.error('❌ Error rendering dashboard content:', error);
                  }
                  logProductionError(error, 'Dashboard content render error');
                  
                  // Return a fallback UI instead of crashing
                  return (
                    <div className="text-center py-16 px-6">
                      <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Dashboard Content</h3>
                      <p className="text-gray-600 mb-4">
                        An error occurred while loading the dashboard. Please try refreshing the page.
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                      >
                        Refresh Page
                      </button>
                    </div>
                  );
                }
              })()}
            </div>
          </main>
        </div>
        
        {/* Premium Modals */}
        {selectedConv && seller && (
          <ChatWidget
            conversation={selectedConv}
            currentUserRole="seller"
            otherUserName={selectedConv.customerName}
            callTargetPhone={(() => {
              const contact = users?.find?.(u => u && u.email && u.email.toLowerCase().trim() === selectedConv.customerId?.toLowerCase().trim());
              return contact?.mobile || (contact as any)?.phone || '';
            })()}
            callTargetName={selectedConv.customerName}
            isInlineLaunch={true}
            onStartCall={(phone) => { if (phone) window.open(`tel:${phone}`); }}
            onSendMessage={(messageText, type, payload) => onSellerSendMessage(selectedConv.id, messageText, type, payload)}
            onClose={() => setSelectedConv(null)}
            onUserTyping={onUserTyping}
            onMarkMessagesAsRead={onMarkMessagesAsRead}
            onFlagContent={() => {}}
            typingStatus={typingStatus}
            onOfferResponse={onOfferResponse}
          />
        )}
        
        {isBulkUploadOpen && (
          <BulkUploadModal
            onClose={() => setIsBulkUploadOpen(false)}
            onAddMultipleVehicles={onAddMultipleVehicles}
            sellerEmail={seller.email}
          />
        )}
        
        {showBoostModal && vehicleToBoost && (
          <BoostListingModal
            vehicle={vehicleToBoost}
            onClose={() => { setShowBoostModal(false); setVehicleToBoost(null); }}
            onBoost={async (vehicleId, packageId) => {
              // FIXED: Removed window.location.reload() - use proper state update instead
              try {
                const response = await authenticatedFetch('/api/vehicles?action=boost', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ vehicleId, packageId, sellerEmail: seller.email })
                });
                
                if (response.ok) {
                  const contentType = response.headers.get('content-type');
                  if (contentType && contentType.includes('application/json')) {
                    try {
                      const result = await response.json();
                      if (result && result.success && result.vehicle) {
                        // Update local state instead of reloading page
                        onUpdateVehicle(result.vehicle);
                        // Only close modal on successful boost
                        setShowBoostModal(false);
                        setVehicleToBoost(null);
                      } else {
                        // API returned success but result indicates failure
                        const errorMsg = result?.message || result?.error || 'Failed to boost listing. Please try again.';
                        alert(errorMsg);
                        // Keep modal open so user can retry
                      }
                    } catch (jsonError) {
                      if (process.env.NODE_ENV === 'development') {
                        console.warn('⚠️ Failed to parse boost response:', jsonError);
                      }
                      alert('Failed to process boost response. Please try again.');
                      // Keep modal open so user can retry
                    }
                  } else {
                    // Response OK but not JSON - unexpected format
                    alert('Unexpected response format. Please try again.');
                    // Keep modal open so user can retry
                  }
                } else {
                  // Response not OK - API error
                  let errorMsg = 'Failed to boost listing. ';
                  try {
                    const errorData = await response.json();
                    errorMsg += errorData.message || errorData.error || `Server returned status ${response.status}`;
                  } catch {
                    errorMsg += `Server returned status ${response.status}`;
                  }
                  alert(errorMsg);
                  // Keep modal open so user can retry
                }
              } catch (error) {
                // Network or other errors
                const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
                alert(`Error boosting vehicle: ${errorMsg}`);
                if (process.env.NODE_ENV === 'development') {
                  console.error('❌ Error boosting vehicle:', error);
                }
                // Keep modal open so user can retry
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;

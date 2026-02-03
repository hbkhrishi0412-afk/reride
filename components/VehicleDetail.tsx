import React, { useState, useMemo, memo, useEffect, useRef } from 'react';
import type { Vehicle, ProsAndCons, User, CertifiedInspection, VehicleDocument } from '../types';
import { generateProsAndCons } from '../services/geminiService';
import { getFirstValidImage, getValidImages, getSafeImageSrc } from '../utils/imageUtils';

const DEFAULT_PLACEHOLDER = 'https://via.placeholder.com/800x600?text=Car+Image';
import StarRating from './StarRating';
import VehicleCard from './VehicleCard';
import EMICalculator from './EMICalculator';
import QuickViewModal from './QuickViewModal';
import VehicleHistory from './VehicleHistory';
import { getFollowersCount } from '../services/buyerEngagementService';
import { useApp } from './AppProvider';
import { logWarn, logDebug } from '../utils/logger';

interface VehicleDetailProps {
  vehicle: Vehicle;
  onBack: () => void;
  comparisonList: number[];
  onToggleCompare: (id: number) => void;
  onAddSellerRating: (sellerEmail: string, rating: number) => void;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  currentUser: User | null;
  onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  users: User[];
  onViewSellerProfile: (sellerEmail: string) => void;
  onStartChat: (vehicle: Vehicle) => void;
  recommendations: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  updateVehicle?: (id: number, updates: Partial<Vehicle>, options?: { successMessage?: string; skipToast?: boolean }) => Promise<void>;
}

// SVG icons for social media
const ICONS = {
    facebook: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" /></svg>,
    twitter: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.46 6c-.77.35-1.6.58-2.46.67.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98-3.54-.18-6.69-1.87-8.8-4.46-.37.63-.58 1.37-.58 2.15 0 1.49.76 2.81 1.91 3.58-.7-.02-1.36-.21-1.94-.53v.05c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21c7.34 0 11.35-6.08 11.35-11.35 0-.17 0-.34-.01-.51.78-.57 1.45-1.28 1.99-2.08z" /></svg>,
    whatsapp: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zM12.04 20.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31c-.82-1.31-1.26-2.83-1.26-4.38 0-4.54 3.69-8.23 8.24-8.23 4.54 0 8.23 3.69 8.23 8.23 0 4.54-3.69 8.23-8.23 8.23zm4.52-6.2c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14 0-.3 0-.47 0-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.05-.11-.2-.16-.44-.28z" /></svg>,
    link: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>,
};

const SocialShareButtons: React.FC = () => {
    const [copyStatus, setCopyStatus] = useState('Copy Link');

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus('Copy Link'), 2000);
        }, () => {
            setCopyStatus('Failed!');
            setTimeout(() => setCopyStatus('Copy Link'), 2000);
        });
    };

    return (
        <div className="flex-1">
            <button 
                onClick={handleCopyLink} 
                className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold bg-gray-100 text-gray-700 px-3 py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
            >
                {ICONS.link}
                <span>{copyStatus}</span>
            </button>
        </div>
    );
};

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white rounded-xl shadow-soft overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left p-6"
                aria-expanded={isOpen}
            >
                <h3 className="text-xl font-semibold text-reride-text-dark dark:text-reride-text-dark">{title}</h3>
                <svg className={`w-6 h-6 text-reride-text transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-6 pt-0 border-t border-gray-200-200 dark:border-gray-200-200">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};


const KeySpec: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = memo(({ label, value, icon }) => (
    <div className="flex flex-col gap-1 p-4 bg-reride-off-white dark:bg-white rounded-lg text-center">
        {icon && <div className="mx-auto mb-1" style={{ color: '#1E88E5' }}>{icon}</div>}
        <span className="text-sm font-medium text-brand-gray-600 dark:text-reride-text">{label}</span>
        <span className="font-bold text-reride-text-dark dark:text-reride-text-dark">{value}</span>
    </div>
));

// Helper function to get bank logo URL
const getBankLogoUrl = (bankName: string): string => {
  // Normalize bank name for matching
  const normalizedName = bankName.toLowerCase().trim();
  
  // Bank logo URLs - using high-quality sources (PNG for better clarity)
  const bankLogos: Record<string, string> = {
    'hdfc': 'https://logos-world.net/wp-content/uploads/2021/02/HDFC-Bank-Logo.png',
    'hdfc bank': 'https://logos-world.net/wp-content/uploads/2021/02/HDFC-Bank-Logo.png',
    'icici': 'https://logos-world.net/wp-content/uploads/2021/02/ICICI-Bank-Logo.png',
    'icici bank': 'https://logos-world.net/wp-content/uploads/2021/02/ICICI-Bank-Logo.png',
    'sbi': 'https://logos-world.net/wp-content/uploads/2021/02/State-Bank-of-India-SBI-Logo.png',
    'state bank of india': 'https://logos-world.net/wp-content/uploads/2021/02/State-Bank-of-India-SBI-Logo.png',
    'axis': 'https://logos-world.net/wp-content/uploads/2021/02/Axis-Bank-Logo.png',
    'axis bank': 'https://logos-world.net/wp-content/uploads/2021/02/Axis-Bank-Logo.png',
    'kotak': 'https://logos-world.net/wp-content/uploads/2021/02/Kotak-Mahindra-Bank-Logo.png',
    'kotak mahindra': 'https://logos-world.net/wp-content/uploads/2021/02/Kotak-Mahindra-Bank-Logo.png',
    'kotak mahindra bank': 'https://logos-world.net/wp-content/uploads/2021/02/Kotak-Mahindra-Bank-Logo.png',
    'bajaj finserv': 'https://logos-world.net/wp-content/uploads/2021/02/Bajaj-Finserv-Logo.png',
    'bajaj': 'https://logos-world.net/wp-content/uploads/2021/02/Bajaj-Finserv-Logo.png',
    'tata capital': 'https://logos-world.net/wp-content/uploads/2021/02/Tata-Capital-Logo.png',
    'mahindra finance': 'https://logos-world.net/wp-content/uploads/2021/02/Mahindra-Finance-Logo.png',
    'yes bank': 'https://logos-world.net/wp-content/uploads/2021/02/Yes-Bank-Logo.png',
    'yes': 'https://logos-world.net/wp-content/uploads/2021/02/Yes-Bank-Logo.png',
    'idfc': 'https://logos-world.net/wp-content/uploads/2021/02/IDFC-First-Bank-Logo.png',
    'idfc first': 'https://logos-world.net/wp-content/uploads/2021/02/IDFC-First-Bank-Logo.png',
    'idfc first bank': 'https://logos-world.net/wp-content/uploads/2021/02/IDFC-First-Bank-Logo.png',
    'bank of baroda': 'https://logos-world.net/wp-content/uploads/2021/02/Bank-of-Baroda-Logo.png',
    'baroda': 'https://logos-world.net/wp-content/uploads/2021/02/Bank-of-Baroda-Logo.png',
    'pnb': 'https://logos-world.net/wp-content/uploads/2021/02/Punjab-National-Bank-PNB-Logo.png',
    'punjab national bank': 'https://logos-world.net/wp-content/uploads/2021/02/Punjab-National-Bank-PNB-Logo.png',
    'union bank': 'https://logos-world.net/wp-content/uploads/2021/02/Union-Bank-of-India-Logo.png',
    'union bank of india': 'https://logos-world.net/wp-content/uploads/2021/02/Union-Bank-of-India-Logo.png',
    'canara bank': 'https://logos-world.net/wp-content/uploads/2021/02/Canara-Bank-Logo.png',
    'canara': 'https://logos-world.net/wp-content/uploads/2021/02/Canara-Bank-Logo.png',
    'indian bank': 'https://logos-world.net/wp-content/uploads/2021/02/Indian-Bank-Logo.png'
  };
  
  // Try to find exact match or partial match
  const logoKey = Object.keys(bankLogos).find(key => 
    normalizedName.includes(key) || key.includes(normalizedName)
  );
  
  return logoKey ? bankLogos[logoKey] : '';
};

// Bank Logo Component with fallback
const BankLogo: React.FC<{ bankName: string; size?: 'sm' | 'md' | 'lg' }> = ({ bankName, size = 'md' }) => {
  const [imageError, setImageError] = useState(false);
  const logoUrl = getBankLogoUrl(bankName);
  
  const sizeClasses = {
    sm: 'w-10 h-10 min-w-[40px] min-h-[40px]',
    md: 'w-16 h-16 min-w-[64px] min-h-[64px]',
    lg: 'w-20 h-20 min-w-[80px] min-h-[80px]'
  };
  const containerClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };
  const emojiSizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  };
  
  if (!logoUrl || imageError) {
    return (
      <div className={`${containerClasses[size]} flex items-center justify-center`}>
        <span className={`${emojiSizes[size]} block text-center`} role="img" aria-label={bankName}>
          🏦
        </span>
      </div>
    );
  }
  
  return (
    <div className={`${containerClasses[size]} flex items-center justify-center bg-white rounded p-1.5 shadow-sm border border-gray-100`}>
      <img 
        src={logoUrl} 
        alt={bankName}
        className={`${sizeClasses[size]} object-contain max-w-full max-h-full`}
        style={{ 
          filter: 'contrast(1.05)',
          WebkitFilter: 'contrast(1.05)'
        }}
        onError={() => setImageError(true)}
        loading="eager"
      />
    </div>
  );
};

// Helper function to get bank logo component (for backward compatibility)
const getBankLogo = (bankName: string, size: 'sm' | 'md' | 'lg' = 'md'): React.ReactNode => {
  return <BankLogo bankName={bankName} size={size} />;
};

const SpecDetail: React.FC<{ label: string; value: string | number | undefined }> = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-200-100 dark:border-gray-200-200 last:border-b-0">
        <dt className="text-sm text-brand-gray-600 dark:text-reride-text">{label}</dt>
        <dd className="text-sm font-semibold text-reride-text-dark dark:text-brand-gray-200 text-right">{value || '-'}</dd>
    </div>
);


const DocumentChip: React.FC<{ doc: VehicleDocument }> = ({ doc }) => {
    return (
        <a href={doc.url} target="_blank" rel="noopener noreferrer" title={`View ${doc.fileName}`}
           className="flex items-center gap-2 bg-white dark:bg-white text-reride-text-dark dark:text-reride-text-dark px-3 py-1.5 rounded-full text-sm font-medium hover:bg-white-dark dark:hover:bg-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2-2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <span>{doc.name}</span>
        </a>
    )
}

const CertifiedInspectionReport: React.FC<{ report: CertifiedInspection }> = ({ report }) => {
    const scoreColor = (score: number) => {
        if (score >= 90) return 'bg-reride-orange-light0';
        if (score >= 75) return 'bg-reride-blue-light0';
        return 'bg-reride-orange-light0';
    };
    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center border-b dark:border-gray-200-200 pb-4 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-reride-orange flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44-1.22a.75.75 0 00-1.06 0L8.172 6.172a.75.75 0 00-1.06 1.06L8.94 9.332a.75.75 0 001.191.04l3.22-4.294a.75.75 0 00-.04-1.19z" clipRule="evenodd" />
                </svg>
                <div>
                    <h3 className="text-xl font-semibold text-reride-text-dark dark:text-reride-text-dark">ReRide Certified Inspection</h3>
                    <p className="text-sm text-brand-gray-600 dark:text-reride-text">Inspected by {report.inspector} on {new Date(report.date).toLocaleDateString()}</p>
                </div>
            </div>
            <p className="italic text-reride-text-dark dark:text-reride-text-dark mb-6">{report.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {Object.entries(report.scores).map(([key, score]) => (
                    <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm text-reride-text-dark dark:text-reride-text-dark">{key}</span>
                            <span className="font-bold text-sm text-reride-text-dark dark:text-reride-text-dark">{score}/100</span>
                        </div>
                        <div className="w-full bg-reride-light-gray dark:bg-brand-gray-700 rounded-full h-2.5">
                            <div className={`${scoreColor(Number(score))} h-2.5 rounded-full`} style={{ width: `${score}%` }}></div>
                        </div>
                        <p className="text-xs text-reride-text dark:text-reride-text mt-1">{report.details[key]}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};


export const VehicleDetail: React.FC<VehicleDetailProps> = ({ vehicle, onBack: onBackToHome, comparisonList, onToggleCompare, onAddSellerRating, wishlist, onToggleWishlist, currentUser, onFlagContent, users, onViewSellerProfile, onStartChat, recommendations, onSelectVehicle, updateVehicle: updateVehicleProp }) => {
  console.log('🎯 VehicleDetail component rendering with vehicle:', vehicle);
  console.log('🎯 Vehicle data:', { id: vehicle?.id, make: vehicle?.make, model: vehicle?.model, price: vehicle?.price });
  
  // Get updateVehicle from context (hook must be called unconditionally)
  // Prefer prop over context if both are available
  const context = useApp();
  const updateVehicle = updateVehicleProp || context.updateVehicle;
  
  // ✅ FIX: Memoize safeVehicle to prevent unnecessary re-renders
  const safeVehicle = useMemo(() => ({
    ...vehicle,
    images: vehicle.images || [],
    features: vehicle.features || [],
    description: vehicle.description || '',
    engine: vehicle.engine || '',
    transmission: vehicle.transmission || '',
    fuelType: vehicle.fuelType || '',
    fuelEfficiency: vehicle.fuelEfficiency || '',
    color: vehicle.color || '',
    registrationYear: vehicle.registrationYear || vehicle.year,
    insuranceValidity: vehicle.insuranceValidity || '',
    rto: vehicle.rto || '',
    city: vehicle.city || '',
    state: vehicle.state || '',
    noOfOwners: vehicle.noOfOwners || 1,
    displacement: vehicle.displacement || '',
    groundClearance: vehicle.groundClearance || '',
    bootSpace: vehicle.bootSpace || '',
    averageRating: vehicle.averageRating || 0,
    ratingCount: vehicle.ratingCount || 0,
    sellerName: vehicle.sellerName || '',
    sellerBadges: vehicle.sellerBadges || [],
    status: vehicle.status || 'published',
    isFeatured: vehicle.isFeatured || false,
    views: vehicle.views || 0,
    inquiriesCount: vehicle.inquiriesCount || 0,
    mileage: typeof vehicle.mileage === 'number' ? vehicle.mileage : 0
  }), [vehicle]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeMediaTab, setActiveMediaTab] = useState<'images' | 'video'>('images');
  const [activeTab, setActiveTab] = useState<'overview' | 'report' | 'features'>('overview');
  const [showSellerRatingSuccess, setShowSellerRatingSuccess] = useState(false);
  const [prosAndCons, setProsAndCons] = useState<ProsAndCons | null>(null);
  const [isGeneratingProsCons, setIsGeneratingProsCons] = useState<boolean>(false);
  const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);
  const [showEMICalculator, setShowEMICalculator] = useState<boolean>(false);
  const ratingSuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emiCalculatorRef = useRef<HTMLDivElement>(null);
  const trackedViewRef = useRef<Set<number>>(new Set());

  // ✅ FIX: Optimize useEffect dependency - only depend on vehicle.id and videoUrl
  useEffect(() => {
    setCurrentIndex(0);
    setProsAndCons(null);
    setIsGeneratingProsCons(false);
    setShowEMICalculator(false);
    setActiveMediaTab(vehicle.videoUrl ? 'video' : 'images');
    window.scrollTo(0, 0);
    // Reset tracked views when vehicle changes
    trackedViewRef.current.clear();
  }, [vehicle.id, vehicle.videoUrl]);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (ratingSuccessTimeoutRef.current) {
        clearTimeout(ratingSuccessTimeoutRef.current);
      }
    };
  }, []);
  
  // ✅ FIX: Use valid images for navigation to prevent index errors
  const validImages = useMemo(() => getValidImages(safeVehicle.images), [safeVehicle.images]);
  
  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (validImages.length > 0) {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + validImages.length) % validImages.length);
    }
  };
  
  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (validImages.length > 0) {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % validImages.length);
    }
  };

  const handleGenerateProsCons = async () => {
    setIsGeneratingProsCons(true);
    const result = await generateProsAndCons(safeVehicle);
    setProsAndCons(result);
    setIsGeneratingProsCons(false);
  };
  
  const handleRateSeller = (rating: number) => {
    onAddSellerRating(safeVehicle.sellerEmail, Number(rating));
    setShowSellerRatingSuccess(true);
    // Clear any existing timeout before setting a new one
    if (ratingSuccessTimeoutRef.current) {
      clearTimeout(ratingSuccessTimeoutRef.current);
    }
    ratingSuccessTimeoutRef.current = setTimeout(() => setShowSellerRatingSuccess(false), 3000);
  };

  const handleFlagClick = () => {
      if(window.confirm('Are you sure you want to report this listing for review by an administrator?')) {
        const reason = window.prompt("Please provide a reason for reporting this listing (optional):");
        if (reason !== null) {
            onFlagContent('vehicle', safeVehicle.id, reason || "No reason provided");
        }
      }
  }

  const isComparing = comparisonList.includes(safeVehicle.id);
  const isInWishlist = wishlist.includes(safeVehicle.id);
  const canRate = currentUser?.role === 'customer';
  const isCompareDisabled = !isComparing && comparisonList.length >= 4;
  
  // ✅ FIX: Normalize emails for comparison (consistent with codebase pattern)
  const seller = useMemo(() => {
    if (!safeVehicle.sellerEmail) return undefined;
    const normalizedSellerEmail = safeVehicle.sellerEmail.toLowerCase().trim();
    return users.find(u => {
      if (!u || !u.email) return false;
      return u.email.toLowerCase().trim() === normalizedSellerEmail;
    });
  }, [users, safeVehicle.sellerEmail]);

  // Debug logging after seller is defined
  console.log('🎯 Seller data:', seller);
  console.log('🎯 Seller partnerBanks:', seller?.partnerBanks);

  const filteredRecommendations = useMemo(() => {
      return recommendations.filter(rec => rec.id !== safeVehicle.id).slice(0, 3);
  }, [recommendations, safeVehicle.id]);
  
  // Track a view when the detail page is opened (only once per vehicle)
  useEffect(() => {
    const vehicleId = vehicle?.id;
    if (!vehicleId) return;
    
    // Check if we've already tracked this vehicle's view
    if (trackedViewRef.current.has(vehicleId)) {
      return;
    }
    
    // Mark as tracked immediately to prevent duplicate requests
    trackedViewRef.current.add(vehicleId);
    
    const trackView = async () => {
      try {
        const res = await fetch('/api/vehicles?action=track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicleId })
        });
        const data = await res.json().catch((error) => {
          logWarn('Failed to parse view count response:', error);
          return {};
        });
        // Optimistically update local state if API responded
        if (data && typeof data.views === 'number') {
          try {
            // Update selectedVehicle persisted copy
            const stored = sessionStorage.getItem('selectedVehicle');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed?.id === vehicleId) {
                parsed.views = data.views;
                sessionStorage.setItem('selectedVehicle', JSON.stringify(parsed));
              }
            }
          } catch (error) {
            logDebug('Failed to update selectedVehicle in sessionStorage (non-critical):', error);
          }
          // Update global vehicles state via context so dashboards reflect the change
          try {
          // Skip toast notification for view count updates (silent background update)
            if (updateVehicle) {
              updateVehicle(vehicleId, { views: data.views }, { skipToast: true }).catch((error) => {
                logWarn('Failed to update vehicle views:', error);
              });
            }
          } catch (error) {
            logWarn('Failed to update vehicle views:', error);
          }
        }
      } catch (_err) {
        // On error, remove from tracked set so it can be retried if needed
        trackedViewRef.current.delete(vehicleId);
      }
    };
    
    trackView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id]); // Only depend on the actual vehicle ID, not safeVehicle or updateVehicle

  console.log('🎯 VehicleDetail about to render JSX');
  
  // Format currency helper
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate EMI for display
  const baseEMI = useMemo(() => {
    const loanAmount = Math.round(safeVehicle.price * 0.8);
    const interestRate = 10.5;
    const tenure = 60;
    const monthlyRate = interestRate / 12 / 100;
    if (monthlyRate === 0) return loanAmount / tenure;
    return Math.round((loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1));
  }, [safeVehicle.price]);

  return (
    <>
      <div className="bg-white dark:bg-white animate-fade-in">
          <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <button onClick={onBackToHome} className="mb-4 text-gray-600 hover:text-gray-900 font-medium transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Listings
              </button>

              {/* Offer Banner - Reride Style */}
              <div className="mb-6 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 text-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-lg sm:text-xl font-bold">🎉 SPECIAL OFFER</span>
                    <span className="text-gray-200">•</span>
                    <span className="text-xs sm:text-sm whitespace-nowrap">8 - 31 DEC</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                    <span className="whitespace-nowrap">LOAN OFFERS ON ALL CARS</span>
                    <span className="font-bold whitespace-nowrap">ROI STARTING AT 10.5%*</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                  {/* Left Column: Media and Details */}
                  <div className="lg:col-span-2 space-y-4">
                    {safeVehicle.videoUrl && (
                      <div className="flex space-x-2 border-b-2 border-gray-200">
                        <button onClick={() => setActiveMediaTab('images')} className={`py-2 px-4 font-semibold transition-colors ${activeMediaTab === 'images' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600'}`}>Images</button>
                        <button onClick={() => setActiveMediaTab('video')} className={`py-2 px-4 font-semibold transition-colors ${activeMediaTab === 'video' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600'}`}>Video</button>
                      </div>
                    )}
                    {activeMediaTab === 'images' ? (
                      <>
                        {/* ✅ FIX: Better error handling for images */}
                        {validImages.length > 0 ? (
                          <>
                            <div className="relative group bg-gray-100 rounded-xl overflow-hidden">
                                <img 
                                  key={currentIndex} 
                                  className="w-full h-[500px] object-contain rounded-xl shadow-lg animate-fade-in bg-white" 
                                  src={validImages[currentIndex] || getFirstValidImage(safeVehicle.images)} 
                                  alt={`${safeVehicle.make} ${safeVehicle.model} - Image ${currentIndex + 1}`}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    // Only set placeholder if not already a placeholder to avoid infinite loops
                                    if (!target.src.includes('placeholder.com') && !target.src.includes('text=Car')) {
                                      target.src = DEFAULT_PLACEHOLDER;
                                    }
                                  }}
                                  loading="lazy"
                                />
                                {validImages.length > 1 && (
                                    <>
                                        <button onClick={handlePrevImage} className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all focus:opacity-100" aria-label="Previous image">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                          </svg>
                                        </button>
                                        <button onClick={handleNextImage} className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all focus:opacity-100" aria-label="Next image">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                            {validImages.length > 1 && (
                                <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
                                    {validImages.slice(0, 8).map((img, index) => (
                                        <img 
                                          key={index} 
                                          src={getSafeImageSrc(img)} 
                                          alt={`Thumbnail ${index + 1}`} 
                                          className={`cursor-pointer rounded-lg border-2 h-20 w-28 object-cover flex-shrink-0 transition-all ${
                                            currentIndex === index 
                                              ? 'border-purple-600 shadow-md scale-105' 
                                              : 'border-transparent hover:border-purple-300'
                                          }`}
                                          onClick={() => setCurrentIndex(index)}
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = 'https://via.placeholder.com/112x80?text=Image';
                                          }}
                                        />
                                    ))}
                                </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-[500px] bg-gray-100 rounded-xl flex items-center justify-center">
                            <div className="text-center text-gray-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-lg font-medium">No images available</p>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full aspect-video bg-black rounded-xl shadow-lg overflow-hidden animate-fade-in">
                        <video src={safeVehicle.videoUrl} controls className="w-full h-full object-cover">Your browser does not support the video tag.</video>
                      </div>
                    )}
                    
                    {/* Tab Navigation - Reride Style */}
                    <div className="mt-10 lg:mt-12">
                      <div className="bg-white rounded-t-xl border-b-2 border-gray-200">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-6 py-4 font-bold text-sm uppercase transition-colors relative ${
                              activeTab === 'overview'
                                ? 'text-purple-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            OVERVIEW
                            {activeTab === 'overview' && (
                              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></span>
                            )}
                          </button>
                          {safeVehicle.certifiedInspection && (
                            <button
                              onClick={() => setActiveTab('report')}
                              className={`px-6 py-4 font-bold text-sm uppercase transition-colors relative ${
                                activeTab === 'report'
                                  ? 'text-purple-600'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              REPORT
                              {activeTab === 'report' && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></span>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => setActiveTab('features')}
                            className={`px-6 py-4 font-bold text-sm uppercase transition-colors relative ${
                              activeTab === 'features'
                                ? 'text-purple-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            FEATURE & SPECS
                            {activeTab === 'features' && (
                              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Tab Content */}
                      <div className="bg-white rounded-b-xl">
                        {activeTab === 'overview' && (
                          <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Left Column - Overview Content */}
                              <div className="lg:col-span-2 space-y-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  <KeySpec label="Make Year" value={safeVehicle.year} />
                                  <KeySpec label="Registration" value={safeVehicle.registrationYear} />
                                  <KeySpec label="Fuel Type" value={safeVehicle.fuelType} />
                                  <KeySpec label="Km Driven" value={typeof safeVehicle.mileage === 'number' ? safeVehicle.mileage.toLocaleString('en-IN') : '0'} />
                                  <KeySpec label="Transmission" value={safeVehicle.transmission} />
                                  <KeySpec label="Owners" value={safeVehicle.noOfOwners} />
                                  <KeySpec label="Insurance" value={(() => {
                                    const insurance = safeVehicle.insuranceValidity;
                                    if (!insurance || insurance.trim() === '') return 'Not specified';
                                    // Validate insurance date - if it's a date format, check if it makes sense
                                    if (insurance.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                      const insuranceDate = new Date(insurance);
                                      const vehicleYear = safeVehicle.year || safeVehicle.registrationYear;
                                      // If insurance date is before vehicle year, it's invalid
                                      if (vehicleYear && insuranceDate.getFullYear() < vehicleYear) {
                                        return 'Invalid date';
                                      }
                                      // Format date nicely
                                      return insuranceDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                                    }
                                    return insurance;
                                  })()} />
                                  <KeySpec label="RTO" value={safeVehicle.rto} />
                                </div>
                                {safeVehicle.description && (
                                  <div>
                                    <h4 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-2">Description</h4>
                                    <p className="text-reride-text-dark dark:text-reride-text-dark whitespace-pre-line">{safeVehicle.description}</p>
                                  </div>
                                )}
                              </div>

                              {/* Right Column - Finance Partners Card (Desktop) */}
                              {seller && (
                                <div className="hidden lg:block lg:col-span-1">
                                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-4 shadow-md h-fit">
                                    <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                      </svg>
                                      Finance Partners
                                    </h3>
                                    {seller.partnerBanks && seller.partnerBanks.length > 0 ? (
                                      <div className="space-y-3">
                                        <p className="text-xs text-gray-600">This seller is partnered with the following banks for vehicle financing:</p>
                                        <div className="grid grid-cols-2 gap-3">
                                          {seller.partnerBanks.map((bank, index) => (
                                            <div
                                              key={index}
                                              className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-purple-200 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
                                            >
                                              <div className="flex items-center justify-center w-full h-16">
                                                {getBankLogo(bank, 'md')}
                                              </div>
                                              <span className="text-xs font-semibold text-purple-700 text-center leading-tight line-clamp-2">
                                                {bank}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-start gap-2 text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>No finance partners available for this seller.</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Finance Partners Card - Mobile (shown below description, always visible on mobile) */}
                            {seller ? (
                              <div className="mt-6 w-full lg:hidden">
                                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-4 shadow-md">
                                  <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    Finance Partners
                                  </h3>
                                  {seller.partnerBanks && seller.partnerBanks.length > 0 ? (
                                    <div className="space-y-3">
                                      <p className="text-xs text-gray-600">This seller is partnered with the following banks for vehicle financing:</p>
                                      <div className="grid grid-cols-2 gap-3">
                                        {seller.partnerBanks.map((bank, index) => (
                                          <div
                                            key={index}
                                            className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-purple-200 shadow-sm"
                                          >
                                            <div className="flex items-center justify-center w-full h-16">
                                              {getBankLogo(bank, 'md')}
                                            </div>
                                            <span className="text-xs font-semibold text-purple-700 text-center leading-tight line-clamp-2">
                                              {bank}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start gap-2 text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>No finance partners available for this seller.</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {activeTab === 'report' && safeVehicle.certifiedInspection && (
                          <div className="p-6">
                            <CertifiedInspectionReport report={safeVehicle.certifiedInspection} />
                          </div>
                        )}

                        {activeTab === 'features' && (
                          <div className="p-6 space-y-8">
                            {/* Detailed Specifications */}
                            <div>
                              <h3 className="text-xl font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">Detailed Specifications</h3>
                              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <SpecDetail label="Engine" value={safeVehicle.engine} />
                                <SpecDetail label="Displacement" value={safeVehicle.displacement} />
                                <SpecDetail label="Transmission" value={safeVehicle.transmission} />
                                <SpecDetail label="Fuel Type" value={safeVehicle.fuelType} />
                                <SpecDetail label="Mileage / Range" value={safeVehicle.fuelEfficiency} />
                                <SpecDetail label="Ground Clearance" value={safeVehicle.groundClearance} />
                                <SpecDetail label="Boot Space" value={safeVehicle.bootSpace} />
                                <SpecDetail label="Color" value={safeVehicle.color} />
                              </dl>
                            </div>

                            {/* Features, Pros & Cons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <h4 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">Included Features</h4>
                                {safeVehicle.features.length > 0 ? (
                                  <div className="flex flex-wrap gap-3">
                                    {safeVehicle.features.map(feature => (
                                      <div key={feature} className="flex items-center gap-2 text-reride-text-dark dark:text-reride-text-dark bg-reride-off-white dark:bg-brand-gray-700 px-3 py-1 rounded-full text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-reride-orange" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        {feature}
                                      </div>
                                    ))}
                                  </div>
                                ) : <p className="text-reride-text">No features listed.</p>}
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">AI Expert Analysis</h4>
                                {isGeneratingProsCons ? (
                                  <div className="flex items-center gap-2 text-reride-text"><div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin" style={{ borderColor: '#FF6B35' }}></div> Generating...</div>
                                ) : prosAndCons ? (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <h5 className="font-semibold text-reride-orange mb-2">Pros</h5>
                                      <ul className="list-disc list-inside space-y-1 text-sm">{prosAndCons.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                    </div>
                                    <div>
                                      <h5 className="font-semibold text-reride-orange mb-2">Cons</h5>
                                      <ul className="list-disc list-inside space-y-1 text-sm">{prosAndCons.cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={handleGenerateProsCons} className="text-sm font-bold hover:underline transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>Generate Pros & Cons</button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional Sections Below Tabs */}
                    <div className="mt-6 space-y-6">
                    {/* ✅ FIX: Removed duplicate section - Vehicle History & Documents */}
                    {(safeVehicle.serviceRecords || safeVehicle.accidentHistory || safeVehicle.documents) && (
                        <CollapsibleSection title="Vehicle History & Documents">
                            {(safeVehicle.serviceRecords || safeVehicle.accidentHistory) && (
                                <VehicleHistory serviceRecords={safeVehicle.serviceRecords || []} accidentHistory={safeVehicle.accidentHistory || []} />
                            )}
                            {safeVehicle.documents && safeVehicle.documents.length > 0 && <div className="mt-6">
                                <h4 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">Available Documents</h4>
                                <div className="flex flex-wrap gap-4">
                                    {safeVehicle.documents.map(doc => <DocumentChip key={doc.name} doc={doc} />)}
                                </div>
                            </div>}
                        </CollapsibleSection>
                    )}

                    {/* EMI Calculator - Shown at bottom when clicked */}
                    {showEMICalculator && (
                        <div ref={emiCalculatorRef} className="mt-8">
                            <EMICalculator price={safeVehicle.price} />
                        </div>
                    )}
                  </div>
                  </div>
                  
                  {/* Right Column: All in One Compact Card - Reride Style - Fixed on Scroll */}
                  <div className="lg:sticky lg:top-24 lg:h-fit lg:self-start lg:z-10">
                      <div className="bg-white rounded-xl shadow-lg p-4 h-[500px] lg:h-[500px] flex flex-col">
                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2.5">
                        {/* Car Title and Wishlist */}
                        <div className="flex items-start justify-between">
                          <h1 className="text-xl font-bold text-gray-900 pr-2 leading-tight">
                            {safeVehicle.year} {safeVehicle.make} {safeVehicle.model} {safeVehicle.variant || ''}
                          </h1>
                          <button
                            onClick={() => onToggleWishlist(safeVehicle.id)}
                            className={`flex-shrink-0 p-1 rounded-full transition-colors ${
                              isInWishlist 
                                ? 'text-red-500 hover:text-red-600' 
                                : 'text-gray-400 hover:text-red-500'
                            }`}
                            aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill={isInWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Key Specs */}
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <span className="font-semibold">{typeof safeVehicle.mileage === 'number' ? safeVehicle.mileage.toLocaleString('en-IN') : '0'} km</span>
                          <span>•</span>
                          <span>{safeVehicle.fuelType}</span>
                          <span>•</span>
                          <span>{safeVehicle.transmission}</span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{safeVehicle.location || `${safeVehicle.city || ''}, ${safeVehicle.state || ''}`.trim() || 'Location not specified'}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>

                        {/* Seller Information - Compact */}
                        {seller && (
                          <div className="border-t border-gray-200 pt-2 mt-1">
                            <div className="flex items-center gap-1.5">
                              <img 
                                src={getSafeImageSrc(seller.logoUrl, `https://i.pravatar.cc/100?u=${seller.email}`)} 
                                alt="Seller Logo" 
                                className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0" 
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="font-semibold text-xs text-gray-900 truncate">{seller.dealershipName || seller.name}</h4>
                                  <span className="text-xs text-gray-400">•</span>
                                  <div className="flex items-center gap-0.5">
                                    <StarRating rating={seller.averageRating || 0} size="sm" readOnly />
                                    <span className="text-xs text-gray-500">({seller.ratingCount || 0})</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs text-gray-500">{getFollowersCount(seller.email)} Followers</span>
                                  <button 
                                    onClick={() => onViewSellerProfile(seller.email)} 
                                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors"
                                  >
                                    View Profile
                                  </button>
                                </div>
                              </div>
                            </div>
                            {canRate && (
                              <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-600">Rate your experience:</p>
                                  <StarRating rating={0} onRate={handleRateSeller} />
                                </div>
                                {showSellerRatingSuccess && (
                                  <p className="text-center text-green-600 text-xs mt-0.5">Thanks for your feedback!</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quality Assurance Badge */}
                        {safeVehicle.certifiedInspection && (
                          <div className="flex items-center gap-1.5">
                            <span className="bg-purple-100 text-purple-700 text-sm font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44-1.22a.75.75 0 00-1.06 0L8.172 6.172a.75.75 0 00-1.06 1.06L8.94 9.332a.75.75 0 001.191.04l3.22-4.294a.75.75 0 00-.04-1.19z" clipRule="evenodd" />
                              </svg>
                              ReRide Assured
                            </span>
                            <span className="text-sm text-gray-600">High quality, less driven</span>
                          </div>
                        )}

                        {/* Divider */}
                        <div className="border-t border-gray-200 pt-2"></div>

                        {/* Pricing */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-base text-gray-600">Fixed on road price</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-3xl font-bold text-gray-900">₹{safeVehicle.price.toLocaleString('en-IN')}</p>
                          <p className="text-base text-gray-500 mt-1">Includes RC transfer, Insurance & more</p>
                        </div>

                        {/* EMI Details */}
                        <div className="border-t border-gray-200 pt-2.5 space-y-2">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-gray-900">{formatCurrency(baseEMI)}/m</span>
                              <button 
                                onClick={() => {
                                  const wasHidden = !showEMICalculator;
                                  setShowEMICalculator(!showEMICalculator);
                                  if (wasHidden && emiCalculatorRef.current) {
                                    setTimeout(() => {
                                      emiCalculatorRef.current?.scrollIntoView({ 
                                        behavior: 'smooth', 
                                        block: 'start'
                                      });
                                    }, 100);
                                  }
                                }}
                                className="text-base text-purple-600 font-semibold hover:underline"
                              >
                                {showEMICalculator ? 'Hide EMI Calculator' : 'Calculate your EMI'}
                              </button>
                            </div>
                          </div>
                          
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 flex items-start gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            <span className="text-base text-gray-700 leading-tight">Save extra ₹{Math.round(baseEMI * 12 * 0.0125).toLocaleString('en-IN')} in loan interest with 1.25% lower rate</span>
                          </div>
                        </div>

                        {/* Compare and Share */}
                        <div className="flex gap-2 pt-2.5 border-t border-gray-200">
                          <button
                            onClick={() => onToggleCompare(safeVehicle.id)}
                            disabled={isCompareDisabled}
                            className={`flex-1 font-semibold py-2.5 px-3 rounded-lg text-sm transition-all flex items-center justify-center gap-1.5 ${
                              isComparing 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            } ${isCompareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isComparing ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Comparing
                              </>
                            ) : (
                              'Compare'
                            )}
                          </button>
                          <SocialShareButtons />
                        </div>
                        </div>

                        {/* Fixed Action Buttons at Bottom */}
                        <div className="pt-3 mt-auto border-t border-gray-200 flex-shrink-0">
                          <button 
                            onClick={() => onStartChat(safeVehicle)} 
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 px-4 rounded-lg text-lg transition-all transform hover:scale-[1.01] shadow-lg flex items-center justify-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Chat with Seller
                          </button>
                        </div>

                      </div>
                  </div>
              </div>

              <div className="text-center mt-12">
                  <button onClick={handleFlagClick} className="text-xs text-reride-text hover:text-reride-orange">Report this listing</button>
              </div>

              {filteredRecommendations.length > 0 && <div className="mt-12">
                  <h2 className="text-3xl font-bold text-reride-text-dark dark:text-reride-text-dark mb-6">Similar Vehicles</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredRecommendations.map(v => (
                          <VehicleCard key={v.id} vehicle={v} onSelect={onSelectVehicle} onToggleCompare={onToggleCompare} isSelectedForCompare={comparisonList.includes(v.id)} onToggleWishlist={onToggleWishlist} isInWishlist={wishlist.includes(v.id)} isCompareDisabled={!comparisonList.includes(v.id) && comparisonList.length >= 4} onViewSellerProfile={onViewSellerProfile} onQuickView={setQuickViewVehicle}/>
                      ))}
                  </div>
              </div>}

          </div>
      </div>
      <QuickViewModal vehicle={quickViewVehicle} onClose={() => setQuickViewVehicle(null)} onSelectVehicle={onSelectVehicle} onToggleCompare={onToggleCompare} onToggleWishlist={onToggleWishlist} comparisonList={comparisonList} wishlist={wishlist} />
    </>
  );
};

export default VehicleDetail;

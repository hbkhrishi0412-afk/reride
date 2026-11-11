import React, { useState, useMemo, memo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { testDriveBookingState, type Vehicle, type User, type CertifiedInspection, type DealLead } from '../types';
import { useTranslatedText, useTranslatedArray, useTranslatedFields } from '../hooks/useTranslatedText';
import { getFirstValidImage, getValidImages, getSafeImageSrc, VEHICLE_IMAGE_PLACEHOLDER_DATA_URI, VEHICLE_THUMB_PLACEHOLDER_DATA_URI, isInlineImagePlaceholder, isPlaceholderService } from '../utils/imageUtils';
import StarRating from './StarRating';
import { useTrackVehicleView } from '../hooks/useTrackVehicleView';
import VehicleCard from './VehicleCard';
import EMICalculator from './EMICalculator';
import VerificationBadge from './VerificationBadge';
import { useApp } from './AppProvider';
import { isCompareDisabledForVehicle } from '../utils/compareList.js';
import { scrollAppToTop } from '../utils/scrollAppToTop';
import { getVehicleListingUrl } from '../utils/whatsappShare.js';
import { ListingStockBadge } from './ListingStockBadge.js';
import { ListingTrustStatusBar } from './ListingTrustStatusBar.js';
import VehicleDetailTrustStrip from './VehicleDetailTrustStrip.js';
import { isListingAvailable } from '../utils/listingStock.js';
import { isRerideStaffPick } from '../utils/staffPick.js';
import { PriceInsights, PRICE_ANALYSIS_ENABLED } from './PriceInsights';
import { findSimilarVehicles } from '../utils/vehiclePricing';
import { enrichVehicleWithSellerInfo, resolveVehicleSellerEmail } from '../utils/vehicleEnrichment';
import SellerDisclosureDisplay from './SellerDisclosureDisplay';
import VehicleDescriptionDisplay from './VehicleDescriptionDisplay';
import VehicleFeatureSpecsPanel from './VehicleFeatureSpecsPanel';
import {
  fetchRatingEligibility,
  submitPeerRating,
} from '../services/vehicleTrustService';
import type { RatingEligibility } from '../types';
import { View } from '../types';
import { getDealLead } from '../services/dealService';
import DealStageChip from './DealStageChip';
import { maskVehicleIdentifier } from '../utils/vehiclePrivacy';
import VehicleJsonLd from './VehicleJsonLd';
import { hasSellerDisclosureReport } from '../utils/listingTrust.js';
import { getPublishedVehicleDetail } from '../services/dataService.js';
import { findVehicleByIdentity, getCanonicalPrimaryKey, vehicleIdsEqual } from '../utils/vehicleIdentity.js';
import { stringifyVehicleForSession } from '../utils/vehicleSessionCache.js';
import {
  formatInsuranceValidity,
  INSURANCE_INVALID_DATE_TOKEN,
} from '../utils/formatInsuranceValidity.js';

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
  /** Sign-in for gated tabs (e.g. Vahan) without starting chat. */
  onRequestLogin?: () => void;
  onRequestTestDrive?: (vehicle: Vehicle, details: { date: string; time: string }) => void | Promise<void>;
  recommendations: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  updateVehicle?: (id: number, updates: Partial<Vehicle>, options?: { successMessage?: string; skipToast?: boolean }) => Promise<void>;
}

const SocialShareButtons: React.FC<{ vehicle: Vehicle; variant?: 'default' | 'pill' }> = ({
  vehicle,
  variant = 'default',
}) => {
    const { t } = useTranslation();
    const [copyState, setCopyState] = useState<'default' | 'copied' | 'failed'>('default');

    const cleanListingUrl =
        typeof window !== 'undefined' && vehicle?.id != null
            ? getVehicleListingUrl(Number(vehicle.id))
            : typeof window !== 'undefined'
              ? window.location.href
              : '';

    const handleCopyLink = () => {
        const reset = () => setCopyState('default');
        const urlToCopy = cleanListingUrl || (typeof window !== 'undefined' ? window.location.href : '');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(urlToCopy).then(() => {
                setCopyState('copied');
                setTimeout(reset, 2000);
            }, () => {
                setCopyState('failed');
                setTimeout(reset, 2000);
            });
        } else {
            setCopyState('failed');
            setTimeout(reset, 2000);
        }
    };

    const copyLabel =
        copyState === 'copied'
            ? t('vehicle.share.copied')
            : copyState === 'failed'
              ? t('vehicle.share.failed')
              : variant === 'pill'
                ? t('vehicle.detail.share', 'Share')
                : t('vehicle.share.copyLink');

    if (variant === 'pill') {
      return (
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>{copyLabel}</span>
        </button>
      );
    }

    return (
        <>
            <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-gray-100 text-gray-700 px-3 py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
                <span>{copyLabel}</span>
            </button>
        </>
    );
};

const KeySpec: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = memo(({ label, value, icon }) => (
    <div className="flex flex-col gap-0.5 p-2.5 sm:p-3 bg-reride-off-white dark:bg-white rounded-lg text-center">
        {icon && <div className="mx-auto mb-1" style={{ color: '#1E88E5' }}>{icon}</div>}
        <span className="text-xs font-medium text-brand-gray-600 dark:text-reride-text">{label}</span>
        <span className="text-sm font-bold text-reride-text-dark dark:text-reride-text-dark">{value}</span>
    </div>
));

// Prefer local initials badges — external logo CDNs often block CORP embeds.
const BANK_LOGO_INITIALS: Record<string, string> = {
  'hdfc bank': 'HDFC',
  'hdfc': 'HDFC',
  'icici bank': 'ICICI',
  'icici': 'ICICI',
  'sbi': 'SBI',
  'state bank of india': 'SBI',
  'axis bank': 'AXIS',
  'axis': 'AXIS',
  'kotak': 'KOTAK',
  'kotak mahindra': 'KOTAK',
  'yes bank': 'YES',
  'pnb': 'PNB',
  'bank of baroda': 'BOB',
  'canara bank': 'CANARA',
};

const getBankLogoUrl = (_bankName: string): string => '';

const getBankInitials = (bankName: string): string => {
  const key = bankName.trim().toLowerCase();
  if (BANK_LOGO_INITIALS[key]) return BANK_LOGO_INITIALS[key];
  const parts = bankName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BANK';
  if (parts.length === 1) return parts[0].slice(0, 4).toUpperCase();
  return parts.map((p) => p[0]).join('').slice(0, 4).toUpperCase();
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
  const textSizes = {
    sm: 'text-[9px]',
    md: 'text-xs',
    lg: 'text-sm'
  };
  
  if (!logoUrl || imageError) {
    return (
      <div
        className={`${containerClasses[size]} flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200`}
        role="img"
        aria-label={bankName}
        title={bankName}
      >
        <span className={`${textSizes[size]} font-bold text-slate-700 tracking-wide`}>
          {getBankInitials(bankName)}
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

const SpecDetail: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
        <dt className="text-sm text-brand-gray-600 dark:text-reride-text">{label}</dt>
        <dd className="text-sm font-semibold text-reride-text-dark dark:text-brand-gray-200 text-right">{value || '-'}</dd>
    </div>
);


const CertifiedInspectionReport: React.FC<{ report: CertifiedInspection }> = ({ report }) => {
    const scoreColor = (score: number) => {
        if (score >= 90) return 'bg-green-500';
        if (score >= 75) return 'bg-blue-500';
        return 'bg-orange-500';
    };
    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center border-b dark:border-gray-200 pb-4 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-reride-orange flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44-1.22a.75 .75 0 00-1.06 0L8.172 6.172a.75 .75 0 00-1.06 1.06L8.94 9.332a.75 .75 0 001.191.04l3.22-4.294a.75 .75 0 00-.04-1.19z" clipRule="evenodd" />
                </svg>
                <div>
                    <h3 className="text-xl font-semibold text-reride-text-dark dark:text-reride-text-dark">Seller Photo Check</h3>
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


export const VehicleDetail: React.FC<VehicleDetailProps> = ({ vehicle, onBack: onBackToHome, comparisonList, onToggleCompare, onAddSellerRating, wishlist, onToggleWishlist, currentUser, onFlagContent, users, onViewSellerProfile, onStartChat, onRequestLogin, onRequestTestDrive, recommendations, onSelectVehicle, updateVehicle: updateVehicleProp }) => {
  const { t } = useTranslation();

  // Get updateVehicle from context (hook must be called unconditionally)
  // Prefer prop over context if both are available
  const context = useApp();
  const updateVehicle = updateVehicleProp || context.updateVehicle;
  const {
    vehicles: contextVehicles,
    navigate,
    setCurrentView,
    setSelectedVehicle,
    addToast,
    runIfConfirmed,
  } = context;
  
  // ✅ FIX: Memoize safeVehicle to prevent unnecessary re-renders
  const safeVehicle = useMemo(() => {
    const sellerEmail = resolveVehicleSellerEmail(vehicle, contextVehicles);
    const catalogMatch = findVehicleByIdentity(contextVehicles, vehicle.id, vehicle.databaseId);
    const enriched = enrichVehicleWithSellerInfo({ ...vehicle, sellerEmail }, users);
    const sellerDisclosureChecklist =
      enriched.sellerDisclosureChecklist?.items?.length
        ? enriched.sellerDisclosureChecklist
        : catalogMatch?.sellerDisclosureChecklist;
    const description =
      (enriched.description || '').trim() ||
      (catalogMatch?.description || '').trim() ||
      '';
    return {
    ...enriched,
    sellerDisclosureChecklist,
    vahanSnapshot: enriched.vahanSnapshot ?? catalogMatch?.vahanSnapshot,
    certifiedInspection: enriched.certifiedInspection ?? catalogMatch?.certifiedInspection,
    images: enriched.images || [],
    features: enriched.features || [],
    description,
    engine: enriched.engine || '',
    transmission: enriched.transmission || '',
    fuelType: enriched.fuelType || '',
    fuelEfficiency: enriched.fuelEfficiency || '',
    color: enriched.color || '',
    registrationYear: enriched.registrationYear || enriched.year,
    insuranceValidity: enriched.insuranceValidity || '',
    rto: enriched.rto || '',
    city: enriched.city || '',
    state: enriched.state || '',
    noOfOwners: enriched.noOfOwners || 1,
    displacement: enriched.displacement || '',
    groundClearance: enriched.groundClearance || '',
    bootSpace: enriched.bootSpace || '',
    averageRating: enriched.averageRating || 0,
    ratingCount: enriched.ratingCount || 0,
    sellerName: enriched.sellerName || '',
    sellerEmail,
    sellerBadges: enriched.sellerBadges || [],
    status: enriched.status || 'published',
    isFeatured: enriched.isFeatured || false,
    views: enriched.views || 0,
    inquiriesCount: enriched.inquiriesCount || 0,
    mileage: typeof enriched.mileage === 'number' ? enriched.mileage : 0
  };
  }, [vehicle, contextVehicles, users]);

  // Hydrate disclosure / full metadata — catalog cards can be stale after seller completes checklist.
  useEffect(() => {
    let cancelled = false;
    const pk = getCanonicalPrimaryKey(vehicle) || String(vehicle.databaseId || vehicle.id || '').trim();
    if (!pk) return;
    void getPublishedVehicleDetail(pk, vehicle.databaseId).then((fresh) => {
      if (cancelled || !fresh || !vehicleIdsEqual(fresh.id, vehicle.id)) return;
      const hasUseful =
        Boolean(fresh.sellerDisclosureChecklist?.items?.length) ||
        Boolean(fresh.certifiedInspection) ||
        Boolean(fresh.description?.trim()) ||
        Boolean(fresh.vahanSnapshot);
      if (!hasUseful) return;
      setSelectedVehicle((prev) => {
        if (!prev || !vehicleIdsEqual(prev.id, fresh.id)) return prev;
        const merged: Vehicle = {
          ...prev,
          sellerDisclosureChecklist: fresh.sellerDisclosureChecklist ?? prev.sellerDisclosureChecklist,
          certifiedInspection: fresh.certifiedInspection ?? prev.certifiedInspection,
          vahanSnapshot: fresh.vahanSnapshot ?? prev.vahanSnapshot,
          description: (fresh.description || '').trim() || prev.description,
          images: Array.isArray(fresh.images) && fresh.images.length > (prev.images?.length || 0)
            ? fresh.images
            : prev.images,
        };
        try {
          sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(merged));
        } catch {
          /* ignore */
        }
        return merged;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id, vehicle.databaseId, setSelectedVehicle]);

  const translatedDescription = useTranslatedText(safeVehicle.description);
  const translatedFeatures = useTranslatedArray(safeVehicle.features as string[]);
  const translatedFields = useTranslatedFields({
    fuelType: safeVehicle.fuelType,
    transmission: safeVehicle.transmission,
    color: safeVehicle.color,
    city: safeVehicle.city,
    state: safeVehicle.state,
    engine: safeVehicle.engine,
    displacement: safeVehicle.displacement,
  });

  const [ratingEligibility, setRatingEligibility] = useState<RatingEligibility | null>(null);
  const [ratingDealId, setRatingDealId] = useState<string | undefined>();

  useEffect(() => {
    if (!currentUser?.email) {
      setRatingEligibility(null);
      return;
    }
    void fetchRatingEligibility(safeVehicle.databaseId || safeVehicle.id)
      .then(({ eligibility, dealId }) => {
        setRatingEligibility(eligibility);
        setRatingDealId(dealId);
      })
      .catch(() => setRatingEligibility(null));
  }, [currentUser?.email, safeVehicle.id, safeVehicle.databaseId]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeMediaTab, setActiveMediaTab] = useState<'images' | 'video'>('images');
  const [activeTab, setActiveTab] = useState<'overview' | 'disclosure' | 'report' | 'vahan' | 'price'>('overview');
  const detailTabsRef = useRef<HTMLDivElement>(null);
  const [showSellerRatingSuccess, setShowSellerRatingSuccess] = useState(false);
  const [showEMICalculator, setShowEMICalculator] = useState<boolean>(false);
  const [showTestDriveForm, setShowTestDriveForm] = useState(false);
  const [testDriveDate, setTestDriveDate] = useState('');
  const [testDriveTime, setTestDriveTime] = useState('');
  const [isRequestingTestDrive, setIsRequestingTestDrive] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [vehicleDealLead, setVehicleDealLead] = useState<DealLead | null>(null);
  const ratingSuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emiCalculatorRef = useRef<HTMLDivElement>(null);
  const scrollToEmiOnShowRef = useRef(false);

  // ✅ FIX: Optimize useEffect dependency - only depend on vehicle.id and videoUrl
  useEffect(() => {
    setCurrentIndex(0);
    setShowEMICalculator(false);
    setShowTestDriveForm(false);
    setTestDriveDate('');
    setTestDriveTime('');
    scrollToEmiOnShowRef.current = false;
    setVehicleDealLead(null);
    setActiveMediaTab(vehicle.videoUrl ? 'video' : 'images');
    scrollAppToTop();
    requestAnimationFrame(() => scrollAppToTop());
  }, [vehicle.id, vehicle.videoUrl]);

  useTrackVehicleView(vehicle, { currentUser, updateVehicle });

  const refreshVehicleDealLead = useCallback(async () => {
    if (!currentUser?.email || safeVehicle.id == null) {
      setVehicleDealLead(null);
      return;
    }
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const lead = await getDealLead({ vehicleId: safeVehicle.id });
        if (lead) {
          setVehicleDealLead(lead);
          return;
        }
      } catch {
        /* retry */
      }
      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    setVehicleDealLead(null);
  }, [currentUser?.email, safeVehicle.id]);

  useEffect(() => {
    void refreshVehicleDealLead();
  }, [refreshVehicleDealLead]);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (ratingSuccessTimeoutRef.current) {
        clearTimeout(ratingSuccessTimeoutRef.current);
      }
    };
  }, []);

  // Scroll after EMI calculator mounts (ref is null until showEMICalculator is true)
  useEffect(() => {
    if (!showEMICalculator || !scrollToEmiOnShowRef.current) return;
    scrollToEmiOnShowRef.current = false;
    const scrollToCalculator = () => {
      emiCalculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToCalculator));
  }, [showEMICalculator]);

  const validImages = useMemo(() => getValidImages(safeVehicle.images, safeVehicle.id), [safeVehicle.images, safeVehicle.id]);

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

  const handleRateSeller = async (rating: number) => {
    if (ratingDealId) {
      try {
        await submitPeerRating(ratingDealId, Number(rating));
        setShowSellerRatingSuccess(true);
        setRatingEligibility((prev) => prev ? { ...prev, canRateSeller: false } : prev);
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Could not submit rating', 'error');
        return;
      }
    } else {
      onAddSellerRating(safeVehicle.sellerEmail, Number(rating));
      setShowSellerRatingSuccess(true);
    }
    if (ratingSuccessTimeoutRef.current) {
      clearTimeout(ratingSuccessTimeoutRef.current);
    }
    ratingSuccessTimeoutRef.current = setTimeout(() => setShowSellerRatingSuccess(false), 3000);
  };

  const handleFlagClick = () => {
      void runIfConfirmed(
        'Are you sure you want to report this listing for review by an administrator?',
        () => {
          setReportReason('');
          setShowReportModal(true);
        },
      );
  };

  const submitReportListing = () => {
    onFlagContent('vehicle', safeVehicle.id, reportReason.trim() || 'No reason provided');
    setShowReportModal(false);
    setReportReason('');
  };

  const isComparing = comparisonList.includes(safeVehicle.id);
  const isInWishlist = wishlist.includes(safeVehicle.id);
  const canRate = Boolean(ratingEligibility?.canRateSeller);
  const isCompareDisabled = isCompareDisabledForVehicle(
    safeVehicle,
    comparisonList,
    context.comparisonCategory,
  );
  
  // ✅ FIX: Normalize emails for comparison (consistent with codebase pattern)
  const seller = useMemo(() => {
    if (!safeVehicle.sellerEmail) return undefined;
    const normalizedSellerEmail = safeVehicle.sellerEmail.toLowerCase().trim();
    return users.find(u => {
      if (!u || !u.email) return false;
      return u.email.toLowerCase().trim() === normalizedSellerEmail;
    });
  }, [users, safeVehicle.sellerEmail]);

  const sellerDisplayName =
    seller?.dealershipName || seller?.name || safeVehicle.sellerName || t('vehicle.card.sellerFallback');
  const sellerInitial = (
    seller?.dealershipName || seller?.name || safeVehicle.sellerName || safeVehicle.sellerEmail || 'S'
  )
    .charAt(0)
    .toUpperCase();
  const sellerAvatarSrc = seller?.logoUrl
    ? getSafeImageSrc(seller.logoUrl, '')
    : seller?.avatarUrl
      ? getSafeImageSrc(seller.avatarUrl, '')
      : '';
  const hasSellerInfo = Boolean(
    seller ||
      safeVehicle.sellerEmail?.trim() ||
      (safeVehicle.sellerName?.trim() && safeVehicle.sellerName !== 'Seller'),
  );
  const isDealerSeller = Boolean(seller?.dealershipName);
  const showStaffPick = seller ? isRerideStaffPick(seller.rerideRecommended) : false;
  const sellerProfileEmail = useMemo(() => {
    const direct = (safeVehicle.sellerEmail || seller?.email || '').toLowerCase().trim();
    if (direct) return direct;

    const name = (seller?.dealershipName || seller?.name || safeVehicle.sellerName || '').trim().toLowerCase();
    if (!name || name === 'seller') return '';

    const byName = users.find((u) => {
      if (!u?.email) return false;
      const dealership = u.dealershipName?.toLowerCase().trim();
      const userName = u.name?.toLowerCase().trim();
      return dealership === name || userName === name;
    });
    return byName?.email?.toLowerCase().trim() || '';
  }, [safeVehicle.sellerEmail, safeVehicle.sellerName, seller, users]);

  const canViewSellerProfile = Boolean(sellerProfileEmail);

  const handleViewSellerProfile = () => {
    if (!sellerProfileEmail) return;
    onViewSellerProfile(sellerProfileEmail);
  };

  const listingAvailable = isListingAvailable(safeVehicle);

  const handleChatWithSeller = async () => {
    await Promise.resolve(onStartChat(safeVehicle));
    if (currentUser) {
      await refreshVehicleDealLead();
    }
  };

  const handleRequestTestDriveSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onRequestTestDrive || !testDriveDate || !testDriveTime || isRequestingTestDrive) return;
    setIsRequestingTestDrive(true);
    try {
      await Promise.resolve(
        onRequestTestDrive(safeVehicle, {
          date: testDriveDate,
          time: testDriveTime,
        }),
      );
      setShowTestDriveForm(false);
      if (currentUser) {
        await refreshVehicleDealLead();
      }
    } finally {
      setIsRequestingTestDrive(false);
    }
  };

  const filteredRecommendations = useMemo(() => {
      const pool = recommendations.filter(rec => rec.id !== safeVehicle.id);
      if (pool.length === 0) return [];

      const targetPrice = safeVehicle.price || 0;
      const priceDistance = (v: Vehicle) =>
        targetPrice > 0 ? Math.abs((v.price || 0) - targetPrice) / targetPrice : Math.abs(v.price || 0);

      // Only recommend vehicles of the same category when any exist, so a
      // commercial vehicle never surfaces unrelated passenger cars (and vice versa).
      const sameCategory = pool.filter(rec => rec.category === safeVehicle.category);
      const candidates = sameCategory.length > 0 ? sameCategory : pool;

      return candidates
        .slice()
        .sort((a, b) => {
          // Prefer matching fuel type, then the closest price.
          const fuelA = a.fuelType === safeVehicle.fuelType ? 0 : 1;
          const fuelB = b.fuelType === safeVehicle.fuelType ? 0 : 1;
          if (fuelA !== fuelB) return fuelA - fuelB;
          return priceDistance(a) - priceDistance(b);
        })
        .slice(0, 3);
  }, [recommendations, safeVehicle.id, safeVehicle.category, safeVehicle.fuelType, safeVehicle.price]);

  const similarVehiclesForPricing = useMemo(() => {
    const pool = [...(contextVehicles || []), ...recommendations];
    const seen = new Set<number>();
    const deduped = pool.filter((v) => {
      if (!v || v.id === safeVehicle.id || v.status !== 'published') return false;
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
    return findSimilarVehicles(safeVehicle, deduped).slice(0, 20);
  }, [contextVehicles, recommendations, safeVehicle]);

  const openPriceTab = () => {
    setActiveTab('price');
    detailTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openChecklistTab = () => {
    setActiveTab(hasSellerDisclosureReport(safeVehicle) ? 'disclosure' : 'overview');
    detailTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const listingLocation =
    safeVehicle.location ||
    [translatedFields.city, translatedFields.state].filter(Boolean).join(', ') ||
    t('vehicle.detail.locationNotSpecified');

  const vehicleTitle = [safeVehicle.make, safeVehicle.model].filter(Boolean).join(' ');

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
      <VehicleJsonLd vehicle={safeVehicle} />
      <div className="bg-[#F7F8FA] dark:bg-[#F7F8FA] animate-fade-in vehicle-detail-page">
          <div className="mx-auto w-full max-w-[1600px] py-3 sm:py-4 lg:py-5 px-3 sm:px-5 lg:px-6 xl:px-8">
              <button type="button" onClick={onBackToHome} className="mb-3 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('vehicle.detail.backToListings')}
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4 lg:gap-5 xl:gap-6">
                  {/* Left Column: Media and Details */}
                  <div className="min-w-0 space-y-3">
                    {safeVehicle.videoUrl && (
                      <div className="flex space-x-2 border-b-2 border-gray-200">
                        <button
                          onClick={() => setActiveMediaTab('images')}
                          className={`py-2 px-4 font-semibold transition-colors ${
                            activeMediaTab === 'images'
                              ? 'border-b-2 border-[#FF6B35] text-[#FF6B35]'
                              : 'text-gray-600'
                          }`}
                        >
                          {t('vehicle.detail.media.images')}
                        </button>
                        <button
                          onClick={() => setActiveMediaTab('video')}
                          className={`py-2 px-4 font-semibold transition-colors ${
                            activeMediaTab === 'video'
                              ? 'border-b-2 border-[#FF6B35] text-[#FF6B35]'
                              : 'text-gray-600'
                          }`}
                        >
                          {t('vehicle.detail.media.video')}
                        </button>
                      </div>
                    )}
                    {activeMediaTab === 'images' ? (
                      <>
                        {validImages.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5.75rem] lg:grid-cols-[minmax(0,1fr)_6rem] gap-2.5 sm:gap-3 items-start">
                            <div className="relative group min-w-0 w-full overflow-hidden rounded-2xl bg-slate-100 shadow-sm aspect-[16/9]">
                              <img
                                key={currentIndex}
                                className="absolute inset-0 h-full w-full object-cover animate-fade-in"
                                src={getSafeImageSrc(
                                  validImages[currentIndex] || getFirstValidImage(safeVehicle.images, safeVehicle.id),
                                  VEHICLE_IMAGE_PLACEHOLDER_DATA_URI
                                )}
                                alt={`${safeVehicle.make} ${safeVehicle.model} - Image ${currentIndex + 1}`}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const textCarParam = (() => {
                                    try {
                                      return new URL(target.src, 'https://invalid.invalid/').searchParams.get('text') === 'Car';
                                    } catch {
                                      return false;
                                    }
                                  })();
                                  if (!isInlineImagePlaceholder(target.src) && !isPlaceholderService(target.src) && !textCarParam) {
                                    target.src = VEHICLE_IMAGE_PLACEHOLDER_DATA_URI;
                                  }
                                }}
                                loading="lazy"
                              />
                              {validImages.length > 1 && (
                                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handlePrevImage}
                                    className="bg-black/55 hover:bg-black/75 text-white p-2.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                                    aria-label={t('vehicle.detail.media.previousImage')}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleNextImage}
                                    className="bg-black/55 hover:bg-black/75 text-white p-2.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                                    aria-label={t('vehicle.detail.media.nextImage')}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                            {validImages.length > 1 && (
                              <div className="hidden sm:flex max-h-[min(28rem,calc((100vw-24rem)*9/16))] lg:max-h-[min(32rem,calc((100vw-28rem)*9/16))] w-full flex-col gap-2 overflow-y-auto scrollbar-hide">
                                {validImages.map((img, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => setCurrentIndex(index)}
                                    onMouseEnter={() => setCurrentIndex(index)}
                                    onFocus={() => setCurrentIndex(index)}
                                    className={`relative overflow-hidden rounded-lg flex-shrink-0 aspect-square border-2 transition-colors focus:outline-none ${
                                      currentIndex === index
                                        ? 'border-[#1E88E5]'
                                        : 'border-transparent hover:border-[#1E88E5]/50'
                                    }`}
                                    aria-label={`Thumbnail ${index + 1}`}
                                    aria-current={currentIndex === index ? 'true' : undefined}
                                  >
                                    <img
                                      src={getSafeImageSrc(img)}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = VEHICLE_THUMB_PLACEHOLDER_DATA_URI;
                                      }}
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full aspect-[16/9] bg-gray-100 rounded-2xl flex items-center justify-center">
                            <div className="text-center text-gray-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-lg font-medium">
                                {t('vehicle.detail.media.noImagesAvailable')}
                              </p>
                            </div>
                          </div>
                        )}
                        {validImages.length > 1 && (
                          <div className="flex sm:hidden space-x-2 overflow-x-auto pb-1 scrollbar-hide">
                            {validImages.map((img, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => setCurrentIndex(index)}
                                onMouseEnter={() => setCurrentIndex(index)}
                                onFocus={() => setCurrentIndex(index)}
                                className={`flex-shrink-0 overflow-hidden rounded-lg h-14 w-20 border-2 ${
                                  currentIndex === index ? 'border-[#1E88E5]' : 'border-transparent'
                                }`}
                              >
                                <img
                                  src={getSafeImageSrc(img)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = VEHICLE_THUMB_PLACEHOLDER_DATA_URI;
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full aspect-video bg-black rounded-2xl shadow-lg overflow-hidden animate-fade-in">
                        <video src={safeVehicle.videoUrl} controls className="w-full h-full object-cover">
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}
                    
                    {/* Tab Navigation - Reride Style */}
                    <div className="mt-4 lg:mt-5 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm" ref={detailTabsRef}>
                      <div className="bg-white border-b border-gray-200 overflow-x-auto">
                        <div className="flex space-x-0.5 min-w-max sm:min-w-0">
                          <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm uppercase transition-colors relative ${
                              activeTab === 'overview'
                                ? 'text-[#FF6B35]'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {t('vehicle.detail.tabs.overview')}
                            {activeTab === 'overview' && (
                              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35]"></span>
                            )}
                          </button>
                          {hasSellerDisclosureReport(safeVehicle) && (
                            <button
                              onClick={() => setActiveTab('disclosure')}
                              className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm uppercase transition-colors relative ${
                                activeTab === 'disclosure'
                                  ? 'text-[#FF6B35]'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {t('vehicle.detail.tabs.disclosure')}
                              {activeTab === 'disclosure' && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35]"></span>
                              )}
                            </button>
                          )}
                          {safeVehicle.certifiedInspection && (
                            <button
                              onClick={() => setActiveTab('report')}
                              className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm uppercase transition-colors relative ${
                                activeTab === 'report'
                                  ? 'text-[#FF6B35]'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {t('vehicle.detail.tabs.report')}
                              {activeTab === 'report' && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35]"></span>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => setActiveTab('vahan')}
                            className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm uppercase transition-colors relative ${
                              activeTab === 'vahan'
                                ? 'text-[#FF6B35]'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {t('vehicle.detail.tabs.vahan')}
                            {activeTab === 'vahan' && (
                              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35]"></span>
                            )}
                          </button>
                          {PRICE_ANALYSIS_ENABLED && (
                          <button
                            onClick={() => setActiveTab('price')}
                            className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm uppercase transition-colors relative ${
                              activeTab === 'price'
                                ? 'text-[#FF6B35]'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {t('vehicle.detail.tabs.price', 'Price')}
                            {activeTab === 'price' && (
                              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35]"></span>
                            )}
                          </button>
                          )}
                        </div>
                      </div>

                      {/* Tab Content */}
                      <div className="bg-white">
                        {activeTab === 'overview' && (
                          <div className="p-4 sm:p-5">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
                              {/* Left Column - Overview Content */}
                              <div className="lg:col-span-2 space-y-5">
                                <VehicleDetailTrustStrip />
                                <div>
                                  <h3 className="mb-3 text-base font-semibold text-slate-900">
                                    {t('vehicle.detail.atAGlance', { defaultValue: 'At a glance' })}
                                  </h3>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                                    <KeySpec label={t('vehicle.year')} value={safeVehicle.year} />
                                    <KeySpec
                                      label={t('vehicle.spec.registrationYear')}
                                      value={safeVehicle.registrationYear}
                                    />
                                    <KeySpec label={t('vehicle.fuel')} value={translatedFields.fuelType} />
                                    <KeySpec
                                      label={t('vehicle.mileage')}
                                      value={typeof safeVehicle.mileage === 'number' ? safeVehicle.mileage.toLocaleString('en-IN') : '0'}
                                    />
                                    <KeySpec label={t('vehicle.transmission')} value={translatedFields.transmission} />
                                    <KeySpec label={t('vehicle.spec.ownersShort')} value={safeVehicle.noOfOwners} />
                                    <KeySpec label={t('vehicle.detail.specs.insurance')} value={(() => {
                                      const formatted = formatInsuranceValidity(
                                        safeVehicle.insuranceValidity,
                                        safeVehicle.year || safeVehicle.registrationYear,
                                      );
                                      if (!formatted) return t('vehicle.detail.insurance.notSpecified');
                                      if (formatted === INSURANCE_INVALID_DATE_TOKEN) {
                                        return t('vehicle.detail.insurance.invalidDate');
                                      }
                                      return formatted;
                                    })()} />
                                    <KeySpec label={t('vehicle.detail.specs.rto')} value={safeVehicle.rto} />
                                  </div>
                                </div>
                                <VehicleFeatureSpecsPanel
                                  omitGlanceDuplicates
                                  specs={{
                                    engine: translatedFields.engine,
                                    displacement: translatedFields.displacement,
                                    transmission: translatedFields.transmission,
                                    fuelType: translatedFields.fuelType,
                                    fuelEfficiency: safeVehicle.fuelEfficiency,
                                    groundClearance: safeVehicle.groundClearance,
                                    bootSpace: safeVehicle.bootSpace,
                                    color: translatedFields.color,
                                  }}
                                  features={translatedFeatures}
                                />
                                {safeVehicle.description ? (
                                  <VehicleDescriptionDisplay
                                    text={translatedDescription}
                                    heading={t('vehicle.detail.sellerNotes', { defaultValue: 'Seller notes' })}
                                  />
                                ) : null}
                              </div>

                              {/* Right Column - Finance Partners Card (Desktop) */}
                              {seller && (
                                <div className="hidden lg:block lg:col-span-1">
                                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-4 shadow-md h-fit">
                                    <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                      </svg>
                                      {t('vehicle.detail.financePartners.title')}
                                    </h3>
                                    {seller.partnerBanks && seller.partnerBanks.length > 0 ? (
                                      <div className="space-y-3">
                                        <p className="text-xs text-gray-600">
                                          {t('vehicle.detail.financePartners.description')}
                                        </p>
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
                                        <span>{t('vehicle.detail.financePartners.none')}</span>
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
                                    {t('vehicle.detail.financePartners.title')}
                                  </h3>
                                  {seller.partnerBanks && seller.partnerBanks.length > 0 ? (
                                    <div className="space-y-3">
                                      <p className="text-xs text-gray-600">
                                        {t('vehicle.detail.financePartners.description')}
                                      </p>
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
                                      <span>{t('vehicle.detail.financePartners.none')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {activeTab === 'disclosure' && hasSellerDisclosureReport(safeVehicle) && (
                          <div className="p-4 sm:p-5">
                            <SellerDisclosureDisplay
                              checklist={safeVehicle.sellerDisclosureChecklist}
                              category={safeVehicle.category}
                              vahanSnapshot={safeVehicle.vahanSnapshot}
                            />
                          </div>
                        )}

                        {activeTab === 'report' && safeVehicle.certifiedInspection && (
                          <div className="p-4 sm:p-5">
                            <CertifiedInspectionReport report={safeVehicle.certifiedInspection} />
                          </div>
                        )}

                        {activeTab === 'vahan' && (
                          <div className="p-4 sm:p-5 space-y-6">
                            {/* Show login prompt for non-logged-in users */}
                            {!currentUser ? (
                              <div className="space-y-6">
                                {/* Unlock banner — let buyers see what's gated instead of a blank wall */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-4">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-gray-900">{t('vehicle.detail.vahan.loginRequired')}</p>
                                      <p className="text-sm text-gray-600">{t('vehicle.detail.vahan.loginDescription')}</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onRequestLogin) {
                                        onRequestLogin();
                                        return;
                                      }
                                      void onStartChat(safeVehicle);
                                    }}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex-shrink-0"
                                  >
                                    {t('vehicle.detail.vahan.loginButton')}
                                  </button>
                                </div>

                                {/* Visible non-sensitive summary */}
                                <div>
                                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    {t('vehicle.detail.vahan.ownershipStatus')}
                                  </h4>
                                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-gray-50 rounded-lg p-4">
                                    <SpecDetail label={t('vehicle.detail.vahan.registeredState')} value={safeVehicle.state || '-'} />
                                    <SpecDetail label={t('vehicle.detail.vahan.rtoOffice')} value={safeVehicle.rto || '-'} />
                                    <SpecDetail label={t('vehicle.detail.vahan.registrationDate')} value={safeVehicle.registrationYear ? `${safeVehicle.registrationYear}` : '-'} />
                                    <SpecDetail label={t('vehicle.detail.vahan.numberOfOwners')} value={safeVehicle.noOfOwners ? `${safeVehicle.noOfOwners}${safeVehicle.noOfOwners === 1 ? 'st' : safeVehicle.noOfOwners === 2 ? 'nd' : safeVehicle.noOfOwners === 3 ? 'rd' : 'th'} Owner` : '-'} />
                                  </dl>
                                </div>

                                {/* Locked sensitive identifiers */}
                                <div>
                                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                                    </svg>
                                    {t('vehicle.detail.vahan.registrationDetails')}
                                  </h4>
                                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-gray-50 rounded-lg p-4">
                                    {[
                                      t('vehicle.detail.vahan.registrationNumber'),
                                      t('vehicle.detail.vahan.engineNumber'),
                                      t('vehicle.detail.vahan.chassisNumber'),
                                    ].map((label) => (
                                      <div key={label} className="flex flex-col">
                                        <dt className="text-sm text-gray-500">{label}</dt>
                                        <dd className="flex items-center gap-1.5 mt-0.5">
                                          <span className="select-none blur-sm text-gray-700 font-medium" aria-hidden>XX00XX0000</span>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                          </svg>
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              </div>
                            ) : (
                            <>
                            {/* Vahan Header - Check if actually verified */}
                            {(() => {
                              const isVahanVerified = !!(safeVehicle as Vehicle & { vahanVerifiedAt?: string }).vahanVerifiedAt;
                              return (
                                <>
                                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isVahanVerified ? 'bg-green-100' : 'bg-amber-100'}`}>
                                      {isVahanVerified ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-semibold text-gray-900">
                                          {t('vehicle.detail.vahan.title')}
                                        </h3>
                                        {isVahanVerified ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            {t('vehicle.detail.vahan.verified')}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                            {t('vehicle.detail.vahan.notVerified')}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-500">
                                        {isVahanVerified 
                                          ? t('vehicle.detail.vahan.subtitle') 
                                          : t('vehicle.detail.vahan.sellerProvided')}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Not Verified Warning Banner */}
                                  {!isVahanVerified && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                      </svg>
                                      <div>
                                        <p className="text-sm font-medium text-amber-800">
                                          {t('vehicle.detail.vahan.notVerifiedTitle')}
                                        </p>
                                        <p className="text-sm text-amber-700 mt-1">
                                          {t('vehicle.detail.vahan.notVerifiedDescription')}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {/* Registration Details */}
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                                </svg>
                                {t('vehicle.detail.vahan.registrationDetails')}
                              </h4>
                              {/* Check if seller has provided Vahan verification details */}
                              {(() => {
                                const extVehicle = safeVehicle as Vehicle & { registrationNumber?: string; engineNumber?: string; chassisNumber?: string };
                                const hasVahanDetails = extVehicle.registrationNumber || extVehicle.engineNumber || extVehicle.chassisNumber;
                                
                                if (!hasVahanDetails) {
                                  return (
                                    <div className="bg-gray-100 border border-gray-200 rounded-lg p-6 text-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <p className="text-gray-600 font-medium">{t('vehicle.detail.vahan.noDetailsProvided')}</p>
                                      <p className="text-sm text-gray-500 mt-1">{t('vehicle.detail.vahan.sellerNotProvided')}</p>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-gray-50 rounded-lg p-4">
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.registrationNumber')} 
                                      value={maskVehicleIdentifier(extVehicle.registrationNumber)} 
                                    />
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.registrationDate')} 
                                      value={safeVehicle.registrationYear ? `${safeVehicle.registrationYear}` : '-'} 
                                    />
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.engineNumber')} 
                                      value={maskVehicleIdentifier(extVehicle.engineNumber)} 
                                    />
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.chassisNumber')} 
                                      value={maskVehicleIdentifier(extVehicle.chassisNumber)} 
                                    />
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.rtoOffice')} 
                                      value={safeVehicle.rto || '-'} 
                                    />
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.registeredState')} 
                                      value={safeVehicle.state || '-'} 
                                    />
                                  </dl>
                                );
                              })()}
                            </div>

                            {/* Ownership & Insurance Status */}
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                {t('vehicle.detail.vahan.ownershipStatus')}
                              </h4>
                              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-gray-50 rounded-lg p-4">
                                <SpecDetail label={t('vehicle.detail.vahan.numberOfOwners')} value={safeVehicle.noOfOwners ? `${safeVehicle.noOfOwners}${safeVehicle.noOfOwners === 1 ? 'st' : safeVehicle.noOfOwners === 2 ? 'nd' : safeVehicle.noOfOwners === 3 ? 'rd' : 'th'} Owner` : '-'} />
                                <SpecDetail label={t('vehicle.detail.vahan.insuranceValidity')} value={(() => {
                                  const insurance = safeVehicle.insuranceValidity;
                                  if (!insurance || insurance.trim() === '') return t('vehicle.detail.insurance.notSpecified');
                                  if (insurance.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    const insuranceDate = new Date(insurance);
                                    const now = new Date();
                                    const isExpired = insuranceDate < now;
                                    return (
                                      <span className={isExpired ? 'text-red-600' : 'text-green-600'}>
                                        {insuranceDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        {isExpired ? ' (Expired)' : ' (Active)'}
                                      </span>
                                    );
                                  }
                                  return insurance;
                                })()} />
                                <SpecDetail label={t('vehicle.detail.vahan.fitnessStatus')} value={
                                  safeVehicle.vahanSnapshot?.fitnessUpto ? (
                                    <span className="text-green-600 font-medium">{safeVehicle.vahanSnapshot.fitnessUpto}</span>
                                  ) : (
                                    <span className="text-gray-500">{t('vehicle.detail.vahan.fitnessValid')}</span>
                                  )
                                } />
                                <SpecDetail label={t('vehicle.detail.vahan.hypothecation')} value={
                                  safeVehicle.vahanSnapshot ? (
                                    <span className="text-gray-600">
                                      {safeVehicle.vahanSnapshot.hypothecation
                                        ? safeVehicle.vahanSnapshot.hypothecationBank || 'Yes'
                                        : t('vehicle.detail.vahan.noHypothecation')}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">{t('vehicle.detail.vahan.noHypothecation')}</span>
                                  )
                                } />
                              </dl>
                            </div>

                            {/* Disclaimer */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <p className="text-sm text-yellow-800">
                                {t('vehicle.detail.vahan.disclaimer')}
                              </p>
                            </div>
                            </>
                            )}
                          </div>
                        )}

                        {activeTab === 'price' && (
                          <div className="p-4 sm:p-5">
                            <PriceInsights
                              vehicle={safeVehicle}
                              similarVehicles={similarVehiclesForPricing}
                              buyerFacing
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional Sections Below Tabs */}
                    <div className="mt-6 space-y-6">
                    {showEMICalculator && (
                        <div id="emi-calculator" ref={emiCalculatorRef} className="mt-8 scroll-mt-24">
                            <EMICalculator
                              principal={safeVehicle.price}
                              onClose={() => setShowEMICalculator(false)}
                            />
                        </div>
                    )}

                  </div>
                  </div>
                  
                  {/* Right Column: pricing + contact — sticky on scroll */}
                  <div className="lg:sticky lg:top-20 lg:h-fit lg:self-start lg:z-10">
                      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.08)] border border-gray-100 overflow-hidden flex flex-col">
                        <div className="p-4 sm:p-5 flex flex-col gap-4">
                          <div>
                            <h1 className="text-[1.35rem] sm:text-[1.5rem] font-bold text-gray-900 leading-tight tracking-tight">
                              {vehicleTitle}
                            </h1>
                            <p className="mt-2 text-[1.65rem] sm:text-[1.85rem] font-bold text-gray-900 leading-none">
                              {formatCurrency(safeVehicle.price)}
                            </p>
                            <p className="mt-1.5 text-sm text-gray-500">{listingLocation}</p>
                          </div>

                          {hasSellerInfo ? (
                            <button
                              type="button"
                              onClick={handleViewSellerProfile}
                              disabled={!canViewSellerProfile}
                              className={`flex items-center gap-3 text-left w-full ${
                                canViewSellerProfile ? 'hover:opacity-90' : 'cursor-default'
                              }`}
                            >
                              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#1E88E5] shadow-sm ring-1 ring-slate-200">
                                <div className="absolute inset-0 flex items-center justify-center text-base font-bold text-white" aria-hidden>
                                  {sellerInitial}
                                </div>
                                {sellerAvatarSrc ? (
                                  <img
                                    src={sellerAvatarSrc}
                                    alt=""
                                    className="relative h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                {isDealerSeller && seller?.isVerified ? (
                                  <span className="mb-0.5 inline-flex rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                    {t('vehicle.detail.verifiedDealer', { defaultValue: 'Verified Dealer' })}
                                  </span>
                                ) : null}
                                <p className="font-semibold text-gray-900 truncate">{sellerDisplayName}</p>
                                <p className="text-sm text-gray-500 truncate">
                                  {isDealerSeller
                                    ? t('vehicle.detail.dealership', 'Dealership')
                                    : t('vehicle.detail.individualSeller', { defaultValue: 'Individual seller' })}
                                  {showStaffPick ? ` · ${t('vehicle.detail.staffPick', { defaultValue: 'ReRide pick' })}` : ''}
                                </p>
                              </div>
                            </button>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-2">
                            <ListingStockBadge vehicle={safeVehicle} size="md" />
                            <VerificationBadge vehicle={safeVehicle} />
                          </div>

                          {vehicleDealLead ? (
                            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
                              <DealStageChip lead={vehicleDealLead} className="mb-1" />
                              <button
                                type="button"
                                onClick={() => void handleChatWithSeller()}
                                className="text-xs font-semibold text-blue-700 hover:underline"
                              >
                                {t('vehicle.detail.viewDealTimeline', { defaultValue: 'View deal timeline' })}
                              </button>
                            </div>
                          ) : null}

                          <div className="space-y-2.5" aria-label={t('vehicle.detail.contactActions')}>
                            <button
                              type="button"
                              onClick={() => void handleChatWithSeller()}
                              data-testid="start-tracked-deal"
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6B35] hover:bg-[#E85A28] text-white font-semibold py-3 px-4 text-sm transition-colors shadow-sm"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {vehicleDealLead
                                ? t('vehicle.detail.openDealRoom', { defaultValue: 'Open deal room' })
                                : t('vehicle.detail.chat')}
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onToggleWishlist(safeVehicle.id)}
                              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-sm font-semibold transition-colors ${
                                isInWishlist
                                  ? 'border-red-200 bg-red-50 text-red-600'
                                  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                              }`}
                              aria-label={isInWishlist ? t('vehicle.card.wishlistRemove') : t('vehicle.card.wishlistAdd')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill={isInWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isInWishlist ? 0 : 1.5} aria-hidden>
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                              </svg>
                              {t('vehicle.detail.wishlist', 'Wishlist')}
                            </button>
                            <SocialShareButtons vehicle={safeVehicle} variant="pill" />
                          </div>

                          <button
                            type="button"
                            onClick={openChecklistTab}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#E53935] text-[11px] font-bold text-white" aria-hidden>
                              A
                            </span>
                            {t('vehicle.detail.checklist', 'Checklist')}
                          </button>

                          <div className="pt-1 border-t border-gray-100 space-y-3">
                            <PriceInsights
                              vehicle={safeVehicle}
                              similarVehicles={similarVehiclesForPricing}
                              buyerFacing
                              compact
                              compactHidePrice
                              onViewFullAnalysis={openPriceTab}
                            />
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-lg font-bold text-gray-900">{formatCurrency(baseEMI)}/m</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (showEMICalculator) {
                                    setShowEMICalculator(false);
                                    return;
                                  }
                                  scrollToEmiOnShowRef.current = true;
                                  setShowEMICalculator(true);
                                }}
                                className="text-sm text-[#1E88E5] font-semibold hover:underline"
                              >
                                {showEMICalculator ? t('vehicle.detail.hideEmiCalculator') : t('vehicle.detail.price.calculateEmi')}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => onToggleCompare(safeVehicle.id)}
                              disabled={isCompareDisabled}
                              className={`w-full font-semibold py-2.5 px-3 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 border ${
                                isComparing
                                  ? 'bg-blue-50 text-[#1E88E5] border-blue-100'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              } ${isCompareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {isComparing ? t('vehicle.detail.comparing') : t('vehicle.detail.compare')}
                            </button>
                          </div>

                          {canRate && seller ? (
                            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-gray-700">{t('vehicle.detail.rateExperience', { defaultValue: 'Rate your experience' })}</p>
                                <StarRating rating={0} onRate={handleRateSeller} />
                              </div>
                              {showSellerRatingSuccess ? (
                                <p className="text-center text-green-600 text-xs mt-1">
                                  {t('vehicle.detail.ratingThanks', { defaultValue: 'Thanks for your feedback!' })}
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {onRequestTestDrive && listingAvailable && testDriveBookingState(vehicleDealLead) === 'available' ? (
                            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-3">
                              {showTestDriveForm ? (
                                <form className="space-y-2" onSubmit={handleRequestTestDriveSubmit}>
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="block">
                                      <span className="mb-1 block text-xs font-semibold text-gray-700">
                                        {t('vehicle.detail.testDriveDate', { defaultValue: 'Date' })}
                                      </span>
                                      <input
                                        type="date"
                                        value={testDriveDate}
                                        min={new Date().toISOString().slice(0, 10)}
                                        onChange={(event) => setTestDriveDate(event.target.value)}
                                        className="w-full rounded-lg border border-orange-200 bg-white px-2 py-2 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                        required
                                      />
                                    </label>
                                    <label className="block">
                                      <span className="mb-1 block text-xs font-semibold text-gray-700">
                                        {t('vehicle.detail.testDriveTime', { defaultValue: 'Time' })}
                                      </span>
                                      <input
                                        type="time"
                                        value={testDriveTime}
                                        onChange={(event) => setTestDriveTime(event.target.value)}
                                        className="w-full rounded-lg border border-orange-200 bg-white px-2 py-2 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                        required
                                      />
                                    </label>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="submit"
                                      disabled={!testDriveDate || !testDriveTime || isRequestingTestDrive}
                                      className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isRequestingTestDrive
                                        ? t('common.sending', { defaultValue: 'Sending...' })
                                        : t('vehicle.detail.sendTestDriveRequest', { defaultValue: 'Send request' })}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowTestDriveForm(false)}
                                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                      {t('common.cancel', { defaultValue: 'Cancel' })}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowTestDriveForm(true)}
                                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-orange-600 shadow-sm ring-1 ring-orange-200 transition-colors hover:bg-orange-50"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {t('vehicle.detail.bookTestDrive')}
                                </button>
                              )}
                            </div>
                          ) : onRequestTestDrive && listingAvailable && testDriveBookingState(vehicleDealLead) === 'locked' ? (
                            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              {t('vehicle.detail.testDriveLocked')}
                            </p>
                          ) : null}

                          <ListingTrustStatusBar vehicle={safeVehicle} />
                        </div>
                      </div>
                  </div>
              </div>

              <div className="text-center mt-8">
                  <button
                    onClick={handleFlagClick}
                    className="text-xs text-reride-text hover:text-reride-orange"
                  >
                    {t('vehicle.detail.reportThisListing')}
                  </button>
              </div>

              {filteredRecommendations.length > 0 && (
                <div className="mt-8 pt-2 border-t border-gray-100">
                  <h2 className="text-xl sm:text-2xl font-bold text-reride-text-dark dark:text-reride-text-dark mb-4">
                    {t('vehicle.detail.similarVehicles')}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                    {filteredRecommendations.map(v => (
                      <VehicleCard
                        key={v.id}
                        vehicle={v}
                        onSelect={onSelectVehicle}
                        onToggleCompare={onToggleCompare}
                        isSelectedForCompare={comparisonList.includes(v.id)}
                        onToggleWishlist={onToggleWishlist}
                        isInWishlist={wishlist.includes(v.id)}
                        isCompareDisabled={isCompareDisabledForVehicle(v, comparisonList, context.comparisonCategory)}
                        onViewSellerProfile={onViewSellerProfile}
                      />
                    ))}
                  </div>
                </div>
              )}

          </div>
      </div>

      {showReportModal ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-listing-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-5 shadow-xl">
            <h3 id="report-listing-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Report this listing
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Tell us why this listing should be reviewed (optional).
            </p>
            <textarea
              className="mt-3 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-reride-orange"
              rows={4}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for reporting…"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-reride-orange px-4 py-2 text-sm font-semibold text-white hover:bg-reride-orange-hover"
                onClick={submitReportListing}
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </>
  );
};

export default VehicleDetail;

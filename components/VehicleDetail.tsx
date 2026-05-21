import React, { useState, useMemo, memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle, ProsAndCons, User, CertifiedInspection, VehicleDocument, AIInspectionReport as AIInspectionReportType } from '../types';
import { generateProsAndCons } from '../services/geminiService';
import { generateAIInspection } from '../services/aiInspectionService';
import AIInspectionReportComponent from './AIInspectionReport';
import { getFirstValidImage, getValidImages, getSafeImageSrc, VEHICLE_IMAGE_PLACEHOLDER_DATA_URI, VEHICLE_THUMB_PLACEHOLDER_DATA_URI, isInlineImagePlaceholder, isPlaceholderService } from '../utils/imageUtils';
import { stringifyVehicleForSession } from '../utils/vehicleSessionCache';
import StarRating from './StarRating';
import VehicleCard from './VehicleCard';
import EMICalculator from './EMICalculator';
import InlineChat from './InlineChat';
import { resolveChatCallPhone, resolveChatOtherPartyName } from '../utils/chatContact';
import VerificationBadge from './VerificationBadge';
import { VehicleOfferBanner } from './VehicleOfferBanner';
import VehicleHistory from './VehicleHistory';
import { getFollowersCount } from '../services/buyerEngagementService';
import { useApp } from './AppProvider';
import { logWarn, logDebug } from '../utils/logger';
import { scrollAppToTop } from '../utils/scrollAppToTop';
import { buildVehicleShareMessage, buildWhatsAppShareUrl, getVehicleListingUrl } from '../utils/whatsappShare.js';
import { buildSellerWhatsAppUrl, getSellerCallPhone } from '../utils/sellerContact.js';
import { trackPhoneView, trackShare } from '../services/listingService.js';
import { telHrefFromRawPhone } from '../utils/numberUtils.js';
import TestDriveModal from './TestDriveModal.js';
import { ListingStockBadge } from './ListingStockBadge.js';
import { ListingTrustChips } from './ListingTrustChips.js';
import VehicleDetailTrustStrip from './VehicleDetailTrustStrip.js';
import { isListingAvailable } from '../utils/listingStock.js';
import { PriceInsights } from './PriceInsights';

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
  onRequestTestDrive?: (vehicle: Vehicle, details: { date: string; time: string }) => void | Promise<void>;
  recommendations: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  updateVehicle?: (id: number, updates: Partial<Vehicle>, options?: { successMessage?: string; skipToast?: boolean }) => Promise<void>;
}

const SocialShareButtons: React.FC<{ vehicle: Vehicle }> = ({ vehicle }) => {
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
              : t('vehicle.share.copyLink');

    const handleWhatsAppShare = () => {
        const urlToShare = cleanListingUrl || (typeof window !== 'undefined' ? window.location.href : '');
        if (!urlToShare) return;
        const message = buildVehicleShareMessage(vehicle, urlToShare);
        window.open(buildWhatsAppShareUrl(message), '_blank', 'noopener,noreferrer');
        trackShare(vehicle.id, 'whatsapp');
    };

    return (
        <>
            <button
                type="button"
                onClick={handleWhatsAppShare}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-[#25D366] text-white px-3 py-2.5 rounded-lg hover:bg-[#20BA5A] transition-colors"
            >
                {t('vehicle.share.whatsapp', { defaultValue: 'WhatsApp' })}
            </button>
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
                    <div className="p-6 pt-0 border-t border-gray-200 dark:border-gray-200">
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

// External hotlink hosts (e.g. logos-world.net) block cross-origin embeds (CORP).
// BankLogo falls back to the emoji badge when no URL is returned.
const getBankLogoUrl = (_bankName: string): string => '';

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

const SpecDetail: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-200-100 dark:border-gray-200 last:border-b-0">
        <dt className="text-sm text-brand-gray-600 dark:text-reride-text">{label}</dt>
        <dd className="text-sm font-semibold text-reride-text-dark dark:text-brand-gray-200 text-right">{value || '-'}</dd>
    </div>
);


const DocumentChip: React.FC<{ doc: VehicleDocument }> = ({ doc }) => {
    return (
        <a href={doc.url} target="_blank" rel="noopener noreferrer" title={`View ${doc.fileName}`}
           className="flex items-center gap-2 bg-white dark:bg-white text-reride-text-dark dark:text-reride-text-dark px-3 py-1.5 rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-white transition-colors">
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
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center border-b dark:border-gray-200 pb-4 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-reride-orange flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44-1.22a.75 .75 0 00-1.06 0L8.172 6.172a.75 .75 0 00-1.06 1.06L8.94 9.332a.75 .75 0 001.191.04l3.22-4.294a.75 .75 0 00-.04-1.19z" clipRule="evenodd" />
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


export const VehicleDetail: React.FC<VehicleDetailProps> = ({ vehicle, onBack: onBackToHome, comparisonList, onToggleCompare, onAddSellerRating, wishlist, onToggleWishlist, currentUser, onFlagContent, users, onViewSellerProfile, onStartChat, onRequestTestDrive, recommendations, onSelectVehicle, updateVehicle: updateVehicleProp }) => {
  const { t } = useTranslation();

  // Get updateVehicle from context (hook must be called unconditionally)
  // Prefer prop over context if both are available
  const context = useApp();
  const updateVehicle = updateVehicleProp || context.updateVehicle;
  const {
    conversations,
    activeChat,
    vehicles: contextVehicles,
    sendMessage,
    sendMessageWithType,
    typingStatus,
    toggleTyping,
    markAsRead,
    clearConversationMessages,
    onOfferResponse,
    chatPeerOnlineByConversationId,
  } = context;
  
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
  const [activeTab, setActiveTab] = useState<'overview' | 'report' | 'features' | 'vahan' | 'aiReport'>('overview');
  const [showSellerRatingSuccess, setShowSellerRatingSuccess] = useState(false);
  const [prosAndCons, setProsAndCons] = useState<ProsAndCons | null>(null);
  const [isGeneratingProsCons, setIsGeneratingProsCons] = useState<boolean>(false);
  const [aiInspectionReport, setAiInspectionReport] = useState<AIInspectionReportType | null>(null);
  const [isGeneratingAIInspection, setIsGeneratingAIInspection] = useState(false);
  const [aiInspectionError, setAiInspectionError] = useState<string | null>(null);
  const [showEMICalculator, setShowEMICalculator] = useState<boolean>(false);
  const [showSellerChat, setShowSellerChat] = useState(false);
  const [showTestDriveModal, setShowTestDriveModal] = useState(false);
  const ratingSuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emiCalculatorRef = useRef<HTMLDivElement>(null);
  const scrollToEmiOnShowRef = useRef(false);
  const sellerChatRef = useRef<HTMLDivElement>(null);
  const scrollToChatOnShowRef = useRef(false);
  const trackedViewRef = useRef<Set<number>>(new Set());

  // ✅ FIX: Optimize useEffect dependency - only depend on vehicle.id and videoUrl
  useEffect(() => {
    setCurrentIndex(0);
    setProsAndCons(null);
    setIsGeneratingProsCons(false);
    setShowEMICalculator(false);
    scrollToEmiOnShowRef.current = false;
    setShowSellerChat(false);
    scrollToChatOnShowRef.current = false;
    setShowTestDriveModal(false);
    setActiveMediaTab(vehicle.videoUrl ? 'video' : 'images');
    scrollAppToTop();
    requestAnimationFrame(() => scrollAppToTop());
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

  // Scroll after EMI calculator mounts (ref is null until showEMICalculator is true)
  useEffect(() => {
    if (!showEMICalculator || !scrollToEmiOnShowRef.current) return;
    scrollToEmiOnShowRef.current = false;
    const scrollToCalculator = () => {
      emiCalculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToCalculator));
  }, [showEMICalculator]);

  const listingConversation = useMemo(() => {
    if (!currentUser || currentUser.role !== 'customer') return null;
    const customerEmail = currentUser.email?.toLowerCase().trim();
    if (!customerEmail) return null;
    if (
      activeChat?.vehicleId === safeVehicle.id &&
      activeChat.customerId?.toLowerCase().trim() === customerEmail
    ) {
      return activeChat;
    }
    return (
      conversations.find(
        (c) =>
          c.vehicleId === safeVehicle.id &&
          c.customerId?.toLowerCase().trim() === customerEmail,
      ) ?? null
    );
  }, [currentUser, activeChat, conversations, safeVehicle.id]);

  // Scroll after seller chat section mounts
  useEffect(() => {
    if (!showSellerChat || !scrollToChatOnShowRef.current || !listingConversation) return;
    scrollToChatOnShowRef.current = false;
    const scrollToChat = () => {
      sellerChatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToChat));
  }, [showSellerChat, listingConversation]);
  
  // ✅ FIX: Use valid images for navigation to prevent index errors
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

  const handleGenerateProsCons = async () => {
    setIsGeneratingProsCons(true);
    try {
      const result = await generateProsAndCons(safeVehicle);
      setProsAndCons(result);
    } catch (error) {
      console.error('Failed to generate pros/cons:', error);
      setProsAndCons({
        pros: [],
        cons: [
          error instanceof Error
            ? error.message
            : 'Could not generate suggestions. Please try again later.',
        ],
      });
    } finally {
      setIsGeneratingProsCons(false);
    }
  };

  const handleGenerateAIInspection = async () => {
    if (!safeVehicle.images || safeVehicle.images.length < 1) {
      setAiInspectionError('At least 1 photo is required for AI inspection');
      return;
    }
    
    setIsGeneratingAIInspection(true);
    setAiInspectionError(null);
    
    try {
      const report = await generateAIInspection({
        vehicleId: safeVehicle.id,
        imageUrls: safeVehicle.images,
        vehicleDetails: {
          make: safeVehicle.make,
          model: safeVehicle.model,
          year: safeVehicle.year,
          mileage: safeVehicle.mileage,
          fuelType: safeVehicle.fuelType,
          color: safeVehicle.color,
        },
      });
      
      setAiInspectionReport(report);
      setActiveTab('aiReport');

      const isListingSeller =
        currentUser?.email &&
        safeVehicle.sellerEmail &&
        currentUser.email.toLowerCase().trim() === safeVehicle.sellerEmail.toLowerCase().trim();
      if (isListingSeller && updateVehicle) {
        await updateVehicle(
          safeVehicle.id,
          { aiInspectionReport: report },
          { skipToast: true, successMessage: 'AI inspection report saved to your listing' },
        );
      }
    } catch (error) {
      console.error('AI Inspection failed:', error);
      setAiInspectionError(error instanceof Error ? error.message : 'Failed to generate AI inspection');
    } finally {
      setIsGeneratingAIInspection(false);
    }
  };

  // Use either the saved report or the locally generated one
  const currentAIReport = safeVehicle.aiInspectionReport || aiInspectionReport;

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

  const callHref = useMemo(
    () => telHrefFromRawPhone(getSellerCallPhone(safeVehicle, seller)),
    [safeVehicle, seller],
  );
  const sellerWhatsAppUrl = useMemo(
    () => buildSellerWhatsAppUrl(safeVehicle, seller),
    [safeVehicle, seller],
  );
  const listingAvailable = isListingAvailable(safeVehicle);

  const handleCallSeller = () => {
    if (!currentUser) {
      void onStartChat(safeVehicle);
      return;
    }
    trackPhoneView(safeVehicle.id);
    if (callHref) window.location.href = callHref;
  };

  const handleWhatsAppSeller = () => {
    if (!currentUser) {
      void onStartChat(safeVehicle);
      return;
    }
    trackPhoneView(safeVehicle.id);
    if (sellerWhatsAppUrl) window.open(sellerWhatsAppUrl, '_blank', 'noopener,noreferrer');
  };

  const handleChatWithSeller = async () => {
    if (!currentUser) {
      void onStartChat(safeVehicle);
      return;
    }
    scrollToChatOnShowRef.current = true;
    setShowSellerChat(true);
    await Promise.resolve(onStartChat(safeVehicle));
  };

  const filteredRecommendations = useMemo(() => {
      return recommendations.filter(rec => rec.id !== safeVehicle.id).slice(0, 3);
  }, [recommendations, safeVehicle.id]);

  const similarVehiclesForPricing = useMemo(() => {
    const pool = [...(contextVehicles || []), ...recommendations];
    const seen = new Set<number>();
    return pool
      .filter((v) => {
        if (!v || v.id === safeVehicle.id || v.status !== 'published') return false;
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return (
          v.make === safeVehicle.make &&
          v.model === safeVehicle.model &&
          Math.abs(v.year - safeVehicle.year) <= 2
        );
      })
      .slice(0, 20)
      .map((v) => ({ price: v.price, year: v.year, mileage: v.mileage }));
  }, [contextVehicles, recommendations, safeVehicle.id, safeVehicle.make, safeVehicle.model, safeVehicle.year]);
  
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
        const { publicApiFetch } = await import('../utils/apiFetch');
        const res = await publicApiFetch('/api/vehicles?action=track-view', {
          method: 'POST',
          body: JSON.stringify({
            vehicleId,
            ...(vehicle?.databaseId ? { databaseId: vehicle.databaseId } : {}),
          }),
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
                sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(parsed as Vehicle));
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
              <button type="button" onClick={onBackToHome} className="mb-4 text-gray-600 hover:text-gray-900 font-medium transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('vehicle.detail.backToListings')}
              </button>

              <VehicleOfferBanner vehicle={safeVehicle} className="mb-6" />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                  {/* Left Column: Media and Details */}
                  <div className="lg:col-span-2 space-y-4">
                    {safeVehicle.videoUrl && (
                      <div className="flex space-x-2 border-b-2 border-gray-200">
                        <button
                          onClick={() => setActiveMediaTab('images')}
                          className={`py-2 px-4 font-semibold transition-colors ${
                            activeMediaTab === 'images'
                              ? 'border-b-2 border-purple-600 text-purple-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {t('vehicle.detail.media.images')}
                        </button>
                        <button
                          onClick={() => setActiveMediaTab('video')}
                          className={`py-2 px-4 font-semibold transition-colors ${
                            activeMediaTab === 'video'
                              ? 'border-b-2 border-purple-600 text-purple-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {t('vehicle.detail.media.video')}
                        </button>
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
                                  src={getSafeImageSrc(
                                    validImages[currentIndex] || getFirstValidImage(safeVehicle.images, safeVehicle.id),
                                    VEHICLE_IMAGE_PLACEHOLDER_DATA_URI
                                  )} 
                                  alt={`${safeVehicle.make} ${safeVehicle.model} - Image ${currentIndex + 1}`}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    // Only set placeholder if not already a placeholder to avoid infinite loops
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
                                    <>
                        <button
                          onClick={handlePrevImage}
                          className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                          aria-label={t('vehicle.detail.media.previousImage')}
                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                          </svg>
                                        </button>
                        <button
                          onClick={handleNextImage}
                          className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                          aria-label={t('vehicle.detail.media.nextImage')}
                        >
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
                                            target.src = VEHICLE_THUMB_PLACEHOLDER_DATA_URI;
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
                              <p className="text-lg font-medium">
                                {t('vehicle.detail.media.noImagesAvailable')}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full aspect-video bg-black rounded-xl shadow-lg overflow-hidden animate-fade-in">
                        <video src={safeVehicle.videoUrl} controls className="w-full h-full object-cover">
                          Your browser does not support the video tag.
                        </video>
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
                            {t('vehicle.detail.tabs.overview')}
                            {activeTab === 'overview' && (
                              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></span>
                            )}
                          </button>
                          {/* AI Report Tab - shows when report exists OR can be generated */}
                          {currentAIReport ? (
                            <button
                              onClick={() => setActiveTab('aiReport')}
                              className={`px-6 py-4 font-bold text-sm uppercase transition-colors relative ${
                                activeTab === 'aiReport'
                                  ? 'text-purple-600'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {t('vehicle.detail.tabs.aiReport', 'AI Report')}
                              <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold align-middle">AI</span>
                              {activeTab === 'aiReport' && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></span>
                              )}
                            </button>
                          ) : safeVehicle.images && safeVehicle.images.length > 0 && (
                            <button
                              onClick={handleGenerateAIInspection}
                              disabled={isGeneratingAIInspection}
                              className={`px-6 py-4 font-bold text-sm uppercase transition-colors relative ${
                                isGeneratingAIInspection
                                  ? 'text-blue-400 cursor-wait'
                                  : 'text-blue-600 hover:text-blue-800'
                              }`}
                            >
                              {isGeneratingAIInspection ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  Analyzing...
                                </span>
                              ) : (
                                <>
                                  {t('vehicle.detail.tabs.runAiReport', 'Run AI Report')}
                                  <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold align-middle">NEW</span>
                                </>
                              )}
                            </button>
                          )}
                          {safeVehicle.certifiedInspection && (
                            <button
                              onClick={() => setActiveTab('report')}
                              className={`px-6 py-4 font-bold text-sm uppercase transition-colors relative ${
                                activeTab === 'report'
                                  ? 'text-purple-600'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {t('vehicle.detail.tabs.report')}
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
                            {t('vehicle.detail.tabs.featureSpecs')}
                            {activeTab === 'features' && (
                              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></span>
                            )}
                          </button>
                          <button
                            onClick={() => setActiveTab('vahan')}
                            className={`px-6 py-4 font-bold text-sm uppercase transition-colors relative ${
                              activeTab === 'vahan'
                                ? 'text-purple-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {t('vehicle.detail.tabs.vahan')}
                            {activeTab === 'vahan' && (
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
                                <VehicleDetailTrustStrip />
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  <KeySpec label={t('vehicle.year')} value={safeVehicle.year} />
                                  <KeySpec
                                    label={t('vehicle.spec.registrationYear')}
                                    value={safeVehicle.registrationYear}
                                  />
                                  <KeySpec label={t('vehicle.fuel')} value={safeVehicle.fuelType} />
                                  <KeySpec
                                    label={t('vehicle.mileage')}
                                    value={typeof safeVehicle.mileage === 'number' ? safeVehicle.mileage.toLocaleString('en-IN') : '0'}
                                  />
                                  <KeySpec label={t('vehicle.transmission')} value={safeVehicle.transmission} />
                                  <KeySpec label={t('vehicle.spec.ownersShort')} value={safeVehicle.noOfOwners} />
                                  <KeySpec label={t('vehicle.detail.specs.insurance')} value={(() => {
                                    const insurance = safeVehicle.insuranceValidity;
                                    if (!insurance || insurance.trim() === '') return t('vehicle.detail.insurance.notSpecified');
                                    // Validate insurance date - if it's a date format, check if it makes sense
                                    if (insurance.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                      const insuranceDate = new Date(insurance);
                                      const vehicleYear = safeVehicle.year || safeVehicle.registrationYear;
                                      // If insurance date is before vehicle year, it's invalid
                                      if (vehicleYear && insuranceDate.getFullYear() < vehicleYear) {
                                        return t('vehicle.detail.insurance.invalidDate');
                                      }
                                      // Format date nicely
                                      return insuranceDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                                    }
                                    return insurance;
                                  })()} />
                                  <KeySpec label={t('vehicle.detail.specs.rto')} value={safeVehicle.rto} />
                                </div>
                                {safeVehicle.description && (
                                  <div>
                                    <h4 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-2">
                                      {t('vehicle.detail.descriptionLabel')}
                                    </h4>
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

                        {/* AI Inspection Report Tab */}
                        {activeTab === 'aiReport' && currentAIReport && (
                          <div className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                  {t('vehicle.detail.aiInspection', 'AI Photo Inspection')}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {t('vehicle.detail.aiInspectionNote', 'Automated analysis based on uploaded photos')}
                                </p>
                              </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                              <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                  {t('vehicle.detail.aiDisclaimer', 'This report is generated by AI based on uploaded photos. For a comprehensive evaluation, we recommend a physical inspection by a certified mechanic.')}
                                </p>
                              </div>
                            </div>
                            <AIInspectionReportComponent 
                              report={currentAIReport} 
                              onRequestPhysicalInspection={() => {
                                alert('Physical inspection request feature coming soon!');
                              }}
                            />
                          </div>
                        )}

                        {/* AI Inspection Error */}
                        {activeTab === 'aiReport' && !currentAIReport && aiInspectionError && (
                          <div className="p-6">
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <p className="text-sm font-medium text-red-800 dark:text-red-200">AI Inspection Failed</p>
                                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{aiInspectionError}</p>
                                  <button
                                    onClick={handleGenerateAIInspection}
                                    className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 underline"
                                  >
                                    Try again
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Certified Physical Inspection Report Tab */}
                        {activeTab === 'report' && safeVehicle.certifiedInspection && (
                          <div className="p-6">
                            <CertifiedInspectionReport report={safeVehicle.certifiedInspection} />
                          </div>
                        )}

                        {activeTab === 'features' && (
                          <div className="p-6 space-y-8">
                            {/* Detailed Specifications */}
                            <div>
                              <h3 className="text-xl font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">
                                {t('vehicle.detail.detailedSpecifications')}
                              </h3>
                              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <SpecDetail label={t('compare.field.engine')} value={safeVehicle.engine} />
                                <SpecDetail label={t('compare.field.displacement')} value={safeVehicle.displacement} />
                                <SpecDetail label={t('vehicle.transmission')} value={safeVehicle.transmission} />
                                <SpecDetail label={t('vehicle.fuel')} value={safeVehicle.fuelType} />
                                <SpecDetail label={t('vehicle.detail.mileageLabel')} value={safeVehicle.fuelEfficiency} />
                                <SpecDetail label={t('vehicle.detail.specs.groundClearance')} value={safeVehicle.groundClearance} />
                                <SpecDetail label={t('vehicle.detail.specs.bootSpace')} value={safeVehicle.bootSpace} />
                                <SpecDetail label={t('compare.field.color')} value={safeVehicle.color} />
                              </dl>
                            </div>

                            {/* Features, Pros & Cons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <h4 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">
                                  {t('vehicle.detail.includedFeatures')}
                                </h4>
                                {safeVehicle.features.length > 0 ? (
                                  <div className="flex flex-wrap gap-3">
                                    {safeVehicle.features.map(feature => (
                                      <div key={feature} className="flex items-center gap-2 text-reride-text-dark dark:text-reride-text-dark bg-reride-off-white dark:bg-brand-gray-700 px-3 py-1 rounded-full text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-reride-orange" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        {feature}
                                      </div>
                                    ))}
                                  </div>
                                ) : <p className="text-reride-text">{t('vehicle.detail.noFeaturesListed')}</p>}
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">
                                  {t('vehicle.detail.aiExpertAnalysis')}
                                </h4>
                                {isGeneratingProsCons ? (
                                  <div className="flex items-center gap-2 text-reride-text">
                                    <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin" style={{ borderColor: '#FF6B35' }}></div>
                                    {t('vehicle.detail.ai.generating')}
                                  </div>
                                ) : prosAndCons ? (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <h5 className="font-semibold text-reride-orange mb-2">{t('vehicle.detail.ai.pros')}</h5>
                                      <ul className="list-disc list-inside space-y-1 text-sm">{prosAndCons.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                    </div>
                                    <div>
                                      <h5 className="font-semibold text-reride-orange mb-2">{t('vehicle.detail.ai.cons')}</h5>
                                      <ul className="list-disc list-inside space-y-1 text-sm">{prosAndCons.cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={handleGenerateProsCons}
                                    className="text-sm font-bold hover:underline transition-colors"
                                    style={{ color: '#FF6B35' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--reride-blue)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--reride-orange)')}
                                  >
                                    {t('vehicle.detail.ai.generateProsConsDesktop')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'vahan' && (
                          <div className="p-6 space-y-8">
                            {/* Show login prompt for non-logged-in users */}
                            {!currentUser ? (
                              <div className="flex flex-col items-center justify-center py-12 px-6">
                                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                                  {t('vehicle.detail.vahan.loginRequired')}
                                </h3>
                                <p className="text-gray-600 text-center mb-6 max-w-md">
                                  {t('vehicle.detail.vahan.loginDescription')}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => onStartChat(safeVehicle)}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-colors flex items-center gap-2"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                  </svg>
                                  {t('vehicle.detail.vahan.loginButton')}
                                </button>
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
                                      value={extVehicle.registrationNumber || '-'} 
                                    />
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.registrationDate')} 
                                      value={safeVehicle.registrationYear ? `${safeVehicle.registrationYear}` : '-'} 
                                    />
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.engineNumber')} 
                                      value={extVehicle.engineNumber || '-'} 
                                    />
                                    <SpecDetail 
                                      label={t('vehicle.detail.vahan.chassisNumber')} 
                                      value={extVehicle.chassisNumber || '-'} 
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
                                  <span className="text-green-600 font-medium">{t('vehicle.detail.vahan.fitnessValid')}</span>
                                } />
                                <SpecDetail label={t('vehicle.detail.vahan.hypothecation')} value={
                                  <span className="text-gray-600">{t('vehicle.detail.vahan.noHypothecation')}</span>
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
                      </div>
                    </div>

                    {/* Additional Sections Below Tabs */}
                    <div className="mt-6 space-y-6">
                    {/* ✅ FIX: Removed duplicate section - Vehicle History & Documents */}
                    {(safeVehicle.serviceRecords || safeVehicle.accidentHistory || safeVehicle.documents) && (
                        <CollapsibleSection title={t('vehicle.detail.historyAndDocs')}>
                            {(safeVehicle.serviceRecords || safeVehicle.accidentHistory) && (
                                <VehicleHistory serviceRecords={safeVehicle.serviceRecords || []} accidentHistory={safeVehicle.accidentHistory || []} />
                            )}
                            {safeVehicle.documents && safeVehicle.documents.length > 0 && <div className="mt-6">
                                <h4 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">
                                  {t('vehicle.detail.availableDocuments')}
                                </h4>
                                <div className="flex flex-wrap gap-4">
                                    {safeVehicle.documents.map(doc => <DocumentChip key={doc.name} doc={doc} />)}
                                </div>
                            </div>}
                        </CollapsibleSection>
                    )}

                    {/* EMI Calculator - Shown at bottom when clicked */}
                    {showEMICalculator && (
                        <div id="emi-calculator" ref={emiCalculatorRef} className="mt-8 scroll-mt-24">
                            <EMICalculator
                              principal={safeVehicle.price}
                              onClose={() => setShowEMICalculator(false)}
                            />
                        </div>
                    )}

                    {showSellerChat && listingConversation && currentUser?.role === 'customer' && (
                        <div
                          id="seller-chat-section"
                          ref={sellerChatRef}
                          className="mt-8 scroll-mt-24 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                        >
                          <div className="border-b border-gray-200 px-4 py-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {t('vehicle.detail.chatWithSeller')}
                            </h3>
                          </div>
                          <InlineChat
                            conversation={listingConversation}
                            currentUserRole="customer"
                            otherUserName={resolveChatOtherPartyName(users, listingConversation, 'seller')}
                            callTargetPhone={resolveChatCallPhone(users, contextVehicles, listingConversation, 'customer')}
                            callTargetName={resolveChatOtherPartyName(users, listingConversation, 'seller')}
                            otherUserOnline={chatPeerOnlineByConversationId[String(listingConversation.id)]}
                            onStartCall={(phone) => {
                              if (phone) window.open(`tel:${phone}`);
                            }}
                            onSendMessage={(messageText, type, payload) => {
                              if (type || payload) {
                                sendMessageWithType(listingConversation.id, messageText, type, payload);
                              } else {
                                sendMessage(listingConversation.id, messageText);
                              }
                            }}
                            typingStatus={typingStatus}
                            onUserTyping={(conversationId) => toggleTyping(conversationId, true)}
                            onUserStoppedTyping={(conversationId) => toggleTyping(conversationId, false)}
                            uploaderEmail={currentUser.email}
                            onMarkMessagesAsRead={(conversationId) =>
                              markAsRead(conversationId, { readerRole: 'customer', forceReadState: true })
                            }
                            onFlagContent={onFlagContent}
                            onOfferResponse={onOfferResponse}
                            onClearChat={clearConversationMessages}
                            height="h-[28rem]"
                          />
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
                            aria-label={isInWishlist ? t('vehicle.card.wishlistRemove') : t('vehicle.card.wishlistAdd')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill={isInWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <ListingStockBadge vehicle={safeVehicle} size="md" />
                          <VerificationBadge vehicle={safeVehicle} />
                        </div>
                        <ListingTrustChips vehicle={safeVehicle} seller={seller} className="mt-2" />
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
                          <span>
                            {safeVehicle.location ||
                              `${safeVehicle.city || ''}, ${safeVehicle.state || ''}`.trim() ||
                              t('vehicle.detail.locationNotSpecified')}
                          </span>
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
                                  <span className="text-xs text-gray-500">
                                    {getFollowersCount(seller.email)} {t('vehicle.detail.followers')}
                                  </span>
                                  <button 
                                    onClick={() => onViewSellerProfile(seller.email)} 
                                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors"
                                  >
                                    {t('vehicle.detail.viewProfile')}
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
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44-1.22a.75 .75 0 00-1.06 0L8.172 6.172a.75 .75 0 00-1.06 1.06L8.94 9.332a.75 .75 0 001.191.04l3.22-4.294a.75 .75 0 00-.04-1.19z" clipRule="evenodd" />
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
                            <span className="text-base text-gray-600">{t('vehicle.detail.price.fixedOnRoadPrice')}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-3xl font-bold text-gray-900">₹{safeVehicle.price.toLocaleString('en-IN')}</p>
                          <p className="text-base text-gray-500 mt-1">
                            {t('vehicle.detail.price.includesRcTransfer')}
                          </p>
                        </div>

                        <div className="mt-4">
                          <PriceInsights
                            vehicle={safeVehicle}
                            similarVehicles={similarVehiclesForPricing}
                          />
                        </div>

                        {/* EMI Details */}
                        <div className="border-t border-gray-200 pt-2.5 space-y-2">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-gray-900">{formatCurrency(baseEMI)}/m</span>
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
                                className="text-base text-purple-600 font-semibold hover:underline"
                              >
                                {showEMICalculator ? t('vehicle.detail.hideEmiCalculator') : t('vehicle.detail.price.calculateEmi')}
                              </button>
                            </div>
                          </div>
                          
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 flex items-start gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            <span className="text-base text-gray-700 leading-tight">
                              {t('vehicle.detail.price.saveExtraLoanInterest', {
                                amount: Math.round(baseEMI * 12 * 0.0125).toLocaleString('en-IN'),
                              })}
                            </span>
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
                                {t('vehicle.detail.comparing')}
                              </>
                            ) : (
                              t('vehicle.detail.compare')
                            )}
                          </button>
                          <SocialShareButtons vehicle={safeVehicle} />
                        </div>
                        </div>

                        {/* Fixed Action Buttons at Bottom */}
                        <div className="pt-3 mt-auto border-t border-gray-200 flex-shrink-0 space-y-2">
                          {listingAvailable && (callHref || sellerWhatsAppUrl) ? (
                            <div className="grid grid-cols-2 gap-2">
                              {callHref ? (
                                <button
                                  type="button"
                                  onClick={handleCallSeller}
                                  className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                                >
                                  {t('vehicle.detail.call')}
                                </button>
                              ) : null}
                              {sellerWhatsAppUrl ? (
                                <button
                                  type="button"
                                  onClick={handleWhatsAppSeller}
                                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-2.5 text-sm font-bold text-white hover:bg-[#20BA5A]"
                                >
                                  {t('vehicle.detail.whatsapp', { defaultValue: 'WhatsApp' })}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleChatWithSeller()}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg text-base transition-all flex items-center justify-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {t('vehicle.detail.chatWithSeller')}
                          </button>
                          {onRequestTestDrive && listingAvailable ? (
                            <button
                              type="button"
                              onClick={() => setShowTestDriveModal(true)}
                              className="w-full border-2 border-purple-200 text-purple-700 font-semibold py-2.5 px-4 rounded-lg text-sm hover:bg-purple-50"
                            >
                              {t('vehicle.detail.bookTestDrive', { defaultValue: 'Book test drive' })}
                            </button>
                          ) : null}
                        </div>

                      </div>
                  </div>
              </div>

              <div className="text-center mt-12">
                  <button
                    onClick={handleFlagClick}
                    className="text-xs text-reride-text hover:text-reride-orange"
                  >
                    {t('vehicle.detail.reportThisListing')}
                  </button>
              </div>

              {filteredRecommendations.length > 0 && <div className="mt-12">
                  <h2 className="text-3xl font-bold text-reride-text-dark dark:text-reride-text-dark mb-6">
                    {t('vehicle.detail.similarVehicles')}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredRecommendations.map(v => (
                          <VehicleCard key={v.id} vehicle={v} onSelect={onSelectVehicle} onToggleCompare={onToggleCompare} isSelectedForCompare={comparisonList.includes(v.id)} onToggleWishlist={onToggleWishlist} isInWishlist={wishlist.includes(v.id)} isCompareDisabled={!comparisonList.includes(v.id) && comparisonList.length >= 4} onViewSellerProfile={onViewSellerProfile}/>
                      ))}
                  </div>
              </div>}

          </div>
      </div>

      {showTestDriveModal && onRequestTestDrive ? (
        <TestDriveModal
          onClose={() => setShowTestDriveModal(false)}
          onSubmit={(details) => {
            void onRequestTestDrive(safeVehicle, details);
            setShowTestDriveModal(false);
          }}
        />
      ) : null}
    </>
  );
};

export default VehicleDetail;

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Vehicle, ProsAndCons, User, RatingEligibility } from '../types';
import { generateProsAndCons } from '../services/geminiService';
import { getFirstValidImage, getValidImages } from '../utils/imageUtils';
import { MobileImageGallery } from './MobileImageGallery';
import { MobileShareSheet } from './MobileShareSheet';
import { MobileEMICalculator } from './MobileEMICalculator';
import { VehicleOfferBanner } from './VehicleOfferBanner';
import { scrollAppToTop } from '../utils/scrollAppToTop';
import { getFollowersCount } from '../services/buyerEngagementService';
import { telHrefFromRawPhone, phoneDisplayCompact } from '../utils/numberUtils';
import { MobileVehicleTrustStrip } from './MobileVehicleTrustStrip';
import { buildSellerWhatsAppUrl } from '../utils/sellerContact.js';
import { trackPhoneView } from '../services/listingService.js';
import TestDriveModal from './TestDriveModal.js';
import { ListingStockBadge } from './ListingStockBadge.js';
import { ListingTrustChips } from './ListingTrustChips.js';
import { isListingAvailable } from '../utils/listingStock.js';
import StarRating from './StarRating';
import { PriceInsights } from './PriceInsights';
import { findSimilarVehicles } from '../utils/vehiclePricing';
import SellerDisclosureDisplay from './SellerDisclosureDisplay';
import BuyerInspectionForm from './BuyerInspectionForm';
import { fetchRatingEligibility, submitPeerRating } from '../services/vehicleTrustService';
import { useApp } from './AppProvider';
import { isCompareDisabledForVehicle } from '../utils/compareList.js';
import { enrichVehicleWithSellerInfo, resolveVehicleSellerEmail } from '../utils/vehicleEnrichment';

interface MobileVehicleDetailProps {
  vehicle: Vehicle;
  onBack: () => void;
  comparisonList: number[];
  onToggleCompare: (id: number) => void;
  onAddSellerRating?: (sellerEmail: string, rating: number) => void;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  currentUser: User | null;
  onFlagContent?: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  users: User[];
  onViewSellerProfile: (sellerEmail: string) => void;
  onStartChat: (vehicle: Vehicle) => void;
  onRequestTestDrive?: (vehicle: Vehicle, details: { date: string; time: string }) => void | Promise<void>;
  /** Shown when user taps Call but must sign in first (hides `tel:` until logged in). */
  onRequestLogin: () => void;
  recommendations: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
}

/**
 * Mobile-Optimized Vehicle Detail Page
 * Features:
 * - Full-screen swipeable image gallery
 * - Sticky action buttons (Call, Chat, Share)
 * - Collapsible sections
 * - Mobile-friendly specs layout
 * - Pull-to-refresh support
 */
export const MobileVehicleDetail: React.FC<MobileVehicleDetailProps> = ({
  vehicle,
  onBack,
  comparisonList = [],
  onToggleCompare,
  onAddSellerRating,
  wishlist = [],
  onToggleWishlist,
  currentUser,
  onFlagContent,
  users = [],
  onViewSellerProfile,
  onStartChat,
  onRequestTestDrive,
  onRequestLogin,
  recommendations = [],
  onSelectVehicle
}) => {
  const { t } = useTranslation();
  const { vehicles: contextVehicles, comparisonCategory } = useApp();
  const ratingSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSellerRatingSuccess, setShowSellerRatingSuccess] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showEMICalculator, setShowEMICalculator] = useState(false);
  const [showTestDriveModal, setShowTestDriveModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'vahan' | 'price'>('overview');
  const detailTabsRef = useRef<HTMLDivElement>(null);
  const [prosAndCons, setProsAndCons] = useState<ProsAndCons | null>(null);
  const [isGeneratingProsCons, setIsGeneratingProsCons] = useState(false);
  const [ratingEligibility, setRatingEligibility] = useState<RatingEligibility | null>(null);
  const [ratingDealId, setRatingDealId] = useState<string | undefined>();

  const safeVehicle = useMemo(() => {
    const sellerEmail = resolveVehicleSellerEmail(vehicle, contextVehicles);
    const enriched = enrichVehicleWithSellerInfo({ ...vehicle, sellerEmail }, users);
    return {
    ...enriched,
    images: Array.isArray(enriched.images) ? enriched.images : [],
    features: Array.isArray(enriched.features) ? enriched.features : [],
    description: enriched.description || '',
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
    inquiriesCount: enriched.inquiriesCount || 0
  };
  }, [vehicle, contextVehicles, users]);

  const seller = useMemo(() => {
    if (!safeVehicle.sellerEmail) return undefined;
    const normalizedSellerEmail = safeVehicle.sellerEmail.toLowerCase().trim();
    return users.find(u => {
      if (!u || !u.email) return false;
      return u.email.toLowerCase().trim() === normalizedSellerEmail;
    });
  }, [users, safeVehicle.sellerEmail]);

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

  const handleViewSellerProfile = () => {
    if (!sellerProfileEmail) return;
    onViewSellerProfile(sellerProfileEmail);
  };

  const isComparing = comparisonList.includes(safeVehicle.id);
  const isCompareDisabled = isCompareDisabledForVehicle(
    safeVehicle,
    comparisonList,
    comparisonCategory,
  );
  const isInWishlist = wishlist.includes(safeVehicle.id);
  const canRate = Boolean(ratingEligibility?.canRateSeller);

  useEffect(() => {
    if (!currentUser?.email) {
      setRatingEligibility(null);
      setRatingDealId(undefined);
      return;
    }
    void fetchRatingEligibility(safeVehicle.databaseId || safeVehicle.id)
      .then(({ eligibility, dealId }) => {
        setRatingEligibility(eligibility);
        setRatingDealId(dealId);
      })
      .catch(() => setRatingEligibility(null));
  }, [currentUser?.email, safeVehicle.id, safeVehicle.databaseId]);

  const handleRateSeller = async (rating: number) => {
    if (ratingDealId) {
      try {
        await submitPeerRating(ratingDealId, Number(rating));
        setShowSellerRatingSuccess(true);
        setRatingEligibility((prev) => (prev ? { ...prev, canRateSeller: false } : prev));
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Could not submit rating');
        return;
      }
    } else if (onAddSellerRating && safeVehicle.sellerEmail) {
      onAddSellerRating(safeVehicle.sellerEmail, Number(rating));
      setShowSellerRatingSuccess(true);
    } else {
      return;
    }
    if (ratingSuccessTimeoutRef.current) {
      clearTimeout(ratingSuccessTimeoutRef.current);
    }
    ratingSuccessTimeoutRef.current = setTimeout(() => setShowSellerRatingSuccess(false), 3000);
  };

  const handleFlagClick = () => {
    if (!onFlagContent) return;
    if (window.confirm('Are you sure you want to report this listing for review by an administrator?')) {
      const reason = window.prompt('Please provide a reason for reporting this listing (optional):');
      if (reason !== null) {
        onFlagContent('vehicle', safeVehicle.id, reason || 'No reason provided');
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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

  const handleChat = () => {
    onStartChat(safeVehicle);
  };

  const handleShare = () => {
    setShowShareSheet(true);
  };

  const filteredRecommendations = useMemo(() => {
    const list = Array.isArray(recommendations) ? recommendations : [];
    return list.filter(rec => rec.id !== safeVehicle.id).slice(0, 3);
  }, [recommendations, safeVehicle.id]);

  const similarVehiclesForPricing = useMemo(() => {
    const pool = [...(contextVehicles || []), ...(recommendations || [])];
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

  useEffect(() => {
    setActiveTab('overview');
    setShowGallery(false);
    setShowShareSheet(false);
    setShowEMICalculator(false);
    setShowTestDriveModal(false);
    setProsAndCons(null);
    setIsGeneratingProsCons(false);
    scrollAppToTop();
    requestAnimationFrame(() => scrollAppToTop());
  }, [vehicle.id]);

  // Calculate EMI for display
  const baseEMI = useMemo(() => {
    const loanAmount = Math.round(safeVehicle.price * 0.8);
    const interestRate = 10.5;
    const tenure = 60;
    const monthlyRate = interestRate / 12 / 100;
    if (monthlyRate === 0) return loanAmount / tenure;
    return Math.round((loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1));
  }, [safeVehicle.price]);

  const saveExtraLoanInterest = useMemo(() => {
    return Math.round((baseEMI * 60) - (baseEMI * 0.95 * 60)).toLocaleString();
  }, [baseEMI]);

  const rawCallPhone = (seller?.mobile || safeVehicle.sellerPhone || '').trim();
  const callHref = useMemo(() => telHrefFromRawPhone(rawCallPhone), [rawCallPhone]);
  const callPhoneLabel = phoneDisplayCompact(rawCallPhone);
  const sellerWhatsAppUrl = useMemo(
    () => buildSellerWhatsAppUrl(safeVehicle, seller),
    [safeVehicle, seller],
  );
  const listingAvailable = isListingAvailable(safeVehicle);

  const handleWhatsAppSeller = () => {
    if (!currentUser) {
      onRequestLogin();
      return;
    }
    trackPhoneView(safeVehicle.id);
    if (sellerWhatsAppUrl) window.open(sellerWhatsAppUrl, '_blank', 'noopener,noreferrer');
  };
  const followersForSeller = safeVehicle.sellerEmail
    ? getFollowersCount(seller?.email || safeVehicle.sellerEmail)
    : 0;

  /** Portaled to body: PageTransition/framer-motion uses transform, which breaks `fixed` inside scroll main. */
  const contactToolbar =
    typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-x-0 bottom-0 z-[90] flex gap-3 border-t border-gray-200/90 bg-white/85 px-4 pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl pb-[max(12px,env(safe-area-inset-bottom,0px))]"
            role="toolbar"
            aria-label={t('vehicle.detail.contactActions')}
          >
            {callHref ? (
              currentUser ? (
                <a
                  href={callHref}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-gray-200 bg-white px-2 py-3 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:scale-[0.99]"
                  style={{ minHeight: '52px' }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {t('vehicle.detail.call')}
                  </span>
                  {callPhoneLabel ? (
                    <span className="text-xs font-medium text-gray-500 tabular-nums">{callPhoneLabel}</span>
                  ) : null}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onRequestLogin}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-gray-200 bg-white px-2 py-3 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:scale-[0.99]"
                  style={{ minHeight: '52px' }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {t('vehicle.detail.call')}
                  </span>
                  <span className="text-[10px] font-medium leading-tight text-gray-500">{t('vehicle.detail.loginToCallSeller')}</span>
                </button>
              )
            ) : (
              <button
                type="button"
                disabled
                title={t('vehicle.detail.callUnavailable')}
                className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-200 py-3.5 text-base font-semibold text-gray-500"
                style={{ minHeight: '52px' }}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {t('vehicle.detail.call')}
              </button>
            )}
            {sellerWhatsAppUrl && listingAvailable ? (
              <button
                type="button"
                onClick={handleWhatsAppSeller}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-[#25D366] bg-white px-2 py-3 text-sm font-semibold text-[#1FA855] hover:bg-[#25D366]/10 active:scale-[0.99]"
                style={{ minHeight: '52px' }}
              >
                {t('vehicle.detail.whatsapp', { defaultValue: 'WhatsApp' })}
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleChat();
              }}
              className="flex flex-[1.4] flex-col items-center justify-center gap-0.5 rounded-xl bg-purple-600 py-2.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 active:scale-[0.99]"
              style={{ minHeight: '52px' }}
            >
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {t('vehicle.detail.chat')}
              </span>
              {!currentUser && (
                <span className="text-[10px] font-medium leading-tight text-white/90">{t('vehicle.detail.loginToChatWithSeller')}</span>
              )}
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative z-0 w-full bg-gray-50 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]">
      {/* Image Gallery Header — contain (not cover) so wide listing photos aren't cropped */}
      <div className="relative flex w-full max-w-full items-center justify-center overflow-hidden bg-gray-100 aspect-[16/10] max-h-[min(42vh,300px)]">
        <img
          src={getFirstValidImage(safeVehicle.images, safeVehicle.id)}
          alt={`${safeVehicle.make} ${safeVehicle.model}`}
          className="max-h-full max-w-full h-full w-full object-contain object-center"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onClick={() => setShowGallery(true)}
        />
        {safeVehicle.images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm z-20">
            {t('vehicle.detail.photosTap', { count: safeVehicle.images.length })}
          </div>
        )}
      </div>

      {/* Content - Below Images with no overlap */}
      <div className="px-4 relative z-10 space-y-4 pb-6">
        <VehicleOfferBanner vehicle={safeVehicle} />
        {/* Vehicle Details Card */}
        <div className="bg-white rounded-2xl pt-6 pb-4 px-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {safeVehicle.year} {safeVehicle.make} {safeVehicle.model}
              </h1>
              <div className="flex flex-wrap gap-2 mb-2">
                <ListingStockBadge vehicle={safeVehicle} hideInStock />
                <ListingTrustChips vehicle={safeVehicle} seller={seller} />
              </div>
              {safeVehicle.variant && (
                <p className="text-sm text-gray-600 mb-2">{safeVehicle.variant}</p>
              )}
              {/* Key Specs */}
              <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                <span>{safeVehicle.mileage.toLocaleString()} km</span>
                <span>•</span>
                <span>{safeVehicle.fuelType}</span>
                <span>•</span>
                <span>{safeVehicle.transmission}</span>
              </div>
              {/* Location */}
              {(safeVehicle.city || safeVehicle.location) && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{safeVehicle.city || safeVehicle.location}{safeVehicle.state ? `, ${safeVehicle.state}` : ''}</span>
                  {safeVehicle.city && <span className="text-gray-400">&gt;</span>}
                </div>
              )}
            </div>
            {/* Action Icons */}
            <div className="flex gap-2 ml-2">
              <button
                onClick={() => onToggleWishlist(safeVehicle.id)}
                className="p-2"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <svg
                  className={`w-6 h-6 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                  fill={isInWishlist ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button
                onClick={handleShare}
                className="p-2"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Seller Information Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          {(seller || safeVehicle.sellerName || safeVehicle.sellerEmail) && (
            <button
              type="button"
              onClick={handleViewSellerProfile}
              disabled={!sellerProfileEmail}
              className={`w-full flex items-center gap-3 mb-3 text-left rounded-xl p-1 -m-1 transition-colors ${
                sellerProfileEmail ? 'active:bg-gray-50' : ''
              }`}
            >
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {seller?.name?.charAt(0).toUpperCase() || 
                 seller?.dealershipName?.charAt(0).toUpperCase() || 
                 safeVehicle.sellerName?.charAt(0).toUpperCase() || 
                 safeVehicle.sellerEmail?.charAt(0).toUpperCase() || 
                 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">
                  {seller?.name || 
                   seller?.dealershipName || 
                   safeVehicle.sellerName || 
                   t('vehicle.card.sellerFallback')}
                </h3>
                <p className="text-sm text-gray-600">
                  {followersForSeller} {t('vehicle.detail.followers')}
                </p>
              </div>
              {sellerProfileEmail ? (
                <span className="text-sm text-orange-500 font-semibold flex-shrink-0 flex items-center gap-0.5">
                  {t('vehicle.detail.viewProfile')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              ) : null}
            </button>
          )}
          {sellerProfileEmail ? (
            <button
              type="button"
              onClick={handleViewSellerProfile}
              className="w-full rounded-xl border-2 border-orange-200 bg-orange-50 py-2.5 text-sm font-semibold text-orange-600 mb-1"
            >
              {t('vehicle.detail.viewSellerPage', { defaultValue: 'View seller page' })}
            </button>
          ) : null}
          {!currentUser && (
            <p className="text-xs text-center text-gray-500 -mt-1 mb-0">{t('vehicle.detail.signInToMessageSeller')}</p>
          )}
          {onRequestTestDrive && listingAvailable ? (
            <button
              type="button"
              onClick={() => setShowTestDriveModal(true)}
              className="mt-3 w-full rounded-xl border-2 border-purple-200 py-2.5 text-sm font-semibold text-purple-700"
            >
              {t('vehicle.detail.bookTestDrive', { defaultValue: 'Book test drive' })}
            </button>
          ) : null}
        </div>

        {/* Pricing Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {t('vehicle.detail.price.fixedOnRoadPrice')}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mb-2">
            <span className="text-3xl font-bold text-purple-600">{formatCurrency(safeVehicle.price)}</span>
          </div>
          
          {/* EMI Information */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">
                {t('vehicle.detail.price.monthlyEmi')}
              </p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(baseEMI)}/m
              </p>
            </div>
            <button
              onClick={() => setShowEMICalculator(true)}
              className="text-sm text-orange-500 font-semibold"
            >
              {t('vehicle.detail.price.calculateEmi')}
            </button>
          </div>

          {/* Loan Offer Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <p className="text-sm text-gray-800">
              {t('vehicle.detail.price.saveExtraLoanInterest', { amount: saveExtraLoanInterest })}
            </p>
          </div>

          <div className="mt-3">
            <PriceInsights
              vehicle={safeVehicle}
              similarVehicles={similarVehiclesForPricing}
              compact
              compactHidePrice
              onViewFullAnalysis={openPriceTab}
            />
          </div>
        </div>

        <MobileVehicleTrustStrip />

        {/* Additional Details Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" ref={detailTabsRef}>
          <div className="flex border-b border-gray-200 mb-4 overflow-x-auto scrollbar-hide">
            {(['overview', 'features', 'vahan', 'price'] as const).map((tab) => {
              const label =
                tab === 'overview'
                  ? t('vehicle.detail.tabs.overview')
                  : tab === 'features'
                    ? t('vehicle.detail.tabs.featureSpecs')
                    : tab === 'vahan'
                      ? t('vehicle.detail.tabs.vahan')
                      : t('vehicle.detail.tabs.price', 'Price');
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-semibold uppercase whitespace-nowrap px-2 ${
                    activeTab === tab
                      ? 'text-orange-500 border-b-2 border-orange-500'
                      : 'text-gray-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div>
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <SellerDisclosureDisplay
                  checklist={safeVehicle.sellerDisclosureChecklist}
                  category={safeVehicle.category}
                  vahanSnapshot={safeVehicle.vahanSnapshot}
                />
                {(!currentUser || currentUser.role === 'customer') &&
                  currentUser?.email?.toLowerCase().trim() !==
                    safeVehicle.sellerEmail?.toLowerCase().trim() && (
                  <BuyerInspectionForm
                    vehicleId={safeVehicle.databaseId || safeVehicle.id}
                    category={safeVehicle.category}
                    sellerChecklist={safeVehicle.sellerDisclosureChecklist}
                    buyerEmail={currentUser?.role === 'customer' ? currentUser.email : undefined}
                    onRequireLogin={onRequestLogin}
                  />
                )}
                {safeVehicle.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {t('vehicle.detail.descriptionLabel')}
                    </h3>
                    <p className="text-gray-700 leading-relaxed">{safeVehicle.description}</p>
                  </div>
                )}

                {!prosAndCons && !isGeneratingProsCons && (
                  <button
                    onClick={handleGenerateProsCons}
                    className="w-full py-3 bg-orange-50 text-orange-600 rounded-xl font-semibold"
                  >
                    {t('vehicle.detail.ai.generateProsConsMobile')}
                  </button>
                )}
                
                {isGeneratingProsCons && (
                  <div className="text-center py-8">
                    <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-2 text-sm text-gray-600">
                      {t('vehicle.detail.ai.generatingInsights')}
                    </p>
                  </div>
                )}

                {prosAndCons && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-green-600 mb-2">
                        ✓ {t('vehicle.detail.ai.pros')}
                      </h3>
                      <ul className="space-y-1">
                        {(Array.isArray(prosAndCons.pros) ? prosAndCons.pros : []).map((pro, idx) => (
                          <li key={idx} className="text-gray-700 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-red-600 mb-2">
                        ✗ {t('vehicle.detail.ai.cons')}
                      </h3>
                      <ul className="space-y-1">
                        {(Array.isArray(prosAndCons.cons) ? prosAndCons.cons : []).map((con, idx) => (
                          <li key={idx} className="text-gray-700 flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <SpecCard label={t('vehicle.year')} value={safeVehicle.year?.toString()} />
                  <SpecCard
                    label={t('vehicle.spec.registrationYear')}
                    value={safeVehicle.registrationYear?.toString() || safeVehicle.year?.toString()}
                  />
                  <SpecCard label={t('vehicle.fuel')} value={safeVehicle.fuelType} />
                  <SpecCard
                    label={t('vehicle.mileage')}
                    value={`${safeVehicle.mileage.toLocaleString()} km`}
                  />
                  <SpecCard label={t('vehicle.transmission')} value={safeVehicle.transmission} />
                  <SpecCard
                    label={t('vehicle.spec.ownersShort')}
                    value={safeVehicle.noOfOwners?.toString() || '1'}
                  />
                  <SpecCard
                    label={t('vehicle.detail.specs.insurance')}
                    value={safeVehicle.insuranceValidity || t('common.notAvailable')}
                  />
                  <SpecCard
                    label={t('vehicle.detail.specs.rto')}
                    value={safeVehicle.rto || t('common.notAvailable')}
                  />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    {t('vehicle.detail.includedFeatures')}
                  </h3>
                  {safeVehicle.features.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {safeVehicle.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      {t('vehicle.detail.noFeaturesListed')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'vahan' && (
              <div className="space-y-6">
                {/* Show login prompt for non-logged-in users */}
                {!currentUser ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">
                      {t('vehicle.detail.vahan.loginRequired')}
                    </h3>
                    <p className="text-sm text-gray-600 text-center mb-5">
                      {t('vehicle.detail.vahan.loginDescription')}
                    </p>
                    <button
                      type="button"
                      onClick={onRequestLogin}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isVahanVerified ? 'bg-green-100' : 'bg-amber-100'}`}>
                          {isVahanVerified ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-gray-900">
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
                          <p className="text-xs text-gray-500">
                            {isVahanVerified 
                              ? t('vehicle.detail.vahan.subtitle') 
                              : t('vehicle.detail.vahan.sellerProvided')}
                          </p>
                        </div>
                      </div>

                      {/* Not Verified Warning Banner */}
                      {!isVahanVerified && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="text-xs font-medium text-amber-800">
                              {t('vehicle.detail.vahan.notVerifiedTitle')}
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              {t('vehicle.detail.vahan.notVerifiedDescription')}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Registration Details */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
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
                        <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-gray-600 text-sm font-medium">{t('vehicle.detail.vahan.noDetailsProvided')}</p>
                          <p className="text-xs text-gray-500 mt-1">{t('vehicle.detail.vahan.sellerNotProvided')}</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <SpecCard label={t('vehicle.detail.vahan.registrationNumber')} value={extVehicle.registrationNumber || '-'} />
                        <SpecCard label={t('vehicle.detail.vahan.registrationDate')} value={safeVehicle.registrationYear?.toString() || '-'} />
                        <SpecCard label={t('vehicle.detail.vahan.engineNumber')} value={extVehicle.engineNumber || '-'} />
                        <SpecCard label={t('vehicle.detail.vahan.chassisNumber')} value={extVehicle.chassisNumber || '-'} />
                        <SpecCard label={t('vehicle.detail.vahan.rtoOffice')} value={safeVehicle.rto || '-'} />
                        <SpecCard label={t('vehicle.detail.vahan.registeredState')} value={safeVehicle.state || '-'} />
                      </div>
                    );
                  })()}
                </div>

                {/* Ownership & Insurance */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    {t('vehicle.detail.vahan.ownershipStatus')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <SpecCard 
                      label={t('vehicle.detail.vahan.numberOfOwners')} 
                      value={safeVehicle.noOfOwners ? `${safeVehicle.noOfOwners}${safeVehicle.noOfOwners === 1 ? 'st' : safeVehicle.noOfOwners === 2 ? 'nd' : safeVehicle.noOfOwners === 3 ? 'rd' : 'th'} Owner` : '-'} 
                    />
                    <SpecCard 
                      label={t('vehicle.detail.vahan.insuranceValidity')} 
                      value={safeVehicle.insuranceValidity || t('vehicle.detail.insurance.notSpecified')} 
                    />
                    <SpecCard 
                      label={t('vehicle.detail.vahan.fitnessStatus')} 
                      value={t('vehicle.detail.vahan.fitnessValid')} 
                    />
                    <SpecCard 
                      label={t('vehicle.detail.vahan.hypothecation')} 
                      value={t('vehicle.detail.vahan.noHypothecation')} 
                    />
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-yellow-800">
                    {t('vehicle.detail.vahan.disclaimer')}
                  </p>
                </div>
                </>
                )}
              </div>
            )}

            {activeTab === 'price' && (
              <PriceInsights
                vehicle={safeVehicle}
                similarVehicles={similarVehiclesForPricing}
              />
            )}
          </div>
        </div>

        {canRate && seller && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-600">Rate your experience:</p>
              <StarRating rating={0} onRate={handleRateSeller} />
            </div>
            {showSellerRatingSuccess && (
              <p className="mt-2 text-center text-sm text-green-600">Thanks for your feedback!</p>
            )}
          </div>
        )}

        {onFlagContent && (
          <div className="text-center">
            <button
              type="button"
              onClick={handleFlagClick}
              className="text-xs text-gray-500 hover:text-orange-500"
            >
              {t('vehicle.detail.reportThisListing')}
            </button>
          </div>
        )}

        {/* Recommendations */}
        {filteredRecommendations.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t('vehicle.detail.similarVehicles')}
            </h2>
            <div className="space-y-3">
              {filteredRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => onSelectVehicle(rec)}
                  className="bg-gray-50 rounded-xl p-4 flex gap-4 active:scale-[0.98] transition-transform"
                >
                  <img
                    src={getFirstValidImage(rec.images, rec.id)}
                    alt={`${rec.make} ${rec.model}`}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{rec.year} {rec.make} {rec.model}</h3>
                    <p className="text-lg font-bold text-orange-500 mt-1">{formatCurrency(rec.price)}</p>
                    <p className="text-xs text-gray-600 mt-1">{rec.mileage.toLocaleString()} km • {rec.fuelType}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {contactToolbar}

      {/* Modals */}
      {showGallery && (
        <MobileImageGallery
          images={getValidImages(safeVehicle.images, safeVehicle.id)}
          alt={`${safeVehicle.make} ${safeVehicle.model}`}
          onClose={() => setShowGallery(false)}
        />
      )}

      {showShareSheet && (
        <MobileShareSheet
          url={window.location.href}
          title={`${safeVehicle.year} ${safeVehicle.make} ${safeVehicle.model}`}
          vehicle={vehicle}
          onClose={() => setShowShareSheet(false)}
        />
      )}

      {showEMICalculator && (
        <MobileEMICalculator
          price={safeVehicle.price}
          onClose={() => setShowEMICalculator(false)}
        />
      )}

      {showTestDriveModal && onRequestTestDrive ? (
        <TestDriveModal
          onClose={() => setShowTestDriveModal(false)}
          onSubmit={(details) => {
            void onRequestTestDrive(safeVehicle, details);
            setShowTestDriveModal(false);
          }}
        />
      ) : null}
    </div>
  );
};

const SpecCard: React.FC<{ label: string; value?: string | number }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
};

export default MobileVehicleDetail;


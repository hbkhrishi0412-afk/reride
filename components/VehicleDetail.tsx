import React, { useState, useMemo, memo, useEffect } from 'react';
import type { Vehicle, ProsAndCons, User, CertifiedInspection, VehicleDocument } from '../types';
import { generateProsAndCons } from '../services/geminiService';
import { getFirstValidImage, getValidImages, getSafeImageSrc } from '../utils/imageUtils';
import StarRating from './StarRating';
import VehicleCard from './VehicleCard';
import EMICalculator from './EMICalculator';
import QuickViewModal from './QuickViewModal';
import BadgeDisplay from './BadgeDisplay';
import VehicleHistory from './VehicleHistory';
import { getFollowersCount, getFollowingCount } from '../services/buyerEngagementService';
import { useApp } from './AppProvider';

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
}

// SVG icons for social media
const ICONS = {
    facebook: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" /></svg>,
    twitter: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.46 6c-.77.35-1.6.58-2.46.67.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98-3.54-.18-6.69-1.87-8.8-4.46-.37.63-.58 1.37-.58 2.15 0 1.49.76 2.81 1.91 3.58-.7-.02-1.36-.21-1.94-.53v.05c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21c7.34 0 11.35-6.08 11.35-11.35 0-.17 0-.34-.01-.51.78-.57 1.45-1.28 1.99-2.08z" /></svg>,
    whatsapp: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zM12.04 20.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31c-.82-1.31-1.26-2.83-1.26-4.38 0-4.54 3.69-8.23 8.24-8.23 4.54 0 8.23 3.69 8.23 8.23 0 4.54-3.69 8.23-8.23 8.23zm4.52-6.2c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14 0-.3 0-.47 0-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.05-.11-.2-.16-.44-.28z" /></svg>,
    link: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>,
};

interface SocialShareButtonsProps {
    vehicle: Vehicle;
}

const SocialShareButtons: React.FC<SocialShareButtonsProps> = ({ vehicle }) => {
    const [copyStatus, setCopyStatus] = useState('Copy Link');

    const handleShare = (platform: 'facebook' | 'twitter' | 'whatsapp') => {
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent(`Check out this ${vehicle.year} ${vehicle.make} ${vehicle.model} on ReRide!`);
        let shareUrl = '';

        switch (platform) {
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
                break;
            case 'whatsapp':
                shareUrl = `https://api.whatsapp.com/send?text=${text}%20${url}`;
                break;
        }
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    };
    
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
        <div className="mt-6 pt-6 border-t border-gray-200-200 dark:border-gray-200-200">
            <h4 className="text-sm font-semibold text-center text-brand-gray-600 dark:text-spinny-text mb-3">Share this listing</h4>
            <div className="flex justify-center items-center gap-3">
                <button onClick={() => handleShare('facebook')} aria-label="Share on Facebook" className="p-2 rounded-full text-white transition-colors" style={{ background: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--spinny-orange-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--spinny-orange)'}>{ICONS.facebook}</button>
                <button onClick={() => handleShare('twitter')} aria-label="Share on Twitter" className="p-2 rounded-full bg-sky-500 text-white hover:bg-sky-600 transition-colors">{ICONS.twitter}</button>
                <button onClick={() => handleShare('whatsapp')} aria-label="Share on WhatsApp" className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors">{ICONS.whatsapp}</button>
                <button 
                    onClick={handleCopyLink} 
                    className="flex items-center gap-2 text-sm font-semibold bg-spinny-light-gray dark:bg-brand-gray-700 text-spinny-text-dark dark:text-brand-gray-200 px-3 py-2 rounded-full hover:bg-brand-gray-300 dark:hover:bg-brand-gray-600 transition-colors"
                >
                    {ICONS.link}
                    <span>{copyStatus}</span>
                </button>
            </div>
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
                <h3 className="text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">{title}</h3>
                <svg className={`w-6 h-6 text-spinny-text transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <div className="flex flex-col gap-1 p-4 bg-spinny-off-white dark:bg-white rounded-lg text-center">
        {icon && <div className="mx-auto mb-1" style={{ color: '#1E88E5' }}>{icon}</div>}
        <span className="text-sm font-medium text-brand-gray-600 dark:text-spinny-text">{label}</span>
        <span className="font-bold text-spinny-text-dark dark:text-spinny-text-dark">{value}</span>
    </div>
));

const SpecDetail: React.FC<{ label: string; value: string | number | undefined }> = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-200-100 dark:border-gray-200-200 last:border-b-0">
        <dt className="text-sm text-brand-gray-600 dark:text-spinny-text">{label}</dt>
        <dd className="text-sm font-semibold text-spinny-text-dark dark:text-brand-gray-200 text-right">{value || '-'}</dd>
    </div>
);


const DocumentChip: React.FC<{ doc: VehicleDocument }> = ({ doc }) => {
    return (
        <a href={doc.url} target="_blank" rel="noopener noreferrer" title={`View ${doc.fileName}`}
           className="flex items-center gap-2 bg-white dark:bg-white text-spinny-text-dark dark:text-spinny-text-dark px-3 py-1.5 rounded-full text-sm font-medium hover:bg-white-dark dark:hover:bg-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2-2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <span>{doc.name}</span>
        </a>
    )
}

const CertifiedInspectionReport: React.FC<{ report: CertifiedInspection }> = ({ report }) => {
    const scoreColor = (score: number) => {
        if (score >= 90) return 'bg-spinny-orange-light0';
        if (score >= 75) return 'bg-spinny-blue-light0';
        return 'bg-spinny-orange-light0';
    };
    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center border-b dark:border-gray-200-200 pb-4 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-spinny-orange flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44-1.22a.75.75 0 00-1.06 0L8.172 6.172a.75.75 0 00-1.06 1.06L8.94 9.332a.75.75 0 001.191.04l3.22-4.294a.75.75 0 00-.04-1.19z" clipRule="evenodd" />
                </svg>
                <div>
                    <h3 className="text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">ReRide Certified Inspection</h3>
                    <p className="text-sm text-brand-gray-600 dark:text-spinny-text">Inspected by {report.inspector} on {new Date(report.date).toLocaleDateString()}</p>
                </div>
            </div>
            <p className="italic text-spinny-text-dark dark:text-spinny-text-dark mb-6">{report.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {Object.entries(report.scores).map(([key, score]) => (
                    <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm text-spinny-text-dark dark:text-spinny-text-dark">{key}</span>
                            <span className="font-bold text-sm text-spinny-text-dark dark:text-spinny-text-dark">{score}/100</span>
                        </div>
                        <div className="w-full bg-spinny-light-gray dark:bg-brand-gray-700 rounded-full h-2.5">
                            <div className={`${scoreColor(Number(score))} h-2.5 rounded-full`} style={{ width: `${score}%` }}></div>
                        </div>
                        <p className="text-xs text-spinny-text dark:text-spinny-text mt-1">{report.details[key]}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};


export const VehicleDetail: React.FC<VehicleDetailProps> = ({ vehicle, onBack: onBackToHome, comparisonList, onToggleCompare, onAddSellerRating, wishlist, onToggleWishlist, currentUser, onFlagContent, users, onViewSellerProfile, onStartChat, recommendations, onSelectVehicle }) => {
  console.log('🎯 VehicleDetail component rendering with vehicle:', vehicle);
  console.log('🎯 Vehicle data:', { id: vehicle?.id, make: vehicle?.make, model: vehicle?.model, price: vehicle?.price });
  
  // ✅ FIX: Call useApp() at the top level (React hooks rule)
  const { updateVehicle } = useApp();
  
  // Lightweight safety check - only essential properties
  const safeVehicle = {
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
    inquiriesCount: vehicle.inquiriesCount || 0
  };
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeMediaTab, setActiveMediaTab] = useState<'images' | 'video'>('images');
  const [showSellerRatingSuccess, setShowSellerRatingSuccess] = useState(false);
  const [prosAndCons, setProsAndCons] = useState<ProsAndCons | null>(null);
  const [isGeneratingProsCons, setIsGeneratingProsCons] = useState<boolean>(false);
  const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    setCurrentIndex(0);
    setProsAndCons(null);
    setIsGeneratingProsCons(false);
    setActiveMediaTab(safeVehicle.videoUrl ? 'images' : 'images');
    window.scrollTo(0, 0);
  }, [safeVehicle]);
  
  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex - 1 + safeVehicle.images.length) % safeVehicle.images.length);
  };
  
  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex + 1) % safeVehicle.images.length);
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
    setTimeout(() => setShowSellerRatingSuccess(false), 3000);
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

  const filteredRecommendations = useMemo(() => {
      return recommendations.filter(rec => rec.id !== safeVehicle.id).slice(0, 3);
  }, [recommendations, safeVehicle.id]);
  
  // Track a view when the detail page is opened
  useEffect(() => {
    const trackView = async () => {
      try {
        const res = await fetch('/api/vehicles?action=track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicleId: safeVehicle.id })
        });
        const data = await res.json().catch(() => ({}));
        // Optimistically update local state if API responded
        if (data && typeof data.views === 'number') {
          try {
            // Update selectedVehicle persisted copy
            const stored = sessionStorage.getItem('selectedVehicle');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed?.id === safeVehicle.id) {
                parsed.views = data.views;
                sessionStorage.setItem('selectedVehicle', JSON.stringify(parsed));
              }
            }
          } catch {}
          // ✅ FIX: Use updateVehicle from top-level hook call
          // Update global vehicles state via context so dashboards reflect the change
          try {
            // Call asynchronously; ignore errors
            updateVehicle(safeVehicle.id, { views: data.views }).catch(() => {});
          } catch {}
        }
      } catch (_err) {
        // Silently ignore tracking errors
      }
    };
    if (safeVehicle?.id) {
      trackView();
    }
  }, [safeVehicle?.id, updateVehicle]); // ✅ FIX: Add updateVehicle to dependencies

  console.log('🎯 VehicleDetail about to render JSX');
  return (
    <>
      <div className="bg-white dark:bg-white animate-fade-in">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <button onClick={onBackToHome} className="mb-6 bg-white text-spinny-text-dark dark:text-brand-gray-200 font-bold py-2 px-4 rounded-lg hover:bg-spinny-off-white dark:hover:bg-brand-gray-700 transition-colors shadow-soft">
                &larr; Back to Listings
              </button>
              
              <h1 className="text-4xl font-extrabold text-spinny-text-dark dark:text-spinny-text-dark mb-2">{safeVehicle.year} {safeVehicle.make} {safeVehicle.model} {safeVehicle.variant || ''}</h1>
              <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <StarRating rating={safeVehicle.averageRating || 0} readOnly />
                    <span className="text-brand-gray-600 dark:text-spinny-text">
                        {safeVehicle.averageRating?.toFixed(1) || 'No rating'} ({safeVehicle.ratingCount || 0} reviews)
                    </span>
                  </div>
                  {safeVehicle.certifiedInspection && (
                      <span className="bg-spinny-orange-light text-spinny-orange text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44-1.22a.75.75 0 00-1.06 0L8.172 6.172a.75.75 0 00-1.06 1.06L8.94 9.332a.75.75 0 001.191.04l3.22-4.294a.75.75 0 00-.04-1.19z" clipRule="evenodd" /></svg>
                          Certified
                      </span>
                  )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Media */}
                  <div className="lg:col-span-2 space-y-4">
                    {safeVehicle.videoUrl && (
                      <div className="flex space-x-2 border-b-2 border-gray-200-200 dark:border-gray-200-200">
                        <button onClick={() => setActiveMediaTab('images')} className={`py-2 px-4 font-semibold ${activeMediaTab === 'images' ? 'border-b-2' : 'text-spinny-text'}`} style={activeMediaTab === 'images' ? { borderColor: '#FF6B35', color: '#FF6B35' } : undefined}>Images</button>
                        <button onClick={() => setActiveMediaTab('video')} className={`py-2 px-4 font-semibold ${activeMediaTab === 'video' ? 'border-b-2' : 'text-spinny-text'}`} style={activeMediaTab === 'video' ? { borderColor: '#FF6B35', color: '#FF6B35' } : undefined}>Video</button>
                      </div>
                    )}
                    {activeMediaTab === 'images' ? (
                      <>
                        <div className="relative group">
                            <img key={currentIndex} className="w-full h-auto object-cover rounded-xl shadow-soft-xl animate-fade-in" src={getValidImages(safeVehicle.images)[currentIndex] || getFirstValidImage(safeVehicle.images)} alt={`${safeVehicle.make} ${safeVehicle.model} image ${currentIndex + 1}`} />
                            {safeVehicle.images.length > 1 && (
                                <>
                                    <button onClick={handlePrevImage} className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100" aria-label="Previous image"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                                    <button onClick={handleNextImage} className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100" aria-label="Next image"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                                </>
                            )}
                        </div>
                        {safeVehicle.images.length > 1 && (
                            <div className="flex space-x-2 overflow-x-auto pb-2 -mt-2">
                                {getValidImages(safeVehicle.images).map((img, index) => (
                                    <img key={index} src={getSafeImageSrc(img)} alt={`Thumbnail ${index + 1}`} className={`cursor-pointer rounded-md border-2 h-20 w-28 object-cover flex-shrink-0 ${currentIndex === index ? '' : 'border-transparent'} transition`} style={currentIndex === index ? { borderColor: '#FF6B35' } : undefined} onMouseEnter={(e) => currentIndex !== index && (e.currentTarget.style.borderColor = 'var(--spinny-blue)')} onMouseLeave={(e) => currentIndex !== index && (e.currentTarget.style.borderColor = '')} onClick={() => setCurrentIndex(index)} />
                                ))}
                            </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full aspect-video bg-black rounded-xl shadow-soft-xl overflow-hidden animate-fade-in">
                        <video src={safeVehicle.videoUrl} controls className="w-full h-full object-cover">Your browser does not support the video tag.</video>
                      </div>
                    )}
                  </div>
                  
                  {/* Right Column: Price and Actions */}
                  <div className="space-y-6 self-start lg:sticky top-24">
                      <div className="p-6 bg-white rounded-xl shadow-soft-lg space-y-4">
                           <p className="text-4xl font-extrabold" style={{ color: '#FF6B35' }}>₹{safeVehicle.price.toLocaleString('en-IN')}</p>
                           <button onClick={() => onStartChat(safeVehicle)} className="w-full btn-brand-primary text-white font-bold py-3 px-6 rounded-lg text-lg transition-all transform hover:scale-105">
                                Chat with Seller
                            </button>
                            <div className="flex gap-4">
                               <button
                                  onClick={() => onToggleCompare(safeVehicle.id)}
                                  disabled={isCompareDisabled}
                                  className={`w-full font-bold py-3 px-4 rounded-lg text-lg transition-all flex items-center justify-center gap-2 ${isComparing ? 'bg-spinny-orange text-spinny-orange' : 'bg-spinny-light-gray dark:bg-brand-gray-700'} ${isCompareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {isComparing ? 'Comparing' : 'Compare'}
                              </button>
                               <button
                                  onClick={() => onToggleWishlist(safeVehicle.id)}
                                  className={`w-full font-bold py-3 px-4 rounded-lg text-lg transition-all flex items-center justify-center gap-2 ${isInWishlist ? 'bg-spinny-blue text-spinny-orange' : 'bg-spinny-light-gray dark:bg-brand-gray-700'}`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                                  {isInWishlist ? 'Saved' : 'Save'}
                              </button>
                            </div>
                            <SocialShareButtons vehicle={safeVehicle} />
                      </div>
                      
                      {seller && <div className="p-6 bg-white rounded-xl shadow-soft">
                            <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-3">Seller Information</h3>
                            <div className="flex items-center gap-4">
                                <img src={getSafeImageSrc(seller.logoUrl, `https://i.pravatar.cc/100?u=${seller.email}`)} alt="Seller Logo" className="w-16 h-16 rounded-full object-cover" />
                                <div>
                                    <h4 className="font-bold text-spinny-text-dark dark:text-spinny-text-dark">{seller.dealershipName || seller.name}</h4>
                                    <div className="flex items-center gap-1 mt-1">
                                        <StarRating rating={seller.averageRating || 0} size="sm" readOnly />
                                        <span className="text-xs text-spinny-text dark:text-spinny-text">({seller.ratingCount || 0})</span>
                                    </div>
                                    <BadgeDisplay badges={seller.badges || []} size="sm" />
                                    <div className="text-xs text-brand-gray-600 dark:text-spinny-text mt-1">
                                        {getFollowersCount(seller.email)} Followers • {getFollowingCount(seller.email)} Following
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => onViewSellerProfile(seller.email)} className="mt-4 w-full text-center text-sm font-bold hover:underline transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--spinny-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--spinny-orange)'}>View Seller Profile</button>
                            {canRate && <div className="mt-4 pt-4 border-t dark:border-gray-200-200">
                                <p className="text-sm font-medium text-center text-brand-gray-600 dark:text-spinny-text mb-2">Rate your experience with this seller</p>
                                <div className="flex justify-center">
                                  <StarRating rating={0} onRate={handleRateSeller} />
                                </div>
                                {showSellerRatingSuccess && <p className="text-center text-spinny-orange text-sm mt-2">Thanks for your feedback!</p>}
                            </div>}
                      </div>}
                      
                      <EMICalculator price={safeVehicle.price} />

                  </div>
              </div>
              
              {/* Collapsible Sections */}
               <div className="mt-10 lg:mt-12 space-y-6">
                    <CollapsibleSection title="Overview" defaultOpen={true}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            <KeySpec label="Make Year" value={safeVehicle.year} />
                            <KeySpec label="Registration" value={safeVehicle.registrationYear} />
                            <KeySpec label="Fuel Type" value={safeVehicle.fuelType} />
                            <KeySpec label="Km Driven" value={safeVehicle.mileage.toLocaleString('en-IN')} />
                            <KeySpec label="Transmission" value={safeVehicle.transmission} />
                            <KeySpec label="Owners" value={safeVehicle.noOfOwners} />
                            <KeySpec label="Insurance" value={safeVehicle.insuranceValidity} />
                            <KeySpec label="RTO" value={safeVehicle.rto} />
                        </div>
                        {safeVehicle.description && (
                            <div>
                                <h4 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-2">Description</h4>
                                <p className="text-spinny-text-dark dark:text-spinny-text-dark whitespace-pre-line">{safeVehicle.description}</p>
                            </div>
                        )}
                    </CollapsibleSection>
                    
                     <CollapsibleSection title="Detailed Specifications">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                             <SpecDetail label="Engine" value={safeVehicle.engine} />
                             <SpecDetail label="Displacement" value={safeVehicle.displacement} />
                             <SpecDetail label="Transmission" value={safeVehicle.transmission} />
                             <SpecDetail label="Fuel Type" value={safeVehicle.fuelType} />
                             <SpecDetail label="Mileage / Range" value={safeVehicle.fuelEfficiency} />
                             <SpecDetail label="Ground Clearance" value={safeVehicle.groundClearance} />
                             <SpecDetail label="Boot Space" value={safeVehicle.bootSpace} />
                             <SpecDetail label="Color" value={safeVehicle.color} />
                        </dl>
                    </CollapsibleSection>

                    <CollapsibleSection title="Features, Pros & Cons">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">Included Features</h4>
                                {safeVehicle.features.length > 0 ? (
                                    <div className="flex flex-wrap gap-3">
                                        {safeVehicle.features.map(feature => (
                                          <div key={feature} className="flex items-center gap-2 text-spinny-text-dark dark:text-spinny-text-dark bg-spinny-off-white dark:bg-brand-gray-700 px-3 py-1 rounded-full text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-spinny-orange" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                            {feature}
                                          </div>
                                        ))}
                                    </div>
                                ) : <p className="text-spinny-text">No features listed.</p>}
                            </div>
                             <div>
                                <h4 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">AI Expert Analysis</h4>
                                {isGeneratingProsCons ? (
                                    <div className="flex items-center gap-2 text-spinny-text"><div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin" style={{ borderColor: '#FF6B35' }}></div> Generating...</div>
                                ) : prosAndCons ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h5 className="font-semibold text-spinny-orange mb-2">Pros</h5>
                                            <ul className="list-disc list-inside space-y-1 text-sm">{prosAndCons.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                        </div>
                                        <div>
                                            <h5 className="font-semibold text-spinny-orange mb-2">Cons</h5>
                                            <ul className="list-disc list-inside space-y-1 text-sm">{prosAndCons.cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={handleGenerateProsCons} className="text-sm font-bold hover:underline transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--spinny-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--spinny-orange)'}>Generate Pros & Cons</button>
                                )}
                            </div>
                        </div>
                    </CollapsibleSection>
                    
                    {safeVehicle.certifiedInspection && (
                        <CollapsibleSection title="Certified Inspection Report">
                            <CertifiedInspectionReport report={safeVehicle.certifiedInspection} />
                        </CollapsibleSection>
                    )}

                    {(safeVehicle.serviceRecords || safeVehicle.accidentHistory || safeVehicle.documents) && (
                        <CollapsibleSection title="Vehicle History & Documents">
                            {(safeVehicle.serviceRecords || safeVehicle.accidentHistory) && (
                                <VehicleHistory serviceRecords={safeVehicle.serviceRecords || []} accidentHistory={safeVehicle.accidentHistory || []} />
                            )}
                            {safeVehicle.documents && safeVehicle.documents.length > 0 && <div className="mt-6">
                                <h4 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">Available Documents</h4>
                                <div className="flex flex-wrap gap-4">
                                    {safeVehicle.documents.map(doc => <DocumentChip key={doc.name} doc={doc} />)}
                                </div>
                            </div>}
                        </CollapsibleSection>
                    )}
               </div>

              <div className="text-center mt-12">
                  <button onClick={handleFlagClick} className="text-xs text-spinny-text hover:text-spinny-orange">Report this listing</button>
              </div>

              {filteredRecommendations.length > 0 && <div className="mt-12">
                  <h2 className="text-3xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-6">Similar Vehicles</h2>
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
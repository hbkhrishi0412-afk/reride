import React, { useState, useMemo } from 'react';
import type { Vehicle, ProsAndCons, User } from '../types';
import { generateProsAndCons } from '../services/geminiService';
import { getFirstValidImage, getValidImages } from '../utils/imageUtils';
import { MobileImageGallery } from './MobileImageGallery';
import { MobileShareSheet } from './MobileShareSheet';
import { MobileEMICalculator } from './MobileEMICalculator';

interface MobileVehicleDetailProps {
  vehicle: Vehicle;
  onBack: () => void;
  comparisonList: number[];
  onToggleCompare: (id: number) => void;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  currentUser: User | null;
  users: User[];
  onViewSellerProfile: (sellerEmail: string) => void;
  onStartChat: (vehicle: Vehicle) => void;
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
  comparisonList,
  onToggleCompare,
  wishlist,
  onToggleWishlist,
  currentUser,
  users,
  onViewSellerProfile,
  onStartChat,
  recommendations,
  onSelectVehicle
}) => {
  const [showGallery, setShowGallery] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showEMICalculator, setShowEMICalculator] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'features'>('overview');
  const [prosAndCons, setProsAndCons] = useState<ProsAndCons | null>(null);
  const [isGeneratingProsCons, setIsGeneratingProsCons] = useState(false);

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
    inquiriesCount: vehicle.inquiriesCount || 0
  }), [vehicle]);

  const seller = useMemo(() => {
    if (!safeVehicle.sellerEmail) return undefined;
    const normalizedSellerEmail = safeVehicle.sellerEmail.toLowerCase().trim();
    return users.find(u => {
      if (!u || !u.email) return false;
      return u.email.toLowerCase().trim() === normalizedSellerEmail;
    });
  }, [users, safeVehicle.sellerEmail]);

  const isComparing = comparisonList.includes(safeVehicle.id);
  const isInWishlist = wishlist.includes(safeVehicle.id);

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
    return recommendations.filter(rec => rec.id !== safeVehicle.id).slice(0, 3);
  }, [recommendations, safeVehicle.id]);

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
    <div className="w-full bg-gray-50 pb-6">
      {/* Image Gallery Header */}
      <div className="relative w-full" style={{ height: '50vh', minHeight: '300px' }}>
        <img
          src={getFirstValidImage(safeVehicle.images, safeVehicle.id)}
          alt={`${safeVehicle.make} ${safeVehicle.model}`}
          className="w-full h-full object-cover"
          onClick={() => setShowGallery(true)}
        />
        {safeVehicle.images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm z-20">
            {safeVehicle.images.length} photos • Tap to view
          </div>
        )}
      </div>

      {/* Content - Below Images with no overlap */}
      <div className="px-4 relative z-10 space-y-4 pb-6">
        {/* Vehicle Details Card */}
        <div className="bg-white rounded-2xl pt-6 pb-4 px-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {safeVehicle.year} {safeVehicle.make} {safeVehicle.model}
              </h1>
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

        {/* Seller Information Card with Chat Button */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          {(seller || safeVehicle.sellerName || safeVehicle.sellerEmail) && (
            <div className="flex items-center gap-3 mb-4">
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
                   'Seller'}
                </h3>
                <p className="text-sm text-gray-600">0 Followers</p>
              </div>
              {safeVehicle.sellerEmail && (
                <button
                  onClick={() => onViewSellerProfile(safeVehicle.sellerEmail)}
                  className="text-sm text-orange-500 font-semibold flex-shrink-0"
                >
                  View Profile
                </button>
              )}
            </div>
          )}
          {/* Chat Button - Always visible */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleChat();
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            style={{ minHeight: '48px' }}
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat with Seller
          </button>
        </div>

        {/* Pricing Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Fixed on road price</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mb-2">
            <span className="text-3xl font-bold text-purple-600">{formatCurrency(safeVehicle.price)}</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Includes RC transfer, Insurance & more</p>
          
          {/* EMI Information */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">Monthly EMI</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(baseEMI)}/m
              </p>
            </div>
            <button
              onClick={() => setShowEMICalculator(true)}
              className="text-sm text-orange-500 font-semibold"
            >
              Calculate your EMI
            </button>
          </div>

          {/* Loan Offer Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <p className="text-sm text-gray-800">
              Save extra ₹{Math.round((baseEMI * 60) - (baseEMI * 0.95 * 60)).toLocaleString()} in loan interest with 1.25% lower rate
            </p>
          </div>
        </div>

        {/* Additional Details Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex border-b border-gray-200 mb-4">
            {(['overview', 'specs', 'features'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-semibold uppercase ${
                  activeTab === tab
                    ? 'text-orange-500 border-b-2 border-orange-500'
                    : 'text-gray-600'
                }`}
              >
                {tab === 'specs' ? 'Feature & Specs' : tab}
              </button>
            ))}
          </div>

          <div>
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {safeVehicle.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-700 leading-relaxed">{safeVehicle.description}</p>
                  </div>
                )}

                {!prosAndCons && !isGeneratingProsCons && (
                  <button
                    onClick={handleGenerateProsCons}
                    className="w-full py-3 bg-orange-50 text-orange-600 rounded-xl font-semibold"
                  >
                    Generate AI Pros & Cons
                  </button>
                )}
                
                {isGeneratingProsCons && (
                  <div className="text-center py-8">
                    <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-2 text-sm text-gray-600">Generating insights...</p>
                  </div>
                )}

                {prosAndCons && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-green-600 mb-2">✓ Pros</h3>
                      <ul className="space-y-1">
                        {prosAndCons.pros.map((pro, idx) => (
                          <li key={idx} className="text-gray-700 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-red-600 mb-2">✗ Cons</h3>
                      <ul className="space-y-1">
                        {prosAndCons.cons.map((con, idx) => (
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

            {activeTab === 'specs' && (
              <div className="grid grid-cols-2 gap-4">
                <SpecCard label="Make Year" value={safeVehicle.year?.toString()} />
                <SpecCard label="Registration" value={safeVehicle.registrationYear?.toString() || safeVehicle.year?.toString()} />
                <SpecCard label="Fuel Type" value={safeVehicle.fuelType} />
                <SpecCard label="Km Driven" value={`${safeVehicle.mileage.toLocaleString()} km`} />
                <SpecCard label="Transmission" value={safeVehicle.transmission} />
                <SpecCard label="Owners" value={safeVehicle.noOfOwners?.toString() || '1'} />
                <SpecCard label="Insurance" value={safeVehicle.insuranceValidity || 'N/A'} />
                <SpecCard label="RTO" value={safeVehicle.rto || 'N/A'} />
              </div>
            )}

            {activeTab === 'features' && (
              <div>
                {safeVehicle.features.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {safeVehicle.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No features listed</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        {filteredRecommendations.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Similar Vehicles</h2>
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


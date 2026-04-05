import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { User, Vehicle, Conversation } from '../types';
import { View as ViewEnum } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import * as buyerService from '../services/buyerService';
import { getLastVisibleMessageForViewer } from '../utils/conversationView';
import { getThreadLastMessagePreview } from '../utils/messagePreview';

interface MobileBuyerDashboardProps {
  currentUser: User;
  vehicles: Vehicle[];
  wishlist: number[];
  conversations: Conversation[];
  onNavigate: (view: ViewEnum) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleWishlist: (id: number) => void;
  onToggleCompare: (id: number) => void;
  comparisonList: number[];
  onViewSellerProfile: (sellerEmail: string) => void;
  onLogout?: () => void;
}

/**
 * Mobile-Optimized Buyer Dashboard
 * Features:
 * - Saved searches
 * - Price alerts
 * - Viewing history
 * - Personalized recommendations
 */
export const MobileBuyerDashboard: React.FC<MobileBuyerDashboardProps> = ({
  currentUser,
  vehicles,
  wishlist,
  conversations,
  onNavigate,
  onSelectVehicle,
  onToggleWishlist: _onToggleWishlist,
  onToggleCompare: _onToggleCompare,
  comparisonList,
  onViewSellerProfile: _onViewSellerProfile,
  onLogout
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'searches' | 'activity'>('overview');
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>([]);
  const savedSearches = useMemo(
    () => buyerService.getSavedSearches(currentUser?.email || ''),
    [currentUser?.email]
  );

  // Load recently viewed in useEffect to avoid infinite re-renders (async getRecentlyViewed)
  useEffect(() => {
    if (!currentUser?.email) return;
    const fetchRecentlyViewed = async () => {
      try {
        const ids = await buyerService.getRecentlyViewed(currentUser.email);
        setRecentlyViewedIds(ids);
      } catch (error) {
        console.error('Failed to fetch recently viewed', error);
      }
    };
    fetchRecentlyViewed();
  }, [currentUser?.email]);

  // Get recently viewed vehicles from loaded IDs
  const recentlyViewed = useMemo(() => {
    if (!vehicles || !Array.isArray(vehicles)) return [];
    const viewedIds = recentlyViewedIds.slice(0, 6);
    return vehicles.filter(v => v && viewedIds.includes(v.id));
  }, [recentlyViewedIds, vehicles]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const wishlistVehicles = useMemo(
    () => vehicles.filter(v => wishlist.includes(v.id)),
    [vehicles, wishlist]
  );

  const recentConversations = useMemo(
    () => conversations.slice(0, 5),
    [conversations]
  );

  const mobileTabs = useMemo(
    () =>
      [
        { id: 'overview' as const, label: t('buyerDashboard.mobile.tab.overview') },
        { id: 'searches' as const, label: t('buyerDashboard.mobile.tab.searches') },
        { id: 'activity' as const, label: t('buyerDashboard.mobile.tab.activity') },
      ],
    [t]
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('nav.dashboard')}</h1>
            <p className="text-gray-600 text-sm">{t('buyerDashboard.mobile.subtitle')}</p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="ml-4 p-2 text-gray-600 hover:text-red-600 active:opacity-70 transition-colors"
              title={t('nav.logout')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Welcome Banner */}
      <div className="mx-4 mt-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-5 text-white">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">
              {t('buyerDashboard.mobile.welcome', {
                name: currentUser.name?.split(' ')[0] || t('buyerDashboard.mobile.guestName'),
              })}
            </h2>
            <p className="text-white/90 text-sm">{t('buyerDashboard.mobile.trackJourney')}</p>
          </div>
          <div className="ml-4">
            <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-xs font-medium">{t('buyerDashboard.mobile.stat.saved')}</p>
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{wishlist.length}</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-xs font-medium">{t('buyerDashboard.mobile.stat.messages')}</p>
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{conversations.length}</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-xs font-medium">{t('buyerDashboard.mobile.stat.viewed')}</p>
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{recentlyViewed.length}</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-xs font-medium">{t('buyerDashboard.mobile.stat.compared')}</p>
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{comparisonList.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 mt-4 flex">
        {mobileTabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${
              activeTab === id
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-600'
            }`}
          >
            {id === 'overview' && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Actions Section */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t('buyerDashboard.mobile.quickActions')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onNavigate(ViewEnum.USED_CARS)}
                  className="p-4 bg-orange-50 rounded-xl text-center active:scale-95 transition-transform"
                >
                  <svg className="w-8 h-8 text-orange-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-900">{t('buyerDashboard.mobile.browseCars')}</p>
                </button>
                <button
                  onClick={() => onNavigate(ViewEnum.WISHLIST)}
                  className="p-4 bg-red-50 rounded-xl text-center active:scale-95 transition-transform"
                >
                  <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-900">{t('buyerDashboard.mobile.savedVehicles')}</p>
                </button>
              </div>
            </div>

            {/* Saved Vehicles */}
            {wishlistVehicles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900">{t('buyerDashboard.mobile.savedVehicles')}</h2>
                  <button
                    onClick={() => onNavigate(ViewEnum.WISHLIST)}
                    className="text-sm text-orange-500 font-semibold"
                  >
                    {t('buyerDashboard.mobile.viewAll')}
                  </button>
                </div>
                <div className="space-y-3">
                  {wishlistVehicles.slice(0, 3).map((vehicle) => (
                    <div
                      key={vehicle.id}
                      onClick={() => onSelectVehicle(vehicle)}
                      className="bg-white rounded-xl p-4 shadow-sm flex gap-4 active:scale-[0.98] transition-transform"
                    >
                      <img
                        src={getFirstValidImage(vehicle.images, vehicle.id)}
                        alt={`${vehicle.make} ${vehicle.model}`}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-lg font-bold text-orange-500 mb-1">
                          {formatCurrency(vehicle.price)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {vehicle.mileage.toLocaleString()} km • {vehicle.fuelType}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Conversations */}
            {recentConversations.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900">{t('buyerDashboard.mobile.recentChats')}</h2>
                  <button
                    onClick={() => onNavigate(ViewEnum.INBOX)}
                    className="text-sm text-orange-500 font-semibold"
                  >
                    {t('buyerDashboard.mobile.viewAll')}
                  </button>
                </div>
                <div className="space-y-2">
                  {recentConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => onNavigate(ViewEnum.INBOX)}
                      className="w-full bg-white rounded-xl p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                    >
                      <p className="font-semibold text-gray-900 mb-1">{conv.vehicleName}</p>
                      <p className="text-sm text-gray-600 truncate">
                        {(() => {
                          const last = getLastVisibleMessageForViewer(conv, 'customer');
                          const { prefix, text } = getThreadLastMessagePreview(last, { viewer: 'customer' });
                          const line = `${prefix}${text}`;
                          return line === 'No messages yet' ? t('buyerDashboard.mobile.noMessagesYet') : line;
                        })()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'searches' && (
          <div className="space-y-4">
            {savedSearches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-2">{t('buyerDashboard.mobile.noSavedSearches')}</p>
                <button
                  onClick={() => onNavigate(ViewEnum.USED_CARS)}
                  className="text-orange-500 font-semibold"
                >
                  {t('buyerDashboard.mobile.startSearching')}
                </button>
              </div>
            ) : (
              savedSearches.map((search, idx) => {
                const filters = search.filters || {};
                const filterText =
                  [
                    filters.make && t('buyerDashboard.filter.make', { value: filters.make }),
                    filters.model && t('buyerDashboard.filter.model', { value: filters.model }),
                    (filters.minPrice || filters.maxPrice) &&
                      t('buyerDashboard.filter.price', {
                        min: (filters.minPrice || 0).toLocaleString('en-IN'),
                        max: (filters.maxPrice || 0).toLocaleString('en-IN'),
                      }),
                  ]
                    .filter(Boolean)
                    .join(' • ') || t('buyerDashboard.mobile.noFilters');
                
                return (
                  <div key={idx} className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-2">{search.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{filterText}</p>
                    <button
                      onClick={() => onNavigate(ViewEnum.USED_CARS)}
                      className="text-sm text-orange-500 font-semibold"
                    >
                      {t('buyerDashboard.mobile.viewResults')}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            {recentlyViewed.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-2">{t('buyerDashboard.mobile.noRecentlyViewed')}</p>
                <button
                  onClick={() => onNavigate(ViewEnum.USED_CARS)}
                  className="text-orange-500 font-semibold"
                >
                  {t('buyerDashboard.mobile.startBrowsing')}
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">{t('buyerDashboard.recentlyViewed')}</h2>
                <div className="space-y-3">
                  {recentlyViewed.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      onClick={() => onSelectVehicle(vehicle)}
                      className="bg-white rounded-xl p-4 shadow-sm flex gap-4 active:scale-[0.98] transition-transform"
                    >
                      <img
                        src={getFirstValidImage(vehicle.images, vehicle.id)}
                        alt={`${vehicle.make} ${vehicle.model}`}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-lg font-bold text-orange-500 mb-1">
                          {formatCurrency(vehicle.price)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {vehicle.mileage.toLocaleString()} km • {vehicle.fuelType}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Logout Section */}
            {onLogout && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={onLogout}
                  className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-semibold border border-red-200 active:scale-95 transition-transform"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {t('nav.logout')}
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileBuyerDashboard;

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { User, Vehicle, Conversation } from '../types';
import { View as ViewEnum } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import * as buyerService from '../services/buyerService';
import { getLastVisibleMessageForViewer } from '../utils/conversationView';
import { getThreadLastMessagePreview } from '../utils/messagePreview';
import { StatCard, StatCardGrid, EmptyState } from './dashboard/shared';

const ServiceCart = lazy(() => import('./ServiceCart'));

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
  const [activeTab, setActiveTab] = useState<'overview' | 'searches' | 'activity' | 'serviceTrack'>('overview');
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
        { id: 'serviceTrack' as const, label: t('buyerDashboard.mobile.tab.trackRequests') },
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

      {/* Stats Cards — shared primitives, accessible and keyboard-navigable */}
      <div className="px-4 mt-4">
        <StatCardGrid cols={2}>
          <StatCard
            label={t('buyerDashboard.mobile.stat.saved')}
            value={wishlist.length}
            icon="❤️"
            iconGradient="from-rose-500 to-pink-600"
            accent="rose"
            dense
            onClick={() => onNavigate(ViewEnum.WISHLIST)}
          />
          <StatCard
            label={t('buyerDashboard.mobile.stat.messages')}
            value={conversations.length}
            icon="💬"
            iconGradient="from-blue-500 to-indigo-600"
            accent="blue"
            dense
            onClick={() => onNavigate(ViewEnum.INBOX)}
          />
          <StatCard
            label={t('buyerDashboard.mobile.stat.viewed')}
            value={recentlyViewed.length}
            icon="👁️"
            iconGradient="from-purple-500 to-indigo-500"
            accent="purple"
            dense
            onClick={() => setActiveTab('activity')}
          />
          <StatCard
            label={t('buyerDashboard.mobile.stat.compared')}
            value={comparisonList.length}
            icon="⚖️"
            iconGradient="from-emerald-500 to-green-600"
            accent="emerald"
            dense
          />
        </StatCardGrid>
      </div>

      {/* Tabs — tablist with a11y semantics */}
      <div
        role="tablist"
        aria-label={t('nav.dashboard') || 'Buyer dashboard'}
        className="bg-white border-b border-gray-200 mt-4 flex overflow-x-auto no-scrollbar"
      >
        {mobileTabs.map(({ id, label }, i) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              role="tab"
              type="button"
              id={`mbd-tab-${id}`}
              aria-selected={isActive}
              aria-controls={`mbd-panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const next =
                  e.key === 'ArrowRight'
                    ? mobileTabs[(i + 1) % mobileTabs.length]
                    : mobileTabs[(i - 1 + mobileTabs.length) % mobileTabs.length];
                if (next) setActiveTab(next.id);
              }}
              onClick={() => setActiveTab(id)}
              className={`flex-1 min-w-[25%] py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 ${
                isActive
                  ? 'text-orange-500 border-b-2 border-orange-500'
                  : 'text-gray-600 border-b-2 border-transparent'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === 'overview' && (
          <div role="tabpanel" id="mbd-panel-overview" aria-labelledby="mbd-tab-overview" className="space-y-6">
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
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => onSelectVehicle(vehicle)}
                      aria-label={`${vehicle.year} ${vehicle.make} ${vehicle.model}, ${formatCurrency(vehicle.price)}`}
                      className="w-full text-left bg-white rounded-xl p-4 shadow-sm flex gap-4 active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500"
                    >
                      <img
                        src={getFirstValidImage(vehicle.images, vehicle.id)}
                        alt=""
                        aria-hidden="true"
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 truncate">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-lg font-bold text-orange-500 mb-1">
                          {formatCurrency(vehicle.price)}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {vehicle.mileage.toLocaleString()} km • {vehicle.fuelType}
                        </p>
                      </div>
                    </button>
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
          <div role="tabpanel" id="mbd-panel-searches" aria-labelledby="mbd-tab-searches" className="space-y-4">
            {savedSearches.length === 0 ? (
              <EmptyState
                icon="🔍"
                title={t('buyerDashboard.mobile.noSavedSearches')}
                action={{ label: t('buyerDashboard.mobile.startSearching'), onClick: () => onNavigate(ViewEnum.USED_CARS) }}
                dense
              />
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
                  <div key={search.id ?? `search-${idx}`} className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-2 truncate">{search.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{filterText}</p>
                    <button
                      type="button"
                      onClick={() => onNavigate(ViewEnum.USED_CARS)}
                      className="text-sm text-orange-500 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
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
          <div role="tabpanel" id="mbd-panel-activity" aria-labelledby="mbd-tab-activity" className="space-y-4">
            {recentlyViewed.length === 0 ? (
              <EmptyState
                icon="👁️"
                title={t('buyerDashboard.mobile.noRecentlyViewed')}
                action={{ label: t('buyerDashboard.mobile.startBrowsing'), onClick: () => onNavigate(ViewEnum.USED_CARS) }}
                dense
              />
            ) : (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">{t('buyerDashboard.recentlyViewed')}</h2>
                <div className="space-y-3">
                  {recentlyViewed.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => onSelectVehicle(vehicle)}
                      aria-label={`${vehicle.year} ${vehicle.make} ${vehicle.model}, ${formatCurrency(vehicle.price)}`}
                      className="w-full text-left bg-white rounded-xl p-4 shadow-sm flex gap-4 active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500"
                    >
                      <img
                        src={getFirstValidImage(vehicle.images, vehicle.id)}
                        alt=""
                        aria-hidden="true"
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 truncate">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-lg font-bold text-orange-500 mb-1">
                          {formatCurrency(vehicle.price)}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {vehicle.mileage.toLocaleString()} km • {vehicle.fuelType}
                        </p>
                      </div>
                    </button>
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

        {activeTab === 'serviceTrack' && (
          <div role="tabpanel" id="mbd-panel-serviceTrack" aria-labelledby="mbd-tab-serviceTrack" className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-1">{t('buyerDashboard.trackRequests.title')}</h2>
              <p className="text-sm text-gray-600 mb-4">{t('buyerDashboard.trackRequests.subtitle')}</p>
              <button
                type="button"
                onClick={() => onNavigate(ViewEnum.SERVICE_CART)}
                className="w-full py-3 rounded-xl bg-orange-500 text-white font-semibold active:scale-95 transition-transform mb-4"
              >
                {t('buyerDashboard.trackRequests.bookService')}
              </button>
              <Suspense
                fallback={
                  <div className="text-sm text-gray-600 py-6 text-center">{t('buyerDashboard.trackRequests.loading')}</div>
                }
              >
                <ServiceCart isLoggedIn embedTrackOnly customerUserId={currentUser?.id ?? null} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileBuyerDashboard;

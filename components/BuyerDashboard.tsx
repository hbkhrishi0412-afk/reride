import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { User, Vehicle, SavedSearch, Conversation } from '../types';
import { View } from '../types';
import * as buyerService from '../services/buyerService';
import VehicleCard from './VehicleCard';
import LazyImage from './LazyImage';
import { getFirstValidImage } from '../utils/imageUtils';

const ServiceCart = lazy(() => import('./ServiceCart'));

interface BuyerDashboardProps {
  currentUser: User;
  vehicles: Vehicle[];
  wishlist: number[];
  conversations: Conversation[];
  onNavigate: (view: View) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleWishlist: (id: number) => void;
  onToggleCompare: (id: number) => void;
  comparisonList: number[];
  onViewSellerProfile: (sellerEmail: string) => void;
}

const BuyerDashboard: React.FC<BuyerDashboardProps> = ({
  currentUser,
  vehicles,
  wishlist,
  conversations,
  onNavigate,
  onSelectVehicle,
  onToggleWishlist,
  onToggleCompare,
  comparisonList,
  onViewSellerProfile,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'searches' | 'activity' | 'alerts' | 'serviceTrack'>('overview');
  // Removed unused showSaveSearchModal state
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(
    () => buyerService.getSavedSearches(currentUser?.email || '')
  );
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>([]);

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

  // Get wishlist vehicles
  const wishlistVehicles = useMemo(
    () => {
      if (!vehicles || !Array.isArray(vehicles)) return [];
      return vehicles.filter(v => v && wishlist.includes(v.id)).slice(0, 6);
    },
    [vehicles, wishlist]
  );

  // Check for price drops
  const priceDrops = useMemo(() => {
    if (!currentUser?.email) return [];
    return buyerService.checkPriceDrops(currentUser.email, wishlist, vehicles);
  }, [currentUser?.email, wishlist, vehicles]);

  // Find new matches for saved searches
  const newMatches = useMemo(() => {
    if (!currentUser?.email) return [];
    return buyerService.findNewMatches(currentUser.email, vehicles)
      .filter(result => result.matches.length > 0);
  }, [currentUser?.email, vehicles]);

  const handleDeleteSearch = useCallback((searchId: string) => {
    buyerService.deleteSavedSearch(currentUser.email, searchId);
    setSavedSearches(buyerService.getSavedSearches(currentUser.email));
  }, [currentUser.email]);

  const handleToggleAlerts = useCallback((searchId: string, emailAlerts: boolean) => {
    buyerService.updateSavedSearch(currentUser.email, searchId, { emailAlerts });
    setSavedSearches(buyerService.getSavedSearches(currentUser.email));
  }, [currentUser.email]);

  const stats = useMemo(
    () => [
      {
        label: t('buyerDashboard.stat.wishlist'),
        value: wishlist.length,
        icon: '❤️',
        action: () => onNavigate(View.WISHLIST),
      },
      {
        label: t('buyerDashboard.stat.messages'),
        value: conversations.length,
        icon: '💬',
        action: () => onNavigate(View.INBOX),
      },
      {
        label: t('buyerDashboard.stat.savedSearches'),
        value: savedSearches.length,
        icon: '🔍',
        action: () => setActiveTab('searches'),
      },
      {
        label: t('buyerDashboard.stat.recentlyViewed'),
        value: recentlyViewed.length,
        icon: '👁️',
        action: () => setActiveTab('activity'),
      },
    ],
    [t, wishlist.length, conversations.length, savedSearches.length, recentlyViewed.length, onNavigate]
  );

  // Safety check: show login prompt when no currentUser (after all hooks)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-brand-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-reride-text-dark dark:text-reride-text mb-4">
            {t('buyerDashboard.loginPrompt')}
          </h2>
          <button
            onClick={() => onNavigate(View.LOGIN_PORTAL)}
            className="btn-brand-primary text-white px-6 py-2 rounded-lg"
          >
            {t('buyerDashboard.goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-orange-200/15 to-pink-200/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  {t('nav.dashboard')}
                </h3>
              </div>
              
              <button
                onClick={() => setActiveTab('overview')}
                className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === 'overview' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <span className="font-medium">{t('buyerDashboard.tab.overview')}</span>
              </button>
              
              <button
                onClick={() => setActiveTab('searches')}
                className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === 'searches' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <span className="font-medium">{t('buyerDashboard.tab.savedSearches')}</span>
              </button>
              
              <button
                onClick={() => setActiveTab('activity')}
                className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === 'activity' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span className="font-medium">{t('buyerDashboard.tab.recentActivity')}</span>
              </button>
              
              <button
                onClick={() => setActiveTab('alerts')}
                className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === 'alerts' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12.828 7H4.828z"/>
                </svg>
                <span className="font-medium">{t('buyerDashboard.tab.alerts')}</span>
                {priceDrops.length + newMatches.length > 0 && (
                  <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-auto">
                    {priceDrops.length + newMatches.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('serviceTrack')}
                className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === 'serviceTrack'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span className="font-medium">{t('buyerDashboard.tab.trackRequests')}</span>
              </button>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="lg:col-span-1">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-reride-text-dark dark:text-reride-text mb-2">
            {t('buyerDashboard.myDashboard')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('buyerDashboard.welcomeSubtitle', { name: currentUser.name })}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={stat.action}
              className="bg-white dark:bg-brand-gray-800 rounded-xl shadow-soft p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-2 gap-3">
                <span className="text-2xl flex-shrink-0">{stat.icon}</span>
                <span className="text-lg sm:text-xl lg:text-2xl font-bold text-reride-orange whitespace-nowrap overflow-hidden text-ellipsis min-w-0 flex-1 text-right">
                  {stat.value}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                {stat.label}
              </p>
            </button>
          ))}
        </div>

        {/* Alerts Section */}
        {(priceDrops.length > 0 || newMatches.length > 0) && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-yellow-900 dark:text-yellow-200 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {t('buyerDashboard.newAlerts')}
            </h2>

            {/* Price Drops */}
            {priceDrops.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                  🔽 {t('buyerDashboard.priceDropsHeading', { count: priceDrops.length })}
                </h3>
                {priceDrops.map(drop => {
                  const vehicle = vehicles.find(v => v.id === drop.vehicleId);
                  if (!vehicle) return null;
                  const savings = drop.oldPrice - drop.newPrice;
                  return (
                    <button
                      key={drop.vehicleId}
                      type="button"
                      className="w-full text-left bg-white dark:bg-brand-gray-800 rounded-lg p-4 mb-2 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onSelectVehicle(vehicle)}
                    >
                      <p className="font-semibold text-reride-text-dark dark:text-reride-text">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="line-through">₹{drop.oldPrice.toLocaleString('en-IN')}</span>
                        {' → '}
                        <span className="text-reride-orange font-bold">
                          ₹{drop.newPrice.toLocaleString('en-IN')}
                        </span>
                        {' '}
                        <span className="text-green-600">
                          {t('buyerDashboard.saveAmount', {
                            amount: savings.toLocaleString('en-IN'),
                          })}
                        </span>
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* New Matches */}
            {newMatches.length > 0 && (
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                  ✨ {t('buyerDashboard.newMatchesHeading')}
                </h3>
                {newMatches.map(result => {
                  const search = savedSearches.find(s => s.id === result.searchId);
                  if (!search) return null;
                  return (
                    <div
                      key={result.searchId}
                      className="bg-white dark:bg-brand-gray-800 rounded-lg p-4 mb-2"
                    >
                      <p className="font-semibold text-reride-text-dark dark:text-reride-text mb-1">
                        {search.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {result.matches.length === 1
                          ? t('buyerDashboard.oneNewMatch')
                          : t('buyerDashboard.nNewMatches', { count: result.matches.length })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="bg-white dark:bg-brand-gray-800 rounded-xl shadow-soft mb-8">

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Wishlist Section */}
                {wishlistVehicles.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-reride-text-dark dark:text-reride-text">
                        ❤️ {t('buyerDashboard.yourWishlist')}
                      </h3>
                      <button
                        onClick={() => onNavigate(View.WISHLIST)}
                        className="text-reride-orange hover:underline text-sm font-semibold"
                      >
                        {t('buyerDashboard.viewAllArrow')}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {wishlistVehicles.map(vehicle => (
                        <VehicleCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          onSelect={onSelectVehicle}
                          onToggleCompare={onToggleCompare}
                          isSelectedForCompare={comparisonList.includes(vehicle.id)}
                          onToggleWishlist={onToggleWishlist}
                          isInWishlist={wishlist.includes(vehicle.id)}
                          isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4}
                          onViewSellerProfile={onViewSellerProfile}
                          onQuickView={onSelectVehicle}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recently Viewed Section */}
                {recentlyViewed.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-reride-text-dark dark:text-reride-text mb-4">
                      👁️ {t('buyerDashboard.recentlyViewed')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {recentlyViewed.map(vehicle => (
                        <VehicleCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          onSelect={onSelectVehicle}
                          onToggleCompare={onToggleCompare}
                          isSelectedForCompare={comparisonList.includes(vehicle.id)}
                          onToggleWishlist={onToggleWishlist}
                          isInWishlist={wishlist.includes(vehicle.id)}
                          isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4}
                          onViewSellerProfile={onViewSellerProfile}
                          onQuickView={onSelectVehicle}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Saved Searches Tab */}
            {activeTab === 'searches' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-reride-text-dark dark:text-reride-text">
                    {t('buyerDashboard.yourSavedSearches')}
                  </h3>
                </div>

                {savedSearches.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      {t('buyerDashboard.noSavedSearches')}
                    </p>
                    <button
                      onClick={() => onNavigate(View.USED_CARS)}
                      className="btn-brand-primary text-white px-6 py-2 rounded-lg"
                    >
                      {t('buyerDashboard.browseVehicles')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedSearches.map(search => {
                      const matches = buyerService.matchVehiclesToSearch(vehicles, search);
                      return (
                        <div
                          key={search.id}
                          className="bg-gray-50 dark:bg-brand-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-reride-text-dark dark:text-reride-text">
                                {search.name}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {matches.length === 1
                                  ? t('buyerDashboard.oneMatchFound')
                                  : t('buyerDashboard.nMatchesFound', { count: matches.length })}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteSearch(search.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>

                          {/* Search Filters Display */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {search.filters.make && (
                              <span className="text-xs bg-white dark:bg-brand-gray-800 px-2 py-1 rounded">
                                {t('buyerDashboard.filter.make', { value: search.filters.make })}
                              </span>
                            )}
                            {search.filters.model && (
                              <span className="text-xs bg-white dark:bg-brand-gray-800 px-2 py-1 rounded">
                                {t('buyerDashboard.filter.model', { value: search.filters.model })}
                              </span>
                            )}
                            {(search.filters.minPrice || search.filters.maxPrice) && (
                              <span className="text-xs bg-white dark:bg-brand-gray-800 px-2 py-1 rounded">
                                {t('buyerDashboard.filter.price', {
                                  min: (search.filters.minPrice || 0).toLocaleString('en-IN'),
                                  max: (search.filters.maxPrice || 0).toLocaleString('en-IN'),
                                })}
                              </span>
                            )}
                            {search.filters.transmission && (
                              <span className="text-xs bg-white dark:bg-brand-gray-800 px-2 py-1 rounded">
                                {t('buyerDashboard.filter.transmission', { value: search.filters.transmission })}
                              </span>
                            )}
                            {search.filters.ownership && (
                              <span className="text-xs bg-white dark:bg-brand-gray-800 px-2 py-1 rounded">
                                {t('buyerDashboard.filter.ownership', {
                                  value:
                                    search.filters.ownership === '1'
                                      ? t('listings.mobileFilter.owner1')
                                      : search.filters.ownership === '2'
                                        ? t('listings.mobileFilter.owner2')
                                        : t('listings.mobileFilter.owner3plus'),
                                })}
                              </span>
                            )}
                          </div>

                          {/* Email Alerts Toggle */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={search.emailAlerts}
                              onChange={(e) => handleToggleAlerts(search.id, e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {t('buyerDashboard.emailAlerts')}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div>
                <h3 className="text-xl font-bold text-reride-text-dark dark:text-reride-text mb-6">
                  {t('buyerDashboard.recentActivity')}
                </h3>
                {recentlyViewed.length === 0 ? (
                  <p className="text-center py-12 text-gray-500 dark:text-gray-400">
                    {t('buyerDashboard.noRecentActivity')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {recentlyViewed.map(vehicle => (
                      <VehicleCard
                        key={vehicle.id}
                        vehicle={vehicle}
                        onSelect={onSelectVehicle}
                        onToggleCompare={onToggleCompare}
                        isSelectedForCompare={comparisonList.includes(vehicle.id)}
                        onToggleWishlist={onToggleWishlist}
                        isInWishlist={wishlist.includes(vehicle.id)}
                        isCompareDisabled={comparisonList.length >= 3 && !comparisonList.includes(vehicle.id)}
                        onViewSellerProfile={onViewSellerProfile}
                        onQuickView={onSelectVehicle}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div>
                <h3 className="text-xl font-bold text-reride-text-dark dark:text-reride-text mb-6">
                  {t('buyerDashboard.yourAlerts')}
                </h3>
                {priceDrops.length === 0 && newMatches.length === 0 ? (
                  <p className="text-center py-12 text-gray-500 dark:text-gray-400">
                    {t('buyerDashboard.noAlerts')}
                  </p>
                ) : (
                  <div className="space-y-6">
                    {priceDrops.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-reride-text-dark dark:text-reride-text mb-4">
                          🔽 {t('buyerDashboard.priceDropsSection')}
                        </h4>
                        <div className="space-y-3">
                          {priceDrops.map(drop => {
                            const vehicle = vehicles.find(v => v.id === drop.vehicleId);
                            if (!vehicle) return null;
                            return (
                              <button
                                key={drop.vehicleId}
                                type="button"
                                className="w-full text-left bg-white dark:bg-brand-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => onSelectVehicle(vehicle)}
                              >
                                <div className="flex items-center gap-4">
                                  <LazyImage
                                    src={getFirstValidImage(vehicle.images, vehicle.id)}
                                    alt={`${vehicle.make} ${vehicle.model}`}
                                    className="w-24 h-20 object-cover rounded-lg"
                                    width={200}
                                    quality={80}
                                  />
                                  <div className="flex-1">
                                    <p className="font-semibold text-reride-text-dark dark:text-reride-text">
                                      {vehicle.year} {vehicle.make} {vehicle.model}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      <span className="line-through">₹{drop.oldPrice.toLocaleString('en-IN')}</span>
                                      {' → '}
                                      <span className="text-reride-orange font-bold">
                                        ₹{drop.newPrice.toLocaleString('en-IN')}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {newMatches.length > 0 && (
                      <div className={priceDrops.length > 0 ? 'mt-6' : ''}>
                        <h4 className="font-semibold text-reride-text-dark dark:text-reride-text mb-4">
                          ✨ {t('buyerDashboard.newMatchesHeading')}
                        </h4>
                        <div className="space-y-3">
                          {newMatches.map(result => {
                            const search = savedSearches.find(s => s.id === result.searchId);
                            if (!search) return null;
                            return (
                              <div
                                key={result.searchId}
                                className="bg-white dark:bg-brand-gray-700 rounded-lg p-4"
                              >
                                <p className="font-semibold text-reride-text-dark dark:text-reride-text mb-1">
                                  {search.name}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {result.matches.length === 1
                                    ? t('buyerDashboard.oneNewMatch')
                                    : t('buyerDashboard.nNewMatches', { count: result.matches.length })}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'serviceTrack' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-reride-text-dark dark:text-reride-text">
                      {t('buyerDashboard.trackRequests.title')}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {t('buyerDashboard.trackRequests.subtitle')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(View.SERVICE_CART)}
                    className="btn-brand-primary text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
                  >
                    {t('buyerDashboard.trackRequests.bookService')}
                  </button>
                </div>
                <Suspense
                  fallback={
                    <div className="text-sm text-gray-600 dark:text-gray-400 py-8 text-center">
                      {t('buyerDashboard.trackRequests.loading')}
                    </div>
                  }
                >
                  <ServiceCart isLoggedIn embedTrackOnly customerUserId={currentUser?.id ?? null} />
                </Suspense>
              </div>
            )}
          </div>
        </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;


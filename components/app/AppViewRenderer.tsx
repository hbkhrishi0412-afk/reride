import * as React from 'react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum, Vehicle, User, Notification, Conversation, ChatMessage, SubscriptionPlan, type SearchFilters } from '../../types';
import { MARKETPLACE_VIEWS, CAR_SERVICE_VIEWS, DEAL_PIPELINE_VIEWS } from '../../features';
import { useApp } from '../AppProvider';
import useIsMobileApp from '../../hooks/useIsMobileApp';
import useIsLgUp from '../../hooks/useIsLgUp';
import { enrichVehiclesWithSellerInfo } from '../../utils/vehicleEnrichment';
import { filterVehiclesBySellerEmail } from '../../utils/sellerVehicleFilter';
import { findVehicleByIdentity } from '../../utils/vehicleIdentity';
import { matchesLocation } from '../../utils/cityMapping';
import { buildVehicleMutationBody } from '../../utils/vehicleIdentity';
import { addSellerListing, addSellerListingsBulk, assertSellerCanPublishListing } from '../../utils/sellerAddListing.js';
import { computeListingExpiresAtForSeller } from '../../utils/listingPlanRules.js';
import { authenticatedFetch } from '../../utils/authenticatedFetch';
import { planService } from '../../services/planService';
import { logInfo, logWarn, logError } from '../../utils/logger';
import { isPublicBuyListing } from '../../services/listingLifecycleService';
import { runBackgroundSync } from '../../utils/toastPolicy.js';
import { parseDeepLink } from '../../utils/mobileFeatures';
import { randomIntBelow } from '../../utils/secureRandom.js';
import { isCapacitorNativeApp } from '../../utils/isCapacitorNative';
import { currentUserForLocalSessionJson } from '../../utils/userLocalStorageSnapshot';
import {
  conversationBelongsToCustomer,
  conversationBelongsToSeller,
  normalizeInboxRole,
} from '../../utils/conversationParticipants';
import { updateProfilePassword } from '../../utils/profilePassword';
import {
  VehicleListErrorBoundary,
  DashboardErrorBoundary,
  AdminPanelErrorBoundary,
  AuthenticationErrorBoundary,
  HomeErrorBoundary,
  VehicleDetailErrorBoundary,
  ServiceCartErrorBoundary,
} from '../ErrorBoundaries';
import { DashboardSkeleton, MobileDashboardSkeleton, LoadingSpinner } from './AppViewSkeletons';
import SellerDashboardRoute from '../seller-dashboard/SellerDashboardRoute';
import type { AppApiResponse, AppServiceProvider, AppServiceRequestPayload } from '../../types/appServiceTypes';

export interface AppViewRendererLocals {
  serviceProvider: AppServiceProvider | null;
  setServiceProvider: React.Dispatch<React.SetStateAction<AppServiceProvider | null>>;
  serviceProviderOptions: Array<AppServiceProvider & { distanceKm?: number }>;
  inboxConversationIdToOpen: string | null;
  handleInboxInitialConversationConsumed: () => void;
  filtersFromUrl: Partial<SearchFilters> | undefined;
  applyFilters: (opts: {
    filters?: Record<string, string | number>;
    query?: string;
  }) => void;
  handleBrowseAllIndia: () => void;
  handleHomeUseMyLocation: (city: string, locationLabel: string) => void;
  openSellerProfileByEmail: (email: string) => void;
  requireLoginForDealerInteraction: () => void;
  handleServiceRequestSubmit: (payload: AppServiceRequestPayload) => Promise<void>;
  handleUseMyLocation: () => Promise<void>;
  handleStartVehicleChat: (vehicle: Vehicle) => Promise<void>;
  handleRequestTestDrive: (
    vehicle: Vehicle,
    details: { date: string; time: string },
  ) => void | Promise<void>;
  handleTestDriveResponse: (
    conversationId: string,
    messageId: number,
    newStatus: 'confirmed' | 'rejected',
  ) => void | Promise<void>;
  handleSellerOpenChatFromDashboard: (conversation: Conversation) => void;
  setForgotPasswordRole: (role: 'customer' | 'seller' | null) => void;
  handleLogin: (user: User) => void;
  handleRegister: (user: User) => void;
  handleLogoutAll: () => void;
  handleNotificationClick: (notification: Notification) => void;
  handleAcceptDealChat: (leadId: string, conversationId?: string) => void | Promise<void>;
  handleMarkNotificationsAsRead: (ids: number[]) => void | Promise<void>;
  handleMarkAllNotificationsAsRead: () => void | Promise<void>;
  markAllVisibleAsRead: (role: 'customer' | 'seller') => void | Promise<void>;
  isLocating: boolean;
  locationError: string | null;
}

function userHasAdminRole(user: User | null | undefined): boolean {
  return (user?.role || '').toLowerCase().trim() === 'admin';
}

const MinimalLoader: React.FC = () => null;

const Home = React.lazy(() => import('../Home'));
const VehicleList = React.lazy(() => import('../VehicleList'));
const VehicleDetail = React.lazy(() => import('../VehicleDetail'));
// Enhanced lazy loading with error handling for production
const AdminPanel = React.lazy(() => import('../AdminPanel'));
const Comparison = React.lazy(() => import('../Comparison'));
const Profile = React.lazy(() => import('../Profile'));
const SellerProfilePage = React.lazy(() => import('../SellerProfilePage'));
const DealerProfiles = React.lazy(() => import('../DealerProfiles'));
const CarServices = React.lazy(() => import('../CarServices'));
const ServiceDetail = React.lazy(() => import('../ServiceDetail'));
const CarServiceLogin = React.lazy(() => import('../CarServiceLogin'));
const CarServiceDashboard = React.lazy(() => import('../CarServiceDashboard'));
const MobileCarServiceDashboard = React.lazy(() => import('../MobileCarServiceDashboard'));
const PricingPage = React.lazy(() => import('../PricingPage'));
const SupportPage = React.lazy(() => import('../SupportPage'));
const AboutUsPage = React.lazy(() => import('../AboutUsPage'));
const FAQPage = React.lazy(() => import('../FAQPage'));
const BuyerDashboard = React.lazy(() => import('../BuyerDashboard'));
const CityLandingPage = React.lazy(() => import('../CityLandingPage'));
const UnifiedLogin = React.lazy(() => import('../UnifiedLogin'));
const ForgotPassword = React.lazy(() => import('../ForgotPassword'));
const SellCarPage = React.lazy(() => import('../SellCarPage'));
const SellCarAdmin = React.lazy(() => import('../SellCarAdmin'));
const AdminLogin = React.lazy(() => import('../../AdminLogin'));
// Lazy-loaded Mobile view components (only loaded when needed - reduces initial bundle size)
const MobileVehicleDetail = React.lazy(() => import('../MobileVehicleDetail'));
const MobileInbox = React.lazy(() => import('../MobileInbox'));
const CustomerInbox = React.lazy(() => import('../CustomerInbox'));
const NotificationsPage = React.lazy(() => import('../NotificationsPage'));
const MobileNotifications = React.lazy(() =>
  import('../MobileNotifications').then((m) => ({ default: m.MobileNotifications }))
);
const MobileProfile = React.lazy(() => import('../MobileProfile'));
const MobileWishlist = React.lazy(() => import('../MobileWishlist'));
const MobileComparison = React.lazy(() => import('../MobileComparison'));
const MobileSellerProfilePage = React.lazy(() => import('../MobileSellerProfilePage'));
const MobileSellCarPage = React.lazy(() => import('../MobileSellCarPage'));
const MobilePricingPage = React.lazy(() => import('../MobilePricingPage'));
const MobileSupportPage = React.lazy(() => import('../MobileSupportPage'));
const MobileFAQPage = React.lazy(() => import('../MobileFAQPage'));
const PrivacyPolicyPage = React.lazy(() => import('../PrivacyPolicyPage'));
const MobilePrivacyPolicyPage = React.lazy(() => import('../MobilePrivacyPolicyPage'));
const SafetyCenterPage = React.lazy(() => import('../SafetyCenterPage'));
const TermsOfServicePage = React.lazy(() => import('../TermsOfServicePage'));
const MobileTermsOfServicePage = React.lazy(() => import('../MobileTermsOfServicePage'));
const RefundPolicyPage = React.lazy(() => import('../RefundPolicyPage'));
const ComplaintResolutionPage = React.lazy(() => import('../ComplaintResolutionPage'));
const FraudPolicyPage = React.lazy(() => import('../FraudPolicyPage'));
const CookiePolicyPage = React.lazy(() => import('../CookiePolicyPage'));
const HelpCenterPage = React.lazy(() => import('../HelpCenterPage'));
const NotFoundPage = React.lazy(() => import('../NotFoundPage'));
const MobileBuyerDashboard = React.lazy(() => import('../MobileBuyerDashboard'));
const MobileDealerProfilesPage = React.lazy(() => import('../MobileDealerProfilesPage'));
const MobileHomePage = React.lazy(() => import('../MobileHomePage'));
const ServiceCart = React.lazy(() => import('../ServiceCart'));

// Lazy-loaded non-critical components (loaded on demand)
const CommandPalette = React.lazy(() => import('../CommandPalette'));
const KeyboardShortcutsHelp = React.lazy(() => import('../KeyboardShortcutsHelp'));
const ChatWidget = React.lazy(() => import('../ChatWidget').then(module => ({ default: module.ChatWidget })));

export const AppViewRenderer: React.FC<AppViewRendererLocals> = (locals) => {
  const { isMobileApp } = useIsMobileApp();
  const isLgUp = useIsLgUp();
  const preferCompactDashboard = isMobileApp || !isLgUp;
  const { t } = useTranslation();
  const {
    currentView,
    navigate,
    goBack,
    previousView,
    vehicles,
    users,
    currentUser,
    sellerInventory,
    sellerInventoryReady,
    comparisonList,
    comparisonCategory,
    wishlist,
    conversations,
    recommendations,
    initialSearchQuery,
    selectedCategory: currentCategory,
    selectedCity,
    publicSellerProfile,
    selectedVehicle,
    isLoading,
    vehiclesCatalogReady,
    vehicleData,
    faqItems,
    platformSettings,
    auditLog,
    supportTickets,
    notifications,
    typingStatus,
    userLocation,
    addToast,
    setInitialSearchQuery,
    setSelectedCategory,
    setSelectedCity,
    selectVehicle,
    setSelectedVehicle,
    setComparisonList,
    setWishlist,
    setPublicSellerProfile: setPublicProfile,
    setVehicles,
    setSellerInventory,
    setUsers,
    setCurrentUser,
    setSupportTickets,
    markAsRead,
    toggleTyping,
    flagContent,
    updateUser,
    deleteUser,
    updateVehicle,
    syncVehicleFromServer,
    deleteVehicle,
    toggleWishlist,
    toggleCompare,
    onAdminUpdateUser,
    onUpdateUserPlan,
    onToggleUserStatus,
    onToggleVehicleStatus,
    onToggleVehicleFeature,
    onResolveFlag,
    onUpdateSettings,
    onSendBroadcast,
    onExportUsers,
    onExportVehicles,
    onExportSales,
    onUpdateVehicleData,
    onToggleVerifiedStatus,
    onUpdateSupportTicket,
    onAddFaq,
    onUpdateFaq,
    onDeleteFaq,
    onCertificationApproval,
    onOfferResponse,
    addSellerRating,
    sendMessage,
    setActiveChat,
    setConversations,
    setUserLocation,
    refreshVehicles,
    chatPeerOnlineByConversationId,
    sendMessageWithType,
    setConversationReadState,
    clearConversationMessages,
    deleteConversation,
    archiveConversation,
    onCreateUser,
    onImportUsers,
    onImportVehicles,
  } = useApp();

  const {
    serviceProvider,
    setServiceProvider,
    serviceProviderOptions,
    inboxConversationIdToOpen,
    handleInboxInitialConversationConsumed,
    filtersFromUrl,
    applyFilters,
    handleBrowseAllIndia,
    handleHomeUseMyLocation,
    openSellerProfileByEmail,
    requireLoginForDealerInteraction,
    handleServiceRequestSubmit,
    handleUseMyLocation,
    handleStartVehicleChat,
    handleRequestTestDrive,
    handleTestDriveResponse,
    handleSellerOpenChatFromDashboard,
    setForgotPasswordRole,
    handleLogin,
    handleRegister,
    handleLogoutAll,
    handleNotificationClick,
    handleAcceptDealChat,
    handleMarkNotificationsAsRead,
    handleMarkAllNotificationsAsRead,
    markAllVisibleAsRead,
    isLocating,
    locationError,
  } = locals;

  React.useEffect(() => {
    if (currentView !== ViewEnum.DETAIL || selectedVehicle) return;
    try {
      const storedVehicle = sessionStorage.getItem('selectedVehicle');
      if (storedVehicle) {
        const parsed = JSON.parse(storedVehicle) as Vehicle;
        if (parsed?.id) setSelectedVehicle(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [currentView, selectedVehicle, setSelectedVehicle]);

  const productScope =
    (MARKETPLACE_VIEWS as readonly string[]).includes(currentView)
      ? 'marketplace'
      : (CAR_SERVICE_VIEWS as readonly string[]).includes(currentView)
        ? 'car-services'
        : (DEAL_PIPELINE_VIEWS as readonly string[]).includes(currentView)
          ? 'deals'
          : 'platform';
  void productScope;

switch (currentView) {
  case ViewEnum.HOME:
    if (isMobileApp) {
      // Return just the component - MobileLayout wrapper is handled by outer wrapper
      return (
        <HomeErrorBoundary>
        <MobileHomePage
          onSearch={(query) => {
            setInitialSearchQuery(query);
            navigate(ViewEnum.USED_CARS);
          }}
          onApplyFilters={applyFilters}
          onSelectCategory={(category) => {
            setSelectedCategory(category);
            navigate(ViewEnum.USED_CARS);
          }}
          featuredVehicles={enrichVehiclesWithSellerInfo(
            vehicles.filter(v => v.isFeatured && v.status === 'published'),
            users
          )}
          onSelectVehicle={selectVehicle}
          onToggleCompare={toggleCompare}
          comparisonList={comparisonList}
          onToggleWishlist={(id) => {
            setWishlist(prev => 
              prev.includes(id) 
                ? prev.filter(vId => vId !== id)
                : [...prev, id]
            );
          }}
          wishlist={wishlist}
          onViewSellerProfile={openSellerProfileByEmail}
          recommendations={recommendations}
          allVehicles={vehicles.filter(v => v.status === 'published')}
          onNavigate={navigate}
          onSelectCity={(city) => {
            // Pass city in navigate params â€” navigate(USED_CARS) without params clears the filter in AppProvider.
            navigate(ViewEnum.USED_CARS, { city });
          }}
          userLocation={userLocation}
          onLocationChange={setUserLocation}
          addToast={addToast}
          selectedCity={selectedCity}
          onBrowseAllIndia={handleBrowseAllIndia}
          onUseMyLocation={handleHomeUseMyLocation}
          isCatalogLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
          onRetryCatalogLoad={() => void refreshVehicles({ userInitiated: true })}
          currentUser={currentUser}
        />
        </HomeErrorBoundary>
      );
    }
    return (
      <HomeErrorBoundary>
      <Home 
        onSearch={(query) => {
          setInitialSearchQuery(query);
          navigate(ViewEnum.USED_CARS);
        }}
        onApplyFilters={applyFilters}
        onSelectCategory={(category) => {
          setSelectedCategory(category);
          navigate(ViewEnum.USED_CARS);
        }}
        featuredVehicles={enrichVehiclesWithSellerInfo(
          vehicles.filter(v => v.isFeatured && v.status === 'published'),
          users
        )}
        onSelectVehicle={selectVehicle}
        onToggleCompare={toggleCompare}
        comparisonList={comparisonList}
        onToggleWishlist={(id) => {
          setWishlist(prev => 
            prev.includes(id) 
              ? prev.filter(vId => vId !== id)
              : [...prev, id]
          );
        }}
        wishlist={wishlist}
        onViewSellerProfile={openSellerProfileByEmail}
        recommendations={recommendations}
        allVehicles={vehicles.filter(v => v.status === 'published')}
        onNavigate={navigate}
        onSelectCity={(city) => {
          // Pass city in navigate params â€” navigate(USED_CARS) without params clears the filter in AppProvider.
          navigate(ViewEnum.USED_CARS, { city });
        }}
        selectedCity={selectedCity}
        onBrowseAllIndia={handleBrowseAllIndia}
        onUseMyLocation={handleHomeUseMyLocation}
        userLocation={userLocation}
        onOpenLocationPicker={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('reride:open-location-modal'));
          }
        }}
        addToast={addToast}
        isCatalogLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
        onRetryCatalogLoad={() => void refreshVehicles({ userInitiated: true })}
        currentUser={currentUser}
      />
      </HomeErrorBoundary>
    );

  case ViewEnum.USED_CARS: {
    // Filter vehicles for buy/sale (exclude rental vehicles)
    // Filter by status, listingType, and city if explicitly selected (not auto-detected)
    // Only use selectedCity, not userLocation, so users can see all vehicles by default
    const cityFilter = selectedCity || '';
    const filteredVehicles = vehicles.filter(v => {
      if (!v) return false;
      const isBuyable = isPublicBuyListing(v);
      // Exclude rental vehicles from buy/sale listings
      const isNotRental = v.listingType !== 'rental' || v.listingType === undefined;
      // Apply city filter only if a city is explicitly selected (using city mapping for accurate matching)
      const matchesCityFilter = matchesLocation(v.city, v.state, cityFilter);
      
      return isBuyable && isNotRental && matchesCityFilter;
    });
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      logInfo('USED_CARS filter results:', {
        totalVehicles: vehicles.length,
        publishedVehicles: vehicles.filter(v => isPublicBuyListing(v)).length,
        rentalVehicles: vehicles.filter(v => v.listingType === 'rental').length,
        selectedCity: selectedCity || 'none',
        filteredVehicles: filteredVehicles.length,
        sampleVehicleCities: vehicles.slice(0, 5).map(v => v.city).filter(Boolean)
      });
    }
    
    return (
      <VehicleListErrorBoundary>
        <VehicleList
          vehicles={enrichVehiclesWithSellerInfo(filteredVehicles, users)}
          onSelectVehicle={selectVehicle}
          isLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
          comparisonList={comparisonList}
          comparisonCategory={comparisonCategory}
          onToggleCompare={toggleCompare}
          onClearCompare={() => setComparisonList([])}
          onOpenCompare={() => navigate(ViewEnum.COMPARISON)}
          wishlist={wishlist}
          onToggleWishlist={(id) => {
            setWishlist(prev => 
              prev.includes(id) 
                ? prev.filter(vId => vId !== id)
                : [...prev, id]
            );
          }}
          categoryTitle={selectedCity ? `Used Cars in ${selectedCity}` : "Used Cars"}
          initialCategory={currentCategory}
          initialSearchQuery={initialSearchQuery}
          initialFilters={filtersFromUrl}
          onViewSellerProfile={openSellerProfileByEmail}
          userLocation={userLocation}
          currentUser={currentUser}
          onSaveSearch={(search) => {
            addToast(`Search "${search.name}" saved successfully!`, 'success');
          }}
          selectedCity={selectedCity}
          onCityChange={(city) => {
            setSelectedCity(city);
          }}
          sourceVehicleCount={vehicles.length}
          onRetryLoadVehicles={() => void refreshVehicles({ userInitiated: true })}
        />
      </VehicleListErrorBoundary>
    );
  }

  case ViewEnum.DETAIL: {
    // Enhanced recovery: Check both state and sessionStorage
    if (process.env.NODE_ENV === 'development') {
      logInfo('ðŸŽ¯ App.tsx: Rendering DETAIL view');
      logInfo('ðŸŽ¯ Current selectedVehicle from state:', selectedVehicle?.id, selectedVehicle?.make, selectedVehicle?.model);
    }
    
    let vehicleToDisplay = selectedVehicle;
    if (!vehicleToDisplay) {
      try {
        const storedVehicle = sessionStorage.getItem('selectedVehicle');
        if (storedVehicle) {
          vehicleToDisplay = JSON.parse(storedVehicle);
          if (process.env.NODE_ENV === 'development') {
            logInfo('ðŸ”§ App.tsx: Recovered vehicle from sessionStorage for rendering:', vehicleToDisplay?.id, vehicleToDisplay?.make, vehicleToDisplay?.model);
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            logWarn('âš ï¸ App.tsx: No vehicle in sessionStorage');
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          logError('âŒ App.tsx: Failed to recover vehicle from sessionStorage:', error);
        }
      }
    }
    
    if (!vehicleToDisplay) {
      const pendingDetailId = (() => {
        try {
          const params = parseDeepLink();
          if (params.view === ViewEnum.DETAIL && params.id != null) {
            const id = typeof params.id === 'string' ? parseInt(params.id, 10) : Number(params.id);
            return Number.isFinite(id) ? id : null;
          }
        } catch {
          /* ignore */
        }
        return null;
      })();
      const catalogStillLoading = vehicles.length === 0 && (isLoading || pendingDetailId != null);
      if (catalogStillLoading) {
        return (
          <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-reride-orange mx-auto mb-4" />
              <p className="text-gray-600">Loading vehicle details…</p>
            </div>
          </div>
        );
      }
      if (process.env.NODE_ENV === 'development') {
        logError('âŒ App.tsx: No vehicle to display - showing error message');
      }
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-600 mb-4">Vehicle Not Found</h2>
            <p className="text-gray-500 mb-4">Please select a vehicle to view details.</p>
            <button 
              onClick={() => navigate(ViewEnum.USED_CARS)}
              className="btn-brand-primary"
            >
              Browse Vehicles
            </button>
          </div>
        </div>
      );
    }
    
    if (process.env.NODE_ENV === 'development') {
      logInfo('âœ… App.tsx: Vehicle found, rendering VehicleDetail component:', vehicleToDisplay.id, vehicleToDisplay.make, vehicleToDisplay.model);
    }
    
    // Use MobileVehicleDetail for mobile app, VehicleDetail for desktop
    if (isMobileApp) {
      return (
        <VehicleDetailErrorBoundary>
        <MobileVehicleDetail
          vehicle={vehicleToDisplay}
          onBack={() => goBack(ViewEnum.USED_CARS)}
          comparisonList={comparisonList}
          onToggleCompare={toggleCompare}
          onAddSellerRating={addSellerRating}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          currentUser={currentUser}
          onFlagContent={(type, id, _reason) => flagContent(type, id)}
          users={users}
          onViewSellerProfile={openSellerProfileByEmail}
          onRequestLogin={() => {
            try {
              sessionStorage.setItem('reride.postLoginView', ViewEnum.DETAIL);
            } catch {
              /* ignore */
            }
            addToast('Please login to verify this vehicle', 'info');
            navigate(ViewEnum.CUSTOMER_LOGIN);
          }}
          onStartChat={handleStartVehicleChat}
          onRequestTestDrive={handleRequestTestDrive}
          recommendations={recommendations}
          onSelectVehicle={selectVehicle}
          updateVehicle={updateVehicle}
        />
        </VehicleDetailErrorBoundary>
      );
    }
    
    return (
      <VehicleDetailErrorBoundary>
      <VehicleDetail
        vehicle={vehicleToDisplay}
        onBack={() => goBack(ViewEnum.USED_CARS)}
        comparisonList={comparisonList}
        onToggleCompare={toggleCompare}
        onAddSellerRating={addSellerRating}
        wishlist={wishlist}
        onToggleWishlist={toggleWishlist}
        currentUser={currentUser}
        onFlagContent={(type, id, _reason) => flagContent(type, id)}
        users={users}
        updateVehicle={updateVehicle}
        onViewSellerProfile={openSellerProfileByEmail}
        onStartChat={handleStartVehicleChat}
        onRequestTestDrive={handleRequestTestDrive}
        recommendations={recommendations}
        onSelectVehicle={selectVehicle}
      />
      </VehicleDetailErrorBoundary>
    );
  }

  case ViewEnum.RENTAL: {
    // Rental vehicles feature not currently used - redirect to used cars page
    const RentalRedirect: React.FC = () => {
      React.useEffect(() => {
        navigate(ViewEnum.USED_CARS);
      }, []);
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Redirecting to used cars...</p>
          </div>
        </div>
      );
    };
    return <RentalRedirect />;
  }

  case ViewEnum.COMPARISON:
    if (isMobileApp) {
      return (
        <MobileComparison
          vehicles={vehicles}
          comparisonList={comparisonList}
          comparisonCategory={comparisonCategory}
          onRemoveFromCompare={(id) => {
            setComparisonList(prev => prev.filter(vId => vId !== id));
          }}
          onSelectVehicle={selectVehicle}
          onBack={() => goBack(ViewEnum.USED_CARS)}
          onClearCompare={() => setComparisonList([])}
        />
      );
    }
    return (
      <Comparison 
        vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => comparisonList.includes(v.id)), users)}
        comparisonCategory={comparisonCategory}
        onBack={() => goBack(ViewEnum.USED_CARS)}
        onToggleCompare={toggleCompare}
        onClearCompare={() => setComparisonList([])}
      />
    );

  case ViewEnum.WISHLIST:
    if (isMobileApp) {
      return (
        <MobileWishlist
          vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => wishlist.includes(v.id)), users)}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onSelectVehicle={selectVehicle}
          onToggleCompare={toggleCompare}
          comparisonList={comparisonList}
          currentUser={currentUser}
          onViewSellerProfile={openSellerProfileByEmail}
          onNavigate={navigate}
          isCatalogLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
        />
      );
    }
    return (
      <VehicleList
        vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => wishlist.includes(v.id)), users)}
        onSelectVehicle={selectVehicle}
        isLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
        comparisonList={comparisonList}
        comparisonCategory={comparisonCategory}
        onToggleCompare={toggleCompare}
        onClearCompare={() => setComparisonList([])}
        onOpenCompare={() => navigate(ViewEnum.COMPARISON)}
        wishlist={wishlist}
        onToggleWishlist={(id) => {
          setWishlist(prev => 
            prev.includes(id) 
              ? prev.filter(vId => vId !== id)
              : [...prev, id]
          );
        }}
        categoryTitle="My Wishlist"
        isWishlistMode={true}
        onViewSellerProfile={openSellerProfileByEmail}
        userLocation={userLocation}
        currentUser={currentUser}
        onSaveSearch={(search) => {
          addToast(`Search "${search.name}" saved successfully!`, 'success');
        }}
        onBrowseAll={() => navigate(ViewEnum.USED_CARS)}
      />
    );

  case ViewEnum.SELLER_DASHBOARD:
      return (
      <SellerDashboardRoute
        locals={{
          handleLogoutAll,
          handleNotificationClick,
          handleMarkNotificationsAsRead,
          handleTestDriveResponse,
          handleSellerOpenChatFromDashboard,
          markAllVisibleAsRead,
        }}
      />
    );

  case ViewEnum.BUYER_DASHBOARD:
    if (preferCompactDashboard && currentUser?.role === 'customer') {
      return (
        <MobileBuyerDashboard
          currentUser={currentUser}
          vehicles={vehicles.filter(v => v.status === 'published')}
          wishlist={wishlist}
          conversations={conversations.filter(c => {
            if (!c || !c.customerId || !currentUser?.email) return false;
            return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
          })}
          onNavigate={navigate}
          onSelectVehicle={selectVehicle}
          onToggleWishlist={(id) => {
            setWishlist(prev => 
              prev.includes(id) 
                ? prev.filter(vId => vId !== id)
                : [...prev, id]
            );
          }}
          onToggleCompare={toggleCompare}
          comparisonList={comparisonList}
          onViewSellerProfile={openSellerProfileByEmail}
          onLogout={handleLogoutAll}
        />
      );
    }
    const buyerPublishedVehicles = (vehicles || []).filter((v) => v && v.status === 'published');

    return currentUser?.role === 'customer' ? (
      <BuyerDashboard
        currentUser={currentUser}
        vehicles={buyerPublishedVehicles}
        wishlist={wishlist}
        conversations={(conversations || []).filter(c => {
          if (!c || !c.customerId || !currentUser?.email) return false;
          return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
        })}
        onNavigate={navigate}
        onSelectVehicle={selectVehicle}
        onToggleWishlist={(id) => {
          setWishlist(prev => 
            prev.includes(id) 
              ? prev.filter(vId => vId !== id)
              : [...prev, id]
          );
        }}
        onToggleCompare={toggleCompare}
        comparisonList={comparisonList}
        onViewSellerProfile={openSellerProfileByEmail}
      />
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Denied</h2>
          <p className="text-gray-500 mb-4">You need to be logged in as a customer to access this page.</p>
          <button 
            onClick={() => navigate(ViewEnum.CUSTOMER_LOGIN)}
            className="btn-brand-primary"
          >
            Login as Customer
          </button>
        </div>
      </div>
    );

  case ViewEnum.ADMIN_PANEL:
    if (isCapacitorNativeApp()) {
      return (
        <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-6 pb-24">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Admin panel needs a desktop browser</h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              The admin command center is not available in the mobile app. Sign in at your ReRide website admin URL on a computer.
            </p>
            <button
              type="button"
              onClick={() => navigate(ViewEnum.HOME)}
              className="btn-brand-primary w-full"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
    return userHasAdminRole(currentUser) && currentUser ? (
      <AdminPanelErrorBoundary>
        <AdminPanel 
          users={users}
          currentUser={currentUser}
          vehicles={vehicles}
          conversations={conversations}
          isLoading={isLoading}
          onCreateUser={onCreateUser}
          onAdminUpdateUser={onAdminUpdateUser}
          onToggleUserStatus={onToggleUserStatus}
          onDeleteUser={deleteUser}
          onUpdateUserPlan={onUpdateUserPlan}
          onUpdateVehicle={(vehicle: Vehicle) => {
            updateVehicle(vehicle.id, vehicle);
          }}
          onDeleteVehicle={deleteVehicle}
          onToggleVehicleStatus={onToggleVehicleStatus}
          onToggleVehicleFeature={onToggleVehicleFeature}
          onResolveFlag={onResolveFlag}
          platformSettings={platformSettings}
          onUpdateSettings={onUpdateSettings}
          onSendBroadcast={onSendBroadcast}
          auditLog={auditLog}
          onExportUsers={onExportUsers}
          onImportUsers={onImportUsers}
          onExportVehicles={onExportVehicles}
          onImportVehicles={onImportVehicles}
          onExportSales={onExportSales}
          onNavigate={navigate}
          onLogout={handleLogoutAll}
          vehicleData={vehicleData}
          onUpdateVehicleData={onUpdateVehicleData}
          onToggleVerifiedStatus={onToggleVerifiedStatus}
          supportTickets={supportTickets}
          onUpdateSupportTicket={onUpdateSupportTicket}
          faqItems={faqItems}
          onAddFaq={onAddFaq}
          onUpdateFaq={onUpdateFaq}
          onDeleteFaq={onDeleteFaq}
          onCertificationApproval={onCertificationApproval}
        />
      </AdminPanelErrorBoundary>
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Denied</h2>
          <p className="text-gray-500 mb-4">You need to be logged in as an admin to access this page.</p>
          <button 
            onClick={() => navigate(ViewEnum.ADMIN_LOGIN)}
            className="btn-brand-primary"
          >
            Login as Admin
          </button>
        </div>
      </div>
    );

  case ViewEnum.PROFILE:
    if (isMobileApp && currentUser) {
      return (
        <MobileProfile
          currentUser={currentUser}
          onUpdateProfile={async (details) => {
            if (currentUser) {
              await updateUser(currentUser.email, details);
            }
          }}
          onUpdatePassword={async (passwords) => {
            if (!currentUser) return false;
            const { login } = await import('../../services/userService');
            return updateProfilePassword(currentUser, passwords, {
              login,
              updateUser,
              addToast,
              logError,
            });
          }}
          onBack={() => goBack(ViewEnum.HOME)}
          onLogout={handleLogoutAll}
          addToast={addToast}
          onNavigate={navigate}
        />
      );
    }
    return currentUser ? (
      <Profile 
        currentUser={currentUser}
        onUpdateProfile={async (details) => {
          if (currentUser) {
            await updateUser(currentUser.email, details);
          }
        }}
        onUpdatePassword={async (passwords) => {
          if (!currentUser) return false;
          const { login } = await import('../../services/userService');
          return updateProfilePassword(currentUser, passwords, {
            login,
            updateUser,
            addToast,
            logError,
          });
        }}
      />
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Please Login</h2>
          <p className="text-gray-500 mb-4">You need to be logged in to view your profile.</p>
          <button 
            onClick={() => navigate(ViewEnum.LOGIN_PORTAL)}
            className="btn-brand-primary"
          >
            Login
          </button>
        </div>
      </div>
    );

  case ViewEnum.INBOX:
    if (!currentUser) {
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-600 mb-4">Please Login</h2>
            <p className="text-gray-500 mb-4">You need to be logged in to view your inbox.</p>
            <button
              onClick={() => navigate(ViewEnum.LOGIN_PORTAL)}
              className="btn-brand-primary"
            >
              Login
            </button>
          </div>
        </div>
      );
    }
    {
      const inboxEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
      const inboxRoleNorm = normalizeInboxRole(currentUser.role);
      const inboxThreads = conversations.filter((c) => {
        if (!c || !inboxEmail) return false;
        if (inboxRoleNorm === 'seller') {
          return conversationBelongsToSeller(c, inboxEmail, currentUser.id);
        }
        if (inboxRoleNorm === 'customer') {
          return conversationBelongsToCustomer(c, inboxEmail, currentUser.id);
        }
        return false;
      });
      const inboxViewerRole = inboxRoleNorm === 'seller' ? 'seller' : 'customer';
      const inboxSharedProps = {
        conversations: inboxThreads,
        initialOpenConversationId: inboxConversationIdToOpen,
        onConsumedInitialConversation: handleInboxInitialConversationConsumed,
        chatPeerOnlineByConversationId,
        vehicles,
        onSendMessage: (conversationId: string, messageText: string, type?: ChatMessage['type'], payload?: ChatMessage['payload']) => {
          const conv = conversations.find((c) => c && c.id === conversationId);
          if (conv) {
            sendMessageWithType(conv.id, messageText, type, payload);
          }
        },
        onMarkAsRead: markAsRead,
        users,
        typingStatus,
        onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => {
          void markAsRead(conversationId, { readerRole });
        },
        onSetConversationReadState: (conversationId: string, isRead: boolean) =>
          setConversationReadState(conversationId, inboxViewerRole, isRead),
        onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, _reason: string) =>
          flagContent(type, id),
        onOfferResponse: (
          conversationId: string,
          messageId: number,
          response: 'accepted' | 'rejected' | 'countered',
          counterPrice?: number,
        ) => {
          onOfferResponse(conversationId, messageId, response, counterPrice);
        },
        onClearChat: clearConversationMessages,
        onDeleteConversation: deleteConversation,
        onArchiveConversation: archiveConversation,
      };

      if (!isMobileApp && isLgUp) {
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <CustomerInbox
              {...inboxSharedProps}
              onUserTyping={(conversationId, _userRole) => toggleTyping(conversationId, true)}
              onUserStoppedTyping={(conversationId) => toggleTyping(conversationId, false)}
              onMarkAllAsRead={() => void markAllVisibleAsRead(inboxViewerRole)}
              currentUserEmail={currentUser.email}
            />
          </div>
        );
      }

      return (
        <MobileInbox
          {...inboxSharedProps}
          inboxRole={inboxViewerRole}
          onTypingActivity={(conversationId, isTyping) => toggleTyping(conversationId, isTyping)}
          onMarkAllAsRead={markAllVisibleAsRead}
          onTestDriveResponse={handleTestDriveResponse}
          currentUser={currentUser}
          onNavigate={navigate}
        />
      );
    }

  case ViewEnum.SELLER_PROFILE:
    if (isMobileApp && publicSellerProfile) {
      const normalizedSellerEmail = publicSellerProfile.email?.toLowerCase().trim() || '';
      const latestSeller = users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) || publicSellerProfile;
      return (
        <MobileSellerProfilePage
          seller={latestSeller}
          vehicles={enrichVehiclesWithSellerInfo(
            (vehicles || []).filter(v => {
              if (!v || !v.sellerEmail || !latestSeller?.email) return false;
              return v.sellerEmail.toLowerCase().trim() === latestSeller.email.toLowerCase().trim();
            }),
            users || []
          )}
          onSelectVehicle={selectVehicle}
          comparisonList={comparisonList}
          onToggleCompare={toggleCompare}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          currentUser={currentUser}
          onRequireLogin={requireLoginForDealerInteraction}
          onBack={() => goBack(ViewEnum.HOME)}
          onViewSellerProfile={openSellerProfileByEmail}
        />
      );
    }
    return publicSellerProfile ? (() => {
      // Always get the latest seller data from users array to ensure verification status is up-to-date
      const normalizedSellerEmail = publicSellerProfile.email?.toLowerCase().trim() || '';
      const latestSeller = users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) || publicSellerProfile;
      
      return (
        <SellerProfilePage 
          seller={latestSeller}
          vehicles={enrichVehiclesWithSellerInfo(
            (vehicles || []).filter(v => {
              if (!v || !v.sellerEmail || !latestSeller?.email) return false;
              return v.sellerEmail.toLowerCase().trim() === latestSeller.email.toLowerCase().trim();
            }), 
            users || []
          )}
        onSelectVehicle={selectVehicle}
        comparisonList={comparisonList}
        onToggleCompare={toggleCompare}
        wishlist={wishlist}
        onToggleWishlist={toggleWishlist}
        currentUser={currentUser}
        onRequireLogin={requireLoginForDealerInteraction}
        onBack={() => goBack(ViewEnum.HOME)}
        onViewSellerProfile={openSellerProfileByEmail}
      />
      );
    })() : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Seller Not Found</h2>
          <button 
            onClick={() => navigate(ViewEnum.USED_CARS)}
            className="btn-brand-primary"
          >
            Browse Vehicles
          </button>
        </div>
      </div>
    );

  case ViewEnum.DEALER_PROFILES: {
    // Pass sellers AND service providers if available; components will fetch directly from API if not provided.
    // Car-service providers and dealer/showroom sellers both appear on the Dealer page, differentiated by role.
    const sellersFromUsers = users.filter(user => user.role === 'seller' || user.role === 'service_provider');
    if (preferCompactDashboard) {
      return (
        <MobileDealerProfilesPage
          sellers={sellersFromUsers.length > 0 ? sellersFromUsers : undefined}
          vehicles={vehicles}
          userLocation={userLocation}
          currentUser={currentUser}
          onRequireLogin={requireLoginForDealerInteraction}
          onViewProfile={openSellerProfileByEmail}
        />
      );
    }
    return (
      <DealerProfiles 
        sellers={sellersFromUsers.length > 0 ? sellersFromUsers : undefined} 
        vehicles={vehicles}
        userLocation={userLocation}
        currentUser={currentUser}
        onRequireLogin={requireLoginForDealerInteraction}
        onViewProfile={openSellerProfileByEmail}
      />
    );
  }

  case ViewEnum.CAR_SERVICE_LOGIN:
    return (
      <CarServiceLogin
        onNavigate={navigate}
        onLoginSuccess={(provider) => setServiceProvider(provider)}
      />
    );

  case ViewEnum.CAR_SERVICE_DASHBOARD:
    if (!serviceProvider) {
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-reride-orange mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Loading provider dashboardâ€¦</p>
          </div>
        </div>
      );
    }
    if (isMobileApp) {
      return (
        <MobileCarServiceDashboard
          provider={serviceProvider as {
            name: string;
            email: string;
            phone: string;
            city: string;
            state?: string;
            district?: string;
            workshops?: string[];
            skills?: string[];
            availability?: string;
            serviceCategories?: import('../../constants/serviceProviderCatalog').ServiceCategory[];
          } | null}
          onNavigate={navigate}
          onLogout={() => {
            handleLogoutAll();
            navigate(ViewEnum.HOME);
          }}
        />
      );
    }
    return (
      <CarServiceDashboard
        provider={serviceProvider as { name: string; email: string; phone: string; city: string }}
        onLogout={() => {
          handleLogoutAll();
          navigate(ViewEnum.HOME);
        }}
      />
    );

  case ViewEnum.CAR_SERVICES:
    return <CarServices onNavigate={navigate} />;

  case ViewEnum.SERVICE_DETAIL:
    return (
      <ServiceDetail
        onNavigate={navigate}
        onBack={() => navigate(ViewEnum.CAR_SERVICES)}
      />
    );

  case ViewEnum.SERVICE_CART:
    return (
      <ServiceCartErrorBoundary>
      <ServiceCart
        isLoggedIn={!!currentUser}
        customerUserId={currentUser?.id ?? null}
        onLogin={() => navigate(ViewEnum.LOGIN_PORTAL)}
        onSubmitRequest={handleServiceRequestSubmit}
        serviceProviders={serviceProviderOptions as React.ComponentProps<typeof ServiceCart>['serviceProviders']}
        onUseMyLocation={handleUseMyLocation}
        isLocating={isLocating}
        locationError={locationError || undefined}
      />
      </ServiceCartErrorBoundary>
    );

  case ViewEnum.PRICING: {
    const applySellerPlan = async (planId: SubscriptionPlan) => {
      if (!currentUser || currentUser.role !== 'seller') {
        addToast('Sign in as a seller to change plans.', 'info');
        return;
      }
      const updatedUser = { ...currentUser, subscriptionPlan: planId };
      try {
        const userService = await import('../../services/userService');
        const savedUser = await userService.updateUser(updatedUser);
        setUsers((prev) => prev.map((u) => (u.email === currentUser.email ? savedUser : u)));
        setCurrentUser(savedUser);
        const userJson = currentUserForLocalSessionJson(savedUser);
        sessionStorage.setItem('currentUser', userJson);
        localStorage.setItem('reRideCurrentUser', userJson);
        addToast(
          planId === 'free' ? 'Successfully switched to the Free plan!' : 'Plan updated successfully!',
          'success',
        );
        navigate(ViewEnum.SELLER_DASHBOARD);
      } catch (error) {
        logError('Failed to update plan:', error);
        addToast('Could not update your plan. Please try again later.', 'error');
      }
    };

    if (isMobileApp) {
      return (
        <MobilePricingPage
          currentUser={currentUser}
          addToast={addToast}
          onSelectPlan={applySellerPlan}
          onNavigate={navigate}
        />
      );
    }
    return (
      <PricingPage
        currentUser={currentUser}
        addToast={addToast}
        onSelectPlan={applySellerPlan}
      />
    );
  }

  case ViewEnum.ABOUT_US:
    return <AboutUsPage onNavigate={navigate} />;

  case ViewEnum.SUPPORT:
    if (isMobileApp) {
      return (
        <MobileSupportPage
          currentUser={currentUser}
          onSubmitTicket={async (ticket) => {
            try {
              const { createSupportTicketInSupabase } = await import('../../services/supportTicketService');
              const created = await createSupportTicketInSupabase(ticket);
              if (!created) {
                addToast('Could not send your message. Please try again.', 'error');
                return false;
              }
              setSupportTickets(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
              addToast('Your message has been sent! We will get back to you soon.', 'success');
              navigate(ViewEnum.HOME);
              return true;
            } catch (error) {
              logError('Support ticket submission failed:', error);
              addToast('Could not send your message. Please try again.', 'error');
              return false;
            }
          }}
          onNavigate={navigate}
        />
      );
    }
    return (
      <SupportPage 
        currentUser={currentUser}
        onSubmitTicket={async (ticket) => {
          try {
            const { createSupportTicketInSupabase } = await import('../../services/supportTicketService');
            const created = await createSupportTicketInSupabase(ticket);
            if (!created) {
              addToast('Could not send your message. Please try again.', 'error');
              return false;
            }
            setSupportTickets(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
            addToast('Your message has been sent! We will get back to you soon.', 'success');
            return true;
          } catch (error) {
            logError('Support ticket submission failed:', error);
            addToast('Could not send your message. Please try again.', 'error');
            return false;
          }
        }}
      />
    );

  case ViewEnum.FAQ:
    if (isMobileApp) {
      return (
        <MobileFAQPage faqItems={faqItems} />
      );
    }
    return (
      <FAQPage 
        faqItems={faqItems}
      />
    );

  case ViewEnum.HELP_CENTER:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <HelpCenterPage faqItems={faqItems} onNavigate={navigate} />
      </React.Suspense>
    );

  case ViewEnum.PRIVACY_POLICY:
    if (isMobileApp) {
      return (
        <MobilePrivacyPolicyPage />
      );
    }
    return (
      <PrivacyPolicyPage />
    );

  case ViewEnum.TERMS_OF_SERVICE:
    if (isMobileApp) {
      return (
        <MobileTermsOfServicePage />
      );
    }
    return (
      <TermsOfServicePage />
    );

  case ViewEnum.SAFETY_CENTER:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <SafetyCenterPage onNavigate={navigate} />
      </React.Suspense>
    );

  case ViewEnum.REFUND_POLICY:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <RefundPolicyPage />
      </React.Suspense>
    );

  case ViewEnum.COMPLAINT_RESOLUTION:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <ComplaintResolutionPage onNavigate={navigate} />
      </React.Suspense>
    );

  case ViewEnum.FRAUD_POLICY:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <FraudPolicyPage onNavigate={navigate} />
      </React.Suspense>
    );

  case ViewEnum.COOKIE_POLICY:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <CookiePolicyPage />
      </React.Suspense>
    );

  case ViewEnum.CITY_LANDING:
    return (
      <CityLandingPage
        city={selectedCity || ''}
        vehicles={vehicles}
        onSelectVehicle={selectVehicle}
        onToggleWishlist={toggleWishlist}
        onToggleCompare={toggleCompare}
        wishlist={wishlist}
        comparisonList={comparisonList}
        onViewSellerProfile={openSellerProfileByEmail}
      />
    );

  case ViewEnum.NOT_FOUND:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <NotFoundPage onNavigate={navigate} currentUser={currentUser} />
      </React.Suspense>
    );

  case ViewEnum.LOGIN_PORTAL:
  case ViewEnum.CUSTOMER_LOGIN:
  case ViewEnum.SELLER_LOGIN: {
    const loginForcedRole =
      currentView === ViewEnum.CUSTOMER_LOGIN
        ? ('customer' as const)
        : currentView === ViewEnum.SELLER_LOGIN
          ? ('seller' as const)
          : undefined;
    return (
      <AuthenticationErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <UnifiedLogin 
            onLogin={handleLogin}
            onRegister={handleRegister}
            onNavigate={navigate}
            onServiceProviderLogin={(provider) => {
              const p = provider as unknown as AppServiceProvider;
              const name =
                typeof p.name === 'string' && p.name.trim()
                  ? p.name.trim()
                  : 'Service provider';
              setServiceProvider({
                ...p,
                name,
                city:
                  typeof p.city === 'string' && p.city.trim()
                    ? p.city.trim()
                    : '',
              });
              navigate(ViewEnum.CAR_SERVICE_DASHBOARD);
              addToast(`Welcome, ${name}!`, 'success');
            }}
            onForgotPassword={() => {
              setForgotPasswordRole('customer');
              navigate(ViewEnum.FORGOT_PASSWORD);
            }}
            allowedRoles={['customer', 'seller', 'service_provider']}
            forcedRole={loginForcedRole}
          />
        </Suspense>
      </AuthenticationErrorBoundary>
    );
  }

  case ViewEnum.ADMIN_LOGIN:
    return (
      <AuthenticationErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <AdminLogin
            onLogin={handleLogin}
            onNavigate={navigate}
          />
        </Suspense>
      </AuthenticationErrorBoundary>
    );

  case ViewEnum.FORGOT_PASSWORD:
    return (
      <AuthenticationErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <ForgotPassword
            onBack={() => goBack(previousView === ViewEnum.ADMIN_LOGIN ? ViewEnum.ADMIN_LOGIN : ViewEnum.LOGIN_PORTAL)}
            onResetSent={(email) => {
              if (process.env.NODE_ENV === 'development') {
                logInfo('Password reset email requested for:', email);
              }
            }}
          />
        </Suspense>
      </AuthenticationErrorBoundary>
    );

  case ViewEnum.SELL_CAR:
    if (isMobileApp) {
      return (
        <MobileSellCarPage onNavigate={navigate} addToast={addToast} />
      );
    }
    return (
      <SellCarPage 
        onNavigate={navigate}
      />
    );

  case ViewEnum.SELL_CAR_ADMIN:
    return userHasAdminRole(currentUser) && currentUser ? (
      <SellCarAdmin
        onNavigate={navigate}
      />
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Denied</h2>
          <p className="text-gray-500 mb-4">You need to be logged in as an admin to access this page.</p>
          <button
            onClick={() => navigate(ViewEnum.ADMIN_LOGIN)}
            className="btn-brand-primary"
          >
            Login as Admin
          </button>
        </div>
      </div>
    );

  case ViewEnum.NOTIFICATIONS_CENTER:
    if (!currentUser?.email) {
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <h2 className="text-2xl font-bold text-gray-600 mb-4">Sign in required</h2>
            <p className="text-gray-500 mb-4">Log in to see your activity and notifications.</p>
            <button
              type="button"
              onClick={() => navigate(ViewEnum.LOGIN_PORTAL)}
              className="btn-brand-primary"
            >
              Login
            </button>
          </div>
        </div>
      );
    }
    {
      const normalizedEmail = currentUser.email.toLowerCase().trim();
      const userNotifs = notifications.filter(
        (n) =>
          n.recipientEmail &&
          n.recipientEmail.toLowerCase().trim() === normalizedEmail
      );
      return (
        <Suspense fallback={<LoadingSpinner />}>
          {isMobileApp ? (
            <MobileNotifications
              notifications={userNotifs}
              vehicles={vehicles}
              conversations={conversations}
              onNotificationClick={handleNotificationClick}
              onAcceptDealChat={handleAcceptDealChat}
              onMarkAsRead={handleMarkNotificationsAsRead}
              onMarkAllAsRead={handleMarkAllNotificationsAsRead}
              onBack={() => goBack(ViewEnum.HOME)}
              isLoading={isLoading && userNotifs.length === 0}
              profileMuteKeys={currentUser.notificationMuteKeys}
              onPersistMuteKeys={
                currentUser.email
                  ? async (keys) => {
                      await updateUser(currentUser.email, { notificationMuteKeys: keys });
                    }
                  : undefined
              }
            />
          ) : (
            <NotificationsPage
              notifications={userNotifs}
              vehicles={vehicles}
              conversations={conversations}
              onNotificationClick={handleNotificationClick}
              onAcceptDealChat={handleAcceptDealChat}
              onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
              onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
              onBack={() => goBack(ViewEnum.HOME)}
              contentBottomPadding={isMobileApp}
              profileMuteKeys={currentUser.notificationMuteKeys}
              onPersistMuteKeys={
                currentUser.email
                  ? async (keys) => {
                      await updateUser(currentUser.email, { notificationMuteKeys: keys });
                    }
                  : undefined
              }
            />
          )}
        </Suspense>
      );
    }

  default:
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Page Not Found</h2>
          <p className="text-gray-500 mb-4">The page you&apos;re looking for doesn&apos;t exist.</p>
          <button 
            onClick={() => navigate(ViewEnum.HOME)}
            className="btn-brand-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
}
};

export default AppViewRenderer;

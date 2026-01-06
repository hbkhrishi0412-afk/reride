import React, { Suspense, useEffect } from 'react';
import { AppProvider, useApp } from './components/AppProvider';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import { 
  VehicleListErrorBoundary, 
  ChatErrorBoundary, 
  DashboardErrorBoundary, 
  AdminPanelErrorBoundary,
  AuthenticationErrorBoundary
} from './components/ErrorBoundaries';
import Header from './components/Header';
import Footer from './components/Footer';
import ToastContainer from './components/ToastContainer';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import useIsMobileApp from './hooks/useIsMobileApp';
import ShareTargetHandler from './components/ShareTargetHandler';
import OfflineIndicator from './components/OfflineIndicator';
// Layout/utility components that are always needed - keep as eager imports
import MobileLayout from './components/MobileLayout';
import MobileSearch from './components/MobileSearch';
import MobilePushNotificationManager from './components/MobilePushNotificationManager';
import { View as ViewEnum, Vehicle, User, SubscriptionPlan, Notification, Conversation, ChatMessage } from './types';
import { parseDeepLink } from './utils/mobileFeatures';
import { planService } from './services/planService';
import { enrichVehiclesWithSellerInfo } from './utils/vehicleEnrichment';
import { resetViewportZoom } from './utils/viewportZoom';
import { matchesCity } from './utils/cityMapping';

// Simple loading component
const LoadingSpinner: React.FC = () => (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
            <span className="text-xl font-semibold text-gray-600">Loading...</span>
        </div>
    </div>
);

// Minimal loading fallback for non-critical lazy components
const MinimalLoader: React.FC = () => null;

// Lazy-loaded components with preloading
const Home = React.lazy(() => import('./components/Home'));
const VehicleList = React.lazy(() => import('./components/VehicleList'));
const VehicleDetail = React.lazy(() => import('./components/VehicleDetail'));
// Enhanced lazy loading with error handling for production
const Dashboard = React.lazy(() => {
  return import('./components/Dashboard').then(module => {
    return module;
  }).catch((error) => {
    // Log the error for debugging in production
    const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
    if (isProduction) {
      console.error('[Production] Failed to load Dashboard component:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    } else {
      console.error('Failed to load Dashboard component:', error);
    }
    // Return a fallback component module instead of throwing
    return {
      default: () => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Failed to Load Dashboard</h2>
            <p className="text-gray-600 mb-6">There was an error loading the dashboard. Please refresh the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    };
  });
});
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const Comparison = React.lazy(() => import('./components/Comparison'));
const Profile = React.lazy(() => import('./components/Profile'));
const CustomerInbox = React.lazy(() => import('./components/CustomerInbox'));
const SellerProfilePage = React.lazy(() => import('./components/SellerProfilePage'));
const NewCars = React.lazy(() => import('./components/NewCars'));
const DealerProfiles = React.lazy(() => import('./components/DealerProfiles'));
const PricingPage = React.lazy(() => import('./components/PricingPage'));
const SupportPage = React.lazy(() => import('./components/SupportPage'));
const FAQPage = React.lazy(() => import('./components/FAQPage'));
const BuyerDashboard = React.lazy(() => import('./components/BuyerDashboard'));
const CityLandingPage = React.lazy(() => import('./components/CityLandingPage'));
const UnifiedLogin = React.lazy(() => import('./components/UnifiedLogin'));
const ForgotPassword = React.lazy(() => import('./components/ForgotPassword'));
const SellCarPage = React.lazy(() => import('./components/SellCarPage'));
const SellCarAdmin = React.lazy(() => import('./components/SellCarAdmin'));
const AdminLogin = React.lazy(() => import('./AdminLogin'));
const NewCarsAdmin = React.lazy(() => import('./components/NewCarsAdmin'));
const NewCarsAdminLogin = React.lazy(() => import('./NewCarsAdminLogin'));

// Lazy-loaded Mobile view components (only loaded when needed - reduces initial bundle size)
const MobileDashboard = React.lazy(() => import('./components/MobileDashboard'));
const MobileVehicleDetail = React.lazy(() => import('./components/MobileVehicleDetail'));
const MobileInbox = React.lazy(() => import('./components/MobileInbox'));
const MobileProfile = React.lazy(() => import('./components/MobileProfile'));
const MobileWishlist = React.lazy(() => import('./components/MobileWishlist'));
const MobileComparison = React.lazy(() => import('./components/MobileComparison'));
const MobileSellerProfilePage = React.lazy(() => import('./components/MobileSellerProfilePage'));
const MobileSellCarPage = React.lazy(() => import('./components/MobileSellCarPage'));
const MobileNewCarsPage = React.lazy(() => import('./components/MobileNewCarsPage'));
const MobilePricingPage = React.lazy(() => import('./components/MobilePricingPage'));
const MobileSupportPage = React.lazy(() => import('./components/MobileSupportPage'));
const MobileFAQPage = React.lazy(() => import('./components/MobileFAQPage'));
const MobileBuyerDashboard = React.lazy(() => import('./components/MobileBuyerDashboard'));
const MobileRentalPage = React.lazy(() => import('./components/MobileRentalPage'));
const MobileDealerProfilesPage = React.lazy(() => import('./components/MobileDealerProfilesPage'));
const MobileCityLandingPage = React.lazy(() => import('./components/MobileCityLandingPage'));
const MobileHomePage = React.lazy(() => import('./components/MobileHomePage'));

// Lazy-loaded non-critical components (loaded on demand)
const CommandPalette = React.lazy(() => import('./components/CommandPalette'));
const ChatWidget = React.lazy(() => import('./components/ChatWidget').then(module => ({ default: module.ChatWidget })));
const SupportChatWidget = React.lazy(() => import('./components/SupportChatWidget'));

// Preload critical components - optimized for faster loading
const preloadCriticalComponents = () => {
  // Preload components that are likely to be visited next
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback for better performance, fallback to setTimeout
    const schedulePreload = (callback: () => void, delay: number) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: delay });
      } else {
        setTimeout(callback, delay);
      }
    };
    
    // Preload critical components after initial render
    schedulePreload(() => {
      Promise.all([
        import('./components/VehicleList'),
        import('./components/VehicleDetail'),
        import('./components/Home')
      ]).catch(() => {
        // Silently fail if preloading fails
      });
    }, 500);
    
    // Preload secondary components when idle
    schedulePreload(() => {
      Promise.all([
        import('./components/Dashboard').catch((error) => {
          // Log error but don't fail - Dashboard will be loaded on-demand if needed
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Dashboard preload failed (non-critical):', error);
          }
          return null; // Return null to prevent Promise.all from failing
        }),
        import('./components/Profile').catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Profile preload failed (non-critical):', error);
          }
          return null;
        })
      ]).catch(() => {
        // Silently fail if preloading fails - these are optimizations, not critical
      });
    }, 2000);
  }
};

const AppContent: React.FC = React.memo(() => {
  // Detect if running as mobile app (standalone/installed PWA)
  const { isMobileApp, isMobile } = useIsMobileApp();
  
  // Preload critical components after initial render
  React.useEffect(() => {
    preloadCriticalComponents();
  }, []);
  
  // Fix viewport zoom on mount and route changes - applies to ALL pages
  React.useEffect(() => {
    // Reset zoom on mount
    resetViewportZoom();
    
    // Reset zoom after route changes
    const handleRouteChange = () => {
      setTimeout(() => resetViewportZoom(), 100);
    };
    
    // Listen for navigation events
    window.addEventListener('popstate', handleRouteChange);
    
    // Reset zoom periodically to catch any issues
    const zoomCheckInterval = setInterval(() => {
      resetViewportZoom();
    }, 5000);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      clearInterval(zoomCheckInterval);
    };
  }, []);
  
  const { 
    currentView, 
    setCurrentView,
    navigate,
    goBack, 
    currentUser, 
    setCurrentUser,
    handleLogout, 
    comparisonList, 
    wishlist, 
    notifications,
    setNotifications,
    userLocation,
    setUserLocation,
    addToast,
    setIsCommandPaletteOpen,
    vehicles,
    setVehicles,
    setSelectedVehicle,
    setSelectedCategory,
    recommendations,
    selectedVehicle,
    isLoading,
    conversations,
    setConversations,
    toasts,
    activeChat,
    users,
    setUsers,
    vehicleData,
    faqItems,
    platformSettings,
    auditLog,
    supportTickets,
    selectedCategory: currentCategory,
    initialSearchQuery,
    selectedCity,
    setSelectedCity,
    publicSellerProfile,
    typingStatus,
    removeToast,
    setActiveChat,
    isCommandPaletteOpen,
    setWishlist,
    setComparisonList,
    setPublicSellerProfile: setPublicProfile,
    setInitialSearchQuery,
    setForgotPasswordRole,
    addSellerRating,
    sendMessage,
    sendMessageWithType,
    markAsRead,
    toggleTyping,
    flagContent,
    updateUser,
    deleteUser,
    updateVehicle,
    deleteVehicle,
    selectVehicle,
    toggleWishlist,
    toggleCompare,
    handleLogin,
    handleRegister,
    onCreateUser,
    onAdminUpdateUser,
    onUpdateUserPlan,
    onToggleUserStatus,
    onToggleVehicleStatus,
    onToggleVehicleFeature,
    onResolveFlag,
    onUpdateSettings,
    onSendBroadcast,
    onExportUsers,
    onImportUsers,
    onExportVehicles,
    onImportVehicles,
    onExportSales,
    onUpdateVehicleData,
    onToggleVerifiedStatus,
    onUpdateSupportTicket,
    onAddFaq,
    onUpdateFaq,
    onDeleteFaq,
    onCertificationApproval,
    onOfferResponse,
  } = useApp();

  // Debug: Log when activeChat changes (must be after destructuring)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 activeChat state changed:', { 
        hasActiveChat: !!activeChat,
        activeChatId: activeChat?.id,
        hasCurrentUser: !!currentUser,
        shouldRenderChatWidget: !!(currentUser && activeChat)
      });
    }
  }, [activeChat, currentUser]);

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 AppContent Debug:', {
      isMobileApp,
      isMobile,
      currentView,
      userAgent: navigator.userAgent,
      windowWidth: window.innerWidth,
      displayMode: window.matchMedia('(display-mode: standalone)').matches
    });
  }
  
  // Handle deep linking on mount and URL changes
  // Note: This works alongside the AppProvider's popstate handler
  // This handler focuses on URL parameters (deep links), while AppProvider handles history state
  useEffect(() => {
    const handleDeepLink = () => {
      // Only process deep links if there's no history state (history state takes precedence)
      if (window.history.state && window.history.state.view) {
        // History state is handled by AppProvider, skip deep link parsing
        return;
      }
      
      const params = parseDeepLink();
      if (params.view) {
        // Convert string view to ViewEnum
        const viewEnum = Object.values(ViewEnum).find(v => v === params.view) as ViewEnum | undefined;
        if (viewEnum) {
          setCurrentView(viewEnum);
          // Handle additional params
          if (params.id && viewEnum === ViewEnum.DETAIL) {
            const vehicleId = typeof params.id === 'string' ? parseInt(params.id, 10) : params.id;
            const vehicle = vehicles.find(v => v.id === vehicleId);
            if (vehicle) {
              selectVehicle(vehicle);
            }
          }
        }
      }
    };

    // Handle initial deep link (only on mount, not on popstate)
    // The popstate handler in AppProvider will handle browser back/forward
    handleDeepLink();
  }, [vehicles, setCurrentView, selectVehicle]);

  // Restore persisted session on first load
  useEffect(() => {
    if (currentUser) {
      return;
    }

    try {
      const storedUser =
        localStorage.getItem('reRideCurrentUser') ||
        sessionStorage.getItem('currentUser');

      if (!storedUser) {
        return;
      }

      const parsedUser: User = JSON.parse(storedUser);
      
      // CRITICAL: Enhanced validation - ensure role is valid
      if (!parsedUser?.email || !parsedUser?.role) {
        console.warn('⚠️ Invalid user object in session restore - missing required fields:', { 
          hasEmail: !!parsedUser?.email, 
          hasRole: !!parsedUser?.role 
        });
        // Clear invalid data
        localStorage.removeItem('reRideCurrentUser');
        sessionStorage.removeItem('currentUser');
        return;
      }
      
      // Validate role is a valid value
      if (!['customer', 'seller', 'admin'].includes(parsedUser.role)) {
        console.warn('⚠️ Invalid role in session restore:', parsedUser.role);
        localStorage.removeItem('reRideCurrentUser');
        sessionStorage.removeItem('currentUser');
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Restoring persisted session for:', parsedUser.email, parsedUser.role);
      }
      setCurrentUser(parsedUser);

      const loginViews: ViewEnum[] = [
        ViewEnum.LOGIN_PORTAL,
        ViewEnum.CUSTOMER_LOGIN,
        ViewEnum.SELLER_LOGIN,
        ViewEnum.ADMIN_LOGIN,
        ViewEnum.NEW_CARS_ADMIN_LOGIN,
      ];

      if (loginViews.includes(currentView)) {
        switch (parsedUser.role) {
          case 'seller':
            setCurrentView(ViewEnum.SELLER_DASHBOARD);
            break;
          case 'admin':
            setCurrentView(ViewEnum.ADMIN_PANEL);
            break;
          default:
            setCurrentView(ViewEnum.BUYER_DASHBOARD);
            break;
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Failed to restore persisted session:', error);
      }
    }
  }, [currentUser, currentView, setCurrentUser, setCurrentView]);

  // Redirect logged-in users to their appropriate dashboard (except customers who can access home)
  // In mobile app, sellers can also access home page
  useEffect(() => {
    if (currentUser && currentView === ViewEnum.HOME) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 User is logged in, checking dashboard redirect:', currentUser.role, 'isMobileApp:', isMobileApp);
      }
      switch (currentUser.role) {
        case 'customer':
          // Customers can access home page - no redirect
          break;
        case 'seller':
          // In mobile app, sellers can access home page
          if (!isMobileApp) {
            navigate(ViewEnum.SELLER_DASHBOARD);
          }
          break;
        case 'admin':
          navigate(ViewEnum.ADMIN_PANEL);
          break;
        default:
          // Keep on home page for other roles
          break;
      }
    }
  }, [currentUser, currentView, navigate, isMobileApp]);

  // Recover vehicle from sessionStorage on mount
  useEffect(() => {
    if (!selectedVehicle && currentView === ViewEnum.DETAIL) {
      try {
        const storedVehicle = sessionStorage.getItem('selectedVehicle');
        if (storedVehicle) {
          const vehicleToShow = JSON.parse(storedVehicle);
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Recovered vehicle from sessionStorage:', vehicleToShow?.id, vehicleToShow?.make, vehicleToShow?.model);
          }
          setSelectedVehicle(vehicleToShow);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('🔧 Failed to recover vehicle from sessionStorage:', error);
        }
      }
    }
  }, [currentView, selectedVehicle]);

  // Handle deep links: open seller profile via ?seller=email
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sellerParam = params.get('seller');
      if (sellerParam) {
        const seller = users.find(u => {
          return u && u.email && u.email.toLowerCase() === sellerParam.toLowerCase();
        });
        if (seller) {
          setPublicProfile(seller);
          navigate(ViewEnum.SELLER_PROFILE);
        }
      }
    } catch (e) {
      console.warn('Failed to process deep link params', e);
    }
  }, [users, navigate, setPublicProfile]);


  // Memoize renderView to prevent unnecessary re-renders
  const renderView = React.useCallback(() => {
    switch (currentView) {
      case ViewEnum.HOME:
        if (isMobileApp) {
          return (
            <MobileLayout
              showHeader={true}
              showBottomNav={true}
              headerTitle={getPageTitle()}
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigate={navigate}
              currentView={currentView}
              wishlistCount={wishlist.length}
              inboxCount={conversations.filter(c => {
                if (!c || !c.customerId || !currentUser?.email || c.isReadByCustomer) return false;
                return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
              }).length}
            >
              <MobileHomePage
                onSearch={(query) => {
                  setInitialSearchQuery(query);
                  navigate(ViewEnum.USED_CARS);
                }}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                  navigate(ViewEnum.USED_CARS);
                }}
                featuredVehicles={vehicles.filter(v => v.isFeatured && v.status === 'published').slice(0, 4)}
                onSelectVehicle={selectVehicle}
                onToggleCompare={(id) => {
                  setComparisonList(prev => 
                    prev.includes(id) 
                      ? prev.filter(vId => vId !== id)
                      : [...prev, id]
                  );
                }}
                comparisonList={comparisonList}
                onToggleWishlist={(id) => {
                  setWishlist(prev => 
                    prev.includes(id) 
                      ? prev.filter(vId => vId !== id)
                      : [...prev, id]
                  );
                }}
                wishlist={wishlist}
                onViewSellerProfile={(sellerEmail) => {
                  const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                  const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                  if (seller) {
                    setPublicProfile(seller);
                    navigate(ViewEnum.SELLER_PROFILE);
                  }
                }}
                recommendations={recommendations}
                allVehicles={vehicles.filter(v => v.status === 'published')}
                onNavigate={navigate}
                onSelectCity={(city) => {
                  setSelectedCity(city);
                  navigate(ViewEnum.USED_CARS);
                }}
              />
            </MobileLayout>
          );
        }
        return (
          <Home 
            onSearch={(query) => {
              setInitialSearchQuery(query);
              navigate(ViewEnum.USED_CARS);
            }}
            onSelectCategory={(category) => {
              setSelectedCategory(category);
              navigate(ViewEnum.USED_CARS);
            }}
            featuredVehicles={vehicles.filter(v => v.isFeatured && v.status === 'published').slice(0, 4)}
            onSelectVehicle={selectVehicle}
            onToggleCompare={(id) => {
              setComparisonList(prev => 
                prev.includes(id) 
                  ? prev.filter(vId => vId !== id)
                  : [...prev, id]
              );
            }}
            comparisonList={comparisonList}
            onToggleWishlist={(id) => {
              setWishlist(prev => 
                prev.includes(id) 
                  ? prev.filter(vId => vId !== id)
                  : [...prev, id]
              );
            }}
            wishlist={wishlist}
            onViewSellerProfile={(sellerEmail) => {
              // Normalize emails for comparison (critical for production)
              const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
              const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
            recommendations={recommendations}
            onNavigate={navigate}
            onSelectCity={(city) => {
              setSelectedCity(city);
              navigate(ViewEnum.USED_CARS);
            }}
          />
        );

      case ViewEnum.USED_CARS:
        // Filter vehicles for buy/sale (exclude rental vehicles)
        // Filter by status, listingType, and city if selected
        const filteredVehicles = vehicles.filter(v => {
          if (!v) return false;
          const isPublished = v.status === 'published';
          // Exclude rental vehicles from buy/sale listings
          const isNotRental = v.listingType !== 'rental' || v.listingType === undefined;
          // Apply city filter if a city is selected (using city mapping for accurate matching)
          const matchesCityFilter = matchesCity(v.city, selectedCity);
          
          return isPublished && isNotRental && matchesCityFilter;
        });
        
        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('USED_CARS filter results:', {
            totalVehicles: vehicles.length,
            publishedVehicles: vehicles.filter(v => v.status === 'published').length,
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
              isLoading={isLoading}
              comparisonList={comparisonList}
              onToggleCompare={(id) => {
                setComparisonList(prev => 
                  prev.includes(id) 
                    ? prev.filter(vId => vId !== id)
                    : [...prev, id]
                );
              }}
              onClearCompare={() => setComparisonList([])}
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
              onViewSellerProfile={(sellerEmail) => {
                // Normalize emails for comparison (critical for production)
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
              userLocation={userLocation}
              currentUser={currentUser}
              onSaveSearch={(search) => {
                addToast(`Search "${search.name}" saved successfully!`, 'success');
              }}
              selectedCity={selectedCity}
              onCityChange={(city) => {
                setSelectedCity(city);
              }}
            />
          </VehicleListErrorBoundary>
        );

      case ViewEnum.DETAIL:
        // Enhanced recovery: Check both state and sessionStorage
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 App.tsx: Rendering DETAIL view');
          console.log('🎯 Current selectedVehicle from state:', selectedVehicle?.id, selectedVehicle?.make, selectedVehicle?.model);
        }
        
        let vehicleToDisplay = selectedVehicle;
        if (!vehicleToDisplay) {
          try {
            const storedVehicle = sessionStorage.getItem('selectedVehicle');
            if (storedVehicle) {
              vehicleToDisplay = JSON.parse(storedVehicle);
              if (process.env.NODE_ENV === 'development') {
                console.log('🔧 App.tsx: Recovered vehicle from sessionStorage for rendering:', vehicleToDisplay?.id, vehicleToDisplay?.make, vehicleToDisplay?.model);
              }
              // Update state for future renders
              setSelectedVehicle(vehicleToDisplay);
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ App.tsx: No vehicle in sessionStorage');
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('❌ App.tsx: Failed to recover vehicle from sessionStorage:', error);
            }
          }
        }
        
        if (!vehicleToDisplay) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ App.tsx: No vehicle to display - showing error message');
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
          console.log('✅ App.tsx: Vehicle found, rendering VehicleDetail component:', vehicleToDisplay.id, vehicleToDisplay.make, vehicleToDisplay.model);
        }
        
        // Use MobileVehicleDetail for mobile app, VehicleDetail for desktop
        if (isMobileApp) {
          return (
            <MobileVehicleDetail
              vehicle={vehicleToDisplay}
              onBack={() => goBack(ViewEnum.USED_CARS)}
              comparisonList={comparisonList}
              onToggleCompare={toggleCompare}
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist}
              currentUser={currentUser}
              users={users}
              onViewSellerProfile={(sellerEmail: string) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
              onStartChat={(vehicle) => {
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔧 Chat with Seller clicked:', { vehicleId: vehicle.id, vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}` });
                }
                
                if (!currentUser) {
                  addToast('Please login to start a chat', 'info');
                  navigate(ViewEnum.LOGIN_PORTAL);
                  return;
                }
                
                const normalizedCustomerEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
                let conversation = normalizedCustomerEmail ? conversations.find(c => {
                  if (!c || !c.customerId) return false;
                  return c.vehicleId === vehicle.id && c.customerId.toLowerCase().trim() === normalizedCustomerEmail;
                }) : undefined;
                
                if (!conversation) {
                  const newConversation = {
                    id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    customerId: currentUser.email,
                    customerName: currentUser.name,
                    sellerId: vehicle.sellerEmail,
                    vehicleId: vehicle.id,
                    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                    vehiclePrice: vehicle.price,
                    messages: [],
                    lastMessageAt: new Date().toISOString(),
                    isReadBySeller: false,
                    isReadByCustomer: true,
                    isFlagged: false
                  };
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log('🔧 Creating new conversation:', newConversation.id);
                  }
                  
                  setConversations([...conversations, newConversation]);
                  
                  (async () => {
                    try {
                      const { saveConversationToMongoDB } = await import('./services/conversationService');
                      await saveConversationToMongoDB(newConversation);
                    } catch (error) {
                      console.warn('Failed to save conversation to MongoDB:', error);
                    }
                  })();
                  
                  conversation = newConversation;
                } else {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('🔧 Using existing conversation:', conversation.id);
                  }
                }
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔧 Setting activeChat:', conversation.id);
                }
                
                setActiveChat(conversation);
                addToast('Chat started with seller', 'success');
              }}
              recommendations={recommendations}
              onSelectVehicle={selectVehicle}
            />
          );
        }
        
        return (
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
            onViewSellerProfile={(sellerEmail: string) => {
              const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
              const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
            onStartChat={(vehicle) => {
              if (!currentUser) {
                addToast('Please login to start a chat', 'info');
                navigate(ViewEnum.LOGIN_PORTAL);
                return;
              }
              
              const normalizedCustomerEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
              let conversation = normalizedCustomerEmail ? conversations.find(c => {
                if (!c || !c.customerId) return false;
                return c.vehicleId === vehicle.id && c.customerId.toLowerCase().trim() === normalizedCustomerEmail;
              }) : undefined;
              
              if (!conversation) {
                const newConversation = {
                  id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  customerId: currentUser.email,
                  customerName: currentUser.name,
                  sellerId: vehicle.sellerEmail,
                  vehicleId: vehicle.id,
                  vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                  vehiclePrice: vehicle.price,
                  messages: [],
                  lastMessageAt: new Date().toISOString(),
                  isReadBySeller: false,
                  isReadByCustomer: true,
                  isFlagged: false
                };
                setConversations([...conversations, newConversation]);
                
                (async () => {
                  try {
                    const { saveConversationToMongoDB } = await import('./services/conversationService');
                    await saveConversationToMongoDB(newConversation);
                  } catch (error) {
                    console.warn('Failed to save conversation to MongoDB:', error);
                  }
                })();
                
                conversation = newConversation;
              }
              
              setActiveChat(conversation);
              addToast('Chat started with seller', 'success');
            }}
            recommendations={recommendations}
            onSelectVehicle={selectVehicle}
          />
        );

      case ViewEnum.NEW_CARS:
        if (isMobileApp) {
          return (
            <MobileNewCarsPage onNavigate={navigate} />
          );
        }
        return (
          <NewCars />
        );

      case ViewEnum.RENTAL:
        if (isMobileApp) {
          const rentalVehicles = vehicles.filter(v => {
            const isRental = v.listingType === 'rental';
            const isPublished = v.status === 'published';
            const matchesCityFilter = matchesCity(v.city, selectedCity);
            return isRental && isPublished && matchesCityFilter;
          });
          return (
            <MobileRentalPage
              vehicles={rentalVehicles}
              onSelectVehicle={selectVehicle}
              comparisonList={comparisonList}
              onToggleCompare={toggleCompare}
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist}
              currentUser={currentUser}
              onViewSellerProfile={(sellerEmail: string) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
            />
          );
        }
        // Filter vehicles specifically marked for rental
        const rentalVehicles = vehicles.filter(v => {
          // Only show vehicles explicitly marked as rental
          const isRental = v.listingType === 'rental';
          const isPublished = v.status === 'published';
          
          // Apply city filter if selected (using city mapping for accurate matching)
          const matchesCityFilter = matchesCity(v.city, selectedCity);
          
          return isRental && isPublished && matchesCityFilter;
        });
        
        return (
          <VehicleListErrorBoundary>
            <VehicleList
              vehicles={enrichVehiclesWithSellerInfo(rentalVehicles, users)}
              onSelectVehicle={selectVehicle}
              isLoading={isLoading}
              comparisonList={comparisonList}
              onToggleCompare={(id) => {
                setComparisonList(prev => 
                  prev.includes(id) 
                    ? prev.filter(vId => vId !== id)
                    : [...prev, id]
                );
              }}
              onClearCompare={() => setComparisonList([])}
              wishlist={wishlist}
              onToggleWishlist={(id) => {
                setWishlist(prev => 
                  prev.includes(id) 
                    ? prev.filter(vId => vId !== id)
                    : [...prev, id]
                );
              }}
              categoryTitle={selectedCity ? `Rental Vehicles in ${selectedCity}` : "Rental Vehicles"}
              initialCategory={currentCategory}
              initialSearchQuery={initialSearchQuery}
              onViewSellerProfile={(sellerEmail) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
              userLocation={userLocation}
              currentUser={currentUser}
              onSaveSearch={(search) => {
                addToast(`Search "${search.name}" saved successfully!`, 'success');
              }}
            />
          </VehicleListErrorBoundary>
        );

      case ViewEnum.COMPARISON:
        if (isMobileApp) {
          return (
            <MobileComparison
              vehicles={vehicles}
              comparisonList={comparisonList}
              onRemoveFromCompare={(id) => {
                setComparisonList(prev => prev.filter(vId => vId !== id));
              }}
              onSelectVehicle={selectVehicle}
              onBack={() => goBack(ViewEnum.USED_CARS)}
            />
          );
        }
        return (
          <Comparison 
            vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => comparisonList.includes(v.id)), users)}
            onBack={() => goBack(ViewEnum.USED_CARS)}
            onToggleCompare={(id: number) => {
              setComparisonList(prev => 
                prev.includes(id) 
                  ? prev.filter(vId => vId !== id)
                  : [...prev, id]
              );
            }}
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
              onViewSellerProfile={(sellerEmail) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
              onNavigate={navigate}
            />
          );
        }
        return (
          <VehicleList
            vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => wishlist.includes(v.id)), users)}
            onSelectVehicle={selectVehicle}
            isLoading={isLoading}
            comparisonList={comparisonList}
            onToggleCompare={(id) => {
              setComparisonList(prev => 
                prev.includes(id) 
                  ? prev.filter(vId => vId !== id)
                  : [...prev, id]
              );
            }}
            onClearCompare={() => setComparisonList([])}
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
            onViewSellerProfile={(sellerEmail) => {
              // Normalize emails for comparison (critical for production)
              const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
              const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
            userLocation={userLocation}
            currentUser={currentUser}
            onSaveSearch={(search) => {
              addToast(`Search "${search.name}" saved successfully!`, 'success');
            }}
          />
        );

      case ViewEnum.SELLER_DASHBOARD:
        // CRITICAL: Enhanced validation for seller dashboard access
        console.log('🔍 Seller Dashboard Access Check:', {
          hasCurrentUser: !!currentUser,
          userEmail: currentUser?.email,
          userRole: currentUser?.role,
          userObject: currentUser ? {
            id: currentUser.id,
            email: currentUser.email,
            role: currentUser.role,
            name: currentUser.name
          } : null,
          isProduction: typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
        });
        
        if (!currentUser) {
          console.warn('⚠️ Attempted to render seller dashboard without logged-in user');
          navigate(ViewEnum.LOGIN_PORTAL);
          return null;
        }
        
        if (!currentUser.email || !currentUser.role) {
          console.error('❌ Invalid user object - missing email or role:', { 
            hasEmail: !!currentUser.email, 
            hasRole: !!currentUser.role,
            userObject: currentUser
          });
          navigate(ViewEnum.LOGIN_PORTAL);
          return null;
        }
        
        if (currentUser.role !== 'seller') {
          console.warn('⚠️ Attempted to render seller dashboard with role:', currentUser.role, 'Expected: seller');
          navigate(ViewEnum.LOGIN_PORTAL);
          return null;
        }
        
        console.log('✅ Seller dashboard validation passed, rendering dashboard');
        
        // Safety check: Ensure vehicleData is defined
        if (!vehicleData) {
          console.error('❌ vehicleData is undefined, cannot render dashboard');
          return (
            <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-600 mb-4">Loading Dashboard...</h2>
                <p className="text-gray-500">Please wait while we load the dashboard data.</p>
              </div>
            </div>
          );
        }
        
        const sellerVehiclesFiltered = (vehicles || []).filter(v => {
          if (!v || !v.sellerEmail || !currentUser?.email) return false;
          return v.sellerEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
        });

        // Use MobileDashboard for mobile app, Dashboard for desktop
        if (isMobileApp) {
          return (
            <DashboardErrorBoundary>
              <MobileLayout
                showHeader={false}
                showBottomNav={true}
                headerTitle={getPageTitle()}
                currentUser={currentUser}
                onLogout={handleLogout}
                onNavigate={navigate}
                currentView={currentView}
                wishlistCount={wishlist.length}
                inboxCount={conversations.filter(c => {
                  if (!c || !c.sellerId || !currentUser?.email || c.isReadBySeller) return false;
                  return c.sellerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
                }).length}
              >
                <MobileDashboard
                  currentUser={currentUser}
                  userVehicles={enrichVehiclesWithSellerInfo(
                    sellerVehiclesFiltered,
                    users || []
                  )}
                  conversations={(conversations || []).filter(c => c && c.sellerId && currentUser?.email && c.sellerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim())}
                  onNavigate={navigate}
                  onEditVehicle={(vehicle) => {
                    // MobileDashboard handles editing internally
                    console.log('Edit vehicle:', vehicle);
                  }}
                  onDeleteVehicle={async (vehicleId) => {
                    await deleteVehicle(vehicleId);
                  }}
                  onMarkAsSold={async (vehicleId) => {
                    const vehicle = vehicles.find(v => v.id === vehicleId);
                    if (vehicle) {
                      await updateVehicle(vehicleId, { status: 'sold', soldAt: new Date().toISOString(), listingStatus: 'sold' });
                    }
                  }}
                  onFeatureListing={async (vehicleId) => {
                    try {
                      const { authenticatedFetch } = await import('./utils/authenticatedFetch');
                      const response = await authenticatedFetch('/api/vehicles?action=feature', {
                        method: 'POST',
                        body: JSON.stringify({ vehicleId })
                      });

                      const responseText = await response.text();
                      let result: any = {};
                      if (responseText) {
                        try {
                          result = JSON.parse(responseText);
                        } catch (parseError) {
                          console.warn('⚠️ Failed to parse feature response JSON:', parseError);
                          result = {};
                        }
                      }

                      if (!response.ok) {
                        const errorMessage = result?.reason || result?.error || `Failed to feature vehicle (HTTP ${response.status})`;
                        addToast(errorMessage, response.status === 403 ? 'warning' : 'error');
                        return;
                      }

                      if (result?.alreadyFeatured) {
                        addToast('This vehicle is already featured.', 'info');
                        return;
                      }

                      if (result?.success && result.vehicle) {
                        await updateVehicle(vehicleId, result.vehicle);

                        if (typeof result.remainingCredits === 'number') {
                          const sellerEmail = result.vehicle?.sellerEmail || currentUser?.email;
                          const remainingCredits = result.remainingCredits;

                          if (sellerEmail) {
                            if (currentUser?.email && currentUser.email.toLowerCase().trim() === sellerEmail.toLowerCase().trim()) {
                              setCurrentUser({
                                ...currentUser,
                                featuredCredits: remainingCredits
                              });
                            }
                            await updateUser(sellerEmail, { featuredCredits: remainingCredits });
                          }

                          addToast(`Featured credits remaining: ${remainingCredits}`, 'info');
                        }
                      } else {
                        addToast('Failed to feature vehicle. Please try again.', 'error');
                      }
                    } catch (error) {
                      console.error('❌ Failed to feature vehicle:', error);
                      addToast('Failed to feature vehicle. Please try again.', 'error');
                    }
                  }}
                  onSendMessage={sendMessage}
                  onMarkConversationAsRead={markAsRead}
                  onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                    onOfferResponse(conversationId, parseInt(messageId), response as "accepted" | "rejected" | "countered", counterPrice);
                  }}
                  typingStatus={typingStatus}
                  onUserTyping={(conversationId, _userRole) => {
                    toggleTyping(conversationId, true);
                  }}
                  onMarkMessagesAsRead={(conversationId, _readerRole) => {
                    markAsRead(conversationId);
                  }}
                  onFlagContent={flagContent}
                  onLogout={handleLogout}
                  onViewVehicle={selectVehicle}
                  onAddVehicle={async (vehicleData, isFeaturing = false) => {
                    try {
                      // Set listingExpiresAt based on subscription plan expiry date
                      let listingExpiresAt: string | undefined;
                      if (currentUser.subscriptionPlan === 'premium' && currentUser.planExpiryDate) {
                        listingExpiresAt = currentUser.planExpiryDate;
                      } else if (currentUser.subscriptionPlan !== 'premium') {
                        const expiryDate = new Date();
                        expiryDate.setDate(expiryDate.getDate() + 30);
                        listingExpiresAt = expiryDate.toISOString();
                      }
                      
                      const { addVehicle, getVehicles } = await import('./services/vehicleService');
                      const vehicleToAdd = {
                        ...vehicleData,
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        sellerEmail: currentUser.email,
                        averageRating: 0,
                        ratingCount: 0,
                        isFeatured: isFeaturing,
                        status: 'published',
                        createdAt: new Date().toISOString(),
                        listingExpiresAt,
                      } as Vehicle;
                      
                      const newVehicle = await addVehicle(vehicleToAdd);
                      setVehicles(prev => [...prev, newVehicle]);
                      
                      // Refresh vehicles list from API to ensure buy cars section shows the new vehicle
                      try {
                        const refreshedVehicles = await getVehicles();
                        setVehicles(refreshedVehicles);
                      } catch (refreshError) {
                        console.warn('Failed to refresh vehicles list after adding vehicle:', refreshError);
                        // Continue anyway - we already updated local state
                      }
                      
                      addToast('Vehicle added successfully!', 'success');
                    } catch (error) {
                      console.error('❌ Failed to add vehicle:', error);
                      addToast('Failed to add vehicle. Please try again.', 'error');
                    }
                  }}
                  onUpdateVehicle={async (vehicleData) => {
                    await updateVehicle(vehicleData.id, vehicleData);
                  }}
                  vehicleData={vehicleData}
                  onUpdateProfile={async (profileData: Partial<User>) => {
                    if (currentUser) {
                      await updateUser(currentUser.email, profileData);
                      setCurrentUser({ ...currentUser, ...profileData } as User);
                    }
                  }}
                  notifications={notifications.filter(n => n.recipientEmail === currentUser.email)}
                  onNotificationClick={handleNotificationClick}
                  onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
                  addToast={addToast}
                />
              </MobileLayout>
            </DashboardErrorBoundary>
          );
        }

        return (
          <DashboardErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Dashboard
              seller={currentUser}
              sellerVehicles={enrichVehiclesWithSellerInfo(
                sellerVehiclesFiltered, 
                users || []
              )}
              reportedVehicles={[]}
              onAddVehicle={async (vehicleData, isFeaturing = false) => {
                try {
                  // Set listingExpiresAt based on subscription plan expiry date
                  let listingExpiresAt: string | undefined;
                  if (currentUser.subscriptionPlan === 'premium' && currentUser.planExpiryDate) {
                    // Premium plan: use plan expiry date
                    listingExpiresAt = currentUser.planExpiryDate;
                  } else if (currentUser.subscriptionPlan !== 'premium') {
                    // Free and Pro plans get 30-day expiry from today
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + 30);
                    listingExpiresAt = expiryDate.toISOString();
                  }
                  // If Premium without planExpiryDate, listingExpiresAt remains undefined (no expiry)
                  
                  const newVehicle = {
                    ...vehicleData,
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    sellerEmail: currentUser.email,
                    averageRating: 0,
                    ratingCount: 0,
                    isFeatured: isFeaturing,
                    createdAt: new Date().toISOString(),
                    listingExpiresAt,
                  };
                  
                  // Call API to create vehicle
                  const { addVehicle } = await import('./services/vehicleService');
                  const result = await addVehicle(newVehicle);
                  
                  // Update local state
                  setVehicles(prev => [...prev, result]);
                  
                  // Refresh vehicles list from API to ensure buy cars section shows the new vehicle
                  try {
                    const { getVehicles } = await import('./services/vehicleService');
                    const refreshedVehicles = await getVehicles();
                    setVehicles(refreshedVehicles);
                  } catch (refreshError) {
                    console.warn('Failed to refresh vehicles list after adding vehicle:', refreshError);
                    // Continue anyway - we already updated local state
                  }
                  
                  addToast('Vehicle added successfully', 'success');
                } catch (error) {
                  console.error('❌ Failed to add vehicle:', error);
                  addToast('Failed to add vehicle', 'error');
                }
              }}
              onAddMultipleVehicles={async (vehiclesData) => {
                try {
                  // Check if seller's plan has expired
                  if (currentUser.planExpiryDate) {
                    const expiryDate = new Date(currentUser.planExpiryDate);
                    const isExpired = expiryDate < new Date();
                    if (isExpired) {
                      addToast('Your subscription plan has expired. Please renew your plan to create new vehicle listings.', 'error');
                      return;
                    }
                  }
                  
                  // Set listingExpiresAt based on subscription plan expiry date
                  let listingExpiresAt: string | undefined;
                  if (currentUser.subscriptionPlan === 'premium' && currentUser.planExpiryDate) {
                    // Premium plan: use plan expiry date
                    listingExpiresAt = currentUser.planExpiryDate;
                  } else if (currentUser.subscriptionPlan !== 'premium') {
                    // Free and Pro plans get 30-day expiry from today
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + 30);
                    listingExpiresAt = expiryDate.toISOString();
                  }
                  // If Premium without planExpiryDate, listingExpiresAt remains undefined (no expiry)
                  
                  const newVehicles = vehiclesData.map(vehicle => ({
                    ...vehicle,
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    sellerEmail: currentUser.email,
                    averageRating: 0,
                    ratingCount: 0,
                    createdAt: new Date().toISOString(),
                    listingExpiresAt,
                  }));
                  
                  // Call API to create vehicles
                  const { addVehicle, getVehicles } = await import('./services/vehicleService');
                  const results = await Promise.all(newVehicles.map(vehicle => addVehicle(vehicle)));
                  
                  // Refresh vehicles list from API to ensure buy cars section shows the new vehicles
                  try {
                    const refreshedVehicles = await getVehicles();
                    setVehicles(refreshedVehicles);
                  } catch (refreshError) {
                    console.warn('Failed to refresh vehicles list after adding vehicles:', refreshError);
                    // Fallback: update local state with results
                    setVehicles(prev => [...prev, ...results]);
                  }
                  addToast(`${results.length} vehicles added successfully`, 'success');
                } catch (error) {
                  console.error('❌ Failed to add vehicles:', error);
                  addToast('Failed to add vehicles', 'error');
                }
              }}
              onUpdateVehicle={async (vehicleData) => {
                await updateVehicle(vehicleData.id, vehicleData);
              }}
              onDeleteVehicle={async (vehicleId) => {
                await deleteVehicle(vehicleId);
              }}
              onMarkAsSold={async (vehicleId) => {
                const vehicle = vehicles.find(v => v.id === vehicleId);
                if (vehicle) {
                  await updateVehicle(vehicleId, { status: 'sold', soldAt: new Date().toISOString(), listingStatus: 'sold' });
                }
              }}
              onMarkAsUnsold={async (vehicleId) => {
                await updateVehicle(vehicleId, { status: 'published', soldAt: undefined, listingStatus: 'active' });
              }}
              conversations={(conversations || []).filter(c => c && c.sellerId && currentUser?.email && c.sellerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim())}
              onSellerSendMessage={(conversationId, messageText, _type, _payload) => sendMessage(conversationId, messageText)}
              onMarkConversationAsReadBySeller={(conversationId) => markAsRead(conversationId)}
              typingStatus={typingStatus}
              onUserTyping={(conversationId, _userRole) => toggleTyping(conversationId, true)}
              onMarkMessagesAsRead={(conversationId, _readerRole) => markAsRead(conversationId)}
              onUpdateSellerProfile={async (details) => {
                if (currentUser) {
                  await updateUser(currentUser.email, details);
                }
              }}
              vehicleData={vehicleData}
              onFeatureListing={async (vehicleId) => {
                try {
                  const { authenticatedFetch } = await import('./utils/authenticatedFetch');
                  const response = await authenticatedFetch('/api/vehicles?action=feature', {
                    method: 'POST',
                    body: JSON.stringify({ vehicleId })
                  });

                  const responseText = await response.text();
                  let result: any = {};
                  if (responseText) {
                    try {
                      result = JSON.parse(responseText);
                    } catch (parseError) {
                      console.warn('⚠️ Failed to parse feature response JSON:', parseError);
                      result = {};
                    }
                  }

                  if (!response.ok) {
                    const errorMessage = result?.reason || result?.error || `Failed to feature vehicle (HTTP ${response.status})`;
                    addToast(errorMessage, response.status === 403 ? 'warning' : 'error');
                    return;
                  }

                  if (result?.alreadyFeatured) {
                    addToast('This vehicle is already featured.', 'info');
                    return;
                  }

                  if (result?.success && result.vehicle) {
                    await updateVehicle(vehicleId, result.vehicle);

                    if (typeof result.remainingCredits === 'number') {
                      const sellerEmail = result.vehicle?.sellerEmail || currentUser?.email;
                      const remainingCredits = result.remainingCredits;

                      if (sellerEmail) {
                        // Normalize emails for comparison (critical for production)
                        if (currentUser?.email && currentUser.email.toLowerCase().trim() === sellerEmail.toLowerCase().trim()) {
                          setCurrentUser({
                            ...currentUser,
                            featuredCredits: remainingCredits
                          });
                        }
                        await updateUser(sellerEmail, { featuredCredits: remainingCredits });
                      }

                      addToast(`Featured credits remaining: ${remainingCredits}`, 'info');
                    }
                  } else {
                    addToast('Failed to feature vehicle. Please try again.', 'error');
                  }
                } catch (error) {
                  console.error('❌ Failed to feature vehicle:', error);
                  addToast('Failed to feature vehicle. Please try again.', 'error');
                }
              }}
              onRequestCertification={async (vehicleId) => {
                try {
                  const vehicle = vehicles.find(v => v.id === vehicleId);
                  const sellerEmail = vehicle?.sellerEmail || currentUser?.email;
                  // Normalize emails for comparison (critical for production)
                  const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                  const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;

                  if (!seller) {
                    addToast('Unable to determine the seller for this certification request.', 'error');
                    return;
                  }

                  const planId = (seller.subscriptionPlan || 'free') as SubscriptionPlan;
                  const planDetails = await planService.getPlanDetails(planId);
                  const totalCertifications = planDetails.freeCertifications ?? 0;
                  const usedCertifications = seller.usedCertifications ?? 0;

                  if (totalCertifications <= 0) {
                    addToast(
                      `The ${planDetails.name} plan does not include certification requests. Upgrade your plan to request certifications.`,
                      'warning'
                    );
                    return;
                  }

                  if (usedCertifications >= totalCertifications) {
                    addToast(
                      `You have used all ${totalCertifications} certification requests included in your ${planDetails.name} plan. Upgrade to request more.`,
                      'warning'
                    );
                    return;
                  }

                  const { authenticatedFetch } = await import('./utils/authenticatedFetch');
                  const response = await authenticatedFetch('/api/vehicles?action=certify', {
                    method: 'POST',
                    body: JSON.stringify({ vehicleId })
                  });

                  const responseText = await response.text();
                  let result: any = {};
                  if (responseText) {
                    try {
                      result = JSON.parse(responseText);
                    } catch (parseError) {
                      console.warn('⚠️ Failed to parse certification response JSON:', parseError);
                    }
                  }

                  if (!response.ok) {
                    const errorMessage =
                      result?.reason ||
                      result?.error ||
                      `Failed to submit certification request (HTTP ${response.status})`;
                    addToast(errorMessage, 'error');
                    return;
                  }

                  if (result?.alreadyRequested) {
                    addToast('This vehicle is already pending certification review.', 'info');
                    return;
                  }

                  if (!result?.success || !result?.vehicle) {
                    addToast('Failed to submit certification request. Please try again.', 'error');
                    return;
                  }

                  await updateVehicle(vehicleId, result.vehicle, {
                    successMessage: 'Certification request submitted for review'
                  });
                  const updatedUsedCertifications = typeof result.usedCertifications === 'number'
                    ? result.usedCertifications
                    : usedCertifications + 1;

                  // Reuse normalizedSellerEmail from line 834 (already normalized)
                  setUsers((prevUsers: User[]) =>
                    prevUsers.map((user: User) => {
                      if (!user || !user.email) return user;
                      return user.email.toLowerCase().trim() === normalizedSellerEmail
                        ? { ...user, usedCertifications: updatedUsedCertifications }
                        : user;
                    })
                  );

                  if (currentUser?.email && currentUser.email.toLowerCase().trim() === normalizedSellerEmail) {
                    setCurrentUser({
                      ...currentUser,
                      usedCertifications: updatedUsedCertifications
                    });
                  }

                  await updateUser(seller.email, { usedCertifications: updatedUsedCertifications });

                  if (typeof result.remainingCertifications === 'number') {
                    addToast(
                      `Certification requests remaining this month: ${result.remainingCertifications}`,
                      'info'
                    );
                  }
                } catch (error) {
                  console.error('❌ Failed to certify vehicle:', error);
                  addToast('Failed to submit certification request. Please try again.', 'error');
                }
              }}
              onNavigate={navigate}
              onTestDriveResponse={async (conversationId: string, messageId: number, newStatus: 'confirmed' | 'rejected') => {
                try {
                  // Find the conversation and message
                  const conversation = conversations.find(c => c && c.id === conversationId);
                  if (!conversation) {
                    console.warn('⚠️ Conversation not found for test drive response:', conversationId);
                    return;
                  }

                  const message = conversation.messages?.find(m => m && m.id === messageId);
                  if (!message || message.type !== 'test_drive_request') {
                    console.warn('⚠️ Test drive message not found:', messageId);
                    return;
                  }

                  // Update the message status
                  const updatedMessage: ChatMessage = {
                    ...message,
                    payload: {
                      ...message.payload,
                      status: newStatus as 'pending' | 'accepted' | 'rejected' | 'countered' | 'confirmed'
                    }
                  };

                  // Send response message
                  const responseText = newStatus === 'confirmed' 
                    ? `Test drive confirmed for ${conversation.vehicleName || 'the vehicle'}. We'll contact you shortly.`
                    : `Test drive request declined for ${conversation.vehicleName || 'the vehicle'}.`;

                  await sendMessageWithType(conversationId, responseText, 'text', {
                    originalMessageId: messageId,
                    status: newStatus
                  });

                  // Update conversation in local state
                  setConversations((prev: Conversation[]) =>
                    prev.map((conv: Conversation) =>
                      conv.id === conversationId
                        ? {
                            ...conv,
                            messages: conv.messages?.map((msg: ChatMessage) =>
                              msg.id === messageId ? updatedMessage : msg
                            ) || []
                          }
                        : conv
                    )
                  );

                  addToast(
                    newStatus === 'confirmed' 
                      ? 'Test drive confirmed successfully' 
                      : 'Test drive request declined',
                    'success'
                  );
                } catch (error) {
                  console.error('❌ Failed to respond to test drive request:', error);
                  addToast('Failed to respond to test drive request. Please try again.', 'error');
                }
              }}
              allVehicles={vehicles || []}
              onOfferResponse={onOfferResponse}
              onViewVehicle={selectVehicle}
            />
            </Suspense>
          </DashboardErrorBoundary>
        );

      case ViewEnum.BUYER_DASHBOARD:
        if (isMobileApp && currentUser?.role === 'customer') {
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
              onToggleCompare={(id) => {
                setComparisonList(prev => 
                  prev.includes(id) 
                    ? prev.filter(vId => vId !== id)
                    : [...prev, id]
                );
              }}
              comparisonList={comparisonList}
              onViewSellerProfile={(sellerEmail) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
              onLogout={handleLogout}
            />
          );
        }
        return currentUser?.role === 'customer' ? (
          <BuyerDashboard
            currentUser={currentUser}
            vehicles={vehicles}
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
            onToggleCompare={(id) => {
              setComparisonList(prev => 
                prev.includes(id) 
                  ? prev.filter(vId => vId !== id)
                  : [...prev, id]
              );
            }}
            comparisonList={comparisonList}
            onViewSellerProfile={(sellerEmail) => {
              // Normalize emails for comparison (critical for production)
              const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
              const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
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
        return currentUser?.role === 'admin' ? (
          <AdminPanelErrorBoundary>
            <AdminPanel 
              users={users}
              currentUser={currentUser}
              vehicles={vehicles}
              conversations={conversations}
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
              onLogout={handleLogout}
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
              onUpdatePassword={async (_passwords) => {
                // This would need to be implemented in the API
                return false;
              }}
              onBack={() => goBack(ViewEnum.HOME)}
              addToast={addToast}
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
              if (currentUser) {
                try {
                  // Verify current password by attempting login
                  // This works for both production (bcrypt) and development (plain text)
                  const { login } = await import('./services/userService');
                  const loginResult = await login({ 
                    email: currentUser.email, 
                    password: passwords.current,
                    role: currentUser.role 
                  });
                  
                  if (!loginResult.success) {
                    addToast('Current password is incorrect', 'error');
                    return false;
                  }
                  
                  // Current password is correct, now update to new password
                  // Send plain text password - API will hash it
                  try {
                    await updateUser(currentUser.email, { password: passwords.new });
                    // Success message will be shown by updateUser in AppProvider
                    return true;
                  } catch (updateError) {
                    console.error('Failed to update password:', updateError);
                    // Check if it's a specific error from the API
                    const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
                    if (errorMessage.includes('Server error') || errorMessage.includes('500')) {
                      addToast('Password update failed: Server error. Please try again.', 'error');
                    } else if (errorMessage.includes('Authentication') || errorMessage.includes('401')) {
                      addToast('Password update failed: Authentication expired. Please log in again.', 'error');
                    } else {
                      addToast(`Password update failed: ${errorMessage}`, 'error');
                    }
                    return false;
                  }
                } catch (error) {
                  console.error('Failed to update password:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  addToast(`Password update failed: ${errorMessage}`, 'error');
                  return false;
                }
              }
              return false;
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
        if (isMobileApp && currentUser) {
          return (
            <MobileInbox
              conversations={conversations.filter(c => {
                if (!c || !c.customerId || !currentUser?.email) return false;
                return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
              })}
              onSendMessage={(vehicleId, messageText, type, payload) => {
                const normalizedCustomerEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
                const conversation = normalizedCustomerEmail ? conversations.find(c => {
                  if (!c || !c.customerId) return false;
                  return c.vehicleId === vehicleId && c.customerId.toLowerCase().trim() === normalizedCustomerEmail;
                }) : undefined;
                if (conversation) {
                  sendMessageWithType(conversation.id, messageText, type, payload);
                }
              }}
              onMarkAsRead={markAsRead}
              users={users}
              typingStatus={typingStatus}
              onUserTyping={(conversationId: string, _userRole: 'customer' | 'seller') => {
                toggleTyping(conversationId, true);
              }}
              onMarkMessagesAsRead={markAsRead}
              onFlagContent={(type, id, _reason) => flagContent(type, id)}
              onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                onOfferResponse(conversationId, messageId, response, counterPrice);
              }}
              currentUser={currentUser}
              onNavigate={navigate}
            />
          );
        }
        return currentUser ? (
          <CustomerInbox 
            conversations={conversations.filter(c => {
              if (!c || !c.customerId || !currentUser?.email) return false;
              return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
            })}
            onSendMessage={(vehicleId, messageText, type, payload) => {
              // Only find conversations that belong to the current user
              // Normalize emails for comparison (critical for production)
              const normalizedCustomerEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
              const conversation = normalizedCustomerEmail ? conversations.find(c => {
                if (!c || !c.customerId) return false;
                return c.vehicleId === vehicleId && c.customerId.toLowerCase().trim() === normalizedCustomerEmail;
              }) : undefined;
              if (conversation) {
                // Use sendMessageWithType for both regular and offer messages
                // This ensures proper saving, notifications, and activeChat updates
                sendMessageWithType(conversation.id, messageText, type, payload);
              }
            }}
            onMarkAsRead={markAsRead}
            users={users}
            typingStatus={typingStatus}
            onUserTyping={(conversationId: string, _userRole: 'customer' | 'seller') => {
              toggleTyping(conversationId, true);
            }}
            onMarkMessagesAsRead={markAsRead}
            onFlagContent={(type, id, _reason) => flagContent(type, id)}
            onOfferResponse={(conversationId, messageId, response, counterPrice) => {
              // Handle offer responses using the AppProvider function
              onOfferResponse(conversationId, messageId, response, counterPrice);
            }}
          />
        ) : (
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
              onBack={() => goBack(ViewEnum.HOME)}
              onViewSellerProfile={(sellerEmail) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
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
            onBack={() => goBack(ViewEnum.HOME)}
            onViewSellerProfile={(sellerEmail) => {
              // Normalize emails for comparison (critical for production)
              const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
              const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
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

      case ViewEnum.DEALER_PROFILES:
        if (isMobileApp) {
          return (
            <MobileDealerProfilesPage
              sellers={users.filter(user => user.role === 'seller')}
              vehicles={vehicles}
              onViewProfile={(sellerEmail) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                } else {
                  setPublicProfile({ email: sellerEmail } as any);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
            />
          );
        }
        return (
          <DealerProfiles 
            sellers={users.filter(user => user.role === 'seller')} 
            vehicles={vehicles}
            onViewProfile={(sellerEmail) => {
              setPublicProfile({ email: sellerEmail } as any);
              navigate(ViewEnum.SELLER_PROFILE);
            }} 
          />
        );

      case ViewEnum.PRICING:
        if (isMobileApp) {
          return (
            <MobilePricingPage
              currentUser={currentUser}
              onSelectPlan={async (planId) => {
                if (!currentUser || currentUser.role !== 'seller') return;
                if (planId === 'free') {
                  const updatedUser = { ...currentUser, subscriptionPlan: planId };
                  try {
                    const userService = await import('./services/userService');
                    const savedUser = await userService.updateUser(updatedUser);
                    setUsers(prev => prev.map(u => u.email === currentUser.email ? savedUser : u));
                    setCurrentUser(savedUser);
                    const userJson = JSON.stringify(savedUser);
                    sessionStorage.setItem('currentUser', userJson);
                    localStorage.setItem('reRideCurrentUser', userJson);
                    addToast(`Successfully switched to the Free plan!`, 'success');
                    navigate(ViewEnum.SELLER_DASHBOARD);
                  } catch (error) {
                    console.error('Failed to update plan:', error);
                    addToast('Failed to update plan', 'error');
                  }
                }
              }}
              onNavigate={navigate}
            />
          );
        }
        return (
          <PricingPage 
            currentUser={currentUser}
            onSelectPlan={(planId) => {
              // Handle plan selection
              console.log('Selected plan:', planId);
            }}
          />
        );

      case ViewEnum.SUPPORT:
        if (isMobileApp) {
          return (
            <MobileSupportPage
              currentUser={currentUser}
              onSubmitTicket={(_ticket) => {
                // Handle support ticket submission
                addToast('Support ticket submitted!', 'success');
                navigate(ViewEnum.HOME);
              }}
              onNavigate={navigate}
            />
          );
        }
        return (
          <SupportPage 
            currentUser={currentUser}
            onSubmitTicket={(ticket) => {
              // Handle support ticket submission
              console.log('Support ticket submitted:', ticket);
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

      case ViewEnum.CITY_LANDING:
        if (isMobileApp) {
          return (
            <MobileCityLandingPage
              city={selectedCity || ''}
              vehicles={vehicles}
              onSelectVehicle={selectVehicle}
              onToggleWishlist={toggleWishlist}
              onToggleCompare={toggleCompare}
              wishlist={wishlist}
              comparisonList={comparisonList}
              onViewSellerProfile={(sellerEmail) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
            />
          );
        }
        return (
          <CityLandingPage 
            city={selectedCity}
            vehicles={vehicles}
            onSelectVehicle={selectVehicle}
            onToggleWishlist={toggleWishlist}
            onToggleCompare={toggleCompare}
            wishlist={wishlist}
            comparisonList={comparisonList}
            onViewSellerProfile={(sellerEmail) => {
              // Normalize emails for comparison (critical for production)
              const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
              const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
          />
        );

      case ViewEnum.LOGIN_PORTAL:
      case ViewEnum.CUSTOMER_LOGIN:
      case ViewEnum.SELLER_LOGIN:
        return (
          <AuthenticationErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <UnifiedLogin 
                onLogin={handleLogin}
                onRegister={handleRegister}
                onNavigate={navigate}
                onForgotPassword={() => {
                  setForgotPasswordRole('customer');
                  navigate(ViewEnum.FORGOT_PASSWORD);
                }}
                allowedRoles={['customer', 'seller']}
              />
            </Suspense>
          </AuthenticationErrorBoundary>
        );

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

      case ViewEnum.NEW_CARS_ADMIN_LOGIN:
        return (
          <AuthenticationErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <NewCarsAdminLogin
                onLogin={handleLogin}
                onNavigate={navigate}
              />
            </Suspense>
          </AuthenticationErrorBoundary>
        );

      case ViewEnum.NEW_CARS_ADMIN_PANEL:
        return currentUser?.role === 'admin' ? (
          <Suspense fallback={<LoadingSpinner />}>
            <NewCarsAdmin
              currentUser={currentUser}
              onNavigate={navigate}
            />
          </Suspense>
        ) : (
          <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Denied</h2>
              <p className="text-gray-500 mb-4">Admin login required to manage New Cars.</p>
              <button 
                onClick={() => navigate(ViewEnum.NEW_CARS_ADMIN_LOGIN)}
                className="btn-brand-primary"
              >
                New Cars Admin Login
              </button>
            </div>
          </div>
        );

      case ViewEnum.FORGOT_PASSWORD:
        return (
          <AuthenticationErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <ForgotPassword 
                onResetRequest={(email) => {
                  // Handle password reset request
                  if (process.env.NODE_ENV === 'development') {
                    console.log('Password reset requested for:', email);
                  }
                }}
                onBack={() => goBack(ViewEnum.LOGIN_PORTAL)}
              />
            </Suspense>
          </AuthenticationErrorBoundary>
        );

      case ViewEnum.SELL_CAR:
        if (isMobileApp) {
          return (
            <MobileSellCarPage onNavigate={navigate} />
          );
        }
        return (
          <SellCarPage 
            onNavigate={navigate}
          />
        );

      case ViewEnum.SELL_CAR_ADMIN:
        return (
          <SellCarAdmin 
            onNavigate={navigate}
          />
        );

      default:
        return (
          <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-600 mb-4">Page Not Found</h2>
              <p className="text-gray-500 mb-4">The page you're looking for doesn't exist.</p>
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
  }, [
    currentView, selectedVehicle, vehicles, users, currentUser, comparisonList, 
    wishlist, conversations, recommendations, initialSearchQuery, currentCategory,
    selectedCity, publicSellerProfile, activeChat, faqItems, platformSettings,
    auditLog, supportTickets, vehicleData, notifications, typingStatus,
    navigate, setInitialSearchQuery, setSelectedCategory, selectVehicle,
    setComparisonList, setWishlist, setPublicProfile, addToast, markAsRead,
    toggleTyping, flagContent, updateUser, deleteUser, updateVehicle,
    deleteVehicle, toggleWishlist, toggleCompare, handleLogin, handleRegister,
    onAdminUpdateUser, onUpdateUserPlan, onToggleUserStatus, onToggleVehicleStatus,
    onToggleVehicleFeature, onResolveFlag, onUpdateSettings, onSendBroadcast,
    onExportUsers, onExportVehicles, onExportSales, onUpdateVehicleData,
    onToggleVerifiedStatus, onUpdateSupportTicket, onAddFaq, onUpdateFaq,
    onDeleteFaq, onCertificationApproval, onOfferResponse, addSellerRating,
    sendMessage, setActiveChat, setConversations, setForgotPasswordRole
  ]);

  const handleNotificationClick = React.useCallback((notification: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Notification clicked:', notification);
    }
    
    // Navigate based on notification type
    if (notification.targetType === 'conversation') {
      // Find the conversation
      const conversation = conversations.find(conv => conv.id === notification.targetId);
      if (conversation) {
        // Set the active chat
        setActiveChat(conversation);
        setConversations((prev: Conversation[]) =>
          prev.map((conv: Conversation) =>
            conv.id === conversation.id
              ? {
                  ...conv,
                  isReadBySeller: currentUser?.role === 'seller' ? true : conv.isReadBySeller,
                  isReadByCustomer: currentUser?.role === 'customer' ? true : conv.isReadByCustomer,
                }
              : conv
          )
        );
        
        // Navigate to appropriate dashboard based on user role
        if (currentUser?.role === 'seller') {
          navigate(ViewEnum.SELLER_DASHBOARD);
        } else if (currentUser?.role === 'customer') {
          navigate(ViewEnum.BUYER_DASHBOARD);
        }
      }
    }
  }, [conversations, currentUser, navigate, setActiveChat, setConversations]);

  const persistNotifications = React.useCallback((updated: Notification[]) => {
    try {
      localStorage.setItem('reRideNotifications', JSON.stringify(updated));
    } catch (error) {
      console.warn('Failed to persist notifications:', error);
    }
  }, []);

  const handleMarkNotificationsAsRead = React.useCallback(async (ids: number[]) => {
    if (!ids.length) {
      return;
    }

    const updated = notifications.map(notification =>
      ids.includes(notification.id)
        ? { ...notification, isRead: true }
        : notification
    );

    setNotifications(updated);
    persistNotifications(updated);
    
    // Update in MongoDB (async, don't block)
    try {
      const { updateNotificationInMongoDB } = await import('./services/notificationService');
      ids.forEach(id => {
        updateNotificationInMongoDB(id, { isRead: true }).catch(err => {
          console.warn('Failed to update notification in MongoDB:', err);
        });
      });
    } catch (error) {
      console.warn('Failed to import notification service:', error);
    }
  }, [notifications, persistNotifications, setNotifications]);

  const handleMarkAllNotificationsAsRead = React.useCallback(async () => {
    if (!notifications.length) {
      return;
    }

    const updated = notifications.map(notification => ({
      ...notification,
      isRead: true,
    }));

    setNotifications(updated);
    persistNotifications(updated);
    
    // Update all in MongoDB (async, don't block)
    const { updateNotificationInMongoDB } = await import('./services/notificationService');
    notifications.forEach(notification => {
      if (!notification.isRead) {
        updateNotificationInMongoDB(notification.id, { isRead: true }).catch(err => {
          console.warn('Failed to update notification in MongoDB:', err);
        });
      }
    });
  }, [notifications, persistNotifications, setNotifications]);

  const handleOpenCommandPalette = React.useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, [setIsCommandPaletteOpen]);

  const getPageTitle = React.useCallback(() => {
    switch (currentView) {
      case ViewEnum.HOME:
        return 'Home';
      case ViewEnum.USED_CARS:
        return 'Browse Cars';
      case ViewEnum.RENTAL:
        return 'Rental Vehicles';
      case ViewEnum.DETAIL:
        return selectedVehicle ? selectedVehicle.make + ' ' + selectedVehicle.model : 'Vehicle Details';
      case ViewEnum.SELLER_DASHBOARD:
        return 'My Dashboard';
      case ViewEnum.BUYER_DASHBOARD:
        return 'My Account';
      case ViewEnum.ADMIN_PANEL:
        return 'Admin Panel';
      case ViewEnum.LOGIN_PORTAL:
        return 'Login';
      case ViewEnum.CUSTOMER_LOGIN:
        return 'Login';
      case ViewEnum.SELLER_LOGIN:
        return 'Seller Login';
      case ViewEnum.ADMIN_LOGIN:
        return 'Admin Login';
      case ViewEnum.NEW_CARS_ADMIN_LOGIN:
        return 'New Cars Admin Login';
      case ViewEnum.NEW_CARS_ADMIN_PANEL:
        return 'New Cars Admin';
      case ViewEnum.FORGOT_PASSWORD:
        return 'Reset Password';
      case ViewEnum.SUPPORT:
        return 'Support';
      case ViewEnum.FAQ:
        return 'FAQ';
      case ViewEnum.CITY_LANDING:
        return selectedCity || 'City';
      case ViewEnum.SELLER_PROFILE:
        return publicSellerProfile?.name || 'Seller Profile';
      default:
        return 'ReRide';
    }
  }, [currentView, selectedVehicle, selectedCity, publicSellerProfile]);

  // Render Mobile App Layout
  if (isMobileApp) {
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 Rendering Mobile App UI for view:', currentView);
    }
    
    // Check if we're on a dashboard view
    const isDashboardView = [
      ViewEnum.SELLER_DASHBOARD, 
      ViewEnum.BUYER_DASHBOARD, 
      ViewEnum.ADMIN_PANEL
    ].includes(currentView);

    if (isDashboardView && currentUser) {
      // For admin users, show the full AdminPanel (which is responsive)
      if (currentUser.role === 'admin') {
        return (
          <AdminPanel 
            users={users}
            currentUser={currentUser}
            vehicles={vehicles}
            conversations={conversations}
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
            onLogout={handleLogout}
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
        );
      }
      
      // For seller users, show MobileDashboard (seller-focused)
      if (currentUser.role === 'seller') {
        return (
          <>
          <MobileLayout
            showHeader={false}
            showBottomNav={true}
            headerTitle={getPageTitle()}
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={navigate}
            currentView={currentView}
            wishlistCount={wishlist.length}
            inboxCount={conversations.filter(c => {
              if (!c || !c.sellerId || !currentUser?.email || c.isReadBySeller) return false;
              return c.sellerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
            }).length}
          >
            <MobileDashboard
              currentUser={currentUser}
              userVehicles={enrichVehiclesWithSellerInfo(
                (vehicles || []).filter(v => {
                  if (!v || !v.sellerEmail || !currentUser?.email) return false;
                  return v.sellerEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
                }), 
                users || []
              )}
              conversations={(conversations || []).filter(c => c && c.sellerId && currentUser?.email && c.sellerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim())}
              onNavigate={navigate}
              onEditVehicle={(vehicle) => {
                // Handle edit vehicle
                console.log('Edit vehicle:', vehicle);
              }}
              onDeleteVehicle={(vehicleId) => {
                // Handle delete vehicle
                console.log('Delete vehicle:', vehicleId);
              }}
              onMarkAsSold={(vehicleId) => {
                // Handle mark as sold
                console.log('Mark as sold:', vehicleId);
              }}
              onFeatureListing={(vehicleId) => {
                // Handle feature listing
                console.log('Feature listing:', vehicleId);
              }}
              onSendMessage={sendMessage}
              onMarkConversationAsRead={markAsRead}
              onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                onOfferResponse(conversationId, parseInt(messageId), response as "accepted" | "rejected" | "countered", counterPrice);
              }}
              typingStatus={typingStatus}
              onUserTyping={(conversationId, _userRole) => {
                toggleTyping(conversationId, true);
              }}
              onMarkMessagesAsRead={(conversationId, _readerRole) => {
                markAsRead(conversationId);
              }}
              onFlagContent={flagContent}
              onLogout={handleLogout}
              onViewVehicle={selectVehicle}
              onAddVehicle={async (vehicleData, isFeaturing = false) => {
              try {
                if (process.env.NODE_ENV === 'development') {
                console.log('🚀 Mobile Add Vehicle called with:', vehicleData);
              }
                
                // Set listingExpiresAt based on subscription plan expiry date
                let listingExpiresAt: string | undefined;
                if (currentUser.subscriptionPlan === 'premium' && currentUser.planExpiryDate) {
                  listingExpiresAt = currentUser.planExpiryDate;
                } else if (currentUser.subscriptionPlan !== 'premium') {
                  const expiryDate = new Date();
                  expiryDate.setDate(expiryDate.getDate() + 30);
                  listingExpiresAt = expiryDate.toISOString();
                }
                
                const { addVehicle } = await import('./services/vehicleService');
                const vehicleToAdd = {
                  ...vehicleData,
                  id: Date.now() + Math.floor(Math.random() * 1000),
                  sellerEmail: currentUser.email,
                  averageRating: 0,
                  ratingCount: 0,
                  isFeatured: isFeaturing,
                  status: 'published',
                  createdAt: new Date().toISOString(),
                  listingExpiresAt,
                } as Vehicle;
                
                const newVehicle = await addVehicle(vehicleToAdd);
                if (process.env.NODE_ENV === 'development') {
                  console.log('✅ Vehicle added successfully:', newVehicle);
                }
                
                // Update local state
                setVehicles(prev => [...prev, newVehicle]);
                addToast('Vehicle added successfully!', 'success');
              } catch (error) {
                console.error('❌ Failed to add vehicle:', error);
                addToast('Failed to add vehicle. Please try again.', 'error');
              }
            }}
            onUpdateVehicle={async (vehicleData) => {
              try {
                if (process.env.NODE_ENV === 'development') {
                  console.log('🚀 Mobile Update Vehicle called with:', vehicleData);
                }
                
                // Use the updateVehicle from useApp hook which automatically updates state
                await updateVehicle(vehicleData.id, vehicleData);
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('✅ Vehicle updated successfully');
                }
                // Toast is shown by updateVehicle function
              } catch (error) {
                console.error('❌ Failed to update vehicle:', error);
                addToast('Failed to update vehicle. Please try again.', 'error');
              }
            }}
            vehicleData={vehicleData}
            onUpdateProfile={async (profileData: Partial<User>) => {
              try {
                await updateUser(currentUser.email || currentUser.id?.toString() || '', profileData);
                // Update current user state
                if (currentUser) {
                  setCurrentUser({ ...currentUser, ...profileData } as User);
                }
                addToast('Profile updated successfully!', 'success');
              } catch (error) {
                console.error('Failed to update profile:', error);
                addToast('Failed to update profile. Please try again.', 'error');
                throw error;
              }
            }}
            notifications={notifications.filter(n => n.recipientEmail === currentUser.email)}
            onNotificationClick={handleNotificationClick}
            onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
          />
        </MobileLayout>
        
        {/* Mobile Global Components */}
        <MobileSearch 
            onNavigate={navigate}
            onSearch={(query) => {
              setInitialSearchQuery(query);
              navigate(ViewEnum.USED_CARS);
            }}
          />
          <ToastContainer 
            toasts={toasts} 
            onRemove={removeToast} 
          />
          {currentUser && activeChat && (
            <ChatErrorBoundary>
              <Suspense fallback={<MinimalLoader />}>
                <ChatWidget
                  conversation={activeChat}
                  currentUserRole={currentUser.role as 'customer' | 'seller'}
                  otherUserName={(() => {
                    // Check role explicitly to determine other user name
                    // ChatWidget is used for both customers and sellers
                    const isCustomer = (currentUser.role as string) === 'customer';
                    if (isCustomer) {
                      const seller = users.find(u => u && u.email && u.email.toLowerCase().trim() === activeChat.sellerId?.toLowerCase().trim());
                      return seller?.name || seller?.dealershipName || 'Seller';
                    } else {
                      return activeChat.customerName;
                    }
                  })()}
                  onClose={() => setActiveChat(null)}
                  onSendMessage={(messageText, type, payload) => {
                    // Use sendMessageWithType if type or payload is provided (for offers, etc.)
                    if (type || payload) {
                      sendMessageWithType(activeChat.id, messageText, type, payload);
                    } else {
                      sendMessage(activeChat.id, messageText);
                    }
                  }}
                  typingStatus={typingStatus}
                  onUserTyping={(conversationId, _userRole) => {
                    toggleTyping(conversationId, true);
                  }}
                  onMarkMessagesAsRead={(conversationId, _readerRole) => {
                    markAsRead(conversationId);
                  }}
                  onFlagContent={(type, id, reason) => {
                    flagContent(type, id, reason);
                  }}
                  onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                    if (process.env.NODE_ENV === 'development') {
                      console.log('🔧 DashboardMessages onOfferResponse called:', { conversationId, messageId, response, counterPrice });
                    }
                    onOfferResponse(conversationId, messageId, response, counterPrice);
                    addToast(`Offer ${response}`, 'success');
                  }}
                />
              </Suspense>
            </ChatErrorBoundary>
          )}
        </>
      );
      }
      
      // For customer users, show MobileBuyerDashboard (buyer-focused)
      if (currentUser.role === 'customer') {
        return (
          <>
          <MobileLayout
            showHeader={false}
            showBottomNav={true}
            headerTitle={getPageTitle()}
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={navigate}
            currentView={currentView}
            wishlistCount={wishlist.length}
            inboxCount={conversations.filter(c => {
              if (!c || !c.customerId || !currentUser?.email || c.isReadByCustomer) return false;
              return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
            }).length}
          >
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
              onToggleCompare={(id) => {
                setComparisonList(prev => 
                  prev.includes(id) 
                    ? prev.filter(vId => vId !== id)
                    : [...prev, id]
                );
              }}
              comparisonList={comparisonList}
              onViewSellerProfile={(sellerEmail) => {
                const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                if (seller) {
                  setPublicProfile(seller);
                  navigate(ViewEnum.SELLER_PROFILE);
                }
              }}
              onLogout={handleLogout}
            />
          </MobileLayout>
          
          {/* Mobile Global Components */}
          <MobileSearch 
              onNavigate={navigate}
              onSearch={(query) => {
                setInitialSearchQuery(query);
                navigate(ViewEnum.USED_CARS);
              }}
            />
            <ToastContainer 
              toasts={toasts} 
              onRemove={removeToast} 
            />
            {currentUser && activeChat && (
              <ChatErrorBoundary>
                <Suspense fallback={<MinimalLoader />}>
                  <ChatWidget
                    conversation={activeChat}
                    currentUserRole={currentUser.role as 'customer' | 'seller'}
                    otherUserName={(() => {
                      const seller = users.find(u => u && u.email && u.email.toLowerCase().trim() === activeChat.sellerId?.toLowerCase().trim());
                      return seller?.name || seller?.dealershipName || 'Seller';
                    })()}
                    onClose={() => setActiveChat(null)}
                    onSendMessage={(messageText, _type, _payload) => {
                      sendMessage(activeChat.id, messageText);
                    }}
                    typingStatus={typingStatus}
                    onUserTyping={(conversationId, _userRole) => {
                      toggleTyping(conversationId, true);
                    }}
                    onMarkMessagesAsRead={(conversationId, _readerRole) => {
                      markAsRead(conversationId);
                    }}
                    onFlagContent={(type, id, _reason) => {
                      flagContent(type, id);
                    }}
                    onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                      if (process.env.NODE_ENV === 'development') {
                        console.log('🔧 DashboardMessages onOfferResponse called:', { conversationId, messageId, response, counterPrice });
                      }
                      onOfferResponse(conversationId, messageId, response, counterPrice);
                      addToast(`Offer ${response}`, 'success');
                    }}
                  />
                </Suspense>
              </ChatErrorBoundary>
            )}
          </>
        );
      }
    }

    // For ALL other views (Home, Browse, Detail, etc.), show mobile UI using MobileLayout
    // Hide header for HOME view since it has its own hero section
    const shouldHideHeader = currentView === ViewEnum.HOME;
    return (
      <>
        {/* Mobile Feature Managers */}
        <MobilePushNotificationManager
          notifications={notifications}
          onNotificationClick={handleNotificationClick}
        />
        <ShareTargetHandler
          onNavigate={navigate}
        />
        <OfflineIndicator />
        
        <MobileLayout
          showHeader={!shouldHideHeader}
          showBottomNav={true}
          headerTitle={getPageTitle()}
          showBack={currentView === ViewEnum.DETAIL}
          onBack={() => navigate(ViewEnum.USED_CARS)}
        currentView={currentView}
        onNavigate={navigate}
        currentUser={currentUser}
        onLogout={handleLogout}
        wishlistCount={wishlist.length}
        inboxCount={conversations.filter(c => {
          if (!c || !c.customerId || !currentUser?.email || c.isReadByCustomer) return false;
          return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
        }).length}
      >
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <PageTransition currentView={currentView}>
              {renderView()}
            </PageTransition>
          </Suspense>
        </ErrorBoundary>
        
        {/* Mobile Global Components */}
        <MobileSearch 
          onNavigate={navigate}
          onSearch={(query) => {
            setInitialSearchQuery(query);
            navigate(ViewEnum.USED_CARS);
          }}
        />
        <ToastContainer 
          toasts={toasts} 
          onRemove={removeToast} 
        />
        {currentUser && activeChat && (
          <ChatErrorBoundary>
            <Suspense fallback={<MinimalLoader />}>
              <ChatWidget
                conversation={activeChat}
                currentUserRole={currentUser.role as 'customer' | 'seller'}
                otherUserName={(() => {
                  if (currentUser?.role === 'customer') {
                    const seller = users.find(u => u && u.email && u.email.toLowerCase().trim() === activeChat.sellerId?.toLowerCase().trim());
                    return seller?.name || seller?.dealershipName || 'Seller';
                  } else {
                    return activeChat.customerName;
                  }
                })()}
                onClose={() => setActiveChat(null)}
                onSendMessage={(messageText, _type, _payload) => {
                  sendMessage(activeChat.id, messageText);
                }}
                typingStatus={typingStatus}
                onUserTyping={(conversationId, _userRole) => {
                  toggleTyping(conversationId, true);
                }}
                onMarkMessagesAsRead={(conversationId, _readerRole) => {
                  markAsRead(conversationId);
                }}
                onFlagContent={(type, id, _reason) => {
                  flagContent(type, id);
                }}
                onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                  console.log('🔧 DashboardMessages onOfferResponse called:', { conversationId, messageId, response, counterPrice });
                  onOfferResponse(conversationId, messageId, response, counterPrice);
                  addToast(`Offer ${response}`, 'success');
                }}
              />
            </Suspense>
          </ChatErrorBoundary>
        )}
        </MobileLayout>
      </>
    );
  }
  
  // Render Desktop/Website Layout
  return (
    <>
      {/* Mobile Feature Managers (also work on desktop) */}
      <MobilePushNotificationManager
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
      />
      <ShareTargetHandler
        onNavigate={navigate}
      />
      <OfflineIndicator />
      <div className="min-h-screen bg-gray-50">
        <Header 
          onNavigate={navigate}
          currentUser={currentUser}
          onLogout={handleLogout}
          compareCount={comparisonList.length}
          wishlistCount={wishlist.length}
          inboxCount={conversations.filter(c => !c.isReadByCustomer).length}
          notifications={notifications.filter(n => n.recipientEmail === currentUser?.email)}
          onNotificationClick={handleNotificationClick}
          onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
          onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
          onOpenCommandPalette={handleOpenCommandPalette}
          userLocation={userLocation}
          onLocationChange={setUserLocation}
          addToast={addToast}
          allVehicles={vehicles}
        />
        <main id="main-content" className="min-h-[calc(100vh-140px)]" tabIndex={-1}>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <PageTransition currentView={currentView}>
                {renderView()}
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer onNavigate={navigate} />
        
        {/* Desktop Global Components */}
        <PWAInstallPrompt />
        <ToastContainer 
          toasts={toasts} 
          onRemove={removeToast} 
        />
        <Suspense fallback={<MinimalLoader />}>
          <CommandPalette 
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onNavigate={navigate}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        </Suspense>
        {/* Support Chat Widget - Always available */}
        <Suspense fallback={null}>
          <SupportChatWidget
            currentUser={currentUser}
          />
        </Suspense>
        {currentUser && activeChat && (
          <Suspense fallback={<MinimalLoader />}>
            <ChatWidget
            conversation={activeChat}
            currentUserRole={currentUser.role as 'customer' | 'seller'}
            otherUserName={currentUser?.role === 'customer' ? 
              (users.find(u => u && u.email && u.email.toLowerCase().trim() === activeChat.sellerId?.toLowerCase().trim())?.name || 
               users.find(u => u && u.email && u.email.toLowerCase().trim() === activeChat.sellerId?.toLowerCase().trim())?.dealershipName || 
               'Seller') : 
              activeChat.customerName}
            onClose={() => setActiveChat(null)}
            onSendMessage={(messageText, _type, _payload) => {
              sendMessage(activeChat.id, messageText);
            }}
            typingStatus={typingStatus}
            onUserTyping={(conversationId, _userRole) => {
              toggleTyping(conversationId, true);
            }}
            onMarkMessagesAsRead={(conversationId, _readerRole) => {
              markAsRead(conversationId);
            }}
            onFlagContent={(type, id, _reason) => {
              flagContent(type, id);
            }}
              onOfferResponse={(conversationId, messageId, response, counterPrice) => {
              console.log('🔧 DashboardMessages onOfferResponse called:', { conversationId, messageId, response, counterPrice });
              onOfferResponse(conversationId, messageId, response, counterPrice);
              addToast(`Offer ${response}`, 'success');
            }}
            />
          </Suspense>
        )}
      </div>
    </>
  );
});

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;

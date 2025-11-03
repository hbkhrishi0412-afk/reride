import React, { Suspense, useEffect } from 'react';
import { AppProvider, useApp } from './components/AppProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { 
  VehicleListErrorBoundary, 
  ChatErrorBoundary, 
  DashboardErrorBoundary, 
  AdminPanelErrorBoundary
} from './components/ErrorBoundaries';
import Header from './components/Header';
import MobileHeader from './components/MobileHeader';
import MobileBottomNav from './components/MobileBottomNav';
import MobileDashboard from './components/MobileDashboard';
import MobileSearch from './components/MobileSearch';
import Footer from './components/Footer';
import ToastContainer from './components/ToastContainer';
import CommandPalette from './components/CommandPalette';
import { ChatWidget } from './components/ChatWidget';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import useIsMobileApp from './hooks/useIsMobileApp';
import { View as ViewEnum, Vehicle } from './types';
import { enrichVehiclesWithSellerInfo } from './utils/vehicleEnrichment';

// Simple loading component
const LoadingSpinner: React.FC = () => (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
            <span className="text-xl font-semibold text-gray-600">Loading...</span>
        </div>
    </div>
);

// Lazy-loaded components with preloading
const Home = React.lazy(() => import('./components/Home'));
const VehicleList = React.lazy(() => import('./components/VehicleList'));
const VehicleDetail = React.lazy(() => import('./components/VehicleDetail'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
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

// Preload critical components
const preloadCriticalComponents = () => {
  // Preload components that are likely to be visited next
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      import('./components/VehicleList');
      import('./components/VehicleDetail');
    }, 1000);
  }
};

const AppContent: React.FC = React.memo(() => {
  // Detect if running as mobile app (standalone/installed PWA)
  const { isMobileApp, isMobile } = useIsMobileApp();
  
  // Preload critical components after initial render
  React.useEffect(() => {
    preloadCriticalComponents();
  }, []);
  
  const { 
    currentView, 
    navigate, 
    currentUser, 
    handleLogout, 
    comparisonList, 
    wishlist, 
    notifications,
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
    vehicleData,
    faqItems,
    platformSettings,
    auditLog,
    supportTickets,
    selectedCategory: currentCategory,
    initialSearchQuery,
    selectedCity,
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
  } = useApp();

  // Debug logging (after destructuring)
  console.log('🔧 AppContent Debug:', {
    isMobileApp,
    isMobile,
    currentView,
    userAgent: navigator.userAgent,
    windowWidth: window.innerWidth,
    displayMode: window.matchMedia('(display-mode: standalone)').matches
  });
  
  // Redirect logged-in users to their appropriate dashboard
  useEffect(() => {
    if (currentUser && currentView === ViewEnum.HOME) {
      console.log('🔄 User is logged in, redirecting to appropriate dashboard:', currentUser.role);
      switch (currentUser.role) {
        case 'customer':
          navigate(ViewEnum.BUYER_DASHBOARD);
          break;
        case 'seller':
          navigate(ViewEnum.SELLER_DASHBOARD);
          break;
        case 'admin':
          navigate(ViewEnum.ADMIN_PANEL);
          break;
        default:
          // Keep on home page for other roles
          break;
      }
    }
  }, [currentUser, currentView, navigate]);

  // Recover vehicle from sessionStorage on mount
  useEffect(() => {
    if (!selectedVehicle && currentView === ViewEnum.DETAIL) {
      try {
        const storedVehicle = sessionStorage.getItem('selectedVehicle');
        if (storedVehicle) {
          const vehicleToShow = JSON.parse(storedVehicle);
          console.log('🔧 Recovered vehicle from sessionStorage:', vehicleToShow?.id, vehicleToShow?.make, vehicleToShow?.model);
          setSelectedVehicle(vehicleToShow);
        }
      } catch (error) {
        console.warn('🔧 Failed to recover vehicle from sessionStorage:', error);
      }
    }
  }, [currentView, selectedVehicle]);


  const renderView = React.useCallback(() => {
    switch (currentView) {
      case ViewEnum.HOME:
        return (
          <Home 
            onSearch={(query) => {
              setInitialSearchQuery(query);
              navigate(ViewEnum.USED_CARS);
            }}
            onSelectCategory={setSelectedCategory}
            featuredVehicles={vehicles.slice(0, 6)}
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
              const seller = users.find(u => u.email === sellerEmail);
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
            recommendations={recommendations}
            allVehicles={vehicles}
            onNavigate={navigate}
          />
        );

      case ViewEnum.USED_CARS:
        // Filter vehicles by selectedCity if one is selected
        const filteredVehicles = selectedCity 
          ? vehicles.filter(v => v.city === selectedCity && v.status === 'published')
          : vehicles.filter(v => v.status === 'published');
        
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
                const seller = users.find(u => u.email === sellerEmail);
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

      case ViewEnum.DETAIL:
        return selectedVehicle ? (
          <VehicleDetail
            vehicle={selectedVehicle}
            onBack={() => navigate(ViewEnum.USED_CARS)}
            comparisonList={comparisonList}
            onToggleCompare={toggleCompare}
            onAddSellerRating={addSellerRating}
            wishlist={wishlist}
            onToggleWishlist={toggleWishlist}
            currentUser={currentUser}
            onFlagContent={(type, id, _reason) => flagContent(type, id)}
            users={users}
            onViewSellerProfile={(sellerEmail: string) => {
              const seller = users.find(u => u.email === sellerEmail);
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
            onStartChat={(vehicle) => {
              // Start chat with seller
              if (!currentUser) {
                addToast('Please login to start a chat', 'info');
                navigate(ViewEnum.LOGIN_PORTAL);
                return;
              }
              
              // Find or create conversation
              let conversation = conversations.find(c => 
                c.vehicleId === vehicle.id && 
                c.customerId === currentUser.email
              );
              
              if (!conversation) {
                // Create new conversation
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
                
                // Add to conversations
                setConversations([...conversations, newConversation]);
                conversation = newConversation;
              }
              
              // Set active chat to open the chat widget
              setActiveChat(conversation);
              addToast('Chat started with seller', 'success');
            }}
            recommendations={recommendations}
            onSelectVehicle={selectVehicle}
          />
        ) : (
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

      case ViewEnum.NEW_CARS:
        return (
          <NewCars />
        );

      case ViewEnum.COMPARISON:
        return (
          <Comparison 
            vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => comparisonList.includes(v.id)), users)}
            onBack={() => navigate(ViewEnum.USED_CARS)}
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
              const seller = users.find(u => u.email === sellerEmail);
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
        return currentUser?.role === 'seller' ? (
          <DashboardErrorBoundary>
            <Dashboard
              seller={currentUser}
              sellerVehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => v.sellerEmail === currentUser.email), users)}
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
                  addToast('Vehicle added successfully', 'success');
                } catch (error) {
                  console.error('❌ Failed to add vehicle:', error);
                  addToast('Failed to add vehicle', 'error');
                }
              }}
              onAddMultipleVehicles={async (vehiclesData) => {
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
                  const { addVehicle } = await import('./services/vehicleService');
                  const results = await Promise.all(newVehicles.map(vehicle => addVehicle(vehicle)));
                  
                  // Update local state
                  setVehicles(prev => [...prev, ...results]);
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
              conversations={conversations}
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
                  const response = await fetch('/api/vehicles?action=feature', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vehicleId })
                  });
                  if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                      await updateVehicle(vehicleId, result.vehicle);
                    }
                  }
                } catch (error) {
                  console.error('❌ Failed to feature vehicle:', error);
                }
              }}
              onRequestCertification={async (vehicleId) => {
                try {
                  const response = await fetch('/api/vehicles?action=certify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vehicleId })
                  });
                  if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                      await updateVehicle(vehicleId, result.vehicle);
                    }
                  }
                } catch (error) {
                  console.error('❌ Failed to certify vehicle:', error);
                }
              }}
              onNavigate={navigate}
              onTestDriveResponse={() => {}}
              allVehicles={vehicles}
              onOfferResponse={() => {}}
            />
          </DashboardErrorBoundary>
        ) : (
          <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Denied</h2>
              <p className="text-gray-500 mb-4">You need to be logged in as a seller to access this page.</p>
              <button 
                onClick={() => navigate(ViewEnum.SELLER_LOGIN)}
                className="btn-brand-primary"
              >
                Login as Seller
              </button>
            </div>
          </div>
        );

      case ViewEnum.BUYER_DASHBOARD:
        return currentUser?.role === 'customer' ? (
          <BuyerDashboard
            currentUser={currentUser}
            vehicles={vehicles}
            wishlist={wishlist}
            conversations={conversations}
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
              const seller = users.find(u => u.email === sellerEmail);
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
              onExportVehicles={onExportVehicles}
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
                  // Check if we're in production (using API) or development (localStorage)
                  const isDevelopment = import.meta.env.DEV || 
                                       window.location.hostname === 'localhost' || 
                                       window.location.hostname === '127.0.0.1' ||
                                       window.location.hostname.includes('localhost') ||
                                       window.location.hostname.includes('127.0.0.1');
                  
                  let passwordToStore: string;
                  
                  if (isDevelopment) {
                    // Development: store plain text for localStorage
                    passwordToStore = passwords.new;
                  } else {
                    // Production: send plain text password to API, let API hash it
                    // This ensures consistent hashing and better security
                    passwordToStore = passwords.new;
                  }
                  
                  // Update password (API will hash it in production mode)
                  await updateUser(currentUser.email, { password: passwordToStore });
                  addToast('Password updated successfully', 'success');
                  return true;
                } catch (error) {
                  console.error('Failed to update password:', error);
                  addToast('Failed to update password', 'error');
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
        return currentUser ? (
          <CustomerInbox 
            conversations={conversations}
            onSendMessage={(vehicleId, messageText, type, payload) => {
              const conversation = conversations.find(c => c.vehicleId === vehicleId);
              if (conversation) {
                // Handle offer messages with proper structure
                if (type === 'offer' && payload) {
                  setConversations(prev => {
                    const updated = prev.map(conv => 
                      conv.id === conversation.id ? {
                        ...conv,
                        messages: [...conv.messages, {
                          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                          sender: 'user' as const,
                          text: messageText,
                          timestamp: new Date().toISOString(),
                          isRead: false,
                          type: 'offer' as const,
                          payload: payload
                        }],
                        lastMessageAt: new Date().toISOString()
                      } : conv
                    );
                    return updated;
                  });
                } else {
                  // Handle regular text messages
                  sendMessage(conversation.id, messageText);
                }
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
        return publicSellerProfile ? (
          <SellerProfilePage 
            seller={publicSellerProfile}
            vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => v.sellerEmail === publicSellerProfile?.email), users)}
            onSelectVehicle={selectVehicle}
            comparisonList={comparisonList}
            onToggleCompare={toggleCompare}
            wishlist={wishlist}
            onToggleWishlist={toggleWishlist}
            onBack={() => navigate(ViewEnum.HOME)}
            onViewSellerProfile={(sellerEmail) => {
              const seller = users.find(u => u.email === sellerEmail);
              if (seller) {
                setPublicProfile(seller);
                navigate(ViewEnum.SELLER_PROFILE);
              }
            }}
          />
        ) : (
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
        return (
          <DealerProfiles 
            sellers={users.filter(user => user.role === 'seller')} 
            onViewProfile={(sellerEmail) => {
              setPublicProfile({ email: sellerEmail } as any);
              navigate(ViewEnum.SELLER_PROFILE);
            }} 
          />
        );

      case ViewEnum.PRICING:
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
        return (
          <FAQPage 
            faqItems={faqItems}
          />
        );

      case ViewEnum.CITY_LANDING:
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
              const seller = users.find(u => u.email === sellerEmail);
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
        );

      case ViewEnum.ADMIN_LOGIN:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <AdminLogin
              onLogin={handleLogin}
              onNavigate={navigate}
            />
          </Suspense>
        );

      case ViewEnum.NEW_CARS_ADMIN_LOGIN:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <NewCarsAdminLogin
              onLogin={handleLogin}
              onNavigate={navigate}
            />
          </Suspense>
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
          <ForgotPassword 
            onResetRequest={(email) => {
              // Handle password reset request
              console.log('Password reset requested for:', email);
            }}
            onBack={() => navigate(ViewEnum.LOGIN_PORTAL)}
          />
        );

      case ViewEnum.SELL_CAR:
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
    console.log('Notification clicked:', notification);
    
    // Navigate based on notification type
    if (notification.targetType === 'conversation') {
      // Find the conversation
      const conversation = conversations.find(conv => conv.id === notification.targetId);
      if (conversation) {
        // Set the active chat
        setActiveChat(conversation);
        
        // Navigate to appropriate dashboard based on user role
        if (currentUser?.role === 'seller') {
          navigate(ViewEnum.SELLER_DASHBOARD);
        } else if (currentUser?.role === 'customer') {
          navigate(ViewEnum.BUYER_DASHBOARD);
        }
      }
    }
  }, [conversations, currentUser, navigate, setActiveChat]);

  const handleMarkNotificationsAsRead = React.useCallback((ids: number[]) => {
    // Handle marking notifications as read
    console.log('Mark notifications as read:', ids);
  }, []);

  const handleMarkAllNotificationsAsRead = React.useCallback(() => {
    // Handle marking all notifications as read
    console.log('Mark all notifications as read');
  }, []);

  const handleOpenCommandPalette = React.useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, [setIsCommandPaletteOpen]);

  const getPageTitle = React.useCallback(() => {
    switch (currentView) {
      case ViewEnum.HOME:
        return 'Home';
      case ViewEnum.USED_CARS:
        return 'Browse Cars';
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
    console.log('📱 Rendering Mobile App UI for view:', currentView);
    
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
            onExportVehicles={onExportVehicles}
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
      
      // For seller/customer users, show MobileDashboard
      return (
        <div className="min-h-screen bg-gray-50">
          <MobileDashboard
            currentUser={currentUser}
            userVehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => v.sellerEmail === currentUser.email), users)}
            conversations={conversations}
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
            onAddVehicle={async (vehicleData, isFeaturing = false) => {
              try {
                console.log('🚀 Mobile Add Vehicle called with:', vehicleData);
                const { addVehicle } = await import('./services/vehicleService');
                const vehicleToAdd = {
                  ...vehicleData,
                  id: Date.now() + Math.floor(Math.random() * 1000),
                  averageRating: 0,
                  ratingCount: 0,
                  isFeatured: isFeaturing,
                  status: 'published'
                } as Vehicle;
                
                const newVehicle = await addVehicle(vehicleToAdd);
                console.log('✅ Vehicle added successfully:', newVehicle);
                addToast('Vehicle added successfully!', 'success');
              } catch (error) {
                console.error('❌ Failed to add vehicle:', error);
                addToast('Failed to add vehicle. Please try again.', 'error');
              }
            }}
            onUpdateVehicle={async (vehicleData) => {
              try {
                console.log('🚀 Mobile Update Vehicle called with:', vehicleData);
                const { updateVehicle } = await import('./services/vehicleService');
                const updatedVehicle = await updateVehicle(vehicleData);
                console.log('✅ Vehicle updated successfully:', updatedVehicle);
                addToast('Vehicle updated successfully!', 'success');
              } catch (error) {
                console.error('❌ Failed to update vehicle:', error);
                addToast('Failed to update vehicle. Please try again.', 'error');
              }
            }}
            vehicleData={vehicleData}
          />
        </div>
      );
    }

    // For ALL other views (Home, Browse, Detail, etc.), show mobile UI
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader
          onNavigate={navigate}
          currentUser={currentUser}
          onLogout={handleLogout}
          title={getPageTitle()}
          showBack={currentView === ViewEnum.DETAIL}
          onBack={() => navigate(ViewEnum.USED_CARS)}
        />
        
        <main className="mobile-app-content bg-gray-50 mobile-page-transition">
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              {renderView()}
            </Suspense>
          </ErrorBoundary>
        </main>
        
        <MobileBottomNav
          currentView={currentView}
          onNavigate={navigate}
          currentUser={currentUser}
          wishlistCount={wishlist.length}
          inboxCount={conversations.filter(c => !c.isReadByCustomer).length}
        />
        
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
            <ChatWidget
              conversation={activeChat}
              currentUserRole={currentUser.role as 'customer' | 'seller'}
              otherUserName={currentUser?.role === 'customer' ? activeChat.sellerId : activeChat.customerName}
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
          </ChatErrorBoundary>
        )}
      </div>
    );
  }
  
  // Render Desktop/Website Layout
  return (
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
      <main className="min-h-[calc(100vh-140px)]">
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            {renderView()}
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
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={navigate}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      {currentUser && activeChat && (
        <ChatWidget
          conversation={activeChat}
          currentUserRole={currentUser.role as 'customer' | 'seller'}
          otherUserName={currentUser?.role === 'customer' ? activeChat.sellerId : activeChat.customerName}
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
      )}
    </div>
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

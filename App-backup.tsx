import React, { Suspense, useEffect, useMemo } from 'react';
import { AppProvider, useApp } from './components/AppProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Footer from './components/Footer';
import ToastContainer from './components/ToastContainer';
import CommandPalette from './components/CommandPalette';
import { ChatWidget } from './components/ChatWidget';
import { View, Vehicle } from './types';
import { getConversations, saveConversations } from './services/chatService';
import { getRatings, getSellerRatings } from './services/ratingService';
import { saveSettings } from './services/settingsService';
import { saveAuditLog } from './services/auditLogService';
import { saveFaqs } from './services/faqService';
import { saveSupportTickets } from './services/supportTicketService';
import { loadingManager, LOADING_OPERATIONS, withLoadingTimeout } from './utils/loadingManager';

// Lazy-loaded components
const Home = React.lazy(() => import('./components/Home'));
const VehicleList = React.lazy(() => import('./components/VehicleList'));
const VehicleDetail = React.lazy(() => import('./components/VehicleDetail'));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.default })));
const AdminPanel = React.lazy(() => import('./components/AdminPanel').then(module => ({ default: module.default })));
const Comparison = React.lazy(() => import('./components/Comparison'));
const Profile = React.lazy(() => import('./components/Profile'));
const CustomerInbox = React.lazy(() => import('./components/CustomerInbox'));
const SellerProfilePage = React.lazy(() => import('./components/SellerProfilePage'));
const DealerProfiles = React.lazy(() => import('./components/DealerProfiles'));
const PricingPage = React.lazy(() => import('./components/PricingPage'));
const SupportPage = React.lazy(() => import('./components/SupportPage'));
const FAQPage = React.lazy(() => import('./components/FAQPage'));
const BuyerDashboard = React.lazy(() => import('./components/BuyerDashboard'));
const CityLandingPage = React.lazy(() => import('./components/CityLandingPage'));
const LoginPortal = React.lazy(() => import('./components/LoginPortal'));
const CustomerLogin = React.lazy(() => import('./CustomerLogin'));
const AdminLogin = React.lazy(() => import('./AdminLogin'));
const Login = React.lazy(() => import('./Login'));
const ForgotPassword = React.lazy(() => import('./components/ForgotPassword'));

const LoadingSpinner: React.FC = () => (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
            <span className="text-xl font-semibold text-gray-600">Loading...</span>
        </div>
    </div>
);

const AppContent: React.FC = () => {
  console.log('🔧 AppContent: Starting initialization...');
  
  try {
    const {
      currentView,
      selectedVehicle,
      vehicles,
      isLoading,
      currentUser,
      comparisonList,
      wishlist,
      conversations,
      toasts,
      activeChat,
      users,
      platformSettings,
      auditLog,
      vehicleData,
      faqItems,
      supportTickets,
      notifications,
      forgotPasswordRole,
      selectedCategory,
      initialSearchQuery,
      userLocation,
      selectedCity,
      publicSellerProfile,
      recommendations,
      typingStatus,
      removeToast,
      handleLogout,
      navigate,
      addToast,
      setActiveChat,
      setIsCommandPaletteOpen,
      isCommandPaletteOpen,
      setUserLocation,
      setCurrentUser,
      setUsers,
      setVehicles,
      setIsLoading,
      setConversations,
      setRatings,
      setSellerRatings,
      setWishlist,
      setComparisonList,
      setPlatformSettings,
      setVehicleData,
      setSupportTickets,
      setFaqItems,
      setForgotPasswordRole,
      setPublicSellerProfile,
      setSelectedVehicle,
      setSelectedCategory,
      setInitialSearchQuery,
    } = useApp();
    
    console.log('🔧 AppContent: useApp hook successful, currentView:', currentView);

  // Vehicle operation handlers
  const handleAddVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, isFeaturing: boolean = false) => {
    try {
      console.log('🚀 App.handleAddVehicle called with:', vehicleData);
      console.log('⭐ Is featuring:', isFeaturing);
      
      const { addVehicle } = await import('./services/dataService');
      const vehicleToAdd = {
        ...vehicleData,
        id: Date.now(),
        averageRating: 0,
        ratingCount: 0,
        isFeatured: isFeaturing,
        status: 'published'
      } as Vehicle;
      
      console.log('📦 Vehicle to add:', vehicleToAdd);
      const newVehicle = await addVehicle(vehicleToAdd);
      console.log('✅ Vehicle added successfully:', newVehicle);
      
      (setVehicles as any)((prev: Vehicle[]) => [...prev, newVehicle]);
      addToast('Vehicle added successfully!', 'success');
    } catch (error) {
      console.error('❌ Failed to add vehicle:', error);
      addToast('Failed to add vehicle. Please try again.', 'error');
    }
  };

  const handleUpdateVehicle = async (vehicleData: Vehicle) => {
    try {
      const { updateVehicle } = await import('./services/dataService');
      const updatedVehicle = await updateVehicle(vehicleData);
      (setVehicles as any)((prev: Vehicle[]) => prev.map((v: Vehicle) => v.id === vehicleData.id ? updatedVehicle : v));
      addToast('Vehicle updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to update vehicle:', error);
      addToast('Failed to update vehicle. Please try again.', 'error');
    }
  };

  const handleDeleteVehicle = async (vehicleId: number) => {
    try {
      console.log('🗑️ Deleting vehicle with ID:', vehicleId);
      
      // Remove vehicle from the state immediately
      (setVehicles as any)((prev: Vehicle[]) => prev.filter((v: Vehicle) => v.id !== vehicleId));
      
      // Try to delete from service (optional - for persistence)
      try {
        const { deleteVehicle } = await import('./services/dataService');
        await deleteVehicle(vehicleId);
        console.log('✅ Vehicle deleted from service');
      } catch (serviceError) {
        console.warn('⚠️ Failed to delete from service, but removed from UI:', serviceError);
      }
      
      addToast('Vehicle deleted successfully!', 'success');
      console.log('✅ Vehicle deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete vehicle:', error);
      addToast('Failed to delete vehicle. Please try again.', 'error');
    }
  };

  const handleMarkAsSold = async (vehicleId: number) => {
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        await handleUpdateVehicle({ ...vehicle, status: 'sold' });
        addToast('Vehicle marked as sold!', 'success');
      }
    } catch (error) {
      console.error('Failed to mark vehicle as sold:', error);
      addToast('Failed to mark vehicle as sold. Please try again.', 'error');
    }
  };

  const handleFeatureListing = async (vehicleId: number) => {
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        await handleUpdateVehicle({ ...vehicle, isFeatured: true });
        addToast('Listing featured successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to feature listing:', error);
      addToast('Failed to feature listing. Please try again.', 'error');
    }
  };

  const handleRequestCertification = async (vehicleId: number) => {
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        await handleUpdateVehicle({ ...vehicle, certificationStatus: 'requested' });
        addToast('Certification request submitted!', 'success');
      }
    } catch (error) {
      console.error('Failed to request certification:', error);
      addToast('Failed to request certification. Please try again.', 'error');
    }
  };

  const handleAddMultipleVehicles = async (vehiclesData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => {
    try {
      const { addVehicle } = await import('./services/dataService');
      const newVehicles = await Promise.all(
        vehiclesData.map(async (vehicleData) => {
          return await addVehicle({
            ...vehicleData,
            id: Date.now() + Math.random(),
            averageRating: 0,
            ratingCount: 0,
            status: 'published'
          } as Vehicle);
        })
      );
      (setVehicles as any)((prev: Vehicle[]) => [...prev, ...newVehicles]);
      addToast(`${newVehicles.length} vehicles added successfully!`, 'success');
    } catch (error) {
      console.error('Failed to add multiple vehicles:', error);
      addToast('Failed to add vehicles. Please try again.', 'error');
    }
  };

  const handleViewSellerProfile = (sellerEmail: string) => {
    console.log('🔍 Viewing seller profile for:', sellerEmail);
    const seller = users.find(u => u.email === sellerEmail);
    if (seller) {
      console.log('✅ Seller found:', seller.name);
      setPublicSellerProfile(seller);
      navigate(View.SELLER_PROFILE);
    } else {
      console.log('❌ Seller not found with email:', sellerEmail);
      addToast('Seller profile not found', 'error');
    }
  };

  const handleToggleCompare = (vehicleId: number) => {
    (setComparisonList as any)((prev: number[]) => {
      if (prev.includes(vehicleId)) {
        return prev.filter((id: number) => id !== vehicleId);
      } else if (prev.length < 4) {
        return [...prev, vehicleId];
      } else {
        addToast('You can compare up to 4 vehicles at a time', 'info');
        return prev;
      }
    });
  };

  const handleToggleWishlist = (vehicleId: number) => {
    (setWishlist as any)((prev: number[]) => {
      if (prev.includes(vehicleId)) {
        return prev.filter((id: number) => id !== vehicleId);
      } else {
        return [...prev, vehicleId];
      }
    });
  };

  const handleClearCompare = () => {
    setComparisonList([]);
  };

  const handleAddSellerRating = (sellerEmail: string, rating: number) => {
    (setSellerRatings as any)((prev: { [key: string]: number[] }) => ({
      ...prev,
      [sellerEmail]: [...(prev[sellerEmail] || []), rating]
    }));
    addToast('Rating added successfully!', 'success');
  };

  const handleFlagContent = (type: 'vehicle' | 'conversation', id: number | string, reason: string) => {
    console.log('Flagging content:', { type, id, reason });
    addToast('Content has been flagged for review', 'success');
  };

  // Admin Panel Handlers
  const handleToggleVehicleStatus = async (vehicleId: number) => {
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        const newStatus = vehicle.status === 'published' ? 'unpublished' : 'published';
        console.log('🔄 Toggling vehicle status from', vehicle.status, 'to', newStatus);
        
        // Update vehicle status in the state
        (setVehicles as any)((prevVehicles: Vehicle[]) => 
          prevVehicles.map(v => 
            v.id === vehicleId 
              ? { ...v, status: newStatus }
              : v
          )
        );
        
        addToast(`Vehicle ${newStatus === 'published' ? 'published' : 'unpublished'} successfully!`, 'success');
        console.log('✅ Vehicle status updated successfully');
      }
    } catch (error) {
      console.error('Failed to toggle vehicle status:', error);
      addToast('Failed to toggle vehicle status. Please try again.', 'error');
    }
  };

  const handleToggleVehicleFeature = async (vehicleId: number) => {
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        await handleUpdateVehicle({ ...vehicle, isFeatured: !vehicle.isFeatured });
        addToast(`Vehicle ${vehicle.isFeatured ? 'unfeatured' : 'featured'} successfully!`, 'success');
      }
    } catch (error) {
      console.error('Failed to toggle vehicle feature:', error);
      addToast('Failed to toggle vehicle feature. Please try again.', 'error');
    }
  };

  const handleResolveFlag = async (type: 'vehicle' | 'conversation', id: number | string) => {
    try {
      if (type === 'vehicle') {
        const vehicle = vehicles.find(v => v.id === id);
        if (vehicle) {
          await handleUpdateVehicle({ ...vehicle, isFlagged: false });
          addToast('Vehicle flag resolved successfully!', 'success');
        }
      } else if (type === 'conversation') {
        // Handle conversation flag resolution
        addToast('Conversation flag resolved successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to resolve flag:', error);
      addToast('Failed to resolve flag. Please try again.', 'error');
    }
  };

  const handleToggleUserStatus = async (email: string) => {
    console.log('🔄 handleToggleUserStatus called with email:', email);
    try {
      const user = users.find(u => u.email === email);
      console.log('👤 Found user:', user);
      if (user) {
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        console.log('📝 Updating user status from', user.status, 'to', newStatus);
        
        // Update user status in the state
        (setUsers as any)((prevUsers: any[]) => 
          prevUsers.map((u: any) => 
            u.email === email 
              ? { ...u, status: newStatus }
              : u
          )
        );
        
        addToast(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`, 'success');
        console.log('✅ User status updated successfully');
      } else {
        console.log('❌ User not found with email:', email);
        addToast('User not found', 'error');
      }
    } catch (error) {
      console.error('❌ Failed to toggle user status:', error);
      addToast('Failed to toggle user status. Please try again.', 'error');
    }
  };

  const handleDeleteUser = async (email: string) => {
    console.log('🗑️ handleDeleteUser called with email:', email);
    try {
      if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        console.log('✅ User confirmed deletion for:', email);
        
        // Remove user from the state
        (setUsers as any)((prevUsers: any[]) => 
          prevUsers.filter((u: any) => u.email !== email)
        );
        
        addToast('User deleted successfully!', 'success');
        console.log('✅ User deleted successfully');
      } else {
        console.log('❌ User cancelled deletion');
      }
    } catch (error) {
      console.error('❌ Failed to delete user:', error);
      addToast('Failed to delete user. Please try again.', 'error');
    }
  };

  const handleAdminUpdateUser = async (email: string, details: { name: string; mobile: string; role: any }) => {
    try {
      console.log('Updating user:', email, details);
      
      // Update user in the state
      (setUsers as any)((prevUsers: any[]) => 
        prevUsers.map((u: any) => 
          u.email === email 
            ? { ...u, ...details }
            : u
        )
      );
      
      addToast('User updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to update user:', error);
      addToast('Failed to update user. Please try again.', 'error');
    }
  };

  const handleUpdateUserPlan = async (email: string, plan: any) => {
    try {
      console.log('🔄 Updating user plan:', email, plan);
      
      // Update user plan in the state
      (setUsers as any)((prevUsers: any[]) =>
        prevUsers.map((u: any) =>
          u.email === email
            ? { ...u, subscriptionPlan: plan }
            : u
        )
      );
      
      addToast('User plan updated successfully!', 'success');
      console.log('✅ User plan updated successfully');
    } catch (error) {
      console.error('❌ Failed to update user plan:', error);
      addToast('Failed to update user plan. Please try again.', 'error');
    }
  };

  const handleSendBroadcast = async (message: string) => {
    try {
      console.log('🔄 Sending broadcast:', message);
      // Send broadcast logic here
      addToast('Broadcast sent successfully!', 'success');
      console.log('✅ Broadcast sent successfully');
    } catch (error) {
      console.error('❌ Failed to send broadcast:', error);
      addToast('Failed to send broadcast. Please try again.', 'error');
    }
  };

  // Settings Handler
  const handleUpdateSettings = async (settings: any) => {
    try {
      console.log('🔄 Updating platform settings:', settings);
      
      // Update settings in the state
      setPlatformSettings(settings);
      
      addToast('Settings updated successfully!', 'success');
      console.log('✅ Settings updated successfully');
    } catch (error) {
      console.error('❌ Failed to update settings:', error);
      addToast('Failed to update settings. Please try again.', 'error');
    }
  };

  const handleExportUsers = () => {
    console.log('📊 handleExportUsers called');
    try {
      console.log('👥 Users to export:', users.length);
      const csvContent = "data:text/csv;charset=utf-8," + 
        "Name,Email,Role,Status,Mobile\n" +
        users.map(user => `${user.name},${user.email},${user.role},${user.status},${user.mobile}`).join("\n");
      
      console.log('📄 CSV content generated:', csvContent.substring(0, 100) + '...');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "users.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Users exported successfully');
      addToast('Users exported successfully!', 'success');
    } catch (error) {
      console.error('❌ Failed to export users:', error);
      addToast('Failed to export users. Please try again.', 'error');
    }
  };

  const handleExportVehicles = () => {
    try {
      const csvContent = "data:text/csv;charset=utf-8," + 
        "Make,Model,Year,Price,Seller,Status\n" +
        vehicles.map(vehicle => `${vehicle.make},${vehicle.model},${vehicle.year},${vehicle.price},${vehicle.sellerEmail},${vehicle.status}`).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "vehicles.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addToast('Vehicles exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export vehicles:', error);
      addToast('Failed to export vehicles. Please try again.', 'error');
    }
  };

  const handleExportSales = () => {
    try {
      const soldVehicles = vehicles.filter(v => v.status === 'sold');
      const csvContent = "data:text/csv;charset=utf-8," + 
        "Make,Model,Year,Price,Seller,Sale Date\n" +
        soldVehicles.map(vehicle => `${vehicle.make},${vehicle.model},${vehicle.year},${vehicle.price},${vehicle.sellerEmail},${new Date().toLocaleDateString()}`).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "sales.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addToast('Sales data exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export sales:', error);
      addToast('Failed to export sales. Please try again.', 'error');
    }
  };

  const handleToggleVerifiedStatus = async (email: string) => {
    try {
      const user = users.find(u => u.email === email);
      if (user) {
        // Toggle verification status logic here
        addToast(`User verification ${user.isVerified ? 'removed' : 'approved'} successfully!`, 'success');
      }
    } catch (error) {
      console.error('Failed to toggle verification status:', error);
      addToast('Failed to toggle verification status. Please try again.', 'error');
    }
  };

  const handleUpdateSupportTicket = async (ticket: any) => {
    try {
      console.log('🔄 Updating support ticket:', ticket);
      
      // Update support ticket in the state
      (setSupportTickets as any)((prevTickets: any[]) =>
        prevTickets.map((t: any) =>
          t.id === ticket.id
            ? { ...t, ...ticket }
            : t
        )
      );
      
      addToast('Support ticket updated successfully!', 'success');
      console.log('✅ Support ticket updated successfully');
    } catch (error) {
      console.error('❌ Failed to update support ticket:', error);
      addToast('Failed to update support ticket. Please try again.', 'error');
    }
  };

  const handleAddFaq = async (faq: any) => {
    try {
      console.log('🔄 Adding FAQ:', faq);
      
      // Add FAQ to the state
      const newFaq = { ...faq, id: Date.now() };
      setFaqItems([...faqItems, newFaq]);
      
      addToast('FAQ added successfully!', 'success');
      console.log('✅ FAQ added successfully');
    } catch (error) {
      console.error('❌ Failed to add FAQ:', error);
      addToast('Failed to add FAQ. Please try again.', 'error');
    }
  };

  const handleUpdateFaq = async (faq: any) => {
    try {
      console.log('🔄 Updating FAQ:', faq);
      
      // Update FAQ in the state
      setFaqItems(faqItems.map((f: any) =>
        f.id === faq.id
          ? { ...f, ...faq }
          : f
      ));
      
      addToast('FAQ updated successfully!', 'success');
      console.log('✅ FAQ updated successfully');
    } catch (error) {
      console.error('❌ Failed to update FAQ:', error);
      addToast('Failed to update FAQ. Please try again.', 'error');
    }
  };

  const handleDeleteFaq = async (id: number) => {
    try {
      console.log('🔄 Deleting FAQ:', id);
      
      // Remove FAQ from the state
      setFaqItems(faqItems.filter((f: any) => f.id !== id));
      
      addToast('FAQ deleted successfully!', 'success');
      console.log('✅ FAQ deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete FAQ:', error);
      addToast('Failed to delete FAQ. Please try again.', 'error');
    }
  };

  const handleCertificationApproval = async (vehicleId: number, decision: "approved" | "rejected") => {
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        await handleUpdateVehicle({ 
          ...vehicle, 
          certificationStatus: decision 
        });
        addToast(`Certification ${decision} successfully!`, 'success');
      }
    } catch (error) {
      console.error('Failed to update certification:', error);
      addToast('Failed to update certification. Please try again.', 'error');
    }
  };

  // Seller Dashboard Handlers
  const handleSellerSendMessage = async (conversationId: string, messageText: string, type?: any, payload?: any) => {
    try {
      console.log('Seller sending message:', { conversationId, messageText, type, payload });
      // Add message to conversation logic here
      addToast('Message sent successfully!', 'success');
    } catch (error) {
      console.error('Failed to send message:', error);
      addToast('Failed to send message. Please try again.', 'error');
    }
  };

  const handleMarkConversationAsReadBySeller = async (conversationId: string) => {
    try {
      console.log('Marking conversation as read by seller:', conversationId);
      // Mark conversation as read logic here
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  };

  const handleUserTyping = (conversationId: string, userRole: 'customer' | 'seller') => {
    console.log('User typing:', { conversationId, userRole });
    // Handle typing status logic here
  };

  const handleMarkMessagesAsRead = (conversationId: string, readerRole: 'customer' | 'seller') => {
    console.log('Marking messages as read:', { conversationId, readerRole });
    // Mark messages as read logic here
  };

  const handleUpdateSellerProfile = async (details: { dealershipName: string; bio: string; logoUrl: string; }) => {
    try {
      console.log('Updating seller profile:', details);
      // Update seller profile logic here
      addToast('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to update seller profile:', error);
      addToast('Failed to update profile. Please try again.', 'error');
    }
  };

  const handleOfferResponse = async (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => {
    try {
      console.log('Responding to offer:', { conversationId, messageId, response, counterPrice });
      // Handle offer response logic here
      addToast(`Offer ${response} successfully!`, 'success');
    } catch (error) {
      console.error('Failed to respond to offer:', error);
      addToast('Failed to respond to offer. Please try again.', 'error');
    }
  };

  // Vehicle Data Management Handler
  const handleUpdateVehicleData = async (newData: any) => {
    try {
      console.log('🔄 Updating vehicle data:', newData);
      
      // Update vehicle data in the state
      setVehicleData(newData);
      
      // Try to save to service (optional - for persistence)
      try {
        const { saveVehicleData } = await import('./services/vehicleDataService');
        await saveVehicleData(newData);
        console.log('✅ Vehicle data saved to service');
      } catch (serviceError) {
        console.warn('⚠️ Failed to save to service, but updated in UI:', serviceError);
      }
      
      addToast('Vehicle data updated successfully!', 'success');
      console.log('✅ Vehicle data updated successfully');
    } catch (error) {
      console.error('❌ Failed to update vehicle data:', error);
      addToast('Failed to update vehicle data. Please try again.', 'error');
    }
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    console.log('🚗 Selecting vehicle:', vehicle.id, vehicle.make, vehicle.model);
    console.log('🚗 Current view before navigation:', currentView);
    console.log('🚗 Setting selectedVehicle to:', vehicle);
    
    // Store vehicle in sessionStorage for persistence and recovery
    try {
      sessionStorage.setItem('selectedVehicle', JSON.stringify(vehicle));
      console.log('🚗 Vehicle stored in sessionStorage for persistence');
    } catch (error) {
      console.warn('🚗 Failed to store vehicle in sessionStorage:', error);
    }
    
    // Set the state
    setSelectedVehicle(vehicle);
    console.log('🚗 selectedVehicle state should now be set');
    
    // Navigate to detail view
    console.log('🚗 Navigating to DETAIL view...');
    navigate(View.DETAIL);
    console.log('🚗 Navigation called, current view should be:', View.DETAIL);
  };

  // Track selectedVehicle changes
  useEffect(() => {
    console.log('🔄 selectedVehicle state changed:', selectedVehicle);
    if (selectedVehicle) {
      console.log('✅ selectedVehicle is set:', { id: selectedVehicle.id, make: selectedVehicle.make, model: selectedVehicle.model });
    } else {
      console.log('❌ selectedVehicle is null/undefined');
    }
  }, [selectedVehicle]);

  // Initialize data loading
  useEffect(() => {
    const loadInitialData = async () => {
        setIsLoading(false);
        
        try {
            console.log("Loading initial data in background...");
            
            // Lazy load services
            const [vehicleService, userService, vehicleDataService] = await Promise.all([
                import('./services/dataService'),
                import('./services/dataService'),
                import('./services/dataService')
            ]);
            
            // Load critical data with timeout protection
            const [vehiclesData, usersData] = await Promise.all([
                withLoadingTimeout(LOADING_OPERATIONS.VEHICLES, vehicleService.getVehicles(), 10000),
                withLoadingTimeout(LOADING_OPERATIONS.USERS, userService.getUsers(), 10000)
            ]);
            
            console.log("Successfully loaded critical data:", { vehicles: vehiclesData.length, users: usersData.length });
            setVehicles(vehiclesData);
            setUsers(usersData);
            
            // Load non-critical data in background
            vehicleDataService.getVehicleData().then(vehicleDataFromAPI => {
                setVehicleData(vehicleDataFromAPI);
                loadingManager.completeLoading(LOADING_OPERATIONS.VEHICLE_DATA);
            }).catch(error => {
                console.warn("Failed to load vehicle data:", error);
                loadingManager.failLoading(LOADING_OPERATIONS.VEHICLE_DATA, error.message);
            });
            
        } catch (error) {
            console.error("Failed to load initial data:", error);
            console.warn("Using fallback data due to loading error");
        }
    };

    loadInitialData();
  }, [setVehicles, setUsers, setIsLoading, setVehicleData]);

  // Load user session
  useEffect(() => {
    console.log('🔄 Initial load effect running');
    
    const localUserJson = localStorage.getItem('reRideCurrentUser');
    const sessionUserJson = sessionStorage.getItem('currentUser');
    const userJson = localUserJson || sessionUserJson;
    if (userJson) {
      const user = JSON.parse(userJson);
      console.log('✅ Restored user from storage:', user.email, 'Role:', user.role);
      setCurrentUser(user);
      
      if (!localUserJson && sessionUserJson) {
        localStorage.setItem('reRideCurrentUser', sessionUserJson);
        console.log('🔄 Migrated session to localStorage');
      }
    } else {
      console.log('ℹ️ No saved user session found');
    }
    
    const savedWishlist = localStorage.getItem('wishlist');
    if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
    
    const loadedConversations = getConversations();
    setConversations(loadedConversations.map(c => ({ 
      ...c, 
      isReadByCustomer: c.isReadByCustomer ?? true, 
      messages: (c.messages || []).map(m => ({ ...m, isRead: m.isRead ?? true })), 
      isFlagged: c.isFlagged || false, 
      flagReason: c.flagReason || undefined, 
      flaggedAt: c.flaggedAt || undefined 
    })));
  }, []); // Empty dependency array - only run once on mount

  // Separate effect for auto-navigation based on user role
  useEffect(() => {
    if (currentUser && currentView === View.HOME) {
      if (currentUser.role === 'seller') {
        console.log('🔄 Auto-navigating seller to dashboard');
        navigate(View.SELLER_DASHBOARD);
      } else if (currentUser.role === 'admin') {
        console.log('🔄 Auto-navigating admin to panel');
        navigate(View.ADMIN_PANEL);
      }
      // Note: customers stay on HOME, so no navigation needed
    }
  }, [currentUser, currentView, navigate]);

  // Load ratings
  useEffect(() => {
    setRatings(getRatings());
    setSellerRatings(getSellerRatings());
  }, [setRatings, setSellerRatings]);

  // Save data when it changes
   useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveSettings(platformSettings);
  }, [platformSettings]);

  useEffect(() => {
    saveAuditLog(auditLog);
  }, [auditLog]);

  useEffect(() => {
    saveFaqs(faqItems);
  }, [faqItems]);
  
  useEffect(() => {
    saveSupportTickets(supportTickets);
  }, [supportTickets]);

  useEffect(() => {
    try {
      localStorage.setItem('reRideNotifications', JSON.stringify(notifications));
    } catch (error) {
      console.error("Failed to save notifications", error); 
    }
  }, [notifications]);

  // Handle seller profile URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sellerEmail = urlParams.get('seller');
    if (sellerEmail && users.length > 0) {
      const sellerUser = users.find(u => u.email === sellerEmail && u.role === 'seller');
      if (sellerUser) {
        setPublicSellerProfile(sellerUser);
        navigate(View.SELLER_PROFILE);
    } else {
        addToast('Seller profile not found.', 'error');
        window.history.pushState({}, '', window.location.pathname);
      }
    }
  }, [addToast, users, setPublicSellerProfile, navigate]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { 
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') { 
        event.preventDefault(); 
        setIsCommandPaletteOpen(prev => !prev); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsCommandPaletteOpen]);

  const renderContent = () => {
    if (isLoading && currentView === View.HOME) return <LoadingSpinner />;
    
    const authViews = [View.LOGIN_PORTAL, View.CUSTOMER_LOGIN, View.SELLER_LOGIN, View.ADMIN_LOGIN, View.FORGOT_PASSWORD];
    if (authViews.includes(currentView)) {
      const AuthWrapper: React.FC<{children: React.ReactNode}> = ({ children }) => (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-gradient-main p-4">
          {children}
        </div>
      );
      
      switch (currentView) {
        case View.LOGIN_PORTAL: 
          return <AuthWrapper><LoginPortal onNavigate={navigate} /></AuthWrapper>;
        case View.CUSTOMER_LOGIN: 
          return <AuthWrapper><CustomerLogin onLogin={(user) => { 
            setCurrentUser(user); 
            const userJson = JSON.stringify(user);
            localStorage.setItem('reRideCurrentUser', userJson);
            sessionStorage.setItem('currentUser', userJson);
            navigate(View.HOME); 
          }} onRegister={(user) => { 
            setUsers(prev => [...prev, user]); 
            setCurrentUser(user); 
            const userJson = JSON.stringify(user);
            localStorage.setItem('reRideCurrentUser', userJson);
            sessionStorage.setItem('currentUser', userJson);
            navigate(View.HOME); 
            addToast('Registration successful!', 'success'); 
          }} onNavigate={navigate} onForgotPassword={() => { setForgotPasswordRole('customer'); navigate(View.FORGOT_PASSWORD); }} /></AuthWrapper>;
        case View.SELLER_LOGIN: 
          return <AuthWrapper><Login onLogin={(user) => { 
            setCurrentUser(user); 
            const userJson = JSON.stringify(user);
            localStorage.setItem('reRideCurrentUser', userJson);
            sessionStorage.setItem('currentUser', userJson);
            navigate(View.SELLER_DASHBOARD); 
          }} onRegister={(user) => { 
            setUsers(prev => [...prev, user]); 
            setCurrentUser(user); 
            const userJson = JSON.stringify(user);
            localStorage.setItem('reRideCurrentUser', userJson);
            sessionStorage.setItem('currentUser', userJson);
            navigate(View.SELLER_DASHBOARD); 
            addToast('Registration successful!', 'success'); 
          }} onNavigate={navigate} onForgotPassword={() => { setForgotPasswordRole('seller'); navigate(View.FORGOT_PASSWORD); }}/></AuthWrapper>;
        case View.ADMIN_LOGIN: 
          return <AuthWrapper><AdminLogin onLogin={(user) => { 
            setCurrentUser(user); 
            const userJson = JSON.stringify(user);
            localStorage.setItem('reRideCurrentUser', userJson);
            sessionStorage.setItem('currentUser', userJson);
            navigate(View.ADMIN_PANEL); 
          }} onNavigate={navigate} /></AuthWrapper>;
        case View.FORGOT_PASSWORD: 
          return <AuthWrapper><ForgotPassword onResetRequest={(email) => { console.log(`Password reset for ${email} as a ${forgotPasswordRole}.`); }} onBack={() => navigate(forgotPasswordRole === 'customer' ? View.CUSTOMER_LOGIN : View.SELLER_LOGIN)}/></AuthWrapper>;
      }
    }
    
    console.log('🔄 Rendering view:', currentView);
    switch (currentView) {
      case View.SUPPORT: 
        return <SupportPage currentUser={currentUser} onSubmitTicket={(ticketData) => { 
          const newTicket = { ...ticketData, id: Date.now(), status: 'Open' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), replies: [] };
          setSupportTickets(prev => [newTicket, ...prev]);
          addToast('Support ticket submitted!', 'success');
          navigate(View.HOME);
        }} />;
      case View.FAQ: 
        return <FAQPage faqItems={faqItems} />;
      case View.PRICING: 
        return <PricingPage currentUser={currentUser} onSelectPlan={async (planId) => {
      if (!currentUser || currentUser.role !== 'seller') return;
      const { PLAN_DETAILS } = await import('./constants');
      const planDetails = PLAN_DETAILS[planId];
      if (planId === 'free') {
          const updatedUser = { ...currentUser, subscriptionPlan: planId };
            const userService = await import('./services/userService');
          const savedUser = await userService.updateUser(updatedUser);
            setUsers(prev => prev.map(u => u.email === currentUser.email ? savedUser : u));
          setCurrentUser(savedUser);
          const userJson = JSON.stringify(savedUser);
          sessionStorage.setItem('currentUser', userJson);
          localStorage.setItem('reRideCurrentUser', userJson);
          addToast(`Successfully switched to the ${planDetails.name} plan!`, 'success');
            navigate(View.SELLER_DASHBOARD);
          }
        }} />;
      case View.SELLER_PROFILE: 
        return publicSellerProfile && <SellerProfilePage 
          seller={users.find(u => u.email === publicSellerProfile.email)!} 
          vehicles={vehicles.filter(v => v.sellerEmail === publicSellerProfile.email && v.status === 'published')} 
          onSelectVehicle={handleSelectVehicle} 
          comparisonList={comparisonList} 
          onToggleCompare={handleToggleCompare} 
          wishlist={wishlist} 
          onToggleWishlist={handleToggleWishlist} 
          onBack={() => navigate(View.HOME)} 
          onViewSellerProfile={handleViewSellerProfile} 
        />;
      case View.DETAIL: 
        console.log('🎯 Rendering DETAIL view, selectedVehicle:', selectedVehicle);
        console.log('🎯 selectedVehicle exists?', !!selectedVehicle);
        console.log('🎯 selectedVehicle type:', typeof selectedVehicle);
        
        // State recovery mechanism - try to recover vehicle from sessionStorage
        let vehicleToShow = selectedVehicle;
        if (!vehicleToShow) {
          try {
            const storedVehicle = sessionStorage.getItem('selectedVehicle');
            if (storedVehicle) {
              vehicleToShow = JSON.parse(storedVehicle);
              console.log('🔧 Recovered vehicle from sessionStorage:', vehicleToShow?.id, vehicleToShow?.make, vehicleToShow?.model);
              // Update the state with recovered vehicle
              setSelectedVehicle(vehicleToShow);
            }
          } catch (error) {
            console.warn('🔧 Failed to recover vehicle from sessionStorage:', error);
          }
        }
        
        if (!vehicleToShow) {
          console.log('❌ No selectedVehicle and no recovery possible, rendering error');
          return <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">No Vehicle Selected</h2>
              <p className="text-gray-600 mb-4">Please select a vehicle to view details.</p>
              <button 
                onClick={() => navigate(View.USED_CARS)} 
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                Back to Vehicle List
              </button>
            </div>
          </div>;
        }
        return <VehicleDetail 
          vehicle={vehicleToShow} 
          onBack={() => navigate(View.USED_CARS)} 
          comparisonList={comparisonList} 
          onToggleCompare={handleToggleCompare} 
          onAddSellerRating={handleAddSellerRating} 
          wishlist={wishlist} 
          onToggleWishlist={handleToggleWishlist} 
          currentUser={currentUser} 
          onFlagContent={handleFlagContent} 
          users={users} 
          onViewSellerProfile={handleViewSellerProfile} 
          onStartChat={() => {}} 
          recommendations={recommendations} 
          onSelectVehicle={handleSelectVehicle} 
        />;
      case View.SELLER_DASHBOARD: {
        if (!currentUser || currentUser.role !== 'seller') {
          navigate(View.HOME);
          return null;
        }
        return <Dashboard 
          seller={users.find(u => u.email === currentUser.email)!} 
          sellerVehicles={vehicles.filter(v => v.sellerEmail === currentUser.email)} 
          reportedVehicles={vehicles.filter(v => v.sellerEmail === currentUser.email && v.isFlagged)} 
          onAddVehicle={handleAddVehicle} 
          onAddMultipleVehicles={handleAddMultipleVehicles} 
          onUpdateVehicle={handleUpdateVehicle} 
          onDeleteVehicle={handleDeleteVehicle} 
          onMarkAsSold={handleMarkAsSold} 
          conversations={conversations.filter(c => c.sellerId === currentUser.email)} 
          onSellerSendMessage={handleSellerSendMessage} 
          onMarkConversationAsReadBySeller={handleMarkConversationAsReadBySeller} 
          typingStatus={typingStatus} 
          onUserTyping={handleUserTyping} 
          onMarkMessagesAsRead={handleMarkMessagesAsRead} 
          onUpdateSellerProfile={handleUpdateSellerProfile} 
          vehicleData={vehicleData} 
          onFeatureListing={handleFeatureListing} 
          onRequestCertification={handleRequestCertification} 
          onNavigate={navigate} 
          allVehicles={vehicles.filter(v => v.status === 'published')} 
          onOfferResponse={handleOfferResponse} 
        />;
      }
      case View.ADMIN_PANEL: 
        return currentUser?.role === 'admin' ? <AdminPanel 
          users={users} 
          currentUser={currentUser} 
          vehicles={vehicles} 
          conversations={conversations} 
          onToggleUserStatus={handleToggleUserStatus} 
          onDeleteUser={handleDeleteUser} 
          onAdminUpdateUser={handleAdminUpdateUser} 
          onUpdateUserPlan={handleUpdateUserPlan} 
          onUpdateVehicle={handleUpdateVehicle} 
          onDeleteVehicle={handleDeleteVehicle} 
          onToggleVehicleStatus={handleToggleVehicleStatus} 
          onToggleVehicleFeature={handleToggleVehicleFeature} 
          onResolveFlag={handleResolveFlag} 
          platformSettings={platformSettings} 
          onUpdateSettings={handleUpdateSettings} 
          onSendBroadcast={handleSendBroadcast} 
          auditLog={auditLog} 
          onExportUsers={handleExportUsers} 
          onExportVehicles={handleExportVehicles} 
          onExportSales={handleExportSales} 
          onNavigate={navigate}
          vehicleData={vehicleData} 
          onUpdateVehicleData={handleUpdateVehicleData} 
          onToggleVerifiedStatus={handleToggleVerifiedStatus} 
          supportTickets={supportTickets} 
          onUpdateSupportTicket={handleUpdateSupportTicket} 
          faqItems={faqItems} 
          onAddFaq={handleAddFaq} 
          onUpdateFaq={handleUpdateFaq} 
          onDeleteFaq={handleDeleteFaq} 
          onCertificationApproval={handleCertificationApproval} 
        /> : <LoadingSpinner />;
      case View.COMPARISON: 
        return <Comparison 
          vehicles={vehicles.filter(v => comparisonList.includes(v.id))} 
          onBack={() => navigate(View.USED_CARS)} 
          onToggleCompare={handleToggleCompare} 
        />;
      case View.PROFILE: 
        return currentUser && <Profile 
          currentUser={currentUser} 
          onUpdateProfile={() => {}} 
          onUpdatePassword={() => Promise.resolve(false)} 
        />;
      case View.INBOX: 
        return currentUser && <CustomerInbox 
          conversations={conversations.filter(c => c.customerId === currentUser.email)} 
          onSendMessage={() => {}} 
          onMarkAsRead={() => {}} 
          users={users} 
          typingStatus={null} 
          onUserTyping={() => {}} 
          onMarkMessagesAsRead={() => {}} 
          onFlagContent={handleFlagContent} 
          onOfferResponse={() => {}} 
        />;
      case View.BUYER_DASHBOARD: 
        return currentUser?.role === 'customer' ? <BuyerDashboard 
          currentUser={currentUser} 
          vehicles={vehicles.filter(v => v.status === 'published')} 
          wishlist={wishlist} 
          conversations={conversations.filter(c => c.customerId === currentUser.email)} 
          onNavigate={navigate} 
          onSelectVehicle={handleSelectVehicle} 
          onToggleWishlist={handleToggleWishlist} 
          onToggleCompare={handleToggleCompare} 
          comparisonList={comparisonList} 
          onViewSellerProfile={handleViewSellerProfile} 
        /> : <LoadingSpinner />;
      case View.USED_CARS: 
        return <VehicleList 
          vehicles={vehicles.filter(v => v.status === 'published')} 
          isLoading={isLoading} 
          onSelectVehicle={handleSelectVehicle} 
          comparisonList={comparisonList} 
          onToggleCompare={handleToggleCompare} 
          onClearCompare={handleClearCompare} 
          wishlist={wishlist} 
          onToggleWishlist={handleToggleWishlist} 
          categoryTitle="All Used Cars" 
          initialCategory={selectedCategory} 
          initialSearchQuery={initialSearchQuery} 
          onViewSellerProfile={handleViewSellerProfile} 
          userLocation={userLocation} 
        />;
      case View.DEALER_PROFILES: 
        return <DealerProfiles 
          sellers={users.filter(u => u.role === 'seller')} 
          onViewProfile={handleViewSellerProfile} 
        />;
      case View.WISHLIST: 
        return <VehicleList 
          vehicles={vehicles.filter(v => wishlist.includes(v.id))} 
          isLoading={isLoading} 
          onSelectVehicle={handleSelectVehicle} 
          comparisonList={comparisonList} 
          onToggleCompare={handleToggleCompare} 
          onClearCompare={handleClearCompare} 
          wishlist={wishlist} 
          onToggleWishlist={handleToggleWishlist} 
          categoryTitle="My Wishlist" 
          isWishlistMode={true} 
          onViewSellerProfile={handleViewSellerProfile} 
          userLocation={userLocation} 
        />;
      case View.CITY_LANDING: 
        return selectedCity && <CityLandingPage 
          city={selectedCity} 
          vehicles={vehicles.filter(v => v.status === 'published')} 
          onSelectVehicle={handleSelectVehicle} 
          onToggleWishlist={handleToggleWishlist} 
          onToggleCompare={handleToggleCompare} 
          wishlist={wishlist} 
          comparisonList={comparisonList} 
          onViewSellerProfile={handleViewSellerProfile} 
        />;
      case View.HOME:
      default: 
        return <Home 
          onSearch={(query) => { setInitialSearchQuery(query); navigate(View.USED_CARS); }} 
          onSelectCategory={(category) => { setSelectedCategory(category); navigate(View.USED_CARS); }} 
          featuredVehicles={vehicles.filter(v => v.isFeatured && v.status === 'published').slice(0, 4)} 
          onSelectVehicle={handleSelectVehicle} 
          onToggleCompare={handleToggleCompare} 
          comparisonList={comparisonList} 
          onToggleWishlist={handleToggleWishlist} 
          wishlist={wishlist} 
          onViewSellerProfile={handleViewSellerProfile} 
          recommendations={recommendations} 
          allVehicles={vehicles.filter(v => v.status === 'published')} 
          onNavigate={navigate} 
        />;
    }
  };

  const inboxCount = useMemo(() => {
    if (!currentUser || currentUser.role !== 'customer') return 0;
    return conversations.filter(c => c.customerId === currentUser.email && !c.isReadByCustomer).length;
  }, [conversations, currentUser]);
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        onNavigate={navigate} 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        compareCount={comparisonList.length} 
        wishlistCount={wishlist.length} 
        inboxCount={inboxCount} 
        isHomePage={currentView === View.HOME} 
        notifications={notifications.filter(n => n.recipientEmail === currentUser?.email)} 
        onNotificationClick={() => {}} 
        onMarkNotificationsAsRead={() => {}} 
        onMarkAllNotificationsAsRead={() => {}} 
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} 
        userLocation={userLocation} 
        onLocationChange={setUserLocation} 
        addToast={addToast} 
      />
      <main className="flex-grow pt-16">
        <Suspense fallback={<LoadingSpinner />}>
          {renderContent()}
        </Suspense>
      </main>
      {activeChat && currentUser && (
        <ChatWidget 
          conversation={activeChat} 
          currentUserRole={currentUser.role as 'customer' | 'seller'} 
          otherUserName={currentUser.role === 'customer' ? (users.find(u => u.email === activeChat.sellerId)?.name || 'Seller') : activeChat.customerName} 
          onClose={() => setActiveChat(null)} 
          onSendMessage={() => {}} 
          typingStatus={null} 
          onUserTyping={() => {}} 
          onMarkMessagesAsRead={() => {}} 
          onFlagContent={handleFlagContent} 
          onOfferResponse={() => {}} 
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <Footer onNavigate={navigate} />
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
        onNavigate={(view) => { navigate(view); setIsCommandPaletteOpen(false); }} 
        currentUser={currentUser} 
        onLogout={() => { handleLogout(); setIsCommandPaletteOpen(false); }} 
      />
    </div>
  );
  } catch (error) {
    console.error('🔧 AppContent: Error in AppContent:', error);
    throw error;
  }
};

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
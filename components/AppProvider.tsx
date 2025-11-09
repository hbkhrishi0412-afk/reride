import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Vehicle, User, Conversation, Toast as ToastType, PlatformSettings, AuditLogEntry, VehicleData, Notification, VehicleCategory, SupportTicket, FAQItem, SubscriptionPlan } from '../types';
import { View, VehicleCategory as CategoryEnum } from '../types';
import { getRatings, addRating, getSellerRatings, addSellerRating } from '../services/ratingService';
import { getConversations, saveConversations } from '../services/chatService';
import { getSettings, saveSettings } from '../services/settingsService';
import { getAuditLog, logAction, saveAuditLog } from '../services/auditLogService';
import { showNotification } from '../services/notificationService';
import { getFaqs, saveFaqs } from '../services/faqService';
import { getSupportTickets, saveSupportTickets } from '../services/supportTicketService';
import { dataService } from '../services/dataService';
import { loadingManager, LOADING_OPERATIONS, withLoadingTimeout } from '../utils/loadingManager';
import { useTimeout } from '../hooks/useCleanup';
import { VEHICLE_DATA } from './vehicleData';

interface VehicleUpdateOptions {
  successMessage?: string;
  skipToast?: boolean;
}

interface AppContextType {
  // State
  currentView: View;
  previousView: View;
  selectedVehicle: Vehicle | null;
  vehicles: Vehicle[];
  isLoading: boolean;
  currentUser: User | null;
  comparisonList: number[];
  ratings: { [key: string]: number[] };
  sellerRatings: { [key: string]: number[] };
  wishlist: number[];
  conversations: Conversation[];
  toasts: ToastType[];
  forgotPasswordRole: 'customer' | 'seller' | null;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  selectedCategory: VehicleCategory | 'ALL';
  publicSellerProfile: User | null;
  activeChat: Conversation | null;
  isAnnouncementVisible: boolean;
  recommendations: Vehicle[];
  initialSearchQuery: string;
  isCommandPaletteOpen: boolean;
  userLocation: string;
  selectedCity: string;
  users: User[];
  platformSettings: PlatformSettings;
  auditLog: AuditLogEntry[];
  vehicleData: VehicleData;
  faqItems: FAQItem[];
  supportTickets: SupportTicket[];
  notifications: Notification[];

  // Actions
  setCurrentView: (view: View) => void;
  setPreviousView: (view: View) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  setVehicles: (vehicles: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  setComparisonList: (list: number[] | ((prev: number[]) => number[])) => void;
  setWishlist: (list: number[] | ((prev: number[]) => number[])) => void;
  setConversations: (conversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  setToasts: (toasts: ToastType[]) => void;
  setForgotPasswordRole: (role: 'customer' | 'seller' | null) => void;
  setTypingStatus: (status: { conversationId: string; userRole: 'customer' | 'seller' } | null) => void;
  setSelectedCategory: (category: VehicleCategory | 'ALL') => void;
  setPublicSellerProfile: (profile: User | null) => void;
  setActiveChat: (chat: Conversation | null) => void;
  setIsAnnouncementVisible: (visible: boolean) => void;
  setRecommendations: (recommendations: Vehicle[]) => void;
  setInitialSearchQuery: (query: string) => void;
  setIsCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setUserLocation: (location: string) => void;
  setSelectedCity: (city: string) => void;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setPlatformSettings: (settings: PlatformSettings) => void;
  setAuditLog: (log: AuditLogEntry[]) => void;
  setVehicleData: (data: VehicleData) => void;
  setFaqItems: (items: FAQItem[]) => void;
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  setNotifications: (notifications: Notification[]) => void;
  setRatings: (ratings: { [key: string]: number[] }) => void;
  setSellerRatings: (ratings: { [key: string]: number[] } | ((prev: { [key: string]: number[] }) => { [key: string]: number[] })) => void;

  // Helper functions
  addToast: (message: string, type: ToastType['type']) => void;
  removeToast: (id: number) => void;
  handleLogout: () => void;
  handleLogin: (user: User) => void;
  handleRegister: (user: User) => void;
  navigate: (view: View, params?: { city?: string }) => void;
  
  // Admin functions
  onCreateUser: (userData: Omit<User, 'status'>) => Promise<{ success: boolean, reason: string }>;
  onAdminUpdateUser: (email: string, details: Partial<User>) => void;
      onUpdateUserPlan: (email: string, plan: SubscriptionPlan) => Promise<void>;
    onToggleUserStatus: (email: string) => Promise<void>;
    onToggleVehicleStatus: (vehicleId: number) => Promise<void>;
    onToggleVehicleFeature: (vehicleId: number) => Promise<void>;
  onResolveFlag: (type: 'vehicle' | 'conversation', id: number | string) => void;
  onUpdateSettings: (settings: PlatformSettings) => void;
  onSendBroadcast: (message: string) => void;
  onExportUsers: () => void;
  onExportVehicles: () => void;
  onExportSales: () => void;
  onUpdateVehicleData: (newData: VehicleData) => void;
  onToggleVerifiedStatus: (email: string) => void;
  onUpdateSupportTicket: (ticket: SupportTicket) => void;
  onAddFaq: (faq: Omit<FAQItem, 'id'>) => void;
  onUpdateFaq: (faq: FAQItem) => void;
  onDeleteFaq: (id: number) => void;
  onCertificationApproval: (vehicleId: number, decision: 'approved' | 'rejected') => void;
  
  // Additional functions
  addRating: (vehicleId: number, rating: number) => void;
  addSellerRating: (sellerEmail: string, rating: number) => void;
  sendMessage: (conversationId: string, message: string) => void;
  markAsRead: (conversationId: string) => void;
  toggleTyping: (conversationId: string, isTyping: boolean) => void;
  flagContent: (type: 'vehicle' | 'conversation', id: number | string) => void;
  updateUser: (email: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (email: string) => void;
  updateVehicle: (id: number, updates: Partial<Vehicle>, options?: VehicleUpdateOptions) => Promise<void>;
  deleteVehicle: (id: number) => void;
  selectVehicle: (vehicle: Vehicle) => void;
  toggleWishlist: (vehicleId: number) => void;
  toggleCompare: (vehicleId: number) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = React.memo(({ children }) => {
  
  // All state from App.tsx moved here
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [previousView, setPreviousView] = useState<View>(View.HOME);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Check for existing logged-in user on app startup
    try {
      const savedUser = localStorage.getItem('reRideCurrentUser');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        console.log('🔄 Restoring logged-in user:', user.name, user.role);
        return user;
      }
    } catch (error) {
      console.warn('Failed to load user from localStorage:', error);
    }
    return null;
  });
  const [comparisonList, setComparisonList] = useState<number[]>([]);
  const [ratings, setRatings] = useState<{ [key: string]: number[] }>({});
  const [sellerRatings, setSellerRatings] = useState<{ [key: string]: number[] }>({});
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [forgotPasswordRole, setForgotPasswordRole] = useState<'customer' | 'seller' | null>(null);
  const [typingStatus, setTypingStatus] = useState<{ conversationId: string; userRole: 'customer' | 'seller' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory | 'ALL'>(CategoryEnum.FOUR_WHEELER);
  const [publicSellerProfile, setPublicSellerProfile] = useState<User | null>(null);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(true);
  const [recommendations, setRecommendations] = useState<Vehicle[]>([]);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<string>('Mumbai');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(() => getSettings());
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => getAuditLog());
  const [vehicleData, setVehicleData] = useState<VehicleData>(() => {
    // Try to load from localStorage first, fallback to static data
    try {
      const savedVehicleData = localStorage.getItem('reRideVehicleData');
      if (savedVehicleData) {
        return JSON.parse(savedVehicleData);
      }
    } catch (error) {
      console.warn('Failed to load vehicle data from localStorage:', error);
    }
    return VEHICLE_DATA;
  });
  const [faqItems, setFaqItems] = useState<FAQItem[]>(() => getFaqs() || []);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => getSupportTickets() || []);
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const notificationsJson = localStorage.getItem('reRideNotifications');
      if (notificationsJson) {
        return JSON.parse(notificationsJson);
      } else {
        // Create sample notifications for testing
        const sampleNotifications: Notification[] = [
          {
            id: 1,
            recipientEmail: 'seller@test.com',
            message: 'New message from Mock Customer: Offer: 600000',
            targetId: 'conv_1703123456789',
            targetType: 'conversation',
            isRead: false,
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
          },
          {
            id: 2,
            recipientEmail: 'seller@test.com',
            message: 'New message from Mock Customer: Offer: 123444',
            targetId: 'conv_1703123456789',
            targetType: 'conversation',
            isRead: false,
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
          }
        ];
        localStorage.setItem('reRideNotifications', JSON.stringify(sampleNotifications));
        return sampleNotifications;
      }
    } catch { 
      return []; 
    }
  });

  const addToast = useCallback((message: string, type: ToastType['type']) => {
    try {
      // Validate inputs
      if (!message || typeof message !== 'string' || message.trim() === '') {
        console.warn('Invalid toast message provided');
        return;
      }
      
      if (!['success', 'error', 'warning', 'info'].includes(type)) {
        console.warn('Invalid toast type provided:', type);
        return;
      }

      const id = Date.now();
      const toast: ToastType = { id, message: message.trim(), type };
      setToasts(prev => [...prev, toast]);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    } catch (error) {
      console.error('Error adding toast:', error);
    }
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('reRideCurrentUser');
    setCurrentView(View.HOME);
    setActiveChat(null);
    addToast('You have been logged out.', 'info');
  }, [addToast]);

  const handleLogin = useCallback((user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('reRideCurrentUser', JSON.stringify(user));
    addToast(`Welcome back, ${user.name}!`, 'success');
    
    // Navigate based on user role
    if (user.role === 'admin') {
      setCurrentView(View.ADMIN_PANEL);
    } else if (user.role === 'seller') {
      setCurrentView(View.SELLER_DASHBOARD);
    } else {
      setCurrentView(View.HOME);
    }
  }, [addToast]);

  const handleRegister = useCallback((user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('reRideCurrentUser', JSON.stringify(user));
    addToast(`Welcome to ReRide, ${user.name}!`, 'success');
    
    // Navigate based on user role
    if (user.role === 'admin') {
      setCurrentView(View.ADMIN_PANEL);
    } else if (user.role === 'seller') {
      setCurrentView(View.SELLER_DASHBOARD);
    } else {
      setCurrentView(View.HOME);
    }
  }, [addToast]);

  const navigate = useCallback((view: View, params?: { city?: string }) => {
    const isNavigatingAwayFromSellerProfile = currentView === View.SELLER_PROFILE && view !== View.SELLER_PROFILE;
    if (isNavigatingAwayFromSellerProfile) { 
      window.history.pushState({}, '', window.location.pathname); 
      setPublicSellerProfile(null); 
    }
    setInitialSearchQuery('');
    
    // Fixed: Preserve selectedVehicle when navigating TO DETAIL view or between DETAIL and SELLER_PROFILE
    const preserveSelectedVehicle = view === View.DETAIL || 
      (view === View.SELLER_PROFILE && currentView === View.DETAIL) || 
      (view === View.DETAIL && currentView === View.SELLER_PROFILE);
    
    if (!preserveSelectedVehicle) setSelectedVehicle(null);
    
    if (view === View.USED_CARS && currentView !== View.HOME) setSelectedCategory('ALL');
    if (view === View.CITY_LANDING && params?.city) {
      setSelectedCity(params.city);
    }
    if (view === View.USED_CARS && params?.city) {
      setSelectedCity(params.city);
    }
    if (view === View.SELLER_DASHBOARD && currentUser?.role !== 'seller') setCurrentView(View.LOGIN_PORTAL);
    else if (view === View.ADMIN_PANEL && currentUser?.role !== 'admin') setCurrentView(View.ADMIN_LOGIN);
    else if (view === View.NEW_CARS_ADMIN_PANEL && currentUser?.role !== 'admin') setCurrentView(View.NEW_CARS_ADMIN_LOGIN);
    else if ((view === View.PROFILE || view === View.INBOX) && !currentUser) setCurrentView(View.LOGIN_PORTAL);
    else setCurrentView(view);

    // Update path for friendly URLs
    try {
      let newPath = window.location.pathname;
      if (view === View.ADMIN_LOGIN) newPath = '/admin/login';
      else if (view === View.NEW_CARS_ADMIN_LOGIN) newPath = '/admin/new-cars';
      else if (view === View.NEW_CARS_ADMIN_PANEL) newPath = '/admin/new-cars/manage';
      else if (view === View.LOGIN_PORTAL || view === View.CUSTOMER_LOGIN || view === View.SELLER_LOGIN) newPath = '/login';
      else if (view === View.HOME) newPath = '/';
      if (newPath !== window.location.pathname) {
        window.history.pushState({}, '', newPath);
      }
    } catch {}
  }, [currentView, currentUser]);

  // Map initial path on first load to views (/login, /admin/login)
  useEffect(() => {
    try {
      const path = window.location.pathname.toLowerCase();
      if (path === '/admin' || path === '/admin/login') {
        setCurrentView(View.ADMIN_LOGIN);
      } else if (path === '/admin/new-cars') {
        setCurrentView(View.NEW_CARS_ADMIN_LOGIN);
      } else if (path === '/admin/new-cars/manage') {
        setCurrentView(View.NEW_CARS_ADMIN_PANEL);
      } else if (path === '/login') {
        setCurrentView(View.LOGIN_PORTAL);
      }
    } catch {}
  }, []);

  // Load initial data with optimized loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        
        // Load critical data first (vehicles and users)
        const [vehiclesData, usersData] = await Promise.all([
          dataService.getVehicles(),
          dataService.getUsers()
        ]);
        
        setVehicles(vehiclesData);
        setUsers(usersData);
        
        // Set some recommendations (first 6 vehicles)
        setRecommendations(vehiclesData.slice(0, 6));
        
        // Load non-critical data in background
        Promise.all([
          dataService.getVehicleData(),
          Promise.resolve(getConversations()) // Will be filtered by currentUser when displayed
        ]).then(([vehicleDataData, conversationsData]) => {
          setVehicleData(vehicleDataData);
          // Store all conversations, but filter will be applied in App.tsx when displaying
          setConversations(conversationsData);
        }).catch(error => {
          console.warn('Background data loading failed:', error);
        });
        
      } catch (error) {
        console.error('AppProvider: Error loading initial data:', error);
        addToast('Failed to load vehicle data. Please refresh the page.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [addToast]);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  // Sync activeChat when conversations change
  useEffect(() => {
    if (activeChat) {
      const updatedConversation = conversations.find(conv => conv.id === activeChat.id);
      if (updatedConversation) {
        // Use shallow comparison instead of deep JSON comparison to avoid infinite loops
        const hasChanges = 
          updatedConversation.messages.length !== activeChat.messages.length ||
          updatedConversation.lastMessageAt !== activeChat.lastMessageAt ||
          updatedConversation.isReadBySeller !== activeChat.isReadBySeller ||
          updatedConversation.isReadByCustomer !== activeChat.isReadByCustomer;
        
        if (hasChanges) {
          setActiveChat(updatedConversation);
        }
      }
    }
  }, [conversations, activeChat?.id]); // Added activeChat?.id for proper reactivity

  // Add navigation event listener for dashboard navigation
  useEffect(() => {
    const handleNavigationEvent = (event: CustomEvent) => {
      const { view } = event.detail;
      if (view && Object.values(View).includes(view)) {
        navigate(view as View);
      }
    };

    window.addEventListener('navigate', handleNavigationEvent as EventListener);
    return () => {
      window.removeEventListener('navigate', handleNavigationEvent as EventListener);
    };
  }, [navigate]);

  // Add online/offline sync functionality
  useEffect(() => {
    const handleOnline = () => {
      console.log('🔄 App came online, syncing data...');
      dataService.syncWhenOnline().then(() => {
        console.log('✅ Data sync completed');
        addToast('Data synchronized successfully', 'success');
      }).catch((error) => {
        console.warn('⚠️ Data sync failed:', error);
        addToast('Data sync failed, but app is still functional', 'warning');
      });
    };

    const handleOffline = () => {
      console.log('📴 App went offline');
      addToast('You are now offline. Changes will sync when connection is restored.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  const updateVehicleHandler = useCallback(async (id: number, updates: Partial<Vehicle>, options: VehicleUpdateOptions = {}) => {
    try {
      const vehicleToUpdate = vehicles.find(v => v.id === id);
      if (!vehicleToUpdate) {
        addToast('Vehicle not found', 'error');
        return;
      }

      const updatedVehicle = { ...vehicleToUpdate, ...updates };
      const { updateVehicle: updateVehicleApi } = await import('../services/vehicleService');
      const result = await updateVehicleApi(updatedVehicle);

      setVehicles(prev =>
        prev.map(vehicle => (vehicle.id === id ? result : vehicle))
      );

      const wasFeatured = Boolean(vehicleToUpdate.isFeatured);
      const isNowFeatured = Boolean(result?.isFeatured);
      const statusChanged = updates.status !== undefined && updates.status !== vehicleToUpdate.status;
      const { successMessage, skipToast } = options;
      let fallbackMessage = 'Vehicle updated successfully';
      if (statusChanged) {
        fallbackMessage = `Vehicle status updated to ${updates.status}`;
      } else if (!wasFeatured && isNowFeatured) {
        fallbackMessage = 'Vehicle featured successfully';
      } else if (wasFeatured && !isNowFeatured) {
        fallbackMessage = 'Vehicle unfeatured successfully';
      }

      if (!skipToast) {
        addToast(successMessage ?? fallbackMessage, 'success');
      }
      console.log('✅ Vehicle updated via API:', result);
    } catch (error) {
      console.error('❌ Failed to update vehicle:', error);
      addToast('Failed to update vehicle. Please try again.', 'error');
    }
  }, [vehicles, addToast, setVehicles]);

  const contextValue: AppContextType = useMemo(() => ({
    // State
    currentView,
    previousView,
    selectedVehicle,
    vehicles,
    isLoading,
    currentUser,
    comparisonList,
    ratings,
    sellerRatings,
    wishlist,
    conversations,
    toasts,
    forgotPasswordRole,
    typingStatus,
    selectedCategory,
    publicSellerProfile,
    activeChat,
    isAnnouncementVisible,
    recommendations,
    initialSearchQuery,
    isCommandPaletteOpen,
    userLocation,
    selectedCity,
    users,
    platformSettings,
    auditLog,
    vehicleData,
    faqItems,
    supportTickets,
    notifications,

    // Actions
    setCurrentView,
    setPreviousView,
    setSelectedVehicle,
    setVehicles: setVehicles as (vehicles: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void,
    setIsLoading,
    setCurrentUser,
    setComparisonList: setComparisonList as (list: number[] | ((prev: number[]) => number[])) => void,
    setWishlist: setWishlist as (list: number[] | ((prev: number[]) => number[])) => void,
    setConversations: setConversations as (conversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void,
    setToasts,
    setForgotPasswordRole,
    setTypingStatus,
    setSelectedCategory,
    setPublicSellerProfile,
    setActiveChat,
    setIsAnnouncementVisible,
    setRecommendations,
    setInitialSearchQuery,
    setIsCommandPaletteOpen,
    setUserLocation,
    setSelectedCity,
    setUsers,
    setPlatformSettings,
    setAuditLog,
    setVehicleData,
    setFaqItems,
    setSupportTickets,
    setNotifications,
    setRatings,
    setSellerRatings: setSellerRatings as (ratings: { [key: string]: number[] } | ((prev: { [key: string]: number[] }) => { [key: string]: number[] })) => void,

    // Helper functions
    addToast,
    removeToast,
    handleLogout,
    handleLogin,
    handleRegister,
    navigate,
    
    // Admin functions
    onAdminUpdateUser: async (email: string, details: Partial<User>) => {
      const sanitizedDetails = Object.fromEntries(
        Object.entries(details).filter(([, value]) => value !== undefined)
      ) as Partial<User>;

      setUsers(prev =>
        prev.map(user =>
          user.email === email ? { ...user, ...sanitizedDetails } : user
        )
      );
      
      // Also update in MongoDB
      try {
        await updateUser(email, sanitizedDetails);
      } catch (error) {
        console.warn('Failed to sync user update to MongoDB:', error);
      }
      
      addToast(`User ${email} updated successfully`, 'success');
    },
    onCreateUser: async (userData: Omit<User, 'status'>): Promise<{ success: boolean, reason: string }> => {
      try {
        // Check if user already exists
        const existingUser = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
        if (existingUser) {
          return { success: false, reason: 'User with this email already exists.' };
        }

        // Add to local state
        const newUser: User = {
          ...userData,
          status: 'active',
          subscriptionPlan: userData.subscriptionPlan || 'free',
          featuredCredits: userData.featuredCredits || 0,
          usedCertifications: userData.usedCertifications || 0,
        };
        
        setUsers(prev => [...prev, newUser]);
        
        // Save to localStorage in development
        const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
        if (isDevelopment) {
          const { getUsersLocal } = await import('../services/userService');
          const users = await getUsersLocal();
          users.push(newUser);
          localStorage.setItem('reRideUsers', JSON.stringify(users));
        }
        
        // Save to MongoDB via API
        try {
          const response = await fetch('/api/main', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'register',
              email: newUser.email,
              password: newUser.password,
              name: newUser.name,
              mobile: newUser.mobile,
              role: newUser.role,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
            console.warn('⚠️ Failed to save user to MongoDB:', errorData.reason || 'Unknown error');
            // User is still created locally, just MongoDB sync failed
            addToast(`User created locally. MongoDB sync failed: ${errorData.reason || 'Unknown error'}`, 'warning');
          } else {
            console.log('✅ User created and saved to MongoDB:', newUser.email);
            addToast(`User ${newUser.name} created successfully`, 'success');
          }
        } catch (apiError) {
          console.error('❌ Error saving user to MongoDB:', apiError);
          addToast(`User created locally. Failed to sync to MongoDB.`, 'warning');
        }
        
        return { success: true, reason: '' };
      } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, reason: error instanceof Error ? error.message : 'Failed to create user.' };
      }
    },
          onUpdateUserPlan: async (email: string, plan: SubscriptionPlan) => {
        try {
          await updateUser(email, { subscriptionPlan: plan });
          setUsers(prev => prev.map(user => 
            user.email === email ? { ...user, subscriptionPlan: plan } : user
          ));
          addToast(`Plan updated for ${email}`, 'success');
        } catch (error) {
          console.error('Failed to update user plan:', error);
          addToast('Failed to update user plan', 'error');
        }
      },
      onToggleUserStatus: async (email: string) => {
        try {
          const user = users.find(u => u.email === email);
          if (!user) return;
          
          const newStatus = user.status === 'active' ? 'inactive' : 'active';
          await updateUser(email, { status: newStatus });
          setUsers(prev => prev.map(user => 
            user.email === email ? { ...user, status: newStatus } : user
          ));
          addToast(`User status toggled for ${email}`, 'success');
        } catch (error) {
          console.error('Failed to toggle user status:', error);
          addToast('Failed to toggle user status', 'error');
        }
      },
      onToggleVehicleStatus: async (vehicleId: number) => {
        try {
          const vehicle = vehicles.find(v => v.id === vehicleId);
          if (!vehicle) return;
          
          const newStatus = vehicle.status === 'published' ? 'unpublished' : 'published';
          await updateVehicleHandler(vehicleId, { status: newStatus });
        } catch (error) {
          console.error('Failed to toggle vehicle status:', error);
          addToast('Failed to update vehicle status', 'error');
        }
      },
      onToggleVehicleFeature: async (vehicleId: number) => {
        try {
          const vehicle = vehicles.find(v => v.id === vehicleId);
          if (!vehicle) {
            addToast('Vehicle not found', 'error');
            return;
          }

          // Unfeature path: simple toggle off
          if (vehicle.isFeatured) {
            await updateVehicleHandler(vehicleId, { isFeatured: false });
            return;
          }

          // Feature path: use API to enforce credits
          const response = await fetch('/api/vehicles?action=feature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleId })
          });

          const responseText = await response.text();
          let result: any = {};
          if (responseText) {
            try {
              result = JSON.parse(responseText);
            } catch (parseError) {
              console.warn('⚠️ Failed to parse feature response JSON:', parseError);
            }
          }

          if (!response.ok) {
            const message =
              result?.reason ||
              result?.error ||
              `Failed to feature vehicle (HTTP ${response.status})`;
            addToast(message, response.status === 403 ? 'warning' : 'error');
            return;
          }

          if (result?.alreadyFeatured) {
            addToast('Vehicle is already featured.', 'info');
            return;
          }

          if (result?.success && result.vehicle) {
            setVehicles(prev =>
              prev.map(v => (v.id === vehicleId ? result.vehicle : v))
            );

            const sellerEmail = result.vehicle?.sellerEmail;
            if (typeof result.remainingCredits === 'number' && sellerEmail) {
              const remainingCredits = result.remainingCredits;

              setUsers(prev =>
                prev.map(user =>
                  user.email === sellerEmail
                    ? { ...user, featuredCredits: remainingCredits }
                    : user
                )
              );

              setCurrentUser(prev =>
                prev && prev.email === sellerEmail
                  ? { ...prev, featuredCredits: remainingCredits }
                  : prev
              );

              addToast(
                `Vehicle featured successfully. Credits remaining: ${remainingCredits}`,
                'success'
              );
            } else {
              addToast('Vehicle featured successfully', 'success');
            }
          } else {
            addToast('Failed to feature vehicle. Please try again.', 'error');
          }
        } catch (error) {
          console.error('Failed to toggle vehicle feature:', error);
          addToast('Failed to update vehicle feature status', 'error');
        }
      },
    onResolveFlag: (type: 'vehicle' | 'conversation', id: number | string) => {
      if (type === 'vehicle') {
        setVehicles(prev => prev.map(vehicle => 
          vehicle.id === id ? { ...vehicle, isFlagged: false } : vehicle
        ));
      } else {
        setConversations(prev => prev.map(conv => 
          conv.id === id ? { ...conv, isFlagged: false } : conv
        ));
      }
      addToast(`Flag resolved for ${type}`, 'success');
    },
    onUpdateSettings: (settings: PlatformSettings) => {
      setPlatformSettings(settings);
      addToast('Platform settings updated', 'success');
    },
    onSendBroadcast: (message: string) => {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        recipientEmail: 'all',
        message,
        targetId: 'broadcast',
        targetType: 'general_admin' as const,
        timestamp: new Date().toISOString(),
        isRead: false
      }]);
      addToast('Broadcast sent to all users', 'success');
    },
    onExportUsers: () => {
      try {
        const headers = 'Name,Email,Role,Status,Mobile,Join Date\n';
        const csv = users.map(user => 
          `"${user.name}","${user.email}","${user.role}","${user.status}","${user.mobile || ''}","${user.joinedDate || ''}"`
        ).join('\n');
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast(`Exported ${users.length} users successfully`, 'success');
      } catch (error) {
        console.error('Export failed:', error);
        addToast('Export failed. Please try again.', 'error');
      }
    },
    onExportVehicles: () => {
      try {
        const headers = 'Make,Model,Year,Price,Seller,Status,Mileage,Location,Features\n';
        const csv = vehicles.map(vehicle => 
          `"${vehicle.make}","${vehicle.model}","${vehicle.year}","${vehicle.price}","${vehicle.sellerEmail}","${vehicle.status}","${vehicle.mileage || ''}","${vehicle.location || ''}","${vehicle.features?.join('; ') || ''}"`
        ).join('\n');
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vehicles_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast(`Exported ${vehicles.length} vehicles successfully`, 'success');
      } catch (error) {
        console.error('Export failed:', error);
        addToast('Export failed. Please try again.', 'error');
      }
    },
    onExportSales: () => {
      try {
        const soldVehicles = vehicles.filter(v => v.status === 'sold');
        const headers = 'Make,Model,Year,Sale Price,Seller,Buyer,Sale Date\n';
        const csv = soldVehicles.map(vehicle => 
          `"${vehicle.make}","${vehicle.model}","${vehicle.year}","${vehicle.price}","${vehicle.sellerEmail}","N/A","N/A"`
        ).join('\n');
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast(`Exported ${soldVehicles.length} sales records successfully`, 'success');
      } catch (error) {
        console.error('Export failed:', error);
        addToast('Export failed. Please try again.', 'error');
      }
    },
    onUpdateVehicleData: async (newData: VehicleData) => {
      try {
        // Update local state first
        setVehicleData(newData);
        
        // Save to API for persistence with enhanced error handling
        const { saveVehicleData } = await import('../services/vehicleDataService');
        const success = await saveVehicleData(newData);
        
        if (success) {
          addToast('Vehicle data updated and synced successfully', 'success');
          console.log('✅ Vehicle data updated via API:', newData);
        } else {
          // Fallback to localStorage if API fails
          try {
            localStorage.setItem('reRideVehicleData', JSON.stringify(newData));
            addToast('Vehicle data updated (saved locally, will sync when online)', 'warning');
            console.warn('⚠️ API failed, saved to localStorage as fallback');
            
            // Import sync service to mark pending changes
            const { syncService } = await import('../services/syncService');
            syncService.markPendingChanges();
          } catch (error) {
            console.warn('Failed to save vehicle data to localStorage:', error);
            addToast('Failed to save vehicle data', 'error');
          }
        }
      } catch (error) {
        console.error('❌ Failed to update vehicle data:', error);
        addToast('Failed to update vehicle data. Please try again.', 'error');
      }
    },
    onToggleVerifiedStatus: (email: string) => {
      setUsers(prev => prev.map(user => 
        user.email === email ? { ...user, isVerified: !user.isVerified } : user
      ));
      addToast(`Verification status toggled for ${email}`, 'success');
    },
    onUpdateSupportTicket: (ticket: SupportTicket) => {
      setSupportTickets(prev => prev.map(t => 
        t.id === ticket.id ? ticket : t
      ));
      addToast('Support ticket updated', 'success');
    },
    onAddFaq: (faq: Omit<FAQItem, 'id'>) => {
      const newFaq: FAQItem = { ...faq, id: Date.now() };
      setFaqItems(prev => [...prev, newFaq]);
      addToast('FAQ added successfully', 'success');
    },
    onUpdateFaq: (faq: FAQItem) => {
      setFaqItems(prev => prev.map(f => f.id === faq.id ? faq : f));
      addToast('FAQ updated successfully', 'success');
    },
    onDeleteFaq: (id: number) => {
      setFaqItems(prev => prev.filter(f => f.id !== id));
      addToast('FAQ deleted successfully', 'success');
    },
    onCertificationApproval: (vehicleId: number, decision: 'approved' | 'rejected') => {
      setVehicles(prev => prev.map(vehicle => 
        vehicle.id === vehicleId ? { 
          ...vehicle, 
          certificationStatus: decision === 'approved' ? 'certified' : 'rejected' 
        } : vehicle
      ));
      addToast(`Certification ${decision} for vehicle`, 'success');
    },
    
    // Additional functions
    addRating: (vehicleId: number, rating: number) => {
      setRatings(prev => ({
        ...prev,
        [vehicleId]: [...(prev[vehicleId] || []), rating]
      }));
      addToast('Rating added successfully', 'success');
    },
    addSellerRating: (sellerEmail: string, rating: number) => {
      setSellerRatings(prev => ({
        ...prev,
        [sellerEmail]: [...(prev[sellerEmail] || []), rating]
      }));
      addToast('Seller rating added successfully', 'success');
    },
    sendMessage: (conversationId: string, message: string) => {
      console.log('🔧 sendMessage called:', { conversationId, message, currentUser: currentUser?.email });
      
      try {
        const newMessage = {
          id: Date.now(),
          sender: (currentUser?.role === 'seller' ? 'seller' : 'user') as 'seller' | 'user',
          text: message,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'text' as const
        };

        // Update conversations first
        setConversations(prev => {
          const updated = prev.map(conv => 
            conv.id === conversationId ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessageAt: newMessage.timestamp,
              isReadBySeller: currentUser?.role === 'seller' ? true : conv.isReadBySeller,
              isReadByCustomer: currentUser?.role === 'customer' ? true : conv.isReadByCustomer
            } : conv
          );
          
          console.log('🔧 Updated conversations:', updated);
          return updated;
        });

        // Update activeChat separately to avoid race conditions
        if (activeChat?.id === conversationId) {
          setActiveChat(prev => {
            if (prev?.id === conversationId) {
              return {
                ...prev,
                messages: [...prev.messages, newMessage],
                lastMessageAt: newMessage.timestamp,
                isReadBySeller: currentUser?.role === 'seller' ? true : prev.isReadBySeller,
                isReadByCustomer: currentUser?.role === 'customer' ? true : prev.isReadByCustomer
              };
            }
            return prev;
          });
        }

        // Create notification for the recipient
        if (currentUser) {
          const conversation = conversations.find(conv => conv.id === conversationId);
          if (conversation) {
            const recipientEmail = currentUser.role === 'seller' ? conversation.customerId : conversation.sellerId;
            const senderName = currentUser.role === 'seller' ? 'Seller' : conversation.customerName;
            
            const newNotification: Notification = {
              id: Date.now() + 1, // Ensure unique ID
              recipientEmail,
              message: `New message from ${senderName}: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`,
              targetId: conversationId,
              targetType: 'conversation',
              isRead: false,
              timestamp: new Date().toISOString()
            };

            // Update notifications separately
            setNotifications(prevNotifications => {
              const updatedNotifications = [newNotification, ...prevNotifications];
              // Save to localStorage
              try {
                localStorage.setItem('reRideNotifications', JSON.stringify(updatedNotifications));
              } catch (error) {
                console.error('Failed to save notifications to localStorage:', error);
              }
              return updatedNotifications;
            });
          }
        }
      } catch (error) {
        console.error('Error in sendMessage:', error);
        addToast('Failed to send message. Please try again.', 'error');
      }
    },
    markAsRead: (conversationId: string) => {
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? {
          ...conv,
          messages: conv.messages.map(msg => ({ ...msg, isRead: true }))
        } : conv
      ));
    },
    toggleTyping: (conversationId: string, isTyping: boolean) => {
      setTypingStatus(isTyping ? { conversationId, userRole: (currentUser?.role === 'seller' ? 'seller' : 'customer') as 'seller' | 'customer' } : null);
    },
    flagContent: (type: 'vehicle' | 'conversation', id: number | string) => {
      if (type === 'vehicle') {
        setVehicles(prev => prev.map(vehicle => 
          vehicle.id === id ? { ...vehicle, isFlagged: true } : vehicle
        ));
      } else {
        setConversations(prev => prev.map(conv => 
          conv.id === id ? { ...conv, isFlagged: true } : conv
        ));
      }
      addToast(`Content flagged for review`, 'warning');
    },
    updateUser: async (email: string, updates: Partial<User>) => {
      try {
        // Check if we're in development mode (localStorage)
        const isDevelopment = import.meta.env.DEV || 
                             window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1' ||
                             window.location.hostname.includes('localhost') ||
                             window.location.hostname.includes('127.0.0.1');
        
        // First update local state for immediate UI response
        setUsers(prev => prev.map(user => 
          user.email === email ? { ...user, ...updates } : user
        ));
        
        // Also update currentUser if it's the same user
        if (currentUser && currentUser.email === email) {
          setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
          
          // Update localStorage as well
          try {
            const updatedUser = { ...currentUser, ...updates };
            localStorage.setItem('reRideCurrentUser', JSON.stringify(updatedUser));
            sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
          } catch (error) {
            console.error('Failed to update user in localStorage:', error);
          }
        }
        
        // In development mode, also update the localStorage users array
        // This is critical for password updates to persist
        if (isDevelopment) {
          try {
            const { updateUser: updateUserService } = await import('../services/userService');
            await updateUserService({ email, ...updates });
            console.log('✅ User updated in localStorage users array');
          } catch (localError) {
            console.warn('⚠️ Failed to update user in localStorage users array:', localError);
            // Try manual update as fallback
            try {
              const usersJson = localStorage.getItem('reRideUsers');
              if (usersJson) {
                const users = JSON.parse(usersJson);
                const updatedUsers = users.map((user: User) => 
                  user.email === email ? { ...user, ...updates } : user
                );
                localStorage.setItem('reRideUsers', JSON.stringify(updatedUsers));
                console.log('✅ User updated in localStorage (manual fallback)');
              }
            } catch (fallbackError) {
              console.error('❌ Failed to update user in localStorage (fallback):', fallbackError);
            }
          }
        }
        
        // Now update MongoDB via API call (production or when API is available)
        try {
          console.log('📡 Sending user update request to API...', { email, hasPassword: !!updates.password });
          
          const response = await fetch('/api/users', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              ...updates
            })
          });
          
          console.log('📥 API response received:', { status: response.status, ok: response.ok });
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `API call failed: ${response.status}`;
            let errorData: any = {};
            
            try {
              errorData = JSON.parse(errorText);
              if (errorData.reason) {
                errorMessage = errorData.reason;
              } else if (errorData.error) {
                errorMessage = errorData.error;
              } else if (errorData.message) {
                errorMessage = errorData.message;
              }
            } catch {
              // If we can't parse the error, use the status text
              errorMessage = response.statusText || errorMessage;
            }
            
            console.error('❌ API error response:', { status: response.status, errorText, errorData });
            throw new Error(`${response.status}: ${errorMessage}`);
          }
          
          // Check content type before parsing
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('❌ Non-JSON response received:', { status: response.status, contentType, text: text.substring(0, 200) });
            throw new Error(`Server returned non-JSON response: ${response.status}`);
          }
          
          const result = await response.json();
          console.log('✅ User updated in MongoDB:', { success: result.success, hasUser: !!result.user });
          
          if (result.success) {
            // Update local state with the returned user data if available
            if (result.user) {
              setUsers(prev => prev.map(user => 
                user.email === email ? { ...user, ...result.user } : user
              ));
              
              if (currentUser && currentUser.email === email) {
                setCurrentUser(prev => prev ? { ...prev, ...result.user } : null);
                // Update localStorage
                try {
                  const updatedUser = { ...currentUser, ...result.user };
                  localStorage.setItem('reRideCurrentUser', JSON.stringify(updatedUser));
                  sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
                } catch (error) {
                  console.warn('Failed to update localStorage with API response:', error);
                }
              }
            }
            
            if (updates.password) {
              addToast('Password updated successfully!', 'success');
            } else {
              addToast('Profile updated successfully!', 'success');
            }
          } else {
            throw new Error(result.reason || result.error || 'Update failed');
          }
          
        } catch (apiError) {
          console.error('❌ API error during user update:', apiError);
          
          // Determine the type of error and show appropriate message
          if (apiError instanceof Error) {
            const errorMsg = apiError.message;
            
            // Check for database connection errors (503)
            if (errorMsg.includes('503') || errorMsg.includes('Database connection failed') || errorMsg.includes('MONGODB_URI')) {
              console.error('❌ MongoDB connection failed:', errorMsg);
              if (updates.password) {
                addToast('Password updated locally. MongoDB connection failed - please configure MONGODB_URI in Vercel.', 'error');
              } else {
                addToast('Profile updated locally. MongoDB connection failed - please check server configuration.', 'error');
              }
            } else if (errorMsg.includes('fetch') || 
                errorMsg.includes('network') ||
                errorMsg.includes('Failed to fetch') ||
                errorMsg.includes('CORS')) {
              // Network errors - expected in development
              console.warn('⚠️ Network error updating user:', errorMsg);
              if (isDevelopment) {
                if (updates.password) {
                  addToast('Password updated successfully (saved locally)', 'success');
                } else {
                  addToast('Profile updated locally', 'success');
                }
              } else {
                addToast('Network error. Please check your connection and try again.', 'error');
              }
            } else if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
              // 404 errors - expected when API endpoint doesn't exist (dev mode)
              console.warn('⚠️ API endpoint not found (dev mode): Profile updated locally');
              if (isDevelopment) {
                if (updates.password) {
                  addToast('Password updated successfully (saved locally)', 'success');
                } else {
                  addToast('Profile updated locally', 'success');
                }
              } else {
                addToast('API endpoint not found. Please check deployment.', 'error');
              }
            } else if (errorMsg.includes('400')) {
              console.error('❌ Invalid profile data:', apiError);
              addToast(`Invalid data: ${errorMsg.replace('400: ', '')}`, 'error');
            } else if (errorMsg.includes('500') || errorMsg.includes('Database error') || errorMsg.includes('Internal server')) {
              console.error('❌ Server/Database error updating user:', apiError);
              // For password updates, provide specific feedback
              if (updates.password) {
                // Check if password was saved locally (development mode)
                if (isDevelopment) {
                  addToast('Password updated successfully (saved locally)', 'success');
                } else {
                  // Production: Database error - likely MongoDB issue
                  console.error('MongoDB update failed - check MONGODB_URI environment variable and MongoDB Atlas connection in Vercel');
                  addToast('Password update failed. Please check server logs or try again.', 'error');
                }
              } else {
                addToast('Server error. Profile updated locally, will retry later.', 'warning');
              }
            } else {
              console.warn('⚠️ Failed to sync profile with server:', errorMsg);
              // For password updates specifically
              if (updates.password) {
                if (isDevelopment) {
                  addToast('Password updated successfully (saved locally)', 'success');
                } else {
                  // Show the actual error message if available
                  const displayError = errorMsg.replace(/^\d+:\s*/, ''); // Remove status code prefix
                  addToast(`Password update failed: ${displayError}`, 'error');
                }
              } else {
                addToast(`Profile update failed: ${errorMsg.replace(/^\d+:\s*/, '')}`, 'warning');
              }
            }
          } else {
            console.warn('⚠️ Failed to sync profile with server - unknown error type');
            // For password updates specifically
            if (updates.password) {
              if (isDevelopment) {
                addToast('Password updated successfully (saved locally)', 'success');
              } else {
                addToast('Password update failed. Please try again or check server logs.', 'error');
              }
            } else {
              addToast('Profile update failed. Please try again.', 'warning');
            }
          }
        }
        
      } catch (error) {
        console.error('Failed to update user:', error);
        addToast('Failed to update profile', 'error');
      }
    },
    deleteUser: (email: string) => {
      setUsers(prev => prev.filter(user => user.email !== email));
      addToast('User deleted successfully', 'success');
    },
    updateVehicle: async (id: number, updates: Partial<Vehicle>, options?: VehicleUpdateOptions) => {
      await updateVehicleHandler(id, updates, options);
    },
    deleteVehicle: async (id: number) => {
      try {
        // Call API to delete vehicle
        const { deleteVehicle: deleteVehicleApi } = await import('../services/vehicleService');
        const result = await deleteVehicleApi(id);
        
        if (result.success) {
          // Update local state
          setVehicles(prev => prev.filter(vehicle => vehicle.id !== id));
          addToast('Vehicle deleted successfully', 'success');
          console.log('✅ Vehicle deleted via API:', result);
        } else {
          addToast('Failed to delete vehicle', 'error');
        }
      } catch (error) {
        console.error('❌ Failed to delete vehicle:', error);
        addToast('Failed to delete vehicle. Please try again.', 'error');
      }
    },
    selectVehicle: (vehicle: Vehicle) => {
      setSelectedVehicle(vehicle);
      // Navigate to DETAIL view when a vehicle is selected
      setCurrentView(View.DETAIL);
    },
    toggleWishlist: (vehicleId: number) => {
      setWishlist(prev => 
        prev.includes(vehicleId) 
          ? prev.filter(id => id !== vehicleId)
          : [...prev, vehicleId]
      );
    },
    toggleCompare: (vehicleId: number) => {
      setComparisonList(prev => 
        prev.includes(vehicleId) 
          ? prev.filter(id => id !== vehicleId)
          : prev.length < 3 ? [...prev, vehicleId] : prev
      );
    },
    onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => {
      console.log('🔧 onOfferResponse called:', { conversationId, messageId, response, counterPrice });
      
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.id === conversationId) {
            const updatedMessages = conv.messages.map(msg => {
              if (msg.id === messageId) {
                const updatedPayload = {
                  ...msg.payload,
                  status: response,
                  ...(counterPrice && { counterPrice })
                };
                
                return {
                  ...msg,
                  payload: updatedPayload
                };
              }
              return msg;
            });
            
            // Add a response message
            const responseMessages = {
              accepted: `✅ Offer accepted! The deal is confirmed.`,
              rejected: `❌ Offer declined. Thank you for your interest.`,
              countered: `💰 Counter-offer made: ₹${counterPrice?.toLocaleString('en-IN')}`
            };
            
            const responseMessage = {
              id: Date.now(),
              sender: 'seller' as const,
              text: responseMessages[response],
              timestamp: new Date().toISOString(),
              isRead: false,
              type: 'text' as const
            };
            
            return {
              ...conv,
              messages: [...updatedMessages, responseMessage],
              lastMessageAt: new Date().toISOString()
            };
          }
          return conv;
        });
        
        console.log('🔧 Updated conversations after offer response:', updated);
        return updated;
      });
      
      // Update activeChat if it's the same conversation
      setActiveChat(prev => {
        if (prev && prev.id === conversationId) {
          const updatedConv = conversations.find(conv => conv.id === conversationId);
          if (updatedConv) {
            return {
              ...updatedConv,
              messages: updatedConv.messages.map(msg => {
                if (msg.id === messageId) {
                  const updatedPayload = {
                    ...msg.payload,
                    status: response,
                    ...(counterPrice && { counterPrice })
                  };
                  
                  return {
                    ...msg,
                    payload: updatedPayload
                  };
                }
                return msg;
              })
            };
          }
        }
        return prev;
      });
      
      addToast(`Offer ${response} successfully`, 'success');
    },
  }), [
    // Dependencies for useMemo
    currentView, previousView, selectedVehicle, vehicles, isLoading, currentUser,
    comparisonList, ratings, sellerRatings, wishlist, conversations, toasts,
    forgotPasswordRole, typingStatus, selectedCategory, publicSellerProfile,
    activeChat, isAnnouncementVisible, recommendations, initialSearchQuery,
    isCommandPaletteOpen, userLocation, selectedCity, users, platformSettings,
    auditLog, vehicleData, faqItems, supportTickets, notifications,
    // Functions that don't change often
    setCurrentView, setPreviousView, setSelectedVehicle, setVehicles, setIsLoading,
    setCurrentUser, setComparisonList, setWishlist, setConversations, setToasts,
    setForgotPasswordRole, setTypingStatus, setSelectedCategory, setPublicSellerProfile,
    setActiveChat, setIsAnnouncementVisible, setRecommendations, setInitialSearchQuery,
    setIsCommandPaletteOpen, setUserLocation, setSelectedCity, setUsers,
    setPlatformSettings, setAuditLog, setVehicleData, setFaqItems, setSupportTickets,
    setNotifications, addToast, removeToast, navigate, handleLogin, handleLogout,
    updateVehicleHandler,
    // Add missing dependencies
    setCurrentUser, setUsers
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
});

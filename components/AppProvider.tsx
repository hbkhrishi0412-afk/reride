import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Vehicle, User, Conversation, Toast as ToastType, PlatformSettings, AuditLogEntry, VehicleData, Notification, VehicleCategory, SupportTicket, FAQItem, SubscriptionPlan, ChatMessage } from '../types';
import { View, VehicleCategory as CategoryEnum } from '../types';
import { getConversations, saveConversations } from '../services/chatService';
import { saveConversationWithSync, addMessageWithSync, processSyncQueue } from '../services/syncService';
import { saveNotificationWithSync, updateNotificationWithSync } from '../services/syncService';
import { getSettings } from '../services/settingsService';
import { getAuditLog, logAction, saveAuditLog } from '../services/auditLogService';
import { getFaqs, saveFaqs } from '../services/faqService';
import { getSupportTickets } from '../services/supportTicketService';
import { dataService } from '../services/dataService';
import { VEHICLE_DATA } from './vehicleData';
import { isDevelopmentEnvironment } from '../utils/environment';
import { showNotification } from '../services/notificationService';

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
  sendMessageWithType: (conversationId: string, messageText: string, type?: ChatMessage['type'], payload?: any) => void;
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
    const errorMessage = 'useApp must be used within an AppProvider';
    // Log helpful debugging info in development
    if (process.env.NODE_ENV === 'development') {
      console.error('⚠️', errorMessage);
      console.trace('Stack trace:');
      // Still throw to catch real issues, but with better error message
    }
    throw new Error(errorMessage);
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = React.memo(({ children }) => {
  // Track which notifications have already shown browser notifications
  const shownNotificationIdsRef = useRef<Set<number>>(new Set());
  // Track vehicles currently being updated to prevent duplicate updates
  const updatingVehiclesRef = useRef<Set<number>>(new Set());
  
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
      const savedSession = sessionStorage.getItem('currentUser');
      
      if (savedUser) {
        const user = JSON.parse(savedUser);
        
        // CRITICAL: Validate user object has required fields (especially role)
        // Provide defaults for missing fields if possible
        if (!user) {
          console.warn('⚠️ Invalid user object in localStorage - user is null/undefined');
          localStorage.removeItem('reRideCurrentUser');
          if (savedSession) sessionStorage.removeItem('currentUser');
          return null;
        }

        // Validate and fix missing email
        if (!user.email || typeof user.email !== 'string') {
          // Only log in development - don't spam production console
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Invalid user object - missing or invalid email. Clearing user data.');
          }
          localStorage.removeItem('reRideCurrentUser');
          if (savedSession) sessionStorage.removeItem('currentUser');
          return null;
        }

        // Validate and fix missing role - provide default if we can infer it
        if (!user.role || typeof user.role !== 'string') {
          // Try to infer role from other fields (e.g., has dealership = seller)
          if (user.dealershipName) {
            user.role = 'seller';
            if (process.env.NODE_ENV === 'development') {
              console.log('🔧 Auto-assigned role "seller" based on dealershipName');
            }
          } else {
            user.role = 'customer'; // Safe default
            if (process.env.NODE_ENV === 'development') {
              console.log('🔧 Auto-assigned role "customer" as default');
            }
          }
        }
        
        // Ensure role is a valid value
        if (!['customer', 'seller', 'admin'].includes(user.role)) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Invalid role in user object:', user.role, '- defaulting to customer');
          }
          user.role = 'customer'; // Safe default instead of clearing
          // Save corrected user back
          try {
            localStorage.setItem('reRideCurrentUser', JSON.stringify(user));
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Failed to save corrected user:', e);
            }
          }
        }
        
        console.log('🔄 Restoring logged-in user:', {
          name: user.name,
          email: user.email,
          role: user.role,
          userId: user.id,
          source: 'localStorage',
          isProduction: !window.location.hostname.includes('localhost')
        });
        return user;
      } else if (savedSession) {
        // Fallback to sessionStorage if localStorage doesn't have user
        const user = JSON.parse(savedSession);
        if (user && user.email && user.role && ['customer', 'seller', 'admin'].includes(user.role)) {
          console.log('🔄 Restoring logged-in user from sessionStorage:', {
            name: user.name,
            email: user.email,
            role: user.role,
            userId: user.id,
            source: 'sessionStorage'
          });
          // Also restore to localStorage for consistency
          localStorage.setItem('reRideCurrentUser', JSON.stringify(user));
          return user;
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to load user from localStorage:', error);
      }
      // Clear corrupted data
      try {
        localStorage.removeItem('reRideCurrentUser');
      } catch {}
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
  const [userLocation, setUserLocationState] = useState<string>(() => {
    try {
      const storedLocation = localStorage.getItem('reRideUserLocation');
      if (storedLocation && storedLocation.trim().length > 0) {
        return storedLocation;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to load user location from localStorage:', error);
      }
    }
    return 'Mumbai';
  });
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    try {
      const storedCity = localStorage.getItem('reRideSelectedCity');
      if (storedCity && storedCity.trim().length > 0) {
        return storedCity;
      }
      const storedLocation = localStorage.getItem('reRideUserLocation');
      if (storedLocation && storedLocation.trim().length > 0) {
        return storedLocation;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to load selected city from localStorage:', error);
      }
    }
    return '';
  });
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
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to load vehicle data from localStorage:', error);
      }
    }
    return VEHICLE_DATA;
  });
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
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
        if (process.env.NODE_ENV === 'development') {
          console.warn('Invalid toast message provided');
        }
        return;
      }
      
      if (!['success', 'error', 'warning', 'info'].includes(type)) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Invalid toast type provided:', type);
        }
        return;
      }

      const trimmedMessage = message.trim();
      const now = Date.now();
      
      // Prevent duplicate toasts: Check if the same message and type already exists
      // and was added within the last 3 seconds
      setToasts(prev => {
        const recentDuplicate = prev.find(
          toast => 
            toast.message === trimmedMessage && 
            toast.type === type &&
            // Check if toast was added recently (within last 3 seconds)
            // Since toast IDs are timestamps, we can use them to check recency
            (now - toast.id) < 3000
        );
        
        if (recentDuplicate) {
          // Toast with same message already exists and is recent, skip adding duplicate
          if (process.env.NODE_ENV === 'development') {
            console.log('Skipping duplicate toast:', trimmedMessage);
          }
          return prev;
        }
        
        const id = now;
        const toast: ToastType = { id, message: trimmedMessage, type };
        
        return [...prev, toast];
      });
      
      // Auto-remove after 5 seconds (moved outside setToasts to access removeToast)
      const toastId = now;
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== toastId));
      }, 5000);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding toast:', error);
      }
    }
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // CRITICAL: Emergency fail-safe to prevent infinite loading
  // If isLoading is still true after 5 seconds, force it to false
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      setIsLoading(current => {
        if (current) {
          console.warn('⚠️ EMERGENCY: Forcing loading to complete after 5s timeout');
          addToast('App loaded. Some features may still be loading in the background.', 'info');
          return false;
        }
        return current;
      });
    }, 5000);
    
    return () => clearTimeout(emergencyTimeout);
  }, [addToast]); // Now addToast is defined, so this is safe

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('reRideCurrentUser');
    setCurrentView(View.HOME);
    setActiveChat(null);
    addToast('You have been logged out.', 'info');
  }, [addToast]);

  const handleLogin = useCallback((user: User) => {
    // CRITICAL: Validate user object before setting
    if (!user || !user.email || !user.role) {
      console.error('❌ Invalid user object in handleLogin:', { 
        hasUser: !!user, 
        hasEmail: !!user?.email, 
        hasRole: !!user?.role 
      });
      addToast('Login failed: Invalid user data. Please try again.', 'error');
      return;
    }
    
    // Ensure role is valid
    if (!['customer', 'seller', 'admin'].includes(user.role)) {
      console.error('❌ Invalid role in handleLogin:', user.role);
      addToast('Login failed: Invalid user role. Please try again.', 'error');
      return;
    }
    
    // Set user first (this is critical - navigate checks currentUser)
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('reRideCurrentUser', JSON.stringify(user));
    
    // Verify user storage (for debugging production issues)
    const storedInSession = sessionStorage.getItem('currentUser');
    const storedInLocal = localStorage.getItem('reRideCurrentUser');
    console.log('✅ User stored after login:', {
      email: user.email,
      role: user.role,
      storedInSessionStorage: !!storedInSession,
      storedInLocalStorage: !!storedInLocal,
      sessionMatches: storedInSession ? JSON.parse(storedInSession).email === user.email : false,
      localMatches: storedInLocal ? JSON.parse(storedInLocal).email === user.email : false
    });
    
    addToast(`Welcome back, ${user.name}!`, 'success');
    
    // Navigate based on user role
    // Directly set view since we've already validated the user
    // The navigate function will validate again, but we know the user is valid
    if (user.role === 'admin') {
      setCurrentView(View.ADMIN_PANEL);
    } else if (user.role === 'seller') {
      console.log('🔄 Setting seller dashboard view after login');
      setCurrentView(View.SELLER_DASHBOARD);
    } else {
      setCurrentView(View.HOME);
    }
  }, [addToast]);

  const handleRegister = useCallback((user: User) => {
    // CRITICAL: Validate user object before setting
    if (!user || !user.email || !user.role) {
      console.error('❌ Invalid user object in handleRegister:', { 
        hasUser: !!user, 
        hasEmail: !!user?.email, 
        hasRole: !!user?.role 
      });
      addToast('Registration failed: Invalid user data. Please try again.', 'error');
      return;
    }
    
    // Ensure role is valid
    if (!['customer', 'seller', 'admin'].includes(user.role)) {
      console.error('❌ Invalid role in handleRegister:', user.role);
      addToast('Registration failed: Invalid user role. Please try again.', 'error');
      return;
    }
    
    // Set user first (this is critical - navigate checks currentUser)
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('reRideCurrentUser', JSON.stringify(user));
    
    // Verify user storage (for debugging production issues)
    const storedInSession = sessionStorage.getItem('currentUser');
    const storedInLocal = localStorage.getItem('reRideCurrentUser');
    console.log('✅ User stored after registration:', {
      email: user.email,
      role: user.role,
      storedInSessionStorage: !!storedInSession,
      storedInLocalStorage: !!storedInLocal,
      sessionMatches: storedInSession ? JSON.parse(storedInSession).email === user.email : false,
      localMatches: storedInLocal ? JSON.parse(storedInLocal).email === user.email : false
    });
    
    addToast(`Welcome to ReRide, ${user.name}!`, 'success');
    
    // Navigate based on user role
    // Directly set view since we've already validated the user
    // The navigate function will validate again, but we know the user is valid
    if (user.role === 'admin') {
      setCurrentView(View.ADMIN_PANEL);
    } else if (user.role === 'seller') {
      console.log('🔄 Setting seller dashboard view after registration');
      setCurrentView(View.SELLER_DASHBOARD);
    } else {
      setCurrentView(View.HOME);
    }
  }, [addToast]);

  const updateUserLocation = useCallback((location: string) => {
    const nextLocation = (location ?? '').trim();
    if (nextLocation.length === 0) {
      setUserLocationState('Mumbai');
      setSelectedCityState('');
      try {
        localStorage.removeItem('reRideUserLocation');
        localStorage.removeItem('reRideSelectedCity');
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to clear stored location:', error);
        }
      }
      return;
    }

    setUserLocationState(prev => (prev === nextLocation ? prev : nextLocation));
    setSelectedCityState(prev => (prev === nextLocation ? prev : nextLocation));

    try {
      localStorage.setItem('reRideUserLocation', nextLocation);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to persist location selection:', error);
      }
    }

    try {
      localStorage.setItem('reRideSelectedCity', nextLocation);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to persist selected city:', error);
      }
    }
  }, []);

  const updateSelectedCity = useCallback((city: string) => {
    const trimmedCity = (city ?? '').trim();

    setSelectedCityState(prev => (prev === trimmedCity ? prev : trimmedCity));

    try {
      if (trimmedCity.length > 0) {
        localStorage.setItem('reRideSelectedCity', trimmedCity);
        setUserLocationState(prev => (prev === trimmedCity ? prev : trimmedCity));
        localStorage.setItem('reRideUserLocation', trimmedCity);
      } else {
        localStorage.removeItem('reRideSelectedCity');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to persist selected city:', error);
      }
    }
  }, []);

  const navigate = useCallback((view: View, params?: { city?: string }) => {
    // Prevent infinite redirect loops by checking if we're already on the target view
    if (view === currentView && !params?.city) {
      return; // Already on this view, no need to navigate
    }

    // Fixed: Preserve selectedVehicle when navigating TO DETAIL view or between DETAIL and SELLER_PROFILE
    // Calculate this early to avoid TypeScript type narrowing issues
    // Preserve if: navigating TO detail (covers both initial navigation and from seller profile),
    // or navigating FROM detail TO seller profile
    const preserveSelectedVehicle = view === View.DETAIL || 
      (view === View.SELLER_PROFILE && currentView === View.DETAIL);

    const isNavigatingAwayFromSellerProfile = currentView === View.SELLER_PROFILE && view !== View.SELLER_PROFILE;
    if (isNavigatingAwayFromSellerProfile) { 
      window.history.pushState({}, '', window.location.pathname); 
      setPublicSellerProfile(null); 
    }
    setInitialSearchQuery('');
    
    if (!preserveSelectedVehicle) setSelectedVehicle(null);
    
    if (view === View.USED_CARS && currentView !== View.HOME) setSelectedCategory('ALL');
    if (view === View.CITY_LANDING && params?.city) {
      updateSelectedCity(params.city);
    }
    if (view === View.USED_CARS && params?.city) {
      updateSelectedCity(params.city);
    }
    
    // Prevent redirect loops: Only redirect if not already on login page
    // CRITICAL: Enhanced validation for seller dashboard access
    if (view === View.SELLER_DASHBOARD) {
      if (!currentUser) {
        console.warn('⚠️ Attempted to access seller dashboard without logged-in user');
        if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
          setCurrentView(View.LOGIN_PORTAL);
        }
        return;
      }
      
      // Validate user has required fields
      if (!currentUser.email || !currentUser.role) {
        console.error('❌ Invalid user object - missing email or role:', { 
          hasEmail: !!currentUser.email, 
          hasRole: !!currentUser.role 
        });
        if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
          setCurrentView(View.LOGIN_PORTAL);
        }
        return;
      }
      
      // Check role specifically
      if (currentUser.role !== 'seller') {
        console.warn('⚠️ Attempted to access seller dashboard with role:', currentUser.role);
        if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
          setCurrentView(View.LOGIN_PORTAL);
        }
        return;
      }
      
      // All validation passed - navigate to seller dashboard
      console.log('✅ Navigating to seller dashboard');
      setCurrentView(View.SELLER_DASHBOARD);
    } else if (view === View.ADMIN_PANEL && currentUser?.role !== 'admin') {
      if (currentView !== View.ADMIN_LOGIN) {
        setCurrentView(View.ADMIN_LOGIN);
      }
    } else if (view === View.NEW_CARS_ADMIN_PANEL && currentUser?.role !== 'admin') {
      if (currentView !== View.NEW_CARS_ADMIN_LOGIN) {
        setCurrentView(View.NEW_CARS_ADMIN_LOGIN);
      }
    } else if ((view === View.PROFILE || view === View.INBOX) && !currentUser) {
      if (currentView !== View.LOGIN_PORTAL) {
        setCurrentView(View.LOGIN_PORTAL);
      }
    } else {
      setCurrentView(view);
    }

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

  // Auto-navigate to appropriate dashboard after login/registration
  // This ensures the view is set correctly even if state updates are async
  useEffect(() => {
    if (currentUser && currentUser.role) {
      // Only auto-navigate if we're on a login/register page
      const loginViews = [View.LOGIN_PORTAL, View.SELLER_LOGIN, View.CUSTOMER_LOGIN, View.ADMIN_LOGIN];
      if (loginViews.includes(currentView)) {
        if (currentUser.role === 'seller' && currentView !== View.SELLER_DASHBOARD) {
          console.log('🔄 Auto-navigating seller to dashboard from login view');
          setCurrentView(View.SELLER_DASHBOARD);
        } else if (currentUser.role === 'admin' && currentView !== View.ADMIN_PANEL) {
          setCurrentView(View.ADMIN_PANEL);
        } else if (currentUser.role === 'customer' && currentView !== View.HOME) {
          setCurrentView(View.HOME);
        }
      }
    }
  }, [currentUser, currentView]);

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

  // CRITICAL: Listen for force loading completion event (safety mechanism)
  useEffect(() => {
    const handleForceLoadingComplete = () => {
      console.warn('⚠️ Force loading complete event received, clearing loading state');
      setIsLoading(false);
      addToast('Loading completed. Some data may still be loading in the background.', 'info');
    };

    window.addEventListener('forceLoadingComplete', handleForceLoadingComplete);
    
    return () => {
      window.removeEventListener('forceLoadingComplete', handleForceLoadingComplete);
    };
  }, [addToast]);

  // Load initial data with optimized loading and timeout protection
  useEffect(() => {
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout | null = null;
    
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        
        // CRITICAL: Set a maximum timeout to prevent infinite loading
        // If loading takes more than 3 seconds, force completion (aggressive timeout for faster UX)
        loadingTimeout = setTimeout(() => {
          if (isMounted) {
            console.warn('⚠️ Initial data loading exceeded 3s timeout, forcing completion');
            setIsLoading(false);
            // Don't show toast if this fires - loading should be fast
          }
        }, 3000); // 3 seconds max - very aggressive for fast initial render
        
        // Load critical data first (vehicles and users) with individual timeouts
        const loadWithTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallback: T, silent: boolean = false): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((resolve) => {
              setTimeout(() => {
                // Only log timeout warnings in development mode to reduce console noise
                if (!silent && process.env.NODE_ENV === 'development') {
                  console.warn(`Request timeout after ${timeoutMs}ms, using fallback`);
                }
                resolve(fallback);
              }, timeoutMs);
            })
          ]);
        };
        
        const [vehiclesData, usersData] = await Promise.all([
          loadWithTimeout(
            dataService.getVehicles().catch(err => {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to load vehicles, using empty array:', err);
              }
              return [];
            }),
            10000, // 10 second timeout for vehicles (increased for better reliability)
            [],
            true // Silent timeout warning
          ),
          loadWithTimeout(
            dataService.getUsers().catch(err => {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to load users, using empty array:', err);
              }
              return [];
            }),
            10000, // 10 second timeout for users (increased for better reliability)
            [],
            true // Silent timeout warning
          )
        ]);
        
        if (!isMounted) return;
        
        setVehicles(vehiclesData);
        setUsers(usersData);
        
        // Set some recommendations (first 6 vehicles) - only if we have vehicles
        if (vehiclesData.length > 0) {
          setRecommendations(vehiclesData.slice(0, 6));
        }
        
        // Load FAQs from MongoDB (non-blocking, with timeout)
        Promise.race([
          (async () => {
            try {
              const { fetchFaqsFromMongoDB } = await import('../services/faqService');
              const faqsData = await fetchFaqsFromMongoDB();
              if (isMounted) {
                setFaqItems(faqsData);
              }
            } catch (faqError) {
              console.warn('⚠️ Failed to load FAQs from MongoDB, using localStorage fallback:', faqError);
              if (isMounted) {
                const localFaqs = getFaqs();
                if (localFaqs) {
                  setFaqItems(localFaqs);
                } else {
                  setFaqItems([]);
                }
              }
            }
          })(),
          new Promise<void>((resolve) => {
            setTimeout(() => {
              // Only log in development to reduce console noise
              if (process.env.NODE_ENV === 'development') {
                console.warn('FAQ loading timeout, using localStorage fallback');
              }
              if (isMounted) {
                const localFaqs = getFaqs();
                if (localFaqs) {
                  setFaqItems(localFaqs);
                } else {
                  setFaqItems([]);
                }
              }
              resolve();
            }, 10000); // Increased to 10 seconds
          })
        ]).catch(() => {
          // Silently handle any errors
        });
        
        // Load non-critical data in background (fire and forget, with timeout)
        Promise.race([
          Promise.all([
            dataService.getVehicleData().catch(() => {
              // Silently fail - we already have fallback data
              return null;
            }),
            // Try to load conversations from MongoDB first, fallback to localStorage
            (async () => {
              try {
                // Get current user from localStorage if available
                let userEmail: string | undefined;
                let userRole: string | undefined;
                try {
                  const savedUser = localStorage.getItem('reRideCurrentUser');
                  if (savedUser) {
                    const user = JSON.parse(savedUser);
                    userEmail = user?.email;
                    userRole = user?.role;
                  }
                } catch {}
                
                const { getConversationsFromMongoDB } = await import('../services/conversationService');
                // Filter by user role
                const result = userRole === 'seller' 
                  ? await getConversationsFromMongoDB(undefined, userEmail)
                  : userRole === 'customer'
                  ? await getConversationsFromMongoDB(userEmail)
                  : await getConversationsFromMongoDB();
                
                if (result.success && result.data) {
                  return result.data;
                }
              } catch (error) {
                console.warn('Failed to load conversations from MongoDB, using localStorage:', error);
              }
              // Fallback to localStorage
              return Promise.resolve(getConversations()).catch(() => []);
            })(),
            // Try to load notifications from MongoDB first, fallback to localStorage
            (async () => {
              try {
                // Get current user from localStorage if available
                let userEmail: string | undefined;
                try {
                  const savedUser = localStorage.getItem('reRideCurrentUser');
                  if (savedUser) {
                    const user = JSON.parse(savedUser);
                    userEmail = user?.email;
                  }
                } catch {}
                
                if (userEmail) {
                  const { getNotificationsFromMongoDB } = await import('../services/notificationService');
                  const result = await getNotificationsFromMongoDB(userEmail);
                  if (result.success && result.data) {
                    return result.data;
                  }
                }
              } catch (error) {
                console.warn('Failed to load notifications from MongoDB, using localStorage:', error);
              }
              // Fallback to localStorage
              try {
                const notificationsJson = localStorage.getItem('reRideNotifications');
                return notificationsJson ? JSON.parse(notificationsJson) : [];
              } catch {
                return [];
              }
            })()
          ]).then(([vehicleDataData, conversationsData, notificationsData]) => {
            if (isMounted && vehicleDataData) {
              setVehicleData(vehicleDataData);
            }
            if (isMounted) {
              setConversations(conversationsData || []);
            }
            if (isMounted && notificationsData) {
              setNotifications(notificationsData);
              // Also save to localStorage for offline support
              try {
                localStorage.setItem('reRideNotifications', JSON.stringify(notificationsData));
              } catch (error) {
                console.warn('Failed to save notifications to localStorage:', error);
              }
            }
          }),
          new Promise<void>((resolve) => {
            setTimeout(() => {
              // Only log in development to reduce console noise
              if (process.env.NODE_ENV === 'development') {
                console.warn('Background data loading timeout');
              }
              resolve();
            }, 15000); // Increased to 15 seconds for background loading
          })
        ]).catch(error => {
          console.warn('Background data loading failed:', error);
        });
        
      } catch (error) {
        console.error('AppProvider: Error loading initial data:', error);
        if (isMounted) {
          addToast('Some data failed to load. The app will continue with available data.', 'warning');
        }
      } finally {
        // CRITICAL: Always clear loading state, even on error
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitialData();
    
    return () => {
      isMounted = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [addToast]);

  // Refresh server-sourced data whenever the authenticated user changes
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isSubscribed = true;

    const syncLatestData = async () => {
      try {
        setIsLoading(true);
        const [vehiclesData, usersData] = await Promise.all([
          dataService.getVehicles(),
          dataService.getUsers()
        ]);

        if (!isSubscribed) {
          return;
        }

        setVehicles(vehiclesData);
        setUsers(usersData);

        // Update recommendations with the latest data
        if (vehiclesData && vehiclesData.length > 0) {
          setRecommendations(vehiclesData.slice(0, 6));
        }
      } catch (error) {
        console.error('AppProvider: Failed to sync latest data after authentication:', error);
        addToast('Unable to sync the latest listings. Showing cached data instead.', 'warning');
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    syncLatestData();

    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.email, currentUser?.role, addToast]);

  // Watch for new notifications and show browser notifications
  useEffect(() => {
    if (!currentUser?.email || notifications.length === 0) {
      return;
    }

    // Get notifications for current user
    const userNotifications = notifications.filter(n => 
      n.recipientEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
    );

    if (userNotifications.length === 0) {
      return;
    }

    // Get unread notifications that haven't been shown yet
    const unreadNotifications = userNotifications
      .filter(n => !n.isRead && !shownNotificationIdsRef.current.has(n.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Show browser notification for each new unread notification (when page is hidden)
    unreadNotifications.forEach(notification => {
      // Mark as shown
      shownNotificationIdsRef.current.add(notification.id);
      
      // Only show browser notification if page is in background
      if (document.visibilityState === 'hidden') {
        const title = notification.targetType === 'conversation' 
          ? 'New Message' 
          : 'New Notification';
        
        showNotification(title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: `notification-${notification.id}`,
          requireInteraction: false
        }).catch(err => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Failed to show browser notification:', err);
          }
        });
      }
    });

    // Clean up old notification IDs from the ref (keep last 100)
    if (shownNotificationIdsRef.current.size > 100) {
      const notificationIds = new Set(notifications.map(n => n.id));
      shownNotificationIdsRef.current = new Set(
        Array.from(shownNotificationIdsRef.current).filter(id => notificationIds.has(id))
      );
    }
  }, [notifications, currentUser?.email]);

  // Periodic sync queue processor - retry failed MongoDB saves
  useEffect(() => {
    const SYNC_INTERVAL = 30000; // 30 seconds
    const MIN_SYNC_INTERVAL = 5000; // Minimum 5 seconds between syncs

    let syncInterval: NodeJS.Timeout | null = null;
    let isProcessing = false;

    const processSync = async () => {
      // Prevent concurrent sync processing
      if (isProcessing) {
        console.log('⏳ Sync already in progress, skipping...');
        return;
      }

      try {
        isProcessing = true;
        const { getSyncQueueStatus } = await import('../services/syncService');
        const queueStatus = getSyncQueueStatus();
        
        if (queueStatus.pending > 0) {
          console.log(`🔄 Processing sync queue: ${queueStatus.pending} items pending`);
          
          const { processSyncQueue } = await import('../services/syncService');
          const result = await processSyncQueue();
          
          if (result.success > 0) {
            console.log(`✅ Successfully synced ${result.success} items to MongoDB`);
            if (process.env.NODE_ENV === 'development') {
              addToast(`Synced ${result.success} items to server`, 'success');
            }
          }
          
          if (result.failed > 0) {
            console.warn(`⚠️ Failed to sync ${result.failed} items after retries`);
            const remainingStatus = getSyncQueueStatus();
            if (remainingStatus.pending > 0 && process.env.NODE_ENV === 'development') {
              console.log(`⏳ ${remainingStatus.pending} items still pending sync`);
            }
          }
        }
      } catch (error) {
        console.error('Error processing sync queue:', error);
      } finally {
        isProcessing = false;
      }
    };

    // Process sync queue immediately on mount (after a short delay)
    const initialTimeout = setTimeout(() => {
      processSync();
    }, 5000); // Wait 5 seconds after mount

    // Then process periodically
    syncInterval = setInterval(processSync, SYNC_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [addToast]);

  // Sync vehicle data across tabs and periodically refresh from API
  useEffect(() => {
    // Add storage event listener to sync vehicle data across tabs (fires for other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'reRideVehicleData' && e.newValue) {
        try {
          const newVehicleData = JSON.parse(e.newValue);
          setVehicleData(newVehicleData);
          console.log('✅ Vehicle data synced from another tab');
        } catch (error) {
          console.error('Failed to parse vehicle data from storage event:', error);
        }
      }
    };

    // Add custom event listener for same-tab updates (fires when localStorage is updated in same tab)
    const handleVehicleDataUpdate = (e: CustomEvent) => {
      if (e.detail && e.detail.vehicleData) {
        setVehicleData(e.detail.vehicleData);
        console.log('✅ Vehicle data synced from same tab');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('vehicleDataUpdated', handleVehicleDataUpdate as EventListener);

    // Periodic refresh of vehicle data from API (every 5 minutes)
    const refreshInterval = setInterval(() => {
      dataService.getVehicleData()
        .then((freshData) => {
          if (freshData) {
            setVehicleData(freshData);
            console.log('✅ Vehicle data refreshed from API');
          }
        })
        .catch((error) => {
          console.warn('Failed to refresh vehicle data:', error);
        });
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vehicleDataUpdated', handleVehicleDataUpdate as EventListener);
      clearInterval(refreshInterval);
    };
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  // Save audit log to localStorage whenever it changes
  useEffect(() => {
    if (auditLog.length > 0) {
      saveAuditLog(auditLog);
    }
  }, [auditLog]);

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
    // Prevent duplicate updates for the same vehicle
    if (updatingVehiclesRef.current.has(id)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏸️ Update already in progress for vehicle:', id);
      }
      return;
    }

    try {
      // Mark vehicle as being updated
      updatingVehiclesRef.current.add(id);

      const vehicleToUpdate = vehicles.find(v => v.id === id);
      if (!vehicleToUpdate) {
        updatingVehiclesRef.current.delete(id);
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

      // Log audit entry for vehicle update
      const actor = currentUser?.name || currentUser?.email || 'System';
      const updateFields = Object.keys(updates).join(', ');
      const vehicleInfo = `${vehicleToUpdate.make} ${vehicleToUpdate.model} (ID: ${id})`;
      const entry = logAction(actor, 'Update Vehicle', vehicleInfo, `Updated fields: ${updateFields}`);
      setAuditLog(prev => [entry, ...prev]);

      if (!skipToast) {
        addToast(successMessage ?? fallbackMessage, 'success');
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Vehicle updated via API:', result);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to update vehicle:', error);
      }
      addToast('Failed to update vehicle. Please try again.', 'error');
    } finally {
      // Always remove from updating set, even if there was an error
      updatingVehiclesRef.current.delete(id);
    }
  }, [vehicles, addToast, setVehicles, currentUser, setAuditLog]);

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
    setUserLocation: updateUserLocation,
    setSelectedCity: updateSelectedCity,
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
      // Separate null values (to be removed) from regular updates
      const updateFields: Partial<User> = {};
      const fieldsToRemove: string[] = [];
      
      Object.entries(details).forEach(([key, value]) => {
        if (value === null) {
          fieldsToRemove.push(key);
        } else if (value !== undefined) {
          (updateFields as any)[key] = value;
        }
      });

      setUsers(prev =>
        prev.map(user => {
          if (user.email === email) {
            const updatedUser = { ...user, ...updateFields };
            // Remove fields that are set to null
            fieldsToRemove.forEach(key => {
              delete (updatedUser as any)[key];
            });
            return updatedUser;
          }
          return user;
        })
      );
      
      // Also update in MongoDB - pass both updates and nulls
      try {
        const { updateUser: updateUserService } = await import('../services/userService');
        await updateUserService({ email, ...details }); // Pass original details to preserve null values
      } catch (error) {
        console.warn('Failed to sync user update to MongoDB:', error);
      }
      
      // Log audit entry for user update
      const actor = currentUser?.name || currentUser?.email || 'System';
      const updateFieldsList = Object.keys(updateFields).join(', ');
      const entry = logAction(actor, 'Update User', email, `Updated fields: ${updateFieldsList}`);
      setAuditLog(prev => [entry, ...prev]);
      
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
        const isDevelopment = isDevelopmentEnvironment() || window.location.hostname === 'localhost';
        if (isDevelopment) {
          const { getUsersLocal } = await import('../services/userService');
          const users = await getUsersLocal();
          users.push(newUser);
          localStorage.setItem('reRideUsers', JSON.stringify(users));
        }
        
        // Save to MongoDB via API
        try {
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const response = await authenticatedFetch('/api/main', {
            method: 'POST',
            skipAuth: true, // Registration doesn't require auth
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
        
        // Log audit entry for user creation
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Create User', newUser.email, `Created user: ${newUser.name} (${newUser.role})`);
        setAuditLog(prev => [entry, ...prev]);
        
        return { success: true, reason: '' };
      } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, reason: error instanceof Error ? error.message : 'Failed to create user.' };
      }
    },
          onUpdateUserPlan: async (email: string, plan: SubscriptionPlan) => {
        try {
          // Use the updateUser function defined later in contextValue
          const { updateUser: updateUserService } = await import('../services/userService');
          await updateUserService({ email, subscriptionPlan: plan });
          setUsers(prev => prev.map(user => 
            user.email === email ? { ...user, subscriptionPlan: plan } : user
          ));
          
          // Log audit entry for plan update
          const actor = currentUser?.name || currentUser?.email || 'System';
          const user = users.find(u => u.email === email);
          const previousPlan = user?.subscriptionPlan || 'unknown';
          const entry = logAction(actor, 'Update User Plan', email, `Changed plan from ${previousPlan} to ${plan}`);
          setAuditLog(prev => [entry, ...prev]);
          
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
          // Use the updateUser function defined later in contextValue
          const { updateUser: updateUserService } = await import('../services/userService');
          await updateUserService({ email, status: newStatus });
          setUsers(prev => prev.map(user => 
            user.email === email ? { ...user, status: newStatus } : user
          ));
          
          // Log audit entry for user status toggle
          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Toggle User Status', email, `Changed status from ${user.status} to ${newStatus}`);
          setAuditLog(prev => [entry, ...prev]);
          
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
          
          // Log audit entry for vehicle status toggle
          const actor = currentUser?.name || currentUser?.email || 'System';
          const vehicleInfo = `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`;
          const entry = logAction(actor, 'Toggle Vehicle Status', vehicleInfo, `Changed status from ${vehicle.status} to ${newStatus}`);
          setAuditLog(prev => [entry, ...prev]);
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
            
            // Log audit entry for vehicle unfeature
            const actor = currentUser?.name || currentUser?.email || 'System';
            const vehicleInfo = `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`;
            const entry = logAction(actor, 'Unfeature Vehicle', vehicleInfo, 'Vehicle unfeatured');
            setAuditLog(prev => [entry, ...prev]);
            
            return;
          }

          // Feature path: use API to enforce credits
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
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

              // Log audit entry for vehicle feature
              const actor = currentUser?.name || currentUser?.email || 'System';
              const vehicleInfo = `${result.vehicle.make} ${result.vehicle.model} (ID: ${vehicleId})`;
              const entry = logAction(actor, 'Feature Vehicle', vehicleInfo, `Featured vehicle. Credits remaining: ${remainingCredits}`);
              setAuditLog(prev => [entry, ...prev]);

              addToast(
                `Vehicle featured successfully. Credits remaining: ${remainingCredits}`,
                'success'
              );
            } else {
              // Log audit entry for vehicle feature
              const actor = currentUser?.name || currentUser?.email || 'System';
              const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})` : `Vehicle #${vehicleId}`;
              const entry = logAction(actor, 'Feature Vehicle', vehicleInfo, 'Vehicle featured successfully');
              setAuditLog(prev => [entry, ...prev]);
              
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
        const vehicle = vehicles.find(v => v.id === id);
        setVehicles(prev => prev.map(vehicle => 
          vehicle.id === id ? { ...vehicle, isFlagged: false } : vehicle
        ));
        
        // Log audit entry for flag resolution
        const actor = currentUser?.name || currentUser?.email || 'System';
        const targetInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${id})` : `Vehicle #${id}`;
        const entry = logAction(actor, 'Resolve Flag', targetInfo, `Resolved flag on ${type}`);
        setAuditLog(prev => [entry, ...prev]);
      } else {
        setConversations(prev => prev.map(conv => 
          conv.id === id ? { ...conv, isFlagged: false } : conv
        ));
        
        // Log audit entry for flag resolution
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Resolve Flag', `Conversation ${id}`, `Resolved flag on ${type}`);
        setAuditLog(prev => [entry, ...prev]);
      }
      addToast(`Flag resolved for ${type}`, 'success');
    },
    onUpdateSettings: (settings: PlatformSettings) => {
      setPlatformSettings(settings);
      
      // Log audit entry for settings update
      const actor = currentUser?.name || currentUser?.email || 'System';
      const changedSettings = Object.keys(settings).join(', ');
      const entry = logAction(actor, 'Update Platform Settings', 'Platform', `Updated settings: ${changedSettings}`);
      setAuditLog(prev => [entry, ...prev]);
      
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
      
      // Log audit entry for broadcast
      const actor = currentUser?.name || currentUser?.email || 'System';
      const messagePreview = message.length > 50 ? message.substring(0, 50) + '...' : message;
      const entry = logAction(actor, 'Send Broadcast', 'All Users', `Message: ${messagePreview}`);
      setAuditLog(prev => [entry, ...prev]);
      
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
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Users', 'Users Data', `Exported ${users.length} users to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
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
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Vehicles', 'Vehicles Data', `Exported ${vehicles.length} vehicles to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
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
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Sales', 'Sales Data', `Exported ${soldVehicles.length} sales records to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
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
          // Log audit entry for vehicle data update
          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Update Vehicle Data', 'Vehicle Data', 'Updated vehicle data configuration');
          setAuditLog(prev => [entry, ...prev]);
          
          addToast('Vehicle data updated and synced successfully', 'success');
          console.log('✅ Vehicle data updated via API:', newData);
        } else {
          // Fallback to localStorage if API fails
          try {
            localStorage.setItem('reRideVehicleData', JSON.stringify(newData));
            addToast('Vehicle data updated (saved locally, will sync when online)', 'warning');
            console.warn('⚠️ API failed, saved to localStorage as fallback');
            
            // Log audit entry for vehicle data update (local only)
            const actor = currentUser?.name || currentUser?.email || 'System';
            const entry = logAction(actor, 'Update Vehicle Data', 'Vehicle Data', 'Updated vehicle data configuration (saved locally)');
            setAuditLog(prev => [entry, ...prev]);
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
    onAddFaq: async (faq: Omit<FAQItem, 'id'>) => {
      try {
        // Save to MongoDB first
        const { saveFaqToMongoDB } = await import('../services/faqService');
        const savedFaq = await saveFaqToMongoDB(faq);
        
        // Update local state
        const newFaq: FAQItem = savedFaq || { ...faq, id: Date.now() };
        
        // If MongoDB returned _id, store it
        if (savedFaq && (savedFaq as any)._id) {
          (newFaq as any)._id = (savedFaq as any)._id;
        }
        
        setFaqItems(prev => {
          const updated = [...prev, newFaq];
          saveFaqs(updated);
          return updated;
        });
        
        addToast('FAQ added successfully', 'success');
      } catch (error) {
        console.error('Failed to add FAQ:', error);
        // Still add locally even if MongoDB fails
        const newFaq: FAQItem = { ...faq, id: Date.now() };
        setFaqItems(prev => {
          const updated = [...prev, newFaq];
          saveFaqs(updated);
          return updated;
        });
        addToast('FAQ added locally (MongoDB sync failed)', 'warning');
      }
    },
    onUpdateFaq: async (faq: FAQItem) => {
      try {
        // Find the FAQ to get its MongoDB _id
        const existingFaq = faqItems.find(f => f.id === faq.id);
        const mongoId = (existingFaq as any)?._id;
        
        // Try to update in MongoDB if we have _id
        if (mongoId) {
          const { updateFaqInMongoDB } = await import('../services/faqService');
          await updateFaqInMongoDB(faq, mongoId);
        }
        
        // Update local state
        setFaqItems(prev => {
          const updated = prev.map(f => {
            if (f.id === faq.id) {
              const updatedFaq = { ...faq };
              // Preserve _id if it exists
              if ((f as any)._id) {
                (updatedFaq as any)._id = (f as any)._id;
              }
              return updatedFaq;
            }
            return f;
          });
          saveFaqs(updated);
          return updated;
        });
        addToast('FAQ updated successfully', 'success');
      } catch (error) {
        console.error('Failed to update FAQ:', error);
        // Still update locally
        setFaqItems(prev => {
          const updated = prev.map(f => {
            if (f.id === faq.id) {
              const updatedFaq = { ...faq };
              if ((f as any)._id) {
                (updatedFaq as any)._id = (f as any)._id;
              }
              return updatedFaq;
            }
            return f;
          });
          saveFaqs(updated);
          return updated;
        });
        addToast('FAQ updated locally (MongoDB sync failed)', 'warning');
      }
    },
    onDeleteFaq: async (id: number) => {
      try {
        // Find the FAQ to get its MongoDB _id
        const existingFaq = faqItems.find(f => f.id === id);
        const mongoId = (existingFaq as any)?._id;
        
        // Try to delete from MongoDB if we have _id
        if (mongoId) {
          const { deleteFaqFromMongoDB } = await import('../services/faqService');
          await deleteFaqFromMongoDB(mongoId);
        }
        
        // Delete from local state
        setFaqItems(prev => {
          const updated = prev.filter(f => f.id !== id);
          saveFaqs(updated);
          return updated;
        });
        addToast('FAQ deleted successfully', 'success');
      } catch (error) {
        console.error('Failed to delete FAQ:', error);
        // Still delete locally
        setFaqItems(prev => {
          const updated = prev.filter(f => f.id !== id);
          saveFaqs(updated);
          return updated;
        });
        addToast('FAQ deleted locally (MongoDB sync failed)', 'warning');
      }
    },
    onCertificationApproval: (vehicleId: number, decision: 'approved' | 'rejected') => {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      
      setVehicles(prev => prev.map(vehicle => 
        vehicle.id === vehicleId ? { 
          ...vehicle, 
          certificationStatus: decision === 'approved' ? 'certified' : 'rejected' 
        } : vehicle
      ));
      
      // Log audit entry for certification approval/rejection
      const actor = currentUser?.name || currentUser?.email || 'System';
      const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})` : `Vehicle #${vehicleId}`;
      const entry = logAction(actor, `Certification ${decision === 'approved' ? 'Approve' : 'Reject'}`, vehicleInfo, `Certification ${decision} for vehicle`);
      setAuditLog(prev => [entry, ...prev]);
      
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
      
      if (!currentUser) {
        console.warn('⚠️ Cannot send message: no current user');
        addToast('You must be logged in to send messages.', 'error');
        return;
      }

      try {
        // Find conversation BEFORE updating state to avoid stale state issues
        const conversation = conversations.find(conv => conv.id === conversationId);
        if (!conversation) {
          console.warn('⚠️ Conversation not found:', conversationId);
          addToast('Conversation not found. Please refresh and try again.', 'error');
          return;
        }

        // Generate a more unique message ID to prevent collisions
        const messageId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
        
        const newMessage = {
          id: messageId,
          sender: (currentUser.role === 'seller' ? 'seller' : 'user') as 'seller' | 'user',
          text: message,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'text' as const
        };

        // Update conversations and save to localStorage
        setConversations(prev => {
          const updated = prev.map(conv => 
            conv.id === conversationId ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessageAt: newMessage.timestamp,
              isReadBySeller: currentUser.role === 'seller' ? true : conv.isReadBySeller,
              isReadByCustomer: currentUser.role === 'customer' ? true : conv.isReadByCustomer
            } : conv
          );
          
          // Save to localStorage immediately
          try {
            saveConversations(updated);
          } catch (error) {
            console.error('Failed to save conversations to localStorage:', error);
          }
          
          // Save to MongoDB with sync queue fallback
          const updatedConversation = updated.find(conv => conv.id === conversationId);
          if (updatedConversation) {
            // Save entire conversation to MongoDB (with queue fallback)
            (async () => {
              const result = await saveConversationWithSync(updatedConversation);
              if (result.synced) {
                console.log('✅ Conversation synced to MongoDB:', conversationId);
              } else if (result.queued) {
                console.log('⏳ Conversation queued for sync (will retry):', conversationId);
              }
            })();
            
            // Also add message via API with sync queue
            (async () => {
              const result = await addMessageWithSync(conversationId, newMessage);
              if (result.synced) {
                console.log('✅ Message synced to MongoDB:', messageId);
              } else if (result.queued) {
                console.log('⏳ Message queued for sync (will retry):', messageId);
              }
            })();
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Updated conversations:', updated);
          }
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
                isReadBySeller: currentUser.role === 'seller' ? true : prev.isReadBySeller,
                isReadByCustomer: currentUser.role === 'customer' ? true : prev.isReadByCustomer
              };
            }
            return prev;
          });
        }

        // Create notification for the recipient using the conversation we found
        const recipientEmail = currentUser.role === 'seller' ? conversation.customerId : conversation.sellerId;
        const senderName = currentUser.role === 'seller' ? 'Seller' : conversation.customerName;
        
        // Generate a more unique notification ID
        const notificationId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
        
        const newNotification: Notification = {
          id: notificationId,
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
          
          // Save to MongoDB with sync queue fallback - wait for completion
          (async () => {
            const result = await saveNotificationWithSync(newNotification);
            if (result.synced) {
              console.log('✅ Notification synced to MongoDB:', notificationId);
            } else if (result.queued) {
              console.log('⏳ Notification queued for sync (will retry):', notificationId);
            }
          })();
          
          return updatedNotifications;
        });
      } catch (error) {
        console.error('Error in sendMessage:', error);
        addToast('Failed to send message. Please try again.', 'error');
      }
    },
    sendMessageWithType: (conversationId: string, messageText: string, type?: ChatMessage['type'], payload?: any) => {
      console.log('🔧 sendMessageWithType called:', { conversationId, messageText, type, payload, currentUser: currentUser?.email });
      
      if (!currentUser) {
        console.warn('⚠️ Cannot send message: no current user');
        addToast('You must be logged in to send messages.', 'error');
        return;
      }

      try {
        // Find conversation BEFORE updating state to avoid stale state issues
        const conversation = conversations.find(conv => conv.id === conversationId);
        if (!conversation) {
          console.warn('⚠️ Conversation not found:', conversationId);
          addToast('Conversation not found. Please refresh and try again.', 'error');
          return;
        }

        // Generate a more unique message ID to prevent collisions
        const messageId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
        
        const newMessage: ChatMessage = {
          id: messageId,
          sender: (currentUser.role === 'seller' ? 'seller' : 'user') as 'seller' | 'user',
          text: messageText,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: type || 'text',
          ...(type === 'offer' && payload ? { payload } : {})
        };

        // Update conversations and save to localStorage
        setConversations(prev => {
          const updated = prev.map(conv => 
            conv.id === conversationId ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessageAt: newMessage.timestamp,
              isReadBySeller: currentUser.role === 'seller' ? true : conv.isReadBySeller,
              isReadByCustomer: currentUser.role === 'customer' ? true : conv.isReadByCustomer
            } : conv
          );
          
          // Save to localStorage immediately
          try {
            saveConversations(updated);
          } catch (error) {
            console.error('Failed to save conversations to localStorage:', error);
          }
          
          // Save to MongoDB with sync queue fallback
          const updatedConversation = updated.find(conv => conv.id === conversationId);
          if (updatedConversation) {
            // Save entire conversation to MongoDB (with queue fallback)
            (async () => {
              const result = await saveConversationWithSync(updatedConversation);
              if (result.synced) {
                console.log('✅ Conversation synced to MongoDB:', conversationId);
              } else if (result.queued) {
                console.log('⏳ Conversation queued for sync (will retry):', conversationId);
              }
            })();
            
            // Also add message via API with sync queue
            (async () => {
              const result = await addMessageWithSync(conversationId, newMessage);
              if (result.synced) {
                console.log('✅ Message synced to MongoDB:', messageId);
              } else if (result.queued) {
                console.log('⏳ Message queued for sync (will retry):', messageId);
              }
            })();
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Updated conversations:', updated);
          }
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
                isReadBySeller: currentUser.role === 'seller' ? true : prev.isReadBySeller,
                isReadByCustomer: currentUser.role === 'customer' ? true : prev.isReadByCustomer
              };
            }
            return prev;
          });
        }

        // Create notification for the recipient using the conversation we found
        const recipientEmail = currentUser.role === 'seller' ? conversation.customerId : conversation.sellerId;
        const senderName = currentUser.role === 'seller' ? 'Seller' : conversation.customerName;
        
        // Create appropriate notification message
        let notificationMessage = '';
        if (type === 'offer' && payload?.offerPrice) {
          notificationMessage = `New offer from ${senderName}: ₹${payload.offerPrice.toLocaleString()}`;
        } else {
          notificationMessage = `New message from ${senderName}: ${messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText}`;
        }
        
        // Generate a more unique notification ID
        const notificationId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
        
        const newNotification: Notification = {
          id: notificationId,
          recipientEmail,
          message: notificationMessage,
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
          
          // Save to MongoDB with sync queue fallback - wait for completion
          (async () => {
            const result = await saveNotificationWithSync(newNotification);
            if (result.synced) {
              console.log('✅ Notification synced to MongoDB:', notificationId);
            } else if (result.queued) {
              console.log('⏳ Notification queued for sync (will retry):', notificationId);
            }
          })();
          
          return updatedNotifications;
        });
      } catch (error) {
        console.error('Error in sendMessageWithType:', error);
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
        const isDevelopment = isDevelopmentEnvironment() ||
                             window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1' ||
                             window.location.hostname.includes('localhost') ||
                             window.location.hostname.includes('127.0.0.1');
        
        // First update local state for immediate UI response
        // CRITICAL: Never allow role to be updated via this function (security)
        const safeUpdates = { ...updates };
        delete safeUpdates.role; // Prevent role changes through profile updates
        
        setUsers(prev => prev.map(user => 
          user.email === email ? { ...user, ...safeUpdates } : user
        ));
        
        // Also update currentUser if it's the same user
        if (currentUser && currentUser.email === email) {
          // CRITICAL: Always preserve role when updating currentUser
          setCurrentUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, ...safeUpdates };
            // Ensure role is always preserved
            updated.role = prev.role || 'customer';
            return updated;
          });
          
          // Update localStorage as well
          try {
            // CRITICAL: Preserve role in localStorage update
            const updatedUser = { 
              ...currentUser, 
              ...safeUpdates,
              role: currentUser.role || 'customer' // Always preserve role
            };
            localStorage.setItem('reRideCurrentUser', JSON.stringify(updatedUser));
            sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
          } catch (error) {
            console.error('Failed to update user in localStorage:', error);
          }
        }
        
        // Always update the localStorage users array (both dev and production)
        // This is critical for password updates to persist, especially when API fails
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
        
        // Now update MongoDB via API call (production or when API is available)
        try {
          console.log('📡 Sending user update request to API...', { email, hasPassword: !!updates.password });
          
          // Use authenticated fetch with automatic token refresh
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const response = await authenticatedFetch('/api/users', {
            method: 'PUT',
            body: JSON.stringify({
              email: email,
              ...updates
            })
          });
          
          console.log('📥 API response received:', { status: response.status, ok: response.ok });
          
          // Use the response handler for consistent error handling
          const { handleApiResponse } = await import('../utils/authenticatedFetch');
          const apiResult = await handleApiResponse(response);
          
          if (!apiResult.success) {
            console.error('❌ API error response:', { status: response.status, error: apiResult.error, reason: apiResult.reason });
            
            // Handle 401 Unauthorized - token might be expired
            if (response.status === 401) {
              console.warn('⚠️ 401 Unauthorized - Token may be expired. Update saved locally only.');
              // Don't throw - allow local update to proceed (already updated above)
              if (updates.password) {
                addToast('Password updated locally. Please log in again to sync with server.', 'warning');
              } else {
                addToast('Profile updated locally. Please log in again to sync with server.', 'warning');
              }
              return; // Local update already completed above
            }
            
            // Handle 500 Internal Server Error - server issue
            if (response.status === 500) {
              console.warn('⚠️ 500 Server Error - Update saved locally only.');
              if (updates.password) {
                addToast('Password updated locally. Server error - changes will sync when server is available.', 'warning');
              } else {
                addToast('Profile updated locally. Server error - changes will sync when server is available.', 'warning');
              }
              return; // Local update already completed above
            }
            
            // For other errors, still throw but with better message
            throw new Error(apiResult.reason || apiResult.error || `API call failed: ${response.status}`);
          }
          
          const result = apiResult.data || {};
          console.log('✅ User updated in MongoDB:', { success: result?.success, hasUser: !!result?.user });
          
          // Update local state with the returned user data if available
          if (result?.user) {
            // CRITICAL: Preserve role if not in API response (shouldn't happen, but safety check)
            const updatedUserData = {
              ...result.user,
              role: result.user.role || currentUser?.role || 'customer' // Preserve existing role
            };
            
            setUsers(prev => prev.map(user => 
              user.email === email ? { ...user, ...updatedUserData } : user
            ));
            
            if (currentUser && currentUser.email === email) {
              // CRITICAL: Always preserve role when updating currentUser
              const mergedUser = { 
                ...currentUser, 
                ...updatedUserData,
                role: updatedUserData.role || currentUser.role || 'customer' // Ensure role is never lost
              };
              
              setCurrentUser(mergedUser);
              // Update localStorage
              try {
                localStorage.setItem('reRideCurrentUser', JSON.stringify(mergedUser));
                sessionStorage.setItem('currentUser', JSON.stringify(mergedUser));
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
            } else if (errorMsg.includes('503') || errorMsg.includes('Database connection') || errorMsg.includes('MongoDB connection')) {
              console.error('❌ Database connection error:', apiError);
              if (updates.password) {
                if (isDevelopment) {
                  addToast('Password updated successfully (saved locally)', 'success');
                } else {
                  addToast('Database connection error. Please try again in a moment.', 'error');
                }
              } else {
                addToast('Database connection error. Please try again.', 'error');
              }
            } else if (errorMsg.includes('500') || errorMsg.includes('Database error') || errorMsg.includes('Internal server')) {
              console.error('❌ Server/Database error updating user:', apiError);
              // For password updates, provide specific feedback
              // Password was already saved locally above, so show appropriate message
              if (updates.password) {
                // Password is saved locally - show warning that it will sync when server is available
                addToast('Password updated locally. Server error - changes will sync when server is available.', 'warning');
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
      const user = users.find(u => u.email === email);
      
      // Log audit entry for user deletion
      const actor = currentUser?.name || currentUser?.email || 'System';
      const userInfo = user ? `${user.name} (${user.email})` : email;
      const entry = logAction(actor, 'Delete User', email, `Deleted user: ${userInfo}`);
      setAuditLog(prev => [entry, ...prev]);
      
      setUsers(prev => prev.filter(user => user.email !== email));
      addToast('User deleted successfully', 'success');
    },
    updateVehicle: async (id: number, updates: Partial<Vehicle>, options?: VehicleUpdateOptions) => {
      await updateVehicleHandler(id, updates, options);
    },
    deleteVehicle: async (id: number) => {
      try {
        const vehicle = vehicles.find(v => v.id === id);
        
        // Call API to delete vehicle
        const { deleteVehicle: deleteVehicleApi } = await import('../services/vehicleService');
        const result = await deleteVehicleApi(id);
        
        if (result.success) {
          // Log audit entry for vehicle deletion
          const actor = currentUser?.name || currentUser?.email || 'System';
          const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${id})` : `Vehicle #${id}`;
          const entry = logAction(actor, 'Delete Vehicle', vehicleInfo, `Deleted vehicle: ${vehicleInfo}`);
          setAuditLog(prev => [entry, ...prev]);
          
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
    currentView, previousView, selectedVehicle, vehicles, isLoading, currentUser,
    comparisonList, ratings, sellerRatings, wishlist, conversations, toasts,
    forgotPasswordRole, typingStatus, selectedCategory, publicSellerProfile,
    activeChat, isAnnouncementVisible, recommendations, initialSearchQuery,
    isCommandPaletteOpen, userLocation, selectedCity, users, platformSettings,
    auditLog, vehicleData, faqItems, supportTickets, notifications,
    setCurrentView, setPreviousView, setSelectedVehicle, setVehicles, setIsLoading,
    setCurrentUser, setComparisonList, setWishlist, setConversations, setToasts,
    setForgotPasswordRole, setTypingStatus, setSelectedCategory, setPublicSellerProfile,
    setActiveChat, setIsAnnouncementVisible, setRecommendations, setInitialSearchQuery,
    setIsCommandPaletteOpen, updateUserLocation, updateSelectedCity, setUsers,
    setPlatformSettings, setAuditLog, setVehicleData, setFaqItems, setSupportTickets,
    setNotifications, addToast, removeToast, navigate, handleLogin, handleLogout,
    updateVehicleHandler
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
});

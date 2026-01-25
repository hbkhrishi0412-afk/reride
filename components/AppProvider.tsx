import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Vehicle, User, Conversation, Toast as ToastType, PlatformSettings, AuditLogEntry, VehicleData, Notification, VehicleCategory, SupportTicket, FAQItem, SubscriptionPlan, ChatMessage } from '../types';
import { View, VehicleCategory as CategoryEnum } from '../types';
import { getConversations, saveConversations } from '../services/chatService';
import { saveConversationWithSync, addMessageWithSync } from '../services/syncService';
import { saveNotificationWithSync } from '../services/syncService';
import { getSettings } from '../services/settingsService';
import { getAuditLog, logAction, saveAuditLog } from '../services/auditLogService';
import { getFaqs, saveFaqs } from '../services/faqService';
import { getSupportTickets } from '../services/supportTicketService';
import { dataService } from '../services/dataService';
import { getAuthHeaders } from '../utils/authenticatedFetch';
import { VEHICLE_DATA } from './vehicleData';
import { isDevelopmentEnvironment } from '../utils/environment';
import { showNotification } from '../services/notificationService';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';

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
  goBack: (fallbackView?: View) => void;
  
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
  onImportUsers: (users: Omit<User, 'id'>[]) => Promise<void>;
  onExportVehicles: () => void;
  onImportVehicles: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => Promise<void>;
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
  flagContent: (type: 'vehicle' | 'conversation', id: number | string, reason?: string) => void;
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

// Hook export - Fast Refresh compatible
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

// Component export - Fast Refresh compatible with displayName
// Note: Context providers should NOT be memoized as they need to re-render when state changes
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Track which notifications have already shown browser notifications
  const shownNotificationIdsRef = useRef<Set<number>>(new Set());
  // Track vehicles currently being updated to prevent duplicate updates
  const updatingVehiclesRef = useRef<Set<number>>(new Set());
  // Counter for generating unique toast IDs to prevent collisions
  // FIXED: Use simple incrementing counter to avoid precision issues with large numbers
  const toastCounterRef = useRef<number>(0);
  // FIXED: Store timestamps separately to avoid precision loss from division operations
  const toastTimestampsRef = useRef<Map<number, number>>(new Map());
  
  // All state from App.tsx moved here
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [previousView, setPreviousView] = useState<View>(View.HOME);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  // Flag to prevent navigation loops when handling popstate
  const isHandlingPopStateRef = useRef(false);
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
      
      // FIXED: Generate unique toast ID using simple incrementing counter
      // This avoids precision issues with large numbers (now * 1000 creates ~1.7×10^15)
      // JavaScript's floating point precision can cause Math.floor(id / 1000) to fail
      const id = toastCounterRef.current;
      toastCounterRef.current += 1;
      
      // Store timestamp separately to avoid precision loss from division operations
      toastTimestampsRef.current.set(id, now);
      
      // Prevent duplicate toasts: Check if the same message and type already exists
      // and was added within the last 3 seconds
      const toastId = id;
      
      setToasts(prev => {
        const recentDuplicate = prev.find(
          toast => {
            if (toast.message !== trimmedMessage || toast.type !== type) {
              return false;
            }
            // Use stored timestamp instead of extracting from ID to avoid precision issues
            const toastTimestamp = toastTimestampsRef.current.get(toast.id);
            if (toastTimestamp === undefined) {
              return false; // Timestamp not found, assume not recent
            }
            return (now - toastTimestamp) < 3000;
          }
        );
        
        if (recentDuplicate) {
          // Toast with same message already exists and is recent, skip adding duplicate
          if (process.env.NODE_ENV === 'development') {
            console.log('Skipping duplicate toast:', trimmedMessage);
          }
          // Clean up the timestamp we just stored since we're not using this ID
          toastTimestampsRef.current.delete(id);
          return prev;
        }
        
        const toast: ToastType = { id, message: trimmedMessage, type };
        
        // Schedule auto-remove after 5 seconds - do this inside the state update callback
        // to ensure it only runs when the toast is actually added (not a duplicate)
        // Use setTimeout to schedule after the current state update completes
        setTimeout(() => {
          setToasts(prevToasts => {
            const filtered = prevToasts.filter(t => t.id !== toastId);
            // Clean up timestamp when toast is removed
            if (filtered.length < prevToasts.length) {
              toastTimestampsRef.current.delete(toastId);
            }
            return filtered;
          });
        }, 5000);
        
        return [...prev, toast];
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding toast:', error);
      }
    }
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => {
      const filtered = prev.filter(toast => toast.id !== id);
      // Clean up timestamp when toast is manually removed
      if (filtered.length < prev.length) {
        toastTimestampsRef.current.delete(id);
      }
      return filtered;
    });
  }, []);

  // CRITICAL: Emergency fail-safe to prevent infinite loading
  // Only show notification if we have no vehicles loaded at all
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      setIsLoading(current => {
        if (current && vehicles.length === 0) {
          // Only show notification if we truly have no data
          console.warn('⚠️ EMERGENCY: No vehicles loaded after 3s');
          addToast('Loading vehicles...', 'info');
          return false;
        }
        return current;
      });
    }, 3000); // Reduced from 5000 to 3000 for faster response
    
    return () => clearTimeout(emergencyTimeout);
  }, [addToast, vehicles.length]); // Add vehicles.length dependency

  const handleLogout = useCallback(async () => {
    try {
      // Sign out from Supabase if authenticated
      try {
        const { getSupabaseClient } = await import('../lib/supabase');
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      } catch (supabaseError) {
        // Supabase may not be initialized or user may not be using Supabase auth
        console.log('Supabase sign out skipped:', supabaseError);
      }

      // Clear tokens via logout service
      try {
        const { logout: logoutService } = await import('../services/userService');
        logoutService();
      } catch (logoutError) {
        console.warn('Logout service error:', logoutError);
      }

      // Clear user state
      setCurrentUser(null);
      
      // Clear storage
      sessionStorage.removeItem('currentUser');
      localStorage.removeItem('reRideCurrentUser');
      localStorage.removeItem('reRideAccessToken');
      localStorage.removeItem('reRideRefreshToken');
      localStorage.removeItem('rememberedCustomerEmail');
      localStorage.removeItem('rememberedSellerEmail');
      
      // Clear user-specific data
      setActiveChat(null);
      setComparisonList([]);
      setWishlist([]);
      
      // Navigate to home
      setCurrentView(View.HOME);
      
      // Show success message
      addToast('You have been logged out.', 'info');
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if there's an error, clear local state
      setCurrentUser(null);
      sessionStorage.removeItem('currentUser');
      localStorage.removeItem('reRideCurrentUser');
      setCurrentView(View.HOME);
      setActiveChat(null);
      addToast('You have been logged out.', 'info');
    }
  }, [addToast, setComparisonList, setWishlist]);

  // Listen for userDataUpdated events to sync currentUser state when plan expiry changes
  useEffect(() => {
    const handleUserDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ user: User }>;
      if (customEvent.detail?.user) {
        const updatedUser = customEvent.detail.user;
        // Only update if this is the current user
        setCurrentUser(prev => {
          if (prev && prev.email === updatedUser.email) {
            return updatedUser;
          }
          return prev;
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ User data updated from custom event:', updatedUser.email);
        }
      }
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdated);
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdated);
    };
  }, []);

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
    } else if (user.role === 'customer') {
      // Customers go to HOME (they can access BUYER_DASHBOARD from profile/navigation)
      setCurrentView(View.HOME);
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
    } else if (user.role === 'customer') {
      // Customers go to HOME (they can access BUYER_DASHBOARD from profile/navigation)
      setCurrentView(View.HOME);
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
    // Don't navigate if we're currently handling a popstate event
    // This prevents navigation loops when browser back/forward is used
    if (isHandlingPopStateRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏸️ Navigation skipped - handling popstate event');
      }
      return;
    }
    
    // Prevent infinite redirect loops by checking if we're already on the target view
    // EXCEPTION: Allow navigation to DETAIL view even if already on DETAIL (different vehicle)
    if (view === currentView && !params?.city && view !== View.DETAIL) {
      return; // Already on this view, no need to navigate (except for DETAIL view)
    }

    // Update previous view before changing current view
    setPreviousView(currentView);

    // Fixed: Preserve selectedVehicle when navigating TO DETAIL view or between DETAIL and SELLER_PROFILE
    // Calculate this early to avoid TypeScript type narrowing issues
    // Preserve if: navigating TO detail (covers both initial navigation and from seller profile),
    // or navigating FROM detail TO seller profile
    const preserveSelectedVehicle = view === View.DETAIL || 
      (view === View.SELLER_PROFILE && currentView === View.DETAIL);

    const isNavigatingAwayFromSellerProfile = currentView === View.SELLER_PROFILE && view !== View.SELLER_PROFILE;
    if (isNavigatingAwayFromSellerProfile) { 
      // Clear public seller profile when navigating away
      // Don't modify history here - let the normal navigation flow handle it
      setPublicSellerProfile(null); 
    }
    setInitialSearchQuery('');
    
    // CRITICAL FIX: When navigating to DETAIL, ensure vehicle is available
    // Check sessionStorage FIRST (it's synchronous and always up-to-date)
    // React state updates are async, so sessionStorage is the source of truth
    if (view === View.DETAIL) {
      let vehicleFound = false;
      let vehicleToUse: Vehicle | null = null;
      
      try {
        // ALWAYS check sessionStorage first - it's the most reliable source
        const storedVehicle = sessionStorage.getItem('selectedVehicle');
        if (storedVehicle) {
          try {
            vehicleToUse = JSON.parse(storedVehicle);
            if (vehicleToUse && vehicleToUse.id) {
              vehicleFound = true;
              // Always update state from sessionStorage when navigating to DETAIL
              // This ensures state is in sync even if there was a race condition
              setSelectedVehicle(vehicleToUse);
              if (process.env.NODE_ENV === 'development') {
                console.log('🔧 Restored vehicle from sessionStorage during navigation:', vehicleToUse.id, vehicleToUse.make, vehicleToUse.model);
              }
            }
          } catch (parseError) {
            console.error('❌ Failed to parse vehicle from sessionStorage:', parseError);
            // Clear corrupted data
            sessionStorage.removeItem('selectedVehicle');
          }
        }
        
        // If not found in sessionStorage, check state as fallback
        if (!vehicleFound && selectedVehicle && selectedVehicle.id) {
          vehicleToUse = selectedVehicle;
          vehicleFound = true;
          // Sync state to sessionStorage for consistency
          try {
            sessionStorage.setItem('selectedVehicle', JSON.stringify(selectedVehicle));
            if (process.env.NODE_ENV === 'development') {
              console.log('🔧 Synced vehicle from state to sessionStorage:', selectedVehicle.id);
            }
          } catch (error) {
            console.warn('⚠️ Failed to sync vehicle to sessionStorage:', error);
          }
        }
        
        // If still no vehicle found, this is an error condition
        if (!vehicleFound) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Attempted to navigate to DETAIL view without a vehicle in sessionStorage or state');
            console.warn('⚠️ Current selectedVehicle:', selectedVehicle);
            console.warn('⚠️ SessionStorage value:', sessionStorage.getItem('selectedVehicle'));
          }
          // DON'T redirect here - let the DETAIL view handle the error state
          // This allows the user to see what went wrong instead of silently redirecting
          // The DETAIL view will show "Vehicle Not Found" message
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error checking for vehicle during navigation:', error);
        }
        // Don't redirect on error - let DETAIL view handle it
      }
      
      // Continue with navigation regardless - let DETAIL view decide what to show
      // This ensures navigation always happens, and DETAIL view can handle missing vehicle gracefully
    }
    
    // Only clear selectedVehicle if we're NOT preserving it
    // preserveSelectedVehicle is already true when navigating to DETAIL view
    if (!preserveSelectedVehicle) {
      setSelectedVehicle(null);
    }
    
    if (view === View.USED_CARS && currentView !== View.HOME) setSelectedCategory('ALL');
    if (view === View.CITY_LANDING && params?.city) {
      updateSelectedCity(params.city);
    }
    if (view === View.USED_CARS) {
      // Explicitly check if city parameter exists and is not empty
      if (params && params.city !== undefined && params.city !== '') {
        // Set city filter when city is provided
        if (process.env.NODE_ENV === 'development') {
          console.log('🔵 AppProvider: Setting city filter to:', params.city);
        }
        updateSelectedCity(params.city);
      } else {
        // Clear city filter when no city parameter or empty string (View all cars)
        if (process.env.NODE_ENV === 'development') {
          console.log('🔵 AppProvider: Clearing city filter');
        }
        updateSelectedCity('');
      }
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
      // For all other views including DETAIL, set the current view
      // DETAIL view will handle showing error if vehicle is missing
      if (process.env.NODE_ENV === 'development' && view === View.DETAIL) {
        console.log('🎯 Setting currentView to DETAIL');
      }
      setCurrentView(view);
    }

    // Update path for friendly URLs and store view in history state
    try {
      let newPath = window.location.pathname;
      if (view === View.ADMIN_LOGIN) newPath = '/admin/login';
      else if (view === View.NEW_CARS_ADMIN_LOGIN) newPath = '/admin/new-cars';
      else if (view === View.NEW_CARS_ADMIN_PANEL) newPath = '/admin/new-cars/manage';
      else if (view === View.LOGIN_PORTAL || view === View.CUSTOMER_LOGIN || view === View.SELLER_LOGIN) newPath = '/login';
      else if (view === View.HOME) newPath = '/';
      
      // Store view and previous view in history state for back button support
      // Also store selectedVehicle ID if we're on DETAIL view
      const historyState: any = {
        view: view,
        previousView: currentView,
        timestamp: Date.now()
      };
      
      // Store selectedVehicle ID for DETAIL view so we can restore it
      // Check both state and sessionStorage (in case state hasn't updated yet)
      let vehicleForDetail = selectedVehicle;
      if (view === View.DETAIL && !vehicleForDetail) {
        try {
          const storedVehicle = sessionStorage.getItem('selectedVehicle');
          if (storedVehicle) {
            vehicleForDetail = JSON.parse(storedVehicle);
          }
        } catch (error) {
          // Ignore sessionStorage errors
        }
      }
      if (view === View.DETAIL && vehicleForDetail) {
        historyState.selectedVehicleId = vehicleForDetail.id;
      }
      
      // CRITICAL FIX: Always use pushState to create history entries for back/forward navigation
      // Even if the path doesn't change, we need to create a new history entry so browser back/forward works
      // Only use replaceState on initial load, not during navigation
      if (newPath !== window.location.pathname) {
        // Path changed, use pushState
        window.history.pushState(historyState, '', newPath);
      } else {
        // Path didn't change but view did - still use pushState to create history entry
        // This ensures browser back/forward buttons work even when views share the same path
        window.history.pushState(historyState, '', newPath);
      }
    } catch {}
  }, [currentView, currentUser, previousView, selectedVehicle]);

  // Go back using browser history, with fallback to a default view
  // This ensures app back buttons are synced with browser back button
  const goBack = useCallback((fallbackView?: View) => {
    // Check if there's a previous view in our tracked state
    // If we have a previous view that's different from current, use browser history
    if (previousView && previousView !== currentView) {
      // Use browser back button - this will trigger popstate event which restores the view
      // This keeps app back button in sync with browser back button
      window.history.back();
    } else if (fallbackView) {
      // No tracked history, but we have a fallback view - navigate to it
      navigate(fallbackView);
    } else {
      // Ultimate fallback: go to home
      navigate(View.HOME);
    }
  }, [previousView, currentView, navigate]);

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
      
      // Initialize history state with current view (only on first load)
      if (window.history.state === null || !window.history.state.view) {
        const currentPath = window.location.pathname;
        let initialView: View = View.HOME;
        if (currentPath === '/admin' || currentPath === '/admin/login') {
          initialView = View.ADMIN_LOGIN;
        } else if (currentPath === '/admin/new-cars') {
          initialView = View.NEW_CARS_ADMIN_LOGIN;
        } else if (currentPath === '/admin/new-cars/manage') {
          initialView = View.NEW_CARS_ADMIN_PANEL;
        } else if (currentPath === '/login') {
          initialView = View.LOGIN_PORTAL;
        }
        const initialState: any = { 
          view: initialView, 
          previousView: View.HOME, 
          timestamp: Date.now() 
        };
        // Note: initialView is never View.DETAIL based on current path mappings
        // If DETAIL view initialization is needed in the future, add the path mapping above
        window.history.replaceState(initialState, '', currentPath);
      }
    } catch {}
  }, [selectedVehicle]);

  // Handle browser back/forward button navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      try {
        // Set flag to prevent navigation loops
        isHandlingPopStateRef.current = true;
        
        // Restore view from history state
        if (event.state && event.state.view) {
          const restoredView = event.state.view as View;
          if (process.env.NODE_ENV === 'development') {
            console.log('🔙 Browser back/forward button pressed, restoring view:', restoredView, 'state:', event.state);
          }
          
          // Update previous view
          if (event.state.previousView) {
            setPreviousView(event.state.previousView as View);
          }
          
          // Restore selectedVehicle if we're going to DETAIL view and have the ID
          if (restoredView === View.DETAIL && event.state.selectedVehicleId) {
            const vehicleId = event.state.selectedVehicleId;
            const vehicleToRestore = Array.isArray(vehicles) ? vehicles.find(v => v.id === vehicleId) : undefined;
            if (vehicleToRestore) {
              setSelectedVehicle(vehicleToRestore);
              if (process.env.NODE_ENV === 'development') {
                console.log('🔙 Restoring selectedVehicle:', vehicleToRestore.id, vehicleToRestore.make, vehicleToRestore.model);
              }
            } else {
              // Vehicle not found, clear selection
              setSelectedVehicle(null);
            }
          } else if (restoredView !== View.DETAIL) {
            // Not going to DETAIL view, clear selected vehicle
            setSelectedVehicle(null);
          }
          
          // Clear public seller profile when navigating away from seller profile
          if (restoredView !== View.SELLER_PROFILE) {
            setPublicSellerProfile(null);
          }
          
          // Restore the view - this should trigger re-render with correct state
          setCurrentView(restoredView);
        } else {
          // Fallback: try to determine view from URL path
          const path = window.location.pathname.toLowerCase();
          let fallbackView = View.HOME;
          if (path === '/admin' || path === '/admin/login') {
            fallbackView = View.ADMIN_LOGIN;
          } else if (path === '/admin/new-cars') {
            fallbackView = View.NEW_CARS_ADMIN_LOGIN;
          } else if (path === '/admin/new-cars/manage') {
            fallbackView = View.NEW_CARS_ADMIN_PANEL;
          } else if (path === '/login') {
            fallbackView = View.LOGIN_PORTAL;
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🔙 No history state found, using fallback view from URL:', fallbackView);
          }
          setCurrentView(fallbackView);
        }
        
        // Clear flag after a short delay to allow state updates to complete
        setTimeout(() => {
          isHandlingPopStateRef.current = false;
        }, 100);
      } catch (error) {
        isHandlingPopStateRef.current = false;
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error handling popstate:', error);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setCurrentView, setPreviousView, setSelectedVehicle, setPublicSellerProfile, vehicles]);

  // CRITICAL: Listen for force loading completion event (safety mechanism)
  useEffect(() => {
    const handleForceLoadingComplete = () => {
      console.warn('⚠️ Force loading complete event received, clearing loading state');
      setIsLoading(false);
      // Removed toast notification - no longer needed since we show cached data immediately
    };

    window.addEventListener('forceLoadingComplete', handleForceLoadingComplete);
    
    return () => {
      window.removeEventListener('forceLoadingComplete', handleForceLoadingComplete);
    };
  }, []); // Removed addToast dependency

  // Load initial data with instant cache display and background refresh
  useEffect(() => {
    let isMounted = true;
    let hasLoadedFreshData = false; // Track if we've already loaded fresh data
    
    const loadInitialData = async () => {
      try {
        let hasCachedData = false;
        
        // STEP 1: Load cached vehicles IMMEDIATELY (synchronous, instant)
        const cacheKey = 'reRideVehicles_prod';
        try {
          const cachedVehiclesJson = localStorage.getItem(cacheKey);
          if (cachedVehiclesJson) {
            const cachedVehicles = JSON.parse(cachedVehiclesJson);
            if (Array.isArray(cachedVehicles) && cachedVehicles.length > 0) {
              // Show cached vehicles INSTANTLY - don't wait for API
              setVehicles(cachedVehicles);
              setRecommendations(cachedVehicles.slice(0, 6));
              setIsLoading(false); // Stop loading immediately
              hasCachedData = true;
              console.log(`✅ Instantly loaded ${cachedVehicles.length} cached vehicles`);
            }
          }
        } catch (cacheError) {
          console.warn('Failed to load cached vehicles:', cacheError);
        }
        
        // STEP 2: Load cached users IMMEDIATELY
        try {
          const cachedUsersJson = localStorage.getItem('reRideUsers_prod');
          if (cachedUsersJson) {
            const cachedUsers = JSON.parse(cachedUsersJson);
            if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
              setUsers(cachedUsers);
            }
          }
        } catch (cacheError) {
          console.warn('Failed to load cached users:', cacheError);
        }
        
        // STEP 2.5: Load cached conversations IMMEDIATELY (for admin panel)
        try {
          const cachedConversations = getConversations();
          if (cachedConversations && cachedConversations.length > 0 && isMounted) {
            setConversations(cachedConversations);
            console.log(`✅ Instantly loaded ${cachedConversations.length} cached conversations`);
          }
        } catch (cacheError) {
          console.warn('Failed to load cached conversations:', cacheError);
        }
        
        // STEP 3: Fetch fresh data from API in background (non-blocking)
        // This updates the cache and UI silently
        const isAdmin = currentUser?.role === 'admin';
        
        // Use shorter timeout for faster failure handling
        const loadWithTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((resolve) => {
              setTimeout(() => resolve(fallback), timeoutMs);
            })
          ]);
        };
        
        // Load vehicles and users in parallel with OLX-style timeout (3 seconds for initial 30 vehicles)
        Promise.all([
          loadWithTimeout(
            dataService.getVehicles(isAdmin).catch(() => []),
            3000, // OLX-style: 3 seconds for initial 30 vehicles (faster than loading all)
            []
          ),
          loadWithTimeout(
            dataService.getUsers().catch(() => []),
            2000, // Aggressive 2-second timeout
            []
          )
        ]).then(([vehiclesData, usersData]) => {
          if (!isMounted) return;
          
          // Always update vehicles state, even if empty (to clear loading state)
          if (Array.isArray(vehiclesData)) {
            setVehicles(vehiclesData);
            if (vehiclesData.length > 0) {
              setRecommendations(vehiclesData.slice(0, 6));
              console.log(`✅ Updated with ${vehiclesData.length} fresh vehicles from API`);
            } else {
              console.warn('⚠️ API returned empty vehicles array. Check database for published vehicles.');
            }
          } else {
            console.error('❌ API returned non-array vehicles data:', typeof vehiclesData);
          }
          
          // Always update users state, even if empty array (for consistency)
          if (Array.isArray(usersData)) {
            if (usersData.length > 0) {
              setUsers(usersData);
              console.log(`✅ Updated with ${usersData.length} fresh users from API`);
            } else {
              // In development mode, if API returns empty and no cached data, try fallback users
              const isDevelopment = isDevelopmentEnvironment() || 
                                    (typeof window !== 'undefined' && 
                                     (window.location.hostname === 'localhost' || 
                                      window.location.hostname === '127.0.0.1'));
              if (isDevelopment) {
                // Check if we already have users from cache
                const currentUsersJson = localStorage.getItem('reRideUsers_prod') || localStorage.getItem('reRideUsers');
                if (currentUsersJson) {
                  try {
                    const currentUsers = JSON.parse(currentUsersJson);
                    if (Array.isArray(currentUsers) && currentUsers.length > 0) {
                      console.log(`✅ Using ${currentUsers.length} cached users (API returned empty)`);
                      setUsers(currentUsers);
                    } else {
                      // Cached data exists but is empty, try fallback
                      console.warn('⚠️ Cached users exist but are empty. Checking for fallback users in development mode...');
                      import('../services/userService').then(({ getUsersLocal }) => {
                        getUsersLocal().then(fallbackUsers => {
                          if (fallbackUsers.length > 0 && isMounted) {
                            console.log(`✅ Using ${fallbackUsers.length} fallback users in development mode`);
                            setUsers(fallbackUsers);
                          } else {
                            console.log('ℹ️ No users available (API returned empty, cache empty, no fallback)');
                            setUsers([]);
                          }
                        }).catch(() => {
                          if (isMounted) setUsers([]);
                        });
                      }).catch(() => {
                        if (isMounted) setUsers([]);
                      });
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse cached users, trying fallback:', parseError);
                    // Try fallback if cache parse fails
                    import('../services/userService').then(({ getUsersLocal }) => {
                      getUsersLocal().then(fallbackUsers => {
                        if (fallbackUsers.length > 0 && isMounted) {
                          console.log(`✅ Using ${fallbackUsers.length} fallback users in development mode`);
                          setUsers(fallbackUsers);
                        } else {
                          if (isMounted) setUsers([]);
                        }
                      }).catch(() => {
                        if (isMounted) setUsers([]);
                      });
                    }).catch(() => {
                      if (isMounted) setUsers([]);
                    });
                  }
                } else {
                  // No cached data, try fallback users
                  console.warn('⚠️ No users found in API or cache. Checking for fallback users in development mode...');
                  import('../services/userService').then(({ getUsersLocal }) => {
                    getUsersLocal().then(fallbackUsers => {
                      if (fallbackUsers.length > 0 && isMounted) {
                        console.log(`✅ Using ${fallbackUsers.length} fallback users in development mode`);
                        setUsers(fallbackUsers);
                      } else {
                        console.log('ℹ️ No users available (API returned empty, no cache, no fallback)');
                        setUsers([]);
                      }
                    }).catch(() => {
                      if (isMounted) setUsers([]);
                    });
                  }).catch(() => {
                    if (isMounted) setUsers([]);
                  });
                }
              } else {
                // Production mode: just set empty array
                setUsers([]);
                console.log('ℹ️ API returned empty users array (production mode)');
              }
            }
          }
          
          // If no cached data was available, stop loading now
          if (!hasCachedData) {
            setIsLoading(false);
          }
        }).catch(error => {
          console.warn('Background data refresh failed (using cache):', error);
          // If no cached data was available, stop loading even on error
          if (!hasCachedData && isMounted) {
            setIsLoading(false);
          }
        });
        
        // STEP 4: Load non-critical data in parallel (no sequential delays)
        Promise.all([
          // FAQs
          (async () => {
            try {
              const { fetchFaqsFromSupabase } = await import('../services/faqService');
              const faqsData = await fetchFaqsFromSupabase().catch(() => []);
              if (isMounted) setFaqItems(faqsData);
            } catch (error) {
              const localFaqs = getFaqs();
              if (isMounted) setFaqItems(localFaqs || []);
            }
          })(),
          
          // Vehicle data
          (async () => {
            try {
              const vehicleDataData = await dataService.getVehicleData().catch(() => null);
              if (isMounted && vehicleDataData) setVehicleData(vehicleDataData);
            } catch (error) {
              console.warn('Failed to load vehicle data:', error);
            }
          })(),
          
          // Conversations - load cached first, then refresh in background
          (async () => {
            try {
              // STEP 1: Load cached conversations immediately (non-blocking)
              try {
                const cachedConversations = getConversations();
                if (cachedConversations && cachedConversations.length > 0 && isMounted) {
                  setConversations(cachedConversations);
                  console.log(`✅ Instantly loaded ${cachedConversations.length} cached conversations`);
                }
              } catch (cacheError) {
                console.warn('Failed to load cached conversations:', cacheError);
              }
              
              // STEP 2: Fetch fresh conversations in background (non-blocking, with timeout)
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
              
              if (userEmail || userRole) {
                // Use timeout to prevent blocking - max 3 seconds
                const conversationPromise = (async () => {
                  const { getConversationsFromMongoDB } = await import('../services/conversationService');
                  return userRole === 'seller' 
                    ? await getConversationsFromMongoDB(undefined, userEmail)
                    : userRole === 'customer'
                    ? await getConversationsFromMongoDB(userEmail)
                    : await getConversationsFromMongoDB();
                })();
                
                const timeoutPromise = new Promise<{ success: boolean; data?: Conversation[] }>((resolve) => {
                  setTimeout(() => resolve({ success: false }), 3000);
                });
                
                const result = await Promise.race([conversationPromise, timeoutPromise]);
                
                if (isMounted) {
                  if (result.success && result.data) {
                    setConversations(result.data);
                    // Cache the fresh data
                    try {
                      localStorage.setItem('reRideConversations', JSON.stringify(result.data));
                    } catch {}
                  }
                  // If result failed but we already have cached data, keep using cache
                }
              }
            } catch (error) {
              console.warn('Failed to load conversations:', error);
              if (isMounted) {
                const localConversations = getConversations();
                if (localConversations && localConversations.length > 0) {
                  setConversations(localConversations);
                } else {
                  setConversations([]);
                }
              }
            }
          })(),
          
          // Notifications
          (async () => {
            try {
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
                if (isMounted && result.success && result.data) {
                  setNotifications(result.data);
                  try {
                    localStorage.setItem('reRideNotifications', JSON.stringify(result.data));
                  } catch (error) {
                    console.warn('Failed to save notifications:', error);
                  }
                }
              }
            } catch (error) {
              console.warn('Failed to load notifications:', error);
              if (isMounted) {
                try {
                  const notificationsJson = localStorage.getItem('reRideNotifications');
                  setNotifications(notificationsJson ? JSON.parse(notificationsJson) : []);
                } catch {
                  setNotifications([]);
                }
              }
            }
          })()
        ]).catch(error => {
          console.warn('Background data loading failed:', error);
        });
        
      } catch (error) {
        console.error('AppProvider: Error loading initial data:', error);
        if (isMounted) {
          // Ensure we have at least empty arrays
          setVehicles(prev => Array.isArray(prev) ? prev : []);
          setUsers(prev => Array.isArray(prev) ? prev : []);
          setRecommendations([]);
          setIsLoading(false);
          if (process.env.NODE_ENV === 'development') {
            addToast('Some data failed to load. The app will continue with available data.', 'warning');
          }
        }
      }
    };

    loadInitialData();
    
    return () => {
      isMounted = false;
    };
  }, [addToast, currentUser?.role]);

  // Refresh server-sourced data whenever the authenticated user changes
  // Only runs when user changes, not on initial load (to avoid duplicate fetches)
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isSubscribed = true;
    let hasRunOnce = false; // Prevent multiple runs

    const syncLatestData = async () => {
      // Skip if we've already run this sync (prevent duplicate fetches on rapid user changes)
      if (hasRunOnce) {
        return;
      }
      hasRunOnce = true;

      try {
        // Don't set loading to true if we already have cached data - show it immediately
        // Only show loading if we have no cached data
        const hasCachedVehicles = localStorage.getItem('reRideVehicles_prod');
        const hasCachedUsers = localStorage.getItem('reRideUsers_prod');
        
        if (!hasCachedVehicles && !hasCachedUsers) {
          setIsLoading(true);
        }
        
        // For admin users, load all vehicles (including unpublished/sold)
        const isAdmin = currentUser?.role === 'admin';
        
        // Load vehicles and users in PARALLEL for faster loading (no sequential delays)
        // Use Promise.allSettled to ensure both complete even if one fails
        const [vehiclesResult, usersResult] = await Promise.allSettled([
          dataService.getVehicles(isAdmin),
          dataService.getUsers()
        ]);

        if (!isSubscribed) {
          return;
        }

        // Update vehicles if fetch succeeded
        if (vehiclesResult.status === 'fulfilled' && Array.isArray(vehiclesResult.value)) {
          setVehicles(vehiclesResult.value);
          // Update recommendations with the latest data
          if (vehiclesResult.value.length > 0) {
            setRecommendations(vehiclesResult.value.slice(0, 6));
          }
        } else if (vehiclesResult.status === 'rejected') {
          console.warn('Failed to sync vehicles:', vehiclesResult.reason);
        }

        // Update users if fetch succeeded
        if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) {
          setUsers(usersResult.value);
        } else if (usersResult.status === 'rejected') {
          console.warn('Failed to sync users:', usersResult.reason);
        }
      } catch (error) {
        console.error('AppProvider: Failed to sync latest data after authentication:', error);
        // Don't show toast on every error - only if critical
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    // Small delay to ensure initial load completes first (prevents duplicate fetches)
    const timeoutId = setTimeout(() => {
      syncLatestData();
    }, 100);

    return () => {
      isSubscribed = false;
      clearTimeout(timeoutId);
    };
  }, [currentUser?.email, currentUser?.role]);

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

  // Periodic sync queue processor - retry failed Supabase saves
  useEffect(() => {
    const SYNC_INTERVAL = 30000; // 30 seconds

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
            console.log(`✅ Successfully synced ${result.success} items to Supabase`);
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

  // Real-time WebSocket listener for conversation updates (end-to-end sync)
  // NOTE: Socket.io is only used in development. In production, Firebase handles real-time conversations.
  useEffect(() => {
    if (!currentUser) return;
    
    // Only initialize Socket.io in development mode
    // In production, Firebase handles conversations, so Socket.io is not needed
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment) {
      return; // Skip Socket.io initialization in production
    }
    
    // Connect to WebSocket for real-time updates (development only)
    // CRITICAL FIX: Dynamically detect protocol (ws: or wss:) based on page protocol
    // This prevents mixed content errors when app is served over HTTPS
    const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = 'localhost:3001';
    const wsUrl = `${wsProtocol}//${wsHost}`;
    
    // Use Socket.io client for real-time updates
    let socket: any = null;
    
    (async () => {
      try {
        // Dynamically import socket.io-client
        // @ts-ignore - socket.io-client types may not be available
        const socketIoClient: any = await import('socket.io-client');
        const io = socketIoClient.default || socketIoClient.io;
        
        // CRITICAL FIX: Add timeout and better error handling for socket.io connection
        socket = io(wsUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 3, // Reduced from 5 to fail faster
          timeout: 5000, // 5 second connection timeout
          // CRITICAL FIX: Disable automatic reconnection after max attempts to prevent spam
          reconnectionDelayMax: 2000
        });
        
        socket.on('connect', () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Connected to WebSocket for real-time conversation updates');
          }
        });
        
        // CRITICAL FIX: Improve error handling - don't spam console with errors
        let connectionErrorLogged = false;
        socket.on('connect_error', (_error: any) => {
          // CRITICAL FIX: Only log error once to prevent console spam
          // Error parameter is prefixed with _ to indicate it's intentionally unused
          if (!connectionErrorLogged) {
            connectionErrorLogged = true;
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ Socket.io connection failed. Real-time updates disabled. Make sure API server is running on port 3001.');
            }
          }
        });
        
        // CRITICAL FIX: Handle reconnection failures gracefully
        socket.on('reconnect_attempt', () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 Attempting to reconnect to WebSocket...');
          }
        });
        
        socket.on('reconnect_failed', () => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ WebSocket reconnection failed. Real-time updates will not be available until server is restarted.');
          }
          // CRITICAL FIX: Disable further reconnection attempts to prevent spam
          socket.io.reconnect(false);
        });
        
        // Listen for new messages from other users
        socket.on('conversation:new-message', (data: { conversationId: string; message: any; conversation: any }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Received real-time message:', data);
          }
          
          // Update conversations state with new message
          setConversations(prev => {
            const existingConv = prev.find(c => c.id === data.conversationId);
            if (existingConv) {
              // Check if message already exists (prevent duplicates)
              const messageExists = existingConv.messages.some(m => m.id === data.message.id);
              if (messageExists) {
                return prev; // Message already exists, no update needed
              }
              
              // Update conversation with new message
              const updated = prev.map(conv => 
                conv.id === data.conversationId
                  ? {
                      ...conv,
                      messages: [...conv.messages, data.message],
                      lastMessageAt: data.conversation.lastMessageAt,
                      isReadBySeller: data.conversation.isReadBySeller,
                      isReadByCustomer: data.conversation.isReadByCustomer
                    }
                  : conv
              );
              
              // Update activeChat if it's the same conversation
              if (activeChat?.id === data.conversationId) {
                const updatedConv = updated.find(c => c.id === data.conversationId);
                if (updatedConv) {
                  setActiveChat(updatedConv);
                }
              }
              
              // Save to localStorage
              try {
                saveConversations(updated);
              } catch (error) {
                console.error('Failed to save conversations to localStorage:', error);
              }
              
              return updated;
            }
            return prev;
          });
        });
        
        socket.on('disconnect', () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Disconnected from WebSocket');
          }
        });
        
        socket.on('error', (error: any) => {
          // CRITICAL FIX: Only log in development to prevent console spam
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ WebSocket error (non-critical):', error?.message || error);
          }
        });
      } catch (error) {
        // CRITICAL FIX: Fail gracefully - app should work without WebSocket
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Failed to initialize WebSocket for conversations. App will continue without real-time updates.');
        }
      }
    })();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [currentUser, activeChat?.id]);

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

      const vehicleToUpdate = Array.isArray(vehicles) ? vehicles.find(v => v.id === id) : undefined;
      if (!vehicleToUpdate) {
        updatingVehiclesRef.current.delete(id);
        addToast('Vehicle not found', 'error');
        return;
      }

      const updatedVehicle = { ...vehicleToUpdate, ...updates };
      const { updateVehicle: updateVehicleApi } = await import('../services/vehicleService');
      const result = await updateVehicleApi(updatedVehicle);

      setVehicles(prev =>
        Array.isArray(prev) ? prev.map(vehicle => (vehicle && vehicle.id === id ? result : vehicle)) : []
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
    goBack,
    
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
        Array.isArray(prev) ? prev.map(user => {
          if (user && user.email === email) {
            // Deep merge verificationStatus if it exists in updateFields
            let updatedUser = { ...user };
            
            if (updateFields.verificationStatus) {
              // Merge verificationStatus whether it exists in user or not
              updatedUser = {
                ...updatedUser,
                ...updateFields,
                verificationStatus: {
                  ...(user.verificationStatus || {}),
                  ...updateFields.verificationStatus
                }
              };
            } else {
              updatedUser = { ...updatedUser, ...updateFields };
            }
            
            // Also merge individual verification fields if they exist in updateFields
            if (updateFields.phoneVerified !== undefined) {
              updatedUser.phoneVerified = updateFields.phoneVerified;
            }
            if (updateFields.emailVerified !== undefined) {
              updatedUser.emailVerified = updateFields.emailVerified;
            }
            if (updateFields.govtIdVerified !== undefined) {
              updatedUser.govtIdVerified = updateFields.govtIdVerified;
            }
            
            // Remove fields that are set to null
            fieldsToRemove.forEach(key => {
              delete (updatedUser as any)[key];
            });
            
            // Also update publicSellerProfile if this is the currently viewed seller
            if (publicSellerProfile?.email === email) {
              setPublicSellerProfile(updatedUser);
            }
            
            return updatedUser;
          }
          return user;
        }) : []
      );
      
      // Also update in API - pass both updates and nulls
      try {
        const { updateUser: updateUserService } = await import('../services/userService');
        
        // Ensure verificationStatus is properly structured for API
        const apiUpdateData: any = { email, ...details };
        
        // If verificationStatus is being updated, ensure it's properly formatted
        if (details.verificationStatus) {
          apiUpdateData.verificationStatus = details.verificationStatus;
        }
        
        // Ensure individual verification fields are also included
        if (details.phoneVerified !== undefined) {
          apiUpdateData.phoneVerified = details.phoneVerified;
        }
        if (details.emailVerified !== undefined) {
          apiUpdateData.emailVerified = details.emailVerified;
        }
        if (details.govtIdVerified !== undefined) {
          apiUpdateData.govtIdVerified = details.govtIdVerified;
        }
        
        await updateUserService(apiUpdateData);
        
        // CRITICAL: Refresh users list from API after successful update to ensure sync
        try {
          const { getUsers: getUsersService } = await import('../services/userService');
          const refreshedUsers = await getUsersService();
          
          // Update the users state with fresh data from API
          setUsers(refreshedUsers);
          
          // Also update localStorage cache
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('reRideUsers', JSON.stringify(refreshedUsers));
            // Trigger storage event to notify other components
            window.dispatchEvent(new Event('storage'));
          }
          
          console.log('✅ Users list refreshed from API after verification update');
        } catch (refreshError) {
          console.warn('⚠️ Failed to refresh users list after update:', refreshError);
          // Don't fail the update if refresh fails - the API update already succeeded
          // The error is logged but not thrown to prevent breaking the update flow
        }
      } catch (error) {
        console.error('❌ Failed to sync user update to API:', error);
        addToast(`Failed to sync update to server: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        // Don't throw - local state is already updated
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
        const existingUser = Array.isArray(users) ? users.find(u => u && u.email && u.email.toLowerCase() === userData.email.toLowerCase()) : undefined;
        if (existingUser) {
          return { success: false, reason: 'User with this email already exists.' };
        }

        // CRITICAL FIX: Create user in Supabase FIRST (real-time), then sync to local state only on success
        try {
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const { handleApiResponse } = await import('../utils/authenticatedFetch');
          
          const response = await authenticatedFetch('/api/main', {
            method: 'POST',
            skipAuth: true, // Registration doesn't require auth
            body: JSON.stringify({
              action: 'register',
              email: userData.email,
              password: userData.password,
              name: userData.name,
              mobile: userData.mobile,
              role: userData.role,
            }),
          });
          
          const apiResult = await handleApiResponse(response);
          
          if (!apiResult.success || !response.ok) {
            const errorReason = apiResult.reason || 'Unknown error';
            console.error('❌ Failed to create user in Supabase:', errorReason);
            addToast(`User creation failed: ${errorReason}`, 'error');
            // Don't create locally - Supabase creation failed
            throw new Error(errorReason);
          }
          
          // Supabase creation succeeded - NOW update local state
          const createdUser = apiResult.data?.user || {
            ...userData,
            status: 'active',
            subscriptionPlan: userData.subscriptionPlan || 'free',
            featuredCredits: userData.featuredCredits || 0,
            usedCertifications: userData.usedCertifications || 0,
          };
          
          // Save to Supabase
          try {
            const { supabaseUserService } = await import('../services/supabase-user-service');
            // Remove password before saving to Supabase (security)
            const { password: _, ...userWithoutPassword } = createdUser;
            await supabaseUserService.create(userWithoutPassword);
            console.log('✅ User saved to Supabase:', createdUser.email);
          } catch (supabaseError) {
            // Log error but don't fail the entire operation if Supabase save fails
            console.warn('⚠️ Failed to save user to Supabase:', supabaseError);
            // Still show success toast since Supabase save succeeded
          }
          
          setUsers(prev => [...prev, createdUser]);
          
          // Save to localStorage after Supabase success
          const isDevelopment = isDevelopmentEnvironment() || window.location.hostname === 'localhost';
          if (isDevelopment) {
            try {
              const { getUsersLocal } = await import('../services/userService');
              const users = await getUsersLocal();
              users.push(createdUser);
              localStorage.setItem('reRideUsers', JSON.stringify(users));
            } catch (localError) {
              console.warn('⚠️ Failed to save user to localStorage:', localError);
            }
          }
          
          console.log('✅ User created and saved to Supabase:', createdUser.email);
          addToast(`User ${createdUser.name} created successfully`, 'success');
          
          // Log audit entry for user creation (inside try block where createdUser is in scope)
          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Create User', createdUser.email, `Created user: ${createdUser.name} (${createdUser.role})`);
          setAuditLog(prev => [entry, ...prev]);
        } catch (apiError) {
          console.error('❌ Error creating user in Supabase:', apiError);
          const errorMsg = apiError instanceof Error ? apiError.message : 'Failed to create user';
          addToast(`User creation failed: ${errorMsg}`, 'error');
          // Don't create locally - Supabase creation failed
          throw apiError;
        }
        
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
          setUsers(prev => Array.isArray(prev) ? prev.map(user => 
            user && user.email === email ? { ...user, subscriptionPlan: plan } : user
          ) : []);
          
          // Log audit entry for plan update
          const actor = currentUser?.name || currentUser?.email || 'System';
          const user = Array.isArray(users) ? users.find(u => u && u.email === email) : undefined;
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
          const user = Array.isArray(users) ? users.find(u => u && u.email === email) : undefined;
          if (!user) return;
          
          const newStatus = user.status === 'active' ? 'inactive' : 'active';
          // Use the updateUser function defined later in contextValue
          const { updateUser: updateUserService } = await import('../services/userService');
          await updateUserService({ email, status: newStatus });
          setUsers(prev => Array.isArray(prev) ? prev.map(user => 
            user && user.email === email ? { ...user, status: newStatus } : user
          ) : []);
          
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
          const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
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
          const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
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
              Array.isArray(prev) ? prev.map(v => (v && v.id === vehicleId ? result.vehicle : v)) : []
            );

            const sellerEmail = result.vehicle?.sellerEmail;
            if (typeof result.remainingCredits === 'number' && sellerEmail) {
              const remainingCredits = result.remainingCredits;

              setUsers(prev =>
                Array.isArray(prev) ? prev.map(user =>
                  user && user.email === sellerEmail
                    ? { ...user, featuredCredits: remainingCredits }
                    : user
                ) : []
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
        const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v.id === id) : undefined;
        setVehicles(prev => Array.isArray(prev) ? prev.map(vehicle => 
          vehicle && vehicle.id === id ? { ...vehicle, isFlagged: false } : vehicle
        ) : []);
        
        // Log audit entry for flag resolution
        const actor = currentUser?.name || currentUser?.email || 'System';
        const targetInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${id})` : `Vehicle #${id}`;
        const entry = logAction(actor, 'Resolve Flag', targetInfo, `Resolved flag on ${type}`);
        setAuditLog(prev => [entry, ...prev]);
      } else {
        setConversations(prev => Array.isArray(prev) ? prev.map(conv => 
          conv && conv.id === id ? { ...conv, isFlagged: false } : conv
        ) : []);
        
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
        const csv = Array.isArray(users) ? users.map(user => 
          `"${user.name}","${user.email}","${user.role}","${user.status}","${user.mobile || ''}","${user.joinedDate || ''}"`
        ).join('\n') : '';
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
    onImportUsers: async (usersToImport: Omit<User, 'id'>[]) => {
      try {
        const { dataService } = await import('../services/dataService');
        let successCount = 0;
        let errorCount = 0;
        
        for (const userData of usersToImport) {
          try {
            // Generate a default password for imported users (they can reset it)
            const defaultPassword = `TempPass${Math.random().toString(36).slice(-8)}`;
            
            // Create user via API register endpoint
            const response = await fetch('/api/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'register',
                email: userData.email,
                password: defaultPassword, // Temporary password
                name: userData.name,
                mobile: userData.mobile,
                role: userData.role,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
              throw new Error(errorData.reason || `Failed to create user: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
              throw new Error(result.reason || 'Failed to create user');
            }

            // If user was created successfully, update additional fields if provided
            if (userData.dealershipName || userData.bio || userData.subscriptionPlan || 
                userData.isVerified !== undefined || userData.location) {
              try {
                const updateResponse = await fetch('/api/users', {
                  method: 'PUT',
                  headers: {
                    ...getAuthHeaders(),
                  },
                  body: JSON.stringify({
                    email: userData.email,
                    ...(userData.dealershipName && { dealershipName: userData.dealershipName }),
                    ...(userData.bio && { bio: userData.bio }),
                    ...(userData.subscriptionPlan && { subscriptionPlan: userData.subscriptionPlan }),
                    ...(userData.isVerified !== undefined && { isVerified: userData.isVerified }),
                    ...(userData.location && { location: userData.location }),
                    ...(userData.phoneVerified !== undefined && { phoneVerified: userData.phoneVerified }),
                    ...(userData.emailVerified !== undefined && { emailVerified: userData.emailVerified }),
                    ...(userData.featuredCredits !== undefined && { featuredCredits: userData.featuredCredits }),
                    ...(userData.usedCertifications !== undefined && { usedCertifications: userData.usedCertifications }),
                    ...(userData.avatarUrl && { avatarUrl: userData.avatarUrl }),
                    ...(userData.logoUrl && { logoUrl: userData.logoUrl }),
                    ...(userData.status && { status: userData.status }),
                  }),
                });

                if (!updateResponse.ok) {
                  console.warn(`Failed to update additional fields for ${userData.email}, but user was created`);
                }
              } catch (updateError) {
                console.warn(`Failed to update additional fields for ${userData.email}:`, updateError);
                // Don't throw - user was created successfully
              }
            }

            successCount++;
          } catch (error) {
            errorCount++;
            console.error(`Failed to import user ${userData.name} (${userData.email}):`, error);
            throw error; // Re-throw to be caught by the modal
          }
        }
        
        // Refresh users list
        const updatedUsers = await dataService.getUsers();
        setUsers(updatedUsers);
        
        // Log audit entry for import
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Import Users', 'Users Data', `Imported ${successCount} users from CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        if (successCount > 0) {
          addToast(`Successfully imported ${successCount} user(s)`, 'success');
        }
        if (errorCount > 0) {
          addToast(`${errorCount} user(s) failed to import`, 'warning');
        }
      } catch (error) {
        console.error('Import failed:', error);
        throw error; // Re-throw to be handled by the modal
      }
    },
    onExportVehicles: () => {
      try {
        const headers = 'Make,Model,Year,Price,Seller,Status,Mileage,Location,Features\n';
        const csv = Array.isArray(vehicles) ? vehicles.map(vehicle => 
          `"${vehicle.make}","${vehicle.model}","${vehicle.year}","${vehicle.price}","${vehicle.sellerEmail}","${vehicle.status}","${vehicle.mileage || ''}","${vehicle.location || ''}","${vehicle.features?.join('; ') || ''}"`
        ).join('\n') : '';
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
    onImportVehicles: async (vehiclesToImport: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => {
      try {
        const { addVehicle } = await import('../services/dataService');
        let successCount = 0;
        let errorCount = 0;
        
        for (const vehicleData of vehiclesToImport) {
          try {
            // Normalize images to array if needed
          const normalizedImages = Array.isArray(vehicleData.images) 
              ? vehicleData.images 
              : typeof vehicleData.images === 'string' 
                ? [vehicleData.images] 
                : [];
            
            const vehicleToAdd = {
              ...vehicleData,
              images: normalizedImages,
            } as Vehicle;
            
            await addVehicle(vehicleToAdd);
            successCount++;
          } catch (error) {
            errorCount++;
            console.error(`Failed to import vehicle ${vehicleData.make} ${vehicleData.model}:`, error);
            throw error; // Re-throw to be caught by the modal
          }
        }
        
        // Refresh vehicles list
        const { dataService } = await import('../services/dataService');
        const isAdmin = currentUser?.role === 'admin';
        const updatedVehicles = await dataService.getVehicles(isAdmin);
        setVehicles(updatedVehicles);
        
        // Log audit entry for import
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Import Vehicles', 'Vehicles Data', `Imported ${successCount} vehicles from CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        if (successCount > 0) {
          addToast(`Successfully imported ${successCount} vehicle(s)`, 'success');
        }
        if (errorCount > 0) {
          addToast(`${errorCount} vehicle(s) failed to import`, 'warning');
        }
      } catch (error) {
        console.error('Import failed:', error);
        throw error; // Re-throw to be handled by the modal
      }
    },
    onExportSales: () => {
      try {
        const soldVehicles = Array.isArray(vehicles) ? vehicles.filter(v => v && v.status === 'sold') : [];
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
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state only on success
        const { saveVehicleData } = await import('../services/vehicleDataService');
        const success = await saveVehicleData(newData);
        
        if (!success) {
          // Supabase update failed - don't update local state
          addToast('Vehicle data update failed. Please try again.', 'error');
          throw new Error('Failed to update vehicle data in Supabase');
        }
        
        // MongoDB update succeeded - NOW update local state
        setVehicleData(newData);
        
        // Log audit entry for vehicle data update
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Update Vehicle Data', 'Vehicle Data', 'Updated vehicle data configuration');
        setAuditLog(prev => [entry, ...prev]);
        
        addToast('Vehicle data updated successfully', 'success');
        console.log('✅ Vehicle data updated via API:', newData);
      } catch (error) {
        // Error already handled with specific toast message in inner catch block (line 1908)
        // Only log here to avoid duplicate error toasts
        console.error('❌ Failed to update vehicle data:', error);
        // Don't show generic toast - inner catch already showed specific error message
        // Don't update local state - Supabase update failed
        throw error;
      }
    },
    onToggleVerifiedStatus: (email: string) => {
      setUsers(prev => Array.isArray(prev) ? prev.map(user => 
        user && user.email === email ? { ...user, isVerified: !user.isVerified } : user
      ) : []);
      addToast(`Verification status toggled for ${email}`, 'success');
    },
    onUpdateSupportTicket: (ticket: SupportTicket) => {
      setSupportTickets(prev => Array.isArray(prev) ? prev.map(t => 
        t && t.id === ticket.id ? ticket : t
      ) : []);
      addToast('Support ticket updated', 'success');
    },
    onAddFaq: async (faq: Omit<FAQItem, 'id'>) => {
      try {
        // CRITICAL FIX: Save to Supabase FIRST (real-time), then sync to local state only on success
        const { saveFaqToSupabase } = await import('../services/faqService');
        const savedFaq = await saveFaqToSupabase(faq);
        
        if (!savedFaq) {
          throw new Error('Failed to save FAQ to Supabase');
        }
        
        // Supabase save succeeded - NOW update local state
        const newFaq: FAQItem = savedFaq || { ...faq, id: Date.now() };
        
        setFaqItems(prev => {
          const updated = [...prev, newFaq];
          saveFaqs(updated);
          return updated;
        });
        
        addToast('FAQ added successfully', 'success');
      } catch (error) {
        console.error('❌ Failed to add FAQ to Supabase:', error);
        addToast('FAQ creation failed. Please try again.', 'error');
        // Don't add locally - Supabase creation failed
        throw error;
      }
    },
    onUpdateFaq: async (faq: FAQItem) => {
      try {
        if (!faq.id) {
          throw new Error('FAQ ID is required for update');
        }
        
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state only on success
        const { updateFaqInSupabase } = await import('../services/faqService');
        const success = await updateFaqInSupabase(faq);
        
        if (!success) {
          throw new Error('Failed to update FAQ in Supabase');
        }
        
        // Supabase update succeeded - NOW update local state
        setFaqItems(prev => {
          const updated = Array.isArray(prev) ? prev.map(f => {
            if (f && f.id === faq.id) {
              return { ...faq };
            }
            return f;
          }) : [];
          saveFaqs(updated);
          return updated;
        });
        addToast('FAQ updated successfully', 'success');
      } catch (error) {
        console.error('❌ Failed to update FAQ in Supabase:', error);
        addToast('FAQ update failed. Please try again.', 'error');
        // Don't update locally - Supabase update failed
        throw error;
      }
    },
    onDeleteFaq: async (id: number) => {
      try {
        // CRITICAL FIX: Delete from Supabase FIRST (real-time), then sync to local state only on success
        const { deleteFaqFromSupabase } = await import('../services/faqService');
        const success = await deleteFaqFromSupabase(id);
        
        if (!success) {
          throw new Error('Failed to delete FAQ from Supabase');
        }
        
        // Supabase delete succeeded - NOW delete from local state
        setFaqItems(prev => {
          const updated = Array.isArray(prev) ? prev.filter(f => f && f.id !== id) : [];
          saveFaqs(updated);
          return updated;
        });
        addToast('FAQ deleted successfully', 'success');
      } catch (error) {
        console.error('❌ Failed to delete FAQ from Supabase:', error);
        addToast('FAQ deletion failed. Please try again.', 'error');
        // Don't delete locally - Supabase delete failed
        throw error;
      }
    },
    onCertificationApproval: (vehicleId: number, decision: 'approved' | 'rejected') => {
      const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
      
      setVehicles(prev => Array.isArray(prev) ? prev.map(vehicle => 
        vehicle && vehicle.id === vehicleId ? { 
          ...vehicle, 
          certificationStatus: decision === 'approved' ? 'certified' : 'rejected' 
        } : vehicle
      ) : []);
      
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
          const updated = Array.isArray(prev) ? prev.map(conv => 
            conv && conv.id === conversationId ? {
              ...conv,
              messages: Array.isArray(conv.messages) ? [...conv.messages, newMessage] : [newMessage],
              lastMessageAt: newMessage.timestamp,
              isReadBySeller: currentUser.role === 'seller' ? true : conv.isReadBySeller,
              isReadByCustomer: currentUser.role === 'customer' ? true : conv.isReadByCustomer
            } : conv
          ) : [];
          
          // Save to localStorage immediately
          try {
            saveConversations(updated);
          } catch (error) {
            console.error('Failed to save conversations to localStorage:', error);
          }
          
          // Save to Supabase with sync queue fallback
          const updatedConversation = updated.find(conv => conv.id === conversationId);
          if (updatedConversation) {
            // CRITICAL FIX: Update activeChat with the updated conversation to ensure UI updates immediately
            // This ensures the ChatWidget receives the updated conversation with the new message
            if (activeChat?.id === conversationId) {
              setActiveChat(updatedConversation);
            }
            
            // Save entire conversation to Supabase (with queue fallback)
            (async () => {
              const result = await saveConversationWithSync(updatedConversation);
              if (result.synced) {
                console.log('✅ Conversation synced to Supabase:', conversationId);
              } else if (result.queued) {
                console.log('⏳ Conversation queued for sync (will retry):', conversationId);
              }
            })();
            
            // Also add message via API with sync queue
            (async () => {
              const result = await addMessageWithSync(conversationId, newMessage);
              if (result.synced) {
                console.log('✅ Message synced to Supabase:', messageId);
                
                // Broadcast message via WebSocket for real-time end-to-end sync (development only)
                // In production, Firebase handles real-time sync, so Socket.io is not needed
                if (process.env.NODE_ENV === 'development') {
                  try {
                    // @ts-ignore - socket.io-client types may not be available
                    const socketIoClient: any = await import('socket.io-client');
                    const io = socketIoClient.default || socketIoClient.io;
                    // CRITICAL FIX: Dynamically detect protocol (ws: or wss:) based on page protocol
                    // This prevents mixed content errors when app is served over HTTPS
                    const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const wsUrl = `${wsProtocol}//localhost:3001`;
                    const socket = io(wsUrl, { transports: ['websocket', 'polling'] });
                    
                    socket.emit('conversation:message', {
                      conversationId,
                      message: newMessage
                    });
                    
                    // Disconnect after sending
                    setTimeout(() => socket.disconnect(), 100);
                  } catch (error) {
                    console.warn('Failed to broadcast message via WebSocket:', error);
                  }
                }
                // In production, Firebase handles real-time sync automatically
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
          
          // Save to Supabase with sync queue fallback - wait for completion
          (async () => {
            const result = await saveNotificationWithSync(newNotification);
            if (result.synced) {
              console.log('✅ Notification synced to Supabase:', notificationId);
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
          const updated = Array.isArray(prev) ? prev.map(conv => 
            conv && conv.id === conversationId ? {
              ...conv,
              messages: Array.isArray(conv.messages) ? [...conv.messages, newMessage] : [newMessage],
              lastMessageAt: newMessage.timestamp,
              isReadBySeller: currentUser.role === 'seller' ? true : conv.isReadBySeller,
              isReadByCustomer: currentUser.role === 'customer' ? true : conv.isReadByCustomer
            } : conv
          ) : [];
          
          // Save to localStorage immediately
          try {
            saveConversations(updated);
          } catch (error) {
            console.error('Failed to save conversations to localStorage:', error);
          }
          
          // Save to Supabase with sync queue fallback
          const updatedConversation = updated.find(conv => conv.id === conversationId);
          if (updatedConversation) {
            // Save entire conversation to Supabase (with queue fallback)
            (async () => {
              const result = await saveConversationWithSync(updatedConversation);
              if (result.synced) {
                console.log('✅ Conversation synced to Supabase:', conversationId);
              } else if (result.queued) {
                console.log('⏳ Conversation queued for sync (will retry):', conversationId);
              }
            })();
            
            // Also add message via API with sync queue
            (async () => {
              const result = await addMessageWithSync(conversationId, newMessage);
              if (result.synced) {
                console.log('✅ Message synced to Supabase:', messageId);
                
                // Broadcast message via WebSocket for real-time end-to-end sync (development only)
                // In production, Firebase handles real-time sync, so Socket.io is not needed
                if (process.env.NODE_ENV === 'development') {
                  try {
                    // @ts-ignore - socket.io-client types may not be available
                    const socketIoClient: any = await import('socket.io-client');
                    const io = socketIoClient.default || socketIoClient.io;
                    // CRITICAL FIX: Dynamically detect protocol (ws: or wss:) based on page protocol
                    // This prevents mixed content errors when app is served over HTTPS
                    const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const wsUrl = `${wsProtocol}//localhost:3001`;
                    const socket = io(wsUrl, { transports: ['websocket', 'polling'] });
                    
                    socket.emit('conversation:message', {
                      conversationId,
                      message: newMessage
                    });
                    
                    // Disconnect after sending
                    setTimeout(() => socket.disconnect(), 100);
                  } catch (error) {
                    console.warn('Failed to broadcast message via WebSocket:', error);
                  }
                }
                // In production, Firebase handles real-time sync automatically
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
          
          // Save to Supabase with sync queue fallback - wait for completion
          (async () => {
            const result = await saveNotificationWithSync(newNotification);
            if (result.synced) {
              console.log('✅ Notification synced to Supabase:', notificationId);
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
      setConversations(prev => Array.isArray(prev) ? prev.map(conv => 
        conv && conv.id === conversationId ? {
          ...conv,
          messages: Array.isArray(conv.messages) ? conv.messages.map(msg => ({ ...msg, isRead: true })) : []
        } : conv
      ) : []);
    },
    toggleTyping: (conversationId: string, isTyping: boolean) => {
      setTypingStatus(isTyping ? { conversationId, userRole: (currentUser?.role === 'seller' ? 'seller' : 'customer') as 'seller' | 'customer' } : null);
    },
    flagContent: (type: 'vehicle' | 'conversation', id: number | string, reason?: string) => {
      if (type === 'vehicle') {
        setVehicles(prev => Array.isArray(prev) ? prev.map(vehicle => 
          vehicle && vehicle.id === id ? { ...vehicle, isFlagged: true, flagReason: reason } : vehicle
        ) : []);
      } else {
        setConversations(prev => Array.isArray(prev) ? prev.map(conv => 
          conv && conv.id === id ? { ...conv, isFlagged: true, flagReason: reason } : conv
        ) : []);
      }
      addToast(`Content flagged for review${reason ? ': ' + reason : ''}`, 'warning');
    },
    updateUser: async (email: string, updates: Partial<User>) => {
      try {
        // CRITICAL: Never allow role to be updated via this function (security)
        const safeUpdates = { ...updates };
        delete safeUpdates.role; // Prevent role changes through profile updates
        
        // Debug logging for partnerBanks updates
        if (safeUpdates.partnerBanks !== undefined) {
          console.log('💳 Updating partnerBanks:', { email, partnerBanks: safeUpdates.partnerBanks, count: safeUpdates.partnerBanks?.length || 0 });
        }
        
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state/localStorage only on success
        // This ensures password changes are persisted to Supabase immediately, not just locally
        try {
          console.log('📡 Sending user update request to API (real-time Supabase update)...', { email, hasPassword: !!updates.password });
          
          // PROACTIVE TOKEN REFRESH: For critical operations like password updates, 
          // proactively refresh token before making the request to prevent session expiration errors
          if (updates.password) {
            try {
              const { refreshAccessToken } = await import('../services/userService');
              console.log('🔄 Proactively refreshing token before password update...');
              const refreshResult = await refreshAccessToken();
              if (refreshResult.success && refreshResult.accessToken) {
                console.log('✅ Token refreshed proactively before password update');
              } else {
                console.warn('⚠️ Proactive token refresh failed, but continuing with request (will retry on 401)');
              }
            } catch (refreshError) {
              console.warn('⚠️ Error during proactive token refresh:', refreshError);
              // Continue with request - authenticatedFetch will handle 401 and retry
            }
          }
          
          // Use authenticated fetch with automatic token refresh
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const response = await authenticatedFetch('/api/users', {
            method: 'PUT',
            body: JSON.stringify({
              email: email,
              ...safeUpdates
            })
          });
          
          console.log('📥 API response received:', { status: response.status, ok: response.ok });
          
          // Use the response handler for consistent error handling
          const { handleApiResponse } = await import('../utils/authenticatedFetch');
          const apiResult = await handleApiResponse(response);
          
          if (!apiResult.success) {
            console.error('❌ API error response:', { status: response.status, error: apiResult.error, reason: apiResult.reason });
            
            // Handle 401 Unauthorized - token refresh should have been attempted by authenticatedFetch
            // If we still get 401, it means token refresh failed - user needs to re-login
            if (response.status === 401) {
              console.error('❌ 401 Unauthorized - Token refresh failed. Supabase update NOT saved.');
              const errorReason = apiResult.reason || apiResult.error || 'Authentication expired';
              // Avoid duplicate "log in again" messages
              const cleanReason = errorReason.includes('log in again') 
                ? errorReason 
                : `${errorReason}. Please log in again and try again.`;
              if (updates.password) {
                addToast(`Password update failed: ${cleanReason}`, 'error');
              } else {
                addToast(`Profile update failed: ${cleanReason}`, 'error');
              }
              // Don't update localStorage - Supabase update failed, so we shouldn't save locally
              // Throw a specific error that we can check in catch block to avoid duplicate messages
              throw new Error('AUTH_401_ALREADY_HANDLED');
            }
            
            // Handle 500 Internal Server Error - server issue
            if (response.status === 500) {
              console.error('❌ 500 Server Error - Supabase update failed.');
              if (updates.password) {
                addToast('Password update failed: Server error. Please try again.', 'error');
              } else {
                addToast('Profile update failed: Server error. Please try again.', 'error');
              }
              // Don't update localStorage - MongoDB update failed
              throw new Error('Server error. Please try again.');
            }
            
            // For other errors, throw to prevent local update
            throw new Error(apiResult.reason || apiResult.error || `API call failed: ${response.status}`);
          }
          
          const result = apiResult.data || {};
          console.log('✅ User updated in Supabase successfully:', { success: result?.success, hasUser: !!result?.user });
          
          // Supabase update succeeded - NOW update local state and localStorage
          if (result?.user) {
            // CRITICAL: Preserve role if not in API response (shouldn't happen, but safety check)
            // Also ensure partnerBanks and other fields from safeUpdates are included
            const updatedUserData = {
              ...result.user,
              role: result.user.role || currentUser?.role || 'customer', // Preserve existing role
              // Explicitly include partnerBanks from updates if present (fallback if API response doesn't include it)
              ...(safeUpdates.partnerBanks !== undefined && { partnerBanks: safeUpdates.partnerBanks })
            };
            
            // Update React state - ensure partnerBanks is properly merged
            setUsers(prev => Array.isArray(prev) ? prev.map(user => {
              if (user && user.email === email) {
                const merged = { ...user, ...updatedUserData };
                // Explicitly ensure partnerBanks is included if it was in the update
                if (safeUpdates.partnerBanks !== undefined) {
                  merged.partnerBanks = safeUpdates.partnerBanks;
                  console.log('✅ Updated users array with partnerBanks:', { email, partnerBanks: merged.partnerBanks });
                }
                return merged;
              }
              return user;
            }) : []);
            
            if (currentUser && currentUser.email === email) {
              // CRITICAL: Always preserve role when updating currentUser
              const mergedUser = { 
                ...currentUser, 
                ...updatedUserData,
                role: updatedUserData.role || currentUser.role || 'customer', // Ensure role is never lost
                // Explicitly ensure partnerBanks is included if it was in the update
                ...(safeUpdates.partnerBanks !== undefined && { partnerBanks: safeUpdates.partnerBanks })
              };
              
              setCurrentUser(mergedUser);
              // Update localStorage after Supabase success
              try {
                localStorage.setItem('reRideCurrentUser', JSON.stringify(mergedUser));
                sessionStorage.setItem('currentUser', JSON.stringify(mergedUser));
              } catch (error) {
                console.warn('Failed to update localStorage with API response:', error);
              }
            }
          } else {
            // Fallback: If API doesn't return user, still update local state with safeUpdates
            // This ensures partnerBanks and other fields are saved even if API response is incomplete
            setUsers(prev => prev.map(user => 
              user.email === email ? { ...user, ...safeUpdates } : user
            ));
            
            if (currentUser && currentUser.email === email) {
              const mergedUser = { 
                ...currentUser, 
                ...safeUpdates,
                role: currentUser.role || 'customer' // Ensure role is never lost
              };
              setCurrentUser(mergedUser);
              try {
                localStorage.setItem('reRideCurrentUser', JSON.stringify(mergedUser));
                sessionStorage.setItem('currentUser', JSON.stringify(mergedUser));
              } catch (error) {
                console.warn('Failed to update localStorage with fallback update:', error);
              }
            }
          }
          
          // Also update the localStorage users array after MongoDB success
          try {
            const { updateUser: updateUserService } = await import('../services/userService');
            await updateUserService({ email, ...safeUpdates });
            console.log('✅ User updated in localStorage users array (after Supabase success)');
          } catch (localError) {
            console.warn('⚠️ Failed to update user in localStorage users array:', localError);
            // Try manual update as fallback
            try {
              const usersJson = localStorage.getItem('reRideUsers');
              if (usersJson) {
                const users = JSON.parse(usersJson);
                const updatedUsers = users.map((user: User) => 
                  user.email === email ? { ...user, ...safeUpdates } : user
                );
                localStorage.setItem('reRideUsers', JSON.stringify(updatedUsers));
                console.log('✅ User updated in localStorage (manual fallback)');
              }
            } catch (fallbackError) {
              console.error('❌ Failed to update user in localStorage (fallback):', fallbackError);
            }
          }
          
          // Show success message
          if (updates.password) {
            addToast('Password updated successfully!', 'success');
          } else {
            addToast('Profile updated successfully!', 'success');
          }
          
        } catch (apiError) {
          console.error('❌ API error during user update - Supabase update FAILED:', apiError);
          
          // CRITICAL: Don't save locally when Supabase fails - user wants real-time updates
          // Only show error messages, don't update any local state
          
          if (apiError instanceof Error) {
            const errorMsg = apiError.message;
            
            // Skip if error was already handled (e.g., 401 with toast already shown)
            if (errorMsg === 'AUTH_401_ALREADY_HANDLED') {
              return; // Error already shown, don't show duplicate
            }
            
            // Check for database connection errors (503)
            if (errorMsg.includes('503') || errorMsg.includes('Database connection failed') || errorMsg.includes('SUPABASE')) {
              console.error('❌ Supabase connection failed:', errorMsg);
              if (updates.password) {
                addToast('Password update failed: Supabase connection error. Please try again.', 'error');
              } else {
                addToast('Profile update failed: Supabase connection error. Please try again.', 'error');
              }
            } else if (errorMsg.includes('fetch') || 
                errorMsg.includes('network') ||
                errorMsg.includes('Failed to fetch') ||
                errorMsg.includes('CORS')) {
              // Network errors
              console.error('❌ Network error updating user:', errorMsg);
              if (updates.password) {
                addToast('Password update failed: Network error. Please check your connection and try again.', 'error');
              } else {
                addToast('Profile update failed: Network error. Please check your connection and try again.', 'error');
              }
            } else if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
              // 404 errors
              console.error('❌ API endpoint not found:', errorMsg);
              if (updates.password) {
                addToast('Password update failed: API endpoint not found. Please check deployment.', 'error');
              } else {
                addToast('Profile update failed: API endpoint not found. Please check deployment.', 'error');
              }
            } else if (errorMsg.includes('400')) {
              console.error('❌ Invalid profile data:', apiError);
              addToast(`Update failed: Invalid data - ${errorMsg.replace('400: ', '')}`, 'error');
            } else if (errorMsg.includes('Authentication failed') || errorMsg.includes('Please log in again') || errorMsg.includes('session has expired')) {
              // Authentication errors - already handled above, but catch here for safety
              // Avoid duplicate messages - check if we already showed an error
              console.error('❌ Authentication error:', errorMsg);
              // Only show if not already handled by the 401 handler above
              if (!errorMsg.includes('401') && !errorMsg.includes('Unauthorized')) {
                const cleanMsg = errorMsg.includes('log in again') 
                  ? errorMsg 
                  : `${errorMsg}. Please log in again and try again.`;
                if (updates.password) {
                  addToast(`Password update failed: ${cleanMsg}`, 'error');
                } else {
                  addToast(`Profile update failed: ${cleanMsg}`, 'error');
                }
              }
            } else if (errorMsg.includes('500') || errorMsg.includes('Database error') || errorMsg.includes('Internal server') || errorMsg.includes('Server error')) {
              console.error('❌ Server/Database error updating user:', apiError);
              if (updates.password) {
                addToast('Password update failed: Server error. Please try again.', 'error');
              } else {
                addToast('Profile update failed: Server error. Please try again.', 'error');
              }
            } else {
              console.warn('⚠️ Failed to update profile in Supabase:', errorMsg);
              // Show the actual error message
              const displayError = errorMsg.replace(/^\d+:\s*/, ''); // Remove status code prefix
              if (updates.password) {
                addToast(`Password update failed: ${displayError}`, 'error');
              } else {
                addToast(`Profile update failed: ${displayError}`, 'error');
              }
            }
          } else {
            console.warn('⚠️ Failed to update profile in MongoDB - unknown error type');
            if (updates.password) {
              addToast('Password update failed. Please try again or check server logs.', 'error');
            } else {
              addToast('Profile update failed. Please try again.', 'error');
            }
          }
          
          // Re-throw to prevent any local updates
          throw apiError;
        }
        
      } catch (error) {
        // Error already handled with specific toast messages in inner catch block
        // Only log here to avoid duplicate error toasts
        console.error('Failed to update user:', error);
        // Don't show generic toast - inner catch already showed specific error message
      }
    },
    deleteUser: (email: string) => {
      const user = Array.isArray(users) ? users.find(u => u.email === email) : undefined;
      
      // Log audit entry for user deletion
      const actor = currentUser?.name || currentUser?.email || 'System';
      const userInfo = user ? `${user.name} (${user.email})` : email;
      const entry = logAction(actor, 'Delete User', email, `Deleted user: ${userInfo}`);
      setAuditLog(prev => [entry, ...prev]);
      
      setUsers(prev => Array.isArray(prev) ? prev.filter(user => user && user.email !== email) : []);
      addToast('User deleted successfully', 'success');
    },
    updateVehicle: async (id: number, updates: Partial<Vehicle>, options?: VehicleUpdateOptions) => {
      await updateVehicleHandler(id, updates, options);
    },
    deleteVehicle: async (id: number) => {
      try {
        const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v.id === id) : undefined;
        
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
          setVehicles(prev => Array.isArray(prev) ? prev.filter(vehicle => vehicle && vehicle.id !== id) : []);
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
      if (process.env.NODE_ENV === 'development') {
        console.log('🚗 selectVehicle called for:', vehicle.id, vehicle.make, vehicle.model);
      }
      
      // Validate vehicle object
      if (!vehicle || !vehicle.id) {
        console.error('❌ selectVehicle called with invalid vehicle:', vehicle);
        return;
      }
      
      // CRITICAL: Store vehicle in sessionStorage FIRST (synchronous, immediate)
      // This ensures the vehicle is available even if state update is delayed
      try {
        const vehicleJson = JSON.stringify(vehicle);
        sessionStorage.setItem('selectedVehicle', vehicleJson);
        
        // Verify it was stored correctly
        const verifyStored = sessionStorage.getItem('selectedVehicle');
        if (!verifyStored || verifyStored !== vehicleJson) {
          console.error('❌ Vehicle storage verification failed');
          return;
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🚗 Vehicle stored and verified in sessionStorage:', vehicle.id, vehicle.make, vehicle.model);
        }
      } catch (error) {
        console.error('❌ Failed to store vehicle in sessionStorage:', error);
        // Don't continue if we can't store - navigation will fail
        return;
      }
      
      // Set the selected vehicle state (async, but sessionStorage is already set and verified)
      // The navigate function will check sessionStorage first, so state update timing doesn't matter
      setSelectedVehicle(vehicle);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🚗 Navigating to DETAIL view with vehicle:', vehicle.id, vehicle.make, vehicle.model);
      }
      
      // Navigate to DETAIL view immediately
      // The navigate function will check sessionStorage first (which we just set and verified),
      // so the vehicle will be available even if state hasn't updated yet
      navigate(View.DETAIL);
    },
    toggleWishlist: (vehicleId: number) => {
      setWishlist(prev => 
        Array.isArray(prev) && prev.includes(vehicleId) 
          ? prev.filter(id => id !== vehicleId)
          : Array.isArray(prev) ? [...prev, vehicleId] : [vehicleId]
      );
    },
    toggleCompare: (vehicleId: number) => {
      setComparisonList(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.includes(vehicleId) 
          ? safePrev.filter(id => id !== vehicleId)
          : safePrev.length < 3 ? [...safePrev, vehicleId] : safePrev;
      });
    },
    onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => {
      console.log('🔧 onOfferResponse called:', { conversationId, messageId, response, counterPrice });
      
      setConversations(prev => {
        const updated = Array.isArray(prev) ? prev.map(conv => {
          if (conv && conv.id === conversationId) {
            const updatedMessages = Array.isArray(conv.messages) ? conv.messages.map(msg => {
              if (msg && msg.id === messageId) {
                const updatedPayload = {
                  ...(msg.payload || {}),
                  status: response,
                  ...(counterPrice && { counterPrice })
                };
                
                return {
                  ...msg,
                  payload: updatedPayload
                };
              }
              return msg;
            }) : [];
            
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
            
            const updatedConv = {
              ...conv,
              messages: [...updatedMessages, responseMessage],
              lastMessageAt: new Date().toISOString()
            };
            
            // Update activeChat if it's the same conversation
            // Use the computed updatedConv instead of accessing stale conversations from closure
            setActiveChat(activeChatPrev => {
              if (activeChatPrev && activeChatPrev.id === conversationId) {
                return updatedConv;
              }
              return activeChatPrev;
            });
            
            return updatedConv;
          }
          return conv;
        }) : [];
        
        console.log('🔧 Updated conversations after offer response:', updated);
        return updated;
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
    setNotifications, addToast, removeToast, navigate, goBack, handleLogin, handleLogout,
    updateVehicleHandler
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Add displayName for better debugging and Fast Refresh compatibility
AppProvider.displayName = 'AppProvider';

import type React from 'react';
import type {
  AuditLogEntry,
  ChatMessage,
  Conversation,
  FAQItem,
  Notification,
  PlatformSettings,
  SubscriptionPlan,
  SupportTicket,
  Toast as ToastType,
  User,
  Vehicle,
  VehicleCategory,
  VehicleData,
} from '../types';
import { View } from '../types';

export interface UserUpdateOptions {
  successMessage?: string;
  skipToast?: boolean;
}

export interface VehicleUpdateOptions {
  successMessage?: string;
  skipToast?: boolean;
  databaseId?: string;
}

export interface AppContextType {
  currentView: View;
  previousView: View;
  selectedVehicle: Vehicle | null;
  vehicles: Vehicle[];
  isLoading: boolean;
  vehiclesCatalogReady: boolean;
  sellerInventory: Vehicle[];
  sellerInventoryReady: boolean;
  currentUser: User | null;
  comparisonList: number[];
  comparisonCategory: string | null;
  ratings: { [key: string]: number[] };
  sellerRatings: { [key: string]: number[] };
  wishlist: number[];
  conversations: Conversation[];
  toasts: ToastType[];
  forgotPasswordRole: 'customer' | 'seller' | null;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  chatPeerOnlineByConversationId: Record<string, boolean>;
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

  setCurrentView: (view: View) => void;
  setPreviousView: (view: View) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  setVehicles: (vehicles: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
  setSellerInventory: (vehicles: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
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
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setRatings: (ratings: { [key: string]: number[] }) => void;
  setSellerRatings: (
    ratings: { [key: string]: number[] } | ((prev: { [key: string]: number[] }) => { [key: string]: number[] }),
  ) => void;

  addToast: (message: string, type: ToastType['type']) => void;
  removeToast: (id: number) => void;
  askConfirm: (message: string, opts?: { title?: string; variant?: 'danger' }) => Promise<boolean>;
  runIfConfirmed: (
    message: string,
    action: () => void | Promise<void>,
    opts?: { title?: string; variant?: 'danger' },
  ) => Promise<void>;
  handleLogout: () => void;
  handleLogin: (user: User) => void;
  handleRegister: (user: User) => void;
  navigate: (
    view: View,
    params?: { city?: string; sellerEmail?: string; detailVehicle?: Vehicle; unblockPopstateSync?: boolean },
  ) => void;
  goBack: (fallbackView?: View) => void;
  refreshVehicles: (options?: { userInitiated?: boolean }) => Promise<void>;
  refreshSellerInventory: (options?: { userInitiated?: boolean }) => Promise<void>;

  onCreateUser: (userData: Omit<User, 'status'>) => Promise<{ success: boolean; reason: string }>;
  onAdminUpdateUser: (email: string, details: Partial<User>) => void;
  onUpdateUserPlan: (email: string, plan: SubscriptionPlan) => Promise<void>;
  onToggleUserStatus: (email: string) => Promise<void>;
  onToggleVehicleStatus: (vehicleId: number) => Promise<void>;
  onToggleVehicleFeature: (vehicleId: number) => Promise<void>;
  onResolveFlag: (type: 'vehicle' | 'conversation', id: number | string) => void;
  onUpdateSettings: (settings: PlatformSettings) => Promise<void> | void;
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

  addRating: (vehicleId: number, rating: number) => void;
  addSellerRating: (sellerEmail: string, rating: number) => void;
  sendMessage: (conversationId: string, message: string) => void;
  sendMessageWithType: (
    conversationId: string,
    messageText: string,
    type?: ChatMessage['type'],
    payload?: ChatMessage['payload'],
  ) => Promise<boolean>;
  markAsRead: (
    conversationId: string,
    options?: { readerRole?: 'customer' | 'seller'; forceReadState?: boolean },
  ) => void;
  setConversationReadState: (conversationId: string, readerRole: 'customer' | 'seller', isRead: boolean) => void;
  clearConversationMessages: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string, archived?: boolean) => Promise<void>;
  toggleTyping: (conversationId: string, isTyping: boolean) => void;
  flagContent: (type: 'vehicle' | 'conversation', id: number | string, reason?: string) => void;
  updateUser: (email: string, updates: Partial<User>, options?: UserUpdateOptions) => Promise<void>;
  deleteUser: (email: string) => Promise<void>;
  updateVehicle: (id: number, updates: Partial<Vehicle>, options?: VehicleUpdateOptions) => Promise<void>;
  syncVehicleFromServer: (vehicle: Vehicle) => void;
  deleteVehicle: (id: number) => void;
  selectVehicle: (vehicle: Vehicle) => void;
  toggleWishlist: (vehicleId: number) => void;
  toggleCompare: (vehicleId: number) => void;
  onOfferResponse: (
    conversationId: string,
    messageId: number,
    response: 'accepted' | 'rejected' | 'countered',
    counterPrice?: number,
  ) => void;
}

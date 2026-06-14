import fs from 'fs';

const switchBodyPath = 'components/app/_switch-body.txt';
if (!fs.existsSync(switchBodyPath)) {
  throw new Error(`Missing ${switchBodyPath} — extract renderView switch body before regenerating.`);
}

const switchLines = fs
  .readFileSync(switchBodyPath, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.replace(/^    /, ''));

if (switchLines[0]?.trim() === 'switch (currentView) {') {
  switchLines.shift();
}
while (switchLines.length && switchLines[switchLines.length - 1].trim() === '') {
  switchLines.pop();
}
if (switchLines.length && switchLines[switchLines.length - 1].trim() === '}') {
  switchLines.pop();
}

// Lazy imports: keep a stable snapshot in-repo (from original App.tsx view imports).
const lazyBlock = fs.readFileSync('components/app/_lazy-imports.txt', 'utf8');

const fixDynamicImports = (line) =>
  line
    .replace(/import\('\.\/services\//g, "import('../../services/")
    .replace(/import\('\.\/utils\//g, "import('../../utils/")
    .replace(/import\('\.\/constants\//g, "import('../../constants/");

const fixServiceProviders = (line) =>
  line.includes('serviceProviders={serviceProviderOptions}')
    ? line.replace(
        'serviceProviders={serviceProviderOptions}',
        "serviceProviders={serviceProviderOptions as React.ComponentProps<typeof ServiceCart>['serviceProviders']}",
      )
    : line;

const header = `import * as React from 'react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum, Vehicle, User, Notification, Conversation, SubscriptionPlan, type SearchFilters } from '../../types';
import { useApp } from '../AppProvider';
import useIsMobileApp from '../../hooks/useIsMobileApp';
import { enrichVehiclesWithSellerInfo } from '../../utils/vehicleEnrichment';
import { matchesCity } from '../../utils/cityMapping';
import { buildVehicleMutationBody } from '../../utils/vehicleIdentity';
import { authenticatedFetch } from '../../utils/authenticatedFetch';
import { planService } from '../../services/planService';
import { logInfo, logWarn, logError } from '../../utils/logger';
import { parseDeepLink } from '../../utils/mobileFeatures';
import { randomIntBelow } from '../../utils/secureRandom.js';
import { isCapacitorNativeApp } from '../../utils/isCapacitorNative';
import { currentUserForLocalSessionJson } from '../../utils/userLocalStorageSnapshot';
import {
  conversationBelongsToCustomer,
  conversationBelongsToSeller,
  normalizeInboxRole,
} from '../../utils/conversationParticipants';
import {
  VehicleListErrorBoundary,
  DashboardErrorBoundary,
  AdminPanelErrorBoundary,
  AuthenticationErrorBoundary,
} from '../ErrorBoundaries';
import { DashboardSkeleton, MobileDashboardSkeleton, LoadingSpinner } from './AppViewSkeletons';
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

${lazyBlock}

export const AppViewRenderer: React.FC<AppViewRendererLocals> = (locals) => {
  const { isMobileApp } = useIsMobileApp();
  const { t } = useTranslation();
  const {
    currentView,
    navigate,
    goBack,
    previousView,
    vehicles,
    users,
    currentUser,
    comparisonList,
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
    setUsers,
    setCurrentUser,
    setSupportTickets,
    markAsRead,
    toggleTyping,
    flagContent,
    updateUser,
    deleteUser,
    updateVehicle,
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
    handleMarkNotificationsAsRead,
    handleMarkAllNotificationsAsRead,
    markAllVisibleAsRead,
    isLocating,
    locationError,
  } = locals;

switch (currentView) {
`;

const footer = `
}
};

export default AppViewRenderer;
`;

const body = switchLines.map((l) => fixServiceProviders(fixDynamicImports(l))).join('\n');

fs.mkdirSync('components/app', { recursive: true });
fs.writeFileSync(
  'components/app/AppViewRenderer.tsx',
  header + body + footer,
  'utf8',
);
console.log('AppViewRenderer.tsx written:', fs.statSync('components/app/AppViewRenderer.tsx').size);

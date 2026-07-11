/**
 * Unified seller dashboard entry — responsive route selects layout;
 * shared business logic lives in useSellerDashboardController.
 */
export { SellerDashboardRoute as SellerDashboard } from './SellerDashboardRoute';
export { default as SellerDashboardRoute } from './SellerDashboardRoute';
export type { SellerDashboardRouteProps } from './SellerDashboardRoute';
export {
  useSellerDashboardController,
  useSellerPlanDetails,
  useSellerCommandCenter,
  type SellerDashboardSection,
} from '../../hooks/useSellerDashboardController';

export const SELLER_DASHBOARD_SECTIONS = [
  { id: 'overview', labelKey: 'sellerDashboard.overview' },
  { id: 'hotLeads', labelKey: 'sellerDashboard.hotLeads', mobileOnly: true },
  { id: 'listings', labelKey: 'sellerDashboard.listings' },
  { id: 'messages', labelKey: 'sellerDashboard.messages' },
  { id: 'analytics', labelKey: 'sellerDashboard.analytics' },
  { id: 'salesHistory', labelKey: 'sellerDashboard.salesHistory' },
  { id: 'reports', labelKey: 'sellerDashboard.reports' },
  { id: 'settings', labelKey: 'sellerDashboard.settings' },
  { id: 'profile', labelKey: 'sellerDashboard.profile', mobileOnly: true },
] as const;

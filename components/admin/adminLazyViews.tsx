import React from 'react';

export const AdminViewFallback: React.FC = () => (
  <div className="flex min-h-[240px] items-center justify-center py-12">
    <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      Loading workspace…
    </div>
  </div>
);

export function withAdminViewSuspense(node: React.ReactNode) {
  return <React.Suspense fallback={<AdminViewFallback />}>{node}</React.Suspense>;
}

export function withAdminModalSuspense(node: React.ReactNode) {
  return <React.Suspense fallback={null}>{node}</React.Suspense>;
}

export const LazyPaymentManagement = React.lazy(() => import('../PaymentManagement'));
export const LazyVehicleDataManagement = React.lazy(() => import('../VehicleDataManagement'));
export const LazyVehicleDataBulkUploadModal = React.lazy(() =>
  import('../VehicleDataBulkUploadModal').then((m) => ({ default: m.VehicleDataBulkUploadModal })),
);
export const LazySellerFormPreview = React.lazy(() => import('../SellerFormPreview'));
export const LazyImportVehiclesModal = React.lazy(() => import('../ImportVehiclesModal'));
export const LazyImportUsersModal = React.lazy(() => import('../ImportUsersModal'));
export const LazyAdminServiceOps = React.lazy(() => import('../AdminServiceOps'));
export const LazyServiceManagement = React.lazy(() => import('../ServiceManagement'));
export const LazySellCarAdmin = React.lazy(() => import('../SellCarAdmin'));
export const LazyAdminDealCenter = React.lazy(() => import('../command-center/AdminDealCenter'));
export const LazyAdminRcQueue = React.lazy(() => import('../command-center/AdminRcQueue'));
export const LazyAdminAssistanceQueue = React.lazy(() => import('../command-center/AdminAssistanceQueue'));
export const LazyAdminFraudDashboard = React.lazy(() => import('../command-center/AdminFraudDashboard'));
export const LazyAdminDealComplaints = React.lazy(() => import('../command-center/AdminDealComplaints'));
export const LazyAdminComplaintCases = React.lazy(() => import('../command-center/AdminComplaintCases'));
export const LazyAdminDealRevenue = React.lazy(() => import('../command-center/AdminDealRevenue'));
export const LazyEditUserModal = React.lazy(() => import('../EditUserModal'));
export const LazyEditVehicleModal = React.lazy(() => import('../EditVehicleModal'));

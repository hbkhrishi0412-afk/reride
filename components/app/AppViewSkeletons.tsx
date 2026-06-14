import * as React from 'react';

const VehicleCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
    <div className="relative aspect-[16/10] bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-gray-200 rounded-lg w-3/4 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded-lg w-1/2 animate-pulse" />
        </div>
        <div className="h-6 w-20 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div className="flex gap-2 pt-2">
        <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-6 w-14 bg-gray-100 rounded-full animate-pulse" />
      </div>
    </div>
  </div>
);

const StatsCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-gray-200 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-20 animate-pulse" />
        <div className="h-6 bg-gray-200 rounded w-12 animate-pulse" />
      </div>
    </div>
  </div>
);

/** Content-area skeleton for listing pages — no fake header (real Header is already rendered). */
export const ListingsPageSkeleton: React.FC = () => (
  <div className="min-h-[calc(100vh-140px)] bg-gray-50" aria-busy="true" aria-label="Loading listings">
    <div className="container mx-auto py-6 lg:py-8 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-8">
        <aside className="hidden lg:block">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4 sticky top-24">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${85 - i * 8}%` }} />
            ))}
          </div>
        </aside>
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 w-48 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <VehicleCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-white/30 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-white/20 rounded-lg animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-white/30 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-40 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-9 w-28 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <VehicleCardSkeleton key={i} />
        ))}
      </div>
    </div>
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white px-5 py-3 rounded-full shadow-lg border border-gray-200 flex items-center gap-3 z-50">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      <span className="text-sm font-medium text-gray-600">Loading your dashboard...</span>
    </div>
  </div>
);

export const MobileDashboardSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50 pb-20">
    <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-6 rounded-b-3xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 rounded-full bg-white/30 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 bg-white/30 rounded-lg animate-pulse" />
          <div className="h-4 w-24 bg-white/20 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white/20 rounded-xl p-3 text-center">
            <div className="h-6 w-8 mx-auto bg-white/30 rounded animate-pulse mb-1" />
            <div className="h-3 w-12 mx-auto bg-white/20 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
    <div className="px-4 py-4 space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 h-12 bg-gray-200 rounded-xl animate-pulse" />
        <div className="flex-1 h-12 bg-gray-200 rounded-xl animate-pulse" />
      </div>
      <div className="space-y-4 mt-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="aspect-[16/9] bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-gray-200 rounded-lg w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-lg w-1/2 animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-gray-100 rounded-lg animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white px-4 py-2.5 rounded-full shadow-lg border border-gray-200 flex items-center gap-2 z-50">
      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      <span className="text-sm font-medium text-gray-600">Loading...</span>
    </div>
  </div>
);

export const LoadingSpinner: React.FC = () => <ListingsPageSkeleton />;

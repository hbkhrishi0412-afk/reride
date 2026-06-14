import React from 'react';

export const VehicleCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-pulse">
    <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700" />
    <div className="p-4 space-y-3">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    </div>
  </div>
);

export default VehicleCardSkeleton;

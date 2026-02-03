import React, { memo } from 'react';
import useIsMobileApp from '../hooks/useIsMobileApp';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete?: () => void;
  onBulkMarkAsSold?: () => void;
  onBulkFeature?: () => void;
  onBulkExport?: () => void;
  isProcessing?: boolean;
}

/**
 * Bulk Actions Bar - Website Only Feature
 * Provides bulk operations for selected vehicles/listings
 */
const BulkActionsBar: React.FC<BulkActionsBarProps> = memo(({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkMarkAsSold,
  onBulkFeature,
  onBulkExport,
  isProcessing = false
}) => {
  const { isMobileApp } = useIsMobileApp();

  // Don't render on mobile app
  if (isMobileApp) return null;

  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            {selectedCount} of {totalCount} selected
          </span>
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            disabled={isProcessing}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onBulkExport && (
            <button
              onClick={onBulkExport}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export ({selectedCount})
            </button>
          )}
          
          {onBulkFeature && (
            <button
              onClick={onBulkFeature}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Feature ({selectedCount})
            </button>
          )}
          
          {onBulkMarkAsSold && (
            <button
              onClick={onBulkMarkAsSold}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark as Sold ({selectedCount})
            </button>
          )}
          
          {onBulkDelete && (
            <button
              onClick={onBulkDelete}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete ({selectedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

BulkActionsBar.displayName = 'BulkActionsBar';

export default BulkActionsBar;











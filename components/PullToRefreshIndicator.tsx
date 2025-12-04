import React from 'react';

interface PullToRefreshIndicatorProps {
  progress: number;
  isRefreshing: boolean;
}

/**
 * Pull-to-Refresh Indicator Component
 * Shows visual feedback when user pulls down to refresh
 */
export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  progress,
  isRefreshing
}) => {
  const rotation = progress * 180;
  const opacity = Math.min(progress * 2, 1);

  if (progress === 0 && !isRefreshing) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
      style={{
        transform: `translateY(${Math.min(progress * 60, 60)}px)`,
        opacity
      }}
    >
      <div className="bg-white rounded-full p-3 shadow-lg">
        {isRefreshing ? (
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            className="w-6 h-6 text-orange-500"
            style={{ transform: `rotate(${rotation}deg)` }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        )}
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;












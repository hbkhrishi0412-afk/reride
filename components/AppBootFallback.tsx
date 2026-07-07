import React from 'react';

/** Shown while the main App shell chunk loads (AppProvider + routes). */
const AppBootFallback: React.FC = () => (
  <div
    className="flex min-h-screen items-center justify-center bg-white"
    role="status"
    aria-live="polite"
    aria-label="Loading ReRide"
  >
    <div className="flex flex-col items-center gap-4">
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-orange-500 border-t-transparent"
        aria-hidden
      />
      <p className="text-sm font-medium text-slate-600">Loading ReRide…</p>
    </div>
  </div>
);

export default AppBootFallback;

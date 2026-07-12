import React, { Suspense, lazy, useEffect, useState } from 'react';

const LocationModal = lazy(() => import('./LocationModal'));

interface MobileLocationModalHostProps {
  userLocation: string;
  onLocationChange: (location: string) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Global mobile location picker — mounted once in the app shell so the modal
 * works from any screen (not only MobileHomePage).
 */
export const MobileLocationModalHost: React.FC<MobileLocationModalHostProps> = ({
  userLocation,
  onLocationChange,
  addToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('reride:open-location-modal', open);
    return () => window.removeEventListener('reride:open-location-modal', open);
  }, []);

  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <LocationModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentLocation={userLocation}
        onLocationChange={onLocationChange}
        addToast={addToast}
      />
    </Suspense>
  );
};

export default MobileLocationModalHost;

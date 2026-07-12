import React, { useEffect, useState } from 'react';
import LocationModal from './LocationModal';

interface MobileLocationModalHostProps {
  userLocation: string;
  onLocationChange: (location: string) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Global mobile location picker — mounted once in the app shell so the modal
 * works from any screen (not only MobileHomePage).
 *
 * Eagerly imports LocationModal (not lazy) so Capacitor Android always has the
 * same picker as web and cannot silently fail if a lazy chunk fails to load.
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
    <LocationModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      currentLocation={userLocation}
      onLocationChange={onLocationChange}
      addToast={addToast}
    />
  );
};

export default MobileLocationModalHost;

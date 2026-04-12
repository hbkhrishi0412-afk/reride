import React, { useEffect } from 'react';
import { isCapacitorNativeApp } from '../utils/isCapacitorNative';
import { registerAndSyncNativePushToken } from '../utils/nativePushRegistration';

interface NativePushRegistrationProps {
  userEmail: string | undefined;
}

/** Registers device for native push after login (Android/iOS). */
const NativePushRegistration: React.FC<NativePushRegistrationProps> = ({ userEmail }) => {
  useEffect(() => {
    if (!isCapacitorNativeApp() || !userEmail) return;
    void registerAndSyncNativePushToken(userEmail);
  }, [userEmail]);

  return null;
};

export default NativePushRegistration;

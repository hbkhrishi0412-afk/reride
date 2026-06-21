import React, { useEffect } from 'react';
import { isCapacitorNativeApp } from '../utils/isCapacitorNative';
import { syncWebPushSubscription } from '../utils/webPushRegistration';

interface WebPushRegistrationProps {
  userEmail: string | undefined;
  /** Only sellers need server push for buyer inquiries; defaults to true when role is seller. */
  enabled?: boolean;
}

/** Registers PWA web push subscription after login (desktop + mobile browser). */
const WebPushRegistration: React.FC<WebPushRegistrationProps> = ({ userEmail, enabled = true }) => {
  useEffect(() => {
    if (!enabled || !userEmail || isCapacitorNativeApp()) return;
    void syncWebPushSubscription(userEmail);
  }, [userEmail, enabled]);

  return null;
};

export default WebPushRegistration;

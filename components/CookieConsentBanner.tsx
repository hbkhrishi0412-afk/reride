/**
 * Cookie consent banner for GDPR/DPDP compliance.
 * Uses react-cookie-consent. Stores preference in cookie.
 * Hidden in Capacitor native shell (not a browser; cookies / gtag differ from web).
 */

import React from 'react';
import { CookieConsent } from 'react-cookie-consent';
import { useTranslation } from 'react-i18next';
import { isCapacitorNativeApp } from '../utils/isCapacitorNative';

export default function CookieConsentBanner() {
  const { t } = useTranslation();

  if (isCapacitorNativeApp()) {
    return null;
  }

  return (
    <CookieConsent
      location="bottom"
      buttonText={t('cookie.accept')}
      declineButtonText={t('cookie.decline')}
      enableDeclineButton
      onAccept={() => {
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('consent', 'update', { analytics_storage: 'granted' });
        }
      }}
      onDecline={() => {
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('consent', 'update', { analytics_storage: 'denied' });
        }
      }}
      style={{
        background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)',
        padding: '16px 24px',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}
      buttonStyle={{
        background: '#FF6B35',
        color: '#fff',
        fontWeight: 600,
        borderRadius: '8px',
        padding: '10px 20px',
      }}
      declineButtonStyle={{
        background: 'transparent',
        color: '#94a3b8',
        border: '1px solid #475569',
        borderRadius: '8px',
        padding: '10px 20px',
      }}
    >
      <span style={{ marginRight: 8 }}>
        {t('cookie.consent')}{' '}
        <a href="/privacy-policy" style={{ color: '#FF6B35', textDecoration: 'underline' }}>
          {t('cookie.learnMore')}
        </a>
      </span>
    </CookieConsent>
  );
}

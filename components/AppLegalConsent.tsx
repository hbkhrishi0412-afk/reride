/**
 * First-launch legal consent for Capacitor (Android/iOS).
 * Mirrors common Indian app onboarding: accept Privacy Policy & Terms before use.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum } from '../types.js';
import { useApp } from './AppProvider';
import { isCapacitorNativeApp } from '../utils/isCapacitorNative';

const STORAGE_KEY = 'reride_legal_consent_accepted_v1';

function hasAcceptedLegalConsent(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

function persistLegalConsent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* storage blocked */
  }
}

export default function AppLegalConsent() {
  const { t } = useTranslation();
  const { navigate, currentView } = useApp();
  const [pendingConsent, setPendingConsent] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!isCapacitorNativeApp()) return;
    if (!hasAcceptedLegalConsent()) {
      setPendingConsent(true);
    }
  }, []);

  const viewingLegalPage =
    currentView === ViewEnum.PRIVACY_POLICY || currentView === ViewEnum.TERMS_OF_SERVICE;
  const showOverlay = pendingConsent && !viewingLegalPage;

  if (!showOverlay) return null;

  const openLegalPage = (view: ViewEnum) => {
    navigate(view);
  };

  const handleAccept = () => {
    if (!accepted) return;
    persistLegalConsent();
    setPendingConsent(false);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-consent-title"
      >
        <h2 id="legal-consent-title" className="text-lg font-bold text-gray-900">
          {t('legalConsent.title', { defaultValue: 'Welcome to ReRide' })}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {t('legalConsent.body', {
            defaultValue:
              'By continuing, you agree to our Privacy Policy and Terms of Service. Please review them before using the app.',
          })}
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          <span>
            {t('auth.termsPrefix')}{' '}
            <button
              type="button"
              onClick={() => openLegalPage(ViewEnum.PRIVACY_POLICY)}
              className="font-medium text-orange-600 hover:underline"
            >
              {t('auth.privacyPolicy')}
            </button>{' '}
            {t('auth.termsAnd')}{' '}
            <button
              type="button"
              onClick={() => openLegalPage(ViewEnum.TERMS_OF_SERVICE)}
              className="font-medium text-orange-600 hover:underline"
            >
              {t('auth.termsOfService')}
            </button>
          </span>
        </label>

        <button
          type="button"
          disabled={!accepted}
          onClick={handleAccept}
          className="mt-5 w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('legalConsent.accept', { defaultValue: 'Accept & Continue' })}
        </button>
      </div>
    </div>
  );
}

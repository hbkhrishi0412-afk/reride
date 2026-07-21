/**
 * First-launch Terms & Privacy acceptance (device-level).
 * Matches common marketplace apps (Swiggy / Flipkart / PhonePe style):
 * blocking bottom sheet, explicit checkbox, links to legal pages, versioned persist.
 */

import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum } from '../types.js';
import { useApp } from './AppProvider';

/** Bump when Privacy Policy or Terms of Service materially change to re-prompt users. */
export const LEGAL_CONSENT_VERSION = 1;

const STORAGE_KEY = 'reride_legal_consent';
/** Legacy key from Capacitor-only v1 gate */
const LEGACY_STORAGE_KEY = 'reride_legal_consent_accepted_v1';

type StoredConsent = {
  version: number;
  acceptedAt: string;
};

function readStoredConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredConsent;
      if (
        parsed &&
        typeof parsed.version === 'number' &&
        typeof parsed.acceptedAt === 'string'
      ) {
        return parsed;
      }
    }
    // Migrate legacy flag → current version once
    if (localStorage.getItem(LEGACY_STORAGE_KEY) === '1') {
      const migrated: StoredConsent = {
        version: LEGAL_CONSENT_VERSION,
        acceptedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch {
    /* storage blocked or corrupt */
  }
  return null;
}

function hasAcceptedCurrentLegalConsent(): boolean {
  const stored = readStoredConsent();
  return stored?.version === LEGAL_CONSENT_VERSION;
}

function persistLegalConsent(): void {
  try {
    const payload: StoredConsent = {
      version: LEGAL_CONSENT_VERSION,
      acceptedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* storage blocked */
  }
}

export default function AppLegalConsent() {
  const { t } = useTranslation();
  const { navigate, currentView } = useApp();
  const titleId = useId();
  const [pendingConsent, setPendingConsent] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!hasAcceptedCurrentLegalConsent()) {
      setPendingConsent(true);
    }
  }, []);

  // Lock background scroll while the gate is visible (real-app pattern)
  useEffect(() => {
    if (!pendingConsent) return;
    const viewingLegal =
      currentView === ViewEnum.PRIVACY_POLICY ||
      currentView === ViewEnum.TERMS_OF_SERVICE;
    if (viewingLegal) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pendingConsent, currentView]);

  const viewingLegalPage =
    currentView === ViewEnum.PRIVACY_POLICY || currentView === ViewEnum.TERMS_OF_SERVICE;
  const showOverlay = pendingConsent && !viewingLegalPage;

  if (!showOverlay) return null;

  const openLegalPage = (view: ViewEnum, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(view);
  };

  const handleAccept = () => {
    if (!accepted) return;
    persistLegalConsent();
    setPendingConsent(false);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl sm:rounded-2xl sm:pb-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-gray-900">
          {t('legalConsent.title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {t('legalConsent.body')}
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[#FF6B35] focus:ring-[#FF6B35]"
            aria-required="true"
          />
          <span>
            {t('auth.termsPrefix')}{' '}
            <button
              type="button"
              onClick={(e) => openLegalPage(ViewEnum.PRIVACY_POLICY, e)}
              className="font-medium text-[#FF6B35] hover:underline"
            >
              {t('auth.privacyPolicy')}
            </button>{' '}
            {t('auth.termsAnd')}{' '}
            <button
              type="button"
              onClick={(e) => openLegalPage(ViewEnum.TERMS_OF_SERVICE, e)}
              className="font-medium text-[#FF6B35] hover:underline"
            >
              {t('auth.termsOfService')}
            </button>
          </span>
        </label>

        <button
          type="button"
          disabled={!accepted}
          onClick={handleAccept}
          className="mt-5 w-full rounded-xl bg-[#FF6B35] py-3.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
        >
          {t('legalConsent.accept')}
        </button>
      </div>
    </div>
  );
}

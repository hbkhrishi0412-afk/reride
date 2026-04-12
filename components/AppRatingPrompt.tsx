import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { isCapacitorNativeApp } from '../utils/isCapacitorNative';

const STORAGE_KEY = 'reride_rating_prompt_launches';
const THRESHOLD = 5;
const PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.reride.app';
/** Replace when the app is live on the App Store */
const APP_STORE = 'https://apps.apple.com/app/id0000000000';

/**
 * After several launches, nudge users to rate (native shell only).
 */
const AppRatingPrompt: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isCapacitorNativeApp() || typeof window === 'undefined') return;
    if (Capacitor.getPlatform() === 'web') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      const next = Number.isFinite(n) ? n + 1 : 1;
      localStorage.setItem(STORAGE_KEY, String(next));
      if (next === THRESHOLD && !localStorage.getItem('reride_rating_prompt_dismissed')) {
        setOpen(true);
      }
    } catch {
      /* storage blocked */
    }
  }, []);

  if (!open) return null;

  const isIos = Capacitor.getPlatform() === 'ios';
  const storeUrl = isIos ? APP_STORE : PLAY_STORE;
  const storeLabel = isIos ? 'Rate on App Store' : 'Rate on Play Store';

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-prompt-title"
      >
        <h2 id="rating-prompt-title" className="text-lg font-bold text-gray-900">
          Enjoying ReRide?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          A quick store rating helps more buyers and sellers discover the app.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-orange-500 py-3 text-center text-sm font-semibold text-white"
            onClick={() => {
              try {
                localStorage.setItem('reride_rating_prompt_dismissed', '1');
              } catch {
                /* ignore */
              }
              setOpen(false);
            }}
          >
            {storeLabel}
          </a>
          <button
            type="button"
            className="rounded-xl py-3 text-sm font-medium text-gray-600"
            onClick={() => {
              try {
                localStorage.setItem('reride_rating_prompt_dismissed', '1');
              } catch {
                /* ignore */
              }
              setOpen(false);
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppRatingPrompt;

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from '../types.js';

interface NotFoundPageProps {
  onNavigate: (view: View) => void;
  currentUser?: { role?: string } | null;
}

const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate, currentUser }) => {
  const { t } = useTranslation();
  const isBuyer = currentUser?.role === 'customer';

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4" data-testid="not-found-page">
      <div className="text-center max-w-lg">
        <p className="text-6xl font-extrabold text-gray-200 mb-2" aria-hidden>
          404
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3">
          {t('notFound.title', { defaultValue: 'Page not found' })}
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          {t('notFound.body', {
            defaultValue:
              "This link doesn't exist or may have moved. Try browsing vehicles or head to your deal dashboard.",
          })}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => onNavigate(View.HOME)} className="btn-brand-primary">
            {t('notFound.home', { defaultValue: 'Go home' })}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(View.USED_CARS)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            {t('notFound.browse', { defaultValue: 'Browse vehicles' })}
          </button>
          {isBuyer && (
            <button
              type="button"
              onClick={() => onNavigate(View.BUYER_DASHBOARD)}
              className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 font-medium hover:bg-blue-50"
            >
              {t('notFound.myDeals', { defaultValue: 'My deals' })}
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate(View.HELP_CENTER)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            {t('notFound.help', { defaultValue: 'Help center' })}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(View.SUPPORT)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            {t('notFound.support', { defaultValue: 'Contact support' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FAQItem } from '../types';
import { View as ViewEnum } from '../types';
import { DEFAULT_PLATFORM_FAQS } from '../constants/defaultFaqs.js';

interface MobileFAQPageProps {
  faqItems: FAQItem[];
  onNavigate?: (view: ViewEnum) => void;
}

/**
 * Mobile-Optimized FAQ Page
 * Accordion + Support / grievance / safety shortcuts (parity with Help Center).
 */
export const MobileFAQPage: React.FC<MobileFAQPageProps> = ({ faqItems, onNavigate }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [openItem, setOpenItem] = useState<number | string | null>(null);

  const filteredAndGroupedFAQs = useMemo(() => {
    const source = faqItems.length > 0 ? faqItems : DEFAULT_PLATFORM_FAQS;
    const filtered = source.filter(
      (item) =>
        item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.reduce((acc, item) => {
      const category = item.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, FAQItem[]>);
  }, [faqItems, searchTerm]);

  const toggleItem = (id: number | string) => {
    setOpenItem(openItem === id ? null : id);
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('help.title', { defaultValue: 'Help Center' })}
        </h1>
        <p className="text-gray-600 text-sm">
          {t('help.subtitle', {
            defaultValue:
              'Guides for buying, selling, deal rooms, RC transfer, and account settings on ReRide.',
          })}
        </p>
      </div>

      <div className="px-4 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <input
          type="search"
          placeholder={t('faq.searchPlaceholder', { defaultValue: 'Search questions...' })}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
          style={{ minHeight: '48px' }}
        />
      </div>

      <div className="px-4 py-4">
        {Object.keys(filteredAndGroupedFAQs).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {t('help.noResults', { defaultValue: 'No questions found' })}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(filteredAndGroupedFAQs).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-lg font-bold text-gray-900 mb-3">{category}</h2>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="w-full flex justify-between items-center text-left p-4 active:bg-gray-50"
                        style={{ minHeight: '56px' }}
                      >
                        <span className="font-semibold text-gray-900 pr-4 flex-1">
                          {item.question}
                        </span>
                        <svg
                          className={`w-6 h-6 text-gray-400 flex-shrink-0 transition-transform ${
                            openItem === item.id ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {openItem === item.id && (
                        <div className="px-4 pb-4 text-gray-700 text-sm leading-relaxed border-t border-gray-200 pt-4">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {onNavigate && (
          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={() => onNavigate(ViewEnum.SUPPORT)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left active:bg-gray-50"
              style={{ minHeight: '56px' }}
            >
              <div className="font-bold text-gray-900">
                {t('help.card.support.title', { defaultValue: 'Contact support' })}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {t('help.card.support.desc', { defaultValue: 'Open a ticket for account or listing issues.' })}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ViewEnum.COMPLAINT_RESOLUTION)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left active:bg-gray-50"
              style={{ minHeight: '56px' }}
            >
              <div className="font-bold text-gray-900">
                {t('help.card.grievance.title', { defaultValue: 'File a grievance' })}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {t('help.card.grievance.desc', { defaultValue: 'Formal complaint resolution process.' })}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ViewEnum.SAFETY_CENTER)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left active:bg-gray-50"
              style={{ minHeight: '56px' }}
            >
              <div className="font-bold text-gray-900">
                {t('help.card.safety.title', { defaultValue: 'Trust & safety' })}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {t('help.card.safety.desc', { defaultValue: 'Tips for safe buying, selling, and RC transfer.' })}
              </p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileFAQPage;

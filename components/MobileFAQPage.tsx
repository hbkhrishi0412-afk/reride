import React, { useState, useMemo } from 'react';
import type { FAQItem } from '../types';

interface MobileFAQPageProps {
  faqItems: FAQItem[];
}

/**
 * Mobile-Optimized FAQ Page
 * Features:
 * - Accordion-style questions
 * - Touch-friendly expand/collapse
 * - Search functionality
 */
export const MobileFAQPage: React.FC<MobileFAQPageProps> = ({ faqItems }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openItem, setOpenItem] = useState<number | null>(null);

  const filteredAndGroupedFAQs = useMemo(() => {
    const filtered = faqItems.filter(
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

  const toggleItem = (id: number) => {
    setOpenItem(openItem === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h1>
        <p className="text-gray-600 text-sm">Find answers to common questions</p>
      </div>

      {/* Search */}
      <div className="px-4 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <input
          type="search"
          placeholder="Search questions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
          style={{ minHeight: '48px' }}
        />
      </div>

      {/* FAQ List */}
      <div className="px-4 py-4">
        {Object.keys(filteredAndGroupedFAQs).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No questions found</p>
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
      </div>
    </div>
  );
};

export default MobileFAQPage;






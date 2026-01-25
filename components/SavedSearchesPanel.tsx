import React, { useState, useEffect } from 'react';
import type { SavedSearch, Vehicle } from '../types';
import { 
  getSavedSearches, 
  deleteSavedSearch,
  updateSavedSearch,
  findNewMatches 
} from '../services/buyerEngagementService';

interface SavedSearchesPanelProps {
  userId: string;
  vehicles: Vehicle[];
  onSearchClick: (search: SavedSearch) => void;
}

const SavedSearchesPanel: React.FC<SavedSearchesPanelProps> = ({
  userId,
  vehicles,
  onSearchClick,
}) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null);

  useEffect(() => {
    loadSavedSearches();
  }, [userId]);

  const loadSavedSearches = () => {
    const searches = getSavedSearches(userId);
    setSavedSearches(searches);
  };

  const handleDelete = (searchId: string) => {
    if (confirm('Are you sure you want to delete this saved search?')) {
      deleteSavedSearch(searchId);
      loadSavedSearches();
    }
  };

  const handleToggleAlerts = (search: SavedSearch) => {
    updateSavedSearch(search.id, { emailAlerts: !search.emailAlerts });
    loadSavedSearches();
  };

  const getSearchDescription = (search: SavedSearch): string => {
    const parts: string[] = [];
    const f = search.filters;
    
    if (f.make) parts.push(f.make);
    if (f.model) parts.push(f.model);
    if (f.minPrice || f.maxPrice) {
      const priceRange = [
        f.minPrice ? `₹${(f.minPrice / 100000).toFixed(1)}L` : '',
        f.maxPrice ? `₹${(f.maxPrice / 100000).toFixed(1)}L` : ''
      ].filter(Boolean).join(' - ');
      if (priceRange) parts.push(priceRange);
    }
    if (f.features && f.features.length > 0) {
      parts.push(`${f.features.length} features`);
    }
    
    return parts.join(' • ') || 'All vehicles';
  };

  if (savedSearches.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Saved Searches Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Save your searches to get instant alerts when new matching cars are listed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Saved Searches
        </h3>
        <span className="px-3 py-1 bg-reride-orange text-white text-sm font-semibold rounded-full">
          {savedSearches.length}
        </span>
      </div>

      {savedSearches.map((search) => {
        const matchCount = findNewMatches(vehicles, search).length;
        const isExpanded = expandedSearch === search.id;

        return (
          <div
            key={search.id}
            className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden hover:border-reride-orange transition-colors"
          >
            {/* Header */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {search.name}
                    </h4>
                    {search.emailAlerts && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">
                        🔔 Alerts ON
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {getSearchDescription(search)}
                  </p>
                  {matchCount > 0 && (
                    <button
                      onClick={() => onSearchClick(search)}
                      className="text-sm text-reride-orange hover:underline font-semibold"
                    >
                      {matchCount} new {matchCount === 1 ? 'match' : 'matches'} →
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedSearch(isExpanded ? null : search.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Details"
                  >
                    <svg 
                      className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggleAlerts(search)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title={search.emailAlerts ? 'Turn off alerts' : 'Turn on alerts'}
                  >
                    <svg className="w-5 h-5" fill={search.emailAlerts ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(search.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {search.filters.make && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Make:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                          {search.filters.make}
                        </span>
                      </div>
                    )}
                    {search.filters.model && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Model:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                          {search.filters.model}
                        </span>
                      </div>
                    )}
                    {search.filters.minPrice && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Min Price:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                          ₹{(search.filters.minPrice / 100000).toFixed(2)} L
                        </span>
                      </div>
                    )}
                    {search.filters.maxPrice && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Max Price:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                          ₹{(search.filters.maxPrice / 100000).toFixed(2)} L
                        </span>
                      </div>
                    )}
                  </div>
                  {search.filters.features && search.filters.features.length > 0 && (
                    <div className="mt-3">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Features:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {search.filters.features.map((feature, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Created: {new Date(search.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SavedSearchesPanel;


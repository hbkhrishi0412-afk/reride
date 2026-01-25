import React, { useState } from 'react';
import { View as ViewEnum } from '../types';

interface MobileSearchProps {
  onNavigate: (view: ViewEnum) => void;
  onSearch: (query: string) => void;
}

const MobileSearch: React.FC<MobileSearchProps> = ({ onNavigate, onSearch }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setIsOpen(false)}>
      <div className="bg-white rounded-t-lg p-4 mt-20 safe-top" style={{ paddingTop: 'max(5rem, env(safe-area-inset-top, 0px) + 5rem)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Search Vehicles</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="ml-auto p-1 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSearch}>
          <div className="relative">
            <input
              type="text"
              placeholder="Search for vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              data-testid="mobile-search-input"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-600 hover:text-orange-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>
        
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              onSearch('Honda');
              setIsOpen(false);
            }}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            Honda
          </button>
          <button
            onClick={() => {
              onSearch('Toyota');
              setIsOpen(false);
            }}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            Toyota
          </button>
          <button
            onClick={() => {
              onSearch('Maruti');
              setIsOpen(false);
            }}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            Maruti
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileSearch;

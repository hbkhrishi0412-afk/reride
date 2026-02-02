import React, { useState, useEffect, memo } from 'react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = memo(({ isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<string>('navigation');

  const shortcuts: Shortcut[] = [
    // Navigation
    { keys: ['⌘', 'K'], description: 'Open Command Palette', category: 'navigation' },
    { keys: ['Esc'], description: 'Close Command Palette / Modals', category: 'navigation' },
    { keys: ['/', 'F'], description: 'Focus Search', category: 'navigation' },
    
    // Dashboard (Seller)
    { keys: ['⌘', 'N'], description: 'New Listing', category: 'dashboard' },
    { keys: ['⌘', 'E'], description: 'Export Data', category: 'dashboard' },
    { keys: ['⌘', 'F'], description: 'Find in Listings', category: 'dashboard' },
    
    // General
    { keys: ['?'], description: 'Show Keyboard Shortcuts', category: 'general' },
    { keys: ['⌘', '/'], description: 'Show Keyboard Shortcuts', category: 'general' },
  ];

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  const filteredShortcuts = shortcuts.filter(s => s.category === activeCategory);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Keyboard Shortcuts</h2>
            <p className="text-sm text-gray-500 mt-1">Website-only features</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Category Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>

          {/* Shortcuts List */}
          <div className="space-y-4">
            {filteredShortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      <kbd className="px-2.5 py-1.5 bg-white border border-gray-300 rounded text-sm font-mono text-gray-700 shadow-sm">
                        {key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-gray-400 mx-1">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> These shortcuts are only available on the website version, not in the mobile app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

KeyboardShortcutsHelp.displayName = 'KeyboardShortcutsHelp';

export default KeyboardShortcutsHelp;










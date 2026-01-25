import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
}

/**
 * Reusable page header with optional back link and right-side controls.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, onBack, backLabel = 'Back', rightSlot }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm hover:underline mb-2 transition-colors"
            style={{ color: '#FF6B35' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--spinny-blue)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--spinny-orange)')}
          >
            &larr; {backLabel}
          </button>
        )}
        <h1 className="text-3xl font-extrabold text-spinny-text-dark dark:text-spinny-text-dark">{title}</h1>
        {subtitle && <div className="text-sm text-gray-600 mt-1">{subtitle}</div>}
      </div>
      {rightSlot}
    </div>
  );
};

export default PageHeader;




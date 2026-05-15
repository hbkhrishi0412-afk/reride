import React from 'react';
import { useTranslation } from 'react-i18next';
import { HOME_DISCOVERY_CITY_ORDER } from '../constants/homeDiscovery.js';

export type PopularCityChip = {
  name: string;
  count: number;
};

interface PopularCitiesChipsProps {
  cities: PopularCityChip[];
  selectedCity?: string;
  onSelectCity: (city: string) => void;
  onBrowseAllIndia: () => void;
  /** light = on dark hero; default = on white background */
  variant?: 'light' | 'default';
  className?: string;
}

export const PopularCitiesChips: React.FC<PopularCitiesChipsProps> = ({
  cities,
  selectedCity = '',
  onSelectCity,
  onBrowseAllIndia,
  variant = 'default',
  className = '',
}) => {
  const { t } = useTranslation();

  const ordered = React.useMemo(() => {
    const byName = new Map(cities.map((c) => [c.name, c.count]));
    const withCounts = HOME_DISCOVERY_CITY_ORDER.map((name) => ({
      name,
      count: byName.get(name) ?? 0,
    }));
    return [...withCounts].sort((a, b) => b.count - a.count);
  }, [cities]);

  const chipBase =
    variant === 'light'
      ? 'border-white/25 bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm'
      : 'border-gray-200 bg-white text-gray-800 hover:border-purple-200 hover:bg-purple-50';

  const chipActive =
    variant === 'light'
      ? 'border-white bg-white text-purple-700 shadow-md'
      : 'border-purple-500 bg-purple-50 text-purple-800 ring-1 ring-purple-200';

  const allIndiaActive = !selectedCity.trim();

  return (
    <div className={className} data-testid="popular-cities-chips">
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ${
          variant === 'light' ? 'text-white/80' : 'text-gray-500'
        }`}
      >
        {t('home.popularCities.label', { defaultValue: 'Popular cities' })}
      </p>
      <div
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <button
          type="button"
          onClick={onBrowseAllIndia}
          className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            allIndiaActive ? chipActive : chipBase
          }`}
        >
          {t('home.popularCities.allIndia', { defaultValue: 'All India' })}
        </button>
        {ordered.map(({ name, count }) => {
          const active = selectedCity.trim().toLowerCase() === name.toLowerCase();
          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelectCity(name)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active ? chipActive : chipBase
              }`}
            >
              {name}
              {count > 0 ? (
                <span className={variant === 'light' ? 'opacity-80' : 'text-gray-500'}>
                  {' '}
                  ({count.toLocaleString('en-IN')})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PopularCitiesChips;

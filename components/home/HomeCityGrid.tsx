import React from 'react';
import { useTranslation } from 'react-i18next';
import { getHomeMobileCityAccent } from '../../constants/homeDiscovery';
import CityMonument from '../CityMonument';

export type HomeCityCard = {
  name: string;
  abbr: string;
  total: number;
};

interface HomeCityGridProps {
  cities: HomeCityCard[];
  onSelectCity: (city: HomeCityCard) => void;
  variant?: 'desktop' | 'mobile';
}

export const HomeCityGrid: React.FC<HomeCityGridProps> = ({
  cities,
  onSelectCity,
  variant = 'desktop',
}) => {
  const { t } = useTranslation();
  const isMobile = variant === 'mobile';
  const visible = isMobile ? cities.filter((city) => city.total > 0) : cities;

  return (
    <div
      className={
        isMobile
          ? 'flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory scroll-pl-4'
          : 'home-stagger-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5'
      }
    >
      {visible.map((city) => {
        const accent = getHomeMobileCityAccent(city.name);
        return (
          <button
            key={city.name}
            type="button"
            aria-label={t('mobile.home.cityAria', { name: city.name, count: city.total })}
            onClick={() => onSelectCity(city)}
            className={`mc-card group relative rounded-3xl bg-white overflow-hidden text-left transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
              isMobile ? 'flex-shrink-0 w-[156px] h-[184px] snap-start' : ''
            }`}
            style={{
              border: `1px solid ${accent.ring}`,
              boxShadow: '0 1px 2px rgba(28,25,23,0.04), 0 8px 24px -8px rgba(28,25,23,0.14)',
            }}
          >
            <div
              className={`mc-gradient relative w-full overflow-hidden ${isMobile ? 'h-[108px]' : 'h-[148px]'}`}
              style={{ background: accent.header }}
            >
              <CityMonument city={city.name} className="mc-monument" color={accent.solid} />
              <div className="absolute top-3 right-3" aria-hidden="true">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80"
                  style={{ border: `1px solid ${accent.ring}` }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" style={{ color: accent.pin }}>
                    <path d="M12 22s7-6.3 7-12a7 7 0 10-14 0c0 5.7 7 12 7 12z" />
                    <circle cx="12" cy="10" r="2.6" fill="#fff" />
                  </svg>
                </span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className={`mc-abbr leading-none font-black tracking-tight ${isMobile ? 'text-[48px]' : 'text-[56px]'}`}
                  style={{ color: accent.solid, opacity: 0.12 }}
                >
                  {city.abbr}
                </span>
              </div>
            </div>
            <div className={`${isMobile ? 'px-3 pt-2.5 pb-3' : 'px-4 pt-3 pb-4'} flex flex-col gap-2`}>
              <h3 className={`${isMobile ? 'text-[14px]' : 'text-[16px]'} font-bold text-stone-900 leading-tight truncate`}>
                {city.name}
              </h3>
              {city.total > 0 ? (
                <span
                  className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-[12px] font-bold"
                  style={{ backgroundColor: accent.soft, color: accent.pin }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent.pin }} aria-hidden />
                  {t('mobile.home.cityAvailable', { count: city.total })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-[12px] font-semibold bg-stone-100 text-stone-500">
                  {t('mobile.home.cityComingSoon')}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default HomeCityGrid;

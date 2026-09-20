import React from 'react';
import { useTranslation } from 'react-i18next';
import type { VehicleCategory } from '../../types';
import { HOME_CATEGORY_COLOR } from '../../constants/homeDiscovery';
import VehicleCategoryIcon from '../VehicleCategoryIcon';

export type HomeCategoryTile = {
  id: VehicleCategory;
  name: string;
  count: number;
};

interface HomeCategoryTilesProps {
  categories: HomeCategoryTile[];
  onSelectCategory: (category: VehicleCategory) => void;
  variant?: 'desktop' | 'mobile';
}

export const HomeCategoryTiles: React.FC<HomeCategoryTilesProps> = ({
  categories,
  onSelectCategory,
  variant = 'desktop',
}) => {
  const { t } = useTranslation();
  const isMobile = variant === 'mobile';

  return (
    <div
      className={
        isMobile
          ? 'flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide snap-x snap-mandatory scroll-pl-1'
          : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5'
      }
    >
      {categories.map((category) => {
        const hasVehicles = category.count > 0;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className={`vc-tile group relative flex flex-col items-center gap-2.5 bg-white rounded-2xl shadow-sm border border-stone-100 active:scale-95 transition-all duration-200 hover:shadow-md ${
              isMobile
                ? 'flex-shrink-0 p-3 w-[112px] snap-start'
                : 'p-5 hover:-translate-y-0.5'
            }`}
            style={{ minHeight: isMobile ? 96 : 160 }}
          >
            <div
              className={`vc-plate relative ${isMobile ? 'w-11 h-11 rounded-xl' : 'w-16 h-16 rounded-2xl'} bg-gradient-to-br ${HOME_CATEGORY_COLOR[category.id]} flex items-center justify-center`}
            >
              <VehicleCategoryIcon
                category={category.id}
                className={`relative z-10 ${isMobile ? 'w-9 h-9' : 'w-12 h-12'} drop-shadow-sm`}
              />
            </div>
            <span className={`${isMobile ? 'text-[11px]' : 'text-[14px]'} font-bold text-stone-900 text-center leading-tight`}>
              {category.name}
            </span>
            <div
              className={`flex items-center justify-center px-2 py-0.5 rounded-full ${isMobile ? 'text-[10px]' : 'text-[11px]'} font-semibold ${
                hasVehicles ? 'bg-orange-50 text-orange-700' : 'bg-stone-100 text-stone-500'
              }`}
            >
              <span>{category.count}</span>
              <span className="ml-0.5">{t('mobile.home.carsSuffix')}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default HomeCategoryTiles;

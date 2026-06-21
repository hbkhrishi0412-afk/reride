import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import { getCategoryDisplayName } from '../utils/compareList.js';

interface MobileComparisonProps {
  vehicles: Vehicle[];
  comparisonList: number[];
  comparisonCategory?: string | null;
  onRemoveFromCompare: (vehicleId: number) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onBack?: () => void;
  onClearCompare?: () => void;
}

type SpecRow = {
  label: string;
  key: string;
  format: (v: Vehicle) => string;
  highlightBest?: (vehicles: Vehicle[]) => (v: Vehicle) => boolean;
};

/**
 * Mobile comparison: one grid so vehicle cards and spec rows stay column-aligned.
 */
export const MobileComparison: React.FC<MobileComparisonProps> = ({
  vehicles,
  comparisonList,
  comparisonCategory = null,
  onRemoveFromCompare,
  onSelectVehicle,
  onBack,
  onClearCompare,
}) => {
  const { t, i18n } = useTranslation();
  const comparisonVehicles = useMemo(
    () => vehicles.filter((v) => comparisonList.includes(v.id)),
    [vehicles, comparisonList],
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const specs = useMemo((): SpecRow[] => {
    const minMileage = Math.min(...comparisonVehicles.map((v) => v.mileage));
    const maxYear = Math.max(...comparisonVehicles.map((v) => v.year));

    return [
      {
        label: t('compare.field.year'),
        key: 'year',
        format: (v) => v.year.toString(),
        highlightBest: () => (v) => v.year === maxYear,
      },
      {
        label: t('vehicle.detail.mileageLabel'),
        key: 'mileage',
        format: (v) => `${v.mileage.toLocaleString('en-IN')} ${t('vehicle.unit.km')}`,
        highlightBest: () => (v) => v.mileage === minMileage,
      },
      { label: t('compare.field.fuelType'), key: 'fuelType', format: (v) => v.fuelType },
      { label: t('compare.field.transmission'), key: 'transmission', format: (v) => v.transmission },
      {
        label: t('compare.field.engine'),
        key: 'engine',
        format: (v) => v.engine || t('compare.notAvailable'),
      },
      {
        label: t('compare.field.color'),
        key: 'color',
        format: (v) => v.color || t('compare.notAvailable'),
      },
      {
        label: t('compare.field.noOfOwners'),
        key: 'noOfOwners',
        format: (v) => (v.noOfOwners || 1).toString(),
      },
    ];
  }, [t, i18n.language, comparisonVehicles]);

  const colCount = comparisonVehicles.length;
  const gridTemplateColumns =
    colCount <= 2
      ? `minmax(5.75rem, 30%) repeat(${colCount}, minmax(0, 1fr))`
      : `minmax(5.75rem, 5.75rem) repeat(${colCount}, minmax(8.75rem, 8.75rem))`;

  const gridMinWidth = colCount > 2 ? 92 + colCount * 140 : undefined;

  const pageHeader = (
    <div className="shrink-0 bg-white border-b border-gray-200 px-3 py-3">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center justify-center w-10 h-10 -ml-1 rounded-full active:bg-gray-100"
            aria-label={t('compare.backToListings')}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 leading-tight truncate">{t('compare.pageTitle')}</h1>
          {comparisonCategory && (
            <p className="text-xs font-medium text-orange-700 mt-0.5 truncate">
              {getCategoryDisplayName(comparisonCategory)}
            </p>
          )}
        </div>
        {onClearCompare && (
          <button
            type="button"
            onClick={onClearCompare}
            className="shrink-0 text-sm font-semibold text-orange-500 px-2 py-2 rounded-lg active:bg-orange-50"
          >
            {t('compare.clearAll')}
          </button>
        )}
      </div>
    </div>
  );

  if (comparisonVehicles.length === 0) {
    return (
      <div className="flex flex-1 flex-col min-h-0 w-full bg-gray-50">
        {pageHeader}
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="text-center max-w-xs">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{t('compare.mobile.emptyTitle')}</h2>
            <p className="text-sm text-gray-600 mb-6">{t('compare.mobile.emptyHint')}</p>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white active:scale-[0.98]"
              >
                {t('compare.backToListings')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isRowDifferent = (key: string) => {
    if (comparisonVehicles.length <= 1) return false;
    const first = JSON.stringify((comparisonVehicles[0] as Record<string, unknown>)[key]);
    return comparisonVehicles.slice(1).some(
      (v) => JSON.stringify((v as Record<string, unknown>)[key]) !== first,
    );
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 w-full bg-gray-50">
      {pageHeader}

      <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
        <div
          className="w-full"
          style={{
            display: 'grid',
            gridTemplateColumns,
            minWidth: gridMinWidth,
          }}
        >
          {/* Sticky row-label gutter */}
          <div className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200" aria-hidden />

          {/* Vehicle cards — same columns as spec rows below */}
          {comparisonVehicles.map((vehicle) => (
            <div
              key={`card-${vehicle.id}`}
              className="border-b border-r border-gray-200 bg-white p-2.5 last:border-r-0"
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => onRemoveFromCompare(vehicle.id)}
                  className="absolute top-1 right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white active:bg-black/70"
                  aria-label={t('compare.removeVehicle', { defaultValue: 'Remove from compare' })}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectVehicle(vehicle)}
                  className="block w-full text-left active:opacity-90"
                >
                  <img
                    src={getFirstValidImage(vehicle.images, vehicle.id)}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    className="w-full aspect-[4/3] object-cover rounded-lg mb-2"
                  />
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  {vehicle.variant && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{vehicle.variant}</p>
                  )}
                  <p className="text-base font-bold text-orange-500 mt-1.5">{formatCurrency(vehicle.price)}</p>
                </button>
              </div>
            </div>
          ))}

          {/* Spec rows */}
          {specs.map((spec, rowIdx) => {
            const differs = isRowDifferent(spec.key);
            const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/80';

            return (
              <React.Fragment key={spec.key}>
                <div
                  className={`sticky left-0 z-10 border-b border-r border-gray-200 px-3 py-3 flex items-center ${rowBg}`}
                >
                  <p className="text-xs font-semibold text-gray-700 leading-snug break-words">{spec.label}</p>
                </div>
                {comparisonVehicles.map((vehicle) => {
                  const isBest = spec.highlightBest?.(comparisonVehicles)(vehicle) ?? false;
                  return (
                    <div
                      key={`${spec.key}-${vehicle.id}`}
                      className={`border-b border-r border-gray-200 px-3 py-3 last:border-r-0 ${rowBg} ${
                        differs ? 'ring-1 ring-inset ring-orange-100' : ''
                      }`}
                    >
                      <p
                        className={`text-sm leading-snug break-words ${
                          isBest ? 'font-semibold text-orange-600' : 'text-gray-900'
                        }`}
                      >
                        {spec.format(vehicle)}
                      </p>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Features — stacked cards (clearer on narrow screens than a wide grid) */}
      {comparisonVehicles.some((v) => v.features && v.features.length > 0) && (
        <div className="shrink-0 bg-white border-t border-gray-200 p-4 max-h-[40vh] overflow-y-auto">
          <h2 className="text-base font-bold text-gray-900 mb-3">{t('compare.featuresSection')}</h2>
          <div className="space-y-4">
            {comparisonVehicles.map((vehicle) => (
              <div key={`features-${vehicle.id}`} className="rounded-xl border border-gray-200 p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h3>
                {vehicle.features && vehicle.features.length > 0 ? (
                  <ul className="space-y-1.5">
                    {vehicle.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <svg
                          className="w-4 h-4 text-green-500 shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">{t('compare.mobile.noFeatures')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileComparison;

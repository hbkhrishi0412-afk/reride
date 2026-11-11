import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type VehicleFeatureSpecsValues = {
  engine?: string | null;
  displacement?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  fuelEfficiency?: string | null;
  groundClearance?: string | null;
  bootSpace?: string | null;
  color?: string | null;
};

interface VehicleFeatureSpecsPanelProps {
  specs: VehicleFeatureSpecsValues;
  features: string[];
  className?: string;
  /** Tighter type/spacing for mobile shell. */
  density?: 'default' | 'compact';
  /**
   * When true (default), skip empty detailed rows and hide the features
   * block entirely when there are no features.
   */
  hideEmpty?: boolean;
  /** Drop fuel/transmission when those already appear in the glance strip. */
  omitGlanceDuplicates?: boolean;
}

const SpecRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
    <dt className="shrink-0 text-sm text-slate-500">{label}</dt>
    <dd className="min-w-0 text-right text-sm font-semibold tracking-tight text-slate-900">{value}</dd>
  </div>
);

/**
 * Shared detailed specs + included features for vehicle detail Overview.
 */
const VehicleFeatureSpecsPanel: React.FC<VehicleFeatureSpecsPanelProps> = ({
  specs,
  features,
  className = '',
  density = 'default',
  hideEmpty = true,
  omitGlanceDuplicates = false,
}) => {
  const { t } = useTranslation();
  const compact = density === 'compact';

  const rows = useMemo(() => {
    const all: { key: keyof VehicleFeatureSpecsValues; label: string; value: string }[] = [
      { key: 'engine', label: t('compare.field.engine'), value: (specs.engine || '').trim() },
      { key: 'displacement', label: t('compare.field.displacement'), value: (specs.displacement || '').trim() },
      { key: 'transmission', label: t('vehicle.transmission'), value: (specs.transmission || '').trim() },
      { key: 'fuelType', label: t('vehicle.fuel'), value: (specs.fuelType || '').trim() },
      {
        key: 'fuelEfficiency',
        label: t('vehicle.detail.mileageLabel'),
        value: (specs.fuelEfficiency || '').trim(),
      },
      {
        key: 'groundClearance',
        label: t('vehicle.detail.specs.groundClearance'),
        value: (specs.groundClearance || '').trim(),
      },
      { key: 'bootSpace', label: t('vehicle.detail.specs.bootSpace'), value: (specs.bootSpace || '').trim() },
      { key: 'color', label: t('compare.field.color'), value: (specs.color || '').trim() },
    ];

    return all.filter((row) => {
      if (omitGlanceDuplicates && (row.key === 'transmission' || row.key === 'fuelType')) {
        return false;
      }
      if (hideEmpty) return Boolean(row.value);
      return true;
    });
  }, [specs, t, hideEmpty, omitGlanceDuplicates]);

  const showFeatures = features.length > 0 || !hideEmpty;
  if (rows.length === 0 && !showFeatures) {
    return null;
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {rows.length > 0 ? (
        <div>
          <h3 className={`mb-3 font-semibold text-slate-900 ${compact ? 'text-base' : 'text-xl'}`}>
            {t('vehicle.detail.detailedSpecifications')}
          </h3>
          <dl
            className={`rounded-2xl border border-slate-200/80 bg-white ${
              compact
                ? 'grid grid-cols-1 gap-x-0 px-3.5'
                : 'grid grid-cols-1 gap-x-8 px-4 sm:grid-cols-2 sm:px-5'
            }`}
          >
            {rows.map((row) => (
              <SpecRow key={row.key} label={row.label} value={hideEmpty ? row.value : row.value || '—'} />
            ))}
          </dl>
        </div>
      ) : null}

      {showFeatures ? (
        <div>
          <h4 className={`mb-3 font-semibold text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>
            {t('vehicle.detail.includedFeatures')}
          </h4>
          {features.length > 0 ? (
            <ul className={`grid gap-2.5 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {features.map((feature, idx) => (
                <li
                  key={`${feature}-${idx}`}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800"
                  data-no-translate
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/10 text-[#FF6B35]"
                    aria-hidden
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-500">
              {t('vehicle.detail.noFeaturesListed')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default VehicleFeatureSpecsPanel;

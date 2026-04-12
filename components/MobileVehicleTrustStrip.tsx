import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Marketplace-style trust cues (Spinny/CarDekho–adjacent): inspection, documentation, safe meet.
 */
export const MobileVehicleTrustStrip: React.FC = () => {
  const { t } = useTranslation();
  const items = [
    t('trust.strip.inspect', { defaultValue: 'Inspect in person before you pay' }),
    t('trust.strip.docs', { defaultValue: 'Verify RC, insurance & service records with the seller' }),
    t('trust.strip.chat', { defaultValue: 'Chat in-app; avoid sharing OTPs or passwords' }),
    t('trust.strip.meet', { defaultValue: 'Meet in a safe, public place for handover' }),
  ];

  return (
    <section
      className="mx-4 mt-4 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-3"
      aria-label={t('trust.strip.aria', { defaultValue: 'Buying safely' })}
    >
      <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800 mb-2">
        {t('trust.strip.title', { defaultValue: 'Buy with confidence' })}
      </h3>
      <ul className="space-y-1.5 text-xs text-emerald-900">
        {items.map((text) => (
          <li key={text} className="flex gap-2">
            <span className="text-emerald-600 shrink-0" aria-hidden>
              ✓
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default MobileVehicleTrustStrip;

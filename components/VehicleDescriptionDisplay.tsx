import React, { useMemo } from 'react';
import { parseVehicleDescription } from '../utils/buildVehicleDescription';

interface VehicleDescriptionDisplayProps {
  text: string;
  className?: string;
  /** Optional section heading (e.g. "Description"). Omitted when there is no body left. */
  heading?: string;
  /** Optional tone: mobile uses slightly tighter type. */
  density?: 'default' | 'compact';
}

/**
 * Organised buyer-facing description for desktop + mobile.
 * Skips the auto title (year/make/model) — already shown on the listing header.
 * Freeform seller copy falls back to pre-line paragraphs.
 */
const VehicleDescriptionDisplay: React.FC<VehicleDescriptionDisplayProps> = ({
  text,
  className = '',
  heading,
  density = 'default',
}) => {
  const parsed = parseVehicleDescription(text);
  const compact = density === 'compact';

  const body = useMemo(() => {
    // Title / overview / specs already appear elsewhere on the listing.
    const sections = parsed.sections.filter(
      (s) => s.heading !== 'OVERVIEW' && s.heading !== 'SPECIFICATIONS',
    );
    const paragraphs = parsed.paragraphs.filter(
      (p) => !/Professionally listed with clear ownership/i.test(p),
    );
    const isFreeform =
      !parsed.title &&
      parsed.sections.length === 0 &&
      parsed.paragraphs.length === 0 &&
      Boolean(text.trim());
    return {
      sections,
      paragraphs,
      isFreeform,
      hasBody: sections.length > 0 || paragraphs.length > 0 || isFreeform,
    };
  }, [parsed, text]);

  if (!body.hasBody) {
    return null;
  }

  const bodyClass = compact ? 'text-sm leading-relaxed' : 'text-base leading-relaxed';
  const headingClass =
    'text-xs font-bold uppercase tracking-wide text-gray-500';

  return (
    <div className={className}>
      {heading ? (
        <h3 className="mb-2 text-lg font-semibold text-gray-900">{heading}</h3>
      ) : null}

      {body.isFreeform ? (
        <p className={`text-gray-700 whitespace-pre-line ${bodyClass}`} data-no-translate>
          {text}
        </p>
      ) : (
        <div className={`space-y-4 text-gray-700 ${bodyClass}`} data-no-translate>
          {body.sections.map((section) => (
            <div key={section.heading} className="space-y-2">
              <h4 className={headingClass}>{section.heading}</h4>
              {section.bullets.length > 0 ? (
                <ul className="space-y-1.5">
                  {section.bullets.map((bullet, i) => (
                    <li key={`${section.heading}-${i}`} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          {body.paragraphs.map((para, i) => (
            <p key={`para-${i}`} className="whitespace-pre-line text-gray-600">
              {para}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default VehicleDescriptionDisplay;

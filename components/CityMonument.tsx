import React from 'react';
import type { HomeDiscoveryCityName } from '../constants/homeDiscovery';

/**
 * Iconic monument silhouettes for each Home-discovery city.
 *
 * Rendered as a single white SVG path at low opacity, anchored to the bottom
 * of the mobile city card's gradient header — so each tile feels like a
 * postcard of that city without competing with the bold abbreviation ("DN",
 * "HY", ...) that sits on top.
 *
 * All SVGs share a consistent viewBox (140 x 80) so they visually align at
 * the same baseline across the horizontal scroll.
 *
 * Intentionally abstract/silhouette — they need to read at ~130px wide, at
 * ~25% opacity, while a 44px "DN" sits overlaid. Photographic detail would
 * turn to noise at that size, while bold silhouettes stay iconic.
 */

type MonumentProps = { className?: string; color?: string };

const VIEW_BOX = '0 0 140 80';
const BASE_CLASS =
  'absolute bottom-0 left-1/2 -translate-x-1/2 w-[88%] h-[62%] pointer-events-none select-none';

/* Delhi NCR — India Gate: single tall triumphal arch flanked by low pillars. */
const IndiaGate: React.FC<MonumentProps> = ({ className }) => (
  <svg viewBox={VIEW_BOX} className={className} fill="currentColor" aria-hidden="true">
    {/* ground line */}
    <rect x="6" y="74" width="128" height="4" rx="1" />
    {/* low flanking walls */}
    <rect x="14" y="62" width="26" height="14" />
    <rect x="100" y="62" width="26" height="14" />
    <rect x="12" y="58" width="30" height="5" rx="1" />
    <rect x="98" y="58" width="30" height="5" rx="1" />
    {/* main arch block */}
    <path d="M46 74 V30 Q46 16 70 16 Q94 16 94 30 V74 H76 V44 Q76 34 70 34 Q64 34 64 44 V74 Z" />
    {/* top cornice */}
    <rect x="42" y="24" width="56" height="6" rx="1" />
    {/* tiny crowning finial */}
    <rect x="66" y="8" width="8" height="8" rx="1" />
    <rect x="64" y="14" width="12" height="4" rx="1" />
  </svg>
);

/* Hyderabad — Charminar: square base, four corner minarets with bulbs, central arches. */
const Charminar: React.FC<MonumentProps> = ({ className }) => (
  <svg viewBox={VIEW_BOX} className={className} fill="currentColor" aria-hidden="true">
    <rect x="4" y="74" width="132" height="4" rx="1" />
    {/* base block with top cornice */}
    <rect x="22" y="52" width="96" height="22" />
    <rect x="22" y="48" width="96" height="5" rx="1" />
    {/* four minarets */}
    {[16, 52, 84, 118].map((x, i) => (
      <g key={i}>
        {/* shaft */}
        <rect x={x} y={22} width="8" height="30" />
        {/* balcony */}
        <rect x={x - 2} y={34} width="12" height="3" rx="1" />
        {/* dome */}
        <circle cx={x + 4} cy={18} r="6" />
        {/* finial */}
        <rect x={x + 3} y={6} width="2" height="10" rx="1" />
      </g>
    ))}
    {/* central small dome on top of base */}
    <path d="M60 52 Q70 38 80 52 Z" />
    <rect x="68" y="34" width="4" height="8" rx="1" />
  </svg>
);

/* Bangalore — Vidhana Soudha: classical facade with grand central dome + columned wings. */
const VidhanaSoudha: React.FC<MonumentProps> = ({ className }) => (
  <svg viewBox={VIEW_BOX} className={className} fill="currentColor" aria-hidden="true">
    <rect x="2" y="74" width="136" height="4" rx="1" />
    {/* stepped plinth */}
    <rect x="8" y="64" width="124" height="10" />
    <rect x="14" y="58" width="112" height="7" />
    {/* central main block with columns */}
    <rect x="40" y="40" width="60" height="20" />
    {[44, 52, 60, 68, 76, 84, 92].map((x) => (
      <rect key={x} x={x} y="40" width="3" height="20" />
    ))}
    {/* wings */}
    <rect x="14" y="46" width="24" height="14" />
    <rect x="102" y="46" width="24" height="14" />
    {/* central pediment */}
    <path d="M42 40 L70 26 L98 40 Z" />
    {/* grand dome drum */}
    <rect x="60" y="18" width="20" height="8" rx="1" />
    <path d="M56 22 Q70 -4 84 22 Z" />
    {/* finial spire */}
    <rect x="69" y="2" width="2" height="8" rx="1" />
    <circle cx="70" cy="2" r="2" />
  </svg>
);

/* Pune — Shaniwar Wada: imposing fort gate (Delhi Darwaza) with spiked battlement. */
const ShaniwarWada: React.FC<MonumentProps> = ({ className }) => (
  <svg viewBox={VIEW_BOX} className={className} fill="currentColor" aria-hidden="true">
    <rect x="4" y="74" width="132" height="4" rx="1" />
    {/* main gate block with a subtractive arched doorway cutout via path */}
    <path d="M18 30 H122 V74 H82 V50 Q82 38 70 38 Q58 38 58 50 V74 H18 Z" />
    {/* flanking bastions (turrets) */}
    <rect x="10" y="20" width="14" height="54" rx="1" />
    <rect x="116" y="20" width="14" height="54" rx="1" />
    {/* turret tops */}
    <path d="M10 20 L17 10 L24 20 Z" />
    <path d="M116 20 L123 10 L130 20 Z" />
    {/* battlement spikes across top of gate */}
    {[28, 38, 48, 58, 68, 78, 88, 98, 108].map((x) => (
      <rect key={x} x={x} y="24" width="5" height="8" />
    ))}
    {/* ornamental band */}
    <rect x="18" y="34" width="104" height="2" />
  </svg>
);

/* Mumbai — Gateway of India: grand central arch with side bays and low domes. */
const GatewayOfIndia: React.FC<MonumentProps> = ({ className }) => (
  <svg viewBox={VIEW_BOX} className={className} fill="currentColor" aria-hidden="true">
    <rect x="2" y="74" width="136" height="4" rx="1" />
    {/* side bays */}
    <rect x="10" y="50" width="26" height="24" />
    <rect x="104" y="50" width="26" height="24" />
    {/* side bay low domes */}
    <path d="M10 50 Q23 38 36 50 Z" />
    <path d="M104 50 Q117 38 130 50 Z" />
    {/* central arch block */}
    <path d="M38 74 V28 Q38 18 50 18 H90 Q102 18 102 28 V74 H82 V52 Q82 42 70 42 Q58 42 58 52 V74 Z" />
    {/* cornice over central block */}
    <rect x="36" y="24" width="68" height="6" rx="1" />
    {/* central dome */}
    <path d="M48 24 Q70 0 92 24 Z" />
    {/* central finial */}
    <rect x="69" y="-2" width="2" height="8" rx="1" />
    <circle cx="70" cy="0" r="2.2" />
  </svg>
);

const MONUMENT_MAP: Record<HomeDiscoveryCityName, React.FC<MonumentProps>> = {
  'Delhi NCR': IndiaGate,
  Hyderabad: Charminar,
  Bangalore: VidhanaSoudha,
  Pune: ShaniwarWada,
  Mumbai: GatewayOfIndia,
};

interface Props {
  city: HomeDiscoveryCityName;
  /** Extra classes to tweak opacity/animation. */
  className?: string;
  /**
   * Silhouette colour. Defaults to white for legacy dark gradients; the mobile
   * city cards now pass the city's dark accent so the monument pops against
   * the pastel backdrop like a classic postcard silhouette.
   */
  color?: string;
}

/**
 * Renders the iconic monument silhouette for the given city, positioned to sit
 * at the bottom of its parent container. The parent MUST be `position:
 * relative` (or similar) — we use `absolute` internally.
 */
const CityMonument: React.FC<Props> = ({ city, className, color = '#FFFFFF' }) => {
  const Icon = MONUMENT_MAP[city];
  if (!Icon) return null;
  return (
    <span
      className={`${BASE_CLASS} ${className ?? ''}`.trim()}
      style={{ color }}
      aria-hidden="true"
    >
      <Icon className="w-full h-full" />
    </span>
  );
};

export default CityMonument;

import React from 'react';
import { VehicleCategory } from '../vehicle-category';

/**
 * Sketch-style SVG illustrations for each vehicle category, replacing the
 * emoji glyphs in the mobile Home "Browse by Category" rail.
 *
 * Design notes:
 * - A single consistent 48x48 viewBox so every icon reads at the same
 *   optical weight across the rail.
 * - Two-tone "duotone" fills + thin sketch strokes + soft ground shadows
 *   simulate a subtle 3D feel without importing any image assets.
 * - Wheels are marked with the `.vc-wheel` class so a shared CSS rule can
 *   spin them on parent hover. Bodies use `.vc-body` so we can bounce /
 *   rev them in sync. Ground shadows use `.vc-shadow` for matching pulse.
 * - Colour stays white-with-dark-accents so the icon reads clearly on top
 *   of the category tile's coloured gradient.
 */

type IconProps = {
  className?: string;
};

const BODY = '#FFFFFF';
const BODY_SHADE = 'rgba(15, 23, 42, 0.18)'; // under-panel darkening
const OUTLINE = 'rgba(15, 23, 42, 0.75)'; // sketch line
const GLASS = 'rgba(15, 23, 42, 0.22)'; // window glass
const WHEEL = '#111827';
const RIM = '#F8FAFC';
const ACCENT_WARM = '#FCD34D'; // headlight
const ACCENT_HOT = '#EF4444'; // tail-light / flag

/* ------------------------------ Four Wheeler ------------------------------ */
const FourWheeler: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    aria-hidden="true"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* ground shadow */}
    <ellipse cx="24" cy="40" rx="15" ry="1.6" fill="rgba(0,0,0,0.22)" className="vc-shadow" />
    <g className="vc-body">
      {/* main body (hatchback-sedan hybrid silhouette) */}
      <path
        d="M6 32 L8 26 Q8.5 24 10.5 23.5 L16 22 L20 17 Q21 16 22.5 16 L31 16 Q33 16 34 17.5 L37 22 L40 23 Q42 23.5 42 26 L42 32 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth="1.2"
      />
      {/* greenhouse / windows */}
      <path
        d="M18 22 L21 18 Q21.7 17.2 22.7 17.2 L27.3 17.2 Q27.3 22 27.3 22 Z"
        fill={GLASS}
      />
      <path
        d="M28 17.2 L31 17.2 Q32 17.2 32.5 18 L35 22 L28 22 Z"
        fill={GLASS}
      />
      {/* belt-line / door gap */}
      <line x1="10" y1="27" x2="42" y2="27" stroke={BODY_SHADE} strokeWidth="0.9" />
      {/* door handle hint */}
      <line x1="22" y1="25.2" x2="25" y2="25.2" stroke={OUTLINE} strokeWidth="0.8" />
      {/* headlight */}
      <circle cx="40" cy="26" r="1.3" fill={ACCENT_WARM} stroke={OUTLINE} strokeWidth="0.6" />
      {/* taillight */}
      <circle cx="8" cy="26" r="1.1" fill={ACCENT_HOT} stroke={OUTLINE} strokeWidth="0.6" />
      {/* subtle top highlight */}
      <path d="M21 17.5 Q24 15.2 31 17" stroke="#fff" strokeWidth="0.9" opacity="0.6" fill="none" />
    </g>
    {/* wheels: duplicated rims + spokes, absolute-positioned so
        transform-origin lands on wheel centre for the spin animation. */}
    <g className="vc-wheel">
      <circle cx="13" cy="34" r="4.2" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="13" cy="34" r="1.7" fill={RIM} />
      <line x1="13" y1="30.3" x2="13" y2="37.7" stroke={RIM} strokeWidth="0.9" />
      <line x1="9.3" y1="34" x2="16.7" y2="34" stroke={RIM} strokeWidth="0.9" />
    </g>
    <g className="vc-wheel">
      <circle cx="35" cy="34" r="4.2" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="35" cy="34" r="1.7" fill={RIM} />
      <line x1="35" y1="30.3" x2="35" y2="37.7" stroke={RIM} strokeWidth="0.9" />
      <line x1="31.3" y1="34" x2="38.7" y2="34" stroke={RIM} strokeWidth="0.9" />
    </g>
  </svg>
);

/* ------------------------------ Two Wheeler ------------------------------- */
const TwoWheeler: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    aria-hidden="true"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="24" cy="40" rx="14" ry="1.4" fill="rgba(0,0,0,0.22)" className="vc-shadow" />
    <g className="vc-body">
      {/* seat + fuel tank (sport bike) */}
      <path
        d="M14 30 L18 22 Q19 20 22 19 L28 18 Q30 18 31 19.5 L33 22 L34 26 L30 28 L22 29 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth="1.1"
      />
      {/* tank highlight */}
      <path d="M20 22 Q24 19.5 30 20.5" stroke="#fff" strokeWidth="0.9" opacity="0.6" />
      {/* frame diagonal */}
      <line x1="22" y1="29" x2="14" y2="34" stroke={OUTLINE} strokeWidth="1.2" />
      <line x1="30" y1="28" x2="35" y2="34" stroke={OUTLINE} strokeWidth="1.2" />
      {/* front forks */}
      <line x1="34" y1="22" x2="38" y2="30" stroke={OUTLINE} strokeWidth="1.4" />
      {/* handlebar */}
      <path d="M32 19.5 Q36 18 38 20" stroke={OUTLINE} strokeWidth="1.4" />
      <circle cx="37.5" cy="19.5" r="0.9" fill={OUTLINE} />
      {/* headlight pod */}
      <circle cx="37" cy="24" r="1.5" fill={ACCENT_WARM} stroke={OUTLINE} strokeWidth="0.6" />
      {/* exhaust */}
      <rect x="8" y="31" width="6" height="1.8" rx="0.9" fill={BODY_SHADE} />
    </g>
    <g className="vc-wheel">
      <circle cx="14" cy="34" r="4" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="14" cy="34" r="1.4" fill={RIM} />
      <line x1="14" y1="30.5" x2="14" y2="37.5" stroke={RIM} strokeWidth="0.7" />
      <line x1="10.5" y1="34" x2="17.5" y2="34" stroke={RIM} strokeWidth="0.7" />
    </g>
    <g className="vc-wheel">
      <circle cx="36" cy="34" r="4" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="36" cy="34" r="1.4" fill={RIM} />
      <line x1="36" y1="30.5" x2="36" y2="37.5" stroke={RIM} strokeWidth="0.7" />
      <line x1="32.5" y1="34" x2="39.5" y2="34" stroke={RIM} strokeWidth="0.7" />
    </g>
  </svg>
);

/* ----------------------------- Three Wheeler ------------------------------ */
const ThreeWheeler: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    aria-hidden="true"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="24" cy="40" rx="15" ry="1.6" fill="rgba(0,0,0,0.22)" className="vc-shadow" />
    <g className="vc-body">
      {/* canopy (curved roof) */}
      <path
        d="M12 20 Q24 10 36 20"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth="1.2"
      />
      {/* cabin box (rickshaw body) */}
      <path
        d="M10 22 L12 20 L36 20 L38 22 L38 32 L10 32 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth="1.2"
      />
      {/* front windshield cut + side panel glass */}
      <path d="M14 22 L16 20 L32 20 L34 22 Z" fill={GLASS} />
      <rect x="15" y="24" width="18" height="5" rx="0.6" fill={GLASS} />
      {/* roof crown highlight */}
      <path d="M14 19.2 Q24 12.5 34 19.2" stroke="#fff" strokeWidth="0.9" opacity="0.7" />
      {/* door frame */}
      <line x1="24" y1="22" x2="24" y2="32" stroke={OUTLINE} strokeWidth="0.8" />
      {/* small flag / aerial on top */}
      <line x1="24" y1="14" x2="24" y2="10" stroke={OUTLINE} strokeWidth="0.9" />
      <path d="M24 10 L26.5 11 L24 12 Z" fill={ACCENT_HOT} />
    </g>
    {/* three wheels: front single, rear pair (side-view suggests 1 rear visible) */}
    <g className="vc-wheel">
      <circle cx="13" cy="34" r="3.6" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="13" cy="34" r="1.3" fill={RIM} />
      <line x1="13" y1="30.5" x2="13" y2="37.5" stroke={RIM} strokeWidth="0.7" />
    </g>
    <g className="vc-wheel">
      <circle cx="35" cy="34" r="3.6" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="35" cy="34" r="1.3" fill={RIM} />
      <line x1="35" y1="30.5" x2="35" y2="37.5" stroke={RIM} strokeWidth="0.7" />
    </g>
    {/* a tiny third wheel peeking behind for depth */}
    <circle cx="38" cy="34" r="2.1" fill={WHEEL} opacity="0.45" />
  </svg>
);

/* ------------------------------- Commercial ------------------------------- */
const Commercial: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    aria-hidden="true"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="24" cy="40" rx="17" ry="1.7" fill="rgba(0,0,0,0.22)" className="vc-shadow" />
    <g className="vc-body">
      {/* cargo box */}
      <rect x="4" y="18" width="24" height="14" rx="1.2" fill={BODY} stroke={OUTLINE} strokeWidth="1.2" />
      {/* cargo vertical ribs */}
      <line x1="12" y1="18" x2="12" y2="32" stroke={BODY_SHADE} strokeWidth="0.8" />
      <line x1="20" y1="18" x2="20" y2="32" stroke={BODY_SHADE} strokeWidth="0.8" />
      {/* cab */}
      <path
        d="M28 18 L42 18 L44 22 L44 32 L28 32 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth="1.2"
      />
      {/* cab window */}
      <path d="M30 20 L40 20 L41.5 23 L30 23 Z" fill={GLASS} />
      {/* headlight */}
      <circle cx="42.5" cy="27" r="1.2" fill={ACCENT_WARM} stroke={OUTLINE} strokeWidth="0.6" />
      {/* top highlight */}
      <line x1="6" y1="19" x2="26" y2="19" stroke="#fff" strokeWidth="0.8" opacity="0.6" />
    </g>
    <g className="vc-wheel">
      <circle cx="12" cy="34" r="3.8" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="12" cy="34" r="1.4" fill={RIM} />
      <line x1="12" y1="30.5" x2="12" y2="37.5" stroke={RIM} strokeWidth="0.7" />
      <line x1="8.5" y1="34" x2="15.5" y2="34" stroke={RIM} strokeWidth="0.7" />
    </g>
    <g className="vc-wheel">
      <circle cx="36" cy="34" r="3.8" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="36" cy="34" r="1.4" fill={RIM} />
      <line x1="36" y1="30.5" x2="36" y2="37.5" stroke={RIM} strokeWidth="0.7" />
      <line x1="32.5" y1="34" x2="39.5" y2="34" stroke={RIM} strokeWidth="0.7" />
    </g>
  </svg>
);

/* --------------------------------- Farm ---------------------------------- */
const Farm: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    aria-hidden="true"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="24" cy="40" rx="16" ry="1.7" fill="rgba(0,0,0,0.22)" className="vc-shadow" />
    <g className="vc-body">
      {/* hood */}
      <rect x="6" y="22" width="14" height="10" rx="1.2" fill={BODY} stroke={OUTLINE} strokeWidth="1.2" />
      {/* grille lines */}
      <line x1="8" y1="25" x2="18" y2="25" stroke={BODY_SHADE} strokeWidth="0.7" />
      <line x1="8" y1="28" x2="18" y2="28" stroke={BODY_SHADE} strokeWidth="0.7" />
      {/* cab */}
      <path
        d="M20 14 L30 14 L32 22 L20 22 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth="1.2"
      />
      {/* cab glass */}
      <path d="M22 15.5 L29 15.5 L30.5 20.5 L22 20.5 Z" fill={GLASS} />
      {/* rear body */}
      <rect x="20" y="22" width="14" height="10" rx="1.2" fill={BODY} stroke={OUTLINE} strokeWidth="1.2" />
      {/* exhaust stack */}
      <rect x="8.5" y="14" width="2.2" height="8" rx="0.6" fill={OUTLINE} />
      <ellipse cx="9.6" cy="14" rx="1.3" ry="0.6" fill={BODY_SHADE} />
      {/* top highlight */}
      <line x1="20" y1="15" x2="29" y2="15" stroke="#fff" strokeWidth="0.9" opacity="0.6" />
    </g>
    {/* small front wheel */}
    <g className="vc-wheel">
      <circle cx="13" cy="34" r="3.2" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="13" cy="34" r="1.1" fill={RIM} />
      <line x1="13" y1="31" x2="13" y2="37" stroke={RIM} strokeWidth="0.6" />
    </g>
    {/* big rear wheel â€” signature tractor look */}
    <g className="vc-wheel">
      <circle cx="32" cy="33" r="6.2" fill={WHEEL} stroke={OUTLINE} strokeWidth="0.9" />
      <circle cx="32" cy="33" r="2.2" fill={RIM} />
      <line x1="32" y1="27.5" x2="32" y2="38.5" stroke={RIM} strokeWidth="1" />
      <line x1="26.5" y1="33" x2="37.5" y2="33" stroke={RIM} strokeWidth="1" />
      {/* lug cleats */}
      <circle cx="32" cy="27.5" r="0.6" fill={RIM} />
      <circle cx="37.2" cy="33" r="0.6" fill={RIM} />
      <circle cx="32" cy="38.5" r="0.6" fill={RIM} />
      <circle cx="26.8" cy="33" r="0.6" fill={RIM} />
    </g>
  </svg>
);

const ICON_MAP: Partial<Record<VehicleCategory, React.FC<IconProps>>> = {
  [VehicleCategory.FOUR_WHEELER]: FourWheeler,
  [VehicleCategory.TWO_WHEELER]: TwoWheeler,
  [VehicleCategory.THREE_WHEELER]: ThreeWheeler,
  [VehicleCategory.COMMERCIAL]: Commercial,
  [VehicleCategory.FARM]: Farm,
};

interface Props {
  category: VehicleCategory;
  className?: string;
}

/**
 * Renders the sketch-style SVG illustration for the given vehicle category.
 * Returns null (so callers can fall back to an emoji) for unknown categories.
 */
const VehicleCategoryIcon: React.FC<Props> = ({ category, className }) => {
  const Icon = ICON_MAP[category];
  if (!Icon) return null;
  return <Icon className={className} />;
};

export default VehicleCategoryIcon;


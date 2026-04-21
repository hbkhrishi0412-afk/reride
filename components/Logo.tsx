import React from 'react';
import { BRAND_ICON_192 } from '../lib/brandAssets';

interface LogoProps {
  className?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  /** `onDark` = light wordmark for orange/gradient bars (e.g. mobile drawer) */
  variant?: 'default' | 'onDark';
}

const Logo: React.FC<LogoProps> = ({
  className = '',
  onClick,
  size = 'lg',
  showText = true,
  variant = 'default',
}) => {
  /* Lockup: app-style tile + wordmark (cap height slightly below tile height), like a horizontal brand bar */
  const sizeConfig = {
    sm: { box: 24, text: 'text-sm leading-none tracking-wide', spacing: 'gap-2' },
    md: { box: 32, text: 'text-lg leading-none tracking-wide', spacing: 'gap-2.5' },
    lg: { box: 40, text: 'text-xl leading-none tracking-wide', spacing: 'gap-3' },
    xl: { box: 48, text: 'text-2xl leading-none tracking-wide', spacing: 'gap-3' },
  };

  const config = sizeConfig[size];
  const box = config.box;
  const isOnDark = variant === 'onDark';

  return (
    <button
      type="button"
      onClick={onClick}
      // Brand lockup must stay Latin + identical in every locale (dom auto-translate skips this subtree)
      data-no-translate
      translate="no"
      className={`flex flex-row items-center ${config.spacing} transition-all duration-300 hover:scale-105 notranslate ${className}`}
    >
      <div
        className={`relative shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ${
          isOnDark ? 'ring-white/30' : 'ring-black/5'
        }`}
        style={{ width: box, height: box }}
      >
        <img
          src={BRAND_ICON_192}
          alt={showText ? '' : 'ReRide'}
          width={box}
          height={box}
          draggable={false}
          className="h-full w-full object-cover"
          decoding="async"
        />
      </div>

      {showText && (
        <span
          className={`font-extrabold ${
            isOnDark ? 'text-white drop-shadow-sm' : 'text-slate-900 dark:text-white'
          } ${config.text}`}
          style={{
            fontFamily: 'Nunito Sans, sans-serif',
            fontWeight: '800',
          }}
        >
          RERIDE
        </span>
      )}
    </button>
  );
};

export default Logo;

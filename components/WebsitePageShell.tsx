import React from 'react';
import { useIsMobileApp } from '../hooks/useIsMobileApp';

/** Matches `Header.tsx` — single source of truth for site-wide horizontal alignment. */
export const WEBSITE_PAGE_GUTTERS = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

type NarrowWidth = '4xl' | '5xl';

interface WebsitePageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Constrain readable content while keeping the same left/right gutter alignment. */
  narrow?: NarrowWidth;
  style?: React.CSSProperties;
  /** Skip default vertical padding (e.g. full-bleed hero pages). */
  noPadding?: boolean;
}

const NARROW_CLASS: Record<NarrowWidth, string> = {
  '4xl': 'max-w-4xl mx-auto w-full',
  '5xl': 'max-w-5xl mx-auto w-full',
};

/** Horizontal gutter wrapper only — use inside full-bleed sections. */
export function WebsitePageGutters({
  children,
  className = '',
  narrow,
}: Pick<WebsitePageShellProps, 'children' | 'className' | 'narrow'>) {
  return (
    <div className={`${WEBSITE_PAGE_GUTTERS} ${className}`}>
      {narrow ? <div className={NARROW_CLASS[narrow]}>{children}</div> : children}
    </div>
  );
}

/** Standard content page wrapper. On the phone shell, skip marketing pb-24 — MobileLayout already reserves the tab bar. */
const WebsitePageShell: React.FC<WebsitePageShellProps> = ({
  children,
  className = '',
  narrow,
  style,
  noPadding = false,
}) => {
  const { isMobileApp } = useIsMobileApp();
  const padBottom = isMobileApp ? 'pb-4' : 'pb-24 lg:pb-12';
  const padY = noPadding ? '' : isMobileApp ? 'py-4' : 'py-6 sm:py-8';
  return (
    <div className={`animate-fade-in ${padBottom} ${className}`} style={style}>
      <WebsitePageGutters className={padY} narrow={narrow}>
        {children}
      </WebsitePageGutters>
    </div>
  );
};

export default WebsitePageShell;

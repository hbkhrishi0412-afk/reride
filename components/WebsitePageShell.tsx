import React from 'react';

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

/** Standard desktop marketing / content page wrapper. */
const WebsitePageShell: React.FC<WebsitePageShellProps> = ({
  children,
  className = '',
  narrow,
  style,
  noPadding = false,
}) => (
  <div className={`animate-fade-in pb-24 lg:pb-12 ${className}`} style={style}>
    <WebsitePageGutters className={noPadding ? '' : 'py-6 sm:py-8'} narrow={narrow}>
      {children}
    </WebsitePageGutters>
  </div>
);

export default WebsitePageShell;

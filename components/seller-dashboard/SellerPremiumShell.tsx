import React from 'react';

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #FFFFFF 0%, #FBF8F5 100%)',
  border: '1px solid rgba(28, 25, 23, 0.08)',
  boxShadow: '0 24px 48px -32px rgba(28, 25, 23, 0.28)',
};

const glowStyle: React.CSSProperties = {
  background:
    'radial-gradient(80% 120% at 0% 0%, rgba(255,107,53,0.14), transparent 55%), radial-gradient(60% 100% at 100% 0%, rgba(28,25,23,0.05), transparent 50%)',
};

export type SellerPremiumPanelProps = {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** When true, only the card shell is rendered — children own the page header. */
  hideHeader?: boolean;
};

/** Shared premium card shell for seller dashboard pages. */
export const SellerPremiumPanel: React.FC<SellerPremiumPanelProps> = ({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = '',
  hideHeader = false,
}) => (
  <div className={`relative overflow-hidden rounded-2xl ${className}`} style={panelStyle}>
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28" style={glowStyle} />
    <div className={`relative ${hideHeader ? '' : 'p-5 sm:p-7'} ${bodyClassName}`}>
      {!hideHeader ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-stone-400">{eyebrow}</p>
            ) : null}
            <h2
              className="mt-1 text-[1.65rem] font-semibold tracking-tight text-stone-900"
              style={{ fontFamily: "'Nunito Sans', Poppins, sans-serif", letterSpacing: '-0.03em' }}
            >
              {title}
            </h2>
            {description ? <div className="mt-1.5 text-sm text-stone-500">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  </div>
);

export const sellerPremiumTableWrapStyle: React.CSSProperties = {
  border: '1px solid rgba(28,25,23,0.08)',
};

export const sellerPremiumPrimaryBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #FF8456 0%, #E85A2A 100%)',
  boxShadow: '0 12px 24px -14px rgba(232,90,42,0.85)',
};

export const sellerPremiumGhostBtnStyle: React.CSSProperties = {
  border: '1px solid rgba(28,25,23,0.12)',
  background: 'rgba(255,255,255,0.7)',
};

export default SellerPremiumPanel;

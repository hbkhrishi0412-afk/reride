/**
 * Shared dashboard primitives used across seller, customer, and service-provider dashboards
 * on both desktop and mobile. These components are intentionally small, composable, and
 * accessibility-first. They do not own any data or side effects — pass everything in via props.
 *
 * Design goals:
 *  - Visual consistency across the three roles
 *  - Sensible responsive defaults (grid collapses 1 -> 2 -> 4 columns)
 *  - Accessible by default (aria-current, role=tab/tablist, button semantics)
 *  - No new runtime dependencies; Tailwind-only styling aligned with existing tokens
 */
import React, { memo, useCallback } from 'react';

/* -------------------------------------------------------------------------- */
/*  StatCard                                                                  */
/* -------------------------------------------------------------------------- */

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Short helper text shown under the value (e.g. "+12% this month") */
  sublabel?: React.ReactNode;
  /** Leading icon — either an emoji string or a React node (e.g. an SVG) */
  icon?: React.ReactNode;
  /** Make the card act as a button (for drill-down navigation) */
  onClick?: () => void;
  /** Tailwind gradient stops for the icon pill, e.g. "from-blue-500 to-indigo-600" */
  iconGradient?: string;
  /** Muted accent color ring on hover; defaults to blue */
  accent?: 'blue' | 'orange' | 'emerald' | 'amber' | 'purple' | 'rose';
  /** Compact variant for mobile or dense desktop rows */
  dense?: boolean;
  /** Overrides the accessible name (defaults to `${label}: ${value}`) */
  ariaLabel?: string;
  /** Optional badge in the top-right (e.g. "Live", "3 new") */
  badge?: React.ReactNode;
  className?: string;
}

const ACCENT_RING: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'hover:border-blue-300',
  orange: 'hover:border-orange-300',
  emerald: 'hover:border-emerald-300',
  amber: 'hover:border-amber-300',
  purple: 'hover:border-purple-300',
  rose: 'hover:border-rose-300',
};

const ACCENT_TEXT: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'text-blue-600',
  orange: 'text-orange-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  purple: 'text-purple-600',
  rose: 'text-rose-600',
};

export const StatCard = memo(function StatCard({
  label,
  value,
  sublabel,
  icon,
  onClick,
  iconGradient = 'from-blue-500 to-indigo-600',
  accent = 'blue',
  dense = false,
  ariaLabel,
  badge,
  className = '',
}: StatCardProps) {
  const Wrapper: React.ElementType = onClick ? 'button' : 'div';
  const padding = dense ? 'p-3 sm:p-4' : 'p-4 sm:p-5';
  const valueSize = dense ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl';
  const iconSize = dense ? 'w-9 h-9' : 'w-11 h-11';

  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      aria-label={onClick ? (ariaLabel ?? `${label}: ${typeof value === 'string' || typeof value === 'number' ? value : ''}`) : undefined}
      className={[
        'group relative text-left bg-white dark:bg-gray-800',
        'rounded-2xl border border-gray-100 dark:border-gray-700',
        'shadow-sm hover:shadow-md transition-all duration-200',
        ACCENT_RING[accent],
        onClick ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 active:scale-[0.99]' : '',
        padding,
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        {icon !== undefined && (
          <div
            aria-hidden="true"
            className={[
              iconSize,
              'flex-shrink-0 rounded-xl flex items-center justify-center text-white shadow',
              `bg-gradient-to-br ${iconGradient}`,
            ].join(' ')}
          >
            {typeof icon === 'string' ? <span className="text-lg leading-none">{icon}</span> : icon}
          </div>
        )}
        {badge !== undefined && (
          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-3 min-w-0">
        <p
          className={[
            valueSize,
            'font-bold text-gray-900 dark:text-gray-50 leading-tight tracking-tight truncate',
          ].join(' ')}
        >
          {value}
        </p>
        <p className={['mt-1 text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:', ACCENT_TEXT[accent], 'transition-colors'].join(' ')}>
          {label}
        </p>
        {sublabel !== undefined && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500 truncate">{sublabel}</p>
        )}
      </div>
    </Wrapper>
  );
});

/* -------------------------------------------------------------------------- */
/*  StatCardGrid                                                              */
/* -------------------------------------------------------------------------- */

export interface StatCardGridProps {
  children: React.ReactNode;
  /** Desktop column count for md+ screens (default 4) */
  cols?: 2 | 3 | 4;
  className?: string;
}

export function StatCardGrid({ children, cols = 4, className = '' }: StatCardGridProps) {
  const colsClass =
    cols === 2
      ? 'grid-cols-2 md:grid-cols-2'
      : cols === 3
      ? 'grid-cols-2 md:grid-cols-3'
      : 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4';
  return <div className={`grid ${colsClass} gap-3 sm:gap-4 ${className}`}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/*  EmptyState                                                                */
/* -------------------------------------------------------------------------- */

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Icon — an emoji or SVG node */
  icon?: React.ReactNode;
  /** Primary CTA button */
  action?: { label: string; onClick: () => void };
  /** Secondary CTA button */
  secondaryAction?: { label: string; onClick: () => void };
  /** Compact variant for tight contexts */
  dense?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  dense = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={[
        'flex flex-col items-center justify-center text-center rounded-2xl',
        'border border-dashed border-gray-200 dark:border-gray-700',
        'bg-gray-50/50 dark:bg-gray-800/30',
        dense ? 'px-4 py-8' : 'px-6 py-12 sm:py-16',
        className,
      ].join(' ')}
    >
      {icon !== undefined && (
        <div
          aria-hidden="true"
          className={[
            dense ? 'w-10 h-10' : 'w-14 h-14',
            'mb-3 flex items-center justify-center rounded-full',
            'bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800',
            'text-gray-500 dark:text-gray-300',
          ].join(' ')}
        >
          {typeof icon === 'string' ? <span className="text-2xl">{icon}</span> : icon}
        </div>
      )}
      <h3 className={[dense ? 'text-base' : 'text-lg', 'font-semibold text-gray-900 dark:text-gray-100'].join(' ')}>
        {title}
      </h3>
      {description && (
        <p className={[dense ? 'mt-1 text-xs' : 'mt-2 text-sm', 'max-w-md text-gray-600 dark:text-gray-400'].join(' ')}>
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className={[dense ? 'mt-3' : 'mt-5', 'flex flex-wrap items-center justify-center gap-2'].join(' ')}>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 transition"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm font-semibold border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 transition"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SectionHeader                                                             */
/* -------------------------------------------------------------------------- */

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional trailing control, e.g. a "View all" link or filter chip */
  action?: React.ReactNode;
  /** Heading level; defaults to h2 */
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function SectionHeader({ title, subtitle, action, as = 'h2', className = '' }: SectionHeaderProps) {
  const Heading = as;
  const size = as === 'h1' ? 'text-xl sm:text-2xl' : as === 'h2' ? 'text-base sm:text-lg' : 'text-sm sm:text-base';
  return (
    <div className={`flex items-end justify-between gap-3 mb-3 ${className}`}>
      <div className="min-w-0">
        <Heading className={`${size} font-semibold text-gray-900 dark:text-gray-100 truncate`}>{title}</Heading>
        {subtitle && (
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeletons                                                                 */
/* -------------------------------------------------------------------------- */

export function StatCardSkeleton({ dense = false }: { dense?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={[
        'bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm',
        dense ? 'p-3 sm:p-4' : 'p-4 sm:p-5',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className={[dense ? 'w-9 h-9' : 'w-11 h-11', 'rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse'].join(' ')} />
      </div>
      <div className="mt-3 h-6 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="mt-2 h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
    </div>
  );
}

export function SkeletonRow({ lines = 2 }: { lines?: number }) {
  return (
    <div
      aria-hidden="true"
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-3"
    >
      <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={[
              'h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse',
              i === 0 ? 'w-3/4' : 'w-1/2',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} lines={lines} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  TabNav — semantic tablist with keyboard support                           */
/* -------------------------------------------------------------------------- */

export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  badge?: number | string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabNavProps<T extends string> {
  tabs: Array<TabItem<T>>;
  active: T;
  onChange: (id: T) => void;
  /** aria-label for the tablist landmark */
  ariaLabel: string;
  /** horizontal scroll-style bar (mobile) or standard tablist (desktop) */
  variant?: 'scroll' | 'wrap';
  /** Class for the outer tablist container */
  className?: string;
}

export function TabNav<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  variant = 'wrap',
  className = '',
}: TabNavProps<T>) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const enabled = tabs.map((t, i) => ({ t, i })).filter((x) => !x.t.disabled);
      if (enabled.length === 0) return;
      const currentEnabledIdx = enabled.findIndex((x) => x.i === index);
      let nextIdx = currentEnabledIdx;
      if (e.key === 'ArrowRight') nextIdx = (currentEnabledIdx + 1) % enabled.length;
      else if (e.key === 'ArrowLeft') nextIdx = (currentEnabledIdx - 1 + enabled.length) % enabled.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = enabled.length - 1;
      const target = enabled[nextIdx];
      if (target) {
        onChange(target.t.id);
        // Focus moves with roving tabindex on next render; fall back to querying DOM
        const root = (e.currentTarget.parentElement as HTMLElement | null);
        const btn = root?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target.i];
        btn?.focus();
      }
    },
    [tabs, onChange],
  );

  const containerClass =
    variant === 'scroll'
      ? 'flex items-center gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory'
      : 'flex flex-wrap items-center gap-2';

  return (
    <div role="tablist" aria-label={ariaLabel} className={`${containerClass} ${className}`}>
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={[
              'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all snap-start',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
              selected
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700',
              tab.disabled ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {tab.icon && (
              <span aria-hidden="true" className="flex items-center">
                {tab.icon}
              </span>
            )}
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== 0 && tab.badge !== '' && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold',
                  selected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                ].join(' ')}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  TabPanel — matching region for TabNav                                     */
/* -------------------------------------------------------------------------- */

export interface TabPanelProps {
  id: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ id, active, children, className = '' }: TabPanelProps) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg ${className}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SummaryBadge — small pill used to summarize counts next to section titles */
/* -------------------------------------------------------------------------- */

export function SummaryBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'info' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

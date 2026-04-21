import React from 'react';

/** Outer frame for admin page body — max width, vertical rhythm */
export const AdminContentFrame: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => (
    <div className={`mx-auto w-full max-w-[1600px] space-y-6 ${className}`.trim()}>{children}</div>
);

/** Premium KPI tile */
export const AdminStatTile: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    onClick?: () => void;
    accent?: 'violet' | 'sky' | 'emerald' | 'amber';
}> = ({ title, value, icon, onClick, accent = 'violet' }) => {
    const ring =
        accent === 'sky'
            ? 'from-sky-500/15 to-blue-600/10 ring-sky-200/60'
            : accent === 'emerald'
              ? 'from-emerald-500/15 to-teal-600/10 ring-emerald-200/60'
              : accent === 'amber'
                ? 'from-amber-500/15 to-orange-600/10 ring-amber-200/60'
                : 'from-violet-500/15 to-indigo-600/10 ring-violet-200/60';
    return (
        <div
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={
                onClick
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onClick();
                          }
                      }
                    : undefined
            }
            className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm ring-1 ring-inset ring-transparent backdrop-blur-sm transition-all duration-200 ${
                onClick
                    ? 'cursor-pointer hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400'
                    : ''
            }`}
        >
            <div
                className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-90 blur-2xl ${ring}`}
                aria-hidden
            />
            <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white text-xl shadow-inner">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
                    <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
                </div>
            </div>
        </div>
    );
};

/** Card + header + optional toolbar for data tables */
export const AdminDataTableFrame: React.FC<{
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}> = ({ title, subtitle, children, actions }) => (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.04]">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-violet-50/30 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
                {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle px-1 pb-1 sm:px-2">{children}</div>
        </div>
    </section>
);

/** Horizontal bar chart panel */
export const AdminBarChartPanel: React.FC<{ title: string; data: { label: string; value: number }[] }> = ({
    title,
    data,
}) => {
    const maxValue = Math.max(...(data || []).map((d) => d.value), 1);
    return (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-6">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Distribution across inventory</p>
            <div className="mt-5 space-y-3">
                {(data || []).map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[8.5rem_1fr]">
                        <span className="truncate text-right text-xs font-medium text-slate-600" title={label}>
                            {label}
                        </span>
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="flex h-full min-w-[1.75rem] items-center justify-end rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 pr-2 text-[10px] font-bold text-white tabular-nums shadow-sm"
                                    style={{ width: `${Math.max(8, (value / maxValue) * 100)}%` }}
                                >
                                    {value}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export type AdminTabItem<T extends string> = { id: T; label: string; count?: number };

/** Segmented control for filters (replaces loose pill buttons) */
export function AdminSegmentedTabs<T extends string>({
    items,
    value,
    onChange,
    'aria-label': ariaLabel,
}: {
    items: AdminTabItem<T>[];
    value: T;
    onChange: (id: T) => void;
    'aria-label': string;
}) {
    return (
        <div
            className="inline-flex flex-wrap gap-0.5 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner"
            role="tablist"
            aria-label={ariaLabel}
        >
            {items.map((item) => {
                const active = value === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(item.id)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                            active
                                ? 'bg-white text-violet-800 shadow-sm ring-1 ring-slate-200/90'
                                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                        }`}
                    >
                        {item.label}
                        {item.count !== undefined ? (
                            <span className={`ml-1 tabular-nums ${active ? 'text-violet-600' : 'text-slate-400'}`}>
                                ({item.count})
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}

export const AdminEmptyState: React.FC<{
    title: string;
    description: string;
    variant?: 'success' | 'neutral';
}> = ({ title, description, variant = 'neutral' }) => (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
        <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
                variant === 'success'
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80'
                    : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/80'
            }`}
        >
            {variant === 'success' ? (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            ) : (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h12a2 2 0 012 2v4M9 13h6"
                    />
                </svg>
            )}
        </div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
    </div>
);

export const AdminPageIntro: React.FC<{
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
    <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
            {eyebrow ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">{eyebrow}</p>
            ) : null}
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
);

export const AdminToolbar: React.FC<{ left?: React.ReactNode; right?: React.ReactNode }> = ({ left, right }) => (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{left}</div>
        {right ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{right}</div> : null}
    </div>
);

export const adminTableHeadClass =
    'bg-slate-50/95 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 first:rounded-tl-xl last:rounded-tr-xl';

export const adminTableCellClass = 'px-4 py-3.5 text-sm text-slate-800';

export const adminTableRowClass = 'border-b border-slate-100 transition-colors hover:bg-violet-50/[0.35]';

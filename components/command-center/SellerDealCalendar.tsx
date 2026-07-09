import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DealCalendarEvent, DealCalendarEventStatus } from '../../types.js';
import { fetchSellerDealCalendar } from '../../services/dealService.js';

export interface SellerDealCalendarProps {
  compact?: boolean;
  onOpenDeal?: (leadId: string) => void;
}

type ViewMode = 'all' | 'day';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function normalizeDateKey(date: string): string {
  return date.slice(0, 10);
}

function statusStyles(status: DealCalendarEventStatus): string {
  switch (status) {
    case 'today':
      return 'bg-reride-orange/10 text-reride-orange border-reride-orange/30';
    case 'overdue':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'completed':
      return 'bg-slate-100 text-slate-500 border-slate-200';
    default:
      return 'bg-blue-50 text-blue-800 border-blue-100';
  }
}

function countBadgeStyles(status: DealCalendarEventStatus): string {
  switch (status) {
    case 'overdue':
      return 'bg-red-500 text-white';
    case 'today':
      return 'bg-reride-orange text-white';
    case 'completed':
      return 'bg-slate-400 text-white';
    default:
      return 'bg-blue-600 text-white';
  }
}

function eventIcon(type: DealCalendarEvent['type']): string {
  switch (type) {
    case 'test_drive':
      return '🚗';
    case 'delivery':
      return '📦';
    case 'rc_deadline':
      return '📄';
    default:
      return '📅';
  }
}

function formatEventDate(date: string, time?: string): string {
  try {
    const d = new Date(`${normalizeDateKey(date)}T12:00:00`);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return time ? `${label} · ${time}` : label;
  } catch {
    return date;
  }
}

function formatDayLabel(dateKey: string): string {
  try {
    const d = new Date(`${normalizeDateKey(dateKey)}T12:00:00`);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateKey;
  }
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayDateKey(): string {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function monthFromDateKey(dateKey: string): Date {
  const [y, m] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

function sortEvents(events: DealCalendarEvent[]): DealCalendarEvent[] {
  return [...events].sort((a, b) => {
    const order = { overdue: 0, today: 1, upcoming: 2, completed: 3 };
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    return normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date));
  });
}

function worstStatus(statuses: DealCalendarEventStatus[]): DealCalendarEventStatus {
  const rank: Record<DealCalendarEventStatus, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    completed: 3,
  };
  return statuses.reduce((worst, status) => (rank[status] < rank[worst] ? status : worst));
}

function buildEventsByDate(events: DealCalendarEvent[]): Map<string, DealCalendarEvent[]> {
  const map = new Map<string, DealCalendarEvent[]>();
  for (const evt of events) {
    const key = normalizeDateKey(evt.date);
    const list = map.get(key) || [];
    list.push({ ...evt, date: key });
    map.set(key, list);
  }
  return map;
}

function pendingEvents(events: DealCalendarEvent[]): DealCalendarEvent[] {
  return events.filter((e) => e.status !== 'completed');
}

type EventRowProps = {
  evt: DealCalendarEvent;
  explanation: string;
  statusLabel: string;
  onOpenDeal?: (leadId: string) => void;
  showDate?: boolean;
  highlighted?: boolean;
  dense?: boolean;
};

const EventRow: React.FC<EventRowProps> = ({
  evt,
  explanation,
  statusLabel,
  onOpenDeal,
  showDate = true,
  highlighted = false,
  dense = false,
}) => (
  <li>
    <button
      type="button"
      onClick={() => onOpenDeal?.(evt.dealId)}
      className={`w-full text-left flex items-center gap-2.5 border transition-colors active:scale-[0.99] ${
        dense
          ? `px-3 py-2.5 ${highlighted ? 'bg-orange-50/70 border-orange-200' : 'border-transparent hover:bg-slate-50'}`
          : `rounded-xl mx-3 my-1 px-3 py-2.5 ${
              highlighted
                ? 'bg-orange-50/80 border-orange-200 hover:bg-orange-50'
                : 'bg-white border-slate-200 hover:border-reride-orange/30 hover:bg-slate-50'
            }`
      }`}
    >
      <span className={`shrink-0 ${dense ? 'text-base' : 'text-lg'}`}>{eventIcon(evt.type)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 truncate">{evt.title}</p>
          <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${statusStyles(evt.status)}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 truncate">{evt.subtitle}</p>
        {!dense && (
          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-1">{explanation}</p>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-mono text-reride-orange">{evt.dealId}</p>
          {showDate ? (
            <span className="text-[10px] text-slate-500 shrink-0">{formatEventDate(evt.date, evt.time)}</span>
          ) : (
            <span className="text-[10px] font-semibold text-reride-orange shrink-0">Open →</span>
          )}
        </div>
      </div>
    </button>
  </li>
);

type MonthGridProps = {
  month: Date;
  eventsByDate: Map<string, DealCalendarEvent[]>;
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
  onMonthChange: (next: Date) => void;
  onJumpToToday: () => void;
};

const MonthGrid: React.FC<MonthGridProps> = ({
  month,
  eventsByDate,
  selectedDateKey,
  onSelectDate,
  onMonthChange,
  onJumpToToday,
}) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const todayKey = todayDateKey();

  const cells: Array<{ day: number | null; dateKey?: string }> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push({ day: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, dateKey: toDateKey(year, monthIndex, day) });
  }

  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60">
      <div className="flex items-center justify-between mb-2 gap-2">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
          className="w-8 h-8 rounded-lg text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 active:scale-95"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-sm font-bold text-slate-900 text-center flex-1">{monthLabel}</p>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
          className="w-8 h-8 rounded-lg text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 active:scale-95"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="flex justify-center mb-2">
        <button
          type="button"
          onClick={onJumpToToday}
          className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:border-reride-orange/40 hover:text-reride-orange"
        >
          Today
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`} className="text-[10px] font-semibold text-slate-400 py-1">
            {label}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (cell.day === null) {
            return <span key={`empty-${index}`} className="h-10" />;
          }

          const dayEvents = cell.dateKey ? eventsByDate.get(cell.dateKey) || [] : [];
          const pending = pendingEvents(dayEvents);
          const pendingCount = pending.length;
          const isToday = cell.dateKey === todayKey;
          const isSelected = cell.dateKey === selectedDateKey;
          const worst = pendingCount > 0 ? worstStatus(pending.map((e) => e.status)) : null;
          const hasDeadlines = pendingCount > 0;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => cell.dateKey && onSelectDate(cell.dateKey)}
              className={`h-10 flex flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                isSelected
                  ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1 shadow-sm'
                  : hasDeadlines
                    ? 'bg-white text-slate-900 ring-1 ring-slate-200 hover:ring-reride-orange/40'
                    : isToday
                      ? 'bg-reride-orange/10 text-reride-orange ring-1 ring-reride-orange/30'
                      : 'text-slate-600 hover:bg-white'
              }`}
              aria-pressed={isSelected}
            >
              <span>{cell.day}</span>
              {pendingCount > 0 && worst ? (
                <span
                  className={`mt-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold leading-[18px] ${
                    isSelected ? 'bg-white text-slate-900' : countBadgeStyles(worst)
                  }`}
                >
                  {pendingCount}
                </span>
              ) : (
                <span className="mt-0.5 h-[18px]" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5 text-[9px] text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-reride-orange" /> Today</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600" /> Upcoming</span>
      </div>
    </div>
  );
};

export const SellerDealCalendar: React.FC<SellerDealCalendarProps> = ({ compact = false, onOpenDeal }) => {
  const { t } = useTranslation();
  const dayCasesRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<DealCalendarEvent[]>([]);
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [displayMonth, setDisplayMonth] = useState(() => monthFromDateKey(todayDateKey()));
  const [sectionOpen, setSectionOpen] = useState(true);
  const [deadlinesUserToggled, setDeadlinesUserToggled] = useState(false);

  const explanationFor = useCallback(
    (type: DealCalendarEvent['type']) => {
      switch (type) {
        case 'test_drive':
          return t('sellerDashboard.deadlines.explanation.test_drive');
        case 'delivery':
          return t('sellerDashboard.deadlines.explanation.delivery');
        case 'rc_deadline':
          return t('sellerDashboard.deadlines.explanation.rc_deadline');
        default:
          return t('sellerDashboard.deadlines.explanation.default');
      }
    },
    [t],
  );

  const statusLabel = useCallback(
    (status: DealCalendarEventStatus) => t(`sellerDashboard.deadlines.status.${status}`),
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const calendar = await fetchSellerDealCalendar();
      setEvents(calendar.events);
      setThisWeekCount(calendar.thisWeekCount);
      setOverdueCount(calendar.overdueCount);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => sortEvents(pendingEvents(events)), [events]);
  const eventsByDate = useMemo(() => buildEventsByDate(events), [events]);

  const nextPendingEvent = pending[0] ?? null;
  const [hasFocusedMonth, setHasFocusedMonth] = useState(false);

  useEffect(() => {
    if (hasFocusedMonth || !nextPendingEvent) return;
    const focusDate = normalizeDateKey(nextPendingEvent.date);
    setDisplayMonth(monthFromDateKey(focusDate));
    setHasFocusedMonth(true);
  }, [hasFocusedMonth, nextPendingEvent]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDateKey) return [];
    return sortEvents(pendingEvents(eventsByDate.get(selectedDateKey) || []));
  }, [eventsByDate, selectedDateKey]);

  const allListEvents = useMemo(() => {
    const limit = compact ? 4 : 12;
    return pending.slice(0, limit);
  }, [compact, pending]);

  const jumpToDate = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
    setDisplayMonth(monthFromDateKey(dateKey));
    setViewMode('day');
  }, []);

  const handleSelectDate = useCallback((dateKey: string) => {
    jumpToDate(dateKey);
  }, [jumpToDate]);

  const handleJumpToToday = useCallback(() => {
    jumpToDate(todayDateKey());
  }, [jumpToDate]);

  const showAllDeadlines = useCallback(() => {
    setSelectedDateKey(null);
    setViewMode('all');
  }, []);

  useEffect(() => {
    if (viewMode !== 'day' || !selectedDateKey || selectedDayEvents.length === 0) return;
    const timer = window.setTimeout(() => {
      dayCasesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [viewMode, selectedDateKey, selectedDayEvents.length]);

  if (loading) {
    return <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />;
  }

  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">{t('sellerDashboard.deadlines.title')}</h3>
        <p className="text-xs text-slate-500 mt-1">{t('sellerDashboard.deadlines.subtitle')}</p>
        <p className="text-sm text-slate-500 mt-3">{t('sellerDashboard.deadlines.empty')}</p>
      </section>
    );
  }

  const selectedDayLabel = selectedDateKey ? formatDayLabel(selectedDateKey) : '';
  const showDayView = viewMode === 'day' && selectedDateKey;

  const collapsedSummary = nextPendingEvent
    ? `${nextPendingEvent.title} · ${formatEventDate(nextPendingEvent.date, nextPendingEvent.time)}`
    : t('sellerDashboard.deadlines.empty');

  const statsChips = (
    <div className="flex items-center gap-1 text-[9px] font-semibold shrink-0">
      {pending.length > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {pending.length} pending
        </span>
      )}
      {thisWeekCount > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
          {thisWeekCount} wk
        </span>
      )}
      {overdueCount > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
          {overdueCount} late
        </span>
      )}
    </div>
  );

  const calendarBody = (
    <>
      <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/40">
        <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-slate-100">
          <button
            type="button"
            onClick={showAllDeadlines}
            className={`py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
              viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t('sellerDashboard.deadlines.tabAll', 'All deadlines')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedDateKey) jumpToDate(todayDateKey());
              else setViewMode('day');
            }}
            className={`py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
              viewMode === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t('sellerDashboard.deadlines.tabByDay', 'By day')}
          </button>
        </div>
      </div>

      {nextPendingEvent && (
        <button
          type="button"
          onClick={() => jumpToDate(normalizeDateKey(nextPendingEvent.date))}
          className="w-full text-left px-3 py-2 border-b border-orange-100/80 bg-orange-50/50 hover:bg-orange-50 flex items-center gap-2 active:scale-[0.99] transition-colors"
        >
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-reride-orange w-9">
            {t('sellerDashboard.deadlines.nextUp', 'Next up')}
          </span>
          <span className="flex-1 min-w-0 text-[12px] font-semibold text-slate-900 truncate">
            {nextPendingEvent.title}
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-reride-orange">
            {formatEventDate(nextPendingEvent.date, nextPendingEvent.time)}
          </span>
        </button>
      )}

      {(viewMode === 'day' || selectedDateKey) && (
        <MonthGrid
          month={displayMonth}
          eventsByDate={eventsByDate}
          selectedDateKey={selectedDateKey}
          onSelectDate={handleSelectDate}
          onMonthChange={setDisplayMonth}
          onJumpToToday={handleJumpToToday}
        />
      )}

      {showDayView && (
        <div ref={dayCasesRef} className="border-b border-slate-100">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-slate-800 truncate">
              {selectedDayEvents.length > 0
                ? t('sellerDashboard.deadlines.pendingOnDate', {
                    count: selectedDayEvents.length,
                    date: selectedDayLabel,
                  })
                : t('sellerDashboard.deadlines.noPendingOnDate', { date: selectedDayLabel })}
            </p>
            <button
              type="button"
              onClick={showAllDeadlines}
              className="shrink-0 text-[11px] font-semibold text-reride-orange hover:underline"
            >
              {t('sellerDashboard.deadlines.showAll')}
            </button>
          </div>

          {selectedDayEvents.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {selectedDayEvents.map((evt) => (
                <EventRow
                  key={evt.id}
                  evt={evt}
                  explanation={explanationFor(evt.type)}
                  statusLabel={statusLabel(evt.status)}
                  onOpenDeal={onOpenDeal}
                  showDate={false}
                  dense
                />
              ))}
            </ul>
          ) : (
            <div className="px-3 py-4 text-center space-y-2">
              <p className="text-[12px] text-slate-500">
                {t('sellerDashboard.deadlines.emptyDayBody')}
              </p>
              {nextPendingEvent && normalizeDateKey(nextPendingEvent.date) !== selectedDateKey && (
                <button
                  type="button"
                  onClick={() => jumpToDate(normalizeDateKey(nextPendingEvent.date))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white bg-reride-orange hover:bg-orange-600 active:scale-95"
                >
                  {t('sellerDashboard.deadlines.goToNext')} ({formatEventDate(nextPendingEvent.date)})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === 'all' && (
        <ul className="divide-y divide-slate-100">
          {allListEvents.map((evt) => (
            <EventRow
              key={evt.id}
              evt={evt}
              explanation={explanationFor(evt.type)}
              statusLabel={statusLabel(evt.status)}
              onOpenDeal={onOpenDeal}
              dense
            />
          ))}
        </ul>
      )}
      {viewMode === 'all' && !compact && pending.length > allListEvents.length && (
        <p className="px-3 py-1.5 text-[11px] text-slate-400 text-center border-t border-slate-100">
          {t('sellerDashboard.deadlines.more', { count: pending.length - allListEvents.length })}
        </p>
      )}
    </>
  );

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      {compact ? (
        <button
          type="button"
          onClick={() => {
            setDeadlinesUserToggled(true);
            setSectionOpen((v) => !v);
          }}
          className={`w-full text-left px-3 py-2.5 flex items-center gap-2 active:bg-slate-50 ${sectionOpen ? '' : 'border-b border-slate-100'}`}
          aria-expanded={sectionOpen}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">{t('sellerDashboard.deadlines.title')}</h3>
              {statsChips}
            </div>
            {!sectionOpen && (
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{collapsedSummary}</p>
            )}
          </div>
          <span
            className={`shrink-0 text-[10px] text-slate-400 transition-transform duration-200 ${sectionOpen ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▼
          </span>
        </button>
      ) : (
        <div className="px-3 py-2.5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">{t('sellerDashboard.deadlines.title')}</h3>
            {statsChips}
          </div>
        </div>
      )}

      {(!compact || sectionOpen) && calendarBody}
    </section>
  );
};

export default SellerDealCalendar;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DealCalendarEvent } from '../../types.js';
import { fetchSellerDealCalendar } from '../../services/dealService.js';

export interface SellerDealCalendarProps {
  compact?: boolean;
  onOpenDeal?: (leadId: string) => void;
}

function statusStyles(status: DealCalendarEvent['status']): string {
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
    const d = new Date(date);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return time ? `${label} · ${time}` : label;
  } catch {
    return date;
  }
}

export const SellerDealCalendar: React.FC<SellerDealCalendarProps> = ({ compact = false, onOpenDeal }) => {
  const [events, setEvents] = useState<DealCalendarEvent[]>([]);
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

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

  const visibleEvents = useMemo(() => {
    const limit = compact ? 4 : 8;
    const sorted = [...events].sort((a, b) => {
      const order = { overdue: 0, today: 1, upcoming: 2, completed: 3 };
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return a.date.localeCompare(b.date);
    });
    return sorted.slice(0, limit);
  }, [compact, events]);

  if (loading) {
    return <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  }

  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Calendar</h3>
        <p className="text-sm text-slate-500 mt-2">No upcoming events. Test drives and RC deadlines appear here.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Calendar</h3>
        <div className="flex items-center gap-2 text-[10px] font-semibold">
          {thisWeekCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {thisWeekCount} this week
            </span>
          )}
          {overdueCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {overdueCount} overdue
            </span>
          )}
        </div>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {visibleEvents.map((evt) => (
          <li key={evt.id}>
            <button
              type="button"
              onClick={() => onOpenDeal?.(evt.dealId)}
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <span className="text-lg shrink-0 mt-0.5">{eventIcon(evt.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{evt.title}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyles(evt.status)}`}>
                    {evt.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{evt.subtitle}</p>
                <p className="text-[10px] font-mono text-reride-orange mt-1">{evt.dealId}</p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">{formatEventDate(evt.date, evt.time)}</span>
            </button>
          </li>
        ))}
      </ul>
      {!compact && events.length > visibleEvents.length && (
        <p className="px-4 py-2 text-xs text-slate-400 text-center">
          +{events.length - visibleEvents.length} more events
        </p>
      )}
    </section>
  );
};

export default SellerDealCalendar;

export type CalendarDayStatus = 'upcoming' | 'today' | 'overdue' | 'completed';

const SELLER_CALENDAR_TZ = 'Asia/Kolkata';

/** Calendar grid keys in IST (YYYY-MM-DD). UTC ISO slice is a day behind for ~5.5h each night. */
export function toCalendarDateKey(date: Date, timeZone = SELLER_CALENDAR_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function calendarDateStatus(eventDate: Date, today: Date): CalendarDayStatus {
  const d = toCalendarDateKey(eventDate);
  const t = toCalendarDateKey(today);
  if (d === t) return 'today';
  if (d < t) return 'overdue';
  return 'upcoming';
}

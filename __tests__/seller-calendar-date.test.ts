import { calendarDateStatus, toCalendarDateKey } from '../server/handlers/deals/calendar-date';

describe('seller calendar IST date keys', () => {
  it('uses Asia/Kolkata calendar day, not UTC ISO slice', () => {
    // 2026-03-15 23:30 UTC = 2026-03-16 05:00 IST
    const lateUtc = new Date('2026-03-15T23:30:00.000Z');
    expect(lateUtc.toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(toCalendarDateKey(lateUtc)).toBe('2026-03-16');
  });

  it('marks overdue/today/upcoming against IST today', () => {
    const today = new Date('2026-03-16T06:00:00.000Z');
    expect(calendarDateStatus(new Date('2026-03-15T12:00:00.000Z'), today)).toBe('overdue');
    expect(calendarDateStatus(new Date('2026-03-16T01:00:00.000Z'), today)).toBe('today');
    expect(calendarDateStatus(new Date('2026-03-17T12:00:00.000Z'), today)).toBe('upcoming');
  });
});

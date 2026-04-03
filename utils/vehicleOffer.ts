import type { Vehicle } from '../types';

function parseYmdLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Custom label, or a readable range from ISO dates (YYYY-MM-DD). */
export function formatOfferDateRangeLabel(v: Vehicle): string {
  const custom = v.offerDateLabel?.trim();
  if (custom) return custom;
  const a = v.offerStartDate?.trim();
  const b = v.offerEndDate?.trim();
  if (!a && !b) return '';
  const da = a ? parseYmdLocal(a) : null;
  const db = b ? parseYmdLocal(b) : null;
  if (da && db) {
    if (startOfDay(da).getTime() === startOfDay(db).getTime()) {
      return da.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    return `${da.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${db.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (da) {
    return `From ${da.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (db) {
    return `Until ${db.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return '';
}

/** True when the seller turned the offer on, added copy, and optional date window includes today. */
export function isSellerListingOfferVisible(v: Vehicle, now = new Date()): boolean {
  if (!v.offerEnabled) return false;
  const hasContent = [v.offerTitle, v.offerDescription, v.offerHighlight].some(
    (s) => s != null && String(s).trim() !== ''
  );
  if (!hasContent) return false;

  const t = startOfDay(now).getTime();
  const start = v.offerStartDate?.trim() ? parseYmdLocal(v.offerStartDate) : null;
  const end = v.offerEndDate?.trim() ? parseYmdLocal(v.offerEndDate) : null;
  if (start && t < startOfDay(start).getTime()) return false;
  if (end && t > endOfDay(end).getTime()) return false;
  return true;
}

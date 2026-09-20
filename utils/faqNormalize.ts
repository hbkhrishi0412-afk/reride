import type { FAQItem } from '../types.js';

/** Map Supabase/API FAQ row (text or numeric id) to FAQItem. */
export function normalizeFaqRow(row: Record<string, unknown>, index = 0): FAQItem {
  const rawId = row.id;
  const id =
    typeof rawId === 'number'
      ? rawId
      : typeof rawId === 'string' && rawId.trim()
        ? rawId.trim()
        : index + 1;
  return {
    id,
    question: String(row.question ?? ''),
    answer: String(row.answer ?? ''),
    category: String(row.category ?? 'General'),
  };
}

export function faqIdQueryParam(id: FAQItem['id']): string {
  return encodeURIComponent(String(id));
}

/** Numeric text ids (1,2,…12) before string ids (faq_…); avoids lexical 1,10,11,12,2. */
export function compareFaqIds(a: FAQItem['id'], b: FAQItem['id']): number {
  const as = String(a);
  const bs = String(b);
  const aNum = /^\d+$/.test(as);
  const bNum = /^\d+$/.test(bs);
  if (aNum && bNum) return Number(as) - Number(bs);
  if (aNum !== bNum) return aNum ? -1 : 1;
  return as.localeCompare(bs);
}

export function sortFaqs<T extends { id: FAQItem['id'] }>(faqs: T[]): T[] {
  return [...faqs].sort((a, b) => compareFaqIds(a.id, b.id));
}

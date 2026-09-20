import { normalizeFaqRow, faqIdQueryParam, sortFaqs } from '../utils/faqNormalize';

describe('faqNormalize', () => {
  it('preserves string ids from Supabase', () => {
    const item = normalizeFaqRow({ id: '12', question: 'Q', answer: 'A', category: 'Safety' });
    expect(item.id).toBe('12');
  });

  it('encodes faq id for API query params', () => {
    expect(faqIdQueryParam('faq_123')).toBe('faq_123');
    expect(faqIdQueryParam(12)).toBe('12');
  });

  it('sorts numeric text ids numerically before string ids', () => {
    const sorted = sortFaqs([
      { id: '10' },
      { id: '2' },
      { id: 'faq_9' },
      { id: '1' },
    ]);
    expect(sorted.map((f) => f.id)).toEqual(['1', '2', '10', 'faq_9']);
  });
});

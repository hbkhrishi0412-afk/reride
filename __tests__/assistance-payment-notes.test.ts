import { assistancePaymentNotesMatchLead } from '../server/handlers/deals/assistance-payment-notes';

describe('assistancePaymentNotesMatchLead', () => {
  const notes = 'Deal assistance payer=a@b.co lead=RR-LD-10 package=doc_review';

  it('matches the exact lead and not a shorter id prefix', () => {
    expect(assistancePaymentNotesMatchLead(notes, 'RR-LD-10')).toBe(true);
    expect(assistancePaymentNotesMatchLead(notes, 'RR-LD-1')).toBe(false);
  });
});

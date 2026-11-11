import { View } from '../types.js';
import { FOOTER_HELP_AND_LEGAL_ITEMS } from '../constants/helpLegalNav.js';
import { DEFAULT_PLATFORM_FAQS } from '../constants/defaultFaqs.js';

describe('web/mobile help & legal parity', () => {
  it('exposes help center plus privacy and terms for footer and mobile menu', () => {
    const views = FOOTER_HELP_AND_LEGAL_ITEMS.map((item) => item.view);
    expect(views).toEqual([
      View.HELP_CENTER,
      View.PRIVACY_POLICY,
      View.TERMS_OF_SERVICE,
    ]);
  });

  it('ships default FAQs so mobile help is not empty when DB has none', () => {
    expect(DEFAULT_PLATFORM_FAQS.length).toBeGreaterThan(0);
  });
});

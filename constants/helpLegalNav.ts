import { View } from '../types.js';

/** Help links shown in header / mobile drawer menus (not privacy or terms). */
export const HELP_NAV_ITEMS = [
  { view: View.HELP_CENTER, labelKey: 'footer.helpCenter', defaultLabel: 'Help center' },
] as const;

/** Privacy & terms — footer only (standard for Indian marketplaces). */
export const FOOTER_LEGAL_LINKS = [
  { view: View.PRIVACY_POLICY, labelKey: 'footer.privacy', defaultLabel: 'Privacy Policy' },
  { view: View.TERMS_OF_SERVICE, labelKey: 'footer.terms', defaultLabel: 'Terms of Service' },
] as const;

/** Full help & legal column in the site footer. */
export const FOOTER_HELP_AND_LEGAL_ITEMS = [...HELP_NAV_ITEMS, ...FOOTER_LEGAL_LINKS] as const;

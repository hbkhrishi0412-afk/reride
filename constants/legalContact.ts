/**
 * Legal / contact strings for Privacy Policy, Grievance Officer, etc.
 * Override via Vite env in production (see .env.example).
 */

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as Record<string, string | undefined>);

export const legalEntityName = (env.VITE_LEGAL_ENTITY_NAME || 'ReRide').trim();

export const registeredAddressIndia = (
  env.VITE_REGISTERED_ADDRESS_INDIA ||
  'India — replace VITE_REGISTERED_ADDRESS_INDIA with your full registered business address.'
).trim();

export const grievanceEmail = (env.VITE_GRIEVANCE_EMAIL || 'grievance@reride.co.in').trim();

export const privacyEmail = (env.VITE_PRIVACY_EMAIL || 'privacy@reride.co.in').trim();

export const supportEmail = (env.VITE_SUPPORT_EMAIL || 'support@reride.co.in').trim();

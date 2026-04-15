/**
 * Support WhatsApp / phone (digits only, country code included, no +).
 * Set `VITE_SUPPORT_WHATSAPP_E164` at build time (e.g. 4471234567890 for UK).
 * If unset, WhatsApp links use `wa.me/?text=…` (no fixed business recipient).
 */
const rawSupport =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_WHATSAPP_E164
    ? String(import.meta.env.VITE_SUPPORT_WHATSAPP_E164)
    : '';
export const PLATFORM_SUPPORT_PHONE_E164 = rawSupport.replace(/\D/g, '');

export function supportTelHref(): string | null {
  return PLATFORM_SUPPORT_PHONE_E164 ? `tel:+${PLATFORM_SUPPORT_PHONE_E164}` : null;
}

/** Human-friendly label for the configured support line (e.g. +91 98765 43210, +44 …). */
export function formatSupportPhoneDisplay(): string {
  const d = PLATFORM_SUPPORT_PHONE_E164;
  if (!d) return '';
  if (d.startsWith('91') && d.length === 12) {
    const n = d.slice(2);
    return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  }
  return `+${d}`;
}

export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function supportWhatsAppHref(message: string): string {
  if (PLATFORM_SUPPORT_PHONE_E164) {
    return `https://wa.me/${PLATFORM_SUPPORT_PHONE_E164}?text=${encodeURIComponent(message)}`;
  }
  return buildWhatsAppShareUrl(message);
}

export type VehicleShareUtm = {
  source?: string;
  medium?: string;
  campaign?: string;
};

/** Listing URL; with `utm`, query is placed before the `#/` hash (hash-router friendly). */
export function getVehicleListingUrl(vehicleId: number, utm?: VehicleShareUtm): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname, hash } = window.location;
  const hashPath = `#/vehicle/${vehicleId}`;
  const baseNoQuery =
    hash.startsWith('#/') ? `${origin}${pathname}${hashPath}` : `${origin}/vehicle/${vehicleId}`;

  if (!utm) {
    return baseNoQuery;
  }

  const params = new URLSearchParams({
    utm_source: utm.source ?? 'share',
    utm_medium: utm.medium ?? 'social',
    utm_campaign: utm.campaign ?? 'listing',
  });
  const qs = params.toString();

  if (hash.startsWith('#/')) {
    return `${origin}${pathname}?${qs}${hashPath}`;
  }

  const sep = baseNoQuery.includes('?') ? '&' : '?';
  return `${baseNoQuery}${sep}${qs}`;
}

export function buildVehicleShareMessage(
  vehicle: { make: string; model: string; year: number; price?: number },
  pageUrl: string,
): string {
  const pricePart =
    vehicle.price != null
      ? ` — ₹${Number(vehicle.price).toLocaleString('en-IN')}`
      : '';
  return `Check out this ${vehicle.make} ${vehicle.model} (${vehicle.year})${pricePart} on ReRide:\n${pageUrl}`;
}

export function buildServiceBookingConfirmationMessage(opts: {
  serviceSummary: string;
  date?: string;
  slot?: string;
  city?: string;
  addressLine?: string;
}): string {
  const lines = [
    `Hi, I booked a car service on ReRide: ${opts.serviceSummary}.`,
    opts.date ? `Date: ${opts.date}` : '',
    opts.slot ? `Slot: ${opts.slot}` : '',
    opts.city ? `City: ${opts.city}` : '',
    opts.addressLine ? `Address: ${opts.addressLine}` : '',
    'Please confirm my slot. Thank you.',
  ].filter(Boolean);
  return lines.join('\n');
}

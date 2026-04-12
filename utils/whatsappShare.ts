/** Platform support WhatsApp (India, without + prefix for wa.me). */
export const PLATFORM_SUPPORT_PHONE_E164 = '917277277275';

export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function supportWhatsAppHref(message: string): string {
  return `https://wa.me/${PLATFORM_SUPPORT_PHONE_E164}?text=${encodeURIComponent(message)}`;
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

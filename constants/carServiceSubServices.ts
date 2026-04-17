// Canonical sub-services per main Car Service.
// Used by:
//  - Service Provider Dashboard: pre-populates the per-sub-service price editor.
//  - Customer Service Cart: lets customers pick the Full Service or individual sub-services.
//  - Service Detail page: lists what's included.
//
// Keep the main service names in sync with `CAR_SERVICE_OPTIONS` in `serviceProviderCatalog.ts`.

export interface SubServiceTemplate {
  /** Stable id derived from the name (slug). */
  id: string;
  /** Human-readable sub-service name (e.g. "Engine oil change"). */
  name: string;
  /** Optional suggested price (₹) that providers can use as a starting point. */
  suggestedPrice?: number;
  /** Optional suggested ETA in minutes. */
  suggestedEtaMinutes?: number;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const mkSub = (name: string, suggestedPrice?: number, suggestedEtaMinutes?: number): SubServiceTemplate => ({
  id: slugify(name),
  name,
  suggestedPrice,
  suggestedEtaMinutes,
});

export const CAR_SERVICE_SUB_SERVICES: Record<string, SubServiceTemplate[]> = {
  'Car Diagnostics': [
    mkSub('Advanced diagnostic scanning', 499, 20),
    mkSub('Engine diagnostics', 399, 20),
    mkSub('Electronics system check', 299, 15),
    mkSub('Battery health analysis', 199, 10),
    mkSub('ABS system inspection', 299, 15),
    mkSub('Complete car health scanning', 599, 30),
    mkSub('Detailed diagnostic report', 149, 10),
    mkSub('Early issue identification', 199, 10),
  ],
  'Engine Maintenance & Repairs': [
    mkSub('Engine oil and filter change', 1499, 45),
    mkSub('Air filter clean', 299, 15),
    mkSub('Fuel filter clean', 399, 20),
    mkSub('Spark plug inspection', 299, 15),
    mkSub('Cooling system check', 399, 20),
    mkSub('Engine performance optimization', 999, 45),
    mkSub('Genuine parts replacement', 0, 30),
    mkSub('Complete engine health check', 799, 30),
  ],
  'Car AC Servicing': [
    mkSub('Refrigerant refill', 899, 30),
    mkSub('Compressor check', 399, 20),
    mkSub('Blower check', 299, 15),
    mkSub('Cabin filter cleaning', 249, 15),
    mkSub('Condenser inspection', 299, 15),
    mkSub('Condenser flushing', 499, 25),
    mkSub('AC system diagnostics', 499, 25),
    mkSub('Cooling efficiency test', 299, 15),
  ],
  'Interior Deep Cleaning': [
    mkSub('Upholstery vacuuming and shampooing', 799, 40),
    mkSub('Dashboard and console sanitisation', 299, 15),
    mkSub('Floor mat and carpet washing', 399, 25),
    mkSub('Roof lining cleaning', 399, 25),
    mkSub('Side panel cleaning', 299, 15),
    mkSub('Complete interior sanitization', 599, 30),
    mkSub('Odor removal', 399, 20),
    mkSub('Leather conditioning (if applicable)', 499, 25),
  ],
  'Wheel Alignment & Balancing': [
    mkSub('Factory-spec wheel alignment', 699, 30),
    mkSub('Digital tyre balancing', 499, 25),
    mkSub('Suspension inspection', 299, 15),
    mkSub('Steering inspection', 299, 15),
    mkSub('Tyre rotation', 249, 15),
    mkSub('Tyre pressure check', 99, 5),
    mkSub('Wheel bearing check', 299, 15),
    mkSub('Complete wheel health assessment', 399, 20),
  ],
  'Periodic Services': [
    mkSub('Engine oil change', 1499, 40),
    mkSub('Oil filter replacement', 399, 15),
    mkSub('Air filter replacement', 299, 15),
    mkSub('Fuel filter replacement', 399, 20),
    mkSub('Coolant top-up', 199, 10),
    mkSub('Brake fluid check', 199, 10),
    mkSub('Power steering fluid check', 199, 10),
    mkSub('25-point safety check', 399, 20),
    mkSub('Battery health check', 199, 10),
    mkSub('Tyre inspection', 149, 10),
  ],
  'Clutch & Suspension': [
    mkSub('Clutch plate replacement', 3999, 180),
    mkSub('Clutch cable adjustment', 499, 30),
    mkSub('Suspension shock absorber replacement', 2999, 120),
    mkSub('Suspension spring check', 399, 20),
    mkSub('Strut replacement', 2499, 120),
    mkSub('Bush replacement', 1499, 90),
    mkSub('Complete suspension overhaul', 4999, 240),
    mkSub('Ride quality optimization', 999, 45),
  ],
  'Denting & Painting': [
    mkSub('Dent removal', 1499, 120),
    mkSub('Panel repair', 2499, 180),
    mkSub('Color matching', 999, 60),
    mkSub('Complete repaint', 9999, 480),
    mkSub('Scratch removal', 799, 45),
    mkSub('Rust treatment', 1499, 90),
    mkSub('Ceramic coating', 4999, 240),
    mkSub('PPF (Paint Protection Film)', 14999, 360),
    mkSub('High-gloss finish', 1999, 90),
  ],
};

/**
 * Returns the canonical sub-services for a given main service (empty array if unknown).
 */
export function getSubServicesFor(mainService: string): SubServiceTemplate[] {
  if (!mainService) return [];
  return CAR_SERVICE_SUB_SERVICES[mainService] || [];
}

/**
 * Returns a stable slug id for a sub-service name, consistent with SubServiceTemplate.id.
 */
export function subServiceIdFromName(name: string): string {
  return slugify(String(name || ''));
}

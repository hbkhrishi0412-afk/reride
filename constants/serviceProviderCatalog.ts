export type ServiceCategory = 'Essential Service' | 'Deep Detailing' | 'Care Plus';

export const SERVICE_CATEGORIES: ServiceCategory[] = ['Essential Service', 'Deep Detailing', 'Care Plus'];

export const SERVICE_CATEGORY_MAP: Record<ServiceCategory, string[]> = {
  'Essential Service': ['Periodic Services', 'Engine Maintenance & Repairs', 'Car Diagnostics'],
  'Deep Detailing': ['Interior Deep Cleaning', 'Denting & Painting'],
  'Care Plus': ['Clutch & Suspension', 'Wheel Alignment & Balancing', 'Car AC Servicing'],
};

/** Short help copy in the provider dashboard: what each high-level category means. */
export const SERVICE_CATEGORY_DESCRIPTIONS: Record<ServiceCategory, string> = {
  'Essential Service':
    'Core mechanical and health checks—routine service, engine work, and scanning. Pick this for general workshop jobs.',
  'Deep Detailing':
    'Cabin and body finish work. Pick this if you do deep interior cleaning, dent repair, or painting.',
  'Care Plus':
    'Driving comfort, drivetrain, and wheels. Pick this for AC, clutch and suspension, and alignment and balancing.',
};

export const SERVICE_OPTIONS = [
  'General',
  'Periodic Service',
  'Engine & Transmission',
  'AC & Cooling',
  'Electrical & Battery',
  'Brakes & Suspension',
  'Body Work & Paint',
  'Tyres & Alignment',
  'Detailing & Cleaning',
];

// Canonical services exposed in the public Car Services catalog.
export const CAR_SERVICE_OPTIONS = [
  'Car Diagnostics',
  'Engine Maintenance & Repairs',
  'Car AC Servicing',
  'Interior Deep Cleaning',
  'Wheel Alignment & Balancing',
  'Periodic Services',
  'Clutch & Suspension',
  'Denting & Painting',
];

export const SERVICE_TEMPLATE_PRESETS: Record<
  string,
  { price: string; etaMinutes: string; description: string }
> = {
  'Car Diagnostics': {
    price: '999',
    etaMinutes: '45',
    description: 'Advanced diagnostics to quickly identify and isolate vehicle issues.',
  },
  'Periodic Services': {
    price: '2499',
    etaMinutes: '120',
    description: 'Engine oil, filter check, fluid top-up, and multi-point inspection.',
  },
  'Engine Maintenance & Repairs': {
    price: '2999',
    etaMinutes: '150',
    description: 'Engine and gearbox diagnosis with recommended repair actions.',
  },
  'Car AC Servicing': {
    price: '1499',
    etaMinutes: '90',
    description: 'AC performance diagnosis, gas check, and cooling system inspection.',
  },
  'Clutch & Suspension': {
    price: '1799',
    etaMinutes: '90',
    description: 'Brake pad, fluid, and suspension health inspection with road test.',
  },
  'Denting & Painting': {
    price: '3999',
    etaMinutes: '240',
    description: 'Panel repair, paint touch-up, and finish quality assessment.',
  },
  'Wheel Alignment & Balancing': {
    price: '1199',
    etaMinutes: '60',
    description: 'Wheel alignment, balancing, and tyre condition report.',
  },
  'Interior Deep Cleaning': {
    price: '1999',
    etaMinutes: '120',
    description: 'Interior and exterior detailing with deep cleaning.',
  },
};

export const DEFAULT_SERVICE_TEMPLATE_NAMES = ['Periodic Services', 'Car AC Servicing', 'Clutch & Suspension'];

export const VALID_SERVICE_CATEGORY_SET = new Set<string>(SERVICE_CATEGORIES);
export const VALID_SERVICE_TYPE_SET = new Set<string>([...SERVICE_OPTIONS, ...CAR_SERVICE_OPTIONS]);

export function sanitizeServiceCategories(input: unknown): ServiceCategory[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input.map((item) => String(item).trim()).filter(Boolean);
  const valid = cleaned.filter((value): value is ServiceCategory => VALID_SERVICE_CATEGORY_SET.has(value));
  return Array.from(new Set(valid));
}

export function isValidServiceType(input: unknown): input is string {
  return typeof input === 'string' && VALID_SERVICE_TYPE_SET.has(input.trim());
}

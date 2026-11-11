/**
 * Fixed-format listing description from overview + vehicle specifications.
 * Omits missing fields so partial data still reads professionally.
 */

export const VEHICLE_DESCRIPTION_MAX_LENGTH = 1000;

export type VehicleDescriptionInput = {
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | string | null;
  registrationYear?: number | string | null;
  mileage?: number | string | null;
  noOfOwners?: number | string | null;
  city?: string | null;
  state?: string | null;
  rto?: string | null;
  price?: number | string | null;
  transmission?: string | null;
  fuelType?: string | null;
  fuelEfficiency?: string | null;
  color?: string | null;
  insuranceType?: string | null;
  insuranceValidity?: string | null;
  features?: string[] | null;
};

function trimStr(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function positiveNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ownerLabel(owners: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = owners % 100;
  const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  return `${owners}${suffix} owner`;
}

function formatKm(km: number): string {
  return `${km.toLocaleString('en-IN')} km`;
}

function formatPrice(price: number): string {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} Lakh`;
  return `₹${price.toLocaleString('en-IN')}`;
}

function pushLine(lines: string[], label: string, value: string) {
  if (value) lines.push(`${label}: ${value}`);
}

/**
 * Builds a professional, fixed-format vehicle description.
 * Returns '' only when there is nothing useful to say (no make/model/year).
 */
export function buildVehicleDescription(
  input: VehicleDescriptionInput,
  maxLength: number = VEHICLE_DESCRIPTION_MAX_LENGTH,
): string {
  const make = trimStr(input.make);
  const model = trimStr(input.model);
  const variant = trimStr(input.variant);
  const year = positiveNumber(input.year);

  const titleParts = [year ? String(year) : '', make, model, variant].filter(Boolean);
  if (titleParts.length === 0) return '';

  const overview: string[] = [];
  if (year) pushLine(overview, 'Make year', String(year));
  const regYear = positiveNumber(input.registrationYear);
  if (regYear) pushLine(overview, 'Registration year', String(regYear));

  const mileage = positiveNumber(input.mileage);
  // 0 km is valid (brand-new / barely driven) — show when provided and >= 0
  const mileageRaw = input.mileage;
  if (mileage !== null) {
    pushLine(overview, 'Km driven', formatKm(mileage));
  } else if (mileageRaw !== undefined && mileageRaw !== null && mileageRaw !== '') {
    const n = typeof mileageRaw === 'number' ? mileageRaw : Number(String(mileageRaw).replace(/,/g, ''));
    if (Number.isFinite(n) && n === 0) pushLine(overview, 'Km driven', formatKm(0));
  }

  const owners = positiveNumber(input.noOfOwners);
  if (owners !== null) pushLine(overview, 'Ownership', ownerLabel(owners));

  const city = trimStr(input.city);
  const state = trimStr(input.state).toUpperCase();
  const location = [city, state].filter(Boolean).join(', ');
  if (location) pushLine(overview, 'Location', location);

  const rto = trimStr(input.rto).toUpperCase();
  if (rto) pushLine(overview, 'RTO', rto);

  const price = positiveNumber(input.price);
  if (price !== null) pushLine(overview, 'Asking price', formatPrice(price));

  const specs: string[] = [];
  const fuelType = trimStr(input.fuelType);
  if (fuelType) pushLine(specs, 'Fuel type', fuelType);
  const transmission = trimStr(input.transmission);
  if (transmission) pushLine(specs, 'Transmission', transmission);
  const efficiency = trimStr(input.fuelEfficiency);
  if (efficiency) pushLine(specs, 'Mileage / range', efficiency);
  const color = trimStr(input.color);
  if (color) pushLine(specs, 'Color', color);

  const insuranceType = trimStr(input.insuranceType);
  const insuranceValidity = trimStr(input.insuranceValidity);
  if (insuranceType || insuranceValidity) {
    const insurance =
      insuranceType && insuranceValidity
        ? `${insuranceType} (valid till ${insuranceValidity})`
        : insuranceType || `Valid till ${insuranceValidity}`;
    pushLine(specs, 'Insurance', insurance);
  }

  const features = (input.features || []).map((f) => trimStr(f)).filter(Boolean);
  const closing =
    'Professionally listed with clear ownership and specification details. Contact the seller for inspection and paperwork.';

  const assemble = (includeFeatures: boolean, includeClosing: boolean) => {
    const parts: string[] = [titleParts.join(' ')];
    if (overview.length) parts.push(['OVERVIEW', ...overview.map((l) => `• ${l}`)].join('\n'));
    if (specs.length) parts.push(['SPECIFICATIONS', ...specs.map((l) => `• ${l}`)].join('\n'));
    if (includeFeatures && features.length) {
      parts.push(['KEY FEATURES', ...features.map((f) => `• ${f}`)].join('\n'));
    }
    if (includeClosing) parts.push(closing);
    return parts.join('\n\n');
  };

  let text = assemble(true, true);
  if (text.length <= maxLength) return text;
  text = assemble(false, true);
  if (text.length <= maxLength) return text;
  text = assemble(false, false);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + '…';
}

/** Known section titles emitted by {@link buildVehicleDescription}. */
export const VEHICLE_DESCRIPTION_SECTION_HEADINGS = [
  'OVERVIEW',
  'SPECIFICATIONS',
  'KEY FEATURES',
] as const;

export type VehicleDescriptionSection = {
  heading: string;
  bullets: string[];
};

export type ParsedVehicleDescription = {
  title: string;
  sections: VehicleDescriptionSection[];
  paragraphs: string[];
};

/**
 * Re-insert line breaks when an auto description was flattened to one line
 * (e.g. older storage / CSS collapse copies). Safe no-op for already-structured text.
 */
export function normalizeVehicleDescription(text: string): string {
  const raw = (text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '';
  if (raw.includes('\n')) return raw;

  const headingAlt = VEHICLE_DESCRIPTION_SECTION_HEADINGS.join('|');
  return raw
    .replace(new RegExp(`\\s+(${headingAlt})\\s+`, 'g'), '\n\n$1\n')
    .replace(/\s+•\s+/g, '\n• ')
    .replace(/\s+(Professionally listed)/, '\n\n$1')
    .trim();
}

/**
 * Parse auto (or seller) description into title + sections + free paragraphs
 * for organized display on desktop and mobile.
 */
export function parseVehicleDescription(text: string): ParsedVehicleDescription {
  const normalized = normalizeVehicleDescription(text);
  if (!normalized) return { title: '', sections: [], paragraphs: [] };

  const headingSet = new Set<string>(VEHICLE_DESCRIPTION_SECTION_HEADINGS);
  const blocks = normalized.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  let title = '';
  const sections: VehicleDescriptionSection[] = [];
  const paragraphs: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const first = lines[0];
    const firstUpper = first.toUpperCase();
    if (headingSet.has(firstUpper) || headingSet.has(first)) {
      const heading = headingSet.has(firstUpper) ? firstUpper : first;
      const bullets = lines.slice(1).map((l) => l.replace(/^•\s*/, '').trim()).filter(Boolean);
      sections.push({ heading, bullets });
      continue;
    }

    // Title line alone (year make model…) before first section
    if (!title && sections.length === 0 && paragraphs.length === 0 && lines.length === 1) {
      title = first;
      continue;
    }

    paragraphs.push(lines.join('\n'));
  }

  // Flattened single-block freeform with no recoverable sections
  if (!title && sections.length === 0 && paragraphs.length === 0) {
    paragraphs.push(normalized);
  }

  return { title, sections, paragraphs };
}

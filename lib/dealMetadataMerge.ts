import type { DealLeadMetadata } from '../types.js';

const METADATA_NESTED_KEYS = [
  'testDrive',
  'token',
  'delivery',
  'documents',
  'rc',
  'inspection',
  'assistancePayment',
  'assistanceFulfillment',
] as const;

/** Shallow top-level merge with one-level deep merge for known nested deal objects. */
export function mergeDealMetadata(
  existing: DealLeadMetadata | null | undefined,
  patch: Partial<DealLeadMetadata>,
): DealLeadMetadata {
  const base = { ...(existing || {}) } as DealLeadMetadata;
  const out: DealLeadMetadata = { ...base, ...patch };
  for (const key of METADATA_NESTED_KEYS) {
    const prev = base[key];
    const next = patch[key];
    if (next && typeof next === 'object' && prev && typeof prev === 'object') {
      (out as Record<string, unknown>)[key] = { ...prev, ...next };
    }
  }
  return out;
}

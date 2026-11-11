/**
 * Buyer-facing insurance label for vehicle detail "at a glance".
 * Returns null when the caller should fall back to a localized "not specified".
 */
export function formatInsuranceValidity(
  insurance: string | null | undefined,
  vehicleYear?: number | null,
): string | null {
  const raw = (insurance || '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const insuranceDate = new Date(raw);
    if (Number.isNaN(insuranceDate.getTime())) return raw;
    if (vehicleYear && insuranceDate.getFullYear() < vehicleYear) {
      return '__INVALID_DATE__';
    }
    return insuranceDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return raw;
}

export const INSURANCE_INVALID_DATE_TOKEN = '__INVALID_DATE__';

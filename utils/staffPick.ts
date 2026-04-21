/**
 * Admin "Recommended" / website staff-pick ribbon — same semantics as API `normalizeUser`.
 * Prevents truthy string bugs (e.g. metadata `"false"` must not enable the badge).
 */
export function isRerideStaffPick(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

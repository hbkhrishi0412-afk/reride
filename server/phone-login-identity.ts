/** Digits only, so +91 98765-43210 and 919876543210 share one phone identity. */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function syntheticPhoneEmail(phone: string): string {
  return `${phoneDigits(phone)}@phone.reride.co.in`;
}

/** Last 10 digits, used to find an email account that stored the same mobile. */
export function phoneMatchTail(phone: string): string {
  const digits = phoneDigits(phone);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Normalize India phone input to E.164 (+91XXXXXXXXXX).
 * Do not strip a leading "91" from a bare 10-digit local number (9123456789 is a valid mobile).
 */
export function toE164IndianPhone(phone: string): string | null {
  const trimmed = String(phone || '').trim();
  if (!trimmed) return null;
  const digits = phoneDigits(trimmed);
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (trimmed.startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

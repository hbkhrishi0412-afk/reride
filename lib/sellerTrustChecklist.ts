import type { User } from '../types.js';

export type TrustChecklistItemKey = 'phone' | 'email' | 'id';

export interface TrustChecklistItem {
  key: TrustChecklistItemKey;
  label: string;
  verified: boolean;
}

/**
 * Phone, email, and government ID flags shown on seller profiles.
 * Separated from `isUserVerified` so we can detect legacy `isVerified` without granular flags.
 */
export function getSellerTrustChecklistItems(user: User | null | undefined): TrustChecklistItem[] {
  if (!user) {
    return [
      { key: 'phone', label: 'Phone', verified: false },
      { key: 'email', label: 'Email', verified: false },
      { key: 'id', label: 'Government ID', verified: false },
    ];
  }
  return [
    {
      key: 'phone',
      label: 'Phone',
      verified: Boolean(user.verificationStatus?.phoneVerified || user.phoneVerified),
    },
    {
      key: 'email',
      label: 'Email',
      verified: Boolean(user.verificationStatus?.emailVerified || user.emailVerified),
    },
    {
      key: 'id',
      label: 'Government ID',
      verified: Boolean(user.verificationStatus?.govtIdVerified || user.govtIdVerified),
    },
  ];
}

export function getSellerTrustChecklistSummary(user: User | null | undefined) {
  const items = getSellerTrustChecklistItems(user);
  const verifiedCount = items.filter((i) => i.verified).length;
  const total = items.length;
  const pct = total ? Math.round((verifiedCount / total) * 100) : 0;
  /** `isVerified` set without any checklist flags — avoids "Verified" + 0% UI clash */
  const isPlatformVerifiedOnly =
    Boolean(user?.isVerified) && verifiedCount === 0;

  return { items, verifiedCount, total, pct, isPlatformVerifiedOnly };
}

/**
 * Verification badge for vehicle listing: certified inspection, accident-free, single owner, etc.
 */

import React from 'react';
import type { Vehicle } from '../types';

interface VerificationBadgeProps {
  vehicle: Vehicle;
  className?: string;
}

export default function VerificationBadge({ vehicle, className = '' }: VerificationBadgeProps) {
  const badges: { label: string; title: string }[] = [];

  if (vehicle.certificationStatus === 'certified' && vehicle.certifiedInspection) {
    badges.push({ label: 'Certified inspection', title: vehicle.certifiedInspection.summary });
  }
  if (vehicle.accidentHistory?.length === 0 || (vehicle.accidentHistory && vehicle.accidentHistory.every(a => a.severity === 'Minor'))) {
    badges.push({ label: 'Accident free', title: 'No major accidents reported' });
  }
  if (vehicle.noOfOwners === 1) {
    badges.push({ label: 'Single owner', title: 'First owner only' });
  }
  if (vehicle.documents && vehicle.documents.length > 0) {
    const hasRc = vehicle.documents.some(d => d.name && d.name.includes('RC'));
    if (hasRc) badges.push({ label: 'RC available', title: 'Registration certificate verified' });
  }

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges.map((b) => (
        <span
          key={b.label}
          title={b.title}
          className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
        >
          <span className="mr-1" aria-hidden>✓</span>
          {b.label}
        </span>
      ))}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import type { User, TrustScore } from '../types';

interface TrustBadgeDisplayProps {
  user: User;
  showDetails?: boolean;
}

const TrustBadgeDisplay: React.FC<TrustBadgeDisplayProps> = ({ user, showDetails = false }) => {
  const [trustScore, setTrustScore] = useState<number>(user.trustScore || 0);

  useEffect(() => {
    // Calculate trust score if not available
    if (user.trustScore === undefined) {
      let score = 0;
      
      // Verification
      const verificationStatus = user.verificationStatus;
      if (verificationStatus) {
        if (verificationStatus.phoneVerified) score += 10;
        if (verificationStatus.emailVerified) score += 10;
        if (verificationStatus.govtIdVerified) score += 10;
      }
      
      // Response rate
      if (user.responseRate) {
        score += (user.responseRate / 100) * 25;
      }
      
      // Ratings
      if (user.averageRating && user.ratingCount) {
        score += (user.averageRating / 5) * 20;
      }
      
      // Account age
      if (user.createdAt) {
        const days = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        score += Math.min((days / 30), 15);
      }
      
      // Sold listings
      if (user.soldListings) {
        score += Math.min(user.soldListings, 10);
      }
      
      setTrustScore(Math.min(Math.round(score), 100));
    }
  }, [user]);

  const getBadgeInfo = () => {
    if (trustScore >= 90) {
      return { label: 'Highly Trusted', color: '#10B981', bgColor: '#D1FAE5', icon: '✓✓✓' };
    } else if (trustScore >= 70) {
      return { label: 'Trusted', color: '#3B82F6', bgColor: '#DBEAFE', icon: '✓✓' };
    } else if (trustScore >= 50) {
      return { label: 'Verified', color: '#F59E0B', bgColor: '#FEF3C7', icon: '✓' };
    } else {
      return { label: 'New Seller', color: '#6B7280', bgColor: '#F3F4F6', icon: '○' };
    }
  };

  const badge = getBadgeInfo();

  return (
    <div className="inline-block">
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ backgroundColor: badge.bgColor, color: badge.color }}
      >
        <span className="text-sm font-semibold">{badge.icon}</span>
        <span className="text-sm font-semibold">{badge.label}</span>
        <span className="text-xs font-medium ml-1">({trustScore})</span>
      </div>
    </div>
  );
};

export default TrustBadgeDisplay;


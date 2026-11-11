import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle, User } from '../types.js';
import { getFollowersCount, getFollowingCount } from '../services/buyerEngagementService.js';

interface SellerContactCardProps {
  vehicle: Vehicle;
  seller: User;
  currentUser?: User | null;
  onPhoneView?: (vehicleId: number) => void;
  onStartChat: () => void;
  onLoginRequired?: () => void;
}

const SellerContactCard: React.FC<SellerContactCardProps> = ({
  vehicle,
  seller,
  onStartChat,
}) => {
  const { t } = useTranslation();

  const responseTime = seller.responseTime
    ? seller.responseTime < 60
      ? `${seller.responseTime} mins`
      : `${Math.round(seller.responseTime / 60)} hours`
    : 'N/A';

  const getDaysActive = () => {
    if (vehicle.createdAt) {
      const created = new Date(vehicle.createdAt);
      const now = new Date();
      return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }
    return vehicle.daysActive || 0;
  };

  const daysActive = getDaysActive();

  return (
    <div className="bg-white dark:bg-brand-gray-800 rounded-xl shadow-soft-lg p-6 sticky top-24">
      <div className="mb-6">
        <p className="text-4xl font-extrabold text-reride-orange mb-2">
          ₹{vehicle.price.toLocaleString('en-IN')}
        </p>
        <div className="flex flex-wrap gap-2">
          {vehicle.isBestPrice && (
            <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              💰 Best Price
            </span>
          )}
          {vehicle.isUrgentSale && (
            <span className="inline-block bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              🔥 Urgent Sale
            </span>
          )}
          {vehicle.isPremiumListing && (
            <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              ⭐ Premium
            </span>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Posted {daysActive === 0 ? 'today' : `${daysActive} ${daysActive === 1 ? 'day' : 'days'} ago`}
      </div>

      <div className="mb-6 pb-6 border-b border-gray-200">
        <div className="flex items-start gap-3 mb-4">
          {seller.avatarUrl ? (
            <img
              src={seller.avatarUrl}
              alt={seller.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-reride-orange text-white flex items-center justify-center text-lg font-bold">
              {seller.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-bold text-reride-text-dark dark:text-reride-text">
              {seller.dealershipName || seller.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {seller.isVerified && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Verified seller
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Response Time</p>
            <p className="font-semibold text-reride-text-dark dark:text-reride-text">{responseTime}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Response Rate</p>
            <p className="font-semibold text-reride-text-dark dark:text-reride-text">
              {seller.responseRate ? `${seller.responseRate}%` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Followers</p>
            <p className="font-semibold text-reride-text-dark dark:text-reride-text">
              {getFollowersCount(seller.email)}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">{t('vehicle.detail.following')}</p>
            <p className="font-semibold text-reride-text-dark dark:text-reride-text">
              {getFollowingCount(seller.email)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={onStartChat}
          className="w-full btn-brand-primary text-white font-bold py-3 px-6 rounded-lg text-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {t('vehicle.detail.chatWithSeller')}
        </button>

      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <p>
            <strong>{t('vehicle.detail.safetyTip.title')}</strong>{' '}
            ReRide is a classifieds marketplace — meet safely in public, verify documents, and never pay
            advance without a written agreement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SellerContactCard;

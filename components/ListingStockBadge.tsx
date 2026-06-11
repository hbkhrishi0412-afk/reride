import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types.js';
import { getListingStockStatus } from '../utils/listingStock.js';

const TONE: Record<string, string> = {
  in_stock: 'bg-emerald-600 text-white',
  sold: 'bg-gray-700 text-white',
  unavailable: 'bg-amber-600 text-white',
};

interface ListingStockBadgeProps {
  vehicle: Vehicle;
  className?: string;
  size?: 'sm' | 'md';
  /** When true, omits the badge for published (in-stock) listings — used on browse cards. */
  hideInStock?: boolean;
}

export const ListingStockBadge: React.FC<ListingStockBadgeProps> = ({
  vehicle,
  className = '',
  size = 'sm',
  hideInStock = false,
}) => {
  const { t } = useTranslation();
  const status = getListingStockStatus(vehicle);
  if (hideInStock && status === 'in_stock') return null;
  const sizeClass = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  const label =
    status === 'in_stock'
      ? t('stock.inStock', { defaultValue: 'In stock' })
      : status === 'sold'
        ? t('stock.sold', { defaultValue: 'Sold' })
        : t('stock.unavailable', { defaultValue: 'Unavailable' });

  return (
    <span
      data-testid="listing-stock-badge"
      data-stock-status={status}
      className={`inline-flex items-center rounded-full font-bold shadow-sm backdrop-blur-sm ${sizeClass} ${TONE[status]} ${className}`}
    >
      {label}
    </span>
  );
};

export default ListingStockBadge;

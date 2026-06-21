import React, { memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { Vehicle } from '../types';
import VehicleCard from './VehicleCard';
import { isCompareDisabledForVehicle } from '../utils/compareList.js';

interface VirtualizedVehicleListProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleCompare: (vehicleId: number) => void;
  onToggleWishlist: (vehicleId: number) => void;
  comparisonList: number[];
  comparisonCategory?: string | null;
  wishlist: number[];
  onViewSellerProfile: (sellerEmail: string) => void;
  height?: number;
  itemHeight?: number;
}

interface VehicleRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    vehicles: Vehicle[];
    onSelectVehicle: (vehicle: Vehicle) => void;
    onToggleCompare: (vehicleId: number) => void;
    onToggleWishlist: (vehicleId: number) => void;
    comparisonList: number[];
    comparisonCategory?: string | null;
    wishlist: number[];
    onViewSellerProfile: (sellerEmail: string) => void;
  };
}

const VehicleRow = memo<VehicleRowProps>(({ index, style, data }) => {
  const {
    vehicles,
    onSelectVehicle,
    onToggleCompare,
    onToggleWishlist,
    comparisonList,
    comparisonCategory = null,
    wishlist,
    onViewSellerProfile
  } = data;

  const vehicle = vehicles[index];

  const rowStyle = style ?? {};

  if (!vehicle) {
    return <div style={rowStyle} />;
  }

  return (
    <div style={rowStyle} className="px-4 py-2">
      <VehicleCard
        vehicle={vehicle}
        onSelect={() => onSelectVehicle(vehicle)}
        onToggleCompare={() => onToggleCompare(vehicle.id)}
        onToggleWishlist={() => onToggleWishlist(vehicle.id)}
        isSelectedForCompare={comparisonList.includes(vehicle.id)}
        isInWishlist={wishlist.includes(vehicle.id)}
        isCompareDisabled={isCompareDisabledForVehicle(vehicle, comparisonList, data.comparisonCategory ?? null)}
        onViewSellerProfile={onViewSellerProfile}
      />
    </div>
  );
});

VehicleRow.displayName = 'VehicleRow';

const VirtualizedVehicleList: React.FC<VirtualizedVehicleListProps> = ({
  vehicles,
  onSelectVehicle,
  onToggleCompare,
  onToggleWishlist,
  comparisonList,
  comparisonCategory = null,
  wishlist,
  onViewSellerProfile,
  height = 600,
  itemHeight = 280
}) => {
  const itemData = {
    vehicles,
    onSelectVehicle,
    onToggleCompare,
    onToggleWishlist,
    comparisonList,
    comparisonCategory,
    wishlist,
    onViewSellerProfile
  };

  if (vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No vehicles found</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <List
        height={height}
        width="100%"
        itemCount={vehicles.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={5} // Render 5 extra items for smooth scrolling
      >
        {VehicleRow}
      </List>
    </div>
  );
};

export default VirtualizedVehicleList;

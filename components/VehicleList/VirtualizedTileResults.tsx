import React, { memo, useMemo } from 'react';
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';
import type { Vehicle } from '../../types';
import VehicleTile from '../VehicleTile';

const TILE_ROW_HEIGHT = 148;
const MAX_LIST_HEIGHT = 720;

interface VirtualizedTileResultsProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleCompare: (id: number) => void;
  onToggleWishlist: (id: number) => void;
  comparisonList: number[];
  wishlist: number[];
  onViewSellerProfile: (sellerEmail: string) => void;
}

type TileRowData = {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleCompare: (id: number) => void;
  onToggleWishlist: (id: number) => void;
  comparisonList: number[];
  wishlist: number[];
  onViewSellerProfile: (sellerEmail: string) => void;
};

const TileRow = memo(({ index, style, data }: ListChildComponentProps<TileRowData>) => {
  const vehicle = data.vehicles[index];
  if (!vehicle) {
    return <div style={style} />;
  }

  return (
    <div style={style} className="pb-3">
      <VehicleTile
        vehicle={vehicle}
        onSelect={data.onSelectVehicle}
        onToggleCompare={data.onToggleCompare}
        isSelectedForCompare={data.comparisonList.includes(vehicle.id)}
        onToggleWishlist={data.onToggleWishlist}
        isInWishlist={data.wishlist.includes(vehicle.id)}
        isCompareDisabled={!data.comparisonList.includes(vehicle.id) && data.comparisonList.length >= 4}
        onViewSellerProfile={data.onViewSellerProfile}
      />
    </div>
  );
});

TileRow.displayName = 'VirtualizedTileRow';

const VirtualizedTileResults: React.FC<VirtualizedTileResultsProps> = ({
  vehicles,
  onSelectVehicle,
  onToggleCompare,
  onToggleWishlist,
  comparisonList,
  wishlist,
  onViewSellerProfile,
}) => {
  const itemData = useMemo(
    () => ({
      vehicles,
      onSelectVehicle,
      onToggleCompare,
      onToggleWishlist,
      comparisonList,
      wishlist,
      onViewSellerProfile,
    }),
    [
      vehicles,
      onSelectVehicle,
      onToggleCompare,
      onToggleWishlist,
      comparisonList,
      wishlist,
      onViewSellerProfile,
    ],
  );

  const listHeight = Math.min(MAX_LIST_HEIGHT, vehicles.length * TILE_ROW_HEIGHT);

  return (
    <List
      height={listHeight}
      width="100%"
      itemCount={vehicles.length}
      itemSize={TILE_ROW_HEIGHT}
      itemData={itemData}
      overscanCount={4}
    >
      {TileRow}
    </List>
  );
};

export default VirtualizedTileResults;

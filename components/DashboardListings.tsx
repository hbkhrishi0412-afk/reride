import React, { memo, useState } from 'react';
import type { Vehicle } from '../types';
import VehicleCard from './VehicleCard';
import VirtualizedVehicleList from './VirtualizedVehicleList';
import BulkUploadModal from './BulkUploadModal';
import DashboardQuickAction from './DashboardQuickAction';

interface DashboardListingsProps {
  sellerVehicles: Vehicle[];
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: number) => void;
  onMarkAsSold: (vehicleId: number) => void;
  onFeatureListing: (vehicleId: number) => void;
  onRequestCertification: (vehicleId: number) => void;
  onViewSellerProfile: (sellerEmail: string) => void;
  comparisonList: number[];
  onToggleCompare: (vehicleId: number) => void;
  wishlist: number[];
  onToggleWishlist: (vehicleId: number) => void;
  // New props for Quick Actions
  onNavigateToAnalytics?: () => void;
  onBulkUpload?: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => void;
  sellerEmail?: string;
  // New prop for viewing vehicle details
  onViewVehicle?: (vehicle: Vehicle) => void;
}

const DashboardListings: React.FC<DashboardListingsProps> = memo(({
  sellerVehicles,
  onEditVehicle,
  onDeleteVehicle,
  onMarkAsSold,
  onFeatureListing,
  onRequestCertification,
  onViewSellerProfile,
  comparisonList,
  onToggleCompare,
  wishlist,
  onToggleWishlist,
  onNavigateToAnalytics,
  onBulkUpload,
  sellerEmail,
  onViewVehicle
}) => {
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  // Safety check
  const safeSellerVehicles = sellerVehicles || [];
  const activeVehicles = safeSellerVehicles.filter(v => v && v.status === 'published');
  const soldVehicles = safeSellerVehicles.filter(v => v && v.status === 'sold');

  // Export to CSV functionality
  const handleExportData = () => {
    try {
      // Prepare CSV headers
      const headers = [
        'Make', 'Model', 'Variant', 'Year', 'Price', 'Mileage', 'Fuel Type',
        'Transmission', 'Color', 'City', 'State', 'Status', 'Featured',
        'Views', 'Inquiries', 'Created At'
      ];
      
      // Convert vehicles to CSV rows
      const csvRows = safeSellerVehicles.map(vehicle => [
        vehicle.make || '',
        vehicle.model || '',
        vehicle.variant || '',
        vehicle.year?.toString() || '',
        vehicle.price?.toString() || '',
        vehicle.mileage?.toString() || '',
        vehicle.fuelType || '',
        vehicle.transmission || '',
        vehicle.color || '',
        vehicle.city || '',
        vehicle.state || '',
        vehicle.status || '',
        vehicle.isFeatured ? 'Yes' : 'No',
        vehicle.views?.toString() || '0',
        vehicle.inquiriesCount?.toString() || '0',
        vehicle.createdAt ? new Date(vehicle.createdAt).toLocaleDateString() : ''
      ]);
      
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `vehicles_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Show success message (you can use a toast here if available)
      console.log(`✅ Exported ${safeSellerVehicles.length} vehicles successfully`);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleBulkUpload = (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => {
    if (onBulkUpload) {
      onBulkUpload(vehicles);
      setIsBulkUploadOpen(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Active Listings */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">
              Active Listings ({activeVehicles.length})
            </h2>
          </div>
          
          {activeVehicles.length > 0 ? (
            <VirtualizedVehicleList
              vehicles={activeVehicles}
              onSelectVehicle={onViewVehicle || onEditVehicle}
              onToggleCompare={onToggleCompare}
              onToggleWishlist={onToggleWishlist}
              comparisonList={comparisonList}
              wishlist={wishlist}
              onViewSellerProfile={onViewSellerProfile}
              height={400}
              itemHeight={200}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No active listings found.</p>
            </div>
          )}
        </div>

        {/* Sold Vehicles */}
        {soldVehicles.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">
              Sold Vehicles ({soldVehicles.length})
            </h2>
            <VirtualizedVehicleList
              vehicles={soldVehicles}
              onSelectVehicle={onViewVehicle || onEditVehicle}
              onToggleCompare={onToggleCompare}
              onToggleWishlist={onToggleWishlist}
              comparisonList={comparisonList}
              wishlist={wishlist}
              onViewSellerProfile={onViewSellerProfile}
              height={300}
              itemHeight={200}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Add Vehicle',
                icon: (
                  <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                ),
                onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onEditVehicle) {
                    onEditVehicle({} as Vehicle);
                  }
                },
              },
              {
                label: 'Bulk Upload',
                icon: (
                  <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                ),
                onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onBulkUpload && sellerEmail) {
                    setIsBulkUploadOpen(true);
                  } else {
                    alert('Bulk upload is not available. Please ensure you are logged in.');
                  }
                },
              },
              {
                label: 'Analytics',
                icon: (
                  <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onNavigateToAnalytics) {
                    onNavigateToAnalytics();
                  } else {
                    console.log('Analytics navigation not available');
                  }
                },
              },
              {
                label: 'Export',
                icon: (
                  <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleExportData();
                },
              },
            ].map((action) => (
              <DashboardQuickAction key={action.label} label={action.label} icon={action.icon} onClick={action.onClick} />
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {isBulkUploadOpen && sellerEmail && onBulkUpload && (
        <BulkUploadModal
          onClose={() => setIsBulkUploadOpen(false)}
          onAddMultipleVehicles={handleBulkUpload}
          sellerEmail={sellerEmail}
        />
      )}
    </>
  );
});

DashboardListings.displayName = 'DashboardListings';

export default DashboardListings;

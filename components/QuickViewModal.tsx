import React, { useState, useEffect, memo } from 'react';
import type { Vehicle } from '../types';
import { getFirstValidImage, getValidImages, getSafeImageSrc } from '../utils/imageUtils';

// KeySpec component copied for reuse
const KeySpec: React.FC<{ label: string; value: string | number; }> = memo(({ label, value }) => (
    <div className="flex justify-between items-baseline py-2 border-b border-gray-200-100 dark:border-gray-200-200">
        <span className="text-sm font-medium text-brand-gray-600 dark:text-reride-text">{label}</span>
        <span className="font-bold text-reride-text-dark dark:text-reride-text-dark text-right">{value}</span>
    </div>
));

interface QuickViewModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleCompare: (id: number) => void;
  onToggleWishlist: (id: number) => void;
  comparisonList: number[];
  wishlist: number[];
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({ vehicle, onClose, onSelectVehicle, onToggleCompare, onToggleWishlist, comparisonList, wishlist }) => {
  const [mainImage, setMainImage] = useState(() => vehicle ? getFirstValidImage(vehicle.images, vehicle.id) : '');

  useEffect(() => {
    if (vehicle) {
      setMainImage(getFirstValidImage(vehicle.images, vehicle.id));
    } else {
      setMainImage('');
    }
  }, [vehicle]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!vehicle) {
    return null;
  }

  console.log('🔍 QuickViewModal rendering for vehicle:', vehicle.id, vehicle.make, vehicle.model);
  console.log('🔍 Vehicle data:', {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    price: vehicle.price,
    images: vehicle.images,
    imagesLength: vehicle.images?.length
  });

  const isComparing = comparisonList.includes(vehicle.id);
  const isInWishlist = wishlist.includes(vehicle.id);
  const isCompareDisabled = !isComparing && comparisonList.length >= 4;

  const handleFullDetailsClick = () => {
    console.log('🔧 QuickViewModal: View Full Details clicked for vehicle:', vehicle.id, vehicle.make, vehicle.model);
    
    // Store vehicle in sessionStorage as backup to prevent state loss
    try {
      sessionStorage.setItem('selectedVehicle', JSON.stringify(vehicle));
      console.log('🔧 QuickViewModal: Vehicle stored in sessionStorage as backup');
    } catch (error) {
      console.warn('🔧 QuickViewModal: Failed to store vehicle in sessionStorage:', error);
    }
    
    // Call onSelectVehicle to set the state and navigate to DETAIL view
    onSelectVehicle(vehicle);
    
    // Close modal after setting state and triggering navigation
    console.log('🔧 QuickViewModal: Closing modal after state commit and navigation');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 bg-white/80 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center hover:bg-white hover:shadow-lg z-10 text-xl transition-all duration-300 transform hover:scale-110">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Premium Image Section */}
        <div className="w-full md:w-1/2 p-6 flex flex-col">
          <div className="relative overflow-hidden rounded-2xl mb-4">
            <img src={getSafeImageSrc(mainImage)} alt={`${vehicle.make || 'Vehicle'} ${vehicle.model || ''}`} className="w-full h-64 md:h-80 object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-2xl"></div>
          </div>
          {vehicle.images && vehicle.images.length > 1 && (
            <div className="grid grid-cols-5 gap-3">
              {getValidImages(vehicle.images, vehicle.id).slice(0, 5).map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Thumbnail ${index + 1}`}
                  className={`cursor-pointer rounded-xl border-2 h-16 w-full object-cover transition-all duration-300 hover:scale-105 ${
                    mainImage === img 
                      ? 'border-blue-500 shadow-lg' 
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => setMainImage(img)}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Premium Details Section */}
        <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-black bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-2">
              {vehicle.year || 'N/A'} {vehicle.make || 'Vehicle'} {vehicle.model || ''}
            </h2>
            <p className="text-lg text-gray-600 font-medium">{vehicle.variant || 'Standard'}</p>
            <div className="mt-4">
              <span className="text-4xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ₹{(vehicle.price / 100000).toFixed(2)} Lakh
              </span>
              <p className="text-sm text-gray-500 mt-1">EMI from ₹{(vehicle.price / 60 / 1000).toFixed(1)}k/month</p>
            </div>
          </div>

          <div className="space-y-2 my-4">
            <KeySpec label="Mileage" value={`${vehicle.mileage ? vehicle.mileage.toLocaleString('en-IN') : 'N/A'} kms`} />
            <KeySpec label="Fuel Type" value={vehicle.fuelType || 'N/A'} />
            <KeySpec label="Transmission" value={vehicle.transmission || 'N/A'} />
            <KeySpec label="Registration Year" value={vehicle.registrationYear || 'N/A'} />
            <KeySpec label="No. of Owners" value={vehicle.noOfOwners || 'N/A'} />
          </div>

          <div className="mt-auto pt-6 space-y-3">
             <button onClick={handleFullDetailsClick} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg">
                View Full Details
            </button>
            <div className="flex gap-3">
                <button
                    onClick={() => onToggleWishlist(vehicle.id)}
                    className={`w-full font-bold py-3 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 ${
                      isInWishlist 
                        ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white hover:shadow-lg' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                    {isInWishlist ? 'In Wishlist' : 'Add to Wishlist'}
                </button>
                 <button
                    onClick={() => onToggleCompare(vehicle.id)}
                    disabled={isCompareDisabled}
                    className={`w-full font-bold py-3 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 ${
                      isComparing 
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    } ${isCompareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    {isComparing ? 'Comparing' : 'Compare'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;

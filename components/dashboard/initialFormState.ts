import type { Vehicle } from '../../types';
import { VehicleCategory } from '../../types';

export const initialFormState: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'> = {
  make: '', model: '', variant: '', year: new Date().getFullYear(), price: 0, mileage: 0,
  description: '', engine: '', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '',
  color: '', features: [], images: [], documents: [],
  sellerEmail: '',
  category: VehicleCategory.FOUR_WHEELER, // Start with default category
  status: 'published',
  isFeatured: false,
  registrationYear: new Date().getFullYear(),
  insuranceValidity: '',
  insuranceType: 'Comprehensive',
  rto: '',
  city: '',
  state: '',
  location: '',
  noOfOwners: 1,
  displacement: '',
  groundClearance: '',
  bootSpace: '',
  qualityReport: {
    fixesDone: [],
  },
  certifiedInspection: null,
  certificationStatus: 'none',
};

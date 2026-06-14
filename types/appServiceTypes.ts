import type { Vehicle } from '../types.js';

export interface AppServiceProvider {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  city: string;
  state?: string;
  district?: string;
  distanceKm?: number;
  rating?: number;
  serviceCategories?: string[];
  services?: Array<{
    serviceType: string;
    price?: number;
    description?: string;
    etaMinutes?: number;
    active?: boolean;
  }>;
}

export interface AppServiceRequestPayload {
  providerId?: string | null;
  candidateProviderIds?: string[];
  title?: string;
  serviceType?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicle?: string;
  city?: string;
  addressLine?: string;
  pincode?: string;
  status?: 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  scheduledAt?: string;
  notes?: string;
  carDetails?: string | { make?: string; model?: string; city?: string };
  items?: Array<{
    serviceId: string;
    quantity?: number;
  }>;
  servicePackages?: Array<{
    id: string;
    name: string;
    serviceType?: string;
    includedServiceId?: string;
    quantity?: number;
    price?: number;
  }>;
  serviceTypes?: string[];
  address?: {
    line1?: string;
    city?: string;
    pincode?: string;
  };
  note?: string;
  slotId?: string;
  scheduledDate?: string;
  slotTimeLabel?: string;
  addressId?: string;
  couponCode?: string;
  total?: number;
  services?: Array<{ id: string; name: string; quantity?: number; price?: number }>;
}

export interface AppApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  reason?: string;
  vehicle?: Vehicle;
  remainingCredits?: number;
  alreadyFeatured?: boolean;
  alreadyRequested?: boolean;
  usedCertifications?: number;
  remainingCertifications?: number;
}

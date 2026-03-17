import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

export interface NewCarVariantPayload {
  variant_name: string;
  engine_specs: string;
  fuel_type: 'Petrol' | 'Diesel' | 'CNG' | 'Electric/EV' | 'Hybrid';
  transmission: 'Manual' | 'Automatic' | 'AMT' | 'CVT' | 'DCT' | 'e-CVT';
  power_bhp: string;
  torque_nm: string;
  on_road_prices: { [state: string]: number };
  features: {
    safety: string[];
    comfort_convenience: string[];
    interior: string[];
    exterior: string[];
  };
}

export interface NewCarPayload {
  _id?: string;
  brand_name: string;
  model_name: string;
  model_year: number;
  body_type: 'SUV' | 'Sedan' | 'Hatchback' | 'MUV';
  overview?: string;
  key_specs: {
    engine: string;
    mileage: string;
    power: string;
    seating_capacity: number;
    safety_rating_stars?: number;
    boot_space_litres?: number;
  };
  fuel_options: ('Petrol' | 'Diesel' | 'CNG' | 'Electric/EV' | 'Hybrid')[];
  variants: NewCarVariantPayload[];
  image_url: string;
  gallery_images?: string[];
  brochure_url?: string;
  monthly_sales?: number;
  starting_price?: number;
  emi?: { downPayment: number; interestRate: number; tenureMonths: number };
  faqs?: { question: string; answer: string }[];
}

export const newCarsService = {
  async getAll(): Promise<NewCarPayload[]> {
    const res = await authenticatedFetch('/api/new-cars');
    const result = await handleApiResponse<NewCarPayload[]>(res);
    if (!result.success) throw new Error(result.reason || result.error || 'Failed to fetch new cars');
    return result.data || [];
  },
  async create(payload: NewCarPayload): Promise<NewCarPayload> {
    const res = await authenticatedFetch('/api/new-cars', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await handleApiResponse<{ success?: boolean; data?: NewCarPayload; reason?: string }>(res);
    if (!result.success) throw new Error(result.reason || result.error || 'Failed to create');
    if (result.data?.success === false) throw new Error(result.data.reason || 'Failed to create');
    if (!result.data?.data) throw new Error('Invalid server response: missing data');
    return result.data.data;
  },
  async update(id: string, payload: Partial<NewCarPayload>): Promise<NewCarPayload> {
    const res = await authenticatedFetch('/api/new-cars', {
      method: 'PUT',
      body: JSON.stringify({ _id: id, ...payload })
    });
    const result = await handleApiResponse<{ success?: boolean; data?: NewCarPayload; reason?: string }>(res);
    if (!result.success) throw new Error(result.reason || result.error || 'Failed to update');
    if (result.data?.success === false) throw new Error(result.data.reason || 'Failed to update');
    if (!result.data?.data) throw new Error('Invalid server response: missing data');
    return result.data.data;
  },
  async remove(id: string): Promise<boolean> {
    const res = await authenticatedFetch('/api/new-cars', {
      method: 'DELETE',
      body: JSON.stringify({ _id: id })
    });
    const result = await handleApiResponse<{ success?: boolean; reason?: string }>(res);
    if (!result.success) throw new Error(result.reason || result.error || 'Failed to delete');
    if (result.data?.success === false) throw new Error(result.data.reason || 'Failed to delete');
    return true;
  }
};



import type { Vehicle } from '../types.js';
import type { MarketPricingResponse } from '../utils/vehiclePricing.js';
import { publicApiFetch } from '../utils/apiFetch.js';

export type { MarketPricingResponse };

export async function fetchLiveMarketPricing(
  vehicle: Pick<
    Vehicle,
    'id' | 'make' | 'model' | 'variant' | 'year' | 'mileage' | 'price' | 'city' | 'state' | 'fuelType' | 'transmission' | 'noOfOwners' | 'registrationNumber' | 'color'
  >,
): Promise<MarketPricingResponse | null> {
  const params = new URLSearchParams({
    make: vehicle.make,
    model: vehicle.model,
    year: String(vehicle.year),
    mileage: String(vehicle.mileage ?? 0),
    price: String(vehicle.price ?? 0),
    id: String(vehicle.id ?? 0),
  });
  if (vehicle.variant) params.set('variant', vehicle.variant);
  if (vehicle.city) params.set('city', vehicle.city);
  if (vehicle.state) params.set('state', vehicle.state);
  if (vehicle.fuelType) params.set('fuelType', vehicle.fuelType);
  if (vehicle.transmission) params.set('transmission', vehicle.transmission);
  if (vehicle.noOfOwners) params.set('noOfOwners', String(vehicle.noOfOwners));
  if (vehicle.registrationNumber) params.set('registrationNumber', vehicle.registrationNumber);
  if (vehicle.color) params.set('color', vehicle.color);

  try {
    const response = await publicApiFetch(`/api/vehicle-pricing?${params.toString()}`, {
      method: 'GET',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as MarketPricingResponse;
    return data.success ? data : null;
  } catch {
    return null;
  }
}

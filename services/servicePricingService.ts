// Service to fetch service pricing from Supabase

export interface ServicePricing {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  base_price: number;
  min_price: number;
  max_price: number;
  price_range?: string;
  icon_name?: string;
  active: boolean;
  display_order: number;
}

// Mapping from service titles to service IDs
const serviceTitleToId: Record<string, string> = {
  'Car Diagnostics': 'car-scan',
  'Engine Maintenance & Repairs': 'engine-care',
  'Car AC Servicing': 'ac-service',
  'Interior Deep Cleaning': 'interior-clean',
  'Wheel Alignment & Balancing': 'wheel-care',
  'Periodic Services': 'periodic-service',
};

// Cache for services
let servicesCache: ServicePricing[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchServices(): Promise<ServicePricing[]> {
  // Check cache first
  const now = Date.now();
  if (servicesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return servicesCache;
  }

  try {
    const response = await fetch('/api/services', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch services: ${response.statusText}`);
    }

    const data = await response.json();
    servicesCache = data;
    cacheTimestamp = now;
    return data;
  } catch (error) {
    console.error('Error fetching services:', error);
    // Return empty array on error, components can use fallback pricing
    return [];
  }
}

export function getServicePricing(serviceTitle: string): ServicePricing | null {
  const serviceId = serviceTitleToId[serviceTitle];
  if (!serviceId || !servicesCache) {
    return null;
  }

  return servicesCache.find((s) => s.id === serviceId && s.active) || null;
}

export function clearCache() {
  servicesCache = null;
  cacheTimestamp = 0;
}

// Fallback pricing (used if Supabase fetch fails)
export const fallbackPricing: Record<string, { basePrice: number; priceRange: string }> = {
  'Car Diagnostics': {
    basePrice: 999,
    priceRange: '₹999 - ₹2,499',
  },
  'Engine Maintenance & Repairs': {
    basePrice: 2499,
    priceRange: '₹2,499 - ₹4,999',
  },
  'Car AC Servicing': {
    basePrice: 1999,
    priceRange: '₹1,999 - ₹3,499',
  },
  'Interior Deep Cleaning': {
    basePrice: 3999,
    priceRange: '₹3,999 - ₹5,999',
  },
  'Wheel Alignment & Balancing': {
    basePrice: 1499,
    priceRange: '₹1,499 - ₹2,999',
  },
  'Periodic Services': {
    basePrice: 2499,
    priceRange: '₹2,499 - ₹4,999',
  },
};


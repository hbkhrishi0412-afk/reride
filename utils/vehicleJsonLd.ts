import type { Vehicle } from '../types.js';
import { getVehicleRouteId } from './vehicleIdentity.js';
import { PLATFORM_SUPPORT_PHONE_E164 } from './whatsappShare.js';

function siteOrigin(): string {
  const raw =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL
      ? String(import.meta.env.VITE_APP_URL)
      : 'https://www.reride.co.in';
  return raw.replace(/\/$/, '');
}

export function organizationJsonLd(): Record<string, unknown> {
  const base = siteOrigin();
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ReRide',
    url: base,
    logo: `${base}/icon-512.png`,
    description:
      'ReRide is an India-focused platform to buy and sell used vehicles with RC details on listings and deal tracking from chat to RC transfer.',
    areaServed: { '@type': 'Country', name: 'India' },
  };
  if (PLATFORM_SUPPORT_PHONE_E164) {
    org.contactPoint = {
      '@type': 'ContactPoint',
      telephone: `+${PLATFORM_SUPPORT_PHONE_E164}`,
      contactType: 'customer support',
      areaServed: 'IN',
      availableLanguage: ['en', 'hi'],
    };
  }
  return org;
}

export function vehicleJsonLd(v: Vehicle, imageUrl: string | undefined): Record<string, unknown> {
  const base = siteOrigin();
  const url = `${base}/vehicle/${getVehicleRouteId(v)}`;
  const offer =
    v.price != null
      ? {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: Number(v.price),
          availability: 'https://schema.org/InStock',
          url,
        }
      : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${v.make} ${v.model} ${v.year}`,
    brand: { '@type': 'Brand', name: v.make },
    model: v.model,
    vehicleModelDate: String(v.year),
    mileageFromOdometer:
      v.mileage != null
        ? {
            '@type': 'QuantitativeValue',
            value: Math.round(v.mileage),
            unitCode: 'KMT',
          }
        : undefined,
    image: imageUrl && !imageUrl.startsWith('data:') ? imageUrl : undefined,
    offers: offer,
    url,
  };
}

export function buildVehicleDetailJsonLd(vehicle: Vehicle, imageUrl?: string): Record<string, unknown>[] {
  return [organizationJsonLd(), vehicleJsonLd(vehicle, imageUrl)];
}

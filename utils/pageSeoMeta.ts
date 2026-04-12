import { View } from '../types.js';
import type { Vehicle } from '../types.js';
import type { SEOProps } from '../components/SEO.js';
import { getFirstValidImage } from './imageUtils.js';

function siteOrigin(): string {
  const raw =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL
      ? String(import.meta.env.VITE_APP_URL)
      : 'https://www.reride.co.in';
  return raw.replace(/\/$/, '');
}

function organizationJsonLd(): Record<string, unknown> {
  const base = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ReRide',
    url: base,
    logo: `${base}/icon-512.png`,
  };
}

function vehicleJsonLd(v: Vehicle, imageUrl: string | undefined): Record<string, unknown> {
  const base = siteOrigin();
  const url = `${base}/vehicle/${v.id}`;
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

export function computePageSeoMeta(params: {
  view: View;
  pathname: string;
  selectedVehicle: Vehicle | null;
  selectedCity: string | null;
  sellerDisplayName?: string | null;
}): SEOProps {
  const { view, pathname, selectedVehicle, selectedCity, sellerDisplayName } = params;

  const defaultDesc =
    'Buy and sell quality used vehicles in India. Verified listings, car services, and trusted dealers on ReRide.';

  switch (view) {
    case View.HOME:
      return {
        title: 'Buy & Sell Used Cars in India',
        description: defaultDesc,
        path: '/',
        jsonLd: [organizationJsonLd()],
      };
    case View.USED_CARS:
    case View.RENTAL:
      return {
        title: 'Browse Used Cars',
        description: 'Search used cars by city, budget, fuel type, and more on ReRide.',
        path: '/used-cars',
      };
    case View.DETAIL:
      if (selectedVehicle?.id != null) {
        const name = `${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.year}`;
        const loc = selectedVehicle.location ? ` in ${selectedVehicle.location}` : '';
        const price = selectedVehicle.price;
        const desc =
          price != null
            ? `${name}${loc} — ₹${Number(price).toLocaleString('en-IN')}. View photos, specs, and contact the seller on ReRide.`
            : `${name}${loc}. View photos, specs, and contact the seller on ReRide.`;
        const img = getFirstValidImage(selectedVehicle.images, selectedVehicle.id);
        return {
          title: `${name} for sale`,
          description: desc,
          path: `/vehicle/${selectedVehicle.id}`,
          type: 'article',
          price: price != null ? Number(price) : undefined,
          currency: 'INR',
          vehicleName: name,
          image: img,
          jsonLd: [organizationJsonLd(), vehicleJsonLd(selectedVehicle, img)],
        };
      }
      return { title: 'Vehicle details', description: defaultDesc, path: pathname || '/vehicle' };
    case View.CAR_SERVICES:
      return {
        title: 'Car Service & Workshop Booking',
        description:
          'Book periodic service, AC, diagnostics, and more. ReRide connects you with trusted workshops across India.',
        path: '/car-services',
      };
    case View.SERVICE_DETAIL:
      return {
        title: 'Service details',
        description: 'View inclusions, pricing, and book car service on ReRide.',
        path: '/car-services/detail',
      };
    case View.SERVICE_CART:
      return {
        title: 'Book Car Service',
        description: 'Complete your car service booking — pick slot, address, and workshop on ReRide.',
        path: '/car-services/cart',
      };
    case View.DEALER_PROFILES:
      return {
        title: 'Dealer Network',
        description: 'Find verified dealers and sellers on ReRide.',
        path: '/dealers',
      };
    case View.SELL_CAR:
      return {
        title: 'Sell Your Car',
        description: 'List your used car on ReRide and reach serious buyers.',
        path: '/sell-car',
      };
    case View.PRICING:
      return {
        title: 'Seller Plans & Pricing',
        description: 'ReRide plans for dealers and individual sellers — listings, featured credits, and more.',
        path: '/pricing',
      };
    case View.SUPPORT:
      return {
        title: 'Contact Support',
        description: 'Get help with your ReRide account, listings, or car service bookings.',
        path: '/support',
      };
    case View.FAQ:
      return {
        title: 'FAQ',
        description: 'Frequently asked questions about buying, selling, and services on ReRide.',
        path: '/faq',
      };
    case View.PRIVACY_POLICY:
      return {
        title: 'Privacy Policy',
        description:
          'How ReRide collects, uses, and protects your personal data (including DPDP-aligned rights for India).',
        path: '/privacy-policy',
      };
    case View.TERMS_OF_SERVICE:
      return {
        title: 'Terms of Service',
        description: 'Terms and conditions for using the ReRide marketplace and services.',
        path: '/terms-of-service',
      };
    case View.SAFETY_CENTER:
      return {
        title: 'Trust & Safety',
        description: 'Safety tips for buying and selling used cars and using ReRide securely.',
        path: '/safety-center',
      };
    case View.ABOUT_US:
      return {
        title: 'About ReRide',
        description:
          'ReRide is an India-focused platform connecting buyers, sellers, and car service providers.',
        path: '/about-us',
      };
    case View.CITY_LANDING: {
      const city = selectedCity?.trim() || 'your city';
      const slug = city.toLowerCase().replace(/\s+/g, '-');
      return {
        title: `Used Cars in ${city}`,
        description: `Browse used cars for sale in ${city} on ReRide — verified listings and local inventory.`,
        path: `/city/${encodeURIComponent(slug)}`,
      };
    }
    case View.SELLER_PROFILE:
      return {
        title: sellerDisplayName ? `${sellerDisplayName} — Seller on ReRide` : 'Seller profile',
        description: 'View seller listings and contact details on ReRide.',
        path: pathname && pathname !== '/' ? pathname : '/seller',
      };
    case View.COMPARISON:
      return {
        title: 'Compare Cars',
        description: 'Side-by-side comparison of used cars on ReRide.',
        path: '/compare',
      };
    case View.WISHLIST:
      return {
        title: 'Your Wishlist',
        description: 'Saved used cars on ReRide.',
        path: '/wishlist',
      };
    case View.BUYER_DASHBOARD:
      return {
        title: 'My Account',
        description: 'Your saved searches, wishlist, and service tracking on ReRide.',
        path: '/customer/dashboard',
        noIndex: true,
      };
    case View.SELLER_DASHBOARD:
    case View.ADMIN_PANEL:
    case View.PROFILE:
    case View.INBOX:
    case View.NOTIFICATIONS_CENTER:
    case View.LOGIN_PORTAL:
    case View.CUSTOMER_LOGIN:
    case View.SELLER_LOGIN:
    case View.ADMIN_LOGIN:
    case View.FORGOT_PASSWORD:
    case View.CAR_SERVICE_LOGIN:
    case View.CAR_SERVICE_DASHBOARD:
    case View.SELL_CAR_ADMIN:
      return {
        title: 'ReRide',
        description: defaultDesc,
        path: pathname || '/',
        noIndex: true,
      };
    default:
      return {
        title: undefined,
        description: defaultDesc,
        path: pathname || '/',
      };
  }
}

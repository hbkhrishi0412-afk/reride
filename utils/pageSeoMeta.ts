import { View } from '../types.js';
import type { Vehicle } from '../types.js';
import type { SEOProps } from '../components/SEO.js';
import { getFirstValidImage } from './imageUtils.js';
import { organizationJsonLd, vehicleJsonLd } from './vehicleJsonLd.js';

export function computePageSeoMeta(params: {
  view: View;
  pathname: string;
  selectedVehicle: Vehicle | null;
  selectedCity: string | null;
  sellerDisplayName?: string | null;
}): SEOProps {
  const { view, pathname, selectedVehicle, selectedCity, sellerDisplayName } = params;

  const defaultDesc =
    "India's trusted used vehicle transaction platform — browse with RC details and track your deal from interest to RC transfer.";

  switch (view) {
    case View.HOME:
      return {
        title: 'Used Vehicle Deals with RC Transfer Tracking | ReRide India',
        description: defaultDesc,
        path: '/',
        jsonLd: [organizationJsonLd()],
      };
    case View.USED_CARS:
      return {
        title: 'Used Cars in India with RC Details | ReRide',
        description:
          'Browse used cars and bikes with RC details on ReRide. Every listing can become a tracked deal from chat to RC transfer.',
        path: '/used-cars',
      };
    case View.DETAIL:
      if (selectedVehicle?.id != null) {
        const name = `${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.year}`;
        const city = selectedVehicle.city || selectedVehicle.location || '';
        const loc = city ? ` in ${city}` : '';
        const price = selectedVehicle.price;
        const desc =
          price != null
            ? `${name}${loc} — ₹${Number(price).toLocaleString('en-IN')}. RC details, photos, and tracked deal room on ReRide.`
            : `${name}${loc}. View photos, specs, and start a tracked deal on ReRide.`;
        const img = getFirstValidImage(selectedVehicle.images, selectedVehicle.id);
        return {
          title: `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}${city ? ` in ${city}` : ''} — ₹${price != null ? Number(price).toLocaleString('en-IN') : 'price on request'} | ReRide`,
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
        title: 'List Your Used Vehicle Free | ReRide',
        description:
          'List your car or bike free on ReRide. Manage buyer chats, offers, and RC transfer in one deal room.',
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
        title: 'Help & FAQs | ReRide Deals',
        description:
          'Answers about buying, selling, deal rooms, RC transfer, subscriptions, and safety on ReRide.',
        path: '/faq',
      };
    case View.HELP_CENTER:
      return {
        title: 'Help Center | ReRide',
        description:
          'Search help articles for buying, selling, deals, RC transfer, and account settings on ReRide.',
        path: '/help',
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
        description: 'Safety tips for buying and selling used vehicles and completing deals on ReRide.',
        path: '/safety-center',
      };
    case View.REFUND_POLICY:
      return {
        title: 'Refund Policy',
        description: 'Refund terms for ReRide subscriptions and deal assistance packages.',
        path: '/refund-policy',
      };
    case View.COMPLAINT_RESOLUTION:
      return {
        title: 'Complaint Resolution',
        description: 'How to raise and resolve complaints on ReRide.',
        path: '/complaint-resolution',
      };
    case View.FRAUD_POLICY:
      return {
        title: 'Fraud Policy',
        description: 'ReRide policies on listing fraud, payment scams, and enforcement.',
        path: '/fraud-policy',
      };
    case View.COOKIE_POLICY:
      return {
        title: 'Cookie Policy',
        description: 'How ReRide uses cookies and your choices.',
        path: '/cookie-policy',
      };
    case View.ABOUT_US:
      return {
        title: 'About ReRide — India\'s Deal Platform for Used Vehicles',
        description:
          'ReRide helps buyers and sellers manage used vehicle deals from first interest to RC transfer.',
        path: '/about-us',
      };
    case View.CITY_LANDING: {
      const city = selectedCity?.trim() || 'your city';
      const slug = city.toLowerCase().replace(/\s+/g, '-');
      return {
        title: `Used Cars in ${city} | RC details & deal tracking | ReRide`,
        description: `Browse used vehicles for sale in ${city} on ReRide — RC details on listings and tracked deals to RC transfer.`,
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
    case View.NOT_FOUND:
      return {
        title: 'Page Not Found',
        description: 'The page you are looking for does not exist on ReRide.',
        path: '/404',
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

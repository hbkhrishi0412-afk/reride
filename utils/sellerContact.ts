import type { User, Vehicle } from '../types.js';

export function getSellerCallPhone(vehicle: Vehicle, seller?: User | null): string {
  return (seller?.mobile || vehicle.sellerPhone || '').trim();
}

export function getSellerWhatsAppNumber(vehicle: Vehicle, seller?: User | null): string {
  return (vehicle.sellerWhatsApp || seller?.mobile || vehicle.sellerPhone || '').trim();
}

export function buildSellerWhatsAppUrl(vehicle: Vehicle, seller?: User | null): string | null {
  const raw = getSellerWhatsAppNumber(vehicle, seller);
  if (!raw) return null;
  const message = encodeURIComponent(
    `Hi, I'm interested in your ${vehicle.year} ${vehicle.make} ${vehicle.model} listed on ReRide for ₹${vehicle.price.toLocaleString('en-IN')}`,
  );
  const cleanNumber = raw.replace(/\D/g, '');
  if (!cleanNumber) return null;
  const withCountry = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
  return `https://wa.me/${withCountry}?text=${message}`;
}

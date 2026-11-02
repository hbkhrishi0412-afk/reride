import type { User, Vehicle } from '../types.js';
import { isCapacitorNative } from './apiConfig.js';

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

/**
 * Open an external https link. On Capacitor, Browser.open uses a Custom Tab /
 * SFSafariViewController; if that fails (or the host hands off badly), fall
 * back to window.open then location.assign so wa.me can reach WhatsApp.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isCapacitorNative()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch {
      /* fall through */
    }
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return;
    } catch {
      /* fall through */
    }
    window.location.assign(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

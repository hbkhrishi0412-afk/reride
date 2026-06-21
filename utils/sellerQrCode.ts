import { getPublicWebOriginForShareLinks } from './apiConfig.js';

/** Public seller storefront URL (correct origin inside Capacitor WebView). */
export function buildSellerShareUrl(sellerEmail: string): string {
  const origin = getPublicWebOriginForShareLinks();
  return `${origin}/?seller=${encodeURIComponent(sellerEmail)}`;
}

/** Canonical QR PNG from qrserver — same styling for display and save. */
export function buildSellerQrCodeUrl(shareUrl: string, size = 240): string {
  return (
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}` +
    `&data=${encodeURIComponent(shareUrl)}` +
    `&bgcolor=ffffff&color=0B0B0F&margin=8`
  );
}

export function sellerQrDownloadFileName(displayName: string): string {
  const safe = displayName.replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || 'profile';
  return `seller-qr-${safe}.png`;
}

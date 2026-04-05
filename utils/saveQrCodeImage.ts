import { isCapacitorNative } from './apiConfig';
import type { MediaPlugin } from '@capacitor-community/media';

export type QrSaveToast = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning'
) => void;

const RERIDE_GALLERY_ALBUM = 'ReRide';

function qrFileStem(fileName: string): string {
  const stem = fileName.replace(/\.(png|jpe?g|gif|webp)$/i, '');
  const safe = stem.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-|-$/g, '');
  return safe || 'seller-qr';
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

async function getAndroidReRideAlbumId(Media: MediaPlugin): Promise<string> {
  const { albums } = await Media.getAlbums();
  const { path: albumsPath } = await Media.getAlbumsPath();

  let album = albums.find(
    (a) => a.name === RERIDE_GALLERY_ALBUM && a.identifier.startsWith(albumsPath)
  );

  if (!album) {
    await Media.createAlbum({ name: RERIDE_GALLERY_ALBUM });
    const { albums: next } = await Media.getAlbums();
    album = next.find(
      (a) => a.name === RERIDE_GALLERY_ALBUM && a.identifier.startsWith(albumsPath)
    );
  }

  if (!album) {
    throw new Error('Could not use photo album');
  }

  return album.identifier;
}

/** Saves PNG bytes into the system Photos / Gallery (Capacitor native). */
async function saveQrToDeviceGallery(blob: Blob, fileName: string): Promise<void> {
  const dataUrl = await blobToDataUrl(blob);
  const { Media } = await import('@capacitor-community/media');
  const { Capacitor } = await import('@capacitor/core');
  const platform = Capacitor.getPlatform();
  const stem = qrFileStem(fileName);

  if (platform === 'android') {
    const albumIdentifier = await getAndroidReRideAlbumId(Media);
    await Media.savePhoto({ path: dataUrl, albumIdentifier, fileName: stem });
    return;
  }

  if (platform === 'ios') {
    await Media.savePhoto({ path: dataUrl });
    return;
  }

  throw new Error('Unsupported native platform for gallery save');
}

async function tryNativeShareOrBrowser(
  qrImageUrl: string,
  blob: Blob,
  fileName: string,
  addToast?: QrSaveToast
): Promise<void> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'Seller QR code',
      });
      addToast?.('QR code downloaded successfully!', 'success');
      return;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
    }
  }
  addToast?.(
    'Opening the image — use the browser menu or long-press to save to your device.',
    'info'
  );
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: qrImageUrl });
}

/**
 * Web: blob + <a download>.
 * Capacitor: save into Photos/Gallery via @capacitor-community/media, then share/browser fallbacks.
 */
export async function saveQrCodePngFromUrl(
  qrImageUrl: string,
  fileName: string,
  addToast?: QrSaveToast
): Promise<void> {
  try {
    const response = await fetch(qrImageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch QR code');
    }
    const blob = await response.blob();

    if (isCapacitorNative()) {
      try {
        await saveQrToDeviceGallery(blob, fileName);
        addToast?.('QR code saved to your gallery.', 'success');
        return;
      } catch (galleryErr) {
        console.error('saveQrToDeviceGallery:', galleryErr);
        await tryNativeShareOrBrowser(qrImageUrl, blob, fileName, addToast);
        return;
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    addToast?.('QR code downloaded successfully!', 'success');
  } catch (error) {
    console.error('saveQrCodePngFromUrl:', error);
    addToast?.('Failed to download QR code. Please try again.', 'error');
    try {
      if (isCapacitorNative()) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: qrImageUrl });
      } else {
        window.open(qrImageUrl, '_blank');
      }
    } catch {
      /* ignore */
    }
  }
}

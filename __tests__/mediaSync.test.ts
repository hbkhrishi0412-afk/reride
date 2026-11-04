import type { UniversalSellerChecklist } from '../lib/universalChecklist/types';
import {
  clearChecklistPhotoByUrl,
  countAiReadyPhotos,
  extractChecklistGalleryUrls,
  GALLERY_PHOTO_ITEM_IDS,
  getExtraGalleryImages,
  MAX_LISTING_IMAGES,
  mergeListingImages,
  syncDocumentsFromChecklist,
} from '../lib/universalChecklist/mediaSync';

function checklist(items: UniversalSellerChecklist['items']): UniversalSellerChecklist {
  return {
    version: '1.0',
    items,
    listingTier: 'basic',
    completedAt: new Date().toISOString(),
  };
}

describe('mediaSync', () => {
  const frontUrl = 'https://cdn.example/front.jpg';
  const rearUrl = 'https://cdn.example/rear.jpg';
  const rcUrl = 'https://cdn.example/rc.jpg';
  const extraUrl = 'https://cdn.example/extra.jpg';

  const sampleChecklist = checklist([
    { id: 'core.photos.front', status: 'pass', photoUrl: frontUrl },
    { id: 'core.photos.rear', status: 'pass', photoUrl: rearUrl },
    { id: 'core.docs.rc_photo', status: 'pass', photoUrl: rcUrl },
  ]);

  it('extractChecklistGalleryUrls orders §1.3 photos first', () => {
    const urls = extractChecklistGalleryUrls(sampleChecklist);
    expect(urls[0]).toBe(frontUrl);
    expect(urls[1]).toBe(rearUrl);
    expect(urls).toContain(rcUrl);
  });

  it('mergeListingImages keeps checklist photos before extras without duplicates', () => {
    const merged = mergeListingImages([frontUrl, rearUrl], [rearUrl, extraUrl]);
    expect(merged).toEqual([frontUrl, rearUrl, extraUrl]);
  });

  it('mergeListingImages caps at maxImages', () => {
    const many = Array.from({ length: 12 }, (_, i) => `https://cdn.example/${i}.jpg`);
    const merged = mergeListingImages(many.slice(0, 6), many.slice(6), 10);
    expect(merged.length).toBe(10);
  });

  it('MAX_LISTING_IMAGES leaves room for extras after a full checklist gallery', () => {
    expect(MAX_LISTING_IMAGES).toBeGreaterThan(GALLERY_PHOTO_ITEM_IDS.length);
    const checklist = Array.from({ length: GALLERY_PHOTO_ITEM_IDS.length }, (_, i) => `https://cdn.example/c${i}.jpg`);
    const extras = Array.from({ length: 5 }, (_, i) => `https://cdn.example/e${i}.jpg`);
    const merged = mergeListingImages(checklist, extras);
    expect(merged).toEqual([...checklist, ...extras]);
  });

  it('getExtraGalleryImages excludes checklist-linked urls', () => {
    const extras = getExtraGalleryImages(sampleChecklist, [frontUrl, extraUrl, rearUrl]);
    expect(extras).toEqual([extraUrl]);
  });

  it('clearChecklistPhotoByUrl removes matching photoUrl from items', () => {
    const cleared = clearChecklistPhotoByUrl(sampleChecklist, frontUrl);
    const frontItem = cleared?.items.find((i) => i.id === 'core.photos.front');
    expect(frontItem?.photoUrl).toBeUndefined();
    expect(cleared?.items.find((i) => i.id === 'core.photos.rear')?.photoUrl).toBe(rearUrl);
  });

  it('countAiReadyPhotos counts mandatory angle uploads', () => {
    expect(countAiReadyPhotos(sampleChecklist)).toBe(2);
    const full = checklist([
      { id: 'core.photos.front', status: 'pass', photoUrl: frontUrl },
      { id: 'core.photos.rear', status: 'pass', photoUrl: rearUrl },
      { id: 'core.photos.left', status: 'pass', photoUrl: 'https://cdn.example/left.jpg' },
      { id: 'core.photos.right', status: 'pass', photoUrl: 'https://cdn.example/right.jpg' },
      { id: 'core.photos.dashboard', status: 'pass', photoUrl: 'https://cdn.example/dash.jpg' },
      { id: 'core.photos.tyres', status: 'pass', photoUrl: 'https://cdn.example/tyres.jpg' },
    ]);
    expect(countAiReadyPhotos(full)).toBe(6);
  });

  it('syncDocumentsFromChecklist maps RC/Insurance and keeps other docs', () => {
    const docs = syncDocumentsFromChecklist(sampleChecklist, [
      { name: 'Service Record', url: 'https://cdn.example/service.pdf', fileName: 'service.pdf' },
      { name: 'Registration Certificate (RC)', url: 'https://cdn.example/old-rc.jpg', fileName: 'old.jpg' },
    ]);

    expect(docs.find((d) => d.name === 'Registration Certificate (RC)')?.url).toBe(rcUrl);
    expect(docs.find((d) => d.name === 'Service Record')?.url).toBe('https://cdn.example/service.pdf');
    expect(docs.filter((d) => d.name === 'Registration Certificate (RC)').length).toBe(1);
  });
});

import type { UniversalSellerChecklist } from './types.js';

/** §1.3 mandatory photo set — gallery cover order */
export const GALLERY_PHOTO_ITEM_IDS = [
  'core.photos.front',
  'core.photos.rear',
  'core.photos.left',
  'core.photos.right',
  'core.photos.dashboard',
  'core.photos.odometer_close',
  'core.photos.engine_bay',
  'core.photos.tyres',
  'core.photos.damage',
  'core.photos.documents',
] as const;

/** Minimum §1.3 angles for AI inspection readiness */
export const AI_READY_PHOTO_ITEM_IDS = [
  'core.photos.front',
  'core.photos.rear',
  'core.photos.left',
  'core.photos.right',
  'core.photos.dashboard',
  'core.photos.tyres',
] as const;

export const CHECKLIST_DOCUMENT_ITEMS = [
  { itemId: 'core.docs.rc_photo', docName: 'Registration Certificate (RC)' as const },
  { itemId: 'core.docs.insurance_cert', docName: 'Insurance' as const },
  { itemId: 'core.docs.puc', docName: 'Pollution Under Control (PUC)' as const },
];

export interface ListingDocumentLike {
  name: string;
  url: string;
  fileName?: string;
}

export function extractChecklistGalleryUrls(
  checklist: UniversalSellerChecklist | null | undefined,
): string[] {
  if (!checklist?.items?.length) return [];
  const byId = new Map(checklist.items.map((i) => [i.id, i.photoUrl?.trim()]));
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const id of GALLERY_PHOTO_ITEM_IDS) {
    const url = byId.get(id);
    if (url && !seen.has(url)) {
      ordered.push(url);
      seen.add(url);
    }
  }

  for (const item of checklist.items) {
    const url = item.photoUrl?.trim();
    if (url && !seen.has(url)) {
      ordered.push(url);
      seen.add(url);
    }
  }
  return ordered;
}

export function getExtraGalleryImages(
  checklist: UniversalSellerChecklist | null | undefined,
  allImages: string[],
): string[] {
  const checklistUrls = new Set(extractChecklistGalleryUrls(checklist));
  return allImages.filter((url) => !checklistUrls.has(url));
}

export function mergeListingImages(
  checklistUrls: string[],
  extraImages: string[],
  maxImages = 10,
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const url of [...checklistUrls, ...extraImages]) {
    if (!url || seen.has(url)) continue;
    merged.push(url);
    seen.add(url);
    if (merged.length >= maxImages) break;
  }
  return merged;
}

export function clearChecklistPhotoByUrl(
  checklist: UniversalSellerChecklist | null | undefined,
  urlToRemove: string,
): UniversalSellerChecklist | undefined {
  if (!checklist?.items?.length) return checklist ?? undefined;
  let changed = false;
  const items = checklist.items.map((item) => {
    if (item.photoUrl === urlToRemove) {
      changed = true;
      const { photoUrl: _removed, ...rest } = item;
      return rest;
    }
    return item;
  });
  return changed ? { ...checklist, items } : checklist;
}

export function countAiReadyPhotos(
  checklist: UniversalSellerChecklist | null | undefined,
): number {
  if (!checklist?.items?.length) return 0;
  const byId = new Map(checklist.items.map((i) => [i.id, i.photoUrl?.trim()]));
  return AI_READY_PHOTO_ITEM_IDS.filter((id) => Boolean(byId.get(id))).length;
}

export function syncDocumentsFromChecklist<T extends ListingDocumentLike>(
  checklist: UniversalSellerChecklist | null | undefined,
  existingDocs: T[],
): T[] {
  const checklistDocNames = new Set(CHECKLIST_DOCUMENT_ITEMS.map((d) => d.docName));
  const kept = existingDocs.filter((d) => !checklistDocNames.has(d.name as typeof CHECKLIST_DOCUMENT_ITEMS[number]['docName']));
  const fromChecklist: T[] = [];

  for (const { itemId, docName } of CHECKLIST_DOCUMENT_ITEMS) {
    const url = checklist?.items?.find((i) => i.id === itemId)?.photoUrl?.trim();
    if (url) {
      fromChecklist.push({
        name: docName,
        url,
        fileName: `${docName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`,
      } as T);
    }
  }

  return [...fromChecklist, ...kept];
}

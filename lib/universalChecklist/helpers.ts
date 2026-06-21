import type {
  ChecklistItemResponse,
  ChecklistItemStatus,
  ListingChecklistTier,
  PhotoRequirement,
  UniversalChecklistItemDef,
  UniversalSellerChecklist,
  BuyerInspectionItem,
} from './types.js';
import {
  getAllDefinitionsForCategory,
  getSellerDefinitions,
} from './items.js';
import type { VehicleCategory } from '../../vehicle-category.js';

export function isSellerRole(filledBy: string): boolean {
  return filledBy === 'S' || filledBy === 'S/B';
}

export function isBuyerRole(filledBy: string): boolean {
  return filledBy === 'B' || filledBy === 'S/B' || filledBy === 'B/P';
}

export function photoRequiredForItem(
  def: UniversalChecklistItemDef,
  status: ChecklistItemStatus,
): boolean {
  if (def.photoRequired === true) return status !== 'na';
  if (def.photoRequired === 'if_applicable') {
    return status === 'pass' || status === 'fail';
  }
  return false;
}

/** Seller-facing completion — upload and/or enter details; no Pass/Fail/N/A UI. */
export function isSellerItemComplete(
  def: UniversalChecklistItemDef,
  item: ChecklistItemResponse | undefined,
): boolean {
  if (!item) return false;
  if (def.photoRequired === true) {
    return Boolean(item.photoUrl?.trim());
  }
  if (def.photoRequired === 'if_applicable') {
    return item.status === 'na' || Boolean(item.photoUrl?.trim());
  }
  return Boolean(item.notes?.trim()) || item.status === 'na';
}

export function sellerItemNeedsPhotoUpload(def: UniversalChecklistItemDef): boolean {
  return def.photoRequired === true || def.photoRequired === 'if_applicable';
}

export function computeListingTier(
  checklist: UniversalSellerChecklist | undefined | null,
  category: VehicleCategory,
): ListingChecklistTier {
  if (!checklist?.items?.length) return 'basic';
  const sellerDefs = getSellerDefinitions(category);
  for (const def of sellerDefs) {
    const item = checklist.items.find((i) => i.id === def.id);
    if (!isSellerItemComplete(def, item)) return 'basic';
    if (item?.status && photoRequiredForItem(def, item.status) && !item.photoUrl?.trim()) {
      return 'basic';
    }
  }
  return 'verified';
}

/** Checklist completion hints — publishing is never blocked; tier reflects how complete it is. */
export function validateSellerChecklist(
  checklist: UniversalSellerChecklist | undefined | null,
  category: VehicleCategory,
): { valid: boolean; errors: string[]; tier: ListingChecklistTier } {
  const errors: string[] = [];
  const sellerDefs = getSellerDefinitions(category);

  if (!checklist?.items?.length) {
    return { valid: true, errors, tier: 'basic' };
  }

  for (const def of sellerDefs) {
    const item = checklist.items.find((i) => i.id === def.id);
    if (!isSellerItemComplete(def, item)) {
      errors.push(
        def.photoRequired === true || def.photoRequired === 'if_applicable'
          ? `${def.label}: upload required photo or mark not applicable`
          : `${def.label}: enter required details`,
      );
      continue;
    }
    if (photoRequiredForItem(def, item!.status) && !String(item!.photoUrl ?? '').trim()) {
      errors.push(`${def.label}: photo evidence required`);
    }
  }

  const tier = computeListingTier(checklist, category);
  return { valid: true, errors, tier };
}

export function buildEmptySellerResponses(category: VehicleCategory): ChecklistItemResponse[] {
  return getSellerDefinitions(category).map((d) => ({
    id: d.id,
    status: '' as ChecklistItemStatus,
    notes: '',
    photoUrl: '',
  }));
}

export function mergeSellerResponses(
  category: VehicleCategory,
  existing?: UniversalSellerChecklist | null,
): ChecklistItemResponse[] {
  const base = buildEmptySellerResponses(category);
  if (!existing?.items?.length) return base;
  return base.map((b) => {
    const found = existing.items.find((i) => i.id === b.id);
    return found ? { ...b, ...found } : b;
  });
}

export function finalizeSellerChecklist(
  category: VehicleCategory,
  items: ChecklistItemResponse[],
): UniversalSellerChecklist {
  const checklist: UniversalSellerChecklist = {
    version: '1.0',
    category,
    items,
    completedAt: new Date().toISOString(),
  };
  checklist.listingTier = computeListingTier(checklist, category);
  return checklist;
}

export function compareBuyerToSellerUniversal(
  seller: UniversalSellerChecklist | undefined,
  buyerItems: BuyerInspectionItem[],
  category: VehicleCategory,
): string[] {
  if (!seller?.items?.length) return [];
  const flagged: string[] = [];

  for (const buyerItem of buyerItems) {
    if (!buyerItem.status) continue;
    const sellerItem = seller.items.find((s) => s.id === buyerItem.id);
    if (!sellerItem?.status) continue;
    if (sellerItem.status !== buyerItem.status) {
      flagged.push(buyerItem.id);
    }
  }
  return flagged;
}

export function buildEmptyBuyerResponses(category: VehicleCategory): BuyerInspectionItem[] {
  return getAllDefinitionsForCategory(category)
    .filter((d) => isBuyerRole(d.filledBy))
    .map((d) => ({
      id: d.id,
      status: '' as ChecklistItemStatus,
      notes: '',
      photoUrl: '',
    }));
}

export function mergeBuyerResponses(
  category: VehicleCategory,
  sellerChecklist?: UniversalSellerChecklist | null,
  existing?: BuyerInspectionItem[],
): BuyerInspectionItem[] {
  const base = buildEmptyBuyerResponses(category);
  return base.map((b) => {
    const fromExisting = existing?.find((i) => i.id === b.id);
    if (fromExisting) return { ...b, ...fromExisting };
    const sellerItem = sellerChecklist?.items.find((s) => s.id === b.id);
    if (sellerItem?.status) {
      return { ...b, status: sellerItem.status };
    }
    return b;
  });
}

/** @deprecated Legacy alias — use UniversalSellerChecklist */
export type SellerDisclosureChecklist = UniversalSellerChecklist;

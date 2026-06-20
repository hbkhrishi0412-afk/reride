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

export function computeListingTier(
  checklist: UniversalSellerChecklist | undefined | null,
  category: VehicleCategory,
): ListingChecklistTier {
  if (!checklist?.items?.length) return 'basic';
  const sellerDefs = getSellerDefinitions(category);
  for (const def of sellerDefs) {
    const item = checklist.items.find((i) => i.id === def.id);
    if (!item?.status) return 'basic';
    if (photoRequiredForItem(def, item.status) && !item.photoUrl?.trim()) {
      return 'basic';
    }
  }
  return 'verified';
}

export function validateSellerChecklist(
  checklist: UniversalSellerChecklist | undefined | null,
  category: VehicleCategory,
): { valid: boolean; errors: string[]; tier: ListingChecklistTier } {
  const errors: string[] = [];
  const sellerDefs = getSellerDefinitions(category);

  if (!checklist?.items?.length) {
    return {
      valid: false,
      errors: ['Complete the Universal Vehicle Listing Checklist (Core + category add-on) before publishing.'],
      tier: 'basic',
    };
  }

  for (const def of sellerDefs) {
    const item = checklist.items.find((i) => i.id === def.id);
    if (!item?.status) {
      errors.push(`${def.label}: select Pass, Fail, or N/A`);
      continue;
    }
    if (photoRequiredForItem(def, item.status) && !String(item.photoUrl ?? '').trim()) {
      errors.push(`${def.label}: photo evidence required`);
    }
  }

  const tier = computeListingTier(checklist, category);
  return { valid: errors.length === 0, errors, tier };
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
  const defs = getAllDefinitionsForCategory(category);

  for (const buyerItem of buyerItems) {
    if (!buyerItem.matchesSellerClaim) {
      flagged.push(buyerItem.id);
      continue;
    }
    const sellerItem = seller.items.find((s) => s.id === buyerItem.id);
    if (!sellerItem?.status || !buyerItem.status) continue;
    if (sellerItem.status !== buyerItem.status) {
      flagged.push(buyerItem.id);
      continue;
    }
    const def = defs.find((d) => d.id === buyerItem.id);
    if (def && isSellerRole(def.filledBy) && sellerItem.status === 'pass' && buyerItem.status === 'fail') {
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
      matchesSellerClaim: true,
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

/**
 * Universal Vehicle Listing Checklist v1.0 — re-exports and legacy aliases.
 */
import { VehicleCategory } from '../vehicle-category.js';

export type {
  ChecklistFilledByRole,
  ChecklistItemStatus,
  ChecklistItemResponse,
  UniversalChecklistItemDef,
  UniversalSellerChecklist,
  ListingChecklistTier,
  BuyerInspectionItem,
  BuyerInspectionReport,
  PhotoRequirement,
} from './universalChecklist/types.js';

export {
  getAllDefinitionsForCategory,
  getSellerDefinitions,
  getBuyerDefinitions,
  groupBySection,
  CORE_CHECKLIST_ITEMS,
} from './universalChecklist/items.js';

export {
  validateSellerChecklist,
  computeListingTier,
  finalizeSellerChecklist,
  mergeSellerResponses,
  mergeBuyerResponses,
  compareBuyerToSellerUniversal,
  photoRequiredForItem,
  buildEmptySellerResponses,
} from './universalChecklist/helpers.js';

export {
  extractChecklistGalleryUrls,
  mergeListingImages,
  getExtraGalleryImages,
  clearChecklistPhotoByUrl,
  countAiReadyPhotos,
  syncDocumentsFromChecklist,
  AI_READY_PHOTO_ITEM_IDS,
} from './universalChecklist/mediaSync.js';

import type { UniversalSellerChecklist } from './universalChecklist/types.js';
import { validateSellerChecklist } from './universalChecklist/helpers.js';
import { compareBuyerToSellerUniversal } from './universalChecklist/helpers.js';
import type { BuyerInspectionItem } from './universalChecklist/types.js';
import { VehicleCategory as VC } from '../vehicle-category.js';

/** @deprecated Use string item ids — kept for migration */
export type DisclosureItemKey = string;

export type DisclosureChecklistItem = import('./universalChecklist/types.js').ChecklistItemResponse & {
  key?: string;
  value?: string;
};

export type SellerDisclosureChecklist = UniversalSellerChecklist;

export interface VahanSnapshot {
  registrationNumber: string;
  ownerName?: string;
  ownerCount?: number;
  registrationDate?: string;
  fuelType?: string;
  manufacturer?: string;
  model?: string;
  fitnessUpto?: string;
  insuranceUpto?: string;
  hypothecation?: boolean;
  hypothecationBank?: string;
  engineNumber?: string;
  chassisNumber?: string;
  rtoCode?: string;
  vehicleClass?: string;
  verifiedAt: string;
  source: 'surepass' | 'manual';
  rawSummary?: string;
}

export function validateSellerDisclosure(
  checklist: UniversalSellerChecklist | undefined | null,
  category: VehicleCategory = VC.FOUR_WHEELER,
): { valid: boolean; errors: string[] } {
  const result = validateSellerChecklist(checklist, category);
  return { valid: result.valid, errors: result.errors };
}

export function compareBuyerToSeller(
  seller: UniversalSellerChecklist | undefined,
  buyerItems: BuyerInspectionItem[],
  category: VehicleCategory = VC.FOUR_WHEELER,
): string[] {
  return compareBuyerToSellerUniversal(seller, buyerItems, category);
}

/** Legacy — use getSellerDefinitions(category) */
export const DISCLOSURE_ITEM_DEFINITIONS: never[] = [];

export type { VehicleCategory };

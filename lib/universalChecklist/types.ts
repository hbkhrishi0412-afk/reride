import type { VehicleCategory } from '../../vehicle-category.js';

/** Who fills / verifies an item (Universal Vehicle Listing Checklist v1.0) */
export type ChecklistFilledByRole = 'S' | 'B' | 'P' | 'S/B' | 'B/P';

export type ChecklistItemStatus = 'pass' | 'fail' | 'na' | '';

export type ChecklistScope = 'core' | VehicleCategory;

export type PhotoRequirement = boolean | 'if_applicable';

export interface UniversalChecklistItemDef {
  id: string;
  sectionId: string;
  sectionTitle: string;
  label: string;
  filledBy: ChecklistFilledByRole;
  photoRequired: PhotoRequirement;
  /** 'core' = all categories; otherwise category add-on */
  scope: ChecklistScope;
  buyerHint?: string;
}

export interface ChecklistItemResponse {
  id: string;
  status: ChecklistItemStatus;
  notes?: string;
  photoUrl?: string;
}

export interface UniversalSellerChecklist {
  version: '1.0';
  category: VehicleCategory;
  items: ChecklistItemResponse[];
  completedAt?: string;
  /** Computed when saved — verified = all mandatory photos present */
  listingTier?: 'verified' | 'basic';
}

export type ListingChecklistTier = 'verified' | 'basic';

export interface BuyerInspectionItem {
  id: string;
  status: ChecklistItemStatus;
  notes?: string;
  photoUrl?: string;
}

export interface BuyerInspectionReport {
  id: string;
  vehicleId: number | string;
  buyerEmail: string;
  items: BuyerInspectionItem[];
  flaggedIds: string[];
  generalNotes?: string;
  createdAt: string;
}

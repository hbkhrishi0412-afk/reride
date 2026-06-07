export type MobileFilterCategoryId =
  | 'price'
  | 'brand'
  | 'body'
  | 'year'
  | 'kms'
  | 'fuel'
  | 'transmission'
  | 'ownership'
  | 'state';

export const MOBILE_PRICE_BUCKETS: ReadonlyArray<{
  id: string;
  labelKey: string;
  min: number;
  max: number;
}> = [
  { id: 'below3', labelKey: 'listings.mobileFilter.priceBelow3', min: 50_000, max: 300_000 },
  { id: '3to6', labelKey: 'listings.mobileFilter.price3to6', min: 300_001, max: 600_000 },
  { id: '6to9', labelKey: 'listings.mobileFilter.price6to9', min: 600_001, max: 900_000 },
  { id: '9to12', labelKey: 'listings.mobileFilter.price9to12', min: 900_001, max: 1_200_000 },
  { id: '12to18', labelKey: 'listings.mobileFilter.price12to18', min: 1_200_001, max: 1_800_000 },
  { id: '18to25', labelKey: 'listings.mobileFilter.price18to25', min: 1_800_001, max: 2_500_000 },
  { id: 'above25', labelKey: 'listings.mobileFilter.priceAbove25', min: 2_500_001, max: 50_000_000 },
];

export function vehicleMatchesPriceBuckets(
  price: number | null | undefined,
  bucketIds: string[]
): boolean {
  if (bucketIds.length === 0) return true;
  if (price == null || typeof price !== 'number') return false;
  return bucketIds.some((id) => {
    const b = MOBILE_PRICE_BUCKETS.find((x) => x.id === id);
    return b ? price >= b.min && price <= b.max : false;
  });
}

export const MOBILE_FILTER_DEFAULTS = {
  minPrice: 50_000,
  maxPrice: 5_000_000,
  minMileage: 0,
  maxMileage: 200_000,
} as const;

export interface MobileFilterCategoryState {
  categoryFilter: string;
  makeFilter: string;
  modelFilter: string;
  priceRange: { min: number; max: number };
  mileageRange: { min: number; max: number };
  fuelTypeFilter: string;
  transmissionFilter: string;
  ownershipFilter: string;
  selectedPriceBuckets: string[];
  yearFilter: string;
  yearMin: number | null;
  yearMax: number | null;
  stateFilter: string;
  isStateFilterUserSet?: boolean;
}

/** Whether a filter sidebar category has a non-default selection applied. */
export function isMobileFilterCategoryActive(
  category: MobileFilterCategoryId,
  filters: MobileFilterCategoryState,
): boolean {
  const { minPrice, maxPrice, minMileage, maxMileage } = MOBILE_FILTER_DEFAULTS;
  switch (category) {
    case 'price':
      return (
        filters.selectedPriceBuckets.length > 0 ||
        filters.priceRange.min !== minPrice ||
        filters.priceRange.max !== maxPrice
      );
    case 'brand':
      return Boolean(filters.makeFilter?.trim() || filters.modelFilter?.trim());
    case 'body':
      return filters.categoryFilter !== 'ALL' && Boolean(filters.categoryFilter);
    case 'year':
      return (
        (filters.yearFilter && filters.yearFilter !== '0') ||
        filters.yearMin != null ||
        filters.yearMax != null
      );
    case 'kms':
      return filters.mileageRange.min !== minMileage || filters.mileageRange.max !== maxMileage;
    case 'fuel':
      return Boolean(filters.fuelTypeFilter?.trim());
    case 'transmission':
      return Boolean(filters.transmissionFilter?.trim());
    case 'ownership':
      return Boolean(filters.ownershipFilter);
    case 'state':
      return Boolean(filters.stateFilter?.trim() && filters.isStateFilterUserSet !== false);
    default:
      return false;
  }
}

export function getMobileFilterCategoryActiveMap(
  filters: MobileFilterCategoryState,
): Record<MobileFilterCategoryId, boolean> {
  const categories: MobileFilterCategoryId[] = [
    'price',
    'brand',
    'body',
    'year',
    'kms',
    'fuel',
    'transmission',
    'ownership',
    'state',
  ];
  return categories.reduce(
    (acc, id) => {
      acc[id] = isMobileFilterCategoryActive(id, filters);
      return acc;
    },
    {} as Record<MobileFilterCategoryId, boolean>,
  );
}

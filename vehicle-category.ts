/**
 * Vehicle category enum — lives outside `types.ts` so API/server bundles do not
 * load `types.ts` (which imports React) when they only need category constants.
 */
export enum VehicleCategory {
  FOUR_WHEELER = 'four-wheeler',
  TWO_WHEELER = 'two-wheeler',
  THREE_WHEELER = 'three-wheeler',
  COMMERCIAL = 'commercial',
  FARM = 'farm',
  CONSTRUCTION = 'construction',
}

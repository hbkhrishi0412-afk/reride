export interface VehicleModel {
  name: string;
  variants: string[];
}

export interface VehicleMake {
  name: string;
  models: VehicleModel[];
}

export type VehicleCategoryData = VehicleMake[];


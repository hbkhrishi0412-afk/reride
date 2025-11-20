import { VehicleCategory } from '../types.js';

export interface VehicleModel {
  name: string;
  variants: string[];
}

export interface VehicleMake {
  name: string;
  models: VehicleModel[];
}

export type VehicleCategoryData = VehicleMake[];

const DEFAULT_PLACEHOLDER = 'https://picsum.photos/800/600?random=1';

export const getPlaceholderImage = (make?: string, model?: string): string => {
  if (make && model) {
    return `https://picsum.photos/seed/${make}${model}/800/600`;
  }
  if (make) {
    return `https://picsum.photos/seed/${make}/800/600`;
  }
  return DEFAULT_PLACEHOLDER;
};

// Lightweight vehicle data - only essential makes and models
export const VEHICLE_DATA_LIGHT: Record<string, VehicleCategoryData> = {
  [VehicleCategory.FOUR_WHEELER]: [
    {
      name: "Maruti Suzuki",
      models: [
        { name: "Swift", variants: ["LXi", "VXi", "ZXi"] },
        { name: "Baleno", variants: ["Sigma", "Delta", "Zeta"] },
        { name: "Brezza", variants: ["LXi", "VXi", "ZXi"] },
      ],
    },
    {
      name: "Hyundai",
      models: [
        { name: "Creta", variants: ["E", "S", "SX"] },
        { name: "Venue", variants: ["E", "S", "SX"] },
        { name: "i20", variants: ["Magna", "Sportz", "Asta"] },
      ],
    },
    {
      name: "Tata",
      models: [
        { name: "Nexon", variants: ["XE", "XM", "XZ+"] },
        { name: "Punch", variants: ["Pure", "Adventure", "Accomplished"] },
        { name: "Harrier", variants: ["Smart", "Pure", "Adventure"] },
      ],
    },
    {
      name: "Mahindra",
      models: [
        { name: "XUV700", variants: ["MX", "AX3", "AX5"] },
        { name: "Scorpio-N", variants: ["Z2", "Z4", "Z6"] },
        { name: "Thar", variants: ["AX (O)", "LX"] },
      ],
    },
    {
      name: "Kia",
      models: [
        { name: "Seltos", variants: ["HTE", "HTK", "HTX"] },
        { name: "Sonet", variants: ["HTE", "HTK", "HTX"] },
      ],
    },
    {
      name: "Honda",
      models: [
        { name: "City", variants: ["SV", "V", "VX"] },
        { name: "Amaze", variants: ["E", "S", "VX"] },
      ],
    },
    {
      name: "Toyota",
      models: [
        { name: "Fortuner", variants: ["4x2 MT", "4x2 AT", "4x4 MT"] },
        { name: "Innova Crysta", variants: ["GX", "VX", "ZX"] },
      ],
    },
  ],
  [VehicleCategory.TWO_WHEELER]: [
    {
      name: "Honda",
      models: [
        { name: "Activa 6G", variants: ["Standard", "DLX"] },
        { name: "Shine", variants: ["Drum", "Disc"] },
      ],
    },
    {
      name: "Bajaj",
      models: [
        { name: "Pulsar", variants: ["150", "180", "220"] },
        { name: "Dominar", variants: ["250", "400"] },
      ],
    },
    {
      name: "TVS",
      models: [
        { name: "Apache", variants: ["160", "180", "200"] },
        { name: "Jupiter", variants: ["Standard", "ZX"] },
      ],
    },
  ],
};

// Lazy load full vehicle data when needed
export const loadFullVehicleData = async () => {
  const module = await import('./vehicleData.js');
  return module.VEHICLE_DATA;
};

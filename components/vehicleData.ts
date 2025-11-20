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
        // Use a consistent seed for the same make/model combination
        return `https://picsum.photos/seed/${make}${model}/800/600`;
    }
    if (make) {
        // Fallback to a make-specific placeholder
        return `https://picsum.photos/seed/${make}/800/600`;
    }
    return DEFAULT_PLACEHOLDER;
};

export const VEHICLE_DATA: Record<string, VehicleCategoryData> = {
    [VehicleCategory.FOUR_WHEELER]: [
        {
            name: "Maruti Suzuki",
            models: [
                { name: "Swift", variants: ["LXi", "VXi", "VXi (O)", "ZXi", "ZXi+"] },
                { name: "Baleno", variants: ["Sigma", "Delta", "Zeta", "Alpha"] },
                { name: "Brezza", variants: ["LXi", "VXi", "ZXi", "ZXi+"] },
                { name: "Ertiga", variants: ["LXi", "VXi", "ZXi", "ZXi+"] },
            ],
        },
        {
            name: "Hyundai",
            models: [
                { name: "Creta", variants: ["E", "EX", "S", "S+", "SX", "SX(O)"] },
                { name: "Venue", variants: ["E", "S", "S(O)", "SX", "SX(O)"] },
                { name: "i20", variants: ["Magna", "Sportz", "Asta", "Asta (O)"] },
                { name: "Verna", variants: ["EX", "S", "SX", "SX(O)"] },
            ],
        },
        {
            name: "Tata",
            models: [
                { name: "Nexon", variants: ["XE", "XM", "XM (S)", "XZ+", "XZ+ (HS)", "XZ+ (L)"] },
                { name: "Nexon EV", variants: ["Creative+", "Fearless", "Fearless+", "Empowered"] },
                { name: "Punch", variants: ["Pure", "Adventure", "Accomplished", "Creative"] },
                { name: "Harrier", variants: ["Smart", "Pure", "Adventure", "Fearless"] },
                { name: "Safari", variants: ["Smart", "Pure", "Adventure", "Fearless"] },
            ],
        },
        {
            name: "Mahindra",
            models: [
                { name: "XUV700", variants: ["MX", "AX3", "AX5", "AX7", "AX7L"] },
                { name: "Scorpio-N", variants: ["Z2", "Z4", "Z6", "Z8", "Z8L"] },
                { name: "Thar", variants: ["AX (O)", "LX"] },
                { name: "XUV300", variants: ["W4", "W6", "W8", "W8 (O)"] },
            ],
        },
        {
            name: "Kia",
            models: [
                { name: "Seltos", variants: ["HTE", "HTK", "HTK+", "HTX", "HTX+", "GTX+", "X-Line"] },
                { name: "Sonet", variants: ["HTE", "HTK", "HTK+", "HTX", "HTX+", "GTX+", "X-Line"] },
                { name: "Carens", variants: ["Premium", "Prestige", "Prestige+", "Luxury", "Luxury+"] },
            ],
        },
        {
            name: "Honda",
            models: [
                { name: "City", variants: ["SV", "V", "VX", "ZX"] },
                { name: "Amaze", variants: ["E", "S", "VX"] },
            ],
        },
        {
            name: "Toyota",
            models: [
                { name: "Fortuner", variants: ["4x2 MT", "4x2 AT", "4x4 MT", "4x4 AT", "Legender", "GR-S"] },
                { name: "Innova Crysta", variants: ["GX", "VX", "ZX"] },
                { name: "Urban Cruiser Hyryder", variants: ["E", "S", "G", "V"] },
            ],
        },
    ],
    [VehicleCategory.TWO_WHEELER]: [
        {
            name: "Honda",
            models: [
                { name: "Activa 6G", variants: ["Standard", "DLX", "Smart"] },
                { name: "Shine", variants: ["Drum", "Disc"] },
            ],
        },
        {
            name: "Hero",
            models: [
                { name: "Splendor Plus", variants: ["Self Start", "i3s", "Black and Accent"] },
                { name: "Passion Pro", variants: ["Drum", "Disc"] },
                { name: "Glamour", variants: ["Drum", "Disc", "Blaze Edition"] },
            ],
        },
        {
            name: "Royal Enfield",
            models: [
                { name: "Classic 350", variants: ["Redditch", "Halcyon", "Dark", "Chrome"] },
                { name: "Hunter 350", variants: ["Retro", "Metro", "Metro Rebel"] },
                { name: "Meteor 350", variants: ["Fireball", "Stellar", "Supernova"] },
            ],
        },
        {
            name: "TVS",
            models: [
                { name: "Jupiter", variants: ["Standard", "ZX", "Classic", "SmartXonnect"] },
                { name: "Apache RTR 160", variants: ["2V", "4V", "4V Special Edition"] },
                { name: "Raider 125", variants: ["Drum", "Disc", "SmartXonnect"] },
            ],
        },
        {
            name: "Bajaj",
            models: [
                { name: "Pulsar 150", variants: ["Neon", "Standard", "Twin Disc"] },
                { name: "Pulsar NS200", variants: ["Standard"] },
                { name: "Platina 110", variants: ["Drum", "Disc", "ABS"] },
            ],
        },
    ],
    [VehicleCategory.THREE_WHEELER]: [
        {
            name: "Bajaj",
            models: [
                { name: "RE Auto", variants: ["Standard", "Deluxe"] },
                { name: "Maxima C", variants: ["Standard", "Deluxe"] },
            ],
        },
        {
            name: "Piaggio",
            models: [
                { name: "Ape Xtra", variants: ["Standard", "Deluxe"] },
                { name: "Ape City", variants: ["Standard", "Deluxe"] },
            ],
        },
    ],
    [VehicleCategory.COMMERCIAL]: [
        {
            name: "Tata",
            models: [
                { name: "Ace", variants: ["Standard", "Deluxe"] },
                { name: "Intra", variants: ["V10", "V20", "V30"] },
            ],
        },
        {
            name: "Mahindra",
            models: [
                { name: "Bolero Pickup", variants: ["Standard", "Deluxe"] },
                { name: "Jeeto", variants: ["Standard", "Deluxe"] },
            ],
        },
    ],
    [VehicleCategory.FARM]: [
        {
            name: "Mahindra",
            models: [
                { name: "Tractor 265", variants: ["Standard", "Deluxe"] },
                { name: "Tractor 475", variants: ["Standard", "Deluxe"] },
            ],
        },
        {
            name: "Sonalika",
            models: [
                { name: "Tractor 35", variants: ["Standard", "Deluxe"] },
                { name: "Tractor 50", variants: ["Standard", "Deluxe"] },
            ],
        },
    ],
    [VehicleCategory.CONSTRUCTION]: [
        {
            name: "JCB",
            models: [
                { name: "Excavator 3DX", variants: ["Standard", "Deluxe"] },
                { name: "Backhoe Loader", variants: ["Standard", "Deluxe"] },
            ],
        },
        {
            name: "Caterpillar",
            models: [
                { name: "Excavator 320", variants: ["Standard", "Deluxe"] },
                { name: "Bulldozer D6", variants: ["Standard", "Deluxe"] },
            ],
        },
    ],
};
import type { VehicleData } from '../types.js';
import { VEHICLE_DATA_LIGHT, loadFullVehicleData } from '../components/vehicleDataLight.js';

// Lightweight vehicle data service
class VehicleDataService {
  private static instance: VehicleDataService;
  private cachedData: VehicleData | null = null;
  private isFullDataLoaded = false;

  static getInstance(): VehicleDataService {
    if (!VehicleDataService.instance) {
      VehicleDataService.instance = new VehicleDataService();
    }
    return VehicleDataService.instance;
  }

  // Get lightweight data immediately
  getVehicleDataLight(): VehicleData {
    return VEHICLE_DATA_LIGHT as VehicleData;
  }

  // Get full data (lazy loaded)
  async getVehicleData(): Promise<VehicleData> {
    if (this.cachedData && this.isFullDataLoaded) {
      return this.cachedData;
    }

    try {
      const fullData = await loadFullVehicleData();
      this.cachedData = fullData as VehicleData;
      this.isFullDataLoaded = true;
      return this.cachedData;
    } catch (error) {
      console.warn('Failed to load full vehicle data, using lightweight version:', error);
      return this.getVehicleDataLight();
    }
  }

  // Check if full data is available
  hasFullData(): boolean {
    return this.isFullDataLoaded;
  }

  // Clear cache (useful for testing)
  clearCache(): void {
    this.cachedData = null;
    this.isFullDataLoaded = false;
  }
}

export const vehicleDataService = VehicleDataService.getInstance();

// Backward compatibility functions
export const getVehicleData = async (): Promise<VehicleData> => {
  return vehicleDataService.getVehicleData();
};

export const getVehicleDataSync = (): VehicleData => {
  return vehicleDataService.getVehicleDataLight();
};

export const saveVehicleData = async (data: VehicleData): Promise<void> => {
  // In a real app, this would save to a database
  // For now, we'll just update the cache
  vehicleDataService['cachedData'] = data;
  vehicleDataService['isFullDataLoaded'] = true;
  console.log('Vehicle data saved:', data);
};

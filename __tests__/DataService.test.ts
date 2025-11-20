import { dataService } from '../services/dataService';
import type { Vehicle, User } from '../types';

// Mock the dynamic imports
jest.mock('../mock-vehicles.json', () => ({
  default: [],
}), { virtual: true });

jest.mock('../constants.js', () => ({
  MOCK_VEHICLES: jest.fn(() => []),
  FALLBACK_USERS: [],
}), { virtual: true });

describe('DataService', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const createJsonResponse = (data: any, overrides: Partial<Response> = {}): Response => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
      } as any,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      redirected: false,
      type: 'basic',
      url: '/api/mock',
      clone() { return createJsonResponse(data, overrides); },
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as Response;
  };

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getVehicles', () => {
    it('should return vehicles from API in production', async () => {
      const mockVehicles: Vehicle[] = [{
        id: 1,
        make: 'Toyota',
        model: 'Camry',
        year: 2022,
        price: 25000,
        mileage: 15000,
        fuelType: 'Petrol',
        transmission: 'Automatic',
        city: 'Mumbai',
        state: 'MH',
        location: 'Mumbai, MH',
        sellerEmail: 'seller@test.com',
        images: ['image1.jpg'],
        description: 'Great car',
        status: 'published',
        isFeatured: false,
        views: 0,
        inquiriesCount: 0,
        certificationStatus: 'none',
        category: 'FOUR_WHEELER' as any,
        features: [],
        engine: '2.0L',
        fuelEfficiency: '15 kmpl',
        color: 'White',
        registrationYear: 2022,
        insuranceValidity: '2025-01-01',
        insuranceType: 'Comprehensive',
        rto: 'MH-01',
        noOfOwners: 1,
        displacement: '2000 cc',
        groundClearance: '150 mm',
        bootSpace: '500 litres'
      }];

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockVehicles));

      const result = await dataService.getVehicles();
      expect(result).toEqual(mockVehicles);
      expect(mockFetch).toHaveBeenCalledWith('/api/vehicles', expect.any(Object));
    });

    it('should fallback to local storage when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));
      
      const fallbackVehicles: Vehicle[] = [{
        id: 1, make: 'Honda', model: 'Civic', year: 2021, price: 20000, mileage: 20000,
        fuelType: 'Petrol', transmission: 'Manual', city: 'Delhi', state: 'DL', location: 'Delhi, DL',
        sellerEmail: 'seller@test.com', images: ['image2.jpg'], description: 'Good car',
        status: 'published', isFeatured: false, views: 0, inquiriesCount: 0,
        certificationStatus: 'none', category: 'FOUR_WHEELER' as any, features: [],
        engine: '1.5L', fuelEfficiency: '18 kmpl', color: 'Black', registrationYear: 2021,
        insuranceValidity: '2024-01-01', insuranceType: 'Comprehensive', rto: 'DL-01',
        noOfOwners: 1, displacement: '1500 cc', groundClearance: '140 mm', bootSpace: '450 litres'
      }];

      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
      getItemSpy.mockImplementation((key: string) => {
        return key === 'reRideVehicles' ? JSON.stringify(fallbackVehicles) : null;
      });

      const result = await dataService.getVehicles();
      expect(result).toHaveLength(1);
      expect(result[0].make).toBe('Honda');
      
      getItemSpy.mockRestore();
    });

    it('should handle localStorage quota exceeded error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));
      
      // We mock getItem to return null so it attempts to load default data and save it
      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      
      // Mock setItem to throw QuotaExceededError once, then succeed
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
      let hasThrown = false;
      
      setItemSpy.mockImplementation((key, value) => {
        if (!hasThrown) {
          hasThrown = true;
          const error = new Error('Quota exceeded');
          error.name = 'QuotaExceededError';
          throw error;
        }
        // Success on second try
      });

      const result = await dataService.getVehicles();
      
      expect(Array.isArray(result)).toBe(true);
      expect(setItemSpy).toHaveBeenCalled();
      expect(hasThrown).toBe(true);
      
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser: User = {
        name: 'Test User', email: 'test@test.com', mobile: '9876543210', role: 'customer',
        location: 'Mumbai', status: 'active', createdAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse({ success: true, user: mockUser }));

      const result = await dataService.login({ email: 'test@test.com', password: 'password123' });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(localStorage.getItem('reRideCurrentUser')).toBe(JSON.stringify(mockUser));
    });

    it('should handle login failure', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse({ success: false, reason: 'Invalid credentials.' }));

      const result = await dataService.login({ email: 'test@test.com', password: 'wrongpassword' });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid credentials.');
    });
  });
});

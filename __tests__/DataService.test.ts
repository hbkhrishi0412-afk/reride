import { dataService } from '../services/dataService';
import type { Vehicle, User } from '../types';

// Mock the dynamic imports
jest.mock('../mock-vehicles.json', () => ({
  default: [],
}), { virtual: true });

jest.mock('../constants.js', () => ({
  MOCK_VEHICLES: jest.fn(() => []),
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
    (dataService as unknown as { cache: Map<string, unknown> }).cache.clear();
    (dataService as unknown as { vehiclesFetchInflight: Map<string, unknown> }).vehiclesFetchInflight.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    const env = globalThis.__IMPORT_META__.env;
    env.VITE_FORCE_API = '';
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

      // Web path uses paginated first request then merge (same inventory as legacy limit=0).
      mockFetch.mockResolvedValueOnce(
        createJsonResponse({
          vehicles: mockVehicles,
          pagination: {
            page: 1,
            limit: 30,
            total: mockVehicles.length,
            pages: 1,
            hasMore: false,
          },
        })
      );

      const result = await dataService.getVehicles();
      expect(result).toEqual(mockVehicles);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/vehicles\?.*limit=/),
        expect.any(Object)
      );
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
        return key === 'reRideVehicles_prod' ? JSON.stringify(fallbackVehicles) : null;
      });

      const result = await dataService.getVehicles();
      expect(result).toHaveLength(1);
      expect(result[0].make).toBe('Honda');
      
      getItemSpy.mockRestore();
    });

    it('should handle localStorage quota exceeded error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
      let hasThrown = false;

      setItemSpy.mockImplementation((key, value) => {
        if (!hasThrown) {
          hasThrown = true;
          const error = new Error('Quota exceeded');
          error.name = 'QuotaExceededError';
          throw error;
        }
      });

      const result = await dataService.getVehicles();

      expect(Array.isArray(result)).toBe(true);
      if (setItemSpy.mock.calls.length > 0) {
        expect(hasThrown).toBe(true);
      }

      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    });
  });

  describe('login', () => {
    const env = globalThis.__IMPORT_META__.env;

    beforeEach(() => {
      env.VITE_FORCE_API = 'true';
      mockFetch.mockReset();
    });

    afterEach(() => {
      env.VITE_FORCE_API = '';
      mockFetch.mockReset();
    });

    const mockFetchByUrl = (
      handlers: Record<string, () => Promise<Response>>,
      fallback?: () => Promise<Response>,
    ) => {
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        for (const [pattern, handler] of Object.entries(handlers)) {
          if (url.includes(pattern)) {
            return handler();
          }
        }
        return (fallback ?? (() => Promise.resolve(createJsonResponse({ token: 'csrf-test' }))))();
      });
    };

    it('should login successfully with valid credentials', async () => {
      const mockUser: User = {
        name: 'Test User', email: 'test@test.com', mobile: '9876543210', role: 'customer',
        location: 'Mumbai', status: 'active', createdAt: new Date().toISOString(),
      };

      mockFetchByUrl({
        '/api/users': () => Promise.resolve(createJsonResponse({ success: true, user: mockUser })),
      });

      const result = await dataService.login({ email: 'test@test.com', password: 'password123' });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(localStorage.getItem('reRideCurrentUser')).toBe(JSON.stringify(mockUser));
    });

    it('should handle login failure', async () => {
      mockFetchByUrl({
        '/api/users': () =>
          Promise.resolve(createJsonResponse({ success: false, reason: 'Invalid credentials.' })),
      });

      const result = await dataService.login({ email: 'test@test.com', password: 'wrongpassword' });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid credentials.');
    });

    it('should fail closed when login API throws instead of using local storage', async () => {
      const localUser: User = {
        name: 'Local Only',
        email: 'test@test.com',
        mobile: '9876543210',
        role: 'customer',
        location: 'Mumbai',
        status: 'active',
        createdAt: new Date().toISOString(),
        password: 'password123',
      };

      localStorage.setItem('reRideUsers_prod', JSON.stringify([localUser]));
      mockFetchByUrl({
        '/api/users': () => Promise.reject(new Error('Network unavailable')),
      });

      const result = await dataService.login({ email: 'test@test.com', password: 'password123' });

      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/Network unavailable|Unable to reach API server/);
      expect(localStorage.getItem('reRideCurrentUser')).toBeNull();
    });
  });
});

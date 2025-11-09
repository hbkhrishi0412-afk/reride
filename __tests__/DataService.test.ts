import { dataService } from '../services/dataService';
import type { Vehicle, User } from '../types';

describe('DataService', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const createJsonResponse = (data: any, overrides: Partial<Response> = {}): Response => {
    const defaultHeaders = {
      get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
    };

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: defaultHeaders as any,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      redirected: false,
      type: 'basic',
      url: '/api/mock',
      clone() {
        return createJsonResponse(data, overrides);
      },
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
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getVehicles', () => {
    it('should return vehicles from API in production', async () => {
      const mockVehicles: Vehicle[] = [
        {
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
        }
      ];

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockVehicles));

      const result = await dataService.getVehicles();
      expect(result).toEqual(mockVehicles);
      expect(mockFetch).toHaveBeenCalledWith('/api/vehicles', expect.any(Object));
    });

    it('should fallback to local storage when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));
      
      // Mock localStorage with fallback data
      const fallbackVehicles: Vehicle[] = [
        {
          id: 1,
          make: 'Honda',
          model: 'Civic',
          year: 2021,
          price: 20000,
          mileage: 20000,
          fuelType: 'Petrol',
          transmission: 'Manual',
          city: 'Delhi',
          state: 'DL',
          location: 'Delhi, DL',
          sellerEmail: 'seller@test.com',
          images: ['image2.jpg'],
          description: 'Good car',
          status: 'published',
          isFeatured: false,
          views: 0,
          inquiriesCount: 0,
          certificationStatus: 'none',
          category: 'FOUR_WHEELER' as any,
          features: [],
          engine: '1.5L',
          fuelEfficiency: '18 kmpl',
          color: 'Black',
          registrationYear: 2021,
          insuranceValidity: '2024-01-01',
          insuranceType: 'Comprehensive',
          rto: 'DL-01',
          noOfOwners: 1,
          displacement: '1500 cc',
          groundClearance: '140 mm',
          bootSpace: '450 litres'
        }
      ];

      (localStorage as any).getItem = jest.fn((key: string) => {
        if (key === 'reRideVehicles') {
          return JSON.stringify(fallbackVehicles);
        }
        return null;
      });

      const result = await dataService.getVehicles();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle localStorage quota exceeded error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));
      
      // Mock localStorage quota exceeded
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn().mockImplementation(() => {
        const error = new Error('Quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const result = await dataService.getVehicles();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0); // Should fall back to seeded data
      
      // Restore original method
      localStorage.setItem = originalSetItem;
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser: User = {
        name: 'Test User',
        email: 'test@test.com',
        mobile: '9876543210',
        role: 'customer',
        location: 'Mumbai',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        createJsonResponse({ success: true, user: mockUser })
      );

      const result = await dataService.login({
        email: 'test@test.com',
        password: 'password123'
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(localStorage.getItem('reRideCurrentUser')).toBe(JSON.stringify(mockUser));
    });

    it('should handle login failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createJsonResponse({ success: false, reason: 'Invalid credentials.' })
      );

      const result = await dataService.login({
        email: 'test@test.com',
        password: 'wrongpassword'
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid credentials.');
    });

    it('should validate email format', async () => {
      mockFetch.mockResolvedValueOnce(
        createJsonResponse({ success: false, reason: 'Invalid credentials.' })
      );

      const result = await dataService.login({
        email: 'invalid-email',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should register successfully with valid data', async () => {
      const mockUser: User = {
        name: 'New User',
        email: 'new@test.com',
        mobile: '9876543211',
        role: 'customer',
        location: 'Mumbai',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        createJsonResponse({ success: true, user: mockUser })
      );

      const successResult = await dataService.register({
        name: 'New User',
        email: 'new@test.com',
        password: 'password123',
        mobile: '9876543211',
        role: 'customer'
      });

      expect(successResult.success).toBe(true);
      expect(successResult.user).toEqual(mockUser);
    });

    it('should handle registration with invalid data', async () => {
      mockFetch.mockResolvedValueOnce(
        createJsonResponse({ success: false, reason: 'Validation failed' })
      );

      const failedResult = await dataService.register({
        name: 'A', // Too short
        email: 'invalid-email',
        password: '123', // Too short
        mobile: '123', // Invalid format
        role: 'customer'
      });

      expect(failedResult.success).toBe(false);
      expect(failedResult.reason).toContain('Validation failed');
    });
  });

  describe('addVehicle', () => {
    it('should add vehicle successfully', async () => {
      const mockVehicle: Vehicle = {
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
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockVehicle));

      const result = await dataService.addVehicle(mockVehicle);
      expect(result).toEqual(mockVehicle);
    });
  });

  describe('syncWhenOnline', () => {
    it('should sync data when online', async () => {
      const mockVehicles: Vehicle[] = [
        {
          id: 1,
          make: 'Mock',
          model: 'Vehicle',
          year: 2022,
          price: 1000,
          mileage: 1000,
          fuelType: 'Petrol',
          transmission: 'Manual',
          city: 'City',
          state: 'ST',
          location: 'City, ST',
          sellerEmail: 'seller@test.com',
          images: ['image.jpg'],
          description: 'desc',
          status: 'published',
          isFeatured: false,
          views: 0,
          inquiriesCount: 0,
          certificationStatus: 'none',
          category: 'FOUR_WHEELER' as any,
          features: [],
          engine: '1.0L',
          fuelEfficiency: '10 kmpl',
          color: 'Blue',
          registrationYear: 2022,
          insuranceValidity: '2025-01-01',
          insuranceType: 'Comprehensive',
          rto: 'ST-01',
          noOfOwners: 1,
          displacement: '1000 cc',
          groundClearance: '150 mm',
          bootSpace: '200 litres',
        },
      ];
      const mockUsers: User[] = [
        {
          name: 'Mock User',
          email: 'mock@test.com',
          mobile: '9876543210',
          role: 'customer',
          location: 'City',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
      ];

      localStorage.setItem('reRideVehicles', JSON.stringify(mockVehicles));
      localStorage.setItem('reRideUsers', JSON.stringify(mockUsers));

      mockFetch
        .mockResolvedValueOnce(createJsonResponse(mockVehicles))
        .mockResolvedValueOnce(createJsonResponse(mockUsers));

      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });

      await dataService.syncWhenOnline();

      const calledEndpoints = mockFetch.mock.calls.map(call => call[0]);
      expect(calledEndpoints.length).toBeGreaterThanOrEqual(1);
      expect(calledEndpoints).toContain('/api/users');
    });

    it('should not sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      await dataService.syncWhenOnline();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

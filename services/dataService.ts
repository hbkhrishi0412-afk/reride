import type { Vehicle, User, VehicleData } from '../types';

// Unified data service that handles both local and API data consistently
class DataService {
  private isDevelopment: boolean;
  private apiBaseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.isDevelopment = this.detectDevelopment();
    this.apiBaseUrl = '/api';
  }

  private detectDevelopment(): boolean {
    try {
      // Safe check for import.meta.env
      // In Jest/CJS environments import.meta might not exist or have env
      const meta = (typeof import.meta !== 'undefined' ? import.meta : {}) as any;
      
      if (meta && meta.env) {
        if (meta.env.VITE_FORCE_API === 'true') {
          return false;
        }
        if (meta.env.DEV) {
          return true;
        }
      }
      
      const hostname = typeof window !== 'undefined' ? (window.location?.hostname ?? '') : '';
      const isLocalhost = hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.includes('localhost');
      
      const protocol = typeof window !== 'undefined' ? (window.location?.protocol ?? '') : '';

      return isLocalhost || protocol === 'file:';
    } catch {
      return false;
    }
  }

  private async makeApiRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const shouldSendJson = method !== 'GET' && method !== 'HEAD';

    const headers: HeadersInit = {
      Accept: 'application/json',
      ...(shouldSendJson ? { 'Content-Type': 'application/json' } : {}),
      ...this.getAuthHeaders(),
      ...(options.headers || {})
    };

    const fetchOptions: RequestInit = {
      ...options,
      method,
      headers,
      credentials: 'include'
    };

    // Check cache for GET requests
    const cacheKey = `${endpoint}_${JSON.stringify(options)}`;
    if (method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }
    }

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status} - ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.reason || errorMessage;
      } catch {
        // Use default error message if JSON parsing fails
      }
      
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Unexpected non-JSON response from API:', text.slice(0, 300));
      if (text.includes('Authentication Required') || text.includes('Vercel Authentication')) {
        throw new Error('Authentication is required to access the API. Please ensure the deployment protection bypass cookie is set.');
      }
      throw new Error('Unexpected response from server. Expected JSON but received a different format.');
    }

    const data = await response.json();
    
    // Cache GET requests
    if (method === 'GET') {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
    }
    
    return data;
  }

  private getAuthHeaders(): Record<string, string> {
    try {
      const userJson = localStorage.getItem('reRideCurrentUser') || sessionStorage.getItem('currentUser');
      if (!userJson) return {};
      const user: User = JSON.parse(userJson);
      
      // Check if user has access token
      const accessToken = localStorage.getItem('reRideAccessToken') || sessionStorage.getItem('accessToken');
      if (accessToken) {
        return { 'Authorization': `Bearer ${accessToken}` };
      }
      
      // Fallback to email for backward compatibility (not recommended for production)
      console.warn('No access token found, using email for authorization (not secure)');
      return { 'Authorization': user.email };
    } catch (error) {
      console.error('Failed to get auth headers:', error);
      return {};
    }
  }

  private getLocalStorageData<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (error) {
      console.warn(`Failed to parse localStorage data for ${key}:`, error);
      return fallback;
    }
  }

  private setLocalStorageData<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save data to localStorage for ${key}:`, error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Clear old data and try again
        this.clearOldData();
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (retryError) {
          console.error(`Failed to save data after clearing old data:`, retryError);
        }
      }
    }
  }

  private clearOldData(): void {
    const keysToKeep = ['reRideCurrentUser', 'wishlist', 'comparisonList'];
    const allKeys = Object.keys(localStorage);
    
    for (const key of allKeys) {
      if (!keysToKeep.includes(key) && key.startsWith('reRide')) {
        localStorage.removeItem(key);
      }
    }
  }

  // Vehicle operations
  async getVehicles(): Promise<Vehicle[]> {
    if (this.isDevelopment) {
      return this.getVehiclesLocal();
    }

    try {
      const vehicles = await this.makeApiRequest<Vehicle[]>('/vehicles');
      // Cache the API data locally for offline use
      this.setLocalStorageData('reRideVehicles', vehicles);
      return vehicles;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.getVehiclesLocal();
    }
  }

  private async getVehiclesLocal(): Promise<Vehicle[]> {
    const fallbackVehicles: Vehicle[] = [{
      id: 1,
      make: "Maruti Suzuki",
      model: "Swift",
      year: 2022,
      price: 650000,
      mileage: 18000,
      fuelType: "Petrol",
      transmission: "Manual",
      city: "Mumbai",
      state: "MH",
      location: "Mumbai, MH",
      sellerEmail: "demo@reride.com",
      images: ["https://picsum.photos/800/600?random=1"],
      description: "Well maintained Swift in excellent condition",
      status: "published",
      isFeatured: true,
      views: 150,
      inquiriesCount: 8,
      certificationStatus: "none",
      category: "FOUR_WHEELER" as any,
      features: [],
      engine: "1.2L",
      fuelEfficiency: "20 kmpl",
      color: "White",
      registrationYear: 2022,
      insuranceValidity: "2025-01-01",
      insuranceType: "Comprehensive",
      rto: "MH-01",
      noOfOwners: 1,
      displacement: "1197 cc",
      groundClearance: "170 mm",
      bootSpace: "268 litres"
    }];

    let vehicles = this.getLocalStorageData<Vehicle[]>('reRideVehicles', []);
    
    if (vehicles.length === 0) {
      try {
        // Try to load mock data first
        const mockVehicles = await import('../mock-vehicles.json');
        if (mockVehicles.default && mockVehicles.default.length > 0) {
          vehicles = mockVehicles.default as Vehicle[];
          this.setLocalStorageData('reRideVehicles', vehicles);
          console.log('✅ Loaded mock vehicles data:', vehicles.length, 'vehicles');
        } else {
          // Fallback to constants if mock data not available
          const { MOCK_VEHICLES } = await import('../constants.js');
          vehicles = await MOCK_VEHICLES();
          this.setLocalStorageData('reRideVehicles', vehicles);
        }
      } catch (error) {
        console.log('⚠️ Could not load mock vehicles, using fallback:', error);
        vehicles = fallbackVehicles;
        this.setLocalStorageData('reRideVehicles', vehicles);
      }
    }

    return vehicles;
  }

  async addVehicle(vehicleData: Vehicle): Promise<Vehicle> {
    if (this.isDevelopment) {
      return this.addVehicleLocal(vehicleData);
    }

    try {
      const vehicle = await this.makeApiRequest<Vehicle>('/vehicles', {
        method: 'POST',
        body: JSON.stringify(vehicleData),
      });
      
      // Update local cache
      const vehicles = await this.getVehiclesLocal();
      vehicles.unshift(vehicle);
      this.setLocalStorageData('reRideVehicles', vehicles);
      
      return vehicle;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.addVehicleLocal(vehicleData);
    }
  }

  private async addVehicleLocal(vehicleData: Vehicle): Promise<Vehicle> {
    const vehicles = await this.getVehiclesLocal();
    vehicles.unshift(vehicleData);
    this.setLocalStorageData('reRideVehicles', vehicles);
    return vehicleData;
  }

  async updateVehicle(vehicleData: Vehicle): Promise<Vehicle> {
    if (this.isDevelopment) {
      return this.updateVehicleLocal(vehicleData);
    }

    try {
      const vehicle = await this.makeApiRequest<Vehicle>('/vehicles', {
        method: 'PUT',
        body: JSON.stringify(vehicleData),
      });
      
      // Update local cache
      const vehicles = await this.getVehiclesLocal();
      const updatedVehicles = vehicles.map(v => v.id === vehicleData.id ? vehicle : v);
      this.setLocalStorageData('reRideVehicles', updatedVehicles);
      
      return vehicle;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.updateVehicleLocal(vehicleData);
    }
  }

  private async updateVehicleLocal(vehicleData: Vehicle): Promise<Vehicle> {
    const vehicles = await this.getVehiclesLocal();
    const updatedVehicles = vehicles.map(v => v.id === vehicleData.id ? vehicleData : v);
    this.setLocalStorageData('reRideVehicles', updatedVehicles);
    return vehicleData;
  }

  async deleteVehicle(vehicleId: number): Promise<{ success: boolean, id: number }> {
    if (this.isDevelopment) {
      return this.deleteVehicleLocal(vehicleId);
    }

    try {
      const result = await this.makeApiRequest<{ success: boolean, id: number }>('/vehicles', {
        method: 'DELETE',
        body: JSON.stringify({ id: vehicleId }),
      });
      
      // Update local cache
      const vehicles = await this.getVehiclesLocal();
      const filteredVehicles = vehicles.filter(v => v.id !== vehicleId);
      this.setLocalStorageData('reRideVehicles', filteredVehicles);
      
      return result;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.deleteVehicleLocal(vehicleId);
    }
  }

  private async deleteVehicleLocal(vehicleId: number): Promise<{ success: boolean, id: number }> {
    const vehicles = await this.getVehiclesLocal();
    const filteredVehicles = vehicles.filter(v => v.id !== vehicleId);
    this.setLocalStorageData('reRideVehicles', filteredVehicles);
    return { success: true, id: vehicleId };
  }

  // User operations
  async getUsers(): Promise<User[]> {
    if (this.isDevelopment) {
      return this.getUsersLocal();
    }

    try {
      const users = await this.makeApiRequest<User[]>('/users');
      this.setLocalStorageData('reRideUsers', users);
      return users;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.getUsersLocal();
    }
  }

  private async getUsersLocal(): Promise<User[]> {
    const fallbackUsers: User[] = [{
      name: 'Demo User',
      email: 'demo@reride.com',
      mobile: '9876543210',
      role: 'customer',
      location: 'Mumbai',
      status: 'active',
      createdAt: new Date().toISOString(),
    }];

    let users = this.getLocalStorageData<User[]>('reRideUsers', []);
    
    if (users.length === 0) {
      try {
        // Try to load mock data first
        const mockUsers = await import('../mock-users.json');
        if (mockUsers.default && mockUsers.default.length > 0) {
          users = mockUsers.default as User[];
          this.setLocalStorageData('reRideUsers', users);
          console.log('✅ Loaded mock users data:', users.length, 'users');
        } else {
          // Fallback to constants if mock data not available
          const { FALLBACK_USERS } = await import('../constants/fallback.js');
          users = FALLBACK_USERS;
          this.setLocalStorageData('reRideUsers', users);
        }
      } catch (error) {
        console.log('⚠️ Could not load mock users, using fallback:', error);
        users = fallbackUsers;
        this.setLocalStorageData('reRideUsers', users);
      }
    }

    return users;
  }

  async login(credentials: { email: string; password: string; role?: string }): Promise<{ success: boolean, user?: User, reason?: string }> {
    if (this.isDevelopment) {
      return this.loginLocal(credentials);
    }

    try {
      const result = await this.makeApiRequest<{ success: boolean, user?: User, reason?: string }>('/users', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', ...credentials }),
      });
      
      if (result.success && result.user) {
        // Store user session
        localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user));
      }
      
      return result;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.loginLocal(credentials);
    }
  }

  private async loginLocal(credentials: { email: string; password: string; role?: string }): Promise<{ success: boolean, user?: User, reason?: string }> {
    const users = await this.getUsersLocal();
    const user = users.find(u => u.email === credentials.email && u.password === credentials.password);
    
    if (!user) {
      return { success: false, reason: 'Invalid credentials.' };
    }
    
    if (credentials.role && user.role !== credentials.role) {
      return { success: false, reason: `User is not a registered ${credentials.role}.` };
    }
    
    if (user.status === 'inactive') {
      return { success: false, reason: 'Your account has been deactivated.' };
    }
    
    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem('reRideCurrentUser', JSON.stringify(userWithoutPassword));
    return { success: true, user: userWithoutPassword };
  }

  async register(credentials: { name: string; email: string; password: string; mobile: string; role: string }): Promise<{ success: boolean, user?: User, reason?: string }> {
    if (this.isDevelopment) {
      return this.registerLocal(credentials);
    }

    try {
      const result = await this.makeApiRequest<{ success: boolean, user?: User, reason?: string }>('/users', {
        method: 'POST',
        body: JSON.stringify({ action: 'register', ...credentials }),
      });
      
      if (result.success && result.user) {
        // Update local cache
        const users = await this.getUsersLocal();
        users.push(result.user as User);
        this.setLocalStorageData('reRideUsers', users);
        
        // Store user session
        localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user));
      }
      
      return result;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.registerLocal(credentials);
    }
  }

  private async registerLocal(credentials: { name: string; email: string; password: string; mobile: string; role: string; location?: string }): Promise<{ success: boolean, user?: User, reason?: string }> {
    const users = await this.getUsersLocal();
    
    if (users.find(u => u.email === credentials.email)) {
      return { success: false, reason: 'An account with this email already exists.' };
    }
    
    const newUser: User = {
      ...credentials,
      role: credentials.role as 'seller' | 'customer' | 'admin',
      location: credentials.location || 'Mumbai', // Default location if not provided
      status: 'active',
      createdAt: new Date().toISOString(),
      avatarUrl: `https://i.pravatar.cc/150?u=${credentials.email}`,
      subscriptionPlan: credentials.role === 'seller' ? 'free' : undefined,
      featuredCredits: credentials.role === 'seller' ? 0 : undefined,
      usedCertifications: credentials.role === 'seller' ? 0 : undefined,
    };
    
    users.push(newUser);
    this.setLocalStorageData('reRideUsers', users);
    
    const { password: _, ...userWithoutPassword } = newUser;
    localStorage.setItem('reRideCurrentUser', JSON.stringify(userWithoutPassword));
    return { success: true, user: userWithoutPassword };
  }

  // Vehicle data operations
  async getVehicleData(): Promise<VehicleData> {
    if (this.isDevelopment) {
      return this.getVehicleDataLocal();
    }

    try {
      // Try the correct API endpoint for vehicle data
      const vehicleData = await this.makeApiRequest<VehicleData>('/vehicle-data');
      this.setLocalStorageData('reRideVehicleData', vehicleData);
      return vehicleData;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.getVehicleDataLocal();
    }
  }

  private async getVehicleDataLocal(): Promise<VehicleData> {
    const fallbackData: VehicleData = {
      FOUR_WHEELER: [],
      TWO_WHEELER: [],
      THREE_WHEELER: []
    };

    let vehicleData = this.getLocalStorageData<VehicleData>('reRideVehicleData', fallbackData);
    
    if (Object.keys(vehicleData).length === 0) {
      try {
        const { VEHICLE_DATA } = await import('../components/vehicleData.js');
        vehicleData = VEHICLE_DATA;
        this.setLocalStorageData('reRideVehicleData', vehicleData);
      } catch {
        vehicleData = fallbackData;
        this.setLocalStorageData('reRideVehicleData', vehicleData);
      }
    }

    return vehicleData;
  }

  async saveVehicleData(data: VehicleData): Promise<boolean> {
    if (this.isDevelopment) {
      this.setLocalStorageData('reRideVehicleData', data);
      return true;
    }

    try {
      await this.makeApiRequest('/vehicle-data', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      this.setLocalStorageData('reRideVehicleData', data);
      return true;
    } catch (error) {
      console.warn('API failed, saving to local storage only:', error);
      this.setLocalStorageData('reRideVehicleData', data);
      return false;
    }
  }

  // Utility methods
  getCurrentUser(): User | null {
    try {
      const userJson = localStorage.getItem('reRideCurrentUser') || sessionStorage.getItem('currentUser');
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem('reRideCurrentUser');
    sessionStorage.removeItem('currentUser');
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  // Sync local data with API when online
  async syncWhenOnline(): Promise<void> {
    if (!this.isOnline() || this.isDevelopment) {
      return;
    }

    try {
      // Sync vehicles
      const localVehicles = this.getLocalStorageData<Vehicle[]>('reRideVehicles', []);
      if (localVehicles.length > 0) {
        const apiVehicles = await this.makeApiRequest<Vehicle[]>('/vehicles');
        // Merge local changes with API data
        const mergedVehicles = this.mergeVehicleData(localVehicles, apiVehicles);
        this.setLocalStorageData('reRideVehicles', mergedVehicles);
      }

      // Sync users
      const localUsers = this.getLocalStorageData<User[]>('reRideUsers', []);
      if (localUsers.length > 0) {
        const apiUsers = await this.makeApiRequest<User[]>('/users');
        const mergedUsers = this.mergeUserData(localUsers, apiUsers);
        this.setLocalStorageData('reRideUsers', mergedUsers);
      }
    } catch (error) {
      console.warn('Failed to sync data:', error);
    }
  }

  private mergeVehicleData(local: Vehicle[], api: Vehicle[]): Vehicle[] {
    const apiMap = new Map(api.map(v => [v.id, v]));
    const merged = [...api];
    
    // Add local vehicles that don't exist in API
    for (const localVehicle of local) {
      if (!apiMap.has(localVehicle.id)) {
        merged.push(localVehicle);
      }
    }
    
    return merged;
  }

  private mergeUserData(local: User[], api: User[]): User[] {
    const apiMap = new Map(api.map(u => [u.email, u]));
    const merged = [...api];
    
    // Add local users that don't exist in API
    for (const localUser of local) {
      if (!apiMap.has(localUser.email)) {
        merged.push(localUser);
      }
    }
    
    return merged;
  }
}

// Export singleton instance
export const dataService = new DataService();

// Export individual methods for backward compatibility
export const getVehicles = () => dataService.getVehicles();
export const addVehicle = (vehicleData: Vehicle) => dataService.addVehicle(vehicleData);
export const updateVehicle = (vehicleData: Vehicle) => dataService.updateVehicle(vehicleData);
export const deleteVehicle = (vehicleId: number) => dataService.deleteVehicle(vehicleId);
export const getUsers = () => dataService.getUsers();
export const login = (credentials: { email: string; password: string; role?: string }) => dataService.login(credentials);
export const register = (credentials: { name: string; email: string; password: string; mobile: string; role: string }) => dataService.register(credentials);
export const getVehicleData = () => dataService.getVehicleData();
export const saveVehicleData = (data: VehicleData) => dataService.saveVehicleData(data);
export const getCurrentUser = () => dataService.getCurrentUser();
export const logout = () => dataService.logout();
export const syncWhenOnline = () => dataService.syncWhenOnline();

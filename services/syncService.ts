import type { VehicleData } from '../types';

interface SyncStatus {
  isActive: boolean;
  lastSyncTime: Date | null;
  isOnline: boolean;
  pendingChanges: boolean;
  error: string | null;
}

class SyncService {
  private syncStatus: SyncStatus = {
    isActive: false,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    pendingChanges: false,
    error: null
  };

  private listeners: ((status: SyncStatus) => void)[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly API_BASE_URL = '/api';

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.syncStatus.isOnline = true;
      this.syncStatus.error = null;
      this.notifyListeners();
      this.startAutoSync();
    });

    window.addEventListener('offline', () => {
      this.syncStatus.isOnline = false;
      this.syncStatus.error = 'No internet connection';
      this.notifyListeners();
      this.stopAutoSync();
    });

    // Listen for visibility change to sync when tab becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.syncStatus.isOnline) {
        this.performSync();
      }
    });
  }

  public startSync(): void {
    console.log('🔄 Starting sync service...');
    this.syncStatus.isActive = true;
    this.syncStatus.error = null;
    this.notifyListeners();
    this.startAutoSync();
    this.performSync();
  }

  public stopSync(): void {
    console.log('⏹️ Stopping sync service...');
    this.syncStatus.isActive = false;
    this.stopAutoSync();
    this.notifyListeners();
  }

  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      if (this.syncStatus.isActive && this.syncStatus.isOnline) {
        this.performSync();
      }
    }, this.SYNC_INTERVAL);
  }

  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  public async performSync(): Promise<boolean> {
    if (!this.syncStatus.isOnline) {
      this.syncStatus.error = 'No internet connection';
      this.notifyListeners();
      return false;
    }

    try {
      console.log('🔄 Performing sync...');
      
      // Get local vehicle data
      const localData = this.getLocalVehicleData();
      if (!localData) {
        console.log('📥 No local data to sync, fetching from server...');
        return await this.fetchFromServer();
      }

      // Try to save local data to server
      const success = await this.saveToServer(localData);
      
      if (success) {
        this.syncStatus.lastSyncTime = new Date();
        this.syncStatus.pendingChanges = false;
        this.syncStatus.error = null;
        console.log('✅ Sync completed successfully');
      } else {
        this.syncStatus.pendingChanges = true;
        this.syncStatus.error = 'Failed to sync with server';
        console.warn('⚠️ Sync failed, changes pending');
      }

      this.notifyListeners();
      return success;
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.syncStatus.error = error instanceof Error ? error.message : 'Unknown sync error';
      this.syncStatus.pendingChanges = true;
      this.notifyListeners();
      return false;
    }
  }

  public async forceSync(): Promise<boolean> {
    console.log('🔄 Force sync initiated...');
    this.syncStatus.error = null;
    this.notifyListeners();
    
    const success = await this.performSync();
    
    if (success) {
      console.log('✅ Force sync completed successfully');
    } else {
      console.warn('⚠️ Force sync failed');
    }
    
    return success;
  }

  private async saveToServer(data: VehicleData): Promise<boolean> {
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try standalone endpoint first (correct for production)
        const response = await fetch(`${this.API_BASE_URL}/vehicle-data`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          console.log('✅ Data synced via vehicle-data endpoint');
          return true;
        }

        // Try consolidated endpoint as fallback
        const fallbackResponse = await fetch(`${this.API_BASE_URL}/vehicles?type=data`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (fallbackResponse.ok) {
          console.log('✅ Data synced via consolidated endpoint');
          return true;
        }

        console.warn(`⚠️ Both endpoints failed (attempt ${attempt}/${maxRetries})`);
      } catch (error) {
        console.warn(`⚠️ Sync attempt ${attempt} failed:`, error);
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return false;
  }

  private async fetchFromServer(): Promise<boolean> {
    try {
      // Try standalone endpoint first
      const response = await fetch(`${this.API_BASE_URL}/vehicle-data`);
      if (response.ok) {
        const data = await response.json();
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('reRideVehicleData', JSON.stringify(data));
        }
        this.syncStatus.lastSyncTime = new Date();
        this.syncStatus.error = null;
        this.notifyListeners();
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Data fetched from vehicle-data endpoint');
        }
        return true;
      }
      
      // Try consolidated endpoint as fallback
      const fallbackResponse = await fetch(`${this.API_BASE_URL}/vehicles?type=data`);
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('reRideVehicleData', JSON.stringify(data));
        }
        this.syncStatus.lastSyncTime = new Date();
        this.syncStatus.error = null;
        this.notifyListeners();
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Data fetched from consolidated endpoint');
        }
        return true;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Failed to fetch from server:', error);
      }
    }
    return false;
  }

  private getLocalVehicleData(): VehicleData | null {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return null;
      }
      const data = localStorage.getItem('reRideVehicleData');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public markPendingChanges(): void {
    this.syncStatus.pendingChanges = true;
    this.notifyListeners();
  }

  public getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  public subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    // Immediately call with current status
    listener(this.syncStatus);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.syncStatus));
  }

  public destroy(): void {
    this.stopAutoSync();
    this.listeners = [];
  }
}

// Create singleton instance
export const syncService = new SyncService();

// Export types
export type { SyncStatus };

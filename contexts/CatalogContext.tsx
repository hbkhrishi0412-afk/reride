/**
 * Vehicle catalog, user directory cache, wishlist, compare, and ratings state.
 * Composed inside AppProvider; use useCatalog() for domain-specific reads/writes.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';
import type { User, Vehicle } from '../types';
import { logWarn } from '../utils/logger';
import {
  getComparisonCategory,
  sanitizeComparisonList,
} from '../utils/compareList.js';

export interface CatalogContextType {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  vehiclesCatalogReady: boolean;
  setVehiclesCatalogReady: React.Dispatch<React.SetStateAction<boolean>>;
  comparisonList: number[];
  setComparisonList: React.Dispatch<React.SetStateAction<number[]>>;
  wishlist: number[];
  setWishlist: React.Dispatch<React.SetStateAction<number[]>>;
  ratings: Record<string, number[]>;
  setRatings: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  sellerRatings: Record<string, number[]>;
  setSellerRatings: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  comparisonCategory: string | null;
  recommendations: Vehicle[];
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export function useCatalog(): CatalogContextType {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within a CatalogProvider');
  return ctx;
}

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [vehiclesCatalogReady, setVehiclesCatalogReady] = useState(false);

  const [comparisonList, setComparisonList] = useState<number[]>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
      const stored = localStorage.getItem('reride_comparison_list');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === 'number') : [];
    } catch {
      return [];
    }
  });

  const [ratings, setRatings] = useState<Record<string, number[]>>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
      const stored = localStorage.getItem('vehicleRatings');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [sellerRatings, setSellerRatings] = useState<Record<string, number[]>>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
      const stored = localStorage.getItem('sellerRatings');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [wishlist, setWishlist] = useState<number[]>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
      const stored = localStorage.getItem('reride_wishlist');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === 'number') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('reride_wishlist', JSON.stringify(wishlist || []));
      }
    } catch (error) {
      logWarn('Failed to persist wishlist:', error);
    }
  }, [wishlist]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('reride_comparison_list', JSON.stringify(comparisonList || []));
      }
    } catch (error) {
      logWarn('Failed to persist comparison list:', error);
    }
  }, [comparisonList]);

  useEffect(() => {
    if (!vehicles.length || !comparisonList.length) return;
    const sanitized = sanitizeComparisonList(vehicles, comparisonList);
    const changed =
      sanitized.length !== comparisonList.length ||
      sanitized.some((id, index) => id !== comparisonList[index]);
    if (changed) {
      setComparisonList(sanitized);
    }
  }, [vehicles, comparisonList]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('vehicleRatings', JSON.stringify(ratings || {}));
      }
    } catch (error) {
      logWarn('Failed to persist ratings:', error);
    }
  }, [ratings]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('sellerRatings', JSON.stringify(sellerRatings || {}));
      }
    } catch (error) {
      logWarn('Failed to persist seller ratings:', error);
    }
  }, [sellerRatings]);

  const comparisonCategory = useMemo(
    () => getComparisonCategory(vehicles, comparisonList),
    [vehicles, comparisonList],
  );

  const recommendations = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    return vehicles
      .filter((v) => v.status === 'published')
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 6);
  }, [vehicles]);

  const value: CatalogContextType = {
    vehicles,
    setVehicles,
    users,
    setUsers,
    isLoading,
    setIsLoading,
    vehiclesCatalogReady,
    setVehiclesCatalogReady,
    comparisonList,
    setComparisonList,
    wishlist,
    setWishlist,
    ratings,
    setRatings,
    sellerRatings,
    setSellerRatings,
    comparisonCategory,
    recommendations,
  };

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import VehicleCard from './VehicleCard.js';
import MobileVehicleCard from './MobileVehicleCard.js';
import MobileMarketplaceFilterModal from './MobileMarketplaceFilterModal.js';
import MobileSortSheet from './MobileSortSheet.js';
import { MOBILE_PRICE_BUCKETS, vehicleMatchesPriceBuckets } from './mobileFilterTypes.js';
import type { MobileFilterCategoryId } from './mobileFilterTypes.js';
import useIsMobileApp from '../hooks/useIsMobileApp.js';
import type { Vehicle, VehicleCategory, SavedSearch, SearchFilters } from '../types.js';
import { VehicleCategory as CategoryEnum } from '../types.js';
import { parseSearchQuery, getSearchSuggestions } from '../services/geminiService.js';
import VehicleTile from './VehicleTile.js';
import VehicleTileSkeleton from './VehicleTileSkeleton.js';
import { saveSearch as saveBuyerSearch } from '../services/buyerService.js';
import { getVehicleData } from '../services/vehicleDataService.js';
import { logInfo, logError } from '../utils/logger.js';
import type { VehicleData } from '../types.js';
import type { VehicleMake, VehicleModel } from '../vehicleDataTypes.js';
// Lazy load location data when needed

interface VehicleListProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  isLoading: boolean;
  comparisonList: number[];
  onToggleCompare: (id: number) => void;
  onClearCompare: () => void;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  categoryTitle?: string;
  initialCategory?: VehicleCategory | 'ALL';
  initialSearchQuery?: string;
  /**
   * Deterministic filters applied on mount / when the reference changes.
   * Use this for deep-linked chip clicks (budget, brand) instead of
   * round-tripping a natural-language string through the AI parser —
   * that path silently fails when the Gemini proxy is unreachable.
   */
  initialFilters?: Partial<SearchFilters>;
  isWishlistMode?: boolean;
  onViewSellerProfile: (sellerEmail: string) => void;
  userLocation?: string;
  currentUser?: { email: string; name: string } | null;
  onSaveSearch?: (search: SavedSearch) => void;
  selectedCity?: string;
  onCityChange?: (city: string) => void;
  /** Total vehicles from source (before filters). When 0, show load-error state with Retry. */
  sourceVehicleCount?: number;
  /** Called when user taps Retry in the "Unable to load vehicles" state. */
  onRetryLoadVehicles?: () => void | Promise<void>;
}

// Base items per page - optimized for performance (10-12 vehicles per load)
const BASE_ITEMS_PER_PAGE = 12;

/** Scroll root id set on MobileLayout `<main>` — avoids walking the tree and fixes IO root when overflow is scrollable but heights match before paint. */
const MOBILE_SCROLL_ROOT_ID = 'mobile-app-scroll-root';

/** Nearest scrollable ancestor — IntersectionObserver defaults to the viewport, which breaks load-more inside MobileLayout's overflow-y main. */
function getScrollableAncestor(el: Element | null): Element | null {
  if (typeof document === 'undefined' || !el) return null;
  const designated = document.getElementById(MOBILE_SCROLL_ROOT_ID);
  if (designated && designated.contains(el)) {
    return designated;
  }
  let node: Element | null = el.parentElement;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    // Do not require scrollHeight > clientHeight: the root is still the correct IO root for overflow:auto/scroll even when content is short or layout is mid-paint.
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// Amazon/Flipkart-style skeleton loader with shimmer effect
const VehicleCardSkeleton: React.FC = () => (
    <div className="bg-white rounded-xl shadow-soft-lg overflow-hidden relative">
      {/* Image skeleton with shimmer - Amazon/Flipkart style */}
      <div className="w-full h-40 sm:h-56 skeleton relative overflow-hidden"></div>
      <div className="p-3 sm:p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="h-5 sm:h-6 skeleton rounded w-3/5"></div>
          <div className="h-5 sm:h-6 skeleton rounded w-1/5"></div>
        </div>
        <div className="h-3 sm:h-4 skeleton rounded w-1/3 mb-4"></div>
        <div className="h-px bg-gray-200 my-3 sm:my-4"></div>
        <div className="grid grid-cols-2 gap-2">
           <div className="h-4 sm:h-5 skeleton rounded w-full"></div>
           <div className="h-4 sm:h-5 skeleton rounded w-full"></div>
           <div className="h-4 sm:h-5 skeleton rounded w-full"></div>
           <div className="h-4 sm:h-5 skeleton rounded w-full"></div>
        </div>
        <div className="flex justify-between items-center mt-4 sm:mt-6">
           <div className="h-7 sm:h-8 skeleton rounded w-2/5"></div>
           <div className="h-5 sm:h-6 skeleton rounded w-1/4"></div>
        </div>
      </div>
    </div>
);

const MIN_PRICE = 50000;
const MAX_PRICE = 5000000;
const MIN_MILEAGE = 0;
const MAX_MILEAGE = 200000;

/** Haystack for client text match when AI parse fails or returns wrong casing. */
function vehicleSearchHaystack(v: Vehicle): string {
  return [
    v.make,
    v.model,
    v.variant,
    v.year != null ? String(v.year) : '',
    v.registrationYear != null ? String(v.registrationYear) : '',
    v.city,
    v.location,
    v.state,
    v.description,
    v.fuelType,
    v.transmission,
    v.color,
    ...(Array.isArray(v.features) ? v.features : []),
  ]
    .filter((x) => x != null && String(x).trim() !== '')
    .join(' ')
    .toLowerCase();
}

/** Every token (length ≥2) must appear in haystack; single-char queries match as substring. */
function vehicleMatchesSearchText(v: Vehicle, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = vehicleSearchHaystack(v);
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return hay.includes(q);
  return tokens.every((t) => hay.includes(t));
}

function resolveMakeFromList(parsed: string | undefined, makes: string[]): string | null {
  if (!parsed?.trim() || makes.length === 0) return null;
  const p = parsed.trim().toLowerCase();
  const exact = makes.find((m) => m.toLowerCase().trim() === p);
  if (exact) return exact;
  return makes.find((m) => p.includes(m.toLowerCase()) || m.toLowerCase().includes(p)) ?? null;
}

function resolveModelFromVehicles(
  parsed: string | undefined,
  canonicalMake: string,
  vehicleList: Vehicle[]
): string | null {
  if (!parsed?.trim() || !canonicalMake) return null;
  const models = [
    ...new Set(
      (vehicleList || [])
        .filter((v) => v.make && v.make.toLowerCase() === canonicalMake.toLowerCase())
        .map((v) => v.model)
        .filter(Boolean)
    ),
  ] as string[];
  if (models.length === 0) return null;
  const p = parsed.trim().toLowerCase();
  const exact = models.find((m) => m.toLowerCase().trim() === p);
  if (exact) return exact;
  return models.find((m) => p.includes(m.toLowerCase()) || m.toLowerCase().includes(p)) ?? null;
}

function resolveStringFromList(parsed: string | undefined, options: string[]): string | null {
  if (!parsed?.trim() || options.length === 0) return null;
  const p = parsed.trim().toLowerCase();
  const exact = options.find((o) => o.toLowerCase().trim() === p);
  if (exact) return exact;
  return options.find((o) => p.includes(o.toLowerCase()) || o.toLowerCase().includes(p)) ?? null;
}

function resolveCategoryFromParse(
  raw: string | undefined,
  categories: string[]
): VehicleCategory | null {
  if (!raw?.trim() || categories.length === 0) return null;
  const p = raw.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
  const norm = (c: string) => String(c).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
  const exact = categories.find((c) => norm(c) === p);
  if (exact) return exact as VehicleCategory;
  return (categories.find((c) => norm(c).includes(p) || p.includes(norm(c))) as VehicleCategory | undefined) ?? null;
}

function fuelsAndTransmissionsForScope(
  vehicleList: Vehicle[],
  cat: VehicleCategory | 'ALL',
  make: string,
  model: string
): { fuels: string[]; transmissions: string[] } {
  let list = vehicleList || [];
  if (cat !== 'ALL' && cat) {
    list = list.filter((v) => {
      if (!v.category) return false;
      const vc = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
      const fc = String(cat).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
      return vc === fc;
    });
  }
  if (make.trim()) {
    list = list.filter((v) => v.make?.toLowerCase().trim() === make.toLowerCase().trim());
  }
  if (model.trim()) {
    list = list.filter((v) => v.model?.toLowerCase().trim() === model.toLowerCase().trim());
  }
  const fuels = [...new Set(list.map((v) => v.fuelType).filter(Boolean))] as string[];
  const transmissions = [...new Set(list.map((v) => v.transmission).filter(Boolean))] as string[];
  return { fuels, transmissions };
}

type OwnershipFilterValue = '' | '1' | '2' | '3plus';

function normalizeParsedOwnership(raw: string | undefined): OwnershipFilterValue | '' {
  if (!raw?.trim()) return '';
  const s = raw.trim().toLowerCase();
  if (s === '1' || s === 'first' || s.includes('first owner')) return '1';
  if (s === '2' || s === 'second' || s.includes('second owner')) return '2';
  if (s === '3plus' || s.includes('third owner') || s.includes('3+') || s.includes('fourth')) return '3plus';
  return '';
}

interface VehicleListFilterSnapshot {
  categoryFilter: VehicleCategory | 'ALL';
  makeFilter: string;
  modelFilter: string;
  priceRange: { min: number; max: number };
  selectedPriceBuckets: string[];
  mileageRange: { min: number; max: number };
  fuelTypeFilter: string;
  yearFilter: string;
  stateFilter: string;
  isStateFilterUserSet: boolean;
  selectedCity: string | undefined;
  transmissionFilter: string;
  ownershipFilter: OwnershipFilterValue;
  yearBounds: { min: number | null; max: number | null };
}

function matchesVehicleFilters(vehicle: Vehicle, snap: VehicleListFilterSnapshot, aiSearchQuery: string): boolean {
  if (snap.categoryFilter !== 'ALL' && snap.categoryFilter) {
    if (!vehicle.category) return false;
    const vehicleCategory = String(vehicle.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
    const filterCategory = String(snap.categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
    if (vehicleCategory !== filterCategory) return false;
  }
  if (snap.makeFilter && snap.makeFilter.trim() !== '') {
    // Alias-aware comparison so a short chip value like "Maruti" still matches
    // the canonical catalog value "Maruti Suzuki" (and vice-versa). Keeps
    // exact match as the primary check to avoid false positives.
    const vm = vehicle.make?.toLowerCase().trim() ?? '';
    const fm = snap.makeFilter.toLowerCase().trim();
    if (!vm) return false;
    if (vm !== fm && !vm.includes(fm) && !fm.includes(vm)) return false;
  }
  if (snap.modelFilter && snap.modelFilter.trim() !== '') {
    const vmo = vehicle.model?.toLowerCase().trim() ?? '';
    const fmo = snap.modelFilter.toLowerCase().trim();
    if (!vmo) return false;
    if (vmo !== fmo && !vmo.includes(fmo) && !fmo.includes(vmo)) return false;
  }
  if (snap.selectedPriceBuckets.length > 0) {
    if (!vehicleMatchesPriceBuckets(vehicle.price, snap.selectedPriceBuckets)) return false;
  } else if (vehicle.price != null && typeof vehicle.price === 'number') {
    if (vehicle.price < snap.priceRange.min || vehicle.price > snap.priceRange.max) return false;
  }
  if (vehicle.mileage != null && typeof vehicle.mileage === 'number') {
    if (vehicle.mileage < snap.mileageRange.min || vehicle.mileage > snap.mileageRange.max) return false;
  }
  if (snap.fuelTypeFilter && snap.fuelTypeFilter.trim() !== '') {
    if (vehicle.fuelType?.toLowerCase().trim() !== snap.fuelTypeFilter.toLowerCase().trim()) return false;
  }
  if (snap.yearFilter && snap.yearFilter !== '0' && snap.yearFilter.trim() !== '') {
    const filterYear = Number(snap.yearFilter);
    if (isNaN(filterYear) || vehicle.year !== filterYear) return false;
  } else {
    if (snap.yearBounds.min != null && vehicle.year < snap.yearBounds.min) return false;
    if (snap.yearBounds.max != null && vehicle.year > snap.yearBounds.max) return false;
  }
  const cityScopeActive = Boolean(snap.selectedCity?.trim());
  if (snap.stateFilter && snap.stateFilter.trim() !== '' && snap.isStateFilterUserSet && !cityScopeActive) {
    if (vehicle.state?.trim() !== snap.stateFilter.trim()) return false;
  }
  if (snap.transmissionFilter && snap.transmissionFilter.trim() !== '') {
    if (vehicle.transmission?.toLowerCase().trim() !== snap.transmissionFilter.toLowerCase().trim()) return false;
  }
  if (snap.ownershipFilter) {
    const n = vehicle.noOfOwners;
    if (typeof n !== 'number' || Number.isNaN(n)) return false;
    if (snap.ownershipFilter === '1' && n !== 1) return false;
    if (snap.ownershipFilter === '2' && n !== 2) return false;
    if (snap.ownershipFilter === '3plus' && n < 3) return false;
  }
  if (!vehicleMatchesSearchText(vehicle, aiSearchQuery)) return false;
  return true;
}

const VehicleList: React.FC<VehicleListProps> = React.memo(({ 
  vehicles, 
  onSelectVehicle, 
  isLoading, 
  comparisonList, 
  onToggleCompare, 
  onClearCompare, 
  wishlist, 
  onToggleWishlist, 
  categoryTitle, 
  initialCategory = 'ALL', 
  initialSearchQuery = '', 
  initialFilters,
  isWishlistMode = false, 
  onViewSellerProfile, 
  userLocation = '', 
  currentUser, 
  onSaveSearch,
  selectedCity,
  onCityChange,
  sourceVehicleCount,
  onRetryLoadVehicles
}) => {
  const [aiSearchQuery, setAiSearchQuery] = useState(initialSearchQuery);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Vehicle data for filters
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [isLoadingVehicleData, setIsLoadingVehicleData] = useState(true);
  
  // Lazy load location data
  const [indianStates, setIndianStates] = useState<Array<{name: string, code: string}>>([]);

  // Load vehicle data for filters with caching
  useEffect(() => {
    const loadVehicleDataForFilters = async () => {
      try {
        setIsLoadingVehicleData(true);
        
        // Check cache first
        try {
          const cachedData = localStorage.getItem('reRideVehicleDataFilters');
          if (cachedData) {
            const { data: cached, timestamp } = JSON.parse(cachedData);
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              setVehicleData(cached);
              setIsLoadingVehicleData(false);
              return;
            }
          }
        } catch { /* storage unavailable */ }
        
        const data = await getVehicleData();
        setVehicleData(data);
        
        // Cache the data
        try {
          localStorage.setItem('reRideVehicleDataFilters', JSON.stringify({
            data,
            timestamp: Date.now()
          }));
        } catch { /* storage unavailable */ }
        
        // Logging handled by logger utility
      } catch (error) {
        // Error logging handled by logger utility
      } finally {
        setIsLoadingVehicleData(false);
      }
    };

    loadVehicleDataForFilters();
  }, []);
  
  const [makeFilter, setMakeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [priceRange, setPriceRange] = useState({ min: MIN_PRICE, max: MAX_PRICE });
  const [mileageRange, setMileageRange] = useState({ min: MIN_MILEAGE, max: MAX_MILEAGE });
  const [fuelTypeFilter, setFuelTypeFilter] = useState('');
  const [transmissionFilter, setTransmissionFilter] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilterValue>('');
  const [selectedPriceBuckets, setSelectedPriceBuckets] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState('0');
  const [yearBounds, setYearBounds] = useState<{ min: number | null; max: number | null }>({
    min: null,
    max: null,
  });
  const [stateFilter, setStateFilter] = useState('');
  const [isStateFilterUserSet, setIsStateFilterUserSet] = useState(false); // Track if state filter was explicitly set by user
  const [sortOrder, setSortOrder] = useState('YEAR_DESC');
  const [categoryFilter, setCategoryFilter] = useState<VehicleCategory | 'ALL'>(initialCategory || 'ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDesktopFilterVisible, setIsDesktopFilterVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'tile'>('grid');
  const [isAiSearchCollapsed, setIsAiSearchCollapsed] = useState(true); // Start collapsed on mobile for better UX
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(true);
  const isLoadingMoreRef = useRef(false);
  
  // Infinite scroll pagination - load 12 vehicles at a time

  // Mobile modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({
    categoryFilter: initialCategory,
    makeFilter: '',
    modelFilter: '',
    priceRange: { min: MIN_PRICE, max: MAX_PRICE },
    mileageRange: { min: MIN_MILEAGE, max: MAX_MILEAGE },
    fuelTypeFilter: '',
    transmissionFilter: '',
    ownershipFilter: '' as OwnershipFilterValue,
    selectedPriceBuckets: [] as string[],
    yearFilter: '0',
    yearMin: null as number | null,
    yearMax: null as number | null,
    stateFilter: '',
  });
  const [mobileFilterCategory, setMobileFilterCategory] = useState<MobileFilterCategoryId>('price');
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);
  const [initialStateFilter, setInitialStateFilter] = useState('');
  const [initialIsStateFilterUserSet, setInitialIsStateFilterUserSet] = useState(false);

  // Mobile app detection
  const { isMobileApp } = useIsMobileApp();
  const { t } = useTranslation();
  const sortOptions = useMemo(
    () => ({
      YEAR_DESC: t('listings.sort.yearDesc'),
      RATING_DESC: t('listings.sort.ratingDesc'),
      PRICE_ASC: t('listings.sort.priceAsc'),
      PRICE_DESC: t('listings.sort.priceDesc'),
      MILEAGE_ASC: t('listings.sort.mileageAsc'),
    }),
    [t]
  );

  const aiSearchRef = useRef<HTMLDivElement>(null);
  const suggestionDebounceRef = useRef<number | null>(null);

  // Get categories from admin database vehicle data
  const uniqueCategories = useMemo(() => {
    if (vehicleData && !isLoadingVehicleData) {
      // Get categories from admin database
      const categoriesFromDb = Object.keys(vehicleData).sort();
      // Ensure categories match VehicleCategory enum format
      return categoriesFromDb.map(cat => {
        // If already in enum format, return as is
        if (Object.values(CategoryEnum).includes(cat as VehicleCategory)) {
          return cat;
        }
        // Try to match enum values by normalizing
        const normalized = cat.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
        const enumValues = Object.values(CategoryEnum);
        const matched = enumValues.find(enumVal => enumVal.toLowerCase() === normalized);
        return matched || cat; // Return matched enum value or original
      });
    }
    // Fallback to enum values
    return Object.values(CategoryEnum);
  }, [vehicleData, isLoadingVehicleData]);

  // Get makes from admin database vehicle data, filtered by selected category
  const uniqueMakes = useMemo(() => {
    if (vehicleData && !isLoadingVehicleData) {
      // Get makes from admin database
      const makesFromDb = new Set<string>();
      
      // If a category filter is active, only get makes from that category
      if (categoryFilter !== 'ALL' && categoryFilter) {
        const normalizedCategory = String(categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        // Find matching category key in vehicleData
        const categoryEntry = Object.entries(vehicleData).find(([key]) => {
          const normalizedKey = String(key).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return normalizedKey === normalizedCategory;
        });
        
        if (categoryEntry) {
          const [, categoryData] = categoryEntry;
          categoryData.forEach((make: VehicleMake) => {
            makesFromDb.add(make.name);
          });
        }
      } else {
        // No category filter - show all makes from all categories
        Object.values(vehicleData).forEach((categoryData: VehicleMake[]) => {
          categoryData.forEach((make: VehicleMake) => {
            makesFromDb.add(make.name);
          });
        });
      }
      return Array.from(makesFromDb).sort();
    }
    // Fallback to vehicle makes - filter by category if active
    const filteredVehicles = categoryFilter !== 'ALL' && categoryFilter
      ? (vehicles || []).filter(v => {
          if (!v.category) return false;
          const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          const filterCategory = String(categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return vehicleCategory === filterCategory;
        })
      : (vehicles || []);
    return [...new Set(filteredVehicles.map(v => v.make))].sort();
  }, [vehicleData, isLoadingVehicleData, vehicles, categoryFilter]);

  // Get makes for mobile temp filters, filtered by selected category
  const tempUniqueMakes = useMemo(() => {
    if (vehicleData && !isLoadingVehicleData) {
      // Get makes from admin database
      const makesFromDb = new Set<string>();
      
      // If a category filter is active, only get makes from that category
      if (tempFilters.categoryFilter !== 'ALL' && tempFilters.categoryFilter) {
        const normalizedCategory = String(tempFilters.categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        // Find matching category key in vehicleData
        const categoryEntry = Object.entries(vehicleData).find(([key]) => {
          const normalizedKey = String(key).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return normalizedKey === normalizedCategory;
        });
        
        if (categoryEntry) {
          const [, categoryData] = categoryEntry;
          categoryData.forEach((make: VehicleMake) => {
            makesFromDb.add(make.name);
          });
        }
      } else {
        // No category filter - show all makes from all categories
        Object.values(vehicleData).forEach((categoryData: VehicleMake[]) => {
          categoryData.forEach((make: VehicleMake) => {
            makesFromDb.add(make.name);
          });
        });
      }
      return Array.from(makesFromDb).sort();
    }
    // Fallback to vehicle makes - filter by category if active
    const filteredVehicles = tempFilters.categoryFilter !== 'ALL' && tempFilters.categoryFilter
      ? (vehicles || []).filter(v => {
          if (!v.category) return false;
          const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          const filterCategory = String(tempFilters.categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return vehicleCategory === filterCategory;
        })
      : (vehicles || []);
    return [...new Set(filteredVehicles.map(v => v.make))].sort();
  }, [vehicleData, isLoadingVehicleData, vehicles, tempFilters.categoryFilter]);

  const availableModels = useMemo(() => {
    if (!makeFilter) return [];
    
    if (vehicleData && !isLoadingVehicleData) {
      // Get models from admin database, filtered by category if active
      const modelsFromDb = new Set<string>();
      
      if (categoryFilter !== 'ALL' && categoryFilter) {
        // Filter by category
        const normalizedCategory = String(categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        const categoryEntry = Object.entries(vehicleData).find(([key]) => {
          const normalizedKey = String(key).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return normalizedKey === normalizedCategory;
        });
        
        if (categoryEntry) {
          const [, categoryData] = categoryEntry;
          categoryData.forEach((make: VehicleMake) => {
            if (make.name === makeFilter) {
              make.models.forEach((model: VehicleModel) => {
                modelsFromDb.add(model.name);
              });
            }
          });
        }
      } else {
        // No category filter - show all models for the make across all categories
        Object.values(vehicleData).forEach((categoryData: VehicleMake[]) => {
          categoryData.forEach((make: VehicleMake) => {
            if (make.name === makeFilter) {
              make.models.forEach((model: VehicleModel) => {
                modelsFromDb.add(model.name);
              });
            }
          });
        });
      }
      return Array.from(modelsFromDb).sort();
    }
    
    // Fallback to vehicle models - filter by category if active
    let filteredVehicles = (vehicles || []).filter(v => v.make === makeFilter);
    if (categoryFilter !== 'ALL' && categoryFilter) {
      filteredVehicles = filteredVehicles.filter(v => {
        if (!v.category) return false;
        const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        const filterCategory = String(categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        return vehicleCategory === filterCategory;
      });
    }
    return [...new Set(filteredVehicles.map(v => v.model))].sort();
  }, [makeFilter, vehicleData, isLoadingVehicleData, vehicles, categoryFilter]);
  const tempAvailableModels = useMemo(() => {
      if (!tempFilters.makeFilter) return [];
      
      if (vehicleData && !isLoadingVehicleData) {
        // Get models from admin database, filtered by category if active
        const modelsFromDb = new Set<string>();
        
        if (tempFilters.categoryFilter !== 'ALL' && tempFilters.categoryFilter) {
          // Filter by category
          const normalizedCategory = String(tempFilters.categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          const categoryEntry = Object.entries(vehicleData).find(([key]) => {
            const normalizedKey = String(key).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
            return normalizedKey === normalizedCategory;
          });
          
          if (categoryEntry) {
            const [, categoryData] = categoryEntry;
            categoryData.forEach((make: VehicleMake) => {
              if (make.name === tempFilters.makeFilter) {
                make.models.forEach((model: VehicleModel) => {
                  modelsFromDb.add(model.name);
                });
              }
            });
          }
        } else {
          // No category filter - show all models for the make across all categories
          Object.values(vehicleData).forEach((categoryData: VehicleMake[]) => {
            categoryData.forEach((make: VehicleMake) => {
              if (make.name === tempFilters.makeFilter) {
                make.models.forEach((model: VehicleModel) => {
                  modelsFromDb.add(model.name);
                });
              }
            });
          });
        }
        return Array.from(modelsFromDb).sort();
      }
      
      // Fallback to vehicle models - filter by category if active
      let filteredVehicles = (vehicles || []).filter(v => v.make === tempFilters.makeFilter);
      if (tempFilters.categoryFilter !== 'ALL' && tempFilters.categoryFilter) {
        filteredVehicles = filteredVehicles.filter(v => {
          if (!v.category) return false;
          const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          const filterCategory = String(tempFilters.categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return vehicleCategory === filterCategory;
        });
      }
      return [...new Set(filteredVehicles.map(v => v.model))].sort();
  }, [tempFilters.makeFilter, tempFilters.categoryFilter, vehicleData, isLoadingVehicleData, vehicles]);
  
  // Filter years, colors, and fuel types based on selected category and make/model
  const uniqueYears = useMemo(() => {
    let filteredVehicles = vehicles || [];
    
    // Filter by category if active
    if (categoryFilter !== 'ALL' && categoryFilter) {
      filteredVehicles = filteredVehicles.filter(v => {
        if (!v.category) return false;
        const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        const filterCategory = String(categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        return vehicleCategory === filterCategory;
      });
    }
    
    // Filter by make if active
    if (makeFilter && makeFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter(v => v.make?.toLowerCase().trim() === makeFilter.toLowerCase().trim());
    }
    
    // Filter by model if active
    if (modelFilter && modelFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter(v => v.model?.toLowerCase().trim() === modelFilter.toLowerCase().trim());
    }
    
    return [...new Set(filteredVehicles.map(v => v.year))].sort((a, b) => Number(b) - Number(a));
  }, [vehicles, categoryFilter, makeFilter, modelFilter]);
  
  // Filter fuel types based on selected category and make/model
  const uniqueFuelTypes = useMemo(() => {
    let filteredVehicles = vehicles || [];
    
    // Filter by category if active
    if (categoryFilter !== 'ALL' && categoryFilter) {
      filteredVehicles = filteredVehicles.filter(v => {
        if (!v.category) return false;
        const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        const filterCategory = String(categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        return vehicleCategory === filterCategory;
      });
    }
    
    // Filter by make if active
    if (makeFilter && makeFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter(v => v.make?.toLowerCase().trim() === makeFilter.toLowerCase().trim());
    }
    
    // Filter by model if active
    if (modelFilter && modelFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter(v => v.model?.toLowerCase().trim() === modelFilter.toLowerCase().trim());
    }
    
    return [...new Set(filteredVehicles.map(v => v.fuelType).filter(Boolean))].sort();
  }, [vehicles, categoryFilter, makeFilter, modelFilter]);

  const uniqueTransmissions = useMemo(() => {
    let filteredVehicles = vehicles || [];
    if (categoryFilter !== 'ALL' && categoryFilter) {
      filteredVehicles = filteredVehicles.filter((v) => {
        if (!v.category) return false;
        const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        const filterCategory = String(categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        return vehicleCategory === filterCategory;
      });
    }
    if (makeFilter && makeFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter((v) => v.make?.toLowerCase().trim() === makeFilter.toLowerCase().trim());
    }
    if (modelFilter && modelFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter((v) => v.model?.toLowerCase().trim() === modelFilter.toLowerCase().trim());
    }
    return [...new Set(filteredVehicles.map((v) => v.transmission).filter(Boolean))].sort();
  }, [vehicles, categoryFilter, makeFilter, modelFilter]);
  
  const uniqueStates = useMemo(() => indianStates, [indianStates]);
  
  // Temp versions for mobile filters
  const tempUniqueYears = useMemo(() => {
    let filteredVehicles = vehicles || [];
    
    // Filter by category if active
    if (tempFilters.categoryFilter !== 'ALL' && tempFilters.categoryFilter) {
      filteredVehicles = filteredVehicles.filter(v => {
        if (!v.category) return false;
        const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        const filterCategory = String(tempFilters.categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        return vehicleCategory === filterCategory;
      });
    }
    
    // Filter by make if active
    if (tempFilters.makeFilter && tempFilters.makeFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter(v => v.make?.toLowerCase().trim() === tempFilters.makeFilter.toLowerCase().trim());
    }
    
    // Filter by model if active
    if (tempFilters.modelFilter && tempFilters.modelFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter(v => v.model?.toLowerCase().trim() === tempFilters.modelFilter.toLowerCase().trim());
    }
    
    return [...new Set(filteredVehicles.map(v => v.year))].sort((a, b) => Number(b) - Number(a));
  }, [vehicles, tempFilters.categoryFilter, tempFilters.makeFilter, tempFilters.modelFilter]);
  
  const tempUniqueFuelTypes = useMemo(() => {
    let filteredVehicles = vehicles || [];
    
    // Filter by category if active
    if (tempFilters.categoryFilter !== 'ALL' && tempFilters.categoryFilter) {
      filteredVehicles = filteredVehicles.filter(v => {
        if (!v.category) return false;
        const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        const filterCategory = String(tempFilters.categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        return vehicleCategory === filterCategory;
      });
    }
    
    // Filter by make if active
    if (tempFilters.makeFilter && tempFilters.makeFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter(v => v.make?.toLowerCase().trim() === tempFilters.makeFilter.toLowerCase().trim());
    }
    
    // Filter by model if active
    if (tempFilters.modelFilter && tempFilters.modelFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter(v => v.model?.toLowerCase().trim() === tempFilters.modelFilter.toLowerCase().trim());
    }
    
    return [...new Set(filteredVehicles.map(v => v.fuelType).filter(Boolean))].sort();
  }, [vehicles, tempFilters.categoryFilter, tempFilters.makeFilter, tempFilters.modelFilter]);

  const tempUniqueTransmissions = useMemo(() => {
    let filteredVehicles = vehicles || [];
    if (tempFilters.categoryFilter !== 'ALL' && tempFilters.categoryFilter) {
      filteredVehicles = filteredVehicles.filter((v) => {
        if (!v.category) return false;
        const vehicleCategory = String(v.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        const filterCategory = String(tempFilters.categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
        return vehicleCategory === filterCategory;
      });
    }
    if (tempFilters.makeFilter && tempFilters.makeFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter((v) =>
        v.make?.toLowerCase().trim() === tempFilters.makeFilter.toLowerCase().trim()
      );
    }
    if (tempFilters.modelFilter && tempFilters.modelFilter.trim() !== '') {
      filteredVehicles = filteredVehicles.filter((v) =>
        v.model?.toLowerCase().trim() === tempFilters.modelFilter.toLowerCase().trim()
      );
    }
    return [...new Set(filteredVehicles.map((v) => v.transmission).filter(Boolean))].sort();
  }, [vehicles, tempFilters.categoryFilter, tempFilters.makeFilter, tempFilters.modelFilter]);

  const handleAiSearch = async (queryOverride?: string) => {
    const query = typeof queryOverride === 'string' ? queryOverride : aiSearchQuery;
    if (!query.trim()) return;

    setShowSuggestions(false);
    setIsAiSearching(true);
    const parsedFilters = await parseSearchQuery(query);

    let nextCat: VehicleCategory | 'ALL' = categoryFilter;
    let nextMake = makeFilter;
    let nextModel = modelFilter;

    if (parsedFilters.category) {
      const rc = resolveCategoryFromParse(parsedFilters.category, uniqueCategories as string[]);
      if (rc) {
        nextCat = rc;
        nextMake = '';
        nextModel = '';
        setCategoryFilter(rc);
        setMakeFilter('');
        setModelFilter('');
      }
    }

    const resolvedMake = resolveMakeFromList(parsedFilters.make, uniqueMakes);
    if (resolvedMake) {
      nextMake = resolvedMake;
      setMakeFilter(resolvedMake);
      const resolvedModel = resolveModelFromVehicles(parsedFilters.model, resolvedMake, vehicles || []);
      nextModel = resolvedModel ?? '';
      setModelFilter(resolvedModel ?? '');
    } else if (parsedFilters.model && nextMake) {
      const resolvedModel = resolveModelFromVehicles(parsedFilters.model, nextMake, vehicles || []);
      if (resolvedModel) {
        nextModel = resolvedModel;
        setModelFilter(resolvedModel);
      }
    }

    const { fuels, transmissions } = fuelsAndTransmissionsForScope(vehicles || [], nextCat, nextMake, nextModel);
    if (parsedFilters.fuelType) {
      const f = resolveStringFromList(parsedFilters.fuelType, fuels);
      if (f) setFuelTypeFilter(f);
    }
    if (parsedFilters.transmission) {
      const tr = resolveStringFromList(parsedFilters.transmission, transmissions);
      if (tr) setTransmissionFilter(tr);
    }

    const ownStr = String(parsedFilters.ownership ?? '').trim();
    const own =
      ownStr && ['1', '2', '3plus'].includes(ownStr)
        ? (ownStr as OwnershipFilterValue)
        : normalizeParsedOwnership(ownStr || undefined);
    if (own) setOwnershipFilter(own);

    if (parsedFilters.minMileage != null || parsedFilters.maxMileage != null) {
      setMileageRange({
        min: parsedFilters.minMileage != null ? parsedFilters.minMileage : MIN_MILEAGE,
        max: parsedFilters.maxMileage != null ? parsedFilters.maxMileage : MAX_MILEAGE,
      });
    }

    if (parsedFilters.minPrice != null || parsedFilters.maxPrice != null) {
      setSelectedPriceBuckets([]);
      setPriceRange({
        min: parsedFilters.minPrice != null ? parsedFilters.minPrice : MIN_PRICE,
        max: parsedFilters.maxPrice != null ? parsedFilters.maxPrice : MAX_PRICE,
      });
    }

    if (parsedFilters.year != null && Number.isFinite(parsedFilters.year)) {
      setYearFilter(String(Math.round(parsedFilters.year)));
      setYearBounds({ min: null, max: null });
    } else if (parsedFilters.minYear != null || parsedFilters.maxYear != null) {
      setYearFilter('0');
      setYearBounds({
        min:
          parsedFilters.minYear != null && Number.isFinite(parsedFilters.minYear)
            ? Math.round(parsedFilters.minYear)
            : null,
        max:
          parsedFilters.maxYear != null && Number.isFinite(parsedFilters.maxYear)
            ? Math.round(parsedFilters.maxYear)
            : null,
      });
    }

    if (parsedFilters.location?.trim() && indianStates.length > 0) {
      const loc = parsedFilters.location.trim().toLowerCase();
      const st = indianStates.find(
        (s) =>
          s.name.toLowerCase() === loc ||
          s.code.toLowerCase() === loc ||
          s.name.toLowerCase().includes(loc) ||
          loc.includes(s.name.toLowerCase())
      );
      if (st) {
        setStateFilter(st.code);
        setIsStateFilterUserSet(true);
      }
    }

    setIsAiSearching(false);
  };

  useEffect(() => {
    if (!initialSearchQuery?.trim()) return;
    setAiSearchQuery(initialSearchQuery);
    void handleAiSearch(initialSearchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearchQuery]);

  // Deep-linked structured filters: apply directly via setters so chip
  // clicks (budget, brand, fuel) don't depend on the Gemini proxy.
  //
  // The dependency key is a stable JSON serialization of the payload so a
  // new object reference with the same values doesn't re-trigger.
  const initialFiltersKey = initialFilters ? JSON.stringify(initialFilters) : '';
  useEffect(() => {
    if (!initialFilters) return;
    const hasAny =
      initialFilters.make ||
      initialFilters.model ||
      initialFilters.category ||
      initialFilters.fuelType ||
      initialFilters.transmission ||
      initialFilters.location ||
      initialFilters.minPrice != null ||
      initialFilters.maxPrice != null ||
      initialFilters.minYear != null ||
      initialFilters.maxYear != null ||
      initialFilters.year != null ||
      initialFilters.minMileage != null ||
      initialFilters.maxMileage != null ||
      initialFilters.ownership;
    if (!hasAny) return;

    if (initialFilters.category) {
      setCategoryFilter(initialFilters.category);
    }
    if (initialFilters.make != null) {
      setMakeFilter(initialFilters.make);
    }
    if (initialFilters.model != null) {
      setModelFilter(initialFilters.model);
    }
    if (initialFilters.minPrice != null || initialFilters.maxPrice != null) {
      setSelectedPriceBuckets([]);
      setPriceRange({
        min: initialFilters.minPrice != null ? initialFilters.minPrice : MIN_PRICE,
        max: initialFilters.maxPrice != null ? initialFilters.maxPrice : MAX_PRICE,
      });
    }
    if (initialFilters.minMileage != null || initialFilters.maxMileage != null) {
      setMileageRange({
        min: initialFilters.minMileage != null ? initialFilters.minMileage : MIN_MILEAGE,
        max: initialFilters.maxMileage != null ? initialFilters.maxMileage : MAX_MILEAGE,
      });
    }
    if (initialFilters.fuelType) {
      setFuelTypeFilter(initialFilters.fuelType);
    }
    if (initialFilters.transmission) {
      setTransmissionFilter(initialFilters.transmission);
    }
    if (initialFilters.ownership) {
      setOwnershipFilter(initialFilters.ownership as OwnershipFilterValue);
    }
    if (initialFilters.year != null && Number.isFinite(initialFilters.year)) {
      setYearFilter(String(Math.round(initialFilters.year)));
      setYearBounds({ min: null, max: null });
    } else if (initialFilters.minYear != null || initialFilters.maxYear != null) {
      setYearFilter('0');
      setYearBounds({
        min:
          initialFilters.minYear != null && Number.isFinite(initialFilters.minYear)
            ? Math.round(initialFilters.minYear)
            : null,
        max:
          initialFilters.maxYear != null && Number.isFinite(initialFilters.maxYear)
            ? Math.round(initialFilters.maxYear)
            : null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiltersKey]);

  // When a chip sent a short make like "Maruti" but the catalog stores the
  // canonical name "Maruti Suzuki", swap to the canonical value so the filter
  // dropdown shows the right selection (and downstream logic behaves
  // consistently). No-op if already exact or nothing loaded.
  useEffect(() => {
    if (!makeFilter) return;
    if (!uniqueMakes || uniqueMakes.length === 0) return;
    const canonical = resolveMakeFromList(makeFilter, uniqueMakes);
    if (canonical && canonical !== makeFilter) {
      setMakeFilter(canonical);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeFilter, uniqueMakes]);

  useEffect(() => {
    setCategoryFilter(initialCategory);
  }, [initialCategory]);

  // Load location and fuel data when component mounts
  useEffect(() => {
    const loadLocationData = async () => {
      try {
        const { loadLocationData: loadLoc } = await import('../utils/dataLoaders');
        const locationData = await loadLoc();
        const { INDIAN_STATES } = await locationData;
        
        setIndianStates(INDIAN_STATES);
        
        // Set initial state filter based on user location (but don't count it as user-set)
        if (userLocation) {
          const state = INDIAN_STATES.find(s => 
            s.name.toLowerCase().includes(userLocation.toLowerCase()) || 
            userLocation.toLowerCase().includes(s.name.toLowerCase())
          );
          if (state) {
            setStateFilter(state.code);
            setIsStateFilterUserSet(false); // Mark as auto-set, not user-set
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          logError('Failed to load location data:', error);
        }
      }
    };
    loadLocationData();
  }, [userLocation]);

  // Update state filter when user location changes (but don't count it as user-set)
  useEffect(() => {
    if (userLocation && indianStates.length > 0) {
      const state = indianStates.find(s => 
        s.name.toLowerCase().includes(userLocation.toLowerCase()) || 
        userLocation.toLowerCase().includes(s.name.toLowerCase())
      );
      if (state && !isStateFilterUserSet) {
        // Only auto-set if user hasn't explicitly set it
        setStateFilter(state.code);
      }
    }
  }, [userLocation, indianStates, isStateFilterUserSet]);

  // Sync selectedCity with state filter - when city is selected, update state filter
  useEffect(() => {
    if (!selectedCity || !onCityChange) return; // Only sync if props are provided
    
    if (selectedCity.trim() !== '' && indianStates.length > 0) {
      // Import city mapping utility
      import('../utils/cityMapping').then(({ getStateCodeForCity }) => {
        import('../constants/location.js').then(({ CITIES_BY_STATE }) => {
          const stateCode = getStateCodeForCity(selectedCity, CITIES_BY_STATE);
          if (stateCode && stateCode !== stateFilter) {
            if (process.env.NODE_ENV === 'development') {
              logInfo('🔵 VehicleList: Updating state filter to', stateCode, 'for city', selectedCity);
            }
            setStateFilter(stateCode);
            setIsStateFilterUserSet(true); // Mark as user-set since it came from city selection
          }
        });
      });
    } else if (selectedCity.trim() === '') {
      // If city is cleared, also clear state filter if it was set from city
      // We'll clear it if it was user-set (likely came from city selection)
      if (isStateFilterUserSet && stateFilter) {
        if (process.env.NODE_ENV === 'development') {
          logInfo('🔵 VehicleList: Clearing state filter because city was cleared');
        }
        setStateFilter('');
        setIsStateFilterUserSet(false);
      }
    }
  }, [selectedCity, onCityChange, indianStates, stateFilter, isStateFilterUserSet]); // Include all dependencies to avoid stale closures

  // Sync state filter changes back to city (clear city when state changes manually)
  const prevStateFilterRef = useRef(stateFilter);
  useEffect(() => {
    if (!onCityChange || !selectedCity) return; // Only sync if props are provided
    
    // Only sync if state filter was manually changed (not from city selection)
    if (prevStateFilterRef.current !== stateFilter && isStateFilterUserSet) {
      // Check if the current city matches the new state
      import('../utils/cityMapping').then(({ getStateCodeForCity }) => {
        import('../constants/location.js').then(({ CITIES_BY_STATE }) => {
          const cityStateCode = getStateCodeForCity(selectedCity, CITIES_BY_STATE);
          if (cityStateCode !== stateFilter) {
            // City doesn't match the selected state, clear city
            if (process.env.NODE_ENV === 'development') {
              logInfo('🔵 VehicleList: Clearing city because state filter changed to', stateFilter);
            }
            onCityChange('');
          }
        });
      });
    }
    prevStateFilterRef.current = stateFilter;
  }, [stateFilter, isStateFilterUserSet, selectedCity, onCityChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (aiSearchRef.current && !aiSearchRef.current.contains(event.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, []);

  
  useEffect(() => {
    const body = document.body;
    if (!body) return;
    if (isFilterModalOpen) {
        body.style.overflow = 'hidden';
    } else {
        body.style.overflow = 'auto';
    }
    return () => {
      if (document.body) document.body.style.overflow = 'auto';
    };
  }, [isFilterModalOpen]);

  // Mobile Modal Filter Logic
  const handleOpenFilterModal = (section?: MobileFilterCategoryId) => {
    setInitialStateFilter(stateFilter);
    setInitialIsStateFilterUserSet(isStateFilterUserSet);
    setTempFilters({
      categoryFilter,
      makeFilter,
      modelFilter,
      priceRange,
      mileageRange,
      fuelTypeFilter,
      transmissionFilter,
      ownershipFilter,
      selectedPriceBuckets: [...selectedPriceBuckets],
      yearFilter,
      yearMin: yearBounds.min,
      yearMax: yearBounds.max,
      stateFilter,
    });
    if (section) setMobileFilterCategory(section);
    setIsFilterModalOpen(true);
  };
  
  const handleCloseFilterModal = () => {
    setIsFilterModalOpen(false);
  };

  const handleApplyFilters = () => {
    try {
      // Get available options for the selected category/make/model
      const categoryForValidation = tempFilters.categoryFilter;
      const makeForValidation = tempFilters.makeFilter?.trim() || '';
      const modelForValidation = tempFilters.modelFilter?.trim() || '';
      
      // Validate fuel type - reset if not available for selected category/make/model
      let validFuelType = tempFilters.fuelTypeFilter?.trim() || '';
      if (validFuelType) {
        const tempFuelTypes = tempUniqueFuelTypes;
        if (!tempFuelTypes.includes(validFuelType)) {
          validFuelType = '';
        }
      }
      
      // Validate year - reset if not available for selected category/make/model
      let validYear = tempFilters.yearFilter || '0';
      if (validYear !== '0') {
        const tempYears = tempUniqueYears;
        if (!tempYears.includes(Number(validYear))) {
          validYear = '0';
        }
      }
      
      let validTransmission = tempFilters.transmissionFilter?.trim() || '';
      if (validTransmission && !tempUniqueTransmissions.includes(validTransmission)) {
        validTransmission = '';
      }
      
      // Batch all state updates together - use functional updates to ensure consistency
      setCategoryFilter(categoryForValidation);
      setMakeFilter(makeForValidation);
      setModelFilter(modelForValidation);
      // Create new objects/arrays to ensure React detects the change
      setPriceRange({ 
        min: Number(tempFilters.priceRange.min), 
        max: Number(tempFilters.priceRange.max) 
      });
      setMileageRange({ 
        min: Number(tempFilters.mileageRange.min), 
        max: Number(tempFilters.mileageRange.max) 
      });
      setFuelTypeFilter(validFuelType);
      setTransmissionFilter(validTransmission);
      setOwnershipFilter(tempFilters.ownershipFilter || '');
      setSelectedPriceBuckets(
        Array.isArray(tempFilters.selectedPriceBuckets) ? [...tempFilters.selectedPriceBuckets] : []
      );
      setYearFilter(validYear);
      setYearBounds({ min: tempFilters.yearMin ?? null, max: tempFilters.yearMax ?? null });
      setStateFilter(tempFilters.stateFilter?.trim() || '');
      
      // Only mark state filter as user-set if it was actually changed in the modal
      const newStateFilter = tempFilters.stateFilter?.trim() || '';
      const stateFilterChanged = newStateFilter !== initialStateFilter;
      setIsStateFilterUserSet(stateFilterChanged ? !!(newStateFilter && newStateFilter !== '') : initialIsStateFilterUserSet);

      // If the user just cleared the state filter but a city is still selected,
      // clear the city too — otherwise the selectedCity -> stateFilter sync
      // effect immediately re-applies the state filter right after Apply runs,
      // which is why "Clear All" + "View All X Cars" appeared to do nothing.
      if (!newStateFilter && onCityChange && selectedCity?.trim()) {
        onCityChange('');
      }
      
      setCurrentPage(1); // Reset to first page when filters are applied
      
      // Close modal
      setIsFilterModalOpen(false);
      
      // Force scroll to top after a brief delay to ensure DOM updates
      requestAnimationFrame(() => {
        if (isMobileApp) {
          // Scroll to top of results
          const resultsContainer = document.querySelector('[data-testid="vehicle-results"]') || 
                                   document.querySelector('.vehicle-list-container') ||
                                   window;
          if (resultsContainer && 'scrollTo' in resultsContainer) {
            (resultsContainer as Element).scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      });
    } catch (error) {
      logError('Error applying filters:', error);
      // Still close the modal even if there's an error
      setIsFilterModalOpen(false);
    }
  };
  
  const handleResetTempFilters = () => {
      setTempFilters({
          categoryFilter: initialCategory || 'ALL', // Reset to initial category, not always 'ALL'
          makeFilter: '',
          modelFilter: '',
          priceRange: { min: MIN_PRICE, max: MAX_PRICE },
          mileageRange: { min: MIN_MILEAGE, max: MAX_MILEAGE },
          fuelTypeFilter: '',
          transmissionFilter: '',
          ownershipFilter: '',
          selectedPriceBuckets: [],
          yearFilter: '0',
          yearMin: null,
          yearMax: null,
          stateFilter: '',
      });
      // Also clear the city if one is selected, otherwise the city -> state
      // sync effect would immediately re-apply a state filter the moment the
      // user hits "View All X Cars". Matches desktop handleResetFilters.
      if (onCityChange && selectedCity?.trim()) {
        onCityChange('');
      }
      // Mark the (now-empty) state as no longer user-set so the initial-
      // user-set snapshot taken when the modal opened does not sneak back in
      // on Apply.
      setInitialStateFilter('');
      setInitialIsStateFilterUserSet(false);
  };

  const handleAiQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setAiSearchQuery(query);

      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);

      if (!query.trim()) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
      }

      suggestionDebounceRef.current = window.setTimeout(async () => {
          const vehicleContext = (vehicles || []).map(v => ({ make: v.make, model: v.model, features: v.features }));
          const fetchedSuggestions = await getSearchSuggestions(query, vehicleContext);
          setSuggestions(fetchedSuggestions);
          setShowSuggestions(fetchedSuggestions.length > 0);
      }, 300);
  };

  const handleSuggestionClick = (suggestion: string) => {
      setAiSearchQuery(suggestion);
      setSuggestions([]);
      setShowSuggestions(false);
      handleAiSearch(suggestion);
  };
  
  const handleResetFilters = () => {
    setAiSearchQuery(''); 
    setCategoryFilter(initialCategory || 'ALL'); // Reset to initial category, not always 'ALL'
    setMakeFilter(''); 
    setModelFilter('');
    setPriceRange({ min: MIN_PRICE, max: MAX_PRICE }); 
    setYearFilter('0'); 
    setStateFilter('');
    setIsStateFilterUserSet(false); // Reset user-set flag
    setSortOrder('YEAR_DESC'); 
    onClearCompare(); 
    setCurrentPage(1);
    setMileageRange({ min: MIN_MILEAGE, max: MAX_MILEAGE }); 
    setFuelTypeFilter('');
    setTransmissionFilter('');
    setOwnershipFilter('');
    setSelectedPriceBuckets([]);
    setYearBounds({ min: null, max: null });

    // If filters were entered from a city route (Buy Cars dropdown), clear city too.
    // Otherwise the city->state sync effect will immediately re-apply state filter.
    if (onCityChange && selectedCity?.trim()) {
      onCityChange('');
    }
  };

  // Reset model filter when make filter changes
  useEffect(() => {
    setModelFilter('');
  }, [makeFilter]);

  const handleSaveSearch = () => {
    if (!currentUser) {
      alert(t('listings.loginToSaveSearch'));
      return;
    }

    const searchName = prompt(t('listings.saveSearchPrompt'));
    if (!searchName) return;

    const filters: SearchFilters = {
      category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
      make: makeFilter || undefined,
      model: modelFilter || undefined,
      minPrice: priceRange.min !== MIN_PRICE ? priceRange.min : undefined,
      maxPrice: priceRange.max !== MAX_PRICE ? priceRange.max : undefined,
      minMileage: mileageRange.min !== MIN_MILEAGE ? mileageRange.min : undefined,
      maxMileage: mileageRange.max !== MAX_MILEAGE ? mileageRange.max : undefined,
      fuelType: fuelTypeFilter || undefined,
      transmission: transmissionFilter?.trim() || undefined,
      ownership: ownershipFilter || undefined,
      year: yearFilter !== '0' ? parseInt(yearFilter, 10) : undefined,
      minYear: yearFilter === '0' && yearBounds.min != null ? yearBounds.min : undefined,
      maxYear: yearFilter === '0' && yearBounds.max != null ? yearBounds.max : undefined,
      location: stateFilter || undefined,
    };

    try {
      const savedSearch = saveBuyerSearch(currentUser.email, {
        userId: currentUser.email,
        name: searchName,
        filters,
        emailAlerts: true,
        smsAlerts: false,
        notificationFrequency: 'instant',
      });
      if (onSaveSearch) {
        onSaveSearch(savedSearch);
      }
      alert(t('listings.saveSearchSuccess'));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        logError('Error saving search:', error);
      }
      alert(t('listings.saveSearchFailed'));
    }
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, makeFilter, modelFilter, priceRange, mileageRange, fuelTypeFilter, transmissionFilter, ownershipFilter, selectedPriceBuckets, yearFilter, yearBounds, stateFilter, sortOrder, aiSearchQuery]);


  const processedVehicles = useMemo(() => {
    const sourceVehicles = isWishlistMode ? vehicles.filter(v => wishlist.includes(v.id)) : vehicles;

    if (sourceVehicles.length === 0) return [];

    const snap: VehicleListFilterSnapshot = {
      categoryFilter,
      makeFilter,
      modelFilter,
      priceRange,
      selectedPriceBuckets,
      mileageRange,
      fuelTypeFilter,
      yearFilter,
      stateFilter,
      isStateFilterUserSet,
      selectedCity,
      transmissionFilter,
      ownershipFilter,
      yearBounds,
    };

    const filtered = sourceVehicles.filter((vehicle) => matchesVehicleFilters(vehicle, snap, aiSearchQuery));

    if (process.env.NODE_ENV === 'development') {
      logInfo('Filter Results:', {
        totalVehicles: sourceVehicles.length,
        filteredCount: filtered.length,
        activeFilters: {
          category: categoryFilter,
          make: makeFilter,
          model: modelFilter,
          priceRange,
          selectedPriceBuckets,
          mileageRange,
          fuelType: fuelTypeFilter,
          transmission: transmissionFilter,
          ownership: ownershipFilter,
          year: yearFilter,
          state: stateFilter,
        }
      });
    }

    return [...filtered].sort((a, b) => {
        // Priority 1: Homepage Spotlight (highest priority)
        const aHasSpotlight = a.activeBoosts?.some(boost => boost.type === 'homepage_spotlight' && boost.isActive && new Date(boost.expiresAt) > new Date()) || false;
        const bHasSpotlight = b.activeBoosts?.some(boost => boost.type === 'homepage_spotlight' && boost.isActive && new Date(boost.expiresAt) > new Date()) || false;
        if (aHasSpotlight && !bHasSpotlight) return -1;
        if (!aHasSpotlight && bHasSpotlight) return 1;
        
        // Priority 2: Top Search Boost
        const aHasTopSearch = a.activeBoosts?.some(boost => boost.type === 'top_search' && boost.isActive && new Date(boost.expiresAt) > new Date()) || false;
        const bHasTopSearch = b.activeBoosts?.some(boost => boost.type === 'top_search' && boost.isActive && new Date(boost.expiresAt) > new Date()) || false;
        if (aHasTopSearch && !bHasTopSearch) return -1;
        if (!aHasTopSearch && bHasTopSearch) return 1;
        
        // Priority 3: Featured Badge Boost
        const aHasFeaturedBadge = a.activeBoosts?.some(boost => boost.type === 'featured_badge' && boost.isActive && new Date(boost.expiresAt) > new Date()) || a.isFeatured;
        const bHasFeaturedBadge = b.activeBoosts?.some(boost => boost.type === 'featured_badge' && boost.isActive && new Date(boost.expiresAt) > new Date()) || b.isFeatured;
        if (aHasFeaturedBadge && !bHasFeaturedBadge) return -1;
        if (!aHasFeaturedBadge && bHasFeaturedBadge) return 1;
        
        // Priority 4: Premium Listing
        if (a.isPremiumListing && !b.isPremiumListing) return -1;
        if (!a.isPremiumListing && b.isPremiumListing) return 1;
        
        // Priority 5: Any active boost
        const aHasAnyBoost = a.activeBoosts?.some(boost => boost.isActive && new Date(boost.expiresAt) > new Date()) || false;
        const bHasAnyBoost = b.activeBoosts?.some(boost => boost.isActive && new Date(boost.expiresAt) > new Date()) || false;
        if (aHasAnyBoost && !bHasAnyBoost) return -1;
        if (!aHasAnyBoost && bHasAnyBoost) return 1;
        
        // Then apply regular sorting
        switch (sortOrder) {
            case 'RATING_DESC': return (b.averageRating || 0) - (a.averageRating || 0);
            case 'PRICE_ASC': return a.price - b.price;
            case 'PRICE_DESC': return b.price - a.price;
            case 'MILEAGE_ASC': return a.mileage - b.mileage;
            default: return b.year - a.year;
        }
    });
  }, [vehicles, categoryFilter, makeFilter, modelFilter, priceRange, selectedPriceBuckets, mileageRange, fuelTypeFilter, transmissionFilter, ownershipFilter, yearFilter, yearBounds, sortOrder, isWishlistMode, wishlist, stateFilter, isStateFilterUserSet, selectedCity, aiSearchQuery]);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    // Only count category filter if it's explicitly changed from the initial/default
    // For wishlist mode, don't count category filter as it's implicit
    if (!isWishlistMode) {
      const defaultCategory = initialCategory || 'ALL';
      if (categoryFilter !== 'ALL' && categoryFilter !== defaultCategory) {
        count++; // Only count if changed from default
      }
    }
    // Only count non-empty string filters
    if (makeFilter && makeFilter.trim() !== '') count++;
    if (modelFilter && modelFilter.trim() !== '') count++;
    if (selectedPriceBuckets.length > 0) {
      count++;
    } else if (priceRange.min !== MIN_PRICE || priceRange.max !== MAX_PRICE) {
      count++;
    }
    // Only count mileage range if it's been explicitly changed from defaults
    if (mileageRange.min !== MIN_MILEAGE || mileageRange.max !== MAX_MILEAGE) count++;
    if (fuelTypeFilter && fuelTypeFilter.trim() !== '') count++;
    if (transmissionFilter && transmissionFilter.trim() !== '') count++;
    if (ownershipFilter) count++;
    if (yearFilter && yearFilter !== '0' && yearFilter.trim() !== '') count++;
    else if (yearBounds.min != null || yearBounds.max != null) count++;
    // Only count state filter if it was explicitly set by the user (not auto-set from location)
    if (stateFilter && stateFilter.trim() !== '' && isStateFilterUserSet) count++;
    return count;
  }, [categoryFilter, makeFilter, modelFilter, priceRange, selectedPriceBuckets, mileageRange, fuelTypeFilter, transmissionFilter, ownershipFilter, yearFilter, yearBounds, stateFilter, isWishlistMode, isStateFilterUserSet, initialCategory]);

  const mobileTempPreviewCount = useMemo(() => {
    const sourceVehicles = isWishlistMode ? vehicles.filter((v) => wishlist.includes(v.id)) : vehicles;
    if (sourceVehicles.length === 0) return 0;
    const previewStateUserSet =
      tempFilters.stateFilter === stateFilter ? isStateFilterUserSet : tempFilters.stateFilter.trim() !== '';
    const snap: VehicleListFilterSnapshot = {
      categoryFilter: tempFilters.categoryFilter,
      makeFilter: tempFilters.makeFilter,
      modelFilter: tempFilters.modelFilter,
      priceRange: tempFilters.priceRange,
      selectedPriceBuckets: tempFilters.selectedPriceBuckets,
      mileageRange: tempFilters.mileageRange,
      fuelTypeFilter: tempFilters.fuelTypeFilter,
      yearFilter: tempFilters.yearFilter,
      stateFilter: tempFilters.stateFilter,
      isStateFilterUserSet: previewStateUserSet,
      selectedCity,
      transmissionFilter: tempFilters.transmissionFilter,
      ownershipFilter: tempFilters.ownershipFilter,
      yearBounds: { min: tempFilters.yearMin ?? null, max: tempFilters.yearMax ?? null },
    };
    return sourceVehicles.filter((v) => matchesVehicleFilters(v, snap, aiSearchQuery)).length;
  }, [
    vehicles,
    isWishlistMode,
    wishlist,
    tempFilters,
    stateFilter,
    isStateFilterUserSet,
    selectedCity,
    aiSearchQuery,
  ]);

  // Pagination with infinite scroll - show 12 vehicles per page
  const paginatedVehicles = useMemo(() => {
    const startIndex = 0;
    const endIndex = currentPage * BASE_ITEMS_PER_PAGE;
    return processedVehicles.slice(startIndex, endIndex);
  }, [processedVehicles, currentPage]);
  
  const totalPages = Math.ceil(processedVehicles.length / BASE_ITEMS_PER_PAGE);
  const hasMore = currentPage < totalPages;

  hasMoreRef.current = hasMore;
  isLoadingMoreRef.current = isLoadingMore;

  // Infinite scroll: load-more sentinel must use the real scroll container as root (MobileLayout main), not the viewport.
  useLayoutEffect(() => {
    if (!hasMore) return;

    const node = loadMoreRef.current;
    if (!node) return;

    let cancelled = false;
    let observer: IntersectionObserver | null = null;

    const attach = () => {
      if (cancelled || !loadMoreRef.current) return;
      const rootEl = getScrollableAncestor(loadMoreRef.current);
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting) return;
          if (!hasMoreRef.current || isLoadingMoreRef.current) return;
          isLoadingMoreRef.current = true;
          setIsLoadingMore(true);
          window.setTimeout(() => {
            setCurrentPage((p) => p + 1);
            setIsLoadingMore(false);
            isLoadingMoreRef.current = false;
          }, 200);
        },
        {
          root: rootEl ?? null,
          rootMargin: '0px 0px 320px 0px',
          threshold: 0,
        }
      );
      observer.observe(loadMoreRef.current);
    };

    // Double rAF: scroll root and sentinel positions are stable after MobileLayout flex + list paint (WebView / PWA).
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(attach);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      observer?.disconnect();
    };
  }, [hasMore, currentPage, processedVehicles.length, isLoading, isAiSearching]);

  const toggleTempPriceBucket = (id: string) => {
    setTempFilters((prev) => {
      const has = prev.selectedPriceBuckets.includes(id);
      return {
        ...prev,
        selectedPriceBuckets: has ? prev.selectedPriceBuckets.filter((x) => x !== id) : [...prev.selectedPriceBuckets, id],
      };
    });
  };

  const renderMobileFilterRightPanel = () => {
    const handleTempSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { name, value } = e.target;
      setTempFilters((prev) => {
        const newState = { ...prev, [name]: value } as typeof prev;
        if (name === 'categoryFilter') {
          newState.makeFilter = '';
          newState.modelFilter = '';
          newState.fuelTypeFilter = '';
          newState.transmissionFilter = '';
          newState.ownershipFilter = '';
          newState.yearFilter = '0';
          newState.yearMin = null;
          newState.yearMax = null;
        } else if (name === 'makeFilter') {
          newState.modelFilter = '';
          newState.fuelTypeFilter = '';
          newState.transmissionFilter = '';
          newState.ownershipFilter = '';
          newState.yearFilter = '0';
          newState.yearMin = null;
          newState.yearMax = null;
        } else if (name === 'modelFilter') {
          newState.fuelTypeFilter = '';
          newState.transmissionFilter = '';
          newState.ownershipFilter = '';
          newState.yearFilter = '0';
          newState.yearMin = null;
          newState.yearMax = null;
        }
        return newState;
      });
    };

    const rowCheckbox = (key: string, label: string, checked: boolean, onToggle: () => void) => (
      <label
        key={key}
        className="flex items-center gap-3 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 rounded border-gray-400 shrink-0"
          style={{ accentColor: '#222222' }}
        />
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </label>
    );

    switch (mobileFilterCategory) {
      case 'price':
        return (
          <div className="pb-2">
            {MOBILE_PRICE_BUCKETS.map((b) =>
              rowCheckbox(
                b.id,
                t(b.labelKey),
                tempFilters.selectedPriceBuckets.includes(b.id),
                () => toggleTempPriceBucket(b.id)
              )
            )}
          </div>
        );
      case 'brand':
        return (
          <div className="space-y-4 pb-2">
            <div>
              <label htmlFor="m-make" className="block text-xs font-semibold text-gray-500 mb-1">
                {t('listings.mobileFilter.make')}
              </label>
              <select
                id="m-make"
                name="makeFilter"
                value={tempFilters.makeFilter}
                onChange={handleTempSelect}
                className={formElementClass}
              >
                <option value="">{t('listings.mobileFilter.anyMake')}</option>
                {tempUniqueMakes.map((make) => (
                  <option key={make} value={make}>
                    {make}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="m-model" className="block text-xs font-semibold text-gray-500 mb-1">
                {t('listings.mobileFilter.model')}
              </label>
              <select
                id="m-model"
                name="modelFilter"
                value={tempFilters.modelFilter}
                onChange={handleTempSelect}
                disabled={!tempFilters.makeFilter || tempAvailableModels.length === 0}
                className={formElementClass}
              >
                <option value="">{t('listings.mobileFilter.anyModel')}</option>
                {tempAvailableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      case 'body':
        return (
          <div className="pb-2">
            {rowCheckbox(
              'all-cat',
              t('listings.mobileFilter.allBodyTypes'),
              tempFilters.categoryFilter === 'ALL' || !tempFilters.categoryFilter,
              () => setTempFilters((p) => ({ ...p, categoryFilter: 'ALL' as VehicleCategory | 'ALL' }))
            )}
            {uniqueCategories.map((cat) =>
              rowCheckbox(
                `cat-${cat}`,
                String(cat).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
                tempFilters.categoryFilter === cat,
                () => setTempFilters((p) => ({ ...p, categoryFilter: cat as VehicleCategory }))
              )
            )}
          </div>
        );
      case 'year':
        return (
          <div className="pb-2 space-y-1">
            <label className="flex items-center gap-3 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50">
              <input
                type="radio"
                name="m-year"
                checked={tempFilters.yearFilter === '0'}
                onChange={() => setTempFilters((p) => ({ ...p, yearFilter: '0', yearMin: null, yearMax: null }))}
                className="h-4 w-4 shrink-0"
                style={{ accentColor: '#222222' }}
              />
              <span className="text-sm font-medium text-gray-900">{t('listings.mobileFilter.anyYear')}</span>
            </label>
            {tempUniqueYears.map((year) => (
              <label
                key={year}
                className="flex items-center gap-3 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50"
              >
                <input
                  type="radio"
                  name="m-year"
                  checked={tempFilters.yearFilter === String(year)}
                  onChange={() =>
                    setTempFilters((p) => ({ ...p, yearFilter: String(year), yearMin: null, yearMax: null }))
                  }
                  className="h-4 w-4 shrink-0"
                  style={{ accentColor: '#222222' }}
                />
                <span className="text-sm font-medium text-gray-900">{year}</span>
              </label>
            ))}
          </div>
        );
      case 'kms': {
        const handleMileage = (e: React.ChangeEvent<HTMLInputElement>) => {
          const { name, value } = e.target;
          const val = parseInt(value, 10);
          setTempFilters((prev) => {
            const currentRange = prev.mileageRange;
            const newRange = { ...currentRange, [name]: val };
            if (name === 'min' && newRange.min > currentRange.max) newRange.max = newRange.min;
            else if (name === 'max' && newRange.max < currentRange.min) newRange.min = newRange.max;
            return { ...prev, mileageRange: newRange };
          });
        };
        return (
          <div className="pb-4 space-y-3">
            <div className="flex justify-between text-xs text-gray-600">
              <span>{tempFilters.mileageRange.min.toLocaleString('en-IN')} km</span>
              <span>{tempFilters.mileageRange.max.toLocaleString('en-IN')} km</span>
            </div>
            <div className="relative h-8 flex items-center">
              <div className="relative w-full h-1.5 bg-gray-200 rounded-full">
                <div
                  className="absolute h-1.5 rounded-full bg-gray-800"
                  style={{
                    left: `${((tempFilters.mileageRange.min - MIN_MILEAGE) / (MAX_MILEAGE - MIN_MILEAGE)) * 100}%`,
                    right: `${100 - ((tempFilters.mileageRange.max - MIN_MILEAGE) / (MAX_MILEAGE - MIN_MILEAGE)) * 100}%`,
                  }}
                />
              </div>
              <input
                name="min"
                type="range"
                min={MIN_MILEAGE}
                max={MAX_MILEAGE}
                step={1000}
                value={tempFilters.mileageRange.min}
                onChange={handleMileage}
                className="mobile-filter-slider absolute w-full h-1.5 bg-transparent appearance-none z-20"
              />
              <input
                name="max"
                type="range"
                min={MIN_MILEAGE}
                max={MAX_MILEAGE}
                step={1000}
                value={tempFilters.mileageRange.max}
                onChange={handleMileage}
                className="mobile-filter-slider absolute w-full h-1.5 bg-transparent appearance-none z-30"
              />
            </div>
          </div>
        );
      }
      case 'fuel':
        return (
          <div className="pb-2">
            <select
              name="fuelTypeFilter"
              value={tempFilters.fuelTypeFilter}
              onChange={handleTempSelect}
              className={formElementClass}
            >
              <option value="">{t('listings.mobileFilter.anyFuel')}</option>
              {tempUniqueFuelTypes.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {fuel}
                </option>
              ))}
            </select>
          </div>
        );
      case 'transmission':
        return (
          <div className="pb-2">
            <select
              name="transmissionFilter"
              value={tempFilters.transmissionFilter}
              onChange={(e) =>
                setTempFilters((p) => ({ ...p, transmissionFilter: e.target.value }))
              }
              className={formElementClass}
            >
              <option value="">{t('listings.mobileFilter.anyTransmission')}</option>
              {tempUniqueTransmissions.map((tr) => (
                <option key={tr} value={tr}>
                  {tr}
                </option>
              ))}
            </select>
          </div>
        );
      case 'ownership':
        return (
          <div className="pb-2 space-y-1">
            {(
              [
                { id: '' as OwnershipFilterValue, label: t('listings.mobileFilter.anyOwnership') },
                { id: '1' as OwnershipFilterValue, label: t('listings.mobileFilter.owner1') },
                { id: '2' as OwnershipFilterValue, label: t('listings.mobileFilter.owner2') },
                { id: '3plus' as OwnershipFilterValue, label: t('listings.mobileFilter.owner3plus') },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id || 'any'}
                className="flex items-center gap-3 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50"
              >
                <input
                  type="radio"
                  name="m-ownership"
                  checked={tempFilters.ownershipFilter === opt.id}
                  onChange={() => setTempFilters((p) => ({ ...p, ownershipFilter: opt.id }))}
                  className="h-4 w-4 shrink-0"
                  style={{ accentColor: '#222222' }}
                />
                <span className="text-sm font-medium text-gray-900">{opt.label}</span>
              </label>
            ))}
          </div>
        );
      case 'state':
        // Native <select> pickers misalign on iOS when body is position:fixed (modal scroll lock).
        // Radio list matches year/ownership panels and stays inside the scrollable panel.
        return (
          <div className="pb-2 space-y-1">
            <label className="flex items-center gap-3 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50">
              <input
                type="radio"
                name="m-state"
                checked={!tempFilters.stateFilter?.trim()}
                onChange={() => setTempFilters((p) => ({ ...p, stateFilter: '' }))}
                className="h-4 w-4 shrink-0"
                style={{ accentColor: '#222222' }}
              />
              <span className="text-sm font-medium text-gray-900">{t('listings.mobileFilter.anyState')}</span>
            </label>
            {uniqueStates.map((st) => (
              <label
                key={st.code}
                className="flex items-center gap-3 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50"
              >
                <input
                  type="radio"
                  name="m-state"
                  checked={tempFilters.stateFilter === st.code}
                  onChange={() => setTempFilters((p) => ({ ...p, stateFilter: st.code }))}
                  className="h-4 w-4 shrink-0"
                  style={{ accentColor: '#222222' }}
                />
                <span className="text-sm font-medium text-gray-900">{st.name}</span>
              </label>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  if (isWishlistMode) {
     return (
      <div className="animate-fade-in container mx-auto py-8">
        <h1 className="text-3xl font-extrabold text-reride-text-dark dark:text-reride-text-dark mb-5 border-b border-gray-200 dark:border-gray-200 pb-3">{categoryTitle}</h1>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <VehicleCardSkeleton key={index} />)
          ) : processedVehicles.length > 0 ? (
            processedVehicles.map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} onSelect={onSelectVehicle} onToggleCompare={onToggleCompare} isSelectedForCompare={comparisonList.includes(vehicle.id)} onToggleWishlist={onToggleWishlist} isInWishlist={wishlist.includes(vehicle.id)} isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4} onViewSellerProfile={onViewSellerProfile} />
            ))
          ) : (
            <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-soft-lg">
              <h3 className="text-xl font-semibold text-reride-text-dark dark:text-brand-gray-200">Your Wishlist is Empty</h3>
              <p className="text-reride-text dark:text-reride-text mt-2">Click the heart icon on any vehicle to save it here.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const formElementClass = "block w-full p-3 border border-gray-300 dark:border-gray-300 rounded-lg focus:outline-none transition bg-white dark:bg-white dark:text-reride-text-dark disabled:bg-reride-light-gray dark:disabled:bg-reride-light-gray disabled:cursor-not-allowed";

  const renderFilterControls = (isMobile: boolean) => {
    const state = isMobile
      ? tempFilters
      : {
          categoryFilter,
          makeFilter,
          modelFilter,
          priceRange,
          mileageRange,
          fuelTypeFilter,
          yearFilter,
          stateFilter,
          transmissionFilter,
          ownershipFilter,
        };
    
    const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>, rangeType: 'price' | 'mileage') => {
        const { name, value } = e.target;
        const val = parseInt(value, 10);
        
        if (isMobile) {
            setTempFilters(prev => {
                const currentRange = rangeType === 'price' ? prev.priceRange : prev.mileageRange;
                const newRange = { ...currentRange, [name]: val };
                
                // Ensure min doesn't exceed max and vice versa
                if (name === 'min' && newRange.min > currentRange.max) {
                    newRange.max = newRange.min;
                } else if (name === 'max' && newRange.max < currentRange.min) {
                    newRange.min = newRange.max;
                }
                
                return rangeType === 'price' ? { ...prev, priceRange: newRange } : { ...prev, mileageRange: newRange };
            });
        } else {
            const setter = rangeType === 'price' ? setPriceRange : setMileageRange;
            setter(prev => {
                const newRange = { ...prev, [name]: val };
                
                // Ensure min doesn't exceed max and vice versa
                if (name === 'min' && newRange.min > prev.max) {
                    newRange.max = newRange.min;
                } else if (name === 'max' && newRange.max < prev.min) {
                    newRange.min = newRange.max;
                }
                
                return newRange;
            });
        }
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (isMobile) {
            setTempFilters(prev => {
                const newState = { ...prev, [name]: value };
                if (name === 'categoryFilter') {
                    newState.makeFilter = '';
                    newState.modelFilter = '';
                    newState.fuelTypeFilter = '';
                    newState.transmissionFilter = '';
                    newState.ownershipFilter = '';
                    newState.yearFilter = '0';
                    newState.yearMin = null;
                    newState.yearMax = null;
                } else if (name === 'makeFilter') {
                    newState.modelFilter = '';
                    newState.fuelTypeFilter = '';
                    newState.transmissionFilter = '';
                    newState.ownershipFilter = '';
                    newState.yearFilter = '0';
                    newState.yearMin = null;
                    newState.yearMax = null;
                } else if (name === 'modelFilter') {
                    newState.fuelTypeFilter = '';
                    newState.transmissionFilter = '';
                    newState.ownershipFilter = '';
                    newState.yearFilter = '0';
                    newState.yearMin = null;
                    newState.yearMax = null;
                }
                return newState;
            });
        } else {
            switch(name) {
                case 'categoryFilter': 
                    setCategoryFilter(value as VehicleCategory | 'ALL');
                    setMakeFilter('');
                    setModelFilter('');
                    setFuelTypeFilter('');
                    setTransmissionFilter('');
                    setOwnershipFilter('');
                    setYearFilter('0');
                    setYearBounds({ min: null, max: null });
                    break;
                case 'makeFilter': 
                    setMakeFilter(value); 
                    setModelFilter('');
                    setFuelTypeFilter('');
                    setTransmissionFilter('');
                    setOwnershipFilter('');
                    setYearFilter('0');
                    setYearBounds({ min: null, max: null });
                    break;
                case 'modelFilter': 
                    setModelFilter(value);
                    setFuelTypeFilter('');
                    setTransmissionFilter('');
                    setOwnershipFilter('');
                    setYearFilter('0');
                    setYearBounds({ min: null, max: null });
                    break;
                case 'fuelTypeFilter': setFuelTypeFilter(value); break;
                case 'yearFilter':
                    setYearFilter(value);
                    setYearBounds({ min: null, max: null });
                    break;
                case 'transmissionFilter': setTransmissionFilter(value); break;
                case 'ownershipFilter': setOwnershipFilter((value || '') as OwnershipFilterValue); break;
                case 'stateFilter': 
                  setStateFilter(value);
                  setIsStateFilterUserSet(true); // Mark as user-set
                  break;
            }
        }
    };
    
    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="category-select" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">Category</label>
                <select id="category-select" name="categoryFilter" value={state.categoryFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="ALL">All Categories</option>
                    {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>
                            {cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="make-filter" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">Make</label>
                <select id="make-filter" name="makeFilter" value={state.makeFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="">Any Make</option>
                    {(isMobile ? tempUniqueMakes : uniqueMakes).map(make => <option key={make} value={make}>{make}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="model-filter" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">Model</label>
                <select id="model-filter" name="modelFilter" value={state.modelFilter} onChange={handleSelectChange} disabled={!state.makeFilter || (isMobile ? tempAvailableModels.length === 0 : availableModels.length === 0)} className={formElementClass}>
                    <option value="">Any Model</option>
                    {(isMobile ? tempAvailableModels : availableModels).map(model => <option key={model} value={model}>{model}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="price-range-min" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-2">Price Range</label>
                <div className="flex justify-between items-center text-xs text-brand-gray-600 dark:text-reride-text">
                    <span>₹{state.priceRange.min.toLocaleString('en-IN')}</span>
                    <span>₹{state.priceRange.max.toLocaleString('en-IN')}</span>
                </div>
                <div className="relative h-8 flex items-center">
                    <div className="relative w-full h-1.5 bg-reride-light-gray dark:bg-brand-gray-600 rounded-full">
                        <div className="absolute h-1.5 rounded-full" style={{ left: `${((state.priceRange.min - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100}%`, right: `${100 - ((state.priceRange.max - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100}%`, background: 'var(--gradient-warm)' }}></div>
                    </div>
                    <input id="price-range-min" name="min" type="range" min={MIN_PRICE} max={MAX_PRICE} step="10000" value={state.priceRange.min} onChange={(e) => handleRangeChange(e, 'price')} className="absolute w-full h-1.5 bg-transparent appearance-none z-20 slider-thumb" />
                    <input name="max" type="range" min={MIN_PRICE} max={MAX_PRICE} step="10000" value={state.priceRange.max} onChange={(e) => handleRangeChange(e, 'price')} className="absolute w-full h-1.5 bg-transparent appearance-none z-30 slider-thumb" />
                </div>
            </div>
             <div>
                <label htmlFor="mileage-range-min" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-2">Mileage (kms)</label>
                <div className="flex justify-between items-center text-xs text-brand-gray-600 dark:text-reride-text">
                    <span>{state.mileageRange.min.toLocaleString('en-IN')}</span>
                    <span>{state.mileageRange.max.toLocaleString('en-IN')}</span>
                </div>
                <div className="relative h-8 flex items-center">
                    <div className="relative w-full h-1.5 bg-reride-light-gray dark:bg-brand-gray-600 rounded-full">
                        <div className="absolute h-1.5 rounded-full" style={{ left: `${((state.mileageRange.min - MIN_MILEAGE) / (MAX_MILEAGE - MIN_MILEAGE)) * 100}%`, right: `${100 - ((state.mileageRange.max - MIN_MILEAGE) / (MAX_MILEAGE - MIN_MILEAGE)) * 100}%`, background: 'var(--gradient-warm)' }}></div>
                    </div>
                    <input id="mileage-range-min" name="min" type="range" min={MIN_MILEAGE} max={MAX_MILEAGE} step="1000" value={state.mileageRange.min} onChange={(e) => handleRangeChange(e, 'mileage')} className="absolute w-full h-1.5 bg-transparent appearance-none z-20 slider-thumb" />
                    <input name="max" type="range" min={MIN_MILEAGE} max={MAX_MILEAGE} step="1000" value={state.mileageRange.max} onChange={(e) => handleRangeChange(e, 'mileage')} className="absolute w-full h-1.5 bg-transparent appearance-none z-30 slider-thumb" />
                </div>
            </div>
            <div>
                <label htmlFor="fuel-type-filter" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">Fuel Type</label>
                <select id="fuel-type-filter" name="fuelTypeFilter" value={state.fuelTypeFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="">Any Fuel Type</option>
                    {(isMobile ? tempUniqueFuelTypes : uniqueFuelTypes).map(fuel => <option key={fuel} value={fuel}>{fuel}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="year-filter" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">Year</label>
                <select id="year-filter" name="yearFilter" value={state.yearFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="0">Any Year</option>
                    {(isMobile ? tempUniqueYears : uniqueYears).map(year => <option key={year} value={year}>{year}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="transmission-filter-web" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">{t('listings.mobileFilter.catTransmission')}</label>
                <select id="transmission-filter-web" name="transmissionFilter" value={state.transmissionFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="">{t('listings.mobileFilter.anyTransmission')}</option>
                    {(isMobile ? tempUniqueTransmissions : uniqueTransmissions).map((tr) => (
                      <option key={tr} value={tr}>{tr}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="ownership-filter-web" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">{t('listings.mobileFilter.catOwnership')}</label>
                <select id="ownership-filter-web" name="ownershipFilter" value={state.ownershipFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="">{t('listings.mobileFilter.anyOwnership')}</option>
                    <option value="1">{t('listings.mobileFilter.owner1')}</option>
                    <option value="2">{t('listings.mobileFilter.owner2')}</option>
                    <option value="3plus">{t('listings.mobileFilter.owner3plus')}</option>
                </select>
            </div>
            <div>
                <label htmlFor="state-filter" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">State</label>
                <select id="state-filter" name="stateFilter" value={state.stateFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="">Any State</option>
                    {uniqueStates.map(st => <option key={st.code} value={st.code}>{st.name}</option>)}
                </select>
            </div>
            {!isMobile && (
              <div className="space-y-2 mt-2">
                <button onClick={handleResetFilters} className="w-full bg-reride-light-gray dark:bg-brand-gray-700 text-reride-text-dark dark:text-brand-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-brand-gray-300 dark:hover:bg-brand-gray-600 transition-colors">
                  {t('listings.resetFilters')}
                </button>
                <button 
                  onClick={handleSaveSearch} 
                  className="w-full bg-reride-orange text-white font-bold py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {t('listings.saveSearchButton')}
                </button>
              </div>
            )}
        </div>
    );
  };

  // Mobile App UI
  if (isMobileApp) {
    return (
      <div 
        className="w-full min-h-0"
        style={{
          background: 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
        }}
      >
        {/* Premium Search Bar — single pill with embedded submit button.
            Replaces the old card+button layout which truncated the placeholder. */}
        <div className="px-4 pt-4 pb-3">
          <div className="relative">
            <div
              className="group flex items-center gap-2 rounded-full border border-gray-200/80 bg-white pl-4 pr-1.5 py-1.5 transition-all focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-500/10"
              style={{ boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)' }}
            >
              <svg
                className="w-5 h-5 text-gray-400 group-focus-within:text-orange-500 transition-colors flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>

              <input
                type="text"
                placeholder="Search by brand, model, budget…"
                value={aiSearchQuery}
                onChange={handleAiQueryChange}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch(); }}
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] leading-none text-gray-900 placeholder:text-gray-400 py-2.5"
                style={{ fontSize: '16px' }}
                aria-label="Search vehicles"
                inputMode="search"
                enterKeyHint="search"
              />

              {aiSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    handleAiQueryChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
                    setShowSuggestions(false);
                  }}
                  className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleAiSearch()}
                disabled={isAiSearching}
                className="flex-shrink-0 flex items-center justify-center gap-1.5 h-10 px-4 rounded-full font-semibold text-[13px] text-white transition-all disabled:opacity-60 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                  boxShadow: '0 6px 14px rgba(255, 107, 53, 0.35)'
                }}
                aria-label={isAiSearching ? 'Searching' : 'Search'}
              >
                {isAiSearching ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="leading-none">Search</span>
                  </>
                )}
              </button>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 overflow-hidden z-20"
                style={{ boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)' }}
              >
                <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-4 py-3 text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="truncate">{suggestion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Marketplace-style filter chips + counts */}
        <div className="sticky-filter-bar bg-[#F5F5F5] px-3 py-2.5 mb-2 space-y-2">
          <div
            className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-hide"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {(
              [
                { id: 'filter' as const, label: t('listings.mobileFilter.chipFilter'), onClick: () => handleOpenFilterModal() },
                { id: 'sort' as const, label: t('listings.mobileFilter.chipSort'), onClick: () => setIsSortSheetOpen(true) },
                { id: 'price' as const, label: t('listings.mobileFilter.chipPrice'), onClick: () => handleOpenFilterModal('price') },
                { id: 'brand' as const, label: t('listings.mobileFilter.chipBrand'), onClick: () => handleOpenFilterModal('brand') },
                { id: 'body' as const, label: t('listings.mobileFilter.chipBody'), onClick: () => handleOpenFilterModal('body') },
                { id: 'year' as const, label: t('listings.mobileFilter.chipYear'), onClick: () => handleOpenFilterModal('year') },
                { id: 'fuel' as const, label: t('listings.mobileFilter.chipFuel'), onClick: () => handleOpenFilterModal('fuel') },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onClick}
                className="relative flex-shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full bg-white border border-gray-800 text-sm font-semibold text-gray-900 active:scale-[0.98] transition-transform"
              >
                {chip.label}
                {chip.id === 'filter' && activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-[#F5F5F5]">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{t('listings.showing')}</p>
              <p className="text-sm font-bold text-gray-900">
                {paginatedVehicles.length} {t('listings.of')} {processedVehicles.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSortSheetOpen(true)}
              className="text-xs font-semibold text-orange-600"
            >
              {sortOptions[sortOrder as keyof typeof sortOptions] ?? sortOrder}
            </button>
          </div>
        </div>

        {/* Vehicle List - with proper spacing to prevent overlap with sticky filter bar */}
        <div className="vehicle-list-container px-4 pb-24">
          <div className="flex flex-col gap-4" data-testid="vehicle-results">
            {isLoading || isAiSearching ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden"
                  style={{
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  {/* Image skeleton - Amazon/Flipkart style */}
                  <div className="w-full h-48 skeleton relative overflow-hidden"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-5 skeleton rounded w-3/4"></div>
                    <div className="h-4 skeleton rounded w-1/2"></div>
                    <div className="flex gap-2 mt-2">
                      <div className="h-3 skeleton rounded w-16"></div>
                      <div className="h-3 skeleton rounded w-16"></div>
                      <div className="h-3 skeleton rounded w-16"></div>
                    </div>
                    <div className="h-6 skeleton rounded w-2/5 mt-4"></div>
                  </div>
                </div>
              ))
            ) : paginatedVehicles.length > 0 ? (
              <>
                {paginatedVehicles.map(vehicle => (
                  <MobileVehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onSelect={onSelectVehicle}
                    onToggleWishlist={onToggleWishlist}
                    onToggleCompare={onToggleCompare}
                    isInWishlist={wishlist.includes(vehicle.id)}
                    isInCompare={comparisonList.includes(vehicle.id)}
                    showActions={true}
                  />
                ))}
                {/* Infinite scroll trigger for mobile */}
                {hasMore && (
                  <div ref={loadMoreRef} className="flex justify-center py-8">
                    {isLoadingMore ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
                        <span className="text-gray-600 text-sm">{t('listings.loadingMore')}</span>
                      </div>
                    ) : (
                      <div className="h-20" />
                    )}
                  </div>
                )}
                {!hasMore && processedVehicles.length > BASE_ITEMS_PER_PAGE && (
                  <div className="text-center py-4 text-xs text-gray-600">
                    {t('listings.showingAll', { count: processedVehicles.length })}
                  </div>
                )}
              </>
            ) : (
              <div 
                className="text-center py-16 px-4 bg-white rounded-2xl shadow-lg"
                style={{
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                }}
              >
                {sourceVehicleCount === 0 && onRetryLoadVehicles ? (
                  <>
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{t('listings.loadErrorTitle')}</h3>
                    <p className="text-gray-600 text-sm mb-4">{t('listings.loadErrorHint')}</p>
                    <button
                      type="button"
                      onClick={() => onRetryLoadVehicles()}
                      className="px-5 py-2.5 rounded-xl font-semibold text-white transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' }}
                    >
                      {t('listings.retry')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{t('listings.noVehiclesTitle')}</h3>
                    <p className="text-gray-600 text-sm">{t('listings.noVehiclesHint')}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <MobileMarketplaceFilterModal
          isOpen={isFilterModalOpen}
          onClose={handleCloseFilterModal}
          activeCategory={mobileFilterCategory}
          onActiveCategoryChange={setMobileFilterCategory}
          t={t}
          footer={
            <div className="flex items-stretch min-h-[56px]">
              <button
                type="button"
                onClick={handleResetTempFilters}
                className="flex-1 flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wide px-2"
              >
                <svg className="w-5 h-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12M8 12h12m-12 5h12M4 7h.01M4 12h.01M4 17h.01"
                  />
                </svg>
                {t('listings.mobileFilter.clearAll')}
              </button>
              <div className="w-px bg-white/25 self-stretch my-2 shrink-0" aria-hidden="true" />
              <button
                type="button"
                onClick={handleApplyFilters}
                className="flex-[1.25] mx-2 my-2 rounded-lg font-bold text-sm px-3 text-gray-900 active:opacity-90 transition-opacity"
                style={{ background: '#FFD700', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
              >
                {t('listings.mobileFilter.viewResults', { count: mobileTempPreviewCount })}
              </button>
            </div>
          }
        >
          <>
            <style>{`
              .mobile-filter-slider { -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; }
              .mobile-filter-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; background-color: #222; border: 3px solid #fff; box-shadow: 0 0 0 1px #ccc; border-radius: 50%; cursor: pointer; pointer-events: auto; }
              .mobile-filter-slider::-moz-range-thumb { width: 20px; height: 20px; background-color: #222; border: 3px solid #fff; box-shadow: 0 0 0 1px #ccc; border-radius: 50%; cursor: pointer; pointer-events: auto; }
            `}</style>
            {renderMobileFilterRightPanel()}
          </>
        </MobileMarketplaceFilterModal>

        <MobileSortSheet
          isOpen={isSortSheetOpen}
          onClose={() => setIsSortSheetOpen(false)}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          options={sortOptions}
          t={t}
        />

      </div>
    );
  }

  // Desktop UI (existing)
  return (
    <>
      <div className="min-h-screen bg-white lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-orange-50/60 relative overflow-hidden">
        {/* Background Elements - Hidden on mobile */}
        <div className="hidden lg:block absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-orange-200/25 to-amber-200/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-orange-200/15 to-rose-200/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>
        
        <div className="relative z-10 used-cars-page grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 lg:gap-8 container mx-auto py-4 lg:py-8">
          <aside className={`filters hidden lg:block lg:sticky top-24 self-start space-y-6 transition-all duration-300 ${isDesktopFilterVisible ? 'w-[300px] opacity-100' : 'w-0 opacity-0 -translate-x-full'}`}>
              <div className={`bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 ${isDesktopFilterVisible ? 'block' : 'hidden'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
                    style={{
                      background: 'linear-gradient(135deg, #FF6B35 0%, #F97316 50%, #FB923C 100%)',
                      boxShadow: '0 6px 14px -4px rgba(255, 107, 53, 0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
                    }}
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 via-orange-700 to-amber-600 bg-clip-text text-transparent">{t('listings.filtersTitle')}</h2>
                </div>
                {renderFilterControls(false)}
              </div>
          </aside>

          <main className="space-y-2 lg:space-y-4">
            {/* Mobile-optimized search - collapsible on mobile */}
            <div className="intelligent-search bg-white/80 backdrop-blur-xl rounded-xl lg:rounded-2xl shadow-xl border border-white/20 p-2.5 lg:p-4 -mt-12">
              <div className="flex items-center gap-2 mb-1.5 lg:mb-1.5">
                <label htmlFor="ai-search" className="text-xs lg:text-sm font-semibold text-reride-text-dark dark:text-reride-text-dark flex-shrink-0">✨ Intelligent Search</label>
                <p className={`hidden lg:block text-xs text-reride-text dark:text-reride-text flex-1 truncate`}>
                  Describe what you&apos;re looking for, e.g., &quot;a white Tata Nexon under ₹15 lakhs with a sunroof&quot;
                </p>
                <button 
                  onClick={() => setIsAiSearchCollapsed(prev => !prev)}
                  className="lg:hidden p-1 text-gray-500 hover:text-gray-700 flex-shrink-0"
                  aria-label="Toggle search"
                >
                  <svg className={`w-5 h-5 transition-transform ${isAiSearchCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <p className={`lg:hidden text-xs text-reride-text dark:text-reride-text mb-1.5 ${isAiSearchCollapsed ? 'hidden' : ''}`}>
                Describe what you&apos;re looking for, e.g., &quot;a white Tata Nexon under ₹15 lakhs with a sunroof&quot;
              </p>
              <div className={`relative ${isAiSearchCollapsed ? 'hidden lg:block' : ''}`} ref={aiSearchRef}>
                  <div className="flex gap-2">
                      <input type="text" id="ai-search" placeholder="Let our AI find your perfect vehicle..." value={aiSearchQuery} onChange={handleAiQueryChange} onFocus={() => setShowSuggestions(suggestions.length > 0)} onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch(); }} autoComplete="off" className={`${formElementClass} text-sm py-2`} style={{ fontSize: '14px' }} />
                      <button onClick={() => handleAiSearch()} disabled={isAiSearching} className="btn-brand-primary text-white font-bold py-2 px-3 lg:px-4 rounded-lg transition-colors disabled:bg-brand-gray-400 disabled:cursor-wait text-xs lg:text-sm whitespace-nowrap flex-shrink-0">{isAiSearching ? '...' : 'Search'}</button>
                  </div>
                  {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full mt-2 w-full bg-white dark:bg-brand-gray-700 rounded-lg shadow-soft-xl border border-gray-200 dark:border-gray-300 z-10 overflow-hidden"><ul className="divide-y divide-brand-gray-100 dark:divide-brand-gray-600">{suggestions.map((suggestion, index) => ( <li key={index}><button onClick={() => handleSuggestionClick(suggestion)} className="w-full text-left px-4 py-2 text-reride-text-dark dark:text-brand-gray-200 hover:bg-reride-off-white dark:hover:bg-brand-gray-600 transition-colors">{suggestion}</button></li>))}</ul></div>
                  )}
              </div>
          </div>

          {/* Mobile-optimized filters and sort bar - sticky on mobile */}
          <div 
            className="sticky-filter-bar lg:static lg:bg-transparent py-2 lg:py-0 lg:border-none -mx-4 px-4 lg:mx-0 lg:px-0 mb-2"
          >
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 lg:gap-3">
              <div className='flex items-center gap-1.5 w-full sm:w-auto'>
                <button onClick={() => setIsDesktopFilterVisible(prev => !prev)} className="hidden lg:block p-1.5 rounded-md bg-white dark:bg-brand-gray-700 hover:bg-reride-off-white dark:hover:bg-brand-gray-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg>
                </button>
                <button 
                  onClick={() => handleOpenFilterModal()} 
                  className="lg:hidden relative p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors native-button active:opacity-80 min-h-[40px] min-w-[40px] flex items-center justify-center shadow-md"
                  style={{ backgroundColor: '#FF6B35' }}
                  aria-label={`Open filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                  </svg>
                  {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full border-2 border-white shadow-md">
                        {activeFilterCount}
                      </span>
                  )}
                </button>
                <p className="text-xs text-gray-600 dark:text-gray-400 flex-shrink-0 ml-1">
                  <span className="text-gray-500 dark:text-gray-400">{t('listings.showing')}</span>{' '}
                  <span className="font-bold text-gray-900 dark:text-white">{paginatedVehicles.length}</span>{' '}
                  <span className="text-gray-500 dark:text-gray-400">{t('listings.of')}</span>{' '}
                  <span className="font-bold text-gray-900 dark:text-white">{processedVehicles.length}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center p-0.5 bg-reride-off-white dark:bg-brand-gray-700 rounded-md">
                  <button title={t('listings.viewGrid')} onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow' : 'text-reride-text hover:text-reride-text-dark dark:hover:text-brand-gray-200'}`} style={viewMode === 'grid' ? { color: '#FF6B35' } : undefined}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  </button>
                  <button title={t('listings.viewList')} onClick={() => setViewMode('tile')} className={`p-1.5 rounded transition-colors ${viewMode === 'tile' ? 'bg-white shadow' : 'text-reride-text hover:text-reride-text-dark dark:hover:text-brand-gray-200'}`} style={viewMode === 'tile' ? { color: '#FF6B35' } : undefined}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zM2 9a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zM2 14a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" /></svg>
                  </button>
                </div>
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={`${formElementClass} text-xs py-1.5 px-2 w-auto lg:w-auto flex-shrink-0`} style={{ fontSize: '13px' }}>
                    {Object.entries(sortOptions).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div 
            className={isMobileApp ? "flex flex-col gap-3" : viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6" : "flex flex-col gap-3 lg:gap-4"}
            data-testid="vehicle-results"
            style={isMobileApp ? { paddingTop: '0.5rem' } : {}}
          >
            {isLoading || isAiSearching ? (
              Array.from({ length: 8 }).map((_, index) => 
                isMobileApp ? <VehicleCardSkeleton key={index} /> :
                viewMode === 'grid' ? <VehicleCardSkeleton key={index} /> : <VehicleTileSkeleton key={index} />
              )
            ) : paginatedVehicles.length > 0 ? (
              <>
                {paginatedVehicles.map(vehicle => {
                  // Use MobileVehicleCard in mobile app mode
                  if (isMobileApp) {
                    return (
                      <MobileVehicleCard
                        key={vehicle.id}
                        vehicle={vehicle}
                        onSelect={onSelectVehicle}
                        onToggleWishlist={onToggleWishlist}
                        onToggleCompare={onToggleCompare}
                        isInWishlist={wishlist.includes(vehicle.id)}
                        isInCompare={comparisonList.includes(vehicle.id)}
                        showActions={true}
                      />
                    );
                  }
                  
                  // Desktop mode
                  return viewMode === 'grid' ? (
                    <VehicleCard 
                      key={vehicle.id} 
                      vehicle={vehicle} 
                      onSelect={onSelectVehicle} 
                      onToggleCompare={onToggleCompare} 
                      isSelectedForCompare={comparisonList.includes(vehicle.id)} 
                      onToggleWishlist={onToggleWishlist} 
                      isInWishlist={wishlist.includes(vehicle.id)} 
                      isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4} 
                      onViewSellerProfile={onViewSellerProfile} 
                    />
                  ) : (
                    <VehicleTile 
                      key={vehicle.id} 
                      vehicle={vehicle} 
                      onSelect={onSelectVehicle} 
                      onToggleCompare={onToggleCompare} 
                      isSelectedForCompare={comparisonList.includes(vehicle.id)} 
                      onToggleWishlist={onToggleWishlist} 
                      isInWishlist={wishlist.includes(vehicle.id)} 
                      isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4} 
                      onViewSellerProfile={onViewSellerProfile}
                    />
                  );
                })}
                {/* Infinite scroll trigger */}
                {hasMore && (
                  <div ref={loadMoreRef} className="col-span-full flex justify-center py-8">
                    {isLoadingMore ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
                        <span className="text-gray-600">{t('listings.loadingMoreDesktop')}</span>
                      </div>
                    ) : (
                      <div className="h-20" /> // Spacer for intersection observer
                    )}
                  </div>
                )}
                {/* Show total count */}
                {!hasMore && processedVehicles.length > BASE_ITEMS_PER_PAGE && (
                  <div className="col-span-full text-center py-4 text-sm text-gray-600">
                    {t('listings.showingAll', { count: processedVehicles.length })}
                  </div>
                )}
              </>
            ) : (
              <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-soft-lg">
                {sourceVehicleCount === 0 && onRetryLoadVehicles ? (
                  <>
                    <h3 className="text-xl font-semibold text-reride-text-dark dark:text-brand-gray-200">{t('listings.loadErrorTitle')}</h3>
                    <p className="text-reride-text dark:text-reride-text mt-2">{t('listings.loadErrorHint')}</p>
                    <button
                      type="button"
                      onClick={() => onRetryLoadVehicles()}
                      className="mt-4 px-5 py-2.5 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' }}
                    >
                      {t('listings.retry')}
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-semibold text-reride-text-dark dark:text-brand-gray-200">{t('listings.noVehiclesTitle')}</h3>
                    <p className="text-reride-text dark:text-reride-text mt-2">{t('listings.noVehiclesHintDesktop')}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile web: bottom-sheet filter (not native app) */}
      {!isMobileApp && isFilterModalOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseFilterModal();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCloseFilterModal();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close filters overlay"
          style={{ backdropFilter: 'blur(4px)' }}
        >
            <div 
              className="bg-white rounded-t-3xl h-[90vh] flex flex-col absolute bottom-0 left-0 right-0 safe-bottom shadow-2xl" 
              style={{ 
                animation: 'slideUp 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
              }}
            >
                <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0 safe-top">
                    <h2 className="text-xl font-bold text-gray-900">{t('listings.filtersTitle')}</h2>
                    <button 
                      onClick={handleCloseFilterModal} 
                      className="p-2 -mr-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 active:opacity-70 native-transition"
                      style={{ minWidth: '44px', minHeight: '44px' }}
                      aria-label="Close filters"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                </div>
                <div className="overflow-y-auto native-scroll flex-grow p-4">
                    {renderFilterControls(true)}
                </div>
                <div className="p-4 border-t border-gray-200 flex gap-3 bg-white flex-shrink-0 safe-bottom">
                    <button 
                      onClick={handleResetTempFilters} 
                      className="flex-1 native-button native-button-secondary font-semibold py-3"
                    >
                      {t('listings.reset')}
                    </button>
                    <button 
                      onClick={handleApplyFilters} 
                      className="flex-1 native-button native-button-primary font-semibold py-3"
                    >
                      {t('listings.applyFilters')}
                      {activeFilterCount > 0 && (
                        <span className="ml-2 bg-white/30 text-white text-xs font-bold rounded-full px-2 py-0.5">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                </div>
                 <style>{`
                  .slider-thumb { -webkit-appearance: none; appearance: none; background-color: transparent; pointer-events: none; }
                  .slider-thumb::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; background-color: var(--reride-orange); border: 3px solid var(--reride-white); box-shadow: 0 0 0 1px var(--reride-text-dark-light); border-radius: 50%; cursor: pointer; pointer-events: auto; transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out; }
                  html.dark .slider-thumb::-webkit-slider-thumb { border-color: var(--reride-text-dark-dark); box-shadow: 0 0 0 1px var(--reride-text-dark); }
                  .slider-thumb:hover::-webkit-slider-thumb, .slider-thumb:focus::-webkit-slider-thumb { transform: scale(1.15); box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.1); }
                  .slider-thumb::-moz-range-thumb { width: 20px; height: 20px; background-color: var(--reride-orange); border: 3px solid var(--reride-white); box-shadow: 0 0 0 1px var(--reride-text-dark-light); border-radius: 50%; cursor: pointer; pointer-events: auto; transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out; }
                  html.dark .slider-thumb::-moz-range-thumb { border-color: var(--reride-text-dark-dark); box-shadow: 0 0 0 1px var(--reride-text-dark); }
                  .slider-thumb:hover::-moz-range-thumb, .slider-thumb:focus::-moz-range-thumb { transform: scale(1.15); box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.1); }
                `}</style>
            </div>
        </div>
      )}

    </div>
    </>
  );
});

VehicleList.displayName = 'VehicleList';

export default VehicleList;

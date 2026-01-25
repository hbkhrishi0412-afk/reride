import React, { useState, useMemo, useRef, useEffect } from 'react';
import VehicleCard from './VehicleCard.js';
import MobileVehicleCard from './MobileVehicleCard.js';
import MobileFilterSheet from './MobileFilterSheet.js';
import useIsMobileApp from '../hooks/useIsMobileApp.js';
import type { Vehicle, VehicleCategory, SavedSearch, SearchFilters } from '../types.js';
import { VehicleCategory as CategoryEnum } from '../types.js';
import { parseSearchQuery, getSearchSuggestions } from '../services/geminiService.js';
import QuickViewModal from './QuickViewModal.js';
import VehicleTile from './VehicleTile.js';
import VehicleTileSkeleton from './VehicleTileSkeleton.js';
import { saveSearch } from '../services/buyerEngagementService.js';
import { getVehicleData } from '../services/vehicleDataService.js';
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
  isWishlistMode?: boolean;
  onViewSellerProfile: (sellerEmail: string) => void;
  userLocation?: string;
  currentUser?: { email: string; name: string } | null;
  onSaveSearch?: (search: SavedSearch) => void;
  selectedCity?: string;
  onCityChange?: (city: string) => void;
}

// Base items per page - optimized for performance (10-12 vehicles per load)
const BASE_ITEMS_PER_PAGE = 12;

const VehicleCardSkeleton: React.FC = () => (
    <div className="bg-white rounded-xl shadow-soft-lg overflow-hidden">
      <div className="w-full h-40 sm:h-56 bg-reride-light-gray dark:bg-brand-gray-700 animate-pulse"></div>
      <div className="p-3 sm:p-5">
        <div className="flex justify-between items-start">
          <div className="h-5 sm:h-6 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-3/5 mb-2 animate-pulse"></div>
          <div className="h-5 sm:h-6 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-1/5 mb-2 animate-pulse"></div>
        </div>
        <div className="h-3 sm:h-4 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="h-px bg-reride-light-gray dark:bg-brand-gray-700 my-3 sm:my-4"></div>
        <div className="grid grid-cols-2 gap-2">
           <div className="h-4 sm:h-5 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-full animate-pulse"></div>
           <div className="h-4 sm:h-5 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-full animate-pulse"></div>
           <div className="h-4 sm:h-5 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-full animate-pulse"></div>
           <div className="h-4 sm:h-5 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-full animate-pulse"></div>
        </div>
        <div className="flex justify-between items-center mt-4 sm:mt-6">
           <div className="h-7 sm:h-8 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-2/5 animate-pulse"></div>
           <div className="h-5 sm:h-6 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-1/4 animate-pulse"></div>
        </div>
      </div>
    </div>
);

const sortOptions = {
  YEAR_DESC: 'Newest First',
  RATING_DESC: 'Sort By Rating',
  PRICE_ASC: 'Price: Low to High',
  PRICE_DESC: 'Price: High to Low',
  MILEAGE_ASC: 'Mileage: Low to High',
};

const MIN_PRICE = 50000;
const MAX_PRICE = 5000000;
const MIN_MILEAGE = 0;
const MAX_MILEAGE = 200000;

const Pagination: React.FC<{ currentPage: number; totalPages: number; onPageChange: (page: number) => void; }> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return (
    <nav className="flex justify-center items-center space-x-2 mt-8 mb-8">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 rounded-md bg-white dark:bg-brand-gray-700 disabled:opacity-50">Prev</button>
      {pageNumbers.map(number => (
        <button key={number} onClick={() => onPageChange(number)} className={`px-4 py-2 rounded-md ${currentPage === number ? 'text-white' : 'bg-white dark:bg-brand-gray-700'}`} style={currentPage === number ? { background: '#FF6B35' } : undefined}>{number}</button>
      ))}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 py-2 rounded-md bg-white dark:bg-brand-gray-700 disabled:opacity-50">Next</button>
    </nav>
  );
};

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
  isWishlistMode = false, 
  onViewSellerProfile, 
  userLocation = '', 
  currentUser, 
  onSaveSearch,
  selectedCity,
  onCityChange
}) => {
  const [aiSearchQuery, setAiSearchQuery] = useState(initialSearchQuery);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Vehicle data for filters
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [isLoadingVehicleData, setIsLoadingVehicleData] = useState(true);
  
  // Lazy load location and fuel data
  const [indianStates, setIndianStates] = useState<Array<{name: string, code: string}>>([]);
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);

  // Load vehicle data for filters with caching
  useEffect(() => {
    const loadVehicleDataForFilters = async () => {
      try {
        setIsLoadingVehicleData(true);
        
        // Check cache first
        const cachedData = localStorage.getItem('reRideVehicleDataFilters');
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < 5 * 60 * 1000) { // 5 minutes cache
            setVehicleData(data);
            setIsLoadingVehicleData(false);
            return;
          }
        }
        
        const data = await getVehicleData();
        setVehicleData(data);
        
        // Cache the data
        localStorage.setItem('reRideVehicleDataFilters', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Vehicle data loaded for filters:', data);
        }
      } catch (error) {
        console.error('❌ Failed to load vehicle data for filters:', error);
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
  const [yearFilter, setYearFilter] = useState('0');
  const [colorFilter, setColorFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [isStateFilterUserSet, setIsStateFilterUserSet] = useState(false); // Track if state filter was explicitly set by user
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [featureSearch, setFeatureSearch] = useState('');
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState('YEAR_DESC');
  const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<VehicleCategory | 'ALL'>(initialCategory || 'ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDesktopFilterVisible, setIsDesktopFilterVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'tile'>('grid');
  const [isAiSearchCollapsed, setIsAiSearchCollapsed] = useState(true); // Start collapsed on mobile for better UX
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
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
    yearFilter: '0',
    colorFilter: '',
    stateFilter: '',
    selectedFeatures: [] as string[],
    featureSearch: ''
  });
  const [initialStateFilter, setInitialStateFilter] = useState('');
  const [initialIsStateFilterUserSet, setInitialIsStateFilterUserSet] = useState(false);
  const [isMobileFeaturesOpen, setIsMobileFeaturesOpen] = useState(false);

  // Mobile app detection
  const { isMobileApp } = useIsMobileApp();

  const aiSearchRef = useRef<HTMLDivElement>(null);
  const featuresFilterRef = useRef<HTMLDivElement>(null);
  const mobileFeaturesFilterRef = useRef<HTMLDivElement>(null);
  const featuresSearchInputRef = useRef<HTMLInputElement>(null);
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
        const categoryKey = Object.keys(vehicleData).find(key => {
          const normalizedKey = String(key).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return normalizedKey === normalizedCategory;
        });
        
        if (categoryKey && vehicleData[categoryKey]) {
          vehicleData[categoryKey].forEach((make: any) => {
            makesFromDb.add(make.name);
          });
        }
      } else {
        // No category filter - show all makes from all categories
        Object.values(vehicleData).forEach((categoryData: any) => {
          categoryData.forEach((make: any) => {
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
        const categoryKey = Object.keys(vehicleData).find(key => {
          const normalizedKey = String(key).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return normalizedKey === normalizedCategory;
        });
        
        if (categoryKey && vehicleData[categoryKey]) {
          vehicleData[categoryKey].forEach((make: any) => {
            makesFromDb.add(make.name);
          });
        }
      } else {
        // No category filter - show all makes from all categories
        Object.values(vehicleData).forEach((categoryData: any) => {
          categoryData.forEach((make: any) => {
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
        const categoryKey = Object.keys(vehicleData).find(key => {
          const normalizedKey = String(key).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          return normalizedKey === normalizedCategory;
        });
        
        if (categoryKey && vehicleData[categoryKey]) {
          vehicleData[categoryKey].forEach((make: any) => {
            if (make.name === makeFilter) {
              make.models.forEach((model: any) => {
                modelsFromDb.add(model.name);
              });
            }
          });
        }
      } else {
        // No category filter - show all models for the make across all categories
        Object.values(vehicleData).forEach((categoryData: any) => {
          categoryData.forEach((make: any) => {
            if (make.name === makeFilter) {
              make.models.forEach((model: any) => {
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
          const categoryKey = Object.keys(vehicleData).find(key => {
            const normalizedKey = String(key).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
            return normalizedKey === normalizedCategory;
          });
          
          if (categoryKey && vehicleData[categoryKey]) {
            vehicleData[categoryKey].forEach((make: any) => {
              if (make.name === tempFilters.makeFilter) {
                make.models.forEach((model: any) => {
                  modelsFromDb.add(model.name);
                });
              }
            });
          }
        } else {
          // No category filter - show all models for the make across all categories
          Object.values(vehicleData).forEach((categoryData: any) => {
            categoryData.forEach((make: any) => {
              if (make.name === tempFilters.makeFilter) {
                make.models.forEach((model: any) => {
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
  
  const uniqueColors = useMemo(() => {
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
    
    return [...new Set(filteredVehicles.map(v => v.color))].sort();
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
  
  const tempUniqueColors = useMemo(() => {
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
    
    return [...new Set(filteredVehicles.map(v => v.color))].sort();
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

  const allFeatures = useMemo(() => [...new Set((vehicles || []).flatMap(v => v.features))].sort(), [vehicles]);
  
  const filteredFeatures = useMemo(() => {
      return allFeatures.filter(feature => feature.toLowerCase().includes(featureSearch.toLowerCase()));
  }, [allFeatures, featureSearch]);

  const tempFilteredFeatures = useMemo(() => {
    return allFeatures.filter(feature => feature.toLowerCase().includes(tempFilters.featureSearch.toLowerCase()));
  }, [allFeatures, tempFilters.featureSearch]);

  const handleAiSearch = async (queryOverride?: string) => {
    const query = typeof queryOverride === 'string' ? queryOverride : aiSearchQuery;
    if (!query.trim()) return;

    setShowSuggestions(false);
    setIsAiSearching(true);
    const parsedFilters = await parseSearchQuery(query);
    
    if (parsedFilters.make && uniqueMakes.includes(parsedFilters.make)) {
      const newMake = parsedFilters.make;
      setMakeFilter(newMake);
      const modelsForMake = [...new Set((vehicles || []).filter(v => v.make === newMake).map(v => v.model))];
      if (parsedFilters.model && modelsForMake.includes(parsedFilters.model)) setModelFilter(parsedFilters.model);
      else setModelFilter('');
    } else if (parsedFilters.model && makeFilter) {
        const currentModels = [...new Set((vehicles || []).filter(v => v.make === makeFilter).map(v => v.model))];
        if (currentModels.includes(parsedFilters.model)) setModelFilter(parsedFilters.model);
    }
    
    if (parsedFilters.minPrice || parsedFilters.maxPrice) {
      setPriceRange({ min: parsedFilters.minPrice || MIN_PRICE, max: parsedFilters.maxPrice || MAX_PRICE });
    }
    if (parsedFilters.features) {
        const validFeatures = parsedFilters.features.filter(f => allFeatures.includes(f));
        setSelectedFeatures(validFeatures);
    }
    
    setIsAiSearching(false);
  };
  
  useEffect(() => {
      if (initialSearchQuery) {
          handleAiSearch(initialSearchQuery);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearchQuery]);

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
        const { FUEL_TYPES } = await import('../constants');
        
        setIndianStates(INDIAN_STATES);
        setFuelTypes(FUEL_TYPES);
        
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
          console.error('Failed to load location data:', error);
        }
        // Fallback to basic data
        setFuelTypes(['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid']);
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
        import('../constants').then(({ CITIES_BY_STATE }) => {
          const stateCode = getStateCodeForCity(selectedCity, CITIES_BY_STATE);
          if (stateCode && stateCode !== stateFilter) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🔵 VehicleList: Updating state filter to', stateCode, 'for city', selectedCity);
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
          console.log('🔵 VehicleList: Clearing state filter because city was cleared');
        }
        setStateFilter('');
        setIsStateFilterUserSet(false);
      }
    }
  }, [selectedCity]); // Only depend on selectedCity

  // Sync state filter changes back to city (clear city when state changes manually)
  const prevStateFilterRef = useRef(stateFilter);
  useEffect(() => {
    if (!onCityChange || !selectedCity) return; // Only sync if props are provided
    
    // Only sync if state filter was manually changed (not from city selection)
    if (prevStateFilterRef.current !== stateFilter && isStateFilterUserSet) {
      // Check if the current city matches the new state
      import('../utils/cityMapping').then(({ getStateCodeForCity }) => {
        import('../constants').then(({ CITIES_BY_STATE }) => {
          const cityStateCode = getStateCodeForCity(selectedCity, CITIES_BY_STATE);
          if (cityStateCode !== stateFilter) {
            // City doesn't match the selected state, clear city
            if (process.env.NODE_ENV === 'development') {
              console.log('🔵 VehicleList: Clearing city because state filter changed to', stateFilter);
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
        if (featuresFilterRef.current && !featuresFilterRef.current.contains(event.target as Node)) setIsFeaturesOpen(false);
        if (mobileFeaturesFilterRef.current && !mobileFeaturesFilterRef.current.contains(event.target as Node)) setIsMobileFeaturesOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (isFeaturesOpen) {
        setTimeout(() => featuresSearchInputRef.current?.focus(), 0);
    }
  }, [isFeaturesOpen]);
  
  useEffect(() => {
    if (isFilterModalOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isFilterModalOpen]);

  // Mobile Modal Filter Logic
  const handleOpenFilterModal = () => {
    // Store the initial state filter value and user-set flag when opening the modal
    setInitialStateFilter(stateFilter);
    setInitialIsStateFilterUserSet(isStateFilterUserSet);
    setTempFilters({
      categoryFilter,
      makeFilter,
      modelFilter,
      priceRange,
      mileageRange,
      fuelTypeFilter,
      yearFilter,
      colorFilter,
      stateFilter,
      selectedFeatures,
      featureSearch: ''
    });
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
      
      // Validate color - reset if not available for selected category/make/model
      let validColor = tempFilters.colorFilter?.trim() || '';
      if (validColor) {
        const tempColors = tempUniqueColors;
        if (!tempColors.includes(validColor)) {
          validColor = '';
        }
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
      setYearFilter(validYear);
      setColorFilter(validColor);
      setStateFilter(tempFilters.stateFilter?.trim() || '');
      
      // Only mark state filter as user-set if it was actually changed in the modal
      const newStateFilter = tempFilters.stateFilter?.trim() || '';
      const stateFilterChanged = newStateFilter !== initialStateFilter;
      setIsStateFilterUserSet(stateFilterChanged ? !!(newStateFilter && newStateFilter !== '') : initialIsStateFilterUserSet);
      
      // Create new array to ensure React detects the change
      setSelectedFeatures(tempFilters.selectedFeatures ? [...tempFilters.selectedFeatures] : []);
      setFeatureSearch(''); // Clear feature search when applying filters
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
      console.error('Error applying filters:', error);
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
          yearFilter: '0',
          colorFilter: '',
          stateFilter: '',
          selectedFeatures: [],
          featureSearch: '',
      });
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
    setColorFilter(''); 
    setStateFilter('');
    setIsStateFilterUserSet(false); // Reset user-set flag
    setSelectedFeatures([]); 
    setFeatureSearch(''); 
    setSortOrder('YEAR_DESC'); 
    onClearCompare(); 
    setCurrentPage(1);
    setMileageRange({ min: MIN_MILEAGE, max: MAX_MILEAGE }); 
    setFuelTypeFilter('');
  };

  // Reset model filter when make filter changes
  useEffect(() => {
    setModelFilter('');
  }, [makeFilter]);

  const handleSaveSearch = () => {
    if (!currentUser) {
      alert('Please login to save searches');
      return;
    }

    const searchName = prompt('Enter a name for this search:');
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
      year: yearFilter !== '0' ? parseInt(yearFilter) : undefined,
      location: stateFilter || undefined,
      features: selectedFeatures.length > 0 ? selectedFeatures : undefined
      // Note: query is stored separately in SavedSearch, not in SearchFilters
    };

    try {
      const savedSearch = saveSearch(currentUser.email, searchName, filters, true);
      if (onSaveSearch) {
        onSaveSearch(savedSearch);
      }
      alert('Search saved successfully!');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error saving search:', error);
      }
      alert('Failed to save search. Please try again.');
    }
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, makeFilter, modelFilter, priceRange, mileageRange, fuelTypeFilter, yearFilter, colorFilter, stateFilter, selectedFeatures, sortOrder, aiSearchQuery]);


  const processedVehicles = useMemo(() => {
    const sourceVehicles = isWishlistMode ? vehicles.filter(v => wishlist.includes(v.id)) : vehicles;

    // Early return if no vehicles
    if (sourceVehicles.length === 0) return [];

    const filtered = sourceVehicles.filter(vehicle => {
        // Use early returns for better performance
        // Normalize category comparison to handle different formats
        if (categoryFilter !== 'ALL' && categoryFilter) {
          // If vehicle has no category, exclude it when a category filter is active
          if (!vehicle.category) return false;
          
          // Normalize both values for comparison
          const vehicleCategory = String(vehicle.category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          const filterCategory = String(categoryFilter).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
          
          // Strict comparison - must match exactly after normalization
          if (vehicleCategory !== filterCategory) return false;
        }
        // Make filter - case-insensitive comparison
        if (makeFilter && makeFilter.trim() !== '') {
          if (vehicle.make?.toLowerCase().trim() !== makeFilter.toLowerCase().trim()) return false;
        }
        // Model filter - case-insensitive comparison
        if (modelFilter && modelFilter.trim() !== '') {
          if (vehicle.model?.toLowerCase().trim() !== modelFilter.toLowerCase().trim()) return false;
        }
        // Price range filter - only apply if vehicle has valid price
        // If price is outside range, exclude the vehicle
        if (vehicle.price != null && typeof vehicle.price === 'number') {
          if (vehicle.price < priceRange.min || vehicle.price > priceRange.max) return false;
        }
        // Note: Vehicles without price are still shown (they just don't match price filters)
        
        // Mileage range filter - only apply if vehicle has valid mileage
        // If mileage is outside range, exclude the vehicle
        if (vehicle.mileage != null && typeof vehicle.mileage === 'number') {
          if (vehicle.mileage < mileageRange.min || vehicle.mileage > mileageRange.max) return false;
        }
        // Note: Vehicles without mileage are still shown (they just don't match mileage filters)
        // Fuel type filter - case-insensitive comparison
        if (fuelTypeFilter && fuelTypeFilter.trim() !== '') {
          if (vehicle.fuelType?.toLowerCase().trim() !== fuelTypeFilter.toLowerCase().trim()) return false;
        }
        // Year filter
        if (yearFilter && yearFilter !== '0' && yearFilter.trim() !== '') {
          const filterYear = Number(yearFilter);
          if (isNaN(filterYear) || vehicle.year !== filterYear) return false;
        }
        // Color filter - case-insensitive comparison
        if (colorFilter && colorFilter.trim() !== '') {
          if (vehicle.color?.toLowerCase().trim() !== colorFilter.toLowerCase().trim()) return false;
        }
        // State filter - only apply if explicitly set by user (not auto-set from location)
        if (stateFilter && stateFilter.trim() !== '' && isStateFilterUserSet) {
          if (vehicle.state?.trim() !== stateFilter.trim()) return false;
        }
        // Features filter - vehicle must have all selected features
        if (selectedFeatures.length > 0) {
          if (!vehicle.features || !Array.isArray(vehicle.features)) return false;
          const vehicleFeaturesLower = vehicle.features.map(f => f.toLowerCase().trim());
          const allFeaturesMatch = selectedFeatures.every(feature => 
            vehicleFeaturesLower.includes(feature.toLowerCase().trim())
          );
          if (!allFeaturesMatch) return false;
        }
        
        return true;
    });

    // Debug: Log filter results (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('Filter Results:', {
        totalVehicles: sourceVehicles.length,
        filteredCount: filtered.length,
        activeFilters: {
          category: categoryFilter,
          make: makeFilter,
          model: modelFilter,
          priceRange,
          mileageRange,
          fuelType: fuelTypeFilter,
          year: yearFilter,
          color: colorFilter,
          state: stateFilter,
          features: selectedFeatures
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
  }, [vehicles, categoryFilter, makeFilter, modelFilter, priceRange, mileageRange, fuelTypeFilter, yearFilter, selectedFeatures, sortOrder, isWishlistMode, wishlist, colorFilter, stateFilter]);
  
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
    // Only count price range if it's been explicitly changed from defaults
    if (priceRange.min !== MIN_PRICE || priceRange.max !== MAX_PRICE) count++;
    // Only count mileage range if it's been explicitly changed from defaults
    if (mileageRange.min !== MIN_MILEAGE || mileageRange.max !== MAX_MILEAGE) count++;
    if (fuelTypeFilter && fuelTypeFilter.trim() !== '') count++;
    if (yearFilter && yearFilter !== '0' && yearFilter.trim() !== '') count++;
    if (colorFilter && colorFilter.trim() !== '') count++;
    // Only count state filter if it was explicitly set by the user (not auto-set from location)
    if (stateFilter && stateFilter.trim() !== '' && isStateFilterUserSet) count++;
    count += selectedFeatures.length;
    return count;
  }, [categoryFilter, makeFilter, modelFilter, priceRange, mileageRange, fuelTypeFilter, yearFilter, colorFilter, stateFilter, selectedFeatures, isWishlistMode, isStateFilterUserSet, initialCategory]);

  // Pagination with infinite scroll - show 12 vehicles per page
  const paginatedVehicles = useMemo(() => {
    const startIndex = 0;
    const endIndex = currentPage * BASE_ITEMS_PER_PAGE;
    return processedVehicles.slice(startIndex, endIndex);
  }, [processedVehicles, currentPage]);
  
  const totalPages = Math.ceil(processedVehicles.length / BASE_ITEMS_PER_PAGE);
  const hasMore = currentPage < totalPages;
  
  // Infinite scroll: Load more when user scrolls near bottom
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setIsLoadingMore(true);
          // Small delay for smooth UX
          setTimeout(() => {
            setCurrentPage(prev => prev + 1);
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { rootMargin: '200px' } // Start loading 200px before reaching bottom
    );
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    
    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasMore, isLoadingMore]);

  if (isWishlistMode) {
     return (
      <div className="animate-fade-in container mx-auto py-8">
        <h1 className="text-3xl font-extrabold text-reride-text-dark dark:text-reride-text-dark mb-5 border-b border-gray-200-200 dark:border-gray-200-200 pb-3">{categoryTitle}</h1>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <VehicleCardSkeleton key={index} />)
          ) : processedVehicles.length > 0 ? (
            processedVehicles.map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} onSelect={onSelectVehicle} onToggleCompare={onToggleCompare} isSelectedForCompare={comparisonList.includes(vehicle.id)} onToggleWishlist={onToggleWishlist} isInWishlist={wishlist.includes(vehicle.id)} isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4} onViewSellerProfile={onViewSellerProfile} onQuickView={setQuickViewVehicle} />
            ))
          ) : (
            <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-soft-lg">
              <h3 className="text-xl font-semibold text-reride-text-dark dark:text-brand-gray-200">Your Wishlist is Empty</h3>
              <p className="text-reride-text dark:text-reride-text mt-2">Click the heart icon on any vehicle to save it here.</p>
            </div>
          )}
        </div>
        <QuickViewModal vehicle={quickViewVehicle} onClose={() => setQuickViewVehicle(null)} onSelectVehicle={onSelectVehicle} onToggleCompare={onToggleCompare} onToggleWishlist={onToggleWishlist} comparisonList={comparisonList} wishlist={wishlist} />
      </div>
    );
  }

  const formElementClass = "block w-full p-3 border border-gray-200-300 dark:border-gray-200-300 rounded-lg focus:outline-none transition bg-white dark:bg-white dark:text-reride-text-dark disabled:bg-reride-light-gray dark:disabled:bg-reride-light-gray disabled:cursor-not-allowed";

  const renderFilterControls = (isMobile: boolean) => {
    const state = isMobile ? tempFilters : { categoryFilter, makeFilter, modelFilter, priceRange, mileageRange, fuelTypeFilter, yearFilter, colorFilter, stateFilter, selectedFeatures, featureSearch };
    
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
    
    const handleFeatureToggleLocal = (feature: string) => {
        if (isMobile) {
            setTempFilters(prev => ({
                ...prev,
                selectedFeatures: prev.selectedFeatures.includes(feature)
                    ? prev.selectedFeatures.filter(f => f !== feature)
                    : [...prev.selectedFeatures, feature]
            }));
        } else {
            setSelectedFeatures(prev =>
                prev.includes(feature)
                    ? prev.filter(f => f !== feature)
                    : [...prev, feature]
            );
        }
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (isMobile) {
            setTempFilters(prev => {
                const newState = { ...prev, [name]: value };
                if (name === 'categoryFilter') {
                    // Reset make, model, fuel type, year, and color when category changes
                    newState.makeFilter = '';
                    newState.modelFilter = '';
                    newState.fuelTypeFilter = '';
                    newState.yearFilter = '0';
                    newState.colorFilter = '';
                } else if (name === 'makeFilter') {
                    // Reset model, fuel type, year, and color when make changes
                    newState.modelFilter = '';
                    newState.fuelTypeFilter = '';
                    newState.yearFilter = '0';
                    newState.colorFilter = '';
                } else if (name === 'modelFilter') {
                    // Reset fuel type, year, and color when model changes
                    newState.fuelTypeFilter = '';
                    newState.yearFilter = '0';
                    newState.colorFilter = '';
                }
                return newState;
            });
        } else {
            switch(name) {
                case 'categoryFilter': 
                    // Reset make, model, fuel type, year, and color when category changes
                    setCategoryFilter(value as any);
                    setMakeFilter('');
                    setModelFilter('');
                    setFuelTypeFilter('');
                    setYearFilter('0');
                    setColorFilter('');
                    break;
                case 'makeFilter': 
                    setMakeFilter(value); 
                    setModelFilter('');
                    // Reset fuel type, year, and color when make changes
                    setFuelTypeFilter('');
                    setYearFilter('0');
                    setColorFilter('');
                    break;
                case 'modelFilter': 
                    setModelFilter(value);
                    // Reset fuel type, year, and color when model changes
                    setFuelTypeFilter('');
                    setYearFilter('0');
                    setColorFilter('');
                    break;
                case 'fuelTypeFilter': setFuelTypeFilter(value); break;
                case 'yearFilter': setYearFilter(value); break;
                case 'colorFilter': setColorFilter(value); break;
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
                <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-2">Price Range</label>
                <div className="flex justify-between items-center text-xs text-brand-gray-600 dark:text-reride-text">
                    <span>₹{state.priceRange.min.toLocaleString('en-IN')}</span>
                    <span>₹{state.priceRange.max.toLocaleString('en-IN')}</span>
                </div>
                <div className="relative h-8 flex items-center">
                    <div className="relative w-full h-1.5 bg-reride-light-gray dark:bg-brand-gray-600 rounded-full">
                        <div className="absolute h-1.5 rounded-full" style={{ left: `${((state.priceRange.min - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100}%`, right: `${100 - ((state.priceRange.max - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100}%`, background: 'var(--gradient-warm)' }}></div>
                    </div>
                    <input name="min" type="range" min={MIN_PRICE} max={MAX_PRICE} step="10000" value={state.priceRange.min} onChange={(e) => handleRangeChange(e, 'price')} className="absolute w-full h-1.5 bg-transparent appearance-none z-20 slider-thumb" />
                    <input name="max" type="range" min={MIN_PRICE} max={MAX_PRICE} step="10000" value={state.priceRange.max} onChange={(e) => handleRangeChange(e, 'price')} className="absolute w-full h-1.5 bg-transparent appearance-none z-30 slider-thumb" />
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-2">Mileage (kms)</label>
                <div className="flex justify-between items-center text-xs text-brand-gray-600 dark:text-reride-text">
                    <span>{state.mileageRange.min.toLocaleString('en-IN')}</span>
                    <span>{state.mileageRange.max.toLocaleString('en-IN')}</span>
                </div>
                <div className="relative h-8 flex items-center">
                    <div className="relative w-full h-1.5 bg-reride-light-gray dark:bg-brand-gray-600 rounded-full">
                        <div className="absolute h-1.5 rounded-full" style={{ left: `${((state.mileageRange.min - MIN_MILEAGE) / (MAX_MILEAGE - MIN_MILEAGE)) * 100}%`, right: `${100 - ((state.mileageRange.max - MIN_MILEAGE) / (MAX_MILEAGE - MIN_MILEAGE)) * 100}%`, background: 'var(--gradient-warm)' }}></div>
                    </div>
                    <input name="min" type="range" min={MIN_MILEAGE} max={MAX_MILEAGE} step="1000" value={state.mileageRange.min} onChange={(e) => handleRangeChange(e, 'mileage')} className="absolute w-full h-1.5 bg-transparent appearance-none z-20 slider-thumb" />
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
                <label htmlFor="color-filter" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">Color</label>
                <select id="color-filter" name="colorFilter" value={state.colorFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="">Any Color</option>
                    {(isMobile ? tempUniqueColors : uniqueColors).map(color => <option key={color} value={color}>{color}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="state-filter" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">State</label>
                <select id="state-filter" name="stateFilter" value={state.stateFilter} onChange={handleSelectChange} className={formElementClass}>
                    <option value="">Any State</option>
                    {uniqueStates.map(st => <option key={st.code} value={st.code}>{st.name}</option>)}
                </select>
            </div>
            <div className="relative" ref={isMobile ? mobileFeaturesFilterRef : featuresFilterRef}>
                <label htmlFor="features-filter-button" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">Features</label>
                <button id="features-filter-button" type="button" onClick={() => isMobile ? setIsMobileFeaturesOpen(p => !p) : setIsFeaturesOpen(p => !p)} className={`${formElementClass} flex justify-between items-center text-left min-h-[50px]`}>
                    <div className="flex flex-wrap gap-1 items-center">
                        {state.selectedFeatures.length > 0 ? ( state.selectedFeatures.slice(0, 2).map(feature => ( <span key={feature} className="text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1.5" style={{ background: '#FF6B35' }}>{feature} <button type="button" onClick={(e) => { e.stopPropagation(); handleFeatureToggleLocal(feature); }} className="bg-white/20 hover:bg-white/40 rounded-full h-4 w-4 flex items-center justify-center text-white" aria-label={`Remove ${feature}`}>&times;</button></span>)) ) : ( <span className="text-reride-text dark:text-reride-text">Select features...</span> )}
                        {state.selectedFeatures.length > 2 && ( <span className="text-xs font-semibold text-reride-text dark:text-reride-text">+{state.selectedFeatures.length - 2} more</span> )}
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${(isMobile ? isMobileFeaturesOpen : isFeaturesOpen) ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {(isMobile ? isMobileFeaturesOpen : isFeaturesOpen) && (
                    <div className="absolute top-full mt-2 w-full bg-white dark:bg-brand-gray-700 rounded-lg shadow-soft-xl border border-gray-200-200 dark:border-gray-200-300 z-20 overflow-hidden animate-fade-in">
                        <div className="p-2"><input ref={featuresSearchInputRef} type="text" placeholder="Search features..." value={isMobile ? tempFilters.featureSearch : featureSearch} onChange={e => { isMobile ? setTempFilters(p => ({...p, featureSearch: e.target.value})) : setFeatureSearch(e.target.value) }} className="block w-full p-2 border border-gray-200-300 dark:border-gray-200-500 rounded-md bg-white text-sm focus:outline-none" onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--reride-orange)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }} /></div>
                        <div className="max-h-48 overflow-y-auto">
                            {(isMobile ? tempFilteredFeatures : filteredFeatures).map(feature => ( <label key={feature} className="flex items-center space-x-3 cursor-pointer group p-3 transition-colors hover:bg-reride-off-white dark:hover:bg-brand-gray-600"><input type="checkbox" checked={state.selectedFeatures.includes(feature)} onChange={() => handleFeatureToggleLocal(feature)} className="h-4 w-4 rounded border-gray-200-300 dark:border-gray-200-500 bg-transparent" style={{ accentColor: '#FF6B35' }} /><span className="text-sm text-reride-text-dark dark:text-brand-gray-200">{feature}</span></label> ))}
                            {(isMobile ? tempFilteredFeatures.length === 0 : filteredFeatures.length === 0) && ( <p className="p-3 text-sm text-center text-reride-text dark:text-reride-text">No features found.</p> )}
                        </div>
                    </div>
                )}
            </div>
            {!isMobile && (
              <div className="space-y-2 mt-2">
                <button onClick={handleResetFilters} className="w-full bg-reride-light-gray dark:bg-brand-gray-700 text-reride-text-dark dark:text-brand-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-brand-gray-300 dark:hover:bg-brand-gray-600 transition-colors">
                  Reset Filters
                </button>
                <button 
                  onClick={handleSaveSearch} 
                  className="w-full bg-reride-orange text-white font-bold py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Save Search
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
        className="w-full min-h-screen"
        style={{
          background: 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
          minHeight: '100vh'
        }}
      >
        {/* Premium Search Bar */}
        <div className="px-4 pt-4 pb-3">
          <div 
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-4"
            style={{
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by brand, model, budget..."
                  value={aiSearchQuery}
                  onChange={handleAiQueryChange}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch(); }}
                  className="w-full pl-12 pr-4 py-3.5 text-base bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition-all"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <button
                onClick={() => handleAiSearch()}
                disabled={isAiSearching}
                className="px-5 py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                  boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
                  minWidth: '80px'
                }}
              >
                {isAiSearching ? '...' : 'Search'}
              </button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <ul className="divide-y divide-gray-100">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>
                      <button
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-4 py-3 text-gray-900 hover:bg-gray-50 transition-colors font-medium"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Premium Filter & Sort Bar - Sticky positioning for mobile app */}
        <div 
          className="sticky-filter-bar px-4 py-3 mb-2"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={handleOpenFilterModal}
                className="relative p-3 rounded-xl transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                  boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
                  minWidth: '48px',
                  minHeight: '48px'
                }}
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                {activeFilterCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold text-white rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
                      minWidth: '20px'
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">Showing</p>
                <p className="text-sm font-bold text-gray-900">
                  {paginatedVehicles.length} of {processedVehicles.length}
                </p>
              </div>
            </div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
              style={{
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}
            >
              {Object.entries(sortOptions).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Vehicle List - with proper spacing to prevent overlap with sticky filter bar */}
        <div className="vehicle-list-container px-4 pb-24">
          <div className="flex flex-col gap-4" data-testid="vehicle-results">
            {isLoading || isAiSearching ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse"
                  style={{
                    height: '200px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div className="w-full h-32 bg-gray-200"></div>
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
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
                        <span className="text-gray-600 text-sm">Loading more...</span>
                      </div>
                    ) : (
                      <div className="h-20" />
                    )}
                  </div>
                )}
                {!hasMore && processedVehicles.length > BASE_ITEMS_PER_PAGE && (
                  <div className="text-center py-4 text-xs text-gray-600">
                    Showing all {processedVehicles.length} vehicles
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
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Vehicles Found</h3>
                <p className="text-gray-600 text-sm">Try adjusting your filters or search query</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Filter Sheet */}
        <MobileFilterSheet
          isOpen={isFilterModalOpen}
          onClose={handleCloseFilterModal}
          title="Filters"
          footer={
            <div className="flex gap-3 px-4 pb-4">
              <button 
                onClick={handleResetTempFilters} 
                className="flex-1 py-4 px-4 rounded-2xl font-bold text-base text-gray-700 bg-white border-2 border-gray-200 transition-all active:scale-95"
                style={{
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                }}
              >
                Reset
              </button>
              <button 
                onClick={handleApplyFilters} 
                className="flex-1 py-4 px-4 rounded-2xl font-bold text-base text-white transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                  boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)'
                }}
              >
                Apply Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 bg-white/30 text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          }
        >
          {renderFilterControls(true)}
        </MobileFilterSheet>

        <QuickViewModal
          vehicle={quickViewVehicle}
          onClose={() => setQuickViewVehicle(null)}
          onSelectVehicle={onSelectVehicle}
          onToggleCompare={onToggleCompare}
          onToggleWishlist={onToggleWishlist}
          comparisonList={comparisonList}
          wishlist={wishlist}
        />
      </div>
    );
  }

  // Desktop UI (existing)
  return (
    <>
      <div className="min-h-screen bg-white lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-blue-50 relative overflow-hidden">
        {/* Background Elements - Hidden on mobile */}
        <div className="hidden lg:block absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-orange-200/15 to-pink-200/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>
        
        <div className="relative z-10 used-cars-page grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 lg:gap-8 container mx-auto py-4 lg:py-8">
          <aside className={`filters hidden lg:block lg:sticky top-24 self-start space-y-6 transition-all duration-300 ${isDesktopFilterVisible ? 'w-[300px] opacity-100' : 'w-0 opacity-0 -translate-x-full'}`}>
              <div className={`bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 ${isDesktopFilterVisible ? 'block' : 'hidden'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">Filters</h2>
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
                  Describe what you're looking for, e.g., "a white Tata Nexon under ₹15 lakhs with a sunroof"
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
                Describe what you're looking for, e.g., "a white Tata Nexon under ₹15 lakhs with a sunroof"
              </p>
              <div className={`relative ${isAiSearchCollapsed ? 'hidden lg:block' : ''}`} ref={aiSearchRef}>
                  <div className="flex gap-2">
                      <input type="text" id="ai-search" placeholder="Let our AI find your perfect vehicle..." value={aiSearchQuery} onChange={handleAiQueryChange} onFocus={() => setShowSuggestions(suggestions.length > 0)} onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch(); }} autoComplete="off" className={`${formElementClass} text-sm py-2`} style={{ fontSize: '14px' }} />
                      <button onClick={() => handleAiSearch()} disabled={isAiSearching} className="btn-brand-primary text-white font-bold py-2 px-3 lg:px-4 rounded-lg transition-colors disabled:bg-brand-gray-400 disabled:cursor-wait text-xs lg:text-sm whitespace-nowrap flex-shrink-0">{isAiSearching ? '...' : 'Search'}</button>
                  </div>
                  {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full mt-2 w-full bg-white dark:bg-brand-gray-700 rounded-lg shadow-soft-xl border border-gray-200-200 dark:border-gray-200-300 z-10 overflow-hidden"><ul className="divide-y divide-brand-gray-100 dark:divide-brand-gray-600">{suggestions.map((suggestion, index) => ( <li key={index}><button onClick={() => handleSuggestionClick(suggestion)} className="w-full text-left px-4 py-2 text-reride-text-dark dark:text-brand-gray-200 hover:bg-reride-off-white dark:hover:bg-brand-gray-600 transition-colors">{suggestion}</button></li>))}</ul></div>
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
                  onClick={handleOpenFilterModal} 
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
                  <span className="text-gray-500 dark:text-gray-400">Showing</span>{' '}
                  <span className="font-bold text-gray-900 dark:text-white">{paginatedVehicles.length}</span>{' '}
                  <span className="text-gray-500 dark:text-gray-400">of</span>{' '}
                  <span className="font-bold text-gray-900 dark:text-white">{processedVehicles.length}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center p-0.5 bg-reride-off-white dark:bg-brand-gray-700 rounded-md">
                  <button title="Grid View" onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow' : 'text-reride-text hover:text-reride-text-dark dark:hover:text-brand-gray-200'}`} style={viewMode === 'grid' ? { color: '#FF6B35' } : undefined}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  </button>
                  <button title="List View" onClick={() => setViewMode('tile')} className={`p-1.5 rounded transition-colors ${viewMode === 'tile' ? 'bg-white shadow' : 'text-reride-text hover:text-reride-text-dark dark:hover:text-brand-gray-200'}`} style={viewMode === 'tile' ? { color: '#FF6B35' } : undefined}>
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
                      onQuickView={setQuickViewVehicle} 
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
                        <span className="text-gray-600">Loading more vehicles...</span>
                      </div>
                    ) : (
                      <div className="h-20" /> // Spacer for intersection observer
                    )}
                  </div>
                )}
                {/* Show total count */}
                {!hasMore && processedVehicles.length > BASE_ITEMS_PER_PAGE && (
                  <div className="col-span-full text-center py-4 text-sm text-gray-600">
                    Showing all {processedVehicles.length} vehicles
                  </div>
                )}
              </>
            ) : (
              <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-soft-lg">
                <h3 className="text-xl font-semibold text-reride-text-dark dark:text-brand-gray-200">No Vehicles Found</h3>
                <p className="text-reride-text dark:text-reride-text mt-2">Try adjusting your filters or using the AI search to find your perfect vehicle.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Filter Sheet - Using MobileFilterSheet Component */}
      {isMobileApp && (
        <MobileFilterSheet
          isOpen={isFilterModalOpen}
          onClose={handleCloseFilterModal}
          title="Filters"
          footer={
            <div className="flex gap-3">
              <button 
                onClick={handleResetTempFilters} 
                className="flex-1 native-button native-button-secondary font-semibold py-3"
              >
                Reset
              </button>
              <button 
                onClick={handleApplyFilters} 
                className="flex-1 native-button native-button-primary font-semibold py-3"
              >
                Apply Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 bg-white/30 text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          }
        >
          {renderFilterControls(true)}
        </MobileFilterSheet>
      )}

      {/* Desktop Filter Modal - Keep existing for desktop */}
      {!isMobileApp && isFilterModalOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50 animate-fade-in" onClick={handleCloseFilterModal} style={{ backdropFilter: 'blur(4px)' }}>
            <div 
              className="bg-white rounded-t-3xl h-[90vh] flex flex-col absolute bottom-0 left-0 right-0 safe-bottom shadow-2xl" 
              onClick={e => e.stopPropagation()}
              style={{ 
                animation: 'slideUp 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
              }}
            >
                <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0 safe-top">
                    <h2 className="text-xl font-bold text-gray-900">Filters</h2>
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
                      Reset
                    </button>
                    <button 
                      onClick={handleApplyFilters} 
                      className="flex-1 native-button native-button-primary font-semibold py-3"
                    >
                      Apply Filters
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

      <QuickViewModal vehicle={quickViewVehicle} onClose={() => setQuickViewVehicle(null)} onSelectVehicle={onSelectVehicle} onToggleCompare={onToggleCompare} onToggleWishlist={onToggleWishlist} comparisonList={comparisonList} wishlist={wishlist} />
    </div>
    </>
  );
});

VehicleList.displayName = 'VehicleList';

export default VehicleList;

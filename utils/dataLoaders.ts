/**
 * Data Loaders - Lazy load heavy static data to improve initial page load
 * These utilities dynamically import large data files only when needed
 */

export const loadConstants = async () => {
  const module = await import('../constants.js');
  return module;
};

export const loadVehicleData = async () => {
  const module = await import('../components/vehicleData.js');
  return module;
};

export const loadNewCarsData = async () => {
  const module = await import('../data/newCarsData.js');
  return module;
};

// Helper to get PLAN_DETAILS without loading entire constants file
export const loadPlanDetails = async () => {
  const { loadPlanDetails: loadPlans } = await import('../constants/index.js');
  return loadPlans();
};

// Helper to get location data
export const loadLocationData = async () => {
  const { loadLocationData: loadLoc } = await import('../constants/index.js');
  return loadLoc();
};

// Helper to get boost packages
export const loadBoostPackages = async () => {
  const { loadBoostPackages: loadBoost } = await import('../constants/index.js');
  return loadBoost();
};

// Helper to get fallback data
export const loadFallbackData = async () => {
  const { loadFallbackData: loadFallback } = await import('../constants/index.js');
  return loadFallback();
};

// Helper to get MOCK_SUPPORT_TICKETS without loading entire constants file
export const loadMockSupportTickets = async () => {
  const fallbackData = await loadFallbackData();
  return fallbackData.supportTickets;
};

// Helper to get MOCK_FAQS without loading entire constants file
export const loadMockFaqs = async () => {
  const fallbackData = await loadFallbackData();
  return fallbackData.faqs;
};

// Helper to get vehicle placeholder image function
export const loadPlaceholderImageHelper = async () => {
  const { getPlaceholderImage } = await import('../components/vehicleData.js');
  return getPlaceholderImage;
};


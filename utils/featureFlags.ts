/**
 * Feature Flags System
 * Allows enabling/disabling experimental features without code changes
 */

export interface FeatureFlags {
  // Experimental features
  enableGeminiAI: boolean;
  enableAdvancedSearch: boolean;
  enableRealTimeNotifications: boolean;
  enableAnalytics: boolean;
  
  // Performance features
  enableServiceWorker: boolean;
  enableImageOptimization: boolean;
  
  // UI features
  enableDarkMode: boolean;
  enableCommandPalette: boolean;
}

/**
 * Get feature flags from environment variables or defaults
 */
export function getFeatureFlags(): FeatureFlags {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    // Experimental features - disabled by default in production
    enableGeminiAI: process.env.VITE_FEATURE_GEMINI_AI === 'true',
    enableAdvancedSearch: process.env.VITE_FEATURE_ADVANCED_SEARCH !== 'false',
    enableRealTimeNotifications: process.env.VITE_FEATURE_REALTIME_NOTIFICATIONS !== 'false',
    enableAnalytics: process.env.VITE_FEATURE_ANALYTICS === 'true' && isProduction,
    
    // Performance features
    enableServiceWorker: process.env.VITE_FEATURE_SERVICE_WORKER !== 'false',
    enableImageOptimization: process.env.VITE_FEATURE_IMAGE_OPTIMIZATION !== 'false',
    
    // UI features
    enableDarkMode: process.env.VITE_FEATURE_DARK_MODE === 'true',
    enableCommandPalette: process.env.VITE_FEATURE_COMMAND_PALETTE !== 'false',
  };
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}

/**
 * Get feature flag value
 */
export function getFeatureFlag<K extends keyof FeatureFlags>(feature: K): FeatureFlags[K] {
  const flags = getFeatureFlags();
  return flags[feature];
}



import type { PlatformSettings } from '../types';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

const SETTINGS_STORAGE_KEY = 'reRidePlatformSettings';

const defaultSettings: PlatformSettings = {
    listingFee: 25,
    siteAnnouncement: 'Welcome to ReRide! All EVs are 10% off this week.',
};

// Synchronous localStorage-backed getters/setters remain so callers that run
// during initial render (AppProvider useState) still see a usable value before
// the API round-trip completes. Server data is hydrated via fetchSettings().
export const getSettings = (): PlatformSettings => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return defaultSettings;
    }
    const settingsJson = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return settingsJson ? { ...defaultSettings, ...JSON.parse(settingsJson) } : defaultSettings;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to parse settings from localStorage', error);
    }
    return defaultSettings;
  }
};

export const saveSettings = (settings: PlatformSettings) => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to save settings to localStorage', error);
    }
  }
};

interface ApiSettingsResponse {
  success?: boolean;
  settings?: Partial<PlatformSettings> & {
    updatedAt?: string | null;
    updatedBy?: string | null;
  };
  reason?: string;
  error?: string;
}

const normalizeSettings = (partial: Partial<PlatformSettings> | undefined): PlatformSettings => ({
  listingFee: typeof partial?.listingFee === 'number' && Number.isFinite(partial.listingFee)
    ? partial.listingFee
    : defaultSettings.listingFee,
  siteAnnouncement: typeof partial?.siteAnnouncement === 'string'
    ? partial.siteAnnouncement
    : defaultSettings.siteAnnouncement,
});

/**
 * Fetch platform settings from the Supabase-backed API.
 * Falls back to defaultSettings if the API is unreachable; the caller is
 * responsible for overlaying with any locally cached value it already holds.
 */
export const fetchSettings = async (): Promise<PlatformSettings> => {
  try {
    const response = await authenticatedFetch('/api/settings', {
      method: 'GET',
      skipAuth: true,
    });
    const parsed = await handleApiResponse<ApiSettingsResponse>(response);
    if (!response.ok || parsed.success === false) {
      throw new Error(parsed.reason || parsed.error || `Failed to fetch settings (${response.status})`);
    }
    const next = normalizeSettings(parsed.data?.settings);
    saveSettings(next);
    return next;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to fetch platform settings from API, using cached/default values:', error);
    }
    return getSettings();
  }
};

/**
 * Persist platform settings via the admin API. Writes to localStorage
 * optimistically so the current tab reflects the change immediately, then
 * replaces the cache with the server's response on success.
 */
export const updateSettings = async (settings: PlatformSettings): Promise<PlatformSettings> => {
  saveSettings(settings);
  try {
    const response = await authenticatedFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        listingFee: settings.listingFee,
        siteAnnouncement: settings.siteAnnouncement,
      }),
    });
    const parsed = await handleApiResponse<ApiSettingsResponse>(response);
    if (!response.ok || parsed.success === false) {
      throw new Error(parsed.reason || parsed.error || `Failed to save settings (${response.status})`);
    }
    const next = normalizeSettings(parsed.data?.settings);
    saveSettings(next);
    return next;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to persist platform settings to API (kept local copy):', error);
    }
    throw error;
  }
};

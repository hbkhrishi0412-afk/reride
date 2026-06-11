/**
 * Production-Ready Validation Utilities
 * Comprehensive validation for vehicle listings, user data, and form inputs
 */

import type { Vehicle, User } from '../types.js';
import { VehicleCategory } from '../vehicle-category.js';

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Valid Indian RTO code pattern
const RTO_CODE_PATTERN = /^[A-Z]{2}-\d{1,2}$/;

// Valid Indian registration number pattern
const REGISTRATION_PATTERN = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{1,4}$/i;

// Valid phone number patterns
const INDIAN_PHONE_PATTERN = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
const INTERNATIONAL_PHONE_PATTERN = /^\+\d{1,3}[\s-]?\d{6,14}$/;

// Valid pincode pattern
const PINCODE_PATTERN = /^\d{6}$/;

// Aadhar pattern (XXXX XXXX XXXX)
const AADHAR_PATTERN = /^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/;

// PAN pattern (ABCDE1234F)
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/i;

// Email pattern
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Indian vehicle makes
const VALID_MAKES = [
  'Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Kia', 'Toyota', 'Honda',
  'Volkswagen', 'Skoda', 'MG', 'Ford', 'Renault', 'Nissan', 'Jeep', 'Citroen',
  'BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Volvo', 'Land Rover', 'Jaguar',
  'Porsche', 'Mini', 'Isuzu', 'Force', 'Ashok Leyland',
  // Two wheelers
  'Hero', 'Honda', 'Bajaj', 'TVS', 'Royal Enfield', 'Yamaha', 'Suzuki', 'KTM',
  'Kawasaki', 'Harley-Davidson', 'Triumph', 'Ducati', 'BMW Motorrad', 'Benelli',
  'Jawa', 'Yezdi', 'Ola', 'Ather', 'Simple',
];

// Price ranges by category (in INR)
const PRICE_RANGES: Record<VehicleCategory, { min: number; max: number }> = {
  [VehicleCategory.FOUR_WHEELER]: { min: 50000, max: 100000000 },
  [VehicleCategory.TWO_WHEELER]: { min: 10000, max: 5000000 },
  [VehicleCategory.THREE_WHEELER]: { min: 50000, max: 1000000 },
  [VehicleCategory.COMMERCIAL]: { min: 100000, max: 50000000 },
  [VehicleCategory.FARM]: { min: 100000, max: 30000000 },
  [VehicleCategory.CONSTRUCTION]: { min: 500000, max: 100000000 },
};

// Year ranges
const MIN_VEHICLE_YEAR = 1990;
const MAX_VEHICLE_YEAR = new Date().getFullYear() + 1;

// Mileage limits by category
const MILEAGE_LIMITS: Record<VehicleCategory, number> = {
  [VehicleCategory.FOUR_WHEELER]: 500000,
  [VehicleCategory.TWO_WHEELER]: 200000,
  [VehicleCategory.THREE_WHEELER]: 300000,
  [VehicleCategory.COMMERCIAL]: 1000000,
  [VehicleCategory.FARM]: 50000, // In hours typically
  [VehicleCategory.CONSTRUCTION]: 100000, // In hours
};

/**
 * Validate vehicle listing data
 */
export function validateVehicleListing(data: Partial<Vehicle>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required fields
  if (!data.make || data.make.trim() === '') {
    errors.push({ field: 'make', message: 'Vehicle make is required', code: 'REQUIRED_MAKE' });
  } else if (!isValidMake(data.make)) {
    warnings.push({ 
      field: 'make', 
      message: 'Make not recognized',
      suggestion: 'Please check spelling or select from popular makes'
    });
  }

  if (!data.model || data.model.trim() === '') {
    errors.push({ field: 'model', message: 'Vehicle model is required', code: 'REQUIRED_MODEL' });
  }

  if (!data.year) {
    errors.push({ field: 'year', message: 'Year is required', code: 'REQUIRED_YEAR' });
  } else if (data.year < MIN_VEHICLE_YEAR || data.year > MAX_VEHICLE_YEAR) {
    errors.push({ 
      field: 'year', 
      message: `Year must be between ${MIN_VEHICLE_YEAR} and ${MAX_VEHICLE_YEAR}`,
      code: 'INVALID_YEAR'
    });
  }

  if (!data.price || data.price <= 0) {
    errors.push({ field: 'price', message: 'Price is required', code: 'REQUIRED_PRICE' });
  } else {
    const category = data.category || VehicleCategory.FOUR_WHEELER;
    const priceRange = PRICE_RANGES[category];
    
    if (data.price < priceRange.min) {
      errors.push({
        field: 'price',
        message: `Price seems too low for ${category}. Minimum: ₹${priceRange.min.toLocaleString('en-IN')}`,
        code: 'PRICE_TOO_LOW'
      });
    } else if (data.price > priceRange.max) {
      errors.push({
        field: 'price',
        message: `Price seems too high for ${category}. Maximum: ₹${priceRange.max.toLocaleString('en-IN')}`,
        code: 'PRICE_TOO_HIGH'
      });
    }
  }

  // Mileage validation
  if (data.mileage !== undefined && data.mileage !== null) {
    if (data.mileage < 0) {
      errors.push({ field: 'mileage', message: 'Mileage cannot be negative', code: 'NEGATIVE_MILEAGE' });
    } else {
      const category = data.category || VehicleCategory.FOUR_WHEELER;
      const maxMileage = MILEAGE_LIMITS[category];
      
      if (data.mileage > maxMileage) {
        warnings.push({
          field: 'mileage',
          message: `Mileage of ${data.mileage.toLocaleString()} km is unusually high`,
          suggestion: 'Please verify the odometer reading'
        });
      }

      // Check mileage vs age consistency
      if (data.year) {
        const ageYears = new Date().getFullYear() - data.year;
        const expectedMaxMileage = ageYears * 30000; // 30k km/year max expected
        
        if (data.mileage > expectedMaxMileage && ageYears > 0) {
          warnings.push({
            field: 'mileage',
            message: 'High mileage for vehicle age',
            suggestion: `Expected max ~${expectedMaxMileage.toLocaleString()} km for a ${ageYears} year old vehicle`
          });
        }
      }
    }
  }

  // Images validation
  if (!data.images || data.images.length === 0) {
    errors.push({ field: 'images', message: 'At least one image is required', code: 'NO_IMAGES' });
  } else if (data.images.length < 4) {
    warnings.push({
      field: 'images',
      message: 'Listings with 6+ photos get 3x more inquiries',
      suggestion: 'Add more photos showing all angles'
    });
  }

  // Seller email
  if (!data.sellerEmail || !EMAIL_PATTERN.test(data.sellerEmail)) {
    errors.push({ field: 'sellerEmail', message: 'Valid seller email is required', code: 'INVALID_EMAIL' });
  }

  // RTO code validation
  if (data.rto && !RTO_CODE_PATTERN.test(data.rto.toUpperCase())) {
    warnings.push({
      field: 'rto',
      message: 'RTO code format may be incorrect',
      suggestion: 'Format should be like MH-12 or DL-01'
    });
  }

  // Registration number validation
  if (data.registrationNumber && !REGISTRATION_PATTERN.test(data.registrationNumber)) {
    warnings.push({
      field: 'registrationNumber',
      message: 'Registration number format may be incorrect',
      suggestion: 'Format should be like MH12AB1234'
    });
  }

  // Fuel type and engine consistency
  if (data.fuelType === 'Electric' && data.engine && data.engine.toLowerCase().includes('cc')) {
    warnings.push({
      field: 'engine',
      message: 'Electric vehicles typically do not have engine displacement',
      suggestion: 'Consider using battery capacity (kWh) instead'
    });
  }

  // Description quality
  if (!data.description || data.description.length < 50) {
    warnings.push({
      field: 'description',
      message: 'Short description may reduce buyer interest',
      suggestion: 'Add details about condition, history, and features'
    });
  } else if (data.description.length > 5000) {
    warnings.push({
      field: 'description',
      message: 'Description is very long',
      suggestion: 'Consider keeping it concise (under 2000 characters)'
    });
  }

  // Number of owners
  if (data.noOfOwners !== undefined) {
    if (data.noOfOwners < 1 || data.noOfOwners > 10) {
      errors.push({ 
        field: 'noOfOwners', 
        message: 'Number of owners should be between 1 and 10',
        code: 'INVALID_OWNERS'
      });
    }

    // Check owners vs age consistency
    if (data.year) {
      const ageYears = new Date().getFullYear() - data.year;
      if (data.noOfOwners > ageYears + 1) {
        warnings.push({
          field: 'noOfOwners',
          message: 'Number of owners seems high for vehicle age',
          suggestion: 'Please verify the ownership history'
        });
      }
    }
  }

  // Insurance validation
  if (data.insuranceValidity) {
    const insuranceDate = new Date(data.insuranceValidity + '-01');
    const now = new Date();
    
    if (insuranceDate < now) {
      warnings.push({
        field: 'insuranceValidity',
        message: 'Insurance appears to be expired',
        suggestion: 'Update insurance details or renew before selling'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate user registration/profile data
 */
export function validateUserData(data: Partial<User>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Name validation
  if (!data.name || data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters', code: 'INVALID_NAME' });
  } else if (data.name.length > 100) {
    errors.push({ field: 'name', message: 'Name is too long', code: 'NAME_TOO_LONG' });
  }

  // Email validation
  if (!data.email || !EMAIL_PATTERN.test(data.email)) {
    errors.push({ field: 'email', message: 'Valid email is required', code: 'INVALID_EMAIL' });
  }

  // Phone validation
  if (data.mobile) {
    if (!INDIAN_PHONE_PATTERN.test(data.mobile) && !INTERNATIONAL_PHONE_PATTERN.test(data.mobile)) {
      errors.push({ 
        field: 'mobile', 
        message: 'Invalid phone number format',
        code: 'INVALID_PHONE'
      });
    }
  }

  // Pincode validation
  if (data.pincode && !PINCODE_PATTERN.test(data.pincode)) {
    errors.push({ field: 'pincode', message: 'Pincode must be 6 digits', code: 'INVALID_PINCODE' });
  }

  // Aadhar validation
  if (data.aadharCard?.number && !AADHAR_PATTERN.test(data.aadharCard.number)) {
    errors.push({ 
      field: 'aadharCard', 
      message: 'Invalid Aadhar number format',
      code: 'INVALID_AADHAR'
    });
  }

  // PAN validation
  if (data.panCard?.number && !PAN_PATTERN.test(data.panCard.number)) {
    errors.push({ field: 'panCard', message: 'Invalid PAN number format', code: 'INVALID_PAN' });
  }

  // Role validation
  if (data.role && !['customer', 'seller', 'admin', 'service_provider', 'finance_partner'].includes(data.role)) {
    errors.push({ field: 'role', message: 'Invalid user role', code: 'INVALID_ROLE' });
  }

  // Dealership name for sellers
  if (data.role === 'seller' && data.dealershipName) {
    if (data.dealershipName.length < 3) {
      warnings.push({
        field: 'dealershipName',
        message: 'Dealership name is very short',
        suggestion: 'Use your full business name for better visibility'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate search/filter parameters
 */
export function validateSearchFilters(filters: Record<string, any>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
    if (filters.minPrice > filters.maxPrice) {
      errors.push({
        field: 'price',
        message: 'Minimum price cannot be greater than maximum price',
        code: 'INVALID_PRICE_RANGE'
      });
    }
  }

  if (filters.minYear !== undefined && filters.maxYear !== undefined) {
    if (filters.minYear > filters.maxYear) {
      errors.push({
        field: 'year',
        message: 'Minimum year cannot be greater than maximum year',
        code: 'INVALID_YEAR_RANGE'
      });
    }
  }

  if (filters.minMileage !== undefined && filters.maxMileage !== undefined) {
    if (filters.minMileage > filters.maxMileage) {
      errors.push({
        field: 'mileage',
        message: 'Minimum mileage cannot be greater than maximum mileage',
        code: 'INVALID_MILEAGE_RANGE'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize text input to prevent XSS
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Check if make is in known list
 */
function isValidMake(make: string): boolean {
  const normalizedMake = make.toLowerCase().trim();
  return VALID_MAKES.some(m => m.toLowerCase() === normalizedMake);
}

/**
 * Validate image URL
 */
export function validateImageUrl(url: string): { valid: boolean; reason?: string } {
  if (!url) {
    return { valid: false, reason: 'URL is empty' };
  }

  try {
    const parsed = new URL(url);
    
    // Must be HTTPS in production
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, reason: 'URL must use HTTP or HTTPS' };
    }

    // Check for common image extensions or storage URLs
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const hasValidExtension = validExtensions.some(ext => 
      parsed.pathname.toLowerCase().endsWith(ext)
    );
    
    const isStorageUrl = 
      url.includes('supabase.co/storage') ||
      url.includes('firebasestorage.googleapis.com') ||
      url.includes('cloudinary.com') ||
      url.includes('imgix.net');

    if (!hasValidExtension && !isStorageUrl) {
      return { valid: false, reason: 'URL does not appear to be an image' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.isValid) return '';
  
  return result.errors.map(e => `• ${e.field}: ${e.message}`).join('\n');
}

/**
 * Format validation warnings for display
 */
export function formatValidationWarnings(result: ValidationResult): string {
  if (result.warnings.length === 0) return '';
  
  return result.warnings.map(w => 
    `• ${w.field}: ${w.message}${w.suggestion ? ` (${w.suggestion})` : ''}`
  ).join('\n');
}

export { VALID_MAKES, PRICE_RANGES };

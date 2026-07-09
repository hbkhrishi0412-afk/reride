/**
 * Listing Enhancement Service
 * Integrates validation and quality scoring into the vehicle listing flow
 */

import type { Vehicle } from '../types.js';
import { validateVehicleListing, type ValidationResult } from '../utils/validation.js';

export interface ListingEnhancementResult {
  success: boolean;
  vehicle: Vehicle;
  validation: ValidationResult;
  photoQuality?: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  enhancements: string[];
  errors: string[];
}

export interface EnhancementOptions {
  runValidation?: boolean;
  checkPhotoQuality?: boolean;
  calculateListingScore?: boolean;
}

const DEFAULT_OPTIONS: EnhancementOptions = {
  runValidation: true,
  checkPhotoQuality: true,
  calculateListingScore: true,
};

function assessPhotoCount(imageUrls: string[]) {
  const count = imageUrls?.length || 0;
  const missingViews: string[] = [];
  const expected = ['front', 'rear', 'left_side', 'right_side', 'interior_front', 'tyres'];
  if (count < expected.length) {
    missingViews.push(...expected.slice(Math.max(0, count)));
  }
  const overallScore = Math.min(100, count * 12);
  const recommendations: string[] = [];
  if (count < 6) {
    recommendations.push(`Add ${6 - count} more photo${6 - count === 1 ? '' : 's'} for better visibility`);
  }
  return { overallScore, issues: [] as string[], missingViews, recommendations };
}

export async function enhanceVehicleListing(
  vehicleData: Partial<Vehicle>,
  options: EnhancementOptions = DEFAULT_OPTIONS
): Promise<ListingEnhancementResult> {
  const enhancements: string[] = [];
  const errors: string[] = [];
  let vehicle = { ...vehicleData } as Vehicle;

  const validation = options.runValidation
    ? validateVehicleListing(vehicleData)
    : { isValid: true, errors: [], warnings: [] };

  if (!validation.isValid) {
    return {
      success: false,
      vehicle,
      validation,
      enhancements,
      errors: validation.errors.map(e => e.message),
    };
  }

  validation.warnings.forEach(w => {
    enhancements.push(`Warning: ${w.field} - ${w.message}`);
  });

  let photoQualityResult: ListingEnhancementResult['photoQuality'];
  if (options.checkPhotoQuality && vehicle.images && vehicle.images.length > 0) {
    const quality = assessPhotoCount(vehicle.images);
    photoQualityResult = {
      score: quality.overallScore,
      issues: quality.issues,
      recommendations: quality.recommendations,
    };

    vehicle.photoQuality = quality.overallScore >= 70 ? 'high' : quality.overallScore >= 40 ? 'medium' : 'low';
    vehicle.hasMinimumPhotos = vehicle.images.length >= 6;

    enhancements.push(`Photo quality assessed: ${quality.overallScore}/100`);

    if (quality.missingViews.length > 0) {
      enhancements.push(`Consider adding: ${quality.missingViews.slice(0, 3).join(', ')}`);
    }
  }

  if (options.calculateListingScore) {
    const qualityScore = calculateListingQualityScore(vehicle);
    vehicle.descriptionQuality = qualityScore;
    enhancements.push(`Listing quality score: ${qualityScore}/100`);
  }

  const now = new Date().toISOString();
  if (!vehicle.createdAt) {
    vehicle.createdAt = now;
  }
  vehicle.updatedAt = now;

  if (!vehicle.listingStatus) {
    vehicle.listingStatus = 'active';
  }

  if (!vehicle.listingExpiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    vehicle.listingExpiresAt = expiryDate.toISOString();
  }

  return {
    success: true,
    vehicle,
    validation,
    photoQuality: photoQualityResult,
    enhancements,
    errors,
  };
}

export function quickValidate(vehicleData: Partial<Vehicle>): ValidationResult {
  return validateVehicleListing(vehicleData);
}

export function calculateListingQualityScore(vehicle: Partial<Vehicle>): number {
  let score = 0;
  const maxScore = 100;

  const imageCount = vehicle.images?.length || 0;
  if (imageCount >= 10) score += 30;
  else if (imageCount >= 6) score += 25;
  else if (imageCount >= 4) score += 20;
  else if (imageCount >= 1) score += 10;

  const descLength = vehicle.description?.length || 0;
  if (descLength >= 500) score += 20;
  else if (descLength >= 200) score += 15;
  else if (descLength >= 100) score += 10;
  else if (descLength >= 50) score += 5;

  if (vehicle.make && vehicle.model) score += 5;
  if (vehicle.year) score += 3;
  if (vehicle.price) score += 3;
  if (vehicle.mileage !== undefined) score += 3;
  if (vehicle.fuelType) score += 2;
  if (vehicle.transmission) score += 2;
  if (vehicle.color) score += 2;

  const featureCount = vehicle.features?.length || 0;
  if (featureCount >= 5) score += 10;
  else if (featureCount >= 3) score += 7;
  else if (featureCount >= 1) score += 4;

  if (vehicle.city) score += 4;
  if (vehicle.state) score += 3;
  if (vehicle.rto) score += 3;

  if (vehicle.registrationNumber) score += 3;
  if (vehicle.vahanVerifiedAt) score += 4;
  if (vehicle.documents && vehicle.documents.length > 0) score += 3;

  return Math.min(maxScore, score);
}

export function getListingImprovementSuggestions(
  vehicle: Partial<Vehicle>,
  validation: ValidationResult
): string[] {
  const suggestions: string[] = [];

  const imageCount = vehicle.images?.length || 0;
  if (imageCount < 6) {
    suggestions.push(`Add ${6 - imageCount} more photos - listings with 6+ photos get 3x more views`);
  }
  if (imageCount > 0 && imageCount < 10) {
    suggestions.push('Consider adding interior, engine, and tyre close-up shots');
  }

  const descLength = vehicle.description?.length || 0;
  if (descLength < 100) {
    suggestions.push('Add a detailed description - mention service history, condition, and why you\'re selling');
  }

  if (!vehicle.features || vehicle.features.length < 3) {
    suggestions.push('Add key features like AC, Power Steering, Airbags to attract more buyers');
  }

  if (!vehicle.documents || vehicle.documents.length === 0) {
    suggestions.push('Upload RC and Insurance documents to build buyer trust');
  }

  if (!vehicle.vahanVerifiedAt && vehicle.registrationNumber) {
    suggestions.push('Verify your registration number with VAHAN for instant trust');
  }

  validation.warnings.forEach(w => {
    if (w.suggestion) {
      suggestions.push(w.suggestion);
    }
  });

  return suggestions;
}

export function isListingReadyToPublish(vehicle: Partial<Vehicle>): {
  ready: boolean;
  missingFields: string[];
  qualityScore: number;
} {
  const missingFields: string[] = [];

  if (!vehicle.make) missingFields.push('Make');
  if (!vehicle.model) missingFields.push('Model');
  if (!vehicle.year) missingFields.push('Year');
  if (!vehicle.price) missingFields.push('Price');
  if (!vehicle.images || vehicle.images.length === 0) missingFields.push('At least 1 photo');
  if (!vehicle.sellerEmail) missingFields.push('Seller email');

  const qualityScore = calculateListingQualityScore(vehicle);

  return {
    ready: missingFields.length === 0,
    missingFields,
    qualityScore,
  };
}

export function prepareVehicleForSubmission(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    status: vehicle.status || 'published',
    views: vehicle.views || 0,
    inquiriesCount: vehicle.inquiriesCount || 0,
    isFeatured: vehicle.isFeatured || false,
    make: vehicle.make?.trim(),
    model: vehicle.model?.trim(),
    description: vehicle.description?.trim(),
    city: vehicle.city?.trim(),
    state: vehicle.state?.trim()?.toUpperCase(),
    features: vehicle.features || [],
    images: vehicle.images || [],
    documents: vehicle.documents || [],
  };
}

/**
 * Listing Enhancement Service
 * Integrates validation, AI inspection, and quality scoring into the vehicle listing flow
 * This service wraps vehicle creation/updates to automatically apply all production features
 */

import type { Vehicle, AIInspectionReport } from '../types.js';
import { validateVehicleListing, type ValidationResult } from '../utils/validation.js';
import { generateAIInspection, checkPhotoQuality } from './aiInspectionService.js';

// Enhancement result type
export interface ListingEnhancementResult {
  success: boolean;
  vehicle: Vehicle;
  validation: ValidationResult;
  aiInspection?: AIInspectionReport;
  photoQuality?: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  enhancements: string[];
  errors: string[];
}

// Options for enhancement
export interface EnhancementOptions {
  runValidation?: boolean;
  runAIInspection?: boolean;
  checkPhotoQuality?: boolean;
  autoEnhanceDescription?: boolean;
  calculateListingScore?: boolean;
}

const DEFAULT_OPTIONS: EnhancementOptions = {
  runValidation: true,
  runAIInspection: false,
  checkPhotoQuality: true,
  autoEnhanceDescription: false,
  calculateListingScore: true,
};

/**
 * Enhance a vehicle listing with all production features
 * Call this before saving a new or updated vehicle
 */
export async function enhanceVehicleListing(
  vehicleData: Partial<Vehicle>,
  options: EnhancementOptions = DEFAULT_OPTIONS
): Promise<ListingEnhancementResult> {
  const enhancements: string[] = [];
  const errors: string[] = [];
  let vehicle = { ...vehicleData } as Vehicle;

  // 1. Run validation
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

  // Add validation warnings to enhancements
  validation.warnings.forEach(w => {
    enhancements.push(`Warning: ${w.field} - ${w.message}`);
  });

  // 2. Check photo quality if images provided
  let photoQualityResult: ListingEnhancementResult['photoQuality'];
  if (options.checkPhotoQuality && vehicle.images && vehicle.images.length > 0) {
    try {
      const quality = await checkPhotoQuality(vehicle.images);
      photoQualityResult = {
        score: quality.overallScore,
        issues: quality.issues,
        recommendations: quality.recommendations,
      };

      // Update vehicle with photo quality score
      vehicle.photoQuality = quality.overallScore >= 70 ? 'high' : quality.overallScore >= 40 ? 'medium' : 'low';
      vehicle.hasMinimumPhotos = vehicle.images.length >= 6;
      
      enhancements.push(`Photo quality assessed: ${quality.overallScore}/100`);
      
      if (quality.missingViews.length > 0) {
        enhancements.push(`Missing photo views: ${quality.missingViews.join(', ')}`);
      }
    } catch (error) {
      errors.push(`Photo quality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 3. Run AI inspection if enough images
  let aiInspection: AIInspectionReport | undefined;
  if (options.runAIInspection && vehicle.images && vehicle.images.length >= 4) {
    try {
      aiInspection = await generateAIInspection({
        vehicleId: vehicle.id,
        imageUrls: vehicle.images,
        vehicleDetails: {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          mileage: vehicle.mileage,
          fuelType: vehicle.fuelType,
          color: vehicle.color,
        },
      });

      vehicle = {
        ...vehicle,
        aiInspectionReport: aiInspection,
        description: vehicle.description || generateDescriptionFromInspection(vehicle, aiInspection),
      };

      enhancements.push(`AI Inspection completed: Grade ${aiInspection.overallGrade} (${aiInspection.overallScore}/100)`);
      
      if (aiInspection.conditionImpact.majorIssuesCount > 0) {
        enhancements.push(`Found ${aiInspection.conditionImpact.majorIssuesCount} major issue(s) requiring attention`);
      }
    } catch (error) {
      errors.push(`AI inspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else if (options.runAIInspection) {
    enhancements.push('AI inspection skipped: minimum 4 photos required');
  }

  // 4. Calculate listing quality score
  if (options.calculateListingScore) {
    const qualityScore = calculateListingQualityScore(vehicle, aiInspection);
    vehicle.descriptionQuality = qualityScore;
    enhancements.push(`Listing quality score: ${qualityScore}/100`);
  }

  // 5. Set timestamps
  const now = new Date().toISOString();
  if (!vehicle.createdAt) {
    vehicle.createdAt = now;
  }
  vehicle.updatedAt = now;

  // 6. Set default listing status
  if (!vehicle.listingStatus) {
    vehicle.listingStatus = 'active';
  }

  // 7. Calculate listing expiry (30 days from now)
  if (!vehicle.listingExpiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    vehicle.listingExpiresAt = expiryDate.toISOString();
  }

  return {
    success: true,
    vehicle,
    validation,
    aiInspection,
    photoQuality: photoQualityResult,
    enhancements,
    errors,
  };
}

/**
 * Quick validation without AI features
 * Use this for real-time form validation
 */
export function quickValidate(vehicleData: Partial<Vehicle>): ValidationResult {
  return validateVehicleListing(vehicleData);
}

/**
 * Calculate listing quality score based on completeness and content
 */
export function calculateListingQualityScore(
  vehicle: Partial<Vehicle>,
  aiInspection?: AIInspectionReport
): number {
  let score = 0;
  const maxScore = 100;

  // Photos (30 points max)
  const imageCount = vehicle.images?.length || 0;
  if (imageCount >= 10) score += 30;
  else if (imageCount >= 6) score += 25;
  else if (imageCount >= 4) score += 20;
  else if (imageCount >= 1) score += 10;

  // Description (20 points max)
  const descLength = vehicle.description?.length || 0;
  if (descLength >= 500) score += 20;
  else if (descLength >= 200) score += 15;
  else if (descLength >= 100) score += 10;
  else if (descLength >= 50) score += 5;

  // Essential details (20 points max)
  if (vehicle.make && vehicle.model) score += 5;
  if (vehicle.year) score += 3;
  if (vehicle.price) score += 3;
  if (vehicle.mileage !== undefined) score += 3;
  if (vehicle.fuelType) score += 2;
  if (vehicle.transmission) score += 2;
  if (vehicle.color) score += 2;

  // Features (10 points max)
  const featureCount = vehicle.features?.length || 0;
  if (featureCount >= 5) score += 10;
  else if (featureCount >= 3) score += 7;
  else if (featureCount >= 1) score += 4;

  // Location details (10 points max)
  if (vehicle.city) score += 4;
  if (vehicle.state) score += 3;
  if (vehicle.rto) score += 3;

  // Trust indicators (10 points max)
  if (vehicle.registrationNumber) score += 3;
  if (vehicle.vahanVerifiedAt) score += 4;
  if (vehicle.documents && vehicle.documents.length > 0) score += 3;

  // AI Inspection bonus
  if (aiInspection) {
    // Add up to 10 bonus points based on inspection score
    const inspectionBonus = Math.round((aiInspection.overallScore / 100) * 10);
    score = Math.min(maxScore, score + inspectionBonus);
  }

  return Math.min(maxScore, score);
}

/**
 * Generate a description from AI inspection results
 */
function generateDescriptionFromInspection(
  vehicle: Partial<Vehicle>,
  inspection: AIInspectionReport
): string {
  const lines: string[] = [];

  lines.push(`${vehicle.year} ${vehicle.make} ${vehicle.model} available for sale.`);
  
  if (vehicle.mileage) {
    lines.push(`Driven ${vehicle.mileage.toLocaleString('en-IN')} km.`);
  }

  // Add condition summary
  lines.push(`\nCondition: ${getGradeDescription(inspection.overallGrade)}`);
  
  // Add highlights
  if (inspection.highlights.length > 0) {
    lines.push('\nHighlights:');
    inspection.highlights.slice(0, 3).forEach(h => lines.push(`• ${h}`));
  }

  // Add any concerns
  if (inspection.concerns.length > 0) {
    lines.push('\nNote:');
    inspection.concerns.slice(0, 2).forEach(c => lines.push(`• ${c}`));
  }

  if (vehicle.features && vehicle.features.length > 0) {
    lines.push(`\nFeatures: ${vehicle.features.slice(0, 5).join(', ')}`);
  }

  lines.push('\nSerious buyers please contact for test drive.');

  return lines.join('\n');
}

/**
 * Get grade description text
 */
function getGradeDescription(grade: string): string {
  switch (grade) {
    case 'A': return 'Excellent - Like new condition';
    case 'B': return 'Good - Well maintained with minor wear';
    case 'C': return 'Fair - Normal wear for age';
    case 'D': return 'Below Average - Some issues present';
    case 'F': return 'Poor - Requires attention';
    default: return 'Not assessed';
  }
}

/**
 * Get suggestions to improve listing quality
 */
export function getListingImprovementSuggestions(
  vehicle: Partial<Vehicle>,
  validation: ValidationResult
): string[] {
  const suggestions: string[] = [];

  // Photo suggestions
  const imageCount = vehicle.images?.length || 0;
  if (imageCount < 6) {
    suggestions.push(`Add ${6 - imageCount} more photos - listings with 6+ photos get 3x more views`);
  }
  if (imageCount > 0 && imageCount < 10) {
    suggestions.push('Consider adding interior, engine, and tyre close-up shots');
  }

  // Description suggestions
  const descLength = vehicle.description?.length || 0;
  if (descLength < 100) {
    suggestions.push('Add a detailed description - mention service history, condition, and why you\'re selling');
  }

  // Feature suggestions
  if (!vehicle.features || vehicle.features.length < 3) {
    suggestions.push('Add key features like AC, Power Steering, Airbags to attract more buyers');
  }

  // Document suggestions
  if (!vehicle.documents || vehicle.documents.length === 0) {
    suggestions.push('Upload RC and Insurance documents to build buyer trust');
  }

  // Verification suggestion
  if (!vehicle.vahanVerifiedAt && vehicle.registrationNumber) {
    suggestions.push('Verify your registration number with VAHAN for instant trust');
  }

  // Add validation warnings as suggestions
  validation.warnings.forEach(w => {
    if (w.suggestion) {
      suggestions.push(w.suggestion);
    }
  });

  return suggestions;
}

/**
 * Check if listing is ready to publish
 */
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

/**
 * Prepare vehicle data for API submission
 * Cleans and normalizes data before sending to backend
 */
export function prepareVehicleForSubmission(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    // Ensure required fields have defaults
    status: vehicle.status || 'published',
    views: vehicle.views || 0,
    inquiriesCount: vehicle.inquiriesCount || 0,
    isFeatured: vehicle.isFeatured || false,
    // Normalize string fields
    make: vehicle.make?.trim(),
    model: vehicle.model?.trim(),
    description: vehicle.description?.trim(),
    city: vehicle.city?.trim(),
    state: vehicle.state?.trim()?.toUpperCase(),
    // Ensure arrays are not undefined
    features: vehicle.features || [],
    images: vehicle.images || [],
    // Set timestamps
    updatedAt: new Date().toISOString(),
    createdAt: vehicle.createdAt || new Date().toISOString(),
  };
}

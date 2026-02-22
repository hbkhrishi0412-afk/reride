import type { Vehicle, User, VehicleData } from '../types.js';

// Comprehensive validation and error handling system
export class ValidationError extends Error {
  constructor(message: string, public field?: string, public code?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DataServiceError extends Error {
  constructor(message: string, public operation: string, public originalError?: Error) {
    super(message);
    this.name = 'DataServiceError';
  }
}

// Vehicle validation
export const validateVehicle = (vehicle: Partial<Vehicle>): void => {
  const errors: string[] = [];

  // Required fields
  if (!vehicle.make || typeof vehicle.make !== 'string' || vehicle.make.trim() === '') {
    errors.push('Make is required and must be a non-empty string');
  }

  if (!vehicle.model || typeof vehicle.model !== 'string' || vehicle.model.trim() === '') {
    errors.push('Model is required and must be a non-empty string');
  }

  if (!vehicle.year || typeof vehicle.year !== 'number' || vehicle.year < 1900 || vehicle.year > new Date().getFullYear() + 1) {
    errors.push('Year is required and must be a valid year');
  }

  if (!vehicle.price || typeof vehicle.price !== 'number' || vehicle.price <= 0) {
    errors.push('Price is required and must be a positive number');
  }

  if (typeof vehicle.mileage !== 'number' || vehicle.mileage < 0) {
    errors.push('Mileage must be a non-negative number');
  }

  if (!vehicle.sellerEmail || typeof vehicle.sellerEmail !== 'string' || !isValidEmail(vehicle.sellerEmail)) {
    errors.push('Valid seller email is required');
  }

  if (!vehicle.category || !['FOUR_WHEELER', 'TWO_WHEELER', 'THREE_WHEELER', 'COMMERCIAL'].includes(vehicle.category)) {
    errors.push('Valid category is required');
  }

  if (vehicle.city && (typeof vehicle.city !== 'string' || vehicle.city.trim() === '')) {
    errors.push('City must be a non-empty string if provided');
  }

  if (vehicle.state && (typeof vehicle.state !== 'string' || vehicle.state.length !== 2)) {
    errors.push('State must be a 2-letter code if provided');
  }

  if (vehicle.noOfOwners && (typeof vehicle.noOfOwners !== 'number' || vehicle.noOfOwners < 0)) {
    errors.push('Number of owners must be a non-negative number if provided');
  }

  if (vehicle.registrationYear && (typeof vehicle.registrationYear !== 'number' || vehicle.registrationYear < 1900)) {
    errors.push('Registration year must be a valid year if provided');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Vehicle validation failed: ${errors.join(', ')}`);
  }
};

// User validation
export const validateUser = (user: Partial<User>): void => {
  const errors: string[] = [];

  if (!user.name || typeof user.name !== 'string' || user.name.trim() === '') {
    errors.push('Name is required and must be a non-empty string');
  }

  if (!user.email || typeof user.email !== 'string' || !isValidEmail(user.email)) {
    errors.push('Valid email is required');
  }

  if (!user.role || !['customer', 'seller', 'admin'].includes(user.role)) {
    errors.push('Valid role is required');
  }

  if (!user.status || !['active', 'inactive'].includes(user.status)) {
    errors.push('Valid status is required');
  }

  if (user.mobile && (typeof user.mobile !== 'string' || !isValidPhone(user.mobile))) {
    errors.push('Mobile must be a valid phone number if provided');
  }

  if (user.password && (typeof user.password !== 'string' || user.password.length < 6)) {
    errors.push('Password must be at least 6 characters if provided');
  }

  if (user.subscriptionPlan && !['free', 'pro', 'premium'].includes(user.subscriptionPlan)) {
    errors.push('Valid subscription plan is required if provided');
  }

  if (user.featuredCredits && (typeof user.featuredCredits !== 'number' || user.featuredCredits < 0)) {
    errors.push('Featured credits must be a non-negative number if provided');
  }

  if (user.usedCertifications && (typeof user.usedCertifications !== 'number' || user.usedCertifications < 0)) {
    errors.push('Used certifications must be a non-negative number if provided');
  }

  if (errors.length > 0) {
    throw new ValidationError(`User validation failed: ${errors.join(', ')}`);
  }
};

// Vehicle data validation
export const validateVehicleData = (data: Partial<VehicleData>): void => {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Vehicle data must be an object');
  }

  const validCategories = ['FOUR_WHEELER', 'TWO_WHEELER', 'THREE_WHEELER'];
  
  for (const [category, vehicles] of Object.entries(data)) {
    if (!validCategories.includes(category)) {
      throw new ValidationError(`Invalid category: ${category}`);
    }

    if (!Array.isArray(vehicles)) {
      throw new ValidationError(`Vehicles for ${category} must be an array`);
    }

    vehicles.forEach((vehicleMake, index) => {
      try {
        // Validate VehicleMake structure instead of Vehicle
        if (!vehicleMake || typeof vehicleMake !== 'object') {
          throw new ValidationError('Vehicle make must be an object');
        }
        if (!vehicleMake.name || typeof vehicleMake.name !== 'string') {
          throw new ValidationError('Vehicle make must have a valid name');
        }
        if (!Array.isArray(vehicleMake.models)) {
          throw new ValidationError('Vehicle make must have models array');
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(`Vehicle make at index ${index} in ${category}: ${error.message}`);
        }
        throw error;
      }
    });
  }
};

// Utility validation functions
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidImageUrl = (url: string): boolean => {
  if (!isValidUrl(url)) return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const urlLower = url.toLowerCase();
  
  return imageExtensions.some(ext => urlLower.includes(ext)) || 
         url.includes('placeholder') || 
         url.includes('picsum') ||
         url.includes('pravatar');
};

// Data sanitization
export const sanitizeVehicle = (vehicle: Partial<Vehicle>): Partial<Vehicle> => {
  const sanitized = { ...vehicle };

  // Sanitize strings
  if (sanitized.make) sanitized.make = sanitized.make.trim();
  if (sanitized.model) sanitized.model = sanitized.model.trim();
  if (sanitized.variant) sanitized.variant = sanitized.variant.trim();
  if (sanitized.description) sanitized.description = sanitized.description.trim();
  if (sanitized.engine) sanitized.engine = sanitized.engine.trim();
  if (sanitized.transmission) sanitized.transmission = sanitized.transmission.trim();
  if (sanitized.fuelType) sanitized.fuelType = sanitized.fuelType.trim();
  if (sanitized.fuelEfficiency) sanitized.fuelEfficiency = sanitized.fuelEfficiency.trim();
  if (sanitized.color) sanitized.color = sanitized.color.trim();
  if (sanitized.city) sanitized.city = sanitized.city.trim();
  if (sanitized.state) sanitized.state = sanitized.state.trim().toUpperCase();
  if (sanitized.rto) sanitized.rto = sanitized.rto.trim().toUpperCase();
  if (sanitized.insuranceValidity) sanitized.insuranceValidity = sanitized.insuranceValidity.trim();
  if (sanitized.insuranceType) sanitized.insuranceType = sanitized.insuranceType.trim();
  if (sanitized.displacement) sanitized.displacement = sanitized.displacement.trim();
  if (sanitized.groundClearance) sanitized.groundClearance = sanitized.groundClearance.trim();
  if (sanitized.bootSpace) sanitized.bootSpace = sanitized.bootSpace.trim();

  // Sanitize seller email
  if (sanitized.sellerEmail) {
    sanitized.sellerEmail = sanitized.sellerEmail.trim().toLowerCase();
  }

  // Ensure arrays are arrays
  if (sanitized.images && !Array.isArray(sanitized.images)) {
    sanitized.images = [];
  }
  if (sanitized.features && !Array.isArray(sanitized.features)) {
    sanitized.features = [];
  }

  // Ensure numeric fields are numbers
  if (sanitized.year && typeof sanitized.year === 'string') {
    sanitized.year = parseInt(sanitized.year, 10);
  }
  if (sanitized.price && typeof sanitized.price === 'string') {
    sanitized.price = parseFloat(sanitized.price);
  }
  if (sanitized.mileage && typeof sanitized.mileage === 'string') {
    sanitized.mileage = parseInt(sanitized.mileage, 10);
  }
  if (sanitized.registrationYear && typeof sanitized.registrationYear === 'string') {
    sanitized.registrationYear = parseInt(sanitized.registrationYear, 10);
  }
  if (sanitized.noOfOwners && typeof sanitized.noOfOwners === 'string') {
    sanitized.noOfOwners = parseInt(sanitized.noOfOwners, 10);
  }

  return sanitized;
};

export const sanitizeUser = (user: Partial<User>): Partial<User> => {
  const sanitized = { ...user };

  // Sanitize strings
  if (sanitized.name) sanitized.name = sanitized.name.trim();
  if (sanitized.email) sanitized.email = sanitized.email.trim().toLowerCase();
  if (sanitized.mobile) sanitized.mobile = sanitized.mobile.trim();
  if (sanitized.dealershipName) sanitized.dealershipName = sanitized.dealershipName.trim();
  if (sanitized.bio) sanitized.bio = sanitized.bio.trim();
  if (sanitized.alternatePhone) sanitized.alternatePhone = sanitized.alternatePhone.trim();
  if (sanitized.preferredContactHours) sanitized.preferredContactHours = sanitized.preferredContactHours.trim();

  // Ensure numeric fields are numbers
  if (sanitized.featuredCredits && typeof sanitized.featuredCredits === 'string') {
    sanitized.featuredCredits = parseInt(sanitized.featuredCredits, 10);
  }
  if (sanitized.usedCertifications && typeof sanitized.usedCertifications === 'string') {
    sanitized.usedCertifications = parseInt(sanitized.usedCertifications, 10);
  }
  if (sanitized.responseTime && typeof sanitized.responseTime === 'string') {
    sanitized.responseTime = parseInt(sanitized.responseTime, 10);
  }
  if (sanitized.responseRate && typeof sanitized.responseRate === 'string') {
    sanitized.responseRate = parseInt(sanitized.responseRate, 10);
  }

  return sanitized;
};

// Error handling utilities
export const handleApiError = (error: unknown, operation: string): DataServiceError => {
  let message = `Failed to ${operation}`;
  
  if (error instanceof ValidationError) {
    message = `Validation error during ${operation}: ${error.message}`;
  } else if (error instanceof DataServiceError) {
    message = error.message;
  } else if (error instanceof Error) {
    message = `${operation} failed: ${error.message}`;
  } else if (typeof error === 'string') {
    message = `${operation} failed: ${error}`;
  }

  return new DataServiceError(message, operation, error instanceof Error ? error : undefined);
};

export const logError = (error: Error, context: string): void => {
  console.error(`[${context}]`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
};

// Retry mechanism for failed operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }

      console.warn(`Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  throw lastError!;
};

// Data consistency checks
export const checkDataConsistency = (vehicles: Vehicle[], users: User[]): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];

  // Check for vehicles with invalid seller emails
  const userEmails = new Set(users.map(u => u.email));
  const invalidSellerEmails = vehicles.filter(v => !userEmails.has(v.sellerEmail));
  
  if (invalidSellerEmails.length > 0) {
    issues.push(`${invalidSellerEmails.length} vehicles have invalid seller emails`);
  }

  // Check for duplicate vehicle IDs
  const vehicleIds = vehicles.map(v => v.id);
  const duplicateIds = vehicleIds.filter((id, index) => vehicleIds.indexOf(id) !== index);
  
  if (duplicateIds.length > 0) {
    issues.push(`Found ${duplicateIds.length} duplicate vehicle IDs`);
  }

  // Check for vehicles with missing required fields
  const incompleteVehicles = vehicles.filter(v => !v.make || !v.model || !v.year || !v.price);
  
  if (incompleteVehicles.length > 0) {
    issues.push(`${incompleteVehicles.length} vehicles are missing required fields`);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
};
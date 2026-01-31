/**
 * Environment Variable Validation Utility
 * Validates required environment variables at application startup
 * 
 * @module envValidation
 * @example
 * ```typescript
 * // At application startup
 * validateEnvironmentVariables();
 * 
 * // Or safely without throwing
 * const result = validateEnvironmentVariablesSafe();
 * if (!result.isValid) {
 *   console.error(result.errors);
 * }
 * ```
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates required Supabase environment variables
 * @returns ValidationResult with validation status and error messages
 */
export function validateSupabaseEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Client-side variables (required for React app)
  const clientVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  // Server-side variables (required for API routes)
  // Note: These are checked at runtime in API routes, but we validate format here
  const serverVars = {
    SUPABASE_URL: import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // Validate client-side variables
  if (!clientVars.VITE_SUPABASE_URL) {
    errors.push('VITE_SUPABASE_URL is required for client-side Supabase connection');
  } else if (!clientVars.VITE_SUPABASE_URL.startsWith('https://') || !clientVars.VITE_SUPABASE_URL.includes('.supabase.co')) {
    errors.push('VITE_SUPABASE_URL must be a valid Supabase URL (https://xxxxx.supabase.co)');
  }

  if (!clientVars.VITE_SUPABASE_ANON_KEY) {
    errors.push('VITE_SUPABASE_ANON_KEY is required for client-side Supabase connection');
  } else if (clientVars.VITE_SUPABASE_ANON_KEY.length < 100) {
    warnings.push('VITE_SUPABASE_ANON_KEY appears to be invalid (too short)');
  }

  // Validate server-side variables (warn if missing, but don't error in client-side code)
  if (typeof window === 'undefined') {
    // Server-side validation
    if (!serverVars.SUPABASE_URL) {
      errors.push('SUPABASE_URL is required for server-side operations');
    } else if (!serverVars.SUPABASE_URL.startsWith('https://') || !serverVars.SUPABASE_URL.includes('.supabase.co')) {
      errors.push('SUPABASE_URL must be a valid Supabase URL (https://xxxxx.supabase.co)');
    }

    if (!serverVars.SUPABASE_ANON_KEY) {
      errors.push('SUPABASE_ANON_KEY is required for server-side operations');
    }

    if (!serverVars.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
    } else if (serverVars.SUPABASE_SERVICE_ROLE_KEY.length < 100) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)');
    }
  } else {
    // Client-side: warn if server vars are missing (they should be set in production)
    if (!serverVars.SUPABASE_URL || !serverVars.SUPABASE_ANON_KEY || !serverVars.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push('Server-side Supabase variables may be missing (check API routes)');
    }
  }

  // Check for placeholder values
  const allVars = { ...clientVars, ...serverVars };
  Object.entries(allVars).forEach(([key, value]) => {
    if (value && (
      value.includes('your-') ||
      value.includes('YOUR_') ||
      value.includes('your-project-ref') ||
      value.includes('your_supabase') ||
      value === 'your_supabase_anon_key_here' ||
      value === 'your_supabase_service_role_key_here'
    )) {
      errors.push(`${key} contains placeholder value - please set actual credentials`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates all required environment variables and throws if critical ones are missing
 * @throws Error if critical environment variables are missing
 */
export function validateEnvironmentVariables(): void {
  const result = validateSupabaseEnv();

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment variable warnings:');
    result.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  // Throw error if validation failed
  if (!result.isValid) {
    const errorMessage = [
      '❌ Critical environment variables are missing or invalid:',
      ...result.errors.map(error => `   - ${error}`),
      '',
      'Please check your environment configuration:',
      '  • For local development: Check .env.local file',
      '  • For production (Vercel): Check Environment Variables in Vercel dashboard',
      '  • For production (other): Ensure all VITE_SUPABASE_* and SUPABASE_* variables are set',
      '',
      'See env.example for reference on required variables.',
      '',
      'Required variables:',
      '  • VITE_SUPABASE_URL (client-side)',
      '  • VITE_SUPABASE_ANON_KEY (client-side)',
      '  • SUPABASE_URL (server-side)',
      '  • SUPABASE_ANON_KEY (server-side)',
      '  • SUPABASE_SERVICE_ROLE_KEY (server-side, for admin operations)',
    ].join('\n');

    throw new Error(errorMessage);
  }
}

/**
 * Validates environment variables without throwing (for non-critical checks)
 * @returns ValidationResult
 */
export function validateEnvironmentVariablesSafe(): ValidationResult {
  return validateSupabaseEnv();
}


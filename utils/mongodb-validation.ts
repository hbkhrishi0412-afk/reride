/**
 * MongoDB Configuration Validation
 * Validates MongoDB environment variables on startup
 */

export interface MongoConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  uri?: string;
}

/**
 * Validates MongoDB configuration from environment variables
 */
export function validateMongoConfig(): MongoConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for environment variables
  const mongoUrl = process.env.MONGODB_URL;
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUrl && !mongoUri) {
    errors.push('MONGODB_URL or MONGODB_URI environment variable is not set');
    return {
      isValid: false,
      errors,
      warnings
    };
  }
  
  // Prefer MONGODB_URL over MONGODB_URI
  const uri = mongoUrl || mongoUri!;
  
  // Warn if both are set
  if (mongoUrl && mongoUri) {
    warnings.push('Both MONGODB_URL and MONGODB_URI are set. Using MONGODB_URL.');
  }
  
  // Validate URI format
  if (!uri.match(/^mongodb(\+srv)?:\/\//i)) {
    errors.push('MongoDB URI must start with mongodb:// or mongodb+srv://');
  }
  
  // Check for database name in URI
  if (!uri.match(/\/[^\/\?]+(\?|$)/)) {
    warnings.push('Database name not found in URI. Will use default "reride" database.');
  }
  
  // Check for required connection parameters
  if (!uri.includes('retryWrites')) {
    warnings.push('retryWrites parameter not found in URI. Recommended for serverless environments.');
  }
  
  // Check for credentials (basic validation)
  if (uri.includes('@') && !uri.match(/\/\/[^:]+:[^@]+@/)) {
    warnings.push('URI contains @ but credentials format may be invalid.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') // Mask credentials in output
  };
}

/**
 * Logs validation results
 */
export function logMongoConfigValidation(): void {
  const validation = validateMongoConfig();
  
  if (!validation.isValid) {
    console.error('❌ MongoDB Configuration Validation Failed:');
    validation.errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    console.error('\n💡 To fix:');
    console.error('   1. Set MONGODB_URL or MONGODB_URI in your environment');
    console.error('   2. Format: mongodb://localhost:27017/reride?retryWrites=true&w=majority');
    console.error('   3. For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/reride?retryWrites=true&w=majority');
    process.exit(1);
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️  MongoDB Configuration Warnings:');
    validation.warnings.forEach(warning => {
      console.warn(`   - ${warning}`);
    });
  }
  
  if (validation.isValid) {
    console.log('✅ MongoDB configuration validated');
    if (validation.uri) {
      console.log(`   URI: ${validation.uri}`);
    }
  }
}


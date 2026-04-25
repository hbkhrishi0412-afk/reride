// Script to validate FIREBASE_SERVICE_ACCOUNT_KEY environment variable
// Run this locally or in Vercel to check if the JSON is valid
// Usage: node scripts/validate-firebase-service-account.js
//
// Does not print secret material (CodeQL: clear-text logging of sensitive information).

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountJson) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
  console.log('\n💡 To set it locally, create a .env.local file with:');
  console.log('   FIREBASE_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\'');
  process.exit(1);
}

console.log('📋 Variable length:', serviceAccountJson.length, 'characters');

// Check for common issues
console.log('\n🔍 Checking for common issues...\n');

if (serviceAccountJson.trim().startsWith('"') && serviceAccountJson.trim().endsWith('"')) {
  console.error('❌ ISSUE: JSON appears to be wrapped in double quotes');
  console.error('   Fix: Remove the outer quotes in Vercel environment variable');
  console.error('   Wrong: "{"type":"service_account",...}"');
  console.error('   Right: {"type":"service_account",...}');
}

if (serviceAccountJson.includes('\\n') && serviceAccountJson.includes('\n')) {
  console.warn('⚠️  WARNING: Mix of literal \\n and actual newlines detected');
  console.warn('   Fix: Use only \\n (backslash-n), not actual newlines');
}

if (!serviceAccountJson.trim().startsWith('{')) {
  console.error('❌ ISSUE: JSON should start with { character');
  console.error('   First character:', JSON.stringify(serviceAccountJson.trim()[0]));
}

if (!serviceAccountJson.trim().endsWith('}')) {
  console.error('❌ ISSUE: JSON should end with } character');
  console.error('   Last character:', JSON.stringify(serviceAccountJson.trim()[serviceAccountJson.trim().length - 1]));
}

// Try to parse
console.log('\n🔍 Attempting to parse JSON...\n');

try {
  const parsed = JSON.parse(serviceAccountJson);

  console.log('✅ JSON parsing successful!');
  console.log('\n📋 Parsed object keys:', Object.keys(parsed).join(', '));

  // Check required fields
  const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
  const missingFields = requiredFields.filter((field) => !parsed[field]);

  if (missingFields.length > 0) {
    console.error('\n❌ Missing required fields:', missingFields.join(', '));
  } else {
    console.log('\n✅ All required fields present');
    console.log('   type:', parsed.type);
    console.log('   project_id:', parsed.project_id);
    console.log('   client_email:', parsed.client_email);
    console.log('   private_key:', parsed.private_key ? '(present, not logged)' : 'MISSING');
  }

  console.log('\n✅ FIREBASE_SERVICE_ACCOUNT_KEY is valid and ready to use!');
} catch (error) {
  console.error('❌ JSON parsing failed:', error.message);
  console.error('\n📋 Error details:');
  console.error('   Error type:', error.name);
  console.error('   Position:', error.message.match(/position (\d+)/)?.[1] || 'unknown');
  console.error('   (Secret JSON body is not printed for security.)');

  process.exit(1);
}

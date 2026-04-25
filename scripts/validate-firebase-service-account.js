// Script to validate FIREBASE_SERVICE_ACCOUNT_KEY environment variable
// Run this locally or in Vercel to check if the JSON is valid
// Usage: node scripts/validate-firebase-service-account.js
//
// Does not print secret material, lengths, or parsed credential fields (CodeQL).

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountJson) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
  console.log('Set it in .env.local or your host environment (value is not echoed).');
  process.exit(1);
}

console.log('Checking service account JSON (value is not logged)...\n');

if (serviceAccountJson.trim().startsWith('"') && serviceAccountJson.trim().endsWith('"')) {
  console.error('ISSUE: JSON appears to be wrapped in double quotes');
  console.error('Fix: remove the outer quotes in the environment variable value');
}

if (serviceAccountJson.includes('\\n') && serviceAccountJson.includes('\n')) {
  console.warn('WARNING: mix of literal backslash-n and actual newlines — prefer escaped newlines only');
}

if (!serviceAccountJson.trim().startsWith('{')) {
  console.error('ISSUE: JSON should start with {');
}

if (!serviceAccountJson.trim().endsWith('}')) {
  console.error('ISSUE: JSON should end with }');
}

try {
  const parsed = JSON.parse(serviceAccountJson);
  const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
  const missing = requiredFields.filter((field) => !parsed[field]);

  if (missing.length > 0) {
    console.error('Parsed JSON is missing required fields (field names only):', missing.join(', '));
    process.exit(1);
  }

  console.log('OK: service account JSON parsed and required fields are present.');
} catch {
  console.error('JSON parsing failed. Fix the value; the secret body is not printed.');
  process.exit(1);
}

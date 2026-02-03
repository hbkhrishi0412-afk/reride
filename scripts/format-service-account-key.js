/**
 * Helper script to format Firebase Service Account Key for .env.local
 * 
 * Usage:
 *   1. Copy your service account JSON from Firebase Console
 *   2. Save it to a file (e.g., service-account.json)
 *   3. Run: node scripts/format-service-account-key.js service-account.json
 *   4. Copy the output to your .env.local file
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/format-service-account-key.js <path-to-json-file>');
  console.log('\nExample:');
  console.log('  node scripts/format-service-account-key.js service-account.json');
  process.exit(1);
}

const jsonFilePath = args[0];

try {
  // Read the JSON file
  const jsonContent = readFileSync(jsonFilePath, 'utf-8');
  
  // Parse to validate it's valid JSON
  const parsed = JSON.parse(jsonContent);
  
  // Validate required fields
  if (!parsed.private_key || !parsed.client_email) {
    console.error('❌ Error: JSON missing required fields (private_key, client_email)');
    process.exit(1);
  }
  
  // Convert to single-line JSON string
  const singleLineJson = JSON.stringify(parsed);
  
  // Format for .env.local (with single quotes)
  const envFormat = `FIREBASE_SERVICE_ACCOUNT_KEY='${singleLineJson}'`;
  
  console.log('\n✅ Valid JSON detected!');
  console.log('\n📋 Add this line to your .env.local file:\n');
  console.log('─'.repeat(80));
  console.log(envFormat);
  console.log('─'.repeat(80));
  console.log('\n💡 Tip: Make sure .env.local is in your .gitignore file!');
  
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`❌ Error: File not found: ${jsonFilePath}`);
  } else if (error instanceof SyntaxError) {
    console.error('❌ Error: Invalid JSON format');
    console.error('   Details:', error.message);
  } else {
    console.error('❌ Error:', error.message);
  }
  process.exit(1);
}













#!/usr/bin/env node
/**
 * Verification script to count Vercel serverless functions
 * Vercel counts EVERY file in the api/ directory (each .ts/.js = 1 function)
 */

import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiDir = join(__dirname, '..', 'api');

async function findServerlessFunctions(dir, basePath = '') {
  const functions = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = join(basePath, entry.name);

    if (entry.isDirectory()) {
      const subFunctions = await findServerlessFunctions(fullPath, relativePath);
      functions.push(...subFunctions);
    } else if (entry.isFile() && (extname(entry.name) === '.ts' || extname(entry.name) === '.js')) {
      functions.push({ path: `api/${relativePath}`, file: entry.name });
    }
  }

  return functions;
}

async function main() {
  console.log('🔍 Verifying Vercel Serverless Functions...\n');
  console.log('Vercel counts every .ts/.js file in api/ as one serverless function.\n');

  const serverlessFunctions = await findServerlessFunctions(apiDir);
  const currentCount = serverlessFunctions.length;
  const MAX_FUNCTIONS = 10;
  const statusIcon = currentCount <= MAX_FUNCTIONS ? '✅' : '❌';

  console.log('📊 Results:\n');
  console.log(`${statusIcon} Serverless Functions: ${currentCount}/${MAX_FUNCTIONS} (Maximum allowed: ${MAX_FUNCTIONS})\n`);

  if (serverlessFunctions.length > 0) {
    console.log('Files in api/ (each counted by Vercel):');
    serverlessFunctions.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.path}`);
    });
    console.log('');
  }

  // Check vercel.json rewrite rule
  try {
    const { readFile } = await import('fs/promises');
    const vercelConfig = await readFile(join(__dirname, '..', 'vercel.json'), 'utf-8');
    const config = JSON.parse(vercelConfig);
    if (config.rewrites && config.rewrites.some(r => r.source === '/api/(.*)' && r.destination === '/api/main.ts')) {
      console.log('✅ vercel.json rewrite rule configured correctly');
      console.log('   All /api/* routes are routed to api/main.ts\n');
    }
  } catch (error) {
    console.warn('⚠️  Could not read vercel.json');
  }

  console.log('📋 Summary:');
  if (currentCount <= MAX_FUNCTIONS) {
    console.log(`   ✅ You are within the limit (${currentCount}/${MAX_FUNCTIONS} functions)`);
    if (currentCount < MAX_FUNCTIONS) {
      console.log(`   💡 ${MAX_FUNCTIONS - currentCount} slot(s) remaining. Keep handler code in server/handlers/ to avoid adding to api/`);
    }
  } else {
    console.log(`   ❌ EXCEEDS LIMIT: ${currentCount} functions (maximum: ${MAX_FUNCTIONS})`);
    console.log('   💡 Move modules out of api/ into server/ or lib/ so only entry points remain in api/');
  }

  process.exit(currentCount <= MAX_FUNCTIONS ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


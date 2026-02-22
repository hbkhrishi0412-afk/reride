#!/usr/bin/env node
/**
 * Verification script to count Vercel serverless functions
 * Vercel counts any file in the api/ directory that exports a default function
 */

import { readdir, readFile } from 'fs/promises';
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
      // Recursively check subdirectories
      const subFunctions = await findServerlessFunctions(fullPath, relativePath);
      functions.push(...subFunctions);
    } else if (entry.isFile() && (extname(entry.name) === '.ts' || extname(entry.name) === '.js')) {
      // Check if file exports a default function
      try {
        const content = await readFile(fullPath, 'utf-8');
        // Check for default export patterns
        const hasDefaultExport = 
          /export\s+default\s+(async\s+)?function/.test(content) ||
          /export\s+default\s+\(/.test(content) ||
          /export\s+default\s+\w+/.test(content) ||
          /module\.exports\s*=/.test(content) ||
          /exports\.default\s*=/.test(content);

        if (hasDefaultExport) {
          functions.push({
            path: `api/${relativePath}`,
            file: entry.name,
            isServerlessFunction: true
          });
        } else {
          // Check if it's a module (has exports but no default)
          const hasExports = /export\s+(const|function|class|interface|type|async\s+function)/.test(content);
          if (hasExports) {
            functions.push({
              path: `api/${relativePath}`,
              file: entry.name,
              isServerlessFunction: false,
              note: 'Module (no default export)'
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not read ${relativePath}:`, error.message);
      }
    }
  }

  return functions;
}

async function main() {
  console.log('🔍 Verifying Vercel Serverless Functions...\n');
  console.log('Vercel counts any file in api/ that exports a default function as a serverless function.\n');

  const allFiles = await findServerlessFunctions(apiDir);
  const serverlessFunctions = allFiles.filter(f => f.isServerlessFunction);
  const modules = allFiles.filter(f => !f.isServerlessFunction);

  // Constants - Keep API count below 10 (max 8 serverless functions)
  const MAX_FUNCTIONS = 8;
  const currentCount = serverlessFunctions.length;
  const statusIcon = currentCount <= MAX_FUNCTIONS ? '✅' : '❌';

  console.log('📊 Results:\n');
  console.log(`${statusIcon} Serverless Functions: ${currentCount}/${MAX_FUNCTIONS} (Maximum allowed: ${MAX_FUNCTIONS})\n`);
  
  if (serverlessFunctions.length > 0) {
    console.log('Serverless Functions (counted by Vercel):');
    serverlessFunctions.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.path}`);
    });
    console.log('');
  }

  if (modules.length > 0) {
    console.log(`📦 Modules (not counted as functions): ${modules.length}`);
    modules.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.path} ${f.note ? `(${f.note})` : ''}`);
    });
    console.log('');
  }

  // Check vercel.json rewrite rule
  try {
    const vercelConfig = await readFile(join(__dirname, '..', 'vercel.json'), 'utf-8');
    const config = JSON.parse(vercelConfig);
    if (config.rewrites && config.rewrites.some(r => r.source === '/api/(.*)' && r.destination === '/api/main.ts')) {
      console.log('✅ vercel.json rewrite rule configured correctly');
      console.log('   All /api/* routes are routed to api/main.ts\n');
    }
  } catch (error) {
    console.warn('⚠️  Could not read vercel.json');
  }

  // Summary
  console.log('📋 Summary:');
  // MAX_FUNCTIONS and currentCount already declared above
  
  if (currentCount <= MAX_FUNCTIONS) {
    console.log(`   ✅ You are within the limit (${currentCount}/${MAX_FUNCTIONS} functions)`);
    if (currentCount === 1) {
      console.log('   ✅ Optimal: All routes handled through single main.ts function');
    } else if (currentCount < MAX_FUNCTIONS) {
      console.log(`   ⚠️  Warning: ${MAX_FUNCTIONS - currentCount} function slots remaining`);
    }
  } else {
    console.log(`   ❌ EXCEEDS LIMIT: ${currentCount} functions (maximum: ${MAX_FUNCTIONS})`);
    console.log('   ⚠️  You MUST consolidate functions to stay under the limit');
    console.log('   💡 Recommendation: Move handlers to api/main.ts or api/handlers/');
  }

  process.exit(currentCount <= MAX_FUNCTIONS ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


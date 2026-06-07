#!/usr/bin/env node
/**
 * Fail CI/build when api/ or server/ use relative imports without .js extension.
 * Vercel Node ESM requires explicit extensions (ERR_MODULE_NOT_FOUND otherwise).
 */
const { readdir, readFile } = require('fs/promises');
const { join, extname } = require('path');

const root = join(__dirname, '..');

const SCAN_DIRS = ['api', 'server'];
const EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx', '.mts', '.cts']);
const IMPORT_RE =
  /\b(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+from\s+)?['"](\.[^'"]+)['"]/g;

function isRelative(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function hasValidExtension(specifier) {
  return /\.(?:js|json|node|mjs|cjs)$/.test(specifier);
}

async function walk(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      await walk(full, files);
    } else if (EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const violations = [];

  for (const relDir of SCAN_DIRS) {
    const absDir = join(root, relDir);
    const files = await walk(absDir);
    for (const file of files) {
      const content = await readFile(file, 'utf8');
      let match;
      IMPORT_RE.lastIndex = 0;
      while ((match = IMPORT_RE.exec(content)) !== null) {
        const specifier = match[1];
        if (isRelative(specifier) && !hasValidExtension(specifier)) {
          const line = content.slice(0, match.index).split('\n').length;
          violations.push({
            file: file.replace(root + require('path').sep, '').replace(/\//g, '/'),
            line,
            specifier,
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ All relative imports in api/ and server/ use explicit .js (or .json) extensions.');
    process.exit(0);
  }

  console.error(`❌ ${violations.length} relative import(s) missing .js extension:\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line}  →  "${v.specifier}"`);
  }
  if (violations.length > 50) {
    console.error(`  … and ${violations.length - 50} more`);
  }
  console.error('\nFix: append `.js` to relative import paths (TypeScript ESM convention).');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

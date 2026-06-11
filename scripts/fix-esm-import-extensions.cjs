#!/usr/bin/env node
/**
 * Append .js to relative import/export specifiers missing an explicit extension.
 * TypeScript ESM convention for Node/Vercel.
 */
const { readdir, readFile, writeFile } = require('fs/promises');
const { join, extname } = require('path');

const root = join(__dirname, '..');
const SCAN_DIRS = ['utils', 'lib', 'services'];
const EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx', '.mts', '.cts']);
const IMPORT_RE =
  /\b((?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+from\s+)?)(['"])(\.\.?\/[^'"]+)\2/g;

function hasValidExtension(specifier) {
  return /\.(?:js|json|node|mjs|cjs)$/.test(specifier);
}

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '__tests__', '__mocks__'].includes(entry.name)) continue;
      await walk(full, files);
    } else if (EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  let changedFiles = 0;
  let replacements = 0;

  for (const relDir of SCAN_DIRS) {
    const files = await walk(join(root, relDir));
    for (const file of files) {
      const original = await readFile(file, 'utf8');
      let fileChanged = false;
      const updated = original.replace(IMPORT_RE, (match, prefix, quote, specifier) => {
        if (!hasValidExtension(specifier)) {
          fileChanged = true;
          replacements += 1;
          return `${prefix}${quote}${specifier}.js${quote}`;
        }
        return match;
      });
      if (fileChanged) {
        await writeFile(file, updated, 'utf8');
        changedFiles += 1;
      }
    }
  }

  console.log(`✅ Updated ${replacements} import(s) across ${changedFiles} file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

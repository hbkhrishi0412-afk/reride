#!/usr/bin/env node
/**
 * Replace console.log with logInfo from utils/logger in client production paths.
 * Skips test files, scripts, and files that already import logInfo.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_DIRS = ['services', 'components', 'hooks', 'lib', 'utils'];
const SKIP = [
  /__tests__/,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /logger\.ts$/,
  /e2e\//,
  /scripts\//,
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.some((re) => re.test(p))) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
  return files;
}

function processFile(filePath) {
  let src = readFileSync(filePath, 'utf8');
  if (!src.includes('console.log')) return false;

  const hasLogInfo = /import\s*\{[^}]*\blogInfo\b/.test(src);
  const relFromRoot = relative(ROOT, filePath).replace(/\\/g, '/');
  const depth = relFromRoot.split('/').length - 1;
  const importPath = `${'../'.repeat(depth)}utils/logger.js`;

  if (!hasLogInfo) {
    const importLine = `import { logInfo } from '${importPath}';\n`;
    const shebang = src.startsWith('#!') ? src.indexOf('\n') + 1 : 0;
    const useClient = src.match(/^['"]use client['"];?\s*\n/);
    if (useClient) {
      const insertAt = useClient.index + useClient[0].length;
      src = src.slice(0, insertAt) + importLine + src.slice(insertAt);
    } else {
      src = src.slice(0, shebang) + importLine + src.slice(shebang);
    }
  }

  const next = src.replace(/\bconsole\.log\b/g, 'logInfo');
  if (next === src) return false;
  writeFileSync(filePath, next, 'utf8');
  return true;
}

let changed = 0;
for (const dir of TARGET_DIRS) {
  const abs = join(ROOT, dir);
  try {
    for (const f of walk(abs)) {
      if (processFile(f)) {
        changed++;
        console.log('updated', relative(ROOT, f));
      }
    }
  } catch {
    /* dir may not exist */
  }
}
console.log(`Done. ${changed} file(s) updated.`);

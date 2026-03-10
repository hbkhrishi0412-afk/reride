/**
 * Post-build verification: ensures dist/index.html references built assets,
 * not the dev entry. Prevents deploying a broken production (script load failure).
 * Run after: npm run build (or as part of it).
 * Uses .cjs because package.json has "type": "module".
 */
const fs = require('fs');
const path = require('path');

const distIndex = path.join(process.cwd(), 'dist', 'index.html');
if (!fs.existsSync(distIndex)) {
  console.error('❌ dist/index.html not found. Build may have failed.');
  process.exit(1);
}

const html = fs.readFileSync(distIndex, 'utf8');

// Must contain the built script pattern (Vite replaces /index.tsx with /assets/index-<hash>.js)
if (!html.includes('src="/assets/index-') && !html.includes('src=\'/assets/index-')) {
  console.error('❌ dist/index.html does not reference built app script (/assets/index-*.js).');
  console.error('   Production would try to load /index.tsx and fail. Fix Vite build or output.');
  process.exit(1);
}

// Must NOT contain the dev entry as the only script (would break production)
if (html.includes('src="/index.tsx"') && !html.includes('/assets/index-')) {
  console.error('❌ dist/index.html still has src="/index.tsx". Build did not transform the entry.');
  process.exit(1);
}

// Ensure assets directory exists and has JS files
const assetsDir = path.join(process.cwd(), 'dist', 'assets');
if (!fs.existsSync(assetsDir)) {
  console.error('❌ dist/assets/ not found.');
  process.exit(1);
}
const files = fs.readdirSync(assetsDir);
const jsFiles = files.filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  console.error('❌ dist/assets/ has no .js files.');
  process.exit(1);
}

console.log('✅ Build output verified: dist/index.html and dist/assets/*.js are valid for production.');
process.exit(0);

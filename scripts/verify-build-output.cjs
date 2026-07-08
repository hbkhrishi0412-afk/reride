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

// Must contain the built script pattern (Vite replaces /index.tsx with /assets/index.js or /assets/index-<hash>.js)
const hasBuiltScript =
  html.includes('src="/assets/index') ||
  html.includes("src='/assets/index") ||
  html.includes('src="./assets/index') ||
  html.includes("src='./assets/index");
if (!hasBuiltScript) {
  console.error('❌ dist/index.html does not reference built app script (/assets/index*.js or ./assets/index*.js).');
  console.error('   Production would try to load /index.tsx and fail. Fix Vite build or output.');
  process.exit(1);
}

// Must NOT contain the dev entry as the only script (would break production)
if (html.includes('src="/index.tsx"') && !hasBuiltScript) {
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

// vendor-misc is synchronously imported at app startup. Sentry (and similar libs)
// ship React class components; if they land in vendor-misc, a circular import with
// vendor-react leaves React undefined → "Cannot read properties of undefined (reading 'Component')".
const vendorMiscFile = jsFiles.find((f) => f.startsWith('vendor-misc-'));
if (vendorMiscFile) {
  const vendorMiscSource = fs.readFileSync(path.join(assetsDir, vendorMiscFile), 'utf8');
  const vendorMiscKb = fs.statSync(path.join(assetsDir, vendorMiscFile)).size / 1024;
  if (/extends \w+\.Component/.test(vendorMiscSource)) {
    console.error(
      `❌ ${vendorMiscFile} contains React class components. ` +
        'Keep @sentry/* and web-vitals out of vendor-misc (see vite.config.ts manualChunks).',
    );
    process.exit(1);
  }
  if (vendorMiscKb > 50) {
    console.error(
      `❌ ${vendorMiscFile} is ${vendorMiscKb.toFixed(0)}KB — vendor-misc catch-all should be removed. ` +
        'Large deps (xlsx, chart helpers) must use dedicated async chunks (see vite.config.ts).',
    );
    process.exit(1);
  }
}

const vendorReactFile = jsFiles.find((f) => f.startsWith('vendor-react-'));
if (vendorReactFile) {
  const vendorReactSource = fs.readFileSync(path.join(assetsDir, vendorReactFile), 'utf8');
  if (vendorMiscFile && vendorReactSource.includes('vendor-misc')) {
    console.error(
      `❌ ${vendorReactFile} imports ${vendorMiscFile}. ` +
        'Circular vendor-react ↔ vendor-misc leaves React undefined at runtime.',
    );
    process.exit(1);
  }
}

const capBuild = process.env.CAPACITOR_BUILD === '1' || process.env.CAPACITOR_BUILD === 'true';
if (capBuild) {
  let foundGoogleClient = false;
  const oauthClientHostRe = /\b(\d+-[a-z0-9_]+\.apps\.googleusercontent\.com)\b/gi;
  for (const f of jsFiles) {
    oauthClientHostRe.lastIndex = 0;
    const p = path.join(assetsDir, f);
    const c = fs.readFileSync(p, 'utf8');
    let m;
    while ((m = oauthClientHostRe.exec(c)) !== null) {
      const host = m[1].toLowerCase();
      try {
        const u = new URL('https://' + host);
        if (u.hostname === host && u.hostname.endsWith('.apps.googleusercontent.com')) {
          foundGoogleClient = true;
          break;
        }
      } catch {
        /* continue */
      }
    }
    if (foundGoogleClient) break;
  }
  if (!foundGoogleClient) {
    console.warn(
      '⚠️ CAPACITOR_BUILD: No `apps.googleusercontent.com` string in dist/assets/*.js. ' +
        'Native Google Sign-In is likely disabled — set VITE_GOOGLE_WEB_CLIENT_ID for production mobile builds.',
    );
  }
}

process.exit(0);

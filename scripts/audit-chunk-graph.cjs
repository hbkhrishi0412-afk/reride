/**
 * Post-build chunk graph audit — catches circular vendor-react deps that break startup.
 * Run: node scripts/audit-chunk-graph.cjs
 */
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(process.cwd(), 'dist', 'assets');
if (!fs.existsSync(assetsDir)) {
  console.error('❌ dist/assets/ not found. Run npm run build first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
const importRe = /from"\.\/([^"]+)"/g;
const graph = {};

for (const f of files) {
  const src = fs.readFileSync(path.join(assetsDir, f), 'utf8');
  const deps = new Set();
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(src))) deps.add(m[1]);
  graph[f] = [...deps];
}

const fails = [];
const warns = [];

const vendorI18n = files.filter((f) => f.startsWith('vendor-i18n-'));
if (vendorI18n.length) {
  fails.push(`vendor-i18n chunk still exists: ${vendorI18n.join(', ')}`);
}

const vendorMisc = files.filter((f) => f.startsWith('vendor-misc-'));
if (vendorMisc.length) {
  warns.push(`vendor-misc chunk exists: ${vendorMisc.join(', ')}`);
}

const vendorReact = files.find((f) => f.startsWith('vendor-react-'));
if (!vendorReact) {
  fails.push('no vendor-react chunk found');
} else {
  const vrSrc = fs.readFileSync(path.join(assetsDir, vendorReact), 'utf8');
  const vrDeps = graph[vendorReact] || [];

  if (vrDeps.some((d) => d.includes('vendor-i18n'))) {
    fails.push(`${vendorReact} imports vendor-i18n (circular React init bug)`);
  }
  if (vrDeps.some((d) => d.includes('vendor-misc'))) {
    fails.push(`${vendorReact} imports vendor-misc (circular React init bug)`);
  }
  if (!vrSrc.includes('createContext')) {
    warns.push('createContext not found in vendor-react (unexpected)');
  }
  if (!/i18next|react-i18next/.test(vendorReact)) {
    // i18n code is minified inside vendor-react — check source content
    if (!/i18next|react-i18next|I18nContext|initReactI18next/.test(vrSrc)) {
      fails.push('i18n libraries do not appear bundled in vendor-react');
    }
  }
}

const indexEntry = files.find((f) => f.startsWith('index-') && f !== 'index-BGBE7lq7.js');
if (indexEntry && (graph[indexEntry] || []).some((d) => d.includes('vendor-i18n'))) {
  fails.push(`${indexEntry} still imports vendor-i18n`);
}

// Detect any circular import between vendor-react and another vendor-* chunk
const vendorChunks = files.filter((f) => f.startsWith('vendor-'));
if (vendorReact) {
  for (const other of vendorChunks) {
    if (other === vendorReact) continue;
    const vrImportsOther = (graph[vendorReact] || []).some(
      (d) => other.startsWith(d.replace(/\.js$/, '')) || other.includes(d),
    );
    const otherImportsVr = (graph[other] || []).some(
      (d) => vendorReact.startsWith(d.replace(/\.js$/, '')) || vendorReact.includes(d),
    );
    if (vrImportsOther && otherImportsVr) {
      fails.push(`circular chunk import: ${vendorReact} ↔ ${other}`);
    }
  }
}

const html = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
if (/<link[^>]+href="[^"]*\.tsx"/i.test(html) || /<script[^>]+src="[^"]*\.tsx"/i.test(html)) {
  fails.push('dist/index.html still references a .tsx asset (broken preload/script)');
}
if (html.includes('vendor-i18n')) {
  fails.push('dist/index.html references vendor-i18n');
}

console.log('=== ReRide chunk graph audit ===');
console.log(`JS chunks: ${files.length}`);
console.log(`Vendor chunks: ${vendorChunks.length}`);
if (vendorReact) {
  const kb = fs.statSync(path.join(assetsDir, vendorReact)).size / 1024;
  console.log(`vendor-react: ${vendorReact} (${kb.toFixed(1)} KB)`);
}
if (indexEntry) console.log(`entry: ${indexEntry}`);

if (warns.length) {
  console.log('\nWarnings:');
  warns.forEach((w) => console.log(`  ⚠️  ${w}`));
}

if (fails.length) {
  console.log('\nFailures:');
  fails.forEach((f) => console.log(`  ❌ ${f}`));
  process.exit(1);
}

console.log('\n✅ PASS — no circular vendor-react / vendor-i18n issues detected.');
process.exit(0);

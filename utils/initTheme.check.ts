/**
 * Runnable check: theme boot always clears Tailwind `dark` (light product UI).
 * Run: npx tsx utils/initTheme.check.ts
 */
import assert from 'node:assert/strict';

const classList = {
  set: new Set<string>(['dark']),
  remove(name: string) {
    this.set.delete(name);
  },
  contains(name: string) {
    return this.set.has(name);
  },
};

const style: { colorScheme?: string } = {};
const store: Record<string, string> = { 'reride-theme': 'dark' };

(globalThis as typeof globalThis & { document: unknown; localStorage: Storage }).document = {
  documentElement: { classList, style },
} as unknown as Document;
(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  key: () => null,
  get length() {
    return Object.keys(store).length;
  },
} as Storage;

async function main() {
  const { initThemeFromPreference } = await import('./initTheme.js');
  initThemeFromPreference();
  assert.equal(classList.contains('dark'), false);
  assert.equal(store['reride-theme'], 'light');
  assert.equal(style.colorScheme, 'light');
  console.log('initTheme.check: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

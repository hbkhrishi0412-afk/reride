#!/usr/bin/env node
/**
 * Sync public/.well-known/assetlinks.json from available signing certificates.
 *
 * Debug: always from ~/.android/debug.keystore (local dev / debug APK).
 * Release upload keystore: set KEYSTORE_FILE + KEY_ALIAS + KEYSTORE_PASSWORD (+ KEY_PASSWORD)
 *   or ANDROID_KEYSTORE_PATH + ANDROID_KEYSTORE_ALIAS + ANDROID_KEYSTORE_PASSWORD.
 * Play App Signing: if Google re-signs your AAB, paste the SHA-256 from
 *   Play Console → Your app → Setup → App signing → App signing key certificate:
 *   RELEASE_SHA256_FINGERPRINT=AA:BB:...
 *
 * Usage:
 *   node scripts/sync-assetlinks-fingerprints.cjs
 *   RELEASE_SHA256_FINGERPRINT=XX:... node scripts/sync-assetlinks-fingerprints.cjs
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_NAME = 'com.reride.app';
const OUT_PATH = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json');

function findKeytool() {
  if (process.env.JAVA_HOME) {
    const candidate = path.join(
      process.env.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'keytool.exe' : 'keytool',
    );
    if (fs.existsSync(candidate)) return candidate;
  }
  const studioJbr =
    process.platform === 'win32'
      ? 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe'
      : '/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool';
  if (fs.existsSync(studioJbr)) return studioJbr;
  return 'keytool';
}

function sha256FromKeytool(keystore, alias, storepass, keypass) {
  const keytool = findKeytool();
  const kp = keypass || storepass;
  const out = execSync(
    `"${keytool}" -list -v -keystore "${keystore}" -alias ${alias} -storepass ${storepass} -keypass ${kp}`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const match = out.match(/SHA256:\s*([0-9A-F:]+)/i);
  if (!match) throw new Error(`SHA256 not found for ${keystore} alias ${alias}`);
  return match[1].trim().toUpperCase();
}

function normalizeFingerprint(fp) {
  return String(fp || '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-F:]/g, '');
}

function collectFingerprints() {
  const fps = new Set();

  const pasted = normalizeFingerprint(process.env.RELEASE_SHA256_FINGERPRINT);
  if (pasted && pasted.includes(':')) {
    fps.add(pasted);
    console.log(`✓ Play / release fingerprint (env): ${pasted}`);
  }

  try {
    const debugKs = path.join(os.homedir(), '.android', 'debug.keystore');
    const debugFp = sha256FromKeytool(debugKs, 'androiddebugkey', 'android');
    fps.add(debugFp);
    console.log(`✓ Debug keystore: ${debugFp}`);
  } catch (err) {
    console.warn('⚠ Debug fingerprint skipped:', err.message || err);
  }

  const releaseKs =
    process.env.ANDROID_KEYSTORE_PATH || process.env.KEYSTORE_FILE || '';
  const releaseAlias =
    process.env.ANDROID_KEYSTORE_ALIAS || process.env.KEY_ALIAS || '';
  const releaseStorePass =
    process.env.ANDROID_KEYSTORE_PASSWORD || process.env.KEYSTORE_PASSWORD || '';
  const releaseKeyPass =
    process.env.ANDROID_KEYSTORE_KEY_PASSWORD ||
    process.env.KEY_PASSWORD ||
    releaseStorePass;

  if (releaseKs && releaseAlias && releaseStorePass) {
    try {
      const releaseFp = sha256FromKeytool(
        releaseKs,
        releaseAlias,
        releaseStorePass,
        releaseKeyPass,
      );
      fps.add(releaseFp);
      console.log(`✓ Release/upload keystore: ${releaseFp}`);
    } catch (err) {
      console.warn('⚠ Release keystore fingerprint failed:', err.message || err);
    }
  } else {
    console.log(
      'ℹ No release keystore env set. For Play production links, set RELEASE_SHA256_FINGERPRINT from Play Console → App signing key certificate.',
    );
  }

  if (fps.size === 0) {
    throw new Error('No fingerprints collected. Install JDK/Android Studio JBR or set RELEASE_SHA256_FINGERPRINT.');
  }

  return [...fps];
}

function writeAssetLinks(fingerprints) {
  const doc = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${OUT_PATH} (${fingerprints.length} fingerprint(s))`);
}

try {
  const fingerprints = collectFingerprints();
  writeAssetLinks(fingerprints);
} catch (err) {
  console.error('Failed:', err.message || err);
  process.exit(1);
}

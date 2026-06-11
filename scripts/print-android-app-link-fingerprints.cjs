#!/usr/bin/env node
/**
 * Print SHA-256 cert fingerprints for Android App Links (assetlinks.json).
 *
 * Debug (default ~/.android/debug.keystore):
 *   node scripts/print-android-app-link-fingerprints.cjs
 *
 * Release (set env vars used by capacitor.config.ts / Gradle signing):
 *   ANDROID_KEYSTORE_PATH=... ANDROID_KEYSTORE_ALIAS=... ANDROID_KEYSTORE_PASSWORD=... \\
 *     node scripts/print-android-app-link-fingerprints.cjs --release
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const isRelease = process.argv.includes('--release');

function findKeytool() {
  if (process.env.JAVA_HOME) {
    const candidate = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool');
    if (fs.existsSync(candidate)) return candidate;
  }
  const studioJbr =
    process.platform === 'win32'
      ? 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe'
      : '/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool';
  if (fs.existsSync(studioJbr)) return studioJbr;
  return 'keytool';
}

function sha256FromKeytool(keystore, alias, storepass) {
  const keytool = findKeytool();
  const out = execSync(
    `"${keytool}" -list -v -keystore "${keystore}" -alias ${alias} -storepass ${storepass} -keypass ${storepass}`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const match = out.match(/SHA256:\s*([0-9A-F:]+)/i);
  if (!match) throw new Error('SHA256 line not found in keytool output');
  return match[1].trim().toUpperCase();
}

try {
  let keystore;
  let alias;
  let storepass;

  if (isRelease) {
    keystore = process.env.ANDROID_KEYSTORE_PATH || process.env.KEYSTORE_FILE;
    alias = process.env.ANDROID_KEYSTORE_ALIAS || process.env.KEY_ALIAS;
    storepass = process.env.ANDROID_KEYSTORE_PASSWORD || process.env.KEYSTORE_PASSWORD;
    if (!keystore || !alias || !storepass) {
      console.error(
        'Set KEYSTORE_FILE, KEY_ALIAS, KEYSTORE_PASSWORD (Gradle) or ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_ALIAS, ANDROID_KEYSTORE_PASSWORD for --release',
      );
      process.exit(1);
    }
  } else {
    keystore = path.join(os.homedir(), '.android', 'debug.keystore');
    alias = 'androiddebugkey';
    storepass = 'android';
  }

  const fp = sha256FromKeytool(keystore, alias, storepass);
  console.log(`SHA256 (${isRelease ? 'release' : 'debug'}): ${fp}`);
  console.log('\nPaste into public/.well-known/assetlinks.json → sha256_cert_fingerprints');
} catch (err) {
  console.error('Failed:', err.message || err);
  console.error('Install a JDK and ensure keytool is on PATH or set JAVA_HOME.');
  process.exit(1);
}

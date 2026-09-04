import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

const forbiddenNativeDependencies = [
  '@react-native-community/datetimepicker',
  '@react-native-community/netinfo',
  'expo-notifications',
  'expo-local-authentication',
  'expo-screen-capture',
  'expo-haptics',
];

const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const accidentalNative = forbiddenNativeDependencies.filter((name) => declared[name]);
if (accidentalNative.length) {
  throw new Error(`Pre-APK freeze violated by native dependencies: ${accidentalNative.join(', ')}`);
}

if (pkg.version !== '0.1.0' || app.expo?.version !== '0.1.0') {
  throw new Error('Pre-APK OTA runtime must remain on app version 0.1.0 until the native phase is explicitly approved.');
}
if (app.expo?.runtimeVersion?.policy !== 'appVersion') {
  throw new Error('Partner runtimeVersion must remain appVersion-based.');
}
if (app.expo?.updates?.checkAutomatically !== 'ON_LOAD') {
  throw new Error('Partner OTA updates must continue checking automatically on launch.');
}
if (!declared['expo-updates']) {
  throw new Error('expo-updates must remain available during the OTA readiness phase.');
}

const requiredFiles = [
  'lib/partner-updates.ts',
  'lib/partner-destinations.ts',
  'scripts/verify-routes.mjs',
  'scripts/verify-phase5-contracts.mjs',
];
for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing pre-APK readiness file: ${relative}`);
}

console.log('Partner pre-APK freeze guard OK: runtime 0.1.0 remains OTA-only and native candidates are blocked.');

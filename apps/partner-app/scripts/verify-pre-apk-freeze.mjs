import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(root, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const buildWorkflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/build-partner-preview.yml'), 'utf8');

const approvedNativeDependencies = new Set([
  '@react-native-community/datetimepicker',
  '@react-native-community/netinfo',
  'expo-notifications',
  'expo-local-authentication',
  'expo-screen-capture',
  'expo-haptics',
]);

const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
for (const name of approvedNativeDependencies) {
  if (!declared[name]) throw new Error(`Approved Phase 6 native dependency is missing: ${name}`);
}

if (pkg.version !== '0.2.0' || app.expo?.version !== '0.2.0') {
  throw new Error('Partner native implementation baseline must remain on app version 0.2.0.');
}
if (app.expo?.android?.versionCode !== 2 || app.expo?.ios?.buildNumber !== '2') {
  throw new Error('Partner Phase 6 native version codes must remain Android 2 / iOS 2 until the approved build.');
}
if (app.expo?.runtimeVersion?.policy !== 'appVersion') {
  throw new Error('Partner runtimeVersion must remain appVersion-based.');
}
if (app.expo?.updates?.checkAutomatically !== 'ON_LOAD') {
  throw new Error('Partner OTA updates must continue checking automatically on launch.');
}
if (!declared['expo-updates']) {
  throw new Error('expo-updates must remain available through the native transition.');
}

for (const required of ['workflow_dispatch:', 'BUILD_PARTNER_0_2_0', 'inputs.approval', 'assets/notification-icon.png']) {
  if (!buildWorkflow.includes(required)) throw new Error(`Native build safety requirement missing: ${required}`);
}
if (buildWorkflow.includes("'apps/partner-app/.trigger-preview-build'")) {
  throw new Error('Partner preview APK must not auto-trigger from a committed marker during Phase 6.');
}

const requiredFiles = [
  'lib/partner-updates.ts',
  'lib/partner-destinations.ts',
  'lib/partner-haptics.ts',
  'lib/partner-native-security.ts',
  'lib/partner-notifications.ts',
  'providers/partner-network-provider.tsx',
  'providers/partner-biometric-lock-provider.tsx',
  'providers/partner-native-runtime-provider.tsx',
  'components/ui/partner-date-picker.tsx',
  'scripts/verify-routes.mjs',
  'scripts/verify-phase5-contracts.mjs',
  'scripts/verify-phase6-native-foundation.mjs',
];
for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing Phase 6 readiness file: ${relative}`);
}

console.log('Partner pre-APK guard OK: approved 0.2.0 native foundation is present and the actual APK build remains manual/explicitly gated.');

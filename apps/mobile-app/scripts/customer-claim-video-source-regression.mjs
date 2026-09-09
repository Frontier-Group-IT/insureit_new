import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const wrapperPath = path.join(root, 'apps/mobile-app/lib/claim-video-document-picker.ts');
const babelPath = path.join(root, 'apps/mobile-app/babel.config.js');
const internalCreatePath = path.join(root, 'apps/mobile-app/components/internal-claim-stage-one.tsx');
const internalTrackerPath = path.join(root, 'apps/mobile-app/components/internal-claim-stage-one-tracker.tsx');
const externalClaimPath = path.join(root, 'apps/mobile-app/app/customer/self-managed-claim.tsx');
const packagePath = path.join(root, 'apps/mobile-app/package.json');
const appConfigPath = path.join(root, 'apps/mobile-app/app.json');

const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const babel = fs.readFileSync(babelPath, 'utf8');
const internalCreate = fs.readFileSync(internalCreatePath, 'utf8');
const internalTracker = fs.readFileSync(internalTrackerPath, 'utf8');
const externalClaim = fs.readFileSync(externalClaimPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));

const hasVideoDocumentPicker = (source) =>
  source.includes("key === 'accident_video' ? ['video/*']") &&
  source.includes('DocumentPicker.getDocumentAsync');

const imagePickerPluginConfigured = (appConfig.expo.plugins ?? []).some((plugin) =>
  plugin === 'expo-image-picker' || (Array.isArray(plugin) && plugin[0] === 'expo-image-picker'),
);

const checks = [
  ['Document picker alias routes through claim video source wrapper', babel.includes("'^expo-document-picker$': './lib/claim-video-document-picker'")],
  ['Wrapper only intercepts video-only requests', wrapper.includes("types.length === 1") && wrapper.includes("=== 'video/*'")],
  ['Video source prompt offers Camera', wrapper.includes("text: 'Camera'")],
  ['Video source prompt offers Gallery / File', wrapper.includes("text: 'Gallery / File'")],
  ['Camera permission is requested at runtime', wrapper.includes('ImagePicker.requestCameraPermissionsAsync()')],
  ['Camera opens directly in video mode', wrapper.includes('ImagePicker.launchCameraAsync') && wrapper.includes("mediaTypes: ['videos']")],
  ['Gallery / File preserves native document picker', wrapper.includes("source === 'files'") && wrapper.includes('NativeDocumentPicker.getDocumentAsync(options)')],
  ['Web review keeps native file picker behavior', wrapper.includes("Platform.OS === 'web'") && wrapper.includes("Promise.resolve('files')")],
  ['Internal new-claim video still uses video-only picker contract', hasVideoDocumentPicker(internalCreate)],
  ['Internal tracked Stage 1 video still uses video-only picker contract', hasVideoDocumentPicker(internalTracker)],
  ['External self-managed claim video still uses video-only picker contract', hasVideoDocumentPicker(externalClaim)],
  ['Existing expo-image-picker dependency is reused', Boolean(packageJson.dependencies?.['expo-image-picker'])],
  ['Existing expo-image-picker native plugin remains configured', imagePickerPluginConfigured],
  ['Customer runtime remains 0.3.0', appConfig.expo.version === '0.3.0'],
  ['Customer Android versionCode remains 9', appConfig.expo.android?.versionCode === 9],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);

if (failed.length) {
  console.error(`\n${failed.length} claim video source regression check(s) failed.`);
  process.exit(1);
}

console.log('\nCustomer internal/external claim video Camera + Gallery / File regression passed.');

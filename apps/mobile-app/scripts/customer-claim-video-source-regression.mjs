import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const wrapperPath = path.join(root, 'apps/mobile-app/lib/claim-video-document-picker.tsx');
const babelPath = path.join(root, 'apps/mobile-app/babel.config.js');
const internalCreatePath = path.join(root, 'apps/mobile-app/components/internal-claim-stage-one.tsx');
const internalTrackerPath = path.join(root, 'apps/mobile-app/components/internal-claim-stage-one-tracker.tsx');
const externalClaimPath = path.join(root, 'apps/mobile-app/app/customer/self-managed-claim.tsx');
const appLoadingPath = path.join(root, 'apps/mobile-app/components/app-loading.tsx');
const loadingTrackerPath = path.join(root, 'apps/mobile-app/lib/loading-tracker.ts');
const supabasePath = path.join(root, 'apps/mobile-app/lib/supabase.ts');
const packagePath = path.join(root, 'apps/mobile-app/package.json');
const appConfigPath = path.join(root, 'apps/mobile-app/app.json');

const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const babel = fs.readFileSync(babelPath, 'utf8');
const internalCreate = fs.readFileSync(internalCreatePath, 'utf8');
const internalTracker = fs.readFileSync(internalTrackerPath, 'utf8');
const externalClaim = fs.readFileSync(externalClaimPath, 'utf8');
const appLoading = fs.readFileSync(appLoadingPath, 'utf8');
const loadingTracker = fs.readFileSync(loadingTrackerPath, 'utf8');
const supabaseClient = fs.readFileSync(supabasePath, 'utf8');
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
  ['Branded Accident Video modal host replaces the native source alert', wrapper.includes('export function ClaimVideoSourceModalHost()') && wrapper.includes('accessibilityLabel="Upload Accident Video"') && !wrapper.includes("Alert.alert(\n      'Upload Accident Video'")],
  ['Branded source modal offers Camera', wrapper.includes('>Camera</Text>') && wrapper.includes("finishVideoSourceSelection('camera')")],
  ['Branded source modal offers Gallery / File', wrapper.includes('>Gallery / File</Text>') && wrapper.includes("finishVideoSourceSelection('files')")],
  ['Global mobile shell mounts the branded video source modal host', appLoading.includes('<ClaimVideoSourceModalHost />')],
  ['Camera permission is requested at runtime', wrapper.includes('ImagePicker.requestCameraPermissionsAsync()')],
  ['Camera opens directly in video mode', wrapper.includes('ImagePicker.launchCameraAsync') && wrapper.includes("mediaTypes: ['videos']")],
  ['Gallery / File preserves native document picker', wrapper.includes("source === 'files'") && wrapper.includes('NativeDocumentPicker.getDocumentAsync(options)')],
  ['Web review keeps native file picker behavior', wrapper.includes("Platform.OS === 'web'") && wrapper.includes("Promise.resolve('files')")],
  ['Internal new-claim video still uses video-only picker contract', hasVideoDocumentPicker(internalCreate)],
  ['Internal tracked Stage 1 video still uses video-only picker contract', hasVideoDocumentPicker(internalTracker)],
  ['External self-managed claim video still uses video-only picker contract', hasVideoDocumentPicker(externalClaim)],
  ['Internal tracked video keeps existing resumable progress callback', internalTracker.includes('onProgress: (progress) => updateVideoTransfer')],
  ['External claim storage failures are classified with status logging', externalClaim.includes('classifyClaimUploadStorageError(uploadError)') && externalClaim.includes('claimUploadStorageErrorStatus(uploadError)')],
  ['External claim refreshes authentication before retrying auth failures', externalClaim.includes("failureKind === 'auth'") && externalClaim.includes('supabase.auth.refreshSession()')],
  ['External claim retries transient storage failures up to three attempts', externalClaim.includes('CLAIM_UPLOAD_MAX_ATTEMPTS = 3') && externalClaim.includes("failureKind === 'transient'")],
  ['External claim treats an already-existing retry target as uploaded', externalClaim.includes("failureKind === 'already_exists' && attempt > 1")],
  ['Tracked loading entries support bounded numeric upload progress', loadingTracker.includes('progress?: number;') && loadingTracker.includes('export function updateTrackedLoading') && loadingTracker.includes('Math.max(0, Math.min(1')],
  ['Claim-document uploads use XHR progress without changing signed-read handling', supabaseClient.includes("url.includes('/storage/v1/object/claim-documents/')") && supabaseClient.includes('xhr.upload.onprogress') && supabaseClient.includes('updateTrackedLoading(token, progress)') && supabaseClient.includes("url.includes('/storage/v1/object/sign/')")],
  ['Native claim upload progress path does not add a shorter timeout than the previous fetch path', supabaseClient.includes("Platform.OS === 'web' ? 15000 : 0")],
  ['Upload overlay renders a real percentage and progress bar when byte progress is available', appLoading.includes('progressPercent}%') && appLoading.includes('styles.progressTrack') && appLoading.includes('styles.progressFill') && appLoading.includes('uploadProgress(entries, nextLabel)')],
  ['Existing expo-image-picker dependency is reused', Boolean(packageJson.dependencies?.['expo-image-picker'])],
  ['Existing expo-image-picker native plugin remains configured', imagePickerPluginConfigured],
  ['Customer runtime remains 0.3.0', appConfig.expo.version === '0.3.0'],
  ['Customer Android versionCode remains 9', appConfig.expo.android?.versionCode === 9],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);

if (failed.length) {
  console.error(`\n${failed.length} claim video/upload UI regression check(s) failed.`);
  process.exit(1);
}

console.log('\nCustomer claim video branded source modal + resilient upload progress regression passed.');

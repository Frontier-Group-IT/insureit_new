import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repoRoot = path.resolve(root, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const buildWorkflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/build-partner-preview.yml'), 'utf8');

const requiredDependencies = {
  '@react-native-community/datetimepicker': '8.4.4',
  '@react-native-community/netinfo': '11.4.1',
  'expo-haptics': '~15.0.8',
  'expo-local-authentication': '~17.0.9',
  'expo-notifications': '~0.32.17',
  'expo-screen-capture': '~8.0.9',
};

for (const [name, version] of Object.entries(requiredDependencies)) {
  if (pkg.dependencies?.[name] !== version) {
    throw new Error(`Phase 6 dependency mismatch: ${name} must be ${version}.`);
  }
}

if (pkg.version !== '0.2.0' || app.expo?.version !== '0.2.0') {
  throw new Error('Partner Phase 6 native baseline must be app version 0.2.0.');
}
if (app.expo?.android?.versionCode !== 2 || app.expo?.ios?.buildNumber !== '2') {
  throw new Error('Partner Phase 6 native baseline must use Android versionCode 2 and iOS buildNumber 2.');
}
if (app.expo?.runtimeVersion?.policy !== 'appVersion') {
  throw new Error('Partner Phase 6 must retain appVersion runtime isolation.');
}
if (app.expo?.updates?.checkAutomatically !== 'ON_LOAD') {
  throw new Error('Partner update checks must remain enabled on launch.');
}

const plugins = app.expo?.plugins || [];
const notificationPlugin = plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-notifications');
const biometricPlugin = plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-local-authentication');
if (!notificationPlugin) throw new Error('expo-notifications config plugin is required for Phase 6.');
if (!biometricPlugin) throw new Error('expo-local-authentication config plugin is required for Phase 6.');
if (notificationPlugin[1]?.defaultChannel !== 'partner-updates') throw new Error('Partner notifications must use the partner-updates default channel.');
if (!String(biometricPlugin[1]?.faceIDPermission || '').includes('INSUREIT Partner')) throw new Error('Face ID permission copy must identify INSUREIT Partner.');

if (/\n\s*push:\s*\n[\s\S]*\.trigger-preview-build/.test(buildWorkflow)) {
  throw new Error('Partner native build workflow must not auto-trigger from a committed build marker.');
}
for (const required of [
  'BUILD_PARTNER_0_2_0',
  'inputs.approval',
  'assets/notification-icon.png',
  "expo.version !== '0.2.0'",
]) {
  if (!buildWorkflow.includes(required)) throw new Error(`Partner native build safety guard missing: ${required}`);
}

const requiredFoundationFiles = [
  'providers/partner-network-provider.tsx',
  'providers/partner-sensitive-privacy-provider.tsx',
  'lib/partner-haptics.ts',
  'lib/partner-native-security.ts',
  'lib/partner-notifications.ts',
  'components/ui/partner-date-picker.tsx',
];
for (const relative of requiredFoundationFiles) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing Phase 6 foundation file: ${relative}`);
}

const privacy = fs.readFileSync(path.join(root, 'providers/partner-sensitive-privacy-provider.tsx'), 'utf8');
for (const required of [
  "^\\/customer\\/[^/]+$",
  "^\\/claim\\/[^/]+$",
  "^\\/policy-intake-new$",
  "^\\/policy-intakes\\/[^/]+$",
  'protectPartnerSensitiveScreen()',
  'releasePartnerSensitiveScreen()',
]) {
  if (!privacy.includes(required)) throw new Error(`Selective privacy contract missing: ${required}`);
}
for (const forbidden of [
  "^\\/$",
  "^\\/home$",
  "^\\/settings$",
  "^\\/policy-intakes$",
  "^\\/\\(tabs\\)",
]) {
  if (privacy.includes(forbidden)) throw new Error(`Ordinary Partner route must remain screenshot-capable: ${forbidden}`);
}

const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
if (!layout.includes('<PartnerSensitivePrivacyProvider>')) throw new Error('Selective Partner privacy provider must wrap the route stack.');
if (layout.includes('protectPartnerSensitiveScreen(') || layout.includes('preventScreenCaptureAsync(')) {
  throw new Error('Root layout must not globally block Partner screenshots.');
}

const notifications = fs.readFileSync(path.join(root, 'lib/partner-notifications.ts'), 'utf8');
for (const required of [
  "PARTNER_PROJECT_ID = '8ade82c1-4c96-4f09-b90b-802270fb406d'",
  "PARTNER_APP_VERSION = '0.2.0'",
  'Notifications.getPermissionsAsync()',
  'Notifications.getExpoPushTokenAsync({ projectId: PARTNER_PROJECT_ID })',
  '/api/partner/push-devices',
  "action: 'register'",
  "action: 'unregister'",
  'Authorization: `Bearer ${session.access_token}`',
]) {
  if (!notifications.includes(required)) throw new Error(`Partner push registration client contract missing: ${required}`);
}
if (notifications.includes('from("partner_push_devices")') || notifications.includes("from('partner_push_devices')")) {
  throw new Error('Partner mobile must never access the push-device table directly.');
}

const runtimeProvider = fs.readFileSync(path.join(root, 'providers/partner-native-runtime-provider.tsx'), 'utf8');
if (!runtimeProvider.includes("session.status !== 'ready'")) throw new Error('Push token refresh must wait for an authenticated Partner session.');
if (!runtimeProvider.includes('registerPartnerPushDevice()')) throw new Error('Granted push registrations must refresh after authenticated startup.');
if (runtimeProvider.includes('requestPartnerNotificationPermission')) throw new Error('Startup must never prompt for notification permission automatically.');

const settings = fs.readFileSync(path.join(root, 'app/settings.tsx'), 'utf8');
for (const required of ['requestPartnerNotificationPermission()', 'registerPartnerPushDevice()', 'this device is registered']) {
  if (!settings.includes(required)) throw new Error(`Partner notification opt-in contract missing: ${required}`);
}

const sessionProvider = fs.readFileSync(path.join(root, 'providers/partner-session-provider.tsx'), 'utf8');
const unregisterIndex = sessionProvider.indexOf('await unregisterPartnerPushDevice()');
const signOutIndex = sessionProvider.indexOf('await signOutFromSupabase()');
if (unregisterIndex < 0 || signOutIndex < 0 || unregisterIndex > signOutIndex) {
  throw new Error('Partner push device must be deactivated best-effort before Supabase sign-out invalidates the bearer token.');
}

console.log('Partner Phase 6 native foundation guard OK: 0.2.0 dependencies/config, selective privacy and server-mediated push registration lifecycle are reviewed; APK build remains explicit/manual-only.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const switcher = read('apps/mobile-app/components/customer-account-switcher.tsx');
const helper = read('apps/mobile-app/lib/customer-profile-photo.ts');
const profile = read('apps/mobile-app/app/customer/profile.tsx');
const screen = read('apps/mobile-app/components/ui.tsx');
const liveScreen = read('apps/mobile-app/components/customer-aware-ui.tsx');
const babel = read('apps/mobile-app/babel.config.js');

assert.match(helper, /\.eq\('customer_id', customerId\)/, 'Photo access must be scoped to the current customer');
assert.match(helper, /\.eq\('document_type', 'Profile Photo'\)/, 'Use the same document kind as the Profile screen');
assert.match(helper, /order\('created_at', \{ ascending: false \}\)/, 'Prefer the latest photo');
assert.match(helper, /createSignedUrl\(data\.storage_path, 3600\)/, 'Use short-lived signed storage URLs');
assert.match(switcher, /getSelectedCustomerContext\(\)/, 'Read current customer context');
assert.match(switcher, /currentSession\?\.user\.id === session\.user\.id/, 'Do not show another account\'s stale photo');
assert.match(switcher, /avatarRequest\.current\+\+/, 'Invalidate in-flight fetches when account changes');
assert.match(switcher, /useFocusEffect\(useCallback\(/, 'Refresh customer photo after navigation and account change');
assert.match(switcher, /subscribeCustomerProfilePhoto\(/, 'Immediate photo refresh is required');
assert.match(profile, /publishCustomerProfilePhoto\(\{ customerId: customer\.id, url: signedPhoto\.data\.signedUrl \}\)/, 'Upload updates header avatar');
assert.match(switcher, /avatarUri \? <Image source=\{\{ uri: avatarUri \}\} style=\{styles\.triggerImage\}/, 'Top-right avatar displays photo');
assert.match(switcher, /onError=\{\(\) => setAvatarUri\(null\)\}/, 'Broken photo falls back to initial');
assert.match(switcher, /onPress=\{\(\) => void openSwitcher\(\)\}/, 'Top-right avatar still opens Switch Account');
assert.match(switcher, /active && avatarUri \? <Image/, 'Only the active account displays its own photo');
assert.match(screen, /<CustomerAccountSwitcherButton initial=\{profileInitial\} \/>/, 'Keep shared header integration');
assert.match(liveScreen, /<CustomerAccountSwitcherButton initial=\{profileInitial\} \/>/, 'Actual customer-aware header must use the photo-aware account switcher');
assert.match(babel, /customer-aware-ui/, 'Confirm active Customer header component path');

console.log('Customer top-right profile photo and account-switch security contracts passed.');

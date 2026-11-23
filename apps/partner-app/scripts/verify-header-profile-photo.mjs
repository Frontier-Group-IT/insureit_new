import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');

const screen = read('apps/partner-app/components/partner-screen.tsx');
const avatar = read('apps/partner-app/components/ui/partner-profile-avatar.tsx');
const provider = read('apps/partner-app/providers/partner-session-provider.tsx');
const profile = read('apps/partner-app/app/profile.tsx');
const tabs = ['index', 'business', 'policies', 'claims', 'more'];

assert.match(screen, /usePartnerSession\(\)/, 'Shared home header must read session avatar');
assert.match(screen, /<PartnerProfileAvatar[\s\S]*?uri=\{avatarUri\}/, 'Home header must display the same image as other tabs');
assert.match(screen, /onPress=\{\(\) => router\.push\('\/profile'\)\}/, 'Partner avatar must retain profile navigation');
assert.doesNotMatch(screen, /homeInitials\(title\)/, 'No initials-only home avatar');
assert.match(avatar, /onError=\{\(\) => setFailedUri\(uri\)\}/, 'Expired signed URL must show initials');
assert.match(avatar, /uri && failedUri !== uri/, 'Reset fallback when a new signed photo URL is supplied');
assert.match(provider, /getPartnerProfilePhotoUrl\(nextContext\.identity\.auth_user_id\)/, 'Photo identity must stay account-scoped');
assert.match(provider, /setAvatarUri\(null\)/, 'Clear avatar on logout');
assert.match(profile, /refreshAvatar\(\)/, 'Partner upload must refresh shared avatar state');
assert.match(profile, /<PartnerCasePageHeader title="Profile & registration"/, 'Keep the existing navy page header');
assert.match(profile, /hero: \{[\s\S]*?marginTop: 14,/, 'Profile hero must flow directly onto the page without a colored card');
assert.match(profile, /profile-team-3d\.png/, 'Profile must use the approved three-person 3D insurance artwork');
assert.match(profile, /<View style=\{styles\.heroTopRow\}>/, 'Photo and sign-out must stay in the upper row');
assert.match(profile, /<View style=\{styles\.heroBody\}>[\s\S]*?<Text style=\{styles\.name\} numberOfLines=\{2\}>/, 'Name must fit two lines alongside avatar without truncating');
assert.doesNotMatch(profile, /backgroundColor: '#1047B9'/, 'Blue profile banner must remain removed');
assert.doesNotMatch(profile, /numberOfLines=\{1\} style=\{styles\.detailValue\}/, 'Full registration details must not truncate');
assert.match(profile, /accessibilityLabel="Change profile photo"/, 'Camera upload remains accessible');
assert.match(profile, /accessibilityLabel="Sign out"/, 'Sign out remains accessible');
assert.match(profile, /PartnerCaseBottomNavigation activeTab="More"/, 'More navigation remains present');
for (const tab of tabs) {
  const body = read('apps/partner-app/app/(tabs)/' + tab + '.tsx');
  assert.match(body, /PartnerProfileAvatar/, tab + ' should display a shared avatar');
  assert.match(body, /uri=\{avatarUri\}/, tab + ' should consume the session photo');
}
console.log('Partner shared profile-photo avatar and signed URL fallback contracts passed.');

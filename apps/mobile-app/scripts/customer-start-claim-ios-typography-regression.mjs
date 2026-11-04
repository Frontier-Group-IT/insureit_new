import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = readFileSync(new URL('../app/customer/start-claim.tsx', import.meta.url), 'utf8');

// Text must remain identical to the approved screenshot.
for (const label of [
  'START A CLAIM',
  'Select the vehicle',
  'Choose the vehicle involved and we’ll use its active policy.',
  'Vehicle number *',
  'Start typing to find a vehicle.',
  'Policy details',
]) {
  assert.ok(file.includes(label), `Missing approved claim-screen copy: ${label}`);
}

assert.ok(file.includes('<Text style={[styles.eyebrow, styles.iosEyebrow]}>START A CLAIM</Text>'), 'iOS should use a distinct readable eyebrow style');
assert.match(file, /<Text style=\{\[styles\.title, styles\.iosTitle\]\} numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.82\}>Select the vehicle<\/Text>/, 'iOS heading must stay one line and shrink only when necessary, no lower than approximately 18pt');
assert.match(file, /<Text style=\{\[styles\.subtitle, styles\.iosSubtitle\]\}>/, 'iOS subtitle must wrap instead of squeezing to one line');

// On iOS the subtitle must be inside the left heroCopy column, directly after
// the title. It must not be rendered after the artwork row (which creates a gap).
const iosHero = file.split("{Platform.OS === 'ios' ? (")[1]?.split(") : (")[0];
assert.ok(iosHero, 'The iOS hero branch must exist');
assert.match(
  iosHero,
  /<Text style=\{\[styles\.title, styles\.iosTitle\]\}[^>]*>Select the vehicle<\/Text>\s*<Text style=\{\[styles\.subtitle, styles\.iosSubtitle\]\}>\s*Choose the vehicle involved and we’ll use its active policy\.\s*<\/Text>\s*<\/View>\s*<Image/,
  'iOS supporting copy must sit immediately under the title inside heroCopy, before the right-side artwork',
);
assert.equal((iosHero.match(/styles\.iosSubtitle/g) ?? []).length, 1, 'iOS subtitle must appear exactly once');

assert.doesNotMatch(file, /<Text style=\{\[styles\.subtitle, styles\.iosSubtitle\]\} numberOfLines=\{1\}/, 'iOS supporting copy must not be constrained to one line');
assert.match(file, /iosEyebrow:\s*\{\s*fontSize:\s*12,/, 'iOS eyebrow size should match approved visual hierarchy');
assert.match(file, /iosTitle:\s*\{\s*fontSize:\s*22,/, 'iOS heading size should match approved visual hierarchy');
assert.match(file, /iosSubtitle:\s*\{[^}]*fontSize:\s*13,/, 'iOS subtitle must be comfortably readable');
assert.match(file, /iosSectionLabel:\s*\{\s*fontSize:\s*15,/, 'iOS field heading needs proper emphasis');
assert.match(file, /iosSectionTitle:\s*\{\s*fontSize:\s*18,/, 'iOS policy heading needs proper emphasis');
assert.match(file, /iosHelper:\s*\{\s*fontSize:\s*12,/, 'iOS hint needs proper readability');
assert.match(file, /Platform\.OS === 'ios' && styles\.iosSectionLabel/, 'Field overrides must be iOS-scoped');
assert.match(file, /Platform\.OS === 'ios' && styles\.iosSectionTitle/, 'Section overrides must be iOS-scoped');

// Android should retain the original branch and shared base styles.
assert.match(file, /\) : \(\s*<>\s*<View style=\{styles\.heroCopy\}>/, 'Keep the Android hero branch');
assert.match(file, /<Text style=\{styles\.title\}>Select the vehicle<\/Text>/, 'Android heading must remain unchanged');
assert.match(file, /<Text style=\{styles\.subtitle\}>Choose the vehicle involved and we’ll use its active policy\.<\/Text>/, 'Android subtitle must remain unchanged');
assert.match(file, /<VehicleDropdown[\s\S]*?onSelect=\{\(vehicle\) => \{/, 'Vehicle selection must remain wired to the existing flow');
assert.match(file, /<ClaimActionBar[\s\S]*?onPrimary=\{\(\) => void continueClaim\(\)\}/, 'Start Claim action must remain wired');

console.log('Customer Start Claim iOS typography and workflow regression passed.');

// Regression check for logged-in-person identity on Partner Home, More and Profile.
// Run with: node apps/partner-app/scripts/verify-signed-in-person.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const helper = read('lib/signed-in-person.ts');
const home = read('app/(tabs)/index.tsx');
const more = read('app/(tabs)/more.tsx');
const profile = read('app/profile.tsx');

assert.match(helper, /associate_name\?\.trim\(\)/, 'Associate personal name must take priority');
assert.match(helper, /return associate \|\| identity\.display_name/, 'Keep fallback for principal accounts');
assert.match(helper, /account_subtype === 'group_associate'/, 'Group Associate role must be distinct');
assert.match(helper, /associate_role\?\.trim\(\)/, 'Partner Associate role must come from identity');
assert.match(helper, /group_name\?\.trim\(\)/, 'Preserve Group name as organization');
assert.match(helper, /branch_name\?\.trim\(\)/, 'Preserve Branch name as organization');
assert.match(home, /greeting\(signedInPersonName\(identity\)\)/);
assert.match(home, /name=\{signedInPersonName\(identity\)\}/);
assert.match(more, /const identityLabel = signedInPersonRole\(context\.identity\)/);
assert.match(more, /name=\{signedInPersonName\(context\.identity\)\}/);
assert.match(profile, /signedInOrganizationName\(identity\)/);
assert.match(profile, /value=\{roleLabel\}/);
assert.match(profile, /initials\(signedInPersonName\(identity\)\)/);
assert.match(profile, /\{signedInPersonName\(identity\)\}/);
console.log('Partner signed-in-person display regression checks passed.');

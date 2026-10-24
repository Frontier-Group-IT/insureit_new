import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('apps/partner-app/app/(tabs)/index.tsx', 'utf8');
// A visual pressed state without onPress is consistent with iOS ScrollView
// cancelling a child press between touch-down and release.
assert.match(home, /scrollProps=\{\{[\s\S]*?canCancelContentTouches: Platform\.OS !== 'ios',[\s\S]*?delaysContentTouches: false,/);
assert.match(home, /directionalLockEnabled\s+canCancelContentTouches=\{Platform\.OS !== 'ios'\}\s+delaysContentTouches=\{false\}/);
for (const destination of ["'/(tabs)/business'", "'/(tabs)/more'", "'/renewals'", "'/(tabs)/claims'", "'/customers'"]) {
  assert.ok(home.includes('router.push(' + destination + ')'), 'Missing navigation: ' + destination);
}
assert.match(home, /onPress=\{\(\) => setPeriodOpen\(\(value\) => !value\)\}/);
console.log('Home touch-cancellation protection and action handlers verified');

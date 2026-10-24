import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync('apps/partner-app/' + path, 'utf8');
const screen = read('components/partner-screen.tsx');
const home = read('app/(tabs)/index.tsx');
const enter = read('components/ui/partner-enter.tsx');
assert.match(enter, /<Animated\.View\s+pointerEvents="box-none"/, 'Animated entrance wrappers must not consume background taps');
assert.match(screen, /<View pointerEvents="none" style=\{styles\.homeHeroShade\}/, 'Hero shade must be decorative');
assert.match(screen, /style=\{\[styles\.fixedWhiteHeader, \{ top: safeAreaInsets\.top \}\]\} pointerEvents="box-none"/, 'Sticky shell must pass through touches outside controls');
for (const route of ["'/(tabs)/business'", "'/(tabs)/more'", "'/renewals'", "'/(tabs)/claims'", "'/customers'"]) {
  assert.ok(home.includes('router.push(' + route + ')'), 'Missing Home action route ' + route);
}
assert.match(home, /onPress=\{\(\) => setPeriodOpen\(\(value\) => !value\)\}/, 'MTD dropdown handler must remain wired');
assert.match(home, /keyboardShouldPersistTaps="always"/, 'Carousel taps should remain actionable');
console.log('Partner Home touch-layer and action routing contracts passed');

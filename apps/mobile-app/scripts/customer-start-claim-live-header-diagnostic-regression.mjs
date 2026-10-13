import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Regression for the *effective* Customer screen resolved by both TS and Babel.
// Previous diagnostics targeted components/ui.tsx, which is not the active
// Customer Screen when screens import '@/components/ui'.
const customerScreen = await readFile(new URL('../components/customer-aware-ui.tsx', import.meta.url), 'utf8');
const startClaim = await readFile(new URL('../app/customer/start-claim.tsx', import.meta.url), 'utf8');
const tsconfig = JSON.parse(await readFile(new URL('../tsconfig.json', import.meta.url), 'utf8'));
const babel = await readFile(new URL('../babel.config.js', import.meta.url), 'utf8');

assert.deepEqual(
  tsconfig.compilerOptions.paths['@/components/ui'],
  ['./components/customer-aware-ui'],
  'TypeScript must resolve the Customer UI alias to the instrumented wrapper.',
);
assert.ok(
  babel.includes("'^@/components/ui$': './components/customer-aware-ui'"),
  'Metro/Babel must resolve the Customer UI alias to the same wrapper.',
);
assert.match(startClaim, /from '@\/components\/ui'/, 'Start Claim must import the effective Customer UI alias.');
assert.match(customerScreen, /function CustomerFixedScreen\(/, 'CustomerFixedScreen is the active Customer Screen.');
assert.match(customerScreen, /source: 'customer-fixed-screen-brand'/, 'The active header must log its REPLACE caller.');
assert.match(customerScreen, /onPress=\{openDashboard\}/, 'The active header must use the instrumented press handler.');
assert.match(customerScreen, /onPressIn=\{\(event\) => traceStartClaimTouch\('fixed-header-logo-press-in', event\)\}/, 'Press-in must log on the real Customer header.');
assert.match(customerScreen, /traceStartClaimTouch\('fixed-header', event\)/, 'Fixed header must log touch coordinates.');
assert.match(customerScreen, /traceStartClaimTouch\('scroll-body', event\)/, 'Scroll body must log touch coordinates.');
assert.match(customerScreen, /router\.replace\('\/customer\/home'\)/, 'The diagnostic must precede the existing unmodified header navigation.');

// V6 confirmed the *actual* CustomerFixedScreen brand caused 8/8 sampled
// unexpected REPLACE-to-Home transitions, often from lower-screen taps.
// The route-specific static logo must precede the interactive branch.
assert.match(
  customerScreen,
  /\{pathname === '\/customer\/start-claim' \? \([\s\S]*<View pointerEvents="none" style=\{baseStyles\.fixedBrandStatic\}>[\s\S]*<BrandLogo width=\{132\} inverse \/>[\s\S]*<\/View>[\s\S]*\) : \([\s\S]*<Pressable[\s\S]*onPress=\{openDashboard\}/,
  'Start Claim must render a noninteractive logo while other Customer pages retain the dashboard press handler.',
);
assert.match(
  customerScreen,
  /function openDashboard\(\) \{[\s\S]*router\.replace\('\/customer\/home'\)/,
  'Other Customer pages must preserve the existing dashboard navigation.',
);

console.log('Effective CustomerFixedScreen Start Claim navigation-origin diagnostic regression passed.');
